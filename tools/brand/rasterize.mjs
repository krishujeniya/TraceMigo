import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base = new URL('../../apps/web/public/brand/', import.meta.url);
const outputs = [
  ['favicon-master.svg','favicon-16.png',16],['favicon-master.svg','favicon-32.png',32],['favicon-master.svg','favicon-48.png',48],['favicon-master.svg','favicon-96.png',96],
  ['app-master.svg','apple-touch-icon.png',180],['app-master.svg','app-icon-192.png',192],['app-master.svg','app-icon-512.png',512],
  ['maskable-master.svg','maskable-icon-512.png',512],['avatar-master.svg','social-avatar-512.png',512],
];
for(const [source,target,size] of outputs) await sharp(await readFile(new URL(source,base))).resize(size,size).png({compressionLevel:9}).toFile(new URL(target,base).pathname);
await sharp(await readFile(new URL('social-preview.svg',base))).png({compressionLevel:9}).toFile(new URL('social-preview.png',base).pathname);
// Review-only alpha renders stay outside public application assets.
const renders = new URL('../../docs/design/renders/', import.meta.url);
await mkdir(renders,{recursive:true});
for(const size of [16,32,48,128]) await sharp(await readFile(new URL('mark-ink.svg',base))).resize(size,size).png({compressionLevel:9}).toFile(new URL(`mark-check-${size}.png`,renders).pathname);
console.log('Rendered exact-size PNG icons, social template and alpha-check fixtures.');
