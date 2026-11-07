import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, cp, stat } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabase, migrateCore, sql } from '../../packages/db/dist/index.js';

const host = process.env.TRACEMIGO_TEST_PG_SOCKET;
if (!host || !host.startsWith('/tmp/tracemigo-pg17-')) throw new Error('Use an explicitly configured disposable /tmp PostgreSQL Unix socket; no integration mock is provided.');
const permissions = await stat(host);
if (!permissions.isDirectory() || (permissions.mode & 0o077) !== 0 || permissions.uid !== process.getuid()) throw new Error('Test socket directory must be private and owned by this user.');
const port = Number(process.env.TRACEMIGO_TEST_PG_PORT ?? '55432');
const admin = process.env.TRACEMIGO_TEST_PG_ADMIN ?? 'tracemigo_bootstrap';
const root = fileURLToPath(new URL('../../', import.meta.url));
const core = new URL('../../packages/db/migrations/core/', import.meta.url);
const bootstrap = await readFile(new URL('../../packages/db/bootstrap/roles.sql', import.meta.url), 'utf8');
const handles = [];
function connect(database, user = admin, max = 3) {
  const handle = createDatabase({ host, port, user, database, max }); handles.push(handle); return handle;
}
const maintenance = connect('postgres');
const databases = [];
async function fresh() {
  const name = 'tracemigo_test_' + randomUUID().replaceAll('-', '');
  await sql.raw(`CREATE DATABASE "${name}"`).execute(maintenance.db); databases.push(name);
  const handle = connect(name);
  await sql.raw(bootstrap).execute(handle.db);
  return handle;
}
async function owner(handle, fn) {
  return handle.db.transaction().execute(async tx => { await sql`SET LOCAL ROLE tracemigo_owner`.execute(tx); return fn(tx); });
}
async function execute(handle, text, values = []) {
  // Literal fixtures are trusted. Values use pg/Kysely parameters, not text interpolation.
  const query = sql.raw(text);
  if (values.length) throw new Error('Use sql templates for parameterized fixtures.');
  return owner(handle, tx => query.execute(tx));
}
async function rejectCode(promise, code) { await assert.rejects(promise, error => error.code === code); }
const hash = 'a'.repeat(64), image = 'sha256:' + hash;
const envelope = (version, data = {}) => ({ schema_version: version, data });
const json = value => JSON.stringify(value);
const scores = () => envelope('assessment.scores.v1', { functional_model: 3, trace: 3, bug_reasoning: 3, complexity: 3, refactoring: 3, communication: 3 });
const db = await fresh();

