// M18 Wedding: Zum Magendoktor, the walk-in pub (engine note E2 of `docs/tasks/m18-wedding.md`, floor plan in
// `docs/mockups/m18-wedding-c2.svg`, layout as Johannes described it on 2026-11-21). Built on the Späti pattern: one
// source for sim colliders and the render. Plan frame: x east, z south as on the floor plan, the door in the north
// wall (−z). A landmark with facing `rot` maps the plan by (rot − π), so the pub of the map (rot π, front to the
// north) has plan = world offsets. From the door (looking south): the corner table with its bench on the right (west),
// the toilet behind it, the bar with high stools and the back shelf on the left (east), the pool table behind the
// bar, three small tables in the middle as obstacles; jukebox and slot machines on the west wall, darts by the door.
// The whole room is the arena (`EncounterDef.room`): two waves of Zecher, then the boss; lanes between pieces ≥ 1.8 m.
import type { Collider } from '../sim/collide';
import type { Level, RoomRect } from '../sim/level';
import type { Landmark } from './map';

export const KNEIPE = {
  /** Outside size (the landmark footprint is half of it) and wall thickness: inside 18 × 13. */
  w: 19,
  d: 14,
  wall: 0.5,
  /** Door opening in the north wall, centred. */
  door: 2.6,
  height: 3.8,
  /** Walls stay whole up to here while the hero is inside (the rest hides with the roof). */
  low: 1.1,
  /** Encounter radius: covers the room (no ring is drawn; the room rectangle triggers and places the spawns). */
  r: 11,
  /** Where the boss stands up (plan frame): in the free middle between the door, the bar and the tables. */
  boss: { x: 1.1, z: -3.2 },
} as const;

export type KneipePartKind = 'wall' | 'bench' | 'ecktisch' | 'wc' | 'counter' | 'shelf' | 'billard' | 'jukebox' | 'automat' | 'table';

export interface KneipePart {
  kind: KneipePartKind;
  /** Plan frame (x east, z south, door to the north). */
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/** Blocking parts in the plan frame (the floor plan of the C2 mockup). Tables are circles of radius `hx`. */
export function kneipeParts(): KneipePart[] {
  const { w, d, door, wall } = KNEIPE;
  const t = wall / 2, side = (w / 2 - door / 2) / 2;
  return [
    // North front with the door, the south wall toward the camera (rendered knee high while inside), the side walls.
    { kind: 'wall', x: -door / 2 - side, z: -d / 2 + t, hx: side, hz: t },
    { kind: 'wall', x: door / 2 + side, z: -d / 2 + t, hx: side, hz: t },
    { kind: 'wall', x: 0, z: d / 2 - t, hx: w / 2, hz: t },
    { kind: 'wall', x: -w / 2 + t, z: 0, hx: t, hz: d / 2 },
    { kind: 'wall', x: w / 2 - t, z: 0, hx: t, hz: d / 2 },
    // West, right of the door: the corner table with its L bench, the toilet (a closed door), jukebox and slot machines.
    { kind: 'bench', x: -8.55, z: -4.5, hx: 0.3, hz: 1.7 },
    { kind: 'bench', x: -7.2, z: -6.1, hx: 1.2, hz: 0.25 },
    { kind: 'ecktisch', x: -6.65, z: -4.3, hx: 1.05, hz: 0.9 },
    { kind: 'wc', x: -7.35, z: 0.1, hx: 1.5, hz: 1.6 },
    { kind: 'jukebox', x: -8.6, z: 3.4, hx: 0.35, hz: 0.55 },
    { kind: 'automat', x: -8.6, z: 4.75, hx: 0.35, hz: 0.38 },
    { kind: 'automat', x: -8.6, z: 5.7, hx: 0.35, hz: 0.38 },
    // East, left of the door: the bar as an L against the north wall, the back shelf on the east wall, the pool table behind.
    { kind: 'counter', x: 5.7, z: -2.0, hx: 0.5, hz: 2.65 },
    { kind: 'counter', x: 6.55, z: -6.0, hx: 1.35, hz: 0.45 },
    { kind: 'shelf', x: 8.65, z: -2.6, hx: 0.35, hz: 3.3 },
    { kind: 'billard', x: 5.35, z: 3.8, hx: 1.5, hz: 0.85 },
    // Three small round tables in the middle: obstacles to dodge around.
    { kind: 'table', x: -2.8, z: -2.1, hx: 0.85, hz: 0.85 },
    { kind: 'table', x: 1.2, z: 1.0, hx: 0.85, hz: 0.85 },
    { kind: 'table', x: -2.8, z: 3.3, hx: 0.85, hz: 0.85 },
  ];
}

/** High bar stools in front of the counter and stools at the tables (render only: they do not block). */
export const KNEIPE_STOOLS: ReadonlyArray<readonly [number, number]> = [
  [4.35, -4.1], [4.35, -2.75], [4.35, -1.4], [4.35, 0],
  [-4.0, -2.1], [-1.6, -2.4], [0.0, 1.0], [2.4, 1.2], [-4.0, 3.3], [-1.6, 3.6],
];

/** Plan point (x east, z south with the door north) to world. */
export function kneipeWorld(l: Landmark, x: number, z: number): { x: number; z: number } {
  const a = l.rot - Math.PI, c = Math.cos(a), s = Math.sin(a);
  return { x: l.x + x * c + z * s, z: l.z - x * s + z * c };
}

export function kneipeColliders(l: Landmark): Collider[] {
  return kneipeParts().map((p) => {
    const q = kneipeWorld(l, p.x, p.z);
    if (p.kind === 'table') return { kind: 'circle', x: q.x, z: q.z, r: p.hx } satisfies Collider;
    return { kind: 'box', x: q.x, z: q.z, hx: p.hx, hz: p.hz, rot: l.rot - Math.PI } satisfies Collider;
  });
}

/** The room between the walls as the encounter's arena (`EncounterDef.room`). */
export function kneipeRoom(l: Landmark): RoomRect {
  return { x: l.x, z: l.z, rot: l.rot - Math.PI, hx: KNEIPE.w / 2 - KNEIPE.wall, hz: KNEIPE.d / 2 - KNEIPE.wall };
}

/** Inside the room (between the walls), for the roof hide and the tests. */
export function inKneipe(l: Landmark, x: number, z: number, pad = 0): boolean {
  const a = l.rot - Math.PI, c = Math.cos(a), s = Math.sin(a), dx = x - l.x, dz = z - l.z;
  const px = dx * c - dz * s, pz = dx * s + dz * c;
  return Math.abs(px) < KNEIPE.w / 2 - KNEIPE.wall + pad && Math.abs(pz) < KNEIPE.d / 2 - KNEIPE.wall + pad;
}

/** The three regulars asleep (by the corner table, at the first table, at the bar); they wake when the hero comes near. */
export function kneipeGuards(l: Landmark): Level['guards'] {
  return ([[-6.45, -2.4], [-1.6, -1.0], [4.35, 1.4]] as const).map(([x, z]) => ({ ...kneipeWorld(l, x, z), kind: 'walker' as const, elite: false, wake: 3.5, hp: 1 }));
}
