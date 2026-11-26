# M13b Späti trader with its own trade screen [Claude · Opus high]

Status: phase 1 done (2026-11-26): findings, trade rules in the sim with tests, the bot trades, three layout mockups. Phase 2 (the screen) waits for Johannes' pick of a layout.

## Goal
Backlog B13 (Johannes, 2026-11-16): every Späti has a trader. Port the 2D trader, then a trade screen with the inventory on one side and the trader on the other; weapons, equipment, strong Aufsätze; blessings Hades style (swap, buy, upgrade) for Schrott. The balance bot learns to trade.

## Source (2D, read only)
`js/combat.js:123` trader event (stock), `:130-141` `tradeLvl`, `healP`, `openTrade`, `renderTrade`, `tradebox` click handler; `js/ubahn.js:101` tunnel trader `TUN.npc`; `js/items.js:59` `itemPrice`; `js/combat.js:159-170` `offerPerks` and its reroll; `js/data.js:78` Kurier Jonas; `tools/sim.js:49` bot at the trader.

## Findings

| | 2D | 3D before M13b |
|---|---|---|
| Where | Run event "Händler in der Nähe" (60 s, one per run), tunnel start platform | Same (M16, M20), plus a keeper behind every Späti counter (M13b first version) |
| Stock | 3 rare+ pieces at `tradeLvl` (max of wave level and best worn piece, +2, −3 per district), the third +2 levels and 15 % legendary (tunnel 30 %); Kurier Jonas a fourth; Mitte: the second is an implant | Trader as 2D but without the Mitte implant and the tunnel 30 %. Späti: 4 pieces (two magic, the last +2 and 15 % legendary), Verband, Molotow, Schärfen and Panzerung (2 levels, 3× the workshop price), full heal |
| Price | `itemPrice × 5 + 15` (`itemPrice` = (rarity + 1) · 3 · (1 + 0.08 · item level)); heal 20 + 4 · wE | Same |
| Screen | One box: cards with "Wenn angelegt" comparison, Kaufen · price, Verbandskasten, Weiter | Old panel style in `src/ui/abilities.ts` (`renderTrade`): offers in a row, worn piece on hover or first tap (P5), rows below; scrolls, on the phone only three offers fit (screens in the PR) |
| Selling, Aufsätze, blessings | None (blessings only by choice, one reroll per choice) | None |
| Bot | Buys every better offer it can pay | B2 step 1: offers 2+ item levels above the worn piece that leave 30 % of the Schrott, Verband and Molotow to 2, Späti upgrades |

Reused from 2D: `tradeLvl`, the offer slots and chances, `itemPrice × 5 + 15`, `healP`, Kurier Jonas, the Mitte implant offer and the tunnel 30 % (both ported now), the `offerPerks` weights and card levels for the Späti cards, the reroll price as the unit of blessing prices, salvage values for selling.

## Rules built (phase 1)

`src/sim/trade.ts` (new; the trade code moved out of `runcontent.ts`), constants in `TRADE`.

