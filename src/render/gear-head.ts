// Hats (WP4 step 2b): every hat rides on the `Head` bone like the hair. Shells are fitted to a map of the
// hair and skull seen from inside the head (`HeadMap`): smooth, symmetric, never inside a strand, so a hat
// sits on the hair instead of in it. Looks: docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19).
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { basis, bright, cloth, glow, headSampler, knit as knitCells, metal, plain, straw as strawCells, tweed as tweedCells, type GearKit, type HeroSource, type Sampler } from './gear-kit';
import type { GearBuilder } from './gear';
import { ball, box, cone, cyl, flat, ring } from './weapons';

const DEG = Math.PI / 180;
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
/** `f` remembered per argument (rim elevations are asked once per row). */
const memo = (f: (a: number) => number): ((a: number) => number) => { const m = new Map<number, number>(); return (a) => { let v = m.get(a); if (v === undefined) m.set(a, (v = f(a))); return v; }; };
/** Direction of elevation `e` and angle `a` (0 front +Z, +π/2 the hero's left +X). */
const dir = (e: number, a: number, out = new Vector3()): Vector3 => out.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));

/**
 * Some meshes seen from a point `c` inside the head: the outermost distance per direction (angle × elevation
 * bins). Mirrored left to right, dilated, then blurred less than dilated, so every value stays ≥ each vertex
 * near it: a shell at this distance + lift is smooth (no bumps over strands) and never inside the hair.
 */
export class HeadMap {
  static readonly NA = 64;
  static readonly NE = 44;
  static readonly E0 = -80 * DEG;
  static readonly E1 = 90 * DEG;
  private readonly d: Float32Array;

  constructor(src: HeroSource, nodes: readonly string[], readonly c: Vector3, dil = 2) {
    const { NA, NE, E0, E1 } = HeadMap;
    let d = new Float32Array(NA * NE);
    const v = new Vector3();
    for (const n of nodes) {
      const p = src.meshes.get(n);
      if (!p) continue;
      for (let k = 0; k < p.length; k += 3) {
        v.set(p[k]! - c.x, p[k + 1]! - c.y, p[k + 2]! - c.z);
        const r = v.length(), e = Math.asin(v.y / r), a = Math.atan2(v.x, v.z);
        const i = Math.min(NE - 1, Math.max(0, Math.floor(((e - E0) / (E1 - E0)) * NE))), j = Math.min(NA - 1, Math.floor(((a + Math.PI) / (2 * Math.PI)) * NA));
        if (r > d[i * NA + j]!) d[i * NA + j] = r;
      }
    }
    const at = (i: number, j: number): number => d[Math.min(NE - 1, Math.max(0, i)) * NA + ((j % NA) + NA) % NA]!;
    // Symmetric; empty bins from their neighbours; one value at the pole.
    for (let i = 0; i < NE; i++) for (let j = 0; j < NA / 2; j++) { const m = Math.max(at(i, j), at(i, NA - 1 - j)); d[i * NA + j] = m; d[i * NA + NA - 1 - j] = m; }
    for (let pass = 0, empty = 1; empty && pass < 60; pass++) {
      empty = 0;
      const next = d.slice();
      for (let i = 0; i < NE; i++) for (let j = 0; j < NA; j++) {
        if (at(i, j)) continue;
        empty++;
        let m = 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) m = Math.max(m, at(i + di, j + dj));
        next[i * NA + j] = m;
      }
      d = next;
    }
    let top = 0;
    for (let j = 0; j < NA; j++) top = Math.max(top, at(NE - 1, j));
    for (let j = 0; j < NA; j++) d[(NE - 1) * NA + j] = top;
    // Dilate (wider round the angle near the pole, where bins are narrow), then blur by one bin less.
    const dilated = new Float32Array(NA * NE);
    for (let i = 0; i < NE; i++) {
      const e = E0 + ((i + 0.5) / NE) * (E1 - E0), ka = Math.min(NA / 2, Math.ceil(dil / Math.max(0.12, Math.cos(e))));
      for (let j = 0; j < NA; j++) {
        let m = 0;
        for (let di = -dil; di <= dil; di++) for (let dj = -ka; dj <= ka; dj++) m = Math.max(m, at(i + di, j + dj));
        dilated[i * NA + j] = m;
      }
    }
    d = dilated;
    for (let pass = 0; pass < dil - 1; pass++) {
      const next = new Float32Array(NA * NE);
      for (let i = 0; i < NE; i++) for (let j = 0; j < NA; j++) {
        let s = 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) s += at(i + di, j + dj) * (di ? 1 : 2) * (dj ? 1 : 2);
        next[i * NA + j] = s / 16;
      }
      d = next;
    }
    this.d = d;
  }

  /** Smoothed outermost distance from `c` in direction (e, a). */
  dist(e: number, a: number): number {
    const { NA, NE, E0, E1 } = HeadMap;
    const fi = Math.min(NE - 1, Math.max(0, ((e - E0) / (E1 - E0)) * NE - 0.5)), fj = ((a + Math.PI) / (2 * Math.PI)) * NA - 0.5;
    const i0 = Math.floor(fi), j0 = Math.floor(fj), ti = fi - i0, tj = fj - j0;
    const g = (i: number, j: number): number => this.d[Math.min(NE - 1, i) * NA + ((j % NA) + NA) % NA]!;
    return mix(mix(g(i0, j0), g(i0, j0 + 1), tj), mix(g(i0 + 1, j0), g(i0 + 1, j0 + 1), tj), ti);
  }
}

