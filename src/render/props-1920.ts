// M16 Charlottenburg step 7, variant V-A (`docs/mockups/m16-charlottenburg-lots.svg`): the 1920 vehicles
// that replace today's car, bus and tram props on this map (`setPropEra`). Same footprints as the modern
// props, so colliders, placement and wreck spots stay: car 1.8 × 4.4 m (long side local z), bus 2.5 × 11 m,
// tram 2.3 × 15 m. Built from the shared materials (car paint, glass, rubber, iron, wood), no new material.
// Triangles: car about 500, bus about 700, tram about 900 (less than the modern props).
import { CylinderGeometry, Euler, Matrix4 } from 'three';
import type { Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';
import type { RGB } from './landmarks';

/** 1920 paints: black, bottle green, oxblood, navy, a cream two-tone; cabs black with a yellow belt (unverified detail). */
const PAINT: RGB[] = [[0.16, 0.16, 0.17], [0.16, 0.3, 0.22], [0.42, 0.14, 0.12], [0.16, 0.2, 0.34], [0.2, 0.2, 0.2]];
const CREAM: RGB = [1.15, 1.08, 0.86];
const BROWN: RGB = [0.36, 0.22, 0.14];
const YELLOW: RGB = [1.25, 0.95, 0.3];
const BRASS: RGB = [1.1, 0.85, 0.4];

const wheelGeo = new CylinderGeometry(0.4, 0.4, 0.12, 14);
const hubGeo = new CylinderGeometry(0.12, 0.12, 0.16, 8);
const lampGeo = new CylinderGeometry(0.11, 0.11, 0.14, 10);
const across = new Matrix4().makeRotationZ(Math.PI / 2);

/** Spoked wheel at local (x, z) of frame f: rim, hub and four flat spokes; `flat` sinks it. */
function wheel(b: Builder, f: Matrix4, x: number, z: number, flat: boolean, r = 0.4): void {
  const m = b.mats, y = flat ? r - 0.08 : r, s = r / 0.4;
  const w = f.clone().multiply(new Matrix4().makeTranslation(x, y, z)).multiply(new Matrix4().makeScale(s, s, s));
  b.geo(m.rubber, wheelGeo, w.clone().multiply(across));
  b.geo(m.iron, hubGeo, w.clone().multiply(across), [0.8, 0.8, 0.75]);
  for (let i = 0; i < 4; i++) b.box(m.wood, w.clone().multiply(new Matrix4().makeRotationX((i * Math.PI) / 4)), 0.05, 0.62, 0.05, [0.7, 0.55, 0.4]);
}

/** Car: droschke (cab), limousine or tourer (open, hood folded). Long bonnet, upright radiator, separate fenders, running boards. */
export function buildCar1920(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  const kind = rng.pick(['droschke', 'limousine', 'limousine', 'tourer'] as const);
  const burnt = rng.next() < 0.12;
  const f = at(p, 0, 0, 0, 0, rng.range(-0.08, 0.08), rng.range(-0.03, 0.03));
  const P = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Matrix4 => f.clone().multiply(new Matrix4().makeTranslation(x, y, z)).multiply(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz)));
  const body = burnt ? m.rust : m.carPaint;
  const paint: RGB = burnt ? [0.4, 0.3, 0.25] : kind === 'droschke' ? PAINT[0]! : rng.pick(PAINT);
  // Chassis and running boards.
  b.box(m.iron, P(0, 0.42, 0), 1.2, 0.12, 4.1, [0.4, 0.4, 0.4]);
  for (const s of [-1, 1]) b.box(m.wood, P(s * 0.78, 0.36, -0.1), 0.32, 0.05, 1.9, [0.35, 0.3, 0.26]);
  // Bonnet in front (+z), radiator with a brass shell.
  b.box(body, P(0, 0.85, 1.35), 1.0, 0.62, 1.5, paint);
  b.box(m.enamel, P(0, 0.9, 2.12), 0.86, 0.74, 0.1, burnt ? [0.3, 0.3, 0.3] : BRASS);
  b.box(m.dark, P(0, 0.9, 2.17), 0.66, 0.56, 0.02);
  // Fenders: front and rear arches over the wheels, joined by the running boards.
  for (const s of [-1, 1]) {
    b.box(body, P(s * 0.72, 0.82, 1.55, -0.35, 0, 0), 0.3, 0.06, 0.9, paint);
    b.box(body, P(s * 0.72, 0.82, -1.45, 0.35, 0, 0), 0.3, 0.06, 0.9, paint);
  }
  // Cabin: tall box behind the bonnet, windows, roof; the tourer is open with a folded hood.
  if (kind === 'tourer') {
    b.box(body, P(0, 1.02, -0.55), 1.36, 0.6, 2.2, paint);
    b.box(m.wood, P(0, 1.26, -0.2), 1.2, 0.08, 1.5, [0.32, 0.22, 0.16]);
    b.box(m.rubber, P(0, 1.42, -1.6, 0.2, 0, 0), 1.3, 0.3, 0.5, [0.5, 0.48, 0.44]);
    b.box(m.carGlass, P(0, 1.55, 0.55, -0.15, 0, 0), 1.1, 0.5, 0.03, [1, 1, 1]);
  } else {
    b.box(body, P(0, 1.0, -0.55), 1.4, 0.56, 2.3, paint);
    b.box(body, P(0, 1.62, -0.6), 1.36, 0.7, 2.0, paint);
    const glass = burnt ? m.dark : m.carGlass;
    for (const s of [-1, 1]) for (const z of [-0.05, -0.95]) b.box(glass, P(s * 0.685, 1.64, z), 0.02, 0.46, 0.66, [1, 1, 1]);
    b.box(glass, P(0, 1.64, 0.41), 1.1, 0.46, 0.02, [1, 1, 1]);
    b.box(body, P(0, 2.0, -0.6), 1.44, 0.07, 2.1, kind === 'droschke' ? [0.12, 0.12, 0.12] : paint);
    // The cab: a yellow belt below the windows and a taxi lamp on the roof.
    if (kind === 'droschke' && !burnt) {
      for (const s of [-1, 1]) b.box(m.enamel, P(s * 0.71, 1.3, -0.55), 0.02, 0.1, 2.28, YELLOW);
      b.box(m.enamel, P(0, 2.12, 0.2), 0.36, 0.16, 0.18, YELLOW);
    }
  }
  // Headlamps on stalks, spare wheel at the back.
  for (const s of [-1, 1]) b.geo(m.enamel, lampGeo, P(s * 0.48, 1.25, 2.05, Math.PI / 2, 0, 0), burnt ? [0.3, 0.3, 0.3] : BRASS);
  wheel(b, f.clone().multiply(new Matrix4().makeTranslation(0, 0.55, -2.15)).multiply(new Matrix4().makeRotationY(Math.PI / 2)), 0, 0, false, 0.36);
  const flat = (): boolean => burnt || rng.next() < 0.25;
  for (const s of [-1, 1]) for (const z of [1.45, -1.45]) wheel(b, f, s * 0.72, z, flat());
  b.shadowBox(P(0, 1.0, 0), 1.6, 2.0, 4.3);
}

