// M11c lot type props, urban set: cars, crane, container, scaffold, Rohbau, pallets, ticket machine,
// barrier boom, bike rack, clothesline, gravestones, walls, concrete slabs and girders. Footprints:
// `propCollider` in `src/data/courtyard.ts`. Light painted bases (`enamel`, `carPaint`, `corrugated`)
// take their color from the vertex tint, so every variant stays in one batch per material.
import {
  BufferAttribute, CircleGeometry, CylinderGeometry, DodecahedronGeometry, ExtrudeGeometry, Matrix4, PlaneGeometry,
  Quaternion, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3, type BufferGeometry, type Material,
} from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Prop, UrbanPropKind } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';

type RGB = [number, number, number];
type V3 = [number, number, number];

const KINDS: ReadonlySet<string> = new Set<UrbanPropKind>(['crane', 'container', 'scaffold', 'rohbau', 'pallets', 'ticketMachine', 'boom', 'bikes', 'clothesline', 'gravestone', 'wall', 'lowWall', 'slab', 'girder']);

const loc = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Matrix4 => {
  const m = new Matrix4().makeRotationY(ry);
  if (rx) m.multiply(new Matrix4().makeRotationX(rx));
  if (rz) m.multiply(new Matrix4().makeRotationZ(rz));
  return m.setPosition(x, y, z);
};
/** `base` times a local offset and rotation. */
const L = (base: Matrix4, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Matrix4 => base.clone().multiply(loc(x, y, z, rx, ry, rz));
const S = (m: Matrix4, x: number, y: number, z: number): Matrix4 => m.multiply(new Matrix4().makeScale(x, y, z));
const g3 = (g: number, r = 1, b = 1): RGB => [g * r, g, g * b];
const mulT = (t: RGB, k: number): RGB => [t[0] * k, t[1] * k, t[2] * k];

const _q = new Quaternion();
const _z = new Vector3(0, 0, 1);
const _d = new Vector3();
const _one = new Vector3(1, 1, 1);
/** A box of section w × h running from a to c (local to `base`): tubes, braces, rebar, pillars. */
function beam(b: Builder, mat: Material, base: Matrix4, a: V3, c: V3, w: number, tint?: RGB, h = w): void {
  _d.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = _d.length();
  if (len < 1e-4) return;
  _q.setFromUnitVectors(_z, _d.divideScalar(len));
  b.box(mat, base.clone().multiply(new Matrix4().compose(new Vector3((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), _q, _one)), w, h, len, tint);
}

const cache = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

/** Extrudes a side profile (u along local z, v up) across local x, `width` wide, with rounded edges. */
function extrudeSide(pts: Array<[number, number]>, width: number, bevel: number, segs: number, uvScale = 0.35, crease = 0.9): BufferGeometry {
  const depth = width - 2 * bevel;
  const raw = new ExtrudeGeometry(new Shape(pts.map(([u, v]) => new Vector2(u, v))), { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: segs, steps: 1, curveSegments: 1 });
  raw.translate(0, 0, -depth / 2);
  raw.rotateY(-Math.PI / 2);
  const g = toCreasedNormals(raw, crease);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
  return g;
}

/** Bakes grime into vertex colors: darker toward the ground (and a lighter, sun-bleached top). */
function grime(g: BufferGeometry, low: number, high: number, dark: RGB = [0.55, 0.53, 0.5]): BufferGeometry {
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - low) / (high - low)));
    col.set([dark[0] + (1 - dark[0]) * t, dark[1] + (1 - dark[1]) * t, dark[2] + (1 - dark[2]) * t], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

// ---------------------------------------------------------------- cars

interface CarType {
  /** Profile length (the bevel adds about 0.13 m). */
  len: number;
  wf: number;
  wr: number;
  hood: number;
  deck: number;
  /** Windshield base, roof front, roof rear, rear window base (z). */
  zw: number;
  zrf: number;
  zrr: number;
  zrb: number;
  roof: number;
  /** Door seams along the side (z), front to back. */
  seams: number[];
  trunk: boolean;
}
const CAR_W = 1.75;
const GLASS_W = 1.44;
const CAR_TYPES: Record<'saloon' | 'hatch' | 'estate', CarType> = {
  saloon: { len: 4.16, wf: 1.34, wr: -1.18, hood: 0.84, deck: 0.88, zw: 0.7, zrf: 0.1, zrr: -0.86, zrb: -1.34, roof: 1.4, seams: [0.64, -0.32, -1.22], trunk: true },
  hatch: { len: 3.8, wf: 1.2, wr: -1.2, hood: 0.82, deck: 0.92, zw: 0.62, zrf: 0.0, zrr: -1.34, zrb: -1.82, roof: 1.38, seams: [0.56, -0.66], trunk: false },
  estate: { len: 4.3, wf: 1.36, wr: -1.26, hood: 0.84, deck: 0.92, zw: 0.76, zrf: 0.16, zrr: -1.86, zrb: -2.06, roof: 1.42, seams: [0.7, -0.3, -1.22], trunk: false },
};
/** Faded East German and 90s paint (on the near-white `carPaint`): teal, sand, brick red, pale blue, cream, mint, ochre, grey-green, orange. */
const CAR_TINTS: RGB[] = [[0.62, 0.86, 0.82], [1.04, 0.9, 0.64], [0.9, 0.48, 0.4], [0.6, 0.72, 0.98], [1.06, 1.02, 0.94], [0.7, 0.92, 0.68], [1.08, 0.84, 0.42], [0.8, 0.84, 0.74], [1.08, 0.64, 0.42], [0.86, 0.66, 0.78]];
const PRIMER: RGB = [0.62, 0.63, 0.6];

function carLower(t: CarType): Array<[number, number]> {
  const h = t.len / 2;
  const p: Array<[number, number]> = [[-h + 0.14, 0.27]];
  for (const zc of [t.wr, t.wf]) for (let i = 0; i <= 6; i++) { const a = Math.PI - (i / 6) * Math.PI; p.push([zc + Math.cos(a) * 0.45, 0.3 + Math.sin(a) * 0.42]); }
  p.push([h - 0.14, 0.27], [h, 0.37], [h + 0.02, 0.6], [h - 0.08, 0.72], [h - 0.42, t.hood - 0.03], [t.zw + 0.22, t.hood]);
  p.push([t.zw - 0.02, t.hood + 0.01], [t.zrb + 0.02, t.deck]);
  if (t.trunk) p.push([-h + 0.34, t.deck - 0.02], [-h + 0.06, t.deck - 0.13]);
  else p.push([-h + 0.04, t.deck - 0.1]);
  p.push([-h, 0.62], [-h - 0.01, 0.37]);
  return p;
}

function carCabin(t: CarType): Array<[number, number]> {
  const mid = (t.zrf + t.zrr) / 2;
  return [[t.zw + 0.06, t.hood - 0.1], [t.zw, t.hood], [t.zrf + 0.1, t.roof - 0.05], [t.zrf - 0.06, t.roof], [mid, t.roof + 0.03], [t.zrr + 0.06, t.roof], [t.zrr - 0.08, t.roof - 0.05], [t.zrb, t.deck], [t.zrb + 0.06, t.deck - 0.1]];
}

function carRoof(t: CarType): Array<[number, number]> {
  const mid = (t.zrf + t.zrr) / 2;
  const top: Array<[number, number]> = [[t.zrf + 0.12, t.roof - 0.04], [t.zrf - 0.06, t.roof + 0.025], [mid, t.roof + 0.055], [t.zrr + 0.06, t.roof + 0.025], [t.zrr - 0.1, t.roof - 0.04]];
  return [...top, ...[...top].reverse().map(([u, v]): [number, number] => [u, v - 0.08])];
}

function carGeo(kind: keyof typeof CAR_TYPES): { lower: BufferGeometry; cabin: BufferGeometry; roof: BufferGeometry } {
  const t = CAR_TYPES[kind];
  return {
    lower: cached(`car-lower-${kind}`, () => grime(extrudeSide(carLower(t), CAR_W, 0.1, 2, 0.32, 0.95), 0.25, 0.75, [0.6, 0.42, 0.3])),
    cabin: cached(`car-cabin-${kind}`, () => extrudeSide(carCabin(t), GLASS_W, 0.05, 1, 0.5, 0.5)),
    roof: cached(`car-roof-${kind}`, () => grime(extrudeSide(carRoof(t), GLASS_W + 0.06, 0.04, 1, 0.32, 0.95), 1.3, 1.45, [0.8, 0.78, 0.74])),
  };
}

/**
 * P3: an East German car from the local AI pipeline, a Pixal3D shell cut below the sills (its wheels fell apart)
 * on code wheels. `lift`: height of the cut sills above the ground (lower than real, so the code wheels tuck into
 * the arches, Johannes 2026-11-24); axles at `front` and `rear` (z), `x` half track, `r` wheel radius. `roof`,
 * `bonnet` (top y, middle z, length) and `nose` (z) place decorations built elsewhere (Wedding ribbons, Mitte
 * roof sensors). `share`: part of a map's cars.
 */
export interface ModelCar {
  kind: 'trabi' | 'wartburg';
  share: number; lift: number; x: number; front: number; rear: number; r: number;
  roof: number; bonnet: { y: number; z: number; len: number }; nose: number;
}
const MODEL_CARS: readonly ModelCar[] = [
  { kind: 'trabi', share: 0.35, lift: 0.15, x: 0.7, front: 1.17, rear: -1.04, r: 0.27, roof: 1.69, bonnet: { y: 1.09, z: 1.2, len: 1.1 }, nose: 1.82 },
  // The Wartburg 353 (4.22 m, wheelbase 2.47 m measured on the shell).
  { kind: 'wartburg', share: 0.2, lift: 0.22, x: 0.68, front: 1.31, rear: -1.16, r: 0.3, roof: 1.54, bonnet: { y: 1.03, z: 1.45, len: 1.1 }, nose: 2.15 },
];
/** The model car a car prop is drawn as on maps with local AI props, or none (a code car): a hash of its position,
 * so decorations built elsewhere find the same car and the code cars keep their rng. */
export function modelCar(p: Prop): ModelCar | undefined {
  const v = Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453;
  let f = v - Math.floor(v);
  for (const c of MODEL_CARS) { if (f < c.share) return c; f -= c.share; }
  return undefined;
}

/** P3: a model car's shell (`glb-props.ts`, one draw call per kind for all of a map) on code wheels. */
function buildModelCar(b: Builder, p: Prop, rng: Rng, glb: NonNullable<Builder['mats']['glbProps']>, car: ModelCar): void {
  const m = b.mats;
  // One flat tyre on some: that corner sinks, the shell tilts with it.
  const flat = rng.next() < 0.35 ? rng.int(4) : -1;
  const wheels: Array<[number, number]> = [[car.x, car.front], [-car.x, car.front], [car.x, car.rear], [-car.x, car.rear]];
  const sink = wheels.map((_, i): number => (i === flat ? 0.08 : 0));
  const pitch = ((sink[0]! + sink[1]!) - (sink[2]! + sink[3]!)) / 2 / (car.front - car.rear);
  const roll = ((sink[1]! + sink[3]!) - (sink[0]! + sink[2]!)) / 2 / (2 * car.x);
  const base = at(p, rng.range(-0.08, 0.08), -(sink.reduce((a, v) => a + v, 0) / 4), rng.range(-0.1, 0.1), pitch, rng.range(-0.03, 0.03), roll);
  const tint = mulT(rng.pick(CAR_TINTS), rng.range(0.9, 1.08));
  // The batches add the chunk's height offset (`on`, terraces and decks) themselves; the GLB placement needs it too.
  glb.push({ kind: car.kind, m: new Matrix4().makeTranslation(0, b.solid.lift, 0).multiply(L(base, 0, car.lift, 0)), tint });
  const tire = new CylinderGeometry(car.r, car.r, 0.15, 10);
  const hub = new CircleGeometry(0.13, 6);
  wheels.forEach(([x, z], i) => {
    const s = Math.sign(x), f = i === flat ? 0.75 : 1, y = car.r * f + sink[i]! - 0.01;
    b.geo(m.rubber, tire, S(L(base, x, y, z, 0, 0, Math.PI / 2), f, 1, 1));
    b.geo(m.enamel, hub, L(base, x + s * 0.09, y, z, 0, s * Math.PI / 2), g3(0.8));
  });
}

/** A thin slab from (z0, y0) to (z1, y1) in the car's side view, `w` wide across x, centered at x. */
function sideSlab(base: Matrix4, x: number, z0: number, y0: number, z1: number, y1: number, out = 0): Matrix4 {
  const a = Math.atan2(-(y1 - y0), z1 - z0);
  const nz = Math.sin(a), ny = Math.cos(a);
  return L(base, x, (y0 + y1) / 2 + ny * out, (z0 + z1) / 2 + nz * out, a);
}

/**
 * Abandoned car (Johannes 2026-11-17: lighter, bigger, rounder). Saloon, hatchback or estate about
 * 4.3 × 1.75 × 1.45 m: rounded body with wheel arches, glass cabin with pillars, bumpers, lights,
 * mirrors. Wrecks vary: smashed or missing glass, open door, hood or trunk, flat tires, on bricks,
 * burnt shell, replaced primer panels, moss. About 700-850 triangles.
 */
export function buildCar(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  // P3: on maps with local AI props about a third of the cars are Trabis and a fifth Wartburgs (model cars).
  const model = m.glbProps ? modelCar(p) : undefined;
  if (model) { buildModelCar(b, p, rng, m.glbProps!, model); return; }
  const kind = rng.pick(['saloon', 'saloon', 'hatch', 'estate'] as const);
  const t = CAR_TYPES[kind];
  const geo = carGeo(kind);
  const h = t.len / 2;
  const burnt = rng.next() < 0.13;
  const bricks = !burnt && rng.next() < 0.1;
  // Wheels: front left, front right, rear left, rear right (left = +x).
  const wheels: Array<[number, number]> = [[0.76, t.wf], [-0.76, t.wf], [0.76, t.wr], [-0.76, t.wr]];
  const flat = wheels.map(() => !bricks && (burnt || rng.next() < 0.28));
  const sink = flat.map((f) => (f ? (burnt ? 0.16 : 0.08) : 0));
  const avg = (i: number, j: number): number => ((sink[i] ?? 0) + (sink[j] ?? 0)) / 2;
  const pitch = (avg(0, 1) - avg(2, 3)) / (t.wf - t.wr);
  const roll = (avg(1, 3) - avg(0, 2)) / 1.52;
  const lift = bricks ? 0.16 : -(avg(0, 1) + avg(2, 3)) / 2;
  const base = at(p, rng.range(-0.08, 0.08), lift, rng.range(-0.1, 0.1), pitch, rng.range(-0.03, 0.03), roll);
  const shade = rng.range(0.9, 1.08);
  const paint: RGB = burnt ? g3(rng.range(0.32, 0.45), 1.1, 0.85) : mulT(rng.pick(CAR_TINTS), shade);
  const body = burnt ? m.rust : m.carPaint;
  b.geo(body, geo.lower, base, paint);
  // Two-tone: a white roof on some.
  b.geo(body, geo.roof, base, !burnt && rng.next() < 0.2 ? g3(1.05 * shade, 1, 0.95) : paint);
  const glass = burnt ? 'gone' : rng.pick(['intact', 'intact', 'smashed', 'smashed', 'gone'] as const);
  b.geo(glass === 'gone' ? m.dark : m.carGlass, geo.cabin, base, [1, 1, 1]);
  // Pillars and the door window frames, in body color.
  const pw = GLASS_W / 2 + 0.005;
  for (const s of [-1, 1]) {
    b.box(body, sideSlab(base, s * pw, t.zw, t.hood, t.zrf + 0.1, t.roof - 0.04), 0.05, 0.08, Math.hypot(t.zrf + 0.1 - t.zw, t.roof - t.hood), paint);
    b.box(body, sideSlab(base, s * pw, t.zrr - 0.08, t.roof - 0.04, t.zrb, t.deck), 0.05, 0.12, Math.hypot(t.zrr - t.zrb, t.roof - t.deck), paint);
    const zb = t.seams[1] as number;
    b.box(body, L(base, s * pw, (t.hood + t.roof) / 2, zb), 0.05, t.roof - t.hood, 0.1, paint);
    if (kind === 'estate') b.box(body, L(base, s * pw, (t.deck + t.roof) / 2 + 0.02, (t.seams[2] as number) - 0.2), 0.05, t.roof - t.deck, 0.12, paint);
    // Door seams and handles.
    for (const z of t.seams) b.box(m.rubber, L(base, s * (CAR_W / 2 + 0.004), (0.36 + t.hood) / 2, z), 0.012, t.hood - 0.4, 0.022);
    for (const z of t.seams.slice(1)) b.box(m.enamel, L(base, s * (CAR_W / 2 + 0.01), t.hood - 0.1, z + 0.18), 0.02, 0.035, 0.14, g3(0.7));
    // Mirror.
    b.box(body, L(base, s * (CAR_W / 2 + 0.06), t.hood + 0.13, t.zw - 0.08, 0, s * 0.2), 0.16, 0.1, 0.06, paint);
  }
  // Glass damage: crazed white safety glass on the windshield, a gone side window.
  if (glass === 'smashed') {
    b.box(m.carGlass, sideSlab(base, 0, t.zw, t.hood, t.zrf + 0.1, t.roof - 0.05, 0.03), GLASS_W - 0.1, 0.01, Math.hypot(t.zrf + 0.1 - t.zw, t.roof - t.hood) - 0.06, [3.2, 3.3, 3.1]);
    const s = rng.next() < 0.5 ? -1 : 1;
    b.box(m.dark, L(base, s * (GLASS_W / 2 + 0.012), (t.hood + t.roof) / 2 - 0.02, ((t.seams[1] as number) + t.zrr) / 2), 0.01, t.roof - t.hood - 0.12, Math.abs((t.seams[1] as number) - t.zrr) - 0.16);
  }
  // Nose: bumper, round lamps, grille, plate. Tail: bumper, lamps, plate.
  const chrome: RGB = burnt ? g3(0.3) : rng.next() < 0.5 ? g3(0.85, 1, 1.02) : g3(0.25);
  for (const e of [-1, 1]) b.box(burnt ? m.rust : m.enamel, L(base, 0, 0.38, e * (h + 0.12)), CAR_W + 0.04, 0.14, 0.13, chrome);
  const lamp = new CylinderGeometry(0.095, 0.095, 0.06, 8);
  for (const s of [-1, 1]) {
    b.geo(burnt ? m.dark : m.stucco, lamp, L(base, s * 0.6, 0.62, h + 0.1, Math.PI / 2), [1.35, 1.32, 1.15]);
    b.box(burnt ? m.dark : m.stucco, L(base, s * 0.62, 0.7, -h - 0.1), 0.3, 0.13, 0.04, [1.2, 0.24, 0.16]);
  }
  b.box(m.rubber, L(base, 0, 0.62, h + 0.1), 0.78, 0.16, 0.04);
  for (const e of [-1, 1]) b.box(m.stucco, L(base, 0, e > 0 ? 0.5 : 0.56, e * (h + 0.19)), 0.48, 0.11, 0.015, burnt ? g3(0.3) : [1.3, 1.3, 1.25]);
  // Wheels (none on the bricks; bare rims on the burnt shell).
  const tire = new CylinderGeometry(0.31, 0.31, 0.2, 10);
  const hub = new CircleGeometry(0.15, 6);
  wheels.forEach(([x, z], i) => {
    const s = Math.sign(x);
    if (bricks) {
      for (let k = 0; k < 3; k++) b.box(m.brick, L(base, x * 0.95, -0.16 + 0.04 + k * 0.08, z + rng.range(-0.05, 0.05), 0, rng.range(-0.3, 0.3)), 0.24, 0.07, 0.115, g3(rng.range(0.8, 1.1)));
      return;
    }
    if (burnt) { b.geo(m.rust, new CylinderGeometry(0.22, 0.22, 0.16, 8), L(base, x, 0.22 + (sink[i] ?? 0), z, 0, 0, Math.PI / 2), g3(0.5)); return; }
    const f = flat[i] ? 0.76 : 1;
    b.geo(m.rubber, tire, S(L(base, x, 0.31 * f + (sink[i] ?? 0) - 0.01, z, 0, 0, Math.PI / 2), f, 1, 1));
    b.geo(m.enamel, hub, L(base, x + s * 0.105, 0.31 * f + (sink[i] ?? 0) - 0.01, z, 0, s * Math.PI / 2), g3(0.8));
  });
  // Open door (front, either side): door slab swung out, a dark opening behind it.
  if (rng.next() < 0.22) {
    const s = rng.next() < 0.5 ? -1 : 1;
    const z0 = t.seams[0] as number, z1 = t.seams[1] as number, dl = z0 - z1;
    const hinge = L(base, s * (CAR_W / 2 - 0.02), 0, z0, 0, -s * rng.range(0.7, 1.15));
    b.box(body, L(hinge, 0, (0.34 + t.hood) / 2, -dl / 2), 0.06, t.hood - 0.34, dl, paint);
    b.box(body, L(hinge, -s * 0.06, t.roof - 0.06, -dl / 2), 0.04, 0.05, dl - 0.1, paint);
    b.box(body, L(hinge, -s * 0.06, (t.hood + t.roof) / 2, -dl + 0.07), 0.04, t.roof - t.hood, 0.05, paint);
    b.box(m.dark, L(base, s * (CAR_W / 2 + 0.006), (0.36 + t.hood) / 2, (z0 + z1) / 2), 0.01, t.hood - 0.42, dl - 0.04);
    b.box(m.dark, L(base, s * (GLASS_W / 2 + 0.014), (t.hood + t.roof) / 2 - 0.02, (z0 + z1) / 2 - 0.05), 0.01, t.roof - t.hood - 0.1, dl - 0.25);
  }
  // Open hood or trunk lid; or a primer panel on the hood or a door in another color (a scrapyard part).
  const r = rng.next();
  if (r < 0.14) {
    const len = h - 0.3 - t.zw;
    b.box(m.dark, L(base, 0, t.hood + 0.004, t.zw + len / 2 + 0.05), 1.45, 0.01, len);
    b.box(m.rust, L(base, rng.range(-0.15, 0.15), t.hood + 0.06, t.zw + len / 2 + 0.1), 0.6, 0.12, 0.45, g3(0.6));
    b.box(body, L(L(base, 0, t.hood + 0.03, t.zw + 0.02, -rng.range(0.7, 1.1)), 0, 0, len / 2), 1.5, 0.04, len, paint);
  } else if (r < 0.26 && t.trunk) {
    const len = t.zrb - (-h + 0.3);
    b.box(m.dark, L(base, 0, t.deck + 0.004, t.zrb - len / 2), 1.45, 0.01, len);
    b.box(body, L(L(base, 0, t.deck + 0.03, t.zrb - 0.02, rng.range(0.8, 1.3)), 0, 0, -len / 2), 1.5, 0.04, len, paint);
  } else if (r < 0.42 && !burnt) {
    const other = rng.next() < 0.6 ? PRIMER : rng.pick(CAR_TINTS);
    if (rng.next() < 0.5) b.box(body, sideSlab(base, 0, t.zw + 0.12, t.hood + 0.005, h - 0.32, t.hood - 0.025, 0.012), 1.42, 0.012, h - 0.46 - t.zw, other);
    else {
      const s = rng.next() < 0.5 ? -1 : 1;
      const z0 = t.seams[0] as number, z1 = t.seams[1] as number;
      b.box(body, L(base, s * (CAR_W / 2 + 0.007), (0.4 + t.hood) / 2, (z0 + z1) / 2), 0.012, t.hood - 0.46, z0 - z1 - 0.06, other);
    }
  }
  // Moss and leaves on the roof of long-abandoned ones.
  if (!burnt && rng.next() < 0.3) {
    const ivy = new PlaneGeometry(1, 1);
    for (let i = 0; i < 3 + rng.int(3); i++) {
      const g = rng.range(0.55, 0.9);
      b.cards.of(m.ivy).add(ivy, S(L(base, rng.range(-0.5, 0.5), t.roof + 0.07, rng.range(t.zrr + 0.1, t.zrf - 0.1), -Math.PI / 2 + rng.range(-0.2, 0.2), 0, rng.range(0, 6)), 0.7, 0.7, 1), [g * 0.9, g, g * 0.65]);
    }
  }
}

// ---------------------------------------------------------------- shared parts

/** EUR pallet 1.2 × 0.8 m (along local x), 0.144 m high, weathered grey wood. */
function pallet(b: Builder, base: Matrix4, rng: Rng): void {
  const m = b.mats;
  const g = rng.range(0.62, 0.85);
  const wood: RGB = [g * 1.02, g, g * 0.9];
  for (let i = 0; i < 5; i++) if (rng.next() > 0.06) b.box(m.wood, L(base, 0, 0.133, -0.34 + i * 0.17), 1.2, 0.022, 0.12, mulT(wood, rng.range(0.9, 1.08)));
  for (const z of [-0.34, 0, 0.34]) {
    b.box(m.wood, L(base, 0, 0.111, z), 1.2, 0.022, 0.1, mulT(wood, 0.85));
    for (const x of [-0.55, 0, 0.55]) b.box(m.wood, L(base, x, 0.061, z), 0.1, 0.078, 0.1, mulT(wood, 0.75));
    b.box(m.wood, L(base, 0, 0.011, z), 1.2, 0.022, 0.1, mulT(wood, 0.7));
  }
}

const IVY = new PlaneGeometry(1, 1);
export function ivyPatch(b: Builder, base: Matrix4, rng: Rng, n: number, x0: number, x1: number, y0: number, y1: number, z: number, size = 0.8): void {
  for (let i = 0; i < n; i++) {
    const g = rng.range(0.55, 1);
    const s = size * rng.range(0.7, 1.3);
    b.cards.of(b.mats.ivy).add(IVY, S(L(base, rng.range(x0, x1), rng.range(y0, y1), z + rng.range(0, 0.05), rng.range(-0.3, 0.3), 0, rng.range(0, 6)), s, s, 1), [g * rng.range(0.8, 1.05), g, g * 0.7]);
  }
}

export function graffitiCell(cell: number): BufferGeometry {
  return cached(`graffiti-${cell}`, () => {
    const g = new PlaneGeometry(1, 1);
    const uv = g.getAttribute('uv');
    const u0 = (cell % 2) / 2, v0 = 0.5 - Math.floor(cell / 2) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
    return g;
  });
}

/** A lattice card w wide and len long (along its local y), the bay pattern repeating every w meters. */
function latticeCard(w: number, len: number): BufferGeometry {
  return cached(`lattice-${w}-${len}`, () => {
    const g = new PlaneGeometry(w, len);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * Math.round(len / w));
    return g;
  });
}