const maps = new WeakMap<GearKit, Map<string, HeadMap>>();
/** Head maps per kit: `hair` (hair, skull, brows) and `face` (skull, brows and eyes only: masks under the hair). */
export function headMap(k: GearKit, kind: 'hair' | 'face'): HeadMap {
  let m = maps.get(k);
  if (!m) maps.set(k, (m = new Map()));
  let h = m.get(kind);
  if (!h) m.set(kind, (h = new HeadMap(k.src, kind === 'hair' ? ['hair', 'body_head', 'Eyebrows'] : ['body_head', 'Eyebrows', 'Eyes'], new Vector3(0, 1.64, -0.025))));
  return h;
}

/**
 * A hat's own form: a superellipsoid round (0, `y`, `z`) with front, back, up and down half-sizes; `n` > 2
 * boxier round the head, `m` > 2 flatter on top.
 */
interface Form { y: number; z?: number; rx: number; front: number; back: number; up: number; down: number; n?: number; m?: number }

const _u = new Vector3(), _w = new Vector3();
/** Distance from `c` along (e, a) to the form's surface (bisection; `c` is inside the form). */
function formDist(f: Form, c: Vector3, e: number, a: number): number {
  const n = f.n ?? 2, m = f.m ?? 2;
  dir(e, a, _u);
  const g = (t: number): number => {
    _w.set(c.x, c.y - f.y, c.z - (f.z ?? c.z)).addScaledVector(_u, t);
    const h = (Math.abs(_w.x / f.rx) ** n + Math.abs(_w.z / (_w.z > 0 ? f.front : f.back)) ** n) ** (m / n);
    return (h + Math.abs(_w.y / (_w.y > 0 ? f.up : f.down)) ** m) ** (1 / m);
  };
  let lo = 0, hi = 0.45;
  for (let i = 0; i < 16; i++) { const t = (lo + hi) / 2; if (g(t) < 1) lo = t; else hi = t; }
  return (lo + hi) / 2;
}

const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _d = new Vector3();

/** A shell round the head: the form, or `lift` outside the mapped hair where that is further out (a soft max). */
export class Shell {
  constructor(readonly map: HeadMap, readonly lift: number, readonly form?: Form, readonly soft = 0.012) {}

  r(e: number, a: number): number {
    const m = this.map.dist(e, a) + this.lift;
    if (!this.form) return m;
    const f = formDist(this.form, this.map.c, e, a);
    return (f + m + Math.sqrt((f - m) ** 2 + this.soft ** 2)) / 2;
  }

  point(e: number, a: number, extra = 0, out = new Vector3()): Vector3 {
    return dir(e, a, out).multiplyScalar(this.r(e, a) + extra).add(this.map.c);
  }

  /** Elevation where the shell (+ `extra`) is at height `y` on angle `a`. */
  eAt(y: number, a: number, extra = 0): number {
    let e = 0;
    for (let i = 0; i < 8; i++) e = Math.asin(Math.max(-0.98, Math.min(0.999, (y - this.map.c.y) / (this.r(e, a) + extra))));
    return e;
  }

  /** Elevation and angle of the direction from the centre to `p`. */
  ea(p: Vector3): [number, number] {
    _a.subVectors(p, this.map.c).normalize();
    return [Math.asin(_a.y), Math.atan2(_a.x, _a.z)];
  }

  /** Outward normal at (e, a), from the neighbouring points. */
  normal(e: number, a: number, out = new Vector3()): Vector3 {
    const h = 0.02, ce = Math.max(0.2, Math.cos(e));
    this.point(e + h, a, 0, _a).sub(this.point(e - h, a, 0, _b));
    this.point(e, a + h / ce, 0, _c).sub(this.point(e, a - h / ce, 0, _d));
    return out.crossVectors(_c, _a).normalize();
  }

  /** Frame on the shell at (e, a), `lift` out: +Z out of it, +Y up it, +X round it (to the hero's left at the front). */
  frame(e: number, a: number, lift = 0.004): Matrix4 {
    const z = this.normal(e, a), up = this.point(e + 0.02, a, 0, new Vector3()).sub(this.point(e - 0.02, a, 0, new Vector3()));
    const x = new Vector3().crossVectors(up, z).normalize(), y = new Vector3().crossVectors(z, x);
    return basis(this.point(e, a, lift), x, y, z);
  }

  /**
   * A grid on the shell: angle a0..a1 (full circle if both are left out) and elevation `e(a, v)` for v 0..1;
   * `extra(u, v)` m further out. UVs 0..1; normals out of the head.
   */
  geo(o: { a0?: number; a1?: number; segs: number; rows: number; e: (a: number, v: number) => number; extra?: number | ((u: number, v: number) => number) }): BufferGeometry {
    const a0 = o.a0 ?? -Math.PI, a1 = o.a1 ?? Math.PI;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const p = new Vector3();
    for (let r = 0; r <= o.rows; r++) for (let j = 0; j <= o.segs; j++) {
      const u = j / o.segs, v = r / o.rows, a = mix(a0, a1, u);
      this.point(o.e(a, v), a, typeof o.extra === 'function' ? o.extra(u, v) : o.extra ?? 0, p);
      pos.push(p.x, p.y, p.z);
      uv.push(u, v);
    }
    const w = o.segs + 1;
    for (let r = 0; r < o.rows; r++) for (let j = 0; j < o.segs; j++) { const a = r * w + j; idx.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); }
    return outward(mesh(pos, uv, idx), this.map.c);
  }

  /**
   * A strip on the shell along `path` ([e, a] points), `w` m wide, `lift` out and raised by `h(x)` across
   * (x −1..1): ridges, straps, crosses. `cols` quads across.
   */
  strip(path: ReadonlyArray<readonly [number, number]>, w: number, lift: number, h: (x: number) => number = () => 0, cols = 1): BufferGeometry {
    const pts = path.map(([e, a]) => this.point(e, a, 0, new Vector3()));
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const t = new Vector3(), n = new Vector3(), s = new Vector3(), q = new Vector3();
    pts.forEach((p, i) => {
      t.subVectors(pts[Math.min(pts.length - 1, i + 1)]!, pts[Math.max(0, i - 1)]!);
      n.subVectors(p, this.map.c).normalize();
      s.crossVectors(t, n).normalize();
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols) * 2 - 1;
        const [e, a] = this.ea(q.copy(p).addScaledVector(s, (x * w) / 2));
        this.point(e, a, lift + h(x), q);
        pos.push(q.x, q.y, q.z);
        uv.push(c / cols, i / (pts.length - 1));
      }
    });
    const W = cols + 1;
    for (let i = 0; i < pts.length - 1; i++) for (let c = 0; c < cols; c++) { const a = i * W + c; idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W); }
    return outward(mesh(pos, uv, idx), this.map.c);
  }

  /** Lays `g` (built facing +Z round its origin) onto the shell at (e, a): x round, y up, z out (+ `lift`). */
  wrap(g: BufferGeometry, e: number, a: number, lift: number): BufferGeometry {
    const p = g.attributes.position!, r = this.r(e, a);
    for (let i = 0; i < p.count; i++) {
      const ee = e + p.getY(i) / r, aa = a + p.getX(i) / (r * Math.max(0.2, Math.cos(ee)));
      this.point(ee, aa, lift + p.getZ(i), _a);
      p.setXYZ(i, _a.x, _a.y, _a.z);
    }
    g.computeVertexNormals();
    return g;
  }
}

