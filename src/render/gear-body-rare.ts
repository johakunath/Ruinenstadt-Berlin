// Armor gear of the sets and legendaries (WP4 step 2c): Kiezwache, Spreegeist, Zitadelle, Späti, Panzer,
// Rattenmutter, Zitadellenritter. More elaborate and brighter than the normal looks; every set's pieces
// share a motif. Looks: docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19).
// Bones: the outfit's chest follows spine_03 only above the bust; the bust and belly follow spine_02 and
// the waist spine_01 (skin weights of a_mantel and a_weste), so tall torso parts are split by height
// (`TORSO`) into pieces that overlap a little. Belts ride on the pelvis, pauldrons on the upper arms,
// vambraces on the forearms, tassets on the thighs.
import { BufferAttribute, BufferGeometry, PlaneGeometry, Vector3 } from 'three';
import { AXES, Sampler, axis, basis, bright, cloth, glow, metal, onSurface, plain, type Axis, type GearKit, type HeroSource, type Paint } from './gear-kit';
import type { GearBuilder } from './gear';
import { BELT_Y, collarShell, neckBand, neckOf, yoke } from './gear-body';
import { ball, box, cyl, flat, scaled } from './weapons';

const SIDES = [1, -1] as const;
const side = (s: 1 | -1): 'l' | 'r' => (s > 0 ? 'l' : 'r');
/** Round the neck (scarf ring, collars): the torso axis moved back under the neck. */
const NECK: Axis = axis([0, 0, -0.04], [0, 1, 0], [0, 0, 1]);
const Y = BELT_Y.a_mantel;

/** Torso bones by height (from the top), with the overlap of neighbouring pieces. */
export const TORSO = [['spine_03', 1.305, 2], ['spine_02', 1.165, 1.32], ['spine_01', 0, 1.18]] as const;
export const torsoBand = (t: number): number => (t >= 1.312 ? 0 : t >= 1.172 ? 1 : 2);
/** Lower torso pieces sit this much further out, so overlaps never flicker. */
const STEP = 0.0025;

// ---------------------------------------------------------------- fitting helpers

const trunks = new WeakMap<HeroSource, Map<string, Sampler>>();

/** Sampler of `nodes` round `ax` without the sleeves (only |x| < `maxX`): plates, collars and lapels. */
export function trunk(k: GearKit, nodes: readonly string[], ax: Axis = AXES.torso, maxX = 0.19): Sampler {
  let m = trunks.get(k.src);
  if (!m) trunks.set(k.src, (m = new Map()));
  const key = `${nodes.join()}|${ax.o.toArray().join()}|${maxX}`;
  let s = m.get(key);
  if (!s) {
    const meshes = new Map<string, Float32Array>();
    for (const n of nodes) {
      const p = k.src.meshes.get(n);
      if (!p) continue;
      const out: number[] = [];
      for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i]!) < maxX) out.push(p[i]!, p[i + 1]!, p[i + 2]!);
      meshes.set(n, new Float32Array(out));
    }
    m.set(key, (s = new Sampler({ meshes, bones: k.src.bones }, nodes, ax)));
  }
  return s;
}

/** Max-preserving smoothing of a row of radii (fills dips such as the cleavage, keeps the outline). */
function smoothRow(row: number[], passes: number): number[] {
  for (let p = 0; p < passes; p++) row = row.map((x, i) => Math.max(x, (row[Math.max(0, i - 1)]! + 2 * x + row[Math.min(row.length - 1, i + 1)]!) / 4));
  return row;
}

/** A radius field over heights t and angles a. */
export type Field = (t: number, a: number) => number;

/**
 * The surface of `s` over t0..t1 × a0..a1 as a smooth field: smoothed round each row (max-preserving),
 * and draped: going down it never falls in faster than `drape` m per m (a plate or cloth over the bust).
 */
export function field(s: Sampler, t0: number, t1: number, a0: number, a1: number, o: { nt?: number; na?: number; smooth?: number; drape?: number; dt?: number } = {}): Field {
  const nt = o.nt ?? 12, na = o.na ?? 16;
  const g: number[][] = [];
  for (let i = 0; i <= nt; i++) {
    const t = t0 + ((t1 - t0) * i) / nt;
    const row: number[] = [];
    for (let j = 0; j <= na; j++) row.push(s.radius(t, a0 + ((a1 - a0) * j) / na, o.dt ?? 0.012));
    const any = row.find((x) => x > 0) ?? 0.05;
    g.push(smoothRow(row.map((x) => x || any), o.smooth ?? 3));
  }
  if (o.drape) for (let i = nt - 1; i >= 0; i--) for (let j = 0; j <= na; j++) g[i]![j] = Math.max(g[i]![j]!, g[i + 1]![j]! - (o.drape * (t1 - t0)) / nt);
  return (t, a) => {
    const fi = Math.min(nt, Math.max(0, ((t - t0) / (t1 - t0)) * nt)), fj = Math.min(na, Math.max(0, ((a - a0) / (a1 - a0)) * na));
    const i = Math.min(nt - 1, Math.floor(fi)), j = Math.min(na - 1, Math.floor(fj)), x = fi - i, y = fj - j;
    return (g[i]![j]! * (1 - y) + g[i]![j + 1]! * y) * (1 - x) + (g[i + 1]![j]! * (1 - y) + g[i + 1]![j + 1]! * y) * x;
  };
}

