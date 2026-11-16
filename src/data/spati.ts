// Späti rest stop layout (M11b part 2): one source for sim colliders, the rest area and the render.
// Local frame: x across the front, z from the back (-) to the door (+); a Späti landmark with facing
// `rot` maps local +z to (sin rot, cos rot). The landmark's hx/hz are its world extents (for lot and
// prop clearance), so a Späti turned 90° swaps them.
import type { Collider } from '../sim/collide';
import type { RestArea } from '../sim/rest';
import type { Prop } from './courtyard';
import type { Landmark } from './map';

export const SPATI = {
  w: 11,
  d: 8,
  /** Door opening in the front wall. */
  door: 2.6,
  wall: 0.3,
  height: 3.2,
};

export interface SpatiPart {
  kind: 'wall' | 'shelf' | 'fridge' | 'counter' | 'bench';
  x: number;
  z: number;
  hx: number;
  hz: number;
}

/** Blocking parts in local coordinates. */
export function spatiParts(): SpatiPart[] {
  const { w, d, door, wall } = SPATI;
  const t = wall / 2;
  const side = (w / 2 - door / 2) / 2;
  return [
    { kind: 'wall', x: 0, z: -d / 2 + t, hx: w / 2, hz: t },
    { kind: 'wall', x: -w / 2 + t, z: 0, hx: t, hz: d / 2 },
    { kind: 'wall', x: w / 2 - t, z: 0, hx: t, hz: d / 2 },
    { kind: 'wall', x: -door / 2 - side, z: d / 2 - t, hx: side, hz: t },
    { kind: 'wall', x: door / 2 + side, z: d / 2 - t, hx: side, hz: t },
    { kind: 'shelf', x: -2.8, z: -d / 2 + 0.7, hx: 2, hz: 0.35 },
    { kind: 'shelf', x: 2.4, z: -d / 2 + 0.7, hx: 1.8, hz: 0.35 },
    { kind: 'shelf', x: 0.4, z: -0.8, hx: 1.8, hz: 0.3 },
    { kind: 'fridge', x: w / 2 - 0.7, z: -0.4, hx: 0.38, hz: 1.7 },
    { kind: 'counter', x: -3.3, z: 1, hx: 1.2, hz: 0.45 },
    { kind: 'bench', x: 3.2, z: d / 2 - 1.1, hx: 0.9, hz: 0.4 },
  ];
}

/** Local point to world. */
export function spatiWorld(l: Landmark, x: number, z: number): { x: number; z: number } {
  const c = Math.cos(l.rot);
  const s = Math.sin(l.rot);
  return { x: l.x + x * c + z * s, z: l.z - x * s + z * c };
}

export function spatiColliders(l: Landmark): Collider[] {
  return spatiParts().map((p) => {
    const w = spatiWorld(l, p.x, p.z);
    return { kind: 'box', x: w.x, z: w.z, hx: p.hx, hz: p.hz, rot: l.rot } satisfies Collider;
  });
}

export function spatiRest(l: Landmark): RestArea {
  return { name: l.name ?? 'Späti', x: l.x, z: l.z, rot: l.rot, hx: SPATI.w / 2 - SPATI.wall, hz: SPATI.d / 2 - SPATI.wall };
}

/** Sandbag rows in front, leaving a lane to the door (the lit sign and windows mark it at night). */
export function spatiProps(l: Landmark): Prop[] {
  const z = SPATI.d / 2 + 1.3;
  const out: Prop[] = [];
  for (const x of [-4.4, -2.5, 2.5, 4.4]) {
    const w = spatiWorld(l, x, z);
    out.push({ kind: 'sandbags', x: w.x, z: w.z, rot: l.rot, size: 1 });
  }
  // Three crates to break, clear of the furniture and the door lane.
  for (const [x, z, rot] of [[-4.55, -1.6, 0.2], [-4.4, 2.3, -0.3], [4.55, 1.9, 0.1]] as const) {
    const w = spatiWorld(l, x, z);
    out.push({ kind: 'crate', x: w.x, z: w.z, rot: l.rot + rot, size: 1 });
  }
  return out;
}
