// Time of day per map (M15 Alexanderplatz step 3, `docs/tasks/m15-alexanderplatz.md`). Every map so far
// is night (`NIGHT_SKY`, the values the renderer always had). Alexanderplatz is the one daylight district
// (story: 1989, autumn afternoon); its variants are compared with `?sky=a|b|c` until Johannes picks one.
// The light count never changes: the sun is the moon's light, lamps stay pooled lights with lower strength.
import type { Look } from './looks';

export interface Sky {
  id: string;
  /** Clear colour and fog colour. */
  background: number;
  fog: number;
  /** Scene fog density (night 0.017); weather presets scale with it. */
  fogDensity: number;
  /** Reflection environment: colour at the zenith, at the horizon, and how strong it is. */
  env: { top: [number, number, number]; horizon: [number, number, number]; lamps: number; intensity: number };
  hemi: { sky: number; ground: number; intensity: number };
  /** The shadow-casting light (moon or sun): colour, strength, offset from the hero (direction it comes from). */
  sun: { color: number; intensity: number; from: [number, number, number] };
  /** Scale of pooled lamp lights and their ground glow decals (night 1). */
  lamps: number;
  /** Grade on top of `LOOK`. */
  look: Partial<Look>;
}

export const NIGHT_SKY: Sky = {
  id: 'night',
  background: 0x0b1a1d,
  fog: 0x0b1a1d,
  fogDensity: 0.017,
  env: { top: [0.13, 0.27, 0.3], horizon: [0.03, 0.07, 0.08], lamps: 1, intensity: 0.55 },
  hemi: { sky: 0x6fb0ae, ground: 0x1f1c18, intensity: 0.8 },
  sun: { color: 0xa8dde2, intensity: 1.9, from: [-11, 24, 12] },
  lamps: 1,
  look: {},
};

/**
 * Alexanderplatz afternoon, three looks (Johannes 2026-11-18: afternoon light, brighter than the other
 * districts, saturated yellow and blue). The sun stands in the south-west, behind the camera's left
 * shoulder, so fronts facing the camera are lit and shadows fall to the north-east.
 */
export const ALEX_SKIES: Record<'a' | 'b' | 'c', Sky> = {
  // A Goldene Stunde: low warm sun, long shadows, amber haze; lamps barely on.
  a: {
    id: 'alex-a',
    background: 0xd9b48a,
    fog: 0xd9b48a,
    fogDensity: 0.0075,
    env: { top: [0.55, 0.62, 0.7], horizon: [0.85, 0.66, 0.45], lamps: 0.2, intensity: 0.8 },
    hemi: { sky: 0xb9cfd6, ground: 0x6a5641, intensity: 1.15 },
    sun: { color: 0xffbf7a, intensity: 3.1, from: [-20, 15, 14] },
    lamps: 0.25,
    look: { exposure: 0.9, saturation: 1.3, split: 0.35, contrast: 1.08, bloom: 0.55 },
  },
  // B Klarer Herbstnachmittag: higher, nearly white sun, blue sky, the brightest; colours pop.
  b: {
    id: 'alex-b',
    background: 0x9cc3db,
    fog: 0xb4cfdc,
    fogDensity: 0.005,
    env: { top: [0.45, 0.62, 0.85], horizon: [0.8, 0.82, 0.8], lamps: 0, intensity: 0.95 },
    hemi: { sky: 0xa9cbe6, ground: 0x6d6352, intensity: 1.3 },
    sun: { color: 0xfff0d6, intensity: 3.4, from: [-14, 26, 12] },
    lamps: 0.12,
    look: { exposure: 0.85, saturation: 1.36, split: 0.2, contrast: 1.1, bloom: 0.45 },
  },
  // C Dunstiger Spätnachmittag: the board's pink-lilac haze, soft sun, lamps and windows already glow.
  c: {
    id: 'alex-c',
    background: 0xc9a7a6,
    fog: 0xc9a7a6,
    fogDensity: 0.0105,
    env: { top: [0.6, 0.55, 0.65], horizon: [0.8, 0.6, 0.55], lamps: 0.5, intensity: 0.75 },
    hemi: { sky: 0xc8b6c6, ground: 0x5e4a42, intensity: 1.05 },
    sun: { color: 0xffc89a, intensity: 2.4, from: [-22, 12, 10] },
    lamps: 0.5,
    look: { exposure: 0.92, saturation: 1.22, split: 0.45, contrast: 1.04, bloom: 0.7 },
  },
};

/** The sky of a map: Alexanderplatz by `?sky=` (default A until Johannes picks), every other map night. */
export function skyFor(mapId: string | undefined, variant: string | null): Sky {
  if (mapId !== 'alex') return NIGHT_SKY;
  return ALEX_SKIES[(variant === 'b' || variant === 'c' ? variant : 'a')];
}
