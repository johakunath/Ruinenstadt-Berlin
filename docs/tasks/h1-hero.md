# H1 Custom hero: real clothing, outfits, inventory preview [PC · Blender · Opus high; spec Fable high]

Status: open. Decided and specified 2026-11-17 (Fable 5.2 high, confirmed by Johannes). Nothing is built yet. Notes are short on purpose; Opus writes final prose while building.

## Goal
The hero keeps her body, face, skeleton and all clips (39 since step 2b), and gets real clothing instead of paint on the skin. Clothing and equipment change her look, she can be turned in the inventory tab, and the left hand holds two-handed weapons.

## Decision: option A (Johannes, 2026-11-17)
Stay on Quaternius `Superhero_Female_FullBody` and the UAL skeleton. Build modular clothing in Blender, skinned to that skeleton. No new body, no retargeting, no "2 test heroes" round.

| Criterion | A: keep body, build clothing (chosen) | B: MPFB/MakeHuman body on the UAL skeleton |
|---|---|---|
| Animation risk | None: same joints, bind pose and proportions | Shoulders, hips and fingers need weight transfer and hand fixes on a foreign mesh |
| Look gain | Large: the clothes are the weak part | Small: the new body is hidden under coat, boots, gloves |
| Effort | 3 to 4 build sessions | The same plus 1 to 2 for fitting |
| Modularity, performance | Same in both | Same in both |
| License | CC0 | CC0 core; community clothes vary |

Findings behind it (measured 2026-11-17, pictures in `docs/proof/h1-hero/now-*.png`):

| Finding | Number |
|---|---|
| `hero.glb` | 18,606 triangles, 8 primitives, 68 joints (65 UAL + 3 scarf), 1,037 KB, textures: skin 1024 px, eyes 256 px |
| Body (skin + cloth primitives) | 12,812 triangles: not the low-poly part |
| Coat top, trousers, boots, hand wraps | Body faces pushed out 4 to 18 mm, flat vertex colors: skin-tight coat, toes on the boots |
| Coat skirt / scarf / belt and pouches | 264 / 268 / 108 triangles, no texture |
| Face | Good at inventory size (`now-blender-face.png`); stays |
| Two-handed clips in UAL 1 and 2 | None (86 clip names checked): the left hand needs IK, not a clip |

Fallback if the face disappoints in the preview: replace only the head mesh (rigid on `Head`, no rig risk). Not planned.

## Source (2D, read only)
| What | Where |
|---|---|
| Which item sets which look | `js/art.js:56` `heroKeys`, `js/art.js:77` `drawHero`: outfit = base of slot `a` (`kette` → `khemd`, unknown → `none`); hat = base of slot `h` if a piece exists; gloves = base of slot `g`, else bare hands; boots = base of slot `f`, else `stiefel` |
| Piece lists | `tools/build_hero.py` `CLOTHES` (14 outfits, hem 25 = short, 33 to 35 = long), `HATS` (6), `GLOVES` (4), `BOOTS` (3) |
| Look reference | `docs/style/h01-gamesize.png`, `docs/style/koepenick.png`, `docs/style-bible.md:87` (red scarf, long brown leather coat, heavy boots) |

## Target
| File | Content |
|---|---|
| `tools/blender/hero_build.py`, `tools/blender/hero_lib.py` | Clothing built by script from the source body; exports meshes with vertex groups, UVs and baked textures |
| `tools/blender/render_glb.py` | Exists: body and face render of any GLB, prints triangles and bones |
| `tools/build-hero.mjs` | Finds Blender, runs the script, rebinds its meshes to the source skeleton, checks contract and budget, writes `assets/characters/hero.glb`. `buildHero` leaves `tools/build-assets.mjs`; npm script `assets:hero` |
| `src/data/hero-look.ts` (+ test) | `heroLook(equipment): HeroLook`, piece table, fallbacks. No Three.js |
| `src/render/hero-model.ts` | `HeroModel`: clone, pieces by node name, `setLook`, spring chains (scarf, coat) |
| `src/render/hand-ik.ts` (+ test) | Two-bone IK for the left arm |
| `src/render/hero-preview.ts`, `src/ui/inventory.ts` | Turnable preview in the doll |
| `src/render/characters.ts`, `weapons.ts`, `renderer.ts`, `materials.ts` | `HeroView` uses `HeroModel`; `HeroPose.look`; left grip points; `fromGltf` keeps normal maps |
| `src/render/hero-contract.test.ts` | Reads `hero.glb` and `anims.glb`: joints, node names, budgets |

