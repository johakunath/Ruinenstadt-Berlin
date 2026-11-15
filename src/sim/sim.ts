// The simulation: one fixed 60 Hz step. No rendering, no DOM, no Three.js; unit tested.
import { HIT_FEEL, PLAYER } from '../data/combat';
import { courtyardLevel } from '../data/courtyard';
import { SPAWN } from '../data/enemies';
import { sectorHitsCircle } from './collide';
import { focusFlow, followFlow, startRunAt, updateDirector } from './director';
import { randomYardSpot, removeCorpses, resolveBodies, spawnEnemy, updateEnemies, updateSpawner } from './enemies';
import { FlowField } from './flowfield';
import type { Level } from './level';
import { lerp, Rng } from './math';
import { starterEquipment, statContext } from './loadout';
import { heroStats, type Equipment, type StatContext } from './stats';
import { createPlayer, updatePlayer } from './player';
import { DT, type Enemy, type Sim, type SimInput } from './types';

export interface SimOptions {
  equipment?: Equipment;
  statContext?: Partial<StatContext>;
  seed?: number;
  /** Keep this many enemies alive from the first step (`?stress=40`). */
  stress?: number;
  /** Skip the opening group and the spawner (tests place enemies themselves). */
  empty?: boolean;
  /** Map; the gate 1 courtyard when left out. */
  level?: Level;
  /** Expedition maps: start at this encounter (retry after death starts at its zone's entry). */
  startAt?: number;
}

