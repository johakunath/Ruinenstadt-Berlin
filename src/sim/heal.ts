// Every heal of the hero goes through `healPlayer`: it clamps to max life and reports what was really
// restored as a `heal` event, so the UI can show it (2D `healDrop` showed "+X Leben").
import type { HealSource, Sim } from './types';

/** Small repeated heals (per step or per kill): the UI merges them and the hero gets no aura flash. */
export const HEAL_TICK: Readonly<Record<HealSource, boolean>> = {
  regen: true, rest: true, verband: true, banner: true, leech: true, kill: true,
  breath: false, pickup: false, food: false, trader: false, encounter: false, endless: false, blessing: false, pickel: false, secondWind: false,
};

/** Heals the hero by up to `amount` (not above max life, not when dead). Returns what was restored. */
export function healPlayer(s: Sim, amount: number, source: HealSource): number {
  const p = s.player;
  if (p.state === 'dead' || !(amount > 0)) return 0;
  const h = Math.min(Math.max(0, s.stats.maxHp - p.hp), amount);
  if (h <= 0) return 0;
  p.hp += h;
  s.events.push(HEAL_TICK[source] ? { type: 'heal', amount: h, source, tick: true } : { type: 'heal', amount: h, source });
  return h;
}
