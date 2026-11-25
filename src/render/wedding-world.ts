// M18 Wedding in code: step 1 of `docs/tasks/m18-wedding.md` (map, look A „Lampionnacht“). Colliders live in
// `src/data/map.ts`, `src/data/wedding.ts` and `src/data/kneipe.ts`; this only draws.
// Sights: the U entrance here; the six sights from photos and the Neubau in `wedding-sights.ts` (step 3), their light
// in `wedding-lights.ts`. Zum Magendoktor (E2): the walk-in pub as the Späti (ochre front with the mural, the sticker
// door and lit windows from the press photo, the floor plan's furniture); roof and upper walls go into `up`, hidden
// while the hero is inside.
// District pieces (`buildWeddingWorld`): the plain brick Ringbahn with its two street arches and a girder span over the
// Panke (E1), station signs on the brick, park fences, the AEG brick walls, and the dressing of look A (E4 to E7):
// ruby awnings with gold fringe and carpets at shop fronts, emerald scaffold nets on some tall fronts, cloths and
// samovars on the Lange Tafel, the „kommt bald“ billboards on building sites. The lampion chains are props (`world.ts`).
//
// Cost: one new material, the sign atlas (`makeWeddingMats`: one draw call per chunk that shows a sign). Cloth is the
// existing linen batch tinted ruby, gold the enamel batch, nets the burlap batch: no other new batch. No new glow
// colour (lamp 0xffb060, string lights 0xffc890, fire 0xff8a3c, teal 0x5fd8c8). Lights: pooled spots only.
import { BoxGeometry, CylinderGeometry, Matrix4, PlaneGeometry, type BufferGeometry } from 'three';
import { WALL_KIND, inPoly, lineDist, streetDist, type Landmark, type LandmarkKind, type Lot, type MapDef, type Pt, type Wall } from '../data/map';
import type { Prop } from '../data/courtyard';
import { KNEIPE, KNEIPE_STOOLS, kneipeParts } from '../data/kneipe';
import { RING } from '../data/wedding';
import { Rng } from '../sim/math';
import { buildArches, buildStadtbahn } from './alex-world';
import { cached, scaffold, tarp, buildFence, type Ctx, type RGB } from './charlottenburg-world';
import { sub } from './landmarks';
import { buildWeddingSight } from './wedding-sights';
import { lightWeddingLandmarks } from './wedding-lights';
import { modelCar } from './props-urban';
import { lm, type ChunkBuilder } from './map-world';
import { canvas, toTexture } from './paint';
import type { Materials, LitMaterial } from './materials';
import { loadPaintedTexture } from './surface-textures';

/** Sights this file draws on the Wedding map (the U entrance kind is Mitte's, drawn here without Mitte's atlas). */
export const WEDDING_KINDS = new Set<LandmarkKind>(['ubahn', 'nazareth', 'neubau', 'amtsgericht', 'flakturm', 'beamtentor', 'maschinenhalle']);

/** Look A palette on the tinted batches. */
export const W = {
  ruby: [1.05, 0.16, 0.2], rubyDark: [0.62, 0.1, 0.14], gold: [1.95, 1.2, 0.3], emerald: [0.18, 0.62, 0.42], ochre: [1.12, 0.84, 0.48],
  brick: [0.92, 0.5, 0.4], brickDark: [0.62, 0.34, 0.3], sand: [0.98, 0.88, 0.7], concrete: [0.62, 0.62, 0.6], wood: [0.55, 0.36, 0.24],
  felt: [0.16, 0.5, 0.28], iron: [0.5, 0.52, 0.55], yellowBrick: [1.12, 0.92, 0.62],
} satisfies Record<string, RGB>;

// ---------------------------------------------------------------- sign atlas (the one new material)

