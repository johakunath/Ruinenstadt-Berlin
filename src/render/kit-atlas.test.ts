import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, CylinderGeometry, SRGBColorSpace, type BufferGeometry } from 'three';
import sharp from 'sharp';
import { cellRect, KIT_ATLAS, KIT_CELLS, KIT_TONE, paintPart } from './kit-atlas';

const flat = (g: BufferGeometry): BufferGeometry => g.toNonIndexed();
/** sRGB channel values (0..255) of vertex `i`'s colour times the linear tone of `cell`. */
function shown(g: BufferGeometry, i: number, cell: number): [number, number, number] {
  const col = g.attributes.color!, [r, gr, b] = KIT_TONE[cell]!;
  const t = new Color().setRGB(r / 255, gr / 255, b / 255, SRGBColorSpace);
  const c = new Color(col.getX(i) * t.r, col.getY(i) * t.g, col.getZ(i) * t.b);
  const out = { r: 0, g: 0, b: 0 };
  c.getRGB(out, SRGBColorSpace);
  return [out.r * 255, out.g * 255, out.b * 255];
}
const rgbOf = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const inside = (u: number, v: number, [u0, v0, u1, v1]: readonly [number, number, number, number]): boolean => u >= u0 - 1e-6 && u <= u1 + 1e-6 && v >= v0 - 1e-6 && v <= v1 + 1e-6;

describe('kit atlas (KA part A)', () => {
  it('maps a part of a painted material inside its padded cell', () => {
    const g = flat(new CylinderGeometry(0.1, 0.1, 0.3, 8));
    paintPart(g, 0xc9a23a, KIT_CELLS.brass);
    const uv = g.attributes.uv!, r = cellRect(KIT_CELLS.brass!.cell);
    for (let i = 0; i < uv.count; i++) expect(inside(uv.getX(i), uv.getY(i), r)).toBe(true);
  });

  it('puts up-facing triangles of a material with a top cell into the top cell', () => {
    const g = flat(new BoxGeometry(0.3, 0.2, 0.3));
    paintPart(g, 0xe0a64a, KIT_CELLS.filo);
    const pos = g.attributes.position!, uv = g.attributes.uv!, top = cellRect(KIT_CELLS.filo!.top!), side = cellRect(KIT_CELLS.filo!.cell);
    let tops = 0;
    for (let t = 0; t < pos.count; t += 3) {
      const allUp = [0, 1, 2].every((k) => Math.abs(pos.getY(t + k) - 0.1) < 1e-6);
      for (let k = 0; k < 3; k++) expect(inside(uv.getX(t + k), uv.getY(t + k), allUp ? top : side)).toBe(true);
      if (allUp) tops++;
    }
    expect(tops).toBe(2);
  });

  it('vertex colour times the cell tone gives back the kit colour', () => {
    for (const [hex, cell] of [[0xc9a23a, KIT_CELLS.brass], [0xe0a64a, KIT_CELLS.filo], [0x6a2e26, undefined]] as const) {
      const g = flat(new BoxGeometry(0.2, 0.2, 0.2));
      paintPart(g, hex, cell);
      const want = rgbOf(hex), got = shown(g, 0, cell?.cell ?? 0);
      for (let c = 0; c < 3; c++) expect(Math.abs(got[c]! - want[c]!)).toBeLessThan(1);
    }
  });

  it('puts parts without a cell on the centre of cell 0 with the exact kit colour', () => {
    const g = flat(new BoxGeometry(0.2, 0.4, 0.2));
    paintPart(g, 0x3c3229);
    const [u0, v0, u1, v1] = cellRect(0), uv = g.attributes.uv!, col = g.attributes.color!, c = new Color().setHex(0x3c3229);
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeCloseTo((u0 + u1) / 2, 9);
      expect(uv.getY(i)).toBeCloseTo((v0 + v1) / 2, 9);
      expect([col.getX(i), col.getY(i), col.getZ(i)]).toEqual([c.r, c.g, c.b].map((x) => Math.fround(x)));
    }
  });

  it('never changes the source geometry of an already non-indexed part', () => {
    const g = flat(new BoxGeometry(0.2, 0.2, 0.2)), before = Array.from(g.attributes.uv!.array);
    const uvAttr = g.attributes.uv;
    paintPart(g, 0xc9a23a, KIT_CELLS.brass);
    expect(Array.from(uvAttr!.array)).toEqual(before);
    expect(g.attributes.uv).not.toBe(uvAttr);
  });

  it('gives a part without uv one', () => {
    const g = flat(new BoxGeometry(0.2, 0.2, 0.2));
    g.deleteAttribute('uv');
    paintPart(g, 0xc9a23a, KIT_CELLS.brass);
    expect(g.attributes.uv!.count).toBe(g.attributes.position!.count);
  });

  it('keeps every cell rect inside the atlas with its padding', () => {
    for (let i = 0; i < 8; i++) {
      const [u0, v0, u1, v1] = cellRect(i);
      expect(u0).toBeGreaterThan(0); expect(v0).toBeGreaterThan(0); expect(u1).toBeLessThan(1); expect(v1).toBeLessThan(1);
      expect(u1).toBeGreaterThan(u0); expect(v1).toBeGreaterThan(v0);
    }
  });

  it('KIT_TONE matches the mean of each cell of kit.webp inside its padding (within 2)', async () => {
    const { data, info } = await sharp('assets/textures/enemies/kit.webp').removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { cols, rows, cell, pad } = KIT_ATLAS;
    expect([info.width, info.height]).toEqual([cols * cell, rows * cell]);
    for (let i = 0; i < cols * rows; i++) {
      const x0 = (i % cols) * cell, y0 = Math.floor(i / cols) * cell, sum = [0, 0, 0];
      let n = 0;
      for (let y = y0 + pad; y < y0 + cell - pad; y++) for (let x = x0 + pad; x < x0 + cell - pad; x++, n++) {
        for (let c = 0; c < 3; c++) sum[c]! += data[(y * info.width + x) * 3 + c]!;
      }
      sum.forEach((v, c) => expect(Math.abs(v / n - KIT_TONE[i]![c]!)).toBeLessThanOrEqual(2));
    }
  });
});
