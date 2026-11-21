// Wedding, the sixth district (M18, layout C2 "Zum Palast in der AEG", Johannes 2026-11-21,
// `docs/mockups/m18-wedding-c2.svg`, `docs/maps/wedding.md`, `docs/tasks/m18-wedding.md`).
// „kommt bald“: the feast that never ends holds the Kiez; cranes, scaffolds and billboards for lofts that never open.
// Origin U Leopoldplatz (the start). Anchors checked against OpenStreetMap on 2026-11-21 (octants in the map doc),
// compressed about 0.12 east–west and 0.15 to 0.3 north–south. Route, one loop without doubling back:
// U Leopoldplatz → Wochenmarkt on the square → Müllerstraße → Lindower Straße along the Ringbahn to the forecourt →
// into Zum Magendoktor from the south (two waves, then boss 1 in the same room) → round the pub onto the Nettelbeckplatz →
// Pankstraße over the Panke → Uferterrasse → Brunnenplatz before the
// Amtsgericht (boss 2) → Badstraße → through the Ringbahn arch on the Brunnenstraße → east gate of the
// Humboldthain → Rosengarten → Humboldthöhe → south-east gate → Beamtentor (boss 3) → the Lange Tafel in the
// AEG yard → the Hochzeitspalast in the roofless Maschinenhalle (the district boss).
// Two corners stay unbuilt and are never in view: north-west of the Leopoldplatz and the Nettelbeckplatz, and
// south of the Ringbahn west of the park. Meters, +X east, +Z south; `scale` stretches distances only.
// Step 1 builds the map with stand-in enemies and bosses from existing kinds; step 2 swaps in the Wedding roster.
import { THREAT, type BossKind, type EnemyKind, lateTier } from './enemies';
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { DEG } from '../sim/math';
import { SAME_KIND_GAP, type Area, type Bridge, type Landmark, type MapDef, type Pt, type River, type Street, type Viaduct, type Wall, type Lot, type Hill } from './map';
import type { Prop } from './courtyard';
import { lane } from './koepenick';
import { KNEIPE, kneipeGuards, kneipeRoom, kneipeWorld } from './kneipe';

/** Normal waves in the district: 7 Leopoldkiez, 3 Panke, 8 Gesundbrunnen & Humboldthain, 3 Das ewige Fest. */
export const WEDDING_WAVES = 21;
/** Provisional (W4): +8 per district after Charlottenburg (32 to 54), not calibrated until the M14/B2 decision. */
export const WEDDING_TIER = { from: 40, to: 62 } as const;

/**
 * Stand-in bosses from existing kinds (step 2 builds the real ones): Der Zugezogene in the Magendoktor (the Feldwebel
 * brain: a charge, adds), Das Hauptgericht before the Amtsgericht, Der Ewige Bauherr before the Beamtentor (a big slab:
 * the Volkskoloss), Sultan Nimmersatt in the Hochzeitspalast (a final boss brain).
 */
export const WEDDING_BOSSES: Record<'zugezogene' | 'hauptgericht' | 'bauherr' | 'sultan', BossKind> = { zugezogene: 'feldwebel', hauptgericht: 'brandmeister', bauherr: 'volkskoloss', sultan: 'hauptmann' };

/** The Magendoktor fight (E2): two waves at 0.6 of the usual count, at most 6 alive, then the boss with two adds. */
export const KNEIPE_FIGHT = { count: 0.6, maxAlive: 6, waves: 2, adds: 2 } as const;

/**
 * Difficulty of wave `g` (40 … 62) in `zone`: the stand-in roster of existing kinds (walker weight 6 as
 * elsewhere; the walkers become the Zecher in step 2). The Humboldthöhe is `calm`: smaller waves, no
 * elites, flyers.
 */
export function weddingWaveTier(g: number, bosses: BossKind[] = [], zone = 0, calm = false): WaveDef {
  const MIX: Array<Partial<Record<EnemyKind, number>>> = [
    { walker: 6, runner: 1.2 + g * 0.05, brute: 0.5 + g * 0.03, spitter: 0.8 + g * 0.03, crow: 0.4 },
    { walker: 6, runner: 1, spitter: 1.2, brute: 0.7, rat: 0.5, crow: 0.6 },
    { walker: 6, runner: 1.1, brute: 0.9, spitter: 1, crow: 0.8 },
    { walker: 6, brute: 1.1, spitter: 1.3, runner: 1 },
  ];
  const mix = calm ? { walker: 6, crow: 1.6, runner: 1 } : MIX[zone] ?? MIX[0]!;
  return {
    count: Math.round((5 + g * 0.45) * (calm ? 0.7 : 1) * lateTier(g).count),
    maxAlive: Math.max(calm ? 3 : 5, Math.round((Math.min(12, 6 + Math.floor(g / 3)) - (calm ? 3 : 0)) * lateTier(g).count)),
    mix: { ...mix },
    hpMul: (1 + g * 0.13) * lateTier(g).hp,
    dmgMul: 1 + g * 0.06,
    bosses,
    elite: calm ? 0 : THREAT.eliteChance(g),
  };
}

const NORMAL_HEAL = 0.3;

/** The Ringbahn polyline (unscaled): one plain brick viaduct, cut where the Müllerstraße, the Panke and the Brunnenstraße pass. */
const RINGBAHN: Array<[number, number]> = [[-55, 96], [60, 71], [113, 74], [138, 30], [170, 0], [200, -28], [235, -44], [296, -55]];
/** The Panke (placeholder line, map doc): north edge to south edge, under the Ringbahn at (138, 30). */
const PANKE: Array<[number, number]> = [[124, -105], [122, -70], [118, -30], [122, -6], [130, 14], [138, 30], [132, 56], [118, 90], [104, 125]];
/** The viaduct's brick body (as Charlottenburg's Stadtbahn). */
export const RING = { width: 10, h: 6.5 } as const;
/** Openings: the Müllerstraße at S Wedding (closed by a barricade), the Panke (water only), the Brunnenstraße (route). */
const OPENINGS: Array<{ name: string; w: number }> = [{ name: 'Müllerstraße', w: 14 }, { name: 'Panke', w: 0 }, { name: 'Brunnenstraße', w: 18 }];

