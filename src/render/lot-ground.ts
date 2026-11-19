// M11c lot types: ground cover over the area ground (cobbled yards and markets, the parking lot with its
// stall lines, dirt on building sites and rubble fields, the gravel path through the allotments).
// Merged quads in the lot's chunk, laid in 1.5 m cells so they follow slopes. No extra draw calls.
import { Vector3, type Material } from 'three';
import type { Lot } from '../data/map';
import type { BatchSet } from './batch';
import { MARKING_DASH, type LotGroundMats } from './lot-textures';

type RGB = readonly [number, number, number];
interface Mats extends LotGroundMats { asphalt: Material; path: Material; cobbles: Material }

/** Draws the cover of special lot `l`; `surface` is the drawn ground height. */
export function buildLotGround(l: Lot, solid: BatchSet, mats: Mats, surface: (x: number, z: number) => number): void {
  const g = l.content?.ground;
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  const P = (a: number, b: number, lift: number): Vector3 => { const x = l.x + c * a + s * b, z = l.z - s * a + c * b; return new Vector3(x, surface(x, z) + lift, z); };
  /** Local rectangle a0..a1 × b0..b1 in cells, world-space UVs (4 m per tile). */
  const rect = (mat: Material, a0: number, a1: number, b0: number, b1: number, lift: number, tint?: RGB): void => {
    const batch = solid.of(mat);
    const na = Math.max(1, Math.ceil((a1 - a0) / 1.5)), nb = Math.max(1, Math.ceil((b1 - b0) / 1.5));
    for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
      const ua = a0 + ((a1 - a0) * i) / na, ub = a0 + ((a1 - a0) * (i + 1)) / na, va = b0 + ((b1 - b0) * j) / nb, vb = b0 + ((b1 - b0) * (j + 1)) / nb;
      // Counter-clockwise seen from above in world space (local a is world x when rot = 0, b is world z).
      const q: [Vector3, Vector3, Vector3, Vector3] = [P(ua, va, lift), P(ua, vb, lift), P(ub, vb, lift), P(ub, va, lift)];
      batch.quad(q, [0, 0, 1, 1], tint ? [tint] : undefined);
      const raw = batch as unknown as { positions: number[]; uvs: number[] };
      const n = raw.positions.length / 3;
      if (mat === mats.marking) {
        const [left, bottom, right, top] = MARKING_DASH;
        const u0 = left + (right - left) * i / na, u1 = left + (right - left) * (i + 1) / na;
        const v0 = bottom + (top - bottom) * j / nb, v1 = bottom + (top - bottom) * (j + 1) / nb;
        const mapped = [u0, v0, u0, v1, u1, v1, u1, v0];
        for (let k = 0; k < mapped.length; k++) raw.uvs[(n - 4) * 2 + k] = mapped[k]!;
      } else {
        for (let k = n - 4; k < n; k++) { raw.uvs[k * 2] = raw.positions[k * 3]! / 4; raw.uvs[k * 2 + 1] = raw.positions[k * 3 + 2]! / 4; }
      }
    }
  };
  const W = l.w / 2, D = l.d / 2;
  switch (g) {
    case 'cobbles': rect(mats.cobbles, -W + 0.2, W - 0.2, -D + 0.2, D - 0.2, 0.018); break;
    case 'dirt': rect(mats.path, -W + 0.4, W - 0.4, -D + 0.4, D - 0.4, 0.016, [0.85, 0.8, 0.72]); break;
    case 'gravel': rect(mats.gravel, -1.1, 1.1, -D + 0.2, D, 0.016, [1.15, 1.1, 1]); break;
    case 'asphalt': {
      rect(mats.asphalt, -W + 0.3, W - 0.3, -D + 0.3, D, 0.018, [0.92, 0.92, 0.95]);
      // Stall lines: faded white strips between the parking places on both sides.
      for (const sa of [-1, 1]) for (let b = -D + 0.7; b < D - 1.5; b += 2.6) {
        const a0 = sa * (W / 2 - 1.3), a1 = sa * (W - 1.2);
        rect(mats.marking, Math.min(a0, a1), Math.max(a0, a1), b, b + 0.12, 0.026, [1.9, 1.9, 1.8]);
      }
      break;
    }
  }
}
