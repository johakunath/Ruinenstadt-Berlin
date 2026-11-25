// KA part A (`docs/tasks/kit-texture-atlas.md`): one shared atlas on the enemy kit's baked `paint` and `metal`
// materials, so painted surfaces survive the per-bone bake at 0 draw calls. `assemble` remaps each baked part's UVs
// into the cell of its kit material and divides the cell's mean tone out of the vertex colour (the hero gear's
// grain pattern, `src/render/weapons.ts` `Parts.add`). Materials without a cell read one point at the centre of
// the plain white cell 0: zero UV derivatives sample mip 0 there, so they look exactly as before.
// The pure part (`paintPart`, the tables) has no WebGL and is unit tested; `kitAtlas` is browser only.
import { BufferAttribute, CanvasTexture, Color, SRGBColorSpace, type BufferGeometry, type Texture } from 'three';

export const KIT_ATLAS = { cols: 4, rows: 2, cell: 256, pad: 4 } as const;

/**
 * Mean sRGB tone per cell (r, g, b) inside its padding, measured from `kit.webp` (a test measures it again);
 * cell 0 is plain white, unpainted cells a flat 0xb8. Before the image is in, the canvas paints each cell this
 * flat tone, so colours equal the plain kit colours from the first frame.
 */
export const KIT_TONE: ReadonlyArray<readonly [number, number, number]> = [
  [255, 255, 255], [193, 181, 166], [192, 179, 164], [187, 182, 168],
  [191, 181, 182], [0xb8, 0xb8, 0xb8], [0xb8, 0xb8, 0xb8], [0xb8, 0xb8, 0xb8],
];

/** The painted cells (A2: filo side, filo top, brass; A3: ear skin; local FLUX.2 klein, `docs/local-ai-assets.md` round 5). */
export const KIT_ART_URL = new URL('../../assets/textures/enemies/kit.webp', import.meta.url).href;

/** A kit material's cell, and optionally a second cell for its up-facing triangles (the camera looks down). */
export interface KitCell { cell: number; top?: number }

/**
 * Kit materials with a painted cell; every other material uses cell 0. String keys, so this file does not import
 * `enemies.ts`. Cells: 0 plain, 1 filo side, 2 filo top, 3 brass, 4 ear skin, 5 to 7 spare. Mirror and tea glass
 * (A3) were painted and dropped: their parts are 3 to 6 cm and showed no change at the game camera.
 */
export const KIT_CELLS: Readonly<Record<string, KitCell>> = {
  filo: { cell: 1, top: 2 }, brass: { cell: 3 }, pink: { cell: 4 },
};

/** UV rect [u0, v0, u1, v1] of cell `i` inside its padding (v up: row 0 is the top half of the canvas). */
export function cellRect(i: number): [number, number, number, number] {
  const { cols, rows, cell, pad } = KIT_ATLAS, W = cols * cell, H = rows * cell;
  const col = i % cols, row = Math.floor(i / cols);
  const u0 = (col * cell + pad) / W, u1 = ((col + 1) * cell - pad) / W;
  const v1 = 1 - (row * cell + pad) / H, v0 = 1 - ((row + 1) * cell - pad) / H;
  return [u0, v0, u1, v1];
}

const _c = new Color(), _t = new Color();
/** Linear vertex colour of kit colour `hex` (sRGB) divided by the linear tone of `cell`. */
function divided(hex: number, cell: number): [number, number, number] {
  const [r, g, b] = KIT_TONE[cell] ?? KIT_TONE[0]!;
  _c.setHex(hex);
  _t.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
  return [_c.r / _t.r, _c.g / _t.g, _c.b / _t.b];
}

/**
 * Writes `color` (kit colour ÷ cell tone, linear) and remaps `uv` of one non-indexed part. `hex` is the kit
 * colour (sRGB). No cell: every UV on the centre of cell 0, colour unchanged. A cell: the part's own UVs clamped
 * to 0..1 and scaled into the padded cell; triangles facing up (normal y > 0.7) use the `top` cell if there is one.
 */
export function paintPart(flat: BufferGeometry, hex: number, cell?: KitCell): void {
  const pos = flat.attributes.position!, n = pos.count, src = flat.attributes.uv;
  // Always a new attribute: a part that was already non-indexed is the caller's own geometry (it may be reused).
  const uv = new BufferAttribute(new Float32Array(n * 2), 2);
  if (src && src.itemSize === 2) for (let i = 0; i < n; i++) uv.setXY(i, src.getX(i), src.getY(i));
  flat.setAttribute('uv', uv);
  const col = new Float32Array(n * 3);
  if (!cell) {
    const [u0, v0, u1, v1] = cellRect(0), cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    const c = divided(hex, 0);
    for (let i = 0; i < n; i++) { uv.setXY(i, cu, cv); col.set(c, i * 3); }
  } else {
    const side = divided(hex, cell.cell), top = cell.top === undefined ? side : divided(hex, cell.top);
    const rs = cellRect(cell.cell), rt = cell.top === undefined ? rs : cellRect(cell.top);
    for (let t = 0; t + 2 < n; t += 3) {
      // Face normal of the triangle (as built, the model at rest).
      const ax = pos.getX(t), ay = pos.getY(t), az = pos.getZ(t);
      const bx = pos.getX(t + 1) - ax, by = pos.getY(t + 1) - ay, bz = pos.getZ(t + 1) - az;
      const cx = pos.getX(t + 2) - ax, cy = pos.getY(t + 2) - ay, cz = pos.getZ(t + 2) - az;
      const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx, len = Math.hypot(nx, ny, nz);
      const up = cell.top !== undefined && len > 0 && ny / len > 0.7;
      const [u0, v0, u1, v1] = up ? rt : rs, c = up ? top : side;
      for (let k = t; k < t + 3; k++) {
        const u = Math.min(1, Math.max(0, uv.getX(k))), v = Math.min(1, Math.max(0, uv.getY(k)));
        uv.setXY(k, u0 + u * (u1 - u0), v0 + v * (v1 - v0));
        col.set(c, k * 3);
      }
    }
  }
  flat.setAttribute('color', new BufferAttribute(col, 3));
}

let atlas: CanvasTexture | undefined;
let ready: Promise<void> = Promise.resolve();
/** Resolves once the painted cells are in (or failed); render tools wait for it. */
export const kitReady = (): Promise<void> => ready;

/**
 * The shared atlas texture: every cell its flat tone (cell 0 white) until a painted image is drawn in (steps A2,
 * A3). One texture per game; `smallTextures` (Ausgewogen, Leistung) halves it. Browser only.
 */
export function kitAtlas(smallTextures: boolean): Texture {
  if (atlas) return atlas;
  const { cols, rows, cell } = KIT_ATLAS, s = smallTextures ? 0.5 : 1;
  const c = document.createElement('canvas');
  c.width = cols * cell * s;
  c.height = rows * cell * s;
  const g = c.getContext('2d')!;
  KIT_TONE.forEach(([r, gr, b], i) => {
    g.fillStyle = `rgb(${r},${gr},${b})`;
    g.fillRect((i % cols) * cell * s, Math.floor(i / cols) * cell * s, cell * s, cell * s);
  });
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 1;
  atlas = tex;
  // The painted cells replace the flat ones once loaded: one redraw and one re-upload (round 4 pattern).
  ready = new Promise((done) => {
    const img = new Image();
    img.onload = () => { g.drawImage(img, 0, 0, c.width, c.height); tex.needsUpdate = true; done(); };
    img.onerror = () => done();
    img.src = KIT_ART_URL;
  });
  return tex;
}