/** Rows of the sign atlas (2 columns of 512 × 128 px; 1024 × 1536). */
const ROWS = 12;
/** Cells of the sign atlas. */
export const SIGN = {
  magendoktor: 0, tagnacht: 1, sWedding: 2, gesundbrunnen: 3, kommtBald: 4, eroeffnung: 5, palast: 6, u: 7, amtsgericht: 8, festsaal: 9, leo: 10, baklava: 11,
  kiosk: 12, teestube: 13, uLeo: 14,
  // Step 3 sights: the Beamtentor mosaic and its lettering along the arch, the Magendoktor's night watchman mural and
  // sticker door, the board on the lawn before the Alte Nazarethkirche.
  aegMono: 15, aeg1: 16, aeg2: 17, aeg3: 18, waechter: 19, stickers: 20, nazareth: 21,
} as const;
type Cell = { text: string; bg: string; fg: string; font: string; glow: number; paint?: (g: CanvasRenderingContext2D, x: number, y: number, emissive: boolean) => void };
const CELLS: Cell[] = [
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
  // The four rest stops (the Späti with its own sign on this map) and the station name at the U entrance.
  { text: 'Späti am Leo', bg: '#1a1e22', fg: '#f2d14b', font: 'bold 70px Georgia, serif', glow: 1 },
  { text: 'Baklava & Döner', bg: '#7a1420', fg: '#f6cf62', font: 'bold 64px Georgia, serif', glow: 1 },
  { text: 'Kiosk am Rosengarten', bg: '#1d4a3c', fg: '#f4f0e4', font: 'bold 56px Georgia, serif', glow: 1 },
  { text: 'Teestube im Werkhof', bg: '#3a1e12', fg: '#f6cf62', font: 'bold italic 58px Georgia, serif', glow: 1 },
  { text: 'U Leopoldplatz', bg: '#1c4f9c', fg: '#ffffff', font: 'bold 70px Arial, sans-serif', glow: 0.6 },
  // Beamtentor (photos 2026-11-23): the gold AEG monogram on a blue mosaic, the gold capitals on the red brick arch.
  { text: 'AEG', bg: '#26407c', fg: '#e8bf4a', font: 'bold italic 96px Georgia, serif', glow: 0.15, paint: mosaic },
  { text: 'ALLGEMEINE', bg: '#9a3a2c', fg: '#e8bf4a', font: 'bold 70px Georgia, serif', glow: 0.2 },
  { text: 'ELEKTRICITÄTS-', bg: '#9a3a2c', fg: '#e8bf4a', font: 'bold 62px Georgia, serif', glow: 0.2 },
  { text: 'GESELLSCHAFT', bg: '#9a3a2c', fg: '#e8bf4a', font: 'bold 66px Georgia, serif', glow: 0.2 },
  // Zum Magendoktor (press photo, map doc): the old Berlin night watchman with his lantern on the ochre wall; the door
  // under stickers and tags.
  { text: '', bg: '#c09a5c', fg: '#2a1a10', font: '', glow: 0, paint: watchman },
  { text: '', bg: '#3a2a20', fg: '#ffffff', font: '', glow: 0, paint: stickers },
  { text: 'Alte Nazarethkirche', bg: '#2f7c80', fg: '#f2f4ee', font: 'bold 56px Arial, sans-serif', glow: 0.2 },
];

