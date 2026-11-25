import { describe, expect, it } from 'vitest';
import { CUT, PALETTES, type Palette } from '../data/hero-look';
import { readHeroGlb } from './hero-glb-node';
import { CHART_AXES, ROLE_IDS, chartOf, detailAttributes, ensureDetail, pieceInfo, pieceVariant } from './hero-wear';

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

describe('coat detail (KA part B)', () => {
  const coat = glb.mesh('a_mantel');
  const src = coat.geometry;

  it('the coat uv is linear in the two bind axes of each chart (fails if the coat is unwrapped again)', () => {
    const pos = src.attributes.position!, uv = src.attributes.uv!;
    const byChart = new Map<number, number[]>();
    for (let i = 0; i < pos.count; i++) { const c = chartOf(uv.getX(i), uv.getY(i)); (byChart.get(c) ?? byChart.set(c, []).get(c)!).push(i); }
    expect(byChart.size).toBe(6);
    for (const [c, ids] of byChart) {
      const [a, b] = CHART_AXES[c]!;
      for (const comp of [0, 1] as const) {
        // Least squares fit uv = p·A + q·B + r over the chart, then the worst residual.
        let sAA = 0, sAB = 0, sBB = 0, sA = 0, sB = 0, sU = 0, sAU = 0, sBU = 0;
        const n = ids.length;
        for (const i of ids) {
          const A = pos.getComponent(i, a), B = pos.getComponent(i, b), U = uv.getComponent(i, comp);
          sAA += A * A; sAB += A * B; sBB += B * B; sA += A; sB += B; sU += U; sAU += A * U; sBU += B * U;
        }
        const M = [[sAA, sAB, sA], [sAB, sBB, sB], [sA, sB, n]], y = [sAU, sBU, sU];
        const det = (m: number[][]): number => m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) - m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) + m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
        const D = det(M), col = (k: number): number[][] => M.map((row, r) => row.map((v, j) => (j === k ? y[r]! : v)));
        const [p, q, r] = [0, 1, 2].map((k) => det(col(k)) / D) as [number, number, number];
        let worst = 0;
        for (const i of ids) worst = Math.max(worst, Math.abs(p * pos.getComponent(i, a) + q * pos.getComponent(i, b) + r - uv.getComponent(i, comp)));
        expect(worst, `chart ${c} uv.${comp ? 'v' : 'u'}`).toBeLessThan(1e-3);
      }
    }
  });

  it('a palette with detail weights only its roles, in the detail channel', () => {
    (PALETTES as Record<string, Palette>)['test:denim'] = { roles: { trousers: '#3a4a6a' }, detail: { trousers: 'denim' } };
    const info = pieceInfo(coat, 'a_mantel');
    const g = pieceVariant(coat, 'a_mantel', src, 'test:denim', 0, 0);
    const w = g.attributes.detailW!, trousers = ROLE_IDS.indexOf('trousers');
    let on = 0;
    for (let i = 0; i < w.count; i++) {
      const isT = info.role[i] === trousers;
      expect([w.getX(i), w.getY(i), w.getZ(i)]).toEqual(isT ? [1, 0, 0] : [0, 0, 0]);
      if (isT) on++;
    }
    expect(on).toBe(1479);
    delete (PALETTES as Record<string, Palette>)['test:denim'];
  });

  it('detailUv advances by 1 per tile along both chart axes', () => {
    (PALETTES as Record<string, Palette>)['test:mail'] = { roles: {}, detail: { coat: 'mail' } };
    const info = pieceInfo(coat, 'a_mantel');
    const d = detailAttributes(src, info, 'test:mail'), pos = src.attributes.position!, uv = src.attributes.uv!;
    for (const i of [0, 100, 1000, 3000]) {
      const [a, b] = CHART_AXES[chartOf(uv.getX(i), uv.getY(i))]!, tile = ROLE_IDS[info.role[i]!] === 'coat' ? 0.3 : 1;
      expect(d.uv.getX(i)).toBeCloseTo(pos.getComponent(i, a) / tile, 6);
      expect(d.uv.getY(i)).toBeCloseTo(pos.getComponent(i, b) / tile, 6);
    }
    delete (PALETTES as Record<string, Palette>)['test:mail'];
  });

  it('a palette without detail shares the zero pair, and variants stay cached', () => {
    const info = pieceInfo(coat, 'a_mantel');
    const a = detailAttributes(src, info, 'leder'), b = detailAttributes(src, info, '');
    expect(a.w).toBe(b.w);
    expect(Array.from(a.w.array).every((x) => x === 0)).toBe(true);
    const v1 = pieceVariant(coat, 'a_mantel', src, 'leder', 0, 0), v2 = pieceVariant(coat, 'a_mantel', src, 'leder', 0, 0);
    expect(v1).toBe(v2);
    expect(v1.attributes.detailW).toBe(a.w);
    ensureDetail('a_mantel', src);
    expect(src.attributes.detailW).toBe(a.w);
  });
});
