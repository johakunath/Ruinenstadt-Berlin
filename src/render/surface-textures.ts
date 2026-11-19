import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { LitMaterial } from './materials';

export function loadPaintedTexture(url: string, anisotropy: number, swap: (texture: Texture) => void, repeat = true): void {
  const pending = new TextureLoader().load(url, texture => {
    texture.colorSpace = SRGBColorSpace;
    if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
    swap(texture);
  }, undefined, () => pending.dispose());
}

/** The meshes keep their original painted map if the image fails to load. */
export function swapPaintedMap(materials: readonly LitMaterial[], url: string, anisotropy: number, repeat = true): void {
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
  }, repeat);
}