function grid(pts: number[], uv: number[], segs: number, rows: number): BufferGeometry {
  const idx: number[] = [], w = segs + 1;
  for (let r = 0; r < rows; r++) for (let j = 0; j < segs; j++) { const a = r * w + j, b = a + 1, c = a + w, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A grid of `segs` × `rows` quads through the bind points `at(u, v)`, UVs (u, v). */
function sheet(at: (u: number, v: number) => Vector3, segs: number, rows: number): BufferGeometry {
  const pts: number[] = [], uv: number[] = [];
  for (let r = 0; r <= rows; r++) for (let j = 0; j <= segs; j++) { pts.push(...at(j / segs, r / rows).toArray()); uv.push(j / segs, r / rows); }
  return grid(pts, uv, segs, rows);
}

type Lift = number | ((u: number, v: number) => number);
const liftOf = (l: Lift) => (typeof l === 'function' ? l : (): number => l);

/**
 * A fitted patch: the grid (u, v) ∈ [0, 1]² maps to height t and angle a (`at`), so plates can taper,
 * point and curve; radius = the field `R` + `lift`. v 0 is the bottom row. UVs = (u, v).
 */
function patch(s: Sampler, R: Field, at: (u: number, v: number) => readonly [number, number], segs: number, rows: number, lift: Lift): BufferGeometry {
  const off = liftOf(lift), pts: number[] = [], uv: number[] = [], p = new Vector3();
  for (let r = 0; r <= rows; r++) for (let j = 0; j <= segs; j++) {
    const u = j / segs, v = r / rows, [t, a] = at(u, v);
    s.point(t, a, R(t, a) + off(u, v), p);
    pts.push(p.x, p.y, p.z);
    uv.push(u, v);
  }
  return grid(pts, uv, segs, rows);
}

/** A band `w` wide along the path `pts` ([t, a] pairs) on the field `R`, `lift` out of it: seams, trims, cords. */
function strip(s: Sampler, R: Field, pts: ReadonlyArray<readonly [number, number]>, w: number, lift: number | Field): BufferGeometry {
  const L = typeof lift === 'number' ? (): number => lift : lift;
  const c = pts.map(([t, a]) => s.point(t, a, R(t, a) + L(t, a)));
  const out: number[] = [], uv: number[] = [], sd = new Vector3(), tg = new Vector3();
  c.forEach((p, i) => {
    tg.subVectors(c[Math.min(c.length - 1, i + 1)]!, c[Math.max(0, i - 1)]!);
    sd.crossVectors(tg, s.out(pts[i]![1])).normalize().multiplyScalar(w / 2);
    out.push(p.x - sd.x, p.y - sd.y, p.z - sd.z, p.x + sd.x, p.y + sd.y, p.z + sd.z);
    uv.push(0, i / (c.length - 1), 1, i / (c.length - 1));
  });
  return grid(out, uv, 1, c.length - 1);
}

/** `n` + 1 points of the line from (t0, a0) to (t1, a1). */
const line = (t0: number, a0: number, t1: number, a1: number, n: number): Array<[number, number]> =>
  Array.from({ length: n + 1 }, (_, i) => [t0 + ((t1 - t0) * i) / n, a0 + ((a1 - a0) * i) / n]);

/** A torso strip cut into pieces on the bones of its heights (each piece reaches one point into the next). */
function torsoStrip(k: GearKit, s: Sampler, R: Field, pts: ReadonlyArray<readonly [number, number]>, w: number, lift: number, paint: Paint): void {
  let start = 0;
  for (let i = 1; i <= pts.length; i++) {
    const b = torsoBand(pts[start]![0]);
    if (i < pts.length && torsoBand(pts[i]![0]) === b) continue;
    const seg = pts.slice(start, Math.min(pts.length, i + 1));
    if (seg.length > 1) k.on(TORSO[b]![0], () => k.add(strip(s, R, seg, w, lift + STEP * b), paint));
    start = i;
  }
}

/** Outline of a torso plate or panel: bottom and top height per u, angle per (u, t). */
interface Shape { t0: (u: number) => number; t1: (u: number) => number; a: (u: number, t: number) => number }
const shapeAt = (P: Shape) => (u: number, v: number): [number, number] => { const t = P.t0(u) + (P.t1(u) - P.t0(u)) * v; return [t, P.a(u, t)]; };
const vOf = (P: Shape, u: number, t: number): number => Math.min(1, Math.max(0, (t - P.t0(u)) / (P.t1(u) - P.t0(u))));

/** A torso patch in pieces, one per bone band it crosses (`TORSO`); `lift` takes the shape's own (u, v). */
function torsoPatch(k: GearKit, s: Sampler, R: Field, P: Shape, segs: number, lift: (u: number, v: number) => number, paint: Paint, rowsPerM = 24): void {
  let lo = 9, hi = 0;
  for (let j = 0; j <= 8; j++) { lo = Math.min(lo, P.t0(j / 8)); hi = Math.max(hi, P.t1(j / 8)); }
  TORSO.forEach(([bone, ta, tb], b) => {
    const a = Math.max(ta, lo), c = Math.min(tb, hi);
    if (c - a < 0.008) return;
    const t = (u: number, w: number): number => Math.min(P.t1(u), Math.max(P.t0(u), a + (c - a) * w));
    k.on(bone, () => k.add(patch(s, R, (u, w) => [t(u, w), P.a(u, t(u, w))], segs, Math.max(1, Math.round((c - a) * rowsPerM)), (u, w) => lift(u, vOf(P, u, t(u, w))) + STEP * b), paint));
  });
}

/** Plate lift: `lo` at the edges, `hi` in the middle, so a plate curls back to the body (reads thick, hides the gap). */
const domed = (lo: number, hi: number, k = 2.2) => (u: number, v: number): number => lo + (hi - lo) * Math.min(1, k * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)) ** 0.7;

/** Frame on the field `R` at (t, a), `lift` out: +Z out of the body, +Y up the axis. */
const at = (s: Sampler, R: Field, t: number, a: number, lift: number) => onSurface(s, t, a, lift, R(t, a));

/** Parts in `fn` placed at (t, a) on the torso field, on the bone of that height. */
function onTorso(k: GearKit, s: Sampler, R: Field, t: number, a: number, lift: number, fn: () => void): void {
  const b = torsoBand(t);
  k.on(TORSO[b]![0], () => k.frame(at(s, R, t, a, lift + STEP * b), fn));
}

/** Small rivet (8 triangles), facing +Z. */
const rivet = (r = 0.006): BufferGeometry => scaled(ball(1, 4, 2), r, r, r * 0.6);

/** A quad facing +Z (glow letters). */
const quad = (w: number, h: number): BufferGeometry => new PlaneGeometry(w, h);

/** A tube through `pts` (bind space), radius `r(i)`, `sides` round, open ends: tails, cords. */
function tube(pts: readonly Vector3[], r: (i: number) => number, sides = 4): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], t = new Vector3(), n = new Vector3(0, 0, 1), b = new Vector3();
  pts.forEach((p, i) => {
    t.subVectors(pts[Math.min(pts.length - 1, i + 1)]!, pts[Math.max(0, i - 1)]!).normalize();
    n.addScaledVector(t, -n.dot(t)).normalize();
    b.crossVectors(t, n);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2, c = Math.cos(a) * r(i), d = Math.sin(a) * r(i);
      pos.push(p.x + n.x * c + b.x * d, p.y + n.y * c + b.y * d, p.z + n.z * c + b.z * d);
      uv.push(j / sides, i / (pts.length - 1));
    }
  });
  return grid(pos, uv, sides, pts.length - 1);
}

