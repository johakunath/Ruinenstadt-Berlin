// M13b trade rules: stock, prices, buy and sell, Aufsätze, blessings (buy, swap, Stärkung).
import { describe, expect, it } from 'vitest';
import { WEAPON_MODS } from '../data/crafting';
import { koepenickMap } from '../data/koepenick';
import { generateLots, generateProps, mapLevel } from '../data/map';
import { PERKS, type PerkId } from '../data/progression';
import { rerollCost } from './blessings';
import { buildMod } from './camp';
import { setLoadout } from './loadout';
import { Rng } from './math';
import { parseSave, simFromSave, snapshot } from './save';
import { createSim, stepSim } from './sim';
import { heroStats } from './stats';
import {
  blessPrice, buyBlessing, buyMod, buyOffer, gearPrice, modPrice, rollSpati, rollTrader, sellBulk, sellItem, spatiGear, stockExtras,
  strengthenable, strengthenBlessing, swapBlessing, swapBlock, TRADE, tradeShop, type ShopStock,
} from './trade';
import { talkTo } from './runcontent';
import { NO_INPUT, type Sim } from './types';

type Perks = Partial<Record<PerkId, number>>;
/** An empty-map hero with these blessings, standing at an open Späti with `stock`. */
function atSpati(perks: Perks = {}, seed = 1, stock?: Partial<ShopStock>): Sim {
  const s = createSim({ empty: true, seed });
  setLoadout(s, s.equipment, { perks });
  s.content.shops[0] = { offers: [], left: false, mod: null, cards: [], ups: TRADE.ups, ...stock };
  s.content.tradeOpen = true;
  s.content.tradeAt = 0;
  return s;
}
const card = (id: PerkId, level: 1 | 2 = 1, quality: 0 | 1 | 2 = 0): { id: PerkId; level: 1 | 2; quality: 0 | 1 | 2 } => ({ id, level, quality });

describe('stock (2D trader, M13b Späti)', () => {
  it('a Späti rolls four gear pieces (2D prices), one Aufsatz, two blessing cards the hero does not hold and one Stärkung', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createSim({ empty: true, seed });
      setLoadout(s, s.equipment, { perks: { dmg: 2, hp: 1 } });
      const shop = rollSpati(s, new Rng(seed));
      expect(shop.offers).toHaveLength(TRADE.gear);
      for (const o of shop.offers) expect(o!.price).toBe(gearPrice(o!.item));
      expect(WEAPON_MODS.some((m) => m.id === shop.mod?.id)).toBe(true);
      expect(shop.cards).toHaveLength(TRADE.cards);
      for (const c of shop.cards!) {
        expect(['dmg', 'hp']).not.toContain(c!.id);
        expect(PERKS.find((p) => p.id === c!.id)!.weapon).toBeUndefined();
      }
      expect(new Set(shop.cards!.map((c) => c!.id)).size).toBe(TRADE.cards);
      expect(shop.ups).toBe(TRADE.ups);
    }
  });
  it('the extras do not advance the content stream (events later in the run stay where they were)', () => {
    const s = createSim({ empty: true, seed: 4 });
    const a = new Rng(77), b = new Rng(77);
    const shop = rollSpati(s, a);
    const t = createSim({ empty: true, seed: 4 });
    expect(spatiGear(t, b).map((o) => o!.item.name)).toEqual(shop.offers.map((o) => o!.item.name));
    expect(a.state).toBe(b.state);
  });
  it('same stream, same stock', () => {
    const one = rollSpati(createSim({ empty: true, seed: 9 }), new Rng(5));
    const two = rollSpati(createSim({ empty: true, seed: 9 }), new Rng(5));
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
  });
  it('2D trader: three rare pieces, Kurier Jonas a fourth; Mitte (neon) always offers an implant second', () => {
    const s = createSim({ empty: true, seed: 2 });
    const offers = rollTrader(s, new Rng(3));
    expect(offers).toHaveLength(3);
    expect(offers.every((o) => o.item.rarity >= 2)).toBe(true);
    setLoadout(s, s.equipment, { survivors: { kurier: true } });
    expect(rollTrader(s, new Rng(3))).toHaveLength(4);
    s.lootCtx.flavor = 'neon';
    for (let k = 1; k <= 10; k++) {
      expect(rollTrader(s, new Rng(k))[1]!.item.slot).toBe('i');
      expect(rollSpati(s, new Rng(k)).offers[1]!.item.slot).toBe('i');
    }
  });
  it('2D tunnel trader: the third offer is legendary about 30 % of the time (event trader 15 %)', () => {
    const share = (tunnel: boolean): number => {
      const s = createSim({ empty: true, seed: 2 });
      if (tunnel) s.lootCtx.tunnel = true;
      let n = 0;
      for (let k = 1; k <= 600; k++) if (rollTrader(s, new Rng(k))[2]!.item.rarity === 3) n++;
      return n / 600;
    };
    const t = share(true), e = share(false);
    expect(t).toBeGreaterThan(0.22);
    expect(t).toBeLessThan(0.38);
    expect(e).toBeGreaterThan(0.09);
    expect(e).toBeLessThan(0.21);
  });
  it('Aufsatz: Köpenick sells the 2D ones; from Xhain on about half are strong; one the hero has is avoided', () => {
    const s = createSim({ empty: true, seed: 2 });
    for (let k = 1; k <= 40; k++) expect(WEAPON_MODS.find((m) => m.id === rollSpati(s, new Rng(k)).mod!.id)!.spati).toBeUndefined();
    s.lootCtx.district = 1;
    let strong = 0;
    for (let k = 1; k <= 200; k++) if (WEAPON_MODS.find((m) => m.id === rollSpati(s, new Rng(k)).mod!.id)!.spati) strong++;
    expect(strong / 200).toBeGreaterThan(0.38);
    expect(strong / 200).toBeLessThan(0.62);
    s.lootCtx.district = 0;
    s.inventory.mods = { nagel: 1, gewicht: 1, batt: 1, tank: 1, phiole: 1 };
    for (let k = 1; k <= 20; k++) expect(rollSpati(s, new Rng(k)).mod!.id).toBe('dorn');
  });
});

