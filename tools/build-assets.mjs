// Builds the game character files in assets/characters/ from the CC0 source packs in assets-src/
// (not committed; fetch them with tools/fetch-assets.sh). See assets/LICENSES.md.
//
//   hero.glb    Superhero_Female body, dressed in code toward the style bible hero:
//               painted clothing regions, coat skirt, belt, red scarf, dark hair.
//   zombie.glb  Superhero_Male body, simplified, grey-green skin, rags.
//   anims.glb   Skeleton plus the clips the game uses from Universal Animation Library 1 and 2.
//
// Gate 2 replaces hero.glb with a custom character on the same skeleton and clip names.
import { NodeIO } from '@gltf-transform/core';
import { dedup, mergeDocuments, prune, resample, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets-src';
const OUT = 'assets/characters';
const io = new NodeIO();

const CLIPS = {
  'UAL1_Standard.glb': ['Idle_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Roll', 'Hit_Chest', 'Death01', 'Sword_Idle',
    // M7/M8/M16: spear thrusts, casts, leaps, interactions.
    'Punch_Jab', 'Punch_Cross', 'Sword_Attack', 'Spell_Simple_Shoot', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Interact',
    // H1: hammer standing pose (both hands on the handle, left hand by IK).
    'Pistol_Idle_Loop'],
  'UAL2_Standard.glb': [
    'Sword_Regular_A', 'Sword_Regular_A_Rec', 'Sword_Regular_B', 'Sword_Regular_B_Rec', 'Sword_Regular_C', 'Sword_Dash',
    'Zombie_Idle_Loop', 'Zombie_Walk_Fwd_Loop', 'Zombie_Scratch', 'Hit_Knockback',
    // M7/M8/M16: hammer swings, throws, guard, consumables.
    'Sword_Heavy_Combo', 'Sword_Regular_Combo', 'TreeChopping_Loop', 'OverhandThrow', 'Sword_Block', 'Consume',
    'NinjaJump_Start', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'Shield_Dash', 'Melee_Hook', 'Idle_Shield_Loop', 'Chest_Open',
  ],
};

// ---------------------------------------------------------------- helpers

/** Reads a .gltf whose image file names do not all exist (the pack has a few broken references). */
async function readGltf(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dir = path.dirname(file);
  const resources = {};
  for (const b of json.buffers ?? []) resources[b.uri] = fs.readFileSync(path.join(dir, decodeURIComponent(b.uri)));
  for (const im of json.images ?? []) {
    if (!im.uri) continue;
    let p = path.join(dir, decodeURIComponent(im.uri));
    if (!fs.existsSync(p)) p = p.replace('_png.png', '.png');
    resources[im.uri] = fs.readFileSync(p);
  }
  return io.readJSON({ json, resources });
}

const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
};

/** Cheap position hash in 0..1 for painterly variation. */
const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

function jointIndex(skin) {
  const map = new Map();
  skin.listJoints().forEach((j, i) => map.set(j.getName(), i));
  return map;
}

function jointPos(skin, name) {
  const j = skin.listJoints().find((n) => n.getName() === name);
  const m = j.getWorldMatrix();
  return [m[12], m[13], m[14]];
}

/** Keeps POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0 only. */
function stripAttributes(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of prim.listSemantics()) {
        if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'].includes(sem)) prim.setAttribute(sem, null);
      }
    }
  }
}

/** Base color only, resized and re-encoded. Normal and roughness maps are dropped (small on screen). */
async function slimMaterials(doc, size, recolor) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);
    mat.setMetallicFactor(0).setRoughnessFactor(0.8);
    const tex = mat.getBaseColorTexture();
    if (!tex) continue;
    const isBody = /Superhero/i.test(mat.getName());
    let img = sharp(Buffer.from(tex.getImage())).resize(isBody ? size : 256, isBody ? size : 256);
    if (isBody && recolor) img = await recolor(img, size);
    const hasAlpha = (await sharp(Buffer.from(tex.getImage())).metadata()).hasAlpha;
    if (hasAlpha) tex.setImage(await img.png({ compressionLevel: 9 }).toBuffer()).setMimeType('image/png');
    else tex.setImage(await img.jpeg({ quality: 86 }).toBuffer()).setMimeType('image/jpeg');
  }
}

