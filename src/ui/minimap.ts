// Minimap (M11b, variant M1 chosen by Johannes 2026-11-15): round, top left, follows the hero, north
// up (the camera looks north, so map up is screen up). Background is the map SVG drawn once into a
// canvas; hero, objective and enemies are drawn on top about ten times a second. Tap opens the map.
// Edge markers (2D port, `js/render.js` in the 2D repo): a triangle at the screen edge points to the
// objective while it is off screen, and to the last enemies of a wave.
import type { MapDef, Lot } from '../data/map';
import { mapSvg } from '../data/map-svg';

const SIZE = 132;
/** Meters shown across the minimap. */
const SPAN = 110;
/** Pixels per meter of the background canvas. */
const PPM = 2;

export interface MiniEnemy {
  x: number;
  z: number;
  boss: boolean;
}

/** Rare and better drops (2D render.js:170). */
export interface MiniLoot {
  x: number;
  z: number;
  color: string;
}

export interface MiniTarget {
  x: number;
  z: number;
  r: number;
}

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private bgDone = -1;
  private t = 0;

  constructor(private readonly def: MapDef, private readonly lots: Lot[], onTap: () => void) {
    this.canvas = document.getElementById('minimap') as HTMLCanvasElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.canvas.addEventListener('click', onTap);
  }

  show(on: boolean): void {
    this.canvas.hidden = !on;
  }

  /** Redraws the background when the won-encounter count changes (won ones are dimmed). */
  private background(done: number): void {
    if (done === this.bgDone) return;
    this.bgDone = done;
    const B = this.def.bounds;
    const svg = mapSvg(this.def, this.lots, { trees: false, done, labels: false });
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.ceil((B.maxX - B.minX) * PPM);
      c.height = Math.ceil((B.maxZ - B.minZ) * PPM);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      this.bg = c;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  update(dt: number, done: number, hero: { x: number; z: number; facing: number }, target: MiniTarget | null, enemies: MiniEnemy[], loot: MiniLoot[] = []): void {
    if (this.canvas.hidden) return;
    this.background(done);
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.1;
    const g = this.ctx;
    const k = SIZE / SPAN;
    const B = this.def.bounds;
    const sx = (x: number): number => SIZE / 2 + (x - hero.x) * k;
    const sz = (z: number): number => SIZE / 2 + (z - hero.z) * k;
    g.clearRect(0, 0, SIZE, SIZE);
    g.save();
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#0d1113';
    g.fillRect(0, 0, SIZE, SIZE);
    if (this.bg) {
      const half = SPAN / 2;
      g.drawImage(this.bg, (hero.x - half - B.minX) * PPM, (hero.z - half - B.minZ) * PPM, SPAN * PPM, SPAN * PPM, 0, 0, SIZE, SIZE);
    }
    if (target) {
      g.strokeStyle = '#43d1cf';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx(target.x), sz(target.z), Math.max(3, target.r * k), 0, Math.PI * 2);
      g.stroke();
    }
    for (const e of enemies) {
      g.fillStyle = e.boss ? '#ff6a2a' : '#c23a2e';
      const r = e.boss ? 3.5 : 2;
      g.fillRect(sx(e.x) - r, sz(e.z) - r, r * 2, r * 2);
    }
    for (const l of loot) {
      g.fillStyle = l.color;
      g.strokeStyle = '#000';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(sx(l.x), sz(l.z), 3, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.restore();
    // Hero: arrow along the facing (θ means direction (sin θ, cos θ) in XZ; +Z is screen down).
    g.save();
    g.translate(SIZE / 2, SIZE / 2);
    g.rotate(Math.PI - hero.facing);
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(0, 2.5);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}

/** Triangles at the screen edge for off-screen targets. Screen positions in CSS pixels. */
export class EdgeMarkers {
  private readonly pool: HTMLDivElement[] = [];

  constructor() {
    const root = document.getElementById('edges')!;
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div');
      d.className = 'edge';
      d.hidden = true;
      root.appendChild(d);
      this.pool.push(d);
    }
  }

  /** `marks`: screen points (may be off screen) and a color. Only off-screen ones get a triangle. */
  update(marks: Array<{ x: number; y: number; color: string }>): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    let n = 0;
    for (const m of marks) {
      if (n >= this.pool.length) break;
      if (m.x >= 0 && m.x <= W && m.y >= 0 && m.y <= H) continue;
      // Same placement as 2D: along the ray from the center, clamped inside HUD margins.
      const a = Math.atan2(m.y - H / 2, m.x - W / 2);
      const ex = Math.min(W - 40, Math.max(40, W / 2 + Math.cos(a) * W));
      const ey = Math.min(H - 130, Math.max(80, H / 2 + Math.sin(a) * H));
      const d = this.pool[n++]!;
      d.hidden = false;
      d.style.transform = `translate(${ex.toFixed(0)}px, ${ey.toFixed(0)}px) rotate(${a.toFixed(3)}rad)`;
      d.style.setProperty('--c', m.color);
    }
    for (let i = n; i < this.pool.length; i++) this.pool[i]!.hidden = true;
  }
}
