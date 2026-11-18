// Enemy behavior: chase along the flow field with separation, wind up, strike, recover, stagger, die.
import { PLAYER } from '../data/combat';
import { BOSS, ELITE_MODS, ENEMIES, SPAWN, THREAT, type EliteMod, type EnemyKind } from '../data/enemies';
import { initCooldowns, isRush, jitter, passive, runSpecial, think, tickCooldowns } from './ai';
import { colliderDistance } from './collide';
import { angleOf, clamp, turnToward } from './math';
import { DT, type Enemy, type Sim } from './types';
import { POWER } from '../data/powers';
import { STATUS } from './combat';

const KNOCK_DAMP = 9;
const SEPARATION_PAD = 0.25;
const dir = { x: 0, z: 0 };

export function pickKind(sim: Sim, mix?: Partial<Record<EnemyKind, number>>): EnemyKind {
  const kinds = Object.values(ENEMIES).filter((k) => (mix ? (mix[k.kind] ?? 0) : k.weight) > 0);
  let total = 0;
  const w = (k: (typeof kinds)[number]): number => (mix ? (mix[k.kind] ?? 0) : k.weight);
  for (const k of kinds) total += w(k);
  let roll = sim.rng.next() * total;
  for (const k of kinds) {
    roll -= w(k);
    if (roll <= 0) return k.kind;
  }
  return 'walker';
}

export function spawnEnemy(sim: Sim, x: number, z: number, kind: EnemyKind = pickKind(sim), hpMul = 1, dmgMul = 1): Enemy {
  const def = ENEMIES[kind];
  const hp = Math.round(def.hp * hpMul);
  const facing = angleOf(sim.player.x - x, sim.player.z - z);
  const e: Enemy = {
    id: sim.nextId++, kind, def, x, z, px: x, pz: z, facing, pfacing: facing,
    kx: 0, kz: 0, speed: 0, hp, maxHp: hp, hpMul, dmgMul, state: 'chase', stateT: 0, staggerDur: 0, struck: false, burn: 0, bdps: 0, burnAcc: 0, acid: 0,
    sp: null, open: 0, rest: 0, buff: 0, cd: [0, 0, 0], gap: 0, cycle: 0, side: 1, orb: 0, rage: false, trailT: 0,
  };
  e.side = jitter(e.id, 3) < 0.5 ? 1 : -1;
  e.orb = jitter(e.id, 4) * Math.PI * 2;
  initCooldowns(e);
  sim.enemies.push(e);
  sim.events.push({ type: 'spawn', id: e.id });
  return e;
}

/**
 * M12b: spawns `kind` and, for a pack kind (rats), the rest of its pack next to it (2D `spawnOne`:
 * one rat plus four within 24 px). Returns the first body; the others share its multipliers.
 */
export function spawnPack(sim: Sim, x: number, z: number, kind: EnemyKind, hpMul = 1, dmgMul = 1): Enemy {
  const lead = spawnEnemy(sim, x, z, kind, hpMul, dmgMul);
  const n = ENEMIES[kind].pack ?? 1, r = ENEMIES[kind].radius;
  for (let i = 1; i < n; i++) {
    let qx = x, qz = z;
    for (let tries = 0; tries < 6; tries++) {
      qx = x + sim.rng.range(-0.8, 0.8);
      qz = z + sim.rng.range(-0.8, 0.8);
      if (!sim.level.blocked(qx, qz, r) && !sim.level.near(qx, qz, r + 0.5).some((c) => colliderDistance(c, qx, qz) < r)) break;
      qx = x;
      qz = z;
    }
    spawnEnemy(sim, qx, qz, kind, hpMul, dmgMul);
  }
  return lead;
}

