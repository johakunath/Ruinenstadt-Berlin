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
//
// Worn surfaces (2026-11-19, Johannes: too even, too clean): `weather` runs after each sight's builder over the walls
// it drew (recipes `GRIME` in the three builder files), the damage dressing (`shutter`, `props`, `sandbags`, `battens`,
// `tarp`, `scaffold`) and the period posters (`paintPosters`) are opt-in helpers only these builders call.
import { BufferAttribute, BufferGeometry, CylinderGeometry, Matrix4, SphereGeometry, Vector3, type Material } from 'three';
import { OPEN_PARTS, type Landmark, type LandmarkKind, type MapDef, type Pt, type Terrace, type Wall, WALL_KIND } from '../data/map';
import { Rng } from '../sim/math';
import { buildArches, buildStadtbahn } from './alex-world';
import { frustum, pane, sub, type RGB } from './landmarks';
import { lm as lmShared, type ChunkBuilder, type MapMats } from './map-world';
import type { LitMaterial } from './materials';
import type { WearOptions } from './landmark-wear';
export type { RGB } from './landmarks';
import { buildCitywest, GRIME as CITYWEST_GRIME } from './charlottenburg-citywest';
import { buildKudamm, GRIME as KUDAMM_GRIME } from './charlottenburg-kudamm';
import { buildSchloss, GRIME as SCHLOSS_GRIME } from './charlottenburg-schloss';
import { lightCharlottenburgLandmarks } from './charlottenburg-lights';
import { buildRiddleStatic } from './charlottenburg-riddles';

