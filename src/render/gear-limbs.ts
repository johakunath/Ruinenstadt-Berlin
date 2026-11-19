// Glove and boot gear (WP4 step 2d): cuffs, wraps, boxing gloves, boot shafts and plates. Forearm parts
// ride on `lowerarm_*` (T-pose: the arm along ±X), hand parts on `hand_*`, shafts, greaves and knee cops
// on `calf_*`, instep parts on `foot_*`, toe parts on `ball_*`. Every part is built for the hero's left
// limb and mirrored for the right. Looks: docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19).
import { BufferAttribute, BufferGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { Sampler, axis, bright, cloth, glow, metal, plain, type GearKit, type Paint } from './gear-kit';
import type { GearBuilder } from './gear';
import { ball, box, cone, cyl, scaled } from './weapons';

const side = (s: 1 | -1): 'l' | 'r' => (s > 0 ? 'l' : 'r');
type Bone = 'lowerarm' | 'hand' | 'calf' | 'foot' | 'ball';

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _v = new Vector3(), ONE = new Vector3(1, 1, 1), UP = new Vector3(0, 1, 0);

/** Parts of one limb in bind space on the hero's left; `both` adds them and their mirror image. */
class Limb {
  readonly parts: { bone: Bone; geo: BufferGeometry; paint: Paint }[] = [];

  add(bone: Bone, geo: BufferGeometry, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): this {
    geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), ONE));
    this.parts.push({ bone, geo, paint });
    return this;
  }

  /** `geo` (built round the origin, +Y up) stood on bind point `p`, its +Y along `dir`. */
  stand(bone: Bone, geo: BufferGeometry, paint: Paint, p: Vector3, dir: Vector3): this {
    geo.applyQuaternion(_q.setFromUnitVectors(UP, dir)).translate(p.x, p.y, p.z);
    this.parts.push({ bone, geo, paint });
    return this;
  }
}

/** Mirror image across x = 0 (the right limb), wound so the faces still point out. */
function mirrored(g: BufferGeometry): BufferGeometry {
  const m = g.clone().scale(-1, 1, 1);
  const ix = m.index;
  if (ix) for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); }
  else for (const a of Object.values(m.attributes)) for (let i = 0; i < a.count; i += 3) for (let c = 0; c < a.itemSize; c++) {
    const b = a.getComponent(i + 1, c); a.setComponent(i + 1, c, a.getComponent(i + 2, c)); a.setComponent(i + 2, c, b);
  }
  return m;
}

/** Builds the left limb's parts and adds them on the left bones and, mirrored, on the right. */
function both(k: GearKit, build: (l: Limb) => void): void {
  const l = new Limb();
  build(l);
  for (const s of [1, -1] as const) for (const p of l.parts) k.on(`${p.bone}_${side(s)}`, () => k.add(s > 0 ? p.geo.clone() : mirrored(p.geo), p.paint));
}

/** A grid over the hero's surface: `at(u, v)` gives the height along the sampler's axis and the angle. */
interface Fit {
  cols: number;
  rows: number;
  at: (u: number, v: number) => readonly [number, number];
  /** u runs once round the axis. */
  closed?: boolean;
  /** Smoothing passes along u and along v (each keeps the larger of a radius and its neighbours' mean). */
  smooth?: number;
  vsmooth?: number;
  /** Running maximum along v: a shaft never narrows going up. */
  hull?: boolean;
  /** Measure the outermost surface within ±`span` m along the axis (nothing pokes through between rows). */
  span?: number;
  /** The sampler's slab (m along the axis) round each measured height. */
  dt?: number;
}