function mesh(pos: number[], uv: number[], idx: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flips the winding if most normals point at `c` (the materials are double-sided; this is for the light). */
function outward(g: BufferGeometry, c: Vector3): BufferGeometry {
  const p = g.attributes.position!, n = g.attributes.normal!;
  let s = 0;
  for (let i = 0; i < p.count; i++) s += (p.getX(i) - c.x) * n.getX(i) + (p.getY(i) - c.y) * n.getY(i) + (p.getZ(i) - c.z) * n.getZ(i);
  if (s < 0) {
    const ix = g.index!;
    for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); }
    g.computeVertexNormals();
  }
  return g;
}

/**
 * A brim from the shell's rim (elevation `e(a)`) outwards, level: `w(a)` m wide, the edge `drop(a)` m lower
 * (`curve` 2 bends it down towards the edge, 1 a straight slope). One sheet (the material is double-sided)
 * and, with `thick`, an edge band. `t0`..`t1` (fractions of the width) and `lift` make a line on a brim.
 */
interface BrimOpts { e: (a: number) => number; w: (a: number) => number; drop?: (a: number) => number; curve?: number; thick?: number; segs: number; a0?: number; a1?: number; rows?: number; t0?: number; t1?: number; lift?: number }
function brim(sh: Shell, o: BrimOpts): BufferGeometry {
  const a0 = o.a0 ?? -Math.PI, a1 = o.a1 ?? Math.PI, rows = o.rows ?? 2, th = o.thick ?? 0, t0 = o.t0 ?? 0, t1 = o.t1 ?? 1, cv = o.curve ?? 2;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = new Vector3(), h = new Vector3();
  const R = rows + (th ? 2 : 1);
  for (let j = 0; j <= o.segs; j++) {
    const u = j / o.segs, a = mix(a0, a1, u);
    sh.point(o.e(a), a, -0.003, p);
    h.set(p.x - sh.map.c.x, 0, p.z - sh.map.c.z).normalize();
    const w = o.w(a), dr = o.drop?.(a) ?? 0;
    for (let r = 0; r < R; r++) {
      const t = mix(t0, t1, Math.min(1, r / rows)), edge = r > rows ? th : 0;
      pos.push(p.x + h.x * w * t, p.y - dr * t ** cv - edge + (o.lift ?? 0), p.z + h.z * w * t);
      uv.push(u, r / (R - 1));
    }
  }
  for (let j = 0; j < o.segs; j++) for (let r = 0; r < R - 1; r++) { const a = j * R + r, b = a + R; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = mesh(pos, uv, idx);
  // Normals up (the sheet's top is what the camera sees).
  const n = g.attributes.normal!;
  let s = 0;
  for (let i = 0; i < n.count; i++) s += n.getY(i);
  if (s < 0) { const ix = g.index!; for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); } g.computeVertexNormals(); }
  return g;
}

/** Rim height from front to back: `front` at angle 0, `back` at π, a cosine between. */
const rimY = (front: number, back: number) => (a: number): number => mix(back, front, (1 + Math.cos(a)) / 2);

/** Path along the head's mid line from the front (elevation `e0`) over the crown to the back (`e1`), `n` points. */
function midline(e0: number, e1: number, n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = mix(e0, Math.PI - e1, i / n);
    out.push(t <= Math.PI / 2 ? [t, 0] : [Math.PI - t, Math.PI]);
  }
  return out;
}

/** Path over the head in the plane x = `x` (beside the mid line), from angle `t0` over the crown to `t1` (rad from the front, up). */
function sidePath(sh: Shell, x: number, t0: number, t1: number, n: number): Array<[number, number]> {
  return Array.from({ length: n + 1 }, (_, i) => { const t = mix(t0, t1, i / n); return sh.ea(_b.set(x, Math.sin(t) * 0.12, Math.cos(t) * 0.12).add(sh.map.c)); });
}

// ---------------------------------------------------------------- hard hats

