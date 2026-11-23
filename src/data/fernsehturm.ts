// M17 Fernsehturm finale, layout A „Aufstieg“ (Johannes 2026-11-21; spec `docs/maps/fernsehturm.md`, plan
// `docs/tasks/m17-fernsehturm.md`). The finale plays inside the tower: five round decks one above the other, joined by
// the lift. Collision stays 2D, so the decks lie side by side on the plane, 120 m apart; only the hero's deck is drawn.
// Each deck is a ring arena round a core (T1); the fight centre is the deck centre (T3), so every fight carries a
// walkable spot `at`. Meters, +X east, +Z south; `scale` is ignored (rooms keep their real size).
// Facing convention as everywhere: angle a points along (sin a, cos a); 0 is south (toward the camera), π north.
import { THREAT, type BossKind, type EnemyKind, lateTier } from './enemies';
import type { EncounterDef, Point, WaveDef, ZoneDef } from '../sim/level';
import type { RestArea } from '../sim/rest';
import { ENDING, HAND, LIFT, type BandDef, type HandDef, type LiftDef } from '../sim/turm';
import type { Prop } from './courtyard';
import type { MapDef } from './map';

export type CoreKind = 'solid' | 'well' | 'low';
/** One deck (T1): outline (a circle, or a regular polygon with `sides` and circumradius `r`), core, the blocked bar arc. */
export interface DeckDef {
  id: 'foyer' | 'schacht' | 'panorama' | 'telecafe' | 'uhrenraum';
  /** German deck name (banner, zone). */
  name: string;
  x: number;
  z: number;
  r: number;
  /** Regular polygon outline (the hexagonal foyer); its faces' normals point along k · 360° / sides. */
  sides?: number;
  core: { r: number; kind: CoreKind };
  /** Telecafé bar: the arc between r0 and r1 within `half` of angle `a` is blocked (the counter). */
  bar?: { r0: number; r1: number; a: number; half: number };
  /** Height label of the lift counter (`docs/maps/fernsehturm.md` › Decks). */
  height: string;
}

/** Distance between deck centres on the plane (they stand side by side; the lift joins them). */
export const DECK_GAP = 120;

export const TURM_DECKS: readonly DeckDef[] = [
  { id: 'foyer', name: 'Foyer', x: 0, z: 0, r: 26, sides: 6, core: { r: 5, kind: 'solid' }, height: '0 m' },
  { id: 'schacht', name: 'Schacht', x: 120, z: 0, r: 15, core: { r: 5.5, kind: 'well' }, height: '100 m' },
  { id: 'panorama', name: 'Panoramaetage', x: 240, z: 0, r: 17, core: { r: 5, kind: 'solid' }, height: '203 m' },
  { id: 'telecafe', name: 'Telecafé', x: 360, z: 0, r: 17, core: { r: 5, kind: 'solid' }, bar: { r0: 5, r1: 7.5, a: Math.PI, half: Math.PI / 4 }, height: '207 m' },
  { id: 'uhrenraum', name: 'Uhrenraum', x: 480, z: 0, r: 17, core: { r: 4, kind: 'low' }, height: '220 m' },
];

/** Apothem of a polygon deck (distance from the centre to a face). */
export const apothem = (d: DeckDef): number => (d.sides ? d.r * Math.cos(Math.PI / d.sides) : d.r);

/** Distance of (x, z) inside the deck's outline from its edge (negative outside). */
export function deckInset(d: DeckDef, x: number, z: number): number {
  const dx = x - d.x, dz = z - d.z;
  if (!d.sides) return d.r - Math.hypot(dx, dz);
  const ap = apothem(d);
  let worst = Infinity;
  for (let k = 0; k < d.sides; k++) {
    const a = (k * 2 * Math.PI) / d.sides;
    worst = Math.min(worst, ap - (dx * Math.sin(a) + dz * Math.cos(a)));
  }
  return worst;
}

/** The deck whose outline holds (x, z), if any. */
export function deckAt(decks: readonly DeckDef[], x: number, z: number): DeckDef | null {
  for (const d of decks) if (Math.abs(x - d.x) <= d.r + 1 && deckInset(d, x, z) >= 0) return d;
  return null;
}

