// Powers, ultimates and everything they put into the world (M8; 2D js/combat.js `skill`, js/update.js):
// shots, shock rings, fire fields, delayed impacts, thrown bottles, the banner. Also the consumables
// (M16, 2D `useCons`) because Verband and Molotow share the cast and field rules.
import { PLAYER, WEAPON } from '../data/combat';
import type { WeaponKindId } from '../data/items';
import { POWER, POWERS, PX, type PowerDef } from '../data/powers';
import type { PerkId } from '../data/progression';
import { BREAKABLE, hitBreakable } from './breakables';
import { colliderDistance } from './collide';
import { hasL, ignite, knock, pk, strike, resist } from './combat';
import { angleOf, clamp } from './math';
import { DT, type Cast, type Enemy, type Sim, type SimInput } from './types';

export type ShotKind = 'stone' | 'nail' | 'spear';
export interface Projectile {
  x: number; z: number; px: number; pz: number; angle: number; speed: number; life: number; damage: number; crit: boolean;
  /** Bodies it still passes through; `extra` is the Durchschlag allowance on top. */
  pierce: number; extra: number; hits: number[]; kind: ShotKind; wucht: boolean;
  /** Siegessäule blade: always burns. Ring jump: already jumped once. */
  fire?: boolean; jumped?: boolean;
}
export interface Shock {
  x: number; z: number; r: number; max: number; hits: number[];
  /** Weapon damage multiple, stun seconds, knockback. */
  mul: number; stun: number; knock: number; acid: boolean; kind: 'earth' | 'small' | 'blade' | 'guard' | 'acid';
}
export interface FireField { x: number; z: number; r: number; t: number; max: number }
export interface Strike { x: number; z: number; t: number; max: number; r: number }
export interface Bottle { x0: number; z0: number; x1: number; z1: number; t: number; dur: number; r: number; power: boolean }
export interface Offer { id: PerkId; level: 1 | 2; /** 0 common, 1 rare, 2 epic or duo, 3 weapon mod. */ quality: 0 | 1 | 2 | 3 }

export interface Abilities {
  powerCd: number; ultimateCd: number;
  /** Timers: Säbeltanz, Gullydeckel, Kreissäge, Verband, Döner. */
  frenzy: number; guard: number; spin: number; spinTick: number; hot: number; fed: number;
  /** After a dodge: Husarenritt window and Sturmangriff window. */
  hus: number; stT: number;
  banner: { x: number; z: number; t: number; r: number } | null;
  /** Retourkutsche armed, Stehaufmännchen used, Gegengewicht swing counter. */
  ret: boolean; secondUsed: boolean; swings: number;
  /** Legendary counters: hits (Kiezbox, Bassarm), melee attacks (Mauer), Rattenmantel cooldown, Weltzeituhr crit armed. */
  legHits: number; legSwings: number; ratT: number; dcrit: boolean;
  streak: { n: number; t: number };
  jagd: { n: number; t: number };
  /** Enemies the current dodge or Fechtsprung already hit; fire trail timer. */
  ramHits: number[]; trailT: number;
  projectiles: Projectile[]; shocks: Shock[]; fields: FireField[]; strikes: Strike[]; bottles: Bottle[];
  booms: Array<{ x: number; z: number }>;
  /** Blessing choice on screen (the game pauses), how many more wait, and its kind. */
  offers: Offer[]; pending: number; hiddenOffer: boolean; rerolled: boolean;
  /** Seconds until the blessing choice of a won encounter opens. */
  rewardT?: number;
  /** Best card quality taken per blessing (card frame in the build list). */
  quality: Partial<Record<PerkId, number>>;
}

export function createAbilities(): Abilities {
  return {
    powerCd: 0, ultimateCd: 0, frenzy: 0, guard: 0, spin: 0, spinTick: 0, hot: 0, fed: 0, hus: 0, stT: 0, banner: null,
    ret: false, secondUsed: false, swings: 0, legHits: 0, legSwings: 0, ratT: 0, dcrit: false, streak: { n: 0, t: 0 }, jagd: { n: 0, t: 0 }, ramHits: [], trailT: 0,
    projectiles: [], shocks: [], fields: [], strikes: [], bottles: [], booms: [],
    offers: [], pending: 0, hiddenOffer: false, rerolled: false, quality: {},
  };
}

