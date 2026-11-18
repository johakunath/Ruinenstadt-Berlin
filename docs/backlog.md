# Backlog (3D)

Open ideas only. Done: B3 heights (hills, terraces with stairs, M11b), B6 finishers (M7), M6 wave checkpoints; prototype controller feel/rumble, PC performance and hero outline (Johannes, 2026-11-16). Scheduled work lives in `docs/migration.md` (steps M1 to M19, H1, H2); items here are pulled in when a step needs them. Owner tags as in `docs/workflow.md`.

Still to merge from the 2D `BACKLOG.md`, each when its migration step starts, not before:

| 2D # | Item | With step |
|---|---|---|
| 2 | Legendaries and set pieces for head, hands, feet, ring | L2 |
| 13 | Multi-level interiors | M15 |
| 14, 27 | Story artefacts (tapes, notes), collectibles with permanent power | M16b |
| 16, 37, 30 | Camp as a place, stations with levels and NPCs, stash purpose | After M13 |
| 17, 34 | Umschmieden with control, smith and enchanter | M13 |
| 18 | Enemy voices | S3 |
| 19 | Authored arena spots with a special reward (dark zone replacement) | M16b |
| 22 | Loot pacing check | M14 |
| 24 | Save slots | After M17 |
| 25, 33 | Meals and ingredients, garden | M13 |
| 26, 36 | Attachment follow-ups, weapons by crafting quests | M13 |
| 28 | Line of sight | Not planned |
| 29 | Warning instead of ▲ when a swap breaks a set | U1 |
| 31, 43, 44 | Dash look, hit flinch, death animation | H1 |
| 38 | Daggers and dual wield | After G1 |
| 41 | Quests | After M13 |