// ---------------------------------------------------------------- crane

const CRANE_YELLOW: RGB = [1.08, 0.8, 0.24];

/** Tower crane about 22 m: lattice tower on a fenced concrete base, cab, jib, counter-jib with weights, trolley, hook and load. */
function crane(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const yel = mulT(CRANE_YELLOW, rng.range(0.9, 1.05));
  const dirty = mulT(yel, 0.75);
  // Foundation, anchors, and a tight ring of red and white boards (some missing).
  b.box(m.concrete, L(base, 0, 0.25, 0), 2.6, 0.5, 2.6, g3(0.85));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(m.rust, L(base, sx * 0.75, 0.6, sz * 0.75), 0.3, 0.2, 0.3, g3(0.7));
  for (let side = 0; side < 4; side++) {
    const f = L(base, 0, 0, 0, 0, side * Math.PI / 2);
    for (const x of [-1.25, 1.25]) b.box(m.iron, L(f, x, 0.55, 1.27), 0.06, 1.1, 0.06, g3(0.9));
    if (rng.next() < 0.2) continue;
    for (let i = 0; i < 2; i++) b.box(m.stucco, L(f, 0, 0.45 + i * 0.4, 1.28, 0, 0, rng.range(-0.04, 0.04)), 2.5, 0.16, 0.03, i % 2 ? [1.3, 1.25, 1.2] : [1.25, 0.3, 0.22]);
  }
  // Tower: four chords and four lattice faces.
  const T0 = 0.5, T1 = 17.6, tw = 1.6, ht = T1 - T0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(m.enamel, L(base, sx * (tw / 2 - 0.06), (T0 + T1) / 2, sz * (tw / 2 - 0.06)), 0.13, ht, 0.13, yel);
  const face = latticeCard(tw, ht);
  for (let side = 0; side < 4; side++) b.cards.of(m.lattice).add(face, L(base, 0, (T0 + T1) / 2, 0, 0, side * Math.PI / 2).multiply(loc(0, 0, tw / 2 - 0.06)), yel);
  // Climbing ladder platform halfway and a rest platform under the slewing ring.
  for (const y of [9, T1 - 0.3]) b.box(m.enamel, L(base, 0, y, 0), tw + 0.5, 0.08, tw + 0.5, dirty);
  // Slewing unit, ring and cab.
  const yaw = rng.range(0, Math.PI * 2);
  const top = L(base, 0, T1, 0, 0, yaw);
  b.geo(m.iron, new CylinderGeometry(1.0, 1.0, 0.35, 14), L(top, 0, 0.18, 0), g3(0.6));
  b.box(m.enamel, L(top, 0, 0.6, 0), 2.0, 0.5, 2.0, yel);
  const cab = L(top, 0.4, 1.05, 1.45);
  b.box(m.enamel, cab, 1.3, 1.6, 1.5, mulT(yel, 1.02));
  b.box(m.enamel, L(cab, 0, 0.84, 0), 1.4, 0.08, 1.6, dirty);
  b.box(m.carGlass, L(cab, 0, 0.15, 0.755), 1.1, 1.0, 0.02, rng.next() < 0.5 ? [2.6, 2.7, 2.5] : [1, 1, 1]);
  b.box(m.carGlass, L(cab, 0.655, 0.2, 0.1), 0.02, 0.8, 1.0);
  // Jib (+x, 16 m) and counter-jib (-x): triangular truss, walkway, weights, winch.
  const J0 = 0.9, J1 = 17.5, jy = 0.85, jh = 1.25, jw = 0.62;
  const jibLen = J1 - J0, mid = (J0 + J1) / 2;
  const side = latticeCard(Math.hypot(jw, jh), jibLen);
  const lean = Math.atan2(jw, jh);
  for (const s of [-1, 1]) {
    b.cards.of(m.lattice).add(side, L(top, mid, jy + jh / 2, s * jw / 2, s * lean, 0, -Math.PI / 2), yel);
    beam(b, m.enamel, top, [J0, jy, s * jw], [J1, jy, s * jw * 0.6], 0.1, yel);
  }
  beam(b, m.enamel, top, [J0, jy + jh, 0], [J1, jy + 0.35, 0], 0.11, yel);
  b.box(m.enamel, L(top, J1 + 0.1, jy + 0.2, 0), 0.25, 0.6, 1.0, dirty);
  const C1 = -7.2;
  for (const s of [-1, 1]) {
    b.box(m.enamel, L(top, (C1 - 0.9) / 2, jy, s * 0.6), -C1 + 0.9, 0.3, 0.16, yel);
    b.box(m.iron, L(top, (C1 - 0.9) / 2, jy + 1.0, s * 0.78), -C1 + 0.9, 0.04, 0.04, g3(0.8));
  }
  b.cards.of(m.lattice).add(latticeCard(1.2, 6), L(top, (C1 - 0.9) / 2 + 0.5, jy + 0.12, 0, -Math.PI / 2, 0, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), g3(0.75));
  b.box(m.iron, L(top, -2.6, jy + 0.55, 0), 1.2, 0.8, 0.9, g3(0.7));
  for (let i = 0; i < 4; i++) {
    const tilt = rng.range(-0.03, 0.03);
    b.box(m.concrete, L(top, C1 + 0.45 + i * 0.42, jy - 0.55, 0, 0, 0, tilt), 0.38, 1.9, 1.7, g3(rng.range(0.6, 0.85)));
  }
  // Tower head and pendants.
  const apex: V3 = [0, 4.9, 0];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(b, m.enamel, top, [sx * 0.7, 0.85, sz * 0.7], apex, 0.12, yel);
  for (const s of [-1, 1]) {
    beam(b, m.iron, top, apex, [J1 * 0.62, jy + jh * 0.6, s * 0.05], 0.05, g3(0.6));
    beam(b, m.iron, top, apex, [C1 + 0.4, jy + 0.15, s * 0.6], 0.05, g3(0.6));
  }
  // Trolley, cable, hook block, load.
  const tx = rng.range(5, 14);
  const hookY = rng.range(-12, -6.5);
  b.box(m.enamel, L(top, tx, jy - 0.15, 0), 1.0, 0.3, 1.1, dirty);
  for (const s of [-1, 1]) beam(b, m.iron, top, [tx, jy - 0.3, s * 0.12], [tx, hookY + 0.35, s * 0.08], 0.025, g3(0.5));
  const hook = L(top, tx, hookY, 0, 0, rng.range(0, 3));
  b.box(m.enamel, hook, 0.45, 0.6, 0.3, yel);
  b.geo(m.iron, new TorusGeometry(0.16, 0.04, 4, 8, Math.PI * 1.4), L(hook, 0, -0.5, 0, 0, 0, 2.2), g3(0.6));
  const load = L(hook, 0, -0.6, 0);
  if (rng.next() < 0.5) {
    // Pallet of bricks on four chains.
    const py = -2.0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(b, m.iron, load, [0, 0, 0], [sx * 0.55, py + 0.9, sz * 0.36], 0.02, g3(0.45));
    pallet(b, L(load, 0, py, 0), rng);
    b.box(m.brick, L(load, 0, py + 0.5, 0), 1.1, 0.72, 0.74, g3(0.95));
  } else {
    // Concrete bucket.
    beam(b, m.iron, load, [0, 0, 0], [0, -0.6, 0], 0.03, g3(0.45));
    b.geo(m.enamel, new CylinderGeometry(0.55, 0.3, 1.1, 10), L(load, 0, -1.25, 0), mulT(dirty, 0.85));
    b.geo(m.concrete, new CircleGeometry(0.52, 10), L(load, 0, -0.72, 0, -Math.PI / 2), g3(0.75));
  }
}