/** Hard hat: smooth shell on the forehead above the brows, a ridge front to back, brim wider at the front; `stripe` and `lamp` for the Kiezwache. */
function hardHat(k: GearKit, col: number, o: { stripe?: number; lamp?: number; sticker?: number; set?: boolean } = {}): void {
  k.on('Head', () => {
    const sh = new Shell(headMap(k, 'hair'), 0.012, { y: 1.69, rx: 0.118, front: 0.134, back: 0.13, up: 0.118, down: 0.12, n: 2.2, m: 2.2 });
    const rim = rimY(1.712, 1.678), eRim = memo((a) => sh.eAt(rim(a), a));
    // The Kiezwache's shell is lacquered (a set piece: richer, brighter).
    const shell = o.set ? bright(col) : plain(col), dark = plain(0x2a2a2c);
    k.add(sh.geo({ segs: 24, rows: 7, e: (a, v) => mix(eRim(a), Math.PI / 2, v) }), shell);
    // Brim: 3.6 cm at the front (level, so the eyes stay free), 1.6 at the sides, 2.2 at the back (a little down).
    const fr = (a: number): number => Math.max(0, Math.cos(a)) ** 2.5, bk = (a: number): number => Math.max(0, -Math.cos(a));
    k.add(brim(sh, { e: eRim, segs: 24, w: (a) => 0.016 + 0.02 * fr(a) + 0.006 * bk(a), drop: (a) => 0.006 * (1 - fr(a)) + 0.004 * bk(a), thick: 0.008 }), shell);
    // Ridge from the front over the crown to the back, a lower rib on each side beside it.
    // (Above the stripe and the lamp on the Kiezwache's.)
    const r0 = o.stripe ? sh.eAt(1.765, 0) : eRim(0) + 0.1, r1 = o.stripe ? sh.eAt(rim(Math.PI) + 0.054, Math.PI) : eRim(Math.PI) + 0.12;
    k.add(sh.strip(midline(r0, r1, 14), 0.024, 0, (x) => 0.008 * (1 - x * x), 2), shell);
    for (const s of [1, -1]) k.add(sh.strip(sidePath(sh, s * 0.05, 0.75, 2.1, 9), 0.014, 0, (x) => 0.004 * (1 - x * x), 2), shell);
    if (o.sticker) {
      // Red sticker on the hero's left side.
      k.add(sh.wrap(cyl(0.019, 0.019, 0.003, 12).rotateX(Math.PI / 2), 0.62, 1.15, 0.002), plain(o.sticker));
    }
    if (o.stripe) {
      // Reflective orange band round the shell and a thin light line on it.
      const band = (y0: number, y1: number, x: number) => sh.geo({ segs: 24, rows: 1, e: (a, v) => sh.eAt(mix(rim(a) + y0, rim(a) + y1, v), a, x), extra: x });
      k.add(band(0.022, 0.044, 0.003), plain(o.stripe));
      k.add(band(0.031, 0.035, 0.0045), plain(0xf4f0e4));
    }
    if (o.lamp) {
      // Head lamp at the front: clip, housing, rim and the glowing lens.
      const e = sh.eAt(1.742, 0);
      k.frame(sh.frame(e, 0, 0.004), () => {
        k.add(box(0.034, 0.03, 0.01), dark, 0, 0, 0.002);
        k.add(cyl(0.021, 0.024, 0.026, 10), metal(0x3a3c40), 0, 0.002, 0.018, Math.PI / 2);
        k.add(ring(0.019, 0.004, 3, 10), bright(0xc8ccd0), 0, 0.002, 0.031);
        k.add(cyl(0.016, 0.016, 0.004, 10), glow(o.lamp!), 0, 0.002, 0.031, Math.PI / 2);
      });
    }
  });
}

/** Rim heights at the front, the sides and the back (a smooth curve round the head). */
const rim3 = (front: number, side: number, back: number) => (a: number): number => {
  const c = Math.cos(a);
  return side + ((front - back) / 2) * c + ((front + back) / 2 - side) * c * c;
};

/** Presses `g` down onto the plane `top(z)` with a soft edge (`k` m): a flat crown. */
function press(g: BufferGeometry, top: (z: number) => number, k = 0.012): BufferGeometry {
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = top(p.getZ(i)); p.setY(i, (y + t - Math.sqrt((y - t) ** 2 + k * k)) / 2); }
  g.computeVertexNormals();
  return g;
}

/**
 * The outermost surface of `s` round the head between heights `y0(a)` and `y1(a)`, angle a0..a1: sampled
 * densely, left and right alike, median and smoothed round the head (no bumps over strands).
 */
export function fitRing(s: Sampler, a0: number, a1: number, y0: (a: number) => number, y1: (a: number) => number, n = 48): (a: number) => number {
  const at = (a: number): number => { let m = 0; for (let f = 0; f <= 1 + 1e-6; f += 0.25) m = Math.max(m, s.radius(mix(y0(a), y1(a), f), a, 0.006, Math.PI / 30)); return m; };
  let r = Array.from({ length: n + 1 }, (_, j) => { const a = mix(a0, a1, j / n); return Math.max(at(a), at(-a)); });
  const L = r.length;
  r = r.map((_, j) => [-2, -1, 0, 1, 2].map((d) => r[Math.min(L - 1, Math.max(0, j + d))]!).sort((x, y) => x - y)[2]!);
  for (let pass = 0; pass < 3; pass++) r = r.map((x, j) => Math.max(x, (r[Math.max(0, j - 1)]! + 2 * x + r[Math.min(L - 1, j + 1)]!) / 4));
  return (a) => { const f = Math.min(n, Math.max(0, ((a - a0) / (a1 - a0)) * n)), i = Math.min(n - 1, Math.floor(f)); return mix(r[i]!, r[i + 1]!, f - i); };
}

