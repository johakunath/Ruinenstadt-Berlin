// Detailed crates and bins (benchmark: docs/style/props-loot-benchmark.jpg). Built from boxes in one
// material each (`wood`, `bin`), with vertex colors for grime, nails, lids and wheels, so a prop is
// one batch and an instanced set stays at one draw call per kind.
import { CylinderGeometry, Matrix4 } from 'three';
import type { Rng } from '../sim/math';
import type { Builder } from './world';

type RGB = [number, number, number];
const T = (x: number, y: number, z: number): Matrix4 => new Matrix4().makeTranslation(x, y, z);
const RX = (a: number): Matrix4 => new Matrix4().makeRotationX(a);
const RY = (a: number): Matrix4 => new Matrix4().makeRotationY(a);
const RZ = (a: number): Matrix4 => new Matrix4().makeRotationZ(a);
const tint = (g: number, r = 1, b = 1): RGB => [g * r, g, g * b];

/** A planked crate about `s` meters wide: frame posts, slats on every side, a brace, a plank lid, nails. */
export function buildCrate(b: Builder, base: Matrix4, s: number, rng: Rng): void {
  const m = b.mats;
  const k = s / 0.72;
  const at = (x: number, y: number, z: number): Matrix4 => base.clone().multiply(T(x * k, y * k, z * k));
  const half = 0.36;
  // Dark core so gaps between slats read as shadow.
  b.box(m.wood, at(0, 0.36, 0), 0.64 * k, 0.64 * k, 0.64 * k, [0.34, 0.3, 0.26]);
  // Corner posts.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(m.wood, at(sx * (half - 0.04), 0.37, sz * (half - 0.04)), 0.09 * k, 0.74 * k, 0.09 * k, tint(rng.range(0.78, 0.95), 1, 0.9));
  // Slats: four sides, three boards each, slightly uneven lengths and tint.
  for (let side = 0; side < 4; side++) {
    const rot = (side * Math.PI) / 2;
    for (let i = 0; i < 3; i++) {
      const y = 0.14 + i * 0.22;
      const len = 0.6 - rng.range(0, 0.05);
      const m4 = base.clone().multiply(RY(rot)).multiply(T(rng.range(-0.02, 0.02) * k, y * k, (half + 0.004) * k)).multiply(RZ(rng.range(-0.012, 0.012)));
      b.box(m.wood, m4, len * k, 0.115 * k, 0.03 * k, tint(rng.range(0.62, 1.05), rng.range(0.95, 1.1), rng.range(0.8, 1)));
      // Nail heads at both ends of the board.
      for (const e of [-1, 1]) b.box(m.wood, m4.clone().multiply(T(e * (len / 2 - 0.045) * k, 0, 0.017 * k)), 0.026 * k, 0.026 * k, 0.012 * k, [0.1, 0.1, 0.11]);
    }
  }
  // Diagonal braces on two opposite sides.
  for (const side of [0, 2]) {
    const m4 = base.clone().multiply(RY(side * (Math.PI / 2))).multiply(T(0, 0.37 * k, (half + 0.022) * k)).multiply(RZ(0.78));
    b.box(m.wood, m4, 0.8 * k, 0.075 * k, 0.026 * k, [1.05, 0.98, 0.88]);
  }
  // Lid: five planks and a crossbar.
  for (let i = 0; i < 5; i++) {
    b.box(m.wood, at((i - 2) * 0.132, 0.735, 0).multiply(RY(rng.range(-0.01, 0.01))), 0.122 * k, 0.04 * k, 0.7 * k, tint(rng.range(0.7, 1.05), rng.range(0.95, 1.1), rng.range(0.8, 1)));
  }
  b.box(m.wood, at(0, 0.775, 0.0).multiply(RY(0.0)), 0.7 * k, 0.03 * k, 0.1 * k, [0.8, 0.72, 0.62]);
  // Grime band at the foot.
  b.box(m.wood, at(0, 0.03, 0), 0.7 * k, 0.07 * k, 0.7 * k, [0.3, 0.27, 0.23]);
}

const WHEEL = new CylinderGeometry(0.1, 0.1, 0.05, 10);

/** A BSR wheelie bin: tapered body (three stacked sections), ribs, orange lid with handle, two wheels, torn sticker. */
export function buildBin(b: Builder, base: Matrix4, rng: Rng, tilt = 0): void {
  const m = b.mats;
  const at = (x: number, y: number, z: number): Matrix4 => base.clone().multiply(T(x, y, z));
  const grime = rng.range(0.8, 1.05);
  const body = [
    { y: 0.2, w: 0.5, d: 0.58, h: 0.36, c: 0.7 },
    { y: 0.55, w: 0.57, d: 0.65, h: 0.36, c: 0.9 },
    { y: 0.9, w: 0.63, d: 0.72, h: 0.36, c: 1 },
  ];
  for (const p of body) b.box(m.bin, at(0, p.y, 0), p.w, p.h, p.d, tint(p.c * grime, 0.95, 1));
  // Vertical ribs on the front and dark seams between the sections.
  for (const x of [-0.2, 0, 0.2]) b.box(m.bin, at(x, 0.58, 0.36), 0.045, 0.8, 0.03, tint(0.55 * grime));
  for (const y of [0.38, 0.73]) b.box(m.bin, at(0, y, 0.01), 0.66, 0.025, 0.74, tint(0.35));
  // Lid: orange, hinged at the back so a hit pops it open.
  const lid = base.clone().multiply(T(0, 1.1, -0.36)).multiply(RX(-0.06 - tilt)).multiply(T(0, 0.02, 0.38));
  b.box(m.bin, lid, 0.7, 0.07, 0.78, [2.1, 1.05, 0.28]);
  b.box(m.bin, lid.clone().multiply(T(0, 0.05, 0.3)), 0.34, 0.035, 0.06, [0.25, 0.25, 0.27]);
  // Sticker, torn, off to one side.
  b.box(m.bin, at(0.1, 0.62, 0.372), 0.24, 0.17, 0.008, [2.0, 1.9, 1.5]);
  b.box(m.bin, at(0.07, 0.6, 0.376), 0.1, 0.07, 0.006, [0.4, 0.8, 0.45]);
  // Two wheels at the back foot.
  for (const x of [-0.24, 0.24]) b.geo(m.bin, WHEEL, at(x, 0.1, -0.3).multiply(RZ(Math.PI / 2)), [0.12, 0.12, 0.13]);
  // Axle.
  b.box(m.bin, at(0, 0.1, -0.3), 0.5, 0.03, 0.03, [0.2, 0.2, 0.22]);
}
