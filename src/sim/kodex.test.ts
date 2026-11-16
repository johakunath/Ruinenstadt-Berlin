import { describe, expect, it } from 'vitest';
import { createSim } from './sim';
import { killEnemy } from './combat';
import { collectItem } from './inventory';
import { parseSave, simFromSave, snapshot } from './save';
import { spawnEnemy } from './enemies';

describe('Kodex (U2)', () => {
  it('notes the first kill of a kind and of an elite, counts the rest', () => {
    const s = createSim({ seed: 3 });
    const a = spawnEnemy(s, 3, 3, 'brute'), b = spawnEnemy(s, 4, 3, 'brute');
    a.elite = 'flink';
    killEnemy(s, a); killEnemy(s, b);
    expect(s.inventory.kodex?.kills.brute).toBe(2);
    expect(s.inventory.kodex?.kills['e:flink']).toBe(1);
    expect(s.events.filter(e => e.type === 'kodex').map(e => e.type === 'kodex' && e.name)).toEqual(['Brocken', 'Elite Flink']);
  });
  it('notes legendary and set finds once, not normal items, and survives a save', () => {
    const s = createSim({ seed: 3 });
    const item = { id: 900, slot: 'a' as const, kind: 'armor', base: 'herz', name: 'Herz', rarity: 3 as const, value: 50, itemLevel: 4, affixes: [] };
    collectItem(s, item); collectItem(s, { ...item, id: 901 }); collectItem(s, { ...item, id: 902, base: 'leder', rarity: 1 });
    expect(s.inventory.kodex?.found).toEqual({ herz: 1 });
    expect(s.events.filter(e => e.type === 'kodex')).toHaveLength(1);
    const back = simFromSave(parseSave(JSON.stringify(snapshot(s, 'Hof', false)))!, { seed: 1, stress: 0 }, false);
    expect(back.inventory.kodex?.found.herz).toBe(1);
  });
});
