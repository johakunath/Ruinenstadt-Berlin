// Landmark reveal (M11d, Johannes 2026-11-17): the game camera shows about 6 m of height at the hero,
// so towers and the wheel never appear in play. The first time the hero comes near a landmark (once
// per page load), the game pauses, the camera pulls back and swings to the front, seen from above,
// and stays there until the player taps or presses a key (`release`); then it zooms back in and the
// game goes on.
import { Vector3 } from 'three';
import type { Landmark, LandmarkKind } from '../data/map';
import { FOV } from './camera';

/**
 * Top of each kind above its ground (finials, the wheel's top gondola) and half width, as built in
 * `landmarks.ts`; kinds without a value are never revealed.
 */
const SHOW: Partial<Record<LandmarkKind, { top: number; half: number }>> = {
  rathaus: { top: 44, half: 15 }, kirche: { top: 40.5, half: 9 }, mueggelturm: { top: 33, half: 6.5 }, riesenrad: { top: 38, half: 18 },
  sbahnhof: { top: 10, half: 15 }, schloss: { top: 17.5, half: 12 }, forum: { top: 15, half: 22 },
};
/** German names for the hint while the view holds. */
const NAMES: Partial<Record<LandmarkKind, string>> = { rathaus: 'Rathaus Köpenick', kirche: 'St. Laurentius', mueggelturm: 'Müggelturm', riesenrad: 'Riesenrad', sbahnhof: 'S-Bahnhof Köpenick', schloss: 'Schloss Köpenick', forum: 'Forum Köpenick' };
/** Start when the hero is this close to the footprint (also mid-fight: the game pauses). */
export const REVEAL_NEAR = 12;
export const REVEAL_IN = 1.0;
/** Slow swing while the view holds, then it stays. */
const DRIFT = 6;
export const REVEAL_OUT = 0.8;

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

const PITCH = (26 * Math.PI) / 180;

/**
 * Camera pose `t` seconds after the start of the reveal of `l` (standing on ground height `base`), at
 * blend `weight`: in front, a little to the side, from above, far enough back that the whole height
 * and width fit the view (vertical FOV `fov` degrees, `aspect` width / height) with a margin.
 */
export function revealPose(l: Landmark, t: number, weight: number, out: RevealPose, base = 0, aspect = 16 / 9, fov = FOV): RevealPose {
  const S = SHOW[l.kind] ?? { top: 12, half: Math.max(l.hx, l.hz) };
  const h = (S.top / 2) * 1.06;
  const tv = Math.tan(((fov / 2) * Math.PI) / 180 * 0.9);
  const th = Math.tan(Math.atan(Math.tan(((fov / 2) * Math.PI) / 180) * aspect) * 0.9);
  // A vertical half height h at the look point projects inside the view when
  // h cos(pitch) / (dist − h sin(pitch)) ≤ tan(half FOV); the width needs half / tan(half horizontal FOV).
  // Capped inside the camera's far plane (120 m): a wide landmark on a portrait screen may then crop at the sides.
  const dist = Math.min(105, Math.max(24, (h * Math.cos(PITCH)) / tv + h * Math.sin(PITCH), S.half / th + S.half * 0.5));
  // Swing from 38° to 18° off the front axis.
  const side = ((38 - 20 * smooth((t - REVEAL_IN) / DRIFT)) * Math.PI) / 180;
  const yaw = l.rot + side;
  const y = base + S.top / 2;
  out.look.set(l.x, y, l.z);
  out.pos.set(l.x + Math.sin(yaw) * Math.cos(PITCH) * dist, y + Math.sin(PITCH) * dist, l.z + Math.cos(yaw) * Math.cos(PITCH) * dist);
  out.weight = weight;
  return out;
}

/** Which landmark to reveal and how far along. Pure state, no Three.js scene access. */
export class LandmarkReveal {
  private readonly seen = new Set<Landmark>();
  private current: Landmark | null = null;
  private t = 0;
  /** Seconds since `release`, or -1 while still out. */
  private back = -1;
  private readonly pose: RevealPose = { weight: 0, pos: new Vector3(), look: new Vector3() };

  /** `ground`: height of the ground under a landmark (terraces, hills). */
  constructor(private readonly landmarks: readonly Landmark[], private readonly ground: (x: number, z: number) => number = () => 0) {}

  /** True while a reveal runs (the game pauses the sim). */
  get active(): boolean {
    return this.current !== null;
  }

  /** The view is out and waits for a tap or key. */
  get holding(): boolean {
    return this.current !== null && this.back < 0 && this.t >= REVEAL_IN;
  }

  /** Name of the landmark on show (for the hint). */
  get name(): string {
    return this.current ? (NAMES[this.current.kind] ?? '') : '';
  }

  /** Advances the reveal. Returns the pose or null when the game camera has the view. */
  update(dt: number, x: number, z: number, alive: boolean, aspect = 16 / 9): RevealPose | null {
    if (!this.current) {
      if (!alive) return null;
      const next = this.landmarks.find((l) => SHOW[l.kind] !== undefined && !this.seen.has(l) && footprintDist(l, x, z) < REVEAL_NEAR);
      if (!next) return null;
      this.seen.add(next);
      this.current = next;
      this.t = 0;
      this.back = -1;
    }
    this.t += dt;
    let weight = smooth(this.t / REVEAL_IN);
    if (this.back >= 0) {
      this.back += dt;
      weight = Math.min(weight, 1 - smooth(this.back / REVEAL_OUT));
      if (this.back >= REVEAL_OUT) {
        this.current = null;
        return null;
      }
    }
    return revealPose(this.current, this.t, weight, this.pose, this.ground(this.current.x, this.current.z), aspect);
  }

  /** Tap or key: zoom back in, then the game goes on. */
  release(): void {
    if (this.current && this.back < 0) this.back = 0;
  }
}
