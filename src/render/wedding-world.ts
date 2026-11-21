// M18 Wedding in code: step 1 of `docs/tasks/m18-wedding.md` (map, look A „Lampionnacht“). Colliders live in
// `src/data/map.ts`, `src/data/wedding.ts` and `src/data/kneipe.ts`; this only draws.
// Sights: simple massing in their real proportions (step 3 replaces them with builders from photos): the U
// entrance, the Alte Nazarethkirche (backdrop), the Neubau im Gerüst with crane and banner, the Amtsgericht, the
// Flakturm, the Beamtentor, the roofless Maschinenhalle with the Hochzeitspalast front and throne (E3).
// Zum Magendoktor (E2): the walk-in pub as the Späti, a readable placeholder (ochre front, red sign, the floor plan's
// furniture); roof and upper walls go into `up`, hidden while the hero is inside.
// District pieces (`buildWeddingWorld`): the plain brick Ringbahn with its two street arches and a girder span over the
// Panke (E1), station signs on the brick, park fences, the AEG brick walls, and the dressing of look A (E4 to E7):
// ruby awnings with gold fringe and carpets at shop fronts, emerald scaffold nets on some tall fronts, cloths and
// samovars on the Lange Tafel, the „kommt bald“ billboards on building sites. The lampion chains are props (`world.ts`).
//
// Cost: one new material, the sign atlas (`makeWeddingMats`: one draw call per chunk that shows a sign). Cloth is the
// existing linen batch tinted ruby, gold the enamel batch, nets the burlap batch: no other new batch. No new glow
// colour (lamp 0xffb060, string lights 0xffc890, fire 0xff8a3c, teal 0x5fd8c8). Lights: pooled spots only.
import { CylinderGeometry, Matrix4, PlaneGeometry, Vector3, type BufferGeometry } from 'three';
import { OPEN_PARTS, WALL_KIND, inPoly, lineDist, streetDist, type Landmark, type LandmarkKind, type Lot, type MapDef, type Pt, type Wall } from '../data/map';
import type { Prop } from '../data/courtyard';
import { KNEIPE, kneipeParts } from '../data/kneipe';
import { RING } from '../data/wedding';
import { Rng } from '../sim/math';
import { buildArches, buildStadtbahn } from './alex-world';
import { blk, cached, cyl, dome, openHall, roof, scaffold, tarp, windows, buildFence, type Ctx, type RGB } from './charlottenburg-world';
import { sub } from './landmarks';
import { lm, lp, type ChunkBuilder } from './map-world';
import { canvas, toTexture } from './paint';
import type { Materials, LitMaterial } from './materials';
import { buildUrbanProp } from './props-urban';

/** Sights this file draws on the Wedding map (the U entrance kind is Mitte's, drawn here without Mitte's atlas). */
export const WEDDING_KINDS = new Set<LandmarkKind>(['ubahn', 'nazareth', 'neubau', 'amtsgericht', 'flakturm', 'beamtentor', 'maschinenhalle']);

/** Look A palette on the tinted batches. */
const W = {
  ruby: [1.05, 0.16, 0.2], rubyDark: [0.62, 0.1, 0.14], gold: [1.7, 1.15, 0.32], emerald: [0.18, 0.62, 0.42], ochre: [1.12, 0.84, 0.48],
  brick: [0.92, 0.5, 0.4], brickDark: [0.62, 0.34, 0.3], sand: [0.98, 0.88, 0.7], concrete: [0.62, 0.62, 0.6], wood: [0.55, 0.36, 0.24],
  felt: [0.16, 0.5, 0.28], iron: [0.5, 0.52, 0.55], yellowBrick: [1.12, 0.92, 0.62],
} satisfies Record<string, RGB>;

// ---------------------------------------------------------------- sign atlas (the one new material)

/** Cells of the sign atlas (2 columns × 8 rows of 512 × 128 px). */
export const SIGN = { magendoktor: 0, tagnacht: 1, sWedding: 2, gesundbrunnen: 3, kommtBald: 4, eroeffnung: 5, palast: 6, u: 7, amtsgericht: 8, festsaal: 9 } as const;
const CELLS: Array<{ text: string; bg: string; fg: string; font: string; glow: number }> = [
  { text: 'Zum Magendoktor', bg: '#9a1b1f', fg: '#fff4e4', font: 'bold italic 76px Georgia, serif', glow: 1 },
  { text: 'Tag u. Nacht', bg: '#f2c94b', fg: '#2a1a10', font: 'bold 72px Arial, sans-serif', glow: 0.8 },
  { text: 'S Wedding', bg: '#0f5a33', fg: '#f4f2ea', font: 'bold 78px Arial, sans-serif', glow: 0.5 },
  { text: 'Gesundbrunnen', bg: '#0f5a33', fg: '#f4f2ea', font: 'bold 70px Arial, sans-serif', glow: 0.5 },
  { text: 'Der Wedding kommt bald', bg: '#0e4a3a', fg: '#f2c14b', font: 'bold 54px Arial, sans-serif', glow: 0.35 },
  { text: 'Eröffnung: bald', bg: '#f1ede2', fg: '#1d5a44', font: 'bold 64px Arial, sans-serif', glow: 0.3 },
  { text: 'Hochzeitspalast', bg: '#7a1420', fg: '#f6cf62', font: 'bold italic 70px Georgia, serif', glow: 1 },
  { text: 'U', bg: '#1c4f9c', fg: '#ffffff', font: 'bold 104px Arial, sans-serif', glow: 0.6 },
  { text: 'Amtsgericht', bg: '#2c2a26', fg: '#e8dcc0', font: 'bold 66px Georgia, serif', glow: 0.25 },
  { text: 'Festsaal', bg: '#1d4a3c', fg: '#f6cf62', font: 'bold italic 76px Georgia, serif', glow: 0.9 },
];

