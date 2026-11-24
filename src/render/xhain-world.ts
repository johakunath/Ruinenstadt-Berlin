// M15 Xhain (1981) in code: the Wall (UL 12.41 elements, East Side Gallery murals), the Stadtbahn
// track field with the Warschauer Brücke deck, the north-bank death strip, the green U1 Hochbahn, and the Xhain landmarks (Oberbaumbrücke, S Warschauer Straße,
// Ostbahnhof, U1 stations with Schlesisches Tor, St. Thomas, Bethanien, Rauch-Haus, NKZ, the BT-11
// watchtower, the Görlitzer Bahnhof ruin and the old freight yard in the Görli), plus Kreuzberg dressing
// on the generated lots (graffiti, squat banners). Colliders live in `src/data/map.ts`; this only draws.
// Painted maps from T6 (`assets/textures/xhain/`, code placeholders as the fallback); 2D reference `js/geo.js` (oberbaum, ostbahnhof, viaduct,
// esg) for colors and silhouettes; Köpenick helpers reused: `walls`, `gableRoof`, `gableEnds`, `steppedGable`,
// `buildAltbauLot` (Rauch-Haus, NKZ), the rubble and tank-trap props, the M11c graffiti atlas.
//
// Cost: everything is merged per material into the chunk batches of `map-world.ts`. New materials, each
// one draw call in the chunks that use it: green riveted steel, yellow brick, the sign atlas, the mural
// atlas, the banner atlas (alpha-tested card), a cold glow and a searchlight beam (FX layer). No lights:
// the searchlight is a halo, a beam card and a ground decal; signs and lamp heads are emissive only.
// About 21k triangles for the 620 m of Wall, 15k for the Hochbahn, 1-4k per landmark. Measured on Leistung,
// default camera, cloud (2026-11-18): +32 calls / +66k triangles on the Skalitzer Straße, +58 / +30k at the
// Warschauer Brücke, +44 / +32k at the East Side Gallery (on top of the generated map).
import {
  CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Matrix4, PlaneGeometry, Quaternion,
  RepeatWrapping, RingGeometry, SRGBColorSpace, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector3,
  type BufferGeometry, type Material, type MeshBasicMaterial,
} from 'three';
import { areaAt, hochbahnPillars, inPoly, lineDist, onBridge, type Bridge, type Landmark, type LandmarkKind, type Lot, type MapDef, type Pt, type RailYard, type Terrace, type Viaduct, type Wall } from '../data/map';
import { Rng } from '../sim/math';
import { rectPoly, type CutPart } from '../data/cut';
import { Materials, type LitMaterial } from './materials';
import { paintGlow, paintMetal, type PaintOptions } from './paint';
import { swapPaintedMap } from './surface-textures';
import { buildProp, FLOOR_H, GROUND_H, PARAPET, Run } from './world';
import { blockFacades, buildAltbauLot, gableEnds, gableRoof, lm, lp, steppedGable, walls, type ChunkBuilder, type MapMats } from './map-world';

type RGB = readonly [number, number, number];
const k3 = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export const XHAIN_KINDS = new Set<LandmarkKind>(['warschauer', 'ostbahnhof', 'oberbaum', 'wachturm', 'thomaskirche', 'bethanien', 'rauchhaus', 'nkz', 'u1station', 'goerlitzer']);
/** Kreuzberg areas: graffiti and squat banners (East Berlin stays clean, 1981). */
const WEST_AREAS = new Set(['so36', 'mariannenplatz', 'kotti', 'goerli', 'wrangelkiez']);

// ---------------------------------------------------------------- materials and painted atlases

interface XMats {
  /** U1 green riveted steel (2D `#3f6a4a`), tinted per vertex for copper roofs. */
  steel: LitMaterial;
  /** Yellow Berlin brick (Thomaskirche, Bethanien, Görlitzer Bahnhof). */
  yellow: LitMaterial;
  /** Name signs and the S / U emblems (`SIGN` rows). */
  signs: LitMaterial;
  /** East Side Gallery panels, 4 × 2. */
  murals: LitMaterial;
  /** Squat banners, 4 rows (alpha-tested cloth). */
  banners: LitMaterial;
  /** Track bed tile (ballast, sleepers), one tile per track across the field. */
  trackBed: LitMaterial;
  /** Raked sand of the death strip. */
  sand: LitMaterial;
  cold: MeshBasicMaterial;
  beam: MeshBasicMaterial;
}

/** Rows of the sign atlas (1024 × 1024, 8 rows of 128 px). Row 5 holds the emblems. */
const SIGN = { ostbahnhof: 0, 'Kottbusser Tor': 1, 'Görlitzer Bahnhof': 2, 'Schlesisches Tor': 3, warschauer: 4, emblems: 5, west: 6, nkz: 7 } as const;
const BANNER = { besetzt: 0, bleiben: 1, rauchhaus: 2, abriss: 3 } as const;
/** 2D `esg()` mural colors. */
const ESG = ['#d4537e', '#7d9bff', '#8fd16a', '#f2d14b', '#e8642e', '#3a8aa8', '#a050c0'];

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false, anisotropy = 4): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas not available');
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/** Yellow Berlin brick: 64 × 21 px bricks (25 × 8 cm at the 0.5 uv box scale), soot runs, mottled. */
function paintYellowBrick(anisotropy: number): CanvasTexture {
  return canvasTex(512, 512, (g) => {
    const rng = new Rng(1874);
    g.fillStyle = '#7d6e58';
    g.fillRect(0, 0, 512, 512);
    const tones = ['#dcae6c', '#d2a160', '#e2b878', '#c8925a', '#d8a868', '#b8844e'];
    for (let r = 0; r < 24; r++) {
      const y = r * 21.33, off = r % 2 ? 32 : 0;
      for (let x = -off; x < 512; x += 64) {
        g.fillStyle = rng.pick(tones);
        g.fillRect(x + 1.5, y + 1.5, 61, 18.3);
        if (rng.next() < 0.18) { g.fillStyle = 'rgba(60,40,25,0.25)'; g.fillRect(x + 1.5, y + 1.5, 61, 18.3); }
      }
    }
    // Soot and rain runs from the ledges, a few dark patches.
    for (let i = 0; i < 40; i++) {
      const x = rng.range(0, 512), grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, 'rgba(40,30,22,0.28)');
      grd.addColorStop(1, 'rgba(40,30,22,0)');
      g.fillStyle = grd;
      g.fillRect(x, 0, rng.range(3, 14), rng.range(80, 400));
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `rgba(50,45,35,${rng.range(0.05, 0.16)})`;
      g.beginPath();
      g.arc(rng.range(0, 512), rng.range(0, 512), rng.range(30, 90), 0, Math.PI * 2);
      g.fill();
    }
  }, true, anisotropy);
}

function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font = 'bold %px "Helvetica Neue", Arial, sans-serif'): void {
  let s = size;
  g.font = font.replace('%', String(s));
  while (g.measureText(text).width > maxW && s > 12) g.font = font.replace('%', String(--s));
  g.fillText(text, x, y);
}

/** Sign atlas: `glow` paints the emissive version (letters bright, panels dim). */
function signCanvas(g: CanvasRenderingContext2D, glow: boolean): void {
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 1024);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const row = (r: number, text: string, bg: string, fg: string, dim: string, font?: string): void => {
    const y = r * 128;
    g.fillStyle = glow ? dim : bg;
    g.fillRect(0, y, 1024, 128);
    g.strokeStyle = glow ? '#000' : 'rgba(255,255,255,0.75)';
    g.lineWidth = 6;
    g.strokeRect(8, y + 8, 1008, 112);
    g.fillStyle = glow ? '#fff' : fg;
    fitText(g, text, 512, y + 68, 960, 84, font);
  };
  // GDR: steel grey block with white letters; BVG West: white on blue; S-Bahn: white on green.
  row(SIGN.ostbahnhof, 'OSTBAHNHOF', '#3a4048', '#f2efe6', '#202020');
  row(SIGN['Kottbusser Tor'], 'Kottbusser Tor', '#1d4a8a', '#ffffff', '#101830');
  row(SIGN['Görlitzer Bahnhof'], 'Görlitzer Bahnhof', '#1d4a8a', '#ffffff', '#101830');
  row(SIGN['Schlesisches Tor'], 'Schlesisches Tor', '#1d4a8a', '#ffffff', '#101830');
  row(SIGN.warschauer, 'Warschauer Straße', '#2a6a3a', '#ffffff', '#0c2412');
  row(SIGN.west, 'ACHTUNG! SIE VERLASSEN WEST-BERLIN', '#e8e2d2', '#1a1a1a', '#151515');
  row(SIGN.nkz, 'ZENTRUM KREUZBERG', '#26201c', '#f0b040', '#302008');
  // Emblems: S (green circle, white S) and U (blue square, white U), 128 px cells.
  const y = SIGN.emblems * 128;
  g.fillStyle = glow ? '#000' : '#1a1a1a';
  g.fillRect(0, y, 1024, 128);
  g.fillStyle = glow ? '#3a9a4a' : '#2a8a3a';
  g.beginPath();
  g.arc(64, y + 64, 60, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = glow ? '#3a5aa0' : '#1d4a8a';
  g.fillRect(132, y + 4, 120, 120);
  g.fillStyle = '#fff';
  g.font = 'bold 96px "Helvetica Neue", Arial, sans-serif';
  g.fillText('S', 64, y + 70);
  g.fillText('U', 192, y + 70);
}

/** One East Side Gallery panel: bright abstract motif (no real artwork), then weathering and tags. */
function muralPanel(g: CanvasRenderingContext2D, x0: number, y0: number, k: number, rng: Rng): void {
  const S = 256, col = (): string => rng.pick(ESG);
  g.save();
  g.beginPath();
  g.rect(x0, y0, S, S);
  g.clip();
  g.fillStyle = col();
  g.fillRect(x0, y0, S, S);
  g.lineCap = 'round';
  switch (k) {
    case 0: // Rising sun: rings over a horizon.
      for (let r = 200; r > 20; r -= 28) { g.fillStyle = col(); g.beginPath(); g.arc(x0 + 128, y0 + 190, r, Math.PI, 0); g.fill(); }
      g.fillStyle = col(); g.fillRect(x0, y0 + 190, S, 66);
      break;
    case 1: // Diagonal stripes.
      g.lineWidth = 26;
      for (let i = -S; i < S * 2; i += 52) { g.strokeStyle = col(); g.beginPath(); g.moveTo(x0 + i, y0); g.lineTo(x0 + i - S, y0 + S); g.stroke(); }
      break;
    case 2: // Zigzag mountains.
      for (let l = 0; l < 4; l++) {
        g.fillStyle = col(); g.beginPath(); g.moveTo(x0, y0 + S);
        for (let x = 0; x <= S; x += 32) g.lineTo(x0 + x, y0 + 90 + l * 40 + (x % 64 ? -50 : 10));
        g.lineTo(x0 + S, y0 + S); g.fill();
      }
      break;
    case 3: // Waves.
      g.lineWidth = 22;
      for (let l = 0; l < 7; l++) {
        g.strokeStyle = col(); g.beginPath();
        for (let x = 0; x <= S; x += 8) g.lineTo(x0 + x, y0 + 20 + l * 36 + Math.sin(x / 26 + l) * 14);
        g.stroke();
      }
      break;
    case 4: // Round faces in a row (two eyes, a mouth): crowd behind the Wall.
      for (let i = 0; i < 6; i++) {
        const cx = x0 + 40 + (i % 3) * 88, cy = y0 + 70 + Math.floor(i / 3) * 110;
        g.fillStyle = col(); g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#16110f'; g.beginPath(); g.arc(cx - 13, cy - 8, 6, 0, 7); g.arc(cx + 13, cy - 8, 6, 0, 7); g.fill();
        g.strokeStyle = '#16110f'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy + 4, 18, 0.2, Math.PI - 0.2); g.stroke();
      }
      break;
    case 5: // Skewed checkerboard.
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        if ((i + j) % 2) continue;
        g.fillStyle = (i * 3 + j) % 3 ? '#16110f' : col();
        g.beginPath(); g.moveTo(x0 + i * 32 + j * 8, y0 + j * 32); g.lineTo(x0 + i * 32 + 32 + j * 8, y0 + j * 32);
        g.lineTo(x0 + i * 32 + 40 + j * 8, y0 + j * 32 + 32); g.lineTo(x0 + i * 32 + 8 + j * 8, y0 + j * 32 + 32); g.fill();
      }
      break;
    case 6: // Rays from a corner.
      for (let a = 0; a < 12; a++) {
        g.fillStyle = a % 2 ? col() : '#f4efe0'; g.beginPath(); g.moveTo(x0, y0 + S);
        g.lineTo(x0 + Math.cos(-a * 0.14) * 400, y0 + S + Math.sin(-a * 0.14) * 400);
        g.lineTo(x0 + Math.cos(-(a + 1) * 0.14) * 400, y0 + S + Math.sin(-(a + 1) * 0.14) * 400); g.fill();
      }
      break;
    default: // Blocky letter shapes, a dove-like white wing.
      for (let i = 0; i < 9; i++) { g.fillStyle = col(); g.fillRect(x0 + rng.range(0, 200), y0 + rng.range(0, 200), rng.range(30, 90), rng.range(30, 90)); }
      g.fillStyle = '#f4efe0'; g.beginPath(); g.moveTo(x0 + 40, y0 + 150); g.quadraticCurveTo(x0 + 120, y0 + 40, x0 + 220, y0 + 90);
      g.quadraticCurveTo(x0 + 140, y0 + 110, x0 + 40, y0 + 150); g.fill();
  }
  // Weathering: chipped paint shows the concrete, scratches, dirt rising from the ground, faded top.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(200,196,186,${rng.range(0.4, 0.9)})`;
    g.beginPath();
    const cx = x0 + rng.range(0, S), cy = y0 + rng.range(0, S), r = rng.range(2, 9);
    g.moveTo(cx - r, cy); g.lineTo(cx, cy - r * 0.7); g.lineTo(cx + r, cy + r * 0.2); g.lineTo(cx - r * 0.3, cy + r); g.fill();
  }
  g.strokeStyle = 'rgba(30,26,22,0.35)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) { const x = x0 + rng.range(0, S), y = y0 + rng.range(0, S); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rng.range(-30, 30), y + rng.range(-12, 12)); g.stroke(); }
  const dirt = g.createLinearGradient(0, y0 + S * 0.6, 0, y0 + S);
  dirt.addColorStop(0, 'rgba(60,50,40,0)');
  dirt.addColorStop(1, 'rgba(60,50,40,0.55)');
  g.fillStyle = dirt;
  g.fillRect(x0, y0, S, S);
  g.fillStyle = 'rgba(230,226,215,0.12)';
  g.fillRect(x0, y0, S, S * 0.3);
  // A tag across the panel.
  g.strokeStyle = rng.pick(['#16110f', '#e8e2d2', '#d84a3a']);
  g.lineWidth = 4;
  g.beginPath();
  let tx = x0 + rng.range(10, 90);
  const ty = y0 + rng.range(150, 220);
  g.moveTo(tx, ty);
  for (let i = 0; i < 10; i++) { tx += rng.range(8, 16); g.lineTo(tx, ty + rng.range(-16, 16)); }
  g.stroke();
  g.restore();
}

