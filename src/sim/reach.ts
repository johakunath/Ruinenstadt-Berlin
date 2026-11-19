// Which ground the hero can walk to. Run content (hidden blessings, events) is only ever placed on
// cells reached by a flood from the encounters, so nothing lands in a closed yard or on an island.
import { colliderDistance } from './collide';
import type { Level } from './level';
import type { Rng } from './math';

const CELL = 1;
const BODY = 0.45;

export interface ReachGrid {
  cols: number;
  rows: number;
  minX: number;
  minZ: number;
  /** 1 = reachable on foot. */
  ok: Uint8Array;
}

// P25: shut neon bars do not count, so a grid first built during a shut still reaches the Tor passages.
const cache = new WeakMap<Level, ReachGrid>();

export function reachGrid(level: Level): ReachGrid {
  let g = cache.get(level);
  if (g) return g;
  const b = level.bounds;
  const cols = Math.ceil((b.maxX - b.minX) / CELL);
  const rows = Math.ceil((b.maxZ - b.minZ) / CELL);
  g = { cols, rows, minX: b.minX, minZ: b.minZ, ok: new Uint8Array(cols * rows) };
  const free = new Int8Array(cols * rows).fill(-1);
  const isFree = (c: number, r: number): boolean => {
    const i = r * cols + c;
    if (free[i] !== -1) return free[i] === 1;
    const x = b.minX + (c + 0.5) * CELL;
    const z = b.minZ + (r + 0.5) * CELL;
    const f = !level.blocked(x, z, BODY) && !level.near(x, z, BODY + 0.1).some((k) => !level.isShut(k) && colliderDistance(k, x, z) < BODY);
    free[i] = f ? 1 : 0;
    return f;
  };
  const stack: number[] = [];
  const seed = (x: number, z: number): void => {
    const c = Math.floor((x - b.minX) / CELL);
    const r = Math.floor((z - b.minZ) / CELL);
    // A seed may sit on a prop: take the first free cell around it.
    for (let d = 0; d < 4; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || !isFree(cc, rr)) continue;
      if (!g!.ok[rr * cols + cc]) { g!.ok[rr * cols + cc] = 1; stack.push(cc, rr); }
      return;
    }
  };
  seed(level.start.x, level.start.z);
  for (const e of level.encounters) seed(e.x, e.z);
  for (const z of level.zones) seed(z.entry.x, z.entry.z);
  while (stack.length) {
    const r = stack.pop()!;
    const c = stack.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || g.ok[rr * cols + cc] || !isFree(cc, rr)) continue;
      g.ok[rr * cols + cc] = 1;
      stack.push(cc, rr);
    }
  }
  cache.set(level, g);
  return g;
}

export function reachable(level: Level, x: number, z: number): boolean {
  const g = reachGrid(level);
  const c = Math.floor((x - g.minX) / CELL);
  const r = Math.floor((z - g.minZ) / CELL);
  return c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.ok[r * g.cols + c] === 1;
}

/** Share of unreachable cells within `radius` (corners and dead ends score high). */
export function enclosure(level: Level, x: number, z: number, radius = 3): number {
  let n = 0;
  let blocked = 0;
  for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
    n++;
    if (!reachable(level, x + dx, z + dz)) blocked++;
  }
  return blocked / n;
}

/** A reachable spot between `near` and `far` meters from (x, z) with `clear` meters of room, or null. */
export function freeSpot(level: Level, rng: Rng, x: number, z: number, near: number, far: number, clear: number, ok: (x: number, z: number) => boolean = () => true): { x: number; z: number } | null {
  for (let t = 0; t < 80; t++) {
    const a = rng.range(0, Math.PI * 2);
    // Later tries accept a wider ring: a spot somewhere beats no event.
    const d = rng.range(near, far) * (t < 50 ? 1 : 1.5);
    const sx = x + Math.sin(a) * d;
    const sz = z + Math.cos(a) * d;
    if (!reachable(level, sx, sz) || !reachable(level, sx + clear, sz) || !reachable(level, sx - clear, sz) || !reachable(level, sx, sz + clear) || !reachable(level, sx, sz - clear)) continue;
    if (level.noSpawnAt(sx, sz) || !ok(sx, sz)) continue;
    return { x: sx, z: sz };
  }
  return null;
}

/**
 * The point itself when reachable, else the centre of the nearest reachable cell within `max` meters,
 * else null (backlog P21, P23: lot guards and event spots that props land on).
 */
export function snapReachable(level: Level, x: number, z: number, max = 4): { x: number; z: number } | null {
  if (reachable(level, x, z)) return { x, z };
  const g = reachGrid(level);
  const c0 = Math.floor((x - g.minX) / CELL), r0 = Math.floor((z - g.minZ) / CELL);
  let best: { x: number; z: number } | null = null;
  let bd = max;
  const n = Math.ceil(max / CELL);
  for (let dr = -n; dr <= n; dr++) for (let dc = -n; dc <= n; dc++) {
    const c = c0 + dc, r = r0 + dr;
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || g.ok[r * g.cols + c] !== 1) continue;
    const cx = g.minX + (c + 0.5) * CELL, cz = g.minZ + (r + 0.5) * CELL;
    const d = Math.hypot(cx - x, cz - z);
    if (d < bd) { bd = d; best = { x: cx, z: cz }; }
  }
  return best;
}
