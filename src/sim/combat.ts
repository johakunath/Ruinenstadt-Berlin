// Damage resolution (2D js/combat.js `hit`, `chain`, `kill`, `hurt`): every hit on an enemy goes
// through `strike`, every death through `killEnemy`, every hit on the hero through `hurtPlayer`.
// Blessing and weapon-mod rules live here so a swing, a shot, a power and a burn all obey them.
import { HIT_FEEL, PLAYER, type HitWeight } from '../data/combat';
import { ENEMY_RESISTANCES, type ElementId, type LegendaryId } from '../data/items';
import { ELITES, THREAT } from '../data/enemies';
import { splitElite } from './enemies';
import { PX } from '../data/powers';
import type { PerkId } from '../data/progression';
import { killDrops } from './loot';
import { kodexKill } from './inventory';
import { DT, type Enemy, type Sim } from './types';

export const pk = (s: Sim, k: PerkId): number => s.statContext.perks[k] ?? 0;
/** An equipped legendary with this power (2D `hasL`). */
export const hasL = (s: Sim, id: LegendaryId): boolean => s.stats.legendary.includes(id);

/** 2D knockback impulses (px/s) on the 3D scale: the blade's 240 is the old 3D light hit of 5. */
export const knock = (px: number): number => px / 48;

export const STATUS = {
  burnTime: 2, burnShare: 0.45, acidTime: 3, acidBonus: 0.25, chainRange: 140 * PX, chainShare: 0.5,
  corrodeSlow: 0.7, spreadRange: 90 * PX, spreadShare: 0.8, boomRange: 72 * PX, boomShare: 0.35,
  critStun: 0.6, farRange: 200 * PX, kimmeStep: 50 * PX, execShare: 0.12, dotReport: 0.4,
  streakTime: 2.6, jagdTime: 3, jagdMax: 5, jagdStep: 0.06, eliteHp: 2.6,
  /** Zweiter Atem: life restored and seconds of invulnerability. */
  secondHp: 0.3, secondInvuln: 1.5, stellung: 0.75, thorns: 0.6, mauerBurn: 0.8, mauerTime: 3,
} as const;

export interface StrikeOpts {
  crit?: boolean;
  /** Knockback in m/s (see `knock`). */
  knock?: number;
  /** Seconds the target cannot act (bosses shrug most of it off). */
  stun?: number;
  /** Hit feel: freeze, shake, stagger. `none` for procs and area ticks. */
  feel?: HitWeight | 'none';
  /** Secondary damage (chains, thorns, explosions): no element procs, no crit upgrades. */
  noproc?: boolean;
  element?: ElementId;
  note?: string;
}

const tough = (e: Enemy): boolean => !!e.def.boss || !!e.elite;

/** Damage multiplier of an element against this body (2D `ER`): 0 is immune. */
export const resist = (e: Enemy, el: ElementId): number => (e.def.res === 'none' ? 1 : ENEMY_RESISTANCES[e.def.res][el]);

export function stun(e: Enemy, seconds: number): void {
  if (e.state === 'dead' || seconds <= 0) return;
  // A boss finishes what it marked; a rush in flight cannot be stopped.
  if (e.state === 'special' && e.sp && (e.def.boss || (e.sp.speed > 0 && e.stateT >= e.sp.wind))) return;
  e.sp = null;
  const t = seconds * (e.def.boss ? 0.15 : 1);
  if (e.state === 'stagger' && e.staggerDur - e.stateT >= t) return;
  e.state = 'stagger';
  e.stateT = 0;
  e.staggerDur = t;
}

export function ignite(s: Sim, e: Enemy, dps: number, time: number, stack = false): void {
  if (e.state === 'dead') return;
  dps *= resist(e, 'fire');
  if (dps <= 0) return;
  const cur = e.burn > 0 ? e.bdps : 0;
  if (e.burn <= 0) s.events.push({ type: 'ignite', id: e.id, x: e.x, z: e.z });
  e.bdps = stack ? Math.min(3 * dps, cur + dps) : Math.max(cur, dps);
  e.burn = Math.max(e.burn, time);
}

