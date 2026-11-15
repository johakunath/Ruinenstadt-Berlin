// Player state machine: move, 3-hit chain, dodge with i-frames, dash strike.
import { ATTACKS, PLAYER, type AttackId } from '../data/combat';
import type { Level } from './level';
import { angleDiff, angleOf, clamp, turnToward } from './math';
import { DT, type Player, type Sim, type SimInput } from './types';
import { keepInArena } from './director';

/** Gap between the last active frame and the earliest chained attack. */
const CHAIN_GAP = 0.04;

export function createPlayer(level: Level, at = level.start): Player {
  const { x, z } = at;
  return {
    x, z, px: x, pz: z, facing: Math.PI, pfacing: Math.PI, vx: 0, vz: 0,
    hp: PLAYER.maxHp, state: 'move', stateT: 0,
    attack: null, swing: 0, hits: [], chain: null, chainT: 0,
    dodgeX: 0, dodgeZ: 0, dodgeCd: 0, invuln: 0, strikeT: 0, hurtT: 99,
    sweeping: false, sweepLo: 0, sweepHi: 0,
  };
}

/** Attack direction: aim, else stick, else facing; with soft lock-on when asked. */
function attackFacing(sim: Sim, inp: SimInput): number {
  const p = sim.player;
  let dir = p.facing;
  if (inp.aimX !== 0 || inp.aimZ !== 0) dir = angleOf(inp.aimX, inp.aimZ);
  else if (inp.moveX !== 0 || inp.moveZ !== 0) dir = angleOf(inp.moveX, inp.moveZ);
  if (!inp.aimAssist) return dir;
  let best = dir;
  let bestScore = Infinity;
  for (const e of sim.enemies) {
    if (e.state === 'dead') continue;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > PLAYER.aimAssistRange) continue;
    const a = angleOf(dx, dz);
    const off = Math.abs(angleDiff(dir, a));
    // A body that fills the cone at close range still counts.
    if (off - Math.asin(Math.min(1, e.def.radius / Math.max(dist, 0.01))) > PLAYER.aimAssistCone) continue;
    const score = dist + off * 2;
    if (score < bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

function startAttack(sim: Sim, inp: SimInput, id: AttackId): void {
  const p = sim.player;
  const def = ATTACKS[id];
  p.facing = attackFacing(sim, inp);
  p.state = 'attack';
  p.stateT = 0;
  p.attack = def;
  p.swing++;
  p.hits.length = 0;
  p.chain = null;
  p.chainT = 0;
  p.strikeT = 0;
  sim.consumed.attack = true;
  sim.events.push({ type: 'swing', attack: id, weight: def.weight });
}

function startDodge(sim: Sim, inp: SimInput): void {
  const p = sim.player;
  let dx = inp.moveX;
  let dz = inp.moveZ;
  const len = Math.hypot(dx, dz);
  if (len > 0.2) {
    dx /= len;
    dz /= len;
  } else {
    dx = Math.sin(p.facing);
    dz = Math.cos(p.facing);
  }
  p.state = 'dodge';
  p.stateT = 0;
  p.attack = null;
  p.sweeping = false;
  p.chain = null;
  p.chainT = 0;
  p.dodgeX = dx;
  p.dodgeZ = dz;
  p.facing = angleOf(dx, dz);
  p.invuln = Math.max(p.invuln, PLAYER.dodge.iframes);
  sim.consumed.dodge = true;
  sim.events.push({ type: 'dodge' });
}

function endToMove(p: Player): void {
  p.state = 'move';
  p.stateT = 0;
  p.attack = null;
  p.sweeping = false;
}

export function updatePlayer(sim: Sim, inp: SimInput): void {
  const p = sim.player;
  p.stateT += DT;
  p.hurtT += DT;
  p.dodgeCd = Math.max(0, p.dodgeCd - DT);
  p.invuln = Math.max(0, p.invuln - DT);
  p.strikeT = Math.max(0, p.strikeT - DT);
  p.chainT = Math.max(0, p.chainT - DT);

  if (p.state === 'dead') {
    p.vx *= 0.8;
    p.vz *= 0.8;
    integrate(sim);
    return;
  }

  // Timed state ends first, so a buffered press can fire on the first legal step.
  if (p.state === 'attack' && p.attack) {
    const a = p.attack;
    if (p.stateT >= a.windup + a.active + a.recovery) {
      p.chain = a.next;
      p.chainT = a.next ? PLAYER.comboGrace : 0;
      endToMove(p);
    }
  } else if (p.state === 'dodge' && p.stateT >= PLAYER.dodge.duration) {
    p.dodgeCd = PLAYER.dodge.cooldown;
    p.strikeT = PLAYER.dodge.strikeGrace;
    endToMove(p);
  }

  // Buffered actions. Dodge wins over attack when both are waiting.
  const pastDamage = p.state === 'attack' && p.attack !== null && p.stateT >= p.attack.windup + p.attack.active;
  if (inp.dodge && p.dodgeCd <= 0 && (p.state === 'move' || pastDamage)) {
    startDodge(sim, inp);
  } else if (inp.attack) {
    if (p.state === 'move') {
      startAttack(sim, inp, p.strikeT > 0 ? 'dash' : p.chainT > 0 && p.chain ? p.chain : 'light1');
    } else if (p.state === 'dodge') {
      if (p.stateT >= PLAYER.dodge.duration * PLAYER.dodge.strikeFrom) {
        p.dodgeCd = PLAYER.dodge.cooldown;
        startAttack(sim, inp, 'dash');
      }
    } else if (p.state === 'attack' && p.attack?.next && p.stateT >= p.attack.windup + p.attack.active + CHAIN_GAP) {
      startAttack(sim, inp, p.attack.next);
    }
  }

  if (p.state === 'move') {
    const len = Math.hypot(inp.moveX, inp.moveZ);
    const scale = len > 1 ? 1 / len : 1;
    // Brief slow after taking a hit instead of a stun: attacks and dodges are never interrupted.
    const slow = p.hurtT < PLAYER.hitStun ? 0.45 : 1;
    const tx = inp.moveX * scale * PLAYER.speed * slow;
    const tz = inp.moveZ * scale * PLAYER.speed * slow;
    // Linear ramp: full speed (or a full stop) within `accelTime`.
    const dvx = tx - p.vx;
    const dvz = tz - p.vz;
    const dv = Math.hypot(dvx, dvz);
    const maxDv = (PLAYER.speed * DT) / PLAYER.accelTime;
    const k = dv > maxDv ? maxDv / dv : 1;
    p.vx += dvx * k;
    p.vz += dvz * k;
    if (len > 0.1) p.facing = turnToward(p.facing, angleOf(inp.moveX, inp.moveZ), PLAYER.turnRate * DT);
  } else if (p.state === 'attack' && p.attack) {
    const a = p.attack;
    const lungeTime = a.windup + a.active;
    const v = p.stateT <= lungeTime ? a.lunge / lungeTime : 0;
    p.vx = Math.sin(p.facing) * v;
    p.vz = Math.cos(p.facing) * v;
  } else if (p.state === 'dodge') {
    const v = PLAYER.dodge.distance / PLAYER.dodge.duration;
    p.vx = p.dodgeX * v;
    p.vz = p.dodgeZ * v;
  }
  integrate(sim);
}

function integrate(sim: Sim): void {
  const p = sim.player;
  p.x += p.vx * DT;
  p.z += p.vz * DT;
  sim.level.resolve(p, PLAYER.radius);
  const y = sim.level.playerBox;
  p.x = clamp(p.x, y.minX + PLAYER.radius, y.maxX - PLAYER.radius);
  p.z = clamp(p.z, y.minZ + PLAYER.radius, y.maxZ - PLAYER.radius);
  keepInArena(sim, p, PLAYER.radius);
}
