import { describe, expect, it } from 'vitest';
import type { Collider } from './collide';
import { Level } from './level';
import { Rng } from './math';
import { freeSpot } from './reach';

const B = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const box = (x: number, z: number): Collider => ({ kind: 'box', x, z, hx: 1, hz: 0.3, rot: 0 });
const level = (colliders: Collider[]): Level => new Level('t', B, { x: 0, z: 0 }, colliders, null, [], B);

describe('Level shut / open (P25 neon bars)', () => {
  it('shut puts a collider into the hash, open takes it out; both are idempotent; restore opens', () => {
    const bar = box(0, 0);
    const L = level([]);
    expect(L.near(0, 0, 1)).not.toContain(bar);
    L.shut(bar);
    L.shut(bar);
    expect(L.isShut(bar)).toBe(true);
    expect(L.near(0, 0, 1)).toContain(bar);
    expect(L.colliders.filter((c) => c === bar)).toHaveLength(1);
    L.open(bar);
    L.open(bar);
    expect(L.isShut(bar)).toBe(false);
    expect(L.near(0, 0, 1)).not.toContain(bar);
    expect(L.colliders).not.toContain(bar);
    L.shut(bar);
    L.restore();
    expect(L.isShut(bar)).toBe(false);
    expect(L.colliders).not.toContain(bar);
    expect(L.near(0, 0, 1)).not.toContain(bar);
  });

  it('keeps the restore journal intact: shut, open, remove another, restore', () => {
    const bar = box(0, 0);
    const other = box(5, 5);
    const L = level([other]);
    L.shut(bar);
    L.open(bar);
    L.shut(bar);
    L.remove(other);
    L.restore();
    expect(L.colliders).toContain(other);
    expect(L.near(5, 5, 1)).toContain(other);
    expect(L.colliders).not.toContain(bar);
    expect(L.near(0, 0, 1)).not.toContain(bar);
  });
});

describe('Level no-spawn zones (M16 platform start)', () => {
  it('noSpawnAt is true only inside a zone; freeSpot never places anything there', () => {
    const L = level([]);
    L.noSpawn = [[{ x: -5, z: -5 }, { x: 5, z: -5 }, { x: 5, z: 5 }, { x: -5, z: 5 }]];
    expect(L.noSpawnAt(0, 0)).toBe(true);
    expect(L.noSpawnAt(4.9, -4.9)).toBe(true);
    expect(L.noSpawnAt(6, 0)).toBe(false);
    const rng = new Rng(3);
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const q = freeSpot(L, rng, 0, 0, 0, 9, 0.4);
      if (!q) continue;
      n++;
      expect(L.noSpawnAt(q.x, q.z), `${q.x},${q.z}`).toBe(false);
    }
    expect(n).toBeGreaterThan(30);
  });
});
