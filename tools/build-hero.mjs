// Builds assets/characters/hero.glb (H1, docs/tasks/h1-hero.md): `npm run assets:hero`.
//
// 1. Blender (headless, tools/blender/hero_build.py) imports the source body and exports meshes
//    with UVs and weights by joint name to assets-src/hero/work/ (not committed).
// 2. This script keeps the skeleton and inverse bind matrices of the source glTF (they never pass
//    through Blender, whose glTF import and export re-orient bones), binds Blender's meshes to it by
//    joint name, checks the bone-name contract and dresses the hero in code (coat skirt, belt,
//    scarf on three extra joints, hair from the hair pack).
//
// Blender: $BLENDER, else `blender` on PATH, else the default Windows install path.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { HERO_CORE_JOINTS, HERO_EXTRA_JOINTS } from '../src/data/hero-contract.ts';
import {
  Builder, SRC, dominantJoints, dress, finish, jointIndex, jointPos, newPrimitive, readGltf, sectionAt, slimMaterials, srgb, hash, stripAttributes,
} from './character-lib.mjs';

const BODY = `${SRC}/body/Superhero_Female_FullBody.gltf`;
const WORK = `${SRC}/hero/work`;
const WINDOWS_BLENDER = 'C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe';
/** Largest allowed move of a source vertex through Blender (meters). */
const MAX_SHIFT = 0.0001;

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.split(/\r?\n/)[0].trim();
  if (fs.existsSync(WINDOWS_BLENDER)) return WINDOWS_BLENDER;
  throw new Error('Blender not found: set BLENDER to blender(.exe), put it on PATH or install Blender 5.3');
}

function runBlender() {
  const blender = findBlender();
  fs.rmSync(WORK, { recursive: true, force: true });
  const args = ['-b', '--factory-startup', '--python', 'tools/blender/hero_build.py', '--', BODY, WORK];
  const run = spawnSync(blender, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  for (const line of log.split(/\r?\n/)) if (/^hero_(lib|build):|Traceback|Error:/.test(line)) console.log(`  ${line}`);
  if (run.status !== 0 || !fs.existsSync(`${WORK}/meshes.json`)) {
    throw new Error(`Blender failed (${run.status ?? run.error}):\n${log.split(/\r?\n/).slice(-30).join('\n')}`);
  }
}

/** Reads the work format of tools/blender/hero_lib.py into typed arrays. */
function readWork() {
  const manifest = JSON.parse(fs.readFileSync(`${WORK}/meshes.json`, 'utf8'));
  const bin = fs.readFileSync(`${WORK}/meshes.bin`);
  const view = (Type, { offset, length }) => {
    const out = new Type(length);
    new Uint8Array(out.buffer).set(bin.subarray(offset, offset + length * Type.BYTES_PER_ELEMENT));
    return out;
  };
  return manifest.meshes.map((m) => ({
    ...m,
    position: view(Float32Array, m.position),
    normal: view(Float32Array, m.normal),
    uv: view(Float32Array, m.uv),
    joints: view(Uint16Array, m.joints),
    weights: view(Float32Array, m.weights),
    indices: view(Uint32Array, m.indices),
  }));
}

/** Largest distance from a vertex in `after` to its source vertex (same index when the counts
 *  match, else the nearest source vertex). */
function maxShift(before, after) {
  const n = after.length / 3;
  let worst = 0;
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    const lo = before.length === after.length ? i : 0;
    const hi = before.length === after.length ? i + 1 : before.length / 3;
    for (let k = lo; k < hi; k++) {
      const d = Math.hypot(after[i * 3] - before[k * 3], after[i * 3 + 1] - before[k * 3 + 1], after[i * 3 + 2] - before[k * 3 + 2]);
      if (d < best) best = d;
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

/**
 * Replaces the geometry of every source mesh with Blender's mesh of the same name, joints mapped
 * by name onto the source skin. The source nodes, skin and inverse bind matrices stay as they are.
 */
function rebind(doc, skin, work) {
  const J = jointIndex(skin);
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  let worst = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = work.find((m) => m.name === node.getName());
    if (!w) throw new Error(`Blender delivered no mesh ${node.getName()}`);
    const prim = mesh.listPrimitives()[0];
    const map = w.groups.map((g) => {
      if (!J.has(g)) throw new Error(`${w.name}: vertex group ${g} is not a joint of the source skin`);
      return J.get(g);
    });
    const joints = new Uint8Array(w.joints.length);
    for (let i = 0; i < joints.length; i++) joints[i] = w.weights[i] > 0 ? map[w.joints[i]] : 0;
    const shift = maxShift(prim.getAttribute('POSITION').getArray(), w.position);
    worst = Math.max(worst, shift);
    console.log(`  ${w.name}: ${w.count} vertices, ${w.triangles} triangles, largest shift ${(shift * 1000).toFixed(6)} mm`);
    prim
      .setAttribute('POSITION', acc('VEC3', w.position))
      .setAttribute('NORMAL', acc('VEC3', w.normal))
      .setAttribute('TEXCOORD_0', acc('VEC2', w.uv))
      .setAttribute('JOINTS_0', acc('VEC4', joints))
      .setAttribute('WEIGHTS_0', acc('VEC4', w.weights))
      .setIndices(acc('SCALAR', w.count > 65535 ? w.indices : new Uint16Array(w.indices)));
  }
  console.log(`hero: largest vertex shift through Blender ${(worst * 1000).toFixed(6)} mm (limit ${MAX_SHIFT * 1000} mm)`);
  if (worst > MAX_SHIFT) throw new Error('hero: the body moved in Blender');
}

/** Joint names and order of the finished skin against src/data/hero-contract.ts. */
function checkContract(skin) {
  const names = skin.listJoints().map((j) => j.getName());
  const extras = names.slice(HERO_CORE_JOINTS.length);
  const want = [...HERO_CORE_JOINTS, ...HERO_EXTRA_JOINTS.filter((n) => extras.includes(n))];
  if (names.join() !== want.join()) throw new Error(`hero: joints break the contract:\n${names.join(' ')}`);
  console.log(`hero: ${names.length} joints match the contract`);
}

async function buildHero() {
  const doc = await readGltf(BODY);
  stripAttributes(doc);
  await slimMaterials(doc, 1024);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  rebind(doc, skin, readWork());
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
  checkContract(skin);
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


runBlender();
await buildHero();
