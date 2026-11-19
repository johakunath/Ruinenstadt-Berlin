// WP4 step 2 gear contract: every gear id named by a look has a builder; parts ride on real bones; every
// combination of armor, hat, gloves and boots stays inside the gear budget and the hero's draw calls (D3).
import { describe, expect, it } from 'vitest';
import { HERO_BUDGET } from '../data/hero-contract';
import { WEAR, heroLook } from '../data/hero-look';
import { GEAR, GEAR_BUDGET, gearGeometry, gearTriangles, type GearSlot } from './gear';
import { GearKit } from './gear-kit';
import { readHeroGlb } from './hero-glb-node';

const glb = readHeroGlb();
const ids = [...new Set(Object.values(WEAR).flatMap((t) => Object.values(t).flatMap((w) => w.gear ?? [])))];
/** Skinned meshes of the default look without gear (`hero-contract.test.ts`: 8). */
const BODY_DRAWS = 8;

describe('hero gear', () => {
  it('has a builder for every gear id a look names', () => {
    for (const id of ids) expect(GEAR[id], id).toBeDefined();
  });

  it('builds every part on a bone of the hero skeleton, with triangles', () => {
    for (const id of ids) {
      const k = new GearKit(glb.source);
      GEAR[id]!(k);
      expect(k.parts.list.length, id).toBeGreaterThan(0);
      for (const p of k.parts.list) expect(glb.bones, `${id}: ${p.tag}`).toContain(p.tag);
    }
  });

  it('keeps every combination of armor, hat, gloves and boots inside the gear budget and 11 draw calls', () => {
    // Triangles add up per id (parts never merge across ids), so the worst look is the sum of the worst per slot.
    const per = new Map(ids.map((id) => [id, gearTriangles(gearGeometry(glb.source, glb.bones, [id]))]));
    const worst = (slot: 'a' | 'h' | 'g' | 'f'): { tris: number; glow: number; slots: Set<GearSlot>; key: string } => {
      let best = { tris: 0, glow: 0, slots: new Set<GearSlot>(), key: '' };
      for (const [key, w] of Object.entries(WEAR[slot])) {
        const t = (w.gear ?? []).map((id) => per.get(id)!);
        const tris = t.reduce((s, x) => s + x.matte + x.metal + x.glow, 0), glow = t.reduce((s, x) => s + x.glow, 0);
        if (tris > best.tris) best = { tris, glow, slots: new Set(t.flatMap((x) => (['matte', 'metal', 'glow'] as const).filter((s) => x[s] > 0))), key };
      }
      return best;
    };
    const w = (['a', 'h', 'g', 'f'] as const).map(worst);
    const tris = w.reduce((s, x) => s + x.tris, 0);
    expect(tris, w.map((x) => `${x.key} ${x.tris}`).join(', ')).toBeLessThanOrEqual(GEAR_BUDGET.triangles);
    // Glow: the worst single slot pair can glow together; bound by the sum of the worst glow per slot.
    let glow = 0;
    for (const slot of ['a', 'h', 'g', 'f'] as const) glow += Math.max(0, ...Object.values(WEAR[slot]).map((x) => (x.gear ?? []).reduce((s, id) => s + per.get(id)!.glow, 0)));
    expect(glow).toBeLessThanOrEqual(GEAR_BUDGET.glow);
    // At most the three gear meshes on top of the body.
    expect(BODY_DRAWS + 3).toBeLessThanOrEqual(HERO_BUDGET.skinnedDrawCalls);
  });

  it('merges a look into at most three meshes, cached per id list', () => {
    const look = heroLook({ a: { base: 'ritter' }, h: { base: 'pickel' }, g: { base: 'kiezbox' }, f: { base: 'eisenstief' } });
    const a = gearGeometry(glb.source, glb.bones, look.gear);
    expect(Object.keys(a).length).toBeLessThanOrEqual(3);
    expect(gearGeometry(glb.source, glb.bones, look.gear)).toBe(a);
    for (const g of Object.values(a)) {
      expect(g.attributes.skinIndex!.itemSize).toBe(4);
      expect(g.attributes.uv).toBeDefined();
      expect(g.attributes.color).toBeDefined();
    }
  });
});
