// Shared helpers for the character builds: tools/build-assets.mjs (zombie, clips) and
// tools/build-hero.mjs (hero). Source packs in assets-src/ (not committed; tools/fetch-assets.sh).
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

export const SRC = 'assets-src';
export const OUT = 'assets/characters';
export const io = new NodeIO();


/** Reads a .gltf whose image file names do not all exist (the pack has a few broken references). */
export async function readGltf(file) {
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

export const srgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
};

/** Cheap position hash in 0..1 for painterly variation. */
export const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

export function jointIndex(skin) {
  const map = new Map();
  skin.listJoints().forEach((j, i) => map.set(j.getName(), i));
  return map;
}

export function jointPos(skin, name) {
  const j = skin.listJoints().find((n) => n.getName() === name);
  const m = j.getWorldMatrix();
  return [m[12], m[13], m[14]];
}

/** Keeps POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0 only. */
export function stripAttributes(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of prim.listSemantics()) {
        if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'].includes(sem)) prim.setAttribute(sem, null);
      }
    }
  }
}

/** Base color only, resized and re-encoded. Normal and roughness maps are dropped (small on screen). */
export async function slimMaterials(doc, size, recolor, keepNormals) {
  for (const mat of doc.getRoot().listMaterials()) {
    const normal = mat.getNormalTexture();
    if (normal && keepNormals?.test(mat.getName())) {
      // JPEG at high quality: a PNG normal map would add 1.4 MB for detail seen mostly on the face.
      normal.setImage(await sharp(Buffer.from(normal.getImage())).resize(size, size).jpeg({ quality: 90 }).toBuffer()).setMimeType('image/jpeg');
    } else mat.setNormalTexture(null);
    mat.setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);
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

export function newPrimitive(doc, mesh, material, data) {
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
export class Builder {
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
export function dominantJoints(prim, skin) {
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
export function dress(doc, mesh, prim, skin, paint) {
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
export function sectionAt(prim, dom, y, band = 0.035) {
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

/** `keepAttributes`: keep vertex attributes no material uses yet (the hero's piece UVs, painted in step 6). */
export async function finish(doc, name, { keepAttributes = false } = {}) {
  await doc.transform(prune({ keepAttributes }), dedup());
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

