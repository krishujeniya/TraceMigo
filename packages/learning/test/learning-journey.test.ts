import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { stat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabase, migrateCore, sql } from '../../../packages/db/dist/index.js';
import {
  createAttempt,
  advanceStage,
  autosaveAttempt,
  pauseAttempt,
  resumeAttempt,
  requestDisclosure,
  submitAttempt,
  completeAttempt,
  abandonAttempt,
  getAttempt,
  executeIdempotentOperation,
  hashPayload,
  appendAttemptEvent,
  replayEvents,
  formatSSEMessage,
  IdempotencyConflictError,
  ConcurrentModificationError,
  InvalidStageTransitionError,
  SoloMockDisclosureError,
  AttemptFinalizedError,
} from '../dist/index.js';

// Setup connection details for the disposable PostgreSQL cluster
const host = process.env.TRACEMIGO_TEST_PG_SOCKET;
if (!host || !host.startsWith('/tmp/tracemigo-pg17-')) {
  throw new Error('Use an explicitly configured disposable /tmp PostgreSQL Unix socket.');
}

const permissions = await stat(host);
if (!permissions.isDirectory() || (permissions.mode & 0o077) !== 0 || permissions.uid !== process.getuid()) {
  throw new Error('Test socket directory must be private and owned by current user.');
}

const port = Number(process.env.TRACEMIGO_TEST_PG_PORT ?? '55432');
const admin = process.env.TRACEMIGO_TEST_PG_ADMIN ?? 'tracemigo_bootstrap';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const bootstrapSql = await readFile(path.join(root, 'packages/db/bootstrap/roles.sql'), 'utf8');

const handles: Array<{ destroy: () => Promise<void> }> = [];

function connect(database: string, user = admin, max = 3) {
  const handle = createDatabase({ host, port, user, database, max });
  handles.push(handle);
  return handle;
}

const maintenance = connect('postgres');
const databases: string[] = [];

async function createFreshDatabase() {
  const name = 'tracemigo_lrn_test_' + randomUUID().replaceAll('-', '');
  await sql.raw(`CREATE DATABASE "${name}"`).execute(maintenance.db);
  databases.push(name);
  const handle = connect(name);
  await sql.raw(bootstrapSql).execute(handle.db);
  await migrateCore(handle.db);
  return { name, handle };
}

async function ownerTx<T>(handle: ReturnType<typeof connect>, fn: (tx: any) => Promise<T>): Promise<T> {
  return handle.db.transaction().execute(async (tx) => {
    await sql`SET LOCAL ROLE tracemigo_owner`.execute(tx);
    return fn(tx);
  });
}

test.after(async () => {
  for (const h of handles) {
    await h.destroy().catch(() => {});
  }
  for (const name of databases) {
    await sql.raw(`DROP DATABASE IF EXISTS "${name}"`).execute(maintenance.db).catch(() => {});
  }
  await maintenance.destroy().catch(() => {});
});

// ---------------------------------------------------------------------------
// Unit Tests: Deterministic Hashing and SSE Formatting
// ---------------------------------------------------------------------------

test('hashPayload produces deterministic lowercase SHA-256 independent of key order', () => {
  const p1 = { b: 2, a: 1, c: { y: 'bar', x: 'foo' } };
  const p2 = { a: 1, c: { x: 'foo', y: 'bar' }, b: 2 };

  const h1 = hashPayload(p1);
  const h2 = hashPayload(p2);

  assert.equal(h1.length, 64);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(h1, h2);

  // Primitive and null values
  assert.match(hashPayload(null), /^[0-9a-f]{64}$/);
  assert.match(hashPayload('hello'), /^[0-9a-f]{64}$/);
  assert.notEqual(hashPayload('hello'), hashPayload('world'));
});

test('formatSSEMessage formats compliant Server-Sent Events messages', () => {
  const msg = {
    id: '42',
    event: 'stage_advanced',
    data: JSON.stringify({ stage: 'predict' }),
  };
  const formatted = formatSSEMessage(msg);
  assert.equal(formatted, `id: 42\nevent: stage_advanced\ndata: {"stage":"predict"}\n\n`);
});