/** Turns a body into an elite (2D: ×2.6 life, bigger, Flink is faster). Crows and rats stay plain (2D). */
export function makeElite(sim: Sim, e: Enemy, mod: EliteMod = sim.rng.pick(ELITE_MODS)): void {
  if (e.def.boss || e.def.fly || e.def.pack) return;
  e.elite = mod;
  e.hp = e.maxHp = Math.round(e.maxHp * THREAT.eliteHp);
  e.def = { ...e.def, radius: e.def.radius * 1.15, speed: e.def.speed * (mod === 'flink' ? THREAT.eliteSpeed : 1) };
}

/** Two small bodies crawl out of a dying Spaltend elite (2D). */
export function splitElite(sim: Sim, e: Enemy): void {
  const S = THREAT.split;
  for (let i = 0; i < S.count; i++) {
    const m = spawnEnemy(sim, e.x + sim.rng.range(-0.5, 0.5), e.z + sim.rng.range(-0.5, 0.5), 'walker', e.hpMul * S.hp, e.dmgMul);
    m.def = { ...m.def, radius: m.def.radius * S.scale, scale: m.def.scale * S.scale };
    m.mini = true;
  }
}

/** A free spot inside the yard, away from the player. Used for the opening group and `?stress=`. */
export function randomYardSpot(sim: Sim, minPlayerDist: number): { x: number; z: number } {
  const p = sim.player;
  // Expedition maps: a ring around the player.
  const y = sim.level.expedition
    ? { minX: p.x - 14, maxX: p.x + 14, minZ: p.z - 12, maxZ: p.z + 12 }
    : sim.level.playerBox;
  for (let tries = 0; tries < 60; tries++) {
    const x = sim.rng.range(y.minX + 1, y.maxX - 1);
    const z = sim.rng.range(y.minZ + 1, y.maxZ - 1);
    if (Math.hypot(x - sim.player.x, z - sim.player.z) < minPlayerDist) continue;
    if (sim.level.near(x, z, 1).some((c) => colliderDistance(c, x, z) < 0.8) || sim.level.blocked(x, z, 0.8)) continue;
    return { x, z };
  }
  return { x: y.minX + 2, z: y.minZ + 2 };
}

export function aliveCount(sim: Sim): number {
  let n = 0;
  for (const e of sim.enemies) if (e.state !== 'dead' && e.sleep === undefined) n++; // Side passage guards (sleep set) never hold up a wave.
  return n;
}

/** Removes bodies whose death animation is over. */
export function removeCorpses(sim: Sim): void {
  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    const e = sim.enemies[i] as Enemy;
    if (e.state === 'dead' && e.stateT >= SPAWN.corpseTime) sim.enemies.splice(i, 1);
  }
}

/** Arena levels (and `?stress=`): keeps a growing number of enemies alive. */
export function updateSpawner(sim: Sim): void {
  if (sim.player.state === 'dead') return;
  sim.spawnT -= DT;
  const target = sim.stress > 0 ? sim.stress : Math.min(SPAWN.maxAlive, SPAWN.startAlive + Math.floor(sim.kills / SPAWN.killsPerStep));
  if (sim.spawnT > 0 || aliveCount(sim) >= target) return;
  sim.spawnT = sim.stress > 0 ? 0.08 : SPAWN.interval;
  if (sim.level.spawns.length === 0) {
    const s = randomYardSpot(sim, 8);
    spawnEnemy(sim, s.x, s.z);
    return;
  }
  const s = sim.rng.pick(sim.level.spawns);
  spawnEnemy(sim, s.x + sim.rng.range(-0.6, 0.6), s.z + sim.rng.range(-0.6, 0.6));
}

