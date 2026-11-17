// Painted-look textures, generated on 2D canvases at start (style bible: painterly fills with visible
// texture, wear at stress points, Köpenick palette). No image files: everything here is code.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { Rng } from '../sim/math';

type Ctx = CanvasRenderingContext2D;

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

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
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
function shade(hex: string, amount: number, alpha = 1): string {
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
function strokes(ctx: Ctx, rng: Rng, w: number, h: number, o: StrokeOpts): void {
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
function mottle(ctx: Ctx, rng: Rng, w: number, h: number, count: number, colors: string[], radius: [number, number], alpha: number): void {
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

function toTexture(c: HTMLCanvasElement, repeat = true, anisotropy = 4): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/** Pulls every pixel toward the mean color (calmer surfaces). */
function flatten(ctx: Ctx, w: number, h: number, amount: number): void {
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
export function paintTarp(o: PaintOptions): Surface {
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
