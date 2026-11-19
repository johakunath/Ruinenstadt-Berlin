// M11d landmarks of Köpenick, built in code from reference photos (Wikimedia Commons, 2026-11-17):
// Rathaus, Schloss, St. Laurentius, S-Bahnhof, Müggelturm, Spreepark Riesenrad and the fallen dinosaurs.
// The game camera (18.5 m, 44°) shows about 6 m of height at the hero, so each building carries its
// recognizable cues low (portal, statue, arches, lettering, roof shapes seen from above); towers and
// the wheel keep real proportions for zoomed-out views and the minimap.
import { BufferAttribute, BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Material } from 'three';
import type { Landmark } from '../data/map';
import { Rng } from '../sim/math';
import type { ChunkBuilder } from './map-world';

export type RGB = readonly [number, number, number];
export type Frame = (x: number, y: number, z: number, ry?: number, rx?: number, rz?: number) => Matrix4;

/** Local frame of a landmark: x right along the main front, z out of the front, y up. */
export function frameOf(l: Landmark): Frame {
  const base = new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0, l.z);
  return (x, y, z, ry = 0, rx = 0, rz = 0) => base.clone().multiply(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z));
}

function worldPt(l: Landmark, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyMatrix4(new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0, l.z));
}

/** Sub-frame: `m` then offset (x, y, z) and rotation. */
export function sub(m: Matrix4, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): Matrix4 {
  return m.clone().multiply(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z));
}

const cache = new Map<string, BufferGeometry>();
export function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

// Face masks for `frustum`.
export const FRONT = 1, RIGHT = 2, BACK = 4, LEFT = 8, TOP = 16;
export const SLOPES = FRONT | BACK;
export const ENDS = LEFT | RIGHT;
export const ALL = FRONT | RIGHT | BACK | LEFT | TOP;

/**
 * A frustum from a w × d base (y = 0) to a tw × td top (y = h). Hip roof: tw = w − d, td = 0; gable
 * (ridge along x): tw = w, td = 0; pyramid: 0, 0; mansard: smaller rectangle plus TOP.
 */
export function frustum(w: number, d: number, h: number, tw: number, td: number, faces = ALL): BufferGeometry {
  return cached(`f${w.toFixed(2)},${d.toFixed(2)},${h.toFixed(2)},${tw.toFixed(2)},${td.toFixed(2)},${faces}`, () => {
    const A = [-w / 2, 0, d / 2], B = [w / 2, 0, d / 2], C = [w / 2, 0, -d / 2], D = [-w / 2, 0, -d / 2];
    const a = [-tw / 2, h, td / 2], b = [tw / 2, h, td / 2], c = [tw / 2, h, -td / 2], dd = [-tw / 2, h, -td / 2];
    const pos: number[] = [];
    const uv: number[] = [];
    const slope = (dz: number): number => Math.hypot(h, dz);
    const tri = (p: number[][], u: number[][]): void => {
      const [p0, p1, p2] = p as [number[], number[], number[]];
      const ex = [p1[0]! - p0[0]!, p1[1]! - p0[1]!, p1[2]! - p0[2]!], ey = [p2[0]! - p0[0]!, p2[1]! - p0[1]!, p2[2]! - p0[2]!];
      const cx = ex[1]! * ey[2]! - ex[2]! * ey[1]!, cy = ex[2]! * ey[0]! - ex[0]! * ey[2]!, cz = ex[0]! * ey[1]! - ex[1]! * ey[0]!;
      if (Math.hypot(cx, cy, cz) < 1e-6) return;
      for (const q of p) pos.push(...q);
      for (const q of u) uv.push(...q);
    };
    // UVs: horizontal meters / 3 along the eave, slope meters / 3 up the face.
    const quad = (p0: number[], p1: number[], p2: number[], p3: number[], along: 0 | 2, len: number): void => {
      const U = (p: number[]): number[] => [p[along]! / 3, (p[1]! / Math.max(h, 1e-3)) * len / 3];
      tri([p0, p1, p2], [U(p0), U(p1), U(p2)]);
      tri([p0, p2, p3], [U(p0), U(p2), U(p3)]);
    };
    if (faces & FRONT) quad(A, B, b, a, 0, slope((d - td) / 2));
    if (faces & RIGHT) quad(B, C, c, b, 2, slope((w - tw) / 2));
    if (faces & BACK) quad(C, D, dd, c, 0, slope((d - td) / 2));
    if (faces & LEFT) quad(D, A, a, dd, 2, slope((w - tw) / 2));
    if (faces & TOP && tw > 0 && td > 0) {
      const U = (p: number[]): number[] => [p[0]! / 3, p[2]! / 3];
      tri([a, b, c], [U(a), U(b), U(c)]);
      tri([a, c, dd], [U(a), U(c), U(dd)]);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    g.computeVertexNormals();
    return g;
  });
}

/** A box between two local points (a beam, leg or spoke) with section sx × sz. */
function beam(b: ChunkBuilder, mat: Material, F: Frame, a: Vector3, c: Vector3, sx: number, sz: number, color?: RGB): void {
  const d = c.clone().sub(a);
  const len = d.length();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  const mid = a.clone().add(c).multiplyScalar(0.5);
  b.box(mat, F(mid.x, mid.y, mid.z).multiply(new Matrix4().makeRotationFromQuaternion(q)), sx, len, sz, color);
}

/** A window pane centered on `m` (wall plane, z out) from the shared window atlas, with a light trim. */
export function pane(b: ChunkBuilder, m: Matrix4, w: number, h: number, rng: Rng, lit: number, trim?: { mat: Material; color: RGB }): void {
  const cell = rng.next() < lit ? rng.int(4) : 4 + rng.int(4);
  const cu = (cell % 4) / 4;
  const cv = cell < 4 ? 0.5 : 0;
  const p = (x: number, y: number): Vector3 => new Vector3(x, y, 0.04).applyMatrix4(m);
  if (!b.wearWindow(m, w, h)) b.solid.of(b.mm.windows).quad([p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)], [cu, cv, cu + 0.25, cv + 0.5]);
  if (!trim) return;
  b.box(trim.mat, sub(m, -w / 2 - 0.08, 0, 0.05), 0.16, h, 0.12, trim.color);
  b.box(trim.mat, sub(m, w / 2 + 0.08, 0, 0.05), 0.16, h, 0.12, trim.color);
  b.box(trim.mat, sub(m, 0, h / 2 + 0.08, 0.06), w + 0.32, 0.16, 0.14, trim.color);
  b.box(trim.mat, sub(m, 0, -h / 2 - 0.06, 0.1), w + 0.4, 0.12, 0.22, trim.color);
}

/** Round (`round`) or pointed head over an opening of width w whose top edge is at `m` (z out). */
export function archHead(b: ChunkBuilder, mat: Material, m: Matrix4, w: number, pointed: boolean, z = 0.045, color?: RGB): void {
  // Pointed: a two-segment half circle is a triangle with apex height w / 2, stretched to a lancet.
  const g = cached(`${pointed ? 'pt' : 'semi'}${w.toFixed(2)}`, () => new CircleGeometry(w / 2, pointed ? 2 : 12, 0, Math.PI));
  b.geo(mat, g, pointed ? sub(m, 0, 0, z).multiply(new Matrix4().makeScale(1, 1.35, 1)) : sub(m, 0, 0, z), color);
}

/** An arched window: pane plus a dark head. */
export function archWindow(b: ChunkBuilder, m: Matrix4, w: number, h: number, rng: Rng, lit: number, pointed: boolean, rim?: { mat: Material; color: RGB }): void {
  if (rim) {
    b.box(rim.mat, sub(m, 0, -0.05, 0), w + 0.36, h + 0.1, 0.05, rim.color);
    archHead(b, rim.mat, sub(m, 0, h / 2, 0), w + 0.36, pointed, 0.03, rim.color);
  }
  pane(b, m, w, h, rng, lit);
  archHead(b, b.mm.dark, sub(m, 0, h / 2, 0), w, pointed, 0.05);
}

/** Bronze-looking cast figure tint and a few shared colors. */
const BRONZE: RGB = [1.25, 1.1, 0.82];
const WHITE: RGB = [1.5, 1.46, 1.36];
const GLAZE: RGB = [0.3, 0.62, 0.48];

// ---------------------------------------------------------------- Rathaus

/**
 * Pinnacled show gable (Schaugiebel) of the Märkische Backsteingotik: brick piers rising to the
 * middle, each with a slate pinnacle, white blind niches between them. Frame `m`: bottom center at
 * the eave, x along the wall, z out.
 */