/** Blue mosaic speckle under the monogram. */
function mosaic(g: CanvasRenderingContext2D, x: number, y: number, emissive: boolean): void {
  if (emissive) return;
  for (let k = 0; k < 420; k++) {
    g.fillStyle = ['#1e3566', '#2e4d8e', '#34589a', '#1a2c55'][k % 4]!;
    g.fillRect(x + ((k * 151) % 508), y + ((k * 67) % 124), 5, 5);
  }
}
/** The night watchman: a dark figure in coat and hat, a lit lantern on a pole (the lantern glows). */
function watchman(g: CanvasRenderingContext2D, x0: number, y: number, emissive: boolean): void {
  // Drawn 4× wide in x: the card is square on the wall (2.6 × 2.6 m), so the cell is squeezed back to proportion.
  g.save();
  g.translate(x0, 0);
  g.scale(4, 1);
  const x = 0, cx = 64;
  if (!emissive) {
    // A night-blue field with a framed edge and a row of roofs behind him (the mural, not the wall).
    g.fillStyle = '#1e2a52';
    g.fillRect(x + 6, y + 6, 116, 116);
    g.fillStyle = '#121826';
    for (let k = 0; k < 4; k++) g.fillRect(x + 8 + k * 28, y + 86 - (k % 2) * 12, 24, 36 + (k % 2) * 12);
    g.fillStyle = '#f2e6b0';
    g.beginPath();
    g.arc(x + 98, y + 24, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a3040';
    g.beginPath();
    g.moveTo(cx - 20, y + 122);
    g.lineTo(cx - 13, y + 46);
    g.lineTo(cx + 13, y + 46);
    g.lineTo(cx + 22, y + 122);
    g.fill();
    g.fillStyle = '#e0b48a';
    g.beginPath();
    g.arc(cx, y + 36, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0e0c12';
    g.fillRect(cx - 13, y + 22, 26, 6);
    g.fillRect(cx - 8, y + 10, 16, 13);
    g.fillStyle = '#7a6040';
    g.fillRect(cx + 24, y + 14, 3, 108);
  }
  g.fillStyle = emissive ? '#ffd890' : '#ffd060';
  g.fillRect(cx + 27, y + 30, 13, 18);
  g.restore();
}
/** Stickers and tags on the pub door. */
function stickers(g: CanvasRenderingContext2D, x: number, y: number, emissive: boolean): void {
  if (emissive) return;
  const cols = ['#e8e2d0', '#d8402c', '#f2c94b', '#3a8ad0', '#40a060', '#111111', '#e070b0'];
  for (let k = 0; k < 90; k++) {
    g.fillStyle = cols[(k * 5) % cols.length]!;
    g.fillRect(x + ((k * 113) % 490), y + ((k * 41) % 112), 14 + ((k * 7) % 26), 10 + ((k * 11) % 18));
  }
  g.strokeStyle = '#f4f0e8';
  g.lineWidth = 4;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    g.moveTo(x + 40 + k * 76, y + 100);
    g.bezierCurveTo(x + 70 + k * 76, y + 20, x + 90 + k * 76, y + 110, x + 110 + k * 76, y + 40);
    g.stroke();
  }
}

/** Rest stop names with their own sign on the Wedding map (the Späti sign elsewhere). */
const SPATI_SIGN: Readonly<Record<string, number>> = { 'Späti am Leo': SIGN.leo, 'Baklava & Döner': SIGN.baklava, 'Kiosk am Rosengarten': SIGN.kiosk, 'Teestube im Werkhof': SIGN.teestube };

/** Draws a Wedding rest stop sign from the atlas on frame `m` (4.4 × 0.95 m); false when the map or the name has none. */
export function weddingSpatiSign(up: ChunkBuilder, m: Matrix4, name: string | undefined): boolean {
  const cell = name === undefined ? undefined : SPATI_SIGN[name];
  if (cell === undefined || !up.mm.wedding) return false;
  // Both faces: most of the four stand with their door away from the camera.
  sign(up, m, 4.4, 0.95, cell, true);
  return true;
}

/**
 * T13: the boards painted locally with FLUX.2 klein from the code boards (lettering left out): worn enamel, wood
 * and mosaic, the night watchman mural and the sticker door, one 512 × 128 cell each as in `CELLS`. FLUX cannot
 * letter, so the code keeps the lettering on top; the emissive map stays the code's.
 */
const SIGN_ART_URL = new URL('../../assets/textures/wedding/signs.webp', import.meta.url).href;

/** The colour atlas: each code board, or with `art` the painted one, then its lettering (`letters` false: boards only). */
export function paintSignColour(g: CanvasRenderingContext2D, art?: CanvasImageSource, letters = true): void {
  CELLS.forEach((s, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    if (art) g.drawImage(art, x, y, 512, 128, x, y, 512, 128);
    else {
      g.fillStyle = s.bg;
      g.fillRect(x, y, 512, 128);
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 6;
      g.strokeRect(x + 6, y + 6, 500, 116);
      // A worn board: a few darker smudges.
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 0; k < 6; k++) g.fillRect(x + ((k * 97 + i * 31) % 480), y + ((k * 53 + i * 17) % 100), 30, 14);
      if (s.paint) s.paint(g, x, y, false);
    }
    if (letters && s.text) letter(g, s, x, y, s.fg);
  });
}

function letter(k: CanvasRenderingContext2D, s: Cell, x: number, y: number, col: string): void {
  k.fillStyle = col;
  k.font = s.font;
  k.textAlign = 'center';
  k.textBaseline = 'middle';
  k.fillText(s.text, x + 256, y + 68, 480);
}

