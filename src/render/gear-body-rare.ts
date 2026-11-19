// Armor gear of the sets and legendaries (WP4 step 2c): Kiezwache, Spreegeist, Zitadelle, Späti, Panzer,
// Rattenmutter, Zitadellenritter. More elaborate and brighter than the normal looks; every set's pieces
// share a motif. Chest parts ride on spine_03, belts on the pelvis, pauldrons on the upper arms,
// vambraces on the forearms, tassets on the thighs. Looks: docs/mockups/wp4-clothes/items.mjs
// (Johannes, 2026-11-19).
import { BufferAttribute, BufferGeometry, PlaneGeometry, Vector3 } from 'three';
import { AXES, Sampler, axis, bright, cloth, glow, metal, onSurface, plain, surface, type Axis, type GearKit, type HeroSource } from './gear-kit';
import type { GearBuilder } from './gear';
import { BELT_Y, beltBand } from './gear-body';
import { ball, box, cone, cyl, flat, scaled } from './weapons';

const SIDES = [1, -1] as const;
const side = (s: 1 | -1): 'l' | 'r' => (s > 0 ? 'l' : 'r');
/** Round the neck (scarf ring, collars): the torso axis moved back under the neck. */
const NECK: Axis = axis([0, 0, -0.04], [0, 1, 0], [0, 0, 1]);

const trunks = new WeakMap<HeroSource, Map<string, Sampler>>();

/** Sampler of `nodes` round `ax` without the sleeves (only |x| < `maxX`): plates, collars and lapels. */
function trunk(k: GearKit, nodes: readonly string[], ax: Axis = AXES.torso, maxX = 0.19): Sampler {
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

/** Wound so the normals point out of the sampler's axis (the materials are double-sided anyway). */
function outward(g: BufferGeometry, s: Sampler): BufferGeometry {
  g.computeVertexNormals();
  const pos = g.attributes.position!, n = g.attributes.normal!, c = new Vector3(), q = new Vector3();
  let flip = 0;
  for (let i = 0; i < n.count; i++) {
    c.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(s.ax.o);
    c.addScaledVector(s.ax.d, -c.dot(s.ax.d));
    flip += q.set(n.getX(i), n.getY(i), n.getZ(i)).dot(c) < 0 ? 1 : -1;
  }
  if (flip > 0) {
    const ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); }
    g.computeVertexNormals();
  }
  return g;
}

function grid(pts: number[], uv: number[], segs: number, rows: number): BufferGeometry {
  const idx: number[] = [], w = segs + 1;
  for (let r = 0; r < rows; r++) for (let j = 0; j < segs; j++) { const a = r * w + j, b = a + 1, c = a + w, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

interface PatchOpts {
  segs: number;
  rows: number;
  /** Distance (m) out of the measured surface, per grid point. */
  offset?: number | ((u: number, v: number) => number);
  /** Smoothing passes round each row (max-preserving). */
  smooth?: number;
  /** A fixed radius instead of the measured one. */
  radius?: (u: number, v: number) => number;
}

/**
 * A fitted patch: the grid (u, v) ∈ [0, 1]² maps to height `t` and angle `a` on `s` (`at`), so plates
 * can taper, point and curve. Radius = measured (smoothed round each row) + offset; UVs = (u, v).
 */
function patch(s: Sampler, at: (u: number, v: number) => readonly [number, number], o: PatchOpts): BufferGeometry {
  const { segs, rows } = o;
  const off = typeof o.offset === 'function' ? o.offset : (): number => (o.offset as number | undefined) ?? 0;
  const pts: number[] = [], uv: number[] = [], p = new Vector3();
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    let row: number[] = [];
    for (let j = 0; j <= segs; j++) { const [t, a] = at(j / segs, v); row.push(o.radius ? o.radius(j / segs, v) : s.radius(t, a)); }
    const any = row.find((x) => x > 0) ?? 0.05;
    row = smoothRow(row.map((x) => x || any), o.smooth ?? 2);
    for (let j = 0; j <= segs; j++) {
      const u = j / segs, [t, a] = at(u, v);
      s.point(t, a, row[j]! + off(u, v), p);
      pts.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
  }
  return outward(grid(pts, uv, segs, rows), s);
}

/** A band `w` wide along the path `pts` ([t, a] pairs) on `s`, `lift` out of it: seams, trims, cords on the body. */
function strip(s: Sampler, pts: ReadonlyArray<readonly [number, number]>, w: number, lift: number, smooth = 2): BufferGeometry {
  const r = smoothRow(pts.map(([t, a]) => s.radius(t, a)), smooth);
  const c = pts.map(([t, a], i) => s.point(t, a, r[i]! + lift));
  const out: number[] = [], uv: number[] = [], sd = new Vector3(), tg = new Vector3();
  c.forEach((p, i) => {
    tg.subVectors(c[Math.min(c.length - 1, i + 1)]!, c[Math.max(0, i - 1)]!);
    sd.crossVectors(tg, s.out(pts[i]![1])).normalize().multiplyScalar(w / 2);
    out.push(p.x - sd.x, p.y - sd.y, p.z - sd.z, p.x + sd.x, p.y + sd.y, p.z + sd.z);
    uv.push(0, i / (c.length - 1), 1, i / (c.length - 1));
  });
  return outward(grid(out, uv, 1, c.length - 1), s);
}

/** Outermost radius of `s` over a region (a flat part's footprint). */
function maxR(s: Sampler, t0: number, t1: number, a0: number, a1: number): number {
  let m = 0;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) m = Math.max(m, s.radius(t0 + ((t1 - t0) * i) / 4, a0 + ((a1 - a0) * j) / 4));
  return m;
}

/** Plate lift: `lo` at the edges, `hi` in the middle, so a plate curls back to the body (reads thick, hides the gap). */
const domed = (lo: number, hi: number) => (u: number, v: number): number => lo + (hi - lo) * Math.min(1, 2.2 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)) ** 0.7;

