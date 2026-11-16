# M13 Camp as a menu between runs [Claude · Opus]

Status: done (2026-11-16), playtest open.

## Goal
The 2D camp stations as a menu (Q11): upgrades and meals change the next run.

## Source (2D, read only)
`js/data.js` CST, LVREQ, cNext, cBuy, UPG, upCost, MEALS, MODS, DRILL, stashMax; `js/panels.js` renderStn, mealRows, consRows, drillRow, upRows; `js/combat.js:98` ingredient drops.

## Built
| Part | Where |
|---|---|
| Seven stations, three levels; level 2 needs the survivor, level 3 a freed district (2D: Alexanderplatz; 3D: Köpenick) | `src/data/camp.ts`, `src/sim/camp.ts` |
| Schärfen, Panzerung, Ausdauer, Spürnase with station caps, Drill | `buyUpgrade`, `buyDrill` |
| Imbiss: five meals from Zutaten, one expedition long, level 3 stronger; Zutaten drop from enemies (2D rates) | `cookMeal`, `src/sim/loot.ts` |
| Lazarett: Verband and Molotow for Schrott, level 3 Verband heals 60 % | `craftConsumable`, `src/sim/abilities.ts` |
| Zeughaus: build and fit Aufsätze (one slot, two on rare and set weapons; Mira −30 %) | `buildMod`, `installMod`, `removeMod` |
| Schwarzmarkt: Lager with 40 / 60 / 80 places | `toStash`, `fromStash` |
| Kommandantur (Ilse): level 2 Funkmast; level 3 traders offer one more item (2D: quests +50 % Schrott, quests are not ported) | `src/sim/runcontent.ts` |
| Screen: station list plus the 2D station window; opens from the title (Lager) and the victory screen (Ins Lager) | `src/ui/camp.ts` |

Tests: `src/sim/camp.test.ts`, `e2e/save.spec.ts` (camp keeps the checkpoint, survives a reload). Screens: `docs/proof/m13-camp/`.

## Not in scope
Walkable camp, quests and Erfolge, Umschmieden (2D: from Mitte), station NPC portraits.
