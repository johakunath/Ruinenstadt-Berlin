// M11c plants: wild bushes, trimmed topiary, hedges, flower patches, reeds, plus the shared plant
// pieces the map uses for scatter and trees (`map-world.ts`). Footprints: `propCollider` in
// `src/data/courtyard.ts` (only hedges block). Everything is cheap: low-poly foliage blobs merged
// per material, alpha-tested cards from one painted atlas (`paintPlants`), no per-instance materials.
import { BufferAttribute, CylinderGeometry, Euler, IcosahedronGeometry, Matrix4, PlaneGeometry, Quaternion, Vector3, type BufferGeometry, type Texture } from 'three';
import type { PlantPropKind, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import type { LitMaterial } from './materials';
import { paintBark, paintFoliage, paintPlants, PLANT_CELL } from './paint';
import { at, type Builder, type Mats } from './world';

type RGB = readonly [number, number, number];
export type PlantCell = keyof typeof PLANT_CELL;

const KINDS: ReadonlySet<string> = new Set<PlantPropKind>(['bush', 'topiary', 'hedge', 'flowers', 'reeds']);

// ---------------------------------------------------------------- shared pieces

export interface PlantMats {
  /** Alpha cards from the plant atlas (leaves, fronds, big leaves, reeds, flowers). */
  leaf: LitMaterial;
  /** Solid foliage (bush cores, hedges, crowns). */
  foliage: LitMaterial;
  bark: LitMaterial;
}

let tex: { plants: Texture; foliage: Texture; bark: Texture } | null = null;
const matCache = new WeakMap<Mats, PlantMats>();

/** Plant materials for a material set (cloned from fern/wood so they follow the profile). */
export function plantMats(m: Mats): PlantMats {
  let p = matCache.get(m);
  if (p) return p;
  tex ??= { plants: paintPlants(), foliage: paintFoliage(), bark: paintBark() };
  const leaf = m.fern.clone();
  leaf.map = tex.plants;
  const foliage = m.wood.clone();
  foliage.map = tex.foliage;
  foliage.roughness = 0.9;
  const bark = m.wood.clone();
  bark.map = tex.bark;
  bark.roughness = 0.95;
  matCache.set(m, (p = { leaf, foliage, bark }));
  return p;
}

const cardCache = new Map<string, PlaneGeometry>();
/** A 1 x 1 card showing one atlas cell; `base` anchors it at its bottom edge, else at its center. */
export function cardGeo(cell: PlantCell, base = true): PlaneGeometry {
  const key = cell + base;
  let g = cardCache.get(key);
  if (g) return g;
  const i = PLANT_CELL[cell];
  const col = i % 4;
  const row = Math.floor(i / 4);
  g = new PlaneGeometry(1, 1);
  if (base) g.translate(0, 0.5, 0);
  const uv = g.getAttribute('uv');
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + 0.01 + uv.getX(k) * 0.98) / 4, 1 - (row + 1) / 2 + (0.01 + uv.getY(k) * 0.98) / 2);
  cardCache.set(key, g);
  return g;
}

const blobCache = new Map<number, BufferGeometry>();
/**
 * Lumpy unit foliage blob: an icosahedron (detail 0 = 20, 1 = 80 triangles) pushed in and out by a
 * smooth direction noise, with sphere normals (soft shading) and a darker underside baked in the
 * vertex colors (cheap ambient occlusion).
 */
export function blobGeo(detail: 0 | 1): BufferGeometry {
  let g = blobCache.get(detail);
  if (g) return g;
  g = new IcosahedronGeometry(1, detail);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
    const r = 1 + 0.16 * Math.sin(v.x * 5.1 + v.z * 2.3) * Math.cos(v.y * 4.3 - v.z * 3.7) + 0.08 * Math.sin(v.z * 9 + v.x * 7);
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    const ao = 0.5 + 0.5 * (v.y * 0.5 + 0.5);
    col.set([ao, ao, ao * 0.95], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  // Planar UVs per face (the geometry is not indexed): no stretched streaks, the leaf noise hides the seams.
  const uv = g.getAttribute('uv');
  const a = new Vector3();
  const c = new Vector3();
  const t1 = new Vector3();
  const t2 = new Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    v.fromBufferAttribute(pos, f);
    a.fromBufferAttribute(pos, f + 1).sub(v);
    c.fromBufferAttribute(pos, f + 2).sub(v);
    const n = a.clone().cross(c).normalize();
    t1.set(0, 1, 0).cross(n);
    if (t1.lengthSq() < 0.01) t1.set(1, 0, 0);
    t1.normalize();
    t2.copy(n).cross(t1);
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, f + k);
      uv.setXY(f + k, v.dot(t1) * 0.7 + f * 0.37, v.dot(t2) * 0.7 + f * 0.21);
    }
  }
  blobCache.set(detail, g);
  return g;
}

