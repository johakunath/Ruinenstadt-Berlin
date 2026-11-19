import { ECONOMY } from '../data/progression';
import { describe, it, expect } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { xhainMap } from '../data/xhain';
import { alexMap } from '../data/alexanderplatz';
import { mitteMap } from '../data/mitte';
import { generateLots, generateProps, mapLevel } from '../data/map';
import { SURVIVORS } from '../data/progression';
import { spawnEnemy } from './enemies';
import { reachable } from './reach';
import { buyHeal, buyOffer, closeTrade, CONTENT, contentMarks, healPrice, talkTo, type RunEventKind } from './runcontent';
import { parseSave, simFromSave, snapshot } from './save';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Sim } from './types';

const def = koepenickMap(1);
const lots = generateLots(def);
const level = mapLevel(def, lots, generateProps(def, lots));
// Side passage guards (M16b) are tested in tunnel.test.ts; events here run on an empty map.
level.guards = [];
const make = (seed = 3, statContext = {}): Sim => createSim({ level, seed, statContext });
const run = (s: Sim, steps: number): void => { for (let i = 0; i < steps; i++) { s.hitstop = 0; stepSim(s, NO_INPUT); } };
/** Puts the hero on the leg toward encounter `leg` with that event planned and due. */
function onLeg(s: Sim, kind: RunEventKind | 'crate', leg = 2): void {
  s.run.index = leg;
  s.run.phase = 'travel';
  s.content.plan = s.content.plan.map(() => null);
  s.content.done = s.content.done.map(() => false);
  s.content.plan[leg] = kind;
  s.content.timer = 0;
  const a = level.encounters[leg - 1]!, b = level.encounters[leg]!;
  // Just outside the last fight circle, toward the next one.
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  let k = (a.r + 6) / d;
  while (!reachable(level, a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k) && k < 0.9) k += 0.02;
  s.player.x = s.player.px = a.x + (b.x - a.x) * k;
  s.player.z = s.player.pz = a.z + (b.z - a.z) * k;
}
const walkTo = (s: Sim, o: { x: number; z: number }): void => { s.player.x = s.player.px = o.x; s.player.z = s.player.pz = o.z; };

describe('run plan', () => {
  it('every run has all six event types, at most one per leg, never before the first fight', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = make(seed);
      const kinds = s.content.plan.filter((k) => k && k !== 'crate');
      expect(new Set(kinds)).toEqual(new Set(['ambush', 'trader', 'zone', 'cache', 'horde', 'rescue']));
      expect(s.content.plan[0]).toBeNull();
      expect(s.content.plan).toHaveLength(level.encounters.length);
    }
    expect(make(1).content.plan.join()).not.toBe(make(2).content.plan.join());
    expect(make(5).content.plan).toEqual(make(5).content.plan);
  });
  it('Funkmast adds one more event', () => {
    const s = make(4, { camp: { funk: true } });
    expect(s.content.plan.filter((k) => k && k !== 'crate')).toHaveLength(7);
  });
  it('five hidden blessings and three shrines lie on reachable ground, far apart, outside fights', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = make(seed);
      expect(s.content.hidden).toHaveLength(CONTENT.hidden);
      expect(s.content.shrines).toHaveLength(3);
      for (const h of [...s.content.hidden, ...s.content.shrines]) {
        expect(reachable(level, h.x, h.z)).toBe(true);
        expect(level.encounters.some((e) => Math.hypot(h.x - e.x, h.z - e.z) < e.r)).toBe(false);
      }
      const h = s.content.hidden;
      for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) expect(Math.hypot(h[i]!.x - h[j]!.x, h[i]!.z - h[j]!.z)).toBeGreaterThan(40);
    }
  });
});

