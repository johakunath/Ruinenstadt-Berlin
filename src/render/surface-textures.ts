import { CanvasTexture, ImageBitmapLoader, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';
import type { LitMaterial } from './materials';

/**
 * T1b: painted images decode off the main thread through `ImageBitmapLoader` (flipped at decode, so the texture keeps
 * `flipY = false` and the same orientation as an `<img>` upload). Browsers whose `createImageBitmap` ignores options
 * (Safari before 17, Firefox before 98, as three's GLTFLoader checks) and any bitmap failure use `TextureLoader`.
 */
export function bitmapsWork(userAgent: string, hasCreateImageBitmap: boolean): boolean {
  if (!hasCreateImageBitmap) return false;
  const safari = /^((?!chrome|android).)*safari/i.test(userAgent) ? Number(/Version\/(\d+)/.exec(userAgent)?.[1] ?? 0) : Infinity;
  const firefox = Number(/Firefox\/(\d+)\./.exec(userAgent)?.[1] ?? Infinity);
  return safari >= 17 && firefox >= 98;
}

const bitmaps = typeof navigator !== 'undefined' && bitmapsWork(navigator.userAgent, typeof createImageBitmap === 'function' && typeof fetch === 'function');

/** Edge sizes for a cap: the longer edge becomes `maxEdge`, the other keeps the aspect ratio. */
export function cappedSize(width: number, height: number, maxEdge: number): [number, number] {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return [width, height];
  return [Math.max(1, Math.round(width * maxEdge / edge)), Math.max(1, Math.round(height * maxEdge / edge))];
}

async function loadBitmap(url: string, maxEdge: number): Promise<Texture> {
  let bitmap = await new ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' }).loadAsync(url);
  const [w, h] = cappedSize(bitmap.width, bitmap.height, maxEdge);
  if (w !== bitmap.width || h !== bitmap.height) {
    // P47: resample the decoded bitmap (no canvas, no main-thread draw); its orientation is kept.
    const full = bitmap;
    bitmap = await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    full.close();
  }
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.needsUpdate = true;
  // The decoded copy is only needed for the one upload (a 1024 px image is 4 MiB of RAM). Nothing re-uploads a
  // loaded painted map; a texture that must (a clone with other sampler settings) needs its own load.
  texture.onUpdate = () => {
    texture.onUpdate = null;
    bitmap.close();
  };
  return texture;
}

/** `<img>` decode, and a canvas resize for a cap: the path before T1b, kept as the fallback. */
function loadImage(url: string, maxEdge: number, done: (texture: Texture) => void): void {
  const pending = new TextureLoader().load(url, source => {
    let texture: Texture = source;
    const image = source.image as HTMLImageElement;
    const [w, h] = cappedSize(image.naturalWidth, image.naturalHeight, maxEdge);
    if (w !== image.naturalWidth || h !== image.naturalHeight) {
      const scaled = document.createElement('canvas');
      scaled.width = w;
      scaled.height = h;
      const ctx = scaled.getContext('2d');
      if (!ctx) {
        source.dispose();
        return;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, w, h);
      texture = new CanvasTexture(scaled);
      source.dispose();
    }
    done(texture);
  }, undefined, () => pending.dispose());
}

/**
 * Loads a painted image and hands it to `swap`; on failure `swap` never runs and the painted fallback stays.
 * `maxEdge` caps the longer edge (px). P47: a tiling surface opts in with `profile.tileEdge` (512 on Leistung), an
 * atlas of 2 × 2 tiling cells with twice that; lettered atlases, the Fernsehturm city image and the hero clothing never do.
 */
export function loadPaintedTexture(url: string, anisotropy: number, swap: (texture: Texture) => void, repeat = true, maxEdge = Infinity): void {
  const finish = (texture: Texture): void => {
    texture.colorSpace = SRGBColorSpace;
    if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
    swap(texture);
  };
  if (bitmaps) loadBitmap(url, maxEdge).then(finish, () => loadImage(url, maxEdge, finish));
  else loadImage(url, maxEdge, finish);
}

/** The meshes keep their original painted map if the image fails to load. */
export function swapPaintedMap(materials: readonly LitMaterial[], url: string, anisotropy: number, repeat = true, maxEdge = Infinity): void {
  loadPaintedTexture(url, anisotropy, image => {
    const replaced = new Set<Texture>();
    for (const material of materials) {
      const fallback = material.map;
      if (fallback) {
        if (material.emissiveMap === fallback) material.emissiveMap = image;
        replaced.add(fallback);
      } else {
        material.needsUpdate = true;
      }
      material.map = image;
    }
    for (const fallback of replaced) fallback.dispose();
  }, repeat, maxEdge);
}