async function seed(handle = db) {
  const x = Object.fromEntries(['t1','t2','u1','u2','u3','p','v','a1','a2','a3','s1','s2','j1','j2'].map(key => [key, randomUUID()]));
  await owner(handle, async tx => {
    for (const id of [x.t1,x.t2]) await sql`INSERT INTO app.tenants(id,name) VALUES(${id},'Synthetic tenant')`.execute(tx);
    for (const id of [x.u1,x.u2,x.u3]) await sql`INSERT INTO app.users(id,oidc_issuer,oidc_subject) VALUES(${id},'https://identity.example.invalid',${id})`.execute(tx);
    for (const [tenant,user] of [[x.t1,x.u1],[x.t1,x.u2],[x.t2,x.u3]]) await sql`INSERT INTO app.memberships(tenant_id,user_id,role) VALUES(${tenant},${user},'learner')`.execute(tx);
    await sql`INSERT INTO app.problems(id,slug,family_id,difficulty) VALUES(${x.p},${'synthetic-'+x.p},'synthetic','foundation')`.execute(tx);
    await sql`INSERT INTO app.problem_versions(id,problem_id,version_number,language,content_hash,public_manifest_key,public_manifest,runtime_digest) VALUES(${x.v},${x.p},1,'python',${hash},'synthetic/public',${json(envelope('case.public.v1'))}::jsonb,${image})`.execute(tx);
    await sql`INSERT INTO private.problem_authorities(version_id,private_bundle_key,oracle_hash,witness_hash) VALUES(${x.v},'synthetic/private',${hash},${hash})`.execute(tx);
    for (const [id,tenant,user] of [[x.a1,x.t1,x.u1],[x.a2,x.t1,x.u2],[x.a3,x.t2,x.u3]]) await sql`INSERT INTO app.attempts(id,tenant_id,user_id,problem_version_id,mode) VALUES(${id},${tenant},${user},${x.v},'practice')`.execute(tx);
    for (const [id,user,attempt] of [[x.s1,x.u1,x.a1],[x.s2,x.u2,x.a2]]) await sql`INSERT INTO app.submissions(id,tenant_id,user_id,attempt_id,source_sha256,object_key) VALUES(${id},${x.t1},${user},${attempt},${hash},'synthetic/source')`.execute(tx);
    for (const [id,user,attempt,submission] of [[x.j1,x.u1,x.a1,x.s1],[x.j2,x.u2,x.a2,x.s2]]) await sql`INSERT INTO app.execution_jobs(id,tenant_id,user_id,attempt_id,submission_id,idempotency_key,request_sha256,runtime_digest) VALUES(${id},${x.t1},${user},${attempt},${submission},${id},${hash},${image})`.execute(tx);
  }); return x;
}
async function review(tx,x,user,revision=1,decision='approve') {
  await sql`INSERT INTO private.content_reviews(id,version_id,reviewer_id,revision,decision,test_report_hash,notes) VALUES(${randomUUID()},${x.v},${user},${revision},${decision},${hash},${json(envelope('content.review.v1'))}::jsonb)`.execute(tx);
}
async function publish(x) {
  await owner(db, async tx => {
    await review(tx,x,x.u1); await review(tx,x,x.u2);
    await sql`UPDATE app.problem_versions SET status='review' WHERE id=${x.v}`.execute(tx);
    await sql`UPDATE app.problem_versions SET status='published',published_at=now() WHERE id=${x.v}`.execute(tx);
  });
}
async function assessment(x, revision=1, score=scores(), source='deterministic') {
  return owner(db, tx => sql`INSERT INTO app.assessment_results(id,tenant_id,user_id,attempt_id,revision,rubric_version,dimension_scores,evidence_ids,confidence,decision_source) VALUES(${randomUUID()},${x.t1},${x.u1},${x.a1},${revision},'rubric.v1',${json(score)}::jsonb,${json(envelope('assessment.evidence.v1'))}::jsonb,0.9,${source}) RETURNING id`.execute(tx));
}

test('fresh migration is atomic, replay is idempotent, and core needs no vector extension', async () => {
  assert.deepEqual(await migrateCore(db.db), ['0001_core.sql','0002_support_and_integrity.sql']);
  assert.deepEqual(await migrateCore(db.db), []);
  const result = await sql`SELECT version(),current_setting('server_version_num') AS number`.execute(db.db);
  assert.ok(Number(result.rows[0].number)>=170000); console.log('Database:',result.rows[0].version.split(',')[0]);
  assert.equal((await sql`SELECT count(*)::int AS n FROM pg_extension WHERE extname='vector'`.execute(db.db)).rows[0].n,0);
});

