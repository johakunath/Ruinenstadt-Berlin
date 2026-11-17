// Dedicated auxiliary passes; hero meshes retain layer 0 for normal beauty/depth rendering.
import type { PropKind } from '../data/courtyard';

export const FX_LAYER = 1;
export const HERO_LAYER = 2;
export const OCCLUDER_LAYER = 3;
/** Enemy bodies for their contour behind buildings (V1). */
export const ENEMY_LAYER = 4;

export function isLargeProp(kind: PropKind): boolean {
  return kind === 'tram' || kind === 'bus' || kind === 'van' || kind === 'car' || kind === 'rohbau' || kind === 'container';
}