/** Squat banners on bed sheets, torn edges (alpha), text in house paint. */
function bannerCanvas(g: CanvasRenderingContext2D): void {
  const rng = new Rng(1981);
  const rows: Array<[string, string, string]> = [
    ['BESETZT', '#ebe6da', '#b8261c'],
    ['WIR BLEIBEN ALLE', '#e4e0d4', '#16110f'],
    ['RAUCH-HAUS', '#1c1a18', '#f0ece2'],
    ['KEIN ABRISS', '#d8c890', '#16110f'],
  ];
  g.clearRect(0, 0, 1024, 512);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  rows.forEach(([text, bg, fg], r) => {
    const y = r * 128;
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(6, y + 10);
    for (let x = 6; x <= 1018; x += 24) g.lineTo(x, y + 8 + rng.range(0, 8));
    for (let x = 1018; x >= 6; x -= 24) g.lineTo(x, y + 112 + rng.range(0, 12) - (rng.next() < 0.1 ? 18 : 0));
    g.fill();
    // Folds and grime.
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(rng.range(0, 1000), y + 10, rng.range(10, 30), 100); }
    g.fillStyle = fg;
    fitText(g, text, 512 + rng.range(-20, 20), y + 66, 900, 82, 'bold %px Impact, "Arial Black", sans-serif');
    g.fillStyle = 'rgba(80,60,40,0.18)';
    g.fillRect(0, y + 90, 1024, 30);
  });
}

