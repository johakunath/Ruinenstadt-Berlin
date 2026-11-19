// Hats (WP4 step 2b): every hat rides on the `Head` bone like the hair. Shells are fitted to a map of the
// hair and skull seen from inside the head (`HeadMap`): smooth, symmetric, never inside a strand, so a hat
// sits on the hair instead of in it. Looks: docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19).
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { basis, bright, cloth, glow, metal, plain, type GearKit, type HeroSource, type Paint } from './gear-kit';
import type { GearBuilder } from './gear';
import { ball, box, cone, cyl, flat, ring } from './weapons';

const DEG = Math.PI / 180;
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
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
function headMap(k: GearKit, kind: 'hair' | 'face'): HeadMap {
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
  for (let i = 0; i < 20; i++) { const t = (lo + hi) / 2; if (g(t) < 1) lo = t; else hi = t; }
  return (lo + hi) / 2;
}

const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _d = new Vector3();

/** A shell round the head: the form, or `lift` outside the mapped hair where that is further out (a soft max). */
class Shell {
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
 * (negative turns it up), `thick` m at the edge. One sheet (double-sided material) with an edge band.
 */
function brim(sh: Shell, o: { e: (a: number) => number; w: (a: number) => number; drop?: (a: number) => number; thick?: number; segs: number; a0?: number; a1?: number; rows?: number }): BufferGeometry {
  const a0 = o.a0 ?? -Math.PI, a1 = o.a1 ?? Math.PI, rows = o.rows ?? 2, th = o.thick ?? 0.008;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = new Vector3(), h = new Vector3();
  const W = o.segs + 1;
  for (let j = 0; j <= o.segs; j++) {
    const u = j / o.segs, a = mix(a0, a1, u);
    sh.point(o.e(a), a, -0.003, p);
    h.set(p.x - sh.map.c.x, 0, p.z - sh.map.c.z).normalize();
    const w = o.w(a), dr = o.drop?.(a) ?? 0;
    for (let r = 0; r <= rows + 1; r++) {
      const t = Math.min(1, r / rows), edge = r > rows ? th : 0;
      pos.push(p.x + h.x * w * t, p.y - dr * t * t - edge, p.z + h.z * w * t);
      uv.push(u, r / (rows + 1));
    }
  }
  const R = rows + 2;
  for (let j = 0; j < o.segs; j++) for (let r = 0; r < rows + 1; r++) { const a = j * R + r, b = a + R; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  void W;
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
    const rim = rimY(1.712, 1.678), eRim = (a: number): number => sh.eAt(rim(a), a);
    const shell = plain(col), dark = plain(0x2a2a2c);
    k.add(sh.geo({ segs: 24, rows: 8, e: (a, v) => mix(eRim(a), Math.PI / 2, v) }), shell);
    // Brim: 3.6 cm at the front (level, so the eyes stay free), 1.6 at the sides, 2.2 at the back (a little down).
    const fr = (a: number): number => Math.max(0, Math.cos(a)) ** 2.5, bk = (a: number): number => Math.max(0, -Math.cos(a));
    k.add(brim(sh, { e: eRim, segs: 28, w: (a) => 0.016 + 0.02 * fr(a) + 0.006 * bk(a), drop: (a) => 0.006 * (1 - fr(a)) + 0.004 * bk(a), thick: 0.008 }), shell);
    // Ridge from the front over the crown to the back, a lower rib on each side beside it.
    k.add(sh.strip(midline(eRim(0) + 0.1, eRim(Math.PI) + 0.12, 14), 0.024, 0, (x) => 0.008 * (1 - x * x), 2), shell);
    for (const s of [1, -1]) k.add(sh.strip(sidePath(sh, s * 0.05, 0.75, 2.1, 9), 0.014, 0, (x) => 0.004 * (1 - x * x), 2), shell);
    if (o.sticker) {
      // Red sticker on the hero's left side.
      k.add(sh.wrap(cyl(0.019, 0.019, 0.003, 12).rotateX(Math.PI / 2), 0.62, 1.15, 0.002), plain(o.sticker));
    }
    if (o.stripe) {
      // Reflective orange band round the shell and a thin light line on it.
      const band = (y0: number, y1: number, x: number) => sh.geo({ segs: 32, rows: 1, e: (a, v) => sh.eAt(mix(rim(a) + y0, rim(a) + y1, v), a, x), extra: x });
      k.add(band(0.022, 0.044, 0.003), plain(o.stripe));
      k.add(band(0.031, 0.035, 0.0045), plain(0xf4f0e4));
    }
    if (o.lamp) {
      // Head lamp at the front: clip, housing, rim and the glowing lens.
      const e = sh.eAt(1.742, 0);
      k.frame(sh.frame(e, 0, 0.004), () => {
        k.add(box(0.034, 0.03, 0.01), dark, 0, 0, 0.002);
        k.add(cyl(0.021, 0.024, 0.026, 12), metal(0x3a3c40), 0, 0.002, 0.018, Math.PI / 2);
        k.add(ring(0.019, 0.004, 4, 12), bright(0xc8ccd0), 0, 0.002, 0.031);
        k.add(cyl(0.016, 0.016, 0.004, 12), glow(o.lamp!), 0, 0.002, 0.031, Math.PI / 2);
      });
    }
  });
}

export const HEAD_GEAR: Readonly<Record<string, GearBuilder>> = {
  'hat-hard': (k) => hardHat(k, 0xd9a520, { sticker: 0xb8261c }),
  'hat-kiez': (k) => hardHat(k, 0x2f62b0, { stripe: 0xf08a24, lamp: 0xfff2b0, set: true }),
};

// Kept for the next builders (flat cap, beanie, mask, goggles, straw hat, Pickelhaube, great helm).
void cloth; void ball; void cone; void flat;
export type { Paint };
