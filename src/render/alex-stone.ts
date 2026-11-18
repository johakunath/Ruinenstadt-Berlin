import { type BufferGeometry, type Texture } from 'three';
import { boxGeo } from './batch';
import { canvas, toTexture } from './paint';

const SIZE = 2048;
const REGIONS = {
  sandstone: [0, 0, 1024, 1024, 4, 4],
  copper: [1024, 0, 1024, 1024, 1, 1],
  terracotta: [0, 1024, 2048, 256, 8, 1],
} as const;
export type AlexStone = keyof typeof REGIONS;
export const ALEX_STONE_URL = new URL('../../assets/textures/alex/stone-atlas.webp', import.meta.url).href;

/** Keep stone, copper and relief in the existing stucco batch. */
export function paintAlexStoneAtlas(fallback: Texture, anisotropy: number): Texture {
  const [atlas, ctx] = canvas(SIZE, SIZE);
  const image = fallback.image as HTMLCanvasElement;
  for (const [x, y, width, height, columns, rows] of Object.values(REGIONS)) {
    const w = width / columns, h = height / rows;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      ctx.drawImage(image, x + col * w, y + row * h, w, h);
    }
  }
  return toTexture(atlas, false, anisotropy);
}

function atlasUvs(geometry: BufferGeometry, kind: AlexStone): BufferGeometry {
  const [x, y, width, height, columns, rows] = REGIONS[kind];
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const u = Math.min(1, Math.max(0, uv.getX(i) / columns));
    const v = Math.min(1, Math.max(0, uv.getY(i) / rows));
    uv.setXY(i, (x + 2 + u * (width - 4)) / SIZE, 1 - (y + height - 2 - v * (height - 4)) / SIZE);
  }
  return geometry;
}

export function alexStoneBoxGeo(sx: number, sy: number, sz: number, kind: AlexStone = 'sandstone'): BufferGeometry {
  const geo = boxGeo(sx, sy, sz, 0.25);
  if (kind === 'terracotta') {
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (4 / sy));
  }
  return atlasUvs(geo, kind);
}

const stoneGeometry = new WeakMap<BufferGeometry, Partial<Record<AlexStone, BufferGeometry>>>();
export function alexStoneGeo(geometry: BufferGeometry, kind: AlexStone = 'sandstone'): BufferGeometry {
  let variants = stoneGeometry.get(geometry);
  if (!variants) stoneGeometry.set(geometry, (variants = {}));
  return variants[kind] ??= atlasUvs(geometry.clone(), kind);
}
