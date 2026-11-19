# H3 Humanoid boss bases [Claude · Opus high]

Johannes, 2026-11-19, after the H2 looks (`docs/tasks/wp5-enemies.md` › step 3): the design is acceptable for now, but every humanoid boss has the ghouls' hunch; the bosses need a humanoid base, the Turmwächter a robot base; the Rattenmutter's face must look dirtier and more real; the Brandmeister's fire must glow and lick. New textures go to Codex (`docs/asset-pipeline.md` › T8).

## Findings
- Zombie, hero and every clip share one skeleton (the Quaternius rig in `assets/characters/`). The hunch is not in the zombie mesh but in the zombie clips (`Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop`). `anims.glb` also has upright clips (`Idle_Loop`, `Sword_Idle`, `Jog_Fwd_Loop`), no plain walk.
- Blender is not needed for the hunch. It is only worth it for new body shapes (heavier, taller, female) or another base model.
- UBC Standard (`tools/fetch-assets.sh` works from the cloud) has only `Superhero_Male` and `Superhero_Female`, no `Regular_Male`. `hero.glb` is multi-mesh (body regions, clothing pieces); `BodyFit` reads one body mesh, so it would need work as a boss base; its source body `Superhero_Female` is candidate c instead.
- Leela (`mech.glb`) has no arms: her head is the big hull (0.9 m), the torso small. Mike has arms but is the Großer Uhrwerkläufer and broad and top-heavy; Leela with her hull hidden makes a slim shaft on two legs, the Fernsehturm's own silhouette.

## Steps

| # | Step | State |
|---|---|---|
| 1 | Upright humanoid bosses: per spine bone the turn from the first frame of `Zombie_Idle_Loop` to that of `Idle_Loop`, applied after every animation update (arms too while walking or standing); gear is fitted in the same pose (`EnemyView.straighten`, `UPRIGHT`). The Rattenmutter keeps her hunch | built 2026-11-19 |
| 2 | Human base mesh instead of the zombie mesh for the humanoid bosses, skin tinted undead; the coats refit through `BodyFit`. Comparison `docs/mockups/h3-boss-base.png` (webp in `docs/proof/h3/`): a zombie today (+0 KB), b `human1.glb` (`Superhero_Male`, +289 KB, 5.1k tris), c `human2.glb` (`Superhero_Female`, the hero's body, +292 KB; narrower, fits the female bosses better). Same skeleton and clips; b and c only behind `tools/enemy-sheet.mjs … &base=human1\|human2` (`tools/build-human.mjs`) | comparison ready, Johannes picks |
| 3 | Turmwächter on a robot base: `mech.glb` (Leela, own clips, as the Uhrwerkläufer) as the Fernsehturm on two legs: sphere head, window ring, antenna, ribbed shaft, sparks | built 2026-11-19 |
| 4 | Rattenmutter head: ears half again bigger with veins and a tear, 34 matted tufts in two shades, grime on muzzle and eyes, a scar, a chipped incisor. Brandmeister: fire brighter (emissive pulses 2.8 to 4.4), it sways, embers fly off the helmet (pooled particles, `src/render/threats.ts`) | built in code 2026-11-19; painted fur and skin: Codex T8 |

## Cost
Step 1: a few quaternion multiplies per upright boss per animated frame. Step 3: Köpenick (and maps without own bosses) load `mech.glb` (448 KB; Mike only where needed); the tower is about 5 draws (body, shaft, sphere metal, window ring, beacon, sparks), no lights. Step 2 b or c: one more GLB of about 290 KB, or replacing `zombie.glb` for everyone. Step 4: about 40 small cones on one boss head (merged per material), one particle stream; no lights.

## Handover
- Step 1 and 4 in `src/render/enemies.ts` (`straighten`, `UPRIGHT`, `STRAIGHT`, `STRAIGHT_ARMS`, the rat head, the Brandmeister fire update) and `src/render/threats.ts` (embers).
- Check: `node tools/enemy-sheet.mjs out.png "kind=feldwebel&n=1&view=profile&speed=2.4"`; hardware look: `docs/tasks/pt-hardware-checks.md` row 35.
- Step 3: `ENEMIES.waechter` is `body: 'mech'`, scale 1.3 (legs span his 0.85 m radius, 4 m with antenna); sim unchanged. `towerGear` in `src/render/enemies.ts` hides Leela's hull and slims her neck (`TOWER_BONES`), fits a lathe shaft to her vertices, mounts the sphere on the neck.
- Mech views keep gear sets per kind (`mechSets`: 'clock' at once, the tower on first use in the rest pose, `inRest`). Specials in `poseMech`: barrage leans back then jolts per shell, ring crouches and turns once, bossSlam lifts and stamps a foot (Kick clip); `towerFx` flickers the sparks and flares the window ring. Mech walk now scales with body size.
- `loadCharacters(…, 'small')` loads Leela alone; `mechsFor` in `src/main.ts` asks for her where the Turmwächter can appear (Köpenick, maps without own bosses, `?spawn=`). His zombie gear, SHAPE, BUILD, CLOTH and UPRIGHT entries are gone.
- Proof: `docs/proof/h3/waechter-mech.webp` (front, profile, back, game; ring and slam strips). Hardware look: row 36.
