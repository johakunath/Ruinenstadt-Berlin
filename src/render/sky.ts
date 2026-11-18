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
  /** M15 Mitte (2089): wet streets, recoloured lanterns, the neon palette; other maps leave it out. */
  wet?: Wet;
}

/** Rain-wet neon night (Mitte, `docs/tasks/m15-mitte.md` step 3). */
export interface Wet {
  /** Reflection streak under every light toward the camera: length factor (0 = none) and opacity. */
  streak: number;
  streakAlpha: number;
  /** Roughness scale of the street materials (lower is glossier: they mirror the sky environment). */
  gloss: number;
  /** Light colour of the street lanterns (warm `0xffb060` on other maps). */
  lamp: number;
  /** Neon colours: warm shop and club signs, cold signs (Regierungsviertel, towers). */
  neon: { warm: number[]; cold: number[] };
  /** Neon brightness and the share of street fronts that carry a sign. */
  glow: number;
  density: number;
  /** Rain streak colour and the share of streaks tinted by the neon. */
  rain: number;
  rainNeon: number;
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

/**
 * Mitte 2089, three neon nights (step 3, Johannes picks). Shared: rain-wet streets with a reflection streak
 * under every light, neon signs and poles below 5 m, tinted rain. They differ in sky, lantern colour and palette.
 */
export const MITTE_SKIES: Record<'a' | 'b' | 'c', Sky> = {
  // A Neonregen (the board `docs/style/potsdamer-platz.png`): violet sky, magenta and cyan neon, amber lanterns.
  a: {
    id: 'mitte-a',
    background: 0x1e1430,
    fog: 0x2a1a3a,
    fogDensity: 0.02,
    env: { top: [0.25, 0.12, 0.32], horizon: [0.08, 0.04, 0.1], lamps: 1.2, intensity: 0.75 },
    hemi: { sky: 0x8a6ab0, ground: 0x2a1a24, intensity: 0.9 },
    sun: { color: 0xb8a8ff, intensity: 1.5, from: [-11, 24, 12] },
    lamps: 1,
    look: { saturation: 1.4, split: 0.15, contrast: 1.08, bloom: 1, exposure: 1.18 },
    wet: { streak: 1, streakAlpha: 0.6, gloss: 0.45, lamp: 0xffb060, neon: { warm: [0xff4fa3, 0xe19142, 0xff4fa3], cold: [0x43d1cf, 0x43d1cf, 0xff4fa3] }, glow: 1, density: 0.8, rain: 0xc8b0e0, rainNeon: 0.3 },
  },
  // B Kaltes LED: blue-black night, cold blue LED lanterns (2D `#6a8cff`), cyan neon, magenta rare; denser haze.
  b: {
    id: 'mitte-b',
    background: 0x07101e,
    fog: 0x0c1828,
    fogDensity: 0.024,
    env: { top: [0.1, 0.2, 0.38], horizon: [0.03, 0.06, 0.12], lamps: 0.8, intensity: 0.7 },
    hemi: { sky: 0x5a7ab8, ground: 0x141822, intensity: 0.7 },
    sun: { color: 0x9ab8ff, intensity: 1.7, from: [-11, 24, 12] },
    lamps: 1.1,
    look: { saturation: 1.12, split: 0.75, contrast: 1.12, bloom: 0.85, exposure: 1.08 },
    wet: { streak: 1.3, streakAlpha: 0.55, gloss: 0.35, lamp: 0x6a8cff, neon: { warm: [0x43d1cf, 0xff4fa3, 0x43d1cf], cold: [0x43d1cf, 0x6a8cff, 0x43d1cf] }, glow: 0.9, density: 0.45, rain: 0xa8c8ff, rainNeon: 0.12 },
  },
  // C Glut im Smog: sodium-orange lanterns in warm smog, magenta and amber neon, few cold accents.
  c: {
    id: 'mitte-c',
    background: 0x1a0f12,
    fog: 0x2a1a18,
    fogDensity: 0.026,
    env: { top: [0.22, 0.12, 0.1], horizon: [0.1, 0.05, 0.04], lamps: 1.4, intensity: 0.6 },
    hemi: { sky: 0x9a6a5a, ground: 0x24180f, intensity: 0.65 },
    sun: { color: 0xd8a890, intensity: 1.2, from: [-11, 24, 12] },
    lamps: 1.15,
    look: { saturation: 1.3, split: 0.3, contrast: 1.16, bloom: 0.9, exposure: 1.08 },
    wet: { streak: 0.7, streakAlpha: 0.45, gloss: 0.6, lamp: 0xff9440, neon: { warm: [0xff4fa3, 0xe19142, 0xff4fa3], cold: [0xff4fa3, 0x43d1cf, 0xe19142] }, glow: 1.1, density: 0.6, rain: 0xe0b090, rainNeon: 0.2 },
  },
};

/** The sky of a map by `?sky=` (default A until Johannes picks): Alexanderplatz by day, Mitte's neon nights, every other map night. */
export function skyFor(mapId: string | undefined, variant: string | null): Sky {
  const v = variant === 'b' || variant === 'c' ? variant : 'a';
  if (mapId === 'mitte') return MITTE_SKIES[v];
  if (mapId !== 'alex') return NIGHT_SKY;
  return ALEX_SKIES[v];
}