/** On the counter of a deck's bar. */
export function inBar(d: DeckDef, x: number, z: number, pad = 0): boolean {
  const B = d.bar;
  if (!B) return false;
  const dx = x - d.x, dz = z - d.z, r = Math.hypot(dx, dz);
  if (r < B.r0 - pad || r > B.r1 + pad) return false;
  let da = Math.atan2(dx, dz) - B.a;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) <= B.half + pad / Math.max(r, 1);
}

/** T1: walkable inside a deck's outline (`pad` in from its wall), outside its core and its bar. */
export function deckWalk(decks: readonly DeckDef[], x: number, z: number, pad = 0): boolean {
  const d = deckAt(decks, x, z);
  if (!d || deckInset(d, x, z) < pad) return false;
  if (Math.hypot(x - d.x, z - d.z) < d.core.r + pad) return false;
  return !inBar(d, x, z, pad);
}

/** Lift door on the south face of a core (toward the camera); the ring at the door, the arrival 2 m south of it. */
export const liftDoor = (d: DeckDef): Point => ({ x: d.x, z: d.z + d.core.r });
export const liftRing = (d: DeckDef): Point => ({ x: d.x, z: d.z + d.core.r + 0.2 });
export const liftArrival = (d: DeckDef): Point => ({ x: d.x, z: d.z + d.core.r + 2 });

/** A piece of furniture that blocks (drawn in `src/render/turm-world.ts`). Box half extents along the local axes. */
export interface TurmSolid {
  what: 'kiosk' | 'counter' | 'shelf' | 'table' | 'telescope' | 'bench' | 'console' | 'switch' | 'crank';
  x: number;
  z: number;
  rot: number;
  hx: number;
  hz: number;
  /** Round pieces (tables, telescopes) collide as a circle of radius `hx`. */
  round?: boolean;
}
/** A lamp of the deck (hand-placed, no generator; the invariant asks one within 13 m of every walkable point). */
export interface TurmLight { x: number; z: number; y: number; color: number; intensity: number; distance: number }

/** What the tower adds to a map: lifts, hands, band, furniture, rest stops, lamps, the main switch. */
export interface TurmLayout {
  lifts: LiftDef[];
  hands: HandDef[];
  band: BandDef | null;
  solids: TurmSolid[];
  rests: RestArea[];
  lights: TurmLight[];
  /** Uhrenraum: the main switch; the two rings of the ending choice beside it (T10). */
  mainSwitch: Point;
  ending: Array<{ id: 'gestellt' | 'gelassen'; x: number; z: number; r: number }>;
  /** Uhrenraum: six gear seats round the movement (Der Zeitwart's holds, T9). */
  seats: Point[];
}

/** Normal waves: foyer 2, schacht 2 after the hold, panorama 3, telecafe 3 (F3); echoes and the boss on top. */
export const TURM_WAVES = 10;
/** Provisional (F8): +8 per district after Wedding (40 to 62), not calibrated until the B2 bot pass. */
export const TURM_TIER = { from: 48, to: 70 } as const;
/** Enemy strength step: district 6 (Köpenick 0 … Wedding 5). */
export const TURM_DISTRICT = 6;

/**
 * Echo bosses (F3), one per fight 2 to 4 as its last wave, and the final boss. Telecafé: Sultan Nimmersatt, the
 * Wedding district boss, is the eternal host of a revolving restaurant (map doc: „may become the Wedding boss once
 * Wedding is built“; Wedding is on `main`, so decided in step 1). The echoes are the plain kinds with the echo
 * modifier (`src/sim/echo.ts`); Der Zeitwart has his own brain (`src/sim/zeitwart.ts`).
 */
export const TURM_BOSSES: { schacht: BossKind; panorama: BossKind; telecafe: BossKind; zeitwart: BossKind } = {
  schacht: 'hauptmann', panorama: 'spreehexe', telecafe: 'sultan', zeitwart: 'zeitwart',
};

/**
 * Two districts per deck (map doc › Flow), the Zeitlose (walker) everywhere. Schacht: Urzeit (Köpenick) and 2089
 * (Mitte); Panoramaetage: 1981 (Xhain) and 1989 (Alexanderplatz); Telecafé: 1920 (Charlottenburg) and „kommt bald“
 * (Wedding). The foyer has the plain Zeitlose. The boss fight's adds come from every era.
 */
