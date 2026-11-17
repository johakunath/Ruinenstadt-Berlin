// Landmark reveal (M11d, Johannes 2026-11-17): the game camera shows about 6 m of height at the hero,
// so towers and the wheel never appear in play. The first time the hero comes near a landmark (once
// per page load), the camera pulls back and swings to the front, seen from above, then returns. The
// sim pauses meanwhile (`active`), so nothing happens off screen.
import { Vector3 } from 'three';
import type { Landmark, LandmarkKind } from '../data/map';

/** Height of what the reveal should show; kinds without a value are never revealed. */
const SHOW: Partial<Record<LandmarkKind, number>> = { rathaus: 42, kirche: 38, mueggelturm: 32, riesenrad: 40, sbahnhof: 11, schloss: 17, forum: 12 };
/** Start when the hero is this close to the footprint and no enemy is near. */
export const REVEAL_NEAR = 12;
const ENEMY_NEAR = 14;
const IN = 1.0;
const HOLD = 2.2;
const OUT = 0.9;
export const REVEAL_TIME = IN + HOLD + OUT;

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Distance from (x, z) to the landmark's rotated footprint box (0 inside). */
export function footprintDist(l: Landmark, x: number, z: number): number {
  const dx = x - l.x, dz = z - l.z;
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  // Local frame: x along the front (cos θ, −sin θ), z out of the front (sin θ, cos θ).
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.hypot(Math.max(0, Math.abs(lx) - l.hx), Math.max(0, Math.abs(lz) - l.hz));
}

export interface RevealPose {
  /** 0 = game camera, 1 = full reveal view. */
  weight: number;
  pos: Vector3;
  look: Vector3;
}

/** Camera pose `t` seconds into the reveal of `l`: in front, a little to the side, from above, drifting. */
export function revealPose(l: Landmark, t: number, out: RevealPose): RevealPose {
  const H = SHOW[l.kind] ?? 12;
  const size = Math.max(l.hx, l.hz);
  const dist = Math.max(28, H * 1.45, size * 2.6);
  const pitch = (26 * Math.PI) / 180;
  // Swing from 38° to 18° off the front axis while holding.
  const side = ((38 - 20 * smooth((t - IN) / (HOLD + OUT))) * Math.PI) / 180;
  const yaw = l.rot + side;
  out.look.set(l.x, H * 0.42, l.z);
  out.pos.set(l.x + Math.sin(yaw) * Math.cos(pitch) * dist, H * 0.42 + Math.sin(pitch) * dist, l.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  out.weight = t < IN ? smooth(t / IN) : t < IN + HOLD ? 1 : 1 - smooth((t - IN - HOLD) / OUT);
  return out;
}

/** Which landmark to reveal and how far along. Pure state, no Three.js scene access. */
export class LandmarkReveal {
  private readonly seen = new Set<Landmark>();
  private current: Landmark | null = null;
  private t = 0;
  private readonly pose: RevealPose = { weight: 0, pos: new Vector3(), look: new Vector3() };

  constructor(private readonly landmarks: readonly Landmark[]) {}

  /** True while a reveal runs (the game pauses the sim). */
  get active(): boolean {
    return this.current !== null;
  }

  /** Advances the reveal; `enemies` are positions of living enemies. Returns the pose or null. */
  update(dt: number, x: number, z: number, alive: boolean, enemies: ReadonlyArray<{ x: number; z: number }>): RevealPose | null {
    if (!this.current) {
      if (!alive || enemies.some((e) => Math.hypot(e.x - x, e.z - z) < ENEMY_NEAR)) return null;
      const next = this.landmarks.find((l) => SHOW[l.kind] !== undefined && !this.seen.has(l) && footprintDist(l, x, z) < REVEAL_NEAR);
      if (!next) return null;
      this.seen.add(next);
      this.current = next;
      this.t = 0;
    }
    this.t += dt;
    if (this.t >= REVEAL_TIME) {
      this.current = null;
      return null;
    }
    return revealPose(this.current, this.t, this.pose);
  }

  /** Ends a running reveal at once (any button). */
  skip(): void {
    this.current = null;
  }
}