| Part | Rule |
|---|---|
| Stock | Rolled on the first Späti visit from the run-content stream (`content.rng`, seeded from the sim seed, saved with the checkpoint). Gear draws from it as before; the extras (Aufsatz, cards, Stärkung) from a fork that does not advance it, so events later in the run stay put. A stock from an older checkpoint gets its extras on the next visit |
| Gear | Unchanged, plus the 2D Mitte rule (offer 2 is an implant on `neon` maps, trader and Späti) and the tunnel trader's 30 % legendary |
| Aufsatz | One per Späti: Köpenick one of the six 2D Aufsätze; from Xhain on 50 % a strong one (below). Prefers one the hero has neither fitted nor in stock. Price: Zeughaus Schrott × 3 (`SPATI_UPGRADE.markup`, Mira −30 %), no materials: 180 / 210, strong 360 / 420. Bought: fitted at once if the weapon in hand has a free slot, else kept for the inventory |
| Strong Aufsätze | Six, one above each 2D one, Späti only (`spati`, `base` in `src/data/crafting.ts`; the Zeughaus cannot build them): Stahlnagelband +30 % / +30 % vs elite and boss; Bleigewicht every 3rd attack a Wucht hit; Starkstromakku, Brandsatz, Säurekanister element +60 % (2D +35 %); NATO-Draht +8 life per kill, +15 % resistance |
| Segen kaufen | Two cards per Späti, drawn like a blessing choice (`offerPerks` weights, two-level and duo cards) but only blessings the hero does not hold. Price 2× the reroll price (`rerollCost`), a two-level or duo card 3×. Not sold when its element is missing (weapon changed since) |
| Tauschen | A card replaces a held blessing; the card takes the held levels (at least its own, at most its max). Price 1× reroll. Not the Umbau, not a card already held, not a blessing another held one needs for its element |
| Stärkung | One per Späti: a held blessing +1 level (below its max). Price 1.5× reroll |
| Prices of blessings | Rounded to 5; rise through the run with the reroll price (80 + 32 · wE; wave 8: buy 415, two-level 625, Stärkung 310, swap 210) |
| Verkaufen | A bag piece for its salvage value (Schrott and materials, `salvageItem`), only while trading; locked pieces stay. No better rate than salvage (E3: Schrott stays short) |
| Wandering and tunnel trader | Stay 2D: gear and heal (no Aufsatz, no blessings) |

API for the screen: `tradeStock`, `tradeShop`, `buyOffer`, `buyConsumable`, `buyHeal`, `sellItem`, `buyMod`, `modPrice`, `buyBlessing`, `swapBlessing`, `swapBlock` (reason text), `strengthenBlessing`, `strengthenable`, `blessPrice`, `healPrice`, `closeTrade`; each action returns `{ ok, text }` with short German text. Blessing helpers shared with the choice: `eligibleBlessings`, `drawBlessings`, `cardOf`, `addBlessing`, `dropBlessing` (`src/sim/blessings.ts`, choice behaviour unchanged).

Tests: `src/sim/trade.test.ts` (19: stock, stream fork, Mitte implant, tunnel 30 %, strong Aufsätze in Xhain, prices, buy, sell, Aufsatz fit or stock, Zeughaus refuses strong ones, blessing buy, swap with levels, swap blocks, Stärkung once, checkpoint keeps the stock, old stock gets extras); `src/bot/bot.test.ts` › bot trade (3).

## Bot (balance tool)
`src/bot/bot.ts`: after the gear, consumables and Späti upgrades the bot buys the Aufsatz `loadout` would fit (`wantsMod`, strong ones score base + 2), then `shopBlessings`: the Stärkung on the held blessing with the best `perkScore`, each card as a swap when the card at the carried level beats the weakest swappable held one by `BLESS.swap` (3), else bought when its score reaches `BLESS.buy` (7); all keep 30 % of the Schrott (`SHOP.keep`). Selling is salvage, which it does with every spare piece. Ledger columns Aufsätze, Segen and Deals (cards bought / swaps / Stärkungen / Aufsätze) in `node tools/balance.mjs 3 normal johannes 1 --campaign`.

Before/after campaign: pending (the first runs were cut off by a session restart; rerun in progress).

## Mockups
`docs/mockups/m13b-trade/` (`node docs/mockups/m13b-trade/build.mjs`: real stock from `trade.ts`, the game palette, fonts and item icons; HTML per variant, shots at 1280×720, 844×390 and 1280×800 with pad hints, sheet as SVG and WebP).

| Variant | Sheet | Idea | Pad (Steam Deck) |
|---|---|---|---|
| A Zwei Spalten | `a-zwei-spalten.webp` | Left you (worn, bag, selected piece with Verkaufen), right the trader as one list (Waren, Aufsatz, Segen, Vorräte) | D-pad up/down in a column, left/right to the other column; A buys, X sells, Y swaps, B closes, right stick scrolls |
| B Regal oben | `b-regal.webp` | Shelf rows (Waren and Aufsatz, Segen, Vorräte) as cards, selected offer with comparison on the right, bag as a strip below | Left/right along a shelf, up/down between rows and to the bag; LB/RB next group; A buys |
| C Reiter | `c-reiter.webp` | Tabs as the pause menu: Waren (tiles + comparison as the inventory), Segen (two big cards as the choice, your blessings with +1), Verkaufen (bag with bulk chips) | LB/RB tabs (as the menu), D-pad in the tiles, A buys, Y swaps, B closes |