function xhainMats(materials: Materials): XMats {
  const o: PaintOptions = { flatten: materials.look.flatten, normalMaps: materials.profile.normalMaps, anisotropy: materials.profile.anisotropy };
  const signMap = canvasTex(1024, 1024, (g) => signCanvas(g, false));
  const signGlow = canvasTex(1024, 1024, (g) => signCanvas(g, true));
  const murals = canvasTex(1024, 512, (g) => {
    const rng = new Rng(1990);
    for (let k = 0; k < 8; k++) muralPanel(g, (k % 4) * 256, Math.floor(k / 4) * 256, k, rng);
  }, false, o.anisotropy);
  const beamTex = canvasTex(64, 256, (g) => {
    for (let y = 0; y < 256; y++) {
      const fade = Math.pow(1 - y / 256, 1.4);
      const grd = g.createLinearGradient(0, 0, 64, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, `rgba(255,255,255,${0.85 * fade})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, y, 64, 1);
    }
  });
  const beam = Materials.glow(beamTex, 0xd8ecff, 0.3);
  beam.side = DoubleSide;
  const X: XMats = {
    steel: materials.surface({ map: paintMetal('#3f6a4a', o, 83, 0.7).map, roughness: 0.6, metalness: 0.35, vertexColors: true }),
    yellow: materials.surface({ map: paintYellowBrick(o.anisotropy), roughness: 0.9, vertexColors: true }),
    signs: materials.surface({ map: signMap, emissiveMap: signGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.55 }),
    murals: materials.surface({ map: murals, roughness: 0.85, vertexColors: true }),
    banners: materials.surface({ map: canvasTex(1024, 512, bannerCanvas), alphaTest: 0.5, doubleSided: true, roughness: 0.95, vertexColors: true }),
    trackBed: materials.surface({ map: canvasTex(256, 256, paintTrackBed, true, o.anisotropy), roughness: 0.95, vertexColors: true }),
    sand: materials.surface({ map: canvasTex(256, 256, paintSand, true, o.anisotropy), roughness: 1, vertexColors: true }),
    cold: Materials.glow(paintGlow('rgba(225,240,255,0.95)', 'rgba(200,225,255,0)'), 0xd8ecff, 0.35),
    beam,
  };
  // T6 (local FLUX.2 klein, `docs/local-ai-assets.md` W1): painted maps replace the code placeholders once
  // loaded; same materials, so no draw call change. The viaduct brick and Wall concrete swap in `makeMats`.
  swapPaintedMap([X.steel], new URL('../../assets/textures/xhain/steel.webp', import.meta.url).href, o.anisotropy);
  swapPaintedMap([X.yellow], new URL('../../assets/textures/xhain/yellow-brick.webp', import.meta.url).href, o.anisotropy);
  swapPaintedMap([X.sand], new URL('../../assets/textures/xhain/sand.webp', import.meta.url).href, o.anisotropy);
  // East Side Gallery murals: eight painted panels in the same 4 × 2 atlas cells as `muralPanel` (not repeated).
  swapPaintedMap([X.murals], new URL('../../assets/textures/xhain/murals.webp', import.meta.url).href, o.anisotropy, false);
  // One track per tile across (rails at the same u as `paintTrackBed`), five sleepers along.
  swapPaintedMap([X.trackBed], new URL('../../assets/textures/xhain/track-bed.webp', import.meta.url).href, o.anisotropy);
  return X;
}

// ---------------------------------------------------------------- shared helpers

interface Ctx {
  mm: MapMats;
  X: XMats;
  m: MapDef;
  chunkOf: (x: number, z: number) => ChunkBuilder;
  ground: (x: number, z: number) => number;
  /** Ground below bridge decks (the track field under the Warschauer Brücke). */
  low: (x: number, z: number) => number;
}

const geoCache = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

/** A landmark-style frame for `lm`/`lp` (only x, z, rot are read). */
const frame = (x: number, z: number, rot: number): Landmark => ({ kind: 'oberbaum', x, z, rot, hx: 0, hz: 0, clear: 0 });

/** Local part of a world matrix. */
function sub(m: Matrix4, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): Matrix4 {
  const l = new Matrix4().makeRotationY(ry);
  if (rx) l.multiply(new Matrix4().makeRotationX(rx));
  if (rz) l.multiply(new Matrix4().makeRotationZ(rz));
  return m.clone().multiply(l.setPosition(x, y, z));
}

const scaled = (m: Matrix4, sx: number, sy: number, sz = 1): Matrix4 => m.clone().multiply(new Matrix4().makeScale(sx, sy, sz));

/** Filled round arch, `w` wide and `h` tall overall, base at y 0, facing +z. */
function archGeo(w: number, h: number): BufferGeometry {
  return cached(`arch-${w.toFixed(2)}-${h.toFixed(2)}`, () => {
    const r = w / 2, s = new Shape();
    s.moveTo(-r, 0);
    s.lineTo(r, 0);
    s.lineTo(r, Math.max(0.01, h - r));
    s.absarc(0, Math.max(0.01, h - r), r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    return new ShapeGeometry(s, 8);
  });
}

/** Arch ring (voussoirs) of inner radius r, thickness t, centred on the spring line, facing +z. */
function ringGeo(r: number, t: number): BufferGeometry {
  return cached(`ring-${r.toFixed(2)}-${t.toFixed(2)}`, () => new RingGeometry(r, r + t, 10, 1, 0, Math.PI));
}

/** An arched opening on a face: dark (or glazed) fill and a lighter ring. `m` sits at the opening's base centre, facing out. */
function archOpening(b: ChunkBuilder, m: Matrix4, w: number, h: number, fill: Material, fillColor: RGB, ring: Material | null, ringColor: RGB = [1, 1, 1]): void {
  const glassBroken = fill === b.mm.glass && b.wearWindow(sub(m, 0, (h - w / 2) / 2, 0), w, h - w / 2);
  if (!glassBroken) b.geo(fill, archGeo(w, h), m, fillColor);
  else b.geo(b.mm.dark, archGeo(w, h), m);
  if (ring) b.geo(ring, ringGeo(w / 2, Math.min(0.45, w * 0.18)), sub(m, 0, h - w / 2, 0.02), ringColor);
}

/** A plane sign from the atlas: `row` of the sign atlas, u range [u0, u1]. */
function signGeo(row: number, u0 = 0, u1 = 1): BufferGeometry {
  return cached(`sign-${row}-${u0}-${u1}`, () => {
    const g = new PlaneGeometry(1, 1);
    const uv = g.getAttribute('uv');
    const v0 = 1 - (row + 1) / 8;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) / 8);
    return g;
  });
}

function sign(b: ChunkBuilder, X: XMats, row: number, m: Matrix4, w: number, h: number): void {
  b.geo(X.signs, signGeo(row), scaled(m, w, h));
}

/** S (green circle) or U (blue square) emblem, `size` meters. */
function emblem(b: ChunkBuilder, X: XMats, kind: 'S' | 'U', m: Matrix4, size: number): void {
  b.geo(X.signs, signGeo(SIGN.emblems, kind === 'S' ? 0 : 0.125, kind === 'S' ? 0.125 : 0.25), scaled(m, size, size));
}

function bannerGeo(row: number): BufferGeometry {
  return cached(`banner-${row}`, () => {
    const g = new PlaneGeometry(1, 1);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - (row + 1) / 4 + uv.getY(i) / 4);
    return g;
  });
}

/** A banner hanging flat on a facade: `m` at its centre, facing out; a slight sag and tilt. */
function banner(b: ChunkBuilder, X: XMats, row: number, m: Matrix4, w: number, rng: Rng): void {
  const g = rng.range(0.8, 1);
  b.cards.of(X.banners).add(bannerGeo(row), scaled(sub(m, 0, 0, 0.06, 0, rng.range(-0.08, 0.02), rng.range(-0.05, 0.05)), w, w / 7.2), [g, g, g * 0.95]);
}

function graffitiGeo(cell: number): BufferGeometry {
  return cached(`xh-graffiti-${cell}`, () => {
    const g = new PlaneGeometry(1, 1);
    const uv = g.getAttribute('uv');
    const u0 = (cell % 2) / 2, v0 = 0.5 - Math.floor(cell / 2) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
    return g;
  });
}

/** A graffiti tag (shared M11c atlas) on a face: `m` at its centre, facing out. */
function tag(b: ChunkBuilder, m: Matrix4, w: number, rng: Rng): void {
  const g = rng.range(0.7, 1);
  b.cards.of(b.mm.graffiti).add(graffitiGeo(rng.int(4)), scaled(m, w, w * 0.5), [g, g, g]);
}

/** Nearest point on a polyline with its unit tangent. */
function nearestOn(pts: readonly Pt[], x: number, z: number): { x: number; z: number; ux: number; uz: number; d: number } {
  let best = { x: 0, z: 0, ux: 1, uz: 0, d: Infinity };
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { x: px, z: pz, ux: dx / Math.sqrt(l2), uz: dz / Math.sqrt(l2), d };
  }
  return best;
}

/** Facing angle whose local +X runs along (ux, uz). */
const alongRot = (ux: number, uz: number): number => Math.atan2(-uz, ux);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------- the Wall

const WALL_GREY: RGB = [1.34, 1.32, 1.26];
const pipeGeo = (len: number): BufferGeometry => cached(`pipe-${len.toFixed(2)}`, () => new CylinderGeometry(0.2, 0.2, len, 8, 1, true).rotateX(Math.PI / 2));

/**
 * Berlin Wall, UL 12.41: 1.2 m elements, 3.4 m slab with the pipe on top (3.6 m), L-foot on the East
 * side; the West (Kreuzberg, south-facing) face sits on the collider edge. Joints show as 3 cm gaps.
 * Not an occluder: only buildings and large vehicles trigger the hero contour (CLAUDE.md).
 * The East Side Gallery run gets murals on both faces: the street side as on the real wall, and the
 * river side because the fixed camera looks north and never sees the street side (2D did the same).
 */
function buildWall(c: Ctx, w: Wall): void {
  const esg = /east side gallery|mühlenstraße/i.test(w.name);
  const rng = new Rng(hash(w.name));
  let west = 0;
  for (let i = 1; i < w.pts.length; i++) west -= w.pts[i]![0] - w.pts[i - 1]![0];
  const s = west >= 0 ? 1 : -1;
  let run = 0, runLen = 0, panel = -1;
  for (let i = 1; i < w.pts.length; i++) {
    const [ax, az] = w.pts[i - 1]!, [bx, bz] = w.pts[i]!, len = Math.hypot(bx - ax, bz - az);
    if (len < 0.3) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len, rot = Math.atan2(ux, uz);
    const n = Math.max(1, Math.round(len / 1.2)), ew = len / n;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) * ew, cx = ax + ux * t, cz = az + uz * t;
      const b = c.chunkOf(cx, cz), M = c.mm;
      const base = new Matrix4().makeRotationY(rot).setPosition(cx, c.ground(cx, cz), cz);
      const roll = rng.next(), g = rng.range(0.9, 1.05);
      const tint: RGB = roll < 0.1 ? k3([1.05, 1.03, 0.94], g) : roll < 0.15 ? k3([1.0, 1.08, 0.9], g) : k3(WALL_GREY, g);
      b.box(M.concrete, sub(base, s * 0.18, 1.5, 0), 0.24, 3.8, ew - 0.03, tint);
      b.box(M.concrete, sub(base, -s * 0.12, 0.1, 0), 0.36, 0.5, ew - 0.03, k3(tint, 0.82));
      b.geo(M.concrete, pipeGeo(ew - 0.02), sub(base, s * 0.18, 3.4, 0), k3(tint, 1.04));
      if (esg) {
        // Long murals (Johannes 2026-11-24): eight wide paintings (`murals.webp`, 2 × 4 cells of 4:1), each across
        // 10 to 11 elements (12 to 13 m), one after the other in order so neighbours never repeat.
        if (run >= runLen) {
          run = 0;
          runLen = 10 + rng.int(2);
          panel = panel < 0 ? rng.int(8) : (panel + 1) % 8;
        }
        const col = (panel % 2) / 2, f0 = run / runLen, f1 = (run + 1) / runLen;
        const v0 = 0.75 - Math.floor(panel / 2) / 4;
        run++;
        const fade: RGB = k3([1, 1, 1], rng.range(0.85, 1.05));
        // River side (West face) and street side (East face above the foot).
        for (const [x, out, y0] of [[s * 0.312, s, 0.12], [s * 0.048, -s, 0.4]] as Array<[number, number, number]>) {
          const za = out > 0 ? ew / 2 - 0.015 : -ew / 2 + 0.015, zb = -za;
          const p = [new Vector3(x, y0, za), new Vector3(x, y0, zb), new Vector3(x, 3.3, zb), new Vector3(x, 3.3, za)].map((v) => v.applyMatrix4(base));
          // The face whose quad starts at the far end runs the mural backwards along the wall, so each element's
          // slice still joins its neighbours (otherwise every slice is mirrored and the painting breaks up).
          const [ua, ub] = za > 0 ? [col + (1 - f1) * 0.5, col + (1 - f0) * 0.5] : [col + f0 * 0.5, col + f1 * 0.5];
          b.solid.of(c.X.murals).quad(p as [Vector3, Vector3, Vector3, Vector3], [ua, v0 + 0.25 * (y0 / 3.3) * 0.15, ub, v0 + 0.25], [fade]);
        }
        if (rng.next() < 0.12) tag(b, sub(base, s * 0.325, rng.range(0.5, 1.4), 0, s > 0 ? Math.PI / 2 : -Math.PI / 2), rng.range(0.6, 1.1), rng);
      } else if (rng.next() < 0.3) {
        // Kreuzberg face: sprayed tags at arm height.
        tag(b, sub(base, s * 0.312, rng.range(0.6, 2.4), rng.range(-0.2, 0.2), s > 0 ? Math.PI / 2 : -Math.PI / 2), rng.range(0.9, 2.2), rng);
      }
    }
  }
}

// ---------------------------------------------------------------- track field, Warschauer Brücke, death strip

/** Left and right edges of a polyline ribbon with mitred corners (`half` each side, + = (-uz, ux)). */
function ribbon(pts: readonly Pt[], half: number, off = 0): Array<{ l: Pt; r: Pt; c: Pt }> {
  const out: Array<{ l: Pt; r: Pt; c: Pt }> = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!, p = pts[i]!;
    const seg = (q0: Pt, q1: Pt): Pt => { const l = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]); return [-(q1[1] - q0[1]) / l, (q1[0] - q0[0]) / l]; };
    const n0 = seg(i > 0 ? a : p, i > 0 ? p : b), n1 = seg(i < pts.length - 1 ? p : a, i < pts.length - 1 ? b : p);
    let mx = n0[0] + n1[0], mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz);
    mx /= ml; mz /= ml;
    const k = 1 / Math.max(0.5, mx * n0[0] + mz * n0[1]);
    const c: Pt = [p[0] + mx * off * k, p[1] + mz * off * k];
    out.push({ c, l: [c[0] - mx * half * k, c[1] - mz * half * k], r: [c[0] + mx * half * k, c[1] + mz * half * k] });
  }
  return out;
}

/** Track bed tile: one track (3.5 m across) of gravel, five sleepers, rail shadows, weeds and rust. */
function paintTrackBed(g: CanvasRenderingContext2D): void {
  const rng = new Rng(1882);
  g.fillStyle = '#58524b';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rng.pick(['#6c665d', '#4a453f', '#7a7266', '#3d3934', '#665a4c']);
    g.fillRect(rng.range(0, 256), rng.range(0, 256), rng.range(1, 3), rng.range(1, 3));
  }
  for (let k = 0; k < 5; k++) {
    const y = k * 51.2 + 17;
    g.fillStyle = rng.next() < 0.3 ? '#7c7a72' : '#3e3026';
    g.fillRect(36 + rng.range(-3, 3), y, 184, 17);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(36, y + 15, 184, 3);
  }
  for (const u of [75, 181]) {
    g.fillStyle = 'rgba(90,50,25,0.55)';
    g.fillRect(u - 6, 0, 12, 256);
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(${rng.pick(['70,90,40', '95,100,50', '60,70,35'])},${rng.range(0.4, 0.8)})`;
    g.beginPath();
    g.arc(rng.pick([rng.range(0, 30), rng.range(226, 256), rng.range(0, 256)]), rng.range(0, 256), rng.range(3, 10), 0, Math.PI * 2);
    g.fill();
  }
}

/** Raked sand of the death strip: fine rake lines along the strip, a few footprints and weed tufts. */
function paintSand(g: CanvasRenderingContext2D): void {
  const rng = new Rng(1961);
  g.fillStyle = '#b9a67e';
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) {
    g.fillStyle = `rgba(${x % 8 ? '120,100,70' : '230,215,180'},0.35)`;
    g.fillRect(x + rng.range(-0.5, 0.5), 0, 1.5, 256);
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle = 'rgba(90,75,50,0.35)';
    g.beginPath();
    g.ellipse(rng.range(0, 256), rng.range(0, 256), 4, 8, rng.range(-0.3, 0.3), 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 10; i++) {
    g.fillStyle = 'rgba(80,95,45,0.7)';
    g.beginPath();
    g.arc(rng.range(0, 256), rng.range(0, 256), rng.range(2, 6), 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * The Stadtbahn track field at ground level: one textured bed (one tile per track), real rails, catenary
 * portals every 40 m with contact wires, freight wagons on the outer sidings. The fences are data props.
 */
function buildRailYard(c: Ctx, r: RailYard): void {
  const M = c.mm, X = c.X, rng = new Rng(hash(r.name)), half = r.width / 2, sp = r.width / r.tracks;
  const edges = ribbon(r.pts, half);
  const skip = (x: number, z: number, pad: number): boolean =>
    c.m.landmarks.some((l) => l.kind === 'ostbahnhof' && Math.hypot(x - l.x, z - l.z) < l.hx + pad) || c.m.terraces.some((t) => t.bridge && lineDist([...t.poly, t.poly[0]!], x, z) < pad && inPoly(t.poly, x, z));
  let dist = 0, nextPortal = 12;
  for (let i = 1; i < r.pts.length; i++) {
    const A = edges[i - 1]!, B = edges[i]!, [ax, az] = r.pts[i - 1]!, [bx, bz] = r.pts[i]!;
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, rot = Math.atan2(ux, uz);
    const n = Math.max(1, Math.ceil(len / 24));
    for (let k = 0; k < n; k++) {
      const f0 = k / n, f1 = (k + 1) / n, lerp = (p: Pt, q: Pt, f: number): Vector3 => new Vector3(p[0] + (q[0] - p[0]) * f, 0.07, p[1] + (q[1] - p[1]) * f);
      const p0 = lerp(A.l, B.l, f0), p1 = lerp(A.r, B.r, f0), p2 = lerp(A.r, B.r, f1), p3 = lerp(A.l, B.l, f1);
      const mx = (ax + bx) / 2 + (bx - ax) * ((f0 + f1) / 2 - 0.5), mz = (az + bz) / 2 + (bz - az) * ((f0 + f1) / 2 - 0.5);
      const b = c.chunkOf(mx, mz), y = c.low(mx, mz);
      for (const p of [p0, p1, p2, p3]) p.y += y;
      const v0 = (dist + len * f0) / 3.5, v1 = (dist + len * f1) / 3.5;
      b.solid.of(X.trackBed).quad([p0, p1, p2, p3], [0, v0, r.tracks, v1]);
      const pl = (len * (f1 - f0)) + 0.05, base = new Matrix4().makeRotationY(rot).setPosition(mx, y, mz);
      for (let t = 0; t < r.tracks; t++) {
        const tx = -half + sp * (t + 0.5);
        for (const rr of [-0.72, 0.72]) b.box(M.railSteel, sub(base, tx + rr, 0.13, 0), 0.07, 0.12, pl, [0.62, 0.5, 0.42]);
        b.box(M.iron, sub(base, tx, 5.6, 0), 0.03, 0.03, pl, [0.5, 0.5, 0.5]);
      }
    }
    // Catenary portals: masts beside the field, a lattice girder across, droppers to the wires.
    for (; nextPortal < dist + len; nextPortal += 40) {
      const t = nextPortal - dist, x = ax + ux * t, z = az + uz * t;
      if (skip(x, z, 6)) continue;
      const b = c.chunkOf(x, z), base = new Matrix4().makeRotationY(rot).setPosition(x, c.low(x, z), z);
      for (const s of [-1, 1]) b.box(M.iron, sub(base, s * (half + 0.5), 3.9, 0), 0.3, 7.8, 0.3, [0.7, 0.72, 0.7]);
      for (const yy of [7.2, 7.8]) b.box(M.iron, sub(base, 0, yy, 0), r.width + 1.4, 0.14, 0.14, [0.7, 0.72, 0.7]);
      for (let q = -half; q < half; q += 1.4) b.box(M.iron, sub(base, q + 0.35, 7.5, 0, 0, 0, (q / 1.4) % 2 ? 0.7 : -0.7), 0.06, 0.8, 0.06, [0.6, 0.62, 0.6]);
      for (let tt = 0; tt < r.tracks; tt++) b.box(M.iron, sub(base, -half + sp * (tt + 0.5), 6.4, 0), 0.03, 1.6, 0.03, [0.5, 0.5, 0.5]);
    }
    // Freight wagons standing on the outer sidings, a few tipped over.
    for (let t = 10; t < len - 8; t += rng.range(14, 30)) {
      if (rng.next() < 0.45) continue;
      const side = rng.next() < 0.5 ? 0 : r.tracks - 1, tx = -half + sp * (side + 0.5);
      const x = ax + ux * t, z = az + uz * t;
      if (skip(x, z, 18)) continue;
      const b = c.chunkOf(x, z), base = new Matrix4().makeRotationY(rot).setPosition(x - uz * tx, c.low(x, z), z + ux * tx);
      b.solid.captureOccluder(() => freightWagon(c, b, base, rng));
    }
    dist += len;
  }
}

function freightWagon(c: Ctx, b: ChunkBuilder, base: Matrix4, rng: Rng): void {
  const M = c.mm, kind = rng.int(3), tipped = rng.next() < 0.2;
  const m = tipped ? sub(base, 1.6, 0, 0, 0, 0, Math.PI / 2 - 0.1) : base;
  b.box(M.rubber, sub(m, 0, 0.75, 0), 2.4, 0.4, 12.5, [0.6, 0.6, 0.6]);
  for (const z of [-4.5, 4.5]) for (const x of [-0.72, 0.72]) b.geo(M.rust, cached('fw-wheel', () => new CylinderGeometry(0.45, 0.45, 0.12, 10).rotateZ(Math.PI / 2)), sub(m, x, 0.45, z), [0.5, 0.45, 0.4]);
  if (kind === 0) {
    // Boxcar, DR brown-red, a door ajar.
    b.box(M.carPaint, sub(m, 0, 2.5, 0), 2.8, 3.0, 12.6, [0.5, 0.22, 0.15]);
    b.box(M.carPaint, sub(m, 0, 4.05, 0), 2.6, 0.2, 12.4, [0.4, 0.38, 0.36]);
    b.box(M.dark, sub(m, 1.41, 2.3, rng.range(-2, 2)), 0.04, 2.2, 1.4);
  } else if (kind === 1) {
    // Tank wagon.
    b.geo(M.carPaint, cached('fw-tank', () => new CylinderGeometry(1.4, 1.4, 11, 14).rotateX(Math.PI / 2)), sub(m, 0, 2.5, 0), [0.18, 0.18, 0.18]);
    b.box(M.carPaint, sub(m, 0, 4.0, 0), 0.9, 0.4, 0.9, [0.2, 0.2, 0.2]);
  } else {
    // Flat wagon with a rusted container.
    b.box(M.carPaint, sub(m, 0, 1.2, 0), 2.8, 0.3, 12.6, [0.35, 0.3, 0.28]);
    b.box(M.corrugated, sub(m, 0, 2.6, 0), 2.4, 2.5, 6, [0.85, 0.5, 0.35]);
  }
}

/**
 * Bridge terrace (Warschauer Brücke): a concrete deck on pier rows with parapets on the collider edge,
 * old tram rails on the asphalt, an abutment at the far end, and an open steel stair down to the street.
 */
function buildDeckBridge(c: Ctx, t: Terrace): void {
  const M = c.mm, h = t.h, [p0, p1, p2, p3] = t.poly as [Pt, Pt, Pt, Pt];
  const N: Pt = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], S: Pt = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const L = Math.hypot(S[0] - N[0], S[1] - N[1]), W = Math.hypot(p0[0] - p3[0], p0[1] - p3[1]);
  const ux = (S[0] - N[0]) / L, uz = (S[1] - N[1]) / L, rot = Math.atan2(ux, uz);
  const st = t.stairs[0];
  const pieces = Math.max(1, Math.ceil(L / 16));
  for (let k = 0; k < pieces; k++) {
    const zc = -L / 2 + (k + 0.5) * (L / pieces), x = (N[0] + S[0]) / 2 + ux * zc, z = (N[1] + S[1]) / 2 + uz * zc;
    const b = c.chunkOf(x, z), base = new Matrix4().makeRotationY(rot).setPosition(x, 0, z), pl = L / pieces + 0.02;
    b.solid.captureOccluder(() => {
      b.box(M.asphalt, sub(base, 0, h - 0.12, 0), W - 0.6, 0.24, pl, [0.8, 0.8, 0.8]);
      b.box(M.concrete, sub(base, 0, h - 0.8, 0), W, 1.2, pl, [1.0, 0.98, 0.94]);
      for (const s of [-1, 1]) b.box(M.concrete, sub(base, s * (W / 2 - 0.7), h - 1.9, 0), 1.0, 1.0, pl, [0.85, 0.84, 0.8]);
    });
    for (const s of [-1, 1]) {
      // Parapet on the edge (the terrace collider), open at the south end where the stair starts.
      const open = k === pieces - 1 && st;
      if (!open) b.box(M.concrete, sub(base, s * (W / 2 - 0.2), h + 0.5, 0), 0.4, 1.0, pl, [1.05, 1.03, 0.98]);
      else {
        b.box(M.concrete, sub(base, s * (W / 2 - 0.2), h + 0.5, -2), 0.4, 1.0, pl - 4, [1.05, 1.03, 0.98]);
      }
      b.box(M.iron, sub(base, s * (W / 2 - 0.2), h + 1.15, 0), 0.06, 0.06, pl, [0.7, 0.7, 0.7]);
      for (const r of [-0.72, 0.72]) b.box(M.railSteel, sub(base, s * 2.2 + r, h + 0.01, 0), 0.08, 0.04, pl, [0.55, 0.5, 0.45]);
    }
    if (k === pieces - 1 && st) {
      // South end: parapet stubs beside the stair opening.
      for (const s of [-1, 1]) b.box(M.concrete, sub(base, s * (st.width / 2 + (W / 2 - st.width / 2) / 2), h + 0.5, pl / 2 - 0.2), W / 2 - st.width / 2, 1.0, 0.4, [1.05, 1.03, 0.98]);
    }
  }
  // Pier rows (three columns and a cap) and the abutment at the north end.
  const mid = new Matrix4().makeRotationY(rot).setPosition((N[0] + S[0]) / 2, 0, (N[1] + S[1]) / 2);
  const b0 = c.chunkOf((N[0] + S[0]) / 2, (N[1] + S[1]) / 2);
  b0.solid.captureOccluder(() => {
    for (let z = -L / 2 + 9; z < L / 2 - 4; z += 13) {
      b0.box(M.concrete, sub(mid, 0, h - 2.6, z), W - 0.4, 0.6, 1.4, [0.9, 0.88, 0.84]);
      for (const x of [-W / 2 + 1.2, 0, W / 2 - 1.2]) b0.box(M.concrete, sub(mid, x, (h - 2.9) / 2, z), 0.9, h - 2.9, 0.9, [0.85, 0.83, 0.8]);
    }
    // Playtest 2026-11-18: the north end was a clean wall. Now a broken-off span: a last, shattered pier
    // under the deck end, torn slabs hanging over the gap, rebar, a fallen deck slab and rubble below.
    b0.box(M.concrete, sub(mid, 0, h - 2.6, -L / 2 + 1.2), W - 0.4, 0.6, 1.4, [0.82, 0.8, 0.76]);
    for (const x of [-W / 2 + 1.2, W / 2 - 1.2]) b0.box(M.concrete, sub(mid, x, (h - 2.9) / 2, -L / 2 + 1.2), 0.9, h - 2.9, 0.9, [0.8, 0.78, 0.74]);
    b0.box(M.concrete, sub(mid, 0, (h - 4.5) / 2, -L / 2 + 1.2, 0.3), 0.9, h - 4.5, 0.9, [0.78, 0.76, 0.72]);
  });
  const rng = new Rng(1945);
  // Torn deck slabs over the gap, ragged, sagging outward (render only: the terrace edge still stops the hero).
  const n = Math.max(4, Math.round(W / 2.2));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n), len = rng.range(0.6, 2.6), sag = rng.range(0.1, 0.55);
    b0.box(M.concrete, sub(mid, x, h - 0.5 - Math.sin(sag) * len / 2, -L / 2 - Math.cos(sag) * len / 2 + 0.1, rng.range(-0.08, 0.08), -sag, rng.range(-0.1, 0.1)), W / n + 0.05, 0.5, len, [0.62, 0.6, 0.56]);
    for (let r = 0; r < 2; r++) b0.box(M.iron, sub(mid, x + rng.range(-0.6, 0.6), h - 0.5 - rng.range(0, 0.3), -L / 2 - len - rng.range(0.1, 0.6), rng.range(-0.4, 0.4), rng.range(0.2, 0.9)), 0.03, 0.03, rng.range(0.6, 1.4), [0.45, 0.32, 0.25]);
  }
  // Debris heaped on the deck end, low enough to see over, so the break reads from the game camera.
  for (let i = 0; i < 16; i++) {
    const s = rng.range(0.35, 1.0);
    b0.box(M.concrete, sub(mid, rng.range(-W / 2 + 0.6, W / 2 - 0.6), h + s * 0.25, -L / 2 + rng.range(0.1, 1.1), rng.range(0, 3), rng.range(-0.6, 0.6), rng.range(-0.6, 0.6)), s, s * 0.55, s * rng.range(0.7, 1.4), [0.7, 0.68, 0.64]);
  }
  for (const s of [-1, 1]) b0.box(M.railSteel, sub(mid, s * 2.2 + rng.range(-0.5, 0.5), h + 0.3, -L / 2 - 0.3, rng.range(-0.5, 0.5), -0.5), 0.1, 0.06, 2.4, [0.55, 0.5, 0.45]);
  // A fallen span piece leaning from the track bed against the last pier, chunks and rubble around it.
  b0.box(M.concrete, sub(mid, rng.range(-1.5, 1.5), h * 0.35, -L / 2 - 2.4, 0.15, -0.75), W * 0.55, 0.6, 7, [0.8, 0.78, 0.74]);
  for (let i = 0; i < 18; i++) {
    const s = rng.range(0.4, 1.4);
    b0.box(M.concrete, sub(mid, rng.range(-W / 2 - 1, W / 2 + 1), s * 0.3, -L / 2 - rng.range(-1, 6), rng.range(0, 3), rng.range(-0.5, 0.5), rng.range(-0.5, 0.5)), s, s * 0.6, s * rng.range(0.8, 1.6), [0.75, 0.73, 0.7]);
  }
  // Lamp posts on the parapet, dark.
  for (const z of [-L / 4, L / 4]) for (const s of [-1, 1]) {
    b0.box(M.iron, sub(mid, s * (W / 2 - 0.2), h + 2.8, z), 0.12, 4.6, 0.12, [0.7, 0.7, 0.7]);
    b0.geo(M.lampGlass, cached('u1-lamp', () => new SphereGeometry(0.18, 8, 6)), sub(mid, s * (W / 2 - 0.9), h + 5, z), [0.25, 0.22, 0.2]);
    b0.box(M.iron, sub(mid, s * (W / 2 - 0.55), h + 5.1, z), 0.8, 0.07, 0.07, [0.7, 0.7, 0.7]);
  }
  // Open steel stair down to the street: treads on two stringers, handrails, a centre post.
  for (const s of t.stairs) {
    const b = c.chunkOf(s.x, s.z), base = new Matrix4().makeRotationY(s.rot).setPosition(s.x, 0, s.z);
    const steps = Math.max(3, Math.round(h / 0.3)), a = Math.atan2(h, s.len), hyp = Math.hypot(h, s.len);
    for (let k = 0; k < steps; k++) {
      const f = (k + 0.5) / steps, top = (h * (k + 1)) / steps;
      b.box(M.concrete, sub(base, 0, top - 0.06, (f - 0.5) * s.len), s.width, 0.12, s.len / steps + 0.04, [0.95, 0.93, 0.9]);
    }
    for (const side of [-1, 1]) {
      b.box(M.iron, sub(base, side * (s.width / 2 + 0.08), h / 2 - 0.15, 0, 0, -a), 0.16, 0.5, hyp, [0.55, 0.55, 0.55]);
      b.box(M.iron, sub(base, side * (s.width / 2 + 0.08), h / 2 + 0.95, 0, 0, -a), 0.05, 0.05, hyp, [0.7, 0.7, 0.7]);
      for (let z = -s.len / 2 + 1; z < s.len / 2; z += 2.5) b.box(M.iron, sub(base, side * (s.width / 2 + 0.08), h * (z / s.len + 0.5) + 0.5, z), 0.04, 1.0, 0.04, [0.7, 0.7, 0.7]);
    }
    b.box(M.iron, sub(base, 0, h / 4, 0), 0.3, h / 2, 0.3, [0.6, 0.6, 0.6]);
  }
}

/**
 * The north-bank death strip between the East Side Gallery and the Spree (seen, not walked): raked sand,
 * the slab patrol path (Kolonnenweg), strip lamps over it (lamp heads, halo and ground glow cards, no
 * lights) and tank traps.
 */
function buildGrenzstreifen(c: Ctx): void {
  const M = c.mm, X = c.X, river = c.m.rivers[0];
  if (!river) return;
  const k = river.width / 28, rng = new Rng(1961), last = Math.min(6, river.pts.length - 1);
  const off = (i: number, o: number): Pt => {
    const p = river.pts[i]!, a = river.pts[Math.max(0, i - 1)]!, b = river.pts[Math.min(river.pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    return [p[0] - (dz / l) * o * k, p[1] + (dx / l) * o * k];
  };
  let lampAcc = 6, trapAcc = 14;
  for (let i = 0; i < last; i++) {
    const in0 = off(i, 15), in1 = off(i + 1, 15), out0 = off(i, 21), out1 = off(i + 1, 21);
    const len = Math.hypot(out1[0] - out0[0], out1[1] - out0[1]), n = Math.max(1, Math.ceil(len / 4));
    const P = (p: Pt, q: Pt, f: number): Pt => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    for (let s = 0; s < n; s++) {
      const f0 = s / n, f1 = (s + 1) / n;
      const a = P(in0, in1, f0), bq = P(out0, out1, f0), cq = P(out0, out1, f1), d = P(in0, in1, f1);
      if ([a, bq, cq, d].some(([x, z]) => onBridge(c.m, x, z, 1))) continue;
      const mx = (a[0] + cq[0]) / 2, mz = (a[1] + cq[1]) / 2, b = c.chunkOf(mx, mz), y = c.ground(mx, mz) + 0.05;
      const v = (q: Pt): Vector3 => new Vector3(q[0], y, q[1]);
      // Corners counter-clockwise from above: in0 → out0 → out1 → in1 (the strip runs along the river).
      const quad: [Vector3, Vector3, Vector3, Vector3] = [v(a), v(bq), v(cq), v(d)];
      const nrm = new Vector3().subVectors(quad[1], quad[0]).cross(new Vector3().subVectors(quad[3], quad[0]));
      b.solid.of(X.sand).quad(nrm.y >= 0 ? quad : [quad[0], quad[3], quad[2], quad[1]], [0, (len * f0) / 6, 1, (len * f1) / 6]);
      // Kolonnenweg: two rows of concrete slabs.
      const pm = P(P(in0, out0, 0.62), P(in1, out1, 0.62), (f0 + f1) / 2), rot = Math.atan2(out1[0] - out0[0], out1[1] - out0[1]);
      const pbase = new Matrix4().makeRotationY(rot).setPosition(pm[0], y, pm[1]);
      for (const x of [-0.5, 0.5]) b.box(M.concrete, sub(pbase, x, 0.03, 0), 0.6, 0.08, len / n - 0.12, [1.0, 0.98, 0.94]);
    }
    for (; lampAcc < len; lampAcc += 24) {
      const f = lampAcc / len, q = P(off(i, 20.6), off(i + 1, 20.6), f), g = P(in0, in1, f);
      if (onBridge(c.m, q[0], q[1], 1)) continue;
      const b = c.chunkOf(q[0], q[1]), y = c.ground(q[0], q[1]), yaw = Math.atan2(g[0] - q[0], g[1] - q[1]);
      const base = new Matrix4().makeRotationY(yaw).setPosition(q[0], y, q[1]);
      b.box(M.concrete, sub(base, 0, 2.5, 0), 0.2, 5, 0.2, [1.1, 1.1, 1.05]);
      b.box(M.iron, sub(base, 0, 4.95, 0.7), 0.08, 0.08, 1.5, [0.7, 0.7, 0.7]);
      b.box(M.lampGlass, sub(base, 0, 4.85, 1.35), 0.35, 0.12, 0.5, [1.3, 1.5, 1.8]);
      const head = lp(frame(q[0], q[1], yaw), 0, y + 4.8, 1.35);
      for (const [rx, ry] of [[0, 0], [0, Math.PI / 2], [-Math.PI / 2, 0]] as const) b.glows.of(X.cold).add(cached('gs-halo', () => new PlaneGeometry(1.4, 1.4)), new Matrix4().makeRotationY(ry).multiply(new Matrix4().makeRotationX(rx)).setPosition(head.x, head.y, head.z));
      const pool = lp(frame(q[0], q[1], yaw), 0, 0, 3);
      b.glows.of(X.cold).add(cached('gs-pool', () => new PlaneGeometry(7, 7).rotateX(-Math.PI / 2)), new Matrix4().setPosition(pool.x, y + 0.07, pool.z));
    }
    lampAcc -= len;
    for (; trapAcc < len; trapAcc += rng.range(22, 40)) {
      const q = P(P(in0, out0, rng.range(0.15, 0.45)), P(in1, out1, rng.range(0.15, 0.45)), trapAcc / len);
      if (onBridge(c.m, q[0], q[1], 2)) continue;
      const b = c.chunkOf(q[0], q[1]);
      b.on(c.ground(q[0], q[1]), () => buildProp(b, { kind: 'tankTrap', x: q[0], z: q[1], rot: rng.range(0, 3), size: 1 }, rng));
    }
    trapAcc -= len;
  }
}

// ---------------------------------------------------------------- Hochbahn U1 (green steel)

/** A deck stretch from a to b at height h: riveted plate girders, deck plate, two tracks, railings. */
function hochDeck(c: Ctx, a: Pt, e: Pt, v: Viaduct, rng: Rng): void {
  const M = c.mm, X = c.X, W = v.width, h = v.h;
  const len = Math.hypot(e[0] - a[0], e[1] - a[1]);
  if (len < 0.5) return;
  const ux = (e[0] - a[0]) / len, uz = (e[1] - a[1]) / len, rot = Math.atan2(ux, uz);
  const n = Math.max(1, Math.ceil(len / 15)), L = len / n;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) * L, cx = a[0] + ux * t, cz = a[1] + uz * t;
    const b = c.chunkOf(cx, cz);
    const base = new Matrix4().makeRotationY(rot).setPosition(cx, 0, cz);
    b.solid.captureOccluder(() => {
      for (const side of [-1, 1]) {
        b.box(X.steel, sub(base, side * (W / 2 - 0.35), h - 0.6, 0), 0.28, 1.5, L + 0.3);
        b.box(X.steel, sub(base, side * (W / 2 - 0.35), h - 1.32, 0), 0.7, 0.1, L + 0.3, [0.8, 0.85, 0.8]);
      }
      b.box(X.steel, sub(base, 0, h - 0.12, 0), W - 0.5, 0.2, L + 0.3, [0.7, 0.75, 0.7]);
    });
    // Stiffeners (the riveted look), sleepers band, rails, railing: thin parts, no occluder.
    for (const side of [-1, 1]) {
      for (let z = -L / 2 + 0.6; z < L / 2; z += 1.8) b.box(X.steel, sub(base, side * (W / 2 - 0.19), h - 0.6, z), 0.06, 1.4, 0.12, [0.85, 0.9, 0.85]);
      b.box(M.iron, sub(base, side * (W / 2 - 0.25), h + 1.1, 0), 0.06, 0.06, L + 0.1, [0.9, 1, 0.9]);
      for (let z = -L / 2 + 1; z < L / 2; z += 2.5) b.box(M.iron, sub(base, side * (W / 2 - 0.25), h + 0.55, z), 0.05, 1.1, 0.05);
    }
    for (const tx of [-1.4, 1.4]) {
      b.box(M.darkWood, sub(base, tx, h + 0.04, 0), 2.4, 0.08, L + 0.1, [0.7, 0.6, 0.55]);
      for (const r of [-0.72, 0.72]) b.box(M.railSteel, sub(base, tx + r, h + 0.14, 0), 0.07, 0.12, L + 0.1, [0.65, 0.55, 0.45]);
    }
    // Lamp posts on the deck every second span, alternating sides; a third still glows (no light).
    if (k % 2 === 0) {
      const side = rng.next() < 0.5 ? -1 : 1, lit = rng.next() < 0.35;
      b.box(M.iron, sub(base, side * (W / 2 - 0.3), h + 1.7, 0), 0.12, 3.4, 0.12, [0.8, 0.9, 0.8]);
      b.box(M.iron, sub(base, side * (W / 2 - 0.75), h + 3.35, 0), 0.9, 0.08, 0.08, [0.8, 0.9, 0.8]);
      b.geo(M.lampGlass, cached('u1-lamp', () => new SphereGeometry(0.18, 8, 6)), sub(base, side * (W / 2 - 1.15), h + 3.2, 0), lit ? [1.6, 1.3, 0.7] : [0.25, 0.22, 0.2]);
    }
  }
}

/**
 * U1 on its green steel viaduct: cast pillars exactly at `hochbahnPillars` (the colliders), cross
 * beams on each pair, deck girders between. The deck is an occluder (the hero walks under it); the
 * pillars are not. Where the line ends at a bridge head it swings onto the Oberbaum arcade.
 */
function buildHochbahn(c: Ctx, v: Viaduct): void {
  const M = c.mm, X = c.X, rng = new Rng(hash(v.name));
  const pillars = hochbahnPillars(v);
  const capital = cached('u1-capital', () => new CylinderGeometry(0.62, 0.3, 0.7, 10));
  const shaft = cached('u1-shaft', () => new CylinderGeometry(0.29, 0.35, 1, 10));
  const plinth = cached('u1-plinth', () => new CylinderGeometry(0.42, 0.46, 0.7, 10));
  for (let i = 0; i + 1 < pillars.length; i += 2) {
    const [ax, az] = pillars[i]!, [bx, bz] = pillars[i + 1]!;
    for (const [x, z] of [[ax, az], [bx, bz]] as Array<[number, number]>) {
      const y0 = c.ground(x, z), b = c.chunkOf(x, z), top = v.h - 1.4;
      const base = new Matrix4().setPosition(x, y0, z);
      b.geo(X.steel, plinth, sub(base, 0, 0.35, 0), [0.75, 0.8, 0.75]);
      b.geo(X.steel, shaft, scaled(sub(base, 0, (top - y0) / 2, 0), 1, top - y0 - 0.6));
      b.geo(X.steel, capital, sub(base, 0, top - 0.35, 0), [0.9, 0.95, 0.9]);
      // Base rings and a band of rivets half way up.
      b.geo(M.iron, cached('u1-band', () => new CylinderGeometry(0.33, 0.33, 0.12, 10)), sub(base, 0, 1.6, 0), [0.8, 0.9, 0.8]);
    }
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, b = c.chunkOf(mx, mz);
    const across = Math.atan2(bx - ax, bz - az);
    b.solid.captureOccluder(() => b.box(X.steel, new Matrix4().makeRotationY(across).setPosition(mx, v.h - 1.75, mz), 0.6, 0.7, v.width + 0.3, [0.8, 0.85, 0.8]));
  }
  // Deck, segment by segment; the last stretch to a bridge head turns onto the Oberbaum arcade.
  const last = v.pts[v.pts.length - 1]!;
  const bridge = c.m.bridges.find((br) => Math.hypot(br.x + Math.sin(br.rot) * br.len / 2 - last[0], br.z + Math.cos(br.rot) * br.len / 2 - last[1]) < 2);
  for (let i = 1; i < v.pts.length; i++) {
    const a = v.pts[i - 1]!, e = v.pts[i]!;
    if (i === v.pts.length - 1 && bridge) {
      // Straight on past the last pillar pair, then across the bridge head onto the arcade.
      const len = Math.hypot(e[0] - a[0], e[1] - a[1]), ux = (e[0] - a[0]) / len, uz = (e[1] - a[1]) / len;
      let tLast = 0;
      for (const [x, z] of pillars) {
        const t = (x - a[0]) * ux + (z - a[1]) * uz, off = Math.abs(-(x - a[0]) * uz + (z - a[1]) * ux);
        if (t > 0 && t < len && off < 2) tLast = Math.max(tLast, t);
      }
      const mid: Pt = [a[0] + ux * (tLast + 2), a[1] + uz * (tLast + 2)];
      hochDeck(c, a, mid, v, rng);
      const arc = arcadeEnd(bridge);
      hochDeck(c, mid, arc, v, rng);
      continue;
    }
    hochDeck(c, a, e, v, rng);
  }
}

/** Oberbaum arcade: centre offset (local x, upstream side away from the camera) and width. */
const ARCADE = { x: -10, w: 5.2 } as const;
function arcadeEnd(br: Bridge): Pt {
  const p = lp(frame(br.x, br.z, br.rot), ARCADE.x, 0, br.len / 2);
  return [p.x, p.z];
}

// ---------------------------------------------------------------- landmarks

function buildOberbaum(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X;
  const br = c.m.bridges.reduce((p, q) => (Math.hypot(q.x - l.x, q.z - l.z) < Math.hypot(p.x - l.x, p.z - l.z) ? q : p));
  const f = frame(br.x, br.z, br.rot), L = br.len, H = c.m.viaducts?.find((v) => v.kind === 'hochbahn')?.h ?? 6.5;
  const AX = ARCADE.x, AW = ARCADE.w, OUT = AX - AW / 2, IN = AX + AW / 2;
  const RED: RGB = [0.92, 0.55, 0.45], DARKRED: RGB = [0.7, 0.4, 0.32];
  // Arcade (Kreuzgang): open arches toward the road, closed outer wall with small arched windows.
  b.box(M.brick, lm(f, OUT + 0.35, H / 2, 0), 0.7, H, L, RED);
  b.box(M.brick, lm(f, AX, H - 0.9, 0), AW, 1.8, L, RED);
  const bay = 3.5, nb = Math.floor(L / bay);
  for (let i = 0; i <= nb; i++) {
    const z = -L / 2 + (i * L) / nb;
    b.box(M.brick, lm(f, IN - 0.4, (H - 1.8) / 2, z), 0.8, H - 1.8, 0.9, k3(RED, 0.95));
    if (i < nb) {
      const zc = z + L / nb / 2, ow = L / nb - 0.9;
      b.geo(M.brick, archGeo(ow, H - 1.8), lm(f, IN - 0.82, 0, zc, -Math.PI / 2), [0.16, 0.1, 0.08]);
      b.geo(M.brick, ringGeo(ow / 2, 0.35), lm(f, IN + 0.01, H - 1.8 - ow / 2, zc, Math.PI / 2), k3(RED, 1.1));
      b.geo(M.brick, archGeo(0.9, 1.8), lm(f, OUT - 0.01, 2.2, zc, -Math.PI / 2), [0.15, 0.1, 0.08]);
    }
  }
  // Crenellated parapet on the arcade, the abandoned U1 track ending at a buffer short of the Wall.
  for (let z = -L / 2 + 0.4; z < L / 2; z += 1.1) for (const x of [OUT + 0.2, IN - 0.2]) b.box(M.brick, lm(f, x, H + 0.45, z), 0.4, 0.9, 0.55, DARKRED);
  const wallZ = -L / 2 + 6;
  for (const r of [-0.72, 0.72]) b.box(M.railSteel, lm(f, AX + r, H + 0.08, (L / 2 + wallZ + 1.5) / 2), 0.07, 0.12, L / 2 - wallZ - 1.5, [0.6, 0.5, 0.42]);
  b.box(M.rust, lm(f, AX, H + 0.5, wallZ + 1.2), 2.2, 0.8, 0.5, [1.3, 0.4, 0.3]);
  // Brick fascia on the camera side of the road deck (the seven vaults sit below the water line here).
  b.box(M.brick, lm(f, br.width / 2 + 0.45, -0.55, 0), 0.5, 1.8, L - 2, DARKRED);
  // The two towers flanking the middle vault, gallery with merlons, copper spires with gilded balls.
  const TW = 5.8, TH = 22;
  for (const z of [-5.2, 5.2]) {
    b.box(M.brick, lm(f, AX, TH / 2, z), TW, TH, TW, RED);
    b.shadowBox(lm(f, AX, TH / 2, z), TW, TH, TW);
    for (const y of [H + 1.8, H + 7.5]) {
      for (const [x, zz, ry] of [[AX + TW / 2 + 0.01, z, Math.PI / 2], [AX - TW / 2 - 0.01, z, -Math.PI / 2], [AX, z + TW / 2 + 0.01, 0], [AX, z - TW / 2 - 0.01, Math.PI]] as Array<[number, number, number]>) {
        b.geo(M.brick, archGeo(1.1, 3.2), lm(f, x, y, zz, ry), [0.14, 0.09, 0.07]);
      }
    }
    b.box(M.brick, lm(f, AX, TH + 0.5, z), TW + 1.2, 1, TW + 1.2, DARKRED);
    for (let i = 0; i < 5; i++) {
      const o = -TW / 2 - 0.3 + (i * (TW + 0.6)) / 4;
      for (const [x, zz] of [[AX + o, z - TW / 2 - 0.3], [AX + o, z + TW / 2 + 0.3], [AX - TW / 2 - 0.3, z + o], [AX + TW / 2 + 0.3, z + o]] as Array<[number, number]>) {
        b.box(M.brick, lm(f, x, TH + 1.4, zz), 0.7, 0.8, 0.7, DARKRED);
      }
    }
    b.box(M.brick, lm(f, AX, TH + 2.6, z), TW - 1.6, 3.2, TW - 1.6, RED);
    b.geo(X.steel, cached('ob-spire', () => new ConeGeometry(3.0, 7.5, 4)), lm(f, AX, TH + 4.2 + 3.75, z, Math.PI / 4), [0.75, 1.25, 1.0]);
    b.geo(M.stucco, cached('ob-ball', () => new SphereGeometry(0.35, 8, 6)), lm(f, AX, TH + 12.1, z), [1.6, 1.25, 0.45]);
  }
  // Small crenellated turrets over the end piers.
  for (const z of [-L / 2 + 1.6, L / 2 - 1.6]) {
    b.box(M.brick, lm(f, AX, (H + 3) / 2, z), 3.2, H + 3, 3.2, RED);
    for (const [x, zz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3], [0, -1.3], [0, 1.3]] as Array<[number, number]>) b.box(M.brick, lm(f, AX + x, H + 3.4, z + zz), 0.6, 0.8, 0.6, DARKRED);
  }
  // Checkpoint decoration on the Friedrichshain side, beyond the Wall line, off the West deck: a raised
  // barrier pole, a booth, a border post in black, red and gold. No colliders.
  b.solid.excludeOccluder(() => {
    const pole = lm(f, 6.4, 0, -L / 2 + 3.2);
    b.box(M.concrete, sub(pole, 0, 0.6, 0), 0.4, 1.2, 0.4, [1.2, 1.2, 1.15]);
    for (let i = 0; i < 6; i++) b.box(M.enamel, sub(pole, -0.2 - i * 0.55 * Math.cos(1.35), 1.25 + i * 0.55 * Math.sin(1.35), 0, 0, 0, 1.35), 0.55, 0.1, 0.1, i % 2 ? [1.2, 0.25, 0.2] : [1.3, 1.3, 1.25]);
    const booth = lm(f, br.width / 2 + 3, 0, -L / 2 - 2.5);
    b.box(M.plaster.cream ?? M.stucco, sub(booth, 0, 1.3, 0), 2.2, 2.6, 2.6, [1.15, 1.15, 1.12]);
    b.box(M.glass, sub(booth, 0, 1.75, 0), 2.25, 0.9, 2.65, [1.2, 1.3, 1.2]);
    b.box(M.tar, sub(booth, 0, 2.7, 0), 2.8, 0.18, 3.2, [0.8, 0.8, 0.8]);
    const post = lm(f, br.width / 2 + 1.2, 0, -L / 2 - 0.6);
    for (const [y, col] of [[0.4, [0.15, 0.15, 0.15]], [1.0, [1.1, 0.2, 0.15]], [1.6, [1.5, 1.15, 0.2]]] as Array<[number, RGB]>) b.box(M.enamel, sub(post, 0, y, 0), 0.26, 0.6, 0.26, col);
  });
  // West sign on the south railing, facing the Kreuzberg bank.
  sign(b, X, SIGN.west, lm(f, br.width / 2 + 0.3, 1.6, wallZ + 3, Math.PI / 2), 4.4, 0.55);
  b.box(M.iron, lm(f, br.width / 2 + 0.25, 0.9, wallZ + 3), 0.06, 1.8, 0.06);
}

/**
 * S-Bahnhof Warschauer Straße (walk under): a 1980s GDR glass pavilion at deck height beside the
 * Warschauer Brücke, on columns over the track field, a footbridge to the deck, stairs down to two
 * island platforms with canopies, S emblems and the name board.
 */
function buildWarschauer(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X, W = l.hx * 2, D = l.hz * 2;
  const deck = c.m.terraces.find((t) => t.bridge), H = deck?.h ?? 6;
  const GREY: RGB = [1.15, 1.14, 1.1];
  // Pavilion on columns.
  for (const x of [-W / 2 + 0.8, W / 2 - 0.8]) for (const z of [-D / 2 + 0.8, D / 2 - 0.8]) b.box(M.concrete, lm(l, x, (H - 0.5) / 2, z), 0.8, H - 0.5, 0.8, [0.9, 0.88, 0.85]);
  b.box(M.concrete, lm(l, 0, H - 0.3, 0), W, 0.6, D, GREY);
  b.box(M.glass, lm(l, 0, H + 1.5, 0), W - 0.6, 3, D - 0.6, [1.1, 1.3, 1.25]);
  for (let x = -W / 2 + 0.3; x <= W / 2 - 0.2; x += 2) for (const z of [-D / 2 + 0.28, D / 2 - 0.28]) b.box(M.iron, lm(l, x, H + 1.5, z), 0.1, 3, 0.1, [0.5, 0.5, 0.5]);
  b.box(M.concrete, lm(l, 0, H + 3.5, 0), W + 0.4, 1, D + 0.4, GREY);
  // Gravel roof with a glazed lantern and the S emblem standing on the roof edge (read from the camera).
  b.box(M.concrete, lm(l, 0, H + 4.03, 0), W - 0.2, 0.06, D - 0.2, [0.62, 0.6, 0.56]);
  b.box(M.glass, lm(l, 0, H + 4.35, 0), W * 0.5, 0.6, D * 0.35, [1.2, 1.4, 1.35]);
  b.box(M.rust, lm(l, W / 2 - 2, H + 4.4, D / 2 - 2), 1.4, 0.8, 1, [0.7, 0.7, 0.72]);
  for (const ry of [0, Math.PI]) emblem(b, X, 'S', lm(l, -W / 2 + 1.6, H + 5.4, -D / 2 + 0.6, ry), 1.8);
  b.box(M.iron, lm(l, -W / 2 + 1.6, H + 4.3, -D / 2 + 0.6), 0.1, 0.8, 0.1, [0.6, 0.6, 0.6]);
  b.box(M.shop, lm(l, 0, H + 1.2, -D / 2 + 0.25), 4, 1.4, 0.05);
  // Name boards and S emblems on both long faces of the fascia.
  for (const [z, ry] of [[-D / 2 - 0.22, Math.PI], [D / 2 + 0.22, 0]] as Array<[number, number]>) {
    sign(b, X, SIGN.warschauer, lm(l, 0.8, H + 3.5, z, ry), 8, 1.0);
    emblem(b, X, 'S', lm(l, ry ? 5.2 : -5.2, H + 3.5, z, ry), 0.95);
  }
  b.light(lp(l, 0, H + 2.2, -D / 2 - 1.5), 0x9dffb0, 12, 11, 0, 4);
  b.shadowBox(lm(l, 0, H + 1.8, 0), W, 4.2, D);
  // Footbridge from the pavilion to the deck edge.
  if (deck) {
    const [p0, p1, p2, p3] = deck.poly as [Pt, Pt, Pt, Pt];
    const N: Pt = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], S: Pt = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const q = nearestOn([N, S], l.x, l.z), dw = Math.hypot(p0[0] - p3[0], p0[1] - p3[1]) / 2;
    const dx = (q.x - l.x) / q.d, dz = (q.z - l.z) / q.d;
    // Half extent of the pavilion towards the deck, then the gap to the deck edge.
    const ph = Math.abs(l.hx * (dx * Math.cos(l.rot) - dz * Math.sin(l.rot))) + Math.abs(l.hz * (dx * Math.sin(l.rot) + dz * Math.cos(l.rot)));
    const gap = q.d - dw - ph;
    if (gap > 0.3) {
      const mid = ph + gap / 2;
      const fb = new Matrix4().makeRotationY(Math.atan2(dx, dz)).setPosition(l.x + dx * mid, 0, l.z + dz * mid);
      b.box(M.concrete, sub(fb, 0, H - 0.25, 0), 3.4, 0.5, gap + 0.2, GREY);
      for (const s of [-1, 1]) b.box(M.iron, sub(fb, s * 1.6, H + 0.55, 0), 0.06, 1.1, gap, [0.7, 0.7, 0.7]);
    }
  }
  // Island platforms in the track field (between tracks 2-3 and 6-7), canopies, stairs down from the pavilion.
  const yard = c.m.railYards?.[0];
  if (!yard) return;
  const y = nearestOn(yard.pts, l.x, l.z), f = frame(y.x, y.z, alongRot(y.ux, y.uz)), sp = yard.width / yard.tracks;
  const dir = deck ? Math.sign(((l.x - (deck.poly[0]![0] + deck.poly[2]![0]) / 2) * y.ux + (l.z - (deck.poly[0]![1] + deck.poly[2]![1]) / 2) * y.uz) || 1) : 1;
  for (const pz of [-sp * 2, sp * 2]) {
    const pp = lp(f, dir * 20, 0, pz), pb = c.chunkOf(pp.x, pp.z);
    pb.box(M.concrete, lm(f, dir * 20, 0.45, pz), 60, 0.9, sp - 1.6, [1.0, 0.98, 0.94]);
    for (const e of [-1, 1]) pb.box(M.enamel, lm(f, dir * 20, 0.91, pz + e * ((sp - 1.6) / 2 - 0.15)), 60, 0.02, 0.18, [1.4, 1.35, 1.2]);
    for (let x = 6; x < 34; x += 6) pb.box(X.steel, lm(f, dir * x, 2.35, pz), 0.18, 2.9, 0.18, [0.6, 0.62, 0.6]);
    pb.box(M.corrugated, lm(f, dir * 20, 3.85, pz), 30, 0.14, sp + 0.6, [0.75, 0.78, 0.8]);
    // Stair: from the platform up to the pavilion floor along the platform.
    const steps = Math.round((H - 0.9) / 0.3), slen = steps * 0.32;
    for (let k = 0; k < steps; k++) pb.box(M.concrete, lm(f, dir * (2 + slen - (k + 0.5) * 0.32), 0.9 + (H - 0.9) * (k + 1) / steps - 0.06, pz), 0.34, 0.12, sp - 2.2, [0.95, 0.93, 0.9]);
    for (const e of [-1, 1]) pb.box(M.iron, sub(lm(f, dir * (2 + slen / 2), (H + 0.9) / 2 + 0.9, pz + e * (sp / 2 - 1.1)), 0, 0, 0, 0, 0, -dir * Math.atan2(H - 0.9, slen)), Math.hypot(slen, H - 0.9), 0.05, 0.05, [0.7, 0.7, 0.7]);
  }
}

/**
 * Ostbahnhof (the 1981 name): a segmental glass-and-steel train shed over the whole track field, the
 * GDR station front with tall windows, a glazed portal and the OSTBAHNHOF block on the south side.
 */
function buildOstbahnhof(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X, W = l.hx * 2, HZ = l.hz, GREY = M.concrete;
  const yard = c.m.railYards?.[0];
  const ny = yard ? nearestOn(yard.pts, l.x, l.z) : null;
  const vz = ny ? (ny.x - l.x) * Math.sin(l.rot) + (ny.z - l.z) * Math.cos(l.rot) : 0;
  const SY = 10, half = HZ + 0.6, rise = 7, R = (half * half + rise * rise) / (2 * rise), ang = Math.asin(half / R), cy = SY + rise - R;
  const STEEL: RGB = [0.55, 0.6, 0.6];
  // Shed: steel posts with glass on the north side, the vault, ribs, purlins, glazed end lunettes.
  for (let x = -W / 2; x <= W / 2 + 0.01; x += 4) b.box(X.steel, lm(l, x, SY / 2, vz - HZ), 0.4, SY, 0.4, STEEL);
  b.box(M.glass, lm(l, 0, SY / 2 + 1.5, vz - HZ), W, SY - 3, 0.06, [0.9, 1.05, 1.1]);
  b.box(X.steel, lm(l, 0, SY, vz - HZ), W + 0.3, 0.5, 0.6, STEEL);
  b.geo(M.glass, cached(`ost-vault-${R.toFixed(1)}-${W}`, () => new CylinderGeometry(R, R, W, 24, 1, true, Math.PI / 2 - ang, 2 * ang).rotateZ(Math.PI / 2)), lm(l, 0, cy, vz), [1.05, 1.2, 1.3]);
  for (let x = -W / 2; x <= W / 2 + 0.01; x += 4) b.geo(X.steel, cached(`ost-rib-${R.toFixed(1)}`, () => new TorusGeometry(R + 0.08, 0.16, 4, 20, 2 * ang).rotateZ(Math.PI / 2 - ang).rotateY(Math.PI / 2)), lm(l, x, cy, vz), [0.5, 0.55, 0.55]);
  for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) b.box(X.steel, lm(l, 0, cy + Math.cos(a * ang) * (R + 0.1), vz + Math.sin(a * ang) * (R + 0.1)), W, 0.14, 0.14, [0.5, 0.55, 0.55]);
  const lunette = cached(`ost-lunette-${R.toFixed(1)}`, () => {
    const s = new Shape();
    s.moveTo(-half, 0);
    s.absarc(0, -(R - rise), R, Math.PI / 2 + ang, Math.PI / 2 - ang, true);
    s.lineTo(-half, 0);
    return new ShapeGeometry(s, 16);
  });
  for (const end of [-1, 1]) {
    b.geo(M.glass, lunette, lm(l, end * W / 2, SY, vz, end * Math.PI / 2), [0.95, 1.1, 1.2]);
    b.box(X.steel, lm(l, end * W / 2, SY, vz), 0.5, 0.6, 2 * half, STEEL);
    for (const z of [-HZ, HZ]) b.box(X.steel, lm(l, end * W / 2, SY / 2, vz + z), 0.6, SY, 0.6, STEEL);
  }
  // South front: concrete wall with tall windows, a projecting glazed portal, the name block.
  const fz = vz + HZ;
  b.box(GREY, lm(l, 0, SY / 2, fz - 0.4), W, SY, 0.8, [1.15, 1.18, 1.25]);
  b.box(GREY, lm(l, 0, SY + 0.3, fz - 0.4), W + 0.4, 0.6, 1.1, [1.05, 1.08, 1.15]);
  for (let x = -W / 2 + 2.5; x < W / 2 - 1; x += 3.2) {
    if (Math.abs(x) < 7.5) continue;
    b.box(M.glass, lm(l, x, 5, fz + 0.02), 1.6, 6.5, 0.05, [1.0, 1.15, 1.2]);
    b.box(M.stucco, lm(l, x, 1.6, fz + 0.12), 2.0, 0.2, 0.25, [0.9, 0.92, 0.95]);
  }
  b.box(GREY, lm(l, 0, 6.6, fz - 0.4), 14, 13.2, 1.6, [1.25, 1.28, 1.35]);
  for (const x of [-4.2, 0, 4.2]) {
    b.box(M.glass, lm(l, x, 5.6, fz + 0.42), 3.2, 9.2, 0.05, [1.1, 1.25, 1.3]);
    for (let yy = 1.6; yy < 10.2; yy += 1.4) b.box(M.iron, lm(l, x, yy, fz + 0.45), 3.2, 0.06, 0.04, [0.4, 0.4, 0.4]);
  }
  b.box(M.dark, lm(l, 0, 1.3, fz + 0.43), 2.4, 2.6, 0.04);
  b.box(GREY, lm(l, 0, 14.4, fz - 0.2), 16, 2.4, 1, [1.1, 1.12, 1.18]);
  sign(b, X, SIGN.ostbahnhof, lm(l, 0, 14.4, fz + 0.32), 15, 1.88);
  for (const x of [-5.5, 5.5]) b.light(lp(l, x, 3.5, fz + 2.2), 0xffb060, 14, 11, 0.1, 3.5);
  b.shadowBox(lm(l, 0, SY / 2, fz - 0.4), W, SY, 0.8);
  b.shadowBox(lm(l, 0, SY + rise / 2, vz), W, rise, 2 * half);
}

