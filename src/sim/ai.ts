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
// WP5 (backlog P12): the Zünder lights its fuse and blows up, the Heuler keeps back and howls the others on.
// M16 (Charlottenburg, `docs/tasks/m12d-charlottenburg-enemies.md`): the Scherbentänzerin's pirouette, the
// Logenbrecher's Faustschlag, the Spiegelsouffleur's cue and shard fan; the Conférencier (acts, spotlight, cane),
// the Ringvater (guards, charging blow), the Spiegelpaar (a reflection, crossing pirouettes, the swap) and the
// Diva (fans, prism rays, gown tiers).
// M18 (Wedding, `docs/tasks/m12e-wedding-enemies.md`): no new brain. The Tee-Ifrit throws one Molotov glass, the
// Teppichschlinger's dive line is marked, Der Zugezogene (charge, coffee cups) and the Bauherr call Zecher and a crew, the Hauptgericht is
// the Rex's brain, Sultan Nimmersatt the Diva's with his numbers (`divaOf`).
import { BOSS, ENEMIES, THREAT, type EliteMod, type EnemyKind } from '../data/enemies';
import { freeSpot, lineClear } from './reach';
import { inRoom } from './level';
import { addHazard, addZone, fireShot, laserVolley, pushPlayer, threatHit, type Special, type SpecialKind } from './threats';
import { DEG } from './math';
import { PLAYER } from '../data/combat';
import { aliveOf, spawnEnemy } from './enemies';
import { guarded, killEnemy, vanish } from './combat';
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

/** M18: the Diva's brain runs on her numbers or Sultan Nimmersatt's. */
const divaOf = (e: Enemy): typeof BOSS.diva | typeof BOSS.sultan => (e.kind === 'sultan' ? BOSS.sultan : BOSS.diva);

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
  fuse: { wind: THREAT.fuse.wind, go: 0.05, open: 0 },
  howl: { wind: THREAT.howl.wind, go: 0.3, open: THREAT.howl.open },
  pirouette: { wind: THREAT.pirouette.wind, go: THREAT.pirouette.time, open: THREAT.pirouette.open, speed: THREAT.pirouette.speed },
  faust: { wind: THREAT.faust.wind, go: 0.3, open: THREAT.faust.open },
  prism: { wind: BOSS.diva.prismWind, go: BOSS.diva.prismTime, open: BOSS.diva.prismOpen },
  swap: { wind: BOSS.spiegelpaar.swapWind, go: 0.2, open: BOSS.spiegelpaar.swapOpen },
};

/** Own timing of a shared block for one kind (M12c: the Bassprediger's charge, the Dirigent's Fortissimo, the Wachdrohne's volley). */
function own(e: Enemy, kind: SpecialKind): Partial<Pick<Special, 'wind' | 'go' | 'open' | 'speed' | 'mul' | 'floor'>> | null {
  if (kind === 'charge' && e.kind === 'bassprediger') { const B = BOSS.bassprediger; return { wind: B.wind, go: B.time, open: B.open, speed: B.speed }; }
  if (kind === 'roar' && e.kind === 'dirigent') return { wind: BOSS.dirigent.beatWind, open: BOSS.dirigent.fortOpen };
  if (kind === 'volley' && e.kind === 'wachdrohne') return { wind: BOSS.wachdrohne.volleyWind };
  // M16 rushes with their own hit: the Stockstoß, the Ringschlag, the Doppelpirouette (the reflection's speed is set in `begin`).
  if (kind === 'lunge' && e.kind === 'conferencier') { const C = BOSS.conferencier; return { wind: C.lungeWind, go: C.lungeTime, open: C.lungeOpen, speed: C.lungeSpeed, mul: C.lungeDamage }; }
  if (kind === 'charge' && e.kind === 'zugezogene') { const Z = BOSS.zugezogene; return { wind: Z.chargeWind, go: Z.chargeTime, speed: Z.chargeSpeed }; }
  if (kind === 'charge' && e.kind === 'ringvater') { const R = BOSS.ringvater; return { wind: R.wind, go: R.time, open: R.open, speed: R.speed, mul: R.damage, floor: R.floor }; }
  if (kind === 'lunge' && (e.kind === 'spiegelpaar' || e.kind === 'spiegelbild')) {
    const S = BOSS.spiegelpaar;
    return { wind: S.wind, go: S.time, open: S.open, speed: S.speed, mul: e.kind === 'spiegelbild' ? S.mirrorDamage : S.damage };
  }
  if (kind === 'fan' && e.kind === 'souffleur') return { wind: THREAT.cue.fanWind, open: THREAT.cue.fanOpen };
  if (kind === 'fan' && e.def.ai === 'diva') return { wind: divaOf(e).fanWind, open: 0 };
  if (kind === 'roar' && e.def.ai === 'diva') return { open: divaOf(e).curtainOpen };
  if (kind === 'prism' && e.def.ai === 'diva') { const D = divaOf(e); return { wind: D.prismWind, go: D.prismTime, open: D.prismOpen }; }
  // M18: the Tee-Ifrit's glass (the Brandmeister's bottle block), the carpet's longer marked dive.
  if (kind === 'molotov' && e.kind === 'teeifrit') return { wind: THREAT.tea.wind, open: THREAT.tea.open };
  if (kind === 'dive' && e.kind === 'teppich') return { wind: THREAT.carpetDive.wind };
  return null;
}