// ---------------------------------------------------------------------------
// Integration Tests: Learning Journey & Attempt State Machine
// ---------------------------------------------------------------------------

test('Attempt lifecycle: creation, stage transitions, optimistic revision ratchet', async () => {
  const { handle } = await createFreshDatabase();

  const tenantId = randomUUID();
  const userId = randomUUID();
  const problemId = randomUUID();
  const versionId = randomUUID();
  const attemptId = randomUUID();

  // Setup database fixtures under tracemigo_owner
  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.tenants (id, name) VALUES (${tenantId}, 'Learning Tenant')`.execute(tx);
    await sql`INSERT INTO app.users (id, oidc_issuer, oidc_subject) VALUES (${userId}, 'https://auth.example.com', 'learner-1')`.execute(tx);
    await sql`INSERT INTO app.memberships (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'learner')`.execute(tx);
    await sql`INSERT INTO app.problems (id, slug, family_id, difficulty, sealed) VALUES (${problemId}, 'count-primes', 'math', 'foundation', false)`.execute(tx);
    await sql`INSERT INTO app.problem_versions (id, problem_id, version_number, status, language, content_hash, public_manifest_key, public_manifest, runtime_digest)
              VALUES (${versionId}, ${problemId}, 1, 'draft', 'python', ${'a'.repeat(64)}, 'key', '{"schema_version":"case.public.v1","data":{"title":"Test"}}'::jsonb, ${'sha256:' + 'b'.repeat(64)})`.execute(tx);
  });

  // 1. Spaced retrieval without prior attempt must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await createAttempt(tx, {
        id: randomUUID(),
        tenantId,
        userId,
        problemVersionId: versionId,
        mode: 'practice',
        contextSource: 'spaced_retrieval',
      });
    }),
    /Spaced retrieval attempts require a prior_attempt_id/
  );

  // 2. Normal attempt creation
  const created = await ownerTx(handle, async (tx) => {
    return createAttempt(tx, {
      id: attemptId,
      tenantId,
      userId,
      problemVersionId: versionId,
      mode: 'practice',
      contextSource: 'direct',
    });
  });

  assert.equal(created.id, attemptId);
  assert.equal(created.stage, 'warmup');
  assert.equal(created.status, 'active');
  assert.equal(created.revision, 0);
  assert.equal(created.disclosure_level, 0);

  // Verify attempt_created event seq=1
  const eventsAfterCreate = await ownerTx(handle, async (tx) => {
    return replayEvents(tx, tenantId, userId, attemptId, 0);
  });
  assert.equal(eventsAfterCreate.length, 1);
  assert.equal(eventsAfterCreate[0].event, 'attempt_created');
  assert.equal(eventsAfterCreate[0].id, '1');

  // 3. Stage Progression: warmup -> predict (revision 0 -> 1)
  const afterPredict = await ownerTx(handle, async (tx) => {
    return advanceStage(tx, {
      tenantId,
      userId,
      attemptId,
      expectedRevision: 0,
      toStage: 'predict',
      eventDetails: { reason: 'warmup completed' },
    });
  });
  assert.equal(afterPredict.stage, 'predict');
  assert.equal(afterPredict.revision, 1);

  // 4. Invalid stage skip: predict -> review must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await advanceStage(tx, {
        tenantId,
        userId,
        attemptId,
        expectedRevision: 1,
        toStage: 'review',
      });
    }),
    (err: any) => err instanceof InvalidStageTransitionError
  );

  // 5. Stale revision / Optimistic Concurrency failure
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await advanceStage(tx, {
        tenantId,
        userId,
        attemptId,
        expectedRevision: 0, // Stale! Revision is already 1
        toStage: 'trace',
      });
    }),
    (err: any) => err instanceof ConcurrentModificationError
  );

  // 6. Complete full progression: predict -> trace -> explain -> mutate -> review
  const afterTrace = await ownerTx(handle, async (tx) => {
    return advanceStage(tx, { tenantId, userId, attemptId, expectedRevision: 1, toStage: 'trace' });
  });
  assert.equal(afterTrace.stage, 'trace');
  assert.equal(afterTrace.revision, 2);

  const afterExplain = await ownerTx(handle, async (tx) => {
    return advanceStage(tx, { tenantId, userId, attemptId, expectedRevision: 2, toStage: 'explain' });
  });
  assert.equal(afterExplain.stage, 'explain');
  assert.equal(afterExplain.revision, 3);

  // Autosave during explain stage (e.g. learner drafting their claim)
  const afterAutosave = await ownerTx(handle, async (tx) => {
    return autosaveAttempt(tx, {
      tenantId,
      userId,
      attemptId,
      expectedRevision: 3,
      eventType: 'claim_autosaved',
      eventDetails: { claim: 'The off-by-one occurs in the upper loop bound' },
    });
  });
  assert.equal(afterAutosave.stage, 'explain');
  assert.equal(afterAutosave.revision, 4);

  const afterMutate = await ownerTx(handle, async (tx) => {
    return advanceStage(tx, { tenantId, userId, attemptId, expectedRevision: 4, toStage: 'mutate' });
  });
  assert.equal(afterMutate.stage, 'mutate');
  assert.equal(afterMutate.revision, 5);

  const afterReview = await ownerTx(handle, async (tx) => {
    return advanceStage(tx, { tenantId, userId, attemptId, expectedRevision: 5, toStage: 'review' });
  });
  assert.equal(afterReview.stage, 'review');
  assert.equal(afterReview.revision, 6);

  // Review is terminal stage; transitioning beyond review must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await advanceStage(tx, { tenantId, userId, attemptId, expectedRevision: 6, toStage: 'warmup' });
    }),
    (err: any) => err instanceof InvalidStageTransitionError
  );

  // 7. Pause and Resume
  const paused = await ownerTx(handle, async (tx) => {
    return pauseAttempt(tx, tenantId, userId, attemptId, 6);
  });
  assert.equal(paused.status, 'paused');
  assert.equal(paused.revision, 7);

  // Pausing already paused attempt fails
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await pauseAttempt(tx, tenantId, userId, attemptId, 7);
    }),
    /Cannot pause attempt in state 'paused'/
  );

  const resumed = await ownerTx(handle, async (tx) => {
    return resumeAttempt(tx, tenantId, userId, attemptId, 7);
  });
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.revision, 8);

  // 8. Disclosure progression
  const disclosed = await ownerTx(handle, async (tx) => {
    return requestDisclosure(tx, tenantId, userId, attemptId, 8);
  });
  assert.equal(disclosed.disclosure_level, 1);
  assert.equal(disclosed.revision, 9);

  // 9. Submit Attempt
  const submissionId = randomUUID();
  const sourceSha256 = 'c'.repeat(64);
  const submitted = await ownerTx(handle, async (tx) => {
    return submitAttempt(tx, {
      tenantId,
      userId,
      attemptId,
      expectedRevision: 9,
      submissionId,
      sourceSha256,
      objectKey: 'submissions/' + submissionId + '.py',
    });
  });
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.revision, 10);

  // 10. Operations on submitted attempt must throw AttemptFinalizedError
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await advanceStage(tx, { tenantId, userId, attemptId, expectedRevision: 10, toStage: 'warmup' });
    }),
    (err: any) => err instanceof AttemptFinalizedError
  );

  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await autosaveAttempt(tx, {
        tenantId,
        userId,
        attemptId,
        expectedRevision: 10,
        eventType: 'code_saved',
      });
    }),
    (err: any) => err instanceof AttemptFinalizedError
  );

  // 11. SSE Replay verification
  const allEvents = await ownerTx(handle, async (tx) => {
    return replayEvents(tx, tenantId, userId, attemptId, 0);
  });
  assert.equal(allEvents.length, 11); // 1 create + 5 stages + 1 autosave + 1 pause + 1 resume + 1 disclosure + 1 submit
  assert.equal(allEvents[0].event, 'attempt_created');
  assert.equal(allEvents[allEvents.length - 1].event, 'attempt_submitted');

  // Replay from cursor seq=8
  const replayFrom8 = await ownerTx(handle, async (tx) => {
    return replayEvents(tx, tenantId, userId, attemptId, 8);
  });
  assert.equal(replayFrom8.length, 3); // seq 9 (resume), seq 10 (disclosure), seq 11 (submit)
  assert.equal(replayFrom8[0].id, '9');
  assert.equal(replayFrom8[1].id, '10');
  assert.equal(replayFrom8[2].id, '11');

  // Replay with out-of-bounds cursor
  const replayFuture = await ownerTx(handle, async (tx) => {
    return replayEvents(tx, tenantId, userId, attemptId, 999);
  });
  assert.equal(replayFuture.length, 0);

  // 12. Complete and Abandon Attempt
  const completed = await ownerTx(handle, async (tx) => {
    return completeAttempt(tx, tenantId, userId, attemptId, 10);
  });
  assert.equal(completed.status, 'completed');
  assert.notEqual(completed.finished_at, null);
  assert.equal(completed.revision, 11);

  // Querying getAttempt
  const fetched = await ownerTx(handle, async (tx) => {
    return getAttempt(tx, tenantId, userId, attemptId);
  });
  assert.ok(fetched);
  assert.equal(fetched.id, attemptId);
  assert.equal(fetched.status, 'completed');
  assert.equal(fetched.revision, 11);
});

test('Mock Solo mode strictly forbids hint disclosures', async () => {
  const { handle } = await createFreshDatabase();

  const tenantId = randomUUID();
  const userId = randomUUID();
  const problemId = randomUUID();
  const versionId = randomUUID();
  const attemptId = randomUUID();

  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.tenants (id, name) VALUES (${tenantId}, 'Solo Tenant')`.execute(tx);
    await sql`INSERT INTO app.users (id, oidc_issuer, oidc_subject) VALUES (${userId}, 'https://auth.example.com', 'solo-learner')`.execute(tx);
    await sql`INSERT INTO app.memberships (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'learner')`.execute(tx);
    await sql`INSERT INTO app.problems (id, slug, family_id, difficulty, sealed) VALUES (${problemId}, 'tree-depth', 'trees', 'core', false)`.execute(tx);
    await sql`INSERT INTO app.problem_versions (id, problem_id, version_number, status, language, content_hash, public_manifest_key, public_manifest, runtime_digest)
              VALUES (${versionId}, ${problemId}, 1, 'draft', 'python', ${'d'.repeat(64)}, 'key', '{"schema_version":"case.public.v1","data":{"title":"Test"}}'::jsonb, ${'sha256:' + 'e'.repeat(64)})`.execute(tx);

    await createAttempt(tx, {
      id: attemptId,
      tenantId,
      userId,
      problemVersionId: versionId,
      mode: 'mock_solo',
    });
  });

  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await requestDisclosure(tx, tenantId, userId, attemptId, 0);
    }),
    (err: any) => err instanceof SoloMockDisclosureError
  );
});

