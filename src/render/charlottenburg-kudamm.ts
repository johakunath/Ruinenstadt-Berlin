// M16 Charlottenburg step 4: Ku'damm, Kantstraße and Bismarckstraße: cinemas, cafés, theatres, the opera, the Hochschule and the Tor.
// Built from pre-1930 photos (`docs/maps/landmarks.md`, `docs/tasks/m16-charlottenburg.md`). This file owns these kinds:
//   gloriapalast marmorhaus cafewestens revuepalast theaterwestens variete
//   opernhaus schillertheater hochschule chtor chrathaus
//
// Contract: `buildKudamm` returns true when it drew the landmark, false otherwise; `buildCharlottenburgLandmark`
// asks this file, then the other two, then falls back to the step 2 massing in `charlottenburg-world.ts`.
// Helpers (box `blk`, `cyl`, `dome`, `roof`, `windows`, `house`, `figure`, `columns`, `bars`, `openHall`, the
// frame `lm`, the geometry cache `cached`, the 1920 tints `C`, the context `Ctx`) come from there; do not edit
// that file. Colliders stay in `src/data`; this only draws. Check a kind with `tools/landmark-sheet.mjs`.
//
// Every sight is worn (guideline 2026-11-18, no graffiti in 1920): soot and cracks come from `landmark-wear.ts` on the
// stucco boxes; here: boarded and broken windows, missing pieces, rubble and shards at the foot.
// Cues per kind (* = below 5 m, what the game camera sees) are listed at each builder.
//
// Cost: one new material, the Ku'damm sign atlas (`atlas`, 1024 × 1280 since 2026-11-19, map + emissive map: lettering, white
// and pink marquee bulbs, the lit foyer and Varieté hall, posters, velvet, fan glass and marble, the strip of eight peeling
// period posters from `paintPosters` at the foot), cached per map materials; one draw call
// per chunk where it is in view. No lights: bulbs and lit foyers are emissive atlas cells. Everything else is merged
// into the shared batches (stucco, slate, enamel, iron, glass, dark, darkWood, lampGlass, clock, ivy cards).
import { BufferGeometry, CircleGeometry, CylinderGeometry, Matrix4, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, type Material } from 'three';
import { OPEN_PARTS, type LandmarkKind } from '../data/map';
import { Rng } from '../sim/math';
import { battens, C, cached, paintPosters, POSTERS, POSTER_CELL, sandbags, scaffold, shutter, slope, tarp, type Ctx, type Grime, type RGB } from './charlottenburg-world';
import { archHead, ENDS, frameOf, frustum, pane, sub, type Frame } from './landmarks';
import type { MapMats } from './map-world';
import type { LitMaterial } from './materials';
import { canvas, toTexture } from './paint';

/** The kinds this file owns (one builder each once step 4 is done). */
export const KUDAMM_KINDS: ReadonlySet<LandmarkKind> = new Set<LandmarkKind>(['gloriapalast', 'marmorhaus', 'cafewestens', 'revuepalast', 'theaterwestens', 'variete', 'opernhaus', 'schillertheater', 'hochschule', 'chtor', 'chrathaus']);

/**
 * Worn surfaces per sight (Johannes 2026-11-19: too even, too clean): the recipe of the shared pass in
 * `charlottenburg-world.ts` (`weather`). The cinemas and theatres keep their fronts readable (soot high up,
 * grime low); the Café des Westens and the Schiller-Theater are the shabbiest render; stone gets moss.
 */
export const GRIME: Partial<Record<LandmarkKind, Grime>> = {
  gloriapalast: { tris: 260, drift: 0.21, bay: 2.4, damp: 0.9, moss: 0.6, soot: 0.8, sootBays: 0.25, stains: 2.9, streaks: 2, ghosts: 0.5 },
  marmorhaus: { tris: 100, drift: 0.24, bay: 2.2, damp: 0.7, soot: 0.6, stains: 2.4, streaks: 3, spall: 0.6 },
  cafewestens: { tris: 240, drift: 0.39, bay: 2.4, damp: 0.9, soot: 0.8, sootBays: 0.45, stains: 2.9, streaks: 1.5, spall: 1.1, patch: 1.0, ghosts: 0.8 },
  revuepalast: { tris: 210, drift: 0.27, bay: 2.6, damp: 0.7, soot: 0.6, stains: 2.2, streaks: 1.5, spall: 0.6, ghosts: 0.4 },
  theaterwestens: { tris: 340, drift: 0.24, bay: 2.2, damp: 0.8, moss: 0.4, soot: 0.9, sootBays: 0.35, stains: 2.6, streaks: 2.5, spall: 0.5, patch: 0.5 },
  variete: { tris: 40, drift: 0.18, damp: 0.8, moss: 0.6, soot: 0.3, stains: 1.6 },
  opernhaus: { tris: 320, drift: 0.18, bay: 2.6, damp: 1.0, moss: 0.4, soot: 0.8, sootBays: 0.3, stains: 3.2, streaks: 3, patch: 0.6 },
  schillertheater: { tris: 190, drift: 0.33, bay: 2.4, damp: 0.8, soot: 0.7, sootBays: 0.35, stains: 2.6, streaks: 1.5, spall: 1.1, patch: 0.7, ghosts: 1.0 },
  hochschule: { tris: 220, drift: 0.21, bay: 2.6, damp: 0.9, moss: 0.7, soot: 0.6, sootBays: 0.2, stains: 2.6, streaks: 2, patch: 0.4 },
  chtor: { tris: 170, drift: 0.18, bay: 1.8, damp: 1.1, moss: 0.9, soot: 0.5, stains: 4, streaks: 2 },
  chrathaus: { tris: 240, drift: 0.22, bay: 2.4, damp: 0.9, moss: 0.4, soot: 0.8, sootBays: 0.25, stains: 2.6, streaks: 2.5, spall: 0.5, ghosts: 0.8 },
};

// ---------------------------------------------------------------- sign atlas (the one new material)

type Region = readonly [number, number, number, number];
const R = {
  revue: [0, 0, 512, 176], gloria: [512, 0, 512, 88], marmor: [512, 88, 512, 88],
  westens: [0, 176, 512, 80], tdw: [512, 176, 512, 80], oper: [0, 256, 512, 80], schiller: [512, 256, 512, 80],
  variete: [0, 336, 512, 96], cafe: [512, 336, 512, 48], kino: [512, 384, 512, 48],
  bulbW: [0, 432, 256, 32], bulbP: [256, 432, 256, 32], bulbOff: [512, 432, 256, 32], frieze: [768, 432, 256, 32],
  foyer: [0, 464, 256, 256], flapper: [256, 464, 128, 256], poster: [384, 464, 128, 256], curtain: [512, 464, 256, 256], hall: [768, 464, 256, 256],
  fan: [0, 720, 256, 128], caligari: [0, 848, 128, 128], pane: [256, 720, 256, 128], paneDark: [256, 848, 256, 128], marble: [512, 720, 256, 128], cafeLit: [768, 720, 256, 128],
  vault: [512, 848, 256, 128], posterB: [768, 848, 128, 128], vcafe: [896, 848, 128, 128],
  billard: [0, 976, 256, 48], spiel: [256, 976, 256, 48], lGloria: [512, 976, 256, 48], lPalast: [768, 976, 256, 48],
} as const satisfies Record<string, Region>;
/** Atlas height: the 1024² sign atlas plus the 256 px poster strip under it (`POSTER_CELL.h`; a literal, as that module is not ready at load). */
const AH = 1024 + 256;
/** Region of period poster `p` (`POSTERS`), or of a torn scrap of it (`part` in 0 … 1 of the poster, y down). */
function bill(p: (typeof POSTERS)[number], part: readonly [number, number, number, number] = [0, 0, 1, 1]): Region {
  const x = POSTERS.indexOf(p) * POSTER_CELL.w, { w, h } = POSTER_CELL;
  return [x + part[0] * w + 1, 1024 + part[1] * h + 1, (part[2] - part[0]) * w - 2, (part[3] - part[1]) * h - 2];
}

const SERIF = 'bold %px Georgia, "Times New Roman", serif';
const DECO = 'bold %px "Futura", "Century Gothic", "Trebuchet MS", "DejaVu Sans", sans-serif';
const SCRIPT = 'italic bold %px "Brush Script MT", "Segoe Script", Georgia, serif';

function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font: string): void {
  let s = size;
  g.font = font.replace('%', String(s));
  while (g.measureText(text).width > maxW && s > 10) g.font = font.replace('%', String(--s));
  g.fillText(text, x, y);
}

