import { mkdtemp, mkdir, cp, symlink, readdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
if (process.versions.node !== expectedNode) throw new Error(`Use Node ${expectedNode}; found ${process.versions.node}`);
const temporary = await mkdtemp(path.join(tmpdir(), 'tracemigo-brand-verify-'));
const trees = ['apps/web/public/brand', 'docs/design/renders'];
const singles = ['docs/design/asset-review.png', 'packages/ui/src/brand.tsx', 'packages/ui/src/tokens.css'];
async function files(base, relative) {
  const result = [];
  for (const entry of await readdir(path.join(base, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await files(base, name));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Unexpected non-regular output: ${name}`);
  }
  return result;
}
function run(command, args) {
  const result = spawnSync(command, args, { cwd: temporary, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status})`);
}
try {
  await mkdir(path.join(temporary, 'tools/brand'), { recursive: true });
  await mkdir(path.join(temporary, 'packages/ui/src'), { recursive: true });
  await mkdir(path.join(temporary, 'apps/web/public/brand'), { recursive: true });
  for (const name of ['generate.py', 'rasterize.mjs', 'finish.py', 'check.py', 'identity.json']) {
    await cp(path.join(root, 'tools/brand', name), path.join(temporary, 'tools/brand', name));
  }
  await cp(path.join(root, 'apps/web/public/brand/fonts'), path.join(temporary, 'apps/web/public/brand/fonts'), { recursive: true });
  await symlink(path.join(root, 'node_modules'), path.join(temporary, 'node_modules'), 'dir');
  run('python3', ['tools/brand/generate.py']);
  run(process.execPath, ['tools/brand/rasterize.mjs']);
  run('python3', ['tools/brand/finish.py']);
  run('python3', ['tools/brand/check.py']);
  const expected = new Set(singles);
  const actual = new Set(singles);
  for (const tree of trees) {
    for (const name of await files(temporary, tree)) expected.add(name);
    try { for (const name of await files(root, tree)) actual.add(name); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const differences = [];
  for (const name of [...new Set([...expected, ...actual])].sort()) {
    if (!expected.has(name)) { differences.push(`Unexpected: ${name}`); continue; }
    try {
      if (!(await readFile(path.join(root, name))).equals(await readFile(path.join(temporary, name)))) differences.push(`Changed: ${name}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      differences.push(`Missing: ${name}`);
    }
  }
  if (differences.length) throw new Error(`Generated exports differ:\n${differences.join('\n')}\nReview inputs and run pnpm brand:generate intentionally.`);
  console.log(`PASS: ${expected.size} brand/font/review/UI files match fresh generation; workspace outputs unchanged.`);
  console.log('VERDICT: PASS');
} catch (error) {
  console.error(`VERDICT: FAIL -- ${error.message}`);
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
