# M2 Item logic [Codex, review Claude]

Status: done (PR #7). Claude review 2026-11-15: faithful port, no fixes needed; follow-ups below.

## Goal

Port item generation and comparison from the 2D game into `src/sim`, deterministic through `sim.rng`, with tests. No drops in the world yet (M4), no UI (M5), no stats in combat yet (M3).

## Source (read only)

`johakunath/Ruinenstadt`, `js/items.js`: `rollR`, `makeItem`, `makeSetItem`, `lootItem`, `rollAfx`, `ilv` and `RIL`, `better`, `avgIl`, `scrapVal`, `SALVM`, `SALVN`, `salvage`, `itemPrice`. Read each function in full; several span many lines.

## Target

| File | Content |
|---|---|
| `src/sim/items.ts` | `Item` type and the functions below |
| `src/sim/items.test.ts` | Tests |

```ts
export interface Item { id: number; slot: SlotId; kind: string; base: string; name: string; rarity: 0 | 1 | 2 | 3; value: number; itemLevel: number; affixes: Affix[]; element?: ElementId; set?: SetId }
export interface LootContext { district: number; luck: number; wave: number; flavor?: 'neon' | 'gdr' }
export function rollRarity(rng: Rng, ctx: LootContext, minRarity?: number): number
export function makeItem(rng: Rng, ctx: LootContext, itemLevel: number, minRarity?: number, slot?: SlotId): Item
export function makeSetItem(rng: Rng, ctx: LootContext, itemLevel: number): Item
export function lootItem(rng: Rng, ctx: LootContext, itemLevel: number, minRarity?: number, setChance?: number): Item
export function shownLevel(item: Item): number            // 2D ilv
export function isUpgrade(item: Item, equipped: Item | undefined): boolean   // 2D better
export function scrapValue(item: Item): number
export function salvage(rng: Rng, item: Item): { scrap: number; materials: Partial<Record<MaterialId, number>> }
export function price(item: Item): number
```

`Rng` is the class in `src/sim/math.ts`. Ids come from a counter passed in or kept on the sim; no module-level mutable state.

## Steps

1. Read `CLAUDE.md`, `docs/workflow.md` and `src/sim/math.ts`.
2. Replace every `Math.random()` with the `rng` argument, every `pick` with an rng pick, globals (`S`, `D`, `run`, `ST`, `DF()`) with fields of `LootContext`. Write the mapping into the PR description.
3. Keep every formula and constant exactly. Where a 2D global has no 3D equivalent yet (camp upgrades, threat level, `dm_('eisen')`), add it to `LootContext.luck` and note it in the PR.
4. `salvage` returns what it would add; it does not mutate a save.
5. Tests: the same seed gives the same item; 10 000 rolls at `luck 0, wave 1` give rarity shares within 1 percentage point of the 2D weights; `minRarity` is respected; set items have rarity 2 and a set id; `shownLevel` adds 0/3/6/10; `isUpgrade` compares shown levels.
6. `npm run check` passes.

## Done when

The functions exist with the signatures above, tests green, PR lists the global-to-context mapping.

## Not in scope

Applying affixes to hero stats, world drops, inventory, saves, balance changes.

## Questions

No implementation questions. The optional caller-owned `LootContext.itemId` counter preserves the requested generator signatures without module-level mutable state. Share one context across generators in a sim and persist the counter with it.

## Handover (2026-11-15)

- Ported `rollR`, `makeItem`, `makeSetItem`, `lootItem`, `rollAfx`, `ilv`/`RIL`, `better`, `avgIl`, `scrapVal`, `SALVM`/`SALVN`, `salvage`, `itemPrice` into `src/sim/items.ts`. Source: 2D `61bf9198a72f0c21ee33bd67456e252b630efc65`.
- Global mapping: `D.i` → `district`; `D.cyber`/`D.gdr` → `flavor`; `S.upg.luck + DF().luck + ST.luck + run.th + (dm_('eisen') ? 3 : 0)` → combined `luck`; `run ? wE() : 1` → effective `wave`; `uid` → caller-owned `itemId`; `S.eq` → explicit equipped item / equipment map; `S.scrap`, `S.mat` and salvage totals → returned scrap/materials. `Math.random`, `R`, `pick` → `rng.next`, `rng.range`, `rng.pick`.
- Preserved: set pieces omit the district level bonus and always have rarity 2, even through a legendary-minimum loot call; `setChance = 0` uses the source's 5% fallback. Installed-mod returns (`retMods`) are outside this Item type and M2; no save or inventory mutations.
- Added 41 unit tests (99 total). `npm run check` passes. A temporary read-only differential harness matched all fields, salvage returns and random draw order for 12,000 mixed ordinary/set/loot items across slots, flavors and districts against the original source; it is not part of the shipped suite.
- No player-visible change; no `docs/status.md` update. Browser smoke with installed Chromium: pause/resume passes; both render tests reach the final assertion but fail on HTTP 404 console errors (also recorded by M1). The temporary browser config was removed. Johannes authorized push, code review, fixes and merge. PR #7 is open; Codex reviewed the implementation without findings.

## Review follow-ups (Claude, 2026-11-15)

- `Item` lacks `mods` and `implantMode` (2D `it.mods`, `it.im`): added in M3a.
- Not ported in M1: `UPG`, `IMODE`, `TM`, `SHRN`, `DRILL_*` (M3a); station table and `retMods` (M13).
