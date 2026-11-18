// M15 Alexanderplatz blockout (`docs/tasks/m15-alexanderplatz.md`, step 2): the brick Stadtbahn viaduct
// with open arches, and massing for the district landmarks (silhouette, height and colour only). The
// landmarks get their real models from photos in step 4; this keeps the layout readable until then.
import { CircleGeometry, CylinderGeometry, Matrix4, PlaneGeometry, SphereGeometry, TorusGeometry, type BufferGeometry, type Material } from 'three';
import type { Landmark, Lot, MapDef, Viaduct } from '../data/map';
import { blockFacades } from './map-world';
import { FLOOR_H, GROUND_H, PARAPET, Run } from './world';
import type { Facade } from '../data/courtyard';
import type { ChunkBuilder, MapMats } from './map-world';
import { Rng } from '../sim/math';
import { archWindow, cached, ENDS, frameOf, frustum, pane, SLOPES, sub, type Frame, type RGB } from './landmarks';
import { atlasUv, POSTER_ASPECT, posterUv, type AtlasKey, type PosterKey } from './alex-paint';

export const ALEX_KINDS = new Set<Landmark['kind']>([
  'altesmuseum', 'dom', 'palast', 'fernsehturm', 'marienkirche', 'neptunbrunnen', 'rotesrathaus', 'nikolaikirche',
  'weltzeituhr', 'brunnen', 'hotelstadtberlin', 'sbahnalex', 'sbahnhackescher', 'hausdeslehrers', 'kongresshalle', 'kino', 'cafemoskau',
]);

// Pioneer palette (`docs/style-bible.md` › GDR / Pioneer direction) as vertex tints.
const CREAM: RGB = [1.15, 1.08, 0.95], BLUE: RGB = [0.45, 0.62, 1.05], YELLOW: RGB = [1.35, 1.1, 0.45], RED: RGB = [1.1, 0.45, 0.42];
const SAND: RGB = [1.08, 0.96, 0.78], BRICK: RGB = [1.05, 0.72, 0.6], GREEN: RGB = [0.55, 0.8, 0.65], GREY: RGB = [0.85, 0.85, 0.85];
const COPPER: RGB = [0.68, 1.08, 0.9], BRONZE: RGB = [1.25, 1.1, 0.82], BRASS: RGB = [1.4, 1.15, 0.6], ALU: RGB = [1.05, 1.05, 1.02];
const TERRACOTTA: RGB = [1.2, 0.85, 0.6], WHITE: RGB = [1.45, 1.42, 1.34];

/** A plane (x, y; z out) whose UVs are the atlas region `key`. */
function atlasPlane(b: ChunkBuilder, m: Matrix4, w: number, h: number, key: AtlasKey, color?: RGB): void {
  const mat = b.mm.alex;
  if (!mat) return;
  const [u0, v0, u1, v1] = atlasUv(key);
  const g = cached(`ap${w},${h},${key}`, () => {
    const p = new PlaneGeometry(w, h), uv = p.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return p;
  });
  b.geo(mat, g, m, color);
}

/** A painted banner or the Pioneer poster (2D art) of height h, its width from the image; z out. */
export function posterPlane(b: { mm: MapMats; geo: ChunkBuilder['geo'] }, m: Matrix4, h: number, key: PosterKey): void {
  const mat = b.mm.posters;
  if (!mat) return;
  const w = h * POSTER_ASPECT[key], [u0, v0, u1, v1] = posterUv(key);
  const g = cached(`pp${h},${key}`, () => {
    const p = new PlaneGeometry(w, h), uv = p.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return p;
  });
  b.geo(mat, g, m);
}

/** An open cylinder band (radius r, height h, `seg` sides) wrapped with the atlas region `key`. */
function atlasBand(b: ChunkBuilder, m: Matrix4, r: number, h: number, seg: number, key: AtlasKey, color?: RGB): void {
  const mat = b.mm.alex;
  if (!mat) return;
  const [u0, v0, u1, v1] = atlasUv(key);
  const g = cached(`ab${r},${h},${seg},${key}`, () => {
    const c = new CylinderGeometry(r, r, h, seg, 1, true), uv = c.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return c;
  });
  b.geo(mat, g, m, color);
}

/** A glass front: atlas panes tiled over len × h from height y0 (frame `m` at the face centre, z out). */
function glassFace(b: ChunkBuilder, m: Matrix4, len: number, y0: number, h: number, key: AtlasKey, cell = 6): void {
  const nx = Math.max(1, Math.round(len / cell)), ny = Math.max(1, Math.round(h / cell)), cw = len / nx, ch = h / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) atlasPlane(b, sub(m, (i + 0.5) * cw - len / 2, y0 + (j + 0.5) * ch, 0.03), cw, ch, key);
}

/** All four faces of a w × d glass box from y0 to y0 + h, with a dark core so no face is empty. */
function glassBox(b: ChunkBuilder, F: Frame, w: number, d: number, y0: number, h: number, key: AtlasKey, cz = 0, cell = 6): void {
  b.box(b.mm.concrete, F(0, y0 + h / 2, cz), w, h, d, [0.35, 0.4, 0.42]);
  for (const f of faces(F, w, d, cz)) glassFace(b, f.m, f.len, y0, h, key, cell);
}

/** A row of windows along a face: frame `m` at the face centre (z out), `n` panes of w × h at height y. */
function windowRow(b: ChunkBuilder, m: Matrix4, len: number, y: number, w: number, h: number, step: number, rng: Rng, lit: number, arched = false): void {
  const n = Math.max(1, Math.floor(len / step));
  for (let k = 0; k < n; k++) {
    const x = (k + 0.5 - n / 2) * (len / n);
    if (arched) archWindow(b, sub(m, x, y, 0), w, h, rng, lit, false);
    else pane(b, sub(m, x, y, 0), w, h, rng, lit);
  }
}