/** The measured, smoothed radius over the grid of `f`, read back bilinearly at (u, v). */
function fitted(smp: Sampler, f: Fit): (u: number, v: number) => number {
  const { cols, rows } = f, sp = f.span ?? 0, L = cols;
  const g: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    let ring: number[] = [];
    for (let j = 0; j <= cols; j++) {
      const [t, a] = f.at(j / cols, r / rows);
      let m = 0;
      for (let q = -sp; q <= sp + 1e-9; q += Math.max(0.005, sp / 3)) m = Math.max(m, smp.radius(t + q, a, f.dt));
      ring.push(m);
    }
    const seen = ring.filter((x) => x > 0), mean = seen.length ? seen.reduce((p, x) => p + x, 0) / seen.length : 0.05;
    ring = ring.map((x) => x || mean);
    for (let pass = 0; pass < (f.smooth ?? 2); pass++) {
      const src = ring;
      ring = src.map((x, j) => {
        const p = src[f.closed ? (j - 1 + L) % L : Math.max(0, j - 1)]!, q = src[f.closed ? (j + 1) % L : Math.min(cols, j + 1)]!;
        return Math.max(x, (p + 2 * x + q) / 4);
      });
      if (f.closed) ring[cols] = ring[0]!;
    }
    g.push(ring);
  }
  if (f.hull) for (let r = 1; r <= rows; r++) for (let j = 0; j <= cols; j++) g[r]![j] = Math.max(g[r]![j]!, g[r - 1]![j]!);
  for (let pass = 0; pass < (f.vsmooth ?? 0); pass++) {
    const src = g.map((row) => row.slice());
    for (let r = 0; r <= rows; r++) for (let j = 0; j <= cols; j++) {
      const p = src[Math.max(0, r - 1)]![j]!, x = src[r]![j]!, q = src[Math.min(rows, r + 1)]![j]!;
      g[r]![j] = Math.max(x, (p + 2 * x + q) / 4);
    }
  }
  return (u, v) => {
    const x = Math.min(Math.max(u, 0), 1) * cols, y = Math.min(Math.max(v, 0), 1) * rows;
    const j = Math.min(cols - 1, Math.floor(x)), r = Math.min(rows - 1, Math.floor(y)), fx = x - j, fy = y - r;
    const a = g[r]![j]! + (g[r]![j + 1]! - g[r]![j]!) * fx, b = g[r + 1]![j]! + (g[r + 1]![j + 1]! - g[r + 1]![j]!) * fx;
    return a + (b - a) * fy;
  };
}

/**
 * A mesh over the grid of `f` at distance `r(u, v)` from the axis, with UVs 0..1. `map` takes the mesh's
 * own (u, v) to the grid's (a strip of a shaft, a tilted band), `cols` × `rows` quads.
 */
function shell(smp: Sampler, f: Fit, r: (u: number, v: number) => number, map?: (u: number, v: number) => readonly [number, number], cols = f.cols, rows = f.rows): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], p = new Vector3();
  for (let k = 0; k <= rows; k++) for (let j = 0; j <= cols; j++) {
    const [u, v] = map ? map(j / cols, k / rows) : [j / cols, k / rows];
    const [t, a] = f.at(u, v);
    smp.point(t, a, r(u, v), p);
    pos.push(p.x, p.y, p.z);
    uv.push(j / cols, k / rows);
  }
  const w = cols + 1;
  for (let k = 0; k < rows; k++) for (let j = 0; j < cols; j++) { const a = k * w + j, b = a + 1, c = a + w, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal!;
  // A closed ring: one normal at the seam.
  if (f.closed && cols === f.cols && !map) for (let k = 0; k <= rows; k++) {
    const a = k * w, b = a + cols;
    _v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, _v.x, _v.y, _v.z); n.setXYZ(b, _v.x, _v.y, _v.z);
  }
  // Faces out of the axis (the materials are double-sided, but lit by the front face's normal).
  const c = new Vector3(), q = new Vector3();
  let flip = 0;
  for (let i = 0; i < n.count; i++) {
    c.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!).sub(smp.ax.o);
    c.addScaledVector(smp.ax.d, -c.dot(smp.ax.d));
    flip += q.set(n.getX(i), n.getY(i), n.getZ(i)).dot(c) < 0 ? 1 : -1;
  }
  if (flip > 0) {
    const ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); }
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return g;
}

/** Angle once round the axis (u 0..1), starting at the back. */
const round = (u: number): number => -Math.PI + 2 * Math.PI * u;
/** The strip v0..v1 of a grid. */
const strip = (v0: number, v1: number) => (u: number, v: number): readonly [number, number] => [u, v0 + (v1 - v0) * v];
/** The narrow strip u0..u1, v0..v1 of a grid (a seam line, a gloss streak). */
const line = (u0: number, u1: number, v0: number, v1: number) => (u: number, v: number): readonly [number, number] => [u0 + (u1 - u0) * u, v0 + (v1 - v0) * v];
/** Grid u of angle `a` on a closed ring. */
const uOf = (a: number): number => (a + Math.PI) / (2 * Math.PI);

// ---------------------------------------------------------------- hands