function newPrimitive(doc, mesh, material, data) {
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setMaterial(material)
    .setIndices(acc('SCALAR', new Uint16Array(data.indices)))
    .setAttribute('POSITION', acc('VEC3', new Float32Array(data.positions)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(data.normals)))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(data.joints)))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(data.weights)));
  if (data.colors) prim.setAttribute('COLOR_0', acc('VEC3', new Float32Array(data.colors)));
  mesh.addPrimitive(prim);
  return prim;
}

/** Collects skinned geometry (positions, flat normals from triangles, colors, up to 4 joint weights). */
class Builder {
  constructor(joints) {
    this.j = joints;
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.joints = [];
    this.weights = [];
    this.indices = [];
  }
  /** `w` is a list of [jointName, weight]. */
  vertex(p, n, color, w) {
    const total = w.reduce((s, [, v]) => s + v, 0);
    const list = w.filter(([, v]) => v > 0.001).slice(0, 4);
    this.positions.push(...p);
    this.normals.push(...n);
    this.colors.push(...color);
    for (let i = 0; i < 4; i++) {
      this.joints.push(list[i] ? this.j.get(list[i][0]) : 0);
      this.weights.push(list[i] ? list[i][1] / total : 0);
    }
    return this.positions.length / 3 - 1;
  }
  quad(a, b, c, d) {
    this.indices.push(a, b, c, a, c, d);
  }
  /** Axis-aligned box, all vertices on one weight set. */
  box(center, half, color, w) {
    const [cx, cy, cz] = center;
    const [hx, hy, hz] = half;
    const faces = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
      [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
    ];
    for (const [n, u, v] of faces) {
      const corner = (su, sv) => [
        cx + (n[0] + u[0] * su + v[0] * sv) * hx,
        cy + (n[1] + u[1] * su + v[1] * sv) * hy,
        cz + (n[2] + u[2] * su + v[2] * sv) * hz,
      ];
      const i0 = this.vertex(corner(-1, -1), n, color, w);
      const i1 = this.vertex(corner(1, -1), n, color, w);
      const i2 = this.vertex(corner(1, 1), n, color, w);
      const i3 = this.vertex(corner(-1, 1), n, color, w);
      this.quad(i0, i1, i2, i3);
    }
  }
}

/** Dominant joint name per vertex of a skinned primitive. */
function dominantJoints(prim, skin) {
  const names = skin.listJoints().map((j) => j.getName());
  const J = prim.getAttribute('JOINTS_0');
  const W = prim.getAttribute('WEIGHTS_0');
  const out = [];
  const j = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  for (let i = 0; i < J.getCount(); i++) {
    J.getElement(i, j);
    W.getElement(i, w);
    let best = 0;
    for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
    out.push(names[j[best]]);
  }
  return out;
}

/**
 * Splits the body primitive: triangles whose vertices all have a cloth color go to a second
 * primitive that uses vertex colors instead of the skin texture. `paint(joint, x, y, z)` returns
 * { color: '#hex' | null, grow: meters } per vertex.
 */
