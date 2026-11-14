// Static footprints and the hit shapes used by combat. All shapes live on the ground plane.
import { angleDiff, angleOf } from './math';

export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

/** Oriented box. `rot` uses the same convention as facing angles (rotation about +Y). */
export interface BoxCollider {
  kind: 'box';
  x: number;
  z: number;
  hx: number;
  hz: number;
  rot: number;
}

export type Collider = CircleCollider | BoxCollider;

/** Signed distance from a point to a collider edge (negative inside). */
export function colliderDistance(c: Collider, x: number, z: number): number {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) - c.r;
  const cos = Math.cos(c.rot);
  const sin = Math.sin(c.rot);
  const dx = x - c.x;
  const dz = z - c.z;
  // World -> box local (inverse rotation about Y).
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const qx = Math.abs(lx) - c.hx;
  const qz = Math.abs(lz) - c.hz;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qz), 0);
}

const out = { x: 0, z: 0 };

/**
 * Pushes a body circle out of one collider. Returns true when it moved.
 * Result is written to `pos` in place.
 */
export function pushOut(pos: { x: number; z: number }, r: number, c: Collider): boolean {
  if (c.kind === 'circle') {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const min = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return false;
    const d = Math.sqrt(d2);
    if (d < 1e-6) {
      pos.x = c.x + min;
      return true;
    }
    pos.x = c.x + (dx / d) * min;
    pos.z = c.z + (dz / d) * min;
    return true;
  }
  const cos = Math.cos(c.rot);
  const sin = Math.sin(c.rot);
  const dx = pos.x - c.x;
  const dz = pos.z - c.z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const cx = lx < -c.hx ? -c.hx : lx > c.hx ? c.hx : lx;
  const cz = lz < -c.hz ? -c.hz : lz > c.hz ? c.hz : lz;
  let nx = lx - cx;
  let nz = lz - cz;
  const d2 = nx * nx + nz * nz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-10) {
    // Center is outside the box: push along the closest-point normal.
    const d = Math.sqrt(d2);
    out.x = cx + (nx / d) * r;
    out.z = cz + (nz / d) * r;
  } else {
    // Center is inside: leave through the nearest face.
    const px = c.hx - Math.abs(lx);
    const pz = c.hz - Math.abs(lz);
    nx = 0;
    nz = 0;
    if (px < pz) nx = lx < 0 ? -1 : 1;
    else nz = lz < 0 ? -1 : 1;
    out.x = nx !== 0 ? nx * (c.hx + r) : lx;
    out.z = nz !== 0 ? nz * (c.hz + r) : lz;
  }
  // Box local -> world.
  pos.x = c.x + out.x * cos + out.z * sin;
  pos.z = c.z - out.x * sin + out.z * cos;
  return true;
}

/** Resolves a body circle against all static colliders (a few passes settle corners). */
export function resolveStatic(pos: { x: number; z: number }, r: number, colliders: readonly Collider[]): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const c of colliders) moved = pushOut(pos, r, c) || moved;
    if (!moved) return;
  }
}

/**
 * Weapon sweep test: does the annular sector hit a body circle?
 * The sector is centered on (ox, oz), spans radii [inner, reach] and the angle interval
 * [lo, hi] measured relative to `facing` (radians, positive = to the left of facing).
 */
export function sectorHitsCircle(
  ox: number,
  oz: number,
  facing: number,
  lo: number,
  hi: number,
  inner: number,
  reach: number,
  cx: number,
  cz: number,
  cr: number,
): boolean {
  const dx = cx - ox;
  const dz = cz - oz;
  const dist = Math.hypot(dx, dz);
  if (dist - cr > reach || dist + cr < inner) return false;
  if (dist <= cr) return true;
  const rel = angleDiff(facing, angleOf(dx, dz));
  const half = Math.asin(Math.min(1, cr / dist));
  return rel + half >= lo && rel - half <= hi;
}