function showGable(b: ChunkBuilder, m: Matrix4, w: number, h: number, brick: RGB, rose: boolean): void {
  const M = b.mm;
  const masonry = M.landmarkFinishes?.brick ?? M.brick;
  const n = 5;
  const tops: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = (t - 0.5) * (w - 0.7);
    const top = h * (0.38 + 0.62 * (1 - Math.abs(t - 0.5) * 2));
    tops.push(top);
    b.box(masonry, sub(m, x, top / 2, 0.1), 0.7, top, 0.8, brick);
    if (!M.landmarkWear || i !== 1) b.geo(M.slate, frustum(0.8, 0.8, 1.5, 0, 0), sub(m, x, top, 0.1), [0.85, 0.95, 0.9]);
    else b.box(masonry, sub(m, x, top + 0.15, 0.1, 0, 0, -0.22), 0.62, 0.36, 0.56, [0.71, 0.65, 0.61]);
  }
  for (let i = 0; i < n - 1; i++) {
    const x0 = (i / (n - 1) - 0.5) * (w - 0.7), x1 = ((i + 1) / (n - 1) - 0.5) * (w - 0.7);
    const top = Math.min(tops[i]!, tops[i + 1]!) - 0.3;
    const cx = (x0 + x1) / 2, gw = x1 - x0 - 0.7;
    b.box(masonry, sub(m, cx, top / 2, -0.05), gw + 0.1, top, 0.6, brick);
    // A small brick gablet crowning each bay, then the white blind niche below it.
    b.geo(masonry, frustum(gw + 0.1, 0.6, Math.min(1.4, gw * 0.7), 0, 0, SLOPES | ENDS), sub(m, cx, top, -0.05), brick);
    b.box(M.stucco, sub(m, cx, top / 2 + 0.2, 0.26), gw * 0.62, Math.max(0.4, top - 1.4), 0.05, WHITE);
    archHead(b, M.stucco, sub(m, cx, top - 0.5, 0.24), gw * 0.62, true, 0.04, WHITE);
  }
  if (rose) {
    const y = h * 0.7;
    b.geo(M.stucco, cached('roseRim', () => new TorusGeometry(0.75, 0.11, 6, 18)), sub(m, 0, y, 0.52), WHITE);
    b.geo(M.dark, cached('roseDisc', () => new CircleGeometry(0.7, 18)), sub(m, 0, y, 0.51));
    for (let k = 0; k < 4; k++) b.box(M.stucco, sub(m, 0, y, 0.53, 0, 0, (k * Math.PI) / 4), 1.4, 0.06, 0.03, WHITE);
  }
}

/** The Hauptmann von Köpenick (bronze, Spartak Babajan 1996): peaked cap, greatcoat, sabre at the hip. */
function hauptmann(b: ChunkBuilder, m: Matrix4): void {
  const M = b.mm;
  b.box(M.concrete, sub(m, 0, 0.12, 0), 1.0, 0.24, 1.0, [0.62, 0.6, 0.56]);
  const s = 1.12;
  const f = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Matrix4 => sub(m, x * s, 0.24 + y * s, z * s, ry, rx, rz);
  const cyl = (r0: number, r1: number, h: number, seg = 8): BufferGeometry => cached(`hm${r0},${r1},${h},${seg}`, () => new CylinderGeometry(r0, r1, h, seg));
  for (const x of [-0.12, 0.12]) b.geo(M.iron, cyl(0.075, 0.085, 0.42), f(x, 0.21, 0.02), BRONZE);
  // Greatcoat to below the knees, flared, and the chest.
  b.geo(M.iron, cyl(0.24, 0.36, 0.95, 10), f(0, 0.86, 0), BRONZE);
  b.geo(M.iron, cyl(0.21, 0.24, 0.42, 10), f(0, 1.5, 0), BRONZE);
  b.box(M.iron, f(0, 1.68, 0), 0.6, 0.12, 0.3, BRONZE);
  // Arms: the right hangs, the left rests on the sabre hilt.
  b.geo(M.iron, cyl(0.06, 0.07, 0.62), f(0.31, 1.36, 0.02, 0, 0, 0.12), BRONZE);
  b.geo(M.iron, cyl(0.06, 0.07, 0.5), f(-0.3, 1.4, 0.08, -0.5, 0, -0.25), BRONZE);
  b.box(M.iron, f(-0.33, 0.8, 0.18, 0.25, 0, 0.2), 0.04, 0.95, 0.05, BRONZE);
  b.box(M.iron, f(-0.36, 1.25, 0.22), 0.14, 0.04, 0.08, BRONZE);
  // Head, collar, peaked cap.
  b.geo(M.iron, cyl(0.08, 0.1, 0.12), f(0, 1.78, 0), BRONZE);
  b.geo(M.iron, cached('hmHead', () => new SphereGeometry(0.12, 10, 8)), f(0, 1.92, 0.01), BRONZE);
  b.geo(M.iron, cyl(0.135, 0.12, 0.09, 10), f(0, 2.05, 0), BRONZE);
  b.box(M.iron, f(0, 2.01, 0.13, 0.25), 0.2, 0.02, 0.1, BRONZE);
}

