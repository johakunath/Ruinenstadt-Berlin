// M6: versioned save (new format, no 2D import). Pure: no DOM, no storage (see `src/save.ts`).
// `profile` is what the hero owns and survives every run; `run` is the wave checkpoint (B1) and is
// null between runs. Ground drops are not saved: a resumed wave starts with a clean floor.
import { isDifficulty, type DifficultyId } from '../data/difficulty';
import { hitBreakableState } from './breakables';
import { focusFlow } from './director';
import type { Drop } from './loot';
import type { Inventory } from './inventory';
import type { Equipment, StatContext } from './stats';
import { createSim, type SimOptions } from './sim';
import { createAbilities } from './abilities';
import { setLoadout } from './loadout';
import { spawnGuards } from './runcontent';
import type { Sim } from './types';

export const SAVE_VERSION = 1;

export interface SaveProfile { inventory: Inventory; equipment: Equipment; statContext: StatContext }
export interface SaveRun {
  /** Map name; a run only resumes on the map it was saved on. */
  abilities?: import('./abilities').Abilities;
  perks?: StatContext['perks'];
  content?: import('./runcontent').RunContent;
  map: string;
  index: number;
  /** Wave that starts next (phase pause) or -1 between encounters (phase travel). */
  wave: number;
  hp: number;
  x: number;
  z: number;
  facing: number;
  rng: number;
  nextId: number;
  itemId: number;
  lootWaves: number;
  kills: number;
  broken: number[];
  restSeen: boolean[];
  /** Ground loot, landed and still. */
  drops: Drop[];
  /** Side passage guards already defeated in this run (indexes into `level.guards`). */
  guardsDown?: number[];
}
export interface SaveV1 { v: 1; /** Save time in ms; the cloud sync compares it. */ t: number; difficulty: DifficultyId; profile: SaveProfile; run: SaveRun | null }

export function profileOf(sim: Sim): SaveProfile {
  return structuredClone({ inventory: sim.inventory, equipment: sim.equipment, statContext: { ...sim.statContext, perks: {}, shrines: {} } });
}

