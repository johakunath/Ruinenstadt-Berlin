import { describe, expect, it } from 'vitest';
import { COURTYARD, courtyardColliders } from '../data/courtyard';
import type { Collider } from './collide';
import { FlowField } from './flowfield';

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
});