function bulb(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, glow: boolean): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, glow ? '#ffffff' : '#fffaf0');
  gr.addColorStop(0.45, col);
  gr.addColorStop(1, glow ? 'rgba(0,0,0,0)' : 'rgba(60,40,40,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

/** The atlas; `glow` paints the emissive version (letters, bulbs, lit foyers bright; stone, velvet and marble dark). */
function paintAtlas(g: CanvasRenderingContext2D, glow: boolean): void {
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 1024);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const rng = new Rng(1920);
  const fill = (r: Region, col: string): void => { g.fillStyle = col; g.fillRect(r[0], r[1], r[2], r[3]); };
  const word = (r: Region, text: string, col: string, size: number, font = SERIF, dy = 0, pad = 40): void => {
    g.fillStyle = col;
    fitText(g, text, r[0] + r[2] / 2, r[1] + r[3] / 2 + 3 + dy, r[2] - pad, size, font);
  };
  const border = (r: Region, n: number, col: string, inset = 12, rad = 6): void => {
    const [x0, y0, w, h] = r;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      bulb(g, x0 + inset + t * (w - 2 * inset), y0 + inset, rad, col, glow);
      bulb(g, x0 + inset + t * (w - 2 * inset), y0 + h - inset, rad, col, glow);
    }
    const m = Math.max(1, Math.round((n * (h - 2 * inset)) / (w - 2 * inset)));
    for (let i = 0; i <= m; i++) for (const x of [x0 + inset, x0 + w - inset]) bulb(g, x, y0 + inset + (i / m) * (h - 2 * inset), rad, col, glow);
  };
  // REVUE: berry panel, cream letters, a frame of white bulbs (two dead ones).
  fill(R.revue, glow ? '#3c0a1c' : '#8c1c3c');
  g.strokeStyle = glow ? '#5a2a3a' : '#d8d0d8';
  g.lineWidth = 8;
  g.strokeRect(R.revue[0] + 26, R.revue[1] + 26, R.revue[2] - 52, R.revue[3] - 52);
  word(R.revue, 'REVUE', glow ? '#fff2e4' : '#fbe6d2', 124, SERIF, 2, 90);
  border(R.revue, 22, glow ? '#ffe8c8' : '#fff4dc');
  if (glow) for (const x of [118, 342]) { g.fillStyle = '#000'; g.beginPath(); g.arc(x, 12, 8, 0, Math.PI * 2); g.fill(); }
  // Cinema and theatre names: period lettering, light on dark (lit at night), the opera in carved stone.
  const name = (r: Region, text: string, bg: string, fg: string, fgGlow: string, font = DECO, size = 60): void => {
    fill(r, glow ? '#000' : bg);
    word(r, text, glow ? fgGlow : fg, size, font);
  };
  name(R.gloria, 'GLORIA-PALAST', '#1c1a22', '#f4eee0', '#fff4e2');
  name(R.marmor, 'MARMORHAUS', '#1a1c22', '#e8ecf6', '#e2ecff');
  // Café des Westens: the oval sign (dark script on cream in a dark frame), the box sign, the hall signs.
  {
    const [x0, y0, w, h] = R.westens;
    fill(R.westens, glow ? '#000' : '#1c1a18');
    g.fillStyle = glow ? '#6a5a40' : '#f4ecd8';
    g.beginPath(); g.ellipse(x0 + w / 2, y0 + h / 2, w / 2 - 8, h / 2 - 6, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = glow ? '#000' : '#2a2018'; g.lineWidth = 4; g.stroke();
    g.fillStyle = glow ? '#000' : '#1c1612';
    fitText(g, 'Café des Westens', x0 + w / 2, y0 + h / 2 + 3, w - 90, 46, SCRIPT);
  }
  {
    const [x0, y0, w, h] = R.vcafe;
    fill(R.vcafe, glow ? '#000' : '#141210');
    g.fillStyle = glow ? '#ffe8c0' : '#f4ecdc';
    fitText(g, 'CAFÉ', x0 + w / 2, y0 + 30, w - 16, 36, SERIF);
    fitText(g, 'DES', x0 + w / 2, y0 + 64, w - 40, 20, SERIF);
    fitText(g, 'WESTENS', x0 + w / 2, y0 + 98, w - 14, 28, SERIF);
    g.strokeStyle = glow ? '#3a3020' : '#d8ccb0'; g.lineWidth = 4; g.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10);
  }
  name(R.billard, 'BILLARDSÄLE', '#161412', '#ece4d0', '#e8d8b8', DECO, 30);
  name(R.spiel, 'SPIELSÄLE', '#161412', '#ece4d0', '#e8d8b8', DECO, 30);
  // Gloria-Palast: one letter per arch of the first and second floor (white on the dark arch).
  for (const [r, text] of [[R.lGloria, 'GLORIA'], [R.lPalast, 'PALAST']] as const) {
    fill(r, glow ? '#000' : '#141418');
    for (let i = 0; i < 6; i++) { g.fillStyle = glow ? '#fff0dc' : '#f4f0e6'; fitText(g, text[i]!, r[0] + (i + 0.5) * (r[2] / 6), r[1] + r[3] / 2 + 3, r[2] / 6 - 4, 40, SERIF); }
  }
  name(R.tdw, 'THEATER DES WESTENS', '#c8bca4', '#4a3c30', '#000', SERIF, 52);
  name(R.oper, 'DEUTSCHES OPERNHAUS', '#c4b89e', '#3c3228', '#000', SERIF, 52);
  name(R.schiller, 'SCHILLER-THEATER', '#cfc4aa', '#3e342a', '#000', SERIF, 54);
  name(R.cafe, 'CAFÉ · CONDITOREI · DIELE', '#2a2420', '#efe2c4', '#ffd8a0', SERIF, 34);
  name(R.kino, 'HEUTE · PREMIERE', '#16141a', '#f0c8dc', '#ff9cd0', DECO, 34);
  // VARIETÉ: pink script on violet glass.
  fill(R.variete, glow ? '#1c0820' : '#3c2048');
  word(R.variete, 'Varieté', glow ? '#ff9ad6' : '#ffc2e4', 84, SCRIPT, 0, 60);
  border(R.variete, 16, glow ? '#ff8cc8' : '#ffd0e8', 10, 5);
  // Bulb strips: 8 bulbs on a dark band (white, pink, dead), and a pink frieze band with a thin line of bulbs.
  for (const [r, col, on] of [[R.bulbW, '#fff0d0', true], [R.bulbP, '#ff7cc0', true], [R.bulbOff, '#a09890', false]] as const) {
    fill(r, glow ? '#000' : '#2a2628');
    for (let i = 0; i < 8; i++) {
      const dead = on && (i === 5 && r === R.bulbW);
      if (glow && (!on || dead)) continue;
      bulb(g, r[0] + 16 + i * 32, r[1] + 16, 11, dead ? '#6a6460' : col, glow);
    }
  }
  fill(R.frieze, glow ? '#30081c' : '#b0306a');
  for (let i = 0; i < 16; i++) bulb(g, R.frieze[0] + 8 + i * 16, R.frieze[1] + 16, 5, '#ffe4f0', glow);
  // The lit foyer behind glass doors: warm hall, a chandelier, three door frames.
  {
    const [x0, y0, w, h] = R.foyer;
    const gr = g.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, glow ? '#6a4020' : '#8a6038');
    gr.addColorStop(0.6, glow ? '#c8884a' : '#e0b070');
    gr.addColorStop(1, glow ? '#4a2810' : '#6a4424');
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    g.fillStyle = glow ? '#fff0c8' : '#fff4d8';
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI, rr = 34; g.beginPath(); g.arc(x0 + w / 2 + Math.cos(a) * rr, y0 + 58 + Math.sin(a) * rr * 0.4, 3.5, 0, Math.PI * 2); g.fill(); }
    bulb(g, x0 + w / 2, y0 + 64, 30, '#ffd890', glow);
    g.fillStyle = glow ? '#3a1408' : '#7a1c2c';
    g.fillRect(x0, y0 + h - 40, w, 40);
    g.fillStyle = '#0c0a0a';
    for (let k = 0; k <= 3; k++) g.fillRect(x0 + k * (w / 3) - 5, y0, 10, h);
    g.fillRect(x0, y0, w, 10);
    for (let k = 0; k < 3; k++) { g.fillRect(x0 + k * (w / 3) + 18, y0 + h * 0.55, w / 3 - 36, 5); }
  }
  // Revue poster: a flapper in a pearl dress on berry, the title in cream.
  {
    const [x0, y0, w, h] = R.flapper;
    fill(R.flapper, glow ? '#14060c' : '#7a1e3c');
    g.fillStyle = glow ? '#2a1420' : '#e8d6d0';
    g.beginPath(); g.ellipse(x0 + 64, y0 + 52, 16, 19, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = glow ? '#100408' : '#1a1418';
    g.beginPath(); g.ellipse(x0 + 62, y0 + 44, 19, 14, -0.2, Math.PI, Math.PI * 2.05); g.fill();
    g.fillStyle = glow ? '#28141c' : '#d8c8cc';
    g.beginPath(); g.moveTo(x0 + 52, y0 + 72); g.lineTo(x0 + 78, y0 + 72); g.lineTo(x0 + 96, y0 + 196); g.lineTo(x0 + 34, y0 + 196); g.fill();
    g.strokeStyle = glow ? '#28141c' : '#e8dcd8'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(x0 + 76, y0 + 80); g.lineTo(x0 + 104, y0 + 40); g.stroke();
    g.beginPath(); g.moveTo(x0 + 54, y0 + 82); g.lineTo(x0 + 30, y0 + 120); g.stroke();
    g.beginPath(); g.moveTo(x0 + 56, y0 + 196); g.lineTo(x0 + 50, y0 + 236); g.moveTo(x0 + 74, y0 + 196); g.lineTo(x0 + 84, y0 + 234); g.stroke();
    for (let i = 0; i < 12; i++) bulb(g, x0 + 42 + rng.range(0, 44), y0 + 100 + rng.range(0, 90), 2.5, '#ffffff', glow);
    g.fillStyle = glow ? '#3a2a24' : '#fbe6d2';
    fitText(g, 'REVUE', x0 + w / 2, y0 + 18, w - 16, 26, SERIF);
    // Torn lower corner.
    g.fillStyle = '#000';
    g.beginPath(); g.moveTo(x0 + w, y0 + h); g.lineTo(x0 + w - 40, y0 + h); g.lineTo(x0 + w, y0 + h - 70); g.fill();
  }
  // Film posters (pale silver, ink figures, a few words).
  for (const [r, title, bg, ink] of [[R.poster, 'PREMIERE', '#d8d2c4', '#2a2430'], [R.posterB, 'HEUTE', '#9a2c3c', '#f0e4d4']] as const) {
    const [x0, y0, w, h] = r;
    fill(r, glow ? '#0c0a0a' : bg);
    g.fillStyle = glow ? '#000' : ink;
    g.beginPath(); g.ellipse(x0 + w / 2, y0 + h * 0.36, w * 0.18, w * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(x0 + w * 0.3, y0 + h * 0.48, w * 0.4, h * 0.3);
    g.fillStyle = glow ? '#141010' : ink;
    fitText(g, title, x0 + w / 2, y0 + h * 0.9, w - 14, 24, DECO);
    g.strokeStyle = glow ? '#000' : '#18161a'; g.lineWidth = 6; g.strokeRect(x0 + 3, y0 + 3, w - 6, h - 6);
  }
  // Velvet: berry folds with dark troughs, a gold-free silver fringe at the foot.
  {
    const [x0, y0, w, h] = R.curtain;
    for (let x = 0; x < w; x += 2) {
      const s = 0.55 + 0.45 * Math.sin(x * 0.19) * Math.sin(x * 0.05 + 1);
      g.fillStyle = glow ? `rgb(${Math.round(28 * s)},${Math.round(4 * s)},${Math.round(12 * s)})` : `rgb(${Math.round(120 + 70 * s)},${Math.round(18 + 22 * s)},${Math.round(48 + 30 * s)})`;
      g.fillRect(x0 + x, y0, 2, h);
    }
    g.fillStyle = glow ? '#000' : '#d8d4dc';
    for (let x = 0; x < w; x += 6) g.fillRect(x0 + x, y0 + h - 14, 3, 14);
  }
  // The Varieté hall seen through its glass: violet dusk, a lit stage with berry curtains, a chandelier, table lamps.
  {
    const [x0, y0, w, h] = R.hall;
    const gr = g.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, glow ? '#2a1040' : '#4a2c66');
    gr.addColorStop(0.55, glow ? '#a04880' : '#c4709c');
    gr.addColorStop(1, glow ? '#3a1028' : '#5a2440');
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    for (let x = 0; x < w; x += 3) { const s = 0.5 + 0.5 * Math.sin(x * 0.3); g.fillStyle = glow ? `rgba(90,10,40,${0.6 * s})` : `rgba(130,20,60,${0.7 * s})`; g.fillRect(x0 + x, y0 + 30, 3, h * 0.52); }
    g.fillStyle = glow ? '#ffd8ec' : '#ffe0f0';
    g.fillRect(x0 + w * 0.3, y0 + h * 0.58, w * 0.4, h * 0.05);
    bulb(g, x0 + w / 2, y0 + 44, 34, '#ffd8b0', glow);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI; g.fillStyle = glow ? '#fff2d8' : '#fff8e8'; g.beginPath(); g.arc(x0 + w / 2 + Math.cos(a) * 40, y0 + 44 + Math.sin(a) * 14, 3, 0, Math.PI * 2); g.fill(); }
    for (const x of [0.18, 0.42, 0.66, 0.86]) bulb(g, x0 + w * x, y0 + h * 0.82, 10, '#ffb070', glow);
  }
  // The Caligari poster (the film opened at the Marmorhaus on 26 February 1920): black spiral lettering on white.
  {
    const [x0, y0, w, h] = R.caligari;
    fill(R.caligari, glow ? '#141414' : '#ece8dc');
    g.strokeStyle = glow ? '#000' : '#141210'; g.lineWidth = 3;
    g.beginPath(); for (let a = 0; a < Math.PI * 6; a += 0.1) { const r = 6 + a * 2.2; g.lineTo(x0 + w / 2 + Math.cos(a) * r, y0 + 46 + Math.sin(a) * r * 0.9); } g.stroke();
    g.fillStyle = glow ? '#000' : '#141210';
    fitText(g, 'CALIGARI', x0 + w / 2, y0 + 50, w - 14, 24, DECO);
    fitText(g, 'Du musst', x0 + w / 2, y0 + 14, w - 40, 14, SERIF);
    fitText(g, 'im Marmorhaus', x0 + w / 2, y0 + h - 16, w - 12, 18, SCRIPT);
  }
  // Fan glass: pale silver-lavender facets with bright edges.
  {
    const [x0, y0, w, h] = R.fan;
    fill(R.fan, glow ? '#26203a' : '#c8c8dc');
    for (let i = 0; i < 40; i++) {
      g.fillStyle = glow ? `rgba(200,190,255,${rng.range(0.05, 0.25)})` : rng.pick(['#e8e8f4', '#b4b0cc', '#d4d0e8', '#f4f2fc', '#a8a4c4']);
      const x = x0 + rng.range(0, w), y = y0 + rng.range(0, h), s = rng.range(18, 60);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * 0.3); g.lineTo(x + s * 0.4, y + s); g.fill();
    }
  }
  // Window glass: an iron-framed lavender pane with a crack (lit faintly), and a dark one.
  for (const [r, lit] of [[R.pane, true], [R.paneDark, false]] as const) {
    const [x0, y0, w, h] = r;
    const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
    gr.addColorStop(0, glow ? (lit ? '#3a2848' : '#06060a') : lit ? '#b8b4d4' : '#3a3c48');
    gr.addColorStop(1, glow ? (lit ? '#5a3050' : '#0a080c') : lit ? '#7a7498' : '#24242c');
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    g.strokeStyle = glow ? '#000' : '#e8e6f0'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0 + w * 0.6, y0 + h * 0.3); g.lineTo(x0 + w * 0.4, y0 + h * 0.7); g.moveTo(x0 + w * 0.6, y0 + h * 0.3); g.lineTo(x0 + w * 0.85, y0 + h * 0.55); g.stroke();
    g.fillStyle = '#121214';
    for (let k = 0; k <= 4; k++) g.fillRect(x0 + Math.min(w - 4, k * (w / 4)), y0, 4, h);
    for (const y of [0, h / 2 - 2, h - 4]) g.fillRect(x0, y0 + y, w, 4);
  }
  // Vault glass: like the pane, smaller lights.
  {
    const [x0, y0, w, h] = R.vault;
    fill(R.vault, glow ? '#2a1c3a' : '#a8a8c8');
    for (let i = 0; i < 20; i++) { g.fillStyle = glow ? 'rgba(255,180,230,0.12)' : 'rgba(240,240,255,0.35)'; g.fillRect(x0 + rng.range(0, w), y0 + rng.range(0, h), rng.range(10, 40), 3); }
    g.fillStyle = '#18181c';
    for (let k = 0; k <= 8; k++) g.fillRect(x0 + Math.min(w - 3, k * (w / 8)), y0, 3, h);
    for (let k = 0; k <= 4; k++) g.fillRect(x0, y0 + Math.min(h - 3, k * (h / 4)), w, 3);
  }
  // White Silesian marble with grey veins (Marmorhaus), unlit.
  {
    const [x0, y0, w, h] = R.marble;
    fill(R.marble, glow ? '#000' : '#eeece8');
    if (!glow) {
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(110,110,120,${rng.range(0.15, 0.45)})`; g.lineWidth = rng.range(0.8, 2.2);
        g.beginPath(); let x = x0 + rng.range(0, w), y = y0; g.moveTo(x, y);
        while (y < y0 + h) { x += rng.range(-14, 14); y += rng.range(6, 18); g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = 'rgba(80,80,90,0.5)';
      for (const f of [0.25, 0.5, 0.75]) g.fillRect(x0 + w * f, y0, 2, h);
      g.fillRect(x0, y0 + h / 2, w, 2);
    }
  }
  // Café windows: warm interior, small tables and the shapes of chairs.
  {
    const [x0, y0, w, h] = R.cafeLit;
    fill(R.cafeLit, glow ? '#7a4a20' : '#d8a868');
    g.fillStyle = glow ? '#2a1408' : '#5a3418';
    for (let i = 0; i < 5; i++) { const x = x0 + 20 + i * 50; g.fillRect(x, y0 + 80, 30, 6); g.fillRect(x + 13, y0 + 86, 4, 30); }
    for (let i = 0; i < 4; i++) bulb(g, x0 + 40 + i * 60, y0 + 24, 12, '#fff0c0', glow);
    g.fillStyle = '#100c0a';
    for (let k = 0; k <= 4; k++) g.fillRect(x0 + Math.min(w - 4, k * (w / 4)), y0, 4, h);
  }
}

const atlases = new WeakMap<MapMats, LitMaterial>();
function atlas(c: Ctx): LitMaterial {
  let a = atlases.get(c.M);
  if (!a) {
    const [c1, g1] = canvas(1024, AH), [c2, g2] = canvas(1024, AH);
    paintAtlas(g1, false);
    paintAtlas(g2, true);
    paintPosters(g1, 0, 1024, false);
    paintPosters(g2, 0, 1024, true);
    a = new MeshStandardMaterial({ map: toTexture(c1, false, c.M.profile.anisotropy), emissiveMap: toTexture(c2, false, 4), emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.6 });
    atlases.set(c.M, a);
  }
  return a;
}

function remap(g: BufferGeometry, r: Region): BufferGeometry {
  const uv = g.getAttribute('uv'), u0 = r[0] / 1024, u1 = (r[0] + r[2]) / 1024, v1 = 1 - r[1] / AH, v0 = 1 - (r[1] + r[3]) / AH;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return g;
}
const regionGeo = (r: Region): BufferGeometry => cached(`kd-r${r.join(',')}`, () => remap(new PlaneGeometry(1, 1), r));

/** A w × h plate of atlas region `r` centred on `m` (facing +z). */
function plate(c: Ctx, r: Region, m: Matrix4, w: number, h: number): void {
  c.b.geo(atlas(c), regionGeo(r), m.clone().multiply(new Matrix4().makeScale(w, h, 1)));
}

/** A curved sign: region `r` on a cylinder sector of radius `rad` (centre at `m`, facing +z), `ang` wide, h high. */
function arcPlate(c: Ctx, r: Region, m: Matrix4, rad: number, ang: number, h: number): void {
  c.b.geo(atlas(c), cached(`kd-arc${r.join(',')},${rad},${ang},${h}`, () => remap(new CylinderGeometry(rad, rad, h, 12, 1, true, -ang / 2, ang), r)), m);
}

/** A row of marquee bulbs along local x of `m`, `len` long (plates of 8 bulbs per 1.6 m). */
function bulbs(c: Ctx, m: Matrix4, len: number, r: Region = R.bulbW, h = 0.2): void {
  const n = Math.max(1, Math.round(len / 1.6)), w = len / n;
  for (let i = 0; i < n; i++) plate(c, r, sub(m, -len / 2 + (i + 0.5) * w, 0, 0), w, h);
}

/** Bulbs round an arc of radius `rad` about the y axis of `m` (from angle a0 to a1, 0 = +z). */
function bulbArc(c: Ctx, m: Matrix4, rad: number, a0: number, a1: number, r: Region = R.bulbW, h = 0.2): void {
  const len = rad * Math.abs(a1 - a0), n = Math.max(1, Math.round(len / 1.4));
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + 0.5) / n) * (a1 - a0);
    plate(c, r, sub(m, Math.sin(a) * (rad + 0.02), 0, Math.cos(a) * (rad + 0.02), a), (len / n) * 1.02, h);
  }
}

// ---------------------------------------------------------------- geometry helpers

/** A frame relative to matrix `m`. */
const fr = (m: Matrix4): Frame => (x, y, z, ry, rx, rz) => sub(m, x, y, z, ry, rx, rz);
/** Box with its bottom at local y, frame F (rotations allowed). */
function bx(c: Ctx, mat: Material, F: Frame, x: number, y: number, z: number, w: number, h: number, d: number, tint?: RGB, ry = 0, rx = 0, rz = 0): void {
  c.b.box(mat, F(x, y + h / 2, z, ry, rx, rz), w, h, d, tint);
}
function cy(c: Ctx, mat: Material, m: Matrix4, r0: number, r1: number, h: number, seg: number, tint?: RGB): void {
  c.b.geo(mat as LitMaterial, cached(`kd-cy${r0.toFixed(2)},${r1.toFixed(2)},${h.toFixed(2)},${seg}`, () => new CylinderGeometry(r0, r1, h, seg)), m, tint);
}
/** Half disc slab (a marquee canopy): radius r, thickness t, the flat side on local −z through `m`. */
function halfDisc(r: number, t: number, seg = 14): BufferGeometry {
  return cached(`kd-hd${r},${t},${seg}`, () => new CylinderGeometry(r, r, t, seg, 1, false, -Math.PI / 2, Math.PI));
}
/** A round arch of boxes (an iron rib or a stone archivolt) in the x–y plane of `m`, radius r, from angle a0 to a1 (0 = up). */
function archRib(c: Ctx, mat: Material, m: Matrix4, r: number, s: number, d: number, tint?: RGB, n = 9, a0 = -Math.PI / 2, a1 = Math.PI / 2): void {
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n, x0 = Math.sin(t0) * r, y0 = Math.cos(t0) * r, x1 = Math.sin(t1) * r, y1 = Math.cos(t1) * r;
    c.b.box(mat, sub(m, (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, Math.atan2(y1 - y0, x1 - x0)), Math.hypot(x1 - x0, y1 - y0) + s * 0.6, s, d, tint);
  }
}
/** Rubble at the foot: stone lumps and a few slabs inside the footprint (local x0..x1 at z, within depth dz). */
function rubble(c: Ctx, F: Frame, x0: number, x1: number, z: number, dz: number, n: number, tint: RGB, glass = 0): void {
  for (let i = 0; i < n; i++) {
    const s = c.rng.range(0.25, 0.8);
    c.b.box(c.M.stucco, F(c.rng.range(x0, x1), s * 0.22, z + c.rng.range(-dz, dz), c.rng.range(0, 3), c.rng.range(-0.3, 0.3)), s, s * 0.45, s * c.rng.range(0.6, 1.3), [tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9]);
  }
  for (let i = 0; i < glass; i++) c.b.box(c.M.glass, F(c.rng.range(x0, x1), 0.03, z + c.rng.range(-dz, dz), c.rng.range(0, 3)), c.rng.range(0.2, 0.6), 0.03, c.rng.range(0.15, 0.45));
}
/** Leaf cards (ivy, or violet wisteria with `tint`) hanging on a face at local z, x0..x1, y0..y1. */
function creeper(c: Ctx, F: Frame, x0: number, x1: number, y0: number, y1: number, z: number, n: number, tint: RGB = [0.7, 0.95, 0.62], ry = 0): void {
  const leaf = cached('kd-leaf', () => new PlaneGeometry(1, 1).translate(0, -0.5, 0));
  for (let i = 0; i < n; i++) c.b.cards.of(c.M.ivy).add(leaf, F(c.rng.range(x0, x1), c.rng.range(y0, y1), z, ry, 0, c.rng.range(-0.25, 0.25)).multiply(new Matrix4().makeScale(c.rng.range(0.7, 1.4), c.rng.range(0.9, 2.2), 1)), tint);
}
/** A window pane in frame `m`, or a boarded or broken one (`state` 1 board, 2 dark hole). */
function win(c: Ctx, m: Matrix4, w: number, h: number, lit: number, state = 0, trim?: { mat: Material; color: RGB }): void {
  if (state === 1 && c.b.wearWindow(m, w, h, true)) return;
  if (state === 2) {
    c.b.box(c.M.dark, sub(m, 0, 0, 0.03), w, h, 0.02);
    c.b.box(c.M.glass, sub(m, -w * 0.22, -h * 0.36, 0.05, 0, 0, 0.5), w * 0.5, h * 0.18, 0.02);
    return;
  }
  // Lit rooms from the shared window atlas; unlit ones as dark or lavender glass from the sign atlas (the shared unlit
  // cells include boards, which made the grand fronts look nailed shut), the wear layer still breaks a few.
  if (c.rng.next() < lit) { pane(c.b, m, w, h, c.rng, 1, trim); return; }
  if (!c.b.wearWindow(m, w, h)) plate(c, c.rng.next() < 0.6 ? R.paneDark : R.pane, sub(m, 0, 0, 0.04), w, h);
}
/** An arched window (pane plus round head) with an optional stone rim; `state` as `win`. */
function arch(c: Ctx, m: Matrix4, w: number, h: number, lit: number, state = 0, rim?: { mat: Material; color: RGB }): void {
  if (rim) { c.b.box(rim.mat, sub(m, 0, -0.05, 0), w + 0.36, h + 0.1, 0.05, rim.color); archHead(c.b, rim.mat, sub(m, 0, h / 2, 0), w + 0.36, false, 0.03, rim.color); }
  win(c, m, w, h, lit, state);
  archHead(c.b, c.M.dark, sub(m, 0, h / 2, 0), w, false, 0.05);
}
/** A row of windows: `n` bays from x0 to x1 at local z (face +z, or turned by `ry`), centre height y; a few boarded or broken. */
function row(c: Ctx, F: Frame, x0: number, x1: number, z: number, y: number, n: number, w: number, h: number, arched: boolean, lit = 0.3, rim?: { mat: Material; color: RGB }, ry = 0, skip: (i: number) => boolean = () => false): void {
  for (let i = 0; i < n; i++) {
    if (skip(i)) continue;
    const t = x0 + ((i + 0.5) * (x1 - x0)) / n, r = c.rng.next(), st = r < 0.1 ? 1 : r < 0.2 ? 2 : 0;
    const m = F(Math.cos(ry) * t + Math.sin(ry) * z, y, -Math.sin(ry) * t + Math.cos(ry) * z, ry);
    if (arched) arch(c, m, w, h, lit, st, rim);
    else { if (rim) { c.b.box(rim.mat, sub(m, 0, h / 2 + 0.14, 0.06), w + 0.5, 0.22, 0.14, rim.color); c.b.box(rim.mat, sub(m, 0, -h / 2 - 0.08, 0.08), w + 0.36, 0.14, 0.2, rim.color); } win(c, m, w, h, lit, st); }
  }
}
/** Pediment (a triangle facing +z) w wide, h high, d deep, its base centre at `m`. */
function pediment(c: Ctx, mat: LitMaterial, m: Matrix4, w: number, h: number, d: number, tint?: RGB): void {
  c.b.geo(mat, frustum(w, d, h, 0.02, d), m, tint);
}
/** Velvet rope between two silver posts (local x0 → x1 at z), sagging. */
function rope(c: Ctx, F: Frame, x0: number, x1: number, z: number): void {
  const M = c.M, SILVER: RGB = [1.0, 1.02, 1.1], BERRY: RGB = [0.62, 0.12, 0.24];
  for (const x of [x0, x1]) { cy(c, M.enamel, F(x, 0.48, z), 0.035, 0.05, 0.96, 6, SILVER); cy(c, M.enamel, F(x, 0.03, z), 0.14, 0.16, 0.06, 8, SILVER); c.b.geo(M.enamel, cached('kd-knob', () => new SphereGeometry(0.06, 6, 4)), F(x, 0.98, z), SILVER); }
  const mx = (x0 + x1) / 2, half = (x1 - x0) / 2, sag = 0.22, ang = Math.atan2(sag, half);
  c.b.box(M.linen, F((x0 + mx) / 2, 0.9 - sag / 2, z, 0, 0, -ang), Math.hypot(half, sag), 0.06, 0.06, BERRY);
  c.b.box(M.linen, F((mx + x1) / 2, 0.9 - sag / 2, z, 0, 0, ang), Math.hypot(half, sag), 0.06, 0.06, BERRY);
}

type Poster = (typeof POSTERS)[number];
/** Period posters pasted on a wall (frame `m` on the face, +z out): [poster, x, y (centre), height, tilt]; later ones lie on top. */
function bills(c: Ctx, m: Matrix4, list: ReadonlyArray<readonly [Poster, number, number, number, number?]>): void {
  list.forEach(([p, x, y, h, rz = 0], i) => plate(c, bill(p), sub(m, x, y, 0.012 + i * 0.004, 0, 0, rz), h * 0.5, h));
}
/** Torn scraps of older posters: [poster, x, y, w, h, part of the poster]; the tilt comes from the position (not `c.rng`). */
function scraps(c: Ctx, m: Matrix4, list: ReadonlyArray<readonly [Poster, number, number, number, number, readonly [number, number, number, number]]>): void {
  for (const [p, x, y, w, h, part] of list) plate(c, bill(p, part), sub(m, x, y, 0.008, 0, 0, Math.sin(x * 12.9 + y * 7.1) * 0.08), w, h);
}
/** Rust running down white iron (a thin strip on a column face), x, top y, length. */
function rustRun(c: Ctx, m: Matrix4, x: number, y: number, len: number): void {
  c.b.box(c.M.rust, sub(m, x, y - len / 2, 0.005), 0.05, len, 0.01, [0.9, 0.62, 0.42]);
}
const TIMBER_POST: RGB = [0.62, 0.5, 0.4];

/** Stone tints on the warm stucco texture: pale sandstone, its shadowed courses, a light trim; the opera's grey limestone. */
const SAND: RGB = [1.4, 1.8, 2.2], SAND_D: RGB = [1.1, 1.4, 1.75], SAND_L: RGB = [1.6, 2.05, 2.5], LIME: RGB = [1.3, 1.95, 3.9], LIME_D: RGB = [1.0, 1.5, 3.0];
const OPEN_PARTS_CHTOR = OPEN_PARTS.chtor ?? [];
const SILVER: RGB = [0.95, 0.98, 1.08], WHITE_IRON: RGB = [0.92, 0.92, 0.98], BERRY: RGB = [0.62, 0.14, 0.26], VIOLET: RGB = [0.62, 0.5, 0.95], WISTERIA: RGB = [0.82, 0.6, 1.1];

// ---------------------------------------------------------------- Revuepalast (invented, from the board)

/**
 * Revuepalast (invented, board `docs/style/charlottenburg.png`): a worn grey-violet theatre front, three bays.
 * Cues: the half-round marquee canopy* with white and pink bulb rows* on two silver columns*, the lit glass doors*,
 * steps and velvet ropes*, the flapper poster* on the left bay, a torn berry curtain hanging from the right windows*,
 * the curved REVUE sign ringed with bulbs (5 m), the silver fan crown with glass rays above it (reveal), the stage
 * house behind. Worn: boarded ground-floor windows, broken panes, a fallen cornice piece, rubble and shards, wisteria.
 */
function revuepalast(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), STONE: RGB = [0.74, 0.96, 2.3], DARK: RGB = [0.52, 0.66, 1.6], FZ = 1.4, H = 13;
  // Body: the front block (local z −2.2 … FZ), the taller stage house behind, a cornice with a broken run.
  bx(c, M.stucco, F, 0, 0, (FZ - 2.2) / 2, 16, H, FZ + 2.2, STONE);
  bx(c, M.stucco, F, 0, 0, -3.3, 13, 16.5, 2.4, DARK);
  c.b.geo(M.slate, frustum(13.4, 2.8, 2.2, 13.4, 0.3), F(0, 16.5, -3.3), C.slate);
  bx(c, M.stucco, F, -3, H - 0.6, FZ + 0.1, 10, 0.6, 0.5, DARK);
  bx(c, M.stucco, F, 6.3, H - 0.6, FZ + 0.1, 3.4, 0.6, 0.5, DARK);
  bx(c, M.stucco, F, 0, H, FZ - 0.2, 16, 0.9, 0.4, STONE);
  // Pilasters between the bays and at the corners; a plinth band.
  for (const x of [-7.7, -3.9, 3.9, 7.7]) bx(c, M.stucco, F, x, 0, FZ + 0.15, 0.7, H - 0.6, 0.3, DARK);
  bx(c, M.stucco, F, 0, 0, FZ + 0.12, 16, 0.6, 0.26, DARK);
  bx(c, M.stucco, F, 0, 4.9, FZ + 0.12, 16, 0.35, 0.3, DARK);
  // Rusticated ground floor: dark joints every 0.6 m on the side bays; a row of bulbs along the band over the doors.
  for (let y = 0.9; y < 4.8; y += 0.62) for (const s of [-1, 1]) bx(c, M.stucco, F, s * 5.8, y, FZ + 0.02, 3.4, 0.06, 0.04, [0.32, 0.4, 0.9]);
  bulbs(c, F(0, 5.95, FZ + 0.36), 7.6, R.bulbP, 0.16);
  // Side bays: ground floor boarded or broken, arched upper windows (some lit, some dark holes).
  for (const s of [-1, 1]) {
    const x = s * 5.8;
    if (s > 0) win(c, F(x, 2.4, FZ, 0), 2.0, 2.6, 0, 1);
    for (const [y, st] of [[7.2, s > 0 ? 2 : 0], [10.6, 0]] as const) arch(c, F(x, y, FZ), 1.5, 2.4, 0.45, st, { mat: M.stucco, color: DARK });
  }
  // The flapper poster on the left bay, in a silver frame, over the boarded window.
  bx(c, M.enamel, F, -5.8, 0.85, FZ + 0.06, 2.6, 4.3, 0.08, SILVER);
  plate(c, R.flapper, F(-5.8, 3.0, FZ + 0.12), 2.3, 4.0);
  // Torn curtain hanging out of the right upper windows.
  plate(c, R.curtain, F(5.3, 5.6, FZ + 0.28, 0, 0.1, 0.06), 1.7, 5.2);
  plate(c, R.curtain, F(6.6, 8.6, FZ + 0.2, 0, 0.05, -0.08), 1.1, 3.2);
  // Central bay: the lit foyer behind glass doors, steps, ropes.
  bx(c, M.dark, F, 0, 0.45, FZ + 0.02, 6.2, 2.9, 0.04);
  plate(c, R.foyer, F(0, 1.9, FZ + 0.06), 5.8, 2.85);
  for (const x of [-3.0, 3.0]) bx(c, M.enamel, F, x, 0.45, FZ + 0.12, 0.25, 2.9, 0.25, SILVER);
  for (let i = 0; i < 3; i++) bx(c, M.stucco, F, 0, 0, FZ + (1.5 - i * 0.5) / 2, 7.8 - i * 0.6, 0.15 * (i + 1), 1.5 - i * 0.5, [0.86, 0.84, 0.88]);
  rope(c, F, -6.8, -4.4, 4.2);
  rope(c, F, 4.4, 6.8, 4.2);
  rope(c, F, -4.4, -3.2, 4.2);
  // The half-round marquee canopy at 3.7 m: silver rim, white and pink bulb rows, a soffit of bulbs.
  const mq = F(0, 3.55, FZ), RQ = 3.9;
  c.b.geo(M.enamel, halfDisc(RQ, 0.55), sub(mq, 0, 0, 0), [0.72, 0.7, 0.78]);
  c.b.geo(M.enamel, halfDisc(RQ + 0.12, 0.1), sub(mq, 0, 0.3, 0), SILVER);
  c.b.geo(M.enamel, halfDisc(RQ + 0.12, 0.1), sub(mq, 0, -0.3, 0), SILVER);
  bulbArc(c, mq, RQ, -Math.PI / 2, Math.PI / 2, R.bulbW, 0.18);
  bulbArc(c, sub(mq, 0, -0.17, 0), RQ, -Math.PI / 2, Math.PI / 2, R.bulbP, 0.16);
  bulbArc(c, sub(mq, 0, 0.17, 0), RQ, -Math.PI / 2 + 0.25, Math.PI / 2 - 0.25, R.bulbW, 0.14);
  for (const rr of [1.6, 2.8]) for (let i = 0; i < Math.round(rr * 2.2); i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / Math.round(rr * 2.2)) * Math.PI;
    plate(c, R.bulbW, sub(mq, Math.sin(a) * rr, -0.29, Math.cos(a) * rr, a, Math.PI / 2), 0.4, 0.2);
  }
  // Two silver columns under the canopy edge (inside the footprint), with bulb collars.
  for (const s of [-1, 1]) {
    const x = s * 3.3, z = FZ + 2.0;
    cy(c, M.enamel, F(x, 1.65, z), 0.13, 0.16, 3.3, 8, SILVER);
    cy(c, M.enamel, F(x, 0.1, z), 0.3, 0.34, 0.2, 8, SILVER);
    for (const y of [1.2, 2.4]) bulbArc(c, F(x, y, z), 0.17, 0, Math.PI * 2, R.bulbW, 0.12);
  }
  // The curved REVUE sign on the canopy, ringed with bulbs.
  arcPlate(c, R.revue, sub(mq, 0, 1.15, -1.6), 2.8, 1.7, 1.75);
  c.b.geo(M.enamel, cached('kd-rv-signback', () => new CylinderGeometry(2.72, 2.72, 1.95, 12, 1, false, -0.86, 1.72)), sub(mq, 0, 1.15, -1.6), [0.4, 0.32, 0.4]);
  // The silver fan crown: stepped rays of silver with glass between them, bulbs round its edge; two panes broken.
  const fm = F(0, 5.95, FZ + 0.35), rays = 13;
  for (let i = 0; i < rays; i++) {
    const a0 = -Math.PI / 2 + (i / rays) * Math.PI, a1 = -Math.PI / 2 + ((i + 1) / rays) * Math.PI, am = (a0 + a1) / 2, len = i % 2 ? 3.7 : 4.5;
    if (i !== 3 && i !== 10) c.b.geo(atlas(c), cached(`kd-fan${len}`, () => remap(new CircleGeometry(len, 2, 0, Math.PI / rays), R.fan)), sub(fm, 0, 0, -0.02, 0, 0, Math.PI / 2 - a1));
    else c.b.geo(M.dark, cached(`kd-fanhole${len}`, () => new CircleGeometry(len * 0.8, 2, 0, Math.PI / rays)), sub(fm, 0, 0, -0.04, 0, 0, Math.PI / 2 - a1));
    c.b.box(M.enamel, sub(fm, (Math.sin(a0) * len) / 2, (Math.cos(a0) * len) / 2, 0.04, 0, 0, -a0), 0.16, len, 0.14, SILVER);
    plate(c, R.bulbW, sub(fm, Math.sin(am) * (len - 0.15), Math.cos(am) * (len - 0.15), 0.1, 0, 0, -am), ((len * Math.PI) / rays) * 0.9, 0.16);
  }
  c.b.box(M.enamel, sub(fm, 4.5 / 2, 0, 0.04, 0, 0, -Math.PI / 2), 0.16, 4.5, 0.14, SILVER);
  c.b.geo(M.enamel, cached('kd-fanhub', () => new CircleGeometry(1.1, 10, 0, Math.PI)), sub(fm, 0, 0, 0.12), SILVER);
  bx(c, M.stucco, F, 0, 4.3, FZ + 0.15, 7.8, 1.7, 0.4, DARK);
  // Wear: a fallen cornice block and stone lumps on the right, shards before the doors, wisteria on the left corner.
  bx(c, M.stucco, F, 6.2, 0, 3.4, 2.6, 0.5, 0.7, DARK, 0.35);
  rubble(c, F, 4.6, 7.6, 3.0, 1.2, 9, STONE, 8);
  rubble(c, F, -7.5, -6.2, 3.3, 0.8, 4, STONE, 3);
  // 2026-11-19: bills pasted over the boarded right window, torn scraps on the pilasters (the REVUE sign stays clean).
  bills(c, F(0, 0, FZ + 0.08), [['revue', 5.25, 2.35, 1.2], ['boxen', 5.95, 2.3, 1.15, 0.04], ['kino', 6.6, 2.4, 1.1, -0.03]]);
  scraps(c, F(0, 0, FZ + 0.3), [['variete', 3.9, 1.5, 0.45, 0.6, [0.1, 0.4, 0.9, 1]], ['revue', 7.7, 2.1, 0.45, 0.4, [0, 0, 1, 0.4]], ['kabarett', -3.9, 1.8, 0.4, 0.55, [0, 0.45, 0.9, 1]]]);
  creeper(c, F, -8, -6.6, 5, 13, FZ + 0.3, 18, WISTERIA);
  creeper(c, F, 6.8, 8, 8, 13, FZ + 0.3, 10);
  c.b.shadowBox(F(0, H / 2, -0.4), 16, H, 3.6);
  c.b.shadowBox(F(0, 8.2, -3.3), 13, 16.5, 2.4);
}

// ---------------------------------------------------------------- Gläsernes Varieté (invented, from the board)

/**
 * Gläsernes Varieté (invented, board): a cabaret conservatory of white iron and glass, shattered, and a small round kiosk.
 * Cues: arched iron bays* with glass panes (many broken)*, the lit violet hall with a berry stage and a chandelier seen
 * through the holes*, bar stools and little tables*, the VARIETÉ sign over the door (4.8 m), the tall fan window of
 * the middle bay, the glass barrel vault with missing panes (seen from above), the octagonal kiosk* with pink bulbs
 * and a lavender dome. Worn: shards and a fallen rib on the ground, ivy and wisteria on the iron.
 */
function variete(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), rng = c.rng, X0 = -6.8, X1 = 3.4, Z0 = -3.6, Z1 = 2.2, EAVE = 4.6, CX = (X0 + X1) / 2, LEN = X1 - X0, RV = (Z1 - Z0) / 2, CZ = (Z0 + Z1) / 2;
  // Stone plinth, parquet floor, the back wall with the lit hall painting and the stage.
  bx(c, M.stucco, F, CX, 0, CZ, LEN + 0.3, 0.45, Z1 - Z0 + 0.3, [0.82, 0.8, 0.84]);
  bx(c, M.darkWood, F, CX, 0.45, CZ, LEN - 0.2, 0.04, Z1 - Z0 - 0.2, [0.6, 0.42, 0.36]);
  for (let x = X0 + 1.3; x < X1 - 1; x += 2.6) plate(c, R.hall, F(x, 2.6, Z0 + 0.12), 2.6, 4.2);
  bx(c, M.stucco, F, CX, 0.45, Z0 + 0.4, LEN - 0.4, 4.2, 0.2, [0.4, 0.3, 0.46]);
  bx(c, M.darkWood, F, CX + 1, 0.45, Z0 + 1.2, 4.6, 0.55, 1.6, [0.5, 0.32, 0.3]);
  for (const x of [CX - 1.2, CX + 3.2]) plate(c, R.curtain, F(x, 2.75, Z0 + 0.6), 1.5, 4.0);
  // Tables and bar stools on the floor (seen through the broken glass and the open vault).
  for (let i = 0; i < 6; i++) {
    const x = X0 + 1.2 + i * 1.6 + rng.range(-0.3, 0.3), z = rng.range(-1, 1.2);
    cy(c, M.darkWood, F(x, 1.2, z), 0.36, 0.36, 0.05, 10, [0.55, 0.3, 0.32]);
    cy(c, M.iron, F(x, 0.83, z), 0.04, 0.04, 0.75, 5, C.iron);
    c.b.geo(M.lampGlass, cached('kd-lamp', () => new SphereGeometry(0.1, 6, 4)), F(x, 1.33, z));
    for (const [dx, dz] of [[0.55, 0.2], [-0.5, -0.3]] as const) {
      cy(c, M.linen, F(x + dx, 1.25, z + dz), 0.2, 0.2, 0.1, 8, BERRY);
      cy(c, M.iron, F(x + dx, 0.85, z + dz), 0.03, 0.03, 0.75, 4, C.iron);
    }
  }
  // Chandelier hanging from the vault.
  const ch = F(CX - 0.4, 3.7, CZ);
  c.b.geo(M.enamel, cached('kd-chring', () => new TorusGeometry(0.55, 0.04, 4, 14).rotateX(Math.PI / 2)), ch, SILVER);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; c.b.geo(M.lampGlass, cached('kd-lamp', () => new SphereGeometry(0.1, 6, 4)), sub(ch, Math.sin(a) * 0.55, 0.08, Math.cos(a) * 0.55)); }
  cy(c, M.glass, sub(ch, 0, -0.35, 0), 0.05, 0.4, 0.7, 8);
  bx(c, M.enamel, F, CX - 0.4, 3.7, CZ, 0.03, EAVE + RV - 3.7, 0.03, C.iron);
  // Iron frame of the long front: columns, arched bays, glass in some, holes in many.
  const bays = 5, bw = LEN / bays;
  for (let i = 0; i <= bays; i++) {
    const x = X0 + i * bw;
    for (const z of [Z1, Z0]) bx(c, M.enamel, F, x, 0.45, z, 0.22, EAVE - 0.45, 0.22, WHITE_IRON);
  }
  for (const z of [Z1, Z0]) { bx(c, M.enamel, F, CX, EAVE - 0.25, z, LEN + 0.2, 0.3, 0.26, WHITE_IRON); bx(c, M.enamel, F, CX, 0.45, z, LEN, 0.6, 0.12, WHITE_IRON); }
  for (const x of [X0, X1]) bx(c, M.enamel, F, x, EAVE - 0.25, CZ, 0.26, 0.3, Z1 - Z0, WHITE_IRON);
  const gapX = CX; // the middle bay is the entrance under the fan window
  for (let i = 0; i < bays; i++) {
    const x = X0 + (i + 0.5) * bw, mid = Math.abs(x - gapX) < 0.1, top = EAVE - 0.4, ar = (bw - 0.3) / 2, sprY = top - ar;
    if (!mid) {
      archRib(c, M.enamel, F(x, sprY, Z1 + 0.02), ar, 0.08, 0.08, WHITE_IRON, 7);
      bx(c, M.enamel, F, x, 1.05, Z1 + 0.02, 0.06, sprY - 1.05, 0.06, WHITE_IRON);
      bx(c, M.enamel, F, x, 2.6, Z1 + 0.02, bw - 0.3, 0.06, 0.06, WHITE_IRON);
      // Glass in two of the four lights per bay, dark holes elsewhere (the hall painting shows through).
      for (const [dx, y0, y1] of [[-0.25, 1.05, 2.6], [0.25, 1.05, 2.6], [-0.25, 2.6, sprY], [0.25, 2.6, sprY]] as const) {
        if (rng.next() < 0.45) plate(c, R.pane, F(x + dx * (bw - 0.3), (y0 + y1) / 2, Z1 + 0.01), (bw - 0.4) / 2, y1 - y0 - 0.06);
      }
      if (rng.next() < 0.5) c.b.geo(atlas(c), cached(`kd-archglass${ar.toFixed(2)}`, () => remap(new CircleGeometry(ar, 8, 0, Math.PI), R.pane)), F(x, sprY, Z1 + 0.01));
      // Berry curtain caught in the frame of two bays.
      if (i % 2 === 0) plate(c, R.curtain, F(x + 0.5, 2.3, Z1 - 0.3, 0, 0, 0.05), 0.9, 3.4);
    }
  }
  // Front: the entrance bay with double doors, the VARIETÉ sign and the tall fan window above it.
  const em = F(gapX, 0, Z1 + 0.05);
  plate(c, R.hall, sub(em, 0, 2.3, -0.02), bw - 0.4, 3.6);
  for (const s of [-1, 1]) bx(c, M.enamel, fr(em), s * 0.6, 0.45, 0, 0.08, 3.2, 0.08, WHITE_IRON);
  plate(c, R.variete, sub(em, 0, EAVE + 0.15, 0.15), 3.0, 0.62);
  const fanR = (bw + 0.4) / 2;
  archRib(c, M.enamel, sub(em, 0, EAVE + 0.5, 0), fanR, 0.18, 0.18, WHITE_IRON, 10);
  bx(c, M.enamel, fr(em), 0, EAVE + 0.45, 0, bw + 0.6, 0.12, 0.16, WHITE_IRON);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) / 7) * Math.PI;
    c.b.box(M.enamel, sub(em, (Math.sin(a) * fanR) / 2, EAVE + 0.5 + (Math.cos(a) * fanR) / 2, 0, 0, 0, -a), 0.05, fanR, 0.05, WHITE_IRON);
    if (k !== 2 && k !== 5) c.b.geo(atlas(c), cached(`kd-vfan${fanR.toFixed(2)}`, () => remap(new CircleGeometry(fanR, 2, 0, Math.PI / 7), R.vault)), sub(em, 0, EAVE + 0.5, -0.03, 0, 0, Math.PI / 2 - a - Math.PI / 14));
  }
  // Glass barrel vault: iron ribs every bay, purlins, glass lights with a broken patch over the hall.
  const vm = F(CX, EAVE, CZ);
  for (let i = 0; i <= bays * 2; i++) archRib(c, M.enamel, sub(vm, -LEN / 2 + (i * LEN) / (bays * 2), 0, 0, Math.PI / 2), RV, 0.1, 0.1, WHITE_IRON, 8);
  for (let k = 1; k < 8; k++) { const a = -Math.PI / 2 + (k / 8) * Math.PI; bx(c, M.enamel, fr(vm), 0, Math.cos(a) * RV - 0.04, Math.sin(a) * RV, LEN, 0.08, 0.08, WHITE_IRON); }
  const vg = cached('kd-vaultlight', () => remap(new PlaneGeometry(1, 1), R.vault));
  for (let i = 0; i < bays * 2; i++) for (let k = 0; k < 8; k++) {
    const broken = (i >= 3 && i <= 6 && k >= 3 && k <= 6) || rng.next() < 0.18;
    if (broken) continue;
    const a = -Math.PI / 2 + ((k + 0.5) / 8) * Math.PI, x = -LEN / 2 + ((i + 0.5) * LEN) / (bays * 2);
    c.b.geo(atlas(c), vg, sub(vm, x, Math.cos(a) * RV, Math.sin(a) * RV, 0, a - Math.PI / 2).multiply(new Matrix4().makeScale(LEN / (bays * 2) - 0.06, (RV * Math.PI) / 8 - 0.06, 1)));
  }
  // End walls under the vault: glass half discs with radial muntins.
  for (const s of [-1, 1]) {
    const em2 = F(s < 0 ? X0 : X1, EAVE, CZ, (s * Math.PI) / 2);
    c.b.geo(atlas(c), cached(`kd-vend${RV.toFixed(2)}`, () => remap(new CircleGeometry(RV, 8, 0, Math.PI), R.vault)), sub(em2, 0, 0, 0.02));
    for (const x of [-RV / 2, 0, RV / 2]) c.b.box(M.enamel, sub(em2, x, -EAVE / 2 + 0.2, 0.03), 0.08, EAVE - 0.4, 0.08, WHITE_IRON);
    for (let k = 0; k < 4; k++) plate(c, k % 2 ? R.pane : R.paneDark, sub(em2, -RV * 0.75 + k * RV * 0.5, 2.6 - EAVE, 0.02), RV * 0.48, 3.4);
  }
  // The kiosk: octagonal glass drum, lit pink frieze, lavender dome with a finial.
  const kx = 5.0, kz = 0.6, KR = 1.55, kf = F(kx, 0, kz);
  cy(c, M.stucco, sub(kf, 0, 0.2, 0), KR + 0.15, KR + 0.2, 0.4, 8, [0.8, 0.78, 0.82]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, a2 = a + Math.PI / 8, side = 2 * KR * Math.sin(Math.PI / 8);
    c.b.box(M.enamel, sub(kf, Math.sin(a) * KR, 1.75, Math.cos(a) * KR), 0.1, 2.7, 0.1, WHITE_IRON);
    plate(c, i % 3 === 1 ? R.paneDark : R.hall, sub(kf, Math.sin(a2) * KR * 0.92, 1.8, Math.cos(a2) * KR * 0.92, a2), side - 0.12, 2.4);
  }
  cy(c, M.enamel, sub(kf, 0, 3.2, 0), KR + 0.2, KR + 0.2, 0.25, 8, WHITE_IRON);
  bulbArc(c, sub(kf, 0, 3.0, 0), KR * 0.98, 0, Math.PI * 2, R.frieze, 0.24);
  c.b.geo(M.enamel, cached('kd-kdome', () => new SphereGeometry(KR + 0.15, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), sub(kf, 0, 3.32, 0).multiply(new Matrix4().makeScale(1, 0.75, 1)), VIOLET);
  cy(c, M.enamel, sub(kf, 0, 4.55, 0), 0.04, 0.16, 0.5, 6, SILVER);
  c.b.geo(M.enamel, cached('kd-knob2', () => new SphereGeometry(0.14, 6, 4)), sub(kf, 0, 4.85, 0), SILVER);
  // Wear: shards and a fallen vault rib in front, ivy and wisteria up the iron.
  rubble(c, F, X0 + 0.5, X1, Z1 + 0.9, 0.7, 4, [0.85, 0.82, 0.86], 26);
  c.b.box(M.enamel, F(1.4, 0.12, 3.2, 0.3, 0, 0.12), 3.2, 0.1, 0.1, WHITE_IRON);
  // 2026-11-19: a few lights patched with paper, rust running down the white iron columns.
  for (const [x, y, w, h] of [[X0 + 0.5 * bw - 0.25 * (bw - 0.3), 1.85, (bw - 0.4) / 2, 1.5], [X0 + 4.5 * bw + 0.25 * (bw - 0.3), 1.85, (bw - 0.4) / 2, 1.5], [X0 + 1.5 * bw + 0.25 * (bw - 0.3), 3.2, (bw - 0.4) / 2, 1.0]] as const) {
    c.b.box(M.linen, F(x, y, Z1 + 0.025, 0, 0, 0.03), w * 0.96, h * 0.92, 0.01, [0.92, 0.88, 0.76]);
  }
  for (let i = 0; i <= bays; i++) if (i % 2 === 0 || i === 3) rustRun(c, F(X0 + i * bw, 0, Z1 + 0.11), 0.02 * (i - 2.5), EAVE - 0.5 - (i % 3) * 0.7, 1.2 + (i % 2) * 1.3);
  creeper(c, F, X0, X0 + 2.2, 1.5, EAVE + 0.5, Z1 + 0.18, 7);
  creeper(c, F, X1 - 1.6, X1 + 0.1, 1, EAVE, Z1 + 0.18, 6);
  creeper(c, F, kx - 1.2, kx + 0.2, 0.8, 3, kz + KR + 0.1, 3);
  c.b.shadowBox(F(CX, 3.6, CZ), LEN, 7.2, Z1 - Z0);
  c.b.shadowBox(F(kx, 2.2, kz), 3.2, 4.4, 3.2);
}

// ---------------------------------------------------------------- Technische Hochschule (1884)

/**
 * Technische Hochschule, main building (Lucae, Hitzig, Raschdorff, 1878–1884): the long neo-Renaissance front in pale
 * sandstone behind its iron fence, a backdrop on the Chaussee; from the postcard „Das Polytechnikum“ (about 1900).
 * Cues: the rusticated ground floor with round-arched windows*, the three-arched portal of the central projection*, lamp
 * posts and the front lawn*, rows of round-arched windows between pilasters on every floor, the taller central block
 * with its attic and flagpole, corner projections, the balustrade over the flat roof (reveal). Worn: boarded windows, a
 * fallen balustrade run, rubble.
 */
function hochschule(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), ST: RGB = SAND, RU: RGB = SAND_D, FZ = 2.6, H = 17, rim = { mat: M.stucco, color: SAND_L };
  const dep = FZ + l.hz - 0.5, cz = FZ - dep / 2;
  // Body: rusticated ground floor, upper floors, cornice, balustrade (one run fallen), slate hip roof.
  bx(c, M.stucco, F, 0, 0, cz, 28, 5, dep, RU);
  bx(c, M.stucco, F, 0, 5, cz, 27.6, H - 5, dep - 0.3, ST);
  for (let y = 0.8; y < 4.8; y += 0.6) bx(c, M.stucco, F, 0, y, FZ + 0.01, 28, 0.06, 0.04, [0.55, 0.48, 0.42]);
  bx(c, M.stucco, F, 0, 4.8, FZ + 0.08, 28.2, 0.4, 0.4, ST);
  bx(c, M.stucco, F, 0, H - 0.5, cz, 28.4, 0.6, dep + 0.5, ST);
  for (const [x0, x1] of [[-13.8, -6], [-3, 3], [6, 9.5], [11.8, 13.8]] as const) {
    bx(c, M.stucco, F, (x0 + x1) / 2, H + 0.1, FZ - 0.05, x1 - x0, 0.15, 0.4, ST);
    for (let x = x0 + 0.3; x < x1; x += 0.55) cy(c, M.stucco, F(x, H + 0.6, FZ - 0.05), 0.1, 0.12, 0.9, 6, ST);
    bx(c, M.stucco, F, (x0 + x1) / 2, H + 1.05, FZ - 0.05, x1 - x0, 0.18, 0.45, ST);
  }
  c.b.geo(M.slate, frustum(27.6, dep - 0.8, 1.4, 25, dep - 3.2), F(0, H + 0.1, cz - 0.3), C.slate);
  // Windows: arched in the rustica, pedimented on the piano nobile, plain above, a small attic row.
  row(c, F, -14, 14, FZ, 2.6, 10, 1.3, 2.2, true, 0.15, undefined, 0, (i) => i === 4 || i === 5);
  // Arcaded windows on every floor (the postcard: rows of round arches, pilasters between them).
  for (const [y, h] of [[7.0, 2.6], [11.0, 2.4], [14.6, 1.6]] as const) row(c, F, -14, 14, FZ, y, 10, 1.3, h, true, 0.2, rim, 0, (i) => i === 4 || i === 5);
  for (let i = 0; i <= 10; i++) if (i < 4 || i > 6) bx(c, M.stucco, F, -14 + i * 2.8, 5.2, FZ + 0.08, 0.4, H - 5.7, 0.16, SAND_L);
  for (const y of [9.0, 12.9]) bx(c, M.stucco, F, 0, y, FZ + 0.08, 28, 0.25, 0.2, SAND_L);
  // Corner projections.
  for (const s of [-1, 1]) {
    bx(c, M.stucco, F, s * 12.3, 0, FZ + 0.35, 3.4, H + 0.8, 0.7, ST);
    bx(c, M.stucco, F, s * 12.3, H + 0.8, FZ + 0.3, 3.6, 0.5, 0.8, ST);
  }
  // Central projection: three-arched portal, giant columns, tall arched windows, attic with statues.
  const cx = 0, cw = 8.4, pz = FZ + 1.2;
  bx(c, M.stucco, F, cx, 0, FZ + 0.6, cw, 5, 1.2, RU);
  bx(c, M.stucco, F, cx, 5, FZ + 0.6, cw, H + 1.6 - 5, 1.2, ST);
  for (const x of [-2.5, 0, 2.5]) {
    bx(c, M.dark, F, x, 0.2, pz + 0.01, 1.9, 3.3, 0.04);
    archHead(c.b, c.M.dark, F(x, 3.5, pz + 0.01), 1.9, false, 0.01);
    archHead(c.b, c.M.stucco, F(x, 3.5, pz + 0.02), 2.4, false, 0.0, RU);
    bx(c, M.stucco, F, x, 0, pz - 0.1, 2.3, 0.2, 0.6, RU);
  }
  for (const x of [-3.9, -1.25, 1.25, 3.9]) bx(c, M.stucco, F, x, 5.0, pz + 0.1, 0.6, H + 1.6 - 5, 0.2, SAND_L);
  for (const x of [-2.55, 0, 2.55]) for (const [y, h] of [[7.6, 3.4], [12.4, 3.0]] as const) arch(c, F(x, y, pz), 1.6, h, 0.25, 0, rim);
  bx(c, M.stucco, F, cx, H + 0.2, FZ + 0.65, cw + 0.6, 0.9, 1.5, ST);
  bx(c, M.stucco, F, cx, H + 1.1, FZ + 0.5, cw - 0.4, 2.4, 1.0, ST);
  bx(c, M.stucco, F, cx, H + 3.5, FZ + 0.5, cw, 0.4, 1.2, ST);
  cy(c, M.iron, F(0, H + 6.2, FZ - 0.2), 0.05, 0.05, 4.6, 4, C.iron);
  // Front lawn with a low stone kerb, two lamp posts, the path to the portal.
  bx(c, M.mossy, F, -8.5, 0, (FZ + l.hz) / 2 + 0.5, 10, 0.08, l.hz - FZ - 1.2, [0.42, 0.52, 0.34]);
  bx(c, M.mossy, F, 8.5, 0, (FZ + l.hz) / 2 + 0.5, 10, 0.08, l.hz - FZ - 1.2, [0.42, 0.52, 0.34]);
  for (const s of [-1, 1]) {
    cy(c, M.iron, F(s * 3.5, 1.6, l.hz - 1), 0.06, 0.1, 3.2, 6, C.iron);
    c.b.geo(M.lampGlass, cached('kd-lantern', () => new CylinderGeometry(0.16, 0.12, 0.42, 6)), F(s * 3.5, 3.4, l.hz - 1));
  }
  // Wear: the fallen balustrade run lies on the lawn; boarded portal leaf; rubble.
  for (let i = 0; i < 6; i++) bx(c, M.stucco, F, 4.6 + i * 0.55 + c.rng.range(-0.1, 0.1), 0, FZ + 1.6 + c.rng.range(0, 1.2), 0.25, 0.25, 0.9, ST, c.rng.range(0, 3), Math.PI / 2);
  rubble(c, F, 3.5, 9, FZ + 1.4, 0.8, 8, ST);
  rubble(c, F, -12, -9, FZ + 1.2, 0.6, 4, ST);
  // 2026-11-19: sandbags in the left portal arch, a scaffold with a tarp on the west corner projection.
  sandbags(c, F(-2.5, 0, pz + 0.02), 1.8, 3, new Rng(1884));
  scaffold(c, F(-12.3, 0, FZ + 0.72), 3.0, 7.6, 0.7);
  c.b.wearWindow(F(2.5, 1.9, pz + 0.03), 1.9, 3.3, true);
  c.b.shadowBox(F(0, H / 2, cz), 28, H, dep);
}

// ---------------------------------------------------------------- Deutsches Opernhaus (1912)

/**
 * Deutsches Opernhaus (Heinrich Seeling, 1912), from the 1916 postcard: pale limestone, the long front on the
 * Bismarckstraße with paired giant columns before tall arched windows. Cues: the stepped plinth with the doors between
 * the column pairs (lit foyer)*, the name band over the middle door*, tall iron lamp posts and poster cases*, the
 * broad steps of the forecourt (boss fight)*, the column bases*; above: statues on the attic over each pair, the hipped
 * slate roof of the hall, the lower side wings with the balustraded terrace, the square stage tower with its flat top.
 * Worn: one column broken off with its drums on the steps, boarded windows, a missing statue, holes in the roof, rubble.
 */
function opernhaus(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), FZ = 4.8, H = 13.5, rim = { mat: M.stucco, color: LIME };
  // Plinth, front block, entablature with the name, attic with statues.
  bx(c, M.stucco, F, 0, 0, FZ - 3.4, 22, 1.3, 6.8, LIME_D);
  bx(c, M.stucco, F, 0, 1.3, FZ - 3.5, 21.6, H - 1.3, 6.6, LIME);
  bx(c, M.stucco, F, 0, H, FZ - 2.95, 22.4, 1.4, 7.2, LIME);
  bx(c, M.stucco, F, 0, H + 1.4, FZ - 3.2, 22.8, 0.35, 7.4, LIME_D);
  bx(c, M.stucco, F, 0, H + 1.75, FZ - 3.6, 21.4, 1.6, 6.2, LIME);
  plate(c, R.oper, F(0, H + 0.7, FZ + 0.67), 11, 1.0);
  // Paired giant columns on pedestals, tall arched windows between the pairs, doors at their foot.
  const pairs = [-9.2, -5.5, -1.85, 1.85, 5.5, 9.2];
  pairs.forEach((x, i) => {
    for (const d of [-0.55, 0.55]) {
      const broken = i === 4 && d > 0;
      bx(c, M.stucco, F, x + d, 1.3, FZ + 0.1, 0.95, 1.0, 0.95, LIME_D);
      cy(c, M.stucco, F(x + d, broken ? 2.3 + 2.6 : 2.3 + (H - 3.1) / 2, FZ + 0.1), 0.38, 0.42, broken ? 5.2 : H - 3.1, 10, LIME);
      if (!broken) bx(c, M.stucco, F, x + d, H - 0.8, FZ + 0.1, 1.0, 0.8, 1.0, LIME_D);
    }
    if (i !== 2) { bx(c, M.stucco, F, x, H + 3.35, FZ - 0.4, 1.0, 0.45, 0.9, LIME_D); figure(c, x, H + 3.8, FZ - 0.4, 2.3, LIME_D); }
  });
  for (let i = 0; i < 5; i++) {
    const x = (pairs[i]! + pairs[i + 1]!) / 2;
    arch(c, F(x, 7.4, FZ - 0.18), 2.0, 5.4, 0.3, i === 3 ? 2 : 0, rim);
    bx(c, M.dark, F, x, 1.3, FZ - 0.18, 1.8, 2.7, 0.04);
    plate(c, R.foyer, F(x, 2.6, FZ - 0.14), 1.7, 2.5);
    bx(c, M.stucco, F, x, 4.0, FZ - 0.05, 2.4, 0.3, 0.3, LIME_D);
  }
  plate(c, R.oper, F(0, 4.55, FZ + 0.12), 3.2, 0.34);
  // The broken column's drums on the steps.
  for (let k = 0; k < 3; k++) cy(c, M.stucco, F(6.6 + k * 0.9, 0.4, FZ + 1.6 + (k % 2) * 0.5).multiply(new Matrix4().makeRotationZ(Math.PI / 2 + k * 0.2)), 0.4, 0.4, 0.9, 10, LIME);
  // Broad steps before the front.
  for (let i = 0; i < 4; i++) bx(c, M.stucco, F, 0, 0, FZ + (2.6 - i * 0.6) / 2, 20.5 - i * 0.4, 0.15 * (i + 1) + 0.2, 2.6 - i * 0.6, LIME_D);
  // Side wings: lower, an arcade of square piers below, the balustraded terrace above.
  for (const s of [-1, 1]) {
    const wx = s * 12.4;
    bx(c, M.stucco, F, wx, 0, FZ - 3.8, 3.2, 9, 6.0, LIME);
    bx(c, M.stucco, F, wx, 9, FZ - 3.8, 3.4, 0.5, 6.2, LIME_D);
    for (const z of [FZ - 1.2, FZ - 3.8, FZ - 6.2]) for (const x of [wx - s * 1.4]) bx(c, M.dark, F, x + s * 0.02, 0.5, z, 0.4, 2.6, 1.6, undefined, 0);
    row(c, F, wx - 1.4, wx + 1.4, FZ - 0.8, 5.5, 1, 1.2, 2.2, false, 0.2, rim);
    bx(c, M.stucco, F, wx, 0.3, FZ - 0.75, 1.6, 2.8, 0.05, LIME_D);
    plate(c, R.poster, F(wx, 2.0, FZ - 0.7), 1.2, 2.3);
    bx(c, M.stucco, F, wx, 9.5, FZ - 0.9, 3.2, 0.12, 0.25, LIME_D);
    for (let x = wx - 1.4; x <= wx + 1.4; x += 0.4) cy(c, M.stucco, F(x, 9.9, FZ - 0.9), 0.08, 0.1, 0.7, 5, LIME);
    bx(c, M.stucco, F, wx, 10.25, FZ - 0.9, 3.2, 0.14, 0.3, LIME_D);
  }
  // The hall behind (hipped slate roof with two holes) and the square stage tower with its flat, railed top.
  bx(c, M.stucco, F, 0, 0, -3.6, 21, 16, 5.6, LIME_D);
  c.b.geo(M.slate, frustum(22.4, 9.2, 4.6, 14, 1.6), F(0, 16.8, -2.4), C.slate);
  for (const [x, z] of [[-4, -1.2], [5.5, -3]] as const) c.b.box(M.dark, F(x, 19.0, z, 0, -0.5), 1.6, 0.05, 1.3);
  bx(c, M.stucco, F, 0, 0, -6.6, 13, 21, 2.8, LIME);
  bx(c, M.stucco, F, 0, 16, -6.0, 13.4, 5, 4.2, LIME);
  row(c, F, -6, 6, -3.9, 18.4, 5, 0.9, 1.6, false, 0.1);
  c.b.geo(M.slate, frustum(13.6, 4.6, 3.6, 7, 1.4), F(0, 21, -6.0), C.slate);
  cy(c, M.stucco, F(0, 25, -6.0), 1.6, 1.6, 0.8, 12, LIME_D);
  cy(c, M.iron, F(0, 27, -6.0), 0.05, 0.05, 3.2, 4, C.iron);
  // Iron lamp posts and poster cases on the forecourt (inside the footprint).
  for (const x of [-10.5, 10.5]) {
    cy(c, M.iron, F(x, 2.4, l.hz - 0.6), 0.08, 0.14, 4.8, 6, C.iron);
    c.b.box(M.iron, F(x, 4.7, l.hz - 0.6), 1.2, 0.08, 0.08, C.iron);
    for (const d of [-0.55, 0.55]) c.b.geo(M.lampGlass, cached('kd-lantern', () => new CylinderGeometry(0.16, 0.12, 0.42, 6)), F(x + d, 4.45, l.hz - 0.6));
  }
  // Wear: rubble from the attic, the missing statue's plinth, shards.
  rubble(c, F, -3, 0.8, FZ + 2.2, 0.5, 6, LIME, 4);
  rubble(c, F, 8, 11, FZ + 2.2, 0.5, 7, LIME);
  // 2026-11-19: a timber post shores the entablature over the broken column, with braces; two step slabs broken out
  // and tipped; bills beside the poster cases of the side wings.
  bx(c, M.darkWood, F, 6.05, 7.5, FZ + 0.1, 0.28, H - 0.8 - 7.5, 0.28, TIMBER_POST);
  for (const s of [-1, 1]) c.b.box(M.darkWood, F(6.05 + s * 0.55, H - 2.2, FZ + 0.1, 0, 0, s * 0.62), 0.12, 2.4, 0.12, TIMBER_POST);
  bx(c, M.stucco, F, -6.4, 0.12, FZ + 1.9, 1.1, 0.22, 0.55, LIME_D, 0.3, 0.12);
  bx(c, M.dark, F, -6.4, 0.2, FZ + 2.31, 0.9, 0.14, 0.02);
  bx(c, M.stucco, F, 2.8, 0.42, FZ + 1.1, 0.8, 0.18, 0.5, LIME_D, -0.4, -0.15);
  for (const s of [-1, 1]) {
    const wm = F(s * 12.4, 0, FZ - 0.8 + 0.01);
    bills(c, wm, [[s > 0 ? 'variete' : 'kino', -1.2, 1.6, 1.05], [s > 0 ? 'sechstage' : 'revue', 1.2, 1.65, 1.05, 0.03]]);
    scraps(c, wm, [['boxen', 1.25, 2.55, 0.4, 0.32, [0, 0, 1, 0.35]]]);
  }
  creeper(c, F, -11, -9.6, 1.5, 7, FZ + 0.65, 8);
  c.b.shadowBox(F(0, H / 2 + 1, FZ - 3.4), 22, H + 3, 6.8);
  c.b.shadowBox(F(0, 10, -4.8), 21, 20, 6.4);
}

// ---------------------------------------------------------------- Theater des Westens (1896)

/** Half-timbered gable (dark beams on a brick-red infill) filling a triangle w × h, base centre at `m` (facing +z). */
function timberGable(c: Ctx, m: Matrix4, w: number, h: number): void {
  const M = c.M, BEAM: RGB = [0.36, 0.26, 0.2];
  c.b.geo(M.brick, cached(`kd-tg${w},${h}`, () => new CircleGeometry(1, 1, 0, Math.PI).scale(w / 2, h, 1)), sub(m, 0, 0, 0.01), [0.95, 0.7, 0.6]);
  for (let k = 0; k <= 4; k++) { const x = -w / 2 + (k * w) / 4, top = h * (1 - Math.abs(x) / (w / 2)); if (top > 0.3) c.b.box(M.darkWood, sub(m, x, top / 2, 0.06), 0.18, top, 0.1, BEAM); }
  for (const f of [0.33, 0.66]) c.b.box(M.darkWood, sub(m, 0, h * f, 0.06), w * (1 - f) - 0.1, 0.18, 0.1, BEAM);
  for (const s of [-1, 1]) c.b.box(M.darkWood, sub(m, (s * w) / 4, h / 2, 0.08, 0, 0, s * -Math.atan2(h, w / 2)), Math.hypot(w / 2, h), 0.2, 0.1, BEAM);
}

/**
 * Theater des Westens (Bernhard Sehring, 1896), Kantstraße, from the 1901 postcard and later night photos (the front
 * survives as built): cream sandstone, eclectic. Cues: the rusticated ground-floor arcade with lit doors and poster
 * cases*, iron candelabra at the entrance*, the balcony balustrade over it (5 m), the tall arched windows between paired
 * columns, the name on the frieze, the attic with statues and the crowned centre group, the corner pavilions with the
 * slim lantern spire (left) and the tall lantern tower (right), the stage house with its half-timbered gables behind.
 * Worn: boarded arches, a broken balustrade, a fallen statue and rubble.
 */
function theaterwestens(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), CR: RGB = [1.6, 2.1, 2.55], CRD: RGB = [1.2, 1.55, 1.9], FZ = 2.6, rim = { mat: M.stucco, color: [1.75, 2.3, 2.8] as RGB };
  // Front block and pavilions.
  bx(c, M.stucco, F, -0.4, 0, FZ - 2.6, 9.6, 5, 5.2, CRD);
  bx(c, M.stucco, F, -0.4, 5, FZ - 2.7, 9.4, 7, 5.0, CR);
  for (let y = 0.7; y < 4.8; y += 0.55) bx(c, M.stucco, F, -0.4, y, FZ + 0.01, 9.6, 0.06, 0.04, [0.8, 1.0, 1.2]);
  bx(c, M.stucco, F, -0.4, 11.9, FZ - 2.5, 9.8, 0.4, 5.6, CRD);
  plate(c, R.tdw, F(-0.4, 11.35, FZ + 0.08), 8.6, 0.85);
  bx(c, M.stucco, F, -0.4, 12.3, FZ - 2.7, 9.4, 1.4, 5.0, CR);
  // Ground-floor arcade: five arched doors (lit foyer), poster cases on the piers, steps.
  for (let i = 0; i < 5; i++) {
    const x = -4.4 + i * 1.95;
    bx(c, M.dark, F, x, 0.3, FZ + 0.01, 1.3, 2.6, 0.04);
    archHead(c.b, M.dark, F(x, 2.9, FZ + 0.01), 1.3, false, 0.01);
    if (i === 1) c.b.wearWindow(F(x, 1.75, FZ + 0.02), 1.3, 2.9, true); else plate(c, R.foyer, F(x, 1.6, FZ + 0.05), 1.2, 2.5);
    archHead(c.b, M.stucco, F(x, 2.9, FZ + 0.02), 1.8, false, 0, CRD);
    if (i < 4) { bx(c, M.darkWood, F, x + 0.98, 0.8, FZ + 0.06, 0.5, 1.6, 0.08, [0.4, 0.3, 0.26]); plate(c, i % 2 ? R.posterB : R.poster, F(x + 0.98, 1.6, FZ + 0.11), 0.42, 1.45); }
  }
  for (let i = 0; i < 2; i++) bx(c, M.stucco, F, -0.4, 0, FZ + 0.4 - i * 0.2, 10 - i * 0.5, 0.15 * (i + 1), 0.8 + i * 0.4, CRD);
  for (const x of [-5.4, 4.6]) {
    cy(c, M.iron, F(x, 1.5, FZ + 1.1), 0.07, 0.12, 3.0, 6, C.iron);
    for (const d of [-0.4, 0, 0.4]) c.b.geo(M.lampGlass, cached('kd-globe', () => new SphereGeometry(0.15, 6, 4)), F(x + d, 3.1 + (d ? 0 : 0.3), FZ + 1.1));
    c.b.box(M.iron, F(x, 3.0, FZ + 1.1), 0.9, 0.06, 0.06, C.iron);
  }
  // Balcony on consoles over the arcade (one run broken off).
  bx(c, M.stucco, F, -0.4, 5.0, FZ + 0.45, 9.4, 0.25, 0.9, CRD);
  for (let x = -4.9; x < 4.2; x += 0.32) if (x < 0.8 || x > 2.2) cy(c, M.stucco, F(x, 5.6, FZ + 0.82), 0.06, 0.08, 0.7, 5, CR);
  bx(c, M.stucco, F, -2.05, 5.95, FZ + 0.82, 5.8, 0.14, 0.24, CRD);
  bx(c, M.stucco, F, 3.3, 5.95, FZ + 0.82, 1.9, 0.14, 0.24, CRD);
  // Piano nobile: five tall arched windows between paired columns, oculi above.
  for (let i = 0; i < 5; i++) arch(c, F(-4.4 + i * 1.95, 8.2, FZ), 1.1, 3.4, 0.35, i === 3 ? 2 : 0, rim);
  for (let i = 0; i < 6; i++) for (const d of [-0.18, 0.18]) cy(c, M.stucco, F(-5.38 + i * 1.95 + d, 7.95, FZ + 0.18), 0.13, 0.15, 5.6, 8, CR);
  // Attic: balustrade, statues over the pairs, the crowned centre group.
  for (let i = 0; i < 6; i++) if (i !== 4) figure(c, -5.38 + i * 1.95, 13.7, FZ - 0.3, 1.6, CRD);
  bx(c, M.stucco, F, -0.4, 13.7, FZ - 0.6, 2.6, 2.2, 1.2, CR);
  c.b.geo(M.stucco, cached('kd-tdw-crown', () => new CircleGeometry(1.3, 10, 0, Math.PI)), F(-0.4, 15.9, FZ - 0.0), CR);
  figure(c, -0.4, 15.9, FZ - 0.6, 2.4, [0.6, 0.85, 0.75], M.enamel);
  // Left pavilion: narrow, a slim turret with a lantern spire.
  bx(c, M.stucco, F, -5.4, 0, FZ - 2.4, 1.2, 14, 5.4, CR);
  bx(c, M.stucco, F, -5.4, 14, FZ - 0.6, 1.4, 1.6, 1.4, CRD);
  cy(c, M.slate, F(-5.4, 16.3, FZ - 0.6), 0.25, 0.8, 1.4, 8, C.slate);
  cy(c, M.stucco, F(-5.4, 17.4, FZ - 0.6), 0.35, 0.35, 0.8, 8, CRD);
  cy(c, M.slate, F(-5.4, 18.9, FZ - 0.6), 0.02, 0.42, 2.2, 8, C.slate);
  // Right pavilion: wider, its side gable, the tall lantern tower over the corner.
  bx(c, M.stucco, F, 4.9, 0, FZ - 2.6, 2.2, 5, 5.6, CRD);
  bx(c, M.stucco, F, 4.9, 5, FZ - 2.6, 2.2, 9.5, 5.4, CR);
  arch(c, F(4.9, 2.6, FZ + 0.2), 1.1, 2.2, 0.3, 0, rim);
  arch(c, F(4.9, 8.2, FZ + 0.2), 1.1, 3.4, 0.3, 1, rim);
  for (const [y, h] of [[2.6, 2.2], [8.2, 2.6]] as const) row(c, F, -2.4, 2.4, 6.01, y, 2, 0.9, h, true, 0.3, rim, Math.PI / 2);
  pediment(c, M.stucco, F(6.0, 14.5, FZ - 2.6, Math.PI / 2), 5.4, 2.2, 0.4, CR);
  c.b.geo(M.slate, frustum(2.2, 5.4, 2.2, 0.3, 5.4), F(4.9, 14.5, FZ - 2.6), C.slate);
  bx(c, M.stucco, F, 4.9, 14.5, FZ - 0.4, 1.8, 2.0, 1.8, CR);
  c.b.geo(M.slate, frustum(2.0, 2.0, 1.6, 0.9, 0.9), F(4.9, 16.5, FZ - 0.4), C.slate);
  cy(c, M.stucco, F(4.9, 18.5, FZ - 0.4), 0.5, 0.5, 1.2, 8, CRD);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; bx(c, M.dark, F, 4.9 + Math.sin(a) * 0.51, 18.1, FZ - 0.4 + Math.cos(a) * 0.51, 0.3, 0.7, 0.3, undefined, a); }
  cy(c, M.slate, F(4.9, 20.4, FZ - 0.4), 0.02, 0.6, 2.6, 8, C.slate);
  // The stage house behind: brick and half-timbered gables (east and west), slate roof.
  bx(c, M.stucco, F, 0, 0, -l.hz + 1.7, 11, 15, 3.4, CRD);
  c.b.geo(M.slate, frustum(11, 3.6, 3.2, 11, 0.2), F(0, 15, -l.hz + 1.7), C.slate);
  for (const s of [-1, 1]) timberGable(c, F(s * 5.52, 15, -l.hz + 1.7, (s * Math.PI) / 2), 3.4, 3.1);
  c.b.geo(M.slate, frustum(9.4, 5.0, 2.4, 8, 1.2), F(-0.4, 13.7, FZ - 2.7), C.slate);
  // Wear: the fallen statue and balustrade on the pavement, rubble, ivy on the left pavilion.
  figure(c, 1.6, 0.25, FZ + 1.2, 1.4, CRD);
  rubble(c, F, 0.6, 2.8, FZ + 1.1, 0.5, 6, CR, 3);
  rubble(c, F, 4, 5.8, FZ + 1.0, 0.6, 4, CR);
  // 2026-11-19: small bills beside the right pavilion's door, a slipped patch on the stage-house roof (reveal).
  bills(c, F(4.9, 0, FZ + 0.21), [['variete', -0.82, 1.6, 0.9], ['kabarett', 0.82, 1.62, 0.9, 0.04]]);
  scraps(c, F(0, 0, FZ + 0.01), [['revue', -3.42, 0.95, 0.35, 0.4, [0, 0.55, 1, 1]], ['boxen', 0.48, 0.9, 0.3, 0.35, [0.1, 0.6, 1, 1]]]);
  battens(c, slope(c, -3, 15, -l.hz + 1.7 + 1.8, 1.7, 3.2, 0.45), 1.8, 1.2, M.slate, C.slate);
  creeper(c, F, -6, -4.8, 1, 9, FZ + 0.35, 8);
  c.b.shadowBox(F(-0.4, 7, FZ - 2.6), 12, 14, 5.6);
  c.b.shadowBox(F(0, 8.5, -l.hz + 1.7), 11, 17, 3.4);
}

// ---------------------------------------------------------------- Gloria-Palast (Romanisches Haus I, cinema 1926)

/**
 * Gloria-Palast in the first Romanisches Haus (Franz Schwechten, 1896; cinema from 1926), from the photo of about 1925:
 * rough grey stone, neo-Romanesque. Cues: the balustraded café terrace* with the CAFÉ · CONDITOREI · DIELE band*, the
 * cinema door with its canopy, posters and the PREMIERE band*, one letter of GLORIA in each first-floor arch and of
 * PALAST in the second (5 to 9 m), the dwarf gallery under the eaves, the round corner towers with pointed slate spires,
 * the middle gable with the rose window, the steep slate roof with GLORIA-PALAST on its ridge (reveal). Worn: a letter
 * fallen out, a broken terrace run, a tower spire lost its tip, rubble.
 */
function gloriapalast(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), GR: RGB = [0.82, 1.18, 1.95], GRD: RGB = [0.62, 0.9, 1.5], hx = l.hx, FZ = l.hz - 1.3, D = FZ + l.hz, cz = FZ - D / 2, H = 12;
  bx(c, M.stucco, F, 0, 0, cz, hx * 2 - 0.4, H, D, GR);
  for (let y = 0.8; y < 4; y += 0.5) bx(c, M.stucco, F, 0, y, FZ + 0.01, hx * 2 - 0.4, 0.05, 0.04, [0.4, 0.55, 0.9]);
  bx(c, M.stucco, F, 0, 4.0, FZ + 0.1, hx * 2 - 0.2, 0.4, 0.3, GRD);
  bx(c, M.stucco, F, 0, H - 0.2, cz, hx * 2, 0.5, D + 0.3, GRD);
  c.b.geo(M.slate, frustum(hx * 2 - 0.4, D, 4.6, hx * 2 - 4, 0.3), F(0, H + 0.3, cz), C.slate);
  plate(c, R.gloria, F(0, H + 4.6, cz + 0.12), 6.6, 0.9);
  plate(c, R.gloria, F(0, H + 4.6, cz - 0.12, Math.PI), 6.6, 0.9);
  c.b.box(M.iron, F(0, H + 4.1, cz), 6.4, 0.1, 0.1, C.iron);
  // Ground floor: café windows (lit), the cinema door with a canopy in the middle, the café band.
  const xs = [-3.4, -1.7, 1.7, 3.4].map((x) => (x * (hx - 1.4)) / 4.1);
  for (const x of xs) { bx(c, M.dark, F, x, 0.5, FZ + 0.01, 1.2, 2.2, 0.04); plate(c, R.cafeLit, F(x, 1.6, FZ + 0.04), 1.1, 2.0); archHead(c.b, M.stucco, F(x, 2.7, FZ + 0.03), 1.4, false, 0, GRD); }
  bx(c, M.dark, F, 0, 0, FZ + 0.01, 1.8, 2.9, 0.04);
  plate(c, R.foyer, F(0, 1.45, FZ + 0.05), 1.7, 2.8);
  bx(c, M.iron, F, 0, 3.0, FZ + 0.7, 3.0, 0.25, 1.4, [0.3, 0.3, 0.34]);
  plate(c, R.kino, F(0, 3.12, FZ + 1.41), 3.0, 0.24);
  bulbs(c, F(0, 2.96, FZ + 1.41), 3.0, R.bulbW, 0.12);
  plate(c, R.cafe, F(0, 3.62, FZ + 0.14), hx * 2 - 2.2, 0.42);
  for (const s of [-1, 1]) { bx(c, M.darkWood, F, s * 1.35, 0.6, FZ + 0.08, 0.5, 1.6, 0.08, [0.4, 0.3, 0.26]); plate(c, s < 0 ? R.poster : R.posterB, F(s * 1.35, 1.4, FZ + 0.13), 0.42, 1.45); }
  // The café terrace: a low balustrade on the pavement edge (one run broken), tables.
  bx(c, M.stucco, F, 0, 0, FZ + 0.65, hx * 2 - 0.6, 0.15, 1.3, GRD);
  for (let x = -hx + 0.5; x < hx - 0.4; x += 0.3) if (Math.abs(x) > 1.6 && !(x > 2.4 && x < 3.4)) cy(c, M.stucco, F(x, 0.55, l.hz - 0.25), 0.06, 0.08, 0.8, 5, GR);
  for (const [x0, x1] of [[-hx + 0.4, -1.6], [1.6, 2.4]] as const) bx(c, M.stucco, F, (x0 + x1) / 2, 0.95, l.hz - 0.25, x1 - x0, 0.12, 0.22, GRD);
  for (const x of [-hx + 1.6, hx - 1.4]) { cy(c, M.darkWood, F(x, 0.85, FZ + 0.7), 0.3, 0.3, 0.05, 8, [0.5, 0.34, 0.28]); cy(c, M.iron, F(x, 0.55, FZ + 0.7), 0.03, 0.03, 0.6, 4, C.iron); }
  // First and second floor: arcades with the letters, a dwarf gallery under the eaves.
  for (let i = 0; i < 6; i++) {
    const x = -hx + 1.7 + (i * (hx * 2 - 3.4)) / 5;
    for (const [y, r] of [[5.6, R.lPalast], [8.3, R.lGloria]] as const) {
      bx(c, M.dark, F, x, y - 1.0, FZ + 0.01, 0.95, 1.6, 0.04);
      archHead(c.b, M.dark, F(x, y + 0.6, FZ + 0.01), 0.95, false, 0.01);
      archHead(c.b, M.stucco, F(x, y + 0.6, FZ + 0.02), 1.25, false, 0, GRD);
      const lost = y > 8 && i === 4;
      if (!lost) c.b.geo(atlas(c), cached(`kd-letter${r[0]},${i}`, () => remap(new PlaneGeometry(1, 1), [r[0] + (i * r[2]) / 6, r[1], r[2] / 6, r[3]])), F(x, y - 0.1, FZ + 0.05).multiply(new Matrix4().makeScale(0.85, 1.0, 1)));
      cy(c, M.stucco, F(x - 0.6, y - 0.2, FZ + 0.12), 0.08, 0.08, 1.6, 6, GRD);
    }
  }
  for (let i = 0; i < 12; i++) { const x = -hx + 1.3 + (i * (hx * 2 - 2.6)) / 11; bx(c, M.dark, F, x, 10.3, FZ + 0.01, 0.4, 0.9, 0.04); archHead(c.b, M.dark, F(x, 11.2, FZ + 0.01), 0.4, false, 0.01); }
  // Middle gable with the rose window, two dormers.
  const gm = F(0, H + 0.3, FZ - 0.2);
  c.b.geo(M.stucco, frustum(4.6, 0.8, 4.2, 0.02, 0.8), gm, GR);
  c.b.geo(M.dark, cached('kd-rose', () => new CircleGeometry(0.75, 12)), sub(gm, 0, 1.7, 0.42));
  c.b.geo(M.stucco, cached('kd-rosering', () => new TorusGeometry(0.8, 0.1, 4, 14)), sub(gm, 0, 1.7, 0.42), GRD);
  for (const s of [-1, 1]) { bx(c, M.stucco, F, s * (hx - 3.2), H + 0.3, FZ - 0.8, 1.0, 1.2, 0.8, GR); c.b.geo(M.slate, frustum(1.2, 1.0, 0.7, 1.2, 0.05), F(s * (hx - 3.2), H + 1.5, FZ - 0.8), C.slate); }
  // Round corner towers on the front with pointed slate spires (the right one lost its tip).
  for (const s of [-1, 1]) {
    const tx = s * (hx - 0.95), tz = FZ - 0.6, TR = 0.95;
    cy(c, M.stucco, F(tx, 7.5, tz), TR, TR, 15, 12, GR);
    for (const y of [5.6, 8.3, 11.2]) arch(c, F(tx + s * 0.0, y, tz + TR + 0.01), 0.55, 1.1, 0.2, 2);
    cy(c, M.stucco, F(tx, 15.15, tz), TR + 0.15, TR + 0.15, 0.3, 12, GRD);
    if (s < 0) cy(c, M.slate, F(tx, 15.3 + 2.3, tz), 0.03, TR + 0.1, 4.6, 12, C.slate);
    else { cy(c, M.slate, F(tx, 15.3 + 1.4, tz), 0.45, TR + 0.1, 2.8, 12, C.slate); bx(c, M.iron, F, tx + 0.2, 18, tz, 0.06, 1.0, 0.06, C.iron, 0, 0, 0.4); }
  }
  // 2026-11-19: film posters on both side walls, a slipped patch of the steep slate roof beside the gable.
  for (const s of [-1, 1]) {
    const sm = F(s * (hx - 0.2 + 0.01), 0, -1.0, (s * Math.PI) / 2), z = (zz: number): number => -s * zz;
    bills(c, sm, [['kino', z(-0.9), 1.65, 1.2], [s > 0 ? 'revue' : 'boxen', z(-0.25), 1.6, 1.15, 0.03], ['sechstage', z(0.45), 1.65, 1.2]]);
    scraps(c, sm, [['kabarett', z(1.2), 1.4, 0.45, 0.6, [0, 0.4, 0.9, 1]]]);
  }
  battens(c, slope(c, 3.5, H + 0.3, FZ, 2.7, 4.6, 0.3), 1.1, 1.0, M.slate, C.slate);
  // Wear: rubble from the broken terrace and the spire, the lost letter on the pavement.
  rubble(c, F, 2.2, 3.8, l.hz - 0.6, 0.3, 6, GR, 2);
  rubble(c, F, -hx + 0.4, -hx + 1.8, FZ + 0.8, 0.4, 3, GR);
  c.b.shadowBox(F(0, H / 2, cz), hx * 2, H + 4, D);
}

// ---------------------------------------------------------------- Marmorhaus (1913)

/**
 * Marmorhaus (Hans Toebelmann, 1913), Kurfürstendamm, from a later photo of the surviving front (no usable pre-1930
 * photo fetched): the flat front of white Silesian marble, a projecting plain middle bay, side bays with window strips
 * through two floors between fluted pilasters, MARMORHAUS across the top; the cinema entrance with a flat canopy and bulbs below. It stands on the
 * south side of the Ku'damm, so the game camera sees its back: the plain rear wall of the cinema hall with poster cases
 * (Caligari opened here on 26 February 1920)*, its roof, and the name on a double-sided roof sign (the camera cue). Worn: broken marble panels, boarded windows, rubble.
 */
function marmorhaus(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), WH: RGB = [1.25, 1.85, 3.4], WHD: RGB = [0.95, 1.4, 2.6], BK: RGB = [0.78, 1.0, 1.5], hx = l.hx, hz = l.hz, H = 13, FZ = hz - 0.3;
  // Street block (front, north) and the low cinema hall behind it (toward the camera).
  bx(c, M.stucco, F, 0, 0, FZ - 2.6, hx * 2 - 0.2, H, 5.2, WH);
  bx(c, M.stucco, F, 0, 0, -hz + 1.4, hx * 2 - 1.4, 7.5, 2.8, BK);
  c.b.geo(M.slate, frustum(hx * 2 - 1.4, 2.9, 1.4, hx * 2 - 1.4, 0.2), F(0, 7.5, -hz + 1.4), C.slate);
  c.b.geo(M.slate, frustum(hx * 2 - 0.2, 5.2, 1.8, hx * 2 - 2.4, 2.6), F(0, H, FZ - 2.6), C.slate);
  // Marble front: panels with veins, the middle bay projecting with pilaster strips, MARMORHAUS at the top.
  for (let x = -hx + 1.2; x < hx - 0.6; x += 2.4) for (let y = 4.6; y < H - 0.6; y += 2.1) if (c.rng.next() > 0.08) plate(c, R.marble, F(x, y + 1.0, FZ + 0.02), 2.36, 2.06);
  bx(c, M.stucco, F, 0, 4.4, FZ + 0.25, 4.6, H + 0.6 - 4.4, 0.5, WH);
  bx(c, M.stucco, F, 0, H - 0.3, FZ + 0.1, hx * 2, 0.6, 0.6, WH);
  plate(c, R.marmor, F(0, H - 1.25, FZ + 0.56), 4.4, 0.75);
  // Side bays: tall window strips through two floors between fluted pilasters with capitals, a row of small top windows.
  for (const s of [-1, 1]) {
    for (const x of [s * 3.6, s * 5.6]) {
      bx(c, M.dark, F, x, 4.9, FZ + 0.03, 1.1, 6.0, 0.04);
      for (let k = 0; k < 4; k++) plate(c, k === 1 && s > 0 ? R.pane : R.paneDark, F(x, 5.65 + k * 1.5, FZ + 0.06), 1.0, 1.44);
    }
    for (const x of [s * 2.6, s * 4.6, s * 6.6]) {
      for (const d of [-0.12, 0, 0.12]) bx(c, M.stucco, F, x + d, 4.6, FZ + 0.1, 0.08, 6.6, 0.12, WHD);
      bx(c, M.stucco, F, x, 11.2, FZ + 0.12, 0.6, 0.35, 0.25, WH);
    }
    row(c, F, s * 2.8, s * (hx - 0.3), FZ, 12.0, 2, 1.1, 0.9, false, 0.2);
  }
  // Middle bay: plain marble field, one window over the canopy.
  for (let y = 5.2; y < H - 2; y += 1.4) plate(c, R.marble, F(0, y + 0.7, FZ + 0.51), 4.4, 1.38);
  win(c, F(0, 6.0, FZ + 0.52), 2.0, 1.4, 0.3);
  // Ground floor: the cinema entrance with a flat canopy and bulbs, display windows, posters.
  bx(c, M.stucco, F, 0, 0, FZ + 0.02, hx * 2, 4.4, 0.2, WHD);
  bx(c, M.dark, F, 0, 0, FZ + 0.13, 4.2, 3.1, 0.04);
  plate(c, R.foyer, F(0, 1.55, FZ + 0.17), 4.0, 3.0);
  bx(c, M.iron, F, 0, 3.3, FZ + 1.2, 6, 0.35, 2.0, [0.3, 0.3, 0.34]);
  bulbs(c, F(0, 3.36, FZ + 2.21), 6, R.bulbW, 0.16);
  plate(c, R.kino, F(0, 3.78, FZ + 2.2), 5.2, 0.42);
  for (const s of [-1, 1]) { bx(c, M.dark, F, s * 4.6, 0.6, FZ + 0.13, 2.4, 2.4, 0.04); plate(c, s < 0 ? R.caligari : R.posterB, F(s * 4.6 - s * 0.6, 1.8, FZ + 0.17), 0.9, s < 0 ? 1.1 : 1.9); win(c, F(s * 4.6 + s * 0.5, 1.8, FZ + 0.15), 1.1, 2.2, 0.6, 1); }
  // The camera side: plain rear wall, the cinema's back with an exit, the name on a double-sided roof sign.
  row(c, F, -hx + 0.8, hx - 0.8, FZ - 5.2, 10.4, 4, 1.0, 1.4, false, 0.1, undefined, Math.PI);
  for (let x = -hx + 2; x < hx - 1; x += 3) win(c, F(x, 4.8, -hz + 2.81 - 2.8 - 0.02, Math.PI), 1.2, 1.4, 0.15, c.rng.next() < 0.3 ? 1 : 0);
  bx(c, M.dark, F, 2.8, 0, -hz - 0.02, 1.4, 2.4, 0.04);
  for (const x of [-4.5, 0.2]) { bx(c, M.darkWood, F, x, 0.6, -hz - 0.03, 1.1, 1.6, 0.06, [0.3, 0.24, 0.2]); plate(c, x < 0 ? R.caligari : R.poster, F(x, 1.4, -hz - 0.07, Math.PI), 0.9, 1.3); }
  const sm = F(0, H + 1.9, FZ - 2.6);
  for (const x of [-2.6, 2.6]) c.b.box(M.iron, sub(sm, x, -0.9, 0), 0.1, 1.9, 0.1, C.iron);
  plate(c, R.marmor, sub(sm, 0, 0.3, 0.06), 6.4, 1.1);
  plate(c, R.marmor, sub(sm, 0, 0.3, -0.06, Math.PI), 6.4, 1.1);
  bulbs(c, sub(sm, 0, -0.32, -0.08, Math.PI), 6.4, R.bulbW, 0.14);
  // 2026-11-19: the back wall of the cinema hall is a bill board (the camera side); a shutter hangs off its back window.
  const back = F(0, 0, -hz - 0.03, Math.PI);
  bills(c, back, [['kino', 2.3, 1.6, 1.2], ['revue', 1.6, 1.58, 1.15, -0.03], ['boxen', -1.4, 1.62, 1.2], ['variete', -4.4, 1.6, 1.15, 0.04], ['sechstage', -5.1, 1.62, 1.2]]);
  scraps(c, back, [['kabarett', 3.0, 1.3, 0.45, 0.6, [0, 0.4, 0.9, 1]], ['kino', -2.1, 2.1, 0.4, 0.35, [0, 0, 1, 0.4]]]);
  shutter(c, F(1, 4.8, -hz - 0.04, Math.PI), 1.2, 1.4, 1);
  // Wear: fallen marble panels and rubble at both feet.
  rubble(c, F, -hx + 1, -1.5, FZ + 0.12, 0.08, 5, WH, 3);
  for (let i = 0; i < 3; i++) c.b.geo(atlas(c), regionGeo(R.marble), F(c.rng.range(2, hx - 1), 0.05, FZ + c.rng.range(0.8, 1.6), c.rng.range(0, 3), -Math.PI / 2).multiply(new Matrix4().makeScale(1.0, 0.8, 1)));
  rubble(c, F, -hx + 1, hx - 1, -hz + 0.4, 0.3, 6, BK);
  c.b.shadowBox(F(0, H / 2, FZ - 2.6), hx * 2, H, 5.2);
  c.b.shadowBox(F(0, 4, -hz + 1.4), hx * 2 - 1.4, 8, 2.8);
}

// ---------------------------------------------------------------- Café des Westens (house of 1890s)

/**
 * The house of the Café des Westens („Café Größenwahn“), Kurfürstendamm 18/19, corner Joachimsthaler Straße, from the
 * photo of the entrance (about 1910): a Wilhelminian stucco corner house. Cues: the wrought-iron front garden with its
 * ornate CAFÉ gate arch and the pitched glass canopy on iron posts*, the round-arched door between columns with a globe
 * lamp*, the oval CAFÉ DES WESTENS sign*, the box sign at the corner*, BILLARDSÄLE and SPIELSÄLE over the first floor,
 * the menu board*; above: bay windows and balconies, the corner bay with its dome (reveal). Worn: the café closed in
 * 1915, its signs faded and hanging; boarded windows, a fallen balcony, rubble.
 */
function cafewestens(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), ST: RGB = [1.25, 1.7, 2.45], SD: RGB = [0.98, 1.32, 1.9], hx = l.hx, hz = l.hz, FZ = hz - 2.4, H = 15, rim = { mat: M.stucco, color: [1.4, 1.9, 2.7] as RGB };
  const cz = (FZ - hz) / 2;
  bx(c, M.stucco, F, 0, 0, cz, hx * 2, 4.6, FZ + hz, SD);
  bx(c, M.stucco, F, 0, 4.6, cz, hx * 2 - 0.2, H - 4.6, FZ + hz - 0.2, ST);
  for (let y = 0.8; y < 4.4; y += 0.55) bx(c, M.stucco, F, -0.5, y, FZ + 0.01, hx * 2 - 1, 0.05, 0.04, [0.7, 0.85, 1.1]);
  bx(c, M.stucco, F, 0, 4.4, FZ + 0.12, hx * 2 + 0.1, 0.45, 0.35, ST);
  bx(c, M.stucco, F, 0, H - 0.4, cz, hx * 2 + 0.4, 0.6, FZ + hz + 0.4, ST);
  c.b.geo(M.slate, frustum(hx * 2, FZ + hz, 3.2, hx * 2 - 4.5, Math.max(0.5, FZ + hz - 4.5)), F(0, H + 0.2, cz), C.slate);
  // Upper floors: windows with stucco hoods, two bay windows (Erker) with balconies on top; one balcony fallen.
  for (const y of [6.3, 9.2, 12.1]) row(c, F, -hx, hx - 2.6, FZ, y, 4, 1.1, 1.9, false, 0.25, rim);
  for (const ex of [-3.2, 1.0]) {
    bx(c, M.stucco, F, ex, 4.85, FZ + 0.6, 2.2, 7.4, 1.2, ST);
    for (const y of [6.3, 9.2]) win(c, F(ex, y, FZ + 1.21), 1.3, 1.9, 0.3, 0);
    if (ex < 0) { bx(c, M.stucco, F, ex, 12.25, FZ + 0.7, 2.6, 0.2, 1.5, SD); for (let x = ex - 1.1; x <= ex + 1.1; x += 0.3) cy(c, M.iron, F(x, 12.7, FZ + 1.35), 0.025, 0.025, 0.8, 4, C.iron); }
  }
  // The corner bay on the Joachimsthaler Straße corner with its dome and lantern.
  const kx = hx - 1.2, kz = FZ - 0.2;
  cy(c, M.stucco, F(kx, (H + 4.6) / 2 + 0.6, kz), 1.5, 1.5, H - 3.4, 10, ST);
  for (const y of [6.3, 9.2, 12.1]) for (const a of [0.2, 1.0]) win(c, F(kx + Math.sin(a) * 1.51, y, kz + Math.cos(a) * 1.51, a), 0.8, 1.7, 0.25);
  cy(c, M.stucco, F(kx, H + 0.6, kz), 1.6, 1.6, 0.6, 10, SD);
  c.b.geo(M.enamel, cached('kd-cw-dome', () => new SphereGeometry(1.55, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)), F(kx, H + 0.9, kz).multiply(new Matrix4().makeScale(1, 1.5, 1)), C.copper);
  cy(c, M.enamel, F(kx, H + 3.5, kz), 0.25, 0.3, 0.7, 6, C.copper);
  cy(c, M.enamel, F(kx, H + 4.3, kz), 0.02, 0.2, 0.9, 6, C.copper);
  // Ground floor: café windows, the arched door between columns with the globe lamp, menu board.
  for (const x of [-hx + 1.2, -hx + 3.0]) { bx(c, M.dark, F, x, 0.6, FZ + 0.01, 1.5, 2.8, 0.04); plate(c, R.cafeLit, F(x, 2.0, FZ + 0.04), 1.4, 2.6); }
  const dx = 1.6;
  bx(c, M.darkWood, F, dx, 0, FZ + 0.01, 1.4, 2.9, 0.06, [0.34, 0.24, 0.2]);
  archHead(c.b, M.darkWood, F(dx, 2.9, FZ + 0.01), 1.4, false, 0.03, [0.34, 0.24, 0.2]);
  archHead(c.b, M.stucco, F(dx, 2.9, FZ + 0.02), 2.0, false, 0, SD);
  for (const s of [-1, 1]) cy(c, M.stucco, F(dx + s * 0.95, 1.8, FZ + 0.25), 0.18, 0.2, 3.6, 8, ST);
  c.b.geo(M.lampGlass, cached('kd-globe2', () => new SphereGeometry(0.22, 8, 5)), F(dx, 3.75, FZ + 0.7));
  c.b.box(M.iron, F(dx, 3.95, FZ + 0.4), 0.05, 0.05, 0.7, C.iron);
  bx(c, M.darkWood, F, dx + 1.6, 0.6, FZ + 0.06, 0.9, 1.7, 0.06, [0.3, 0.24, 0.2]);
  plate(c, R.cafe, F(dx + 1.6, 1.45, FZ + 0.1, 0, 0, Math.PI / 2), 1.5, 0.3);
  // Signs: the oval sign over the canopy, the box sign at the corner (hanging askew), the hall signs.
  plate(c, R.westens, F(-1.6, 4.15, FZ + 1.1, 0, -0.15), 3.6, 0.95);
  bx(c, M.iron, F, -1.6, 4.6, FZ + 0.6, 3.0, 0.06, 1.0, C.iron);
  const bs = F(hx - 0.2, 5.4, FZ + 0.9, 0, 0, 0.08);
  c.b.box(M.darkWood, bs, 0.15, 1.25, 1.25, [0.25, 0.2, 0.18]);
  for (const s of [-1, 1]) plate(c, R.vcafe, sub(bs, s * 0.08, 0, 0, (s * Math.PI) / 2), 1.15, 1.15);
  c.b.box(M.iron, F(hx - 0.55, 6.35, FZ + 0.9), 0.8, 0.06, 0.06, C.iron);
  plate(c, R.billard, F(-3.2, 5.35, FZ + 1.23), 2.1, 0.42);
  plate(c, R.spiel, F(1.0, 5.35, FZ + 1.23), 2.0, 0.42);
  // The front garden: wrought-iron fence on a low wall, the gate arch with CAFÉ, the pitched glass canopy on posts.
  const gz = hz - 0.25, gx0 = -hx + 0.3, gx1 = dx - 0.9;
  bx(c, M.stucco, F, (gx0 + gx1) / 2, 0, gz, gx1 - gx0, 0.45, 0.3, SD);
  for (let x = gx0 + 0.1; x < gx1; x += 0.14) if (Math.abs(x + 1.6) > 0.7) c.b.box(M.iron, F(x, 1.25, gz), 0.03, 1.6, 0.03, C.iron);
  for (const y of [0.6, 1.95]) bx(c, M.iron, F, (gx0 + gx1) / 2, y, gz, gx1 - gx0, 0.05, 0.05, C.iron);
  for (const x of [gx0, gx1]) bx(c, M.stucco, F, x, 0, gz, 0.4, 2.2, 0.4, SD);
  for (const s of [-1, 1]) bx(c, M.iron, F, -1.6 + s * 0.7, 0, gz, 0.12, 2.6, 0.12, C.iron);
  archRib(c, M.iron, F(-1.6, 2.4, gz), 0.7, 0.08, 0.08, C.iron, 6);
  plate(c, R.cafe, F(-1.6, 2.65, gz + 0.06), 1.1, 0.24);
  for (const x of [gx0 + 0.2, gx1 - 0.2, -1.6]) cy(c, M.iron, F(x, 1.5, gz - 0.2), 0.05, 0.05, 3.0, 5, C.iron);
  const cm = F((gx0 + gx1) / 2, 3.0, (FZ + gz) / 2 - 0.1);
  // The canopy: iron rafters and ridge, its glass all gone.
  const cd = gz - FZ + 0.2, ang = Math.atan2(0.9, cd / 2), sl = Math.hypot(0.9, cd / 2);
  c.b.box(M.iron, sub(cm, 0, 0.9, 0), gx1 - gx0, 0.08, 0.08, C.iron);
  for (const e of [-1, 1]) c.b.box(M.iron, sub(cm, 0, 0.02, (e * cd) / 2), gx1 - gx0, 0.08, 0.08, C.iron);
  for (let x = gx0; x <= gx1 + 0.01; x += (gx1 - gx0) / 6) for (const e of [-1, 1]) c.b.box(M.iron, sub(cm, x - (gx0 + gx1) / 2, 0.45, (e * cd) / 4, 0, e * ang), 0.05, 0.05, sl, C.iron);
  // Café tables in the garden, toppled chairs; rubble and the fallen balcony at the corner.
  for (const x of [-4.4, -3.0]) { cy(c, M.stucco, F(x, 0.78, (FZ + gz) / 2), 0.32, 0.32, 0.05, 8, [1.4, 1.6, 1.9]); cy(c, M.iron, F(x, 0.4, (FZ + gz) / 2), 0.03, 0.03, 0.76, 4, C.iron); }
  bx(c, M.darkWood, F, -2.4, 0, (FZ + gz) / 2 + 0.4, 0.45, 0.45, 0.45, [0.4, 0.28, 0.22], 0.6, 0, 1.4);
  bx(c, M.stucco, F, 4.2, 0, FZ + 1.2, 2.4, 0.3, 1.1, SD, 0.3);
  rubble(c, F, 3.2, hx - 0.4, FZ + 1.1, 0.6, 8, ST, 3);
  // 2026-11-19: cabaret bills by the door and the corner, timber props under the left bay window (its balcony fell).
  bills(c, F(0, 0, FZ + 0.01), [['kabarett', -1.0, 1.7, 1.2], ['variete', 4.4, 1.7, 1.2, 0.03], ['revue', 5.1, 1.65, 1.15, -0.03]]);
  scraps(c, F(0, 0, FZ + 0.01), [['kabarett', -0.3, 1.25, 0.4, 0.55, [0.1, 0.45, 1, 1]], ['boxen', -0.35, 2.35, 0.4, 0.3, [0, 0, 1, 0.3]]]);
  for (const dx of [-0.95, -0.35]) c.b.box(M.darkWood, F(-3.2 + dx, 2.4, FZ + 0.8, 0, 0.18), 0.16, 4.9, 0.16, TIMBER_POST);
  creeper(c, F, -hx + 0.2, -hx + 1.4, 1.5, 6, FZ + 0.3, 7);
  c.b.shadowBox(F(0, H / 2, cz), hx * 2, H, FZ + hz);
}

// ---------------------------------------------------------------- Schiller-Theater (1907)

/**
 * Schiller-Theater (Heilmann & Littmann, 1907), corner Grolmannstraße / Bismarckstraße, from the postcard of about
 * 1910: a plain reform-classical front in pale plaster. Cues: the doors with lanterns and the name band over them*,
 * the upper loggia of six columns behind a balustrade (5 to 9 m), round oculi on either side, the hipped slate roof
 * with an eyebrow dormer, the taller hall block and the gabled stage house behind (reveal). Worn: a column broken off,
 * boarded doors, rubble.
 */
function schillertheater(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), PL: RGB = [1.3, 1.85, 2.75], PD: RGB = [1.02, 1.45, 2.15], hx = l.hx, hz = l.hz, FZ = hz - 0.6, H = 11, rim = { mat: M.stucco, color: PD };
  // Front block with the loggia recessed into its upper middle.
  bx(c, M.stucco, F, 0, 0, FZ - 2.4, hx * 2, 4.4, 4.8, PL);
  for (const s of [-1, 1]) bx(c, M.stucco, F, s * (hx + 3.9) / 2, 4.4, FZ - 2.4, hx - 3.9, H - 4.4, 4.8, PL);
  bx(c, M.stucco, F, 0, 4.4, FZ - 2.7, 7.8, H - 4.4, 4.2, PL);
  bx(c, M.stucco, F, 0, 8.6, FZ - 0.3, 7.8, H - 8.6, 0.6, PL);
  bx(c, M.stucco, F, 0, 0, FZ + 0.02, hx * 2, 0.7, 0.1, PD);
  bx(c, M.stucco, F, 0, H - 0.4, FZ - 2.4, hx * 2 + 0.4, 0.5, 5.2, PD);
  c.b.geo(M.slate, frustum(hx * 2, 5.0, 3.0, hx * 2 - 5, 0.4), F(0, H + 0.1, FZ - 2.4), C.slate);
  c.b.geo(M.slate, cached('kd-eyebrow', () => new CylinderGeometry(0.8, 0.8, 0.6, 8, 1, false, -Math.PI / 2, Math.PI)), F(0, H + 1.2, FZ - 1.2).multiply(new Matrix4().makeRotationX(Math.PI / 2)), C.slate);
  c.b.geo(M.dark, cached('kd-eyeglass', () => new CircleGeometry(0.55, 8, 0, Math.PI)), F(0, H + 1.0, FZ - 0.9));
  // Ground floor: three doors (lit, one boarded) under the name band, windows, lanterns.
  for (const x of [-1.8, 0, 1.8]) { bx(c, M.dark, F, x, 0.6, FZ + 0.01, 1.3, 2.5, 0.04); if (x === 1.8) c.b.wearWindow(F(x, 1.85, FZ + 0.02), 1.3, 2.5, true); else plate(c, R.foyer, F(x, 1.85, FZ + 0.05), 1.2, 2.4); }
  plate(c, R.schiller, F(0, 3.75, FZ + 0.06), 6.4, 0.6);
  row(c, F, -hx, -3.2, FZ, 2.2, 2, 1.1, 1.8, false, 0.2, rim);
  row(c, F, 3.2, hx, FZ, 2.2, 2, 1.1, 1.8, false, 0.2, rim);
  for (const x of [-3.0, 3.0]) { c.b.box(M.iron, F(x, 3.0, FZ + 0.35), 0.05, 0.05, 0.6, C.iron); c.b.geo(M.lampGlass, cached('kd-lantern', () => new CylinderGeometry(0.16, 0.12, 0.42, 6)), F(x, 2.75, FZ + 0.62)); }
  // Upper floor: the loggia of six columns behind a balustrade, oculi on either side.
  bx(c, M.dark, F, 0, 4.6, FZ - 0.6, 7.2, 4.0, 0.04);
  row(c, F, -3.4, 3.4, FZ - 0.58, 6.6, 5, 1.0, 2.4, false, 0.4);
  bx(c, M.stucco, F, 0, 4.4, FZ - 0.25, 7.8, 0.25, 0.8, PD);
  for (let i = 0; i < 6; i++) { const x = -3.4 + i * 1.36, br = i === 4; cy(c, M.stucco, F(x, 4.65 + (br ? 1.2 : 2.0), FZ - 0.05), 0.2, 0.24, br ? 2.4 : 4.0, 8, PL); }
  bx(c, M.stucco, F, 0, 8.65, FZ - 0.25, 7.8, 0.6, 0.8, PD);
  for (let x = -3.6; x <= 3.6; x += 0.3) cy(c, M.stucco, F(x, 5.0, FZ + 0.08), 0.05, 0.07, 0.7, 5, PL);
  bx(c, M.stucco, F, 0, 5.35, FZ + 0.08, 7.6, 0.12, 0.2, PD);
  for (const s of [-1, 1]) {
    c.b.geo(M.dark, cached('kd-oculus', () => new CircleGeometry(0.55, 10)), F(s * 5.2, 7.2, FZ + 0.02));
    c.b.geo(M.stucco, cached('kd-ocring', () => new TorusGeometry(0.6, 0.1, 4, 12)), F(s * 5.2, 7.2, FZ + 0.03), PD);
    row(c, F, s * 5.2 - 0.9, s * 5.2 + 0.9, FZ, 5.6, 1, 0.9, 1.4, false, 0.2);
  }
  // Hall block and the stage house with its gable to the front.
  bx(c, M.stucco, F, 0, 0, -1.2, hx * 2 - 1.4, 14.5, 3.6, PD);
  c.b.geo(M.slate, frustum(hx * 2 - 1.2, 4.0, 2.6, hx * 2 - 6, 0.3), F(0, 14.5, -1.2), C.slate);
  bx(c, M.stucco, F, 0, 0, -hz + 1.6, 10.5, 17, 3.2, PL);
  pediment(c, M.stucco, F(0, 17, -hz + 1.6), 10.5, 2.8, 3.2, PL);
  c.b.geo(M.slate, frustum(11.0, 3.5, 2.95, 0.02, 3.5, ENDS), F(0, 17.02, -hz + 1.6), C.slate);
  row(c, F, -4.5, 4.5, -hz + 3.21, 15, 4, 0.8, 1.2, false, 0.1);
  // Wear: the broken column's drum and rubble; ivy.
  cy(c, M.stucco, F(2.4, 0.25, FZ + 0.4).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), 0.22, 0.22, 1.4, 8, PL);
  rubble(c, F, 1.2, 4, hz - 0.3, 0.3, 6, PL, 2);
  // 2026-11-19: bills between the doors and the windows, a tarp hung where the loggia column broke.
  bills(c, F(0, 0, FZ + 0.01), [['boxen', -2.75, 1.6, 1.15], ['sechstage', -3.45, 1.62, 1.15, 0.03], ['variete', 2.75, 1.6, 1.15, -0.03], ['kino', 3.45, 1.62, 1.15], ['revue', -7.65, 1.6, 1.0], ['zoo', 7.65, 1.62, 1.0]]);
  scraps(c, F(0, 0, FZ + 0.01), [['kabarett', -7.7, 2.45, 0.4, 0.35, [0, 0, 1, 0.35]], ['weissewoche', 7.7, 0.95, 0.4, 0.4, [0, 0.6, 1, 1]]]);
  tarp(c, F(4.08, 8.6, FZ + 0.1), 1.25, 2.7);
  creeper(c, F, hx - 1.6, hx - 0.2, 1, 8, FZ + 0.1, 8);
  c.b.shadowBox(F(0, H / 2, FZ - 2.4), hx * 2, H, 4.8);
  c.b.shadowBox(F(0, 8, -hz + 2.4), hx * 2 - 1.4, 17, 4.8);
}

// ---------------------------------------------------------------- Charlottenburger Tor (1908)

/**
 * Charlottenburger Tor (Bernhard Schaede, 1907–1909), from the postcard of about 1910, the 1945 photo and later ones: two
 * open sandstone colonnade halves either side of the Chaussee, each on a high plinth, closed toward the road by a pylon
 * with the bronze statue (Friedrich I and Sophie Charlotte) on a pedestal before it, crowned by an aedicula with an
 * urn finial; a tall candelabrum on each plinth. Cues: plinth, columns and the bronze figures (to 6 m)*, the lanterns*;
 * the crowns (reveal). Worn: shell holes, a fallen column drum, rubble against the plinth.
 */
function chtor(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), SS: RGB = [1.3, 1.75, 2.4], SD: RGB = [1.02, 1.38, 1.9], BR: RGB = [0.34, 0.5, 0.42];
  OPEN_PARTS_CHTOR.forEach((p, k) => {
    const s = Math.sign(p.x), inner = p.x - s * p.hx, W = p.hx * 2, Dz = p.hz * 2;
    // Plinth with a cornice.
    bx(c, M.stucco, F, p.x, 0, p.z, W, 1.6, Dz, SD);
    bx(c, M.stucco, F, p.x, 1.6, p.z, W + 0.1, 0.25, Dz + 0.1, SS);
    // The pylon on the road side (inner) and the open colonnade on the outer side.
    const px = inner + s * 1.75;
    bx(c, M.stucco, F, px, 1.85, p.z, 1.4, 7.6, Dz - 0.4, SS);
    bx(c, M.dark, F, px - s * 0.71, 3.2, p.z, 0.04, 3.6, 1.4);
    archHead(c.b, M.dark, F(px - s * 0.72, 6.8, p.z, -s * Math.PI / 2), 1.4, false, 0.0);
    const cols = [-p.hz + 0.45, 0, p.hz - 0.45];
    for (const x of [inner + s * 3.2, inner + s * (W - 0.45)]) for (const z of cols) {
      const fallen = k === 1 && z > 0 && x === inner + s * (W - 0.45);
      cy(c, M.stucco, F(p.x + (x - p.x), 1.85 + (fallen ? 1.6 : 3.4), p.z + z), 0.3, 0.34, fallen ? 3.2 : 6.8, 10, SS);
      if (!fallen) bx(c, M.stucco, F, x, 8.6, p.z + z, 0.8, 0.45, 0.8, SD);
    }
    // Entablature, attic, the crown over the pylon.
    const ex0 = inner + s * 1.05, ex1 = inner + s * W, em = (ex0 + ex1) / 2, ew = Math.abs(ex1 - ex0);
    bx(c, M.stucco, F, em, 9.05, p.z, ew, 0.9, Dz, SS);
    bx(c, M.stucco, F, em, 9.95, p.z, ew + 0.2, 0.3, Dz + 0.2, SD);
    bx(c, M.stucco, F, px, 10.25, p.z, 1.4, 1.8, Dz - 1.2, SS);
    pediment(c, M.stucco, F(px, 12.05, p.z, Math.PI / 2), Dz - 1.2, 0.9, 1.4, SS);
    cy(c, M.stucco, F(px, 13.3, p.z), 0.35, 0.5, 0.6, 8, SD);
    c.b.geo(M.enamel, cached('kd-urn', () => new SphereGeometry(0.45, 8, 5)), F(px, 13.9, p.z).multiply(new Matrix4().makeScale(1, 1.3, 1)), BR);
    cy(c, M.enamel, F(px, 14.7, p.z), 0.02, 0.18, 0.8, 6, BR);
    // The bronze statue on its pedestal before the pylon, facing the road.
    const sx = inner + s * 0.55, rot = -s * Math.PI / 2;
    bx(c, M.stucco, F, sx, 1.85, p.z, 0.9, 1.2, 1.4, SD);
    const f = F(sx, 3.05, p.z, rot);
    cy(c, M.enamel, sub(f, 0, 0.75, 0), 0.24, 0.42, 1.5, 8, BR);
    cy(c, M.enamel, sub(f, 0, 1.85, 0), 0.26, 0.22, 0.7, 8, BR);
    c.b.geo(M.enamel, cached('kd-head', () => new SphereGeometry(1, 7, 5)), sub(f, 0, 2.4, 0).multiply(new Matrix4().makeScale(0.17, 0.2, 0.17)), BR);
    c.b.box(M.enamel, sub(f, 0, 1.6, -0.2, 0, -0.1), 0.95, 1.8, 0.12, BR);
    c.b.box(M.enamel, sub(f, 0.35, 2.0, 0.25, 0, -0.9), 0.1, 0.65, 0.1, BR);
    // Candelabrum on the plinth corner toward the camera.
    const cx = p.x + s * (p.hx - 0.4), czz = p.z + p.hz - 0.4;
    cy(c, M.enamel, F(cx, 4.0, czz), 0.1, 0.16, 4.4, 8, BR);
    c.b.box(M.enamel, F(cx, 6.1, czz), 0.9, 0.08, 0.08, BR);
    for (const d of [-0.42, 0.42]) c.b.geo(M.lampGlass, cached('kd-globe', () => new SphereGeometry(0.15, 6, 4)), F(cx + d, 6.0, czz));
    // Wear: shell holes in the pylon, rubble at the plinth.
    for (let i = 0; i < 4; i++) c.b.box(M.dark, F(px - s * 0.71, c.rng.range(7.2, 9), p.z + c.rng.range(-p.hz + 0.6, p.hz - 0.6)), 0.05, 0.25, 0.25);
    rubble(c, F, p.x - p.hx + 0.3, p.x + p.hx - 0.3, p.z - p.hz + 0.3, 0.2, 4, SS);
  });
  // 2026-11-19: race and boxing bills pasted low on the plinths (the faces toward the Chaussee's south side).
  for (const [k, p] of OPEN_PARTS_CHTOR.entries()) {
    const pm = F(p.x, 0, p.z - p.hz - 0.01, Math.PI);
    bills(c, pm, k ? [['sechstage', -0.8, 0.82, 1.0], ['boxen', 0.0, 0.8, 0.95, 0.04]] : [['zoo', 0.6, 0.82, 1.0], ['sechstage', 1.3, 0.8, 0.95, -0.03]]);
    scraps(c, pm, [['kino', k ? 1.1 : -0.9, 0.75, 0.45, 0.6, [0, 0.4, 0.9, 1]]]);
  }
  c.b.shadowBox(F(-13, 5, 0), 5, 10, 6);
  c.b.shadowBox(F(13, 5, 0), 5, 10, 6);
}

// ---------------------------------------------------------------- Rathaus Charlottenburg (1905)

/**
 * Rathaus Charlottenburg (Reinhardt & Süßenguth, 1899–1905), from the postcard of about 1910 and a 2015 photo of the
 * same front: yellow-brown sandstone, a backdrop on the Otto-Suhr-Allee. Cues: the arched ground floor with the portal
 * and steps*, lamp posts*, the long front with steep red tiles, the gabled wing with the round-arched portal and its
 * bay window; the tall tower (88 m, about 0.45 here) with clock faces, corner turrets, the arcaded belfry and the stepped
 * lantern spire (reveal). Worn: soot, boarded windows, a broken gable, rubble.
 */
function chrathaus(c: Ctx): void {
  const { M, l } = c, F = frameOf(l), SS: RGB = [1.15, 1.25, 1.2], SD: RGB = [0.9, 0.98, 0.95], TILE: RGB = [1.15, 0.82, 0.7], hx = l.hx, hz = l.hz, FZ = hz - 1.2, H = 13, rim = { mat: M.stucco, color: SD };
  const cz = (FZ - hz) / 2, D = FZ + hz;
  bx(c, M.stucco, F, 0, 0, cz, hx * 2, 4.4, D, SD);
  bx(c, M.stucco, F, 0, 4.4, cz, hx * 2 - 0.2, H - 4.4, D - 0.2, SS);
  bx(c, M.stucco, F, 0, H - 0.3, cz, hx * 2 + 0.3, 0.5, D + 0.3, SD);
  c.b.geo(M.roof, frustum(hx * 2, D, 6.5, hx * 2, 0.3), F(0, H + 0.2, cz), TILE);
  for (const x of [-1, 2.4, 5.6]) { bx(c, M.stucco, F, x, H + 0.2, FZ - 1.3, 1.2, 1.6, 1.2, SS); c.b.geo(M.roof, frustum(1.4, 1.3, 1.0, 1.4, 0.05), F(x, H + 1.8, FZ - 1.3), TILE); win(c, F(x, H + 1.0, FZ - 0.69), 0.7, 0.9, 0.2); }
  // Ground floor arcade and the upper rows.
  row(c, F, -hx + 4.6, hx - 4.6, FZ, 2.4, 3, 1.2, 2.2, true, 0.3, rim);
  for (const y of [6.2, 9.2, 11.6]) row(c, F, -hx + 4.6, hx - 4.6, FZ, y, 3, 1.1, y > 11 ? 1.3 : 2.0, y < 7, 0.3, rim);
  // The gabled wing (right): round-arched portal with steps, the bay window, the tall stepped gable (its top broken).
  const wx = hx - 2.3;
  bx(c, M.stucco, F, wx, 0, FZ + 0.3, 4.6, H, 0.6, SS);
  bx(c, M.dark, F, wx, 0.3, FZ + 0.61, 1.8, 2.4, 0.04);
  archHead(c.b, M.dark, F(wx, 2.7, FZ + 0.61), 1.8, false, 0.0);
  archHead(c.b, M.stucco, F(wx, 2.7, FZ + 0.62), 2.6, false, 0, SD);
  plate(c, R.foyer, F(wx, 1.5, FZ + 0.64), 1.7, 2.3);
  for (let i = 0; i < 3; i++) bx(c, M.stucco, F, wx, 0, FZ + 0.6 + (0.55 - i * 0.15) / 2, 3.2 - i * 0.4, 0.15 * (i + 1), 0.55 - i * 0.15, SD);
  bx(c, M.stucco, F, wx, 5.0, FZ + 1.0, 3.0, 4.6, 0.8, SS);
  row(c, F, wx - 1.5, wx + 1.5, FZ + 1.4, 6.2, 3, 0.75, 1.6, false, 0.35);
  row(c, F, wx - 1.5, wx + 1.5, FZ + 1.4, 8.6, 3, 0.75, 1.1, false, 0.35);
  bx(c, M.stucco, F, wx, 9.6, FZ + 1.0, 3.3, 0.3, 1.0, SD);
  row(c, F, wx - 2.2, wx + 2.2, FZ + 0.61, 11.3, 3, 0.9, 1.8, false, 0.2);
  const gm = F(wx, H, FZ + 0.3);
  for (let k = 0; k < 4; k++) if (k < 3) c.b.box(M.stucco, sub(gm, 0, 0.6 + k * 1.2, 0), 4.6 - k * 1.3, 1.2, 0.6, SS);
  c.b.box(M.stucco, sub(gm, 0.7, 3.9, 0, 0, 0, 0.3), 0.8, 0.9, 0.6, SS);
  c.b.geo(M.roof, frustum(4.6, D * 0.6, 4.2, 0.4, D * 0.6), F(wx, H, FZ - D * 0.3), TILE);
  // The tower on the left end of the front: shaft, clocks, corner turrets, belfry, stepped spire with lantern.
  const tx = -hx + 2.8, tz = FZ - 2.1, TW = 5.0, TH = 27;
  bx(c, M.stucco, F, tx, 0, tz, TW, TH, TW, SS);
  bx(c, M.stucco, F, tx, 0, tz + TW / 2 + 0.2, 2.8, 3.6, 0.4, SD);
  bx(c, M.dark, F, tx, 0.3, tz + TW / 2 + 0.41, 1.6, 2.6, 0.04);
  archHead(c.b, M.dark, F(tx, 2.9, tz + TW / 2 + 0.41), 1.6, false, 0.0);
  for (const y of [6.5, 10.5, 14.5]) win(c, F(tx, y, tz + TW / 2 + 0.01), 0.7, 2.0, 0.2);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, m = F(tx, 0, tz, a);
    c.b.geo(M.clock, cached('kd-clock', () => new CircleGeometry(1.05, 16)), sub(m, 0, 20.5, TW / 2 + 0.03));
    c.b.geo(M.stucco, cached('kd-clockring', () => new TorusGeometry(1.1, 0.12, 4, 16)), sub(m, 0, 20.5, TW / 2 + 0.04), SD);
    for (const x of [-1.2, 0, 1.2]) { bx(c, M.dark, (x2, y, z, ry, rx, rz) => sub(m, x2, y, z, ry, rx, rz), x, 23.6, TW / 2 + 0.02, 0.7, 2.4, 0.04); archHead(c.b, M.dark, sub(m, x, 26, TW / 2 + 0.02), 0.7, false, 0.0); }
  }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const ex = tx + dx * (TW / 2 - 0.3), ez = tz + dz * (TW / 2 - 0.3);
    cy(c, M.stucco, F(ex, TH + 1.0, ez), 0.45, 0.45, 3.2, 8, SS);
    cy(c, M.enamel, F(ex, TH + 3.6, ez), 0.02, 0.5, 2.0, 8, C.copper);
  }
  bx(c, M.stucco, F, tx, TH, tz, TW + 0.3, 0.5, TW + 0.3, SD);
  cy(c, M.stucco, F(tx, TH + 2.0, tz), 1.7, 1.9, 3.6, 8, SS);
  c.b.geo(M.enamel, frustum(3.6, 3.6, 3.0, 1.4, 1.4), F(tx, TH + 3.8, tz), C.copper);
  cy(c, M.stucco, F(tx, TH + 7.6, tz), 0.65, 0.65, 1.6, 8, SS);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; bx(c, M.dark, F, tx + Math.sin(a) * 0.66, TH + 7.1, tz + Math.cos(a) * 0.66, 0.3, 0.9, 0.3, undefined, a); }
  cy(c, M.enamel, F(tx, TH + 10.6, tz), 0.03, 0.75, 4.4, 8, C.copper);
  // Lamp posts before the portal; wear.
  for (const x of [wx - 2.6, tx + 3.2]) { cy(c, M.iron, F(x, 1.8, hz - 0.5), 0.07, 0.12, 3.6, 6, C.iron); c.b.geo(M.lampGlass, cached('kd-lantern', () => new CylinderGeometry(0.16, 0.12, 0.42, 6)), F(x, 3.8, hz - 0.5)); }
  // 2026-11-19: the blank end wall toward the camera (local +x faces south) is papered with bills and torn scraps.
  const ew = F(hx + 0.01, 0, -0.6, Math.PI / 2);
  bills(c, ew, [['weissewoche', -2.6, 1.7, 1.2], ['boxen', -1.9, 1.65, 1.15, 0.03], ['sechstage', -1.2, 1.7, 1.2], ['kino', 1.0, 1.68, 1.2, -0.03], ['zoo', 1.7, 1.7, 1.15], ['revue', 2.4, 1.65, 1.2, 0.02]]);
  scraps(c, ew, [['variete', -0.4, 1.4, 0.45, 0.65, [0.1, 0.35, 1, 1]], ['kabarett', 0.3, 2.0, 0.4, 0.4, [0, 0, 1, 0.4]], ['boxen', 3.2, 1.2, 0.35, 0.5, [0.2, 0.5, 1, 1]]]);
  rubble(c, F, wx - 2, wx + 2, FZ + 0.75, 0.3, 7, SS, 2);
  rubble(c, F, -hx + 0.6, -hx + 3, FZ + 0.8, 0.4, 4, SS);
  c.b.shadowBox(F(0, H / 2, cz), hx * 2, H, D);
  c.b.shadowBox(F(tx, TH / 2 + 4, tz), TW, TH + 8, TW);
}

/** A statue (figure) in sandstone or bronze on the given spot (local frame of `c.l`). */
function figure(c: Ctx, x: number, y: number, z: number, h: number, tint: RGB, mat: LitMaterial = c.M.stucco): void {
  const F = frameOf(c.l);
  cy(c, mat, F(x, y + h * 0.27, z), h * 0.1, h * 0.17, h * 0.54, 7, tint);
  cy(c, mat, F(x, y + h * 0.68, z), h * 0.11, h * 0.09, h * 0.28, 7, tint);
  c.b.geo(mat, cached('kd-head', () => new SphereGeometry(1, 7, 5)), F(x, y + h * 0.9, z).multiply(new Matrix4().makeScale(h * 0.075, h * 0.09, h * 0.075)), tint);
  bx(c, mat, F, x + h * 0.12, y + h * 0.5, z + 0.05, h * 0.07, h * 0.3, h * 0.07, tint, 0, 0, 0.3);
  bx(c, mat, F, x - h * 0.12, y + h * 0.5, z + 0.05, h * 0.07, h * 0.3, h * 0.07, tint, 0, 0, -0.3);
}

/** Draws `c.l` if it is one of this file's kinds and has a step 4 builder; false otherwise. */
export function buildKudamm(c: Ctx): boolean {
  if (!KUDAMM_KINDS.has(c.l.kind)) return false;
  switch (c.l.kind) {
    case 'revuepalast': revuepalast(c); return true;
    case 'variete': variete(c); return true;
    case 'hochschule': hochschule(c); return true;
    case 'opernhaus': opernhaus(c); return true;
    case 'theaterwestens': theaterwestens(c); return true;
    case 'gloriapalast': gloriapalast(c); return true;
    case 'marmorhaus': marmorhaus(c); return true;
    case 'cafewestens': cafewestens(c); return true;
    case 'schillertheater': schillertheater(c); return true;
    case 'chtor': chtor(c); return true;
    case 'chrathaus': chrathaus(c); return true;
    default: return false;
  }
}