test('all required tables, ownership and forced row security exist; schemas validate payload versions', async () => {
  const rows=(await sql`SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('app','private','ops')`.execute(db.db)).rows;
  for (const name of ['content_reviews','source_provenance','assessment_results','appeals','user_preferences','consents','billing_events','entitlements','quota_reservations','idempotency_records','audit_events','deletion_requests','outbox']) assert.ok(rows.some(row=>row.tablename===name));
  const bad=(await sql`SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('app','ops') AND c.relkind='r' AND c.relname<>'schema_migrations' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR pg_get_userbyid(c.relowner)<>'tracemigo_owner')`.execute(db.db)).rows;
  assert.deepEqual(bad,[]);
  const x=await seed();
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.attempt_events(tenant_id,user_id,attempt_id,seq,event_id,event_type,payload) VALUES(${x.t1},${x.u1},${x.a1},1,${randomUUID()},'synthetic',${json({schema_version:'wrong',data:{}})}::jsonb)`.execute(tx)),'23514');
  assert.equal((await sql`SELECT app.valid_envelope('null'::jsonb,'x') AS valid`.execute(db.db)).rows[0].valid,false);
});

test('additive upgrade preserves old explicit-column writes and rows', async () => {
  const upgraded=await fresh();
  await migrateCore(upgraded.db,{through:'0001_core.sql'});
  const x=await seed(upgraded);
  const query=()=>owner(upgraded,tx=>sql`SELECT id,tenant_id,user_id,stage,revision FROM app.attempts WHERE id=${x.a1}`.execute(tx));
  const before=(await query()).rows[0];
  await migrateCore(upgraded.db);
  assert.deepEqual((await query()).rows[0],before);
  await owner(upgraded,tx=>sql`UPDATE app.attempts SET stage='predict',revision=revision+1 WHERE id=${x.a1}`.execute(tx));
  assert.equal((await query()).rows[0].stage,'predict');
  await seed(upgraded); // old INSERT omits the new defaulted column.
});

test('checksum edits, inserted historical migrations and downward targets fail closed', async () => {
  for (const kind of ['checksum','order']) {
    const dir=await mkdtemp('/tmp/tracemigo-migrations-');await cp(fileURLToPath(core),dir,{recursive:true});
    if(kind==='checksum') await writeFile(path.join(dir,'0001_core.sql'),(await readFile(new URL('0001_core.sql',core),'utf8'))+'\n-- changed\n');
    else await writeFile(path.join(dir,'0000_inserted.sql'),'SELECT 1;');
    await assert.rejects(migrateCore(db.db,{directory:pathToFileURL(dir+'/')}),/history or checksum/);
  }
  await assert.rejects(migrateCore(db.db,{through:'0001_core.sql'}),/Down migrations/);
});

test('failed migration rolls back DDL and history; concurrent migration callers serialize', async () => {
  const dir=await mkdtemp('/tmp/tracemigo-migration-failure-');await cp(fileURLToPath(core),dir,{recursive:true});
  await writeFile(path.join(dir,'0003_failed.sql'),'CREATE TABLE app.must_rollback(id integer); SELECT missing_column;');
  await assert.rejects(migrateCore(db.db,{directory:pathToFileURL(dir+'/')}));
  assert.equal((await sql`SELECT to_regclass('app.must_rollback') AS name`.execute(db.db)).rows[0].name,null);
  assert.equal((await sql`SELECT count(*)::int AS n FROM ops.schema_migrations`.execute(db.db)).rows[0].n,2);
  const parallel=await fresh(); const second=connect(databases.at(-1));
  const result=await Promise.all([migrateCore(parallel.db),migrateCore(second.db)]);
  assert.deepEqual(result.map(row=>row.length).sort(),[0,2]);
});

test('composite foreign keys prevent cross-owner, cross-tenant and wrong-attempt job evidence', async () => {
  const x=await seed();
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.submissions(id,tenant_id,user_id,attempt_id,source_sha256,object_key) VALUES(${randomUUID()},${x.t1},${x.u2},${x.a1},${hash},'synthetic')`.execute(tx)),'23503');
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.execution_jobs(id,tenant_id,user_id,attempt_id,submission_id,idempotency_key,request_sha256,runtime_digest) VALUES(${randomUUID()},${x.t2},${x.u3},${x.a3},${x.s1},${randomUUID()},${hash},${image})`.execute(tx)),'23503');
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.observations(id,tenant_id,user_id,attempt_id,execution_job_id,kind,evidence,verification_status,verifier_version) VALUES(${randomUUID()},${x.t1},${x.u1},${x.a1},${x.j2},'synthetic',${json(envelope('observation.v1'))}::jsonb,'verified','v1')`.execute(tx)),'23503');
  await owner(db,tx=>sql`INSERT INTO app.observations(id,tenant_id,user_id,attempt_id,execution_job_id,kind,evidence,verification_status,verifier_version) VALUES(${randomUUID()},${x.t1},${x.u1},${x.a1},${x.j1},'synthetic',${json(envelope('observation.v1'))}::jsonb,'verified','v1')`.execute(tx));
});

