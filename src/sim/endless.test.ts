import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, mapLevel } from '../data/map';
import { createSim, stepSim } from './sim';
import { ENDLESS, endlessWave, startEndless } from './director';
import { NO_INPUT, type SimEvent } from './types';

const map = koepenickMap(1);
const level = mapLevel(map, generateLots(map));

describe('M18 endless mode', () => {
  it('waves grow, spawn around the hero, record the best and offer a blessing every second wave', () => {
    const sim = createSim({ level, startAt: level.encounters.length });
    expect(sim.run.phase).toBe('won');
    startEndless(sim);
    sim.player.invuln = 1e9;
    const log: SimEvent[] = [];
    for (let i = 0; i < 60 * 200 && (sim.run.endless ?? 0) < 2; i++) {
      stepSim(sim, NO_INPUT);
      for (const e of sim.enemies) if (e.state !== 'dead' && e.stateT > 0.2) { e.state = 'dead'; e.hp = 0; e.stateT = 0; }
      if (sim.abilities.offers.length) sim.abilities.offers = [];
      log.push(...sim.events); sim.events.length = 0;
    }
    expect(sim.run.endless).toBe(2);
    expect(sim.inventory.camp?.endlessBest).toBe(2);
    expect(log.filter(e => e.type === 'endlessWave' && e.done).map(e => e.type === 'endlessWave' && e.n)).toEqual([1, 2]);
    expect((sim.abilities.rewardT ?? 0) > 0 || log.some(e => e.type === 'endlessWave')).toBe(true);
    expect(endlessWave(sim, 10).count).toBe(ENDLESS.count + ENDLESS.perWave * 10);
    expect(endlessWave(sim, 10).hpMul).toBeGreaterThan(endlessWave(sim, 1).hpMul);
  });
});