export const CONSUMABLE = {
  max: 3,
  /** Verband: share of max life over `hotTime` seconds. */
  heal: 0.4, hotTime: 3,
  molotow: { aim: 320 * PX, free: 150 * PX, flight: 0.42, radius: 65 * PX, time: 4, cast: 0.45, fire: 0.2 },
  /** Fire fields: burn per second as weapon damage share, refreshed while inside. */
  fieldBurn: 0.9, fieldHold: 0.7, fieldProps: 60 * PX,
  /** Döner: heal share, seconds of +10% damage. */
  food: { heal: 0.25, fed: 30, damage: 1.1 },
  /** Brandstifter trail. */
  trail: { every: 0.05, radius: 34 * PX, time: 2.2 },
  ram: { damage: 1.2, knock: 360, pad: 8 * PX },
} as const;

/** Read after a strike: the type checker cannot see that `strike` may have killed the body. */
const dead = (e: Enemy): boolean => e.state === 'dead';

export const powerOf = (s: Sim, ultimate: boolean): PowerDef => POWERS[s.stats.kind][ultimate ? 2 : s.equipment.w?.power === 1 ? 1 : 0];
export const cooldownOf = (s: Sim, def: PowerDef): number => def.cooldown * s.stats.cooldownFactor;

/** Switching the regular power costs half its cooldown (so it cannot be cycled for two casts). */
export function selectPower(s: Sim, which: 0 | 1): void {
  if (!s.equipment.w || s.player.state === 'cast') return;
  s.equipment.w.power = which;
  s.abilities.powerCd = Math.max(s.abilities.powerCd, cooldownOf(s, POWERS[s.stats.kind][which]) * 0.5);
}

/** Weapon kind changed (new weapon equipped): timers of the old kind's powers end. */
export function resetPowerState(s: Sim, _kind: WeaponKindId): void {
  const a = s.abilities;
  a.spin = a.guard = a.frenzy = 0;
}