test('attempt revision increments exactly once and attempt identity cannot be reassigned', async () => {
  const x=await seed();
  await rejectCode(owner(db,tx=>sql`UPDATE app.attempts SET stage='predict' WHERE id=${x.a1}`.execute(tx)),'23514');
  await rejectCode(owner(db,tx=>sql`UPDATE app.attempts SET revision=revision+2 WHERE id=${x.a1}`.execute(tx)),'23514');
  await rejectCode(owner(db,tx=>sql`UPDATE app.attempts SET user_id=${x.u2},revision=revision+1 WHERE id=${x.a1}`.execute(tx)),'23514');
  await owner(db,tx=>sql`UPDATE app.attempts SET stage='predict',revision=revision+1 WHERE id=${x.a1}`.execute(tx));
});

test('published versions and children are frozen; retirement is an additive record', async () => {
  const x=await seed(); await publish(x);
  for (const statement of [sql`UPDATE app.problem_versions SET content_hash=${'b'.repeat(64)} WHERE id=${x.v}`,sql`DELETE FROM app.problem_versions WHERE id=${x.v}`,sql`UPDATE private.problem_authorities SET private_bundle_key='changed' WHERE version_id=${x.v}`,sql`UPDATE app.problems SET sealed=true WHERE id=${x.p}`,sql`DELETE FROM private.content_reviews WHERE version_id=${x.v}`]) await rejectCode(owner(db,tx=>statement.execute(tx)),'23514');
  await owner(db,tx=>sql`INSERT INTO app.problem_retirements(version_id,reason_code) VALUES(${x.v},'CORRECTION')`.execute(tx));
  assert.equal((await owner(db,tx=>sql`SELECT status FROM app.problem_versions WHERE id=${x.v}`.execute(tx))).rows[0].status,'published');
});

