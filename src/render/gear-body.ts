// Armor gear (WP4 step 2c): belts, collars, plates, studs and the other rigid parts of the Körper looks.
// Belts and plates are fitted to the outfit they sit on (`a_mantel` or `a_weste`). Looks:
// docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19). Sides follow the mockup's front view: what it
// draws right of the buckle (hammer, axe, wrench, ticket pouch) hangs on the hero's left (+X).
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Matrix4, PlaneGeometry, Quaternion, TubeGeometry, Vector3 } from 'three';
import { heroLook } from '../data/hero-look';
import { AXES, Sampler, axis, basis, bright, cloth, glow, metal, onSurface, plain, surface, wood, type Axis, type GearKit, type HeroSource, type Paint } from './gear-kit';
import type { GearBuilder } from './gear';
import { box, cone, cord, cyl, flat, ring, scaled } from './weapons';

/** Belt heights (m): the coat's belt ring and the vest's. */
export const BELT_Y = { a_mantel: 1.08, a_weste: 1.0 } as const;

/** A belt band round the outfit at its belt height: `h` tall, `lift` out of the surface. Returns the sampler for buckles and pouches. */
export function beltBand(k: GearKit, outfit: 'a_mantel' | 'a_weste', col: number, h = 0.056, lift = 0.008): Sampler {
  const s = k.sampler([outfit], AXES.torso);
  const y = BELT_Y[outfit];
  k.on('pelvis', () => k.add(surface(s, y - h / 2, y + h / 2, { segs: 36, rows: 1, offset: lift, median: 7 }), plain(col)));
  return s;
}

// ---------------------------------------------------------------- helpers

const SIDES = [1, -1] as const;
type Side = 1 | -1;
const lr = (s: Side): 'l' | 'r' => (s > 0 ? 'l' : 'r');
const UP = new Vector3(0, 1, 0);

/** Shoulder volume (m) of an armor base's look at bind point (x, y): `puffed` in hero-wear.ts, for parts lying on the shoulders. */
function puffAt(base: string, x: number, y: number): number {
  if (y <= 1.2) return 0;
  const d = Math.hypot(Math.abs(x) - 0.19, (y - 1.43) * 1.3);
  return heroLook({ a: { base } }).puff * Math.max(0, 1 - d / 0.2) ** 1.5 * Math.min(1, Math.max(0, (Math.abs(x) - 0.07) / 0.06));
}

const subsets = new WeakMap<HeroSource, Map<string, Sampler>>();

/** A sampler of the vertices of `node` that pass `keep` (cached per hero and `key`). */
function subset(k: GearKit, key: string, node: string, keep: (x: number, y: number, z: number) => boolean, ax: Axis, minX = 0): Sampler {
  let m = subsets.get(k.src);
  if (!m) subsets.set(k.src, (m = new Map()));
  let s = m.get(key);
  if (!s) {
    const p = k.src.meshes.get(node) ?? new Float32Array(0), out: number[] = [];
    for (let i = 0; i < p.length; i += 3) if (keep(p[i]!, p[i + 1]!, p[i + 2]!)) out.push(p[i]!, p[i + 1]!, p[i + 2]!);
    s = new Sampler({ meshes: new Map([[key, new Float32Array(out)]]), bones: k.src.bones }, [key], ax, minX);
    m.set(key, s);
  }
  return s;
}

/** Off the leg axis of side `s` (m): the trousers are within 0.1, the coat skirt further out. */
const legDist = (x: number, z: number, s: Side): number => Math.hypot(x - 0.111 * s, z + 0.045);
/** The coat without its T-pose sleeves and without the skirt below the belt (collars, hoods, a jacket's hips). */
const coatCore = (k: GearKit): Sampler => subset(k, 'coat-core', 'a_mantel', (x, y, z) =>
  (y > 1.045 ? !(Math.abs(x) > 0.165 && y > 1.33) : legDist(x, z, x > 0 ? 1 : -1) < 0.1), AXES.torso);
/** The poncho's shoulders and chest (B1) above the panels' open sides, for the hood roll and its bag. */
const ponchoCore = (k: GearKit): Sampler => subset(k, 'poncho-core', 'a_poncho', (x, y) => y > 1.1 && !(Math.abs(x) > 0.165 && y > 1.33), AXES.torso);
/** One leg of the coat's trousers, without the skirt. */
const coatLeg = (k: GearKit, s: Side): Sampler => subset(k, `coat-leg${s}`, 'a_mantel', (x, y, z) => x * s > 0.012 && y < 0.9 && legDist(x, z, s) < 0.1, AXES.leg(s), 0.012 * s);

/** Angle round the torso axis where the surface of `s` at height `y` is `x` m off the middle (the front, or the back). */
export function angleAt(s: Sampler, y: number, x: number, back = false): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const r = s.radius(y, back ? Math.PI - a : a) || 0.15;
    a = Math.asin(Math.max(-1, Math.min(1, x / r)));
  }
  return back ? Math.PI - a : a;
}

/** Frame on the surface of `s` at (t, a), `lift` m out along the measured normal (tilted with the slope): +Z out, +Y up, +X round. */
function fit(s: Sampler, t: number, a: number, lift = 0.006, d = 0.02): Matrix4 {
  const r = s.radius(t, a), da = d / Math.max(r, 0.03);
  const at = (tt: number, aa: number): Vector3 => s.point(tt, aa, s.radius(tt, aa));
  const up = at(t + d, a).sub(at(t - d, a)).normalize();
  const round = at(t, a + da).sub(at(t, a - da)).normalize();
  const n = new Vector3().crossVectors(round, up).normalize();
  if (n.dot(s.out(a)) < 0) n.negate();
  n.lerp(s.out(a), 0.3).normalize();
  const x = new Vector3().crossVectors(up, n).normalize(), y = new Vector3().crossVectors(n, x);
  return basis(s.point(t, a, r).addScaledVector(n, lift), x, y, n);
}

