// Dedicated auxiliary passes; hero meshes retain layer 0 for normal beauty/depth rendering.
import type { PropKind } from '../data/courtyard';

export const FX_LAYER = 1;
export const HERO_LAYER = 2;
export const OCCLUDER_LAYER = 3;
/** Enemy bodies for their contour behind buildings (V1). */
export const ENEMY_LAYER = 4;
/** Hidden blessings and the hidden cache for their gold contour behind buildings (Johannes, 2026-11-19). */
export const LOOT_LAYER = 5;
/** Finds within this distance of the hero show (and get their contour). */
export const LOOT_SHOW = 15;

export function isLargeProp(kind: PropKind): boolean {
  return kind === 'tram' || kind === 'bus' || kind === 'van' || kind === 'car' || kind === 'rohbau' || kind === 'container'
    // M11d closed edge: building rows, collapsed houses and street-end barricades.
    || kind === 'brandwand' || kind === 'rubbleWall' || kind === 'barricade';
}
