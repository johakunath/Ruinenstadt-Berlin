import { describe, expect, it } from 'vitest';
import { CUT, PALETTES } from '../data/hero-look';
import { readHeroGlb } from './hero-glb-node';
import { ROLE_IDS, pieceInfo, pieceVariant } from './hero-wear';

const glb = readHeroGlb();
const counts = (node: string): Record<string, number> => {
  const info = pieceInfo(glb.mesh(node), node), out: Record<string, number> = {};
  for (const r of info.role) { const k = ROLE_IDS[r] ?? 'none'; out[k] = (out[k] ?? 0) + 1; }
  out.skirt = info.skirt.reduce((s, x) => s + x, 0);
  return out;
};

describe('piece roles (hero.glb)', () => {
  it('sorts every vertex of every piece into a role', () => {
    for (const node of ['a_mantel', 'a_weste', 'f_stiefel', 'f_turnsch', 'g_handsch', 'scarf']) expect(counts(node).none, node).toBeUndefined();
  });

  it('finds the coat parts: leather only at the belt, the skirt with its hem, the sleeve ends', () => {
    const c = counts('a_mantel');
    expect(c).toMatchObject({ trousers: 1479, brass: 216 });
    expect(c.leather).toBeGreaterThan(100);
    expect(c.skirt).toBeGreaterThan(200);
    expect(c.hem).toBeGreaterThan(20);
    expect(c.cuff).toBeGreaterThan(20);
    const v = counts('a_weste');
    expect(v).toMatchObject({ vest: 1090, cargo: 1482, brass: 168 });
    expect((v.straps ?? 0) + (v.belt ?? 0) + (v.thigh ?? 0)).toBe(504);
  });
});

describe('piece variants', () => {
  const coat = glb.mesh('a_mantel');
  const src = coat.geometry;

  it('cuts the skirt: a jacket drops every skirt triangle, a thigh cut keeps the rows above 0.79 m', () => {
    const info = pieceInfo(coat, 'a_mantel');
    const tris = (g: typeof src): number => g.index!.count / 3;
    const jacket = pieceVariant(coat, 'a_mantel', src, '', CUT.jacket, 0);
    const thigh = pieceVariant(coat, 'a_mantel', src, '', CUT.thigh, 0);
    expect(tris(src) - tris(jacket)).toBeGreaterThan(280);
    expect(tris(thigh)).toBeGreaterThan(tris(jacket));
    expect(tris(thigh)).toBeLessThan(tris(src));
    const pos = src.attributes.position!, idx = jacket.index!;
    for (let t = 0; t < idx.count; t += 3) {
      const all = [0, 1, 2].every((k) => info.skirt[idx.getX(t + k)] === 1);
      expect(all).toBe(false);
    }
    // Nothing of the skirt below the cut row is left on the thigh cut.
    const ti = thigh.index!;
    for (let t = 0; t < ti.count; t += 3) {
      const low = [0, 1, 2].every((k) => { const v = ti.getX(t + k); return info.skirt[v] === 1 && pos.getY(v) < CUT.thigh - 0.02; });
      expect(low).toBe(false);
    }
  });

  it('recolours a role and keeps its brightness pattern; other roles keep their colours', () => {
    const g = pieceVariant(coat, 'a_mantel', src, 'leder', 0, 0);
    const info = pieceInfo(coat, 'a_mantel');
    const a = src.attributes.color!, b = g.attributes.color!;
    const trousers = ROLE_IDS.indexOf('trousers');
    let i1 = -1, i2 = -1;
    for (let i = 0; i < a.count && (i1 < 0 || i2 < 0); i++) if (info.role[i] === ROLE_IDS.indexOf('coat')) { if (i1 < 0) i1 = i; else if (Math.abs(Math.max(a.getX(i), a.getY(i), a.getZ(i)) - Math.max(a.getX(i1), a.getY(i1), a.getZ(i1))) > 0.02) i2 = i; }
    const m = (c: typeof a, i: number): number => Math.max(c.getX(i), c.getY(i), c.getZ(i));
    expect(m(b, i1) / m(b, i2)).toBeCloseTo(m(a, i1) / m(a, i2), 3);
    expect(PALETTES.leder!.roles.trousers).toBeDefined();
    expect(info.role.indexOf(trousers)).toBeGreaterThanOrEqual(0);
    // The jeans colour is blue: blue channel above red on a trouser vertex.
    const t = info.role.indexOf(trousers);
    expect(b.getZ(t)).toBeGreaterThan(b.getX(t));
  });

  it('puffs only the upper body, by at most the puff', () => {
    const g = pieceVariant(coat, 'a_mantel', src, '', 0, 0.012);
    const a = src.attributes.position!, b = g.attributes.position!;
    let moved = 0;
    for (let i = 0; i < a.count; i++) {
      const d = Math.hypot(b.getX(i) - a.getX(i), b.getY(i) - a.getY(i), b.getZ(i) - a.getZ(i));
      expect(d).toBeLessThanOrEqual(0.0121);
      if (d > 0) { moved++; expect(a.getY(i)).toBeGreaterThan(1.2); }
    }
    expect(moved).toBeGreaterThan(100);
  });

  it('shares unchanged attributes with the source and caches variants', () => {
    const g = pieceVariant(coat, 'a_mantel', src, 'feuer', CUT.thigh, 0.012);
    expect(g.attributes.skinIndex).toBe(src.attributes.skinIndex);
    expect(g.attributes.normal).toBe(src.attributes.normal);
    expect(pieceVariant(coat, 'a_mantel', src, 'feuer', CUT.thigh, 0.012)).toBe(g);
    expect(pieceVariant(coat, 'a_mantel', src, '', 0, 0)).toBe(src);
  });
});
