// Painted-look textures, generated on 2D canvases at start (style bible: painterly fills with visible
// texture, wear at stress points, Köpenick palette). No image files: everything here is code.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { Rng } from '../sim/math';

export type Ctx = CanvasRenderingContext2D;

export const PALETTE = {
  cream: '#f0b27a',
  ochre: '#db8c2b',
  olive: '#7b6a32',
  teal: '#516a62',
  rust: '#8b4a35',
  oxblood: '#591e1e',
  bvg: '#e89a1a',
  ink: '#16110f',
  scarf: '#b8261c',
} as const;

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas not available');
  return [c, ctx];
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Shifts a hex color in brightness (-1..1) and returns a CSS color. */
export function shade(hex: string, amount: number, alpha = 1): string {
  const [r, g, b] = rgb(hex);
  const f = (v: number): number => Math.round(Math.max(0, Math.min(255, amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `rgba(${f(r)},${f(g)},${f(b)},${alpha})`;
}

/** Runs `draw` at (x, y) and at the wrapped positions so the texture tiles. */
function wrapped(w: number, h: number, x: number, y: number, r: number, draw: (x: number, y: number) => void): void {
  for (const ox of x < r ? [0, w] : x > w - r ? [0, -w] : [0]) {
    for (const oy of y < r ? [0, h] : y > h - r ? [0, -h] : [0]) draw(x + ox, y + oy);
  }
}

interface StrokeOpts {
  count: number;
  colors: string[];
  len: [number, number];
  width: [number, number];
  alpha: [number, number];
  angle?: number;
  spread?: number;
}

/** Visible brush strokes: the main painterly ingredient. */
export function strokes(ctx: Ctx, rng: Rng, w: number, h: number, o: StrokeOpts): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < o.count; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const len = rng.range(o.len[0], o.len[1]);
    const a = (o.angle ?? 0) + rng.range(-1, 1) * (o.spread ?? Math.PI);
    const dx = (Math.cos(a) * len) / 2;
    const dy = (Math.sin(a) * len) / 2;
    ctx.strokeStyle = rng.pick(o.colors);
    ctx.globalAlpha = rng.range(o.alpha[0], o.alpha[1]);
    ctx.lineWidth = rng.range(o.width[0], o.width[1]);
    wrapped(w, h, x, y, len, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px - dx, py - dy);
      ctx.lineTo(px + dx, py + dy);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
}

/** Soft blotches for large-scale tone variation. */
export function mottle(ctx: Ctx, rng: Rng, w: number, h: number, count: number, colors: string[], radius: [number, number], alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const r = rng.range(radius[0], radius[1]);
    const col = rng.pick(colors);
    wrapped(w, h, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, shade(col, 0, alpha));
      g.addColorStop(1, shade(col, 0, 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
}

/** Random-walk crack with a light edge, as ink line. */
function crack(ctx: Ctx, rng: Rng, x: number, y: number, steps: number, step: number, dir: number, width = 1.6): void {
  const pts: Array<[number, number]> = [[x, y]];
  for (let i = 0; i < steps; i++) {
    dir += rng.range(-0.7, 0.7);
    x += Math.cos(dir) * step * rng.range(0.5, 1.4);
    y += Math.sin(dir) * step * rng.range(0.5, 1.4);
    pts.push([x, y]);
  }
  const path = (ox: number, oy: number): void => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
    ctx.stroke();
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,240,210,0.18)';
  ctx.lineWidth = width;
  path(1.2, 1.2);
  ctx.strokeStyle = 'rgba(18,12,10,0.8)';
  ctx.lineWidth = width;
  path(0, 0);
}

export function toTexture(c: HTMLCanvasElement, repeat = true, anisotropy = 4): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/** Pulls every pixel toward the mean color (calmer surfaces). */
export function flatten(ctx: Ctx, w: number, h: number, amount: number): void {
  if (amount <= 0) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i] as number;
    g += d[i + 1] as number;
    b += d[i + 2] as number;
  }
  const n = d.length / 4;
  r /= n;
  g /= n;
  b /= n;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = (d[i] as number) + (r - (d[i] as number)) * amount;
    d[i + 1] = (d[i + 1] as number) + (g - (d[i + 1] as number)) * amount;
    d[i + 2] = (d[i + 2] as number) + (b - (d[i + 2] as number)) * amount;
  }
  ctx.putImageData(img, 0, 0);
}

/** Tangent-space normal map from a grayscale height canvas (tiles). */
function normalFromHeight(height: Ctx, w: number, h: number, strength: number): CanvasTexture {
  const src = height.getImageData(0, 0, w, h).data;
  const [c, ctx] = canvas(w, h);
  const out = ctx.createImageData(w, h);
  const at = (x: number, y: number): number => src[(((y + h) % h) * w + ((x + w) % w)) * 4] as number;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = ((at(x + 1, y) - at(x - 1, y)) / 255) * strength;
      const dy = ((at(x, y + 1) - at(x, y - 1)) / 255) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = (-dx / len) * 127 + 128;
      out.data[i + 1] = (dy / len) * 127 + 128;
      out.data[i + 2] = (1 / len) * 127 + 128;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export interface Surface {
  map: Texture;
  normalMap?: Texture;
}

export interface PaintOptions {
  /** 0..1 blend toward flat color (look dependent). */
  flatten: number;
  normalMaps: boolean;
  anisotropy: number;
}

// ---------------------------------------------------------------- walls

function drawBricks(ctx: Ctx, rng: Rng, w: number, h: number, bw: number, bh: number, height?: Ctx): void {
  const tones = ['#8b4a35', '#7a3d2c', '#9a5a3c', '#6d3327', '#a0663f', '#5f2c24', '#8a5a48'];
  ctx.fillStyle = '#3d332c';
  ctx.fillRect(0, 0, w, h);
  if (height) {
    height.fillStyle = '#404040';
    height.fillRect(0, 0, w, h);
  }
  const rows = Math.round(h / bh);
  const cols = Math.round(w / bw);
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = (c + (r % 2 ? 0.5 : 0)) * bw + 1.5;
      const y = r * bh + 1.5;
      const missing = rng.next() < 0.03;
      ctx.fillStyle = missing ? '#221a17' : shade(rng.pick(tones), rng.range(-0.22, 0.12));
      for (const ox of x + bw > w ? [0, -w] : [0]) {
        ctx.fillRect(x + ox, y, bw - 3, bh - 3);
        if (!missing) {
          // Light top edge, dark bottom edge: painted relief.
          ctx.fillStyle = 'rgba(255,220,180,0.13)';
          ctx.fillRect(x + ox, y, bw - 3, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x + ox, y + bh - 5, bw - 3, 2);
          ctx.fillStyle = shade(rng.pick(tones), rng.range(-0.22, 0.12));
        }
        if (height) {
          height.fillStyle = missing ? '#202020' : '#c0c0c0';
          height.fillRect(x + ox, y, bw - 3, bh - 3);
        }
      }
    }
  }
}

export function paintBrick(o: PaintOptions, seed = 5): Surface {
  const S = 512;
  const rng = new Rng(seed);
  const [c, ctx] = canvas(S, S);
  const [, hctx] = canvas(S, S);
  drawBricks(ctx, rng, S, S, 64, 21.33, hctx);
  strokes(ctx, rng, S, S, { count: 900, colors: ['#2a1c18', '#b06a45', '#51403a', '#70503a'], len: [8, 30], width: [2, 6], alpha: [0.05, 0.2], spread: 0.5 });
  mottle(ctx, rng, S, S, 14, ['#1a1513', '#33403a'], [40, 120], 0.35);
  flatten(ctx, S, S, o.flatten);
  return { map: toTexture(c, true, o.anisotropy), normalMap: o.normalMaps ? normalFromHeight(hctx, S, S, 2.2) : undefined };
}

const PLASTER: Record<string, { base: string; light: string; dark: string }> = {
  cream: { base: '#cfa77c', light: '#f0c898', dark: '#9c7a58' },
  ochre: { base: '#c58a3c', light: '#e2aa55', dark: '#8f5f2a' },
  oxblood: { base: '#8a4336', light: '#a85a48', dark: '#5c2a24' },
};

/** Altbau plaster: mottled paint, water stains, cracks and patches where the brick shows. */
export function paintPlaster(tone: string, o: PaintOptions, seed = 9): Surface {
  const S = 1024;
  const rng = new Rng(seed);
  const p = PLASTER[tone] ?? (PLASTER.cream as { base: string; light: string; dark: string });
  const [c, ctx] = canvas(S, S);
  const [, hctx] = canvas(S, S);
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = '#b0b0b0';
  hctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 40, [p.light, p.dark, p.dark, '#5f6a5a'], [60, 220], 0.3);
  strokes(ctx, rng, S, S, { count: 2600, colors: [p.light, p.base, p.dark, shade(p.base, -0.3)], len: [18, 70], width: [5, 16], alpha: [0.08, 0.3], angle: Math.PI / 2, spread: 0.9 });
  // Water stains run down.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const len = rng.range(80, 320);
    const wd = rng.range(8, 34);
    wrapped(S, S, x, y + len / 2, len, (px, py) => {
      const g = ctx.createLinearGradient(0, py - len / 2, 0, py + len / 2);
      g.addColorStop(0, 'rgba(40,52,44,0.42)');
      g.addColorStop(1, 'rgba(40,52,44,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - wd / 2, py - len / 2, wd, len);
    });
  }
  // Fallen plaster: brick shows through an irregular hole.
  const [bc, bctx] = canvas(S, S);
  drawBricks(bctx, rng, S, S, 46, 15);
  const brick = ctx.createPattern(bc, 'repeat');
  for (let i = 0; i < 9; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const r = rng.range(28, 95);
    const pts: Array<[number, number]> = [];
    const n = 14;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = r * rng.range(0.55, 1.15);
      pts.push([Math.cos(a) * rr * 1.3, Math.sin(a) * rr]);
    }
    wrapped(S, S, x, y, r * 1.6, (px, py) => {
      const path = (target: Ctx, ox: number, oy: number): void => {
        target.beginPath();
        pts.forEach(([qx, qy], k) => (k ? target.lineTo(px + qx + ox, py + qy + oy) : target.moveTo(px + qx + ox, py + qy + oy)));
        target.closePath();
      };
      // Shadow under the upper plaster edge, then the brick, then an ink rim.
      path(ctx, 0, 0);
      ctx.fillStyle = brick ?? '#7a3d2c';
      ctx.fill();
      ctx.save();
      path(ctx, 0, 0);
      ctx.clip();
      path(ctx, 0, 7);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.restore();
      path(ctx, 0, 0);
      ctx.strokeStyle = shade(p.dark, -0.55, 0.9);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      path(hctx, 0, 0);
      hctx.fillStyle = '#606060';
      hctx.fill();
    });
  }
  for (let i = 0; i < 16; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.int(9) + 5, 26, rng.range(0, Math.PI * 2));
  strokes(ctx, rng, S, S, { count: 500, colors: ['#1c1a16', '#f5e2c0'], len: [2, 6], width: [1, 3], alpha: [0.1, 0.3] });
  flatten(ctx, S, S, o.flatten);
  return { map: toTexture(c, true, o.anisotropy), normalMap: o.normalMaps ? normalFromHeight(hctx, S, S, 1.4) : undefined };
}

/** Light sandstone/stucco for frames, sills and cornices. */
export function paintStucco(o: PaintOptions): Surface {
  const S = 256;
  const rng = new Rng(21);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#b9a88c';
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 12, ['#d8c8a8', '#8a7c66', '#5f6a5a'], [30, 90], 0.35);
  strokes(ctx, rng, S, S, { count: 500, colors: ['#d9caa9', '#8d7d64', '#6f6552'], len: [10, 40], width: [3, 9], alpha: [0.1, 0.3], angle: 0, spread: 0.6 });
  for (let i = 0; i < 4; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), 5, 18, rng.range(0, 6), 1.2);
  flatten(ctx, S, S, o.flatten);
  return { map: toTexture(c, true, o.anisotropy) };
}

// ---------------------------------------------------------------- ground

/** Cracked cobblestones with moss in the joints. One tile covers 5 m. */
export function paintCobbles(o: PaintOptions): Surface {
  const S = 1024;
  const rng = new Rng(3);
  const [c, ctx] = canvas(S, S);
  const [, hctx] = canvas(S, S);
  ctx.fillStyle = '#27221f';
  ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = '#181818';
  hctx.fillRect(0, 0, S, S);
  // Moss and dirt in the joints.
  mottle(ctx, rng, S, S, 60, ['#4d5326', '#5d5a2a', '#3a3320', '#2f3a2c'], [30, 110], 0.75);
  const tones = ['#6f646c', '#7b6c64', '#5f6a68', '#84766a', '#665a62', '#75675a', '#8a7a70', '#59545c'];
  const rows = 44;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rng.range(0, 20);
    const y = r * rh;
    while (x < S) {
      const sw = rng.range(17, 30);
      const gap = rng.range(2.5, 4.5);
      const missing = rng.next() < 0.018;
      if (!missing) {
        const col = shade(rng.pick(tones), rng.range(-0.25, 0.15));
        const jx = rng.range(-0.8, 0.8);
        const jy = rng.range(-0.8, 0.8);
        for (const ox of x + sw > S ? [0, -S] : x < 0 ? [0, S] : [0]) {
          const px = x + ox + jx;
          const py = y + jy + gap / 2;
          const ph = rh - gap;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.roundRect(px, py, sw, ph, 4.5);
          ctx.fill();
          // Painted relief: warm top-left light, dark bottom-right.
          ctx.fillStyle = 'rgba(255,225,190,0.16)';
          ctx.beginPath();
          ctx.roundRect(px + 1, py + 1, sw - 5, ph * 0.38, 3);
          ctx.fill();
          ctx.fillStyle = 'rgba(10,8,12,0.28)';
          ctx.beginPath();
          ctx.roundRect(px + 3, py + ph * 0.68, sw - 3, ph * 0.32, 3);
          ctx.fill();
          const g = hctx.createRadialGradient(px + sw / 2, py + ph / 2, 1, px + sw / 2, py + ph / 2, Math.max(sw, ph) * 0.62);
          g.addColorStop(0, '#f0f0f0');
          g.addColorStop(1, '#808080');
          hctx.fillStyle = g;
          hctx.beginPath();
          hctx.roundRect(px, py, sw, ph, 4.5);
          hctx.fill();
        }
      }
      x += sw + gap;
    }
  }
  strokes(ctx, rng, S, S, { count: 2200, colors: ['#9a8a7c', '#3a3336', '#6a5a4c', '#4a5650'], len: [6, 22], width: [2, 6], alpha: [0.06, 0.2] });
  // Dirt, soot and moss creeping over stones.
  mottle(ctx, rng, S, S, 26, ['#1c1814', '#4d5326', '#3d3020'], [40, 150], 0.4);
  for (let i = 0; i < 12; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.int(10) + 6, 30, rng.range(0, Math.PI * 2), 2.2);
  for (let i = 0; i < 12; i++) crack(hctx, rng, rng.range(0, S), rng.range(0, S), 8, 30, rng.range(0, 6), 3);
  flatten(ctx, S, S, o.flatten * 0.7);
  return { map: toTexture(c, true, o.anisotropy), normalMap: o.normalMaps ? normalFromHeight(hctx, S, S, 3.2) : undefined };
}