## Skeleton and bone-name contract
| Rule | Value |
|---|---|
| Skeleton source | The skin of `assets-src/body/Superhero_Female_FullBody.gltf`, copied by `tools/build-hero.mjs` with its inverse bind matrices. **The skeleton never passes through Blender**: Blender's glTF import and export re-orient bones, which would break the rotation-only clips. Blender delivers vertices, UVs, textures and weights by joint name (the way `build-assets.mjs` rebinds the hair today) |
| Joints 0 to 64 | UAL order and names, unchanged: `root pelvis spine_01 spine_02 spine_03 neck_01 Head`, then per side `clavicle upperarm lowerarm hand`, fingers `index middle pinky ring thumb` × `_01 _02 _03 _04_leaf`, then per side `thigh calf foot ball ball_leaf` (suffix `_l`, `_r`) |
| Bind pose, space | T-pose, meters, +Y up, front +Z, height 1.78 m, `pelvis` at y = 0.932 |
| Clips | `anims.glb` unchanged: rotation tracks plus `pelvis` translation; `fitClip` scales the hip track |
| Extra joints | Appended after index 64, world-aligned in the bind pose, never targeted by a clip: `scarf_01..03` (exist, parent `spine_03`), new `coat_bl_01`, `coat_bl_02`, `coat_br_01`, `coat_br_02` (back panels, parent `pelvis`). Created in `build-hero.mjs` as today; Blender only needs vertex groups with these names |
| Weights | At most 4 joints per vertex, normalized |
| Weapon | `hand_r`, rack offset `(0, 0.09, 0.03)`, rotation X 90° (`weapons.ts`). IK must never move `hand_r` or the weapon: hit arcs and `clip-swing.mjs` numbers stay valid |
| Zombie | Own file and skeleton, not touched |

## Pieces and slots
Mesh nodes in `hero.glb` are named `<group>_<id>`; the render code finds them by name only.

| Group | Nodes in H1 | Shown when |
|---|---|---|
| Body regions | `body_head` (with eyes and brows), `body_torso`, `body_arms`, `body_hands`, `body_legs`, `body_feet` | Not hidden by a visible piece |
| Fixed | `hair`, `scarf` | Always (a later hat may hide `hair`) |
| `a_` outfit (slot `a`, includes trousers, belt, harness, pouches) | `a_mantel` (long coat, baseline look), `a_weste` (short vest over a shirt) | `heroLook` |
| `f_` boots (slot `f`) | `f_stiefel`, `f_turnsch` | `heroLook` |
| `g_` gloves (slot `g`) | `g_handsch` | `heroLook`; none = bare hands |
| `h_` hat (slot `h`) | None in H1 (contract only) | Later |

- Each piece lists the body regions it hides (`a_mantel`: torso, arms, legs; `a_weste`: torso, legs; boots: feet; gloves: hands). Hidden skin cannot poke through and is not drawn.
- Tight parts (trousers, sleeves, gloves, boot shafts) are made from the body's own faces, so they keep the body's weights exactly. Loose parts (skirt, collar, hem, scarf tail) get transferred weights, then pelvis and thigh blending as today, plus the spring joints.
- Fallback until more pieces exist: unknown outfit base → `a_weste` if short in 2D (`leder`, `weste`, `blaumann`), else `a_mantel`; no armor → `a_mantel`.
- Later outfits, cheapest first: same mesh with another texture, then same mesh plus one extra part, then a new mesh for emblematic sets.

```ts
// src/data/hero-look.ts
export type BodyRegion = 'head' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet';
export interface HeroLook { outfit: string; boots: string; gloves: string | null; hat: string | null }
export interface Piece { node: string; hides: readonly BodyRegion[] }
export const PIECES: Readonly<Record<string, Piece>>;
export function heroLook(equipment: Readonly<Partial<Record<SlotId, { base: BaseId }>>>): HeroLook;
```

## Swap in `src/render`
1. `HeroModel` clones `assets.hero` once, maps node name → mesh, enables `HERO_LAYER` and shadows on every piece.
2. `setLook(look)` sets `visible` on pieces and body regions. No geometry or material is created, no light count changes.
3. At load every piece is visible for one `renderer.compileAsync`, then the look is applied: no shader hitch on the first swap.
4. `HeroView.update` gets `pose.look` (`renderer.ts:282` fills it from `sim.equipment` like `kind` and `base`).
5. One GLB while it stays under 3 MB. Above that, outfits move to `assets/characters/outfits/<id>.glb` and are bound to the skeleton by joint name on first use.

