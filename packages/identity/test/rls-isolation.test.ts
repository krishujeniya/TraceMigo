import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { stat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabase, migrateCore, sql } from '../../../packages/db/dist/index.js';
import {
  withTenantContext,
  applyIdentityRlsPolicies,
  verifyOidcToken,
  OidcVerificationError,
  generateSessionToken,
  createSessionCookie,
  serializeCookieHeader,
  createLogoutCookie,
  rotateSession,
  createSessionRecord,
  SESSION_COOKIE_NAME,
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

const handles: Array<{ close: () => Promise<void> }> = [];

function connect(database: string, user = admin, max = 3) {
  const handle = createDatabase({ host, port, user, database, max });
  handles.push(handle);
  return handle;
}

const maintenance = connect('postgres');
const databases: string[] = [];

async function createFreshDatabase() {
  const name = 'tracemigo_id_test_' + randomUUID().replaceAll('-', '');
  await sql.raw(`CREATE DATABASE "${name}"`).execute(maintenance.db);
  databases.push(name);
  const handle = connect(name);
  await sql.raw(bootstrapSql).execute(handle.db);
  await migrateCore(handle.db);
  // Apply identity RLS policies under tracemigo_owner
  await handle.db.transaction().execute(async (tx) => {
    await sql`SET LOCAL ROLE tracemigo_owner`.execute(tx);
    await applyIdentityRlsPolicies(tx as any);
  });
  return { name, handle };
}

async function ownerTx<T>(handle: ReturnType<typeof connect>, fn: (tx: any) => Promise<T>): Promise<T> {
  return handle.db.transaction().execute(async (tx) => {
    await sql`SET LOCAL ROLE tracemigo_owner`.execute(tx);
    return fn(tx);
  });
}

const hash = 'a'.repeat(64);
const image = 'sha256:' + hash;
const envelope = (version: string, data = {}) => ({ schema_version: version, data });
const json = (val: any) => JSON.stringify(val);

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
// Unit Tests: OIDC Token Validation & Secure Session Management
// ---------------------------------------------------------------------------

test('OIDC token verification validates signature, claims, expiration, and clock skew (ASVS v5.0.0-6.1.3)', () => {
  const secret = 'super-secret-key-32-bytes-long-for-test!';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);

  const makeToken = (payload: any) => {
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(`${header}.${p}`).digest('base64url');
    return `${header}.${p}.${sig}`;
  };

  const validPayload = {
    sub: 'google-user-12345',
    iss: 'https://accounts.google.com',
    aud: 'tracemigo-web-client',
    exp: now + 300,
    email: 'learner@example.com',
    email_verified: true,
  };

  // Valid token
  const validToken = makeToken(validPayload);
  const claims = verifyOidcToken(validToken, {
    expectedIssuer: 'https://accounts.google.com',
    expectedAudience: 'tracemigo-web-client',
    signingSecret: secret,
  });
  assert.equal(claims.sub, 'google-user-12345');
  assert.equal(claims.email, 'learner@example.com');
  assert.equal(claims.emailVerified, true);

  // Expired token beyond clock skew
  const expiredToken = makeToken({ ...validPayload, exp: now - 120 });
  assert.throws(
    () =>
      verifyOidcToken(expiredToken, {
        expectedIssuer: 'https://accounts.google.com',
        expectedAudience: 'tracemigo-web-client',
        signingSecret: secret,
        clockSkewSeconds: 60,
      }),
    OidcVerificationError
  );

  // Expired within 60s clock skew tolerance succeeds
  const skewToken = makeToken({ ...validPayload, exp: now - 30 });
  const skewClaims = verifyOidcToken(skewToken, {
    expectedIssuer: 'https://accounts.google.com',
    expectedAudience: 'tracemigo-web-client',
    signingSecret: secret,
    clockSkewSeconds: 60,
  });
  assert.equal(skewClaims.sub, 'google-user-12345');

  // Mismatched issuer
  assert.throws(
    () =>
      verifyOidcToken(validToken, {
        expectedIssuer: 'https://attacker.example.com',
        expectedAudience: 'tracemigo-web-client',
        signingSecret: secret,
      }),
    OidcVerificationError
  );

  // Mismatched audience
  assert.throws(
    () =>
      verifyOidcToken(validToken, {
        expectedIssuer: 'https://accounts.google.com',
        expectedAudience: 'different-client-id',
        signingSecret: secret,
      }),
    OidcVerificationError
  );

  // Tampered signature
  const tampered = validToken.slice(0, -4) + 'zzzz';
  assert.throws(
    () =>
      verifyOidcToken(tampered, {
        expectedIssuer: 'https://accounts.google.com',
        expectedAudience: 'tracemigo-web-client',
        signingSecret: secret,
      }),
    OidcVerificationError
  );
});