export const TURM_MIX: ReadonlyArray<Partial<Record<EnemyKind, number>>> = [
  { walker: 6, runner: 1.4, brute: 0.6, spitter: 0.8 },
  { walker: 4, raptor: 1.2, crow: 0.8, kabel: 1, drone: 0.8 },
  { walker: 4, zuender: 0.8, schild: 0.6, heuler: 0.6, rat: 0.4, uhrwerk: 0.8, wurzler: 0.6, kernspeier: 0.6 },
  { walker: 4, scherbe: 0.9, loge: 0.7, souffleur: 0.6, teeifrit: 0.8, baklava: 0.6, teppich: 0.6 },
  { walker: 3, raptor: 0.6, drone: 0.6, uhrwerk: 0.6, scherbe: 0.6, teeifrit: 0.6 },
];

/**
 * Bodies per wave against the district formula: the rings are small and the tower should take 10 to 12 minutes (bot
 * campaigns 2026-11-23 with the carried hero: 15.5 min at ×1, the Telecafé alone 4 min).
 */
export const TURM_COUNT = 0.75;

/** Wave `g` (48 … 70) on deck `deck`: the district formula of Wedding, fewer bodies, at most 8 alive (the rings are small). */
export function turmWaveTier(g: number, deck: number, bosses: BossKind[] = []): WaveDef {
  return {
    count: Math.round((5 + g * 0.45) * lateTier(g).count * TURM_COUNT),
    maxAlive: Math.min(8, Math.max(5, Math.round(Math.min(12, 6 + Math.floor(g / 3)) * lateTier(g).count))),
    mix: { ...(TURM_MIX[deck] ?? TURM_MIX[0]!) },
    hpMul: (1 + g * 0.13) * lateTier(g).hp,
    dmgMul: 1 + g * 0.06,
    bosses,
    elite: THREAT.eliteChance(g),
  };
}

/** Start inside the north-east door of the foyer, the side of the S-Bahnhof (map doc › Entry). */
export const TURM_START: Point = { x: 16.8, z: -10.9 };

