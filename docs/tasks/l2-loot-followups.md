# L2 Loot and item follow-ups from the M1–M3 review [Sonnet 5.5]

Status: open. Review of PRs #5, #7, #9, #10 (2026-11-16). The ports are exact: a differential run of 60,000 seeded item rolls and 30,000 loadouts against the 2D source gave no mismatch (item data, `makeItem`, `lootItem`, `rollRarity`, `gearAffixes`, `heroStats`). Open points are in the code around them:

| # | 2D | 3D | Do |
|---|---|---|---|
| 1 | First material of a kill by enemy type (`EMAT`), rats 8 % (`js/combat.js:99`) | Random material (`src/sim/loot.ts`, `killDrops`) | Use `ENEMY_MATERIAL_DROPS` (`src/data/crafting.ts`) once M12 names the kinds; until then map walker, runner, brute |
| 2 | Item level `D.lvl + ceil(wE)` (`js/state.js:22`) | `lootLevel` has no district level | Add a district level to the map definition (Köpenick 0) before the second district |
| 3 | Neon and GDR item names, implants drop in cyber districts | `lootCtx.flavor` and `district` are never set | Set them from the map definition; implants stay off until a district uses them |
| 4 | Ingredients (`ZUT`) drop | Data only | With M13 (meals) |
| 5 | Legendary powers (`hasL`, 14 call sites) | Data and card text only: legendaries advertise powers that do nothing | Own task L1 (gameplay, Fable or Opus high) |
| 6 | — | `elementBonus` in `HeroStats` is the elite and boss bonus (2D `eb`) | Rename to `eliteBonus` |
| 7 | — | `DIFFICULTIES` in `src/data/progression.ts` duplicates `src/data/difficulty.ts` | Delete the unused copy |

Fixed in PR #18: Spürnase (camp luck upgrade) counts for loot; `power` compares weapon kinds by damage per second as 2D.

Done when: unit tests per row; `npm run check`.
