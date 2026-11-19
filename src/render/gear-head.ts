// Hats (WP4 step 2b): every hat rides on the `Head` bone like the hair, sized from the hair and skull
// (`headFit`) so it never clips while moving. Looks: docs/mockups/wp4-clothes/items.mjs (Johannes, 2026-11-19).
import { Matrix4 } from 'three';
import { dome, headFit, headSampler, metal, plain, glow, type GearKit } from './gear-kit';
import type { GearBuilder } from './gear';
import { cyl, scaled, ball } from './weapons';

/** Hard hat: smooth dome, ridge, brim wider at the front; `stripe` and `lamp` for the Kiezwache. */
function hardHat(k: GearKit, col: number, o: { stripe?: number; lamp?: number; sticker?: number } = {}): void {
  k.on('Head', () => {
    const f = headFit(k, 1.665);
    k.add(dome(f, 0.014, 1.05, 24, 10, headSampler(k)), plain(col));
    // Brim: a flat ring, 4.5 cm out at the front, 1.5 cm at the sides and back.
    const brim = scaled(cyl(1, 1, 0.008, 28), f.rx + 0.03, 1, 1);
    const p = brim.attributes.position!;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setZ(i, z * (z > 0 ? f.front + 0.05 : f.back + 0.025)); }
    brim.computeVertexNormals();
    k.add(brim, plain(col), f.c.x, f.c.y - 0.004, f.c.z);
    // Ridge from front to back over the crown.
    k.add(scaled(ball(1, 10, 6), 0.011, 0.01, (f.front + f.back) / 2 * 0.75), plain(col), f.c.x, f.top + 0.012, f.c.z + (f.front - f.back) / 2 - 0.01);
    if (o.stripe) k.add(scaled(cyl(1, 1, 0.022, 28, true), f.rx + 0.016, 1, (f.front + f.back) / 2 + 0.016), plain(o.stripe), f.c.x, f.c.y + 0.03, f.c.z + (f.front - f.back) / 2);
    if (o.lamp) {
      k.frame(new Matrix4().makeTranslation(f.c.x, f.c.y + 0.045, f.c.z + f.front + 0.012), () => {
        k.add(cyl(0.022, 0.024, 0.03, 10), metal(0x3a3c40), 0, 0, 0.008, Math.PI / 2);
        k.add(cyl(0.017, 0.017, 0.004, 10), glow(o.lamp!), 0, 0, 0.024, Math.PI / 2);
      });
    }
    if (o.sticker) k.add(cyl(0.016, 0.016, 0.004, 10), plain(o.sticker), f.c.x + f.rx + 0.01, f.c.y + 0.05, f.c.z, 0, 0, Math.PI / 2 - 0.2);
  });
}

export const HEAD_GEAR: Readonly<Record<string, GearBuilder>> = {
  'hat-hard': (k) => hardHat(k, 0xd9a520, { sticker: 0xb8261c }),
  'hat-kiez': (k) => hardHat(k, 0x2f62b0, { stripe: 0xf08a24, lamp: 0xfff2b0 }),
};

