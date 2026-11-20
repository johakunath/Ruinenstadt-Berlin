// M13: the camp between expeditions (2D CST stations, UPG, drill, meals, Lazarett, Aufsätze, Lager).
// Pure rules on the profile: `sim.inventory` (Schrott, materials, Zutaten, stash, station levels) and
// `sim.statContext` (upgrades, camp flags, meal, drill). The UI is `src/ui/camp.ts`.
import { STATIONS, type StationDef, type StationId } from '../data/camp';
import { CONSUMABLES, MATERIALS, MEALS, WEAPON_MODS, type ConsumableId, type MaterialId, type MealId, type WeaponModId } from '../data/crafting';
import { CAMP_UPGRADES, ECONOMY, SURVIVORS, type CampUpgradeId } from '../data/progression';
import { CONSUMABLE } from './abilities';
import { BAG_SIZE, type CampState } from './inventory';
import type { Item } from './items';
import { setLoadout } from './loadout';
import type { Sim } from './types';

export type Result = { ok: boolean; text: string };
const ok = (text: string): Result => ({ ok: true, text }), no = (text: string): Result => ({ ok: false, text });
export const campOf = (s: Sim): CampState => s.inventory.camp ??= { stations: {}, stash: [], freed: [] };
export const stationLevel = (s: Sim, id: StationId): number => Math.max(1, campOf(s).stations[id] ?? 1);
/**
 * M20 build sites (Johannes, 2026-11-18): on arrival at Warschauer Straße the Kommandantur, the
 * Schwarzmarkt (stash) and the Lazarett work; the other four are rubble until built for Schrott and
 * material. Saves from before M20 count a station as built when its workshop was already used.
 */
/** District that opens level 3 of every station (index into `STOPS`, 2 = Alexanderplatz). */
export const LEVEL3_DISTRICT = 2;
export const OPEN_STATIONS: readonly StationId[] = ['kom', 'markt', 'laz'];
export const SITE_COST: Readonly<Partial<Record<StationId, Partial<Record<MaterialId | 'scrap', number>>>>> = {
  // Cheap on purpose (Johannes, 2026-11-18): all stations open quickly, the levels take longer.
  zeug: { scrap: 60, metall: 2 }, imbiss: { scrap: 50, stoff: 1 }, hack: { scrap: 80, kabel: 1 }, exer: { scrap: 70, stoff: 1 },
};
export function stationBuilt(s: Sim, id: StationId): boolean {
  if (OPEN_STATIONS.includes(id) || (campOf(s).stations[id] ?? 0) >= 1) return true;
  const u = s.statContext.upgrades, bought = campOf(s).spati ?? {};
  // Legacy saves: a workshop upgrade means the station was used. Levels bought at a Späti do not count (Codex review, PR #57).
  return id === 'zeug' ? (u.dmg ?? 0) - (bought.dmg ?? 0) > 0 || Object.values(s.inventory.mods).some((n) => (n ?? 0) > 0)
    : id === 'hack' ? (u.hp ?? 0) - (bought.hp ?? 0) > 0
    : id === 'exer' ? (u.dash ?? 0) > 0 || (u.luck ?? 0) > 0 || (s.statContext.drill ?? 0) > 0
    : false;
}
/** 0 = build site, else 1..3. */
export const siteLevel = (s: Sim, id: StationId): number => stationBuilt(s, id) ? stationLevel(s, id) : 0;
const station = (id: StationId): StationDef => STATIONS.find(t => t.id === id)!;
export const npcHere = (s: Sim, st: StationDef): boolean => st.npc === 'ilse' || !!s.statContext.survivors[st.npc];
export const npcName = (st: StationDef): string => st.npc === 'ilse' ? 'Ilse' : (SURVIVORS.find(v => v.id === st.npc)?.name ?? '').split(',')[0]!;
const relock = (s: Sim): void => setLoadout(s, s.equipment, { ...s.statContext, imbissLevel: stationLevel(s, 'imbiss') });

