// M16 Charlottenburg step 4: City West: Bahnhof Zoo, the Zoo, the church square, the Tauentzien.
// Built from pre-1930 photos (`docs/maps/landmarks.md`, `docs/tasks/m16-charlottenburg.md`). This file owns these kinds:
//   zoobahnhof loewentor elefantentor aquarium musikpavillon antilopenhaus
//   ufapalast capitol gedaechtniskirche romanischescafe kadewe wittenbergplatz
//
// Contract: `buildCitywest` returns true when it drew the landmark, false otherwise; `buildCharlottenburgLandmark`
// asks this file, then the other two, then falls back to the step 2 massing in `charlottenburg-world.ts`.
// Colliders stay in `src/data`; this only draws, inside each footprint and `OPEN_PARTS`. Check a kind with
// `tools/landmark-sheet.mjs`.
//
// Photo cues (* = below 5 m, what the game camera sees): see the header of each builder.
//
// Cost: one new material, the sign atlas (`paintSigns`: 1024 × 1280 colour plus emissive map, about 14 MB of GPU
// memory with mipmaps, made once per map), for the period lettering, the bulb letters of the cinemas, film
// billboards, shop fascias, the Aquarium reliefs and the Ufa emblems; it adds one draw call in each chunk that
// shows a sign (the sights sit in about eight chunks), glows by its emissive map, no light. Everything else merges into the shared batches (stucco, brick, slate, enamel, iron, glass, concrete, dark wood, linen,
// lamp glass, window atlas). No lights. Triangles (measured on the landmark sheet, wear included): Bahnhof Zoo
// 4.9k, Löwentor 1.4k, Elefantentor 2.1k, Aquarium 0.5k, Musikpavillon 1.5k, Antilopenhaus 3.8k, Ufa-Palast 1.2k,
// Capitol 1.9k, Gedächtniskirche 5.3k, Romanisches Café 2.6k, KaDeWe 9.2k, Wittenbergplatz 1.0k. Only type imports from `charlottenburg-world.ts` (it imports this file).
import { CircleGeometry, ConeGeometry, CylinderGeometry, Matrix4, MeshStandardMaterial, RingGeometry, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry, type Material, type Texture } from 'three';
import { OPEN_PARTS, type LandmarkKind } from '../data/map';
import { Rng } from '../sim/math';
import { archHead, cached, ENDS, frameOf, frustum, pane, SLOPES, sub, type Frame } from './landmarks';
import type { MapMats } from './map-world';
import type { LitMaterial } from './materials';
import { canvas, toTexture } from './paint';
import type { Ctx, RGB } from './charlottenburg-world';

/** The kinds this file owns (one builder each once step 4 is done). */
export const CITYWEST_KINDS: ReadonlySet<LandmarkKind> = new Set<LandmarkKind>(['zoobahnhof', 'loewentor', 'elefantentor', 'aquarium', 'musikpavillon', 'antilopenhaus', 'ufapalast', 'capitol', 'gedaechtniskirche', 'romanischescafe', 'kadewe', 'wittenbergplatz']);

// ---------------------------------------------------------------- colours (on the shared base materials)

/** Stucco is a tan base, enamel a light grey metal, slate blue-grey, iron near black: these tints give 1920. */
const T = {
  sand: [1.0, 0.94, 0.8], sandDark: [0.82, 0.76, 0.64], stone: [0.92, 0.9, 0.86], grey: [0.78, 0.78, 0.8], cream: [1.12, 1.06, 0.92],
  tuff: [1.04, 1.06, 1.12], tuffDark: [0.76, 0.77, 0.81], tuffLight: [1.16, 1.18, 1.22], slate: [0.62, 0.66, 0.74], copper: [0.5, 0.86, 0.74],
  iron: [0.55, 0.57, 0.6], ironDark: [0.32, 0.33, 0.35], brick: [1.0, 0.68, 0.56], brickDark: [0.74, 0.5, 0.42], gold: [1.15, 0.92, 0.5],
  red: [0.8, 0.24, 0.18], teal: [0.55, 0.95, 0.88], violet: [0.5, 0.36, 0.62], berry: [0.68, 0.2, 0.32], pearl: [1.25, 1.22, 1.18],
  rubble: [0.8, 0.76, 0.7], white: [1.3, 1.27, 1.2], bronze: [0.62, 0.5, 0.34], wood: [0.7, 0.55, 0.42],
} satisfies Record<string, RGB>;

// ---------------------------------------------------------------- sign atlas

/** Rows of the 1024 × 1280 atlas (10 rows of 128 px); `cell` splits a row. */
const ROW = { kadewe: 0, ufa: 1, station: 2, cafe: 3, pair: 4, ubahn: 5, posters: 6, shops: 7, reliefs: 8, emblems: 9 } as const;
const ROWS = 10;

function fit(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font: string): void {
  let s = size;
  g.font = font.replace('%', String(s));
  while (g.measureText(text).width > maxW && s > 12) g.font = font.replace('%', String(--s));
  g.fillText(text, x, y);
}

const SERIF = 'bold %px Georgia, "Times New Roman", serif';
const SANS = 'bold %px "Arial Narrow", Arial, sans-serif';

