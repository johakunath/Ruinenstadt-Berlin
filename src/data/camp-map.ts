// M20: the walkable camp at S+U Warschauer Straße, layout A+C (Johannes, 2026-11-18,
// `docs/mockups/m20-camp-combined.svg`). 2D source: `buildBase` in `js/ubahn.js` (platform hall
// with the train, old toilets as Lazarett, station bakery as Imbiss, places entered through rings,
// the train leaves for the network map). New in 3D: wide stairs up to an open track yard (+3 m)
// under the Warschauer Brücke with the Zeughaus in a freight car, the Hackerspace in a bridge arch,
// the Kommandantur in the signal box, the Exerzierplatz and the campfire.
// Meters, +X east, +Z south (toward the camera). Walls that face the camera stay low (2D cutaway rule).
import type { StationId } from './camp';
import type { Prop } from './courtyard';
import type { MapDef, Pt } from './map';

/** Hall floor 0, yard floor at YARD_H. */
export const YARD_H = 3;
/** The loading ramp in the north of the yard (signal box), 1.5 m above the yard. */
export const RAMP_H = YARD_H + 1.5;

/** Where a station stands: footprint center, facing (toward the hero's ring), size. */
export interface StationSpot { id: StationId; x: number; z: number; rot: number; w: number; d: number; inside: boolean; /** Floor height when it is not the hall (0) or the yard (YARD_H). */ y?: number }
/** A ring that opens something when the hero stands in it. */
export interface CampPlace { id: StationId | 'abfahrt'; x: number; z: number; r: number }
export interface CampLayout {
  /** Walkable floor: everything outside these polygons is solid (rock, walls). */
  floor: Pt[][];
  /** Wall colliders (boxes, half extents) with their drawn height. */
  walls: Array<{ x: number; z: number; hx: number; hz: number; h: number; kind: 'tile' | 'low' | 'glass' | 'column' }>;
  stations: StationSpot[];
  places: CampPlace[];
  /** The train on the hall track (the departure). */
  train: { x: number; z: number; len: number };
  /** Railway viaduct along the north edge of the yard: its arch face (z), deck height above the yard, the arches (x ranges). */
  viaduct: { z: number; h: number; arches: Array<readonly [number, number]> };
}

// Facing θ means direction (sin θ, cos θ): 0 faces +Z (south, toward the camera and the ring).

export const CAMP_LAYOUT: CampLayout = {
  floor: [
    // Hall platform (the track bed north of it is the train's).
    [[0.5, 16], [34, 16], [34, 30.4], [0.5, 30.4]],
    // Lazarett (old toilets) and the Hackerspace (in the old bakery) behind the low partition.
    [[1, 30], [14, 30], [14, 43], [1, 43]],
    [[15, 30], [27, 30], [27, 41], [15, 41]],
    // Stairs up to the yard.
    [[33.5, 19], [43.5, 19], [43.5, 29], [33.5, 29]],
    // Yard (+3 m) south of the viaduct, the cutting wall on the east.
    [[43, 6], [74, 6], [74, 46], [43, 46]],
    // The Imbiss in a viaduct arch.
    [[46, 2.5], [54, 2.5], [54, 6.5], [46, 6.5]],
  ],
  walls: [
    // Hall north wall behind the track (tiled, tall: it is far from the camera).
    { x: 17, z: 5.5, hx: 17.5, hz: 0.5, h: 5.2, kind: 'tile' },
    // Track bed edge: the platform drops to the track (blocks; drawn as the yellow edge).
    { x: 17.25, z: 15.6, hx: 16.75, hz: 0.4, h: 0.05, kind: 'low' },
    // Hall west end beside the tunnel mouth, hall east wall north and south of the stairs.
    { x: 0, z: 23, hx: 0.5, hz: 7.5, h: 5.2, kind: 'tile' },
    { x: 34.2, z: 11, hx: 0.6, hz: 8, h: 5.2, kind: 'tile' },
    // Partition hall / rooms: low tiled half walls with door gaps (Lazarett door 5–9, shop window 15.5–24.5, door 24.5–27).
    { x: 3, z: 30.5, hx: 2, hz: 0.25, h: 1.2, kind: 'low' },
    { x: 11.5, z: 30.5, hx: 2.5, hz: 0.25, h: 1.2, kind: 'low' },
    { x: 14.5, z: 36.5, hx: 0.4, hz: 6.5, h: 2.6, kind: 'tile' },
    { x: 20, z: 30.5, hx: 4.5, hz: 0.25, h: 1.1, kind: 'glass' },
    { x: 30.5, z: 30.5, hx: 3.5, hz: 0.25, h: 1.2, kind: 'low' },
    // Green iron columns along the platform middle.
    { x: 5, z: 21.6, hx: 0.25, hz: 0.25, h: 5.4, kind: 'column' },
    { x: 13, z: 21.6, hx: 0.25, hz: 0.25, h: 5.4, kind: 'column' },
    { x: 30.5, z: 21.6, hx: 0.25, hz: 0.25, h: 5.4, kind: 'column' },
  ],
  stations: [
    { id: 'markt', x: 22, z: 20.5, rot: 0, w: 11, d: 4, inside: true },
    { id: 'laz', x: 7.5, z: 34, rot: 0, w: 10, d: 4, inside: true },
    // Johannes 2026-11-18: Hackerspace inside (old bakery), Imbiss outside in a viaduct arch, the
    // signal box on a raised loading ramp in the north, the freight car on the southern track.
    { id: 'hack', x: 21, z: 32.6, rot: 0, w: 10, d: 2.6, inside: true },
    { id: 'imbiss', x: 50, z: 4.6, rot: 0, w: 7.4, d: 3.4, inside: false },
    { id: 'kom', x: 62, z: 9.6, rot: 0, w: 7, d: 6, inside: false, y: RAMP_H },
    // The freight car's open side faces south, toward the camera and its ring (a ring north of it hid the hero behind the car).
    { id: 'zeug', x: 56.5, z: 40, rot: 0, w: 13, d: 5, inside: false },
    { id: 'exer', x: 62.5, z: 26, rot: -Math.PI / 2, w: 10, d: 7, inside: false },
  ],
  places: [
    { id: 'abfahrt', x: 12, z: 18.2, r: 1.8 },
    { id: 'markt', x: 22, z: 25.5, r: 1.8 },
    { id: 'laz', x: 7.5, z: 39, r: 1.8 },
    { id: 'hack', x: 21, z: 37, r: 1.8 },
    { id: 'imbiss', x: 50, z: 9.6, r: 1.8 },
    { id: 'kom', x: 62, z: 14, r: 1.4 },
    { id: 'zeug', x: 56.5, z: 44.5, r: 1.5 },
    { id: 'exer', x: 57.2, z: 26, r: 1.8 },
  ],
  train: { x: 15, z: 11, len: 22 },
  viaduct: { z: 6, h: 6.5, arches: [[36, 44], [46, 54], [56, 66], [68, 76]] },
};

