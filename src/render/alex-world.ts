// M15 Alexanderplatz blockout (`docs/tasks/m15-alexanderplatz.md`, step 2): the brick Stadtbahn viaduct
// with open arches, and massing for the district landmarks (silhouette, height and colour only). The
// landmarks get their real models from photos in step 4; this keeps the layout readable until then.
import { CylinderGeometry, Euler, Matrix4, SphereGeometry } from 'three';
import type { Landmark, MapDef, Viaduct } from '../data/map';
import type { ChunkBuilder, MapMats } from './map-world';
type RGB = readonly [number, number, number];

export const ALEX_KINDS = new Set<Landmark['kind']>([
  'altesmuseum', 'dom', 'palast', 'fernsehturm', 'marienkirche', 'neptunbrunnen', 'rotesrathaus', 'nikolaikirche',
  'weltzeituhr', 'brunnen', 'hotelstadtberlin', 'sbahnalex', 'sbahnhackescher', 'hausdeslehrers', 'kongresshalle', 'kino', 'cafemoskau',
]);

// Pioneer palette (`docs/style-bible.md` › GDR / Pioneer direction) as vertex tints.
const CREAM: RGB = [1.15, 1.08, 0.95], BLUE: RGB = [0.45, 0.62, 1.05], YELLOW: RGB = [1.35, 1.1, 0.45], RED: RGB = [1.1, 0.45, 0.42];
const SAND: RGB = [1.05, 0.95, 0.8], BRICK: RGB = [1, 0.75, 0.68], GREEN: RGB = [0.55, 0.8, 0.65], GREY: RGB = [0.85, 0.85, 0.85];

function frame(l: Landmark): (x: number, y: number, z: number, ry?: number) => Matrix4 {
  const base = new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0, l.z);
  return (x, y, z, ry = 0) => base.clone().multiply(new Matrix4().makeRotationFromEuler(new Euler(0, ry, 0)).setPosition(x, y, z));
}

