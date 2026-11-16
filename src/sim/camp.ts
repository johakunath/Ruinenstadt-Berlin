// M13: the camp between expeditions (2D CST stations, UPG, drill, meals, Lazarett, Aufsätze, Lager).
// Pure rules on the profile: `sim.inventory` (Schrott, materials, Zutaten, stash, station levels) and
// `sim.statContext` (upgrades, camp flags, meal, drill). The UI is `src/ui/camp.ts`.
import { STATIONS, type StationDef, type StationId } from '../data/camp';
import { CONSUMABLES, MATERIALS, MEALS, WEAPON_MODS, type ConsumableId, type MaterialId, type MealId, type WeaponModId } from '../data/crafting';
import { CAMP_UPGRADES, SURVIVORS, type CampUpgradeId } from '../data/progression';
import { CONSUMABLE } from './abilities';
import { BAG_SIZE, type CampState } from './inventory';
import type { Item } from './items';
import { setLoadout } from './loadout';
import type { Sim } from './types';

export type Result = { ok: boolean; text: string };
const ok = (text: string): Result => ({ ok: true, text }), no = (text: string): Result => ({ ok: false, text });
export const campOf = (s: Sim): CampState => s.inventory.camp ??= { stations: {}, stash: [], freed: [] };
export const stationLevel = (s: Sim, id: StationId): number => Math.max(1, campOf(s).stations[id] ?? 1);
const station = (id: StationId): StationDef => STATIONS.find(t => t.id === id)!;
export const npcHere = (s: Sim, st: StationDef): boolean => st.npc === 'ilse' || !!s.statContext.survivors[st.npc];
export const npcName = (st: StationDef): string => st.npc === 'ilse' ? 'Ilse' : (SURVIVORS.find(v => v.id === st.npc)?.name ?? '').split(',')[0]!;
const relock = (s: Sim): void => setLoadout(s, s.equipment, { ...s.statContext, imbissLevel: stationLevel(s, 'imbiss') });