/** A belt band round the coat or vest at its belt height, `h` tall, `lift` out; returns the outfit sampler and the band's outer field. */
function band(k: GearKit, outfit: 'a_mantel' | 'a_weste', paint: Paint, h: number, lift: number, segs = 32): { s: Sampler; R: Field } {
  const s = k.sampler([outfit], AXES.torso), y = BELT_Y[outfit];
  // Median over ±0.3 rad first: the band runs over the outfit's own pouches and buckle, not round them.
  const R = field(s, y - h / 2, y + h / 2, -Math.PI - 0.4, Math.PI + 0.4, { nt: 2, na: segs + 8, smooth: 0 });
  const med = (t: number, a: number): number => [-0.3, -0.15, 0, 0.15, 0.3].map((d) => R(t, a + d)).sort((p, q) => p - q)[2]!;
  k.on('pelvis', () => k.add(patch(s, med, (u, v) => [y - h / 2 + h * v, -Math.PI + 2 * Math.PI * u], segs, 1, lift), paint));
  return { s, R: (t, a) => med(t, a) + lift };
}

/** Rectangular buckle facing +Z: frame `col`, the belt colour inside, a prong. */
function buckle(k: GearKit, w: number, h: number, col: Paint, belt: Paint): void {
  k.add(box(w, h, 0.008), col).add(box(w * 0.62, h * 0.56, 0.01), belt, 0, 0, 0.001).add(box(w * 0.12, h * 0.62, 0.012), col, 0, 0, 0.002);
}

/** Pauldron of three lames down the upper arm (the top one outermost), `rivets` on each lower edge. */
function pauldron(k: GearKit, s: 1 | -1, plate: Paint, riv: Paint, o: { puff: number; r0: number; rivets: readonly number[] }): void {
  const arm = k.arm(s, ['a_mantel']);
  const top = -s * (Math.PI / 2), span = 1.75;
  const R = field(arm, 0.1, 0.32, top - span, top + span, { nt: 8, na: 12, smooth: 3, dt: 0.02 });
  // The sleeve is round under the pauldron: never below the top's radius (the measured sides dip at the armpit).
  const Rr: Field = (t, a) => Math.max(R(t, a), R(t, top) * 0.96);
  k.on(`upperarm_${side(s)}`, () => {
    for (let i = 2; i >= 0; i--) {
      const t0 = 0.11 + 0.05 * i, t1 = t0 + 0.08, sp = span - 0.12 * i;
      const lift = (u: number, v: number): number => o.puff + o.r0 - 0.007 * i - 0.014 * (1 - v) ** 3 * (i === 0 ? 1.4 : 1) - 0.01 * (1 - Math.sin(Math.PI * u)) ** 2;
      const atl = (u: number, v: number): readonly [number, number] => [t0 + (t1 - t0) * v, top + sp * (2 * u - 1)];
      k.add(patch(arm, Rr, atl, 8, 2, lift), plate);
      for (const u of o.rivets) {
        const [t, a] = atl(u, 0.8);
        k.frame(onSurface(arm, t, a, lift(u, 0.8) + 0.002, Rr(t, a)), () => k.add(rivet(0.0055), riv));
      }
    }
  });
}

// ---------------------------------------------------------------- Weste der Kiezwache

const KIEZ = { collar: 0x24508e, orange: 0xf08a24, belt: 0x141a2a, dark: 0x2a2c30, cream: 0xf4f0e0 } as const;

/** Stand collar: an upright padded band round the neck (open at the front, 1.8 cm clear of it), orange piping on its top edge. */
function collarStand(k: GearKit): void {
  const A = 0.45, segs = 16, rows = 3;
  const { at } = collarShell(neckOf(k, 'a_weste'), { a0: A, a1: 2 * Math.PI - A, segs, rows, drop: 0.02, lift: 0.008, h: byAngle([[0, 0.018], [1.2, 0.026], [Math.PI, 0.03]]), flare: () => 0.01 });
  k.on('spine_03', () => {
    k.add(sheet((u, v) => at(u, v, 0.004 * Math.sin(Math.PI * v)), segs, rows), plain(KIEZ.collar));
    k.add(sheet((u, v) => at(u, 0.8 + 0.2 * v, 0.003), segs, 1), plain(KIEZ.orange));
  });
}

/** Radio clipped on the chest strap (the hero's right), antenna up, a red glow dot. */
function radio(k: GearKit): void {
  const s = trunk(k, ['a_weste']);
  const t = 1.335, a = -0.3;
  const R = field(s, t - 0.04, t + 0.04, a - 0.2, a + 0.2, { nt: 4, na: 4 });
  k.on('spine_03', () => k.frame(onSurface(s, t, a, 0.016, Math.max(R(t - 0.035, a), R(t, a), R(t + 0.035, a))), () => {
    k.add(box(0.044, 0.072, 0.024), plain(KIEZ.dark));
    // Speaker grille, push button, clip in the strap colour.
    for (const y of [-0.012, -0.002, 0.008]) k.add(box(0.03, 0.004, 0.003), plain(0x4a4e56), 0, y, 0.013);
    k.add(box(0.008, 0.016, 0.008), plain(KIEZ.orange), -0.025, 0.008, 0);
    k.add(box(0.032, 0.014, 0.004), plain(KIEZ.orange), 0, -0.022, -0.013);
    // Antenna on the outer top corner, knob, red dot.
    k.add(cyl(0.004, 0.005, 0.075, 5), plain(KIEZ.dark), -0.014, 0.073, 0);
    k.add(cyl(0.006, 0.006, 0.012, 6), plain(0x1a1c20), 0.012, 0.042, 0);
    k.add(box(0.011, 0.011, 0.004), glow(0xff3a2a), 0.012, 0.024, 0.013);
  }));
}

/** Whistle on an orange cord from under the stand collar's left end down to the left chest. */
function whistle(k: GearKit): void {
  const s = trunk(k, ['a_weste']);
  const R = field(s, 1.2, 1.48, -0.2, 0.95, { nt: 10, na: 9, drape: 0.6 });
  const path: Array<[number, number]> = [];
  for (let i = 0; i <= 8; i++) { const v = i / 8; path.push([1.462 - 0.187 * v, 0.8 - 0.55 * v + 0.13 * v * v]); }
  const [t, a] = path[path.length - 1]!;
  torsoStrip(k, s, R, path, 0.008, 0.007, plain(KIEZ.orange));
  onTorso(k, s, R, t - 0.016, a, 0.017, () => {
    k.add(cyl(0.011, 0.011, 0.04, 7), bright(0xd8dce0), 0, 0, 0, 0, 0, Math.PI / 2 - 0.35);
    k.add(box(0.016, 0.013, 0.012), bright(0xd8dce0), 0.02, 0.01, 0, 0, 0, -0.35);
    k.add(ball(0.008, 5, 3), plain(KIEZ.orange), -0.016, 0.009, 0);
  });
}

