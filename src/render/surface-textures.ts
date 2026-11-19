import { CanvasTexture, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { LitMaterial } from './materials';

export function loadPaintedTexture(url: string, anisotropy: number, swap: (texture: Texture) => void, repeat = true, maxEdge = Infinity): void {
  const pending = new TextureLoader().load(url, source => {
    let texture: Texture = source;
    const image = source.image as HTMLImageElement;
    const edge = Math.max(image.naturalWidth, image.naturalHeight);
    if (edge > maxEdge) {
      const scaled = document.createElement('canvas');
      scaled.width = Math.max(1, Math.round(image.naturalWidth * maxEdge / edge));
      scaled.height = Math.max(1, Math.round(image.naturalHeight * maxEdge / edge));
      const ctx = scaled.getContext('2d');
      if (!ctx) {
        source.dispose();
        return;
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, scaled.width, scaled.height);
      texture = new CanvasTexture(scaled);
      source.dispose();
    }
    texture.colorSpace = SRGBColorSpace;
    if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
    swap(texture);
  }, undefined, () => pending.dispose());
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
