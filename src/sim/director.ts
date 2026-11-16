// Encounter director for expedition maps (migration Q1): the player walks a route and fights at
// fixed places. Entering the current encounter's circle closes it; waves spawn on its rim until
// all are beaten (bosses come with the last wave). Then the circle opens, life is partly restored
// and the next encounter becomes the objective.
import { difficultyOf } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { colliderDistance } from './collide';
import { aliveCount, pickKind, spawnEnemy } from './enemies';
import { FlowField, type Bounds } from './flowfield';
import type { EncounterDef } from './level';
import { DT, type Sim } from './types';

/** Enemies may stand this far outside the fight circle (they spawn on its rim). */
export const ARENA_ENEMY_SLACK = 1.5;
/** The player triggers an encounter this far inside its circle. */
const TRIGGER_INSET = 3;
const WAVE_PAUSE = 1.6;
const SPAWN_GAP = 0.35;
/** Flow field window half size around a fight or the player. */
const WINDOW = 30;

export function currentEncounter(sim: Sim): EncounterDef | null {
  return sim.level.encounters[sim.run.index] ?? null;
}

/** During a fight nobody leaves the circle: the player stays inside, enemies near the rim. */
export function keepInArena(sim: Sim, body: { x: number; z: number }, r: number, slack = 0): void {
  if (sim.run.phase !== 'fight' && sim.run.phase !== 'pause') return;
  const enc = currentEncounter(sim);
  if (!enc) return;
  const dx = body.x - enc.x;
  const dz = body.z - enc.z;
  const d = Math.hypot(dx, dz);
  const max = enc.r - r + slack;
  if (d <= max || d < 1e-6) return;
  body.x = enc.x + (dx / d) * max;
  body.z = enc.z + (dz / d) * max;
}

/** Builds the flow field over a window of the map (the whole map is too big for one field). */
export function focusFlow(sim: Sim, x: number, z: number): void {
  const L = sim.level;
  const b: Bounds = {
    minX: Math.max(L.bounds.minX, x - WINDOW),
    maxX: Math.min(L.bounds.maxX, x + WINDOW),
    minZ: Math.max(L.bounds.minZ, z - WINDOW),
    maxZ: Math.min(L.bounds.maxZ, z + WINDOW),
  };
  sim.flow = new FlowField(b, L.inBox(b), 0.5, 0.3, L.ground);
  sim.flowCenter = { x, z };
}

/** Starts the run at encounter `index` (a retry after death starts at its zone). */
export function startRunAt(sim: Sim, index: number): void {
  sim.run.index = index;
  sim.run.phase = index >= sim.level.encounters.length ? 'won' : 'travel';
  // A retry mid-map keeps the item level of the waves before it.
  sim.lootWaves = 0;
  for (let i = 0; i < index; i++) for (const w of sim.level.encounters[i]!.waves) if (w.bosses.length === 0) sim.lootWaves++;
}

function startWave(sim: Sim, enc: EncounterDef): void {
  const w = enc.waves[sim.run.wave];
  if (!w) return;
  if (w.bosses.length === 0) sim.lootWaves++;
  sim.run.toSpawn = w.count;
  sim.run.bossesToSpawn = [...w.bosses];
  sim.run.spawnT = 0.4;
  sim.events.push({ type: 'waveStart', index: sim.run.index, wave: sim.run.wave, waves: enc.waves.length });
}

/** A free spot on the rim, away from the player, preferably out of the camera's view. */
function rimSpot(sim: Sim, enc: EncounterDef, radius: number): { x: number; z: number } {
  const p = sim.player;
  let best = { x: enc.x, z: enc.z };
  let bestScore = -Infinity;
  for (let tries = 0; tries < 14; tries++) {
    const a = sim.rng.range(0, Math.PI * 2);
    const rr = enc.r - radius - sim.rng.range(0.2, 1.2);
    const x = enc.x + Math.sin(a) * rr;
    const z = enc.z + Math.cos(a) * rr;
    if (sim.level.blocked(x, z, radius)) continue;
    if (sim.level.near(x, z, radius + 1).some((c) => colliderDistance(c, x, z) < radius + 0.2)) continue;
    const score = Math.hypot(x - p.x, z - p.z) + sim.rng.range(0, 4);
    if (score > bestScore) {
      bestScore = score;
      best = { x, z };
    }
  }
  return best;
}

export function updateDirector(sim: Sim): void {
  const run = sim.run;
  const p = sim.player;
  const enc = currentEncounter(sim);
  if (!enc || p.state === 'dead') return;

  if (run.phase === 'travel') {
    if (Math.hypot(p.x - enc.x, p.z - enc.z) > enc.r - TRIGGER_INSET) return;
    run.phase = 'fight';
    run.wave = 0;
    focusFlow(sim, enc.x, enc.z);
    sim.events.push({ type: 'encounterStart', index: run.index });
    startWave(sim, enc);
    return;
  }

  if (run.phase === 'pause') {
    run.pauseT -= DT;
    if (run.pauseT <= 0) {
      run.phase = 'fight';
      startWave(sim, enc);
    }
    return;
  }

  if (run.phase !== 'fight') return;
  const w = enc.waves[run.wave];
  if (!w) return;
  const df = difficultyOf(sim.difficulty);
  run.spawnT -= DT;
  if (run.spawnT <= 0 && (run.bossesToSpawn.length > 0 || (run.toSpawn > 0 && aliveCount(sim) < w.maxAlive))) {
    run.spawnT = SPAWN_GAP;
    const boss = run.bossesToSpawn.shift();
    if (boss) {
      const s = rimSpot(sim, enc, ENEMIES[boss].radius);
      spawnEnemy(sim, s.x, s.z, boss, w.hpMul * df.hp, w.dmgMul * df.dmg);
    } else {
      const kind = pickKind(sim, w.mix);
      const s = rimSpot(sim, enc, ENEMIES[kind].radius);
      spawnEnemy(sim, s.x, s.z, kind, w.hpMul * df.hp, w.dmgMul * df.dmg);
      run.toSpawn--;
    }
  }
  if (run.toSpawn > 0 || run.bossesToSpawn.length > 0 || aliveCount(sim) > 0) return;

  run.wave++;
  if (run.wave < enc.waves.length) {
    run.phase = 'pause';
    run.pauseT = WAVE_PAUSE;
    sim.events.push({ type: 'checkpoint' });
    return;
  }
  // Encounter won.
  const heal = Math.min(sim.stats.maxHp - p.hp, Math.round(sim.stats.maxHp * enc.heal));
  p.hp += heal;
  sim.events.push({ type: 'encounterClear', index: run.index, heal });
  const next = sim.level.encounters[run.index + 1];
  if (!next || next.zone !== enc.zone) sim.events.push({ type: 'zoneClear', zone: enc.zone });
  run.index++;
  if (!next) {
    run.phase = 'won';
    sim.events.push({ type: 'victory' });
  } else {
    run.phase = 'travel';
    sim.events.push({ type: 'checkpoint' });
  }
}

/** Outside fights (stress test, stragglers) the flow window follows the player. */
export function followFlow(sim: Sim): void {
  if (!sim.level.expedition || sim.run.phase === 'fight' || sim.run.phase === 'pause') return;
  if (sim.enemies.length === 0) return;
  const c = sim.flowCenter;
  if (Math.hypot(sim.player.x - c.x, sim.player.z - c.z) > WINDOW * 0.4) focusFlow(sim, sim.player.x, sim.player.z);
}
