// Dedicated auxiliary passes; hero meshes retain layer 0 for normal beauty/depth rendering.
import type { PropKind } from '../data/courtyard';

export const FX_LAYER = 1;
export const HERO_LAYER = 2;
export const OCCLUDER_LAYER = 3;

export function isLargeProp(kind: PropKind): boolean {
  return kind === 'tram' || kind === 'bus' || kind === 'van' || kind === 'car' || kind === 'rohbau' || kind === 'container'
    // M11d closed edge: building rows, collapsed houses and street-end barricades.
    || kind === 'brandwand' || kind === 'rubbleWall' || kind === 'barricade';
}
