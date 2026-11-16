import { describe, expect, it } from 'vitest';
import { createSim } from './sim';
import { buildMod, buildStation, buyDrill, buyUpgrade, cookMeal, craftConsumable, endExpedition, fromStash, installMod, nextLevel, removeMod, stashMax, stationLevel, toStash, upgradeCost, upgradeMax } from './camp';
import { parseSave, simFromSave, snapshot } from './save';

const rich = () => { const s = createSim({ seed: 5 }); s.inventory.scrap = 5000; s.inventory.materials = { metall: 40, stoff: 40, kabel: 40, chemie: 40 }; return s; };

describe('M13 camp', () => {
  it('upgrades cost 2D prices and stop at the station cap', () => {
    const s = rich();
    expect(upgradeCost(s, 'dmg')).toBe(19);
    for (let i = 0; i < 5; i++) expect(buyUpgrade(s, 'dmg').ok).toBe(true);
    expect(upgradeMax(s, 'dmg')).toBe(5);
    expect(buyUpgrade(s, 'dmg').ok).toBe(false);
    expect(s.stats.damage).toBeGreaterThan(createSim({ seed: 5 }).stats.damage);
  });
  it('level 2 needs the survivor, level 3 needs Köpenick freed', () => {
    const s = rich();
    expect(nextLevel(s, 'zeug')!.needs).toEqual(['Mira befreien']);
    s.statContext.survivors.schmied = true;
    expect(buildStation(s, 'zeug').ok).toBe(true);
    expect(s.statContext.camp.lampe).toBe(true);
    expect(upgradeMax(s, 'dmg')).toBe(8);
    expect(nextLevel(s, 'zeug')!.needs).toEqual(['Köpenick befreien']);
    endExpedition(s, true);
    expect(buildStation(s, 'zeug').ok).toBe(true);
    expect(stationLevel(s, 'zeug')).toBe(3);
    expect(nextLevel(s, 'zeug')).toBeNull();
  });
  it('Ilse runs the Kommandantur; the Hackerspace level 3 sets the watchtower', () => {
    const s = rich();
    expect(nextLevel(s, 'kom')!.needs).toEqual([]);
    s.statContext.survivors.mechaniker = true; endExpedition(s, true);
    buildStation(s, 'hack'); buildStation(s, 'hack');
    expect(s.statContext.camp.turm && s.statContext.camp.presse).toBe(true);
  });
  it('meals use Zutaten, hold for one expedition, cancel returns them', () => {
    const s = rich();
    expect(cookMeal(s, 'suppe').ok).toBe(false);
    s.inventory.ingredients = { gemuese: 3 };
    const hp = s.stats.maxHp;
    expect(cookMeal(s, 'suppe').ok).toBe(true);
    expect(s.inventory.ingredients.gemuese).toBe(0);
    expect(s.stats.maxHp).toBeGreaterThan(hp);
    cookMeal(s, 'suppe');
    expect(s.inventory.ingredients.gemuese).toBe(3);
    cookMeal(s, 'suppe'); endExpedition(s, false);
    expect(s.statContext.meal).toBeUndefined();
    expect(cookMeal(s, 'gurke').ok).toBe(false);
  });
  it('drill, Lazarett, mods and the Lager', () => {
    const s = rich();
    expect(buyDrill(s).ok).toBe(true); expect(s.statContext.drill).toBe(1);
    s.inventory.consumables = { verband: 2, molotow: 3 };
    expect(craftConsumable(s, 'verband').ok).toBe(true); expect(craftConsumable(s, 'verband').ok).toBe(false); expect(craftConsumable(s, 'molotow').ok).toBe(false);
    expect(buildMod(s, 'nagel').ok).toBe(true);
    expect(installMod(s, 'nagel').ok).toBe(true);
    expect(s.equipment.w!.mods).toEqual(['nagel']);
    expect(installMod(s, 'nagel').ok).toBe(false);
    expect(removeMod(s, 'nagel').ok).toBe(true); expect(s.inventory.mods.nagel).toBe(1);
    s.inventory.bag.push({ id: 77, slot: 'h', kind: 'head', base: 'helm', name: 'Helm', rarity: 0, value: 5, itemLevel: 1, affixes: [] });
    expect(toStash(s, 0).ok).toBe(true); expect(s.inventory.bag).toHaveLength(0); expect(stashMax(s)).toBe(40);
    const back = simFromSave(parseSave(JSON.stringify(snapshot(s, 'Hof', false)))!, { seed: 1, stress: 0 }, false);
    expect(back.inventory.camp!.stash[0]!.id).toBe(77); expect(back.statContext.drill).toBe(1);
    expect(fromStash(back, 0).ok).toBe(true); expect(back.inventory.bag[0]!.id).toBe(77);
  });
  it('an expedition ends once; stashed item ids stay reserved', () => {
    const s = rich();
    s.statContext.camp.garten = true; s.run.index = 3; s.statContext.meal = 'suppe';
    endExpedition(s, false); endExpedition(s, false);
    expect(s.inventory.ingredients?.gemuese).toBe(2);
    expect(s.statContext.meal).toBeUndefined();
    s.inventory.camp!.stash.push({ id: 999, slot: 'h', kind: 'head', base: 'helm', name: 'Helm', rarity: 0, value: 5, itemLevel: 1, affixes: [] });
    const t = createSim({ seed: 2, inventory: s.inventory, equipment: s.equipment, statContext: s.statContext });
    expect(t.lootCtx.itemId).toBeGreaterThanOrEqual(999);
  });
});