describe('world content', () => {
  it('a hidden blessing opens a choice once', () => {
    const s = make();
    walkTo(s, s.content.hidden[0]!);
    run(s, 1);
    expect(s.abilities.offers).toHaveLength(3);
    expect(s.abilities.hiddenOffer).toBe(true);
    expect(s.content.hidden[0]!.got).toBe(true);
    s.abilities.offers = [];
    run(s, 2);
    expect(s.abilities.offers).toHaveLength(0);
  });
  it('a shrine gives one buff for 60 s, then it wears off', () => {
    const s = make();
    const h = s.content.shrines[0]!;
    walkTo(s, { x: h.x + 0.95, z: h.z });
    run(s, 1);
    expect(h.used).toBe(true);
    const id = (Object.keys(s.content.shrine) as Array<keyof typeof s.content.shrine>).find((k) => (s.content.shrine[k] ?? 0) > 0)!;
    expect(s.content.shrine[id]).toBeGreaterThan(59);
    if (id === 'as') expect(s.stats.attackSpeed).toBeCloseTo(1.3);
    if (id === 'spd') expect(s.stats.moveSpeed).toBeCloseTo(1.25);
    if (id === 'res') expect(s.stats.res).toBeCloseTo(0.25);
    walkTo(s, level.start);
    run(s, 60 * 60 + 5);
    expect(s.content.shrine[id]).toBe(0);
    expect(s.stats.attackSpeed).toBeCloseTo(1);
    expect(s.stats.res).toBeCloseTo(0);
  });
});