/** Painted sign atlas: colour map and emissive map (letters glow, the board a little). */
function paintSigns(): { map: ReturnType<typeof toTexture>; emissiveMap: ReturnType<typeof toTexture> } {
  const [c, g] = canvas(1024, 1024), [e, ge] = canvas(1024, 1024);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 1024, 1024);
  CELLS.forEach((s, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    g.fillStyle = s.bg;
    g.fillRect(x, y, 512, 128);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 6;
    g.strokeRect(x + 6, y + 6, 500, 116);
    // A worn board: a few darker smudges.
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let k = 0; k < 6; k++) g.fillRect(x + ((k * 97 + i * 31) % 480), y + ((k * 53 + i * 17) % 100), 30, 14);
    const lum = Math.round(40 * s.glow);
    ge.fillStyle = `rgb(${lum},${lum},${lum})`;
    ge.fillRect(x, y, 512, 128);
    for (const [k, col] of [[g, s.fg], [ge, `rgb(${Math.round(255 * s.glow)},${Math.round(255 * s.glow)},${Math.round(255 * s.glow)})`]] as const) {
      k.fillStyle = col;
      k.font = s.font;
      k.textAlign = 'center';
      k.textBaseline = 'middle';
      k.fillText(s.text, x + 256, y + 68, 480);
    }
  });
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}

export interface WeddingMats { signs: LitMaterial }

/** The sign atlas material (Wedding only). */
export function makeWeddingMats(materials: Materials): WeddingMats {
  if (typeof document === 'undefined') return { signs: materials.surface({ color: 0x884422, roughness: 0.6 }) };
  const t = paintSigns();
  return { signs: materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffe6b0, emissiveIntensity: 1.2, roughness: 0.6 }) };
}

/** A unit plane (facing +z) with the UVs of one atlas cell. */
function cellGeo(i: number): BufferGeometry {
  return cached(`wsign${i}`, () => {
    const g = new PlaneGeometry(1, 1), uv = g.getAttribute('uv'), u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) * 0.125, v0 = v1 - 0.125;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) * 0.125);
    return g;
  });
}

/** A sign card `w` × `h` on frame `m` (facing its +z); both faces when `back`. */
function sign(b: ChunkBuilder, m: Matrix4, w: number, h: number, cell: number, back = false): void {
  const M = b.mm.wedding;
  if (!M) return;
  b.geo(M.signs, cellGeo(cell), m.clone().multiply(new Matrix4().makeScale(w, h, 1)));
  if (back) b.geo(M.signs, cellGeo(cell), m.clone().multiply(new Matrix4().makeRotationY(Math.PI)).multiply(new Matrix4().makeScale(w, h, 1)));
}

// ---------------------------------------------------------------- sights (massing, step 1)

const ctxOf = (b: ChunkBuilder, l: Landmark): Ctx => ({ b, M: b.mm, l, rng: new Rng(Math.round(l.x * 31 + l.z * 17) + 1888) });

