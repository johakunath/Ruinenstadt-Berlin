import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';

// Vite fingerprints these URLs and keeps them relative to the deployed game (GitHub Pages).
const urls = {
  grass: new URL('../../assets/textures/koepenick/grass.webp', import.meta.url).href,
  dirt: new URL('../../assets/textures/koepenick/dirt.webp', import.meta.url).href,
  paving: new URL('../../assets/textures/koepenick/paving.webp', import.meta.url).href,
  leaves: new URL('../../assets/textures/koepenick/leaves.webp', import.meta.url).href,
  litter: new URL('../../assets/textures/koepenick/litter.webp', import.meta.url).href,
  asphalt: new URL('../../assets/textures/koepenick/asphalt.webp', import.meta.url).href,
  cobbles: new URL('../../assets/textures/common/cobbles.webp', import.meta.url).href,
};

/** Leave the painted fallback installed until the image is decoded; failures keep it in place. */
export function loadGroundTexture(surface: keyof typeof urls, anisotropy: number, swap: (texture: Texture) => void): void {
  const pending = new TextureLoader().load(urls[surface], texture => {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
    swap(texture);
  }, undefined, () => pending.dispose());
}
