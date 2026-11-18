// M15 Weltzeituhr as an object of its own (step 7): the landmark on the Alexanderplatz stands as this
// rig, and the final boss is the same rig on four clockwork legs. The map world builds one for the
// landmark (hidden while the boss is alive) and hands out more for the boss body (`World.clockRig`).
// Geometry and the sign atlas are the landmark's (`buildClockParts` in `alex-world.ts`).
import { Group } from 'three';
import { buildClockParts } from './alex-world';
import { paintAlexAtlas } from './alex-paint';
import { ChunkBuilder, emissive, type MapMats } from './map-world';
import type { Materials } from './materials';
import { paintClock, paintConcrete } from './paint';
import { makeMats } from './world';

export interface ClockRig {
  /** Placed in the world (landmark) or under an enemy view (boss). */
  group: Group;
  /** Column, drum and orbit; lifted together when it wakes. */
  body: Group;
  column: Group;
  drum: Group;
  orbit: Group;
}

function partGroup(b: ChunkBuilder): Group {
  const g = new Group();
  for (const mesh of b.solid.meshes()) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

export function makeClockRig(mats: MapMats): ClockRig {
  const builders = [new ChunkBuilder(mats), new ChunkBuilder(mats), new ChunkBuilder(mats)] as const;
  buildClockParts(...builders);
  const [column, drum, orbit] = builders.map(partGroup) as [Group, Group, Group];
  const body = new Group();
  body.add(column, drum, orbit);
  const group = new Group();
  group.add(body);
  return { group, body, column, drum, orbit };
}

let spare: MapMats | null = null;
/**
 * Just the materials the clock uses (the shared set, concrete, the clock faces, the Alexanderplatz
 * atlas), for a boss rig outside its map (`?spawn=`, tools). The rest of a map's set is never read.
 */
export function clockMats(materials: Materials): MapMats {
  if (!spare) {
    const o = { flatten: materials.look.flatten, normalMaps: materials.profile.normalMaps, anisotropy: materials.profile.anisotropy };
    spare = {
      ...makeMats(materials),
      concrete: materials.surface({ map: paintConcrete(o).map, roughness: 0.9, vertexColors: true }),
      clock: emissive(materials, paintClock(), 0xffe0a0, 1.1),
      alex: emissive(materials, paintAlexAtlas(), 0xffe0a0, 0.8),
    } as unknown as MapMats;
  }
  return spare;
}