export const CHARLOTTENBURG_KINDS = new Set<LandmarkKind>([
  'zoobahnhof', 'loewentor', 'elefantentor', 'aquarium', 'musikpavillon', 'antilopenhaus', 'ufapalast', 'capitol', 'gedaechtniskirche',
  'romanischescafe', 'gloriapalast', 'marmorhaus', 'kadewe', 'wittenbergplatz', 'cafewestens', 'revuepalast', 'theaterwestens', 'variete',
  'opernhaus', 'schillertheater', 'hochschule', 'chtor', 'stuelerbau', 'ehrenhoftor', 'schlossmitte', 'schlossfluegel', 'neuerfluegel',
  'orangerie', 'gartentor', 'mausoleum', 'belvedere', 'chrathaus',
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
    case 'chrathaus':
      // Rathaus Charlottenburg (1905): a long block on the Otto-Suhr-Allee, the tall tower over its front.
      house(c, 0, 0, W, D, 14, C.sand, 3);
      blk(c, M.stucco, 0, 0, l.hz - 2, 5, 30, 4, C.sand);
      roof(c, M.enamel, 0, 30, l.hz - 2, 5.4, 4.4, 7, 0.3, 0.3, C.copper);
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
 * massing is the fallback. Then the worn-surface pass (`weather`) runs over the walls the builder drew, with
 * the recipe of the builder file (`GRIME` there).
 */
export function buildCharlottenburgLandmark(b: ChunkBuilder, l: Landmark): void {
  const c: Ctx = { b, M: b.mm, l, rng: new Rng(Math.round(l.x * 31 + l.z * 17) + 1920) };
  const recipe = CITYWEST_GRIME[l.kind] ?? KUDAMM_GRIME[l.kind] ?? SCHLOSS_GRIME[l.kind];
  const rec = recipe ? recordWalls(b) : undefined;
  try {
    if (!(buildCitywest(c) || buildKudamm(c) || buildSchloss(c))) massing(c);
  } finally {
    rec?.stop();
  }
  if (rec && recipe) weather(c, rec, recipe);
}

// ---------------------------------------------------------------- worn surfaces (2026-11-19)

/**
 * Recipe of the worn-surface pass for one sight (Johannes 2026-11-19: the walls were too even and too clean).
 * Every layer is a sheet of triangles in the wall's own material (stucco or brick) a few millimetres in front
 * of the box face, behind windows, trims and signs, with the wall's UVs and per-vertex colours: a vertex in
 * the wall tint is invisible, so stains fade into the wall without alpha or a new material. Values are
 * strengths; 0 or a missing value leaves a layer out.
 */
export interface Grime {
  /** Triangle budget of the pass (about a tenth of the sight; hand details in the builder come on top). */
  tris: number;
  /** Tone drift between bays and storeys (0.05 calm stone … 0.25 patchy render). */
  drift: number;
  /** Bay width of the drift grid in m. */
  bay?: number;
  /** Damp plinth: height in m (dark and greenish at the foot, fading up). */
  damp: number;
  /** Lichen and moss green in the damp band and the low stains (0 … 1). */
  moss?: number;
  /** Soot falling from cornices and wall tops (0 … 1.2). */
  soot: number;
  /** Share of window bays with soot rising from burnt rooms above the window. */
  sootBays?: number;
  /** Soft stains (water, damp, grime, a few lighter) per 10 m of face, mostly below 6 m. */
  stains?: number;
  /** Rain streaks per 10 m of face (one in six a rust run). */
  streaks?: number;
  /** Fallen-plaster patches per 10 m of street face (brick shows); 0 on stone sights. */
  spall?: number;
  /** Patched, mismatched repairs per 10 m (cement grey, fresher or yellower render). */
  patch?: number;
  /** Ghosts of pasted-off posters per 10 m (cleaner rectangles at street level). */
  ghosts?: number;
}

interface WallRec { t: Matrix4; inv: Matrix4; sx: number; sy: number; sz: number; tint: RGB; mat: Material }
interface HoleRec { t: Matrix4; w: number; h: number }
interface Recording { walls: WallRec[]; holes: HoleRec[]; stop(): void }
/** Sights that draw no brick get their fallen-plaster cores in brick-red stucco (no extra batch in the chunk). */
const BRICK_RED: RGB = [1.05, 0.56, 0.42];

/**
 * Records the stucco and brick boxes (walls) and the window and door rectangles a builder draws, by wrapping
 * `b.box` and `b.wearWindow` on this builder instance only while one Charlottenburg sight is built (opt-in:
 * other maps never call it).
 */
function recordWalls(b: ChunkBuilder): Recording {
  const walls: WallRec[] = [], holes: HoleRec[] = [], M = b.mm;
  const box = b.box, wearWindow = b.wearWindow;
  const own = b as { box: ChunkBuilder['box']; wearWindow: ChunkBuilder['wearWindow'] };
  own.box = (mat, t, sx, sy, sz, color, ...rest) => {
    if (mat === M.stucco || mat === M.brick) walls.push({ t: t.clone(), inv: t.clone().invert(), sx, sy, sz, tint: color ?? [1, 1, 1], mat });
    else if ((mat === M.dark || mat === M.door || mat === M.shop || mat === M.glass) && sz < 0.2) holes.push({ t: t.clone(), w: sx, h: sy });
    box.call(b, mat, t, sx, sy, sz, color, ...rest);
  };
  own.wearWindow = (m, w, h, board) => {
    holes.push({ t: m.clone(), w, h });
    return wearWindow.call(b, m, w, h, board);
  };
  return { walls, holes, stop: () => { Reflect.deleteProperty(b, 'box'); Reflect.deleteProperty(b, 'wearWindow'); } };
}

/** A wall face: frame `m` at the bottom centre of the face (+z out of the wall), width, height, tint, material. */
export interface Face { m: Matrix4; w: number; h: number; tint: RGB; mat: Material; low?: boolean }

/** A face for hand-placed wear: frame at the bottom centre of a wall face (+z out), its size, tint and material (stucco by default). */
export function wallFace(c: Ctx, m: Matrix4, w: number, h: number, tint: RGB = [1, 1, 1], mat: Material = c.M.stucco): Face {
  return { m, w, h, tint, mat, low: true };
}

/**
 * Tint `t` shaded by `s` (and hue `h`) so the change reads the same on every wall: bright tints (the Ku'damm
 * stone is tinted 2 to 4 times the stucco) sit in the flat top of the tone curve, so darkening is raised to a
 * power that grows with the tint's luminance on the stucco base (#b9a88c); brightening is damped.
 */
export function shade(t: RGB, s: number, h: RGB = [1, 1, 1]): RGB {
  const lum = 0.3 * t[0] * 0.485 + 0.59 * t[1] * 0.39 + 0.11 * t[2] * 0.26, p = Math.max(1.2, Math.min(4, lum / 0.18));
  const f = (v: number): number => (v < 1 ? v ** p : 1 + (v - 1) * 0.7);
  const k = f(s);
  return [t[0] * k * f(h[0]), t[1] * k * f(h[1]), t[2] * k * f(h[2])];
}

/** Layer depths in front of the wall face (m): all behind window panes (≥ 0.01) and trims. */
const Z = { grid: 0.004, stain: 0.0052, streak: 0.0062, patch: 0.0072, core: 0.0084, lath: 0.0094 } as const;

/** Triangles on one face in one material, in face-local metres; UVs as the wall boxes (metres × 0.5). */
class Sheet {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly idx: number[] = [];
  constructor(readonly f: Face, readonly mat: Material) {}
  v(x: number, y: number, z: number, c: RGB): number {
    this.pos.push(x, y, z);
    this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  }
  tri(a: number, b: number, c: number): void { this.idx.push(a, b, c); }
  quad(p: ReadonlyArray<readonly [number, number]>, z: number, c: readonly RGB[]): void {
    const i = p.map(([x, y], k) => this.v(x, y, z, c[k] ?? c[0]!));
    this.tri(i[0]!, i[1]!, i[2]!);
    this.tri(i[0]!, i[2]!, i[3]!);
  }
  get tris(): number { return this.idx.length / 3; }
  flush(b: ChunkBuilder): void {
    if (!this.idx.length) return;
    const g = new BufferGeometry(), n = this.pos.length / 3, uv = new Float32Array(n * 2), nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { uv[i * 2] = (this.pos[i * 3]! + this.f.w / 2) * 0.5; uv[i * 2 + 1] = this.pos[i * 3 + 1]! * 0.5; nor[i * 3 + 2] = 1; }
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(nor, 3));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setIndex(this.idx);
    b.solid.of(this.mat).add(g, this.f.m);
  }
}

/** The sheets of one face: the wall's own material and the few others the details need (brick, dark, lath). */
class FaceWork {
  private readonly sheets = new Map<Material, Sheet>();
  constructor(readonly b: ChunkBuilder, readonly f: Face, readonly rng: Rng, readonly at: (x: number, y: number) => RGB = () => f.tint, readonly brick = true) {}
  of(mat: Material = this.f.mat): Sheet {
    let s = this.sheets.get(mat);
    if (!s) this.sheets.set(mat, (s = new Sheet(this.f, mat)));
    return s;
  }
  get tris(): number { let n = 0; for (const s of this.sheets.values()) n += s.tris; return n; }
  flush(): void { for (const s of this.sheets.values()) s.flush(this.b); }
}

/**
 * Worn details on one wall face, for the pass below and for builders that place them by hand. x, y: centre on
 * the face (streak, rust: the top centre, `h` the length down; soot: the foot centre, `h` the rise).
 * - stain: a soft blot (dark centre, `tone` < 1, or a lighter one > 1, tinted by `hue`) fading into the wall, 6 triangles;
 * - streak, rust: a run narrowing toward its foot, soft sides, 4 triangles; soot: a plume widening upward;
 * - spall: fallen render showing brick (`lath`: bare lath on a dark ground), a lighter broken edge;
 * - patch: a repair in another tone; ghost: the clean rectangle of a pasted-off poster.
 */
export function wornSpot(w: FaceWork, kind: 'stain' | 'streak' | 'rust' | 'soot' | 'spall' | 'lath' | 'patch' | 'ghost', x: number, y: number, sw: number, sh: number, tone = 0.72, hue: RGB = [1, 1, 1]): void {
  const { b, f, rng, at } = w, M = b.mm, j = (): number => rng.range(-0.18, 0.18);
  if (kind === 'stain') {
    const s = w.of(), n = 6, cx = x + j() * sw * 0.2, cyy = y + j() * sh * 0.2;
    const centre = s.v(cx, cyy, Z.stain, shade(at(cx, cyy), tone, hue));
    const rim = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2, r = 0.5 * (0.75 + rng.next() * 0.5);
      const px = Math.max(-f.w / 2, Math.min(f.w / 2, x + Math.cos(a) * sw * r)), py = Math.max(0, Math.min(f.h, y + Math.sin(a) * sh * r));
      return s.v(px, py, Z.stain, at(px, py));
    });
    for (let i = 0; i < n; i++) s.tri(centre, rim[i]!, rim[(i + 1) % n]!);
    return;
  }
  if (kind === 'streak' || kind === 'rust' || kind === 'soot') {
    const s = w.of(), up = kind === 'soot', y0 = up ? y : y - sh, y1 = up ? y + sh : y;
    const wDark = up ? sw : sw, wFade = up ? sw * 1.8 : sw * 0.35, yd = up ? y0 : y1, yf = up ? y1 : y0;
    const dark = kind === 'rust' ? shade(at(x, yd), 0.7, [1.2, 0.78, 0.52]) : shade(at(x, yd), up ? 0.34 : 0.52);
    const lean = j() * 0.25;
    const L = s.v(x - wDark / 2, yd, Z.streak, at(x - wDark / 2, yd)), C2 = s.v(x, yd, Z.streak, dark), R2 = s.v(x + wDark / 2, yd, Z.streak, at(x + wDark / 2, yd));
    const xf = x + lean, l2 = s.v(xf - wFade / 2, yf, Z.streak, at(xf - wFade / 2, yf)), c3 = s.v(xf, yf, Z.streak, up ? shade(at(xf, yf), 0.85) : at(xf, yf)), r3 = s.v(xf + wFade / 2, yf, Z.streak, at(xf + wFade / 2, yf));
    // Two strips (left and right of the dark middle line) of two triangles each, wound toward +z.
    const strip = (a: number, bb: number, c: number, d: number): void => { if (up) { s.tri(a, bb, d); s.tri(a, d, c); } else { s.tri(c, d, bb); s.tri(c, bb, a); } };
    strip(L, C2, l2, c3);
    strip(C2, R2, c3, r3);
    return;
  }
  const pts = (k: number): Array<[number, number]> => [[x - (sw / 2) * k + j() * sw * 0.4, y - (sh / 2) * k + j() * sh * 0.3], [x + (sw / 2) * k + j() * sw * 0.4, y - (sh / 2) * k + j() * sh * 0.5], [x + (sw / 2) * k + j() * sw * 0.3, y + (sh / 2) * k + j() * sh * 0.3], [x - (sw / 2) * k + j() * sw * 0.5, y + (sh / 2) * k + j() * sh * 0.4]];
  if (kind === 'patch' || kind === 'ghost') {
    const t: RGB = kind === 'ghost' ? [1.12, 1.1, 1.06] : rng.pick<RGB>([[0.84, 0.88, 0.95], [1.1, 1.07, 0.98], [1.08, 0.98, 0.8], [0.9, 0.88, 0.84]]);
    const s = shade(at(x, y), kind === 'ghost' ? 1.08 : rng.range(0.9, 1.05), t);
    const r: Array<[number, number]> = kind === 'ghost' ? [[x - sw / 2, y - sh / 2], [x + sw / 2, y - sh / 2], [x + sw / 2, y + sh / 2], [x - sw / 2, y + sh / 2]] : pts(1);
    w.of().quad(r, Z.patch, [s]);
    return;
  }
  // The broken edge of the render is lighter (fresh lime), the core is brick, or bare lath on a dark ground: two
  // ragged seven-sided fans (14 triangles), the edge a little larger than the hole.
  if (kind === 'spall') {
    const n = 7, rr = Array.from({ length: n }, () => rng.range(0.62, 1.0)), a0 = rng.range(0, 1);
    const fan = (s: Sheet, k: number, z: number, c: RGB): void => {
      const centre = s.v(x, y, z, c);
      const rim = rr.map((r, i) => { const a = a0 + (i / n) * Math.PI * 2; return s.v(x + Math.cos(a) * (sw / 2) * r * k, Math.max(0.02, y + Math.sin(a) * (sh / 2) * r * k), z, c); });
      for (let i = 0; i < n; i++) s.tri(centre, rim[i]!, rim[(i + 1) % n]!);
    };
    const red = rng.pick<RGB>([[0.86, 0.62, 0.52], [0.74, 0.5, 0.42], [0.95, 0.72, 0.6]]);
    fan(w.of(), 1.16, Z.patch, shade(at(x, y), 1.12, [1.02, 1.0, 0.95]));
    if (f.mat === M.brick) fan(w.of(M.dark), 1, Z.core, [1, 1, 1]);
    else if (w.brick) fan(w.of(M.brick), 1, Z.core, red);
    else fan(w.of(M.stucco), 1, Z.core, [BRICK_RED[0] * red[0], BRICK_RED[1] * red[1], BRICK_RED[2] * red[2]]);
    return;
  }
  w.of().quad(pts(1.2), Z.patch, [shade(at(x, y), 1.12, [1.02, 1.0, 0.95])]);
  w.of(M.dark).quad(pts(1), Z.core, [[1, 1, 1]]);
  const n = Math.max(2, Math.round(sh / 0.2));
  for (let i = 0; i < n; i++) {
    const yy = y - sh / 2 + ((i + 0.5) * sh) / n;
    w.of(M.darkWood).quad([[x - sw / 2, yy - 0.04], [x + sw / 2, yy - 0.04], [x + sw / 2, yy + 0.04], [x - sw / 2, yy + 0.04]], Z.lath, [[0.8, 0.66, 0.52]]);
  }
}

