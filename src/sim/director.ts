import { offerBlessings } from './blessings';
// Encounter director for expedition maps (migration Q1): the player walks a route and fights at
// fixed places. Entering the current encounter's circle starts it; waves spawn on its rim until
// all are beaten (bosses come with the last wave). Then life is partly restored and the next
// encounter becomes the objective. The fight is open (Johannes, 2026-11-16): nobody is held in the
// circle, the hero may kite, fall back to a pickup or a Späti; enemies follow, and a wave that is
// left behind spawns around the hero.
import { difficultyOf } from '../data/difficulty';
import { ENEMIES, type BossKind } from '../data/enemies';
import { colliderDistance } from './collide';
import { aliveCount, makeElite, pickKind, spawnEnemy, spawnPack } from './enemies';
import { freeSpot } from './reach';
import { FlowField, type Bounds } from './flowfield';
import type { EncounterDef } from './level';
import { DT, type Sim } from './types';

/** The player triggers an encounter this far inside its circle. */
const TRIGGER_INSET = 3;
const WAVE_PAUSE = 1.6;
const SPAWN_GAP = 0.35;
/** A breath between the last kill and the blessing choice (playtest 2026-11-17). */
export const REWARD_DELAY = 1.3;
/** Flow field window half size around a fight or the player. */
const WINDOW = 30;
/** Farther than this from the fight place, a wave's enemies appear around the hero instead of on the rim. */
const AWAY = 10;

