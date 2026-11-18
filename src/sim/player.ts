// Player state machine: move, 3-hit chain, dodge with i-frames, dash strike.
import { finisherOf, weaponAttack, PLAYER, WEAPON, type AttackId } from '../data/combat';
import { POWER } from '../data/powers';
import { CONSUMABLE, onDodge, shock, shoot, updateCast } from './abilities';
import { hasL, knock, pk, STATUS } from './combat';
import type { Level } from './level';
import { angleDiff, angleOf, clamp, turnToward } from './math';
import { DT, type Player, type Sim, type SimInput } from './types';
import { dodgeCooldown, STARTER_DAMAGE } from './loadout';

/** What a swing releases when its active frames start: shots, the hammer's rings, the thrown spear. */
export function releaseSwing(sim: Sim): void {
  const p = sim.player;
  const a = p.attack;
  if (!a) return;
  const kind = sim.stats.kind;
  const fin = p.finisher;
  const fx = Math.sin(p.facing);
  const fz = Math.cos(p.facing);
  // Siegessäule: every attack also sends a golden blade (half damage, burns, passes two bodies).
  if (hasL(sim, 'siegsp')) shoot(sim, { angle: p.facing, damage: a.damage * 0.5, crit: p.critical, speed: WEAPON.sling.speed * sim.stats.reachFactor, life: 0.55, pierce: 2, kind: 'nail', fire: true });
  // Mauerstück: every fourth melee attack sends an acid wave.
  if (kind !== 'sling' && hasL(sim, 'mauer') && ++sim.abilities.legSwings % 4 === 0) shock(sim, p.x, p.z, 130 / 30, { mul: 1.2, stun: 0, knock: knock(200), acid: true, kind: 'acid' });
  if (kind === 'sling') {
    const S = WEAPON.sling;
    const speed = S.speed * sim.stats.reachFactor * (fin ? S.finSpeed : 1);
    if (fin && pk(sim, 'm_salve')) {
      // Schnellfeuer: the finisher is a fan of five.
      const V = WEAPON.umbau.salve;
      for (let i = 0; i < V.count; i++) shoot(sim, { angle: p.facing + (i - (V.count - 1) / 2) * V.spread, damage: a.damage * V.damage, crit: p.critical, speed, life: S.finLife, pierce: 1, wucht: p.wucht });
    } else if (pk(sim, 'm_schrot')) {
      for (const o of [-S.schrot.spread, 0, S.schrot.spread]) shoot(sim, { angle: p.facing + o, damage: a.damage * S.schrot.damage, crit: p.critical, speed, life: fin ? S.schrot.finLife : S.schrot.life, pierce: fin ? S.schrot.finPierce : 0, wucht: p.wucht });
    } else {
      shoot(sim, { angle: p.facing, damage: a.damage, crit: p.critical, speed, life: fin ? S.finLife : S.life, pierce: fin ? S.finPierce : 0, wucht: p.wucht });
    }
    return;
  }
  if (kind === 'hammer') {
    const H = WEAPON.hammer;
    // Erdbeben: the finisher ring is twice as wide and stuns for a second.
    const beben = pk(sim, 'm_beben') > 0;
    if (fin) shock(sim, p.x + fx * H.shock.ahead, p.z + fz * H.shock.ahead, H.shock.radius * (beben ? WEAPON.umbau.bebenRadius : 1), { mul: H.shock.damage, stun: beben ? WEAPON.umbau.bebenStun : H.shock.stun, knock: knock(260), kind: beben ? 'earth' : 'small' });
    // Wurfhammer: the finisher also throws the hammer through three bodies.
    if (fin && pk(sim, 'm_wurf')) { const W = WEAPON.umbau.wurf; shoot(sim, { angle: p.facing, damage: a.damage * W.damage, crit: p.critical, speed: W.speed, life: W.life, pierce: W.pierce, kind: 'spear' }); }
    if (pk(sim, 'm_dampf')) shock(sim, p.x + fx * H.dampf.ahead, p.z + fz * H.dampf.ahead, H.dampf.radius, { mul: H.dampf.damage, stun: 0, knock: knock(140), kind: 'small' });
  }
  if (kind === 'spear' && fin && pk(sim, 'm_spiess')) {
    const T = WEAPON.spear.spiess;
    shoot(sim, { angle: p.facing, damage: a.damage * T.damage, crit: p.critical, speed: T.speed, life: T.life, pierce: T.pierce, kind: 'spear' });
  }
}

/** Gap between the last active frame and the earliest chained attack. */
const CHAIN_GAP = 0.04;