describe('buy and sell', () => {
  it('sells a bag piece for its salvage value, only while trading, never a locked one', () => {
    const s = atSpati();
    const w = s.equipment.w!;
    s.inventory.bag.push({ ...structuredClone(w), id: 501, itemLevel: 10, rarity: 2 }, { ...structuredClone(w), id: 502, locked: true });
    const before = s.inventory.scrap;
    expect(sellItem(s, 1)).toEqual({ ok: false, text: 'Gesperrt.' });
    const r = sellItem(s, 0);
    expect(r.ok).toBe(true);
    expect(r.text).toBe(`+${s.inventory.scrap - before} Schrott`);
    expect(s.inventory.scrap).toBeGreaterThan(before);
    expect(s.inventory.bag.map((it) => it.id)).toEqual([502]);
    s.content.tradeOpen = false;
    s.inventory.bag[0]!.locked = false;
    expect(sellItem(s, 0).ok).toBe(false);
  });
  it('sells in bulk up to a rarity, never legendary, set or locked pieces', () => {
    const s = atSpati();
    const w = s.equipment.w!;
    const piece = (id: number, rarity: 0 | 1 | 2 | 3, more = {}) => ({ ...structuredClone(w), id, rarity, mods: [], ...more });
    s.inventory.bag.push(piece(1, 0), piece(2, 1), piece(3, 2), piece(4, 3), piece(5, 0, { locked: true }), piece(6, 1, { set: 'kiez' as const }));
    const before = s.inventory.scrap;
    const r = sellBulk(s, 1);
    expect(r.ok).toBe(true);
    expect(r.text).toBe(`2 verkauft · +${s.inventory.scrap - before} Schrott`);
    expect(s.inventory.bag.map((it) => it.id)).toEqual([3, 4, 5, 6]);
    expect(sellBulk(s, 0)).toEqual({ ok: false, text: 'Nichts zu verkaufen.' });
    s.content.tradeOpen = false;
    expect(sellBulk(s, 2).ok).toBe(false);
  });
  it('gear goes to the bag for its price; short Schrott says how much is missing', () => {
    const s = atSpati();
    const item = { ...structuredClone(s.equipment.w!), id: 600 };
    s.content.shops[0]!.offers = [{ item, price: 90 }];
    s.inventory.scrap = 50;
    expect(buyOffer(s, 0)).toEqual({ ok: false, text: 'Dir fehlen 40 Schrott.' });
    s.inventory.scrap = 100;
    expect(buyOffer(s, 0).ok).toBe(true);
    expect(s.inventory.scrap).toBe(10);
    expect(s.inventory.bag).toHaveLength(1);
    expect(s.content.shops[0]!.offers[0]).toBeNull();
  });
});