// ---------------------------------------------------------------- props

/** Chipped enamel over rust. `paint` is the enamel color. */
export function paintMetal(paint: string, o: PaintOptions, seed = 31, chips = 1): Surface {
  const S = 512;
  const rng = new Rng(seed);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 20, [shade(paint, 0.25), shade(paint, -0.3)], [50, 160], 0.35);
  strokes(ctx, rng, S, S, { count: 700, colors: [shade(paint, 0.2), shade(paint, -0.2), shade(paint, -0.35)], len: [20, 80], width: [4, 12], alpha: [0.08, 0.25], angle: 0, spread: 0.3 });
  // Rust blooms with a dark core, and streaks running down from them.
  for (let i = 0; i < 46 * chips; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const r = rng.range(5, 34);
    wrapped(S, S, x, y, r * 4, (px, py) => {
      ctx.fillStyle = 'rgba(96,48,26,0.5)';
      ctx.fillRect(px - r * 0.3, py, r * 0.6, r * rng.range(2, 4));
      ctx.fillStyle = '#7b4326';
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const rr = r * rng.range(0.6, 1.1);
        if (k) ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8);
        else ctx.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,16,10,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#4a2415';
      ctx.beginPath();
      ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  strokes(ctx, rng, S, S, { count: 300, colors: ['#2a1a12', '#c98a4a'], len: [3, 14], width: [1, 3], alpha: [0.15, 0.45] });
  flatten(ctx, S, S, o.flatten);
  return { map: toTexture(c, true, o.anisotropy) };
}

export function paintWood(o: PaintOptions, base = '#6b4a30', seed = 44): Surface {
  const S = 512;
  const rng = new Rng(seed);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  // Planks, 8 across.
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = shade(base, rng.range(-0.3, 0.2));
    ctx.fillRect(i * 64, 0, 62, S);
  }
  strokes(ctx, rng, S, S, { count: 1400, colors: [shade(base, 0.3), shade(base, -0.4), '#3a2a1c', '#8d6a44'], len: [40, 160], width: [1.5, 5], alpha: [0.1, 0.35], angle: Math.PI / 2, spread: 0.06 });
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(15,10,8,0.8)';
    ctx.fillRect(i * 64 + 61, 0, 3, S);
  }
  mottle(ctx, rng, S, S, 10, ['#1c1612', '#4d5326'], [40, 120], 0.3);
  flatten(ctx, S, S, o.flatten);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Burlap for sandbags, also used for the awning underside. */
export function paintCloth(base: string, o: PaintOptions, seed = 52): Surface {
  const S = 256;
  const rng = new Rng(seed);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  strokes(ctx, rng, S, S, { count: 900, colors: [shade(base, 0.25), shade(base, -0.3)], len: [6, 22], width: [1, 3], alpha: [0.15, 0.4], angle: 0, spread: 0.08 });
  strokes(ctx, rng, S, S, { count: 900, colors: [shade(base, 0.2), shade(base, -0.35)], len: [6, 22], width: [1, 3], alpha: [0.15, 0.4], angle: Math.PI / 2, spread: 0.08 });
  mottle(ctx, rng, S, S, 8, ['#2a2018'], [30, 80], 0.35);
  flatten(ctx, S, S, o.flatten);
  return { map: toTexture(c, true, o.anisotropy) };
}

/**
 * Grey metal atlas for vertex-coloured weapon metal (WP4 look 2): left half `paintMetal` (chipped, rust
 * blooms), right half clean brushed steel of the same mean tone, for blades that must read silvery.
 */
export function paintMetalAtlas(o: PaintOptions, tone = '#a0a0a0', seed = 73): Surface {
  const S = 512;
  const rng = new Rng(seed + 1);
  const [c, ctx] = canvas(S * 2, S);
  ctx.drawImage(paintMetal(tone, o, seed, 1).map.image as HTMLCanvasElement, 0, 0);
  ctx.save();
  ctx.translate(S, 0);
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, S, S);
  strokes(ctx, rng, S, S, { count: 900, colors: [shade(tone, 0.3), shade(tone, -0.2)], len: [60, 220], width: [1, 3], alpha: [0.08, 0.22], angle: Math.PI / 2, spread: 0.03 });
  mottle(ctx, rng, S, S, 6, [shade(tone, 0.15), shade(tone, -0.12)], [60, 160], 0.2);
  ctx.restore();
  flatten(ctx, S * 2, S, o.flatten);
  return { map: toTexture(c, false, o.anisotropy) };
}

/** Mean sRGB tone of each `paintGrain` cell; weapon vertex colours are divided by it (WP4 D1). Cells 4 to 6 are measured from `grain-cloth.webp`. */
export const GRAIN_TONE = [0xb4, 0xc4, 0xcc, 0xb8, 0xba, 0xb7, 0xb4] as const;

/** T9 (local FLUX.2 klein): tweed, knit and straw, 256 px each side by side, neutral grey. */
const GRAIN_CLOTH = new URL('../../assets/textures/hero/grain-cloth.webp', import.meta.url).href;
const grainLoads: Promise<void>[] = [];
/** Resolves once every grain atlas made so far has its painted cells (or failed to load them): render tools wait for it. */
export const grainReady = (): Promise<void> => Promise.all(grainLoads).then(() => undefined);

/**
 * Neutral grey grain atlas for vertex-coloured matte parts (WP4 D1), 4 × 2 cells of 256 px:
 * row 0: 0 wood (grain along v, 8 planks across u), 1 cloth weave, 2 plain (faint mottle), 3 concrete;
 * row 1: 4 tweed, 5 knit, 6 straw (T9 painted cells, the weave until the image is in), 7 spare.
 * Row 0 sits at the top of the canvas, i.e. at v 0.5..1 once flipped.
 */
export function paintGrain(o: PaintOptions, seed = 57): Surface {
  const S = 256;
  const rng = new Rng(seed);
  const [c, ctx] = canvas(S * 4, S * 2);
  const hex = (t: number): string => `#${t.toString(16).repeat(3)}`;
  const cell = (i: number, draw: () => void): void => {
    ctx.save();
    ctx.translate((i % 4) * S, (i >> 2) * S);
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.clip();
    ctx.fillStyle = hex(GRAIN_TONE[Math.min(i, GRAIN_TONE.length - 1)]!);
    ctx.fillRect(0, 0, S, S);
    draw();
    ctx.restore();
  };
  cell(0, () => {
    const t = hex(GRAIN_TONE[0]);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = shade(t, rng.range(-0.18, 0.12));
      ctx.fillRect(i * 32, 0, 31, S);
    }
    strokes(ctx, rng, S, S, { count: 700, colors: [shade(t, 0.3), shade(t, -0.35), '#5a5a5a'], len: [20, 90], width: [1, 3], alpha: [0.1, 0.35], angle: Math.PI / 2, spread: 0.06 });
    ctx.fillStyle = 'rgba(20,20,20,0.6)';
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 32 + 30, 0, 2, S);
  });
  const weave = (t: string): void => {
    strokes(ctx, rng, S, S, { count: 500, colors: [shade(t, 0.25), shade(t, -0.3)], len: [6, 20], width: [1, 3], alpha: [0.15, 0.4], angle: 0, spread: 0.08 });
    strokes(ctx, rng, S, S, { count: 500, colors: [shade(t, 0.2), shade(t, -0.3)], len: [6, 20], width: [1, 3], alpha: [0.15, 0.4], angle: Math.PI / 2, spread: 0.08 });
  };
  cell(1, () => weave(hex(GRAIN_TONE[1])));
  cell(2, () => mottle(ctx, rng, S, S, 6, [shade(hex(GRAIN_TONE[2]), -0.15), shade(hex(GRAIN_TONE[2]), 0.1)], [30, 80], 0.25));
  cell(3, () => {
    const t = hex(GRAIN_TONE[3]);
    mottle(ctx, rng, S, S, 14, [shade(t, -0.25), shade(t, 0.15)], [20, 70], 0.35);
    strokes(ctx, rng, S, S, { count: 900, colors: ['#404040', '#e0e0e0'], len: [1, 4], width: [1, 3], alpha: [0.2, 0.5] });
  });
  for (const i of [4, 5, 6]) cell(i, () => weave(hex(GRAIN_TONE[i]!)));
  cell(7, () => {});
  flatten(ctx, S * 4, S, o.flatten);
  const map = toTexture(c, false, o.anisotropy);
  // The painted cells replace the weave once loaded (not flattened: they are calm already).
  const img = new Image();
  grainLoads.push(new Promise((done) => {
    img.onload = (): void => { ctx.drawImage(img, 0, S, S * 3, S); map.needsUpdate = true; done(); };
    img.onerror = (): void => done();
  }));
  img.src = GRAIN_CLOTH;
  return { map };
}

/** Awning stripes, red and cream, sun-bleached and dirty. */
export function paintAwning(o: PaintOptions): Surface {
  const W = 512;
  const H = 256;
  const rng = new Rng(61);
  const [c, ctx] = canvas(W, H);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#e3cba0' : '#9e3226';
    ctx.fillRect(i * 64, 0, 64, H);
  }
  strokes(ctx, rng, W, H, { count: 700, colors: ['#f2dfb8', '#6e2019', '#3a2a22'], len: [20, 90], width: [2, 8], alpha: [0.06, 0.22], angle: Math.PI / 2, spread: 0.15 });
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(30,22,18,0.1)');
  g.addColorStop(1, 'rgba(30,22,18,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  mottle(ctx, rng, W, H, 10, ['#2a2018', '#4d5326'], [20, 70], 0.4);
  flatten(ctx, W, H, o.flatten);
  return { map: toTexture(c, true, o.anisotropy) };
}

// ---------------------------------------------------------------- windows and shop

export interface EmissiveSurface {
  map: Texture;
  emissiveMap: Texture;
}

function mullions(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x + w / 2 - 5, y, 10, h);
  ctx.fillRect(x, y + h * 0.3 - 5, w, 10);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w / 2 - 5, y, 10, h);
  ctx.strokeRect(x, y + h * 0.3 - 5, w, 10);
}

/**
 * Window atlas, 4 x 2 cells. Row 0: lit variants (also in the emissive map). Row 1: dark,
 * broken, boarded, curtain. Facades pick cells by seed.
 */
export function paintWindows(): EmissiveSurface {
  const CW = 256;
  const CH = 384;
  const [c, ctx] = canvas(CW * 4, CH * 2);
  const [e, ectx] = canvas(CW * 4, CH * 2);
  const rng = new Rng(77);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, CW * 4, CH * 2);
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * CW;
    const y = Math.floor(i / 4) * CH;
    const lit = i < 4;
    if (lit) {
      // Warm room light with a curtain or a silhouette.
      const g = ctx.createLinearGradient(x, y, x, y + CH);
      const hot = i === 3 ? '#f08a3a' : '#ffc66a';
      g.addColorStop(0, shade(hot, i === 2 ? -0.35 : 0));
      g.addColorStop(1, shade('#d9772a', i === 2 ? -0.5 : -0.1));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, CW, CH);
      if (i === 0 || i === 3) {
        ctx.fillStyle = 'rgba(120,50,30,0.55)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 70, y + 160, x + 20, y + CH);
        ctx.lineTo(x, y + CH);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + CW, y);
        ctx.quadraticCurveTo(x + CW - 80, y + 190, x + CW - 30, y + CH);
        ctx.lineTo(x + CW, y + CH);
        ctx.fill();
      }
      if (i === 1) {
        // Shelf and a plant.
        ctx.fillStyle = 'rgba(60,30,18,0.75)';
        ctx.fillRect(x + 20, y + 250, CW - 40, 14);
        for (let k = 0; k < 5; k++) ctx.fillRect(x + 36 + k * 38, y + 250 - rng.range(30, 90), 22, 100);
      }
      if (i === 2) {
        ctx.fillStyle = 'rgba(20,12,10,0.6)';
        ctx.fillRect(x, y, CW, CH * 0.45);
      }
      ectx.drawImage(c, x, y, CW, CH, x, y, CW, CH);
    } else {
      const g = ctx.createLinearGradient(x, y, x + CW, y + CH);
      g.addColorStop(0, '#1b2a2c');
      g.addColorStop(0.5, '#0e1517');
      g.addColorStop(1, '#22383a');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, CW, CH);
      // Moonlit reflection streaks.
      ctx.fillStyle = 'rgba(150,200,200,0.12)';
      ctx.beginPath();
      ctx.moveTo(x + 30, y + CH);
      ctx.lineTo(x + 130, y);
      ctx.lineTo(x + 170, y);
      ctx.lineTo(x + 70, y + CH);
      ctx.fill();
      if (i === 5 || i === 7) {
        // Broken pane: black hole with shards.
        ctx.fillStyle = '#050607';
        ctx.beginPath();
        const cx = x + CW * rng.range(0.35, 0.65);
        const cy = y + CH * rng.range(0.45, 0.7);
        for (let k = 0; k < 11; k++) {
          const a = (k / 11) * Math.PI * 2;
          const rr = rng.range(30, 105);
          if (k) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.2);
          else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(190,230,230,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          const a = rng.range(0, Math.PI * 2);
          ctx.lineTo(cx + Math.cos(a) * 180, cy + Math.sin(a) * 180);
          ctx.strokeStyle = 'rgba(190,230,230,0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      if (i === 6) {
        // Boarded up.
        for (let k = 0; k < 5; k++) {
          ctx.save();
          ctx.translate(x + CW / 2, y + 50 + k * 72);
          ctx.rotate(rng.range(-0.12, 0.12));
          ctx.fillStyle = shade('#6b4a30', rng.range(-0.3, 0.1));
          ctx.fillRect(-CW / 2 - 10, -26, CW + 20, 52);
          ctx.strokeStyle = PALETTE.ink;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-CW / 2 - 10, -26, CW + 20, 52);
          ctx.fillStyle = '#1a1310';
          ctx.fillRect(-CW / 2 + 14, -4, 6, 6);
          ctx.fillRect(CW / 2 - 20, -4, 6, 6);
          ctx.restore();
        }
      }
      if (i === 7) {
        ctx.fillStyle = 'rgba(70,74,60,0.8)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 110, y);
        ctx.quadraticCurveTo(x + 60, y + 200, x + 90, y + 300);
        ctx.lineTo(x, y + 330);
        ctx.fill();
      }
    }
    if (i !== 6) mullions(ctx, x, y, CW, CH, lit ? '#3a2a20' : '#8f8672');
    if (lit) mullions(ectx, x, y, CW, CH, '#1a0f08');
    // Grime in the corners.
    const v = ctx.createRadialGradient(x + CW / 2, y + CH / 2, CW * 0.35, x + CW / 2, y + CH / 2, CH * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(10,8,6,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(x, y, CW, CH);
  }
  const map = toTexture(c, false);
  const emissiveMap = toTexture(e, false);
  return { map, emissiveMap };
}

