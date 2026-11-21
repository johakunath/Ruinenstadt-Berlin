// M18 Wedding: Zum Magendoktor, the walk-in pub (engine note E2 of `docs/tasks/m18-wedding.md`, floor plan in
// `docs/mockups/m18-wedding-c2.svg`). Built on the Späti pattern: one source for sim colliders and the render.
// Plan frame: x east, z south as seen on the floor plan with the door in the north wall (local −z). A landmark
// with facing `rot` maps the plan by (rot − π), so the pub of the map (rot π, front to the north) has plan = world
// offsets. The fight is an ordinary encounter of radius `KNEIPE.ring` at the room centre; the furniture stays low
// toward the camera (south), the tall pieces (back shelf, jukebox, slot machines) stand along the side walls.
import type { Collider } from '../sim/collide';
import type { Level } from '../sim/level';
import type { Landmark } from './map';

export const KNEIPE = {
  /** Outside size (the landmark footprint is half of it) and wall thickness: inside 22 × 17. */
  w: 23,
  d: 18,
  wall: 0.5,
  /** Door opening in the north wall, centred. */
  door: 3,
  height: 3.8,
  /** Walls stay whole up to here while the hero is inside (the rest hides with the roof). */
  low: 1.1,
  /** The fight ring at the room centre (E2: an exception to the 13 m rule). */
  ring: 8,
} as const;

export type KneipePartKind = 'wall' | 'counter' | 'shelf' | 'stammtisch' | 'billard' | 'jukebox' | 'automat' | 'table' | 'pillar';

export interface KneipePart {
  kind: KneipePartKind;
  /** Plan frame (x east, z south, door to the north). */
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/** Blocking parts in the plan frame (as the C2 floor plan: counter and back shelf west, billiard and slot machines east). */
export function kneipeParts(): KneipePart[] {
  const { w, d, door, wall } = KNEIPE;
  const t = wall / 2, side = (w / 2 - door / 2) / 2;
  return [
    // North front with the door, the south wall toward the camera (rendered knee high), the side walls.
    { kind: 'wall', x: -door / 2 - side, z: -d / 2 + t, hx: side, hz: t },
    { kind: 'wall', x: door / 2 + side, z: -d / 2 + t, hx: side, hz: t },
    { kind: 'wall', x: 0, z: d / 2 - t, hx: w / 2, hz: t },
    { kind: 'wall', x: -w / 2 + t, z: 0, hx: t, hz: d / 2 },
    { kind: 'wall', x: w / 2 - t, z: 0, hx: t, hz: d / 2 },
    // West: the back shelf along the wall, the long counter with the tap column in front of it.
    { kind: 'shelf', x: -10.45, z: -1.5, hx: 0.4, hz: 4.6 },
    { kind: 'counter', x: -8.2, z: -1.2, hx: 0.55, hz: 4.2 },
    // North: the Stammtisch beside the door; north-east the jukebox; the billiard table east of the middle.
    { kind: 'stammtisch', x: -4.6, z: -6.6, hx: 1.3, hz: 0.7 },
    { kind: 'jukebox', x: 10.15, z: -7.3, hx: 0.45, hz: 0.5 },
    { kind: 'billard', x: 6.2, z: -2.6, hx: 0.75, hz: 1.35 },
    // East wall: three slot machines.
    ...[0.6, 2.6, 4.6].map((z): KneipePart => ({ kind: 'automat', x: 10.4, z, hx: 0.35, hz: 0.45 })),
    // Two posts carry the ceiling.
    { kind: 'pillar', x: -3.6, z: -1, hx: 0.25, hz: 0.25 },
    { kind: 'pillar', x: 3.6, z: -1, hx: 0.25, hz: 0.25 },
    // Round tables in the south half (low, toward the camera).
    ...([[-7.6, 5.4], [-3.4, 5.9], [1.2, 6.4], [5.6, 5.8], [9.2, 6.6]] as const).map(([x, z]): KneipePart => ({ kind: 'table', x, z, hx: 0.6, hz: 0.6 })),
  ];
}

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

/** Inside the room (between the walls), for the roof hide and the tests. */
export function inKneipe(l: Landmark, x: number, z: number, pad = 0): boolean {
  const a = l.rot - Math.PI, c = Math.cos(a), s = Math.sin(a), dx = x - l.x, dz = z - l.z;
  const px = dx * c - dz * s, pz = dx * s + dz * c;
  return Math.abs(px) < KNEIPE.w / 2 - KNEIPE.wall + pad && Math.abs(pz) < KNEIPE.d / 2 - KNEIPE.wall + pad;
}

/** The three regulars asleep at their tables (Stammtisch, two round tables); they wake when the hero comes near. */
export function kneipeGuards(l: Landmark): Level['guards'] {
  return ([[-4.6, -5.5], [-3.4, 6.95], [5.6, 6.85]] as const).map(([x, z]) => ({ ...kneipeWorld(l, x, z), kind: 'walker' as const, elite: false, wake: 3.5, hp: 1 }));
}
