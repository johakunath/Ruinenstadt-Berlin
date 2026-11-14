// Enemy behavior: chase along the flow field with separation, wind up, strike, recover, stagger, die.
import { PLAYER } from '../data/combat';
import { ENEMIES, SPAWN, type EnemyKind } from '../data/enemies';
import { COURTYARD } from '../data/courtyard';
import { colliderDistance, resolveStatic } from './collide';
import { angleOf, clamp, turnToward } from './math';
import { DT, type Enemy, type Sim } from './types';

const KNOCK_DAMP = 9;
const SEPARATION_PAD = 0.25;
const dir = { x: 0, z: 0 };

function pickKind(sim: Sim): EnemyKind {
  const kinds = Object.values(ENEMIES);
  let total = 0;
  for (const k of kinds) total += k.weight;
  let roll = sim.rng.next() * total;
  for (const k of kinds) {
    roll -= k.weight;
    if (roll <= 0) return k.kind;
  }
  return 'walker';
}

export function spawnEnemy(sim: Sim, x: number, z: number, kind: EnemyKind = pickKind(sim)): Enemy {
  const def = ENEMIES[kind];
  const facing = angleOf(sim.player.x - x, sim.player.z - z);
  const e: Enemy = {
    id: sim.nextId++, kind, def, x, z, px: x, pz: z, facing, pfacing: facing,
    kx: 0, kz: 0, speed: 0, hp: def.hp, state: 'chase', stateT: 0, staggerDur: 0, struck: false,
  };
  sim.enemies.push(e);
  sim.events.push({ type: 'spawn', id: e.id });
  return e;
}

/** A free spot inside the yard, away from the player. Used for the opening group and `?stress=`. */
export function randomYardSpot(sim: Sim, minPlayerDist: number): { x: number; z: number } {
  const y = COURTYARD.yard;
  for (let tries = 0; tries < 60; tries++) {
    const x = sim.rng.range(y.minX + 1, y.maxX - 1);
    const z = sim.rng.range(y.minZ + 1, y.maxZ - 1);
    if (Math.hypot(x - sim.player.x, z - sim.player.z) < minPlayerDist) continue;
    if (sim.colliders.some((c) => colliderDistance(c, x, z) < 0.8)) continue;
    return { x, z };
  }
  return { x: y.minX + 2, z: y.minZ + 2 };
}

export function aliveCount(sim: Sim): number {
  let n = 0;
  for (const e of sim.enemies) if (e.state !== 'dead') n++;
  return n;
}

export function updateSpawner(sim: Sim): void {
  // Remove bodies whose death animation is over.
  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    const e = sim.enemies[i] as Enemy;
    if (e.state === 'dead' && e.stateT >= SPAWN.corpseTime) sim.enemies.splice(i, 1);
  }
  if (sim.player.state === 'dead') return;
  sim.spawnT -= DT;
  const target = sim.stress > 0 ? sim.stress : Math.min(SPAWN.maxAlive, SPAWN.startAlive + Math.floor(sim.kills / SPAWN.killsPerStep));
  if (sim.spawnT > 0 || aliveCount(sim) >= target) return;
  sim.spawnT = sim.stress > 0 ? 0.08 : SPAWN.interval;
  const s = sim.rng.pick(COURTYARD.spawns);
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

    switch (e.state) {
      case 'chase': {
        if (playerAlive && dist <= def.attackRange) {
          e.state = 'windup';
          e.stateT = 0;
          e.struck = false;
          sim.events.push({ type: 'enemyWindup', id: e.id });
          break;
        }
        if (!playerAlive && dist < 2.5) break;
        // Walk straight when the way is clear, else follow the field.
        if (dist < 1.5 || (dist < 7 && sim.flow.clearLine(e.x, e.z, p.x, p.z)) || !sim.flow.sample(e.x, e.z, dir)) {
          dir.x = toX / (dist || 1);
          dir.z = toZ / (dist || 1);
        }
        // Separation: steer away from close neighbors so the pack surrounds instead of stacking.
        let sx = 0;
        let sz = 0;
        for (const o of sim.enemies) {
          if (o === e || o.state === 'dead') continue;
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
          vx = mx * def.speed;
          vz = mz * def.speed;
          e.facing = turnToward(e.facing, angleOf(mx, mz), 7 * DT);
        }
        break;
      }
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
    if (e.state !== 'dead' || Math.abs(e.kx) + Math.abs(e.kz) > 0.05) resolveStatic(e, def.radius, sim.colliders);
    const b = COURTYARD.bounds;
    e.x = clamp(e.x, b.minX + def.radius, b.maxX - def.radius);
    e.z = clamp(e.z, b.minZ + def.radius, b.maxZ - def.radius);
  }
}

/** Hard body separation: enemies against each other and against the player. */
export function resolveBodies(sim: Sim): void {
  const list = sim.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i] as Enemy;
    if (a.state === 'dead') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j] as Enemy;
      if (b.state === 'dead') continue;
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
  if (p.state === 'dodge' || p.state === 'dead') return;
  for (const e of list) {
    if (e.state === 'dead') continue;
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
  resolveStatic(p, PLAYER.radius, sim.colliders);
}
