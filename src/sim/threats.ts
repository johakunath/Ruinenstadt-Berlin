// What enemies put into the world (M12; 2D `teles`, `eproj`, `hazards`, damaging `rings`):
// marked ground zones that go off after a delay, shots, burning or acid ground, and roar rings
// that hurt unless the hero rolls through. All of it hurts the hero through `hurtPlayer`.
import { PLAYER } from '../data/combat';
import { THREAT } from '../data/enemies';
import { colliderDistance } from './collide';
import { hurtPlayer } from './combat';
import { DT, type Enemy, type Sim } from './types';

export type SpecialKind = 'spit' | 'fan' | 'pounce' | 'lunge' | 'dive' | 'slam' | 'stomp' | 'flame' | 'charge' | 'summon' | 'ring' | 'roar' | 'barrage' | 'tail' | 'bossSlam';

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
}

export type ZoneKind = 'slam' | 'flame' | 'bomb' | 'tail';
/** A marked circle: fills for `max` seconds, then hits the hero inside it. */
export interface Zone {
  x: number; z: number; r: number; t: number; max: number; damage: number; floor: number; kind: ZoneKind; src: number;
  /** Free zones go off whatever happens to their source (a barrage already thrown). All others fizzle when the source is interrupted or killed. */
  free?: boolean;
}
export interface EnemyShot { x: number; z: number; px: number; pz: number; vx: number; vz: number; r: number; damage: number; life: number; boss: boolean }
export interface Hazard { x: number; z: number; r: number; t: number; max: number; damage: number; tick: number; kind: 'fire' | 'acid' }
/** An expanding ring; `r` may start negative (a second ring that follows the first). */
export interface Wave { x: number; z: number; r: number; max: number; speed: number; damage: number; floor: number; width: number; hit: boolean }

export interface Threats { zones: Zone[]; shots: EnemyShot[]; hazards: Hazard[]; waves: Wave[] }
export const createThreats = (): Threats => ({ zones: [], shots: [], hazards: [], waves: [] });

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
    if (Math.hypot(p.x - z.x, p.z - z.z) < z.r + PLAYER.radius * 0.5) {
      const a = away(sim, z.x, z.z);
      hit = threatHit(sim, null, z.damage, z.floor, a.dx, a.dz);
    }
    sim.events.push({ type: 'zoneHit', kind: z.kind, x: z.x, z: z.z, r: z.r, hit });
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