/** Hand-placed wear on one face: `fn` gets the face's work sheet; returns the triangles added. */
export function wornFace(c: Ctx, f: Face, fn: (w: FaceWork) => void, seed = 1): number {
  const w = new FaceWork(c.b, f, new Rng(seed * 7477 + Math.round(f.w * 100)));
  fn(w);
  const n = w.tris;
  w.flush();
  return n;
}
export type { FaceWork };

/**
 * A shade field over a face: drift per column and row, damp at the foot, soot from the top; `at(x, y)` gives
 * the interpolated colour, so stains and streaks fade into it exactly.
 */
function field(f: Face, g: Grime, rng: Rng): { xs: number[]; ys: number[]; col: RGB[][]; at(x: number, y: number): RGB } {
  const { w, h } = f, nx = Math.max(1, Math.min(10, Math.round(w / (g.bay ?? 3))));
  const xs = Array.from({ length: nx + 1 }, (_, i) => -w / 2 + (w * i) / nx + (i > 0 && i < nx ? rng.range(-0.2, 0.2) * (w / nx) : 0));
  const ys = [0];
  const damp = f.low && g.damp > 0 ? Math.min(h * 0.4, g.damp * rng.range(0.75, 1.25)) : 0;
  if (damp) ys.push(damp);
  for (const y of [2.8, 6.5]) if (y > ys[ys.length - 1]! + 0.7 && y < h - 1.3) ys.push(y + rng.range(-0.4, 0.4));
  if (h > 4 && g.soot > 0) ys.push(h - Math.min(1.5, h * 0.2));
  ys.push(h);
  const colA = xs.map(() => rng.range(-1, 1)), rowA = ys.map(() => rng.range(-1, 1)), sootCol = xs.map(() => rng.range(0.3, 1.3));
  const moss = g.moss ?? 0, green: RGB = [1 - 0.16 * moss, 1, 1 - 0.28 * moss];
  const col = xs.map((_, i) => ys.map((y, j) => {
    let s = 1 + g.drift * (0.55 * colA[i]! + 0.3 * rowA[j]! + 0.45 * rng.range(-1, 1));
    let hue: RGB = [1, 1, 1];
    // Damp and street grime: dark and green at the foot, darker up to the damp line, a little dirtier to 2.5 m.
    if (damp && j === 0) { s *= 1 - 0.7 * Math.min(1, g.damp); hue = green; }
    else if (damp && j === 1) { s *= 1 - 0.28 * Math.min(1, g.damp); hue = [1 - 0.08 * moss, 1, 1 - 0.12 * moss]; }
    else if (f.low && y < 2.6) s *= 1 - 0.08 * Math.min(1, g.damp);
    if (g.soot > 0 && j === ys.length - 1) s *= 1 - 0.6 * Math.min(1.25, g.soot * sootCol[i]!);
    else if (g.soot > 0 && j === ys.length - 2 && h > 4) s *= 1 - 0.1 * g.soot * sootCol[i]!;
    return shade(f.tint, Math.max(0.3, s), hue);
  }));
  const at = (x: number, y: number): RGB => {
    let i = 0, j = 0;
    while (i < xs.length - 2 && x > xs[i + 1]!) i++;
    while (j < ys.length - 2 && y > ys[j + 1]!) j++;
    const u = Math.max(0, Math.min(1, (x - xs[i]!) / (xs[i + 1]! - xs[i]!))), v = Math.max(0, Math.min(1, (y - ys[j]!) / (ys[j + 1]! - ys[j]!)));
    const a = col[i]![j]!, b2 = col[i + 1]![j]!, c2 = col[i]![j + 1]!, d = col[i + 1]![j + 1]!;
    return [0, 1, 2].map((k) => (a[k]! * (1 - u) + b2[k]! * u) * (1 - v) + (c2[k]! * (1 - u) + d[k]! * u) * v) as unknown as RGB;
  };
  return { xs, ys, col, at };
}

