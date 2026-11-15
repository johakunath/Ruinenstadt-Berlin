import { describe, expect, it } from 'vitest';
import { createSim, stepSim } from '../sim/sim';
import { NO_INPUT } from '../sim/types';
import { koepenickMap } from './koepenick';
import { generateLots, heightAt, mapLevel } from './map';

const m = koepenickMap(1);
const level = mapLevel(m, generateLots(m));
const kirche = m.terraces.find((t) => t.name === 'Kirchhügel')!;

describe('heights', () => {
  it('raises hills smoothly and terraces flat', () => {
    const hill = m.hills[0]!;
    expect(heightAt(m, hill.x, hill.z)).toBeCloseTo(hill.h);
    expect(heightAt(m, hill.x + hill.r + hill.slope / 2, hill.z)).toBeGreaterThan(0);
    expect(heightAt(m, hill.x + hill.r + hill.slope / 2, hill.z)).toBeLessThan(hill.h);
    expect(heightAt(m, hill.x + hill.r + hill.slope + 1, hill.z)).toBe(0);
    expect(heightAt(m, 26, 17)).toBeCloseTo(kirche.h);
  });

  it('stairs ramp from the ground to the terrace', () => {
    const s = kirche.stairs[0]!;
    const low = heightAt(m, s.x - Math.sin(s.rot) * (s.len / 2 - 0.1), s.z - Math.cos(s.rot) * (s.len / 2 - 0.1));
    const mid = heightAt(m, s.x, s.z);
    expect(low).toBeLessThan(0.1);
    expect(mid).toBeCloseTo(kirche.h / 2, 1);
  });

  function walk(x: number, z: number, mx: number, mz: number, secs: number): { x: number; z: number } {
    const sim = createSim({ level });
    const p = sim.player;
    p.x = p.px = x;
    p.z = p.pz = z;
    for (let i = 0; i < secs * 60; i++) stepSim(sim, { ...NO_INPUT, moveX: mx, moveZ: mz });
    return { x: p.x, z: p.z };
  }

  it('retaining walls block the way up', () => {
    // From the south-west, straight east into the church hill wall (no stair there).
    const end = walk(10, 26, 1, 0, 2);
    expect(end.x).toBeLessThan(17);
  });

  it('the stairs lead up', () => {
    const s = kirche.stairs[0]!;
    const end = walk(s.x - 4, s.z, 1, 0, 1.5);
    expect(end.x).toBeGreaterThan(19);
    expect(heightAt(m, end.x, end.z)).toBeCloseTo(kirche.h);
  });
});