/** Lightning from `src` to its nearest neighbors (2D `chain`). */
export function chain(s: Sim, src: Enemy, damage: number, jumps: number): void {
  const d = (t: Enemy): number => Math.hypot(t.x - src.x, t.z - src.z);
  const targets = s.enemies.filter((t) => t !== src && t.state !== 'dead' && d(t) < STATUS.chainRange).sort((a, b) => d(a) - d(b)).slice(0, jumps);
  let x = src.x;
  let z = src.z;
  for (const t of targets) {
    s.events.push({ type: 'bolt', x0: x, z0: z, x1: t.x, z1: t.z });
    x = t.x;
    z = t.z;
    strike(s, t, damage, { knock: knock(60), noproc: true, feel: 'none', element: 'shock' });
  }
}

/** One hit on an enemy. Returns the damage dealt. */
export function strike(s: Sim, e: Enemy, damage: number, o: StrikeOpts = {}): number {
  if (e.state === 'dead') return 0;
  const p = s.player;
  const a = s.abilities;
  const dist = Math.hypot(e.x - p.x, e.z - p.z);
  let crit = !!o.crit;
  if (!crit && !o.noproc && pk(s, 'd_ziel') && dist > STATUS.farRange && s.rng.next() < 0.25) {
    crit = true;
    damage *= 2;
  }
  if (pk(s, 'kimme')) damage *= 1 + Math.min(0.32, (0.04 * dist) / STATUS.kimmeStep);
  if (a.banner && Math.hypot(p.x - a.banner.x, p.z - a.banner.z) < a.banner.r) damage *= 1.5;
  if (tough(e)) damage *= (1 + s.stats.eliteBonus) * (1 + 0.25 * pk(s, 'breaker')) * (hasL(s, 'auge') ? 1.25 : 1);
  if (pk(s, 'rush') && a.streak.n >= 10) damage *= 1 + 0.02 * Math.floor(a.streak.n / 10);
  if (e.acid > 0) damage *= 1 + STATUS.acidBonus * s.stats.elementPower;
  // M12: open bodies take more, armored elites half until they open; elemental hits meet the type's resistance.
  if (e.open > 0) damage *= THREAT.openBonus;
  else if (e.elite === 'gepanzert') damage *= THREAT.armored;
  if (o.element) {
    const w = resist(e, o.element);
    if (w <= 0) {
      s.events.push({ type: 'note', text: 'immun', color: '#9aa4b0', x: e.x, z: e.z });
      return 0;
    }
    damage *= w;
  }
  damage = Math.max(1, Math.round(damage));
  e.hp -= damage;
  e.lastCrit = crit;

  let dx = e.x - p.x;
  let dz = e.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const kb = o.knock ?? 0;
  e.kx += dx * kb * e.def.knockbackTaken;
  e.kz += dz * kb * e.def.knockbackTaken;

  const feel = o.feel ?? 'light';
  if (feel !== 'none' && kb > 0 && (!e.def.poise || feel === 'heavy')) stun(e, HIT_FEEL[feel].stagger / (e.def.boss ? 0.15 : 1));
  if (o.stun) stun(e, o.stun);
  if (crit && pk(s, 'stun')) stun(e, STATUS.critStun);
  if (!o.noproc) {
    const n = ++a.legHits;
    // Kiezbox: every fourth hit stuns. Bassarm: every fifth hit chains to four.
    if (hasL(s, 'kiezbox') && n % 4 === 0) stun(e, 0.5);
    if (hasL(s, 'bassarm') && n % 5 === 0) chain(s, e, damage * 0.6, 4);
    // Fernsehturm: a crit bursts into fire on the neighbors.
    if (crit && hasL(s, 'turm')) {
      for (const t of s.enemies) {
        if (t === e || t.state === 'dead' || Math.hypot(t.x - e.x, t.z - e.z) >= 75 * PX) continue;
        strike(s, t, damage * 0.6, { knock: knock(220), noproc: true, feel: 'none', element: 'fire' });
        ignite(s, t, damage * 0.3, 2);
      }
      s.events.push({ type: 'impact', x: e.x, z: e.z, radius: 75 * PX, kind: 'boom' });
    }
  }

  if (!o.noproc) {
    for (const el of s.stats.elements) {
      if (!(crit && pk(s, 'd_kurz')) && s.rng.next() > s.stats.elementChance) continue;
      if (el === 'fire') ignite(s, e, damage * STATUS.burnShare * s.stats.elementPower, STATUS.burnTime + pk(s, 'schwel'), pk(s, 'schwel') > 0);
      else if (el === 'acid') { if (resist(e, 'acid') > 0) e.acid = STATUS.acidTime; }
      else chain(s, e, damage * STATUS.chainShare * s.stats.elementPower, 2 + 2 * pk(s, 'chain'));
    }
    if ((s.content.shrine.zap ?? 0) > 0 && s.rng.next() < 0.25) chain(s, e, damage * 0.45, 2);
  }
  let note = o.note;
  if (pk(s, 'exec') && !e.def.boss && e.hp > 0 && e.hp < e.maxHp * STATUS.execShare) {
    e.hp = 0;
    note = 'Gnadenstoß';
  }
  const killed = e.hp <= 0;
  if (feel !== 'none') s.hitstop = Math.max(s.hitstop, HIT_FEEL[feel].hitstop + (killed ? PLAYER.killHitstop : 0));
  s.events.push({
    type: 'hit', id: e.id, x: e.x - dx * e.def.radius, z: e.z - dz * e.def.radius, dx, dz,
    weight: feel === 'none' ? 'light' : feel, killed, damage, critical: crit, element: o.element, quiet: feel === 'none', note,
  });
  if (killed) killEnemy(s, e);
  return damage;
}