/** A band on the head at heights `y(a, v)` (v 0..1), angle a0..a1, at the fitted radius `r(a)` + `extra(u, v)`. */
export function band(s: Sampler, o: { a0: number; a1: number; segs: number; rows: number; y: (a: number, v: number) => number; r: (a: number) => number; extra: (u: number, v: number) => number }): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const q = new Vector3();
  for (let i = 0; i <= o.rows; i++) for (let j = 0; j <= o.segs; j++) {
    const u = j / o.segs, v = i / o.rows, a = mix(o.a0, o.a1, u);
    s.point(o.y(a, v), a, o.r(a) + o.extra(u, v), q);
    pos.push(q.x, q.y, q.z);
    uv.push(u, v);
  }
  const w = o.segs + 1;
  for (let i = 0; i < o.rows; i++) for (let j = 0; j < o.segs; j++) { const a = i * w + j; idx.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); }
  return outward(mesh(pos, uv, idx), new Vector3(0, o.y(0, 0.5), -0.025));
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- caps and knit

/** Schiebermütze: flat tweed cap low on the brow, the crown full and overhanging at the front, a short bill, a button. */
function flatCap(k: GearKit): void {
  k.on('Head', () => {
    const sh = new Shell(headMap(k, 'hair'), 0.007, { y: 1.7, rx: 0.112, front: 0.125, back: 0.122, up: 0.102, down: 0.12, m: 2.2 });
    const rim = rim3(1.704, 1.676, 1.664), eRim = memo((a) => sh.eAt(rim(a), a));
    const tweed = tweedCells(0x6a5640), bill = tweedCells(0x55452f);
    // Flat top, lower towards the front; full over the bill (3 cm), a little at the sides, snug behind.
    const top = (z: number): number => 1.791 - 0.3 * Math.max(0, z + 0.03) + 0.5 * Math.max(0, -0.05 - z);
    const full = (u: number, v: number): number => {
      const a = mix(-Math.PI, Math.PI, u), f = ((1 + Math.cos(a)) / 2) ** 2;
      return (0.008 + 0.012 * Math.sin(a) ** 2 + 0.028 * f) * smooth(0.12, 0.68, v) * (1 - 0.3 * smooth(0.8, 1, v));
    };
    k.add(press(sh.geo({ segs: 24, rows: 8, e: (a, v) => mix(eRim(a), Math.PI / 2, v), extra: full }), top, 0.026), tweed);
    k.add(ball(0.013, 8, 4).scale(1, 0.45, 1), bill, 0, top(0.0) - 0.002, 0.0);
    // Short stiff bill under the overhang.
    k.add(brim(sh, { e: eRim, a0: -1.15, a1: 1.15, segs: 12, rows: 1, curve: 1, w: (a) => 0.054 * Math.max(0, Math.cos((a / 1.15) * (Math.PI / 2))) ** 1.1, drop: () => 0.007, thick: 0.007 }), bill);
  });
}

/** Wollmütze: red knit beanie down to the brows and over the ears' tops, a thick ribbed cuff, a yellow button badge. */
function beanie(k: GearKit): void {
  k.on('Head', () => {
    const sh = new Shell(headMap(k, 'hair'), 0.008, { y: 1.67, rx: 0.1, front: 0.115, back: 0.115, up: 0.128, down: 0.12, m: 2.1 });
    const rim = rim3(1.696, 1.664, 1.648), knit = knitCells(0xb0302a), cuffCol = knitCells(0xa02c26), line = cloth(0x7c201c);
    const eAt = (a: number, dy: number, x = 0): number => sh.eAt(rim(a) + dy, a, x);
    const crown = (a: number, v: number): number => mix(eAt(a, 0.03), Math.PI / 2, v);
    k.add(sh.geo({ segs: 24, rows: 6, e: crown }), knit);
    // Knit lines up the crown, fading out before the top.
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; k.add(sh.geo({ a0: a - 0.024, a1: a + 0.024, segs: 1, rows: 5, e: (aa, v) => crown(aa, v * 0.8), extra: 0.002 }), line); }
    // Folded cuff: thick and rolled at both edges, with ribs.
    const cuff = (a: number, v: number): number => eAt(a, mix(-0.002, 0.036, v), 0.008);
    const roll = (v: number): number => 0.003 + 0.0045 * Math.sin(Math.PI * mix(0.12, 0.88, v));
    k.add(sh.geo({ segs: 32, rows: 2, e: cuff, extra: (_u, v) => roll(v) }), cuffCol);
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; k.add(sh.geo({ a0: a - 0.032, a1: a + 0.032, segs: 1, rows: 2, e: (aa, v) => cuff(aa, mix(0.1, 0.9, v)), extra: (_u, v) => roll(mix(0.1, 0.9, v)) + 0.0012 }), line); }
    // Button badge on the cuff, front left: yellow face, dark ring, red dot.
    const e = eAt(0.6, 0.018, 0.012);
    k.add(sh.wrap(cyl(0.017, 0.017, 0.004, 12).rotateX(Math.PI / 2), e, 0.6, 0.012), plain(0xe8d36a));
    k.add(sh.wrap(ring(0.017, 0.0022, 3, 12), e, 0.6, 0.014), metal(0x6a6450));
    k.add(sh.wrap(cyl(0.006, 0.006, 0.002, 8).rotateX(Math.PI / 2), e, 0.6, 0.015), plain(0xb93432));
  });
}

// ---------------------------------------------------------------- face gear

