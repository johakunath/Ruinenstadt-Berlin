// M15 Mitte (2089) code-painted fallback textures (`docs/tasks/m15-mitte.md` step 9).
// Sandstone ashlar (Reichstag, Brandenburger Tor), a glass curtain wall
// with mullions and lit floors (Potsdamer Platz towers, Bundestag buildings) and gold aluminium panels
// (Philharmonie, Staatsbibliothek). All are light bases: the vertex tint gives the final colour.
import type { Texture } from 'three';
import { Rng } from '../sim/math';
import { canvas, flatten, mottle, shade, strokes, toTexture, type PaintOptions } from './paint';

/** Sandstone ashlar: 1.0 × 0.5 m courses at the 0.5 uv box scale, soot in the joints, weathered. */
export function paintSandstone(o: PaintOptions): { map: Texture } {
  const S = 512, rng = new Rng(2089), base = '#e2d6bc';
  const [c, g] = canvas(S, S);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  mottle(g, rng, S, S, 60, [shade(base, 0.06), shade(base, -0.08), '#cbbd9e'], [20, 90], 0.25);
  const ch = 64, cw = 128;
  for (let y = 0; y < S; y += ch) {
    const off = (y / ch) % 2 ? cw / 2 : 0;
    for (let x = -off; x < S; x += cw) {
      g.fillStyle = shade(base, rng.range(-0.06, 0.05), 0.5);
      g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    }
    g.fillStyle = 'rgba(70,60,45,0.45)';
    g.fillRect(0, y, S, 3);
    for (let x = -off; x < S; x += cw) g.fillRect(x, y, 3, ch);
  }
  // Soot runs from the cornices.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, S), grd = g.createLinearGradient(x, 0, x, S);
    grd.addColorStop(0, 'rgba(40,34,28,0.3)');
    grd.addColorStop(1, 'rgba(40,34,28,0)');
    g.fillStyle = grd;
    g.fillRect(x, rng.range(0, S / 3), rng.range(3, 10), rng.range(80, 300));
  }
  strokes(g, rng, S, S, { count: 1400, colors: [shade(base, 0.12), shade(base, -0.16)], len: [3, 14], width: [1, 3], alpha: [0.08, 0.2] });
  flatten(g, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/**
 * Glass curtain wall, one tile = 4 bays × 4 floors (6 × 7 m at a 0.5 uv box scale would be too coarse,
 * so builders set uv scale 1/6 per tile). Dark blue-grey glass with sky reflection bands, thin light
 * mullions, a few lit offices (emissive map), most dark (2089: the grid is down, generators run the lobbies).
 */
export function paintCurtain(seed = 7): { map: Texture; emissiveMap: Texture } {
  const S = 512, rng = new Rng(seed), bay = S / 4, fl = S / 4;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, S, S);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = rng.range(-0.08, 0.1), grd = g.createLinearGradient(0, y * fl, 0, (y + 1) * fl);
    grd.addColorStop(0, shade('#5d7487', 0.15 + t));
    grd.addColorStop(0.55, shade('#34475a', t));
    grd.addColorStop(1, shade('#26313d', t));
    g.fillStyle = grd;
    g.fillRect(x * bay, y * fl, bay, fl);
    const lit = rng.next();
    if (lit < 0.16) {
      const warm = rng.next() < 0.5;
      ge.fillStyle = warm ? 'rgba(255,190,120,0.85)' : 'rgba(150,230,255,0.8)';
      ge.fillRect(x * bay + 6, y * fl + fl * 0.3, bay - 12, fl * 0.62);
      g.fillStyle = warm ? 'rgba(255,200,140,0.6)' : 'rgba(170,230,255,0.55)';
      g.fillRect(x * bay + 6, y * fl + fl * 0.3, bay - 12, fl * 0.62);
    } else if (lit < 0.3) {
      // Broken pane: dark hole with a crack star.
      g.fillStyle = 'rgba(12,14,18,0.85)';
      g.fillRect(x * bay + 10, y * fl + 14, bay * rng.range(0.3, 0.7), fl * rng.range(0.3, 0.7));
    }
  }
  // Spandrel bands (floor slabs) and mullions.
  g.fillStyle = '#9aa3a8';
  for (let y = 0; y < 4; y++) g.fillRect(0, y * fl, S, 10);
  g.fillStyle = '#b9c0c3';
  for (let x = 0; x < 4; x++) g.fillRect(x * bay, 0, 5, S);
  return { map: toTexture(c, true, 4), emissiveMap: toTexture(e, true, 4) };
}