Johannes plays the Deck at Chrome scale 1.5 (page 853×533, `docs/steam-deck.md`): the compact layout (`max-height: 560px`, the phone one) covers it; the 1280×800 shots show scale 1.

Recommendation: C. Every part has room at 844×390, it reuses the inventory detail, the blessing choice cards and the menu's tab and pad rules, and the swap flow (card, then your blessing) fits its own tab. A is the closest to the backlog wording but its list scrolls and its blessing cards are small on the phone.

## Phase 2 steps (after the pick)
1. `src/ui/trade.ts` (new): the picked screen; `renderTrade` and its handlers leave `src/ui/abilities.ts`. Styles in the U3 block of `style.css`.
2. Actions only through `src/sim/trade.ts`; message line from each `{ text }`.
3. Touch: first tap shows the offer and the worn piece, second tap buys (P5 rule). Swap: tap a card's Tauschen, then a held blessing (blocked ones greyed with `swapBlock` text).
4. Pad: `moveFocus` (`src/ui/focus.ts`); variant rules from the table above; B closes, focus starts on the first offer.
5. Wandering and tunnel trader use the same screen with gear and heal only.
6. e2e: open a Späti, buy gear, buy an Aufsatz, buy and swap a blessing, sell a piece, close; screenshots at 1280×720, 844×390 and 1280×800 in `docs/proof/m13b-trade/`.
7. Bot: rerun the campaign after any price change; calibrate `TRADE.bless` and `BLESS` against E3 (about 1200 Schrott left per map) and E5 (bosses).

## Done when
Phase 1: `npm run check` passes; the three sheets exist; bot before/after recorded here. Phase 2: the picked screen works with mouse, touch and pad at the three sizes, e2e green, status and Playtest rows added by the lead.

## Not in scope
Quests, Umschmieden, a walkable trader NPC with its own body, selling to the camp, prices per district beyond the reroll curve.

## Questions for Johannes
1. Tauschen: the new blessing keeps the levels of the one given up (capped at its max), for one reroll price. Recommendation: yes, it makes swapping a real build change instead of a loss.
2. Strong Aufsätze only at Spätis from Xhain on (Köpenick sells the normal ones, since the camp has no Zeughaus yet). Recommendation: yes.
3. Verkaufen pays the salvage value, not more. Recommendation: yes; Schrott is already plentiful after Xhain (E3).

## Doc updates for the lead
- `docs/backlog.md`: delete row B13 when phase 2 is merged (until then: "Phase 1 built (rules, bot, mockups, `docs/tasks/m13b-trade-screen.md`); screen waits for the layout pick").
- `docs/migration.md` Queue: "M13b trade screen phase 2 [Claude · Opus high], after Johannes picks A, B or C (`docs/mockups/m13b-trade/`)".
- `docs/status.md` (after phase 2) Späti row: "Keeper behind the counter: four pieces, one Aufsatz (strong ones from Xhain on), two blessing cards to buy or swap in, one Stärkung, Verband, Molotow, Schärfen, Panzerung, full heal; sells your pieces for their salvage value. Own trade screen (layout X)". Economy note: "Mitte traders always offer an implant second (2D); the tunnel trader's third offer is legendary 30 % (2D)".
- `docs/balance.md`: new section "Trade (M13b, 2026-11-26)" with the before/after table below.
- `docs/tasks/pt-hardware-checks.md` Playtest (after phase 2): "Späti trade screen: buy, sell, Aufsatz, blessing buy, swap and Stärkung on PC, phone and Deck (pad focus)".