/** A sheet of `segs` × `rows` quads through `at(u, v)` (u, v in 0..1), with UVs. */
function grid(segs: number, rows: number, at: (u: number, v: number) => Vector3): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let r = 0; r <= rows; r++) for (let j = 0; j <= segs; j++) {
    const p = at(j / segs, r / rows);
    pos.push(p.x, p.y, p.z);
    uv.push(j / segs, r / rows);
  }
  const w = segs + 1;
  for (let r = 0; r < rows; r++) for (let j = 0; j < segs; j++) { const a = r * w + j; idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The edge of a sheet: its outline at `at(u, v, 0)` down to `at(u, v, 1)` (plates read thick; no underside, they lie on the body). */
function edge(segs: number, rows: number, at: (u: number, v: number, under: number) => Vector3): BufferGeometry {
  const n = 2 * (segs + rows);
  const rim = (q: number): [number, number] => q <= segs ? [q / segs, 0] : q <= segs + rows ? [1, (q - segs) / rows]
    : q <= 2 * segs + rows ? [1 - (q - segs - rows) / segs, 1] : [0, 1 - (q - 2 * segs - rows) / rows];
  return grid(n, 1, (u, v) => { const [a, b] = rim(Math.round(u * n)); return at(a, b, v); });
}

/** A tube through `pts` (Catmull-Rom), radius `r`, optionally scaled by `taper(t)` along it (t 0..1). */
export function tube(pts: readonly Vector3[], r: number, segs: number, rs: number, taper?: (t: number) => number): BufferGeometry {
  const curve = new CatmullRomCurve3(pts.map((p) => p.clone()));
  const g = new TubeGeometry(curve, segs, r, rs, false);
  if (taper) {
    const p = g.attributes.position!, c = new Vector3();
    for (let i = 0; i <= segs; i++) {
      curve.getPointAt(i / segs, c);
      const f = taper(i / segs);
      for (let j = 0; j <= rs; j++) { const v = i * (rs + 1) + j; p.setXYZ(v, c.x + (p.getX(v) - c.x) * f, c.y + (p.getY(v) - c.y) * f, c.z + (p.getZ(v) - c.z) * f); }
    }
    g.computeVertexNormals();
  }
  return g;
}

/** A flat strip `w` wide through `pts` lying on a surface with outward normals `ns`. */
export function strip(pts: readonly Vector3[], ns: readonly Vector3[], w: number): BufferGeometry {
  const side = pts.map((_, i) => {
    const t = pts[Math.min(pts.length - 1, i + 1)]!.clone().sub(pts[Math.max(0, i - 1)]!);
    return new Vector3().crossVectors(ns[i]!, t).normalize().multiplyScalar(w / 2);
  });
  return grid(1, pts.length - 1, (u, v) => { const i = Math.round(v * (pts.length - 1)); return pts[i]!.clone().addScaledVector(side[i]!, u * 2 - 1); });
}

/** Wraps a part built facing +Z round a vertical cylinder of radius `R` behind it (patches on a leg or a chest). */
function bend(g: BufferGeometry, R: number): BufferGeometry {
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), th = x / R;
    p.setXYZ(i, (R + z) * Math.sin(th), p.getY(i), (R + z) * Math.cos(th) - R);
  }
  g.computeVertexNormals();
  return g;
}

/** `g` turned so its +Y runs along `dir`, then moved to `at` (for `add` without Euler angles). */
function along(g: BufferGeometry, dir: Vector3, at: Vector3): BufferGeometry {
  return g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.clone().normalize())).translate(at.x, at.y, at.z);
}

/** `m` tilted about its +X: a tool hanging from the belt rests on the coat flaring out under it (`rx` < 0 swings its bottom out). */
export const tilt = (m: Matrix4, rx: number): Matrix4 => m.clone().multiply(new Matrix4().makeRotationX(rx));

/** A buckle facing +Z: a plate `w` × `h`, an inset of the belt's colour and a prong. */
export function buckle(k: GearKit, w: number, h: number, frame: Paint, belt: Paint): void {
  k.add(box(w, h, 0.008), frame).add(box(w * 0.6, h * 0.5, 0.004), belt, 0, 0, 0.004).add(box(w * 0.34, 0.006, 0.004), frame, -w * 0.12, 0, 0.0065);
}

/** A belt band (`beltBand`) and frames on it: `at(a, dy, lift)` sits `lift` m out of the band at angle `a`, `dy` m below its middle (out of the coat there, if that sticks out further). */
export function belt(k: GearKit, outfit: 'a_mantel' | 'a_weste', col: number, h: number): { s: Sampler; y: number; at: (a: number, dy?: number, lift?: number) => Matrix4 } {
  const s = beltBand(k, outfit, col, h), y = BELT_Y[outfit];
  // The band's rings are median-filtered over 7 of 36 samples (`surface`); match that.
  const med = (t: number, a: number): number => [-3, -2, -1, 0, 1, 2, 3].map((j) => s.radius(t, a + (j * Math.PI) / 18)).sort((p, q) => p - q)[3]!;
  const at = (a: number, dy = 0, lift = 0.004): Matrix4 => {
    const band = Math.max(med(y - h / 2, a), med(y + h / 2, a)) + 0.01;
    return onSurface(s, y + dy, a, lift, Math.max(band, dy < -h / 2 ? s.radius(y + dy, a, 0.012, 0.25) : 0));
  };
  return { s, y, at };
}

/** A pyramid stud facing +Z, its base at z 0. */
function stud(k: GearKit, r: number, paint: Paint): void {
  k.add(cone(r, r * 1.25, 4), paint, 0, 0, r * 0.62, Math.PI / 2, Math.PI / 4, 0);
}

/** A ragged outline round (0, 0): `n` points on an ellipse `w` × `h`, every other one pulled in by `jag`. */
const ragged = (w: number, h: number, n: number, jag: number, seed = 0): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, f = 1 - (i % 2 ? jag : 0) * (0.6 + 0.4 * Math.sin(i * 2.3 + seed));
    return [(Math.cos(a) * w) / 2 * f, (Math.sin(a) * h) / 2 * f];
  });

/** A cog outline round (0, 0) with `n` teeth, outer radius `r`. */
const cogShape = (r: number, n: number): [number, number][] => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) for (const [da, f] of [[-0.3, 0.74], [-0.14, 1], [0.14, 1], [0.3, 0.74]] as const) {
    const a = ((i + da + 0.5) / n) * Math.PI * 2;
    pts.push([Math.cos(a) * r * f, Math.sin(a) * r * f]);
  }
  return pts;
};

/** Rows `r0`..`r1` of a `surface` or `grid` of `segs` columns, as a geometry sharing its vertices (one sheet split over bones). */
function rowsOf(g: BufferGeometry, segs: number, r0: number, r1: number): BufferGeometry {
  const out = new BufferGeometry();
  for (const [n, a] of Object.entries(g.attributes)) out.setAttribute(n, a);
  out.setIndex(Array.from(g.index!.array).slice(r0 * segs * 6, r1 * segs * 6));
  return out;
}

// ---------------------------------------------------------------- neck

/** Round the neck: the torso axis under the middle of the neck (its skin is about round about it). */
export const NECK_AXIS: Axis = axis([0, 0, -0.045], [0, 1, 0], [0, 0, 1]);

/**
 * The outfit round the neck, measured round `NECK_AXIS` (angle 0 front, +π/2 the hero's left), for collars
 * that hug the neck now that most looks wear no scarf (Johannes, 2026-11-19).
 */
export interface Neck {
  /** The outfit round the neck axis without the sleeves (frames with `onSurface`). */
  s: Sampler;
  /** Height of the neckline's top (the tips of its frayed edge) at angle `a`, and its radius there. */
  edgeY(a: number): number;
  edgeR(a: number): number;
  /** Outermost neck skin (jaw, chin) or hair at height `y`, within ±`turn` rad of `a` (the head turns); 0 where none. */
  skin(y: number, a: number, turn?: number): number;
  hair(y: number, a: number, turn?: number): number;
  /** Bind point at height `y`, angle `a`, `r` m off the neck axis. */
  point(y: number, a: number, r: number): Vector3;
  /** The outfit's outer surface seen from `NECK_BASE` (shoulders, chest, back): its distance at angle `a` and elevation `phi` (0 level, π/2 up). */
  shell(a: number, phi: number): number;
  /** Elevation of the neckline's tips seen from `NECK_BASE`. */
  edgePhi(a: number): number;
  /** Bind point at angle `a`, elevation `phi`, distance `d` from `NECK_BASE`. */
  at(a: number, phi: number, d: number): Vector3;
}

/** Centre of the shoulder shell (`Neck.shell`): under the neck, at the height of the collarbones. */
export const NECK_BASE = new Vector3(0, 1.37, -0.045);

