# H1 Custom hero: real clothing, outfits, inventory preview [PC · Blender · Opus high; spec Fable high]

Status: open. Decided and specified 2026-11-17 (Fable 5.2 high, confirmed by Johannes). Nothing is built yet. Notes are short on purpose; Opus writes final prose while building.

## Goal
The hero keeps her body, face, skeleton and all 38 clips, and gets real clothing instead of paint on the skin. Clothing and equipment change her look, she can be turned in the inventory tab, and the left hand holds two-handed weapons.

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
- `weapons.ts`: left grip height along the shaft per model, `hammer` 0.48, `spear` 0.62 (start values); `pipe`, `blade`, `sling` have none.
- `hand-ik.ts`: after `anim.update`, a two-bone solve sets `upperarm_l` and `lowerarm_l` so `hand_l` reaches the grip point on the weapon; the elbow keeps the clip's bend direction; `hand_l` is turned to wrap the shaft; left fingers take a fixed curl.
- Weight: 1 in idle, run and attack with a two-handed model. It fades to 0 between 90 % and 100 % of arm reach, and is 0 in dodge, death, throw casts and under the hit flinch. Changes ease over 0.08 s.
- Works on the current `hero.glb`; independent of every other step.

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
| 3 | Hero v1: `a_mantel`, `f_stiefel`, `g_handsch`, new scarf, body regions, coat spring joints, baked placeholder textures, skin normal map | PC · Blender · Opus high | Budget and contract tests pass; old and new side by side: `render_glb.py` pictures plus game screenshots at `?cam=5,30` and the default camera on both profiles. **Johannes looks and approves or gives feedback** (at most two rounds) |
| 4 | Swap: `hero-look.ts`, `HeroModel`, `HeroPose.look`, second look `a_weste`, `f_turnsch`, bare hands | Claude · Opus high (Blender part on the PC) | Tests for `heroLook` (every armor, glove and boot base resolves to an existing node); equipping changes the hero in the game with no frame over 50 ms on the first swap; screenshots of both looks |
| 5 | Inventory preview | Claude · Opus high | Turns by touch, mouse, pad and keys at 844 × 390, 1280 × 800 and 1280 × 720; e2e test: the canvas is not blank and changes after a drag. **Johannes looks** |
| 6 | Painted textures for step 3 and 4 pieces over the UV layouts | Codex, then Claude for sizes and WebP | Rows in `assets/LICENSES.md`; budget test passes |
| 7 | Measure and close: `docs/status.md`, `assets/LICENSES.md`, queue row | Johannes measures, Opus medium writes | `?debug=perf` before and after on the PC (Qualität) and the Tab S9 (Leistung), numbers in `docs/proof/h1-hero/README.md`; no drop over 1 ms p95 |

Steps 1, 3, 4 need the PC with Blender. Steps 2 and 5 run anywhere.

## Not in scope
A new body or head, new clips or retargeting, weapons as GLB files (they stay code-built), trying on a bag item in the preview, zoom in the preview, hats and the other 12 outfits (follow-up H1b: one task per batch, textures first), enemies (H2).

## Handover (Fable 5.2, 2026-11-17)
- Setup on the PC: Node 24.14.1, npm 11.11.0, Blender 5.3.0 (path above), `npm ci`, source packs fetched, `npm run assets` rebuilt. `zombie.glb` and `anims.glb` are byte-identical; `hero.glb` differs by 4 bytes with identical geometry, textures and joints, so the committed file stays.
- `tools/fetch-assets.sh` parsed JSON with `python3`, which Windows lacks; it uses Node now.
- `.claude/launch.json` starts the dev server on port 5173 for the screenshot tools. The Playwright browser must be installed once per PC: `npx playwright install chromium`.
- Reused from 2D: the item-to-look rule (`heroKeys`), the piece lists and the short and long outfit split.
- Not checked: the Quaternius outfit kit, the IK grip heights, the frame cost on the Tab S9.

## Questions
None open.
