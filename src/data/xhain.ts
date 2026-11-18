// Xhain, the second district (M15, concept B "Über die Mauer", Johannes 2026-11-18,
// `docs/mockups/m15-xhain-layouts.svg`, `docs/maps/xhain.md`). Kreuzberg and the Friedrichshain bank in
// 1981: the Wall still stands. Anchors checked against OpenStreetMap on 2026-11-17, origin the
// Oberbaumbrücke, distances compressed to about 0.14 (more along the Spree, less across it).
// Route, one loop without doubling back: S Warschauer Straße → Mühlenstraße behind the Wall →
// Ostbahnhof → over the Schillingbrücke into the death strip (Der Grenzer) → through a breach at the
// Bethaniendamm → Mariannenplatz squats → Oranienstraße → Oranienplatz (Der Brandmeister) →
// Kottbusser Tor → under the Hochbahn along the Skalitzer Straße → Görlitzer Park (Die Rattenmutter)
// → Schlesisches Tor → Oberbaumbrücke (Die Spreehexe).
// Meters, +X east, +Z south, origin at the Oberbaumbrücke. `scale` stretches distances only.
import { THREAT, type BossKind, type EnemyKind } from './enemies';
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { DEG } from '../sim/math';
import { lineDist, type Area, type Bridge, type Landmark, type MapDef, type Pt, type RailYard, type River, type Stair, type Street, type Terrace, type Viaduct, type Wall } from './map';
import type { Prop } from './courtyard';
import { lane } from './koepenick';

/** Normal waves in the district: 9 per zone. */
export const XHAIN_WAVES = 27;
/** Xhain picks up the difficulty where Köpenick's middle was and climbs past its end (calibrate with the bot). */
export const XHAIN_TIER = { from: 8, to: 30 } as const;

/**
 * Difficulty of wave `g` (8 … 30) in `zone`. Xhain teaches rats (2D: „Ratten kommen im Rudel“):
 * a few packs behind the Wall, more in the squats, the most around Görli. More spitters than
 * Köpenick (2D spit 0.28 against 0.16).
 */
export function xhainWaveTier(g: number, bosses: BossKind[] = [], zone = 0): WaveDef {
  const mix: Partial<Record<EnemyKind, number>> = {
    walker: 6,
    runner: 1 + g * 0.25,
    spitter: 1 + g * 0.1,
    brute: g < 10 ? 0 : 0.3 + g * 0.09,
    rat: zone === 0 ? (g < 9 ? 0 : 0.8) : zone === 1 ? 1.2 + (g - 15) * 0.05 : 1.8 + (g - 22) * 0.1,
    crow: zone === 2 ? 0.6 : 0,
  };
  return {
    count: Math.round(5 + g * 0.45),
    maxAlive: Math.min(12, 6 + Math.floor(g / 3)),
    mix,
    hpMul: 1 + g * 0.13,
    dmgMul: 1 + g * 0.06,
    bosses,
    elite: THREAT.eliteChance(g),
  };
}

const NORMAL_HEAL = 0.3;

