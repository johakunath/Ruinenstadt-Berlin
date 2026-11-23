// M19/M20: the U-Bahn tunnels between the districts, one generator for every line. Layout B
// (Johannes, 2026-11-16): one curved line of about 420 m with five fights, three dead-end side
// passages (the hidden blessing in the first, then a cache of crates, then a sleeping mini-boss) and
// the generator platform where Der Schaffner waits. M20 (Johannes, 2026-11-18, mockup
// `docs/mockups/m20-tunnel-network.svg`) adds the 2D route A content from `js/ubahn.js`: a grating
// after each fight (`addGate`/`openGate`), the trader on the start platform (`TUN.npc`), a collapse
// with a maintenance bypass (RUBX/BYP), a flooded stretch (FLOOD, `P.wet`), the generator hold (GEN)
// and station name plates (`signTex`). Line 0 (S3) keeps the M19 positions; other lines get their own
// curve, mirrored side passages and a seeded order of the special stretches.
// Meters, +X towards the end station. Tunnel enemies carry +25 % life (2D rule).
import type { EncounterDef, Point, WaveDef, ZoneDef } from '../sim/level';
import { Rng } from '../sim/math';
import { ALEX_TIER, alexWaveTier } from './alexanderplatz';
import type { BossKind } from './enemies';
import { waveTier } from './koepenick';
import { XHAIN_TIER } from './xhain';
import { MITTE_TIER, mitteWaveTier } from './mitte';
import { charlottenburgWaveTier } from './charlottenburg';
import { LINES, stopName, tunnelName } from './lines';
import { TRAM_BOGIES, TRAM_HEAD_WIDTH, TRAM_WHEEL_OFFSET } from './tram';
import type { Prop } from './courtyard';
import { inTube, type MapDef, type Pt, type Tube, type TunnelGate } from './map';

/** Centre line of the S3 track bed (line 0): a gentle S-curve. */
export const tunnelZ = (x: number): number => 16 * Math.sin((Math.PI * (x - 40)) / 190);

export const TUNNEL = {
  /** 2D: tunnel enemies +25 % life. */
  hp: 1.25,
  trackWidth: 11,
  bypassWidth: 4,
  /** 2D `P.wet`: 0.7 walking speed in the flooded stretch, for the hero and for enemies on foot. */
  floodSlow: 0.7,
  /**
   * 2D GEN: ring 260 px (8.7 m at 30 px/m), 55 s of charge, one spawn every 1.6 to 2.4 s from the
   * tunnel mouth while the hero stands in the ring. 3D fights are denser and the walk is shorter: 35 s.
   */
  hold: { r: 8.5, need: 35, every: 2 },
  /** Gratings (2D TSEC `gate`): one after each of the five fights, clear of the fight circles, junctions and station ends. */
  gates: [116, 172, 288, 311, 372],
} as const;

/**
 * P43: the two tracks of the bed, shared by the rails (map-world) and the stopped train, so the
 * train's sixteen wheels stand on the rail heads. Offsets run along the segment normal (uz, -ux).
 */
export const TUNNEL_TRACK = {
  /** Track centres from the bed's centre line; the wreck train stands on the second (north) one. */
  tracks: [-2.6, 2.6],
  /** Rail centres from the track centre: the tram's wheel offset (1.435 m gauge between the inner faces). */
  rail: TRAM_WHEEL_OFFSET,
  headWidth: TRAM_HEAD_WIDTH,
  /** Rail height; the rails stand on the sleepers' base, their top is where the wheels stand. */
  railHeight: 0.14,
  railTop: 0.15,
  /** Half length of the straight under the train (the train's 15 m plus a margin; on a curve its wheels miss the rails). */
  trainHalf: 8,
} as const;

/** One rail piece per track segment: centre, yaw and length (a box of `headWidth` by `railHeight`, rails top at `railTop`). */
export function trackRails(pts: readonly Pt[]): { x: number; z: number; yaw: number; len: number; a: Pt; b: Pt }[] {
  const out: { x: number; z: number; yaw: number; len: number; a: Pt; b: Pt }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!, len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    for (const off of TUNNEL_TRACK.tracks) for (const r of [-TUNNEL_TRACK.rail, TUNNEL_TRACK.rail]) {
      const o = off + r;
      out.push({ x: (ax + bx) / 2 + uz * o, z: (az + bz) / 2 - ux * o, yaw: Math.atan2(ux, uz), len, a: [ax + uz * o, az - ux * o], b: [bx + uz * o, bz - ux * o] });
    }
  }
  return out;
}