/** The four faces of a w × d box: frame at each face centre (z out), and its length. */
function faces(F: Frame, w: number, d: number, cz = 0): Array<{ m: Matrix4; len: number }> {
  return [
    { m: F(0, 0, cz + d / 2), len: w },
    { m: F(w / 2, 0, cz, Math.PI / 2), len: d },
    { m: F(-w / 2, 0, cz, -Math.PI / 2), len: d },
    { m: F(0, 0, cz - d / 2, Math.PI), len: w },
  ];
}

/** A simple standing figure (bronze or stone): legs, body, arms, head; `pose` raises one arm. */
function figure(b: ChunkBuilder, m: Matrix4, s: number, color: RGB, pose = 0): void {
  const M = b.mm;
  const c = (r0: number, r1: number, h: number): BufferGeometry => cached(`fig${r0},${r1},${h}`, () => new CylinderGeometry(r0, r1, h, 8));
  for (const x of [-0.12, 0.12]) b.geo(M.iron, c(0.08, 0.09, 0.85), sub(m, x * s, 0.42 * s, 0).multiply(new Matrix4().makeScale(s, s, s)), color);
  b.geo(M.iron, c(0.2, 0.17, 0.75), sub(m, 0, 1.2 * s, 0).multiply(new Matrix4().makeScale(s, s, s)), color);
  b.geo(M.iron, cached('figHead', () => new SphereGeometry(0.12, 10, 8)), sub(m, 0, 1.72 * s, 0).multiply(new Matrix4().makeScale(s, s, s)), color);
  b.geo(M.iron, c(0.055, 0.06, 0.65), sub(m, 0.27 * s, 1.2 * s, 0, 0, 0, 0.15).multiply(new Matrix4().makeScale(s, s, s)), color);
  b.geo(M.iron, c(0.055, 0.06, 0.65), sub(m, -0.3 * s, (1.2 + pose * 0.45) * s, 0, 0, 0, -0.15 - pose * 2.4).multiply(new Matrix4().makeScale(s, s, s)), color);
}