export function buildWeddingLandmark(b: ChunkBuilder, l: Landmark): void {
  const c = ctxOf(b, l), M = c.M;
  switch (l.kind) {
    case 'ubahn': {
      // U Leopoldplatz: a stair well between low walls with railings, the U sign on a pole (no BVG livery).
      const F = lm(l);
      b.solid.excludeOccluder(() => {
        b.box(M.dark, sub(F, 0, 0.012, -0.2), 2.6, 0.02, 5.4);
        for (let i = 0; i < 12; i++) { const k = 0.85 * Math.pow(1 - i / 12, 1.5) + 0.05; b.box(M.concrete, sub(F, 0, 0.03, 2.4 - (i + 0.5) * 0.42), 2.5, 0.025, 0.37, [k, k, k]); }
        for (const s of [-1, 1]) {
          b.box(M.concrete, sub(F, s * 1.45, 0.25, 0), 0.3, 0.5, 5.8, [0.8, 0.78, 0.74]);
          for (const y of [0.55, 1.15]) b.box(M.iron, sub(F, s * 1.45, y, 0), 0.05, 0.05, 5.6, W.iron);
          for (let z = -2.7; z <= 2.7; z += 0.9) b.box(M.iron, sub(F, s * 1.45, 0.85, z), 0.05, 0.7, 0.05, W.iron);
        }
        b.box(M.concrete, sub(F, 0, 0.25, -2.85), 3.2, 0.5, 0.3, [0.8, 0.78, 0.74]);
        b.box(M.iron, sub(F, 1.75, 1.6, 2.6), 0.1, 3.2, 0.1, [1.3, 1.3, 1.35]);
        sign(b, sub(F, 1.75, 3.0, 2.66), 0.75, 0.75, SIGN.u, true);
      });
      b.light(lp(l, 0, 1.6, 1.2), 0xffb060, 10, 9, 0.03, 3.4);
      return;
    }
    case 'nazareth': {
      // Alte Nazarethkirche (Schinkel, yellow brick hall, a small tower at the front to the square): backdrop.
      const T: RGB = W.yellowBrick;
      blk(c, M.brick, 0, 0, -1, 15, 7.5, 10, T);
      roof(c, M.slate, 0, 7.5, -1, 15.4, 10.4, 3.4, 15.4, 0.4, [0.55, 0.52, 0.5]);
      windows(c, 0, -1, 15, 10, [3.4], { sides: true, front: false }, 0.25, 1.2, 3, 3.4);
      blk(c, M.brick, 0, 0, 4.9, 4, 12, 3.4, T);
      roof(c, M.slate, 0, 12, 4.9, 4.2, 3.6, 3.2, 0.3, 0.3, [0.5, 0.48, 0.47]);
      blk(c, M.darkWood, 0, 0, 6.65, 1.6, 2.8, 0.1, W.wood);
      b.light(lp(l, 0, 2.6, 7.2), 0xffb060, 9, 8, 0.05, 3);
      return;
    }
    case 'neubau': {
      // Neubau im Gerüst (invented): a concrete shell of five floors behind a scaffold with green nets, a crane in
      // the site, the banner „Der Wedding kommt bald“ low enough for the camera (E5, E7).
      const H = 3.2, n = 5, w = l.hx * 2 - 2, d = l.hz * 2 - 3;
      for (let f = 0; f <= n; f++) blk(c, M.concrete, 0, f * H, -0.5, w, 0.3, d, W.concrete);
      for (const x of [-w / 2 + 0.3, -w / 6, w / 6, w / 2 - 0.3]) for (const z of [-d / 2 - 0.2, d / 2 - 0.8]) blk(c, M.concrete, x, 0, z, 0.4, n * H, 0.4, W.concrete);
      blk(c, M.concrete, -w / 2 + 3, 0, -2, 5, n * H + 1.5, 4, [0.7, 0.7, 0.68]);
      scaffold(c, lm(l, 0, 0, l.hz - 1.2), w - 1, n * H - 1, 0.9);
      // Emerald nets over the upper scaffold (shown in reveal shots), the banner across the first floor.
      for (let i = 0; i < 4; i++) tarp(c, lm(l, -w / 2 + 2.2 + i * ((w - 4.4) / 3), n * H - 0.6, l.hz - 0.2), (w - 2) / 4, 7.5, W.emerald);
      sign(b, lm(l, 0, 3.3, l.hz + 0.05), 10, 1.6, SIGN.kommtBald);
      buildUrbanProp(b, { kind: 'crane', x: lp(l, w / 2 - 3, 0, -d / 2 + 2).x, z: lp(l, w / 2 - 3, 0, -d / 2 + 2).z, rot: l.rot + 0.6, size: 1 }, c.rng);
      b.light(lp(l, -3, 1.4, l.hz + 1.2), 0xd8ecff, 18, 10, 0.02, 5, { yaw: l.rot, stretch: 1.6, reach: 2.4, halo: 0.35 });
      return;
    }
    case 'amtsgericht': {
      // Amtsgericht Wedding (neo-Gothic, castle-like; memory, step 3 checks photos): sandstone and brick, a tower
      // over the entrance, corner turrets, stepped gables; the front to the Brunnenplatz.
      const T = W.sand, w = l.hx * 2 - 1, d = l.hz * 2 - 1, h = 11;
      blk(c, M.brick, 0, 0, 0, w, h, d, W.brick);
      blk(c, M.stucco, 0, h - 0.8, 0, w + 0.3, 0.8, d + 0.3, T);
      windows(c, 0, 0, w, d, [2.4, 5.8, 9], { front: true, sides: true }, 0.12, 1.1, 2, 3.2);
      roof(c, M.slate, 0, h, 0, w, d, 3.6, w - 6, 0.6, [0.42, 0.44, 0.48]);
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) { cyl(c, M.stucco, x, 0, z, 1.3, h + 3, T, 10); roof(c, M.slate, x, h + 3, z, 2.8, 2.8, 3, 0.2, 0.2, [0.4, 0.42, 0.46]); }
      blk(c, M.stucco, 0, 0, d / 2 + 0.6, 6, h + 7, 3.6, T);
      roof(c, M.slate, 0, h + 7, d / 2 + 0.6, 6.4, 4, 5, 0.3, 0.3, [0.4, 0.42, 0.46]);
      blk(c, M.darkWood, 0, 0, d / 2 + 2.45, 2.4, 3.4, 0.1, W.wood);
      sign(b, lm(l, 0, 4.2, d / 2 + 2.47), 4.2, 0.9, SIGN.amtsgericht);
      for (const x of [-2, 2]) b.light(lp(l, x, 2.8, d / 2 + 3), 0xffb060, 10, 8, 0.05, 3);
      return;
    }
    case 'flakturm': {
      // Flakturm Humboldthain: the bare north face of the concrete tower over the rubble hill, corner bastions,
      // gun slits; plants on the platform edge. The south part sinks into the slope.
      const w = l.hx * 2 - 2, d = l.hz * 2 - 2, h = 17;
      blk(c, M.concrete, 0, -3, 0, w, h + 3, d, [0.55, 0.55, 0.53]);
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) blk(c, M.concrete, x, -3, z, 3.4, h + 4.5, 3.4, [0.5, 0.5, 0.49]);
      for (let y = 3; y < h; y += 3.4) for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 2.2) blk(c, M.dark, x, y, -d / 2 - 0.02, 0.5, 1.1, 0.05);
      for (let i = 0; i < 9; i++) blk(c, M.ivy, c.rng.range(-w / 2, w / 2), h - 0.4, c.rng.range(-d / 2, d / 2), c.rng.range(1, 3), 0.8, c.rng.range(1, 2.5), [0.4, 0.6, 0.35]);
      // The bunker door on the west side (the side passage's cache).
      blk(c, M.rust, -w / 2 - 1.75, 0, 1, 0.1, 2.4, 1.6, [0.6, 0.45, 0.35]);
      b.light(lp(l, 0, 2.2, -d / 2 - 1), 0xd8ecff, 12, 9, 0.02, 4);
      return;
    }
    case 'beamtentor': {
      // Beamtentor (AEG, brick): two towers round the passage, a gabled bridge with a clock over it.
      for (const p of OPEN_PARTS.beamtentor!) {
        blk(c, M.brick, p.x, 0, p.z, p.hx * 2, 11, p.hz * 2, W.brick);
        roof(c, M.slate, p.x, 11, p.z, p.hx * 2 + 0.3, p.hz * 2 + 0.3, 2.4, 0.3, p.hz * 2, [0.4, 0.42, 0.46]);
        windows(c, p.x, p.z, p.hx * 2, p.hz * 2, [5, 8], { front: true, back: true }, 0.2, 0.9, 1.6, 2.5);
      }
      blk(c, M.brick, 0, 5.2, 0, 6.2, 4, 4.4, W.brickDark);
      blk(c, M.stucco, 0, 5.2, 0, 6.4, 0.4, 4.6, W.sand);
      cyl(c, M.enamel, 0, 7.2, 2.25, 0.8, 0.1, [1.2, 1.15, 1.05], 16);
      b.light(lp(l, 0, 4.6, 0), 0xffb060, 12, 9, 0.04, 3.6);
      return;
    }
    case 'maschinenhalle': {
      // AEG Maschinenhalle, roofless (E3): tall brick north wall, side walls falling toward the camera, a low broken
      // south wall; inside at the north wall the gilded front of the Hochzeitspalast and the throne on a dais.
      openHall(c, 12, 1.6, 4.5, W.brick);
      const z0 = -l.hz + 1.1;
      blk(c, M.enamel, 0, 0, z0 + 0.4, 30, 7.5, 0.8, W.gold);
      blk(c, M.enamel, 0, 7.5, z0 + 0.4, 31, 0.6, 1.1, [1.8, 1.25, 0.4]);
      // Gilded trims that glow in the lamp light: a band over the arches and the cornice edge (the emissive lamp batch).
      blk(c, M.lampGlass, 0, 5.9, z0 + 0.84, 29, 0.12, 0.06, [0.85, 0.55, 0.2]);
      blk(c, M.lampGlass, 0, 7.45, z0 + 0.98, 31, 0.08, 0.06, [0.85, 0.55, 0.2]);
      for (let i = -2; i <= 2; i++) {
        blk(c, M.dark, i * 5.6, 0, z0 + 0.82, 3, 4.6, 0.05);
        dome(c, M.enamel, i * 5.6, 4.6, z0 + 0.84, 1.5, W.gold, 1);
        cyl(c, M.enamel, i * 5.6 + 2.8, 0, z0 + 1.1, 0.35, 7.5, [1.6, 1.1, 0.35], 8);
      }
      for (const x of [-9, 0, 9]) dome(c, M.enamel, x, 8.1, z0 + 0.4, x === 0 ? 2.6 : 1.6, W.gold, 1.3);
      sign(b, lm(l, 0, 6.3, z0 + 0.86), 9, 1.2, SIGN.palast);
      // Dais, throne and the ruby runner toward the floor.
      blk(c, M.linen, 0, 0, z0 + 4.5, 9, 0.45, 4.5, W.ruby);
      blk(c, M.enamel, 0, 0.45, z0 + 3.4, 2.4, 3.6, 1.2, W.gold);
      blk(c, M.linen, 0, 0.45, z0 + 4.1, 1.8, 0.9, 1.4, W.rubyDark);
      blk(c, M.linen, 0, 0, z0 + 15, 3, 0.03, 20, W.ruby);
      // Chandeliers over the floor (lamp bodies, three pooled spots).
      for (const x of [-12, 0, 12]) {
        cyl(c, M.iron, x, 6.2, z0 + 9, 0.03, 5, W.iron, 4);
        for (let k = 0; k < 6; k++) cyl(c, M.lampGlass, x + Math.cos(k) * 0.9, 5.8, z0 + 9 + Math.sin(k) * 0.9, 0.12, 0.3, [1.9, 1.3, 0.6], 6);
        b.light(lp(l, x, 5.5, z0 + 9), 0xffc890, 22, 14, 0.06, 6, { halo: 0.9 });
      }
      return;
    }
  }
}

