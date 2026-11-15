// Painted-look textures, generated on 2D canvases at start (style bible: painterly fills with visible
// texture, wear at stress points, Köpenick palette). No image files: everything here is code.
import { CanvasTexture, DataTexture, NearestFilter, RedFormat, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
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

/** Pulls every pixel toward the mean color (the Comic look wants calmer surfaces). */
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

/** Toon ramp: hard light steps. */
export function toonRamp(steps: number[] = [70, 150, 255]): Texture {
  const data = new Uint8Array(steps);
  const t = new DataTexture(data, steps.length, 1, RedFormat);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

