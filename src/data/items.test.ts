import { DIFFICULTIES } from './difficulty';
import { describe, expect, test } from 'vitest';
import * as items from './items';
import * as names from './item-names';
import * as crafting from './crafting';
import * as progression from './progression';

describe('ported item and progression data', () => {
  test.each([
    ['mods (6 from 2D plus 6 strong Späti ones, M13b)', crafting.WEAPON_MODS, 12],
    ['meals', crafting.MEALS, 5],
    ['consumables', crafting.CONSUMABLES, 2],
    ['perks (50 from 2D plus 8 Umbau cards added in 3D, G1)', progression.PERKS, 58],
    ['survivors', progression.SURVIVORS, 6],
    ['camp buildings', progression.CAMP_BUILDINGS, 7],
  ] as const)('%s retain their source count and unique ids', (_label, rows, count) => {
    expect(rows).toHaveLength(count);
    expect(new Set(rows.map(row => row.id)).size).toBe(count);
    for (const row of rows) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.description.length).toBeGreaterThan(0);
    }
  });

  test('keyed tables retain their source counts', () => {
    // Duplicate object keys are rejected by TypeScript; counts also catch omissions.
    for (const [table, count] of [
      [items.AFFIXES, 11], [items.ELEMENTS, 3], [items.ENEMY_RESISTANCES, 30],
      [items.IMPLICITS, 26], [items.SETS, 5], [items.SET_BONUSES, 5],
      [items.LEGENDARY_POWERS, 20], [items.LEGENDARY_ELEMENTS, 9],
      [items.WEAPON_KINDS, 4], [names.BASES, 96 /* 91 from 2D + three Klinge names + Die Letzte Bestellung + Telespargel */],
      [crafting.MATERIALS, 4], [crafting.INGREDIENTS, 3],
      [crafting.ENEMY_MATERIAL_DROPS, 14], [crafting.ENEMY_INGREDIENT_DROPS, 9],
    ] as const) expect(Object.keys(table)).toHaveLength(count);
  });

  test('slots are unique and their display names and main stats resolve', () => {
    expect(items.SLOTS).toEqual(['w', 'h', 'a', 'g', 'f', 't', 'r', 'i']);
    expect(new Set(items.SLOTS).size).toBe(items.SLOTS.length);
    expect(Object.keys(items.SLOT_NAMES).sort()).toEqual([...items.SLOTS].sort());
    for (const [slot, stat] of Object.entries(items.SLOT_MAIN_STATS)) {
      expect(items.SLOTS).toContain(slot);
      expect(items.AFFIXES).toHaveProperty(stat);
    }
    expect(items.SLOT_MAIN_STATS).toEqual({ a: 'hp', h: 'res', g: 'as', f: 'spd' });
  });

  test('affix roll ranges are finite and ordered', () => {
    for (const affix of Object.values(items.AFFIXES)) {
      expect(Number.isFinite(affix.min)).toBe(true);
      expect(Number.isFinite(affix.max)).toBe(true);
      expect(affix.min).toBeLessThanOrEqual(affix.max);
    }
    expect(items.AFFIXES.regen.decimals).toBe(1);
    expect(items.AFFIXES.cdr.negative).toBe(1);
  });

  test('all pact, implicit, set bonus and mod affixes exist', () => {
    expect(items.PACTS).toHaveLength(8);
    for (const pair of items.PACTS) {
      expect(pair).toHaveLength(2);
      for (const range of pair) {
        expect(items.AFFIXES).toHaveProperty(range.id);
        expect(range.min).toBeLessThanOrEqual(range.max);
      }
    }
    const values = [
      ...Object.values(items.IMPLICITS).flat(),
      ...crafting.WEAPON_MODS.flatMap(mod => mod.affixes ?? []),
    ];
    for (const affix of values) {
      expect(items.AFFIXES).toHaveProperty(affix.id);
      expect(Number.isFinite(affix.value)).toBe(true);
    }
    for (const bonuses of Object.values(items.SET_BONUSES)) {
      for (const bonus of bonuses) {
        for (const [id, value] of Object.entries(bonus.affixes)) {
          expect(items.AFFIXES).toHaveProperty(id);
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  test('rarity multipliers ascend and shown-level bonuses retain the 2D values', () => {
    expect(items.RARITIES.map(rarity => rarity.multiplier)).toEqual([1, 1.35, 1.8, 2.6]);
    for (let i = 1; i < items.RARITIES.length; i++) {
      expect(items.RARITIES[i]!.multiplier).toBeGreaterThan(items.RARITIES[i - 1]!.multiplier);
    }
    expect(items.ITEM_LEVEL_BONUS).toEqual([0, 3, 6, 10]);
    expect(names.RARITY_SUFFIXES).toHaveLength(items.RARITIES.length);
    expect(names.RARITY_SUFFIXES[0]).toEqual([]);
    expect(names.RARITY_SUFFIXES[3]).toEqual([]);
  });

  test('every item name resolves to a base, including district variants and legacy aliases', () => {
    const allNames = [
      ...Object.values(names.WEAPON_NAMES).flat(),
      ...Object.values(names.NEON_WEAPON_NAMES).flat(),
      ...Object.values(names.GDR_WEAPON_NAMES).flat(),
      ...Object.values(names.LEGENDARY_WEAPON_NAMES).flat(),
      ...Object.values(names.IMPLANT_NAMES).flat(),
      ...Object.values(names.RING_NAMES).flat(),
      ...Object.values(names.TALISMAN_NAMES).flat(),
      ...names.ARMOR_NAMES, ...names.NEON_ARMOR_NAMES, ...names.GDR_ARMOR_NAMES,
      ...names.LEGENDARY_ARMOR_NAMES, ...names.HEAD_NAMES, ...names.NEON_HEAD_NAMES,
      ...names.GDR_HEAD_NAMES, ...names.LEGENDARY_HEAD_NAMES, ...names.HAND_NAMES,
      ...names.GDR_HAND_NAMES, ...names.FOOT_NAMES, ...names.LEGENDARY_HAND_NAMES,
      ...names.LEGENDARY_FOOT_NAMES, ...names.LEGENDARY_IMPLANT_NAMES,
      ...names.LEGENDARY_RING_NAMES, ...names.LEGENDARY_TALISMAN_NAMES,
    ];
    for (const name of allNames) expect(names.BASES, name).toHaveProperty(name);
    expect(names.BASES.Aufziehschleuder).toBe(names.BASES.Aufziehwerfer);
    expect(names.BASES.Nagelschleuder).toBe(names.BASES.Nagelwerfer);
    for (const table of [names.WEAPON_NAMES, names.NEON_WEAPON_NAMES, names.GDR_WEAPON_NAMES, names.LEGENDARY_WEAPON_NAMES]) {
      expect(Object.keys(table).sort()).toEqual(Object.keys(items.WEAPON_KINDS).sort());
      for (const list of Object.values(table)) {
        expect(list.length).toBeGreaterThan(0);
        expect(new Set(list).size).toBe(list.length);
      }
    }
  });

  test('sets retain five valid pieces and matching 2/3/5-piece bonuses', () => {
    const bases = new Set(Object.values(names.BASES));
    const kinds = [...Object.keys(items.WEAPON_KINDS), 'armor', 'head', 'hand', 'feet', 'krit', 'tempo', 'heil'];
    expect(Object.keys(items.SET_BONUSES).sort()).toEqual(Object.keys(items.SETS).sort());
    for (const id of Object.keys(items.SETS) as items.SetId[]) {
      const set = items.SETS[id];
      expect(Object.keys(set.pieces)).toHaveLength(5);
      for (const [slot, piece] of Object.entries(set.pieces)) {
        expect(items.SLOTS).toContain(slot);
        expect(bases.has(piece.base)).toBe(true);
        expect(kinds).toContain(piece.kind);
      }
      expect(items.SET_BONUSES[id].map(bonus => bonus.pieces)).toEqual([2, 3, 5]);
      for (const bonus of items.SET_BONUSES[id]) {
        expect(set.bonusDescriptions[bonus.pieces].length).toBeGreaterThan(0);
      }
    }
  });

  test('implicit and legendary bases and elements resolve', () => {
    const bases = new Set<string>(Object.values(names.BASES));
    for (const base of [...Object.keys(items.IMPLICITS), ...Object.keys(items.LEGENDARY_POWERS)]) {
      expect(bases.has(base), base).toBe(true);
    }
    for (const [base, element] of Object.entries(items.LEGENDARY_ELEMENTS)) {
      expect(items.LEGENDARY_POWERS).toHaveProperty(base);
      expect(items.ELEMENTS).toHaveProperty(element);
    }
  });

  test('enemy element factors and drop references are valid', () => {
    const elements = Object.keys(items.ELEMENTS).sort();
    for (const resistances of Object.values(items.ENEMY_RESISTANCES)) {
      expect(Object.keys(resistances).sort()).toEqual(elements);
      for (const value of Object.values(resistances)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
    for (const [enemy, material] of Object.entries(crafting.ENEMY_MATERIAL_DROPS)) {
      expect(items.ENEMY_RESISTANCES).toHaveProperty(enemy);
      expect(crafting.MATERIALS).toHaveProperty(material);
    }
    for (const [enemy, ingredient] of Object.entries(crafting.ENEMY_INGREDIENT_DROPS)) {
      expect(items.ENEMY_RESISTANCES).toHaveProperty(enemy);
      expect(crafting.INGREDIENTS).toHaveProperty(ingredient);
    }
  });

  test('mod and meal recipes use existing resources with positive integral costs', () => {
    for (const [recipes, resources] of [
      [crafting.WEAPON_MODS, crafting.MATERIALS], [crafting.MEALS, crafting.INGREDIENTS],
    ] as const) {
      // M13b: strong Aufsätze have no recipe (only a Späti sells them).
      for (const recipe of recipes.filter((r) => !('spati' in r && r.spati))) {
        expect(Object.keys(recipe.costs).length).toBeGreaterThan(0);
        for (const [id, amount] of Object.entries(recipe.costs)) {
          expect(resources).toHaveProperty(id);
          expect(Number.isInteger(amount)).toBe(true);
          expect(amount).toBeGreaterThan(0);
        }
      }
    }
    for (const mod of crafting.WEAPON_MODS) {
      if (mod.element) expect(items.ELEMENTS).toHaveProperty(mod.element);
      // M13b: a strong one names a 2D base, has no recipe and is no base itself.
      if (mod.spati) {
        expect(Object.keys(mod.costs)).toHaveLength(0);
        expect(crafting.WEAPON_MODS.find((m) => m.id === mod.base)?.spati).toBeUndefined();
      } else expect(mod.base).toBeUndefined();
      if (mod.heavyHitEvery !== undefined) expect(mod.heavyHitEvery).toBeGreaterThan(0);
    }
    for (const meal of crafting.MEALS) {
      if (meal.requiredBuilding) {
        expect(progression.CAMP_BUILDINGS.map(building => building.id)).toContain(meal.requiredBuilding);
      }
    }
    for (const row of [...crafting.WEAPON_MODS, ...crafting.CONSUMABLES, ...progression.CAMP_BUILDINGS]) {
      expect(Number.isInteger(row.scrapCost)).toBe(true);
      expect(row.scrapCost).toBeGreaterThan(0);
    }
  });

  test('blessing prerequisites and weapon references resolve', () => {
    const ids = progression.PERKS.map(perk => perk.id);
    for (const perk of progression.PERKS) {
      expect(Number.isInteger(perk.max)).toBe(true);
      expect(perk.max).toBeGreaterThan(0);
      if (perk.requires && perk.requires !== 'any') expect(ids).toContain(perk.requires);
      if (perk.weapon) expect(items.WEAPON_KINDS).toHaveProperty(perk.weapon);
      if (perk.duo) expect(new Set(perk.duo).size).toBe(2);
    }
  });

  test('difficulty and weapon damage factors preserve the current 2D balance', () => {
    // 2D DIFF as ratios to Normal (hp 1.75, damage 1.45), the single copy in src/data/difficulty.ts.
    expect(DIFFICULTIES.map(d => [+(d.hp * 1.75).toFixed(4), +(d.dmg * 1.45).toFixed(4), d.luck, d.scrap]))
      .toEqual([[0.7, 0.6, 0, 1], [1.75, 1.45, 0, 1], [2.15, 1.75, 4, 1.3]]);
    expect(Object.values(items.WEAPON_KINDS).map(kind => kind.damageFactor)).toEqual([1, 2.3, 0.85, 1.45]);
  });
});
