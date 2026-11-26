# M11c Spreepark dinos: detailed statues, small dinos, nests [Claude · Opus medium]

Status: built 2026-11-26. Step 1 (2026-11-24): local Pixal3D statues (`docs/local-ai-assets.md` › P17). Steps 2 to 4 (2026-11-26): enemy dino detail, the Kompso, Pixal3D nests; open only the hardware look check (Doc updates below). Prepared 2026-11-17 (Johannes: "Dinos ein kleines bisschen detaillierter, kleinere Dinos, Nest mit Eiern, organischer"). Read `.claude/skills/combat-animation/SKILL.md` before touching an enemy.

## Goal

The Spreepark feels like an overgrown dinosaur park, not a few primitives.

## Steps

1. **Statues** (landmark `dino`, `case 'dino'` in `buildLandmark`, `src/render/map-world.ts`): today a sphere, cylinder, box and cone. Build detailed organic sculptures, species picked per landmark (Brachiosaurus, Triceratops, Stegosaurus, T-Rex): weathered painted concrete or fiberglass, moss, cracks, a broken piece lying beside it, some toppled, one standing. Keep `landmarkCollider` consistent.
2. **Enemy dinos** (`raptor`, `rex`: Quaternius CC0 GLBs repainted by `tools/build-creatures.mjs`, source pack not in the repo, see `assets/LICENSES.md`): a little more detail without new downloads: code-built extras on the skeleton (bone spikes, quills along the back, scars, claws), better vertex painting if the pack can be fetched again. Check with `?spawn=raptor,rex&cam=10,0.6`.
3. **Small dinos**: a small fast weak pack dinosaur (`kompso`, Compsognathus) on the raptor body at about half scale with its own tint, reusing an AI; small packs in Spreepark waves (`waveTier` in `src/data/koepenick.ts`). Hit timing per the combat-animation skill. Rerun `node tools/balance.mjs` and compare with `docs/balance.md`.
4. **Nests**: prop kind `nest` (add to `PropKind`, footprint circle r ≈ 1 in `propCollider`, render in a new `src/render/props-dino.ts`, dispatched from the `default:` branch of `buildProp`): branches and straw, 3-6 big eggs, some cracked, one hatched shell. 3-4 nests in the Spreepark near the statues via `fixedProps` (not on streets or in fight centers). One breakable like a crate if `breakableDefs` (`src/data/map.ts`) allows it easily.

## Checks

`npm run check`; screenshots in the game camera and close (`&cam=10,0.6`) around x=-120 z=-40 on both profiles; triangle counts per statue and nest; balance numbers in the handover.

## Build notes (steps 2 to 4, 2026-11-26)