const necks = new WeakMap<HeroSource, Map<string, Neck>>();
const NB = 48;
const angDist = (p: number, q: number): number => { const d = Math.abs(p - q) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };

/** The neck tables of an outfit (cached per hero). */
export function neckOf(k: GearKit, node: 'a_mantel' | 'a_weste' | 'a_poncho'): Neck {
  let m = necks.get(k.src);
  if (!m) necks.set(k.src, (m = new Map()));
  const hit = m.get(node);
  if (hit) return hit;
  const cz = NECK_AXIS.o.z;
  // (y, angle, radius) of the vertices near the neck.
  const pts = (name: string, y0: number, y1: number, rMax: number): Float32Array => {
    const p = k.src.meshes.get(name) ?? new Float32Array(0), out: number[] = [];
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i]!, y = p[i + 1]!, z = p[i + 2]! - cz, r = Math.hypot(x, z);
      if (y >= y0 && y <= y1 && r <= rMax) out.push(y, Math.atan2(x, z), r);
    }
    return new Float32Array(out);
  };
  const fit = pts(node, 1.3, 1.56, 0.22), head = pts('body_head', 1.44, 1.66, 0.2), hair = pts('hair', 1.44, 1.7, 0.2);
  // Neckline per angle bin: the highest outfit vertex within 0.15 m, and the mean radius just under it.
  const top = new Array<number>(NB).fill(0), rad = new Array<number>(NB).fill(0), cnt = new Array<number>(NB).fill(0);
  const bin = (a: number): number => ((Math.round((a / (2 * Math.PI)) * NB) % NB) + NB) % NB;
  for (let i = 0; i < fit.length; i += 3) if (fit[i + 2]! < 0.15 && fit[i]! > 1.4) { const b = bin(fit[i + 1]!); top[b] = Math.max(top[b]!, fit[i]!); }
  for (let i = 0; i < fit.length; i += 3) if (fit[i + 2]! < 0.15) { const b = bin(fit[i + 1]!); if (fit[i]! > top[b]! - 0.008) { rad[b] = rad[b]! + fit[i + 2]!; cnt[b] = cnt[b]! + 1; } }
  for (let b = 0; b < NB; b++) rad[b] = cnt[b] ? rad[b]! / cnt[b]! : 0;
  const fill = (t: number[]): void => { for (let b = 0; b < NB; b++) if (!t[b]) { let d = 1; while (!t[(b + d) % NB] && !t[(b - d + NB) % NB] && d < NB) d++; t[b] = t[(b + d) % NB] || t[(b - d + NB) % NB]!; } };
  fill(top); fill(rad);
  // Smooth round: the top keeps its tips (max-preserving), the radius averages.
  let ty = top, tr = rad;
  for (let pass = 0; pass < 2; pass++) {
    ty = ty.map((y, b) => Math.max(y, (ty[(b + NB - 1) % NB]! + 2 * y + ty[(b + 1) % NB]!) / 4));
    tr = tr.map((r, b) => (tr[(b + NB - 1) % NB]! + 2 * r + tr[(b + 1) % NB]!) / 4);
  }
  const lerp = (t: number[], a: number): number => { const f = (((a / (2 * Math.PI)) * NB) % NB + NB) % NB, b = Math.floor(f), w = f - b; return t[b]! * (1 - w) + t[(b + 1) % NB]! * w; };
  const outer = (p: Float32Array, y: number, a: number, turn: number): number => {
    let best = 0;
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i]! - y) <= 0.006 && p[i + 2]! > best && angDist(p[i + 1]!, a) <= turn + 0.1) best = p[i + 2]!;
    return best;
  };
  const s = subset(k, `neck-${node}`, node, (x, y, z) => y > 1.3 && Math.hypot(x, z - cz) < 0.2, NECK_AXIS);
  // The trunk round NECK_BASE: (angle, elevation, distance) without the sleeves.
  const sph = ((): Float32Array => {
    const p = k.src.meshes.get(node) ?? new Float32Array(0), out: number[] = [];
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i]!, y = p[i + 1]! - NECK_BASE.y, z = p[i + 2]! - NECK_BASE.z, h = Math.hypot(x, z), d = Math.hypot(h, y);
      if (Math.abs(p[i]!) < 0.18 && p[i + 1]! > 1.2 && d < 0.24) out.push(Math.atan2(x, z), Math.atan2(y, h), d);
    }
    return new Float32Array(out);
  })();
  const n: Neck = {
    s,
    edgeY: (a) => lerp(ty, a),
    edgeR: (a) => lerp(tr, a),
    skin: (y, a, turn = 0) => outer(head, y, a, turn),
    hair: (y, a, turn = 0) => outer(hair, y, a, turn),
    point: (y, a, r) => s.point(y, a, r),
    shell: (a, phi) => {
      for (let tries = 0, da = 0.14, dp = 0.06; tries < 4; tries++, da *= 1.6, dp *= 1.6) {
        let best = 0;
        for (let i = 0; i < sph.length; i += 3) if (sph[i + 2]! > best && Math.abs(sph[i + 1]! - phi) <= dp && angDist(sph[i]!, a) <= da) best = sph[i + 2]!;
        if (best) return best;
      }
      return 0.1;
    },
    edgePhi: (a) => Math.atan2(lerp(ty, a) - NECK_BASE.y, lerp(tr, a)),
    at: (a, phi, d) => new Vector3(Math.sin(a) * Math.cos(phi) * d, NECK_BASE.y + Math.sin(phi) * d, NECK_BASE.z + Math.cos(a) * Math.cos(phi) * d),
  };
  m.set(node, n);
  return n;
}

export interface CollarOpts {
  /** Angle range round the neck (open at the front between a1 and a0 + 2π). */
  a0: number;
  a1: number;
  segs: number;
  rows: number;
  /** Height of the top edge over the neckline, by angle. */
  h: (a: number) => number;
  /** The foot starts this far under the neckline's tips (covers its frayed edge, also when the neck carries the neckline down). */
  drop?: number;
  /** Lift of the foot off the outfit; flare of the top out of the foot (m, by angle; grows with v²). */
  lift?: number;
  flare?: (a: number) => number;
  /** Clearance from the neck skin and from the hair (0: the hair may fall over the collar), with the head turned ±`turn`. */
  clear?: number;
  hairClear?: number;
  turn?: number;
}

