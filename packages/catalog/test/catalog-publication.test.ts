import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { stat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabase, migrateCore, sql } from '../../../packages/db/dist/index.js';
import {
  calculateContentHash,
  calculateOracleHash,
  calculateWitnessHash,
  createPublicProjection,
  assertNoLeakage,
  ProjectionLeakageError,
  createProblem,
  createDraftVersion,
  attachAuthority,
  recordContentReview,
  submitForReview,
  publishVersion,
  retireVersion,
  type PublicManifestEnvelope,
  type ProblemMetadata,
  type ProblemVersionRecord,
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
  const name = 'tracemigo_cat_test_' + randomUUID().replaceAll('-', '');
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

const sampleManifest: PublicManifestEnvelope = {
  schema_version: 'case.public.v1',
  data: {
    title: 'Two Sum in Python',
    slug: 'two-sum',
    summary: 'Find two indices that sum to the target.',
    difficulty: 'foundation',
    entrypoint: 'solution.py',
    files: {
      'solution.py': 'def two_sum(nums, target):\n    pass\n',
      'README.md': '# Two Sum\n\nImplement two sum.\n',
    },
    hints: ['Consider using a dictionary.'],
  },
};

// ---------------------------------------------------------------------------
// Unit Tests: Deterministic Hashing and Projection Leakage Defense
// ---------------------------------------------------------------------------

test('Hashing utilities compute deterministic 64-char lowercase SHA-256 hashes', () => {
  const contentHash = calculateContentHash(sampleManifest);
  assert.equal(contentHash.length, 64);
  assert.match(contentHash, /^[0-9a-f]{64}$/);
  // Identical input produces identical hash
  assert.equal(calculateContentHash(sampleManifest), contentHash);

  const oracleHash = calculateOracleHash('def two_sum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        if target - n in lookup: return [lookup[target - n], i]\n        lookup[n] = i\n');
  assert.equal(oracleHash.length, 64);
  assert.match(oracleHash, /^[0-9a-f]{64}$/);

  const witnessHash = calculateWitnessHash({ steps: 5, passed: true });
  assert.equal(witnessHash.length, 64);
  assert.match(witnessHash, /^[0-9a-f]{64}$/);

  assert.throws(() => calculateOracleHash(''), /non-empty string/);
});

test('Projection generator creates clean public view for published problems', () => {
  const problem: ProblemMetadata = {
    id: randomUUID(),
    slug: 'two-sum',
    familyId: 'family-array-search',
    difficulty: 'foundation',
    sealed: false,
  };

  const version: ProblemVersionRecord = {
    id: randomUUID(),
    problemId: problem.id,
    versionNumber: 1,
    status: 'published',
    language: 'python',
    contentHash: calculateContentHash(sampleManifest),
    publicManifestKey: 'cases/two-sum/v1/public.json',
    publicManifest: sampleManifest,
    runtimeDigest: 'sha256:' + 'b'.repeat(64),
    publishedAt: new Date('2026-11-01T12:00:00Z'),
  };

  // Valid projection
  const projection = createPublicProjection(problem, version);
  assert.equal(projection.problemId, problem.id);
  assert.equal(projection.slug, 'two-sum');
  assert.equal(projection.title, 'Two Sum in Python');
  assert.equal(projection.difficulty, 'foundation');
  assert.ok(projection.files['solution.py']);
  assert.equal((projection as any).private_bundle_key, undefined);
  assert.equal((projection as any).oracle_hash, undefined);

  // Unpublished version cannot be projected
  const draftVersion: ProblemVersionRecord = { ...version, status: 'draft', publishedAt: null };
  assert.throws(() => createPublicProjection(problem, draftVersion), /unpublished/);
});

test('Sealed assessment cases are quarantined and cannot be projected to public catalog (ADR 0006)', () => {
  const problem: ProblemMetadata = {
    id: randomUUID(),
    slug: 'sealed-diagnostic-1',
    familyId: 'family-diagnostic',
    difficulty: 'core',
    sealed: true,
  };

  const version: ProblemVersionRecord = {
    id: randomUUID(),
    problemId: problem.id,
    versionNumber: 1,
    status: 'published',
    language: 'python',
    contentHash: calculateContentHash(sampleManifest),
    publicManifestKey: 'cases/sealed-1/v1/public.json',
    publicManifest: sampleManifest,
    runtimeDigest: 'sha256:' + 'b'.repeat(64),
    publishedAt: new Date('2026-11-01T12:00:00Z'),
  };

  assert.throws(() => createPublicProjection(problem, version), /Sealed problem/);
});

test('Anti-leakage scanner detects private keys, sealed answer fixtures, and sourcemap markers', () => {
  // Deep scan catches private keys
  assert.throws(
    () => assertNoLeakage({ harmless: 'ok', nested: { private_bundle_key: 'secret/key.tar.gz' } }),
    ProjectionLeakageError
  );
  assert.throws(
    () => assertNoLeakage({ rubric: { rubric_definitions: [] } }),
    ProjectionLeakageError
  );
  assert.throws(
    () => assertNoLeakage({ key: '-----BEGIN RSA PRIVATE KEY-----' }),
    ProjectionLeakageError
  );

  // Deep scan catches source maps
  assert.throws(
    () => assertNoLeakage({ code: '//# sourceMappingURL=app.js.map' }),
    ProjectionLeakageError
  );
  assert.throws(
    () => assertNoLeakage({ file: 'bundle.js.map' }),
    ProjectionLeakageError
  );
  assert.throws(
    () => assertNoLeakage({ file: 'types.ts.map' }),
    ProjectionLeakageError
  );
});

// ---------------------------------------------------------------------------
// Integration Tests: Publication Lifecycle State Machine on PostgreSQL 17
// ---------------------------------------------------------------------------

test('Publication lifecycle enforces Draft -> Review -> Published -> Retired on PostgreSQL 17', async () => {
  const { handle } = await createFreshDatabase();

  const problemId = randomUUID();
  const versionId = randomUUID();
  const rev1Id = randomUUID();
  const rev2Id = randomUUID();
  const contentHash = calculateContentHash(sampleManifest);
  const runtimeDigest = 'sha256:' + 'c'.repeat(64);
  const oracleHash = calculateOracleHash('def oracle(): return 42');
  const witnessHash = calculateWitnessHash({ verified: true });

  // 1. Setup reviewers and problem
  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.users (id, oidc_issuer, oidc_subject)
              VALUES (${rev1Id}, 'https://auth.example.com', 'rev-1'),
                     (${rev2Id}, 'https://auth.example.com', 'rev-2')`.execute(tx);

    await createProblem(tx, {
      id: problemId,
      slug: 'sample-case',
      familyId: 'sample-family',
      difficulty: 'foundation',
      sealed: false,
    });
  });

  // 2. Draft Creation: Attempting to insert version with status != 'draft' directly must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`INSERT INTO app.problem_versions (id, problem_id, version_number, status, language, content_hash, public_manifest_key, public_manifest, runtime_digest)
                VALUES (${randomUUID()}, ${problemId}, 99, 'published', 'python', ${contentHash}, 'key', ${JSON.stringify(sampleManifest)}::jsonb, ${runtimeDigest})`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Content starts in draft')
  );

  // 3. Normal draft insertion and authority attachment
  await ownerTx(handle, async (tx) => {
    await createDraftVersion(tx, {
      id: versionId,
      problemId,
      versionNumber: 1,
      publicManifestKey: 'cases/sample/v1/public.json',
      publicManifest: sampleManifest,
      runtimeDigest,
      contentHash,
    });

    await attachAuthority(tx, {
      versionId,
      privateBundleKey: 'cases/sample/v1/private.tar.gz',
      oracleHash,
      witnessHash,
    });
  });

  // 4. Attempting to publish directly from draft must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await publishVersion(tx, versionId);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Publication requires review state')
  );

  // Move to 'review' state
  await ownerTx(handle, async (tx) => {
    await submitForReview(tx, versionId);
  });

  // 5. Attempting to publish without two distinct reviews must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await publishVersion(tx, versionId);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Publication needs two reviewers')
  );

  // Record review from Reviewer 1 (approve)
  await ownerTx(handle, async (tx) => {
    await recordContentReview(tx, {
      id: randomUUID(),
      versionId,
      reviewerId: rev1Id,
      revision: 1,
      decision: 'approve',
      testReportHash: 'd'.repeat(64),
      notes: { schema_version: 'content.review.v1', data: { summary: 'Approved by rev 1', checklist_passed: true } },
    });
  });

  // Still fails with only 1 reviewer
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await publishVersion(tx, versionId);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Publication needs two reviewers')
  );

  // Record review from Reviewer 2 (initially reject)
  await ownerTx(handle, async (tx) => {
    await recordContentReview(tx, {
      id: randomUUID(),
      versionId,
      reviewerId: rev2Id,
      revision: 1,
      decision: 'reject',
      testReportHash: 'e'.repeat(64),
      notes: { schema_version: 'content.review.v1', data: { summary: 'Fix prompt typo', checklist_passed: false } },
    });
  });

  // Still fails because Reviewer 2 rejected
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await publishVersion(tx, versionId);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Publication needs two reviewers')
  );

  // Reviewer 2 updates to approved on revision 2
  await ownerTx(handle, async (tx) => {
    await recordContentReview(tx, {
      id: randomUUID(),
      versionId,
      reviewerId: rev2Id,
      revision: 2,
      decision: 'approve',
      testReportHash: 'f'.repeat(64),
      notes: { schema_version: 'content.review.v1', data: { summary: 'Typo fixed, approved', checklist_passed: true } },
    });
  });

  // Now publication succeeds!
  await ownerTx(handle, async (tx) => {
    await publishVersion(tx, versionId);
  });

  // Verify version is published with published_at timestamp
  await ownerTx(handle, async (tx) => {
    const vRow = (await sql`SELECT status, published_at FROM app.problem_versions WHERE id = ${versionId}`.execute(tx)).rows[0];
    assert.equal(vRow.status, 'published');
    assert.ok(vRow.published_at instanceof Date);
  });

  // 6. Immutability: Attempting to UPDATE or DELETE published version must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE app.problem_versions SET language = 'python' WHERE id = ${versionId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Published version is immutable')
  );
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`DELETE FROM app.problem_versions WHERE id = ${versionId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Published version is immutable')
  );

  // Immutability of problem identity: Attempting to UPDATE problem slug after publication must fail
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE app.problems SET slug = 'tampered-slug' WHERE id = ${problemId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Published problem identity is immutable')
  );

  // 7. Retiring version requires separate record in app.problem_retirements
  await assert.rejects(
    ownerTx(handle, async (tx) => {
      await sql`UPDATE app.problem_versions SET status = 'retired' WHERE id = ${versionId}`.execute(tx);
    }),
    (err: any) => err.code === '23514' && err.message.includes('Published version is immutable')
  );

  // Retirement with valid reason code succeeds
  await ownerTx(handle, async (tx) => {
    await retireVersion(tx, versionId, 'CURRICULUM_SUPERSEDED_BY_NEXT_REVISION');
    const retRow = (await sql`SELECT version_id, reason_code FROM app.problem_retirements WHERE version_id = ${versionId}`.execute(tx)).rows[0];
    assert.equal(retRow.version_id, versionId);
    assert.equal(retRow.reason_code, 'CURRICULUM_SUPERSEDED_BY_NEXT_REVISION');
  });
});
