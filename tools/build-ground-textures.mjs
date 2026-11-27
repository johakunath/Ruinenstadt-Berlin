// Export the Köpenick ground images (T1, T1b). No painting, relighting or synthesized detail.
//
//   node tools/build-ground-textures.mjs [--sizes 512,1024] [--proof dir] [surface=source.png ...]
//
// Surfaces: grass, dirt, paving, leaves (tiling) and litter (2 × 2 alpha atlas). A surface given with a source is
// rebuilt from it (any size, resized); the others are re-exported from their current 1024 px runtime file.
// --sizes  which sizes to write for the four tiling surfaces (default both): 1024 → `<surface>.webp` (Qualität until
//          Johannes picks), 512 → `<surface>-512.webp` (Leistung, `?ground=512`). The 512 file is a wrap-aware 2:1
//          downscale (resampled from a 3 × 3 tiling), so it stays seamless. A 1024 file is only rewritten from a new source.
// Litter: the local average colour of the visible pixels (alpha ≥ 128, the material's alphaTest) fills every transparent
// pixel of its cell, so mipmaps and filtering never mix in the near-black under the alpha (T1b finding 4); WebP
// `exact` keeps those colours. Litter stays one 1024 px file (an atlas; Leistung caps it at load).
// --proof  writes a 2 × 2 repeat sheet per tiling surface there.
import sharp from 'sharp';
import { mkdir, readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';

const TILING = ['grass', 'dirt', 'paving', 'leaves'];
const ALL = [...TILING, 'litter'];
const dir = 'assets/textures/koepenick';
const argv = process.argv.slice(2);
const opt = { sizes: [512, 1024], proof: '' };
const sources = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--sizes') opt.sizes = argv[++i].split(',').map(Number);
  else if (argv[i] === '--proof') opt.proof = argv[++i];
  else {
    const [name, path] = argv[i].split('=');
    assert(ALL.includes(name) && path, `unknown argument ${argv[i]} (surface=source.png)`);
    sources[name] = path;
  }
}
if (opt.proof) await mkdir(opt.proof, { recursive: true });
// Sources are read into memory first: on Windows sharp cannot write a file it still has open (litter is rewritten in place).
sharp.cache(false);

const webp = { quality: 85, effort: 6 };

/** Wrap-aware resize of a seamless square tile: resample a 3 × 3 tiling, keep the middle. */
async function tileResize(input, size) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const big = Buffer.alloc(w * 3 * h * 3 * 3);
  for (let y = 0; y < h * 3; y++) for (let tx = 0; tx < 3; tx++) data.copy(big, (y * w * 3 + tx * w) * 3, (y % h) * w * 3, (y % h + 1) * w * 3);
  return sharp(big, { raw: { width: w * 3, height: h * 3, channels: 3 } })
    .resize(size * 3, size * 3, { kernel: 'lanczos3' })
    .extract({ left: size, top: size, width: size, height: size });
}

/**
 * Per 512 px cell, a pull-push fill: every pixel under the alpha cutoff takes the average colour of the visible pixels
 * around it (from the coarsest 2:1 level that has any, bilinear), which is what premultiplied filtering would give.
 */
function bleed(data, S) {
  const cell = S / 2;
  for (const [cx, cy] of [[0, 0], [cell, 0], [0, cell], [cell, cell]]) {
    // Pull: weight 1 for visible pixels, colour sums and weights halved per level.
    const levels = [];
    let n = cell, w = new Float64Array(n * n), c = new Float64Array(n * n * 3);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = ((cy + y) * S + cx + x) * 4;
      if (data[i + 3] < 128) continue;
      w[y * n + x] = 1;
      for (let k = 0; k < 3; k++) c[(y * n + x) * 3 + k] = data[i + k];
    }
    levels.push({ n, w, c });
    while (n > 1) {
      const h = n / 2, w2 = new Float64Array(h * h), c2 = new Float64Array(h * h * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const j = (y * 2 + dy) * n + x * 2 + dx;
        w2[y * h + x] += w[j];
        for (let k = 0; k < 3; k++) c2[(y * h + x) * 3 + k] += c[j * 3 + k];
      }
      n = h; w = w2; c = c2;
      levels.push({ n, w, c });
    }
    assert(levels.at(-1).w[0] > 0, 'Every atlas cell must contain visible content');
    // Push: the normalized colour of each level; empty pixels sample the next coarser level bilinearly.
    let up = levels.at(-1).c.map(v => v / levels.at(-1).w[0]);
    for (let l = levels.length - 2; l >= 0; l--) {
      const { n, w, c } = levels[l], m = n / 2, out = new Float64Array(n * n * 3);
      const at = (x, y, k) => up[(Math.min(m - 1, Math.max(0, y)) * m + Math.min(m - 1, Math.max(0, x))) * 3 + k];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (w[i] > 0) { for (let k = 0; k < 3; k++) out[i * 3 + k] = c[i * 3 + k] / w[i]; continue; }
        const fx = (x + 0.5) / 2 - 0.5, fy = (y + 0.5) / 2 - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        for (let k = 0; k < 3; k++) {
          out[i * 3 + k] = (at(x0, y0, k) * (1 - tx) + at(x0 + 1, y0, k) * tx) * (1 - ty) + (at(x0, y0 + 1, k) * (1 - tx) + at(x0 + 1, y0 + 1, k) * tx) * ty;
        }
      }
      up = out;
    }
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const i = ((cy + y) * S + cx + x) * 4;
      if (data[i + 3] >= 128) continue;
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(up[(y * cell + x) * 3 + k]);
    }
  }
}

const report = [];
for (const name of ALL) {
  const sourcePath = sources[name] ?? `${dir}/${name}.webp`;
  const source = await readFile(sourcePath);
  const fresh = Boolean(sources[name]);
  if (name === 'litter') {
    const S = 1024, path = `${dir}/litter.webp`;
    const { data } = await sharp(source).resize(S, S).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if ([0, 511, 512, 1023].includes(x) || [0, 511, 512, 1023].includes(y)) {
        assert(data[(y * S + x) * 4 + 3] < 128, 'Atlas content must not touch a cell boundary at the material alpha cutoff');
      }
    }
    bleed(data, S);
    await sharp(data, { raw: { width: S, height: S, channels: 4 } }).webp({ ...webp, alphaQuality: 100, exact: true }).toFile(path);
    report.push({ name, file: path, size: S, bytes: (await stat(path)).size });
    continue;
  }
  for (const size of opt.sizes) {
    const path = size === 1024 ? `${dir}/${name}.webp` : `${dir}/${name}-${size}.webp`;
    if (path === sourcePath || (size === 1024 && !fresh)) continue;
    await (await tileResize(source, size)).webp(webp).toFile(path);
    const meta = await sharp(path).metadata();
    assert.equal(meta.width, size);
    assert.equal(meta.height, size);
    assert.equal(meta.hasAlpha, false);
    const bytes = (await stat(path)).size;
    assert(bytes <= 400000, `${path} exceeds 400 KB`);
    report.push({ name, file: path, size, bytes });
    if (opt.proof) {
      const tile = await sharp(path).png().toBuffer();
      await sharp({ create: { width: size * 2, height: size * 2, channels: 3, background: '#000' } })
        .composite([0, 1, 2, 3].map(n => ({ input: tile, left: (n % 2) * size, top: Math.floor(n / 2) * size })))
        .jpeg({ quality: 85 }).toFile(`${opt.proof}/repeat-${name}-${size}.jpg`);
    }
  }
}
console.log(JSON.stringify(report, null, 1));
