// M15 Mitte step 4, Potsdamer Platz south: Sony Center (final boss arena), Soundsystem stage, Bahntower,
// Kollhoff-Tower, Verkehrsturm, Implantat-Klinik, U Potsdamer Platz and the Mauerstücke, built in code from
// photos (Wikimedia, 2026-11-18) and the 2D boards (`js/mitte.js`: colours, stage, clinic, wall pieces).
// Cues below 5 m (what the game camera sees): Sony forum shop fronts under white canopies with LED strips,
// the paved forum with the magenta ring and the oval fountain, the low street pavilion with "SONY CENTER"
// and the lit marquee; stage speaker stacks, pulpit, equaliser banner, truss and generator; Bahntower lobby
// on round columns under the first slab with a cyan LED edge; Kollhoff granite arcade with lit shops under
// the dark red-brown brick pilasters; Verkehrsturm posts, clocks and signal lights; clinic counter, lit vials,
// implant chair, robot arm, cyan cross and sign; U stair with lit handrails, green railings and the
// pentagon sign; wall segments with paint and the bear stencil, striped barriers.
// High cues for the reveal shots: the tent roof (white membrane panels on magenta cables, steel ring, mast),
// the Bahntower's floor bands and slanted crown, the Kollhoff's stepped, serrated top.
//
// Cost: two new materials, one draw call each where in view: `signs` (one emissive canvas atlas, 1024 ×
// 1280: lettering, icons, neon strip colours and eight wall murals) and `membrane` (Sony tent fabric,
// double-sided, faint magenta glow). Triangles about: Sony 9k, stage 1.5k, Bahntower 1.5k, Kollhoff 3k,
// Verkehrsturm 0.7k, clinic 0.8k, U-Bahn 1k, Mauerstücke 0.5k. Lights (pooled spots): Sony 2, stage 2,
// Bahntower, Kollhoff, clinic and U-Bahn 1 each.
import {
  BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Matrix4, PlaneGeometry, Quaternion, RingGeometry, Shape, ShapeGeometry,
  SphereGeometry, TorusGeometry, Vector2, Vector3, type BufferGeometry, type Material,
} from 'three';
import { OPEN_PARTS, type Landmark } from '../data/map';
import { Rng } from '../sim/math';
import type { LitMaterial, Materials } from './materials';
import { canvas, toTexture } from './paint';
import { cached, pane, sub } from './landmarks';
import { lm, lp } from './map-world';
import type { MCtx, RGB } from './mitte-world';

type P2 = readonly [number, number];
type Rect = readonly [number, number, number, number];

// ---------------------------------------------------------------- sign atlas

const AW = 1024, AH = 1280;
/** Atlas cells in pixels (x, y, w, h). Rows of 128 px; murals fill the last three rows. */
const A = {
  sony: [0, 0, 1024, 128], marquee: [0, 128, 1024, 128], banner: [0, 256, 1024, 256], klinik: [0, 512, 1024, 128],
  ubahn: [0, 640, 512, 256], uSign: [512, 640, 128, 128], cone: [640, 640, 128, 128], vials: [768, 640, 128, 128], lobby: [896, 640, 128, 128],
  red: [512, 768, 128, 128], yellow: [640, 768, 128, 128], green: [768, 768, 128, 128],
} satisfies Record<string, Rect>;
/** Neon colours (`docs/maps/mitte.md`), 16 px cells at x 896 of row 6: solid glowing strips. */
const NEON = { magenta: '#ff4fa3', cyan: '#43d1cf', amber: '#e19142', blue: '#6a8cff', white: '#eef2ff', red: '#ff3a2a', green: '#3ae07a', yellow: '#ffd23a' } as const;
type Neon = keyof typeof NEON;
const NEON_KEYS = Object.keys(NEON) as Neon[];
const MURALS = 8;
const mural = (i: number): Rect => [i * 128, 896, 128, 384];
/** 2D wall paint colours. */
const PAINT = ['#d4537e', '#43d1cf', '#f2d14b', '#7d9bff', '#e8642e', '#8fd16a', '#a050c0'];
/** The 2D bear stencil (`drawWallP`), x 0..16 right, y 0..28 up. */
const BEAR: P2[] = [[2, 0], [5, 0], [6, 9], [10, 9], [11, 0], [14, 0], [13, 13], [16, 20], [15, 25], [12, 23], [11, 28], [7, 28], [5, 23], [1, 25], [0, 20], [3, 13]];

function fit(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font = 'bold %px "Helvetica Neue", Arial, sans-serif'): void {
  let s = size;
  g.font = font.replace('%', String(s));
  while (g.measureText(text).width > maxW && s > 10) g.font = font.replace('%', String(--s));
  g.fillText(text, x, y);
}

