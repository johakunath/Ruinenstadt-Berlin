// Enemy brains (M12; 2D enemy block in js/update.js): what each type does beyond walking up and
// striking. A special is always wind-up (readable on the ground), action, then a punish window
// in which the body stands open. Bosses run two or three specials on their own cooldowns.
// M12b (Xhain): rats zig-zag in; Grenzer, Brandmeister, Rattenmutter and Spreehexe reuse the blocks
// (barrage, ring, summon, slam, flame, roar, hazards) plus a five-shot volley and Molotov circles.
import { BOSS, ENEMIES, THREAT, type EliteMod, type EnemyKind } from '../data/enemies';
import { freeSpot } from './reach';
import { addHazard, addZone, fireShot, threatHit, type Special, type SpecialKind } from './threats';
import { PLAYER } from '../data/combat';
import { spawnEnemy } from './enemies';
import { angleOf } from './math';
import { DT, type Enemy, type Sim } from './types';

/** What `think` wants the body to do this step while it is in `chase`. */
export interface Plan {
  /** `flow`: walk to the hero (flow field); `dir`: walk along x, z; `hold`: stand. */
  mode: 'flow' | 'dir' | 'hold';
  x: number;
  z: number;
  /** Speed factor. */
  speed: number;
  /** May start its melee strike when in range. */
  melee: boolean;
  /** Turns the walking direction by this angle (rats zig-zag). */
  turn: number;
}
const plan: Plan = { mode: 'flow', x: 0, z: 0, speed: 1, melee: true, turn: 0 };

const SPECIAL: Record<SpecialKind, { wind: number; go: number; open: number; speed?: number }> = {
  spit: { wind: THREAT.spit.wind, go: 0.25, open: 0 },
  fan: { wind: THREAT.fan.wind, go: 0.25, open: THREAT.fan.open },
  pounce: { wind: THREAT.pounce.wind, go: THREAT.pounce.time, open: THREAT.pounce.open, speed: THREAT.pounce.speed },
  lunge: { wind: THREAT.lunge.wind, go: THREAT.lunge.time, open: THREAT.lunge.open, speed: THREAT.lunge.speed },
  dive: { wind: THREAT.dive.wind, go: THREAT.dive.time, open: 0, speed: THREAT.dive.speed },
  slam: { wind: THREAT.slam.wind, go: 0.3, open: THREAT.slam.open },
  stomp: { wind: THREAT.slam.wind, go: 0.3, open: THREAT.stomp.open },
  flame: { wind: THREAT.flame.wind, go: 0.3, open: THREAT.flame.open },
  bossSlam: { wind: BOSS.slam.wind, go: 0.35, open: 0 },
  charge: { wind: BOSS.charge.wind, go: BOSS.charge.time, open: BOSS.charge.open, speed: BOSS.charge.speed },
  summon: { wind: BOSS.summon.wind, go: 0.5, open: 0 },
  ring: { wind: BOSS.ring.wind, go: 0.4, open: 0 },
  roar: { wind: BOSS.roar.wind, go: 0.7, open: 0.6 },
  barrage: { wind: 0.6, go: 0.6, open: 0 },
  tail: { wind: BOSS.rex.tailWind, go: 0.3, open: 0.5 },
  volley: { wind: BOSS.grenzer.volleyWind, go: 0.25, open: 0 },
  molotov: { wind: 0.6, go: 0.5, open: 0 },
};

/** Specials that move the body along a locked line and hit on contact. */
const RUSH: Partial<Record<SpecialKind, number>> = { pounce: THREAT.pounce.damage, lunge: 0, dive: 0, charge: 0 };

export const isRush = (e: Enemy): boolean => e.state === 'special' && !!e.sp && e.sp.kind in RUSH && e.stateT >= e.sp.wind;

const damageOf = (e: Enemy, mul = 1): number => e.def.damage * e.dmgMul * mul;