/** The T-pose left arm, coat sleeve and glove (bare arms: the parts stand a little off the skin). */
const arm = (k: GearKit): Sampler => k.arm(1, ['a_mantel', 'g_handsch']);

/** A ring round the forearm or hand: centre `t` (m out along the arm), `w` wide, slanting by `tilt`. */
function ring(smp: Sampler, t: number, w: number, cols: number, rows: number, lift: (v: number) => number, tilt = 0, span = 0.008): BufferGeometry {
  const f: Fit = { cols, rows, closed: true, smooth: 3, span, at: (u, v) => { const a = round(u); return [t + w * (v - 0.5) + tilt * Math.sin(a), a]; } };
  const R = fitted(smp, f);
  return shell(smp, f, (u, v) => R(u, v) + lift(v));
}

/** The glove's own cuff, a short fitted ring over the wrist and the sleeve's end (every glove). */
const wrist = (hex: number): GearBuilder => (k) => both(k, (l) => {
  l.add('lowerarm', ring(arm(k), 0.618, 0.052, 12, 1, () => 0.006, 0, 0.02), plain(hex));
});

/** Knuckle line of the T-pose left hand (the finger joints, index at the front 0.730, pinky 0.711). */
const knuckle = (a: number): number => 0.7194 + 0.0109 * Math.cos(a);

/** A patch on the hand from `t0(a)` to `t1(a)` over angles a0..a1 (rigid on the hand: behind the knuckles, clear of the thumb). */
function backOfHand(smp: Sampler, t0: (a: number) => number, t1: (a: number) => number, a0: number, a1: number, cols: number, rows: number, lift: (u: number, v: number) => number): BufferGeometry {
  const f: Fit = { cols, rows, smooth: 1, span: 0.008, dt: 0.008, at: (u, v) => { const a = a0 + (a1 - a0) * u; return [t0(a) + (t1(a) - t0(a)) * v, a]; } };
  const R = fitted(smp, f);
  return shell(smp, f, (u, v) => R(u, v) + lift(u, v));
}

const WRAP = 0xe8ddd0, WRAP_RED = 0xc0302a;
const WELD = 0x6a4630, WELD_DARK = 0x4a2e1c;
const KIEZ = 0xf08a24;
const BOX_RED = 0xc23a2e, BOX_WHITE = 0xece6da;

