// M15 Mitte step 7 props: ridge tent, beer set, speaker stack and a surveillance camera pole. All worn
// (Johannes 2026-11-18: everything is a ruin): patched tarps, a broken bench slat, a cracked cone, a bent pole.
// Footprints: `propCollider` in `src/data/courtyard.ts` (tent 2.6 × 2.1 m scaled, ridge along local x).
// Cost: shared materials only (tarp, wood, iron, rubber, concrete), merged into the chunk batches; the camera
// pole adds one small pooled light (red LED) and nothing else.
import { ConeGeometry, CylinderGeometry, Matrix4, SphereGeometry, Vector3 } from 'three';
import type { MittePropKind, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';

type RGB = readonly [number, number, number];
const KINDS: ReadonlySet<string> = new Set<MittePropKind>(['tent', 'beerTable', 'speaker', 'camPole']);
const TARPS: RGB[] = [[0.42, 0.5, 0.36], [0.55, 0.5, 0.4], [0.35, 0.42, 0.5], [0.6, 0.36, 0.3]];

/** Ridge tent: two sloped tarp sides on a pole frame, a darker patch, guy lines, the front flap half open. */
function tent(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, s = p.size, L = 2.6 * s, W = 2.1 * s, H = 1.45 * s, tint = rng.pick(TARPS), half = W / 2;
  const slope = Math.atan2(H, half), side = Math.hypot(half, H);
  for (const sz of [-1, 1]) b.box(m.tarp, at(p, 0, H / 2, (sz * half) / 2, sz * (Math.PI / 2 - slope)), L, side, 0.03, tint);
  // A patch sewn on one side and dirt along the hem.
  b.box(m.tarp, at(p, rng.range(-L / 4, L / 4), H * 0.45, half * 0.5 + 0.02, Math.PI / 2 - slope), 0.7 * s, 0.6 * s, 0.035, [tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.55]);
  for (const sz of [-1, 1]) b.box(m.tarp, at(p, 0, 0.08, sz * (half - 0.05)), L, 0.16, 0.04, [0.25, 0.22, 0.18]);
  for (const sx of [-1, 1]) b.box(m.iron, at(p, sx * (L / 2 - 0.05), H / 2, 0), 0.04, H, 0.04, [0.5, 0.5, 0.5]);
  b.box(m.iron, at(p, 0, H, 0), L + 0.1, 0.04, 0.04, [0.5, 0.5, 0.5]);
  // Back gable closed, front gable a dark opening with the flap folded aside.
  const gable = (x: number, tintG: RGB): void => {
    for (let k = 0; k < 4; k++) {
      const y = (k + 0.5) * (H / 4), w = W * (1 - (k + 0.5) / 4);
      b.box(m.tarp, at(p, x, y, 0), 0.03, H / 4, w, tintG);
    }
  };
  gable(-L / 2, tint);
  gable(L / 2, [0.08, 0.08, 0.08]);
  b.box(m.tarp, at(p, L / 2 + 0.1, H * 0.35, half * 0.45, 0, 0.5), 0.03, H * 0.7, half * 0.7, tint);
  for (const sz of [-1, 1]) b.box(m.iron, at(p, L / 2 + 0.35, H * 0.5, sz * 0.15, sz * 0.6, 0, -0.9), 0.012, 1.3 * s, 0.012, [0.7, 0.7, 0.65]);
  b.shadowBox(at(p, 0, H / 2, 0), L, H, W * 0.8);
}

/** Beer set: table and two benches, one slat broken, bottles and a candle stump on the table. */
function beerTable(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, wood: RGB = [0.75, 0.6, 0.42];
  b.box(m.wood, at(p, 0, 0.76, 0), 2.2, 0.05, 0.6, wood);
  for (const sx of [-0.85, 0.85]) b.box(m.iron, at(p, sx, 0.38, 0), 0.04, 0.74, 0.5, [0.35, 0.35, 0.36]);
  const broken = rng.int(2);
  for (const [k, sz] of [[0, -0.6], [1, 0.6]] as const) {
    if (k === broken) {
      // Snapped in the middle: two halves sagging to the ground.
      for (const sx of [-1, 1]) b.box(m.wood, at(p, sx * 0.55, 0.28, sz, 0, 0, -sx * 0.32), 1.1, 0.04, 0.25, wood);
    } else b.box(m.wood, at(p, 0, 0.46, sz), 2.2, 0.04, 0.25, wood);
    for (const sx of [-0.85, 0.85]) b.box(m.iron, at(p, sx, 0.23, sz), 0.04, 0.44, 0.2, [0.35, 0.35, 0.36]);
  }
  for (let i = 0; i < 2 + rng.int(3); i++) {
    const x = rng.range(-0.9, 0.9), z = rng.range(-0.2, 0.2);
    if (rng.next() < 0.3) b.geo(m.lampGlass, new CylinderGeometry(0.035, 0.035, 0.22, 6), at(p, x, 0.79, z, Math.PI / 2, rng.range(0, 6)), [0.3, 0.45, 0.25]);
    else b.geo(m.lampGlass, new CylinderGeometry(0.035, 0.035, 0.24, 6), at(p, x, 0.9, z), [0.35, 0.5, 0.28]);
  }
}

/** Speaker stack: two cabinets, the top one tilted, a torn cone, cables on the ground. */
function speaker(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, s = p.size, cab: RGB = [0.18, 0.18, 0.2];
  b.box(m.iron, at(p, 0, 0.45 * s, 0), 0.85 * s, 0.9 * s, 0.75 * s, cab);
  b.box(m.iron, at(p, rng.range(-0.05, 0.05), 1.3 * s, 0.02, 0, rng.range(-0.15, 0.15), rng.range(-0.06, 0.06)), 0.75 * s, 0.8 * s, 0.65 * s, cab);
  for (const [y, r] of [[0.45, 0.3], [1.32, 0.24]] as const) {
    b.geo(m.rubber, new ConeGeometry(r * s, 0.12 * s, 12, 1, true), at(p, 0, y * s, (y < 1 ? 0.38 : 0.34) * s, -Math.PI / 2), [0.1, 0.1, 0.1]);
    b.geo(m.iron, new SphereGeometry(0.06 * s, 6, 4), at(p, 0, y * s, (y < 1 ? 0.4 : 0.36) * s), [0.35, 0.35, 0.38]);
  }
  // The torn cone: a dark slit on the lower driver.
  b.box(m.rubber, at(p, 0.08 * s, 0.4 * s, 0.4 * s, 0, 0, 0.7), 0.04, 0.32 * s, 0.01, [0.02, 0.02, 0.02]);
  for (let i = 0; i < 2; i++) b.box(m.rubber, at(p, rng.range(-0.6, 0.6), 0.02, rng.range(0.4, 1.2), 0, rng.range(0, 3)), 1.2, 0.03, 0.03, [0.08, 0.08, 0.08]);
  b.shadowBox(at(p, 0, 0.85 * s, 0), 0.85 * s, 1.7 * s, 0.75 * s);
}

/** Surveillance camera on a slightly bent 4.2 m pole, a red LED that still blinks. Faces local +z. */
function camPole(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, lean = rng.range(0.02, 0.06);
  b.geo(m.iron, new CylinderGeometry(0.06, 0.09, 4.2, 6), at(p, 0, 2.1, 0, lean), [0.4, 0.42, 0.44]);
  const top = at(p, 0, 4.15, Math.sin(lean) * 2.1);
  b.box(m.iron, top.clone().multiply(new Matrix4().makeRotationX(0.35).setPosition(0, -0.05, 0.25)), 0.22, 0.2, 0.55, [0.85, 0.86, 0.88]);
  b.box(m.iron, top.clone().multiply(new Matrix4().makeRotationX(0.35).setPosition(0, 0.08, 0.26)), 0.28, 0.03, 0.62, [0.7, 0.72, 0.74]);
  const led = new Vector3(0, -0.04, 0.55).applyMatrix4(top);
  b.geo(m.lampGlass, new SphereGeometry(0.035, 6, 4), new Matrix4().makeTranslation(led.x, led.y, led.z), [2.2, 0.3, 0.25]);
  b.light(led, 0xff2a20, 3, 3, 0.6, 1);
}

/** Builds `p` if it belongs to this set; false otherwise. */
export function buildMitteProp(b: Builder, p: Prop, rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  switch (p.kind as MittePropKind) {
    case 'tent': tent(b, p, rng); break;
    case 'beerTable': beerTable(b, p, rng); break;
    case 'speaker': speaker(b, p, rng); break;
    case 'camPole': camPole(b, p, rng); break;
  }
  return true;
}