function nearest(s: Sim, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = range;
  for (const e of s.enemies) {
    if (e.state === 'dead') continue;
    const d = Math.hypot(e.x - s.player.x, e.z - s.player.z) - e.def.radius;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Aim of a power: the stick or mouse when given, else the nearest enemy in range, else the facing. */
function aimOf(s: Sim, inp: SimInput, range: number): { angle: number; target: Enemy | null } {
  const p = s.player;
  if (inp.aimX !== 0 || inp.aimZ !== 0) {
    if (inp.aimAssist) {
      // Stick aim snaps to an enemy near that direction.
      const dir = angleOf(inp.aimX, inp.aimZ);
      let best: Enemy | null = null;
      let bs = 0.6;
      for (const e of s.enemies) {
        if (e.state === 'dead' || Math.hypot(e.x - p.x, e.z - p.z) > range) continue;
        const off = Math.abs(Math.atan2(Math.sin(angleOf(e.x - p.x, e.z - p.z) - dir), Math.cos(angleOf(e.x - p.x, e.z - p.z) - dir)));
        if (off < bs) {
          bs = off;
          best = e;
        }
      }
      if (best) return { angle: angleOf(best.x - p.x, best.z - p.z), target: best };
    }
    return { angle: angleOf(inp.aimX, inp.aimZ), target: null };
  }
  const target = nearest(s, range);
  if (target) return { angle: angleOf(target.x - p.x, target.z - p.z), target };
  return { angle: inp.moveX !== 0 || inp.moveZ !== 0 ? angleOf(inp.moveX, inp.moveZ) : p.facing, target: null };
}

export function shoot(s: Sim, o: Partial<Projectile> & { angle: number; damage: number; speed: number; life: number }): void {
  const p = s.player;
  const x = p.x + Math.sin(o.angle) * 0.45;
  const z = p.z + Math.cos(o.angle) * 0.45;
  s.abilities.projectiles.push({ x, z, px: x, pz: z, crit: false, pierce: 0, extra: pk(s, 'durch'), hits: [], kind: 'stone', wucht: false, ...o });
}

export function shock(s: Sim, x: number, z: number, max: number, o: Partial<Shock> = {}): void {
  const kind = o.kind ?? 'earth';
  s.abilities.shocks.push({ x, z, r: 10 * PX, max, hits: [], mul: 2.5, stun: 1.3, knock: knock(430), acid: false, kind, ...o });
  s.events.push({ type: 'shock', x, z, radius: max, kind });
}

function propsInRadius(s: Sim, x: number, z: number, r: number): void {
  for (const b of s.breakables) if (!b.broken && Math.hypot(b.def.x - x, b.def.z - z) < r + BREAKABLE[b.def.kind].radius * 0.5) hitBreakable(s, b);
}

/** Where a leap or dash ends: `len` meters along `angle`, inside the map. */
function landing(s: Sim, angle: number, len: number): { x: number; z: number } {
  const p = s.player;
  const b = s.level.playerBox;
  const spot = {
    x: clamp(p.x + Math.sin(angle) * len, b.minX + 1, b.maxX - 1),
    z: clamp(p.z + Math.cos(angle) * len, b.minZ + 1, b.maxZ - 1),
  };
  // Never land in a wall or in water: walk the line back until the spot is free.
  for (let k = 1; k > 0.05; k -= 0.1) {
    const x = p.x + (spot.x - p.x) * k;
    const z = p.z + (spot.z - p.z) * k;
    const probe = { x, z, px: x, pz: z };
    s.level.resolve(probe, PLAYER.radius);
    if (Math.hypot(probe.x - x, probe.z - z) < 0.6 && !s.level.blocked(probe.x, probe.z, PLAYER.radius)) return { x: probe.x, z: probe.z };
  }
  return { x: p.x, z: p.z };
}

function startCast(s: Sim, id: Cast['id'], dur: number, fire: number, to: { x: number; z: number } | null, tx = 0, tz = 0): void {
  const p = s.player;
  p.state = 'cast';
  p.stateT = 0;
  p.attack = null;
  p.sweeping = false;
  p.chain = null;
  p.chainT = 0;
  p.vx = p.vz = 0;
  p.cast = { id, dur, fire, fired: false, x0: p.x, z0: p.z, x1: to?.x ?? p.x, z1: to?.z ?? p.z, tx, tz };
}

/** True when a press could start `def` now (cooldown, state). */
function canCast(s: Sim, cd: number): boolean {
  const p = s.player;
  if (cd > 0 || p.state === 'dead' || p.state === 'dodge' || p.state === 'cast') return false;
  // Not inside wind-up and active frames: a swing that started lands first.
  return !(p.state === 'attack' && p.attack !== null && p.stateT < p.attack.windup + p.attack.active);
}

function usePower(s: Sim, ult: boolean, inp: SimInput): void {
  const a = s.abilities;
  const p = s.player;
  const def = powerOf(s, ult);
  if (!canCast(s, ult ? a.ultimateCd : a.powerCd)) return;
  if (ult) {
    a.ultimateCd = cooldownOf(s, def);
    s.consumed.ultimate = true;
  } else {
    a.powerCd = cooldownOf(s, def);
    s.consumed.power = true;
  }
  if (p.state === 'attack') {
    p.state = 'move';
    p.attack = null;
    p.sweeping = false;
  }
  s.events.push({ type: 'ability', id: def.id, name: def.name, ultimate: ult });
  switch (def.id) {
    case 'saege':
      a.spin = POWER.saege.time;
      a.spinTick = 0;
      break;
    case 'saebel':
      a.frenzy = POWER.saebel.time;
      shock(s, p.x, p.z, POWER.saebel.radius, { mul: POWER.saebel.damage, stun: POWER.saebel.stun, kind: 'blade' });
      s.events.push({ type: 'abilityFire', id: def.id, x: p.x, z: p.z });
      break;
    case 'gully':
      a.guard = POWER.gully.time;
      s.events.push({ type: 'abilityFire', id: def.id, x: p.x, z: p.z });
      break;
    case 'fecht': {
      const aim = aimOf(s, inp, POWER.fecht.aim);
      p.facing = aim.angle;
      a.ramHits.length = 0;
      p.invuln = Math.max(p.invuln, POWER.fecht.invuln);
      // The dash runs its full length; walls stop it in `updateCast`.
      startCast(s, def.id, def.cast, 0, { x: p.x + Math.sin(aim.angle) * POWER.fecht.speed * POWER.fecht.time, z: p.z + Math.cos(aim.angle) * POWER.fecht.speed * POWER.fecht.time });
      break;
    }
    case 'abriss':
    case 'stab': {
      const t = POWER[def.id];
      const aim = aimOf(s, inp, t.aim);
      const len = aim.target ? Math.min(t.far, Math.hypot(aim.target.x - p.x, aim.target.z - p.z)) : t.free;
      p.facing = aim.angle;
      startCast(s, def.id, def.cast, def.fire, landing(s, aim.angle, len));
      break;
    }
    case 'brand': {
      const aim = aimOf(s, inp, POWER.brand.aim);
      p.facing = aim.angle;
      const d = aim.target ? Math.hypot(aim.target.x - p.x, aim.target.z - p.z) : POWER.brand.free;
      startCast(s, def.id, def.cast, def.fire, null, p.x + Math.sin(aim.angle) * d, p.z + Math.cos(aim.angle) * d);
      break;
    }
    default: {
      // fall, nagel, sperr, spiess, stand: stand, play the clip, release at `fire`.
      const range = def.id === 'nagel' ? 420 * PX : def.id === 'spiess' ? 520 * PX : 0;
      if (range > 0) p.facing = aimOf(s, inp, range).angle;
      startCast(s, def.id, def.cast, def.fire, null);
    }
  }
}

/** The effect of a cast, at its `fire` time. */
function fire(s: Sim, c: Cast): void {
  const a = s.abilities;
  const p = s.player;
  const d = s.stats.damage;
  s.events.push({ type: 'abilityFire', id: c.id, x: p.x, z: p.z });
  switch (c.id) {
    case 'fall':
      shock(s, p.x, p.z, POWER.fall.radius, { mul: POWER.fall.damage, stun: POWER.fall.stun });
      propsInRadius(s, p.x, p.z, POWER.fall.radius);
      break;
    case 'abriss':
    case 'stab': {
      const t = POWER[c.id];
      shock(s, p.x, p.z, t.radius, { mul: t.damage, stun: t.stun, kind: c.id === 'abriss' ? 'earth' : 'small' });
      propsInRadius(s, p.x, p.z, t.radius * 0.95);
      break;
    }
    case 'nagel':
      for (let i = 0; i < POWER.nagel.count; i++) {
        shoot(s, { angle: p.facing + (i - (POWER.nagel.count - 1) / 2) * POWER.nagel.spread, damage: d * POWER.nagel.damage, speed: WEAPON.sling.speed * s.stats.reachFactor, life: POWER.nagel.life, pierce: POWER.nagel.pierce, kind: 'nail' });
      }
      break;
    case 'brand':
      a.bottles.push({ x0: p.x, z0: p.z, x1: c.tx, z1: c.tz, t: 0, dur: POWER.brand.flight, r: POWER.brand.radius, power: true });
      break;
    case 'molotow':
      a.bottles.push({ x0: p.x, z0: p.z, x1: c.tx, z1: c.tz, t: 0, dur: CONSUMABLE.molotow.flight, r: CONSUMABLE.molotow.radius, power: false });
      break;
    case 'sperr': {
      const T = POWER.sperr;
      // Fisher-Yates on the seeded generator: the 2D shuffle, deterministic.
      const targets = s.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - p.x, e.z - p.z) < T.aim);
      for (let i = targets.length - 1; i > 0; i--) {
        const j = s.rng.int(i + 1);
        [targets[i], targets[j]] = [targets[j]!, targets[i]!];
      }
      for (let i = 0; i < T.count; i++) {
        const e = targets.length ? targets[i % targets.length]! : null;
        const ang = s.rng.range(0, Math.PI * 2);
        const dist = s.rng.range(60 * PX, 220 * PX);
        const t = T.first + i * T.gap;
        a.strikes.push({
          x: e ? e.x + s.rng.range(-T.jitter, T.jitter) : p.x + Math.sin(ang) * dist,
          z: e ? e.z + s.rng.range(-T.jitter, T.jitter) : p.z + Math.cos(ang) * dist, t, max: t, r: T.radius,
        });
      }
      break;
    }
    case 'spiess':
      shoot(s, { angle: p.facing, damage: d * POWER.spiess.damage, speed: POWER.spiess.speed, life: POWER.spiess.life, pierce: POWER.spiess.pierce, kind: 'spear' });
      break;
    case 'stand':
      a.banner = { x: p.x + Math.sin(p.facing) * 0.7, z: p.z + Math.cos(p.facing) * 0.7, t: POWER.stand.time, r: POWER.stand.radius };
      break;
    default:
      break;
  }
}

