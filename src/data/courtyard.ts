// The gate 1 map: one Köpenick courtyard (Hinterhof). This file is the single source for
// both the sim (static footprints, spawn points) and the renderer (facades, props, lights).
// Ground plane: +X east, +Z south (toward the camera). Units are meters.
import type { Collider } from '../sim/collide';
import { Level } from '../sim/level';
import { DEG } from '../sim/math';

export type FacadeStyle = 'altbau' | 'yardWall';
export type PlasterTone = 'cream' | 'ochre' | 'oxblood';

/** Something on the ground floor of a facade, placed by distance along the run. */
export interface FacadeFeature {
  kind: 'spati' | 'gate' | 'breach' | 'door';
  from: number;
  to: number;
}

/**
 * A wall run from A to B. Walking A → B the yard is on the left; the building body
 * extends `depth` meters to the right. `gate` and `breach` features are passable gaps.
 */
export interface Facade {
  id: string;
  style: FacadeStyle;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  depth: number;
  /** Upper floors above the ground floor (altbau only). */
  floors: number;
  tone: PlasterTone;
  features: FacadeFeature[];
  seed: number;
}

export type PropKind = 'fireBarrel' | 'lantern' | 'van' | 'sandbags' | 'crates' | 'bins' | 'rubble' | 'planks' | 'bench' | 'car' | 'bollard' | 'fence' | 'lampBroken' | 'campfire' | 'bus' | 'tram' | 'bauzaun' | 'barrier' | 'workLamp' | 'candles' | 'stringLights';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  rot: number;
  /** Rubble pile radius, fence length; a scale for other kinds. */
  size: number;
}

export interface SpawnPoint {
  x: number;
  z: number;
}

const prop = (kind: PropKind, x: number, z: number, rot = 0, size = 1): Prop => ({ kind, x, z, rot, size });

export const COURTYARD = {
  /** Outer limit of the nav grid (includes the passages enemies come through). */
  bounds: { minX: -16, maxX: 16, minZ: -12, maxZ: 12 },
  /** The yard itself. The player cannot leave it. */
  yard: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 },
  playerStart: { x: 0, z: 2.5 },
  facades: [
    {
      id: 'north', style: 'altbau', ax: -12, az: -8, bx: 12, bz: -8, depth: 4, floors: 3, tone: 'cream', seed: 11,
      features: [
        { kind: 'spati', from: 2.6, to: 10.2 },
        { kind: 'gate', from: 14.4, to: 18.1 },
        { kind: 'door', from: 20.6, to: 22 },
      ],
    },
    {
      id: 'west', style: 'altbau', ax: -12, az: 8, bx: -12, bz: -8, depth: 4, floors: 3, tone: 'oxblood', seed: 23,
      features: [{ kind: 'door', from: 6.4, to: 7.8 }],
    },
    {
      id: 'east', style: 'altbau', ax: 12, az: -8, bx: 12, bz: 8, depth: 4, floors: 3, tone: 'ochre', seed: 37,
      features: [{ kind: 'breach', from: 8.5, to: 12 }],
    },
    {
      id: 'south', style: 'yardWall', ax: 12, az: 8, bx: -12, bz: 8, depth: 4, floors: 0, tone: 'cream', seed: 41,
      features: [{ kind: 'gate', from: 10, to: 14 }],
    },
  ] satisfies Facade[] as Facade[],
  props: [
    prop('fireBarrel', -1.4, -3.2),
    prop('crates', -2.9, -3.9, 20 * DEG),
    prop('bench', 0.3, -4.4, -12 * DEG),
    prop('lantern', 7.6, -6.5),
    prop('lantern', -10.2, 5.2),
    prop('lantern', 10.4, 6.3),
    prop('van', -5.6, 4.3, 108 * DEG),
    prop('sandbags', -1.2, -7.2, 0),
    prop('crates', -10.4, -7.0, 8 * DEG),
    prop('bins', 11.2, -3.6, 90 * DEG),
    prop('rubble', 10.9, -0.6, 0, 1.0),
    prop('rubble', 11.0, 5.0, 0, 0.9),
    prop('rubble', -10.8, -1.0, 0, 1.1),
    prop('rubble', 6.2, 7.0, 0, 0.8),
    prop('planks', -11.6, 1.6, 90 * DEG),
    prop('planks', 1.3, -7.7, 0),
  ] as Prop[],
  spawns: [
    { x: 4.25, z: -10.6 },
    { x: 14.4, z: 2.25 },
    { x: 0, z: 10.6 },
  ] as SpawnPoint[],
};

