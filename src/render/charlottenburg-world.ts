// M16 Charlottenburg (1920) in code: the blockout of task step 2 (`docs/tasks/m16-charlottenburg.md`).
// Colliders live in `src/data/map.ts` and `src/data/charlottenburg.ts` (`OPEN_PARTS` for the gates and the
// two roofless halls, the platform terrace and its train); this only draws.
// Landmarks: one massing model per kind in its real proportions (heights compressed about 0.75, as Mitte)
// and 1920 colours: light stucco and sandstone, slate and copper-green roofs, the church in dark tuff with
// five towers, the Schloss pale yellow under its green dome and figure, the station hall as bare iron
// arches. Recognisable silhouette first; step 4 replaces the kinds with builders from pre-1930 photos in
// `charlottenburg-citywest.ts`, `-kudamm.ts` and `-schloss.ts` (asked first, the massing is the fallback).
// District pieces (`buildCharlottenburgWorld`): the brick Stadtbahn (the Alexanderplatz renderer, plain, no
// GDR dressing) with its street arches, the platform deck of Bahnhof Zoo with the arrived train and the stair,
// the maze hedges and the iron fences of the Zoo and the garden.
//
// Cost: no new material. Everything is merged into existing chunk batches (stucco, slate, enamel for copper
// and gilding, iron, brick, glass, concrete, mossy and ivy for hedges, car paint and car glass for the
// train, the window atlas), so a chunk gains at most the batches of those it did not use yet.
import { CylinderGeometry, Matrix4, SphereGeometry, type BufferGeometry, type Material } from 'three';
import { OPEN_PARTS, type Landmark, type LandmarkKind, type MapDef, type Pt, type Terrace, type Wall, WALL_KIND } from '../data/map';
import { Rng } from '../sim/math';
import { buildArches, buildStadtbahn } from './alex-world';
import { frustum, pane, sub, type RGB } from './landmarks';
import { lm as lmShared, type ChunkBuilder, type MapMats } from './map-world';
import type { LitMaterial } from './materials';
import type { WearOptions } from './landmark-wear';
export type { RGB } from './landmarks';
import { buildCitywest } from './charlottenburg-citywest';
import { buildKudamm } from './charlottenburg-kudamm';
import { buildSchloss } from './charlottenburg-schloss';

export const CHARLOTTENBURG_KINDS = new Set<LandmarkKind>([
  'zoobahnhof', 'loewentor', 'elefantentor', 'aquarium', 'musikpavillon', 'antilopenhaus', 'ufapalast', 'capitol', 'gedaechtniskirche',
  'romanischescafe', 'gloriapalast', 'marmorhaus', 'kadewe', 'wittenbergplatz', 'cafewestens', 'revuepalast', 'theaterwestens', 'variete',
  'opernhaus', 'schillertheater', 'hochschule', 'chtor', 'stuelerbau', 'ehrenhoftor', 'schlossmitte', 'schlossfluegel', 'neuerfluegel',
  'orangerie', 'gartentor', 'mausoleum', 'belvedere',
]);

/** Landmark wear on this map: soot, cracks, broken windows and rubble, no graffiti (1920). */
export const CHARLOTTENBURG_WEAR: WearOptions = { graffiti: false };

/** 1920 tints on the light base materials (stucco, enamel) and the dark ones (iron, slate). */
export const C = {
  stucco: [1.05, 1.0, 0.9], cream: [1.12, 1.05, 0.88], sand: [0.96, 0.86, 0.68], ochre: [1.02, 0.86, 0.6], white: [1.3, 1.27, 1.2],
  schloss: [1.18, 1.04, 0.64], tuff: [0.52, 0.47, 0.42], tuffDark: [0.4, 0.36, 0.33], slate: [0.75, 0.78, 0.85], copper: [0.42, 0.72, 0.6],
  gold: [1.2, 0.92, 0.42], iron: [0.55, 0.57, 0.6], brick: [1.0, 0.7, 0.58], green: [0.3, 0.45, 0.26], train: [0.28, 0.36, 0.3],
} satisfies Record<string, RGB>;

/** Landmark frame at local (x, y, z), turned by `ry` about that point (the shared `lm` turns the offset too). */
export function lm(l: Landmark, x = 0, y = 0, z = 0, ry = 0): Matrix4 {
  const m = lmShared(l, x, y, z);
  return ry ? m.multiply(new Matrix4().makeRotationY(ry)) : m;
}

const geos = new Map<string, BufferGeometry>();
export function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geos.get(key);
  if (!g) geos.set(key, (g = make()));
  return g;
}

/** What a landmark builder gets: the chunk, the materials, the landmark and a seeded random. */
export interface Ctx { b: ChunkBuilder; M: MapMats; l: Landmark; rng: Rng }