## Budget (both profiles use the same meshes)
| | Now | H1, any look |
|---|---|---|
| Visible triangles | 18,606 | ≤ 32,000 |
| Skinned draw calls (beauty pass) | 8 | ≤ 9 |
| Joints | 68 | 72 |
| `hero.glb` | 1.04 MB | ≤ 3 MB |

| Piece | Triangles | Base color | Normal map (Qualität only) |
|---|---|---|---|
| Head with eyes, brows | ≤ 4,500 | 1024 px (body atlas) | 1024 px, from the pack |
| Hair | ≤ 3,000 | 512 px | no |
| Hands or gloves | ≤ 2,500 | 512 px | no |
| Outfit | ≤ 14,000 | 1024 px | 1024 px |
| Boots | ≤ 3,000 | 512 px | no |
| Scarf | ≤ 1,500 | 512 px | no |
| Hat (later) | ≤ 1,500 | 512 px | no |

Textures are WebP at quality 85. Leistung loads no normal maps (`profile.normalMaps`, already there). Cost against today: about 13,000 more triangles in 4 passes (beauty, shadow, pre-pass, contour) and one more draw call; the scene draws about 440,000 triangles, so this is small, but it is measured in step 7. No LOD.

## Blender scripting
- Everything is a script run headless; no `.blend` is committed. `hero_build.py` may save `assets-src/hero/hero.blend` (ignored by git) for looking at it.
- Blender 5.3.0 is not on PATH. Path on Johannes' PC: `C:\Program Files\Blender Foundation\Blender 5.3\blender.exe`. `build-hero.mjs` uses `$BLENDER`, then PATH, then this path.
- Verified 2026-11-17: `blender -b --python-expr ...`, glTF import and an EEVEE render run headless (12 s for two pictures).
- The Blender MCP tools are for looking while developing. The committed result must rebuild with `npm run assets:hero` alone.
- Textures: Blender bakes placeholders (AO, tint, seams). Painted images come from Codex (`docs/asset-pipeline.md`), step 6.
- Optional mesh source, not downloaded or checked: Quaternius "Modular Character Outfits - Fantasy" (CC0, 62 parts). Use it only if its joint names equal the contract; add it to `tools/fetch-assets.sh` and `assets/LICENSES.md` first.

## Left hand on two-handed weapons
- `weapons.ts`: left grip height along the shaft per model, `hammer` 0.48, `spear` 0.50 (start value 0.62, tuned in step 2); `pipe`, `blade`, `sling` have none.
- `hand-ik.ts`: after `anim.update`, a two-bone solve sets `upperarm_l` and `lowerarm_l` so `hand_l` reaches the grip point on the weapon; the elbow keeps the clip's bend direction; `hand_l` is turned to wrap the shaft; left fingers take a fixed curl.
- Weight: 1 in idle, run and attack with a two-handed model. It fades to 0 between 90 % and 100 % of arm reach, and is 0 in dodge, death, throw casts and under the hit flinch. Changes ease over 0.08 s.
- Works on the current `hero.glb`; independent of every other step.
- Reach limits, the two-handed idle clip and the release rule: Decision: left hand reach (below the step 2 handover).

## Inventory preview
- `HeroPreview` owns a second `HeroModel` (shared geometry and materials), a small scene with three fixed lights and a camera on the full body.
- It renders with the game's `WebGLRenderer` into a render target and copies the pixels to a 2D canvas that replaces `<img class="inv-portrait">`. No second WebGL context, no change to the main canvas. The canvas survives `innerHTML` re-renders (re-attach, do not recreate).
- It draws only when something changes: drag, stick, look change, and the `Sword_Idle` loop at 20 fps. The game does not render while the menu is open, so this is the only GPU work.
- Turning: pointer drag left and right, right stick, arrow keys while focused. Same look and weapon as in the game; colors match the game (tone mapping and sRGB), ink line not required.
- Layout of the doll stays as it is (U1). No mockup round.

