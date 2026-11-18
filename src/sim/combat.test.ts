import { describe, it, expect } from 'vitest';
import { mitteMap } from '../data/mitte';
import { mapLevel } from '../data/map';
import { chain, STATUS, strike } from './combat';
import { spawnEnemy } from './enemies';
import { createSim } from './sim';
import type { Sim } from './types';

/** Open courtyard; every hit procs the one element given. */
function fresh(wet: boolean, el: 'fire' | 'shock'): Sim {
  const s = createSim({ empty: true });
  s.wet = wet;
  s.stats.crit = 0;
  s.stats.elements = [el];
  s.stats.elementChance = 1;
  return s;
}

describe('rain rule (M12c, 2D D.wet)', () => {
  it('fire burns 1.4 s in the rain instead of 2', () => {
    for (const wet of [false, true]) {
      const s = fresh(wet, 'fire');
      const e = spawnEnemy(s, s.player.x, s.player.z + 2, 'walker');
      e.hp = e.maxHp = 1e4;
      strike(s, e, 10);
      expect(e.burn, String(wet)).toBeCloseTo(wet ? STATUS.wetBurnTime : STATUS.burnTime);
    }
  });

  it('a shock chain reaches 6.3 m instead of 4.7 m and jumps once more', () => {
    const bolts = (wet: boolean, far: number): number => {
      const s = fresh(wet, 'shock');
      const src = spawnEnemy(s, s.player.x, s.player.z + 2, 'walker');
      for (let i = 0; i < 4; i++) spawnEnemy(s, src.x + Math.sin(i * 1.6) * 2, src.z + Math.cos(i * 1.6) * 2, 'walker').hp = 1e4;
      spawnEnemy(s, src.x + far, src.z, 'walker').hp = 1e4;
      s.events.length = 0;
      chain(s, src, 5, 2);
      return s.events.filter((q) => q.type === 'bolt').length;
    };
    expect(bolts(false, 9)).toBe(2);
    expect(bolts(true, 9)).toBe(3);
    // Reach: one body alone at 5.5 m.
    const reach = (wet: boolean): number => {
      const s = fresh(wet, 'shock');
      const src = spawnEnemy(s, s.player.x, s.player.z + 2, 'walker');
      spawnEnemy(s, src.x + 5.5, src.z, 'walker').hp = 1e4;
      s.events.length = 0;
      chain(s, src, 5, 2);
      return s.events.filter((q) => q.type === 'bolt').length;
    };
    expect(reach(false)).toBe(0);
    expect(reach(true)).toBe(1);
    expect(STATUS.wetChainRange).toBeCloseTo(190 / 30);
  });

  it('Mitte is wet from the map; the courtyard is dry', () => {
    expect(createSim({ empty: true }).wet).toBe(false);
    expect(createSim({ empty: true, level: mapLevel(mitteMap(), [], []) }).wet).toBe(true);
  });
});
