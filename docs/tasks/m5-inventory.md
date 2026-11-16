# M5 Inventory [Codex]

Status: implemented; validation and PR pending

## Goal
Build the inventory directly from the 2D game. Johannes waived the mockup and authorized M5 ahead of M4 (2026-11-16).

## Source
Read-only `Ruinenstadt`: `js/panels.js` (`renderInv`, `detail`, `slotBtn`, drag/drop, `notUp`), `js/items.js` (`ICOI`, salvage), `css/style.css` (three-column inventory), `js/core.js` (`BAG=25`).

## Target
`src/sim/inventory.ts`, `src/ui/inventory.ts`, item art in `assets/inventory/`; input, main loop and sim creation hooks.

## Done when
- 25-slot bag, eight equipment slots, compare actual stat changes, item/implicit/element/legendary descriptions, active set thresholds.
- Equip, unequip (weapon stays equipped), lock, salvage with returned attachments/materials; bulk salvage excludes locks, sets and legendaries; Rest also excludes upgrades.
- Mouse drag, touch long press/tap and controller focus/actions; inventory pauses and clears buffered combat input.
- `npm run check`, `npm run e2e`, desktop/tablet/phone screenshots.

## Not in scope
M4 world drops, M6 saves, M7 weapon-specific moves, M8 powers, M13 camp/stash. The survivor portrait is static 2D placeholder art, not an equipped 3D preview.

## Handover
- `collectItem(sim,item)` rejects duplicate ids and full bags; M4 must leave rejected drops in the world and allocate unique item ids (starter weapon id 0).
- Session inventory survives retries; M6 must persist `inventory` alongside equipment.
- Open with Inventar, I/Tab or controller Y; D-pad/stick traverses controls, A activates, B closes.
- No extra Three.js scene, light or render pass; DOM and lazy browser image decoding only.