function dress(doc, mesh, prim, skin, paint) {
  const dom = dominantJoints(prim, skin);
  const P = prim.getAttribute('POSITION');
  const N = prim.getAttribute('NORMAL');
  const count = P.getCount();
  const colors = new Float32Array(count * 3).fill(1);
  const cloth = new Uint8Array(count);
  const p = [0, 0, 0];
  const n = [0, 0, 0];
  const grown = new Float32Array(P.getArray());
  for (let i = 0; i < count; i++) {
    P.getElement(i, p);
    N.getElement(i, n);
    const r = paint(dom[i], p[0], p[1], p[2]);
    if (!r.color) continue;
    cloth[i] = 1;
    const c = srgb(r.color);
    const v = 0.82 + 0.36 * hash(Math.round(p[0] * 14), Math.round(p[1] * 14), Math.round(p[2] * 14));
    colors.set([c[0] * v, c[1] * v, c[2] * v], i * 3);
    grown.set([p[0] + n[0] * r.grow, p[1] + n[1] * r.grow, p[2] + n[2] * r.grow], i * 3);
  }
  const idx = prim.getIndices().getArray();
  const skinIdx = [];
  const clothIdx = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    (cloth[a] && cloth[b] && cloth[c] ? clothIdx : skinIdx).push(a, b, c);
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const Index = count > 65535 ? Uint32Array : Uint16Array;
  // Cloth gets its own grown positions; skin keeps the original ones.
  const clothMat = doc.createMaterial('cloth').setRoughnessFactor(0.85).setMetallicFactor(0);
  const clothPrim = prim.clone().setMaterial(clothMat);
  clothPrim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(grown).setBuffer(buffer));
  clothPrim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(colors).setBuffer(buffer));
  clothPrim.setAttribute('TEXCOORD_0', null);
  clothPrim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Index(clothIdx)).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Index(skinIdx)).setBuffer(buffer));
  mesh.addPrimitive(clothPrim);
  return clothMat;
}

/** Body cross-section (center and radii) at height y, from torso and leg vertices. */
function sectionAt(prim, dom, y, band = 0.035) {
  const P = prim.getAttribute('POSITION');
  const p = [0, 0, 0];
  let maxX = 0;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < P.getCount(); i++) {
    if (!/pelvis|spine|thigh|calf/.test(dom[i])) continue;
    P.getElement(i, p);
    if (Math.abs(p[1] - y) > band) continue;
    maxX = Math.max(maxX, Math.abs(p[0]));
    minZ = Math.min(minZ, p[2]);
    maxZ = Math.max(maxZ, p[2]);
  }
  return { cz: (minZ + maxZ) / 2, rx: maxX, rz: (maxZ - minZ) / 2 };
}

// ---------------------------------------------------------------- hero