## Steps
| # | Step | Owner | Done when |
|---|---|---|---|
| 1 | Pipeline proof: `build-hero.mjs` and `hero_build.py` send the body through Blender unchanged and rebind it to the source skeleton; `hero-contract.test.ts` | PC · Blender · Opus high | Largest vertex shift under 0.1 mm; joints equal the contract; `clip-sheet.mjs` strips of `Sword_Idle`, `Sprint_Loop`, `Roll`, `Sword_Heavy_Combo`, `OverhandThrow`, `Death01` differ from today in under 0.5 % of pixels; `npm run check` |
| 2 | Left-hand IK (own PR, can run before step 1) | Claude · Opus high | Unit test for the solve; strips of `Sword_Heavy_Combo` with hammer and `Punch_Cross` with spear before and after in `docs/proof/h1-hero/`; `clip-swing.mjs` numbers unchanged. **Johannes looks**: hammer and spear in the game |
| 2b | Two-handed standing idle and clean release in attacks (spec: Decision: left hand reach) | Claude · Opus high | Left hand holds through the whole idle loop with hammer and spear (weight 1.00 in the `clip-sheet` log); no left-arm jump in a 60 Hz capture of both attack chains; `clip-swing.mjs` output for `Sword_Heavy_Combo`, `Punch_Cross`, `Melee_Hook` byte-identical and `src/data/combat.ts` untouched; `npm run check`. **Johannes looks**: standing, starting to run and the first hit from standing, hammer and spear |
| 3 | Hero v1: `a_mantel`, `f_stiefel`, `g_handsch`, new scarf, body regions, coat spring joints, baked placeholder textures, skin normal map | PC · Blender · Opus high | Budget and contract tests pass; old and new side by side: `render_glb.py` pictures plus game screenshots at `?cam=5,30` and the default camera on both profiles. **Johannes looks and approves or gives feedback** (at most two rounds) |
| 4 | Swap: `hero-look.ts`, `HeroModel`, `HeroPose.look`, second look `a_weste`, `f_turnsch`, bare hands | Claude · Opus high (Blender part on the PC) | Tests for `heroLook` (every armor, glove and boot base resolves to an existing node); equipping changes the hero in the game with no frame over 50 ms on the first swap; screenshots of both looks |
| 5 | Inventory preview | Claude · Opus high | Turns by touch, mouse, pad and keys at 844 × 390, 1280 × 800 and 1280 × 720; e2e test: the canvas is not blank and changes after a drag. **Johannes looks** |
| 6 | Painted textures for step 3 and 4 pieces over the UV layouts | Codex, then Claude for sizes and WebP | Rows in `assets/LICENSES.md`; budget test passes |
| 7 | Measure and close: `docs/status.md`, `assets/LICENSES.md`, queue row | Johannes measures, Opus medium writes | `?debug=perf` before and after on the PC (Qualität) and the Tab S9 (Leistung), numbers in `docs/proof/h1-hero/README.md`; no drop over 1 ms p95 |

Steps 1, 3, 4 need the PC with Blender. Steps 2 and 5 run anywhere.

### Step 2 handover (Opus 5.5, 2026-11-17)
- Built: `LEFT_GRIP` and `WeaponRack.leftGrip`/`twoHanded` in `weapons.ts`; `hand-ik.ts` (`solveTwoBone`, `gripRotation`, `reachFade`, `LeftHandIk`) with 9 tests; `HeroView.update` runs it after the clips, before the scarf. `clip-sheet` gets `ik=1`, plus `view=left`, `zoom`, `fov`, `aim` (look-at height) and `grip` (try a height); `clip-sheet.mjs` takes `PORT`.
- The arms are mirrored in the rig, so the left hand uses the right hand's grip frame: shaft along local +Z (thumb toward the head), fist centre at `(0, 0.09, 0.03)`. Hand roll: the wrist sits on the shoulder side of the shaft. Finger curl: the left fingers of `Punch_Cross` at its first key (the same curl the sword clips give the right hand).
- Grip heights, tuned on strips: hammer 0.48 (lands on the existing upper wrap); spear 0.62 → 0.50 (at 0.62 the guard arm is at 87 % of reach with a raised elbow).
- Unchanged: `clip-swing.mjs` output for `Sword_Heavy_Combo`, `Punch_Cross`, `Melee_Hook` is byte-identical. The solve writes only `upperarm_l`, `lowerarm_l`, `hand_l` and the left fingers.
- Proof in `docs/proof/h1-hero/`: `ik-before-*` and `ik-after-*` (side strips as specified, plus close strips: `hammer-heavy-left` at 0.9–1.7 s, `spear-cross-front`, `hammer-run`).
- Reused from 2D: nothing; 2D draws weapons as sprites with grip and tip pivots, without arms.
- **Open, needs a decision (Fable).** The clips are one-handed, so the weapon is often out of the left arm's reach and the hand lets go there. Reach ratio is shoulder-to-grip divided by arm length plus fist, measured at grip 0.48. The hand holds up to 0.9 and lets go at 1.0.

  | Clip | Ratio at the grip | Left hand |
  |---|---|---|
  | `Sprint_Loop`, `Jog_Fwd_Loop` | 0.50–0.61 | holds throughout |
  | `Punch_Cross` (spear) | guard and return 0.42–0.70, thrust (0.25–0.55 s) 1.04–1.23 | holds in guard and return, lets go in the thrust |
  | `Melee_Hook` (spear) | 0.43–0.53 from 0.4 s, 1.1–1.5 before | lets go in the swing |
  | `Sword_Heavy_Combo` (hammer) | 0.37–0.66 only at 0.9–1.1 s and 1.6–1.7 s; up to 2.1 in the swings | mostly lets go |
  | `Sword_Idle` (standing) | 1.42–1.48; best of any height 1.26 | never holds |
  | `Idle_Loop`, `Idle_Shield_Loop`, `Sword_Block` | 0.95–1.08 | at the edge |

  Options: (a) another idle loop for two-handed weapons (none in the packs is in reach); (b) let the solve also turn `clavicle_l` (a few cm, not enough for `Sword_Idle`); (c) two-handed clips made in Blender (H1 says no new clips); (d) accept that the left hand holds only while running and in the spear guard. The spine is out because it would move `hand_r`.
