import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createService } from '../apps/api/dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = fileURLToPath(new URL('../apps/api/dist/server.js', import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('TRACEMIGO_')));
const canary = 'synthetic-startup-secret-canary';

async function failsClosed(extra, args = [entry]) {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...env, ...extra }, stdio: ['ignore','pipe','pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 10000);
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  clearTimeout(timeout);
  assert.equal(code, 1); assert.ok(!output.includes(canary)); assert.ok(!output.includes('startup_ready'));
}
await failsClosed({ NODE_ENV: 'production', TRACEMIGO_MODEL_ADAPTER: 'test' });
await failsClosed({ NODE_ENV: 'production', TRACEMIGO_JUDGE_ADAPTER: 'test' });
await failsClosed({ NODE_ENV: 'development', TRACEMIGO_PORT: canary });
await failsClosed({ NODE_ENV: 'production' }, ['--input-type=module', '-e', `import {createService} from './apps/api/dist/index.js'; try {createService({environment:{NODE_ENV:'test'}});process.exitCode=0;} catch {process.exitCode=1;}`]);
console.log('PASS: invalid config, production test adapters and ambient-production downgrade exit before listen without leaking values.');

const child = spawn(process.execPath, [entry], { cwd: root, env: { ...env, NODE_ENV: 'development', TRACEMIGO_PORT: '0' }, stdio: ['ignore','pipe','pipe'] });
let output = '';
let exited = false;
const exit = new Promise(resolve => child.once('exit', code => { exited = true; resolve(code); }));
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('API startup timed out')), 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      for (const line of output.split('\n')) {
        try {
          const event = JSON.parse(line);
          if (event.event === 'startup_ready') { clearTimeout(timeout); resolve(event.port); }
        } catch { /* incomplete JSON line */ }
      }
    });
    child.stderr.on('data', data => { output += data; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('API exited before startup')); });
  });
  const response = await fetch(`http://127.0.0.1:${port}/v1/health/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).capabilities, { model:'disabled', judge:'disabled' });
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
  const code = await exit;
  clearTimeout(timeout);
  assert.equal(code, 0); assert.ok(output.includes('shutdown_complete')); assert.ok(!output.includes('shutdown_failed'));
  console.log('PASS: real API starts on loopback, reports disabled capabilities and drains/exits cleanly on SIGTERM.');
} finally {
  if (!exited) { child.kill('SIGKILL'); await exit; }
}
let enter, release;
const entered = new Promise(resolve => { enter = resolve; });
const gate = new Promise(resolve => { release = resolve; });
const drainingService = createService({ environment: { NODE_ENV: 'test', TRACEMIGO_LOG_LEVEL: 'silent' }, testRoutes(app) {
  app.get('/__test/accepted', async () => { enter(); await gate; return { completed: true }; });
} });
try {
  const address = await drainingService.app.listen({ host: '127.0.0.1', port: 0 });
  const accepted = fetch(address + '/__test/accepted');
  await entered;
  const closing = drainingService.shutdown();
  const denied = await fetch(address + '/v1/health/ready');
  assert.equal(denied.status, 503); assert.equal((await denied.json()).code, 'SHUTTING_DOWN');
  release();
  assert.deepEqual(await (await accepted).json(), { completed: true });
  await closing;
  console.log('PASS: real HTTP shutdown denies new work while the already accepted request completes.');
} finally { release(); await drainingService.shutdown(); }
console.log('VERDICT: PASS');