/** Hits of a dash through bodies: Fechtsprung always, a dodge with Rammbock. */
function dashHits(s: Sim, fecht: boolean): void {
  const p = s.player;
  const a = s.abilities;
  const ram = pk(s, 'ram');
  if (!fecht && !ram) return;
  for (const e of s.enemies) {
    if (e.state === 'dead' || a.ramHits.includes(e.id)) continue;
    if (Math.hypot(e.x - p.x, e.z - p.z) >= e.def.radius + PLAYER.radius + (fecht ? POWER.fecht.pad : CONSUMABLE.ram.pad)) continue;
    a.ramHits.push(e.id);
    if (fecht) {
      const crit = s.rng.next() < s.stats.crit;
      strike(s, e, s.stats.damage * POWER.fecht.damage * (crit ? 2 : 1), { crit, knock: knock(POWER.fecht.knock), feel: 'heavy' });
      if (dead(e) && a.powerCd > POWER.fecht.recharge) {
        a.powerCd = POWER.fecht.recharge;
        s.events.push({ type: 'note', text: 'nochmal', color: '#f2d14b', x: p.x, z: p.z });
      }
    } else {
      strike(s, e, s.stats.damage * CONSUMABLE.ram.damage * ram, { knock: knock(CONSUMABLE.ram.knock), feel: 'light' });
    }
  }
}