/** `glow` paints the emissive version: lit letters and bulbs bright, stone and enamel black or faint. */
function paintSigns(glow: boolean): Texture {
  // `br` only picks dead bulbs, so both maps get the same pattern (`rng` is only used for grime, colour map only).
  const S = 1024, H = 128, rng = new Rng(1920), br = new Rng(1925);
  const [c, g] = canvas(S, H * ROWS);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, H * ROWS);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const band = (x: number, y: number, w: number, col: string, lit = '#000'): void => { g.fillStyle = glow ? lit : col; g.fillRect(x, y, w, H); };
  const text = (t: string, x: number, y: number, w: number, size: number, font: string, col: string, lit: string): void => {
    g.fillStyle = glow ? lit : col;
    fit(g, t, x + w / 2, y + H / 2 + 4, w - 40, size, font);
  };
  /** Bulb letters: the text sampled on a 7 px grid, a bulb per lit cell, about one in twelve dead. */
  const bulbs = (t: string, x: number, y: number, w: number, size: number, col: string): void => {
    const [, tg] = canvas(w, H);
    tg.fillStyle = '#fff';
    tg.textAlign = 'center';
    tg.textBaseline = 'middle';
    fit(tg, t, w / 2, H / 2 + 4, w - 40, size, SANS);
    const d = tg.getImageData(0, 0, w, H).data, step = 7;
    for (let yy = 4; yy < H; yy += step) for (let xx = 4; xx < w; xx += step) {
      if (d[(yy * w + xx) * 4 + 3]! < 128) continue;
      const dead = br.next() < 0.08;
      g.fillStyle = glow ? (dead ? '#000' : col) : dead ? '#3a3530' : '#f6ecd0';
      g.beginPath(); g.arc(x + xx, y + yy, 2.8, 0, Math.PI * 2); g.fill();
    }
  };
  const frame = (x: number, y: number, w: number, col: string): void => {
    if (glow) return;
    g.strokeStyle = col;
    g.lineWidth = 5;
    g.strokeRect(x + 6, y + 6, w - 12, H - 12);
  };
  const grime = (x: number, y: number, w: number, n: number): void => {
    if (glow) return;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(${rng.next() < 0.5 ? '40,34,28' : '90,80,64'},${rng.range(0.05, 0.18)})`;
      g.fillRect(x + rng.range(0, w), y + rng.range(0, H), rng.range(4, 26), rng.range(2, 10));
    }
  };
  // KaDeWe: gilded capitals on a dark bronze band (lit from behind at night).
  let y = ROW.kadewe * H;
  band(0, y, S, '#2b2620');
  frame(0, y, S, '#8a7a58');
  text('KAUFHAUS DES WESTENS', 0, y, S, 86, SERIF, '#e2cf98', '#d8c896');
  grime(0, y, S, 120);
  // Ufa-Palast: a bulb sign on a black band with a silver rim.
  y = ROW.ufa * H;
  band(0, y, S, '#15121a');
  frame(0, y, S, '#b8bcc4');
  bulbs('UFA-PALAST AM ZOO', 0, y, S, 104, '#fff2d0');
  // Station name board: white enamel, black letters, dark rim; faint at night.
  y = ROW.station * H;
  band(0, y, S, '#ebe6da', '#1e1d1a');
  frame(0, y, S, '#1c2230');
  text('ZOOLOGISCHER GARTEN', 0, y, S, 82, SANS, '#16181c', '#000');
  grime(0, y, S, 80);
  // Romanisches Café: pearl letters on violet (lit).
  y = ROW.cafe * H;
  band(0, y, S, '#2e1a36');
  frame(0, y, S, '#c9c2d6');
  text('ROMANISCHES CAFÉ', 0, y, S, 84, 'italic bold %px Georgia, serif', '#efe7da', '#e4d6ff');
  // Pair: Capitol bulbs | Aquarium carved in stone.
  y = ROW.pair * H;
  band(0, y, S / 2, '#141018');
  frame(0, y, S / 2, '#b8bcc4');
  bulbs('CAPITOL', 0, y, S / 2, 112, '#f4f6ff');
  band(S / 2, y, S / 2, '#c2b69c');
  text('AQUARIUM', S / 2, y, S / 2, 84, SERIF, '#3b3226', '#000');
  grime(S / 2, y, S / 2, 70);
  // U-Bahn: Untergrundbahn in bronze on stone | the Zoo's gate lettering, gilt on dark iron.
  y = ROW.ubahn * H;
  band(0, y, S / 2, '#cfc4aa');
  text('UNTERGRUNDBAHN', 0, y, S / 2, 70, SERIF, '#3a2e20', '#000');
  grime(0, y, S / 2, 60);
  band(S / 2, y, S / 2, '#1b1e1d', '#000');
  text('ZOOLOGISCHER GARTEN', S / 2, y, S / 2, 56, SERIF, '#d4be84', '#6a5c3c');
  // Four film billboards (landscape, as hung over cinema canopies): a figure and a title each.
  y = ROW.posters * H;
  const posters: Array<[string, string, string]> = [['PREMIERE', '#4a2a5e', '#e8d6ff'], ['DIE DIVA', '#1f4a4c', '#d8f4ee'], ['REVUE', '#6a1e34', '#ffe2ea'], ['HEUTE 8 UHR', '#2a2e3a', '#e6e8f0']];
  posters.forEach(([t, bg, fg], i) => {
    const x = i * 256;
    const grd = g.createLinearGradient(x, y, x + 256, y + H);
    grd.addColorStop(0, glow ? '#000' : bg);
    grd.addColorStop(1, glow ? '#111' : '#0c0a10');
    g.fillStyle = grd;
    g.fillRect(x, y, 256, H);
    g.globalAlpha = glow ? 0.55 : 1;
    // A dancer or a face in silhouette.
    g.fillStyle = fg;
    g.beginPath(); g.arc(x + 54, y + 38, 15, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x + 30, y + 118); g.lineTo(x + 50, y + 54); g.lineTo(x + 60, y + 54); g.lineTo(x + 82, y + 118); g.fill();
    if (i % 2) { g.beginPath(); g.moveTo(x + 58, y + 62); g.lineTo(x + 100, y + 30); g.lineTo(x + 104, y + 36); g.lineTo(x + 62, y + 70); g.fill(); }
    g.textAlign = 'center';
    fit(g, t, x + 166, y + 64, 160, 40, SANS);
    g.fillRect(x + 100, y + 92, 132, 3);
    g.globalAlpha = 1;
    if (!glow) { g.strokeStyle = '#c8c8d0'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, 250, H - 6); }
    grime(x, y, 256, 18);
  });
  // Shop fascias: gilt letters on black glass.
  y = ROW.shops * H;
  /** Six cells: four shop fascias, the station entrance, the U-Bahn door panel. */
  const SH = S / 6;
  ['MODEN', 'HÜTE', 'TABAK', 'KONDITOREI', 'EINGANG', 'WITTENBERGPLATZ'].forEach((t, i) => {
    band(i * SH, y, SH, '#101214');
    frame(i * SH, y, SH, '#9a8a62');
    text(t, i * SH, y, SH, 56, SERIF, '#d9c48c', '#6e6040');
  });
  // Aquarium relief panels (terracotta, 1913): a saurian, fish, a crocodile, a turtle on a dark red ground.
  y = ROW.reliefs * H;
  for (let i = 0; i < 4; i++) {
    const x = i * 256;
    g.fillStyle = glow ? '#000' : '#8a3a2a';
    g.fillRect(x, y, 256, H);
    if (glow) continue;
    g.strokeStyle = '#c9a77a';
    g.lineWidth = 6;
    g.strokeRect(x + 5, y + 5, 246, H - 10);
    const lt = '#d98a5a', dk = '#5a2218';
    for (const [col, o] of [[dk, 3], [lt, 0]] as const) {
      g.fillStyle = col;
      if (i === 0) {
        // Iguanodon upright: tail, body, neck, head, legs.
        g.beginPath(); g.ellipse(x + 120 + o, y + 70 + o, 34, 24, -0.6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(x + 96 + o, y + 84 + o); g.lineTo(x + 30 + o, y + 112 + o); g.lineTo(x + 100 + o, y + 96 + o); g.fill();
        g.beginPath(); g.ellipse(x + 156 + o, y + 32 + o, 16, 10, 0.3, 0, Math.PI * 2); g.fill();
        g.fillRect(x + 140 + o, y + 38 + o, 12, 26);
        g.fillRect(x + 112 + o, y + 88 + o, 12, 28); g.fillRect(x + 132 + o, y + 86 + o, 12, 30);
      } else if (i === 1) {
        for (const [fx, fy, r] of [[70, 50, 22], [150, 76, 26], [200, 40, 16], [110, 98, 14]] as const) {
          g.beginPath(); g.ellipse(x + fx + o, y + fy + o, r * 1.6, r * 0.7, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(x + fx - r * 1.4 + o, y + fy + o); g.lineTo(x + fx - r * 2.3 + o, y + fy - r * 0.7 + o); g.lineTo(x + fx - r * 2.3 + o, y + fy + r * 0.7 + o); g.fill();
        }
      } else if (i === 2) {
        g.beginPath(); g.ellipse(x + 128 + o, y + 70 + o, 70, 14, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(x + 60 + o, y + 66 + o); g.lineTo(x + 14 + o, y + 76 + o); g.lineTo(x + 60 + o, y + 78 + o); g.fill();
        g.beginPath(); g.moveTo(x + 196 + o, y + 64 + o); g.lineTo(x + 246 + o, y + 70 + o); g.lineTo(x + 196 + o, y + 78 + o); g.fill();
        for (const lx of [90, 110, 150, 170]) g.fillRect(x + lx + o, y + 78 + o, 8, 18);
      } else {
        g.beginPath(); g.ellipse(x + 128 + o, y + 66 + o, 54, 34, 0, Math.PI, Math.PI * 2); g.fill();
        g.fillRect(x + 74 + o, y + 64 + o, 108, 10);
        g.beginPath(); g.arc(x + 194 + o, y + 58 + o, 12, 0, Math.PI * 2); g.fill();
        for (const lx of [84, 160]) g.fillRect(x + lx + o, y + 72 + o, 14, 20);
      }
    }
    grime(x, y, 256, 30);
  }
  // Emblems: the Ufa rhombus (lit) | a round film portrait for the arch | the Zoo's gilt cartouche | spare.
  y = ROW.emblems * H;
  g.fillStyle = '#000';
  g.fillRect(0, y, 256, H);
  g.fillStyle = glow ? '#fff4d8' : '#f2ead8';
  g.beginPath(); g.moveTo(128, y + 6); g.lineTo(250, y + 64); g.lineTo(128, y + 122); g.lineTo(6, y + 64); g.closePath(); g.fill();
  g.fillStyle = glow ? '#000' : '#1a1820';
  g.beginPath(); g.moveTo(128, y + 18); g.lineTo(226, y + 64); g.lineTo(128, y + 110); g.lineTo(30, y + 64); g.closePath(); g.fill();
  g.fillStyle = glow ? '#fff4d8' : '#f2ead8';
  fit(g, 'ufa', 128, y + 68, 150, 64, 'italic bold %px Georgia, serif');
  // The portrait: two faces in a round frame, silver on violet, as the premiere hoardings of the twenties.
  {
    const x = 256, cx = x + 128, cyy = y + 64;
    const grd = g.createRadialGradient(cx, cyy, 10, cx, cyy, 64);
    grd.addColorStop(0, glow ? '#3a3448' : '#9a8cb8');
    grd.addColorStop(1, glow ? '#0a0810' : '#2a1e3a');
    g.fillStyle = grd;
    g.fillRect(x, y, 256, H);
    g.globalAlpha = glow ? 0.6 : 1;
    for (const [fx, tone] of [[-28, '#e8e0d8'], [30, '#d4c8c0']] as const) {
      g.fillStyle = tone;
      g.beginPath(); g.ellipse(cx + fx, cyy - 8, 22, 28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1c1620';
      g.beginPath(); g.ellipse(cx + fx, cyy - 30, 24, 12, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = tone;
      g.fillRect(cx + fx - 30, cyy + 22, 60, 40);
    }
    g.globalAlpha = 1;
  }
  return toTexture(c, true, 4);
}

const signMats = new WeakMap<MapMats, LitMaterial>();
/** The sign atlas material, made once per map materials (the factory's `surface` settings, lettering glows). */
function signMat(M: MapMats): LitMaterial {
  let m = signMats.get(M);
  if (!m) {
    m = new MeshStandardMaterial({ map: paintSigns(false), emissiveMap: paintSigns(true), emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.6, vertexColors: true });
    signMats.set(M, m);
  }
  return m;
}

/** UV rect of cell `i` of `n` in atlas row `r`. */
function cell(r: number, i = 0, n = 1): [number, number, number, number] {
  return [i / n + 0.002, 1 - (r + 1) / ROWS + 0.003, (i + 1) / n - 0.002, 1 - r / ROWS - 0.003];
}

// ---------------------------------------------------------------- helpers

interface K extends Ctx {
  F: Frame;
  /** Sign atlas. */
  S: LitMaterial;
}

/** Box with its bottom at local height y. */
function bx(k: K, mat: Material, x: number, y: number, z: number, w: number, h: number, d: number, t?: RGB, ry = 0): void {
  k.b.box(mat, k.F(x, y + h / 2, z, ry), w, h, d, t);
}

/** A quad centred on `m`, facing its +z. */
function quad(k: K, mat: Material, m: Matrix4, w: number, h: number, uv: readonly [number, number, number, number], t?: RGB): void {
  const p = (x: number, yy: number): Vector3 => new Vector3(x, yy, 0).applyMatrix4(m);
  k.b.solid.of(mat).quad([p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)], uv, t ? [t] : undefined);
}

/** Lettering from the atlas on `m` (+z out), kept out of the hero contour mask. `back`: also on the far side. */
function sign(k: K, m: Matrix4, w: number, h: number, uv: readonly [number, number, number, number], back = false): void {
  k.b.solid.excludeOccluder(() => {
    quad(k, k.S, sub(m, 0, 0, 0.012), w, h, uv);
    if (back) quad(k, k.S, sub(m, 0, 0, -0.012, Math.PI), w, h, uv);
  });
}

const cy = (rt: number, rb: number, h: number, seg: number, open = false, a0 = 0, a = Math.PI * 2): BufferGeometry =>
  cached(`cw-cy${rt.toFixed(3)},${rb.toFixed(3)},${h.toFixed(3)},${seg},${open},${a0.toFixed(2)},${a.toFixed(2)}`, () => new CylinderGeometry(rt, rb, h, seg, 1, open, a0, a));
const ball = (seg = 8, rings = 6): BufferGeometry => cached(`cw-ball${seg},${rings}`, () => new SphereGeometry(1, seg, rings));
const half = (seg = 12): BufferGeometry => cached(`cw-dome${seg}`, () => new SphereGeometry(1, seg, 5, 0, Math.PI * 2, 0, Math.PI / 2));

/** An ellipsoid (unit sphere scaled) centred on `m`. */
function blob(k: K, mat: LitMaterial, m: Matrix4, sx: number, sy: number, sz: number, t?: RGB, seg = 8): void {
  k.b.geo(mat, ball(seg, Math.max(4, seg - 2)), m.clone().multiply(new Matrix4().makeScale(sx, sy, sz)), t);
}

/** Vertical cylinder standing on local y. */
function post(k: K, mat: LitMaterial, x: number, y: number, z: number, r: number, h: number, t?: RGB, seg = 8, top = r): void {
  k.b.geo(mat, cy(top, r, h, seg), k.F(x, y + h / 2, z), t);
}

/** A beam between two local points, section sx × sz. */
function beam(k: K, mat: Material, a: Vector3, c: Vector3, sx: number, sz: number, t?: RGB): void {
  const d = c.clone().sub(a), len = d.length();
  const yaw = Math.atan2(d.x, d.z), pitch = Math.atan2(Math.hypot(d.x, d.z), d.y);
  const m = k.F((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2, yaw, pitch);
  k.b.box(mat, m, sx, len, sz, t);
}

/** Round-arched opening on `m` (wall face, z out, bottom centre): dark recess with a round head, stone rim. */
function opening(k: K, m: Matrix4, w: number, h: number, rim?: { mat: LitMaterial; t: RGB }, horseshoe = false): void {
  const b = k.b, sh = h - w / 2;
  if (rim) {
    b.box(rim.mat, sub(m, 0, sh / 2, 0.02), w + 0.4, sh, 0.06, rim.t);
    b.geo(rim.mat, cached(`cw-rim${w.toFixed(2)},${horseshoe}`, () => new CircleGeometry(w / 2 + 0.2, 12, horseshoe ? -0.35 : 0, horseshoe ? Math.PI + 0.7 : Math.PI)), sub(m, 0, sh, 0.05), rim.t);
  }
  b.box(b.mm.dark, sub(m, 0, sh / 2, 0.06), w, sh, 0.04);
  b.geo(b.mm.dark, cached(`cw-head${w.toFixed(2)},${horseshoe}`, () => new CircleGeometry(w / 2, 12, horseshoe ? -0.35 : 0, horseshoe ? Math.PI + 0.7 : Math.PI)), sub(m, 0, sh, 0.085));
}

/** A tall round-arched window: pane from the window atlas and a dark head, optionally framed. */
function archWin(k: K, m: Matrix4, w: number, h: number, lit: number, rim?: { mat: LitMaterial; t: RGB }): void {
  const sh = h - w / 2;
  if (rim) {
    k.b.box(rim.mat, sub(m, 0, sh / 2, 0.02), w + 0.3, sh, 0.06, rim.t);
    k.b.geo(rim.mat, cached(`cw-rim${(w - 0.1).toFixed(2)},false`, () => new CircleGeometry(w / 2 + 0.1, 12, 0, Math.PI)), sub(m, 0, sh, 0.05), rim.t);
  }
  pane(k.b, sub(m, 0, sh / 2, 0.05), w, sh, k.rng, lit);
  archHead(k.b, k.b.mm.dark, sub(m, 0, sh, 0.06), w, false, 0.05);
}

/** Rubble and fallen stone at the foot of a wall: `n` pieces in the local box. */
function rubble(k: K, x0: number, x1: number, z0: number, z1: number, n: number, t: RGB = T.rubble, y = 0): void {
  const M = k.M, cl = (v: number, h: number): number => Math.max(-h + 0.5, Math.min(h - 0.5, v));
  for (let i = 0; i < n; i++) {
    // Pieces stay half a meter inside the footprint (the collider covers everything that stands).
    const s = k.rng.range(0.25, 0.7), brick = k.rng.next() < 0.3, x = cl(k.rng.range(x0, x1), k.l.hx), z = cl(k.rng.range(z0, z1), k.l.hz);
    k.b.box(brick ? M.brick : M.stucco, k.F(x, y + s * 0.2, z, k.rng.range(0, 3), k.rng.range(-0.2, 0.2)), s, s * 0.45, s * k.rng.range(0.7, 1.3), brick ? T.brickDark : t);
  }
}

/** A gas lantern on a cast-iron post (no light: the glass glows, one in four is broken). */
function lantern(k: K, x: number, z: number, h = 3.4, y = 0): void {
  const M = k.M;
  post(k, M.iron, x, y, z, 0.09, h, T.ironDark, 6, 0.06);
  post(k, M.iron, x, y, z, 0.16, 0.5, T.ironDark, 6, 0.12);
  const broken = k.rng.next() < 0.25;
  k.b.geo(broken ? M.glass : M.lampGlass, cy(0.17, 0.11, 0.5, 6), k.F(x, y + h + 0.25, z));
  k.b.geo(M.iron, cy(0.02, 0.22, 0.22, 6), k.F(x, y + h + 0.61, z), T.ironDark);
}

/** A seated figure stack (mannequins, statues): legs, torso, head on local frame `m`. */
function mannequin(k: K, m: Matrix4, t: RGB, fallen = false): void {
  const b = k.b, M = k.M, f = fallen ? sub(m, 0, 0.18, 0, 0, Math.PI / 2) : m;
  b.geo(M.enamel, cy(0.05, 0.05, 0.9, 5), sub(f, 0, 0.45, 0), T.ironDark);
  b.geo(M.enamel, cy(0.16, 0.22, 0.75, 8), sub(f, 0, 1.25, 0), t);
  b.geo(M.enamel, cy(0.24, 0.2, 0.25, 8), sub(f, 0, 1.0, 0), t);
  blob(k, M.enamel, sub(f, 0, 1.78, 0), 0.11, 0.14, 0.12, T.pearl, 6);
}

// ---------------------------------------------------------------- Bahnhof Zoologischer Garten (1882)

/**
 * Stadtbahn station of 1882 on the brick viaduct. Photos: a single iron hall over two tracks and the island
 * platform, segmental lattice arches springing from cast-iron posts on the viaduct edge, a ventilating lantern
 * along the ridge, glazed end lunettes with radiating bars, enamel name boards on the platform*, gas lanterns*,
 * the brick viaduct below with round-arched windows and a stone band* toward the Hardenbergplatz.
 * Game (E8): the glass is gone (bare ribs, the hero stays visible), the deck is the terrace at 6.5 m.
 * Local frame: z along the rail (north-east), +x the train side (north-west), −x the platform and the camera.
 */
function zoobahnhof(k: K): void {
  const { b, M, l } = k, Y = 6.5, X = 5.3, P = 3.4, R = 3.6, L = l.hz - 0.4;
  /** Point on the arch: t 0 … 1 from the south-east post to the north-west one. */
  const arc = (t: number, off = 0): Vector3 => {
    const a = Math.PI * (1 - t), span = X + off * 0.4;
    return new Vector3(Math.cos(a) * span, Y + P + Math.sin(a) * (R + off), 0);
  };
  const ribs: number[] = [];
  for (let z = -L; z <= L + 0.01; z += (2 * L) / 6) ribs.push(z);
  ribs.forEach((z, ri) => {
    const end = ri === 0 || ri === ribs.length - 1, n = 10;
    // Wear: the third rib lost a piece of its north-west half (hangs short).
    const lost = ri === 2 ? 7 : n;
    for (const s of [-1, 1]) {
      post(k, M.iron, s * X, Y, z, 0.15, P, T.ironDark, 8, 0.12);
      bx(k, M.iron, s * X, Y, z, 0.46, 0.25, 0.46, T.ironDark);
      bx(k, M.iron, s * X, Y + P - 0.25, z, 0.42, 0.3, 0.42, T.iron);
      // Bracket from the post into the arch.
      beam(k, M.iron, new Vector3(s * X, Y + P - 0.9, z), new Vector3(s * (X - 0.9), Y + P + 0.2, z), 0.1, 0.1, T.iron);
    }
    for (let i = 0; i < lost; i++) {
      const p0 = arc(i / n), p1 = arc((i + 1) / n), q0 = arc(i / n, 0.55), q1 = arc((i + 1) / n, 0.55);
      for (const [a, c] of [[p0, p1], [q0, q1]] as const) beam(k, M.iron, a.clone().setZ(z), c.clone().setZ(z), 0.16, 0.12, T.iron);
      // Lattice: one diagonal per segment.
      beam(k, M.iron, (i % 2 ? p0 : q0).clone().setZ(z), (i % 2 ? q1 : p1).clone().setZ(z), 0.06, 0.06, T.iron);
    }
    if (lost < n) {
      const p = arc(lost / n);
      beam(k, M.iron, p.clone().setZ(z), p.clone().setZ(z).add(new Vector3(-0.3, -1.8, 0.2)), 0.14, 0.1, T.iron);
    }
    // End arches: the lunette with radiating glazing bars, a tie bar with the station clock.
    if (end) {
      for (let i = 1; i < 8; i++) {
        const p = arc(i / 8);
        beam(k, M.iron, new Vector3(0, Y + P + 0.1, z), p.clone().setZ(z), 0.05, 0.05, T.iron);
      }
      bx(k, M.iron, 0, Y + P, z, 2 * X, 0.18, 0.14, T.iron);
      const out = z < 0 ? -1 : 1;
      k.b.geo(M.clock, cached('cw-clock', () => new CircleGeometry(0.55, 16)), k.F(0, Y + P - 0.75, z + out * 0.1, out < 0 ? Math.PI : 0));
      bx(k, M.iron, 0, Y + P - 1.4, z, 1.3, 1.3, 0.1, T.ironDark);
      bx(k, M.iron, 0, Y + P - 0.15, z, 0.08, 0.2, 0.08, T.iron);
    }
  });
  // Purlins: eaves, two on each slope, the ridge lantern.
  for (const t of [0.0, 0.18, 0.34, 0.66, 0.82, 1.0]) {
    const p = arc(t, 0.55);
    bx(k, M.iron, p.x, p.y - 0.08, 0, 0.14, 0.14, 2 * L, T.iron);
  }
  const top = Y + P + R + 0.55;
  for (const s of [-1, 1]) bx(k, M.iron, s * 0.9, top - 0.1, 0, 0.1, 0.1, 2 * L, T.iron);
  for (const z of ribs) for (const s of [-1, 1]) bx(k, M.iron, s * 0.9, top - 0.1, z, 0.1, 0.9, 0.1, T.iron);
  bx(k, M.iron, 0, top + 0.75, 0, 2.2, 0.12, 2 * L, T.ironDark);
  // A strip of zinc roof survives along the north-west eave and a few panes hang there, away from the camera.
  {
    const p0 = arc(0.86, 0.6), p1 = arc(1, 0.6);
    const m = new Vector3().addVectors(p0, p1).multiplyScalar(0.5), ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    k.b.box(M.slate, k.F(m.x, m.y, 0, 0, 0, ang), Math.hypot(p1.x - p0.x, p1.y - p0.y), 0.06, 2 * L - 2, T.slate);
  }
  for (const [t, z] of [[0.72, -6], [0.78, 3.5], [0.7, 7.5]] as const) {
    const p = arc(t, 0.6), ang = Math.atan2(Math.cos(Math.PI * (1 - t)) * -1, 1);
    k.b.box(M.glass, k.F(p.x, p.y - 0.05, z, 0, 0, -ang * 0.4 - 0.5), 1.4, 0.03, 2.2);
  }
  // Platform furniture on the deck (thin, out of the walking line): name boards on posts by the platform edge,
  // gas lanterns, two benches, the stationmaster's hut at the south-west end, luggage and fallen glass.
  for (const z of [-6.5, 4.5]) {
    for (const dz of [-1.3, 1.3]) post(k, M.iron, 1.1, Y, z + dz, 0.05, 3.0, T.ironDark, 6);
    bx(k, M.enamel, 1.1, Y + 2.25, z, 0.1, 0.62, 3.0, T.ironDark);
    for (const s of [-1, 1]) sign(k, k.F(1.1 + s * 0.06, Y + 2.56, z, s * Math.PI / 2), 2.8, 0.5, cell(ROW.station));
  }
  for (const z of [-9, -1.5, 8]) lantern(k, 1.1, z, 3.2, Y);
  for (const z of [-3.5, 1.8]) {
    bx(k, M.darkWood, -0.6, Y + 0.42, z, 0.45, 0.06, 1.8, T.wood);
    bx(k, M.darkWood, -0.8, Y + 0.5, z, 0.06, 0.5, 1.8, T.wood);
    for (const dz of [-0.75, 0.75]) bx(k, M.iron, -0.6, Y, z + dz, 0.4, 0.42, 0.06, T.ironDark);
  }
  bx(k, M.darkWood, -3.8, Y, -9.0, 1.6, 2.4, 1.6, T.wood);
  bx(k, M.slate, -3.8, Y + 2.4, -9.0, 1.9, 0.12, 1.9, T.slate);
  pane(b, k.F(-3.8, Y + 1.5, -8.18), 0.8, 0.8, k.rng, 0.4);
  bx(k, M.burlap, -1.0, Y, 9.2, 0.9, 0.55, 0.6, [0.9, 0.8, 0.65]);
  bx(k, M.darkWood, -0.9, Y + 0.55, 9.3, 0.7, 0.4, 0.5, T.wood);
  for (let i = 0; i < 12; i++) k.b.box(M.glass, k.F(k.rng.range(-4.4, 0.8), Y + 0.02, k.rng.range(-9, 9), k.rng.range(0, 3)), k.rng.range(0.12, 0.4), 0.02, k.rng.range(0.12, 0.4));
  // Street level: the viaduct face toward the Hardenbergplatz (−x): a sandstone band, round-arched windows of
  // the booking hall, the entrance with the name board over it (the stair lands at local z ≈ −1).
  const fx = -5.02;
  bx(k, M.stucco, fx - 0.06, 4.6, 0, 0.14, 0.4, 2 * l.hz, T.sand);
  bx(k, M.stucco, fx - 0.06, 0, 0, 0.14, 0.7, 2 * l.hz, T.sandDark);
  for (const z of [-10.5, -8, 5.5, 10.5]) archWin(k, k.F(fx - 0.02, 1.2, z, -Math.PI / 2), 1.5, 3.0, 0.5, { mat: M.stucco, t: T.sand });
  opening(k, k.F(fx - 0.02, 0, 8, -Math.PI / 2), 2.4, 3.6, { mat: M.stucco, t: T.sand });
  sign(k, k.F(fx - 0.14, 3.95, 8, -Math.PI / 2), 2.4, 0.42, cell(ROW.shops, 4, 6));
  sign(k, k.F(fx - 0.22, 5.15, -8.5, -Math.PI / 2), 4.4, 0.62, cell(ROW.station));
  b.shadowBox(k.F(0, Y + P + 1.5, 0), 2 * X, 3, 2 * L);
}

// ---------------------------------------------------------------- Zoo gates

/** A lion couchant on `m` (facing +z): body, mane, head, forepaws, tail. Sandstone. */
function lion(k: K, m: Matrix4, t: RGB, head = true): void {
  const M = k.M;
  blob(k, M.stucco, sub(m, 0, 0.42, -0.25), 0.4, 0.38, 0.85, t);
  blob(k, M.stucco, sub(m, 0, 0.7, 0.5), 0.5, 0.52, 0.42, t);
  if (head) {
    blob(k, M.stucco, sub(m, 0, 0.8, 0.82), 0.25, 0.27, 0.27, [t[0] * 1.05, t[1] * 1.05, t[2] * 1.05]);
    k.b.box(M.stucco, sub(m, 0, 0.72, 1.04), 0.2, 0.14, 0.14, t);
  }
  for (const s of [-1, 1]) k.b.box(M.stucco, sub(m, s * 0.2, 0.12, 0.85), 0.18, 0.22, 0.7, t);
  k.b.box(M.stucco, sub(m, 0.3, 0.12, -0.95, 0.5), 0.1, 0.1, 0.7, t);
}

/**
 * Löwentor (main gate on the Hardenbergplatz). Photos (pre-1914 postcards): two heavy rusticated sandstone
 * pillars* with a cornice, a recumbent lion on each, a wrought-iron arch with the gilt name between them*,
 * lanterns on the pillars*, open iron gate leaves folded back*. Built worn: one lion lost its head (on the
 * ground), soot, the arch slightly bent. The passage stays open (`OPEN_PARTS.loewentor`). Local +z faces west.
 */
function loewentor(k: K): void {
  const { M } = k, H = 4.2, ST = T.sand;
  for (const p of OPEN_PARTS.loewentor!) {
    const w = p.hx * 2, d = p.hz * 2;
    bx(k, M.stucco, p.x, 0, p.z, w + 0.2, 0.9, d + 0.2, T.sandDark);
    bx(k, M.stucco, p.x, 0.9, p.z, w, H - 0.9, d, ST);
    // Rustication joints.
    for (let y = 1.5; y < H - 0.4; y += 0.6) bx(k, M.stucco, p.x, y, p.z, w + 0.04, 0.06, d + 0.04, T.sandDark);
    bx(k, M.stucco, p.x, H, p.z, w + 0.3, 0.35, d + 0.3, T.stone);
    bx(k, M.stucco, p.x, H + 0.35, p.z, w - 0.2, 0.35, d - 0.2, ST);
    const headless = p.x > 0;
    const m = k.F(p.x, H + 0.7, p.z);
    lion(k, m, T.stone, !headless);
    if (headless) {
      // The head lies at the pillar foot; a broken stump in its place.
      k.b.box(M.stucco, sub(m, 0, 0.85, 0.82), 0.34, 0.3, 0.3, T.sandDark);
      blob(k, M.stucco, k.F(p.x + p.hx + 0.12, 0.2, p.z + 1.0), 0.2, 0.2, 0.22, T.stone);
    }
    // Lanterns on brackets at the passage side.
    const s = -Math.sign(p.x), lx = p.x + s * (p.hx + 0.25);
    bx(k, M.iron, lx - s * 0.12, 3.0, 0, 0.3, 0.06, 0.06, T.ironDark);
    k.b.geo(M.lampGlass, cy(0.14, 0.1, 0.42, 6), k.F(lx, 2.86, 0));
    k.b.geo(M.iron, cy(0.02, 0.19, 0.2, 6), k.F(lx, 3.17, 0), T.ironDark);
    // Gate leaf folded back flat against the pillar's passage face.
    const fx = p.x + s * (p.hx + 0.06);
    for (const yy of [0.25, 2.3]) bx(k, M.iron, fx, yy, 0, 0.05, 0.08, 2.6, T.ironDark);
    for (let i = 0; i < 10; i++) bx(k, M.iron, fx, 0.2, -1.2 + i * 0.27, 0.035, 2.4, 0.035, T.ironDark);
  }
  // The arch with the gilt name, both faces.
  const ix = OPEN_PARTS.loewentor![1]!.x - OPEN_PARTS.loewentor![1]!.hx;
  for (let i = 0; i < 8; i++) {
    const a0 = Math.PI * (i / 8), a1 = Math.PI * ((i + 1) / 8);
    beam(k, M.iron, new Vector3(-Math.cos(a0) * ix, 4.9 + Math.sin(a0) * 0.8 - (i < 3 ? 0.06 * i : 0), 0), new Vector3(-Math.cos(a1) * ix, 4.9 + Math.sin(a1) * 0.8, 0), 0.1, 0.1, T.ironDark);
  }
  bx(k, M.iron, 0, 4.85, 0, ix * 2, 0.1, 0.1, T.ironDark);
  sign(k, k.F(0, 5.22, 0), 3.8, 0.42, cell(ROW.ubahn, 1, 2), true);
  rubble(k, -5, -2.6, -1.4, 1.4, 6, T.sand);
}

/** A kneeling elephant on `m` (facing +z): body, head, ears, trunk, tusks, folded legs. */
function elephant(k: K, m: Matrix4, t: RGB): void {
  const M = k.M, b = k.b;
  blob(k, M.stucco, sub(m, 0, 1.05, -0.35), 0.72, 0.7, 1.05, t, 10);
  blob(k, M.stucco, sub(m, 0, 1.45, 0.65), 0.5, 0.52, 0.48, t);
  for (const s of [-1, 1]) {
    blob(k, M.stucco, sub(m, s * 0.55, 1.42, 0.5, s * 0.4), 0.09, 0.6, 0.5, [t[0] * 0.95, t[1] * 0.95, t[2] * 0.95], 6);
    // Folded forelegs reach forward, hind legs tucked.
    b.box(M.stucco, sub(m, s * 0.32, 0.2, 0.55), 0.38, 0.4, 0.85, t);
    b.box(M.stucco, sub(m, s * 0.5, 0.3, -0.95), 0.42, 0.55, 0.75, t);
    // Tusks.
    b.geo(M.enamel, cached('cw-tusk', () => new ConeGeometry(0.06, 0.6, 5)), sub(m, s * 0.2, 1.08, 1.0, 0, 1.2), T.pearl);
  }
  // Trunk in three pieces curling to the ground.
  b.geo(M.stucco, cy(0.13, 0.17, 0.6, 7), sub(m, 0, 1.15, 1.02, 0, 0.35), t);
  b.geo(M.stucco, cy(0.1, 0.13, 0.55, 7), sub(m, 0, 0.62, 1.18, 0, 0.1), t);
  b.geo(M.stucco, cy(0.08, 0.1, 0.32, 6), sub(m, 0, 0.26, 1.3, 0, -0.9), t);
  // Saddle cloth under the column, berry with a pearl hem.
  b.box(M.linen, sub(m, 0, 1.72, -0.35, 0, 0, 0), 1.25, 0.12, 1.0, T.berry);
  for (const s of [-1, 1]) b.box(M.linen, sub(m, s * 0.68, 1.35, -0.35), 0.06, 0.75, 0.95, T.berry);
}

/**
 * Elefantentor (1899), the main gate on the Budapester Straße. Photos and period cards (about 1900 and 1910,
 * „Zoologischer Garten, Haupteingang“): two elephants kneeling on stone plinths*, each carrying a painted pillar
 * on its back, the pillars hold a tall convex pagoda hood with dark glazed tiles, a red underside with gilt
 * ornament, upturned eave tips and crests on the ridge; the name board on the beam*, lanterns under it*.
 * Built worn: a crest broken off (on the ground), a tusk missing, soot. Passage open (`OPEN_PARTS.elefantentor`).
 */
function elefantentor(k: K): void {
  const { b, M } = k, ST = T.stone, LQ = M.carPaint, OCH: RGB = [0.86, 0.44, 0.24], TILE: RGB = [0.5, 0.95, 0.95];
  for (const p of OPEN_PARTS.elefantentor!) {
    bx(k, M.stucco, p.x, 0, p.z, p.hx * 2, 0.85, p.hz * 2, T.sandDark);
    bx(k, M.stucco, p.x, 0.85, p.z, p.hx * 2 + 0.12, 0.14, p.hz * 2 + 0.12, ST);
    elephant(k, k.F(p.x, 0.99, p.z + 0.05).multiply(new Matrix4().makeScale(1.1, 1.1, 1.1)), ST);
    // The painted pillar on its back: shaft, gilt rings, a bracket capital.
    bx(k, LQ, p.x, 2.85, p.z - 0.35, 0.72, 2.6, 0.72, OCH);
    for (const y of [3.0, 4.6]) bx(k, LQ, p.x, y, p.z - 0.35, 0.8, 0.12, 0.8, T.gold);
    bx(k, LQ, p.x, 5.45, p.z - 0.35, 1.1, 0.35, 1.1, T.red);
  }
  // Beam with the name board, gilt brackets and two lanterns hanging over the passage.
  const ry = 5.8, rz = -0.35;
  bx(k, LQ, 0, ry, rz, 9.6, 0.5, 0.55, T.red);
  bx(k, LQ, 0, ry + 0.5, rz, 9.4, 0.1, 0.6, T.gold);
  sign(k, k.F(0, ry + 0.25, rz + 0.29), 3.6, 0.4, cell(ROW.ubahn, 1, 2), true);
  for (const s of [-1, 1]) {
    b.box(LQ, k.F(s * 3.3, ry - 0.3, rz, 0, 0, s * 0.8), 0.16, 0.9, 0.2, T.gold);
    bx(k, M.iron, s * 1.5, ry - 0.6, rz, 0.03, 0.6, 0.03, T.ironDark);
    b.geo(M.lampGlass, cy(0.16, 0.12, 0.45, 6), k.F(s * 1.5, ry - 0.85, rz));
  }
  // The hood: a convex ridge over the span, slopes front and back, red underside, upturned tips.
  const Y0 = ry + 0.6, half = 5.6, n = 10, segW = (2 * half) / n;
  const top = (x: number): number => Y0 + 0.5 + 2.0 * Math.sqrt(Math.max(0, 1 - (x / (half + 0.4)) ** 2));
  for (let i = 0; i < n; i++) {
    const x = -half + (i + 0.5) * segW, h0 = top(x - segW / 2), h1 = top(x + segW / 2), tilt = Math.atan2(h1 - h0, segW), hm = (h0 + h1) / 2;
    for (const sz of [-1, 1]) {
      const m = k.F(x, hm - 0.55, rz + sz * 1.0, 0, sz * 0.62, tilt);
      b.box(M.slate, m, segW + 0.08, 0.14, 2.5, TILE);
      b.box(LQ, sub(m, 0, -0.1, 0), segW + 0.06, 0.06, 2.4, T.red);
    }
    b.box(LQ, k.F(x, hm + 0.1, rz, 0, 0, tilt), segW + 0.06, 0.28, 0.3, T.red);
  }
  for (const s of [-1, 1]) for (const sz of [-1, 1]) {
    const tip = k.F(s * (half + 0.3), top(half) - 1.1, rz + sz * 1.95, 0, sz * 0.3, s * 0.6);
    b.box(M.slate, tip, 0.9, 0.12, 0.7, TILE);
    b.box(LQ, sub(tip, s * 0.5, 0.1, 0), 0.2, 0.35, 0.2, T.gold);
  }
  // Crests: a gilt ball and flame in the middle, two curled crests near the ends (the east one has fallen).
  blob(k, LQ, k.F(0, top(0) + 0.45, rz), 0.26, 0.26, 0.26, T.gold, 6);
  b.geo(LQ, cached('cw-flame', () => new ConeGeometry(0.16, 0.6, 5)), k.F(0, top(0) + 0.95, rz), T.gold);
  b.box(LQ, k.F(-3.8, top(-3.8) + 0.4, rz, 0, 0, 0.5), 0.25, 0.8, 0.22, T.red);
  b.box(LQ, k.F(-4.05, top(-3.8) + 0.85, rz, 0, 0, -0.6), 0.2, 0.45, 0.2, T.gold);
  b.box(LQ, k.F(4.2, 0.15, 1.1, 0.7, 0, 1.4), 0.25, 0.8, 0.22, T.red);
  rubble(k, 3.0, 5.4, 0.4, 1.4, 4, TILE);
}

// ---------------------------------------------------------------- Zoo buildings

/**
 * Musikpavillon in the concert garden. Built without a photo of this pavilion (none could be fetched): the usual
 * cast-iron bandstand of the period, octagonal on a stone base with steps*, slender columns with lace brackets*, a frieze, an ogee zinc roof with
 * a finial, music stands and chairs inside*. Built worn: one column bent, chairs knocked over, sheets on the floor.
 */
function musikpavillon(k: K): void {
  const { b, M, l } = k, R = l.hx - 0.4, BASE = 1.0, CH = 3.0, ZINC: RGB = [0.95, 1.0, 1.06];
  b.geo(M.stucco, cy(R, R + 0.1, BASE, 8), k.F(0, BASE / 2, 0), T.sandDark);
  b.geo(M.stucco, cy(R + 0.15, R + 0.15, 0.12, 8), k.F(0, BASE + 0.06, 0), T.stone);
  // Steps on the south (camera) side.
  for (let i = 0; i < 3; i++) bx(k, M.stucco, 0, 0, l.hz - 0.2 - (i + 0.5) * 0.3, 2.0, (BASE * (i + 1)) / 3, 0.32, T.stone);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, x = Math.sin(a) * R, z = Math.cos(a) * R;
    const bent = i === 5;
    if (bent) b.geo(M.iron, cy(0.08, 0.1, CH, 6), k.F(x, BASE + CH / 2, z, 0, 0.12, 0.08), T.ironDark);
    else post(k, M.iron, x, BASE, z, 0.1, CH, T.ironDark, 6, 0.08);
    // Lace brackets: two short diagonals into the frieze.
    const nx = Math.sin(a + Math.PI / 8) * (R - 0.02), nz = Math.cos(a + Math.PI / 8) * (R - 0.02);
    beam(k, M.iron, new Vector3(x, BASE + CH - 0.7, z), new Vector3((x + nx) / 2, BASE + CH, (z + nz) / 2), 0.05, 0.05, T.iron);
    // Railing between the columns, open at the steps.
    const a1 = a + Math.PI / 4, x1 = Math.sin(a1) * R, z1 = Math.cos(a1) * R;
    if (i !== 7) {
      beam(k, M.iron, new Vector3(x, BASE + 0.9, z), new Vector3(x1, BASE + 0.9, z1), 0.05, 0.05, T.iron);
      for (let j = 1; j < 6; j++) { const t = j / 6; bx(k, M.iron, x + (x1 - x) * t, BASE, z + (z1 - z) * t, 0.03, 0.9, 0.03, T.iron); }
    }
  }
  // Frieze ring, the ogee roof (a flared skirt, a bell, a finial), the hole on the north-west side.
  b.geo(M.iron, cy(R + 0.1, R + 0.1, 0.45, 8, true), k.F(0, BASE + CH + 0.22, 0), T.iron);
  b.geo(M.slate, cy(R - 0.6, R + 0.6, 0.7, 8), k.F(0, BASE + CH + 0.8, 0), ZINC);
  b.geo(M.slate, cached('cw-bell', () => { const g = new SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); return g; }), k.F(0, BASE + CH + 1.15, 0).multiply(new Matrix4().makeScale(R - 0.6, 1.6, R - 0.6)), ZINC);
  post(k, M.enamel, 0, BASE + CH + 2.7, 0, 0.12, 0.6, T.copper, 6, 0.03);
  blob(k, M.enamel, k.F(0, BASE + CH + 2.75, 0), 0.2, 0.2, 0.2, T.copper, 6);
  // Inside: stands and chairs, two of them toppled, sheets on the floor.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = Math.sin(a) * 1.7, z = Math.cos(a) * 1.7 - 0.3, down = i === 1 || i === 4;
    bx(k, M.darkWood, x, BASE + (down ? 0 : 0.45), z, 0.45, down ? 0.45 : 0.05, 0.45, T.wood, a + (down ? 1.4 : 0));
    if (!down) bx(k, M.darkWood, x, BASE, z, 0.4, 0.45, 0.4, T.ironDark, a);
    post(k, M.iron, x * 0.7, BASE, z * 0.7 + 0.1, 0.02, 1.1, T.ironDark, 4);
    k.b.box(M.linen, k.F(x * 0.7, BASE + 1.15, z * 0.7 + 0.1, a, -0.5), 0.45, 0.32, 0.02, T.pearl);
  }
  for (let i = 0; i < 6; i++) k.b.box(M.linen, k.F(k.rng.range(-2, 2), BASE + 0.14, k.rng.range(-2, 2), k.rng.range(0, 3)), 0.3, 0.01, 0.42, T.pearl);
}

/**
 * Aquarium (Zaar & Vahl, 1913) on the Budapester Straße. Photos (the front as rebuilt, true to 1913) and the 1913
 * posters: a long low front in green-grey render between pilasters, terracotta relief panels with prehistoric
 * animals and fish at eye level*, a round-arched entrance with the name over it*, a glazed roof and a corner
 * pavilion with a steep roof. Built worn: soot, boarded panes, a panel fallen out, rubble. Small footprint at the
 * map edge: one bay each side of the door, the corner pavilion to the west.
 */
function aquarium(k: K): void {
  const { b, M, l } = k, H = 7.2, GR: RGB = [0.76, 0.98, 0.9], LT: RGB = [1.08, 1.1, 1.04], FZ = l.hz - 0.4, cz = (FZ - l.hz) / 2, D = FZ + l.hz;
  bx(k, M.stucco, 0, 0, cz, 2 * l.hx, H, D, GR);
  bx(k, M.stucco, 0, 0, cz, 2 * l.hx + 0.1, 0.7, D + 0.1, T.sandDark);
  bx(k, M.stucco, 0, H, cz, 2 * l.hx + 0.3, 0.4, D + 0.3, LT);
  b.shadowBox(k.F(0, H / 2, cz), 2 * l.hx, H, D);
  // Glazed roof: a low hip of blue-grey panes on iron bars.
  b.geo(M.slate, frustum(2 * l.hx - 0.2, D - 0.2, 1.4, 2 * l.hx - 2.6, 1.0), k.F(0.4, H + 0.4, cz), [0.62, 0.8, 1.15]);
  // Pilasters and the relief panels between them; the fish band above; one panel has fallen out.
  for (const x of [-3.3, -1.25, 1.25, 3.3]) bx(k, M.stucco, x, 0.7, FZ + 0.12, 0.5, H - 0.7, 0.24, LT);
  for (const [x, i] of [[-2.27, 0], [2.27, 2]] as const) {
    if (x > 0) { b.box(M.dark, k.F(x, 2.9, FZ + 0.02), 1.5, 1.1, 0.03); rubble(k, x - 0.6, x + 0.6, FZ + 0.2, l.hz - 0.1, 3, [0.7, 0.4, 0.3]); continue; }
    bx(k, M.stucco, x, 2.2, FZ + 0.04, 1.7, 1.4, 0.08, [0.75, 0.6, 0.5]);
    sign(k, k.F(x, 2.9, FZ + 0.09), 1.5, 1.2, cell(ROW.reliefs, i, 4));
  }
  for (const [x, i] of [[-2.27, 1], [2.27, 3]] as const) sign(k, k.F(x, 5.4, FZ + 0.02), 1.5, 0.75, cell(ROW.reliefs, i, 4));
  // Entrance: projecting round-arched portal, the name over it, steps.
  bx(k, M.stucco, 0, 0, FZ + 0.2, 2.3, 5.2, 0.4, LT);
  opening(k, k.F(0, 0.0, FZ + 0.41), 1.5, 3.5, { mat: M.stucco, t: [0.7, 0.42, 0.32] });
  sign(k, k.F(0, 4.5, FZ + 0.42), 2.1, 0.5, cell(ROW.pair, 1, 2));
  for (let i = 0; i < 2; i++) bx(k, M.stucco, 0, 0, FZ + 0.6 + i * 0.3, 2.6 - i * 0.4, 0.15 * (2 - i), 0.3, T.sandDark);
  for (const x of [-2.27, 2.27]) pane(b, k.F(x, 4.3, FZ + 0.01), 1.2, 0.8, k.rng, 0.3);
  for (const s of [-1, 1]) for (const z of [-2.6, -0.4]) pane(b, k.F(s * (l.hx + 0.01), 3.4, z, s * Math.PI / 2), 1.0, 1.6, k.rng, 0.3);
  // West corner pavilion: one storey higher with a steep pyramid roof.
  const px = -l.hx + 1.1;
  bx(k, M.stucco, px, H, cz - 0.4, 2.2, 3.0, D - 1.2, LT);
  pane(b, k.F(px, H + 1.5, FZ - 0.59), 0.9, 1.4, k.rng, 0.3);
  b.geo(M.slate, frustum(2.5, D - 0.9, 2.6, 0.2, 0.3), k.F(px, H + 3.0, cz - 0.4), T.slate);
  rubble(k, -3.2, -1.2, FZ + 0.3, l.hz - 0.1, 4);
}

/**
 * Antilopenhaus (Ende & Böckmann, 1872), Moorish. Period drawings (front and side elevations, section, plan):
 * low wings with a row of horseshoe arches and cresting*, banded brick, a tall central portal block with a big
 * horseshoe arch and striped voussoirs* flanked by two slim minarets, the oval central hall under a glazed
 * iron dome, small cupolas at the wing ends. Built worn: most dome panes gone, one minaret top fallen, broken
 * panes, rubble. A side passage with a sleeping elite (it stays a closed block).
 */
function antilopenhaus(k: K): void {
  const { b, M, l } = k, WH = 4.2, D = 2 * l.hz - 2.2, CX = 2.4, CH = 7.2, CD = 2 * l.hz - 1.4;
  const band = (x: number, w: number, h: number, d: number): void => {
    bx(k, M.brick, x, 0, 0, w, h, d, T.brick);
    for (let y = 0.9; y < h - 0.3; y += 0.7) bx(k, M.stucco, x, y, 0, w + 0.04, 0.2, d + 0.04, T.cream);
    bx(k, M.stucco, x, h, 0, w + 0.3, 0.3, d + 0.3, T.cream);
  };
  const rim = { mat: M.stucco, t: T.cream };
  // Wings: banded brick, horseshoe arcade windows, cresting, flat roofs; cupolas at the outer front corners.
  for (const s of [-1, 1]) {
    const x0 = s * CX, x1 = s * (l.hx - 0.6), xc = (x0 + x1) / 2, w = Math.abs(x1 - x0);
    band(xc, w, WH, D);
    b.geo(M.slate, frustum(w, D, 0.5, w - 0.8, D - 0.8), k.F(xc, WH + 0.3, 0), T.slate);
    for (let x = xc - w / 2 + 0.3; x <= xc + w / 2 - 0.2; x += 0.55) bx(k, M.stucco, x, WH + 0.3, D / 2 + 0.05, 0.28, 0.4, 0.18, T.cream);
    for (let i = 0; i < 4; i++) opening(k, k.F(xc - w / 2 + 0.6 + (i + 0.5) * ((w - 1.2) / 4), 0.9, D / 2 + 0.02), 0.75, 2.2, rim, true);
    opening(k, k.F(s * (l.hx - 0.6 + 0.02), 0.9, 0, s * Math.PI / 2), 0.9, 2.3, rim, true);
    const cx = s * (l.hx - 0.9), cz = D / 2 - 0.3;
    post(k, M.brick, cx, WH + 0.3, cz, 0.5, 1.1, T.brick, 8);
    blob(k, M.enamel, k.F(cx, WH + 1.6, cz), 0.52, 0.6, 0.52, T.copper, 8);
    b.geo(M.enamel, cached('cw-tip', () => new ConeGeometry(0.18, 0.6, 6)), k.F(cx, WH + 2.4, cz), T.copper);
  }
  // Central portal block with the big horseshoe arch and its striped voussoirs.
  band(0, 2 * CX, CH, CD);
  b.shadowBox(k.F(0, CH / 2, 0), 2 * l.hx, CH, CD);
  const fz = CD / 2 + 0.02;
  opening(k, k.F(0, 0, fz), 2.2, 4.6, rim, true);
  for (let i = 0; i < 11; i++) {
    const a = -0.35 + ((Math.PI + 0.7) * (i + 0.5)) / 11, r = 1.38;
    b.box(M.stucco, k.F(Math.cos(a) * r, 3.5 + Math.sin(a) * r, fz + 0.08, 0, 0, a), 0.42, 0.5, 0.06, i % 2 ? T.red : T.cream);
  }
  for (const x of [-1.6, 1.6]) post(k, M.stucco, x, 0, fz + 0.15, 0.13, 3.3, T.cream, 8);
  for (let x = -CX + 0.3; x <= CX - 0.2; x += 0.5) bx(k, M.stucco, x, CH + 0.3, fz - 0.05, 0.26, 0.45, 0.18, T.cream);
  for (const x of [-1.2, 0, 1.2]) opening(k, k.F(x, 5.4, fz), 0.5, 1.2, undefined, true);
  // Minarets at the front corners of the portal block (the east one lost its top).
  for (const s of [-1, 1]) {
    const x = s * CX, z = CD / 2 + 0.05, broken = s > 0, h = broken ? 7.8 : 10.5;
    post(k, M.brick, x, 0, z, 0.42, h, T.brick, 8, 0.38);
    for (let y = 1.2; y < h - 0.3; y += 1.0) post(k, M.stucco, x, y, z, 0.44, 0.18, T.cream, 8);
    if (broken) { rubble(k, x - 0.5, x + 0.4, z - 0.2, l.hz - 0.1, 4, T.brickDark); continue; }
    post(k, M.stucco, x, h, z, 0.6, 0.18, T.cream, 8);
    post(k, M.brick, x, h + 0.18, z, 0.3, 0.8, T.brick, 8);
    blob(k, M.enamel, k.F(x, h + 1.2, z), 0.36, 0.45, 0.36, T.copper, 8);
    b.geo(M.enamel, cached('cw-tip2', () => new ConeGeometry(0.12, 0.5, 6)), k.F(x, h + 1.8, z), T.copper);
  }
  // The glazed iron dome over the oval hall: drum, ribs, rings, a few panes left, a lantern.
  const R = 2.9, dz = -0.6, dy = CH + 0.3;
  b.geo(M.brick, cy(R, R, 0.7, 14), k.F(0, dy + 0.35, dz), T.brick);
  b.geo(M.stucco, cy(R + 0.1, R + 0.1, 0.18, 14), k.F(0, dy + 0.75, dz), T.cream);
  const y1 = dy + 0.84;
  for (let i = 0; i < 12; i++) b.geo(M.iron, cached('cw-arib', () => new TorusGeometry(R, 0.06, 3, 8, Math.PI / 2)), k.F(0, y1, dz, (i * Math.PI) / 6), T.iron);
  for (const a of [0.45, 0.9]) b.geo(M.iron, cached(`cw-aring${a}`, () => new TorusGeometry(R * Math.cos(a), 0.05, 3, 18)), k.F(0, y1 + R * Math.sin(a), dz, 0, Math.PI / 2), T.iron);
  for (const [phi, th] of [[0.3, 0.8], [1.9, 1.05], [3.4, 0.55], [4.4, 1.0], [5.6, 0.7]] as const) {
    b.geo(M.glass, cached(`cw-apane${phi}`, () => new SphereGeometry(R - 0.03, 3, 2, phi, 0.5, th, 0.34)), k.F(0, y1, dz));
  }
  post(k, M.iron, 0, y1 + R - 0.1, dz, 0.35, 0.5, T.iron, 8);
  blob(k, M.enamel, k.F(0, y1 + R + 0.6, dz), 0.3, 0.38, 0.3, T.copper, 8);
  rubble(k, -l.hx + 1, l.hx - 1, D / 2 + 0.3, l.hz - 0.1, 7, T.cream);
}

// ---------------------------------------------------------------- cinemas and shops

/** A marquee canopy at height y on the wall plane z = `fz` (local), centred at x, `d` deep: iron box, a bulb row. */
function canopy(k: K, x: number, fz: number, w: number, d: number, y: number): void {
  const b = k.b, M = k.M;
  bx(k, M.iron, x, y - 0.17, fz + d / 2, w, 0.35, d, T.ironDark);
  bx(k, M.enamel, x, y + 0.18, fz + d / 2, w + 0.1, 0.08, d + 0.1, T.pearl);
  const n = Math.round(w / 0.45);
  b.solid.excludeOccluder(() => {
    for (let i = 0; i < n; i++) if (k.rng.next() > 0.12) bx(k, M.lampGlass, x - w / 2 + (i + 0.5) * (w / n), y - 0.3, fz + d + 0.02, 0.09, 0.09, 0.09);
  });
  // Hanger rods to the wall.
  for (const s of [-1, 1]) beam(k, M.iron, new Vector3(x + s * (w / 2 - 0.4), y + 2.0, fz), new Vector3(x + s * (w / 2 - 0.4), y + 0.2, fz + d - 0.2), 0.04, 0.04, T.ironDark);
}

/** A shop front on frame `m` (bottom centre, z out): shop window atlas, a door, the fascia from the atlas. */
function shopFront(k: K, m: Matrix4, w: number, fascia: number, awning = true): void {
  const b = k.b, M = k.M;
  b.box(M.darkWood, sub(m, 0, 1.65, 0.04), w, 3.3, 0.08, [0.35, 0.28, 0.24]);
  const broken = k.rng.next() < 0.35;
  b.box(broken ? M.dark : M.shop, sub(m, -0.55, 1.55, 0.1), w - 1.8, 2.2, 0.04);
  if (broken) for (let i = 0; i < 3; i++) b.box(M.darkWood, sub(m, -0.55, 0.9 + i * 0.6, 0.14, 0, 0, k.rng.range(-0.2, 0.2)), w - 1.6, 0.18, 0.04, T.wood);
  b.box(M.door, sub(m, w / 2 - 0.65, 1.15, 0.1), 0.9, 2.3, 0.04);
  sign(k, sub(m, 0, 3.0, 0.1), w - 0.3, 0.5, cell(ROW.shops, fascia % 4, 6));
  if (awning) b.box(M.awning, sub(m, 0, 2.6, 0.7, 0, 0.55), w - 0.4, 0.04, 1.4);
}

/**
 * Ufa-Palast am Zoo (since 1919 in the Ausstellungshallen am Zoo). Photos (1920s): the exhibition hall's
 * neo-Romanesque gable front in rough brown sandstone, a huge round arch in it filled by a round film portrait,
 * the Ufa rhombus and „PALAST AM ZOO“ under the gable, a deep canopy over the doors*, billboards on the canopy*,
 * a lower wing with round-arched windows and a square tower with a pyramid roof beside it. Built worn: dead bulbs,
 * a torn billboard, soot over the arch, rubble, velvet ropes down.
 */
function ufapalast(k: K): void {
  const { b, M, l } = k, H = 9.5, FZ = l.hz - 0.6, D = FZ + l.hz, cz = (FZ - l.hz) / 2, W = 2 * l.hx - 1.6, ST: RGB = [0.86, 0.76, 0.64], LT: RGB = [0.98, 0.9, 0.78], DK: RGB = [0.62, 0.55, 0.48];
  bx(k, M.stucco, -0.8, 0, cz, W, H, D, ST);
  bx(k, M.stucco, -0.8, 0, cz, W + 0.1, 0.8, D + 0.1, DK);
  // The gable: stone triangle on the front, slate slopes, a stepped arcade in it, the Ufa rhombus on top.
  const g = k.F(-0.8, H, cz);
  b.geo(M.stucco, frustum(W, D, 4.6, 0.3, D, SLOPES), g, ST);
  b.geo(M.slate, frustum(W + 0.3, D + 0.2, 4.7, 0.3, D + 0.2, ENDS), g, T.slate);
  for (let i = 0; i < 5; i++) post(k, M.stucco, -2.4 + i * 0.8, H + 0.3, FZ + 0.08, 0.08, 1.6 - Math.abs(i - 2) * 0.4, LT, 5);
  sign(k, k.F(-0.8, H + 2.6, FZ + 0.05), 1.6, 0.8, cell(ROW.emblems, 0, 4));
  b.shadowBox(k.F(-0.8, H / 2, cz), W, H, D);
  // The big round arch: rim of voussoirs, the dark recess and the round film portrait in it.
  const ay = 5.6, ar = 2.8;
  bx(k, M.dark, -0.8, ay, FZ + 0.02, 2 * ar, 0.9, 0.04);
  b.geo(M.dark, cached('cw-ufa-arch', () => new CircleGeometry(ar, 16, 0, Math.PI)), k.F(-0.8, ay + 0.9, FZ + 0.03));
  b.geo(M.stucco, cached('cw-ufa-rim', () => new RingGeometry(ar, ar + 0.45, 16, 1, 0, Math.PI)), k.F(-0.8, ay + 0.9, FZ + 0.06), LT);
  for (const s of [-1, 1]) bx(k, M.stucco, -0.8 + s * (ar + 0.22), ay - 0.2, FZ + 0.06, 0.45, 1.1, 0.12, LT);
  sign(k, k.F(-0.8, ay + 1.2, FZ + 0.12), 4.2, 2.1, cell(ROW.emblems, 1, 4));
  // Lettering band, canopy with bulbs, billboards on it.
  bx(k, M.iron, -0.8, 4.4, FZ + 0.2, W - 0.6, 1.0, 0.12, T.ironDark);
  sign(k, k.F(-0.8, 4.9, FZ + 0.27), W - 0.8, 0.9, cell(ROW.ufa));
  canopy(k, -0.8, FZ, W - 0.2, 0.6, 3.5);
  for (const [i, x] of [[0, -3.0], [2, 1.4]] as const) {
    bx(k, M.iron, x, 3.8, FZ + 0.62, 2.8, 0.55, 0.06, T.ironDark);
    sign(k, k.F(x, 4.08, FZ + 0.66), 2.7, 0.5, cell(ROW.posters, i, 4));
  }
  // Doors and poster cases.
  for (const x of [-2.6, -0.8, 1.0]) {
    b.box(M.door, k.F(x, 1.3, FZ + 0.03), 1.4, 2.6, 0.04);
    b.box(M.stucco, k.F(x, 2.75, FZ + 0.05), 1.6, 0.3, 0.1, LT);
  }
  bx(k, M.darkWood, -l.hx + 0.6, 0.6, FZ + 0.33, 0.9, 1.4, 0.1, [0.4, 0.3, 0.25]);
  sign(k, k.F(-l.hx + 0.6, 1.3, FZ + 0.39), 0.8, 1.2, cell(ROW.posters, 1, 4));
  // The square tower beside the front (east): arcaded top, pyramid roof.
  const tx = l.hx - 0.8, tz = -0.6, TW = 1.6, TH = 12.5;
  bx(k, M.stucco, tx, 0, tz, TW, TH, 2 * l.hz - 1.2, ST);
  for (const x of [-0.38, 0.38]) archWin(k, k.F(tx + x, TH - 2.4, FZ - 0.59), 0.45, 1.6, 0.2);
  for (const y of [3.2, 6.4]) archWin(k, k.F(tx, y, FZ - 0.59), 0.7, 2.0, 0.3, { mat: M.stucco, t: LT });
  bx(k, M.stucco, tx, TH, tz, TW + 0.2, 0.25, 2 * l.hz - 1.0, LT);
  b.geo(M.slate, frustum(TW + 0.2, 2 * l.hz - 1.0, 3.2, 0.1, 0.1), k.F(tx, TH + 0.25, tz), T.slate);
  // Velvet ropes on the pavement (inside the footprint), one rope down.
  for (const x of [-3.6, -1.8, 0.2, 2.0]) {
    post(k, M.enamel, x, 0, l.hz - 0.25, 0.04, 0.95, T.gold, 6);
    blob(k, M.enamel, k.F(x, 1.0, l.hz - 0.25), 0.07, 0.07, 0.07, T.gold, 5);
  }
  for (const [a, c] of [[-3.6, -1.8], [0.2, 2.0]] as const) bx(k, M.linen, (a + c) / 2, 0.75, l.hz - 0.25, c - a, 0.07, 0.07, T.berry);
  b.box(M.linen, k.F(-0.8, 0.04, l.hz - 0.25), 2, 0.07, 0.07, T.berry);
  rubble(k, -l.hx + 0.4, -l.hx + 2, FZ + 0.6, l.hz - 0.3, 4, ST);
}

/**
 * Capitol am Zoo (Poelzig, 1925) in a two-storey shop row (the 1920 stand-in for the Bikini-Haus). Photos of the
 * Capitol: a smooth rendered front with horizontal bands, a raised middle with vertical fins and the bulb name
 * "CAPITOL", deep curved canopies. Game: shops on both sides of the passage* (fascias, awnings, shop windows),
 * the passage under the cinema front with its bulb frame*, film billboards*. Built worn: broken shop windows
 * boarded, a fallen awning, dead bulbs. `OPEN_PARTS.capitol`: front blocks at z 1 … 5, the yard behind.
 */
function capitol(k: K): void {
  const { b, M } = k, H = 7.4, R: RGB = [1.08, 1.04, 0.96], BAND: RGB = [0.88, 0.84, 0.76];
  const parts = OPEN_PARTS.capitol!;
  let f = 0;
  for (const p of parts) {
    if (p.hz > 2.5) {
      // End walls down to the Zoo fence: low brick, a pier at the end.
      bx(k, M.brick, p.x, 0, p.z, p.hx * 2, 2.6, p.hz * 2, T.brickDark);
      bx(k, M.stucco, p.x, 2.6, p.z, p.hx * 2 + 0.1, 0.15, p.hz * 2 + 0.1, BAND);
      continue;
    }
    const w = p.hx * 2, d = p.hz * 2, fz = p.z + p.hz;
    bx(k, M.stucco, p.x, 0, p.z, w, H, d, R);
    // Horizontal bands (Poelzig's smooth render) and the cornice.
    for (const yy of [3.6, 6.4]) bx(k, M.stucco, p.x, yy, p.z, w + 0.06, 0.28, d + 0.06, BAND);
    bx(k, M.stucco, p.x, H, p.z, w + 0.3, 0.3, d + 0.3, BAND);
    b.geo(M.slate, frustum(w, d, 0.6, w - 0.8, d - 1.2), k.F(p.x, H + 0.3, p.z), T.slate);
    b.shadowBox(k.F(p.x, H / 2, p.z), w, H, d);
    // A bulb row along the cornice (the night photos show the front drawn in light), about one in ten dead.
    b.solid.excludeOccluder(() => {
      for (let x = p.x - w / 2 + 0.25; x < p.x + w / 2; x += 0.5) if (k.rng.next() > 0.1) bx(k, M.lampGlass, x, H - 0.12, fz + 0.2, 0.08, 0.08, 0.08);
    });
    // Ribbon windows on the upper floor, three shops below.
    for (let i = 0; i < 5; i++) pane(b, k.F(p.x - w / 2 + 1.2 + i * ((w - 2.4) / 4), 5.0, fz + 0.01), 1.6, 1.4, k.rng, 0.4);
    for (let i = 0; i < 3; i++) shopFront(k, k.F(p.x - w / 2 + 2 + i * ((w - 4) / 2), 0, fz), 3.6, f++, !(p.x > 0 && i === 2));
    // The fallen awning lies on the pavement (inside the footprint).
    if (p.x > 0) b.box(M.awning, k.F(p.x + w / 2 - 2, 0.05, fz - 0.4 + 0.5, 0.2, 0), 3, 0.04, 1.0);
    // Side walls of the passage get two poster cases.
    const side = p.x < 0 ? p.x + p.hx : p.x - p.hx, out = p.x < 0 ? 1 : -1;
    bx(k, M.darkWood, side + out * 0.05, 0.6, p.z + 0.3, 0.08, 1.4, 0.9, [0.4, 0.3, 0.25]);
    sign(k, k.F(side + out * 0.1, 1.3, p.z + 0.3, out * Math.PI / 2), 0.8, 1.2, cell(ROW.posters, p.x < 0 ? 0 : 2, 4));
  }
  // The cinema front over the passage (bridging it above 4.2 m): raised block with vertical fins and the name.
  const PZ = 3, PD = 4;
  bx(k, M.stucco, 0, 4.4, PZ, 4.4, 6.2, PD, R);
  for (const x of [-1.8, -0.9, 0, 0.9, 1.8]) bx(k, M.stucco, x, 4.6, PZ + PD / 2 + 0.12, 0.28, 5.4, 0.24, BAND);
  bx(k, M.stucco, 0, 10.6, PZ, 4.8, 0.3, PD + 0.3, BAND);
  bx(k, M.iron, 0, 7.4, PZ + PD / 2 + 0.3, 4.2, 1.2, 0.1, T.ironDark);
  sign(k, k.F(0, 8.0, PZ + PD / 2 + 0.36), 4.0, 1.1, cell(ROW.pair, 0, 2));
  // The passage mouth: a bulb frame and a curved canopy, a billboard over it.
  canopy(k, 0, PZ + PD / 2, 5.4, 1.2, 4.1);
  for (const s of [-1, 1]) for (let y = 0.4; y < 4; y += 0.45) b.solid.excludeOccluder(() => b.box(M.lampGlass, k.F(s * 2.05, y, PZ + PD / 2 + 0.05), 0.08, 0.08, 0.08));
  bx(k, M.iron, 0, 5.3, PZ + PD / 2 + 0.2, 3.8, 1.3, 0.06, T.ironDark);
  sign(k, k.F(0, 5.95, PZ + PD / 2 + 0.24), 3.6, 1.2, cell(ROW.posters, 1, 4));
  // Passage ceiling and floor tiles, a ticket booth at its back.
  bx(k, M.stucco, 0, 4.2, PZ, 4.0, 0.2, PD, BAND);
  bx(k, M.concrete, 0, 0, PZ, 4.0, 0.03, PD, [0.9, 0.86, 0.8]);
  // The ticket window in the passage wall (east side), a poster case opposite.
  bx(k, M.darkWood, 1.97, 0.9, 2.2, 0.06, 1.6, 1.3, [0.45, 0.3, 0.3]);
  b.box(M.shop, k.F(1.93, 1.6, 2.2, -Math.PI / 2), 1.0, 0.7, 0.02);
  rubble(k, -13, -9, 4.4, 4.8, 5);
}

// ---------------------------------------------------------------- Kaiser-Wilhelm-Gedächtniskirche (1895)

/**
 * Kaiser-Wilhelm-Gedächtniskirche (Schwechten, 1891–1895), whole as in 1920. Photos (postcards 1900–1925):
 * light grey-ochre tuff, late Romanesque; the main tower in the west with a belfry of paired arches, four
 * corner gables and a tall slate spire; two smaller towers flanking it; a short nave, the transept with a big
 * rose window in its gable; the choir in the east with an apse between two more towers (five in all); round
 * arched windows in groups, dwarf galleries under the eaves; portals with columns* and a dark plinth*.
 * Built worn: soot, one flank spire broken, a hole in the nave roof, broken panes, rubble at the foot.
 */
function gedaechtniskirche(k: K): void {
  const { b, M, l } = k, ST = T.tuff, DK = T.tuffDark, LT = T.tuffLight, SL = T.slate, CU = T.slate;
  const rimS = { mat: M.stucco, t: LT };
  /** A rose window on `m` (wall face): dark disc, stone ring, tracery spokes and hub. */
  const rose = (m: Matrix4, r: number): void => {
    b.geo(M.dark, cached(`cw-rose${r}`, () => new CircleGeometry(r, 16)), sub(m, 0, 0, 0.03));
    b.geo(M.stucco, cached(`cw-rose-rim${r}`, () => new RingGeometry(r, r + 0.35, 16)), sub(m, 0, 0, 0.05), LT);
    for (let i = 0; i < 8; i++) b.box(M.stucco, sub(m, 0, 0, 0.06, 0, 0, (i * Math.PI) / 8), 2 * r, 0.1, 0.05, LT);
    b.geo(M.stucco, cached(`cw-rose-hub${r}`, () => new CircleGeometry(r * 0.26, 10)), sub(m, 0, 0, 0.08), LT);
  };
  /** A portal on `m` (wall face): projecting frame, deep arch, columns, a small gable over it. */
  const portal = (m: Matrix4, w: number, h: number): void => {
    b.box(M.stucco, sub(m, 0, (h + 0.8) / 2, 0.2), w + 1.6, h + 0.8, 0.4, LT);
    opening(k, sub(m, 0, 0, 0.41), w, h, { mat: M.stucco, t: DK });
    for (const x of [-(w / 2 + 0.55), -(w / 2 + 0.2), w / 2 + 0.2, w / 2 + 0.55]) b.geo(M.stucco, cy(0.12, 0.12, h - w / 2, 6), sub(m, x, (h - w / 2) / 2, 0.55), DK);
    b.geo(M.stucco, frustum(w + 2, 0.5, 1.0, 0.1, 0.5), sub(m, 0, h + 0.8, 0.2), ST);
  };
  /** A square tower with a pyramid helm (copper), an arcade storey and a cornice. */
  const tower = (x: number, z: number, w: number, h: number, helm: number, broken = false): void => {
    bx(k, M.stucco, x, 0, z, w, h, w, ST);
    for (const y of [h * 0.45, h - 0.4]) bx(k, M.stucco, x, y, z, w + 0.2, 0.3, w + 0.2, LT);
    for (const [ry, ox, oz] of [[0, 0, 1], [Math.PI, 0, -1], [-Math.PI / 2, -1, 0], [Math.PI / 2, 1, 0]] as const) {
      const m = k.F(x + ox * (w / 2 + 0.01), 0, z + oz * (w / 2 + 0.01), ry);
      for (const dx of [-w * 0.2, w * 0.2]) archWin(k, sub(m, dx, h - 3.4, 0), w * 0.26, 2.2, 0.12);
    }
    if (broken) {
      b.geo(M.slate, frustum(w + 0.1, w + 0.1, helm * 0.35, w * 0.45, w * 0.45), k.F(x, h, z), CU);
      for (let i = 0; i < 3; i++) b.box(M.darkWood, k.F(x + (i - 1) * 0.3, h + helm * 0.35 + 0.5, z, i, 0.3 * (i - 1)), 0.1, 1.1, 0.1, T.wood);
      return;
    }
    b.geo(M.slate, frustum(w + 0.1, w + 0.1, helm, 0.06, 0.06), k.F(x, h, z), CU);
    bx(k, M.enamel, x, h + helm, z, 0.08, 0.7, 0.08, T.gold);
  };
  // Plinth along the whole church.
  bx(k, M.stucco, 0.5, 0, 0, 2 * l.hx - 1.2, 1.0, 2 * l.hz - 0.4, DK);
  // Nave (x −4.4 … 2.2), 7 m wide, gable roof, a dwarf gallery under the eaves, round-arched windows.
  const NX0 = -4.4, NX1 = 2.2, NW = 7, NH = 12.5;
  bx(k, M.stucco, (NX0 + NX1) / 2, 0, 0, NX1 - NX0, NH, NW, ST);
  b.geo(M.slate, frustum(NX1 - NX0, NW + 0.4, 4.2, NX1 - NX0, 0.2, SLOPES), k.F((NX0 + NX1) / 2, NH, 0), SL);
  // The hole in the roof: dark patch and bare rafters.
  b.box(M.dark, k.F(-0.6, NH + 1.7, NW / 4 + 0.05, 0, -0.69), 2.2, 0.04, 2.2);
  for (const x of [-1.4, -0.6, 0.2]) b.box(M.darkWood, k.F(x, NH + 1.75, NW / 4 + 0.12, 0, -0.69), 0.12, 0.12, 2.6, T.wood);
  for (const s of [-1, 1]) {
    bx(k, M.stucco, (NX0 + NX1) / 2, NH - 0.9, s * (NW / 2 + 0.05), NX1 - NX0, 0.9, 0.12, LT);
    for (let x = NX0 + 0.4; x < NX1 - 0.2; x += 0.55) post(k, M.stucco, x, NH - 0.9, s * (NW / 2 + 0.16), 0.07, 0.8, LT, 5);
    for (const x of [-2.8, -0.6, 1.4]) archWin(k, k.F(x, 4.0, s * (NW / 2 + 0.01), s < 0 ? Math.PI : 0), 1.2, 4.6, 0.45, rimS);
  }
  // Transept (x 2.2 … 8.4) to the full depth, gables north and south with the rose window and a portal.
  const TX = 5.3, TW = 6.2, TH = 13.5, TD = 2 * l.hz - 1.4;
  bx(k, M.stucco, TX, 0, 0, TW, TH, TD, ST);
  const tr = k.F(TX, TH, 0, Math.PI / 2);
  b.geo(M.slate, frustum(TD, TW + 0.3, 4.4, TD, 0.2, SLOPES), tr, SL);
  b.geo(M.stucco, frustum(TD - 0.02, TW - 0.02, 4.3, TD - 0.02, 0.1, ENDS), tr, ST);
  b.shadowBox(k.F(2, NH / 2, 0), 13, NH, TD);
  for (const s of [-1, 1]) {
    const fz = s * (TD / 2 + 0.01), ry = s < 0 ? Math.PI : 0;
    rose(k.F(TX, 9.4, fz, ry), 1.75);
    for (const x of [-1.6, 1.6]) archWin(k, k.F(TX + x, 4.8, fz, ry), 0.9, 2.6, 0.45, rimS);
    // Gable arcade in steps and a cross on top.
    for (let i = 0; i < 5; i++) post(k, M.stucco, TX - 1.6 + i * 0.8, TH + 0.3, fz + s * 0.12, 0.08, 1.4 - Math.abs(i - 2) * 0.3, LT, 5);
    bx(k, M.stucco, TX, TH + 4.3, s * (TD / 2 - 0.3), 0.18, 1.0, 0.18, LT);
    bx(k, M.stucco, TX, TH + 4.9, s * (TD / 2 - 0.3), 0.6, 0.18, 0.18, LT);
    // The south portal is what the game camera sees.
    if (s > 0) portal(k.F(TX, 0, TD / 2), 1.8, 3.4);
  }
  // The crossing: an octagonal drum with a ring of gablets and arcade windows under an octagonal pyramid roof.
  b.geo(M.stucco, cy(3.0, 3.0, 3.2, 8), k.F(TX, TH + 1.6, 0), ST);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, gm = k.F(TX + Math.sin(a) * 2.78, TH + 3.2, Math.cos(a) * 2.78, a);
    b.geo(M.stucco, frustum(2.3, 0.3, 1.2, 0.1, 0.3), gm, ST);
    for (const x of [-0.45, 0.45]) archWin(k, sub(gm, x, -1.6, 0.16), 0.36, 1.3, 0.2);
  }
  b.geo(M.slate, cached('cw-crossing', () => new ConeGeometry(3.2, 8.5, 8)), k.F(TX, TH + 3.2 + 4.25, 0, Math.PI / 8), SL);
  bx(k, M.enamel, TX, TH + 11.6, 0, 0.1, 1.2, 0.1, T.gold);
  bx(k, M.enamel, TX, TH + 12.3, 0, 0.55, 0.1, 0.1, T.gold);
  // Choir (x 8.4 … 10.6) and the polygonal apse with its ring of small arched windows.
  const CX0 = 8.4, CX1 = 10.6, CW = 6, CH = 11.5;
  bx(k, M.stucco, (CX0 + CX1) / 2, 0, 0, CX1 - CX0, CH, CW, ST);
  b.geo(M.slate, frustum(CX1 - CX0, CW + 0.3, 3.4, CX1 - CX0, 0.2, SLOPES), k.F((CX0 + CX1) / 2, CH, 0), SL);
  b.geo(M.stucco, cy(2.4, 2.4, CH - 2, 7, false, 0, Math.PI), k.F(CX1, (CH - 2) / 2, 0), ST);
  b.geo(M.slate, cached('cw-apse-roof', () => new ConeGeometry(2.6, 2.4, 7, 1, false, 0, Math.PI)), k.F(CX1, CH - 2 + 1.2, 0), SL);
  for (let i = 0; i < 5; i++) { const a = 0.3 + i * 0.64; archWin(k, k.F(CX1 + Math.sin(a) * 2.32, 5.6, Math.cos(a) * 2.32, a), 0.6, 2.0, 0.4); }
  b.geo(M.stucco, cy(2.5, 2.5, 0.3, 7, false, 0, Math.PI), k.F(CX1, 4.2, 0), LT);
  // The two choir towers (four small towers in all with the west pair).
  for (const s of [-1, 1]) tower(CX0 + 0.9, s * (l.hz - 1.1), 1.9, 19, 9);
  // West front (x −13 … −10.6): a gabled porch front with three portals, the rose window, a gable arcade.
  const WX0 = -l.hx, WX1 = -10.6, WW = 8.4, WH = 12;
  bx(k, M.stucco, (WX0 + WX1) / 2, 0, 0, WX1 - WX0, WH, WW, ST);
  const wg = k.F((WX0 + WX1) / 2, WH, 0);
  b.geo(M.stucco, frustum(WX1 - WX0, WW, 4.4, WX1 - WX0, 0.2, ENDS), wg, ST);
  b.geo(M.slate, frustum(WX1 - WX0 + 0.1, WW + 0.3, 4.45, WX1 - WX0 + 0.1, 0.2, SLOPES), wg, SL);
  const wf = k.F(WX0 - 0.01, 0, 0, -Math.PI / 2);
  for (const z of [-2.4, 0, 2.4]) {
    const m = sub(wf, z, 0, 0);
    opening(k, sub(m, 0, 0, 0.4), z === 0 ? 1.8 : 1.4, z === 0 ? 3.8 : 3.2, { mat: M.stucco, t: DK });
    b.box(M.stucco, sub(m, 0, 2.2, 0.2), 2.3, 4.4, 0.4, LT);
  }
  rose(sub(wf, 0, 8.2, 0), 1.8);
  for (const z of [-1.2, 0, 1.2]) archWin(k, sub(wf, z, 12.6, 0), 0.6, 1.6, 0.2);
  // South face of the front block (camera side): a portal and a window over it.
  portal(k.F((WX0 + WX1) / 2, 0, WW / 2), 1.2, 2.8);
  archWin(k, k.F((WX0 + WX1) / 2, 6.2, WW / 2 + 0.01), 0.9, 3.0, 0.4, rimS);
  // Flank towers at the west corners: slim, a pointed copper helm each (the south one lost its tip).
  for (const s of [-1, 1]) tower(-l.hx + 0.95, s * (l.hz - 0.95), 1.8, 18.5, 7, s > 0);
  // Main tower rising behind the west front: shaft, clock, belfry, four corner gables, pinnacles, spire.
  const MX = -7.5, MW = 6.2, MH = 30;
  bx(k, M.stucco, MX, 0, 0, MW, MH, MW, ST);
  for (const y of [WH + 0.6, 22.5]) bx(k, M.stucco, MX, y, 0, MW + 0.3, 0.35, MW + 0.3, LT);
  b.shadowBox(k.F(MX, MH / 2, 0), MW, MH, MW);
  for (const [ry, ox, oz] of [[0, 0, MW / 2 + 0.01], [Math.PI, 0, -MW / 2 - 0.01], [-Math.PI / 2, -MW / 2 - 0.01, 0]] as const) {
    const m = k.F(MX + ox, 0, oz, ry);
    for (const x of [-1.0, 1.0]) archWin(k, sub(m, x, 15.0, 0), 0.8, 3.4, 0.3, rimS);
    b.geo(M.clock, cached('cw-kwg-clock', () => new CircleGeometry(0.95, 18)), sub(m, 0, 20.6, 0.06));
    b.geo(M.stucco, cached('cw-kwg-clockrim', () => new RingGeometry(0.95, 1.2, 18)), sub(m, 0, 20.6, 0.05), LT);
    for (const x of [-1.9, -0.65, 0.65, 1.9]) archWin(k, sub(m, x, 23.6, 0), 0.75, 4.6, 0.12, rimS);
  }
  const GY = MH;
  bx(k, M.stucco, MX, MH - 0.4, 0, MW + 0.4, 0.4, MW + 0.4, LT);
  for (const [ry, ox, oz] of [[0, 0, 1], [Math.PI / 2, 1, 0], [Math.PI, 0, -1], [-Math.PI / 2, -1, 0]] as const) {
    const g = k.F(MX + ox * (MW / 2), GY, oz * (MW / 2), ry);
    b.geo(M.stucco, frustum(MW - 1.2, 0.4, 3.0, 0.2, 0.4), sub(g, 0, 0, -0.2), ST);
    for (const x of [-0.7, 0.7]) archWin(k, sub(g, x, 0.4, 0.01), 0.55, 1.7, 0.1);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    post(k, M.stucco, MX + sx * (MW / 2 - 0.35), GY, sz * (MW / 2 - 0.35), 0.38, 2.2, ST, 6);
    b.geo(M.slate, cached('cw-pin', () => new ConeGeometry(0.45, 3.2, 6)), k.F(MX + sx * (MW / 2 - 0.35), GY + 3.8, sz * (MW / 2 - 0.35)), CU);
  }
  b.geo(M.slate, cy(0.08, MW / 2 - 0.5, 26, 8), k.F(MX, GY + 13, 0), CU);
  b.geo(M.enamel, ball(6, 4), k.F(MX, GY + 26.2, 0).multiply(new Matrix4().makeScale(0.3, 0.4, 0.3)), T.gold);
  bx(k, M.enamel, MX, GY + 26.4, 0, 0.12, 1.6, 0.12, T.gold);
  bx(k, M.enamel, MX, GY + 27.3, 0, 0.7, 0.12, 0.12, T.gold);
  // Steps before the south portals, rubble at the foot of the south side.
  for (let i = 0; i < 3; i++) bx(k, M.stucco, TX, 0, l.hz - 0.35 - i * 0.12, 4.6 - i * 0.5, 0.1 * (i + 1), 0.6 - i * 0.24, DK);
  rubble(k, -12.5, 12, l.hz - 0.6, l.hz - 0.05, 12, ST);
  rubble(k, -2, 1.5, NW / 2 + 0.2, NW / 2 + 1.2, 5, T.slate);
}

// ---------------------------------------------------------------- Romanisches Haus II with the café

/**
 * Romanisches Haus II (Schwechten, 1901) east of the church, home of the Romanisches Café. Photos: rough
 * light sandstone in the church's neo-Romanesque style, a corner tower with a pointed helm, round-arched
 * window groups on short columns, a stepped gable with a dwarf gallery; on the ground floor the café behind an
 * arcade of round arches* with its name over it*, tables and chairs inside the arcade*. Built worn: soot,
 * boarded windows, one arch filled with sandbags, rubble.
 */
function romanischescafe(k: K): void {
  const { b, M, l } = k, ST = T.sand, LT = T.stone, DK = T.sandDark, H = 14, FZ = l.hz - 2.2;
  const rim = { mat: M.stucco, t: LT };
  bx(k, M.stucco, 0, 0, (FZ - l.hz) / 2, 2 * l.hx, H, FZ + l.hz, ST);
  // The arcade storey in front: piers with arches, the café sign over them, the loggia ceiling.
  bx(k, M.stucco, 0, 3.8, (FZ + l.hz) / 2, 2 * l.hx, H - 3.8, l.hz - FZ, ST);
  for (const x of [-4.5, -1.5, 1.5, 4.5]) bx(k, M.stucco, x, 0, l.hz - 0.4, x === -4.5 || x === 4.5 ? 1.0 : 0.7, 3.8, 0.8, DK);
  for (const x of [-3, 0, 3]) {
    b.geo(M.stucco, cached('cw-rc-arch', () => new RingGeometry(1.15, 1.5, 10, 1, 0, Math.PI)), k.F(x, 2.6, l.hz + 0.01), LT);
    b.geo(M.stucco, cached('cw-rc-spandrel', () => new RingGeometry(1.5, 2.2, 10, 1, 0, Math.PI)), k.F(x, 2.6, l.hz - 0.01), ST);
    post(k, M.stucco, x - 1.05, 0, l.hz - 0.4, 0.12, 2.6, LT, 6);
    post(k, M.stucco, x + 1.05, 0, l.hz - 0.4, 0.12, 2.6, LT, 6);
  }
  bx(k, M.stucco, 0, 3.6, l.hz - 0.4, 2 * l.hx, 0.25, 0.9, LT);
  sign(k, k.F(0, 4.35, l.hz + 0.02), 6.4, 0.75, cell(ROW.cafe));
  // Café front inside the loggia: big windows and the door; tables and chairs, one arch sandbagged.
  for (const x of [-3, 0, 3]) {
    if (x === 3) { for (let i = 0; i < 4; i++) bx(k, M.burlap, 3 + (i % 2 ? 0.3 : -0.3), i * 0.3, FZ + 1.2, 1.2, 0.3, 0.6, [0.85, 0.75, 0.6]); continue; }
    b.box(x === 0 ? M.door : M.shop, k.F(x, 1.5, FZ + 0.03), 2.0, 2.8, 0.04);
  }
  for (const x of [-3.2, -0.6, 1.6]) {
    post(k, M.iron, x, 0, FZ + 1.0, 0.04, 0.72, T.ironDark, 5);
    b.geo(M.enamel, cy(0.35, 0.35, 0.04, 10), k.F(x, 0.74, FZ + 1.0), T.pearl);
    for (const s of [-1, 1]) {
      const fallen = x === 1.6 && s > 0;
      bx(k, M.darkWood, x + s * 0.55, fallen ? 0 : 0.42, FZ + 1.0, 0.36, fallen ? 0.36 : 0.05, 0.36, T.wood, fallen ? 1.2 : 0);
      if (!fallen) bx(k, M.darkWood, x + s * 0.72, 0.45, FZ + 1.0, 0.04, 0.45, 0.36, T.wood);
    }
  }
  // Upper floors: paired round-arched windows on short columns.
  for (const y of [5.4, 8.6]) for (const x of [-3.4, -1.1, 1.1, 3.4]) {
    archWin(k, k.F(x - 0.38, y, l.hz + 0.01), 0.6, 2.2, 0.35, rim);
    archWin(k, k.F(x + 0.38, y, l.hz + 0.01), 0.6, 2.2, 0.35, rim);
    post(k, M.stucco, x, y, l.hz + 0.08, 0.06, 1.7, LT, 5);
  }
  for (const y of [4.9, 8.1, 11.3]) bx(k, M.stucco, 0, y, l.hz + 0.05, 2 * l.hx, 0.2, 0.12, LT);
  for (const s of [-1, 1]) for (const y of [5.4, 8.6]) for (const z of [-2.2, 0.6]) archWin(k, k.F(s * (l.hx + 0.01), y, z, s * Math.PI / 2), 0.7, 2.2, 0.3, rim);
  // Stepped gable with a dwarf arcade, roof behind, corner tower at the south-west (toward the church).
  b.geo(M.slate, frustum(2 * l.hx, 2 * l.hz, 3.6, 2 * l.hx, 0.2, SLOPES), k.F(0, H, 0, Math.PI / 2 * 0), T.slate);
  for (let i = 0; i < 4; i++) bx(k, M.stucco, 0.8, H + i * 1.0, l.hz - 0.2, 7.0 - i * 1.6, 1.0, 0.5, ST);
  for (let i = 0; i < 6; i++) post(k, M.stucco, -1.2 + i * 0.8, H + 0.1, l.hz + 0.08, 0.07, 0.8, LT, 5);
  archWin(k, k.F(0.8, H + 1.2, l.hz + 0.06), 0.6, 1.5, 0.2);
  b.shadowBox(k.F(0, H / 2, 0), 2 * l.hx, H, 2 * l.hz);
  // The square corner tower toward the church: arcaded top storey, corner pinnacles, a slate helm.
  const tx = -l.hx + 1.4, tz = l.hz - 1.4, TW = 2.8, TH = H + 4.5;
  bx(k, M.stucco, tx, 0, tz, TW, TH, TW, ST);
  for (const y of [H - 0.3, TH - 0.3]) bx(k, M.stucco, tx, y, tz, TW + 0.2, 0.3, TW + 0.2, LT);
  for (const [ry, ox, oz] of [[0, 0, 1], [-Math.PI / 2, -1, 0]] as const) {
    const m = k.F(tx + ox * (TW / 2 + 0.01), 0, tz + oz * (TW / 2 + 0.01), ry);
    for (const y of [5.4, 8.6]) archWin(k, sub(m, 0, y, 0), 0.8, 2.2, 0.3, rim);
    for (const x of [-0.85, 0, 0.85]) archWin(k, sub(m, x, H + 1.2, 0), 0.6, 2.4, 0.15);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.geo(M.slate, cached('cw-rc-pin', () => new ConeGeometry(0.22, 1.2, 6)), k.F(tx + sx * (TW / 2 - 0.15), TH + 0.6, tz + sz * (TW / 2 - 0.15)), T.slate);
  b.geo(M.slate, frustum(TW, TW, 4.2, 0.1, 0.1), k.F(tx, TH, tz), T.slate);
  rubble(k, -l.hx + 0.3, l.hx - 0.3, l.hz - 0.25, l.hz - 0.05, 5, ST);
}

// ---------------------------------------------------------------- KaDeWe (1907)

/**
 * Kaufhaus des Westens (Emil Schaudt, 1907) on the Tauentzienstraße. Photos (1907 to 1930): a sober sandstone
 * front of tall piers with big shop windows between them, a cornice and a hipped roof with dormers, the
 * name in gilt capitals; inside, the Lichthof: galleries round a glass-roofed hall, cast-iron columns,
 * counters and display cases. Game (E2): a roofless ruin entered through two street doors; the north front
 * stands at 17 m with the name on its roof edge (both faces), the sides fall toward the camera, the camera-side
 * wall stays low and broken. Inside*: the gallery stubs with balustrades on the north and side walls, iron
 * columns, counters and mannequins along the walls, the skylight's iron frame hanging, glass shards on the floor.
 * The hall floor stays clear for the fight (`OPEN_PARTS.kadewe`).
 */
function kadewe(k: K): void {
  const { b, M, l } = k, parts = OPEN_PARTS.kadewe!, hz = l.hz, TALL = 17, LOW = 3.6, ST: RGB = [1.04, 0.98, 0.86], DK = T.sandDark;
  const hAt = (z: number): number => LOW + (TALL - LOW) * Math.max(0, Math.min(1, (hz - 1 - z) / (2 * hz - 2)));
  const north = parts.filter((p) => p.hz < 1 && p.z < 0), south = parts.filter((p) => p.hz < 1 && p.z > 0), sides = parts.filter((p) => p.hz >= 1);
  const NZ = north[0]!.z, nf = NZ - 0.5, ni = NZ + 0.5;
  // North front: wall pieces between the doors, full height; lintels over the doors.
  for (const p of north) bx(k, M.stucco, p.x, 0, p.z, p.hx * 2, TALL, p.hz * 2, ST);
  const xs = [...north].sort((a, c) => a.x - c.x), doors: Array<[number, number]> = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1]!, q = xs[i]!, x0 = a.x + a.hx, x1 = q.x - q.hx;
    doors.push([x0, x1]);
    bx(k, M.stucco, (x0 + x1) / 2, 4.4, NZ, x1 - x0 + 0.1, TALL - 4.4, 1, ST);
  }
  b.shadowBox(k.F(0, TALL / 2, NZ), 2 * l.hx, TALL, 1);
  // Street face (outside, north): tall piers, shop windows between them, a cornice, the dormer roof edge.
  const bays = 15, bw = (2 * l.hx) / bays;
  for (let i = 0; i <= bays; i++) {
    const x = -l.hx + i * bw;
    bx(k, M.stucco, x, 0.8, nf - 0.2, 0.7, TALL - 2.6, 0.4, ST);
  }
  for (let i = 0; i < bays; i++) {
    const x = -l.hx + (i + 0.5) * bw;
    if (doors.some(([a, c]) => x > a - 0.5 && x < c + 0.5)) continue;
    archWin(k, k.F(x, 0.9, nf - 0.01, Math.PI), bw - 0.9, 3.4, 0.4);
    for (const y of [6.6, 10.2, 13.4]) pane(b, k.F(x, y, nf - 0.01, Math.PI), bw - 1.0, y > 13 ? 1.8 : 2.6, k.rng, 0.3);
  }
  // Door arches to the street.
  for (const [a, c] of doors) opening(k, k.F((a + c) / 2, 0, nf - 0.02, Math.PI), c - a, 4.2, { mat: M.stucco, t: DK });
  // Two oriel turrets either side of the middle, corbelled out over the street, with domed caps.
  for (const x of [-4.2, 4.2]) {
    b.geo(M.stucco, cy(1.2, 0.3, 1.2, 10), k.F(x, 4.4, nf - 0.9), ST);
    b.geo(M.stucco, cy(1.2, 1.2, TALL - 5.0, 10), k.F(x, 5.0 + (TALL - 5.0) / 2, nf - 0.9), ST);
    for (const y of [6.6, 10.2, 13.4]) for (const a of [-0.6, 0, 0.6]) pane(b, k.F(x + Math.sin(Math.PI + a) * 1.21, y, nf - 0.9 + Math.cos(Math.PI + a) * 1.21, Math.PI + a), 0.6, 2.0, k.rng, 0.3);
    b.geo(M.slate, half(12), k.F(x, TALL + 0.2, nf - 0.9).multiply(new Matrix4().makeScale(1.3, 1.6, 1.3)), T.slate);
    post(k, M.enamel, x, TALL + 1.7, nf - 0.9, 0.08, 0.9, T.copper, 6, 0.03);
  }
  bx(k, M.stucco, 0, TALL - 1.8, nf - 0.3, 2 * l.hx, 0.5, 0.6, DK);
  bx(k, M.stucco, 0, 0, nf - 0.15, 2 * l.hx, 0.8, 0.3, DK);
  // The mansard of the front survives as a strip with broken dormers; the name board stands on it, readable
  // from both sides (street and hall).
  bx(k, M.stucco, 0, TALL, NZ, 2 * l.hx, 0.7, 1.1, DK);
  b.box(M.slate, k.F(0, TALL + 1.2, nf - 0.2, 0, 0.5), 2 * l.hx, 0.12, 2.0, T.slate);
  for (let x = -l.hx + 2.5; x < l.hx - 2; x += 4.5) if (Math.abs(x) > 6) {
    bx(k, M.stucco, x, TALL + 0.6, nf - 0.05, 1.0, 1.2, 0.5, ST);
    pane(b, k.F(x, TALL + 1.15, nf - 0.31, Math.PI), 0.6, 0.7, k.rng, 0.2);
  }
  bx(k, M.iron, 0, TALL + 0.7, NZ, 28.4, 2.0, 0.12, T.ironDark);
  for (const x of [-13, -4.5, 4.5, 13]) beam(k, M.iron, new Vector3(x, TALL + 0.7, NZ + 0.5), new Vector3(x, TALL + 2.5, NZ + 0.06), 0.06, 0.06, T.ironDark);
  sign(k, k.F(0, TALL + 1.7, NZ + 0.07), 28, 1.8, cell(ROW.kadewe), false);
  sign(k, k.F(0, TALL + 1.7, NZ - 0.07, Math.PI), 28, 1.8, cell(ROW.kadewe), false);
  // Hall face of the north wall: floor slabs broken off as galleries with balustrades, door frames.
  const floors = [4.4, 8.2, 12.0];
  for (const y of floors) {
    bx(k, M.concrete, 0, y - 0.35, ni + 0.9, 2 * l.hx - 1.2, 0.35, 1.8, [0.9, 0.86, 0.8]);
    bx(k, M.stucco, 0, y - 0.65, ni + 1.75, 2 * l.hx - 1.2, 0.3, 0.12, ST);
    for (let x = -l.hx + 1.2; x < l.hx - 1; x += 0.9) if (k.rng.next() > 0.12) bx(k, M.iron, x, y, ni + 1.72, 0.05, 0.95, 0.05, T.iron);
    bx(k, M.enamel, 0, y + 0.95, ni + 1.72, 2 * l.hx - 1.4, 0.07, 0.1, T.gold);
  }
  // Hall face windows above the galleries (the light court storeys) and pilasters.
  for (let i = 0; i < 8; i++) {
    const x = -l.hx + 3 + i * ((2 * l.hx - 6) / 7);
    for (const y of [6.0, 9.8, 13.8]) pane(b, k.F(x, y, ni + 0.01), 1.6, 2.2, k.rng, 0.25);
  }
  // Cast-iron columns under the galleries (along the north wall, at the gallery edge).
  for (let i = 0; i < 10; i++) {
    const x = -l.hx + 2.5 + i * ((2 * l.hx - 5) / 9);
    if (doors.some(([a, c]) => x > a - 1 && x < c + 1)) continue;
    post(k, M.iron, x, 0, ni + 1.6, 0.14, 4.05, T.iron, 8);
    bx(k, M.iron, x, 3.8, ni + 1.6, 0.5, 0.25, 0.5, T.gold);
  }
  // Side walls in pieces falling toward the camera; galleries on them where they are tall enough.
  for (const p of sides) {
    const n = Math.ceil((p.hz * 2) / 2);
    for (let i = 0; i < n; i++) {
      const z0 = p.z - p.hz + (i * p.hz * 2) / n, z1 = p.z - p.hz + ((i + 1) * p.hz * 2) / n, zc = (z0 + z1) / 2;
      const h = Math.max(0.8, hAt(zc) * k.rng.range(0.82, 1.04));
      bx(k, M.stucco, p.x, 0, zc, p.hx * 2, h, z1 - z0 + 0.02, ST);
      const inner = p.x - Math.sign(p.x) * (p.hx + 0.01);
      if (h > 6) pane(b, k.F(inner, 5.6, zc, -Math.sign(p.x) * Math.PI / 2), 1.2, 2.0, k.rng, 0.2);
      // Outer face toward the side streets: tall shop windows below, windows above where the wall still stands.
      const outer = p.x + Math.sign(p.x) * (p.hx + 0.01), ry = Math.sign(p.x) * Math.PI / 2;
      if (h > 3.4) pane(b, k.F(outer, 1.9, zc, ry), 1.3, 2.6, k.rng, 0.3);
      for (const y of [6.6, 10.2, 13.4]) if (h > y + 1.4) pane(b, k.F(outer, y, zc, ry), 1.1, 2.2, k.rng, 0.25);
      for (const y of floors) if (h > y + 0.5) {
        bx(k, M.concrete, inner - Math.sign(p.x) * 0.7, y - 0.35, zc, 1.4, 0.35, z1 - z0 + 0.02, [0.9, 0.86, 0.8]);
        bx(k, M.enamel, inner - Math.sign(p.x) * 1.35, y + 0.95, zc, 0.08, 0.07, z1 - z0, T.gold);
        for (let zz = z0 + 0.45; zz < z1; zz += 0.9) bx(k, M.iron, inner - Math.sign(p.x) * 1.35, y, zz, 0.05, 0.95, 0.05, T.iron);
      }
    }
  }
  // Camera-side wall: low and broken (the collider stays whole), the old shop window sills.
  for (const p of south) {
    const n = Math.ceil((p.hx * 2) / 1.6);
    for (let i = 0; i < n; i++) {
      const x0 = p.x - p.hx + (i * p.hx * 2) / n, x1 = p.x - p.hx + ((i + 1) * p.hx * 2) / n;
      bx(k, M.stucco, (x0 + x1) / 2, 0, p.z, x1 - x0 + 0.02, k.rng.range(0.5, 2.0), p.hz * 2, ST);
    }
    bx(k, M.stucco, p.x, 0, p.z + p.hz + 0.1, p.hx * 2, 0.5, 0.2, DK);
  }
  // Counters and glass display cases along the walls (inside the 2 m edge), mannequins, a fallen chandelier.
  for (let x = -l.hx + 3; x < l.hx - 3; x += 4.4) {
    if (doors.some(([a, c]) => x > a - 2.2 && x < c + 2.2)) continue;
    bx(k, M.darkWood, x, 0, ni + 0.9, 3.4, 0.95, 0.8, [0.6, 0.45, 0.36]);
    b.box(M.glass, k.F(x, 1.2, ni + 0.9), 3.2, 0.5, 0.7);
    bx(k, M.enamel, x, 0.95, ni + 0.9, 3.5, 0.05, 0.85, T.gold);
  }
  for (const s of [-1, 1]) for (const z of [-9, -3, 3]) {
    const x = s * (l.hx - 1.9);
    bx(k, M.darkWood, x, 0, z, 0.8, 0.95, 3.0, [0.6, 0.45, 0.36]);
    if (k.rng.next() < 0.7) b.box(M.glass, k.F(x, 1.2, z), 0.7, 0.5, 2.8);
  }
  const dress: RGB[] = [T.violet, T.berry, T.pearl, T.teal, T.violet];
  [[-16, -12.5], [-12, -12.8], [2.5, -12.6], [14, -12.4], [17.5, -12.8]].forEach(([x, z], i) => mannequin(k, k.F(x!, 0, z!, k.rng.range(-0.5, 0.5)), dress[i]!, i === 3));
  const ch = k.F(-4, 0, 2.5);
  b.geo(M.enamel, cached('cw-chandelier', () => new TorusGeometry(1.1, 0.08, 4, 14)), sub(ch, 0, 0.12, 0, 0, Math.PI / 2 - 0.15), T.gold);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.geo(M.glass, cached('cw-prism', () => new ConeGeometry(0.08, 0.35, 4)), sub(ch, Math.sin(a) * 1.1, 0.2, Math.cos(a) * 1.1, 0, Math.PI / 2 + 0.4)); }
  // The skylight: iron ribs hanging from the north wall top and from the sides, the frame ring partly left.
  for (let x = -l.hx + 4; x < l.hx - 3; x += 5.5) {
    const len = k.rng.range(6, 11);
    beam(k, M.iron, new Vector3(x, TALL, ni), new Vector3(x + k.rng.range(-1, 1), TALL - len * 0.75, ni + len * 0.6), 0.18, 0.22, T.iron);
  }
  for (const s of [-1, 1]) beam(k, M.iron, new Vector3(s * (l.hx - 1), 12, -8), new Vector3(s * (l.hx - 4), 6.5, -2), 0.16, 0.2, T.iron);
  bx(k, M.iron, 0, TALL - 0.2, ni + 0.3, 2 * l.hx - 2, 0.2, 0.25, T.iron);
  for (let i = 0; i < 40; i++) b.box(M.glass, k.F(k.rng.range(-l.hx + 2, l.hx - 2), 0.02, k.rng.range(-hz + 2, hz - 2), k.rng.range(0, 3)), k.rng.range(0.12, 0.45), 0.02, k.rng.range(0.12, 0.45));
  // Rubble from the fallen roof along the inner walls, a heap in the south-west corner.
  rubble(k, -l.hx + 1.5, l.hx - 1.5, -hz + 2.2, -hz + 3.4, 12, ST);
  rubble(k, -l.hx + 1.2, -l.hx + 5, hz - 4, hz - 1.2, 10, ST);
  rubble(k, l.hx - 4, l.hx - 1.2, hz - 3, hz - 1.2, 6, ST);
}

// ---------------------------------------------------------------- U-Bahnhof Wittenbergplatz (1913)

/**
 * U-Bahnhof Wittenbergplatz entrance hall (Alfred Grenander, 1913), in the middle of the square. Photo (1920s,
 * from the Tauentzien with the church behind): a cross-shaped pavilion in light render, the square middle hall
 * raised with a ring of clerestory windows between piers under a hipped roof, lower arms with hipped roofs and a
 * glazed ridge, a row of windows under their eaves on a plain plinth, and at the arm end a pediment with a crest
 * over three doors between square pillars*, lettered panels over the doors*, lanterns*. Built worn: soot, a
 * boarded door, broken panes, a hole in an arm roof, rubble. Local z runs along the square; the arms reach north
 * and south (the footprint has no room for the east and west ones).
 */
function wittenbergplatz(k: K): void {
  const { b, M, l } = k, ST: RGB = [1.1, 1.07, 0.98], DK = T.sandDark, LT = T.stone, H = 5.4, W = 2 * l.hx - 0.4, D = 2 * l.hz - 0.4;
  // The arms (one long body along z) with their hipped roof, the glazed ridge strip and the window row.
  bx(k, M.stucco, 0, 0, 0, W, H, D, ST);
  bx(k, M.stucco, 0, 0, 0, W + 0.12, 1.1, D + 0.12, DK);
  bx(k, M.stucco, 0, H - 0.1, 0, W + 0.5, 0.4, D + 0.5, LT);
  b.geo(M.slate, frustum(W + 0.5, D + 0.5, 2.0, 1.2, D - 3.5), k.F(0, H + 0.3, 0), T.slate);
  for (const s of [-1, 1]) b.box(M.glass, k.F(0, H + 2.32, s * 4.6), 1.0, 0.06, 4.2);
  b.box(M.dark, k.F(0.9, H + 1.2, 5.5, 0, 0, -0.75), 1.2, 0.04, 1.6);
  b.shadowBox(k.F(0, H / 2, 0), W, H, D);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const z = -D / 2 + 1.4 + i * ((D - 2.8) / 6);
    if (Math.abs(z) < 2.6) continue;
    pane(b, k.F(s * (W / 2 + 0.02), 3.6, z, s * Math.PI / 2), 1.3, 1.5, k.rng, 0.4);
    bx(k, M.stucco, s * (W / 2 + 0.06), 2.7, z, 0.1, 0.12, 1.6, LT);
  }
  // The raised middle hall: piers and clerestory windows, a cornice, the hipped roof with a finial.
  const CW = W, CH = 8.8;
  bx(k, M.stucco, 0, H, 0, CW - 0.8, CH - H, CW - 0.8, ST);
  for (let i = 0; i < 4; i++) for (const [ry, ox, oz] of [[0, 0, 1], [Math.PI, 0, -1], [Math.PI / 2, 1, 0], [-Math.PI / 2, -1, 0]] as const) {
    const t = -CW / 2 + 0.4 + (i + 0.5) * ((CW - 0.8) / 4), x = ox ? ox * (CW / 2 - 0.39) : t, z = oz ? oz * (CW / 2 - 0.39) : t;
    pane(b, k.F(x, H + 1.85, z, ry), 1.1, 1.6, k.rng, 0.45);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(k, M.stucco, sx * (CW / 2 - 0.45), H, sz * (CW / 2 - 0.45), 0.5, CH - H, 0.5, LT);
  bx(k, M.stucco, 0, CH, 0, CW + 0.2, 0.45, CW + 0.2, LT);
  b.geo(M.slate, frustum(CW + 0.2, CW + 0.2, 2.6, 0.6, 0.6), k.F(0, CH + 0.45, 0), T.slate);
  post(k, M.enamel, 0, CH + 3.05, 0, 0.1, 0.8, T.copper, 6, 0.04);
  // The south end (camera side): pediment with a crest, three doors between square pillars, panels over them.
  const fz = D / 2;
  for (const x of [-2.7, -0.9, 0.9, 2.7]) bx(k, M.stucco, x, 0, fz + 0.15, 0.6, H - 0.1, 0.3, LT);
  for (const [i, x] of [-1.8, 0, 1.8].entries()) {
    const m = k.F(x, 0, fz + 0.02);
    if (i === 2) {
      b.box(M.dark, sub(m, 0, 1.35, 0.03), 1.2, 2.7, 0.04);
      for (let j = 0; j < 4; j++) b.box(M.darkWood, sub(m, 0, 0.5 + j * 0.62, 0.08, 0, 0, k.rng.range(-0.15, 0.15)), 1.3, 0.2, 0.04, T.wood);
    } else b.box(M.door, sub(m, 0, 1.35, 0.03), 1.2, 2.7, 0.04);
    bx(k, M.darkWood, x, 3.0, fz + 0.04, 1.3, 0.55, 0.06, [0.3, 0.25, 0.22]);
    sign(k, k.F(x, 3.27, fz + 0.08), 1.2, 0.45, i === 1 ? cell(ROW.ubahn, 0, 2) : cell(ROW.shops, 5, 6));
  }
  bx(k, M.stucco, 0, H - 0.1, fz + 0.2, W + 0.6, 0.45, 0.4, LT);
  b.geo(M.stucco, frustum(W + 0.6, 0.4, 1.5, 0.2, 0.4), k.F(0, H + 0.35, fz + 0.2), LT);
  blob(k, M.stucco, k.F(0, H + 0.95, fz + 0.42), 0.38, 0.45, 0.08, DK, 8);
  for (const s of [-1, 1]) lantern(k, s * 3.5, l.hz - 0.15, 2.8);
  // The north end: the same pediment, one door.
  b.geo(M.stucco, frustum(W + 0.6, 0.4, 1.5, 0.2, 0.4), k.F(0, H + 0.35, -fz - 0.2), LT);
  b.box(M.door, k.F(0, 1.35, -fz - 0.02, Math.PI), 1.4, 2.7, 0.04);
  rubble(k, -l.hx + 0.2, -1.5, l.hz - 0.5, l.hz - 0.05, 5, ST);
}

// ---------------------------------------------------------------- entry

/** Draws `c.l` if it is one of this file's kinds; false otherwise. */
export function buildCitywest(c: Ctx): boolean {
  if (!CITYWEST_KINDS.has(c.l.kind)) return false;
  const k: K = { ...c, F: frameOf(c.l), S: signMat(c.M) };
  const fn: Partial<Record<LandmarkKind, (k: K) => void>> = {
    zoobahnhof, loewentor, elefantentor, aquarium, musikpavillon, antilopenhaus, ufapalast, capitol, gedaechtniskirche, romanischescafe, kadewe, wittenbergplatz,
  };
  const f = fn[c.l.kind];
  if (!f) return false;
  f(k);
  return true;
}