test('publication needs distinct latest approved reviewers; inserting published content bypass is denied', async () => {
  const x=await seed();
  await owner(db,async tx=>{await review(tx,x,x.u1);await review(tx,x,x.u1,2);await sql`UPDATE app.problem_versions SET status='review' WHERE id=${x.v}`.execute(tx);});
  await rejectCode(owner(db,tx=>sql`UPDATE app.problem_versions SET status='published',published_at=now() WHERE id=${x.v}`.execute(tx)),'23514');
  await owner(db,async tx=>{await review(tx,x,x.u2);await review(tx,x,x.u2,2,'reject');});
  await rejectCode(owner(db,tx=>sql`UPDATE app.problem_versions SET status='published',published_at=now() WHERE id=${x.v}`.execute(tx)),'23514');
  await owner(db,tx=>review(tx,x,x.u2,3));
  await owner(db,tx=>sql`UPDATE app.problem_versions SET status='published',published_at=now() WHERE id=${x.v}`.execute(tx));
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.problem_versions(id,problem_id,version_number,status,language,content_hash,public_manifest_key,public_manifest,runtime_digest,published_at) VALUES(${randomUUID()},${x.p},2,'published','python',${hash},'synthetic',${json(envelope('case.public.v1'))}::jsonb,${image},now())`.execute(tx)),'23514');
});

test('prerequisite DAG rejects long cycles and self edges; related cycles remain valid', async () => {
  const names=[0,1,2].map(()=>randomUUID());
  await owner(db,async tx=>{for(const name of names)await sql`INSERT INTO app.concepts(id,title) VALUES(${name},'Synthetic')`.execute(tx);});
  const edge=(from,to,relation='prerequisite')=>owner(db,tx=>sql`INSERT INTO app.concept_edges(id,from_id,to_id,relation) VALUES(${randomUUID()},${from},${to},${relation})`.execute(tx));
  await edge(names[0],names[1]);await edge(names[1],names[2]);
  await rejectCode(edge(names[2],names[0]),'23514');await rejectCode(edge(names[0],names[0]),'23514');
  await edge(names[2],names[0],'related');
});

test('concurrent opposite prerequisites cannot both commit', async () => {
  const a=randomUUID(),b=randomUUID();await owner(db,async tx=>{for(const id of[a,b])await sql`INSERT INTO app.concepts(id,title) VALUES(${id},'Synthetic')`.execute(tx);});
  let release,entered;const hold=new Promise(r=>{release=r;});const ready=new Promise(r=>{entered=r;});
  const first=owner(db,async tx=>{await sql`INSERT INTO app.concept_edges(id,from_id,to_id,relation) VALUES(${randomUUID()},${a},${b},'prerequisite')`.execute(tx);entered();await hold;});
  await ready;
  const second=owner(db,tx=>sql`INSERT INTO app.concept_edges(id,from_id,to_id,relation) VALUES(${randomUUID()},${b},${a},'prerequisite')`.execute(tx));
  const rejected=rejectCode(second,'23514');release();await first;await rejected;
});

test('assessment anchors, revisions and decision authority are constrained and append-only', async () => {
  const x=await seed();const inserted=await assessment(x);
  await rejectCode(assessment(x,3),'23514');
  const bad=scores();bad.data.trace=5;await rejectCode(assessment(x,2,bad),'23514');
  await rejectCode(assessment(x,2,scores(),'peer'),'23514');
  await rejectCode(owner(db,tx=>sql`DELETE FROM app.assessment_results WHERE id=${inserted.rows[0].id}`.execute(tx)),'23514');
  await assessment(x,2,scores(),'human_review');
});

test('outbox and business write commit/rollback together; operation keys and request records are unique', async () => {
  const x=await seed(),operation=randomUUID();
  const insert=(tx)=>sql`INSERT INTO ops.outbox(id,tenant_id,user_id,attempt_id,aggregate_id,topic,operation_id,payload) VALUES(${randomUUID()},${x.t1},${x.u1},${x.a1},${x.a1},'synthetic',${operation},${json(envelope('outbox.v1'))}::jsonb)`.execute(tx);
  await assert.rejects(owner(db,async tx=>{await sql`UPDATE app.attempts SET revision=revision+1 WHERE id=${x.a1}`.execute(tx);await insert(tx);throw new Error('Synthetic rollback');}));
  assert.equal((await owner(db,tx=>sql`SELECT revision FROM app.attempts WHERE id=${x.a1}`.execute(tx))).rows[0].revision,'0');
  assert.equal((await sql`SELECT count(*)::int AS n FROM ops.outbox WHERE operation_id=${operation}`.execute(db.db)).rows[0].n,0);
  await owner(db,insert);await rejectCode(owner(db,insert),'23505');
  const record=()=>owner(db,tx=>sql`INSERT INTO ops.idempotency_records(id,tenant_id,user_id,route,key,request_hash,expires_at) VALUES(${randomUUID()},${x.t1},${x.u1},'/v1/attempts','synthetic',${hash},now()+interval '1 day')`.execute(tx));
  await record();await rejectCode(record(),'23505');
  await rejectCode(owner(db,tx=>sql`UPDATE ops.outbox SET payload=${json(envelope('outbox.v1',{tampered:true}))}::jsonb WHERE operation_id=${operation}`.execute(tx)),'23514');
  await rejectCode(owner(db,tx=>sql`UPDATE ops.idempotency_records SET request_hash=${'b'.repeat(64)} WHERE tenant_id=${x.t1} AND user_id=${x.u1}`.execute(tx)),'23514');
});

test('real nonowner service identities deny private reads, table ownership and privilege escalation', async () => {
  for(const group of ['tracemigo_app_role','tracemigo_peer_role']) {
    const user='tracemigo_test_'+randomUUID().replaceAll('-','');
    await sql.raw(`CREATE ROLE "${user}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; GRANT ${group} TO "${user}";`).execute(db.db);
    const handle=connect(databases[0],user,1);await handle.verifyRole(group);
    await rejectCode(sql`SELECT private_bundle_key FROM private.problem_authorities`.execute(handle.db),'42501');
    await rejectCode(sql`SET ROLE tracemigo_owner`.execute(handle.db),'42501');
    assert.equal((await handle.db.selectFrom('problem_versions').selectAll().execute()).length,0);
    await assert.rejects(migrateCore(handle.db));
  }
  await assert.rejects(db.verifyRole('tracemigo_app_role'),/Unsafe/);
  const combined='tracemigo_test_'+randomUUID().replaceAll('-','');
  await sql.raw(`CREATE ROLE "${combined}" LOGIN NOSUPERUSER NOBYPASSRLS; GRANT tracemigo_app_role,tracemigo_judge_role TO "${combined}";`).execute(db.db);
  await assert.rejects(connect(databases[0],combined).verifyRole('tracemigo_app_role'),/Unsafe/);
  const replicator='tracemigo_test_'+randomUUID().replaceAll('-','');
  await sql.raw(`CREATE ROLE "${replicator}" LOGIN NOSUPERUSER NOBYPASSRLS REPLICATION; GRANT tracemigo_app_role TO "${replicator}";`).execute(db.db);
  await assert.rejects(connect(databases[0],replicator).verifyRole('tracemigo_app_role'),/Unsafe/);
});

