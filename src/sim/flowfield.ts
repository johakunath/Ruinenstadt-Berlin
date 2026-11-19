// Grid flow field toward one target (the player). One Dijkstra pass serves every enemy.
import { boxDistance, colliderBounds, type Collider } from './collide';
import type { WalkGrid } from './level';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const SQRT2 = Math.SQRT2;
// Neighbor offsets: 4 straight, then 4 diagonal.
const NX = [1, -1, 0, 0, 1, 1, -1, -1];
const NZ = [0, 0, 1, -1, 1, -1, 1, -1];

export class FlowField {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  readonly dist: Float32Array;
  readonly dirX: Float32Array;
  readonly dirZ: Float32Array;
  private readonly heap: Int32Array;
  private targetCell = -1;

  /** `clearance` inflates obstacles by the body radius of a typical walker. */
  constructor(
    readonly bounds: Bounds,
    colliders: readonly Collider[],
    cell = 0.5,
    readonly clearance = 0.3,
    private readonly ground: WalkGrid | null = null,
  ) {
    this.cell = cell;
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.dist = new Float32Array(n).fill(Infinity);
    this.dirX = new Float32Array(n);
    this.dirZ = new Float32Array(n);
    this.heap = new Int32Array(n * 8);
    this.mark(0, 0, this.cols - 1, this.rows - 1, colliders);
  }

  /**
   * Re-marks the cells within `clearance` of `area` after a collider left or joined the level (a broken
   * prop, a barrier). `colliders` must hold every collider near the area. The next `setTarget` rebuilds.
   */
  patch(area: Bounds, colliders: readonly Collider[]): void {
    const pad = this.clearance + this.cell;
    const c0 = Math.max(0, Math.floor((area.minX - pad - this.bounds.minX) / this.cell));
    const r0 = Math.max(0, Math.floor((area.minZ - pad - this.bounds.minZ) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((area.maxX + pad - this.bounds.minX) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((area.maxZ + pad - this.bounds.minZ) / this.cell));
    if (c0 > c1 || r0 > r1) return;
    this.mark(c0, r0, c1, r1, colliders);
    this.targetCell = -1;
  }

  /**
   * A cell is blocked when its center is on blocked ground or closer than `clearance` to a collider.
   * Each collider only tests the cells of its own bounds grown by `clearance` (and one cell of margin).
   */
  private mark(c0: number, r0: number, c1: number, r1: number, colliders: readonly Collider[]): void {
    const { bounds, cell, cols, blocked, ground, clearance } = this;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        blocked[r * cols + c] = ground?.at(bounds.minX + (c + 0.5) * cell, bounds.minZ + (r + 0.5) * cell) ? 1 : 0;
      }
    }
    const pad = clearance + cell;
    for (const col of colliders) {
      const e = colliderBounds(col);
      const ca = Math.max(c0, Math.floor((e.minX - pad - bounds.minX) / cell));
      const ra = Math.max(r0, Math.floor((e.minZ - pad - bounds.minZ) / cell));
      const cb = Math.min(c1, Math.floor((e.maxX + pad - bounds.minX) / cell));
      const rb = Math.min(r1, Math.floor((e.maxZ + pad - bounds.minZ) / cell));
      if (ca > cb || ra > rb) continue;
      const box = col.kind === 'box';
      const cos = box ? Math.cos(col.rot) : 0;
      const sin = box ? Math.sin(col.rot) : 0;
      for (let r = ra; r <= rb; r++) {
        const z = bounds.minZ + (r + 0.5) * cell;
        for (let c = ca; c <= cb; c++) {
          const i = r * cols + c;
          if (blocked[i]) continue;
          const x = bounds.minX + (c + 0.5) * cell;
          const d = box ? boxDistance(col, cos, sin, x, z) : Math.hypot(x - col.x, z - col.z) - col.r;
          if (d < clearance) blocked[i] = 1;
        }
      }
    }
  }