/** Massing of one landmark at its real proportions (heights compressed below the camera where needed). */
export function buildAlexLandmark(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm, F = frame(l), w = l.hx * 2, d = l.hz * 2;
  const cyl = (rt: number, rb: number, h: number, y: number, mat = M.concrete, color: RGB = GREY, x = 0, z = 0): void => b.geo(mat, new CylinderGeometry(rt, rb, h, 16), F(x, y + h / 2, z), color);
  const ball = (r: number, y: number, mat = M.concrete, color: RGB = GREY, x = 0, z = 0): void => b.geo(mat, new SphereGeometry(r, 16, 10), F(x, y, z), color);
  switch (l.kind) {
    case 'altesmuseum':
      b.box(M.stucco, F(0, 0.6, 0), w, 1.2, d, SAND);
      b.box(M.stucco, F(0, 6, -0.5), w - 2, 10, d - 1, CREAM);
      for (let x = -l.hx + 1.5; x <= l.hx - 1.5; x += 2) cyl(0.35, 0.35, 9, 1.2, M.stucco, CREAM, x, l.hz - 0.4);
      return;
    case 'dom':
      b.box(M.stucco, F(0, 8, 0), w, 16, d, SAND);
      cyl(7, 7, 4, 16, M.stucco, SAND);
      ball(7, 20, M.slate, GREEN);
      for (const [x, z] of [[-l.hx + 2, -l.hz + 2], [l.hx - 2, -l.hz + 2], [-l.hx + 2, l.hz - 2], [l.hx - 2, l.hz - 2]] as const) { cyl(1.8, 1.8, 6, 16, M.stucco, SAND, x, z); ball(1.8, 22, M.slate, GREEN, x, z); }
      return;
    case 'palast':
      // Bronze mirror glass between white marble ends, a glass house vault on the roof.
      b.box(M.glass, F(0, 7, 0), w, 14, d - 6, [1.3, 0.75, 0.45]);
      for (const z of [-l.hz + 1.5, l.hz - 1.5]) b.box(M.stucco, F(0, 7, z), w + 0.4, 14, 3, CREAM);
      b.geo(M.glass, new CylinderGeometry(l.hx - 1, l.hx - 1, d - 8, 12, 1, true, -Math.PI / 2, Math.PI), new Matrix4().copy(F(0, 14, 0)).multiply(new Matrix4().makeRotationX(Math.PI / 2)), [0.8, 1.2, 1]);
      return;
    case 'fernsehturm':
      // Folded pavilion roofs, the shaft, the sphere (above the camera; the reveal shot shows it).
      for (let i = 0; i < 6; i++) b.box(M.concrete, F(Math.sin(i * 1.047) * 7, 2.5, Math.cos(i * 1.047) * 7, i * 1.047), 6, 5, 4, CREAM);
      cyl(2.6, 4.2, 60, 0, M.concrete, CREAM);
      ball(8, 66, M.concrete, [0.75, 0.82, 0.9]);
      cyl(0.6, 0.9, 22, 73, M.iron, RED);
      return;
    case 'marienkirche':
      b.box(M.brick, F(0, 6, 3), w, 12, d - 6, BRICK);
      b.box(M.brick, F(0, 11, -l.hz + 3), 6, 22, 6, BRICK);
      b.geo(M.slate, new CylinderGeometry(0.2, 3.4, 9, 4), F(0, 26.5, -l.hz + 3, Math.PI / 4), GREEN);
      return;
    case 'neptunbrunnen':
      cyl(l.hx, l.hx, 0.7, 0, M.stucco, GREY);
      b.geo(M.water, new CylinderGeometry(l.hx - 0.6, l.hx - 0.6, 0.1, 20), F(0, 0.62, 0));
      cyl(1.2, 1.6, 2.2, 0.7, M.iron, GREEN);
      cyl(0.4, 0.5, 2, 2.9, M.iron, GREEN);
      return;
    case 'rotesrathaus':
      b.box(M.brick, F(0, 7, 0), w, 14, d, BRICK);
      b.box(M.brick, F(0, 13, l.hz - 4), 8, 26, 8, BRICK);
      b.box(M.slate, F(0, 26.5, l.hz - 4), 9, 1, 9, GREEN);
      return;
    case 'nikolaikirche':
      b.box(M.brick, F(0, 6, 2), w, 12, d - 4, BRICK);
      for (const x of [-1.6, 1.6]) b.geo(M.slate, new CylinderGeometry(0.2, 1.6, 10, 8), F(x, 17, -l.hz + 2), GREEN);
      b.box(M.brick, F(0, 6, -l.hz + 2), w, 12, 4, BRICK);
      return;
    case 'weltzeituhr':
      // Column, the ring of city panels, the orbit sculpture. Stands still until the final fight wakes it.
      cyl(3, 3.4, 0.4, 0, M.concrete, GREY);
      cyl(0.5, 0.6, 4.2, 0.4, M.iron, BLUE);
      cyl(2.4, 2.4, 1.2, 4.6, M.stucco, YELLOW);
      cyl(0.08, 0.08, 1.6, 5.8, M.iron, GREY);
      b.geo(M.iron, new SphereGeometry(0.5, 12, 8), F(0, 8, 0), YELLOW);
      for (let i = 0; i < 3; i++) b.geo(M.iron, new CylinderGeometry(1.2 + i * 0.6, 1.2 + i * 0.6, 0.06, 24, 1, true), new Matrix4().copy(F(0, 8, 0)).multiply(new Matrix4().makeRotationX(0.4 - i * 0.3)), [1.2, 1, 0.7]);
      return;
    case 'brunnen':
      cyl(l.hx, l.hx, 0.6, 0, M.stucco, GREY);
      b.geo(M.water, new CylinderGeometry(l.hx - 0.6, l.hx - 0.6, 0.1, 24), F(0, 0.5, 0));
      cyl(3, 1, 1.4, 0.6, M.iron, [0.9, 0.7, 0.5]);
      cyl(1.6, 0.6, 1, 2, M.iron, [0.9, 0.7, 0.5]);
      return;
    case 'hotelstadtberlin':
      // The tall slab is on the north edge, where it never stands between the camera and the hero.
      b.box(M.concrete, F(0, 3, 4), w + 6, 6, d + 6, CREAM);
      b.box(M.concrete, F(0, 22, 0), w, 44, d, CREAM);
      return;
    case 'sbahnalex':
    case 'sbahnhackescher':
      // A station hall on the viaduct: walk under it, the glass roof above the deck.
      b.box(M.brick, F(0, 8.2, 0), w, 3.4, d, BRICK);
      b.geo(M.glass, new CylinderGeometry(l.hx, l.hx, d, 10, 1, true, -Math.PI / 2, Math.PI), new Matrix4().copy(F(0, 9.9, 0)).multiply(new Matrix4().makeRotationX(Math.PI / 2)), [0.85, 1.1, 1.05]);
      return;
    case 'hausdeslehrers':
      // Tower block with the mosaic frieze (yellow, blue and red bands) round the second floor.
      b.box(M.concrete, F(0, 3, 0), w, 6, d, [0.6, 0.7, 0.75]);
      b.box(M.stucco, F(0, 8, 0), w + 0.1, 4, d + 0.1, BLUE);
      for (const [y, c] of [[6.7, YELLOW], [9.3, RED]] as Array<[number, RGB]>) b.box(M.stucco, F(0, y, 0), w + 0.15, 0.5, d + 0.15, c);
      b.box(M.glass, F(0, 21, 0), w, 22, d, [0.75, 0.9, 1]);
      return;
    case 'kongresshalle':
      b.box(M.glass, F(0, 2.5, 0), w, 5, d, [0.75, 0.9, 1]);
      b.geo(M.concrete, new SphereGeometry(l.hx * 0.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new Matrix4().copy(F(0, 5, 0)).multiply(new Matrix4().makeScale(1, 0.35, 1)), CREAM);
      return;
    case 'kino':
      b.box(M.glass, F(0, 2.2, 1), w - 4, 4.4, d - 2, [0.75, 0.9, 1]);
      b.box(M.concrete, F(0, 7, 0), w, 5.4, d, CREAM);
      b.box(M.stucco, F(0, 10.2, -1), w * 0.6, 1.4, 0.3, BLUE);
      return;
    case 'cafemoskau':
      b.box(M.glass, F(0, 2, 0), w, 4, d, [0.75, 0.9, 1]);
      b.box(M.concrete, F(0, 5.5, 0), w, 3, d, CREAM);
      cyl(0.3, 0.3, 5, 7, M.iron, GREY, l.hx - 2, 0);
      b.geo(M.iron, new SphereGeometry(0.9, 12, 8), F(l.hx - 2, 12.5, 0), YELLOW);
      return;
  }
}

/**
 * The brick Stadtbahn: a deck `h` meters up on piers, walls closed between the arches the streets pass
 * through (each piece of `MapDef.viaducts` is one closed run; its colliders are `barrierColliders`).
 */
export function buildStadtbahn(chunkOf: (x: number, z: number) => ChunkBuilder, mats: MapMats, v: Viaduct): void {
  for (let i = 1; i < v.pts.length; i++) {
    const [ax, az] = v.pts[i - 1]!, [bx, bz] = v.pts[i]!, len = Math.hypot(bx - ax, bz - az);
    if (len < 0.5) continue;
    const ry = Math.atan2(bx - ax, bz - az), n = Math.max(1, Math.round(len / 8));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2, seg = len / n;
      const b = chunkOf(cx, cz), m = new Matrix4().makeRotationY(ry).setPosition(cx, 0, cz);
      const at = (x: number, y: number, z: number): Matrix4 => m.clone().multiply(new Matrix4().setPosition(x, y, z));
      // Bricked-up arch (the wall the collider stands for), the deck and its parapets.
      b.box(mats.brick, at(0, v.h / 2 - 0.4, 0), v.width, v.h - 0.8, seg, BRICK);
      b.box(mats.brick, at(0, v.h - 0.1, 0), v.width + 0.6, 0.8, seg, [0.85, 0.62, 0.55]);
      for (const s of [-1, 1]) b.box(mats.brick, at(s * (v.width / 2 + 0.15), v.h + 0.8, 0), 0.3, 1, seg, BRICK);
      for (const s of [-1, 1]) b.box(mats.railSteel, at(s * 1.6, v.h + 0.4, 0), 0.12, 0.15, seg);
      // Ivy over the bricks on every second bay (the district grew wild).
      if (k % 2 === 0) b.box(mats.ivy, at(v.width / 2 + 0.05, v.h / 2, 0), 0.1, v.h * 0.7, seg * 0.6, GREEN);
    }
  }
}