- **Step 2** (`src/render/dino-extras.ts`, called once per loaded GLB in `loadCharacters`): the hide is repainted in code (olive and green tones turn grey-brown at the same lightness; bone, wounds, claws stay) toward the Köpenick board's skeletal zombie dinosaurs. Extras are found by ray casts on the rest-pose hide and merged into the body mesh: bone spikes along the spine, ragged quills on the raptor's neck, two brow horns, raised rib bars on both flanks, three claw slashes on a thigh and a flank, the raptor's sickle claws. Each extra copies the skin weights of the hide vertex under it, so it bends with the clips (checked through the pounce); it shares the body material: no draw call, no shadow-pass call. The raptor tints moved off green (`TINTS`). The source pack was not fetched again (not needed for the repaint).
- **Step 3**: `kompso` (Kompso) in `src/data/enemies.ts`: raptor body at scale 0.5 with a 1.3 × head (`DINO_HEAD`, a young animal), rust-ochre tint, the rat's brain and pack rule (zig-zags in, three at once, never elite), the raptor's resistances, class Tiere. Life 13, bite 6, speed 3.9, range 0.95, reach 1.1, ±40°. Bite timing `DINO_BITE` (moved from `src/render/enemies.ts` to `src/data/combat.ts`), measured with `GLB=assets/characters/raptor.glb BONE=Head node tools/clip-swing.mjs Attack` (new options): the head pulls back until 0.20 s, lunges from 0.27 s, is furthest ahead at 0.37 to 0.40 s; the Kompso's wind-up ends at 0.33 s, its active frames reach 0.40 s. The dino walk and run clips now scale their stride with the body. Waves: `waveTier` zone 2 from g 15 (the Flugfeld on), weight 0.7 + 0.15 per tier (one unit = one pack), never among boss adds (`bossWave`: a pack would be three bodies for one add). Loot: Kabel, Fleisch; item chance 0.1 per body, so a pack drops about one raptor's. Kodex E25 (3D render), E11 and E12 rendered again with the extras; sight tip, Kodex line, the rat's growl.
- **Step 4**: prop kind `nest` (`DinoPropKind`, collider circle `NEST_RADIUS` 1 × size) and `src/render/props-dino.ts` (GLB placement on maps with local AI props, a small code nest elsewhere). Pixal3D route as the statues: FLUX.2 klein picture of a nest on black (12 picks, two prompts), Pixal3D single image on two picks, `prepare_toy_model.py --width 2.1`, `pose_prop.py --level --pitch -90 --squash 0.68` (Pixal3D built the cup tilted toward the camera; new options `--pitch`, `--squash`), `prepare_toy_model.py --width 2.0`, `bake_low.py --tris 2000 --tex 512 --remesh 0.02`. Without remesh the twigs stall the decimate (15,000 triangles); the `--tint` match to the FLUX picture turned it purple, so the bake is untinted. Result `assets/props/dino-nest.glb`: 1,891 triangles, one material, one 512 px JPEG, 169 KB, 2.0 × 1.9 × 0.7 m. Four nests in `fixedProps` (beside the three statues and below the Riesenrad platform), off the park path, outside every fight circle, lot and landmark footprint (test). Area trees keep their trunk 2.2 m outside a nest (`NEST_TREE_CLEAR` in `generateLots`; decided after the random draws, so every other lot stays where it was): the first placement had a trunk growing through the sauropod's nest. Not breakable: `breakableDefs` knows only crates and bins, and a broken nest would need a per-instance hide in the GLB instanced mesh.

## Handover

- Built: raptor and Rex detail and repaint (0 extra draw calls), the Kompso pack dinosaur in Spreepark waves, four Pixal3D nests; unit tests for the Kompso rules, its waves and bite timing, and the nest placement.
- Numbers: raptor body 1,248 → 1,658 triangles, Rex 1,820 → 2,116 (draw calls per body unchanged: body plus two eye embers); Kompso = raptor body. Nest 1,891 triangles per copy, +1 draw call and +1 shadow call while a nest is in view (one instanced mesh for all four), one 512 px texture.
- Balance (`node tools/balance.mjs 5 normal johannes 1`, Köpenick): 5/5 won before and after, 0.6 deaths per campaign both, 19.7 → 18.5 min; Spreepark fights a little quicker (Flugfeld 62 → 61 s, 38 → 23 % life taken; Dino-Wiese 61 → 55 s, 24 → 11 %), Riesenrad 135 → 140 %, Rathaus 94 → 110 % (power at the end 377 → 337). No Kompso as boss adds; a pack drops about one raptor's loot (two tuning passes; table in Doc updates › 2).
- Reused: the rat brain and pack rule, the raptor body, clips and resistances, the P17 statue recipe (W4 to W6). The 2D game has no small dinosaurs and no nests (checked `js/`).
- Proof `docs/proof/p17-dinos/`: `enemies-before-after.jpg`, `kodex-busts.jpg`, `kompso-pack.jpg`, `nests.jpg`.
- Unverified: fps on the PC and the Tab S9; whether the nests' eggs read at the game camera on real hardware (the cracks soften in the 2,000-triangle bake); Kompso feel in a real fight.

## Doc updates for the lead

Exact lines for the shared files (this branch does not touch them).

1. `docs/enemy-pipeline.md` › Summary row Köpenick: `| Köpenick | 11 (7 normal, 4 bosses) | 7 | 3 (raptor, rex, kompso on the raptor GLB) | 1 (crow) |`; roster line: 42 kinds (20 normal or special). New bullet under Summary: `- P17 (2026-11-26, `docs/tasks/m11c-dinos.md`): raptor and Rex repainted toward the board (grey-brown rot) with code extras merged into the body mesh (`src/render/dino-extras.ts`: spine spikes, neck quills, brow horns, rib bars, claw scars, sickle claws; 0 draw calls, raptor 1,248 → 1,658 and Rex 1,820 → 2,116 triangles); the Kompso on the raptor body at half size. Kodex E11 and E12 rendered again, E25 new. [Before and after](proof/p17-dinos/enemies-before-after.jpg), [busts](proof/p17-dinos/kodex-busts.jpg).`
   Index: Raptor row Body `GLB `raptor.glb` (Quaternius CC0), P17 extras and repaint (`dino-extras.ts`)`; Der Rex row the same with `rex.glb`; new row after Raptor: `| Kompso | kompso | normal (packs of 3) | K | GLB `raptor.glb` at 0.5 with the P17 extras, 1.3 × head, rust-ochre tint | ok | E25 (3D render) | yes | hardware look check | P2 |`
