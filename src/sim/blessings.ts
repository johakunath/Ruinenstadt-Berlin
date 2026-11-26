// Blessing choice (M8, 2D `offerPerks` in js/combat.js): three cards from the eligible pool, held
// families 2.5 times as likely, unlocked duos 3 times, sometimes a card worth two levels, rarely the
// weapon mod (Umbau). One reroll per choice for Schrott. Blessings last until the run ends.
import { PERKS, type PerkDefinition, type PerkFamilyId, type PerkId } from '../data/progression';
import type { ElementId } from '../data/items';
import { pk } from './combat';
import { healPlayer } from './heal';
import { setLoadout } from './loadout';
import type { Sim } from './types';
import type { Offer } from './abilities';

const ELEMENT_PERKS: readonly PerkId[] = ['fire', 'acid', 'shock'];
export const perkOf = (id: PerkId): PerkDefinition => PERKS.find((p) => p.id === id)!;

/** Families of the blessings held (duos and weapon mods do not count), as in 2D `famHeld`. */
export function heldFamilies(s: Sim): Set<PerkFamilyId> {
  const held = new Set<PerkFamilyId>();
  for (const p of PERKS) if (pk(s, p.id) > 0 && !p.duo && !p.weapon) for (const f of p.families ?? []) held.add(f);
  return held;
}

/** 2D `wE()`: half the waves started. */
/** Umbau cards appear from this wave on. */
export const UMBAU_FROM = 3;
const waveE = (s: Sim): number => Math.max(1, s.lootWaves) / 2;
/** Four times the 2D price (Johannes, 2026-11-26: rerolling was too cheap; maps end with 900 to 2800 Schrott left). */
export const rerollCost = (s: Sim): number => 80 + Math.round(waveE(s) * 32);

function eligible(s: Sim, held: Set<PerkFamilyId>): PerkDefinition[] {
  const els = s.stats.elements;
  return PERKS.filter((p) => !p.weapon && pk(s, p.id) < p.max
    && !(ELEMENT_PERKS.includes(p.id) && els.includes(p.id as ElementId))
    && (!p.requires || (p.requires === 'any' ? els.length > 0 : els.includes(p.requires)))
    && (!p.duo || p.duo.every((f) => held.has(f))));
}

function roll(s: Sim): Offer[] {
  const held = heldFamilies(s);
  const pool = eligible(s, held);
  const weight = (p: PerkDefinition): number => (p.duo ? 3 : p.families?.some((f) => held.has(f)) ? 2.5 : 1);
  const picks: PerkDefinition[] = [];
  while (picks.length < 3 && pool.length) {
    let x = s.rng.next() * pool.reduce((n, p) => n + weight(p), 0);
    let i = 0;
    while (i < pool.length - 1 && (x -= weight(pool[i]!)) > 0) i++;
    picks.push(pool.splice(i, 1)[0]!);
  }
  // Weapon mod (Umbau): rare, one per run, one of the weapon's three. 2D: one per weapon from wave five;
  // 3D (G1): three per weapon from wave three, so two runs with one weapon can play differently.
  const mods = PERKS.filter((p) => p.weapon === s.stats.kind);
  if (mods.length && s.lootWaves >= UMBAU_FROM && !PERKS.some((p) => p.weapon && pk(s, p.id) > 0) && s.rng.next() < 0.22) picks[Math.min(2, picks.length)] = s.rng.pick(mods);
  return picks.map((p) => {
    const q = s.rng.next();
    const level: 1 | 2 = !p.duo && !p.weapon && p.max - pk(s, p.id) >= 2 && q < 0.18 + 0.01 * waveE(s) ? 2 : 1;
    return { id: p.id, level, quality: p.weapon ? 3 : p.duo ? 2 : level === 2 ? (q < 0.05 ? 2 : 1) : 0 };
  });
}

/** Puts a choice on screen, or queues it behind the one already open. `hidden`: a found blessing. */
export function offerBlessings(s: Sim, hidden = false): void {
  const a = s.abilities;
  if (a.offers.length) {
    a.pending++;
    return;
  }
  a.offers = roll(s);
  a.hiddenOffer = hidden;
  a.rerolled = false;
}

export function rerollBlessings(s: Sim): boolean {
  const a = s.abilities;
  const cost = rerollCost(s);
  if (!a.offers.length || a.rerolled || s.inventory.scrap < cost) return false;
  s.inventory.scrap -= cost;
  const next = roll(s);
  if (!next.length) return false;
  a.offers = next;
  a.rerolled = true;
  return true;
}

export function chooseBlessing(s: Sim, id: PerkId): boolean {
  const a = s.abilities;
  const offer = a.offers.find((o) => o.id === id);
  if (!offer) return false;
  const level = Math.min(perkOf(id).max, pk(s, id) + offer.level);
  setLoadout(s, s.equipment, { ...s.statContext, perks: { ...s.statContext.perks, [id]: level } });
  // 2D: Dickes Fell also heals a little when taken.
  if (id === 'hp') healPlayer(s, 25, 'blessing');
  a.quality[id] = Math.max(a.quality[id] ?? 0, offer.quality);
  a.offers = [];
  a.hiddenOffer = false;
  s.events.push({ type: 'blessing', id, level });
  if (a.pending > 0) {
    a.pending--;
    offerBlessings(s);
  }
  return true;
}
