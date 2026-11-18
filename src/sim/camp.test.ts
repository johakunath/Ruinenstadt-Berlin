import { describe, expect, it } from 'vitest';
import { createSim } from './sim';
import { buySpatiUpgrade, SPATI_UPGRADE, spatiUpgradeCost, OPEN_STATIONS, SITE_COST, siteLevel, stationBuilt, buildMod, buildStation, buyDrill, buyUpgrade, cookMeal, craftConsumable, endExpedition, fromStash, installMod, nextLevel, removeMod, stashMax, stationLevel, toStash, upgradeCost, upgradeMax } from './camp';
import { parseSave, simFromSave, snapshot } from './save';

const rich = (built = true) => { const s = createSim({ seed: 5 }); s.inventory.scrap = 5000; s.inventory.materials = { metall: 40, stoff: 40, kabel: 40, chemie: 40 }; if (built) s.inventory.camp = { stations: { zeug: 1, hack: 1, imbiss: 1, exer: 1 }, stash: [], freed: [] }; return s; };

describe('M20 build sites', () => {
  it('three stations work on arrival, the other four are build sites', () => {
    const s = rich(false);
    expect(OPEN_STATIONS.every((id) => stationBuilt(s, id))).toBe(true);
    for (const id of ['zeug', 'imbiss', 'hack', 'exer'] as const) { expect(stationBuilt(s, id)).toBe(false); expect(siteLevel(s, id)).toBe(0); }
    expect(buyUpgrade(s, 'dmg').ok).toBe(false);
    expect(cookMeal(s, 'suppe').text).toBe('Erst den Imbiss bauen.');
    expect(buyDrill(s).ok).toBe(false);
  });
  it('a build site costs Schrott and material and opens level 1', () => {
    const s = rich(false);
    const scrap = s.inventory.scrap, metall = s.inventory.materials.metall!;
    expect(nextLevel(s, 'zeug')).toMatchObject({ level: 1, ok: true });
    expect(buildStation(s, 'zeug')).toEqual({ ok: true, text: 'Zeughaus gebaut' });
    expect(s.inventory.scrap).toBe(scrap - SITE_COST.zeug!.scrap!);
    expect(s.inventory.materials.metall).toBe(metall - SITE_COST.zeug!.metall!);
    expect(siteLevel(s, 'zeug')).toBe(1);
    expect(buyUpgrade(s, 'dmg').ok).toBe(true);
    expect(nextLevel(s, 'zeug')!.level).toBe(2);
  });
  it('too little Schrott keeps the site', () => {
    const s = rich(false);
    s.inventory.scrap = 50;
    expect(buildStation(s, 'hack').ok).toBe(false);
    expect(stationBuilt(s, 'hack')).toBe(false);
  });
  it('old saves keep a station whose workshop was used', () => {
    const s = rich(false);
    s.statContext.upgrades.hp = 2;
    s.statContext.drill = 1;
    expect(stationBuilt(s, 'hack') && stationBuilt(s, 'exer')).toBe(true);
    expect(stationBuilt(s, 'zeug')).toBe(false);
  });
});

describe('M13 camp', () => {
  it('upgrades cost 2D prices and stop at the station cap', () => {
    const s = rich();
    expect(upgradeCost(s, 'dmg')).toBe(19);
    for (let i = 0; i < 5; i++) expect(buyUpgrade(s, 'dmg').ok).toBe(true);
    expect(upgradeMax(s, 'dmg')).toBe(5);
    expect(buyUpgrade(s, 'dmg').ok).toBe(false);
    expect(s.stats.damage).toBeGreaterThan(createSim({ seed: 5 }).stats.damage);
  });
  it('level 2 needs the survivor, level 3 needs Alexanderplatz freed', () => {
    const s = rich();
    expect(nextLevel(s, 'zeug')!.needs).toEqual(['Mira befreien']);
    s.statContext.survivors.schmied = true;
    expect(buildStation(s, 'zeug').ok).toBe(true);
    expect(s.statContext.camp.lampe).toBe(true);
    expect(upgradeMax(s, 'dmg')).toBe(8);
    expect(nextLevel(s, 'zeug')!.needs).toEqual(['Alexanderplatz befreien']);
    endExpedition(s, true);
    expect(nextLevel(s, 'zeug')!.needs).toEqual(['Alexanderplatz befreien']);
    s.run.ended = false; endExpedition(s, true, 2);
    expect(buildStation(s, 'zeug').ok).toBe(true);
    expect(stationLevel(s, 'zeug')).toBe(3);
    expect(nextLevel(s, 'zeug')).toBeNull();
  });
  it('Ilse runs the Kommandantur; the Hackerspace level 3 sets the watchtower', () => {
    const s = rich();
    expect(nextLevel(s, 'kom')!.needs).toEqual([]);
    s.statContext.survivors.mechaniker = true; endExpedition(s, true, 2);
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

describe('Späti upgrades (playtest 2026-11-18)', () => {
  it('sharpen and armor at a Späti only, up to the cap, dearer than the workshop, and they stay', () => {
    const s = rich(false);
    expect(buySpatiUpgrade(s, 'dmg').ok).toBe(false);
    s.content.tradeAt = 0;
    expect(spatiUpgradeCost(s, 'dmg')).toBe(upgradeCost(s, 'dmg') * SPATI_UPGRADE.markup);
    const before = s.stats.damage, scrap = s.inventory.scrap, cost = spatiUpgradeCost(s, 'dmg');
    expect(buySpatiUpgrade(s, 'dmg').ok).toBe(true);
    expect(s.inventory.scrap).toBe(scrap - cost);
    expect(s.stats.damage).toBeGreaterThan(before);
    for (let i = 1; i < SPATI_UPGRADE.max; i++) expect(buySpatiUpgrade(s, 'dmg').ok).toBe(true);
    expect(buySpatiUpgrade(s, 'dmg').ok).toBe(false);
    expect(s.statContext.upgrades.dmg).toBe(SPATI_UPGRADE.max);
    expect(buySpatiUpgrade(s, 'hp').ok).toBe(true);
  });
});