function rathaus(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const masonry = M.landmarkFinishes?.brick ?? M.brick;
  const F = frameOf(l);
  const rng = new Rng(1905);
  const BR: RGB = [1.12, 0.68, 0.54];
  const BR2: RGB = [1.25, 0.82, 0.64];
  const H = 11.5;
  const front = 12.5;
  const old = { mat: masonry, color: BR2 };
  const ext = { mat: M.stucco, color: WHITE };
  // Wings around a courtyard: the old part (slate) along the street and Rosenstraße, the 1926
  // extension (tiles) toward the Grünstraße and at the back.
  const wings: Array<{ x0: number; x1: number; z0: number; z1: number; slate: boolean; alongX: boolean }> = [
    { x0: -13, x1: 13, z0: 4, z1: front, slate: true, alongX: true },
    { x0: -13, x1: -5, z0: -15, z1: 4, slate: true, alongX: false },
    { x0: 5, x1: 13, z0: -15, z1: 4, slate: false, alongX: false },
    { x0: -5, x1: 5, z0: -15, z1: -8, slate: false, alongX: true },
  ];
  for (const w of wings) {
    const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, sx = w.x1 - w.x0, sz = w.z1 - w.z0;
    b.box(masonry, F(cx, H / 2, cz), sx, H, sz, BR);
    b.box(M.concrete, F(cx, 0.45, cz), sx + 0.14, 0.9, sz + 0.14, [0.5, 0.48, 0.46]);
    b.box(M.enamel, F(cx, 4.4, cz), sx + 0.1, 0.26, sz + 0.1, GLAZE);
    b.box(masonry, F(cx, H - 0.2, cz), sx + 0.36, 0.4, sz + 0.36, BR2);
    const [rw, rd, ry] = w.alongX ? [sx, sz, 0] : [sz, sx, Math.PI / 2];
    const rh = rd * 0.72;
    const roofMat = w.slate ? M.slate : M.roof;
    b.geo(roofMat, frustum(rw + 0.7, rd + 0.7, rh + 0.25, rw + 0.7, 0, SLOPES), F(cx, H - 0.25, cz, ry), w.slate ? undefined : [1.05, 0.82, 0.72]);
    b.geo(masonry, frustum(rw, rd, rh, rw, 0, ENDS), F(cx, H, cz, ry), BR);
    b.shadowBox(F(cx, (H + rh / 2) / 2, cz), sx, H + rh / 2, sz);
  }
  // Chimneys on the ridges.
  for (const [x, z] of [[-9, 8], [9, 8], [-9, -9], [9, -6]] as const) b.box(masonry, F(x, H + 5.6, z), 0.8, 2.2, 0.8, BR);
  // Courtyard paving.
  b.box(M.cobbles, F(0, 0.04, -2), 10, 0.08, 12, [0.6, 0.56, 0.52]);

  // Windows. Old part: round-arched ground floor, pointed-arch upper floors; extension: white-framed.
  const row = (m: Matrix4, from: number, to: number, skip: (s: number, y: number) => boolean, oldStyle: boolean): void => {
    const bays = Math.floor((to - from) / 2.5);
    for (let k = 0; k < bays; k++) {
      const s = from + (k + 0.5) * ((to - from) / bays);
      for (const [y, h, w] of [[1.7, 2.0, 1.3], [5.6, 2.2, 1.15], [8.9, 1.8, 1.1]] as const) {
        if (skip(s, y)) continue;
        const wm = sub(m, s, y, 0);
        if (oldStyle) archWindow(b, wm, w, h, rng, 0.3, y > 3, old);
        else if (y < 3) archWindow(b, wm, w + 0.3, h + 0.3, rng, 0.2, false, ext);
        else pane(b, wm, w, h - 0.2, rng, 0.25, ext);
      }
    }
  };
  const fm = F(0, 0, front);
  row(fm, -6.4, 13, (s, y) => (Math.abs(s - 1.5) < 4.4 && y > 3) || (s < -4.6 && y < 3), true);
  // Ground floor of the show gable: an arcade of three arches.
  for (const s of [-1.3, 1.5, 4.3]) archWindow(b, sub(fm, s, 1.9, 0), 1.7, 2.4, rng, 0.5, false, old);
  // South side (toward Grünstraße and the camera): old end, then the extension.
  const sm = F(13, 0, 0, Math.PI / 2);
  row(sm, -front, -4, () => false, true);
  row(sm, -4, 15, () => false, false);
  b.geo(M.ratskeller, new PlaneGeometry(4.2, 0.4), sub(sm, 5.5, 3.45, 0.08));
  b.light(worldPt(l, 14.4, 3.2, -5.5), 0xffc070, 10, 9, 0.08, 3);
  row(F(-13, 0, 0, -Math.PI / 2), -15, front, () => false, true);
  row(F(0, 0, -15, Math.PI), -13, 13, () => false, false);

  // Main show gable over the front, its cross roof, the tall tracery window and the rose.
  const gm = F(1.5, H, front);
  showGable(b, gm, 8.6, 9, BR, true);
  b.geo(M.slate, frustum(front - 4, 8.4, 8.2, front - 4, 0, SLOPES), F(1.5, H - 0.2, (front + 4) / 2, Math.PI / 2));
  const tw = sub(fm, 1.5, 7.7, 0);
  b.box(masonry, sub(tw, 0, 0, 0.05), 4.2, 4.8, 0.1, BR2);
  archHead(b, masonry, sub(tw, 0, 2.4, 0), 4.2, true, 0.05, BR2);
  pane(b, tw, 3.4, 4.4, rng, 0.8);
  archHead(b, M.dark, sub(tw, 0, 2.2, 0), 3.4, true, 0.07);
  for (const x of [-0.85, 0, 0.85]) b.box(M.stucco, sub(tw, x, 0.6, 0.1), 0.1, 5.2, 0.06, WHITE);
  b.box(M.stucco, sub(tw, 0, 0.5, 0.1), 3.4, 0.1, 0.06, WHITE);
  // South end of the street wing: a second show gable, facing the camera.
  showGable(b, F(13, H, (front + 4) / 2, Math.PI / 2), front - 4, 7, BR, false);

  // Forecourt landing with steps along the street front, between tower and show gable.
  b.box(M.concrete, F(-5.2, 0.15, 13.8), 15, 0.3, 2.6, [0.62, 0.6, 0.56]);
  b.box(M.concrete, F(-5.2, 0.08, 14.9), 15, 0.16, 0.5, [0.66, 0.64, 0.6]);

  // Corner tower at Alt-Köpenick / Rosenstraße: brick shaft, clock stage, pinnacles, slate helm.
  const tx = -9.5, tz = 10.5, T = 6, TH = 22;
  b.box(masonry, F(tx, TH / 2, tz), T, TH, T, BR);
  b.box(M.concrete, F(tx, 0.5, tz), T + 0.16, 1, T + 0.16, [0.5, 0.48, 0.46]);
  for (const y of [4.4, 14.2]) b.box(M.enamel, F(tx, y, tz), T + 0.12, 0.28, T + 0.12, GLAZE);
  b.box(masonry, F(tx, TH, tz), T + 0.5, 0.5, T + 0.5, BR2);
  b.box(masonry, F(tx, TH + 1.9, tz), T - 0.4, 3.4, T - 0.4, BR);
  for (let k = 0; k < 4; k++) {
    const ry = (k * Math.PI) / 2;
    const face = sub(F(tx, 0, tz), 0, 0, 0, ry);
    for (const x of [-0.8, 0.8]) for (const y of [8.5, 11.8]) archWindow(b, sub(face, x, y, T / 2), 0.5, 2.2, rng, 0.15, true);
    for (const x of [-1.4, 0, 1.4]) archWindow(b, sub(face, x, 17.5, T / 2), 0.55, 2.6, rng, 0, true);
    b.geo(M.clock, cached('clock', () => new CircleGeometry(1.15, 24)), sub(face, 0, TH + 2.1, T / 2 - 0.17));
    b.geo(masonry, frustum(2.6, 0.4, 2.2, 0, 0, SLOPES | ENDS), sub(face, 0, TH + 3.6, T / 2 - 0.4), BR);
    b.geo(M.slate, frustum(0.9, 0.9, 3.4, 0, 0), sub(face, T / 2 - 0.3, TH + 0.25, T / 2 - 0.3));
  }
  b.geo(M.slate, cached('helmLow', () => new CylinderGeometry(2.3, 3.4, 3, 8)), F(tx, TH + 5.1, tz, Math.PI / 8));
  b.geo(M.slate, cached('helm', () => new ConeGeometry(2.3, 13, 8)), F(tx, TH + 13.1, tz, Math.PI / 8));
  b.geo(M.enamel, cached('finial', () => new CylinderGeometry(0.05, 0.08, 2.6, 5)), F(tx, TH + 20.5, tz), [0.9, 0.75, 0.35]);
  b.shadowBox(F(tx, (TH + 10) / 2, tz), T, TH + 10, T);
  // Main portal in the tower: deep pointed arch, coat of arms, two green lanterns.
  const pm = F(tx, 0, tz + T / 2);
  b.box(masonry, sub(pm, 0, 1.75, 0.08), 3.4, 3.5, 0.16, BR2);
  archHead(b, masonry, sub(pm, 0, 3.5, 0), 3.4, true, 0.08, BR2);
  b.box(M.dark, sub(pm, 0, 1.6, 0.14), 2.4, 3.2, 0.02);
  archHead(b, M.dark, sub(pm, 0, 3.2, 0), 2.4, true, 0.15);
  b.box(M.stucco, sub(pm, 0, 6.2, 0.06), 1.5, 1.7, 0.08, [0.55, 0.7, 1.35]);
  b.box(M.stucco, sub(pm, 0, 6.2, 0.11), 0.9, 1.1, 0.04, [1.3, 1.25, 1.1]);
  b.box(M.enamel, sub(pm, 0, 4.9, 0.12), 3.6, 0.22, 0.12, GLAZE);
  for (const x of [-2.1, 2.1]) {
    b.box(M.iron, sub(pm, x * 0.8, 3.7, 0.35), 0.06, 0.06, 0.7, [0.5, 0.9, 0.7]);
    b.box(M.lampGlass, sub(pm, x, 3.35, 0.65), 0.34, 0.5, 0.34);
    b.geo(M.enamel, frustum(0.5, 0.5, 0.3, 0, 0), sub(pm, x, 3.6, 0.65), GLAZE);
    b.light(worldPt(l, tx + x, 3.3, tz + T / 2 + 1.2), 0xffb060, 14, 10, 0.08, 3.2);
  }
  // Round stair turret between tower and front, white striped top, slate cone.
  const st = F(tx + T / 2 + 0.7, 0, front - 0.2);
  b.geo(masonry, cached('turret', () => new CylinderGeometry(1.4, 1.4, 14, 12)), sub(st, 0, 7, 0), BR);
  for (let k = 0; k < 8; k++) b.box(M.stucco, sub(st, 0, 11.3, 0, (k * Math.PI) / 4).multiply(new Matrix4().setPosition(0, 0, 1.38)), 0.32, 2.6, 0.06, WHITE);
  b.box(masonry, sub(st, 0, 14, 0), 3.1, 0.3, 3.1, BR2);
  b.geo(M.slate, cached('turretCap', () => new ConeGeometry(1.6, 4, 10)), sub(st, 0, 16.1, 0));
  // The Hauptmann beside the tower, on the landing, looking down the street.
  hauptmann(b, F(tx + T / 2 + 1.2, 0.3, 14.2, -0.35));
  b.light(worldPt(l, tx + T / 2 + 2.2, 2.6, 15.6), 0xffc890, 8, 6, 0.04, 2);
}

// ---------------------------------------------------------------- Schloss