/** Runs the hero's `cast` state: movement of leaps and dashes, the effect, the end. Called by the player update. */
export function updateCast(s: Sim): void {
  const p = s.player;
  const c = p.cast;
  if (!c) {
    p.state = 'move';
    return;
  }
  const t = p.stateT;
  if (c.id === 'fecht') {
    const v = POWER.fecht.speed;
    p.vx = Math.sin(p.facing) * v;
    p.vz = Math.cos(p.facing) * v;
    p.x += p.vx * DT;
    p.z += p.vz * DT;
    s.level.resolve(p, PLAYER.radius);
    dashHits(s, true);
  } else if (c.id === 'abriss' || c.id === 'stab') {
    const q = Math.min(1, t / c.dur);
    const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
    const nx = c.x0 + (c.x1 - c.x0) * e;
    const nz = c.z0 + (c.z1 - c.z0) * e;
    p.vx = (nx - p.x) / DT;
    p.vz = (nz - p.z) / DT;
    p.x = nx;
    p.z = nz;
    // In the air: nothing reaches the hero, and the path was checked when the leap started.
    p.invuln = Math.max(p.invuln, 0.1);
  } else {
    p.vx = p.vz = 0;
  }
  if (!c.fired && t >= c.fire) {
    c.fired = true;
    fire(s, c);
  }
  if (t >= c.dur) {
    if (c.id === 'abriss' || c.id === 'stab') {
      s.level.resolve(p, PLAYER.radius);
    }
    p.state = 'move';
    p.stateT = 0;
    p.cast = null;
    p.vx *= 0.2;
    p.vz *= 0.2;
  }
}