/** Pose of the stopped train on a straight track segment a..b: centre on the north track, yaw along the segment. */
export function trackTrainPose(a: Pt, b: Pt): { x: number; z: number; rot: number } {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, o = TUNNEL_TRACK.tracks[1];
  // `at()` maps local z to (sin rot, cos rot): rot = atan2(ux, uz) runs the train along the track.
  return { x: (a[0] + b[0]) / 2 + uz * o, z: (a[1] + b[1]) / 2 - ux * o, rot: Math.atan2(ux, uz) };
}

/** The stopped train's footprint (`propCollider` 'tram': hx 1.15, hz 7.6). */
const TRAIN_HALF_WIDTH = 1.15;
const TRAIN_HALF_LENGTH = 7.6;

/**
 * B2 step 3 (playtest 2026-11-18: the tunnels were the district's kinds in larger numbers, mown down in the tube).
 * Fewer bodies and more kinds, each with a job: fast fodder (Hetzer, Zünder) reaches the hero first, a heavy line
 * (Brocken: slow, a marked blow to dodge) and a bulwark (Schildträger: the shield closes the tube, the hammer opens
 * it) come behind. Order of play: kill the fast ones, dodge the heavy blows, then break the line.
 */
export const TUNNEL_ROLES = { count: 0.7, maxAlive: 7, walker: 0.5, add: { runner: 1, zuender: 0.8, brute: 1.2, schild: 1 } } as const;
export function tunnelRoles(w: WaveDef): WaveDef {
  const mix = { ...w.mix, walker: (w.mix.walker ?? 0) * TUNNEL_ROLES.walker };
  for (const [k, v] of Object.entries(TUNNEL_ROLES.add) as Array<[keyof typeof TUNNEL_ROLES.add, number]>) mix[k] = (mix[k] ?? 0) + v;
  return { ...w, mix, count: Math.max(3, Math.round(w.count * TUNNEL_ROLES.count)), maxAlive: Math.min(w.maxAlive, TUNNEL_ROLES.maxAlive) };
}

export type Stretch = 'collapse' | 'flood' | 'wreck';
/** Free stretches between the fights that take the three special stretches (x ranges). The collapse fits only the first and the last. */
const SLOTS: ReadonlyArray<readonly [number, number]> = [[116, 152], [202, 236], [318, 350]];
const STRETCH_NAME: Record<Stretch, string> = { collapse: 'Einsturz', flood: 'Geflutete Strecke', wreck: 'Zugwrack' };
/**
 * Wave tiers and enemy mix per line. A tunnel starts where its start district's late waves were
 * (S3: Köpenick 14 … 19). 2D `tunSpecial`: the start district's own enemies come along. M15 step 8
 * (Johannes, 2026-11-19: recycle the tunnel, change names and enemy types): the U2 carries the
 * Alexanderplatz roster to the ghost station (no crows underground) and the Friedrichstraße roster of
 * Mitte after it, where the eras grind against each other (no drones). The S3 and the U8 keep the
 * Köpenick mix; the U8 starts at the Xhain late tier (Johannes, 2026-11-19: it was the S3's 14 … 19,
 * easier than Xhain itself).
 */
export interface LineWaves { from: number; to: number; wave: (g: number, zone: number, bosses?: BossKind[]) => WaveDef }
export function lineWaves(line: number): LineWaves {
  // M16 step 8: the U2 west brings Mitte's enemies to the ghost station, Charlottenburg's glass after it.
  if (line === 3) return { from: MITTE_TIER.to - 5, to: MITTE_TIER.to, wave: (g, zone, bosses = []) => (zone === 0 ? mitteWaveTier(g, bosses, 0) : charlottenburgWaveTier(g, bosses, 0)) };
  if (line === 2) return { from: ALEX_TIER.to - 5, to: ALEX_TIER.to, wave: (g, zone, bosses = []) => (zone === 0 ? alexWaveTier(g, bosses, 2) : mitteWaveTier(g, bosses, 0)) };
  const to = line === 1 ? XHAIN_TIER.to : 19;
  return { from: to - 5, to, wave: (g, _zone, bosses = []) => waveTier(g, bosses, 0) };
}

