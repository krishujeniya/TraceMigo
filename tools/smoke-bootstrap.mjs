import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from '../apps/api/dist/index.js';

const api = createServer();
try {
  const address = await api.listen({ host: '127.0.0.1', port: 0 });
  const response = await fetch(address);
  assert.equal(response.status, 501);
  const problem = await response.json();
  assert.equal(problem.code, 'NOT_IMPLEMENTED');
  assert.equal(problem.request_id, response.headers.get('x-request-id'));
  assert.match(response.headers.get('content-type'), /^application\/problem\+json/);
  const ready = await fetch(address + '/v1/health/ready');
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).scope, 'api-foundation');
  console.log('PASS: API listens on loopback and honestly returns 501 for unimplemented behavior.');
} finally {
  await api.close();
}

const directory = fileURLToPath(new URL('../apps/web/', import.meta.url));
const next = fileURLToPath(new URL('../apps/web/node_modules/next/dist/bin/next', import.meta.url));
const child = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', '0'], {
  cwd: directory, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Web startup timed out')), 20000);
    function collect(chunk) {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && /Ready in/.test(output)) { clearTimeout(timeout); resolve(match[1]); }
    }
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Web exited ${code}: ${output}`)); });
  });
  const response = await fetch(`http://127.0.0.1:${port}`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /TraceMigo/);
  assert.match(html, /Start a Python warmup/);
  assert.match(html, /Accounts and live execution are not available yet/);
  assert.match(html, /noindex/);
  for (const [route, expected] of [['/catalog','Small code.'], ['/warmup/python/running-total','running_total.py'], ['/warmup/python/list-references','list_references.py']]) {
    const page = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(page.status, 200, route);
    const body = await page.text();
    assert.ok(body.includes(expected), `${route} missing its public content`);
    assert.match(body, /noindex/);
  }
  console.log('PASS: built Next.js homepage, library and both local warmups serve with noindex and honest feature limits.');
} finally {
  if (child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(force);
  }
}
console.log('VERDICT: PASS');