- Seen once: `src/sim/director.test.ts` timed out at 5.5 s while Blender ran in parallel; it passes on rerun.

### Decision: left hand reach (Fable 5.2, 2026-11-17)
Notes; Opus writes final prose.

**Decision**
- **Standing idle:** two-handed models get their own idle clip from the UAL pack, `Idle_FoldArms_Loop` (UAL2, not imported yet): upright, weapon leaning over the right shoulder, both hands on the shaft at the chest. Idle has no hit arc, so a different clip there breaks nothing; the weapon rule in the contract (IK never moves `hand_r`) stays as it is.
- **Attacks:** clips, `combat.ts` and arcs stay. The swing itself stays one-handed; the left hand holds where the clip allows and lets go without a jump.
- **Rejected:** clavicle in the solve, a grip that slides during swings, spine or full-body IK, two-handed clips authored in Blender.

**Why** (throwaway probe: all 86 pack clips on the hero skeleton at 30 Hz; ratio = the value `LeftHandIk.apply` fades on, arm 0.49 m, holds up to 0.9)

| Finding | Number |
|---|---|
| Swings, best grip anywhere on the shaft (hammer 0.14–0.85, spear −0.45–1.1) | `Sword_Heavy_Combo` swings 1.2–1.7, `Punch_Cross` thrust 1.06–1.26, `Melee_Hook` swing 1.2–1.5: no grip height reaches |
| Clavicle | About 5 cm = 0.1 of the ratio. Not enough for any swing; only the 0.95–1.1 idles would gain, and those are replaced |
| `Idle_FoldArms_Loop` | 0.36–0.37 at grip 0.20–0.22 (0.91–0.93 at 0.48): holds 100 %, both weapons |
| `Idle_Lantern_Loop` (UAL2) | 0.37–0.39 at 0.48: shaft level across the chest, arms out. Too stiff as idle, reads as a two-handed block |
| Other clips that hold | `Idle_Rail_Loop` 0.64–0.66 (bent forward, head down), `Crouch_Idle_Loop`, `Push_Loop`: wrong poses. No attack clip in the packs holds through its swing |
| What the player sees | Default camera (18.5 m, FOV 36°): hero about 160 px tall at 1080p, about 60 px on a 390 px phone; the left hand is 3 to 8 px. Active frames last 0.09–0.13 s. Idle, run and guard are held long enough to read; the swing is not |
| Blender clips | The skeleton must not pass through Blender (contract), nobody keyframes combat by hand here, and every changed attack clip needs new `combat.ts` timing, arcs and smear. Cost and risk are out of proportion to 3 to 8 px |
| Cost of a pack clip | About 21 KB in `anims.glb` per idle loop; hero only |

Pictures (probe renders, `Idle_FoldArms_Loop` at grip 0.22): `docs/proof/h1-hero/idle-2h-candidates-hammer.png`, `-spear.png`. Panels: now (`Sword_Idle`, hand off) · `Idle_FoldArms_Loop` · `Idle_Lantern_Loop`.

