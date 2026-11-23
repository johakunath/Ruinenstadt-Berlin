import { describe, expect, it } from 'vitest';
import { botCamp, keepsItem, newLedger, runCampaign, salvageSpare, SHOP, SKILL_GOOD, wantsOffer } from './bot';
import { koepenickLevel, mapLevelOf } from './run';
import { Bot } from './bot';
import { createSim, stepSim } from '../sim/sim';
import { inRoom } from '../sim/level';
import { equipItem } from '../sim/inventory';
import type { Item } from '../sim/items';
import type { Sim } from '../sim/types';
import { nextLevel, stationBuilt } from '../sim/camp';
import { LINE_FREED } from '../data/lines';
import { STATIONS } from '../data/camp';
import { freeSpot } from '../sim/reach';
import { Rng } from '../sim/math';

/** A weapon like the worn one, `lv` item levels and `f` times its value. */
const like = (s: Sim, lv: number, f = 1, rarity = s.equipment.w!.rarity): Item => ({ ...structuredClone(s.equipment.w!), id: 9000 + lv * 10 + rarity, itemLevel: lv, value: s.equipment.w!.value * f, rarity, set: undefined, mods: [] });
/** A fresh Köpenick hero wearing a level 10 weapon. */
function hero(): Sim {
  const s = createSim({ level: koepenickLevel(), seed: 2, empty: true });
  s.inventory.bag.push({ ...structuredClone(s.equipment.w!), id: 8000, itemLevel: 10, rarity: 0 });
  equipItem(s, 0);
  s.inventory.bag.length = 0;
  return s;
}

