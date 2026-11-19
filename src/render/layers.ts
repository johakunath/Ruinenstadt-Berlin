// Dedicated auxiliary passes; hero meshes retain layer 0 for normal beauty/depth rendering.
import type { PropKind } from '../data/courtyard';

export const FX_LAYER = 1;
export const HERO_LAYER = 2;
export const OCCLUDER_LAYER = 3;
/** Enemy bodies for their contour behind buildings (V1). */
export const ENEMY_LAYER = 4;

export function isLargeProp(kind: PropKind): boolean {
  return kind === 'tram' || kind === 'bus' || kind === 'van' || kind === 'car' || kind === 'rohbau' || kind === 'container'
    // M11d closed edge: building rows, collapsed houses and street-end barricades.
    || kind === 'brandwand' || kind === 'rubbleWall' || kind === 'barricade';
}

/**
 * Props that hide the hero and enemies enough to need their contour (playtest 2026-11-18: everything
 * but very small things). Large props plus stalls, sheds, tents, walls, hedges and other tall plants.
 * Crates, bins, benches, lamps, rubble, candles and loot stay out.
 */
const MID_OCCLUDERS: ReadonlySet<PropKind> = new Set<PropKind>([
  'crane', 'scaffold', 'shed', 'stall', 'stallBroken', 'tent', 'greenhouse', 'wall', 'thicket', 'overgrowth',
  'edgeHedge', 'fallenTree', 'hedge', 'topiary', 'bush', 'climber', 'sunflowers', 'reeds',
]);
export function isOccluderProp(kind: PropKind): boolean {
  return isLargeProp(kind) || MID_OCCLUDERS.has(kind);
}
