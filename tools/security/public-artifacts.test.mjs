import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scanPublicArtifacts } from './public-artifacts.mjs';

async function fixture(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'tracemigo-public-check-'));
  try {
    for (const name of ['apps/web/public', 'apps/web/.next/static', 'apps/web/.next/server/app']) await mkdir(path.join(root, name), { recursive: true });
    for (const [name, content] of [['apps/web/.next/BUILD_ID','test-build'], ['apps/web/public/safe.txt','Public practice example'], ['apps/web/.next/static/app.js','console.log("public")'], ['apps/web/.next/server/app/index.html','<h1>Public example</h1>']]) await writeFile(path.join(root, name), content);
    await fn(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('clean public examples pass, including ordinary explanatory text', async () => fixture(async root => {
  const result = await scanPublicArtifacts(root);assert.equal(result.filesChecked,3);assert.deepEqual(result.failures,[]);
}));

test('private markers are detected in public files, client JS and HTML/RSC, without echoing contents', async () => fixture(async root => {
  const canary = 'TRACEMIGO_PRIVATE_CANARY_'+'1234567890ABCDEF';
  for (const [name, content] of [['apps/web/public/asset.txt',canary],['apps/web/.next/static/leak.js','{"private_bundle_key":"synthetic-private-answer"}'],['apps/web/.next/server/app/leak.html','-----BEGIN PRIVATE KEY-----\nsynthetic'],['apps/web/.next/server/app/leak.rsc','{"sealed_answer":"synthetic-answer"}']]) await writeFile(path.join(root,name),content);
  const result = await scanPublicArtifacts(root);
  for (const rule of ['private-canary','private-authority','private-key']) assert.ok(result.failures.some(f=>f.rule===rule));
  assert.equal(result.failures.length,4);assert.ok(!JSON.stringify(result).includes(canary));assert.ok(!JSON.stringify(result).includes('synthetic-answer'));
}));

test('source maps, map references and forbidden paths fail', async () => fixture(async root => {
  await mkdir(path.join(root,'apps/web/public/fixtures'));
  for (const [name,content] of [['apps/web/public/fixtures/answer.json','{}'],['apps/web/.next/static/app.js.map','{}'],['apps/web/.next/static/mapped.js','console.log(1);//# sourceMappingURL=external.map'],['apps/web/.next/static/style.css','/*# sourceMappingURL=data:application/json,abc */'],['apps/web/public/.env.production','synthetic']]) await writeFile(path.join(root,name),content);
  const result = await scanPublicArtifacts(root);assert.equal(result.failures.length,5);
}));

test('symlinks are rejected without following an outside target', async () => fixture(async root => {
  await symlink('/does-not-exist-outside-fixture',path.join(root,'apps/web/public/link'));
  assert.ok((await scanPublicArtifacts(root)).failures.some(f=>f.rule==='symlink'));
}));

test('missing build or empty required artifact tree fails rather than skips', async () => fixture(async root => {
  await rm(path.join(root,'apps/web/.next/BUILD_ID'));await assert.rejects(scanPublicArtifacts(root));
  await writeFile(path.join(root,'apps/web/.next/BUILD_ID'),'test');await rm(path.join(root,'apps/web/.next/static/app.js'));await assert.rejects(scanPublicArtifacts(root),/No public artifacts/);
}));


test('CLI rejects seeded material without printing the matched canary', async () => fixture(async root => {
  const tool = path.join(root,'tools/security/public-artifacts.mjs');
  await mkdir(path.dirname(tool),{recursive:true});
  await copyFile(new URL('./public-artifacts.mjs',import.meta.url),tool);
  const canary='TRACEMIGO_PRIVATE_CANARY_'+'ABCDEF1234567890';
  await writeFile(path.join(root,'apps/web/public/secret.txt'),canary);
  await writeFile(path.join(root,'apps/web/public/bundle.zip'),'synthetic-archive');
  const result=spawnSync(process.execPath,[tool],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/private-canary/);assert.match(result.stderr,/unsupported-public-archive/);assert.ok(!result.stderr.includes(canary));
}));