/** A collar standing on the neckline: radii per (row, column) fitted to the neck, `at(u, v, dr)` a point on it (`dr` out of it). */
export function collarShell(n: Neck, o: CollarOpts): { at: (u: number, v: number, dr?: number) => Vector3; geo: BufferGeometry } {
  const { a0, a1, segs, rows } = o, drop = o.drop ?? 0.026, lift = o.lift ?? 0.006, clear = o.clear ?? 0.018, turn = o.turn ?? 0.35;
  const ang = (u: number): number => a0 + (a1 - a0) * u;
  const yOf = (u: number, v: number): number => { const a = ang(u), e = n.edgeY(a); return e - drop + (o.h(a) + drop) * v; };
  const R: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    let row = Array.from({ length: segs + 1 }, (_, j) => {
      const u = j / segs, a = ang(u), y = yOf(u, v);
      const base = n.edgeR(a) + lift + (o.flare?.(a) ?? 0) * v * v;
      // Under the neckline the outfit itself is in the way (the foot runs into it when the neck tilts back, no gap opens).
      if (y < n.edgeY(a) - 0.004) return base;
      return Math.max(base, n.skin(y, a, turn) + clear, o.hairClear ? n.hair(y, a, turn) + o.hairClear : 0);
    });
    for (let pass = 0; pass < 2; pass++) row = row.map((x, j) => Math.max(x, (row[Math.max(0, j - 1)]! + 2 * x + row[Math.min(segs, j + 1)]!) / 4));
    // Never leaning in going up: a clearance higher up pushes the rows under it out a little too.
    R.push(r ? row.map((x, j) => Math.max(x, R[r - 1]![j]!)) : row);
  }
  for (let r = rows - 1; r >= 0; r--) R[r] = R[r]!.map((x, j) => Math.max(x, R[r + 1]![j]! - 1.0 * (yOf(j / segs, (r + 1) / rows) - yOf(j / segs, r / rows))));
  const at = (u: number, v: number, dr = 0): Vector3 => {
    const fu = Math.min(segs, Math.max(0, u * segs)), fv = Math.min(rows, Math.max(0, v * rows));
    const j = Math.min(segs - 1, Math.floor(fu)), r = Math.min(rows - 1, Math.floor(fv)), x = fu - j, y = fv - r;
    const rr = (R[r]![j]! * (1 - x) + R[r]![j + 1]! * x) * (1 - y) + (R[r + 1]![j]! * (1 - x) + R[r + 1]![j + 1]! * x) * y;
    return n.point(yOf(u, v), ang(u), rr + dr);
  };
  return { at, geo: grid(segs, rows, (u, v) => at(u, v)) };
}

export interface YokeOpts {
  a0: number;
  a1: number;
  segs: number;
  /** Rings on the shoulders from the outer edge up to the neckline (one more ring hugs the neck above it). */
  rows: number;
  /** Elevation of the outer edge seen from `NECK_BASE`, by angle. */
  phi0: (a: number) => number;
  /** Height of the top ring over the neckline, by angle. */
  top: (a: number) => number;
  /** Lift off the outfit at the outer edge and at the neckline. */
  lift0: number;
  lift1: number;
  clear?: number;
  turn?: number;
}

/** A shell lying on the shoulders round the neck: from an outer edge up the outfit to a ring hugging the neck; `at(u, v, dr)` (v 0 outer edge, 1 top ring, `dr` out of it). */
export function yoke(n: Neck, o: YokeOpts): { at: (u: number, v: number, dr?: number) => Vector3; geo: BufferGeometry } {
  const { a0, a1, segs, rows } = o, clear = o.clear ?? 0.018, turn = o.turn ?? 0.35;
  const ang = (u: number): number => a0 + (a1 - a0) * u;
  const rings: Vector3[][] = [];
  for (let r = 0; r <= rows; r++) {
    const w = r / rows, lift = o.lift0 + (o.lift1 - o.lift0) * w;
    const phi = (u: number): number => { const a = ang(u); return o.phi0(a) + (n.edgePhi(a) - 0.03 - o.phi0(a)) * w; };
    let d = Array.from({ length: segs + 1 }, (_, j) => n.shell(ang(j / segs), phi(j / segs)));
    for (let pass = 0; pass < 2; pass++) d = d.map((x, j) => Math.max(x, (d[Math.max(0, j - 1)]! + 2 * x + d[Math.min(segs, j + 1)]!) / 4));
    rings.push(d.map((x, j) => n.at(ang(j / segs), phi(j / segs), x + lift)));
  }
  rings.push(Array.from({ length: segs + 1 }, (_, j) => {
    const a = ang(j / segs), y = n.edgeY(a) + o.top(a);
    return n.point(y, a, Math.max(n.edgeR(a) + o.lift1, n.skin(y, a, turn) + clear));
  }));
  const R = rows + 1;
  const at = (u: number, v: number, dr = 0): Vector3 => {
    const fu = Math.min(segs, Math.max(0, u * segs)), fv = Math.min(R, Math.max(0, v * R));
    const j = Math.min(segs - 1, Math.floor(fu)), r = Math.min(R - 1, Math.floor(fv)), x = fu - j, y = fv - r;
    const p = rings[r]![j]!.clone().lerp(rings[r]![j + 1]!, x).lerp(rings[r + 1]![j]!.clone().lerp(rings[r + 1]![j + 1]!, x), y);
    return dr ? p.addScaledVector(p.clone().sub(NECK_BASE).normalize(), dr) : p;
  };
  return { at, geo: grid(segs, R, (u, v) => at(u, v)) };
}

/** A plain band round the neckline in the outfit's colour (covers the frayed edge where no collar or scarf does), open ±`gap` at the front. */
export function neckBand(k: GearKit, node: 'a_mantel' | 'a_weste', paint: Paint, h = 0.012, gap = 0, lift = 0.005): void {
  const n = neckOf(k, node), segs = 20;
  const { geo } = collarShell(n, { a0: gap || -Math.PI, a1: gap ? 2 * Math.PI - gap : Math.PI, segs, rows: 1, h: () => h, drop: 0.022, lift, clear: 0.016, turn: 0.3 });
  k.on('spine_03', () => k.add(geo, paint));
}

// ---------------------------------------------------------------- Köpenick

/** Arbeitsmantel: wide tool belt, brass buckle, two pouches and a hammer in a loop on the left hip, a pocket watch on a chain on the right. */
function beltTool(k: GearKit): void {
  const { at } = belt(k, 'a_mantel', 0x3a2414, 0.062);
  const brass = metal(0xc9a34a), dark = plain(0x2e1c10), steel = bright(0xa4a8ae);
  k.on('pelvis', () => {
    k.frame(at(0), () => buckle(k, 0.076, 0.068, brass, plain(0x3a2414)));
    for (const a of [0.42, 0.72]) k.frame(at(a, -0.026, 0.018), () => {
      k.add(box(0.058, 0.084, 0.036), plain(0x5a3a22)).add(box(0.064, 0.034, 0.04), plain(0x4a2e1a), 0, 0.027, 0.003).add(cyl(0.006, 0.006, 0.006, 6), brass, 0, 0.016, 0.023, Math.PI / 2);
    });
    // Hammer: the steel head rests on the loop's ring, the handle hangs down the hip.
    k.frame(tilt(at(1.05, 0, 0.002), -0.26), () => {
      k.add(box(0.03, 0.07, 0.01), dark, 0, -0.045, 0).add(ring(0.017, 0.0035, 4, 10), metal(0x6a6c70), 0, -0.08, 0.02, Math.PI / 2);
      k.add(box(0.07, 0.038, 0.038), steel, 0.004, -0.06, 0.02).add(cyl(0.022, 0.022, 0.026, 8), steel, -0.042, -0.06, 0.02, 0, 0, Math.PI / 2)
        .add(box(0.056, 0.03, 0.015), steel, 0.058, -0.071, 0.02, 0, 0, -0.5);
      k.add(cyl(0.012, 0.0135, 0.2, 6), wood(0x9a6e40), 0, -0.178, 0.02).add(cyl(0.0145, 0.0145, 0.034, 6), plain(0x2a1a10), 0, -0.26, 0.02);
    });
    // Pocket watch under the belt on the right, its chain up to the buckle.
    const wf = at(-0.5, -0.072, 0.012);
    k.frame(wf, () => {
      k.add(cyl(0.03, 0.03, 0.012, 14), brass, 0, 0, 0, Math.PI / 2).add(cyl(0.024, 0.024, 0.004, 14), plain(0xf0e2c0), 0, 0, 0.0065, Math.PI / 2)
        .add(box(0.0025, 0.017, 0.002), plain(0x2a2018), 0, 0.007, 0.009).add(box(0.012, 0.0025, 0.002), plain(0x2a2018), 0.005, 0, 0.009)
        .add(ring(0.008, 0.0028, 4, 8), brass, 0, 0.039, 0).add(cyl(0.005, 0.005, 0.008, 6), brass, 0, 0.032, 0);
    });
    const bow = new Vector3(0, 0.046, 0).applyMatrix4(wf), end = new Vector3().setFromMatrixPosition(at(-0.2, -0.012, 0.004));
    cord(k.parts, bow.toArray(), end.toArray(), 0.022, 0.0042, bright(0xd8b45a), 6);
  });
}