function schloss(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const F = frameOf(l);
  const rng = new Rng(1690);
  const w = l.hx * 2 - 0.4, d = l.hz * 2 - 0.4, H = 11.4;
  const cream = M.landmarkFinishes?.plaster ?? M.stucco;
  const C: RGB = [1.36, 1.3, 1.12];
  const OCHRE: RGB = [1.42, 1.2, 0.78];
  b.box(cream, F(0, H / 2, 0), w, H, d, C);
  b.box(M.stucco, F(0, 0.5, 0), w + 0.1, 1, d + 0.1, [0.85, 0.83, 0.78]);
  b.box(M.stucco, F(0, H - 0.25, 0), w + 0.5, 0.5, d + 0.5, WHITE);
  b.box(M.stucco, F(0, 4.15, 0), w + 0.12, 0.22, d + 0.12, WHITE);
  // Both long fronts (courtyard east, Dahme west): 3+2 | risalit 3 | 2+3 axes; pale ochre bays, white pilasters.
  const axes = [-5.5, -4.6, -3.7, -2.45, -1.55, -0.9, 0, 0.9, 1.55, 2.45, 3.7, 4.6, 5.5].map((a) => (a / 5.5) * (w / 2 - 1.2));
  for (const side of [1, -1]) {
    const m = F(0, 0, (side * d) / 2, side > 0 ? 0 : Math.PI);
    for (const x of [-w / 2 + 0.25, -3.1 * (w / 24), 3.1 * (w / 24), w / 2 - 0.25]) b.box(M.stucco, sub(m, x, H / 2, 0.06), 0.5, H, 0.12, WHITE);
    for (const [x0, x1] of [[-w / 2 + 0.5, -3.1 * (w / 24) - 0.25], [3.1 * (w / 24) + 0.25, w / 2 - 0.5]] as const) {
      b.box(cream, sub(m, (x0 + x1) / 2, H / 2 + 0.1, 0.03), x1 - x0, H - 1.6, 0.06, OCHRE);
    }
    axes.forEach((x, i) => {
      for (const [y, h] of [[2.3, 1.7], [6.0, 2.0], [9.3, 1.5]] as const) pane(b, sub(m, x, y, 0.08), 0.85, h, rng, 0.2, { mat: M.stucco, color: WHITE });
      if (i >= 5 && i <= 7) b.box(M.stucco, sub(m, x, 7.25, 0.18), 1.1, 0.35, 0.2, WHITE);
    });
    // Risalit: three axes forward, segmental pediment with a cartouche.
    const rw = 2 * (Math.abs(axes[5]!) + 0.85);
    b.box(cream, sub(m, 0, H / 2, 0.3), rw, H, 0.6, C);
    for (const x of [-rw / 2 + 0.2, rw / 2 - 0.2]) b.box(M.stucco, sub(m, x, H / 2, 0.62), 0.4, H, 0.1, WHITE);
    for (const x of axes.slice(5, 8)) for (const [y, h] of [[2.3, 1.7], [6.0, 2.0], [9.3, 1.5]] as const) pane(b, sub(m, x, y, 0.62), 0.85, h, rng, 0.35, { mat: M.stucco, color: WHITE });
    b.geo(M.stucco, cached(`ped${rw.toFixed(2)}`, () => new CylinderGeometry(rw / 2 + 0.3, rw / 2 + 0.3, 0.7, 20, 1, false, -Math.PI / 2, Math.PI)), sub(m, 0, H, 0.35, 0, Math.PI / 2).multiply(new Matrix4().makeScale(1, 1, 0.42)), WHITE);
    b.geo(M.stucco, cached('cartouche', () => new SphereGeometry(0.55, 10, 6)), sub(m, 0, H + 1, 0.75).multiply(new Matrix4().makeScale(1, 0.8, 0.3)), [1.3, 1.15, 0.8]);
    // Portal with a balcony above on the courtyard side, steps to the water on the Dahme side.
    b.box(M.stucco, sub(m, 0, 1.5, 0.75), 1.9, 3, 0.2, WHITE);
    b.box(M.door, sub(m, 0, 1.35, 0.86), 1.3, 2.7, 0.04);
    b.box(M.stucco, sub(m, 0, 4.4, 1.0), 2.6, 0.18, 0.9, WHITE);
    for (let x = -1.2; x <= 1.21; x += 0.3) b.box(M.iron, sub(m, x, 4.95, 1.4), 0.04, 0.9, 0.04);
    b.box(M.iron, sub(m, 0, 5.4, 1.4), 2.5, 0.05, 0.05);
    b.light(worldPt(l, 0, 3.1, side * (d / 2 + 1.4)), 0xffc070, 12, 10, 0.05, 3);
  }
  // Short ends.
  for (const side of [1, -1]) {
    const m = F((side * w) / 2, 0, 0, (side * Math.PI) / 2);
    for (const x of [-d / 4, d / 4]) for (const [y, h] of [[2.3, 1.7], [6.0, 2.0], [9.3, 1.5]] as const) pane(b, sub(m, x, y, 0.06), 0.85, h, rng, 0.15, { mat: M.stucco, color: WHITE });
  }
  // Red-brown hip roof with a flat top, white balustrade with piers, dormers.
  const RH = 4.6, inset = 2.2;
  const roofTint: RGB = [1.15, 0.78, 0.62];
  b.geo(M.roof, frustum(w + 0.6, d + 0.6, RH, w + 0.6 - 2 * inset, d + 0.6 - 2 * inset), F(0, H, 0), roofTint);
  const tw = w + 0.6 - 2 * inset, td = d + 0.6 - 2 * inset;
  for (const [x, z, sx, sz] of [[0, td / 2, tw, 0.08], [0, -td / 2, tw, 0.08], [tw / 2, 0, 0.08, td], [-tw / 2, 0, 0.08, td]] as const) {
    b.box(M.stucco, F(x, H + RH + 0.55, z), sx + 0.1, 0.12, sz + 0.1, WHITE);
    const n = Math.round(Math.max(sx, sz) / 0.4);
    for (let k = 0; k <= n; k++) {
      const t = k / n - 0.5;
      b.box(M.stucco, F(x + (sx > 1 ? t * sx : 0), H + RH + 0.27, z + (sz > 1 ? t * sz : 0)), 0.1, 0.5, 0.1, WHITE);
    }
  }
  for (const [x, z] of [[-tw / 2, td / 2], [tw / 2, td / 2], [-tw / 2, -td / 2], [tw / 2, -td / 2], [-tw / 6, td / 2], [tw / 6, td / 2], [-tw / 6, -td / 2], [tw / 6, -td / 2], [0, td / 2], [0, -td / 2]] as const) {
    b.box(M.stucco, F(x, H + RH + 0.55, z), 0.6, 1.1, 0.6, WHITE);
  }
  for (const side of [1, -1]) {
    for (const x of [-w / 2 + 3, -w / 4 + 0.6, w / 4 - 0.6, w / 2 - 3]) {
      const dm = F(x, H + 1.5, side * (d / 2 - 0.4), side > 0 ? 0 : Math.PI);
      b.box(cream, dm, 1.3, 1.6, 1.4, C);
      b.geo(M.roof, cached('dormerHood', () => new CylinderGeometry(0.8, 0.8, 1.6, 10, 1, false, -Math.PI / 2, Math.PI)), sub(dm, 0, 0.8, -0.05, 0, Math.PI / 2), roofTint);
      pane(b, sub(dm, 0, 0, 0.7), 0.7, 1.0, rng, 0.2);
    }
  }
  b.shadowBox(F(0, (H + RH) / 2, 0), w, H + RH, d);
  // Clipped ball trees (Kugelbäume) along the water side.
  for (let i = 0; i < 6; i++) {
    const x = (i / 5 - 0.5) * (w - 3);
    b.box(M.darkWood, F(x, 0.9, -d / 2 - 1.6), 0.18, 1.8, 0.18);
    b.geo(M.mossy, cached('ballTree', () => new SphereGeometry(0.95, 10, 8)), F(x, 2.4, -d / 2 - 1.6), [0.5, 0.85, 0.42]);
  }
}

// ---------------------------------------------------------------- St. Laurentius