/** Hochzeitspalast hall (E3): outer size, the door gap in its east wall (local z of its centre, width). */
export const HALLE = { hx: 30, hz: 17, door: { z: -1, w: 6 } } as const;
/** The Beamtentor: two brick towers round a 6 m passage through the AEG east wall. */
export const BEAMTENTOR = { half: 3, tower: { hx: 2.6, hz: 2.4 } } as const;
/** Humboldthöhe (E8): the soft rubble hill with a flat top for the fight. */
export const HOEHE = { r: 15, slope: 13, h: 7 } as const;

export function weddingMap(scale = 1): MapDef {
  const s = scale;
  const P = (x: number, z: number): Pt => [x * s, z * s];
  const line = (pts: Array<[number, number]>): Pt[] => pts.map(([x, z]) => P(x, z));
  const rw = (w: number): number => w * Math.sqrt(s);
  const bounds = { minX: -55 * s, maxX: 296 * s, minZ: -105 * s, maxZ: 125 * s };

  // The pub, the AEG yard and its hall keep their size; they are placed from one anchor each.
  const PUB = { x: 98 * s, z: 46 * s };
  const AEG = { x0: 160 * s, x1: 240 * s, z0: 44 * s, z1: 122 * s };
  const HALL = { x: AEG.x0 + 6 + HALLE.hx, z: AEG.z1 - HALLE.hz };
  const BT = { x: AEG.x1, z: 60 * s };

  // Johannes 2026-11-21: the door faces the camera (south) and the hero walks in upwards; the forecourt lies between
  // the pub and the Ringbahn, the Nettelbeckplatz behind it.
  const kneipe: Landmark = { kind: 'kneipe', x: PUB.x, z: PUB.z, rot: 0, hx: KNEIPE.w / 2, hz: KNEIPE.d / 2, clear: 1, name: 'Zum Magendoktor' };

  let g = 0;
  const tier = (n: number): number => WEDDING_TIER.from + (n * (WEDDING_TIER.to - WEDDING_TIER.from)) / (WEDDING_WAVES - 1);
  const encW = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number, calm = false): EncounterDef => {
    const list: WaveDef[] = [];
    for (let i = 0; i < waves; i++) list.push(weddingWaveTier(tier(g++), [], zone, calm));
    return { id, name, zone, x, z, r, waves: list, heal: NORMAL_HEAL };
  };
  const enc = (id: string, name: string, zone: number, x: number, z: number, r: number, waves: number, calm = false): EncounterDef => encW(id, name, zone, x * s, z * s, r, waves, calm);
  const bossW = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => (
    { id, name, zone, x, z, r, waves: [{ ...weddingWaveTier(tier(Math.max(0, g - 1)), [kind], zone), count: adds, maxAlive: 4, elite: 0 }], heal: 1 }
  );
  const boss = (id: string, name: string, zone: number, x: number, z: number, r: number, kind: BossKind, adds: number): EncounterDef => bossW(id, name, zone, x * s, z * s, r, kind, adds);
  const B = WEDDING_BOSSES;
  /**
   * E2: the whole pub is the arena (`room`): two waves of Zecher with fewer bodies at once, then the zone 1 boss in the
   * same room as the third wave with two adds (the encounter heals fully when won, as a boss fight).
   */
  const pubFight = (): EncounterDef => {
    const e = encW('magendoktor', 'Zum Magendoktor', 0, PUB.x, PUB.z, KNEIPE.r, KNEIPE_FIGHT.waves);
    const waves = e.waves.map((w) => ({ ...w, count: Math.max(3, Math.round(w.count * KNEIPE_FIGHT.count)), maxAlive: Math.min(w.maxAlive, KNEIPE_FIGHT.maxAlive) }));
    const boss: WaveDef = { ...weddingWaveTier(tier(Math.max(0, g - 1)), [B.zugezogene], 0), count: KNEIPE_FIGHT.adds, maxAlive: 4, elite: 0 };
    return { ...e, waves: [...waves, boss], heal: 1, room: kneipeRoom(kneipe), bossAt: kneipeWorld(kneipe, KNEIPE.boss.x, KNEIPE.boss.z) };
  };

  const encounters: EncounterDef[] = [
    // Zone 0, Leopoldkiez (7 waves): the market on the square, the Müllerstraße, inside the Magendoktor (two waves and
    // Der Zugezogene). The Nettelbeckplatz in front of the pub has no fight.
    enc('wochenmarkt', 'Wochenmarkt', 0, 24, -20, 14, 2),
    enc('muellerstrasse', 'Müllerstraße', 0, 22, 32, 14, 3),
    pubFight(),
    // Zone 1, Panke (3 waves): the paved quay, then the court before the Amtsgericht.
    enc('uferterrasse', 'Uferterrasse', 1, 138, -21, 13, 3),
    boss('brunnenplatz', 'Brunnenplatz', 1, 156, -52, 15, B.hauptgericht, 4),
    // Zone 2, Gesundbrunnen & Humboldthain (8 waves): a small square on the Badstraße, the rose garden, the summit (calm).
    enc('badstrasse', 'Badstraße', 2, 222, -76, 13, 3),
    enc('rosengarten', 'Rosengarten', 2, 242, 6, 13, 3),
    enc('humboldthoehe', 'Humboldthöhe', 2, 208, 8, 13, 2, true),
    bossW('beamtentor', 'Beamtentor', 2, BT.x + 17, BT.z, 14, B.bauherr, 4),
    // Zone 3, Das ewige Fest (3 waves): the Lange Tafel in the AEG yard; Sultan Nimmersatt in the hall.
    encW('langetafel', 'Lange Tafel', 3, 210 * s, 66 * s, 14, 3),
    bossW('hochzeitspalast', 'Hochzeitspalast', 3, HALL.x, HALL.z + 1, 15, B.sultan, 6),
  ];

  const zones: ZoneDef[] = [
    { id: 'leopoldkiez', name: 'Leopoldkiez', entry: { x: 0, z: 0 } },
    { id: 'panke', name: 'Panke', entry: { x: 127 * s, z: -12 * s } },
    { id: 'humboldthain', name: 'Humboldthain', entry: { x: 194 * s, z: -86 * s } },
    { id: 'fest', name: 'Das ewige Fest', entry: { x: BT.x - 6, z: BT.z + 2 } },
  ];

  const rivers: River[] = [{ name: 'Panke', width: rw(8), pts: line(PANKE) }];

  const streets: Street[] = [
    // Zone 0. The Müllerstraße (Hauptstraße, no tram) from the building site in the north-west past the
    // Leopoldplatz to the closed arch at S Wedding; Blockrand on its north-east side.
    { name: 'Müllerstraße', kind: 'main', width: 14, sidewalk: 3, block: true, pts: line([[-48, -52], [-10, 4], [20, 28], [58, 64]]) },
    { name: 'Schulstraße', kind: 'side', width: 9, sidewalk: 2, block: true, pts: line([[6, 17], [30, -24], [48, -58]]) },
    { name: 'Lindower Straße', kind: 'side', width: 9, sidewalk: 2, block: true, pts: line([[50, 57], [72, 57], [86, 58]]) },
    { name: 'Reinickendorfer Straße', kind: 'side', width: 9, sidewalk: 2, block: true, pts: line([[88, -14], [90, 2]]) },
    // Zone 1. The Pankstraße over the Panke to the Brunnenplatz and on to the Badstraße corner.
    { name: 'Pankstraße', kind: 'side', width: 10, sidewalk: 2, block: true, pts: line([[104, 6], [122, -7], [146, -34], [156, -52], [192, -86], [206, -105]]) },
    // Zone 2. The Badstraße (Hauptstraße) to the Ringbahn arch; the Brunnenstraße south through the arch.
    { name: 'Badstraße', kind: 'main', width: 14, sidewalk: 3, block: true, pts: line([[192, -86], [222, -76], [250, -66], [272, -66]]) },
    { name: 'Brunnenstraße', kind: 'main', width: 12, sidewalk: 3, block: true, pts: line([[272, -66], [272, -20], [272, 30], [272, 125]]) },
    // The park paths: east gate → Rosengarten → summit → south-east gate.
    { name: 'Humboldthain', kind: 'path', width: 4, pts: line([[262.5, 6], [242, 6], [226, 7], [208, 8], [222, 22], [244, 34], [262.5, 36]]) },
    // M16b side passages: a Hinterhof off the Müllerstraße (hidden blessing), the bunker door west of the Flakturm (cache).
    { name: 'Hinterhof Müllerstraße', kind: 'path', width: 4, pts: line([[42, 46], [46, 28], [40, 12]]) },
    { name: 'Bunkertür', kind: 'path', width: 3.5, pts: line([[196, 14], [186, 4], [187, -9]]) },
  ];

  // The Ringbahn on its brick viaduct, cut where a street or the Panke passes (as Charlottenburg's Stadtbahn).
  const rail = line(RINGBAHN);
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
  /** Distance along the rail where a polyline crosses it (its point nearest to the rail). */
  const crossing = (pts: readonly Pt[]): number => {
    let best = Infinity, at = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!;
      for (let t = 0; t <= 1; t += 0.01) { const p = project(ax + (bx - ax) * t, az + (bz - az) * t); if (p.d < best) { best = p.d; at = p.at; } }
    }
    return at;
  };
  // The Panke gap is as wide as the water where it passes (the runs end in the stream, so no bank path under them).
  const openings = OPENINGS.map((o) => {
    const pts = o.name === 'Panke' ? rivers[0]!.pts : streets.find((q) => q.name === o.name)!.pts;
    const at = crossing(pts);
    return { ...o, at, w: o.name === 'Panke' ? rivers[0]!.width - 2 : o.w };
  }).sort((p, q) => p.at - q.at);
  const viaducts: Viaduct[] = [];
  let from = 0;
  for (const o of openings) {
    viaducts.push({ name: 'Ringbahn', kind: 'stadtbahn', width: RING.width, h: RING.h, pts: cut(from, o.at - o.w / 2) });
    from = o.at + o.w / 2;
  }
  viaducts.push({ name: 'Ringbahn', kind: 'stadtbahn', width: RING.width, h: RING.h, pts: cut(from, acc[acc.length - 1]!) });
  /** Rail direction and the camera-side (south-east) normal at distance `d`. */
  const dirAt = (d: number): { ux: number; uz: number; nx: number; nz: number } => {
    const [ax, az] = railAt(d - 0.5), [bx, bz] = railAt(d + 0.5), l = Math.hypot(bx - ax, bz - az);
    return { ux: (bx - ax) / l, uz: (bz - az) / l, nx: -(bz - az) / l, nz: (bx - ax) / l };
  };
  const railOff = (d: number, off: number): Pt => { const [x, z] = railAt(d), q = dirAt(d); return [x + q.nx * off, z + q.nz * off]; };
  const arch = (name: string) => openings.find((o) => o.name === name)!;

  // The Pankstraße bridge, along the street where it crosses the stream.
  const pk = streets.find((q) => q.name === 'Pankstraße')!;
  const bridges: Bridge[] = [{ name: 'Pankstraßenbrücke', x: pk.pts[1]![0], z: pk.pts[1]![1], rot: Math.atan2(pk.pts[2]![0] - pk.pts[0]![0], pk.pts[2]![1] - pk.pts[0]![1]), len: rw(8) / 0.85 + 14, width: 14 }];

  /** A point `along` meters down a street from its first point, `off` meters to its left (+) or right (−), facing back to it. */
  const beside = (name: string, along: number, off: number): { x: number; z: number; rot: number } => {
    const pts = streets.find((q) => q.name === name)!.pts;
    let d = along;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!, len = Math.hypot(bx - ax, bz - az);
      if (d <= len || i === pts.length - 1) {
        const ux = (bx - ax) / len, uz = (bz - az) / len, x = ax + ux * d + uz * off, z = az + uz * d - ux * off;
        return { x, z, rot: Math.atan2(-uz * Math.sign(off), ux * Math.sign(off)) };
      }
      d -= len;
    }
    return { x: 0, z: 0, rot: 0 };
  };

  const L = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear = 2, extra: Partial<Landmark> = {}): Landmark => ({ kind, x: x * s, z: z * s, rot, hx, hz, clear, ...extra });
  const LW = (kind: Landmark['kind'], x: number, z: number, rot: number, hx: number, hz: number, clear: number, extra: Partial<Landmark> = {}): Landmark => ({ kind, x, z, rot, hx, hz, clear, ...extra });
  const spati = (name: string, at: { x: number; z: number; rot: number }): Landmark => {
    // The rest stop's footprint (11 × 8) as world extents for the lot and prop clearance.
    const c = Math.abs(Math.cos(at.rot)), sn = Math.abs(Math.sin(at.rot));
    return { kind: 'spati', x: at.x, z: at.z, rot: at.rot, hx: 5.5 * c + 4 * sn, hz: 5.5 * sn + 4 * c, clear: 2, name };
  };
  const beamtentor = LW('beamtentor', BT.x, BT.z, 90 * DEG, BEAMTENTOR.half + BEAMTENTOR.tower.hx * 2, BEAMTENTOR.tower.hz, 0.5, { name: 'Beamtentor' });
  const halle = LW('maschinenhalle', HALL.x, HALL.z, 0, HALLE.hx, HALLE.hz, 0.5, { name: 'Hochzeitspalast' });
  const landmarks: Landmark[] = [
    // Zone 0. The start beside the U-Bahn entrance on the square's tip; the church as a backdrop on the square;
    // the invented Neubau with crane and banner west of the Müllerstraße; the pub closing the Nettelbeckplatz.
    L('ubahn', -3, -9, 145 * DEG, 1.8, 3, 1.5, { name: 'U Leopoldplatz' }),
    L('nazareth', 2, -36, 0, 9, 6, 2, { name: 'Alte Nazarethkirche' }),
    L('neubau', -44, 4, 0, 12, 8, 2, { name: 'Neubau im Gerüst' }),
    kneipe,
    // Zone 1. The Amtsgericht north-west of the Brunnenplatz, its front to the court.
    L('amtsgericht', 140, -79, 0, 15, 7, 2, { name: 'Amtsgericht Wedding' }),
    // Zone 2. The Flakturm on the hill's north flank (only its north face stands free), the Beamtentor.
    L('flakturm', 207, -12, 0, 11, 5.5, 1, { name: 'Flakturm Humboldthain' }),
    beamtentor,
    // Zone 3. The roofless Maschinenhalle with the Hochzeitspalast at its north wall.
    halle,
    // Park gates (the Charlottenburg garden gate: two pillars round a 5 m passage).
    LW('gartentor', 262.5 * s, 6 * s, 90 * DEG, 4, 0.7, 0, { name: 'Humboldthain' }),
    LW('gartentor', 262.5 * s, 36 * s, 90 * DEG, 4, 0.7, 0, { name: 'Humboldthain' }),
    // Rest stops, one per zone beside the route (the existing Späti).
    spati('Späti am Leo', beside('Müllerstraße', 78 * s, -15)),
    spati('Baklava & Döner', beside('Pankstraße', 99 * s, -12)),
    spati('Kiosk am Rosengarten', beside('Brunnenstraße', 50 * s, 14.5)),
    spati('Teestube im Werkhof', { x: AEG.x1 - 6, z: HALL.z + 6, rot: -90 * DEG }),
  ];

  /** World point of a landmark's local (x along its front, z out of it). */
  const at = (l: Landmark, lx: number, lz: number): Pt => [l.x + Math.cos(l.rot) * lx + Math.sin(l.rot) * lz, l.z - Math.sin(l.rot) * lx + Math.cos(l.rot) * lz];
  const gates = landmarks.filter((l) => l.kind === 'gartentor');
  const [eastGate, seGate] = [gates[0]!, gates[1]!];
  // The rail's camera-side face where the park meets it, and where the park fence starts on it.
  const parkWestD = project(170 * s, 0).at, parkEastD = project(262.5 * s, -54 * s).at;
  const parkNorth: Pt[] = [];
  for (let d = parkWestD; d < parkEastD; d += 6) parkNorth.push(railOff(d, RING.width / 2 - 0.4));
  parkNorth.push(railOff(parkEastD, RING.width / 2 - 0.4));
  const parkNE = parkNorth[parkNorth.length - 1]!;
  const walls: Wall[] = [
    // The Humboldthain: fenced, entered through its two gates on the Brunnenstraße; its west fence closes the
    // unbuilt corner; the AEG north wall closes its south side.
    { name: 'Parkzaun Ost', kind: 'fence', pts: [[262.5 * s, parkNE[1]], at(eastGate, 3.2, 0)] },
    { name: 'Parkzaun Mitte', kind: 'fence', pts: [at(eastGate, -3.2, 0), at(seGate, 3.2, 0)] },
    { name: 'Parkzaun Süd', kind: 'fence', pts: [at(seGate, -3.2, 0), [262.5 * s, AEG.z0], [AEG.x1, AEG.z0]] },
    { name: 'Parkzaun West', kind: 'fence', pts: [parkNorth[0]!, [parkNorth[0]![0], AEG.z0 + 0.3]] },
    // The AEG yard (brick, E3): closed but for the Beamtentor in its east wall.
    { name: 'AEG Nord', kind: 'brick', pts: [[AEG.x1, AEG.z0], [AEG.x0, AEG.z0]] },
    { name: 'AEG West', kind: 'brick', pts: [[AEG.x0, AEG.z0], [AEG.x0, AEG.z1]] },
    { name: 'AEG Ost', kind: 'brick', pts: [[AEG.x1, AEG.z0], at(beamtentor, BEAMTENTOR.half + BEAMTENTOR.tower.hx * 2 - 0.2, 0)] },
    { name: 'AEG Ost Süd', kind: 'brick', pts: [at(beamtentor, -BEAMTENTOR.half - BEAMTENTOR.tower.hx * 2 + 0.2, 0), [AEG.x1, AEG.z1]] },
    { name: 'AEG Süd', kind: 'brick', pts: [[AEG.x1, AEG.z1], [HALL.x + HALLE.hx, AEG.z1]] },
    // The unbuilt north-west: a brick wall behind the rows of the square and the Reinickendorfer Straße, to the Panke.
    { name: 'Brandmauer Nord', kind: 'brick', pts: line([[-55, -78], [-34, -78], [-20, -60], [32, -88], [70, -64], [74, -30], [80, -24], [100, -24], [112, -36], [118, -36]]) },
  ];

  // Ground: small places first (the first area that contains a point wins).
  const parkPoly: Pt[] = [...parkNorth, [262.5 * s, parkNE[1]], [262.5 * s, AEG.z0], [parkNorth[0]![0], AEG.z0]];
  const areas: Area[] = [
    { id: 'leopoldplatz', name: 'Leopoldplatz', ground: 'cobbles', frontage: null, trees: 0.15, poly: line([[-15, -20], [-12, -46], [34, -72], [60, -52], [28, 6], [8, 8], [-2, -2]]) },
    { id: 'vorhof', name: 'Zum Magendoktor', ground: 'cobbles', frontage: null, trees: 0, poly: line([[80, 53], [118, 53], [116, 70], [80, 70]]) },
    { id: 'nettelbeckplatz', name: 'Nettelbeckplatz', ground: 'cobbles', frontage: null, trees: 0.1, poly: line([[76, 0], [104, 0], [118, 4], [126, 18], [118, 42], [116, 53], [76, 53]]) },
    { id: 'uferterrasse', name: 'Uferterrasse', ground: 'cobbles', frontage: null, trees: 0, poly: line([[124, -38], [152, -38], [152, -8], [124, -8]]) },
    { id: 'brunnenplatz', name: 'Brunnenplatz', ground: 'cobbles', frontage: null, trees: 0.1, poly: line([[140, -70], [172, -70], [172, -38], [140, -38]]) },
    { id: 'badplatz', name: 'Badstraße', ground: 'cobbles', frontage: null, trees: 0, poly: line([[210, -90], [236, -90], [236, -62], [210, -62]]) },
    { id: 'vorplatz', name: 'Vor dem Beamtentor', ground: 'cobbles', frontage: null, trees: 0, poly: [[AEG.x1, AEG.z0], [266 * s, AEG.z0], [266 * s, BT.z + 16], [AEG.x1, BT.z + 16]] },
    { id: 'aeg', name: 'AEG-Werkhof', ground: 'cobbles', frontage: null, trees: 0, specials: [], poly: [[AEG.x0, AEG.z0], [AEG.x1, AEG.z0], [AEG.x1, AEG.z1 + 4], [AEG.x0, AEG.z1 + 4]] },
    { id: 'humboldthain', name: 'Humboldthain', ground: 'grass', frontage: null, trees: 0.35, poly: parkPoly },
    // The unbuilt corners: dark rubble ground, nothing placed, never in view.
    { id: 'brache-nord', name: 'Brache', ground: 'asphalt', frontage: null, trees: 0, poly: line([[-55, -105], [124, -105], [121, -40], [118, -36], [112, -36], [100, -24], [80, -24], [74, -30], [70, -64], [32, -88], [-20, -60], [-34, -78], [-55, -78]]) },
    { id: 'brache-sued', name: 'Brache', ground: 'asphalt', frontage: null, trees: 0, poly: [...line([[-55, 103], [60, 78], [113, 81], [141, 36], [150, 24]]), [parkNorth[0]![0], parkNorth[0]![1] + 6], [parkNorth[0]![0], AEG.z0], [AEG.x0, AEG.z0], [AEG.x0, 125 * s], [-55 * s, 125 * s]] },
    // The Kiez: Leopoldkiez west of the Panke, Gesundbrunnen east of it, both north of the Ringbahn.
    { id: 'leopoldkiez', name: 'Leopoldkiez', ground: 'asphalt', frontage: 'altbau', trees: 0.2, specials: ['hinterhof', 'baustelle'], poly: line([[-55, -78], [-34, -78], [-20, -60], [32, -88], [70, -64], [74, -30], [80, -24], [100, -24], [112, -36], [121, -36], [126, 14], [136, 30], [113, 67], [60, 65], [-55, 94]]) },
    { id: 'gesundbrunnen', name: 'Gesundbrunnen', ground: 'asphalt', frontage: 'altbau', trees: 0.2, specials: ['truemmer', 'parkplatz'], poly: [...line([[121, -105], [296, -105], [296, -60], [270, -56], [235, -48], [200, -32], [170, -4], [136, 30], [126, 14], [118, -30]])] },
    { id: 'brunnenstrasse', name: 'Brunnenstraße', ground: 'asphalt', frontage: 'altbau', trees: 0.2, specials: ['truemmer'], poly: [...line([[262.5, -56], [296, -60], [296, 125], [240, 125], [240, 76], [262.5, 76]])] },
  ];

  const endOf = (name: string, back: number, side: number): { x: number; z: number } => {
    const pts = streets.find((st) => st.name === name)!.pts, [ex, ez] = pts[pts.length - 1]!, [px, pz] = pts[pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
    const ux = (ex - px) / l, uz = (ez - pz) / l;
    return { x: ex - ux * back + uz * side, z: ez - uz * back - ux * side };
  };
  /** A barricade across the end of a street, its face toward the street. */
  const barricadeAt = (name: string, first: boolean, extra = 2): Prop => {
    const st = streets.find((q) => q.name === name)!, pts = first ? [...st.pts].reverse() : st.pts;
    const [ex, ez] = pts[pts.length - 1]!, [px, pz] = pts[pts.length - 2]!, l = Math.hypot(ex - px, ez - pz);
    return { kind: 'barricade', x: ex, z: ez, rot: Math.atan2(px - ex, pz - ez), size: st.width + 2 * (st.sidewalk ?? 0) + extra + 0 * l };
  };
  // The Müllerstraße arch at S Wedding: a barricade across the opening, face toward the street.
  const mArch = arch('Müllerstraße'), [mx, mz] = railOff(mArch.at, -RING.width / 2 + 0.4), md = dirAt(mArch.at);

  const lights: Prop[] = [];
  const inFight = (x: number, z: number, pad: number): boolean => encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + pad);
  // Two storm lanterns either side of the centre of every open-air fight.
  encounters.forEach((e, i) => {
    if (e.id === 'magendoktor') return;
    for (const k of [-4, 4]) lights.push({ kind: 'stormLantern', x: e.x + Math.sin(i * 2.3) * k, z: e.z + Math.cos(i * 2.3) * k, rot: 0, size: k > 0 ? 1.1 : 0.8 });
  });
  // E4 lampion chains across the route streets (every 20 to 30 m), denser on the market and in the AEG yard.
  const chains = (name: string, step: number, first: number, skip: (x: number, z: number) => boolean = () => false): void => {
    const st = streets.find((q) => q.name === name)!, half = st.width / 2 + (st.sidewalk ?? 0) - 0.3;
    let d = first, i = 0;
    for (let k = 1; k < st.pts.length; k++) {
      const [ax, az] = st.pts[k - 1]!, [bx, bz] = st.pts[k]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (; d < len - 3; d += step + ((i * 7) % 5) - 2, i++) {
        const x = ax + ux * d, z = az + uz * d;
        if (skip(x, z) || bridges.some((b) => Math.hypot(x - b.x, z - b.z) < b.len / 2 + 2)) continue;
        lights.push({ kind: 'lampions', x, z, rot: Math.atan2(ux, uz), size: half * 2 });
      }
      d -= len;
    }
  };
  chains('Müllerstraße', 24 * Math.sqrt(s), 10);
  chains('Schulstraße', 14 * Math.sqrt(s), 6);
  chains('Lindower Straße', 18 * Math.sqrt(s), 8);
  chains('Pankstraße', 24 * Math.sqrt(s), 8);
  chains('Badstraße', 22 * Math.sqrt(s), 8);
  chains('Brunnenstraße', 26 * Math.sqrt(s), 12, (x, z) => Math.abs(project(x, z).d) < RING.width);
  // Lanterns hung at the curbs for the feast (alternating sides, every 15 to 19 m), off the fights, the bridge and the
  // lampion poles: the route never goes dark between the chains.
  const curb = (name: string, step: number, first: number): void => {
    const st = streets.find((q) => q.name === name)!, off = st.width / 2 + 1.1;
    let d = first, i = 0;
    for (let k = 1; k < st.pts.length; k++) {
      const [ax, az] = st.pts[k - 1]!, [bx, bz] = st.pts[k]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (; d < len; d += step + ((i * 5) % 5) - 2, i++) {
        const o = (i % 2 ? 1 : -1) * off, x = ax + ux * d + uz * o, z = az + uz * d - ux * o;
        if (inFight(x, z, 0) || bridges.some((b) => Math.hypot(x - b.x, z - b.z) < b.len / 2) || lights.some((l) => Math.hypot(l.x - x, l.z - z) < 5)) continue;
        if (Math.abs(project(x, z).d) < RING.width / 2 + 1) continue;
        // Same kinds keep their gap (SAME_KIND_GAP): a lantern, else candles, else nothing here.
        const kind = (['stormLantern', 'candles'] as const).find((q) => !lights.some((l) => l.kind === q && Math.hypot(l.x - x, l.z - z) < 7.5));
        if (kind) lights.push({ kind, x, z, rot: i * 1.3, size: 0.6 + ((i * 29) % 9) / 10 });
      }
      d -= len;
    }
  };
  for (const st of streets) if (st.kind !== 'path') curb(st.name, (st.kind === 'main' ? 12 : 14) * Math.sqrt(s), 6);
  // Both heads of the Pankstraße bridge: a barrel on the quay each side.
  for (const k of [-1, 1]) {
    const b = bridges[0]!, ux = Math.sin(b.rot), uz = Math.cos(b.rot), d = k * (b.len / 2 + 2.5);
    lights.push({ kind: 'fireBarrel', x: b.x + ux * d + uz * (b.width / 2 - 1), z: b.z + uz * d - ux * (b.width / 2 - 1), rot: 0, size: 1 });
  }
  // Across the Nettelbeckplatz (the boss square in front of the pub): chains from the west row to the quay side.
  for (const dz of [-8, 0, 8, 16]) lights.push({ kind: 'lampions', x: 94 * s, z: 16 * s + dz, rot: 0, size: 35 });
  // Across the AEG yard and the Lange Tafel (the yard is no street: chains between the walls).
  for (let z = AEG.z0 + 8; z < HALL.z - HALLE.hz - 4; z += 9) lights.push({ kind: 'lampions', x: (AEG.x0 + AEG.x1) / 2 + 10, z, rot: 0, size: 40 });
  // Fires in the open arches (people living under the Ringbahn) and at the Panke quay.
  { const [x, z] = railOff(arch('Brunnenstraße').at, RING.width / 2 + 2); lights.push({ kind: 'fireBarrel', x: x - 8, z, rot: 0, size: 1 }); }
  // Lanterns and candles along the park paths, alternating sides, off the fights.
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
  verge(streets.find((q) => q.name === 'Humboldthain')!.pts, 11, 3, 3, ['stormLantern', 'candles', 'stormLantern', 'fireBarrel']);
  // Inside the hall: fires round the palace floor (the hall has no street, so it is lit by hand).
  for (const [dx, dz] of [[-24, -11], [24, -11], [-24, 11], [24, 11], [0, 14]] as const) lights.push({ kind: dz > 12 ? 'stormLantern' : 'fireBarrel', x: HALL.x + dx, z: HALL.z + dz, rot: 0, size: 1.1 });
  // The yard and the forecourt: work lamps by the gate, barrels by the tables.
  lights.push({ kind: 'workLamp', x: BT.x + 4, z: BT.z - 8, rot: -90 * DEG, size: 1 }, { kind: 'fireBarrel', x: AEG.x0 + 10, z: AEG.z0 + 10, rot: 0, size: 1 }, { kind: 'fireBarrel', x: AEG.x0 + 12, z: AEG.z0 + 34, rot: 0, size: 0.9 });

  // E7: the Lange Tafel (tables on the rim, two rows inside with gaps of 2.5 m every 6 m), market stalls on the
  // square's rim and at most four inside as cover, wedding cars as wrecks and in the barricades.
  const tafel = encounters.find((e) => e.id === 'langetafel')!, markt = encounters.find((e) => e.id === 'wochenmarkt')!;
  const yards: Prop[] = [];
  for (const row of [-4.5, 4.5]) for (const dx of [-10, -4, 2, 8]) yards.push({ kind: 'beerTable', x: tafel.x + dx, z: tafel.z + row, rot: 90 * DEG, size: 1 });
  for (let a = 0; a < 360; a += 30) yards.push({ kind: 'beerTable', x: tafel.x + Math.sin(a * DEG) * (tafel.r + 2.5), z: tafel.z + Math.cos(a * DEG) * (tafel.r + 2.5), rot: a * DEG + Math.PI / 2, size: 1 });
  for (let a = 0; a < 360; a += 36) if (Math.sin(a * DEG) < 0.5) yards.push({ kind: 'stall', x: markt.x + Math.sin(a * DEG) * (markt.r + 2.5), z: markt.z + Math.cos(a * DEG) * (markt.r + 2.5), rot: a * DEG + Math.PI, size: 1 });
  for (const [dx, dz, r] of [[-6, -4, 0.3], [5, -5, -0.2], [-4, 6, 0.1], [6, 4, 0.4]] as const) yards.push({ kind: 'stall', x: markt.x + dx, z: markt.z + dz, rot: r, size: 0.9 });
  // The Nettelbeckplatz (no fight): beer tables on its sides, parasols and a barrel table in front of the pub.
  for (const a of [70, 110, 250, 290]) yards.push({ kind: 'beerTable', x: 94 * s + Math.sin(a * DEG) * 17, z: 16 * s + Math.cos(a * DEG) * 17, rot: 90 * DEG, size: 1 });
  yards.push(
    // Street ends: the Müllerstraße at the Neubau's site fence, the Schulstraße and the Reinickendorfer Straße run into barricades; the arch at S Wedding is shut.
    barricadeAt('Müllerstraße', true), barricadeAt('Schulstraße', false), barricadeAt('Reinickendorfer Straße', true),
    { kind: 'barricade', x: mx, z: mz, rot: Math.atan2(-md.nx, -md.nz), size: mArch.w + 2 },
    { kind: 'workLamp', x: mx - md.nx * 3 + md.ux * 4, z: mz - md.nz * 3 + md.uz * 4, rot: Math.atan2(md.nx, md.nz), size: 1 },
    // Side passage dressing: the bunker cache with a work lamp, fences along the Hinterhof.
    { kind: 'crates', ...endOf('Bunkertür', 1.5, 0), rot: 0.4, size: 1.2 }, { kind: 'crate', ...endOf('Bunkertür', 3.5, 1.1), rot: 1, size: 1 },
    { kind: 'workLamp', ...endOf('Bunkertür', 4.5, -1.1), rot: -0.8, size: 1 },
    { kind: 'stormLantern', ...endOf('Hinterhof Müllerstraße', 3.5, 1.2), rot: 0, size: 1 },
    ...lane(streets.find((st) => st.name === 'Hinterhof Müllerstraße')!, 'fence'),
    // A wedding car in the arch barricade's light, one on the Badstraße square.
    { kind: 'car', x: mx - md.nx * 5 - md.ux * 3, z: mz - md.nz * 5 - md.uz * 3, rot: 0.6, size: 1 },
  );

  // The Neubau's building site and the Kiez blocks along the square's north side (Blockrand by hand: no street runs there).
  const handLots: NonNullable<MapDef['handLots']> = [];
  const row = (a: Pt, b: Pt, n: number, floors: number[], ruins: number[] = [], depth = 13): void => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, w = len / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * w, d = depth / 2, f = floors[i % floors.length]!;
      handLots.push({ kind: f === 0 ? 'shop' : 'altbau', x: a[0] + ux * t + uz * d, z: a[1] + uz * t - ux * d, rot: Math.atan2(-uz, ux), w: w - 0.1, d: depth, floors: f, block: true, ruin: ruins.includes(i) });
    }
  };
  /**
   * A hand row along piece `seg` of a street, from `t0` to `t1` meters along it, on its left (+1, the side left of the
   * street's direction) or right (−1) side, fronts on the sidewalk edge (thin stretches the generator leaves empty:
   * squares, fight circles and sights take the street fronts there).
   */
  const streetRow = (name: string, seg: number, t0: number, t1: number, side: 1 | -1, n: number, floors: number[], ruins: number[] = [], depth = 13): void => {
    const st = streets.find((q) => q.name === name)!, [ax, az] = st.pts[seg]!, [bx, bz] = st.pts[seg + 1]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const off = st.width / 2 + (st.sidewalk ?? 0) + 0.2, at = (t: number): Pt => [ax + ux * t * s + uz * off * side, az + uz * t * s - ux * off * side];
    // `row` builds on the left of its direction: run along the street for the left side, against it for the right.
    if (side > 0) row(at(t0), at(t1), n, floors, ruins, depth);
    else row(at(t1), at(t0), n, floors, ruins, depth);
  };
  row(P(-12, -46), P(34, -72), 3, [4, 3, 4], [1]);
  row(P(34, -72), P(60, -52), 2, [4, 3]);
  // The square's east side and the Nettelbeckplatz's west side close the Kiez block behind them.
  row(P(60, -52), P(28, 6), 4, [3, 4, 3, 4], [2]);
  row(P(76, 30), P(76, 2), 2, [3, 4]);
  // Thin stretches along the route (Johannes 2026-11-21): the Lindower Straße's north side up to the pub's forecourt,
  // the Pankstraße between the Brunnenplatz and the Badstraße, both sides of the Badstraße round its fight. Tall rows
  // away from the camera, shops and low houses on the camera side.
  streetRow('Lindower Straße', 0, 12, 34, 1, 2, [3, 4]);
  streetRow('Pankstraße', 3, 26, 47, 1, 2, [4, 3], [1]);
  streetRow('Pankstraße', 3, 29, 45, -1, 2, [0, 1], [], 9);
  streetRow('Badstraße', 0, 4, 16, -1, 1, [0], [], 9);
  streetRow('Badstraße', 1, 14, 29, 1, 1, [4]);
  // The Kiez south of the Müllerstraße backs onto the Ringbahn: low houses and shops with their backs to the viaduct.
  { const a = railOff(project(-48 * s, 94 * s).at, -RING.width / 2 - 1), b = railOff(project(44 * s, 72 * s).at, -RING.width / 2 - 1); row(a, b, 7, [1, 2, 1, 0, 2, 1, 1], [1, 4]); }

  // Same kinds keep their gap (SAME_KIND_GAP) across every hand-placed light: the later twin goes.
  const lit = lights.filter((p, i) => !lights.slice(0, i).some((q) => q.kind === p.kind && Math.hypot(q.x - p.x, q.z - p.z) < (SAME_KIND_GAP[p.kind] ?? 0)));

  return {
    id: 'wedding',
    name: 'Wedding',
    bounds,
    start: zones[0]!.entry,
    rivers,
    lakes: [],
    islands: [],
    bridges,
    streets,
    areas,
    defaultGround: 'asphalt',
    landmarks,
    encounters,
    zones,
    rail: null,
    hills: [{ name: 'Humboldthöhe', x: 208 * s, z: 8 * s, r: HOEHE.r, slope: HOEHE.slope * s, h: HOEHE.h } satisfies Hill],
    terraces: [],
    noSpawn: [areas.find((a) => a.id === 'brache-nord')!.poly, areas.find((a) => a.id === 'brache-sued')!.poly],
    district: 5,
    flavor: 'fest',
    strictLots: true,
    specialMax: { markt: 1, hinterhof: 2, baustelle: 1, truemmer: 2, parkplatz: 1 },
    viaducts,
    walls,
    handLots,
    hiddenSpots: [endOf('Hinterhof Müllerstraße', 1.2, 0)],
    guards: [
      ...kneipeGuards(kneipe),
    ],
    fixedProps: [...yards, ...lit],
    seed: 1913,
  };
}

/** Lots that belong to the unbuilt corners (none expected; for the tests). */
export function inBrache(m: MapDef, l: Pick<Lot, 'x' | 'z'>): boolean {
  return m.areas.some((a) => a.id.startsWith('brache') && pointIn(a.poly, l.x, l.z));
}
function pointIn(poly: readonly Pt[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!, [xj, zj] = poly[j]!;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
