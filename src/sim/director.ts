import { BOSS_DMG_STEP, districtScale } from '../data/enemies';
import { offerBlessings } from './blessings';
// Encounter director for expedition maps (migration Q1): the player walks a route and fights at
// fixed places. Entering the current encounter's circle starts it; waves spawn on its rim until
// all are beaten (bosses come with the last wave). Then life is partly restored and the next
// encounter becomes the objective. The fight is open (Johannes, 2026-11-16): nobody is held in the
// circle, the hero may kite, fall back to a pickup or a Späti; enemies follow, and a wave that is
// left behind spawns around the hero.
import { difficultyOf } from '../data/difficulty';
import { PLAYER } from '../data/combat';
import { ENEMIES, type BossKind, type EnemyKind } from '../data/enemies';
import { colliderDistance } from './collide';
import { encounterAlive, makeElite, pickKind, spawnEnemy, spawnPack } from './enemies';
import { freeSpot, reachable } from './reach';
import { clearThreats } from './threats';
import { FlowField, type Bounds } from './flowfield';
import { inRoom, type EncounterDef } from './level';
import { spawnDrop } from './loot';
import { makeEcho } from './echo';
import { healPlayer } from './heal';
import { DT, type Enemy, type Sim } from './types';

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
  // M20: gratings behind fights already won stand open (a retry or a checkpoint resume).
  for (let i = 0; i < index; i++) openGates(sim, i, true);
  // M17: a run saved at the ending choice resumes at it.
  sim.run.phase = index >= sim.level.encounters.length ? (sim.level.ending.length ? 'choice' : 'won') : 'travel';
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

/**
 * M20 tunnel (2D `openGate`): the gratings behind encounter `index` open. Collider out of the level,
 * a heal drop at the grating and a `gateOpen` event (burst, sound, "Gitter offen"). `quiet`: a resume.
 */
export function openGates(sim: Sim, index: number, quiet = false): void {
  sim.level.gates.forEach((g, i) => {
    if (g.after !== index || sim.gateT[i] !== Infinity) return;
    sim.level.remove(g.collider);
    sim.gateT[i] = quiet ? -1e3 : sim.time;
    if (quiet) return;
    spawnDrop(sim, g.x, g.z, { kind: 'heal' });
    sim.events.push({ type: 'gateOpen', index: i, x: g.x, z: g.z });
  });
}

/**
 * B2 step 2: a closed grating is a one-way wall in the sim. Body separation can shove a body crowded
 * against the 0.6 m bars past their middle, and the next push-out then lets it out on the far side,
 * where nobody can reach it (bot campaigns stalled on a spitter and a walker behind closed gratings).
 * Walking bodies and the hero that end a step on the far side close to the bars go back in front of them.
 */
export function holdGates(sim: Sim): void {
  const L = sim.level;
  for (let i = 0; i < L.gates.length; i++) {
    if (sim.gateT[i] !== Infinity) continue;
    const g = L.gates[i]!, enc = L.encounters[g.after];
    if (!enc) continue;
    const ux = Math.sin(g.rot), uz = Math.cos(g.rot);
    const side = Math.sign((enc.x - g.x) * ux + (enc.z - g.z) * uz) || -1;
    const hold = (b: { x: number; z: number }, r: number): void => {
      const dx = b.x - g.x, dz = b.z - g.z, along = dx * ux + dz * uz;
      if (along * side >= 0 || Math.abs(along) > GATE_BAND || Math.abs(dx * uz - dz * ux) > g.half) return;
      const to = side * (GATE_HALF_DEPTH + r) - along;
      b.x += ux * to;
      b.z += uz * to;
    };
    for (const e of sim.enemies) if (e.state !== 'dead' && !e.def.fly) hold(e, e.def.radius);
    hold(sim.player, PLAYER.radius);
  }
}
/** How far past the bars a body counts as pushed through (farther: it belongs to the next section). */
const GATE_BAND = 1.5;
/** Half the depth of a grating's collider (`hz` in `mapLevel`, `src/data/map.ts`). */
const GATE_HALF_DEPTH = 0.3;