async function buildHero() {
  const doc = await readGltf(`${SRC}/body/Superhero_Female_FullBody.gltf`);
  stripAttributes(doc);
  await slimMaterials(doc, 1024);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const J = jointIndex(skin);
  const bodyNode = root.listNodes().find((n) => n.getName() === 'Superhero_Female');
  const mesh = bodyNode.getMesh();
  const body = mesh.listPrimitives()[0];
  const dom = dominantJoints(body, skin);

  const COAT = '#8a5c33';
  const TROUSERS = '#3d3a36';
  const BOOTS = '#2a1f17';
  const SHIRT = '#b3a283';
  const WRAP = '#c2b08e';
  const LEATHER = '#4a2f1a';
  const BRASS = '#c9973a';
  const SCARF = '#d22c1e';

  // Section radii must be sampled before the cloth grows.
  const waistY = jointPos(skin, 'spine_01')[1] - 0.01;
  const hemY = 0.4;
  const rows = 7;
  const sections = [];
  for (let r = 0; r < rows; r++) sections.push(sectionAt(body, dom, waistY + ((hemY - waistY) * r) / (rows - 1)));

  dress(doc, mesh, body, skin, (joint, x, y, z) => {
    if (/^(Head|neck)/.test(joint) || /index|middle|ring|pinky|thumb/.test(joint)) return { color: null, grow: 0 };
    if (/^hand/.test(joint)) return { color: LEATHER, grow: 0.004 };
    if (/^(foot|ball)/.test(joint) || (/^calf/.test(joint) && y < 0.36)) return { color: BOOTS, grow: 0.014 };
    if (/^(pelvis|thigh|calf)/.test(joint)) return { color: TROUSERS, grow: 0.007 };
    if (/^lowerarm/.test(joint) && Math.abs(x) > 0.52) return { color: WRAP, grow: 0.006 };
    // Open collar: a strip of shirt on the upper chest.
    if (/^(spine_03|clavicle)/.test(joint) && z > 0.03 && Math.abs(x) < 0.06) return { color: SHIRT, grow: 0.008 };
    return { color: COAT, grow: /arm/.test(joint) ? 0.012 : 0.018 };
  });

  // --- coat skirt: an open-front tube from the waist to a torn hem, weighted to pelvis and thighs.
  const coatMat = doc.createMaterial('coat').setRoughnessFactor(0.8).setMetallicFactor(0).setDoubleSided(true);
  const coat = new Builder(J);
  const cols = 22;
  const gap = 0.42; // half opening angle at the front
  const coatColor = srgb(COAT);
  let prevRx = 0;
  let prevRz = 0;
  const ring = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const s = sections[r];
    const off = 0.03 + 0.07 * t;
    const rx = Math.max(prevRx + 0.006, s.rx + off);
    const rz = Math.max(prevRz + 0.006, s.rz + off);
    prevRx = rx;
    prevRz = rz;
    const row = [];
    for (let c = 0; c <= cols; c++) {
      const phi = gap + ((Math.PI * 2 - gap * 2) * c) / cols;
      const sx = Math.sin(phi);
      const cz = Math.cos(phi);
      const x = sx * rx;
      let y = waistY + (hemY - waistY) * t;
      if (r === rows - 1) y += (hash(c, 3, 7) - 0.3) * 0.09; // torn hem
      const z = s.cz + cz * rz;
      const left = Math.min(1, Math.max(0, 0.5 + x / 0.16));
      const leg = 0.78 * Math.pow(t, 0.8);
      const shade = (0.72 + 0.4 * hash(c, r, 1)) * (1 - 0.25 * t);
      row.push(
        coat.vertex([x, y, z], [sx, 0.15, cz], coatColor.map((v) => v * shade), [
          ['pelvis', (1 - leg) * (r === 0 ? 0.5 : 1)],
          ['spine_01', r === 0 ? 0.5 : 0],
          ['thigh_l', leg * left],
          ['thigh_r', leg * (1 - left)],
        ]),
      );
    }
    ring.push(row);
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) coat.quad(ring[r][c], ring[r + 1][c], ring[r + 1][c + 1], ring[r][c + 1]);
  newPrimitive(doc, mesh, coatMat, coat);

  // --- belt, buckle, pouches.
  const gearMat = doc.createMaterial('gear').setRoughnessFactor(0.6).setMetallicFactor(0);
  const gear = new Builder(J);
  const belt = sections[0];
  const beltW = [['pelvis', 0.5], ['spine_01', 0.5]];
  const beltRing = [[], []];
  for (let c = 0; c <= 24; c++) {
    const phi = (Math.PI * 2 * c) / 24;
    const sx = Math.sin(phi);
    const cz = Math.cos(phi);
    for (let k = 0; k < 2; k++) {
      beltRing[k].push(
        gear.vertex([sx * (belt.rx + 0.04), waistY + 0.03 - k * 0.055, belt.cz + cz * (belt.rz + 0.04)], [sx, 0, cz], srgb(LEATHER).map((v) => v * (0.8 + 0.4 * hash(c, k, 9))), beltW),
      );
    }
  }
  for (let c = 0; c < 24; c++) gear.quad(beltRing[0][c], beltRing[1][c], beltRing[1][c + 1], beltRing[0][c + 1]);
  gear.box([0, waistY, belt.cz + belt.rz + 0.045], [0.03, 0.028, 0.008], srgb(BRASS), beltW);
  for (const side of [-1, 1]) {
    gear.box([side * (belt.rx + 0.06), waistY - 0.07, belt.cz - 0.01], [0.028, 0.06, 0.05], srgb('#5d3e22'), [['pelvis', 1]]);
    gear.box([side * (belt.rx + 0.09), waistY - 0.05, belt.cz - 0.01], [0.006, 0.012, 0.012], srgb(BRASS), [['pelvis', 1]]);
  }
  newPrimitive(doc, mesh, gearMat, gear);

  // --- scarf: a ring around the neck plus a tail on two extra bones that the game animates.
  const neck = jointPos(skin, 'neck_01');
  const spine3 = skin.listJoints().find((n) => n.getName() === 'spine_03');
  const s3 = jointPos(skin, 'spine_03');
  const tailRoot = [0.05, neck[1] - 0.005, neck[2] - 0.085];
  const segLen = 0.2;
  const scarfBones = [];
  // The skeleton is Z-up below `root`, so the first scarf bone undoes its parent's rotation:
  // scarf bones are world-aligned in the bind pose (local X = sideways, Y = up, Z = forward).
  const q = spine3.getWorldRotation();
  const inv = [-q[0], -q[1], -q[2], q[3]];
  let parent = spine3;
  let parentPos = s3;
  for (let i = 0; i < 3; i++) {
    const pos = [tailRoot[0], tailRoot[1] - segLen * i, tailRoot[2] - 0.03 * i];
    const delta = [pos[0] - parentPos[0], pos[1] - parentPos[1], pos[2] - parentPos[2]];
    const bone = doc.createNode(`scarf_0${i + 1}`);
    if (i === 0) bone.setTranslation(rotate(inv, delta)).setRotation(inv);
    else bone.setTranslation(delta);
    parent.addChild(bone);
    skin.addJoint(bone);
    scarfBones.push(bone);
    parent = bone;
    parentPos = pos;
  }
  // Inverse bind matrices for the new joints.
  const ibm = skin.getInverseBindMatrices();
  const old = ibm.getArray();
  const next = new Float32Array(old.length + 16 * scarfBones.length);
  next.set(old);
  scarfBones.forEach((bone, i) => {
    const m = bone.getWorldMatrix();
    next.set(invertRigid(m), old.length + i * 16);
  });
  ibm.setArray(next);
  const J2 = jointIndex(skin);

  const scarfMat = doc.createMaterial('scarf').setRoughnessFactor(0.9).setMetallicFactor(0).setDoubleSided(true);
  const scarf = new Builder(J2);
  const red = srgb(SCARF);
  const ringR = 0.088;
  const tube = 0.042;
  const segs = 16;
  const sides = 8;
  const torus = [];
  for (let a = 0; a <= segs; a++) {
    const phi = (Math.PI * 2 * a) / segs;
    const row = [];
    // The ring sits lower at the front, like a wrapped scarf.
    const cy = neck[1] - 0.012 - 0.03 * Math.cos(phi);
    for (let b = 0; b <= sides; b++) {
      const th = (Math.PI * 2 * b) / sides;
      const rr = ringR + Math.cos(th) * tube;
      const nx = Math.sin(phi) * Math.cos(th);
      const nz = Math.cos(phi) * Math.cos(th);
      const shade = 0.75 + 0.45 * hash(a, b, 4);
      row.push(
        scarf.vertex([Math.sin(phi) * rr, cy + Math.sin(th) * tube * 0.85, neck[2] + 0.03 + Math.cos(phi) * rr], [nx, Math.sin(th), nz], red.map((v) => v * shade), [
          ['neck_01', 0.45],
          ['spine_03', 0.55],
        ]),
      );
    }
    torus.push(row);
  }
  for (let a = 0; a < segs; a++) for (let b = 0; b < sides; b++) scarf.quad(torus[a][b], torus[a + 1][b], torus[a + 1][b + 1], torus[a][b + 1]);
  // Tail: a strip hanging down the back, one bone per segment pair.
  const tailW = 0.055;
  const strip = [];
  const tailRows = 7;
  for (let r = 0; r < tailRows; r++) {
    const t = r / (tailRows - 1);
    const y = tailRoot[1] + 0.02 - t * segLen * 3;
    const z = tailRoot[2] - 0.03 * t * 3;
    const bone = Math.min(2, Math.floor(t * 3));
    const frac = t * 3 - bone;
    const w = [[`scarf_0${bone + 1}`, 1 - frac * 0.5]];
    if (bone < 2) w.push([`scarf_0${bone + 2}`, frac * 0.5]);
    else w[0][1] = 1;
    const fray = r === tailRows - 1 ? 0.02 : 0;
    const shade = 0.75 + 0.45 * hash(r, 2, 6);
    const half = tailW * (1 - 0.25 * t);
    strip.push([
      scarf.vertex([tailRoot[0] - half, y + fray, z], [0, 0, -1], red.map((v) => v * shade), w),
      scarf.vertex([tailRoot[0] + half, y - fray, z], [0, 0, -1], red.map((v) => v * shade * 0.9), w),
    ]);
  }
  for (let r = 0; r < tailRows - 1; r++) scarf.quad(strip[r][0], strip[r][1], strip[r + 1][1], strip[r + 1][0]);
  newPrimitive(doc, mesh, scarfMat, scarf);

  // --- hair from the hair pack, re-bound to this skeleton by joint name.
  const hairDoc = await readGltf(`${SRC}/hair/Hair_Long.gltf`);
  const hairSkin = hairDoc.getRoot().listSkins()[0];
  const hairNames = hairSkin.listJoints().map((j) => j.getName());
  const hp = hairDoc.getRoot().listMeshes()[0].listPrimitives()[0];
  const hj = hp.getAttribute('JOINTS_0').getArray();
  const remapped = Array.from(hj, (j) => J2.get(hairNames[j]));
  const hairMat = doc.createMaterial('hair').setRoughnessFactor(0.7).setMetallicFactor(0).setDoubleSided(true);
  const hairCount = hp.getAttribute('POSITION').getCount();
  const hairColor = srgb('#2a1a12');
  const hairColors = [];
  const hpos = hp.getAttribute('POSITION').getArray();
  for (let i = 0; i < hairCount; i++) {
    const v = 0.75 + 0.6 * hash(Math.round(hpos[i * 3] * 60), Math.round(hpos[i * 3 + 1] * 25), Math.round(hpos[i * 3 + 2] * 60));
    hairColors.push(hairColor[0] * v, hairColor[1] * v, hairColor[2] * v);
  }
  newPrimitive(doc, mesh, hairMat, {
    indices: Array.from(hp.getIndices().getArray()),
    positions: Array.from(hpos),
    normals: Array.from(hp.getAttribute('NORMAL').getArray()),
    joints: remapped,
    weights: Array.from(hp.getAttribute('WEIGHTS_0').getArray()),
    colors: hairColors,
  });

  // Eyebrows reuse the hair color instead of a 2K texture.
  for (const mat of root.listMaterials()) {
    if (/Hair/i.test(mat.getName())) mat.setBaseColorTexture(null).setBaseColorFactor([...hairColor, 1]);
    if (/Superhero/i.test(mat.getName())) mat.setName('skin');
  }
  await finish(doc, 'hero.glb');
}

