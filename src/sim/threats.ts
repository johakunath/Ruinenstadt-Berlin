// What enemies put into the world (M12; 2D `teles`, `eproj`, `hazards`, damaging `rings`):
// marked ground zones that go off after a delay, shots, burning or acid ground, and roar rings
// that hurt unless the hero rolls through. All of it hurts the hero through `hurtPlayer`.
// M12c: zones that shove the hero (`Zone.push`) and the Wachdrohne's searchlight (`Spot`).
// M15: root zones hold the hero (`Player.root`), hour sectors of a ring (the Weltzeituhr's Zeitzonen),
// and the minute hand: a line that sweeps round its centre and hurts unless the hero rolls through.
import { PLAYER } from '../data/combat';
import { BOSS, THREAT } from '../data/enemies';
import { colliderDistance } from './collide';
import { hurtPlayer } from './combat';
import { angleDiff, angleOf } from './math';
import { DT, type Enemy, type Sim } from './types';

export type SpecialKind = 'spit' | 'fan' | 'pounce' | 'lunge' | 'dive' | 'slam' | 'stomp' | 'flame' | 'charge' | 'summon' | 'ring' | 'roar' | 'barrage' | 'tail' | 'bossSlam' | 'volley' | 'molotov'
  | 'leap' | 'bass' | 'shove' | 'grab' | 'land' | 'beat'
  | 'roots' | 'seeds' | 'rootRing' | 'key' | 'slabs' | 'sectors' | 'hand';

/** A running special: `wind` seconds of telegraph, then `go` seconds of action, then `open` seconds of standing open. */
export interface Special {
  kind: SpecialKind;
  wind: number;
  go: number;
  open: number;
  /** Direction locked for rushes and shots. */
  dx: number;
  dz: number;
  /** Rush speed during `go` (0: stands). */
  speed: number;
  /** The release happened; the rush already hit. */
  fired: boolean;
  hit: boolean;
  /** M12c: started from `Enemy.queue` (the second shove in rage does not queue a third). */
  queued?: boolean;
}

export type ZoneKind = 'slam' | 'flame' | 'bomb' | 'tail' | 'acid' | 'shove' | 'land' | 'root' | 'slab' | 'hour';
/** A marked circle: fills for `max` seconds, then hits the hero inside it. */
export interface Zone {
  x: number; z: number; r: number; t: number; max: number; damage: number; floor: number; kind: ZoneKind; src: number;
  /** Free zones go off whatever happens to their source (a barrage already thrown). All others fizzle when the source is interrupted or killed. */
  free?: boolean;
  /** M12b: ground it leaves where it lands (a Molotov's fire, the Spreehexe's acid pool). */
  leave?: { r: number; t: number; damage: number; kind: Hazard['kind'] };
  /** M12c: a hit shoves the hero this many meters away from the source (Türsteher). */
  push?: number;
  /** M15 Wurzler: a hero caught inside is held this long (no walking; a dodge breaks free). */
  root?: number;
  /** M15 hour sector: only the part of the circle from `r0` out and within `half` of angle `a` counts. */
  sector?: { r0: number; a: number; half: number };
}
export interface EnemyShot { x: number; z: number; px: number; pz: number; vx: number; vz: number; r: number; damage: number; life: number; boss: boolean }
export interface Hazard { x: number; z: number; r: number; t: number; max: number; damage: number; tick: number; kind: 'fire' | 'acid' }
/** An expanding ring; `r` may start negative (a second ring that follows the first). */
export interface Wave { x: number; z: number; r: number; max: number; speed: number; damage: number; floor: number; width: number; hit: boolean }

/**
 * M12c Wachdrohne searchlight: a lit circle on the ground that follows the hero (`slot` 1 circles around
 * the hero instead, the second spot in rage). Standing inside `lock` s in a row locks it: `flash` s of red,
 * then the source fires its laser volley at the hero; `cool` s later it can lock again.
 */
export interface Spot { x: number; z: number; px: number; pz: number; r: number; src: number; slot: number; inT: number; flash: number; cool: number }