/** A closed grating lies between two points (spawns never appear behind one). */
export function gateBetween(sim: Sim, ax: number, az: number, bx: number, bz: number): boolean {
  return sim.level.gates.some((g, i) => {
    if (sim.gateT[i] !== Infinity) return false;
    // Signed distance of both points along the track direction from the grating line.
    const ux = Math.sin(g.rot), uz = Math.cos(g.rot);
    const da = (ax - g.x) * ux + (az - g.z) * uz, db = (bx - g.x) * ux + (bz - g.z) * uz;
    if (da * db > 0) return false;
    const t = da / (da - db || 1);
    const cx = ax + (bx - ax) * t - g.x, cz = az + (bz - az) * t - g.z;
    return Math.abs(cx * uz - cz * ux) <= g.half + 1;
  });
}

/** A free spot on the rim, away from the player, preferably out of the camera's view. */
function rimSpot(sim: Sim, enc: EncounterDef, radius: number): { x: number; z: number } {
  const p = sim.player;
  // M18 walk-in room (E2): every body comes from a free cell inside the room, the farther from the hero the better.
  if (enc.room) return roomSpot(sim, enc.room, radius);
  // The hero left the place: the wave comes to them, from out of view.
  if (Math.hypot(p.x - enc.x, p.z - enc.z) > enc.r + AWAY) {
    const q = freeSpot(sim.level, sim.rng, p.x, p.z, 11, 16, radius + 0.2, (x, z) => !gateBetween(sim, p.x, p.z, x, z));
    if (q) return q;
  }
  // M17: a ring fight's centre is the tower core; fall back to its walkable spot.
  let best = { x: enc.at?.x ?? enc.x, z: enc.at?.z ?? enc.z };
  let bestScore = -Infinity;
  for (let tries = 0; tries < 14; tries++) {
    const a = sim.rng.range(0, Math.PI * 2);
    const rr = enc.r - radius - sim.rng.range(0.2, 1.2);
    const x = enc.x + Math.sin(a) * rr;
    const z = enc.z + Math.cos(a) * rr;
    if (sim.level.blocked(x, z, radius) || sim.level.noSpawnAt(x, z)) continue;
    if (sim.level.near(x, z, radius + 1).some((c) => colliderDistance(c, x, z) < radius + 0.2)) continue;
    // Never into a closed pocket (a yard boxed in by props): the wave could not reach the hero (review of PR 55).
    if (!reachable(sim.level, x, z)) continue;
    const score = Math.hypot(x - p.x, z - p.z) + sim.rng.range(0, 4);
    if (score > bestScore) {
      bestScore = score;
      best = { x, z };
    }
  }
  return best;
}

/** A free cell inside a walk-in room (off walls and furniture, reachable), preferably far from the hero. */
function roomSpot(sim: Sim, room: NonNullable<EncounterDef['room']>, radius: number): { x: number; z: number } {
  const p = sim.player, c = Math.cos(room.rot), s = Math.sin(room.rot);
  let best = { x: room.x, z: room.z }, bestScore = -Infinity;
  for (let tries = 0; tries < 24; tries++) {
    const u = sim.rng.range(-room.hx + radius + 0.2, room.hx - radius - 0.2), v = sim.rng.range(-room.hz + radius + 0.2, room.hz - radius - 0.2);
    const x = room.x + u * c + v * s, z = room.z - u * s + v * c;
    if (sim.level.blocked(x, z, radius) || sim.level.noSpawnAt(x, z)) continue;
    if (sim.level.near(x, z, radius + 1).some((q) => colliderDistance(q, x, z) < radius + 0.2)) continue;
    if (!reachable(sim.level, x, z)) continue;
    const score = Math.hypot(x - p.x, z - p.z) + sim.rng.range(0, 3);
    if (score > bestScore) { bestScore = score; best = { x, z }; }
  }
  return best;
}