test('closed RLS blocks ordinary inserts even with table grants and tenant settings', async () => {
  const x=await seed();const user='tracemigo_test_'+randomUUID().replaceAll('-','');
  await sql.raw(`CREATE ROLE "${user}" LOGIN NOSUPERUSER NOBYPASSRLS; GRANT tracemigo_app_role TO "${user}";`).execute(db.db);
  const handle=connect(databases[0],user,1);
  await rejectCode(handle.db.transaction().execute(async tx=>{
    await sql`SELECT set_config('app.tenant_id',${x.t1},true),set_config('app.user_id',${x.u1},true)`.execute(tx);
    await sql`INSERT INTO app.attempts(id,tenant_id,user_id,problem_version_id,mode) VALUES(${randomUUID()},${x.t1},${x.u1},${x.v},'practice')`.execute(tx);
  }),'42501');
});

test('supporting quota, consent and tombstone checks reject impossible states', async () => {
  const x=await seed();
  await rejectCode(owner(db,tx=>sql`INSERT INTO ops.quota_reservations(id,tenant_id,user_id,operation_id,estimated_units,estimated_usd_micros,expires_at,state) VALUES(${randomUUID()},${x.t1},${x.u1},${randomUUID()},1,1,now()+interval '1 day','settled')`.execute(tx)),'23514');
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.consents(id,user_id,purpose,consent_version,granted_at,revoked_at) VALUES(${randomUUID()},${x.u1},'voice','v1',now(),now()-interval '1 day')`.execute(tx)),'23514');
  await rejectCode(owner(db,tx=>sql`INSERT INTO ops.deletion_requests(id,user_id,generation,scope,checkpoints,state) VALUES(${randomUUID()},${x.u1},1,${json(envelope('deletion.scope.v1'))}::jsonb,${json(envelope('deletion.checkpoints.v1'))}::jsonb,'completed')`.execute(tx)),'23514');
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.skill_evidence(id,tenant_id,user_id,attempt_id,concept_id,independent,outcome,assistance_level,evidence_version) VALUES(${randomUUID()},${x.t1},${x.u2},${x.a1},'missing',true,'correct',1,'v1')`.execute(tx)),'23514');
});

