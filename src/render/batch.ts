// Collects static geometry per material and merges it into one mesh each, so the whole
// courtyard costs a handful of draw calls.
import { Box3, BoxGeometry, BufferAttribute, BufferGeometry, Matrix4, Vector3, type Material, Mesh, MeshBasicMaterial } from 'three';
import { OCCLUDER_LAYER } from './layers';

type RGB = readonly [number, number, number];
const WHITE: RGB = [1, 1, 1];
const v = new Vector3();
const n = new Vector3();
/** Vertices this close to a cut plane count as on it (no slivers). */
const CUT_EPS = 1e-4;

/**
 * V1 B cutaway: an index range of a merged mesh that belongs to a cut part. Upper ranges show while
 * the part is uncut, cap ranges while it is cut; hidden ranges are degenerate triangles. `shown` holds
 * the indices to write back (`src/render/cutaway.ts`).
 */
export interface CutRange { part: number; start: number; count: number; cap: boolean; shown: Uint16Array | Uint32Array }
/** Per-capture box of the contour mask that is clamped to `y` while `part` is cut; `top` is its full max y. */
export interface BoxCut { box: number; part: number; y: number; top: number }
type Range = Omit<CutRange, 'shown'>;

export class Batch {
  /** Added to every y while building (things standing on raised ground). */
  lift = 0;
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private occluderIndices: number[] = [];
  private excludedOccluderIndices = new Set<number>();
  /** Cut ranges in index positions; and the same for the captured occluder triangles. */
  private readonly cuts: Range[] = [];
  private readonly occluderCuts: Range[] = [];

  get indexCount(): number { return this.indices.length; }

  /** Captures the triangles added since `first`; `box` grows by their vertices (world space). */
  captureOccluderFrom(first: number, box?: Box3): void {
    const ranges = this.cuts.filter((c) => c.start >= first);
    for (let i = first; i < this.indices.length; i++) {
      if (this.excludedOccluderIndices.has(i)) continue;
      const k = this.indices[i]!;
      // Upper triangles and caps of a cut part stay contiguous ranges in the mask too.
      const cut = ranges.find((c) => i >= c.start && i < c.start + c.count);
      if (cut) {
        const last = this.occluderCuts[this.occluderCuts.length - 1];
        if (last && last.part === cut.part && last.cap === cut.cap && last.start + last.count === this.occluderIndices.length) last.count++;
        else this.occluderCuts.push({ part: cut.part, start: this.occluderIndices.length, count: 1, cap: cut.cap });
      }
      this.occluderIndices.push(k);
      box?.expandByPoint(v.set(this.positions[k * 3]!, this.positions[k * 3 + 1]!, this.positions[k * 3 + 2]!));
    }
    this.excludedOccluderIndices.clear();
  }

  excludeOccluderFrom(first: number): void {
    for (let i = first; i < this.indices.length; i++) this.excludedOccluderIndices.add(i);
  }

  /** Position-only copy of explicitly classified triangles; beauty batching remains unchanged. */
  appendOccluder(positions: number[], indices: number[], cuts: Range[] = []): void {
    for (const c of this.occluderCuts) cuts.push({ ...c, start: c.start + indices.length });
    const remap = new Map<number, number>();
    for (const old of this.occluderIndices) {
      let next = remap.get(old);
      if (next === undefined) {
        next = positions.length / 3;
        remap.set(old, next);
        positions.push(this.positions[old * 3]!, this.positions[old * 3 + 1]!, this.positions[old * 3 + 2]!);
      }
      indices.push(next);
    }
  }