/**
 * M15 minute hand: a line from (x, z) out to `r` that turns from angle `a`; for `wind` s it only shows,
 * then it sweeps for `dur` s with the turn rate rising from `w0` to `w1` rad/s. Hits once, unless rolled through.
 */
export interface Sweep { x: number; z: number; r: number; r0: number; a: number; t: number; wind: number; dur: number; w0: number; w1: number; damage: number; floor: number; width: number; hit: boolean; src: number }

export interface Threats { zones: Zone[]; shots: EnemyShot[]; hazards: Hazard[]; waves: Wave[]; spots: Spot[]; sweeps: Sweep[] }
export const createThreats = (): Threats => ({ zones: [], shots: [], hazards: [], waves: [], spots: [], sweeps: [] });

/** The hero (center `x`, `z`) is inside zone `z` (a circle, or its hour sector). */
export function inZone(z: Zone, x: number, zz: number, pad: number): boolean {
  const d = Math.hypot(x - z.x, zz - z.z);
  if (d >= z.r + pad) return false;
  if (!z.sector) return true;
  if (d < z.sector.r0 - pad) return false;
  return Math.abs(angleDiff(z.sector.a, angleOf(x - z.x, zz - z.z))) < z.sector.half + pad / Math.max(d, 1);
}

/** Angle of a sweep's line at its own time `t` (counted from the end of its wind-up). */
export function sweepAngle(w: Sweep, t: number): number {
  const k = Math.max(0, Math.min(t, w.dur));
  return w.a + w.w0 * k + ((w.w1 - w.w0) * k * k) / (2 * w.dur);
}

const HAZARD_CAP = 60;

/**
 * A telegraphed or ranged hit on the hero. `floor` is the least share of max life it takes
 * (before armor and the per-hit cap). Returns false when the hero was invulnerable or just hit.
 */
export function threatHit(sim: Sim, src: Enemy | null, raw: number, floor: number, dx: number, dz: number): boolean {
  const p = sim.player;
  if (p.state === 'dead' || p.invuln > 0 || p.hurtT < PLAYER.hitGrace) return false;
  return hurtPlayer(sim, src, Math.max(raw, floor * sim.stats.maxHp), dx, dz);
}

export function addZone(sim: Sim, z: Zone): void {
  sim.threats.zones.push(z);
}

export function fireShot(sim: Sim, e: Enemy, angle: number, speed: number, damage: number, life: number, radius: number): void {
  const boss = !!e.def.boss;
  const start = e.def.radius * 0.6;
  const x = e.x + Math.sin(angle) * start;
  const z = e.z + Math.cos(angle) * start;
  sim.threats.shots.push({ x, z, px: x, pz: z, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, r: radius, damage, life, boss });
}

export function addHazard(sim: Sim, h: Omit<Hazard, 'tick' | 'max'>): void {
  const list = sim.threats.hazards;
  list.push({ ...h, max: h.t, tick: 0 });
  if (list.length > HAZARD_CAP) list.splice(0, list.length - HAZARD_CAP);
}

/**
 * M12c: shoves the hero `meters` along (dx, dz) (a unit vector). A damped velocity that the player step
 * adds to its own (`Player.kx`), so walls still hold; rolls and casts keep their own motion on top.
 */
export function pushPlayer(sim: Sim, dx: number, dz: number, meters: number): void {
  const p = sim.player;
  p.kx += dx * meters * PLAYER.pushDamp;
  p.kz += dz * meters * PLAYER.pushDamp;
}

/** Fires the Wachdrohne's laser volley from `e` at the hero (spot lock or its own cooldown). */
export function laserVolley(sim: Sim, e: Enemy): void {
  const W = BOSS.wachdrohne;
  const p = sim.player;
  const aim = Math.atan2(p.x - e.x, p.z - e.z);
  for (let i = 0; i < W.shots; i++) fireShot(sim, e, aim + (i - (W.shots - 1) / 2) * W.spread, W.volleySpeed, e.def.damage * e.dmgMul * W.volleyDamage, W.volleyLife, BOSS.ring.radius);
  sim.events.push({ type: 'enemyShot', x: e.x, z: e.z, boss: true });
  sim.events.push({ type: 'enemySpecial', id: e.id, kind: 'volley', phase: 'go', x: e.x, z: e.z });
}