/** Gold anodised aluminium panels (Philharmonie, Staatsbibliothek), 2 × 1 m with dark joints. */
export function paintGoldPanels(o: PaintOptions): { map: Texture } {
  const S = 256, rng = new Rng(1963), base = '#e3c070';
  const [c, g] = canvas(S, S);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 64) {
    g.fillStyle = shade(base, rng.range(-0.12, 0.08));
    g.fillRect(x + 1, y + 1, 62, 30);
    // Embossed star-like facet (the Philharmonie's polyester panels): a soft diagonal highlight.
    g.fillStyle = 'rgba(255,240,200,0.18)';
    g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + 40, y + 4); g.lineTo(x + 4, y + 24); g.fill();
  }
  g.fillStyle = 'rgba(60,45,20,0.6)';
  for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 2);
  for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 2, S);
  flatten(g, S, S, o.flatten * 0.5);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Words of the neon sign atlas (2D `js/mitte.js` signs plus a few street words). Horizontal fascia signs. */
export const NEON_WORDS = ['BASS', 'CLUB', '24H', 'KLINIK', 'TECHNO', 'KIOSK', 'SUB', 'NEON', 'RAVE', 'BAR', 'SPÄTI', 'IMBISS', 'HOTEL', 'KABEL', 'DISKO'] as const;
/** Vertical blade signs (letters stacked). */
export const NEON_BLADES = ['BASS', 'CLUB', 'RAVE', 'NEON', 'SUB', '24H', 'BAR', 'HOTEL'] as const;

/**
 * Neon sign atlas, 1024 × 1024, white tubes on black (the vertex colour gives the neon colour, so one
 * material draws every colour). Left half: 2 × 8 horizontal cells of 256 × 128 (`NEON_WORDS`, the last
 * cell is solid white for plain tubes). Right half: 4 × 2 vertical cells of 128 × 512 (`NEON_BLADES`).
 * A few letters are dead or dim, as on a city that runs on generators.
 */
export function paintNeonAtlas(): Texture {
  const S = 1024, rng = new Rng(2089);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#050407';
  g.fillRect(0, 0, S, S);
  const tube = (text: string, x: number, y: number, size: number, dim: boolean): void => {
    g.font = `bold ${size}px Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,255,255,0.9)';
    g.shadowBlur = size * 0.35;
    g.lineWidth = Math.max(5, size * 0.14);
    g.strokeStyle = dim ? 'rgba(255,255,255,0.3)' : '#ffffff';
    g.strokeText(text, x, y);
    g.shadowBlur = 0;
    g.fillStyle = dim ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.92)';
    g.fillText(text, x, y);
  };
  // Each cell glows as a whole (the plate catches its own light), so a sign still reads bright when the
  // game camera shrinks it to a few pixels.
  const plate = (x: number, y: number, w: number, h: number): void => {
    const grd = g.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) * 0.6);
    grd.addColorStop(0, 'rgba(255,255,255,0.32)');
    grd.addColorStop(1, 'rgba(255,255,255,0.1)');
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
  };
  NEON_WORDS.forEach((w, i) => {
    const x = (i % 2) * 256, y = Math.floor(i / 2) * 128;
    g.save(); g.beginPath(); g.rect(x, y, 256, 128); g.clip();
    // Plate glow, frame tube around the word, then the letters.
    plate(x, y, 256, 128);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(x + 10, y + 12, 236, 104);
    const size = Math.min(78, 210 / Math.max(2.2, w.length * 0.62));
    const dead = rng.next() < 0.3 ? rng.int(w.length) : -1;
    if (dead < 0) tube(w, x + 128, y + 66, size, false);
    else for (let k = 0; k < w.length; k++) {
      const cw = (size * 0.66), x0 = x + 128 - (w.length * cw) / 2 + cw * (k + 0.5);
      tube(w[k]!, x0, y + 66, size, k === dead);
    }
    g.restore();
  });
  g.fillStyle = '#ffffff';
  g.fillRect(256 + 8, 7 * 128 + 8, 240, 112);
  NEON_BLADES.forEach((w, i) => {
    const x = 512 + (i % 4) * 128, y = Math.floor(i / 4) * 512;
    g.save(); g.beginPath(); g.rect(x, y, 128, 512); g.clip();
    plate(x, y, 128, 512);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(x + 10, y + 10, 108, 492);
    const step = Math.min(96, 470 / w.length);
    for (let k = 0; k < w.length; k++) tube(w[k]!, x + 64, y + 256 - (step * w.length) / 2 + step * (k + 0.5), Math.min(84, step * 0.9), rng.next() < 0.08);
    g.restore();
  });
  return toTexture(c, false, 4);
}

/** UV rect [u0, v0, u1, v1] of a horizontal word cell, the white tube cell (`-1`) or a blade cell. */
export function neonCell(word: number): [number, number, number, number] {
  const i = word < 0 ? 15 : word, x = (i % 2) * 256, y = Math.floor(i / 2) * 128;
  return [x / 1024, 1 - (y + 128) / 1024, (x + 256) / 1024, 1 - y / 1024];
}
export function bladeCell(i: number): [number, number, number, number] {
  const x = 512 + (i % 4) * 128, y = Math.floor(i / 4) * 512;
  return [x / 1024, 1 - (y + 512) / 1024, (x + 128) / 1024, 1 - y / 1024];
}
