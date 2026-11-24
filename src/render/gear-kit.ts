// Kit for the hero's rigid gear (WP4 step 2, D2 mechanism 2): the weapon parts kit plus fitting. Parts
// are authored in hero bind space (meters, +Y up, +Z front, T-pose: arms along ±X, the hero's left at +X)
// and tagged with the bone they ride on. Fitted parts measure the hero's own surfaces: a sampler collects
// the bind positions of some mesh nodes round an axis, and `radius(t, angle)` is the outermost surface at
// that height and angle, so belts, hats, shafts and plates hug the coat, the hair or the leg they cover.
import { BufferAttribute, BufferGeometry, Matrix4, Vector3, type Object3D, type SkinnedMesh } from 'three';
import { Parts, bright, cloth, knit, metal, plain, straw, tweed, wood, type Paint } from './weapons';

export type { Paint };
export { bright, cloth, knit, metal, plain, straw, tweed, wood };
/** A glowing gear part in its own colour (the gear glow material takes the vertex colour as emission). */
export const glow = (hex: number): Paint => ({ slot: 'glow', hex, grain: 2 });

/** Bind positions of the hero's meshes and bones; built from the loaded model or, in tests, from the GLB. */
export interface HeroSource {
  /** Vertices drawn by each mesh node (an index range of a shared buffer counts only its own vertices). */
  readonly meshes: ReadonlyMap<string, Float32Array>;
  readonly bones: ReadonlyMap<string, Vector3>;
}

const sources = new WeakMap<Object3D, HeroSource>();

/** Bind-space source of a loaded hero model (its meshes sit at the origin with identity transforms). */
export function heroSource(model: Object3D): HeroSource {
  let s = sources.get(model);
  if (s) return s;
  const meshes = new Map<string, Float32Array>(), bones = new Map<string, Vector3>();
  const m = new Matrix4();
  model.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.attributes.position!, idx = mesh.geometry.index;
    const used = idx ? [...new Set(Array.from({ length: idx.count }, (_, i) => idx.getX(i)))] : Array.from({ length: pos.count }, (_, i) => i);
    const out = new Float32Array(used.length * 3);
    used.forEach((v, i) => out.set([pos.getX(v), pos.getY(v), pos.getZ(v)], i * 3));
    meshes.set(mesh.name, out);
    if (mesh.isSkinnedMesh) mesh.skeleton.bones.forEach((b, i) => { if (!bones.has(b.name)) bones.set(b.name, new Vector3().setFromMatrixPosition(m.copy(mesh.skeleton.boneInverses[i]!).invert())); });
  });
  s = { meshes, bones };
  sources.set(model, s);
  return s;
}

/** An axis: origin, direction (unit) and the direction of angle 0 (unit, across `d`). */
export interface Axis { o: Vector3; d: Vector3; u: Vector3 }
export const axis = (o: readonly [number, number, number], d: readonly [number, number, number], u: readonly [number, number, number]): Axis =>
  ({ o: new Vector3(...o), d: new Vector3(...d).normalize(), u: new Vector3(...u).normalize() });

/** Standard axes. Angles: 0 at the front (+Z); round the body +π/2 is the hero's left (+X). */
export const AXES = {
  torso: axis([0, 0, -0.02], [0, 1, 0], [0, 0, 1]),
  head: axis([0, 0, -0.025], [0, 1, 0], [0, 0, 1]),
  leg: (s: 1 | -1): Axis => axis([0.111 * s, 0, -0.045], [0, 1, 0], [0, 0, 1]),
  foot: (s: 1 | -1): Axis => axis([0.111 * s, 0, 0.02], [0, 1, 0], [0, 0, 1]),
  /** Along the T-pose arm from the shoulder line outwards; angle 0 front, +π/2 down on the left arm. */
  arm: (s: 1 | -1): Axis => axis([0, 1.418, -0.056], [s, 0, 0], [0, 0, 1]),
};

const _p = new Vector3(), _e2 = new Vector3();

/** Samples of some meshes round an axis: height along the axis, angle, distance. */
export class Sampler {
  private readonly t: Float32Array;
  private readonly a: Float32Array;
  private readonly r: Float32Array;
  private readonly e2: Vector3;