function kirche(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const F = frameOf(l);
  const rng = new Rng(1841);
  const BR: RGB = [1.22, 0.78, 0.58];
  const BR2: RGB = [1.32, 0.9, 0.7];
  const w = l.hx * 2, H = 8.2;
  const z0 = -l.hz + 2.6, z1 = l.hz - 4.6;
  const nl = z1 - z0, nc = (z0 + z1) / 2;
  // Nave: orange-red brick, Lisenen, tall round-arched windows, steep tile roof.
  b.box(M.brick, F(0, H / 2, nc), w, H, nl, BR);
  b.box(M.brick, F(0, H - 0.2, nc), w + 0.4, 0.4, nl + 0.4, BR2);
  b.box(M.concrete, F(0, 0.4, nc), w + 0.12, 0.8, nl + 0.12, [0.55, 0.52, 0.48]);
  b.geo(M.roof, frustum(nl + 0.6, w + 0.8, 6.2, nl + 0.6, 0, SLOPES), F(0, H - 0.1, nc, Math.PI / 2), [1.2, 0.86, 0.72]);
  b.geo(M.brick, frustum(nl, w, 6, nl, 0, ENDS), F(0, H, nc, Math.PI / 2), BR);
  for (const side of [1, -1]) {
    const m = F((side * w) / 2, 0, nc, (side * Math.PI) / 2);
    const bays = 4;
    for (let k = 0; k <= bays; k++) b.box(M.brick, sub(m, (k / bays - 0.5) * nl, H / 2, 0.08), 0.5, H, 0.16, BR2);
    for (let k = 0; k < bays; k++) archWindow(b, sub(m, ((k + 0.5) / bays - 0.5) * nl, 4.2, 0), 1.2, 3.6, rng, 0.25, false, { mat: M.brick, color: BR2 });
  }
  // Apse at the back (polygonal, half roof cone).
  b.geo(M.brick, cached('apse', () => new CylinderGeometry(2.4, 2.4, H - 1, 8, 1, false, Math.PI / 2, Math.PI)), F(0, (H - 1) / 2, z0), BR);
  b.geo(M.roof, cached('apseRoof', () => new ConeGeometry(2.7, 2.6, 8, 1, false, Math.PI / 2, Math.PI)), F(0, H - 1 + 1.3, z0), [1.2, 0.86, 0.72]);
  // West tower toward the street: four storeys with cornices, clock, paired belfry openings, slate spire.
  const T = 5.2, tz = l.hz - T / 2 - 0.1, TH = 21;
  b.box(M.brick, F(0, TH / 2, tz), T, TH, T, BR);
  b.box(M.concrete, F(0, 0.5, tz), T + 0.14, 1, T + 0.14, [0.55, 0.52, 0.48]);
  for (const y of [5.6, 10.6, 15.4]) b.box(M.brick, F(0, y, tz), T + 0.34, 0.32, T + 0.34, BR2);
  b.box(M.brick, F(0, TH - 0.2, tz), T + 0.6, 0.5, T + 0.6, BR2);
  for (let k = 0; k < 4; k++) {
    const face = sub(F(0, 0, tz), 0, 0, 0, (k * Math.PI) / 2);
    archWindow(b, sub(face, 0, 7.9, T / 2), 0.9, 2.2, rng, 0.1, false, { mat: M.brick, color: BR2 });
    b.geo(M.stucco, cached('ocRim', () => new TorusGeometry(0.72, 0.1, 6, 16)), sub(face, 0, 13, T / 2 + 0.05), BR2);
    b.geo(M.clock, cached('clockS', () => new CircleGeometry(0.66, 20)), sub(face, 0, 13, T / 2 + 0.04));
    for (const x of [-0.95, -0.3, 0.3, 0.95]) archWindow(b, sub(face, x, 17.4, T / 2), 0.48, 2.3, rng, 0, false);
  }
  b.geo(M.slate, cached('lspire', () => new ConeGeometry(2.75, 17, 8)), F(0, TH + 8.5, tz, Math.PI / 8));
  b.geo(M.enamel, cached('lball', () => new SphereGeometry(0.22, 8, 6)), F(0, TH + 17.2, tz), [1.1, 0.9, 0.4]);
  b.box(M.enamel, F(0, TH + 18.1, tz), 0.08, 1.6, 0.08, [1.1, 0.9, 0.4]);
  b.box(M.enamel, F(0, TH + 18.4, tz), 0.7, 0.08, 0.08, [1.1, 0.9, 0.4]);
  b.shadowBox(F(0, (TH + 7) / 2, tz), T, TH + 7, T);
  b.shadowBox(F(0, H / 2, nc), w, H, nl);
  // Round-arched portal facing the street, with a lamp.
  const pm = F(0, 0, tz + T / 2);
  b.box(M.brick, sub(pm, 0, 1.6, 0.06), 2.6, 3.2, 0.12, BR2);
  archHead(b, M.brick, sub(pm, 0, 3.2, 0), 2.6, false, 0.06, BR2);
  b.box(M.door, sub(pm, 0, 1.45, 0.13), 1.8, 2.9, 0.04);
  archHead(b, M.dark, sub(pm, 0, 2.9, 0), 1.8, false, 0.13);
  b.light(worldPt(l, 1.8, 3, tz + T / 2 + 1.2), 0xffb870, 10, 9, 0.05, 3);
  b.box(M.lampGlass, sub(pm, 1.8, 3, 0.3), 0.3, 0.45, 0.3);
}

// ---------------------------------------------------------------- S-Bahnhof

function sbahnhof(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const F = frameOf(l);
  const cream = M.landmarkFinishes?.plaster ?? M.stucco;
  const C: RGB = [1.36, 1.3, 1.1];
  const RED: RGB = [0.9, 0.42, 0.3];
  const d = l.hz * 2, fz = l.hz;
  // Entrance hall (cream, flat roof) between two lower shop wings; red-brown plinth.
  const HH = 8.8, WH = 5.6, hw = 6.6;
  b.box(cream, F(0, HH / 2, 0), hw * 2, HH, d, C);
  b.box(M.stucco, F(0, HH + 0.15, 0), hw * 2 + 0.3, 0.3, d + 0.3, [0.95, 0.92, 0.85]);
  for (const s of [-1, 1]) {
    const cx = s * (hw + (l.hx - hw) / 2), sx = l.hx - hw;
    b.box(cream, F(cx, WH / 2, 0), sx, WH, d, C);
    b.box(M.stucco, F(cx, WH + 0.12, 0), sx + 0.2, 0.24, d + 0.2, [0.95, 0.92, 0.85]);
    b.box(M.enamel, F(cx, 0.45, fz), sx, 0.9, 0.12, RED);
    // Shops: barred windows, a half-open shutter, a faded sign.
    const fm = F(cx, 0, fz);
    b.geo(M.shop, new PlaneGeometry(3.2, 2.0), sub(fm, -s * 1.6, 2.0, 0.07));
    b.box(M.corrugated, sub(fm, s * 2.4, 1.9, 0.12), 2.6, 2.4, 0.08, [0.75, 0.75, 0.72]);
    b.box(M.sign, sub(fm, 0, 3.75, 0.1), sx - 1.2, 0.6, 0.08);
    b.shadowBox(F(cx, WH / 2, 0), sx, WH, d);
  }
  b.box(M.enamel, F(0, 0.45, fz), hw * 2, 0.9, 0.12, RED);
  // Front of the hall: pilasters, three passages under round arches with an outer arch each.
  const fm = F(0, 0, fz);
  for (const x of [-hw + 0.3, -1.95, 1.95, hw - 0.3]) b.box(cream, sub(fm, x, 3.1, 0.15), 0.6, 6.2, 0.3, [1.28, 1.22, 1.04]);
  b.box(M.stucco, sub(fm, 0, 6.3, 0.15), hw * 2, 0.22, 0.32, [0.95, 0.92, 0.85]);
  for (const x of [-3.9, 0, 3.9]) {
    const am = sub(fm, x, 0, 0);
    // Outer arch (frame) and the passage, both outlined in the red-brown of the plinth.
    b.geo(M.enamel, cached('outerArch', () => new TorusGeometry(1.6, 0.09, 4, 16, Math.PI)), sub(am, 0, 3.4, 0.08), RED);
    for (const s of [-1, 1]) b.box(M.enamel, sub(am, s * 1.6, 2.15, 0.08), 0.18, 2.5, 0.06, RED);
    b.box(M.dark, sub(am, 0, 1.25, 0.06), 2.4, 2.5, 0.02);
    b.geo(M.dark, cached('passHead', () => new CircleGeometry(1.2, 14, 0, Math.PI)), sub(am, 0, 2.5, 0.06));
    b.geo(M.enamel, cached('innerArch', () => new TorusGeometry(1.2, 0.1, 4, 14, Math.PI)), sub(am, 0, 2.5, 0.1), RED);
    for (const s of [-1, 1]) b.box(M.enamel, sub(am, s * 1.2, 1.25, 0.1), 0.2, 2.5, 0.08, RED);
    // Passage floor running into the dark.
    b.box(M.cobbles, sub(am, 0, 0.03, -1.2), 2.4, 0.06, 2.4, [0.45, 0.43, 0.4]);
  }
  b.geo(M.clock, cached('clockStation', () => new CircleGeometry(0.42, 18)), sub(fm, 0, 4.25, 0.12));
  for (const x of [-5.85, -1.95, 1.95, 5.85]) {
    b.box(M.iron, sub(fm, x, 3.05, 0.42), 0.36, 0.08, 0.36);
    b.box(M.lampGlass, sub(fm, x, 2.8, 0.42), 0.28, 0.44, 0.28);
  }
  for (const x of [-5.85, 5.85]) b.light(worldPt(l, x, 2.8, fz + 1.2), 0xffd090, 12, 10, 0.06, 3.2);
  b.light(worldPt(l, 0, 6.4, fz + 1.6), 0x70ffa8, 10, 10, 0, 3.5);
  // Lettering and the S roundel above the arches.
  b.geo(M.stationName, new PlaneGeometry(7.4, 0.7), sub(fm, 0, 6.95, 0.06));
  b.geo(M.sRoundel, new PlaneGeometry(1.5, 1.5), sub(fm, 0, 8.05, 0.06));
  b.shadowBox(F(0, HH / 2, 0), hw * 2, HH, d);
  // Island platform behind on the embankment: V-shaped canopy on a row of columns.
  const pz = -l.hz - 4.5, py = 1.8, L = 56;
  b.box(M.concrete, F(0, py / 2 + 0.5, pz), L, py + 1, 6, [0.66, 0.64, 0.6]);
  b.box(M.stucco, F(0, py + 1.02, pz + 2.9), L, 0.04, 0.3, [1.3, 1.2, 0.6]);
  b.box(M.stucco, F(0, py + 1.02, pz - 2.9), L, 0.04, 0.3, [1.3, 1.2, 0.6]);
  for (let x = -L / 2 + 3; x <= L / 2 - 3; x += 7) b.box(M.iron, F(x, py + 3.3, pz), 0.24, 4.6, 0.24, [0.6, 0.75, 0.65]);
  for (const s of [-1, 1]) b.box(M.corrugated, F(0, py + 5.7, pz + s * 1.6, 0, s * -0.14), L, 0.1, 3.4, [0.6, 0.66, 0.62]);
  b.geo(M.sRoundel, new PlaneGeometry(1.1, 1.1), F(-L / 2 + 6, py + 4.4, pz + 0.14));
}

