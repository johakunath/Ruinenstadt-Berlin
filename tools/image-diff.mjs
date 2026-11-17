// Compares two same-size images (before/after proofs, e.g. clip-sheet strips).
//   node tools/image-diff.mjs before.png after.png [threshold]
// Prints the share of pixels whose largest RGB channel difference is above `threshold` (0..255,
// default 0) and exits 1 when the sizes differ.
import sharp from 'sharp';

const [a, b, threshold = '0'] = process.argv.slice(2);
const [x, y] = await Promise.all([a, b].map((f) => sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
if (x.info.width !== y.info.width || x.info.height !== y.info.height) {
  console.log(`size differs: ${x.info.width}x${x.info.height} vs ${y.info.width}x${y.info.height}`);
  process.exit(1);
}
const n = x.info.width * x.info.height;
let changed = 0;
for (let i = 0; i < n * 3; i += 3) {
  const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
  if (d > Number(threshold)) changed++;
}
console.log(`${((100 * changed) / n).toFixed(3)} % of ${n} pixels differ (> ${threshold})`);