/** Paints the atlas; `glow` paints the emissive map (letters and tubes bright, panels dark, murals black). */
function paintAtlas(g: CanvasRenderingContext2D, glow: boolean): void {
  const rng = new Rng(2089);
  const box = (r: Rect, col: string): void => { g.fillStyle = col; g.fillRect(r[0], r[1], r[2], r[3]); };
  const disc = (x: number, y: number, r: number, col: string): void => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  box([0, 0, AW, AH], '#000');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Pavilion lettering: steel letters on dark glass, two tubes dead (2089).
  {
    const [x, y, w, h] = A.sony, text = 'SONY CENTER', dead = new Set([2, 8]), step = (w - 100) / text.length;
    box(A.sony, glow ? '#000' : '#141a22');
    g.font = 'bold 84px "Helvetica Neue", Arial, sans-serif';
    [...text].forEach((ch, i) => {
      g.fillStyle = glow ? (dead.has(i) ? '#101014' : '#cfe0ff') : '#eef2f6';
      g.fillText(ch, x + 50 + step * (i + 0.5), y + h / 2 + 4);
    });
  }
  // Cinema marquee: bulb border, amber letters.
  {
    const [x, y, w, h] = A.marquee;
    box(A.marquee, glow ? '#000' : '#0f0c0a');
    for (let u = x + 14; u < x + w; u += 25) for (const v of [y + 11, y + h - 11]) {
      const on = rng.next() > 0.15;
      disc(u, v, 6, glow ? (on ? '#ffbe6a' : '#000') : on ? '#ffe4b0' : '#4a3a28');
    }
    g.fillStyle = glow ? '#ffae48' : '#ffd08a';
    fit(g, 'HEUTE NACHT · BASSPREDIGER', x + w / 2, y + h / 2 + 2, w - 90, 60);
  }
  // Stage banner (2D `drawStage`): equaliser bars on aubergine, BASS on a dark plate.
  {
    const [x, y, w, h] = A.banner, n = 32, bw = w / n;
    box(A.banner, glow ? '#000' : '#1a0c1c');
    for (let i = 0; i < n; i++) {
      const lv = 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45 + 0.3));
      for (let k = 0; k < Math.round(lv * 9); k++) {
        g.fillStyle = k > 6 ? (glow ? '#ffe0f0' : '#ffd8ec') : glow ? '#ff4fa3' : '#e0408c';
        g.fillRect(x + i * bw + 4, y + h - 12 - (k + 1) * 24, bw - 8, 18);
      }
    }
    box([x + w / 2 - 170, y + 10, 340, 96], glow ? '#000' : '#120812');
    g.fillStyle = glow ? '#ffffff' : '#fff0f8';
    fit(g, 'BASS', x + w / 2, y + 60, 320, 88, 'bold %px Impact, "Arial Black", sans-serif');
  }
  // Clinic sign (2D `drawClinic`): cyan cross, IMPLANTATE, the cyber arm, a tube border.
  {
    const [x, y, w, h] = A.klinik, cy = y + h / 2, cyan = glow ? '#8afcf8' : '#43d1cf';
    box(A.klinik, glow ? '#000' : '#0a1a20');
    g.fillStyle = cyan;
    g.fillRect(x + 48, cy - 12, 76, 24);
    g.fillRect(x + 74, cy - 38, 24, 76);
    fit(g, 'IMPLANTATE', x + w / 2 - 20, cy + 3, 600, 76);
    g.strokeStyle = cyan;
    g.lineCap = 'round';
    g.lineWidth = 11;
    g.beginPath(); g.moveTo(x + 812, cy + 6); g.lineTo(x + 926, cy + 6); g.lineTo(x + 962, cy - 24); g.moveTo(x + 926, cy + 6); g.lineTo(x + 966, cy + 30); g.stroke();
    g.beginPath(); g.arc(x + 806, cy + 6, 15, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4;
    g.strokeRect(x + 7, y + 7, w - 14, h - 14);
  }
  // U Potsdamer Platz: the pentagon sign of the entrance (blue, white U and name) in its green frame.
  {
    const [x, y, w, h] = A.ubahn;
    box(A.ubahn, glow ? '#000' : '#24392d');
    g.fillStyle = glow ? '#0d2250' : '#1d4a8a';
    g.beginPath(); g.moveTo(x + 22, y + h - 18); g.lineTo(x + w - 22, y + h - 18); g.lineTo(x + w - 22, y + 100); g.lineTo(x + w / 2, y + 20); g.lineTo(x + 22, y + 100); g.closePath(); g.fill();
    g.strokeStyle = glow ? '#8090b0' : '#f0f0f0';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = '#fff';
    fit(g, 'U', x + w / 2, y + 96, 200, 96);
    fit(g, 'Potsdamer Platz', x + w / 2, y + 190, w - 84, 56);
  }
  // U square (BVG style, no logo): white U on blue.
  {
    const [x, y, w] = A.uSign;
    box(A.uSign, glow ? '#0c1c44' : '#1d4a8a');
    g.strokeStyle = glow ? '#4060a0' : '#e8ecf4';
    g.lineWidth = 5;
    g.strokeRect(x + 5, y + 5, w - 10, w - 10);
    g.fillStyle = '#fff';
    fit(g, 'U', x + w / 2, y + w / 2 + 4, 100, 96);
  }
  // Speaker cone: black cabinet, cone, magenta ring (2D: pulsing magenta rings).
  {
    const [x, y, w] = A.cone, cx = x + w / 2, cy = y + w / 2;
    box(A.cone, glow ? '#000' : '#141416');
    disc(cx, cy, 56, glow ? '#ff4fa3' : '#d8408a');
    disc(cx, cy, 49, glow ? '#000' : '#26262a');
    disc(cx, cy, 40, glow ? '#000' : '#0c0c0e');
    disc(cx, cy, 13, glow ? '#100008' : '#3a3a40');
  }
  // Shelf of vials: dark back, five tubes with cyan liquid.
  {
    const [x, y, w] = A.vials;
    box(A.vials, glow ? '#000' : '#0c161a');
    for (let i = 0; i < 5; i++) {
      const vx = x + 10 + i * 23, top = y + 20 + rng.range(0, 14), lv = rng.range(0.35, 0.85);
      g.fillStyle = glow ? '#06191c' : '#33464c';
      g.fillRect(vx, top, 16, y + w - 16 - top);
      const ly = y + w - 16 - (y + w - 16 - top) * lv;
      g.fillStyle = glow ? (i === 3 ? '#ff4fa3' : '#58f4ee') : i === 3 ? '#e04a90' : '#43d1cf';
      g.fillRect(vx + 2, ly, 12, y + w - 18 - ly);
    }
    box([x, y + w - 14, w, 4], glow ? '#000' : '#5a6470');
  }
  // Lit lobby seen through glass: ceiling light, floor, column and desk silhouettes.
  {
    const [x, y, w] = A.lobby, gr = g.createLinearGradient(0, y, 0, y + w);
    gr.addColorStop(0, glow ? '#c8d8e8' : '#e8f0f8');
    gr.addColorStop(0.65, glow ? '#7a8a96' : '#b8c4cc');
    gr.addColorStop(1, glow ? '#262a2e' : '#50585e');
    g.fillStyle = gr;
    g.fillRect(x, y, w, w);
    box([x + 30, y, 12, w], glow ? '#1a2024' : '#4a5258');
    box([x + 92, y, 10, w], glow ? '#1a2024' : '#4a5258');
    box([x + 48, y + 86, 34, 26], glow ? '#121618' : '#30383e');
  }
  // Signal lenses (Verkehrsturm): dark housing, coloured lens.
  for (const [r, col] of [[A.red, '#ff3020'], [A.yellow, '#ffb020'], [A.green, '#30ff80']] as const) {
    const cx = r[0] + 64, cy = r[1] + 64;
    box(r, glow ? '#000' : '#16201a');
    disc(cx, cy, 52, glow ? '#000' : '#0a0c0a');
    disc(cx, cy, 42, glow ? col : col);
    disc(cx - 12, cy - 14, 10, glow ? '#ffffff' : '#ffffffa0');
  }
  NEON_KEYS.forEach((k, i) => box([896 + i * 16, 768, 16, 128], NEON[k]));
  // Wall murals (no glow): concrete, colour fields and stripes, tags, the bear on two, grime at the foot.
  for (let i = 0; i < MURALS; i++) {
    if (glow) continue;
    const [x, y, w, h] = mural(i);
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    box([x, y, w, h], '#bab6aa');
    for (let k = 0; k < 50; k++) disc(x + rng.range(0, w), y + rng.range(0, h), rng.range(3, 16), `rgba(${rng.next() < 0.5 ? '70,66,58' : '235,230,220'},${rng.range(0.05, 0.14).toFixed(2)})`);
    const col = (): string => PAINT[rng.int(PAINT.length)]!;
    // Big colour fields from the bottom, a few bands.
    for (let k = 0; k < 3; k++) {
      g.fillStyle = col();
      g.globalAlpha = rng.range(0.75, 0.95);
      g.beginPath();
      const y0 = y + h * rng.range(0.15, 0.75), y1 = y0 + h * rng.range(0.12, 0.4);
      g.moveTo(x, y0); g.bezierCurveTo(x + w * 0.4, y0 - 30, x + w * 0.6, y0 + 30, x + w, y0 + rng.range(-40, 40));
      g.lineTo(x + w, y1); g.bezierCurveTo(x + w * 0.6, y1 + 20, x + w * 0.4, y1 - 20, x, y1);
      g.fill();
    }
    g.globalAlpha = 1;
    // Stripes or dots.
    if (i % 2) for (let k = 0; k < 6; k++) { g.fillStyle = col(); g.fillRect(x, y + h * 0.1 + k * 22, w, 9); }
    else for (let k = 0; k < 9; k++) disc(x + rng.range(10, w - 10), y + rng.range(30, h * 0.6), rng.range(6, 16), col());
    if (i === 1 || i === 5) {
      // The bear stencil, black (2D).
      const s = 5.4, bx = x + w / 2 - 8 * s, by = y + h * 0.62;
      g.fillStyle = '#1a1a1e';
      g.beginPath();
      BEAR.forEach(([u, v], k) => (k ? g.lineTo(bx + u * s, by - v * s) : g.moveTo(bx + u * s, by - v * s)));
      g.closePath();
      g.fill();
    }
    // Tags: black and white scribbles.
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = k % 2 ? '#141414' : '#f4f4f0';
      g.lineWidth = rng.range(2, 5);
      g.beginPath();
      let px = x + rng.range(8, 40), py = y + h * rng.range(0.55, 0.9);
      g.moveTo(px, py);
      for (let s = 0; s < 6; s++) g.lineTo((px += rng.range(6, 18)), (py += rng.range(-18, 18)));
      g.stroke();
    }
    // Rain runs from the top, grime at the foot.
    for (let k = 0; k < 8; k++) box([x + rng.range(0, w), y, rng.range(2, 6), rng.range(40, 200)], 'rgba(60,56,50,0.18)');
    const gr = g.createLinearGradient(0, y + h * 0.82, 0, y + h);
    gr.addColorStop(0, 'rgba(40,36,30,0)');
    gr.addColorStop(1, 'rgba(40,36,30,0.6)');
    g.fillStyle = gr;
    g.fillRect(x, y + h * 0.82, w, h * 0.18);
    g.restore();
  }
}

interface SouthMats {
  signs: LitMaterial;
  membrane: LitMaterial;
}
const southMats = new WeakMap<Materials, SouthMats>();
function mats(c: MCtx): SouthMats {
  let s = southMats.get(c.N.materials);
  if (!s) {
    const [mc, mg] = canvas(AW, AH), [ec, eg] = canvas(AW, AH);
    paintAtlas(mg, false);
    paintAtlas(eg, true);
    s = {
      signs: c.N.materials.surface({ map: toTexture(mc, false, 4), emissiveMap: toTexture(ec, false, 4), emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.5 }),
      membrane: c.N.materials.surface({ color: 0xe8eaee, emissive: 0xff4fa3, emissiveIntensity: 0.08, roughness: 0.75, doubleSided: true, vertexColors: true }),
    };
    southMats.set(c.N.materials, s);
  }
  return s;
}

// ---------------------------------------------------------------- helpers

const UP = new Vector3(0, 1, 0);
const GLASS: RGB = [0.85, 0.92, 1], STEEL: RGB = [1.45, 1.48, 1.55], WHITE: RGB = [1.08, 1.07, 1.04], RED: RGB = [0.95, 0.18, 0.15];
const DARK: RGB = [0.35, 0.35, 0.38], GREEN: RGB = [0.22, 0.34, 0.27], STONE: RGB = [0.8, 0.8, 0.8];

