import type { Materials } from './materials';
import { paintBrick, paintConcrete, paintStucco, type PaintOptions } from './paint';
import { swapPaintedMap } from './surface-textures';

/** T5 materials used only on the landmarks that call for them. */
export function makeLandmarkFinishes(materials: Materials, slate: ReturnType<Materials['surface']>) {
  const o: PaintOptions = { flatten: materials.look.flatten, anisotropy: materials.profile.anisotropy, normalMaps: materials.profile.normalMaps };
  const rathenow = paintBrick(o);
  const finishes = {
    brick: materials.surface({ map: rathenow.map, normalMap: rathenow.normalMap, roughness: 0.9, vertexColors: true }),
    plaster: materials.surface({ map: paintStucco(o).map, roughness: 0.86, vertexColors: true }),
    granite: materials.surface({ map: paintConcrete(o, '#9c766a').map, roughness: 0.85, vertexColors: true }),
    fiberglass: materials.surface({ map: paintConcrete(o, '#76806f').map, roughness: 0.82, vertexColors: true }),
  };
  const sources = [
    [slate, new URL('../../assets/textures/landmarks/slate.webp', import.meta.url).href],
    [finishes.brick, new URL('../../assets/textures/landmarks/rathenow-brick.webp', import.meta.url).href],
    [finishes.plaster, new URL('../../assets/textures/landmarks/baroque-plaster.webp', import.meta.url).href],
    [finishes.granite, new URL('../../assets/textures/landmarks/forum-granite.webp', import.meta.url).href],
    [finishes.fiberglass, new URL('../../assets/textures/landmarks/fiberglass.webp', import.meta.url).href],
  ] as const;
  // P47: all five are tiling surfaces, so they opt into the profile's cap (512 px on Leistung).
  for (const [mat, url] of sources) swapPaintedMap([mat], url, o.anisotropy, true, materials.profile.tileEdge);
  return finishes;
}