/** Faces of a recorded box (0 front +z, 1 +x, 2 back, 3 −x), framed at their bottom centre. */
function facesOf(r: WallRec): Face[] {
  const out: Face[] = [], floor = r.t.elements[13]! - r.sy / 2;
  for (let face = 0; face < 4; face++) {
    const w = face % 2 ? r.sz : r.sx, depth = face % 2 ? r.sx : r.sz;
    const m = r.t.clone().multiply(new Matrix4().makeRotationY((face * Math.PI) / 2)).multiply(new Matrix4().makeTranslation(0, -r.sy / 2, depth / 2));
    out.push({ m, w, h: r.sy, tint: r.tint, mat: r.mat, low: floor < 0.7 && floor > -1.5 });
  }
  return out;
}

/**
 * The worn-surface pass: tone drift, damp plinth and soot on every visible wall face (south, east and west in
 * the world: the camera looks north), soft stains and streaks, soot plumes over some windows, fallen plaster,
 * repairs and poster ghosts at street level, within the recipe's triangle budget, most of it below 6 m. Faces
 * and cells hidden inside other walls are skipped; details keep off windows and doors.
 */
function weather(c: Ctx, rec: Recording, g: Grime): void {
  const b = c.b, rng = new Rng((c.l.kind.length * 7919 + Math.round(c.l.x * 13) * 31 + Math.round(c.l.z * 7)) >>> 0);
  const tmp = new Vector3();
  const inside = (p: Vector3, self: WallRec): boolean => rec.walls.some((o) => {
    if (o === self) return false;
    tmp.copy(p).applyMatrix4(o.inv);
    return Math.abs(tmp.x) < o.sx / 2 - 0.02 && Math.abs(tmp.y) < o.sy / 2 && Math.abs(tmp.z) < o.sz / 2 - 0.02;
  });
  const faces: Array<{ f: Face; wall: WallRec; score: number }> = [], hasBrick = rec.walls.some((w) => w.mat === b.mm.brick);
  for (const wall of rec.walls) {
    if (Math.abs(wall.t.elements[5]! - 1) > 0.02) continue;
    for (const f of facesOf(wall)) {
      if (f.w < 2.0 || f.h < (f.low ? 0.45 : 2.2)) continue;
      const nz = f.m.elements[10]!;
      if (nz < -0.45) continue;
      faces.push({ f, wall, score: f.w * Math.min(f.h, 7) * (0.5 + nz) * (f.low ? 1.6 : 1) });
    }
  }
  faces.sort((a, z) => z.score - a.score);
  const total = faces.reduce((n, q) => n + q.score, 0);
  // Hole rectangles in each face's frame, so details keep off windows and doors.
  const onFace = (f: Face): Array<[number, number, number, number]> => {
    const inv = f.m.clone().invert(), out: Array<[number, number, number, number]> = [];
    for (const h of rec.holes) {
      const p = new Vector3().setFromMatrixPosition(h.t).applyMatrix4(inv);
      if (Math.abs(p.z) < 0.5 && Math.abs(p.x) < f.w / 2 + 1) out.push([p.x - h.w / 2 - 0.12, p.y - h.h / 2 - 0.12, p.x + h.w / 2 + 0.12, p.y + h.h / 2 + 0.12]);
    }
    return out;
  };
  let used = 0;
  for (const { f, wall, score } of faces) {
    if (used >= g.tris) break;
    // Each face gets a share of the budget by its weight (big, low, south faces first), the rest rolls on.
    const cap = Math.min(g.tris, used + Math.max(24, (g.tris * score) / total * 1.3));
    const fl = field(f, g, rng), holes = onFace(f), w = new FaceWork(b, f, rng, fl.at, hasBrick);
    const left = (): boolean => used + w.tris < cap;
    // The drift grid, cell by cell; cells whose middle lies inside another wall are hidden and skipped.
    const grid = w.of();
    for (let i = 0; i < fl.xs.length - 1; i++) for (let j = 0; j < fl.ys.length - 1 && left(); j++) {
      const x0 = fl.xs[i]!, x1 = fl.xs[i + 1]!, y0 = fl.ys[j]!, y1 = fl.ys[j + 1]!;
      if (inside(new Vector3((x0 + x1) / 2, Math.min((y0 + y1) / 2, y0 + 1.2), 0.2).applyMatrix4(f.m), wall)) continue;
      grid.quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], Z.grid, [fl.col[i]![j]!, fl.col[i + 1]![j]!, fl.col[i + 1]![j + 1]!, fl.col[i]![j + 1]!]);
    }
    const per = (n = 0, scale = f.w): number => { const v = (n * scale) / 10; return Math.floor(v) + (rng.next() < v % 1 ? 1 : 0); };
    const visible = (x: number, y: number): boolean => !inside(new Vector3(x, y, 0.2).applyMatrix4(f.m), wall);
    const free = (x: number, y: number, sw: number, sh: number): boolean => Math.abs(x) + sw / 2 < f.w / 2 - 0.1 && y - sh / 2 > 0.05 && y + sh / 2 < f.h - 0.1 &&
      !holes.some(([a, bb, cc, d]) => x + sw / 2 > a && x - sw / 2 < cc && y + sh / 2 > bb && y - sh / 2 < d) && visible(x, y);
    const place = (sw: number, sh: number, ymin: number, ymax: number): [number, number] | undefined => {
      for (let k = 0; k < 6; k++) {
        const x = rng.range(-f.w / 2 + sw / 2 + 0.2, f.w / 2 - sw / 2 - 0.2), y = rng.range(ymin, Math.max(ymin, Math.min(ymax, f.h - sh / 2 - 0.2)));
        if (free(x, y, sw, sh)) return [x, y];
      }
      return undefined;
    };
    // Soot plumes over some windows (burnt rooms), on the upper storeys.
    for (const [a, bb, cc, d] of holes) {
      if (!left() || bb < 2.5 || d > f.h - 0.5 || rng.next() > (g.sootBays ?? 0)) continue;
      const x = (a + cc) / 2;
      if (Math.abs(x) < f.w / 2 - 0.3 && visible(x, d)) wornSpot(w, 'soot', x, d - 0.1, Math.min(1.6, cc - a), Math.min(2.4, f.h - d - 0.1));
    }
    // Soft stains: dark damp and grime blots low, a few lighter washed patches, fewer higher up.
    for (let n = per(g.stains, f.w * Math.min(1.6, f.h / 5)); n > 0 && left(); n--) {
      const low = rng.next() < 0.7, sw = Math.min(f.w * 0.8, rng.range(1.0, 3.2)), sh = Math.min(f.h * 1.2, sw * rng.range(0.5, 1.1));
      const x = rng.range(-f.w / 2 + 0.4, f.w / 2 - 0.4), y = low || f.h < 5 ? rng.range(Math.min(0.5, f.h * 0.3), Math.max(0.2, Math.min(f.h - 0.2, 4.5))) : rng.range(4.5, Math.max(4.6, f.h - 0.5));
      if (y > f.h || !visible(x, Math.min(y, f.h * 0.5))) continue;
      wornSpot(w, 'stain', x, y, sw, sh, rng.next() < 0.2 ? rng.range(1.12, 1.25) : rng.range(0.34, 0.66), low && y < 1.5 && (g.moss ?? 0) > 0 ? [1 - 0.15 * g.moss!, 1, 1 - 0.3 * g.moss!] : [1, 1, 1]);
    }
    for (let n = f.h < 2.6 ? 0 : per(g.streaks); n > 0 && left(); n--) {
      const x = rng.range(-f.w / 2 + 0.3, f.w / 2 - 0.3), top = rng.range(2.2, Math.min(f.h - 0.15, 9)), len = Math.min(top - 0.2, rng.range(1.2, 3.6));
      if (visible(x, top - len / 2)) wornSpot(w, rng.next() < 0.16 ? 'rust' : 'streak', x, top, rng.range(0.16, 0.45), len);
    }
    if (f.low) {
      for (let n = per(g.spall); n > 0 && left(); n--) {
        const sw = rng.range(0.7, 2.2), sh = rng.range(0.5, 1.4), p = place(sw, sh, 0.9, 5.2);
        if (p) wornSpot(w, 'spall', p[0], p[1], sw, sh);
      }
      for (let n = per(g.patch); n > 0 && left(); n--) {
        const sw = rng.range(0.9, 2.4), sh = rng.range(0.6, 1.8), p = place(sw, sh, 0.8, 4.5);
        if (p) wornSpot(w, 'patch', p[0], p[1], sw, sh);
      }
      for (let n = per(g.ghosts); n > 0 && left(); n--) {
        const sw = rng.range(0.6, 0.9), sh = sw * rng.range(1.3, 1.5), p = place(sw, sh, 1.4, 2.2);
        if (p) wornSpot(w, 'ghost', p[0], p[1], sw, sh);
      }
    }
    used += w.tris;
    w.flush();
  }
}