describe('Aufsätze at the Späti', () => {
  it('cost three times the Zeughaus Schrott (Mira −30 %), no materials; fitted at once into a free slot', () => {
    const s = atSpati({}, 1, { mod: { id: 'nagel' } });
    expect(modPrice(s, 'nagel')).toBe(180);
    expect(modPrice(s, 'stahlnagel')).toBe(360);
    s.inventory.scrap = 1000;
    expect(buyMod(s)).toEqual({ ok: true, text: 'Eingebaut.' });
    expect(s.inventory.scrap).toBe(820);
    expect(s.equipment.w!.mods).toEqual(['nagel']);
    expect(tradeShop(s)!.mod).toBeNull();
    expect(buyMod(s).ok).toBe(false);
    setLoadout(s, s.equipment, { survivors: { schmied: true } });
    expect(modPrice(s, 'nagel')).toBe(126);
  });
  it('a full weapon keeps the bought Aufsatz in stock for the inventory', () => {
    const s = atSpati({}, 1, { mod: { id: 'dorn' } });
    s.equipment.w!.mods = ['nagel'];
    setLoadout(s, s.equipment);
    s.inventory.scrap = 1000;
    expect(buyMod(s).text).toBe('Gekauft. Einbauen im Inventar.');
    expect(s.inventory.mods.dorn).toBe(1);
  });
  it('not at the wandering trader', () => {
    const s = atSpati({}, 1, { mod: { id: 'nagel' } });
    s.content.tradeAt = -1;
    s.inventory.scrap = 1000;
    expect(buyMod(s).ok).toBe(false);
  });
  it('strong ones beat their base and the Zeughaus cannot build them', () => {
    const s = createSim({ empty: true, seed: 1 });
    s.inventory.camp = { stations: { zeug: 1 }, stash: [], freed: [] };
    s.inventory.scrap = 5000;
    s.inventory.materials = { stoff: 50, metall: 50, kabel: 50, chemie: 50 };
    expect(buildMod(s, 'stahlnagel')).toEqual({ ok: false, text: 'Gibt es nur im Späti.' });
    const st = (mods: Array<(typeof WEAPON_MODS)[number]['id']>) => heroStats({ ...s.equipment, w: { ...s.equipment.w!, mods } }, s.statContext);
    expect(st(['stahlnagel']).affixes.dmg).toBe(st(['nagel']).affixes.dmg + 10);
    expect(st(['stahlnagel']).eliteBonus).toBeCloseTo(0.3);
    expect(st(['blei']).weight).toBe(3);
    expect(st(['starkstrom']).elements).toContain('shock');
    expect(st(['starkstrom']).affixes.el).toBe(st(['batt']).affixes.el + 25);
    expect(st(['nato']).affixes.res).toBe(st(['dorn']).affixes.res + 5);
    for (const m of WEAPON_MODS.filter((x) => x.spati)) {
      const base = WEAPON_MODS.find((x) => x.id === m.base)!;
      expect(base.spati).toBeUndefined();
      expect(m.scrapCost).toBe(base.scrapCost * 2);
    }
  });
});