/** 2D upMax: the workshop cap of an upgrade at the station's level. */
export function upgradeMax(s: Sim, id: CampUpgradeId): number {
  const st = STATIONS.find(t => t.up?.[id]);
  const def = CAMP_UPGRADES.find(u => u.id === id)!;
  return st ? st.up![id]![stationLevel(s, st.id) - 1]! : def.max;
}
/** 2D upCost: base × 1.25 × 1.65^level. */
export const upgradeCost = (s: Sim, id: CampUpgradeId): number => Math.round(CAMP_UPGRADES.find(u => u.id === id)!.baseCost * 1.25 * 1.65 ** (s.statContext.upgrades[id] ?? 0));
export function buyUpgrade(s: Sim, id: CampUpgradeId): Result {
  const l = s.statContext.upgrades[id] ?? 0, c = upgradeCost(s, id);
  if (l >= upgradeMax(s, id)) return no('Station ausbauen.');
  if (s.inventory.scrap < c) return no(`Dir fehlen ${c - s.inventory.scrap} Schrott.`);
  s.inventory.scrap -= c;
  setLoadout(s, s.equipment, { ...s.statContext, upgrades: { ...s.statContext.upgrades, [id]: l + 1 } });
  return ok(`${CAMP_UPGRADES.find(u => u.id === id)!.name} · Stufe ${l + 1}`);
}
/** 2D drillCost: endless Schrott sink, +2 % damage and life per rank. */
export const drillCost = (s: Sim): number => 300 + 60 * (s.statContext.drill ?? 0);
export function buyDrill(s: Sim): Result {
  const c = drillCost(s);
  if (s.inventory.scrap < c) return no(`Dir fehlen ${c - s.inventory.scrap} Schrott.`);
  s.inventory.scrap -= c;
  setLoadout(s, s.equipment, { ...s.statContext, drill: (s.statContext.drill ?? 0) + 1 });
  return ok(`Drill · Rang ${s.statContext.drill}`);
}
const have = (s: Sim, k: MaterialId | 'scrap'): number => k === 'scrap' ? s.inventory.scrap : s.inventory.materials[k] ?? 0;
/** 2D cNext: the next level, what it costs and what blocks it. */
export function nextLevel(s: Sim, id: StationId): { level: number; text: string; cost: Partial<Record<MaterialId | 'scrap', number>>; needs: string[]; missing: string[]; ok: boolean } | null {
  const st = station(id), l = stationLevel(s, id), L = st.levels[l];
  if (!L) return null;
  const needs: string[] = [];
  if (!npcHere(s, st)) needs.push(`${npcName(st)} befreien`);
  if (l + 1 >= 3 && !campOf(s).freed.includes(0)) needs.push('Köpenick befreien');
  const cost = L.cost ?? {};
  const missing = (Object.entries(cost) as Array<[MaterialId | 'scrap', number]>).filter(([k, v]) => have(s, k) < v).map(([k, v]) => `${v - have(s, k)} ${k === 'scrap' ? 'Schrott' : MATERIALS[k].name}`);
  return { level: l + 1, text: L.text, cost, needs, missing, ok: !needs.length && !missing.length };
}
export function buildStation(s: Sim, id: StationId): Result {
  const n = nextLevel(s, id);
  if (!n) return no('Voll ausgebaut.');
  if (n.needs.length) return no(`Erst: ${n.needs.join(', ')}.`);
  if (n.missing.length) return no(`Dir fehlt ${n.missing.join(', ')}.`);
  for (const [k, v] of Object.entries(n.cost) as Array<[MaterialId | 'scrap', number]>) { if (k === 'scrap') s.inventory.scrap -= v; else s.inventory.materials[k] = have(s, k) - v; }
  campOf(s).stations[id] = n.level;
  const flag = station(id).levels[n.level - 1]!.camp;
  if (flag) s.statContext.camp = { ...s.statContext.camp, [flag]: true };
  relock(s);
  return ok(`${station(id).name} · Stufe ${n.level}`);
}
/** 2D meals: cooked now, they hold for the whole next expedition. A second tap cancels and returns the Zutaten. */
export function cookMeal(s: Sim, id: MealId): Result {
  const m = MEALS.find(x => x.id === id)!, ing = (s.inventory.ingredients ??= {});
  const back = (k: MealId | undefined): void => { const o = MEALS.find(x => x.id === k); if (o) for (const [z, v] of Object.entries(o.costs)) ing[z as keyof typeof ing] = (ing[z as keyof typeof ing] ?? 0) + v; };
  if (m.requiredBuilding && !s.statContext.camp[m.requiredBuilding]) return no('Dafür braucht der Imbiss Stufe 2.');
  if (s.statContext.meal === id) { back(id); setLoadout(s, s.equipment, { ...s.statContext, meal: undefined }); return ok('Abbestellt'); }
  back(s.statContext.meal);
  const miss = Object.entries(m.costs).filter(([k, v]) => (ing[k as keyof typeof ing] ?? 0) < v);
  if (miss.length) { const prev = s.statContext.meal; if (prev) { const o = MEALS.find(x => x.id === prev)!; for (const [z, v] of Object.entries(o.costs)) ing[z as keyof typeof ing]! -= v; } return no('Zutaten fehlen.'); }
  for (const [k, v] of Object.entries(m.costs)) ing[k as keyof typeof ing]! -= v;
  setLoadout(s, s.equipment, { ...s.statContext, meal: id, imbissLevel: stationLevel(s, 'imbiss') });
  return ok(`${m.name} · gekocht`);
}
/** Lazarett: Verband and Molotow for Schrott, three each. */
export function craftConsumable(s: Sim, id: ConsumableId): Result {
  const c = CONSUMABLES.find(x => x.id === id)!, cons = (s.inventory.consumables ??= { verband: 0, molotow: 0 });
  if (cons[id] >= CONSUMABLE.max) return no('Voll.');
  if (s.inventory.scrap < c.scrapCost) return no(`Dir fehlen ${c.scrapCost - s.inventory.scrap} Schrott.`);
  s.inventory.scrap -= c.scrapCost; cons[id]++;
  return ok(`+1 ${c.name}`);
}
/** 2D modSlots: one mod slot, two on rare and set weapons. */
export const modSlots = (w: Item | undefined): number => !w || w.slot !== 'w' ? 0 : w.rarity >= 2 || w.set ? 2 : 1;
/** Mira (schmied) makes mods 30 % cheaper. */
export const modScrap = (s: Sim, id: WeaponModId): number => Math.round(WEAPON_MODS.find(m => m.id === id)!.scrapCost * (s.statContext.survivors.schmied ? 0.7 : 1));
export function buildMod(s: Sim, id: WeaponModId): Result {
  const m = WEAPON_MODS.find(x => x.id === id)!, c = modScrap(s, id);
  const miss = (Object.entries(m.costs) as Array<[MaterialId, number]>).filter(([k, v]) => have(s, k) < v);
  if (s.inventory.scrap < c || miss.length) return no(`Dir fehlt ${[...(s.inventory.scrap < c ? [`${c - s.inventory.scrap} Schrott`] : []), ...miss.map(([k, v]) => `${v - have(s, k)} ${MATERIALS[k].name}`)].join(', ')}.`);
  s.inventory.scrap -= c;
  for (const [k, v] of Object.entries(m.costs) as Array<[MaterialId, number]>) s.inventory.materials[k] = have(s, k) - v;
  s.inventory.mods[id] = (s.inventory.mods[id] ?? 0) + 1;
  return ok(`${m.name} gebaut`);
}
export function installMod(s: Sim, id: WeaponModId): Result {
  const w = s.equipment.w, mods = w?.mods ?? [];
  if (!w || (s.inventory.mods[id] ?? 0) <= 0) return no('Erst bauen.');
  if (mods.includes(id)) return no('Schon eingebaut.');
  if (mods.length >= modSlots(w)) return no('Kein Platz frei.');
  s.inventory.mods[id]! -= 1;
  w.mods = [...mods, id];
  setLoadout(s, s.equipment);
  return ok(`${WEAPON_MODS.find(m => m.id === id)!.name} eingebaut`);
}
export function removeMod(s: Sim, id: WeaponModId): Result {
  const w = s.equipment.w;
  if (!w?.mods?.includes(id)) return no('Nicht eingebaut.');
  w.mods = w.mods.filter(m => m !== id);
  s.inventory.mods[id] = (s.inventory.mods[id] ?? 0) + 1;
  setLoadout(s, s.equipment);
  return ok('Ausgebaut');
}
/** 2D stashMax: 40, Lagerhalle +20, Schwarzmarkt level 3 +20. */
export const stashMax = (s: Sim): number => 40 + (s.statContext.camp.halle ? 20 : 0) + (stationLevel(s, 'markt') >= 3 ? 20 : 0);
export function toStash(s: Sim, bagIndex: number): Result {
  const it = s.inventory.bag[bagIndex], c = campOf(s);
  if (!it) return no('');
  if (c.stash.length >= stashMax(s)) return no('Lager voll.');
  s.inventory.bag.splice(bagIndex, 1); c.stash.push(it);
  return ok('Ins Lager');
}
export function fromStash(s: Sim, i: number): Result {
  const c = campOf(s), it = c.stash[i];
  if (!it) return no('');
  if (s.inventory.bag.length >= BAG_SIZE) return no('Rucksack voll.');
  c.stash.splice(i, 1); s.inventory.bag.push(it);
  return ok('In den Rucksack');
}
/**
 * An expedition ends (win, death or abort): the meal is eaten, the garden gives two Gemüse after a run
 * that reached the third fight, a won district is freed (unlocks level 3 of the stations).
 */
export function endExpedition(s: Sim, won: boolean, district = 0): void {
  const c = campOf(s);
  if (won && !c.freed.includes(district)) c.freed.push(district);
  if (s.statContext.camp.garten && s.run.index >= 2) { const ing = (s.inventory.ingredients ??= {}); ing.gemuese = (ing.gemuese ?? 0) + 2; }
  s.statContext.meal = undefined;
}