/** Knee pads on the vest's trousers: a domed six-sided cap over a softer pad, a strap round the leg below the knee. */
export function kneepads(cap: number, pad: number, strap: number): GearBuilder {
  return (k) => {
    for (const s of SIDES) {
      const leg = k.leg(s);
      const R = (t: number, a: number): number => leg.radius(t, a, 0.014, 0.22);
      const sheet = (m: number, lift: number, dome: number): ((u: number, v: number, under?: number) => Vector3) => (u, v, under = 0) => {
        const t = 0.462 - m + (0.153 + 2 * m) * v, U = u * 2 - 1;
        const a = U * (1 + m * 5) * Math.min(1, 0.3 + 3.2 * v, 0.3 + 3.2 * (1 - v));
        return leg.point(t, a, R(t, a) + lift - under * 0.006 + dome * (1 - U * U) * Math.sin(Math.PI * v));
      };
      const top = sheet(0, 0.013, 0.009);
      k.on(`calf_${lr(s)}`, () => {
        k.add(grid(6, 4, sheet(0.008, 0.007, 0.004)), plain(pad));
        k.add(grid(6, 5, top), plain(cap)).add(edge(6, 5, top), plain(cap));
        k.add(surface(leg, 0.47, 0.49, { segs: 12, rows: 1, offset: 0.006, median: 3 }), plain(strap));
      });
    }
  };
}

// ---------------------------------------------------------------- Xhain

/** A turned-up collar on the coat's neckline: `collarShell` over `a0`..2π−`a0`, `h(a)` tall, painted, `trim` a band round its upper part. */
function coatCollar(k: GearKit, a0: number, h: (a: number) => number, flare: number, paint: Paint, trim?: { paint: Paint; v0: number; v1: number }, segs = 16, rows = 2): (u: number, v: number, dr?: number) => Vector3 {
  const { at, geo } = collarShell(neckOf(k, 'a_mantel'), { a0, a1: 2 * Math.PI - a0, segs, rows, h, flare: () => flare, lift: 0.006 });
  k.on('spine_03', () => {
    k.add(geo, paint);
    if (trim) k.add(grid(segs, 1, (u, v) => at(u, trim.v0 + (trim.v1 - trim.v0) * v, 0.0025)), trim.paint);
  });
  return at;
}

/** Height over the neckline by the angle from the front: `f` at the front, `b` at the back. */
const frontBack = (f: number, b: number) => (a: number): number => f + (b - f) * (1 - Math.cos(a)) / 2;

/** Lederjacke: a black turned-up collar; two rows of chrome pyramid studs along each shoulder. */
function studs(k: GearKit): void {
  const chrome = bright(0xdfe3e6);
  coatCollar(k, 0.3, frontBack(0.014, 0.022), 0.014, plain(0x1a1416), undefined, 12, 1);
  for (const s of SIDES) {
    const arm = k.arm(s, ['a_mantel']);
    const top = -s * Math.PI / 2;
    for (let i = 0; i < 4; i++) for (const off of [0.36, -0.3]) {
      const t = 0.13 + i * 0.022;
      k.on(`clavicle_${lr(s)}`, () => k.frame(onSurface(arm, t, top + s * off, 0.002 + puffAt('leder', t, 1.47)), () => stud(k, 0.0085, chrome)));
    }
    k.on(`upperarm_${lr(s)}`, () => k.frame(onSurface(arm, 0.218, top + s * 0.05, 0.002 + puffAt('leder', 0.218, 1.46)), () => stud(k, 0.0095, chrome)));
  }
}

/** Lederjacke: black belt with chrome studs all round, a chrome buckle and a chain loop on the left hip. */
function beltStudded(k: GearKit): void {
  const { y, at } = belt(k, 'a_mantel', 0x141012, 0.05);
  const chrome = bright(0xd8dce0), core = coatCore(k);
  k.on('pelvis', () => {
    k.frame(at(0), () => buckle(k, 0.072, 0.056, chrome, plain(0x141012)));
    for (let a = 0.36; a < Math.PI; a += 0.25) for (const sg of SIDES) k.frame(at(a * sg, 0, 0.001), () => stud(k, 0.0072, chrome));
    const end = (a: number): Vector3 => new Vector3().setFromMatrixPosition(at(a, -0.022, 0.005));
    const mid = (a: number, dy: number): Vector3 => core.point(y + dy, a, core.radius(y + dy, a, 0.012, 0.2) + 0.022);
    k.add(tube([end(0.42), mid(0.6, -0.07), mid(0.85, -0.094), mid(1.08, -0.064), end(1.2)], 0.0038, 10, 4), chrome);
  });
}

/** Lederjacke: three stitched patches on the chest, clear of the scarf's front tail. */
function patchesPunk(k: GearKit): void {
  const s = k.sampler(['a_mantel'], AXES.torso);
  // x, y, width, height, colour, turn; each with its own mark: a black cross, a red dot, a yellow bar.
  const P: readonly (readonly [number, number, number, number, number, number])[] = [[-0.1, 1.3, 0.05, 0.042, 0xc0302a, -0.14], [-0.036, 1.165, 0.042, 0.05, 0xe8d36a, 0.1], [0.07, 1.15, 0.036, 0.034, 0xc0302a, 0.22]];
  P.forEach(([x, y, w, h, col, rot], i) => k.on(y > 1.27 ? 'spine_03' : 'spine_02', () => k.frame(fit(s, y, angleAt(s, y, x), 0.004), () => {
    k.add(box(w + 0.008, h + 0.008, 0.002), plain(0x0e0c0e), 0, 0, 0, 0, 0, rot).add(box(w, h, 0.003), cloth(col), 0, 0, 0.0015, 0, 0, rot);
    if (i === 0) for (const r of [0.8, -0.8]) k.add(box(w * 0.8, 0.006, 0.002), plain(0x1a1416), 0, 0, 0.003, 0, 0, rot + r);
    else if (i === 1) k.add(cyl(w * 0.24, w * 0.24, 0.002, 10), plain(0xc0302a), 0, 0, 0.003, Math.PI / 2);
    else k.add(box(w * 0.8, h * 0.26, 0.002), plain(0xe8d36a), 0, 0, 0.003, 0, 0, rot);
  })));
}