/** U1 station on the viaduct (walk under): side platforms, steel and glass hall, gabled glass roof, names. */
function buildU1Station(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X;
  const v = c.m.viaducts?.find((q) => q.kind === 'hochbahn');
  if (!v) return;
  const p = nearestOn(v.pts, l.x, l.z), f = frame(p.x, p.z, alongRot(p.ux, p.uz));
  if (l.name === 'Schlesisches Tor') { buildSchlesischesTor(c, b, f, v, l.name); return; }
  const h = v.h, L = Math.max(24, l.hx * 2), D = v.width + 2.4, PH = h + 0.9, RH = PH + 4.2;
  const row = SIGN[l.name as 'Kottbusser Tor'] ?? SIGN['Kottbusser Tor'];
  for (const side of [-1, 1]) {
    const z = side * (D / 2 - 1.2);
    b.box(M.concrete, lm(f, 0, PH - 0.45, z), L, 0.9, 2.4, [1.0, 1.0, 0.96]);
    b.box(M.enamel, lm(f, 0, PH + 0.01, z - side * 1.08), L, 0.02, 0.2, [1.4, 1.2, 0.3]);
    // Outer wall: steel posts, a low panel, a glass band, the name boards and U emblems.
    for (let x = -L / 2; x <= L / 2 + 0.01; x += 4) b.box(X.steel, lm(f, x, (PH + RH) / 2, side * D / 2), 0.25, RH - PH, 0.25);
    b.box(X.steel, lm(f, 0, PH + 0.6, side * D / 2), L, 1.2, 0.1, [0.8, 0.85, 0.8]);
    b.box(M.glass, lm(f, 0, PH + 2.4, side * D / 2), L, 2.4, 0.05, [1.15, 1.35, 1.3]);
    for (const x of [-L / 4, L / 4]) sign(b, X, row, lm(f, x, PH + 0.6, side * (D / 2 + 0.07), side > 0 ? 0 : Math.PI), 6, 0.75);
    emblem(b, X, 'U', lm(f, 0, PH + 0.65, side * (D / 2 + 0.07), side > 0 ? 0 : Math.PI), 1);
    b.box(X.steel, lm(f, 0, RH, side * D / 2), L + 0.4, 0.3, 0.35, [0.7, 0.75, 0.7]);
  }
  for (const end of [-1, 1]) {
    b.box(X.steel, lm(f, end * L / 2, (PH + RH) / 2, 0), 0.3, RH - PH, D, [0.75, 0.8, 0.75]);
    b.box(M.glass, lm(f, end * L / 2, RH + 0.2, 0), 0.05, 0.4, D, [1.1, 1.3, 1.25]);
  }
  b.geo(M.glass, gableRoof(L, D, 2.2), lm(f, 0, RH, 0), [0.95, 1.1, 1.1]);
  b.geo(X.steel, gableEnds(L, D, 2.2), lm(f, 0, RH, 0), [0.8, 0.85, 0.8]);
  b.box(X.steel, lm(f, 0, RH + 2.2, 0), L + 0.8, 0.25, 0.4, [0.7, 0.75, 0.7]);
  for (let x = -L / 2; x <= L / 2 + 0.01; x += 4) b.geo(X.steel, cached(`u1-roofrib-${D}`, () => gableEnds(0.08, D + 0.8, 2.25)), lm(f, x, RH, 0), [0.7, 0.75, 0.7]);
  // Warm light from the platform hall, seen through the glass (one spot, like a door lamp).
  b.light(lp(f, 0, PH + 2, 0), 0xffc890, 10, 10, 0.05, 4);
}

