// WP4 step 3 (P10): builds assets/props/pickups.glb, the 20 ground pickup models (src/data/pickups.ts).
//   node tools/pickup-models.mjs export   dev server running (PORT): the reused source meshes (weapon models, hero wear
//                                          and gear, tools/pickup-sheet.html?mode=export) → <src>/reused.json
//   node tools/pickup-models.mjs build    reused.json + the baked Pixal3D props (<src>/low/<id>.glb, tools/blender/bake_low.py)
//                                          → one GLB: a node and mesh per model, one material, one atlas texture
// <src> is SRC or assets-src/ai/p10-pickups (not committed). Every model lies or stands on y = 0, centred on x and z,
// its longest side `size` metres (pickups are drawn bigger than life so they read at the game camera).
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.env.SRC ?? 'assets-src/ai/p10-pickups';
const OUT = 'assets/props/pickups.glb';
const [stage = 'build'] = process.argv.slice(2);

/**
 * Per model: `reused` key in reused.json (else the Pixal3D bake `low/<id>.glb`), pose (Euler degrees XYZ, applied
 * before fitting), longest side in m, triangle target (reused models are simplified to it; D3: about 160, at most 400).
 * Weapons lie flat (model +Y, the tip, along −Z; the blade's face up).
 */
const MODELS = {
  blade: { reused: 'blade-stahl', rot: [-90, 0, 0], size: 0.82, tris: 180, across: 1.5 },
  hammer: { reused: 'hammer', rot: [-90, 0, 0], size: 0.78, tris: 220 },
  sling: { reused: 'sling', rot: [-90, 0, 0], size: 0.5, tris: 240, across: 1.2 },
  spear: { reused: 'spear', rot: [-90, 0, 0], size: 1.0, tris: 200, across: 2.2 },
  // The vest of the Schutzweste (hero piece `a_weste`, above the belt), standing; the Bauhelm (gear `hat-hard`);
  // the left Arbeitshandschuh flat (hero piece `g_handsch`); the left Turnschuh (`f_turnsch` and its stripes), toe sideways.
  armor: { reused: 'armor', rot: [0, 0, 0], size: 0.64, tris: 360 },
  head: { reused: 'head', rot: [0, 0, 0], size: 0.46, tris: 240 },
  hands: { reused: 'hands', rot: [0, 0, 0], size: 0.42, tris: 260 },
  feet: { reused: 'feet-turnsch', rot: [0, 90, 0], size: 0.44, tris: 260 },
  // Pixal3D props from the FLUX pictures (three-quarter view, standing as drawn).
  talisman: { rot: [-65, 0, 0], size: 0.56 },
  ring: { rot: [-55, 0, 0], size: 0.32 },
  implant: { rot: [0, 0, 0], size: 0.36 },
  heal: { rot: [0, 0, 0], size: 0.36 },
  food: { rot: [0, 0, 0], size: 0.42 },
  stoff: { rot: [0, 0, 0], size: 0.4 },
  metall: { rot: [0, 0, 0], size: 0.4 },
  // Code stand-ins until their Pixal3D run (ComfyUI went down on 2026-11-26): drop `reused` once low/<id>.glb is baked.
  chemie: { reused: 'chemie-code', rot: [0, 0, 0], size: 0.38, tris: 400 },
  kabel: { reused: 'kabel-code', rot: [0, 0, 0], size: 0.4, tris: 400 },
  fleisch: { reused: 'fleisch-code', rot: [0, 0, 0], size: 0.38, tris: 400 },
  gemuese: { reused: 'gemuese-code', rot: [0, 0, 0], size: 0.42, tris: 400 },
  gewuerz: { reused: 'gewuerz-code', rot: [0, 0, 0], size: 0.38, tris: 400 },
};
// Overrides while trying alternatives: ALT=hands:hands-box,armor:armor-plate
for (const pair of (process.env.ALT ?? '').split(',').filter(Boolean)) { const [id, key] = pair.split(':'); MODELS[id].reused = key; }