/** Gasmaske: rubber mask from the brows to under the chin, two ringed lenses, snout and filter, straps over and behind the head. */
function gasMask(k: GearKit): void {
  k.on('Head', () => {
    const face = new Shell(headMap(k, 'face'), 0.012), hair = new Shell(headMap(k, 'hair'), 0.004);
    const rubber = plain(0x4a5244), edge = plain(0x3a4036), strap = plain(0x2a2a26);
    const A = 1.4, yb = (a: number): number => 1.53 + 0.098 * (Math.abs(a) / A) ** 1.6, yt = (a: number): number => 1.682 - 0.012 * (Math.abs(a) / A) ** 4;
    const e = (a: number, v: number): number => face.eAt(mix(yb(a), yt(a), v), a);
    k.add(face.geo({ a0: -A, a1: A, segs: 14, rows: 6, e, extra: (u, v) => 0.012 * Math.sin(Math.PI * v) ** 0.8 * Math.sin(Math.PI * u) ** 1.5 }), rubber);
    // Thick rim round the mask.
    const outline: Array<[number, number]> = [];
    for (let i = 0; i <= 12; i++) { const a = mix(-A, A, i / 12); outline.push([e(a, 1), a]); }
    for (let i = 1; i <= 4; i++) outline.push([e(A, 1 - i / 4), A]);
    for (let i = 1; i <= 12; i++) { const a = mix(A, -A, i / 12); outline.push([e(a, 0), a]); }
    for (let i = 1; i <= 4; i++) outline.push([e(-A, i / 4), -A]);
    k.add(face.strip(outline, 0.012, 0.003), edge);
    // Lenses at the eyes: glass, a metal ring each.
    for (const s of [1, -1]) {
      const ee = face.eAt(1.657, s * 0.32);
      k.frame(face.frame(ee, s * 0.32, 0.002), () => {
        k.add(cyl(0.027, 0.03, 0.009, 12, true), edge, 0, 0, 0.002, Math.PI / 2);
        k.add(cyl(0.023, 0.023, 0.003, 12), bright(0xb4c8cc), 0, 0, 0.006, Math.PI / 2);
        k.add(ring(0.023, 0.005, 3, 12), metal(0x8a8c88), 0, 0, 0.007);
        k.add(ball(0.007, 4, 2).scale(1, 1, 0.3), bright(0xf4f8f8), -0.008, 0.008, 0.008);
      });
    }
    // Snout over the mouth, the filter canister below it.
    k.frame(face.frame(-0.34, 0, 0), () => {
      k.add(cyl(0.019, 0.028, 0.03, 10), edge, 0, 0, 0.012, Math.PI / 2 - 0.25);
      k.add(cyl(0.02, 0.02, 0.004, 10), strap, 0, -0.004, 0.028, Math.PI / 2 - 0.25);
    });
    k.frame(face.frame(-0.62, 0, 0), () => {
      k.add(cyl(0.016, 0.016, 0.02, 10), strap, 0, 0, 0.008, Math.PI / 2);
      k.add(cyl(0.025, 0.025, 0.046, 10), plain(0x7a6a3a), 0, 0, 0.04, Math.PI / 2);
      for (const z of [0.026, 0.05]) k.add(cyl(0.027, 0.027, 0.005, 10, true), metal(0x5a4e2c), 0, 0, z, Math.PI / 2);
      k.add(cyl(0.018, 0.018, 0.004, 10), strap, 0, 0, 0.064, Math.PI / 2);
    });
    // Straps: one behind the head at the temples, one over the crown.
    const eB = (a: number, v: number): number => hair.eAt(mix(1.652, 1.674, v), a);
    k.add(hair.geo({ a0: 1.32, a1: 2 * Math.PI - 1.32, segs: 16, rows: 1, e: eB }), strap);
    const over: Array<[number, number]> = [];
    for (let i = 0; i <= 12; i++) { const t = mix(0.32, Math.PI - 0.32, i / 12); over.push(hair.ea(_b.set(Math.cos(t), Math.sin(t) * 1.15, -0.32).normalize().add(hair.map.c))); }
    k.add(hair.strip(over, 0.018, 0, () => 0, 1), strap);
    // Buckles where the straps meet the mask.
    for (const s of [1, -1]) k.frame(hair.frame(hair.eAt(1.67, s * 1.36), s * 1.36, 0.004), () => k.add(box(0.012, 0.024, 0.005), metal(0x8a8c88)));
  });
}

/** Neonbrille: a dark band round the head at eye level, a wraparound visor over the eyes glowing cyan, a dark frame. */
function goggles(k: GearKit): void {
  k.on('Head', () => {
    const s = headSampler(k), frame = metal(0x2a2a32);
    const A = 1.3, q = (a: number): number => (Math.abs(a) / A) ** 3, notch = (a: number): number => 0.011 * Math.exp(-((a / 0.2) ** 2));
    const yb = (a: number): number => 1.632 + 0.018 * q(a) + notch(a), yt = (a: number): number => 1.69 - 0.016 * q(a);
    const r = fitRing(s, -A, A, (a) => mix(yb(a), yt(a), 0.15), yt);
    k.add(band(s, { a0: -A, a1: A, segs: 18, rows: 2, y: (a, v) => mix(yb(a), yt(a), v), r, extra: () => 0.012 }), frame);
    const inset = (a: number, v: number): number => mix(yb(a) + 0.005, yt(a) - 0.005, v);
    k.add(band(s, { a0: -A + 0.1, a1: A - 0.1, segs: 16, rows: 2, y: inset, r, extra: (_u, v) => 0.0155 + 0.002 * Math.sin(Math.PI * v) }), glow(0x26a09c));
    // Light line on the visor's top left.
    k.add(band(s, { a0: 0.12, a1: 0.62, segs: 4, rows: 1, y: (a, v) => mix(yt(a) - 0.011, yt(a) - 0.0085, v), r, extra: () => 0.019 }), glow(0x9ae6e2));
    // Band round the back and the hinges at the temples.
    const y0 = (): number => 1.652, y1 = (): number => 1.674;
    k.add(band(s, { a0: A - 0.05, a1: 2 * Math.PI - A + 0.05, segs: 18, rows: 1, y: (_a, v) => mix(1.652, 1.674, v), r: fitRing(s, A - 0.05, 2 * Math.PI - A + 0.05, y0, y1), extra: () => 0.005 }), frame);
    for (const sd of [1, -1]) k.add(box(0.012, 0.03, 0.03), metal(0x3a3c44), sd * 0.103, 1.662, 0.035);
  });
}