export function createPlayer(level: Level, at = level.start): Player {
  const { x, z } = at;
  return {
    x, z, px: x, pz: z, facing: Math.PI, pfacing: Math.PI, vx: 0, vz: 0,
    hp: PLAYER.maxHp, state: 'move', stateT: 0,
    attack: null, cast: null, finisher: false, wucht: false, attackSpeed: 1, critical: false, swing: 0, hits: [], propHits: [], chain: null, chainT: 0,
    dodgeX: 0, dodgeZ: 0, dodgeCd: 0, invuln: 0, strikeT: 0, hurtT: 99,
    sweeping: false, sweepLo: 0, sweepHi: 0, kx: 0, kz: 0, root: 0, rootBy: 0,
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
  const kind = sim.stats.kind;
  const a = sim.abilities;
  const def = weaponAttack(kind, id);
  const fin = id === finisherOf(kind);
  // Trommelfeuer: the finisher comes one swing earlier.
  if (pk(sim, 'combo') && id === 'light1') def.next = 'light3';
  // Rundumschlag: the blade finisher hits all around.
  if (fin && kind === 'blade' && pk(sim, 'm_rund')) Object.assign(def, { from: -Math.PI, to: Math.PI, reach: def.reach * 1.2, style: 'slash' });
  const U = WEAPON.umbau;
  // Sturmklinge: every swing carries the hero forward.
  if (kind === 'blade' && pk(sim, 'm_sturm')) def.lunge += U.sturmLunge;
  // Doppelklinge: two hits of 60% each (`playerSweep` strikes twice).
  if (kind === 'blade' && pk(sim, 'm_doppel')) def.damage *= U.doppel;
  // Fegestoß: thrusts become wide sweeps, a little shorter.
  if (kind === 'spear' && pk(sim, 'm_fege') && !fin && id !== 'dash') {
    // The sweep plays the blade's slash clips (a thrust clip would not match the arc).
    const b = weaponAttack('blade', id);
    const left = id === 'light2';
    Object.assign(def, { from: left ? U.fege.half : -U.fege.half, to: left ? -U.fege.half : U.fege.half, reach: def.reach * U.fege.reach, style: 'slash', active: def.active * 1.4,
      clip: b.clip, clipStart: b.clipStart, clipSwing: b.clipSwing, clipHit: b.clipHit, rec: b.rec });
  }
  // Sturmlanze: right after a dodge, thrusts hit twice as hard and reach further.
  if (kind === 'spear' && pk(sim, 'm_lanze') && a.hus > 0) Object.assign(def, { damage: def.damage * U.lanze.damage, reach: def.reach * U.lanze.reach });
  const frenzy = a.frenzy > 0;
  // Säbeltanz: wider and longer swings.
  if (frenzy && def.style !== 'throw') def.reach *= 1.2;
  p.facing = attackFacing(sim, inp);
  p.state = 'attack';
  p.stateT = 0;
  p.cast = null;
  // Keep pose, hitbox, lunge and damage on one immutable swing snapshot.
  const speed = sim.stats.attackSpeed * (frenzy ? POWER.saebel.speed : 1) * (1 + STATUS.jagdStep * a.jagd.n);
  p.attackSpeed = speed;
  // Gegengewicht: every n-th attack is a Wucht hit (sure crit, double knockback, short stun).
  p.wucht = sim.stats.weight > 0 && ++a.swings % sim.stats.weight === 0;
  p.finisher = fin;
  // Weltzeituhr: the first attack after a dodge always crits.
  const armed = a.dcrit;
  a.dcrit = false;
  p.critical = p.wucht || frenzy || armed || (fin && pk(sim, 'pauke') > 0) || sim.rng.next() < sim.stats.crit;
  const mul = (p.critical ? 2 : 1) * (a.fed > 0 ? CONSUMABLE.food.damage : 1) * (a.hus > 0 ? 1 + 0.4 * pk(sim, 'husar') : 1) * (a.ret ? 2 : 1);
  if (a.ret) sim.events.push({ type: 'note', text: 'Retourkutsche', color: '#9aa4b0', x: p.x, z: p.z });
  if (p.wucht) sim.events.push({ type: 'note', text: 'Wucht', color: '#f2a04b', x: p.x, z: p.z });
  a.ret = false;
  p.attack = { ...def, windup: def.windup / speed, active: def.active / speed, recovery: def.recovery / speed,
    reach: def.reach * sim.stats.reachFactor,
    knockback: def.knockback * (fin ? WEAPON.finisherKnock : 1) * (p.wucht ? WEAPON.wucht.knock : 1),
    damage: def.damage * mul * sim.stats.damage / STARTER_DAMAGE };
  p.swing++;
  p.hits.length = 0;
  p.propHits.length = 0;
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
  p.cast = null;
  // M12c: a roll breaks free of a grab.
  p.root = 0;
  p.rootBy = 0;
  onDodge(sim);
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
  p.root = Math.max(0, p.root - DT);

  if (p.state === 'dead') {
    p.root = 0;
    p.rootBy = 0;
    p.vx *= 0.8;
    p.vz *= 0.8;
    integrate(sim);
    return;
  }

  p.hp = Math.min(sim.stats.maxHp, p.hp + sim.stats.regen * DT);

  // Timed state ends first, so a buffered press can fire on the first legal step.
  if (p.state === 'attack' && p.attack) {
    const a = p.attack;
    if (p.stateT >= a.windup + a.active + a.recovery) {
      p.chain = a.next;
      p.chainT = a.next ? PLAYER.comboGrace : 0;
      endToMove(p);
    }
  } else if (p.state === 'dodge' && p.stateT >= PLAYER.dodge.duration) {
    // Rittersporn: the ground shakes where a dodge ends.
    if (hasL(sim, 'ritter')) shock(sim, p.x, p.z, 110 / 30, { mul: 0.7, stun: 0.5, knock: knock(260), kind: 'small' });
    p.dodgeCd = dodgeCooldown(sim);
    p.strikeT = PLAYER.dodge.strikeGrace;
    endToMove(p);
  }

  // A cast (power, throw) runs on its own; a dodge cancels the rest once its effect is out.
  if (p.state === 'cast') {
    const c = p.cast;
    const leaping = c !== null && (c.id === 'abriss' || c.id === 'stab' || c.id === 'fecht');
    if (inp.dodge && p.dodgeCd <= 0 && c !== null && c.fired && !leaping) startDodge(sim, inp);
    else {
      updateCast(sim);
      if (!leaping || p.state !== 'cast') integrate(sim);
      return;
    }
  }

  // Buffered actions. Dodge wins over attack when both are waiting.
  const pastDamage = p.state === 'attack' && p.attack !== null && p.stateT >= p.attack.windup + p.attack.active;
  if (inp.dodge && p.dodgeCd <= 0 && (p.state === 'move' || pastDamage)) {
    startDodge(sim, inp);
  } else if (inp.attack && sim.abilities.spin <= 0) {
    if (p.state === 'move') {
      startAttack(sim, inp, p.strikeT > 0 ? 'dash' : p.chainT > 0 && p.chain ? p.chain : 'light1');
    } else if (p.state === 'dodge') {
      if (p.stateT >= PLAYER.dodge.duration * PLAYER.dodge.strikeFrom) {
        p.dodgeCd = dodgeCooldown(sim);
        startAttack(sim, inp, 'dash');
      }
    } else if (p.state === 'attack' && p.attack?.next && p.stateT >= p.attack.windup + p.attack.active + CHAIN_GAP / p.attackSpeed) {
      startAttack(sim, inp, p.attack.next);
    }
  }

  if (p.state === 'move') {
    const len = Math.hypot(inp.moveX, inp.moveZ);
    const scale = len > 1 ? 1 / len : 1;
    // Brief slow after taking a hit instead of a stun: attacks and dodges are never interrupted.
    // M20: wading through the flooded tunnel stretch (2D `P.wet`).
    // M12c: held by the Türsteher, no walking (turning, attacks and powers still work).
    const slow = (p.hurtT < PLAYER.hitStun ? 0.45 : 1) * (sim.abilities.guard > 0 ? POWER.gully.slow : 1) * sim.level.speedAt(p.x, p.z) * (p.root > 0 ? 0 : 1);
    const tx = inp.moveX * scale * PLAYER.speed * sim.stats.moveSpeed * slow;
    const tz = inp.moveZ * scale * PLAYER.speed * sim.stats.moveSpeed * slow;
    // Linear ramp: full speed (or a full stop) within `accelTime`.
    const dvx = tx - p.vx;
    const dvz = tz - p.vz;
    const dv = Math.hypot(dvx, dvz);
    const maxDv = (PLAYER.speed * sim.stats.moveSpeed * DT) / PLAYER.accelTime;
    const k = dv > maxDv ? maxDv / dv : 1;
    p.vx += dvx * k;
    p.vz += dvz * k;
    if (len > 0.1) p.facing = turnToward(p.facing, angleOf(inp.moveX, inp.moveZ), PLAYER.turnRate * DT);
  } else if (p.state === 'attack' && p.attack) {
    const a = p.attack;
    const lungeTime = a.windup + a.active;
    const v = p.stateT <= lungeTime && p.root <= 0 ? a.lunge / lungeTime : 0;
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
  let sx = p.vx * DT, sz = p.vz * DT;
  if (p.kx !== 0 || p.kz !== 0) {
    // M12c shove on top of the own motion, capped per step so walls still hold.
    const cap = Math.max(PLAYER.maxStep, Math.hypot(sx, sz));
    sx += p.kx * DT;
    sz += p.kz * DT;
    const l = Math.hypot(sx, sz);
    if (l > cap) { sx *= cap / l; sz *= cap / l; }
    const damp = Math.exp(-PLAYER.pushDamp * DT);
    p.kx *= damp;
    p.kz *= damp;
    if (Math.abs(p.kx) + Math.abs(p.kz) < 0.05) p.kx = p.kz = 0;
  }
  p.x += sx;
  p.z += sz;
  sim.level.resolve(p, PLAYER.radius);
  const y = sim.level.playerBox;
  p.x = clamp(p.x, y.minX + PLAYER.radius, y.maxX - PLAYER.radius);
  p.z = clamp(p.z, y.minZ + PLAYER.radius, y.maxZ - PLAYER.radius);
}