// ---------------------------------------------------------------- Müggelturm

function mueggelturm(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const F = frameOf(l);
  const rng = new Rng(1961);
  const white = M.stucco;
  const W: RGB = [1.55, 1.52, 1.44];
  // Slim white tower: nine storeys of window bands, an open deck and a cantilevered flat roof.
  const tx = -l.hx + 2.6, tz = l.hz - 2.8, T = 4.6, FL = 2.85, N = 9;
  for (let i = 0; i < N; i++) {
    const y = i * FL;
    b.box(white, F(tx, y + 0.5, tz), T, 1.0, T, W);
    b.box(M.glass, F(tx, y + 1.42, tz), T - 0.3, 1.85, T - 0.3, [0.55, 0.6, 0.62]);
    for (let k = 0; k < 4; k++) {
      const face = sub(F(tx, 0, tz), 0, y + 1.42, (T - 0.3) / 2, (k * Math.PI) / 2);
      for (const x of [-1.05, 0, 1.05]) pane(b, sub(face, x, 0, 0), 0.95, 1.6, rng, 0.06);
    }
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.box(white, F(tx + x * (T / 2 - 0.15), (N * FL) / 2, tz + z * (T / 2 - 0.15)), 0.32, N * FL, 0.32, W);
  const top = N * FL;
  b.box(white, F(tx, top + 0.15, tz), T + 1.4, 0.3, T + 1.4, W);
  for (const [x, z, sx, sz] of [[0, 1, 1, 0], [0, -1, 1, 0], [1, 0, 0, 1], [-1, 0, 0, 1]] as const) {
    b.box(M.iron, F(tx + x * (T / 2 + 0.65), top + 1.25, tz + z * (T / 2 + 0.65)), sx * (T + 1.4) + 0.05, 0.05, sz * (T + 1.4) + 0.05);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.box(white, F(tx + x * (T / 2 - 0.2), top + 1.4, tz + z * (T / 2 - 0.2)), 0.22, 2.5, 0.22, W);
  b.box(white, F(tx, top + 2.8, tz), T + 2.6, 0.35, T + 2.6, W);
  b.geo(M.iron, cached('mast', () => new CylinderGeometry(0.05, 0.09, 4, 5)), F(tx, top + 5, tz));
  b.shadowBox(F(tx, (top + 3) / 2, tz), T, top + 3, T);
  // Restaurant pavilion (flat roof, big windows, roof terrace under a cantilevered canopy).
  const px = tx + T / 2 + 0.3 + (l.hx - (tx + T / 2 + 0.3)) / 2, pw = l.hx - (tx + T / 2 + 0.3) - 0.2, pd = l.hz * 2 - 3.2, pz = -1.4;
  b.box(white, F(px, 1.7, pz), pw, 3.4, pd, W);
  b.box(M.stucco, F(px, 3.45, pz), pw + 0.4, 0.2, pd + 0.4, [1, 1, 0.96]);
  const fm = F(px, 0, pz + pd / 2);
  for (const x of [-pw / 3, 0, pw / 3]) pane(b, sub(fm, x, 1.8, 0), pw / 3 - 0.5, 2.2, rng, 0.5, { mat: M.stucco, color: W });
  for (const [x, z, sx, sz] of [[0, pd / 2, pw, 0], [pw / 2, 0, 0, pd], [-pw / 2, 0, 0, pd]] as const) {
    b.box(M.iron, F(px + x, 4.45, pz + z), sx + 0.05, 0.05, sz + 0.05, [1.3, 1.25, 1.1]);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.box(white, F(px + x * (pw / 2 - 0.3), 5.2, pz - pd / 4 + z * (pd / 4 - 0.3)), 0.18, 3.4, 0.18, W);
  b.box(white, F(px, 6.95, pz - pd / 4), pw + 1.0, 0.25, pd / 2 + 1.0, W);
  b.box(white, F(px, 5.0, pz - pd / 2 + 0.6), pw - 0.4, 3.0, 1.2, W);
  b.shadowBox(F(px, 1.7, pz), pw, 3.4, pd);
  // Beer garden in front: low wall, benches, two folded green umbrellas.
  const gz = l.hz - 0.6;
  b.box(M.concrete, F(px, 0.35, gz), pw, 0.7, 0.3, [0.7, 0.68, 0.64]);
  for (const x of [-pw / 4, pw / 4]) {
    b.box(M.wood, F(px + x, 0.75, gz - 0.9), 1.8, 0.06, 0.7);
    for (const s of [-1, 1]) b.box(M.wood, F(px + x, 0.45, gz - 0.9 + s * 0.6), 1.8, 0.05, 0.28);
    b.box(M.iron, F(px + x, 1.4, gz - 0.9), 0.05, 2.8, 0.05);
    b.geo(M.carPaint, cached('umb', () => new ConeGeometry(0.22, 1.6, 6)), F(px + x, 2.1, gz - 0.9, 0, Math.PI), [0.3, 0.6, 0.35]);
  }
  b.light(worldPt(l, px, 3.0, l.hz + 0.8), 0xffb060, 14, 12, 0.2, 4);
}

// ---------------------------------------------------------------- Riesenrad

function riesenrad(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const F = frameOf(l);
  const rng = new Rng(1969);
  const RED: RGB = [0.82, 0.34, 0.28];
  const R = 17, hub = R + 2.6;
  // Two rims and an inner bracing ring on each face, tension spokes from wide hub flanges.
  for (const z of [-0.75, 0.75]) {
    b.geo(M.enamel, cached('rim', () => new TorusGeometry(R, 0.22, 5, 64)), F(0, hub, z), RED);
    b.geo(M.enamel, cached('rim2', () => new TorusGeometry(R - 1.3, 0.12, 4, 64)), F(0, hub, z), RED);
  }
  const SP = 40;
  for (let i = 0; i < SP; i++) {
    const a = (i / SP) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const z of [-0.75, 0.75]) {
      beam(b, M.enamel, F, new Vector3(0, hub, z * 2.4), new Vector3(sa * (R - 0.1), hub + ca * (R - 0.1), z), 0.07, 0.07, RED);
      // Zigzag between the outer rim and the bracing ring.
      const a2 = ((i + 0.5) / SP) * Math.PI * 2;
      beam(b, M.enamel, F, new Vector3(sa * R, hub + ca * R, z), new Vector3(Math.sin(a2) * (R - 1.3), hub + Math.cos(a2) * (R - 1.3), z), 0.08, 0.08, RED);
    }
    if (i % 2 === 0) beam(b, M.enamel, F, new Vector3(sa * R, hub + ca * R, -0.75), new Vector3(sa * R, hub + ca * R, 0.75), 0.1, 0.1, RED);
  }
  b.geo(M.iron, cached('hub', () => new CylinderGeometry(1.0, 1.0, 5.2, 12)), F(0, hub, 0, 0, Math.PI / 2));
  // Four splayed legs to the hub (two A-frames) and ties between the feet.
  for (const z of [-1, 1]) {
    // Feet inside the footprint (the platform stairs stay free), so the A-frames are a little steeper than the real ones.
    for (const x of [-1, 1]) beam(b, M.enamel, F, new Vector3(x * (l.hx - 0.4), 0, z * (l.hz - 0.4)), new Vector3(x * 0.6, hub, z * 1.9), 0.75, 0.6, RED);
    beam(b, M.enamel, F, new Vector3(-(l.hx - 0.4), 0.3, z * (l.hz - 0.4)), new Vector3(l.hx - 0.4, 0.3, z * (l.hz - 0.4)), 0.4, 0.4, RED);
  }
  // Gondolas in faded colors; two lie broken on the ground, a few are missing.
  const COLORS: RGB[] = [[0.35, 0.55, 0.95], [1.1, 0.9, 0.3], [0.95, 0.35, 0.3], [0.4, 0.8, 0.5], [0.3, 0.75, 0.8]];
  const G = 40;
  for (let i = 0; i < G; i++) {
    if (i === 9 || i === 23 || i === 31) continue;
    const a = (i / G) * Math.PI * 2;
    const x = Math.sin(a) * R, y = hub + Math.cos(a) * R;
    const c = COLORS[i % COLORS.length]!;
    const sway = rng.range(-0.08, 0.08);
    const gm = F(x, y, 0, 0, 0, sway);
    b.box(M.iron, sub(gm, 0, -0.35, 0), 0.06, 0.7, 0.06);
    b.box(M.carPaint, sub(gm, 0, -1.25, 0), 1.25, 1.0, 1.25, c);
    b.box(M.carGlass, sub(gm, 0, -1.05, 0), 1.27, 0.42, 1.27);
    b.box(M.carPaint, sub(gm, 0, -0.68, 0), 1.45, 0.12, 1.45, [1.15, 1.12, 1.05]);
  }
  for (const [x, z, ry, rz, i] of [[4.4, 2.2, 0.5, 1.2, 1], [-4.6, -2.0, -0.4, -0.35, 3]] as const) {
    const gm = F(x, 0.62, z, ry, 0, rz);
    b.box(M.carPaint, gm, 1.25, 1.0, 1.25, COLORS[i]);
    b.box(M.carPaint, sub(gm, 0, 0.58, 0), 1.45, 0.12, 1.45, [1.15, 1.12, 1.05]);
  }
  // Boarding platform with steps and the ticket booth.
  b.box(M.concrete, F(0, 0.5, 0), 6.5, 1.0, 3.6, [0.62, 0.6, 0.56]);
  for (let k = 0; k < 3; k++) b.box(M.concrete, F(0, 0.17 + k * 0.33, 2.2 + (2 - k) * 0.35), 3, 0.34, 0.35, [0.66, 0.64, 0.6]);
  b.box(M.wood, F(3.6, 1.15, -2.2), 1.6, 2.3, 1.4, [0.9, 0.5, 0.42]);
  b.box(M.carPaint, F(3.6, 2.42, -2.2), 1.9, 0.18, 1.7, [1.1, 0.9, 0.3]);
  b.light(worldPt(l, 3.6, 2.6, 4), 0xff8a50, 12, 12, 0.5, 4);
  b.shadowBox(F(0, hub, 0), R * 2, R * 2, 1.6);
}

// ---------------------------------------------------------------- dinosaurs

/** Tapered limb between two local points (neck, tail, leg). */
function limb(b: ChunkBuilder, mat: Material, F: Frame, a: Vector3, c: Vector3, r0: number, r1: number, color: RGB): void {
  const d = c.clone().sub(a);
  const len = d.length();
  const g = cached(`dl${r0.toFixed(2)},${r1.toFixed(2)}`, () => new CylinderGeometry(r1, r0, 1, 9));
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  const mid = a.clone().add(c).multiplyScalar(0.5);
  b.geo(mat, g, F(mid.x, mid.y, mid.z).multiply(new Matrix4().compose(new Vector3(), q, new Vector3(1, len, 1))), color);
}

function chain(b: ChunkBuilder, mat: Material, F: Frame, pts: Array<[number, number, number]>, r0: number, r1: number, color: RGB): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    limb(b, mat, F, new Vector3(...pts[i]!), new Vector3(...pts[i + 1]!), r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, color);
  }
}