/** Box standing on local y `y` (its bottom), centred at local (x, z). */
export function blk(c: Ctx, mat: Material, x: number, y: number, z: number, w: number, h: number, d: number, tint?: RGB, ry = 0): void {
  c.b.box(mat, lm(c.l, x, y + h / 2, z, ry), w, h, d, tint);
}
export function cyl(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, r: number, h: number, tint?: RGB, seg = 12, top = r): void {
  c.b.geo(mat, cached(`cy${r.toFixed(2)},${top.toFixed(2)},${h.toFixed(2)},${seg}`, () => new CylinderGeometry(top, r, h, seg)), lm(c.l, x, y + h / 2, z), tint);
}
/** Half sphere (a dome) of radius r on local y `y`; `sy` stretches it up. */
export function dome(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, r: number, tint?: RGB, sy = 1): void {
  c.b.geo(mat, cached(`dome${r.toFixed(2)}`, () => new SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2)), lm(c.l, x, y, z).multiply(new Matrix4().makeScale(1, sy, 1)), tint);
}
/** Hip roof, mansard or spire (`frustum`): base w × d, top tw × td, height h. */
export function roof(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, w: number, d: number, h: number, tw: number, td: number, tint?: RGB, ry = 0): void {
  c.b.geo(mat, frustum(w, d, h, tw, td), lm(c.l, x, y, z, ry), tint);
}
/** Window panes on the faces of a local box (front +z, back −z, sides ±x), `rows` heights of the window centres. */
export function windows(c: Ctx, x: number, z: number, w: number, d: number, rows: number[], faces: { front?: boolean; back?: boolean; sides?: boolean } = { front: true, sides: true }, lit = 0.3, ww = 1.1, wh = 1.7, bay = 3.2): void {
  const put = (along: number, n: number, ry: number, ox: number, oz: number): void => {
    const k = Math.max(1, Math.floor(along / bay));
    for (let i = 0; i < k; i++) {
      const t = -along / 2 + (i + 0.5) * (along / k);
      for (const y of rows) {
        const lx = ox + Math.cos(ry) * t + Math.sin(ry) * n, lz = oz - Math.sin(ry) * t + Math.cos(ry) * n;
        pane(c.b, lm(c.l, lx, y, lz, ry), ww, wh, c.rng, lit);
      }
    }
  };
  if (faces.front) put(w, d / 2 + 0.01, 0, x, z);
  if (faces.back) put(w, d / 2 + 0.01, Math.PI, x, z);
  if (faces.sides) { put(d, w / 2 + 0.01, Math.PI / 2, x, z); put(d, w / 2 + 0.01, -Math.PI / 2, x, z); }
}
/** A stucco block with windows and a roof: the Altbau massing of most sights. */
export function house(c: Ctx, x: number, z: number, w: number, d: number, h: number, tint: RGB, roofH = 3, roofMat?: LitMaterial, roofTint: RGB = C.slate, rows?: number[]): void {
  const M = c.M;
  blk(c, M.stucco, x, 0, z, w, h, d, tint);
  blk(c, M.stucco, x, h - 0.5, z, w + 0.4, 0.5, d + 0.4, tint);
  windows(c, x, z, w, d, rows ?? Array.from({ length: Math.max(1, Math.floor((h - 1.5) / 3.3)) }, (_, i) => 2 + i * 3.3).filter((y) => y < h - 1));
  if (roofH > 0) roof(c, roofMat ?? M.slate, x, h, z, w, d, roofH, Math.max(0.5, w - roofH * 1.6), Math.max(0.5, d - roofH * 1.6), roofTint);
}
/** Thin figure on a plinth (statues, the Schloss Fortuna): a stack of tapered blocks. */
export function figure(c: Ctx, mat: LitMaterial, x: number, y: number, z: number, h: number, tint: RGB): void {
  cyl(c, mat, x, y, z, h * 0.13, h * 0.55, tint, 6, h * 0.08);
  c.b.geo(mat, cached('fig-head', () => new SphereGeometry(1, 6, 4)), lm(c.l, x, y + h * 0.66, z).multiply(new Matrix4().makeScale(h * 0.1, h * 0.12, h * 0.1)), tint);
  blk(c, mat, x, y + h * 0.42, z, h * 0.55, h * 0.06, h * 0.08, tint);
}
/** A colonnade of `n` round columns from x0 to x1 at local z, height h. */
export function columns(c: Ctx, x0: number, x1: number, z: number, h: number, n: number, r = 0.35, tint: RGB = C.white): void {
  for (let i = 0; i < n; i++) cyl(c, c.M.stucco, x0 + ((x1 - x0) * i) / Math.max(1, n - 1), 0, z, r, h, tint, 8);
}
/** Iron bars between x0 and x1 at local z (fence infill), height h, from y. */
export function bars(c: Ctx, x0: number, x1: number, z: number, y: number, h: number, step = 0.28, tint: RGB = C.iron): void {
  const n = Math.max(1, Math.round((x1 - x0) / step));
  for (let i = 0; i <= n; i++) blk(c, c.M.iron, x0 + ((x1 - x0) * i) / n, y, z, 0.04, h, 0.04, tint);
  for (const yy of [y + 0.15, y + h - 0.2]) blk(c, c.M.iron, (x0 + x1) / 2, yy, z, x1 - x0, 0.06, 0.06, tint);
}

/**
 * A roofless walk-in hall (E2): its `OPEN_PARTS` walls as standing ruins. The north wall (local −z) stands
 * at `tall`, the side walls fall from it to `low` toward the camera, the camera-side wall stays below
 * `low` and broken; lintels close the door gaps of the north wall above `door`.
 */
export function openHall(c: Ctx, tall: number, low: number, door: number, tint: RGB): void {
  const parts = OPEN_PARTS[c.l.kind] ?? [], M = c.M, hz = c.l.hz;
  const hAt = (z: number): number => low + (tall - low) * Math.max(0, Math.min(1, (hz - 1 - z) / (2 * hz - 2)));
  const north = parts.filter((p) => p.hz < 1 && p.z < 0), south = parts.filter((p) => p.hz < 1 && p.z > 0), sides = parts.filter((p) => p.hz >= 1);
  for (const p of north) {
    blk(c, M.stucco, p.x, 0, p.z, p.hx * 2, tall, p.hz * 2, tint);
    windows(c, p.x, p.z, p.hx * 2, p.hz * 2, [2.2, ...[5.6, 9, 12.4, 15.8].filter((y) => y < tall - 1.2)], { front: false, back: true }, 0.35, 1.4, 2.2, 3.6);
  }
  // Lintels over the gaps between the north wall pieces (the doors).
  const xs = [...north].sort((a, b) => a.x - b.x);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1]!, q = xs[i]!, x0 = a.x + a.hx, x1 = q.x - q.hx;
    if (x1 - x0 > 0.2) blk(c, M.stucco, (x0 + x1) / 2, door, a.z, x1 - x0 + 0.1, tall - door, a.hz * 2, tint);
  }
  // Side walls in 2 m pieces falling toward the camera, with ragged tops.
  for (const p of sides) {
    const n = Math.ceil((p.hz * 2) / 2);
    for (let i = 0; i < n; i++) {
      const z0 = p.z - p.hz + (i * p.hz * 2) / n, z1 = p.z - p.hz + ((i + 1) * p.hz * 2) / n, h = Math.max(0.8, hAt((z0 + z1) / 2) * c.rng.range(0.82, 1.05));
      blk(c, M.stucco, p.x, 0, (z0 + z1) / 2, p.hx * 2, h, z1 - z0 + 0.02, tint);
    }
  }
  // The camera-side wall: low and broken (the collider stays whole).
  for (const p of south) {
    const n = Math.ceil((p.hx * 2) / 1.6);
    for (let i = 0; i < n; i++) {
      const x0 = p.x - p.hx + (i * p.hx * 2) / n, x1 = p.x - p.hx + ((i + 1) * p.hx * 2) / n;
      blk(c, M.stucco, (x0 + x1) / 2, 0, p.z, x1 - x0 + 0.02, c.rng.range(0.5, Math.min(low, 2.2)), p.hz * 2, tint);
    }
  }
  // Rubble from the fallen roof along the inner walls.
  for (let i = 0; i < 14; i++) {
    const s = c.rng.range(0.4, 1.2), x = c.rng.range(-c.l.hx + 1.5, c.l.hx - 1.5), z = c.rng.next() < 0.5 ? c.rng.range(-hz + 1.2, -hz + 3) : c.rng.range(hz - 3, hz - 1.2);
    c.b.box(M.stucco, lm(c.l, x, s * 0.25, z, c.rng.range(0, 3)), s, s * 0.5, s * c.rng.range(0.8, 1.4), [0.8, 0.77, 0.72]);
  }
}