**Work item 2b: two-handed idle and clean release [Claude · Opus high]** (this PR or the next; no Blender)
- `tools/build-assets.mjs` `CLIPS`: add `Idle_FoldArms_Loop` (and `Idle_Lantern_Loop` if the optional point below is taken); rebuild `anims.glb`; fix clip counts where a test or doc states 38.
- One function picks the standing clip from weapon model and guard (used by `HeroView.update` and later by the inventory preview, step 5): two-handed → `Idle_FoldArms_Loop`, else `Sword_Idle`.
- Grip height per state: idle about 0.22 (tune 0.22–0.32 on strips, both weapons), everything else stays 0.48 / 0.50. Ease the height over about 0.15 s so the hand slides instead of jumping when she starts to run.
- Clean release: ease the final weight (state × reach fade) in time, grab about 0.12 s, release about 0.06 s. During wind-up and active frames of an attack the hand never grabs anew; it only keeps holding or lets go. Known spots: `Sword_Heavy_Combo` 0.85–0.90 s (ratio 1.42 → 0.52) and 1.10–1.15 s (0.51 → 1.26).
- Optional, only if it reads well on a strip: standing guard with a two-handed model uses `Idle_Lantern_Loop` instead of `Idle_Shield_Loop` (1.09–1.11, never holds).
- Proof: strips before and after for idle, run start and both attack chains in `docs/proof/h1-hero/`. Done-when: Steps row 2b.

**Johannes decides the stance (look choice).** Show him the game with hammer and spear, plus the two candidate pictures: the calm upright carry (`Idle_FoldArms_Loop`) against today's fighting stance with one hand. If he wants the fighting stance kept with both hands on the weapon, build the fallback instead:
- **Fallback 2c: carry pose in code [Claude · Opus high].** Body stays on `Sword_Idle`. In standing idle only, the weapon is placed relative to `spine_03` (grip point and shaft direction per model, about 6 numbers), the right arm gets the same two-bone solve plus the hand rotation, then the existing left solve runs. Weight is 0 in attack, cast, dodge and death and eases out in at most 0.08 s, so it is 0 before the first active frame (shortest wind-up from standing 0.09 s; the dash strike follows a dodge). Same done-when as 2b. More code and one or two look rounds; not started unless Johannes asks.

**Johannes, 2026-11-17 (after the pictures):** the upright carry is rejected (left arm too twisted). The spear keeps today's standing pose with one hand (`Sword_Idle`). For the hammer, the candidate is `Pistol_Idle_Loop` (UAL1). Its left hand already sits at the handle, so the IK only moves it 7 cm, to grip 0.08 below the right hand. The arm stays untwisted when the solve keeps the clip's wrist roll (trial `keepRoll`) and may stretch the nearly straight arm (clip at 0.91 of reach). Pictures: `docs/proof/h1-hero/hammer-stance-pistol-*.png`. Waiting for his verdict; 2b changes accordingly.

### Step 2b handover (Opus 5.5, 2026-11-17)
- Built: `Pistol_Idle_Loop` in `CLIPS` (`anims.glb` 39 clips, +16 KB; `hero.glb` and `zombie.glb` unchanged). `TWO_HAND_STAND` in `weapons.ts` (hammer: that clip, left grip −0.08, just below the right hand); `standClip()` in `characters.ts` (for the step 5 preview too). The spear keeps `Sword_Idle`.
- `hand-ik.ts`: `aim` (target and reach fade) and `pose` (weight) are separate now. A stance factor (0..1, eased over 0.15 s) slides the grip height, keeps the clip's wrist roll (no twist) and moves the reach fade out by 0.3. That lets the nearly straight arm of the pistol pose stretch the last 7 cm. `easeGrip`: grab 0.12 s, release 0.06 s, no new grab during an attack's wind-up and active frames. Tests: 15 in `hand-ik.test.ts`, plus `stand-clip.test.ts`.
- Checked: the hammer standing loop holds at weight 1.00 in every `clip-sheet` frame (`2b-hammer-stand.png`). `clip-swing.mjs` output is byte-identical and `combat.ts` is untouched. In-game 60 Hz captures of both attack chains from standing show no arm jump (`2b-hammer-game-chain.png`, `2b-spear-game-chain.png`; one frame per sim step in the first 12 steps). `npm run check`: `director.test.ts` and `koepenick.test.ts` hit the 5 s timeout while the PC was busy, then passed on rerun.
- `clip-sheet`: `stance=1`, `pack=UAL1_Standard` (plays a clip from `assets-src/` before importing it).
- Not done: Johannes' look in the game (standing, starting to run, first hit, hammer and spear). The optional two-handed guard (`Idle_Lantern_Loop`) and fallback 2c were not built.