/** Open-top double-deck bus (ABOAG kind): lower saloon, open upper deck with benches and rail, stair at the back. */
export function buildBus1920(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats, L = 9.6, W = 2.3;
  const f = at(p, 0, 0, 0, 0.01, 0, rng.range(-0.03, 0.03));
  const P = (x: number, y: number, z: number): Matrix4 => f.clone().multiply(new Matrix4().makeTranslation(x, y, z));
  const paint: RGB = rng.next() < 0.5 ? CREAM : [1.0, 0.8, 0.45];
  // Bonnet and cab in front, the saloon, the open deck.
  b.box(m.carPaint, P(0, 0.95, L / 2 - 0.6), 1.3, 0.8, 1.2, BROWN);
  b.box(m.carPaint, P(0, 1.35, 0.4), W, 1.9, L - 2.4, paint);
  b.box(m.carPaint, P(0, 0.55, 0.4), W + 0.05, 0.3, L - 2.4, BROWN);
  for (let z = -L / 2 + 2; z < L / 2 - 2; z += 1.0) for (const s of [-1, 1]) b.box(m.carGlass, P(s * (W / 2 + 0.01), 1.65, z + 0.4), 0.02, 0.7, 0.75, [1, 1, 1]);
  b.box(m.wood, P(0, 2.33, 0), W, 0.06, L - 1.2, [0.55, 0.42, 0.3]);
  for (let z = -L / 2 + 1.4; z < L / 2 - 1; z += 0.9) b.box(m.wood, P(0, 2.6, z), W - 0.5, 0.08, 0.35, [0.5, 0.36, 0.24]);
  for (const s of [-1, 1]) {
    b.box(m.iron, P(s * (W / 2 - 0.05), 3.0, 0), 0.05, 0.05, L - 1.2, [0.5, 0.5, 0.5]);
    for (let z = -L / 2 + 0.7; z < L / 2 - 0.5; z += 1.2) b.box(m.iron, P(s * (W / 2 - 0.05), 2.68, z), 0.04, 0.66, 0.04, [0.5, 0.5, 0.5]);
    // Advertising boards along the upper deck.
    b.box(m.enamel, P(s * (W / 2 + 0.02), 2.6, 0), 0.03, 0.5, L - 2.4, rng.pick([[0.9, 0.2, 0.2], [0.2, 0.3, 0.6], [1.1, 0.9, 0.4]] as RGB[]));
  }
  // The outside stair at the back.
  for (let i = 0; i < 6; i++) b.box(m.iron, P(-0.6 + i * 0.12, 0.5 + i * 0.32, -L / 2 + 0.3), 0.5, 0.05, 0.3, [0.45, 0.45, 0.45]);
  for (const z of [L / 2 - 1.3, -L / 2 + 1.6]) for (const s of [-1, 1]) wheel(b, f, s * (W / 2 - 0.15), z, rng.next() < 0.2, 0.5);
  b.shadowBox(P(0, 1.55, 0), W, 3.1, L);
}