describe('bot economy (B2 step 1)', () => {
  it('salvages bag pieces below the worn item level, keeps legendary and better ones, and books the Schrott', () => {
    const s = hero();
    s.inventory.bag.push(like(s, 5), like(s, 5, 1, 3), like(s, 12));
    expect(s.inventory.bag.map((it) => keepsItem(s, it))).toEqual([false, true, true]);
    const l = newLedger(), before = s.inventory.scrap;
    salvageSpare(s, l);
    expect(s.inventory.bag.map((it) => it.itemLevel)).toEqual([5, 12]);
    expect(l.salvage).toBe(s.inventory.scrap - before);
    expect(l.salvage).toBeGreaterThan(0);
  }, 60_000);

  it('buys an offer two item levels above the worn piece only if 30 % of the Schrott stays', () => {
    const s = hero();
    s.inventory.scrap = 100;
    expect(wantsOffer(s, { item: like(s, 10 + SHOP.lead - 1, 1.5), price: 20 })).toBe(false);
    expect(wantsOffer(s, { item: like(s, 10 + SHOP.lead, 1.5), price: 70 })).toBe(true);
    expect(wantsOffer(s, { item: like(s, 10 + SHOP.lead, 1.5), price: 71 })).toBe(false);
    // Higher level but weaker: it would stay in the bag.
    expect(wantsOffer(s, { item: like(s, 10 + SHOP.lead, 0.5), price: 20 })).toBe(false);
  });

  it('camp: the cheapest build site first, then all sites and Verband and Molotow to two', () => {
    const s = hero();
    s.inventory.camp = { stations: {}, stash: [], freed: [0, LINE_FREED] };
    s.inventory.materials = { stoff: 9, metall: 9, kabel: 9, chemie: 9 };
    s.inventory.consumables = { verband: 0, molotow: 0 };
    const sites = STATIONS.filter((st) => !stationBuilt(s, st.id)).map((st) => ({ id: st.id, cost: nextLevel(s, st.id)!.cost.scrap ?? 0 })).sort((a, b) => a.cost - b.cost);
    s.inventory.scrap = sites[0]!.cost + 5;
    const l = newLedger();
    botCamp(s, l);
    expect(sites.map((x) => stationBuilt(s, x.id))).toEqual([true, false, false, false]);
    expect(l.camp).toBe(sites[0]!.cost);
    s.inventory.scrap = 5000;
    botCamp(s, l);
    expect(sites.every((x) => stationBuilt(s, x.id))).toBe(true);
    expect(s.inventory.consumables).toEqual({ verband: SHOP.pouch, molotow: SHOP.pouch });
    expect(l.camp).toBe(sites[0]!.cost + 5000 - s.inventory.scrap);
  });

  it('walks to the first Späti counter with Schrott in the pocket and shops there', () => {
    const s = createSim({ level: koepenickLevel(), seed: 2 });
    s.inventory.scrap = 900;
    const bot = new Bot(s, SKILL_GOOD, 2);
    for (let i = 0; i < 60 * 40 && !bot.ledger.upgrades; i++) { bot.manage(); stepSim(s, bot.input()); s.player.hp = s.stats.maxHp; }
    expect(bot.ledger.upgrades).toBeGreaterThan(0);
    expect(s.content.tradeAt).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it('frees a captive whose guards are down: walks over and the survivor joins (B2 step 2)', () => {
    const s = createSim({ level: koepenickLevel(), seed: 2, empty: true });
    const p = s.player, e = s.level.encounters[0]!;
    // Behind the hero, away from the way to the first fight (it would pass a captive on the route anyway).
    const q = freeSpot(s.level, new Rng(4), p.x, p.z, 8, 14, 0.6, (x, z) => (x - p.x) * (e.x - p.x) + (z - p.z) * (e.z - p.z) < 0)!;
    s.content.captive = { x: q.x, z: q.z, survivor: 'kurier', free: false };
    const bot = new Bot(s, SKILL_GOOD, 2);
    for (let i = 0; i < 60 * 30 && !s.statContext.survivors.kurier; i++) { bot.manage(); stepSim(s, bot.input()); }
    expect(s.statContext.survivors.kurier).toBe(true);
    expect(s.content.captive).toBeNull();
  }, 60_000);

  it('holds the S3 generator ring until the power comes', () => {
    const level = mapLevelOf('tunnel0');
    const gen = level.encounters.findIndex((e) => e.hold);
    const s = createSim({ level, seed: 4, startAt: gen });
    const bot = new Bot(s, SKILL_GOOD, 4);
    let held = 0;
    for (let i = 0; i < 60 * 150 && s.run.index === gen && s.run.phase !== 'pause'; i++) {
      bot.manage(); stepSim(s, bot.input());
      s.player.hp = s.stats.maxHp;
      if (s.run.phase === 'hold') held++;
    }
    expect(s.run.hold?.p).toBe(level.encounters[gen]!.hold!.need);
    // Inside the ring for most of the hold (it charges only there).
    expect(level.encounters[gen]!.hold!.need * 60 / held).toBeGreaterThan(0.6);
  }, 120_000);
});

describe('balance bot (M14)', () => {
  it('walks to the first fight in Köpenick and wins it', () => {
    const r = runCampaign({ level: koepenickLevel(), seed: 3, skill: SKILL_GOOD, until: 0, maxTime: 600 });
    expect(r.encounters[0]!.time).toBeGreaterThan(0);
    expect(r.kills).toBeGreaterThanOrEqual(10);
  }, 60_000);

  it('crosses the Dahme by ferry: starting at the Müggelturm it reaches the fight on the other bank', () => {
    const r = runCampaign({ level: koepenickLevel(), seed: 5, skill: SKILL_GOOD, startAt: 8, until: 8, maxTime: 900, maxDeaths: 6 });
    expect(r.encounters[8]!.time + r.encounters[8]!.deaths).toBeGreaterThan(0);
  }, 120_000);

  it('walks out of the Magendoktor from the corner by the bench (M18 bot run: it pushed into the wall behind it)', () => {
    const level = mapLevelOf('wedding');
    const room = level.encounters.find((e) => e.id === 'magendoktor')!.room!;
    const sim = createSim({ level, seed: 3, startAt: level.encounters.findIndex((e) => e.id === 'uferterrasse') });
    sim.enemies.length = 0;
    const p = sim.player;
    p.x = p.px = 104; p.z = p.pz = 51.6;
    expect(inRoom(room, p.x, p.z)).toBe(true);
    const bot = new Bot(sim, SKILL_GOOD, 3);
    for (let i = 0; i < 60 * 8; i++) { bot.manage(); stepSim(sim, bot.input()); }
    expect(inRoom(room, p.x, p.z)).toBe(false);
  }, 60_000);
});
