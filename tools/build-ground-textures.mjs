// Normalize generated albedo images; no painting, relighting or synthesized detail.
// node tools/build-ground-textures.mjs <grass.png> <dirt.png> <paving.png> <leaves.png> <litter.png>
import sharp from 'sharp';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const names = ['grass', 'dirt', 'paving', 'leaves', 'litter'];
const sources = process.argv.slice(2);
assert.equal(sources.length, names.length, 'Supply five generated source images in the documented order');
const dir = 'assets/textures/koepenick';
const proof = 'docs/proof/t1-ground';
await mkdir(dir, { recursive: true });
await mkdir(proof, { recursive: true });
const report = [];
for (const [i, name] of names.entries()) {
  const path = `${dir}/${name}.webp`;
  let image = sharp(sources[i]).resize(1024, 1024);
  if (name !== 'litter') image = image.removeAlpha();
  await image.webp({ quality: 85, alphaQuality: 100, effort: 6 }).toFile(path);
  const meta = await sharp(path).metadata();
  const bytes = (await stat(path)).size;
  assert(bytes <= 400000, `${name} exceeds 400 KB`);
  assert.equal(meta.width, 1024);
  assert.equal(meta.height, 1024);
  assert.equal(meta.hasAlpha, name === 'litter');
  if (name === 'litter') {
    const { data } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const occupied = [0, 0, 0, 0];
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
      const alpha = data[(y * 1024 + x) * 4 + 3];
      if (alpha >= 128) occupied[(y >= 512 ? 2 : 0) + (x >= 512 ? 1 : 0)]++;
      if ([0, 511, 512, 1023].includes(x) || [0, 511, 512, 1023].includes(y)) {
        assert(alpha < 128, 'Atlas content must not touch a cell boundary at the material alpha cutoff');
      }
    }
    assert(occupied.every(count => count > 0), 'Every atlas cell must contain visible content');
  }
  if (name !== 'litter') {
    const tile = await sharp(path).resize(512, 512).toBuffer();
    await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#000' } })
      .composite([0, 1, 2, 3].map(n => ({ input: tile, left: (n % 2) * 512, top: Math.floor(n / 2) * 512 })))
      .jpeg({ quality: 88 }).toFile(`${proof}/repeat-${name}.jpg`);
  }
  report.push({ name, bytes, width: meta.width, height: meta.height, alpha: meta.hasAlpha, sourceSize: await sharp(sources[i]).metadata().then(m => [m.width, m.height]) });
}
await writeFile(`${proof}/assets.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