function begin(sim: Sim, e: Enemy, kind: SpecialKind): void {
  const p = sim.player;
  const k = SPECIAL[kind];
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const d = Math.hypot(dx, dz) || 1;
  e.state = 'special';
  e.stateT = 0;
  e.sp = { kind, wind: k.wind, go: k.go, open: k.open, dx: dx / d, dz: dz / d, speed: k.speed ?? 0, fired: false, hit: false };
  e.facing = angleOf(dx, dz);
  const src = e.id;
  switch (kind) {
    case 'slam':
      addZone(sim, { x: p.x, z: p.z, r: THREAT.slam.radius, t: k.wind, max: k.wind, damage: damageOf(e, THREAT.slam.damage), floor: THREAT.slam.floor, kind: 'slam', src });
      break;
    case 'stomp':
      addZone(sim, { x: p.x, z: p.z, r: THREAT.stomp.radius, t: k.wind, max: k.wind, damage: damageOf(e, THREAT.stomp.damage), floor: THREAT.slam.floor, kind: 'slam', src });
      break;
    case 'flame':
      addZone(sim, { x: e.x, z: e.z, r: THREAT.flame.radius, t: k.wind, max: k.wind, damage: damageOf(e, THREAT.flame.damage), floor: THREAT.flame.floor, kind: 'flame', src });
      break;
    case 'bossSlam':
      addZone(sim, { x: p.x, z: p.z, r: BOSS.slam.radius, t: k.wind, max: k.wind, damage: damageOf(e, BOSS.slam.damage), floor: BOSS.slam.floor, kind: 'slam', src });
      break;
    case 'tail':
      addZone(sim, { x: e.x, z: e.z, r: BOSS.rex.tailRadius, t: k.wind, max: k.wind, damage: damageOf(e, 1), floor: BOSS.slam.floor, kind: 'tail', src });
      break;
    case 'barrage': {
      const B = BOSS.barrage;
      const n = (e.kind === 'grenzer' ? BOSS.grenzer.extra : BOSS.waechter.extra) + (e.rage ? 2 : 0);
      addZone(sim, { x: p.x, z: p.z, r: B.radius, t: B.wind, max: B.wind, damage: damageOf(e, B.damage), floor: B.floor, kind: 'bomb', src, free: true });
      for (let i = 0; i < n; i++) {
        const t = B.wind + (i + 1) * B.step;
        addZone(sim, { x: p.x + sim.rng.range(-B.spreadX, B.spreadX), z: p.z + sim.rng.range(-B.spreadZ, B.spreadZ), r: B.radius, t, max: t, damage: damageOf(e, B.damage), floor: B.floor, kind: 'bomb', src, free: true });
      }
      break;
    }
    case 'molotov': {
      // Bottles in the air: marked circles (the first on the hero) that burn on where they land.
      const M = BOSS.brandmeister;
      const leave = { r: M.fireRadius, t: M.fireTime, damage: damageOf(e, M.fireDamage), kind: 'fire' as const };
      for (let i = 0; i < M.bottles + (e.rage ? 1 : 0); i++) {
        const t = M.wind + i * M.step;
        const x = i ? p.x + sim.rng.range(-M.spread, M.spread) : p.x;
        const z = i ? p.z + sim.rng.range(-M.spread, M.spread) : p.z;
        addZone(sim, { x, z, r: M.radius, t, max: t, damage: damageOf(e, M.damage), floor: M.floor, kind: 'flame', src, free: true, leave });
      }
      break;
    }
    default:
      break;
  }
  sim.events.push({ type: 'enemySpecial', id: e.id, kind, phase: 'wind', x: e.x, z: e.z });
}

