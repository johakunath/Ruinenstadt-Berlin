// M19: the S3 tunnel from S Köpenick towards Warschauer Straße, layout B (Johannes, 2026-11-16):
// one curved line of about 420 m with five fights, three dead-end side passages (the hidden blessing
// in the first, then a cache of crates, then a sleeping mini-boss) and the generator platform where
// Der Schaffner waits. 2D source: `js/ubahn.js` (route A, sections, Der Schaffner at the generator).
// Meters, +X towards Warschauer Straße. Tunnel enemies carry +25 % life (2D rule).
import type { EncounterDef, WaveDef, ZoneDef } from '../sim/level';
import { waveTier } from './koepenick';
import type { MapDef, Pt, Tube } from './map';

/** Centre line of the track bed: a gentle S-curve. */
export const tunnelZ = (x: number): number => 16 * Math.sin((Math.PI * (x - 40)) / 190);
const at = (x: number, off = 0): Pt => [x, tunnelZ(x) + off];
const TUNNEL_HP = 1.25;
/** The tunnel follows Köpenick: its waves start where the district's late waves were. */
const G0 = 14;

export function tunnelMap(): MapDef {
  const track: Pt[] = [];
  for (let x = -10; x <= 440; x += 10) track.push(at(x));
  const tubes: Tube[] = [
    { kind: 'track', pts: track, width: 11 },
    { kind: 'station', pts: [at(-12), at(34)], width: 22 },
    { kind: 'station', pts: [at(236), at(276)], width: 20 },
    { kind: 'station', pts: [at(392), at(442)], width: 24 },
    // Side passages (M19 B): blessing first (Johannes), then the cache, then the mini-boss.
    { kind: 'branch', pts: [at(62), [66, tunnelZ(62) - 18], [70, tunnelZ(62) - 32]], width: 5 },
    { kind: 'branch', pts: [at(196), [200, tunnelZ(196) + 16], [206, tunnelZ(196) + 30]], width: 6 },
    { kind: 'branch', pts: [at(316), [318, tunnelZ(316) - 18], [314, tunnelZ(316) - 34]], width: 6 },
    { kind: 'branch', pts: [[314, tunnelZ(316) - 30], [314, tunnelZ(316) - 40]], width: 11 },
  ];
  let g = G0;
  const tier = (): WaveDef => { const w = waveTier(Math.min(19, g++), [], 0); return { ...w, hpMul: w.hpMul * TUNNEL_HP }; };
  const enc = (id: string, name: string, zone: number, x: number, r: number, waves: number): EncounterDef => {
    const [ex, ez] = at(x);
    return { id, name, zone, x: ex, z: ez, r, waves: Array.from({ length: waves }, tier), heal: 0.3 };
  };
  const [bx, bz] = at(412);
  const boss: EncounterDef = {
    id: 'generator', name: 'Generator Warschauer Straße', zone: 1, x: bx, z: bz, r: 13, heal: 1,
    waves: [tier(), { ...waveTier(19, ['schaffner'], 0), count: 4, maxAlive: 4, elite: 0, hpMul: waveTier(19).hpMul * TUNNEL_HP }],
  };
  const encounters: EncounterDef[] = [
    enc('mund', 'Tunnelmund', 0, 104, 9, 2),
    enc('kabel', 'Kabelschacht', 0, 160, 9, 3),
    enc('geister', 'Geisterbahnhof Rummelsburg', 1, 256, 12, 3),
    enc('kehr', 'Kehrgleis', 1, 300, 9, 3),
    enc('wrack', 'Zugwrack', 1, 360, 9, 3),
    boss,
  ];
  const zones: ZoneDef[] = [
    { id: 'tunnel', name: 'S3-Tunnel', entry: { x: at(10)[0], z: at(10)[1] } },
    { id: 'geisterbahnhof', name: 'Geisterbahnhof Rummelsburg', entry: { x: at(232)[0], z: at(232)[1] } },
  ];
  const [cx, cz] = [206, tunnelZ(196) + 30];
  const [wx, wz] = at(338);
  return {
    id: 'tunnel-s3',
    name: 'S3-Tunnel',
    bounds: { minX: -30, maxX: 460, minZ: -70, maxZ: 70 },
    start: zones[0]!.entry,
    rivers: [], lakes: [], islands: [], bridges: [], streets: [],
    areas: [{ id: 'tunnel', name: 'S3-Tunnel', poly: [[-30, -70], [460, -70], [460, 70], [-30, 70]], ground: 'asphalt', frontage: null, trees: 0 }],
    defaultGround: 'asphalt',
    landmarks: [],
    encounters,
    zones,
    rail: null,
    hills: [],
    terraces: [],
    fixedProps: [
      // The cache: three crates at the end of the second passage (every crate breaks and drops).
      { kind: 'crates', x: cx, z: cz, rot: 0.3, size: 1.2 }, { kind: 'crate', x: cx - 1.6, z: cz - 1.2, rot: 0.8, size: 1 }, { kind: 'crate', x: cx + 1.5, z: cz - 1.4, rot: -0.4, size: 1 },
      // A stopped train in the wreck section (left track), campfires in the stations.
      { kind: 'tram', x: wx, z: wz - 2.4, rot: Math.PI / 2 + Math.atan2(tunnelZ(345) - tunnelZ(331), 14), size: 1 },
      { kind: 'campfire', x: at(14)[0], z: at(14, -7)[1], rot: 0, size: 1 },
      { kind: 'campfire', x: at(256)[0], z: at(256, 7)[1], rot: 0, size: 1 },
    ],
    tunnel: { tubes },
    hiddenSpots: [{ x: 70, z: tunnelZ(62) - 31 }],
    guards: [{ x: 314, z: tunnelZ(316) - 40, kind: 'brute', elite: true, wake: 9, hp: 2.6 * TUNNEL_HP }],
    district: 0,
    seed: 3030,
  };
}

/** Route checks for tests: every fight lies inside the tube. */
export const TUNNEL_TRACK_WIDTH = 11;
