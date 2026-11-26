// WP4 step 5 glow edges on the hero (D5): extra glowing gear parts of legendary wear, added to the look by
// `fxLook` (src/data/gear-fx.ts) instead of the item's own `WEAR` gear list, so the clothing builders stay
// untouched. They merge into the existing gear meshes (0 extra draw calls) and pulse with `GEAR_PULSE`.
import { PlaneGeometry } from 'three';
import type { GearBuilder } from './gear';
import { field, torsoBand, TORSO, trunk } from './gear-body-rare';
import { glow, onSurface, plain } from './gear-kit';
import { box } from './weapons';

/** Mantel des letzten Späti: four patches that glow warm, as if lit from inside (chest, side, back), each in a dark stitched frame. */
const fxSpaeti: GearBuilder = (k) => {
  const s = trunk(k, ['a_mantel']);
  const outer = glow(0x9a4c1a), inner = glow(0xf0a048), seam = plain(0x22161a);
  // Height on the torso, angle (0 front, +π/2 the hero's left), size, tilt.
  const PATCHES = [[1.28, 0.42, 0.058, 0.12], [1.15, 0.66, 0.048, -0.2], [1.22, Math.PI - 0.4, 0.062, 0.15], [1.34, Math.PI + 0.45, 0.05, -0.1]] as const;
  for (const [t, a, w, tilt] of PATCHES) {
    const R = field(s, t - 0.03, t + 0.03, a - 0.2, a + 0.2, { nt: 2, na: 4, smooth: 1 });
    let rmax = 0;
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 4; j++) rmax = Math.max(rmax, R(t - 0.03 + 0.03 * i, a - 0.2 + 0.1 * j));
    k.on(TORSO[torsoBand(t)]![0], () => k.frame(onSurface(s, t, a, 0.007, rmax), () => {
      const h = w * 0.88;
      k.add(box(w + 0.006, h + 0.006, 0.004), seam, 0, 0, 0, 0, 0, tilt)
        .add(new PlaneGeometry(w, h), outer, 0, 0, 0.0022, 0, 0, tilt)
        .add(new PlaneGeometry(w * 0.6, h * 0.55), inner, 0, 0, 0.0026, 0, 0, tilt);
      // Stitches across the frame, two on each side.
      for (const [x, y, rz] of [[-w / 2, h / 4, 0], [-w / 2, -h / 4, 0], [w / 2, h / 4, 0], [w / 2, -h / 4, 0], [w / 4, h / 2, Math.PI / 2], [-w / 4, -h / 2, Math.PI / 2]] as const) {
        const c = Math.cos(tilt), sn = Math.sin(tilt);
        k.add(box(0.008, 0.0016, 0.0016), plain(0xd8c8a0), x * c - y * sn, x * sn + y * c, 0.0028, 0, 0, tilt + rz + 0.5);
      }
    }));
  }
};

export const FX_GEAR: Readonly<Record<string, GearBuilder>> = { 'fx-spaeti': fxSpaeti };