// ---------------------------------------------------------------- container

const BOX_TINTS: RGB[] = [[0.8, 0.34, 0.24], [0.44, 0.6, 0.8], [0.48, 0.64, 0.44], [0.8, 0.8, 0.76], [1.0, 0.58, 0.26], [0.92, 0.74, 0.36], [0.62, 0.3, 0.28]];

/** 20 ft shipping container 2.44 × 2.6 × 6.1 (length along local z), doors at +z, some open; maybe a second one stacked. */
function container(b: Builder, base: Matrix4, rng: Rng, stacked: boolean): void {
  const m = b.mats;
  const tint = mulT(rng.pick(BOX_TINTS), rng.range(0.85, 1.05));
  const W = 2.44, H = 2.6, D = 6.1;
  b.box(m.corrugated, L(base, 0, H / 2, 0), W - 0.06, H - 0.1, D - 0.1, tint, 1 / 2.4);
  // Frame: corner posts, top and bottom rails, darker.
  const frame = mulT(tint, 0.7);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(m.enamel, L(base, sx * (W / 2 - 0.08), H / 2, sz * (D / 2 - 0.08)), 0.16, H, 0.16, frame);
  for (const sx of [-1, 1]) for (const y of [0.08, H - 0.07]) b.box(m.enamel, L(base, sx * (W / 2 - 0.06), y, 0), 0.13, 0.15, D - 0.2, frame);
  for (const sz of [-1, 1]) for (const y of [0.08, H - 0.07]) b.box(m.enamel, L(base, 0, y, sz * (D / 2 - 0.06)), W - 0.2, 0.15, 0.13, frame);
  // Doors: two leaves with locking bars; each may hang open.
  const open = [rng.next() < 0.3, rng.next() < 0.3];
  if (open[0] || open[1]) b.box(m.dark, L(base, 0, H / 2, D / 2 - 0.04), W - 0.3, H - 0.3, 0.02);
  for (const [i, s] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const ang = open[i] ? s * rng.range(1.6, 2.9) : 0;
    const hinge = L(base, s * (W / 2 - 0.1), 0, D / 2 + 0.02, 0, ang);
    const leaf = L(hinge, -s * (W / 4 - 0.05), H / 2, 0);
    b.box(m.corrugated, leaf, W / 2 - 0.12, H - 0.3, 0.04, mulT(tint, 0.95), 0.42);
    for (const x of [-0.18, 0.18]) {
      b.box(m.iron, L(leaf, x, 0, 0.05), 0.045, H - 0.3, 0.045, g3(0.75));
      b.box(m.iron, L(leaf, x + 0.08, -0.15, 0.07), 0.16, 0.04, 0.04, g3(0.6));
    }
  }
  if (rng.next() < 0.45) {
    const s = rng.next() < 0.5 ? -1 : 1;
    const gw = rng.range(1.6, 2.6);
    b.cards.of(m.graffiti).add(graffitiCell(rng.int(4)), S(L(base, s * (W / 2 + 0.03), rng.range(0.9, 1.3), rng.range(-1.5, 1.2), 0, s * Math.PI / 2), gw, gw * 0.5, 1));
  }
  if (stacked) container(b, L(base, rng.range(-0.15, 0.15), H + 0.01, rng.range(-0.3, 0.3), 0, rng.range(-0.12, 0.12)), rng, false);
}


