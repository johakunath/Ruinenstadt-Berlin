// M11c lot type props, urban set: crane, container, scaffold, Rohbau, pallets, ticket machine, barrier boom,
// bike rack, clothesline, gravestones, walls, concrete slabs and girders. Footprints: `propCollider`
// in `src/data/courtyard.ts`. Placeholder boxes until the art pass.
import type { Prop, UrbanPropKind } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';

const KINDS: ReadonlySet<string> = new Set<UrbanPropKind>(['crane', 'container', 'scaffold', 'rohbau', 'pallets', 'ticketMachine', 'boom', 'bikes', 'clothesline', 'gravestone', 'wall', 'lowWall', 'slab', 'girder']);

/** Builds `p` if it belongs to this set; false otherwise. */
export function buildUrbanProp(b: Builder, p: Prop, _rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  b.box(b.mats.iron, at(p, 0, 0.5, 0), 1, 1, 1, [1.4, 0.4, 1.4]);
  return true;
}
