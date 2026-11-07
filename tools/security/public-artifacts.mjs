import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rules = [
  ['private-key', /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/],
  ['private-authority', /\b(?:private_bundle_key|sealed_answers?|TRACEMIGO_DB_PASSWORD)\b/],
  ['private-canary', /TRACEMIGO_PRIVATE_CANARY_[A-Z0-9]{16,}/],
  ['source-map-reference', /(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/],
];
const privatePath = /(?:^|\/)(?:private|sealed|fixtures|__fixtures__|planning)(?:\/|$)|(?:^|\/)(?:private|sealed)[_-]|(?:^|\/)\.env(?:\.|$)|\.(?:key|map)$/i;
const rendered = /\.(?:html|rsc|body|txt)$/;

export async function scanPublicArtifacts(root) {
  root = path.resolve(root);
  const failures = [];
  let count = 0;
  async function directory(relative, filter = () => true) {
    const base = path.join(root, relative);
    const info = await lstat(base);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Required real artifact directory missing: ${relative}`);
    for (const entry of await readdir(base, { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) { failures.push({ file: name, rule: 'symlink' }); continue; }
      if (entry.isDirectory()) { await directory(name, filter); continue; }
      if (!entry.isFile()) { failures.push({ file: name, rule: 'non-regular-file' }); continue; }
      if (!filter(name)) continue;
      count++;
      if (privatePath.test(name.split(path.sep).join('/'))) failures.push({ file: name, rule: 'forbidden-public-path' });
      if (/\.(?:zip|tar|gz|tgz|br|7z|rar)$/i.test(name)) { failures.push({ file: name, rule: 'unsupported-public-archive' }); continue; }
      const info = await lstat(path.join(root, name));
      if (info.size > 32 * 1024 * 1024) { failures.push({ file: name, rule: 'file-exceeds-scan-limit' }); continue; }
      const content = (await readFile(path.join(root, name))).toString('latin1');
      for (const [rule, pattern] of rules) if (pattern.test(content)) failures.push({ file: name, rule });
    }
  }
  const buildId = path.join(root, 'apps/web/.next/BUILD_ID');
  const info = await lstat(buildId);
  if (!info.isFile() || info.isSymbolicLink() || !(await readFile(buildId, 'utf8')).trim()) throw new Error('A completed production web build is required.');
  for (const relative of ['apps/web/public', 'apps/web/.next/static']) {
    const before = count;
    await directory(relative);
    if (count === before) throw new Error(`No public artifacts found: ${relative}`);
  }
  const before = count;
  await directory('apps/web/.next/server/app', name => rendered.test(name));
  if (count === before) throw new Error('No prerendered HTML/RSC artifacts found. Review scan scope if rendering changes.');
  return { filesChecked: count, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await scanPublicArtifacts(fileURLToPath(new URL('../../', import.meta.url)));
    if (result.failures.length) {
      // Only paths/rule identifiers, never matching secret or answer content.
      for (const failure of result.failures) console.error(`${failure.rule}: ${failure.file}`);
      throw new Error(`${result.failures.length} public artifact violation(s).`);
    }
    console.log(`PASS: ${result.filesChecked} public/client/prerendered artifacts checked for known private markers, key material and source maps.`);
    console.log('VERDICT: PASS');
  } catch (error) { console.error(`VERDICT: FAIL -- ${error.message}`); process.exitCode = 1; }
}
