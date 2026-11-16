import { describe, expect, it } from 'vitest';
import { BAG_SIZE, collectItem, equipItem, salvageItem, unequipItem } from './inventory';
import { createSim } from './sim';
import { makeSetItem, scrapValue, type Item } from './items';
import { setCount } from './stats';
const item = (id: number, extra: Partial<Item> = {}): Item => ({ id, slot: 'a', kind: 'armor', base: 'leder', name: 'Lederjacke', rarity: 0, value: 80, itemLevel: 4, affixes: [], ...extra });

describe('M5 inventory', () => {
  it('collects by value, rejects duplicates/full bags without consuming RNG', () => {
    const s = createSim({ empty: true }), source = item(1);
    expect(collectItem(s, source)).toBe(true);
    source.value = 999;
    expect(s.inventory.bag[0]!.value).toBe(80);
    expect(collectItem(s, source)).toBe(false);
    expect(collectItem(s, s.equipment.w!)).toBe(false);
    for (let i = 2; i <= BAG_SIZE; i++) expect(collectItem(s, item(i))).toBe(true);
    const before = structuredClone(s.rng);
    expect(collectItem(s, item(50))).toBe(false);
    expect(s.rng).toEqual(before);
  });
  it('equips and unequips, keeps HP share and refuses to remove the weapon', () => {
    const s = createSim({ empty: true });
    s.player.hp = s.stats.maxHp / 2;
    collectItem(s, item(1));
    const hp = s.stats.maxHp;
    expect(equipItem(s, 0)).toBe(true);
    expect(s.stats.maxHp).toBeGreaterThan(hp);
    expect(s.player.hp).toBeCloseTo(Math.round(s.stats.maxHp / 2));
    expect(s.inventory.bag).toHaveLength(0);
    expect(unequipItem(s, 'a')).toBe(true);
    expect(s.inventory.bag).toHaveLength(1);
    expect(unequipItem(s, 'w')).toBe(false);
    expect(equipItem(s, 99)).toBe(false);
  });
  it('swaps in a full bag, blocks unequip when full, preserves lock/mod metadata', () => {
    const s = createSim({ empty: true });
    for (let i = 1; i <= BAG_SIZE; i++) collectItem(s, item(i));
    equipItem(s, 0);
    collectItem(s, item(30, { locked: true }));
    expect(unequipItem(s, 'a')).toBe(false);
    expect(equipItem(s, 0)).toBe(true);
    expect(s.inventory.bag).toHaveLength(BAG_SIZE);
    expect(s.inventory.bag.some(i => i.id === 1)).toBe(true);
  });
  it('locks block salvage; deterministic salvage returns materials/mods once', () => {
    const a = createSim({ empty: true }), b = createSim({ empty: true });
    const gear = item(1, { rarity: 3, mods: ['nagel'], locked: true });
    for (const s of [a,b]) collectItem(s, gear);
    const before = structuredClone(a.rng);
    expect(salvageItem(a, 0)).toBe(false);
    expect(a.rng).toEqual(before);
    for (const s of [a,b]) { s.inventory.bag[0]!.locked = false; expect(salvageItem(s, 0)).toBe(true); }
    expect(a.inventory).toEqual(b.inventory);
    expect(a.inventory.scrap).toBe(scrapValue(gear));
    expect(a.inventory.mods.nagel).toBe(1);
    expect(Object.values(a.inventory.materials).reduce((n,v) => n+v,0)).toBe(3);
    expect(salvageItem(a,0)).toBe(false);
  });
  it('equipping/removing set pieces activates/deactivates the actual stat bonuses', () => {
    const s = createSim({empty:true});
    const ctx = { district: 0, wave: 1, luck: 0, itemId: 0 };
    // Find two distinct Kiez slots using the real generator.
    while (setCount(s.equipment, 'kiez') < 2) {
      const gear = makeSetItem(s.rng, ctx, 4);
      if (gear.set !== 'kiez' || s.equipment[gear.slot]) continue;
      collectItem(s, gear); equipItem(s, 0);
    }
    expect(setCount(s.equipment,'kiez')).toBe(2);
    const affixes = {...s.stats.affixes};
    const slot = Object.values(s.equipment).find(i => i.set === 'kiez' && i.slot !== 'w')!.slot;
    unequipItem(s,slot);
    expect(setCount(s.equipment,'kiez')).toBe(1);
    expect(s.stats.affixes).not.toEqual(affixes);
  });
  it('retry carries inventory without aliasing it', () => {
    const s = createSim({empty:true}); collectItem(s,item(1)); s.inventory.scrap=35;
    const retry = createSim({empty:true, inventory:s.inventory, equipment:s.equipment});
    expect(retry.inventory).toEqual(s.inventory);
    retry.inventory.bag.pop(); expect(s.inventory.bag).toHaveLength(1);
  });
});