/** Atlas: 4 × 4 cells of 256 px; the last cell is white (the reused models carry their colour in the vertices). */
const ATLAS = 1024, CELL = 256, PAD = 6, WHITE = 15;

if (stage === 'sheet') {
  // node tools/pickup-models.mjs sheet pickups.png "pickup=A&rarity=0"   (dev server running)
  const [, out = 'pickups.png', query = ''] = process.argv.slice(2);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/pickup-sheet.html?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 300000 });
  await (await page.$('#wrap')).screenshot({ path: out });
  await browser.close();
  console.log(out);
} else if (stage === 'low') {
  // node tools/pickup-models.mjs low <id> [tris]: the low mesh for the bake (bake_low.py --low). A Pixal3D surface with
  // open seams stalls Blender's decimate near 9,000 triangles; meshoptimizer welds by position and gets to the target.
  const [, id, trisArg = '380'] = process.argv.slice(2);
  const { Document, NodeIO } = await import('@gltf-transform/core');
  const { MeshoptSimplifier } = await import('meshoptimizer');
  await MeshoptSimplifier.ready;
  const io = new NodeIO();
  const src = await io.read(path.join(SRC, 'mid', `${id}.glb`));
  const P = [], idx = [], keyOf = new Map();
  for (const node of src.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), ind = prim.getIndices().getArray(), local = [];
      for (let i = 0; i < pos.getCount(); i++) {
        const [x, y, z] = pos.getElement(i, []);
        const w = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
        const key = w.map((v) => Math.round(v * 2e4)).join(',');
        let k = keyOf.get(key);
        if (k === undefined) { k = P.length / 3; keyOf.set(key, k); P.push(...w); }
        local.push(k);
      }
      for (const i of ind) idx.push(local[i]);
    }
  }
  const target = Number(trisArg) * 3, positions = new Float32Array(P);
  let [out] = MeshoptSimplifier.simplify(new Uint32Array(idx), positions, 3, target, 1, ['Permissive', 'Prune']);
  if (out.length > target * 1.15) [out] = MeshoptSimplifier.simplifySloppy(new Uint32Array(idx), positions, 3, null, target, 1);
  const doc = new Document(), buffer = doc.createBuffer();
  const used = [...new Set(out)], re = new Map(used.map((v, i) => [v, i]));
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(used.flatMap((v) => P.slice(v * 3, v * 3 + 3)))).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(Array.from(out, (v) => re.get(v)))).setBuffer(buffer));
  doc.createScene().addChild(doc.createNode(`${id}-low`).setMesh(doc.createMesh(`${id}-low`).addPrimitive(prim)));
  await io.write(path.join(SRC, 'mid', `${id}-low.glb`), doc);
  console.log(`${id}: ${idx.length / 3} → ${out.length / 3} triangles`);
} else if (stage === 'export') {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${process.env.PORT ?? 5173}/tools/pickup-sheet.html?mode=export`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.title.startsWith('done'), null, { timeout: 300000 });
  const src = await page.evaluate(() => window.__src);
  await browser.close();
  fs.mkdirSync(SRC, { recursive: true });
  fs.writeFileSync(path.join(SRC, 'reused.json'), JSON.stringify(src));
  for (const [id, m] of Object.entries(src)) console.log(id, m.pos.length / 9, 'tris');
} else {
  const { Document, NodeIO } = await import('@gltf-transform/core');
  const { EXTTextureWebP } = await import('@gltf-transform/extensions');
  const { MeshoptSimplifier } = await import('meshoptimizer');
  const sharp = (await import('sharp')).default;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions([EXTTextureWebP]);
  const reused = JSON.parse(fs.readFileSync(path.join(SRC, 'reused.json'), 'utf8'));

  /** Euler XYZ (degrees) as a 3 × 3 matrix (three.js order: R = Rx · Ry · Rz applied as Rz first… kept simple: X, then Y, then Z). */
  const rotate = (v, [ax, ay, az]) => {
    let [x, y, z] = v;
    const r = (d) => (d * Math.PI) / 180;
    if (ax) { const c = Math.cos(r(ax)), s = Math.sin(r(ax)); [y, z] = [y * c - z * s, y * s + z * c]; }
    if (ay) { const c = Math.cos(r(ay)), s = Math.sin(r(ay)); [x, z] = [x * c + z * s, -x * s + z * c]; }
    if (az) { const c = Math.cos(r(az)), s = Math.sin(r(az)); [x, y] = [x * c - y * s, x * s + y * c]; }
    return [x, y, z];
  };

  /** Welds identical corners of a triangle soup (position, normal, colour) into an indexed mesh. */
  function weld(pos, nor, col) {
    const map = new Map(), P = [], N = [], C = [], idx = [];
    for (let i = 0; i < pos.length / 3; i++) {
      const key = [...pos.slice(i * 3, i * 3 + 3), ...nor.slice(i * 3, i * 3 + 3), ...col.slice(i * 3, i * 3 + 3)].map((v) => v.toFixed(4)).join(',');
      let k = map.get(key);
      if (k === undefined) { k = P.length / 3; map.set(key, k); P.push(...pos.slice(i * 3, i * 3 + 3)); N.push(...nor.slice(i * 3, i * 3 + 3)); C.push(...col.slice(i * 3, i * 3 + 3)); }
      idx.push(k);
    }
    return { P, N, C, idx };
  }

  /** Simplifies to about `tris` triangles, keeping normals and colours; drops unused vertices. */
  function simplify(m, tris) {
    if (m.idx.length / 3 <= tris) return m;
    const positions = new Float32Array(m.P), attrs = new Float32Array(m.P.length / 3 * 6);
    for (let i = 0; i < m.P.length / 3; i++) attrs.set([...m.N.slice(i * 3, i * 3 + 3), ...m.C.slice(i * 3, i * 3 + 3)], i * 6);
    const [idx] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(m.idx), positions, 3, attrs, 6, [0.4, 0.4, 0.4, 1, 1, 1], null, tris * 3, 0.05, ['Permissive', 'Prune']);
    const remap = new Map(), out = { P: [], N: [], C: [], idx: [] };
    for (const v of idx) {
      let k = remap.get(v);
      if (k === undefined) { k = out.P.length / 3; remap.set(v, k); out.P.push(...m.P.slice(v * 3, v * 3 + 3)); out.N.push(...m.N.slice(v * 3, v * 3 + 3)); out.C.push(...m.C.slice(v * 3, v * 3 + 3)); }
      out.idx.push(k);
    }
    return out;
  }

  /**
   * Poses and fits a model: rotation, longest side `size`, centred on x and z, standing on y = 0. `across` thickens a
   * lying weapon (x and y, not its length along z), as the icons draw long weapons thicker so they still read.
   */
  function fit(m, rot, size, across = 1) {
    const P = [], N = [];
    for (let i = 0; i < m.P.length / 3; i++) {
      const [x, y, z] = rotate(m.P.slice(i * 3, i * 3 + 3), rot), [a, b, c] = rotate(m.N.slice(i * 3, i * 3 + 3), rot);
      P.push(x * across, y * across, z);
      N.push(a / across, b / across, c);
    }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], P[i]); hi[i % 3] = Math.max(hi[i % 3], P[i]); }
    const k = size / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    const o = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
    for (let i = 0; i < P.length; i++) P[i] = (P[i] - o[i % 3]) * k;
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    return { ...m, P, N, dims: [0, 1, 2].map((a) => +((hi[a] - lo[a]) * k).toFixed(3)) };
  }

  /** The first primitive of a baked GLB: indexed positions, normals, UVs, and its colour texture. */
  async function readBaked(file) {
    const doc = await io.read(file);
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const node = doc.getRoot().listNodes().find((n) => n.getMesh());
    const mat = node.getWorldMatrix();
    const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0');
    const P = [], N = [], U = [];
    for (let i = 0; i < pos.getCount(); i++) {
      const [x, y, z] = pos.getElement(i, []);
      P.push(mat[0] * x + mat[4] * y + mat[8] * z + mat[12], mat[1] * x + mat[5] * y + mat[9] * z + mat[13], mat[2] * x + mat[6] * y + mat[10] * z + mat[14]);
      const [a, b, c] = nor.getElement(i, []);
      N.push(mat[0] * a + mat[4] * b + mat[8] * c, mat[1] * a + mat[5] * b + mat[9] * c, mat[2] * a + mat[6] * b + mat[10] * c);
      U.push(...uv.getElement(i, []));
    }
    const idx = Array.from(prim.getIndices().getArray());
    const image = prim.getMaterial().getBaseColorTexture().getImage();
    return { P, N, U, C: new Array(P.length).fill(1), idx, image };
  }

  const cells = [], built = {};
  let cell = 0;
  for (const [id, spec] of Object.entries(MODELS)) {
    let m;
    if (spec.reused) {
      const s = reused[spec.reused];
      if (!s) throw new Error(`reused.json has no ${spec.reused}`);
      m = simplify(weld(s.pos, s.nor, s.col), spec.tris);
      // White cell centre: the vertex colour is the whole paint.
      const u = ((WHITE % 4) + 0.5) / 4, v = (Math.floor(WHITE / 4) + 0.5) / 4;
      m.U = []; for (let i = 0; i < m.P.length / 3; i++) m.U.push(u, v);
    } else {
      const file = path.join(SRC, 'low', `${id}.glb`);
      if (!fs.existsSync(file)) { console.log(`${id}: no ${file}, left out`); continue; }
      m = await readBaked(file);
      const cx = cell % 4, cy = Math.floor(cell / 4);
      // UVs into the cell (glTF v runs down the image, as the atlas rows do).
      m.U = m.U.map((t, i) => ((i % 2 === 0 ? cx : cy) * CELL + PAD + Math.min(1, Math.max(0, t)) * (CELL - 2 * PAD)) / ATLAS);
      cells.push({ input: await sharp(Buffer.from(m.image)).resize(CELL - 2 * PAD, CELL - 2 * PAD).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).png().toBuffer(), left: cx * CELL, top: cy * CELL });
      cell++;
      if (cell === WHITE) throw new Error('atlas full');
    }
    built[id] = fit(m, spec.rot, spec.size, spec.across);
  }
  cells.push({ input: await sharp({ create: { width: CELL, height: CELL, channels: 3, background: '#ffffff' } }).png().toBuffer(), left: (WHITE % 4) * CELL, top: Math.floor(WHITE / 4) * CELL });
  const atlas = await sharp({ create: { width: ATLAS, height: ATLAS, channels: 3, background: '#808080' } }).composite(cells).webp({ quality: 86 }).toBuffer();
  fs.writeFileSync(path.join(SRC, 'atlas.webp'), atlas);

  const doc = new Document();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const buffer = doc.createBuffer();
  const tex = doc.createTexture('pickups').setImage(atlas).setMimeType('image/webp').setURI('pickups.webp');
  const material = doc.createMaterial('pickup').setBaseColorTexture(tex).setRoughnessFactor(0.72).setMetallicFactor(0);
  const scene = doc.createScene('pickups');
  for (const [id, m] of Object.entries(built)) {
    const acc = (type, arr, T = Float32Array) => doc.createAccessor().setType(type).setArray(new T(arr)).setBuffer(buffer);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', acc('VEC3', m.P))
      .setAttribute('NORMAL', acc('VEC3', m.N))
      .setAttribute('TEXCOORD_0', acc('VEC2', m.U))
      .setAttribute('COLOR_0', acc('VEC3', m.C))
      .setIndices(acc('SCALAR', m.idx, Uint16Array))
      .setMaterial(material);
    scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)));
    console.log(`${id.padEnd(9)} ${String(m.idx.length / 3).padStart(4)} tris  ${m.dims.join(' × ')} m${MODELS[id].reused ? `  ${MODELS[id].reused.endsWith('-code') ? 'code' : 'reused'} ${MODELS[id].reused}` : '  Pixal3D'}`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await io.write(OUT, doc);
  console.log(OUT, fs.statSync(OUT).size, 'bytes; atlas', atlas.length, 'bytes');
}