  /** `minX`: only vertices with x × sign(minX) > |minX| (one leg or arm, not the other). */
  constructor(src: HeroSource, nodes: readonly string[], readonly ax: Axis, minX = 0) {
    this.e2 = new Vector3().crossVectors(ax.d, ax.u);
    const all = nodes.flatMap((n) => { const p = src.meshes.get(n); return p ? [p] : []; });
    const sx = Math.sign(minX), mx = Math.abs(minX);
    const kept: number[] = [];
    for (const p of all) for (let k = 0; k < p.length; k += 3) if (!sx || p[k]! * sx > mx) kept.push(p[k]!, p[k + 1]!, p[k + 2]!);
    const n = kept.length / 3;
    this.t = new Float32Array(n); this.a = new Float32Array(n); this.r = new Float32Array(n);
    let i = 0;
    for (const p of [kept]) for (let k = 0; k < p.length; k += 3, i++) {
      _p.set(p[k]!, p[k + 1]!, p[k + 2]!).sub(ax.o);
      const t = _p.dot(ax.d);
      _p.addScaledVector(ax.d, -t);
      this.t[i] = t;
      this.a[i] = Math.atan2(_p.dot(this.e2), _p.dot(ax.u));
      this.r[i] = _p.length();
    }
  }

  /** Outermost distance at height `t` and angle `a` (slab ±`dt`, wedge ±`da`), widening the search if empty; 0 if nothing is near. */
  radius(t: number, a: number, dt = 0.012, da = Math.PI / 14): number {
    for (let tries = 0; tries < 4; tries++, dt *= 1.8, da *= 1.5) {
      let best = 0;
      for (let i = 0; i < this.t.length; i++) {
        if (Math.abs(this.t[i]! - t) > dt) continue;
        let d = Math.abs(this.a[i]! - a);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d <= da && this.r[i]! > best) best = this.r[i]!;
      }
      if (best > 0) return best;
    }
    return 0;
  }

  /** Bind-space point at height `t`, angle `a`, distance `r` from the axis. */
  point(t: number, a: number, r: number, out = new Vector3()): Vector3 {
    _e2.copy(this.e2).multiplyScalar(Math.sin(a) * r);
    return out.copy(this.ax.o).addScaledVector(this.ax.d, t).addScaledVector(this.ax.u, Math.cos(a) * r).add(_e2);
  }

  /** Outward direction (unit) at angle `a`. */
  out(a: number, v = new Vector3()): Vector3 {
    return v.copy(this.ax.u).multiplyScalar(Math.cos(a)).addScaledVector(this.e2, Math.sin(a));
  }
}

export interface SurfaceOpts {
  /** Angle range; the full circle by default (closed). */
  a0?: number;
  a1?: number;
  segs?: number;
  rows?: number;
  /** Extra distance (m) out of the measured surface, may vary over the surface (v 0..1 along t, u 0..1 along the angle). */
  offset?: number | ((u: number, v: number) => number);
  /** Smoothing passes of the measured radii round the angle (fills gaps, removes bumps). */
  smooth?: number;
  /** Fixed radius instead of the measured one (a cylinder round the axis). */
  radius?: number | ((u: number, v: number) => number);
  /** Never smaller than this (m). */
  min?: number;
  /** Median window round the angle before smoothing: removes narrow bumps (a buckle, a pouch). */
  median?: number;
}

/** A fitted surface between heights t0 and t1, `rows` × `segs`, with planar UVs 0..1 (u round, v along). */
export function surface(s: Sampler, t0: number, t1: number, o: SurfaceOpts = {}): BufferGeometry {
  const a0 = o.a0 ?? -Math.PI, a1 = o.a1 ?? Math.PI, segs = o.segs ?? 24, rows = o.rows ?? 2;
  const closed = o.a0 === undefined && o.a1 === undefined;
  const grid: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = r / rows, t = t0 + (t1 - t0) * v;
    let ring: number[] = [];
    for (let j = 0; j <= segs; j++) {
      const u = j / segs;
      const fixed = typeof o.radius === 'function' ? o.radius(u, v) : o.radius;
      ring.push(fixed ?? s.radius(t, a0 + (a1 - a0) * u));
    }
    // Fill empty samples from their neighbours, then smooth.
    for (let k = 0; k < ring.length; k++) if (!ring[k]) ring[k] = ring.find((x) => x > 0) ?? 0.05;
    if (o.median) {
      const h = Math.floor(o.median / 2), src = ring.slice(), L = closed ? src.length - 1 : src.length;
      ring = src.map((_, k) => {
        const win: number[] = [];
        for (let d = -h; d <= h; d++) win.push(src[closed ? (k + d + L) % L : Math.min(L - 1, Math.max(0, k + d))]!);
        return win.sort((x, y) => x - y)[h]!;
      });
      if (closed) ring[ring.length - 1] = ring[0]!;
    }
    for (let pass = 0; pass < (o.smooth ?? (o.radius !== undefined ? 0 : 2)); pass++) {
      ring = ring.map((x, k) => {
        const p = ring[closed ? (k - 1 + ring.length - 1) % (ring.length - 1) : Math.max(0, k - 1)]!, q = ring[closed ? (k + 1) % (ring.length - 1) : Math.min(ring.length - 1, k + 1)]!;
        return Math.max(x, (p + 2 * x + q) / 4);
      });
      if (closed) ring[ring.length - 1] = ring[0]!;
    }
    grid.push(ring.map((x, j) => Math.max(o.min ?? 0, x + (typeof o.offset === 'function' ? o.offset(j / segs, v) : o.offset ?? 0))));
  }
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = new Vector3();
  for (let r = 0; r <= rows; r++) {
    const v = r / rows, t = t0 + (t1 - t0) * v;
    for (let j = 0; j <= segs; j++) {
      const u = j / segs;
      s.point(t, a0 + (a1 - a0) * u, grid[r]![j]!, p);
      pos.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
  }
  const w = segs + 1;
  for (let r = 0; r < rows; r++) for (let j = 0; j < segs; j++) {
    const a = r * w + j, b = a + 1, c = a + w, d = c + 1;
    // Wound so the normal points out of the axis.
    idx.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normals out of the axis whatever the axis' handedness (the materials are double-sided anyway).
  const n = g.attributes.normal!, c = new Vector3(), q = new Vector3();
  let flip = 0;
  for (let i = 0; i < n.count; i++) {
    c.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!).sub(s.ax.o);
    c.addScaledVector(s.ax.d, -c.dot(s.ax.d));
    flip += q.set(n.getX(i), n.getY(i), n.getZ(i)).dot(c) < 0 ? 1 : -1;
  }
  if (flip > 0) {
    const ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); }
    g.computeVertexNormals();
  }
  return g;
}