/** Painted sign atlas: colour map and emissive map (letters glow, the board a little). */
function paintSigns(): { map: ReturnType<typeof toTexture>; emissiveMap: ReturnType<typeof toTexture> } {
  const H = ROWS * 128, [c, g] = canvas(1024, H), [e, ge] = canvas(1024, H);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, 1024, H);
  CELLS.forEach((s, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    const lum = Math.round(40 * s.glow);
    ge.fillStyle = `rgb(${lum},${lum},${lum})`;
    ge.fillRect(x, y, 512, 128);
    if (s.paint) s.paint(ge, x, y, true);
    const v = Math.round(255 * s.glow);
    if (s.text) letter(ge, s, x, y, `rgb(${v},${v},${v})`);
  });
  paintSignColour(g);
  const map = toTexture(c, false), emissiveMap = toTexture(e, false);
  // T13: the painted boards replace the code ones once loaded (one re-upload of the colour map). The painted
  // mural's lantern and moon sit elsewhere than the code's, so that cell's glow comes from its brightest pixels.
  const img = new Image();
  img.onload = () => {
    paintSignColour(g, img);
    map.needsUpdate = true;
    const x = (SIGN.waechter % 2) * 512, y = Math.floor(SIGN.waechter / 2) * 128, px = g.getImageData(x, y, 512, 128), d = px.data;
    for (let k = 0; k < d.length; k += 4) {
      const t = Math.min(1, Math.max(0, (Math.max(d[k]!, d[k + 1]!, d[k + 2]!) - 175) / 60));
      d[k] = d[k]! * t; d[k + 1] = d[k + 1]! * t; d[k + 2] = d[k + 2]! * t;
    }
    ge.putImageData(px, x, y);
    emissiveMap.needsUpdate = true;
  };
  img.src = SIGN_ART_URL;
  return { map, emissiveMap };
}

export interface WeddingMats { signs: LitMaterial; cloth: LitMaterial }

/** The sign atlas material and the T14 cloth atlas (Wedding only; the cloth is the second Wedding material). */
export function makeWeddingMats(materials: Materials): WeddingMats {
  const cloth = materials.surface({ color: 0xffffff, roughness: 0.9, vertexColors: true });
  if (typeof document === 'undefined') return { signs: materials.surface({ color: 0x884422, roughness: 0.6 }), cloth };
  // T14 (local FLUX.2 klein): ruby velvet with a gold fringe, a worn ruby carpet with a gold border, stained table
  // linen, emerald and gold brocade, one 512 px quarter each (`CLOTH_CELL`). Plain white until it has loaded.
  loadPaintedTexture(new URL('../../assets/textures/wedding/cloth-atlas.webp', import.meta.url).href, materials.profile.anisotropy, (t) => {
    cloth.map = t;
    cloth.needsUpdate = true;
  }, false);
  const t = paintSigns();
  return { signs: materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffe6b0, emissiveIntensity: 1.2, roughness: 0.6 }), cloth };
}

export type ClothKind = 'velvet' | 'carpet' | 'linen' | 'brocade' | 'runner';
/**
 * Atlas region of each cloth kind as [u0, v0, u1, v1]. The runner is one long carpet (painted 3:20, squeezed into
 * a 256 × 512 strip, so it gets its proportions back when stretched over the 3 × 20 m runner).
 */
const CLOTH_CELL: Readonly<Record<ClothKind, readonly [number, number, number, number]>> = {
  velvet: [0, 0.5, 0.5, 1], carpet: [0.5, 0.5, 1, 1], linen: [0, 0, 0.5, 0.5], brocade: [0.5, 0, 0.75, 0.5], runner: [0.75, 0, 1, 0.5],
};
/** Tints for the plain linen where no cloth atlas exists (tools, other builders). */
const CLOTH_FALLBACK: Readonly<Record<ClothKind, RGB>> = { velvet: [0.9, 0.16, 0.22], carpet: [0.62, 0.1, 0.16], linen: [1.45, 1.4, 1.35], brocade: [0.2, 0.65, 0.42], runner: [0.9, 0.16, 0.22] };

/** A box whose every face shows its kind's whole atlas quarter once (a carpet keeps its border, a cloth its fringe). */
function clothGeo(kind: ClothKind, sx: number, sy: number, sz: number): BufferGeometry {
  return cached(`wcloth-${kind}-${sx.toFixed(2)}-${sy.toFixed(2)}-${sz.toFixed(2)}`, () => {
    const g = new BoxGeometry(sx, sy, sz), uv = g.getAttribute('uv'), [u0, v0, u1, v1] = CLOTH_CELL[kind], e = 0.004;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + e + uv.getX(i) * (u1 - u0 - 2 * e), v0 + e + uv.getY(i) * (v1 - v0 - 2 * e));
    return g;
  });
}

/** One cloth piece (awning, curtain, carpet, tablecloth, parcel) in the Wedding cloth atlas; `shade` darkens it. */
export function cloth(b: ChunkBuilder, kind: ClothKind, m: Matrix4, sx: number, sy: number, sz: number, shade = 1): void {
  const mat = b.mm.wedding?.cloth;
  if (!mat) return b.box(b.mm.linen, m, sx, sy, sz, CLOTH_FALLBACK[kind]);
  b.geo(mat, clothGeo(kind, sx, sy, sz), m, [shade, shade, shade]);
}

