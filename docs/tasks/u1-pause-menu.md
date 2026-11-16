# U1 Pause menu with tabs, inventory as in 2D [Opus 5.5 medium or Sonnet 5.5]

Status: open. No mockup round: Johannes wants the 2D layout taken over as it is (2026-11-16, phone playtest in landscape).

## Goal
One pause button opens one menu with tabs, as in 2D. The inventory tab, item card and comparison match 2D. It must work on a landscape phone (844 × 390 CSS px), the Tab S9 and desktop.

## Source (2D, read only)
| What | Where |
|---|---|
| Pause button, hot pulse when the bag holds an upgrade | `index.html:28`, `css/style.css:21,23`, `js/feedback.js:7` |
| Open and tab keys (Esc/P, Tab/I, M, J, B, K) | `js/input.js:5-10,55,58` |
| Tabs and header (Schrott, Item Level, district and wave, hidden blessings, cog, Weiter) | `js/panels.js:182-183` |
| Inventory: doll with 8 slots, stat table, bag grid, salvage chips, detail | `js/panels.js:186-197` |
| Equipped item card | `js/panels.js:119-121` |
| Bag item: two cards side by side, per-affix deltas, "Item Level a → b", collapsed "Alle Werte nach Wechsel" | `js/panels.js:124-127`, `js/items.js:42-64` (`extraLines`, `afxLines`, `cmpRows`, `cmpBlock`, `statLine`) |
| Layouts: phone landscape, touch, phone portrait, tablet, desktop | `css/style.css:219-234`, `:359-369`, `:186-189`, `:179`, `:167`, `:216` |
| Font sizes phone landscape: name 16 px, sub 11, rows 13, buttons 12, name clamped to 2 lines | `css/style.css:211,233-234` |

## Target
`src/ui/menu.ts` (new: shell with tabs), `src/ui/inventory.ts` (becomes the inventory tab), `src/ui/ui.ts` (map and options move into tabs), `index.html`, `src/ui/style.css`, `src/main.ts` (one `menu.open(tab)`; pause rule stays: the sim does not step while the menu is open), `e2e/inventory.spec.ts`, `e2e/smoke.spec.ts`.

## Scope
1. Shell: tabs **Inventar · Karte · Optionen** now; the shell takes more tabs later (U2). Header as 2D. The HUD keeps only the pause button; `#inventory-btn` and `#map-btn` go away on every device. Keys: Esc/P pause, I/Tab inventory, M map; pad Start pause, Y inventory, View map, LB/RB switch tabs.
2. Inventory tab: three columns as 2D. Detail column: equipped item = one card; bag item = two aligned cards with a colored delta per affix line ("+3%", "neu"), Item Level arrow, collapsed full stat list. Weapon line shows damage, kind and DPS (`power` parts in `src/sim/stats.ts`). Kraft chooser on the weapon card (`selectPower` in `src/sim/abilities.ts`).
3. Salvage chips only when they would salvage something, with the Schrott they give; "Rest" needs two taps (2D `js/panels.js:188-190,236-237`).
4. Fix the faults of the current screen: one scroll container; the detail column stays visible while the bag scrolls; pad navigation moves in two dimensions inside the grid and jumps between columns with left and right; opening focuses the first bag cell, not Weiter; empty cells are not focusable; no "+0 Schrott"; the UI calls a sim function to switch the implant mode instead of writing `item.implantMode` (`src/ui/inventory.ts:166`); re-render only the part that changed.
5. Pause button pulses when the bag holds an upgrade (`isUpgrade` in `src/sim/items.ts`).

## Not in scope
Segen, Quests, Kodex tabs (U2). Stash, Aufsätze, Umschmieden (M13). A 3D hero preview.

## Done when
- At 844 × 390 the inventory shows doll, bag (5 × 3 visible) and the comparison without scrolling the page; item names are 16 px, mixed case, at most two lines.
- Every action works with touch, mouse, keyboard and pad; touch targets are at least 44 px.
- `npm run check`, `npm run e2e`; screenshots at 844 × 390, 1280 × 800 (tablet) and 1280 × 720 in `docs/proof/u1-menu/`, each next to the 2D screen it copies.

## Notes
- Interim state (PR #18): the options overlay is titled "Pause" and links to inventory and map; on touch the two HUD buttons are hidden. Replace it.
- `itemCard` in `src/ui/inventory.ts` is also used by the trader screen (`src/ui/abilities.ts`); keep one card renderer.
