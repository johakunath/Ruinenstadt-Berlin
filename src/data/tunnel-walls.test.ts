import { describe, expect, it } from 'vitest';
import { inTunnel } from './map';
import { LINES } from './lines';
import { tunnelMap, tunnelWalls, type TunnelWall } from './tunnel';

/** Distance from (x, z) to the face line of a wall piece. */
function faceDist(w: TunnelWall, x: number, z: number): number {
  const a = Math.max(-w.len / 2, Math.min(w.len / 2, (x - w.x) * w.ux + (z - w.z) * w.uz));
  return Math.hypot(x - w.x - w.ux * a, z - w.z - w.uz * a);
}

// Playtest 2026-11-20: floor without a wall (invisible walls) at the station ends, the side passage
// ends and beside the room off the last passage; walls you could walk into at the closed ends.
describe('tunnel walls match the walkable tubes (every line)', () => {
  // Lines that share a layout (today all reuse the S3 tubes) are checked once.
  const seen = new Set<string>();
  for (const [line, L] of LINES.entries()) {
    const shape = JSON.stringify(tunnelMap(line).tunnel!.tubes);
    if (seen.has(shape)) continue;
    seen.add(shape);
    it(`${L.id} ${L.ghost}: every edge of the floor has a wall, no wall stands on floor`, () => {
      const m = tunnelMap(line), walls = tunnelWalls(m.tunnel!.tubes);
      const grid = new Map<string, TunnelWall[]>(), key = (x: number, z: number): string => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
      for (const w of walls) for (const s of [-0.5, 0, 0.5]) {
        const k = key(w.x + w.ux * w.len * s, w.z + w.uz * w.len * s);
        if (!grid.get(k)?.includes(w)) grid.set(k, [...(grid.get(k) ?? []), w]);
      }
      const near = (x: number, z: number): TunnelWall[] => {
        const out: TunnelWall[] = [];
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(key(x + i * 4, z + j * 4)) ?? []));
        return out;
      };
      // (a) Floor next to rock always has a wall face within 0.3 m.
      const open: string[] = [];
      const S = 0.3;
      // Scan only near the tubes (bounding boxes, 1 m margin).
      const boxes = m.tunnel!.tubes.map((t) => { const xs = t.pts.map((p) => p[0]), zs = t.pts.map((p) => p[1]), r = t.width / 2 + 1; return [Math.min(...xs) - r, Math.max(...xs) + r, Math.min(...zs) - r, Math.max(...zs) + r] as const; });
      for (let x = -25; x < 455; x += S) for (let z = -70; z < 70; z += S) {
        if (!boxes.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) continue;
        if (!inTunnel(m, x, z)) continue;
        if ([[S, 0], [-S, 0], [0, S], [0, -S]].every(([a, b]) => inTunnel(m, x + a!, z + b!))) continue;
        if (!near(x, z).some((w) => faceDist(w, x, z) < S)) open.push(`${x.toFixed(1)},${z.toFixed(1)}`);
      }
      expect(open, 'floor edge without a wall').toEqual([]);
      // (b) No wall body covers floor.
      const inside: string[] = [];
      for (const w of walls) {
        for (let a = -w.len / 2 + 0.05; a < w.len / 2; a += 0.25) for (const d of [Math.min(0.05, w.thick / 2), w.thick / 2, Math.max(w.thick / 2, w.thick - 0.05)]) {
          const x = w.x + w.ux * a + w.nx * d, z = w.z + w.uz * a + w.nz * d;
          if (inTunnel(m, x, z)) inside.push(`${w.kind} ${w.side} ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
      expect(inside, 'wall on floor').toEqual([]);
    }, 30000);
  }
  it('the room off the last side passage is closed beside the passage (playtest: looked like a passage to the left)', () => {
    const m = tunnelMap(0), walls = tunnelWalls(m.tunnel!.tubes);
    const room = m.tunnel!.tubes.findIndex((t) => t.kind === 'branch' && t.width === 11);
    const front = walls.filter((w) => w.tube === room && w.side === 0 && w.nz > 0.9);
    // Both sides of the passage mouth are walled.
    expect(front.length).toBe(2);
    expect(front.reduce((s, w) => s + w.len, 0)).toBeGreaterThan(11 - 6 + 0.5);
  });
});