/** A unit plane (facing +z) with the UVs of one atlas cell. */
function cellGeo(i: number): BufferGeometry {
  return cached(`wsign${i}`, () => {
    const g = new PlaneGeometry(1, 1), uv = g.getAttribute('uv'), u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) / ROWS, v0 = v1 - 1 / ROWS;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) / ROWS);
    return g;
  });
}

/** A sign card `w` × `h` on frame `m` (facing its +z); both faces when `back`. */
export function sign(b: ChunkBuilder, m: Matrix4, w: number, h: number, cell: number, back = false): void {
  const M = b.mm.wedding;
  if (!M) return;
  b.geo(M.signs, cellGeo(cell), m.clone().multiply(new Matrix4().makeScale(w, h, 1)));
  if (back) b.geo(M.signs, cellGeo(cell), m.clone().multiply(new Matrix4().makeRotationY(Math.PI)).multiply(new Matrix4().makeScale(w, h, 1)));
}

// ---------------------------------------------------------------- sights (the U entrance; the others in `wedding-sights.ts`)

const ctxOf = (b: ChunkBuilder, l: Landmark): Ctx => ({ b, M: b.mm, l, rng: new Rng(Math.round(l.x * 31 + l.z * 17) + 1888) });

export function buildWeddingLandmark(b: ChunkBuilder, l: Landmark): void {
  // Step 3: the six sights and the Neubau (`wedding-sights.ts`); the U entrance stays here.
  if (buildWeddingSight(b, l)) return;
  const c = ctxOf(b, l), M = c.M;
  switch (l.kind) {
    case 'ubahn': {
      // U Leopoldplatz: a stair down between granite kerbs and dark green railings, the well fading to black (the
      // ground cannot open: treads darken toward the bottom over a black floor), the U on a pole, the name plate over
      // the far end facing the camera, a lamp over the steps (no BVG livery).
      const F = lm(l), GREEN: RGB = [0.18, 0.42, 0.3], GRANITE: RGB = [0.62, 0.6, 0.58];
      b.solid.excludeOccluder(() => {
        // The well: pale steps at the top that sink into black (stair nosings as thin light lines), dark inner walls.
        b.box(M.dark, sub(F, 0, 0.01, -0.1), 2.7, 0.02, 5.8, [0.05, 0.05, 0.06]);
        for (let i = 0; i < 13; i++) {
          const k = Math.pow(1 - i / 13, 2.6);
          b.box(i < 5 ? M.concrete : M.dark, sub(F, 0, 0.025, 2.55 - (i + 0.5) * 0.4), 2.5, 0.02, 0.3, [0.85 * k + 0.03, 0.85 * k + 0.03, 0.88 * k + 0.04]);
          if (i < 8) b.box(M.concrete, sub(F, 0, 0.04, 2.55 - i * 0.4 - 0.02), 2.5, 0.015, 0.05, [1.1 * k + 0.08, 1.1 * k + 0.08, 1.1 * k + 0.1]);
        }
        for (const s of [-1, 1]) b.box(M.dark, sub(F, s * 1.28, 0.04, 0), 0.02, 0.06, 5.6, [0.02, 0.02, 0.02]);
        for (const s of [-1, 1]) {
          b.box(M.concrete, sub(F, s * 1.45, 0.2, 0), 0.32, 0.4, 5.9, GRANITE);
          b.box(M.dark, sub(F, s * 1.24, 0.03, 0), 0.08, 0.04, 5.6, [0.1, 0.1, 0.1]);
          for (const y of [0.55, 1.15]) b.box(M.enamel, sub(F, s * 1.45, y, 0), 0.05, 0.05, 5.7, GREEN);
          for (let z = -2.8; z <= 2.8; z += 0.28) b.box(M.enamel, sub(F, s * 1.45, 0.85, z), 0.03, 0.6, 0.03, GREEN);
        }
        b.box(M.concrete, sub(F, 0, 0.2, -2.95), 3.2, 0.4, 0.32, GRANITE);
        for (const s of [-1, 1]) b.box(M.enamel, sub(F, s * 1.5, 1.4, -2.95), 0.12, 2.8, 0.12, GREEN);
        b.box(M.enamel, sub(F, 0, 2.6, -2.95), 3.1, 0.7, 0.1, GREEN);
        sign(b, sub(F, 0, 2.6, -2.89), 2.8, 0.6, SIGN.uLeo);
        b.box(M.iron, sub(F, 1.8, 1.6, 2.7), 0.1, 3.2, 0.1, [1.3, 1.3, 1.35]);
        sign(b, sub(F, 1.8, 3.0, 2.76), 0.75, 0.75, SIGN.u, true);
      });
      return;
    }
  }
}

