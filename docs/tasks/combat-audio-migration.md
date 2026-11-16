# S2, M7–M9: first playable migration [Codex]

Status: implemented on `feat/combat-audio-migration`; PR pending.

## Start here

Source (2D, read only): `js/audio.js`, `js/data.js` (`PERKS`, `FAM`, `KR`), `js/combat.js` (`attack`, `skill`, `hit`, `kill`), `BACKLOG.md` #35.
Target: `src/sim/abilities.ts`, `src/data/combat.ts`, `src/sim/player.ts`, `src/sim/sim.ts`, `src/ui/abilities.ts`, `src/audio/audio.ts`.

## Delivered

- S1 already ported. S2 adds cached synthesized walker/runner/brute/boss cues, pack throttling, distance rolloff and stereo pan. Future M12 types need their own cues; spoken boss lines remain S3.
- M7: blade chain, heavy hammer, narrow long spear, projectile thrower; 3-hit finishers, 4-hit thrower finisher, dash strike. Existing measured pipe clips reused; these are provisional poses, not custom spear/thrower animations.
- M8: both regular powers per class, separate ultimate, cooldowns, half-charge on switching; choose one of three blessings after encounters, 2.5× held-family weighting, prerequisite/duo checks. Run build and cooldowns survive checkpoints, reset between runs.
- Only implemented blessings are offered (`SUPPORTED` in abilities.ts). Full PERKS metadata remains in progression.ts; remaining perks/mods/duos are the M8 parity task.
- M9: E/B power, R/LB ultimate, Y inventory, A/LT dodge; touch power/ultimate above existing attack/dodge. Keyboard, D-pad/A, mouse and touch choose blessings. Consumable buttons wait for M16 rules.
- Leistung effects: bounded shared mesh pools (96 projectiles, 24 rings), no new lights/shadows. No new hardware measurement requested.

## Remaining acceptance and polish

- Play the new classes/powers on pad/tablet; prototype controller/performance acceptance stays done.
- M7 polish: custom weapon models/animations, hammer pressure-wave finisher, precise 2D weapon rates and damage balance. Vault uses ground collision; it cannot bypass walls/water.
- M8 parity: missing effects such as burning spread/stacking, kill streaks, dash trails, remaining duos/mods; guard/bash and area effects are a first pass. Match detailed 2D statuses after M12 enemy roles exist.
- M9: consumable controls with M16, final touch spacing after playtest.

## Checks

`npm run check`; `npm run e2e`; one 1280×720 screenshot. Unit coverage: weapon roles, projectile impact, power/ultimate cooldowns, valid choices and stale-choice rejection, checkpoint build persistence and new-run reset, audio rolloff.

## Handover

- Reused 2D names, cooldowns, damage ratios, family weights and typed PERKS/stat formulas.
- Kept the prototype's render look, hitbox architecture and existing pipe clips.
- This is an explicitly authorized first pass; M7/M8 full parity remains open above.