export function createSim(opts: SimOptions = {}): Sim {
  const level = opts.level ?? courtyardLevel();
  const startAt = opts.startAt ?? 0;
  const zone = level.encounters[startAt]?.zone ?? 0;
  const entry = startAt > 0 ? level.zones[zone]?.entry : undefined;
  const equipment = structuredClone(opts.equipment ?? starterEquipment());
  const context = statContext(opts.statContext);
  const stats = heroStats(equipment, context);
  const sim: Sim = {
    equipment, statContext: context, stats,
    tick: 0,
    time: 0,
    player: createPlayer(level, entry),
    enemies: [],
    events: [],
    hitstop: 0,
    consumed: { attack: false, dodge: false },
    level,
    colliders: level.colliders,
    flow: level.expedition ? new FlowField({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, []) : new FlowField(level.bounds, level.colliders),
    flowCenter: { x: 0, z: 0 },
    run: { index: 0, phase: 'travel', wave: 0, toSpawn: 0, bossesToSpawn: [], spawnT: 0, pauseT: 0 },
    rng: new Rng(opts.seed ?? 1),
    nextId: 1,
    kills: 0,
    spawnT: opts.empty || (level.expedition && !opts.stress) ? Infinity : 1.5,
    stress: opts.stress ?? 0,
  };
  sim.player.hp = stats.maxHp;
  if (level.expedition) {
    startRunAt(sim, startAt);
    focusFlow(sim, sim.player.x, sim.player.z);
  }
  sim.flow.setTarget(sim.player.x, sim.player.z);
  if (!opts.empty && (!level.expedition || sim.stress > 0)) {
    const opening = sim.stress > 0 ? sim.stress : SPAWN.startAlive - 2;
    for (let i = 0; i < opening; i++) {
      const s = randomYardSpot(sim, 6);
      spawnEnemy(sim, s.x, s.z);
    }
  }
  sim.events.length = 0;
  return sim;
}

/** Advances the world by one fixed step. */
export function stepSim(sim: Sim, input: SimInput): void {
  sim.consumed.attack = false;
  sim.consumed.dodge = false;
  const p = sim.player;
  p.px = p.x;
  p.pz = p.z;
  p.pfacing = p.facing;
  for (const e of sim.enemies) {
    e.px = e.x;
    e.pz = e.z;
    e.pfacing = e.facing;
  }
  // Hitstop: attacker and targets freeze; the input layer keeps buffering.
  if (sim.hitstop > 0) {
    sim.hitstop = Math.max(0, sim.hitstop - DT);
    return;
  }
  updatePlayer(sim, input);
  followFlow(sim);
  sim.flow.setTarget(p.x, p.z);
  updateEnemies(sim);
  resolveBodies(sim);
  playerSweep(sim);
  enemyStrikes(sim);
  removeCorpses(sim);
  if (sim.level.expedition && sim.stress === 0) updateDirector(sim);
  else updateSpawner(sim);
  sim.tick++;
  sim.time += DT;
}

/** Sweeps the weapon arc through this step's slice of the active frames. One hit per target per swing. */
function playerSweep(sim: Sim): void {
  const p = sim.player;
  const a = p.attack;
  p.sweeping = false;
  if (p.state !== 'attack' || !a) return;
  const t1 = p.stateT;
  const t0 = t1 - DT;
  if (t1 < a.windup || t0 >= a.windup + a.active) return;
  const f0 = Math.max(0, (t0 - a.windup) / a.active);
  const f1 = Math.min(1, (t1 - a.windup) / a.active);
  const a0 = lerp(a.from, a.to, f0);
  const a1 = lerp(a.from, a.to, f1);
  const lo = Math.min(a0, a1) - a.width;
  const hi = Math.max(a0, a1) + a.width;
  p.sweeping = true;
  p.sweepLo = lo;
  p.sweepHi = hi;
  const feel = HIT_FEEL[a.weight];
  for (const e of sim.enemies) {
    if (e.state === 'dead' || p.hits.includes(e.id)) continue;
    if (!sectorHitsCircle(p.x, p.z, p.facing, lo, hi, a.inner, a.reach, e.x, e.z, e.def.radius)) continue;
    p.hits.push(e.id);
    let dx = e.x - p.x;
    let dz = e.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    e.hp -= a.damage;
    e.kx += dx * a.knockback * e.def.knockbackTaken;
    e.kz += dz * a.knockback * e.def.knockbackTaken;
    const killed = e.hp <= 0;
    if (killed) {
      killEnemy(sim, e);
    } else if (!e.def.poise || a.weight === 'heavy') {
      e.state = 'stagger';
      e.stateT = 0;
      e.staggerDur = feel.stagger;
    }
    sim.hitstop = Math.max(sim.hitstop, feel.hitstop + (killed ? PLAYER.killHitstop : 0));
    sim.events.push({
      type: 'hit', id: e.id, x: e.x - dx * e.def.radius, z: e.z - dz * e.def.radius,
      dx, dz, weight: a.weight, killed, damage: a.damage, critical: p.critical,
    });
  }
}

function killEnemy(sim: Sim, e: Enemy): void {
  e.state = 'dead';
  e.stateT = 0;
  e.hp = 0;
  sim.kills++;
  if (sim.player.state !== 'dead') sim.player.hp = Math.min(sim.stats.maxHp, sim.player.hp + sim.stats.leech);
}

function enemyStrikes(sim: Sim): void {
  const p = sim.player;
  if (p.state === 'dead') return;
  for (const e of sim.enemies) {
    if (e.state !== 'strike' || e.struck) continue;
    if (p.invuln > 0 || p.hurtT < PLAYER.hitGrace) continue;
    const def = e.def;
    if (!sectorHitsCircle(e.x, e.z, e.facing, -def.halfAngle, def.halfAngle, 0, def.reach, p.x, p.z, PLAYER.radius)) continue;
    e.struck = true;
    const damage = Math.min(def.damage * e.dmgMul * (1 - sim.stats.res), sim.stats.maxHp * PLAYER.maxHitShare);
    let dx = p.x - e.x;
    let dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    p.hp = Math.max(0, p.hp - damage);
    p.hurtT = 0;
    sim.hitstop = Math.max(sim.hitstop, PLAYER.hitByEnemyHitstop);
    sim.events.push({ type: 'playerHit', x: p.x, z: p.z, dx, dz, damage });
    if (p.hp <= 0) {
      p.state = 'dead';
      p.stateT = 0;
      p.attack = null;
      p.sweeping = false;
      p.vx = dx * 3;
      p.vz = dz * 3;
      sim.events.push({ type: 'playerDie' });
      return;
    }
  }
}