// ---------------------------------------------------------------- Zum Magendoktor (E2)

/** Plan frame of the pub (x east, z south, the door north) as a landmark frame. */
const K = (l: Landmark, px: number, y: number, pz: number, ry = 0): Matrix4 => lm(l, -px, y, -pz, ry);
const KP = (l: Landmark, px: number, y: number, pz: number): Vector3 => lp(l, -px, y, -pz);

/**
 * Zum Magendoktor: ochre plaster outside, wood inside; `b` gets the floor, everything up to knee height and the
 * furniture, `up` the upper walls (the south wall too), the lintel, the signs and the flat roof (hidden inside).
 */
export function buildKneipe(b: ChunkBuilder, up: ChunkBuilder, l: Landmark): void {
  const M = b.mm, { w, d, height: H, low, door } = KNEIPE, rng = new Rng(111);
  b.box(M.darkWood, K(l, 0, 0.04, 0), w - 0.6, 0.08, d - 0.6, [0.62, 0.42, 0.3]);
  for (const p of kneipeParts()) {
    const m = K(l, p.x, 0, p.z);
    switch (p.kind) {
      case 'wall':
        b.box(M.stucco, sub(m, 0, low / 2, 0), p.hx * 2, low, p.hz * 2, W.ochre);
        up.box(M.stucco, sub(m, 0, low + (H - low) / 2, 0), p.hx * 2, H - low, p.hz * 2, W.ochre);
        break;
      case 'shelf':
        b.box(M.darkWood, sub(m, 0, 1.2, 0), p.hx * 2, 2.4, p.hz * 2, W.wood);
        for (let z = -p.hz + 0.3; z < p.hz - 0.2; z += 0.22) for (const y of [1.05, 1.55, 2.05]) if (rng.next() > 0.25) b.box(M.lampGlass, sub(m, 0.32, y, z), 0.08, 0.28, 0.08, rng.pick([[0.6, 1.2, 0.5], [1.6, 0.9, 0.35], [0.9, 0.7, 0.4]] as RGB[]));
        break;
      case 'counter':
        b.box(M.darkWood, sub(m, 0, 0.55, 0), p.hx * 2, 1.1, p.hz * 2, W.wood);
        b.box(M.wood, sub(m, 0, 1.13, 0), p.hx * 2 + 0.2, 0.07, p.hz * 2 + 0.1, [0.95, 0.72, 0.5]);
        b.geo(M.enamel, cached('zapf', () => new CylinderGeometry(0.06, 0.08, 0.55, 8)), sub(m, 0, 1.45, -1.2), W.gold);
        for (let z = -p.hz + 0.6; z < p.hz; z += 1.1) b.geo(M.wood, cached('hocker', () => new CylinderGeometry(0.2, 0.16, 0.75, 8)), sub(m, 0.95, 0.38, z), W.wood);
        break;
      case 'stammtisch':
        b.box(M.wood, sub(m, 0, 0.75, 0), p.hx * 2, 0.08, p.hz * 2, [0.85, 0.6, 0.4]);
        b.box(M.darkWood, sub(m, 0, 0.37, 0), 0.3, 0.74, 0.3, W.wood);
        b.box(M.iron, sub(m, 0, 1.15, 0), 0.03, 0.8, 0.03, W.iron);
        b.box(M.enamel, sub(m, 0, 1.6, 0), 0.6, 0.25, 0.03, W.gold);
        break;
      case 'billard':
        b.box(M.darkWood, sub(m, 0, 0.4, 0), p.hx * 2, 0.8, p.hz * 2, W.wood);
        b.box(M.linen, sub(m, 0, 0.82, 0), p.hx * 2 - 0.2, 0.04, p.hz * 2 - 0.2, W.felt);
        b.box(M.lampGlass, sub(m, 0, 2.3, 0), 0.4, 0.12, 1.6, [1.6, 1.4, 0.8]);
        break;
      case 'jukebox':
        b.box(M.enamel, sub(m, 0, 0.8, 0), p.hx * 2, 1.6, p.hz * 2, [0.9, 0.25, 0.45]);
        b.box(M.lampGlass, sub(m, -p.hx - 0.01, 1.0, 0), 0.03, 0.7, p.hz * 1.6, [1.9, 0.9, 1.2]);
        break;
      case 'automat':
        b.box(M.enamel, sub(m, 0, 0.85, 0), p.hx * 2, 1.7, p.hz * 2, [0.35, 0.36, 0.42]);
        b.box(M.lampGlass, sub(m, -p.hx - 0.01, 1.15, 0), 0.03, 0.45, p.hz * 1.5, [1.5, 1.6, 0.5]);
        break;
      case 'pillar':
        b.box(M.darkWood, sub(m, 0, 0.55, 0), p.hx * 2, 1.1, p.hz * 2, W.wood);
        up.box(M.darkWood, sub(m, 0, low + (H - low) / 2, 0), p.hx * 2, H - low, p.hz * 2, W.wood);
        break;
      case 'table':
        b.geo(M.wood, cached('rtisch', () => new CylinderGeometry(0.6, 0.6, 0.06, 12)), sub(m, 0, 0.76, 0), [0.85, 0.6, 0.4]);
        b.geo(M.darkWood, cached('rfuss', () => new CylinderGeometry(0.07, 0.12, 0.74, 6)), sub(m, 0, 0.37, 0), W.wood);
        for (let k = 0; k < 3; k++) b.geo(M.wood, cached('hocker', () => new CylinderGeometry(0.2, 0.16, 0.75, 8)), sub(m, Math.cos(k * 2.1 + p.x) * 1.0, 0.38, Math.sin(k * 2.1 + p.x) * 1.0), W.wood);
        b.geo(M.lampGlass, cached('glas', () => new CylinderGeometry(0.05, 0.04, 0.16, 6)), sub(m, 0.15, 0.87, 0.1), [1.7, 1.2, 0.4]);
        break;
    }
  }
  // Wood panelling inside at knee height, a dart board on the north wall.
  b.box(M.darkWood, K(l, 0, 0.55, d / 2 - 0.52), w - 1.2, 1.0, 0.04, W.wood);
  b.box(M.enamel, K(l, 2, 1.0, -d / 2 + 0.52), 0.5, 0.5, 0.04, [0.9, 0.2, 0.2]);
  // Light inside (warm, low over the tables and the counter) and a lamp at the door.
  b.light(KP(l, -6.5, 2.8, -1), 0xffb060, 22, 12, 0.06, 7, { halo: 0.4 });
  b.light(KP(l, 4.5, 2.8, 2), 0xffb060, 20, 12, 0.06, 7, { halo: 0.4 });
  b.light(KP(l, 0, 2.6, -d / 2 - 1.4), 0xffc890, 12, 9, 0.05, 4);
  // Upper part: lintel over the door, the signs, a balcony rail, the flat roof with a parapet.
  up.box(M.stucco, K(l, 0, (2.7 + H) / 2, -d / 2 + KNEIPE.wall / 2), door, H - 2.7, KNEIPE.wall, W.ochre);
  sign(up, K(l, 0, 3.15, -d / 2 - 0.05, Math.PI), 7.5, 1.0, SIGN.magendoktor);
  sign(up, K(l, -4.6, 2.2, -d / 2 - 0.05, Math.PI), 2.2, 0.55, SIGN.tagnacht);
  // The house stands between camera and square: the sign also stands on the south roof edge, readable from the south.
  sign(up, K(l, 0, H + 0.75, d / 2 + 0.1), 9, 1.2, SIGN.magendoktor);
  up.box(M.tar, K(l, 0, H + 0.12, 0), w + 0.4, 0.24, d + 0.4, [0.55, 0.52, 0.5]);
  for (const s of [-1, 1]) up.box(M.stucco, K(l, s * (w / 2), H + 0.45, 0), 0.3, 0.5, d + 0.4, W.ochre);
  up.box(M.stucco, K(l, 0, H + 0.45, -d / 2), w + 0.4, 0.5, 0.3, W.ochre);
  up.box(M.iron, K(l, 0, H + 1.1, -d / 2 - 0.6), 5, 0.05, 0.05, W.iron);
  // Outside the front: two closed red parasols and a barrel as a standing table.
  for (const x of [-7, 6.5]) {
    b.box(M.iron, K(l, x, 1.2, -d / 2 - 1.6), 0.05, 2.4, 0.05, W.iron);
    b.geo(M.linen, cached('schirm', () => new CylinderGeometry(0.05, 0.22, 1.5, 6)), K(l, x, 2.1, -d / 2 - 1.6), W.ruby);
  }
  b.geo(M.rust, cached('fass', () => new CylinderGeometry(0.35, 0.35, 1.05, 10)), K(l, 3.5, 0.52, -d / 2 - 1.3), [0.6, 0.4, 0.28]);
}