// ---------------------------------------------------------------- scaffold

/** Baugerüst along a wall (wall side = -z): galvanized tubes, plank decks, braces, a ladder, a torn tarp or net. */
function scaffold(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const len = Math.max(2, p.size);
  const levels = 2 + rng.int(2);
  const top = levels * 2 + 1;
  const nb = Math.max(1, Math.round(len / 2.5));
  const bay = len / nb;
  const tube = g3(0.78, 0.98, 1.02);
  const tw = 0.05;
  const zf = 0.38, zb = -0.38;
  const xs = Array.from({ length: nb + 1 }, (_, i) => -len / 2 + i * bay);
  // Standards (some leaning a little) with base plates.
  for (const x of xs) for (const z of [zf, zb]) {
    const lx = rng.range(-0.03, 0.03), lz = rng.range(-0.02, 0.02);
    beam(b, m.enamel, base, [x, 0, z], [x + lx * top, top, z + lz * top], tw, tube);
    b.box(m.iron, L(base, x, 0.02, z), 0.16, 0.04, 0.16, g3(0.6));
  }
  for (let k = 1; k <= levels; k++) {
    const y = k * 2;
    // Ledgers front and back, transoms, guard rails.
    for (const z of [zf, zb]) beam(b, m.enamel, base, [-len / 2 - 0.1, y, z], [len / 2 + 0.1, y + rng.range(-0.03, 0.03), z], tw, tube);
    for (const x of xs) beam(b, m.enamel, base, [x, y + 0.04, zb - 0.1], [x, y + 0.04, zf + 0.1], tw, tube);
    for (const dy of [0.5, 1.0]) beam(b, m.enamel, base, [-len / 2, y + dy, zf], [len / 2, y + dy + rng.range(-0.04, 0.04), zf], tw, tube);
    // Plank deck, a board missing here and there, toe board.
    for (let i = 0; i < 3; i++) {
      if (rng.next() < 0.12) continue;
      const g = rng.range(0.7, 1);
      b.box(m.wood, L(base, rng.range(-0.1, 0.1), y + 0.09, -0.25 + i * 0.25, 0, rng.range(-0.01, 0.01)), len + rng.range(-0.3, 0.1), 0.04, 0.23, [g, g * 0.95, g * 0.8]);
    }
    b.box(m.wood, L(base, 0, y + 0.18, zf + 0.03), len, 0.15, 0.03, g3(0.6, 1.05, 0.85));
  }
  // Diagonal braces on the front face.
  for (let i = 0; i < nb; i++) {
    const x0 = xs[i] as number, x1 = xs[i + 1] as number;
    if (i % 2) beam(b, m.enamel, base, [x0, 0.2, zf + 0.06], [x1, levels * 2, zf + 0.06], tw, tube);
    else beam(b, m.enamel, base, [x1, 0.2, zf + 0.06], [x0, levels * 2, zf + 0.06], tw, tube);
  }
  // Ladder in the first bay up to level 1.
  const lx = (xs[0] as number) + bay * 0.3;
  for (const dx of [-0.2, 0.2]) beam(b, m.enamel, base, [lx + dx, 0, -0.05], [lx + dx + 0.05, 2.9, 0.05], 0.04, g3(0.7));
  for (let i = 1; i < 10; i++) b.box(m.enamel, L(base, lx + 0.02, i * 0.28, -0.05 + i * 0.01), 0.4, 0.03, 0.03, g3(0.7));
  // Tarp or green safety net hanging off the front, torn.
  const sheets = 1 + rng.int(2);
  const sheet = new PlaneGeometry(1, 1, 2, 2);
  for (let i = 0; i < sheets; i++) {
    const w = Math.min(len, bay * rng.range(0.8, 1.6));
    const h = rng.range(2.5, top - 0.5);
    const x = rng.range(-len / 2 + w / 2, len / 2 - w / 2);
    const tint: RGB = rng.pick([[0.55, 0.85, 0.5], [0.55, 0.7, 0.95], [1.05, 1.05, 1.0], [0.6, 0.8, 0.55]] as RGB[]);
    b.cards.of(m.tarp).add(sheet, S(L(base, x, top - 0.1 - h / 2, zf + 0.12 + i * 0.03, rng.range(-0.06, 0.06), 0, rng.range(-0.03, 0.03)), w, h, 1), tint);
  }
}