/** Orange armband round the left upper arm with a reflective cream stripe. */
function armband(k: GearKit): void {
  const s = k.arm(1, ['body_arms']);
  const R = field(s, 0.22, 0.3, -Math.PI, Math.PI, { nt: 3, na: 12, smooth: 2 });
  k.on('upperarm_l', () => {
    k.add(patch(s, R, (u, v) => [0.23 + 0.055 * v, -Math.PI + 2 * Math.PI * u], 12, 1, 0.007), plain(KIEZ.orange));
    k.add(patch(s, R, (u, v) => [0.252 + 0.011 * v, -Math.PI + 2 * Math.PI * u], 12, 1, 0.01), plain(KIEZ.cream));
  });
}

/** Duty belt on the vest: orange buckle, flashlight with a glowing lens on the right hip, radio pouch on the left. */
function beltDuty(k: GearKit): void {
  const belt = plain(KIEZ.belt);
  const { s, R } = band(k, 'a_weste', belt, 0.05, 0.011);
  const y = BELT_Y.a_weste;
  k.on('pelvis', () => {
    k.frame(at(s, R, y, 0, 0.006), () => buckle(k, 0.056, 0.05, metal(KIEZ.orange), belt));
    // Flashlight in a holster loop, lens down.
    k.frame(at(s, R, y - 0.05, -0.95, 0.02), () => {
      k.add(cyl(0.013, 0.013, 0.1, 7), metal(0x34363a), 0, 0.005, 0);
      k.add(cyl(0.018, 0.015, 0.03, 8), metal(0x34363a), 0, -0.058, 0);
      k.add(cyl(0.015, 0.015, 0.004, 8), glow(0xf4f0c8), 0, -0.074, 0);
      k.add(box(0.032, 0.014, 0.03), belt, 0, 0.05, -0.004);
    });
    // Radio pouch with its antenna up past the belt.
    k.frame(at(s, R, y - 0.03, 0.85, 0.022), () => {
      k.add(box(0.06, 0.08, 0.034), plain(0x232c42)).add(box(0.064, 0.022, 0.036), belt, 0, 0.03, 0.001);
      k.add(box(0.03, 0.006, 0.002), plain(KIEZ.orange), 0, -0.01, 0.018);
      k.add(cyl(0.004, 0.005, 0.07, 5), plain(KIEZ.dark), 0.018, 0.07, -0.004);
    });
  });
}

// ---------------------------------------------------------------- Mantel des Spreegeists

// Glow inputs are deeper than the mockup's colours: the glow material emits 2.2 × the colour, so these read as #7fe0c8 and #ff6ad0.
const SPREE = { reed: [0x5a9a5a, 0x7ab870, 0x447a46], base: 0x0e4a40, glow: 0x3cbc9e, sash: 0x2aa890, pearl: 0xe8f4ee } as const;

/** A reed blade in the XY plane: `w` wide at the root, `h` tall, folded along its middle, curling out (+Z) and to the side. */
function blade(w: number, h: number, curl: number, lean: number): BufferGeometry {
  const z = (y: number): number => curl * (y / h) ** 2 * h;
  const pts = [-w / 2, 0, 0, 0, 0, 0.005, w / 2, 0, 0, -w * 0.32 + lean * 0.5, h * 0.55, z(h * 0.55), lean * 0.5, h * 0.55, z(h * 0.55) + 0.004, w * 0.32 + lean * 0.5, h * 0.55, z(h * 0.55), lean, h, z(h)];
  const uv = [0, 0, 0.5, 0, 1, 0, 0.18, 0.55, 0.5, 0.55, 0.82, 0.55, 0.5, 1];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 3, 4, 6, 4, 5, 6]);
  g.computeVertexNormals();
  return g;
}

/**
 * Reed collar: a dark green yoke from a ring round the neck down over the shoulders (a narrow band at the
 * front), two rows of reed blades along its outer edge. The blades lean out, most at the back, where the bob
 * swings over the collar when the head is carried back (idle, running).
 */
function collarReed(k: GearKit): void {
  const segs = 16;
  const { geo, at: on } = yoke(neckOf(k, 'a_mantel'), {
    a0: -Math.PI, a1: Math.PI, segs, rows: 2, lift0: 0.008, lift1: 0.007,
    phi0: byAngle([[0, 0.62], [0.7, 0.5], [1.2, 0.36], [1.8, 0.44], [2.5, 0.3], [Math.PI, 0.26]]), top: byAngle([[0, 0.012], [Math.PI, 0.014]]),
  });
  const lean = byAngle([[0.8, 0.2], [1.6, 0.28], [2.4, 0.58], [Math.PI, 0.72]]), tall = byAngle([[0.8, 0.095], [1.5, 0.13], [2.3, 0.1], [Math.PI, 0.075]]);
  const a0 = 0.8, a1 = 2 * Math.PI - 0.8, up = new Vector3(0, 1, 0);
  k.on('spine_03', () => {
    k.add(geo, plain(SPREE.base));
    for (let row = 0; row < 2; row++) {
      const n = row ? 9 : 10;
      for (let i = 0; i < n; i++) {
        const u = (i + (row ? 1 : 0.5)) / (n + (row ? 1 : 0)), a = a0 + (a1 - a0) * u;
        // The outer row taller; a little height noise.
        const h = (tall(a) + 0.014 * (((i * 5 + row * 2) % 3) - 1)) * (row ? 0.75 : 1);
        const fan = (u - 0.5) * 0.5;
        const out = new Vector3(Math.sin(a), 0, Math.cos(a)), side = new Vector3().crossVectors(up, out);
        k.frame(basis(on((Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI) / (2 * Math.PI), 0.22 + 0.2 * row, 0.003), side, up, out), () => {
          k.add(blade(0.034 - 0.004 * row, h, 0.2 + 0.1 * row, ((i % 2) * 2 - 1) * 0.012), plain(SPREE.reed[(i + row) % 3]!), 0, 0, 0, lean(a) - 0.12 * row, fan, -fan * 0.5);
        });
      }
    }
  });
}

/** Glowing seams down the coat front: the middle line and two lines over the chest, collar to belt. */
function seamsSpree(k: GearKit): void {
  const s = trunk(k, ['a_mantel']);
  const R = field(s, 1.1, 1.46, -1.2, 1.2, { nt: 11, na: 16, smooth: 2, drape: 0.5 });
  const g0 = glow(SPREE.glow);
  torsoStrip(k, s, R, line(1.43, 0, 1.11, 0, 10), 0.007, 0.006, g0);
  for (const g of SIDES) {
    const path: Array<[number, number]> = [];
    for (let i = 0; i <= 10; i++) { const v = i / 10; path.push([1.41 - 0.3 * v, g * (0.98 - 0.58 * v + 0.2 * v * v)]); }
    torsoStrip(k, s, R, path, 0.006, 0.006, g0);
  }
}

