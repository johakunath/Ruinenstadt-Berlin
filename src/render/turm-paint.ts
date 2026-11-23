// M17 Fernsehturm painted textures (code placeholders after the Stillstand board, `docs/style/fernsehturm.webp`):
// one floor per deck (radial, painted for the ring's planar UV), the enamel core panels, the clock dial. Codex or
// the local pipeline may replace them later (`docs/asset-pipeline.md`, step 5 rows).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { Rng } from '../sim/math';
import type { DeckDef } from '../data/fernsehturm';
import { canvas, flatten, mottle, shade, strokes, type Ctx } from './paint';

const tex = (c: HTMLCanvasElement, repeat = false): Texture => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
};

/** Grime, chips and soot over a painted surface (shared wear rules of the style bible). */
function wear(ctx: Ctx, rng: Rng, S: number, amount = 1): void {
  mottle(ctx, rng, S, S, Math.round(30 * amount), ['#1a1410', '#2a2016', '#3a3024'], [20, 110], 0.18);
  strokes(ctx, rng, S, S, { count: Math.round(700 * amount), colors: ['#120e0a', '#4a4036', '#6a5a48'], len: [4, 26], width: [1, 3], alpha: [0.05, 0.18] });
}

/**
 * Deck floor, painted round its centre: the ring's UV maps the square [−r, r]² to [0, 1]², so (S/2, S/2) is the deck
 * centre and S/2 pixels are the deck radius `r`.
 */
