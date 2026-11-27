// Debug `?gear=turm,spaeti,kiez` (WP4 step 5): equip legendaries by base and whole sets by id at the start, to look at
// their effects and measure them on a device (hardware check: fps with three emitters). Never saved: `main.ts` turns
// persistence off with it. Not a game rule.
import { LEGENDARY_ELEMENTS, SETS, type LegendaryId, type SetId, type SlotId, type WeaponKindId } from '../data/items';
import * as N from '../data/item-names';
import type { Item } from './items';
import type { Equipment } from './stats';

const WEAR: ReadonlyArray<readonly [SlotId, string, readonly string[]]> = [
  ['a', 'armor', N.LEGENDARY_ARMOR_NAMES], ['h', 'head', N.LEGENDARY_HEAD_NAMES], ['g', 'hand', N.LEGENDARY_HAND_NAMES], ['f', 'feet', N.LEGENDARY_FOOT_NAMES],
  ['t', 'krit', N.LEGENDARY_TALISMAN_NAMES], ['r', 'krit', N.LEGENDARY_RING_NAMES], ['i', 'tempo', N.LEGENDARY_IMPLANT_NAMES],
];

/** The legendary item of base `id` (any slot), as the game would roll it but without affixes. */
export function legendaryItem(id: LegendaryId, n = 0): Item | null {
  const kinds = Object.keys(N.LEGENDARY_WEAPON_NAMES) as WeaponKindId[];
  const weapons: Array<[WeaponKindId, string]> = [...kinds.flatMap((k) => N.LEGENDARY_WEAPON_NAMES[k].map((name): [WeaponKindId, string] => [k, name])), ['hammer', N.FEST_LEGENDARY_WEAPON], ['spear', N.TURM_LEGENDARY_WEAPON]];
  const w = weapons.find(([, name]) => N.BASES[name] === id);
  if (w) return { id: 9000 + n, slot: 'w', kind: w[0], base: id, name: w[1], rarity: 3, value: 12, itemLevel: 1, affixes: [], ...(LEGENDARY_ELEMENTS[id] ? { element: LEGENDARY_ELEMENTS[id] } : {}) };
  for (const [slot, kind, names] of WEAR) {
    const name = names.find((x) => N.BASES[x] === id);
    if (name) return { id: 9000 + n, slot, kind, base: id, name, rarity: 3, value: 10, itemLevel: 1, affixes: [] };
  }
  return null;
}

/** Items for `?gear=`: legendary bases and set ids (all pieces of that set), later words win a slot. Unknown words are skipped. */
export function debugGear(words: readonly string[]): Equipment {
  const out: Equipment = {};
  words.forEach((word, n) => {
    if (word in SETS) {
      for (const [slot, p] of Object.entries(SETS[word as SetId].pieces)) out[slot as SlotId] = { id: 9100 + n * 10 + Object.keys(out).length, slot: slot as SlotId, kind: p!.kind, base: p!.base, name: p!.name, rarity: 2, value: 10, itemLevel: 1, affixes: [], set: word as SetId };
      return;
    }
    const it = legendaryItem(word as LegendaryId, n);
    if (it) out[it.slot] = it;
  });
  return out;
}