// ---------------------------------------------------------------- Rohbau

/** Unfinished concrete frame 8 × 6 m × size: slabs on columns, the top floor partial, rebar, stair core, brick infill, stacked bricks, props. */
function rohbau(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const s = p.size;
  const base = at(p);
  const W = 8 * s, D = 6 * s, fh = 3.2;
  const con = (g = 1): RGB => g3(rng.range(0.82, 1) * g, 1, 0.97);
  const rust: RGB = g3(0.65);
  const rebar = (x: number, y: number, z: number, n: number, len: number): void => {
    for (let i = 0; i < n; i++) {
      const ox = rng.range(-0.12, 0.12), oz = rng.range(-0.12, 0.12);
      beam(b, m.rust, base, [x + ox, y, z + oz], [x + ox + rng.range(-0.15, 0.15), y + len * rng.range(0.6, 1.1), z + oz + rng.range(-0.15, 0.15)], 0.03, rust);
    }
  };
  // Ground plate and first slab.
  b.box(m.roughConcrete, L(base, 0, 0.12, 0), W, 0.24, D, con(0.9));
  b.box(m.roughConcrete, L(base, 0, fh + 0.12, 0), W - 0.1, 0.26, D - 0.1, con());
  // Top slab: only the rear part, ragged at the front edge.
  const cuts = 4;
  for (let i = 0; i < cuts; i++) {
    const w = (W - 0.1) / cuts;
    const d = D * rng.range(0.45, 0.75);
    const x = -W / 2 + 0.05 + w * (i + 0.5);
    if (i === cuts - 1 && rng.next() < 0.5) continue;
    b.box(m.roughConcrete, L(base, x, fh * 2 + 0.12, -D / 2 + 0.05 + d / 2, rng.range(-0.01, 0.01)), w - 0.02, 0.26, d, con());
    rebar(x, fh * 2 + 0.12, -D / 2 + 0.05 + d, 3, 0.5);
  }
  // Columns: a full ground floor; on the first floor only some, the rest end in rebar stubs.
  const cx = [-W / 2 + 0.3, 0, W / 2 - 0.3], cz = [-D / 2 + 0.3, 0, D / 2 - 0.3];
  for (const x of cx) for (const z of cz) {
    if (x === cx[0] && z === cz[0]) continue;
    b.box(m.roughConcrete, L(base, x, fh / 2 + 0.12, z), 0.36, fh, 0.36, con(0.92));
    if (z === cz[2] && rng.next() < 0.6) rebar(x, fh + 0.25, z, 4, 0.9);
    else {
      b.box(m.roughConcrete, L(base, x, fh * 1.5 + 0.25, z), 0.34, fh - 0.1, 0.34, con(0.95));
      if (z !== cz[0]) rebar(x, fh * 2 + 0.25, z, 4, 0.8);
    }
  }
  // Stair core in the rear corner, door holes per floor.
  const sx = -W / 2 + 1.25, sz = -D / 2 + 1.25;
  for (const [x, z, w, d] of [[sx, -D / 2 + 0.1, 2.5, 0.2], [-W / 2 + 0.1, sz, 0.2, 2.5], [sx, sz + 1.15, 2.5, 0.2]] as Array<[number, number, number, number]>) {
    b.box(m.roughConcrete, L(base, x, fh + 0.6, z), w, fh * 2 + 0.7, d, con(0.85));
  }
  for (let k = 0; k < 2; k++) b.box(m.dark, L(base, sx + 0.3, 0.25 + k * fh + 1.05, sz + 1.26), 0.9, 2.0, 0.01);
  b.box(m.roughConcrete, L(base, sx + 0.1, 1.2, sz + 0.1, 0.62), 1.0, 0.2, 2.6, con(0.8));
  // Brick infill started on the rear wall, stepped top.
  for (let row = 0; row < 8; row++) {
    const len = (W / 2 - 1.2) * (1 - row * rng.range(0.06, 0.12));
    if (len < 0.5) break;
    b.box(m.brick, L(base, 0.4 + len / 2 - 0.2, 0.36 + row * 0.25, -D / 2 + 0.2), len, 0.25, 0.24, g3(rng.range(0.85, 1)));
  }
  // Formwork props under the top slab's edge, a pallet of bricks, cement sacks.
  for (let i = 0; i < 3; i++) beam(b, m.rust, base, [rng.range(-W / 3, W / 3), fh + 0.25, rng.range(-0.5, 0.5)], [rng.range(-W / 3, W / 3), fh * 2, rng.range(-0.5, 0.5)], 0.06, g3(0.8));
  const pb = L(base, rng.range(0.5, W / 2 - 1.2), 0.24, rng.range(0.4, D / 2 - 1), 0, rng.range(-0.3, 0.3));
  pallet(b, pb, rng);
  b.box(m.brick, L(pb, 0, 0.52, 0), 1.1, 0.74, 0.74, g3(0.95));
  for (let i = 0; i < 4; i++) b.geo(m.burlap, SACK, S(L(base, 1.4 + (i % 2) * 0.55, 0.36 + Math.floor(i / 2) * 0.22, D / 2 - 1.4, 0, rng.range(-0.2, 0.2)), 0.5, 0.22, 0.75), [1.25, 1.2, 1.1]);
  // Weeds in the ground floor.
  ivyPatch(b, base, rng, 6, -W / 2 + 1, W / 2 - 1, 0.3, 0.6, D / 2 - 0.3, 0.6);
}
const SACK = new SphereGeometry(0.5, 8, 5);

// ---------------------------------------------------------------- pallets

