import { mkdir, copyFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
await mkdir(new URL('packages/ui/dist/',root),{recursive:true});
await copyFile(new URL('packages/ui/src/tokens.css',root),new URL('packages/ui/dist/tokens.css',root));