describe('events', () => {
  it('ambush surrounds the hero; horde floods from one side', () => {
    const s = make();
    onLeg(s, 'ambush');
    run(s, 2);
    expect(s.enemies.length).toBeGreaterThanOrEqual(4);
    expect(s.enemies.every((e) => reachable(level, e.x, e.z))).toBe(true);
    expect(s.content.done[2]).toBe(true);
    const h = make();
    onLeg(h, 'horde');
    run(h, 2);
    expect(h.enemies.length).toBeGreaterThanOrEqual(8);
    expect(h.enemies.every((e) => e.kind === 'runner')).toBe(true);
  });
  it('trader: an enemy far off (a sleeping guard) does not keep him silent, one close by does', () => {
    const s = make();
    onLeg(s, 'trader');
    run(s, 2);
    const T = s.content.trader!;
    const far = spawnEnemy(s, T.x + 40, T.z, 'walker', 1, 1);
    walkTo(s, T);
    run(s, 1);
    expect(s.content.talk).toBe(-1);
    far.x = s.player.x + 3; far.z = s.player.z;
    run(s, 1);
    expect(s.content.talk).toBeNull();
  });
  it('trader: opens on a talk press within reach, sells for Schrott, heals, leaves after a minute', () => {
    const s = make();
    onLeg(s, 'trader');
    run(s, 2);
    const T = s.content.trader!;
    expect(T.offers).toHaveLength(3);
    expect(T.offers.every((o) => o!.item.rarity >= 2)).toBe(true);
    expect(contentMarks(s)[0]?.kind).toBe('trader');
    expect(talkTo(s)).toBe(false);
    walkTo(s, T);
    run(s, 1);
    // Walking up only offers the talk (playtest 2026-11-17: no more accidental trade screens).
    expect(s.content.tradeOpen).toBe(false);
    expect(s.content.talk).toBe(-1);
    expect(talkTo(s)).toBe(true);
    expect(s.content.tradeOpen).toBe(true);
    expect(buyOffer(s, 0).ok).toBe(false);
    s.inventory.scrap = 10000;
    const price = T.offers[0]!.price;
    expect(buyOffer(s, 0).ok).toBe(true);
    expect(s.inventory.scrap).toBe(10000 - price);
    expect(s.inventory.bag).toHaveLength(1);
    expect(T.offers[0]).toBeNull();
    expect(buyHeal(s).ok).toBe(false);
    s.player.hp = 10;
    expect(buyHeal(s).ok).toBe(true);
    expect(s.player.hp).toBe(s.stats.maxHp);
    expect(s.inventory.scrap).toBe(10000 - price - healPrice(s));
    closeTrade(s);
    run(s, 3);
    // Standing on the spot does not reopen it.
    expect(s.content.tradeOpen).toBe(false);
    onLeg(s, 'trader', 2);
    s.content.done[2] = true;
    run(s, 61 * 60);
    expect(s.content.trader).toBeNull();
    // A talk press after the trader left opens nothing (Codex review, PR #43).
    s.content.talk = -1;
    expect(talkTo(s)).toBe(false);
    expect(s.content.tradeOpen).toBe(false);
  });
  it('Kurier Jonas: a fourth offer', () => {
    const s = make(3, { survivors: { kurier: true } });
    onLeg(s, 'trader');
    run(s, 2);
    expect(s.content.trader!.offers).toHaveLength(4);
  });
  it('cache: found in time it pays out, else it is lost', () => {
    const s = make();
    onLeg(s, 'cache');
    run(s, 2);
    const C = s.content.cache!;
    const scrap = s.inventory.scrap;
    walkTo(s, C);
    run(s, 1);
    expect(s.content.cache).toBeNull();
    expect(s.drops.filter((d) => d.content.kind === 'item')).toHaveLength(2);
    expect(s.drops.filter((d) => d.content.kind === 'material')).toHaveLength(3);
    expect(s.inventory.scrap).toBe(scrap + Math.round(CONTENT.cache.scrap * ECONOMY.scrap));
    const l = make();
    onLeg(l, 'cache');
    run(l, 51 * 60);
    expect(l.content.cache).toBeNull();
    expect(l.drops).toHaveLength(0);
  });
  it('zone: holding it for 8 s spawns enemies and pays out', () => {
    const s = make();
    onLeg(s, 'zone');
    run(s, 2);
    const Z = s.content.zone!;
    walkTo(s, Z);
    for (let i = 0; i < 8 * 60 + 5; i++) { s.hitstop = 0; s.player.invuln = 1; walkTo(s, Z); stepSim(s, NO_INPUT); }
    expect(s.content.zone).toBeNull();
    expect(s.enemies.length).toBeGreaterThanOrEqual(6);
    expect(s.drops.filter((d) => d.content.kind === 'item')).toHaveLength(2);
  });
  it('rescue: guards with an elite, then the survivor joins for good', () => {
    const s = make();
    onLeg(s, 'rescue');
    run(s, 2);
    const C = s.content.captive!;
    const guards = s.enemies.filter((e) => e.guard);
    expect(guards).toHaveLength(3);
    expect(guards.filter((e) => e.elite)).toHaveLength(1);
    walkTo(s, C);
    run(s, 1);
    expect(s.content.captive).not.toBeNull();
    for (const g of guards) g.state = 'dead';
    walkTo(s, C);
    run(s, 2);
    expect(s.content.captive).toBeNull();
    expect(s.statContext.survivors[C.survivor]).toBe(true);
    // Survivors are part of the profile.
    const save = parseSave(JSON.stringify(snapshot(s, def.name, false)))!;
    expect(save.profile.statContext.survivors[C.survivor]).toBe(true);
  });
  it('rescue becomes a cache when everybody is home', () => {
    const s = make(3, { survivors: Object.fromEntries(SURVIVORS.map((v) => [v.id, true])) });
    onLeg(s, 'rescue');
    run(s, 2);
    expect(s.content.captive).toBeNull();
    expect(s.content.cache).not.toBeNull();
  });
  it('supply drop: a rare item and Schrott, 28 s', () => {
    const s = make();
    onLeg(s, 'crate');
    run(s, 2);
    walkTo(s, s.content.crate!);
    run(s, 1);
    expect(s.content.crate).toBeNull();
    const d = s.drops.find((x) => x.content.kind === 'item')!;
    expect(d.content.kind === 'item' && d.content.item.rarity).toBeGreaterThanOrEqual(2);
  });
  it('Späti: a keeper behind the counter sells items, Verband and Molotow; stock is per Späti and run', async () => {
    const { buyConsumable, tradeStock } = await import('./runcontent');
    const s = make();
    const rest = level.rests[0]!;
    expect(rest.desk && rest.keeper).toBeTruthy();
    walkTo(s, rest.desk!);
    run(s, 1);
    // The customer spot is free ground: the hero is not pushed away from it.
    expect(Math.hypot(s.player.x - rest.desk!.x, s.player.z - rest.desk!.z)).toBeLessThan(0.05);
    expect(s.content.tradeOpen).toBe(false);
    expect(talkTo(s)).toBe(true);
    expect(s.content.tradeOpen).toBe(true);
    expect(s.content.tradeAt).toBe(0);
    expect(tradeStock(s)).toHaveLength(4);
    s.inventory.scrap = 1000;
    s.inventory.consumables = { verband: 2, molotow: 0 };
    expect(buyConsumable(s, 'verband').ok).toBe(true);
    expect(buyConsumable(s, 'verband').ok).toBe(false);
    expect(buyConsumable(s, 'molotow').ok).toBe(true);
    expect(s.inventory.scrap).toBe(1000 - 15 - 25);
    expect(buyOffer(s, 1).ok).toBe(true);
    closeTrade(s);
    run(s, 3);
    expect(s.content.tradeOpen).toBe(false);
    // Leave and come back: same stock, the sold slot stays empty.
    walkTo(s, level.start);
    run(s, 2);
    walkTo(s, rest.desk!);
    run(s, 1);
    expect(talkTo(s)).toBe(true);
    expect(tradeStock(s)[1]).toBeNull();
    // Not with enemies at the door.
    closeTrade(s);
    walkTo(s, level.start);
    run(s, 2);
    spawnEnemy(s, rest.desk!.x + 3, rest.desk!.z + 3, 'walker');
    walkTo(s, rest.desk!);
    s.player.invuln = 99;
    run(s, 1);
    expect(s.content.talk).toBeNull();
    expect(talkTo(s)).toBe(false);
  });
  it('no event starts during a fight or while a choice is open', () => {
    const s = make();
    onLeg(s, 'ambush');
    s.run.phase = 'fight';
    run(s, 5);
    expect(s.enemies).toHaveLength(0);
    s.run.phase = 'travel';
    s.abilities.offers = [{ id: 'dmg', level: 1, quality: 0 }];
    s.enemies.length = 0;
    run(s, 5);
    expect(s.content.done[2]).toBe(false);
  });
  it('an elite drops an item and pays four times the Schrott', () => {
    const s = make();
    const e = spawnEnemy(s, s.player.x + 1, s.player.z, 'walker');
    e.elite = 'flink';
    e.hp = 1;
    const scrap = s.inventory.scrap;
    stepSim(s, NO_INPUT);
    e.hp = 0;
    // Through the normal kill path.
    return import('./combat').then(({ killEnemy }) => {
      killEnemy(s, e);
      expect(s.inventory.scrap).toBe(scrap + Math.round(4 * ECONOMY.scrap));
      expect(s.drops.some((d) => d.content.kind === 'item')).toBe(true);
    });
  });
});