/**
 * Every line reuses the S3 tunnel as it is (Johannes, 2026-11-18: recycle it completely for now,
 * only the names follow the line). Kept as functions so a line can get its own shape later.
 */
export function lineCurve(_line: number): (x: number) => number {
  return tunnelZ;
}

/** Line layout: side of the passages and the order of the special stretches (the S3's for every line). */
export function lineLayout(_line: number): { side: 1 | -1; order: Stretch[] } {
  return { side: 1, order: ['collapse', 'flood', 'wreck'] };
}

/** The S3 tunnel (line 0) or the tunnel of another line from `LINES` (data only until its districts exist). */
export function tunnelMap(line = 0): MapDef {
  const L = LINES[line];
  if (!L) throw new Error(`no line ${line}`);
  const cz = lineCurve(line);
  const at = (x: number, off = 0): Pt => [x, cz(x) + off];
  const { side: s, order } = lineLayout(line);
  const slot = (k: Stretch): readonly [number, number] => SLOTS[order.indexOf(k)]!;

  const [wa, wb] = slot('wreck');
  const wx = wa + (wb - wa) * 0.625;
  // The train's bogies span 13 m: P43 keeps the track straight under it (one chord of the curve).
  const wh = TUNNEL_TRACK.trainHalf;
  if (wh < TRAM_BOGIES.at(-1)! + 1) throw new Error('train straight too short');
  const track: Pt[] = [];
  // Rails run from end wall to end wall (playtest 2026-11-18: they began 2 m inside the start station).
  track.push(at(-12));
  for (let x = -10; x <= 440; x += 10) {
    if (Math.abs(x - wx) <= wh + 2) continue;
    if (x > wx && track.at(-1)![0] < wx) track.push(at(wx - wh), at(wx + wh));
    track.push(at(x));
  }
  track.push(at(442));
  const tubes: Tube[] = [
    { kind: 'track', pts: track, width: TUNNEL.trackWidth },
    { kind: 'station', pts: [at(-12), at(34)], width: 22 },
    { kind: 'station', pts: [at(236), at(276)], width: 20 },
    { kind: 'station', pts: [at(392), at(442)], width: 24 },
    // Side passages (M19 B): blessing first (Johannes), then the cache, then the mini-boss. Mirrored on some lines.
    { kind: 'branch', pts: [at(62), [66, cz(62) - 18 * s], [70, cz(62) - 32 * s]], width: 5 },
    { kind: 'branch', pts: [at(196), [200, cz(196) + 16 * s], [206, cz(196) + 30 * s]], width: 6 },
    { kind: 'branch', pts: [at(316), [318, cz(316) - 18 * s], [314, cz(316) - 34 * s]], width: 6 },
    { kind: 'branch', pts: [[314, cz(316) - 30 * s], [314, cz(316) - 40 * s]], width: 11 },
  ];

  // Collapse (2D RUBX/BYP): rubble across the track bed, the maintenance passage beside it on the
  // north side (the camera looks north, so the passage is seen over its low divider wall).
  const [ca, cb] = slot('collapse');
  const bypass: Pt[] = [at(ca + 2, -2.5)];
  for (let x = ca + 7; x < cb - 7; x += 4) bypass.push(at(x, -8.5));
  bypass.push(at(cb - 7, -8.5), at(cb - 2, -2.5));
  tubes.push({ kind: 'bypass', pts: bypass, width: TUNNEL.bypassWidth });
  const along = (a: number, b: number, step: number): Pt[] => { const out: Pt[] = []; for (let x = a; x < b; x += step) out.push(at(x)); out.push(at(b)); return out; };
  const rubble = { pts: along(ca + 10, cb - 10, 2), width: 12 };
  const [fa, fb] = slot('flood');
  const flood = { pts: along(fa + 1, fb - 1, 2), width: TUNNEL.trackWidth - 0.2, slow: TUNNEL.floodSlow };

  const W = lineWaves(line);
  let g = W.from;
  const tier = (zone: number): WaveDef => { const w = W.wave(Math.min(W.to, g++), zone); return tunnelRoles({ ...w, hpMul: w.hpMul * TUNNEL.hp }); };
  const enc = (id: string, name: string, zone: number, x: number, r: number, waves: number): EncounterDef => {
    const [ex, ez] = at(x);
    return { id, name, zone, x: ex, z: ez, r, waves: Array.from({ length: waves }, () => tier(zone)), heal: 0.3 };
  };
  const ghost = `Geisterbahnhof ${L.ghost}`;
  const from = stopName(line), to = stopName(line + 1);
  // Generator on the north platform of the end station; the hold ring takes the platform edge and the track.
  const [gx, gz] = at(412, -10);
  const [hx, hz] = at(412, -4);
  const [mx, mz] = at(437);
  const hold: EncounterDef = {
    id: 'generator', name: `Generator ${to}`, zone: 1, x: hx, z: hz, r: 13, heal: 1,
    hold: { r: TUNNEL.hold.r, need: TUNNEL.hold.need, every: TUNNEL.hold.every, mouth: { x: mx, z: mz } },
    waves: [tier(1), { ...W.wave(W.to, 1, ['schaffner']), count: 4, maxAlive: 4, elite: 0, hpMul: W.wave(W.to, 1).hpMul * TUNNEL.hp }],
  };
  const encounters: EncounterDef[] = [
    enc('mund', 'Tunnelmund', 0, 104, 9, 2),
    enc('kabel', line === 0 ? 'Kabelschacht' : STRETCH_NAME[order[0]!], 0, 160, 9, 3),
    enc('geister', ghost, 1, 256, 12, 3),
    enc('kehr', 'Kehrgleis', 1, 300, 9, 3),
    enc('wrack', line === 0 ? 'Zugwrack' : STRETCH_NAME[order[2]!], 1, 360, 9, 3),
    hold,
  ];
  const zones: ZoneDef[] = [
    { id: 'tunnel', name: tunnelName(line), entry: { x: at(10)[0], z: at(10)[1] } },
    { id: 'geisterbahnhof', name: ghost, entry: { x: at(232)[0], z: at(232)[1] } },
  ];

  const inTubes = (x: number, z: number): boolean => tubes.some((t) => inTube(t, x, z));
  // A grating closes the whole cross-section: march out along the normal until the rock.
  const gates: TunnelGate[] = TUNNEL.gates.map((x, after) => {
    const dz = cz(x + 0.5) - cz(x - 0.5), l = Math.hypot(1, dz), ux = 1 / l, uz = dz / l;
    const [px, pz] = at(x);
    let half = 0;
    for (const sd of [-1, 1]) {
      let d = 0;
      while (d < 20 && inTubes(px - uz * sd * (d + 0.25), pz + ux * sd * (d + 0.25))) d += 0.25;
      half = Math.max(half, d);
    }
    return { x: px, z: pz, rot: Math.atan2(ux, uz), half: half + 0.6, after };
  });

  // Name plates on the north walls (the camera looks at them): start, ghost and end station.
  const signs: Array<{ x: number; z: number; rot: number; text: string }> = [];
  const walls = tunnelWalls(tubes);
  for (const [i, text] of [from, L.ghost, to].entries()) {
    const t = tubes[1 + i]!, [a, b] = t.pts as [Pt, Pt];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    // Wall normal on the north side (towards -z) and the plate facing back into the hall.
    const nx = uz, nz = -ux;
    for (const k of [0.18, 0.5, 0.82]) {
      const d = len * k;
      // In front of the wall face where it swells most behind the 2.95 m plate (it was half buried in the bumps).
      const bump = Math.max(0, ...walls.filter((w) => w.tube === 1 + i && w.side === 1 && Math.abs((w.x - a[0]) * ux + (w.z - a[1]) * uz - d) < 2).map((w) => w.bump));
      const off = t.width / 2 - bump - 0.06;
      signs.push({ x: a[0] + ux * d + nx * off, z: a[1] + uz * d + nz * off, rot: Math.atan2(-nx, -nz), text });
    }
  }

  const fixedProps: Prop[] = [];
  // The cache: three crates at the end of the second passage (every crate breaks and drops).
  // 1.3 m in from the flat end wall (the crates stood half in it).
  const kl = Math.hypot(6, 14), [kx, kz] = [206 - (6 / kl) * 1.3, cz(196) + (30 - (14 / kl) * 1.3) * s];
  fixedProps.push({ kind: 'crates', x: kx, z: kz, rot: 0.3, size: 1.2 }, { kind: 'crate', x: kx - 1.6, z: kz - 1.2 * s, rot: 0.8, size: 1 }, { kind: 'crate', x: kx + 1.5, z: kz - 1.4 * s, rot: -0.4, size: 1 });
  // A stopped train in the wreck stretch (left track), campfires in the stations.
  const train = trackTrainPose(at(wx - wh), at(wx + wh));
  fixedProps.push({ kind: 'tram', ...train, size: 1, railTop: TUNNEL_TRACK.railTop });
  // B2 step 2: close the crevice between the train and the outer wall (local +x is away from the centre line).
  const inner = -TRAIN_HALF_WIDTH, outer = TUNNEL.trackWidth / 2 - TUNNEL_TRACK.tracks[1] + 1.5, mid = (inner + outer) / 2;
  const wreck = { x: train.x + Math.cos(train.rot) * mid, z: train.z - Math.sin(train.rot) * mid, rot: train.rot, hx: (outer - inner) / 2, hz: TRAIN_HALF_LENGTH };
  fixedProps.push({ kind: 'campfire', x: at(14)[0], z: at(14, -7)[1], rot: 0, size: 1 }, { kind: 'campfire', x: at(256)[0], z: at(256, 7)[1], rot: 0, size: 1 });
  // The collapse: rubble heaps and fallen ceiling slabs and girders across the track bed (they stay inside the blocked band).
  const rr = new Rng(5151);
  for (let x = ca + 8, k = 0; x <= cb - 8; x += 2.6, k++) {
    const off = [0, 2.8, -2.8][k % 3]!;
    fixedProps.push({ kind: 'rubble', x, z: cz(x) + off + rr.range(-0.3, 0.3), rot: rr.range(0, 6.28), size: rr.range(2.2, 2.9) });
  }
  for (const x of [ca + 5, cb - 5]) fixedProps.push({ kind: 'rubble', x, z: cz(x), rot: rr.range(0, 6.28), size: 1.4 });
  for (let x = ca + 10; x <= cb - 10; x += 7) {
    fixedProps.push({ kind: rr.next() < 0.5 ? 'slab' : 'girder', x: x + rr.range(-1, 1), z: cz(x) + rr.range(-2, 2), rot: rr.range(0, 6.28), size: 1 });
  }

  const hidden: Point = { x: 70, z: cz(62) - 31 * s };
  return {
    // A repeated badge gets the line index (U2 west: `tunnel-u2-3`), so Funde and saves never mix the two.
    id: `tunnel-${L.id.toLowerCase()}${LINES.findIndex((q) => q.id === L.id) !== line ? `-${line}` : ''}`,
    name: tunnelName(line),
    bounds: { minX: -30, maxX: 460, minZ: -70, maxZ: 70 },
    start: zones[0]!.entry,
    rivers: [], lakes: [], islands: [], bridges: [], streets: [],
    areas: [{ id: 'tunnel', name: tunnelName(line), poly: [[-30, -70], [460, -70], [460, 70], [-30, 70]], ground: 'asphalt', frontage: null, trees: 0 }],
    defaultGround: 'asphalt',
    landmarks: [],
    encounters,
    zones,
    rail: null,
    hills: [],
    terraces: [],
    fixedProps,
    tunnel: {
      tubes, line, color: L.color, gates, rubble, flood,
      trader: { x: at(4)[0], z: at(4, -8.6)[1] },
      // Long side along the platform edge, front towards the track.
      generator: { x: gx, z: gz, rot: Math.atan2(-(cz(413) - cz(411)) / 2, 1) },
      wreck,
      signs,
    },
    hiddenSpots: [hidden],
    // Three metres in from the flat end wall of the room.
    guards: [{ x: 314, z: cz(316) - 37 * s, kind: 'brute', elite: true, wake: 9, hp: 2.6 * TUNNEL.hp }],
    district: 0,
    strength: line,
    seed: 3030,
  };
}

