// M11c lot type props, market and garden set: stalls (intact, broken), spilled goods, garden sheds (Lauben),
// beds, gnomes, the pond jetty and low picket fences. Footprints: `propCollider` in `src/data/courtyard.ts`.
// Placeholder boxes until the art pass.
import type { MarketPropKind, Prop } from '../data/courtyard';
import type { Rng } from '../sim/math';
import { at, type Builder } from './world';

const KINDS: ReadonlySet<string> = new Set<MarketPropKind>(['stall', 'stallBroken', 'spill', 'shed', 'gardenBed', 'gnome', 'jetty', 'picket']);

/** Builds `p` if it belongs to this set; false otherwise. */
export function buildMarketProp(b: Builder, p: Prop, _rng: Rng): boolean {
  if (!KINDS.has(p.kind)) return false;
  b.box(b.mats.wood, at(p, 0, 0.4, 0), 1, 0.8, 1, [1.4, 1.2, 0.3]);
  return true;
}
