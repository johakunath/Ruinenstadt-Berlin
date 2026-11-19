// The Tunnelläufer set (WP4 step 2, Johannes 2026-11-19: "Tunnelläufer ist fein"): head lamp, harness with a
// pressure tank, teal knee pads, belt, puttee boots. Look: docs/mockups/wp4-clothes/tunnel.webp, U-Bahn board.
// The tank, its valve, hose and gauge sit on the hero's right as the task asks (the mockup draws them on the
// right of its front view, which is the hero's left); the belt keeps the mockup's sides.
import { BufferAttribute, BufferGeometry, CircleGeometry, Matrix4, SphereGeometry, Vector3 } from 'three';
import { angleAt, belt, buckle, kneepads, strip, tilt, tube } from './gear-body';
import { TORSO, field, torsoBand, trunk } from './gear-body-rare';
import { band, fitRing } from './gear-head';
import { axis, basis, bright, cloth, glow, headSampler, metal, onSurface, plain, type GearKit, type Paint, type Sampler } from './gear-kit';
import { both, fitted, foot, leg, round, shell, type Fit } from './gear-limbs';
import type { GearBuilder } from './gear';
import { box, cone, cyl, flat, ring } from './weapons';

const TUN = {
  strap: 0x3a2414, tank: 0xb87333, brass: 0xc9a34a, cream: 0xf0e2c0, hose: 0x2a2a26, tag: 0xe0a020, ink: 0x1a1a1a,
  band: 0x2a2420, glass: 0xa8c4c8, lamp: 0xfff2b0, pouch: 0x5a4a30, flap: 0x4a3c26, wrap: 0x9c8048, steel: 0x9aa0a8,
} as const;
/** Side of the tank, its valve, the hose and the gauge: the hero's right. */
const SIDE = -1;
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

// ---------------------------------------------------------------- head lamp

/** Stirnlampe: a dark band round the head at the forehead, goggles pushed up on it, a brass lamp above them glowing warm. */
function headlamp(k: GearKit): void {
  k.on('Head', () => {
    const s = headSampler(k);
    // Band bottom by angle: 1.708 at the front, 1.692 at the sides, 1.696 at the back; 2.2 cm tall, on the hair.
    const y0 = (a: number): number => { const c = Math.cos(a); return 1.692 + 0.006 * c + 0.01 * c * c; };
    const r = fitRing(s, -Math.PI, Math.PI, y0, (a) => y0(a) + 0.022);
    k.add(band(s, { a0: -Math.PI, a1: Math.PI, segs: 28, rows: 2, y: (a, v) => y0(a) + 0.022 * v, r, extra: (_u, v) => 0.004 + 0.003 * Math.sin(Math.PI * v) }), plain(TUN.band));
    const brass = bright(TUN.brass);
    // Goggles on the band either side of the lamp, tipped up (pushed up on the forehead).
    for (const sg of [1, -1]) {
      const a = sg * 0.4;
      k.frame(onSurface(s, 1.72, a, 0.008, r(a)).multiply(new Matrix4().makeRotationX(-0.3)), () => {
        k.add(cyl(0.021, 0.023, 0.012, 12), brass, 0, 0, 0.006, Math.PI / 2);
        k.add(new CircleGeometry(0.0155, 12), bright(TUN.glass), 0, 0, 0.0122);
        k.add(new CircleGeometry(0.0042, 6), plain(0xf4f8f8), -sg * 0.005, 0.006, 0.0128);
      });
    }
    // Lamp at the front above the goggles: a plate on the band, the housing, the rim and the glowing lens.
    const rl = Math.max(r(0), s.radius(1.745, 0, 0.012, 0.2));
    k.frame(onSurface(s, 1.745, 0, 0.006, rl), () => {
      k.add(box(0.03, 0.04, 0.006), plain(0x1e1a16), 0, -0.014, 0);
      k.add(cyl(0.019, 0.022, 0.028, 10), brass, 0, 0, 0.016, Math.PI / 2);
      k.add(cyl(0.025, 0.025, 0.006, 10), bright(0xd8b45a), 0, 0, 0.031, Math.PI / 2);
      k.add(new CircleGeometry(0.019, 10), glow(TUN.lamp), 0, 0, 0.0345);
    });
  });
}

// ---------------------------------------------------------------- harness

