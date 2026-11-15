import { describe, expect, it } from 'vitest';
import { courtyardColliders, COURTYARD, facadeColliders } from '../data/courtyard';
import { colliderDistance, pushOut, resolveStatic, sectorHitsCircle, type Collider } from './collide';
import { DEG } from './math';

describe('pushOut', () => {
  it('moves a circle out of a circle', () => {
    const pos = { x: 0.5, z: 0 };
    expect(pushOut(pos, 0.4, { kind: 'circle', x: 0, z: 0, r: 0.5 })).toBe(true);
    expect(pos.x).toBeCloseTo(0.9);
  });

  it('moves a circle out of a rotated box along the face normal', () => {
    const box: Collider = { kind: 'box', x: 0, z: 0, hx: 2, hz: 0.5, rot: 90 * DEG };
    // Rotated by 90°, the long side runs along Z. A body at x = 0.7 overlaps the +X face.
    const pos = { x: 0.7, z: 1 };
    expect(pushOut(pos, 0.4, box)).toBe(true);
    expect(Math.abs(pos.x)).toBeCloseTo(0.9);
    expect(pos.z).toBeCloseTo(1);
    expect(colliderDistance(box, pos.x, pos.z)).toBeCloseTo(0.4);
  });

  it('pushes a center that is inside a box out through the nearest face', () => {
    const pos = { x: 0.9, z: 0 };
    pushOut(pos, 0.3, { kind: 'box', x: 0, z: 0, hx: 1, hz: 1, rot: 0 });
    expect(pos.x).toBeCloseTo(1.3);
  });
});

describe('courtyard footprints', () => {
  const colliders = courtyardColliders();

  it('keeps the player start and all spawn points free', () => {
    for (const s of [COURTYARD.playerStart, ...COURTYARD.spawns]) {
      for (const c of colliders) expect(colliderDistance(c, s.x, s.z)).toBeGreaterThan(0.4);
    }
  });

  it('splits a facade at its gate', () => {
    const north = COURTYARD.facades.find((f) => f.id === 'north');
    expect(north).toBeDefined();
    if (!north) return;
    const parts = facadeColliders(north);
    expect(parts).toHaveLength(2);
    // Middle of the gateway is open, the wall next to it is solid.
    expect(parts.every((c) => colliderDistance(c, 4.25, -9) > 1)).toBe(true);
    expect(parts.some((c) => colliderDistance(c, 0, -9) < 0)).toBe(true);
  });

  it('holds a body inside the yard walls', () => {
    const pos = { x: -12.5, z: 3 };
    resolveStatic(pos, 0.4, colliders);
    expect(pos.x).toBeGreaterThanOrEqual(-11.6 - 1e-6);
  });
});

describe('sectorHitsCircle', () => {
  const hit = (cx: number, cz: number, lo = -30 * DEG, hi = 30 * DEG): boolean =>
    sectorHitsCircle(0, 0, 0, lo, hi, 0.2, 2, cx, cz, 0.4);

  it('hits a body straight ahead within reach', () => {
    expect(hit(0, 1.5)).toBe(true);
  });
  it('misses beyond reach and behind', () => {
    expect(hit(0, 2.5)).toBe(false);
    expect(hit(0, -1.5)).toBe(false);
  });
  it('counts the body radius at the edge of the arc', () => {
    // 45° off axis at 1.5 m: the center is outside ±30°, the 0.4 m body still overlaps.
    expect(hit(Math.sin(45 * DEG) * 1.5, Math.cos(45 * DEG) * 1.5)).toBe(true);
    expect(hit(Math.sin(60 * DEG) * 1.5, Math.cos(60 * DEG) * 1.5)).toBe(false);
  });
  it('treats positive angles as the left side (+X when facing +Z)', () => {
    expect(hit(1.2, 0.3, 40 * DEG, 100 * DEG)).toBe(true);
    expect(hit(-1.2, 0.3, 40 * DEG, 100 * DEG)).toBe(false);
  });
});
