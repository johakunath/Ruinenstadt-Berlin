// Armor gear (WP4 step 2c): belts, collars, plates, studs and the other rigid parts of the Körper looks.
// Belts and plates are fitted to the outfit they sit on (`a_mantel` or `a_weste`). Looks:
// docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19).
import { AXES, metal, onSurface, plain, surface, type GearKit, type Sampler } from './gear-kit';
import type { GearBuilder } from './gear';
import { box, cyl } from './weapons';

/** Belt heights (m): the coat's belt ring and the vest's. */
export const BELT_Y = { a_mantel: 1.08, a_weste: 1.0 } as const;

/** A belt band round the outfit at its belt height: `h` tall, `lift` out of the surface. Returns the sampler for buckles and pouches. */
export function beltBand(k: GearKit, outfit: 'a_mantel' | 'a_weste', col: number, h = 0.056, lift = 0.008): Sampler {
  const s = k.sampler([outfit], AXES.torso);
  const y = BELT_Y[outfit];
  k.on('pelvis', () => k.add(surface(s, y - h / 2, y + h / 2, { segs: 36, rows: 1, offset: lift, median: 7 }), plain(col)));
  return s;
}

/** Arbeitsmantel: wide tool belt with a brass buckle, a hammer on the right hip, a pocket watch on the left, two pouches. */
function beltTool(k: GearKit): void {
  const s = beltBand(k, 'a_mantel', 0x3a2414, 0.062);
  const y = BELT_Y.a_mantel;
  k.on('pelvis', () => {
    k.frame(onSurface(s, y, 0, 0.014, s.radius(y, 0) ), () => {
      k.add(box(0.07, 0.06, 0.008), metal(0xc9a34a)).add(box(0.05, 0.04, 0.01), plain(0x3a2414), 0, 0, 0.002);
    });
    for (const a of [0.55, 0.95]) k.frame(onSurface(s, y - 0.04, a, 0.02), () => k.add(box(0.07, 0.085, 0.04), plain(0x5a3a22)).add(box(0.072, 0.03, 0.042), plain(0x4a2e1a), 0, 0.03, 0));
    // Hammer on the hero's right hip (−X): handle down, head at the bottom.
    k.frame(onSurface(s, y - 0.03, -1.45, 0.03), () => {
      k.add(cyl(0.012, 0.012, 0.2, 6), plain(0x6a4a2a), 0, -0.08, 0).add(box(0.1, 0.035, 0.035), metal(0x7a7c80), 0, -0.19, 0);
    });
    // Pocket watch on the left front, with a chain to the buckle.
    k.frame(onSurface(s, y - 0.035, 0.75, 0.016), () => {
      k.add(cyl(0.028, 0.028, 0.012, 14), metal(0xc9a34a), 0, 0, 0, Math.PI / 2).add(cyl(0.022, 0.022, 0.004, 14), plain(0xf0e2c0), 0, 0, 0.007, Math.PI / 2);
    });
  });
}

export const BODY_GEAR: Readonly<Record<string, GearBuilder>> = {
  'belt-tool': beltTool,
};