// ---------------------------------------------------------------- Zum Magendoktor (E2)

/** Plan frame of the pub (x east, z south, the door north) as a landmark frame. */
const K = (l: Landmark, px: number, y: number, pz: number, ry = 0): Matrix4 => { const m = lm(l, -px, y, -pz); return ry ? m.multiply(new Matrix4().makeRotationY(ry)) : m; };

/**
 * Zum Magendoktor: ochre plaster outside, wood inside; `b` gets the floor, everything up to knee height and the
 * furniture, `up` the upper walls (the south wall too), the lintel, the signs and the flat roof (hidden inside).
 */
export function buildKneipe(b: ChunkBuilder, up: ChunkBuilder, l: Landmark): void {
  const M = b.mm, { w, d, height: H, low, door } = KNEIPE, rng = new Rng(111);
  b.box(M.darkWood, K(l, 0, 0.04, 0), w - 0.6, 0.08, d - 0.6, [0.62, 0.42, 0.3]);
  const stool = cached('hocker', () => new CylinderGeometry(0.2, 0.16, 1, 8));
  for (const p of kneipeParts()) {
    // The part frame has the plan's axes (x east, z south as on the floor plan), whatever the pub's facing.
    const m = K(l, p.x, 0, p.z, Math.PI);
    switch (p.kind) {
      case 'wall':
        b.box(M.stucco, sub(m, 0, low / 2, 0), p.hx * 2, low, p.hz * 2, W.ochre);
        up.box(M.stucco, sub(m, 0, low + (H - low) / 2, 0), p.hx * 2, H - low, p.hz * 2, W.ochre);
        break;
      case 'bench':
        b.box(M.darkWood, sub(m, 0, 0.23, 0), p.hx * 2, 0.46, p.hz * 2, W.wood);
        cloth(b, 'velvet', sub(m, 0, 0.48, 0), p.hx * 2 - 0.05, 0.06, p.hz * 2 - 0.05, 0.85);
        break;
      case 'ecktisch':
        b.box(M.wood, sub(m, 0, 0.76, 0), p.hx * 2, 0.08, p.hz * 2, [0.85, 0.6, 0.4]);
        b.box(M.darkWood, sub(m, 0, 0.37, 0), 0.3, 0.74, 0.3, W.wood);
        b.geo(M.lampGlass, cached('glas', () => new CylinderGeometry(0.05, 0.04, 0.16, 6)), sub(m, 0.3, 0.88, 0.1), [1.7, 1.2, 0.4]);
        break;
      case 'wc':
        // The toilet: a closed cubicle against the west wall, its door to the room; the part above knee height hides inside.
        b.box(M.stucco, sub(m, 0, low / 2, 0), p.hx * 2, low, p.hz * 2, [0.7, 0.72, 0.7]);
        up.box(M.stucco, sub(m, 0, low + (2.5 - low) / 2, 0), p.hx * 2, 2.5 - low, p.hz * 2, [0.7, 0.72, 0.7]);
        b.box(M.darkWood, sub(m, p.hx + 0.02, 1.0, 0.2), 0.05, 2.0, 0.9, W.wood);
        break;
      case 'counter':
        b.box(M.darkWood, sub(m, 0, 0.55, 0), p.hx * 2, 1.1, p.hz * 2, W.wood);
        b.box(M.wood, sub(m, 0, 1.13, 0), p.hx * 2 + 0.1, 0.07, p.hz * 2 + 0.1, [0.95, 0.72, 0.5]);
        if (p.hz > 1) b.geo(M.enamel, cached('zapf', () => new CylinderGeometry(0.06, 0.08, 0.55, 8)), sub(m, 0, 1.45, -1.4), W.gold);
        break;
      case 'shelf':
        b.box(M.darkWood, sub(m, 0, 1.2, 0), p.hx * 2, 2.4, p.hz * 2, W.wood);
        for (let z = -p.hz + 0.3; z < p.hz - 0.2; z += 0.22) for (const y of [1.05, 1.55, 2.05]) if (rng.next() > 0.25) b.box(M.lampGlass, sub(m, -p.hx - 0.02, y, z), 0.08, 0.28, 0.08, rng.pick([[0.6, 1.2, 0.5], [1.6, 0.9, 0.35], [0.9, 0.7, 0.4]] as RGB[]));
        break;
      case 'billard':
        b.box(M.darkWood, sub(m, 0, 0.4, 0), p.hx * 2, 0.8, p.hz * 2, W.wood);
        b.box(M.linen, sub(m, 0, 0.82, 0), p.hx * 2 - 0.2, 0.04, p.hz * 2 - 0.2, W.felt);
        b.box(M.lampGlass, sub(m, 0, 2.3, 0), 1.6, 0.12, 0.4, [1.6, 1.4, 0.8]);
        break;
      case 'jukebox':
        b.box(M.enamel, sub(m, 0, 0.8, 0), p.hx * 2, 1.6, p.hz * 2, [0.9, 0.25, 0.45]);
        b.box(M.lampGlass, sub(m, p.hx + 0.01, 1.0, 0), 0.03, 0.7, p.hz * 1.6, [1.9, 0.9, 1.2]);
        break;
      case 'automat':
        b.box(M.enamel, sub(m, 0, 0.85, 0), p.hx * 2, 1.7, p.hz * 2, [0.35, 0.36, 0.42]);
        b.box(M.lampGlass, sub(m, p.hx + 0.01, 1.15, 0), 0.03, 0.45, p.hz * 1.5, [1.5, 1.6, 0.5]);
        break;
      case 'table':
        b.geo(M.wood, cached('rtisch', () => new CylinderGeometry(0.85, 0.85, 0.06, 14)), sub(m, 0, 0.76, 0), [0.85, 0.6, 0.4]);
        b.geo(M.darkWood, cached('rfuss', () => new CylinderGeometry(0.07, 0.14, 0.74, 6)), sub(m, 0, 0.37, 0), W.wood);
        b.geo(M.lampGlass, cached('glas', () => new CylinderGeometry(0.05, 0.04, 0.16, 6)), sub(m, 0.2, 0.87, 0.1), [1.7, 1.2, 0.4]);
        break;
    }
  }
  // Stools (render only): high ones at the bar, low ones at the tables.
  for (const [x, z] of KNEIPE_STOOLS) { const h = x > 4 ? 0.8 : 0.48; b.geo(M.wood, stool, K(l, x, h / 2, z).multiply(new Matrix4().makeScale(1, h, 1)), W.wood); }
  // Wood panelling inside at knee height, a dart board on the north wall.
  b.box(M.darkWood, K(l, 0, 0.55, d / 2 - 0.52), w - 1.2, 1.0, 0.04, W.wood);
  b.box(M.enamel, K(l, -3.2, 1.6, -d / 2 + 0.52), 0.5, 0.5, 0.04, [0.9, 0.2, 0.2]);
  // Light: inside and at the door from the light plan (`wedding-lights.ts`).
  // Upper part: lintel over the door, the signs, a balcony rail, the flat roof with a parapet.
  up.box(M.stucco, K(l, 0, (2.7 + H) / 2, -d / 2 + KNEIPE.wall / 2), door, H - 2.7, KNEIPE.wall, W.ochre);
  // The front with the door faces the camera (Johannes 2026-11-21): red sign over the door, the box sign beside it; the
  // back wall carries the name on its roof edge toward the Nettelbeckplatz.
  sign(up, K(l, 0, 3.15, -d / 2 - 0.05), 7.5, 1.0, SIGN.magendoktor);
  sign(up, K(l, 6.6, 2.75, -d / 2 - 0.05), 2.2, 0.55, SIGN.tagnacht);
  sign(up, K(l, 0, H + 0.75, d / 2 + 0.1, Math.PI), 9, 1.2, SIGN.magendoktor);
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
  // Step 3, the front from the press photo (map doc): a dark plinth with tags, warm windows with half curtains on both
  // sides of the door, the door leaf folded back under stickers, the night watchman mural west of the door.
  const fz = -d / 2 - 0.03;
  // The plinth stops at the doorway (Codex on PR 87: a full-width strip read as a wall the hero walks through).
  const pw = (w - door) / 2;
  for (const sx of [-1, 1]) b.box(M.stucco, K(l, sx * (door + pw) / 2, 0.3, fz), pw, 0.6, 0.04, [0.3, 0.28, 0.27]);
  for (const [x, gw] of [[-6.2, 2.4], [-2.3, 1.2], [4.8, 2.0], [8.4, 1.4]] as const) b.geo(M.graffiti, cached(`kg${gw}`, () => new PlaneGeometry(gw, 0.5)), K(l, x, 0.32, fz - 0.03), [1, 1, 1]);
  for (const x of [-3.5, 3.5]) {
    up.box(M.darkWood, K(l, x, 1.85, fz), 1.8, 1.4, 0.06, W.wood);
    up.box(M.lampGlass, K(l, x, 1.85, fz - 0.04), 1.6, 1.2, 0.02, [0.85, 0.5, 0.22]);
    cloth(up, 'velvet', K(l, x, 2.3, fz - 0.07), 1.6, 0.36, 0.02, 0.85);
    up.box(M.darkWood, K(l, x, 1.85, fz - 0.08), 0.06, 1.2, 0.03, W.wood);
  }
  b.box(M.darkWood, K(l, -(door / 2 + 0.55), 1.05, fz - 0.03), 1.0, 2.1, 0.05, [0.4, 0.28, 0.2]);
  sign(b, K(l, -(door / 2 + 0.55), 1.15, fz - 0.07), 0.9, 1.7, SIGN.stickers);
  sign(b, K(l, -7.3, 1.95, fz - 0.02), 2.6, 2.6, SIGN.waechter);
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
    cloth(b, 'velvet', sub(m, 0, 2.95, 0.75, 0, 0.32), w, 0.05, 1.6);
    b.box(M.enamel, sub(m, 0, 2.62, 1.52), w, 0.2, 0.03, W.gold);
    if (carpet) {
      cloth(b, 'carpet', sub(m, 0, 0.02, 2.2), Math.min(2.2, w * 0.6), 0.02, 2.6, 0.9);
      for (const s of [-1, 1]) b.box(M.enamel, sub(m, s * Math.min(1.05, w * 0.3 - 0.05), 0.03, 2.2), 0.08, 0.02, 2.6, W.gold);
    }
  });
}

