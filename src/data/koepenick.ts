// Köpenick as a mini open world (M10 concept A, Johannes 2026-11-15). Real directions, compressed
// distances: S Köpenick north, Altstadt island in the middle between Spree (north), Dahme (west) and
// Frauentog (south), Müggelberge with the Müggelturm south-east, Spreepark north-west along the Spree.
// Anchors checked against OpenStreetMap on 2026-11-15 (see docs/maps/koepenick.md).
// Route: station → Bahnhofsviertel (6 waves, Feldwebel) → Altstadt → Müggelberge (7 waves,
// Turmwächter) → back across the Altstadt → Spreepark (7 waves, Rex) → Rathaus (Hauptmann).
// Meters, +X east, +Z south, origin at the Rathaus. `scale` stretches distances only.
import type { BossKind, EnemyKind } from './enemies';
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { DEG } from '../sim/math';
import { ellipse, type Stair, type Area, type Bridge, type Landmark, type MapDef, type Pt, type River, type Street } from './map';

/** Difficulty of normal wave number `g` (0 … 19 over the whole district). */
export function waveTier(g: number, bosses: BossKind[] = []): WaveDef {
  const mix: Partial<Record<EnemyKind, number>> = {
    walker: 6,
    runner: g < 1 ? 0 : 1 + g * 0.3,
    brute: g < 3 ? 0 : 0.3 + g * 0.12,
  };
  return {
    count: Math.round(5 + g * 0.45),
    maxAlive: Math.min(12, 6 + Math.floor(g / 3)),
    mix,
    hpMul: 1 + g * 0.04,
    dmgMul: 1 + g * 0.025,
    bosses,
  };
}

/** A boss fight: the boss plus a few adds of the zone's last tier. */
function bossWave(g: number, boss: BossKind, adds: number): WaveDef {
  return { ...waveTier(g, [boss]), count: adds, maxAlive: 4 };
}

const NORMAL_HEAL = 0.3;

/**
 * A stair whose top end sits on a terrace edge point (already scaled), rising along `rot`.
 * Its size never scales, so it stays attached to the edge at any map scale.
 */
function stairTo(edge: Pt, rot: number, width = 5, len = 5): Stair {
  // The top overlaps the edge by half a meter so the retaining wall opens there.
  const back = len / 2 - 0.5;
  return { x: edge[0] - Math.sin(rot) * back, z: edge[1] - Math.cos(rot) * back, rot, width, len };
}