/** Route checks for tests: every fight lies inside the tube. */
export const TUNNEL_TRACK_WIDTH = TUNNEL.trackWidth;

/**
 * One piece of tunnel wall (playtest 2026-11-20: walls and the walk grid disagreed at station ends,
 * side passage ends and the room off the last passage). Walls stand exactly where the walkable tubes
 * (`inTube`, flat ends) meet rock, so the render (`map-world` buildTunnel) and the walk grid come from
 * the same tubes. Side pieces are at most 1 m long; end walls one piece per closed run.
 */
export interface TunnelWall {
  /** Index into `tubes` and its kind. */
  tube: number;
  kind: Tube['kind'];
  /** Side wall: 1 on the left of the run (north for a run towards +x), -1 on the right; 0: end wall. */
  side: -1 | 0 | 1;
  /** Fills the wedge on the outer side of a bend (no dressing). */
  fill: boolean;
  /** End wall: the run closes the whole end (rubble and planks go there). */
  whole: boolean;
  /** Centre of the face on the tube edge, the unit direction along the face and its length. */
  x: number; z: number; ux: number; uz: number; len: number;
  /** Outward normal (into the rock). */
  nx: number; nz: number;
  /** Depth into the rock: up to 12 m on the sides, 3 m at the ends, half the gap when another tube is near. */
  thick: number;
  /** A low divider (less than 2.5 m of rock to the next tube): the camera sees over it. */
  low: boolean;
  /** The thickness ends at another tube. */
  shared: boolean;
  /** Side pieces: metres of this tube kind and side built before, 1-based (ribs, niches, lamps). */
  run: number;
  /** How far the face swells into the tube (playtest 2026-11-18 uneven walls); 0 on low dividers, ends and fills. */
  bump: number;
}

