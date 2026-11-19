import { describe, expect, it } from 'vitest';
import { AFFIXES, LEGENDARY_ELEMENTS, SETS, SLOTS, type RarityId, type SlotId } from '../data/items';
import { BASES } from '../data/item-names';
import { Rng } from './math';
import { avgIl, isUpgrade, lootItem, makeItem, makeSetItem, price, rollRarity, salvage, scrapValue, shownLevel, type Item, type LootContext } from './items';

const context = (overrides: Partial<LootContext> = {}): LootContext => ({ district: 0, luck: 0, wave: 1, ...overrides });
const piece = (overrides: Partial<Item> = {}): Item => ({ id: 1, slot: 'w', kind: 'blade', base: 'rohr', name: 'Rostige Klinge', rarity: 0, value: 10, itemLevel: 10, affixes: [], ...overrides });

/** Controlled draws test thresholds and rounding without relying on a seed's incidental values. */
class Draws extends Rng {
  constructor(private readonly draws: number[]) { super(1); }
  override next(): number {
    const value = this.draws.shift();
    if (value === undefined) throw new Error('Unexpected random draw');
    return value;
  }
}

describe('item generation', () => {
  it('replays a mixed sequence including ids and salvage with the same seed', () => {
    const sequence = () => {
      const rng = new Rng(23), ctx = context({ district: 3, luck: 8, wave: 12, flavor: 'neon' });
      return Array.from({ length: 100 }, () => {
        const item = lootItem(rng, ctx, 14);
        return { item, salvage: salvage(rng, item) };
      });
    };
    expect(sequence()).toEqual(sequence());
    expect(sequence().map(x => x.item.id)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('allocates ids across generators and resumes a caller-owned counter', () => {
    const ctx = context({ itemId: 70 }), rng = new Rng(4);
    expect(makeItem(rng, ctx, 1).id).toBe(71);
    expect(makeSetItem(rng, ctx, 1).id).toBe(72);
    expect(lootItem(rng, ctx, 1).id).toBe(73);
    expect(ctx.itemId).toBe(73);
    expect(makeItem(new Rng(4), context(), 1).id).toBe(1);
  });

  it.each([context(), context({ luck: 9, wave: 20 })])('matches 2D rarity weights within one percentage point: %j', ctx => {
    const rng = new Rng(42), counts = [0, 0, 0, 0];
    for (let i = 0; i < 10_000; i++) counts[rollRarity(rng, ctx)]!++;
    const l = ctx.luck, w = ctx.wave;
    const weights = [60, 18 + w * .6 + l * .8, 4 + w * .35 + l * .4, .1 + w * .04 + l * .03];
    const sum = weights.reduce((a, b) => a + b);
    weights.forEach((weight, i) => expect(Math.abs(counts[i]! / 10_000 - weight / sum)).toBeLessThan(.01));
  });

  it.each([0, 1, 2, 3])('respects minimum rarity %i', min => {
    const rng = new Rng(7), ctx = context();
    for (let i = 0; i < 200; i++) {
      expect(rollRarity(rng, ctx, min)).toBeGreaterThanOrEqual(min);
      expect(makeItem(rng, ctx, 2, min).rarity).toBeGreaterThanOrEqual(min);
    }
  });

  it('preserves base values, the district increment and magic suffix before affixes', () => {
    // white roll, weapon slot roll, midpoint multiplier, blade, first name
    const item = makeItem(new Draws([0, 0, .5, 0, 0]), context({ district: 2 }), 4);
    expect(item).toEqual(piece({ name: 'Rostige Klinge', value: 18, itemLevel: 10 }));
    const magic = makeItem(new Rng(2), context(), 1, 1, 'a');
    expect(magic.name).not.toBe(Object.entries(BASES).find(([, base]) => base === magic.base)?.[0]);
  });

  it.each(SLOTS)('generates valid normal and legendary pieces for forced slot %s', slot => {
    const rng = new Rng(12), ctx = context();
    for (const min of [0, 3]) for (let i = 0; i < 30; i++) {
      const item = makeItem(rng, ctx, 12, min, slot);
      expect(item.slot).toBe(slot);
      expect(Object.values(BASES)).toContain(item.base);
      expect(Number.isFinite(item.value)).toBe(true);
      expect(item.value).toBeGreaterThan(0);
      if (slot !== 'w') expect(item.element).toBeUndefined();
      if (min === 3 && slot === 'w') expect(item.element).toBe(LEGENDARY_ELEMENTS[item.base as keyof typeof LEGENDARY_ELEMENTS]);
      expect(new Set(item.affixes.map(a => a.id)).size).toBe(item.affixes.length);
      for (const a of item.affixes) {
        expect(AFFIXES[a.id]).toBeDefined();
        expect(a.value).not.toBe(0);
        expect(Number.isFinite(a.value)).toBe(true);
        if (!AFFIXES[a.id].decimals) expect(Number.isInteger(a.value)).toBe(true);
      }
      if (min === 3) expect(item.affixes.some(a => a.value < 0)).toBe(true);
    }
  });

  it('keeps ordinary items affix-free', () => {
    const item = makeItem(new Draws([0, 0, 0, 0, 0]), context(), 1);
    expect(item.affixes).toEqual([]);
    expect(item.element).toBeUndefined();
  });

  it('scales positive pact rolls and HP, leaves drawbacks unscaled and rounds regen to tenths', () => {
    const item = makeItem(new Draws([0, 0, .5, 0, 0, 0, 0, 0, .25, 0, .26, 0]), context(), 10, 3, 'w');
    expect(item.affixes).toEqual([
      { id: 'dmg', value: 40 }, { id: 'as', value: -15 },
      { id: 'hp', value: 40 }, { id: 'regen', value: .5 },
    ]);
    expect(item.element).toBe('fire');
  });

  it('uses neon and GDR weapon names and element overrides', () => {
    for (const flavor of ['neon', 'gdr'] as const) {
      const rng = new Rng(19), ctx = context({ flavor });
      const items = Array.from({ length: 500 }, () => makeItem(rng, ctx, 5, 1, 'w'));
      const flavored = items.filter(x => x.base === (flavor === 'neon' ? 'leucht' : 'sichel'));
      expect(flavored.length).toBeGreaterThan(0);
      expect(flavored.some(x => x.element === (flavor === 'neon' ? 'shock' : 'acid'))).toBe(true);
    }
    const rng = new Rng(7), ctx = context({ flavor: 'neon' });
    expect(Array.from({ length: 100 }, () => makeItem(rng, ctx, 2)).some(x => x.slot === 'i')).toBe(true);
  });

  it('drops the normal wear of its district: Köpenick only its own, Xhain both, later districts both (WP4 step 2)', () => {
    const wear = (district: number): Set<string> => {
      const rng = new Rng(31), ctx = context({ district });
      const out = new Set<string>();
      for (const slot of ['a', 'h', 'g', 'f'] as const) for (let i = 0; i < 400; i++) { const it = makeItem(rng, ctx, 5, 0, slot); if (it.rarity < 3) out.add(it.base); }
      return out;
    };
    const xhain = ['leder', 'feuer', 'bvg', 'muetze', 'maske', 'bandage', 'turnsch'];
    const k = wear(0), x = wear(1), a = wear(2);
    for (const b of xhain) expect(k.has(b), b).toBe(false);
    for (const b of ['mantel', 'weste', 'helm', 'schieber', 'handsch', 'schweiss', 'stiefel', 'gummi']) expect(k.has(b), b).toBe(true);
    for (const b of xhain) { expect(x.has(b), b).toBe(true); expect(a.has(b), b).toBe(true); }
    expect(x.has('mantel')).toBe(true);
  });

  it('drops the Tunnelläufer only in the tunnels, there in about 60 % of set drops', () => {
    const sets = (tunnel: boolean): Record<string, number> => {
      const rng = new Rng(5), ctx = context(tunnel ? { tunnel: true } : {}), n: Record<string, number> = {};
      for (let i = 0; i < 2000; i++) { const s = makeSetItem(rng, ctx, 5).set!; n[s] = (n[s] ?? 0) + 1; }
      return n;
    };
    expect(sets(false).tunnel).toBeUndefined();
    const t = sets(true);
    expect(t.tunnel! / 2000).toBeGreaterThan(0.55);
    expect(t.tunnel! / 2000).toBeLessThan(0.65);
    expect(t.kiez).toBeGreaterThan(0);
  });

  it('gives every set piece a finite value, the healing key ring too', () => {
    const rng = new Rng(9), ctx = context({ tunnel: true });
    for (let i = 0; i < 400; i++) expect(Number.isFinite(makeSetItem(rng, ctx, 6).value)).toBe(true);
  });

  it('rolls every set piece as rare, without an element or district level bonus', () => {
    const rng = new Rng(11), ctx = context({ district: 6 }), seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const item = makeSetItem(rng, ctx, 10);
      expect(item.rarity).toBe(2);
      expect(item.itemLevel).toBe(10);
      expect(item.element).toBeUndefined();
      expect(item.set).toBeDefined();
      const definition = SETS[item.set!].pieces[item.slot]!;
      expect([item.name, item.kind, item.base]).toEqual([definition.name, definition.kind, definition.base]);
      seen.add(`${item.set}:${item.slot}`);
    }
    expect(seen.size).toBe(15);
  });

  it('preserves the default set chance, zero fallback and rare sets even with min legendary', () => {
    for (const chance of [undefined, 0]) {
      const rng = new Rng(17), ctx = context();
      const items = Array.from({ length: 1000 }, () => lootItem(rng, ctx, 3, 3, chance));
      const sets = items.filter(x => x.set);
      expect(sets.length).toBeGreaterThan(25);
      expect(sets.length).toBeLessThan(75);
      expect(sets.every(x => x.rarity === 2)).toBe(true);
      expect(items.filter(x => !x.set).every(x => x.rarity === 3)).toBe(true);
    }
    expect(lootItem(new Rng(3), context(), 2, 3, 1).set).toBeDefined();
  });
});

describe('comparison and economy', () => {
  it.each([0, 1, 2, 3] as RarityId[])('adds the rarity level bonus and preserves prices at rarity %i', rarity => {
    const item = piece({ rarity });
    expect(shownLevel(item)).toBe([10, 13, 16, 20][rarity]);
    expect(scrapValue(item)).toBe([5, 14, 36, 90][rarity]);
    expect(price(item)).toBe([5, 11, 16, 22][rarity]);
  });

  it('compares shown levels strictly, ignoring damage and affixes', () => {
    expect(isUpgrade(piece(), undefined)).toBe(true);
    expect(isUpgrade(piece({ value: 999 }), piece())).toBe(false);
    expect(isUpgrade(piece({ rarity: 3, itemLevel: 1 }), piece())).toBe(true);
    expect(isUpgrade(piece({ itemLevel: 16 }), piece({ rarity: 2 }))).toBe(false);
    expect(isUpgrade(piece({ itemLevel: 17 }), piece({ rarity: 2 }))).toBe(true);
  });

  it('averages shown levels over occupied slots only and rounds', () => {
    expect(avgIl({})).toBe(0);
    expect(avgIl({ w: piece(), a: piece({ rarity: 1, itemLevel: 8 }) })).toBe(11);
  });

  it.each(SLOTS)('salvages slot %s without changing the item', (slot: SlotId) => {
    const allowed = { w: ['metall', 'kabel'], a: ['stoff', 'metall'], h: ['stoff', 'metall'], g: ['stoff', 'chemie'], f: ['stoff', 'metall'], t: ['kabel', 'chemie'], r: ['kabel', 'chemie'], i: ['kabel', 'chemie'] };
    const item = piece({ slot, rarity: 3 }), before = structuredClone(item);
    const result = salvage(new Rng(7), item);
    expect(result.scrap).toBe(90);
    expect(Object.values(result.materials).reduce((a, b) => a + b, 0)).toBe(3);
    expect(Object.keys(result.materials).every(id => allowed[slot].includes(id))).toBe(true);
    expect(item).toEqual(before);
  });

  it.each([0, 1, 2, 3] as RarityId[])('preserves fractional material counts at rarity %i', rarity => {
    const totals = [.3, .7, 1.5, 3], n = totals[rarity]!;
    for (const draw of [0, .999]) {
      const result = salvage(new Draws([draw, 0, 0, 0]), piece({ rarity }));
      expect(Object.values(result.materials).reduce((a, b) => a + b, 0)).toBe(Math.floor(n) + (draw < n % 1 ? 1 : 0));
    }
  });

  it('retains doubled metal weighting for weapon salvage', () => {
    const result = salvage(new Draws([0, 0, .34, .99]), piece({ rarity: 3 }));
    expect(result.materials).toEqual({ metall: 2, kabel: 1 });
  });
});