export function koepenickMap(scale = 1): MapDef {
  const s = scale;
  const P = (x: number, z: number): Pt => [x * s, z * s];
  const line = (pts: Array<[number, number]>): Pt[] => pts.map(([x, z]) => P(x, z));
  const rw = (w: number): number => w * Math.sqrt(s);

  let g = 0;
  const enc = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number): EncounterDef => {
    const list: WaveDef[] = [];
    for (let i = 0; i < waves; i++) list.push(waveTier(g++));
    return { id, name, zone, x: x * s, z: z * s, r, waves: list, heal: NORMAL_HEAL };
  };
  const boss = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => (
    { id, name, zone, x: x * s, z: z * s, r, waves: [bossWave(Math.max(0, g - 1), kind, adds)], heal: 1 }
  );

  const encounters: EncounterDef[] = [
    // Zone 0: Bahnhofsviertel (6 waves).
    enc('vorplatz', 'Bahnhofsvorplatz', 0, 10, -160, 13, 2),
    enc('forum', 'Forum', 0, 46, -112, 14, 2),
    enc('linden', 'Lindenstraße', 0, -40, -100, 13, 2),
    boss('damm', 'Dammbrücke', 0, 8, -80, 14, 'feldwebel', 3),
    // Zone 1: Müggelberge (7 waves).
    enc('kietz', 'Kietz', 1, 62, 14, 13, 2),
    enc('mueggelheimer', 'Müggelheimer Straße', 1, 112, 70, 14, 2),
    enc('teufelssee', 'Teufelssee', 1, 128, 148, 14, 3),
    boss('turm', 'Müggelturm', 1, 180, 165, 15, 'waechter', 4),
    // Zone 2: Spreepark (7 waves).
    enc('vorstadt', 'Köllnische Vorstadt', 2, -82, -16, 13, 2),
    enc('spreeufer', 'Spreeufer', 2, -140, -45, 14, 2),
    enc('dinowiese', 'Dino-Wiese', 2, -205, -22, 15, 3),
    boss('riesenrad', 'Riesenrad', 2, -198, -68, 16, 'rex', 4),
    // Zone 3: back to the Rathaus.
    boss('rathaus', 'Rathausplatz', 3, 0, 12, 15, 'hauptmann', 6),
  ];

  const zones: ZoneDef[] = [
    { id: 'bahnhof', name: 'Bahnhofsviertel', entry: { x: 10 * s, z: -176 * s } },
    { id: 'mueggelberge', name: 'Müggelberge', entry: { x: 48 * s, z: 4 * s } },
    { id: 'spreepark', name: 'Spreepark', entry: { x: -52 * s, z: -4 * s } },
    { id: 'rathaus', name: 'Rathaus', entry: { x: 6 * s, z: -26 * s } },
  ];

  const rivers: River[] = [
    { name: 'Spree', width: rw(22), pts: line([[150, -25], [110, -38], [70, -45], [30, -47], [-10, -45], [-28, -40]]) },
    { name: 'Spree', width: rw(28), pts: line([[-28, -40], [-60, -55], [-100, -75], [-140, -95], [-180, -112], [-220, -128], [-270, -148]]) },
    { name: 'Dahme', width: rw(24), pts: line([[-42, 220], [-40, 160], [-36, 100], [-32, 50], [-30, 0], [-28, -40]]) },
  ];

  const lakes: Pt[][] = [
    line([[136, -110], [250, -130], [250, 100], [205, 94], [176, 72], [150, 36], [138, 0], [134, -60]]), // Müggelsee
    line([[-52, 3], [-12, 3], [-10, 44], [-50, 46]]), // Dahme around the Schlossinsel
    line([[-20, 33], [28, 31], [46, 46], [38, 64], [4, 68], [-22, 58]]), // Frauentog
    ellipse(92 * s, 180 * s, 13 * s, 9 * s, 16), // Teufelssee
  ];
  const islands: Pt[][] = [ellipse(-31 * s, 24 * s, 10 * Math.sqrt(s), 15 * Math.sqrt(s), 18)];

  const bridges: Bridge[] = [
    { name: 'Dammbrücke', x: 6 * s, z: -46 * s, rot: 0, len: rw(22) + 12, width: 12 },
    { name: 'Lange Brücke', x: -30 * s, z: -4 * s, rot: 90 * DEG, len: rw(24) + 12, width: 11 },
    { name: 'Schlossbrücke', x: -15.5 * s, z: 24 * s, rot: 90 * DEG, len: 12, width: 5 },
  ];

  const streets: Street[] = [
    { name: 'Bahnhofstraße', kind: 'main', width: 10, pts: line([[10, -205], [9, -130], [7, -70], [6, -46], [4, -22]]) },
    { name: 'Alt-Köpenick', kind: 'side', width: 8, pts: line([[4, -22], [2, 10], [0, 28]]) },
    { name: 'Grünstraße', kind: 'side', width: 7, pts: line([[-12, -4], [14, 0], [44, 0]]) },
    { name: 'Lange Brücke', kind: 'side', width: 9, pts: line([[-50, -4], [-12, -4]]) },
    { name: 'Müggelheimer Straße', kind: 'main', width: 9, pts: line([[44, 0], [64, 10], [90, 38], [116, 74], [138, 112], [160, 148], [178, 166]]) },
    { name: 'Kietz', kind: 'side', width: 6, pts: line([[28, 18], [52, 30], [70, 44]]) },
    { name: 'Spreeufer', kind: 'main', width: 9, pts: line([[-50, -4], [-72, -12], [-100, -26], [-130, -40], [-160, -52], [-192, -62]]) },
    { name: 'Lindenstraße', kind: 'side', width: 8, pts: line([[-80, -100], [9, -104], [96, -110]]) },
    { name: 'Friedrichshagener Straße', kind: 'side', width: 7, pts: line([[9, -148], [90, -152], [130, -150]]) },
    { name: 'Seelenbinderstraße', kind: 'side', width: 7, pts: line([[-110, -132], [-40, -130], [9, -128]]) },
    { name: 'Mahlsdorfer Straße', kind: 'side', width: 7, pts: line([[-100, -176], [-40, -174], [9, -172], [80, -176], [135, -178]]) },
    { name: 'Hirtestraße', kind: 'side', width: 6, pts: line([[-40, -174], [-40, -130], [-45, -70]]) },
    { name: 'Puchanstraße', kind: 'side', width: 6, pts: line([[90, -176], [96, -110], [100, -66]]) },
    { name: 'Freiheit', kind: 'side', width: 6, pts: line([[-14, 18], [0, 22]]) },
    { name: 'Böttcherstraße', kind: 'side', width: 6, pts: line([[18, -30], [44, -26], [50, -10]]) },
    { name: 'Lindenstraße Süd', kind: 'side', width: 7, pts: line([[-72, -12], [-80, 20], [-90, 50]]) },
    { name: 'Wendenschloß Quer', kind: 'side', width: 6, pts: line([[-8, 80], [40, 90]]) },
    { name: 'Wendenschloßstraße', kind: 'side', width: 7, pts: line([[-2, 28], [-8, 80], [-14, 140], [-18, 205]]) },
    { name: 'Spreepark', kind: 'path', width: 6, pts: line([[-192, -62], [-212, -82], [-232, -58], [-222, -18], [-196, -6], [-172, -28], [-192, -62]]) },
    { name: 'Kammweg', kind: 'path', width: 5, pts: line([[128, 148], [150, 168], [178, 166]]) },
  ];

  const areas: Area[] = [
    { id: 'bahnhof', name: 'Bahnhofsviertel', ground: 'asphalt', frontage: 'altbau', trees: 0.4, poly: line([[-120, -205], [140, -205], [140, -62], [-40, -60], [-120, -90]]) },
    { id: 'altstadt', name: 'Altstadt', ground: 'cobbles', frontage: 'altbau', trees: 0.2, poly: line([[-20, -36], [48, -38], [54, -10], [46, 32], [-18, 34]]) },
    { id: 'kietz', name: 'Kietz', ground: 'grass', frontage: 'house', trees: 1.2, poly: line([[44, -34], [140, 34], [152, 112], [64, 118], [40, 64], [46, 32], [54, -10]]) },
    { id: 'mueggelberge', name: 'Müggelberge', ground: 'forest', frontage: null, trees: 5.5, poly: line([[40, 118], [152, 112], [175, 72], [205, 94], [250, 100], [250, 225], [40, 225]]) },
    { id: 'vorstadt', name: 'Köllnische Vorstadt', ground: 'cobbles', frontage: 'altbau', trees: 0.5, poly: line([[-44, -50], [-118, -82], [-122, 30], [-44, 60]]) },
    { id: 'spreepark', name: 'Spreepark', ground: 'jungle', frontage: null, trees: 3.2, jungle: true, poly: line([[-270, -140], [-118, -82], [-122, 30], [-270, 40]]) },
    { id: 'wald', name: 'Wald', ground: 'forest', frontage: 'house', trees: 5, poly: line([[-270, 40], [-122, 30], [-44, 60], [-28, 225], [-270, 225]]) },
    { id: 'wendenschloss', name: 'Wendenschloß', ground: 'grass', frontage: 'house', trees: 1.6, poly: line([[-28, 60], [40, 64], [64, 118], [40, 225], [-28, 225]]) },
    { id: 'friedrichshagen', name: 'Friedrichshagen', ground: 'forest', frontage: null, trees: 2.6, poly: line([[140, -205], [250, -205], [250, -130], [136, -110]]) },
  ];

  const L = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear = 3): Landmark => ({ kind, x: x * s, z: z * s, rot, hx, hz, clear });
  const landmarks: Landmark[] = [
    L('sbahnhof', 10, -190, 0, 15, 7, 6),
    L('forum', 46, -138, 0, 22, 11, 3),
    L('rathaus', 24, -18, 270 * DEG, 13, 15, 3),
    L('schloss', -31, 24, 90 * DEG, 6, 9, 0),
    L('kirche', 26, 18, 0, 5, 9, 2),
    L('mueggelturm', 196, 180, 0, 3, 3, 6),
    L('riesenrad', -228, -94, 30 * DEG, 2.5, 6, 6),
    L('dino', -190, -36, 200 * DEG, 0, 0, 4),
    L('dino', -232, -34, 120 * DEG, 0, 0, 4),
    L('dino', -168, -76, 300 * DEG, 0, 0, 4),
  ];

  return {
    id: 'koepenick',
    name: 'Köpenick',
    bounds: { minX: -265 * s, maxX: 245 * s, minZ: -208 * s, maxZ: 220 * s },
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
    zones,
    rail: { z: -192 * s, minX: -265 * s, maxX: 245 * s, gapX: 10 * s, gapW: 9 },
    hills: [
      // Müggelberge: the Turm fight on the summit, the Teufelssee fight on the lower slope.
      { name: 'Müggelberge', x: 184 * s, z: 172 * s, r: 22, slope: 40 * s, h: 7 },
      { name: 'Dino-Hügel', x: -214 * s, z: -28 * s, r: 9, slope: 20 * s, h: 3.5 },
    ],
    terraces: [
      // Platform of the Riesenrad, looking over the Rex arena; stairs east and south.
      {
        name: 'Riesenrad-Plattform', h: 2.4,
        poly: [P(-243, -106), P(-214, -106), P(-214, -82), P(-243, -82)],
        stairs: [stairTo(P(-214, -92), -90 * DEG), stairTo(P(-229, -82), 180 * DEG)],
      },
      // St. Laurentius on its church hill above the Rathausplatz; stairs to the square and to the Grünstraße.
      {
        name: 'Kirchhügel', h: 1.8,
        poly: [P(17, 5), P(36, 5), P(36, 29), P(17, 29)],
        stairs: [stairTo(P(17, 17), 90 * DEG), stairTo(P(26, 5), 0)],
      },
    ],
    seed: 1906,
  };
}
