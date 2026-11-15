# M3a Hero stats port [Codex]

Status: open.

## Goal

Port the 2D stat calculation (gear, sets, implicits, mods, perks, camp, meal) into a pure function in `src/sim`, with tests. No sim wiring yet (that is M3b, Claude).

## Source (read only)

`johakunath/Ruinenstadt`, `js/state.js`: `gear`, `stats`, `pwParts`, `power`. `js/data.js`: `UPG`, `IMODE`, `TM`, `DRILL_D`, `DRILL_H`, `SHRN`, `pk`, `hasS`. `setCount` and `baseOf` (grep `js/`).

## Target

| File | Content |
|---|---|
| `src/data/progression.ts` | Add `CAMP_UPGRADES` (2D `UPG`: id, name, max, base cost; the description function becomes `perLevel` number + unit), `DRILL` (`{ damage: .02, life: .02 }`), `SHRINES` (2D `SHRN`) |
| `src/data/items.ts` | Add `IMPLANT_MODES` (2D `IMODE`), `ATTRIBUTE_STATS` (2D `TM`) |
| `src/sim/items.ts` | `Item` gets optional `mods?: WeaponModId[]` and `implantMode?: 0 \| 1 \| 2` (2D `it.mods`, `it.im`) |
| `src/sim/stats.ts` | Functions below |
| `src/sim/stats.test.ts` | Tests |

```ts
export type Equipment = Partial<Record<SlotId, Item>>;
export interface StatContext {
  upgrades: Partial<Record<'dmg' | 'hp' | 'dash' | 'luck', number>>; // 2D S.upg
  perks: Partial<Record<PerkId, number>>;                            // 2D run.perks via pk()
  camp: Partial<Record<CampBuildingId, boolean>>;                    // 2D S.camp (turm)
  imbissLevel?: number;                                              // 2D cLv('imbiss'); station table itself is M13
  survivors: Partial<Record<SurvivorId, boolean>>;                   // 2D hasS
  meal?: MealId; drill?: number;
  shrines?: Partial<Record<'as' | 'res' | 'spd', boolean>>;          // 2D SHR > 0
}
export interface HeroStats {
  kind: WeaponKindId; affixes: Record<AffixId, number>; elements: ElementId[];
  elementChance: number; elementBonus: number; weight: number; elementPower: number;
  damage: number; maxHp: number; crit: number;
  moveSpeed: number;     // 2D spd / 182, so 1 = base speed
  attackSpeed: number;   // 2D asF (>= .4); 3D clip timing divides by it. Hammer + m_dampf: 2D rate *1.3 becomes attackSpeed / 1.3
  regen: number; res: number; leech: number; luck: number;
  reachFactor: number;   // 1 + .2 * pk('reach')
  dashCooldown: number;  // seconds, 2D dashCd
  cooldownFactor: number; // (1 - .2 * pk('skill')) * (1 - cdr), for powers in M8
}
export function setCount(eq: Equipment, set: SetId): number
export function gearAffixes(eq: Equipment, ctx: StatContext): Record<AffixId, number>   // 2D gear
export function heroStats(eq: Equipment, ctx: StatContext): HeroStats                   // 2D stats
export function power(s: HeroStats): number                                             // 2D power via pwParts
```

## Steps

1. Read `CLAUDE.md`, `docs/workflow.md`, `src/sim/items.ts`.
2. Add the data tables above with values copied exactly and a comment naming the 2D constant.
3. Port `gear` and `stats` formula by formula. Hero level is always 1 (decision: no XP levels), so `(lv-1)` terms vanish; keep a comment. Drop `dm_` (daily mods are not migrated).
4. Skill and ultimate cooldowns (`krOf`, `ulOf`), `reach` in pixels, `pspd` and 2D `rate` seconds are out: return `cooldownFactor`, `reachFactor`, `attackSpeed` instead.
5. `power`: 2D formula, with `dps = damage * (1 + crit) * attackSpeed * (element term) * (weight ? 1.12 : 1)` and `mob = 1 + (moveSpeed - 1) * .4`. Note the change in a comment.
6. Tests: empty equipment except a weapon gives 2D base values (maxHp 100, crit .08, moveSpeed 1); each set bonus threshold applies at 2/3/5 pieces; Spree 3 adds shock; implicit of a base is counted; meal `suppe` and Imbiss level 3; clamps (crit .75, res .75 / -.5, moveSpeed .5 to 1.8, attackSpeed >= .4, dash >= .4 s, cdr <= 50 %); three hand-checked items match values computed with the 2D formula (write the numbers into the test).
7. `npm run check` passes.

## Done when

Signatures exist, tests green, PR lists every 2D global and its `StatContext` field.

## Not in scope

Wiring into `src/sim/player.ts` or combat (M3b), UI, balance changes, perk effects other than the stat terms in `stats`.

## Questions

None yet.