/** Sample spacing along a face, and how far off the face the inside and outside are tested. */
const WALL_STEP = 0.1, WALL_EPS = 0.05;

/** Every tunnel wall piece of these tubes, in a fixed order (tube, segment, side, metre; then ends, then fills). */
export function tunnelWalls(tubes: readonly Tube[]): TunnelWall[] {
  const inside = (x: number, z: number): boolean => tubes.some((t) => inTube(t, x, z));
  const owner = (x: number, z: number): number => tubes.findIndex((t) => inTube(t, x, z));
  // A face sample is wall when rock lies just beyond it and its own tube is the first one just inside
  // (where two tubes share an edge, as the track and a station at the end wall, the earlier one builds it).
  const edge = (ti: number, x: number, z: number, nx: number, nz: number): boolean =>
    !inside(x + nx * WALL_EPS, z + nz * WALL_EPS) && owner(x - nx * WALL_EPS, z - nz * WALL_EPS) === ti;
  /** Rock depth behind the face points (the least of them), up to `max`; half the gap when a tube lies behind. */
  const depth = (ps: ReadonlyArray<readonly [number, number]>, nx: number, nz: number, max: number): { thick: number; shared: boolean } => {
    let d = max;
    for (const [x, z] of ps) {
      let k = 0.5;
      while (k < d && !inside(x + nx * k, z + nz * k)) k += 0.5;
      if (k >= d) continue;
      // Refine to 2 cm.
      let lo = k - 0.5;
      while (k - lo > 0.02) { const mid = (lo + k) / 2; if (inside(x + nx * mid, z + nz * mid)) k = mid; else lo = mid; }
      d = lo;
    }
    return d < max ? { thick: Math.max(0.04, d / 2), shared: true } : { thick: max, shared: false };
  };
  /** Contiguous runs of true flags as [first, last] index pairs. */
  const runs = (flags: boolean[]): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    flags.forEach((f, k) => { if (!f) return; const r = out.at(-1); if (r && r[1] === k - 1) r[1] = k; else out.push([k, k]); });
    return out;
  };
  const out: TunnelWall[] = [];
  const counter = new Map<string, number>();
  const LOW = 2.5;
  const bumpOf = (run: number, side: number, width: number, low: boolean): number => {
    const u = run + side * 37 + width * 3;
    return low ? 0 : 0.15 + 0.1 * Math.sin(u * 0.43) + 0.05 * Math.sin(u * 1.9 + 1.3);
  };
  tubes.forEach((t, ti) => {
    const r = t.width / 2;
    for (let i = 1; i < t.pts.length; i++) {
      const [ax, az] = t.pts[i - 1]!, [bx, bz] = t.pts[i]!, len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      for (const side of [-1, 1] as const) {
        const nx = uz * side, nz = -ux * side;
        for (let d = 0; d < len; d += 1) {
          const l = Math.min(1, len - d);
          if (l < 0.01) continue;
          const K = Math.max(1, Math.round(l / WALL_STEP));
          const at = (s: number): [number, number] => [ax + ux * s + nx * r, az + uz * s + nz * r];
          const flags = Array.from({ length: K }, (_, k) => { const [x, z] = at(d + ((k + 0.5) * l) / K); return edge(ti, x, z, nx, nz); });
          for (const [k0, k1] of runs(flags)) {
            const s0 = d + (k0 * l) / K, s1 = d + ((k1 + 1) * l) / K, sm = (s0 + s1) / 2;
            const { thick, shared } = depth([at(Math.min(sm, s0 + 0.05)), at(sm), at(Math.max(sm, s1 - 0.05))], nx, nz, 12);
            const key = `${t.kind}${side}`, run = (counter.get(key) ?? 0) + 1;
            counter.set(key, run);
            const low = thick < LOW;
            const [x, z] = at(sm);
            out.push({ tube: ti, kind: t.kind, side, fill: false, whole: false, x, z, ux, uz, len: s1 - s0, nx, nz, thick, low, shared, run, bump: bumpOf(run, side, t.width, low) });
          }
        }
      }
    }
    // End walls: across the flat end, where rock lies beyond it.
    for (const [end, prev] of [[t.pts[0]!, t.pts[1]!], [t.pts.at(-1)!, t.pts.at(-2)!]] as Array<[Pt, Pt]>) {
      const len = Math.hypot(end[0] - prev[0], end[1] - prev[1]);
      if (len < 0.01) continue;
      const nx = (end[0] - prev[0]) / len, nz = (end[1] - prev[1]) / len, px = nz, pz = -nx;
      const K = Math.max(1, Math.round(t.width / WALL_STEP)), step = t.width / K;
      const at = (a: number): [number, number] => [end[0] + px * a, end[1] + pz * a];
      const flags = Array.from({ length: K }, (_, k) => { const [x, z] = at(-r + (k + 0.5) * step); return edge(ti, x, z, nx, nz); });
      for (const [k0, k1] of runs(flags)) {
        let a0 = -r + k0 * step, a1 = -r + (k1 + 1) * step;
        const whole = k0 === 0 && k1 === K - 1;
        // Round the corner into the side wall's rock (half a metre past the tube edge).
        const rock = (a: number): boolean => { const [x, z] = at(a); return !inside(x + nx * WALL_EPS, z + nz * WALL_EPS) && !inside(x - nx * WALL_EPS, z - nz * WALL_EPS); };
        if (k0 === 0 && rock(-r - 0.25)) a0 -= 0.5;
        if (k1 === K - 1 && rock(r + 0.25)) a1 += 0.5;
        const ps: Array<[number, number]> = [];
        for (let a = Math.max(a0, -r) + 0.05; a < Math.min(a1, r); a += 0.5) ps.push(at(a));
        ps.push(at(Math.min(a1, r) - 0.05));
        const { thick, shared } = depth(ps, nx, nz, 3);
        const [x, z] = at((a0 + a1) / 2);
        out.push({ tube: ti, kind: t.kind, side: 0, fill: false, whole, x, z, ux: px, uz: pz, len: a1 - a0, nx, nz, thick, low: thick < LOW, shared, run: 0, bump: 0 });
      }
    }
    // Bends: the outer side's faces part by r × angle; a piece on the bisector closes the wedge.
    for (let i = 1; i < t.pts.length - 1; i++) {
      const [jx, jz] = t.pts[i]!, [px, pz] = t.pts[i - 1]!, [qx, qz] = t.pts[i + 1]!;
      const la = Math.hypot(jx - px, jz - pz), lb = Math.hypot(qx - jx, qz - jz);
      if (la < 0.01 || lb < 0.01) continue;
      const ax = (jx - px) / la, az = (jz - pz) / la, bx = (qx - jx) / lb, bz = (qz - jz) / lb;
      const ang = Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz)));
      if (ang * r < 0.02) continue;
      // Outer side: the incoming normal points away from where the run turns.
      const side = (az * bx - ax * bz) * 1 < 0 ? 1 : -1;
      let nx = az * side + bz * side, nz = -ax * side - bx * side;
      const nl = Math.hypot(nx, nz);
      nx /= nl; nz /= nl;
      const x = jx + nx * r, z = jz + nz * r;
      if (!edge(ti, x - nx * 0.01, z - nz * 0.01, nx, nz)) continue;
      const len = 2 * r * Math.tan(ang / 2) + 0.06, ux = -nz * side, uz = nx * side;
      const { thick, shared } = depth([[x, z]], nx, nz, 12);
      out.push({ tube: ti, kind: t.kind, side, fill: true, whole: false, x, z, ux, uz, len, nx, nz, thick, low: thick < LOW, shared, run: 0, bump: 0 });
    }
  });
  return out;
}