/** The tower's layout (lifts, hands, band, furniture, rests, lamps). */
export function turmLayout(): TurmLayout {
  const [foyer, schacht, panorama, telecafe, uhren] = TURM_DECKS as [DeckDef, DeckDef, DeckDef, DeckDef, DeckDef];
  const lift = (a: DeckDef, b: DeckDef, after: number): LiftDef => ({ from: liftRing(a), r: LIFT.r, to: liftArrival(b), after });
  const polar = (d: DeckDef, r: number, a: number): Point => ({ x: d.x + Math.sin(a) * r, z: d.z + Math.cos(a) * r });
  const solids: TurmSolid[] = [];
  // Foyer: the souvenir kiosk at (−13, 15) faces south; counter, back shelf and side walls; two benches by the glass.
  solids.push(
    { what: 'counter', x: -13, z: 14.2, rot: 0, hx: 2.2, hz: 0.35 },
    { what: 'shelf', x: -13, z: 11.9, rot: 0, hx: 2.5, hz: 0.3 },
    { what: 'kiosk', x: -15.35, z: 13, rot: 0, hx: 0.15, hz: 1.4 },
    { what: 'kiosk', x: -10.65, z: 13, rot: 0, hx: 0.15, hz: 1.4 },
    { what: 'bench', x: 8, z: 17, rot: 0, hx: 1.2, hz: 0.3 },
    { what: 'bench', x: -19, z: -2, rot: Math.PI / 2, hx: 1.2, hz: 0.3 },
  );
  // Panoramaetage: eight telescopes along the glass, none in front of the lift door.
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue;
    const p = polar(panorama, 15.6, a);
    solids.push({ what: 'telescope', x: p.x, z: p.z, rot: a, hx: 0.35, hz: 0.35, round: true });
  }
  // Telecafé: laid tables on the sill (r 14.5 to 16.5), outside the band; the south quarter stays open toward the camera.
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6 + Math.PI / 12;
    if (Math.cos(a) > 0.75) continue;
    const p = polar(telecafe, 15.4, a);
    solids.push({ what: 'table', x: p.x, z: p.z, rot: a, hx: 0.7, hz: 0.7, round: true });
  }
  // Schacht: the emergency hand crank at the hold ring's north edge, against the wall.
  solids.push({ what: 'crank', x: schacht.x, z: schacht.z - 13.6, rot: Math.PI, hx: 0.6, hz: 0.4 });
  // Uhrenraum: the main switch on the north side.
  const mainSwitch = { x: uhren.x, z: uhren.z - 15 };
  solids.push({ what: 'switch', x: mainSwitch.x, z: mainSwitch.z - 0.6, rot: Math.PI, hx: 0.7, hz: 0.4 });
  for (const s of [-1, 1]) solids.push({ what: 'console', x: uhren.x + s * 11, z: uhren.z - 11.5, rot: Math.PI, hx: 0.9, hz: 0.45 });

  // Rest stops (one on the way up, one before the boss): the kiosk and the Telecafé bar.
  const rests: RestArea[] = [
    { name: 'Kiosk', x: -13, z: 15.8, rot: 0, hx: 2.6, hz: 1.4, keeper: { x: -13, z: 13.1 }, desk: { x: -13, z: 15.1 } },
    { name: 'Telecafé-Bar', x: telecafe.x, z: telecafe.z - 8.5, rot: 0, hx: 2, hz: 0.6, keeper: { x: telecafe.x, z: telecafe.z - 6.2 }, desk: { x: telecafe.x, z: telecafe.z - 8.5 } },
  ];

  // Lamps by hand: a ring on every deck plus the warm ones (kiosk, bar, lift door).
  const lights: TurmLight[] = [];
  const ring = (d: DeckDef, r: number, n: number, color: number, intensity: number, a0 = 0): void => {
    for (let k = 0; k < n; k++) {
      const p = polar(d, r, a0 + (k * 2 * Math.PI) / n);
      lights.push({ x: p.x, z: p.z, y: 3.2, color, intensity, distance: 12 });
    }
  };
  ring(foyer, 17, 6, 0xe8dcc4, 10, Math.PI / 6);
  lights.push({ x: -13, z: 13.5, y: 2.6, color: 0xffb060, intensity: 16, distance: 10 });
  ring(schacht, 11, 5, 0xffd890, 9, Math.PI / 5);
  ring(panorama, 12, 6, 0xffcf8a, 9, Math.PI / 6);
  ring(telecafe, 12, 6, 0xffc890, 10, Math.PI / 6);
  ring(uhren, 11.5, 6, 0xffd27a, 10);
  // Candles on four Telecafé tables: low warm light at table height (organic light, guideline › Light).
  for (const k of [1, 4, 7, 10]) {
    const p = polar(telecafe, 15.4, (k * Math.PI) / 6 + Math.PI / 12);
    lights.push({ x: p.x, z: p.z, y: 1, color: 0xffa050, intensity: 4, distance: 5 });
  }
  // The shaft: green glow from the jungle below (no shade below 2.5 m).
  lights.push({ x: schacht.x, z: schacht.z, y: -2, color: 0x50ff80, intensity: 12, distance: 12 });
  for (const d of TURM_DECKS) {
    const door = liftDoor(d);
    lights.push({ x: door.x, z: door.z + 0.6, y: 2.8, color: 0xff5040, intensity: 5, distance: 6 });
  }

  return {
    lifts: [lift(foyer, schacht, 0), lift(schacht, panorama, 1), lift(panorama, telecafe, 2), lift(telecafe, uhren, 3)],
    hands: [
      { x: panorama.x, z: panorama.z, len: 16, period: 20, dir: 1, width: HAND.width, during: 2, a0: Math.PI },
      { x: uhren.x, z: uhren.z, len: 16, period: 12, dir: 1, width: HAND.width, during: 4, a0: Math.PI },
      { x: uhren.x, z: uhren.z, len: 10, period: 30, dir: -1, width: HAND.width, during: 4, a0: Math.PI / 2 },
    ],
    // T5: r 9.5 to 14 (spec r 8): the bar's rest strip in front of the counter (r 7.5 to 9.5) stays fixed.
    band: { x: telecafe.x, z: telecafe.z, r0: 9.5, r1: 14, period: 150 },
    solids,
    rests,
    lights,
    mainSwitch,
    // T10: „Uhr stellen“ west of the switch, „Stehen lassen“ east, camp ring size.
    ending: [{ id: 'gestellt', x: mainSwitch.x - 2.2, z: mainSwitch.z + 1.8, r: ENDING.r }, { id: 'gelassen', x: mainSwitch.x + 2.2, z: mainSwitch.z + 1.8, r: ENDING.r }],
    seats: Array.from({ length: 6 }, (_, k) => polar(uhren, 6, (k * Math.PI) / 3)),
  };
}

