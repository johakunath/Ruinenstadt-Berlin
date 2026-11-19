import { describe, expect, it } from 'vitest';
import { SETS, type AffixId, type SetId, type SlotId } from '../data/items';
import { weaponTraits } from '../data/weapon-look';
import type { Item } from './items';
import { gearAffixes, heroStats, lostSetTiers, power, setCount, type Equipment, type StatContext } from './stats';

const context = (change: Partial<StatContext> = {}): StatContext => ({ upgrades: {}, perks: {}, camp: {}, survivors: {}, ...change });
const item = (change: Partial<Item> = {}): Item => ({ id: 1, slot: 'w', kind: 'blade', base: 'rohr', name: 'Rostige Klinge', rarity: 0, value: 10, itemLevel: 1, affixes: [], ...change });
const eq = (change: Equipment = {}): Equipment => ({ w: item(), ...change });

describe('ported hero stats', () => {
  it('matches level-one 2D base stats, without mutating inputs', () => {
    const equipment = eq(), ctx = context(), before = JSON.stringify([equipment, ctx]);
    const s = heroStats(equipment, ctx);
    expect(s).toMatchObject({ kind: 'blade', damage: 10, maxHp: 100, crit: .08, moveSpeed: 1, attackSpeed: 1,
      regen: 0, res: 0, leech: 0, luck: 0, dashCooldown: 1.4, cooldownFactor: 1, reachFactor: 1,
      elements: [], elementChance: .3, elementPower: 1, eliteBonus: 0, weight: 0 });
    expect(power(s)).toBe(33); // round(sqrt(10 * 1.08 * 100))
    expect(JSON.stringify([equipment, ctx])).toBe(before);
    expect(() => heroStats({}, ctx)).toThrow('weapon');
  });

  it.each(['kiez', 'spree', 'zit'] as SetId[])('%s thresholds apply cumulatively at 2/3/5 pieces only', set => {
    // No main stats/implicits: isolate the set contributions.
    const expected = {
      kiez: [{}, { res: 25 }, { res: 25, dmg: 60 }, { res: 25, dmg: 60, crit: 15, hp: 100 }],
      spree: [{}, { as: 25 }, { as: 25, el: 80 }, { as: 25, el: 130, spd: 10 }],
      zit: [{}, { hp: 120 }, { hp: 120, dmg: 55, res: 20 }, { hp: 320, dmg: 55, res: 20, leech: 4 }],
    }[set];
    for (const n of [1, 2, 3, 4, 5]) {
      const equipment: Equipment = {};
      for (const slot of (Object.keys(SETS[set].pieces) as SlotId[]).slice(0, n)) equipment[slot] = item({ slot, set, value: 0, base: 'rohr', kind: slot === 't' || slot === 'r' ? 'krit' : 'blade' });
      expect(setCount(equipment, set)).toBe(n);
      const a = gearAffixes(equipment, context());
      const e = expected[n === 1 ? 0 : n === 2 ? 1 : n < 5 ? 2 : 3]!;
      for (const key of Object.keys(a) as AffixId[]) expect(a[key]).toBe((e as Partial<Record<AffixId, number>>)[key] ?? 0);
      expect(heroStats(equipment, context()).elements).toEqual(set === 'spree' && n >= 3 ? ['shock'] : []);
    }
  });

  it('names the set bonus tiers a swap would lose (2D #29)', () => {
    const piece = (slot: SlotId): Item => item({ slot, set: 'kiez', kind: slot === 't' ? 'krit' : 'blade' });
    const three: Equipment = { w: piece('w'), a: piece('a'), t: piece('t') };
    expect(lostSetTiers(three, item({ slot: 'a', kind: 'armor' }))).toEqual({ set: 'kiez', tiers: [3] });
    expect(lostSetTiers({ w: piece('w'), a: piece('a') }, item({ slot: 'a', kind: 'armor' }))).toEqual({ set: 'kiez', tiers: [2] });
    expect(lostSetTiers(three, piece('a'))).toBeNull();
    expect(lostSetTiers(three, item({ slot: 'h', kind: 'head' }))).toBeNull();
    expect(lostSetTiers({ w: piece('w') }, item())).toBeNull();
  });

  it('counts main stats, implicit, affixes and all implant modes', () => {
    const equipment = eq({ a: item({ slot: 'a', kind: 'armor', base: 'weste', value: 40, affixes: [{ id: 'hp', value: 10 }] }),
      t: item({ slot: 't', kind: 'krit', base: 'kiesel', value: 5 }), r: item({ slot: 'r', kind: 'heil', base: 'herz', value: 2 }) });
    expect(gearAffixes(equipment, context())).toMatchObject({ hp: 50, res: 7, spd: -4, crit: 5, regen: 3 });
    for (const [mode, key, value] of [[0, 'spd', 12], [1, 'as', 10], [2, 'res', 8]] as const) {
      expect(gearAffixes(eq({ i: item({ slot: 'i', kind: 'tempo', value: 3, implantMode: mode }) }), context())[key]).toBe(value + (key === 'spd' ? 3 : 0));
    }
    expect(gearAffixes(eq({ i: item({ slot: 'i', kind: 'krit', value: 0 }) }), context()).spd).toBe(12);
  });

  it('resolves legacy base names without mutation', () => {
    const w = item({ name: 'Sichel', base: '' });
    expect(gearAffixes(eq({ w }), context()).crit).toBe(3);
    expect(w.base).toBe('');
    expect(gearAffixes(eq({ a: item({ slot: 'a', kind: 'armor', base: '', name: 'unknown', value: 0 }) }), context()).spd).toBe(4);
  });

  it('deduplicates elements from weapon, mods, set and perks; retains mod mechanics', () => {
    const s = heroStats(eq({ w: item({ element: 'fire', mods: ['tank', 'batt', 'nagel', 'gewicht'] }) }), context({ perks: { fire: 1, acid: 1, shock: 1, elp: 2 } }));
    expect(s.elements).toEqual(['fire', 'shock', 'acid']);
    expect(s.elementChance).toBe(.5);
    expect(s.elementPower).toBeCloseTo(2.2);
    expect(s.eliteBonus).toBe(.2);
    expect(s.weight).toBe(4);
    expect(s.damage).toBe(12);
    // 10 × 1.7, × 1.1 for the shorter default hammer (D8).
    const d = heroStats(eq({ w: item({ kind: 'hammer' }) }), context({ perks: { m_dampf: 1 } }));
    expect(d.damage).toBeCloseTo(18.7);
    expect(d.attackSpeed).toBe(1 / 1.3);
  });

  it.each([['suppe', 135, 142], ['curry', 12.5, 13], ['kaffee', 1.18, 1.216], ['soljanka', 3, 3.6], ['gurke', 4, 5]] as const)('ports %s and Imbiss level 3', (meal, normal, stronger) => {
    const select = (s: ReturnType<typeof heroStats>): number => meal === 'suppe' ? s.maxHp : meal === 'curry' ? s.damage : meal === 'kaffee' ? s.attackSpeed : meal === 'soljanka' ? s.regen : s.luck;
    expect(select(heroStats(eq(), context({ meal })))).toBeCloseTo(normal);
    expect(select(heroStats(eq(), context({ meal, imbissLevel: 3 })))).toBeCloseTo(stronger);
    if (meal === 'kaffee') expect(heroStats(eq(), context({ meal, imbissLevel: 3 })).moveSpeed).toBeCloseTo(1.216);
    if (meal === 'soljanka') expect(heroStats(eq(), context({ meal, imbissLevel: 3 })).res).toBeCloseTo(.12);
  });

  it('clamps positive and negative stats and cooldowns', () => {
    const stats = (value: number) => heroStats(eq({ w: item({ affixes: (['crit', 'res', 'spd', 'as', 'cdr', 'hp', 'dmg', 'regen', 'leech', 'el'] as AffixId[]).map(id => ({ id, value })) }) }), context());
    expect(stats(1000)).toMatchObject({ crit: .75, res: .75, moveSpeed: 1.8, dashCooldown: .7, cooldownFactor: .5 });
    expect(stats(-1000)).toMatchObject({ crit: 0, res: -.5, moveSpeed: .5, attackSpeed: .4, maxHp: 20, damage: 1, regen: 0, leech: 0, elementPower: 0, cooldownFactor: 1 });
    expect(heroStats(eq(), context({ upgrades: { dash: 5 }, perks: { dashcd: 2 }, survivors: { mechaniker: true } })).dashCooldown).toBeCloseTo(.4536);
    expect(heroStats(eq({ w: item({ affixes: [{ id: 'cdr', value: 90 }] }) }), context({ upgrades: { dash: 5 }, perks: { dashcd: 2 } })).dashCooldown).toBe(.4);
  });

  it('matches three hand-calculated loadouts from the 2D formula', () => {
    // 20*(1+.14+.15+.20+.10)=31.8; round(140*1.2*1.1)=185.
    const a = heroStats(eq({ w: item({ value: 20, mods: ['nagel'] }), a: item({ slot: 'a', kind: 'armor', base: 'leder', value: 40 }) }), context({ upgrades: { dmg: 2, hp: 2 }, perks: { dmg: 1, hp: 1 }, drill: 5 }));
    expect(a.damage).toBeCloseTo(31.8); expect(a.maxHp).toBe(185); expect(a.moveSpeed).toBe(1.04);
    // 30*(1+.06+.30)*1.7=69.36, × 1.15 for the shorter Werkhammer (D8); as=(1+.24)/1.3; res=(8+10+8)/100+.12+.25=.63.
    const b = heroStats(eq({ w: item({ kind: 'hammer', base: 'werkh', value: 30, mods: ['dorn'] }), i: item({ slot: 'i', kind: 'krit', value: 5, implantMode: 2 }) }), context({ camp: { turm: true }, perks: { dmg: 2, rate: 2, res: 2, m_dampf: 1 }, shrines: { res: true } }));
    expect(b.damage).toBeCloseTo(69.36 * 1.15); expect(b.attackSpeed).toBeCloseTo(1.24 / 1.3); expect(b.res).toBeCloseTo(.63); expect(b.crit).toBeCloseTo(.13); expect(b.leech).toBe(5);
    // 40*(1+.07+.30+.04)=56.4; HP=round(150*1.15*1.04*1.42)=255; cooldown=.6*.8=.48.
    const c = heroStats(eq({ w: item({ value: 40, element: 'fire', mods: ['batt'] }), a: item({ slot: 'a', kind: 'armor', base: 'mantel', value: 50 }), r: item({ slot: 'r', kind: 'tempo', value: 8, affixes: [{ id: 'cdr', value: 20 }] }) }), context({ upgrades: { dmg: 1, hp: 3 }, perks: { dmg: 2, rate: 1, reach: 2, skill: 2 }, meal: 'suppe', imbissLevel: 3, drill: 2, survivors: { spaeher: true } }));
    expect(c.damage).toBeCloseTo(56.4); expect(c.maxHp).toBe(255); expect(c.attackSpeed).toBe(1.12); expect(c.moveSpeed).toBe(1.08); expect(c.regen).toBe(.5); expect(c.luck).toBe(1); expect(c.cooldownFactor).toBeCloseTo(.48); expect(c.reachFactor).toBe(1.4);
    // Includes both elements (.18*1.35*.5/.3*2), regen, movement and luck.
    expect(power(c)).toBe(187);
  });
  it('power compares weapon kinds by damage per second, as 2D pwParts', () => {
    const of = (kind: string, value: number): number => power(heroStats({ w: { id: 1, slot: 'w', kind, base: 'x', name: 'x', rarity: 0, value, itemLevel: 1, affixes: [] } }, { upgrades: {}, perks: {}, camp: {}, survivors: {} }));
    // Same item level: a hammer hits 2.3× as hard and 2.27× as slowly as a blade (before the D8 size factor).
    expect(of('hammer', 23 / weaponTraits('vorschlag').damage) / of('blade', 10)).toBeCloseTo(1, 1);
    expect(of('spear', 14.5) / of('blade', 10)).toBeCloseTo(Math.sqrt(1.45 * 0.3 / 0.5), 1);
  });

  it('folds the size of the base into reach and damage (WP4 D8), slings keep theirs', () => {
    const of = (change: Partial<Item>, ctx = context()) => heroStats(eq({ w: item(change) }), ctx);
    expect(of({ base: 'stahl' })).toMatchObject({ damage: 10, reachFactor: 1 });
    const cleaver = of({ base: 'brech' });
    expect(cleaver.damage).toBeCloseTo(12.5);
    expect(cleaver.reachFactor).toBeCloseTo(0.75);
    // The Weitblick blessing (+20 % reach per level) multiplies with it.
    expect(of({ base: 'brech' }, context({ perks: { reach: 1 } })).reachFactor).toBeCloseTo(0.9);
    expect(of({ kind: 'hammer', base: 'pflaster' }).reachFactor).toBeCloseTo(0.8);
    expect(of({ kind: 'sling', base: 'zwille' })).toMatchObject({ damage: 10, reachFactor: 1 });
    expect(of({ kind: 'hammer', base: 'pflaster' }).types).toEqual(['wucht', 'stich']);
    expect(of({ base: 'brech', set: 'kiez' }).reachFactor).toBeCloseTo(0.75);
  });
});