const away = (sim: Sim, x: number, z: number): { dx: number; dz: number } => {
  const p = sim.player;
  const dx = p.x - x;
  const dz = p.z - z;
  const d = Math.hypot(dx, dz) || 1;
  return { dx: dx / d, dz: dz / d };
};

export function updateThreats(sim: Sim): void {
  const T = sim.threats;
  const p = sim.player;
  const L = sim.level;

  for (let i = T.zones.length - 1; i >= 0; i--) {
    const z = T.zones[i]!;
    z.t -= DT;
    if (z.t > 0) continue;
    T.zones.splice(i, 1);
    // Interrupted or killed during the wind-up: the marked attack never lands.
    if (!z.free && !sim.enemies.some((e) => e.id === z.src && e.state === 'special')) continue;
    let hit = false;
    if (z.leave) addHazard(sim, { x: z.x, z: z.z, ...z.leave });
    // A zone with no damage only marks where its ground lands (the acid pool hurts by ticking).
    const inside = inZone(z, p.x, p.z, PLAYER.radius * 0.5);
    if ((z.damage > 0 || z.floor > 0) && inside) {
      // A shove drives the hero away from its source (the Türsteher), not from the circle's centre.
      const src = z.push ? sim.enemies.find((e) => e.id === z.src) : undefined;
      const a = away(sim, src?.x ?? z.x, src?.z ?? z.z);
      hit = threatHit(sim, null, z.damage, z.floor, a.dx, a.dz);
      if (hit && z.push) pushPlayer(sim, a.dx, a.dz, z.push);
    }
    // Roots hold whoever stands in them, hurt or not, unless the hero is mid-roll or still immune (2D).
    if (z.root && inside && p.state !== 'dead' && p.state !== 'dodge' && p.invuln <= 0 && p.rootI <= 0) {
      p.root = z.root;
      p.rootI = THREAT.roots.immune;
      sim.events.push({ type: 'note', text: 'Festgehalten', color: '#97c459', x: p.x, z: p.z });
    }
    // An hour sector reports its own middle, so the burst fills the slice and not the whole ring.
    if (z.sector) {
      const m = (z.sector.r0 + z.r) / 2;
      sim.events.push({ type: 'zoneHit', kind: z.kind, x: z.x + Math.sin(z.sector.a) * m, z: z.z + Math.cos(z.sector.a) * m, r: (z.r - z.sector.r0) * 0.3, hit });
    } else sim.events.push({ type: 'zoneHit', kind: z.kind, x: z.x, z: z.z, r: z.r, hit });
  }

  for (let i = T.shots.length - 1; i >= 0; i--) {
    const q = T.shots[i]!;
    q.px = q.x;
    q.pz = q.z;
    q.x += q.vx * DT;
    q.z += q.vz * DT;
    q.life -= DT;
    let gone = q.life <= 0;
    if (!gone && Math.hypot(p.x - q.x, p.z - q.z) < q.r + PLAYER.radius && p.state !== 'dead' && p.invuln <= 0) {
      const l = Math.hypot(q.vx, q.vz) || 1;
      // A shot that meets the hero is spent, also inside the hit grace (no damage then).
      threatHit(sim, null, q.damage, 0, q.vx / l, q.vz / l);
      gone = true;
    }
    if (!gone && L.near(q.x, q.z, q.r + 0.5).some((c) => colliderDistance(c, q.x, q.z) < q.r)) gone = true;
    if (gone) T.shots.splice(i, 1);
  }

  for (let i = T.hazards.length - 1; i >= 0; i--) {
    const h = T.hazards[i]!;
    h.t -= DT;
    h.tick -= DT;
    if (h.t <= 0) {
      T.hazards.splice(i, 1);
      continue;
    }
    if (h.tick <= 0 && Math.hypot(p.x - h.x, p.z - h.z) < h.r + PLAYER.radius * 0.5) {
      const a = away(sim, h.x, h.z);
      if (threatHit(sim, null, h.damage, 0, a.dx, a.dz)) h.tick = THREAT.hazard.tick;
    }
  }

  updateSpots(sim);
  for (let i = T.sweeps.length - 1; i >= 0; i--) {
    const w = T.sweeps[i]!;
    const t0 = w.t - w.wind;
    w.t += DT;
    const t1 = w.t - w.wind;
    // The hand stops with its source (killed or stunned out of it).
    if (t1 >= w.dur || !sim.enemies.some((e) => e.id === w.src && e.state === 'special')) {
      T.sweeps.splice(i, 1);
      continue;
    }
    if (w.hit || t1 <= 0) continue;
    const d = Math.hypot(p.x - w.x, p.z - w.z);
    if (d > w.r + PLAYER.radius || d < w.r0) continue;
    const a0 = sweepAngle(w, t0), a1 = sweepAngle(w, t1);
    // The line passed over the hero this step (or lies on them): the angle from a0 forward to the hero is within the swept arc plus the line's width.
    const pad = (w.width + PLAYER.radius) / Math.max(d, 0.5);
    let ahead = angleOf(p.x - w.x, p.z - w.z) - a0;
    ahead -= Math.floor(ahead / (Math.PI * 2)) * Math.PI * 2;
    if (ahead > Math.PI * 2 - pad) ahead -= Math.PI * 2;
    if (ahead < -pad || ahead > a1 - a0 + pad) continue;
    const a = away(sim, w.x, w.z);
    if (threatHit(sim, null, w.damage, w.floor, a.dx, a.dz)) w.hit = true;
  }

  for (let i = T.waves.length - 1; i >= 0; i--) {
    const w = T.waves[i]!;
    w.r += w.speed * DT;
    if (w.r >= w.max) {
      T.waves.splice(i, 1);
      continue;
    }
    if (w.hit || w.r <= 0) continue;
    if (Math.abs(Math.hypot(p.x - w.x, p.z - w.z) - w.r) < w.width + PLAYER.radius) {
      const a = away(sim, w.x, w.z);
      // Rolling through costs nothing; the ring stays armed for a later touch.
      if (threatHit(sim, null, w.damage, w.floor, a.dx, a.dz)) w.hit = true;
    }
  }
}

