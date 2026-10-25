// Converts the source PNGs in art/ into the WebP files the app ships from public/assets/.
// Usage (from apps/web): npm run images
// Run it after changing or adding a source image (including after derive-model-layers.ps1). Transparency is kept;
// dimensions are unchanged, because every hotspot and cut-out is measured in pixels of the photo.
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'art');
const target = join(root, 'public', 'assets');

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : name.endsWith('.png') ? [path] : [];
});

let before = 0; let after = 0;
for (const file of walk(source)) {
  const out = join(target, relative(source, file)).replace(/\.png$/, '.webp');
  mkdirSync(dirname(out), { recursive: true });
  // Small sprites (the suitcase tonearm) get lossless so their matted edges stay clean.
  const small = statSync(file).size < 200_000;
  const info = await sharp(file).webp(small ? { lossless: true, effort: 6 } : { quality: 82, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(out);
  before += statSync(file).size; after += info.size;
  console.log(`${relative(root, out)}  ${(info.size / 1024).toFixed(0)} KB`);
}
console.log(`Total ${(before / 1e6).toFixed(1)} MB PNG -> ${(after / 1e6).toFixed(1)} MB WebP`);