  /**
   * Clips the triangles from index position `first` at world height `y`: lower triangles first, then
   * the upper ones as one range of `part`. Crossing edges get new vertices (position, normal, uv and
   * colour interpolated); winding is kept, vertices within CUT_EPS of the plane are not split.
   */
  clipFrom(first: number, part: number, y: number): void {
    const P = this.positions, I = this.indices;
    if (first >= I.length) return;
    const side = (k: number): number => { const d = P[k * 3 + 1]! - y; return d > CUT_EPS ? 1 : d < -CUT_EPS ? -1 : 0; };
    const edges = new Map<number, number>();
    const cross = (p: number, q: number): number => {
      if (p > q) [p, q] = [q, p];
      const key = p * 67108864 + q;
      let k = edges.get(key);
      if (k !== undefined) return k;
      const t = (y - P[p * 3 + 1]!) / (P[q * 3 + 1]! - P[p * 3 + 1]!);
      k = P.length / 3;
      const mix = (a: number[], dim: number): void => { for (let j = 0; j < dim; j++) a.push(a[p * dim + j]! + (a[q * dim + j]! - a[p * dim + j]!) * t); };
      mix(P, 3);
      P[k * 3 + 1] = y;
      mix(this.normals, 3);
      n.fromArray(this.normals, k * 3).normalize().toArray(this.normals, k * 3);
      mix(this.uvs, 2);
      mix(this.colors, 3);
      edges.set(key, k);
      return k;
    };
    const lower: number[] = [], upper: number[] = [], lowerEx: boolean[] = [], upperEx: boolean[] = [];
    const fan = (poly: number[], out: number[], ex: boolean[], excluded: boolean): void => {
      for (let j = 1; j + 1 < poly.length; j++) { out.push(poly[0]!, poly[j]!, poly[j + 1]!); ex.push(excluded); }
    };
    for (let i = first; i + 2 < I.length; i += 3) {
      const tri = [I[i]!, I[i + 1]!, I[i + 2]!], s = tri.map(side), excluded = this.excludedOccluderIndices.has(i);
      if (!s.includes(1)) { fan(tri, lower, lowerEx, excluded); continue; }
      if (!s.includes(-1)) { fan(tri, upper, upperEx, excluded); continue; }
      const lo: number[] = [], up: number[] = [];
      for (let j = 0; j < 3; j++) {
        const p = tri[j]!, q = tri[(j + 1) % 3]!, sp = s[j]!, sq = s[(j + 1) % 3]!;
        if (sp <= 0) lo.push(p);
        if (sp >= 0) up.push(p);
        if (sp * sq < 0) { const k = cross(p, q); lo.push(k); up.push(k); }
      }
      fan(lo, lower, lowerEx, excluded);
      fan(up, upper, upperEx, excluded);
    }
    I.length = first;
    for (const k of [...this.excludedOccluderIndices]) if (k >= first) this.excludedOccluderIndices.delete(k);
    [...lowerEx, ...upperEx].forEach((ex, t) => { if (ex) for (let j = 0; j < 3; j++) this.excludedOccluderIndices.add(first + t * 3 + j); });
    for (const k of lower) I.push(k);
    if (upper.length) this.cuts.push({ part, start: I.length, count: upper.length, cap: false });
    for (const k of upper) I.push(k);
  }

  /** The triangles from `first` on are the cap of `part`: shown only while it is cut. */
  capFrom(first: number, part: number): void {
    if (this.indices.length > first) this.cuts.push({ part, start: first, count: this.indices.length - first, cap: true });
  }

  get empty(): boolean {
    return this.indices.length === 0;
  }

