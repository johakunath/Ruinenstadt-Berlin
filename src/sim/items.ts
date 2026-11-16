// Item rules ported from the 2D js/items.js. Random draw order and formulas are preserved.
import {
  AFFIXES, ITEM_LEVEL_BONUS, LEGENDARY_ELEMENTS, PACTS, RARITIES, SETS, WEAPON_KINDS,
  type Affix, type AffixId, type AttributeKindId, type ElementId, type ItemKindId,
  type RarityId, type SetId, type SlotId, type WeaponKindId,
} from '../data/items';
import * as N from '../data/item-names';
import type { WeaponModId, MaterialId } from '../data/crafting';
import { Rng } from './math';

export interface Item {
  id: number;
  locked?: boolean;
  slot: SlotId;
  kind: string;
  base: string;
  name: string;
  rarity: RarityId;
  value: number;
  itemLevel: number;
  affixes: Affix[];
  element?: ElementId;
  set?: SetId;
  mods?: WeaponModId[];
  power?: 0 | 1;
  implantMode?: 0 | 1 | 2;
}

export interface LootContext {
  district: number;
  /** Sum of camp, difficulty, gear, threat and Eisen luck contributions. */
  luck: number;
  /** Effective wave (2D wE()), or 1 outside a run. */
  wave: number;
  flavor?: 'neon' | 'gdr';
  /** Caller-owned last allocated id. Share one context per sim; persist with its state. */
  itemId?: number;
}

export function rollRarity(rng: Rng, ctx: LootContext, minRarity = 0): RarityId {
  const l = ctx.luck, w = ctx.wave;
  const weights = [60, 18 + w * .6 + l * .8, 4 + w * .35 + l * .4, .1 + w * .04 + l * .03];
  for (let i = 0; i < minRarity; i++) weights[i] = 0;
  let x = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 4; i++) if ((x -= weights[i]!) < 0) return i as RarityId;
  return minRarity as RarityId;
}

