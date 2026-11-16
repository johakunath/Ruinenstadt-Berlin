// Späti rest stops (M11b part 2, Johannes 2026-11-16: option 1, a rest stop on the route). One per
// zone. Fights lock the hero into the encounter circle and nothing spawns between encounters, so the
// 2D safe-room rule (60 s calm per wave) does not apply: inside a Späti the hero heals while travelling.
// A trader moves in later (backlog B13, migration M13b).
import { DT, type Sim } from './types';

export interface RestArea {
  name: string;
  x: number;
  z: number;
  /** Facing of the front (door side), as a facing angle. */
  rot: number;
  /** Interior half extents along the local axes (x across the front, z front to back). */
  hx: number;
  hz: number;
  /** Späti trader (M13b): where the keeper stands behind the counter and where a customer stands. */
  keeper?: { x: number; z: number };
  desk?: { x: number; z: number };
}

export const REST = {
  /** Share of max life healed per second inside. */
  healPerSec: 0.03,
};

/** Index of the rest area whose interior holds (x, z), or -1. */
export function restAt(rests: readonly RestArea[], x: number, z: number): number {
  for (let i = 0; i < rests.length; i++) {
    const r = rests[i]!;
    const c = Math.cos(r.rot);
    const s = Math.sin(r.rot);
    const dx = x - r.x;
    const dz = z - r.z;
    if (Math.abs(dx * c - dz * s) <= r.hx && Math.abs(dx * s + dz * c) <= r.hz) return i;
  }
  return -1;
}

/** Heals the hero inside a Späti between fights; reports the first visit of each one. */
export function updateRest(sim: Sim): void {
  const p = sim.player;
  if (p.state === 'dead' || sim.level.rests.length === 0) return;
  const i = restAt(sim.level.rests, p.x, p.z);
  if (i !== sim.rest.at) {
    sim.rest.at = i;
    if (i >= 0) sim.events.push({ type: 'restEnter', index: i, first: !sim.rest.seen[i] });
    if (i >= 0) sim.rest.seen[i] = true;
  }
  if (i < 0 || sim.run.phase === 'fight' || sim.run.phase === 'pause') return;
  p.hp = Math.min(sim.stats.maxHp, p.hp + sim.stats.maxHp * REST.healPerSec * DT);
}
