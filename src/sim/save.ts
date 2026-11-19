// M6: versioned save (new format, no 2D import). Pure: no DOM, no storage (see `src/save.ts`).
// `profile` is what the hero owns and survives every run; `run` is the wave checkpoint (B1) and is
// null between runs. Ground drops are not saved: a resumed wave starts with a clean floor.
import { hitBreakableState } from './breakables';
import { focusFlow } from './director';
import { createSim, type SimOptions } from './sim';
import { createAbilities } from './abilities';
import { setLoadout } from './loadout';
import { placeFunde, spawnGuards } from './runcontent';
import type { Sim } from './types';

export { SAVE_VERSION, parseSave, type SaveProfile, type SaveRun, type SaveV1 } from './save-format';
import type { SaveProfile, SaveV1 } from './save-format';

export function profileOf(sim: Sim): SaveProfile {
  return structuredClone({ inventory: sim.inventory, equipment: sim.equipment, statContext: { ...sim.statContext, perks: {}, shrines: {} } });
}

export function snapshot(sim: Sim, map: string, withRun: boolean, now = Date.now()): SaveV1 {
  const r = sim.run;
  // Endless mode has no checkpoint (M18): its pauses are not resumable.
  const inRun = withRun && sim.level.expedition && r.endless === undefined && (r.phase === 'pause' || r.phase === 'travel' || r.phase === 'hold') && sim.player.state !== 'dead';
  // M20: a save during the generator hold resumes before it (the charge starts again), so the hold
  // wave the director already counted on entering the ring is taken back out (Codex review).
  const enc = sim.level.encounters[r.index];
  const holdCounted = r.phase === 'hold' && !!enc?.hold && enc.waves[0]!.bosses.length === 0 ? 1 : 0;
  return {
    v: 1, t: now, difficulty: sim.difficulty, profile: profileOf(sim),
    run: !inRun ? null : {
      // Things in flight are not saved: a resumed wave starts with a clean field.
      abilities: structuredClone({ ...sim.abilities, projectiles: [], shocks: [], strikes: [], bottles: [], booms: [], fields: [], spin: 0, guard: 0 }), perks: { ...sim.statContext.perks },
      content: structuredClone({ ...sim.content, tradeOpen: false }),
      map, index: r.index, wave: r.phase === 'pause' ? r.wave : -1, hp: sim.player.hp,
      x: sim.player.x, z: sim.player.z, facing: sim.player.facing, rng: sim.rng.state, nextId: sim.nextId,
      itemId: sim.lootCtx.itemId ?? 0, lootWaves: sim.lootWaves - holdCounted, kills: sim.kills,
      broken: sim.breakables.filter((b) => b.broken).map((b) => b.id), restSeen: [...sim.rest.seen],
      drops: sim.drops.map((d) => structuredClone({ ...d, vx: 0, vz: 0, h: 0, vh: 0, landed: true })),
      guardsDown: sim.level.guards.map((_, i) => i).filter((i) => !sim.enemies.some((e) => e.guardIndex === i && e.state !== 'dead')),
    },
  };
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
    // Funde: a checkpoint can be older than a pickup (the profile is written at once, the checkpoint stays),
    // and one from before Funde existed has none; the profile decides what is still lying there.
    const found = sim.statContext.funde ?? [];
    sim.content.funde = sim.content.funde ? sim.content.funde.map((f) => ({ ...f, got: f.got || found.includes(f.id) })) : placeFunde(sim);
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
