# S2, M7–M9, M16: combat, blessings, run content [Codex first pass, Claude review and completion]

Status: done (PR #17 first pass by Codex; reviewed and completed by Claude in the follow-up PR). Johannes playtest open.

## Start here

Source (2D, read only): `js/data.js` (`PERKS`, `FAM`, `KR`, `KIND`, `CONS`), `js/combat.js` (`attack`, `skill`, `hit`, `chain`, `kill`, `hurt`, `startEvent`, `offerPerks`, `useCons`), `js/update.js`, `js/state.js` (event plan), `js/items.js` and `js/glyphs.js` (menu glyphs).

| Area | Files |
|---|---|
| Weapon chains, clips, arcs | `src/data/combat.ts` (`WEAPON_ATTACKS`, `WEAPON`), models `src/render/weapons.ts` |
| Powers | `src/data/powers.ts` (2D `KR`, cast and release times), `src/sim/abilities.ts` |
| Damage, statuses, blessing rules | `src/sim/combat.ts` (`strike`, `killEnemy`, `hurtPlayer`) |
| Blessing choice | `src/sim/blessings.ts` |
| Events, hidden blessings, shrines, trader | `src/sim/runcontent.ts`, reachable ground `src/sim/reach.ts` |
| Effects and world objects | `src/render/abilities.ts`, `src/render/content.ts` |
| UI | `src/ui/abilities.ts`, glyphs `src/ui/glyphs.ts` |

## Review of the first pass (PR #17)

| # | Finding | Fix |
|---|---|---|
| 1 | Any kill recharged the blade's second power while it was equipped | Only a kill by the Fechtsprung itself |
| 2 | SERO-Sammler was offered but did nothing | Scrap factor in `creditScrap` |
| 3 | Fechtsprung teleported 3 m in one step and could leave the fight circle | A dash over 0.24 s through bodies, clamped to the circle |
| 4 | Fire fields hit with knockback and hitstop twice a second | Fields ignite (2D); burn has no hit feel |
| 5 | Stehaufmännchen left 1 life without protection | 30 % life and 1.5 s safety (2D) |
| 6 | Burn ticks and thorns showed as crits and ran element procs | `strike` separates procs (`noproc`) and feel |
| 7 | Offer rules: weapon mods in the normal pool, an element offered twice, no duo weight, no two-level cards, no reroll | 2D `offerPerks` ported |
| 8 | Smear arc and clips were the pipe's for every weapon; the weapon model never changed | Own clips, arcs and models per weapon |
| 9 | Powers could not start in an attack's recovery; all effects were instant | Casts cancel recovery; each has a clip and a release frame |
| 10 | Banner slow 40 %, heal 3 %/s | 30 % and 2 %/s (2D) |

## Delivered

- M7: four chains with own clips (hammer `Sword_Heavy_Combo`, spear `Punch_Cross` and `Melee_Hook`, thrower `OverhandThrow`), code-built weapons with an element glow strip, 2D finisher ratios, hammer stun and shock ring, spear lunge, piercing fourth shot. Weapon mods: Gegengewicht (Wucht), Nagelband (elite and boss bonus), element mods.
- M8: 12 powers (2D `KR` values at 30 px per meter). All 50 blessings have a rule and a unit test (`blessings.test.ts`).
- M9/M16: Verband and Molotow (three each, a new hero starts with one each), Döner, action bar on keyboard, pad and touch.
- M16: six event types, one per stretch between two fights, every type once per run (Funkmast: one more); supply drop on stretches 3 and 9; three hidden blessings and three shrines on reachable ground; trader screen. Run content is saved with the checkpoint; rescued survivors stay in the profile.

## Deviations from 2D

| Point | 3D |
|---|---|
| Event timing | 2D by wave; 3D by stretch between encounters, 5 s after the choice |
| Horde | Hetzer at half life (no rats before M12) |
| Elites | Only the rescue guard: ×2.6 life, better loot, counts for Dicke Bertha and Nagelband. Modifiers with M12 |
| Enemy resistances, shield bearers, rain rules | Not in 3D yet (M12, M11c) |
| Sprengmeister | Bigger fields; "explosions do not hurt you" has no effect until bombers exist |
| Consumable source | Crates, bins and the starter pair; making them at the camp comes with M13 |
| Legendary item powers (2D `hasL`) | Not part of this task |

## Follow-ups

- Playtest on pad and Tab S9: weapon feel, cast times, touch arc spacing, event pacing; then balance (M14).
- M16b moves hidden blessings and some events into side branches; M13b replaces the event trader's screen and offer.
- Hero body: the left hand does not hold two-handed weapons (H1 rig).

## Checks

`npm run check` (type check, 325 unit tests, build) and `npm run e2e` (17 browser tests) pass. Screenshots: `docs/proof/combat/`. No GPU measurement: effects are pooled, unlit and add no lights; cost on the PC and the Tab S9 is open.

## Handover

- Reused from 2D: `KR`, `KIND` ratios, `PERKS` rules, `offerPerks`, `startEvent` rewards and timers, `useCons`, menu glyphs (`PG`, `KRG`, `FAMG`).
- New in 3D: cast state with clip and release frame, reach grid for placing content, per-stretch event plan.
- `tools/clip-sheet.mjs` renders a clip as a strip of poses with a weapon; use it with `clip-swing.mjs` for new attacks.
- `anims.glb` grew from 0.56 to 1.18 MB (21 more clips).
