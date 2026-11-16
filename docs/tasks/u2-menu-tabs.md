# U2 Menu tabs: Segen, Kodex, map legend, options parity [Sonnet 5.5]

Status: open. Needs U1 (menu shell).

## Goal
The 2D information screens, in the pause menu.

## Source (2D, read only) and target
| Tab | 2D | 3D data it reads |
|---|---|---|
| Segen: icon grid of held blessings, detail card (Stufe, Je Stufe, Jetzt, Nächste Stufe) | `js/panels.js:99-105` | `sim.statContext.perks`, `sim.abilities.quality`, `PERKS`, `FAMILIES` (`src/data/progression.ts`), glyphs `src/ui/glyphs.ts`, `perkIcon` in `src/ui/abilities.ts` |
| Karte: legend (Du, Wahrzeichen, Späti, Litfaßsäule, Gegner, Gebiete), found hidden blessings n of 3 | `js/panels.js:199-200,76-84` | `mapSvg` (`src/data/map-svg.ts`), `sim.content.shrines`, `sim.content.hidden`, `contentMarks` (`src/sim/runcontent.ts`) |
| Kodex: Gegner, Endgegner, Bewohner, Legendäre Funde, Sets, Elite-Gegner; entries fill on the first kill or find | `js/panels.js:201-206`, `js/combat.js:85,115` | New profile field `kodex` (kills by kind, found legendary and set bases) in `SaveProfile` (`src/sim/save.ts`); `ENEMIES`, `SURVIVORS`, `SETS`, `LEGENDARY_POWERS` |
| Optionen: Steuerung diagram per device, Expedition abbrechen, version line | `js/panels.js:257-272` | `src/input/input.ts` mapping, `src/options.ts` |

## Scope
1. Segen and Karte tabs first (data exists).
2. Kodex: add the profile field, fill it in `killEnemy` (`src/sim/combat.ts`) and `collectItem` (`src/sim/inventory.ts`), unit tests, save round trip, toast "Neu im Kodex" (2D).
3. Options: controls diagram for touch, keyboard and pad from one table; "Expedition abbrechen" ends the run as a loss after a confirm.

## Not in scope
Quests and Erfolge (the 2D job system is not ported: needs its own step), Auto-Angriff, Akkusparen, save export.

## Done when
Each tab is usable at 844 × 390 with touch and pad; texts are short German lines; `npm run check`, `npm run e2e`; three screenshots in `docs/proof/u2-tabs/`.