/** Stack of pallets with bricks, wrapped cement sacks or just more pallets. */
function pallets(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p, rng.range(-0.05, 0.05), 0, 0, 0, rng.range(-0.1, 0.1));
  const kind = rng.pick(['bricks', 'sacks', 'empty'] as const);
  const n = kind === 'empty' ? 3 + rng.int(2) : 1 + rng.int(2);
  for (let i = 0; i < n; i++) pallet(b, L(base, rng.range(-0.04, 0.04), i * 0.145, rng.range(-0.04, 0.04), 0, rng.range(-0.06, 0.06)), rng);
  const y = n * 0.145;
  if (kind === 'bricks') {
    const h = rng.range(0.5, 0.9);
    b.box(m.brick, L(base, 0, y + h / 2, 0), 1.12, h, 0.76, g3(rng.range(0.85, 1.05)));
    for (let i = 0; i < 3; i++) b.box(m.brick, L(base, rng.range(-0.4, 0.4), y + h + 0.04, rng.range(-0.25, 0.25), 0, rng.range(0, 3)), 0.24, 0.07, 0.115, g3(rng.range(0.8, 1)));
    // Strapping bands.
    for (const x of [-0.3, 0.3]) b.box(m.iron, L(base, x, y + h / 2, 0), 0.03, h + 0.01, 0.77, g3(0.6));
  } else if (kind === 'sacks') {
    const c: RGB = rng.pick([[1.3, 1.25, 1.12], [1.1, 1.0, 0.8], [0.9, 0.95, 1.05]] as RGB[]);
    for (let l = 0; l < 3; l++) for (let i = 0; i < 2; i++) {
      if (l === 2 && rng.next() < 0.4) continue;
      b.geo(m.burlap, SACK, S(L(base, (i - 0.5) * 0.56 + rng.range(-0.03, 0.03), y + 0.1 + l * 0.2, rng.range(-0.04, 0.04), 0, (l % 2) * 0.1 + rng.range(-0.08, 0.08)), 0.54, 0.2, 0.76), mulT(c, rng.range(0.9, 1.05)));
    }
  }
}

// ---------------------------------------------------------------- ticket machine

/** Parkscheinautomat: pillar with head, display, slot and a blue P plate; some tilted or smashed. */
function ticketMachine(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const tilt = rng.next() < 0.3;
  const base = at(p, 0, 0, 0, tilt ? rng.range(-0.25, 0.25) : 0, rng.range(-0.1, 0.1), tilt ? rng.range(-0.15, 0.15) : 0);
  const body: RGB = rng.pick([[0.62, 0.66, 0.68], [0.95, 0.82, 0.42], [0.5, 0.6, 0.72]] as RGB[]);
  b.box(m.concrete, L(base, 0, 0.05, 0), 0.5, 0.1, 0.4, g3(0.8));
  b.box(m.enamel, L(base, 0, 0.62, 0), 0.38, 1.05, 0.28, body);
  b.box(m.enamel, L(base, 0, 1.38, 0.02), 0.5, 0.5, 0.36, mulT(body, 1.05));
  b.box(m.enamel, L(base, 0, 1.66, 0.02), 0.56, 0.06, 0.42, mulT(body, 0.6));
  const smashed = rng.next() < 0.35;
  b.box(smashed ? m.dark : m.carGlass, L(base, 0, 1.46, 0.205), 0.3, 0.14, 0.01, smashed ? [1, 1, 1] : [1.4, 1.8, 1.6]);
  b.box(m.rubber, L(base, -0.1, 1.28, 0.205), 0.08, 0.025, 0.01);
  for (let i = 0; i < 6; i++) b.box(m.enamel, L(base, 0.05 + (i % 3) * 0.05, 1.3 - Math.floor(i / 3) * 0.05, 0.205), 0.035, 0.035, 0.01, g3(0.35));
  b.box(m.dark, L(base, 0, 0.75, 0.145), 0.18, 0.1, 0.01);
  // Blue P plate on top.
  const plate = L(base, 0, 1.92, 0.02);
  b.box(m.iron, L(base, 0, 1.8, 0.02), 0.04, 0.2, 0.04);
  b.box(m.enamel, plate, 0.32, 0.32, 0.03, [0.25, 0.42, 0.85]);
  for (const [x, y, w, h] of [[-0.05, 0, 0.04, 0.2], [0.02, 0.08, 0.1, 0.035], [0.02, 0.01, 0.1, 0.035], [0.065, 0.045, 0.035, 0.07]] as Array<[number, number, number, number]>) b.box(m.enamel, L(plate, x, y, 0.02), w, h, 0.01, [1.4, 1.4, 1.4]);
  if (smashed) b.box(m.enamel, L(base, 0.2, 0.62, 0.1, 0, 1.2), 0.3, 0.7, 0.02, body);
}

// ---------------------------------------------------------------- boom

/** Parking barrier: post housing and a red-white arm along +x; closed, raised or snapped. */
function boom(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const house: RGB = rng.pick([[1.1, 1.08, 1.0], [1.05, 0.85, 0.35], [0.9, 0.9, 0.85]] as RGB[]);
  b.box(m.concrete, L(base, 0, 0.04, 0), 0.5, 0.08, 0.5, g3(0.75));
  b.box(m.enamel, L(base, 0, 0.55, 0), 0.34, 1.0, 0.3, house);
  b.box(m.enamel, L(base, 0, 1.07, 0), 0.38, 0.05, 0.34, mulT(house, 0.6));
  b.geo(m.iron, new CylinderGeometry(0.08, 0.08, 0.1, 8), L(base, 0, 0.9, 0.18, Math.PI / 2), g3(0.7));
  const state = rng.pick(['closed', 'raised', 'snapped', 'closed'] as const);
  const len = state === 'snapped' ? rng.range(0.9, 1.8) : 4.2;
  const ang = state === 'raised' ? rng.range(1.15, 1.45) : state === 'snapped' ? rng.range(-0.15, 0.05) : rng.range(-0.02, 0.02);
  const arm = L(base, 0.1, 0.9, 0.26, 0, 0, ang);
  const seg = 0.6;
  const stripes = (frame: Matrix4, n: number, from: number): void => {
    for (let i = 0; i < n; i++) b.box(m.enamel, L(frame, from + (i + 0.5) * seg, 0, 0), seg, 0.09, 0.06, (i + Math.round(from / seg)) % 2 ? [1.3, 1.28, 1.2] : [1.2, 0.22, 0.16]);
  };
  stripes(arm, Math.ceil(len / seg), 0);
  if (state === 'closed') {
    // Fork rest at the far end.
    b.box(m.enamel, L(base, 4.3, 0.42, 0.26), 0.08, 0.84, 0.08, house);
    b.box(m.enamel, L(base, 4.3, 0.86, 0.26), 0.08, 0.06, 0.2, house);
  }
  if (state === 'snapped') {
    const piece = L(base, rng.range(2.0, 3.0), 0.05, rng.range(0.6, 1.4), 0, rng.range(-0.6, 0.6), 0);
    stripes(L(piece, -1.5, 0, 0, 0, 0, 0), 5, Math.ceil(len / seg) * seg);
  }
}

// ---------------------------------------------------------------- bikes

/** One bike along local z, wheels on the ground plane of `base`. */
function bike(b: Builder, base: Matrix4, rng: Rng, noFront: boolean): void {
  const m = b.mats;
  const c: RGB = mulT(rng.pick([[0.85, 0.25, 0.2], [0.3, 0.45, 0.7], [0.3, 0.45, 0.32], [0.25, 0.25, 0.25], [0.9, 0.85, 0.75], [0.85, 0.65, 0.25]] as RGB[]), rng.range(0.8, 1.05));
  const wheel = cached('bike-wheel', () => new TorusGeometry(0.33, 0.022, 3, 12));
  const rear: V3 = [0, 0.34, -0.52], front: V3 = [0, 0.34, 0.52], bb: V3 = [0, 0.3, -0.05], seat: V3 = [0, 0.92, -0.2], head: V3 = [0, 0.9, 0.36], low: V3 = [0, 0.72, 0.42];
  b.geo(m.rubber, wheel, L(base, 0, 0.34, -0.52, 0, Math.PI / 2));
  if (!noFront) b.geo(m.rubber, wheel, L(base, 0, 0.34, 0.52, 0, Math.PI / 2, rng.range(-0.05, 0.05)));
  for (const [a, e] of [[bb, seat], [seat, head], [bb, low], [bb, rear], [seat, rear], [low, front]] as Array<[V3, V3]>) beam(b, m.enamel, base, a, e, 0.03, c);
  beam(b, m.enamel, base, head, [0, 1.0, 0.32], 0.03, g3(0.5));
  b.box(m.enamel, L(base, 0, 1.0, 0.32), 0.52, 0.025, 0.025, g3(0.5));
  b.box(m.rubber, L(base, 0, 0.97, -0.22), 0.12, 0.05, 0.24);
}

/** Ground rack (Felgenkiller) with two or three rusty bikes, some fallen. */
function bikes(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const rack = g3(0.55);
  for (const z of [-0.12, 0.12]) b.box(m.rust, L(base, 0, 0.3, z), 2.2, 0.03, 0.03, rack);
  for (let i = 0; i < 6; i++) {
    const x = -1.0 + i * 0.4;
    beam(b, m.rust, base, [x, 0, -0.18], [x, 0.32, -0.12], 0.03, rack);
    beam(b, m.rust, base, [x, 0, 0.18], [x, 0.32, 0.12], 0.03, rack);
  }
  const n = 2 + rng.int(2);
  const slots = [-0.8, -0.4, 0, 0.4, 0.8].sort(() => rng.next() - 0.5).slice(0, n);
  for (const x of slots) {
    const fallen = rng.next() < 0.4;
    const fx = x + rng.range(-0.05, 0.05);
    if (fallen) bike(b, L(base, fx + 0.1, 0.035, rng.range(0.4, 0.9), 0, rng.range(-0.8, 0.8), (rng.next() < 0.5 ? -1 : 1) * Math.PI / 2 * 0.97).multiply(loc(0, -0.0, 0)), rng, rng.next() < 0.3);
    else bike(b, L(base, fx, 0, -0.3 + 0.9, 0, Math.PI + rng.range(-0.08, 0.08), rng.range(-0.12, 0.12)), rng, false);
  }
}

// ---------------------------------------------------------------- clothesline