/** U-Bahnhof Schlesisches Tor (1902): brick and sandstone hall on the viaduct, steep slate roof, Dutch gables, corner turret. */
function buildSchlesischesTor(c: Ctx, b: ChunkBuilder, f: Landmark, v: Viaduct, name: string): void {
  const M = c.mm, X = c.X, h = v.h, L = 30, D = v.width + 3, Y0 = h - 1.6, Y1 = h + 5.6;
  const SAND: RGB = [1.25, 1.05, 0.8], RED: RGB = [0.95, 0.58, 0.48];
  b.box(M.brick, lm(f, 0, (Y0 + Y1) / 2, 0), L, Y1 - Y0, D, RED);
  for (const y of [Y0 + 0.25, h + 0.95, Y1 - 0.2]) b.box(M.stucco, lm(f, 0, y, 0), L + 0.3, 0.45, D + 0.3, SAND);
  // Tall arched windows (lit glass) on both long sides, sandstone rings.
  for (const side of [-1, 1]) {
    for (let x = -L / 2 + 2.5; x < L / 2 - 1; x += 3.3) {
      archOpening(b, lm(f, x, h + 1.3, side * (D / 2 + 0.02), side > 0 ? 0 : Math.PI), 1.7, 3.6, M.glass, [1.6, 1.25, 0.8], M.stucco, SAND);
    }
    // Under the hall: sandstone soffit band and arched portals over the street between the pillars.
    for (let x = -L / 2 + 3.75; x < L / 2; x += 7.5) b.geo(M.brick, ringGeo(2.6, 0.5), lm(f, x, Y0 - 0.1, side * (D / 2 + 0.02), side > 0 ? 0 : Math.PI), SAND);
  }
  b.box(M.stucco, lm(f, 0, Y0 - 0.15, 0), L + 0.2, 0.3, D + 0.2, k3(SAND, 0.8));
  // Steep slate roof, stepped (Dutch) gables at both ends and two cross gables to the street.
  b.geo(M.roof, gableRoof(L, D, 6), lm(f, 0, Y1, 0), [0.42, 0.46, 0.55]);
  b.geo(M.brick, gableEnds(L, D, 6), lm(f, 0, Y1, 0), RED);
  for (const end of [-1, 1]) steppedGable(b, f, end * (L / 2 + 0.2), Y1, 0, D * 0.8, Math.PI / 2);
  for (const x of [-L / 4, L / 4]) for (const side of [-1, 1]) {
    b.box(M.brick, lm(f, x, Y1 + 1.4, side * (D / 2 - 0.5)), 5, 2.8, 1.2, RED);
    steppedGable(b, f, x, Y1 + 2.8, side * (D / 2 - 0.5), 5);
    archOpening(b, lm(f, x, Y1 + 0.4, side * (D / 2 + 0.11), side > 0 ? 0 : Math.PI), 1.4, 2.2, M.glass, [1.5, 1.2, 0.8], M.stucco, SAND);
  }
  // Corner turret toward the Oberbaumstraße with a needle spire.
  const tx = L / 2 - 1.5, tz = D / 2 + 0.5;
  b.geo(M.brick, cached('st-turret', () => new CylinderGeometry(1.8, 1.8, 1, 8)), scaled(lm(f, tx, (Y0 + Y1 + 5) / 2, tz), 1, Y1 + 5 - Y0), RED);
  b.geo(M.stucco, cached('st-turret-band', () => new CylinderGeometry(1.95, 1.95, 0.4, 8)), lm(f, tx, Y1 + 0.2, tz), SAND);
  b.geo(M.roof, cached('st-spire', () => new ConeGeometry(2.1, 7, 8)), lm(f, tx, Y1 + 5 + 3.5, tz), [0.42, 0.46, 0.55]);
  b.geo(M.stucco, cached('ob-ball', () => new SphereGeometry(0.35, 8, 6)), lm(f, tx, Y1 + 12.2, tz), [1.6, 1.25, 0.45]);
  // Name boards and U emblems over the street on both sides.
  for (const side of [-1, 1]) {
    sign(b, X, SIGN[name as 'Schlesisches Tor'] ?? SIGN['Schlesisches Tor'], lm(f, -3, h - 0.55, side * (D / 2 + 0.06), side > 0 ? 0 : Math.PI), 7, 0.88);
    emblem(b, X, 'U', lm(f, 2.5, h - 0.55, side * (D / 2 + 0.06), side > 0 ? 0 : Math.PI), 1.1);
  }
  b.light(lp(f, 0, h - 2, D / 2 + 1), 0xffb060, 12, 10, 0.05, 4);
  b.shadowBox(lm(f, 0, (Y0 + Y1) / 2, 0), L, Y1 - Y0, D);
}