/** Rings of a roar (default: two of the 2D bass waves); the Dirigent's Fortissimo and the Basspredigt have their own. */
function roarOf(e: Enemy): { n: number; gap: number; max: number; damage: number; floor: number } {
  const R = BOSS.roar;
  if (e.kind === 'dirigent') { const D = BOSS.dirigent; return { n: 2, gap: D.fortGap, max: D.fortMax, damage: D.fortDamage, floor: D.fortFloor }; }
  if (e.kind === 'bassprediger') { const B = BOSS.bassprediger; return { n: 2, gap: B.gap, max: B.max, damage: B.ringDamage, floor: B.ringFloor }; }
  // M16 Vorhang: one ring when a gown tier bursts.
  if (e.def.ai === 'diva') { const D = divaOf(e); return { n: 1, gap: 0, max: D.curtain, damage: D.curtainDamage, floor: D.curtainFloor }; }
  return { n: 2, gap: R.gap, max: R.max, damage: R.damage, floor: R.floor };
}

/** Specials that move the body along a locked line and hit on contact. */
const RUSH: Partial<Record<SpecialKind, number>> = { pounce: THREAT.pounce.damage, lunge: 0, dive: 0, charge: 0, leap: 0, grab: 0, pirouette: 0 };

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
  // M16 Doppelpirouette: the reflection's line reaches the hero from wherever it stands (at most `mirrorMax` m/s).
  if (kind === 'lunge' && e.kind === 'spiegelbild') {
    const S = BOSS.spiegelpaar;
    sp.speed = Math.min(S.mirrorMax, Math.max(S.speed, (d + 0.4) / sp.go));
  }
  // The Großer Uhrwerkläufer charges slower and winds down longer than the Feldwebel.
  if (kind === 'charge' && e.kind === 'uhrwerkgross') {
    const U = BOSS.uhrwerkgross;
    e.sp.speed = U.speed;
    e.sp.go = U.time;
    e.sp.open = U.open;
  }
  switch (kind) {
    case 'fuse': {
      // The blast circle round the Zünder fills while the fuse burns; it goes off whatever happens (free).
      const F = THREAT.fuse;
      addZone(sim, { x: e.x, z: e.z, r: F.radius, t: k.wind, max: k.wind, damage: damageOf(e, F.damage), floor: F.floor, kind: 'bomb', src, free: true, blast: { share: F.enemyShare, knock: F.knock } });
      break;
    }
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
      if (e.kind === 'spiegelpaar') {
        // M16 Scherbenregen: six shard circles round the hero; in rage the reflection casts a second set later.
        const S = BOSS.spiegelpaar;
        const mirror = sim.enemies.find((o) => o.id === e.pair && o.state !== 'dead');
        for (const [from, delay] of mirror && e.rage ? [[e, 0], [mirror, S.mirrorDelay]] as const : [[e, 0]] as const) {
          for (let i = 0; i < S.drops; i++) {
            const t = B.wind + delay + i * S.step;
            const x = i ? p.x + sim.rng.range(-B.spreadX, B.spreadX) : p.x, z = i ? p.z + sim.rng.range(-B.spreadZ, B.spreadZ) : p.z;
            addZone(sim, { x, z, r: S.radius, t, max: t, damage: damageOf(e, S.rainDamage), floor: S.rainFloor, kind: 'shard', src: from.id, free: true });
          }
        }
        break;
      }
      const n = (e.kind === 'grenzer' ? BOSS.grenzer.extra : BOSS.waechter.extra) + (e.rage ? 2 : 0);
      addZone(sim, { x: p.x, z: p.z, r: B.radius, t: B.wind, max: B.wind, damage: damageOf(e, B.damage), floor: B.floor, kind: 'bomb', src, free: true });
      for (let i = 0; i < n; i++) {
        const t = B.wind + (i + 1) * B.step;
        addZone(sim, { x: p.x + sim.rng.range(-B.spreadX, B.spreadX), z: p.z + sim.rng.range(-B.spreadZ, B.spreadZ), r: B.radius, t, max: t, damage: damageOf(e, B.damage), floor: B.floor, kind: 'bomb', src, free: true });
      }
      break;
    }
    case 'molotov': {
      // M18 Teeglas: one glass on the hero that leaves hot tea.
      if (e.kind === 'teeifrit') {
        const T = THREAT.tea;
        addZone(sim, { x: p.x, z: p.z, r: T.radius, t: sp.wind, max: sp.wind, damage: damageOf(e, T.damage), floor: 0, kind: 'tea', src, free: true, leave: { r: T.puddle, t: T.puddleTime, damage: damageOf(e, T.puddleDamage), kind: 'fire' } });
        break;
      }
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
    case 'faust': {
      // M16 Logenbrecher: the fists come down on a circle in front of him.
      const F = THREAT.faust;
      addZone(sim, { x: e.x + sp.dx * F.ahead, z: e.z + sp.dz * F.ahead, r: F.radius, t: sp.wind, max: sp.wind, damage: damageOf(e, F.damage), floor: F.floor, kind: 'faust', src });
      break;
    }
    case 'prism': {
      // M16 Prismenstrahl: strips through the hero, one more per gown tier broken (an X, then three fanned out).
      // M18: the Sultan's carpet strips, the same with his width.
      const D = divaOf(e);
      const phase = Math.min(2, e.still ?? 0);
      const offs = phase === 0 ? [0] : phase === 1 ? [-D.cross, D.cross] : [-D.spread3, 0, D.spread3];
      const a0 = angleOf(dx, dz);
      for (const o of offs) addZone(sim, {
        x: p.x, z: p.z, r: D.prismHalf, t: sp.wind, max: sp.wind, damage: damageOf(e, D.prismDamage), floor: D.prismFloor, kind: e.kind === 'sultan' ? 'carpet' : 'prism', src, free: true,
        line: { dx: Math.sin(a0 + o), dz: Math.cos(a0 + o), half: D.prismHalf, width: D.prismWidth }, act: D.prismTime,
      });
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
      if (e.kind === 'souffleur') {
        // M16 Scherbenfächer: five shards across the hero's line.
        const C = THREAT.cue;
        for (let i = 0; i < C.shots; i++) fireShot(sim, e, aim + (i - (C.shots - 1) / 2) * C.spread, C.speed, damageOf(e, C.damage), C.life, THREAT.spit.radius);
      } else if (e.def.ai === 'diva') {
        // M16 Fächerschlag: one fan now, the next ones from `passive` (phase 2: one more, phase 3: two more).
        const D = divaOf(e);
        const phase = Math.min(2, e.still ?? 0);
        divaFan(sim, e, aim + (phase === 2 ? -D.turn3 : 0));
        if (phase > 0) e.fans = { n: phase, t: D.fanGap, aim, k: 1 };
      } else for (const o of [-THREAT.fan.spread, 0, THREAT.fan.spread]) fireShot(sim, e, aim + o, THREAT.fan.speed, damageOf(e), THREAT.spit.life, THREAT.spit.radius);
      sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: !!e.def.boss });
      break;
    case 'swap': {
      // M16 Tausch: the real one and her reflection change places (the sash and the ring go with her).
      const m = sim.enemies.find((o) => o.id === e.pair && o.state !== 'dead');
      // The reflection flies; she walks. No swap onto ground she cannot stand on (water, a wall): she keeps her place.
      if (m && !sim.level.blocked(m.x, m.z, e.def.radius)) {
        const x = e.x, z = e.z;
        e.x = e.px = m.x;
        e.z = e.pz = m.z;
        m.x = m.px = x;
        m.z = m.pz = z;
        m.sp = null;
        m.state = 'chase';
        m.stateT = 0;
      }
      break;
    }
    case 'dive': {
      // The crow commits when it drops, not when it screeches. M18: the carpet keeps the line it marked at the start.
      if (e.kind === 'teppich') break;
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
    case 'fuse':
      // The blast is the zone (it kills the Zünder when it goes off); this only covers a zone that is gone.
      e.blown = true;
      killEnemy(sim, e, false);
      break;
    case 'howl': {
      // Heuler (2D `howl`): every other body within range is driven on; a harmless pink ring shows how far.
      const H = THREAT.howl;
      for (const o of sim.enemies) if (o !== e && o.state !== 'dead' && Math.hypot(o.x - e.x, o.z - e.z) < H.buffRange) o.buff = Math.max(o.buff, H.buff);
      sim.threats.waves.push({ x: e.x, z: e.z, r: e.def.radius, max: H.buffRange, speed: BOSS.roar.speed, damage: 0, floor: 0, width: BOSS.roar.width, hit: true });
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
      if (e.kind === 'conferencier') {
        // Nummer: „Tanz“ and „Kraftakt“ by turns, both in rage.
        const C = BOSS.conferencier;
        const dance = e.rage || e.cycle % 2 === 0, act = e.rage || e.cycle % 2 === 1;
        e.cycle++;
        if (dance) summon(sim, e, 'scherbe', C.dance);
        if (act) summon(sim, e, 'loge', C.act);
        sim.events.push({ type: 'note', text: '„Die nächste Nummer!“', color: '#f2d14b', x: e.x, z: e.z });
        break;
      }
      if (e.kind === 'ringvater') {
        // Leibwache at the entrance and once more at half life; Schutzgeld (his collectors) on the cooldown.
        const R = BOSS.ringvater;
        const calls = e.calls ?? 0;
        if (calls === 0 || (e.rage && calls === 1)) {
          e.calls = calls + 1;
          summon(sim, e, 'loge', calls === 0 ? R.escort : R.rageGuards);
          sim.events.push({ type: 'note', text: '„Leibwache!“', color: '#f2d14b', x: e.x, z: e.z });
        } else {
          summon(sim, e, 'runner', R.adds);
          sim.events.push({ type: 'note', text: '„Schutzgeld!“', color: '#f2d14b', x: e.x, z: e.z });
        }
        break;
      }
      if (e.kind === 'diva') {
        const D = BOSS.diva;
        summon(sim, e, 'scherbe', D.adds);
        if ((e.still ?? 0) >= 2) summon(sim, e, 'souffleur', 1);
        sim.events.push({ type: 'note', text: '„Zugabe!“', color: '#ff9fd8', x: e.x, z: e.z });
        break;
      }
      if (e.kind === 'sultan') {
        // M18 Nachschlag: tea spirits, from the dessert on a carpet too.
        const S = BOSS.sultan;
        summon(sim, e, 'teeifrit', S.adds);
        if ((e.still ?? 0) >= 2) summon(sim, e, 'teppich', S.carpets);
        sim.events.push({ type: 'note', text: '„Nachschlag!“', color: '#f2d14b', x: e.x, z: e.z });
        break;
      }
      if (e.kind === 'zugezogene') {
        // M18: two Zecher (a Schlurfer and a Hetzer), in rage a Brocken too.
        const G = BOSS.zugezogene;
        summon(sim, e, 'walker', G.adds);
        summon(sim, e, 'runner', G.runners);
        if (e.rage) summon(sim, e, 'brute', G.rageBrutes);
        sim.events.push({ type: 'note', text: '„Bald nur noch Hafermilch!“', color: '#f2d14b', x: e.x, z: e.z });
        break;
      }
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

/** M16 Fächerschlag: `blades` blades over the cone round `aim` (M18: the Sultan's tea glasses). */
function divaFan(sim: Sim, e: Enemy, aim: number): void {
  const D = divaOf(e);
  for (let i = 0; i < D.blades; i++) fireShot(sim, e, aim + (i / (D.blades - 1) - 0.5) * D.cone, D.bladeSpeed, damageOf(e, D.bladeDamage), D.bladeLife, BOSS.ring.radius);
}

/** Shots in a boss's ring (default: the Turmwächter's twelve). */
const RING_SHOTS: Partial<Record<EnemyKind, number>> = { hauptmann: BOSS.hauptmann.shots, brandmeister: BOSS.brandmeister.shots, spreehexe: BOSS.spreehexe.shots };

export function summon(sim: Sim, e: Enemy, kind: EnemyKind, count: number): void {
  let alive = 0;
  // Sleeping side-passage guards (lot types) are not adds: on a map full of them no boss could call (M12c fix).
  // M16: nor is a reflection.
  for (const o of sim.enemies) if (o.state !== 'dead' && !o.def.boss && o.sleep === undefined && o.mirrorOf === undefined) alive++;
  // M12c: kinds with a cap (Boxenkopf) never go past it.
  const cap = ENEMIES[kind].cap;
  const n = Math.min(count, BOSS.summon.maxAdds - alive, cap === undefined ? Infinity : cap - aliveOf(sim, kind));
  // M18 walk-in room (Codex review of PR 81): a boss inside its encounter's room calls its adds inside the walls too.
  const room = e.enc === undefined ? undefined : sim.level.encounters[e.enc]?.room;
  const inside = room && inRoom(room, e.x, e.z) ? (x: number, z: number): boolean => inRoom(room, x, z, ENEMIES[kind].radius + 0.1) : undefined;
  // B2 step 2: an add comes out of the boss, so never from behind a wall (a Tee-Ifrit summoned behind the
  // Hochzeitspalast front stood in a strip the hero could not reach, and the fight never ended).
  const r = ENEMIES[kind].radius;
  const ok = (x: number, z: number): boolean => (!inside || inside(x, z)) && lineClear(sim.level, e.x, e.z, x, z, r * 0.8);
  for (let i = 0; i < n; i++) {
    // No spot found: a free point on a ring around the boss (same rules: inside its room, not behind a wall, not in a
    // collider), else just off its centre (bodies at one point get no push apart).
    const fd = e.def.radius + r + 0.1;
    let q = freeSpot(sim.level, sim.rng, e.x, e.z, e.def.radius + 0.6, e.def.radius + BOSS.summon.spread, r + 0.1, ok);
    for (let k = 0; k < 6 && !q; k++) {
      const a = i * 2.4 + (k * Math.PI) / 3, x = e.x + Math.sin(a) * fd, z = e.z + Math.cos(a) * fd;
      if (ok(x, z) && !sim.level.blocked(x, z, r)) q = { x, z };
    }
    q ??= { x: e.x + Math.sin(i * 2.4) * 0.05, z: e.z + Math.cos(i * 2.4) * 0.05 };
    // A boss's adds belong to its fight (`Enemy.enc`).
    spawnEnemy(sim, q.x, q.z, kind, e.hpMul, e.dmgMul).enc = e.enc;
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
    if (e.state === 'dead') return;
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
      const mul = sp.mul ?? (sp.kind === 'lunge' ? THREAT.lunge.damage : boss ? C.damage : sp.kind === 'grab' ? BOSS.tuersteher.grabDamage : sp.kind === 'leap' ? THREAT.leap.damage : sp.kind === 'pirouette' ? THREAT.pirouette.damage : 1);
      const raw = RUSH[sp.kind] ? RUSH[sp.kind]! * e.dmgMul : damageOf(e, mul);
      if (threatHit(sim, e, raw, sp.floor ?? (boss ? C.floor : 0), sp.dx, sp.dz)) {
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
  // M16: in rage the Ringvater's Ringschlag comes twice (the second along a new line, the first without its opening).
  // M18: Der Zugezogene charges twice the same way on his e-scooter.
  if (sp.kind === 'charge' && (e.kind === 'ringvater' || e.kind === 'zugezogene') && e.rage && !sp.queued) {
    e.queue = { kind: 'charge', t: e.kind === 'zugezogene' ? BOSS.zugezogene.rageGap : BOSS.ringvater.rageGap };
    open = 0;
  }
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
  if (e.kind === 'brandmeister') {
    // H3: fire where he walks (2D boss trail), as the Rattenmutter's acid.
    const M = BOSS.brandmeister;
    e.trailT -= DT;
    if (e.trailT <= 0 && e.speed > 0.3) {
      e.trailT = M.trailEvery;
      addHazard(sim, { x: e.x, z: e.z, r: M.trailRadius, t: M.trailTime, damage: damageOf(e, M.trailDamage), kind: 'fire' });
    }
  } else if (e.kind === 'rattenmutter') {
    const R = BOSS.rattenmutter;
    e.trailT -= DT;
    if (e.trailT <= 0 && e.speed > 0.3) {
      e.trailT = R.trailEvery;
      addHazard(sim, { x: e.x, z: e.z, r: R.trailRadius, t: R.trailTime, damage: damageOf(e, R.trailDamage), kind: 'acid' });
    }
  } else if (e.kind === 'wachdrohne') {
    // Searchlights: one while she flies, two in rage, none on the ground.
    const down = e.open > 0 || (e.state === 'special' && e.sp?.kind === 'land');
    keepSpots(sim, e, down ? 0 : e.rage ? 2 : 1);
  } else if (e.kind === 'conferencier') {
    // M16 Spotlicht: always one, two in rage (the Wachdrohne's searchlight; a lock throws applause).
    keepSpots(sim, e, e.rage ? 2 : 1);
  } else if (e.kind === 'ringvater') {
    // M16: the note shows again once a new guard stands by him.
    if (!guarded(sim, e)) e.guardNote = false;
  } else if (e.kind === 'spiegelpaar') {
    // M16: her reflection, through the arena centre (the encounter's; with `?spawn` where the hero stands, so the two face each other across him).
    if (e.pair === undefined) {
      const enc = sim.level.expedition && sim.run.phase === 'fight' ? sim.level.encounters[sim.run.index] : undefined;
      const c = enc ? { x: enc.x, z: enc.z } : { x: p.x, z: p.z };
      const m = spawnEnemy(sim, 2 * c.x - e.x, 2 * c.z - e.z, 'spiegelbild', e.hpMul, e.dmgMul);
      m.mirrorOf = e.id;
      m.mirror = c;
      m.facing = m.pfacing = e.facing + Math.PI;
      e.pair = m.id;
    }
  } else if (e.def.ai === 'diva') {
    // M16 Vorhang at 66 and 33 % life: the tier bursts (one ring, her blades in flight fall), then she stands open.
    // M18: the Sultan's courses (Hauptgang, Nachtisch) the same way.
    const D = divaOf(e);
    const k = e.still ?? 0;
    if (k < D.tiers.length && e.hp < e.maxHp * D.tiers[k]!) {
      e.still = k + 1;
      e.fans = undefined;
      const T = sim.threats.shots;
      for (let i = T.length - 1; i >= 0; i--) if (T[i]!.src === e.id) T.splice(i, 1);
      e.queue = { kind: 'roar', t: 0 };
      sim.events.push({ type: 'divaTier', id: e.id, tier: k + 1, x: e.x, z: e.z });
      if (e.kind === 'sultan') sim.events.push({ type: 'note', text: k === 0 ? '„Hauptgang!“' : '„Nachtisch!“', color: '#f2d14b', x: e.x, z: e.z });
      else if (k + 1 === D.tiers.length) sim.events.push({ type: 'note', text: '„Der Vorhang fällt“', color: '#ff9fd8', x: e.x, z: e.z });
    }
    // The fans after the first (phase 2: half a gap turned, phase 3: −20°, 0, +20°).
    if (e.fans) {
      e.fans.t -= DT;
      if (e.fans.t <= 0) {
        const off = (e.still ?? 0) >= 2 ? (e.fans.k - 1) * D.turn3 : D.cone / (D.blades - 1) / 2;
        divaFan(sim, e, e.fans.aim + off);
        sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: true });
        e.fans.k++;
        e.fans.t = D.fanGap;
        if (--e.fans.n <= 0) e.fans = undefined;
      }
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

/** The searchlights of `e` (M12c Wachdrohne, M16 Conférencier): `want` of them, slot 1 circles round the hero. */
function keepSpots(sim: Sim, e: Enemy, want: number): void {
  const list = sim.threats.spots;
  let have = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]!.src !== e.id) continue;
    if (list[i]!.slot >= want) list.splice(i, 1);
    else have |= 1 << list[i]!.slot;
  }
  for (let slot = 0; slot < want; slot++) if (!(have & (1 << slot))) list.push({ x: e.x, z: e.z, px: e.x, pz: e.z, r: BOSS.wachdrohne.spotRadius, src: e.id, slot, inT: 0, flash: 0, cool: 0 });
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
      // M16 Logenbrecher: no slam on the hero; his own Faustschlag in front of him (and an elite's special beside it).
      if (e.kind === 'loge') {
        if (e.elite && eliteThink(sim, e, e.elite, dist)) return plan;
        if (e.cd[1] <= 0 && dist < THREAT.faust.range) {
          e.cd[1] = range(sim, THREAT.faust.every);
          begin(sim, e, 'faust');
          return plan;
        }
        break;
      }
      if (eliteThink(sim, e, e.elite ?? 'brute', dist)) return plan;
      break;
    case 'spitter': {
      // M18 Tee-Ifrit: the same distance, a tea glass instead of the spit.
      const tea = e.kind === 'teeifrit';
      const S = tea ? THREAT.tea : THREAT.spit;
      const sight = dist < S.range && sim.flow.clearLine(e.x, e.z, p.x, p.z);
      if (e.elite && sight && eliteThink(sim, e, e.elite, dist)) return plan;
      if (e.cd[1] <= 0 && sight) {
        e.cd[1] = range(sim, S.every);
        begin(sim, e, tea ? 'molotov' : 'spit');
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
      // M16: the Scherbentänzerin's pirouette is the same block with her numbers.
      const leap = e.kind === 'kabel', spin = e.kind === 'scherbe';
      const P = leap ? THREAT.leap : spin ? THREAT.pirouette : THREAT.pounce;
      // An elite raptor has its modifier's special beside the pounce.
      if (e.elite && eliteThink(sim, e, e.elite, dist)) return plan;
      if (e.cd[1] <= 0 && dist < P.range && dist > 1.6 && sim.flow.clearLine(e.x, e.z, p.x, p.z)) {
        const L = spin ? THREAT.pirouette.every : THREAT.leap.every;
        e.cd[1] = leap || spin ? L[0] + (L[1] - L[0]) * jitter(e.id, 6) : THREAT.pounce.every;
        begin(sim, e, leap ? 'leap' : spin ? 'pirouette' : 'pounce');
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
    case 'zuender': {
      // 2D `bomb`: walks up; within 2 m with a clear line it stops and lights the fuse.
      const F = THREAT.fuse;
      if (dist < F.range && sim.flow.clearLine(e.x, e.z, p.x, p.z)) {
        begin(sim, e, 'fuse');
        return plan;
      }
      break;
    }
    case 'heuler': {
      // 2D `howl`: backs off when the hero comes close, strafes at mid range, howls on its cooldown.
      // M16 Spiegelsouffleur: the same with his distance and cues, and a shard fan halfway between two cues.
      const souf = e.kind === 'souffleur';
      const H = souf ? THREAT.cue : THREAT.howl;
      if (e.elite && eliteThink(sim, e, e.elite, dist)) return plan;
      if (e.cd[1] <= 0 && dist < H.range) {
        e.cd[1] = range(sim, H.every);
        if (souf) { e.cd[2] = e.cd[1] / 2; e.cycle = 1; }
        begin(sim, e, 'howl');
        return plan;
      }
      if (souf && e.cycle === 1 && e.cd[2] <= 0 && dist < THREAT.cue.fanRange && sim.flow.clearLine(e.x, e.z, p.x, p.z)) {
        e.cycle = 0;
        begin(sim, e, 'fan');
        return plan;
      }
      if (dist < H.near) {
        plan.mode = 'dir';
        plan.x = -ux;
        plan.z = -uz;
      } else if (dist < H.far) {
        plan.mode = 'dir';
        plan.x = uz * e.side;
        plan.z = -ux * e.side;
        plan.speed = H.strafe;
      }
      break;
    }
    case 'spiegelbild': {
      // M16: the reflection glides to the point reflection of the real one through the arena centre.
      plan.melee = false;
      const host = sim.enemies.find((o) => o.id === e.mirrorOf && o.state !== 'dead');
      if (!host || !e.mirror) { vanish(e); return plan; }
      const tx = 2 * e.mirror.x - host.x - e.x, tz = 2 * e.mirror.z - host.z - e.z, d = Math.hypot(tx, tz);
      if (d < 1e-3) { plan.mode = 'hold'; break; }
      plan.mode = 'dir';
      plan.x = tx / d;
      plan.z = tz / d;
      plan.speed = Math.min(d / DT, Math.max(host.speed * 1.05, BOSS.spiegelpaar.back)) / e.def.speed / (e.buff > 0 ? THREAT.buffSpeed : 1);
      break;
    }
    case 'rat':
      // 2D: the heading swings ±0.6 rad seven times a second while closing in; straight for the bite.
      if (dist > 1.6) plan.turn = Math.sin(sim.time * 7 + jitter(e.id, 5) * Math.PI * 2) * 0.6;
      break;
    case 'grenzer':
    case 'wachdrohne':
    case 'diva': {
      // Keeps the watchtower distance: backs off when the hero comes close, strafes in range (M16: the Diva glides at 4 to 8 m).
      const G = e.def.ai === 'wachdrohne' ? BOSS.wachdrohne : e.def.ai === 'diva' ? divaOf(e) : BOSS.grenzer;
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
      const F = e.kind === 'zugezogene' ? BOSS.zugezogene : BOSS.feldwebel;
      // M18: Der Zugezogene's scooter run is short (the pub is 18 × 13 m).
      const [c0, c1] = e.kind === 'zugezogene' ? [BOSS.zugezogene.chargeMin, BOSS.zugezogene.chargeMax] : [3, BOSS.charge.range];
      if (e.cd[1] <= 0) {
        e.cd[1] = F.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist < c1 && dist > c0 && sight()) {
        e.cd[0] = range(sim, F.charge);
        begin(sim, e, 'charge');
      } else if (e.kind === 'zugezogene' && e.cd[2] <= 0 && dist < BOSS.zugezogene.volleyRange && sight()) {
        // M18: his one block of his own, a volley of coffee cups.
        e.cd[2] = BOSS.zugezogene.volley;
        begin(sim, e, 'volley');
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
        // M18 Bautrupp: the Bauherr calls Brocken (with a note) instead of Uhrwerkläufer.
        if (e.cycle % K.addsEvery === 0 && e.kind === 'bauherr') {
          summon(sim, e, 'brute', BOSS.bauherr.adds);
          sim.events.push({ type: 'note', text: '„Bautrupp!“', color: '#f2d14b', x: e.x, z: e.z });
        } else if (e.cycle % K.addsEvery === 0) summon(sim, e, 'uhrwerk', K.adds);
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
    case 'conferencier': {
      // Nummer on its cooldown; the Stockstoß from a few meters (the spotlight runs in `passive`).
      const C = BOSS.conferencier;
      if (e.cd[2] <= 0) {
        e.cd[2] = C.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist > C.lungeMin && dist < C.lungeMax && sight()) {
        e.cd[0] = C.lunge;
        begin(sim, e, 'lunge');
      }
      break;
    }
    case 'ringvater': {
      // Leibwache at the entrance and once at half life, Schutzgeld on its cooldown, the Ringschlag.
      const R = BOSS.ringvater;
      const calls = e.calls ?? 0;
      if (calls === 0 || (e.rage && calls === 1)) begin(sim, e, 'summon');
      else if (e.cd[2] <= 0) {
        e.cd[2] = R.summon;
        begin(sim, e, 'summon');
      } else if (e.cd[0] <= 0 && dist > 3 && dist < R.range && sight()) {
        e.cd[0] = R.charge;
        begin(sim, e, 'charge');
      }
      break;
    }
    case 'spiegelpaar': {
      // Tausch, Scherbenregen, Doppelpirouette (the reflection starts its own at the same time).
      const S = BOSS.spiegelpaar;
      if (e.cd[2] <= 0 && e.pair !== undefined) {
        // Real seconds in rage (8 s), as the spec gives them.
        e.cd[2] = e.rage ? S.swap[1] * BOSS.rageRate : S.swap[0];
        begin(sim, e, 'swap');
      } else if (e.cd[1] <= 0 && dist < 16) {
        e.cd[1] = S.rain;
        begin(sim, e, 'barrage');
      } else if (e.cd[0] <= 0 && dist > 1.6 && dist < S.lungeRange && sight()) {
        e.cd[0] = S.lunge;
        begin(sim, e, 'lunge');
        const m = sim.enemies.find((o) => o.id === e.pair && o.state !== 'dead');
        if (m) begin(sim, m, 'lunge');
      }
      break;
    }
    case 'diva': {
      // Zugabe, Prismenstrahl, Fächerschlag; phase 3 (two tiers broken) has every cooldown ×0.85.
      const D = divaOf(e);
      const k = (e.still ?? 0) >= 2 ? D.phase3 : 1;
      if (e.cd[2] <= 0) {
        e.cd[2] = D.summon * k;
        begin(sim, e, 'summon');
      } else if (e.cd[1] <= 0 && dist < 16) {
        e.cd[1] = D.prism * k;
        begin(sim, e, 'prism');
      } else if (e.cd[0] <= 0 && dist < 13 && sight()) {
        e.cd[0] = D.fan * k;
        begin(sim, e, 'fan');
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
    case 'feldwebel': e.cd = [3, 6, e.kind === 'zugezogene' ? 2.5 : 0]; break;
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
    case 'zuender': e.cd = [0, 0, 0]; break;
    case 'heuler': e.cd = [r(THREAT.slam.first[0], THREAT.slam.first[1], 1), r(THREAT.howl.first[0], THREAT.howl.first[1], 2), 0]; break;
    case 'wurzelmutter': e.cd = [2, 6, 0]; break;
    case 'uhrwerkgross': e.cd = [2.5, 0, 0]; break;
    case 'volkskoloss': e.cd = [2, 0, 1]; break;
    case 'weltzeituhr': e.cd = [1.5, 0, 2]; break;
    // M16 Charlottenburg.
    case 'brute': e.cd = e.kind === 'loge' ? [r(THREAT.slam.first[0], THREAT.slam.first[1], 1), r(THREAT.faust.first[0], THREAT.faust.first[1], 2), 0] : [r(THREAT.slam.first[0], THREAT.slam.first[1], 1), 0, 0]; break;
    case 'conferencier': e.cd = [3, 0, 2]; break;
    case 'ringvater': e.cd = [2.5, 0, 8]; break;
    case 'spiegelpaar': e.cd = [2, 4, 8]; break;
    case 'spiegelbild': e.cd = [99, 99, 99]; break;
    case 'diva': e.cd = [1.5, 4, 6]; break;
    default: e.cd = [r(THREAT.slam.first[0], THREAT.slam.first[1], 1), 0, 0]; break;
  }
}
