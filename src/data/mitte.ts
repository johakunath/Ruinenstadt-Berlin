// Mitte / Potsdamer Platz, the fourth district (M15, layout B2 "Vom Reichstag zum Bass", Johannes
// 2026-11-18, `docs/mockups/m15-mitte-b2.svg`, `docs/maps/mitte.md`, `docs/tasks/m15-mitte.md`). 2089:
// neon, rain, implants, the club cult. Anchors checked against OpenStreetMap on 2026-11-18 (origin
// U Potsdamer Platz), distances compressed unevenly: Potsdamer Platz and the Regierungsviertel large,
// the Friedrichstadt about 0.17 east–west, the Tiergarten pulled in to a small green intermezzo.
// Route, one loop without doubling back: U Potsdamer Platz → Leipziger Straße → Friedrichstraße →
// Unter den Linden → Pariser Platz (Der Türsteher at the Brandenburger Tor) → Dorotheenstraße → Spree
// → behind the Reichstag → Platz der Republik → Kanzleramt (Die Wachdrohne) → Spreeweg → Großer Stern
// (around the Siegessäule) → Neuer See (mini-boss, beer garden) → Kulturforum → Landwehrkanal →
// Tilla-Durieux-Park → Sony Center (Der Bassprediger).
// Meters, +X east, +Z south, origin about the map centre. `scale` stretches distances only.
import { THREAT, type BossKind, type EnemyKind } from './enemies';
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { DEG } from '../sim/math';
import { ellipse, type Area, type Landmark, type MapDef, type Pt, type River, type Street } from './map';
import type { Prop } from './courtyard';
import { lane } from './koepenick';

/** Normal waves in the district: 9 each in Friedrichstraße, Regierungsviertel; 2 in the calm Tiergarten; 7 at Potsdamer Platz. */
export const MITTE_WAVES = 27;
/** Mitte picks up where the middle of Alexanderplatz was and climbs past its end (2D: Mitte is the wall; calibrate with the bot). */
export const MITTE_TIER = { from: 24, to: 46 } as const;

/**
 * The district's bosses (M12c, `docs/tasks/m12c-mitte-enemies.md`): Der Türsteher at the Brandenburger Tor,
 * Die Wachdrohne at the Kanzleramt, the mini-boss Der Dirigent at the Neuer See, Der Bassprediger in the Sony Center.
 */
export const MITTE_BOSSES: Record<'tor' | 'kanzleramt' | 'see' | 'sony', BossKind> = { tor: 'tuersteher', kanzleramt: 'wachdrohne', see: 'dirigent', sony: 'bassprediger' };

/**
 * Difficulty of wave `g` (24 … 46) in `zone` (M12c mix, 2D Mitte: spitter 0.14, brute 0.16, kabel 0.2, bass 0.07,
 * the rest ghouls). Kabelghule are the face of the Friedrichstraße, drones fly over the Regierungsviertel, the
 * Potsdamer Platz is the loudest (most Boxenköpfe, at most two alive by `EnemyDef.cap`). The Tiergarten is calm:
 * smaller waves, no elites, no Boxenkopf and no drones. WP5: Zünder (2D bomb 0.04) and Schildträger (shield 0.08)
 * take back the share M12c had given to the Speier and the Brocken.
 */