interface Pt { p: Vector3; n: Vector3; band: number }
/** Lower torso pieces sit this much further out, so overlaps never flicker (as in gear-body-rare.ts). */
const STEP = 0.0025;

/** Lays a strip `w` wide along `pts`, one piece per torso bone, each reaching one point into its neighbours (no gap when the spine bends). */
function lay(k: GearKit, pts: readonly Pt[], w: number, paint: Paint): void {
  let i0 = 0;
  for (let i = 1; i <= pts.length; i++) if (i === pts.length || pts[i]!.band !== pts[i0]!.band) {
    const b = pts[i0]!.band, seg = pts.slice(Math.max(0, i0 - 1), Math.min(pts.length, i + 1));
    k.on(TORSO[b]![0], () => k.add(strip(seg.map((q) => q.p.clone().addScaledVector(q.n, STEP * b)), seg.map((q) => q.n), w), paint));
    i0 = i;
  }
}

/**
 * Gurtzeug: two leather straps crossing on the chest and the back, a copper pressure tank on the back whose
 * valve shows over the shoulder, a hose from the valve over the shoulder to a brass gauge on the strap, a
 * yellow key tag with a U lower on the same strap.
 */
function harness(k: GearKit): void {
  const s = trunk(k, ['a_mantel']);
  const F = field(s, 1.06, 1.47, -1.3, 1.3, { nt: 14, na: 18, smooth: 4, drape: 0.5 });
  const B = field(s, 1.06, 1.47, Math.PI - 1.3, Math.PI + 1.3, { nt: 14, na: 18, smooth: 3, drape: 0.3 });
  const sag = k.sampler(['a_mantel'], axis([0, 1.36, -0.03], [1, 0, 0], [0, 0, 1]));
  const front = (x: number, y: number, lift: number): Pt => { const a = angleAt(s, y, x); return { p: s.point(y, a, F(y, a) + lift), n: s.out(a), band: torsoBand(y) }; };
  const back = (x: number, y: number, lift: number): Pt => { const a = angleAt(s, y, x, true); return { p: s.point(y, a, B(y, a) + lift), n: s.out(a), band: torsoBand(y) }; };
  const over = (x: number, a: number, lift: number): Pt => ({ p: sag.point(x, a, sag.radius(x, a) + lift), n: sag.out(a), band: 0 });
  /** A strap over the shoulder at `sg` down to the other hip, front and back (both ends under the belt). */
  const strap = (sg: number, lift: number): Pt[] => {
    const pts: Pt[] = [], X = (v: number): number => mix(-sg * 0.085, sg * 0.095, v), Y = (v: number): number => mix(1.095, 1.43, v);
    for (let i = 0; i <= 8; i++) pts.push(back(X(i / 8), Y(i / 8), lift));
    for (const a of [-2.25, -1.8, -1.35, -0.9]) pts.push(over(sg * 0.1, a, lift + 0.004));
    for (let i = 8; i >= 0; i--) pts.push(front(X(i / 8), Y(i / 8), lift));
    return pts;
  };
  const leather = plain(TUN.strap), LG = 0.013;
  // The gauge strap from the tank's shoulder lies over the other one.
  lay(k, strap(-SIDE, 0.008), 0.024, leather);
  lay(k, strap(SIDE, LG), 0.024, leather);

  // Tank: tilted so its top leans out to the shoulder, at least 1.3 cm off the back (over the straps).
  const r = 0.06, yb = 1.25, yt = 1.43, xb = SIDE * 0.045, xt = SIDE * 0.1;
  const surf = (y: number, x: number): number => { const a = angleAt(s, y, x, true); return s.point(y, a, s.radius(y, a, 0.012, 0.15)).z; };
  const zc = (y: number): number => { const x = mix(xb, xt, (y - yb) / (yt - yb)); return Math.min(surf(y, x) - r, surf(y, x - 0.035) - 0.7 * r, surf(y, x + 0.035) - 0.7 * r) - 0.013; };
  // Tilted like the back between its ends, then moved back until it clears the back everywhere (the shoulder blades).
  const slope = (zc(yt) - zc(yb)) / (yt - yb);
  let zb = zc(yb);
  for (let y = yb; y <= yt + 1e-6; y += 0.02) zb = Math.min(zb, zc(y) - slope * (y - yb));
  const zt = zb + slope * (yt - yb);
  const p0 = new Vector3(xb, yb, zb), p1 = new Vector3(xt, yt, zt), L = p0.distanceTo(p1);
  const ay = p1.clone().sub(p0).normalize(), az = new Vector3(0, 0, -1).addScaledVector(ay, ay.z).normalize();
  const tank = basis(p0.clone().add(p1).multiplyScalar(0.5), new Vector3().crossVectors(ay, az), ay, az);
  const copper = bright(TUN.tank), brass = bright(TUN.brass), top = L / 2 + r * 0.5;
  k.on('spine_03', () => k.frame(tank, () => {
    k.add(cyl(r, r, L, 12, true), copper);
    const dome = (): SphereGeometry => new SphereGeometry(r, 12, 2, 0, Math.PI * 2, 0, Math.PI / 2);
    k.add(dome().scale(1, 0.5, 1), copper, 0, L / 2, 0).add(dome().scale(1, 0.5, 1), copper, 0, -L / 2, 0, Math.PI);
    for (const y of [-0.3, 0.3]) k.add(cyl(r + 0.004, r + 0.004, 0.026, 12, true), leather, 0, y * L, 0);
    // Valve: neck, body, hand wheel on top, outlet to the hose (toward the body, −Z).
    k.add(cyl(0.011, 0.013, 0.03, 8), brass, 0, top + 0.012, 0).add(box(0.024, 0.022, 0.024), brass, 0, top + 0.034, 0);
    k.add(ring(0.017, 0.0032, 3, 8), bright(0xb03a2a), 0, top + 0.05, 0, Math.PI / 2).add(cyl(0.004, 0.004, 0.012, 4), brass, 0, top + 0.046, 0);
    k.add(cyl(0.006, 0.006, 0.02, 6), brass, 0, top + 0.034, -0.018, Math.PI / 2);
  }));
  const outlet = new Vector3(0, top + 0.034, -0.03).applyMatrix4(tank);

  // Gauge on the strap at the chest, tipped up a little; the hose comes in at its top.
  const gy = 1.335, ga = angleAt(s, gy, SIDE * 0.046);
  const gm = onSurface(s, gy, ga, LG + 0.004, F(gy, ga)).multiply(new Matrix4().makeRotationX(-0.2));
  k.on('spine_03', () => k.frame(gm, () => {
    k.add(cyl(0.025, 0.025, 0.012, 12), brass, 0, 0, 0.006, Math.PI / 2);
    k.add(new CircleGeometry(0.0195, 12), plain(TUN.cream), 0, 0, 0.0122);
    k.add(box(0.0024, 0.015, 0.0012), plain(TUN.ink), 0.003, 0.005, 0.0132, 0, 0, -0.6);
    k.add(box(0.008, 0.004, 0.0012), plain(0xb8261c), 0.012, 0.009, 0.0128, 0, 0, -0.9);
    k.add(cyl(0.006, 0.006, 0.014, 6), brass, 0, 0.029, 0.006);
  }));
  const inlet = new Vector3(0, 0.036, 0.006).applyMatrix4(gm);
  const hose = [outlet, ...[-2.35, -1.85, -1.35].map((a) => over(SIDE * 0.125, a, 0.026).p), front(SIDE * 0.1, 1.405, LG + 0.016).p, inlet];
  k.on('spine_03', () => k.add(tube(hose, 0.0065, 14, 4), plain(TUN.hose)));

  // Key tag with a U, hanging from a ring on the lower strap.
  const ty = 1.19, ta = angleAt(s, ty, -SIDE * 0.038);
  k.on(TORSO[torsoBand(ty)]![0], () => k.frame(onSurface(s, ty, ta, LG + 0.004, F(ty, ta)), () => {
    k.add(ring(0.0075, 0.0018, 3, 6), brass, 0, 0.004, 0.002);
    k.frame(new Matrix4().makeTranslation(0.002, -0.018, 0.004).multiply(new Matrix4().makeRotationZ(SIDE * 0.25)), () => {
      const w = 0.015, h = 0.017, c = 0.005;
      k.add(flat([[-w + c, h], [w - c, h], [w, h - c], [w, -h + c], [w - c, -h], [-w + c, -h], [-w, -h + c], [-w, h - c]], 0.004), plain(TUN.tag));
      k.add(flat([[-0.009, 0.011], [-0.0045, 0.011], [-0.0045, -0.003], [-0.0025, -0.006], [0.0025, -0.006], [0.0045, -0.003], [0.0045, 0.011], [0.009, 0.011], [0.009, -0.006], [0.005, -0.011], [-0.005, -0.011], [-0.009, -0.006]], 0.001), plain(TUN.ink), 0, -0.001, 0.0025);
    });
  }));
}