**Not done here:** real two-handed attack clips. Own task, only if Johannes misses them after seeing 2b: needs a clip source on the UAL skeleton (not checked) and new timing, arcs and smear for hammer and spear.

## Not in scope
A new body or head, authored clips or retargeting (importing more clips from the UAL packs is allowed, see Decision: left hand reach), two-handed attack clips, weapons as GLB files (they stay code-built), trying on a bag item in the preview, zoom in the preview, hats and the other 12 outfits (follow-up H1b: one task per batch, textures first), enemies (H2).

## Handover (Fable 5.2, 2026-11-17)
- Setup on the PC: Node 24.14.1, npm 11.11.0, Blender 5.3.0 (path above), `npm ci`, source packs fetched, `npm run assets` rebuilt. `zombie.glb` and `anims.glb` are byte-identical; `hero.glb` differs by 4 bytes with identical geometry, textures and joints, so the committed file stays.
- `tools/fetch-assets.sh` parsed JSON with `python3`, which Windows lacks; it uses Node now.
- `.claude/launch.json` starts the dev server on port 5173 for the screenshot tools. The Playwright browser must be installed once per PC: `npx playwright install chromium`.
- Reused from 2D: the item-to-look rule (`heroKeys`), the piece lists and the short and long outfit split.
- Not checked: the Quaternius outfit kit, the IK grip heights, the frame cost on the Tab S9.

## Handover step 1 (Opus 5.5, 2026-11-17)
- Built: `tools/blender/hero_lib.py` (import; export in a small work format, `assets-src/hero/work/meshes.json` + `.bin`, top 4 normalized weights by vertex group name, glTF axes), `tools/blender/hero_build.py` (step 1: source body in, meshes out unchanged; saves `hero.blend` in the work folder), `tools/build-hero.mjs` (`npm run assets:hero`: finds Blender, runs it, `rebind` swaps each source mesh's vertices, normals, UVs, weights and indices for Blender's by mesh and joint name, keeps the source nodes, skin and inverse bind matrices, checks the shift and the joint contract, then runs the unchanged dressing code), `tools/character-lib.mjs` (helpers shared with `build-assets.mjs`, which now builds zombie and clips only), `src/data/hero-contract.ts` (joint lists and budget, also imported by the build), `src/render/hero-contract.test.ts`, `tools/image-diff.mjs`.
- Results: largest vertex shift 0.00062 mm (limit 0.1). Joints equal the contract (65 core + 3 scarf). Vertex order, joints, weights, UVs and triangles are identical; normals differ by at most 0.0025 (Blender stores custom normals as 16-bit). Strips in `docs/proof/h1-hero/step1/` (`before-*` from the old file, `after-*` from the rebuild) differ in 0.006 to 0.009 % of pixels; only 0.001 % of `Sword_Heavy_Combo` differs by more than 8/255. The rebuild is byte-stable; `zombie.glb` and `anims.glb` stay byte-identical. Build time about 5 s.
- The committed `hero.glb` is the rebuilt one (1,037 KB, 18,606 triangles, 8 primitives).
- For step 3: keep `merge_vertices=False` on import so body faces keep their glTF vertex order. `rebind` matches Blender objects to source mesh nodes by name and replaces their geometry; new pieces need a path that adds nodes. `hero_lib.mesh_arrays` already splits vertices per normal and UV for modeled meshes.
- Reused: hair rebinding by joint name from `build-assets.mjs`; the 2D repo has nothing for this step.

