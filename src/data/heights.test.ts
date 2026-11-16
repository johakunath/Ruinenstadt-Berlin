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
    const sim = createSim({ level, empty: true });
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

  for (const scale of [1, 1.3]) {
    it(`every stair leads up onto its terrace (scale ${scale})`, () => {
      const ms = koepenickMap(scale);
      const lv = mapLevel(ms, generateLots(ms));
      for (const t of ms.terraces) {
        for (const s of t.stairs) {
          const ux = Math.sin(s.rot);
          const uz = Math.cos(s.rot);
          const sim = createSim({ level: lv, empty: true });
          const p = sim.player;
          p.x = p.px = s.x - ux * (s.len / 2 + 2);
          p.z = p.pz = s.z - uz * (s.len / 2 + 2);
          for (let i = 0; i < 90; i++) stepSim(sim, { ...NO_INPUT, moveX: ux, moveZ: uz });
          expect(heightAt(ms, p.x, p.z), `${t.name} ${s.rot}`).toBeCloseTo(t.h);
        }
      }
    // Builds a whole map at another scale and walks every stair: slow on small CI machines.
    }, 20000);
  }
});
