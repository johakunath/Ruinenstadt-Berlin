// Trade (M13b; 2D js/combat.js trader event, `tradeLvl`, `healP`, `renderTrade` and `tradebox`, js/ubahn.js `TUN.npc`):
// the stock of the Späti keepers, the wandering trader and the tunnel trader, prices in Schrott, and every action
// of the trade screen. 2D had one trader: three items (Kurier Jonas four), the third two levels up and sometimes
// legendary, an implant in Mitte, and a full heal. A Späti (3D) adds Verband, Molotow, Schärfen and Panzerung
// (M13b first version), one Aufsatz (from Xhain on often a strong one only Spätis sell) and blessings in Hades
// style: buy a new one, swap a held one for it, or strengthen a held one. Selling pays the salvage value.
// Stock is rolled from the run-content stream (`content.rng`, seeded from the sim seed and saved with the
// checkpoint) on the first visit, so it does not shift with combat rolls.
import { CONSUMABLES, WEAPON_MODS, type WeaponModId } from '../data/crafting';
import { perkOf, addBlessing, cardOf, drawBlessings, dropBlessing, eligibleBlessings, heldFamilies, rerollCost } from './blessings';
import { installMod, modScrap, modSlots, SPATI_UPGRADE } from './camp';
import { pk } from './combat';
import { healPlayer } from './heal';
import { BAG_SIZE, bulkCandidates, salvageItem } from './inventory';
import { makeItem, price, type Item, type LootContext } from './items';
import { lootContext, lootLevel } from './loot';
import { Rng } from './math';
import { heroStats } from './stats';
import type { Offer } from './abilities';
import type { PerkId } from '../data/progression';
import type { Sim } from './types';

export type Result = { ok: boolean; text: string };
export interface TradeOffer { item: Item; price: number }
/** An Aufsatz on the Späti shelf; its price follows `modPrice` (Mira's discount applies when she joins). */
export interface ModOffer { id: WeaponModId }
/** A Späti's stock for this run. `mod`, `cards` and `ups` are M13b; older checkpoints miss them until the next visit. */
export interface ShopStock {
  offers: Array<TradeOffer | null>;
  left: boolean;
  mod?: ModOffer | null;
  /** Blessing cards the hero does not hold yet (Hades style); null once bought or swapped in. */
  cards?: Array<Offer | null>;
  /** Stärkungen left: one held blessing +1 level each. */
  ups?: number;
}

export const TRADE = {
  /** Späti gear offers (2D trader three); Kurier Jonas and Kommandantur level 3 add one each. */
  gear: 4,
  /** Blessing cards and Stärkungen per Späti. */
  cards: 2, ups: 1,
  /**
   * Blessing prices in units of the reroll price (`rerollCost`, Johannes 2026-11-26), so they rise through the run
   * like it: a new card, a two-level or duo card, a Stärkung, a swap (cheaper: the hero gives one up).
   */
  bless: { buy: 2, rich: 3, up: 1.5, swap: 1 },
  /** Strong Aufsätze from this district on (Köpenick sells the 2D ones, the camp has no Zeughaus yet), at this chance. */
  strongFrom: 1, strong: 0.5,
  /** 2D trader: the third offer two levels up, legendary at 15 %, 30 % for the tunnel trader (`TUN.npc`). */
  topLevel: 2, topLegendary: 0.15, tunnelLegendary: 0.3,
} as const;

/**
 * 2D `tradeLvl`: two above the wave level or the best worn piece, minus the district step that `makeItem`
 * adds again (worn gear already carries it). B2 step 2: without the minus every district counted twice,
 * so each Späti visit lifted the stock by 3 levels per district and the hero's power ran away.
 */
export function shopLevel(s: Sim, district: number, waveLevel: number): number {
  return Math.max(0, Math.max(waveLevel, ...Object.values(s.equipment).map((it) => it?.itemLevel ?? 0)) + 2 - 3 * district);
}

/** 2D price of a gear offer: five times the old scrap value plus 15. */
export const gearPrice = (item: Item): number => price(item) * 5 + 15;

/** 2D Mitte (`D.cyber`): the second offer is always an implant, which only drops there. */
const implantAt = (ctx: LootContext, i: number): 'i' | undefined => (ctx.flavor === 'neon' && i === 1 ? 'i' : undefined);

/** One more offer with Kurier Jonas and with the Kommandantur at level 3. */
const extraOffers = (s: Sim): number => (s.statContext.survivors.kurier ? 1 : 0) + ((s.inventory.camp?.stations.kom ?? 1) >= 3 ? 1 : 0);