/** The release at the end of the wind-up. */
function release(sim: Sim, e: Enemy, sp: Special): void {
  const p = sim.player;
  const aim = angleOf(p.x - e.x, p.z - e.z);
  switch (sp.kind) {
    case 'spit':
      fireShot(sim, e, aim, THREAT.spit.speed, damageOf(e), THREAT.spit.life, THREAT.spit.radius);
      sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: false });
      break;
    case 'fan':
      for (const o of [-THREAT.fan.spread, 0, THREAT.fan.spread]) fireShot(sim, e, aim + o, THREAT.fan.speed, damageOf(e), THREAT.spit.life, THREAT.spit.radius);
      sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: false });
      break;
    case 'dive': {
      // The crow commits when it drops, not when it screeches.
      const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
      sp.dx = (p.x - e.x) / d;
      sp.dz = (p.z - e.z) / d;
      break;
    }
    case 'volley': {
      // A boss-strength fan: five rifle shots across the hero's line.
      const G = BOSS.grenzer;
      for (let i = 0; i < G.shots; i++) fireShot(sim, e, aim + (i - (G.shots - 1) / 2) * G.spread, G.volleySpeed, damageOf(e, G.volleyDamage), G.volleyLife, BOSS.ring.radius);
      sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: true });
      break;
    }
    case 'ring': {
      const n = RING_SHOTS[e.kind] ?? BOSS.waechter.shots;
      e.orb += 0.37;
      for (let i = 0; i < n; i++) fireShot(sim, e, (i / n) * Math.PI * 2 + e.orb, BOSS.ring.speed, damageOf(e, BOSS.ring.damage), BOSS.ring.life, BOSS.ring.radius);
      sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: true });
      break;
    }
    case 'roar': {
      const R = BOSS.roar;
      for (let i = 0; i < 2; i++) sim.threats.waves.push({ x: e.x, z: e.z, r: -i * R.gap, max: R.max, speed: R.speed, damage: damageOf(e, R.damage), floor: R.floor, width: R.width, hit: false });
      for (const o of sim.enemies) if (o !== e && o.state !== 'dead' && Math.hypot(o.x - e.x, o.z - e.z) < R.buffRange) o.buff = R.buff;
      if (e.kind === 'rex' && ++e.cycle % BOSS.rex.raptorsEvery === 0) summon(sim, e, 'raptor', 2);
      // Spreewelle: in rage the river washes rats up with every wave.
      if (e.kind === 'spreehexe' && e.rage) summon(sim, e, 'rat', BOSS.spreehexe.rageAdds);
      break;
    }
    case 'summon':
      if (e.kind === 'grenzer') {
        summon(sim, e, 'runner', BOSS.grenzer.adds);
        sim.events.push({ type: 'note', text: '„Alarm!“', color: '#f2d14b', x: e.x, z: e.z });
        break;
      }
      if (e.kind === 'rattenmutter') {
        summon(sim, e, 'rat', BOSS.rattenmutter.adds);
        break;
      }
      if (e.kind === 'feldwebel') summon(sim, e, 'walker', BOSS.feldwebel.adds);
      else summon(sim, e, e.rage ? 'runner' : 'walker', BOSS.hauptmann.adds);
      sim.events.push({ type: 'note', text: '„Antreten!“', color: '#f2d14b', x: e.x, z: e.z });
      break;
    default:
      break;
  }
  sim.events.push({ type: 'enemySpecial', id: e.id, kind: sp.kind, phase: 'go', x: e.x, z: e.z });
}

/** Shots in a boss's ring (default: the Turmwächter's twelve). */
const RING_SHOTS: Partial<Record<EnemyKind, number>> = { hauptmann: BOSS.hauptmann.shots, brandmeister: BOSS.brandmeister.shots, spreehexe: BOSS.spreehexe.shots };

function summon(sim: Sim, e: Enemy, kind: EnemyKind, count: number): void {
  let alive = 0;
  for (const o of sim.enemies) if (o.state !== 'dead' && !o.def.boss) alive++;
  const n = Math.min(count, BOSS.summon.maxAdds - alive);
  for (let i = 0; i < n; i++) {
    const q = freeSpot(sim.level, sim.rng, e.x, e.z, e.def.radius + 0.6, e.def.radius + BOSS.summon.spread, ENEMIES[kind].radius + 0.1) ?? { x: e.x, z: e.z };
    spawnEnemy(sim, q.x, q.z, kind, e.hpMul, e.dmgMul);
  }
  if (n > 0) sim.events.push({ type: 'summon', id: e.id, x: e.x, z: e.z, count: n });
}

/** One step of a running special. Writes the body's velocity into `out`. */
export function runSpecial(sim: Sim, e: Enemy, out: { x: number; z: number }): void {
  const sp = e.sp;
  out.x = out.z = 0;
  if (!sp) {
    e.state = 'chase';
    e.stateT = 0;
    return;
  }
  const p = sim.player;
  if (e.stateT < sp.wind) {
    // Shooters keep tracking the hero while they wind up; rushes hold their marked line.
    if (!(sp.kind in RUSH) || sp.kind === 'dive') e.facing = angleOf(p.x - e.x, p.z - e.z);
    return;
  }
  if (!sp.fired) {
    sp.fired = true;
    release(sim, e, sp);
    if (sp.kind in RUSH) e.facing = angleOf(sp.dx, sp.dz);
  }
  if (sp.speed > 0) {
    out.x = sp.dx * sp.speed;
    out.z = sp.dz * sp.speed;
    if (!sp.hit && Math.hypot(p.x - e.x, p.z - e.z) < e.def.radius + PLAYER.radius + 0.15) {
      const boss = sp.kind === 'charge';
      const raw = RUSH[sp.kind] ? RUSH[sp.kind]! * e.dmgMul : damageOf(e, sp.kind === 'lunge' ? THREAT.lunge.damage : boss ? BOSS.charge.damage : 1);
      if (threatHit(sim, e, raw, boss ? BOSS.charge.floor : 0, sp.dx, sp.dz)) sp.hit = true;
    }
  }
  if (e.stateT < sp.wind + sp.go) return;
  // Done: punish window, crows sit dazed instead.
  if (sp.kind === 'dive') e.rest = THREAT.dive.rest;
  else if (sp.open > 0) {
    e.open = sp.open;
    sim.events.push({ type: 'note', text: 'Offen!', color: '#f2d14b', x: e.x, z: e.z });
  }
  e.sp = null;
  e.state = 'chase';
  e.stateT = 0;
  e.gap = e.rage ? 0.6 : 1;
}

