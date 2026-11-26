import type { Material, Texture } from 'three';
import type { LitMaterial, Materials } from './materials';
import { canvas, toTexture } from './paint';
import { loadPaintedTexture, swapPaintedMap } from './surface-textures';
import type { Mats } from './world';

const urls = {
  markings: new URL('../../assets/textures/common/markings.webp', import.meta.url).href,
  concrete: new URL('../../assets/textures/common/concrete-rebar.webp', import.meta.url).href,
  gravel: new URL('../../assets/textures/koepenick/gravel.webp', import.meta.url).href,
  corrugated: new URL('../../assets/textures/common/corrugated.webp', import.meta.url).href,
  tarp: new URL('../../assets/textures/common/tarp.webp', import.meta.url).href,
  stone: new URL('../../assets/textures/common/stone-moss.webp', import.meta.url).href,
  ruin: new URL('../../assets/textures/koepenick/brick-ruin.webp', import.meta.url).href,
};

// The 4 × 2 atlas contains corner, T-joint, arrow, accessibility, zebra crossing,
// digits, stop line and lane dash. Existing parking-divider quads use the last cell.
const MARKINGS_W = 1024;
const MARKINGS_H = 512;
const DASH = { left: 774, top: 367, right: 1018, bottom: 401 };
export const MARKING_DASH = [DASH.left / MARKINGS_W, 1 - DASH.bottom / MARKINGS_H,
  DASH.right / MARKINGS_W, 1 - DASH.top / MARKINGS_H] as const;

export interface LotGroundMats {
  gravel: Material;
  marking: Material;
}

export function makeLotGroundMats(materials: Materials, dirt: Texture, active: boolean): LotGroundMats {
  const { anisotropy } = materials.profile;
  const gravel = materials.surface({ map: dirt.clone(), color: 0xc0b0a0, roughness: 0.95, vertexColors: true });
  const [fallback, ctx] = canvas(MARKINGS_W, MARKINGS_H);
  ctx.fillStyle = '#9a978f';
  ctx.fillRect(DASH.left, DASH.top, DASH.right - DASH.left, DASH.bottom - DASH.top);
  const marking = materials.surface({ map: toTexture(fallback, false, anisotropy), alphaTest: 0.5, roughness: 0.9, vertexColors: true });
  if (active) {
    swapPaintedMap([gravel], urls.gravel, anisotropy);
    swapPaintedMap([marking], urls.markings, anisotropy, false, 512);
  }
  return { gravel, marking };
}

/**
 * Multiply the woven albedo into the existing colours, then restore their authored torn edges. `flipped`: the albedo
 * is stored bottom row first (an ImageBitmap decoded for `flipY = false`), so it is drawn mirrored back.
 */
function weatherCloth(material: LitMaterial, albedo: CanvasImageSource, anisotropy: number, flipped: boolean): void {
  const fallback = material.map;
  if (!fallback || !(fallback.image instanceof HTMLCanvasElement)) return;
  const source = fallback.image;
  const [c, ctx] = canvas(source.width, source.height);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  if (flipped) ctx.setTransform(1, 0, 0, -1, 0, c.height);
  ctx.drawImage(albedo, 0, 0, c.width, c.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(source, 0, 0);
  material.map = toTexture(c, false, anisotropy);
  fallback.dispose();
}

export function loadLotPropTextures(mats: Mats): void {
  const { anisotropy, smallTextures } = mats.profile;
  const performance = smallTextures;
  swapPaintedMap([mats.corrugated], urls.corrugated, anisotropy, true, performance ? 256 : 512);
  swapPaintedMap([mats.roughConcrete], urls.concrete, anisotropy, true, 512);
  swapPaintedMap([mats.stoneMoss], urls.stone, anisotropy);
  swapPaintedMap([mats.brickRuin], urls.ruin, anisotropy, true, performance ? 512 : 1024);
  loadPaintedTexture(urls.tarp, anisotropy, (image: Texture) => {
    const albedo = image.image as CanvasImageSource | null;
    if (albedo) {
      weatherCloth(mats.tarp, albedo, anisotropy, !image.flipY);
      weatherCloth(mats.stallTarp, albedo, anisotropy, !image.flipY);
    }
    image.dispose();
  });
}