// ---------------------------------------------------------------- massing per kind (step 2)

function massing(c: Ctx): void {
  const { M, l } = c, W = l.hx * 2, D = l.hz * 2;
  switch (l.kind) {
    case 'zoobahnhof': {
      // The 1882 hall: bare iron arch ribs over the platform deck (built from the terrace), no glass, no roof
      // skin, so the camera always sees the hero. Local z runs along the rail; the deck is at 6.5 m.
      const y0 = 6.5, span = l.hx, rise = 8, n = 9;
      for (let z = -l.hz + 0.8; z <= l.hz - 0.8; z += (2 * l.hz - 1.6) / 4) {
        for (let i = 0; i < n; i++) {
          const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n);
          const x0 = -Math.cos(a0) * span, y0a = y0 + Math.sin(a0) * rise, x1 = -Math.cos(a1) * span, y1 = y0 + Math.sin(a1) * rise;
          const len = Math.hypot(x1 - x0, y1 - y0a), rz = Math.atan2(y1 - y0a, x1 - x0);
          c.b.box(M.iron, lm(l, (x0 + x1) / 2, (y0a + y1) / 2, z).multiply(new Matrix4().makeRotationZ(rz)), len + 0.05, 0.2, 0.12, C.iron);
        }
        // Feet on brackets beside the deck.
        for (const s of [-1, 1]) blk(c, M.iron, s * span, y0 - 1.4, z, 0.3, 1.6, 0.3, C.iron);
      }
      // Purlins along the hall: eaves and crown.
      for (const [x, y] of [[-span * 0.92, y0 + rise * 0.38], [span * 0.92, y0 + rise * 0.38], [0, y0 + rise]] as Array<[number, number]>) blk(c, M.iron, x, y, 0, 0.12, 0.12, D - 1.2, C.iron);
      return;
    }
    case 'loewentor': case 'elefantentor': case 'gartentor': {
      // Two pillars and a roof bar; the passage between them stays open (`OPEN_PARTS`).
      const parts = OPEN_PARTS[l.kind]!, ele = l.kind === 'elefantentor', garden = l.kind === 'gartentor';
      const ph = garden ? 3.4 : ele ? 4.2 : 4.6;
      for (const p of parts) {
        blk(c, M.stucco, p.x, 0, p.z, p.hx * 2, ph, p.hz * 2, garden ? C.sand : C.stucco);
        blk(c, M.stucco, p.x, ph, p.z, p.hx * 2 + 0.3, 0.35, p.hz * 2 + 0.3, C.sand);
        // The lions on the Löwentor pillars, the elephants under the Elefantentor roof, urns on the garden gate.
        if (l.kind === 'loewentor') { blk(c, M.stucco, p.x, ph + 0.35, p.z, 0.8, 0.9, 1.9, C.sand); blk(c, M.stucco, p.x, ph + 1.1, p.z + 0.7, 0.75, 0.75, 0.6, C.sand); }
        if (ele) { blk(c, M.stucco, p.x - Math.sign(p.x) * 0.2, 0, p.z, p.hx * 2 + 0.2, 2.6, p.hz * 2 + 0.6, C.sand); }
        if (garden) cyl(c, M.stucco, p.x, ph + 0.35, p.z, 0.3, 0.7, C.sand, 8, 0.4);
      }
      const span = Math.abs(parts[1]!.x - parts[0]!.x) + parts[0]!.hx * 2;
      if (ele) {
        // Pagoda roof over the passage, copper green with a red ridge.
        blk(c, M.stucco, 0, ph, 0, span, 0.6, 3.2, C.ochre);
        roof(c, M.enamel, 0, ph + 0.6, 0, span + 1.6, 4.4, 1.8, span - 2, 0.6, C.copper);
        blk(c, M.enamel, 0, ph + 2.4, 0, span - 1.6, 0.25, 0.3, [0.9, 0.3, 0.22]);
      } else if (garden) {
        // A wrought-iron arch over the open garden gate.
        for (let i = 0; i < 7; i++) {
          const a0 = Math.PI * (i / 7), a1 = Math.PI * ((i + 1) / 7), r = parts[1]!.x - parts[1]!.hx;
          const x0 = -Math.cos(a0) * r, y0 = ph + Math.sin(a0) * 1.2, x1 = -Math.cos(a1) * r, y1 = ph + Math.sin(a1) * 1.2;
          c.b.box(M.iron, lm(l, (x0 + x1) / 2, (y0 + y1) / 2, 0).multiply(new Matrix4().makeRotationZ(Math.atan2(y1 - y0, x1 - x0))), Math.hypot(x1 - x0, y1 - y0), 0.1, 0.1, C.iron);
        }
      } else {
        blk(c, M.stucco, 0, ph - 0.2, 0, span, 0.7, 2.2, C.stucco);
        blk(c, M.enamel, 0, ph + 0.5, 0, span * 0.5, 0.5, 0.2, C.gold);
      }
      return;
    }
    case 'aquarium':
      house(c, 0, 0, W, D, 9, C.ochre, 2.5);
      blk(c, M.stucco, 0, 0, l.hz, 3.4, 4.2, 0.6, C.sand);
      return;
    case 'musikpavillon': {
      // Octagonal bandstand: a stone ring, eight slim iron columns, a copper roof with a lantern.
      cyl(c, M.stucco, 0, 0, 0, l.hx, 0.9, C.sand, 8);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cyl(c, M.iron, Math.sin(a) * (l.hx - 0.4), 0.9, Math.cos(a) * (l.hx - 0.4), 0.09, 3.2, C.iron, 6); }
      c.b.geo(M.enamel, cached('mp-roof', () => new CylinderGeometry(0.4, 4.6, 2.4, 8)), lm(l, 0, 5.3, 0), C.copper);
      cyl(c, M.enamel, 0, 6.5, 0, 0.3, 1.2, C.copper, 8, 0.05);
      return;
    }
    case 'antilopenhaus': {
      // Moorish animal house: a long hall, a central dome, two small minaret towers.
      house(c, 0, 0, W, D, 6.5, C.ochre, 0);
      blk(c, M.stucco, 0, 6.5, 0, W + 0.4, 0.4, D + 0.4, [0.9, 0.45, 0.35]);
      cyl(c, M.stucco, 0, 6.9, 0, 2.6, 1.4, C.ochre, 12);
      dome(c, M.enamel, 0, 8.3, 0, 2.6, C.copper, 1.2);
      for (const s of [-1, 1]) { cyl(c, M.stucco, s * (l.hx - 1), 0, l.hz - 1, 0.7, 10, C.ochre, 8); dome(c, M.enamel, s * (l.hx - 1), 10, l.hz - 1, 0.75, C.copper, 1.5); }
      return;
    }
    case 'ufapalast': case 'gloriapalast': case 'marmorhaus': {
      // Cinemas: a tall block with a canopy over the entrance at 4 m and a lettering band on the roof edge.
      const h = l.kind === 'marmorhaus' ? 12 : 14, tint = l.kind === 'marmorhaus' ? C.white : l.kind === 'gloriapalast' ? C.cream : C.sand;
      house(c, 0, 0, W, D, h, tint, l.kind === 'gloriapalast' ? 3 : 0, M.slate, C.slate, [6.5, 10]);
      blk(c, M.iron, 0, 3.7, l.hz + 1.2, W * 0.8, 0.35, 2.4, [0.3, 0.3, 0.32]);
      blk(c, M.enamel, 0, h + 0.2, l.hz - 0.4, W * 0.7, 1.4, 0.2, C.gold);
      return;
    }
    case 'capitol': {
      // Capitol shop row: two two-storey front blocks round the passage, end walls down to the Zoo fence.
      for (const p of OPEN_PARTS.capitol!) {
        if (p.hz > 2.5) { blk(c, M.stucco, p.x, 0, p.z, p.hx * 2, 2.6, p.hz * 2, C.sand); continue; }
        blk(c, M.stucco, p.x, 0, p.z, p.hx * 2, 7.5, p.hz * 2, C.cream);
        blk(c, M.stucco, p.x, 7.2, p.z, p.hx * 2 + 0.3, 0.4, p.hz * 2 + 0.3, C.sand);
        windows(c, p.x, p.z, p.hx * 2, p.hz * 2, [1.8, 5.2], { front: true }, 0.45, 1.8, 2.2, 3);
      }
      // The passage canopy and the cinema's lettering band.
      blk(c, M.iron, 0, 4.2, 3, 4.4, 0.3, 4.2, [0.3, 0.3, 0.32]);
      blk(c, M.enamel, 8, 7.6, 4.6, 9, 1.2, 0.2, C.gold);
      return;
    }
    case 'gedaechtniskirche': {
      // Kaiser-Wilhelm-Gedächtniskirche (1895), whole: dark tuff, nave east–west, the tall west tower with its
      // spire, two turrets flanking it, the choir tower in the east and two turrets beside it (five towers).
      const T = C.tuff;
      blk(c, M.stucco, 1.5, 0, 0, W - 7, 13, D - 1, T);
      roof(c, M.slate, 1.5, 13, 0, W - 7, D - 1, 5, W - 7, 0.4, C.slate);
      // Transept across the middle.
      blk(c, M.stucco, 2, 0, 0, 7, 14, D + 3, T);
      roof(c, M.slate, 2, 14, 0, 7, D + 3, 4.5, 0.4, D + 3, C.slate, 0);
      // West tower: square shaft, belfry, spire.
      const wx = -l.hx + 3.5;
      blk(c, M.stucco, wx, 0, 0, 7, 32, 7, T);
      blk(c, M.stucco, wx, 32, 0, 7.6, 1, 7.6, C.tuffDark);
      blk(c, M.stucco, wx, 33, 0, 6, 6, 6, T);
      roof(c, M.slate, wx, 39, 0, 6.4, 6.4, 22, 0.2, 0.2, C.slate);
      for (const s of [-1, 1]) {
        // Turrets beside the west tower and beside the choir.
        blk(c, M.stucco, wx + 3.2, 0, s * 4.4, 2.2, 19, 2.2, T);
        roof(c, M.slate, wx + 3.2, 19, s * 4.4, 2.4, 2.4, 7, 0.1, 0.1, C.slate);
        blk(c, M.stucco, l.hx - 6, 0, s * 3.4, 2, 16, 2, T);
        roof(c, M.slate, l.hx - 6, 16, s * 3.4, 2.2, 2.2, 6, 0.1, 0.1, C.slate);
      }
      // Choir tower over the east end.
      blk(c, M.stucco, l.hx - 2.5, 0, 0, 5, 20, 5, T);
      roof(c, M.slate, l.hx - 2.5, 20, 0, 5.4, 5.4, 10, 0.2, 0.2, C.slate);
      // Rose window and portal on the south front (toward the camera), tall round-arched windows.
      windows(c, 1.5, 0, W - 7, D - 1, [6.5], { front: true, back: true }, 0.5, 1.4, 4.4, 3.4);
      blk(c, M.dark, wx, 0, 3.52, 2.4, 4.2, 0.05);
      return;
    }
    case 'romanischescafe':
      // Romanisches Haus: a corner house with a round corner tower.
      house(c, 0, 0, W, D, 15, C.sand, 3.5);
      cyl(c, M.stucco, l.hx - 1.2, 0, l.hz - 1.2, 2, 19, C.sand, 12);
      cyl(c, M.slate, l.hx - 1.2, 19, l.hz - 1.2, 2.3, 4, C.slate, 12, 0.05);
      blk(c, M.iron, 0, 3.6, l.hz + 1, W - 1, 0.3, 2, [0.3, 0.3, 0.32]);
      return;
    case 'kadewe':
      // KaDeWe Lichthof, roofless (E2): the tall street front on the north, sides falling to a broken wall on
      // the camera side; shelves along the inside of the front, iron ribs of the shattered glass roof.
      openHall(c, 17, 4, 4.6, C.cream);
      for (let x = -l.hx + 3; x < l.hx - 3; x += 4.2) {
        if ((x > -13.5 && x < -7.5) || (x > 5.5 && x < 11.5)) continue;
        blk(c, M.darkWood, x, 0, -l.hz + 1.4, 3.6, 2.6, 0.8, [0.75, 0.62, 0.5]);
      }
      for (let x = -l.hx + 4; x < l.hx - 3; x += 6) {
        const len = c.rng.range(5, 12);
        c.b.box(M.iron, lm(l, x, 17 - len * 0.35, -l.hz + 0.5 + len * 0.45).multiply(new Matrix4().makeRotationX(-0.75)), 0.2, 0.25, len, C.iron);
      }
      for (let i = 0; i < 20; i++) c.b.box(M.glass, lm(l, c.rng.range(-l.hx + 2, l.hx - 2), 0.04, c.rng.range(-l.hz + 2, l.hz - 2), c.rng.range(0, 3)), c.rng.range(0.3, 0.9), 0.04, c.rng.range(0.3, 0.9));
      return;
    case 'orangerie':
      // The burnt-out Orangerie as mirror gallery (E2): the tall garden wall with its door, falling sides, the
      // broken front onto the forecourt; tall mirror panels down the inside of the north wall.
      openHall(c, 10, 3, 4.2, C.schloss);
      for (let x = -l.hx + 2.5; x < l.hx - 2; x += 3.2) {
        if (x > -3.5 && x < 4) continue;
        blk(c, M.stucco, x, 0.6, -l.hz + 1.06, 2, 5.2, 0.12, C.gold);
        c.b.box(M.glass, lm(l, x, 3.2, -l.hz + 1.14), 1.6, 4.6, 0.06);
      }
      return;
    case 'wittenbergplatz':
      // U-Bahnhof Wittenbergplatz (1913): a low cross-shaped entrance hall.
      house(c, 0, 0, W, D, 6.5, C.sand, 3, M.slate, C.slate, [3.2]);
      blk(c, M.stucco, 0, 0, 0, W + 4, 7.5, 4, C.sand);
      roof(c, M.slate, 0, 7.5, 0, W + 4, 4, 2.5, W + 4, 0.3, C.slate);
      return;
    case 'cafewestens':
      // Corner house of the Café des Westens: Altbau with a corner dome.
      house(c, 0, 0, W, D, 15, C.stucco, 3);
      cyl(c, M.stucco, -l.hx + 1.5, 15, l.hz - 1.5, 1.8, 2, C.stucco, 12);
      dome(c, M.enamel, -l.hx + 1.5, 17, l.hz - 1.5, 1.9, C.copper, 1.4);
      blk(c, M.iron, 0, 3.6, l.hz + 1, W - 1, 0.3, 2, [0.3, 0.3, 0.32]);
      return;
    case 'revuepalast':
      // Revuepalast (invented, from the board): a white front with a fan-shaped crown on the roof.
      house(c, 0, 0, W, D, 13, C.white, 0, M.slate, C.slate, [6.5, 10]);
      c.b.geo(M.enamel, cached('rv-fan', () => new CylinderGeometry(5.5, 5.5, 0.4, 14, 1, false, -Math.PI / 2, Math.PI)), lm(l, 0, 13, l.hz - 1).multiply(new Matrix4().makeRotationX(Math.PI / 2)), C.gold);
      blk(c, M.iron, 0, 3.8, l.hz + 1.6, W - 2, 0.35, 3.2, [0.3, 0.3, 0.32]);
      return;
    case 'theaterwestens':
      // Theater des Westens (1896): front block and the taller stage house behind, a small dome on the front.
      house(c, 0, 1.5, W, D - 3, 12, C.sand, 2.5);
      blk(c, M.stucco, 0, 0, -l.hz + 2, W - 3, 17, 4, C.sand);
      roof(c, M.slate, 0, 17, -l.hz + 2, W - 3, 4, 2, W - 3, 0.4, C.slate);
      dome(c, M.enamel, 0, 14.5, 2, 2, C.copper, 1.3);
      return;
    case 'variete':
      // Gläsernes Varieté (invented): an iron frame filled with glass.
      blk(c, M.glass, 0, 0, 0, W - 0.4, 9, D - 0.4);
      for (let x = -l.hx; x <= l.hx + 0.01; x += W / 6) blk(c, M.iron, x, 0, l.hz - 0.2, 0.25, 9.6, 0.3, C.iron);
      for (const y of [3, 6, 9]) blk(c, M.iron, 0, y, l.hz - 0.2, W, 0.25, 0.32, C.iron);
      c.b.geo(M.glass, cached('vr-vault', () => new CylinderGeometry(l.hz - 0.5, l.hz - 0.5, W - 0.6, 12, 1, true, -Math.PI / 2, Math.PI)), lm(l, 0, 9, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)));
      return;
    case 'opernhaus':
      // Deutsches Opernhaus (1912): the long front with columns over broad steps, the high stage house behind.
      house(c, 0, 1, W, D - 2, 15, C.sand, 3);
      blk(c, M.stucco, 0, 0, -l.hz + 3.5, W * 0.55, 24, 7, C.sand);
      roof(c, M.slate, 0, 24, -l.hz + 3.5, W * 0.55, 7, 2.5, W * 0.55 - 5, 2, C.slate);
      columns(c, -9, 9, l.hz + 0.5, 11, 8, 0.45, C.cream);
      blk(c, M.stucco, 0, 11, l.hz + 0.5, 20, 1.2, 1.4, C.cream);
      for (let i = 0; i < 3; i++) blk(c, M.stucco, 0, i * 0.3, l.hz + 2.2 - i * 0.6, 22, 0.3, 1.2 + (2 - i) * 1.2, C.sand);
      return;
    case 'schillertheater':
      house(c, 0, 0, W, D, 14, C.cream, 3);
      cyl(c, M.stucco, 0, 0, l.hz - 2, 4, 12, C.cream, 16);
      return;
    case 'hochschule':
      // Technische Hochschule: a long palace front, a central projection with a dome.
      house(c, 0, 0, W, D, 15, C.sand, 3.5);
      blk(c, M.stucco, 0, 0, l.hz - 0.5, 9, 17, 2, C.sand);
      dome(c, M.enamel, 0, 18.5, 0, 3.5, C.copper, 1.2);
      cyl(c, M.stucco, 0, 15, 0, 3.4, 3.5, C.sand, 12);
      return;
    case 'chtor':
      // Charlottenburger Tor: two colonnade halves either side of the Chaussee, a figure on each.
      for (const p of OPEN_PARTS.chtor!) {
        blk(c, M.stucco, p.x, 0, p.z, p.hx * 2, 1.2, p.hz * 2, C.sand);
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) cyl(c, M.stucco, p.x + dx * (p.hx - 0.6), 1.2, p.z + dz * (p.hz - 0.6), 0.45, 8, C.sand, 8);
        blk(c, M.stucco, p.x, 9.2, p.z, p.hx * 2 + 0.4, 1.4, p.hz * 2 + 0.4, C.sand);
        figure(c, M.enamel, p.x, 10.6, p.z, 3.4, [0.5, 0.6, 0.5]);
      }
      return;
    case 'stuelerbau':
      // Stülerbau: a square block with a domed round tower in the middle.
      house(c, 0, 0, W, D, 11, C.sand, 2);
      cyl(c, M.stucco, 0, 11, 0, 2.6, 5, C.sand, 14);
      dome(c, M.enamel, 0, 16, 0, 2.7, C.copper, 1.1);
      columns(c, -2.4, 2.4, l.hz + 0.5, 6, 4, 0.3, C.cream);
      return;
    case 'schlossmitte': {
      // Schloss Charlottenburg, central block: pale yellow, mansard roof, the tower with the green dome and
      // the gilded Fortuna on top, the court front facing south onto the Ehrenhof (local +z).
      house(c, 0, 0, W, D, 13, C.schloss, 4, M.slate, C.slate, [2.4, 6, 9.6]);
      blk(c, M.stucco, 0, 0, l.hz - 0.6, 14, 15, 2.4, C.schloss);
      columns(c, -5, 5, l.hz + 0.8, 9.5, 4, 0.4, C.white);
      // Tower: drum, dome, lantern, figure.
      blk(c, M.stucco, 0, 13, 0, 9, 4, 9, C.schloss);
      cyl(c, M.stucco, 0, 17, 0, 4, 4.5, C.schloss, 16);
      dome(c, M.enamel, 0, 21.5, 0, 4.3, C.copper, 1.55);
      cyl(c, M.enamel, 0, 27.6, 0, 1, 2.8, C.copper, 8);
      dome(c, M.enamel, 0, 30.4, 0, 1.05, C.copper, 1.3);
      figure(c, M.enamel, 0, 31.6, 0, 3.6, C.gold);
      return;
    }
    case 'schlossfluegel':
      house(c, 0, 0, W, D, 11, C.schloss, 3.6, M.slate, C.slate, [2.4, 6, 9]);
      return;
    case 'neuerfluegel':
      house(c, 0, 0, W, D, 12, C.schloss, 3.6, M.slate, C.slate, [2.4, 6.2, 9.6]);
      blk(c, M.stucco, 0, 0, l.hz - 0.5, 10, 13.5, 2, C.schloss);
      return;
    case 'ehrenhoftor': {
      // The shut Ehrenhof gate: wrought iron between sandstone piers, the gilded crown over the closed leaves.
      const piers = [-l.hx, -l.hx / 2, -3.2, 3.2, l.hx / 2, l.hx];
      for (const x of piers) {
        blk(c, M.stucco, x, 0, 0, 1.3, 3.8, 1.3, C.sand);
        blk(c, M.stucco, x, 3.8, 0, 1.5, 0.3, 1.5, C.sand);
        cyl(c, M.stucco, x, 4.1, 0, 0.35, 0.8, C.sand, 8, 0.5);
      }
      for (let i = 1; i < piers.length; i++) bars(c, piers[i - 1]! + 0.65, piers[i]! - 0.65, 0, 0.2, i === 3 ? 4 : 3.2, 0.22, i === 3 ? [0.4, 0.42, 0.45] : C.iron);
      blk(c, M.stucco, 0, 0, 0, 6.4, 0.3, 1.2, C.sand);
      blk(c, M.enamel, 0, 4.2, 0, 5.4, 0.6, 0.15, C.gold);
      dome(c, M.enamel, 0, 4.8, 0, 0.7, C.gold, 1.2);
      return;
    }
    case 'mausoleum':
      // Mausoleum: a small temple with a four-column portico and a pediment.
      blk(c, M.stucco, 0, 0, -1.5, W - 1, 7, D - 3, C.white);
      roof(c, M.stucco, 0, 7, -1.5, W - 1, D - 3, 2, 0.3, D - 3, C.white);
      columns(c, -3, 3, l.hz - 1.2, 6.5, 4, 0.35, C.white);
      roof(c, M.stucco, 0, 6.5, l.hz - 1.2, 7.4, 1.6, 1.8, 0.3, 1.6, C.white);
      return;
    case 'belvedere': {
      // Belvedere: an oval tea house in three storeys, a curved copper roof, the lantern with its figures.
      const oval = (y: number, h: number, sx: number, sz: number, mat: LitMaterial, tint: RGB, top = 1): void => {
        c.b.geo(mat, cached(`bv${top}`, () => new CylinderGeometry(top, 1, 1, 18)), lm(l, 0, y + h / 2, 0).multiply(new Matrix4().makeScale(sx, h, sz)), tint);
      };
      oval(0, 11, l.hx, l.hz, M.stucco, C.cream);
      for (const y of [2.2, 5.6, 9]) for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pane(c.b, lm(l, Math.sin(a) * (l.hx + 0.02), y, Math.cos(a) * (l.hz + 0.02), a), 1, 1.6, c.rng, 0.25);
      }
      oval(11, 3, l.hx + 0.3, l.hz + 0.3, M.enamel, C.copper, 0.55);
      cyl(c, M.enamel, 0, 14, 0, 1.2, 2.2, C.copper, 10);
      figure(c, M.enamel, 0, 16.2, 0, 2.6, C.gold);
      return;
    }
  }
}

