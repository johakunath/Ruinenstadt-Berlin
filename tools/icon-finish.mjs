#!/usr/bin/env node
// Turns a cut-out PNG (tools/comfy.mjs --cutout 1) into an inventory icon: trims the transparent border, fits the
// object into 122 px and centres it on 128 x 128 like the painted icons (docs/local-ai-assets.md).
//   node tools/icon-finish.mjs <cutout.png> assets/inventory/I95.webp
import sharp from 'sharp';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('usage: icon-finish.mjs <cutout.png> <out.webp>');
const obj = await sharp(src).trim({ threshold: 10 }).resize(122, 122, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer({ resolveWithObject: true });
await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: obj.data, left: Math.round((128 - obj.info.width) / 2), top: Math.round((128 - obj.info.height) / 2) }])
  .webp({ quality: 90, alphaQuality: 100 }).toFile(out);
console.log(out, obj.info.width, 'x', obj.info.height);