const scaled = (m: Matrix4, sx: number, sy: number, sz = 1): Matrix4 => m.clone().multiply(new Matrix4().makeScale(sx, sy, sz));
/** uv rect [u0, v0, u1, v1] of an atlas cell, inset half a texel. */
const uvOf = (r: Rect): [number, number, number, number] => [(r[0] + 1) / AW, 1 - (r[1] + r[3] - 1) / AH, (r[0] + r[2] - 1) / AW, 1 - (r[1] + 1) / AH];

function cardGeo(r: Rect): BufferGeometry {
  return cached(`ms-card${r.join(',')}`, () => {
    const g = new PlaneGeometry(1, 1), uv = g.getAttribute('uv'), [u0, v0, u1, v1] = uvOf(r);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return g;
  });
}

/** An atlas sign centred on `m`, facing its +z, w × h meters. */
function card(c: MCtx, r: Rect, m: Matrix4, w: number, h: number): void {
  c.b.geo(mats(c).signs, cardGeo(r), scaled(m, w, h));
}

const neonUV = (k: Neon): [number, number] => [(896 + NEON_KEYS.indexOf(k) * 16 + 8) / AW, 1 - 832 / AH];
/** `make()` with every uv on one neon cell: a solid glowing colour (constant uv, so no mip bleeding). */
function lit(key: string, k: Neon, make: () => BufferGeometry): BufferGeometry {
  return cached(`ms-neon-${k}-${key}`, () => {
    const g = make(), uv = g.getAttribute('uv'), [u, v] = neonUV(k);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
    return g;
  });
}

/** A glowing neon box (strip, tube, lamp) on `m`. */
function neon(c: MCtx, k: Neon, m: Matrix4, sx: number, sy: number, sz: number): void {
  c.b.geo(mats(c).signs, lit('box', k, () => new BoxGeometry(1, 1, 1)), scaled(m, sx, sy, sz));
}

/** Landmark matrix of a bar from local point a to e (unit box along y), and its length. */
function bar(l: Landmark, a: Vector3, e: Vector3): [Matrix4, number] {
  const d = e.clone().sub(a), len = d.length();
  const m = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(UP, d.divideScalar(len))).setPosition(a.clone().add(e).multiplyScalar(0.5));
  return [lm(l).multiply(m), len];
}

/**
 * Vertical faces along a polyline in frame `F` (x, z). A ring that runs left to right along its front (+z)
 * and on round to the back faces outward. u = run meters × us, v = y × vs; `y1` may vary per point.
 */
function faces(c: MCtx, mat: Material, F: Matrix4, pts: readonly P2[], y0: number, y1: number | ((p: P2) => number), tint: RGB, us = 1 / 6, vs = 1 / 12, closed = false): void {
  const batch = c.b.solid.of(mat), top = (p: P2): number => (typeof y1 === 'number' ? y1 : y1(p));
  const P = (p: P2, y: number): Vector3 => new Vector3(p[0], y, p[1]).applyMatrix4(F);
  let run = 0;
  for (let i = 0; i < (closed ? pts.length : pts.length - 1); i++) {
    const a = pts[i]!, e = pts[(i + 1) % pts.length]!, len = Math.hypot(e[0] - a[0], e[1] - a[1]);
    batch.quad([P(a, y0), P(e, y0), P(e, top(e)), P(a, top(a))], [run * us, y0 * vs, (run + len) * us, Math.max(top(a), top(e)) * vs], [tint]);
    run += len;
  }
}

/** The same faces with one atlas cell (or a neon cell when `k` is a colour) per segment. */
function cells(c: MCtx, r: Rect | Neon, F: Matrix4, pts: readonly P2[], y0: number, y1: number, closed = false): void {
  const batch = c.b.solid.of(mats(c).signs), P = (p: P2, y: number): Vector3 => new Vector3(p[0], y, p[1]).applyMatrix4(F);
  const uv = typeof r === 'string' ? ((u, v): [number, number, number, number] => [u, v, u, v])(...neonUV(r)) : uvOf(r);
  for (let i = 0; i < (closed ? pts.length : pts.length - 1); i++) {
    const a = pts[i]!, e = pts[(i + 1) % pts.length]!;
    batch.quad([P(a, y0), P(e, y0), P(e, y1), P(a, y1)], uv);
  }
}

/** Frames at the middle of each segment of a ring (box +z points out of it), with the segment length. */
function segs(F: Matrix4, pts: readonly P2[], closed = false): Array<{ m: Matrix4; len: number }> {
  const out: Array<{ m: Matrix4; len: number }> = [];
  for (let i = 0; i < (closed ? pts.length : pts.length - 1); i++) {
    const a = pts[i]!, e = pts[(i + 1) % pts.length]!, dx = e[0] - a[0], dz = e[1] - a[1];
    out.push({ m: sub(F, (a[0] + e[0]) / 2, 0, (a[1] + e[1]) / 2, Math.atan2(-dz, dx)), len: Math.hypot(dx, dz) });
  }
  return out;
}

/** World-aligned planar uv (meters × k) on a flat geometry. */
function planar(g: BufferGeometry, k: number): BufferGeometry {
  const p = g.getAttribute('position'), uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * k, p.getZ(i) * k);
  return g;
}

/** Flat, upward lid of a (possibly concave) polygon in frame (x, z), at y 0. */
function capGeo(key: string, poly: readonly P2[], k = 0.5): BufferGeometry {
  return cached(`ms-cap-${key}`, () => planar(new ShapeGeometry(new Shape(poly.map(([x, z]) => new Vector2(x, -z)))).rotateX(-Math.PI / 2), k));
}

/** A flat disc or ring lying on the ground (XY shape turned up), planar uv. */
function flat(key: string, make: () => BufferGeometry, k = 1 / 3): BufferGeometry {
  return cached(`ms-flat-${key}`, () => planar(make().rotateX(-Math.PI / 2), k));
}

/** A quad whose normal points up (the membrane panels). */
function quadUp(c: MCtx, mat: Material, p: [Vector3, Vector3, Vector3, Vector3], tint: RGB): void {
  const n = new Vector3().subVectors(p[1], p[0]).cross(new Vector3().subVectors(p[3], p[0]));
  c.b.solid.of(mat).quad(n.y >= 0 ? p : [p[0], p[3], p[2], p[1]], [0, 0, 1, 1], [tint]);
}

function cyl(c: MCtx, mat: Material, m: Matrix4, r0: number, r1: number, h: number, seg: number, tint?: RGB): void {
  c.b.geo(mat, cached(`ms-cy${r0},${r1},${h},${seg}`, () => new CylinderGeometry(r1, r0, h, seg)), m, tint);
}

// ---------------------------------------------------------------- Sony Center

const RI = 20.3, RO = 29, TS = [-7, -3.5, 0, 3.5, 7];
/** Roof: ring radius and height (on the block tops), hub radius and height, mast tip (`SHOW.sony.top`). */
const RR = 26, RY = 21.5, R0 = 3.2, HY = 31, TIP = 39;
/** Block heights by angle: the camera-side pavilion low, the SE/SW blocks below the game camera (13.8 m). */
const SONY_H: Record<number, number> = { 0: 7, 60: 12.5, 120: 19, 180: 21, 240: 19, 300: 12.5 };

/**
 * Sony Center (Helmut Jahn, 2000). Photos: the forum under the tent roof (white fabric panels between glass
 * strips on radial cables, a steel truss ring on the buildings, the hub with mast and needle), glass office
 * fronts with white floor bands and red lines, the dark metal cinema block with its canopy, the oval
 * fountain, café terraces. Blocks are annular sectors of the forum ring inside the `OPEN_PARTS` boxes.
 */