const q = new Quaternion();
const e = new Euler(0, 0, 0, 'YXZ');
const sv = new Vector3();
const pv = new Vector3();
/** Matrix: position, yaw, then pitch (a card's top tips toward its face for rx > 0), roll, scale. */
export function mtx(x: number, y: number, z: number, ry = 0, rx = 0, sx = 1, sy = sx, sz = sx, rz = 0): Matrix4 {
  return new Matrix4().compose(pv.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz, 'YXZ')), sv.set(sx, sy, sz));
}

const tint = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/**
 * Leaf cards scattered over the surface of a sphere (center `cx, cy, cz`, radius `r`, in the frame
 * `base`): they break the blob's outline into ragged leaf clusters. Mostly upper hemisphere.
 */
export function fringe(b: Builder, base: Matrix4, cx: number, cy: number, cz: number, r: number, n: number, color: RGB, rng: Rng, cell: PlantCell = 'leaves'): void {
  const leaf = plantMats(b.mats).leaf;
  for (let i = 0; i < n; i++) {
    const yaw = rng.range(0, Math.PI * 2);
    const el = rng.range(-0.35, 1.2);
    const d = Math.cos(el);
    const x = cx + Math.sin(yaw) * d * r;
    const z = cz + Math.cos(yaw) * d * r;
    const y = cy + Math.sin(el) * r * 0.85;
    const s = r * rng.range(0.9, 1.3);
    b.cards.of(leaf).add(cardGeo(cell, false), base.clone().multiply(mtx(x, y, z, yaw, -el * 0.8, s, s, s, rng.range(-0.6, 0.6))), tint(color, rng.range(0.8, 1.1)));
  }
}

/** A fern rosette: `n` fronds arching out from (x, z). */
export function fernRosette(b: Builder, base: Matrix4, x: number, z: number, size: number, n: number, color: RGB, rng: Rng, cell: PlantCell = 'frond'): void {
  const leaf = plantMats(b.mats).leaf;
  const a0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const yaw = a0 + (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25);
    const s = size * rng.range(0.75, 1.15);
    b.cards.of(leaf).add(cardGeo(cell), base.clone().multiply(mtx(x, 0, z, yaw, rng.range(0.5, 1.05), s * 0.6, s, 1)), tint(color, rng.range(0.8, 1.1)));
  }
}

// ---------------------------------------------------------------- the kinds

/** Wild shrub greens: dark, olive, fresh; a few turn rust or are half dead. */
function wildGreen(rng: Rng): RGB {
  const r = rng.next();
  const g = rng.range(0.8, 1.15);
  return r < 0.4 ? [0.58 * g, 0.62 * g, 0.44 * g] : r < 0.7 ? [0.74 * g, 0.68 * g, 0.42 * g] : r < 0.88 ? [0.56 * g, 0.68 * g, 0.44 * g] : r < 0.96 ? [1.05 * g, 0.66 * g, 0.38 * g] : [0.8 * g, 0.64 * g, 0.45 * g];
}

/**
 * Wild bush, 0.8-2 m: one or two dark lumpy cores (shadow, depth) wrapped in a dome of leaf-cluster
 * cards that face up and out, so the painted leaves carry the look from the game camera. 60-80 triangles.
 */
