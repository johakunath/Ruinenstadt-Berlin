// Charlottenburg, the fifth district (M16, layout C2 "Spiegelschloss", Johannes 2026-11-19,
// `docs/mockups/m16-charlottenburg-c2.svg`, `docs/maps/charlottenburg.md`, `docs/tasks/m16-charlottenburg.md`).
// 1920: Golden Twenties, revue, cut glass and mirrors; time passes along the route from dusk to dawn.
// Anchors checked against OpenStreetMap on 2026-11-19 (origin the Gedächtniskirche at x 112, z 137),
// City West compressed about 0.2, church to Schloss about 0.06 east–west and 0.1 north–south.
// Route, one loop without doubling back: S+U Zoologischer Garten → Löwentor → through the Zoo (Konzertgarten)
// → Elefantentor → Nürnberger Straße → KaDeWe (walk-in) → Tauentzien → Gedächtniskirche (boss 1) → Ku'damm
// → Bleibtreustraße through a Stadtbahn arch → Savignyplatz → Kantstraße → Krumme Straße → Opernhaus (boss 2)
// → Schloßstraße north to the shut Ehrenhof gate → Spandauer Damm → Luisenplatz → garden gate → Irrgarten →
// Karpfenteich → Belvedere (boss 3) → the Orangerie ruin as mirror gallery → Ehrenhof (the district boss).
// Meters, +X east, +Z south. `scale` stretches distances only; the Schloss, the maze, the KaDeWe and the
// Zoo gates keep their size (parts are placed relative to one anchor, so they stay joined at every scale).
import { THREAT, type BossKind, type EnemyKind } from './enemies';
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { DEG } from '../sim/math';
import { ellipse, type Area, type Bridge, type Landmark, type MapDef, type Pt, type River, type Stair, type Street, type Terrace, type Viaduct, type Wall } from './map';
import type { Prop } from './courtyard';
import { lane } from './koepenick';

/** Normal waves in the district: 8 Zoo & Tauentzien, 9 Ku'damm, 10 Schlossgarten, 3 Spiegelschloss. */
export const CHARLOTTENBURG_WAVES = 30;
/** Provisional (C4): +8 per district after Mitte, not calibrated until the M14/B2 decision. */
export const CHARLOTTENBURG_TIER = { from: 32, to: 54 } as const;

/**
 * The district bosses (step 6, `docs/tasks/m12d-charlottenburg-enemies.md`): the master of ceremonies at the
 * Gedächtniskirche, the head of the Ringverein before the Opernhaus, the mirror pair at the Belvedere, Die
 * Diamantene Diva in the Ehrenhof.
 */
export const CHARLOTTENBURG_BOSSES: Record<'kirche' | 'oper' | 'belvedere' | 'diva', BossKind> = { kirche: 'conferencier', oper: 'ringvater', belvedere: 'spiegelpaar', diva: 'diva' };

/**
 * Difficulty of wave `g` (32 … 54) in `zone` (spec m12d, walker weight 6 as elsewhere; the walkers are the Zeitlose
 * in 1920s dress). Zone 0 introduces the dancers, zone 1 brings the full trio, zone 3 is glass only besides the
 * walkers. The Karpfenteich is `calm`: smaller waves, no elites. `extra` adds weights (the KaDeWe's mannequins).
 */
export function charlottenburgWaveTier(g: number, bosses: BossKind[] = [], zone = 0, calm = false, extra: Partial<Record<EnemyKind, number>> = {}): WaveDef {
  const MIX: Array<Partial<Record<EnemyKind, number>>> = [
    { walker: 6, runner: 1.2 + g * 0.1, scherbe: 1.6 + g * 0.06, spitter: 0.8 + g * 0.05, brute: 0.4 + g * 0.05, crow: 0.6 },
    { walker: 6, scherbe: 2.2 + g * 0.06, souffleur: 0.7, loge: 0.5 + g * 0.04, spitter: 1, runner: 1, rat: 0.5 },
    { walker: 6, scherbe: 1.6, souffleur: 0.9, loge: 0.5, crow: 0.8, brute: 0.4 },
    { walker: 6, scherbe: 2, souffleur: 1.1, loge: 0.9 },
  ];
  const base = calm ? { walker: 6, crow: 1, runner: 1, scherbe: 1 } : MIX[zone] ?? MIX[0]!;
  const mix: Partial<Record<EnemyKind, number>> = { ...base };
  for (const [k, v] of Object.entries(extra) as Array<[EnemyKind, number]>) mix[k] = (mix[k] ?? 0) + v;
  return {
    count: Math.round((5 + g * 0.45) * (calm ? 0.7 : 1)),
    maxAlive: Math.min(12, 6 + Math.floor(g / 3)) - (calm ? 3 : 0),
    mix,
    hpMul: 1 + g * 0.13,
    dmgMul: 1 + g * 0.06,
    bosses,
    elite: calm ? 0 : THREAT.eliteChance(g),
  };
}

const NORMAL_HEAL = 0.3;

/** The Stadtbahn polyline (unscaled); the brick viaduct is cut into runs with open arches where streets pass. */
const STADTBAHN: Array<[number, number]> = [[-135, 160], [-60, 155], [-10, 153], [10, 150], [38, 132], [60, 96], [84, 72], [125, 48], [185, 26]];
/** Arches the hero walks through: the street and the opening width. */
const ARCHES: Array<{ name: string; w: number }> = [
  { name: 'Bleibtreustraße', w: 12 },
  { name: 'Kantstraße', w: 18 },
  { name: 'Hardenbergstraße', w: 16 },
];

/**
 * E8: the platform of Bahnhof Zoo on the viaduct (unscaled): deck length from the Hardenbergstraße arch
 * north-east, deck width (the viaduct), the stair (from the deck's south-east edge, `stairAt` meters along
 * the deck), the train's width and cars, the start `start` meters along the deck.
 */
export const PLATFORM = { len: 21, width: 10, h: 6.5, stairAt: 9.5, stair: { len: 13, width: 8 }, train: 3.4, cars: 3, start: 16 } as const;

/**
 * The hedge maze (Irrgarten) in its own frame around the Rondell (unscaled offsets, the maze keeps its size):
 * outer box 66 × 32, the round clearing of radius 15 inside a ring hedge, the entrance in the south-east,
 * the exit north of the Rondell, corridors east and west with three dead ends.
 */
export const IRRGARTEN = { hx: 33, hz: 16, ring: 16, entrance: { x: 30.5, z: 16 }, exit: { x: 0, z: -16 } } as const;