/**
 * Builds one Charlottenburg landmark (inside `b.on` at its ground height; the station hall at street level).
 * Step 4: the three builder files are asked first (each returns true for the kinds it drew), the step 2
 * massing is the fallback.
 */
export function buildCharlottenburgLandmark(b: ChunkBuilder, l: Landmark): void {
  const c: Ctx = { b, M: b.mm, l, rng: new Rng(Math.round(l.x * 31 + l.z * 17) + 1920) };
  if (buildCitywest(c) || buildKudamm(c) || buildSchloss(c)) return;
  massing(c);
}

// ---------------------------------------------------------------- district pieces

/** Boxes along a polyline in pieces of at most `step` meters: `fn(x, z, rot, len)` per piece. */
function along(pts: readonly Pt[], step: number, fn: (x: number, z: number, rot: number, len: number, i: number) => void): void {
  let i = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1]!, [bx, bz] = pts[k]!, len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const n = Math.max(1, Math.ceil(len / step)), rot = Math.atan2(bx - ax, bz - az);
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      fn(ax + (bx - ax) * t, az + (bz - az) * t, rot, len / n, i++);
    }
  }
}

/** Maze hedges (E3): clipped box hedges 2.2 m high, leaf cards on both faces; mossy and ivy batches. */
function buildHedge(chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number, w: Wall): void {
  const { height: H, thick: T } = WALL_KIND.hedge, rng = new Rng(w.name.length * 977 + w.pts.length);
  along(w.pts, 3, (x, z, rot, len) => {
    const b = chunkOf(x, z), M = b.mm, m = new Matrix4().makeRotationY(rot).setPosition(x, ground(x, z), z), g = rng.range(0.85, 1.1);
    const tint: RGB = [0.26 * g, 0.42 * g, 0.24 * g];
    b.box(M.mossy, sub(m, 0, H / 2 - 0.05, 0), T, H - 0.1, len + 0.5, tint);
    b.box(M.mossy, sub(m, 0, H - 0.02, 0), T - 0.2, 0.14, len + 0.3, [tint[0] * 1.15, tint[1] * 1.15, tint[2] * 1.1]);
    for (const s of [-1, 1]) b.box(M.ivy, sub(m, s * (T / 2 + 0.03), H / 2, 0), 0.04, H - 0.2, len + 0.4, [0.45 * g, 0.7 * g, 0.4 * g]);
  });
}

