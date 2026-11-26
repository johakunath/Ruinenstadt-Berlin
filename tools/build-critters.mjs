#!/usr/bin/env node
// P18 ambient animals: packs the three baked animals into `assets/critters/animals.glb` (docs/tasks/m11c-animals.md).
//
//   node tools/build-critters.mjs [--src assets-src/ai/p18-animals]
//
// Each source is a Pixal3D model from a FLUX.2 klein picture, prepared (`tools/comfy/prepare_toy_model.py`, facing
// glTF +Z) and baked low with a 256 px texture (`tools/blender/bake_low.py --remesh`): <src>/<kind>/<kind>-low.glb.
// The tool sizes each to its length, puts the origin at the bottom centre, moves its UVs into one quarter of a
// 512 px atlas (8 px border each, edge pixels copied out) and paints the fourth quarter in code: the spread pigeon
// wing that `src/render/critters.ts` draws while a pigeon flies. One material, one JPEG, three meshes by name.
import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { join } from 'node:path';

const argv = process.argv.slice(2), at = argv.indexOf('--src');
const SRC = at >= 0 ? argv[at + 1] : 'assets-src/ai/p18-animals';
const OUT = 'assets/critters/animals.glb';
const ATLAS = 512, CELL = 256, PAD = 8, INNER = CELL - 2 * PAD;

/** Length nose to tail in metres (about 1.3 × real, so they read from the game camera; `CRITTER.length` in critters.ts).
 * `look`: the bake's colour toward the muted game palette (`bake_low.py --tint` lifts it toward the bright FLUX picture). */
const ANIMALS = [
  { kind: 'duck', cell: [0, 0], length: 0.72, look: { saturation: 0.8, brightness: 0.9 } },
  { kind: 'pigeon', cell: [1, 0], length: 0.42, look: { saturation: 0.45, brightness: 0.75 } },
  { kind: 'rat', cell: [0, 1], length: 0.52, look: { saturation: 0.8, brightness: 1 } },
];
const WING_CELL = [1, 1];

const io = new NodeIO();
const out = new Document();
const buffer = out.createBuffer();
const scene = out.createScene('critters');
const material = out.createMaterial('critters').setRoughnessFactor(0.9).setMetallicFactor(0);
const layers = [];
let pigeonTone = [140, 150, 165];

for (const a of ANIMALS) {
  const src = await io.read(join(SRC, a.kind, `${a.kind}-low.glb`));
  const prim = src.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
  const n = P.getCount(), v = [0, 0, 0];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) { P.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
  const s = a.length / (hi[2] - lo[2]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    P.getElement(i, v);
    pos.set([(v[0] - cx) * s, (v[1] - lo[1]) * s, (v[2] - cz) * s], i * 3);
    N.getElement(i, v);
    nor.set(v, i * 3);
    const t = T.getElement(i, [0, 0]);
    uv.set([(a.cell[0] * CELL + PAD + t[0] * INNER) / ATLAS, (a.cell[1] * CELL + PAD + t[1] * INNER) / ATLAS], i * 2);
  }
  const mesh = out.createMesh(a.kind).addPrimitive(out.createPrimitive()
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(nor).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint16Array(I.getArray())).setBuffer(buffer))
    .setMaterial(material));
  scene.addChild(out.createNode(a.kind).setMesh(mesh));
  const img = await sharp(Buffer.from(src.getRoot().listTextures()[0].getImage())).modulate(a.look).png().toBuffer();
  const cell = await sharp(img).resize(INNER, INNER).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).png().toBuffer();
  layers.push({ input: cell, left: a.cell[0] * CELL, top: a.cell[1] * CELL });
  if (a.kind === 'pigeon') {
    // The wing takes the pigeon's own grey: the median of its baked (non-black) texels.
    const { data } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
    const px = [];
    for (let i = 0; i < data.length; i += 3) if (data[i] + data[i + 1] + data[i + 2] > 60) px.push([data[i], data[i + 1], data[i + 2]]);
    pigeonTone = [0, 1, 2].map((k) => px.map((p) => p[k]).sort((x, y) => x - y)[Math.floor(px.length / 2)]);
  }
  console.log(a.kind, 'triangles', I.getCount() / 3, 'size', ((hi[0] - lo[0]) * s).toFixed(2), ((hi[1] - lo[1]) * s).toFixed(2), a.length, 'm');
}

// Spread wing, root at the left (u 0) and tip at the right, leading edge at the top: the pigeon grey, two dark bars
// across the inner wing, darker primaries toward the tip and a dark trailing edge.
const [r, g, b] = pigeonTone, rgb = (k) => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
const W = CELL;
const feathers = Array.from({ length: 14 }, (_, i) => {
  const x = 30 + i * 16;
  return `<line x1="${x}" y1="${W * 0.35}" x2="${x + 10}" y2="${W}" stroke="${rgb(0.55)}" stroke-width="2" opacity="0.5"/>`;
}).join('');
const wing = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">
  <defs><linearGradient id="tip" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${rgb(1.4)}"/><stop offset="0.5" stop-color="${rgb(1.25)}"/><stop offset="0.75" stop-color="${rgb(0.85)}"/><stop offset="1" stop-color="${rgb(0.6)}"/>
  </linearGradient>
  <linearGradient id="edge" x1="0" x2="0" y1="0" y2="1"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient></defs>
  <rect width="${W}" height="${W}" fill="url(#tip)"/>
  ${feathers}
  <rect x="0" y="${W * 0.52}" width="${W * 0.5}" height="${W * 0.07}" fill="${rgb(0.35)}"/>
  <rect x="0" y="${W * 0.68}" width="${W * 0.46}" height="${W * 0.07}" fill="${rgb(0.35)}"/>
  <rect width="${W}" height="${W}" fill="url(#edge)"/>
</svg>`;
layers.push({ input: await sharp(Buffer.from(wing)).png().toBuffer(), left: WING_CELL[0] * CELL, top: WING_CELL[1] * CELL });

const atlas = await sharp({ create: { width: ATLAS, height: ATLAS, channels: 3, background: '#808080' } }).composite(layers).jpeg({ quality: 88 }).toBuffer();
const tex = out.createTexture('critters').setImage(atlas).setMimeType('image/jpeg');
material.setBaseColorTexture(tex);
await io.write(OUT, out);
await sharp(atlas).toFile(join(SRC, 'atlas.png'));
console.log(OUT, (atlas.length / 1024).toFixed(0), 'KB atlas');
