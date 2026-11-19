import { boxGeo } from './batch';
import { canvas, paintConcrete, toTexture, type PaintOptions } from './paint';

export const TUNNEL_WALLS_URL = new URL('../../assets/textures/tunnel/walls.webp', import.meta.url).href;
const ATLAS_SIZE = 2048;
const CELL = ATLAS_SIZE / 2;
const PAD = 2 / ATLAS_SIZE;

/** Keep the tunnel's concrete in its original batch while its painted atlas loads. */
export function paintTunnelAtlas(options: PaintOptions) {
  const [atlas, ctx] = canvas(ATLAS_SIZE, ATLAS_SIZE);
  const concrete = paintConcrete(options).map;
  const image = concrete.image as HTMLCanvasElement;
  for (let i = 0; i < 4; i++) ctx.drawImage(image, (i % 2) * CELL, (i >> 1) * CELL, CELL, CELL);
  concrete.dispose();
  return toTexture(atlas, false, options.anisotropy);
}

/** A world-meter box keeps its original positions and triangles. Only its diffuse UVs change. */
export function tunnelBoxGeo(sx: number, sy: number, sz: number, variant = 0, segment = 0, wall = false) {
  const box = boxGeo(sx, sy, sz, 1);
  const uv = box.getAttribute('uv');
  const u0 = (variant % 2) * 0.5 + PAD;
  const v0 = (1 - (variant >> 1)) * 0.5 + PAD;
  const span = 0.5 - 2 * PAD;
  for (let i = 0; i < uv.count; i++) {
    // On the vertical side of the tube, four consecutive metre segments share one full-width cell.
    // Top and end faces sample the same material with a local projection.
    const along = uv.getX(i) / sz;
    const u = i < 8 && wall ? (segment + (i < 4 ? 1 - along : along)) / 4 : Math.min(1, uv.getX(i) / 4);
    const v = Math.min(1, uv.getY(i) / (variant === 3 ? 1.8 : 4.6));
    uv.setXY(i, u0 + span * u, v0 + span * v);
  }
  return box;
}