/** The wandering trader's and the tunnel trader's stock (2D: three rare items, the third two levels higher and sometimes legendary). */
export function rollTrader(s: Sim, rng: Rng): TradeOffer[] {
  const ctx = lootContext(s);
  const il = shopLevel(s, ctx.district, lootLevel(s));
  const top = ctx.tunnel ? TRADE.tunnelLegendary : TRADE.topLegendary;
  const offers: TradeOffer[] = [];
  for (let i = 0; i < 3 + extraOffers(s); i++) {
    const item = makeItem(rng, ctx, il + (i === 2 ? TRADE.topLevel : 0), i === 2 && rng.next() < top ? 3 : 2, implantAt(ctx, i));
    offers.push({ item, price: gearPrice(item) });
  }
  return offers;
}

/**
 * A Späti's stock, rolled on the first visit of a run: gear as the 2D trader but four pieces, two of them only
 * magic (the last two levels up, sometimes legendary), then the M13b extras. The extras come from a stream
 * forked off the content stream without advancing it, so events later in the run stay where they were.
 */
export function rollSpati(s: Sim, rng: Rng): ShopStock {
  const shop: ShopStock = { offers: spatiGear(s, rng), left: true };
  stockExtras(s, shop, extrasRng(rng));
  return shop;
}

/** The stream for a Späti's extras: forked off the content stream at its position, which it does not advance. */
export const extrasRng = (rng: Rng): Rng => new Rng((rng.state ^ 0x2545f491) >>> 0);

/** A Späti's gear (the only part that draws from the content stream itself). */
export function spatiGear(s: Sim, rng: Rng): TradeOffer[] {
  const ctx = lootContext(s);
  const lvl = shopLevel(s, ctx.district, lootLevel(s));
  const n = TRADE.gear + extraOffers(s);
  const offers: TradeOffer[] = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const item = makeItem(rng, lootContext(s), lvl + (last ? TRADE.topLevel : 0), last && rng.next() < TRADE.topLegendary ? 3 : i < 2 ? 1 : 2, implantAt(ctx, i));
    offers.push({ item, price: gearPrice(item) });
  }
  return offers;
}

/** M13b extras of a Späti: one Aufsatz, two blessing cards, one Stärkung. Also fills a stock saved before M13b. */
export function stockExtras(s: Sim, shop: ShopStock, rng: Rng): void {
  if (shop.mod === undefined) shop.mod = rollMod(s, rng);
  if (shop.cards === undefined) {
    const held = heldFamilies(s);
    // Hades style: only blessings the hero does not hold; levels of held ones are the Stärkung's job.
    const pool = eligibleBlessings(s, held).filter((p) => pk(s, p.id) === 0);
    shop.cards = drawBlessings(rng, pool, held, TRADE.cards).map((p) => cardOf(s, rng, p));
  }
  shop.ups ??= TRADE.ups;
}

/** One Aufsatz the hero has neither fitted nor in stock if possible; from Xhain on often a strong one. */
function rollMod(s: Sim, rng: Rng): ModOffer {
  const strong = lootContext(s).district >= TRADE.strongFrom && rng.next() < TRADE.strong;
  const pool = WEAPON_MODS.filter((m) => !!m.spati === strong);
  const owned = (id: WeaponModId): boolean => (s.inventory.mods[id] ?? 0) > 0 || (s.equipment.w?.mods ?? []).includes(id);
  const fresh = pool.filter((m) => !owned(m.id));
  return { id: rng.pick(fresh.length ? fresh : pool).id };
}

// ---------------------------------------------------------------- what is on the table

/** The gear on the table: the Späti's or the wandering trader's. */
export function tradeStock(s: Sim): Array<TradeOffer | null> {
  const c = s.content;
  return (c.tradeAt >= 0 ? c.shops[c.tradeAt]?.offers : c.trader?.offers) ?? [];
}

/** The open Späti's stock; null while trading with the wandering or tunnel trader, or not trading. */
export function tradeShop(s: Sim): ShopStock | null {
  const c = s.content;
  return c.tradeOpen && c.tradeAt >= 0 ? c.shops[c.tradeAt] ?? null : null;
}