/** Inside a camp floor polygon (walkable before walls and props). */
export function onCampFloor(c: CampLayout, x: number, z: number): boolean {
  return c.floor.some((p) => inside(p, x, z));
}
function inside(poly: readonly Pt[], x: number, z: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!, [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

const P = (kind: Prop['kind'], x: number, z: number, rot = 0, size = 1): Prop => ({ kind, x, z, rot, size });

export function campMap(): MapDef {
  const c = CAMP_LAYOUT;
  const props: Prop[] = [
    // Hall: the campfire's indoor sibling (a barrel by the train), lamps along the platform, the market's string lights.
    P('fireBarrel', 2.2, 29.4), P('workLamp', 30.5, 17.2, Math.PI), P('candles', 1.6, 17.2),
    P('stringLights', 22, 23.6, 0, 12),
    // Yard: campfire with benches, a fire barrel by the stairs top, string lights from the viaduct, lamps.
    P('campfire', 50.5, 23.5), P('bench', 50.5, 20.9, 0), P('bench', 47.9, 24.1, Math.PI / 2), P('bench', 53.1, 24.1, -Math.PI / 2),
    P('fireBarrel', 45, 19.5), P('lantern', 69, 33, 0, 1.1), P('lantern', 45, 31.5, 0, 0.9),
    P('stringLights', 52, 15.5, 0, 12),
    // Survivors' corner in the south-west of the yard: a shed, laundry, crates.
    P('shed', 46.4, 42.5, 0.2, 0.9), P('clothesline', 67.5, 43.5, 0.1), P('pallets', 45.2, 36.5, 0.6), P('planks', 69, 38, 1.2),
    // Rubble along the walls.
    P('rubble', 44.6, 8, 0, 1.1), P('rubble', 72.5, 44.5, 0, 1.3), P('rubble', 72.4, 9, 0, 1),
    P('sandbags', 43.9, 30.2, Math.PI / 2), P('sandbags', 43.9, 17.8, Math.PI / 2), P('sandbags', 59.2, 16.6, Math.PI / 2),
  ];
  const bounds = { minX: -6, maxX: 80, minZ: -8, maxZ: 52 };
  return {
    id: 'lager',
    name: 'S+U Warschauer Straße',
    bounds,
    start: { x: 3.5, z: 26 },
    rivers: [], lakes: [], islands: [], bridges: [], streets: [],
    areas: [
      { id: 'halle', name: 'Bahnsteighalle', poly: [[-6, -8], [34, -8], [34, 52], [-6, 52]], ground: 'cobbles', frontage: null, trees: 0 },
      { id: 'vorfeld', name: 'Gleisvorfeld', poly: [[34, -8], [80, -8], [80, 52], [34, 52]], ground: 'asphalt', frontage: null, trees: 0 },
    ],
    defaultGround: 'asphalt',
    landmarks: [],
    encounters: [],
    zones: [{ id: 'lager', name: 'S+U Warschauer Straße', entry: { x: 3.5, z: 26 } }],
    rail: null,
    hills: [],
    terraces: [
      { name: 'Gleisvorfeld', h: YARD_H, poly: [[43.5, 0], [76, 0], [76, 50], [43.5, 50]], stairs: [{ x: 38.5, z: 24, rot: Math.PI / 2, width: 10, len: 10 }] },
      // Loading ramp with the signal box: stairs up from the yard (they start at the yard, `base`).
      { name: 'Laderampe', h: RAMP_H, base: YARD_H, poly: [[57, 0], [67, 0], [67, 15.6], [57, 15.6]], stairs: [{ x: 62, z: 17.4, rot: Math.PI, width: 4.4, len: 4.4 }] },
    ],
    fixedProps: props,
    camp: c,
    district: 1,
    seed: 2020,
  };
}

/** The ring the hero stands in, if any. */
export function campPlaceAt(c: CampLayout, x: number, z: number): CampPlace | null {
  let best: CampPlace | null = null, bd = Infinity;
  for (const p of c.places) { const d = Math.hypot(p.x - x, p.z - z); if (d < p.r && d < bd) { bd = d; best = p; } }
  return best;
}