/** Local hedge runs of the maze (x east, z south, around the Rondell centre). */
function mazeHedges(): Array<Array<[number, number]>> {
  const { hx, hz, ring } = IRRGARTEN;
  const arc = (a0: number, a1: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [], n = Math.max(2, Math.ceil((a1 - a0) / 8));
    for (let i = 0; i <= n; i++) { const a = (a0 + ((a1 - a0) * i) / n) * DEG; out.push([Math.sin(a) * ring, Math.cos(a) * ring]); }
    return out;
  };
  return [
    // Outer hedges: the entrance between the east wing's inner hedge and the east side, the exit north of the Rondell.
    [[-hx, hz], [28, hz]], [[hx, hz], [hx, -hz], [4, -hz]], [[-4, -hz], [-hx, -hz], [-hx, hz]],
    // The ring round the Rondell: openings east (a 80 … 100), north (165 … 195, the exit) and west (260 … 280).
    arc(0, 80), arc(100, 165), arc(195, 260), arc(280, 360),
    // East wing: a serpentine from the entrance to the ring's east opening.
    [[22, 10], [22, -hz]], [[28, hz], [28, -10]],
    // West wing: two corridors off the ring's west opening, both ending blind.
    [[-22, hz], [-22, -10]], [[-28, -hz], [-28, 10]],
  ];
}