export function killEnemy(s: Sim, e: Enemy): void {
  if (e.state === 'dead') return;
  const p = s.player;
  const a = s.abilities;
  e.state = 'dead';
  e.stateT = 0;
  e.hp = 0;
  e.sp = null;
  e.open = 0;
  if (e.elite === 'spaltend') splitElite(s, e);
  s.kills++;
  if (kodexKill(s, e.def.kind)) s.events.push({ type: 'kodex', name: e.def.name });
  if (e.elite && kodexKill(s, `e:${e.elite}`)) s.events.push({ type: 'kodex', name: `Elite ${ELITES[e.elite].name}` });
  a.streak.n++;
  a.streak.t = STATUS.streakTime;
  killDrops(s, e);
  if (p.state !== 'dead') p.hp = Math.min(s.stats.maxHp, p.hp + s.stats.leech + s.stats.maxHp * 0.01 * pk(s, 'leech') + (tough(e) && hasL(s, 'pickel') ? s.stats.maxHp * 0.15 : 0));
  // Schaffnerkelle: a kill shortens the dodge cooldown (2D 0.5 s of 1.4 s). Zitadellenklinge: one second off the power.
  if (hasL(s, 'schaffner')) p.dodgeCd = Math.max(0, p.dodgeCd - (0.5 / 1.4) * PLAYER.dodge.cooldown);
  if (hasL(s, 'zitklinge')) a.powerCd = Math.max(0, a.powerCd - 1);
  // Presslufthammer: a crit kill of a normal enemy sends a stunning ring.
  if (hasL(s, 'pbrecher') && e.lastCrit && !e.def.boss) a.shocks.push({ x: e.x, z: e.z, r: 10 * PX, max: 95 * PX, hits: [e.id], mul: 0.7, stun: 0.5, knock: knock(260), acid: false, kind: 'small' }), s.events.push({ type: 'shock', x: e.x, z: e.z, radius: 95 * PX, kind: 'small' });
  if (pk(s, 'jagd')) {
    a.jagd.n = Math.min(STATUS.jagdMax, a.jagd.n + 1);
    a.jagd.t = STATUS.jagdTime;
  }
  if (pk(s, 'd_sturm') && a.stT > 0) {
    p.dodgeCd = 0;
    a.stT = 0;
    s.events.push({ type: 'note', text: 'Sturmangriff', color: '#f2d14b', x: p.x, z: p.z });
  }
  if (pk(s, 'spread') && e.burn > 0) {
    for (const t of s.enemies) {
      if (t === e || t.state === 'dead' || Math.hypot(t.x - e.x, t.z - e.z) >= STATUS.spreadRange) continue;
      ignite(s, t, e.bdps * STATUS.spreadShare, STATUS.burnTime);
    }
  }
  if (pk(s, 'boom') && !e.def.boss) a.booms.push({ x: e.x, z: e.z });
}

