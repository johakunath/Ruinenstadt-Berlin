---
name: combat-animation
description: Use when adding or changing a weapon attack, a power, a consumable throw or any other hero or enemy animation in Ruinenstadt Berlin: picking a clip, placing wind-up, hit and recovery, matching the hit arc and the smear, adding a weapon model. Gives the look-then-measure workflow with the clip sheet tool.
---

# Combat animation

Never set clip times from numbers alone. Look at the clip first, then measure, then check in the game.

## Steps

| # | Step | Command or file |
|---|---|---|
| 1 | Get the source packs (not committed) | `bash tools/fetch-assets.sh` → `assets-src/UAL1_Standard.glb`, `UAL2_Standard.glb` (86 clips, CC0) |
| 2 | List what exists before inventing a pose | clip names: `CLIPS` in `tools/build-assets.mjs`; all names: read the `animations` array of the two GLBs |
| 3 | Add wanted clips to `CLIPS`, rebuild | `npm run assets` (check `hero.glb` and `zombie.glb` did not change: `git status`) |
| 4 | Look at the clip with the weapon in the hand | `npm run dev`, then `node tools/clip-sheet.mjs out.png "clip=Punch_Cross&weapon=spear&from=0.1&to=0.6&n=8&view=side"` and open `out.png`. `view=front` and `view=top` show the sweep direction |
| 5 | Measure where the weapon points | `node tools/clip-swing.mjs <clip> 0.0333`: yaw (left of forward) and pitch per frame, hand position |
| 6 | Write the attack | `src/data/combat.ts` › `WEAPON_ATTACKS`: `clipStart` (pose when the wind-up begins), `clipSwing` (first active frame), `clipHit` (last active frame); the arc `from`/`to` follows the measured yaw; `style` picks the smear |
| 7 | A power or throw | `src/data/powers.ts` (`cast`, `fire`) and `CAST_CLIPS` in `src/render/characters.ts` (`from`, `at`, `to`: `at` is the clip time of the release) |
| 8 | Check in the game, frame by frame | `node tools/sequence.mjs "map=hof&profile=Leistung&autostart" outDir '{"attack":true}' 12 2` and `?debug=hit` for the hit arc |
| 9 | Unit test the rule | damage, reach, timing in `src/sim/*.test.ts` |

## Rules

- One-shot clips are posed from sim time: the pose at `windup` must be the frame where the weapon enters the arc, or hits land before the swing shows.
- Wind-up: light ≤ 0.10 s, heavy ≤ 0.26 s. Recovery is cancelled by dodge and by the next attack.
- A clip used by the hero only: the enemy filter `ZOMBIE_CLIPS` in `src/render/characters.ts` keeps it off enemy bodies (every clip costs bindings per body).
- Weapon models: `src/render/weapons.ts`, built along +Y with the grip at the origin. A weapon that points the wrong way in a clip is a clip problem, not a model problem: pick another clip (example: `Sword_Dash` points a spear backward, so the spear dashes with `Melee_Hook`).
- Screenshots in cloud browsers are software rendered: use `profile=Leistung` and long timeouts; never judge frame rate there.
- New clips grow `anims.glb` (about 30 KB each). Say the new size in the PR.