function clothGeo(kind: number): BufferGeometry {
  return cached(`cloth-${kind}`, () => {
    if (kind === 2) {
      // Shirt outline.
      const s = new Shape([[-0.22, 0], [0.22, 0], [0.22, -0.12], [0.42, -0.22], [0.36, -0.32], [0.2, -0.24], [0.2, -0.68], [-0.2, -0.68], [-0.2, -0.24], [-0.36, -0.32], [-0.42, -0.22], [-0.22, -0.12]].map(([x, y]) => new Vector2(x, y)));
      return new ShapeGeometry(s);
    }
    const w = kind === 0 ? 1.3 : 0.55, h = kind === 0 ? 1.45 : 0.8;
    const g = new PlaneGeometry(w, h, 4, 3);
    g.translate(0, -h / 2, 0);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * 5) * 0.05 + y * y * 0.1); }
    g.computeVertexNormals();
    return g;
  });
}

/** Two T-poles and two sagging lines with sheets, towels and shirts; one item fallen. Walk-through. */
function clothesline(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const len = Math.max(2.5, p.size);
  const h = len / 2;
  for (const x of [-h, h]) {
    b.box(m.darkWood, L(base, x, 1.05, 0, 0, 0, rng.range(-0.05, 0.05)), 0.09, 2.1, 0.09, g3(0.8));
    b.box(m.darkWood, L(base, x, 2.0, 0), 0.07, 0.07, 0.75, g3(0.8));
  }
  const sag = 0.25;
  const lineY = (u: number): number => 1.98 - sag * 4 * u * (1 - u);
  for (const z of [-0.3, 0.3]) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      beam(b, m.iron, base, [-h + u0 * len, lineY(u0), z], [-h + u1 * len, lineY(u1), z], 0.015, g3(0.8));
    }
  }
  const colors: RGB[] = [[1.3, 1.28, 1.2], [1.25, 1.25, 1.25], [0.75, 0.9, 1.25], [1.25, 0.85, 0.85], [1.25, 1.15, 0.7], [0.8, 1.1, 0.85], [1.1, 0.6, 0.45]];
  for (const z of [-0.3, 0.3]) {
    let u = rng.range(0.03, 0.15);
    while (u < 0.92) {
      const kind = rng.pick([0, 0, 1, 1, 2]);
      const w = kind === 0 ? 1.3 : kind === 1 ? 0.55 : 0.84;
      const uc = u + w / 2 / len;
      if (uc + w / 2 / len > 0.98) break;
      if (rng.next() < 0.85) b.geo(m.linen, clothGeo(kind), L(base, -h + uc * len, lineY(uc) - 0.01, z, rng.range(-0.15, 0.15), rng.range(-0.1, 0.1), rng.range(-0.04, 0.04)), mulT(rng.pick(colors), rng.range(0.85, 1)));
      u += w / len + rng.range(0.02, 0.12);
    }
  }
  // A sheet blown down onto the ground.
  if (rng.next() < 0.6) b.geo(m.linen, clothGeo(0), L(base, rng.range(-h, h), 0.03, rng.range(0.6, 1.2), -Math.PI / 2 + 0.05, rng.range(0, 3)), mulT(rng.pick(colors), 0.8));
}

// ---------------------------------------------------------------- gravestones

function headstoneGeo(w: number, h: number, top: number): BufferGeometry {
  return cached(`stone-${w}-${h}-${top}`, () => {
    const pts: Array<[number, number]> = [[-w / 2, 0], [w / 2, 0], [w / 2, h - top]];
    for (let i = 1; i < 6; i++) { const a = (i / 6) * Math.PI; pts.push([Math.cos(a) * w / 2, h - top + Math.sin(a) * top]); }
    pts.push([-w / 2, h - top]);
    // Profile in x-y, extruded along z (thickness): reuse extrudeSide by swapping axes.
    const g = extrudeSide(pts, 0.15, 0.025, 1, 0.5, 0.7);
    g.rotateY(Math.PI / 2);
    return g;
  });
}

/** Gravestone variants: upright rounded, cross, lying slab, broken, tilted, mossy; inscriptions, some with a grave border. */
function gravestone(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const stone: RGB = mulT(rng.pick([[1.12, 1.0, 0.8], [0.92, 0.92, 0.9], [0.5, 0.5, 0.54], [1.15, 1.12, 1.05], [0.75, 0.68, 0.6]] as RGB[]), rng.range(0.9, 1.05));
  const v = rng.pick(['round', 'round', 'cross', 'slab', 'broken', 'tilted'] as const);
  const mossy = rng.next() < 0.35;
  const tint = mossy ? [stone[0] * 0.8, stone[1] * 0.92, stone[2] * 0.7] as RGB : stone;
  const tilted = v === 'tilted' || rng.next() < 0.2;
  const base = at(p, 0, 0, 0, tilted ? rng.range(-0.3, 0.2) : rng.range(-0.04, 0.04), rng.range(-0.12, 0.12), tilted ? rng.range(-0.18, 0.18) : 0);
  const text = (frame: Matrix4, y: number, w: number, z: number): void => {
    for (let i = 0; i < 3; i++) b.box(m.rubber, L(frame, 0, y - i * 0.09, z), w * (i === 0 ? 0.7 : rng.range(0.4, 0.6)), 0.03, 0.01, g3(1.4));
  };
  if (v !== 'slab') b.box(m.stoneMoss, L(base, 0, 0.06, 0), 0.72, 0.12, 0.3, mulT(tint, 0.85));
  if (v === 'round' || v === 'tilted') {
    const h = rng.range(0.7, 1.0);
    b.geo(m.stoneMoss, headstoneGeo(0.6, h, rng.pick([0.12, 0.3])), L(base, 0, 0.12, 0), tint);
    text(base, 0.12 + h * 0.7, 0.4, 0.085);
  } else if (v === 'cross') {
    b.box(m.stoneMoss, L(base, 0, 0.32, 0), 0.4, 0.4, 0.22, tint);
    b.box(m.stoneMoss, L(base, 0, 0.98, 0), 0.12, 0.95, 0.12, tint);
    b.box(m.stoneMoss, L(base, 0, 1.18, 0), 0.5, 0.12, 0.12, tint);
    text(base, 0.44, 0.3, 0.115);
  } else if (v === 'slab') {
    b.box(m.stoneMoss, L(base, 0, 0.08, 0.3), 0.62, 0.16, 1.2, tint);
    b.box(m.stoneMoss, L(base, 0, 0.3, -0.18, -0.25), 0.62, 0.45, 0.14, tint);
    text(L(base, 0, 0.3, -0.18, -0.25), 0.12, 0.4, 0.075);
  } else {
    // Broken: the stump stands, the top lies in front.
    const h = rng.range(0.35, 0.5);
    b.box(m.stoneMoss, L(base, 0, 0.12 + h / 2, 0, 0, 0, 0), 0.6, h, 0.15, tint);
    b.box(m.stoneMoss, L(base, 0.1, 0.12 + h + 0.02, 0, 0, 0, 0.35), 0.3, 0.06, 0.14, tint);
    b.geo(m.stoneMoss, headstoneGeo(0.6, 0.45, 0.3), L(base, rng.range(-0.2, 0.2), 0.08, 0.55, -Math.PI / 2 + 0.1, rng.range(-0.5, 0.5)), tint);
  }
  // Grave border with weeds, or moss at the foot.
  if (v !== 'slab' && rng.next() < 0.5) {
    const g = mulT(stone, 0.8);
    for (const x of [-0.4, 0.4]) b.box(m.stoneMoss, L(base, x, 0.05, 0.95, 0, rng.range(-0.03, 0.03)), 0.08, 0.1, 1.6, g);
    b.box(m.stoneMoss, L(base, 0, 0.05, 1.72), 0.88, 0.1, 0.08, g);
    ivyPatch(b, L(base, 0, 0, 0, -Math.PI / 2), rng, 3, -0.3, 0.3, -1.6, -0.3, 0.06, 0.6);
  }
  if (mossy) ivyPatch(b, base, rng, 3, -0.3, 0.3, 0.1, 0.4, 0.12, 0.45);
}

// ---------------------------------------------------------------- walls