2. `docs/balance.md`, new section at the top:
   `## P17 Kompso packs (2026-11-26)`, then: "`node tools/balance.mjs 5 normal johannes 1` (Köpenick), before = `main` at 44d9f48, after = P17 (Kompso packs of three in the Spreepark waves from the Flugfeld on, no Kompso as boss adds, a pack drops about one raptor's loot). The runs are the same up to the Müggelturm; after that the random stream differs, so compare the averages. A first pass with Kompso packs among the boss adds and 5 % item chance per body cost power (end 307) and two deaths at the Rathaus; both were changed." and the table:
   | | Before | After |
   |---|---|---|
   | Won | 5 of 5 | 5 of 5 |
   | Deaths per campaign | 0.6 | 0.6 |
   | Minutes per campaign | 19.7 | 18.5 |
   | Flugfeld Johannisthal (time, life taken) | 62 s, 38 % | 61 s, 23 % |
   | Dino-Wiese | 61 s, 24 % | 55 s, 11 % |
   | Riesenrad (Rex) | 51 s, 135 %, lowest life 40 % | 52 s, 140 %, lowest life 36 % |
   | Rathausplatz (Hauptmann) | 47 s, 94 %, 0 deaths | 44 s, 110 %, 0.2 deaths |
   | Power at the end | 377 | 337 |
3. `docs/local-ai-assets.md` › P17 Spreepark statues, new bullets:
   - `- P17 nests (2026-11-26): FLUX.2 klein draws a bird's nest when asked for a "dinosaur nest" (12 picks, two prompts; the second asked for "a thick solid rim, no loose twigs sticking out"). Pixal3D built the cup tilted toward the camera of the picture: `pose_prop.py --level --pitch -90` lays it flat (new `--pitch`), `--squash 0.68` turns the deep cup into a low mound (new `--squash`). The twigs stall the decimate like the rubble (15,000 triangles at `--tris 2000`): `bake_low.py --remesh 0.02` gives 1,891 triangles and keeps the eggs as bumps; the cracks soften. `--tint` against the picture on black turned it purple (gain 1.1, 1.1, 1.36): bake without it. `assets/props/dino-nest.glb` 169 KB, one 512 px JPEG; four nests are one instanced mesh (+1 draw call and +1 in the shadow pass while one is in view). [In game](proof/p17-dinos/nests.jpg).`
   - `- `tools/clip-swing.mjs` measures any bone of any GLB: `GLB=assets/characters/raptor.glb BONE=Head node tools/clip-swing.mjs Attack` (the Kompso bite).`
4. `docs/tasks/pt-hardware-checks.md`:
   - Playtest table: `| P17 Spreepark dinos (2026-11-26) | Kompso packs of three from the Flugfeld on: fair, readable, too many? Raptor and Rex with spikes, ribs and grey-brown hide; four nests by the statues and below the Riesenrad. Köpenick, Spreepark zone | `docs/tasks/m11c-dinos.md` |`
   - Hardware checks: `| 62 | P17 dinos and nests look | Köpenick Spreepark at the game camera: do the raptor's spikes and ribs read, are the nests' eggs visible, the Kompso distinct from the raptor? `?spawn=kompso,raptor,rex&cam=10,0.6`; proof `docs/proof/p17-dinos/` | PC, Tab S9 | `docs/tasks/m11c-dinos.md` | |`
5. `docs/backlog.md`: delete the P17 row (built); add P17 to the "Done" list in the header line.
6. `docs/status.md` › Enemies: after "Raptor (pounces along a line)," add "Kompso (packs of three in the Spreepark)," and bump the type count from six to seven; › World or Map: "the Spreepark has four dinosaur nests (P17)".
7. `docs/migration.md` row 17: drop "P17 Spreepark dinos" from "Backlog ready to build".
8. `docs/equipment-pipeline.md`: no change (no item touched).