// ---------------------------------------------------------------- straw hat

/** Strohhut: wide-brim garden hat (12 cm beyond the head), red band round the crown, a sunflower on the side. */
function strawHat(k: GearKit): void {
  k.on('Head', () => {
    const sh = new Shell(headMap(k, 'hair'), 0.012, { y: 1.71, rx: 0.11, front: 0.125, back: 0.122, up: 0.098, down: 0.12, m: 3 });
    const rim = rimY(1.732, 1.69), eRim = memo((a) => sh.eAt(rim(a), a));
    const straw = strawCells(0xe0c070), weave = strawCells(0xc0a050);
    k.add(sh.geo({ segs: 20, rows: 6, e: (a, v) => mix(eRim(a), Math.PI / 2, v) }), straw);
    const b: BrimOpts = { e: eRim, segs: 32, rows: 3, w: (a) => 0.118 + 0.006 * Math.cos(a), drop: (a) => 0.024 - 0.02 * Math.max(0, Math.cos(a)) ** 2, thick: 0.006 };
    k.add(brim(sh, b), straw);
    k.add(brim(sh, { ...b, rows: 1, thick: 0, t0: 0.5, t1: 0.56, lift: 0.0015 }), weave);
    // Red band round the crown.
    k.add(sh.geo({ segs: 24, rows: 1, e: (a, v) => sh.eAt(rim(a) + mix(0.003, 0.028, v), a, 0.003), extra: 0.003 }), plain(0xb93432));
    // Sunflower on the hero's left, on the band.
    const ef = sh.eAt(rim(1.2) + 0.018, 1.2, 0.01);
    k.frame(sh.frame(ef, 1.2, 0.006), () => {
      for (let i = 0; i < 11; i++) { const t = (i / 11) * Math.PI * 2; k.add(cone(0.012, 0.034, 4).scale(1, 1, 0.3), plain(0xf3ce43), Math.sin(t) * 0.026, Math.cos(t) * 0.026, 0, 0, 0, -t); }
      k.add(cyl(0.016, 0.016, 0.008, 10), plain(0x5a3a14), 0, 0, 0.004, Math.PI / 2);
    });
  });
}

// ---------------------------------------------------------------- helmets

/** Right half of the eagle plate outline (x 0..1, y −1..1), as on the Hauptmann's helmet (enemies.ts). */
const EAGLE: ReadonlyArray<readonly [number, number]> = [[0, 1], [0.14, 0.9], [0.22, 0.95], [0.16, 0.72], [0.4, 0.78], [0.66, 1], [1, 0.86], [0.86, 0.6], [0.98, 0.44], [0.76, 0.3], [0.86, 0.08], [0.5, 0.06], [0.24, 0.16], [0.24, -0.32], [0.46, -0.6], [0.28, -0.62], [0.16, -0.46], [0.14, -0.78], [0, -1]];

/** Pickelhaube des Hauptmanns: black leather dome, visor and neck guard, brass spike on a cross base, eagle plate, scale chin strap, a glint at the tip. */
function pickelhaube(k: GearKit): void {
  k.on('Head', () => {
    const sh = new Shell(headMap(k, 'hair'), 0.012, { y: 1.7, rx: 0.112, front: 0.128, back: 0.13, up: 0.112, down: 0.12 });
    const hair = new Shell(headMap(k, 'hair'), 0.005);
    const rim = rimY(1.714, 1.668), eRim = memo((a) => sh.eAt(rim(a), a));
    const leather = plain(0x1e1c1e), brass = bright(0xd0a640);
    k.add(sh.geo({ segs: 18, rows: 6, e: (a, v) => mix(eRim(a), Math.PI / 2, v) }), leather);
    // Visor at the front, neck guard at the back, a brass edge on the visor.
    const visor: BrimOpts = { e: eRim, a0: -1.25, a1: 1.25, segs: 12, rows: 1, curve: 1, w: (a) => 0.046 * Math.max(0, Math.cos(a * 1.2)) ** 0.5, drop: () => 0.015, thick: 0.006 };
    k.add(brim(sh, visor), leather);
    k.add(brim(sh, { ...visor, thick: 0, t0: 0.84, t1: 1, lift: 0.0012 }), brass);
    k.add(brim(sh, { e: eRim, a0: Math.PI - 1.3, a1: Math.PI + 1.3, segs: 12, rows: 1, curve: 1, w: (a) => 0.04 * Math.max(0, -Math.cos(a)) ** 0.5, drop: () => 0.024, thick: 0.006 }), leather);
    // Spike: cross base on the crown, collar, bead, spike, a glint at the tip.
    const top = sh.point(Math.PI / 2, 0);
    for (let i = 0; i < 4; i++) k.add(sh.wrap(flat([[0, 0.03], [0.014, 0], [0, -0.028], [-0.014, 0]], 0.004), Math.PI / 2 - 0.17, (i * Math.PI) / 2, 0.002), brass);
    k.add(cyl(0.024, 0.03, 0.01, 10), brass, top.x, top.y + 0.002, top.z);
    k.add(cyl(0.016, 0.02, 0.026, 8), brass, top.x, top.y + 0.019, top.z);
    k.add(cyl(0.022, 0.022, 0.007, 8), brass, top.x, top.y + 0.034, top.z);
    k.add(cone(0.017, 0.078, 8), brass, top.x, top.y + 0.076, top.z);
    k.add(ball(0.007, 4, 3), glow(0xd8cc9c), top.x, top.y + 0.115, top.z);
    // Eagle plate on the front.
    const eagle = flat([...EAGLE, ...EAGLE.slice(1, -1).reverse().map(([x, y]): [number, number] => [-x, y])].map(([x, y]): [number, number] => [x * 0.04, y * 0.034]), 0.004);
    k.add(sh.wrap(eagle, sh.eAt(1.752, 0), 0, 0.003), brass);
    // Scale chin strap from the side rosettes down to under the chin.
    for (const s of [1, -1]) {
      const ea = sh.eAt(rim(1.45) + 0.012, s * 1.45);
      k.add(sh.wrap(cyl(0.014, 0.014, 0.004, 8).rotateX(Math.PI / 2), ea, s * 1.45, 0.002), brass);
      k.add(sh.wrap(ball(0.006, 4, 2).scale(1, 1, 0.5), ea, s * 1.45, 0.004), brass);
      const n = 6, pts: Vector3[] = [];
      for (let i = 0; i <= n; i++) { const t = i / n, a = s * mix(1.42, 0.26, t ** 1.3), y = mix(rim(1.42), 1.54, t ** 0.85); pts.push(hair.point(hair.eAt(y, a), a)); }
      for (let i = 0; i < n; i++) {
        const [e, a] = hair.ea(_c.addVectors(pts[i]!, pts[i + 1]!).multiplyScalar(0.5));
        const m = hair.frame(e, a, 0.003), x = new Vector3().setFromMatrixColumn(m, 0), y = new Vector3().setFromMatrixColumn(m, 1);
        _d.subVectors(pts[i + 1]!, pts[i]!);
        k.frame(m, () => k.add(box(0.017, _d.length() + 0.006, 0.004), brass, 0, 0, 0, -0.18, 0, Math.atan2(-_d.dot(x), _d.dot(y))));
      }
    }
  });
}

