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
import { mitteWaveTier } from './mitte';
import { LINES, stopName } from './lines';
import type { Prop } from './courtyard';
import { lineDist, type MapDef, type Pt, type Tube, type TunnelGate } from './map';

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

  const track: Pt[] = [];
  // Rails run from end wall to end wall (playtest 2026-11-18: they began 2 m inside the start station).
  track.push(at(-12));
  for (let x = -10; x <= 440; x += 10) track.push(at(x));
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
  const [wa, wb] = slot('wreck');
  const wx = wa + (wb - wa) * 0.625;

  const W = lineWaves(line);
  let g = W.from;
  const tier = (zone: number): WaveDef => { const w = W.wave(Math.min(W.to, g++), zone); return { ...w, hpMul: w.hpMul * TUNNEL.hp }; };
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
    { id: 'tunnel', name: `${L.id}-Tunnel`, entry: { x: at(10)[0], z: at(10)[1] } },
    { id: 'geisterbahnhof', name: ghost, entry: { x: at(232)[0], z: at(232)[1] } },
  ];

  const inTubes = (x: number, z: number): boolean => tubes.some((t) => lineDist(t.pts, x, z) <= t.width / 2);
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
  for (const [i, text] of [from, L.ghost, to].entries()) {
    const t = tubes[1 + i]!, [a, b] = t.pts as [Pt, Pt];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    // Wall normal on the north side (towards -z) and the plate facing back into the hall.
    const nx = uz, nz = -ux, off = t.width / 2 - 0.06;
    for (const k of [0.18, 0.5, 0.82]) {
      const d = len * k;
      signs.push({ x: a[0] + ux * d + nx * off, z: a[1] + uz * d + nz * off, rot: Math.atan2(-nx, -nz), text });
    }
  }

  const fixedProps: Prop[] = [];
  // The cache: three crates at the end of the second passage (every crate breaks and drops).
  const [kx, kz] = [206, cz(196) + 30 * s];
  fixedProps.push({ kind: 'crates', x: kx, z: kz, rot: 0.3, size: 1.2 }, { kind: 'crate', x: kx - 1.6, z: kz - 1.2 * s, rot: 0.8, size: 1 }, { kind: 'crate', x: kx + 1.5, z: kz - 1.4 * s, rot: -0.4, size: 1 });
  // A stopped train in the wreck stretch (left track), campfires in the stations.
  fixedProps.push({ kind: 'tram', x: wx, z: cz(wx) - 2.4, rot: Math.PI / 2 + Math.atan2(cz(wx + 7) - cz(wx - 7), 14), size: 1 });
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
    id: `tunnel-${L.id.toLowerCase()}`,
    name: `${L.id}-Tunnel`,
    bounds: { minX: -30, maxX: 460, minZ: -70, maxZ: 70 },
    start: zones[0]!.entry,
    rivers: [], lakes: [], islands: [], bridges: [], streets: [],
    areas: [{ id: 'tunnel', name: `${L.id}-Tunnel`, poly: [[-30, -70], [460, -70], [460, 70], [-30, 70]], ground: 'asphalt', frontage: null, trees: 0 }],
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
      signs,
    },
    hiddenSpots: [hidden],
    guards: [{ x: 314, z: cz(316) - 40 * s, kind: 'brute', elite: true, wake: 9, hp: 2.6 * TUNNEL.hp }],
    district: 0,
    seed: 3030,
  };
}

/** Route checks for tests: every fight lies inside the tube. */
export const TUNNEL_TRACK_WIDTH = TUNNEL.trackWidth;