/** St.-Thomas-Kirche: yellow brick, nave and transept, drum and copper dome over the crossing, two west towers, apse. */
function buildThomaskirche(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X, Y = X.yellow;
  const at = (x: number, z: number): { x: number; z: number } => { const p = lp(l, x, 0, z); return { x: p.x, z: p.z }; };
  const NW = 9, NH = 13, SLATE: RGB = [0.48, 0.52, 0.6], COPPER: RGB = [0.7, 1.2, 0.98], GLASS: RGB = [1.5, 1.05, 0.65];
  // Nave (front part toward the towers) and transept.
  walls(b, { ...at(0, 2.5), rot: l.rot, w: NW, d: 10 }, Y, NH, [], 1869);
  b.geo(M.roof, gableRoof(10, NW, 4.5), lm(l, 0, NH, 2.5, Math.PI / 2), SLATE);
  walls(b, { ...at(0, -3.5), rot: l.rot, w: 16, d: 6 }, Y, NH, [], 1865);
  b.geo(M.roof, gableRoof(16, 6, 3.5), lm(l, 0, NH, -3.5), SLATE);
  b.geo(Y, gableEnds(16, 6, 3.5), lm(l, 0, NH, -3.5));
  // Tall round-arched windows with warm glass (two rows on the transept ends, one row along the nave).
  for (const side of [-1, 1]) {
    for (const z of [0.5, 4.5]) archOpening(b, lm(l, side * (NW / 2 + 0.02), 3, z, side * Math.PI / 2), 1.6, 6.5, M.glass, GLASS, M.stucco, [1.2, 1.05, 0.85]);
    archOpening(b, lm(l, side * 8.02, 2.5, -3.5, side * Math.PI / 2), 2.4, 8, M.glass, GLASS, M.stucco, [1.2, 1.05, 0.85]);
    b.geo(M.glass, cached('tk-rose', () => new CircleGeometry(1.2, 16)), lm(l, side * 8.03, NH + 1.3, -3.5, side * Math.PI / 2), GLASS);
  }
  // Apse.
  b.geo(Y, cached('tk-apse', () => new CylinderGeometry(3.6, 3.6, 1, 14, 1, false, Math.PI / 2, Math.PI)), scaled(lm(l, 0, 5.5, -6.5), 1, 11));
  b.geo(M.roof, cached('tk-apse-roof', () => new SphereGeometry(3.7, 14, 6, Math.PI / 2, Math.PI, 0, Math.PI / 2)), scaled(lm(l, 0, 11, -6.5), 1, 0.7), SLATE);
  // Crossing: octagonal drum with windows, copper dome, lantern and cross.
  b.geo(Y, cached('tk-drum', () => new CylinderGeometry(4.4, 4.4, 1, 8)), scaled(lm(l, 0, NH + 3.5, -3.5), 1, 7));
  b.geo(M.stucco, cached('tk-drum-band', () => new CylinderGeometry(4.6, 4.6, 0.5, 8)), lm(l, 0, NH + 7.1, -3.5), [1.1, 1.0, 0.85]);
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * (Math.PI / 4), r = 4.4 * Math.cos(Math.PI / 8) + 0.03;
    archOpening(b, lm(l, Math.sin(a) * r, NH + 1.6, -3.5 + Math.cos(a) * r, a), 1.1, 3.4, M.glass, GLASS, null);
  }
  b.geo(X.steel, cached('tk-dome', () => new SphereGeometry(4.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), scaled(lm(l, 0, NH + 7.3, -3.5), 1, 1.25), COPPER);
  b.geo(X.steel, cached('tk-lantern', () => new CylinderGeometry(0.9, 1.0, 2.4, 8)), lm(l, 0, NH + 13.9, -3.5), COPPER);
  b.geo(X.steel, cached('tk-lantern-cap', () => new ConeGeometry(1.1, 2.2, 8)), lm(l, 0, NH + 16.2, -3.5), COPPER);
  b.box(M.stucco, lm(l, 0, NH + 18.1, -3.5), 0.14, 1.6, 0.14, [1.6, 1.25, 0.45]);
  b.box(M.stucco, lm(l, 0, NH + 18.4, -3.5), 0.8, 0.14, 0.14, [1.6, 1.25, 0.45]);
  // West front between the towers: gable with rose window, portal.
  b.geo(Y, gableEnds(0.01, NW, 4.5), lm(l, 0, NH, 7.5, Math.PI / 2));
  b.geo(M.glass, cached('tk-rose-front', () => new CircleGeometry(1.5, 16)), lm(l, 0, NH - 2.4, 7.52), GLASS);
  b.geo(M.stucco, cached('tk-rose-ring', () => new RingGeometry(1.5, 1.9, 16)), lm(l, 0, NH - 2.4, 7.53), [1.2, 1.05, 0.85]);
  archOpening(b, lm(l, 0, 0, 7.53), 2.8, 4.6, M.door, [0.6, 0.5, 0.45], M.stucco, [1.2, 1.05, 0.85]);
  // Two towers with belfries and slate pyramid spires.
  for (const x of [-5.6, 5.6]) {
    b.box(Y, lm(l, x, 12, 9.5), 3.8, 24, 4, [1, 1, 1], 0.5);
    b.box(M.stucco, lm(l, x, 17, 9.5), 4.1, 0.4, 4.3, [1.1, 1.0, 0.85]);
    b.box(M.stucco, lm(l, x, 24.1, 9.5), 4.3, 0.5, 4.5, [1.1, 1.0, 0.85]);
    for (const [ox, oz, ry] of [[0, 2.02, 0], [0, -2.02, Math.PI], [1.92, 0, Math.PI / 2], [-1.92, 0, -Math.PI / 2]] as Array<[number, number, number]>) {
      archOpening(b, lm(l, x + ox, 18.5, 9.5 + oz, ry), 1.3, 3.8, M.brick, [0.12, 0.09, 0.08], M.stucco, [1.1, 1.0, 0.85]);
      archOpening(b, lm(l, x + ox, 4, 9.5 + oz, ry), 0.9, 2.6, M.glass, GLASS, null);
    }
    b.geo(M.roof, cached('tk-spire', () => new ConeGeometry(3.1, 9, 4)), lm(l, x, 24.35 + 4.5, 9.5, Math.PI / 4), SLATE);
    b.box(M.stucco, lm(l, x, 34, 9.5), 0.12, 1.2, 0.12, [1.6, 1.25, 0.45]);
    b.shadowBox(lm(l, x, 12, 9.5), 3.8, 24, 4);
  }
  b.light(lp(l, 0, 3.5, 10.5), 0xffb060, 12, 10, 0.15, 3.5);
  b.shadowBox(lm(l, 0, NH / 2, 0), 16, NH, 20);
  b.shadowBox(lm(l, 0, NH + 6, -3.5), 9, 12, 9);
}

