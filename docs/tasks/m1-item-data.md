# M1 Item data port [Codex]

Status: open

## Goal

Port the item and progression data of the 2D game into typed TypeScript in `src/data/`, unchanged in values, with invariant tests. No game logic, no UI, no rendering.

## Source (read only)

`johakunath/Ruinenstadt`, file `js/data.js` (clone: `git clone --depth 1 https://github.com/johakunath/ruinenstadt`). Constants: `RAR`, `ELC`, `ELN`, `RES`, `AFX`, `PACTS`, `IMP`, `SETS`, `SETB`, `SETC`, `LEGP`, `LEGEL`, `MATS`, `EMAT`, `MODS`, `SLOTS`, `SLOTN`, `SSTAT`, `ZUT`, `EZUT`, `MEALS`, `CONS`, `DIFF`, `PERKS`, `SURV`, `CAMP`. Also `RIL` in `js/items.js`.

## Target

| File | Content |
|---|---|
| `src/data/items.ts` | Rarities, slots, elements, affixes, pacts, implicits, legendary powers, sets and set bonuses, item level bonus (`RIL`) |
| `src/data/crafting.ts` | Materials, enemy material drops, weapon mods, ingredients, meals, consumables |
| `src/data/progression.ts` | Difficulty levels, perks (blessings), camp buildings, survivors |
| `src/data/items.test.ts` | Invariant tests |

## Steps

1. Read `CLAUDE.md` and `docs/workflow.md`.
2. For each constant, write a TypeScript `interface` with readable field names (`name` for `n`, `color` for `c`, `min`/`max` for `a`/`b`, ...) and a doc comment that names the 2D constant it comes from.
3. Copy every value exactly. German strings stay German. Keep the 2D keys (`dmg`, `as`, `crit`, ...) as string literal union types, e.g. `type AffixId = 'dmg' | 'as' | ...`.
4. Use `Record<Id, T>` for keyed tables and `readonly` arrays. No functions except trivial lookups.
5. Enemy-type keys in `RES`, `EMAT`, `EZUT` (`ghoul`, `brute`, `raser`, ...) become `type EnemyKind` in `src/data/items.ts` for now.
6. Skip anything spatial or 2D-only: pixel sizes, colors for map drawing, `DIST`, `KIND` reach/arc/knock values, SVG references.
7. Tests in `src/data/items.test.ts`: every id unique; every affix id used in `PACTS`, `IMP`, `SETB`, `MODS` exists in `AFX`; every material in `MODS` costs exists in `MATS`; every ingredient in `MEALS` exists in `ZUT`; affix `min <= max`; rarity multipliers ascend.
8. `npm run check` must pass.

## Done when

- The three data files exist, typed with no `any`.
- `npm run check` passes with the new tests.
- PR description lists every 2D constant and its new name, and anything skipped with the reason.

## Not in scope

Item rolling and logic (M2), UI, icons, `src/sim` changes, balance changes.

## Questions

(Codex writes here if a step does not work as written.)
