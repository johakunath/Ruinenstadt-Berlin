// M11c plants: bushes (trimmed and wild), hedges, flower patches, reeds. Footprints: `propCollider`
// in `src/data/courtyard.ts` (only hedges block). Placeholder shapes until the art pass.
import type { PlantPropKind, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';

const KINDS: ReadonlySet<string> = new Set<PlantPropKind>(['bush', 'hedge', 'flowers', 'reeds']);

/** Builds `p` if it belongs to this set; false otherwise. */
export function buildPlantProp(b: Builder, p: Prop, _rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  b.box(b.mats.wood, at(p, 0, 0.4, 0), p.kind === 'hedge' ? p.size : 0.9, 0.8, 0.9, [0.3, 1.2, 0.3]);
  return true;
}