/** Lederjacke: worn rips over both knees, skin under white threads (on the thigh: the trousers there follow it). */
function rips(k: GearKit): void {
  for (const s of SIDES) {
    const leg = coatLeg(k, s), t = s > 0 ? 0.572 : 0.562, a = -s * 0.08;
    k.on(`thigh_${lr(s)}`, () => k.frame(fit(leg, t, a, 0.004), () => {
      const R = Math.max(0.05, leg.radius(t, a));
      k.add(bend(flat(ragged(0.066, 0.05, 12, 0.18, s), 0.002), R), plain(0xbcc4d2)).add(bend(flat(ragged(0.052, 0.037, 10, 0.2, s + 2), 0.002), R), plain(0xb97a56), 0, 0, 0.0012);
      for (const [dy, w, r] of [[-0.008, 0.058, 0.06], [0.01, 0.056, -0.05]] as const) k.add(bend(box(w, 0.0034, 0.002), R + 0.003), plain(0xf2eee6), 0, dy, 0.003, 0, 0, r);
    }));
  }
}

/** Feuerwehrjacke: black hook belt, steel buckle, a carabiner, an axe hanging in a holster on the left hip. */
function beltFire(k: GearKit): void {
  const { at } = belt(k, 'a_mantel', 0x1e1a1a, 0.07);
  const steel = bright(0xb8bcc0);
  k.on('pelvis', () => {
    k.frame(at(0), () => {
      k.add(box(0.084, 0.074, 0.01), steel).add(box(0.054, 0.038, 0.004), plain(0x1e1a1a), 0, 0, 0.005).add(box(0.03, 0.012, 0.006), steel, 0, 0, 0.007);
    });
    k.frame(at(0.55, -0.064, 0.008), () => {
      k.add(scaled(ring(0.017, 0.0045, 4, 12), 1, 1.45, 1), bright(0xc8ccd0)).add(box(0.005, 0.03, 0.005), metal(0x8a8e92), 0.016, 0, 0);
    });
    k.frame(tilt(at(1.0, -0.02, 0.018), -0.28), () => {
      k.add(box(0.05, 0.11, 0.034), plain(0x2a2422), 0, -0.03, 0).add(box(0.054, 0.014, 0.038), plain(0x141012), 0, 0.012, 0).add(cyl(0.005, 0.005, 0.004, 6), steel, 0, -0.04, 0.018, Math.PI / 2);
      k.add(cyl(0.011, 0.012, 0.15, 6), wood(0x8a5a2a), 0, -0.16, 0);
      k.add(flat([[0.012, 0.016], [0.05, 0.006], [0.056, -0.002], [0.012, -0.016], [-0.03, -0.02], [-0.068, -0.04], [-0.074, 0.038], [-0.03, 0.02]], 0.014), plain(0xc03020), 0, -0.248, 0);
      k.add(box(0.008, 0.074, 0.016), steel, -0.074, -0.248, 0);
    });
  });
}

/** Feuerwehrjacke: a tall dark red stand collar with a reflective yellow band (gear id `collar-fire`). */
function collarFire(k: GearKit): void {
  coatCollar(k, 0.3, frontBack(0.024, 0.032), 0.01, cloth(0x7a1a10), { paint: plain(0xe8d36a), v0: 0.42, v1: 0.62 });
}

/** BVG-Uniform: a navy stand collar with yellow piping; yellow shoulder boards from near the collar to the shoulder seam, with a gold button. */
function boardsBvg(k: GearKit): void {
  coatCollar(k, 0.22, frontBack(0.018, 0.022), 0.006, plain(0x1c2438), { paint: plain(0xf2c230), v0: 0.76, v1: 1 });
  for (const s of SIDES) {
    const arm = k.arm(s, ['a_mantel']);
    const top = -s * Math.PI / 2;
    const at = (u: number, v: number, under = 0): Vector3 => {
      const t = 0.124 + 0.078 * u, a = top + s * (0.44 - 0.88 * v) * (1 - 0.2 * (1 - u));
      return arm.point(t, a, arm.radius(t, a, 0.012, 0.2) + 0.009 + puffAt('bvg', t, 1.47) - under * 0.007);
    };
    k.on(`clavicle_${lr(s)}`, () => {
      k.add(grid(4, 2, at), plain(0xf2c230)).add(edge(4, 2, at), plain(0xc89a20));
      k.frame(onSurface(arm, 0.142, top, 0.012 + puffAt('bvg', 0.142, 1.48)), () => k.add(cyl(0.008, 0.008, 0.006, 8), metal(0xb8901c), 0, 0, 0, Math.PI / 2));
    });
  }
}

/** BVG-Uniform: round yellow badge with a navy centre on the right chest (as drawn). */
function badgeBvg(k: GearKit): void {
  const s = k.sampler(['a_mantel'], AXES.torso), y = 1.312;
  k.on('spine_03', () => k.frame(fit(s, y, angleAt(s, y, -0.074), 0.004), () => {
    k.add(cyl(0.027, 0.027, 0.006, 14), metal(0xf2c230), 0, 0, 0, Math.PI / 2).add(cyl(0.014, 0.014, 0.004, 12), plain(0x26304a), 0, 0, 0.003, Math.PI / 2)
      .add(cyl(0.005, 0.005, 0.003, 6), metal(0xf2c230), 0, 0, 0.005, Math.PI / 2);
  }));
}

/** BVG-Uniform: black belt, yellow buckle, a ticket pouch with a yellow flap edge and a ticket peeking out. */
function beltBvg(k: GearKit): void {
  const { at } = belt(k, 'a_mantel', 0x141620, 0.052);
  k.on('pelvis', () => {
    k.frame(at(0), () => buckle(k, 0.062, 0.05, metal(0xf2c230), plain(0x141620)));
    k.frame(at(0.6, -0.034, 0.018), () => {
      k.add(box(0.072, 0.088, 0.032), plain(0x1e2230)).add(box(0.044, 0.024, 0.003), plain(0xece6d6), 0.008, 0.044, -0.004, 0, 0, 0.1)
        .add(box(0.076, 0.032, 0.036), plain(0x262c3e), 0, 0.03, 0.002).add(box(0.07, 0.007, 0.003), plain(0xf2c230), 0, 0.016, 0.02);
    });
  });
}

// ---------------------------------------------------------------- Alexanderplatz

/** Lift of the Blaumann's bib over the vest (m); its pocket, buttons and patch sit on it. */
const BIB_LIFT = 0.008;
const BIB = { t0: 1.045, t1: 1.365, a: 0.53, segs: 8, rows: 8 } as const;

/**
 * The bib's shape over the vest: radii measured with a tall slab, then valleys filled round and up (the
 * bib bridges the cleavage and the vest's straps instead of following them). `at(t, a, lift)` is a point on it.
 */