test('Database trigger invariants: immutability of events, submissions, and attempt identity', async () => {
  const { handle } = await createFreshDatabase();

  const tenantId = randomUUID();
  const userId = randomUUID();
  const problemId = randomUUID();
  const versionId = randomUUID();
  const attemptId = randomUUID();
  const submissionId = randomUUID();

  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.tenants (id, name) VALUES (${tenantId}, 'Immutability Tenant')`.execute(tx);
    await sql`INSERT INTO app.users (id, oidc_issuer, oidc_subject) VALUES (${userId}, 'https://auth.example.com', 'imm-learner')`.execute(tx);
    await sql`INSERT INTO app.memberships (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'learner')`.execute(tx);
    await sql`INSERT INTO app.problems (id, slug, family_id, difficulty, sealed) VALUES (${problemId}, 'lru-cache', 'design', 'core', false)`.execute(tx);
    await sql`INSERT INTO app.problem_versions (id, problem_id, version_number, status, language, content_hash, public_manifest_key, public_manifest, runtime_digest)
              VALUES (${versionId}, ${problemId}, 1, 'draft', 'python', ${'f'.repeat(64)}, 'key', '{"schema_version":"case.public.v1","data":{"title":"Test"}}'::jsonb, ${'sha256:' + '1'.repeat(64)})`.execute(tx);

    await createAttempt(tx, {
      id: attemptId,
      tenantId,
      userId,
      problemVersionId: versionId,
      mode: 'practice',
    });

    await sql`INSERT INTO app.submissions (id, tenant_id, user_id, attempt_id, source_sha256, object_key)
              VALUES (${submissionId}, ${tenantId}, ${userId}, ${attemptId}, ${'2'.repeat(64)}, 'sub/key.py')`.execute(tx);
  });

  // 1. Attempting to UPDATE app.attempt_events must be rejected by trigger events_immutable
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE app.attempt_events SET event_type = 'tampered' WHERE attempt_id = ${attemptId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Append-only record')
  );

  // 2. Attempting to DELETE app.attempt_events must be rejected by trigger events_immutable
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`DELETE FROM app.attempt_events WHERE attempt_id = ${attemptId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Append-only record')
  );

  // 3. Attempting to UPDATE app.submissions must be rejected by trigger submissions_immutable
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE app.submissions SET source_sha256 = ${'3'.repeat(64)} WHERE id = ${submissionId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Append-only record')
  );

  // 4. Attempting to mutate attempt identity (user_id, problem_version_id, started_at) must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE app.attempts SET user_id = ${randomUUID()}, revision = revision + 1 WHERE id = ${attemptId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Attempt identity is immutable')
  );

  // 5. Attempting to skip revisions on app.attempts must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE app.attempts SET revision = revision + 5 WHERE id = ${attemptId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Revision must increase by one')
  );
});

