// Debug overlays. ?debug=hit draws every collision and hit shape in 3D; ?debug=flow adds the flow field.
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three';
import { PLAYER } from '../data/combat';
import type { Collider } from '../sim/collide';
import { lerp } from '../sim/math';
import type { Sim } from '../sim/types';
import { FX_LAYER } from './world';

const MAX_VERTS = 60000;
type RGB = readonly [number, number, number];
const STATIC: RGB = [0.3, 0.75, 1];
const BODY: RGB = [0.3, 1, 0.4];
const HURT: RGB = [1, 0.25, 0.2];
const WEAPON: RGB = [1, 0.95, 0.3];
const IFRAME: RGB = [0.6, 0.6, 1];

export class HitDebug {
  readonly lines: LineSegments;
  private readonly pos = new Float32Array(MAX_VERTS * 3);
  private readonly col = new Float32Array(MAX_VERTS * 3);
  private n = 0;

  constructor(private readonly showFlow: boolean) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    this.lines = new LineSegments(g, new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, fog: false }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 100;
    this.lines.layers.set(FX_LAYER);
  }

  private seg(x0: number, z0: number, x1: number, z1: number, c: RGB, y = 0.06): void {
    if (this.n + 2 > MAX_VERTS) return;
    this.pos.set([x0, y, z0, x1, y, z1], this.n * 3);
    this.col.set([c[0], c[1], c[2], c[0], c[1], c[2]], this.n * 3);
    this.n += 2;
  }

  private circle(x: number, z: number, r: number, c: RGB): void {
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      this.seg(x + Math.cos(a0) * r, z + Math.sin(a0) * r, x + Math.cos(a1) * r, z + Math.sin(a1) * r, c);
    }
  }

  private box(b: Extract<Collider, { kind: 'box' }>, c: RGB): void {
    const cos = Math.cos(b.rot);
    const sin = Math.sin(b.rot);
    const corner = (lx: number, lz: number): [number, number] => [b.x + lx * cos + lz * sin, b.z - lx * sin + lz * cos];
    const p = [corner(-b.hx, -b.hz), corner(b.hx, -b.hz), corner(b.hx, b.hz), corner(-b.hx, b.hz)];
    for (let i = 0; i < 4; i++) {
      const a = p[i] as [number, number];
      const d = p[(i + 1) % 4] as [number, number];
      this.seg(a[0], a[1], d[0], d[1], c);
    }
  }

  /** Annular sector outline in the sim's angle convention. */
  private sector(x: number, z: number, facing: number, lo: number, hi: number, inner: number, outer: number, c: RGB): void {
    const steps = Math.max(2, Math.ceil(((hi - lo) / Math.PI) * 16));
    const pt = (a: number, r: number): [number, number] => [x + Math.sin(facing + a) * r, z + Math.cos(facing + a) * r];
    for (let i = 0; i < steps; i++) {
      const a0 = lerp(lo, hi, i / steps);
      const a1 = lerp(lo, hi, (i + 1) / steps);
      for (const r of [inner, outer]) {
        const p0 = pt(a0, r);
        const p1 = pt(a1, r);
        this.seg(p0[0], p0[1], p1[0], p1[1], c);
      }
    }
    for (const a of [lo, hi]) {
      const p0 = pt(a, inner);
      const p1 = pt(a, outer);
      this.seg(p0[0], p0[1], p1[0], p1[1], c);
    }
  }

  update(sim: Sim, alpha: number): void {
    this.n = 0;
    for (const c of sim.colliders) {
      if (c.kind === 'circle') this.circle(c.x, c.z, c.r, STATIC);
      else this.box(c, STATIC);
    }
    const p = sim.player;
    const px = lerp(p.px, p.x, alpha);
    const pz = lerp(p.pz, p.z, alpha);
    this.circle(px, pz, PLAYER.radius, p.invuln > 0 ? IFRAME : BODY);
    this.seg(px, pz, px + Math.sin(p.facing) * 0.8, pz + Math.cos(p.facing) * 0.8, BODY);
    if (p.attack) {
      const a = p.attack;
      // Whole arc of the attack, and the slice that is live this step.
      this.sector(px, pz, p.facing, Math.min(a.from, a.to) - a.width, Math.max(a.from, a.to) + a.width, a.inner, a.reach, [0.5, 0.45, 0.15]);
      if (p.sweeping) this.sector(px, pz, p.facing, p.sweepLo, p.sweepHi, a.inner, a.reach, WEAPON);
    }
    for (const e of sim.enemies) {
      if (e.state === 'dead') continue;
      const x = lerp(e.px, e.x, alpha);
      const z = lerp(e.pz, e.z, alpha);
      this.circle(x, z, e.def.radius, e.state === 'stagger' ? WEAPON : HURT);
      if (e.state === 'windup' || e.state === 'strike') {
        this.sector(x, z, e.facing, -e.def.halfAngle, e.def.halfAngle, 0, e.def.reach, e.state === 'strike' ? WEAPON : [0.7, 0.2, 0.15]);
      }
    }
    if (this.showFlow) {
      const f = sim.flow;
      for (let r = 0; r < f.rows; r++) {
        for (let c = 0; c < f.cols; c++) {
          const i = r * f.cols + c;
          const x = f.bounds.minX + (c + 0.5) * f.cell;
          const z = f.bounds.minZ + (r + 0.5) * f.cell;
          if (f.blocked[i]) {
            this.seg(x - 0.1, z - 0.1, x + 0.1, z + 0.1, [0.5, 0.2, 0.2]);
            continue;
          }
          this.seg(x, z, x + (f.dirX[i] as number) * 0.22, z + (f.dirZ[i] as number) * 0.22, [0.4, 0.6, 0.5]);
        }
      }
    }
    const g = this.lines.geometry;
    g.setDrawRange(0, this.n);
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }
}

/** Rolling frame statistics for ?debug=perf and the headless perf run. */
export class PerfStats {
  private readonly frames = new Float32Array(240);
  private i = 0;
  private filled = 0;
  calls = 0;
  triangles = 0;
  simMs = 0;

  frame(ms: number): void {
    this.frames[this.i] = ms;
    this.i = (this.i + 1) % this.frames.length;
    this.filled = Math.min(this.frames.length, this.filled + 1);
  }

  get fps(): number {
    if (!this.filled) return 0;
    let sum = 0;
    for (let k = 0; k < this.filled; k++) sum += this.frames[k] as number;
    return 1000 / (sum / this.filled);
  }

  get p95(): number {
    if (!this.filled) return 0;
    const sorted = Array.from(this.frames.subarray(0, this.filled)).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] as number;
  }
}