/** Landmark models from reference photos (step 4). Heights compressed about like the footprints. */
export function buildAlexLandmark(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm, F = frameOf(l), w = l.hx * 2, d = l.hz * 2, rng = new Rng(Math.round(l.x * 31 + l.z * 17));
  const cyl = (rt: number, rb: number, h: number, y: number, mat: Material = M.concrete, color: RGB = GREY, x = 0, z = 0, seg = 16): void => b.geo(mat, cached(`c${rt},${rb},${h},${seg}`, () => new CylinderGeometry(rt, rb, h, seg)), F(x, y + h / 2, z), color);
  const ball = (r: number, y: number, mat: Material = M.concrete, color: RGB = GREY, x = 0, z = 0, sy = 1): void => b.geo(mat, cached(`s${r}`, () => new SphereGeometry(r, 18, 12)), F(x, y, z).multiply(new Matrix4().makeScale(1, sy, 1)), color);
  const dome = (r: number, y: number, mat: Material, color: RGB, x = 0, z = 0, sy = 1.15): void => b.geo(mat, cached(`d${r}`, () => new SphereGeometry(r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2)), F(x, y, z).multiply(new Matrix4().makeScale(1, sy, 1)), color);
  switch (l.kind) {
    case 'weltzeituhr': {
      // Urania-Weltzeituhr (Erich John, 1969), 10 m: compass-rose mosaic, column with two small clocks,
      // a 24-sided drum (city panels above and below the red hour band with gold numerals), the mast and
      // the orbit sculpture. The Stillstand turned it clockwork: brass gear teeth under the drum, cable
      // boxes at its foot, ivy up the column. It wakes up as the final boss (step 7).
      b.geo(M.stucco, cached('wzRose', () => new CircleGeometry(4.2, 32)), F(0, 0.03, 0, 0).multiply(new Matrix4().makeRotationX(-Math.PI / 2)), [1.1, 0.75, 0.72]);
      b.geo(M.stucco, cached('wzRose2', () => new CircleGeometry(3.3, 32)), F(0, 0.04, 0).multiply(new Matrix4().makeRotationX(-Math.PI / 2)), [0.95, 0.93, 0.88]);
      for (let k = 0; k < 8; k++) b.box(M.stucco, F(0, 0.05, 0, (k * Math.PI) / 4), 0.22, 0.02, k % 2 ? 4.4 : 6.4, k % 2 ? [0.7, 0.5, 0.5] : [0.55, 0.55, 0.6]);
      cyl(0.45, 0.48, 2.75, 0, M.concrete, [0.95, 0.93, 0.88]);
      for (const s of [-1, 1]) b.geo(M.clock, cached('wzClock', () => new CircleGeometry(0.24, 16)), F(s * 0.47, 2.15, 0, (s * Math.PI) / 2));
      // Clockwork foot: two cable boxes and the ivy.
      for (const s of [-1, 1]) {
        b.box(M.iron, F(s * 1.1, 0.45, -0.6), 0.6, 0.9, 0.4, s < 0 ? YELLOW : [0.8, 0.85, 0.8]);
        b.box(M.rubber, F(s * 0.6, 0.06, -0.55), 1.1, 0.08, 0.1, [0.4, 0.4, 0.4]);
      }
      b.box(M.ivy, F(0, 1.2, 0.47), 0.6, 2.2, 0.02, GREEN);
      // Hammer and sickle on the column, at eye height, facing the plaza.
      atlasPlane(b, F(0, 1.55, 0.49), 0.5, 0.5, 'emblem');
      // The drum.
      const y0 = 2.75, R = 2.95;
      b.geo(M.stucco, cached('wzCap', () => new CylinderGeometry(R, R, 0.12, 24)), F(0, y0 + 0.06, 0), ALU);
      b.geo(M.stucco, cached('wzCap', () => new CylinderGeometry(R, R, 0.12, 24)), F(0, y0 + 2.72, 0), ALU);
      atlasBand(b, F(0, y0 + 0.55, 0), R, 0.9, 24, 'cities');
      atlasBand(b, F(0, y0 + 1.37, 0, Math.PI / 24), R + 0.03, 0.74, 24, 'hours');
      atlasBand(b, F(0, y0 + 2.2, 0, Math.PI / 12), R, 0.9, 24, 'cities');
      b.geo(M.dark, cached('wzBot', () => new CircleGeometry(R - 0.05, 24)), F(0, y0 + 0.01, 0).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
      for (let k = 0; k < 24; k++) b.box(M.iron, F(Math.sin((k * Math.PI) / 12) * (R - 0.15), y0 - 0.12, Math.cos((k * Math.PI) / 12) * (R - 0.15), (k * Math.PI) / 12), 0.28, 0.22, 0.32, BRASS);
      // Mast and orbit sculpture (spins when it wakes).
      cyl(0.13, 0.16, 2.4, y0 + 2.78, M.iron, [0.6, 0.6, 0.62]);
      const c = y0 + 5.0;
      ball(0.38, c, M.stucco, [1.35, 1.35, 1.38]);
      b.box(M.iron, F(0, c, 0, 0.3), 4.6, 0.07, 0.07, [0.5, 0.5, 0.52]);
      for (let k = 0; k < 5; k++) b.geo(M.iron, cached('wzRing', () => new TorusGeometry(2.25, 0.035, 5, 48)), F(0, c, 0, k * 0.63).multiply(new Matrix4().makeRotationX(Math.PI / 2 + 0.35 * Math.sin(k * 1.7))), [0.7, 0.7, 0.72]);
      for (let k = 0; k < 9; k++) {
        const a = k * 0.7 + 0.3, r = 2.25, t = Math.sin(k * 2.3) * 0.9;
        ball(0.12 + (k % 3) * 0.05, c + t, M.stucco, k % 4 === 0 ? BRASS : [1.35, 1.35, 1.38], Math.sin(a) * Math.sqrt(r * r - t * t), Math.cos(a) * Math.sqrt(r * r - t * t));
      }
      return;
    }
    case 'dom': {
      // Berliner Dom: sandstone front of paired columns, a central arched portal with a mosaic lunette over
      // a broad stair, corner towers and the big verdigris dome with lantern. Front faces west, the Lustgarten.
      const H = 11, bodyD = d - 2;
      b.box(M.stucco, F(0, 0.3, l.hz - 1.2), w * 0.55, 0.6, 2.4, SAND);
      b.box(M.stucco, F(0, 0.15, l.hz - 0.4), w * 0.62, 0.3, 0.8, SAND);
      b.box(M.stucco, F(0, H / 2, -1), w, H, bodyD, SAND);
      for (const f of faces(F, w, bodyD, -1)) {
        windowRow(b, f.m, f.len - 4, 3.2, 1.3, 2.4, 4, rng, 0.05, true);
        windowRow(b, f.m, f.len - 4, 7.6, 1.2, 2.2, 4, rng, 0.05, true);
      }
      const fz = l.hz - 2 + 0.3;
      // Portal: deep arch, gold mosaic lunette, dark doors.
      b.box(M.stucco, F(0, 4.2, fz + 0.2), 5.4, 8.4, 0.6, [1.15, 1.02, 0.84]);
      b.box(M.dark, F(0, 1.7, fz + 0.52), 2.4, 3.4, 0.05);
      b.geo(M.stucco, cached('domLun', () => new CircleGeometry(1.9, 16, 0, Math.PI)), F(0, 4.3, fz + 0.52), [1.45, 1.15, 0.55]);
      for (const x of [-3.3, -2.6, 2.6, 3.3, -8.6, -7.9, 7.9, 8.6]) cyl(0.3, 0.33, 8.6, 0.6, M.stucco, [1.12, 1.0, 0.82], x, fz + 0.5);
      for (const x of [-5.6, 5.6]) figure(b, F(x, 0.6, fz + 0.9), 1.15, COPPER, x < 0 ? 1 : 0);
      // The south side (the camera sees it from the Schlossplatz): paired columns and the side portal.
      const side = F(l.hx, 0, -1, Math.PI / 2);
      for (const x of [-7.6, -6.9, -1.6, -0.9, 0.9, 1.6, 6.9, 7.6]) b.geo(M.stucco, cached('domCol', () => new CylinderGeometry(0.28, 0.31, 8.4, 10)), sub(side, x, 4.8, 0.4), [1.12, 1.0, 0.82]);
      b.box(M.stucco, sub(side, 0, 3.6, 0.2), 3.6, 7.2, 0.4, [1.15, 1.02, 0.84]);
      b.box(M.dark, sub(side, 0, 1.5, 0.42), 1.8, 3, 0.05);
      b.geo(M.stucco, cached('domLun2', () => new CircleGeometry(1.3, 14, 0, Math.PI)), sub(side, 0, 3.4, 0.42), [1.45, 1.15, 0.55]);
      b.box(M.stucco, sub(side, 0, 0.25, 0.9), 6, 0.5, 1.6, SAND);
      b.box(M.stucco, F(0, H + 0.4, -1), w + 0.6, 0.8, bodyD + 0.6, [1.12, 1.0, 0.84]);
      b.box(M.stucco, F(0, H + 1.7, -1), w - 3, 1.8, bodyD - 3, SAND);
      // Corner towers.
      for (const x of [-l.hx + 2.4, l.hx - 2.4]) {
        b.box(M.stucco, F(x, H + 3.5, fz - 2.4), 4.2, 7, 4.2, SAND);
        windowRow(b, F(x, 0, fz - 0.29), 4, H + 3.2, 1.2, 2.6, 4, rng, 0, true);
        cyl(1.9, 1.9, 1.4, H + 7, M.stucco, SAND, x, fz - 2.4);
        dome(1.9, H + 8.4, M.stucco, COPPER, x, fz - 2.4, 1.3);
        cyl(0.25, 0.35, 1.4, H + 10.8, M.stucco, COPPER, x, fz - 2.4);
        ball(0.25, H + 12.4, M.iron, BRASS, x, fz - 2.4);
      }
      // The main dome over its drum.
      cyl(7.2, 7.4, 4.5, H + 2.6, M.stucco, SAND, 0, -2);
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; archWindow(b, F(Math.sin(a) * 7.42, H + 4.8, -2 + Math.cos(a) * 7.42, a), 1.1, 2.2, rng, 0, false); }
      dome(7.2, H + 7.1, M.stucco, COPPER, 0, -2, 1.2);
      cyl(0.9, 1.1, 3, H + 15.6, M.stucco, COPPER, 0, -2);
      ball(0.5, H + 19, M.iron, BRASS, 0, -2);
      b.box(M.iron, F(0, H + 20.2, -2), 0.12, 1.4, 0.12, BRASS);
      b.box(M.iron, F(0, H + 20.5, -2), 0.7, 0.12, 0.12, BRASS);
      return;
    }
    case 'rotesrathaus': {
      // Rotes Rathaus: red-orange brick block with arched windows in three storeys, the terracotta frieze
      // ("Steinerne Chronik") over the ground floor, a corbelled cornice, and the clock tower in the middle
      // of the front (north, the Rathausstraße). The route passes south of it: windows and frieze run round.
      const H = 15;
      b.box(M.brick, F(0, H / 2, 0), w, H, d, BRICK);
      for (const f of faces(F, w, d)) {
        windowRow(b, f.m, f.len - 2, 2.2, 1.3, 2.6, 3.3, rng, 0.08, true);
        b.box(M.stucco, sub(f.m, 0, 4.4, 0.06), f.len, 0.9, 0.12, TERRACOTTA);
        windowRow(b, f.m, f.len - 2, 7.2, 1.3, 3, 3.3, rng, 0.1, true);
        windowRow(b, f.m, f.len - 2, 11.6, 1.1, 2.4, 3.3, rng, 0.06, true);
        b.box(M.brick, sub(f.m, 0, H - 0.6, 0.15), f.len + 0.3, 1.2, 0.3, [0.95, 0.62, 0.5]);
        b.box(M.stucco, sub(f.m, 0, 0.35, 0.08), f.len, 0.7, 0.16, [0.75, 0.72, 0.66]);
      }
      const tz = l.hz - 4;
      b.box(M.brick, F(0, H + 9, tz), 7.5, 18, 7.5, BRICK);
      for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const m = F(Math.sin(r) * 3.76, 0, tz + Math.cos(r) * 3.76, r);
        archWindow(b, sub(m, -1, H + 4, 0), 0.9, 3.6, rng, 0, false);
        archWindow(b, sub(m, 1, H + 4, 0), 0.9, 3.6, rng, 0, false);
        b.geo(M.clock, cached('rrClock', () => new CircleGeometry(1.2, 20)), sub(m, 0, H + 11, 0.05));
        b.box(M.brick, sub(m, 0, H + 17.6, 0.2), 7.9, 0.8, 0.4, [0.95, 0.62, 0.5]);
      }
      b.geo(M.slate, frustum(7.6, 7.6, 1, 6, 6), F(0, H + 18, tz), [0.5, 0.55, 0.6]);
      b.geo(M.iron, cached('rrSpire', () => new CylinderGeometry(0.15, 1.4, 6, 8)), F(0, H + 22, tz), [0.6, 0.62, 0.66]);
      b.box(M.iron, F(0, H + 26, tz), 0.08, 3, 0.08);
      atlasPlane(b, F(0.8, H + 26.5, tz), 1.4, 0.9, 'banner');
      return;
    }
    case 'fernsehturm': {
      // Fernsehturm foot: the pavilion with its folded, pointed roof wings round the shaft (the cue at street
      // level), the tapering concrete shaft, the sphere and the red and white antenna above the camera.
      // The tower is the finale (its own district): the doors are chained.
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 6, cx = Math.sin(a) * 9.5, cz = Math.cos(a) * 9.5;
        glassBox(b, (x, y, z, ry = 0) => F(cx, y, cz, a).multiply(new Matrix4().makeRotationY(ry).setPosition(x, 0, z)), 9, 7, 0, 4.4, 'foyer', 0, 4.4);
        b.geo(M.concrete, frustum(10, 8, 3.2, 0, 8, SLOPES | ENDS), F(cx, 4.4, cz, a + Math.PI / 2), WHITE);
        b.box(M.concrete, F(cx, 4.45, cz, a), 10.2, 0.25, 8.2, WHITE);
      }
      b.box(M.iron, F(0, 1.4, 14.3), 3.2, 2.8, 0.2, [0.5, 0.5, 0.5]);
      b.box(M.iron, F(0, 1.4, 14.42), 2.6, 0.1, 0.05, [0.7, 0.7, 0.7]);
      atlasPlane(b, F(-3.2, 3.2, 14.4), 1.6, 0.5, 'stripe');
      cyl(3.2, 4.6, 66, 0, M.concrete, [1.1, 1.08, 1.02]);
      ball(8.5, 72, M.stucco, [0.95, 1.0, 1.08]);
      cyl(8.6, 8.6, 1.4, 70.8, M.glass, [0.7, 0.8, 0.9]);
      for (let k = 0; k < 6; k++) cyl(0.5, 0.6, 3.5, 80 + k * 3.5, M.iron, k % 2 ? RED : WHITE);
      return;
    }
    case 'marienkirche': {
      // St. Marien: brick hall church, tall pointed windows, the west tower with its stone storey and the
      // green neo-Gothic spire. Front (tower) faces west.
      const H = 11, tz = l.hz - 3;
      b.box(M.brick, F(0, H / 2, -2), w, H, d - 4, BRICK);
      for (const f of faces(F, w, d - 4, -2)) if (f.len > w) windowRow(b, f.m, f.len - 6, 5.2, 1.4, 6, 3.6, rng, 0.06, true);
      b.geo(M.roof, frustum(w + 0.6, d - 3.6, 5, w + 0.6, 0, SLOPES | ENDS), F(0, H, -2, Math.PI / 2), [1.0, 0.75, 0.62]);
      // The tower: fieldstone below, the copper top with its lantern above the camera.
      b.box(M.stucco, F(0, 9, tz), 6.4, 18, 6, [1.0, 0.9, 0.72]);
      archWindow(b, F(0, 0, tz + 3.01), 1.6, 3.2, rng, 0, false);
      b.box(M.door, F(0, 1.4, tz + 3.02), 1.6, 2.8, 0.05);
      b.box(M.stucco, F(0, 18.3, tz), 6.8, 0.6, 6.4, CREAM);
      b.box(M.stucco, F(0, 20.8, tz), 5.2, 4.4, 5.2, COPPER);
      b.geo(M.stucco, cached('mkSpire', () => new CylinderGeometry(0.15, 3.7, 11, 4)), F(0, 26.5, tz, Math.PI / 4), COPPER);
      return;
    }
    case 'neptunbrunnen': {
      // Neptunbrunnen (Begas 1891): a red granite basin, Neptune on a rock with four tritons, the four
      // river women on the rim. Bronze turns green-black.
      // Four-lobed basin of red granite.
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2, x = Math.sin(a) * l.hx * 0.42, z = Math.cos(a) * l.hx * 0.42;
        cyl(l.hx * 0.58, l.hx * 0.58 + 0.15, 0.7, 0, M.stucco, [1.0, 0.62, 0.58], x, z, 20);
        b.geo(M.water, cached('nbWater', () => new CylinderGeometry(l.hx * 0.58 - 0.4, l.hx * 0.58 - 0.4, 0.1, 20)), F(x, 0.62, z));
      }
      cyl(1.6, 2.1, 1.6, 0.6, M.stucco, [0.7, 0.65, 0.6], 0, 0, 7);
      cyl(0.75, 0.95, 0.9, 2.2, M.iron, BRONZE);
      figure(b, F(0, 3.1, 0), 1.25, [0.6, 0.85, 0.7], 1);
      b.box(M.iron, F(0.55, 4.6, 0, 0, 0), 0.06, 3, 0.06, [0.6, 0.85, 0.7]);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        b.box(M.iron, F(Math.sin(a) * (l.hx - 0.4), 0.95, Math.cos(a) * (l.hx - 0.4), a + Math.PI / 2), 1.5, 0.5, 0.6, [0.6, 0.85, 0.7]);
        ball(0.22, 1.45, M.iron, [0.6, 0.85, 0.7], Math.sin(a) * (l.hx - 0.4), Math.cos(a) * (l.hx - 0.4));
      }
      return;
    }
    case 'nikolaikirche': {
      // Nikolaikirche: brick church in the Nikolaiviertel, the stone tower base and two slender green
      // spires over the west front.
      const H = 10, tz = l.hz - 2.5;
      b.box(M.brick, F(0, H / 2, -1), w, H, d - 2, BRICK);
      for (const f of faces(F, w, d - 2, -1)) if (f.len > w) windowRow(b, f.m, f.len - 6, 4.6, 1.2, 5, 3.4, rng, 0.06, true);
      b.geo(M.roof, frustum(w + 0.5, d - 1.6, 4.4, w + 0.5, 0, SLOPES | ENDS), F(0, H, -1, Math.PI / 2), [1.0, 0.75, 0.62]);
      b.box(M.brick, F(0, 7, tz), w, 14, 5, BRICK);
      b.box(M.stucco, F(0, 0.8, tz), w + 0.2, 1.6, 5.2, [0.85, 0.82, 0.76]);
      b.box(M.door, F(0, 1.5, tz + 2.51), 1.8, 3, 0.05);
      archWindow(b, F(0, 0, tz + 2.51), 1.4, 2.6, rng, 0, true);
      for (const x of [-1.7, 1.7]) {
        b.box(M.brick, F(x, 16, tz), 2.4, 4, 2.4, BRICK);
        b.geo(M.stucco, cached('nkSpire', () => new CylinderGeometry(0.08, 1.5, 9, 8)), F(x, 22.5, tz), COPPER);
      }
      return;
    }
    case 'brunnen': {
      // Brunnen der Völkerfreundschaft (Walter Womacka, 1970): copper funnel bowls (square, opening upward)
      // on posts at many heights in a spiral, water falling from bowl to bowl; the basin wall is clad in
      // coloured enamel mosaic.
      cyl(l.hx, l.hx, 0.9, 0, M.stucco, [0.9, 0.88, 0.84], 0, 0, 28);
      const mos: RGB[] = [BLUE, YELLOW, RED, [0.5, 0.8, 0.6], CREAM];
      for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; b.box(M.stucco, F(Math.sin(a) * (l.hx + 0.02), 0.45, Math.cos(a) * (l.hx + 0.02), a), (Math.PI * 2 * l.hx) / 28 + 0.05, 0.75, 0.06, mos[k % mos.length]); }
      b.geo(M.water, cached('bvWater', () => new CylinderGeometry(l.hx - 0.4, l.hx - 0.4, 0.1, 28)), F(0, 0.82, 0));
      for (let k = 0; k < 11; k++) {
        const a = k * 1.15, r = 0.6 + (k % 4) * 1.15, y = 1.4 + k * 0.42, bw = 2.2 - (k % 3) * 0.4, x = Math.sin(a) * r, z = Math.cos(a) * r;
        cyl(0.16, 0.2, y - 0.9, 0.9, M.stucco, [0.75, 0.55, 0.42], x, z, 8);
        b.geo(M.stucco, cached(`bvFun${bw}`, () => new CylinderGeometry(bw * 0.72, 0.18, 0.75, 4, 1)), F(x, y + 0.37, z, Math.PI / 4 + a), [1.15, 0.72, 0.48]);
      }
      return;
    }
    case 'hotelstadtberlin': {
      // Interhotel Stadt Berlin: a white slab with vertical window strips on a wide low base; tall, but on the
      // north edge where it never stands between the camera and the hero.
      b.box(M.concrete, F(0, 3, 3), w + 6, 6, d + 4, CREAM);
      windowRow(b, F(0, 0, 3 + (d + 4) / 2), w + 4, 3, 2.6, 2.4, 3.2, rng, 0.2);
      b.box(M.concrete, F(0, 26, 0), w, 52, d, [1.2, 1.18, 1.12]);
      glassFace(b, F(0, 0, l.hz + 0.02), w - 1, 6, 44, 'curtain', 5.5);
      return;
    }
    case 'sbahnalex':
    case 'sbahnhackescher': {
      // Station hall on the viaduct: walk under it. Brick sides, the glass barrel roof, and at street level
      // the enamel name board with the S roundel (the cue the camera sees).
      b.box(M.brick, F(-l.hx + 0.3, 8.2, 0), 0.6, 3.4, d, BRICK);
      b.box(M.brick, F(l.hx - 0.3, 8.2, 0), 0.6, 3.4, d, BRICK);
      b.geo(M.glass, cached(`sbVault${l.hx},${d}`, () => new CylinderGeometry(l.hx, l.hx, d, 10, 1, true, -Math.PI / 2, Math.PI)), F(0, 9.9, 0).multiply(new Matrix4().makeRotationX(-Math.PI / 2)), [0.85, 1.1, 1.05]);
      for (const s of [-1, 1]) {
        const m = F(s * (l.hx + 0.35), 4.2, 0, (s * Math.PI) / 2);
        atlasPlane(b, m, 6.5, 0.8, l.kind === 'sbahnalex' ? 'alex' : 'hackescher');
        b.geo(M.sRoundel, cached('sbRound', () => new CircleGeometry(0.55, 18)), sub(m, 3.9, 0, 0.02));
      }
      return;
    }
    case 'hausdeslehrers': {
      // Haus des Lehrers (1964): glass curtain-wall tower on a low base, wrapped by Womacka's mosaic frieze
      // "Unser Leben" over the first floors: blue, yellow and red, the strongest GDR cue on the Alex.
      // The frieze sits low (3.2 to 7.4 m) so the game camera sees it from the Allee.
      glassBox(b, F, w - 1, d - 1, 0, 3.2, 'foyer', 0, 3.2);
      for (const f of faces(F, w, d)) atlasPlane(b, sub(f.m, 0, 5.3, 0.02), f.len, 4.2, 'frieze');
      b.box(M.concrete, F(0, 5.3, 0), w, 4.2, d, BLUE);
      b.box(M.concrete, F(0, 3.25, 0), w + 0.3, 0.3, d + 0.3, CREAM);
      b.box(M.concrete, F(0, 7.5, 0), w + 0.3, 0.3, d + 0.3, CREAM);
      glassBox(b, F, w, d, 7.65, 27, 'curtain', 0, 6.75);
      b.box(M.concrete, F(0, 34.9, 0), w + 0.2, 0.6, d + 0.2, CREAM);
      return;
    }
    case 'kongresshalle': {
      // Kongresshalle: glass hall under a shallow shell dome, the ceramic frieze in blue.
      glassBox(b, F, w, d, 0, 5, 'foyer', 0, 5);
      b.box(M.concrete, F(0, 5.4, 0), w + 0.4, 0.8, d + 0.4, BLUE);
      b.geo(M.concrete, cached('khDome', () => new SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2)), F(0, 5.8, 0).multiply(new Matrix4().makeScale(l.hx * 0.8, 2.4, l.hz * 0.9)), CREAM);
      return;
    }
    case 'kino': {
      // Kino International (1963): a recessed dark ground floor, the big glazed foyer above it, and the
      // cream band with KINO INTERNATIONAL over the glass, facing the Allee.
      b.box(M.concrete, F(0, 2, -0.8), w - 2, 4, d - 2.4, [0.45, 0.48, 0.5]);
      glassFace(b, F(0, 0, l.hz - 2), w - 2, 0.6, 3.2, 'foyer', 3.2);
      b.box(M.concrete, F(0, 4.2, 0), w, 0.4, d, CREAM);
      glassBox(b, F, w, d, 4.4, 4.6, 'curtain', 0, 4.6);
      b.box(M.concrete, F(0, 10.4, 0), w, 3.2, d, [1.15, 1.1, 1.0]);
      atlasPlane(b, F(0, 10.4, l.hz + 0.03), w * 0.8, 1.3, 'kino');
      return;
    }
    case 'cafemoskau': {
      // Café Moskau: a glass pavilion with a closed upper storey, the Sputnik model on its mast over the
      // entrance (front to the Allee, north) and the lettering on the east end seen from the route.
      glassBox(b, F, w, d, 0, 4, 'foyer', 0, 4);
      b.box(M.concrete, F(0, 5.5, 0), w, 3, d, CREAM);
      atlasPlane(b, F(0, 5.5, l.hz + 0.02), w * 0.7, 1.2, 'moskau');
      atlasPlane(b, F(l.hx + 0.02, 5.5, 0, Math.PI / 2), d * 0.9, 1.0, 'moskau');
      cyl(0.12, 0.15, 6, 7, M.iron, GREY, l.hx - 2, l.hz - 1.5);
      ball(0.7, 13.4, M.stucco, [1.35, 1.35, 1.38], l.hx - 2, l.hz - 1.5);
      for (let k = 0; k < 4; k++) b.box(M.iron, F(l.hx - 2 + Math.sin(k * 1.57 + 0.6) * 1.1, 12.6, l.hz - 1.5 + Math.cos(k * 1.57 + 0.6) * 1.1, k * 1.57 + 0.6), 0.05, 0.05, 2.4, GREY);
      return;
    }
    case 'altesmuseum': {
      // Altes Museum (Schinkel): 18 Ionic columns across the front on a high plinth, the broad central
      // stair, the attic block over the hidden dome. Front faces south to the Lustgarten.
      b.box(M.stucco, F(0, 0.75, -0.3), w, 1.5, d - 0.6, SAND);
      b.box(M.stucco, F(0, 0.4, l.hz - 0.4), 8, 0.8, 0.8, SAND);
      b.box(M.stucco, F(0, 5.6, -1.2), w - 1, 8.2, d - 2.4, CREAM);
      for (let k = 0; k < 18; k++) cyl(0.3, 0.34, 7, 1.5, M.stucco, WHITE, -l.hx + 0.9 + k * ((w - 1.8) / 17), l.hz - 1);
      b.box(M.stucco, F(0, 9, -0.3), w, 1, d - 0.6, CREAM);
      b.box(M.stucco, F(0, 10.6, -1.5), 10, 2.2, 5, CREAM);
      return;
    }
    case 'palast': {
      // Palast der Republik: the long front of bronze mirror glass between white marble ends; in the
      // Stillstand a glass house grew on its roof (the Wurzel-Mutter's den, zone 1 boss).
      const H = 13;
      glassBox(b, F, w - 7, d - 0.4, 0, H, 'bronze', 0, 3.25);
      for (const x of [-l.hx + 1.75, l.hx - 1.75]) b.box(M.stucco, F(x, H / 2, 0), 3.5, H, d, WHITE);
      b.box(M.stucco, F(0, H + 0.3, 0), w, 0.6, d + 0.2, WHITE);
      // The glass house: a vault along the roof (its lower half stays inside the building).
      b.geo(M.glass, cached(`plVault${w},${d}`, () => new CylinderGeometry(l.hz - 1.5, l.hz - 1.5, w - 9, 14, 1, true)), F(0, H + 0.5, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), [0.8, 1.2, 1]);
      b.box(M.ivy, F(2, 4, l.hz + 0.03), 9, 8, 0.02, GREEN);
      return;
    }
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
      // Ivy over the bricks on every second bay (the district grew wild), posters pasted on the others.
      if (k % 2 === 0) b.box(mats.ivy, at(v.width / 2 + 0.05, v.h / 2, 0), 0.1, v.h * 0.7, seg * 0.6, GREEN);
      if (k % 2 === 1) for (const s of [-1, 1]) posterPlane(b, at(s * (v.width / 2 + 0.06), 2.1, 0).multiply(new Matrix4().makeRotationY((s * Math.PI) / 2)), 1.5, 'pioneer');
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

