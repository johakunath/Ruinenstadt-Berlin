// M18 Wedding step 3: light for the sights (look A „Lampionnacht“: warm paper and brass light under a green night).
// The plan is data in each sight's local frame (x along the front, z out of it, y up), drawn by the Charlottenburg
// light runner (`lightLandmarks`): pooled lights only where a real source is (door and wall lanterns, the chandeliers,
// a work lamp), washes and spills for footlights and lit windows, small lantern bodies where the model has none.
// No new colour: lamp, string lights, cold LED (the building site and the bunker), teal for one jewel glint.
// A light never stands in a fight circle, only at its rim (the hall's chandeliers hang in front of the palace, at the
// boss circle's north rim); the Magendoktor is the exception: the whole room is the arena, its lamps hang inside.
import type { Landmark, MapDef } from '../data/map';
import { KNEIPE } from '../data/kneipe';
import { COLD, G, L, LAMP, landmarkLightPlan, lightLandmarks, N, S, SHOP, W, type PlanItem } from './charlottenburg-lights';
import type { ChunkBuilder } from './map-world';

const PI = Math.PI, HALF = PI / 2;

/** What each Wedding sight gets (local frame of the landmark). */
export function weddingLightPlan(l: Landmark): PlanItem[] {
  const hz = l.hz;
  switch (l.kind) {
    case 'ubahn':
      return [L(0, 2.2, 0.8, LAMP, 12, 9, 3.6, { halo: 0.3 }, 0.03)];
    case 'nazareth':
      // Backdrop: two wall lanterns at the portals, light rising on the doors, the rose window faintly lit (candles).
      return [
        L(0, 3.2, 9.2, LAMP, 12, 8, 3.4, { reach: 0.8, halo: 0.3 }),
        N(-4.2, 3.0, 8.2), N(4.2, 3.0, 8.2),
        W(0, 0.6, 8.1, 0, 7.6, 4.2, LAMP, 'up', 0.9),
        G(0, 7.0, 8.3, 1.7, LAMP, 0.6),
      ];
    case 'neubau':
      // A cold work lamp on the hoarding aimed at the banner and the gap in the fence.
      return [L(-3, 1.4, hz + 1.2, COLD, 18, 10, 5, { stretch: 1.6, reach: 2.4, halo: 0.35 }, 0.02), W(0, 2.2, hz + 0.1, 0, 10, 3, COLD, 'up', 0.6)];
    case 'kneipe': {
      // Inside: warm lamps low over the tables and the counter; outside: the door lamp, the lit windows, the door spill.
      const F = KNEIPE.d / 2;
      return [
        L(4, 2.8, 1.5, LAMP, 22, 12, 7, { halo: 0.4 }, 0.06),
        L(-4, 2.8, -2, LAMP, 20, 12, 7, { halo: 0.4 }, 0.06),
        L(0, 2.6, F + 1.4, SHOP, 12, 9, 4, { reach: 0.6 }, 0.05),
        W(-3.5, 1.15, F + 0.12, 0, 2.0, 1.6, LAMP, 'round', 0.9), W(3.5, 1.15, F + 0.12, 0, 2.0, 1.6, LAMP, 'round', 0.9),
        S(0, F + 0.05, 0, 2.6, 2.4, LAMP, 0.9),
      ];
    }
    case 'amtsgericht':
      // The door lamp over the pointed portal, two lanterns on posts, light rising on the sandstone, two lit windows.
      return [
        L(0, 3.0, 8.0, LAMP, 14, 9, 3.6, { reach: 1.2, halo: 0.35 }),
        N(-2.9, 2.6, 7.7, 2.6), N(2.9, 2.6, 7.7, 2.6),
        W(0, 0, 7.12, 0, 5, 7, LAMP, 'up', 1.1),
        W(-7.4, 4.9, 5.06, 0, 1.4, 1.7, LAMP, 'round', 1.2), W(9.6, 7.9, 5.06, 0, 1.4, 1.7, LAMP, 'round', 1.0),
        S(0, 7.1, 0, 5, 2.2, LAMP, 0.8),
      ];
    case 'flakturm': {
      // A lamp on the stair landing, lanterns on the platform rails, cold footlights rising up the south faces above
      // the slope, a cold lamp at the bunker door on the west side.
      const X = 7.3, fz = 3.6 * Math.cos(PI / 8) + 0.08;
      return [
        L(0, 12.6, 3.4, LAMP, 12, 10, 4, { halo: 0.4 }),
        N(-X, 15.4, fz + 0.1), N(X, 15.4, fz + 0.1),
        G(-X, 15.6, fz + 0.2, 0.9, LAMP, 1.2), G(X, 15.6, fz + 0.2, 0.9, LAMP, 1.2),
        W(-X, 6.2, fz, 0, 5, 8, COLD, 'up', 0.7), W(X, 6.2, fz, 0, 5, 8, COLD, 'up', 0.7),
        L(-X - 3.9, 2.6, 0, COLD, 10, 8, 3, { yaw: -HALF, reach: 1 }, 0.02),
      ];
    }
    case 'beamtentor':
      // A lantern hangs in the arch; footlights rise on both tower fronts and the gable (lettering and mosaics).
      return [
        L(0, 6.2, 0, LAMP, 14, 10, 4, { halo: 0.45 }, 0.04),
        N(0, 5.9, 0, 0),
        N(-7.4, 2.8, 2.6), N(7.4, 2.8, 2.6),
        W(-5.6, 0, 2.46, 0, 4.4, 8, LAMP, 'up', 1.5), W(5.6, 0, 2.46, 0, 4.4, 8, LAMP, 'up', 1.5),
        W(0, 5.5, 2.46, 0, 6.2, 5.5, LAMP, 'up', 1.2),
        W(-5.6, 0, -2.46, PI, 4.4, 6, LAMP, 'up', 0.9), W(5.6, 0, -2.46, PI, 4.4, 6, LAMP, 'up', 0.9),
      ];
    case 'maschinenhalle': {
      // The chandeliers in front of the palace (the boss circle's rim), warm uplights at the foot of the front, the
      // glimpse of lit rooms in the five arches, the crown's glow, a lamp at the east door outside.
      const z0 = -hz + 1.1, F = z0 + 0.8, cz = z0 + 3.2;
      return [
        ...[-12, 0, 12].map((x) => L(x, 5.5, cz, SHOP, 22, 14, 6, { halo: 0.9 }, 0.06)),
        ...[-10, 10].map((x) => L(x, 0.5, z0 + 2.2, LAMP, 18, 11, 5, { yaw: PI, stretch: 1.4, reach: 1.2, halo: 0.4 }, 0.05)),
        W(0, 0.5, F + 0.3, 0, 28, 7, LAMP, 'up', 1.4),
        // Lit rooms behind the four outer arches (the throne stands before the middle one, under the chandelier).
        ...[-2, -1, 1, 2].map((i) => W(i * 5.6, 0.5, F + 0.06, 0, 2.6, 4, SHOP, 'round', 0.8)),
        G(0, 11.6, z0 + 1, 1.6, LAMP, 1),
        L(l.hx + 1.1, 3, -1, LAMP, 12, 9, 3.5, { yaw: HALF, reach: 1 }),
        N(l.hx + 0.55, 2.8, -4.4),
      ];
    }
    default:
      return [];
  }
}

/** Dresses every Wedding sight with light (`buildWeddingWorld`). */
export function lightWeddingLandmarks(m: MapDef, chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number): void {
  lightLandmarks(m, chunkOf, ground, weddingLightPlan);
}

/** Every light of the Wedding sights in world space (tests). */
export const weddingLights = (m: MapDef): ReturnType<typeof landmarkLightPlan> => landmarkLightPlan(m, weddingLightPlan);