test('Idempotency transaction: caching, deterministic conflict detection, and immutability', async () => {
  const { handle } = await createFreshDatabase();

  const tenantId = randomUUID();
  const userId = randomUUID();
  const key = 'idem-req-' + randomUUID();
  const route = '/v1/attempts/create';

  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.tenants (id, name) VALUES (${tenantId}, 'Idempotency Tenant')`.execute(tx);
    await sql`INSERT INTO app.users (id, oidc_issuer, oidc_subject) VALUES (${userId}, 'https://auth.example.com', 'idem-user')`.execute(tx);
    await sql`INSERT INTO app.memberships (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'learner')`.execute(tx);
  });

  const payloadA = { problem: 'two-sum', mode: 'practice' };
  let executionCount = 0;

  // 1. Initial execution
  const res1 = await ownerTx(handle, async (tx) => {
    return executeIdempotentOperation(tx, tenantId, userId, route, key, payloadA, async () => {
      executionCount++;
      return { status: 201, body: { attemptId: 'att-123' } };
    });
  });

  assert.equal(res1.status, 201);
  assert.equal(res1.body.attemptId, 'att-123');
  assert.equal(res1.cached, false);
  assert.equal(executionCount, 1);

  // 2. Re-execution with IDENTICAL payload returns cached response without running operation
  const res2 = await ownerTx(handle, async (tx) => {
    return executeIdempotentOperation(tx, tenantId, userId, route, key, payloadA, async () => {
      executionCount++;
      return { status: 201, body: { attemptId: 'should-not-reach' } };
    });
  });

  assert.equal(res2.status, 201);
  assert.equal(res2.body.attemptId, 'att-123');
  assert.equal(res2.cached, true);
  assert.equal(executionCount, 1); // Not incremented!

  // 3. Re-execution with DIFFERENT payload throws IdempotencyConflictError
  const payloadB = { problem: 'different-problem', mode: 'practice' };
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await executeIdempotentOperation(tx, tenantId, userId, route, key, payloadB, async () => {
        return { status: 201, body: {} };
      });
    }),
    (err: any) => err instanceof IdempotencyConflictError
  );

  // 4. Trigger ops.guard_idempotency_update(): tampering with completed idempotency record is forbidden
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE ops.idempotency_records SET request_hash = ${'9'.repeat(64)} WHERE key = ${key}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Idempotency identity or completed response is immutable')
  );
});