## Handover step 3a (Opus 5.5, 2026-11-17)
- Built: `tools/blender/hero_clothes.py` with `a_mantel` (coat body and sleeves with turned-up cuffs, trousers, skirt to mid-calf: open below the belt, slit at the back, torn hem; stand collar, belt with buckle, pouch on the right hip, flap pocket, two rows of buttons), `f_stiefel` (inflated feet and lower calves, voxel remeshed so the toes melt into one boot, flat sole, folded cuff) and `g_handsch` (gloves from the hand faces, decimated to the budget). Tight parts are body shells with the body's weights. The skirt, collar, belt and pocket are built in code, weighted pelvis to thighs as before. The boots take the weights of the nearest body point.
- `tools/build-hero.mjs`: the body is split into `body_head`, `body_torso`, `body_arms`, `body_hands`, `body_legs`, `body_feet`. The six nodes share the body's vertex buffers, so the split costs no file size, and each triangle goes to the region of its vertices' dominant joints. Pieces become their own skinned nodes with vertex colours (`COLOR_0`; the work format gained `color`). `scarf` and `hair` are their own nodes. The painted body (`dress`), the old coat skirt and the gear are gone. `src/data/hero-contract.ts`: `HERO_REGIONS`, `regionOf`, `HERO_PIECES` (hides) and `HERO_DEFAULT_LOOK`.
- Game: `wearDefaultLook` in `characters.ts` shows the three pieces and hides torso, arms, legs, feet and hands, until step 4's `HeroModel.setLook`.
- Numbers (3a; 3b: 1,326 KB, 28,894 triangles): file 1,213 KB, 28,546 triangles, byte-stable rebuild (faces sorted and triangulated with a fixed rule; pieces carry no UVs until step 6); default look 8 draw calls and about 18,800 triangles (budget 9 and 32,000). Pieces: coat 5,742, boots 2,210, gloves 2,360 triangles. The contract test checks the visible default look, every region node and every piece node. Build time about 10 s.
- Pictures in `docs/proof/h1-hero/step3/`: `before-blender-body.png` and `after-blender-body.png`; `close-Qualität.png`, `close-Leistung.png` (`?cam=5,30`) and `default-Qualität.png` (default camera), each old on the left and new on the right; `strip-*.png` for sprint, hammer combo and roll.
- Reused from 2D: the `mantel` design in `assets/raw/codex/07-player-rig-v2/outfits-a.png`: belted trench to mid-calf with a flap pocket, buttons, a collar and a torn hem. The colours come from the old painted dress.
- Open in step 3:
  - the new scarf (still the code-built ring and tail)
  - the coat spring joints (`coat_bl_*`, `coat_br_*`): the skirt follows the thighs and stretches between the legs in deep lunges
  - UV layouts and baked placeholder textures (vertex colours for now)
  - the skin normal map
  - the chest still shows the body's shape; relaxing does not bridge it
  - `Eyes` and `Eyebrows` stay their own nodes instead of joining `body_head`
- `tools/screenshot.mjs` takes `PORT` like `clip-sheet.mjs`.

## Johannes, 2026-11-17 (step 3 look 1)
- Continue in this direction; the coat colour is close to the 2D mantel.
- The first comparison showed almost no difference: legs and boots showed through the open coat, the scarf tail ran through the back, and only the belt changed. Fixed in step 3b below.
- **Equipment needs more visible differences (colours, textures) so collecting is fun.** That goes beyond one coat look and changes H1's scope, so it needs a Fable pass before step 4. Proposal, cheapest first, following style bible v0.52 (starter gear rust and brown; every new item one strong signature colour):
  1. Step 4: a palette per item base for every piece, using a tint or a vertex-colour remap on the same mesh, so each armor, boot and glove base looks different at once. No new meshes, no draw calls.
  2. Step 6: Codex textures per item base (pattern, wear, emblem), not one per mesh.
  3. H1b: more meshes for the 14 2D outfits, emblematic sets first.

## Handover step 3b (Opus 5.5, 2026-11-17)
- Coat closed like the 2D mantel: the left panel wraps over the right past the centre, a small walking opening in the last quarter, a short back slit at the hem. The collar is gone; the scarf covers the neck, as in 2D. Skirt weights: the front follows the thigh fully from a third of the way down, so a raised knee no longer pokes through (sprint, hammer combo, roll strips).
- New scarf from Blender (`hero_clothes.scarf`): two lumpy wraps, a knot on the left front, a short front tail and the long back tail on `scarf_01..03` (bones still made in `build-hero.mjs`). The tail is pushed outside the coat's back. 688 triangles. The code-built ring and tail are gone.
- Skin normal map kept from the pack (`slimMaterials` keeps it for the body, JPEG 1024, +102 KB); `fromGltf` passes normal maps, Leistung drops them as before.
- Pictures, replaced in `docs/proof/h1-hero/step3/`: `close-*.png` (facing the camera, old left, new right), `after-blender-*.png`, `strip-*.png`.
- Still open in step 3: the coat spring joints, UV layouts with baked placeholder shading, and the chest shape. Waiting for look 2 before more look work.

## Questions
- Johannes (look 2 of 2): is the closed coat, with its wide skirt in the two-handed stance, right?
- Equipment variety: run the Fable pass on the proposal above before step 4?