/** Teal cloth sash over the belt, knotted on the left with two hanging ends, pale pebbles and a glow line. */
function beltSash(k: GearKit): void {
  const { s, R } = band(k, 'a_mantel', cloth(SPREE.sash), 0.068, 0.012);
  const skirt = trunk(k, ['a_mantel'], AXES.torso, 0.3);
  const S = field(skirt, 0.88, 1.07, 0.9, 1.9, { nt: 6, na: 8, smooth: 2 });
  const ka = 1.3;
  k.on('pelvis', () => {
    // Glow line along the lower edge of the front.
    k.add(patch(s, (t, a) => R(t, a) - 0.012, (u, v) => [Y - 0.03 + 0.005 * v, -1.2 + 2.4 * u], 14, 1, 0.014), glow(SPREE.glow));
    for (const a of [-0.85, -0.5, -0.18, 0.18, 0.5, 0.85]) k.frame(at(s, R, Y + 0.004, a, 0.008), () => k.add(scaled(ball(1, 6, 3), 0.017, 0.014, 0.011), bright(SPREE.pearl)));
    // Knot and two ends hanging down the hip, clear of the skirt.
    k.frame(at(s, R, Y, ka, 0.012), () => k.add(scaled(ball(1, 7, 4), 0.032, 0.036, 0.022), cloth(0x249880)));
    for (const [d, len, w, col] of [[-0.09, 0.17, 0.034, SPREE.sash], [0.1, 0.14, 0.03, 0x1f8a74]] as const) {
      k.add(patch(skirt, S, (u, v) => [Y - 0.02 - len * (1 - v), ka + d + (u - 0.5) * (w / 0.2) * (1 + 0.35 * (1 - v))], 1, 3, (_u, v) => 0.03 + 0.016 * (1 - v)), cloth(col));
    }
  });
}

// ---------------------------------------------------------------- Kettenhemd der Zitadelle

const ZIT = { red: 0xa82828, gold: 0xe0b040, leather: 0x5a2a1a } as const;

/** Crimson tabard: a front panel over the chest down to the belt and a short pointed apron, gold trim and a gold shield. */
function tabard(k: GearKit): void {
  const s = trunk(k, ['a_mantel']);
  const R = field(s, 1.09, 1.47, -1.0, 1.0, { nt: 13, na: 12, smooth: 4, drape: 0.35 });
  // Up to just under the mail's neck band (the scarf no longer covers the top); wider round the neck there.
  const ha = (t: number): number => 0.46 + 0.04 * (1.4 - t) / 0.3 + 6 * Math.max(0, t - 1.385);
  const P: Shape = { t0: () => 1.1, t1: (u) => 1.455 - 0.016 * (1 - Math.abs(2 * u - 1)), a: (u, t) => (2 * u - 1) * ha(t) };
  // The apron below the belt, on the pelvis: hangs out of the skirt's way.
  const sk = trunk(k, ['a_mantel'], AXES.torso, 0.3);
  const A = field(sk, 0.85, 1.07, -0.8, 0.8, { nt: 8, na: 10, smooth: 4, drape: 0.6 });
  const aha = (v: number): number => 0.5 + 0.06 * (1 - v);
  const apron = (u: number, v: number): [number, number] => [1.06 - (0.15 + 0.045 * (1 - Math.abs(2 * u - 1))) * (1 - v), (2 * u - 1) * aha(v)];
  const gold = bright(ZIT.gold), red = cloth(ZIT.red);
  torsoPatch(k, s, R, P, 10, () => 0.008, red);
  const ch = shapeAt(P);
  for (const u of [0.015, 0.985]) torsoStrip(k, s, R, Array.from({ length: 9 }, (_, i) => ch(u, i / 8)), 0.012, 0.011, gold);
  torsoStrip(k, s, R, Array.from({ length: 9 }, (_, i) => ch(0.015 + (0.97 * i) / 8, 0.985)), 0.012, 0.011, gold);
  neckBand(k, 'a_mantel', plain(ZIT.leather), 0.012);
  // Gold shield with a crimson field, on the bust.
  onTorso(k, s, R, 1.255, 0, 0.012, () => {
    k.add(flat([[-0.042, 0.055], [0.042, 0.055], [0.042, -0.01], [0, -0.062], [-0.042, -0.01]], 0.004), gold);
    k.add(flat([[-0.028, 0.04], [0.028, 0.04], [0.028, -0.006], [0, -0.042], [-0.028, -0.006]], 0.004), plain(0x8a1c1c), 0, 0, 0.003);
  });
  k.on('pelvis', () => {
    k.add(patch(sk, A, apron, 8, 3, (_u, v) => 0.024 + 0.006 * (1 - v)), red);
    const edge = (u: number): Array<[number, number]> => Array.from({ length: 5 }, (_, i) => apron(u, 1 - i / 4));
    for (const u of [0.02, 0.98]) k.add(strip(sk, A, edge(u), 0.012, 0.028), gold);
    k.add(strip(sk, A, Array.from({ length: 7 }, (_, i) => apron(0.02 + (0.96 * i) / 6, 0.02)), 0.012, 0.03), gold);
  });
}

/** Knight's belt: a wide leather band, gold buckle and a hanging strap end with a gold tip (`len` m). */
function beltKnight(k: GearKit, col: number, len: number, lift: number): void {
  const belt = plain(col), gold = bright(ZIT.gold);
  const { s, R } = band(k, 'a_mantel', belt, 0.06, lift);
  k.on('pelvis', () => k.frame(at(s, R, Y, 0, 0.004), () => {
    buckle(k, 0.062, 0.07, gold, belt);
    k.add(box(0.024, len, 0.005), belt, 0.022, -0.03 - len / 2, 0.012, 0, 0, 0.06);
    k.add(box(0.026, 0.018, 0.007), gold, 0.022 + Math.sin(0.06) * len, -0.03 - len, 0.013, 0, 0, 0.06);
  }));
}

// ---------------------------------------------------------------- Mantel des letzten Späti

const SPAETI = { pink: 0xe0409e, plate: 0x1a1420, gold: 0xf2d14b, belt: 0x2a1a1a } as const;
const CAPS = [0xc8302a, 0xe8c838, 0x3a7ac0, 0xd8d8d0, 0x2f8a4a, 0xe07020] as const;

/** A crown cap facing +Z: a crimped rim (every other edge vertex out) and a flat top. */
function cap(r = 0.0135, segs = 10): BufferGeometry {
  const g = cyl(r, r, 0.005, segs), p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (Math.hypot(x, z) < r * 0.9) continue;
    if (Math.round(Math.atan2(z, x) / ((2 * Math.PI) / segs)) % 2) { p.setX(i, x * 1.16); p.setZ(i, z * 1.16); }
  }
  return g.rotateX(Math.PI / 2);
}