/**
 * M18 hook from `buildMapWorld` (only on Wedding): the Ringbahn, fences and walls, station signs, the front dressing
 * of the street lots (awnings, carpets, nets), the Lange Tafel's cloths and samovars, billboards at building sites.
 */
export function buildWeddingWorld(m: MapDef, lots: readonly Lot[], props: readonly Prop[], chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number): void {
  // Step 3: light for the sights (`wedding-lights.ts`).
  lightWeddingLandmarks(m, chunkOf, ground);
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
      // P3: the model cars (Trabi, Wartburg) have their own bonnet, nose and roof; code cars the values here.
      const c = modelCar(p), bon = c?.bonnet ?? { y: 1.02, z: 1.1, len: 1.9 };
      for (const s of [-0.35, 0.35]) b.box(M.linen, sub(fm, s, bon.y, bon.z, 0, 0.12), 0.12, 0.03, bon.len, [1.45, 1.4, 1.35]);
      b.box(M.linen, sub(fm, 0, 0.95, c?.nose ?? 2.05), 0.5, 0.22, 0.08, [1.45, 1.4, 1.35]);
      b.box(M.linen, sub(fm, 0, c ? c.roof + 0.02 : 1.55, -0.2), 1.3, 0.03, 0.15, W.ruby);
    });
  });
  // The Lange Tafel (E7): ruby cloths with a gold runner on the beer tables, samovars and tea glasses.
  const tafel = m.encounters.find((e) => e.id === 'langetafel');
  for (const p of m.fixedProps) {
    if (p.kind !== 'beerTable' || !tafel || Math.hypot(p.x - tafel.x, p.z - tafel.z) > tafel.r + 4) continue;
    const b = chunkOf(p.x, p.z), M = b.mm, fm = new Matrix4().makeRotationY(p.rot).setPosition(p.x, ground(p.x, p.z), p.z);
    cloth(b, 'linen', sub(fm, 0, 0.8, 0), 2.3, 0.03, 0.9);
    b.box(M.enamel, sub(fm, 0, 0.82, 0), 2.3, 0.02, 0.25, W.gold);
    b.geo(M.enamel, cached('samowar', () => new CylinderGeometry(0.14, 0.18, 0.5, 8)), sub(fm, -0.6, 1.07, 0), W.gold);
    b.geo(M.lampGlass, cached('glas', () => new CylinderGeometry(0.05, 0.04, 0.16, 6)), sub(fm, 0.5, 0.9, 0.15), [1.7, 1.2, 0.4]);
  }
}