/** Builder context of one gear part: the kit's parts plus the hero's samplers. */
export class GearKit {
  readonly parts = new Parts();
  private readonly samplers = new Map<string, Sampler>();

  constructor(readonly src: HeroSource) {}

  /** Parts added inside `fn` ride on `bone`. */
  on(bone: string, fn: () => void): void {
    const prev = this.parts.tag;
    this.parts.tag = bone;
    fn();
    this.parts.tag = prev;
  }

  add(geo: BufferGeometry, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): this {
    this.parts.add(geo, paint, x, y, z, rx, ry, rz);
    return this;
  }

  /** Parts added inside `fn` are moved by `m` (a local frame: a hat round the head, a buckle on the belt). */
  frame(m: Matrix4, fn: () => void): void {
    this.parts.frame(m, fn);
  }

  /** A sampler of `nodes` round `ax` (cached per kit); `minX` keeps one side (see `Sampler`). */
  sampler(nodes: readonly string[], ax: Axis, minX = 0): Sampler {
    const key = `${nodes.join(',')}|${ax.o.toArray().join(',')}|${ax.d.toArray().join(',')}|${ax.u.toArray().join(',')}|${minX}`;
    let s = this.samplers.get(key);
    if (!s) this.samplers.set(key, (s = new Sampler(this.src, nodes, ax, minX)));
    return s;
  }

  /** Sampler of one leg (trousers and boots, or `nodes`), without the other leg. */
  leg(s: 1 | -1, nodes: readonly string[] = ['f_stiefel', 'a_weste']): Sampler {
    return this.sampler(nodes, AXES.leg(s), 0.012 * s);
  }

  /** Sampler of one T-pose arm (sleeve, glove, or `nodes`), from the shoulder outwards. */
  arm(s: 1 | -1, nodes: readonly string[]): Sampler {
    return this.sampler(nodes, AXES.arm(s), 0.12 * s);
  }

  bone(name: string): Vector3 {
    return (this.src.bones.get(name) ?? new Vector3()).clone();
  }
}

/** Frame at bind point `p` whose axes are `x`, `y`, `z` (columns), for parts laid on a surface. */
export function basis(p: Vector3, x: Vector3, y: Vector3, z: Vector3): Matrix4 {
  return new Matrix4().makeBasis(x, y, z).setPosition(p);
}

/**
 * Frame on a sampler's surface at height `t` and angle `a`, `lift` m out of it: +Z points out of the
 * surface, +Y along the axis, +X round it. Parts built facing +Z sit flat on the body.
 */
export function onSurface(s: Sampler, t: number, a: number, lift = 0.006, r?: number): Matrix4 {
  const out = s.out(a), up = s.ax.d.clone(), side = new Vector3().crossVectors(up, out);
  return basis(s.point(t, a, (r ?? s.radius(t, a)) + lift), side, up, out);
}

/** Sampler of the hair, skull and brows round the head axis (hat bands and visors; the hat shells use `HeadMap` in gear-head.ts). */
export function headSampler(k: GearKit): Sampler {
  return k.sampler(['hair', 'body_head', 'Eyebrows'], AXES.head);
}