/** A quad facing +Z (glow letters, small flat marks). */
const quad = (w: number, h: number): BufferGeometry => new PlaneGeometry(w, h);

/** Small rivet (8 triangles), facing +Z. */
const rivet = (r = 0.005): BufferGeometry => scaled(ball(1, 4, 2), r, r, r * 0.7);

// ---------------------------------------------------------------- Weste der Kiezwache

const KIEZ = { blue: 0x2f62b0, collar: 0x24508e, orange: 0xf08a24, belt: 0x141a2a, dark: 0x2a2c30, cream: 0xf4f0e0 } as const;

/** Stand collar: a padded band round the back and sides of the scarf ring, higher at the back, open at the front. */
function collarStand(k: GearKit): void {
  const s = trunk(k, ['scarf', 'a_weste'], NECK, 0.21);
  const a0 = 1.0, a1 = 2 * Math.PI - 1.0, segs = 16;
  const top = (u: number): number => 1.5 + 0.035 * Math.sin(Math.PI * u) ** 2;
  const at = (u: number, v: number): readonly [number, number] => [1.415 + (top(u) - 1.415) * v, a0 + (a1 - a0) * u];
  k.on('spine_03', () => {
    k.add(patch(s, at, { segs, rows: 3, smooth: 3, offset: (_u, v) => 0.014 - 0.004 * v }), plain(KIEZ.collar));
    // Orange piping on the top edge.
    k.add(patch(s, (u, v) => [top(u) - 0.012 + 0.012 * v, a0 + (a1 - a0) * u], { segs, rows: 1, smooth: 3, offset: 0.013 }), plain(KIEZ.orange));
  });
}

/** Radio clipped on the upper chest strap (the hero's right), antenna up, a red glow dot. */
function radio(k: GearKit): void {
  const s = trunk(k, ['a_weste']);
  const t = 1.33, a = -0.36, R = maxR(s, t - 0.03, t + 0.03, a - 0.15, a + 0.15);
  k.on('spine_03', () => k.frame(onSurface(s, t, a, 0.016, R), () => {
    k.add(box(0.042, 0.07, 0.022), plain(KIEZ.dark));
    // Speaker grille, push button, belt clip in the strap colour.
    for (const y of [-0.012, -0.002, 0.008]) k.add(box(0.028, 0.004, 0.003), plain(0x4a4e56), 0, y, 0.012);
    k.add(box(0.008, 0.016, 0.008), plain(KIEZ.orange), -0.024, 0.008, 0);
    k.add(box(0.03, 0.014, 0.004), plain(KIEZ.orange), 0, -0.02, -0.012);
    // Antenna on the outer top corner, knob, red dot.
    k.add(cyl(0.004, 0.005, 0.075, 5), plain(KIEZ.dark), -0.013, 0.072, 0);
    k.add(cyl(0.006, 0.006, 0.012, 6), plain(0x1a1c20), 0.011, 0.041, 0);
    k.add(box(0.009, 0.009, 0.004), glow(0xff3a2a), 0.012, 0.024, 0.012);
  }));
}