function sony(c: MCtx, l: Landmark): void {
  const { b, M } = c, S = mats(c), rng = new Rng(2000);
  const inner: P2[] = TS.map((t) => [t, Math.sqrt(RI * RI - t * t) - 24]);
  const outer: P2[] = TS.map((t) => [t, Math.min(5, Math.sqrt(RO * RO - t * t) - 24)]);
  const front = [...inner].reverse();
  const ring: P2[] = [...outer, ...front];
  for (const p of OPEN_PARTS.sony ?? []) {
    const d = (Math.round((p.rot * 180) / Math.PI) + 360) % 360, h = SONY_H[d] ?? 18, F = sub(lm(l), p.x, 0, p.z, p.rot);
    if (d === 0) sonyPavilion(c, F, ring, front, outer, h);
    else sonyBlock(c, F, front, outer, h, d, rng);
    b.geo(M.tar, capGeo('sony-block', ring), sub(F, 0, h, 0), [0.55, 0.55, 0.57]);
    faces(c, M.concrete, F, ring, h, h + 0.5, [0.7, 0.7, 0.72], 0.5, 0.5, true);
    b.shadowBox(sub(F, 0, h / 2, 0.5), 14, h, 9);
    // Steel columns from the block roof up to the roof ring.
    for (const s of [-1, 1]) {
      const x = s * RR * Math.sin(0.14), z = RR * Math.cos(0.14) - 24;
      b.box(M.iron, sub(F, x, (h + RY) / 2, z), 0.5, RY - h, 0.5, STEEL);
    }
    if (d !== 0 && rng.next() < 0.8) b.box(M.iron, sub(F, rng.range(-3, 3), h + 0.9, 2.5), 2.4, 1.8, 1.6, [1.2, 1.2, 1.25]);
  }
  // Upper floors bridge the gaps behind the forum (90° … 270°): the ring reads closed; the walkable
  // passages stay free below 7.5 m and the camera-side gaps (30°, 330°) stay open.
  for (const [g, top] of [[90, 15.5], [150, 19], [210, 19], [270, 15.5]] as const) sonyBridge(c, l, (g * Math.PI) / 180, top);
  sonyRoof(c, l);
  // Forum floor (walk-over, no occluder): light paving, dark granite band, the 2D magenta ring, radial
  // stripes, the oval fountain (rim 0.25 m), dark still water.
  b.solid.excludeOccluder(() => {
    b.geo(M.concrete, flat('sony-floor', () => new CircleGeometry(19.6, 48)), lm(l, 0, 0.03, 0), [1.0, 0.99, 1.0]);
    b.geo(M.concrete, flat('sony-band', () => new RingGeometry(7.4, 8.2, 48)), lm(l, 0, 0.045, 0), [0.42, 0.42, 0.45]);
    b.geo(M.concrete, flat('sony-band2', () => new RingGeometry(18.6, 19.6, 48)), lm(l, 0, 0.045, 0), [0.42, 0.42, 0.45]);
    b.geo(S.signs, lit('sony-ring', 'magenta', () => new RingGeometry(13.56, 13.72, 64).rotateX(-Math.PI / 2)), lm(l, 0, 0.05, 0));
    for (let k = 0; k < 16; k++) b.box(M.concrete, lm(l, 0, 0.04, 0, (k / 16) * Math.PI * 2).multiply(new Matrix4().makeTranslation(0, 0, 14)), 0.5, 0.02, 9, [0.5, 0.5, 0.53]);
    const oval = new Matrix4().makeScale(1.3, 1, 1);
    b.geo(c.N.sandstone, cached('ms-basin', () => new CylinderGeometry(4.3, 4.5, 0.25, 32)), lm(l, 0, 0.125, 0).multiply(oval), [0.62, 0.62, 0.64]);
    b.geo(M.water, cached('ms-pool', () => new CircleGeometry(3.95, 32).rotateX(-Math.PI / 2)), lm(l, 0, 0.255, 0).multiply(oval));
    cyl(c, M.iron, lm(l, 0, 0.3, 0), 0.25, 0.18, 0.12, 8, STEEL);
  });
  b.light(lp(l, 0, 9, 0), 0xff4fa3, 16, 24, 0.04, 9);
  b.light(lp(l, 0, 3.4, 31), 0xffb060, 12, 12, 0.08, 5);
}

/** Upper floors over a gap at angle g: an annular sector from 7.5 m reaching 20° into both blocks. */
function sonyBridge(c: MCtx, l: Landmark, g: number, top: number): void {
  const { b, M, N } = c, F = lm(l, 0, 0, 0, g), Y = 7.5;
  const arc = (r: number): P2[] => [-1, -0.5, 0, 0.5, 1].map((k) => [Math.sin(k * 0.35) * r, Math.cos(k * 0.35) * r] as P2);
  const outer = arc(RO - 0.4), front = arc(RI).reverse(), ring = [...outer, ...front];
  faces(c, N.curtain, F, ring, Y, top, GLASS, 1 / 6, 1 / 12, true);
  b.geo(M.tar, capGeo('sony-bridge', ring), sub(F, 0, top, 0), [0.55, 0.55, 0.57]);
  b.geo(M.concrete, capGeo('sony-bridge', ring), sub(F, 0, Y, 0, 0, 0, Math.PI).multiply(new Matrix4().makeScale(-1, 1, 1)), [0.5, 0.5, 0.52]);
  for (const s of segs(F, front)) {
    for (let y = Y + 3.1, k = 0; y < top - 0.8; y += 3.1, k++) b.box(M.enamel, sub(s.m, 0, y, 0.2), s.len + 0.06, 0.22, 0.42, k % 2 ? RED : WHITE);
    neon(c, g < Math.PI ? 'cyan' : 'magenta', sub(s.m, 0, Y + 0.05, 0.05), s.len, 0.1, 0.1);
  }
  for (const s of segs(F, outer)) neon(c, 'amber', sub(s.m, 0, Y + 0.05, 0.05), s.len, 0.1, 0.1);
}

/** Glass office block (or the dark cinema block at 180°) on the forum ring. */
function sonyBlock(c: MCtx, F: Matrix4, front: readonly P2[], outer: readonly P2[], h: number, d: number, rng: Rng): void {
  const { b, M, N } = c, cinema = d === 180, led: Neon = d === 120 || d === 300 ? 'cyan' : 'magenta', G = 4.4;
  const skin = cinema ? M.corrugated : N.curtain, tint: RGB = cinema ? [0.24, 0.25, 0.3] : GLASS, us = cinema ? 0.5 : 1 / 6, vs = cinema ? 0.5 : 1 / 12;
  faces(c, skin, F, [...outer, front[0]!], 0, h, tint, us, vs);
  faces(c, skin, F, [front[4]!, outer[0]!], 0, h, tint, us, vs);
  faces(c, skin, F, front, G, h, tint, us, vs);
  // Forum ground floor: lit shop fronts (cinema: the lobby), dark lintel, white canopy with an LED edge.
  if (cinema) cells(c, A.lobby, F, front, 0.1, G - 0.6);
  else {
    const batch = b.solid.of(M.shop), P = (p: P2, y: number): Vector3 => new Vector3(p[0], y, p[1]).applyMatrix4(F);
    for (let i = 0; i < 4; i++) batch.quad([P(front[i]!, 0.1), P(front[i + 1]!, 0.1), P(front[i + 1]!, G - 0.6), P(front[i]!, G - 0.6)]);
  }
  for (const [i, s] of segs(F, front).entries()) {
    if (i === 1 && (d === 60 || d === 240)) b.wearWindow(sub(s.m, 0, G + 1.65, 0.02), Math.min(s.len * 0.8, 2.25), 2.15, true);
    b.box(M.iron, sub(s.m, 0, G - 0.3, 0.12), s.len + 0.05, 0.6, 0.3, DARK);
    b.box(M.enamel, sub(s.m, 0, G + 0.05, 0.8), s.len + 0.1, 0.2, 1.5, WHITE);
    neon(c, led, sub(s.m, 0, G - 0.06, 1.56), s.len + 0.1, 0.08, 0.06);
    // Upper floors: white floor bands, every second one red (the Sony Center's red lines).
    if (!cinema) for (let y = G + 3.1, k = 0; y < h - 0.8; y += 3.1, k++) b.box(M.enamel, sub(s.m, 0, y, 0.2), s.len + 0.06, 0.22, 0.42, k % 2 ? RED : WHITE);
    else if (i === 1) card(c, A.marquee, sub(s.m, s.len / 2, G + 1.6, 0.25), 7, 0.875);
  }
  for (const p of front) b.box(M.iron, sub(F, p[0], G / 2, p[1]), 0.35, G, 0.35, DARK);
  if (cinema) {
    // The cinema's big dark canopy roof, cantilevered over the forum.
    const s = segs(F, [front[0]!, front[4]!])[0]!;
    b.box(M.corrugated, sub(s.m, 0, h + 0.4, 3, 0, 0.18), s.len + 2, 0.5, 7, [0.3, 0.3, 0.33], 0.5);
  }
  // Club neon on the street corners that face the south gaps (60°, 300°).
  if (d === 60 || d === 300) {
    const sx = d === 60 ? -7.08 : 7.08, z = outer[d === 60 ? 0 : 4]![1] - 0.6;
    for (const dz of [0, -0.5]) neon(c, d === 60 ? 'cyan' : 'magenta', sub(F, sx, 4.2, z + dz), 0.08, 5.6, 0.12);
    b.geo(M.shop, cached('ms-sshop', () => new PlaneGeometry(3, 3)), sub(F, sx, 1.8, z - 2.5, d === 60 ? -Math.PI / 2 : Math.PI / 2));
  }
  if (rng.next() < 0.5) b.box(M.iron, sub(F, rng.range(-4, 4), h + 0.7, -1), 1.6, 1.4, 1.6, [1.1, 1.1, 1.15]);
}