// ---------------------------------------------------------------- damage dressing (2026-11-19)
// Shared, opt-in pieces for the builders (only Charlottenburg calls them): all thin, merged into existing batches
// (dark wood, burlap, rust, dark, roof or slate), placed by the builders inside the footprint.

const TIMBER: RGB = [0.62, 0.5, 0.4];

/** A wooden shutter hanging askew from its top hinge beside a window (frame `m` at the window centre, +z out). */
export function shutter(c: Ctx, m: Matrix4, w: number, h: number, side = 1, tint: RGB = [0.55, 0.62, 0.5]): void {
  const sw = Math.min(0.85, w * 0.55), hinge = sub(m, side * (w / 2 + 0.03), h / 2, 0.07, 0, 0, -side * 0.38);
  c.b.box(c.M.darkWood, sub(hinge, (side * sw) / 2, -h / 2, 0), sw, h, 0.05, tint);
  for (const f of [0.22, 0.78]) c.b.box(c.M.darkWood, sub(hinge, (side * sw) / 2, -h * f, 0.03), sw * 0.92, 0.07, 0.03, [tint[0] * 0.7, tint[1] * 0.7, tint[2] * 0.7]);
}

/** Timber props shoring a wall (frame `m` on the wall face at ground, +z out): from the ground `out` m before it up to `top`. */
export function props(c: Ctx, m: Matrix4, x: number, top: number, out: number, n = 2): void {
  const len = Math.hypot(top, out), ang = Math.atan2(out, top);
  for (let i = 0; i < n; i++) {
    const dx = x + (i - (n - 1) / 2) * 0.7;
    c.b.box(c.M.darkWood, sub(m, dx, top / 2, out / 2 + 0.08, 0, -ang), 0.16, len, 0.16, TIMBER);
    c.b.box(c.M.darkWood, sub(m, dx, 0.05, out + 0.05), 0.3, 0.1, 0.5, TIMBER);
  }
  c.b.box(c.M.darkWood, sub(m, x, top, 0.06), 0.7 * n, 0.22, 0.1, TIMBER);
}