const range = (sim: Sim, r: readonly [number, number] | readonly number[]): number => sim.rng.range(r[0]!, r[1]!);

/** Cooldowns run in every state, so a body that is busy striking still comes back to its special. */
export function tickCooldowns(e: Enemy): void {
  const rate = DT * (e.rage ? BOSS.rageRate : 1);
  e.cd[0] -= rate;
  e.cd[1] -= rate;
  e.cd[2] -= rate;
  if (e.gap > 0) e.gap -= DT;
}

/**
 * Boss ground work that runs in every state, beside whatever else the body does (M12b): the
 * Rattenmutter's acid trail while she moves, the Spreehexe's acid pool under the hero every 2.2 s.
 */
export function passive(sim: Sim, e: Enemy): void {
  const p = sim.player;
  if (p.state === 'dead') return;
  if (e.kind === 'rattenmutter') {
    const R = BOSS.rattenmutter;
    e.trailT -= DT;
    if (e.trailT <= 0 && e.speed > 0.3) {
      e.trailT = R.trailEvery;
      addHazard(sim, { x: e.x, z: e.z, r: R.trailRadius, t: R.trailTime, damage: damageOf(e, R.trailDamage), kind: 'acid' });
    }
  } else if (e.kind === 'spreehexe') {
    // Marked for a moment first in 3D (2D dropped it straight under the hero).
    const H = BOSS.spreehexe;
    e.trailT -= DT * (e.rage ? BOSS.rageRate : 1);
    if (e.trailT > 0) return;
    e.trailT = H.pool;
    addZone(sim, {
      x: p.x + sim.rng.range(-H.poolX, H.poolX), z: p.z + sim.rng.range(-H.poolZ, H.poolZ), r: H.poolRadius, t: H.poolWind, max: H.poolWind,
      damage: 0, floor: 0, kind: 'acid', src: e.id, free: true, leave: { r: H.poolRadius, t: H.poolTime, damage: damageOf(e, H.poolDamage), kind: 'acid' },
    });
  }
}

/** Elite specials by modifier (2D elite tactics). Returns true when one started. */
function eliteThink(sim: Sim, e: Enemy, mod: EliteMod | 'brute', dist: number): boolean {
  if (e.cd[0] > 0) return false;
  const reach = mod === 'flink' ? THREAT.lunge.range : mod === 'spaltend' ? THREAT.fan.range : mod === 'brennend' ? THREAT.flame.range : THREAT.slam.range;
  if (dist > reach) return false;
  e.cd[0] = range(sim, THREAT.slam.every);
  begin(sim, e, mod === 'flink' ? 'lunge' : mod === 'spaltend' ? 'fan' : mod === 'brennend' ? 'flame' : mod === 'gepanzert' ? 'stomp' : 'slam');
  return true;
}

/**
 * Decides what a chasing body does this step. May start a special (the state changes) or
 * return how to move. `dist`, `toX`, `toZ`: the hero relative to the body.
 */
