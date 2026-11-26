import type { Texture } from 'three';
import { loadPaintedTexture } from './surface-textures';

// Vite fingerprints these URLs and keeps them relative to the deployed game (GitHub Pages).
const urls = {
  grass: new URL('../../assets/textures/koepenick/grass.webp', import.meta.url).href,
  dirt: new URL('../../assets/textures/koepenick/dirt.webp', import.meta.url).href,
  paving: new URL('../../assets/textures/koepenick/paving.webp', import.meta.url).href,
  leaves: new URL('../../assets/textures/koepenick/leaves.webp', import.meta.url).href,
  litter: new URL('../../assets/textures/koepenick/litter.webp', import.meta.url).href,
  asphalt: new URL('../../assets/textures/koepenick/asphalt.webp', import.meta.url).href,
  mitteAsphalt: new URL('../../assets/textures/mitte/wet-asphalt.webp', import.meta.url).href,
  cobbles: new URL('../../assets/textures/common/cobbles.webp', import.meta.url).href,
};

/** T1b: the four tiling ground images are also exported at 512 px (`tools/build-ground-textures.mjs`). */
const small: Partial<Record<keyof typeof urls, string>> = {
  grass: new URL('../../assets/textures/koepenick/grass-512.webp', import.meta.url).href,
  dirt: new URL('../../assets/textures/koepenick/dirt-512.webp', import.meta.url).href,
  paving: new URL('../../assets/textures/koepenick/paving-512.webp', import.meta.url).href,
  leaves: new URL('../../assets/textures/koepenick/leaves-512.webp', import.meta.url).href,
};

/** `?ground=512|1024` forces one size of the four tiling images on every profile (Johannes' Qualität side by side). */
export function groundSize(search: string): 512 | 1024 | undefined {
  const v = new URLSearchParams(search).get('ground');
  return v === '512' ? 512 : v === '1024' ? 1024 : undefined;
}
const forced = typeof location === 'undefined' ? undefined : groundSize(location.search);

/** Which file and cap a ground surface loads with: a cap of 512 or less takes the 512 px export instead of resizing. */
export function groundSource(surface: keyof typeof urls, maxEdge: number, force = forced): { url: string; maxEdge: number } {
  const half = small[surface];
  if (half && (force === 512 || (force === undefined && maxEdge <= 512))) return { url: half, maxEdge: Math.min(maxEdge, 512) };
  return { url: urls[surface], maxEdge: half && force === 1024 ? Infinity : maxEdge };
}

/**
 * Leave the painted fallback installed until the image is decoded; failures keep it in place.
 * `maxEdge`: the profile's tiling cap (P47, `profile.tileEdge`).
 */
export function loadGroundTexture(surface: keyof typeof urls, anisotropy: number, maxEdge: number, swap: (texture: Texture) => void): void {
  const { url, maxEdge: cap } = groundSource(surface, maxEdge);
  loadPaintedTexture(url, anisotropy, swap, true, cap);
}