  cellAt(x: number, z: number): number {
    const c = Math.floor((x - this.bounds.minX) / this.cell);
    const r = Math.floor((z - this.bounds.minZ) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /** Rebuilds the field when the target moved to another cell. Returns true when it did. */
  setTarget(x: number, z: number): boolean {
    let target = this.cellAt(x, z);
    if (target < 0) return false;
    if (this.blocked[target]) target = this.nearestFree(target);
    if (target === this.targetCell) return false;
    this.targetCell = target;
    this.build(target);
    return true;
  }

  /** Direction to walk from (x, z). Returns false when the cell has no path. */
  sample(x: number, z: number, out: { x: number; z: number }): boolean {
    const i = this.cellAt(x, z);
    if (i < 0 || this.dist[i] === Infinity) return false;
    const dx = this.dirX[i] as number;
    const dz = this.dirZ[i] as number;
    if (dx === 0 && dz === 0) return false;
    out.x = dx;
    out.z = dz;
    return true;
  }

  /** True when a straight walk between two points crosses no blocked cell. */
  clearLine(x0: number, z0: number, x1: number, z1: number): boolean {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const i = this.cellAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (i < 0 || this.blocked[i]) return false;
    }
    return true;
  }

  private nearestFree(from: number): number {
    const fc = from % this.cols;
    const fr = (from - fc) / this.cols;
    for (let ring = 1; ring < 6; ring++) {
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          const c = fc + dc;
          const r = fr + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const i = r * this.cols + c;
          if (!this.blocked[i]) return i;
        }
      }
    }
    return from;
  }

  private build(target: number): void {
    const { cols, rows, dist, blocked, heap } = this;
    dist.fill(Infinity);
    dist[target] = 0;
    // Binary min-heap of cell indices keyed by dist; stale entries are skipped on pop.
    let size = 0;
    const push = (i: number): void => {
      let k = size++;
      heap[k] = i;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if ((dist[heap[p] as number] as number) <= (dist[heap[k] as number] as number)) break;
        const t = heap[p] as number;
        heap[p] = heap[k] as number;
        heap[k] = t;
        k = p;
      }
    };
    const pop = (): number => {
      const top = heap[0] as number;
      heap[0] = heap[--size] as number;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < size && (dist[heap[l] as number] as number) < (dist[heap[m] as number] as number)) m = l;
        if (r < size && (dist[heap[r] as number] as number) < (dist[heap[m] as number] as number)) m = r;
        if (m === k) break;
        const t = heap[m] as number;
        heap[m] = heap[k] as number;
        heap[k] = t;
        k = m;
      }
      return top;
    };
    push(target);
    const done = new Uint8Array(cols * rows);
    while (size > 0) {
      const i = pop();
      if (done[i]) continue;
      done[i] = 1;
      const c = i % cols;
      const r = (i - c) / cols;
      const d = dist[i] as number;
      for (let n = 0; n < 8; n++) {
        const nc = c + (NX[n] as number);
        const nr = r + (NZ[n] as number);
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (blocked[j] || done[j]) continue;
        // No cutting corners between two blocked cells.
        if (n >= 4 && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
        const nd = d + (n < 4 ? 1 : SQRT2);
        if (nd < (dist[j] as number)) {
          dist[j] = nd;
          push(j);
        }
      }
    }
    // Each cell points at its best neighbor.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let bx = 0;
        let bz = 0;
        if (dist[i] !== Infinity && i !== target) {
          let best = dist[i] as number;
          for (let n = 0; n < 8; n++) {
            const nc = c + (NX[n] as number);
            const nr = r + (NZ[n] as number);
            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
            const j = nr * cols + nc;
            if (n >= 4 && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
            const nd = (dist[j] as number) + (n < 4 ? 0 : SQRT2 - 1) * 0.001;
            if (nd < best) {
              best = nd;
              bx = NX[n] as number;
              bz = NZ[n] as number;
            }
          }
          const len = Math.hypot(bx, bz);
          if (len > 0) {
            bx /= len;
            bz /= len;
          }
        }
        this.dirX[i] = bx;
        this.dirZ[i] = bz;
      }
    }
  }
}
