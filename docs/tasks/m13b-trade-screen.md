# M13b Späti trader with its own trade screen [Claude · Opus high]

Status: done (2026-11-26), playtest open. Phase 1: findings, trade rules in the sim with tests, the bot trades, three layout mockups. Phase 2: layout C built (Johannes did not object to the recommendation; the three questions below decided as recommended).

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

API for the screen: `tradeStock`, `tradeShop`, `buyOffer`, `buyConsumable`, `buyHeal`, `sellItem`, `sellBulk`, `buyMod`, `modPrice`, `buyBlessing`, `swapBlessing`, `swapBlock` (reason text), `strengthenBlessing`, `strengthenable`, `blessPrice`, `healPrice`, `closeTrade`; each action returns `{ ok, text }` with short German text. Blessing helpers shared with the choice: `eligibleBlessings`, `drawBlessings`, `cardOf`, `addBlessing`, `dropBlessing` (`src/sim/blessings.ts`, choice behaviour unchanged).

Tests: `src/sim/trade.test.ts` (20: stock, stream fork, Mitte implant, tunnel 30 %, strong Aufsätze in Xhain, prices, buy, sell, Aufsatz fit or stock, Zeughaus refuses strong ones, blessing buy, swap with levels, swap blocks, Stärkung once, bulk sell, checkpoint keeps the stock, old stock gets extras); `src/bot/bot.test.ts` › bot trade (3).

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

## Phase 2 built (layout C)
| Part | Where |
|---|---|
| Screen | `src/ui/trade.ts` (`TradeUi`, new; the old panel left `src/ui/abilities.ts`), styles in `style.css` (M13b block, replaces the old trader rules). Full screen in the pause-menu look: Späti name, tabs with counts, Schrott and Leben, × and the fullscreen button top right |
| Waren | Tiles (gear with rarity frame, item level and ▲, the Aufsatz, Schärfen, Panzerung, Verband, Molotow, Verbandskasten) with their price; the picked one on the right as the inventory shows it (offer with deltas beside the worn piece; Aufsatz: where it goes; supply: how many you carry) and Kaufen |
| Segen | The two cards in the blessing-choice look with Kaufen and Tauschen; right your blessings with level dots and +1 (the Stärkung, greyed when used, full or short of Schrott). Tauschen: the card is marked, your blessings become buttons with the result (`→ Akkordarbeit 2`) or why not (`swapBlock`); B or Abbrechen leaves |
| Verkaufen | The bag (eight columns), bulk chips Gewöhnl., bis Magisch, bis Selten (rare ones need a second press), the picked piece with Verkaufen and Anlegen |
| Input | Mouse: a click picks, a click on the picked tile buys (or Kaufen). Touch: first tap picks, second tap buys (P5). Pad: focus picks, A buys or presses, LB/RB tabs, Y swaps on a card, X sells the focused bag piece, B back (out of a swap first), right stick scrolls; hints show while a pad is connected. Keys: arrows move, [ ] or Q/E tabs, Enter presses, Escape back; I, M, P do nothing while trading, Start goes back |
| Trader | The wandering and the tunnel trader get tabs Waren (gear, heal) and Verkaufen |
| Wiring | `src/main.ts`: `tradeUi.update` beside the abilities UI; the sim stays paused while it is open; closing saves |
| Tests | `e2e/trade.spec.ts` (PC: buy gear and an Aufsatz, buy, swap and strengthen blessings, sell, Escape; phone: the second tap buys, tabs, ×) |
| Proof | `docs/proof/m13b/` every tab at 1280×720 (mouse), 844×390 (touch) and 1280×800 (fake pad: RB, D-pad, hints), plus the swap at 1280×720; `node tools/trade-proof.mjs` against the dev server |

Johannes plays the Deck at Chrome scale 1.5 (page 853×533): the compact rules (`max-height: 560px`) apply there as on the phone.

## Done when
`npm run check` passes; `npx playwright test e2e/trade.spec.ts` passes after `npm run build`; the screen works with mouse, touch and pad at the three sizes (proof shots); status and Playtest rows added by the lead.

## Not in scope
Quests, Umschmieden, a walkable trader NPC with its own body, selling to the camp, prices per district beyond the reroll curve.

## Decisions (2026-11-26, the lead for Johannes: recommendations taken)
1. Tauschen: the new blessing keeps the levels of the one given up (capped at its max), for one reroll price.
2. Strong Aufsätze only at Spätis, from Xhain on (Köpenick sells the normal ones; the camp has no Zeughaus yet).
3. Verkaufen pays the salvage value, not more (Schrott is already plentiful after Xhain, E3).
4. Layout C (tabs).

## Doc updates for the lead
- `docs/backlog.md`: delete row B13 (done with M13b, `docs/tasks/m13b-trade-screen.md`).
- `docs/migration.md`: line 27 "a trade screen of its own and trader balance (M13b)" is done; a queue row for M13b, if there is one, set to `done`.
- `docs/status.md` Späti row: "Keeper behind the counter with a trade screen of its own (tabs Waren, Segen, Verkaufen): four pieces, one Aufsatz (strong ones only here, from Xhain on), Schärfen, Panzerung, Verband, Molotow, full heal; two blessing cards to buy or swap in for a held one (it keeps the levels), one Stärkung (+1 level); sells your pieces for their salvage value. The wandering and the tunnel trader use the same screen (Waren, Verkaufen)". Economy line: "Mitte traders always offer an implant second, the tunnel trader's third offer is legendary 30 % (both 2D)".
- `docs/balance.md`: new section "Trade (M13b, 2026-11-26)" with the before/after table and reading from this file (Bot section).
- `docs/tasks/pt-hardware-checks.md` Playtest: "M13b Späti trade screen: buy, sell, Aufsatz, blessing buy, swap and Stärkung with mouse, touch (phone) and the Deck pad (LB/RB, A, Y, X, B); blessing prices feel (2× reroll for a card)".