test('valid supporting records insert, ledger stays append-only and appeal parents are enforced', async () => {
  const x=await seed();const result=(await assessment(x)).rows[0].id;const ledger=randomUUID();const concept=randomUUID();
  await owner(db,async tx=>{
    await sql`INSERT INTO app.concepts(id,title) VALUES(${concept},'Synthetic')`.execute(tx);
    await sql`INSERT INTO app.user_preferences(id,user_id,assistance_settings) VALUES(${randomUUID()},${x.u1},${json(envelope('preferences.assistance.v1'))}::jsonb)`.execute(tx);
    await sql`INSERT INTO app.consents(id,user_id,purpose,consent_version,granted_at) VALUES(${randomUUID()},${x.u1},'voice','v1',now())`.execute(tx);
    await sql`INSERT INTO app.entitlements(id,tenant_id,user_id,product,starts_at,ends_at,quota_policy,provider_purchase_id) VALUES(${randomUUID()},${x.t1},${x.u1},'synthetic',now(),now()+interval '1 day',${json(envelope('entitlement.quota.v1'))}::jsonb,${randomUUID()})`.execute(tx);
    await sql`INSERT INTO ops.quota_reservations(id,tenant_id,user_id,operation_id,estimated_units,estimated_usd_micros,expires_at) VALUES(${randomUUID()},${x.t1},${x.u1},${randomUUID()},1,1,now()+interval '1 day')`.execute(tx);
    await sql`INSERT INTO ops.billing_events(id,provider,external_event_id,payload_hash,processing_state,verified_at) VALUES(${randomUUID()},'razorpay',${randomUUID()},${hash},'processed',now())`.execute(tx);
    await sql`INSERT INTO ops.deletion_requests(id,user_id,generation,scope,checkpoints) VALUES(${randomUUID()},${x.u1},1,${json(envelope('deletion.scope.v1'))}::jsonb,${json(envelope('deletion.checkpoints.v1'))}::jsonb)`.execute(tx);
    await sql`INSERT INTO ops.usage_ledger(id,tenant_id,user_id,operation_id,entry_type,usd_micros,units) VALUES(${ledger},${x.t1},${x.u1},${randomUUID()},'reserve',1,1)`.execute(tx);
    await sql`INSERT INTO private.source_provenance(id,version_id,repo_url,commit_sha,path,original_span,file_hash,license_expression,notice_key,transformation_log,approval_state) VALUES(${randomUUID()},${x.v},'https://example.invalid/synthetic',${'a'.repeat(40)},'synthetic.py',${json(envelope('source.span.v1'))}::jsonb,${hash},'MIT','synthetic',${json(envelope('source.transform.v1'))}::jsonb,'quarantine')`.execute(tx);
    await sql`INSERT INTO private.rubric_nodes(problem_version_id,id,concept_id,kind,anchors,source_spans,oracle_refs) VALUES(${x.v},'synthetic',${concept},'synthetic',${json(envelope('rubric.anchors.v1'))}::jsonb,${json(envelope('source.spans.v1'))}::jsonb,${json(envelope('oracle.refs.v1'))}::jsonb)`.execute(tx);
    await sql`INSERT INTO app.appeals(id,tenant_id,user_id,attempt_id,result_id,explanation) VALUES(${randomUUID()},${x.t1},${x.u1},${x.a1},${result},'Synthetic explanation')`.execute(tx);
  });
  await rejectCode(owner(db,tx=>sql`UPDATE ops.usage_ledger SET units=2 WHERE id=${ledger}`.execute(tx)),'23514');
  await rejectCode(owner(db,tx=>sql`INSERT INTO app.appeals(id,tenant_id,user_id,attempt_id,result_id,explanation) VALUES(${randomUUID()},${x.t1},${x.u2},${x.a2},${result},'Synthetic')`.execute(tx)),'23503');
});

test('graph writes reject isolation levels that could reuse a stale cycle snapshot', async()=>{
  await assert.rejects(db.db.transaction().setIsolationLevel('repeatable read').execute(async tx=>{
    await sql`SET LOCAL ROLE tracemigo_owner`.execute(tx);
    const a=randomUUID(),b=randomUUID();
    await sql`INSERT INTO app.concepts(id,title) VALUES(${a},'Synthetic'),(${b},'Synthetic')`.execute(tx);
    await sql`INSERT INTO app.concept_edges(id,from_id,to_id,relation) VALUES(${randomUUID()},${a},${b},'prerequisite')`.execute(tx);
  }),error=>error.code==='25001');
});

test('typed Kysely queries, connection health and validation work with real PostgreSQL', async () => {
  const x=await seed();
  const row=await owner(db,tx=>tx.selectFrom('tenants').select(['id','name']).where('id','=',x.t1).executeTakeFirstOrThrow());
  assert.equal(row.name,'Synthetic tenant');assert.equal(await db.health(),true);
  assert.throws(()=>createDatabase({host:'remote.example.invalid',user:'x',database:'x'}),/TLS/);
});

test.after(async()=>{
  for(const handle of handles.reverse()) await handle.destroy();
  console.log(`Disposed connections for ${databases.length} synthetic databases; no existing database was modified.`);
});