export function charlottenburgMap(scale = 1): MapDef {
  const s = scale;
  const P = (x: number, z: number): Pt => [x * s, z * s];
  const line = (pts: Array<[number, number]>): Pt[] => pts.map(([x, z]) => P(x, z));
  const rw = (w: number): number => w * Math.sqrt(s);
  const bounds = { minX: -135 * s, maxX: 185 * s, minZ: -195 * s, maxZ: 215 * s };

  // The Schloss is one compound placed from the central block C: wings, Ehrenhof gate, Neuer Flügel and
  // Orangerie O keep their offsets, so the court stays 44 × 39 and the facade closed at every scale.
  const C = { x: -75 * s, z: -66 * s };
  const O = { x: C.x - 43.5, z: C.z + 4 };
  const gateZ = C.z + 47;
  // The maze around the Rondell M; the garden gate east of the Neuer Flügel.
  const M = { x: -75 * s, z: -98 * s };
  const gx = -3.5 * s, gz = C.z + 4;
  const KDW = { x: 148 * s, z: 197 * s };

  let g = 0;
  const tier = (n: number): number => CHARLOTTENBURG_TIER.from + (n * (CHARLOTTENBURG_TIER.to - CHARLOTTENBURG_TIER.from)) / (CHARLOTTENBURG_WAVES - 1);
  /** An encounter at world (x, z) (already scaled). */
  const encW = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number, calm = false, extra: Partial<Record<EnemyKind, number>> = {}): EncounterDef => {
    const list: WaveDef[] = [];
    for (let i = 0; i < waves; i++) list.push(charlottenburgWaveTier(tier(g++), [], zone, calm, extra));
    return { id, name, zone, x, z, r, waves: list, heal: NORMAL_HEAL };
  };
  const enc = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number, calm = false): EncounterDef => encW(id, name, zone, x * s, z * s, r, waves, calm);
  const bossW = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => (
    { id, name, zone, x, z, r, waves: [{ ...charlottenburgWaveTier(tier(Math.max(0, g - 1)), [kind], zone), count: adds, maxAlive: 4, elite: 0 }], heal: 1 }
  );
  const boss = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => bossW(id, name, zone, x * s, z * s, r, kind, adds);
  const B = CHARLOTTENBURG_BOSSES;

  const encounters: EncounterDef[] = [
    // Zone 0, Zoo & Tauentzien (8 waves, Blaue Stunde): the concert garden, out at the Elefantentor, the KaDeWe Lichthof.
    enc('konzertgarten', 'Konzertgarten', 0, 124, 86, 14, 2),
    enc('elefantentor', 'Elefantentor', 0, 166, 129, 13, 3),
    // The KaDeWe's mannequins come alive: one more Scherbentänzerin weight (spec m12d).
    encW('kadewe', 'KaDeWe', 0, KDW.x, KDW.z, 13, 3, false, { scherbe: 1 }),
    boss('kirche', 'Gedächtniskirche', 0, 106, 156, 15, B.kirche, 3),
    // Zone 1, Ku'damm & Savignyplatz (9 waves, Premierennacht).
    enc('westens', 'Café des Westens', 1, 62, 167, 13, 3),
    enc('revuepalast', 'Revuepalast', 1, 26, 174, 13, 3),
    enc('savigny', 'Savignyplatz', 1, -10, 132, 13, 3),
    boss('oper', 'Deutsches Opernhaus', 1, -45, 68, 15, B.oper, 4),
    // Zone 2, Schlossgarten (10 waves, Mondnacht): the Schloßstraße to the shut gate, round through the garden.
    enc('schlossstrasse', 'Schloßstraße', 2, -76, 25, 13, 2),
    enc('luisenplatz', 'Luisenplatz', 2, -2, -24, 14, 3),
    encW('irrgarten', 'Irrgarten', 2, M.x, M.z, 14, 3),
    enc('karpfenteich', 'Karpfenteich', 2, -30, -136, 12, 2, true),
    boss('belvedere', 'Belvedere', 2, -48, -165, 14, B.belvedere, 3),
    // Zone 3, Spiegelschloss (3 waves, Morgengrauen): half in the Orangerie ruin, half on its forecourt; the Diva in the Ehrenhof.
    encW('spiegelgalerie', 'Spiegelgalerie', 3, O.x + 2.5, O.z + 12, 13, 3),
    bossW('ehrenhof', 'Ehrenhof', 3, C.x, C.z + 26, 16, B.diva, 6),
  ];

  const zones: ZoneDef[] = [
    // Start on the platform of Bahnhof Zoo (E8; the network's stop S+U Zoologischer Garten), set below.
    { id: 'zoo', name: 'Zoo', entry: { x: 0, z: 0 } },
    { id: 'kudamm', name: 'Kurfürstendamm', entry: { x: 84 * s, z: 163 * s } },
    { id: 'schlossgarten', name: 'Schlossgarten', entry: { x: -77 * s, z: 55 * s } },
    { id: 'spiegelschloss', name: 'Spiegelschloss', entry: { x: O.x + 0.5, z: C.z - 14 } },
  ];

  // The Spree comes in at the east edge, bends north at the Schloßbrücke, runs up the east side of the garden,
  // round its tip and out west along the north edge. The bank beyond it is backdrop (no bridge reaches it).
  const SPREE: Array<[number, number]> = [[190, -24], [130, -30], [80, -38], [46, -50], [26, -62], [16, -74], [18, -100], [21, -130], [19, -158], [10, -180], [-10, -194], [-40, -199], [-140, -199]];
  const rivers: River[] = [{ name: 'Spree', width: rw(20), pts: line(SPREE) }];
  /** The Spree's centre x at depth z on its north-running stretch (for the garden fence to reach into the water). */
  const riverX = (z: number): number => {
    const pts = rivers[0]!.pts;
    for (let i = 4; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!;
      if ((z - az) * (z - bz) <= 0) return ax + ((bx - ax) * (z - az)) / (bz - az || 1);
    }
    return pts[4]![0];
  };
  const lakes: Pt[][] = [ellipse(-74 * s, -142 * s, 27 * s, 13 * s, 18)];
  // The Schloßbrücke north of the Neuer Pavillon, square to the river; a fence on its deck closes the backdrop bank.
  const bridges: Bridge[] = [{ name: 'Schloßbrücke', x: 16 * s, z: -75 * s, rot: 104 * DEG, len: rw(20) + 14, width: 10 }];

  const streets: Street[] = [
    // Zone 0: City West. Blockrand on the north side of east–west streets and both sides of north–south ones.
    { name: 'Hardenbergstraße', kind: 'main', width: 12, sidewalk: 2.5, block: true, pts: line([[40, 62], [66, 88], [76, 100], [80, 116], [92, 131]]) },
    { name: 'Joachimsthaler Straße', kind: 'side', width: 10, sidewalk: 2, block: true, pts: line([[76, 100], [68, 135], [63, 168]]) },
    { name: 'Budapester Straße', kind: 'main', width: 10, sidewalk: 2, block: true, pts: line([[86, 124], [126, 126], [150, 132], [185, 131]]) },
    { name: 'Nürnberger Straße', kind: 'side', width: 9, sidewalk: 2, block: true, pts: line([[157, 132], [157, 165]]) },
    { name: 'Tauentzienstraße', kind: 'main', width: 20, profile: 'allee', sidewalk: 3, block: true, pts: line([[108, 157], [150, 164], [185, 169]]) },
    // Zone 1: the Ku'damm runs west from the church to a barricade at the edge; the Stadtbahn north of it.
    { name: 'Kurfürstendamm', kind: 'main', width: 20, profile: 'allee', sidewalk: 3, block: true, pts: line([[108, 157], [62, 167.5], [26, 175], [-10, 181], [-60, 189], [-135, 197]]) },
    { name: 'Kantstraße', kind: 'main', width: 12, sidewalk: 2.5, block: true, pts: line([[92, 131], [42, 137], [-10, 130], [-45, 126], [-135, 120]]) },
    { name: 'Bleibtreustraße', kind: 'side', width: 8, sidewalk: 2, block: true, pts: line([[-10, 181], [-10, 153], [-10, 130]]) },
    { name: 'Krumme Straße', kind: 'side', width: 9, sidewalk: 2, block: true, pts: line([[-45, 126], [-45, 68]]) },
    // The Bismarckstraße from the Schloßstraße east past the Knie; east of it the Chaussee through the Charlottenburger Tor.
    { name: 'Bismarckstraße', kind: 'main', width: 20, profile: 'allee', sidewalk: 3, block: true, pts: line([[-78, 76], [-45, 68], [40, 62], [110, 34], [185, 8]]) },
    { name: 'Otto-Suhr-Allee', kind: 'side', width: 10, sidewalk: 2, block: true, pts: line([[40, 62], [22, 15], [-2, -24]]) },
    // Zone 2: the Schloßstraße north to the Ehrenhof gate; the Spandauer Damm along the Schloss front.
    { name: 'Schloßstraße', kind: 'main', width: 18, profile: 'allee', sidewalk: 3, block: true, pts: line([[-78, 76], [-76, 25], [-75, -10]]) },
    { name: 'Spandauer Damm', kind: 'main', width: 14, sidewalk: 2.5, block: true, pts: line([[-135, -10], [-75, -10], [-40, -12], [-12, -22], [-2, -24]]) },
    // Paths: through the Zoo, the garden walk behind the Schloss, to the pond and the Belvedere, back past the Mausoleum.
    { name: 'Zooweg', kind: 'path', width: 4, pts: line([[101, 92], [124, 86], [146, 94], [162, 104], [170, 116]]) },
    { name: 'Schlossgarten', kind: 'path', width: 5, pts: [[gx, gz + 1], [gx, C.z - 12], [O.x + 0.5, C.z - 12], [O.x + 0.5, C.z - 9]] },
    { name: 'Teichweg', kind: 'path', width: 4, pts: [[M.x, M.z - 17], [M.x, M.z - 24], P(-50, -124), P(-32, -128)] },
    { name: 'Belvedereweg', kind: 'path', width: 4, pts: line([[-30, -148], [-40, -158]]) },
    { name: 'Spreeweg', kind: 'path', width: 4, pts: [...line([[-44, -174], [-80, -176], [-112, -166], [-118, -154]]), [O.x + 0.5, M.z]] },
    // M16b side passages: the Antilopenhaus in the Zoo (sleeping elite), the yard behind the Capitol (cache),
    // a Hinterhof off the Bleibtreustraße (hidden blessing), the yard of the Gläsernes Varieté (sleeping elite).
    { name: 'Antilopenweg', kind: 'path', width: 4, pts: line([[135, 90], [143, 83], [149, 78]]) },
    { name: 'Capitol-Passage', kind: 'path', width: 3.5, pts: [P(142, 126), [142 * s, 115 * s - 2], [142 * s + 10, 115 * s - 2]] },
    { name: 'Hinterhof Bleibtreustraße', kind: 'path', width: 4, pts: line([[-14, 170], [-28, 170], [-36, 166]]) },
    { name: 'Varietéhof', kind: 'path', width: 4, pts: line([[-49.5, 100], [-62, 100], [-72, 103]]) },
    // A yard off the Ku'damm stub west of the Bleibtreustraße (cache), north through the row, west along the viaduct.
    { name: 'Hof am Kurfürstendamm', kind: 'path', width: 3.5, pts: line([[-48, 180], [-48, 165], [-66, 165]]) },
  ];

  // The Stadtbahn on its brick viaduct, cut at the arches the streets pass through (as on the Alexanderplatz).
  const rail = line(STADTBAHN);
  const acc = [0];
  for (let i = 1; i < rail.length; i++) acc.push(acc[i - 1]! + Math.hypot(rail[i]![0] - rail[i - 1]![0], rail[i]![1] - rail[i - 1]![1]));
  const railAt = (d: number): Pt => {
    for (let i = 1; i < rail.length; i++) if (d <= acc[i]! || i === rail.length - 1) {
      const t = (d - acc[i - 1]!) / (acc[i]! - acc[i - 1]!), [ax, az] = rail[i - 1]!, [bx, bz] = rail[i]!;
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    }
    return rail[rail.length - 1]!;
  };
  const cut = (a: number, b: number): Pt[] => [railAt(a), ...rail.filter((_, i) => acc[i]! > a && acc[i]! < b), railAt(b)];
  const project = (x: number, z: number): { at: number; d: number } => {
    let best = Infinity, at = 0;
    for (let i = 1; i < rail.length; i++) {
      const [ax, az] = rail[i - 1]!, [bx, bz] = rail[i]!, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; at = acc[i - 1]! + Math.sqrt(l2) * t; }
    }
    return { at, d: best };
  };
  /** Distance along the rail where a street crosses it (the street point nearest to the rail). */
  const crossing = (name: string): number => {
    const st = streets.find((q) => q.name === name)!;
    let best = Infinity, at = 0;
    for (let i = 1; i < st.pts.length; i++) {
      const [ax, az] = st.pts[i - 1]!, [bx, bz] = st.pts[i]!;
      for (let t = 0; t <= 1; t += 0.01) { const p = project(ax + (bx - ax) * t, az + (bz - az) * t); if (p.d < best) { best = p.d; at = p.at; } }
    }
    return at;
  };
  const arches = ARCHES.map((a) => ({ ...a, at: crossing(a.name) })).sort((p, q) => p.at - q.at);
  // E8 (Johannes 2026-11-19): the run starts on the platform level of Bahnhof Zoo. The platform deck is the
  // viaduct itself from the Hardenbergstraße arch north-east (the deck's edge walls block like the brick
  // runs), the arrived train on its north-west track, one wide stair down to the Hardenbergplatz.
  const hb = arches.find((a) => a.name === 'Hardenbergstraße')!;
  const deck0 = hb.at + hb.w / 2, deck1 = deck0 + PLATFORM.len;
  const viaducts: Viaduct[] = [];
  let from = 0;
  for (const a of arches) {
    viaducts.push({ name: 'Stadtbahn', kind: 'stadtbahn', width: 10, h: 6.5, pts: cut(from, a.at - a.w / 2) });
    // The next run starts past the deck (half a meter under its end, so the seal has no seam).
    from = a === hb ? deck1 - 0.5 : a.at + a.w / 2;
  }
  viaducts.push({ name: 'Stadtbahn', kind: 'stadtbahn', width: 10, h: 6.5, pts: cut(from, acc[acc.length - 1]!) });
  /** Rail direction and the camera-side (south-east) normal at distance `d`. */
  const dirAt = (d: number): { ux: number; uz: number; nx: number; nz: number } => {
    const [ax, az] = railAt(d - 0.5), [bx, bz] = railAt(d + 0.5), l = Math.hypot(bx - ax, bz - az);
    return { ux: (bx - ax) / l, uz: (bz - az) / l, nx: -(bz - az) / l, nz: (bx - ax) / l };
  };
  /** World point `d` along the rail, `off` meters to its south-east side. */
  const railOff = (d: number, off: number): Pt => { const [x, z] = railAt(d), q = dirAt(d); return [x + q.nx * off, z + q.nz * off]; };
  const deckPts = cut(deck0, deck1), deckD = [deck0, ...deckPts.slice(1, -1).map((p) => project(p[0], p[1]).at), deck1];
  const half = PLATFORM.width / 2;
  const platformPoly: Pt[] = [...deckD.map((d) => railOff(d, -half)), ...[...deckD].reverse().map((d) => railOff(d, half))];
  const stairAt = deck0 + PLATFORM.stairAt, sd = dirAt(stairAt), [sx, sz] = railOff(stairAt, half - 0.5 + PLATFORM.stair.len / 2);
  const platformStair: Stair = { x: sx, z: sz, rot: Math.atan2(-sd.nx, -sd.nz), width: PLATFORM.stair.width, len: PLATFORM.stair.len };
  // The train: cars on the north-west track, flush with the deck edge, so nothing squeezes behind them.
  const cars: NonNullable<Terrace['solid']> = [];
  const carLen = (PLATFORM.len - 1) / PLATFORM.cars;
  for (let i = 0; i < PLATFORM.cars; i++) {
    const d = deck0 + 0.5 + carLen * (i + 0.5), q = dirAt(d), [x, z] = railOff(d, -half + PLATFORM.train / 2);
    cars.push({ x, z, hx: PLATFORM.train / 2, hz: carLen / 2 + 0.3, rot: Math.atan2(q.ux, q.uz) });
  }
  const terraces: Terrace[] = [{ name: 'Bahnsteig Zoologischer Garten', h: PLATFORM.h, bridge: true, platform: true, stairs: [platformStair], poly: platformPoly, solid: cars }];
  // No spawns on the deck and its stair (the stair's box plus a meter at each end and half a meter aside).
  const su: Pt = [Math.sin(platformStair.rot), Math.cos(platformStair.rot)], sa: Pt = [Math.cos(platformStair.rot), -Math.sin(platformStair.rot)];
  const sl = platformStair.len / 2 + 1, sw = platformStair.width / 2 + 0.5;
  const stairPoly: Pt[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]): Pt => [sx + sa[0] * a! * sw + su[0] * b! * sl, sz + sa[1] * a! * sw + su[1] * b! * sl]);
  const [startX, startZ] = railOff(deck0 + PLATFORM.start, 1.8);
  const [stationX, stationZ] = railAt(deck0 + PLATFORM.len / 2), stationDir = dirAt(deck0 + PLATFORM.len / 2);
  zones[0]!.entry = { x: startX, z: startZ };

  // The Technische Hochschule quarter north-east of the Knie is fenced-off backdrop (Johannes 2026-11-19): an
  // iron fence round the Hochschule grounds on the west (beside the Otto-Suhr-Allee, from the Spree) and the
  // south (behind the Chaussee's north sidewalk), a barricade across the Chaussee east of the Charlottenburger
  // Tor. Frame of the Chaussee: `u` meters east along it from the Knie, `v` meters to its north side.
  const bis = streets.find((q) => q.name === 'Bismarckstraße')!, K = bis.pts[2]!, K1 = bis.pts[3]!;
  const bl = Math.hypot(K1[0] - K[0], K1[1] - K[1]), du: Pt = [(K1[0] - K[0]) / bl, (K1[1] - K[1]) / bl], dv: Pt = [du[1], -du[0]];
  const kv = (u: number, v: number): Pt => [K[0] + du[0] * u + dv[0] * v, K[1] + du[1] * u + dv[1] * v];
  /** The fence line just behind the Chaussee's north sidewalk; the west fence keeps 1.5 m off the Allee's sidewalk. */
  const fenceV = bis.width / 2 + (bis.sidewalk ?? 0) + 0.6, westU = 8.5;
  const torU = (100 * s - K[0]) * du[0] + (38 * s - K[1]) * du[1], barU = torU + 2.5;
  const hsV = 22, hsHz = 6;
  // West fence from the Spree, round the Rathaus's east side, down beside the Otto-Suhr-Allee to the Chaussee.
  const hsWest: Pt[] = [P(52, -48), [32 * s + 10, 8 * s + 10], kv(westU, hsV + hsHz + 1.5), kv(westU, fenceV)];
  const [e0, e1] = [bis.pts[3]!, bis.pts[4]!], el = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
  /** Where the fence line of the Chaussee's east stretch meets the east bound. */
  const eastZ = e1[1] - ((e1[0] - e0[0]) / el) * fenceV;
  /** The sealed quarter (area `hochschulviertel`): the Spree, the east bound, the Chaussee's north side, the west fence. */
  const sealed: Pt[] = [...line([[52, -48], [80, -38], [130, -30], [185, -24]]), [bounds.maxX, eastZ], kv(bl, fenceV), ...hsWest.slice(1).reverse()];

  const L = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear = 3, extra: Partial<Landmark> = {}): Landmark => ({ kind, x: x * s, z: z * s, rot, hx, hz, clear, ...extra });
  /** A landmark at world (x, z) (parts of the Schloss compound). */
  const LW = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear: number, extra: Partial<Landmark> = {}): Landmark => ({ kind, x, z, rot, hx, hz, clear, ...extra });
  const loewentor = L('loewentor', 100, 92, -90 * DEG, 5, 1.5, 1, { name: 'Löwentor' });
  const elefantentor = L('elefantentor', 170, 118, 0, 5.5, 1.5, 1, { name: 'Elefantentor' });
  const capitol = L('capitol', 142, 115, 0, 14, 5, 0.5, { name: 'Capitol am Zoo' });
  const aquarium = L('aquarium', 181, 112, 0, 3.5, 4, 1, { name: 'Aquarium' });
  const tor = LW('gartentor', gx, gz, 0, 4, 0.7, 0, { name: 'Gartentor' });
  const landmarks: Landmark[] = [
    // Zone 0. Bahnhof Zoo (1882) sits on the viaduct: lots keep off, the viaduct itself blocks.
    LW('zoobahnhof', stationX, stationZ, Math.atan2(stationDir.ux, stationDir.uz), 6.5, 12.5, 0, { walkUnder: true, name: 'Bahnhof Zoo' }),
    loewentor, elefantentor, aquarium, capitol,
    L('musikpavillon', 124, 66, 0, 4, 4, 1, { name: 'Musikpavillon' }),
    L('antilopenhaus', 152, 67, 0, 7, 4.5, 1, { name: 'Antilopenhaus' }),
    L('ufapalast', 100, 112, 0, 5, 4, 1.5, { name: 'Ufa-Palast am Zoo' }),
    L('gedaechtniskirche', 112, 137, 0, 13, 5, 2, { name: 'Kaiser-Wilhelm-Gedächtniskirche' }),
    L('romanischescafe', 132, 141, 0, 5, 4.5, 1, { name: 'Romanisches Café' }),
    // The KaDeWe stands south of the Tauentzien (between the camera and the street): a roofless Lichthof, doors to the street.
    LW('kadewe', KDW.x, KDW.z, 0, 23, 16, 1, { name: 'KaDeWe' }),
    L('wittenbergplatz', 177, 198, 0, 4, 8, 1, { name: 'U Wittenbergplatz' }),
    // Zone 1. Cinemas, cafés and theatres along the Ku'damm and the Kantstraße; the opera on the Bismarckstraße.
    L('gloriapalast', 90, 148, 0, 4, 3, 1, { name: 'Gloria-Palast' }),
    L('marmorhaus', 86, 180, 180 * DEG, 7, 4, 1, { name: 'Marmorhaus' }),
    L('cafewestens', 54, 150, 0, 6, 4, 1, { name: 'Café des Westens' }),
    L('revuepalast', 24, 158, 0, 8, 4.5, 1, { name: 'Revuepalast' }),
    L('theaterwestens', 58, 121, 0, 6, 4, 1, { name: 'Theater des Westens' }),
    L('variete', -62, 112, 0, 7, 4, 1, { name: 'Gläsernes Varieté' }),
    L('opernhaus', -45, 45, 0, 14, 8, 2, { name: 'Deutsches Opernhaus' }),
    L('schillertheater', 5, 46, 0, 8, 5, 1, { name: 'Schiller-Theater' }),
    // The Technische Hochschule fronts the Chaussee (turned with it), inside its fenced grounds.
    LW('hochschule', ...kv(25 * s, hsV), Math.atan2(-dv[0], -dv[1]), 14, hsHz, 1, { name: 'Technische Hochschule' }),
    // The Chaussee passes through the Tor (only its two colonnades block); the Rathaus tower on the Otto-Suhr-Allee.
    L('chtor', 100, 38, Math.atan2(70, -28), 16, 3, 1, { name: 'Charlottenburger Tor' }),
    L('chrathaus', 32, 8, -90 * DEG, 8, 6, 1, { name: 'Rathaus Charlottenburg' }),
    // Zone 2 and 3. The Stülerbauten flank the north end of the Schloßstraße, fronts to the street.
    L('stuelerbau', -92, 5, 90 * DEG, 5, 4, 1, { name: 'Stülerbau', variant: 0 }),
    L('stuelerbau', -58, 5, -90 * DEG, 5, 4, 1, { name: 'Stülerbau', variant: 1 }),
    // The Schloss compound: the central block with the dome, the wings round the Ehrenhof (the west wing open
    // to the Orangerie forecourt), the shut gate (a full collider; it may swing open after the Diva), the
    // Neuer Flügel joined to the east, the Orangerie ruin to the west.
    LW('schlossmitte', C.x, C.z, 0, 29, 8, 1, { name: 'Schloss Charlottenburg' }),
    LW('schlossfluegel', C.x - 25.5, C.z + 15, 0, 3.5, 7, 0, { variant: 0 }),
    LW('schlossfluegel', C.x - 25.5, C.z + 41.5, 0, 3.5, 5.5, 0, { variant: 1 }),
    LW('schlossfluegel', C.x + 25.5, C.z + 27.5, 0, 3.5, 19.5, 0, { variant: 2 }),
    LW('ehrenhoftor', C.x, gateZ, 0, 22.5, 0.6, 8, { name: 'Ehrenhof' }),
    LW('neuerfluegel', C.x + 47, C.z, 0, 19, 7, 1, { name: 'Neuer Flügel' }),
    LW('orangerie', O.x, O.z, 0, 14.5, 12, 0, { name: 'Orangerie' }),
    tor,
    L('mausoleum', -126, -140, 90 * DEG, 6, 5, 1, { name: 'Mausoleum' }),
    L('belvedere', -58, -183, 0, 6, 4.5, 1, { name: 'Belvedere' }),
    // Rest stops, one per zone beside the route (front to the way). The tea house is the Neuer Pavillon; zone 4's
    // Späti stands inside the Orangerie forecourt (the forecourt is fenced off from the Spandauer Damm).
    { ...L('spati', 90, 100, 0, 5.5, 4, 2), name: 'Kiosk am Zoo' },
    { ...L('spati', 0, 161, 0, 5.5, 4, 1), name: 'Späti im Stadtbahnbogen' },
    { ...L('spati', 2, -50, -90 * DEG, 4, 5.5, 2), name: 'Teehaus im Neuen Pavillon' },
    { ...LW('spati', O.x - 5.5, O.z + 34, 180 * DEG, 5.5, 4, 2), name: 'Späti an der Orangerie' },
  ];

  /** World point of a landmark's local (x along its front, z out of it). */
  const at = (l: Landmark, lx: number, lz: number): Pt => [l.x + Math.cos(l.rot) * lx + Math.sin(l.rot) * lz, l.z - Math.sin(l.rot) * lx + Math.cos(l.rot) * lz];
  const walls: Wall[] = [
    // The Zoo is fenced and entered only through its two gates; the viaduct closes it to the north.
    { name: 'Zoozaun West', kind: 'fence', pts: [P(92, 68), at(loewentor, -3.6, 0)] },
    { name: 'Zoozaun Süd', kind: 'fence', pts: [at(loewentor, 3.6, 0), P(104, 99), P(120, 107.5), at(capitol, -13.5, -5.2), at(capitol, 13.5, -5.2), at(elefantentor, -4, 0)] },
    { name: 'Zoozaun Ost', kind: 'fence', pts: [at(elefantentor, 4, 0), at(aquarium, -3.4, 3)] },
    // The Orangerie forecourt is fenced off from the Spandauer Damm (else the Ehrenhof could be entered round
    // the shut gate) and from the garden west of the ruin (only the ruin's door leads in).
    { name: 'Orangeriegitter', kind: 'fence', pts: [[bounds.minX - 1, gateZ - 0.5], [C.x - 26, gateZ - 0.5]] },
    { name: 'Orangeriegitter Nord', kind: 'fence', pts: [[bounds.minX - 1, O.z - 11.5], [O.x - 14, O.z - 11.5]] },
    // The garden fence from the Neuer Flügel to the gate pillars and on into the Spree.
    { name: 'Gartenzaun', kind: 'fence', pts: [[C.x + 65, gz], [gx - 3.2, gz]] },
    { name: 'Gartenzaun Spree', kind: 'fence', pts: [[gx + 3.2, gz], [riverX(gz), gz]] },
    // The Hochschule grounds: west from the Spree, south behind the Chaussee's sidewalk into the Tor's north colonnade.
    { name: 'Hochschulzaun', kind: 'fence', pts: [...hsWest, kv(torU - 1, fenceV)] },
    // South of the Chaussee barricade a fence closes the strip to the Stadtbahn viaduct (it ends on the rail line).
    { name: 'Chausseesperre', kind: 'fence', pts: [kv(barU + 2, -16.5), railAt(project(...kv(barU + 2, -16.5)).at)] },
    // The Irrgarten (E3): 2.2 m hedges.
    ...mazeHedges().map((h, i): Wall => ({ name: `Irrgarten ${i + 1}`, kind: 'hedge', pts: h.map(([x, z]): Pt => [M.x + x, M.z + z]) })),
  ];

  const areas: Area[] = [
    // Small places first: the first area that contains a point wins.
    { id: 'hardenbergplatz', name: 'Hardenbergplatz', ground: 'cobbles', frontage: null, trees: 0, poly: line([[62, 86], [99, 86], [99, 99], [90, 107], [78, 108], [66, 104], [62, 96]]) },
    { id: 'knie', name: 'Knie', ground: 'cobbles', frontage: null, trees: 0, poly: ellipse(40 * s, 62 * s, 13 * s, 13 * s, 10) },
    { id: 'kirchplatz', name: 'Auguste-Viktoria-Platz', ground: 'cobbles', frontage: null, trees: 0, poly: line([[90, 130], [140, 133], [140, 152], [124, 159], [96, 159], [90, 150]]) },
    { id: 'elefantenplatz', name: 'Vor dem Elefantentor', ground: 'cobbles', frontage: null, trees: 0, poly: line([[156, 110], [185, 113], [185, 142], [150, 142], [150, 126]]) },
    { id: 'wittenbergplatz', name: 'Wittenbergplatz', ground: 'cobbles', frontage: null, trees: 0.2, poly: line([[171, 174], [185, 174], [185, 215], [171, 215]]) },
    { id: 'kadewe', name: 'KaDeWe', ground: 'cobbles', frontage: null, trees: 0, poly: [[KDW.x - 23, KDW.z - 16], [KDW.x + 23, KDW.z - 16], [KDW.x + 23, KDW.z + 16], [KDW.x - 23, KDW.z + 16]] },
    { id: 'savignyplatz', name: 'Savignyplatz', ground: 'grass', frontage: null, trees: 0.3, poly: line([[-26, 118], [6, 118], [6, 146], [-26, 146]]) },
    { id: 'luisenplatz', name: 'Luisenplatz', ground: 'grass', frontage: null, trees: 0.2, poly: line([[-20, -40], [14, -40], [14, -8], [-20, -8]]) },
    { id: 'klausenerplatz', name: 'Klausenerplatz', ground: 'cobbles', frontage: null, trees: 0.4, poly: line([[-135, -3], [-104, -3], [-104, 24], [-135, 24]]) },
    // The Schloss compound: Ehrenhof, wings, Orangerie and its forecourt.
    { id: 'schloss', name: 'Schloss', ground: 'cobbles', frontage: null, trees: 0, poly: [[bounds.minX, C.z - 8], [C.x + 29, C.z - 8], [C.x + 29, gateZ], [bounds.minX, gateZ]] },
    { id: 'schlossvorplatz', name: 'Schlosspark', ground: 'grass', frontage: null, trees: 0.1, poly: [[C.x + 29, C.z - 8], [40 * s, C.z - 8], [40 * s, -40 * s], [-20 * s, -40 * s], [-20 * s, -19 * s], [C.x + 29, gateZ]] },
    { id: 'irrgarten', name: 'Irrgarten', ground: 'grass', frontage: null, trees: 0, poly: [[M.x - 34, M.z - 17], [M.x + 34, M.z - 17], [M.x + 34, M.z + 17], [M.x - 34, M.z + 17]] },
    { id: 'zoo', name: 'Zoologischer Garten', ground: 'grass', frontage: null, trees: 0.5, poly: [P(92, 68), P(125, 52), P(185, 30), P(185, 116), at(aquarium, -3.4, 3), at(elefantentor, 0, 0), at(capitol, 13.5, -5.2), at(capitol, -13.5, -5.2), P(120, 107.5), P(104, 99), at(loewentor, 0, 0)] },
    // Beyond the Spree: the backdrop bank (power station, chimneys), never reached.
    { id: 'ostufer', name: 'Spreeufer', ground: 'asphalt', frontage: null, trees: 0.2, poly: line([[18, -195], [185, -195], ...SPREE.slice(0, 11)]) },
    { id: 'schlossgarten', name: 'Schlossgarten', ground: 'grass', frontage: null, trees: 0.45, poly: [[bounds.minX, bounds.minZ], P(-6, -195), ...line(SPREE.slice(5, 11).reverse()), [16 * s, C.z - 8], [bounds.minX, C.z - 8]] },
    // The Technische Hochschule quarter (the real Tiergarten starts east of the Charlottenburger Tor): fenced backdrop.
    { id: 'hochschulviertel', name: 'Hochschulviertel', ground: 'forest', frontage: null, trees: 1, poly: sealed },
    // City: zone 0 east of the church, zone 1 along the Ku'damm and the Kantstraße (bounded by the Stadtbahn and a
    // line between the Kantstraße and the Bismarckstraße rows), the north (Bismarckstraße, Schloßstraße, Klausener
    // Kiez) last. Area borders keep off the building rows (a lot must stand in its street's area). Lot types are
    // stand-ins until step 7.
    { id: 'cityost', name: 'Tauentzien', ground: 'asphalt', frontage: 'altbau', trees: 0.25, specials: ['parkplatz', 'hinterhof'], poly: [P(100, 97), P(104, 99), P(120, 107.5), at(capitol, -13.5, -5.2), at(capitol, 13.5, -5.2), at(elefantentor, 0, 0), at(aquarium, -3.4, 3), P(185, 116), P(185, 215), P(100, 215)] },
    { id: 'kudamm', name: 'Neuer Westen', ground: 'asphalt', frontage: 'altbau', trees: 0.2, specials: ['hinterhof', 'markt'], poly: line([[-135, 96], [30, 98], [60, 96], [84, 72], [92, 68], [100, 88], [100, 215], [-135, 215]]) },
    // The north, traced round the Schloss, the Luisenplatz, the Hochschulviertel and the Zoo.
    { id: 'westend', name: 'Charlottenburg', ground: 'asphalt', frontage: 'altbau', trees: 0.25, specials: ['hinterhof', 'truemmer'],
      poly: [[bounds.minX, gateZ], [C.x + 29, gateZ], P(-20, -19), P(-20, -8), P(14, -8), P(14, -40), P(40, -40), ...hsWest, kv(bl, fenceV), [bounds.maxX, eastZ], P(185, 30), P(125, 52), P(92, 68), P(84, 72), P(60, 96), P(30, 98), P(-135, 96)] },
  ];

  const endOf = (name: string, back: number, side: number): { x: number; z: number } => {
    const pts = streets.find((st) => st.name === name)!.pts, [ex, ez] = pts[pts.length - 1]!, [px, pz] = pts[pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
    const ux = (ex - px) / l, uz = (ez - pz) / l;
    return { x: ex - ux * back + uz * side, z: ez - uz * back - ux * side };
  };
  const lights: Prop[] = [];
  const inFight = (x: number, z: number, pad: number): boolean => encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + pad);
  // Down the middle promenade of the wide boulevards, where curb lamps do not reach: people camping there.
  const middle = (name: string, step: number, first: number, off: number, kinds: Array<Prop['kind']>): void => {
    const pts = streets.find((q) => q.name === name)!.pts;
    let d = first, i = 0;
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1]!, [bx, bz] = pts[k]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (; d < len; d += step, i++) {
        const o = (i % 2 ? 1 : -1) * off;
        let x = ax + ux * d - uz * o, z = az + uz * d + ux * o;
        // A light inside a fight circle moves out to its rim (the fight stays open, its edge stays lit).
        const e = encounters.find((q) => Math.hypot(x - q.x, z - q.z) < q.r + 1);
        if (e) {
          const r = Math.hypot(x - e.x, z - e.z) || 1;
          x = e.x + ((x - e.x) / r) * (e.r + 1.5);
          z = e.z + ((z - e.z) / r) * (e.r + 1.5);
          if (lights.some((l) => Math.hypot(l.x - x, l.z - z) < 6) || inFight(x, z, 1)) continue;
        }
        if (zones.some((q) => Math.hypot(x - q.entry.x, z - q.entry.z) < 4)) continue;
        lights.push({ kind: kinds[i % kinds.length]!, x, z, rot: i * 1.7, size: 0.7 + ((i * 37) % 7) / 10 });
      }
      d -= len;
    }
  };
  for (const name of ['Kurfürstendamm', 'Tauentzienstraße', 'Bismarckstraße', 'Schloßstraße', 'Spandauer Damm']) middle(name, 12 * Math.sqrt(s), 6, 2.5, ['fireBarrel', 'stormLantern', 'fireBarrel', 'beacon']);
  // Two storm lanterns either side of the centre of every fight (rim barrels alone leave the middle of a wide street dark).
  encounters.forEach((e, i) => { for (const k of [-4, 4]) lights.push({ kind: 'stormLantern', x: e.x + Math.sin(i * 2.3) * k, z: e.z + Math.cos(i * 2.3) * k, rot: 0, size: k > 0 ? 1.1 : 0.8 }); });
  // Fires on the Knie, where the Hardenbergstraße leaves the roundabout for the Stadtbahn arch.
  lights.push({ kind: 'fireBarrel', x: 47 * s, z: 70 * s, rot: 0, size: 1.2 }, { kind: 'fireBarrel', x: 54 * s, z: 77 * s, rot: 0.5, size: 0.9 });
  // Fires in the arches (people living under the Stadtbahn).
  for (const a of arches) {
    const [x, z] = railAt(a.at);
    lights.push({ kind: 'fireBarrel', x: x + 3, z: z - 3, rot: 0, size: 1 });
  }
  // Lanterns and candles along the park paths (Zoo, garden, maze), alternating sides, off the fights.
  const verge = (pts: readonly Pt[], step: number, first: number, off: number, kinds: Array<Prop['kind']>): void => {
    let d = first, i = 0;
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1]!, [bx, bz] = pts[k]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (; d < len; d += step, i++) {
        const o = (i % 2 ? 1 : -1) * off, x = ax + ux * d - uz * o, z = az + uz * d + ux * o;
        if (inFight(x, z, 1)) continue;
        lights.push({ kind: kinds[i % kinds.length]!, x, z, rot: i * 1.7, size: 0.7 + ((i * 37) % 7) / 10 });
      }
      d -= len;
    }
  };
  for (const name of ['Zooweg', 'Schlossgarten', 'Teichweg', 'Spreeweg']) verge(streets.find((q) => q.name === name)!.pts, 13, 5, 3.4, ['stormLantern', 'candles', 'stormLantern', 'fireBarrel']);
  // In the maze: storm lanterns in the corridors and candles at the dead ends (lit mirror panels come with step 2).
  for (const [x, z, kind] of [[30.5, 8, 'stormLantern'], [30.5, -8, 'candles'], [25, -12, 'stormLantern'], [25, 6, 'candles'], [19, -6, 'stormLantern'], [18, -13, 'candles'],
    [-19, 8, 'candles'], [-19, -12, 'stormLantern'], [-25, -2, 'stormLantern'], [-30.5, 6, 'candles'], [-30.5, -12, 'stormLantern']] as Array<[number, number, Prop['kind']]>) lights.push({ kind, x: M.x + x, z: M.z + z, rot: 0, size: 0.9 });

  // Side passage dressing: the cache crates at the end of the Capitol yard, fences along the Hinterhof and the
  // Varieté yard, a fence across the Schloßbrücke (the bank beyond is backdrop).
  const br = bridges[0]!;
  const yards: Prop[] = [
    { kind: 'crates', ...endOf('Capitol-Passage', 1.5, 0), rot: 0.4, size: 1.2 }, { kind: 'crate', ...endOf('Capitol-Passage', 3.5, 1.2), rot: 1, size: 1 },
    { kind: 'workLamp', ...endOf('Capitol-Passage', 5, -1.2), rot: -0.8, size: 1 },
    { kind: 'stormLantern', ...endOf('Hinterhof Bleibtreustraße', 3.5, 1.2), rot: 0, size: 1 }, { kind: 'fireBarrel', ...endOf('Varietéhof', 5, -1.3), rot: 0, size: 1 },
    { kind: 'stormLantern', ...endOf('Antilopenweg', 4, 1.3), rot: 0, size: 1 },
    ...lane(streets.find((st) => st.name === 'Hinterhof Bleibtreustraße')!, 'fence'),
    ...lane(streets.find((st) => st.name === 'Varietéhof')!, 'fence'),
    { kind: 'bauzaun', x: br.x + Math.sin(br.rot) * 8, z: br.z + Math.cos(br.rot) * 8, rot: br.rot, size: br.width + 1.5 },
    // The yard off the Ku'damm stub: crates and a work lamp at the end of a fenced lane.
    { kind: 'crates', ...endOf('Hof am Kurfürstendamm', 1.5, 0), rot: -0.3, size: 1.1 }, { kind: 'crate', ...endOf('Hof am Kurfürstendamm', 3.5, -1.1), rot: 0.7, size: 1 },
    { kind: 'workLamp', ...endOf('Hof am Kurfürstendamm', 4.5, 1.1), rot: 0.6, size: 1 },
    ...lane(streets.find((st) => st.name === 'Hof am Kurfürstendamm')!, 'fence'),
    // The Chaussee closed east of the Charlottenburger Tor (a street-end barricade, its face toward the Knie,
    // wide enough to reach the Tor's colonnades and the viaduct), a work lamp in front.
    { kind: 'barricade', x: kv(barU, 0)[0], z: kv(barU, 0)[1], rot: Math.atan2(-du[0], -du[1]), size: 36 },
    { kind: 'workLamp', x: kv(barU - 1.2, 6)[0], z: kv(barU - 1.2, 6)[1], rot: Math.atan2(-du[0], -du[1]), size: 1 },
  ];

  return {
    id: 'charlottenburg',
    name: 'Charlottenburg',
    bounds,
    start: zones[0]!.entry,
    rivers,
    lakes,
    islands: [],
    bridges,
    streets,
    areas,
    defaultGround: 'asphalt',
    landmarks,
    encounters,
    zones,
    rail: null,
    hills: [],
    terraces,
    noSpawn: [platformPoly, stairPoly, sealed],
    district: 4,
    // Step 6: the Zeitlose wear 1920s dress (render only), and glass bursts when it dies.
    flavor: 'revue',
    shards: true,
    strictLots: true,
    // Stand-in lot types stay few, so the Blockrand rows get the street fronts (step 7 picks the real ones).
    specialMax: { hinterhof: 3, markt: 1, truemmer: 2, parkplatz: 1 },
    viaducts,
    walls,
    hiddenSpots: [endOf('Hinterhof Bleibtreustraße', 1.2, 0)],
    guards: [
      { ...endOf('Antilopenweg', 1.5, 0), kind: 'brute', elite: true, wake: 8, hp: 2.6 },
      { ...endOf('Varietéhof', 2, 0), kind: 'brute', elite: true, wake: 8, hp: 2.6 },
    ],
    fixedProps: [...yards, ...lights],
    seed: 1920,
  };
}