export function currentEncounter(sim: Sim): EncounterDef | null {
  return sim.level.encounters[sim.run.index] ?? null;
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
  // The hero left the place: the wave comes to them, from out of view.
  if (Math.hypot(p.x - enc.x, p.z - enc.z) > enc.r + AWAY) {
    const q = freeSpot(sim.level, sim.rng, p.x, p.z, 11, 16, radius + 0.2);
    if (q) return q;
  }
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
  if ((sim.abilities.rewardT ?? 0) > 0 && p.state !== 'dead') {
    sim.abilities.rewardT! -= DT;
    if (sim.abilities.rewardT! <= 0) offerBlessings(sim);
  }
  if (run.endless !== undefined && p.state !== 'dead') { updateEndless(sim); return; }
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
      // M12b: a pack kind (rat) spawns its whole pack of five for ONE unit of the wave's `count`, as
      // in 2D `spawnOne` (one rat roll, four more beside it). Mix weights are per unit, so a rat
      // weight of 1 brings as many packs as a walker weight of 1 brings walkers. The pack fills
      // five `maxAlive` slots, which holds back the next spawns until rats die.
      const kind = pickKind(sim, w.mix);
      const s = rimSpot(sim, enc, ENEMIES[kind].radius);
      const e = spawnPack(sim, s.x, s.z, kind, w.hpMul * df.hp, w.dmgMul * df.dmg);
      if (w.elite && sim.rng.next() < w.elite) makeElite(sim, e);
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
  // Encounter won: the blessing choice follows after a short breath.
  sim.abilities.rewardT = REWARD_DELAY;
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

/** The flow window follows the player, in fights too (they are open). */
export function followFlow(sim: Sim): void {
  if (!sim.level.expedition) return;
  if (sim.enemies.length === 0) return;
  const c = sim.flowCenter;
  if (Math.hypot(sim.player.x - c.x, sim.player.z - c.z) > WINDOW * 0.4) focusFlow(sim, sim.player.x, sim.player.z);
}

/**
 * M18 endless mode (2D `run.endless`): after the district boss the waves keep coming around the hero.
 * Each wave is larger and tougher than the last fight of the map; every fifth brings a boss, every
 * second ends with a blessing choice. The best wave is kept in the profile (`camp.endlessBest`).
 */
export const ENDLESS = { pause: 4, count: 10, perWave: 2, growth: 1.08, eliteBase: 0.12, elitePerWave: 0.01, eliteMax: 0.45, bossEvery: 5, blessingEvery: 2 } as const;
/** The district's own bosses come back in endless mode, in the order of the map. */
function endlessBosses(sim: Sim): BossKind[] {
  const own = sim.level.encounters.flatMap((e) => e.waves.flatMap((w) => w.bosses)) as BossKind[];
  return own.length > 0 ? own : ['feldwebel', 'waechter', 'rex', 'hauptmann'];
}
export function startEndless(sim: Sim): void {
  sim.run.endless = 0;
  sim.run.phase = 'pause';
  sim.run.pauseT = ENDLESS.pause;
  sim.run.toSpawn = 0;
  sim.run.bossesToSpawn = [];
  focusFlow(sim, sim.player.x, sim.player.z);
}
/** The wave the endless mode builds from: the map's last regular wave, grown per wave. */
export function endlessWave(sim: Sim, n: number): { count: number; maxAlive: number; mix: Partial<Record<import('../data/enemies').EnemyKind, number>>; hpMul: number; dmgMul: number; elite: number } {
  const encs = sim.level.encounters, last = encs[encs.length - 1];
  const base = last?.waves.filter((w) => w.bosses.length === 0).at(-1) ?? last?.waves[0] ?? { count: 10, maxAlive: 12, mix: { walker: 1 }, hpMul: 1, dmgMul: 1, bosses: [] };
  const g = ENDLESS.growth ** n;
  return { count: ENDLESS.count + ENDLESS.perWave * n, maxAlive: Math.min(24, base.maxAlive + Math.floor(n / 2)), mix: base.mix, hpMul: base.hpMul * g, dmgMul: base.dmgMul * Math.sqrt(g), elite: Math.min(ENDLESS.eliteMax, ENDLESS.eliteBase + ENDLESS.elitePerWave * n) };
}
function updateEndless(sim: Sim): void {
  const run = sim.run, n = run.endless!, df = difficultyOf(sim.difficulty), p = sim.player;
  if (run.phase === 'pause') {
    if ((sim.abilities.rewardT ?? 0) > 0 || sim.abilities.offers.length > 0) return;
    run.pauseT -= DT;
    if (run.pauseT > 0) return;
    run.phase = 'fight';
    run.toSpawn = endlessWave(sim, n + 1).count;
    run.bossesToSpawn = (n + 1) % ENDLESS.bossEvery === 0 ? [endlessBosses(sim)[Math.floor((n + 1) / ENDLESS.bossEvery - 1) % endlessBosses(sim).length]!] : [];
    run.spawnT = 0.4;
    sim.events.push({ type: 'endlessWave', n: n + 1, done: false });
    return;
  }
  if (run.phase !== 'fight') return;
  const w = endlessWave(sim, n + 1);
  run.spawnT -= DT;
  if (run.spawnT <= 0 && (run.bossesToSpawn.length > 0 || (run.toSpawn > 0 && aliveCount(sim) < w.maxAlive))) {
    run.spawnT = SPAWN_GAP;
    const boss = run.bossesToSpawn.shift();
    const kind = boss ?? pickKind(sim, w.mix);
    const q = freeSpot(sim.level, sim.rng, p.x, p.z, 11, 16, ENEMIES[kind].radius + 0.2) ?? { x: p.x + 12, z: p.z };
    const e = spawnPack(sim, q.x, q.z, kind, w.hpMul * df.hp * (boss ? 0.8 : 1), w.dmgMul * df.dmg);
    if (!boss) { if (sim.rng.next() < w.elite) makeElite(sim, e); run.toSpawn--; }
  }
  followFlow(sim);
  if (run.toSpawn > 0 || run.bossesToSpawn.length > 0 || aliveCount(sim) > 0) return;
  run.endless = n + 1;
  sim.lootWaves++;
  const camp = sim.inventory.camp ??= { stations: {}, stash: [], freed: [] };
  camp.endlessBest = Math.max(camp.endlessBest ?? 0, n + 1);
  const heal = Math.min(sim.stats.maxHp - p.hp, Math.round(sim.stats.maxHp * 0.15));
  p.hp += heal;
  sim.events.push({ type: 'endlessWave', n: n + 1, done: true });
  if ((n + 1) % ENDLESS.blessingEvery === 0) sim.abilities.rewardT = REWARD_DELAY;
  run.phase = 'pause';
  run.pauseT = ENDLESS.pause;
}