test('Session cookie generation enforces HttpOnly, SameSite=Strict, Secure, and rotation (ASVS v5.0.0-7.1.1)', () => {
  const token = generateSessionToken();
  assert.equal(token.length, 64); // 32 bytes hex encoded = 256 bits

  const cookie = createSessionCookie(token, { isProduction: true });
  assert.equal(cookie.name, SESSION_COOKIE_NAME);
  assert.equal(cookie.value, token);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, 'Strict');
  assert.equal(cookie.maxAge, 604800); // 7 days

  const header = serializeCookieHeader(cookie);
  assert.ok(header.includes('HttpOnly'));
  assert.ok(header.includes('Secure'));
  assert.ok(header.includes('SameSite=Strict'));
  assert.ok(header.includes('Max-Age=604800'));

  // Logout cookie immediately expires
  const logout = createLogoutCookie({ isProduction: true });
  assert.equal(logout.maxAge, 0);
  assert.equal(logout.value, '');
  assert.ok(serializeCookieHeader(logout).includes('Max-Age=0'));

  // Session rotation on privilege change
  const initialSession = createSessionRecord(token, 'user-1', 'tenant-1', 'learner');
  const rotated = rotateSession(initialSession, 'admin');
  assert.notEqual(rotated.oldSession.id, rotated.newSession.id);
  assert.ok(rotated.oldSession.revokedAt instanceof Date);
  assert.equal(rotated.newSession.role, 'admin');
  assert.equal(rotated.newSession.revokedAt, null);
});

// ---------------------------------------------------------------------------
// Integration Tests: RLS Relational Authority against PostgreSQL 17
// ---------------------------------------------------------------------------

test('RLS Scenario 1: Cross-Tenant Isolation strictly denies cross-tenant reads and mutations', async () => {
  const { name, handle } = await createFreshDatabase();

  // Create two separate tenants, two users, published problem, and attempts under owner
  const t1 = randomUUID();
  const t2 = randomUUID();
  const u1 = randomUUID();
  const u2 = randomUUID();
  const p = randomUUID();
  const v = randomUUID();
  const a1 = randomUUID();
  const a2 = randomUUID();

  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.tenants(id, name) VALUES (${t1}, 'Tenant One'), (${t2}, 'Tenant Two')`.execute(tx);
    await sql`INSERT INTO app.users(id, oidc_issuer, oidc_subject) VALUES (${u1}, 'https://auth.example.com', 'user-1'), (${u2}, 'https://auth.example.com', 'user-2')`.execute(tx);
    await sql`INSERT INTO app.memberships(tenant_id, user_id, role) VALUES (${t1}, ${u1}, 'learner'), (${t2}, ${u2}, 'learner')`.execute(tx);
    await sql`INSERT INTO app.problems(id, slug, family_id, difficulty) VALUES (${p}, 'p1', 'family-1', 'foundation')`.execute(tx);
    await sql`INSERT INTO app.problem_versions(id, problem_id, version_number, language, content_hash, public_manifest_key, public_manifest, runtime_digest)
              VALUES (${v}, ${p}, 1, 'python', ${hash}, 'manifest/1', ${json(envelope('case.public.v1'))}::jsonb, ${image})`.execute(tx);
    await sql`INSERT INTO private.problem_authorities(version_id, private_bundle_key, oracle_hash, witness_hash)
              VALUES (${v}, 'synthetic/private', ${hash}, ${hash})`.execute(tx);
    await sql`INSERT INTO app.attempts(id, tenant_id, user_id, problem_version_id, mode) VALUES (${a1}, ${t1}, ${u1}, ${v}, 'practice'), (${a2}, ${t2}, ${u2}, ${v}, 'practice')`.execute(tx);
  });

  // Create app service role user with tracemigo_app_role
  const appUser = 'app_user_' + randomUUID().replaceAll('-', '');
  await sql.raw(`CREATE ROLE "${appUser}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; GRANT tracemigo_app_role TO "${appUser}";`).execute(handle.db);
  const appConn = connect(name, appUser, 1);

  // 1. Tenant 1 user querying with Tenant 1 context sees ONLY Tenant 1 attempt
  const t1Attempts = await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
    const res = await sql`SELECT id, tenant_id FROM app.attempts`.execute(trx);
    return res.rows as any[];
  });
  assert.equal(t1Attempts.length, 1);
  assert.equal(t1Attempts[0].id, a1);
  assert.equal(t1Attempts[0].tenant_id, t1);

  // 2. Tenant 1 user cannot SELECT Tenant 2 attempt
  const t2AttemptDirect = await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
    const res = await sql`SELECT id FROM app.attempts WHERE id = ${a2}`.execute(trx);
    return res.rows;
  });
  assert.equal(t2AttemptDirect.length, 0);

  // 3. Tenant 1 user cannot UPDATE Tenant 2 attempt
  const updateRes = await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
    return await sql`UPDATE app.attempts SET status = 'submitted' WHERE id = ${a2} RETURNING id`.execute(trx);
  });
  assert.equal(updateRes.rows.length, 0);

  // 4. Tenant 1 user cannot DELETE Tenant 2 attempt
  const deleteRes = await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
    return await sql`DELETE FROM app.attempts WHERE id = ${a2} RETURNING id`.execute(trx);
  });
  assert.equal(deleteRes.rows.length, 0);

  // 5. Tenant 1 user cannot INSERT attempt spoofing Tenant 2
  await assert.rejects(
    withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
      await sql`INSERT INTO app.attempts(id, tenant_id, user_id, problem_version_id, mode) VALUES (${randomUUID()}, ${t2}, ${u1}, ${v}, 'practice')`.execute(trx);
    }),
    (err: any) => err.code === '42501' // RLS check violation
  );
});