/** The finale map (`?map=turm`). */
export function turmMap(): MapDef {
  const [foyer, schacht, panorama, telecafe, uhren] = TURM_DECKS as [DeckDef, DeckDef, DeckDef, DeckDef, DeckDef];
  let n = 0;
  const g = (): number => TURM_TIER.from + (n++ * (TURM_TIER.to - TURM_TIER.from)) / (TURM_WAVES - 1);
  const waves = (deck: number, k: number): WaveDef[] => Array.from({ length: k }, () => turmWaveTier(g(), deck));
  /** Echo or boss as the last wave: a few adds of the deck's mix, at the tier of the wave before. */
  const bossWave = (deck: number, kind: BossKind, adds: number, echo = true): WaveDef => ({ ...turmWaveTier(TURM_TIER.from + ((Math.max(0, n - 1)) * (TURM_TIER.to - TURM_TIER.from)) / (TURM_WAVES - 1), deck, [kind]), count: adds, maxAlive: 4, elite: 0, ...(echo ? { echo: true } : {}) });
  const at = (d: DeckDef): Point => liftArrival(d);
  const fight = (d: DeckDef, zone: number, r: number, list: WaveDef[], heal: number, spot: Point): EncounterDef => ({ id: d.id, name: d.name, zone, x: d.x, z: d.z, r, waves: list, heal, at: spot });

  const foyerFight = fight(foyer, 0, 15, waves(0, 2), 0.3, { x: 11, z: -8 });
  // The foyer fight centre lies 4 m north of the core centre (anchor table).
  foyerFight.z = foyer.z - 4;
  // Schacht: hold the crank first (the stream is wave 0, at the tier of the first wave without using it), then two waves, then the echo.
  const holdWave: WaveDef = turmWaveTier(TURM_TIER.from + (n * (TURM_TIER.to - TURM_TIER.from)) / (TURM_WAVES - 1), 1);
  const schachtWaves = waves(1, 2);
  const schachtFight: EncounterDef = {
    ...fight(schacht, 1, 14, [holdWave, ...schachtWaves, bossWave(1, TURM_BOSSES.schacht, 2)], 0.5, at(schacht)),
    hold: { r: 3.5, need: 35, every: 2, mouth: { x: schacht.x + 11, z: schacht.z + 6 }, at: { x: schacht.x, z: schacht.z - 10.5 } },
  };
  const panoramaFight = fight(panorama, 2, 16, [...waves(2, 3), bossWave(2, TURM_BOSSES.panorama, 2)], 0.5, at(panorama));
  const telecafeFight = fight(telecafe, 3, 16, [...waves(3, 3), bossWave(3, TURM_BOSSES.telecafe, 2)], 0.5, at(telecafe));
  const bossFight = fight(uhren, 4, 16, [bossWave(4, TURM_BOSSES.zeitwart, 2, false)], 1, at(uhren));
  const encounters = [foyerFight, schachtFight, panoramaFight, telecafeFight, bossFight];
  const zones: ZoneDef[] = TURM_DECKS.map((d, i) => ({ id: d.id, name: d.name, entry: i === 0 ? { ...TURM_START } : at(d) }));

  // A few crates to break per deck, against the wall and off the lift door.
  const crate = (d: DeckDef, r: number, a: number): Prop => ({ kind: 'crates', x: d.x + Math.sin(a) * r, z: d.z + Math.cos(a) * r, rot: a, size: 1 });
  const fixedProps: Prop[] = [
    crate(foyer, 19, 1.2), crate(foyer, 19, 4.4),
    crate(schacht, 13, 2.2),
    crate(panorama, 13.6, 2.3), crate(panorama, 13.6, 4.0),
    crate(uhren, 14, 2.0), crate(uhren, 14, 4.3),
  ];

  return {
    id: 'turm', name: 'Fernsehturm', bounds: { minX: -30, maxX: 510, minZ: -30, maxZ: 30 }, start: { ...TURM_START },
    rivers: [], lakes: [], islands: [], bridges: [], streets: [], areas: [], defaultGround: 'cobbles', landmarks: [],
    encounters, zones, rail: null, hills: [], terraces: [], fixedProps, seed: 1969,
    district: TURM_DISTRICT, strength: TURM_DISTRICT,
    decks: [...TURM_DECKS], turm: turmLayout(),
  };
}