function bibShape(k: GearKit): { s: Sampler; at: (t: number, a: number, lift?: number) => Vector3; frame: (t: number, x: number, lift: number) => Matrix4 } {
  const s = k.sampler(['a_weste'], AXES.torso), { t0, t1, a, segs, rows } = BIB;
  const R = Array.from({ length: rows + 1 }, (_, r) => Array.from({ length: segs + 1 }, (_, j) => s.radius(t0 + ((t1 - t0) * r) / rows, -a + (2 * a * j) / segs, 0.022, 0.12)));
  for (let pass = 0; pass < 5; pass++) {
    for (const row of R) for (let j = 1; j < segs; j++) row[j] = Math.max(row[j]!, (row[j - 1]! + row[j + 1]!) / 2);
    for (let j = 0; j <= segs; j++) for (let r = 1; r < rows; r++) R[r]![j] = Math.max(R[r]![j]!, (R[r - 1]![j]! + R[r + 1]![j]!) / 2);
  }
  const radius = (t: number, aa: number): number => {
    const v = Math.min(rows, Math.max(0, ((t - t0) / (t1 - t0)) * rows)), u = Math.min(segs, Math.max(0, ((aa + a) / (2 * a)) * segs));
    const r0 = Math.min(rows - 1, Math.floor(v)), j0 = Math.min(segs - 1, Math.floor(u)), fv = v - r0, fu = u - j0;
    const row = (r: number): number => R[r]![j0]! * (1 - fu) + R[r]![j0 + 1]! * fu;
    return row(r0) * (1 - fv) + row(r0 + 1) * fv;
  };
  const at = (t: number, aa: number, lift = 0): Vector3 => s.point(t, aa, radius(t, aa) + BIB_LIFT + lift);
  const frame = (t: number, x: number, lift: number): Matrix4 => {
    const aa = angleAt(s, t, x), p = at(t, aa, lift);
    const up = at(t + 0.02, aa).sub(at(t - 0.02, aa)).normalize(), round = at(t, aa + 0.1).sub(at(t, aa - 0.1)).normalize();
    const n = new Vector3().crossVectors(round, up).normalize(), xx = new Vector3().crossVectors(up, n).normalize();
    return basis(p, xx, new Vector3().crossVectors(n, xx), n);
  };
  return { s, at, frame };
}

/** Blaumann: bib front with a chest pocket over the vest, straps over the shoulders to the back, brass buttons. */
function bib(k: GearKit): void {
  const { s, at, frame } = bibShape(k), { t0, t1, a, segs, rows } = BIB;
  const seam = cloth(0x1d5291), brass = bright(0xc89a48);
  const part = (ta: number, tb: number, a0: number, a1: number, n: number, m: number, lift: number): BufferGeometry =>
    grid(n, m, (u, v) => at(ta + (tb - ta) * v, a0 + (a1 - a0) * u, lift));
  // One sheet up the front (rows of 4 cm), split over the spine bones it covers.
  const sheet = part(t0, t1, -a, a, segs, rows, 0);
  // Side walls down to the vest, so the bib does not read as a loose sheet from the side.
  const walls = SIDES.map((sg) => grid(1, rows, (u, v) => { const t = t0 + (t1 - t0) * v; return u ? s.point(t, a * sg, s.radius(t, a * sg) + 0.002) : at(t, a * sg); }));
  ([[0, 3, 'spine_01'], [3, 5, 'spine_02'], [5, 8, 'spine_03']] as const).forEach(([r0, r1, bone]) => k.on(bone, () => {
    k.add(rowsOf(sheet, segs, r0, r1), cloth(0x2a6db3));
    for (const w of walls) k.add(rowsOf(w, 1, r0, r1), seam);
  }));
  k.on('spine_03', () => {
    k.add(part(t1 - 0.016, t1 + 0.002, -a - 0.01, a + 0.01, segs, 1, 0.003), seam);
    k.add(part(1.244, 1.312, -0.23, 0.23, 4, 1, 0.004), cloth(0x225f9f)).add(part(1.298, 1.318, -0.245, 0.245, 4, 1, 0.007), seam);
    for (const sg of SIDES) k.frame(frame(1.352, 0.066 * sg, 0.006), () => k.add(cyl(0.011, 0.011, 0.007, 10), brass, 0, 0, 0, Math.PI / 2).add(cyl(0.006, 0.006, 0.004, 8), metal(0x8a6428), 0, 0, 0.004, Math.PI / 2));
  });
  // Straps: up the front from the bib, over the shoulder (under the scarf), down the back.
  const sag = k.sampler(['a_weste'], axis([0, 1.36, -0.03], [1, 0, 0], [0, 0, 1]));
  for (const sg of SIDES) {
    const pts: Vector3[] = [], ns: Vector3[] = [], bones: string[] = [];
    const front = (x: number, y: number): void => { const aa = angleAt(s, y, x * sg); pts.push(s.point(y, aa, s.radius(y, aa, 0.012, 0.15) + BIB_LIFT + 0.002)); ns.push(s.out(aa)); bones.push('spine_03'); };
    const over = (x: number, aa: number): void => { pts.push(sag.point(x * sg, aa, sag.radius(x * sg, aa) + 0.008)); ns.push(sag.out(aa)); bones.push('spine_03'); };
    const back = (x: number, y: number): void => { const aa = angleAt(s, y, x * sg, true); pts.push(s.point(y, aa, s.radius(y, aa, 0.012, 0.15) + 0.007)); ns.push(s.out(aa)); bones.push(y > 1.25 ? 'spine_03' : y > 1.15 ? 'spine_02' : 'spine_01'); };
    front(0.066, 1.35); front(0.078, 1.39); front(0.09, 1.43);
    over(0.1, -0.9); over(0.104, -1.35); over(0.104, -1.8); over(0.1, -2.25);
    back(0.098, 1.42); back(0.094, 1.36); back(0.09, 1.3); back(0.086, 1.25); back(0.083, 1.2); back(0.08, 1.15); back(0.078, 1.1); back(0.076, 1.05);
    // One strip per bone, sharing the point where the bone changes.
    let i0 = 0;
    for (let i = 1; i <= pts.length; i++) if (i === pts.length || bones[i] !== bones[i0]) {
      const i1 = Math.min(pts.length - 1, i);
      k.on(bones[i0]!, () => k.add(strip(pts.slice(i0, i1 + 1), ns.slice(i0, i1 + 1), 0.022), seam));
      i0 = i1;
      if (i === pts.length) break;
    }
  }
}

/** Blaumann: yellow round patch with a red cog, on the bib left of the pocket (as drawn). */
function patchGear(k: GearKit): void {
  const { frame } = bibShape(k);
  k.on('spine_03', () => k.frame(frame(1.28, -0.068, 0.005), () => {
    k.add(cyl(0.029, 0.029, 0.006, 14), plain(0xf3ce43), 0, 0, 0, Math.PI / 2).add(flat(cogShape(0.021, 7), 0.003, [[0, 0, 0.007]]), plain(0xb93432), 0, 0, 0.004);
  }));
}

/** Blaumann: a wrench hanging from a loop on the side of the left thigh (an overall's hammer loop). */
function wrench(k: GearKit): void {
  const leg = k.leg(1), steel = bright(0xa0a4aa);
  k.on('thigh_l', () => k.frame(fit(leg, 0.87, 1.3, 0.006), () => {
    k.add(box(0.032, 0.022, 0.01), cloth(0x1c4f86)).add(ring(0.013, 0.0042, 4, 10), steel, 0, 0.004, 0.009)
      .add(box(0.017, 0.13, 0.006), steel, 0, -0.074, 0.009).add(box(0.04, 0.016, 0.007), steel, 0, -0.146, 0.009)
      .add(box(0.01, 0.026, 0.007), steel, -0.015, -0.164, 0.009).add(box(0.01, 0.026, 0.007), steel, 0.015, -0.164, 0.009);
  }));
}

// ---------------------------------------------------------------- Mitte