/** Tags every body added since `from` (a pack, a boss) as part of the current encounter (`Enemy.enc`). */
function tagSince(sim: Sim, from: number): void {
  for (let i = from; i < sim.enemies.length; i++) sim.enemies[i]!.enc = sim.run.index;
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
    // M18: a walk-in room starts when the hero is inside it (not on the square in front of its door).
    if (enc.room ? !inRoom(enc.room, p.x, p.z, 0.3) : Math.hypot(p.x - enc.x, p.z - enc.z) > enc.r - TRIGGER_INSET) return;
    run.wave = 0;
    focusFlow(sim, enc.x, enc.z);
    if (enc.hold) {
      // M20 generator: the first wave is the stream that comes while the hero holds the ring.
      run.phase = 'hold';
      run.hold = { p: 0, need: enc.hold.need, inside: false, sp: 1, elite: false };
      if (enc.waves[0]!.bosses.length === 0) sim.lootWaves++;
      sim.events.push({ type: 'encounterStart', index: run.index, hp: p.hp }, { type: 'holdStart', index: run.index, x: enc.hold.at?.x ?? enc.x, z: enc.hold.at?.z ?? enc.z });
      return;
    }
    run.phase = 'fight';
    sim.events.push({ type: 'encounterStart', index: run.index, hp: p.hp });
    startWave(sim, enc);
    return;
  }

  if (run.phase === 'hold') {
    updateHold(sim, enc);
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
  // Only this encounter's own bodies count (review 2026-11-20): captive guards and event adds never hold a fight open.
  const alive = (): number => encounterAlive(sim, run.index);
  if (run.spawnT <= 0 && (run.bossesToSpawn.length > 0 || (run.toSpawn > 0 && alive() < w.maxAlive))) {
    run.spawnT = SPAWN_GAP;
    const n0 = sim.enemies.length;
    // M15: while the Weltzeituhr wakes up, the wave waits.
    const waking = sim.enemies.some((e) => e.state !== 'dead' && (e.wake ?? 0) > 0);
    const boss = waking ? undefined : run.bossesToSpawn.shift();
    if (waking) {
      // Nothing comes out until it stands.
    } else if (boss) {
      const s = enc.bossAt ?? rimSpot(sim, enc, ENEMIES[boss].radius);
      // Bosses take the full life step but 40 % of the damage step (verification chains: the Spreehexe killed a weaker
      // bot 12 times with the full step while normal fights stayed easy).
      const ds = districtScale(sim.level.strength);
      const e = spawnEnemy(sim, s.x, s.z, boss, w.hpMul * df.hp * ds.hp, w.dmgMul * df.dmg * (1 + (ds.dmg - 1) * BOSS_DMG_STEP));
      // M17: an echo of a district boss (weaker, no items).
      if (w.echo) makeEcho(e);
      // It stands where the landmark stood: the landmark's colliders leave until it dies.
      if (enc.bossAt) {
        e.home = { x: s.x, z: s.z };
        e.stand = sim.level.near(s.x, s.z, 0.5).filter((c) => colliderDistance(c, s.x, s.z) <= 0);
        for (const c of e.stand) sim.level.remove(c);
      }
    } else {
      // M12b: a pack kind (rat) spawns its whole pack of five for ONE unit of the wave's `count`, as
      // in 2D `spawnOne` (one rat roll, four more beside it). Mix weights are per unit, so a rat
      // weight of 1 brings as many packs as a walker weight of 1 brings walkers. The pack fills
      // five `maxAlive` slots, which holds back the next spawns until rats die.
      const kind = pickKind(sim, w.mix);
      const s = rimSpot(sim, enc, ENEMIES[kind].radius);
      const e = spawnPack(sim, s.x, s.z, kind, w.hpMul * df.hp * districtScale(sim.level.strength).hp, w.dmgMul * df.dmg * districtScale(sim.level.strength).dmg);
      if (w.elite && sim.rng.next() < w.elite) makeElite(sim, e);
      run.toSpawn--;
    }
    tagSince(sim, n0);
  }
  if (run.toSpawn > 0 || run.bossesToSpawn.length > 0 || alive() > 0) return;

  run.wave++;
  if (run.wave < enc.waves.length) {
    run.phase = 'pause';
    run.pauseT = WAVE_PAUSE;
    sim.events.push({ type: 'checkpoint' });
    return;
  }
  // Encounter won: the blessing choice follows after a short breath.
  sim.abilities.rewardT = REWARD_DELAY;
  if (sim.level.gates.length) {
    openGates(sim, run.index);
    focusFlow(sim, p.x, p.z);
  }
  const heal = healPlayer(sim, Math.round(sim.stats.maxHp * enc.heal), 'encounter');
  sim.events.push({ type: 'encounterClear', index: run.index, heal });
  const next = sim.level.encounters[run.index + 1];
  if (!next || next.zone !== enc.zone) sim.events.push({ type: 'zoneClear', zone: enc.zone });
  run.index++;
  if (!next) {
    clearThreats(sim);
    // M17 (T10): the Fernsehturm ends at the main switch: the choice first, then the victory (`updateEnding`).
    if (sim.level.ending.length) {
      run.phase = 'choice';
      // A checkpoint, so leaving or a profile change before the choice resumes at the rings (Codex review).
      sim.events.push({ type: 'choiceOpen' }, { type: 'checkpoint' });
      return;
    }
    run.phase = 'won';
    sim.events.push({ type: 'victory' });
  } else {
    run.phase = 'travel';
    sim.events.push({ type: 'checkpoint' });
  }
}