test('RLS Scenario 2: Cross-User Isolation within same tenant isolates learners and permits reviewers', async () => {
  const { name, handle } = await createFreshDatabase();

  const t1 = randomUUID();
  const u1 = randomUUID();
  const u2 = randomUUID();
  const p = randomUUID();
  const v = randomUUID();
  const a1 = randomUUID();
  const a2 = randomUUID();

  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.tenants(id, name) VALUES (${t1}, 'Shared Tenant')`.execute(tx);
    await sql`INSERT INTO app.users(id, oidc_issuer, oidc_subject) VALUES (${u1}, 'https://auth.example.com', 'user-1'), (${u2}, 'https://auth.example.com', 'user-2')`.execute(tx);
    await sql`INSERT INTO app.memberships(tenant_id, user_id, role) VALUES (${t1}, ${u1}, 'learner'), (${t1}, ${u2}, 'learner')`.execute(tx);
    await sql`INSERT INTO app.problems(id, slug, family_id, difficulty) VALUES (${p}, 'p2', 'family-2', 'foundation')`.execute(tx);
    await sql`INSERT INTO app.problem_versions(id, problem_id, version_number, language, content_hash, public_manifest_key, public_manifest, runtime_digest)
              VALUES (${v}, ${p}, 1, 'python', ${hash}, 'manifest/2', ${json(envelope('case.public.v1'))}::jsonb, ${image})`.execute(tx);
    await sql`INSERT INTO private.problem_authorities(version_id, private_bundle_key, oracle_hash, witness_hash)
              VALUES (${v}, 'synthetic/private', ${hash}, ${hash})`.execute(tx);
    await sql`INSERT INTO app.attempts(id, tenant_id, user_id, problem_version_id, mode) VALUES (${a1}, ${t1}, ${u1}, ${v}, 'practice'), (${a2}, ${t1}, ${u2}, ${v}, 'practice')`.execute(tx);
  });

  const appUser = 'app_user_' + randomUUID().replaceAll('-', '');
  await sql.raw(`CREATE ROLE "${appUser}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; GRANT tracemigo_app_role TO "${appUser}";`).execute(handle.db);
  const appConn = connect(name, appUser, 1);

  // 1. Learner U1 queries attempts: only sees own attempt a1 (0 rows of U2)
  const u1Attempts = await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
    const res = await sql`SELECT id, user_id FROM app.attempts`.execute(trx);
    return res.rows as any[];
  });
  assert.equal(u1Attempts.length, 1);
  assert.equal(u1Attempts[0].id, a1);
  assert.equal(u1Attempts[0].user_id, u1);

  // 2. Learner U1 querying specifically for a2 gets 0 rows
  const u2AttemptFromU1 = await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
    const res = await sql`SELECT id FROM app.attempts WHERE id = ${a2}`.execute(trx);
    return res.rows;
  });
  assert.equal(u2AttemptFromU1.length, 0);

  // 3. Reviewer role in T1 can view both U1 and U2's attempts within T1
  const reviewerAttempts = await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'reviewer' }, async (trx) => {
    const res = await sql`SELECT id FROM app.attempts`.execute(trx);
    return res.rows as any[];
  });
  assert.equal(reviewerAttempts.length, 2);
  const ids = reviewerAttempts.map((r) => r.id);
  assert.ok(ids.includes(a1));
  assert.ok(ids.includes(a2));
});