/** Height of the hero above the ground in a leap (render and shadow). */
export function leapHeight(s: Sim, alpha = 1): number {
  const p = s.player;
  const c = p.cast;
  if (p.state !== 'cast' || !c || (c.id !== 'abriss' && c.id !== 'stab')) return 0;
  const q = clamp((p.stateT - DT * (1 - alpha)) / c.dur, 0, 1);
  return Math.sin(Math.PI * q) * POWER[c.id].height;
}

export function useConsumable(s: Sim, id: 'verband' | 'molotow', inp: SimInput): boolean {
  const p = s.player;
  const a = s.abilities;
  const have = s.inventory.consumables?.[id] ?? 0;
  if (have <= 0 || p.state === 'dead') return false;
  if (id === 'verband') {
    if (a.hot > 0 || p.hp >= s.stats.maxHp) return false;
    a.hot = CONSUMABLE.hotTime;
  } else {
    if (!canCast(s, 0)) return false;
    const M = CONSUMABLE.molotow;
    const aim = aimOf(s, inp, M.aim);
    const d = aim.target ? Math.hypot(aim.target.x - p.x, aim.target.z - p.z) : M.free;
    p.facing = aim.angle;
    startCast(s, 'molotow', M.cast, M.fire, null, p.x + Math.sin(aim.angle) * d, p.z + Math.cos(aim.angle) * d);
  }
  s.inventory.consumables = { verband: 0, molotow: 0, ...s.inventory.consumables, [id]: have - 1 };
  s.consumed[id] = true;
  s.events.push({ type: 'consumable', id, left: have - 1 });
  return true;
}

/** One more Verband or Molotow, up to three each (2D rule). */
export function addConsumable(s: Sim, id: 'verband' | 'molotow'): boolean {
  const have = s.inventory.consumables?.[id] ?? 0;
  if (have >= CONSUMABLE.max) return false;
  s.inventory.consumables = { verband: 0, molotow: 0, ...s.inventory.consumables, [id]: have + 1 };
  return true;
}

export function healPlayer(s: Sim, amount: number): number {
  const p = s.player;
  if (p.state === 'dead') return 0;
  const h = Math.min(Math.max(0, s.stats.maxHp - p.hp), amount);
  p.hp += h;
  return h;
}

/** The dodge started: Atempause, Husarenritt and Sturmangriff windows, Rammbock list. */
export function onDodge(s: Sim): void {
  const a = s.abilities;
  if (pk(s, 'breath')) {
    const h = healPlayer(s, s.stats.maxHp * 0.03 * pk(s, 'breath'));
    if (h >= 1) s.events.push({ type: 'heal', amount: Math.round(h), source: 'breath' });
  }
  a.hus = 1.45;
  a.stT = 1.7;
  if (hasL(s, 'weltuhr')) a.dcrit = true;
  a.ramHits.length = 0;
  a.trailT = 0;
}