// ---------------------------------------------------------------- belt

/** Gürtel: dark leather belt, yellow buckle, a pouch on the right and two on the left, a small lantern hanging on the right hip. */
function beltTunnel(k: GearKit): void {
  const { at } = belt(k, 'a_mantel', TUN.strap, 0.058);
  const pouch = plain(TUN.pouch), flap = plain(TUN.flap);
  k.on('pelvis', () => {
    k.frame(at(0), () => buckle(k, 0.068, 0.062, bright(TUN.tag), plain(TUN.strap)));
    for (const a of [-0.6, 0.5, 0.92]) k.frame(at(a, -0.028, 0.016), () => {
      k.add(box(0.05, 0.076, 0.032), pouch).add(box(0.056, 0.028, 0.036), flap, 0, 0.026, 0.003);
    });
    // Lantern on a hook: handle, cap, glowing glass, base.
    k.frame(tilt(at(-1.18, -0.036, 0.022), -0.22), () => {
      k.add(box(0.004, 0.026, 0.004), metal(0x4a4c50), 0, 0.004, 0);
      k.add(cone(0.017, 0.016, 6), metal(0x3a3c40), 0, -0.016, 0);
      k.add(cyl(0.012, 0.012, 0.026, 6), glow(TUN.lamp), 0, -0.037, 0);
      k.add(cyl(0.016, 0.016, 0.007, 6), metal(0x3a3c40), 0, -0.053, 0);
    });
  });
}