/** Arch decks: where a street passes, the deck spans over it on two piers (no collider below). */
export function buildArches(chunkOf: (x: number, z: number) => ChunkBuilder, mats: MapMats, m: MapDef): void {
  const runs = (m.viaducts ?? []).filter((v) => v.kind === 'stadtbahn');
  for (let i = 1; i < runs.length; i++) {
    const a = runs[i - 1]!.pts[runs[i - 1]!.pts.length - 1]!, c = runs[i]!.pts[0]!, v = runs[i]!;
    const cx = (a[0] + c[0]) / 2, cz = (a[1] + c[1]) / 2, len = Math.hypot(c[0] - a[0], c[1] - a[1]), ry = Math.atan2(c[0] - a[0], c[1] - a[1]);
    const b = chunkOf(cx, cz), mm = new Matrix4().makeRotationY(ry).setPosition(cx, 0, cz);
    const at = (x: number, y: number, z: number): Matrix4 => mm.clone().multiply(new Matrix4().setPosition(x, y, z));
    b.box(mats.brick, at(0, v.h - 0.6, 0), v.width + 0.6, 1.8, len + 0.2, [0.85, 0.62, 0.55]);
    for (const s of [-1, 1]) b.box(mats.brick, at(s * (v.width / 2 + 0.15), v.h + 0.8, 0), 0.3, 1, len, BRICK);
    // A painted iron beam over the street: GDR blue with a yellow stripe.
    for (const s of [-1, 1]) b.box(mats.iron, at(s * (v.width / 2 + 0.05), v.h - 1.1, 0), 0.12, 0.8, len, s < 0 ? BLUE : YELLOW);
  }
}
