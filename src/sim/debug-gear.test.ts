import { describe, expect, it } from 'vitest';
import { LEGENDARY_POWERS, SETS, type LegendaryId } from '../data/items';
import { debugGear, legendaryItem } from './debug-gear';
import { setLoadout } from './loadout';
import { createSim } from './sim';
import { setCount } from './stats';

describe('?gear= debug loadout (WP4 step 5)', () => {
  it('makes every legendary by its base, and the hero then has that power', () => {
    for (const id of Object.keys(LEGENDARY_POWERS) as LegendaryId[]) {
      const it = legendaryItem(id);
      expect(it, id).not.toBeNull();
      const s = createSim({ empty: true });
      setLoadout(s, { ...s.equipment, [it!.slot]: it! });
      expect(s.stats.legendary, id).toContain(id);
    }
  });
  it('puts on all pieces of a set and lets later words win the slot', () => {
    const eq = debugGear(['kiez', 'turm', 'unknown']);
    expect(eq.w?.base).toBe('turm');
    expect(eq.a?.set).toBe('kiez');
    const s = createSim({ empty: true });
    setLoadout(s, { ...s.equipment, ...eq });
    expect(setCount(s.equipment, 'kiez')).toBe(Object.keys(SETS.kiez.pieces).length - 1);
    expect(s.stats.legendary).toEqual(['turm']);
  });
});