export function mitteWaveTier(g: number, bosses: BossKind[] = [], zone = 0): WaveDef {
  const calm = zone === 2;
  const MIX: Array<Partial<Record<EnemyKind, number>>> = [
    { walker: 6, runner: 1 + g * 0.1, kabel: 2.2 + g * 0.06, spitter: 0.5 + g * 0.05, brute: g * 0.06 - 0.6, bass: 0.6, zuender: 0.5, schild: 1 },
    { walker: 6, kabel: 1.4, spitter: 0.7 + g * 0.05, brute: g * 0.06 - 0.5, bass: 0.5, drone: 1.2, zuender: 0.5, schild: 1 },
    { walker: 6, kabel: 1, crow: 0.8, runner: 1 },
    { walker: 6, kabel: 2, spitter: 0.5 + g * 0.05, brute: g * 0.08 - 0.4, bass: 1.1, zuender: 0.5, schild: 1 },
  ];
  const mix = MIX[zone] ?? MIX[0]!;
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

/** The Großer Stern (unscaled): the island with the Siegessäule and the ring road around it. */
export const GROSSER_STERN = { x: -110, z: -55, island: 14, ring: 19, road: 9 } as const;

export function mitteMap(scale = 1): MapDef {
  const s = scale;
  const P = (x: number, z: number): Pt => [x * s, z * s];
  const line = (pts: Array<[number, number]>): Pt[] => pts.map(([x, z]) => P(x, z));
  const rw = (w: number): number => w * Math.sqrt(s);

  let g = 0;
  const tier = (n: number): number => MITTE_TIER.from + (n * (MITTE_TIER.to - MITTE_TIER.from)) / (MITTE_WAVES - 1);
  const enc = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number): EncounterDef => {
    const list: WaveDef[] = [];
    for (let i = 0; i < waves; i++) list.push(mitteWaveTier(tier(g++), [], zone));
    return { id, name, zone, x: x * s, z: z * s, r, waves: list, heal: NORMAL_HEAL };
  };
  const boss = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => (
    { id, name, zone, x: x * s, z: z * s, r, waves: [{ ...mitteWaveTier(tier(Math.max(0, g - 1)), [kind], zone), count: adds, maxAlive: 4, elite: 0 }], heal: 1 }
  );

  const encounters: EncounterDef[] = [
    // Zone 0: the Friedrichstadt, neon shopping streets (9 waves); the Türsteher at the Tor.
    enc('leipziger', 'Leipziger Straße', 0, 95, 90, 13, 3),
    enc('friedrich', 'Friedrichstraße', 0, 150, 22, 13, 3),
    enc('linden', 'Unter den Linden', 0, 115, -62, 14, 3),
    boss('pariser', 'Pariser Platz', 0, 32, -62, 15, MITTE_BOSSES.tor, 3),
    // Zone 1: the Regierungsviertel along the Spree (9 waves); the Wachdrohne at the Kanzleramt.
    enc('dorotheen', 'Dorotheenstraße', 1, 24, -116, 13, 3),
    enc('spreeufer', 'Spreeufer', 1, 32, -162, 12, 3),
    enc('republik', 'Platz der Republik', 1, -88, -118, 14, 3),
    boss('kanzleramt', 'Kanzleramt', 1, -130, -106, 15, MITTE_BOSSES.kanzleramt, 4),
    // Zone 2: the calm Tiergarten (2 waves): around the Siegessäule, then the mini-boss at the Neuer See.
    enc('stern', 'Großer Stern', 2, GROSSER_STERN.x + 9, GROSSER_STERN.z, 13, 2),
    boss('see', 'Neuer See', 2, -104, 26, 14, MITTE_BOSSES.see, 2),
    // Zone 3: Potsdamer Platz with the Kulturforum and the canal (7 waves); the Bassprediger in the Sony Center.
    enc('matthaei', 'Matthäikirchplatz', 3, -118, 108, 14, 3),
    enc('bruecke', 'Potsdamer Brücke', 3, -100, 163, 12, 2),
    enc('tilla', 'Tilla-Durieux-Park', 3, -18, 152, 13, 2),
    boss('sony', 'Sony Center', 3, -62, 85, 15, MITTE_BOSSES.sony, 6),
  ];

  const zones: ZoneDef[] = [
    // Start beside the U2 entrance on the Leipziger Platz octagon (the network's stop U Potsdamer Platz).
    { id: 'friedrichstadt', name: 'Friedrichstraße', entry: { x: 28 * s, z: 101 * s } },
    { id: 'regierung', name: 'Regierungsviertel', entry: { x: -10 * s, z: -92 * s } },
    { id: 'tiergarten', name: 'Tiergarten', entry: { x: -110 * s, z: -86 * s } },
    { id: 'potsdamer', name: 'Potsdamer Platz', entry: { x: -78 * s, z: 46 * s } },
  ];

  // The Spree along the north edge, the Landwehrkanal along the south edge (both straight quays here).
  const rivers: River[] = [
    { name: 'Spree', width: rw(20), pts: line([[-175, -186], [-100, -187], [-40, -189], [20, -190], [80, -189], [140, -188], [195, -187]]) },
    { name: 'Landwehrkanal', width: rw(12), pts: line([[-175, 189], [-60, 191], [20, 188], [100, 189], [195, 190]]) },
  ];
  // The Neuer See, touching the west edge; the beer garden on its east shore.
  const lakes: Pt[][] = [line([[-162, -16], [-138, -20], [-120, -10], [-121, 10], [-138, 17], [-162, 12]])];

  const ST = GROSSER_STERN;
  const ring: Pt[] = [];
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2; ring.push(P(ST.x + Math.sin(a) * ST.ring, ST.z + Math.cos(a) * ST.ring)); }

  const streets: Street[] = [
    // Zone 0, the Friedrichstadt: closed Blockrand rows (north side of east–west streets, both sides of north–south ones).
    { name: 'Potsdamer Platz', kind: 'main', width: 14, pts: line([[0, 102], [14, 97]]) },
    { name: 'Leipziger Straße', kind: 'main', width: 14, sidewalk: 3, block: true, pts: line([[42, 93], [100, 91], [172, 88]]) },
    { name: 'Friedrichstraße', kind: 'main', width: 10, sidewalk: 3, block: true, pts: line([[150, 91], [150, 0], [150, -62], [150, -113]]) },
    { name: 'Wilhelmstraße', kind: 'side', width: 8, sidewalk: 2, block: true, pts: line([[80, 92], [80, 0], [80, -112], [80, -167]]) },
    { name: 'Voßstraße', kind: 'side', width: 7, block: true, pts: line([[-4, 55], [80, 55]]) },
    { name: 'In den Ministergärten', kind: 'side', width: 7, block: true, pts: line([[-4, 10], [80, 10]]) },
    { name: 'Jägerstraße', kind: 'side', width: 7, block: true, pts: line([[80, 44], [172, 43]]) },
    { name: 'Französische Straße', kind: 'side', width: 7, block: true, pts: line([[80, 0], [172, -1]]) },
    { name: 'Behrenstraße', kind: 'side', width: 7, block: true, pts: line([[-4, -30], [80, -30], [172, -29]]) },
    { name: 'Unter den Linden', kind: 'main', width: 14, profile: 'allee', sidewalk: 3, block: true, pts: line([[56, -62], [120, -62], [172, -62]]) },
    // The Ebertstraße is the edge of the Tiergarten from the Potsdamer Platz past the Tor to the Reichstag.
    { name: 'Ebertstraße', kind: 'main', width: 12, pts: line([[0, 102], [-10, 62], [-10, -40], [-10, -100], [-4, -150]]) },
    { name: 'Straße des 17. Juni', kind: 'main', width: 14, pts: line([[-16, -62], [-50, -61], [-91, -58]]) },
    // Zone 1, the Regierungsviertel.
    { name: 'Dorotheenstraße', kind: 'side', width: 8, pts: line([[-4, -112], [80, -112], [172, -113]]) },
    { name: 'Reichstagufer', kind: 'side', width: 7, pts: line([[-4, -150], [24, -166], [100, -167], [172, -167]]) },
    { name: 'Neustädtische Kirchstraße', kind: 'side', width: 7, pts: line([[115, -69], [115, -112], [115, -167]]) },
    { name: 'Scheidemannstraße', kind: 'side', width: 9, pts: line([[-10, -96], [-60, -96], [-104, -100]]) },
    { name: 'Paul-Löbe-Allee', kind: 'side', width: 7, pts: line([[-4, -150], [-60, -150], [-112, -130]]) },
    { name: 'Spreeweg', kind: 'side', width: 8, pts: line([[ST.x, ST.z - ST.ring], [-112, -100], [-112, -130]]) },
    // Zone 2, the Tiergarten: the Großer Stern as a real roundabout, the 17. Juni on to the west, the Hofjägerallee to the Neuer See.
    { name: 'Großer Stern', kind: 'main', width: ST.road, pts: ring },
    { name: 'Straße des 17. Juni West', kind: 'main', width: 14, pts: line([[ST.x - ST.ring, ST.z], [-152, -54]]) },
    { name: 'Hofjägerallee', kind: 'side', width: 8, pts: line([[ST.x, ST.z + ST.ring], [-104, 0], [-94, 42]]) },
    { name: 'Tiergartenstraße', kind: 'side', width: 8, pts: line([[-152, 46], [-94, 42], [-60, 44]]) },
    { name: 'Bellevuestraße', kind: 'side', width: 8, pts: line([[-60, 44], [-26, 60], [0, 100]]) },
    // Zone 3, Potsdamer Platz, Kulturforum and the canal.
    { name: 'Potsdamer Straße', kind: 'main', width: 12, block: true, pts: line([[0, 102], [-40, 125], [-88, 170]]) },
    { name: 'Stresemannstraße', kind: 'side', width: 9, block: true, pts: line([[8, 106], [45, 150], [58, 175]]) },
    { name: 'Alte Potsdamer Straße', kind: 'side', width: 7, block: true, pts: line([[-4, 104], [-12, 132]]) },
    { name: 'Linkstraße', kind: 'side', width: 7, block: true, pts: line([[4, 108], [4, 140], [4, 172]]) },
    { name: 'Reichpietschufer', kind: 'side', width: 7, pts: line([[-152, 174], [-88, 174], [60, 174]]) },
    { name: 'Matthäikirchplatz', kind: 'path', width: 5, pts: line([[-100, 46], [-114, 80], [-118, 100]]) },
    // M16b side passages: Checkpoint Charlie (cache), a Hinterhof off the Friedrichstraße (hidden blessing),
    // the yard behind the Arkaden (sleeping elite).
    { name: 'Checkpoint Charlie', kind: 'path', width: 6, pts: line([[150, 97], [150, 110], [150, 122]]) },
    { name: 'Hinterhof', kind: 'path', width: 4, pts: line([[144, -14], [133, -15], [125, -11]]) },
    { name: 'Arkadenhof', kind: 'path', width: 4, pts: line([[50, 162], [40, 160], [32, 164]]) },
  ];

  const areas: Area[] = [
    // Small places first: the first area that contains a point wins.
    { id: 'pariserplatz', name: 'Pariser Platz', ground: 'cobbles', frontage: null, trees: 0, poly: line([[8, -82], [56, -82], [56, -42], [8, -42]]) },
    { id: 'leipzigerplatz', name: 'Leipziger Platz', ground: 'cobbles', frontage: null, trees: 0, poly: ellipse(28 * s, 95 * s, 14 * s, 14 * s, 8) },
    { id: 'stern', name: 'Großer Stern', ground: 'grass', frontage: null, trees: 0, poly: ellipse(ST.x * s, ST.z * s, (ST.island + 0.5) * s, (ST.island + 0.5) * s, 20) },
    { id: 'tilla', name: 'Tilla-Durieux-Park', ground: 'grass', frontage: null, trees: 0.2, poly: line([[-26, 128], [-11, 128], [-11, 182], [-26, 182]]) },
    { id: 'republik', name: 'Platz der Republik', ground: 'grass', frontage: null, trees: 0, poly: line([[-108, -142], [-58, -142], [-58, -104], [-108, -104]]) },
    { id: 'biergarten', name: 'Biergarten am Neuen See', ground: 'cobbles', frontage: null, trees: 0.3, poly: line([[-152, 24], [-122, 24], [-122, 40], [-152, 40]]) },
    { id: 'regierung', name: 'Regierungsviertel', ground: 'asphalt', frontage: 'altbau', trees: 0.3, specials: ['sperrzone', 'parkplatz'], poly: line([[-162, -205], [185, -205], [185, -114], [-16, -114], [-16, -98], [-162, -98]]) },
    { id: 'friedrichstadt', name: 'Friedrichstadt', ground: 'asphalt', frontage: 'altbau', trees: 0.2, specials: ['markt', 'clubhof'], poly: line([[-4, -114], [185, -114], [185, 140], [66, 140], [60, 112], [42, 80], [-4, 80]]) },
    { id: 'tiergarten', name: 'Tiergarten', ground: 'forest', frontage: null, trees: 1.1, poly: line([[-162, -98], [-16, -98], [-16, 40], [-162, 40]]) },
    { id: 'kulturforum', name: 'Kulturforum', ground: 'cobbles', frontage: null, trees: 0.4, poly: line([[-162, 40], [-95, 40], [-95, 118], [-45, 118], [-45, 200], [-162, 200]]) },
    { id: 'potsdamer', name: 'Potsdamer Platz', ground: 'asphalt', frontage: 'altbau', trees: 0.15, specials: ['nachtmarkt', 'containerdorf', 'baustelle'], poly: line([[-95, 40], [-4, 40], [-4, 80], [42, 80], [60, 112], [66, 140], [185, 140], [185, 200], [-45, 200], [-45, 118], [-95, 118]]) },
  ];

  const L = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear = 3, extra: Partial<Landmark> = {}): Landmark => ({ kind, x: x * s, z: z * s, rot, hx, hz, clear, ...extra });
  const landmarks: Landmark[] = [
    // Zone 0. The Tor faces east onto the Pariser Platz; its passages are open (`TOR_PARTS` in map.ts).
    L('tor', 3, -62, 90 * DEG, 26.5, 4.5, 2, { name: 'Brandenburger Tor' }),
    // Pariser Platz fronts (step 4): thin blocks on the north and south edge, the boss arena stays open; the
    // south row stands between the camera and the square, so it is cut above the ground floor (V1 B).
    L('pariser', 13, -79, 0, 4.5, 3, 1, { name: 'Haus Liebermann', variant: 0 }),
    L('pariser', 28, -79, 0, 9.5, 3, 1, { name: 'Französische Botschaft', variant: 1 }),
    L('pariser', 47, -79, 0, 8.5, 3, 1, { name: 'Eugen-Gutmann-Haus', variant: 2 }),
    L('pariser', 13, -45, 180 * DEG, 4.5, 3, 1, { name: 'Haus Sommer', cut: { h: 4.3 }, variant: 3 }),
    L('pariser', 28, -45, 180 * DEG, 9.5, 3, 1, { name: 'Akademie der Künste', cut: { h: 4.3 }, variant: 4 }),
    L('pariser', 47, -45, 180 * DEG, 8.5, 3, 1, { name: 'Hotel Adlon', cut: { h: 4.3 }, variant: 5 }),
    L('ubahn', 30, 91, 0, 1.8, 3, 2, { name: 'U Potsdamer Platz' }),
    L('mauerstuecke', 30, 74, 0, 7, 0.8, 2, { name: 'Mauerstücke' }),
    L('lafayette', 165, -12, -90 * DEG, 7, 7, 2, { name: 'Galeries Lafayette' }),
    // Zone 1. The Reichstag fronts west onto the Platz der Republik, the Kanzleramt east towards it.
    L('reichstag', -40, -124, -90 * DEG, 20, 15, 2, { name: 'Reichstag' }),
    L('bundesbau', 48, -140, 0, 22, 6, 2, { name: 'Jakob-Kaiser-Haus', variant: 0, cut: { h: 4.3 } }),
    L('bundesbau', -72, -161, 0, 20, 4.5, 2, { name: 'Paul-Löbe-Haus', variant: 1 }),
    L('bundesbau', -28, -163, 0, 14, 4.5, 2, { name: 'Marie-Elisabeth-Lüders-Haus', variant: 2 }),
    L('kanzleramt', -128, -150, 90 * DEG, 12, 14, 2, { name: 'Kanzleramt' }),
    // Zone 2. The Siegessäule on the island of the Großer Stern.
    L('siegessaeule', ST.x, ST.z, 0, 4.5, 4.5, 0, { name: 'Siegessäule' }),
    // Zone 3. The Sony Center: a ring of blocks with gaps around the forum (`SONY_PARTS`), the stage in the forum.
    L('sony', -62, 85, 0, 29, 29, 1, { name: 'Sony Center' }),
    L('stage', -62, 69.5, 0, 6, 2.5, 0, { name: 'Soundsystem' }),
    // Step 7: two glass towers fill the Potsdamer Platz core (north of the Leipziger Platz, at the canal).
    L('glasbau', 11, 76, 0, 9, 6, 1.5, { name: 'Beisheim Center', variant: 0 }),
    L('glasbau', 28, 156, 0, 6, 6, 1.5, { name: 'Atrium Tower', variant: 1 }),
    L('bahntower', -24, 96, 0, 7, 7, 2, { name: 'Bahntower' }),
    L('kollhoff', -20, 128, 0, 5, 6, 1.5, { name: 'Kollhoff-Tower' }),
    L('verkehrsturm', 6, 95, 0, 1.2, 1.2, 1, { name: 'Verkehrsturm' }),
    L('klinik', 22, 142, -90 * DEG, 5, 4, 2, { name: 'Implantat-Klinik' }),
    L('philharmonie', -112, 62, 0, 15, 11, 2, { name: 'Philharmonie' }),
    L('matthaeus', -145, 118, 0, 5, 8, 2, { name: 'St. Matthäus' }),
    L('stabi', -75, 135, 42 * DEG, 20, 6, 2, { name: 'Staatsbibliothek' }),
    L('nng', -136, 152, 0, 11, 11, 2, { name: 'Neue Nationalgalerie' }),
    L('checkpoint', 150, 127, 0, 1.6, 1.6, 1, { name: 'Checkpoint Charlie' }),
    // Rest stops, one per zone beside the route (front to the street); the beer garden is zone 2's.
    { ...L('spati', 120, 52, 180 * DEG, 5.5, 4, 2), name: 'Späti in der Friedrichstraße' },
    { ...L('spati', 12, -92, -90 * DEG, 5.5, 4, 2), name: 'Späti am Reichstag' },
    { ...L('spati', -138, 32, 90 * DEG, 5.5, 4, 2), name: 'Biergarten am Neuen See' },
    { ...L('spati', 36, 122, -50 * DEG, 5.5, 4, 2), name: 'Späti am Potsdamer Platz' },
  ];

  const endOf = (name: string, back: number, side: number): { x: number; z: number } => {
    const pts = streets.find((st) => st.name === name)!.pts, [ex, ez] = pts[pts.length - 1]!, [px, pz] = pts[pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
    const ux = (ex - px) / l, uz = (ez - pz) / l;
    return { x: ex - ux * back + uz * side, z: ez - uz * back - ux * side };
  };
  // Lights where the fill pass finds no free sidewalk: people camping along the 17. Juni through the
  // Tiergarten (lanterns, beacons and fires on the verge, alternating sides), work lamps beside the Reichstag.
  const lights: Prop[] = [];
  const verge = (pts: readonly Pt[], step: number, first: number, off: number, kinds: Array<Prop['kind']>): void => {
    let acc = first, i = 0;
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1]!, [bx, bz] = pts[k]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (; acc < len; acc += step, i++) {
        const o = (i % 2 ? 1 : -1) * off, x = ax + ux * acc - uz * o, z = az + uz * acc + ux * o;
        if (encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 1)) continue;
        lights.push({ kind: kinds[i % kinds.length]!, x, z, rot: i * 1.7, size: 0.7 + ((i * 37) % 7) / 10 });
      }
      acc -= len;
    }
  };
  verge(streets.find((st) => st.name === 'Straße des 17. Juni')!.pts, 11, 4, 8.2, ['stormLantern', 'fireBarrel', 'beacon', 'workLamp']);
  for (const [x, z, kind] of [[0, -116, 'workLamp'], [-1, -134, 'fireBarrel'], [-15, -126, 'stormLantern'], [-69, 161.5, 'fireBarrel'], [-82, 178.5, 'workLamp'], [63, 166, 'fireBarrel'], [-100, -92, 'beacon'],
    // Curb lanterns where the street lamps leave gaps (Friedrichstraße, Unter den Linden, Ebertstraße, 17. Juni, Dorotheenstraße, canal).
    [156.5, 25, 'lantern'], [143.5, -22, 'lantern'], [84, 84, 'lantern'], [86.5, 46, 'lantern'], [134, -53, 'lantern'], [-3.5, 35, 'lantern'],
    [-24, -55.5, 'lantern'], [36, -106.5, 'lantern'], [-80, 167, 'lantern'], [-6, 168.5, 'lantern'], [121, 3.5, 'lantern']] as Array<[number, number, Prop['kind']]>) lights.push({ kind, x: x * s, z: z * s, rot: 0, size: 1 });
  // Work lamps at the curb, street centre (scaled) plus a curb offset (widths do not scale), aimed at the street:
  // they fill gaps in the lantern rows without pushing lanterns away (lanterns keep their own spacing).
  for (const [x, z, dx, dz] of [[82, 91.6, 0, 7.45], [-10, 28, -6.45, 0], [150, 88.6, 5.45, 7.45], [-10, -95, 6.45, 0]] as Array<[number, number, number, number]>) lights.push({ kind: 'workLamp', x: x * s + dx, z: z * s + dz, rot: Math.atan2(-dx, -dz), size: 1 });
  // The beer garden: tables, string lights over them and lanterns along the shore.
  const beer: Prop[] = [
    { kind: 'stringLights', x: -137 * s, z: 27 * s, rot: 0, size: 1 },
    { kind: 'bench', x: -144 * s, z: 27 * s, rot: 0.1, size: 1 }, { kind: 'bench', x: -132 * s, z: 26 * s, rot: -0.2, size: 1 },
    { kind: 'bench', x: -146 * s, z: 36 * s, rot: 1.5, size: 1 }, { kind: 'stormLantern', x: -128 * s, z: 37 * s, rot: 0, size: 1 },
    { kind: 'lantern', x: -124 * s, z: 18 * s, rot: 0, size: 1 },
  ];
  return {
    id: 'mitte',
    name: 'Mitte',
    bounds: { minX: -155 * s, maxX: 175 * s, minZ: -194 * s, maxZ: 193 * s },
    start: zones[0]!.entry,
    rivers,
    lakes,
    islands: [],
    bridges: [],
    streets,
    areas,
    defaultGround: 'asphalt',
    landmarks,
    encounters,
    zones,
    rail: null,
    hills: [],
    terraces: [],
    district: 3,
    flavor: 'neon',
    wet: true,
    strictLots: true,
    hiddenSpots: [endOf('Hinterhof', 1.2, 0)],
    // Step 7: a container village on the route between the Potsdamer Brücke and the Tilla-Durieux-Park.
    // The Tiergarten has no frontage: its two lot types stand by hand beside the route (east of the
    // Hofjägerallee, south of the Straße des 17. Juni).
    specialLots: [
      { special: 'containerdorf', x: -44 * s, z: 160 * s, rot: 0, w: 18, d: 14 },
      { special: 'zeltlager', x: -80 * s, z: -12 * s, rot: -Math.PI / 2, w: 18, d: 15 },
      { special: 'lichtung', x: -60 * s, z: -38 * s, rot: Math.PI, w: 18, d: 15 },
    ],
    specialMax: { nachtmarkt: 2, containerdorf: 3, baustelle: 1, markt: 2, clubhof: 3, sperrzone: 3, parkplatz: 2 },
    guards: [{ ...endOf('Arkadenhof', 2, 0), kind: 'brute', elite: true, wake: 8, hp: 2.6 }],
    fixedProps: [
      { kind: 'crates', ...endOf('Checkpoint Charlie', 1.5, 0), rot: 0.4, size: 1.2 }, { kind: 'crate', ...endOf('Checkpoint Charlie', 3.5, -1.4), rot: 1, size: 1 },
      { kind: 'sandbags', ...endOf('Checkpoint Charlie', 4, 2), rot: 0, size: 1 }, { kind: 'workLamp', ...endOf('Checkpoint Charlie', 6, 1.6), rot: -0.8, size: 1 },
      { kind: 'stormLantern', ...endOf('Hinterhof', 3.5, 1.2), rot: 0, size: 1 }, { kind: 'fireBarrel', ...endOf('Arkadenhof', 5, -1.3), rot: 0, size: 1 },
      ...lane(streets.find((st) => st.name === 'Checkpoint Charlie')!, 'bauzaun'),
      ...lane(streets.find((st) => st.name === 'Hinterhof')!, 'fence'),
      ...lane(streets.find((st) => st.name === 'Arkadenhof')!, 'bauzaun'),
      ...beer,
      ...lights,
    ],
    seed: 2089,
  };
}
