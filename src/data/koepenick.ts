// Köpenick as a mini open world. v2 (M11b, concept C "Rundweg", Johannes 2026-11-15): real
// directions, distances about 0.6 of v1. The Altstadt island keeps its size; the zones around it
// moved closer. S Köpenick north, Müggelberge south-east, the ferry Wendenschloß – Grünau over the
// Dahme south, Johannisthal and the Spreepark west and north-west. Anchors checked against
// OpenStreetMap on 2026-11-15 (see docs/maps/koepenick.md).
// Route, one loop without doubling back: station → Bahnhofsviertel (9 waves, Feldwebel) → Altstadt →
// Müggelberge (9 waves, Turmwächter) → ferry → Johannisthal → Spreepark (9 waves, Rex) → along the
// Spree over the Lange Brücke → Rathaus (Hauptmann).
// Meters, +X east, +Z south, origin at the Rathaus. `scale` stretches distances only.
import { THREAT, type BossKind, type EnemyKind, lateTier } from './enemies';
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { DEG } from '../sim/math';
import { ellipse, type Stair, type Area, type Bridge, type Landmark, type MapDef, type Pt, type River, type Street } from './map';
import type { Prop } from './courtyard';

/**
 * Difficulty of normal wave number `g` (0 … 19 over the whole district) in `zone`. Each zone
 * teaches its own types one at a time (M12): Bahnhofsviertel Hetzer, then Speier, then Brocken;
 * Müggelberge adds Krähen; the Spreepark adds Raptoren. Elites from the fourth wave (2D chance).
 */
export function waveTier(g: number, bosses: BossKind[] = [], zone = g < 6 ? 0 : g < 13 ? 1 : 2): WaveDef {
  const mix: Partial<Record<EnemyKind, number>> = {
    walker: 6,
    runner: g < 1 ? 0 : 1 + g * 0.3,
    spitter: g < 3 ? 0 : 0.8 + g * 0.08,
    brute: g < 4 ? 0 : 0.3 + g * 0.12,
    crow: zone === 1 ? 1.6 + (g - 6) * 0.15 : zone === 2 ? 0.6 : 0,
    raptor: zone === 2 ? 1.6 + (g - 13) * 0.4 : 0,
  };
  return {
    count: Math.round((5 + g * 0.45) * lateTier(g).count),
    maxAlive: Math.max(5, Math.round(Math.min(12, 6 + Math.floor(g / 3)) * lateTier(g).count)),
    mix,
    hpMul: (1 + g * 0.13) * lateTier(g).hp,
    dmgMul: 1 + g * 0.06,
    bosses,
    elite: THREAT.eliteChance(g),
  };
}

/** A boss fight: the boss plus a few adds of the zone's last tier (no elites beside a boss). */
function bossWave(g: number, boss: BossKind, adds: number, zone: number): WaveDef {
  return { ...waveTier(g, [boss], zone), count: adds, maxAlive: 4, elite: 0 };
}

const NORMAL_HEAL = 0.3;
/** Normal waves in the district: 9 per zone. */
export const NORMAL_WAVES = 27;

/**
 * A stair whose top end sits on a terrace edge point (already scaled), rising along `rot`.
 * Its size never scales, so it stays attached to the edge at any map scale.
 */
function stairTo(edge: Pt, rot: number, width = 5, len = 5): Stair {
  // The top overlaps the edge by half a meter so the retaining wall opens there.
  const back = len / 2 - 0.5;
  return { x: edge[0] - Math.sin(rot) * back, z: edge[1] - Math.cos(rot) * back, rot, width, len };
}

/**
 * M16b: a side passage reads as a lane, not a trail: fence or site fence panels on both sides, open
 * for the first 4 m (the entrance from the route), closed across the end.
 */