/** Topfhelm der Zitadelle: flat-topped bright steel helm down to the jaw, eye slit, gold cross, breathing holes, red crest. */
function greatHelm(k: GearKit): void {
  k.on('Head', () => {
    // The form clears the face, nose and ears everywhere (the map only guards it), so the shell stays smooth under the cross and the slit.
    const sh = new Shell(headMap(k, 'face'), 0.014, { y: 1.655, rx: 0.122, front: 0.162, back: 0.14, up: 0.142, down: 0.17, n: 2.4, m: 6 }, 0.006);
    const steel = bright(0xb8bec6), gold = metal(0xe0b040), black = plain(0x0c0c0e);
    const yb = rimY(1.5, 1.556), eB = memo((a) => sh.eAt(yb(a), a));
    k.add(sh.geo({ segs: 20, rows: 9, e: (a, v) => mix(eB(a), Math.PI / 2, v) }), steel);
    // Rolled bottom edge.
    k.add(sh.geo({ segs: 20, rows: 1, e: (a, v) => mix(eB(a), eB(a) + 0.07, v), extra: (_u, v) => 0.004 * Math.sin(Math.PI * v) + 0.001 }), bright(0x9aa0a8));
    // Eye slit (dark inset, the face never shows) either side of the cross.
    const at = (y: number) => (a: number): number => sh.eAt(y, a);
    for (const s of [1, -1]) k.add(sh.geo({ a0: s > 0 ? 0.06 : -0.8, a1: s > 0 ? 0.8 : -0.06, segs: 8, rows: 1, e: (a, v) => at(mix(1.646, 1.664, v))(a), extra: 0.003 }), black);
    // Gold cross: down the face, and across above the slit.
    const down: Array<[number, number]> = [];
    for (let i = 0; i <= 8; i++) down.push([mix(eB(0) + 0.02, 1.0, i / 8), 0]);
    k.add(sh.strip(down, 0.03, 0.002, (x) => 0.0025 * (1 - x * x), 2), gold);
    k.add(sh.geo({ a0: -1.7, a1: 1.7, segs: 16, rows: 1, e: (a, v) => at(mix(1.668, 1.684, v))(a), extra: (_u, v) => 0.002 + 0.0015 * Math.sin(Math.PI * v) }), gold);
    // Breathing holes on the left cheek.
    for (const [a, y] of [[0.42, 1.624], [0.58, 1.624], [0.42, 1.604], [0.58, 1.604], [0.42, 1.584], [0.58, 1.584]] as const) k.add(sh.wrap(box(0.009, 0.009, 0.002), sh.eAt(y, a), a, 0.0008), black);
    // Rivets round the top edge.
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; k.add(sh.wrap(ball(0.005, 4, 2), sh.eAt(1.775, a), a, 0.0), steel); }
    // Red crest on top: a tuft on a gold socket.
    const top = sh.point(Math.PI / 2, 0);
    k.add(cyl(0.016, 0.02, 0.014, 8), gold, top.x, top.y + 0.004, top.z);
    const tuft = ball(1, 10, 7);
    const p = tuft.attributes.position!;
    // Teardrop: narrow at the socket, full in the middle, a point leaning back.
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), w = y < 0 ? 0.5 + 0.5 * Math.sqrt(1 - y * y) : Math.sqrt(1 - y * y) ** 0.6 * (1 - 0.25 * y); p.setXYZ(i, p.getX(i) * 0.042 * w, y * 0.062, p.getZ(i) * 0.06 * w - 0.025 * Math.max(0, y) ** 2); }
    tuft.computeVertexNormals();
    k.add(tuft, cloth(0xa82828), top.x, top.y + 0.066, top.z - 0.006);
  });
}

export const HEAD_GEAR: Readonly<Record<string, GearBuilder>> = {
  'hat-hard': (k) => hardHat(k, 0xd9a520, { sticker: 0xb8261c }),
  'hat-kiez': (k) => hardHat(k, 0x2f62b0, { stripe: 0xf08a24, lamp: 0xfff2b0, set: true }),
  'hat-flatcap': flatCap,
  'hat-beanie': beanie,
  'hat-gasmask': gasMask,
  'hat-goggles': goggles,
  'hat-straw': strawHat,
  'hat-pickel': pickelhaube,
  'hat-greathelm': greatHelm,
};
