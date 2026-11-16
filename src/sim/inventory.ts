// M5: session inventory. M4 feeds collectItem; M6 will persist this state.
import type { IngredientId, MaterialId, WeaponModId } from '../data/crafting';
import type { StationId } from '../data/camp';
import type { SlotId } from '../data/items';
import { isUpgrade, salvage, type Item } from './items';
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
  /** U2 Kodex: kills by enemy kind and elite (`e:flink`), first finds by legendary and set base. Missing in older saves. */
  kodex?: Kodex;
  /** M13 Zutaten for the Imbiss. */
  ingredients?: Partial<Record<IngredientId, number>>;
  /** M13 camp: station levels (1..3), Lager items, districts freed (0 Köpenick). */
  camp?: CampState;
  /** M17: intro and tutorial cards already seen. */
  tips?: Partial<Record<string, 1>>;
}
export interface CampState { stations: Partial<Record<StationId, number>>; stash: Item[]; freed: number[]; /** M18: most endless waves survived. */ endlessBest?: number }
export interface Kodex { kills: Partial<Record<string, number>>; found: Partial<Record<string, 1>> }
const kodexOf = (sim: Sim): Kodex => sim.inventory.kodex ??= { kills: {}, found: {} };
/** Counts a kill; true on the first of its kind (the UI shows "Neu im Kodex"). */
export function kodexKill(sim: Sim, key: string): boolean { const k = kodexOf(sim), first = !k.kills[key]; k.kills[key] = (k.kills[key] ?? 0) + 1; return first; }
/** Notes a legendary or set find; true the first time. */
export function kodexFind(sim: Sim, item: Item): boolean { if (item.rarity < 3 && !item.set) return false; const k = kodexOf(sim), first = !k.found[item.base]; k.found[item.base] = 1; return first; }
/** A new hero starts with one Verband and one Molotow (3D: there is no camp to make them yet, M13). */
export function createInventory(): Inventory { return { bag: [], scrap: 0, materials: {}, mods: {}, consumables: { verband: 1, molotow: 1 } }; }
/** False means leave the drop in the world. Item ids must be unique across bag and gear. */
export function collectItem(sim: Sim, item: Item): boolean {
  if (sim.inventory.bag.length >= BAG_SIZE || [...sim.inventory.bag, ...(sim.inventory.camp?.stash ?? []), ...Object.values(sim.equipment)].some(i => i?.id === item.id)) return false;
  sim.inventory.bag.push(structuredClone(item));
  if (kodexFind(sim, item)) sim.events.push({ type: 'kodex', name: item.name });
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

/** Implant mode chosen in the inventory (2D `im`); an equipped implant applies at once. */
export function setImplantMode(sim: Sim, item: Item, mode: number): void {
  if (item.slot !== 'i' || mode < 0 || mode > 2) return;
  item.implantMode = mode as 0 | 1 | 2;
  if (sim.equipment.i === item) setLoadout(sim, sim.equipment);
}
/** 2D salvage chips: bag items a bulk salvage of rarity r (0..2) or 'rest' (no upgrade) would take. */
export function bulkCandidates(sim: Sim, what: number | 'rest'): Item[] {
  return sim.inventory.bag.filter(i => !i.locked && !i.set && i.rarity < 3 && (what === 'rest' ? !isUpgrade(i, sim.equipment[i.slot]) : i.rarity === what));
}