export function makeItem(rng: Rng, ctx: LootContext, itemLevel: number, minRarity = 0, forcedSlot?: SlotId): Item {
  itemLevel += 3 * ctx.district;
  const cy = ctx.flavor === 'neon', gd = ctx.flavor === 'gdr';
  const rarity = rollRarity(rng, ctx, minRarity), roll = rng.next();
  const slot = forcedSlot || (cy && rng.next() < (rarity === 3 ? .25 : .12) ? 'i' : undefined)
    || (rarity === 3
      ? roll < .3 ? 'w' : roll < .55 ? 'a' : roll < .67 ? 't' : roll < .76 ? 'h' : roll < .84 ? 'g' : roll < .92 ? 'f' : 'r'
      : roll < .3 ? 'w' : roll < .46 ? 'a' : roll < .56 ? 'h' : roll < .66 ? 'g' : roll < .76 ? 'f' : roll < .88 ? 't' : 'r');
  const m = RARITIES[rarity].multiplier * rng.range(.85, 1.15) * .9;
  let kind: ItemKindId, name: string, value: number;
  if (slot === 'w') {
    const weapon = rng.pick<WeaponKindId>(['blade', 'blade', 'hammer', 'sling', 'spear']);
    kind = weapon;
    name = rng.pick(rarity === 3 ? N.LEGENDARY_WEAPON_NAMES[weapon]
      : cy && rng.next() < .45 ? N.NEON_WEAPON_NAMES[weapon]
      : gd && rng.next() < .45 ? N.GDR_WEAPON_NAMES[weapon] : N.WEAPON_NAMES[weapon]);
    value = Math.round((4 + itemLevel * 1.6) * WEAPON_KINDS[weapon].damageFactor * m);
  } else if (slot === 'a') {
    kind = 'armor';
    name = rng.pick(rarity === 3 ? N.LEGENDARY_ARMOR_NAMES : cy && rng.next() < .4 ? N.NEON_ARMOR_NAMES : gd && rng.next() < .4 ? N.GDR_ARMOR_NAMES : N.ARMOR_NAMES);
    value = Math.round((12 + itemLevel * 6) * m);
  } else if (slot === 'h') {
    kind = 'head';
    name = rng.pick(rarity === 3 ? N.LEGENDARY_HEAD_NAMES : cy && rng.next() < .4 ? N.NEON_HEAD_NAMES : gd && rng.next() < .4 ? N.GDR_HEAD_NAMES : N.HEAD_NAMES);
    value = Math.round((2 + itemLevel * .12) * m);
  } else if (slot === 'g' || slot === 'f') {
    kind = slot === 'g' ? 'hand' : 'feet';
    name = rng.pick(rarity === 3 ? slot === 'g' ? N.LEGENDARY_HAND_NAMES : N.LEGENDARY_FOOT_NAMES
      : slot === 'g' ? gd && rng.next() < .4 ? N.GDR_HAND_NAMES : N.HAND_NAMES : N.FOOT_NAMES);
    value = Math.round((3 + itemLevel * .12) * m);
  } else if (slot === 'i') {
    const attribute = rarity === 3 ? 'tempo' : rng.pick<AttributeKindId>(['krit', 'tempo', 'heil']);
    kind = attribute;
    name = rng.pick(rarity === 3 ? N.LEGENDARY_IMPLANT_NAMES : N.IMPLANT_NAMES[attribute]);
    value = +(({ krit: 2.5 + itemLevel * .3, tempo: 3 + itemLevel * .25, heil: .4 + itemLevel * .1 }[attribute]) * m).toFixed(attribute === 'heil' ? 1 : 0);
  } else {
    const attribute = rng.pick<AttributeKindId>(['krit', 'tempo', 'heil']);
    kind = attribute;
    name = rng.pick(rarity === 3 ? slot === 'r' ? N.LEGENDARY_RING_NAMES : N.LEGENDARY_TALISMAN_NAMES
      : (slot === 'r' ? N.RING_NAMES : N.TALISMAN_NAMES)[attribute]);
    const b = { krit: 3 + itemLevel * .35, tempo: 4 + itemLevel * .3, heil: .5 + itemLevel * .12 }[attribute] * m;
    value = attribute === 'heil' ? +b.toFixed(1) : Math.round(b);
  }
  const base = N.BASES[name]!;
  if (rarity === 1 || rarity === 2) name += ' ' + rng.pick(N.RARITY_SUFFIXES[rarity]);
  const item: Item = { id: nextId(ctx), slot, kind, base, name, rarity, value, itemLevel, affixes: [] };
  rollAffixes(rng, item);
  return item;
}

export function makeSetItem(rng: Rng, ctx: LootContext, itemLevel: number): Item {
  const set = rng.pick<SetId>(['kiez', 'spree', 'zit']);
  const slot = rng.pick(Object.keys(SETS[set].pieces) as SlotId[]);
  const { name, kind, base } = SETS[set].pieces[slot]!;
  let value: number;
  // Unlike ordinary items, the 2D set formula does not add district levels or roll a value multiplier.
  if (slot === 'w') value = Math.round((4 + itemLevel * 1.6) * WEAPON_KINDS[kind as WeaponKindId].damageFactor * 1.8);
  else if (slot === 'a') value = Math.round((12 + itemLevel * 6) * 1.8);
  else if (slot === 'h') value = Math.round((2 + itemLevel * .12) * 1.8);
  else if (slot === 'g' || slot === 'f') value = Math.round((3 + itemLevel * .12) * 1.8);
  else value = Math.round({ krit: 3 + itemLevel * .35, tempo: 4 + itemLevel * .3 }[kind as 'krit' | 'tempo'] * 1.8);
  const item: Item = { id: nextId(ctx), slot, kind, base, name, rarity: 2, value, itemLevel, affixes: [], set };
  rollAffixes(rng, item);
  delete item.element;
  return item;
}

export function lootItem(rng: Rng, ctx: LootContext, itemLevel: number, minRarity = 0, setChance?: number): Item {
  // Preserve 2D's p || .05, including the set branch bypassing minRarity.
  return rng.next() < (setChance || .05) ? makeSetItem(rng, ctx, itemLevel) : makeItem(rng, ctx, itemLevel, minRarity);
}

function nextId(ctx: LootContext): number {
  return ctx.itemId = (ctx.itemId ?? 0) + 1;
}