/**
 * V1 B cutaway lids (landmark frame: x, z centre, w along x, d along z) of the flagged landmarks, next to
 * their builders. Thomaskirche: nave, transept, two towers and the apse as a half disc.
 */
const CAPS: Partial<Record<LandmarkKind, Array<{ x: number; z: number; w: number; d: number }>>> = {
  thomaskirche: [{ x: 0, z: 2.5, w: 9, d: 10 }, { x: 0, z: -3.5, w: 16, d: 6 }, { x: -5.6, z: 9.5, w: 3.8, d: 4 }, { x: 5.6, z: 9.5, w: 3.8, d: 4 }],
  bethanien: [{ x: 0, z: 0, w: 12, d: 20 }],
  // Walk-under stations: no lid, the hero stands under the cut.
  u1station: [],
};

/** Cap polygons of a flagged landmark (world ground plane); unlisted kinds get their footprint. */
export function landmarkCaps(l: Landmark): Pt[][] {
  const rect = (x: number, z: number, w: number, d: number): Pt[] => { const p = lp(l, x, 0, z); return rectPoly({ x: p.x, z: p.z, rot: l.rot, hw: w / 2, hd: d / 2 }); };
  const out = (CAPS[l.kind] ?? [{ x: 0, z: 0, w: l.hx * 2, d: l.hz * 2 }]).map((c) => rect(c.x, c.z, c.w, c.d));
  if (l.kind === 'thomaskirche') {
    // Apse: half disc of radius 3.6 behind the transept (local -z).
    const apse: Pt[] = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + (i / 8) * Math.PI, p = lp(l, 3.6 * Math.sin(a), 0, -6.5 + 3.6 * Math.cos(a)); apse.push([p.x, p.z]); }
    out.push(apse);
  }
  return out;
}

/** Bethanien: long yellow-brick hospital, slate roof, two slim towers flanking the entrance on the visible (south) side. */
function buildBethanien(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X, W = l.hx * 2, D = l.hz * 2, H = 11.5, SLATE: RGB = [0.48, 0.52, 0.6], SAND: RGB = [1.15, 1.02, 0.82];
  walls(b, { x: l.x, z: l.z, rot: l.rot, w: W, d: D }, X.yellow, H, [1.3, 4.8, 8.3], 1847, 0.08, 3);
  for (const y of [4.1, 7.6]) b.box(M.stucco, lm(l, 0, y, 0), W + 0.2, 0.25, D + 0.2, SAND);
  b.box(M.stucco, lm(l, 0, H + 0.2, 0), W + 0.5, 0.4, D + 0.5, SAND);
  b.geo(M.roof, gableRoof(D, W, 4), lm(l, 0, H + 0.4, 0, Math.PI / 2), SLATE);
  b.geo(X.yellow, gableEnds(D, W, 4), lm(l, 0, H + 0.4, 0, Math.PI / 2));
  // Entrance side: local -x (south in the data). Towers stay inside the footprint.
  const fx = -W / 2;
  for (const z of [-2.6, 2.6]) {
    b.box(X.yellow, lm(l, fx + 1.3, 10.5, z), 2.6, 21, 2.6);
    b.box(M.stucco, lm(l, fx + 1.3, 21.1, z), 3, 0.3, 3, SAND);
    for (const ry of [-Math.PI / 2, 0, Math.PI]) {
      const o = ry === 0 ? [0, 1.32] : ry === Math.PI ? [0, -1.32] : [-1.32, 0];
      archOpening(b, lm(l, fx + 1.3 + o[0]!, 16.5, z + o[1]!, ry), 0.9, 2.8, M.brick, [0.12, 0.09, 0.08], null);
    }
    b.geo(M.roof, cached('bt-cap', () => new ConeGeometry(2, 5.5, 4)), lm(l, fx + 1.3, 21.25 + 2.75, z, Math.PI / 4), SLATE);
    b.box(M.stucco, lm(l, fx + 1.3, 27.2, z), 0.1, 0.8, 0.1, [1.6, 1.25, 0.45]);
    b.shadowBox(lm(l, fx + 1.3, 10.5, z), 2.6, 21, 2.6);
  }
  // Portal between the towers.
  archOpening(b, lm(l, fx - 0.03, 0, 0, -Math.PI / 2), 2.4, 3.8, M.door, [0.6, 0.5, 0.45], M.stucco, SAND);
  b.box(M.stucco, lm(l, fx - 0.2, 4.8, 0), 0.4, 0.5, 4, SAND);
  b.light(lp(l, fx - 1.5, 3, 0), 0xffb060, 12, 10, 0.1, 3.5);
  b.shadowBox(lm(l, 0, H / 2, 0), W, H, D);
}

/** Georg-von-Rauch-Haus: a squatted Altbau (Köpenick lot builder), banners from the windows. */
function buildRauchhaus(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const X = c.X, rng = new Rng(1971);
  const lot: Lot = { kind: 'altbau', x: l.x, z: l.z, rot: l.rot, w: l.hx * 2, d: l.hz * 2, floors: 3, seed: 1971 };
  buildAltbauLot(b, lot, c.m);
  const H = GROUND_H + 3 * FLOOR_H;
  b.solid.excludeOccluder(() => {
    // Front (east) and the long side the camera sees (south, facade 3 of the lot frame).
    const sides = blockFacades(lot);
    const rows: Array<[number, number, number]> = [[3, BANNER.rauchhaus, H - 1.2], [3, BANNER.besetzt, GROUND_H + 1.0], [0, BANNER.bleiben, GROUND_H + FLOOR_H + 1.2], [2, BANNER.abriss, GROUND_H + 0.9]];
    for (const [i, row, y] of rows) {
      const s = sides[i]!, run = new Run({ id: 'rh', style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1], depth: 1, floors: 0, tone: 'cream', features: [], seed: 1 });
      banner(b, X, row, run.mat(s.len / 2 + rng.range(-1, 1), y, 0.05), Math.min(s.len - 2, 7.5), rng);
      for (let k = 0; k < 3; k++) tag(b, run.mat(rng.range(1, s.len - 1), rng.range(0.6, 2.2), 0.06), rng.range(1, 2), rng);
    }
  });
  // A fire barrel glow at the door, the house is alive.
  b.light(lp(l, 0, 1.6, l.hz + 1.5), 0xff8a3c, 18, 11, 1, 5, { halo: 0.5 });
}

/** Neues Kreuzberger Zentrum: a 10-storey concrete slab in two angled wings (Plattenbau lot builder), sign on the roof. */
function buildNkz(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const X = c.X, M = c.mm, floors = 9, tilt = 0.14;
  const d = 11, w = l.hx - 0.2;
  for (const side of [-1, 1]) {
    const p = lp(l, side * (w / 2 + 0.1), 0, 0);
    buildAltbauLot(b, { kind: 'platte', x: p.x, z: p.z, rot: l.rot - side * tilt, w, d, floors, seed: 1974 + side }, c.m);
  }
  const H = GROUND_H + floors * FLOOR_H + PARAPET;
  // Ground-floor arcade of shops along the front, and the ZENTRUM KREUZBERG letters on the roof edge.
  const front = lm(l, 0, 0, d / 2 + 1.4);
  b.box(M.concrete, sub(front, 0, 3.6, 0), l.hx * 2 - 2, 0.35, 2.6, [1.0, 0.98, 0.95]);
  for (let x = -l.hx + 2; x <= l.hx - 2; x += 4.5) b.box(M.concrete, sub(front, x, 1.8, 1.0), 0.4, 3.6, 0.4, [0.95, 0.93, 0.9]);
  b.box(M.iron, lm(l, 0, H + 1.4, 0.4), 15, 0.12, 0.12, [0.6, 0.6, 0.6]);
  for (const x of [-6.5, 0, 6.5]) b.box(M.iron, lm(l, x, H + 0.7, 0.4), 0.12, 1.4, 0.12, [0.6, 0.6, 0.6]);
  sign(b, X, SIGN.nkz, lm(l, 0, H + 1.3, 0.5), 14, 1.75);
  b.light(lp(l, 0, 3.2, d / 2 + 3), 0xffc890, 12, 10, 0.05, 4.5);
}