/** Bottle caps sewn on the chest in a loose cluster. */
function capsChest(k: GearKit): void {
  const s = trunk(k, ['a_mantel']);
  const R = field(s, 1.15, 1.36, -0.8, 0.8, { nt: 8, na: 12, smooth: 2 });
  // (x, y) on the chest (m): the mockup's six and three more.
  const pos: Array<[number, number]> = [[-0.055, 1.31], [-0.018, 1.273], [-0.045, 1.232], [0.036, 1.297], [0.062, 1.245], [0.022, 1.205], [0.004, 1.325], [-0.082, 1.27], [0.07, 1.31]];
  pos.forEach(([x, t], i) => onTorso(k, s, R, t, Math.asin(x / 0.17), 0.007, () => k.add(cap(), bright(CAPS[i % CAPS.length]!), 0, 0, 0, 0, 0, i * 0.7)));
}

/** 3 × 5 pixel letters (rows top to bottom) and the umlaut dots. */
const FONT: Readonly<Record<string, readonly string[]>> = {
  S: ['###', '#..', '###', '..#', '###'], P: ['###', '#.#', '###', '#..', '#..'], A: ['.#.', '#.#', '###', '#.#', '#.#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'], I: ['#', '#', '#', '#', '#'], ':': ['#.#'],
};

/** Neon sign "SPÄTI" on a dark plate on the lower right chest: glowing pink pixel letters (one quad per run) and frame. */
function signSpaeti(k: GearKit): void {
  const s = trunk(k, ['a_mantel']);
  const t = 1.185, a = -0.4;
  const R = field(s, t - 0.03, t + 0.03, a - 0.4, a + 0.4, { nt: 3, na: 8, smooth: 1 });
  let rmax = 0;
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 8; j++) rmax = Math.max(rmax, R(t - 0.03 + 0.02 * i, a - 0.4 + 0.1 * j));
  const px = 0.0046, pink = glow(SPAETI.pink);
  const word = ['S', 'P', 'A', 'T', 'I'];
  const widths = word.map((c) => FONT[c]![0]!.length);
  const total = widths.reduce((p, w) => p + w, 0) + word.length - 1;
  k.on('spine_02', () => k.frame(onSurface(s, t, a, 0.008, rmax), () => {
    const W = (total + 3) * px, H = 9 * px;
    k.add(box(W, H, 0.006), plain(SPAETI.plate));
    for (const [w, h, x, y] of [[W, px * 0.5, 0, H / 2 - px * 0.5], [W, px * 0.5, 0, -H / 2 + px * 0.5], [px * 0.5, H, W / 2 - px * 0.5, 0], [px * 0.5, H, -W / 2 + px * 0.5, 0]] as const) k.add(quad(w, h), pink, x, y, 0.0032);
    let cx = -total / 2;
    word.forEach((c, n) => {
      const rows = c === 'A' ? [...FONT[':']!, '...', ...FONT.A!] : FONT[c]!;
      const off = c === 'A' ? 0 : 2;
      rows.forEach((row, ry) => {
        for (let j = 0; j < row.length;) {
          if (row[j] !== '#') { j++; continue; }
          let e = j;
          while (row[e + 1] === '#') e++;
          k.add(quad((e - j + 1) * px * 0.92, px * 0.92), pink, (cx + (j + e + 1) / 2) * px, (3.5 - (ry + off)) * px, 0.0034);
          j = e + 1;
        }
      });
      cx += widths[n]! + 1;
    });
  }));
}

/** Belt with bottle caps as studs, a gold buckle and a bottle opener on a short chain on the left hip. */
function beltCaps(k: GearKit): void {
  const belt = plain(SPAETI.belt);
  const { s, R } = band(k, 'a_mantel', belt, 0.056, 0.01);
  k.on('pelvis', () => {
    k.frame(at(s, R, Y, 0, 0.004), () => buckle(k, 0.056, 0.052, bright(SPAETI.gold), belt));
    [-1.1, -0.7, -0.38, 0.38, 0.7].forEach((a, i) => k.frame(at(s, R, Y, a, 0.003), () => k.add(cap(0.011, 8), bright(CAPS[(i + 2) % CAPS.length]!), 0, 0, 0, 0, 0, i)));
    k.frame(at(s, R, Y - 0.02, 1.05, 0.012), () => {
      k.add(cyl(0.0025, 0.0025, 0.05, 4, true), metal(0x9a9ca0), 0, -0.025, 0.004);
      k.add(flat([[-0.011, 0], [0.011, 0], [0.012, -0.05], [0, -0.056], [-0.012, -0.05]], 0.004, [[0, -0.016, 0.006]]), bright(0xb8bcc0), 0, -0.05, 0.006);
    });
  });
}

// ---------------------------------------------------------------- plates (Panzer, Zitadellenritter)

const FRONT: Shape = {
  t0: (u) => 1.1 + 0.065 * Math.abs(2 * u - 1) ** 1.3, t1: (u) => 1.37 + 0.02 * Math.abs(2 * u - 1),
  a: (u, t) => (2 * u - 1) * (0.6 + 0.3 * Math.sin(Math.min(1, (t - 1.1) / 0.24) * Math.PI / 2)),
};
const BACK: Shape = { t0: () => 1.13, t1: (u) => 1.38 - 0.015 * Math.abs(2 * u - 1), a: (u, t) => Math.PI + (2 * u - 1) * (0.75 + 0.12 * (t - 1.13) / 0.25) };
const FRONT_LIFT = domed(0.006, 0.018), BACK_LIFT = domed(0.006, 0.014);

/** Breast and back plate in torso pieces (the fields drape over the bust), `rivets` per side edge; returns the front field. */
function plates(k: GearKit, paint: Paint, riv: Paint, rivets: number): { s: Sampler; F: Field } {
  const s = trunk(k, ['a_mantel']);
  const F = field(s, 1.07, 1.4, -1.05, 1.05, { nt: 12, na: 14, smooth: 4, drape: 0.45 });
  const B = field(s, 1.12, 1.4, Math.PI - 1, Math.PI + 1, { nt: 8, na: 10, smooth: 4, drape: 0.3 });
  torsoPatch(k, s, F, FRONT, 10, FRONT_LIFT, paint);
  torsoPatch(k, s, B, BACK, 8, BACK_LIFT, paint, 16);
  const fa = shapeAt(FRONT), ba = shapeAt(BACK);
  for (let i = 0; i < rivets; i++) {
    const v = 0.12 + (0.78 * i) / (rivets - 1);
    for (const u of [0.05, 0.95]) {
      const [t, a] = fa(u, v);
      onTorso(k, s, F, t, a, FRONT_LIFT(u, v) + 0.002, () => k.add(rivet(), riv));
      const [tb, ab] = ba(u, v);
      if (i % 2 === 0) onTorso(k, s, B, tb, ab, BACK_LIFT(u, v) + 0.002, () => k.add(rivet(), riv));
    }
  }
  return { s, F };
}

