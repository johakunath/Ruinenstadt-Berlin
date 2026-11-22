#!/usr/bin/env node
// Contact sheet to pick from many generated variants at a glance (docs/local-ai-assets.md).
//   node tools/contact-sheet.mjs out.jpg <cell px> a.png b.png ...     [COLS=4] [TILE=1: each cell a 2 x 2 repeat]
// Each cell is labelled with its file name (seed), so a pick can be named.
import sharp from 'sharp';
import { basename } from 'node:path';

const [out, cellArg, ...files] = process.argv.slice(2);
const cell = Number(cellArg), tile = process.env.TILE === '1';
const cols = Math.min(files.length, Number(process.env.COLS ?? 4)), rows = Math.ceil(files.length / cols);
const label = name => Buffer.from(`<svg width="${cell}" height="18"><rect width="100%" height="18" fill="#000" opacity="0.6"/><text x="4" y="13" font-family="Arial" font-size="12" fill="#fff">${name}</text></svg>`);
const cells = await Promise.all(files.map(async f => {
  const half = tile ? cell / 2 : cell;
  const img = await sharp(f).flatten({ background: '#3a4448' }).resize(half, half, { fit: 'contain', background: '#3a4448' }).png().toBuffer();
  const parts = tile ? [[0, 0], [half, 0], [0, half], [half, half]] : [[0, 0]];
  return sharp({ create: { width: cell, height: cell, channels: 3, background: '#222' } })
    .composite([...parts.map(([left, top]) => ({ input: img, left, top })), { input: label(basename(f).replace(/\.\w+$/, '')), left: 0, top: 0 }])
    .png().toBuffer();
}));
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#111' } })
  .composite(cells.map((input, i) => ({ input, left: (i % cols) * cell, top: Math.floor(i / cols) * cell })))
  .jpeg({ quality: 82 }).toFile(out);
console.log(out);