/** Brick yard wall 2.2 m, length size: broken top, piers, holes, coping where intact, ivy and graffiti. */
function wall(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const len = Math.max(1, p.size);
  const H = 2.2, t = 0.36;
  const n = Math.max(1, Math.round(len / 0.5));
  const sw = len / n;
  // Heights: a random walk down from full height, with a breach now and then.
  const hs: number[] = [];
  let h = H, breach = rng.next() < 0.5 ? rng.int(n) : -9;
  for (let i = 0; i < n; i++) {
    h = Math.min(H, Math.max(0.9, h + (rng.next() < 0.55 ? 0.25 : -0.35) * rng.next()));
    hs.push(Math.abs(i - breach) <= 1 ? rng.range(0.6, 1.1) : h);
  }
  const low = Math.floor(Math.min(...hs) * 2) / 2;
  const tint = g3(rng.range(0.85, 1.0), 1, 0.95);
  b.box(m.brickRuin, L(base, 0, low / 2, 0), len, low, t, tint);
  hs.forEach((hh, i) => {
    if (hh <= low + 0.02) return;
    const x = -len / 2 + (i + 0.5) * sw;
    b.box(m.brickRuin, L(base, x, low + (hh - low) / 2, 0), sw + 0.002, hh - low, t, tint);
    if (hh >= H - 0.01) b.box(m.brickRuin, L(base, x, H + 0.04, 0), sw + 0.01, 0.08, t + 0.06, g3(0.6));
  });
  // Piers every ~3 m.
  const np = Math.max(2, Math.round(len / 3) + 1);
  for (let i = 0; i < np; i++) {
    const x = -len / 2 + 0.25 + (i * (len - 0.5)) / (np - 1);
    const hh = hs[Math.min(n - 1, Math.floor(((x + len / 2) / len) * n))] as number;
    if (hh < H - 0.3) continue;
    b.box(m.brickRuin, L(base, x, (H + 0.15) / 2, 0), 0.5, H + 0.15, 0.48, mulT(tint, 0.92));
    b.box(m.concrete, L(base, x, H + 0.2, 0), 0.58, 0.1, 0.56, g3(0.7));
  }
  // Missing bricks (dark holes on either face) and bricks fallen at the foot.
  for (let i = 0; i < Math.round(len * 0.8); i++) {
    const s = rng.next() < 0.5 ? -1 : 1;
    b.box(m.brickRuin, L(base, rng.range(-len / 2 + 0.3, len / 2 - 0.3), rng.range(0.3, low - 0.1), s * (t / 2 + 0.002)), 0.24, 0.07, 0.01, g3(0.25));
  }
  for (let i = 0; i < Math.round(len * 0.6); i++) b.box(m.brickRuin, L(base, rng.range(-len / 2, len / 2), 0.04, (rng.next() < 0.5 ? -1 : 1) * rng.range(0.3, 0.8), rng.range(-0.3, 0.3), rng.range(0, 3), 0), 0.24, 0.07, 0.115, g3(rng.range(0.75, 1)));
  if (rng.next() < 0.7) { const x = rng.range(-len / 2 + 0.5, len / 2 - 0.5); ivyPatch(b, base, rng, Math.round(4 + len * 0.8), x - 1.5, x + 1.5, 0.2, low + 0.5, t / 2 + 0.04, 0.9); }
  if (len > 2 && rng.next() < 0.6) {
    const gw = Math.min(len - 0.5, rng.range(1.6, 2.8));
    b.cards.of(m.graffiti).add(graffitiCell(rng.int(4)), S(L(base, rng.range(-len / 2 + gw / 2, len / 2 - gw / 2), Math.min(low, 1.6) * 0.55 + 0.1, t / 2 + 0.015), gw, gw * 0.5, 1));
  }
}

/** Cemetery wall about 1.1 m: plastered brick with bare patches, stone cap slabs (some askew or gone), piers. */
function lowWall(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const base = at(p);
  const len = Math.max(1, p.size);
  const H = 1.05, t = 0.34;
  const plaster: RGB = g3(rng.range(0.7, 0.85), 1.05, 0.9);
  b.box(m.stucco, L(base, 0, H / 2, 0), len, H, t, plaster);
  for (let i = 0; i < Math.round(len * 0.5); i++) {
    const s = rng.next() < 0.5 ? -1 : 1;
    b.box(m.brickRuin, L(base, rng.range(-len / 2 + 0.5, len / 2 - 0.5), rng.range(0.25, 0.8), s * (t / 2 + 0.003)), rng.range(0.4, 0.9), rng.range(0.2, 0.4), 0.01, g3(0.9));
  }
  b.box(m.stucco, L(base, 0, 0.12, 0), len + 0.02, 0.24, t + 0.04, mulT(plaster, 0.6));
  const caps = Math.max(1, Math.round(len / 0.9));
  const cw = len / caps;
  for (let i = 0; i < caps; i++) {
    const r = rng.next();
    if (r < 0.1) continue;
    const askew = r < 0.25;
    b.box(m.stoneMoss, L(base, -len / 2 + (i + 0.5) * cw + (askew ? rng.range(-0.1, 0.1) : 0), H + 0.05, askew ? rng.range(-0.05, 0.05) : 0, 0, askew ? rng.range(-0.2, 0.2) : 0, askew ? rng.range(-0.08, 0.08) : 0), cw - 0.03, 0.1, t + 0.12, g3(rng.range(0.7, 0.85), 1, 0.95));
  }
  const np = Math.max(2, Math.round(len / 3.5) + 1);
  for (let i = 0; i < np; i++) {
    const x = -len / 2 + 0.22 + (i * (len - 0.44)) / (np - 1);
    b.box(m.stucco, L(base, x, (H + 0.25) / 2, 0), 0.44, H + 0.25, 0.44, mulT(plaster, 0.95));
    b.box(m.stoneMoss, L(base, x, H + 0.3, 0), 0.52, 0.1, 0.52, g3(0.75));
  }
  if (rng.next() < 0.7) ivyPatch(b, base, rng, Math.round(3 + len * 0.6), -len / 2, len / 2, 0.2, H, t / 2 + 0.04, 0.7);
}

// ---------------------------------------------------------------- slab and girder

function slabGeo(seed: number): BufferGeometry {
  return cached(`slab-${seed}`, () => {
    // Plate 3 × 1.8 in x-z, one long edge broken.
    const pts: Array<[number, number]> = [[-1.5, -0.9], [1.5, -0.9], [1.5, 0.6]];
    const jag = [0.75, 0.95, 0.7, 0.88, 0.62, 0.9, 0.72];
    for (let i = 0; i < jag.length; i++) pts.push([1.3 - (i * 2.7) / (jag.length - 1), (jag[(i + seed) % jag.length] as number) - (i % 2) * 0.05]);
    pts.push([-1.5, 0.7]);
    const g = new ExtrudeGeometry(new Shape(pts.map(([x, z]) => new Vector2(x, -z))), { depth: 0.22, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.4, uv.getY(i) * 0.4);
    return g;
  });
}

/** Fallen concrete plate, tilted on rubble, rebar from the broken edge. */
function slab(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const s = p.size;
  const tilt = rng.range(0.12, 0.3);
  const base = at(p, 0, 0, 0, 0, rng.range(-0.1, 0.1));
  const plate = S(L(base, 0, 0.9 * s * Math.sin(tilt) + 0.02, 0, -tilt, 0, rng.range(-0.06, 0.06)), s, 1, s);
  b.geo(m.roughConcrete, slabGeo(rng.int(7)), plate, g3(rng.range(0.75, 0.95)));
  // Rebar out of the broken edge (local +z at the far, raised side after the tilt... broken edge is +z).
  for (let i = 0; i < 6; i++) {
    const x = -1.2 + i * 0.48 + rng.range(-0.05, 0.05);
    const k = rng.range(0.25, 0.7);
    const bend = rng.range(-0.4, 0.4);
    beam(b, m.rust, plate, [x, 0.11, 0.6], [x + bend * 0.3, 0.11 + rng.range(-0.1, 0.25), 0.6 + k], 0.03, g3(0.7));
  }
  const chunk = new DodecahedronGeometry(0.5, 0);
  for (let i = 0; i < 4; i++) {
    const c = rng.range(0.3, 0.55) * s;
    b.geo(m.roughConcrete, chunk, S(L(base, rng.range(-1.3, 1.3) * s, c * 0.3, rng.range(0.4, 1.0) * s, rng.range(0, 3), rng.range(0, 3)), c, c * 0.7, c), g3(rng.range(0.6, 0.8)));
  }
}

const I_BEAM = (() => {
  const w = 0.3, h = 0.4, f = 0.035, web = 0.025;
  return [[-w / 2, 0], [w / 2, 0], [w / 2, f], [web / 2, f], [web / 2, h - f], [w / 2, h - f], [w / 2, h], [-w / 2, h], [-w / 2, h - f], [-web / 2, h - f], [-web / 2, f], [-w / 2, f]] as Array<[number, number]>;
})();

/** Rusty I-beam 4.4 × size m along local z: lying flat or on its side, or leaning on a concrete block. */
function girder(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const len = 4.4 * p.size;
  const g = cached(`girder-${len}`, () => {
    const e = new ExtrudeGeometry(new Shape(I_BEAM.map(([x, y]) => new Vector2(x, y))), { depth: len, bevelEnabled: false });
    e.translate(0, 0, -len / 2);
    const uv = e.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
    return e;
  });
  const v = rng.pick(['flat', 'side', 'lean', 'lean'] as const);
  const tint = g3(rng.range(0.75, 1.0));
  if (v === 'lean') {
    const a = rng.range(0.15, 0.3);
    const hgt = Math.sin(a) * len;
    b.box(m.concrete, L(at(p), rng.range(-0.05, 0.05), hgt / 2 - 0.1, -len / 2 + 0.5, 0, rng.range(-0.3, 0.3)), 0.7, hgt - 0.2, 0.6, g3(0.7));
    b.geo(m.rust, g, at(p, 0, hgt / 2, 0, a, rng.range(-0.06, 0.06)), tint);
  } else b.geo(m.rust, g, at(p, 0, v === 'side' ? 0.15 : 0, 0, 0, rng.range(-0.05, 0.05), v === 'side' ? Math.PI / 2 : 0).multiply(new Matrix4().makeTranslation(0, v === 'side' ? -0.2 : 0, 0)), tint);
}

/** Builds `p` if it belongs to this set; false otherwise. */
export function buildUrbanProp(b: Builder, p: Prop, rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  switch (p.kind as UrbanPropKind) {
    case 'crane': crane(b, p, rng); break;
    case 'container': container(b, at(p, 0, 0, 0, 0, 0, rng.range(-0.015, 0.015)), rng, rng.next() < 0.15); break;
    case 'scaffold': scaffold(b, p, rng); break;
    case 'rohbau': rohbau(b, p, rng); break;
    case 'pallets': pallets(b, p, rng); break;
    case 'ticketMachine': ticketMachine(b, p, rng); break;
    case 'boom': boom(b, p, rng); break;
    case 'bikes': bikes(b, p, rng); break;
    case 'clothesline': clothesline(b, p, rng); break;
    case 'gravestone': gravestone(b, p, rng); break;
    case 'wall': wall(b, p, rng); break;
    case 'lowWall': lowWall(b, p, rng); break;
    case 'slab': slab(b, p, rng); break;
    case 'girder': girder(b, p, rng); break;
  }
  return true;
}
