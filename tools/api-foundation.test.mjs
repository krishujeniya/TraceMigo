import test from 'node:test';
import assert from 'node:assert/strict';
import { createService, parseConfiguration, ConfigurationError, CapabilityUnavailable } from '../apps/api/dist/index.js';
import { createTestAdapters } from '../apps/api/dist/testing.js';
import { createAuditLogger } from '../apps/api/dist/observability.js';
import { peerTurnInputSchema, problemDetailsSchema, runtimeConfigSchema, requestIdPattern } from '../packages/contracts/dist/index.js';

const base = { NODE_ENV: 'test', TRACEMIGO_LOG_LEVEL: 'silent' };
const uuid = new RegExp(requestIdPattern);
const service = (options = {}) => createService({ environment: base, ...options });
function checkProblem(response, status, code) {
  assert.equal(response.statusCode, status);
  assert.match(response.headers['content-type'], /^application\/problem\+json/);
  assert.equal(response.headers['cache-control'], 'no-store');
  const body = response.json();
  assert.equal(body.status, status); assert.equal(body.code, code);
  assert.ok(uuid.test(body.request_id)); assert.equal(body.request_id, response.headers['x-request-id']);
  return body;
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('config defaults, exact numeric parsing and fail-closed feature flags', () => {
  const config = parseConfiguration({});
  assert.equal(config.port, 3001); assert.equal(config.modelAdapter, 'disabled'); assert.ok(Object.isFrozen(config));
  for (const env of [
    { NODE_ENV: 'prod' }, { TRACEMIGO_PORT: '' }, { TRACEMIGO_PORT: '3e3' }, { TRACEMIGO_PORT: ' 3001' },
    { TRACEMIGO_PORT: '-1' }, { TRACEMIGO_PORT: '65536' }, { TRACEMIGO_BODY_LIMIT: '131073' },
    { TRACEMIGO_SHUTDOWN_TIMEOUT_MS: '0' }, { TRACEMIGO_PROBE_TIMEOUT_MS: '0' },
    { TRACEMIGO_MODEL_ADAPTER: 'live' }, { TRACEMIGO_MODLE_ADAPTER: 'test' }, { TRACEMIGO_HOST: 'attacker.invalid' },
    { NODE_ENV: 'production', TRACEMIGO_LOG_LEVEL: 'silent' }, { NODE_ENV: 'production', TRACEMIGO_PORT: '0' },
  ]) assert.throws(() => parseConfiguration(env), ConfigurationError);
  assert.throws(() => parseConfiguration({ TRACEMIGO_PORT: 'synthetic-secret-canary' }), error => !String(error).includes('synthetic-secret-canary'));
});

test('test providers, injected fixtures and routes cannot be enabled outside tests', () => {
  for (const environment of ['development', 'production']) {
    assert.throws(() => createService({ environment: { NODE_ENV: environment, TRACEMIGO_MODEL_ADAPTER: 'test' } }), ConfigurationError);
    assert.throws(() => createService({ environment: { NODE_ENV: environment }, testAdapters: createTestAdapters() }), ConfigurationError);
    assert.throws(() => createService({ environment: { NODE_ENV: environment }, testRoutes() { throw new Error('must not run'); } }), ConfigurationError);
  }
  assert.throws(() => service({ environment: { ...base, TRACEMIGO_JUDGE_ADAPTER: 'test' } }), ConfigurationError);
  assert.throws(() => service({ testAdapters: createTestAdapters() }), ConfigurationError);
});

test('default adapters are unavailable; deterministic fixtures are explicitly labeled test', async () => {
  const normal = service();
  await assert.rejects(normal.adapters.model.generate('text'), CapabilityUnavailable);
  await assert.rejects(normal.adapters.judge.execute('hash'), CapabilityUnavailable);
  await normal.shutdown();
  const fixtures = createTestAdapters();
  const app = service({ environment: { ...base, TRACEMIGO_MODEL_ADAPTER: 'test', TRACEMIGO_JUDGE_ADAPTER: 'test' }, testAdapters: fixtures });
  assert.deepEqual(await app.adapters.model.generate('ignored'), { kind: 'test', text: 'Synthetic test peer response.' });
  assert.equal((await app.adapters.judge.execute('ignored')).kind, 'test');
  assert.equal((await app.app.inject('/v1/health/ready')).json().capabilities.judge, 'test');
  await app.shutdown();
});

test('liveness and API-foundation readiness do not claim provider capability', async () => {
  const current = service();
  try {
    assert.deepEqual((await current.app.inject('/v1/health/live')).json(), { status: 'alive' });
    const ready = await current.app.inject('/v1/health/ready');
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: 'ready', scope: 'api-foundation', capabilities: { model: 'disabled', judge: 'disabled' } });
    checkProblem(await current.app.inject('/'), 501, 'NOT_IMPLEMENTED');
    checkProblem(await current.app.inject('/does-not-exist?secret=synthetic-secret-canary'), 404, 'NOT_FOUND');
    checkProblem(await current.app.inject('/%E0%A4%A'), 400, 'MALFORMED_REQUEST');
  } finally { await current.shutdown(); }
});