/** The camera-side block: a low glass pavilion on the street with the lettering and a lit marquee. */
function sonyPavilion(c: MCtx, F: Matrix4, ring: readonly P2[], front: readonly P2[], outer: readonly P2[], h: number): void {
  const { b, M, N } = c, G = 4.6;
  faces(c, N.curtain, F, ring, G, h, GLASS, 1 / 6, 1 / 12, true);
  faces(c, N.curtain, F, [outer[4]!, front[0]!], 0, G, GLASS);
  faces(c, N.curtain, F, [front[4]!, outer[0]!], 0, G, GLASS);
  cells(c, A.lobby, F, outer, 0.1, G);
  const batch = b.solid.of(M.shop), P = (p: P2, y: number): Vector3 => new Vector3(p[0], y, p[1]).applyMatrix4(F);
  for (let i = 0; i < 4; i++) batch.quad([P(front[i]!, 0.1), P(front[i + 1]!, 0.1), P(front[i + 1]!, G), P(front[i]!, G)]);
  for (const p of outer) b.box(M.iron, sub(F, p[0], G / 2, p[1]), 0.3, G, 0.3, STEEL);
  // Street side: canopy, marquee box, fascia with the lettering.
  const fm = sub(F, 0, 0, 5);
  b.box(M.enamel, sub(fm, 0, 3.5, 0.6), 13.6, 0.22, 2.4, WHITE);
  neon(c, 'amber', sub(fm, 0, 3.36, 1.81), 13.6, 0.06, 0.05);
  b.box(M.iron, sub(fm, 0, 4.15, 0.55), 7.6, 0.95, 0.5, DARK);
  card(c, A.marquee, sub(fm, 0, 4.15, 0.81), 7.4, 0.925);
  b.box(M.iron, sub(fm, 0, 5.85, 0.05), 11, 1.5, 0.5, [0.25, 0.27, 0.3]);
  card(c, A.sony, sub(fm, 0, 5.85, 0.31), 10, 1.25);
  for (const s of [-1, 1]) neon(c, 'magenta', sub(fm, s * 5.5, 5.85, 0.31), 0.06, 1.5, 0.06);
}

/** Tent roof: steel truss ring, hub with mast and needle, membrane panels on glowing magenta cables. */
function sonyRoof(c: MCtx, l: Landmark): void {
  const { b, M } = c, S = mats(c);
  const pt = (a: number, r: number, y: number): Vector3 => new Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  const NB = 24;
  for (let i = 0; i < NB; i++) {
    const a0 = (i / NB) * Math.PI * 2, a1 = ((i + 1) / NB) * Math.PI * 2;
    for (const y of [RY, RY + 1.3]) {
      const [m, len] = bar(l, pt(a0, RR, y), pt(a1, RR, y));
      b.box(M.iron, m, 0.3, len + 0.12, 0.3, STEEL);
    }
    const [m, len] = bar(l, pt(a0, RR, RY), pt(a1, RR, RY + 1.3));
    b.box(M.iron, m, 0.16, len, 0.16, STEEL);
    const [n, nl] = bar(l, pt(a0, RR - 0.3, RY + 0.65), pt(a1, RR - 0.3, RY + 0.65));
    c.b.geo(S.signs, lit('box', 'magenta', () => new BoxGeometry(1, 1, 1)), scaled(n, 0.1, nl, 0.1));
  }
  // Membrane: the profile falls from the hub to the ring like a low cone (Mount Fuji), each panel sags.
  const prof = (r: number): number => RY + 1.3 + (HY - RY - 1.3) * Math.pow((RR - r) / (RR - R0), 1.35);
  const rows = [R0, 7, 11.5, 16, 20.5, RR], NP = 20;
  for (let k = 0; k < NP; k++) {
    const a0 = ((k + 0.12) / NP) * Math.PI * 2, a1 = ((k + 0.88) / NP) * Math.PI * 2, am = (a0 + a1) / 2;
    const at = (r: number, a: number, sag: number): Vector3 => pt(a, r, prof(r) - sag).applyMatrix4(lm(l));
    for (let j = 0; j < rows.length - 1; j++) {
      const r0 = rows[j]!, r1 = rows[j + 1]!, s0 = 0.6 * Math.sin((Math.PI * (r0 - R0)) / (RR - R0)), s1 = 0.6 * Math.sin((Math.PI * (r1 - R0)) / (RR - R0));
      const t: RGB = k % 2 ? [1, 1, 1] : [0.94, 0.93, 0.95];
      quadUp(c, S.membrane, [at(r0, a0, 0), at(r1, a0, 0), at(r1, am, s1), at(r0, am, s0)], t);
      quadUp(c, S.membrane, [at(r0, am, s0), at(r1, am, s1), at(r1, a1, 0), at(r0, a1, 0)], t);
    }
    // Cable in the glass strip between this panel and the last.
    const ac = (k / NP) * Math.PI * 2;
    for (let j = 0; j < rows.length - 1; j += 1) {
      const [m, len] = bar(l, pt(ac, rows[j]!, prof(rows[j]!) + 0.05), pt(ac, rows[j + 1]!, prof(rows[j + 1]!) + 0.05));
      c.b.geo(S.signs, lit('box', 'magenta', () => new BoxGeometry(1, 1, 1)), scaled(m, 0.09, len + 0.05, 0.09));
    }
  }
  b.geo(M.iron, cached('ms-hub', () => new TorusGeometry(R0, 0.35, 6, 20).rotateX(Math.PI / 2)), lm(l, 0, HY, 0), STEEL);
  b.geo(c.N.curtain, cached('ms-hubcap', () => new ConeGeometry(R0, 1.8, 16, 1, true)), lm(l, 0, HY + 0.9, 0), GLASS);
  cyl(c, M.iron, lm(l, 0, (HY + TIP) / 2, 0), 0.45, 0.2, TIP - HY, 8, STEEL);
  c.b.geo(M.iron, cached('ms-needle', () => new ConeGeometry(0.55, 5, 8).rotateX(Math.PI)), lm(l, 0, HY - 2.5, 0), STEEL);
  neon(c, 'magenta', lm(l, 0, TIP, 0), 0.45, 0.45, 0.45);
}

// ---------------------------------------------------------------- Soundsystem stage

/**
 * The Bassprediger's stage in the forum (2D `drawStage`, not a real place): aubergine deck, equaliser
 * banner on a back board, truss with par cans, DJ desk, a speaker-cabinet pulpit, speaker stacks with
 * magenta rings at both front corners, yellow generator and flight cases behind them, cables.
 */
