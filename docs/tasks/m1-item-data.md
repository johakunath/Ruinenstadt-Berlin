# M1 Item data port [Codex]

Status: done (PR #5).

## Goal

Port the item and progression data of the 2D game into typed TypeScript in `src/data/`, unchanged in values, with invariant tests. No game logic, no UI, no rendering.

## Source (read only)

`johakunath/Ruinenstadt`, file `js/data.js` (clone: `git clone --depth 1 https://github.com/johakunath/ruinenstadt`). Constants: `RAR`, `ELC`, `ELN`, `RES`, `AFX`, `PACTS`, `IMP`, `SETS`, `SETB`, `SETC`, `LEGP`, `LEGEL`, `MATS`, `EMAT`, `MODS`, `SLOTS`, `SLOTN`, `SSTAT`, `ZUT`, `EZUT`, `MEALS`, `CONS`, `DIFF`, `PERKS`, `SURV`, `CAMP`. Item name tables: `NW`, `NWM`, `NWG`, `LEGW`, `NA`, `NAM`, `NAG`, `LEGA`, `NH`, `NHM`, `NHG`, `LEGH`, `NG`, `NGG`, `NF`, `LEGG`, `LEGF`, `NI`, `LEGI`, `NR`, `NT`, `LEGR`, `LEGT`, `SUF`, `BASES`. From `KIND` only the name and damage factor `k` per weapon kind. Also `RIL` in `js/items.js`.

## Target

| File | Content |
|---|---|
| `src/data/items.ts` | Rarities, slots, elements, affixes, pacts, implicits, legendary powers, sets and set bonuses, item level bonus (`RIL`), weapon kinds (name, damage factor) |
| `src/data/item-names.ts` | Name tables per slot, district flavor (`M` = Potsdamer Platz neon, `G` = GDR) and rarity suffixes, `BASES` |
| `src/data/crafting.ts` | Materials, enemy material drops, weapon mods, ingredients, meals, consumables |
| `src/data/progression.ts` | Difficulty levels, perks (blessings), camp buildings, survivors |
| `src/data/items.test.ts` | Invariant tests |

## Steps

1. Read `CLAUDE.md` and `docs/workflow.md`.
2. For each constant, write a TypeScript `interface` with readable field names (`name` for `n`, `color` for `c`, `min`/`max` for `a`/`b`, ...) and a doc comment that names the 2D constant it comes from.
3. Copy every value exactly. German strings stay German. Keep the 2D keys (`dmg`, `as`, `crit`, ...) as string literal union types, e.g. `type AffixId = 'dmg' | 'as' | ...`.
4. Use `Record<Id, T>` for keyed tables and `readonly` arrays. No functions except trivial lookups.
5. Enemy-type keys in `RES`, `EMAT`, `EZUT` (`ghoul`, `brute`, `raser`, ...) become `type EnemyKind` in `src/data/items.ts` for now.
6. Skip anything spatial or 2D-only: pixel sizes, colors for map drawing, `DIST`, `KIND` reach/arc/knock/rate values (the 3D weapons get their own timing in `src/data/combat.ts`), SVG references.
7. Tests in `src/data/items.test.ts`: every id unique; every affix id used in `PACTS`, `IMP`, `SETB`, `MODS` exists in `AFX`; every material in `MODS` costs exists in `MATS`; every ingredient in `MEALS` exists in `ZUT`; affix `min <= max`; rarity multipliers ascend.
8. `npm run check` must pass.

## Done when

- The four data files exist, typed with no `any`.
- `npm run check` passes with the new tests.
- PR description lists every 2D constant and its new name, and anything skipped with the reason.

## Not in scope

Item rolling and logic (M2), UI, icons, `src/sim` changes, balance changes.

## Questions

No data-port questions. Local browser smoke tests already report HTTP 404 console errors on the unchanged baseline (the dev-server follow-up identified `/favicon.ico`). Keep the PR draft until CI is green; this data-only task does not change the page or suppress console errors.

## Handover (2026-11-15)

- Source: `johakunath/Ruinenstadt` at `61bf9198a72f0c21ee33bd67456e252b630efc65`, `js/data.js` and `RIL` in `js/items.js`. A field-name reverse comparison of all 53 requested constants matches every value, string, optional field and array order (only `KIND.n/k` included, as specified).
- Added the four typed data files and 18 invariant tests. `npm run check` passes: type check, 58 tests total, production build.
- Types preserve the original ids; tables and arrays are readonly. `ELC` and `ELN` are joined as `ELEMENTS`; tuple fields become named objects. Source constant comments and the full PR mapping identify every table.
- Skipped 2D spatial/drawing data, `KIND` timing/reach/knockback, SVG references and runtime helpers. The 2D reference, map, renderer and sim stay unchanged. No player-visible change, so no `docs/status.md` update.
- M2 starts after this task is merged.