test('request IDs are server UUIDs; arbitrary caller values cannot become identifiers or logs', async () => {
  const current = service();
  try {
    const first = await current.app.inject({ url: '/v1/health/live', headers: { 'x-request-id': 'untrusted-id', 'request-id': 'another-untrusted-id' } });
    const second = await current.app.inject('/v1/health/live');
    assert.ok(uuid.test(first.headers['x-request-id'])); assert.notEqual(first.headers['x-request-id'], second.headers['x-request-id']);
  } finally { await current.shutdown(); }
});

function validationService(extra = {}) {
  return service({ ...extra, testRoutes(app) {
    app.post('/__test/validate', { schema: { body: peerTurnInputSchema } }, async () => ({ accepted: true }));
    app.post('/__test/problem-schema', { schema: { body: problemDetailsSchema } }, async () => ({ valid: true }));
    app.get('/__test/throw', async () => { throw Object.assign(new Error('synthetic-secret-canary'), { statusCode: 401, headers: { 'x-leak': 'synthetic-secret-canary' } }); });
    app.get('/__test/unavailable', async () => { throw new CapabilityUnavailable(); });
  } });
}
test('runtime JSON schemas reject wrong types, unknown fields and invalid sizes without echoing input', async () => {
  const current = validationService();
  try {
    const valid = await current.app.inject({ method: 'POST', url: '/__test/validate', payload: { confirmed_text: 'A confirmed explanation.' } });
    assert.equal(valid.statusCode, 200);
    for (const payload of [{}, { confirmed_text: 123 }, { confirmed_text: '' }, { confirmed_text: ' \n\t' }, { confirmed_text: 'x'.repeat(4097) }, { confirmed_text: 'valid', 'synthetic-secret-canary': 'answer' }]) {
      const response = await current.app.inject({ method: 'POST', url: '/__test/validate', payload });
      const body = checkProblem(response, 422, 'INVALID_REQUEST');
      assert.deepEqual(body.field_errors, [{ field: 'body', code: 'INVALID_VALUE' }]);
      assert.ok(!response.body.includes('synthetic-secret-canary'));
    }
  } finally { await current.shutdown(); }
});