export function xhainMap(scale = 1): MapDef {
  const s = scale;
  const P = (x: number, z: number): Pt => [x * s, z * s];
  const line = (pts: Array<[number, number]>): Pt[] => pts.map(([x, z]) => P(x, z));
  const rw = (w: number): number => w * Math.sqrt(s);

  let g = 0;
  const tier = (n: number): number => XHAIN_TIER.from + (n * (XHAIN_TIER.to - XHAIN_TIER.from)) / (XHAIN_WAVES - 1);
  const enc = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number): EncounterDef => {
    const list: WaveDef[] = [];
    for (let i = 0; i < waves; i++) list.push(xhainWaveTier(tier(g++), [], Math.min(zone, 2)));
    return { id, name, zone, x: x * s, z: z * s, r, waves: list, heal: NORMAL_HEAL };
  };
  const boss = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => (
    { id, name, zone, x: x * s, z: z * s, r, waves: [{ ...xhainWaveTier(tier(Math.max(0, g - 1)), [kind], Math.min(zone, 2)), count: adds, maxAlive: 4, elite: 0 }], heal: 1 }
  );

  // Görlitzer Park (OSM, 2026-11-18): a long rectangle from the Görlitzer Bahnhof south-east towards
  // the canal; here 104 × 44 m, long axis GU, centre GC (unscaled).
  const GU: [number, number] = [0.82, 0.57], GV: [number, number] = [0.57, -0.82], GC: [number, number] = [-86, 112];
  const GOERLI_AT = (t: number, w = 0): [number, number] => [GC[0] + GU[0] * t + GV[0] * w, GC[1] + GU[1] * t + GV[1] * w];
  const encounters: EncounterDef[] = [
    // Zone 0: Friedrichshain behind the Wall (9 waves), the Grenzer in the death strip.
    enc('warschauer', 'Warschauer Straße', 0, 27, -50, 13, 3),
    enc('eastside', 'East Side Gallery', 0, -33, -70, 12, 3),
    enc('ostbahnhof', 'Ostbahnhof', 0, -98, -138, 14, 3),
    boss('todesstreifen', 'Todesstreifen', 0, -185, -82, 14, 'grenzer', 3),
    // Zone 1: the squats at the Mariannenplatz (9 waves), the Brandmeister on the Oranienplatz.
    enc('rauchhaus', 'Rauch-Haus', 1, -206, -30, 13, 3),
    enc('mariannenplatz', 'Mariannenplatz', 1, -196, 2, 14, 3),
    enc('oranienstrasse', 'Oranienstraße', 1, -234, 24, 13, 3),
    boss('oranienplatz', 'Oranienplatz', 1, -278, 22, 15, 'brandmeister', 3),
    // Zone 2: Kottbusser Tor, under the Hochbahn, Görlitzer Park (9 waves), the Rattenmutter.
    enc('kotti', 'Kottbusser Tor', 2, -246, 62, 15, 3),
    enc('skalitzer', 'Skalitzer Straße', 2, -190, 60, 13, 3),
    enc('goerlitzer', 'Görlitzer Bahnhof', 2, ...GOERLI_AT(-36), 14, 3),
    boss('goerli', 'Görlitzer Park', 2, ...GOERLI_AT(10), 16, 'rattenmutter', 4),
    // Zone 3: the Spreehexe at the Kreuzberg head of the Oberbaumbrücke.
    boss('oberbaum', 'Oberbaumbrücke', 3, -42, 10, 15, 'spreehexe', 6),
  ];

  const zones: ZoneDef[] = [
    // Start on the Warschauer Brücke above the track field, beside the S-Bahn entrance.
    { id: 'osten', name: 'Mühlenstraße', entry: { x: 50 * s, z: -104 * s } },
    { id: 'so36', name: 'Mariannenplatz', entry: { x: -205 * s, z: -48 * s } },
    { id: 'kotti', name: 'Kottbusser Tor', entry: { x: -262 * s, z: 38 * s } },
    { id: 'oberbaum', name: 'Oberbaumbrücke', entry: { x: -62 * s, z: 40 * s } },
  ];

  // The Spree from the Osthafen (south-east) past the Oberbaumbrücke to the Schillingbrücke and on west.
  const spree = line([[96, 60], [40, 24], [0, 0], [-40, -30], [-80, -62], [-120, -96], [-165, -120], [-220, -134], [-320, -146]]);
  const rivers: River[] = [{ name: 'Spree', width: rw(28), pts: spree }];

  // Bridges cross square to the river: Oberbaum axis (0.6, -0.8), Schillingbrücke about -24° off south.
  const OBERBAUM_ROT = Math.atan2(-0.6, 0.8);
  const SCHILLING_ROT = Math.atan2(-0.47, 0.88);
  const bridges: Bridge[] = [
    { name: 'Oberbaumbrücke', x: 0, z: 0, rot: OBERBAUM_ROT, len: rw(28) + 14, width: 14 },
    { name: 'Schillingbrücke', x: -143 * s, z: -108 * s, rot: SCHILLING_ROT, len: rw(28) + 12, width: 12 },
  ];
  /** A point `t` meters along a bridge axis from its centre (+ towards the south head). */
  const along = (b: Bridge, t: number, side = 0): Pt => [b.x + Math.sin(b.rot) * t + Math.cos(b.rot) * side, b.z + Math.cos(b.rot) * t - Math.sin(b.rot) * side];
  const ob = bridges[0]!, sb = bridges[1]!;
  const obSouth = along(ob, ob.len / 2), obNorth = along(ob, -ob.len / 2);
  const sbNorth = along(sb, -sb.len / 2);

  const streets: Street[] = [
    // Zone 0, East Berlin (trams still run here in 1981).
    // Below the stairs of the Warschauer Brücke down to the checkpoint.
    { name: 'Warschauer Straße', kind: 'main', width: 14, profile: 'haupt', sidewalk: 3, pts: [P(35, -70), P(26, -40), [obNorth[0] + 4, obNorth[1] - 6]] },
    { name: 'Mühlenstraße', kind: 'main', width: 11, pts: line([[22, -36], [-22, -58], [-62, -90], [-72, -98]]) },
    { name: 'Straße der Pariser Kommune', kind: 'side', width: 7, pts: line([[-72, -98], [-84, -122], [-96, -150]]) },
    { name: 'Andreasstraße', kind: 'side', width: 6.5, pts: [P(-96, -150), P(-118, -142), [sbNorth[0] + 1, sbNorth[1] - 4]] },
    { name: 'Am Wriezener Bahnhof', kind: 'side', width: 6.5, pts: line([[30, -64], [0, -96], [-40, -118], [-86, -136]]) },
    { name: 'Holzmarktstraße', kind: 'side', width: 7, pts: [[sbNorth[0] + 1, sbNorth[1] - 4], P(-170, -150), P(-230, -164), P(-310, -174)] },
    { name: 'Rummelsburger Straße', kind: 'side', width: 6, pts: line([[36, -62], [68, -58], [84, -40]]) },
    // Zone 1, SO36 (cobbles).
    // Through the breach in the Wall over the Mariannenplatz to the Oranienstraße.
    { name: 'Mariannenplatz', kind: 'path', width: 5, pts: line([[-205, -62], [-205, -46], [-204, -30], [-198, 0], [-200, 24]]) },
    // The Bethaniendamm follows the Wall with its bend; St. Thomas stands inside the bend.
    { name: 'Bethaniendamm', kind: 'side', width: 6, pts: line([[-124, -68], [-130, -50], [-150, -46], [-196, -46], [-250, -45], [-305, -43]]) },
    // M15 test street for the Berliner Blockrand (Johannes 2026-11-18): tall north side, low south side.
    { name: 'Oranienstraße', kind: 'side', width: 7, sidewalk: 3, block: true, pts: line([[-305, 20], [-272, 20], [-232, 24], [-190, 26], [-150, 22], [-112, 14]]) },
    { name: 'Adalbertstraße', kind: 'side', width: 6, pts: line([[-252, 20], [-250, -20], [-249, -45]]) },
    { name: 'Mariannenstraße', kind: 'side', width: 6, pts: line([[-200, 26], [-198, 58]]) },
    { name: 'Manteuffelstraße', kind: 'side', width: 6, pts: line([[-150, 22], [-148, -20], [-150, -46]]) },
    { name: 'Dresdener Straße', kind: 'side', width: 6.5, pts: line([[-272, 20], [-262, 42], [-252, 60]]) },
    // Zone 2: the Skalitzer Straße under the U1 viaduct, Görli.
    { name: 'Skalitzer Straße', kind: 'main', width: 14, profile: 'haupt', sidewalk: 3, pts: line([[-305, 62], [-252, 60], [-196, 58], [-150, 54], [-100, 46], [-64, 36]]) },
    { name: 'Oberbaumstraße', kind: 'main', width: 12, pts: [P(-64, 36), P(-30, 22), [obSouth[0] - 2, obSouth[1] + 3]] },
    // Görli: the long path down the park, a cross path to the Wiener Straße along its north-east side.
    { name: 'Görlitzer Park', kind: 'path', width: 4.5, pts: line([[-150, 62], GOERLI_AT(-48), GOERLI_AT(0), GOERLI_AT(48)]) },
    { name: 'Görli-Querweg', kind: 'path', width: 4, pts: line([GOERLI_AT(10), GOERLI_AT(13, 28)]) },
    { name: 'Wiener Straße', kind: 'side', width: 7, pts: line([[-114, 52], GOERLI_AT(52, 28), GOERLI_AT(62, 28)]) },
    { name: 'Ohlauer Straße', kind: 'side', width: 6.5, pts: line([GOERLI_AT(-54, -28), GOERLI_AT(56, -28)]) },
    { name: 'Reichenberger Straße', kind: 'side', width: 6.5, sidewalk: 3, block: true, pts: line([[-305, 104], [-200, 108], GOERLI_AT(-54, -28)]) },
    { name: 'Görlitzer Straße', kind: 'side', width: 7, pts: line([[-64, 36], GOERLI_AT(13, 28)]) },
    { name: 'Schlesische Straße', kind: 'side', width: 7, pts: line([[-64, 36], [-20, 58], [26, 84], [56, 130]]) },
    { name: 'Taborstraße', kind: 'side', width: 6, pts: line([[-20, 58], [-40, 96], [-43, 104]]) },
    // The Wrangelkiez between Skalitzer Straße and the Spree.
    { name: 'Wrangelstraße', kind: 'side', width: 6, pts: line([[-150, -10], [-112, -16], [-76, -30]]) },
    { name: 'Köpenicker Straße', kind: 'side', width: 6.5, pts: line([[-124, -68], [-92, -44], [-60, -22], [-36, -8]]) },
    { name: 'Cuvrystraße', kind: 'side', width: 6, pts: line([[-100, 46], [-86, 14], [-76, -30]]) },
    // M16b side passages: a cache in a warehouse yard, the hidden blessing in a Hinterhof, a sleeping elite in the old railway cut.
    { name: 'Speicherhof', kind: 'path', width: 4, pts: line([[-48, -78], [-40, -92], [-32, -98]]) },
    { name: 'Hinterhof', kind: 'path', width: 4, pts: line([[-130, 19], [-129, 30], [-124, 36]]) },
    { name: 'Bahngraben', kind: 'path', width: 4.5, pts: line([GOERLI_AT(-6, -28), [GOERLI_AT(-6, -28)[0] - 8, GOERLI_AT(-6, -28)[1] + 11], [GOERLI_AT(-6, -28)[0] - 13, GOERLI_AT(-6, -28)[1] + 20]]) },
  ];

  // The Wall (1981): the hinterland wall on the Friedrichshain bank, a checkpoint across the north head
  // of the Oberbaumbrücke, and the land wall along the Bethaniendamm with the breach the route uses.
  const bankWall = (from: number, to: number, off = 18): Pt[] => {
    // `off` m from the Spree centre on its north-east side, between two river vertices.
    const out: Pt[] = [];
    for (let i = from; i <= to; i++) {
      const a = spree[Math.max(0, i - 1)]!, b = spree[Math.min(spree.length - 1, i + 1)]!;
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      out.push([spree[i]![0] - (dz / l) * off * Math.sqrt(s), spree[i]![1] + (dx / l) * off * Math.sqrt(s)]);
    }
    return out;
  };
  // Johannes 2026-11-18: the death strip runs on the north bank between the East Side Gallery and the Spree.
  const north = bankWall(0, 5, 22);
  // Checkpoint: across the bridge 6 m in from its north head; -side is upstream (west), +side downstream.
  const cpWest = along(ob, -ob.len / 2 + 6, -ob.width / 2 - 2), cpEast = along(ob, -ob.len / 2 + 6, ob.width / 2 + 2);
  const walls: Wall[] = [
    { name: 'Grenzübergang Oberbaumbrücke', pts: [cpWest, cpEast] },
    { name: 'Hinterlandmauer Osthafen', pts: [cpEast, north[0]!] },
    // Starts beside the checkpoint, off the bridge deck (north[2] would sit on it).
    { name: 'East Side Gallery', pts: [cpWest, north[3]!, north[4]!, north[5]!] },
    { name: 'Hinterlandmauer Schillingbrücke', pts: [[sbNorth[0] - 8, sbNorth[1] - 3], ...bankWall(7, 8)] },
    // West of the Schillingbrücke the border leaves the river: the land wall along the Bethaniendamm,
    // south-west from the Spree, bending west beside St. Thomas; the breach opens to the Mariannenplatz.
    { name: 'Mauer Bethaniendamm', pts: line([[-116, -98], [-124, -82], [-131, -70], [-139, -60], [-152, -56], [-199, -56]]) },
    { name: 'Mauer Bethaniendamm West', pts: line([[-211, -56], [-250, -55], [-306, -53]]) },
  ];

  // Johannes 2026-11-18: the tracks of the Stadtbahn at ground level, a wide fenced field from the south-east
  // under the Warschauer Brücke to the Ostbahnhof: the north edge of the map.
  const railYards: RailYard[] = [{ name: 'Gleisfeld', width: 28, tracks: 8, pts: line([[104, -58], [52, -96], [0, -126], [-60, -160], [-110, -184], [-200, -200], [-320, -208]]) }];
  // The Warschauer Brücke: a 12 m deck 6 m above the tracks, stairs at its south end down to the street.
  const deckN: Pt = P(58, -122), deckS: Pt = P(40, -82);
  const dl = Math.hypot(deckS[0] - deckN[0], deckS[1] - deckN[1]), du: Pt = [(deckS[0] - deckN[0]) / dl, (deckS[1] - deckN[1]) / dl];
  const dv: Pt = [-du[1] * 6, du[0] * 6];
  const stairRot = Math.atan2(-du[0], -du[1]), STAIR_LEN = 12;
  const stairs: Stair[] = [{ x: deckS[0] + du[0] * (STAIR_LEN / 2 - 0.5), z: deckS[1] + du[1] * (STAIR_LEN / 2 - 0.5), rot: stairRot, width: 6, len: STAIR_LEN }];
  const terraces: Terrace[] = [{
    name: 'Warschauer Brücke', h: 6, bridge: true, stairs,
    poly: [[deckN[0] + dv[0], deckN[1] + dv[1]], [deckS[0] + dv[0], deckS[1] + dv[1]], [deckS[0] - dv[0], deckS[1] - dv[1]], [deckN[0] - dv[0], deckN[1] - dv[1]]],
  }];
  const viaducts: Viaduct[] = [
    // U1 on its green steel viaduct over the Skalitzer Straße, then onto the upper deck of the Oberbaumbrücke.
    { name: 'Hochbahn U1', kind: 'hochbahn', width: 8, h: 6.5, pts: [P(-305, 62), P(-252, 60), P(-196, 58), P(-150, 54), P(-100, 46), P(-64, 36), P(-30, 22), obSouth] },
  ];

  // The north-bank strip between the East Side Gallery and the Spree (seen, not walked).
  const stripIn = bankWall(0, 6, 12), stripOut = bankWall(0, 6, 23);
  const areas: Area[] = [
    { id: 'grenzstreifen', name: 'Grenzstreifen', ground: 'grass', frontage: null, trees: 0, poly: [...stripIn, ...stripOut.reverse()] },
    { id: 'osthafen', name: 'Osthafen', ground: 'asphalt', frontage: 'altbau', trees: 0.3, specials: ['baustelle', 'parkplatz'], poly: line([[100, -120], [100, 20], [20, -10], [-62, -70], [-60, -150], [0, -128]]) },
    { id: 'andreasviertel', name: 'Andreasviertel', ground: 'asphalt', frontage: 'platte', trees: 0.5, specials: ['baustelle', 'parkplatz'], poly: line([[-60, -150], [-62, -70], [-120, -108], [-160, -128], [-200, -150], [-320, -170], [-320, -215], [-60, -215]]) },
    { id: 'todesstreifen', name: 'Todesstreifen', ground: 'grass', frontage: null, trees: 0, poly: line([[-116, -98], [-160, -118], [-220, -130], [-320, -140], [-320, -53], [-250, -55], [-152, -56], [-139, -60], [-131, -70], [-124, -82]]) },
    // Before SO36: the first area that contains a point wins.
    { id: 'mariannenplatz', name: 'Mariannenplatz', ground: 'grass', frontage: null, trees: 1.4, poly: line([[-224, -20], [-180, -20], [-180, 16], [-224, 16]]) },
    { id: 'so36', name: 'SO36', ground: 'cobbles', frontage: 'altbau', trees: 0.4, specials: ['hinterhof', 'kirchhof'], poly: line([[-320, -53], [-152, -56], [-139, -60], [-131, -70], [-124, -82], [-112, -60], [-120, 34], [-320, 40]]) },
    { id: 'goerli', name: 'Görlitzer Park', ground: 'grass', frontage: null, trees: 1.2, poly: line([GOERLI_AT(-52, 22), GOERLI_AT(-52, -22), GOERLI_AT(52, -22), GOERLI_AT(52, 22)]) },
    { id: 'kotti', name: 'Kottbusser Tor', ground: 'asphalt', frontage: 'altbau', trees: 0.3, specials: ['markt', 'truemmer', 'hinterhof'], poly: line([[-320, 40], [-120, 34], [-104, 70], [-150, 92], [-204, 84], [-320, 84]]) },
    { id: 'reichenberger', name: 'Reichenberger Kiez', ground: 'cobbles', frontage: 'altbau', trees: 0.5, specials: ['markt', 'truemmer', 'hinterhof'], poly: line([[-320, 84], [-204, 84], [-150, 92], GOERLI_AT(-60, -22), GOERLI_AT(60, -22), [-40, 180], [-320, 180]]) },
    { id: 'wrangelkiez', name: 'Wrangelkiez', ground: 'cobbles', frontage: 'altbau', trees: 0.5, specials: ['hinterhof'], poly: line([[-112, -60], [-124, -82], [-116, -98], [-80, -56], [-40, -26], [-6, 0], [30, 30], [100, 66], [100, 180], [-40, 180], [-104, 70], [-120, 34]]) },
  ];

  const L = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear = 3, extra: Partial<Landmark> = {}): Landmark => ({ kind, x: x * s, z: z * s, rot, hx, hz, clear, ...extra });
  const stadtbahnRot = Math.atan2(-50, -28);
  const landmarks: Landmark[] = [
    // The S-Bahn entrance beside the bridge deck, at deck height over the tracks.
    L('warschauer', 64, -100, stairRot, 6, 7, 0, { walkUnder: true }),
    L('ostbahnhof', -100, -178, stadtbahnRot + 90 * DEG, 22, 14, 2),
    // Towers and arcades of the Oberbaumbrücke; the deck itself is the bridge.
    { kind: 'oberbaum', x: 0, z: 0, rot: OBERBAUM_ROT, hx: 0, hz: 0, clear: 0 },
    L('wachturm', -226, -96, 0, 1.6, 1.6, 2),
    L('thomaskirche', -114, -34, 0, 8, 11, 2),
    L('rauchhaus', -236, -30, 90 * DEG, 5.5, 8, 2),
    L('bethanien', -238, -2, 90 * DEG, 6, 10, 2),
    L('nkz', -276, 76, 0, 20, 7, 3),
    L('goerlitzer', -160, 84, Math.atan2(GU[0], GU[1]), 12, 6, 2),
    // U1 stations on the viaduct (walk under).
    L('u1station', -246, 60, (Math.atan2(54, 4) * 1), 18, 4, 0, { walkUnder: true, name: 'Kottbusser Tor' }),
    L('u1station', -150, 54, Math.atan2(50, -8), 18, 4, 0, { walkUnder: true, name: 'Görlitzer Bahnhof' }),
    L('u1station', -70, 38, Math.atan2(36, -14), 18, 4, 0, { walkUnder: true, name: 'Schlesisches Tor' }),
    // Späti rest stops, one per zone beside the route (front to the street).
    { ...L('spati', -6, -66, 0, 5.5, 4, 2), name: 'Späti an der Mauer' },
    { ...L('spati', -176, 36, 180 * DEG, 5.5, 4, 2), name: 'Späti in der Oranienstraße' },
    { ...L('spati', -222, 40, 0, 5.5, 4, 2), name: 'Späti am Kotti' },
    { ...L('spati', -106, 28, 0, 5.5, 4, 2), name: 'Späti am Wrangelkiez' },
  ];

  const endOf = (name: string, back: number, side: number): { x: number; z: number } => {
    const pts = streets.find((st) => st.name === name)!.pts, [ex, ez] = pts[pts.length - 1]!, [px, pz] = pts[pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
    const ux = (ex - px) / l, uz = (ez - pz) / l;
    return { x: ex - ux * back + uz * side, z: ez - uz * back - ux * side };
  };
  // Fences along both edges of the track field, open under the bridge deck and at the Ostbahnhof.
  const fences: Prop[] = [];
  for (const r of railYards) {
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1]!, [bx, bz] = r.pts[i]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, rot = Math.atan2(-uz, ux);
      for (let t = 1.5; t < len; t += 3) for (const side of [-1, 1]) {
        const off = r.width / 2 + 0.6, x = ax + ux * t + uz * off * side, z = az + uz * t - ux * off * side;
        // Under the deck the bridge parapet is the edge; at the Ostbahnhof its hall closes the field.
        if (lineDist([deckN, deckS], x, z) < 7 || Math.hypot(x + 100 * s, z + 178 * s) < 22) continue;
        fences.push({ kind: 'fence', x, z, rot, size: 3 });
      }
    }
  }
  // Light under the Hochbahn (fires and candles of people living under the viaduct, between the pillar
  // pairs) and along the Warschauer Straße beside the tram, where the fill pass finds no free sidewalk.
  const lights: Prop[] = [];
  const along2 = (pts: readonly Pt[], step: number, first: number, off: (i: number) => number, kinds: Array<Prop['kind']>): void => {
    let acc = first, i = 0;
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1]!, [bx, bz] = pts[k]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (; acc < len; acc += step, i++) {
        const o = off(i), x = ax + ux * acc - uz * o, z = az + uz * acc + ux * o;
        if (encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 1) || zones.some((q) => Math.hypot(x - q.entry.x, z - q.entry.z) < 4)) continue;
        lights.push({ kind: kinds[i % kinds.length]!, x, z, rot: i * 1.7, size: 0.7 + ((i * 37) % 7) / 10 });
      }
      acc -= len;
    }
  };
  // Pillars stand every 15 m from 7.5 m on; the lights sit halfway between two pairs.
  along2(viaducts[0]!.pts, 15, 15, () => 0, ['fireBarrel', 'candles', 'fireBarrel', 'workLamp']);
  along2(streets[0]!.pts, 8, 4, (i) => (i % 2 ? 1 : -1) * 5, ['fireBarrel', 'candles', 'fireBarrel', 'workLamp']);
  // Tank traps (Panzersperren) in the death strip, off the arena and the breach.
  const traps: Prop[] = [];
  for (const [x, z] of [[-156, -98], [-160, -70], [-222, -80], [-236, -110], [-252, -84], [-268, -100], [-284, -82], [-298, -112]] as Array<[number, number]>) traps.push({ kind: 'tankTrap', x: x * s, z: z * s, rot: (x * 7 + z) % 3, size: 1 });
  return {
    id: 'xhain',
    name: 'Xhain',
    bounds: { minX: -310 * s, maxX: 90 * s, minZ: -212 * s, maxZ: 172 * s },
    start: zones[0]!.entry,
    rivers,
    lakes: [],
    islands: [],
    bridges,
    streets,
    areas,
    defaultGround: 'grass',
    landmarks,
    encounters,
    zones,
    rail: null,
    hills: [{ name: 'Görli-Hügel', x: GOERLI_AT(35)[0] * s, z: GOERLI_AT(35)[1] * s, r: 5, slope: 9 * s, h: 2.2 }],
    terraces,
    railYards,
    district: 1,
    // Johannes 2026-11-18: Kreuzberg is back yards; up to ten Hinterhöfe instead of five.
    specialMax: { hinterhof: 10 },
    walls,
    viaducts,
    hiddenSpots: [endOf('Hinterhof', 1.2, 0)],
    guards: [{ ...endOf('Bahngraben', 2, 0), kind: 'brute', elite: true, wake: 8, hp: 2.6 }],
    fixedProps: [
      { kind: 'crates', ...endOf('Speicherhof', 1.2, 0), rot: 0.4, size: 1.2 }, { kind: 'crate', ...endOf('Speicherhof', 3, -1.2), rot: 1, size: 1 }, { kind: 'crate', ...endOf('Speicherhof', 3, 1.2), rot: -0.3, size: 1 },
      { kind: 'workLamp', ...endOf('Speicherhof', 5, 1.4), rot: -0.8, size: 1 }, { kind: 'candles', ...endOf('Hinterhof', 3.5, 1.2), rot: 0, size: 1 }, { kind: 'fireBarrel', ...endOf('Bahngraben', 5, -1.3), rot: 0, size: 1 },
      ...lane(streets.find((st) => st.name === 'Speicherhof')!, 'bauzaun'),
      ...lane(streets.find((st) => st.name === 'Hinterhof')!, 'fence'),
      ...lane(streets.find((st) => st.name === 'Bahngraben')!, 'bauzaun'),
      ...traps,
      ...lights,
      ...fences,
      // Work lamps on the bridge deck (lifted to deck height like every prop on a terrace).
      { kind: 'workLamp', x: deckN[0] + du[0] * 8 + dv[0] * 0.8, z: deckN[1] + du[1] * 8 + dv[1] * 0.8, rot: 0, size: 1 },
      { kind: 'workLamp', x: deckN[0] + du[0] * 32 - dv[0] * 0.8, z: deckN[1] + du[1] * 32 - dv[1] * 0.8, rot: 0, size: 1 },
    ],
    seed: 1981,
  };
}