/** Sandbags stacked against a wall or in an opening (frame `m` at the foot, +z out), `w` wide, `rows` high. */
export function sandbags(c: Ctx, m: Matrix4, w: number, rows: number, rng: Rng): void {
  for (let r = 0; r < rows; r++) {
    const n = Math.max(1, Math.round(w / 0.62) - (r % 2));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5 + (r % 2) * 0.5) * (w / Math.max(1, Math.round(w / 0.62)));
      c.b.box(c.M.burlap, sub(m, x, r * 0.24 + 0.12, 0.22, rng.range(-0.12, 0.12)), 0.58, 0.24, 0.38, [0.82 + rng.range(-0.06, 0.06), 0.74, 0.58]);
    }
  }
}

/** Frame on a roof slope: eave centre at local (x, y0, z0) of the sight, the slope rising `rise` over `run` inward, at `t` (0 eave … 1 ridge). */
export function slope(c: Ctx, x: number, y0: number, z0: number, run: number, rise: number, t: number, ry = 0): Matrix4 {
  return sub(lm(c.l, 0, 0, 0, ry), x, y0 + rise * t, z0 - run * t, 0, -Math.atan2(run, rise));
}

/** A slipped roof patch on a slope frame `m`: the dark hole, bare battens and rafters, a few tiles slid down. */
export function battens(c: Ctx, m: Matrix4, w: number, h: number, tile: LitMaterial, tint: RGB): void {
  const b = c.b, M = c.M;
  b.box(M.dark, sub(m, 0, 0, 0.02), w, h, 0.03);
  for (let i = 0; i < 4; i++) b.box(M.darkWood, sub(m, 0, -h / 2 + ((i + 0.5) * h) / 4, 0.07), w + 0.2, 0.05, 0.04, TIMBER);
  for (const x of [-w * 0.3, w * 0.3]) b.box(M.darkWood, sub(m, x, 0, 0.04), 0.09, h + 0.2, 0.08, [0.5, 0.4, 0.32]);
  for (let i = 0; i < 3; i++) b.box(tile, sub(m, (i - 1) * w * 0.35, -h / 2 - 0.25 - i * 0.12, 0.06, 0, 0, (i - 1) * 0.4), 0.32, 0.22, 0.03, tint);
}

/** A tarp hung over a wall or a hole (frame `m` at its top centre, +z out), sagging in two folds. */
export function tarp(c: Ctx, m: Matrix4, w: number, h: number, tint: RGB = [0.66, 0.66, 0.56]): void {
  const q = c.b.solid.of(c.M.burlap), p = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(m);
  q.quad([p(-w / 2, -h * 0.55, 0.16), p(w / 2, -h * 0.5, 0.12), p(w / 2, 0, 0.05), p(-w / 2, 0, 0.05)], [0, 0.45, 1, 1], [tint]);
  q.quad([p(-w / 2 + 0.1, -h, 0.1), p(w / 2 - 0.25, -h * 0.92, 0.08), p(w / 2, -h * 0.5, 0.12), p(-w / 2, -h * 0.55, 0.16)], [0, 0, 1, 0.45], [[tint[0] * 0.88, tint[1] * 0.88, tint[2] * 0.86]]);
}

/** A timber scaffold against a wall (frame `m` on the wall face at ground, +z out), `w` wide, `h` high, with a tarp on top. */
export function scaffold(c: Ctx, m: Matrix4, w: number, h: number, out = 0.7): void {
  const b = c.b, M = c.M, n = Math.max(2, Math.round(w / 2.2) + 1);
  for (let i = 0; i < n; i++) for (const z of [0.15, out]) b.box(M.darkWood, sub(m, -w / 2 + (i * w) / (n - 1), h / 2, z), 0.1, h, 0.1, TIMBER);
  for (let y = 1.9; y < h; y += 1.9) {
    b.box(M.darkWood, sub(m, 0, y, (0.15 + out) / 2), w, 0.06, out + 0.1, [0.72, 0.6, 0.46]);
    b.box(M.darkWood, sub(m, 0, y + 0.95, out), w, 0.06, 0.06, TIMBER);
  }
  b.box(M.darkWood, sub(m, 0, h * 0.5, out + 0.06, 0, 0, Math.atan2(h * 0.8, w)), Math.hypot(w, h * 0.8), 0.07, 0.05, TIMBER);
  tarp(c, sub(m, w * 0.15, h, out + 0.05), w * 0.6, Math.min(2.6, h * 0.45));
}

// ---------------------------------------------------------------- period posters (2026-11-19)

