// Enemy brains (M12; 2D enemy block in js/update.js): what each type does beyond walking up and
// striking. A special is always wind-up (readable on the ground), action, then a punish window
// in which the body stands open. Bosses run two or three specials on their own cooldowns.
// M12b (Xhain): rats zig-zag in; Grenzer, Brandmeister, Rattenmutter and Spreehexe reuse the blocks
// (barrage, ring, summon, slam, flame, roar, hazards) plus a five-shot volley and Molotov circles.
// M12c (Mitte): the Kabelghul's leap, the Boxenkopf's bass ring; Türsteher (shove, grab and hold),
// Wachdrohne (searchlight, laser volley, landing), Dirigent (beat rings, Fortissimo) and Bassprediger
// (shock charge, sermon rings) reuse the same blocks with their own numbers (`docs/tasks/m12c-mitte-enemies.md`).
// M15 (Alexanderplatz): Wurzler roots, Kernspeier seed fans; the Wurzel-Mutter, the Großer
// Uhrwerkläufer (charge, wound down, key), the Volkseigene Koloss (slabs, gear spiral) and the
// Weltzeituhr (hour sectors, orbit spiral, minute hand, Stillstand).
import { BOSS, ENEMIES, THREAT, type EliteMod, type EnemyKind } from '../data/enemies';
import { freeSpot } from './reach';
import { addHazard, addZone, fireShot, laserVolley, pushPlayer, threatHit, type Special, type SpecialKind } from './threats';
import { DEG } from './math';
import { PLAYER } from '../data/combat';
import { aliveOf, spawnEnemy } from './enemies';
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
  leap: { wind: THREAT.leap.wind, go: THREAT.leap.time, open: THREAT.leap.open, speed: THREAT.leap.speed },
  bass: { wind: THREAT.bass.wind, go: 0.3, open: THREAT.bass.open },
  shove: { wind: BOSS.tuersteher.shoveWind, go: 0.3, open: BOSS.tuersteher.shoveOpen },
  grab: { wind: BOSS.tuersteher.grabWind, go: BOSS.tuersteher.grabTime, open: BOSS.tuersteher.grabOpen, speed: BOSS.tuersteher.grabSpeed },
  land: { wind: BOSS.wachdrohne.landWind, go: 0.25, open: BOSS.wachdrohne.landed },
  beat: { wind: BOSS.dirigent.beatWind, go: 0.3, open: 0 },
  roots: { wind: 0.9, go: 0.05, open: THREAT.roots.open },
  seeds: { wind: THREAT.seeds.wind, go: 0.2, open: THREAT.seeds.open },
  rootRing: { wind: BOSS.wurzelmutter.ringWind, go: 0.3, open: 0.6 },
  key: { wind: BOSS.uhrwerkgross.key, go: 0.4, open: 0 },
  slabs: { wind: 0.5, go: 0.3, open: 0 },
  sectors: { wind: BOSS.weltzeituhr.sectorWind, go: 0.3, open: 0 },
  hand: { wind: BOSS.weltzeituhr.handWind, go: BOSS.weltzeituhr.handTime, open: 1 },
};

/** Own timing of a shared block for one kind (M12c: the Bassprediger's charge, the Dirigent's Fortissimo, the Wachdrohne's volley). */
function own(e: Enemy, kind: SpecialKind): Partial<Pick<Special, 'wind' | 'go' | 'open' | 'speed'>> | null {
  if (kind === 'charge' && e.kind === 'bassprediger') { const B = BOSS.bassprediger; return { wind: B.wind, go: B.time, open: B.open, speed: B.speed }; }
  if (kind === 'roar' && e.kind === 'dirigent') return { wind: BOSS.dirigent.beatWind, open: BOSS.dirigent.fortOpen };
  if (kind === 'volley' && e.kind === 'wachdrohne') return { wind: BOSS.wachdrohne.volleyWind };
  return null;
}