export function snapshot(sim: Sim, map: string, withRun: boolean, now = Date.now()): SaveV1 {
  const r = sim.run;
  // Endless mode has no checkpoint (M18): its pauses are not resumable.
  const inRun = withRun && sim.level.expedition && r.endless === undefined && (r.phase === 'pause' || r.phase === 'travel') && sim.player.state !== 'dead';
  return {
    v: 1, t: now, difficulty: sim.difficulty, profile: profileOf(sim),
    run: !inRun ? null : {
      // Things in flight are not saved: a resumed wave starts with a clean field.
      abilities: structuredClone({ ...sim.abilities, projectiles: [], shocks: [], strikes: [], bottles: [], booms: [], fields: [], spin: 0, guard: 0 }), perks: { ...sim.statContext.perks },
      content: structuredClone({ ...sim.content, tradeOpen: false }),
      map, index: r.index, wave: r.phase === 'pause' ? r.wave : -1, hp: sim.player.hp,
      x: sim.player.x, z: sim.player.z, facing: sim.player.facing, rng: sim.rng.state, nextId: sim.nextId,
      itemId: sim.lootCtx.itemId ?? 0, lootWaves: sim.lootWaves, kills: sim.kills,
      broken: sim.breakables.filter((b) => b.broken).map((b) => b.id), restSeen: [...sim.rest.seen],
      drops: sim.drops.map((d) => structuredClone({ ...d, vx: 0, vz: 0, h: 0, vh: 0, landed: true })),
      guardsDown: sim.level.guards.map((_, i) => i).filter((i) => !sim.enemies.some((e) => e.guardIndex === i && e.state !== 'dead')),
    },
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses stored JSON; null for anything unknown, newer or damaged. Never throws. */
export function parseSave(text: string | null): SaveV1 | null {
  try {
    if (!text) return null;
    const s: unknown = JSON.parse(text);
    if (!obj(s) || s.v !== SAVE_VERSION || !isDifficulty(s.difficulty) || !obj(s.profile)) return null;
    const p = s.profile;
    if (!obj(p.inventory) || !Array.isArray(p.inventory.bag) || !obj(p.equipment) || !obj(p.statContext)) return null;
    let run: SaveRun | null = null;
    if (s.run != null) {
      const r = s.run;
      if (!obj(r) || typeof r.map !== 'string' || !['index', 'wave', 'hp', 'x', 'z', 'facing', 'rng', 'nextId', 'itemId', 'lootWaves', 'kills'].every((k) => num(r[k]))
        || !Array.isArray(r.broken) || !Array.isArray(r.drops) || !Array.isArray(r.restSeen)) return null;
      run = r as unknown as SaveRun;
    }
    return { v: 1, t: num(s.t) ? s.t : 0, difficulty: s.difficulty, profile: p as unknown as SaveProfile, run };
  } catch {
    return null;
  }
}

/**
 * Builds a sim from a save: profile always, the checkpoint when `useRun`. Throws on gear the stat
 * code rejects; callers fall back to a new game.
 */
export function simFromSave(save: SaveV1, opts: Omit<SimOptions, 'inventory' | 'equipment' | 'statContext' | 'difficulty' | 'startAt'>, useRun: boolean): Sim {
  const run = useRun ? save.run : null;
  const sim = createSim({ ...opts, ...save.profile, statContext: {...save.profile.statContext, perks: run?.perks ?? {}}, difficulty: save.difficulty, startAt: run?.index ?? 0, resume: !!run });
  if (!run) return sim;
  if (run.abilities) sim.abilities = { ...createAbilities(), ...structuredClone(run.abilities) };
  if (run.content) {
    sim.content = { ...sim.content, ...structuredClone(run.content) };
    for (const h of sim.content.shrines) sim.level.add({ kind: 'circle', x: h.x, z: h.z, r: 0.5 });
    // Enemies are not saved: an unfinished rescue gets its guards back, or the captive would be free at once.
    spawnGuards(sim);
    const sh = sim.content.shrine;
    setLoadout(sim, sim.equipment, { ...sim.statContext, shrines: { as: (sh.as ?? 0) > 0, res: (sh.res ?? 0) > 0, spd: (sh.spd ?? 0) > 0 } });
  }
  const L = sim.level;
  sim.player.x = sim.player.px = run.x;
  sim.player.z = sim.player.pz = run.z;
  sim.player.facing = sim.player.pfacing = run.facing;
  sim.player.hp = Math.max(1, Math.min(sim.stats.maxHp, run.hp));
  sim.rng.state = run.rng;
  sim.nextId = Math.max(sim.nextId, run.nextId);
  sim.lootCtx.itemId = Math.max(sim.lootCtx.itemId ?? 0, run.itemId);
  sim.lootWaves = run.lootWaves;
  sim.kills = run.kills;
  sim.rest.seen = [...run.restSeen];
  sim.drops = structuredClone(run.drops);
  // A side passage guard beaten before the checkpoint stays beaten (Codex review).
  if (run.guardsDown?.length) sim.enemies = sim.enemies.filter((e) => e.guardIndex === undefined || !run.guardsDown!.includes(e.guardIndex));
  for (const id of run.broken) { const b = sim.breakables[id]; if (b) hitBreakableState(sim, b); }
  focusFlow(sim, run.x, run.z);
  if (run.wave >= 0) {
    const enc = L.encounters[run.index];
    if (enc && run.wave < enc.waves.length) {
      sim.run.phase = 'pause';
      sim.run.wave = run.wave;
      sim.run.pauseT = 1.6;
      focusFlow(sim, enc.x, enc.z);
    }
  }
  sim.events.length = 0;
  return sim;
}