/**
 * The fallen Spreepark figures (fibreglass from Mirapolis): a sauropod on its back with its legs in
 * the air, a triceratops tipped on its side, a T-Rex broken apart (the one that stayed in the park).
 */
function dino(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const fiberglass = M.landmarkFinishes?.fiberglass ?? M.mossy;
  const F = frameOf(l);
  const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number, color: RGB, rot = 0): void => {
    b.geo(fiberglass, cached('dinoBody', () => new SphereGeometry(1, 14, 10)), F(x, y, z, 0, 0, rot).multiply(new Matrix4().makeScale(rx, ry, rz)), color);
  };
  const v = l.variant ?? 0;
  if (v === 0) {
    const C: RGB = [0.85, 0.95, 0.9];
    ell(1.9, 1.5, 3.4, 0, 1.45, 0, C);
    ell(1.5, 0.5, 2.8, 0, 2.55, 0, [1.15, 1.15, 1.05]);
    chain(b, fiberglass, F, [[0, 1.4, 2.8], [0.5, 0.95, 4.6], [1.4, 0.6, 6.3], [2.6, 0.5, 7.5]], 0.85, 0.42, C);
    ell(0.55, 0.45, 0.85, 3.1, 0.55, 8.1, C, 0.4);
    chain(b, fiberglass, F, [[0, 1.3, -3], [-0.6, 0.85, -4.9], [-1.9, 0.5, -6.6], [-3.4, 0.25, -7.6]], 0.95, 0.12, C);
    for (const [x, z] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]] as const) {
      limb(b, fiberglass, F, new Vector3(x * 0.95, 2.4, z), new Vector3(x * 1.5, 4.2, z * 1.1 + (z > 0 ? 0.3 : -0.2)), 0.55, 0.42, C);
      b.geo(fiberglass, cached('foot', () => new CylinderGeometry(0.5, 0.5, 0.25, 9)), F(x * 1.52, 4.3, z * 1.1 + (z > 0 ? 0.3 : -0.2)), [0.6, 0.62, 0.58]);
    }
    b.geo(M.graffiti, new PlaneGeometry(2.6, 1.3), F(1.92, 1.6, -0.3, Math.PI / 2, 0, 0.05));
  } else if (v === 1) {
    const C: RGB = [1.25, 1.0, 0.68];
    ell(1.6, 1.3, 2.7, 0, 1.3, 0, C, 1.2);
    limb(b, fiberglass, F, new Vector3(0.2, 1.25, 2.4), new Vector3(0.4, 1.1, 3.6), 0.7, 0.6, C);
    b.geo(fiberglass, cached('frill', () => new CylinderGeometry(1.6, 1.6, 0.18, 14)), F(0.4, 1.4, 3.55, 0, Math.PI / 2 - 0.3, 1.2), [1.15, 0.85, 0.6]);
    ell(0.6, 0.6, 1.0, 0.5, 1.0, 4.3, C, 1.2);
    for (const [x, y, len] of [[0.9, 1.6, 1.3], [0.1, 1.9, 1.3], [0.6, 0.9, 0.6]] as const) {
      b.geo(M.stucco, cached(`horn${len}`, () => new ConeGeometry(0.14, len, 7)), F(x, y, 4.5 + len / 2, 0, Math.PI / 2), [1.2, 1.15, 1.0]);
    }
    for (const [z, y] of [[1.4, 1.9], [-1.4, 1.9], [1.4, 0.8], [-1.4, 0.8]] as const) limb(b, fiberglass, F, new Vector3(1.0, y, z), new Vector3(2.4, y + 0.3, z * 1.1), 0.42, 0.34, C);
    chain(b, fiberglass, F, [[0, 1.0, -2.4], [-0.4, 0.6, -3.8], [-1.2, 0.3, -4.8]], 0.6, 0.1, C);
    b.geo(M.graffiti, new PlaneGeometry(2.0, 1.0), F(-0.2, 2.7, 0, 0, -Math.PI / 2, 0));
  } else {
    // T-Rex: legs still standing on the plinth, the body toppled beside them, the head torn off.
    const C: RGB = [0.7, 0.92, 0.62];
    b.box(M.concrete, F(0, 0.25, -1.6), 2.6, 0.5, 2.0, [0.6, 0.58, 0.54]);
    for (const x of [-0.6, 0.6]) {
      limb(b, fiberglass, F, new Vector3(x, 0.5, -1.6), new Vector3(x, 1.9, -1.5), 0.32, 0.38, C);
      limb(b, fiberglass, F, new Vector3(x, 1.9, -1.5), new Vector3(x * 1.2, 2.9, -1.9), 0.5, 0.55, C);
      b.box(M.rust, F(x * 1.2, 3.25, -1.9), 0.12, 0.7, 0.12);
    }
    ell(1.3, 1.1, 2.6, 2.2, 1.1, 0.6, C, -0.25);
    chain(b, fiberglass, F, [[1.6, 1.0, -1.8], [1.0, 0.6, -4], [0.2, 0.3, -6]], 0.8, 0.1, C);
    limb(b, fiberglass, F, new Vector3(2.6, 1.5, 2.6), new Vector3(3.0, 1.0, 3.4), 0.2, 0.15, C);
    const hm = F(-2.2, 0.8, 3.0, 0.7, 0, 0.3);
    b.box(fiberglass, hm, 1.0, 0.9, 1.9, C);
    b.box(fiberglass, sub(hm, 0, -0.55, 0.3, 0, 0.35), 0.9, 0.25, 1.5, C);
    for (let k = 0; k < 5; k++) b.geo(M.stucco, cached('tooth', () => new ConeGeometry(0.07, 0.22, 5)), sub(hm, -0.35 + k * 0.17, -0.5, 0.85, 0, Math.PI), [1.25, 1.2, 1.05]);
    b.geo(M.graffiti, new PlaneGeometry(2.2, 1.1), F(3.5, 1.2, 0.6, Math.PI / 2, 0, 0));
  }
}