/** Iron fences (Zoo, garden, Orangerie forecourt): bars on two rails, sandstone piers every 10 m. */
function buildFence(chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number, w: Wall): void {
  const H = WALL_KIND.fence.height;
  let acc = 0;
  along(w.pts, 2.5, (x, z, rot, len) => {
    const b = chunkOf(x, z), M = b.mm, m = new Matrix4().makeRotationY(rot).setPosition(x, ground(x, z), z);
    for (const y of [0.3, H - 0.25]) b.box(M.iron, sub(m, 0, y, 0), 0.06, 0.07, len, C.iron);
    b.box(M.stucco, sub(m, 0, 0.12, 0), 0.32, 0.24, len, C.sand);
    const n = Math.max(1, Math.round(len / 0.3));
    for (let i = 0; i < n; i++) b.box(M.iron, sub(m, 0, H / 2, -len / 2 + (i + 0.5) * (len / n)), 0.035, H, 0.035, C.iron);
    acc += len;
    if (acc >= 10) { acc = 0; b.box(M.stucco, sub(m, 0, (H + 0.3) / 2, len / 2), 0.5, H + 0.3, 0.5, C.sand); }
  });
}

/**
 * E8: the platform of Bahnhof Zoo, built from its terrace: the brick viaduct under the deck with blind
 * arches, the stone platform and the track bed, railings on every edge but the stair, the arrived train
 * (its cars are the terrace's `solid` boxes) and the wide stone stair down to the Hardenbergplatz.
 */