  /** Appends a geometry transformed by `m`. `color` multiplies the material color per vertex. */
  add(geo: BufferGeometry, m: Matrix4, color: RGB = WHITE): void {
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const col = geo.getAttribute('color');
    const base = this.positions.length / 3;
    const normalMatrix = new Matrix4().copy(m).invert().transpose();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      v.y += this.lift;
      n.fromBufferAttribute(nor, i).transformDirection(normalMatrix);
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(n.x, n.y, n.z);
      this.uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      if (col) this.colors.push(col.getX(i) * color[0], col.getY(i) * color[1], col.getZ(i) * color[2]);
      else this.colors.push(color[0], color[1], color[2]);
    }
    const index = geo.getIndex();
    if (index) for (let i = 0; i < index.count; i++) this.indices.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.indices.push(base + i);
  }

  /**
   * A quad from four corners (counter-clockwise seen from the front). `uv` is [u0, v0, u1, v1];
   * `colors` are per corner.
   */
  quad(p: [Vector3, Vector3, Vector3, Vector3], uv: readonly [number, number, number, number] = [0, 0, 1, 1], colors: readonly RGB[] = [WHITE]): void {
    const base = this.positions.length / 3;
    n.subVectors(p[1], p[0]).cross(v.subVectors(p[3], p[0])).normalize();
    const uvs = [uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]];
    for (let i = 0; i < 4; i++) {
      const c = colors[i] ?? colors[0] ?? WHITE;
      this.positions.push(p[i]!.x, p[i]!.y + this.lift, p[i]!.z);
      this.normals.push(n.x, n.y, n.z);
      this.uvs.push(uvs[i * 2]!, uvs[i * 2 + 1]!);
      this.colors.push(c[0], c[1], c[2]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    const index = this.positions.length / 3 > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices);
    g.setIndex(new BufferAttribute(index, 1));
    g.userData.cuts = cutRanges(index, this.cuts);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Index ranges with their shown indices; cap ranges start hidden (degenerate). */
function cutRanges(index: Uint16Array | Uint32Array, cuts: readonly Range[]): CutRange[] {
  return cuts.map((c) => {
    const shown = index.slice(c.start, c.start + c.count);
    if (c.cap) index.fill(shown[0]!, c.start, c.start + c.count);
    return { ...c, shown };
  });
}

/** Batches keyed by material. */
export class BatchSet {
  private readonly map = new Map<Material, Batch>();
  private capturing = false;
  /** Height offset handed to every batch (see Batch.lift). */
  lift = 0;

  /**
   * Classify geometry by the object being built, never by its shared material. `into`: grow this box
   * (returned by an earlier capture of this set) instead of adding one, so a long wall built in short
   * pieces stays a handful of boxes for the outline's per-frame test.
   */
  captureOccluder(build: () => void, into?: Box3): Box3 | undefined {
    if (this.capturing) { build(); return undefined; }
    const starts = this.starts();
    this.capturing = true;
    this.captureCuts.length = 0;
    let out: Box3 | undefined;
    try { build(); } finally {
      this.capturing = false;
      const box = new Box3();
      for (const [material, batch] of this.map) batch.captureOccluderFrom(starts.get(material) ?? 0, box);
      if (into && this.occluderBoxes.includes(into) && !this.captureCuts.length) {
        into.union(box);
        out = into;
      } else if (!box.isEmpty()) {
        out = box;
        for (const c of this.captureCuts) this.boxCuts.push({ box: this.occluderBoxes.length, part: c.part, y: c.y, top: box.max.y });
        this.occluderBoxes.push(box);
      }
    }
    return out;
  }

  private starts(): Map<Material, number> {
    return new Map([...this.map].map(([material, batch]) => [material, batch.indexCount]));
  }

  /** Cuts inside the running capture, and the mask boxes they clamp. */
  private readonly captureCuts: Array<{ part: number; y: number }> = [];
  private readonly boxCuts: BoxCut[] = [];
  private cutting = false;

  /**
   * V1 B cutaway: what `build` adds is clipped at world height `y`; the upper triangles of each batch
   * become one index range of `part` (`geometry.userData.cuts`), what `caps` adds shows only while the
   * part is cut. Call it inside `captureOccluder`, so the contour mask gets the final triangles.
   */
  cut(part: number, y: number, build: () => void, caps?: () => void): void {
    if (this.cutting) { build(); return; }
    let starts = this.starts();
    this.cutting = true;
    try { build(); } finally { this.cutting = false; }
    for (const [material, batch] of this.map) batch.clipFrom(starts.get(material) ?? 0, part, y);
    if (this.capturing) this.captureCuts.push({ part, y });
    if (!caps) return;
    starts = this.starts();
    caps();
    // Caps are occluders too (P42): a hero close behind a cut building is hidden by the cap and keeps her contour.
    for (const [material, batch] of this.map) batch.capFrom(starts.get(material) ?? 0, part);
  }

  /** World bounds of each captured object: the hero outline tests these before drawing anything. */
  private readonly occluderBoxes: Box3[] = [];

  /** Small attachments remain visible but cannot inherit an enclosing building capture. */
  excludeOccluder(build: () => void): void {
    if (!this.capturing) { build(); return; }
    const starts = new Map([...this.map].map(([material, batch]) => [material, batch.indexCount]));
    try { build(); } finally {
      for (const [material, batch] of this.map) batch.excludeOccluderFrom(starts.get(material) ?? 0);
    }
  }

  occluderMesh(): Mesh | null {
    const positions: number[] = [], indices: number[] = [], cuts: Range[] = [];
    for (const batch of this.map.values()) batch.appendOccluder(positions, indices, cuts);
    if (!indices.length) return null;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    const index = positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    geometry.setIndex(new BufferAttribute(index, 1));
    geometry.userData.cuts = cutRanges(index, cuts);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, OCCLUDER_PLACEHOLDER);
    mesh.name = 'large-occluder-depth';
    mesh.layers.set(OCCLUDER_LAYER);
    mesh.userData.boxes = [...this.occluderBoxes];
    // Boxes are copied by reference: the cutaway clamps the same Box3 objects the outline tests.
    mesh.userData.boxCuts = [...this.boxCuts];
    return mesh;
  }

  of(material: Material): Batch {
    let b = this.map.get(material);
    if (!b) {
      b = new Batch();
      this.map.set(material, b);
    }
    b.lift = this.lift;
    return b;
  }

  meshes(): Mesh[] {
    const list: Mesh[] = [];
    for (const [material, batch] of this.map) {
      if (batch.empty) continue;
      list.push(new Mesh(batch.build(), material));
    }
    return list;
  }
}

const OCCLUDER_PLACEHOLDER = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });

/** Box whose UVs are in meters times `uvScale`, so textures keep their world size on any box. */
export function boxGeo(sx: number, sy: number, sz: number, uvScale = 1): BoxGeometry {
  const g = new BoxGeometry(sx, sy, sz);
  const uv = g.getAttribute('uv');
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const dims: Array<[number, number]> = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    const [du, dv] = dims[f] as [number, number];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * du * uvScale, uv.getY(k) * dv * uvScale);
    }
  }
  return g;
}