function stage(c: MCtx, l: Landmark): void {
  const { b, M } = c, F = lm(l), rng = new Rng(4);
  const DECK: RGB = [0.42, 0.3, 0.46], CAB: RGB = [0.16, 0.16, 0.18];
  b.box(M.darkWood, sub(F, 0, 0.55, -0.65), 8.8, 1.1, 3.7, DECK);
  neon(c, 'magenta', sub(F, 0, 1.08, 1.21), 8.8, 0.06, 0.06);
  // Back board with the banner, truss towers and the cross truss with par cans.
  b.box(M.darkWood, sub(F, 0, 2.4, -2.3), 8.6, 2.6, 0.2, [0.25, 0.16, 0.26]);
  card(c, A.banner, sub(F, 0, 2.4, -2.19), 8.4, 2.1);
  for (const s of [-1, 1]) b.box(M.lattice, sub(F, s * 4.5, 2.5, -2.1), 0.42, 5.0, 0.42, STEEL);
  b.box(M.lattice, sub(F, 0, 5.0, -2.1), 9.42, 0.42, 0.42, STEEL);
  for (let i = 0; i < 6; i++) {
    const x = -3.6 + i * 1.44, m = sub(F, x, 4.55, -1.95, 0, -0.5);
    b.box(M.iron, m, 0.3, 0.42, 0.3, CAB);
    neon(c, i % 2 ? 'cyan' : 'magenta', sub(m, 0, -0.22, 0), 0.24, 0.03, 0.24);
  }
  // DJ desk with a lit top, the pulpit (a speaker cabinet) at the front edge.
  b.box(M.iron, sub(F, 0, 1.55, -0.6), 2.4, 0.9, 0.8, CAB);
  neon(c, 'cyan', sub(F, 0, 2.01, -0.6), 2.2, 0.02, 0.6);
  b.box(M.iron, sub(F, 0, 1.65, 0.75), 0.9, 1.1, 0.6, CAB);
  card(c, A.cone, sub(F, 0, 1.65, 1.06), 0.7, 0.7);
  b.box(M.iron, sub(F, 0, 2.5, 0.75), 0.04, 0.6, 0.04, STEEL);
  // Speaker stacks on the ground at both front corners, three cabinets each.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const m = sub(F, s * 5.25 + rng.range(-0.05, 0.05), 0.55 + k * 1.1, 0.4, rng.range(-0.04, 0.04) - s * 0.08);
      b.box(M.iron, m, 1.4, 1.08, 1.3, CAB);
      card(c, A.cone, sub(m, 0, 0, 0.66), 1.0, 1.0);
    }
    b.shadowBox(sub(F, s * 5.25, 1.65, 0.4), 1.4, 3.3, 1.3);
  }
  // Generator (2D: yellow, black louvres, magenta panel) behind the left stack; flight cases behind the right.
  const gm = sub(F, -5.35, 0.65, -1.6);
  b.box(M.enamel, gm, 1.2, 1.3, 1.3, [1.0, 0.76, 0.12]);
  for (let i = 0; i < 4; i++) b.box(M.iron, sub(gm, -0.4 + i * 0.27, 0.05, 0.66), 0.12, 0.9, 0.03, CAB);
  neon(c, 'magenta', sub(gm, 0, 0.55, 0.66), 0.9, 0.08, 0.03);
  cyl(c, M.rust, sub(gm, 0.4, 0.9, -0.4), 0.09, 0.09, 0.6, 6);
  for (const [x, z, w, h] of [[5.3, -1.3, 1.2, 0.8], [5.35, -1.35, 0.9, 0.6]] as const) b.box(M.iron, sub(F, x, h / 2 + (w < 1 ? 0.8 : 0), z), w, h, 0.8, [0.3, 0.3, 0.32]);
  // Cables from the generator, on the ground.
  for (const [x0, z0, x1, z1] of [[-4.6, -1.0, -4.4, 1.0], [-4.6, -1.2, 0, 1.15], [-4.4, -0.9, 4.5, 0.9]] as const) {
    const [m, len] = bar(l, new Vector3(x0, 0.04, z0), new Vector3(x1, 0.04, z1));
    b.box(M.rubber, m, 0.06, len, 0.06);
  }
  b.light(lp(l, 0, 4.2, 2.4), 0xff4fa3, 14, 14, 0.1, 6);
  b.light(lp(l, 4.5, 3.4, 1.6), 0x43d1cf, 9, 9, 0.05, 3.5);
}

// ---------------------------------------------------------------- Bahntower

/**
 * Bahntower (Helmut Jahn, 2000): a D-shaped glass tower, round toward Potsdamer Platz (south and east here),
 * flat at the back. Photos: dense mullions with bright floor bands, the slanted top with a steel screen
 * rising at the flat side (the "sail"), the lobby set back under the first slab on round columns.
 * 2D: cyan floor bands on generator power.
 */
function bahntower(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = lm(l), rng = new Rng(2000);
  const plan = (s: number): P2[] => Array.from({ length: 15 }, (_, i) => {
    const t = Math.PI * (1 - i / 14);
    return [7 * s * Math.cos(t), s * (-7 + 14 * Math.pow(Math.max(0, Math.sin(t)), 0.55))] as P2;
  });
  const P = plan(1), lobby = plan(0.8), G = 5.6, top = (p: P2): number => 70 - (2 / 7) * p[1];
  cells(c, A.lobby, F, lobby, 0, G - 0.4, true);
  for (let i = 1; i < 14; i += 2) cyl(c, M.railSteel, sub(F, P[i]![0] * 0.9, G / 2, P[i]![1] * 0.9), 0.32, 0.32, G, 8, [0.85, 0.86, 0.9]);
  faces(c, M.enamel, F, P, G - 0.6, G + 0.4, [0.8, 0.82, 0.85], 0.5, 0.5, true);
  cells(c, 'cyan', F, plan(1.012), G - 0.5, G - 0.38);
  faces(c, N.curtain, F, P, G + 0.4, top, GLASS, 1 / 6, 1 / 12, true);
  // Generator-powered floors: cyan bands (2D), about one in three.
  for (let y = G + 3.2; y < 66; y += 3) if (rng.next() < 0.35) cells(c, 'cyan', F, plan(1.006), y, y + 0.16);
  // Slanted roof, the steel crown screen and the sail at the flat back.
  b.geo(M.tar, capGeo('bt-roof', P), lm(l).multiply(new Matrix4().set(1, 0, 0, 0, 0, 1, -2 / 7, 70, 0, 0, 1, 0, 0, 0, 0, 1)), [0.5, 0.5, 0.52]);
  const crown = (p: P2): number => top(p) + 2.4;
  const latt = c.b.solid.of(M.lattice), Pw = (p: P2, y: number): Vector3 => new Vector3(p[0] * 1.004, y, p[1] * 1.004).applyMatrix4(F);
  for (let i = 0; i < 14; i++) {
    const a = P[i]!, e = P[i + 1]!;
    latt.quad([Pw(a, top(a)), Pw(e, top(e)), Pw(e, crown(e)), Pw(a, crown(a))], [0, 0, Math.hypot(e[0] - a[0], e[1] - a[1]) / 2, 1.2], [STEEL]);
  }
  b.box(N.curtain, sub(F, 0, 71, -7.15), 14.2, 12, 0.3, GLASS, 1 / 8);
  for (const x of [-7, -3.5, 0, 3.5, 7]) b.box(M.iron, sub(F, x, 70.5, -7.3), 0.25, 13, 0.25, STEEL);
  b.shadowBox(lm(l, 0, 37, 0), 14, 74, 14);
  b.light(lp(l, 0, 3, 8.5), 0x9fe4ff, 12, 12, 0.03, 5);
}

// ---------------------------------------------------------------- Kollhoff-Tower

/**
 * Kollhoff-Tower (Hans Kollhoff, 1999): dark red-brown clinker, the narrow prow toward Potsdamer Platz
 * (north-east here), setbacks rising to the prow with a serrated top (each pilaster ends in a point),
 * full-height pilasters with narrow light-framed windows, a light granite base of two storeys with an
 * arcade. 2D: `#7a3a2a`, stepped top, a few amber windows, red light on the mast.
 */
function kollhoff(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = lm(l), rng = new Rng(1999);
  const BR: RGB = [0.62, 0.34, 0.28], G = 6;
  const steps: Array<{ p: P2[]; top: number }> = [
    { p: [[-5, 6], [5, 6], [5, -2.5], [1.5, -6], [-5, -6]], top: 44 },
    { p: [[-3.6, 3.6], [5, 3.6], [5, -2.5], [1.5, -6], [-3.6, -6]], top: 50.5 },
    { p: [[-1.8, 1.2], [5, 1.2], [5, -2.5], [1.5, -6], [-1.8, -6]], top: 56.5 },
    { p: [[0.2, -1.2], [4.8, -1.2], [4.8, -2.7], [1.8, -5.7], [0.2, -5.7]], top: 62.5 },
  ];
  steps.forEach(({ p, top }, i) => {
    const y0 = i ? steps[i - 1]!.top : G, tint: RGB = i ? [0.7, 0.36, 0.29] : BR;
    faces(c, M.brick, F, p, y0, top, tint, 0.5, 0.5, true);
    b.geo(M.tar, capGeo(`kh${i}`, p), sub(F, 0, top, 0), [0.45, 0.42, 0.4]);
    faces(c, N.sandstone, F, p, top - 0.35, top + 0.25, [0.62, 0.48, 0.42], 0.5, 0.5, true);
    // Pilasters up past the parapet (the serrated crown) and windows between them; the back (−z) is never seen.
    segs(F, p, true).forEach(({ m, len }, e) => {
      if (e === 3) return;
      const n = Math.max(2, Math.round(len / 1.45));
      for (let j = 0; j < n; j++) b.box(M.brick, sub(m, (j + 0.5) * (len / n) - len / 2, (y0 + top + 1.2) / 2, 0.14), 0.34, top + 1.2 - y0, 0.28, [0.68, 0.36, 0.3]);
      for (let y = y0 + 1.7; y < top - 1.2; y += 3.1) for (let j = 1; j < n; j++) pane(b, sub(m, j * (len / n) - len / 2, y, 0), 0.72, 1.6, rng, 0.07);
    });
  });
  b.box(M.iron, sub(F, 2.9, 65.5, -3.9), 0.4, 6, 0.4, DARK);
  neon(c, 'red', sub(F, 2.9, 68.6, -3.9), 0.4, 0.4, 0.4);
  // Granite base: closed on the long sides, an arcade on the south front and the prow.
  const base = steps[0]!.p, gs = segs(F, base, true);
  faces(c, N.sandstone, F, [base[1]!, base[2]!], 0, G, STONE, 0.5, 0.5);
  faces(c, N.sandstone, F, [base[3]!, base[4]!, base[0]!], 0, G, STONE, 0.5, 0.5);
  for (const e of [0, 2]) {
    const { m, len } = gs[e]!, n = e ? 2 : 4;
    b.box(N.sandstone, sub(m, 0, G - 0.6, -0.45), len, 1.2, 0.9, STONE);
    for (let j = 0; j <= n; j++) b.box(N.sandstone, sub(m, -len / 2 + 0.45 + j * ((len - 0.9) / n), (G - 1.2) / 2, -0.45), 0.9, G - 1.2, 0.9, [0.86, 0.86, 0.86]);
    const back = sub(m, 0, 0, -1.7);
    b.box(N.sandstone, sub(back, 0, G / 2, -0.1), len, G, 0.2, [0.55, 0.55, 0.56]);
    for (let j = 0; j < n; j++) {
      const x = -len / 2 + 0.9 + (j + 0.5) * ((len - 1.8) / n), w = (len - 1.8) / n - 0.5;
      if (e === 2 || j !== 1) b.geo(M.shop, cached(`ms-kshop${w.toFixed(2)}`, () => new PlaneGeometry(w, 3.2)), sub(back, x, 1.9, 0.01));
      else card(c, A.lobby, sub(back, x, 1.9, 0.01), w, 3.4);
    }
    b.box(M.dark, sub(m, 0, G - 1.21, -0.85), len - 0.2, 0.02, 1.7);
  }
  b.shadowBox(lm(l, 0, 22, 0), 10, 44, 12);
  b.light(lp(l, 0, 3.2, 6.8), 0xffb060, 12, 11, 0.06, 4.5);
}