export function buildBush(b: Builder, p: Prop, rng: Rng): void {
  const pm = plantMats(b.mats);
  const P = at(p);
  const h = rng.range(0.8, 1.5) * p.size * (rng.next() < 0.15 ? 1.35 : 1);
  const w = h * rng.range(0.9, 1.5);
  const c = wildGreen(rng);
  const cores = 1 + rng.int(2);
  for (let i = 0; i < cores; i++) {
    const x = i ? rng.range(-0.3, 0.3) * w : 0;
    const z = i ? rng.range(-0.3, 0.3) * w : 0;
    b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(x, h * 0.42, z, rng.range(0, 6), 0, w * 0.38, h * 0.42, w * 0.34)), tint(c, 0.55));
  }
  const n = 6 + rng.int(4);
  const a0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + rng.range(-0.35, 0.35);
    const top = i === n - 1;
    const d = top ? 0 : w * rng.range(0.22, 0.38);
    const s = (top ? w * 0.75 : h * rng.range(0.75, 1.05)) * 1.1;
    const y = top ? h * 0.82 : h * rng.range(0.35, 0.6);
    b.cards.of(pm.leaf).add(cardGeo('leaves', false), P.clone().multiply(mtx(Math.sin(a) * d, y, Math.cos(a) * d, a, top ? -1.35 : -rng.range(0.25, 0.85), s, s * rng.range(0.8, 1), 1, rng.range(-0.5, 0.5))), tint(c, rng.range(0.8, 1.05)));
  }
  // Grass and shoots at the foot.
  if (rng.next() < 0.5) fernRosette(b, P, rng.range(-0.3, 0.3), rng.range(-0.3, 0.3), h * 0.7, 3, [0.7, 0.8, 0.5], rng);
}

/** Trimmed shrub (cemetery, allotments): ball, box or cone, a bit grown out. 50-110 triangles. */
export function buildTopiary(b: Builder, p: Prop, rng: Rng): void {
  const pm = plantMats(b.mats);
  const P = at(p);
  const s = p.size * rng.range(0.85, 1.15);
  const c: RGB = rng.next() < 0.5 ? [0.55, 0.72, 0.5] : [0.7, 0.82, 0.5];
  const form = rng.next();
  if (form < 0.45) {
    const r = 0.55 * s;
    b.geo(pm.foliage, blobGeo(1), P.clone().multiply(mtx(0, r * 0.95, 0, rng.range(0, 6), rng.range(-0.08, 0.08), r, r * 0.92, r)), c);
    fringe(b, P, 0, r, 0, r * 0.75, 2 + rng.int(2), c, rng);
  } else if (form < 0.8) {
    const w = 0.9 * s;
    const h = rng.range(0.7, 1) * s;
    b.box(pm.foliage, P.clone().multiply(mtx(0, h / 2, 0, rng.range(-0.06, 0.06), 0, 1, 1, 1, rng.range(-0.04, 0.04))), w, h, w * rng.range(0.8, 1), c, 1);
    // Rounded, overgrown top.
    b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(rng.range(-0.1, 0.1), h * 0.95, 0, rng.range(0, 6), 0, w * 0.45, h * 0.18, w * 0.42)), tint(c, 1.08));
    fringe(b, P, 0, h, 0, w * 0.45, 2, c, rng);
  } else {
    // Yew / thuja cone.
    const h = rng.range(1.4, 2.1) * s;
    const g = new CylinderGeometry(0.02, 0.42 * s, h, 7, 2);
    g.translate(0, h / 2, 0);
    b.geo(pm.foliage, g, P.clone().multiply(mtx(0, 0, 0, 0, rng.range(-0.05, 0.05), 1, 1, 1, rng.range(-0.05, 0.05))), tint(c, 0.75));
    fringe(b, P, 0, h * 0.45, 0, 0.35 * s, 3, tint(c, 0.8), rng);
  }
}

/**
 * Trimmed hedge, length `p.size` along local x, about 1.2 m high and 0.85 m deep (footprint 0.9):
 * uneven segments, a wild top, the odd dead gap. 12 triangles per segment plus top lumps and shoots.
 */
export function buildHedge(b: Builder, p: Prop, rng: Rng): void {
  const pm = plantMats(b.mats);
  const P = at(p);
  const L = p.size;
  const n = Math.max(1, Math.round(L / 1.6));
  const seg = L / n;
  const c: RGB = rng.next() < 0.6 ? [0.6, 0.78, 0.52] : [0.75, 0.8, 0.5];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + seg * (i + 0.5);
    const h = rng.range(1.05, 1.35);
    const dead = rng.next() < 0.1;
    const k: RGB = dead ? [0.95, 0.72, 0.45] : tint(c, rng.range(0.85, 1.1));
    b.box(pm.foliage, P.clone().multiply(mtx(x, h / 2, rng.range(-0.05, 0.05), rng.range(-0.03, 0.03), 0, 1, 1, 1, rng.range(-0.02, 0.02))), seg + 0.12, h, rng.range(0.78, 0.9), k, 1);
    if (rng.next() < 0.7) b.geo(pm.foliage, blobGeo(0), P.clone().multiply(mtx(x + rng.range(-0.3, 0.3), h, 0, rng.range(0, 6), 0, seg * 0.4, rng.range(0.12, 0.3), 0.42)), tint(k, 1.08));
    if (rng.next() < 0.5) fringe(b, P, x, h + 0.1, 0, 0.45, 1 + rng.int(2), k, rng);
  }
}

