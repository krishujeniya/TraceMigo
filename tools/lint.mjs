import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await checkDirectory(file);
    else if (entry.name.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(1);
    }
  }
}
await checkDirectory(new URL('tools/', root));
for (const name of ['package.json', 'tsconfig.json', 'tsconfig.base.json', 'turbo.json']) JSON.parse(await readFile(new URL(name, root), 'utf8'));
console.log('Tool syntax and root JSON checks passed. TypeScript syntax is checked by typecheck.');
