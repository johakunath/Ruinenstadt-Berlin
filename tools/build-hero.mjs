// Builds assets/characters/hero.glb (H1, docs/tasks/h1-hero.md): `npm run assets:hero`.
//
// 1. Blender (headless, tools/blender/hero_build.py) imports the source body and exports meshes
//    with UVs and weights by joint name to assets-src/hero/work/ (not committed).
// 2. This script keeps the skeleton and inverse bind matrices of the source glTF (they never pass
//    through Blender, whose glTF import and export re-orient bones), binds Blender's meshes to it by
//    joint name, splits the body into region nodes (`body_*`, hidden under clothing), adds the
//    clothing pieces as their own skinned nodes, checks the bone-name contract and adds the scarf
//    on three extra joints and hair from the hair pack.
//
// Blender: $BLENDER, else `blender` on PATH, else the default Windows install path.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { HERO_CORE_JOINTS, HERO_EXTRA_JOINTS } from '../src/data/hero-contract.ts';
import { HERO_REGIONS, regionOf } from '../src/data/hero-contract.ts';
import {
  Builder, SRC, dominantJoints, finish, jointIndex, jointPos, newPrimitive, readGltf, slimMaterials, srgb, hash, stripAttributes,
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
  for (const line of log.split(/\r?\n/)) if (/^hero_(lib|build|clothes):|Traceback|Error:/.test(line)) console.log(`  ${line}`);
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
    color: m.color ? view(Float32Array, m.color) : null,
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
    const joints = skinJoints(w, J);
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

/** Blender's per-mesh joint indices mapped onto the skin by name. */
function skinJoints(w, J) {
  const map = w.groups.map((g) => {
    if (!J.has(g)) throw new Error(`${w.name}: vertex group ${g} is not a joint of the source skin`);
    return J.get(g);
  });
  const joints = new Uint8Array(w.joints.length);
  for (let i = 0; i < joints.length; i++) joints[i] = w.weights[i] > 0 ? map[w.joints[i]] : 0;
  return joints;
}

/**
 * Splits the body into one node per region (`body_head` …) that share its vertex buffers: a
 * triangle goes to the region most of its vertices' dominant joints belong to.
 */
function splitBody(doc, bodyNode, skin) {
  const prim = bodyNode.getMesh().listPrimitives()[0];
  const dom = dominantJoints(prim, skin);
  const idx = prim.getIndices().getArray();
  const lists = new Map(HERO_REGIONS.map((r) => [r, []]));
  for (let t = 0; t < idx.length; t += 3) {
    const rs = [idx[t], idx[t + 1], idx[t + 2]].map((v) => regionOf(dom[v]));
    const r = rs[1] === rs[2] ? rs[1] : rs[0];
    lists.get(r).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const parent = bodyNode.getParentNode();
  for (const [region, list] of lists) {
    const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(list)).setBuffer(buffer));
    for (const sem of prim.listSemantics()) p.setAttribute(sem, prim.getAttribute(sem));
    const node = doc.createNode(`body_${region}`).setMesh(doc.createMesh(`body_${region}`).addPrimitive(p)).setSkin(skin);
    if (parent) parent.addChild(node);
    else doc.getRoot().listScenes()[0].addChild(node);
    console.log(`  body_${region}: ${list.length / 3} triangles`);
  }
  bodyNode.dispose();
}

/** Clothing pieces from Blender: one skinned node each, vertex colours, own material. */
function addPieces(doc, skin, work, sourceNames) {
  const J = jointIndex(skin);
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const scene = doc.getRoot().listScenes()[0];
  for (const w of work) {
    if (sourceNames.has(w.name)) continue;
    const mat = doc.createMaterial(w.name).setRoughnessFactor(PIECE_ROUGHNESS[w.name] ?? 0.8).setMetallicFactor(0).setDoubleSided(w.name.startsWith('a_') || w.name === 'scarf');
    const p = doc.createPrimitive().setMaterial(mat)
      .setAttribute('POSITION', acc('VEC3', w.position))
      .setAttribute('NORMAL', acc('VEC3', w.normal))
      .setAttribute('TEXCOORD_0', acc('VEC2', w.uv))
      .setAttribute('JOINTS_0', acc('VEC4', skinJoints(w, J)))
      .setAttribute('WEIGHTS_0', acc('VEC4', w.weights))
      .setIndices(acc('SCALAR', w.count > 65535 ? w.indices : new Uint16Array(w.indices)));
    if (w.color) p.setAttribute('COLOR_0', acc('VEC3', w.color));
    scene.addChild(doc.createNode(w.name).setMesh(doc.createMesh(w.name).addPrimitive(p)).setSkin(skin));
    console.log(`  ${w.name}: ${w.count} vertices, ${w.triangles} triangles`);
  }
}