/** Rings of a roar (default: two of the 2D bass waves); the Dirigent's Fortissimo and the Basspredigt have their own. */
function roarOf(e: Enemy): { n: number; gap: number; max: number; damage: number; floor: number } {
  const R = BOSS.roar;
  if (e.kind === 'dirigent') { const D = BOSS.dirigent; return { n: 2, gap: D.fortGap, max: D.fortMax, damage: D.fortDamage, floor: D.fortFloor }; }
  if (e.kind === 'bassprediger') { const B = BOSS.bassprediger; return { n: 2, gap: B.gap, max: B.max, damage: B.ringDamage, floor: B.ringFloor }; }
  return { n: 2, gap: R.gap, max: R.max, damage: R.damage, floor: R.floor };
}

/** Specials that move the body along a locked line and hit on contact. */
const RUSH: Partial<Record<SpecialKind, number>> = { pounce: THREAT.pounce.damage, lunge: 0, dive: 0, charge: 0, leap: 0, grab: 0 };

export const isRush = (e: Enemy): boolean => e.state === 'special' && !!e.sp && e.sp.kind in RUSH && e.stateT >= e.sp.wind;

const damageOf = (e: Enemy, mul = 1): number => e.def.damage * e.dmgMul * mul;

function begin(sim: Sim, e: Enemy, kind: SpecialKind, queued = false): void {
  const p = sim.player;
  const k = SPECIAL[kind];
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const d = Math.hypot(dx, dz) || 1;
  e.state = 'special';
  e.stateT = 0;
  e.sp = { kind, wind: k.wind, go: k.go, open: k.open, dx: dx / d, dz: dz / d, speed: k.speed ?? 0, fired: false, hit: false, ...own(e, kind), ...(queued ? { queued } : {}) };
  e.facing = angleOf(dx, dz);
  const src = e.id;
  const sp = e.sp;
  // The Großer Uhrwerkläufer charges slower and winds down longer than the Feldwebel.
  if (kind === 'charge' && e.kind === 'uhrwerkgross') {
    const U = BOSS.uhrwerkgross;
    e.sp.speed = U.speed;
    e.sp.go = U.time;
    e.sp.open = U.open;
  }
  switch (kind) {
    case 'roots': {
      // A Wurzler: one field under the hero. The Wurzel-Mutter: one under, two beside (four in rage).
      const R = THREAT.roots;
      const W = BOSS.wurzelmutter;
      const n = e.kind === 'wurzelmutter' ? 1 + W.extra + (e.rage ? 1 : 0) : 1;
      const raw = damageOf(e, R.damage);
      for (let i = 0; i < n; i++) {
        // Beside: across the boss-to-hero line, alternating sides; the fourth one behind the hero.
        const side = i === 0 ? 0 : i % 2 ? 1 : -1;
        const back = i === 3 ? W.beside : 0;
        const x = p.x + e.sp.dz * side * W.beside + e.sp.dx * back;
        const z = p.z - e.sp.dx * side * W.beside + e.sp.dz * back;
        addZone(sim, { x, z, r: R.radius, t: R.wind, max: R.wind, damage: raw, floor: 0, kind: 'root', src, free: true, root: R.hold });
      }
      break;
    }
    case 'rootRing': {
      const W = BOSS.wurzelmutter;
      addZone(sim, { x: e.x, z: e.z, r: W.ringRadius, t: k.wind, max: k.wind, damage: damageOf(e, 1), floor: BOSS.slam.floor, kind: 'root', src, root: THREAT.roots.hold });
      break;
    }
    case 'slabs': {
      // Slab drops (2D v 8): the first on the hero, two more around, landing one after the other.
      const K = BOSS.volkskoloss;
      for (let i = 0; i < K.slabs; i++) {
        const t = K.slabFirst + i * K.slabStep;
        const x = i ? p.x + sim.rng.range(-K.spreadX, K.spreadX) : p.x;
        const z = i ? p.z + sim.rng.range(-K.spreadZ, K.spreadZ) : p.z;
        addZone(sim, { x, z, r: K.slabRadius, t, max: t, damage: damageOf(e, K.slabDamage), floor: K.slabFloor, kind: 'slab', src, free: true });
      }
      break;
    }
    case 'sectors': {
      // Zeitzonen: hour sectors of the ring round the clock, the first where the hero stands.
      const Z = BOSS.weltzeituhr;
      const n = Z.sectors + (e.rage ? 1 : 0);
      const step = (Math.PI * 2) / 24;
      const at = Math.round(angleOf(p.x - e.x, p.z - e.z) / step);
      const picked = [at];
      while (picked.length < n) {
        const h = at + 2 + Math.floor(sim.rng.next() * 21);
        if (!picked.some((q) => (((q - h) % 24) + 24) % 24 === 0)) picked.push(h);
      }
      for (const h of picked) addZone(sim, { x: e.x, z: e.z, r: Z.r1, t: k.wind, max: k.wind, damage: damageOf(e, Z.sectorDamage), floor: Z.sectorFloor, kind: 'hour', src, sector: { r0: Z.r0, a: h * step, half: step / 2 } });
      break;
    }
    case 'hand': {
      // The minute hand starts a little behind the hero, so its slow part reaches them first.
      const Z = BOSS.weltzeituhr;
      sim.threats.sweeps.push({
        x: e.x, z: e.z, r: Z.hand, r0: e.def.radius * 0.5, a: angleOf(dx, dz) - 50 * DEG, t: 0, wind: k.wind, dur: k.go,
        w0: Z.handFrom, w1: Z.handTo, damage: damageOf(e, Z.handDamage), floor: Z.handFloor, width: Z.handWidth, hit: false, src,
      });
      break;
    }
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
    case 'shove': {
      // A circle in front of him: whoever stands in it is shoved out (Zone.push).
      const T = BOSS.tuersteher;
      addZone(sim, { x: e.x + sp.dx * T.shoveAhead, z: e.z + sp.dz * T.shoveAhead, r: T.shoveRadius, t: sp.wind, max: sp.wind, damage: damageOf(e, T.shoveDamage), floor: T.shoveFloor, kind: 'shove', src, push: T.push });
      break;
    }
    case 'land': {
      // She sinks onto the marked circle under her; it hits on touchdown.
      const W = BOSS.wachdrohne;
      addZone(sim, { x: e.x, z: e.z, r: W.landRadius, t: sp.wind, max: sp.wind, damage: damageOf(e, W.landDamage), floor: W.landFloor, kind: 'land', src });
      break;
    }
    case 'roar':
      // Fortissimo: every Boxenkopf alive pulses with the Dirigent.
      if (e.kind === 'dirigent') for (const o of sim.enemies) {
        if (o.kind !== 'bass' || o.state === 'dead') continue;
        o.open = 0;
        begin(sim, o, 'bass');
        o.sp!.wind = sp.wind;
        o.cd[1] = range(sim, THREAT.bass.every);
      }
      break;
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
      // The Wachdrohne's laser volley (also fired by a searchlight lock).
      if (e.kind === 'wachdrohne') {
        laserVolley(sim, e);
        return;
      }
      // A boss-strength fan: five rifle shots across the hero's line.
      const G = BOSS.grenzer;
      for (let i = 0; i < G.shots; i++) fireShot(sim, e, aim + (i - (G.shots - 1) / 2) * G.spread, G.volleySpeed, damageOf(e, G.volleyDamage), G.volleyLife, BOSS.ring.radius);
      sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: true });
      break;
    }
    case 'seeds': {
      // Kernspeier (2D `kern`): three seeds ±15° at 70 % of its hit.
      const K = THREAT.seeds;
      for (const o of [-K.spread, 0, K.spread]) fireShot(sim, e, aim + o, K.speed, damageOf(e, K.damage), K.life, K.radius);
      sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: false });
      break;
    }
    case 'key': {
      // The key is wound: a ring of sparks.
      const n = BOSS.uhrwerkgross.shots;
      e.orb += 0.37;
      for (let i = 0; i < n; i++) fireShot(sim, e, (i / n) * Math.PI * 2 + e.orb, BOSS.ring.speed, damageOf(e, BOSS.ring.damage), BOSS.ring.life, BOSS.ring.radius);
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
    case 'bass': {
      // Basswelle: one ring to roll through; the bodies around are driven on.
      const B = THREAT.bass;
      sim.threats.waves.push({ x: e.x, z: e.z, r: B.start, max: B.max, speed: BOSS.roar.speed, damage: damageOf(e, B.damage), floor: B.floor, width: BOSS.roar.width, hit: false });
      for (const o of sim.enemies) if (o !== e && o.state !== 'dead' && Math.hypot(o.x - e.x, o.z - e.z) < B.buffRange) o.buff = B.buff;
      break;
    }
    case 'beat': {
      // Takt: one ring on the beat.
      const D = BOSS.dirigent;
      sim.threats.waves.push({ x: e.x, z: e.z, r: 0, max: D.beatMax, speed: BOSS.roar.speed, damage: damageOf(e, D.beatDamage), floor: D.beatFloor, width: BOSS.roar.width, hit: false });
      break;
    }
    case 'roar': {
      const R = BOSS.roar;
      const ro = roarOf(e);
      for (let i = 0; i < ro.n; i++) sim.threats.waves.push({ x: e.x, z: e.z, r: -i * ro.gap, max: ro.max, speed: R.speed, damage: damageOf(e, ro.damage), floor: ro.floor, width: R.width, hit: false });
      if (e.kind === 'dirigent') sim.events.push({ type: 'note', text: 'Fortissimo!', color: '#ff4fa3', x: e.x, z: e.z });
      for (const o of sim.enemies) if (o !== e && o.state !== 'dead' && Math.hypot(o.x - e.x, o.z - e.z) < R.buffRange) o.buff = R.buff;
      if (e.kind === 'rex' && ++e.cycle % BOSS.rex.raptorsEvery === 0) summon(sim, e, 'raptor', 2);
      // Spreewelle: in rage the river washes rats up with every wave.
      if (e.kind === 'spreehexe' && e.rage) summon(sim, e, 'rat', BOSS.spreehexe.rageAdds);
      break;
    }
    case 'summon':
      if (e.kind === 'tuersteher') {
        summon(sim, e, 'kabel', e.rage ? BOSS.tuersteher.rageAdds : BOSS.tuersteher.adds);
        sim.events.push({ type: 'note', text: '„Nicht auf der Liste!“', color: '#ff4fa3', x: e.x, z: e.z });
        break;
      }
      if (e.kind === 'wachdrohne') {
        summon(sim, e, 'drone', BOSS.wachdrohne.adds);
        break;
      }
      if (e.kind === 'dirigent') {
        summon(sim, e, 'bass', BOSS.dirigent.adds);
        break;
      }
      if (e.kind === 'bassprediger') {
        const B = BOSS.bassprediger;
        if (e.rage) summon(sim, e, 'bass', B.rageAdds);
        else summon(sim, e, 'kabel', B.adds);
        sim.events.push({ type: 'note', text: '„Gemeinde!“', color: '#ff4fa3', x: e.x, z: e.z });
        break;
      }
      if (e.kind === 'grenzer') {
        summon(sim, e, 'runner', BOSS.grenzer.adds);
        sim.events.push({ type: 'note', text: '„Alarm!“', color: '#f2d14b', x: e.x, z: e.z });
        break;
      }
      if (e.kind === 'rattenmutter') {
        summon(sim, e, 'rat', BOSS.rattenmutter.adds);
        break;
      }
      if (e.kind === 'wurzelmutter') {
        summon(sim, e, 'kernspeier', e.rage ? BOSS.wurzelmutter.rageAdds : BOSS.wurzelmutter.adds);
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

export function summon(sim: Sim, e: Enemy, kind: EnemyKind, count: number): void {
  let alive = 0;
  // Sleeping side-passage guards (lot types) are not adds: on a map full of them no boss could call (M12c fix).
  for (const o of sim.enemies) if (o.state !== 'dead' && !o.def.boss && o.sleep === undefined) alive++;
  // M12c: kinds with a cap (Boxenkopf) never go past it.
  const cap = ENEMIES[kind].cap;
  const n = Math.min(count, BOSS.summon.maxAdds - alive, cap === undefined ? Infinity : cap - aliveOf(sim, kind));
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
  // M12c Türsteher: holding the hero. A roll (or a leap away) breaks free; else the throw ends it.
  if (sp.kind === 'grab' && sp.hit) {
    const T = BOSS.tuersteher;
    const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
    const held = p.rootBy === e.id && p.state !== 'dead' && d < e.def.radius + PLAYER.radius + 1.2;
    if (held && p.root > 0) return;
    if (held && threatHit(sim, e, damageOf(e, T.throwDamage), 0, (p.x - e.x) / d, (p.z - e.z) / d)) pushPlayer(sim, (p.x - e.x) / d, (p.z - e.z) / d, T.throwPush);
    if (p.rootBy === e.id) { p.root = 0; p.rootBy = 0; }
    finish(sim, e, sp);
    return;
  }
  if (sp.speed > 0) {
    out.x = sp.dx * sp.speed;
    out.z = sp.dz * sp.speed;
    if (!sp.hit && Math.hypot(p.x - e.x, p.z - e.z) < e.def.radius + PLAYER.radius + 0.15) {
      const boss = sp.kind === 'charge';
      const C = e.kind === 'bassprediger' ? BOSS.bassprediger : BOSS.charge;
      const mul = sp.kind === 'lunge' ? THREAT.lunge.damage : boss ? C.damage : sp.kind === 'grab' ? BOSS.tuersteher.grabDamage : sp.kind === 'leap' ? THREAT.leap.damage : 1;
      const raw = RUSH[sp.kind] ? RUSH[sp.kind]! * e.dmgMul : damageOf(e, mul);
      if (threatHit(sim, e, raw, boss ? C.floor : 0, sp.dx, sp.dz)) {
        sp.hit = true;
        if (sp.kind === 'grab') {
          // Caught: the hero is held where it stands.
          sp.speed = 0;
          out.x = out.z = 0;
          p.root = BOSS.tuersteher.hold;
          p.rootBy = e.id;
          sim.events.push({ type: 'note', text: 'Festgehalten', color: '#ff4fa3', x: p.x, z: p.z });
          return;
        }
      }
    }
  }
  if (e.stateT < sp.wind + sp.go) return;
  finish(sim, e, sp);
}

/** A special is over: punish window (crows sit dazed instead), what follows it, a short pause. */
function finish(sim: Sim, e: Enemy, sp: Special): void {
  let open = sp.open;
  // M12c: the Türsteher shoves twice in rage (the second without the first's opening);
  // the Bassprediger preaches after every second charge, after every charge in rage.
  if (sp.kind === 'shove' && e.rage && !sp.queued) {
    e.queue = { kind: 'shove', t: BOSS.tuersteher.rageGap };
    open = 0;
  }
  if (sp.kind === 'charge' && e.kind === 'bassprediger' && (++e.cycle % BOSS.bassprediger.sermonEvery === 0 || e.rage)) e.queue = { kind: 'roar', t: 0 };
  // Playtest 2026-11-18: in rage the Hauptmann fires a second ring right after the first.
  if (sp.kind === 'ring' && e.kind === 'hauptmann' && e.rage && !sp.queued) e.queue = { kind: 'ring', t: BOSS.hauptmann.ringGap };
  if (sp.kind === 'dive') e.rest = THREAT.dive.rest;
  else if (open > 0) {
    e.open = open;
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
  // M15: a spinning ring sprays shots (Koloss gears in two arms, the Weltzeituhr's planets in three).
  if ((e.spin ?? 0) > 0) {
    const K = BOSS.volkskoloss, Z = BOSS.weltzeituhr, clock = e.kind === 'weltzeituhr';
    e.spin! -= DT;
    e.sprayT = (e.sprayT ?? 0) - DT;
    if (e.sprayT <= 0) {
      e.sprayT = clock ? Z.orbitEvery : K.gearEvery;
      const arms = clock ? Z.arms : 2;
      const a = sim.time * (clock ? Z.orbitTurn : K.gearTurn);
      for (let i = 0; i < arms; i++) {
        const o = a + (i * Math.PI * 2) / arms;
        if (clock) fireShot(sim, e, o, Z.orbitSpeed, damageOf(e, Z.orbitDamage), Z.orbitLife, BOSS.ring.radius);
        else fireShot(sim, e, o, K.gearSpeed, damageOf(e, K.gearDamage), K.gearLife, BOSS.ring.radius);
      }
      // One shot sound per volley of the spiral is enough.
      if (Math.floor(sim.time * 3) !== Math.floor((sim.time - (clock ? Z.orbitEvery : K.gearEvery)) * 3)) sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: true });
    }
  }
  if (e.kind === 'weltzeituhr') {
    // Stillstand at 75, 50 and 25 % life: time stops for the hero, two Uhrwerkläufer drop in.
    const Z = BOSS.weltzeituhr;
    const k = e.still ?? 0;
    if (k < Z.still.length && e.hp < e.maxHp * Z.still[k]!) {
      e.still = k + 1;
      p.slowT = Z.stillTime;
      summon(sim, e, 'uhrwerk', Z.adds);
      sim.events.push({ type: 'note', text: 'Stillstand', color: '#f2d14b', x: p.x, z: p.z });
    }
    return;
  }
  if (e.kind === 'rattenmutter') {
    const R = BOSS.rattenmutter;
    e.trailT -= DT;
    if (e.trailT <= 0 && e.speed > 0.3) {
      e.trailT = R.trailEvery;
      addHazard(sim, { x: e.x, z: e.z, r: R.trailRadius, t: R.trailTime, damage: damageOf(e, R.trailDamage), kind: 'acid' });
    }
  } else if (e.kind === 'wachdrohne') {
    // Searchlights: one while she flies, two in rage, none on the ground.
    const W = BOSS.wachdrohne;
    const down = e.open > 0 || (e.state === 'special' && e.sp?.kind === 'land');
    const want = down ? 0 : e.rage ? 2 : 1;
    const list = sim.threats.spots;
    let have = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]!.src !== e.id) continue;
      if (list[i]!.slot >= want) list.splice(i, 1);
      else have |= 1 << list[i]!.slot;
    }
    for (let slot = 0; slot < want; slot++) if (!(have & (1 << slot))) list.push({ x: e.x, z: e.z, px: e.x, pz: e.z, r: W.spotRadius, src: e.id, slot, inT: 0, flash: 0, cool: 0 });
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
  // M12c: a special that follows another (rage shove, the Basspredigt) comes first, past the pause.
  if (e.queue) {
    e.queue.t -= DT;
    if (e.queue.t <= 0) {
      const k = e.queue.kind;
      e.queue = undefined;
      begin(sim, e, k, true);
      return plan;
    }
    // The pause before it: no strike and no other special takes its place (Codex on PR 53).
    plan.melee = false;
    plan.mode = 'hold';
    return plan;
  }
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
      // M12c: the Kabelghul leaps with its own numbers; its cooldown is fixed per body (2D R(2.2, 3)).
      const leap = e.kind === 'kabel';
      const P = leap ? THREAT.leap : THREAT.pounce;
      // An elite raptor has its modifier's special beside the pounce.
      if (e.elite && eliteThink(sim, e, e.elite, dist)) return plan;
      if (e.cd[1] <= 0 && dist < P.range && dist > 1.6 && sim.flow.clearLine(e.x, e.z, p.x, p.z)) {
        const L = THREAT.leap.every;
        e.cd[1] = leap ? L[0] + (L[1] - L[0]) * jitter(e.id, 6) : THREAT.pounce.every;
        begin(sim, e, leap ? 'leap' : 'pounce');
        return plan;
      }
      break;
    }
    case 'bass': {
      // Boxenkopf: a Brocken's strike without the slam, and the bass ring.
      const B = THREAT.bass;
      if (e.elite && eliteThink(sim, e, e.elite, dist)) return plan;
      if (e.cd[1] <= 0 && dist < B.range) {
        e.cd[1] = range(sim, B.every);
        begin(sim, e, 'bass');
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
    case 'wurzler': {
      // 2D `wurz`: roots under the hero within 10 m, slower when close; open after the cast.
      const R = THREAT.roots;
      if (e.cd[1] <= 0 && dist < R.range) {
        e.cd[1] = range(sim, R.every);
        begin(sim, e, 'roots');
        return plan;
      }
      if (dist < R.near) plan.speed = R.nearSpeed;
      break;
    }
    case 'kernspeier': {
      // 2D `kern`: walks into range, plants itself, spits three seeds; backs off when the hero comes close.
      const K = THREAT.seeds;
      const sight = dist < K.range && sim.flow.clearLine(e.x, e.z, p.x, p.z);
      if (e.cd[1] <= 0 && sight) {
        e.cd[1] = range(sim, K.every);
        begin(sim, e, 'seeds');
        return plan;
      }
      if (dist < K.near) {
        plan.mode = 'dir';
        plan.x = -ux;
        plan.z = -uz;
        plan.speed = 0.7;
      } else if (dist < K.far && sight) {
        plan.mode = 'dir';
        plan.x = uz * e.side;
        plan.z = -ux * e.side;
        plan.speed = 0.4;
      }
      break;
    }
    case 'rat':
      // 2D: the heading swings ±0.6 rad seven times a second while closing in; straight for the bite.
      if (dist > 1.6) plan.turn = Math.sin(sim.time * 7 + jitter(e.id, 5) * Math.PI * 2) * 0.6;
      break;
    case 'grenzer':
    case 'wachdrohne': {
      // Keeps the watchtower distance: backs off when the hero comes close, strafes in range.
      const G = e.def.ai === 'wachdrohne' ? BOSS.wachdrohne : BOSS.grenzer;
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
    case 'tuersteher': {
      // Gästeliste, Schubser up close, Griff from a few meters.
      const T = BOSS.tuersteher;
      if (e.cd[2] <= 0) {
        e.cd[2] = T.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist < T.shoveRange) {
        e.cd[0] = T.shove;
        begin(sim, e, 'shove');
      } else if (e.cd[1] <= 0 && dist > T.grabMin && dist < T.grabMax && sight()) {
        e.cd[1] = T.grab;
        begin(sim, e, 'grab');
      }
      break;
    }
    case 'wachdrohne': {
      // Drones and volleys on their cooldowns; every third special she lands instead.
      const W = BOSS.wachdrohne;
      const due = e.cd[2] <= 0 ? 'summon' : e.cd[0] <= 0 && dist < 14 && sight() ? 'volley' : null;
      if (!due) break;
      if (due === 'summon') e.cd[2] = W.summon;
      else e.cd[0] = W.volley;
      begin(sim, e, ++e.cycle % W.landEvery === 0 ? 'land' : due);
      break;
    }
    case 'dirigent': {
      // Orchester at the start and once more at half life; then the beat, every fourth one a Fortissimo.
      const D = BOSS.dirigent;
      const calls = e.calls ?? 0;
      if (calls < (e.rage ? 2 : 1)) {
        e.calls = calls + 1;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0) {
        e.cd[0] = D.beat;
        begin(sim, e, ++e.cycle % D.fortEvery === 0 ? 'roar' : 'beat');
      }
      break;
    }
    case 'bassprediger': {
      // Gemeinde, and the Stromstoß along a marked line (the Basspredigt follows from `finish`).
      const B = BOSS.bassprediger;
      if (e.cd[2] <= 0) {
        e.cd[2] = B.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist < B.range && dist > 3 && sight()) {
        e.cd[0] = B.charge;
        begin(sim, e, 'charge');
      }
      break;
    }
    case 'wurzelmutter': {
      const W = BOSS.wurzelmutter;
      if (e.cd[2] <= 0 && dist < W.close) {
        e.cd[2] = W.slam;
        begin(sim, e, 'rootRing');
      } else if (e.cd[0] <= 0 && dist < 16) {
        e.cd[0] = W.fields;
        begin(sim, e, 'roots');
      } else if (e.cd[1] <= 0) {
        e.cd[1] = W.summon;
        begin(sim, e, 'summon');
      }
      break;
    }
    case 'uhrwerkgross': {
      // Charge cycles; every third one it stops to wind its key instead.
      const U = BOSS.uhrwerkgross;
      if (e.cd[0] > 0) break;
      if ((e.cycle + 1) % U.keyEvery === 0) {
        e.cd[0] = U.charge;
        e.cycle++;
        begin(sim, e, 'key');
      } else if (dist < 15 && dist > 3 && sight()) {
        e.cd[0] = U.charge;
        e.cycle++;
        begin(sim, e, 'charge');
      }
      break;
    }
    case 'volkskoloss': {
      const K = BOSS.volkskoloss;
      if (e.cd[2] <= 0 && dist < K.close) {
        e.cd[2] = K.slam;
        begin(sim, e, 'bossSlam');
      } else if (e.cd[0] <= 0) {
        // Real seconds as in 2D (4.4, in rage 3.2): undo the rage tick rate.
        e.cd[0] = K.cycle[e.rage ? 1 : 0] * (e.rage ? BOSS.rageRate : 1);
        e.cycle++;
        if (e.cycle % K.addsEvery === 0) summon(sim, e, 'uhrwerk', K.adds);
        if (e.cycle % 2) begin(sim, e, 'slabs');
        else {
          e.spin = K.spin;
          e.sprayT = 0;
          sim.events.push({ type: 'enemySpecial', id: e.id, kind: 'ring', phase: 'wind', x: e.x, z: e.z });
        }
      }
      break;
    }
    case 'weltzeituhr': {
      const Z = BOSS.weltzeituhr;
      if (e.cd[2] <= 0 && dist < Z.close) {
        e.cd[2] = Z.stomp;
        begin(sim, e, 'bossSlam');
      } else if (e.cd[0] <= 0) {
        e.cd[0] = Z.cycle;
        e.cycle++;
        if (e.cycle % 3 === 0) begin(sim, e, 'hand');
        else {
          begin(sim, e, 'sectors');
          if (e.cycle % 2 === 0) {
            e.spin = Z.spin;
            e.sprayT = 0;
          }
        }
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
      } else if (e.cd[0] <= 0 && dist > H.chargeFrom && dist < BOSS.charge.range && sight()) {
        // „Sturmangriff!“ (playtest 2026-11-18): kiting him no longer works.
        e.cd[0] = range(sim, H.charge);
        begin(sim, e, 'charge');
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
    case 'bass': e.cd = [r(THREAT.slam.first[0], THREAT.slam.first[1], 1), r(THREAT.bass.first[0], THREAT.bass.first[1], 2), 0]; break;
    case 'tuersteher': e.cd = [1.5, 3, 5]; break;
    case 'wachdrohne': e.cd = [2, 0, 6]; break;
    case 'dirigent': e.cd = [3, 0, 0]; break;
    case 'bassprediger': e.cd = [2.5, 0, 6]; break;
    case 'wurzler': e.cd = [0, r(2, 3.5, 2), 0]; break;
    case 'kernspeier': e.cd = [0, r(1.5, 2.5, 2), 0]; break;
    case 'wurzelmutter': e.cd = [2, 6, 0]; break;
    case 'uhrwerkgross': e.cd = [2.5, 0, 0]; break;
    case 'volkskoloss': e.cd = [2, 0, 1]; break;
    case 'weltzeituhr': e.cd = [1.5, 0, 2]; break;
    default: e.cd = [r(THREAT.slam.first[0], THREAT.slam.first[1], 1), 0, 0]; break;
  }
}