/** Static footprint of a prop, or null when it does not block movement. */
export function propCollider(p: Prop): Collider | null {
  switch (p.kind) {
    case 'fireBarrel':
      return { kind: 'circle', x: p.x, z: p.z, r: 0.42 };
    case 'lantern':
      return { kind: 'circle', x: p.x, z: p.z, r: 0.2 };
    case 'van':
      return { kind: 'box', x: p.x, z: p.z, hx: 1.1, hz: 2.75, rot: p.rot };
    case 'sandbags':
      return { kind: 'box', x: p.x, z: p.z, hx: 1.0, hz: 0.5, rot: p.rot };
    case 'crates':
      return { kind: 'box', x: p.x, z: p.z, hx: 0.75, hz: 0.6, rot: p.rot };
    case 'bins':
      return { kind: 'box', x: p.x, z: p.z, hx: 1.25, hz: 0.45, rot: p.rot };
    case 'rubble':
      return { kind: 'circle', x: p.x, z: p.z, r: p.size * 0.85 };
    case 'bench':
      return { kind: 'box', x: p.x, z: p.z, hx: 0.85, hz: 0.28, rot: p.rot };
    case 'car':
      return { kind: 'box', x: p.x, z: p.z, hx: 0.9, hz: 2.05, rot: p.rot };
    case 'lampBroken':
      return { kind: 'circle', x: p.x, z: p.z, r: 0.2 };
    case 'campfire':
      return { kind: 'circle', x: p.x, z: p.z, r: 0.7 };
    case 'bus':
      return { kind: 'box', x: p.x, z: p.z, hx: 1.28, hz: 5.5, rot: p.rot };
    case 'tram':
      return { kind: 'box', x: p.x, z: p.z, hx: 1.15, hz: 7.6, rot: p.rot };
    case 'bauzaun':
    case 'barrier':
      return { kind: 'box', x: p.x, z: p.z, hx: p.size / 2 + 0.05, hz: 0.3, rot: p.rot };
    case 'bollard':
      return { kind: 'circle', x: p.x, z: p.z, r: 0.14 };
    case 'fence':
      return { kind: 'box', x: p.x, z: p.z, hx: p.size / 2, hz: 0.08, rot: p.rot };
    case 'workLamp':
      return { kind: 'circle', x: p.x, z: p.z, r: 0.35 };
    case 'candles':
    case 'stringLights':
    case 'planks':
      return null;
  }
}

/** Solid wall footprints of a facade: the run minus its passable gaps. */
export function facadeColliders(f: Facade): Collider[] {
  const len = Math.hypot(f.bx - f.ax, f.bz - f.az);
  const dx = (f.bx - f.ax) / len;
  const dz = (f.bz - f.az) / len;
  // Unit normal pointing into the yard; the building body lies on the other side.
  const nx = -dz;
  const nz = dx;
  const gaps = f.features.filter((g) => g.kind === 'gate' || g.kind === 'breach').sort((a, b) => a.from - b.from);
  const solids: Array<[number, number]> = [];
  let at = 0;
  for (const g of gaps) {
    if (g.from > at) solids.push([at, g.from]);
    at = g.to;
  }
  if (at < len) solids.push([at, len]);
  const rot = Math.atan2(dx, dz) - Math.PI / 2;
  return solids.map(([s0, s1]) => {
    const mid = (s0 + s1) / 2;
    return {
      kind: 'box',
      x: f.ax + dx * mid - nx * (f.depth / 2),
      z: f.az + dz * mid - nz * (f.depth / 2),
      hx: (s1 - s0) / 2,
      hz: f.depth / 2,
      rot,
    } satisfies Collider;
  });
}

export function courtyardColliders(): Collider[] {
  const list: Collider[] = [];
  for (const f of COURTYARD.facades) list.push(...facadeColliders(f));
  for (const p of COURTYARD.props) {
    const c = propCollider(p);
    if (c) list.push(c);
  }
  return list;
}

/** The courtyard as an arena level: endless spawner, the player stays in the yard. */
export function courtyardLevel(): Level {
  return new Level('hof', COURTYARD.bounds, COURTYARD.playerStart, courtyardColliders(), null, COURTYARD.spawns, COURTYARD.yard);
}
