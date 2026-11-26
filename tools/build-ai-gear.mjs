#!/usr/bin/env node
// Pixal3D hero gear (hats, helmets, masks) into the game: assets-src/ai/gear/<id>.glb (the Pixal3D model after
// `prepare_toy_model.py --tris 3000 --tex 512`, docs/local-ai-assets.md W5) → assets/gear/<id>.glb with the
// texture as JPEG. Fitting onto the head (size, position) happens in code: `AI_GEAR` in src/render/gear-ai.ts.
//
//   node tools/build-ai-gear.mjs [id ...]      (no id: every GLB in assets-src/ai/gear)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { mkdir, readdir } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'assets-src/ai/gear', OUT = 'assets/gear';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : (await readdir(SRC)).filter((f) => f.endsWith('.glb') && !f.endsWith('-pixal.glb')).map((f) => f.slice(0, -4));
await mkdir(OUT, { recursive: true });
for (const id of ids) {
  const d = await io.read(`${SRC}/${id}.glb`);
  // The game uses only the colour map (gear materials have no normal maps): drop the baked normal and roughness maps.
  for (const m of d.getRoot().listMaterials()) m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
  await d.transform(prune());
  for (const t of d.getRoot().listTextures()) {
    const img = await sharp(Buffer.from(t.getImage())).resize(512, 512, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
    t.setImage(img).setMimeType('image/jpeg');
  }
  await d.transform(weld(), dedup(), prune());
  // Drop loose bits (Pixal3D leaves stray fragments, e.g. beside the straw hat): keep connected parts with at least 3 % of the triangles.
  for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    if (!idx) continue;
    const n = p.getAttribute('POSITION').getCount(), parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
    const tri = idx.getArray();
    // UV seams split vertices: join vertices that share a position (to 0.1 mm) first.
    const pos = p.getAttribute('POSITION'), at = new Map(), v = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      pos.getElement(i, v);
      const key = v.map((x) => Math.round(x * 1e4)).join(',');
      const j = at.get(key);
      if (j === undefined) at.set(key, i); else parent[find(i)] = find(j);
    }
    for (let t = 0; t < tri.length; t += 3) { const a = find(tri[t]), b = find(tri[t + 1]), c = find(tri[t + 2]); parent[b] = a; parent[find(c)] = a; }
    const count = new Map();
    for (let t = 0; t < tri.length; t += 3) { const r = find(tri[t]); count.set(r, (count.get(r) ?? 0) + 1); }
    const min = 0.03 * (tri.length / 3);
    const kept = [];
    for (let t = 0; t < tri.length; t += 3) if (count.get(find(tri[t])) >= min) kept.push(tri[t], tri[t + 1], tri[t + 2]);
    if (kept.length < tri.length) { console.log(`${id}: dropped ${(tri.length - kept.length) / 3} loose triangles`); idx.setArray(new (tri.constructor)(kept)); }
  }
  await d.transform(prune());
  let tris = 0;
  for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await io.write(`${OUT}/${id}.glb`, d);
  const kb = Math.round((await (await import('node:fs/promises')).stat(`${OUT}/${id}.glb`)).size / 1024);
  console.log(`${id}: ${tris} triangles, ${kb} KB`);
}