/**
 * Step 5 dressing of the district's ordinary buildings (only on this map): Plattenbau entrances with a
 * concrete canopy and the hammer-and-sickle crest, red banners down some fronts, the Pioneer mosaic on
 * some gable ends; Altbau gets an occasional banner; pavilions get their state shop sign.
 */
export function dressAlexLots(chunkOf: (x: number, z: number) => ChunkBuilder, lots: Lot[], ground: (x: number, z: number) => number, lotCut: (l: Lot) => { id: number; y: number } | undefined): void {
  for (const l of lots) {
    if (l.kind === 'tree' || l.kind === 'special' || l.kind === 'house' || l.ruin) continue;
    const rng = new Rng(l.seed * 17 + 3), b = chunkOf(l.x, l.z), y0 = ground(l.x, l.z), cut = lotCut(l);
    const sides = blockFacades(l);
    const runOf = (i: number): Run => { const s = sides[i]!; return new Run({ id: 'ad', style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1], depth: 1, floors: 0, tone: 'cream', features: [], seed: 1 } as Facade); };
    const front = sides.findIndex((s) => s.face === 0);
    if (front < 0) continue;
    const fs = sides[front]!, fr = runOf(front), H = GROUND_H + l.floors * FLOOR_H;
    const dress = (fn: () => void): void => (cut ? b.cut(cut.id, cut.y, () => b.on(y0, fn)) : b.on(y0, fn));
    dress(() => {
      if (l.kind === 'shop') {
        // A letter board on the roof edge, readable from the street and from the camera (pavilions on the
        // camera side turn their front away from it).
        const key = rng.pick(['shop0', 'shop1', 'shop2', 'shop3', 'shop4', 'shop5'] as AtlasKey[]), sw = Math.min(fs.len - 1, 5.2);
        const sign = fr.mat(fs.len / 2, GROUND_H + 0.75, -0.7);
        atlasPlane(b, sign, sw, 1.0, key);
        atlasPlane(b, sign.clone().multiply(new Matrix4().makeRotationY(Math.PI)), sw, 1.0, key);
        for (const dx of [-sw / 2 + 0.3, sw / 2 - 0.3]) b.box(b.mm.iron, fr.mat(fs.len / 2 + dx, GROUND_H + 0.15, -0.7), 0.08, 0.5, 0.08, [0.6, 0.6, 0.6]);
        b.box(b.mm.concrete, fr.mat(fs.len / 2, GROUND_H - 0.35, 0.25), fs.len + 0.2, 0.3, 0.6, CREAM);
        return;
      }
      if (l.kind === 'platte') {
        // The painted banners of the 2D game hang down the front, red and blue.
        if (l.floors >= 4 && rng.next() < 0.55) for (let k = 0; k < (fs.len > 22 ? 2 : 1); k++) posterPlane(b, fr.mat(fs.len * (k ? rng.range(0.6, 0.85) : rng.range(0.15, 0.4)), Math.min(H - 2.6, 8), 0.08), 4.4, rng.pick<PosterKey>(['red', 'blue']));
        // Pioneer mosaic on a gable end.
        const gable = sides.findIndex((s) => s.face === 1 || s.face === 3);
        if (gable >= 0 && l.floors >= 3 && rng.next() < 0.5) {
          const gs = sides[gable]!, gr = runOf(gable), mh = Math.min(H - 4.6, (gs.len - 1.2) / POSTER_ASPECT.pioneer);
          posterPlane(b, gr.mat(gs.len / 2, GROUND_H + 0.3 + mh / 2, 0.06), mh, 'pioneer');
        }
        return;
      }
      if (l.kind === 'altbau' && l.floors >= 2 && rng.next() < 0.3) posterPlane(b, fr.mat(fs.len * rng.range(0.3, 0.7), GROUND_H + FLOOR_H, 0.08), 3.6, rng.pick<PosterKey>(['red', 'blue']));
    });
    // Pioneer posters pasted at eye height, the cue the game camera sees (`docs/maps/landmarks.md`): one,
    // sometimes a torn pair, on about half of the fronts.
    if (rng.next() < 0.5) dress(() => {
      const n = rng.next() < 0.3 ? 2 : 1, s0 = rng.range(1.3, Math.max(1.4, fs.len - 2.8));
      for (let k = 0; k < n; k++) posterPlane(b, fr.mat(s0 + k * 1.3, 1.85 + k * 0.08, 0.09 + k * 0.01, 0, rng.range(-0.06, 0.06)), 1.5, 'pioneer');
    });
  }
}