export function updateEnemies(sim: Sim): void {
  const p = sim.player;
  const playerAlive = p.state !== 'dead';
  for (const e of sim.enemies) {
    e.stateT += DT;
    const def = e.def;
    const toX = p.x - e.x;
    const toZ = p.z - e.z;
    const dist = Math.hypot(toX, toZ);
    let vx = 0;
    let vz = 0;

    // Bosses rage below half life: faster, and their specials come quicker (2D).
    if (def.boss && !e.rage && e.state !== 'dead' && e.hp < e.maxHp * BOSS.rageAt) {
      e.rage = true;
      e.def = { ...def, speed: def.speed * BOSS.rageSpeed };
      sim.events.push({ type: 'bossRage', id: e.id, name: def.name });
    }
    if (e.buff > 0) e.buff -= DT;
    if (e.state !== 'dead') {
      tickCooldowns(e);
      if (def.boss) passive(sim, e);
    }

    switch (e.state) {
      case 'chase': {
        if (e.sleep) {
          if (dist > e.sleep && e.hp >= e.maxHp) break;
          e.sleep = 0;
          if (e.pose === 'lying') e.rise = THREAT.rise;
          sim.events.push({ type: 'note', text: '!', color: '#f2d14b', x: e.x, z: e.z });
        }
        // A lying guard gets up first (the body rises from the ground), then fights.
        if (e.rise !== undefined && e.rise > 0) { e.rise = Math.max(0, e.rise - DT); break; }
        // Punish window: the body stands open.
        if (e.open > 0) {
          e.open -= DT;
          break;
        }
        const plan = think(sim, e, dist, toX, toZ);
        if ((e.state as string) !== 'chase') break;
        if (playerAlive && plan.melee && dist <= def.attackRange) {
          e.state = 'windup';
          e.stateT = 0;
          e.struck = false;
          sim.events.push({ type: 'enemyWindup', id: e.id });
          break;
        }
        if (!playerAlive && dist < 2.5) break;
        if (plan.mode === 'hold') break;
        if (plan.mode === 'dir') {
          dir.x = plan.x;
          dir.z = plan.z;
        } else if (def.fly || dist < 1.5 || (dist < 7 && sim.flow.clearLine(e.x, e.z, p.x, p.z)) || !sim.flow.sample(e.x, e.z, dir)) {
          // Walk straight when the way is clear, else follow the field.
          dir.x = toX / (dist || 1);
          dir.z = toZ / (dist || 1);
        }
        if (plan.turn) {
          const c = Math.cos(plan.turn), sn = Math.sin(plan.turn), x0 = dir.x;
          dir.x = x0 * c + dir.z * sn;
          dir.z = dir.z * c - x0 * sn;
        }
        // Separation: steer away from close neighbors so the pack surrounds instead of stacking.
        let sx = 0;
        let sz = 0;
        if (!def.fly) for (const o of sim.enemies) {
          if (o === e || o.state === 'dead' || o.def.fly) continue;
          const ox = e.x - o.x;
          const oz = e.z - o.z;
          const min = def.radius + o.def.radius + SEPARATION_PAD;
          const d2 = ox * ox + oz * oz;
          if (d2 >= min * min || d2 < 1e-8) continue;
          const d = Math.sqrt(d2);
          const w = (min - d) / min;
          sx += (ox / d) * w;
          sz += (oz / d) * w;
        }
        let mx = dir.x + sx * 1.6;
        let mz = dir.z + sz * 1.6;
        const ml = Math.hypot(mx, mz);
        if (ml > 1e-4) {
          mx /= ml;
          mz /= ml;
          const banner=sim.abilities.banner;
          // Standarte and Zersetzung slow by 30% each (2D).
          const slow=(banner&&Math.hypot(e.x-banner.x,e.z-banner.z)<banner.r?POWER.stand.slow:1)*(e.acid>0&&(sim.statContext.perks.corrode??0)>0?STATUS.corrodeSlow:1)*((e.slow??0)>0?.6:1);
          // M20: walkers wade through the flooded tunnel stretch like the hero; flyers do not.
          const v = def.speed * slow * plan.speed * (e.buff > 0 ? THREAT.buffSpeed : 1) * (def.fly ? 1 : sim.level.speedAt(e.x, e.z));
          vx = mx * v;
          vz = mz * v;
          // Crows and backing spitters keep looking at the hero.
          e.facing = turnToward(e.facing, plan.mode === 'dir' && !(def.fly && e.rest <= 0) ? angleOf(toX, toZ) : angleOf(mx, mz), 7 * DT);
        }
        break;
      }
      case 'special':
        runSpecial(sim, e, dir);
        vx = dir.x;
        vz = dir.z;
        break;
      case 'windup':
        // Track the player early, then commit so a dodge can beat the strike.
        if (e.stateT < def.windup * 0.6) e.facing = turnToward(e.facing, angleOf(toX, toZ), 4 * DT);
        if (e.stateT >= def.windup) {
          e.state = 'strike';
          e.stateT = 0;
          sim.events.push({ type: 'enemyStrike', id: e.id });
        }
        break;
      case 'strike': {
        const lunge = 0.45 / def.active;
        vx = Math.sin(e.facing) * lunge;
        vz = Math.cos(e.facing) * lunge;
        if (e.stateT >= def.active) {
          e.state = 'recover';
          e.stateT = 0;
        }
        break;
      }
      case 'recover':
        if (e.stateT >= def.recovery) {
          e.state = 'chase';
          e.stateT = 0;
        }
        break;
      case 'stagger':
        if (e.stateT >= e.staggerDur) {
          e.state = 'chase';
          e.stateT = 0;
        }
        break;
      case 'dead':
        break;
    }

    e.speed = Math.hypot(vx, vz);
    e.x += (vx + e.kx) * DT;
    e.z += (vz + e.kz) * DT;
    const damp = Math.exp(-KNOCK_DAMP * DT);
    e.kx *= damp;
    e.kz *= damp;
    if (!def.fly && (e.state !== 'dead' || Math.abs(e.kx) + Math.abs(e.kz) > 0.05)) {
      sim.level.resolve(e, e.def.radius);
    }
    const b = sim.level.bounds;
    e.x = clamp(e.x, b.minX + def.radius, b.maxX - def.radius);
    e.z = clamp(e.z, b.minZ + def.radius, b.maxZ - def.radius);
  }
}