/** Two-axle tram with its trailer: open end platforms, clerestory roof, trolley pole; cream over brown. */
export function buildTram1920(b: Builder, p: Prop, rng: Rng, deck: number): void {
  const m = b.mats, W = 2.1, C = 7.0;
  const f = at(p, 0, deck, 0);
  const P = (x: number, y: number, z: number): Matrix4 => f.clone().multiply(new Matrix4().makeTranslation(x, y, z));
  for (const c of [-1, 1]) {
    const z0 = c * (C / 2 + 0.25);
    b.box(m.carPaint, P(0, 0.95, z0), W, 1.0, C - 1.6, BROWN);
    b.box(m.carPaint, P(0, 1.95, z0), W, 1.0, C - 1.6, CREAM);
    for (let z = z0 - C / 2 + 1.2; z < z0 + C / 2 - 1; z += 0.8) for (const s of [-1, 1]) b.box(m.carGlass, P(s * (W / 2 + 0.01), 1.95, z), 0.02, 0.7, 0.6, [1, 1, 1]);
    // Open platforms with a dash panel at each end, roof with clerestory.
    for (const e of [-1, 1]) {
      b.box(m.wood, P(0, 0.5, z0 + e * (C / 2 - 0.4)), W - 0.2, 0.08, 0.8, [0.4, 0.3, 0.22]);
      b.box(m.carPaint, P(0, 0.95, z0 + e * (C / 2 - 0.05)), W - 0.3, 0.9, 0.06, CREAM);
    }
    b.box(m.carPaint, P(0, 2.5, z0), W + 0.1, 0.1, C, [0.3, 0.28, 0.26]);
    b.box(m.carPaint, P(0, 2.7, z0), W * 0.5, 0.3, C - 2, [0.32, 0.3, 0.28]);
    for (const z of [z0 - 1.5, z0 + 1.5]) for (const s of [-1, 1]) wheel(b, f, s * 0.72, z, false, 0.38);
  }
  // Trolley pole on the motor car, folded down.
  b.box(m.iron, P(0, 3.05, C / 2 - 1), 0.05, 0.05, 3.6, [0.5, 0.5, 0.5]);
  if (rng.next() < 0.3) b.box(m.rust, P(0.4, 0.2, -C), 0.6, 0.4, 0.5);
  b.shadowBox(P(0, 1.5, 0), W, 3.0, 2 * C);
}