/** Flower colour cells for a patch: a garden bed is one or two kinds, a wild meadow mixes. */
const FLOWERS: PlantCell[] = ['poppy', 'yellow', 'white', 'purple'];

/** Flower patch, radius about `p.size` m: tilted grass-and-blossom cards. 12-20 triangles. */
export function buildFlowers(b: Builder, p: Prop, rng: Rng, garden = rng.next() < 0.4): void {
  const leaf = plantMats(b.mats).leaf;
  const P = at(p);
  const mix = garden ? [rng.pick(FLOWERS), rng.pick(FLOWERS)] : [rng.pick(FLOWERS), rng.pick(FLOWERS), rng.pick(FLOWERS)];
  const n = (garden ? 7 : 5) + rng.int(4);
  const R = 0.9 * p.size;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * R;
    const w = rng.range(0.8, 1.2) * Math.min(1.4, 0.6 + p.size * 0.4);
    const h = garden ? rng.range(0.45, 0.6) : rng.range(0.4, 0.75);
    const cell = rng.next() < (garden ? 0.05 : 0.2) ? 'leaves' : (rng.pick(mix) as PlantCell);
    const g = rng.range(0.85, 1.1);
    b.cards.of(leaf).add(cardGeo(cell), P.clone().multiply(mtx(Math.sin(a) * d, 0, Math.cos(a) * d, a + rng.range(-0.5, 0.5), rng.range(0.25, 0.7), w, h, 1)), cell === 'leaves' ? [0.7 * g, 0.85 * g, 0.55 * g] : [g, g, g]);
  }
}

/** Reed clump (Schilf) with cattails, 1.4-2.2 m. 10-14 triangles. */
export function buildReeds(b: Builder, p: Prop, rng: Rng): void {
  const leaf = plantMats(b.mats).leaf;
  const P = at(p);
  const n = 5 + rng.int(3);
  const a0 = rng.range(0, Math.PI);
  const straw = rng.range(0, 1);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI + rng.range(-0.2, 0.2);
    const h = rng.range(1.4, 2.2) * p.size;
    const g = rng.range(0.8, 1.1);
    b.cards.of(leaf).add(cardGeo('reeds'), P.clone().multiply(mtx(rng.range(-0.4, 0.4) * p.size, 0, rng.range(-0.4, 0.4) * p.size, a, rng.range(-0.12, 0.12), rng.range(0.9, 1.4) * p.size, h, 1)), [g * (0.9 + straw * 0.3), g, g * (0.75 + straw * 0.1)]);
  }
}

/** Builds `p` if it belongs to this set; false otherwise. */
export function buildPlantProp(b: Builder, p: Prop, rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  switch (p.kind) {
    case 'bush': buildBush(b, p, rng); break;
    case 'topiary': buildTopiary(b, p, rng); break;
    case 'hedge': buildHedge(b, p, rng); break;
    case 'flowers': buildFlowers(b, p, rng); break;
    case 'reeds': buildReeds(b, p, rng); break;
  }
  return true;
}

/** Jungle undergrowth (Spreepark): big leaves and fern rosettes. 12-26 triangles. */
export function buildUndergrowth(b: Builder, p: Prop, rng: Rng): void {
  const P = at(p);
  const leaf = plantMats(b.mats).leaf;
  const s = p.size * rng.range(0.9, 1.6);
  if (rng.next() < 0.55) {
    for (let i = 0; i < 2 + rng.int(2); i++) {
      const a = rng.range(0, Math.PI * 2);
      const g = rng.range(0.75, 1.1);
      b.cards.of(leaf).add(cardGeo('bigLeaf'), P.clone().multiply(mtx(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3), a, rng.range(0.1, 0.45), s * 1.3, s * 1.1, 1)), [0.52 * g, 0.74 * g, 0.42 * g]);
    }
  }
  if (rng.next() < 0.7) fernRosette(b, P, rng.range(-0.5, 0.5), rng.range(-0.5, 0.5), s * 1.1, 5 + rng.int(3), [0.55, 0.75, 0.42], rng);
}