/** GDR watchtower BT-11: square shaft, octagonal glazed cab, searchlight (halo, beam card, cold ground decal; no light). */
function buildWachturm(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X, S = Math.min(2.4, l.hx * 1.5), HS = 9.6, G: RGB = [1.25, 1.24, 1.2];
  b.box(M.concrete, lm(l, 0, HS / 2, 0), S, HS, S, G);
  for (let y = 1.2; y < HS; y += 1.2) b.box(M.concrete, lm(l, 0, y, 0), S + 0.04, 0.03, S + 0.04, [0.8, 0.8, 0.78]);
  b.box(M.door, lm(l, 0, 1, S / 2 + 0.01), 0.8, 2, 0.04);
  const oct = (r: number, hgt: number): BufferGeometry => cached(`bt-oct-${r}-${hgt}`, () => new CylinderGeometry(r, r, hgt, 8));
  b.geo(M.concrete, oct(2.0, 0.9), lm(l, 0, HS + 0.45, 0, Math.PI / 8), G);
  b.geo(M.glass, oct(1.95, 1.1), lm(l, 0, HS + 1.45, 0, Math.PI / 8), [1.2, 1.5, 1.5]);
  b.geo(M.concrete, oct(2.3, 0.3), lm(l, 0, HS + 2.15, 0, Math.PI / 8), G);
  // Searchlight on the roof, aimed over the death strip (north-west of the tower, towards the Spree).
  const aim = new Vector3(-7, 0, -9);
  const yaw = Math.atan2(aim.x, aim.z);
  const head = lp(l, 0, HS + 2.75, 0);
  b.geo(M.iron, cached('bt-lamp', () => new CylinderGeometry(0.32, 0.38, 0.6, 10).rotateX(Math.PI / 2)), lm(l, 0, HS + 2.75, 0, yaw).multiply(new Matrix4().makeRotationX(0.45)), [0.7, 0.7, 0.7]);
  b.geo(M.lampGlass, cached('bt-lens', () => new CircleGeometry(0.3, 12)), lm(l, 0, HS + 2.75, 0, yaw).multiply(new Matrix4().makeRotationX(0.45)).multiply(new Matrix4().setPosition(0, 0, 0.31)), [1.3, 1.6, 2.0]);
  const glows = b.glows.of(X.cold);
  for (const [rx, ry] of [[0, 0], [0, Math.PI / 2], [-Math.PI / 2, 0]] as const) {
    glows.add(cached('bt-halo', () => new PlaneGeometry(2.2, 2.2)), new Matrix4().makeRotationY(ry).multiply(new Matrix4().makeRotationX(rx)).setPosition(head.x, head.y, head.z));
  }
  const target = lp(l, aim.x, 0, aim.z);
  const dir = target.clone().sub(head), len = dir.length();
  // Beam: two crossed cards from the lamp to the target, wide at the ground.
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir.clone().normalize());
  for (const r of [0, Math.PI / 2]) {
    const card = cached(`bt-beam-${len.toFixed(1)}`, () => {
      const g = new PlaneGeometry(1, 1, 1, 1);
      const pos = g.getAttribute('position');
      // Narrow at the top (lamp), wide at the bottom: a cone section; y from 0 (lamp) down to -len.
      for (let i = 0; i < pos.count; i++) {
        const top = pos.getY(i) > 0;
        pos.setXYZ(i, pos.getX(i) * (top ? 0.5 : 4.2), top ? 0 : -len, 0);
      }
      return g;
    });
    b.glows.of(X.beam).add(card, new Matrix4().compose(head, q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), r)), new Vector3(1, 1, 1)));
  }
  glows.add(cached('bt-pool', () => new PlaneGeometry(5, 8).rotateX(-Math.PI / 2)), new Matrix4().makeRotationY(yaw + l.rot).setPosition(target.x, 0.05, target.z));
  b.shadowBox(lm(l, 0, HS / 2, 0), S, HS, S);
}

/** Görlitzer Bahnhof ruin: broken yellow-brick hall, empty arched windows, collapsed truss, rubble; buffer stops at its east side. */
function buildGoerlitzer(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  const M = c.mm, X = c.X, rng = new Rng(1866), W = l.hx * 2, D = l.hz * 2, Y = X.yellow, SAND: RGB = [1.1, 1.0, 0.82];
  const DARK: RGB = [0.1, 0.08, 0.07];
  // Front (south, camera side) and back walls: piers with ragged heights, arches where both piers stand.
  for (const [z, ry, n] of [[D / 2 - 0.35, 0, 1], [-D / 2 + 0.35, Math.PI, 0.7]] as Array<[number, number, number]>) {
    const bays = 6, bw = W / bays;
    const hts = Array.from({ length: bays + 1 }, () => rng.range(4, 11) * n);
    for (let i = 0; i <= bays; i++) {
      const x = -W / 2 + i * bw, hgt = hts[i]!;
      b.box(Y, lm(l, x + (i === 0 ? 0.6 : i === bays ? -0.6 : 0), hgt / 2, z), 1.2, hgt, 0.7);
      if (i < bays) {
        const lo = Math.min(hts[i]!, hts[i + 1]!), xc = x + bw / 2;
        b.box(Y, lm(l, xc, 0.6, z), bw - 1.2, 1.2, 0.7);
        if (lo > 7.2) {
          b.geo(M.stucco, ringGeo((bw - 1.2) / 2, 0.45), lm(l, xc, 5.6, z + (ry ? -0.36 : 0.36), ry), SAND);
          const cap = rng.range(0.5, lo - 7.2 + 0.6);
          b.box(Y, lm(l, xc, 5.6 + (bw - 1.2) / 2 + cap / 2 + 0.3, z), bw - 1.2, cap, 0.7);
        } else if (rng.next() < 0.5) {
          b.geo(M.brick, archGeo(bw - 1.4, 5.8), lm(l, xc, 1.2, z + (ry ? 0.2 : -0.2), ry), DARK);
        }
      }
    }
    b.box(M.stucco, lm(l, 0, 1.25, z), W, 0.15, 0.85, SAND);
  }
  // Gable ends, broken.
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 0.35);
    for (let z = -D / 2 + 1; z < D / 2 - 0.5; z += 2) {
      const hgt = rng.range(2.5, 8);
      b.box(Y, lm(l, x, hgt / 2, z + 1), 0.7, hgt, 2);
    }
  }
  // Collapsed iron truss, charred beams, rubble heaps (Köpenick rubble prop).
  for (let i = 0; i < 4; i++) {
    b.box(M.rust, sub(lm(l, rng.range(-W / 3, W / 3), rng.range(1, 3), rng.range(-1.5, 1.5)), 0, 0, 0, rng.range(-0.4, 0.4), rng.range(-0.5, 0.5), rng.range(-0.3, 0.3)), rng.range(6, 10), 0.3, 0.3, [0.6, 0.55, 0.5]);
  }
  for (let i = 0; i < 4; i++) {
    const p = lp(l, -W / 2 + 3 + i * (W - 6) / 3, 0, rng.range(-1.5, 1.5));
    buildProp(b, { kind: 'rubble', x: p.x, z: p.z, rot: rng.range(0, 6), size: rng.range(1.4, 2.2) }, rng);
  }
  b.shadowBox(lm(l, 0, 4, 0), W, 8, D);
}

/**
 * Görli: the old freight yard. Three tracks run from the ruin into the park, rails and half-sunk
 * sleepers in the grass, broken platform edges, buffer stops against the ruin. Flat and low, no
 * colliders (the buffer stops stand inside the ruin's footprint).
 */
function buildGoerliYard(c: Ctx, l: Landmark): void {
  const M = c.mm, rng = new Rng(1868);
  // Local frame of the ruin: +z is the park axis (front), x across.
  const at = (x: number, z: number): { x: number; z: number; y: number } => { const p = lp(l, x, 0, z); return { x: p.x, z: p.z, y: c.ground(p.x, p.z) }; };
  const piece = (x: number, z: number, y: number, ry: number): Matrix4 => new Matrix4().makeRotationY(l.rot + ry).setPosition(x, y, z);
  for (const [ti, tx] of [-3.5, 0, 3.5].entries()) {
    const end = l.hz + 56 - ti * 10 - rng.range(0, 8);
    for (let z = l.hz; z < end; z += 4) {
      if (rng.next() < 0.08) continue;
      const p = at(tx, z + 2), b = c.chunkOf(p.x, p.z);
      // The old tracks stay in the park: they end where the grass ends (no rails across a street).
      if (areaAt(c.m, p.x, p.z)?.id !== 'goerli') continue;
      for (const r of [-0.72, 0.72]) {
        const q = at(tx + r, z + 2);
        b.box(M.railSteel, piece(q.x, q.z, q.y + 0.05, rng.range(-0.01, 0.01)), 0.07, 0.08, 4, [0.55, 0.42, 0.34]);
      }
      for (let s = 0.3; s < 4; s += 1.2) {
        if (rng.next() < 0.25) continue;
        const q = at(tx, z + s);
        b.box(M.darkWood, piece(q.x, q.z, q.y + 0.01, rng.range(-0.1, 0.1)), 2.4, 0.1, 0.25, [0.6, 0.5, 0.45]);
      }
    }
    // Buffer stop against the front wall: bent rails and a red and white beam.
    const p = at(tx, l.hz + 0.7), b = c.chunkOf(p.x, p.z);
    for (const r of [-0.72, 0.72]) {
      const q = at(tx + r, l.hz + 0.7);
      b.box(M.rust, piece(q.x, q.z, q.y + 0.5, 0).multiply(new Matrix4().makeRotationX(-0.7)), 0.12, 0.12, 1.4, [0.7, 0.6, 0.55]);
    }
    b.box(M.enamel, piece(p.x, p.z, p.y + 0.9, 0), 2.2, 0.35, 0.3, [1.3, 0.3, 0.25]);
  }
  // Broken platform edges beside the outer tracks.
  for (const px of [-6.2, 6.2]) {
    for (let z = l.hz + 2; z < l.hz + 32; z += 3) {
      if (rng.next() < 0.3) continue;
      const p = at(px, z + 1.5), b = c.chunkOf(p.x, p.z);
      if (areaAt(c.m, p.x, p.z)?.id !== 'goerli') continue;
      b.box(M.concrete, piece(p.x, p.z, p.y + 0.12 - rng.range(0, 0.1), rng.range(-0.04, 0.04)), 1.1, 0.32, rng.range(2.2, 2.9), [1.05, 1.03, 0.98]);
    }
  }
}

function buildXLandmark(c: Ctx, b: ChunkBuilder, l: Landmark): void {
  switch (l.kind) {
    case 'oberbaum': buildOberbaum(c, b, l); break;
    case 'warschauer': buildWarschauer(c, b, l); break;
    case 'ostbahnhof': buildOstbahnhof(c, b, l); break;
    case 'u1station': buildU1Station(c, b, l); break;
    case 'thomaskirche': buildThomaskirche(c, b, l); break;
    case 'bethanien': buildBethanien(c, b, l); break;
    case 'rauchhaus': buildRauchhaus(c, b, l); break;
    case 'nkz': buildNkz(c, b, l); break;
    case 'wachturm': buildWachturm(c, b, l); break;
    case 'goerlitzer': buildGoerlitzer(c, b, l); break;
    default: break;
  }
}

// ---------------------------------------------------------------- Kreuzberg dressing on lots

/**
 * Graffiti on the ground floor of about half the Kreuzberg fronts and squat banners on about one in
 * six intact Altbau fronts (1981: the Instandbesetzer). East Berlin lots stay clean. Cards only.
 */
function dressLots(c: Ctx, lots: Lot[], lotCut: (l: Lot) => { id: number; y: number } | undefined): void {
  for (const l of lots) {
    if (l.kind === 'tree' || l.kind === 'special' || l.kind === 'house') continue;
    const area = areaAt(c.m, l.x, l.z);
    if (!area || !WEST_AREAS.has(area.id)) continue;
    const rng = new Rng(l.seed * 31 + 7), b = c.chunkOf(l.x, l.z);
    const s = blockFacades(l)[0]!;
    const run = new Run({ id: 'xd', style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1], depth: 1, floors: 0, tone: 'cream', features: [], seed: 1 });
    const y0 = c.ground(l.x, l.z);
    // V1 B cutaway: the dressing of a cut lot belongs to its part, so it goes with the facade.
    const cut = lotCut(l);
    const dress = (fn: () => void): void => (cut ? b.cut(cut.id, cut.y, () => b.on(y0, fn)) : b.on(y0, fn));
    dress(() => {
      if (rng.next() < 0.6) for (let k = 0; k < 1 + rng.int(3); k++) tag(b, run.mat(rng.range(1, s.len - 1), rng.range(0.5, 2.3), 0.07), rng.range(1.1, 2.4), rng);
      if (!l.ruin && l.kind === 'altbau' && l.floors > 0 && rng.next() < 0.18) {
        const y = GROUND_H + rng.int(l.floors) * FLOOR_H + 0.25;
        banner(b, c.X, rng.pick([BANNER.besetzt, BANNER.besetzt, BANNER.bleiben, BANNER.abriss]), run.mat(s.len / 2 + rng.range(-1.5, 1.5), y, 0.05), Math.min(s.len - 2, rng.range(5, 7.5)), rng);
      }
    });
  }
}

// ---------------------------------------------------------------- entry

/** M15 hook from `buildMapWorld`: Wall, viaducts, Xhain landmarks and Kreuzberg dressing. */
export function buildXhainWorld(materials: Materials, m: MapDef, lots: Lot[], mm: MapMats, chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number, cutOf: (l: Landmark) => CutPart | undefined = () => undefined, lotCut: (l: Lot) => { id: number; y: number } | undefined = () => undefined): void {
  const land = m.landmarks.filter((l) => XHAIN_KINDS.has(l.kind));
  if (!m.walls?.length && !m.viaducts?.length && !m.railYards?.length && !land.length) return;
  const decks = m.terraces.filter((t) => t.bridge);
  const low = (x: number, z: number): number => (decks.some((t) => inPoly(t.poly, x, z) || t.stairs.some((s) => Math.hypot(x - s.x, z - s.z) < s.len / 2 + s.width)) ? 0 : ground(x, z));
  const c: Ctx = { mm, X: xhainMats(materials), m, chunkOf, ground, low };
  // M16: hedges, fences and the Zoo platform are Charlottenburg's (`charlottenburg-world.ts`); only the Wall is drawn here.
  for (const w of m.walls ?? []) if (!w.kind) buildWall(c, w);
  for (const v of m.viaducts ?? []) if (v.kind === 'hochbahn') buildHochbahn(c, v);
  for (const r of m.railYards ?? []) buildRailYard(c, r);
  for (const t of m.terraces) if (t.bridge && !t.platform) buildDeckBridge(c, t);
  if (m.areas.some((a) => a.id === 'grenzstreifen')) buildGrenzstreifen(c);
  const base = (x: number, z: number, r: number): number => Math.min(ground(x, z), ground(x - r, z - r), ground(x + r, z - r), ground(x - r, z + r), ground(x + r, z + r));
  for (const l of land) {
    const b = chunkOf(l.x, l.z);
    const y0 = l.walkUnder || l.kind === 'oberbaum' ? 0 : base(l.x, l.z, Math.max(l.hx, l.hz));
    const cut = cutOf(l), build = (): void => b.on(y0, () => b.wearLandmark(l, () => buildXLandmark(c, b, l)));
    b.solid.captureOccluder(cut ? () => b.cut(cut.id, y0 + cut.h, build, landmarkCaps(l)) : build);
    if (l.kind === 'goerlitzer') buildGoerliYard(c, l);
  }
  if (m.id === 'xhain') dressLots(c, lots, lotCut);
}
