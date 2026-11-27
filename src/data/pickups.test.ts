import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MATERIALS, type IngredientId, type MaterialId } from './crafting';
import { SLOTS, WEAPON_KINDS, type WeaponKindId } from './items';
import { DEBUG_DROPS, PICKUP_MODELS, PICKUP_SAMPLES, pickupModel, type PickupModelId } from './pickups';
import type { Item } from '../sim/items';
import type { DropContent } from '../sim/loot';

const item = (slot: Item['slot'], kind: string): DropContent => ({ kind: 'item', item: { id: 1, slot, kind, base: 'x', name: 'x', rarity: 0, value: 1, itemLevel: 1, affixes: [] } });

/** The JSON chunk of a GLB. */
function glbJson(file: string): { nodes: { name: string; mesh?: number }[]; meshes: { primitives: { indices: number; material: number }[] }[]; accessors: { count: number }[]; materials: unknown[]; textures: unknown[]; images: unknown[] } {
  const b = readFileSync(file);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

describe('pickup models (WP4 step 3, D4)', () => {
  it('maps every drop kind and every item slot to a model', () => {
    const seen = new Set<PickupModelId>();
    const check = (c: DropContent): void => {
      const m = pickupModel(c);
      expect(PICKUP_MODELS).toContain(m);
      seen.add(m);
    };
    check({ kind: 'heal' });
    check({ kind: 'food' });
    for (const id of Object.keys(MATERIALS) as MaterialId[]) check({ kind: 'material', id });
    for (const id of Object.keys(INGREDIENTS) as IngredientId[]) check({ kind: 'ingredient', id });
    for (const kind of Object.keys(WEAPON_KINDS) as WeaponKindId[]) check(item('w', kind));
    for (const slot of SLOTS.filter((s) => s !== 'w')) for (const kind of ['krit', 'tempo', 'heil', 'armor', 'head', 'hand', 'feet']) check(item(slot, kind));
    // Every model is used by some drop, and each weapon kind and slot gets its own.
    expect([...seen].sort()).toEqual([...PICKUP_MODELS].sort());
    expect(new Set((Object.keys(WEAPON_KINDS) as WeaponKindId[]).map((k) => pickupModel(item('w', k)))).size).toBe(4);
    expect(new Set(SLOTS.filter((s) => s !== 'w').map((s) => pickupModel(item(s, 'krit')))).size).toBe(7);
    // An unknown weapon kind still draws a weapon.
    expect(pickupModel(item('w', 'dolch'))).toBe('blade');
  });

  it('has a sample drop of its own kind per model, and the debug drops cover every model', () => {
    for (const id of PICKUP_MODELS) expect(pickupModel(PICKUP_SAMPLES[id](2))).toBe(id);
    expect(new Set(DEBUG_DROPS.map(([m]) => m)).size).toBe(PICKUP_MODELS.length);
    // The first 12 (the G2 proof shot) hold every rarity and a set piece.
    const first = DEBUG_DROPS.slice(0, 12).map(([, r]) => r);
    for (const r of [0, 1, 2, 3, 'set'] as const) expect(first).toContain(r);
  });

  it('ships every model in one GLB with one material and texture, within the triangle budget', () => {
    const g = glbJson('assets/props/pickups.glb');
    expect(g.materials).toHaveLength(1);
    expect(g.textures).toHaveLength(1);
    expect(g.images).toHaveLength(1);
    for (const id of PICKUP_MODELS) {
      const node = g.nodes.find((n) => n.name === id);
      expect(node, id).toBeDefined();
      const prims = g.meshes[node!.mesh!]!.primitives;
      expect(prims).toHaveLength(1);
      // D3: about 160 each; 400 at most.
      expect(g.accessors[prims[0]!.indices]!.count / 3, id).toBeLessThanOrEqual(400);
    }
  });
});