export function think(sim: Sim, e: Enemy, dist: number, toX: number, toZ: number): Plan {
  plan.mode = 'flow';
  plan.speed = 1;
  plan.turn = 0;
  plan.melee = e.def.attackRange > 0;
  const p = sim.player;
  if (p.state === 'dead') return plan;
  const ux = toX / (dist || 1);
  const uz = toZ / (dist || 1);
  const ai = e.def.ai;
  // Elite Brennend leaves fire where it walks.
  if (e.elite === 'brennend') {
    e.trailT -= DT;
    if (e.trailT <= 0 && e.speed > 0.3) {
      e.trailT = THREAT.flame.trailEvery;
      addHazard(sim, { x: e.x, z: e.z, r: THREAT.flame.trailRadius, t: THREAT.flame.trailTime, damage: damageOf(e, THREAT.flame.trailDamage), kind: 'fire' });
    }
  }

  switch (ai) {
    case 'melee':
      if (e.elite && eliteThink(sim, e, e.elite, dist)) return plan;
      break;
    case 'brute':
      if (eliteThink(sim, e, e.elite ?? 'brute', dist)) return plan;
      break;
    case 'spitter': {
      const S = THREAT.spit;
      const sight = dist < S.range && sim.flow.clearLine(e.x, e.z, p.x, p.z);
      if (e.elite && sight && eliteThink(sim, e, e.elite, dist)) return plan;
      if (e.cd[1] <= 0 && sight) {
        e.cd[1] = range(sim, S.every);
        begin(sim, e, 'spit');
        return plan;
      }
      if (dist < S.near) {
        plan.mode = 'dir';
        plan.x = -ux;
        plan.z = -uz;
      } else if (dist < S.far && sight) {
        plan.mode = 'dir';
        plan.x = uz * e.side;
        plan.z = -ux * e.side;
        plan.speed = 0.6;
      }
      break;
    }
    case 'pouncer': {
      const P = THREAT.pounce;
      // An elite raptor has its modifier's special beside the pounce.
      if (e.elite && eliteThink(sim, e, e.elite, dist)) return plan;
      if (e.cd[1] <= 0 && dist < P.range && dist > 1.6 && sim.flow.clearLine(e.x, e.z, p.x, p.z)) {
        e.cd[1] = P.every;
        begin(sim, e, 'pounce');
        return plan;
      }
      break;
    }
    case 'crow': {
      const D = THREAT.dive;
      plan.melee = false;
      if (e.rest > 0) {
        e.rest -= DT;
        plan.mode = 'dir';
        plan.x = ux;
        plan.z = uz;
        plan.speed = D.restSpeed / e.def.speed;
        break;
      }
      if (e.cd[1] <= 0 && dist < D.range) {
        e.cd[1] = range(sim, D.every);
        begin(sim, e, 'dive');
        return plan;
      }
      e.orb += DT * D.orbitSpeed * e.side;
      const tx = p.x + Math.sin(e.orb) * D.orbitX - e.x;
      const tz = p.z + Math.cos(e.orb) * D.orbitZ - e.z;
      const tl = Math.hypot(tx, tz) || 1;
      plan.mode = 'dir';
      plan.x = tx / tl;
      plan.z = tz / tl;
      plan.speed = Math.min(1, tl / 1.3 + 0.3);
      break;
    }
    case 'rat':
      // 2D: the heading swings ±0.6 rad seven times a second while closing in; straight for the bite.
      if (dist > 1.6) plan.turn = Math.sin(sim.time * 7 + jitter(e.id, 5) * Math.PI * 2) * 0.6;
      break;
    case 'grenzer': {
      // Keeps the watchtower distance: backs off when the hero comes close, strafes in range.
      const G = BOSS.grenzer;
      if (dist < G.near && dist > e.def.attackRange) {
        plan.mode = 'dir';
        plan.x = -ux;
        plan.z = -uz;
        plan.speed = 0.75;
      } else if (dist < G.far && sim.flow.clearLine(e.x, e.z, p.x, p.z)) {
        plan.mode = 'dir';
        plan.x = uz * e.side;
        plan.z = -ux * e.side;
        plan.speed = 0.5;
      }
      bossThink(sim, e, dist);
      break;
    }
    default:
      bossThink(sim, e, dist);
      break;
  }
  return plan;
}