describe('blessings at the Späti (Hades style)', () => {
  it('prices follow the reroll price: card 2×, two-level or duo card 3×, Stärkung 1.5×, swap 1×', () => {
    const s = atSpati();
    const r = rerollCost(s);
    const five = (v: number): number => Math.round(v / 5) * 5;
    expect(blessPrice(s, 'buy', card('crit'))).toBe(five(r * 2));
    expect(blessPrice(s, 'buy', card('crit', 2, 1))).toBe(five(r * 3));
    expect(blessPrice(s, 'up')).toBe(five(r * 1.5));
    expect(blessPrice(s, 'swap')).toBe(five(r));
    s.lootWaves = 20;
    expect(blessPrice(s, 'swap')).toBeGreaterThan(five(r));
  });
  it('buys a new blessing at the card level; the card is gone', () => {
    const s = atSpati({}, 1, { cards: [card('crit', 2, 1), card('rate')] });
    const cost = blessPrice(s, 'buy', card('crit', 2, 1));
    s.inventory.scrap = cost - 1;
    expect(buyBlessing(s, 0)).toEqual({ ok: false, text: 'Dir fehlen 1 Schrott.' });
    s.inventory.scrap = cost;
    expect(buyBlessing(s, 0).ok).toBe(true);
    expect(s.statContext.perks.crit).toBe(2);
    expect(s.abilities.quality.crit).toBe(1);
    expect(s.inventory.scrap).toBe(0);
    expect(tradeShop(s)!.cards![0]).toBeNull();
    expect(s.events.some((e) => e.type === 'blessing' && e.id === 'crit' && e.level === 2)).toBe(true);
  });
  it('a card needing an element the hero no longer has is not sold', () => {
    const s = atSpati({}, 1, { cards: [card('spread')] });
    s.inventory.scrap = 10000;
    expect(buyBlessing(s, 0).ok).toBe(false);
    setLoadout(s, { ...s.equipment, w: { ...s.equipment.w!, element: 'fire' } });
    expect(buyBlessing(s, 0).ok).toBe(true);
  });
  it('a Stärkung raises a held blessing by one, once per Späti, never past its max', () => {
    const s = atSpati({ dmg: 2, second: 1 });
    s.inventory.scrap = 10000;
    expect(strengthenable(s)).toEqual(['dmg']);
    expect(strengthenBlessing(s, 'second').text).toBe('Schon voll.');
    expect(strengthenBlessing(s, 'crit').text).toBe('Hast du nicht.');
    expect(strengthenBlessing(s, 'dmg').ok).toBe(true);
    expect(s.statContext.perks.dmg).toBe(3);
    expect(s.inventory.scrap).toBe(10000 - blessPrice(s, 'up'));
    expect(strengthenBlessing(s, 'dmg').ok).toBe(false);
    s.content.tradeAt = -1;
    tradeShop(s);
    expect(strengthenBlessing(s, 'dmg').ok).toBe(false);
  });
  it('a swap gives a held blessing up; the card carries its levels (at least its own, at most its max)', () => {
    const s = atSpati({ dmg: 4, crit: 1 }, 1, { cards: [card('rate'), card('stun')] });
    s.inventory.scrap = 10000;
    expect(swapBlessing(s, 0, 'dmg').ok).toBe(true);
    expect(s.statContext.perks.dmg).toBeUndefined();
    expect(s.statContext.perks.rate).toBe(4);
    expect(s.inventory.scrap).toBe(10000 - blessPrice(s, 'swap'));
    // Kopfnuss has max 1: four levels of Akkordarbeit buy only one.
    expect(swapBlessing(s, 1, 'rate').ok).toBe(true);
    expect(s.statContext.perks.stun).toBe(1);
    expect(s.statContext.perks.rate).toBeUndefined();
    expect(tradeShop(s)!.cards).toEqual([null, null]);
  });
  it('swap rules: not the Umbau, not into a held card, not away from what another blessing needs', () => {
    const s = atSpati({ fire: 1, spread: 1, m_rund: 1, dmg: 1 }, 1);
    expect(swapBlock(s, 'm_rund', card('crit'))).toBe('Der Umbau bleibt.');
    expect(swapBlock(s, 'dmg', card('spread'))).toBe('Hast du schon.');
    expect(swapBlock(s, 'crit', card('rate'))).toBe('Hast du nicht.');
    expect(swapBlock(s, 'fire', card('crit'))).toBe('Flächenbrand braucht ihn.');
    expect(swapBlock(s, 'dmg', card('crit'))).toBeNull();
    // With a fire weapon the blessing is free to go.
    setLoadout(s, { ...s.equipment, w: { ...s.equipment.w!, element: 'fire' } });
    expect(swapBlock(s, 'fire', card('crit'))).toBeNull();
  });
});

describe('Späti in a run', () => {
  const def = koepenickMap(1);
  const lots = generateLots(def);
  const level = mapLevel(def, lots, generateProps(def, lots));
  level.guards = [];
  const step = (s: Sim, n: number): void => { for (let i = 0; i < n; i++) { s.hitstop = 0; stepSim(s, NO_INPUT); } };
  const walkTo = (s: Sim, o: { x: number; z: number }): void => { s.player.x = s.player.px = o.x; s.player.z = s.player.pz = o.z; };
  it('the first visit stocks the extras; a checkpoint keeps them; a stock saved before M13b gets them on the next visit', () => {
    const s = createSim({ level, seed: 3 });
    const rest = level.rests[0]!;
    walkTo(s, rest.desk!);
    step(s, 1);
    expect(talkTo(s)).toBe(true);
    const shop = tradeShop(s)!;
    expect(shop.cards).toHaveLength(TRADE.cards);
    expect(shop.mod).toBeTruthy();
    const save = parseSave(JSON.stringify(snapshot(s, def.name, true)))!;
    const back = simFromSave(save, { seed: save.run!.rng, level }, true);
    expect(JSON.stringify(back.content.shops[0]!.cards)).toBe(JSON.stringify(shop.cards));
    // An old stock: gear only.
    const old = createSim({ level, seed: 3 });
    old.content.shops[0] = { offers: [...shop.offers], left: true };
    walkTo(old, rest.desk!);
    step(old, 1);
    expect(old.content.shops[0]!.cards).toHaveLength(TRADE.cards);
    expect(old.content.shops[0]!.ups).toBe(TRADE.ups);
    expect(old.content.shops[0]!.offers.map((o) => o?.item.id)).toEqual(shop.offers.map((o) => o?.item.id));
    // `stockExtras` leaves a stock that has them alone.
    const again = { ...old.content.shops[0]! };
    stockExtras(old, again, new Rng(99));
    expect(again.cards).toBe(old.content.shops[0]!.cards);
  });
});
