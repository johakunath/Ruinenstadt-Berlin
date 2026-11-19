import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CUT, PALETTES, PIECES, WEAR, heroLook, hiddenRegions, lookNodes, sameLook } from './hero-look';
import * as N from './item-names';
import { SETS, type SetId } from './items';

/** Node names in the committed hero.glb. */
function heroNodes(): Set<string> {
  const buf = readFileSync(fileURLToPath(new URL('../../assets/characters/hero.glb', import.meta.url)));
  const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12))) as { nodes: { name?: string }[] };
  return new Set(json.nodes.map((n) => n.name ?? ''));
}

/** Every wearable item per slot: the name tables (through `BASES`) and the set pieces. */
const ITEMS = {
  a: [...N.ARMOR_NAMES, ...N.NEON_ARMOR_NAMES, ...N.GDR_ARMOR_NAMES, ...N.LEGENDARY_ARMOR_NAMES].map((n) => ({ base: N.BASES[n]! })),
  h: [...N.HEAD_NAMES, ...N.NEON_HEAD_NAMES, ...N.GDR_HEAD_NAMES, ...N.LEGENDARY_HEAD_NAMES].map((n) => ({ base: N.BASES[n]! })),
  g: [...N.HAND_NAMES, ...N.GDR_HAND_NAMES, ...N.LEGENDARY_HAND_NAMES].map((n) => ({ base: N.BASES[n]! })),
  f: [...N.FOOT_NAMES, ...N.LEGENDARY_FOOT_NAMES].map((n) => ({ base: N.BASES[n]! })),
} as Record<'a' | 'h' | 'g' | 'f', { base: string; set?: SetId }[]>;
for (const [id, s] of Object.entries(SETS)) for (const slot of ['a', 'h', 'g', 'f'] as const) { const p = s.pieces[slot]; if (p) ITEMS[slot].push({ base: p.base, set: id as SetId }); }

describe('heroLook', () => {
  const nodes = heroNodes();

  it('gives every wearable base its own wear entry and pieces that exist in hero.glb', () => {
    for (const slot of ['a', 'h', 'g', 'f'] as const) for (const it of ITEMS[slot]) {
      const key = it.set && WEAR[slot][`${it.base}:${it.set}`] ? `${it.base}:${it.set}` : it.base;
      expect(WEAR[slot][key], `${slot} ${key}`).toBeDefined();
      for (const node of lookNodes(heroLook({ [slot]: it }))) expect(nodes.has(node), `${slot} ${key}: ${node}`).toBe(true);
    }
    for (const p of Object.values(PIECES)) expect(nodes.has(p.node), p.node).toBe(true);
  });

  it('names only palettes that exist', () => {
    for (const slot of ['a', 'h', 'g', 'f'] as const) for (const [key, w] of Object.entries(WEAR[slot])) {
      for (const p of [w.palette, w.scarf]) if (p) expect(PALETTES[p], `${slot} ${key}: ${p}`).toBeDefined();
    }
  });

  it('keeps the 2D rule: the starter coat by default, the vest for the short outfits, bare hands without gloves', () => {
    const d = heroLook({});
    expect(d).toMatchObject({ outfit: 'mantel', cut: 0, boots: 'stiefel', gloves: null, gear: [], hideHair: false });
    expect(d.tint).toEqual({ outfit: '', boots: '', gloves: '', scarf: '' });
    expect(heroLook({ a: { base: 'weste' } }).outfit).toBe('weste');
    expect(heroLook({ a: { base: 'blaumann' } }).outfit).toBe('weste');
    expect(heroLook({ a: { base: 'rattenmantel' } }).outfit).toBe('mantel');
    expect(heroLook({ f: { base: 'turnsch' } }).boots).toBe('turnsch');
    expect(heroLook({ g: { base: 'bandage' } }).gloves).toBe('handsch');
  });

  it('builds the jackets by cutting the coat, never the vest', () => {
    expect(heroLook({ a: { base: 'leder' } })).toMatchObject({ outfit: 'mantel', cut: CUT.jacket });
    expect(heroLook({ a: { base: 'feuer' } }).cut).toBe(CUT.thigh);
    expect(heroLook({ a: { base: 'kette', set: 'zit' } }).cut).toBe(CUT.knee);
    expect(heroLook({ a: { base: 'weste', set: 'kiez' } }).cut).toBe(0);
  });

  it('looks up set pieces as base:set first (the Kiezwache vest is not the plain vest)', () => {
    const plain = heroLook({ a: { base: 'weste' } }), kiez = heroLook({ a: { base: 'weste', set: 'kiez' } });
    expect(kiez.tint.outfit).toBe('weste:kiez');
    expect(sameLook(plain, kiez)).toBe(false);
    expect(heroLook({ a: { base: 'mantel', set: 'spree' } }).tint.outfit).toBe('mantel:spree');
  });

  // Step 4 (2D #2): every legendary and set piece of the head, hand and foot slots looks different from the slot default.
  it('gives every legendary and set head, hand and foot piece a look of its own', () => {
    const base = { h: heroLook({ h: { base: 'helm' } }), g: heroLook({ g: { base: 'handsch' } }), f: heroLook({ f: { base: 'stiefel' } }) };
    for (const [slot, b] of [['h', 'pickel'], ['h', 'kiezhelm'], ['h', 'topfhelm'], ['g', 'kiezbox'], ['g', 'kiezhand'], ['f', 'schaffner'], ['f', 'spreestief'], ['f', 'eisenstief']] as const) {
      expect(sameLook(heroLook({ [slot]: { base: b } }), base[slot]), b).toBe(false);
    }
  });

  it('hides the regions under the worn pieces and gear only', () => {
    expect([...hiddenRegions(heroLook({}))].sort()).toEqual(['arms', 'feet', 'legs', 'torso']);
    expect([...hiddenRegions(heroLook({ a: { base: 'weste' }, g: { base: 'handsch' } }))].sort()).toEqual(['feet', 'hands', 'legs', 'torso']);
    // Boxing gloves replace the glove piece and cover the hands.
    const box = heroLook({ g: { base: 'kiezbox' } });
    expect(box.gloves).toBeNull();
    expect(hiddenRegions(box).has('hands')).toBe(true);
    expect(heroLook({ h: { base: 'topfhelm' } }).hideHair).toBe(true);
  });

  it('sorts gear ids, so the same items always share one merged gear mesh', () => {
    const g = heroLook({ a: { base: 'ritter' }, h: { base: 'pickel' } }).gear;
    expect([...g].sort()).toEqual(g);
  });
});