/** 2D upMax: the workshop cap of an upgrade at the station's level. */
export function upgradeMax(s: Sim, id: CampUpgradeId): number {
  const st = STATIONS.find(t => t.up?.[id]);
  const def = CAMP_UPGRADES.find(u => u.id === id)!;
  if (st && !stationBuilt(s, st.id)) return Math.min(def.max, s.statContext.upgrades[id] ?? 0);
  return st ? st.up![id]![stationLevel(s, st.id) - 1]! : def.max;
}
/** 2D upCost: base × 1.25 × 1.65^level. */
export const upgradeCost = (s: Sim, id: CampUpgradeId): number => Math.round(CAMP_UPGRADES.find(u => u.id === id)!.baseCost * 1.25 * 1.65 ** (s.statContext.upgrades[id] ?? 0) * ECONOMY.campPrice);
export function buyUpgrade(s: Sim, id: CampUpgradeId): Result {
  const l = s.statContext.upgrades[id] ?? 0, c = upgradeCost(s, id);
  if (l >= upgradeMax(s, id)) return no('Station ausbauen.');
  if (s.inventory.scrap < c) return no(`Dir fehlen ${c - s.inventory.scrap} Schrott.`);
  s.inventory.scrap -= c;
  setLoadout(s, s.equipment, { ...s.statContext, upgrades: { ...s.statContext.upgrades, [id]: l + 1 } });
  return ok(`${CAMP_UPGRADES.find(u => u.id === id)!.name} · Stufe ${l + 1}`);
}
/**
 * Playtest 2026-11-18: Schärfen and Panzerung at a Späti, so Schrott is worth something before the camp
 * opens. Capped (`max` levels in all; the Zeughaus and Hackerspace take it further) and dearer than the
 * workshop (`markup`).
 */
export const SPATI_UPGRADE = { ids: ['dmg', 'hp'] as const, max: 2, markup: 3 };
export const spatiUpgradeCost = (s: Sim, id: 'dmg' | 'hp'): number => upgradeCost(s, id) * SPATI_UPGRADE.markup;
export function buySpatiUpgrade(s: Sim, id: 'dmg' | 'hp'): Result {
  const l = s.statContext.upgrades[id] ?? 0, c = spatiUpgradeCost(s, id);
  if (s.content.tradeAt < 0) return no('Nur im Späti.');
  if (l >= SPATI_UPGRADE.max) return no('Mehr geht nur im Lager.');
  if (s.inventory.scrap < c) return no(`Dir fehlen ${c - s.inventory.scrap} Schrott.`);
  s.inventory.scrap -= c;
  const camp = campOf(s);
  camp.spati = { ...camp.spati, [id]: (camp.spati?.[id] ?? 0) + 1 };
  setLoadout(s, s.equipment, { ...s.statContext, upgrades: { ...s.statContext.upgrades, [id]: l + 1 } });
  return ok(`${CAMP_UPGRADES.find(u => u.id === id)!.name} · Stufe ${l + 1}`);
}
/**
 * Drill: endless Schrott sink, +2 % damage and life per rank. Johannes 2026-11-18: each rank much dearer
 * and the step growing fast (2D was 300 + 60 per rank): 400, 560, 780, 1100, 1540, ... ×1.4 per rank.
 */