export function updateAbilities(s: Sim, inp: SimInput): void {
  const a = s.abilities;
  const p = s.player;
  const d = s.stats.damage;
  if (p.state !== 'dead') {
    if (inp.ultimate) usePower(s, true, inp);
    else if (inp.power) usePower(s, false, inp);
    if (inp.verband) useConsumable(s, 'verband', inp);
    else if (inp.molotow) useConsumable(s, 'molotow', inp);
  }
  for (const k of ['powerCd', 'ultimateCd', 'frenzy', 'hus', 'stT', 'fed', 'ratT'] as const) a[k] = Math.max(0, a[k] - DT);

  if (p.state === 'dodge') {
    dashHits(s, false);
    if (pk(s, 'd_brand')) {
      a.trailT -= DT;
      if (a.trailT <= 0) {
        a.trailT = CONSUMABLE.trail.every;
        a.fields.push({ x: p.x, z: p.z, r: CONSUMABLE.trail.radius, t: CONSUMABLE.trail.time, max: CONSUMABLE.trail.time });
      }
    }
  }
  if (p.state !== 'dead') {
    if (a.hot > 0) {
      a.hot -= DT;
      healPlayer(s, (s.stats.maxHp * CONSUMABLE.heal) / CONSUMABLE.hotTime * DT);
    }
    if (a.guard > 0) {
      a.guard -= DT;
      if (a.guard <= 0) shock(s, p.x, p.z, POWER.gully.radius, { mul: POWER.gully.damage, stun: POWER.gully.stun, kind: 'guard' });
    }
    if (a.spin > 0) {
      a.spin -= DT;
      a.spinTick -= DT;
      if (a.spinTick <= 0) {
        a.spinTick = POWER.saege.tick;
        const r = POWER.saege.radius * s.stats.reachFactor;
        for (const e of s.enemies) {
          if (e.state === 'dead' || Math.hypot(e.x - p.x, e.z - p.z) >= r + e.def.radius) continue;
          const crit = s.rng.next() < s.stats.crit;
          strike(s, e, d * POWER.saege.damage * (crit ? 2 : 1), { crit, knock: knock(POWER.saege.knock), feel: 'none' });
        }
        propsInRadius(s, p.x, p.z, r * 0.8);
      }
    }
    if (a.banner) {
      a.banner.t -= DT;
      if (a.banner.t <= 0) a.banner = null;
      else if (Math.hypot(p.x - a.banner.x, p.z - a.banner.z) < a.banner.r) healPlayer(s, s.stats.maxHp * POWER.stand.heal * DT);
    }
  }

  for (const k of a.strikes) {
    k.t -= DT;
    if (k.t > 0) continue;
    s.events.push({ type: 'impact', x: k.x, z: k.z, radius: k.r, kind: 'strike' });
    for (const e of s.enemies) if (e.state !== 'dead' && Math.hypot(e.x - k.x, e.z - k.z) < k.r + e.def.radius) strike(s, e, d * POWER.sperr.damage, { knock: knock(POWER.sperr.knock), feel: 'none' });
    propsInRadius(s, k.x, k.z, k.r);
  }
  if (a.strikes.length) a.strikes = a.strikes.filter((k) => k.t > 0);

  for (const b of a.bottles) {
    b.t += DT;
    if (b.t < b.dur) continue;
    const r = b.r * (pk(s, 'blast') ? 1.5 : 1);
    const time = b.power ? POWER.brand.time : CONSUMABLE.molotow.time;
    a.fields.push({ x: b.x1, z: b.z1, r, t: time, max: time });
    s.events.push({ type: 'impact', x: b.x1, z: b.z1, radius: r, kind: 'molotov' });
    propsInRadius(s, b.x1, b.z1, CONSUMABLE.fieldProps);
  }
  if (a.bottles.length) a.bottles = a.bottles.filter((b) => b.t < b.dur);

  for (const f of a.fields) {
    f.t -= DT;
    for (const e of s.enemies) {
      if (e.state === 'dead' || Math.hypot(e.x - f.x, e.z - f.z) >= f.r + e.def.radius * 0.5) continue;
      ignite(s, e, d * CONSUMABLE.fieldBurn, CONSUMABLE.fieldHold);
    }
  }
  if (a.fields.length) a.fields = a.fields.filter((f) => f.t > 0);

  for (const k of a.shocks) {
    k.r += POWER.shock.speed * DT;
    for (const e of s.enemies) {
      if (e.state === 'dead' || k.hits.includes(e.id)) continue;
      const dist = Math.hypot(e.x - k.x, e.z - k.z);
      // The ring hits what its rim reaches; a ring that starts on top of a body hits it at once.
      if (dist > k.r + POWER.shock.band + e.def.radius || dist > k.max + e.def.radius) continue;
      k.hits.push(e.id);
      strike(s, e, d * k.mul, { knock: k.knock, stun: k.stun, feel: 'none', noproc: true, element: k.acid ? 'acid' : undefined });
      if (k.acid && !dead(e) && resist(e, 'acid') > 0) e.acid = 3;
    }
  }
  if (a.shocks.length) a.shocks = a.shocks.filter((k) => k.r < k.max);

  if (a.booms.length) {
    const list = a.booms;
    a.booms = [];
    for (const b of list) {
      s.events.push({ type: 'impact', x: b.x, z: b.z, radius: 72 * PX, kind: 'boom' });
      for (const e of s.enemies) if (e.state !== 'dead' && Math.hypot(e.x - b.x, e.z - b.z) < 72 * PX + e.def.radius) strike(s, e, d * 0.35 * pk(s, 'boom'), { knock: knock(220), noproc: true, feel: 'none' });
      propsInRadius(s, b.x, b.z, 72 * PX);
    }
  }

  const jumps: Projectile[] = [];
  for (const q of a.projectiles) {
    q.px = q.x;
    q.pz = q.z;
    q.life -= DT;
    // Substeps prevent tunnelling through small bodies and walls.
    for (let i = 0; i < 4 && q.life > 0; i++) {
      q.x += (Math.sin(q.angle) * q.speed * DT) / 4;
      q.z += (Math.cos(q.angle) * q.speed * DT) / 4;
      const prop = s.breakables.find((b) => !b.broken && Math.hypot(b.def.x - q.x, b.def.z - q.z) < BREAKABLE[b.def.kind].radius + 0.1);
      if (prop) {
        hitBreakable(s, prop);
        if (q.kind !== 'spear') {
          q.life = 0;
          break;
        }
      }
      // Walls and the map edge stop a shot; water does not.
      const B = s.level.bounds;
      if (q.x < B.minX || q.x > B.maxX || q.z < B.minZ || q.z > B.maxZ || s.level.near(q.x, q.z, 0.3).some((c) => colliderDistance(c, q.x, q.z) < 0.06)) {
        q.life = 0;
        break;
      }
      for (const e of s.enemies) {
        if (e.state === 'dead' || q.hits.includes(e.id) || Math.hypot(e.x - q.x, e.z - q.z) >= e.def.radius + 0.18) continue;
        q.hits.push(e.id);
        const W = q.wucht ? WEAPON.wucht : null;
        strike(s, e, q.damage, { crit: q.crit, knock: knock(q.kind === 'spear' ? 300 : 120) * (W ? W.knock : 1), stun: W?.stun, feel: q.kind === 'spear' || q.crit ? 'heavy' : 'light', element: q.fire ? 'fire' : q.jumped ? 'shock' : undefined });
        if (q.fire && !dead(e)) ignite(s, e, q.damage * 0.45 * s.stats.elementPower, 2);
        // Krähenfeder: shots slow. Ring der Ringbahn: a shot jumps once to the nearest other enemy.
        if (hasL(s, 'kraehe') && !dead(e)) e.slow = 2;
        if (hasL(s, 'ring') && !q.jumped && !q.fire) {
          let nb: Enemy | null = null;
          let nd = 220 * PX;
          for (const o of s.enemies) {
            const dd = Math.hypot(o.x - e.x, o.z - e.z);
            if (o !== e && o.state !== 'dead' && dd < nd) { nd = dd; nb = o; }
          }
          if (nb) jumps.push({ x: e.x, z: e.z, px: e.x, pz: e.z, angle: angleOf(nb.x - e.x, nb.z - e.z), speed: WEAPON.sling.speed, life: 0.6, damage: q.damage * 0.8, crit: false, pierce: 0, extra: 0, hits: [e.id], kind: 'stone', wucht: false, jumped: true });
        }
        if (q.pierce > 0) q.pierce--;
        else if (q.extra > 0) q.extra--;
        else {
          q.life = 0;
          break;
        }
      }
    }
  }
  if (jumps.length) a.projectiles.push(...jumps);
  if (a.projectiles.length) a.projectiles = a.projectiles.filter((q) => q.life > 0);
}