/** Rotates a vector by a unit quaternion [x, y, z, w]. */
function rotate(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

/** Inverse of a rotation + translation matrix (column-major). */
function invertRigid(m) {
  const out = new Float32Array(16);
  // Transposed rotation.
  out[0] = m[0]; out[1] = m[4]; out[2] = m[8];
  out[4] = m[1]; out[5] = m[5]; out[6] = m[9];
  out[8] = m[2]; out[9] = m[6]; out[10] = m[10];
  out[12] = -(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]);
  out[13] = -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]);
  out[14] = -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14]);
  out[15] = 1;
  return out;
}

// ---------------------------------------------------------------- zombie

async function buildZombie() {
  const doc = await readGltf(`${SRC}/body/Superhero_Male_FullBody.gltf`);
  stripAttributes(doc);
  const root = doc.getRoot();
  // No eyebrows; the eyes stay and glow in the game.
  for (const node of root.listNodes()) if (node.getName() === 'Eyebrows') node.dispose();
  await MeshoptSimplifier.ready;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.36, error: 0.004 }));
  await slimMaterials(doc, 512, async (img, size) => {
    // Dead skin: grey-green, darker, with bruises and wounds.
    let blots = '';
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 1, 2) * size;
      const y = hash(i, 5, 3) * size;
      const r = 6 + hash(i, 8, 1) * 26;
      const kind = hash(i, 2, 9);
      const fill = kind < 0.4 ? '#3a1512' : kind < 0.75 ? '#2c3f3a' : '#55603a';
      blots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="${(0.25 + hash(i, 4, 4) * 0.45).toFixed(2)}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="b"><feGaussianBlur stdDeviation="4"/></filter><g filter="url(#b)">${blots}</g></svg>`;
    const base = await img.modulate({ saturation: 0.25, brightness: 1.35 }).tint({ r: 196, g: 200, b: 176 }).toBuffer();
    return sharp(base).composite([{ input: Buffer.from(svg), blend: 'multiply' }]);
  });
  const skin = root.listSkins()[0];
  const bodyNode = root.listNodes().find((n) => n.getName() === 'SuperHero_Male');
  const mesh = bodyNode.getMesh();
  const body = mesh.listPrimitives()[0];
  const RAGS = '#4f5a52';
  const SHIRT = '#7a6a55';
  dress(doc, mesh, body, skin, (joint, x, y, z) => {
    // Torn trousers: one leg longer than the other.
    if (/^(pelvis|thigh)/.test(joint) || (/^calf/.test(joint) && y > (x > 0 ? 0.42 : 0.24))) return { color: RAGS, grow: 0.006 };
    // What is left of a shirt: one shoulder and part of the back.
    if (/^(spine_02|spine_03|clavicle_l|upperarm_l)/.test(joint) && (x > 0.02 || z < -0.02) && hash(Math.round(x * 9), Math.round(y * 9), 3) > 0.2) {
      return { color: SHIRT, grow: 0.008 };
    }
    return { color: null, grow: 0 };
  });
  for (const mat of root.listMaterials()) {
    if (/Superhero/i.test(mat.getName())) mat.setName('skin');
    if (/Eyes/i.test(mat.getName())) mat.setName('eyes').setBaseColorTexture(null).setBaseColorFactor([0.9, 0.85, 0.5, 1]);
  }
  await finish(doc, 'zombie.glb');
}