/** M20: after the charge, a breath before the last waves (the "Strom!" banner stays readable). */
export const POWER_PAUSE = 2.5;

/**
 * M20 generator hold (2D `tunUpdate` GEN): charge only while the hero stands in the ring; spawns come
 * out of the tunnel mouth only then too, an elite brute at half charge. Full: `power`, then wave 1.
 */
function updateHold(sim: Sim, enc: EncounterDef): void {
  const H = enc.hold!, h = sim.run.hold!, p = sim.player, w = enc.waves[0]!, c = H.at ?? enc;
  h.inside = Math.hypot(p.x - c.x, p.z - c.z) <= H.r;
  if (!h.inside) return;
  h.p = Math.min(H.need, h.p + DT);
  h.sp -= DT;
  if (h.sp <= 0) {
    h.sp = H.every * sim.rng.range(0.8, 1.2);
    const df = difficultyOf(sim.difficulty);
    const out = (kind: EnemyKind): Enemy => {
      const q = freeSpot(sim.level, sim.rng, H.mouth.x, H.mouth.z, 0, 3, ENEMIES[kind].radius + 0.2) ?? H.mouth;
      const e = spawnEnemy(sim, q.x, q.z, kind, w.hpMul * df.hp * districtScale(sim.level.strength).hp, w.dmgMul * df.dmg * districtScale(sim.level.strength).dmg);
      e.enc = sim.run.index;
      return e;
    };
    if (!h.elite && h.p >= H.need / 2) {
      h.elite = true;
      makeElite(sim, out('brute'));
    } else if (encounterAlive(sim, sim.run.index) < w.maxAlive) {
      const e = out(pickKind(sim, w.mix));
      if (w.elite && sim.rng.next() < w.elite) makeElite(sim, e);
    }
  }
  if (h.p < H.need) return;
  h.on = sim.time;
  sim.events.push({ type: 'power', index: sim.run.index, x: c.x, z: c.z });
  sim.run.wave = 1;
  sim.run.phase = 'pause';
  sim.run.pauseT = POWER_PAUSE;
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
  if (run.spawnT <= 0 && (run.bossesToSpawn.length > 0 || (run.toSpawn > 0 && encounterAlive(sim, run.index) < w.maxAlive))) {
    run.spawnT = SPAWN_GAP;
    const n0 = sim.enemies.length;
    const boss = run.bossesToSpawn.shift();
    const kind = boss ?? pickKind(sim, w.mix);
    const q = freeSpot(sim.level, sim.rng, p.x, p.z, 11, 16, ENEMIES[kind].radius + 0.2) ?? { x: p.x + 12, z: p.z };
    const e = spawnPack(sim, q.x, q.z, kind, w.hpMul * df.hp * districtScale(sim.level.strength).hp * (boss ? 0.8 : 1), w.dmgMul * df.dmg * districtScale(sim.level.strength).dmg);
    if (!boss) { if (sim.rng.next() < w.elite) makeElite(sim, e); run.toSpawn--; }
    tagSince(sim, n0);
  }
  followFlow(sim);
  if (run.toSpawn > 0 || run.bossesToSpawn.length > 0 || encounterAlive(sim, run.index) > 0) return;
  run.endless = n + 1;
  sim.lootWaves++;
  const camp = sim.inventory.camp ??= { stations: {}, stash: [], freed: [] };
  camp.endlessBest = Math.max(camp.endlessBest ?? 0, n + 1);
  healPlayer(sim, Math.round(sim.stats.maxHp * 0.15), 'endless');
  sim.events.push({ type: 'endlessWave', n: n + 1, done: true });
  if ((n + 1) % ENDLESS.blessingEvery === 0) sim.abilities.rewardT = REWARD_DELAY;
  run.phase = 'pause';
  run.pauseT = ENDLESS.pause;
}