// ---------------------------------------------------------------- district pieces

/** Boxes along a polyline in pieces of at most `step` meters. */
function along(pts: readonly Pt[], step: number, fn: (x: number, z: number, rot: number, len: number, i: number) => void): void {
  let i = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1]!, [bx, bz] = pts[k]!, len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const n = Math.max(1, Math.ceil(len / step)), rot = Math.atan2(bx - ax, bz - az);
    for (let j = 0; j < n; j++) { const t = (j + 0.5) / n; fn(ax + (bx - ax) * t, az + (bz - az) * t, rot, len / n, i++); }
  }
}

/** Brick walls (AEG yard, the Brandmauer, the yard behind the pub): piers every 6 m, a coping; south walls stay low for the camera. */
function buildBrickWall(chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number, w: Wall): void {
  const { height, thick } = WALL_KIND.brick, low = /Süd/.test(w.name), h = low ? 1.5 : height, rng = new Rng(w.name.length * 131);
  along(w.pts, 3, (x, z, rot, len, i) => {
    const b = chunkOf(x, z), M = b.mm, m = new Matrix4().makeRotationY(rot).setPosition(x, ground(x, z), z), top = h * rng.range(0.92, 1.04);
    b.box(M.brick, sub(m, 0, top / 2, 0), thick, top, len + 0.05, W.brick);
    b.box(M.stucco, sub(m, 0, top + 0.08, 0), thick + 0.15, 0.16, len + 0.05, [0.7, 0.66, 0.6]);
    if (i % 2 === 0) b.box(M.brick, sub(m, 0, (top + 0.3) / 2, len / 2), thick + 0.3, top + 0.3, 0.5, W.brickDark);
  });
}