const PIECE_ROUGHNESS = { a_mantel: 0.8, f_stiefel: 0.65, g_handsch: 0.6, scarf: 0.9 };

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
  await slimMaterials(doc, 1024, undefined, /Superhero/i); // skin normal map (Qualität only)
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const work = readWork();
  rebind(doc, skin, work);
  const bodyNode = root.listNodes().find((n) => n.getName() === 'Superhero_Female');
  const sourceNames = new Set(root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName()));

  // --- scarf: a ring around the neck plus a tail on two extra bones that the game animates.
  const neck = jointPos(skin, 'neck_01');
  const spine3 = skin.listJoints().find((n) => n.getName() === 'spine_03');
  const tailRoot = [0.05, neck[1] - 0.005, neck[2] - 0.085];
  const segLen = 0.2;
  const ibmBones = [];
  ibmBones.push(...addChain(doc, skin, spine3, [0, 1, 2].map((i) => [`scarf_0${i + 1}`, [tailRoot[0], tailRoot[1] - segLen * i, tailRoot[2] - 0.03 * i]])));
  // Coat back panels (H1 step 3): two chains on the pelvis, swung by HeroView. Heights and depth
  // match COAT_CHAIN in tools/blender/hero_clothes.py, which weights the skirt's back to them.
  const pelvis = skin.listJoints().find((n) => n.getName() === 'pelvis');
  const pz = jointPos(skin, 'pelvis')[2];
  const h1 = jointPos(skin, 'spine_01')[1] - 0.06;
  for (const [side, x] of [['l', 0.08], ['r', -0.08]]) {
    ibmBones.push(...addChain(doc, skin, pelvis, [[`coat_b${side}_01`, [x, h1, pz - 0.15]], [`coat_b${side}_02`, [x * 1.1, 0.66, pz - 0.19]]]));
  }
  // Inverse bind matrices for the new joints.
  const ibm = skin.getInverseBindMatrices();
  const old = ibm.getArray();
  const next = new Float32Array(old.length + 16 * ibmBones.length);
  next.set(old);
  ibmBones.forEach((bone, i) => next.set(invertRigid(bone.getWorldMatrix()), old.length + i * 16));
  ibm.setArray(next);
  const J2 = jointIndex(skin);

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
  newPrimitive(doc, ownNode(doc, skin, bodyNode, 'hair'), hairMat, {
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
  splitBody(doc, bodyNode, skin);
  addPieces(doc, skin, work, sourceNames);
  checkContract(skin);
  await finish(doc, 'hero.glb', { keepAttributes: true });
}

/**
 * Appends a chain of joints under `parent` at the given model-space positions. The first undoes its
 * parent's world rotation, so the chain is world-aligned in the bind pose (local X = sideways,
 * Y = up, Z = forward; the skeleton is Z-up below \`root\`). Returns the new joints.
 */
function addChain(doc, skin, parent, links) {
  const q = parent.getWorldRotation();
  const inv = [-q[0], -q[1], -q[2], q[3]];
  let parentPos = parent.getWorldTranslation();
  const bones = [];
  links.forEach(([name, pos], i) => {
    const delta = [pos[0] - parentPos[0], pos[1] - parentPos[1], pos[2] - parentPos[2]];
    const bone = doc.createNode(name);
    if (i === 0) bone.setTranslation(rotate(inv, delta)).setRotation(inv);
    else bone.setTranslation(delta);
    parent.addChild(bone);
    skin.addJoint(bone);
    bones.push(bone);
    parent = bone;
    parentPos = pos;
  });
  return bones;
}

/** A new skinned node next to the body with an empty mesh; returns the mesh. */
function ownNode(doc, skin, bodyNode, name) {
  const mesh = doc.createMesh(name);
  const node = doc.createNode(name).setMesh(mesh).setSkin(skin);
  const parent = bodyNode.getParentNode();
  if (parent) parent.addChild(node);
  else doc.getRoot().listScenes()[0].addChild(node);
  return mesh;
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