function rollAffixes(rng: Rng, item: Item): void {
  const r = item.rarity, il = item.itemLevel, m = Math.sqrt(RARITIES[r].multiplier);
  const add = (id: AffixId, value: number): void => {
    if (id === 'hp') value *= 1 + il * .15;
    if (value > 0) value *= m;
    const decimals = AFFIXES[id].decimals;
    value = decimals ? +value.toFixed(1) : Math.round(value);
    if (!value) return;
    const index = item.affixes.findIndex(a => a.id === id);
    if (index >= 0) {
      const sum = item.affixes[index]!.value + value;
      item.affixes[index] = { id, value: decimals ? +sum.toFixed(1) : sum };
    } else item.affixes.push({ id, value });
  };
  let n = [0, 1, 2, 3][r]!;
  if (r === 3 || (r === 2 && rng.next() < .45)) {
    for (const q of rng.pick(PACTS)) add(q.id, rng.range(q.min, q.max));
    n--;
  }
  const keys = (Object.keys(AFFIXES) as AffixId[]).filter(id => !item.affixes.some(a => a.id === id));
  for (let i = 0; i < n && keys.length; i++) {
    const id = keys.splice(rng.int(keys.length), 1)[0]!;
    add(id, rng.range(AFFIXES[id].min, AFFIXES[id].max));
  }
  if (item.slot === 'w') {
    if (r === 3) {
      const element = LEGENDARY_ELEMENTS[item.base as keyof typeof LEGENDARY_ELEMENTS];
      if (element) item.element = element;
    } else if (r >= 1 && rng.next() < (r === 1 ? .3 : .5)) item.element = rng.pick<ElementId>(['fire', 'acid', 'shock']);
    if (r >= 1 && r < 3 && ['leucht', 'neonfl', 'zeiger'].includes(item.base) && rng.next() < .6) item.element = 'shock';
    if (r >= 1 && r < 3 && item.base === 'sichel' && rng.next() < .6) item.element = 'acid';
  }
  item.affixes = item.affixes.filter(a => a.value !== 0);
}

export function shownLevel(item: Item): number {
  return (item.itemLevel || 0) + ITEM_LEVEL_BONUS[item.rarity || 0];
}

export function isUpgrade(item: Item, equipped: Item | undefined): boolean {
  return !equipped || shownLevel(item) > shownLevel(equipped);
}

/** 2D avgIl, considering only occupied equipment slots. */
export function avgIl(equipment: Partial<Record<SlotId, Item>>): number {
  const items = Object.values(equipment).filter((item): item is Item => !!item);
  return items.length ? Math.round(items.reduce((sum, item) => sum + shownLevel(item), 0) / items.length) : 0;
}

export function scrapValue(item: Item): number {
  return Math.round([3, 8, 20, 50][item.rarity || 0]! * (1 + item.itemLevel * .08));
}

const SALVAGE_MATERIALS: Readonly<Record<SlotId, readonly MaterialId[]>> = {
  w: ['metall', 'metall', 'kabel'], a: ['stoff', 'stoff', 'metall'], h: ['stoff', 'metall'],
  g: ['stoff', 'chemie'], f: ['stoff', 'metall'], t: ['kabel', 'chemie'],
  r: ['kabel', 'chemie'], i: ['kabel', 'kabel', 'chemie'],
};
const SALVAGE_COUNTS = [.3, .7, 1.5, 3] as const;

export function salvage(rng: Rng, item: Item): { scrap: number; materials: Partial<Record<MaterialId, number>> } {
  const n = SALVAGE_COUNTS[item.rarity || 0];
  const count = Math.floor(n) + (rng.next() < n % 1 ? 1 : 0);
  const materials: Partial<Record<MaterialId, number>> = {};
  for (let i = 0; i < count; i++) {
    const id = rng.pick(SALVAGE_MATERIALS[item.slot]);
    materials[id] = (materials[id] || 0) + 1;
  }
  return { scrap: scrapValue(item), materials };
}

export function price(item: Item): number {
  return Math.round((item.rarity + 1) * 3 * (1 + item.itemLevel * .08));
}
