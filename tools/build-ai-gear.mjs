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
  let tris = 0;
  for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await io.write(`${OUT}/${id}.glb`, d);
  const kb = Math.round((await (await import('node:fs/promises')).stat(`${OUT}/${id}.glb`)).size / 1024);
  console.log(`${id}: ${tris} triangles, ${kb} KB`);
}