function bossThink(sim: Sim, e: Enemy, dist: number): void {
  const p = sim.player;
  if (e.gap > 0) return;
  const sight = (): boolean => sim.flow.clearLine(e.x, e.z, p.x, p.z);
  switch (e.def.ai) {
    case 'feldwebel': {
      const F = BOSS.feldwebel;
      if (e.cd[1] <= 0) {
        e.cd[1] = F.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist < BOSS.charge.range && dist > 3 && sight()) {
        e.cd[0] = range(sim, F.charge);
        begin(sim, e, 'charge');
      }
      break;
    }
    case 'waechter': {
      const W = BOSS.waechter;
      if (e.cd[0] <= 0 && dist < 16) {
        e.cd[0] = W.barrage;
        begin(sim, e, 'barrage');
      } else if (e.cd[1] <= 0) {
        e.cd[1] = W.ring;
        begin(sim, e, 'ring');
      } else if (e.cd[2] <= 0 && dist < BOSS.slam.range) {
        e.cd[2] = W.slam;
        begin(sim, e, 'bossSlam');
      }
      break;
    }
    case 'rex': {
      const X = BOSS.rex;
      if (e.cd[2] <= 0 && dist < X.tailRadius) {
        e.cd[2] = X.tail;
        begin(sim, e, 'tail');
      } else if (e.cd[1] <= 0 && dist < BOSS.roar.max) {
        e.cd[1] = X.roar;
        begin(sim, e, 'roar');
      } else if (e.cd[0] <= 0 && dist < BOSS.charge.range && dist > 4 && sight()) {
        e.cd[0] = X.charge[e.rage ? 1 : 0];
        begin(sim, e, 'charge');
      }
      break;
    }
    case 'grenzer': {
      const G = BOSS.grenzer;
      if (e.cd[2] <= 0) {
        e.cd[2] = G.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist < 16 && sight()) {
        e.cd[0] = G.barrage;
        begin(sim, e, 'barrage');
      } else if (e.cd[1] <= 0 && dist < 14 && sight()) {
        e.cd[1] = G.volley;
        begin(sim, e, 'volley');
      }
      break;
    }
    case 'brandmeister': {
      const M = BOSS.brandmeister;
      if (e.cd[2] <= 0 && dist < M.close) {
        e.cd[2] = M.flame;
        begin(sim, e, 'flame');
      } else if (e.cd[0] <= 0 && dist < 14) {
        e.cd[0] = M.molotov;
        begin(sim, e, 'molotov');
      } else if (e.cd[1] <= 0) {
        e.cd[1] = M.ring;
        begin(sim, e, 'ring');
      }
      break;
    }
    case 'rattenmutter': {
      const R = BOSS.rattenmutter;
      if (e.cd[2] <= 0) {
        // Real seconds as in 2D: undo the rage tick rate for this one.
        e.cd[2] = R.summon[e.rage ? 1 : 0] * (e.rage ? BOSS.rageRate : 1);
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist < BOSS.slam.range) {
        e.cd[0] = R.slam;
        begin(sim, e, 'bossSlam');
      }
      break;
    }
    case 'spreehexe': {
      const H = BOSS.spreehexe;
      if (e.cd[2] <= 0 && dist < BOSS.roar.max) {
        e.cd[2] = H.wave;
        begin(sim, e, 'roar');
      } else if (e.cd[1] <= 0) {
        e.cd[1] = H.ring;
        begin(sim, e, 'ring');
      } else if (e.cd[0] <= 0 && dist < BOSS.slam.range) {
        e.cd[0] = H.slam;
        begin(sim, e, 'bossSlam');
      }
      break;
    }
    case 'hauptmann': {
      const H = BOSS.hauptmann;
      if (e.cd[2] <= 0) {
        e.cd[2] = H.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[1] <= 0) {
        e.cd[1] = H.ring;
        begin(sim, e, 'ring');
      } else if (e.cd[0] <= 0 && dist < BOSS.slam.range) {
        e.cd[0] = H.slam;
        begin(sim, e, 'bossSlam');
      }
      break;
    }
    default:
      break;
  }
}

/** Per-body variation in 0..1 from its id, so spawning draws nothing from the run's random stream. */
export function jitter(id: number, n: number): number {
  const v = Math.sin(id * 12.9898 + n * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** First cooldowns when a body spawns (so a pack does not act in unison). */
export function initCooldowns(e: Enemy): void {
  const r = (lo: number, hi: number, n: number): number => lo + (hi - lo) * jitter(e.id, n);
  switch (e.def.ai) {
    case 'spitter': e.cd = [r(2, 4, 1), r(1.5, 2.5, 2), 0]; break;
    case 'pouncer': e.cd = [r(2, 4, 1), r(1, 2, 2), 0]; break;
    case 'crow': e.cd = [0, r(2, 3.5, 2), 0]; break;
    case 'feldwebel': e.cd = [3, 6, 0]; break;
    case 'waechter': e.cd = [2.5, 5, 3.5]; break;
    case 'rex': e.cd = [3, 6, 2]; break;
    case 'hauptmann': e.cd = [2.5, 4, 6]; break;
    case 'grenzer': e.cd = [3, 1.5, 7]; break;
    case 'brandmeister': e.cd = [2, 5, 0]; break;
    case 'rattenmutter': e.cd = [2.5, 0, 2]; e.trailT = 0; break;
    case 'spreehexe': e.cd = [2.5, 4.5, 3]; e.trailT = 1.5; break;
    case 'rat': e.cd = [0, 0, 0]; break;
    default: e.cd = [r(THREAT.slam.first[0], THREAT.slam.first[1], 1), 0, 0]; break;
  }
}