// ---------------------------------------------------------------- Panzer vom Tempelhofer Feld

const PANZER = { alu: 0xa8b0b8, rivet: 0xe8ecf0, stripe: 0xe8c020, black: 0x1a1a1a, boss: 0xc8ccd0 } as const;

/** Panzer plates: aircraft aluminium, rivet rows, a yellow-black warning stripe and a propeller hub on the chest. */
function platePanzer(k: GearKit): void {
  const { s, F } = plates(k, bright(PANZER.alu), bright(PANZER.rivet), 5);
  // Warning stripe on the bust piece: yellow band and black slanted bars, on the plate's lift.
  const tb = 1.205, th = 0.03, ha = FRONT.a(1, tb + th / 2) * 0.95;
  const L = (u: number): number => FRONT_LIFT(0.5 + (u - 0.5) * 0.95, vOf(FRONT, 0.5, tb + th / 2)) + STEP + 0.003;
  k.on('spine_02', () => {
    k.add(patch(s, F, (u, v) => [tb + th * v, (2 * u - 1) * ha], 12, 1, (u) => L(u)), plain(PANZER.stripe));
    for (let i = 0; i < 7; i++) {
      const u0 = 0.08 + i * 0.135;
      k.add(patch(s, F, (u, v) => [tb + th * v, (2 * (u0 + 0.05 * u + 0.04 * (1 - v)) - 1) * ha], 1, 1, (u) => L(u0 + 0.05 * u) + 0.0015), plain(PANZER.black));
    }
  });
  // Propeller hub: a domed spinner on a ring with three blade roots.
  const [t, a] = shapeAt(FRONT)(0.5, 0.72);
  onTorso(k, s, F, t, a, FRONT_LIFT(0.5, 0.72), () => {
    k.add(cyl(0.034, 0.038, 0.012, 10), bright(PANZER.boss), 0, 0, 0.004, Math.PI / 2);
    k.add(scaled(ball(1, 8, 3), 0.024, 0.024, 0.022), bright(0xdfe3e8), 0, 0, 0.01);
    for (let i = 0; i < 3; i++) { const b = (i * 2 * Math.PI) / 3; k.add(box(0.012, 0.03, 0.006), bright(0x8a9098), -Math.sin(b) * 0.036, Math.cos(b) * 0.036, 0.008, 0, 0, b); }
  });
}

/** Panzer pauldrons: three aluminium lames per shoulder with rivets. */
function pauldronsPanzer(k: GearKit): void {
  for (const g of SIDES) pauldron(k, g, bright(PANZER.alu), bright(PANZER.rivet), { puff: 0.006, r0: 0.026, rivets: [0.25, 0.75] });
}

/** Plain belt with a steel buckle. */
function beltPlain(k: GearKit): void {
  const belt = plain(0x2a2420);
  const { s, R } = band(k, 'a_mantel', belt, 0.056, 0.01);
  k.on('pelvis', () => k.frame(at(s, R, Y, 0, 0.004), () => buckle(k, 0.058, 0.054, bright(PANZER.boss), belt)));
}

// ---------------------------------------------------------------- Mantel der Rattenmutter

const RAT = { fur: [0x6a5a4a, 0x7a6a56, 0x56483a], tail: 0xc08a80, belt: 0x2a2018, acid: 0x97c459 } as const;

/** Lumpy fur shawl collar: a chain of overlapping lumps round the back of the neck (on the scarf ring) and down both lapels. */
function collarFur(k: GearKit): void {
  const n = trunk(k, ['scarf', 'a_mantel'], NECK, 0.18);
  const N = field(n, 1.44, 1.52, 1.0, 2 * Math.PI - 1.0, { nt: 4, na: 14, smooth: 3 });
  const c = trunk(k, ['a_mantel']);
  const C = field(c, 1.18, 1.46, -1.2, 1.2, { nt: 8, na: 12, smooth: 3, drape: 0.4 });
  const lump = (i: number, sz: number): void => { k.add(scaled(ball(1, 7, 3), 0.045 * sz, 0.04 * sz, 0.028 * sz), cloth(RAT.fur[i % 3]!), 0, 0, 0, 0.25, 0, i * 1.3); };
  k.on('spine_03', () => {
    for (let i = 0; i < 12; i++) {
      const u = i / 11, a = 1.12 + (2 * Math.PI - 2.24) * u, t = 1.458 + 0.024 * Math.sin(Math.PI * u);
      k.frame(at(n, N, t, a, 0.014), () => lump(i, 1 - 0.08 * (i % 2)));
    }
  });
  for (const g of SIDES) for (let i = 0; i < 6; i++) {
    const v = i / 5, t = 1.425 - 0.2 * v;
    onTorso(k, c, C, t, g * (1.0 - 0.64 * v), 0.014 - 0.004 * v, () => lump(i + (g > 0 ? 1 : 2), 1.02 - 0.24 * v));
  }
}

/** Belt with an acid green buckle and rat tails tied on at the hips: short, tapering, curling out. */
function beltRattails(k: GearKit): void {
  const belt = plain(RAT.belt);
  const { s, R } = band(k, 'a_mantel', belt, 0.052, 0.01);
  const sk = trunk(k, ['a_mantel'], AXES.torso, 0.3);
  const S = field(sk, 0.9, 1.06, -2, 2, { nt: 4, na: 16, smooth: 2 });
  k.on('pelvis', () => {
    k.frame(at(s, R, Y, 0, 0.004), () => buckle(k, 0.04, 0.046, metal(RAT.acid), belt));
    for (const [a, len] of [[-1.5, 0.12], [-1.05, 0.09], [0.95, 0.09], [1.3, 0.12], [1.68, 0.1]] as const) {
      const g = Math.sign(a), pts: Vector3[] = [];
      for (let i = 0; i <= 3; i++) {
        const v = i / 3, t = Y - 0.022 - len * v, aa = a + g * 0.09 * Math.sin(v * Math.PI * 1.4);
        pts.push(s.point(t, aa, Math.max(R(Y, a) - 0.004, S(t, aa) + 0.014 + 0.014 * v)));
      }
      k.add(tube(pts, (i) => 0.0068 * (1 - i / 3.6)), plain(RAT.tail));
    }
  });
}

// ---------------------------------------------------------------- Rüstung des Zitadellenritters