describe('run content in a checkpoint', () => {
  it('plan, found blessings and used shrines survive a reload', () => {
    const s = make();
    s.content.hidden[1]!.got = true;
    s.content.shrines[0]!.used = true;
    s.content.done[3] = true;
    s.run.phase = 'travel';
    const save = parseSave(JSON.stringify(snapshot(s, def.name, true)))!;
    const back = simFromSave(save, { seed: save.run!.rng, level }, true);
    expect(back.content.plan).toEqual(s.content.plan);
    expect(back.content.hidden).toEqual(s.content.hidden);
    expect(back.content.shrines).toEqual(s.content.shrines);
    expect(back.content.done[3]).toBe(true);
  });
  it('an unfinished rescue gets its guards back on a reload (review of PR #18)', () => {
    const s = make();
    onLeg(s, 'rescue');
    run(s, 2);
    expect(s.content.captive).not.toBeNull();
    const save = parseSave(JSON.stringify(snapshot(s, def.name, true)))!;
    expect(save.run).not.toBeNull();
    const back = simFromSave(save, { seed: save.run!.rng, level }, true);
    expect(back.enemies.filter((e) => e.guard)).toHaveLength(3);
    expect(back.enemies.filter((e) => e.elite)).toHaveLength(1);
    walkTo(back, back.content.captive!);
    run(back, 2);
    expect(back.content.captive?.free).toBe(false);
  });
  it('the profile carries no run blessings and no shrine buffs into the next run', async () => {
    const { profileOf } = await import('./save');
    const s = make();
    s.statContext.perks.dmg = 3;
    s.statContext.shrines = { as: true };
    const next = createSim({ level, statContext: profileOf(s).statContext });
    expect(next.statContext.perks).toEqual({});
    expect(next.stats.attackSpeed).toBeCloseTo(1);
    expect(next.stats.damage).toBeCloseTo(10);
  });
});