export const DRILL_COST = { base: 400, growth: 1.4 } as const;
export const drillCost = (s: Sim): number => Math.round(DRILL_COST.base * DRILL_COST.growth ** (s.statContext.drill ?? 0) / 10) * 10;
export function buyDrill(s: Sim): Result {
  const c = drillCost(s);
  if (!stationBuilt(s, 'exer')) return no('Erst den Exerzierplatz bauen.');
  if (s.inventory.scrap < c) return no(`Dir fehlen ${c - s.inventory.scrap} Schrott.`);
  s.inventory.scrap -= c;
  setLoadout(s, s.equipment, { ...s.statContext, drill: (s.statContext.drill ?? 0) + 1 });
  return ok(`Drill · Rang ${s.statContext.drill}`);
}
/** Schrott part of a station price × `ECONOMY.campPrice` (materials stay). */
const priced = (c: Partial<Record<MaterialId | 'scrap', number>>): Partial<Record<MaterialId | 'scrap', number>> => (c.scrap ? { ...c, scrap: Math.round(c.scrap * ECONOMY.campPrice) } : c);
const have = (s: Sim, k: MaterialId | 'scrap'): number => k === 'scrap' ? s.inventory.scrap : s.inventory.materials[k] ?? 0;
/** 2D cNext: the next level, what it costs and what blocks it. */
export function nextLevel(s: Sim, id: StationId): { level: number; text: string; cost: Partial<Record<MaterialId | 'scrap', number>>; needs: string[]; missing: string[]; ok: boolean } | null {
  const st = station(id);
  if (!stationBuilt(s, id)) {
    const cost = priced(SITE_COST[id] ?? {});
    const missing = (Object.entries(cost) as Array<[MaterialId | 'scrap', number]>).filter(([k, v]) => have(s, k) < v).map(([k, v]) => `${v - have(s, k)} ${k === 'scrap' ? 'Schrott' : MATERIALS[k].name}`);
    return { level: 1, text: st.levels[0].text, cost, needs: [], missing, ok: !missing.length };
  }
  const l = stationLevel(s, id), L = st.levels[l];
  if (!L) return null;
  const needs: string[] = [];
  if (!npcHere(s, st)) needs.push(`${npcName(st)} befreien`);
  // Level 3 waits for the next planned district (2D LVREQ: Alexanderplatz); the camp itself opens after Köpenick.
  if (l + 1 >= 3 && !campOf(s).freed.includes(LEVEL3_DISTRICT)) needs.push('Alexanderplatz befreien');
  const cost = priced(L.cost ?? {});
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
  if (n.level === 1) { relock(s); return ok(`${station(id).name} gebaut`); }
  const flag = station(id).levels[n.level - 1]!.camp;
  if (flag) s.statContext.camp = { ...s.statContext.camp, [flag]: true };
  relock(s);
  return ok(`${station(id).name} · Stufe ${n.level}`);
}
/** 2D meals: cooked now, they hold for the whole next expedition. A second tap cancels and returns the Zutaten. */
export function cookMeal(s: Sim, id: MealId): Result {
  const m = MEALS.find(x => x.id === id)!, ing = (s.inventory.ingredients ??= {});
  if (!stationBuilt(s, 'imbiss')) return no('Erst den Imbiss bauen.');
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
  if (!stationBuilt(s, 'zeug')) return no('Erst das Zeughaus bauen.');
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
  if (s.run.ended) return;
  s.run.ended = true;
  const c = campOf(s);
  if (won && !c.freed.includes(district)) c.freed.push(district);
  if (s.statContext.camp.garten && s.run.index >= 2) { const ing = (s.inventory.ingredients ??= {}); ing.gemuese = (ing.gemuese ?? 0) + 2; }
  s.statContext.meal = undefined;
}
/** M20: what the walkable camp draws per station (build site 0 or level, keeper there). */
export function campStates(s: Sim): Record<StationId, { level: number; npc: boolean }> {
  return Object.fromEntries(STATIONS.map((st) => [st.id, { level: siteLevel(s, st.id), npc: stationBuilt(s, st.id) && npcHere(s, st) }])) as Record<StationId, { level: number; npc: boolean }>;
}

/**
 * M20 walkable camp (playtest 2026-11-20): each station blocks only the furniture of its level, a build
 * site its whole taped-off footprint. Run every step in the camp, so a station built or upgraded at the
 * counter gets its new colliders at once; a new sim (`Level.restore`) starts with none until the first step.
 */
export function syncCampSolids(s: Sim): void {
  const lv = s.level, levels = new Map<string, number>();
  for (const e of lv.campSolids) {
    let l = levels.get(e.station);
    if (l === undefined) levels.set(e.station, (l = siteLevel(s, e.station as StationId)));
    if (l >= e.lo && l <= e.hi) lv.shut(e.collider);
    else lv.open(e.collider);
  }
}
