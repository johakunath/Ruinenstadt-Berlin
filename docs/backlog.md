# Backlog (3D)

Open ideas only. Done: M6 wave checkpoints; prototype controller feel/rumble, PC performance and hero outline (Johannes, 2026-11-16). Scheduled work lives in `docs/migration.md` (steps M1 to M15, H1, H2); items here are pulled in when a step needs them. Owner tags as in `docs/workflow.md`.

Still to merge from the 2D `BACKLOG.md`: camp as a place (#16, #37), Umschmieden with control (#17), enemy voices (#18), quests (#41), collectibles (#27), line of sight (#28), garden (#33), smith and enchanter (#34), weapon crafting quests (#36), daggers and dual wield (#38), multi-level interiors (#13). Merge each when its migration step starts, not before.

| # | Item | Source | Earliest |
|---|---|---|---|
| B2 | Landmark view: near a landmark a button appears, the camera pulls out and shows the whole building; press again to return | Gate 1 playtest | After M11 |
| B3 | Height levels: stairs, ramps, hills to look down from. Needs ground height in the sim (still 2D collision with a height per cell or per area) | Gate 1 playtest | M10, M11 |
| B5 | Easier start for newcomers (gate 1 is hard: about 40 to 45 kills with effort). Tune in the real game, not now | Gate 1 playtest | M14 (balance bot) |
| B6 | Finishers first pass built; animation/feel polish tracked in the combat task | Gate 1 playtest | M7 |
| B7 | Head lamp or torch for very dark areas, migrated from the 2D game | Gate 1 playtest, 2D game | With the first dark area |
| B8 | Qualität profile on tablets brings no visible gain and stutters: tablets stay on Leistung, consider hiding Qualität on coarse-pointer devices | Gate 1 playtest | Any time, small |
| B9 | Balance bot calibrated to Johannes: after the port (M14) the bot plays with his reaction time, dodge rate and damage taken, measured from playtest telemetry, so tuning targets his skill, not a perfect player | Johannes, 2026-11-15 | M14 |
| B10 | Power curve: never frustrating. Each zone the hero clearly gets stronger through drops, gear and skills, and by the district boss feels much more powerful than at the start. Target: early waves need care, late waves of the same district feel easier relative to the hero's power, bosses stay a real fight. The bot (B9) checks the curve after every balance change | Johannes, 2026-11-15 | M3, M4, M8, M14 |
| B13 | Späti trader. In 2D the trader appeared as a random event (and in the tunnels). In 3D every Späti has one. Port the 2D trader first, then extend: a trade screen with the inventory on one side and the trader on the other; weapons, equipment, especially strong Aufsätze; blessings (Hades style): swap a blessing, buy a new one or upgrade one, paid in Schrott. The balance bot must learn to trade | Johannes, 2026-11-16 | M13b |

## Ideas (not decided)

Pure ideas for later (Johannes, 2026-11-16). Nothing here is planned or decided; nobody builds from this list. An idea moves up into the table or into `docs/migration.md` only when Johannes decides it. Add new ideas as a row; do not delete a rejected one, mark it "rejected" with the date.

| # | Idea | Why it might be good | Source | State |
|---|---|---|---|---|
| I1 | Blessings bound to verbs: each family gets blessings that change one action (Schlag, Finisher, Rolle, Kraft, Ultimativ), about 20 new, the card shows the verb. Example: Glut on the finisher makes it explode | Runs with the same weapon play differently, as boons do in Hades | G1 option A (`docs/tasks/g1-build-variety.md`) | idea |
| I2 | Weapon variants: three per weapon, chosen at run start, each changes the chain or the powers. 2D already has three names per power (Kreissäge, Neonwirbel, Ernteschlacht) | A reason to pick a weapon on purpose | G1 option B | idea |