const RITTER = { steel: 0x9aa0a8, dark: 0x7a8088, light: 0xc8ccd2, gold: 0xe0b040, gem: 0x43d1cf, belt: 0x22262e } as const;

/** By |angle| round the neck: piecewise linear through `tab` ([angle, value], angles 0..π rising). */
function byAngle(tab: ReadonlyArray<readonly [number, number]>): (a: number) => number {
  return (a) => {
    const f = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    for (let i = 1; i < tab.length; i++) if (f <= tab[i]![0]) { const [x0, y0] = tab[i - 1]!, [x1, y1] = tab[i]!; return y0 + ((y1 - y0) * (f - x0)) / (x1 - x0); }
    return tab[tab.length - 1]![1];
  };
}

/** Gorget: a steel collar from the plate tops and the shoulders up to a ring round the neck (1.8 cm clear), a bright band round its middle. */
function gorget(k: GearKit): void {
  const n = neckOf(k, 'a_mantel'), segs = 16;
  // Outer edge: over the breastplate's top at the front, under the pauldrons at the sides, over the back plate.
  const o = { a0: -Math.PI, a1: Math.PI, segs, rows: 2, phi0: byAngle([[0, 0.02], [0.8, 0.2], [1.57, 0.6], [2.4, 0.42], [Math.PI, 0.26]]), top: byAngle([[0, 0.014], [1.57, 0.012], [Math.PI, 0.01]]), lift0: 0.016, lift1: 0.008 };
  const { geo, at } = yoke(n, o);
  k.on('spine_03', () => {
    k.add(geo, bright(RITTER.steel));
    k.add(sheet((u, v) => at(u, 0.36 + 0.14 * v, 0.003), segs, 1), bright(RITTER.light));
  });
}

/** Breastplate with a glowing cyan gem and gold rivets, a keel down the middle, and a back plate. */
function plateRitter(k: GearKit): void {
  const gold = bright(RITTER.gold);
  const { s, F } = plates(k, bright(RITTER.steel), gold, 4);
  const fa = shapeAt(FRONT);
  torsoStrip(k, s, F, Array.from({ length: 9 }, (_, i) => fa(0.5, 0.06 + 0.86 * (i / 8))), 0.01, FRONT_LIFT(0.5, 0.5) + 0.002, bright(RITTER.light));
  torsoStrip(k, s, F, Array.from({ length: 7 }, (_, i) => { const u = 0.12 + 0.76 * (i / 6); return fa(u, 0.6 - 0.07 * Math.sin(Math.PI * u)); }), 0.006, FRONT_LIFT(0.5, 0.6) + 0.001, bright(RITTER.dark));
  const [t, a] = fa(0.5, 0.82);
  onTorso(k, s, F, t, a, FRONT_LIFT(0.5, 0.82), () => {
    k.add(flat([[0, 0.04], [0.032, 0], [0, -0.04], [-0.032, 0]], 0.006), gold, 0, 0, 0.002);
    k.add(flat([[0, 0.028], [0.021, 0], [0, -0.028], [-0.021, 0]], 0.008), glow(RITTER.gem), 0, 0, 0.005);
  });
}

/** Knight's pauldrons: three steel lames with gold rivets, a little bigger than the Panzer's. */
function pauldronsRitter(k: GearKit): void {
  for (const g of SIDES) pauldron(k, g, bright(RITTER.steel), bright(RITTER.gold), { puff: 0.006, r0: 0.03, rivets: [0.3, 0.7] });
}

/** Vambraces: steel shells over the outer forearm, a ridge and two gold rivets. */
function vambraces(k: GearKit): void {
  for (const g of SIDES) {
    const arm = k.arm(g, ['a_mantel']);
    const top = -g * (Math.PI / 2), sp = 1.9;
    const R = field(arm, 0.42, 0.6, top - sp, top + sp, { nt: 4, na: 10, smooth: 3 });
    const lift = domed(0.007, 0.012, 3);
    k.on(`lowerarm_${side(g)}`, () => {
      k.add(patch(arm, R, (u, v) => [0.43 + 0.155 * v, top + sp * (2 * u - 1)], 10, 2, lift), bright(RITTER.steel));
      k.add(strip(arm, R, line(0.435, top, 0.58, top, 2), 0.008, 0.014), bright(RITTER.light));
      for (const t of [0.45, 0.565]) k.frame(onSurface(arm, t, top + 0.9, 0.013, R(t, top + 0.9)), () => k.add(rivet(0.005), bright(RITTER.gold)));
    });
  }
}

/** Tassets: two overlapping steel plates over the front and outside of each thigh, on the thigh bones. */
function tassets(k: GearKit): void {
  for (const g of SIDES) {
    const leg = k.leg(g, ['a_mantel']);
    const c = g * 0.5, sp = 0.85;
    const R = field(leg, 0.76, 1.0, c - sp, c + sp, { nt: 6, na: 10, smooth: 3 });
    k.on(`thigh_${side(g)}`, () => {
      for (let i = 1; i >= 0; i--) {
        const t1 = 0.95 - 0.075 * i, t0 = t1 - 0.1;
        k.add(patch(leg, R, (u, v) => [t0 + (t1 - t0) * v, c + sp * (2 * u - 1)], 8, 2, (u, v) => 0.022 + 0.006 * (1 - v) - 0.005 * (1 - Math.sin(Math.PI * u))), bright(i ? RITTER.dark : RITTER.steel));
        k.frame(onSurface(leg, t0 + 0.02, c, 0.03, R(t0 + 0.02, c)), () => k.add(rivet(0.005), bright(RITTER.gold)));
      }
    });
  }
}

export const BODY_RARE_GEAR: Readonly<Record<string, GearBuilder>> = {
  // Kiezwache
  'collar-stand': collarStand,
  radio,
  whistle,
  armband,
  'belt-duty': beltDuty,
  // Spreegeist
  'collar-reed': collarReed,
  'seams-spree': seamsSpree,
  'belt-sash': beltSash,
  // Zitadelle
  tabard,
  'belt-knight-short': (k) => beltKnight(k, ZIT.leather, 0.07, 0.02),
  // Späti
  caps: capsChest,
  'sign-spaeti': signSpaeti,
  'belt-caps': beltCaps,
  // Panzer
  'plate-panzer': platePanzer,
  'pauldrons-panzer': pauldronsPanzer,
  'belt-plain': beltPlain,
  // Rattenmutter
  'collar-fur': collarFur,
  'belt-rattails': beltRattails,
  // Zitadellenritter
  gorget,
  'plate-ritter': plateRitter,
  'pauldrons-ritter': pauldronsRitter,
  vambraces,
  tassets,
  'belt-knight': (k) => beltKnight(k, RITTER.belt, 0.1, 0.012),
};