/** Boxing glove fist on the T-pose left hand: an egg, wider at the knuckles, palm down. */
function fist(): BufferGeometry {
  const g = new SphereGeometry(1, 10, 6).rotateZ(-Math.PI / 2);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + 0.12 * x;
    p.setXYZ(i, 0.752 + x * (x > 0 ? 0.1 : 0.112), 1.41 + y * 0.06 * f * (y < 0 ? 0.92 : 1), -0.05 + z * 0.07 * f);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- feet

/** The left lower leg round its own centre line (boot and trousers; angle +π/2 is the outside). */
const LEG = axis([0.116, 0, -0.088], [0, 1, 0], [0, 0, 1]);
const leg = (k: GearKit): Sampler => k.sampler(['f_stiefel', 'a_weste'], LEG, 0.012);
/** The left foot along its length (angle 0 up, −π/2 the outside); `y` the axis' height. */
const footAxis = (y: number, x = 0.12) => axis([x, y, 0], [0, 0, 1], [0, 1, 0]);
const feet = new WeakMap<GearKit, Map<string, Sampler>>();
/** Sampler of a shoe's foot only (vertices below `top`), along the foot: the shaft above would lift the instep. */
function foot(k: GearKit, node: string, top: number, y: number, x?: number): Sampler {
  let m = feet.get(k);
  if (!m) feet.set(k, (m = new Map()));
  const key = `${node}|${top}|${y}|${x}`;
  let s = m.get(key);
  if (!s) {
    const all = k.src.meshes.get(node) ?? new Float32Array(), kept: number[] = [];
    for (let i = 0; i < all.length; i += 3) if (all[i + 1]! < top) kept.push(all[i]!, all[i + 1]!, all[i + 2]!);
    m.set(key, (s = new Sampler({ meshes: new Map([[node, new Float32Array(kept)]]), bones: k.src.bones }, [node], footAxis(y, x), 0.012)));
  }
  return s;
}

/** A tall shaft from `t0` to `top(a)`: fitted, never narrowing going up. Rows up to `level` (of v) are level up to height `at`, then slant to the top. */
function shaftFit(t0: number, top: (a: number) => number, cols: number, rows: number, level = 0.8, at = 0.42): Fit {
  return {
    cols, rows, closed: true, hull: true, smooth: 3, vsmooth: 1, span: 0.012,
    at: (u, v) => { const a = round(u); return [v <= level ? t0 + (at - t0) * (v / level) : at + (top(a) - at) * ((v - level) / (1 - level)), a]; },
  };
}
/** Grid v of height `t` on a shaft fit's level rows. */
const vAt = (t: number, t0: number, level = 0.8, at = 0.42): number => ((t - t0) / (at - t0)) * level;

/** A rivet or boss: a low pyramid standing out of the surface at (t, a). */
function stud(l: Limb, bone: Bone, smp: Sampler, t: number, a: number, r: number, paint: Paint, size = 0.0055, sides = 4): void {
  l.stand(bone, cone(size, size * 0.9, sides).translate(0, size * 0.45, 0), paint, smp.point(t, a, r), smp.out(a));
}

export const LIMB_GEAR: Readonly<Record<string, GearBuilder>> = {
  // Every glove's wrist ring in its palette's cuff colour (covers the bare wrist between sleeve and glove).
  'wrist-work': wrist(0x6e5430),
  'wrist-garden': wrist(0xf3ce43),
  'wrist-kiez': wrist(KIEZ),

  // Boxbandagen: slanted cream bands up the forearm and over the wrist, one round the palm, a red stripe on the back of the hand.
  wraps: (k) => both(k, (l) => {
    const smp = arm(k), round3 = (v: number): number => 0.006 + 0.004 * Math.sin(Math.PI * v);
    for (const t of [0.515, 0.562, 0.61]) l.add('lowerarm', ring(smp, t, 0.026, 10, 2, round3, 0.009), cloth(WRAP));
    // Round the palm but not the thumb, and a red stripe over the back of the hand behind the knuckles.
    l.add('hand', backOfHand(smp, () => 0.652, () => 0.674, 1.45, 2 * Math.PI - 0.25, 10, 1, () => 0.005), cloth(WRAP));
    l.add('hand', backOfHand(smp, (a) => knuckle(a) - 0.036, (a) => knuckle(a) - 0.022, -2.75, -0.35, 8, 1, () => 0.0055), plain(WRAP_RED));
  }),

  // Schweißerhandschuhe: a long leather gauntlet flaring to mid-forearm, a stitched seam and a rolled rim.
  'cuffs-welder': (k) => both(k, (l) => {
    const smp = arm(k);
    const end = (a: number): number => 0.488 + 0.012 * Math.sin(a);
    const f: Fit = { cols: 12, rows: 3, closed: true, smooth: 3, span: 0.015, at: (u, v) => { const a = round(u); return [0.656 + (end(a) - 0.656) * v, a]; } };
    const R = fitted(smp, f), flare = (v: number): number => 0.007 + 0.03 * v ** 1.6;
    l.add('lowerarm', shell(smp, f, (u, v) => R(u, v) + flare(v)), plain(WELD));
    l.add('lowerarm', shell(smp, f, (u, v) => R(u, v) + flare(v) + 0.0018, strip(0.5, 0.56), 12, 1), plain(WELD_DARK));
    l.add('lowerarm', shell(smp, f, (u, v) => R(u, v) + flare(v) + 0.0035, strip(0.9, 1), 12, 1), plain(WELD_DARK));
    // Dark lining, seen through the open end.
    l.add('lowerarm', shell(smp, f, (u, v) => R(u, v) + flare(v) - 0.002, strip(0.45, 1), 12, 1), plain(0x24160c));
  }),

  // Handschuhe der Kiezwache: an orange knuckle guard with four ridges on the back of the hand.
  'knuckles-kiez': (k) => both(k, (l) => {
    // One ridge over each knuckle (the fingers sit at u 0.13, 0.38, 0.63, 0.88 of the guard).
    const ridge = (u: number, v: number): number => 0.0055 + 0.0055 * Math.abs(Math.sin(4 * Math.PI * u)) * Math.sin(Math.PI * (0.25 + 0.7 * v));
    l.add('hand', backOfHand(arm(k), (a) => knuckle(a) - 0.027, (a) => knuckle(a) + 0.004, -2.65, -0.25, 16, 2, ridge), plain(KIEZ));
  }),

  // Fäuste des Kiezboxers: shiny red boxing gloves with a white cuff and laces; they replace the hands.
  boxing: (k) => both(k, (l) => {
    l.add('hand', fist(), bright(BOX_RED));
    // Thumb along the front of the fist, pointing out.
    l.add('hand', scaled(ball(1, 6, 4), 0.05, 0.026, 0.027), bright(BOX_RED), 0.735, 1.376, 0.008, 0, 0.35, 0.12);
    // Cuff over the wrist and the sleeve's end; its closed ends hide the inside.
    l.add('hand', scaled(cyl(1, 0.96, 0.085, 8), 0.052, 1, 0.06), plain(BOX_WHITE), 0.623, 1.414, -0.05, 0, 0, Math.PI / 2);
    // Lace round the back of the cuff.
    l.add('hand', box(0.006, 0.004, 0.036), plain(0xd8d0c0), 0.63, 1.465, -0.05, 0, 0, 0);
  }),

  // Gummistiefel: one smooth green shaft from the ankle to under the knee, a lighter rolled rim, a gloss line.
  'shaft-rubber': (k) => both(k, (l) => {
    const smp = leg(k), top = (): number => 0.47;
    const f = shaftFit(0.13, top, 16, 5);
    const R = fitted(smp, f), lift = (v: number): number => 0.0025 + 0.0075 * v;
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v)), plain(0x285030));
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) + 0.0025 + 0.002 * Math.sin(Math.PI * (v - 0.93) / 0.07), strip(0.93, 1), 16, 2), plain(0x5e9460));
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) + 0.0012, line(uOf(0.62) - 0.01, uOf(0.62) + 0.01, 0.12, 0.88), 1, 3), plain(0x2f5c37));
  }),

  // Stiefel des Schaffners: tall polished black riding boots, higher at the outside, blue piping, a brass buckle.
  'shaft-riding': (k) => both(k, (l) => {
    const smp = leg(k), top = (a: number): number => 0.468 + 0.034 * Math.sin(a) - 0.008 * (1 - Math.cos(a)) / 2;
    const f = shaftFit(0.12, top, 16, 5);
    const R = fitted(smp, f), lift = (v: number): number => 0.003 + 0.004 * v;
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v)), bright(0x1f2430));
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) + 0.0025, strip(0.965, 1), 16, 1), plain(0x3a6ad0));
    // Matte lining inside the top (polished metal would glare from inside).
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) - 0.002, strip(0.84, 1), 16, 1), plain(0x0e1016));
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) + 0.0012, line(uOf(0.7) - 0.012, uOf(0.7) + 0.012, 0.1, 0.94), 1, 3), bright(0x7c88a2));
    // Ankle strap round the outside half, brass buckle at the outside.
    const v0 = vAt(0.165, 0.12), v1 = vAt(0.184, 0.12);
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) + 0.003, line(0.5, 1, v0, v1), 8, 1), plain(0x12151c));
    const vb = (v0 + v1) / 2, ab = Math.PI / 2, rb = R(uOf(ab), vb) + lift(vb) + 0.006, out = smp.out(ab), p = smp.point(0.1745, ab, rb);
    l.add('calf', box(0.006, 0.026, 0.03), metal(0xc9a34a), p.x, p.y, p.z, 0, Math.atan2(out.x, out.z) - Math.PI / 2, 0);
    l.add('calf', box(0.004, 0.012, 0.016), plain(0x12151c), p.x + out.x * 0.002, p.y, p.z + out.z * 0.002, 0, Math.atan2(out.x, out.z) - Math.PI / 2, 0);
  }),

  // Stiefel des Spreegeists: dark green shafts wrapped with slanted teal bands, a fin cuff, a faint glow line.
  'shaft-wrapped': (k) => both(k, (l) => {
    const smp = leg(k), t0 = 0.13, t1 = 0.47;
    const f: Fit = { cols: 12, rows: 4, closed: true, hull: true, smooth: 3, vsmooth: 1, span: 0.03, at: (u, v) => [t0 + (t1 - t0) * v, round(u)] };
    const R = fitted(smp, f), lift = (v: number): number => 0.0055 + 0.005 * v;
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v)), plain(0x1e5a4a));
    // Bands: tilted rings over the shaft, lower at the inside.
    for (const tc of [0.175, 0.235, 0.295, 0.355, 0.415]) {
      const band = (u: number, v: number): readonly [number, number] => [u, (tc + 0.017 * (v - 0.5) + 0.02 * Math.sin(round(u)) - t0) / (t1 - t0)];
      l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) + 0.0028, band, 12, 1), cloth(0x7fe0c8));
    }
    // Fin cuff: a flared collar rising to a point at the outside.
    const fin = (a: number): number => Math.max(0, Math.cos(a - Math.PI / 2)) ** 4;
    const g: Fit = { cols: 12, rows: 2, closed: true, smooth: 3, span: 0.02, at: (u, v) => { const a = round(u); return [0.442 + (0.478 + 0.07 * fin(a) - 0.442) * v, a]; } };
    const G = fitted(smp, g);
    l.add('calf', shell(smp, g, (u, v) => Math.max(G(u, v), R(u, 1)) + 0.014 + v * (0.008 + 0.018 * fin(round(u)))), plain(0x2aa890));
    // Glow line down the front inside.
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(v) + 0.0045, line(uOf(-0.5) - 0.008, uOf(-0.5) + 0.008, 0.08, 0.86), 1, 3), glow(0x2a8a74));
  }),

  // Eisenstiefel der Zitadelle: ridged steel greaves, knee cops with a gold boss, sabaton lames, gold rivets.
  greaves: (k) => both(k, (l) => {
    const smp = leg(k), steel = bright(0xa8aeb6), gold = metal(0xe0b040);
    const f: Fit = { cols: 12, rows: 4, closed: true, hull: true, smooth: 3, vsmooth: 1, span: 0.03, at: (u, v) => [0.12 + 0.355 * v, round(u)] };
    const R = fitted(smp, f), ridge = (u: number): number => 0.007 * Math.max(0, 1 - Math.abs(round(u)) / 0.6);
    const lift = (u: number, v: number): number => 0.008 + 0.004 * v + ridge(u);
    l.add('calf', shell(smp, f, (u, v) => R(u, v) + lift(u, v)), steel);
    for (const t of [0.2, 0.29, 0.38]) { const a = Math.PI / 2 - 0.4, v = (t - 0.12) / 0.355; stud(l, 'calf', smp, t, a, R(uOf(a), v) + lift(uOf(a), v), gold, 0.008); }
    // Knee cop: a domed plate over the knee's front, its top tucked under the thigh.
    const cop = new SphereGeometry(1, 8, 4, Math.PI / 2 - 1.05, 2.1, 0.65, 1.75).scale(0.07, 0.07, 0.08).translate(0.111, 0.535, -0.035);
    l.add('calf', cop, steel);
    l.add('calf', scaled(ball(0.014, 6, 3), 1, 1, 0.55), gold, 0.111, 0.538, 0.045);
    // Sabaton: three lames over the instep, each front edge standing a little higher, and a toe cap.
    const fs = foot(k, 'f_stiefel', 0.105, 0.012);
    const lame = (z0: number, z1: number, cols: number, rows: number, hi: number, a = 1.38): BufferGeometry => {
      const g: Fit = { cols, rows, smooth: 2, span: (z1 - z0) / 2, at: (u, v) => [z0 + (z1 - z0) * v, a * (2 * u - 1)] };
      const L = fitted(fs, g);
      return shell(fs, g, (u, v) => L(u, v) + 0.005 + hi * v);
    };
    l.add('foot', lame(-0.04, -0.004, 8, 1, 0.005), steel).add('foot', lame(-0.008, 0.028, 8, 1, 0.005), steel).add('foot', lame(0.024, 0.06, 8, 1, 0.005), steel);
    l.add('ball', lame(0.054, 0.122, 8, 1, 0.001, 1.22), steel);
  }),

  // Turnschuhe: a red stripe arching along each side of the white sneaker, a red heel tab.
  'sneaker-stripes': (k) => both(k, (l) => {
    const fs = foot(k, 'f_turnsch', 0.2, 0.03, 0.123);
    for (const s of [1, -1]) {
      const f: Fit = { cols: 10, rows: 1, smooth: 2, at: (u, v) => [-0.112 + 0.168 * u, s * (-Math.PI / 2 + 0.5 * Math.sin(Math.PI * u) ** 1.2) + (v - 0.5) * 0.2] };
      const R = fitted(fs, f);
      l.add('foot', shell(fs, f, (u, v) => R(u, v) + 0.003), plain(0xc0302a));
    }
    l.add('foot', box(0.024, 0.032, 0.006), plain(0xc0302a), 0.123, 0.1, -0.131, -0.25, 0, 0);
  }),
};