/** Burn and acid timers. Burn damage has no hit feel; it reports as `dot` a few times a second. */
export function updateStatuses(s: Sim): void {
  const p = s.player;
  for (const e of s.enemies) {
    if (e.state === 'dead') continue;
    if (e.acid > 0) e.acid = Math.max(0, e.acid - DT);
    if (e.slow && e.slow > 0) e.slow = Math.max(0, e.slow - DT);
    if (e.burn <= 0) continue;
    const d = e.bdps * Math.min(DT, e.burn);
    e.burn -= DT;
    e.hp -= d;
    e.burnAcc += d;
    if (pk(s, 'kachel') && p.state !== 'dead') p.hp = Math.min(s.stats.maxHp, p.hp + d * 0.05 * pk(s, 'kachel'));
    const killed = e.hp <= 0;
    if (killed || e.burn <= 0 || e.burnAcc >= e.bdps * STATUS.dotReport) {
      if (e.burnAcc >= 0.5 || killed) s.events.push({ type: 'dot', id: e.id, x: e.x, z: e.z, damage: Math.max(1, Math.round(e.burnAcc)), killed });
      e.burnAcc = 0;
    }
    if (killed) killEnemy(s, e);
  }
  const a = s.abilities;
  if (a.streak.n > 0) {
    a.streak.t -= DT;
    if (a.streak.t <= 0) {
      // 2D: a series of 10 or more pays out Schrott when it ends.
      if (a.streak.n >= 10) {
        const scrap = Math.round(a.streak.n * 0.6);
        s.inventory.scrap += scrap;
        s.events.push({ type: 'streak', kills: a.streak.n, scrap });
      }
      a.streak.n = 0;
    }
  }
  if (a.jagd.t > 0) {
    a.jagd.t -= DT;
    if (a.jagd.t <= 0) a.jagd.n = 0;
  }
}

/** What the hero loses from an enemy hit of `raw` damage (2D `incomingDamage`, 3D cap per hit). */
export function incomingDamage(s: Sim, raw: number): number {
  const p = s.player;
  let d = raw;
  if (s.abilities.guard > 0) d *= 0.3;
  if (pk(s, 'stellung') && Math.hypot(p.vx, p.vz) < 0.9 && p.state === 'move') d *= STATUS.stellung;
  d *= 1 - s.stats.res;
  return Math.min(d, s.stats.maxHp * PLAYER.maxHitShare);
}

/** An enemy's melee hit on the hero. Returns false when it did not land. */
export function hurtPlayer(s: Sim, e: Enemy | null, raw: number, dx: number, dz: number): boolean {
  const p = s.player;
  if (p.state === 'dead' || p.invuln > 0) return false;
  // Panzerplatte: one hit in five is blocked outright.
  if (hasL(s, 'panzer') && s.rng.next() < 0.2) {
    p.invuln = 0.3;
    s.events.push({ type: 'note', text: 'geblockt', color: '#d6cfc0', x: p.x, z: p.z });
    return false;
  }
  const damage = incomingDamage(s, raw);
  p.hp = Math.max(0, p.hp - damage);
  p.hurtT = 0;
  if (pk(s, 'retour')) s.abilities.ret = true;
  s.hitstop = Math.max(s.hitstop, PLAYER.hitByEnemyHitstop);
  s.events.push({ type: 'playerHit', x: p.x, z: p.z, dx, dz, damage });
  if (p.hp <= 0) {
    if ((pk(s, 'second') || hasL(s, 'herz')) && !s.abilities.secondUsed) {
      s.abilities.secondUsed = true;
      // Herz der Spree: back at 40% instead of 30%.
      p.hp = Math.round(s.stats.maxHp * (hasL(s, 'herz') ? 0.4 : STATUS.secondHp));
      p.invuln = STATUS.secondInvuln;
      s.events.push({ type: 'secondWind' });
    } else {
      p.state = 'dead';
      p.stateT = 0;
      p.attack = null;
      p.cast = null;
      p.sweeping = false;
      p.vx = dx * 3;
      p.vz = dz * 3;
      s.events.push({ type: 'playerDie' });
      return true;
    }
  }
  // Rattenmantel: an acid wave around the hero, at most every 1.5 s.
  if (hasL(s, 'rattenmantel') && s.abilities.ratT <= 0) {
    s.abilities.ratT = 1.5;
    s.abilities.shocks.push({ x: p.x, z: p.z, r: 10 * PX, max: 120 * PX, hits: [], mul: 1.2, stun: 0, knock: knock(200), acid: true, kind: 'acid' });
    s.events.push({ type: 'shock', x: p.x, z: p.z, radius: 120 * PX, kind: 'acid' });
  }
  if (e && e.state !== 'dead') {
    if (pk(s, 'thorns')) strike(s, e, s.stats.damage * STATUS.thorns * pk(s, 'thorns'), { knock: knock(300), noproc: true, feel: 'none' });
    if (pk(s, 'd_mauer')) ignite(s, e, s.stats.damage * STATUS.mauerBurn, STATUS.mauerTime);
  }
  return true;
}