// ---------------------------------------------------------------- boots

/**
 * A strip wound `turns` times round the leg's fitted radius `R` from `t0` to `t1`, `w` wide, `per` quads per
 * turn; `tilt` m steeper at the front (the turns read as diagonal wraps). The lower edge stands further out:
 * each turn lies over the one below it.
 */
function helix(smp: Sampler, R: (u: number, v: number) => number, t0: number, t1: number, turns: number, per: number, w: number, tilt: number): BufferGeometry {
  const cols = turns * per, pos: number[] = [], uv: number[] = [], idx: number[] = [], p = new Vector3();
  for (let e = 0; e <= 1; e++) for (let j = 0; j <= cols; j++) {
    const q = (j / cols) * turns, u = q - Math.floor(q), a = round(u), v = ((j / cols) * (t1 - t0 - w) + w * e) / (t1 - t0);
    smp.point(mix(t0, t1, v) + tilt * Math.sin(a), a, R(u, v) + (e ? 0.005 : 0.009), p);
    pos.push(p.x, p.y, p.z);
    uv.push(j / cols, e);
  }
  const W = cols + 1;
  for (let j = 0; j < cols; j++) idx.push(j, j + W, j + 1, j + 1, j + W, j + W + 1);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Wickelgamaschen: a tan puttee wound from above the ankle to mid-calf over the shaft, steel toe caps. */
function puttees(k: GearKit): void {
  both(k, (l) => {
    const smp = leg(k), t0 = 0.14, t1 = 0.45;
    const f: Fit = { cols: 16, rows: 6, closed: true, smooth: 3, vsmooth: 2, span: 0.024, at: (u, v) => [mix(t0, t1, v), round(u)] };
    l.add('calf', helix(smp, fitted(smp, f), t0, t1, 7, 8, 0.035, 0.018), cloth(TUN.wrap));
    // Steel toe caps over the toe box.
    const fs = foot(k, 'f_stiefel', 0.105, 0.012);
    const g: Fit = { cols: 8, rows: 2, smooth: 2, span: 0.02, at: (u, v) => [mix(0.064, 0.134, v), 1.45 * (2 * u - 1)] };
    const T = fitted(fs, g);
    l.add('ball', shell(fs, g, (u, v) => T(u, v) + 0.004), metal(TUN.steel));
  });
}

export const TUNNEL_GEAR: Readonly<Record<string, GearBuilder>> = {
  'hat-headlamp': headlamp,
  harness,
  'kneepads-teal': kneepads(0x516a62, 0x2c3834, 0x2a1c12),
  'belt-tunnel': beltTunnel,
  puttees,
};
