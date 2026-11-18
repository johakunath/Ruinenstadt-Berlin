// M15 Alexanderplatz props: glass house, sunflower clump, the GDR rocket climbing frame and an Allee flag
// pole. Footprints: `propCollider` in `src/data/courtyard.ts` (greenhouse 4.6 × 8 m scaled, long along z).
import { CircleGeometry, CylinderGeometry, Matrix4, PlaneGeometry, SphereGeometry } from 'three';
import type { GdrPropKind, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';
import { POSTER_ASPECT, posterUv, type PosterKey } from './alex-paint';
import type { LitMaterial } from './materials';

type RGB = readonly [number, number, number];
const KINDS: ReadonlySet<string> = new Set<GdrPropKind>(['greenhouse', 'sunflowers', 'climber', 'flagpole']);
const GLASS: RGB = [0.78, 1.02, 0.92], FRAME: RGB = [0.95, 0.95, 0.92], LEAF: RGB = [0.55, 0.85, 0.45];
const PAINT: RGB[] = [[1.3, 0.42, 0.38], [1.35, 1.1, 0.4], [0.45, 0.62, 1.1]];

/** A glass house: low brick base, glass walls and a pitched glass roof on white frames, plants pressing at the glass. */
function greenhouse(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, s = p.size, W = 4.6 * s, L = 8 * s, H = 2.2 * s, R = 1.3 * s;
  b.box(m.brick, at(p, 0, 0.35, 0), W, 0.7, L, [1.0, 0.75, 0.62]);
  b.box(m.stucco, at(p, 0, 0.7 + H / 2, 0), W - 0.1, H, L - 0.1, GLASS);
  for (const sx of [-1, 1]) {
    const roof = at(p, (sx * W) / 4, 0.7 + H + R / 2, 0, 0, 0, -sx * Math.atan2(R, W / 2));
    b.box(m.stucco, roof, Math.hypot(W / 2, R) + 0.05, 0.06, L, GLASS);
    // A broken pane or two, overgrown from inside.
    if (rng.next() < 0.5) b.box(m.ivy, roof.clone().multiply(new Matrix4().setPosition(0, 0.05, rng.range(-L / 3, L / 3))), 1.2, 0.08, 1.4, LEAF);
  }
  for (let z = -L / 2; z <= L / 2 + 0.01; z += L / 5) {
    for (const sx of [-1, 1]) b.box(m.iron, at(p, (sx * W) / 2, 0.7 + H / 2, z), 0.06, H, 0.06, FRAME);
    b.box(m.iron, at(p, 0, 0.7 + H + R, z), 0.06, 0.06, 0.06, FRAME);
  }
  b.box(m.iron, at(p, 0, 0.7 + H + R, 0), 0.08, 0.08, L, FRAME);
  for (let k = 0; k < 6; k++) b.geo(m.ivy, new SphereGeometry(0.5 + rng.next() * 0.4, 7, 5), at(p, rng.range(-W / 3, W / 3), 0.9 + rng.next() * 0.8, rng.range(-L / 2.4, L / 2.4)), LEAF);
  b.shadowBox(at(p, 0, (0.7 + H + R) / 2, 0), W, 0.7 + H + R * 0.6, L);
}

/** Five to eight sunflowers grown wild, 1.6 to 2.6 m, heads turned to the low sun. */
function sunflowers(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, n = 5 + rng.int(4);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(0, 0.45) * p.size, h = rng.range(1.6, 2.6) * p.size, x = Math.sin(a) * r, z = Math.cos(a) * r;
    b.geo(m.stucco, new CylinderGeometry(0.025, 0.035, h, 5), at(p, x, h / 2, z), [0.45, 0.7, 0.35]);
    b.box(m.ivy, at(p, x + 0.12, h * 0.45, z, 0, a, 0.5), 0.3, 0.02, 0.16, LEAF);
    const head = at(p, x, h, z, -0.9, rng.range(-0.6, 0.6));
    b.geo(m.stucco, new CylinderGeometry(0.2, 0.2, 0.05, 12), head, [1.45, 1.12, 0.3]);
    b.geo(m.stucco, new CylinderGeometry(0.1, 0.1, 0.07, 10), head, [0.45, 0.3, 0.18]);
  }
}

