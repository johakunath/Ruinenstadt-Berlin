import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PIECES, heroLook, hiddenRegions, lookNodes, sameLook } from './hero-look';
import { BASES } from './item-names';
import type { BaseId } from './items';

/** Node names in the committed hero.glb. */
function heroNodes(): Set<string> {
  const buf = readFileSync(fileURLToPath(new URL('../../assets/characters/hero.glb', import.meta.url)));
  const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12))) as { nodes: { name?: string }[] };
  return new Set(json.nodes.map((n) => n.name ?? ''));
}

describe('heroLook', () => {
  const nodes = heroNodes();
  const bases = [...new Set(Object.values(BASES))] as BaseId[];

  it('resolves every armor, glove and boot base to pieces that exist in hero.glb', () => {
    for (const base of bases) {
      for (const slot of ['a', 'f', 'g'] as const) {
        for (const node of lookNodes(heroLook({ [slot]: { base } }))) expect(nodes.has(node), `${slot} ${base}: ${node}`).toBe(true);
      }
    }
    for (const p of Object.values(PIECES)) expect(nodes.has(p.node), p.node).toBe(true);
  });

  it('follows the 2D rule: long coat by default, short outfits as the vest, bare hands without gloves', () => {
    expect(heroLook({})).toEqual({ outfit: 'mantel', boots: 'stiefel', gloves: null, hat: null });
    expect(heroLook({ a: { base: 'weste' } }).outfit).toBe('weste');
    expect(heroLook({ a: { base: 'blaumann' } }).outfit).toBe('weste');
    expect(heroLook({ a: { base: 'leder' } }).outfit).toBe('weste');
    expect(heroLook({ a: { base: 'rattenmantel' } }).outfit).toBe('mantel');
    expect(heroLook({ f: { base: 'turnsch' } }).boots).toBe('turnsch');
    expect(heroLook({ f: { base: 'gummi' } }).boots).toBe('stiefel');
    expect(heroLook({ g: { base: 'bandage' } }).gloves).toBe('handsch');
  });

  it('hides the regions under the worn pieces only', () => {
    expect([...hiddenRegions(heroLook({}))].sort()).toEqual(['arms', 'feet', 'legs', 'torso']);
    expect([...hiddenRegions(heroLook({ a: { base: 'weste' }, g: { base: 'handsch' } }))].sort()).toEqual(['feet', 'hands', 'legs', 'torso']);
    expect(sameLook(heroLook({}), heroLook({ f: { base: 'gummi' } }))).toBe(true);
  });
});