describe('Funde (2D #14, #27)', () => {
  it('places six Uhrwerkteile and four Kassetten at the same reachable spots every run', () => {
    const a = make(3).content.funde!, b = make(11).content.funde!;
    expect(a.filter((f) => f.kind === 'teil')).toHaveLength(6);
    expect(a.filter((f) => f.kind === 'kassette')).toHaveLength(4);
    expect(b.map((f) => [f.id, f.x, f.z])).toEqual(a.map((f) => [f.id, f.x, f.z]));
    for (const f of a) expect(reachable(level, f.x, f.z)).toBe(true);
  });

  it('a Fund is picked up once, raises the stats for good, and stays gone next run', () => {
    const s = make(3), hp0 = s.stats.maxHp, dmg0 = s.stats.damage;
    const teil0 = s.content.funde!.find((f) => f.id === 'd0:t0')!, teil1 = s.content.funde!.find((f) => f.id === 'd0:t1')!;
    s.run.phase = 'travel';
    walkTo(s, teil0); run(s, 1);
    walkTo(s, teil1); run(s, 1);
    expect(s.events.some((e) => e.type === 'fund')).toBe(true);
    expect(s.statContext.funde).toEqual(['d0:t0', 'd0:t1']);
    expect(s.stats.maxHp).toBe(hp0 + 5);
    expect(s.stats.damage).toBeGreaterThan(dmg0);
    run(s, 5);
    expect(s.statContext.funde).toHaveLength(2);
    const next = make(4, s.statContext);
    expect(next.content.funde!.filter((f) => f.got).map((f) => f.id)).toEqual(['d0:t0', 'd0:t1']);
    expect(next.content.funde!.filter((f) => !f.got)).toHaveLength(8);
  });

  it('a checkpoint older than a pickup: the taken Fund stays gone and the banner counts from the profile (review of PR #58)', () => {
    const s = make(3);
    s.run.phase = 'travel';
    const old = parseSave(JSON.stringify(snapshot(s, def.name, true)))!;
    const f0 = s.content.funde!.find((f) => f.id === 'd0:t0')!, f1 = s.content.funde!.find((f) => f.id === 'd0:t1')!;
    walkTo(s, f0); run(s, 1);
    walkTo(s, f1); run(s, 1);
    // The profile is written at once; the checkpoint stays the old one.
    const save = { ...old, profile: parseSave(JSON.stringify(snapshot(s, def.name, false)))!.profile };
    const back = simFromSave(save, { seed: save.run!.rng, level }, true);
    expect(back.content.funde!.filter((f) => f.got).map((f) => f.id)).toEqual(['d0:t0', 'd0:t1']);
    back.run.phase = 'travel';
    walkTo(back, back.content.funde!.find((f) => f.id === 'd0:t2')!);
    back.events.length = 0;
    run(back, 1);
    expect(back.events.find((e) => e.type === 'fund')).toMatchObject({ title: 'Uhrwerkteil 3 von 6' });
  });

  it('a checkpoint from before Funde existed gets them on load', () => {
    const s = make(3);
    s.run.phase = 'travel';
    const save = parseSave(JSON.stringify(snapshot(s, def.name, true)))!;
    delete (save.run!.content as { funde?: unknown }).funde;
    const back = simFromSave(save, { seed: save.run!.rng, level }, true);
    expect(back.content.funde).toHaveLength(10);
  });

  it('every district map has all six Uhrwerkteile and four Kassetten', () => {
    for (const m of [xhainMap(1), alexMap(1), mitteMap(1)]) {
      const lots = generateLots(m), L = mapLevel(m, lots, generateProps(m, lots));
      const f = createSim({ level: L, seed: 3 }).content.funde!;
      expect([m.id, f.filter((q) => q.kind === 'teil').length, f.filter((q) => q.kind === 'kassette').length]).toEqual([m.id, 6, 4]);
    }
  }, 60000);
});