/** The GDR rocket climbing frame (Raketenklettergerüst): tube rings, ribs to a nose cone, three fins, painted. */
function climber(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, col = rng.pick(PAINT), H = 4.2;
  for (const [y, r] of [[0.1, 1.0], [1.4, 1.0], [2.7, 0.85], [3.6, 0.5]] as const) {
    for (let k = 0; k < 10; k++) {
      const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2;
      const mx = ((Math.sin(a0) + Math.sin(a1)) / 2) * r, mz = ((Math.cos(a0) + Math.cos(a1)) / 2) * r;
      b.box(m.stucco, at(p, mx, y, mz, 0, (a0 + a1) / 2 + Math.PI / 2), (2 * Math.PI * r) / 10, 0.06, 0.06, col);
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    b.box(m.stucco, at(p, Math.sin(a) * 1.0, 1.35, Math.cos(a) * 1.0), 0.07, 2.7, 0.07, col);
    b.box(m.stucco, at(p, Math.sin(a) * 0.68, 3.15, Math.cos(a) * 0.68, -Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35), 0.07, 1.0, 0.07, col);
  }
  b.geo(m.stucco, new CylinderGeometry(0.04, 0.5, 0.9, 8), at(p, 0, H - 0.15, 0), [1.35, 1.1, 0.4]);
  for (let k = 0; k < 3; k++) { const a = (k * Math.PI * 2) / 3; b.box(m.stucco, at(p, Math.sin(a) * 1.15, 0.5, Math.cos(a) * 1.15, 0, a), 0.05, 0.9, 0.5, [1.3, 0.42, 0.38]); }
  b.shadowBox(at(p, 0, H / 2, 0), 2, H, 2);
}

/** A flag pole on the Allee: red banner with the yellow hammer and sickle (sign atlas when built on this map), a blue and yellow pennant. */
function flagpole(b: Builder, p: Prop): void {
  const m = b.mats, H = 7.5;
  b.geo(m.iron, new CylinderGeometry(0.05, 0.08, H, 8), at(p, 0, H / 2, 0), [0.8, 0.8, 0.8]);
  b.geo(m.iron, new SphereGeometry(0.1, 8, 6), at(p, 0, H + 0.05, 0), [1.4, 1.15, 0.6]);
  b.box(m.iron, at(p, 0.95, H - 0.22, 0), 1.9, 0.04, 0.04, [0.8, 0.8, 0.8]);
  // The 2D game's painted banner (red or blue, from the pole's turn), alpha-tested and two-sided.
  const posters = (b as Builder & { mm?: { posters?: LitMaterial } }).mm?.posters;
  const key: PosterKey = Math.round(p.rot * 10) % 2 ? 'red' : 'blue', bh = 3.2, bw = bh * POSTER_ASPECT[key];
  const banner = at(p, 0.1 + bw / 2, H - 0.25 - bh / 2, 0.03, 0, 0, 0);
  if (posters) {
    const [u0, v0, u1, v1] = posterUv(key);
    const g = new PlaneGeometry(bw, bh), uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    b.geo(posters, g, banner);
  } else b.box(m.stucco, banner, bw, bh, 0.02, [1.3, 0.42, 0.38]);
  b.geo(m.stucco, new CircleGeometry(0.3, 10), at(p, 0, 0.02, 0, -Math.PI / 2), [0.7, 0.7, 0.68]);
}

/** Builds a GDR prop; false when `p` is not one. */
export function buildGdrProp(b: Builder, p: Prop, rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  switch (p.kind as GdrPropKind) {
    case 'greenhouse': greenhouse(b, p, rng); break;
    case 'sunflowers': sunflowers(b, p, rng); break;
    case 'climber': climber(b, p, rng); break;
    case 'flagpole': flagpole(b, p); break;
  }
  return true;
}
