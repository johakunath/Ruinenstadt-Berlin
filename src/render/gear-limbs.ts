// Glove and boot gear (WP4 step 2d): cuffs, wraps, boxing gloves, boot shafts and plates. Forearm parts
// ride on `lowerarm_*` (T-pose: the arm along ±X), shafts and greaves on `calf_*`, toe parts on `foot_*`.
// Looks: docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19).
import { plain, surface, type GearKit } from './gear-kit';
import type { GearBuilder } from './gear';

const SIDES = [1, -1] as const;
const side = (s: 1 | -1): 'l' | 'r' => (s > 0 ? 'l' : 'r');

/** A boot shaft from `t0` to `t1` round the leg (boot and trousers; the vest's trousers, as the coat's skirt would widen it), `lift` out of them, on the calf. */
function shaft(k: GearKit, s: 1 | -1, t0: number, t1: number, col: number, lift = 0.007): void {
  const smp = k.leg(s);
  k.on(`calf_${side(s)}`, () => k.add(surface(smp, t0, t1, { segs: 24, rows: 5, offset: lift, median: 5, smooth: 3 }), plain(col)));
}

export const LIMB_GEAR: Readonly<Record<string, GearBuilder>> = {
  'shaft-rubber': (k) => { for (const s of SIDES) { shaft(k, s, 0.3, 0.47, 0x2f5a32); shaft(k, s, 0.455, 0.475, 0x6a9a6a, 0.01); } },
};