function buildPlatform(chunkOf: (x: number, z: number) => ChunkBuilder, t: Terrace): void {
  const n = t.poly.length / 2, left = t.poly.slice(0, n), right = t.poly.slice(n).reverse(), h = t.h;
  const mid = left.map((p, i): Pt => [(p[0] + right[i]![0]) / 2, (p[1] + right[i]![1]) / 2]);
  const W = Math.hypot(left[0]![0] - right[0]![0], left[0]![1] - right[0]![1]);
  along(mid, 4, (x, z, rot, len) => {
    const b = chunkOf(x, z), M = b.mm, m = new Matrix4().makeRotationY(rot).setPosition(x, 0, z);
    // The viaduct body under the deck (as the brick runs beside it, without their parapets) with blind arches.
    b.solid.captureOccluder(() => {
      b.box(M.brick, sub(m, 0, (h - 0.6) / 2, 0), W, h - 0.6, len + 0.02, C.brick);
      b.box(M.brick, sub(m, 0, h - 0.45, 0), W + 0.6, 0.3, len + 0.02, [0.85, 0.62, 0.55]);
    });
    for (const sd of [-1, 1]) b.box(M.brick, sub(m, sd * (W / 2 + 0.02), (h - 1.8) / 2, 0), 0.06, h - 1.8, Math.max(0.5, len - 1.6), [0.52, 0.36, 0.32]);
    // Stone platform on the south-east two thirds (local −x: the frame's +x points north-west), ballast and
    // rails on the train side.
    b.box(M.concrete, sub(m, -W * 0.16, h - 0.15, 0), W * 0.68, 0.3, len + 0.02, [1.05, 1.0, 0.92]);
    b.box(M.concrete, sub(m, W * 0.18 - 0.2, h + 0.02, 0), 0.4, 0.06, len + 0.02, [1.3, 1.25, 1.1]);
    b.box(M.path, sub(m, W / 2 - W * 0.16, h - 0.2, 0), W * 0.32, 0.3, len + 0.02, [0.55, 0.5, 0.46]);
    for (const r of [-0.72, 0.72]) b.box(M.railSteel, sub(m, W / 2 - 1.7 + r, h - 0.02, 0), 0.07, 0.12, len, [0.6, 0.55, 0.5]);
  });
  // Railings on every edge (posts every meter), open where the stair meets the deck.
  const st = t.stairs[0];
  const edge = [...left, ...right.slice().reverse(), left[0]!];
  along(edge, 1, (x, z, rot, len) => {
    if (st) {
      const dx = x - st.x, dz = z - st.z, a = dx * Math.cos(st.rot) - dz * Math.sin(st.rot);
      const u = dx * Math.sin(st.rot) + dz * Math.cos(st.rot);
      if (Math.abs(a) < st.width / 2 && u > st.len / 2 - 2) return;
    }
    const b = chunkOf(x, z), M = b.mm, m = new Matrix4().makeRotationY(rot).setPosition(x, h, z);
    b.box(M.iron, sub(m, 0, 1.05, 0), 0.06, 0.06, len, C.iron);
    b.box(M.iron, sub(m, 0, 0.55, 0), 0.03, 0.03, len, C.iron);
    b.box(M.iron, sub(m, 0, 0.55, -len / 2), 0.06, 1.1, 0.06, C.iron);
  });
  // The arrived train: dark green cars with lit compartments toward the platform, bogies, a curved roof.
  const rng = new Rng(1882);
  for (const car of t.solid ?? []) {
    const b = chunkOf(car.x, car.z), M = b.mm, m = new Matrix4().makeRotationY(car.rot).setPosition(car.x, h, car.z), L = car.hz * 2 - 0.9, w = car.hx * 2 - 0.4;
    b.solid.captureOccluder(() => {
      b.box(M.carPaint, sub(m, 0, 2.35, 0), w, 2.9, L, C.train);
      b.geo(M.carPaint, cached('car-roof', () => new CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI)), sub(m, 0, 3.8, 0).multiply(new Matrix4().makeRotationX(Math.PI / 2).multiply(new Matrix4().makeScale(w / 2, L, 0.45))), [0.3, 0.3, 0.3]);
    });
    for (const z of [-L / 2 + 1.6, L / 2 - 1.6]) b.box(M.rubber, sub(m, 0, 0.55, z), w - 0.5, 0.7, 2.4, [0.6, 0.6, 0.6]);
    // Windows and doors on the platform side (local −x faces south-east).
    for (let k = 0; k < Math.floor(L / 1.6); k++) {
      const zc = -L / 2 + 0.8 + k * 1.6;
      if (k % 4 === 0) { b.box(M.darkWood, sub(m, -w / 2 - 0.02, 1.95, zc), 0.04, 2.1, 0.9, [0.4, 0.32, 0.26]); continue; }
      pane(b, sub(m, -w / 2 - 0.01, 2.7, zc, -Math.PI / 2), 0.9, 0.9, rng, 0.55);
    }
  }
  // The stair: stone steps on a brick base, brick side walls with an iron handrail.
  for (const s of t.stairs) {
    const b = chunkOf(s.x, s.z), M = b.mm, m = new Matrix4().makeRotationY(s.rot).setPosition(s.x, 0, s.z), steps = Math.round(h / 0.32);
    for (let i = 0; i < steps; i++) {
      const top = (h * (i + 1)) / steps, zc = -s.len / 2 + ((i + 0.5) * s.len) / steps;
      b.box(M.concrete, sub(m, 0, top / 2, zc), s.width, top, s.len / steps + 0.02, [1.0, 0.96, 0.88]);
      for (const sd of [-1, 1]) b.box(M.brick, sub(m, sd * (s.width / 2 + 0.2), (top + 0.9) / 2, zc), 0.4, top + 0.9, s.len / steps + 0.02, C.brick);
    }
    const slope = Math.atan2(h, s.len), hl = Math.hypot(h, s.len);
    for (const sd of [-1, 1]) b.box(M.iron, sub(m, sd * (s.width / 2 - 0.1), h / 2 + 1, 0, 0, -slope), 0.06, 0.06, hl, C.iron);
  }
}

