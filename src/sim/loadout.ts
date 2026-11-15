// M3b: bridge the ported gear numbers to the existing gate 1 combat scale.
import { PLAYER } from '../data/combat';
import type { Item } from './items';
import { heroStats, type Equipment, type StatContext } from './stats';
import type { Sim } from './types';

/** The starter pipe does 10 damage, matching ATTACKS.light1 before equipment. */
export const STARTER_DAMAGE = 10;
/** 2D base dash cooldown; retain the 3D recovery gap by applying its ratio. */
export const BASE_DASH_COOLDOWN = 1.4;

export function starterEquipment(): Equipment {
  const weapon: Item = { id: 0, slot: 'w', kind: 'blade', base: 'rohr', name: 'Rostiges Rohr', rarity: 0,
    value: STARTER_DAMAGE, itemLevel: 1, affixes: [] };
  return { w: weapon };
}

export function statContext(context: Partial<StatContext> = {}): StatContext {
  return structuredClone({ ...context, upgrades: context.upgrades ?? {}, perks: context.perks ?? {},
    camp: context.camp ?? {}, survivors: context.survivors ?? {} });
}

/** Atomic replacement for M5: invalid gear throws before touching the current loadout. */
export function setLoadout(sim: Sim, equipment: Equipment, context: Partial<StatContext> = sim.statContext): void {
  const eq = structuredClone(equipment), ctx = statContext(context), stats = heroStats(eq, ctx);
  const hpShare = sim.player.hp / sim.stats.maxHp;
  sim.equipment = eq;
  sim.statContext = ctx;
  sim.stats = stats;
  // 2D refresh behavior, with an explicit corpse guard: equipping cannot resurrect.
  sim.player.hp = sim.player.state === 'dead' ? 0 : Math.min(stats.maxHp, Math.max(1, Math.round(stats.maxHp * hpShare)));
}

export function dodgeCooldown(sim: Sim): number {
  return PLAYER.dodge.cooldown * sim.stats.dashCooldown / BASE_DASH_COOLDOWN;
}