// ---------------------------------------------------------------- Verkehrsturm

/**
 * Verkehrsturm (1924 traffic-light tower, replica 1997): pentagonal, dark green. Photos: a low granite plinth,
 * five tall square posts, the clock box (a dial on each face), the glazed cabin, the signal band (red,
 * yellow, green on each face) under a round, flat roof with a low dome and finial. About 8.5 m.
 */
function verkehrsturm(c: MCtx, l: Landmark): void {
  const { b, M, N } = c;
  const pent = (r: number, h: number): BufferGeometry => cached(`ms-pent${r},${h}`, () => new CylinderGeometry(r, r, h, 5));
  const at = (y: number): Matrix4 => lm(l, 0, y, 0, Math.PI / 5);
  b.solid.excludeOccluder(() => {
    b.geo(N.sandstone, pent(1.25, 0.45), at(0.225), [0.72, 0.75, 0.8]);
    for (let k = 0; k < 5; k++) {
      const a = Math.PI / 5 + (k * 2 * Math.PI) / 5;
      b.box(M.enamel, lm(l, Math.sin(a) * 0.95, 2.75, Math.cos(a) * 0.95, a), 0.2, 4.6, 0.2, GREEN);
      b.box(M.enamel, lm(l, Math.sin(a) * 1.05, 6.75, Math.cos(a) * 1.05, a), 0.13, 1.25, 0.13, GREEN);
    }
    b.geo(M.enamel, pent(1.12, 1.0), at(5.55), GREEN);
    b.geo(M.glass, pent(1.02, 1.2), at(6.7), [1, 1, 1]);
    b.geo(M.enamel, pent(1.12, 0.45), at(7.52), GREEN);
    const ap = 1.12 * Math.cos(Math.PI / 5) + 0.012;
    for (let k = 0; k < 5; k++) {
      const a = (k * 2 * Math.PI) / 5, f = lm(l, Math.sin(a) * ap, 0, Math.cos(a) * ap, a);
      b.geo(M.clock, cached('ms-vclock', () => new CircleGeometry(0.34, 20)), sub(f, 0, 5.55, 0));
      [A.red, A.yellow, A.green].forEach((r, i) => card(c, r, sub(f, (i - 1) * 0.3, 7.52, 0), 0.24, 0.24));
    }
    cyl(c, M.enamel, lm(l, 0, 7.86, 0), 1.5, 1.55, 0.22, 24, GREEN);
    b.geo(M.enamel, cached('ms-vdome', () => new SphereGeometry(1.2, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2)), lm(l, 0, 7.97, 0).multiply(new Matrix4().makeScale(1, 0.3, 1)), GREEN);
    cyl(c, M.enamel, lm(l, 0, 8.4, 0), 0.08, 0.05, 0.3, 6, GREEN);
    b.geo(M.enamel, cached('ms-vball', () => new SphereGeometry(0.09, 8, 6)), lm(l, 0, 8.58, 0), GREEN);
  });
}

// ---------------------------------------------------------------- Implantat-Klinik

/**
 * Street implant clinic of 2089 (2D `drawClinic`, not a real place): pallet floor, container walls in dark
 * teal, a shelf of lit vials, the counter with a cyan edge, the implant chair under a surgical lamp, a robot
 * arm, an equipment box; a torn tarp roof sloping to the front, the IMPLANTATE sign above it and a cyan
 * cross on the camera-side corner. Front faces west (local +z); local +x is the south end.
 */
function klinik(c: MCtx, l: Landmark): void {
  const { b, M } = c, F = lm(l);
  const TEAL: RGB = [0.32, 0.48, 0.52], CASE: RGB = [0.42, 0.5, 0.56], LIGHT: RGB = [1.25, 1.25, 1.3];
  b.box(M.wood, sub(F, 0, 0.07, 0), 10, 0.14, 8, [0.5, 0.46, 0.42]);
  b.box(M.corrugated, sub(F, 0, 1.75, -3.88), 10, 3.5, 0.16, TEAL);
  b.box(M.corrugated, sub(F, -4.92, 1.75, -1.4), 0.16, 3.5, 4.8, TEAL);
  b.box(M.corrugated, sub(F, 4.92, 1.6, -2.3), 0.16, 3.2, 3.2, TEAL);
  for (const [x, z, h] of [[-4.85, 3.8, 2.85], [4.85, 3.8, 2.85], [4.85, -3.8, 3.5]] as const) b.box(M.iron, sub(F, x, h / 2 + 0.14, z), 0.14, h, 0.14, LIGHT);
  b.box(M.tarp, sub(F, 0, 3.27, 0.2, 0, Math.atan2(0.65, 8)), 10.6, 0.04, 8.9, [0.42, 0.52, 0.58]);
  b.box(M.iron, sub(F, 0, 3.47, 4.1), 7.6, 0.95, 0.1, [0.35, 0.45, 0.5]);
  card(c, A.klinik, sub(F, 0, 3.47, 4.16), 7.4, 0.925);
  // Back wall shelves with lit vials.
  for (const y of [1.3, 2.15]) {
    b.box(M.iron, sub(F, 0, y, -3.62), 6.2, 0.05, 0.36, LIGHT);
    for (let x = -2.5; x <= 2.5; x += 1) card(c, A.vials, sub(F, x, y + 0.42, -3.78), 0.95, 0.78);
  }
  // Counter with a cyan edge and a monitor.
  b.box(M.carPaint, sub(F, -0.6, 0.66, 2.75), 6, 1.04, 0.75, CASE);
  b.box(M.railSteel, sub(F, -0.6, 1.2, 2.75), 6.1, 0.05, 0.85);
  neon(c, 'cyan', sub(F, -0.6, 1.0, 3.13), 6, 0.06, 0.03);
  const mon = sub(F, 1.4, 1.48, 2.7, 0.3);
  b.box(M.iron, mon, 0.62, 0.42, 0.06, DARK);
  neon(c, 'cyan', sub(mon, 0, 0, 0.032), 0.54, 0.34, 0.01);
  // Implant chair: base, reclined seat and back, leg rest.
  const ch = sub(F, -1.2, 0.14, -0.6, 0.25), UPH: RGB = [0.16, 0.36, 0.4];
  cyl(c, M.iron, sub(ch, 0, 0.28, 0), 0.26, 0.2, 0.56, 8, LIGHT);
  b.box(M.carPaint, sub(ch, 0, 0.65, 0), 0.7, 0.16, 0.9, UPH);
  b.box(M.carPaint, sub(ch, 0, 1.05, -0.62, 0, -0.55), 0.7, 0.9, 0.14, UPH);
  b.box(M.carPaint, sub(ch, 0, 0.5, 0.75, 0, 0.6), 0.6, 0.6, 0.12, UPH);
  // Surgical lamp on a stand, robot arm with a cyan tool.
  b.box(M.iron, sub(F, 0.2, 1.25, -2.0), 0.08, 2.3, 0.08, LIGHT);
  b.box(M.iron, sub(F, -0.45, 2.38, -1.4, 0.75), 0.06, 0.06, 1.7, LIGHT);
  b.box(M.iron, sub(F, -1.05, 2.3, -0.85), 0.55, 0.14, 0.55, LIGHT);
  neon(c, 'white', sub(F, -1.05, 2.22, -0.85), 0.45, 0.03, 0.45);
  const arm = [new Vector3(-2.6, 0.5, -0.4), new Vector3(-2.45, 1.55, -0.75), new Vector3(-1.75, 1.7, -0.75), new Vector3(-1.45, 1.35, -0.7)];
  b.box(M.enamel, sub(F, -2.6, 0.32, -0.4), 0.5, 0.36, 0.5, LIGHT);
  for (let i = 0; i < 3; i++) {
    const [m, len] = bar(l, arm[i]!, arm[i + 1]!);
    b.box(M.enamel, m, 0.16 - i * 0.03, len, 0.16 - i * 0.03, LIGHT);
  }
  neon(c, 'cyan', lm(l, -1.45, 1.3, -0.7), 0.08, 0.12, 0.08);
  const box = sub(F, 3.4, 0.84, -3.2);
  b.box(M.carPaint, box, 1.0, 1.4, 0.6, [0.38, 0.42, 0.5]);
  neon(c, 'cyan', sub(box, 0, 0.35, 0.31), 0.6, 0.32, 0.01);
  // Cyan cross on a pole at the south front corner, facing south (the camera).
  b.box(M.iron, sub(F, 4.75, 1.6, 3.2), 0.1, 3.0, 0.1, LIGHT);
  b.box(M.iron, sub(F, 4.7, 3.42, 3.2), 0.04, 0.95, 0.95, DARK);
  neon(c, 'cyan', sub(F, 4.74, 3.42, 3.2), 0.06, 0.24, 0.8);
  neon(c, 'cyan', sub(F, 4.74, 3.42, 3.2), 0.06, 0.8, 0.24);
  b.light(lp(l, 0, 2.4, 5), 0x43d1cf, 12, 11, 0.12, 5);
}