test('RLS Scenario 3: Connection Pool Leakage Defense defaults to zero rows when context is omitted', async () => {
  const { name, handle } = await createFreshDatabase();

  const t1 = randomUUID();
  const u1 = randomUUID();
  const p = randomUUID();
  const v = randomUUID();
  const a1 = randomUUID();

  await ownerTx(handle, async (tx) => {
    await sql`INSERT INTO app.tenants(id, name) VALUES (${t1}, 'Pool Tenant')`.execute(tx);
    await sql`INSERT INTO app.users(id, oidc_issuer, oidc_subject) VALUES (${u1}, 'https://auth.example.com', 'pool-user')`.execute(tx);
    await sql`INSERT INTO app.memberships(tenant_id, user_id, role) VALUES (${t1}, ${u1}, 'learner')`.execute(tx);
    await sql`INSERT INTO app.problems(id, slug, family_id, difficulty) VALUES (${p}, 'p3', 'family-3', 'foundation')`.execute(tx);
    await sql`INSERT INTO app.problem_versions(id, problem_id, version_number, language, content_hash, public_manifest_key, public_manifest, runtime_digest)
              VALUES (${v}, ${p}, 1, 'python', ${hash}, 'manifest/3', ${json(envelope('case.public.v1'))}::jsonb, ${image})`.execute(tx);
    await sql`INSERT INTO private.problem_authorities(version_id, private_bundle_key, oracle_hash, witness_hash)
              VALUES (${v}, 'synthetic/private', ${hash}, ${hash})`.execute(tx);
    await sql`INSERT INTO app.attempts(id, tenant_id, user_id, problem_version_id, mode) VALUES (${a1}, ${t1}, ${u1}, ${v}, 'practice')`.execute(tx);
  });

  const appUser = 'app_user_' + randomUUID().replaceAll('-', '');
  await sql.raw(`CREATE ROLE "${appUser}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; GRANT tracemigo_app_role TO "${appUser}";`).execute(handle.db);
  // Connection with pool size 1 to force reusing the exact same connection
  const poolHandle = connect(name, appUser, 1);

  // Transaction 1: Execute with valid Tenant 1 context -> returns 1 row
  const tx1Result = await withTenantContext(poolHandle.db, { tenantId: t1, userId: u1, role: 'learner' }, async (trx) => {
    const res = await sql`SELECT id FROM app.attempts`.execute(trx);
    return res.rows;
  });
  assert.equal(tx1Result.length, 1);

  // Transaction 2: Execute on same pooled connection WITHOUT setting context -> MUST return 0 rows (default-deny)
  const tx2Result = await poolHandle.db.transaction().execute(async (trx) => {
    const res = await sql`SELECT id FROM app.attempts`.execute(trx);
    return res.rows;
  });
  assert.equal(tx2Result.length, 0);

  // Transaction 3: Direct non-transaction query without context also returns 0 rows
  const directResult = await sql`SELECT id FROM app.attempts`.execute(poolHandle.db);
  assert.equal(directResult.rows.length, 0);
});

test('RLS Scenario 4: Non-Owner Restricted Role Verification prevents privilege escalation and superuser bypass', async () => {
  const { name, handle } = await createFreshDatabase();

  const appUser = 'app_user_' + randomUUID().replaceAll('-', '');
  await sql.raw(`CREATE ROLE "${appUser}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; GRANT tracemigo_app_role TO "${appUser}";`).execute(handle.db);
  const appConn = connect(name, appUser, 1);

  // 1. Verify appUser role attributes in pg_roles: NOSUPERUSER, NOBYPASSRLS
  const roleCheck = await sql`SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = ${appUser}`.execute(handle.db);
  assert.equal(roleCheck.rows[0].rolsuper, false);
  assert.equal(roleCheck.rows[0].rolbypassrls, false);
  assert.equal(roleCheck.rows[0].rolcanlogin, true);

  // 2. Real escalation to tracemigo_owner must fail with 42501
  await assert.rejects(
    sql`SET ROLE tracemigo_owner`.execute(appConn.db),
    (err: any) => err.code === '42501'
  );

  // 3. Faking superuser via session variable does NOT bypass RLS or grant superuser
  const t1 = randomUUID();
  const u1 = randomUUID();
  await withTenantContext(appConn.db, { tenantId: t1, userId: u1, role: 'admin' }, async (trx) => {
    // Attempting to read private authorities table still throws 42501
    await assert.rejects(
      sql`SELECT private_bundle_key FROM private.problem_authorities`.execute(trx),
      (err: any) => err.code === '42501'
    );
  });
});