// ---------------------------------------------------------------- animations

async function buildAnims() {
  let target = null;
  for (const [file, wanted] of Object.entries(CLIPS)) {
    const doc = await io.read(`${SRC}/${file}`);
    for (const anim of doc.getRoot().listAnimations()) {
      if (!wanted.includes(anim.getName())) {
        for (const sampler of anim.listSamplers()) sampler.dispose();
        for (const ch of anim.listChannels()) ch.dispose();
        anim.dispose();
        continue;
      }
      for (const ch of anim.listChannels()) {
        const p = ch.getTargetPath();
        const bone = ch.getTargetNode()?.getName();
        // Bones only rotate; the pelvis also moves. Dropping the rest lets the clips fit other proportions.
        if (p === 'rotation' || (p === 'translation' && bone === 'pelvis')) continue;
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
    for (const node of doc.getRoot().listNodes()) {
      if (node.getMesh()) node.setMesh(null).setSkin(null);
    }
    if (!target) {
      target = doc;
      continue;
    }
    const own = new Set(target.getRoot().listNodes());
    const byName = new Map([...own].map((n) => [n.getName(), n]));
    mergeDocuments(target, doc);
    for (const anim of target.getRoot().listAnimations()) {
      for (const ch of anim.listChannels()) {
        const node = ch.getTargetNode();
        if (node && !own.has(node)) ch.setTargetNode(byName.get(node.getName()));
      }
    }
    for (const node of target.getRoot().listNodes()) if (!own.has(node)) node.dispose();
    for (const scene of target.getRoot().listScenes().slice(1)) scene.dispose();
  }
  for (const skin of target.getRoot().listSkins()) skin.dispose();
  for (const mat of target.getRoot().listMaterials()) mat.dispose();
  await target.transform(resample({ tolerance: 0.0005 }));
  await finish(target, 'anims.glb');
}

async function finish(doc, name) {
  await doc.transform(prune(), dedup());
  // One buffer for the binary container.
  const buffers = doc.getRoot().listBuffers();
  for (const acc of doc.getRoot().listAccessors()) acc.setBuffer(buffers[0]);
  for (const b of buffers.slice(1)) b.dispose();
  fs.mkdirSync(OUT, { recursive: true });
  await io.write(`${OUT}/${name}`, doc);
  const kb = Math.round(fs.statSync(`${OUT}/${name}`).size / 1024);
  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
  console.log(`${name}: ${kb} KB, ${tris} triangles, ${doc.getRoot().listAnimations().length} clips`);
}

await buildHero();
await buildZombie();
await buildAnims();