test('parser/media/body-size failures use safe problem+json and request IDs', async () => {
  const current = validationService({ environment: { ...base, TRACEMIGO_BODY_LIMIT: '1024' } });
  try {
    checkProblem(await current.app.inject({ method: 'POST', url: '/__test/validate', headers: { 'content-type': 'application/json' }, payload: '{secret' }), 400, 'MALFORMED_JSON');
    checkProblem(await current.app.inject({ method: 'POST', url: '/__test/validate', headers: { 'content-type': 'application/xml' }, payload: '<secret/>' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
    checkProblem(await current.app.inject({ method: 'POST', url: '/__test/validate', payload: { confirmed_text: 'x'.repeat(2048) } }), 413, 'PAYLOAD_TOO_LARGE');
  } finally { await current.shutdown(); }
});

test('unexpected exceptions are safe 500s, not caller-controlled statuses/headers', async () => {
  const current = validationService();
  try {
    const response = await current.app.inject('/__test/throw');
    checkProblem(response, 500, 'INTERNAL_ERROR');
    assert.ok(!response.body.includes('synthetic-secret-canary')); assert.equal(response.headers['x-leak'], undefined);
    checkProblem(await current.app.inject('/__test/unavailable'), 503, 'FEATURE_UNAVAILABLE');
    assert.equal((await current.app.inject({ method: 'POST', url: '/__test/problem-schema', payload: response.json() })).statusCode, 200);
  } finally { await current.shutdown(); }
});

test('public config schema and runtime parser agree on defaults and production restrictions', async () => {
  const current = service({ testRoutes(app) { app.post('/__test/config-schema', { schema: { body: runtimeConfigSchema } }, async () => ({ valid: true })); } });
  try {
    const validate = payload => current.app.inject({ method: 'POST', url: '/__test/config-schema', payload });
    assert.equal((await validate(parseConfiguration({}))).statusCode, 200);
    for (const config of [{ ...parseConfiguration({}), environment: 'production', modelAdapter: 'test' }, { ...parseConfiguration({}), port: '3001' }, { ...parseConfiguration({}), environment: 'production', port: 0 }]) checkProblem(await validate(config), 422, 'INVALID_REQUEST');
  } finally { await current.shutdown(); }
});

test('readiness fails on dependency rejection or failure; liveness stays alive', async () => {
  for (const check of [async () => false, async () => { throw new Error('synthetic-secret-canary'); }]) {
    const current = service({ dependencies: [{ check }] });
    try {
      const response = await current.app.inject('/v1/health/ready');
      checkProblem(response, 503, 'NOT_READY'); assert.ok(!response.body.includes('synthetic-secret-canary'));
      assert.equal((await current.app.inject('/v1/health/live')).statusCode, 200);
    } finally { await current.shutdown(); }
  }
});

test('readiness has a deadline, aborts probes and coalesces concurrent requests', async () => {
  let calls = 0; let signal;
  const current = service({ environment: { ...base, TRACEMIGO_PROBE_TIMEOUT_MS: '20' }, dependencies: [{ async check(value) { calls++; signal = value; return new Promise(() => {}); } }] });
  try {
    const replies = await Promise.all([current.app.inject('/v1/health/ready'), current.app.inject('/v1/health/ready')]);
    replies.forEach(response => checkProblem(response, 503, 'NOT_READY'));
    assert.equal(calls, 1); assert.equal(signal.aborted, true);
    checkProblem(await current.app.inject('/v1/health/ready'), 503, 'NOT_READY');
    assert.equal(calls, 1, 'timed-out probes that ignore abort must not accumulate');
  } finally { await current.shutdown(); }
});

test('structured logging drops secret-bearing URLs, headers, bodies, exception text and unknown keys', async () => {
  const lines = [];
  const current = validationService({ environment: { NODE_ENV: 'test' }, writeLog: line => lines.push(line) });
  try {
    await current.app.inject({ method: 'POST', url: '/__test/validate?token=synthetic-secret-canary', headers: { authorization: 'Bearer synthetic-secret-canary', cookie: 'session=synthetic-secret-canary' }, payload: { confirmed_text: 'synthetic-secret-canary' } });
    await current.app.inject('/__test/throw?answer=synthetic-secret-canary');
    assert.ok(lines.length > 0); assert.ok(!lines.join('').includes('synthetic-secret-canary'));
    for (const line of lines) assert.ok(Object.keys(JSON.parse(line)).every(key => ['event','request_id','status','route','method','port'].includes(key)));
    const logger = createAuditLogger(line => lines.push(line), 'info');
    logger.record('request_failed', { req: { body: 'synthetic-secret-canary' }, error: new Error('synthetic-secret-canary'), request_id: 'synthetic-secret-canary', route: 'synthetic-secret-canary' });
    assert.ok(!lines.join('').includes('synthetic-secret-canary'));
  } finally { await current.shutdown(); }
});

test('failed logging sink does not expose errors and prevents a later green readiness response', async () => {
  const current = service({ environment: { NODE_ENV: 'test' }, writeLog() { throw new Error('synthetic-secret-canary'); } });
  try {
    await current.app.inject('/v1/health/live');
    checkProblem(await current.app.inject('/v1/health/ready'), 503, 'NOT_READY');
  } finally { await current.shutdown(); }
});

test('shutdown drains accepted work, rejects new admission, closes adapters once and is idempotent', async () => {
  const entered = deferred(), release = deferred(); let closed = 0;
  const fixtures = { ...createTestAdapters(), async close() { closed++; } };
  const current = service({ environment: { ...base, TRACEMIGO_MODEL_ADAPTER: 'test', TRACEMIGO_JUDGE_ADAPTER: 'test' }, testAdapters: fixtures,
    testRoutes(app) { app.get('/__test/slow', async () => { entered.resolve(); await release.promise; return { completed: true }; }); } });
  const accepted = current.app.inject('/__test/slow').then(response => response);
  await entered.promise;
  const closing = current.shutdown(); assert.strictEqual(closing, current.shutdown());
  checkProblem(await current.app.inject('/v1/health/ready'), 503, 'SHUTTING_DOWN');
  assert.equal(closed, 0); release.resolve();
  assert.deepEqual((await accepted).json(), { completed: true });
  await closing; assert.equal(closed, 1);
});

test('shutdown deadline reports failure rather than silently claiming completed work', async () => {
  const entered = deferred(), release = deferred(); const lines = [];
  const current = service({ environment: { NODE_ENV: 'test', TRACEMIGO_SHUTDOWN_TIMEOUT_MS: '100' }, writeLog: line => lines.push(line),
    testRoutes(app) { app.get('/__test/slow', async () => { entered.resolve(); await release.promise; return { completed: true }; }); } });
  const accepted = current.app.inject('/__test/slow').then(response => response);
  await entered.promise;
  await assert.rejects(current.shutdown(), /shutdown failed/);
  assert.ok(lines.join('').includes('shutdown_failed')); assert.ok(!lines.join('').includes('shutdown_complete'));
  release.resolve(); await accepted; await current.app.close();
});

test('readiness recovers after a completed failed dependency check', async () => {
  let healthy = false;
  const current = service({ dependencies: [{ async check() { return healthy; } }] });
  try {
    checkProblem(await current.app.inject('/v1/health/ready'), 503, 'NOT_READY');
    healthy = true;
    assert.equal((await current.app.inject('/v1/health/ready')).statusCode, 200);
  } finally { await current.shutdown(); }
});