export function paintDeckFloor(d: DeckDef, flat: number): Texture {
  const S = 768, rng = new Rng(d.x + 31), c0 = S / 2;
  const [c, ctx] = canvas(S, S);
  const px = (m: number): number => (m / d.r) * c0;
  ctx.translate(c0, c0);
  switch (d.id) {
    case 'foyer': {
      // Terrazzo, a red and cream star of triangles round the core, dark border bands.
      ctx.fillStyle = '#6e665a';
      ctx.fillRect(-c0, -c0, S, S);
      for (let k = 0; k < 4000; k++) { ctx.fillStyle = rng.pick(['#5a5248', '#8c826e', '#4a443c', '#8a3a26']); ctx.globalAlpha = 0.5; ctx.fillRect(rng.range(-c0, c0), rng.range(-c0, c0), 2, 2); }
      ctx.globalAlpha = 1;
      for (let k = 0; k < 12; k++) {
        const a0 = (k * Math.PI) / 6, a1 = a0 + Math.PI / 6;
        ctx.fillStyle = k % 2 ? '#a89c84' : '#7a2a1c';
        ctx.beginPath(); ctx.moveTo(Math.sin(a0) * px(6), Math.cos(a0) * px(6)); ctx.lineTo(Math.sin((a0 + a1) / 2) * px(15), Math.cos((a0 + a1) / 2) * px(15)); ctx.lineTo(Math.sin(a1) * px(6), Math.cos(a1) * px(6)); ctx.fill();
      }
      ctx.strokeStyle = '#3a3630';
      ctx.lineWidth = px(0.5);
      for (const r of [15.5, 19.5]) { ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; const q = r / Math.cos(Math.PI / 6); if (k === 0) ctx.moveTo(Math.sin(a) * px(q), Math.cos(a) * px(q)); else ctx.lineTo(Math.sin(a) * px(q), Math.cos(a) * px(q)); } ctx.stroke(); }
      break;
    }
    case 'schacht': {
      // Steel grating: a square grid of bars over darkness, rust where the vines come up.
      ctx.fillStyle = '#16191a';
      ctx.fillRect(-c0, -c0, S, S);
      ctx.strokeStyle = '#4a5054';
      ctx.lineWidth = 2;
      for (let v = -c0; v <= c0; v += 9) { ctx.beginPath(); ctx.moveTo(v, -c0); ctx.lineTo(v, c0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-c0, v); ctx.lineTo(c0, v); ctx.stroke(); }
      ctx.strokeStyle = '#2a2e30';
      ctx.lineWidth = px(0.3);
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; ctx.beginPath(); ctx.moveTo(Math.sin(a) * px(5.5), Math.cos(a) * px(5.5)); ctx.lineTo(Math.sin(a) * px(15), Math.cos(a) * px(15)); ctx.stroke(); }
      mottle(ctx, rng, S, S, 26, ['#6a3a18', '#2a4a1a'], [20, 80], 0.25);
      break;
    }
    case 'uhrenraum': {
      // Dark stone, a brass dial ring with twelve hour marks round the movement.
      ctx.fillStyle = '#2e2620';
      ctx.fillRect(-c0, -c0, S, S);
      stoneSeams(ctx, px, rng, '#1a140f');
      ctx.strokeStyle = '#9a7030';
      ctx.lineWidth = px(0.25);
      for (const r of [7.2, 9.8]) { ctx.beginPath(); ctx.arc(0, 0, px(r), 0, Math.PI * 2); ctx.stroke(); }
      for (let k = 0; k < 60; k++) {
        const a = (k * Math.PI) / 30, big = k % 5 === 0;
        ctx.lineWidth = px(big ? 0.4 : 0.12);
        ctx.beginPath(); ctx.moveTo(Math.sin(a) * px(big ? 7.6 : 8.6), Math.cos(a) * px(big ? 7.6 : 8.6)); ctx.lineTo(Math.sin(a) * px(9.4), Math.cos(a) * px(9.4)); ctx.stroke();
      }
      break;
    }
    default: {
      // Sphere decks: polished dark slate with curved seams, warmer in the Telecafé.
      ctx.fillStyle = d.id === 'telecafe' ? '#4a3428' : '#3a3438';
      ctx.fillRect(-c0, -c0, S, S);
      stoneSeams(ctx, px, rng, d.id === 'telecafe' ? '#2a1c14' : '#22202a');
      // Sheen: lamp light pooled on the polish.
      for (let k = 0; k < 8; k++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(8, 14), g = ctx.createRadialGradient(Math.sin(a) * px(r), Math.cos(a) * px(r), 0, Math.sin(a) * px(r), Math.cos(a) * px(r), px(4));
        g.addColorStop(0, 'rgba(255,220,170,0.16)');
        g.addColorStop(1, 'rgba(255,220,170,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-c0, -c0, S, S);
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  wear(ctx, rng, S, d.id === 'schacht' ? 1.4 : 1);
  flatten(ctx, S, S, flat * 0.5);
  return tex(c);
}

/** Concentric and radial seams of stone slabs. */
function stoneSeams(ctx: Ctx, px: (m: number) => number, rng: Rng, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let r = 6.5; r < 20; r += 2.2) { ctx.beginPath(); ctx.arc(0, 0, px(r), 0, Math.PI * 2); ctx.stroke(); }
  for (let ring = 0; ring < 7; ring++) {
    const r0 = 6.5 + ring * 2.2, n = 10 + ring * 3, off = rng.range(0, 1);
    for (let k = 0; k < n; k++) { const a = ((k + off) * 2 * Math.PI) / n; ctx.beginPath(); ctx.moveTo(Math.sin(a) * px(r0), Math.cos(a) * px(r0)); ctx.lineTo(Math.sin(a) * px(r0 + 2.2), Math.cos(a) * px(r0 + 2.2)); ctx.stroke(); }
  }
}

/** The Telecafé's turning band: radial parquet planks (tiles along the ring with its planar UV, painted as a full disc). */
export function paintBand(flat: number): Texture {
  const S = 768, rng = new Rng(207), c0 = S / 2;
  const [c, ctx] = canvas(S, S);
  ctx.translate(c0, c0);
  ctx.fillStyle = '#5a3420';
  ctx.fillRect(-c0, -c0, S, S);
  const n = 96;
  for (let k = 0; k < n; k++) {
    const a0 = (k * 2 * Math.PI) / n, a1 = ((k + 1) * 2 * Math.PI) / n;
    ctx.fillStyle = shade(k % 2 ? '#6a4026' : '#7a4a2c', rng.range(-0.12, 0.08));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, c0, a0, a1); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,10,6,0.6)';
  ctx.lineWidth = 2;
  for (let k = 0; k < n; k += 4) { const a = (k * 2 * Math.PI) / n; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * c0, Math.sin(a) * c0); ctx.stroke(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  wear(ctx, rng, S, 0.8);
  flatten(ctx, S, S, flat * 0.5);
  return tex(c);
}

/** Enamel core panels: tall plates with seams and rivets, chipped to rust (tiles round the drum). */
export function paintEnamel(base: string, flat: number): Texture {
  const S = 512, rng = new Rng(base.length * 97 + 3);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const cols = 4;
  for (let k = 0; k < cols; k++) {
    ctx.fillStyle = shade(base, rng.range(-0.1, 0.06));
    ctx.fillRect(k * (S / cols) + 3, 3, S / cols - 6, S - 6);
    ctx.fillStyle = 'rgba(255,240,210,0.12)';
    ctx.fillRect(k * (S / cols) + 3, 3, S / cols - 6, 4);
    ctx.fillStyle = '#2a1c14';
    for (let y = 12; y < S; y += 40) for (const x of [8, S / cols - 8]) { ctx.beginPath(); ctx.arc(k * (S / cols) + x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // Chips down to rusted steel, more toward the floor.
  for (let k = 0; k < 160; k++) {
    const y = S * Math.sqrt(rng.next()), x = rng.range(0, S), r = rng.range(2, 12);
    ctx.fillStyle = rng.pick(['#5a2a14', '#7a3a1a', '#3a2418']);
    ctx.beginPath(); ctx.ellipse(x, y, r, r * rng.range(0.5, 1), rng.range(0, 3), 0, Math.PI * 2); ctx.fill();
  }
  wear(ctx, rng, S, 1);
  flatten(ctx, S, S, flat * 0.5);
  return tex(c, true);
}

/** A clock dial (cream face, hour marks, two hands at a frozen time); `t` picks the time. */
export function paintDial(): Texture {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath(); ctx.arc(0, 0, S / 2 - 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 6;
  ctx.stroke();
  for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; ctx.lineWidth = k % 3 ? 3 : 7; ctx.beginPath(); ctx.moveTo(Math.sin(a) * 98, -Math.cos(a) * 98); ctx.lineTo(Math.sin(a) * 114, -Math.cos(a) * 114); ctx.stroke(); }
  ctx.lineCap = 'round';
  ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(1.9) * 62, -Math.cos(1.9) * 62); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(5.6) * 92, -Math.cos(5.6) * 92); ctx.stroke();
  mottle(ctx, new Rng(5), S, S, 10, ['#6a5a40'], [10, 40], 0.2);
  return tex(c);
}