const waveE = (s: Sim): number => Math.max(1, s.lootWaves) / 2;
/** 2D `healP`. */
export const healPrice = (s: Sim): number => 20 + Math.round(waveE(s) * 4);
/** An Aufsatz at a Späti: the Zeughaus Schrott (Mira's discount included) times the Späti markup, no materials. */
export const modPrice = (s: Sim, id: WeaponModId): number => modScrap(s, id) * SPATI_UPGRADE.markup;
/** Blessing prices (`TRADE.bless`), rounded to 5. */
export function blessPrice(s: Sim, what: 'buy' | 'up' | 'swap', card?: Offer): number {
  const k = what === 'up' ? TRADE.bless.up : what === 'swap' ? TRADE.bless.swap : card && (card.level > 1 || card.quality >= 2) ? TRADE.bless.rich : TRADE.bless.buy;
  return Math.round((rerollCost(s) * k) / 5) * 5;
}

const no = (text: string): Result => ({ ok: false, text });
const short = (s: Sim, cost: number): Result | null => (s.inventory.scrap < cost ? no(`Dir fehlen ${cost - s.inventory.scrap} Schrott.`) : null);
function pay(s: Sim, cost: number, text: string): Result {
  s.inventory.scrap -= cost;
  s.events.push({ type: 'buy' });
  return { ok: true, text };
}

// ---------------------------------------------------------------- gear, consumables, heal (2D trader)

export function buyOffer(s: Sim, i: number): Result {
  const stock = tradeStock(s);
  const o = stock[i];
  if (!o) return no('');
  const miss = short(s, o.price);
  if (miss) return miss;
  if (s.inventory.bag.length >= BAG_SIZE) return no('Rucksack voll.');
  s.inventory.bag.push(o.item);
  stock[i] = null;
  return pay(s, o.price, 'Gekauft.');
}

/** Spätis also sell Verband and Molotow (2D `CONS` prices), up to three each. */
export function buyConsumable(s: Sim, id: 'verband' | 'molotow'): Result {
  const cost = CONSUMABLES.find((c) => c.id === id)!.scrapCost;
  const have = s.inventory.consumables?.[id] ?? 0;
  if (have >= 3) return no('Mehr als drei trägst du nicht.');
  const miss = short(s, cost);
  if (miss) return miss;
  s.inventory.consumables = { verband: 0, molotow: 0, ...s.inventory.consumables, [id]: have + 1 };
  return pay(s, cost, 'Gekauft.');
}

export function buyHeal(s: Sim): Result {
  const cost = healPrice(s);
  if (s.player.hp >= s.stats.maxHp) return no('Du bist unverletzt.');
  const miss = short(s, cost);
  if (miss) return miss;
  healPlayer(s, s.stats.maxHp, 'trader');
  return pay(s, cost, 'Geheilt.');
}

/** Sells a bag piece to whoever trades: the salvage value (Schrott and materials, `salvageItem`), no better rate. */
export function sellItem(s: Sim, bagIndex: number): Result {
  const it = s.inventory.bag[bagIndex];
  if (!s.content.tradeOpen || !it) return no('');
  if (it.locked) return no('Gesperrt.');
  const before = s.inventory.scrap;
  salvageItem(s, bagIndex);
  s.events.push({ type: 'buy' });
  return { ok: true, text: `+${s.inventory.scrap - before} Schrott` };
}

/** Sells every bag piece of rarity `upTo` and below (no legendary, set or locked piece; `bulkCandidates`, as bulk salvage). */
export function sellBulk(s: Sim, upTo: number): Result {
  if (!s.content.tradeOpen) return no('');
  const items = bulkCandidates(s, upTo);
  if (!items.length) return no('Nichts zu verkaufen.');
  const before = s.inventory.scrap;
  for (const it of items) salvageItem(s, s.inventory.bag.indexOf(it));
  s.events.push({ type: 'buy' });
  return { ok: true, text: `${items.length} verkauft · +${s.inventory.scrap - before} Schrott` };
}

export function closeTrade(s: Sim): void {
  s.content.tradeOpen = false;
}

// ---------------------------------------------------------------- Aufsatz (Späti)

/** Buys the Späti's Aufsatz: fitted at once when the weapon in hand has a free slot, else kept for the inventory. */
export function buyMod(s: Sim): Result {
  const shop = tradeShop(s), o = shop?.mod;
  if (!shop || !o) return no('');
  const cost = modPrice(s, o.id);
  const miss = short(s, cost);
  if (miss) return miss;
  s.inventory.mods[o.id] = (s.inventory.mods[o.id] ?? 0) + 1;
  shop.mod = null;
  const w = s.equipment.w;
  const fitted = !!w && (w.mods ?? []).length < modSlots(w) && installMod(s, o.id).ok;
  return pay(s, cost, fitted ? 'Eingebaut.' : 'Gekauft. Einbauen im Inventar.');
}