export function lane(st: Street, kind: 'fence' | 'bauzaun'): Prop[] {
  const out: Prop[] = [], PANEL = 2.4, off = st.width / 2 + 0.5;
  let walked = 0;
  for (let i = 1; i < st.pts.length; i++) {
    const [ax, az] = st.pts[i - 1]!, [bx, bz] = st.pts[i]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const rot = Math.atan2(-uz, ux);
    for (let t = PANEL / 2; t < len; t += PANEL) {
      if (walked + t < 4) continue;
      for (const side of [-1, 1]) out.push({ kind, x: ax + ux * t + uz * off * side, z: az + uz * t - ux * off * side, rot, size: PANEL });
    }
    walked += len;
  }
  const [ex, ez] = st.pts[st.pts.length - 1]!, [px, pz] = st.pts[st.pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
  const ux = (ex - px) / l, uz = (ez - pz) / l;
  out.push({ kind, x: ex + ux * 1.6, z: ez + uz * 1.6, rot: Math.atan2(-ux, -uz), size: st.width + 1.4 });
  return out;
}

export function koepenickMap(scale = 1): MapDef {
  const s = scale;
  const P = (x: number, z: number): Pt => [x * s, z * s];
  const line = (pts: Array<[number, number]>): Pt[] => pts.map(([x, z]) => P(x, z));
  const rw = (w: number): number => w * Math.sqrt(s);

  let g = 0;
  // The 27 waves run through the same 0 … 19 difficulty scale the 20 did (playtest 2026-11-17: more waves).
  const tier = (n: number): number => (n * 19) / (NORMAL_WAVES - 1);
  const enc = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number): EncounterDef => {
    const list: WaveDef[] = [];
    for (let i = 0; i < waves; i++) list.push(waveTier(tier(g++), [], Math.min(zone, 2)));
    return { id, name, zone, x: x * s, z: z * s, r, waves: list, heal: NORMAL_HEAL };
  };
  const boss = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => (
    { id, name, zone, x: x * s, z: z * s, r, waves: [bossWave(tier(Math.max(0, g - 1)), kind, adds, Math.min(zone, 2))], heal: 1 }
  );

  const encounters: EncounterDef[] = [
    // Zone 0: Bahnhofsviertel (9 waves).
    enc('vorplatz', 'Bahnhofsvorplatz', 0, 10, -108, 13, 3),
    enc('linden', 'Lindenstraße', 0, -36, -92, 13, 3),
    enc('forum', 'Forum', 0, 46, -96, 14, 3),
    boss('damm', 'Dammbrücke', 0, 6, -74, 14, 'feldwebel', 3),
    // Zone 1: Müggelberge (9 waves).
    enc('kietz', 'Kietz', 1, 60, 16, 13, 3),
    enc('mueggelheimer', 'Müggelheimer Straße', 1, 92, 52, 14, 3),
    enc('teufelssee', 'Teufelssee', 1, 98, 98, 14, 3),
    boss('turm', 'Müggelturm', 1, 134, 112, 15, 'waechter', 4),
    // Zone 2: over the Dahme by ferry, west through Johannisthal up to the Spreepark (9 waves).
    enc('faehre', 'Fähre Grünau', 2, -54, 104, 13, 3),
    enc('flugfeld', 'Flugfeld Johannisthal', 2, -100, 62, 15, 3),
    enc('dinowiese', 'Dino-Wiese', 2, -112, 12, 15, 3),
    boss('riesenrad', 'Riesenrad', 2, -108, -30, 16, 'rex', 4),
    // Zone 3: along the Spree, over the Lange Brücke to the Rathaus.
    boss('rathaus', 'Rathausplatz', 3, 0, 12, 15, 'hauptmann', 6),
  ];

  const zones: ZoneDef[] = [
    { id: 'bahnhof', name: 'Bahnhofsviertel', entry: { x: 10 * s, z: -124 * s } },
    { id: 'mueggelberge', name: 'Müggelberge', entry: { x: 48 * s, z: 0 } },
    { id: 'spreepark', name: 'Spreepark', entry: { x: 8 * s, z: 106 * s } },
    { id: 'rathaus', name: 'Rathaus', entry: { x: -56 * s, z: -6 * s } },
  ];

  const rivers: River[] = [
    { name: 'Spree', width: rw(22), pts: line([[108, -26], [70, -40], [30, -47], [-10, -45], [-28, -40]]) },
    { name: 'Spree', width: rw(26), pts: line([[-28, -40], [-60, -55], [-100, -75], [-130, -90], [-156, -102]]) },
    { name: 'Dahme', width: rw(22), pts: line([[-14, 156], [-18, 110], [-28, 70], [-32, 50], [-30, 0], [-28, -40]]) },
  ];

  const lakes: Pt[][] = [
    line([[104, -60], [166, -70], [166, 70], [140, 66], [124, 48], [112, 22], [106, -10], [104, -40]]), // Müggelsee
    line([[-52, 3], [-12, 3], [-10, 44], [-50, 46]]), // Dahme around the Schlossinsel
    line([[-20, 33], [28, 31], [46, 46], [38, 64], [4, 68], [-22, 58]]), // Frauentog
    ellipse(72 * s, 118 * s, 10 * s, 7 * s, 16), // Teufelssee
  ];
  const islands: Pt[][] = [ellipse(-31 * s, 24 * s, 10 * Math.sqrt(s), 15 * Math.sqrt(s), 18)];

  const bridges: Bridge[] = [
    { name: 'Dammbrücke', x: 6 * s, z: -46 * s, rot: 0, len: rw(22) + 12, width: 12 },
    { name: 'Lange Brücke', x: -30 * s, z: -4 * s, rot: 90 * DEG, len: rw(24) + 12, width: 11 },
    { name: 'Schlossbrücke', x: -15.5 * s, z: 24 * s, rot: 90 * DEG, len: 12, width: 5 },
    // Fähre Wendenschloß – Grünau: the moored ferry is the way over the Dahme.
    { name: 'Fähre', kind: 'ferry', x: -17.5 * s, z: 104 * s, rot: 90 * DEG, len: rw(22) + 12, width: 6 },
  ];

  const streets: Street[] = [
    // The bridge part keeps the old width (the Dammbrücke deck); the stopped tram stands on it (first tram street).
    { name: 'Dammbrücke', kind: 'main', width: 7.5, tram: true, pts: line([[7, -60], [6, -46], [4, -22]]) },
    // M11d profile A (Johannes, 2026-11-17): the Bahnhofstraße as a Berlin main street, 14 m with tram, parking and 3 m sidewalks.
    { name: 'Bahnhofstraße', kind: 'main', width: 14, tram: true, profile: 'haupt', sidewalk: 3, pts: line([[10, -150], [9, -100], [7, -60]]) },
    { name: 'Alt-Köpenick', kind: 'side', width: 6.5, pts: line([[4, -22], [2, 10], [0, 28]]) },
    { name: 'Grünstraße', kind: 'side', width: 5.5, pts: line([[-12, -4], [14, 0], [44, 0]]) },
    { name: 'Lange Brücke', kind: 'side', width: 7, pts: line([[-52, -4], [-12, -4]]) },
    { name: 'Müggelheimer Straße', kind: 'main', width: 7, pts: line([[44, 0], [64, 10], [80, 32], [92, 52], [104, 80], [120, 100], [134, 112]]) },
    { name: 'Kietz', kind: 'side', width: 5, pts: line([[28, 18], [52, 30], [70, 44]]) },
    { name: 'Böttcherstraße', kind: 'side', width: 5, pts: line([[18, -30], [44, -26], [50, -10]]) },
    { name: 'Freiheit', kind: 'side', width: 5, pts: line([[-14, 18], [0, 22]]) },
    { name: 'Mahlsdorfer Straße', kind: 'side', width: 6, pts: line([[-90, -118], [-36, -116], [9, -116], [70, -118], [100, -120]]) },
    { name: 'Lindenstraße', kind: 'side', width: 6, pts: line([[-80, -88], [-36, -90], [8, -88], [46, -92], [96, -94]]) },
    { name: 'Hirtestraße', kind: 'side', width: 5, pts: line([[-36, -116], [-36, -90], [-40, -60]]) },
    { name: 'Puchanstraße', kind: 'side', width: 5, pts: line([[76, -118], [78, -94], [80, -60]]) },
    // The loop south and west (placeholder names: course not checked against real streets).
    { name: 'Waldweg', kind: 'side', width: 5, pts: line([[134, 112], [112, 124], [84, 130], [56, 126], [30, 116], [4, 104]]) },
    { name: 'Heideweg', kind: 'side', width: 5.5, pts: line([[-30, 104], [-54, 104], [-78, 86], [-100, 62], [-108, 36], [-112, 12]]) },
    // M11d profile C (Johannes, 2026-11-17): an Allee with a grass tram track from the Köllnische Vorstadt to the Spreepark.
    { name: 'Spreeufer', kind: 'main', width: 12, tram: true, profile: 'allee', sidewalk: 3, pts: line([[-52, -4], [-72, -12], [-92, -22], [-108, -30]]) },
    { name: 'Lindenstraße Süd', kind: 'side', width: 5.5, pts: line([[-72, -12], [-76, 14], [-82, 40]]) },
    { name: 'Spreepark', kind: 'path', width: 4, pts: line([[-92, -22], [-104, -50], [-130, -38], [-132, -8], [-112, 12], [-94, 2], [-92, -22]]) },
    { name: 'Kammweg', kind: 'path', width: 4, pts: line([[98, 98], [116, 108], [134, 112]]) },
    // M16b side passages (variant A, Johannes 2026-11-17): short dead ends beside the route, each with a surprise.
    { name: 'Hinterhof', kind: 'path', width: 4, pts: line([[-44, -89], [-48, -77], [-56, -70]]) },
    { name: 'Kietzgasse', kind: 'path', width: 4, pts: line([[68, 8], [80, 0], [94, -8]]) },
    { name: 'Hangarweg', kind: 'path', width: 4.5, pts: line([[-106, 66], [-124, 76], [-138, 88]]) },
  ];

  const areas: Area[] = [
    { id: 'bahnhof', name: 'Bahnhofsviertel', ground: 'asphalt', frontage: 'altbau', trees: 0.4, specials: ['hinterhof', 'parkplatz'], poly: line([[-100, -156], [104, -156], [104, -58], [-40, -56], [-100, -72]]) },
    { id: 'altstadt', name: 'Altstadt', ground: 'cobbles', frontage: 'altbau', trees: 0.2, specials: ['markt', 'kirchhof'], poly: line([[-20, -36], [48, -38], [54, -10], [46, 32], [-18, 34]]) },
    { id: 'kietz', name: 'Kietz', ground: 'grass', frontage: 'house', trees: 1.2, specials: ['kleingarten', 'teich'], poly: line([[44, -34], [104, -24], [112, 22], [124, 48], [104, 70], [62, 84], [40, 64], [46, 32], [54, -10]]) },
    { id: 'mueggelberge', name: 'Müggelberge', ground: 'forest', frontage: null, trees: 5, specials: ['kleingarten', 'teich'], poly: line([[62, 84], [104, 70], [124, 48], [140, 66], [166, 70], [166, 156], [50, 156], [36, 110]]) },
    { id: 'wendenschloss', name: 'Wendenschloß', ground: 'grass', frontage: 'house', trees: 1.6, specials: ['kleingarten', 'teich'], poly: line([[-26, 60], [40, 64], [62, 84], [36, 110], [50, 156], [-14, 156], [-22, 110]]) },
    { id: 'vorstadt', name: 'Köllnische Vorstadt', ground: 'cobbles', frontage: 'altbau', trees: 0.5, specials: ['truemmer', 'baustelle', 'hinterhof'], poly: line([[-44, -50], [-86, -66], [-88, 30], [-44, 60]]) },
    { id: 'spreepark', name: 'Spreepark', ground: 'jungle', frontage: null, trees: 5, specials: ['truemmer', 'baustelle'], jungle: true, poly: line([[-160, -110], [-86, -66], [-88, 30], [-160, 32]]) },
    { id: 'johannisthal', name: 'Johannisthal', ground: 'grass', frontage: 'house', trees: 1.8, specials: ['truemmer', 'baustelle'], poly: line([[-160, 32], [-88, 30], [-44, 60], [-26, 156], [-160, 156]]) },
    { id: 'friedrichshagen', name: 'Friedrichshagen', ground: 'forest', frontage: null, trees: 2.6, specials: ['hinterhof', 'parkplatz'], poly: line([[104, -156], [166, -156], [166, -70], [104, -60]]) },
  ];

  const L = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear = 3): Landmark => ({ kind, x: x * s, z: z * s, rot, hx, hz, clear });
  const landmarks: Landmark[] = [
    L('sbahnhof', 10, -140, 0, 15, 7, 6),
    L('forum', 52, -126, 0, 22, 11, 3),
    // P42: cut while the hero is behind them. The Böttcherstraße runs right behind the Rathaus, so it is cut low (like the U1 halls).
    { ...L('rathaus', 24, -18, 270 * DEG, 13, 15, 3), cut: { h: 2 } },
    // M11d: sizes from reference photos (Schloss front along the island, tower plus pavilion, wheel legs).
    { ...L('schloss', -31, 24, 90 * DEG, 11.5, 5.5, 0), cut: {} },
    { ...L('kirche', 26, 18, 0, 5, 9, 2), cut: {} },
    // P42 follow-up: cut too; its lid follows the tower and the roof terrace (`landmarkCutCaps`), not the beer garden.
    { ...L('mueggelturm', 147, 124, 0, 6, 5, 6), cut: {} },
    L('riesenrad', -137, -51, 30 * DEG, 6.5, 3.5, 10),
    { ...L('dino', -96, -4, 200 * DEG, 2, 3.5, 1), variant: 0 },
    { ...L('dino', -140, -14, 120 * DEG, 2, 3, 1), variant: 1 },
    { ...L('dino', -126, 36, 300 * DEG, 2.5, 3, 1), variant: 2 },
    // Späti rest stops, one per zone beside the route (front to the street; hx/hz are world extents).
    { ...L('spati', -12, -98, 0, 5.5, 4, 2), name: 'Späti am Bahnhof' },
    { ...L('spati', 58, -10, -90 * DEG, 4, 5.5, 2), name: 'Späti am Kietz' },
    { ...L('spati', 4, 96, 0, 5.5, 4, 2), name: 'Späti Wendenschloß' },
    { ...L('spati', -66, 9, -90 * DEG, 4, 5.5, 2), name: 'Späti an der Altstadt' },
  ];

  /** A spot `back` meters before the end of a side passage, `side` meters off its centre line. */
  const endOf = (name: string, back: number, side: number): { x: number; z: number } => {
    const pts = streets.find(st => st.name === name)!.pts, [ex, ez] = pts[pts.length - 1]!, [px, pz] = pts[pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
    const ux = (ex - px) / l, uz = (ez - pz) / l;
    return { x: ex - ux * back + uz * side, z: ez - uz * back - ux * side };
  };
  // A stopped tram on the east track, with all axles past the bend on the bridge straight.
  const tramPts = streets.find(street => street.tram)!.pts;
  const tramA = tramPts[tramPts.length - 2]!, tramB = tramPts[tramPts.length - 1]!;
  const tramRot = Math.atan2(tramB[0] - tramA[0], tramB[1] - tramA[1]);
  const tramT = 7 / 24;
  return {
    id: 'koepenick',
    name: 'Köpenick',
    bounds: { minX: -156 * s, maxX: 162 * s, minZ: -152 * s, maxZ: 152 * s },
    start: zones[0]!.entry,
    rivers,
    lakes,
    islands,
    bridges,
    streets,
    areas,
    defaultGround: 'forest',
    landmarks,
    encounters,
    // M11c: the Altstadt is too tight for generated lot types; market by the Dammbrücke, churchyard beside St. Laurentius.
    // M11d step 5: the route blocks of zone 0 are authored (Johannes 2026-11-17: hand-build the route,
    // generate the filler). Corner blocks with chamfers at Bahnhofstraße / Mahlsdorfer Straße, a row with
    // a courtyard and risalits on the Mahlsdorfer Straße, one burnt-out corner as a landmark of the square.
    handLots: [
      { kind: 'altbau', x: -5.7 * s, z: -126.3 * s, rot: 90 * DEG, w: 10.5, d: 10, floors: 2, shape: { front: [{ to: 1.2, back: 0 }, { to: 5.25, back: 0.7 }], chamfer: { side: -1, c: 3 } } },
      { kind: 'altbau', x: 24.25 * s, z: -126.3 * s, rot: -90 * DEG, w: 10.5, d: 8.5, floors: 2, ruin: true, shape: { front: [{ to: 5.25, back: 0 }], chamfer: { side: 1, c: 3 } } },
      { kind: 'altbau', x: -24 * s, z: -125.8 * s, rot: 0, w: 12, d: 10, floors: 1, shape: { front: [{ to: -2.2, back: 0 }, { to: 2.2, back: 5 }, { to: 6, back: 0 }] } },
      { kind: 'altbau', x: -37 * s, z: -125.8 * s, rot: 0, w: 12, d: 10, floors: 2, ruin: true, shape: { front: [{ to: -3, back: 0 }, { to: 3, back: 0.8 }, { to: 6, back: 0 }] } },
      { kind: 'shop', x: -21.5 * s, z: -107.45 * s, rot: 180 * DEG, w: 8, d: 8.5, floors: 0 },
      { kind: 'altbau', x: -60 * s, z: -107.2 * s, rot: 180 * DEG, w: 11, d: 9, floors: 1, shape: { front: [{ to: -1.5, back: 0 }, { to: 1.5, back: 1.4 }, { to: 5.5, back: 0 }] } },
    ],
    specialLots: [
      { special: 'markt', x: -10.5 * s, z: -20 * s, rot: 90 * DEG, w: 14, d: 11 },
      { special: 'kirchhof', x: 39 * s, z: 16 * s, rot: 180 * DEG, w: 13, d: 17 },
    ],
    zones,
    cutStreets: true,
    rail: { z: -142 * s, minX: -156 * s, maxX: 162 * s, gapX: 10 * s, gapW: 9 },
    hills: [
      // Müggelberge: the Turm fight on the summit, the Teufelssee fight on the lower slope.
      { name: 'Müggelberge', x: 138 * s, z: 116 * s, r: 20, slope: 30 * s, h: 7 },
      { name: 'Dino-Hügel', x: -124 * s, z: 4 * s, r: 8, slope: 14 * s, h: 3.5 },
    ],
    terraces: [
      // Platform of the Riesenrad, looking over the Rex arena; stairs east and south.
      {
        name: 'Riesenrad-Plattform', h: 2.4,
        poly: [P(-148, -64), P(-127, -64), P(-127, -42), P(-148, -42)],
        stairs: [stairTo(P(-127, -53), -90 * DEG), stairTo(P(-137, -42), 180 * DEG)],
      },
      // St. Laurentius on its church hill above the Rathausplatz; stairs to the square and to the Grünstraße.
      {
        name: 'Kirchhügel', h: 1.8,
        poly: [P(17, 5), P(36, 5), P(36, 29), P(17, 29)],
        stairs: [stairTo(P(17, 17), 90 * DEG), stairTo(P(26, 5), 0)],
      },
    ],
    // M16b surprises: the hidden blessing in the Hinterhof, a sleeping elite in the Kietzgasse, a cache at the hangar.
    hiddenSpots: [endOf('Hinterhof', 1.2, 0)],
    guards: [{ ...endOf('Kietzgasse', 2, 0), kind: 'brute', elite: true, wake: 8, hp: 2.6 }],
    fixedProps: [
      { kind: 'crates', ...endOf('Hangarweg', 1.2, 0), rot: 0.4, size: 1.2 }, { kind: 'crate', ...endOf('Hangarweg', 3, -1.2), rot: 1, size: 1 }, { kind: 'crate', ...endOf('Hangarweg', 3, 1.2), rot: -0.3, size: 1 },
      { kind: 'workLamp', ...endOf('Hinterhof', 4, 1.3), rot: 2.4, size: 1 }, { kind: 'fireBarrel', ...endOf('Kietzgasse', 5, -1.3), rot: 0, size: 1 }, { kind: 'workLamp', ...endOf('Hangarweg', 5, 1.4), rot: -0.8, size: 1 },
      ...lane(streets.find(st => st.name === 'Hinterhof')!, 'bauzaun'),
      ...lane(streets.find(st => st.name === 'Kietzgasse')!, 'fence'),
      ...lane(streets.find(st => st.name === 'Hangarweg')!, 'bauzaun'),
      { kind: 'tram', x: tramA[0] + (tramB[0] - tramA[0]) * tramT + Math.cos(tramRot) * 1.5,
      z: tramA[1] + (tramB[1] - tramA[1]) * tramT - Math.sin(tramRot) * 1.5, rot: tramRot, size: 1 }],
    seed: 1906,
  };
}