/**
 * Forum Köpenick (1997): two granite-clad blocks with square green-framed windows, joined by a mall
 * street under a glass barrel vault (half of it shattered), a footbridge and a tree inside.
 */
function forum(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const granite = M.landmarkFinishes?.granite ?? M.concrete;
  const F = frameOf(l);
  const rng = new Rng(1997);
  const GRANITE: RGB = [1.08, 0.8, 0.72];
  const GREEN: RGB = [0.35, 0.62, 0.5];
  const H = 10.5, gap = 5, hw = l.hx, hd = l.hz;
  for (const side of [-1, 1]) {
    const x0 = side * gap, x1 = side * hw, cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    b.box(granite, F(cx, H / 2, 0), w, H, hd * 2, GRANITE);
    b.box(granite, F(cx, H + 0.25, 0), w + 0.3, 0.5, hd * 2 + 0.3, [0.85, 0.7, 0.64]);
    b.box(M.tar, F(cx, H + 0.52, 0), w - 0.6, 0.06, hd * 2 - 0.6, [0.5, 0.5, 0.5]);
    for (const [x, z] of [[cx - w / 4, -hd / 2], [cx + w / 5, hd / 3]] as const) b.box(M.iron, F(x, H + 1.1, z), 2.4, 1.1, 1.6, [1.1, 1.1, 1.1]);
    // Street front: dead shop windows on the ground floor, a band, square windows above.
    const fm = F(cx, 0, hd);
    b.box(granite, sub(fm, 0, 4.1, 0.12), w, 0.5, 0.25, [0.8, 0.66, 0.6]);
    const n = Math.floor(w / 3.4);
    for (let k = 0; k < n; k++) {
      const x = (k + 0.5 - n / 2) * (w / n);
      b.geo(M.shop, new PlaneGeometry(w / n - 0.6, 2.6), sub(fm, x, 1.6, 0.05));
      for (const y of [5.6, 8.3]) pane(b, sub(fm, x, y, 0), 1.4, 1.4, rng, 0.08, { mat: M.enamel, color: GREEN });
    }
    // Long sides and back: pilaster grid and windows.
    for (const [mx, mz, ry, len] of [[x1, 0, side * Math.PI / 2, hd * 2], [cx, -hd, Math.PI, w]] as const) {
      const m = F(mx, 0, mz, ry);
      const k = Math.floor(len / 4);
      for (let i = 0; i <= k; i++) b.box(granite, sub(m, (i / k - 0.5) * len, H / 2, 0.1), 0.5, H, 0.2, [0.92, 0.72, 0.66]);
      for (let i = 0; i < k; i++) for (const y of [5.6, 8.3]) pane(b, sub(m, ((i + 0.5) / k - 0.5) * len, y, 0), 1.4, 1.4, rng, 0.05, { mat: M.enamel, color: GREEN });
    }
    b.shadowBox(F(cx, H / 2, 0), w, H, hd * 2);
  }
  // The mall street: glass barrel vault on steel ribs, about half the panes gone.
  const R = gap, spring = H - 1.2;
  const ribs = Math.round((hd * 2) / 2.4);
  for (let i = 0; i <= ribs; i++) {
    const z = (i / ribs - 0.5) * hd * 2;
    b.geo(M.iron, cached('rib', () => new TorusGeometry(R, 0.09, 4, 16, Math.PI)), F(0, spring, z), [0.9, 1, 0.95]);
  }
  for (const a of [0.2, 0.55, 0.9, 1.25, 1.6, 1.95, 2.3, 2.65, 2.95]) {
    b.box(M.iron, F(Math.cos(a) * R, spring + Math.sin(a) * R, 0, 0, 0, a), 0.08, 0.08, hd * 2, [0.9, 1, 0.95]);
  }
  for (let i = 0; i < ribs; i++) {
    const z = ((i + 0.5) / ribs - 0.5) * hd * 2;
    for (let k = 0; k < 8; k++) {
      if (rng.next() < 0.48) continue;
      const a = ((k + 0.5) / 8) * Math.PI;
      b.box(M.glass, F(Math.cos(a) * R, spring + Math.sin(a) * R, z, 0, 0, a + Math.PI / 2), (Math.PI * R) / 8 - 0.06, 0.04, (hd * 2) / ribs - 0.06, [1.4, 1.6, 1.6]);
    }
  }
  // Inside: granite floor, a footbridge between the blocks, a tree in a round planter, shards.
  b.box(M.cobbles, F(0, 0.04, 0), gap * 2, 0.08, hd * 2, [0.85, 0.82, 0.8]);
  b.box(granite, F(0, 4.6, -2), gap * 2, 0.35, 2.6, [0.8, 0.8, 0.8]);
  for (const s of [-1, 1]) b.box(M.iron, F(0, 5.3, -2 + s * 1.25), gap * 2, 0.06, 0.06);
  b.geo(M.iron, cached('planter', () => new CylinderGeometry(1.2, 1.2, 0.9, 12)), F(0, 0.45, 4), [0.6, 0.55, 0.5]);
  b.box(M.darkWood, F(0, 3, 4), 0.3, 5.2, 0.3);
  b.geo(M.mossy, cached('mallTree', () => new SphereGeometry(2.4, 10, 8)), F(0, 6.8, 4).multiply(new Matrix4().makeScale(1, 0.8, 1)), [0.5, 0.85, 0.42]);
  for (let i = 0; i < 14; i++) b.box(M.glass, F(rng.range(-4, 4), 0.1, rng.range(-hd + 1, hd - 1), rng.range(0, 3), 0, 0), rng.range(0.3, 0.8), 0.03, rng.range(0.3, 0.7), [1.6, 1.8, 1.8]);
  // Entrance: open glass portal under the vault, the flickering FORUM sign above it.
  const em = F(0, 0, hd);
  for (const x of [-gap + 0.3, gap - 0.3]) b.box(M.iron, sub(em, x, spring / 2, 0), 0.3, spring, 0.3, [0.9, 1, 0.95]);
  b.box(M.iron, sub(em, 0, spring, 0), gap * 2, 0.4, 0.4, [0.9, 1, 0.95]);
  b.geo(M.forumSign, new PlaneGeometry(7, 1.3), sub(em, 0, spring - 1.2, 0.25));
  b.light(worldPt(l, 0, 5, hd + 3), 0xff9a4a, 14, 14, 0.6, 5);
  b.light(worldPt(l, 0, 3, 2), 0x9ad8ff, 8, 10, 0.3, 3);
}

export function buildLandmark(b: ChunkBuilder, l: Landmark): void {
  switch (l.kind) {
    case 'rathaus': return rathaus(b, l);
    case 'schloss': return schloss(b, l);
    case 'kirche': return kirche(b, l);
    case 'sbahnhof': return sbahnhof(b, l);
    case 'mueggelturm': return mueggelturm(b, l);
    case 'riesenrad': return riesenrad(b, l);
    case 'dino': return dino(b, l);
    case 'forum': return forum(b, l);
    case 'spati': return;
  }
}