| # | Item | Source | Earliest |
|---|---|---|---|
| B2 | Landmark view: near a landmark a button appears, the camera pulls out and shows the whole building; press again to return | Gate 1 playtest | After M11 |
| B5 | Easier start for newcomers (gate 1 is hard: about 40 to 45 kills with effort). Tune in the real game, not now | Gate 1 playtest | M14 (balance bot) |
| B7 | Head lamp or torch for very dark areas, migrated from the 2D game | Gate 1 playtest, 2D game | With the first dark area |
| B8 | Qualität profile on tablets brings no visible gain and stutters: tablets stay on Leistung, consider hiding Qualität on coarse-pointer devices | Gate 1 playtest | Any time, small |
| B9 | Balance bot calibrated to Johannes: after the port (M14) the bot plays with his reaction time, dodge rate and damage taken, measured from playtest telemetry, so tuning targets his skill, not a perfect player | Johannes, 2026-11-15 | M14 |
| B10 | Power curve: never frustrating. Each zone the hero clearly gets stronger through drops, gear and skills, and by the district boss feels much more powerful than at the start. Target: early waves need care, late waves of the same district feel easier relative to the hero's power, bosses stay a real fight. The bot (B9) checks the curve after every balance change | Johannes, 2026-11-15 | M3, M4, M8, M14 |
| B13 | Späti trader. In 2D the trader appeared as a random event (and in the tunnels). In 3D every Späti has one. Port the 2D trader first, then extend: a trade screen with the inventory on one side and the trader on the other; weapons, equipment, especially strong Aufsätze; blessings (Hades style): swap a blessing, buy a new one or upgrade one, paid in Schrott. The balance bot must learn to trade | Johannes, 2026-11-16 | M13b |
| B14 | Switch `MapDef.strictLots` on for Köpenick and Xhain: lots then keep out of turned landmark footprints and off the full width of side paths (today they can overlap a turned landmark or straddle a path). Regenerates all their lots, so it waits for their playtests | M15 Mitte data step (2026-11-18) | After the Köpenick and Xhain playtests |
| P1 | Done (2026-11-17): controls table per device in Optionen (U2); pad layout as in 2D (A attack, B sprint, Y skill, X Molotow, RB Verband, LB ultimate) | Playtest 2026-11-17 | U2 |
| P2 | Flicker on a yellow house wall on the PC (Qualität) until the hero stands still. Likely two coplanar facade layers (plaster patch, ivy or window trim on the wall plane) fighting for depth while the camera moves; check the yellow Altbau facade parts in `src/render/world.ts` / `map-world.ts` and give the overlay a real offset | Playtest 2026-11-17 | Next PC session |
| P3 | Cars as recognizable models (Trabi, Wartburg, BVG bus) instead of boxes | Playtest 2026-11-17 | PC or Codex models |
| P4 | Inventory: double click or drag and drop equips | Playtest 2026-11-17 | U1 |
| P5 | Trader: comparison with the worn item. Mouse: hover. Touch: first tap selects and shows the comparison, second tap buys | Playtest 2026-11-17 | M13b |
| P6 | Item comparison as in 2D: same layout and rows, item level as the main number instead of Kampfkraft, units coherent (%, per second, absolute) | Playtest 2026-11-17 | U1 |
| P7 | A reward moment after a won fight (short line, drop shower or dialogue) before the blessing cards; the 1.3 s pause is in | Playtest 2026-11-17 | M17 |
| P8 | Contour behind buildings also for enemies (red) and NPCs (green), hero stays amber | Playtest 2026-11-17 | After R1 (built 2026-11-17; Johannes' measurement first) |
| P9 | Done (2026-11-18): zoom on the pad (right stick click cycles) and on touch (pinch on the view); Johannes checks the pinch on the Tab S9 | Playtest 2026-11-17 | U2 |
| P10 | Pickups: own model per item type (weapon kinds, armor slots, materials, food) instead of one bag | Playtest 2026-11-17 | L2 |
| P11 | Ground audit after the surface fix: walk every zone on hardware and note remaining clipping (terrace edges and stairs, banks, bridge ramps, building foundations on slopes) | Playtest 2026-11-17 | Next PC session |
| P13 | Bot for the new systems: endless waves (M18 numbers are first guesses), camp upgrades and meals in the campaign bot (M14) | Session 2026-11-17 | M14 |
| P14 | Tunnel follow-ups: the 2D generator charge (hold the platform while waves come out of the tunnel mouth) before Der Schaffner; flooded stretch and bypass of 2D route A; one tunnel per later line | Session 2026-11-17, 2D `js/ubahn.js` | After the M19 playtest |
| P15 | Camp follow-ups: quests and Erfolge (2D Kommandantur), Umschmieden (2D from Mitte), station keepers as portraits | Session 2026-11-17, M13 | After M13 playtest |
| P16 | Kodex and intro art: enemy portraits and intro card images (2D used painted `assets/ui` shots) | Session 2026-11-17, M17 | Codex art |
| P12 | Remaining 2D enemy types: Ratte (pack of five), Zünder (runs up, fuse, explodes), Schildträger (blocks from the front, hammer stun opens it), Heuler (stays back, drives the others). District types later with their districts: Kabelghul, Boxenkopf, Uhrwerkläufer, Wurzler, Kernspeier | Playtest 2026-11-17, 2D `mkEnemy` | After the M12 playtest |
| P13 | Options from 2D: Akkusparen and Vollbild were in (U3); Auto-Angriff (default off, 2D was on for touch) and Spielstand kopieren/laden added 2026-11-18. Not ported: 2D "Alle Daten exportieren" and the backup list | Session audit 2026-11-17 (left out of U2) | With M17 (menus) |
| P14 | Decision: after a death the retry starts at the zone without blessings (2D rule, set by the PR #18 review fix); a loaded checkpoint keeps them. Keep, or keep blessings on a retry too | Session audit 2026-11-17 | Johannes decides at the next playtest |
| P15 | Check on a device that hidden blessings glow when the hero is within about 10 m and are findable without the map (placement and pickup are unit tested, the look was never seen in a screenshot) | Session audit 2026-11-17 | Next playtest |
| P17 | Spreepark dinos: detailed statues (several species, moss, cracks), more detailed enemy dinos, small pack dinos (Kompso), nests with eggs. Refined task: `docs/tasks/m11c-dinos.md` | Playtest 2026-11-17 (split off the M11c session to save tokens) | Next session |
| P18 | Ambient animals: ducks on ponds, pigeons on plazas (fly off), rats near bins and in the tunnel. Research done (Gobkit CC0 GLBs). Refined task: `docs/tasks/m11c-animals.md` | Playtest 2026-11-17 (split off the M11c session) | Next session |
| P19 | Painted textures for the lot types and plants (Codex). Task: `docs/tasks/m11c-textures.md`; reconcile its material keys with the merged M11c art first | Session 2026-11-17 | After M11c art merge |
| P20 | M11c art follow-ups (agents stopped early to save tokens): look at scaffold, clothesline, gravestones, walls, slabs, girders, crane and Rohbau close up; jetty over the real pond; Jägerzaun and long fences; Platte loggias (no Platte district yet); tree and bush tints and jungle frond brightness after the last fix; greenery scatter density (bushes hiding enemies?); cap empty pallet stacks at 4; brick seam on broken wall tops; `?props=` showcase with sizes (`kind:size`) and a free spot; stalls turned so goods face the path | Session 2026-11-17 (M11c) | Next session, PC check |
| P21 | M11c lot follow-ups: some hidden guards and event spots land inside props (Laube, rubble, hedge) and are not reachable; place them on free cells (`reachable`) or let them climb out; hand-placed lot types for other tight quarters | Session 2026-11-17 (M11c) | With P20 |
| P22 | Done (2026-11-18): lying guards get up in the sim (`Enemy.rise`, `THREAT.rise` 0.7 s): no move or strike until they stand; the body is posed from that timer (unit test in `ai.test.ts`) | Session 2026-11-17 (M11c) | Done |
| P23 | Market trader spot (`src/data/lots.ts`, markt) is sampled after stalls and crates, so it is never `reachable()` (scale 1: 0.16 m from crates; scale 1.3: inside stalls) and the trader falls back to a random spot. Reserve the spot and a free aisle before placing props (Codex on PR 33) | Session 2026-11-17 (M11c) | With P21 |

## Ideas (not decided)

Pure ideas for later (Johannes, 2026-11-16). Nothing here is planned or decided; nobody builds from this list. An idea moves up into the table or into `docs/migration.md` only when Johannes decides it. Add new ideas as a row; do not delete a rejected one, mark it "rejected" with the date.

| # | Idea | Why it might be good | Source | State |
|---|---|---|---|---|
| I1 | Blessings bound to verbs: each family gets blessings that change one action (Schlag, Finisher, Rolle, Kraft, Ultimativ), about 20 new, the card shows the verb. Example: Glut on the finisher makes it explode | Runs with the same weapon play differently, as boons do in Hades | G1 option A (`docs/tasks/g1-build-variety.md`) | idea |
| I2 | Weapon variants: three per weapon, chosen at run start, each changes the chain or the powers. 2D already has three names per power (Kreissäge, Neonwirbel, Ernteschlacht) | A reason to pick a weapon on purpose | G1 option B | idea |
| Q1 | Three quality levels: Qualität (PC), Ausgewogen (today's Leistung: tablet, notebook), a new lowest Leistung (cheap or no shadows, lower resolution, less decoration). Contents after Johannes' hardware checks: `docs/tasks/q1-quality-levels.md` | Johannes, 2026-11-18 | After the checks in `docs/tasks/pt-hardware-checks.md` |
| PT | Running list of hardware and quality checks for Johannes; every session adds its rows: `docs/tasks/pt-hardware-checks.md` | Johannes, 2026-11-18 | Running |