/** Whistle on an orange cord from under the scarf down to the left chest. */
function whistle(k: GearKit): void {
  const s = trunk(k, ['a_weste']);
  const path: Array<[number, number]> = [];
  for (let i = 0; i <= 6; i++) { const v = i / 6; path.push([1.4 - 0.115 * v, 0.06 + 0.3 * v - 0.08 * v * v]); }
  k.on('spine_03', () => {
    k.add(strip(s, path, 0.006, 0.007), plain(KIEZ.orange));
    const [t, a] = path[path.length - 1]!;
    k.frame(onSurface(s, t - 0.012, a, 0.014, maxR(s, t - 0.03, t, a - 0.12, a + 0.12)), () => {
      k.add(cyl(0.008, 0.008, 0.028, 7), bright(0xc8ccd0), 0, 0, 0, 0, 0, Math.PI / 2 - 0.4);
      k.add(box(0.012, 0.01, 0.008), bright(0xc8ccd0), 0.014, 0.008, 0, 0, 0, -0.4);
      k.add(ball(0.006, 5, 3), plain(KIEZ.orange), -0.01, 0.006, 0);
    });
  });
}

/** Orange armband round the left upper arm with a reflective cream stripe. */
function armband(k: GearKit): void {
  const s = k.arm(1, ['body_arms']);
  k.on('upperarm_l', () => {
    k.add(surface(s, 0.235, 0.285, { segs: 12, rows: 1, offset: 0.006, smooth: 2 }), plain(KIEZ.orange));
    k.add(surface(s, 0.255, 0.265, { segs: 12, rows: 1, offset: 0.009, smooth: 2 }), plain(KIEZ.cream));
  });
}

/** Duty belt on the vest: orange buckle, flashlight with a glowing lens on the right hip, radio pouch on the left. */
function beltDuty(k: GearKit): void {
  const s = beltBand(k, 'a_weste', KIEZ.belt, 0.05, 0.011);
  const y = BELT_Y.a_weste;
  k.on('pelvis', () => {
    k.frame(onSurface(s, y, 0, 0.016, maxR(s, y - 0.02, y + 0.02, -0.2, 0.2)), () => {
      k.add(box(0.056, 0.05, 0.008), metal(KIEZ.orange)).add(box(0.036, 0.03, 0.01), plain(KIEZ.belt), 0, 0, 0.002);
    });
    // Flashlight in a holster ring, lens down.
    k.frame(onSurface(s, y - 0.06, -1.05, 0.028, maxR(s, y - 0.1, y - 0.02, -1.2, -0.9)), () => {
      k.add(cyl(0.013, 0.013, 0.1, 7), metal(0x34363a), 0, 0.005, 0);
      k.add(cyl(0.018, 0.015, 0.03, 8), metal(0x34363a), 0, -0.058, 0);
      k.add(cyl(0.015, 0.015, 0.004, 8), glow(0xf4f0c8), 0, -0.074, 0);
      k.add(box(0.032, 0.014, 0.03), plain(KIEZ.belt), 0, 0.04, -0.004);
    });
    // Radio pouch with its antenna up past the belt.
    k.frame(onSurface(s, y - 0.035, 0.85, 0.03, maxR(s, y - 0.08, y, 0.7, 1.0)), () => {
      k.add(box(0.06, 0.08, 0.034), plain(0x232c42)).add(box(0.064, 0.022, 0.036), plain(KIEZ.belt), 0, 0.03, 0.001);
      k.add(box(0.03, 0.006, 0.002), plain(KIEZ.orange), 0, -0.01, 0.018);
      k.add(cyl(0.004, 0.005, 0.07, 5), plain(KIEZ.dark), 0.018, 0.07, -0.004);
    });
  });
}

export const BODY_RARE_GEAR: Readonly<Record<string, GearBuilder>> = {
  'collar-stand': collarStand,
  radio,
  whistle,
  armband,
  'belt-duty': beltDuty,
};
void [cloth, cone, flat, quad, rivet, domed, SIDES, side];