/** E1: a riveted girder span over the Panke between the two viaduct ends. */
function buildGirder(chunkOf: (x: number, z: number) => ChunkBuilder, a: Pt, c: Pt): void {
  const cx = (a[0] + c[0]) / 2, cz = (a[1] + c[1]) / 2, len = Math.hypot(c[0] - a[0], c[1] - a[1]) + 1, ry = Math.atan2(c[0] - a[0], c[1] - a[1]);
  const b = chunkOf(cx, cz), M = b.mm, m = new Matrix4().makeRotationY(ry).setPosition(cx, 0, cz), h = RING.h;
  b.solid.captureOccluder(() => {
    for (const s of [-1, 1]) b.box(M.iron, sub(m, s * (RING.width / 2 - 0.6), h - 0.9, 0), 0.5, 1.6, len, [0.35, 0.4, 0.38]);
    b.box(M.iron, sub(m, 0, h - 0.15, 0), RING.width, 0.3, len, [0.3, 0.32, 0.3]);
  });
  for (let z = -len / 2 + 0.5; z < len / 2; z += 1.2) b.box(M.iron, sub(m, 0, h - 1.4, z), RING.width - 1.2, 0.2, 0.2, [0.32, 0.36, 0.34]);
  for (const s of [-1, 1]) b.box(M.iron, sub(m, s * (RING.width / 2), h + 0.6, 0), 0.06, 0.06, len, W.iron);
}

