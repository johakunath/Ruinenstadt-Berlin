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
  /** Light colours of the street lanterns (warm `0xffb060` on other maps), picked per lantern; repeat a colour to weight it. */
  lamp: number[];
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
 * Mitte 2089 neon night (Johannes 2026-11-18, from the three variants of step 3: mainly A "Neonregen", a bit
 * less saturated, some of B's blue, occasional red from C). Rain-wet streets with a reflection streak under
 * every light, neon signs and poles below 5 m, tinted rain. Most lanterns amber, some cold blue LED, a few
 * sodium red; neon mostly magenta, amber and cyan with blue and red accents.
 */
export const MITTE_SKY: Sky = {
  id: 'mitte',
  background: 0x18132c,
  fog: 0x221a35,
  fogDensity: 0.021,
  env: { top: [0.21, 0.14, 0.34], horizon: [0.07, 0.045, 0.105], lamps: 1.1, intensity: 0.74 },
  hemi: { sky: 0x7c6fb2, ground: 0x241a26, intensity: 0.85 },
  sun: { color: 0xafadff, intensity: 1.55, from: [-11, 24, 12] },
  lamps: 1,
  look: { saturation: 1.28, split: 0.3, contrast: 1.1, bloom: 0.95, exposure: 1.15 },
  wet: {
    streak: 1.05, streakAlpha: 0.58, gloss: 0.42,
    lamp: [0xffb060, 0xffb060, 0xffb060, 0xffb060, 0xffb060, 0xffb060, 0xffb060, 0x6a8cff, 0x6a8cff, 0xff6a3a],
    neon: { warm: [0xff4fa3, 0xe19142, 0xff4fa3, 0xff4fa3, 0xe19142, 0xff3b30], cold: [0x43d1cf, 0x43d1cf, 0x6a8cff, 0x43d1cf, 0xff4fa3] },
    glow: 0.95, density: 0.75, rain: 0xc0b8e8, rainNeon: 0.25,
  },
};

/**
 * M16 Charlottenburg step 3a/3b: one sky per zone, evening to morning along the route (map doc C2; spec in
 * `docs/tasks/m16-charlottenburg.md` › Step 3a spec). Blaue Stunde at the Zoo, Premierennacht on the
 * Ku'damm, Mondnacht in the Schlossgarten, Morgengrauen at the Spiegelschloss. All keep NIGHT_SKY's light
 * direction (`sun.from`): a moving sun would move every shadow. First values; Johannes tunes them.
 */
export const CHARLOTTENBURG_SKIES: readonly Sky[] = [
  // Zone 1 Blaue Stunde: violet-teal sky, berry horizon, lamps and shop windows coming on.
  {
    id: 'ch-blau', background: 0x24284a, fog: 0x2b2a4c, fogDensity: 0.016,
    env: { top: [0.2, 0.24, 0.44], horizon: [0.46, 0.2, 0.34], lamps: 0.8, intensity: 0.7 },
    hemi: { sky: 0x8590cc, ground: 0x2a2230, intensity: 0.95 },
    sun: { color: 0xb6a9e6, intensity: 1.7, from: NIGHT_SKY.sun.from },
    lamps: 0.85,
    look: { exposure: 1.1, saturation: 1.26, split: 0.35, contrast: 1.06, bloom: 0.8 },
  },
  // Zone 2 Premierennacht: black sky, the bulbs and the searchlights carry the street.
  {
    id: 'ch-premiere', background: 0x07070d, fog: 0x0d0b14, fogDensity: 0.018,
    env: { top: [0.06, 0.06, 0.1], horizon: [0.14, 0.05, 0.11], lamps: 1.3, intensity: 0.6 },
    hemi: { sky: 0x4c4c74, ground: 0x1b1418, intensity: 0.7 },
    sun: { color: 0x9aa8d8, intensity: 1.4, from: NIGHT_SKY.sun.from },
    lamps: 1.15,
    look: { exposure: 1.05, saturation: 1.3, split: 0.45, contrast: 1.1, bloom: 1.0 },
  },
  // Zone 3 Mondnacht: cold moon, long shadows, mist.
  {
    id: 'ch-mond', background: 0x0d1828, fog: 0x15243a, fogDensity: 0.02,
    env: { top: [0.12, 0.2, 0.34], horizon: [0.05, 0.08, 0.14], lamps: 0.8, intensity: 0.6 },
    hemi: { sky: 0x80a6da, ground: 0x141a22, intensity: 0.8 },
    sun: { color: 0xd2e2ff, intensity: 2.4, from: NIGHT_SKY.sun.from },
    lamps: 0.9,
    look: { exposure: 1.0, saturation: 1.1, split: 0.55, contrast: 1.06, bloom: 0.8 },
  },
  // Zone 4 Morgengrauen: pale pearl and rose behind the dome, lamps fading.
  {
    id: 'ch-morgen', background: 0xb4a6bd, fog: 0xc4b0c4, fogDensity: 0.012,
    env: { top: [0.68, 0.68, 0.82], horizon: [0.95, 0.74, 0.76], lamps: 0.3, intensity: 0.85 },
    hemi: { sky: 0xc6c6e6, ground: 0x463c4a, intensity: 1.1 },
    sun: { color: 0xffdcd6, intensity: 2.2, from: NIGHT_SKY.sun.from },
    lamps: 0.35,
    look: { exposure: 0.92, saturation: 1.02, split: 0.15, contrast: 1.04, bloom: 0.7 },
  },
];

/**
 * M18 Wedding, look A „Lampionnacht“ (Johannes 2026-11-21, `docs/maps/wedding.md` › Light): one dry night for the
 * whole map, deep emerald-teal sky and fog, a dim green moon; all gold comes from the lamps and cloth below 5 m,
 * so lamps run a little stronger than the default night. No zone blend.
 */
export const WEDDING_SKY: Sky = {
  id: 'wedding',
  background: 0x061b17,
  fog: 0x08201b,
  fogDensity: 0.016,
  env: { top: [0.08, 0.27, 0.22], horizon: [0.02, 0.07, 0.055], lamps: 1.15, intensity: 0.5 },
  hemi: { sky: 0x5aa894, ground: 0x1e1a14, intensity: 0.72 },
  sun: { color: 0x9fdcc6, intensity: 1.55, from: NIGHT_SKY.sun.from },
  lamps: 1.15,
  look: { saturation: 1.12, contrast: 1.05, bloom: 0.9 },
};

/**
 * M17 Fernsehturm (T7, `docs/maps/fernsehturm.md` › Light and look): one sky per deck, night at the foot, dawn at the
 * top. The deck is the zone; the lift ride snaps the sky while the curtain is dark, so the decks never blend.
 * Foyer: the plain night, cold. Schacht: almost black, a green glow from the jungle below. Panoramaetage: deep blue
 * before dawn. Telecafé: rose and pearl, first light. Uhrenraum: the sun standing on the horizon, pale gold.
 */
export const TURM_SKIES: readonly Sky[] = [
  { ...NIGHT_SKY, id: 'turm-foyer', background: 0x0a1518, fog: 0x0a1518, fogDensity: 0.012, hemi: { sky: 0x6a9aae, ground: 0x1c1a18, intensity: 0.7 }, sun: { color: 0x9cc8e0, intensity: 1.2, from: NIGHT_SKY.sun.from }, lamps: 1.05 },
  {
    id: 'turm-schacht', background: 0x030807, fog: 0x06120c, fogDensity: 0.022,
    env: { top: [0.03, 0.08, 0.06], horizon: [0.01, 0.05, 0.03], lamps: 1.1, intensity: 0.4 },
    hemi: { sky: 0x2c4a3c, ground: 0x0c2a14, intensity: 0.55 }, sun: { color: 0x6ad890, intensity: 0.6, from: [-4, 24, 6] }, lamps: 1.2,
    look: { contrast: 1.08 },
  },
  {
    id: 'turm-panorama', background: 0x16204a, fog: 0x1c2450, fogDensity: 0.01,
    env: { top: [0.12, 0.16, 0.38], horizon: [0.32, 0.2, 0.36], lamps: 1, intensity: 0.6 },
    hemi: { sky: 0x7088d0, ground: 0x2a2030, intensity: 0.8 }, sun: { color: 0xa8b4ff, intensity: 1.3, from: [14, 18, -16] }, lamps: 1,
    look: {},
  },
  {
    id: 'turm-telecafe', background: 0x6a4a66, fog: 0x7a5468, fogDensity: 0.008,
    env: { top: [0.42, 0.36, 0.48], horizon: [0.8, 0.52, 0.5], lamps: 0.9, intensity: 0.75 },
    hemi: { sky: 0xe0b0c0, ground: 0x3a2826, intensity: 0.9 }, sun: { color: 0xffc0b0, intensity: 1.6, from: [18, 10, -14] }, lamps: 0.95,
    look: { contrast: 1.04 },
  },
  {
    id: 'turm-uhrenraum', background: 0x7a5a38, fog: 0x8a6a44, fogDensity: 0.008,
    env: { top: [0.46, 0.4, 0.36], horizon: [1, 0.72, 0.4], lamps: 0.9, intensity: 0.85 },
    hemi: { sky: 0xf0d0a0, ground: 0x3a2a1c, intensity: 0.85 }, sun: { color: 0xffd08a, intensity: 1.6, from: [22, 7, -10] }, lamps: 0.95,
    look: { contrast: 1.06, bloom: 0.95 },
  },
];

/** Skies blended by zone on this map (`?sky=one`: the Premierennacht everywhere, the fallback of E1), else null. */
export function zoneSkies(mapId: string | undefined, variant: string | null): readonly Sky[] | null {
  if (mapId === 'turm') return TURM_SKIES;
  return mapId === 'charlottenburg' && variant !== 'one' ? CHARLOTTENBURG_SKIES : null;
}

/** The zone whose sky holds at (x, z): the zone of the nearest fight circle (distance to its rim). */
export function skyZoneAt(encounters: ReadonlyArray<{ x: number; z: number; r: number; zone: number }>, x: number, z: number): number {
  let best = Infinity, zone = 0;
  for (const e of encounters) {
    const d = Math.hypot(e.x - x, e.z - z) - e.r;
    if (d < best) { best = d; zone = e.zone; }
  }
  return zone;
}

const mixHex = (a: number, b: number, k: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const mix = (a: number, b: number, k: number): number => a + (b - a) * k;
const mix3 = (a: readonly number[], b: readonly number[], k: number): [number, number, number] => [mix(a[0]!, b[0]!, k), mix(a[1]!, b[1]!, k), mix(a[2]!, b[2]!, k)];

/** Sky between `a` (k 0) and `b` (k 1): colours, strengths and the grade keys either sets; `id`, `wet` and the light direction stay `a`'s. */
export function mixSky(a: Sky, b: Sky, k: number): Sky {
  const look: Partial<Look> = {};
  for (const key of new Set([...Object.keys(a.look), ...Object.keys(b.look)]) as Set<keyof Look>) {
    const va = a.look[key] ?? b.look[key]!, vb = b.look[key] ?? va;
    look[key] = mix(va, vb, k);
  }
  return {
    ...a,
    background: mixHex(a.background, b.background, k),
    fog: mixHex(a.fog, b.fog, k),
    fogDensity: mix(a.fogDensity, b.fogDensity, k),
    env: { top: mix3(a.env.top, b.env.top, k), horizon: mix3(a.env.horizon, b.env.horizon, k), lamps: mix(a.env.lamps, b.env.lamps, k), intensity: mix(a.env.intensity, b.env.intensity, k) },
    hemi: { sky: mixHex(a.hemi.sky, b.hemi.sky, k), ground: mixHex(a.hemi.ground, b.hemi.ground, k), intensity: mix(a.hemi.intensity, b.hemi.intensity, k) },
    sun: { color: mixHex(a.sun.color, b.sun.color, k), intensity: mix(a.sun.intensity, b.sun.intensity, k), from: a.sun.from },
    lamps: mix(a.lamps, b.lamps, k),
    look,
  };
}

/** The sky of a map: Alexanderplatz by `?sky=` (default A until Johannes picks), Mitte's neon night, Charlottenburg's first zone (Premierennacht with `?sky=one`), every other map night. */
export function skyFor(mapId: string | undefined, variant: string | null): Sky {
  if (mapId === 'mitte') return MITTE_SKY;
  if (mapId === 'wedding') return WEDDING_SKY;
  if (mapId === 'turm') return TURM_SKIES[0]!;
  if (mapId === 'charlottenburg') return CHARLOTTENBURG_SKIES[variant === 'one' ? 1 : 0]!;
  if (mapId !== 'alex') return NIGHT_SKY;
  return ALEX_SKIES[(variant === 'b' || variant === 'c' ? variant : 'a')];
}