/** The eight posters of `paintPosters`, in cell order: what Johannes liked, more of it (1920, German, short). */
export const POSTERS = ['revue', 'kino', 'kabarett', 'variete', 'zoo', 'weissewoche', 'boxen', 'sechstage'] as const;
/** Cell size of the poster strip in pixels (8 cells: 1024 × 256). */
export const POSTER_CELL = { w: 128, h: 256 } as const;

/**
 * Eight peeling period posters in a 1024 × 256 strip at (x0, y0) of a sign atlas (City West and Ku'damm both
 * paint it into their own atlas, no new material): a revue, a film (Madame Dubarry, Ufa-Palast 1919), the
 * cabaret Schall und Rauch, the Wintergarten Varieté, a Zoo concert, the KaDeWe white week, a boxing night and
 * the six-day race at the Sportpalast. Each is faded, torn at an edge to the plaster with a scrap of an older
 * bill under it, glue-stained. `glow` paints the emissive map: posters are unlit (black).
 */
export function paintPosters(g: CanvasRenderingContext2D, x0: number, y0: number, glow: boolean): void {
  const { w: W, h: H } = POSTER_CELL;
  g.fillStyle = '#000';
  g.fillRect(x0, y0, W * 8, H);
  if (glow) return;
  const rng = new Rng(1920_11_19);
  const font = (px: number, f = 'bold %px "Arial Narrow", Arial, sans-serif'): string => f.replace('%', String(px));
  const text = (t: string, x: number, y: number, maxW: number, px: number, col: string, f?: string): void => {
    let s = px;
    g.font = font(s, f);
    while (g.measureText(t).width > maxW && s > 8) g.font = font(--s, f);
    g.fillStyle = col;
    g.fillText(t, x, y);
  };
  const SERIF = 'bold %px Georgia, "Times New Roman", serif', ITAL = 'italic bold %px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const poly = (pts: number[], col: string): void => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!); g.closePath(); g.fill(); };
  const disc = (x: number, y: number, r: number, col: string): void => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  POSTERS.forEach((kind, i) => {
    const x = x0 + i * W, cx = x + W / 2, y = y0;
    g.save();
    g.beginPath(); g.rect(x, y, W, H); g.clip();
    // The plaster behind and an older bill's scrap, then the poster.
    g.fillStyle = '#a3967e'; g.fillRect(x, y, W, H);
    g.fillStyle = rng.pick(['#5c7484', '#8a5a3a', '#6a6a4a', '#7a3a44']); g.fillRect(x + rng.range(-20, 40), y + rng.range(120, 200), 110, 90);
    const m = 5, px0 = x + m, py0 = y + m, pw = W - 2 * m, ph = H - 2 * m;
    const bg: Record<typeof kind, string> = { revue: '#8c1c3c', kino: '#e4dccb', kabarett: '#1a1a1e', variete: '#2c1c4a', zoo: '#d8c48a', weissewoche: '#eeeae0', boxen: '#c8a040', sechstage: '#24467a' };
    g.fillStyle = bg[kind]; g.fillRect(px0, py0, pw, ph);
    switch (kind) {
      case 'revue':
        // A dancer with a fan, the title over her, the house at the foot.
        disc(cx - 4, y + 92, 13, '#f2d8cc');
        poly([cx - 14, y + 108, cx + 8, y + 108, cx + 26, y + 196, cx - 34, y + 196], '#f6e2d6');
        for (let k = 0; k < 7; k++) { const a = -2.6 + k * 0.3; poly([cx + 10, y + 112, cx + 10 + Math.cos(a) * 52, y + 112 + Math.sin(a) * 52, cx + 10 + Math.cos(a + 0.24) * 52, y + 112 + Math.sin(a + 0.24) * 52], k % 2 ? '#e8e4ee' : '#c8c0d8'); }
        text('GROSSE', cx, y + 26, pw - 10, 22, '#fbe6d2', SERIF);
        text('REVUE', cx, y + 52, pw - 8, 34, '#fbe6d2', SERIF);
        text('TÄGLICH 8 UHR', cx, y + 222, pw - 12, 15, '#fbe6d2');
        break;
      case 'kino':
        // A profile in a powdered wig, MADAME DUBARRY, the Ufa-Palast.
        g.fillStyle = '#2a2026'; g.beginPath(); g.ellipse(cx + 6, y + 104, 30, 40, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f0e8e0'; g.beginPath(); g.ellipse(cx - 2, y + 112, 22, 30, 0.1, 0, Math.PI * 2); g.fill();
        poly([cx - 24, y + 112, cx - 32, y + 120, cx - 22, y + 124], '#f0e8e0');
        g.fillStyle = '#d8d0cc'; g.beginPath(); g.ellipse(cx + 8, y + 76, 32, 22, 0, 0, Math.PI * 2); g.fill();
        text('MADAME', cx, y + 170, pw - 12, 26, '#7a1a28', SERIF);
        text('DUBARRY', cx, y + 196, pw - 10, 26, '#7a1a28', SERIF);
        text('UFA-PALAST AM ZOO', cx, y + 228, pw - 10, 12, '#2a2026');
        break;
      case 'kabarett':
        // A white mask and a red mouth on black: Schall und Rauch.
        g.fillStyle = '#ece6dc'; g.beginPath(); g.ellipse(cx, y + 100, 32, 42, 0, 0, Math.PI * 2); g.fill();
        disc(cx - 12, y + 92, 6, '#1a1a1e'); disc(cx + 12, y + 92, 6, '#1a1a1e');
        g.fillStyle = '#c8203a'; g.beginPath(); g.ellipse(cx, y + 120, 12, 5, 0, 0, Math.PI * 2); g.fill();
        text('KABARETT', cx, y + 30, pw - 10, 24, '#ece6dc');
        text('Schall und Rauch', cx, y + 176, pw - 10, 18, '#e8b8c0', ITAL);
        text('11 UHR NACHTS', cx, y + 222, pw - 14, 14, '#ece6dc');
        break;
      case 'variete':
        // Stars and a juggler's balls over a stage arc: Wintergarten.
        for (let k = 0; k < 9; k++) disc(x + 18 + rng.range(0, pw - 20), y + 20 + rng.range(0, 60), rng.range(1.5, 3.5), '#ffe6a0');
        for (let k = 0; k < 4; k++) disc(cx - 24 + k * 16, y + 100 - Math.abs(k - 1.5) * 14, 7, ['#e8405a', '#f0c040', '#40a8c8', '#f0f0f0'][k]!);
        poly([cx - 6, y + 120, cx + 6, y + 120, cx + 12, y + 170, cx - 12, y + 170], '#e8d0e0');
        disc(cx, y + 112, 8, '#e8d0e0');
        text('VARIETÉ', cx, y + 196, pw - 8, 28, '#ffd8ec', SERIF);
        text('WINTERGARTEN', cx, y + 226, pw - 10, 14, '#ffe6a0');
        break;
      case 'zoo':
        // An elephant in silhouette: the Sunday concert in the Zoo.
        g.fillStyle = '#3a3226'; g.beginPath(); g.ellipse(cx - 4, y + 112, 38, 26, 0, 0, Math.PI * 2); g.fill();
        disc(cx + 30, y + 98, 17, '#3a3226');
        poly([cx + 40, y + 104, cx + 50, y + 150, cx + 42, y + 152, cx + 34, y + 110], '#3a3226');
        for (const dx of [-30, -14, 8, 22]) g.fillRect(cx + dx, y + 128, 10, 30);
        text('ZOO', cx, y + 42, pw - 10, 40, '#3a3226', SERIF);
        text('KONZERT', cx, y + 188, pw - 10, 22, '#6a2a1a');
        text('SONNTAGS 4 UHR', cx, y + 222, pw - 12, 14, '#3a3226');
        break;
      case 'weissewoche':
        // The white week: folded linen in a pile, the house name.
        for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? '#d8d4ca' : '#fbfaf6'; g.fillRect(cx - 34 + k * 2, y + 140 - k * 16, 68 - k * 4, 15); g.strokeStyle = '#a8a296'; g.lineWidth = 1; g.strokeRect(cx - 34 + k * 2, y + 140 - k * 16, 68 - k * 4, 15); }
        text('WEISSE', cx, y + 30, pw - 10, 30, '#1c4a6a', SERIF);
        text('WOCHE', cx, y + 60, pw - 10, 30, '#1c4a6a', SERIF);
        text('KAUFHAUS', cx, y + 190, pw - 10, 16, '#1c2a3a');
        text('DES WESTENS', cx, y + 210, pw - 10, 16, '#1c2a3a');
        break;
      case 'boxen':
        // Two boxers squaring up, the Sportpalast.
        for (const s of [-1, 1]) {
          const bx = cx + s * 22;
          disc(bx, y + 78, 10, '#2a1a12');
          poly([bx - 12, y + 90, bx + 12, y + 90, bx + 10, y + 140, bx - 10, y + 140], '#2a1a12');
          disc(bx - s * 16, y + 96, 8, '#a01818');
          poly([bx - 10, y + 140, bx - 2, y + 140, bx - 8, y + 184, bx - 16, y + 184], '#2a1a12');
          poly([bx + 2, y + 140, bx + 10, y + 140, bx + 16, y + 184, bx + 8, y + 184], '#2a1a12');
        }
        text('BOXKAMPF', cx, y + 30, pw - 8, 26, '#a01818');
        text('SPORTPALAST', cx, y + 204, pw - 10, 16, '#2a1a12');
        text('SONNABEND', cx, y + 226, pw - 12, 14, '#2a1a12');
        break;
      case 'sechstage':
        // Two wheels and a rider bent low: the six-day race.
        for (const dx of [-26, 26]) { g.strokeStyle = '#f0e8d0'; g.lineWidth = 4; g.beginPath(); g.arc(cx + dx, y + 140, 20, 0, Math.PI * 2); g.stroke(); }
        g.strokeStyle = '#f0e8d0'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 26, y + 140); g.lineTo(cx, y + 116); g.lineTo(cx + 26, y + 140); g.moveTo(cx, y + 116); g.lineTo(cx + 18, y + 112); g.stroke();
        poly([cx - 8, y + 108, cx + 20, y + 96, cx + 24, y + 104, cx - 4, y + 116], '#e8402a');
        disc(cx + 26, y + 94, 7, '#f0d8c0');
        text('SECHSTAGE', cx, y + 34, pw - 8, 24, '#f0e8d0');
        text('RENNEN', cx, y + 60, pw - 8, 26, '#f0c040');
        text('SPORTPALAST', cx, y + 214, pw - 10, 15, '#f0e8d0');
        break;
    }
    // Wear: faded paper, glue stains, a torn edge down to the plaster with the older bill showing.
    g.fillStyle = `rgba(232,222,200,${rng.range(0.1, 0.28)})`; g.fillRect(px0, py0, pw, ph);
    for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(70,58,40,${rng.range(0.06, 0.18)})`; g.fillRect(x + rng.range(0, W), y + rng.range(0, H), rng.range(3, 14), rng.range(10, 60)); }
    const corner = rng.int(4), tw = rng.range(26, 70), th = rng.range(40, 110);
    const tx = corner % 2 ? x + W : x, ty = corner < 2 ? y + H : y, sx = corner % 2 ? -1 : 1, sy = corner < 2 ? -1 : 1;
    const tear = [tx, ty, tx + sx * tw, ty, tx + sx * tw * 0.55, ty + sy * th * 0.35, tx + sx * tw * 0.7, ty + sy * th * 0.6, tx + sx * tw * 0.2, ty + sy * th * 0.75, tx, ty + sy * th];
    poly(tear, '#9c8f78');
    g.fillStyle = 'rgba(240,232,214,0.85)';
    for (let k = 2; k < tear.length - 2; k += 2) g.fillRect(tear[k]! - 2, tear[k + 1]! - 2, 4, 4);
    if (rng.next() < 0.6) { g.fillStyle = 'rgba(40,32,26,0.35)'; g.fillRect(x, y + rng.range(30, 200), W, rng.range(2, 4)); }
    g.restore();
  });
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
export function buildFence(chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number, w: Wall): void {
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
  // Step 6c: mirror frames, plinths and the gate piers in the maze (the live parts are `buildRiddleView`).
  buildRiddleStatic(m, chunkOf, ground);
  // Landmark lighting (Johannes 2026-11-19): lamps, washes and lantern bodies per sight (`charlottenburg-lights.ts`).
  lightCharlottenburgLandmarks(m, chunkOf, ground);
}