/** Look A dressing at shop fronts: ruby awnings with a gold fringe, a carpet on the pavement; lit shop window glow. */
function dressFront(b: ChunkBuilder, m: Matrix4, w: number, carpet: boolean): void {
  const M = b.mm;
  b.solid.excludeOccluder(() => {
    b.box(M.linen, sub(m, 0, 2.95, 0.75, 0, 0.32), w, 0.05, 1.6, W.ruby);
    b.box(M.enamel, sub(m, 0, 2.62, 1.52), w, 0.2, 0.03, W.gold);
    if (carpet) {
      b.box(M.linen, sub(m, 0, 0.02, 2.2), Math.min(2.2, w * 0.6), 0.02, 2.6, W.rubyDark);
      for (const s of [-1, 1]) b.box(M.enamel, sub(m, s * Math.min(1.05, w * 0.3 - 0.05), 0.03, 2.2), 0.08, 0.02, 2.6, W.gold);
    }
  });
}

/**
 * M18 hook from `buildMapWorld` (only on Wedding): the Ringbahn, fences and walls, station signs, the front dressing
 * of the street lots (awnings, carpets, nets), the Lange Tafel's cloths and samovars, billboards at building sites.
 */
export function buildWeddingWorld(m: MapDef, lots: readonly Lot[], props: readonly Prop[], chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number): void {
  const runs = (m.viaducts ?? []).filter((v) => v.kind === 'stadtbahn');
  for (const v of runs) buildStadtbahn(chunkOf, v, true);
  // Openings between the runs: brick decks over the streets, the girder span where the Panke passes.
  const river = m.rivers[0]!;
  const spans: Array<[Pt, Pt]> = [];
  for (let i = 1; i < runs.length; i++) {
    const a = runs[i - 1]!.pts.at(-1)!, c = runs[i]!.pts[0]!;
    if (lineDist(river.pts, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2) < river.width) buildGirder(chunkOf, a, c);
    else spans.push([a, c]);
  }
  buildArches(chunkOf, m, spans, [[0.42, 0.4, 0.38], [0.42, 0.4, 0.38]]);
  // Station signs on the camera-side brick beside the two street openings (no station building).
  spans.forEach(([a, c], i) => {
    const ux = c[0] - a[0], uz = c[1] - a[1], l = Math.hypot(ux, uz), nx = -uz / l, nz = ux / l, ry = Math.atan2(nx, nz);
    for (const s of [-1, 1]) {
      const p = s < 0 ? a : c, x = p[0] - (s * ux / l) * 4 + nx * (RING.width / 2 + 0.06), z = p[1] - (s * uz / l) * 4 + nz * (RING.width / 2 + 0.06);
      sign(chunkOf(x, z), new Matrix4().makeRotationY(ry).setPosition(x, 4.3, z), 5, 1.1, i === 0 ? SIGN.sWedding : SIGN.gesundbrunnen);
    }
  });
  for (const w of m.walls ?? []) {
    if (w.kind === 'fence') buildFence(chunkOf, ground, w);
    else if (w.kind === 'brick') buildBrickWall(chunkOf, ground, w);
  }

  // Front dressing of the street lots (look A): every other intact shop or low Altbau front on a street gets a ruby
  // awning (every third with a carpet); some tall fronts carry a scaffold with an emerald net.
  const rng = new Rng(1913);
  let n = 0;
  for (const l of lots) {
    if (l.kind === 'tree' || l.kind === 'special' || l.ruin || l.shape) continue;
    const fx = l.x + Math.sin(l.rot) * (l.d / 2), fz = l.z + Math.cos(l.rot) * (l.d / 2);
    // Fronts on a street or on a paved square (the hand-placed rows round the Leopoldplatz and the Nettelbeckplatz).
    const ox = fx + Math.sin(l.rot) * 1.5, oz = fz + Math.cos(l.rot) * 1.5;
    if (streetDist(m, fx, fz).d > 4.5 && !m.areas.some((a) => a.frontage === null && a.ground === 'cobbles' && inPoly(a.poly, ox, oz))) continue;
    const b = chunkOf(fx, fz), y = ground(fx, fz), fm = new Matrix4().makeRotationY(l.rot).setPosition(fx, y, fz);
    n++;
    if (l.floors >= 3 && n % 4 === 1) {
      const c: Ctx = { b, M: b.mm, l: { kind: 'neubau', x: fx, z: fz, rot: l.rot, hx: 0, hz: 0, clear: 0 }, rng };
      const sw = Math.min(l.w - 2, 10), sh = 3.3 * l.floors;
      scaffold(c, fm, sw, sh, 0.8);
      for (let k = 0; k < 2; k++) tarp(c, sub(fm, -sw / 4 + (k * sw) / 2, sh - 0.4, 0.95), sw / 2, sh - 4.8, W.emerald);
    } else dressFront(b, fm, Math.min(l.w - 1.5, 9), n % 3 === 0);
  }
  // Building sites carry the „Eröffnung: bald“ billboard (E7): a board on two posts at the lot front.
  for (const l of lots) if (l.kind === 'special' && l.special === 'baustelle') {
    const fx = l.x + Math.sin(l.rot) * (l.d / 2 - 1.2), fz = l.z + Math.cos(l.rot) * (l.d / 2 - 1.2), b = chunkOf(fx, fz);
    const fm = new Matrix4().makeRotationY(l.rot).setPosition(fx, ground(fx, fz), fz);
    for (const s of [-1, 1]) b.box(b.mm.iron, sub(fm, s * 2.2, 1.4, -0.08), 0.1, 2.8, 0.1, W.iron);
    sign(b, sub(fm, 0, 2.3, 0), 5, 1.2, SIGN.eroeffnung);
  }
  // E7 wedding cars: every other car wreck carries white ribbons over the bonnet and a bow (the Hochzeitskorso).
  props.filter((p) => p.kind === 'car').forEach((p, i) => {
    if (i % 2) return;
    const b = chunkOf(p.x, p.z), M = b.mm, fm = new Matrix4().makeRotationY(p.rot).setPosition(p.x, ground(p.x, p.z), p.z);
    b.solid.excludeOccluder(() => {
      for (const s of [-0.35, 0.35]) b.box(M.linen, sub(fm, s, 1.02, 1.1, 0, 0.12), 0.12, 0.03, 1.9, [1.45, 1.4, 1.35]);
      b.box(M.linen, sub(fm, 0, 0.95, 2.05), 0.5, 0.22, 0.08, [1.45, 1.4, 1.35]);
      b.box(M.linen, sub(fm, 0, 1.55, -0.2), 1.3, 0.03, 0.15, W.ruby);
    });
  });
  // The Lange Tafel (E7): ruby cloths with a gold runner on the beer tables, samovars and tea glasses.
  const tafel = m.encounters.find((e) => e.id === 'langetafel');
  for (const p of m.fixedProps) {
    if (p.kind !== 'beerTable' || !tafel || Math.hypot(p.x - tafel.x, p.z - tafel.z) > tafel.r + 4) continue;
    const b = chunkOf(p.x, p.z), M = b.mm, fm = new Matrix4().makeRotationY(p.rot).setPosition(p.x, ground(p.x, p.z), p.z);
    b.box(M.linen, sub(fm, 0, 0.8, 0), 2.3, 0.03, 0.9, W.ruby);
    b.box(M.enamel, sub(fm, 0, 0.82, 0), 2.3, 0.02, 0.25, W.gold);
    b.geo(M.enamel, cached('samowar', () => new CylinderGeometry(0.14, 0.18, 0.5, 8)), sub(fm, -0.6, 1.07, 0), W.gold);
    b.geo(M.lampGlass, cached('glas', () => new CylinderGeometry(0.05, 0.04, 0.16, 6)), sub(fm, 0.5, 0.9, 0.15), [1.7, 1.2, 0.4]);
  }
}