/**
 * M16 hook from `buildMapWorld` (only on Charlottenburg): the brick Stadtbahn and its street arches, the
 * Bahnhof Zoo platform, maze hedges and iron fences. Walls without `kind` (the Berlin Wall) stay Xhain's.
 */
export function buildCharlottenburgWorld(m: MapDef, chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number): void {
  const runs = (m.viaducts ?? []).filter((v) => v.kind === 'stadtbahn');
  for (const v of runs) buildStadtbahn(chunkOf, v, true);
  // Arch decks over the streets; the gap that holds the platform spans only from the run end to the deck.
  const deck = m.terraces.find((t) => t.platform);
  const ends: Array<[Pt, Pt]> = [];
  for (let i = 1; i < runs.length; i++) {
    const a = runs[i - 1]!.pts[runs[i - 1]!.pts.length - 1]!, c = runs[i]!.pts[0]!;
    if (deck) {
      const n = deck.poly.length / 2, sw: Pt = [(deck.poly[0]![0] + deck.poly[2 * n - 1]![0]) / 2, (deck.poly[0]![1] + deck.poly[2 * n - 1]![1]) / 2];
      const dA = Math.hypot(sw[0] - a[0], sw[1] - a[1]), dAC = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (dA < dAC - 1) { ends.push([a, sw]); continue; }
    }
    ends.push([a, c]);
  }
  buildArches(chunkOf, m, ends, [[0.42, 0.4, 0.38], [0.42, 0.4, 0.38]]);
  if (deck) buildPlatform(chunkOf, deck);
  for (const w of m.walls ?? []) {
    if (w.kind === 'hedge') buildHedge(chunkOf, ground, w);
    else if (w.kind === 'fence') buildFence(chunkOf, ground, w);
  }
}