/** Beyond the east bound on the Allee axis: the two Zuckerbäcker towers of the Strausberger Platz (render only). */
export function buildStrausberger(chunkOf: (x: number, z: number) => ChunkBuilder, m: MapDef): void {
  const allee = m.streets.find((s) => s.name === 'Karl-Marx-Allee');
  if (!allee) return;
  const [, z] = allee.pts[allee.pts.length - 1]!, x = m.bounds.maxX + 34;
  for (const dz of [-24, 24]) {
    const b = chunkOf(m.bounds.maxX - 2, z + dz), at = (px: number, y: number, pz: number): Matrix4 => new Matrix4().setPosition(x + px, y, z + dz + pz);
    const M = b.mm, ZB: RGB = [1.2, 1.12, 0.95];
    // Wings along the square, the tower with set-back storeys, the gilded spire.
    b.box(M.stucco, at(-6, 11, 0), 30, 22, 14, ZB);
    b.box(M.stucco, at(0, 20, 0), 14, 40, 14, ZB);
    b.box(M.stucco, at(0, 42, 0), 10, 8, 10, ZB);
    b.box(M.stucco, at(0, 48, 0), 7, 5, 7, ZB);
    b.geo(M.iron, cached('zbSpire', () => new CylinderGeometry(0.15, 0.9, 9, 8)), at(0, 55, 0), BRASS);
    b.box(M.stucco, at(-6, 22.5, 0), 30.6, 1, 14.6, [1.3, 1.0, 0.55]);
    for (let y = 3; y < 38; y += 3.2) b.box(M.windows, at(-6, y, -7.03), 28, 1.4, 0.02);
  }
}

