// M5: session inventory. M4 feeds collectItem; M6 will persist this state.
import type { MaterialId, WeaponModId } from '../data/crafting';
import type { SlotId } from '../data/items';
import { salvage, type Item } from './items';
import { setLoadout } from './loadout';
import type { Sim } from './types';

export const BAG_SIZE = 25;
export interface Inventory {
  bag: Item[];
  scrap: number;
  materials: Partial<Record<MaterialId, number>>;
  mods: Partial<Record<WeaponModId, number>>;
  /** Verband and Molotow in the pouch, up to three each (M16). Missing in older saves. */
  consumables?: { verband: number; molotow: number };
}
/** A new hero starts with one Verband and one Molotow (3D: there is no camp to make them yet, M13). */
export function createInventory(): Inventory { return { bag: [], scrap: 0, materials: {}, mods: {}, consumables: { verband: 1, molotow: 1 } }; }
/** False means leave the drop in the world. Item ids must be unique across bag and gear. */
export function collectItem(sim: Sim, item: Item): boolean {
  if (sim.inventory.bag.length >= BAG_SIZE || [...sim.inventory.bag, ...Object.values(sim.equipment)].some(i => i?.id === item.id)) return false;
  sim.inventory.bag.push(structuredClone(item));
  return true;
}
export function equipItem(sim: Sim, index: number): boolean {
  const item = sim.inventory.bag[index];
  if (!item) return false;
  const old = sim.equipment[item.slot];
  setLoadout(sim, { ...sim.equipment, [item.slot]: item });
  if (old) sim.inventory.bag[index] = old;
  else sim.inventory.bag.splice(index, 1);
  return true;
}
export function unequipItem(sim: Sim, slot: SlotId): boolean {
  const item = sim.equipment[slot];
  if (!item || slot === 'w' || sim.inventory.bag.length >= BAG_SIZE) return false;
  const equipment = { ...sim.equipment };
  delete equipment[slot];
  setLoadout(sim, equipment);
  sim.inventory.bag.push(item);
  return true;
}
export function salvageItem(sim: Sim, index: number): boolean {
  const item = sim.inventory.bag[index];
  if (!item || item.locked) return false;
  const result = salvage(sim.rng, item);
  sim.inventory.scrap += result.scrap;
  for (const [id, count] of Object.entries(result.materials)) {
    const key = id as MaterialId;
    sim.inventory.materials[key] = (sim.inventory.materials[key] ?? 0) + count;
  }
  for (const mod of item.mods ?? []) sim.inventory.mods[mod] = (sim.inventory.mods[mod] ?? 0) + 1;
  sim.inventory.bag.splice(index, 1);
  return true;
}
