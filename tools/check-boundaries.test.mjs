import test from 'node:test';
import assert from 'node:assert/strict';
import { checkImport, specifiers } from './check-boundaries.mjs';

const web = { name: 'web', directory: '/project/apps/web', file: '/project/apps/web/src/app.ts', dependencies: new Set(['@tracemigo/ui', '@tracemigo/db', 'next']) };
test('public dependency allowed; trusted data and deep imports rejected', () => {
  assert.equal(checkImport(web, '@tracemigo/ui'), null);
  assert.equal(checkImport(web, '@tracemigo/ui/tokens.css'), null);
  assert.ok(checkImport(web, '@tracemigo/ui/other.css'));
  assert.match(checkImport(web, '@tracemigo/db'), /outside/);
  assert.match(checkImport(web, '@tracemigo/ui/src/private'), /deep/);
});
test('relative traversal, absolute paths, aliases and undeclared dependencies rejected', () => {
  for (const item of ['../../../packages/db/src/index.js', '/project/secrets.js', 'file:///secrets.js', '#db', 'pg']) assert.ok(checkImport(web, item));
  assert.equal(checkImport(web, './sibling.js'), null);
});
test('pure package cannot acquire Node or external authority', () => {
  const ctx = { ...web, name: 'contracts', dependencies: new Set(['pg']) };
  assert.ok(checkImport(ctx, 'node:fs'));
  assert.ok(checkImport(ctx, 'pg'));
});
test('AST sees static/dynamic imports, exports, requires and type imports', () => {
  assert.deepEqual(specifiers(`import a from 'a'; export {x} from 'b'; export * from 'c'; import('d'); require('e'); type T = import('f').T;`), ['a','b','c','d','e','f']);
});
test('comments and ordinary strings are not imports; computed loading is denied', () => {
  assert.deepEqual(specifiers(`// import x from 'secret';\nconst a = "require('secret')";`), []);
  assert.deepEqual(specifiers(`import(target); require(target);`), [null, null]);
});