/**
 * A Plattenbau slab of the WBS 70 kind (this map, intact lots): light concrete panels with dark joints, a
 * grid of windows, a grey plinth, the glass entrance under a concrete canopy with the crest, loggias on the
 * long sides (`loggia` is the shared builder), flat roof with the lift housing.
 */
export function buildAlexPlatte(b: ChunkBuilder, l: Lot, loggia: (f: Facade, seed: number) => void): void {
  const M = b.mm, rng = new Rng(l.seed * 7 + 1), H = GROUND_H + l.floors * FLOOR_H, sides = blockFacades(l);
  const panel: RGB = rng.pick<RGB>([[1.08, 1.04, 0.95], [1.0, 0.98, 0.92], [1.1, 1.0, 0.85]]);
  const at = (x: number, y: number, z: number): Matrix4 => new Matrix4().makeRotationY(l.rot).setPosition(x, y, z);
  b.box(M.concrete, at(l.x, H / 2, l.z), l.w - 0.1, H, l.d - 0.1, panel);
  b.shadowBox(at(l.x, H / 2, l.z), l.w, H, l.d);
  const entrance = rng.range(0.25, 0.75);
  sides.forEach((s, i) => {
    if (s.len < 2) return;
    const f: Facade = { id: `pl${l.seed}-${i}`, style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1], depth: 1, floors: l.floors, tone: 'cream', features: [], seed: (l.seed + i * 13) % 997 } as Facade;
    const r = new Run(f), long = s.face === 0 || s.face === 2;
    // Joints: every slab and every 3.6 m panel; plinth.
    for (let k = 0; k <= l.floors; k++) b.box(M.concrete, r.mat(s.len / 2, GROUND_H + k * FLOOR_H - 0.05, 0.03), s.len, 0.09, 0.03, [0.45, 0.44, 0.42]);
    for (let x = 3.6; x < s.len - 0.5; x += 3.6) b.box(M.concrete, r.mat(x, H / 2, 0.03), 0.08, H, 0.03, [0.52, 0.5, 0.47]);
    b.box(M.concrete, r.mat(s.len / 2, 0.45, 0.06), s.len, 0.9, 0.06, [0.62, 0.62, 0.6]);
    if (!long) return;
    // Windows: two per panel on every floor, smaller on the ground floor; the entrance on the front.
    const door = s.face === 0 ? s.len * entrance : -99;
    for (let k = -1; k < l.floors; k++) {
      const y = k < 0 ? 2.4 : GROUND_H + k * FLOOR_H + 1.6;
      for (let x = 1.0; x < s.len - 0.6; x += 1.8) {
        if (Math.abs(x - door) < 2.2 && k < 0) continue;
        pane(b, r.mat(x, y, 0.02), k < 0 ? 1.1 : 1.3, k < 0 ? 1.1 : 1.4, rng, 0.05);
      }
    }
    if (s.face === 0) {
      b.box(M.dark, r.mat(door, 1.3, 0.04), 2.2, 2.5, 0.03);
      b.box(M.iron, r.mat(door, 1.3, 0.06), 0.06, 2.5, 0.03, [0.7, 0.7, 0.7]);
      b.box(M.concrete, r.mat(door, 2.85, 0.85), 3.4, 0.2, 1.7, [0.85, 0.83, 0.78]);
      for (const dx of [-1.5, 1.5]) b.box(M.iron, r.mat(door + dx, 1.4, 1.55), 0.08, 2.8, 0.08, [0.7, 0.7, 0.7]);
      atlasPlane(b, r.mat(door, 3.65, 0.05), 0.75, 0.75, 'emblem');
    }
    if (l.floors >= 2) b.solid.excludeOccluder(() => loggia(f, l.seed * 3 + i));
  });
  // Roof: tar, parapet edge, the lift housing.
  b.box(M.tar, at(l.x, H + 0.05, l.z), l.w - 0.3, 0.1, l.d - 0.3, [0.6, 0.6, 0.6]);
  b.box(M.concrete, at(l.x, H + PARAPET / 2, l.z), l.w, PARAPET, l.d, panel.map((c) => c * 0.9) as unknown as RGB);
  const [hx, hz] = [l.x + Math.cos(l.rot) * l.w * 0.2, l.z - Math.sin(l.rot) * l.w * 0.2];
  b.box(M.concrete, at(hx, H + 1.4, hz), 3, 2.8, 4, panel);
}
