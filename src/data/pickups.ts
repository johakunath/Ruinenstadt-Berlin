// Ground pickup models (WP4 step 3, backlog P10, D4): one model per drop kind, 20 in all, in
// `assets/props/pickups.glb` (built by `tools/pickup-models.mjs`). Weapon drops show the kind, not the base.
// No Three.js: the renderer (`src/render/loot.ts`) draws one InstancedMesh per model.
import { WEAPON_KINDS, type RarityId, type SlotId, type WeaponKindId } from './items';
import type { Item } from '../sim/items';
import type { DropContent } from '../sim/loot';

export const PICKUP_MODELS = [
  'blade', 'hammer', 'sling', 'spear', 'armor', 'head', 'hands', 'feet', 'talisman', 'ring', 'implant',
  'heal', 'food', 'stoff', 'metall', 'chemie', 'kabel', 'fleisch', 'gemuese', 'gewuerz',
] as const;
export type PickupModelId = (typeof PICKUP_MODELS)[number];

const SLOT_MODEL: Readonly<Record<Exclude<SlotId, 'w'>, PickupModelId>> = {
  a: 'armor', h: 'head', g: 'hands', f: 'feet', t: 'talisman', r: 'ring', i: 'implant',
};

/** The model of a drop: weapons by kind, other items by slot, the rest by what they are. */
export function pickupModel(c: DropContent): PickupModelId {
  switch (c.kind) {
    case 'heal':
    case 'food':
      return c.kind;
    case 'material':
    case 'ingredient':
      return c.id;
    case 'item': {
      const { slot, kind } = c.item;
      if (slot !== 'w') return SLOT_MODEL[slot];
      return kind in WEAPON_KINDS ? (kind as WeaponKindId) : 'blade';
    }
  }
}

/** A drawn rarity: 0 to 3, or a set piece. */
export type PickupRarity = RarityId | 'set';

/** A plain item of one model's kind (debug drops, the pickup sheet): a real base and name so the UI shows it. */
function item(slot: SlotId, kind: string, base: string, name: string, r: PickupRarity): DropContent {
  const it: Item = { id: 0, slot, kind, base, name, rarity: r === 'set' ? 2 : r, value: 1, itemLevel: 1, affixes: [] };
  if (r === 'set') it.set = 'kiez';
  return { kind: 'item', item: it };
}

/** A sample drop per model (rarity only for items). */
export const PICKUP_SAMPLES: Readonly<Record<PickupModelId, (r: PickupRarity) => DropContent>> = {
  blade: (r) => item('w', 'blade', 'stahl', 'Stahlklinge', r),
  hammer: (r) => item('w', 'hammer', 'vorschlag', 'Vorschlaghammer', r),
  sling: (r) => item('w', 'sling', 'zwille', 'Jagdzwille', r),
  spear: (r) => item('w', 'spear', 'rspeer', 'Rohrspeer', r),
  armor: (r) => item('a', 'armor', 'weste', 'Schutzweste', r),
  head: (r) => item('h', 'head', 'helm', 'Bauhelm', r),
  hands: (r) => item('g', 'hand', 'handsch', 'Arbeitshandschuhe', r),
  feet: (r) => item('f', 'feet', 'turnsch', 'Turnschuhe', r),
  talisman: (r) => item('t', 'krit', 'kiesel', 'Spreekiesel', r),
  ring: (r) => item('r', 'krit', 'siegel', 'Siegelring', r),
  implant: (r) => item('i', 'krit', 'zchip', 'Zielchip', r),
  heal: () => ({ kind: 'heal' }),
  food: () => ({ kind: 'food' }),
  stoff: () => ({ kind: 'material', id: 'stoff' }),
  metall: () => ({ kind: 'material', id: 'metall' }),
  chemie: () => ({ kind: 'material', id: 'chemie' }),
  kabel: () => ({ kind: 'material', id: 'kabel' }),
  fleisch: () => ({ kind: 'ingredient', id: 'fleisch' }),
  gemuese: () => ({ kind: 'ingredient', id: 'gemuese' }),
  gewuerz: () => ({ kind: 'ingredient', id: 'gewuerz' }),
};

/**
 * Debug drops (`?drops=N`): this order first (12 mixed drops of every rarity, the G2 proof), then the other
 * models, then round again.
 */
export const DEBUG_DROPS: ReadonlyArray<readonly [PickupModelId, PickupRarity]> = [
  ['blade', 3], ['hammer', 2], ['heal', 0], ['armor', 1], ['sling', 0], ['stoff', 0],
  ['head', 'set'], ['ring', 2], ['food', 0], ['spear', 1], ['implant', 3], ['talisman', 1],
  ['hands', 0], ['feet', 2], ['fleisch', 0], ['metall', 0], ['chemie', 0], ['kabel', 0], ['gemuese', 0], ['gewuerz', 0],
];