/** Hard body separation: enemies against each other and against the player. */
export function resolveBodies(sim: Sim): void {
  const list = sim.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i] as Enemy;
    if (a.state === 'dead' || a.def.fly) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j] as Enemy;
      if (b.state === 'dead' || b.def.fly) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const min = a.def.radius + b.def.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.001;
      const push = min - d;
      // Heavier (bigger) bodies move less.
      const ma = a.def.radius * a.def.radius;
      const mb = b.def.radius * b.def.radius;
      const wa = mb / (ma + mb);
      a.x -= (dx / d) * push * wa;
      a.z -= (dz / d) * push * wa;
      b.x += (dx / d) * push * (1 - wa);
      b.z += (dz / d) * push * (1 - wa);
    }
  }
  const p = sim.player;
  // The dodge passes through enemies; a dead player is no obstacle.
  // Leaps and the Fechtsprung pass over and through bodies too.
  const through = p.state === 'cast' && p.cast !== null && (p.cast.id === 'fecht' || p.cast.id === 'abriss' || p.cast.id === 'stab');
  if (p.state !== 'dodge' && p.state !== 'dead' && !through) {
    for (const e of list) {
      // Flying bodies and rushes pass the hero (a rush hits on contact instead).
      if (e.state === 'dead' || e.def.fly || isRush(e)) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const min = e.def.radius + PLAYER.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.001;
      const push = min - d;
      const we = e.def.poise ? 0.3 : 0.6;
      e.x += (dx / d) * push * we;
      e.z += (dz / d) * push * we;
      p.x -= (dx / d) * push * (1 - we);
      p.z -= (dz / d) * push * (1 - we);
    }
    sim.level.resolve(p, PLAYER.radius);
  }
  // Separation may have pushed a body into a wall or prop: walls win over crowding.
  for (const e of list) {
    if (e.state !== 'dead' && !e.def.fly) sim.level.resolve(e, e.def.radius);
  }
}
