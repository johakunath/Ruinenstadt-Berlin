import { describe, expect, it } from 'vitest';
import { healPlayer } from './heal';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type SimEvent } from './types';

const heals = (ev: SimEvent[]) => ev.filter((e): e is Extract<SimEvent, { type: 'heal' }> => e.type === 'heal');

describe('healPlayer', () => {
  it('heals up to max life and reports the clamped amount', () => {
    const s = createSim({ empty: true });
    s.player.hp = s.stats.maxHp - 10;
    s.events.length = 0;
    expect(healPlayer(s, 25, 'pickup')).toBe(10);
    expect(s.player.hp).toBe(s.stats.maxHp);
    expect(heals(s.events)).toEqual([{ type: 'heal', amount: 10, source: 'pickup' }]);
  });

  it('does nothing at full life, when dead or for nothing', () => {
    const s = createSim({ empty: true });
    s.events.length = 0;
    expect(healPlayer(s, 25, 'food')).toBe(0);
    s.player.hp = 10;
    expect(healPlayer(s, 0, 'food')).toBe(0);
    s.player.state = 'dead';
    expect(healPlayer(s, 25, 'food')).toBe(0);
    expect(s.player.hp).toBe(10);
    expect(heals(s.events)).toEqual([]);
  });

  it('marks small repeated heals as ticks', () => {
    const s = createSim({ empty: true });
    s.player.hp = 10;
    healPlayer(s, 0.05, 'regen');
    healPlayer(s, 5, 'breath');
    expect(heals(s.events).map((e) => e.tick)).toEqual([true, undefined]);
  });

  it('regeneration reports its heal every step while hurt', () => {
    const s = createSim({ empty: true });
    s.stats.regen = 6;
    s.player.hp = 10;
    s.events.length = 0;
    stepSim(s, NO_INPUT);
    const h = heals(s.events).filter((e) => e.source === 'regen');
    expect(h).toHaveLength(1);
    expect(h[0]!.amount).toBeCloseTo(0.1);
  });
});