/** Regenponcho (until the Blender shell, B1): glowing cyan bands round the chest under the bust and on the belt. */
function ponchoBands(k: GearKit): void {
  const s = k.sampler(['a_poncho'], AXES.torso), cyan = glow(0x43d1cf);
  k.on('spine_02', () => k.add(surface(s, 1.188, 1.204, { segs: 32, rows: 1, offset: 0.007, median: 5 }), cyan));
  k.on('pelvis', () => k.add(surface(s, 1.072, 1.088, { segs: 32, rows: 1, offset: 0.012, median: 11 }), cyan));
}

/** Regenponcho: the rolled-down hood, a roll lying round the neck on the shoulders (open at the front), its bag hanging on the upper back. */
function hoodRoll(k: GearKit): void {
  const s = ponchoCore(k), n = neckOf(k, 'a_poncho');
  // Centre line, one side from the front end to the back middle: angle from the front, how far down the shoulder from the neckline (rad, seen from NECK_BASE), tube radius.
  const line: readonly (readonly [number, number, number])[] = [[0.8, 0.05, 0.01], [1.05, 0.07, 0.015], [1.4, 0.09, 0.019], [1.8, 0.1, 0.022], [2.3, 0.13, 0.025], [2.75, 0.16, 0.027], [Math.PI, 0.17, 0.028]];
  const pts: Vector3[] = [], rad: number[] = [];
  const put = (a: number, dp: number, rt: number): void => {
    const phi = n.edgePhi(a) - dp, d = n.shell(a, phi);
    const p = n.at(a, phi, d + rt * 0.9);
    pts.push(p.addScaledVector(new Vector3(Math.sin(a), 0, Math.cos(a)), puffAt('poncho', p.x, p.y)));
    rad.push(rt);
  };
  for (const [a, dp, rt] of line) put(a, dp, rt);
  for (let i = line.length - 2; i >= 0; i--) put(-line[i]![0], line[i]![1], line[i]![2]);
  const m = pts.length - 1;
  // The bag: a soft shell under the roll, pointed at the bottom, with a thick edge.
  const bag = (u: number, v: number, under = 0): Vector3 => {
    const U = u * 2 - 1, a = Math.PI + U * 0.95, yb = 1.15 + 0.16 * Math.abs(U) ** 1.3, y = yb + (1.45 - 0.03 * U * U - yb) * v;
    return s.point(y, a, s.radius(y, a, 0.012, 0.2) + 0.006 + (1 - under * 0.8) * 0.038 * (1 - U * U) * Math.sin(Math.PI * (0.18 + 0.7 * v)));
  };
  k.on('spine_03', () => {
    k.add(tube(pts, 1, 32, 6, (t) => { const q = t * m, i = Math.min(m - 1, Math.floor(q)); return rad[i]! + (rad[i + 1]! - rad[i]!) * (q - i); }), cloth(0x3a6070));
    k.add(grid(8, 4, bag), cloth(0x3a6070)).add(edge(8, 4, bag), cloth(0x24404c));
  });
}

/**
 * Kabelmantel: a high magenta collar, open at the front, with a light rim. Its foot hugs the neckline; it
 * rises to the jaw and flares out just enough to stand clear of the bob and the chin when the head turns.
 */
function collarHigh(k: GearKit): void {
  const A = 0.62, ramp = (a: number): number => Math.min(1, Math.max(0, (Math.abs(angDist(a, 0)) - A) / 1.4));
  const { at } = collarShell(neckOf(k, 'a_mantel'), {
    a0: A, a1: 2 * Math.PI - A, segs: 18, rows: 5, drop: 0.028, lift: 0.008,
    h: (a) => 0.026 + 0.046 * ramp(a) ** 0.8, flare: (a) => 0.02 + 0.03 * ramp(a), hairClear: 0.016,
  });
  k.on('spine_03', () => {
    k.add(grid(18, 5, at), plain(0xbd2b77));
    const rim: Vector3[] = [];
    for (let i = 0; i <= 3; i++) rim.push(at(0, i / 3));
    for (let i = 1; i < 18; i++) rim.push(at(i / 18, 1));
    for (let i = 3; i >= 0; i--) rim.push(at(1, i / 3));
    k.add(tube(rim, 0.0055, 20, 3), plain(0xe0559c));
  });
}

/** Kabelmantel: thick dark cables from under the collar down the chest and the back, magenta glowing plugs at their ends. */
function cables(k: GearKit): void {
  const s = k.sampler(['a_mantel'], AXES.torso), dark = plain(0x2a2230), tip = glow(0xff4fa3);
  const on = (x: number, y: number, back: boolean, lift = 0.014): Vector3 => { const a = angleAt(s, y, x, back); return s.point(y, a, s.radius(y, a, 0.012, 0.2) + lift); };
  // Each run starts tucked under the collar's foot.
  const runs: readonly (readonly [number, number][])[] = [
    [[-0.05, 1.468], [-0.075, 1.42], [-0.11, 1.33], [-0.1, 1.24], [-0.088, 1.15]],
    [[-0.068, 1.462], [-0.11, 1.415], [-0.15, 1.33], [-0.142, 1.26], [-0.125, 1.2]],
    [[0.056, 1.468], [0.085, 1.42], [0.125, 1.33], [0.122, 1.24], [0.11, 1.16]],
  ];
  k.on('spine_03', () => {
    const cable = (pts: Vector3[]): void => {
      k.add(tube(pts, 0.0105, 8, 4), dark);
      const end = pts[pts.length - 1]!, dir = end.clone().sub(pts[pts.length - 2]!).normalize();
      k.add(along(cyl(0.0125, 0.011, 0.026, 6), dir, end.clone().addScaledVector(dir, 0.008)), tip);
    };
    for (const run of runs) cable(run.map(([x, y], i) => on(x, y, false, i ? 0.014 : 0.009)));
    for (const sg of SIDES) cable([on(0.06 * sg, 1.468, true, 0.009), on(0.085 * sg, 1.43, true), on(0.12 * sg, 1.35, true), on(0.125 * sg, 1.28, true), on(0.118 * sg, 1.22, true)]);
  });
}

/** Kabelmantel: dark belt with a row of glowing cyan LEDs all round. */
function beltLed(k: GearKit): void {
  const { at } = belt(k, 'a_mantel', 0x1a1820, 0.05);
  const led = glow(0x43d1cf);
  k.on('pelvis', () => {
    k.frame(at(0), () => buckle(k, 0.06, 0.05, metal(0x2a2a32), plain(0x1a1820)));
    for (const a of [0.36, 0.56, 0.76, 1.1, 1.45, 1.8, 2.15, 2.5, 2.85]) for (const sg of SIDES) k.frame(at(a * sg, 0, 0.0015), () => k.add(new PlaneGeometry(0.014, 0.011), led));
  });
}

export const BODY_GEAR: Readonly<Record<string, GearBuilder>> = {
  'belt-tool': beltTool,
  'kneepads-dark': kneepads(0x3a3530, 0x24201c, 0x1a1714),
  'kneepads-orange': kneepads(0xf08a24, 0x2a2420, 0x141a2a),
  studs,
  'belt-studded': beltStudded,
  'patches-punk': patchesPunk,
  rips,
  'belt-fire': beltFire,
  'collar-fire': collarFire,
  'boards-bvg': boardsBvg,
  'badge-bvg': badgeBvg,
  'belt-bvg': beltBvg,
  bib,
  'patch-gear': patchGear,
  wrench,
  'poncho-bands': ponchoBands,
  'hood-roll': hoodRoll,
  'collar-high': collarHigh,
  cables,
  'belt-led': beltLed,
};
