# H3 Humanoid boss bases [Claude · Opus high]

Johannes, 2026-11-19, after the H2 looks (`docs/tasks/wp5-enemies.md` › step 3): the design is acceptable for now, but every humanoid boss has the ghouls' hunch; the bosses need a humanoid base, the Turmwächter a robot base; the Rattenmutter's face must look dirtier and more real; the Brandmeister's fire must glow and lick. New textures go to Codex (`docs/asset-pipeline.md` › T8).

## Findings
- Zombie, hero and every clip share one skeleton (the Quaternius rig in `assets/characters/`). The hunch is not in the zombie mesh but in the zombie clips (`Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop`). `anims.glb` also has upright clips (`Idle_Loop`, `Sword_Idle`, `Jog_Fwd_Loop`), no plain walk.
- Blender is not needed for the hunch. It is only worth it for new body shapes (heavier, taller, female) or another base model.

## Steps

| # | Step | State |
|---|---|---|
| 1 | Upright humanoid bosses: per spine bone the turn from the first frame of `Zombie_Idle_Loop` to that of `Idle_Loop`, applied after every animation update (arms too while walking or standing); gear is fitted in the same pose (`EnemyView.straighten`, `UPRIGHT`). The Rattenmutter keeps her hunch | built 2026-11-19 |
| 2 | Human base mesh: `hero.glb` (human, same skeleton, already used by the NPCs) instead of the zombie mesh for the humanoid bosses, skin tinted undead; the coats refit through `BodyFit`. Comparison image first, Johannes picks | open: comparison |
| 3 | Turmwächter on a robot base: `mech.glb` (Quaternius mech, own clips, as the Uhrwerkläufer) with the Fernsehturm sphere head, ring and sparks | open |
| 4 | Rattenmutter head: ears half again bigger with veins and a tear, 34 matted tufts in two shades, grime on muzzle and eyes, a scar, a chipped incisor. Brandmeister: fire brighter (emissive pulses 2.8 to 4.4), it sways, embers fly off the helmet (pooled particles, `src/render/threats.ts`) | built in code 2026-11-19; painted fur and skin: Codex T8 |

## Cost
Step 1: a few quaternion multiplies per upright boss per animated frame. Step 4: about 40 small cones on one boss head (merged per material), one particle stream; no lights.

## Handover
- Step 1 and 4 in `src/render/enemies.ts` (`straighten`, `UPRIGHT`, `STRAIGHT`, `STRAIGHT_ARMS`, the rat head, the Brandmeister fire update) and `src/render/threats.ts` (embers).
- Check: `node tools/enemy-sheet.mjs out.png "kind=feldwebel&n=1&view=profile&speed=2.4"`; hardware look: `docs/tasks/pt-hardware-checks.md` row 35.
