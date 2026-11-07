import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBuiltin } from 'node:module';
import { parse } from '@babel/parser';

const root = fileURLToPath(new URL('../', import.meta.url));
const policy = {
  contracts: [], domain: ['contracts'], db: ['contracts'], ui: [],
  'execution-client': ['contracts'], web: ['ui'], api: ['contracts'],
  'judge-controller': ['contracts', 'execution-client'],
};
const pure = new Set(['contracts', 'domain', 'execution-client']);

export function specifiers(source) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'], createImportExpressions: true });
  const result = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) result.push(node.source.value);
    if (node.type === 'TSImportType') result.push(node.argument?.value ?? node.options?.value ?? null);
    if (node.type === 'TSExternalModuleReference') result.push(node.expression?.value ?? null);
    if (node.type === 'ImportExpression') result.push(node.source.type === 'StringLiteral' ? node.source.value : null);
    if (node.type === 'CallExpression' && ((node.callee?.type === 'Identifier' && node.callee.name === 'require') || node.callee?.type === 'Import')) result.push(node.arguments[0]?.type === 'StringLiteral' ? node.arguments[0].value : null);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast.program);
  return result;
}

export function checkImport({ name, directory, file, dependencies }, specifier) {
  if (specifier === null) return 'Nonliteral module loading is forbidden';
  if (specifier.startsWith('.')) {
    const target = path.resolve(path.dirname(file), specifier);
    if (target !== directory && !target.startsWith(directory + path.sep)) return 'Relative import crosses package boundary';
    return null;
  }
  if (specifier.startsWith('/') || specifier.startsWith('file:') || specifier.startsWith('#')) return 'Absolute, file or alias imports are forbidden';
  if (isBuiltin(specifier)) return pure.has(name) || name === 'ui' ? 'Pure/public package imports Node authority' : null;
  const dependency = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (!dependencies.has(dependency)) return `Undeclared dependency: ${dependency}`;
  if (pure.has(name) && !dependency.startsWith('@tracemigo/')) return 'Pure package imports an external dependency';
  if (dependency.startsWith('@tracemigo/')) {
    if (specifier !== dependency && !(specifier === '@tracemigo/ui/tokens.css' && policy[name]?.includes('ui'))) return 'Workspace deep import bypasses public exports';
    if (!policy[name]?.includes(dependency.split('/')[1])) return 'Workspace import is outside allowed dependency graph';
  }
  return null;
}

async function filesUnder(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error('Source symlinks are forbidden: ' + file);
    if (item.isDirectory()) files.push(...await filesUnder(file));
    else if (/\.[cm]?[jt]sx?$/.test(item.name)) files.push(file);
  }
  return files;
}

export async function checkWorkspace() {
  const failures = [];
  let count = 0;
  for (const folder of ['apps', 'packages', 'services']) {
    for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(root, folder, entry.name);
      const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      const name = manifest.name.replace('@tracemigo/', '');
      if (!(name in policy)) { failures.push(`Unclassified package: ${name}`); continue; }
      const dependencies = new Set(Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }));
      for (const dependency of dependencies) {
        if (dependency.startsWith('@tracemigo/') && !policy[name].includes(dependency.split('/')[1])) failures.push(`${name}: forbidden manifest edge ${dependency}`);
        if (pure.has(name) && !dependency.startsWith('@tracemigo/')) failures.push(`${name}: pure package external dependency`);
      }
      const exports = manifest.exports;
      const allowedExports = name === 'ui' ? ['.', './tokens.css'] : ['.'];
      if (folder === 'packages' && (!exports?.['.'] || Object.keys(exports).some(key => !allowedExports.includes(key)))) failures.push(`${name}: exports outside declared public entry points`);
      for (const file of await filesUnder(path.join(directory, 'src'))) {
        for (const specifier of specifiers(await readFile(file, 'utf8'))) {
          // CSS is package-local and not a JavaScript dependency.
          const error = checkImport({ name, directory, file, dependencies }, specifier);
          if (error) failures.push(`${path.relative(root, file)}: ${error}`);
        }
        count++;
      }
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Package boundaries passed (${count} source files).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkWorkspace();