// ---------------------------------------------------------------- U Potsdamer Platz

/**
 * U2 entrance (photo: Wikimedia "Eingang Fünfeck-Emblem"): a straight stair between low walls with dark
 * green railings, handrails lit from below, and over the far end the green frame with the pentagon sign
 * (white U and "Potsdamer Platz" on blue). Plus the U square on a pole. The stair runs down to the north;
 * the map ground cannot open, so the well is faked with treads darkening into a black bottom.
 */
function ubahn(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = lm(l);
  const W = 2.5, z0 = 2.7, n = 13, tl = 0.38;
  b.solid.excludeOccluder(() => {
    b.box(M.dark, sub(F, 0, 0.012, z0 - (n * tl) / 2 - 0.3), W, 0.02, n * tl + 0.6);
    for (let i = 0; i < n; i++) {
      const k = 0.85 * Math.pow(1 - i / n, 1.5) + 0.04;
      b.box(M.concrete, sub(F, 0, 0.03, z0 - (i + 0.5) * tl + 0.02), W, 0.025, tl - 0.05, [k, k, k * 1.03]);
    }
    for (const s of [-1, 1]) {
      neon(c, 'amber', sub(F, s * (W / 2 - 0.1), 0.05, z0 - (n * tl) / 2 + 0.2), 0.05, 0.02, n * tl - 0.6);
      b.box(N.sandstone, sub(F, s * (W / 2 + 0.16), 0.17, 0), 0.32, 0.34, 5.8, STONE);
    }
    b.box(N.sandstone, sub(F, 0, 0.17, -2.8), W + 0.64, 0.34, 0.32, STONE);
    // Railings: posts, top and mid rails, bars.
    const rail = (x0: number, z0r: number, x1: number, z1r: number): void => {
      const len = Math.hypot(x1 - x0, z1r - z0r), m = sub(F, (x0 + x1) / 2, 0, (z0r + z1r) / 2, Math.atan2(-(z1r - z0r), x1 - x0));
      for (const y of [1.15, 0.5]) b.box(M.enamel, sub(m, 0, y, 0), len, 0.05, 0.05, GREEN);
      const nb = Math.round(len / 0.28);
      for (let j = 0; j <= nb; j++) b.box(M.enamel, sub(m, -len / 2 + (j * len) / nb, 0.75, 0), j % 4 ? 0.025 : 0.06, j % 4 ? 0.8 : 0.82, j % 4 ? 0.025 : 0.06, GREEN);
    };
    rail(-1.41, 2.85, -1.41, -2.8);
    rail(1.41, 2.85, 1.41, -2.8);
    rail(-1.41, -2.8, 1.41, -2.8);
    // The pentagon sign frame over the far end, facing the stair (south).
    for (const s of [-1, 1]) b.box(M.enamel, sub(F, s * 1.5, 1.9, -2.82), 0.14, 3.8, 0.14, GREEN);
    b.box(M.enamel, sub(F, 0, 2.95, -2.86), 3.0, 1.55, 0.1, GREEN);
    card(c, A.ubahn, sub(F, 0, 2.95, -2.8), 2.8, 1.4);
    // U square on a grey pole, both sides, a lamp below it.
    b.box(M.iron, sub(F, 1.62, 1.65, 2.8), 0.1, 3.3, 0.1, [1.4, 1.42, 1.45]);
    card(c, A.uSign, sub(F, 1.62, 3.0, 2.86), 0.72, 0.72);
    card(c, A.uSign, sub(F, 1.62, 3.0, 2.74, Math.PI), 0.72, 0.72);
    neon(c, 'white', sub(F, 1.62, 2.58, 2.8), 0.3, 0.05, 0.16);
  });
  b.light(lp(l, 0, 1.4, 0.6), 0xbfd8ff, 10, 9, 0.02, 3.4);
}

// ---------------------------------------------------------------- Mauerstücke

/**
 * Berlin Wall segments (UL 12.41: 3.6 m tall, 1.2 m wide, thin slab on an L foot) in pairs, painted on the
 * front with the 2D mural colours, the bear stencil and tags (atlas murals); one leans. Red and white
 * striped barriers (2D `drawBarrier`) between them.
 */
function mauerstuecke(c: MCtx, l: Landmark): void {
  const { b, M } = c, rng = new Rng(1961), CON: RGB = [0.95, 0.93, 0.87];
  [-5.7, -4.5, -1.2, 0, 3.4, 4.6].forEach((x, i) => {
    const m = sub(lm(l, x, 0, 0, rng.range(-0.05, 0.05)), 0, 0, 0, 0, i === 3 ? -0.06 : 0);
    b.box(M.concrete, sub(m, 0, 1.8, 0.24), 1.2, 3.6, 0.22, CON);
    b.box(M.concrete, sub(m, 0, 0.5, -0.02), 1.2, 1.0, 0.3, CON);
    b.box(M.concrete, sub(m, 0, 0.16, -0.38), 1.2, 0.32, 0.8, [0.85, 0.83, 0.78]);
    card(c, mural(i === 1 ? 1 : i === 4 ? 5 : rng.int(MURALS)), sub(m, 0, 1.8, 0.362), 1.2, 3.6);
    if (i === 5) for (const dx of [-0.3, 0.2]) b.box(M.rust, sub(m, dx, 3.75, 0.24, 0, 0, dx), 0.03, 0.4, 0.03);
  });
  for (const x of [-2.8, 1.9, 6.3]) {
    const m = lm(l, x, 0, 0.35, rng.range(-0.1, 0.1));
    for (const s of [-1, 1]) b.box(M.iron, sub(m, s * 0.5, 0.5, 0), 0.05, 1.0, 0.05, [1.2, 1.2, 1.2]);
    for (const s of [-1, 1]) b.box(M.iron, sub(m, s * 0.5, 0.03, 0), 0.08, 0.06, 0.5, [1.2, 1.2, 1.2]);
    for (let k = 0; k < 5; k++) b.box(M.enamel, sub(m, -0.48 + k * 0.24, 0.85, 0), 0.24, 0.26, 0.04, k % 2 ? [0.8, 0.2, 0.16] : [1.05, 1.0, 0.9]);
  }
}

/** Builds the south kinds; false for kinds that are not this file's. */
export function buildSouth(c: MCtx, l: Landmark): boolean {
  switch (l.kind) {
    case 'sony': sony(c, l); return true;
    case 'stage': stage(c, l); return true;
    case 'bahntower': bahntower(c, l); return true;
    case 'kollhoff': kollhoff(c, l); return true;
    case 'verkehrsturm': verkehrsturm(c, l); return true;
    case 'klinik': klinik(c, l); return true;
    case 'ubahn': ubahn(c, l); return true;
    case 'mauerstuecke': mauerstuecke(c, l); return true;
    default: return false;
  }
}
