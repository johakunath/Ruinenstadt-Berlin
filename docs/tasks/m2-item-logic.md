# M2 Item logic [Codex, review Claude]

Status: open. Needs M1 merged.

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

(Codex writes here if a step does not work as written.)