/** Späti shop window: shelves with bottles, a glowing fridge, posters. Lit from inside. */
export function paintShopWindow(): EmissiveSurface {
  const W = 1024;
  const H = 512;
  const rng = new Rng(88);
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffcf7a');
  g.addColorStop(1, '#e08a34');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Fridge with cold light on the right.
  const fr = ctx.createLinearGradient(760, 0, 1000, 0);
  fr.addColorStop(0, '#bff3ee');
  fr.addColorStop(1, '#7fd2cf');
  ctx.fillStyle = fr;
  ctx.fillRect(760, 70, 230, 400);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 5;
  ctx.strokeRect(760, 70, 230, 400);
  const bottle = ['#2f6b3a', '#7b3b1c', '#b8261c', '#e8b12a', '#2463a5', '#e9e2cf', '#3a8a7a', '#c05a8a', '#f08a2a'];
  const shelf = (x0: number, x1: number, y: number, tall: number): void => {
    ctx.fillStyle = '#5a341c';
    ctx.fillRect(x0, y, x1 - x0, 12);
    let x = x0 + 8;
    while (x < x1 - 20) {
      const bw = rng.range(14, 30);
      const bh = tall * rng.range(0.55, 1);
      ctx.fillStyle = shade(rng.pick(bottle), rng.range(-0.2, 0.15));
      ctx.fillRect(x, y - bh, bw, bh);
      if (rng.next() < 0.6) {
        ctx.fillRect(x + bw * 0.3, y - bh - bh * 0.3, bw * 0.4, bh * 0.3);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(x + 2, y - bh * 0.6, bw - 4, bh * 0.25);
      }
      ctx.strokeStyle = 'rgba(20,12,8,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - bh, bw, bh);
      x += bw + rng.range(2, 8);
    }
  };
  for (let r = 0; r < 4; r++) shelf(30, 730, 130 + r * 105, 78);
  for (let r = 0; r < 4; r++) shelf(775, 985, 160 + r * 95, 62);
  // Posters and price tags on the glass.
  const poster = (x: number, y: number, w: number, h: number, col: string, text: string): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(-0.06, 0.06));
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `bold ${Math.round(h * 0.42)}px "Arial Black", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
    ctx.restore();
  };
  poster(60, 30, 170, 62, '#f3ce43', 'BIER 1,-');
  poster(470, 36, 190, 58, '#e9e2cf', 'TABAK');
  poster(300, 420, 210, 64, '#b8261c', 'OFFEN');
  strokes(ctx, rng, W, H, { count: 500, colors: ['#fff2c8', '#7a3d1c', '#2a1a12'], len: [10, 50], width: [2, 7], alpha: [0.05, 0.16] });
  // Dirty glass.
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(20,14,10,0.4)');
  v.addColorStop(0.25, 'rgba(20,14,10,0)');
  v.addColorStop(0.8, 'rgba(20,14,10,0)');
  v.addColorStop(1, 'rgba(20,14,10,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2d1d14';
  for (const x of [0, 372, 744, W - 14]) ctx.fillRect(x, 0, 14, H);
  ctx.fillRect(0, 0, W, 14);
  ctx.fillRect(0, H - 22, W, 22);
  const map = toTexture(c, false);
  return { map, emissiveMap: map };
}

/** Shop sign: SPÄTI in warm bulbs on an oxblood board. */
export function paintSign(): EmissiveSurface {
  const W = 1024;
  const H = 256;
  const rng = new Rng(93);
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = '#4a1a17';
  ctx.fillRect(0, 0, W, H);
  strokes(ctx, rng, W, H, { count: 500, colors: ['#6d2a22', '#2c0f0d', '#7b4326'], len: [20, 90], width: [3, 10], alpha: [0.1, 0.3], angle: 0, spread: 0.2 });
  ctx.strokeStyle = '#c9973a';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  for (const [target, glow] of [[ctx, false], [ectx, true]] as Array<[Ctx, boolean]>) {
    target.textAlign = 'center';
    target.textBaseline = 'middle';
    target.font = 'bold 170px "Arial Black", Impact, "DejaVu Sans", sans-serif';
    if (!glow) {
      target.lineWidth = 16;
      target.strokeStyle = PALETTE.ink;
      target.strokeText('SPÄTI', W / 2 - 150, H / 2 + 8);
    }
    target.fillStyle = glow ? '#ffb347' : '#ffd98a';
    target.fillText('SPÄTI', W / 2 - 150, H / 2 + 8);
    target.font = 'bold 44px "Arial Black", Impact, "DejaVu Sans", sans-serif';
    target.fillStyle = glow ? '#7a4a1c' : '#f0b27a';
    target.fillText('GETRÄNKE', W - 190, 78);
    target.fillText('TABAK', W - 190, 132);
    target.fillStyle = glow ? '#3fa7a2' : '#7fd2cf';
    target.fillText('24 h', W - 190, 190);
    // Bulbs along the frame, a few dead.
    for (let i = 0; i < 30; i++) {
      const dead = rng.next() < 0.2;
      const x = 34 + (i * (W - 68)) / 29;
      for (const y of [28, H - 28]) {
        target.fillStyle = dead ? (glow ? '#000' : '#5a4a3a') : glow ? '#ffc56a' : '#fff0c0';
        target.beginPath();
        target.arc(x, y, 8, 0, Math.PI * 2);
        target.fill();
      }
    }
  }
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}

/** Old wooden house door with a transom light. */
export function paintDoor(o: PaintOptions): Surface {
  const W = 256;
  const H = 512;
  const rng = new Rng(101);
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#3f4a3c';
  ctx.fillRect(0, 0, W, H);
  strokes(ctx, rng, W, H, { count: 500, colors: ['#566352', '#2a3228', '#6b4a30'], len: [30, 120], width: [2, 7], alpha: [0.1, 0.35], angle: Math.PI / 2, spread: 0.08 });
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 4;
  for (const [x, y, w, h] of [[26, 110, 90, 150], [140, 110, 90, 150], [26, 290, 90, 190], [140, 290, 90, 190]] as number[][]) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x as number, y as number, w as number, h as number);
    ctx.strokeRect(x as number, y as number, w as number, h as number);
  }
  ctx.fillStyle = '#12191a';
  ctx.fillRect(26, 20, 204, 66);
  ctx.strokeRect(26, 20, 204, 66);
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.fillStyle = '#c9973a';
  ctx.beginPath();
  ctx.arc(128 + 18, 270, 8, 0, Math.PI * 2);
  ctx.fill();
  mottle(ctx, rng, W, H, 6, ['#1a1410'], [40, 120], 0.4);
  flatten(ctx, W, H, o.flatten);
  return { map: toTexture(c, false, o.anisotropy) };
}

// ---------------------------------------------------------------- vehicle

/** Side or front elevation of the wrecked BVG van, painted as one image. */
export function paintVan(view: 'side' | 'front' | 'roof', o: PaintOptions): Surface {
  const W = view === 'side' ? 1024 : 512;
  const H = 512;
  const rng = new Rng(view === 'side' ? 111 : view === 'front' ? 112 : 113);
  const [c, ctx] = canvas(W, H);
  const yellow = PALETTE.bvg;
  ctx.fillStyle = yellow;
  ctx.fillRect(0, 0, W, H);
  mottle(ctx, rng, W, H, 16, [shade(yellow, 0.25), shade(yellow, -0.3), '#b0701c'], [60, 180], 0.35);
  strokes(ctx, rng, W, H, { count: 600, colors: [shade(yellow, 0.2), shade(yellow, -0.25), '#a86a1a'], len: [30, 110], width: [4, 12], alpha: [0.08, 0.25], angle: 0, spread: 0.25 });
  const glass = (x: number, y: number, w: number, h: number, broken: boolean): void => {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#1d2f31');
    g.addColorStop(1, '#0c1214');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,210,210,0.13)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.15, y + h);
    ctx.lineTo(x + w * 0.45, y);
    ctx.lineTo(x + w * 0.6, y);
    ctx.lineTo(x + w * 0.3, y + h);
    ctx.fill();
    if (broken) {
      const cx = x + w * rng.range(0.3, 0.7);
      const cy = y + h * rng.range(0.3, 0.7);
      ctx.strokeStyle = 'rgba(200,235,235,0.55)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 9; k++) {
        const a = rng.range(0, Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * h * 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = '#040506';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  if (view === 'side') {
    // Window band, doors, wheel arches, lettering.
    for (let i = 0; i < 4; i++) glass(60 + i * 232, 60, 200, 170, i === 1 || i === 3);
    ctx.strokeStyle = 'rgba(30,18,10,0.85)';
    ctx.lineWidth = 5;
    ctx.strokeRect(292, 50, 232, 400);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 120px "Arial Black", Impact, "DejaVu Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('BVG', 590, 330);
    ctx.fillStyle = '#16110f';
    for (const x of [170, 850]) {
      ctx.beginPath();
      ctx.arc(x, H + 10, 105, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,14,10,0.9)';
    ctx.fillRect(0, 262, W, 10);
  } else if (view === 'front') {
    glass(40, 50, 432, 200, true);
    // Destination board.
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(110, 8, 292, 36);
    ctx.fillStyle = '#e8a23a';
    ctx.font = 'bold 26px "Arial Black", Impact, "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X69 KÖPENICK', 256, 27);
    for (const x of [90, 422]) {
      ctx.fillStyle = '#e9e2cf';
      ctx.beginPath();
      ctx.arc(x, 350, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.fillStyle = '#2a211c';
    ctx.fillRect(150, 320, 212, 70);
    ctx.fillStyle = '#3a3330';
    ctx.fillRect(0, 430, W, 82);
  }
  // Rust from the roof edge and the sills, plus chips.
  for (let i = 0; i < (view === 'roof' ? 22 : 34); i++) {
    const x = rng.range(0, W);
    const y = view === 'roof' ? rng.range(0, H) : rng.pick([rng.range(0, 40), rng.range(240, 300), rng.range(400, H)]);
    const r = rng.range(6, view === 'roof' ? 16 : 30);
    ctx.fillStyle = 'rgba(110,56,28,0.55)';
    ctx.fillRect(x - r * 0.35, y, r * 0.7, r * rng.range(2, 5));
    ctx.fillStyle = '#7b4326';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, rng.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a2415';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.45, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  mottle(ctx, rng, W, H, 10, ['#1a1410', '#4d5326'], [40, 140], 0.3);
  flatten(ctx, W, H, o.flatten * 0.6);
  return { map: toTexture(c, false, o.anisotropy) };
}

// ---------------------------------------------------------------- foliage and sprites

/** Ivy leaf cluster with ink outlines on a transparent ground (alpha tested). */
export function paintIvy(): Texture {
  const S = 256;
  const rng = new Rng(121);
  const [c, ctx] = canvas(S, S);
  const greens = ['#5d7a2c', '#7b8a32', '#3f5a2a', '#9a9a3a', '#4a6a34', '#b0a040'];
  for (let i = 0; i < 46; i++) {
    const x = rng.range(26, S - 26);
    const y = rng.range(26, S - 26);
    const r = rng.range(12, 24);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(0, Math.PI * 2));
    ctx.fillStyle = shade(rng.pick(greens), rng.range(-0.25, 0.1));
    ctx.beginPath();
    // Five-lobed ivy leaf.
    ctx.moveTo(0, r);
    ctx.lineTo(-r * 0.9, r * 0.35);
    ctx.lineTo(-r * 0.75, -r * 0.3);
    ctx.lineTo(-r * 0.25, -r * 0.35);
    ctx.lineTo(0, -r);
    ctx.lineTo(r * 0.25, -r * 0.35);
    ctx.lineTo(r * 0.75, -r * 0.3);
    ctx.lineTo(r * 0.9, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,24,12,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220,230,150,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    ctx.lineTo(0, -r * 0.7);
    ctx.stroke();
    ctx.restore();
  }
  const t = toTexture(c, false);
  return t;
}

/** Fern/grass tuft, alpha tested. */
export function paintFern(): Texture {
  const S = 256;
  const rng = new Rng(131);
  const [c, ctx] = canvas(S, S);
  const greens = ['#6a8a34', '#4f6f2e', '#8a9a3c', '#3f5a2a'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + rng.range(-1.1, 1.1);
    const len = rng.range(110, 220);
    ctx.strokeStyle = shade(rng.pick(greens), rng.range(-0.2, 0.15));
    ctx.lineWidth = rng.range(5, 11);
    ctx.beginPath();
    ctx.moveTo(S / 2 + rng.range(-14, 14), S - 4);
    const ex = S / 2 + Math.cos(a) * len;
    const ey = S - 4 + Math.sin(a) * len;
    ctx.quadraticCurveTo(S / 2 + Math.cos(a) * len * 0.5, S - 4 + Math.sin(a) * len * 0.75, ex, Math.min(S - 30, ey + 40));
    ctx.stroke();
  }
  return toTexture(c, false);
}

/** Soft round gradient: light pools, blob shadows, mist. */
export function paintGlow(inner: string, outer: string): Texture {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- map (M11)

/** Neutral painted earth: vertex colors tint it into grass, forest floor, jungle or paving. */
export function paintGround(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(61);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#8a8a7a';
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 50, ['#9a9a86', '#6e7064', '#a39a82', '#7a806c'], [30, 120], 0.45);
  strokes(ctx, rng, S, S, { count: 2400, colors: ['#b0ad96', '#5f6258', '#8c8a70', '#727a62'], len: [6, 26], width: [2, 7], alpha: [0.1, 0.32] });
  // Grass blades and leaf litter as short bright and dark flecks.
  strokes(ctx, rng, S, S, { count: 1400, colors: ['#c4c3a8', '#4e5248'], len: [3, 9], width: [1, 2.5], alpha: [0.2, 0.5], angle: -Math.PI / 2, spread: 0.5 });
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

// Ground variant C (M11b, Johannes 2026-11-16): four painted grounds blended per vertex in one
// shader (`groundMaterial` in map-world.ts), so paving gets overgrown and areas fade into each other.

/** Rough grass with dry stalks. */
export function paintGrass(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(201);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#4f5c38';
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 46, ['#5d6b3f', '#3f4b2e', '#66703f', '#4a4a30'], [30, 110], 0.5);
  strokes(ctx, rng, S, S, { count: 3200, colors: ['#73844a', '#3a4529', '#8a8a52', '#56663a'], len: [5, 16], width: [1.5, 4], alpha: [0.25, 0.6], angle: -Math.PI / 2, spread: 0.6 });
  strokes(ctx, rng, S, S, { count: 500, colors: ['#a59a62', '#8c7a48'], len: [4, 10], width: [1, 2], alpha: [0.3, 0.6], angle: -Math.PI / 2, spread: 0.9 });
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Bare earth and mud with pebbles. */
export function paintDirt(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(203);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#5a4a36';
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 50, ['#4a3c2c', '#6a5640', '#3e3428', '#5f5038'], [20, 90], 0.55);
  strokes(ctx, rng, S, S, { count: 1800, colors: ['#7a6448', '#3a3024', '#6a5a44'], len: [4, 14], width: [2, 5], alpha: [0.15, 0.35] });
  for (let i = 0; i < 420; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const r = rng.range(1.5, 4.5);
    wrapped(S, S, x, y, r + 1, (px, py) => {
      ctx.fillStyle = shade(rng.pick(['#8a7d6a', '#6e665a', '#9a8a72']), rng.range(-0.2, 0.1));
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.75, rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,14,10,0.35)';
      ctx.beginPath();
      ctx.ellipse(px + r * 0.3, py + r * 0.35, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Cracked sidewalk plates (50 cm at 5 m per tile), some missing, weeds in the joints. */
export function paintPaving(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(207);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#3a3a30';
  ctx.fillRect(0, 0, S, S);
  const n = 10;
  const p = S / n;
  const tones = ['#5f5b54', '#67625a', '#57544e', '#6d675e', '#5a5850'];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (rng.next() < 0.04) {
        // Missing plate: earth.
        ctx.fillStyle = shade('#4a3c2c', rng.range(-0.2, 0.1));
        ctx.fillRect(i * p + 1, j * p + 1, p - 2, p - 2);
        continue;
      }
      const x = i * p + 1.5;
      const y = j * p + 1.5;
      const w = p - 3;
      ctx.fillStyle = shade(rng.pick(tones), rng.range(-0.18, 0.1));
      ctx.fillRect(x, y, w, w);
      ctx.fillStyle = 'rgba(255,235,210,0.05)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = 'rgba(10,8,6,0.15)';
      ctx.fillRect(x, y + w - 2, w, 2);
    }
  }
  mottle(ctx, rng, S, S, 44, ['#2a2620', '#4d5326', '#3a3428', '#5a5444'], [20, 90], 0.55);
  strokes(ctx, rng, S, S, { count: 1400, colors: ['#9a958a', '#3a3630', '#5a5a48'], len: [3, 12], width: [1, 3], alpha: [0.1, 0.3] });
  for (let i = 0; i < 18; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.int(6) + 4, 14, rng.range(0, Math.PI * 2), 1.6);
  // Weeds along some joints.
  strokes(ctx, rng, S, S, { count: 260, colors: ['#5d7a34', '#6f8a3c'], len: [3, 8], width: [1.5, 3], alpha: [0.5, 0.8], angle: -Math.PI / 2, spread: 0.8 });
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Forest floor: old leaves, needles and twigs. */
export function paintLeafLitter(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(211);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#3a3626';
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 40, ['#2e2c1e', '#4a3e26', '#3a4228'], [20, 80], 0.5);
  for (let i = 0; i < 1500; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const r = rng.range(3, 7);
    const a = rng.range(0, Math.PI);
    const col = shade(rng.pick(['#7a5a2a', '#5a4a22', '#8a6a32', '#6a4020', '#4f4a26']), rng.range(-0.3, 0.1));
    wrapped(S, S, x, y, r + 1, (px, py) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.45, a, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  strokes(ctx, rng, S, S, { count: 500, colors: ['#2a2018', '#5a4a30'], len: [8, 22], width: [1, 2], alpha: [0.4, 0.7] });
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Ground scatter atlas, 2 × 2 cells: puddle, leaf pile, paper and trash, rubble crumbs (alpha cut). */
export function paintLitter(): Texture {
  const S = 512;
  const H = S / 2;
  const rng = new Rng(213);
  const [c, ctx] = canvas(S, S);
  ctx.clearRect(0, 0, S, S);
  // Puddle (top left): irregular dark blob with a sky glint.
  ctx.save();
  ctx.translate(H / 2, H / 2);
  ctx.fillStyle = '#16262a';
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 96 + 18 * Math.sin(a * 3 + 1) + 10 * Math.sin(a * 5);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.62);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(120,160,170,0.35)';
  ctx.beginPath();
  ctx.ellipse(-20, -14, 50, 7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Leaf pile (top right).
  for (let i = 0; i < 260; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * 100;
    ctx.fillStyle = shade(rng.pick(['#8a6a32', '#7a5a2a', '#a07a36', '#6a4020', '#5a4a22']), rng.range(-0.25, 0.15));
    ctx.beginPath();
    ctx.ellipse(H + H / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d, rng.range(5, 10), rng.range(2.5, 4.5), rng.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
  // Paper, cans and plastic (bottom left).
  for (let i = 0; i < 16; i++) {
    const x = rng.range(30, H - 30);
    const y = H + rng.range(30, H - 30);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(0, Math.PI));
    ctx.fillStyle = shade(rng.pick(['#d8d0bc', '#c23a2e', '#3a6ad0', '#e8e0d0', '#f2d14b', '#5aa04a']), rng.range(-0.3, 0));
    ctx.fillRect(-rng.range(6, 16), -rng.range(4, 10), rng.range(12, 30), rng.range(8, 18));
    ctx.restore();
  }
  // Rubble crumbs (bottom right).
  for (let i = 0; i < 110; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * 100;
    const r = rng.range(3, 11);
    const x = H + H / 2 + Math.cos(a) * d;
    const y = H + H / 2 + Math.sin(a) * d;
    ctx.fillStyle = shade(rng.pick(['#8a7f70', '#7a4a35', '#9a9488', '#6a6258']), rng.range(-0.25, 0.1));
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r * 0.3, y - r * 0.8);
    ctx.lineTo(x + r, y - r * 0.2);
    ctx.lineTo(x + r * 0.4, y + r * 0.7);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,8,6,0.4)';
    ctx.fillRect(x - r * 0.4, y + r * 0.3, r, r * 0.3);
  }
  return toTexture(c, false);
}

export function paintAsphalt(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(67);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#3b3936';
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 40, ['#47433e', '#2e2d2b', '#4a4a3c', '#33302c'], [20, 90], 0.5);
  strokes(ctx, rng, S, S, { count: 2600, colors: ['#5a5650', '#262523', '#4d483f'], len: [3, 12], width: [1, 4], alpha: [0.15, 0.4] });
  for (let i = 0; i < 26; i++) crack(ctx, rng, rng.range(0, S), rng.range(0, S), rng.int(10) + 5, 16, rng.range(0, Math.PI * 2), 1.6);
  mottle(ctx, rng, S, S, 12, ['#3d4a26', '#4d5326'], [10, 40], 0.45);
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Clay roof tiles, rows along V. */
export function paintRoofTiles(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(71);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#5a2a20';
  ctx.fillRect(0, 0, S, S);
  const rows = 16;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -12 : 0;
    while (x < S) {
      const w = rng.range(20, 28);
      ctx.fillStyle = shade(rng.pick(['#8b4a35', '#7a3c2c', '#94553a', '#6b3528']), rng.range(-0.2, 0.1));
      ctx.beginPath();
      ctx.roundRect(x + 1, r * rh + 1, w - 2, rh - 2, [0, 0, 8, 8]);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 1, r * rh + rh - 6, w - 2, 4);
      x += w;
    }
  }
  mottle(ctx, rng, S, S, 20, ['#3d4a26', '#1c1814', '#4d5326'], [20, 80], 0.35);
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Weathered GDR concrete with formwork lines. */
export function paintConcrete(o: PaintOptions, base = '#8f8b80'): Surface {
  const S = 512;
  const rng = new Rng(73);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 40, [shade(base, 0.08), shade(base, -0.1), '#7f8476'], [30, 120], 0.18);
  ctx.strokeStyle = 'rgba(40,36,30,0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < S; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }
  // Rust and water streaks.
  for (let i = 0; i < 30; i++) {
    const x = rng.range(0, S);
    const g = ctx.createLinearGradient(x, 0, x, S);
    g.addColorStop(0, 'rgba(90,50,30,0.25)');
    g.addColorStop(1, 'rgba(90,50,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, rng.range(0, S / 2), rng.range(2, 6), rng.range(60, 260));
  }
  strokes(ctx, rng, S, S, { count: 1600, colors: [shade(base, 0.15), shade(base, -0.2)], len: [4, 18], width: [1, 4], alpha: [0.08, 0.22] });
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** A lit shop sign with painted letters (Forum, Rathaus clock …). */
export function paintTextSign(text: string, bg: string, fg: string): EmissiveSurface {
  const W = 512;
  const H = 96;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  for (const [k, color] of [[ctx, fg], [ectx, '#ffffff']] as Array<[Ctx, string]>) {
    k.fillStyle = color;
    k.font = 'bold 68px Georgia, serif';
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    k.fillText(text, W / 2, H / 2 + 4);
  }
  // A few dead letters.
  ectx.fillStyle = 'rgba(0,0,0,0.75)';
  ectx.fillRect(W * 0.58, 0, W * 0.09, H);
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}

// ---------------------------------------------------------------- M11c urban props

/** Faded car enamel: near-white base (vertex tint gives the color), chalky fade, dirt runs, rust blooms. */
export function paintCarPaint(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(83);
  const [c, ctx] = canvas(S, S);
  const base = '#e6e1d4';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, rng, S, S, 30, ['#f4f0e6', '#c9c3b2', '#d8d2c0'], [40, 140], 0.45);
  strokes(ctx, rng, S, S, { count: 500, colors: ['#f6f2ea', '#bdb6a4'], len: [20, 70], width: [3, 10], alpha: [0.08, 0.2], angle: 0, spread: 0.2 });
  // Grey primer patches with a hard sanded edge.
  for (let i = 0; i < 5; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(18, 46);
    wrapped(S, S, x, y, r * 1.4, (px, py) => {
      ctx.fillStyle = 'rgba(120,122,116,0.85)';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, rr = r * rng.range(0.7, 1.2); if (k) ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7); else ctx.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7); }
      ctx.closePath();
      ctx.fill();
    });
  }
  // Rust in clusters of ragged blooms (edges, seams), streaks running down, fine chips everywhere.
  for (let k = 0; k < 9; k++) {
    const cx = rng.range(0, S), cy = rng.range(0, S), spread = rng.range(15, 55);
    for (let i = 0; i < 4 + rng.int(10); i++) {
      const x = cx + rng.range(-1, 1) * spread, y = cy + rng.range(-0.6, 0.6) * spread, r = rng.range(2, 13);
      wrapped(S, S, x, y, r * 5, (px, py) => {
        ctx.fillStyle = 'rgba(110,58,28,0.28)';
        ctx.fillRect(px - r * 0.2, py, r * 0.4 + 1, r * rng.range(2, 6));
        for (const [col, f] of [['#9a5a2e', 1], ['#6e3618', 0.7], ['#3e1d0e', 0.35]] as Array<[string, number]>) {
          ctx.fillStyle = col;
          ctx.beginPath();
          for (let q = 0; q < 9; q++) { const a = (q / 9) * Math.PI * 2, rr = r * f * rng.range(0.5, 1.25); if (q) ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7); else ctx.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7); }
          ctx.closePath();
          ctx.fill();
        }
      });
    }
  }
  for (let i = 0; i < 400; i++) { ctx.fillStyle = rng.next() < 0.5 ? 'rgba(90,48,24,0.7)' : 'rgba(255,250,240,0.35)'; ctx.fillRect(rng.range(0, S), rng.range(0, S), rng.range(1, 3), rng.range(1, 2)); }
  strokes(ctx, rng, S, S, { count: 260, colors: ['#3a2c20', '#f2ece0'], len: [3, 12], width: [1, 2], alpha: [0.15, 0.4] });
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Corrugated container steel: vertical ribs with light/dark flanks, rust running from the top, dents. */
export function paintCorrugated(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(91);
  const [c, ctx] = canvas(S, S);
  const [, hctx] = canvas(S, S);
  ctx.fillStyle = '#e2ddd0';
  ctx.fillRect(0, 0, S, S);
  const rib = S / 8;
  for (let x = 0; x < S; x += rib) {
    // Flat face, light flank, outer face, dark flank.
    const gr = ctx.createLinearGradient(x, 0, x + rib, 0);
    for (const [t, c] of [[0, 'rgba(30,26,22,0.18)'], [0.38, 'rgba(30,26,22,0.05)'], [0.46, 'rgba(255,255,250,0.4)'], [0.55, 'rgba(255,255,250,0.15)'], [0.86, 'rgba(255,255,250,0.05)'], [0.95, 'rgba(30,26,22,0.45)'], [1, 'rgba(30,26,22,0.18)']] as Array<[number, string]>) gr.addColorStop(t, c);
    ctx.fillStyle = gr; ctx.fillRect(x, 0, rib, S);
    hctx.fillStyle = '#000'; hctx.fillRect(x, 0, rib * 0.42, S);
    hctx.fillStyle = '#808080'; hctx.fillRect(x + rib * 0.42, 0, rib * 0.08, S); hctx.fillRect(x + rib * 0.92, 0, rib * 0.08, S);
    hctx.fillStyle = '#fff'; hctx.fillRect(x + rib * 0.5, 0, rib * 0.42, S);
  }
  mottle(ctx, rng, S, S, 24, ['#f2eee4', '#b8b09c'], [40, 140], 0.35);
  for (let i = 0; i < 16; i++) {
    const x = rng.range(0, S), y = rng.range(0, S);
    const g = ctx.createLinearGradient(x, y, x, y + rng.range(60, 220));
    g.addColorStop(0, 'rgba(120,60,28,0.45)');
    g.addColorStop(1, 'rgba(120,60,28,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, rng.range(3, 12), 220);
    ctx.fillStyle = '#6e3a1e';
    ctx.beginPath();
    ctx.ellipse(x + 3, y, rng.range(3, 12), rng.range(2, 7), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  strokes(ctx, rng, S, S, { count: 160, colors: ['#2e2218', '#f4efe2'], len: [3, 10], width: [1, 2], alpha: [0.1, 0.3] });
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy), normalMap: o.normalMaps ? normalFromHeight(hctx, S, S, 2.5) : undefined };
}

/** One bay of a crane lattice (alpha tested): two chords and a zig-zag of diagonals, light paint for tinting. */
export function paintLattice(): Texture {
  const S = 128;
  const rng = new Rng(97);
  const [c, ctx] = canvas(S, S);
  ctx.lineCap = 'square';
  const bar = (x0: number, y0: number, x1: number, y1: number, w: number): void => {
    ctx.strokeStyle = '#2a2218'; ctx.lineWidth = w + 3;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ece6d4'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  bar(0, 64, S, 64, 5);
  bar(4, 0, S - 4, S, 6);
  bar(S - 4, 0, 4, S, 6);
  bar(7, -2, 7, S + 2, 12);
  bar(S - 7, -2, S - 7, S + 2, 12);
  // Rust at the joints.
  for (const [x, y] of [[7, 0], [S - 7, 0], [7, S], [S - 7, S], [7, 64], [S - 7, 64], [64, 64]] as Array<[number, number]>) {
    ctx.fillStyle = `rgba(${120 + rng.int(30)},60,30,0.85)`;
    ctx.fillRect(x - 5, y - 4, 10, 6 + rng.int(10));
  }
  const t = toTexture(c, true);
  return t;
}

/** Torn construction tarp: light woven plastic with holes and a ragged lower edge (alpha tested). */
export function paintTarp(): Texture {
  const S = 256;
  const rng = new Rng(101);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#e8e6de';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(S, 0);
  for (let x = S; x >= 0; x -= 16) ctx.lineTo(x, S * rng.range(0.6, 1) - (x > S * 0.3 && x < S * 0.55 ? S * 0.35 : 0));
  ctx.closePath();
  ctx.fill();
  strokes(ctx, rng, S, S, { count: 500, colors: ['#ffffff', '#a8a69c'], len: [8, 30], width: [1, 2], alpha: [0.15, 0.4], angle: Math.PI / 2, spread: 0.1 });
  mottle(ctx, rng, S, S, 10, ['#5a5040'], [20, 70], 0.4);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const x = rng.range(20, S - 20), y = rng.range(20, S * 0.7);
    ctx.beginPath();
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, r = rng.range(4, 18); if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Eyelets along the top.
  ctx.fillStyle = '#3a3428';
  for (let x = 12; x < S; x += 40) { ctx.beginPath(); ctx.arc(x, 6, 3, 0, Math.PI * 2); ctx.fill(); }
  return toTexture(c, false);
}

/** Spray-paint tags and throw-ups on a transparent sheet, four cells (2 × 2) to pick from. */
export function paintGraffiti(): Texture {
  const S = 512;
  const rng = new Rng(107);
  const [c, ctx] = canvas(S, S);
  const cols = ['#d84a3a', '#3a8ad8', '#e8e0c8', '#2a2a2a', '#d8b040', '#6ac06a', '#c060b0'];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * 256, oy = Math.floor(cell / 2) * 256;
    const fill = rng.pick(cols), line = rng.pick(cols.filter((k) => k !== fill));
    const letters = 3 + rng.int(3);
    // Bubble letters: fat strokes outlined, then a thin tag on top.
    for (const [w, col] of [[44, line], [30, fill]] as Array<[number, string]>) {
      const r2 = new Rng(cell * 13 + 3);
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      for (let i = 0; i < letters; i++) {
        const x = ox + 40 + (i * 180) / letters, y = oy + 128;
        ctx.beginPath();
        ctx.moveTo(x + r2.range(-10, 10), y + r2.range(-50, -30));
        ctx.lineTo(x + r2.range(-14, 14), y + r2.range(-5, 5));
        ctx.lineTo(x + r2.range(10, 30), y + r2.range(30, 50));
        ctx.stroke();
      }
    }
    ctx.strokeStyle = rng.pick(cols);
    ctx.lineWidth = 4;
    ctx.beginPath();
    let x = ox + 30, y = oy + 200;
    ctx.moveTo(x, y);
    for (let i = 0; i < 14; i++) { x += rng.range(8, 16); y = oy + 200 + rng.range(-22, 22); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return toTexture(c, false);
}

// ---------------------------------------------------------------- market and garden

/** Tile order of `paintMarket` (4 × 4 grid, row-major from the top left). */
export const MARKET_TILES = { apples: 0, cabbage: 1, potatoes: 2, cans: 3, jars: 4, books: 5, radio: 6, tv: 7, plaid: 8, knit: 9, paper: 10, plain: 11, felt: 12, window: 13, planks: 14, soil: 15 } as const;

/**
 * Market and allotment atlas: produce seen from above, can and jar labels, book spines, radio and TV fronts,
 * clothes, newspaper, a plain tintable tile, roofing felt, a Laube window (left intact, right broken),
 * light planks for tinting and bed soil. Tiles are 256 px; draw stays inside each tile so mips do not bleed much.
 */
export function paintMarket(o: PaintOptions): Surface {
  const T = 256;
  const rng = new Rng(311);
  const [c, ctx] = canvas(T * 4, T * 4);
  const tile = (i: number, draw: () => void): void => {
    ctx.save();
    ctx.translate((i % 4) * T, Math.floor(i / 4) * T);
    ctx.beginPath();
    ctx.rect(0, 0, T, T);
    ctx.clip();
    draw();
    ctx.restore();
  };
  const fill = (col: string): void => { ctx.fillStyle = col; ctx.fillRect(0, 0, T, T); };
  const blob = (x: number, y: number, rx: number, ry: number, col: string, hi = 0.35, lo = -0.45): void => {
    const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.35, 1, x, y, Math.max(rx, ry));
    g.addColorStop(0, shade(col, hi));
    g.addColorStop(0.6, col);
    g.addColorStop(1, shade(col, lo));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rng.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  };
  const heap = (count: number, r: [number, number], cols: string[], extra?: (x: number, y: number, r: number) => void): void => {
    fill('#1e1610');
    for (let i = 0; i < count; i++) {
      const x = rng.range(0, T);
      const y = rng.range(0, T);
      const rr = rng.range(r[0], r[1]);
      blob(x, y, rr, rr * rng.range(0.8, 1), rng.pick(cols));
      extra?.(x, y, rr);
    }
  };
  // 0 apples: red and a few green, stalk dots.
  tile(0, () => heap(70, [22, 28], ['#b42a1c', '#c73a22', '#9c2018', '#8e9a2a', '#c4521e'], (x, y) => { ctx.fillStyle = '#3a2614'; ctx.fillRect(x - 1, y - 2, 3, 4); }));
  // 1 cabbage: pale green heads with leaf veins.
  tile(1, () => heap(14, [52, 64], ['#7e9a4a', '#8fae58', '#6d8a3e'], (x, y, r) => {
    ctx.strokeStyle = 'rgba(230,240,190,0.45)';
    ctx.lineWidth = 2.5;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + rng.next(); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * r * 0.5, y + Math.sin(a + 0.4) * r * 0.5, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); ctx.stroke(); }
  }));
  // 2 potatoes: dusty brown ovals with eyes.
  tile(2, () => heap(60, [18, 26], ['#a07a48', '#8a6538', '#b38c58'], (x, y) => { ctx.fillStyle = 'rgba(60,40,20,0.7)'; ctx.fillRect(x + rng.range(-8, 8), y + rng.range(-6, 6), 3, 3); }));
  // 3 cans: label bands (wraps around the cylinder) with bright brand stripes.
  tile(3, () => {
    const cols = ['#b8261c', '#e0b23a', '#2d5d8a', '#e8dcc0', '#3f7a3a'];
    for (let i = 0; i < 4; i++) {
      const col = cols[i % cols.length] as string;
      ctx.fillStyle = col; ctx.fillRect(i * 64, 0, 64, T);
      ctx.fillStyle = shade(col, 0.5); ctx.fillRect(i * 64, 90, 64, 70);
      ctx.fillStyle = '#16110f'; ctx.fillRect(i * 64 + 12, 112, 40, 8); ctx.fillRect(i * 64 + 18, 128, 28, 6);
      ctx.fillStyle = shade(col, -0.4); ctx.beginPath(); ctx.arc(i * 64 + 32, 60, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#9aa3a2'; ctx.fillRect(0, 0, T, 16); ctx.fillRect(0, T - 16, T, 16);
    ctx.fillStyle = 'rgba(30,20,10,0.5)'; ctx.fillRect(0, 16, T, 4); ctx.fillRect(0, T - 20, T, 4);
    strokes(ctx, rng, T, T, { count: 120, colors: ['#5a3020', '#2a1a10'], len: [6, 30], width: [2, 6], alpha: [0.15, 0.4] });
  });
  // 4 jars: amber and red preserves behind glass, tin lid on top, paper label.
  tile(4, () => {
    for (let i = 0; i < 4; i++) {
      const col = ['#c9661c', '#8e1e22', '#d6a02a', '#6d2a4a'][i] as string;
      const g = ctx.createLinearGradient(i * 64, 0, i * 64 + 64, 0);
      g.addColorStop(0, shade(col, -0.5)); g.addColorStop(0.3, shade(col, 0.25)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.55));
      ctx.fillStyle = g; ctx.fillRect(i * 64, 0, 64, T);
    }
    ctx.fillStyle = '#b8b09a'; ctx.fillRect(0, 0, T, 40);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 40, T, 6);
    ctx.fillStyle = '#e8dcbc'; ctx.fillRect(0, 120, T, 56);
    ctx.fillStyle = '#4a2a1a'; for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 14, 140, 36, 6);
    ctx.fillStyle = 'rgba(255,250,230,0.35)'; for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 14, 50, 6, 200);
  });
  // 5 books: spines in muted cloth colors, gold bands.
  tile(5, () => {
    let x = 0;
    while (x < T) {
      const w = rng.range(14, 30);
      const col = rng.pick(['#6e2019', '#2d4a5a', '#4d5326', '#8b4a35', '#2a2420', '#7b6a32', '#5a3a5a', '#c9b48a']);
      ctx.fillStyle = col; ctx.fillRect(x, rng.range(0, 30), w - 2, T);
      ctx.fillStyle = 'rgba(214,170,80,0.8)'; ctx.fillRect(x + 2, 60, w - 6, 4); ctx.fillRect(x + 2, 190, w - 6, 4);
      ctx.fillStyle = shade(col, 0.3); ctx.fillRect(x + w / 2 - 2, 90, 3, 70);
      ctx.fillStyle = '#100c0a'; ctx.fillRect(x + w - 2, 0, 2, T);
      x += w;
    }
  });
  // 6 radio: walnut case, cloth grille, dial with a scale, two knobs.
  tile(6, () => {
    fill('#5a3420');
    strokes(ctx, rng, T, T, { count: 200, colors: ['#3a2010', '#7a4a2a'], len: [30, 120], width: [1, 4], alpha: [0.2, 0.5], angle: 0, spread: 0.05 });
    ctx.fillStyle = '#c4a874'; ctx.fillRect(20, 24, 136, 150);
    ctx.strokeStyle = '#7a6040'; ctx.lineWidth = 3; for (let y = 34; y < 170; y += 10) { ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(152, y); ctx.stroke(); }
    ctx.fillStyle = '#e8d8a8'; ctx.fillRect(170, 30, 66, 90);
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(203, 110, 50, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    ctx.strokeStyle = '#b8261c'; ctx.beginPath(); ctx.moveTo(203, 110); ctx.lineTo(220, 60); ctx.stroke();
    for (const x of [186, 222]) blob(x, 190, 16, 16, '#2a2018');
    ctx.fillStyle = '#c9a050'; ctx.fillRect(20, 210, 216, 8);
  });
  // 7 TV: grey plastic bezel, dark curved screen with a dull reflection, a crack.
  tile(7, () => {
    fill('#6d6a62');
    const g = ctx.createRadialGradient(100, 110, 10, 110, 120, 120);
    g.addColorStop(0, '#4a5a58'); g.addColorStop(1, '#141a1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(18, 22, 176, 196, 26); ctx.fill();
    ctx.fillStyle = 'rgba(200,220,210,0.18)'; ctx.beginPath(); ctx.ellipse(70, 70, 40, 18, -0.5, 0, Math.PI * 2); ctx.fill();
    crack(ctx, rng, 140, 80, 8, 14, 2.2, 2);
    for (let y = 40; y < 200; y += 26) blob(224, y, 9, 9, '#2a2622');
  });
  // 8 plaid flannel.
  tile(8, () => {
    fill('#8e2a20');
    for (let i = 0; i < T; i += 64) { ctx.fillStyle = 'rgba(20,16,30,0.55)'; ctx.fillRect(i, 0, 24, T); ctx.fillRect(0, i, T, 24); ctx.fillStyle = 'rgba(240,210,150,0.35)'; ctx.fillRect(i + 40, 0, 4, T); ctx.fillRect(0, i + 40, T, 4); }
    strokes(ctx, rng, T, T, { count: 500, colors: ['#3a1a14', '#c86a4a'], len: [4, 14], width: [1, 2], alpha: [0.15, 0.35] });
  });
  // 9 knit / denim: mid blue with ribs.
  tile(9, () => {
    fill('#3e5a78');
    ctx.strokeStyle = 'rgba(10,20,40,0.35)'; ctx.lineWidth = 3; for (let x = 0; x < T; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, T); ctx.stroke(); }
    strokes(ctx, rng, T, T, { count: 600, colors: ['#8aa0b8', '#1e2c3e'], len: [4, 18], width: [1, 3], alpha: [0.15, 0.4], angle: Math.PI / 2, spread: 0.2 });
    mottle(ctx, rng, T, T, 6, ['#d8d0b8'], [20, 50], 0.25);
  });
  // 10 newspaper: columns of grey text and a headline.
  tile(10, () => {
    fill('#d8ceb0');
    ctx.fillStyle = '#1a1612'; ctx.fillRect(14, 14, 228, 26);
    ctx.fillStyle = 'rgba(30,26,22,0.6)';
    for (let col = 0; col < 3; col++) for (let y = 54; y < 240; y += 9) ctx.fillRect(14 + col * 78, y, rng.range(40, 70), 4);
    ctx.fillStyle = '#5a5246'; ctx.fillRect(96, 60, 70, 60);
    mottle(ctx, rng, T, T, 8, ['#7a6a48', '#3a3020'], [20, 60], 0.35);
  });
  // 11 plain: near-white painted surface for vertex tints (gnome, candles, barrels, frames).
  tile(11, () => {
    fill('#e6ded0');
    strokes(ctx, rng, T, T, { count: 300, colors: ['#ffffff', '#b8ae9c', '#cfc4b0'], len: [10, 50], width: [2, 6], alpha: [0.15, 0.4] });
    mottle(ctx, rng, T, T, 6, ['#8a7e6a'], [30, 70], 0.25);
  });
  // 12 roofing felt: tarred, dark, with battens and a few torn patches.
  tile(12, () => {
    fill('#33302c');
    strokes(ctx, rng, T, T, { count: 500, colors: ['#4a4640', '#1e1c1a', '#5a5248'], len: [10, 50], width: [2, 6], alpha: [0.2, 0.5], angle: 0, spread: 0.1 });
    for (let x = 32; x < T; x += 64) { ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x, 0, 8, T); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + 8, 0, 3, T); }
    mottle(ctx, rng, T, T, 5, ['#4d5326', '#6a6a50'], [20, 50], 0.45);
  });
  // 13 window: left half intact (cross frame, checked curtains), right half broken (dark, shards).
  tile(13, () => {
    for (const h of [0, 1]) {
      const x0 = h * 128;
      ctx.fillStyle = '#e8e2d2'; ctx.fillRect(x0, 0, 128, T);
      ctx.fillStyle = h ? '#0e1210' : '#2a3a38'; ctx.fillRect(x0 + 12, 12, 104, 232);
      if (!h) {
        for (const s of [0, 1]) {
          const cx = x0 + 12 + s * 70;
          for (let y = 12; y < 244; y += 12) for (let x = 0; x < 34; x += 12) { ctx.fillStyle = ((x + y) / 12) % 2 ? '#c84a3a' : '#f0e6d0'; ctx.fillRect(cx + x, y, 12, 12); }
        }
        ctx.fillStyle = 'rgba(255,240,200,0.25)'; ctx.fillRect(x0 + 20, 20, 30, 60);
      } else {
        ctx.fillStyle = 'rgba(160,190,190,0.5)';
        for (const [a, b2, c2] of [[[12, 12], [60, 12], [24, 70]], [[116, 244], [116, 170], [80, 244]], [[116, 12], [116, 60], [90, 12]]] as const) { ctx.beginPath(); ctx.moveTo(x0 + a[0], a[1]); ctx.lineTo(x0 + b2[0], b2[1]); ctx.lineTo(x0 + c2[0], c2[1]); ctx.fill(); }
        ctx.fillStyle = '#7a5040'; ctx.fillRect(x0 + 20, 150, 30, 94);
      }
      ctx.fillStyle = '#e8e2d2'; ctx.fillRect(x0 + 60, 0, 8, T); ctx.fillRect(x0, 120, 128, 8);
    }
  });
  // 14 light planks (vertical boards) for green, white, brown and blue Lauben.
  tile(14, () => {
    fill('#dcd6c8');
    for (let x = 0; x < T; x += 32) { ctx.fillStyle = shade('#dcd6c8', rng.range(-0.15, 0.08)); ctx.fillRect(x, 0, 30, T); ctx.fillStyle = 'rgba(20,16,12,0.7)'; ctx.fillRect(x + 30, 0, 2, T); }
    strokes(ctx, rng, T, T, { count: 400, colors: ['#8a7e6a', '#ffffff', '#5a4a3a'], len: [20, 90], width: [1, 3], alpha: [0.1, 0.35], angle: Math.PI / 2, spread: 0.05 });
    mottle(ctx, rng, T, T, 5, ['#4d5326', '#3a2a1c'], [20, 60], 0.35);
    const g = ctx.createLinearGradient(0, T * 0.7, 0, T); g.addColorStop(0, 'rgba(40,30,20,0)'); g.addColorStop(1, 'rgba(40,30,20,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, T, T);
  });
  // 15 soil: dark crumbly earth with furrows.
  tile(15, () => {
    fill('#3a2a1c');
    for (let y = 16; y < T; y += 32) { ctx.fillStyle = 'rgba(15,10,6,0.55)'; ctx.fillRect(0, y, T, 6); ctx.fillStyle = 'rgba(120,90,60,0.35)'; ctx.fillRect(0, y - 6, T, 4); }
    strokes(ctx, rng, T, T, { count: 500, colors: ['#5a4430', '#1e140c', '#6a5a3a'], len: [3, 10], width: [2, 4], alpha: [0.3, 0.6] });
  });
  flatten(ctx, T * 4, T * 4, o.flatten * 0.5);
  return { map: toTexture(c, false, o.anisotropy) };
}

/** Market tarps, four bands from the top: red/white stripes, blue, green, ochre. The right half is torn (alpha holes). */
export function paintStallTarp(o: PaintOptions): Surface {
  const W = 512;
  const B = 128;
  const rng = new Rng(317);
  const [c, ctx] = canvas(W, B * 4);
  const bases = ['#a8322a', '#3e5e86', '#4f6e3a', '#c48a2a'];
  bases.forEach((base, i) => {
    const y = i * B;
    ctx.fillStyle = base; ctx.fillRect(0, y, W, B);
    if (i === 0) for (let x = 32; x < W; x += 64) { ctx.fillStyle = '#e6d6b4'; ctx.fillRect(x, y, 32, B); }
    if (i === 2) { ctx.fillStyle = 'rgba(20,30,10,0.25)'; for (let x = 0; x < W; x += 48) ctx.fillRect(x, y, 3, B); }
    const g = ctx.createLinearGradient(0, y, 0, y + B);
    g.addColorStop(0, 'rgba(255,240,210,0.12)'); g.addColorStop(0.6, 'rgba(30,22,18,0.1)'); g.addColorStop(1, 'rgba(30,22,18,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, y, W, B);
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, B); ctx.clip();
    for (let k = 0; k < 60; k++) { const x = rng.range(0, W); const yy = y + rng.range(0, B); ctx.strokeStyle = rng.pick([shade(base, 0.3), shade(base, -0.4), '#2a2018']); ctx.globalAlpha = rng.range(0.1, 0.3); ctx.lineWidth = rng.range(2, 6); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + rng.range(-30, 30), yy + rng.range(-8, 8)); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (let k = 0; k < 4; k++) { const gx = rng.range(0, W); const gy = y + rng.range(10, B - 10); const r = rng.range(14, 34); const mg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); mg.addColorStop(0, 'rgba(50,56,30,0.45)'); mg.addColorStop(1, 'rgba(50,56,30,0)'); ctx.fillStyle = mg; ctx.fillRect(gx - r, gy - r, r * 2, r * 2); }
    // Seam and grommets along the band edge.
    ctx.fillStyle = 'rgba(20,14,10,0.5)'; ctx.fillRect(0, y + B - 8, W, 3);
    ctx.fillStyle = '#b8b0a0'; for (let x = 20; x < W; x += 60) { ctx.beginPath(); ctx.arc(x, y + B - 14, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // Tears in the right half: jagged holes with frayed dark edges.
    ctx.save(); ctx.beginPath(); ctx.rect(W / 2, y + 4, W / 2, B - 8); ctx.clip();
    for (let k = 0; k < 3; k++) {
      const cx = W / 2 + rng.range(30, W / 2 - 30);
      const cy = y + rng.range(25, B - 25);
      const pts: Array<[number, number]> = [];
      for (let a = 0; a < 12; a++) { const r = rng.range(8, 30) * (a % 2 ? 0.5 : 1); const ang = (a / 12) * Math.PI * 2; pts.push([cx + Math.cos(ang) * r * 1.6, cy + Math.sin(ang) * r]); }
      ctx.strokeStyle = 'rgba(25,18,12,0.8)'; ctx.lineWidth = 5; ctx.beginPath(); pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.stroke();
      ctx.globalCompositeOperation = 'destination-out'; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  });
  return { map: toTexture(c, false, o.anisotropy) };
}

// ---------------------------------------------------------------- plants (M11c)

/**
 * Plant card atlas, 4 x 2 cells of 256 px, alpha tested. Row 0: leaf cluster, pinnate frond, big
 * leaves (jungle undergrowth), reeds with cattails. Row 1: flower patches (poppies, yellow, white,
 * purple). Light, fairly neutral greens: vertex tints shift species and season. Cell order: `PLANT_CELL`.
 */
export const PLANT_CELL = { leaves: 0, frond: 1, bigLeaf: 2, reeds: 3, poppy: 4, yellow: 5, white: 6, purple: 7 } as const;
export function paintPlants(): Texture {
  const S = 256;
  const rng = new Rng(171);
  const [c, ctx] = canvas(S * 4, S * 2);
  const greens = ['#7a9a3a', '#5f8232', '#9aae48', '#4d6c2c', '#86a040', '#b4b452'];
  const cell = (i: number, draw: () => void): void => {
    ctx.save();
    ctx.translate((i % 4) * S, Math.floor(i / 4) * S);
    ctx.beginPath();
    ctx.rect(2, 2, S - 4, S - 4);
    ctx.clip();
    draw();
    ctx.restore();
  };
  const leaf = (x: number, y: number, r: number, a: number, col: string, w = 0.5): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5, r * w, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  // Leaf cluster: lumpy round mass of small leaves, darker inside, ragged outline.
  cell(PLANT_CELL.leaves, () => {
    for (let i = 0; i < 420; i++) {
      const a = rng.range(0, Math.PI * 2);
      const rr = Math.sqrt(rng.next()) * (98 + 18 * Math.sin(a * 5 + 1));
      const x = S / 2 + Math.cos(a) * rr;
      const y = S / 2 + Math.sin(a) * rr * 0.92;
      const t = i / 420;
      leaf(x, y, rng.range(10, 18), a + Math.PI / 2 + rng.range(-0.8, 0.8), shade(rng.pick(greens), -0.55 + t * 0.7 + rng.range(-0.12, 0.12)));
    }
  });
  // Pinnate frond (palm, tree fern, fern): rib from the bottom, leaflets tapering to the tip.
  cell(PLANT_CELL.frond, () => {
    ctx.lineCap = 'round';
    {
      const x0 = S / 2;
      for (let i = 0; i < 34; i++) {
        const t = i / 34;
        const y = S - 8 - t * (S - 20);
        const len = (1 - t) ** 0.7 * 92 * (0.3 + 0.7 * Math.min(1, t * 5));
        for (const s of [-1, 1]) {
          ctx.strokeStyle = shade(rng.pick(greens), rng.range(-0.35, 0.05));
          ctx.lineWidth = rng.range(5, 8) * (1 - t * 0.5);
          ctx.beginPath();
          ctx.moveTo(x0 + Math.sin(t * 3) * 6, y);
          ctx.quadraticCurveTo(x0 + s * len * 0.5, y - 6, x0 + s * len, y + 10 + rng.range(-4, 6));
          ctx.stroke();
        }
      }
      ctx.strokeStyle = '#4a5a24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, S - 4);
      ctx.quadraticCurveTo(x0 + 8, S / 2, x0, 10);
      ctx.stroke();
    }
  });
  // Big leaves (elephant ear, butterbur): five broad hearts on stems fanning from the bottom.
  cell(PLANT_CELL.bigLeaf, () => {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42 + rng.range(-0.1, 0.1);
      const r = rng.range(70, 95);
      const x = S / 2 + Math.cos(a) * (r * 0.95);
      const y = S - 6 + Math.sin(a) * (r * 1.1);
      ctx.strokeStyle = '#5a6a2a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(S / 2, S - 4);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = shade(rng.pick(greens), rng.range(-0.3, 0.05));
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.bezierCurveTo(-r * 0.75, -r * 0.05, -r * 0.45, -r * 0.85, 0, -r * 0.95);
      ctx.bezierCurveTo(r * 0.45, -r * 0.85, r * 0.75, -r * 0.05, 0, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,240,170,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(0, -r * 0.85);
      for (let v = 1; v < 5; v++) for (const s of [-1, 1]) {
        ctx.moveTo(0, -r * 0.18 * v);
        ctx.lineTo(s * r * 0.36, -r * 0.18 * v - r * 0.14);
      }
      ctx.stroke();
      ctx.restore();
    }
  });
  // Reeds: thin blades and a few brown cattails.
  cell(PLANT_CELL.reeds, () => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = S / 2 + rng.range(-70, 70);
      const h = rng.range(140, 245);
      const bend = rng.range(-30, 30);
      ctx.strokeStyle = shade(rng.pick(['#8a9a48', '#6f8238', '#a8a454', '#94884a']), rng.range(-0.3, 0.1));
      ctx.lineWidth = rng.range(2.5, 5);
      ctx.beginPath();
      ctx.moveTo(x, S - 2);
      ctx.quadraticCurveTo(x + bend * 0.2, S - h * 0.6, x + bend, S - h);
      ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const x = S / 2 + rng.range(-60, 60);
      const top = rng.range(18, 70);
      ctx.strokeStyle = '#6a7036';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, S - 2);
      ctx.lineTo(x + rng.range(-4, 4), top - 8);
      ctx.stroke();
      ctx.fillStyle = shade('#5a3a1e', rng.range(-0.2, 0.15));
      ctx.beginPath();
      ctx.ellipse(x, top + 20, 7, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // Flower patches: a tuft of grass with heads spread over the upper part of the card.
  const meadow = (heads: (x: number, y: number, r: number) => void, n: number): void => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      const x = S / 2 + rng.range(-110, 110) * Math.sqrt(rng.next());
      const h = rng.range(50, 170);
      ctx.strokeStyle = shade(rng.pick(greens), rng.range(-0.4, 0));
      ctx.lineWidth = rng.range(2.5, 5);
      ctx.beginPath();
      ctx.moveTo(x, S - 2);
      ctx.quadraticCurveTo(x, S - h * 0.6, x + rng.range(-24, 24), S - h);
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const x = S / 2 + rng.range(-105, 105);
      const y = rng.range(26, S - 60);
      ctx.strokeStyle = '#4f6a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + rng.range(-8, 8), S - 2);
      ctx.lineTo(x, y);
      ctx.stroke();
      heads(x, y, rng.range(0.8, 1.2));
    }
  };
  const blossom = (x: number, y: number, r: number, petals: number, col: string, eye: string, er: number): void => {
    for (let k = 0; k < petals; k++) leaf(x, y, r, (k / petals) * Math.PI * 2, shade(col, rng.range(-0.15, 0.1)), 0.42);
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(x, y, er, 0, Math.PI * 2);
    ctx.fill();
  };
  cell(PLANT_CELL.poppy, () => meadow((x, y, s) => blossom(x, y, 15 * s, 4, '#d8261a', '#1a1010', 4 * s), 30));
  cell(PLANT_CELL.yellow, () => meadow((x, y, s) => {
    for (let k = 0; k < 4; k++) blossom(x + rng.range(-9, 9), y + rng.range(-9, 9), 7 * s, 5, '#f2c41e', '#c07a10', 2.5);
  }, 26));
  cell(PLANT_CELL.white, () => meadow((x, y, s) => blossom(x, y, 12 * s, 10, '#f4f0e4', '#e8b420', 4.5 * s), 34));
  cell(PLANT_CELL.purple, () => meadow((x, y, s) => {
    // Lupine and lavender spikes: stacked buds narrowing to the top.
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = shade(rng.pick(['#8a4ac0', '#a45ad0', '#6a3aa0', '#c070c8']), rng.range(-0.15, 0.15));
      ctx.beginPath();
      ctx.ellipse(x + rng.range(-2, 2), y + 26 - k * 6 * s, (7 - k * 0.55) * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 24));
  return toTexture(c, false);
}

/** Dense foliage surface (bush cores, hedges, tree crowns): mottled leaves, tiling, no alpha. */
export function paintFoliage(): Texture {
  const S = 256;
  const rng = new Rng(181);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#3c5428';
  ctx.fillRect(0, 0, S, S);
  const greens = ['#6f8e36', '#56762e', '#8aa040', '#41602a', '#a0a848', '#2f4620'];
  for (let i = 0; i < 900; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const r = rng.range(6, 13);
    const a = rng.range(0, Math.PI * 2);
    const col = shade(rng.pick(greens), rng.range(-0.25, 0.15));
    wrapped(S, S, x, y, r, (px, py) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.5, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
  mottle(ctx, rng, S, S, 14, ['#1c2a12', '#c0c060'], [30, 60], 0.18);
  return toTexture(c);
}

/** Bark: vertical furrows on grey-brown, tiling. Birch and pine come from vertex tints. */
export function paintBark(): Texture {
  const W = 128;
  const H = 256;
  const rng = new Rng(191);
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#7a6a5a';
  ctx.fillRect(0, 0, W, H);
  strokes(ctx, rng, W, H, { count: 260, colors: ['#4a3c30', '#9a8a78', '#5e4e40', '#2e241c'], len: [20, 70], width: [2, 6], alpha: [0.4, 0.9], angle: Math.PI / 2, spread: 0.15 });
  mottle(ctx, rng, W, H, 10, ['#5a7040', '#2a2018'], [10, 30], 0.25);
  return toTexture(c);
}

// ---------------------------------------------------------------- M11d landmarks

/** Slate roof (Rathaus, church spires): dark blue-grey scale shingles with a few moss runs. */
export function paintSlate(o: PaintOptions): Surface {
  const S = 512;
  const rng = new Rng(97);
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#1c2026';
  ctx.fillRect(0, 0, S, S);
  const rows = 20;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -10 : 0;
    while (x < S) {
      const w = rng.range(16, 22);
      ctx.fillStyle = shade(rng.pick(['#3a414b', '#333a43', '#434a54', '#2d333b']), rng.range(-0.15, 0.12));
      ctx.beginPath();
      ctx.roundRect(x + 1, r * rh + 1, w - 2, rh - 1, [0, 0, 6, 6]);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 1, r * rh + rh - 4, w - 2, 3);
      x += w;
    }
  }
  mottle(ctx, rng, S, S, 12, ['#3d4a32', '#15181c'], [20, 70], 0.3);
  flatten(ctx, S, S, o.flatten * 0.6);
  return { map: toTexture(c, true, o.anisotropy) };
}

/** Tower clock: cream dial with Roman ticks and black hands; the dial glows faintly at night. */
export function paintClock(): EmissiveSurface {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const [e, ectx] = canvas(S, S);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S, S);
  for (const [k, dial] of [[ctx, '#efe2b8'], [ectx, '#a08850']] as Array<[Ctx, string]>) {
    k.fillStyle = '#2a2018';
    k.beginPath();
    k.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    k.fill();
    k.fillStyle = dial;
    k.beginPath();
    k.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2);
    k.fill();
  }
  ctx.strokeStyle = '#1a1410';
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 ? 3 : 6;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.sin(a) * 42, S / 2 - Math.cos(a) * 42);
    ctx.lineTo(S / 2 + Math.sin(a) * 52, S / 2 - Math.cos(a) * 52);
    ctx.stroke();
  }
  // Stopped at ten to five.
  for (const [a, len, w] of [[-Math.PI / 3, 40, 4], [Math.PI * 0.95, 28, 6]] as const) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2);
    ctx.lineTo(S / 2 + Math.sin(a) * len, S / 2 - Math.cos(a) * len);
    ctx.stroke();
  }
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}

/** S-Bahn roundel: green disc, white S. */
export function paintSRoundel(): EmissiveSurface {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const [e, ectx] = canvas(S, S);
  for (const [k, disc, letter] of [[ctx, '#0b7a45', '#f4f4ee'], [ectx, '#1d6a40', '#ffffff']] as Array<[Ctx, string, string]>) {
    k.fillStyle = '#000';
    k.fillRect(0, 0, S, S);
    k.fillStyle = disc;
    k.beginPath();
    k.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    k.fill();
    k.fillStyle = letter;
    k.font = 'bold 100px Arial, sans-serif';
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    k.fillText('S', S / 2, S / 2 + 6);
  }
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}

/** Lettering on a wall band: `fg` letters on `bg`, sans serif, a few dead letters when `dead`. */
export function paintLettering(text: string, bg: string, fg: string, glow: number, dead = 0): EmissiveSurface {
  const W = 1024;
  const H = 96;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  const g = Math.round(255 * glow);
  for (const [k, color] of [[ctx, fg], [ectx, `rgb(${g},${g},${g})`]] as Array<[Ctx, string]>) {
    k.fillStyle = color;
    k.font = 'bold 72px Arial, sans-serif';
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    k.fillText(text, W / 2, H / 2 + 4, W - 24);
  }
  if (dead) {
    ectx.fillStyle = 'rgba(0,0,0,0.85)';
    ectx.fillRect(W * dead, 0, W * 0.07, H);
  }
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}

/**
 * M20 station name plate (2D `signTex`): BVG-blue enamel with a white rim and white lettering, a little
 * chipped. 512 × 96 for a 2.8 × 0.52 m plate; the emissive map lifts the letters in the dark tunnel.
 */
export function paintStationSign(text: string): EmissiveSurface {
  const W = 512, H = 96;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = '#ead9c0';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1d3a8a';
  ctx.fillRect(4, 4, W - 8, H - 8);
  ctx.strokeStyle = '#f2f2ee';
  ctx.lineWidth = 3;
  ctx.strokeRect(11, 11, W - 22, H - 22);
  ectx.fillStyle = '#101418';
  ectx.fillRect(0, 0, W, H);
  for (const [k, color] of [[ctx, '#ffffff'], [ectx, '#d8d8d8']] as Array<[Ctx, string]>) {
    k.fillStyle = color;
    k.font = 'bold 54px Arial, Helvetica, sans-serif';
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    k.fillText(text, W / 2, H / 2 + 3, W - 48);
  }
  // Chipped enamel: dark flecks along the rim.
  const rng = new Rng(text.length * 97 + 13);
  ctx.fillStyle = 'rgba(24,18,14,0.75)';
  for (let i = 0; i < 26; i++) {
    const edge = rng.next() < 0.5, x = edge ? rng.range(0, W) : rng.next() < 0.5 ? rng.range(0, 14) : rng.range(W - 14, W), y = edge ? (rng.next() < 0.5 ? rng.range(0, 12) : rng.range(H - 12, H)) : rng.range(0, H);
    ctx.fillRect(x, y, rng.range(2, 9), rng.range(2, 6));
  }
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false) };
}

/** M11d water: soft ripples as a tiling normal map (scrolled in `World.update`). */
export function paintWaterNormal(): Texture {
  const S = 256;
  const rng = new Rng(131);
  const [, ctx] = canvas(S, S);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  // Overlapping soft blobs, wrapped at the edges so the map tiles.
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(6, 26), v = rng.next() < 0.5 ? 255 : 0;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.16)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = normalFromHeight(ctx, S, S, 1.6);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------- M20 camp stations

/** Chain-link mesh on a transparent sheet: one diamond per tile, tiles seamlessly (alpha-tested). */
export function paintChainLink(): Texture {
  const S = 64;
  const [c, ctx] = canvas(S, S);
  ctx.lineCap = 'round';
  for (const [col, w] of [['rgba(30,26,22,0.9)', 5], ['#a8aaa4', 2.5]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    for (const o of [-S, 0, S]) {
      ctx.beginPath(); ctx.moveTo(o, 0); ctx.lineTo(o + S, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(o + S, 0); ctx.lineTo(o, S); ctx.stroke();
    }
  }
  return toTexture(c, true);
}

/** A cell of an atlas in UV space: [u0, v0, u1, v1] (v up, the canvas is flipped on upload). */
export type AtlasCell = readonly [number, number, number, number];

/**
 * Camp station atlas (`camp-stations.ts`): name boards, the build site sign, neon letters, the bear
 * banner, screens, the map table, notes, the tool wall, cabinets, lockers and shelf goods. One lit
 * material with an emissive map, so all decals of a station are one draw call.
 * `names`: station id → German name for the boards.
 */
export function paintCampAtlas(names: Readonly<Record<string, string>>): EmissiveSurface & { cells: Record<string, AtlasCell> } {
  const W = 2048, H = 1024;
  const [c, ctx] = canvas(W, H);
  const [e, ectx] = canvas(W, H);
  ctx.fillStyle = '#2a2420';
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  const rng = new Rng(2020);
  const cells: Record<string, AtlasCell> = {};
  type Painter = (x: number, y: number, w: number, h: number) => void;
  const list: Array<[string, number, number, Painter]> = [];
  const add = (name: string, w: number, h: number, p: Painter): void => { list.push([name, w, h, p]); };

  /** Text squeezed to fit a width. */
  const text = (k: Ctx, s: string, x: number, y: number, maxW: number, size: number, color: string, font = 'Arial', weight = 'bold'): void => {
    k.font = `${weight} ${size}px ${font}, sans-serif`;
    const f = Math.min(1, maxW / k.measureText(s).width);
    k.save();
    k.translate(x, y);
    k.scale(f, 1);
    k.fillStyle = color;
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    k.fillText(s, 0, 0);
    k.restore();
  };
  const grime = (x: number, y: number, w: number, h: number, amount = 1): void => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    mottle(ctx, rng, w, h, Math.round(6 + (w * h) / 6000), ['#2a2018', '#4a3a28', '#6a4a30'], [8, 40], 0.18 * amount);
    strokes(ctx, rng, w, h, { count: Math.round((w * h) / 300), colors: ['#1a1410', '#e8dcc0'], len: [3, 16], width: [1, 2], alpha: [0.04, 0.14 * amount] });
    ctx.restore();
  };
  const screws = (x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = '#8a8478';
    for (const [sx, sy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]] as const) { ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill(); }
  };
  const both = (draw: (k: Ctx, emissive: boolean) => void): void => { draw(ctx, false); draw(ectx, true); };

  // Name boards: each station its own sign (style bible U-Bahn palette). [board, letters, font, glow]
  const BOARD: Record<string, [string, string, string, number]> = {
    markt: ['#33504c', '#fac997', 'Georgia', 0.35],
    laz: ['#e8e4d6', '#a32a22', 'Arial', 0.25],
    imbiss: ['#ed9e25', '#2a1c12', 'Arial', 0.12],
    kom: ['#5c5a34', '#f0e2b8', 'Georgia', 0.3],
    zeug: ['#7d322d', '#fac997', 'Georgia', 0.35],
    hack: ['#1a1d22', '#6dff9a', 'Courier New', 0.9],
    exer: ['#6b4a30', '#f0e2c0', 'Arial', 0.3],
  };
  for (const [id, name] of Object.entries(names)) {
    const [bg, fg, font, glow] = BOARD[id] ?? ['#33504c', '#fac997', 'Arial', 0.3];
    add(`name_${id}`, 512, 112, (x, y, w, h) => {
      ctx.fillStyle = '#16110f';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = bg;
      ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
      if (id === 'exer') for (let k = 1; k < 3; k++) { ctx.fillStyle = 'rgba(20,12,8,0.5)'; ctx.fillRect(x + 5, y + (k * h) / 3, w - 10, 3); }
      ctx.strokeStyle = shade(fg, -0.2, 0.55);
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 13, y + 13, w - 26, h - 26);
      grime(x + 5, y + 5, w - 10, h - 10);
      screws(x, y, w, h);
      const left = id === 'laz' ? 70 : 0;
      if (id === 'laz') { ctx.fillStyle = '#a32a22'; ctx.fillRect(x + 30, y + 44, 44, 24); ctx.fillRect(x + 40, y + 34, 24, 44); }
      const g = Math.round(255 * glow);
      both((k, em) => text(k, name, x + w / 2 + left / 2, y + h / 2 + 3, w - 60 - left, 70, em ? `rgb(${g},${g},${g})` : fg, font));
    });
  }
  add('bauplatz', 256, 128, (x, y, w, h) => {
    ctx.fillStyle = '#f2efe4';
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.rect(x + 16, y + 16, w - 32, h - 32);
    ctx.clip('evenodd');
    ctx.fillStyle = '#c0281e';
    for (let k = -h; k < w; k += 28) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + 14, y + h); ctx.lineTo(x + k + 14 + h, y); ctx.lineTo(x + k + h, y); ctx.fill(); }
    ctx.restore();
    both((k, em) => text(k, 'Bauplatz', x + w / 2, y + h / 2 + 2, w - 44, 48, em ? '#202020' : '#16110f'));
    grime(x, y, w, h, 0.8);
  });
  /** Neon letters: dark backing, colored glow, a pale tube core; the emissive map carries the light. */
  const neon = (s: string, color: string, size: number, font = 'Arial'): Painter => (x, y, w, h) => {
    ctx.fillStyle = '#140d0b';
    ctx.fillRect(x, y, w, h);
    grime(x, y, w, h, 0.5);
    both((k, em) => {
      k.save();
      k.shadowColor = color;
      k.shadowBlur = 18;
      text(k, s, x + w / 2, y + h / 2 + 3, w - 30, size, color, font);
      k.shadowBlur = 6;
      text(k, s, x + w / 2, y + h / 2 + 3, w - 30, size, em ? shade(color, 0.35) : '#fff4dc', font, 'normal');
      k.restore();
    });
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  };
  add('neon_imbiss', 512, 128, neon('IMBISS', '#ffa040', 92));
  add('neon_offen', 256, 96, neon('OFFEN', '#ff4a5a', 64));
  add('neon_hack', 256, 96, neon('HACK', '#ff3fd0', 66, 'Courier New'));
  add('sign_zeug', 512, 128, (x, y, w, h) => {
    ctx.fillStyle = '#1e1612';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    // Marquee bulbs along the edges.
    both((k, em) => {
      k.fillStyle = em ? '#ffc070' : '#ffd890';
      for (let i = 0; i < 22; i++) for (const yy of [y + 10, y + h - 10]) { k.beginPath(); k.arc(x + 16 + (i * (w - 32)) / 21, yy, 4.5, 0, Math.PI * 2); k.fill(); }
      text(k, 'ZEUGHAUS', x + w / 2, y + h / 2 + 3, w - 60, 72, em ? '#ffb050' : '#ffcf7a', 'Georgia');
    });
  });
  add('cross', 128, 128, (x, y, w, h) => {
    ctx.fillStyle = '#ece8dc';
    ctx.fillRect(x, y, w, h);
    grime(x, y, w, h, 0.6);
    both((k, em) => { k.fillStyle = em ? '#401414' : '#b8261c'; k.fillRect(x + 44, y + 16, 40, 96); k.fillRect(x + 16, y + 44, 96, 40); });
  });
  add('target', 128, 128, (x, y, w, h) => {
    ctx.fillStyle = '#d8ccb0';
    ctx.fillRect(x, y, w, h);
    for (const [r, col] of [[60, '#16110f'], [57, '#ece2c8'], [46, '#b8261c'], [35, '#ece2c8'], [24, '#b8261c'], [12, '#ece2c8'], [5, '#16110f']] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#16110f';
    for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(x + w / 2 + rng.range(-40, 40), y + h / 2 + rng.range(-40, 40), 2.5, 0, Math.PI * 2); ctx.fill(); }
    grime(x, y, w, h, 0.7);
  });
  add('bear', 192, 256, (x, y, w, h) => {
    // Berlin flag (red, white, red) with the bear, frayed hem.
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#9e2a22';
    ctx.fillRect(x, y, w, h * 0.17);
    ctx.fillRect(x, y + h * 0.78, w, h * 0.22);
    ctx.save();
    ctx.translate(x + w / 2 - 54, y + h * 0.22);
    ctx.fillStyle = '#16110f';
    ctx.strokeStyle = '#16110f';
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(48, 62, 22, 33, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(66, 26, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(79, 30, 9, 6, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(59, 14, 4.5, 0, Math.PI * 2); ctx.arc(70, 12, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(60, 46); ctx.lineTo(82, 40); ctx.moveTo(58, 58); ctx.lineTo(80, 62); ctx.moveTo(38, 88); ctx.lineTo(30, 112); ctx.moveTo(56, 90); ctx.lineTo(64, 112); ctx.stroke();
    ctx.lineWidth = 2.5;
    for (const [cx, cy] of [[84, 38], [82, 62], [28, 116], [66, 116]] as const) for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx, cy + k * 3); ctx.lineTo(cx + 6, cy + k * 4 + 2); ctx.stroke(); }
    ctx.fillStyle = '#b8261c';
    ctx.beginPath(); ctx.ellipse(86, 34, 4, 2, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    grime(x, y, w, h, 1.3);
    ctx.fillStyle = '#2a2420';
    for (let k = 0; k < w; k += 10) ctx.fillRect(x + k, y + h - rng.range(2, 14), 6, 16);
  });
  add('map', 256, 192, (x, y, w, h) => {
    ctx.fillStyle = '#d8cfa8';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(120,100,70,0.5)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      ctx.beginPath(); ctx.moveTo(x + rng.range(0, w), y); ctx.lineTo(x + rng.range(0, w), y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + rng.range(0, h)); ctx.lineTo(x + w, y + rng.range(0, h)); ctx.stroke();
    }
    ctx.strokeStyle = '#4a7aa0';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x, y + h * 0.7); ctx.bezierCurveTo(x + w * 0.3, y + h * 0.5, x + w * 0.6, y + h * 0.9, x + w, y + h * 0.6); ctx.stroke();
    ctx.strokeStyle = '#b8261c';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 6]);
    ctx.beginPath(); ctx.moveTo(x + 30, y + 30); ctx.lineTo(x + 90, y + 80); ctx.lineTo(x + 150, y + 50); ctx.lineTo(x + 220, y + 140); ctx.stroke();
    ctx.setLineDash([]);
    both((k, em) => { k.fillStyle = em ? '#601010' : '#c0281e'; for (const [px, py] of [[30, 30], [90, 80], [150, 50], [220, 140]] as const) { k.beginPath(); k.arc(x + px, y + py, 7, 0, Math.PI * 2); k.fill(); } });
    grime(x, y, w, h, 0.9);
  });
  add('notes', 256, 192, (x, y, w, h) => {
    ctx.fillStyle = '#9a6a3a';
    ctx.fillRect(x, y, w, h);
    grime(x, y, w, h, 1.2);
    for (let k = 0; k < 11; k++) {
      ctx.save();
      ctx.translate(x + 22 + (k % 4) * 58 + rng.range(-6, 6), y + 26 + Math.floor(k / 4) * 56 + rng.range(-6, 6));
      ctx.rotate(rng.range(-0.2, 0.2));
      ctx.fillStyle = rng.pick(['#f4ecb8', '#f4a8b8', '#b8e0f4', '#cfe8b8', '#f2efe4']);
      ctx.fillRect(-4, -4, 46, 38);
      ctx.fillStyle = 'rgba(40,30,30,0.6)';
      for (let l = 0; l < 3; l++) ctx.fillRect(2, 6 + l * 9, rng.range(18, 36), 3);
      ctx.fillStyle = '#c0281e';
      ctx.beginPath(); ctx.arc(19, -1, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#b8261c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 41, y + 25); ctx.lineTo(x + 157, y + 81); ctx.lineTo(x + 215, y + 137); ctx.stroke();
  });
  add('tools', 384, 192, (x, y, w, h) => {
    ctx.fillStyle = '#4f4b42';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#26231e';
    for (let yy = 10; yy < h; yy += 16) for (let xx = 10; xx < w; xx += 16) ctx.fillRect(x + xx, y + yy, 3, 3);
    const tool = (tx: number, ty: number, draw: (k: Ctx) => void): void => {
      for (const [off, col] of [[3, '#1a1816'], [0, '#b8bcc0']] as const) { ctx.save(); ctx.translate(x + tx + off, y + ty + off); ctx.fillStyle = col; ctx.strokeStyle = col; draw(ctx); ctx.restore(); }
    };
    const wrench = (k: Ctx, len: number): void => { k.lineWidth = 8; k.beginPath(); k.moveTo(0, 0); k.lineTo(0, len); k.stroke(); k.beginPath(); k.arc(0, 0, 10, 0, Math.PI * 2); k.fill(); k.beginPath(); k.arc(0, len, 8, 0, Math.PI * 2); k.fill(); };
    for (let k = 0; k < 5; k++) tool(24 + k * 22, 30, (kk) => wrench(kk, 60 + k * 12));
    tool(150, 24, (k) => { k.fillRect(-5, 20, 10, 110); k.fillRect(-22, 8, 44, 22); });
    tool(205, 20, (k) => { k.beginPath(); k.moveTo(-18, 0); k.lineTo(18, 0); k.lineTo(10, 120); k.lineTo(-6, 120); k.fill(); k.fillRect(-14, 120, 26, 34); });
    tool(255, 24, (k) => { k.lineWidth = 7; k.beginPath(); k.moveTo(-10, 0); k.lineTo(6, 120); k.moveTo(10, 0); k.lineTo(-6, 120); k.stroke(); });
    tool(300, 20, (k) => { k.fillRect(-8, 0, 16, 50); k.fillRect(-3, 50, 6, 80); });
    tool(345, 30, (k) => { k.fillRect(-4, 0, 8, 120); k.beginPath(); k.moveTo(-4, 0); k.lineTo(-30, -6); k.lineTo(-30, 34); k.lineTo(-4, 26); k.fill(); });
    // Painted handles over the steel.
    ctx.fillStyle = '#8a5030';
    ctx.fillRect(x + 145, y + 44, 10, 110);
    ctx.fillRect(x + 191, y + 140, 26, 34);
    ctx.fillStyle = '#b8261c';
    ctx.fillRect(x + 292, y + 20, 16, 50);
    ctx.fillStyle = '#e0a020';
    ctx.fillRect(x, y + h - 14, w, 14);
    grime(x, y, w, h, 1);
  });
  add('rack', 128, 256, (x, y, w, h) => {
    ctx.fillStyle = '#16181c';
    ctx.fillRect(x, y, w, h);
    for (let k = 0; k < 9; k++) {
      const yy = y + 8 + k * 27;
      ctx.fillStyle = '#353b42';
      ctx.fillRect(x + 8, yy, w - 16, 22);
      ctx.fillStyle = '#12141a';
      for (let l = 0; l < 6; l++) ctx.fillRect(x + 64 + l * 9, yy + 5, 5, 12);
      for (let j = 0; j < 5; j++) {
        const on = rng.next() < 0.75, col = rng.pick(['#5f6', '#f55', '#fb4', '#4ff', '#5f6']);
        both((kk, em) => { kk.fillStyle = on ? col : em ? '#000' : '#333'; kk.fillRect(x + 14 + j * 9, yy + 8, 5, 5); });
      }
    }
  });
  /** Screen: dark glass, lines of text and a trace, scanlines; the emissive map lights it. */
  const screen = (col: string, bg: string): Painter => (x, y, w, h) => {
    const seed = rng.int(1000);
    both((k, em) => {
      const r = new Rng(seed);
      k.fillStyle = em ? shade(bg, -0.3) : bg;
      k.fillRect(x, y, w, h);
      k.fillStyle = col;
      for (let l = 0; l < 6; l++) k.fillRect(x + 12, y + 12 + l * 12, r.range(20, w - 30), 5);
      k.strokeStyle = col;
      k.lineWidth = 3;
      k.beginPath();
      for (let p = 0; p < 8; p++) k.lineTo(x + 60 + p * 8, y + 50 - r.range(0, 30));
      k.stroke();
      k.fillStyle = 'rgba(0,0,0,0.25)';
      for (let l = 0; l < h; l += 4) k.fillRect(x, y + l, w, 2);
    });
  };
  add('crt_g', 128, 96, screen('#6dff9a', '#0e2a1c'));
  add('crt_c', 128, 96, screen('#46f0ff', '#0c2430'));
  add('crt_a', 128, 96, screen('#ffc060', '#2a1a0c'));
  add('radio', 128, 96, (x, y, w, h) => {
    ctx.fillStyle = '#5e6440';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#23251c';
    ctx.fillRect(x + 8, y + 10, 50, 44);
    ctx.fillStyle = '#5a5c48';
    for (let l = 0; l < 6; l++) ctx.fillRect(x + 12, y + 14 + l * 7, 42, 3);
    both((k, em) => { k.fillStyle = em ? '#806a30' : '#e8dcb0'; k.beginPath(); k.arc(x + 92, y + 32, 20, 0, Math.PI * 2); k.fill(); });
    ctx.strokeStyle = '#16110f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 92, y + 32); ctx.lineTo(x + 104, y + 18); ctx.stroke();
    ctx.fillStyle = '#2a2c20';
    for (const kx of [20, 46, 72]) { ctx.beginPath(); ctx.arc(x + kx, y + 74, 8, 0, Math.PI * 2); ctx.fill(); }
    both((k, em) => { k.fillStyle = em ? '#ff3030' : '#ff5050'; k.beginPath(); k.arc(x + 108, y + 74, 6, 0, Math.PI * 2); k.fill(); });
    grime(x, y, w, h, 0.8);
  });
  add('windows', 256, 96, (x, y, w, h) => {
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(x, y, w, h);
    for (let k = 0; k < 4; k++) {
      const px = x + 8 + k * 62, lit = k !== 2;
      ctx.fillStyle = lit ? '#e8a050' : '#1a2024';
      ctx.fillRect(px, y + 10, 54, h - 20);
      if (lit) { ectx.fillStyle = k === 1 ? '#ffb060' : '#c07838'; ectx.fillRect(px, y + 10, 54, h - 20); }
      both((kk, em) => { kk.fillStyle = em ? '#000' : '#2a1e16'; kk.fillRect(px + 25, y + 10, 4, h - 20); kk.fillRect(px, y + 40, 54, 4); });
    }
    grime(x, y, w, h, 0.6);
  });
  add('meds', 192, 256, (x, y, w, h) => {
    ctx.fillStyle = '#e4e0d4';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#aab8bc';
    ctx.fillRect(x + 12, y + 46, w - 24, h - 60);
    for (let s = 0; s < 4; s++) {
      const sy = y + 50 + s * 48;
      ctx.fillStyle = '#d0ccc0';
      ctx.fillRect(x + 12, sy + 40, w - 24, 5);
      for (let k = 16; k < w - 24; k += rng.range(12, 20)) {
        const bh = rng.range(16, 34), bw = rng.range(8, 13);
        ctx.fillStyle = rng.pick(['#7a4a1e', '#f2efe4', '#3a6a9a', '#7a4a1e', '#c0c8b0', '#a8302a']);
        ctx.fillRect(x + k, sy + 40 - bh, bw, bh);
        ctx.fillRect(x + k + bw / 2 - 2, sy + 40 - bh - 5, 4, 5);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 12, y + 46, (w - 24) / 2 - 2, h - 60);
    ctx.fillStyle = '#e4e0d4';
    ctx.fillRect(x + w / 2 - 2, y + 46, 4, h - 60);
    ctx.fillStyle = '#b8261c';
    ctx.fillRect(x + w / 2 - 8, y + 8, 16, 32);
    ctx.fillRect(x + w / 2 - 16, y + 16, 32, 16);
    grime(x, y, w, h, 0.7);
  });
  add('lockers', 256, 192, (x, y, w, h) => {
    ctx.fillStyle = '#1e2220';
    ctx.fillRect(x, y, w, h);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const lx = x + 4 + k * 63, ly = y + 4 + r * 94;
      ctx.fillStyle = rng.pick(['#4e6a5c', '#5a6a6a', '#6a5040', '#4e6a5c', '#8f7c45']);
      ctx.fillRect(lx, ly, 59, 90);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let l = 0; l < 4; l++) ctx.fillRect(lx + 14, ly + 10 + l * 6, 30, 3);
      ctx.fillStyle = '#d8d0b0';
      ctx.fillRect(lx + 20, ly + 40, 18, 12);
      ctx.fillStyle = '#16110f';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(r * 4 + k + 1), lx + 29, ly + 50);
      ctx.fillStyle = '#c9a22a';
      ctx.fillRect(lx + 46, ly + 52, 7, 9);
    }
    grime(x, y, w, h, 1.1);
  });
  add('goods', 256, 128, (x, y, w, h) => {
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(x, y, w, h);
    for (const row of [0, 1]) {
      let k = x + 4;
      const base = y + 58 + row * 60;
      while (k < x + w - 14) {
        const t = rng.int(3), gw = t === 0 ? rng.range(26, 44) : rng.range(12, 20), gh = t === 0 ? rng.range(26, 46) : rng.range(18, 34);
        ctx.fillStyle = rng.pick(['#a54a3a', '#4a7a5a', '#c9a22a', '#6a8ac8', '#e8dcb4', '#7a4a2a', '#c97a2a']);
        ctx.fillRect(k, base - gh, gw, gh);
        if (t > 0) { ctx.fillStyle = '#e8e4d6'; ctx.fillRect(k, base - gh * 0.65, gw, gh * 0.3); }
        k += gw + 3;
      }
    }
    grime(x, y, w, h, 0.8);
  });
  add('chalk', 192, 128, (x, y, w, h) => {
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#26302a';
    ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    ctx.strokeStyle = 'rgba(235,230,210,0.85)';
    ctx.lineWidth = 3;
    for (let g = 0; g < 4; g++) for (let l = 0; l < 5; l++) {
      const gx = x + 24 + g * 40, gy = y + 60;
      ctx.beginPath();
      if (l < 4) { ctx.moveTo(gx + l * 6, gy); ctx.lineTo(gx + l * 6, gy + 34); } else { ctx.moveTo(gx - 4, gy + 30); ctx.lineTo(gx + 24, gy + 4); }
      ctx.stroke();
    }
    text(ctx, 'Drill', x + w / 2, y + 34, w - 40, 30, 'rgba(235,230,210,0.9)', 'Georgia', 'italic');
    grime(x, y, w, h, 0.6);
  });
  const stripes = (name: string, base: string, band: string): void => add(name, 256, 32, (x, y, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = band;
    for (let k = -h; k < w; k += 32) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + 16, y + h); ctx.lineTo(x + k + 16 + h, y); ctx.lineTo(x + k + h, y); ctx.fill(); }
    grime(x, y, w, h, 0.5);
  });
  stripes('stripes', '#f2efe4', '#c0281e');
  stripes('hazard', '#e0b020', '#16110f');
  add('forge', 128, 96, (x, y, w, h) => {
    both((k) => {
      const g = k.createRadialGradient(x + w / 2, y + h * 0.7, 4, x + w / 2, y + h * 0.7, w * 0.6);
      g.addColorStop(0, '#fff2a0');
      g.addColorStop(0.35, '#ff8a20');
      g.addColorStop(1, '#3a0a04');
      k.fillStyle = g;
      k.fillRect(x, y, w, h);
    });
  });
  add('dark', 32, 32, (x, y, w, h) => { ctx.fillStyle = '#0c0a09'; ctx.fillRect(x, y, w, h); });

  // Shelf packing, left to right, a new row when full; cells keep 2 px off their painted edge.
  let px = 0, py = 0, row = 0;
  for (const [name, w, h, paint] of list) {
    if (px + w > W) { px = 0; py += row; row = 0; }
    paint(px + 4, py + 4, w - 8, h - 8);
    cells[name] = [(px + 6) / W, 1 - (py + h - 6) / H, (px + w - 6) / W, 1 - (py + 6) / H];
    px += w;
    row = Math.max(row, h);
  }
  if (py + row > H) throw new Error('camp atlas overflow');
  return { map: toTexture(c, false), emissiveMap: toTexture(e, false), cells };
}
