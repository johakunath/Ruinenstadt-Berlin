import { describe, expect, it } from 'vitest';
import type { Landmark } from '../data/map';
import { footprintDist, LandmarkReveal, REVEAL_NEAR, REVEAL_TIME } from './reveal';

const rathaus: Landmark = { kind: 'rathaus', x: 0, z: 0, rot: Math.PI / 2, hx: 13, hz: 15, clear: 3 };
const spati: Landmark = { kind: 'spati', x: 100, z: 0, rot: 0, hx: 5, hz: 4, clear: 2 };

describe('landmark reveal (M11d)', () => {
  it('measures the distance to the rotated footprint', () => {
    expect(footprintDist(rathaus, 0, 0)).toBe(0);
    // Rotated a quarter turn: the 15 m half depth runs along x.
    expect(footprintDist(rathaus, 20, 0)).toBeCloseTo(5, 5);
    expect(footprintDist(rathaus, 0, 20)).toBeCloseTo(7, 5);
  });

  it('runs once per landmark when the hero comes near, then hands the camera back', () => {
    const r = new LandmarkReveal([rathaus]);
    expect(r.update(0.1, 0, 40, true, [])).toBeNull();
    const p = r.update(0.1, 0, 13 + REVEAL_NEAR - 1, true, []);
    expect(p).not.toBeNull();
    expect(r.active).toBe(true);
    let last = p!.weight;
    for (let t = 0; t < REVEAL_TIME; t += 0.1) last = r.update(0.1, 0, 20, true, [])?.weight ?? 0;
    expect(last).toBe(0);
    expect(r.active).toBe(false);
    expect(r.update(0.1, 0, 20, true, [])).toBeNull();
  });

  it('waits while enemies are close, skips Spätis, and can be skipped', () => {
    const r = new LandmarkReveal([rathaus, spati]);
    expect(r.update(0.1, 0, 20, true, [{ x: 0, z: 25 }])).toBeNull();
    expect(r.update(0.1, 100, 6, true, [])).toBeNull();
    expect(r.update(0.1, 0, 20, true, [])).not.toBeNull();
    r.skip();
    expect(r.active).toBe(false);
  });

  it('looks at the landmark from in front and above at full weight', () => {
    const r = new LandmarkReveal([{ ...rathaus, rot: 0 }]);
    let p = r.update(0.01, 0, 20, true, []);
    for (let i = 0; i < 20; i++) p = r.update(0.1, 0, 20, true, []);
    expect(p!.weight).toBe(1);
    expect(p!.pos.z).toBeGreaterThan(20);
    expect(p!.pos.y).toBeGreaterThan(p!.look.y + 10);
    expect(p!.look.x).toBe(0);
  });
});
