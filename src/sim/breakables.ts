// Breakable props (M4): crates and bins on expedition maps. The hero's swings and dash strike deal
// one hit each; enemies never break them. A break removes the collider and drops loot (`loot.ts`).
import { sectorHitsCircle, type Collider } from './collide';
import { breakDrops } from './loot';
import { focusFlow } from './director';
import type { Sim } from './types';
import { HIT_FEEL } from '../data/combat';

export type BreakableKind = 'crate' | 'bin';

/** Hit points and reach radius per kind (2D: crate 3, bin 2; lowered on playtest feedback 2026-11-18). */
export const BREAKABLE: Readonly<Record<BreakableKind, { hp: number; radius: number }>> = {
  crate: { hp: 2, radius: 0.7 },
  bin: { hp: 1, radius: 1.0 },
};

/** Static description, owned by the level. */
export interface BreakableDef {
  kind: BreakableKind;
  x: number;
  z: number;
  /** Index into the map's prop list (the renderer draws these props itself). */
  prop: number;
  /** Inside a Späti: better loot. */
  inside: boolean;
  collider: Collider;
}

/** Per-run state. */
export interface Breakable {
  id: number;
  def: BreakableDef;
  hp: number;
  broken: boolean;
}

export function createBreakables(defs: readonly BreakableDef[]): Breakable[] {
  return defs.map((def, id) => ({ id, def, hp: BREAKABLE[def.kind].hp, broken: false }));
}

export function hitBreakable(sim: Sim, b: Breakable): void {
  if (b.broken) return;
  b.hp--;
  const { x, z, kind, inside } = b.def;
  if (b.hp > 0) {
    sim.events.push({ type: 'breakableHit', id: b.id, kind, x, z, hp: b.hp });
    return;
  }
  b.broken = true;
  sim.level.remove(b.def.collider);
  // The flow field was built with this collider; rebuild it when the prop was inside its window.
  if (sim.level.expedition && Math.abs(x - sim.flowCenter.x) < 30 && Math.abs(z - sim.flowCenter.z) < 30) focusFlow(sim, sim.flowCenter.x, sim.flowCenter.z);
  sim.events.push({ type: 'breakableBreak', id: b.id, kind, x, z, inside });
  breakDrops(sim, b);
}

/** Marks a prop broken without drops or events (resuming a save). */
export function hitBreakableState(sim: Sim, b: Breakable): void {
  if (b.broken) return;
  b.broken = true;
  b.hp = 0;
  sim.level.remove(b.def.collider);
}

/** The hero's active weapon sweep (`sim.ts` computes lo/hi) against props; one hit per prop per swing. */
export function sweepBreakables(sim: Sim, lo: number, hi: number, inner: number, reach: number): void {
  const p = sim.player;
  for (const b of sim.breakables) {
    if (b.broken || p.propHits.includes(b.id)) continue;
    const { x, z, kind } = b.def;
    if (!sectorHitsCircle(p.x, p.z, p.facing, lo, hi, inner, reach, x, z, BREAKABLE[kind].radius)) continue;
    p.propHits.push(b.id);
    hitBreakable(sim, b);
    sim.hitstop = Math.max(sim.hitstop, HIT_FEEL.light.hitstop * 0.5);
  }
}
