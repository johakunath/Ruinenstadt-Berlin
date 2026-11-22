#!/usr/bin/env node
// Finishes a generated texture (docs/local-ai-assets.md W1 step 5 and 6): makes it seamless, matches its
// colour to the texture it replaces, resizes and writes WebP.
//
//   node tools/texture-tile.mjs in.png out.webp [--match old.webp] [--size 1024] [--band 0.22] [--quality 85] [--gain 1]
//   node tools/texture-tile.mjs --check out.webp sheet.jpg     (2 x 2 repeat to look for seams and blobs)
//
// Seamless: the image is blended with a copy shifted by half its size. The shifted copy has no seam at the
// borders, the original has none in the middle; a soft, noisy mask takes the copy near the borders and the
// original inside. Suits irregular surfaces (plaster, fur, grass, dirt). Regular patterns (brick courses,
// tiles, setts) keep their layout from a seamless start image instead (`tools/comfy.mjs --init`).
// --band 0: no blend (tiles, slates and other regular rows: a seamless --init keeps them nearly seamless).
// --gain: multiply the brightness after matching (a darker or lighter surface than the old file, e.g. black iron).
// --match: per channel mean and spread moved to the old texture's, so vertex tints in code keep their look;
// the spread is never raised (contrast stays medium-low).
import sharp from 'sharp';

const argv = process.argv.slice(2);

if (argv[0] === '--check') {
  const [, file, out] = argv;
  const { width } = await sharp(file).metadata();
  const half = Math.min(width, 512);
  const b = await sharp(file).resize(half, half).png().toBuffer();
  await sharp({ create: { width: half * 2, height: half * 2, channels: 3, background: '#000' } })
    .composite([[0, 0], [half, 0], [0, half], [half, half]].map(([left, top]) => ({ input: b, left, top })))
    .jpeg({ quality: 85 }).toFile(out);
  console.log(out);
  process.exit(0);
}

const [input, output, ...rest] = argv;
const opt = { size: 1024, band: 0.22, quality: 85 };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i] === '--match' ? rest[i + 1] : Number(rest[i + 1]);

const S = opt.size;
const src = await sharp(input).removeAlpha().resize(S, S).raw().toBuffer();
const out = Buffer.alloc(S * S * 3);

// Smooth value noise so the blend seam wanders instead of drawing a straight cross.
function noise(x, y) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}
const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

if (!opt.band) src.copy(out);
else for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  // Distance to the nearest border in [0, 0.5], pushed around by noise.
  const d = Math.min(x, S - 1 - x, y, S - 1 - y) / S + (noise(x / 64, y / 64) - 0.5) * opt.band * 0.6;
  const w = 1 - smooth(0.02, opt.band, d);
  const sx = (x + S / 2) % S, sy = (y + S / 2) % S;
  for (let c = 0; c < 3; c++) out[(y * S + x) * 3 + c] = src[(y * S + x) * 3 + c] * (1 - w) + src[(sy * S + sx) * 3 + c] * w;
}

if (opt.match) {
  const stats = buf => [0, 1, 2].map(c => {
    let m = 0, q = 0, n = buf.length / 3;
    for (let i = c; i < buf.length; i += 3) { m += buf[i]; q += buf[i] * buf[i]; }
    m /= n;
    return [m, Math.sqrt(q / n - m * m)];
  });
  const ref = stats(await sharp(opt.match).removeAlpha().resize(256, 256).raw().toBuffer());
  const own = stats(out);
  for (let c = 0; c < 3; c++) {
    // Never more contrast than generated, never less than --keep of it (wear must stay visible).
    const k = Math.min(1, Math.max(opt.keep ?? 0.7, ref[c][1] / own[c][1]));
    for (let i = c; i < out.length; i += 3) out[i] = Math.max(0, Math.min(255, (out[i] - own[c][0]) * k + ref[c][0]));
  }
}

if (opt.gain && opt.gain !== 1) for (let i = 0; i < out.length; i++) out[i] = Math.min(255, out[i] * opt.gain);

const info = await sharp(out, { raw: { width: S, height: S, channels: 3 } }).webp({ quality: opt.quality }).toFile(output);
console.log(`${output} ${S} px, ${(info.size / 1024).toFixed(0)} KB`);