/** The searchlights follow the hero; a lock flashes, then the source fires. Spots of a dead source go out. */
function updateSpots(sim: Sim): void {
  const W = BOSS.wachdrohne;
  const list = sim.threats.spots;
  const p = sim.player;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]!;
    const e = sim.enemies.find((q) => q.id === s.src && q.state !== 'dead');
    if (!e) {
      list.splice(i, 1);
      continue;
    }
    s.px = s.x;
    s.pz = s.z;
    // Slot 0 heads for the hero; slot 1 for a point that circles around the hero.
    const a = sim.time * 0.7 + s.slot * Math.PI;
    const tx = p.x + (s.slot ? Math.sin(a) * W.spotOrbit : 0);
    const tz = p.z + (s.slot ? Math.cos(a) * W.spotOrbit : 0);
    const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
    const step = W.spotSpeed * DT;
    if (d > step) {
      s.x += (dx / d) * step;
      s.z += (dz / d) * step;
    } else {
      s.x = tx;
      s.z = tz;
    }
    if (s.flash > 0) {
      s.flash -= DT;
      if (s.flash <= 0) {
        s.cool = W.spotCool;
        if (p.state !== 'dead') laserVolley(sim, e);
      }
      continue;
    }
    if (s.cool > 0) {
      s.cool -= DT;
      continue;
    }
    const inside = p.state !== 'dead' && Math.hypot(p.x - s.x, p.z - s.z) < s.r;
    s.inT = inside ? s.inT + DT : 0;
    if (s.inT >= W.lock) {
      s.inT = 0;
      s.flash = W.flash;
      sim.events.push({ type: 'spotLock', id: e.id, x: s.x, z: s.z });
    }
  }
}