// ---------------------------------------------------------------- blessings (Späti, Hades style)

/** A blessing in `perks` whose element (`requires`) the hero would not have with them, or null. */
function stranded(s: Sim, perks: Partial<Record<PerkId, number>>): PerkId | null {
  const els = heroStats(s.equipment, { ...s.statContext, perks }).elements;
  for (const [k, v] of Object.entries(perks) as Array<[PerkId, number]>) {
    const req = v > 0 ? perkOf(k).requires : undefined;
    if (req && !(req === 'any' ? els.length > 0 : els.includes(req))) return k;
  }
  return null;
}

/** Why `id` cannot be swapped away for `card` (German), or null when it can. */
export function swapBlock(s: Sim, id: PerkId, card: Offer): string | null {
  if (pk(s, id) <= 0) return 'Hast du nicht.';
  if (perkOf(id).weapon) return 'Der Umbau bleibt.';
  if (pk(s, card.id) > 0) return 'Hast du schon.';
  // Every blessing kept must still find its element (a fire blessing gone strands the fire-only ones).
  const perks: Partial<Record<PerkId, number>> = { ...s.statContext.perks, [card.id]: card.level };
  delete perks[id];
  const k = stranded(s, perks);
  return k ? (k === card.id ? `${perkOf(k).name} braucht ein Element.` : `${perkOf(k).name} braucht ihn.`) : null;
}

/** Buys card `i`: a new blessing at the card's level. */
export function buyBlessing(s: Sim, i: number): Result {
  const shop = tradeShop(s), card = shop?.cards?.[i];
  if (!shop || !card) return no('');
  if (pk(s, card.id) >= perkOf(card.id).max) return no('Schon voll.');
  // The weapon may have changed since the stock was rolled: no blessing without its element.
  if (stranded(s, { ...s.statContext.perks, [card.id]: card.level }) === card.id) return no(`${perkOf(card.id).name} braucht ein Element.`);
  const cost = blessPrice(s, 'buy', card);
  const miss = short(s, cost);
  if (miss) return miss;
  const level = addBlessing(s, card.id, card.level, card.quality);
  shop.cards![i] = null;
  s.events.push({ type: 'blessing', id: card.id, level });
  return pay(s, cost, `${perkOf(card.id).name} ${level}`);
}

/** Swaps held blessing `id` for card `i`: the card keeps the held levels (at least its own, at most its max). */
export function swapBlessing(s: Sim, i: number, id: PerkId): Result {
  const shop = tradeShop(s), card = shop?.cards?.[i];
  if (!shop || !card) return no('');
  const block = swapBlock(s, id, card);
  if (block) return no(block);
  const cost = blessPrice(s, 'swap');
  const miss = short(s, cost);
  if (miss) return miss;
  const level = Math.min(perkOf(card.id).max, Math.max(card.level, pk(s, id)));
  dropBlessing(s, id);
  addBlessing(s, card.id, level, card.quality);
  shop.cards![i] = null;
  s.events.push({ type: 'blessing', id: card.id, level });
  return pay(s, cost, `${perkOf(id).name} → ${perkOf(card.id).name} ${level}`);
}

/** Held blessings a Stärkung can raise (below their max, no Umbau). */
export const strengthenable = (s: Sim): PerkId[] => (Object.keys(s.statContext.perks) as PerkId[]).filter((id) => pk(s, id) > 0 && pk(s, id) < perkOf(id).max && !perkOf(id).weapon);

/** A Stärkung: held blessing `id` +1 level. */
export function strengthenBlessing(s: Sim, id: PerkId): Result {
  const shop = tradeShop(s);
  if (!shop || !(shop.ups ?? 0)) return no(shop ? 'Heute keine Stärkung mehr.' : '');
  if (!strengthenable(s).includes(id)) return no(pk(s, id) > 0 ? 'Schon voll.' : 'Hast du nicht.');
  const cost = blessPrice(s, 'up');
  const miss = short(s, cost);
  if (miss) return miss;
  const level = addBlessing(s, id, 1, 0);
  shop.ups = (shop.ups ?? 0) - 1;
  s.events.push({ type: 'blessing', id, level });
  return pay(s, cost, `${perkOf(id).name} ${level}`);
}
