import { describe, expect, it } from 'vitest';
import { COURTYARD, courtyardColliders } from '../data/courtyard';
import { generateLots, generateProps, mapLevel } from '../data/map';
import { mitteMap } from '../data/mitte';
import { colliderBounds, colliderDistance, type Collider } from './collide';
import { FlowField, type Bounds } from './flowfield';
import type { Level, WalkGrid } from './level';

/** The blocked marking before the rasterised build: every cell against every collider. */
function bruteBlocked(b: Bounds, colliders: readonly Collider[], ground: WalkGrid | null, cell = 0.5, clearance = 0.3): Uint8Array {
  const cols = Math.ceil((b.maxX - b.minX) / cell);
  const rows = Math.ceil((b.maxZ - b.minZ) / cell);
  const out = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = b.minX + (c + 0.5) * cell;
      const z = b.minZ + (r + 0.5) * cell;
      if (ground?.at(x, z) || colliders.some((col) => colliderDistance(col, x, z) < clearance)) out[r * cols + c] = 1;
    }
  }
  return out;
}

/** The window `focusFlow` builds around (x, z). */
function windowAt(L: Level, x: number, z: number): Bounds {
  return { minX: Math.max(L.bounds.minX, x - 30), maxX: Math.min(L.bounds.maxX, x + 30), minZ: Math.max(L.bounds.minZ, z - 30), maxZ: Math.min(L.bounds.maxZ, z + 30) };
}

function mitteLevel(): Level {
  const def = mitteMap(1);
  const lots = generateLots(def);
  return mapLevel(def, lots, generateProps(def, lots));
}

describe('FlowField', () => {
  it('walks around a wall instead of into it', () => {
    const wall: Collider = { kind: 'box', x: 0, z: 0, hx: 0.5, hz: 3, rot: 0 };
    const field = new FlowField({ minX: -6, maxX: 6, minZ: -6, maxZ: 6 }, [wall]);
    field.setTarget(4, 0);
    // Follow the field from the far side of the wall.
    const pos = { x: -4, z: 0.2 };
    const dir = { x: 0, z: 0 };
    let steps = 0;
    while (Math.hypot(pos.x - 4, pos.z) > 0.6 && steps++ < 400) {
      expect(field.sample(pos.x, pos.z, dir)).toBe(true);
      pos.x += dir.x * 0.1;
      pos.z += dir.z * 0.1;
      expect(field.blocked[field.cellAt(pos.x, pos.z)]).toBe(0);
    }
    expect(steps).toBeLessThan(400);
  });

  it('reaches the yard from every spawn point', () => {
    const field = new FlowField(COURTYARD.bounds, courtyardColliders());
    field.setTarget(COURTYARD.playerStart.x, COURTYARD.playerStart.z);
    for (const s of COURTYARD.spawns) {
      const i = field.cellAt(s.x, s.z);
      expect(field.blocked[i]).toBe(0);
      expect(field.dist[i]).toBeLessThan(Infinity);
    }
  });

  it('only rebuilds when the target changes cell', () => {
    const field = new FlowField({ minX: 0, maxX: 4, minZ: 0, maxZ: 4 }, []);
    expect(field.setTarget(1.1, 1.1)).toBe(true);
    expect(field.setTarget(1.2, 1.3)).toBe(false);
    expect(field.setTarget(3.2, 1.3)).toBe(true);
  });

  it('sees through open ground and not through walls', () => {
    const wall: Collider = { kind: 'box', x: 0, z: 0, hx: 0.5, hz: 3, rot: 0 };
    const field = new FlowField({ minX: -6, maxX: 6, minZ: -6, maxZ: 6 }, [wall]);
    expect(field.clearLine(-4, 0, 4, 0)).toBe(false);
    expect(field.clearLine(-4, 5, 4, 5)).toBe(true);
  });

  it('marks the same cells as testing every collider (courtyard)', () => {
    const field = new FlowField(COURTYARD.bounds, courtyardColliders());
    expect(field.blocked).toEqual(bruteBlocked(COURTYARD.bounds, courtyardColliders(), null));
  });

  it('marks the same cells as testing every collider (Mitte, Pariser Platz)', () => {
    const L = mitteLevel();
    const b = windowAt(L, 32, -62);
    const cols = L.inBox(b);
    expect(cols.some((c) => c.kind === 'box' && c.rot % (Math.PI / 2) !== 0)).toBe(true);
    const field = new FlowField(b, cols, 0.5, 0.3, L.ground);
    const brute = bruteBlocked(b, cols, L.ground);
    expect(brute.reduce((s, v) => s + v, 0)).toBeGreaterThan(1000);
    expect(field.blocked).toEqual(brute);
  });

  it('patches a broken prop to the same cells as a new build', () => {
    const L = mitteLevel();
    const prop = L.breakables[0]!;
    const b = windowAt(L, prop.x, prop.z);
    const field = new FlowField(b, L.inBox(b), 0.5, 0.3, L.ground);
    expect(field.blocked[field.cellAt(prop.x, prop.z)]).toBe(1);
    field.setTarget(prop.x + 3, prop.z);
    L.remove(prop.collider);
    const area = colliderBounds(prop.collider);
    field.patch(area, L.inBox(area));
    expect(field.blocked).toEqual(bruteBlocked(b, L.inBox(b), L.ground));
    expect(field.blocked[field.cellAt(prop.x, prop.z)]).toBe(0);
    // The patch forces a new Dijkstra pass on the same target.
    expect(field.setTarget(prop.x + 3, prop.z)).toBe(true);
    L.restore();
  });

  it('patches a collider in and out again to the cells of a fresh build (P25 bars)', () => {
    const b: Bounds = { minX: -8, maxX: 8, minZ: -8, maxZ: 8 };
    const wall: Collider = { kind: 'box', x: 0, z: 2, hx: 1, hz: 1, rot: 0.3 };
    const bar: Collider = { kind: 'box', x: 0, z: 0, hx: 3, hz: 0.3, rot: Math.PI / 2 };
    const field = new FlowField(b, [wall]);
    expect(field.setTarget(5, 0)).toBe(true);
    const area = colliderBounds(bar);
    field.patch(area, [wall, bar]);
    expect(field.blocked).toEqual(new FlowField(b, [wall, bar]).blocked);
    expect(field.setTarget(5, 0)).toBe(true);
    field.patch(area, [wall]);
    expect(field.blocked).toEqual(new FlowField(b, [wall]).blocked);
    // A cell under the other collider (inside the patched area) stays blocked.
    expect(field.blocked[field.cellAt(0, 1.6)]).toBe(1);
    expect(field.setTarget(5, 0)).toBe(true);
    expect(field.setTarget(5, 0)).toBe(false);
  });
});

