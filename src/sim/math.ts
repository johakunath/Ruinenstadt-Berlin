// Small ground-plane math helpers. The sim works on the XZ plane in meters.
// Facing angle θ: direction = (sin θ, cos θ). θ = 0 looks along +Z; positive θ turns toward +X
// (the character's left), which matches `Object3D.rotation.y` for a glTF model facing +Z.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Wraps an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
}

/** Shortest signed difference `to - from`, in (-π, π]. */
export const angleDiff = (from: number, to: number): number => wrapAngle(to - from);

export const lerpAngle = (a: number, b: number, t: number): number => a + angleDiff(a, b) * t;

/** Turns `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const d = angleDiff(from, to);
  return Math.abs(d) <= maxStep ? to : from + Math.sign(d) * maxStep;
}

export const angleOf = (x: number, z: number): number => Math.atan2(x, z);

/** Deterministic PRNG (mulberry32). The sim never calls Math.random. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  pick<T>(list: readonly T[]): T {
    return list[this.int(list.length)] as T;
  }
}
