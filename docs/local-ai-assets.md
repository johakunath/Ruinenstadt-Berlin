# Local AI asset pipeline (PC)

Decided by Johannes on 2026-11-22. **Local models come first** for texture images, icons, reference images and static 3D props. Codex image generation is the fallback: use it when the local result does not satisfy or a job does not work locally (for example sign atlases with a lot of text). This supersedes the "Codex only" texture rule of 2026-11-16 in `docs/asset-pipeline.md`; that file keeps the style, technical and integration rules, which apply unchanged to local images.

**Codex paused (Johannes, 2026-11-23):** there is no Codex fallback for now. Where the table says Codex, do a second local round (other prompt, seed or reference image); if that still fails, keep the code-painted placeholder and note it in the task file. Text-heavy sign atlases are painted in code (canvas text in `src/render`).

Whoever drives this (Claude on the PC, or Johannes) follows the standard workflow for the asset group below. When a step goes differently than written, update this file in the same PR (a short line under Lessons).

## Tools on the PC

| Tool | Where | Use | Licence |
|---|---|---|---|
| ComfyUI | `C:\Users\Johannes\AI projects Local\ComfyUI`, started with `ComfyUI starten.bat` (API at `http://127.0.0.1:8188`) | Runs the models below | GPL-3.0 (the tool only; outputs are not covered) |
| FLUX.2 klein 4B | `models/diffusion_models/flux-2-klein-4b.safetensors`, `text_encoders/qwen_3_4b.safetensors`, `vae/flux2-vae.safetensors`; templates `image_flux2_klein_text_to_image`, `image_flux2_klein_image_edit_4b_distilled` | Texture images, icons, decals, single reference images for image-to-3D | Apache 2.0: commercial use allowed, usable in the EU. Not the 9B model (non-commercial) |
| Pixal3D | `models/diffusion_models/pixal3d_multiview_int8_convrot.safetensors` with the TRELLIS.2 VAEs, DINOv3 and BiRefNet; templates `3d_pixal3d_multi_views`, `3d_pixal3d_trellis2_image_to_model` | Static 3D props from images: geometry plus a baked texture | Johannes accepts it (2026-11-22). Its licence was academic-only and EU-excluded at release and may be MIT now; read the LICENSE file on Hugging Face before a commercial release. If it does not allow commercial use, switch the template to TRELLIS.2 (MIT, same workflow) |
| Blender | Headless as in `npm run assets:hero`, or by hand | Clean-up, decimation, skinned clothing, retargeting | GPL (tool only) |

Hardware: RTX 4070 12 GB, 32 GB RAM. Close ComfyUI before measuring the game (it holds GPU memory).

How Claude drives ComfyUI: export a workflow from the ComfyUI menu with "Export (API)", store it in `tools/comfy/<name>.json`, send it with `POST /prompt`, wait on `GET /history/<id>`, fetch the result with `GET /view?filename=…`. Trial A builds the small `tools/comfy.mjs` script for this.

## Lessons so far

| Date | Lesson | Source |
|---|---|---|
| 2026-11-22 | FLUX.2 klein is fast and free and good for textures. Several views of one object do not match each other: never feed FLUX multi-angle sheets into image-to-3D | Johannes, another game |
| 2026-11-22 | Pixal3D works locally for simple static props (toy race cars) | Johannes, another game |
| 2026-11-22 | LA1: about 4 s per 1024 px image on the 4070 (16 s for the first, model load). Plain text-to-image comes out photographic, and asked for "painterly" it turns cartoonish with drawn shadows. Best: img2img from the texture it replaces (`--init`, denoise 0.7) with a "semi-realistic hand-painted" prompt; it keeps scale and palette and adds the wear. Ask for "even density, nothing along the edges" or features pile up at the border. Generated colours drift (here greenish): always run `tools/texture-tile.mjs --match` against the old texture | LA1 |
| 2026-11-24 | Brick size comes from the start image: img2img keeps the row count of `--init`. For smaller bricks than the start image, tile the start image 2 × 2 first; tiling the finished pick instead shows its dark bricks as a regular grid. A placeholder with a top-to-bottom gradient (soot runs) carries it into every variant: start from a clean texture instead | T6 |
| 2026-11-22 | Image-to-3D gives a fused mesh with no clean topology and no rig. Use it for things that do not bend: props, and parts that hang rigidly on one bone | Scouting session |

## Which route for which asset

| Asset group | Route | Why | Fallback |
|---|---|---|---|
| Tileable surface textures (facades, stone, roofs, ground, fur, cloth: T6, T8, T9a to T9e, T9i, T9j, T10, T14, T9 hero cloth) | **W1** FLUX.2 klein | Fast, free, good at textures | Codex |
| Decal and alpha atlases (weathering, leaves, posters T9g, markings) | **W2** FLUX.2 klein, cut out in code | Same model, alpha made in code | Codex |
| Sign atlases with a lot of text (T7, T9f, T13) | Code-painted text atlas (Claude); Codex while it is paused: none | A 4B model renders long or exact text poorly | Code-painted placeholder |
| Painted item icons for items without a 3D model (K4, K5) | **W3** FLUX.2 klein edit, using an existing icon as the style reference | Small images, easy to compare | Codex |
| Item icons and Kodex busts for things that have a 3D model | Render the in-game model (`tools/kodex-portraits.mjs`, item icon renders) | Matches the body exactly | none |
| Static organic or detailed props (dino statues, statues, urns, samovar, rubble piles, debris, sculpted fountains, pickups per item kind P10, cars P3 as a trial) | **W4** FLUX.2 reference image, then **W5** Pixal3D, then **W6** Blender clean-up | Shapes that are slow to model in code | Code-built geometry |
| Rigid boss parts on one bone (Rattenmutter rat head, Pickelhaube, fire helmet, sunflower head, Kernspeier pot, the Sultan's crown) | W4 + W5 + W6, then fixed to the bone like the rigid gear in `src/render/gear.ts` | No skinning needed, so no rig risk | Code gear (today) |
| Buildings, modular ruins, streets, landmarks, crates, fences, rails | Code in `src/render`, merged per material (`batch.ts`) | Works, keeps draw calls low, follows OpenStreetMap layouts | none |
| Weapons | Code (`src/render/weapons.ts`). Image-to-3D only as a later trial | The code set is complete and fits the outline | none |
| Clothing that deforms (poncho B1, jacket, short coat) | **W7** Blender by script, cut from Quaternius Modular Character Outfits (CC0, same skeleton); cloth albedos from W1 | Must be skinned to the UAL skeleton | Code coat cut |
| Character bodies (hero, `human1`, `human2`, camp keepers) | Keep the UAL skeleton and its 39 clips. Change body or head only on that rig | Every clip keeps working. Image-to-3D and VRoid are not used for bodies: no rig, and VRoid is anime by design | A new body (MPFB2, CC0) on the UAL rig needs Johannes' decision (it reopens 3D15) |
| Extra animations (two-handed swings) | Mixamo clips retargeted to UAL in Blender; commit only the retargeted result | UAL has no two-handed clips | Code IK (today) |
| Toy-style packs (Kenney, KayKit) | Not used | The chunky look clashes with the painted style | none |

## Standard workflows

### W1 Tileable texture (FLUX.2 klein)

1. Read the queue row (size, world size per tile, palette) and `docs/asset-pipeline.md` › Style and Technical requirements.
2. Take two references: the 2D art for that surface (`johakunath/Ruinenstadt` `assets/buildings/`) and the code placeholder from `src/render/paint.ts` (already seamless, with the right pattern scale).
3. Generate with `node tools/comfy.mjs --prompt "…" --init <old texture or placeholder PNG> --denoise 0.7 --count 3 --seed <n> --out assets-src/ai/<job> --name <job>` (ComfyUI running; add `--ref <2D art>` for a style reference). The start image keeps scale, palette and pattern layout (brick courses, joints). Prompt: "Semi-realistic hand-painted game texture, seamless tileable square of …" plus the queue row text, "even density over the whole square, no edges, no border, flat albedo, no light direction, no shadows, no highlights, medium-low contrast". The LA1 prompt is in `assets/LICENSES.md` and Lessons.
4. Make 3 to 6 variants, pick by eye.
5. Seams and colour: `node tools/texture-tile.mjs <png> assets/textures/<district>/<surface>.webp --match <old texture>` (half-shift blend with a noisy mask, colour moved to the old texture so the code tints still fit, 1024 px WebP 85). Then `node tools/texture-tile.mjs --check <webp> <sheet.jpg>` for the 2 × 2 repeat. Regular patterns keep their layout from the start image; if the blend smears them, use a lower denoise instead.
6. Put it in `assets/textures/<district>/` (at most 400 KB).
7. Hook it up as in `docs/asset-pipeline.md` › Initial integration (keep the code placeholder as the fallback), add the `assets/LICENSES.md` row: "FLUX.2 klein 4B (Apache 2.0), local ComfyUI; <prompt summary>; <references>", author "Claude (for Johannes)", licence "own work".
8. Look at it in game with `node tools/screenshot.mjs` on Qualität and Leistung. If it does not satisfy after two rounds, hand it to Codex with the best attempt attached.

### W2 Decal or alpha atlas

As W1, on a flat mid-grey or green background, one motif per cell at the atlas cell size. Cut the alpha in code (colour key or BiRefNet), with a clean edge and no halo. Posters: short German text only.

### W3 Painted icon

FLUX.2 klein edit with one existing icon of the same slot (for example `I44` for I95) as the reference, 512 px, then shrunk to 128 px alpha WebP. Hook-up and file names as in `docs/asset-pipeline.md` › Portrait and icon queue.

### W4 Reference image for image-to-3D

One image per object: three-quarter front view, the whole object in frame, plain light background, flat even light, no cast shadow, no other objects. Do not generate several views with FLUX (they do not match). If the object needs its back, use the single-image route and accept a guessed back.

### W5 Image-to-3D (Pixal3D)

1. Template `3d_pixal3d_trellis2_image_to_model` (single image). It needs `pixal3d_int8_convrot.safetensors` and `moge_2_vitl_normal_fp16.safetensors`, which are not in `models/` yet (only the multi-view model is); check first whether the other game's workflow already has them elsewhere. The multi-view template only helps with real views (photos, renders of a code model), not FLUX views.
2. Generate, keep the GLB and the input image together under `assets-src/ai/<name>/` (not committed, like the CC0 sources).
3. Check against the reference image; regenerate with another seed rather than repair a bad shape.

### W6 Blender clean-up (Claude headless, or Johannes by hand)

Start budgets (tune after the first trial): small prop at most 2,000 triangles, large prop (dino statue, car) at most 6,000, rigid boss part at most 1,500; one material and one texture per prop kind (512 px small, 1024 px large). Every prop kind shares one material across all its copies.

By hand, for Johannes (about 15 minutes per prop):

1. File › Import › glTF 2.0, pick the GLB.
2. Delete stray bits and any base plate: select the object, Tab (Edit Mode), hover a loose piece, press L, then X › Vertices. Tab back.
3. Size: press N, set Dimensions to the real size in metres (a car 3.5 m long, a statue 2 m high).
4. Origin on the ground: snap the 3D cursor to the bottom centre of the object (Shift+S), then Object › Set Origin › Origin to 3D Cursor; move the object to 0, 0, 0.
5. Fewer triangles: Modifier tab › Add Modifier › Generate › Decimate, lower Ratio until the triangle count (Overlays › Statistics) is under the budget and the shape still reads from above.
6. Mesh clean: Tab, A (select all), M › By Distance, then Shift+N (recalculate normals). Tab back, right-click › Shade Auto Smooth.
7. File › Export › glTF 2.0: format glTF Binary, Include › Selected Objects, Apply Modifiers on. Save next to the source as `<name>-clean.glb`.

Claude then converts it in Node (`@gltf-transform`): texture to WebP at the budget size, lighten baked shadows in the texture if Pixal3D baked any, check the triangle count, and add the prop to the map builder with its collider shape (`docs/architecture.md`). Licence row: "Pixal3D, local ComfyUI, from a FLUX.2 klein reference image", author "Claude (for Johannes)".

### W7 Skinned clothing (Blender by script)

As `docs/blender-pipeline.md`: a function in `tools/blender/hero_clothes.py`, weights from the body, joined into `hero.glb`, listed in `PIECES`. Shapes come from Quaternius Modular Character Outfits where one fits; the cloth albedo comes from W1.

### W8 Skinned boss body (H4 trial, Feldwebel, 2026-11-24)

A whole boss as one skinned mesh on the enemy skeleton, so every clip of the base body plays on it.

1. `tools/blender/front_ref.py assets/characters/human1.glb front.png`: orthographic front view of the base body in its rest pose (T-pose) on black. (Three.js `skeleton.pose()` in the enemy sheet did not give the rest pose; Blender does.)
2. FLUX img2img from it at denoise 0.85 with the boss described from head to boots, "T-pose with both arms held straight out to the sides, empty hands, … plain pure black background, flat even light, no weapon": all 12 picks kept the pose. [Picks](proof/h4-feldwebel/flux-picks.jpg).
3. Pixal3D single image (13 min), `prepare_toy_model.py --height 1.83 --tris 60000`, `bake_low.py --tris 8000 --tex 1024` (no remesh needed: one closed figure). [Mesh](proof/h4-feldwebel/mesh.jpg).
4. `tools/blender/boss_body.py --base assets/characters/human1.glb --mesh low.glb --out assets/characters/boss-<kind>.glb --name <kind> --gain 1.3`: fits it to the base's rest pose (scale came out 0.999 × 1.000: the picture kept the pose), copies the base's skin weights from the nearest surface (Data Transfer), exports with the base armature. Weapons stay the weapon rack.
5. Game (generalised 2026-11-25): `OWN_BODIES` in `src/render/characters.ts` (kind → GLB and base `human` or `female`, loaded with its base) and `OWN_MOVES` in `src/render/enemies.ts` (idle, walk, the melee blow, `keep`: bones whose code gear stays, e.g. a glowing orb or a rifle in the hand). Views pool per own kind. No other code gear; the bone proportions (`SHAPE`) without the head.

Rollout 2026-11-25: Spreehexe, Hauptmann, Grenzer, Zugezogener, Zeitwart, Diamantene Diva (about 4 min Pixal3D each once the models are warm, 13 min the first). The Diva's picture leaves out the skirt and headdress, which stay code (her gown tiers break off). Kodex framing skips the weapon rack; the officers lean into their sabre guard (`PORTRAIT`). [Before and after](proof/h4-bosses/kodex-before-after.jpg), [Hauptmann, Grenzer, Zugezogener](proof/h4-bosses/hauptmann-grenzer-zugezogene.jpg), [Zeitwart, Diva](proof/h4-bosses/zeitwart-diva.jpg), [Spreehexe](proof/h4-bosses/spreehexe-before-after.jpg).

Round 3 (2026-11-25, the last ten): at denoise 0.9 FLUX drops the arms 15 to 20° out of the T-pose (bolder costumes, but the arms no longer match the arm bones): stay at 0.8 to 0.85 and ask for "arms held exactly horizontal at shoulder height, head held high". Pixal3D can guess a forward-jutting head in profile (the first Türsteher walked hunched): check the profile in the sheet and rerun from another pick. The code bodies' bone proportions (`SHAPE`) made own bodies gorilla-like (chest 1.3×, no head compensation): own bodies skip them unless `OWN_MOVES.shape`. The Spiegelbild shares the Spiegelpaar's file (`tint`); a shared file loads once.

Steps 3 and 4 in one call: `bash tools/boss-body.sh <pixal3d.glb> <kind> <human|female>`. Pixal3D sometimes paints metallic near 1 (Spreehexe): a diffuse bake of that is black, so `bake_low.py` now bakes the high mesh as a dielectric.

Result: the clips deform cleanly. Johannes 2026-11-25: look ok, a bit bigger (render build 1.18 × 1.12), and less like a zombie: own bodies get `CharacterAssets.bosses.clips`, the enemy set plus `Sword_Idle` (stand), `Walk_Formal_Loop` (march; same stride and cycle as the zombie walk, 0.69 m per 1.33 s, measured in three.js) and `Sword_Attack` (overhead cut: wind-up 0.1 to 0.333 s, cut to 0.466 s, back at 1.27 s, `tools/clip-swing.mjs`); `anims.glb` +24 KB. [Stand, march, wind-up, cut, recover](proof/h4-feldwebel/moves.jpg). Up close much more detail; at the game camera the exaggerated gold Pickelhaube and epaulettes of the code model read better than the FLUX helmet ([before and after](proof/h4-feldwebel/before-after.jpg)): a second picture should ask for an oversized gold spike and eagle and huge epaulettes. Cost: 7,937 triangles (code model 8,238), 3 draw calls fewer, +0.7 MB GLB on maps with human bosses. The Kodex portrait (X04) is not re-rendered yet: its framing needs the new body.

## Trials (first three, backlog LA1 to LA3)

| # | Trial | Done when | Owner |
|---|---|---|---|
| LA1 | W1 on T9a Charlottenburg worn stucco (three tones), plus the `tools/comfy.mjs` script and the exported workflow in `tools/comfy/` | Three variants in game next to the Codex version, screenshots on Qualität and Leistung, Johannes picks; time per texture noted under Lessons | [Claude · Opus medium · PC] |
| LA2 | W4 + W5 + W6 on one static prop: a Spreepark dino statue (P17) or the Sultan's urn | The prop stands in its map within the triangle and texture budget, draw calls before and after noted, screenshot; Johannes tries the W6 hand steps once on a second prop | [Claude · Opus high · PC] |
| LA3 | W7 + W1 on the hero: the Regenponcho (B1) and its cloth albedo, plus one more piece from the Quaternius outfits | Both pieces animate through all clips without clipping (`tools/clip-sheet.mjs`), Johannes looks at them in the inventory preview. Then he decides whether the body or face still needs a change (3D15) | [Claude · Opus high · PC · Blender] |

### LA1 handover (2026-11-22, built)

- Tools: `tools/comfy.mjs` (FLUX.2 klein through the ComfyUI API, text to image, references, img2img) and `tools/texture-tile.mjs` (seamless, colour match, 2 × 2 check). The API graph lives in `comfy.mjs` (`graph()`), so no exported workflow file is needed.
- `assets/textures/charlottenburg/stucco.webp` replaces the common stucco on the Charlottenburg map only (`makeMats` district `charlottenburg` in `src/render/world.ts`; the code placeholder stays the fallback). Same size as before, so no memory or draw call change on any profile.
- Proof: [before and after](proof/la1/before-after.jpg) (rows: Romanisches Café old, new, Schloss old, new; `tools/landmark-sheet.mjs`, now with `?old`), [the attempts](proof/la1/attempts.jpg) (photo, cartoon, semi-real, three img2img), [2 × 2 repeat](proof/la1/repeat-2x2.jpg).
- Result: the café and the shop facades read worn and patched instead of even sand; the Schloss walls barely change (they use another surface, T9d). The light repair blotches repeat every 2 m on long walls: the next step is the three per-bay variants of T9a (a 3 × 1 atlas, the variant picked per bay in code). About 30 minutes from the first image to the in-game texture.
- Open for Johannes: does it fit (Playtest row in `docs/tasks/pt-hardware-checks.md`)? If yes, the same recipe runs T9b to T9e, T9i, T9j next.

### Round 2 (2026-11-22, built): icons and Charlottenburg roofs

- **Icons K4, K5:** six painted icons (I95, I96, I97, I102, I107, I108), img2img from the base icon with it as reference (denoise 0.9), 8 candidates each, [candidates](proof/la-icons/candidates.jpg), [picks](proof/la-icons/icons.jpg). The signet ring lost its emerald in all 8; a rerun from the best pick at 0.75 with the emerald named first fixed it. Cut-out only on the picks (`comfy.mjs --cut`), then `tools/icon-finish.mjs` (128 px, 122 px object, like the painted icons). Mapped in `src/ui/item-icons.ts`.
- **T9e, T9i:** `assets/textures/charlottenburg/roof-tiles.webp`, `slate.webp`, `iron.webp`, swapped on the Charlottenburg map only (`makeMapMats`, `makeMats`), same sizes as before, so no memory or draw call change. At denoise 0.65 the tile rows broke up ([attempts](proof/la-t9e/attempts-denoise-0.65.jpg)); 0.55 keeps them. The change is subtle at play distance ([before and after](proof/la-t9e/before-after.jpg)); the iron is hardly visible on thin bars.
- **LA2 test:** a Schlossgarten sandstone urn from one FLUX side view used as all four Pixal3D views (a round object looks the same from every side, so FLUX's view mismatch does not matter). Raw files in `assets-src/ai/la2/`; scripts copied from the global skill to `tools/comfy/` (`run_pixal3d.py`, `prepare_toy_model.py`). Pixal3D took 8.7 min (700k triangles, 56 MB), Blender 35 s. The shape is clean and the same from all sides ([sheet](proof/la2/urn-2k-6k.jpg): FLUX picture, 2,000 and 6,000 triangles). At 2,000 triangles (the small-prop budget) the decimated texture breaks into facets; at 6,000 it holds. The colour drifts from ochre to grey-green. Built the same evening, see LA2 handover.

### LA2 handover (2026-11-22, built)

- Chain: FLUX side view (`comfy.mjs`, 8 candidates) → four identical views → `tools/comfy/run_pixal3d.py` (8.7 min) → `tools/comfy/prepare_toy_model.py --height 1.6 --tris 60000` (sizes, merges, origin) → `tools/blender/bake_low.py --tris 2000 --tex 512 --tint <FLUX picture>` (7 s: merge, decimate, fresh UVs, Cycles bake from the 60k mesh, JPEG texture in the GLB). Result `assets/props/urn.glb`: 1,990 triangles, 248 KB ([sheet](proof/la2/urn-baked-2k.jpg)).
- Game: `src/render/glb-props.ts` draws GLB props as one `InstancedMesh` per kind with a surface material made at build time (compiles with the rest); geometry and texture fill in when the file loads (during the character load). Landmark builders push placements into `MapMats.glbProps`; the tint per kind goes into the vertex colours. The Mausoleum's two code vases and pedestals are now the urn ([before and after](proof/la2/mausoleum-before-after.jpg), [in game](proof/la2/in-game.jpg)).
- Cost on every profile: +1 draw call and +1 in the shadow pass for all urns together, +4,000 triangles, one 512 px texture (about 1.4 MB with mipmaps). The vases were merged into the stucco batch before, so nothing was saved there.
- Learnings: merge vertices before decimating an imported glTF (it tears into shards otherwise); bake rather than decimate the textured mesh below 6,000 triangles. A second urn kind or more placements cost nothing more than their triangles.
- Open: Johannes tries W6 by hand once on a second prop; the colour still reads cool at night (tint `[0.72, 0.62, 0.48]` in `glb-props.ts`).

### LA3 handover (2026-11-22, built)

- **Cloth (W1):** `assets/textures/hero/poncho.webp`, img2img from `coat.webp` at denoise 0.75 ("worn rubberised nylon rain poncho fabric … soft creases"), 6 candidates ([sheet](proof/la3/poncho-cloth-candidates.jpg)), matched to the coat's neutral grey so the palette sets the teal. The glossy candidates bake highlights that fight the game light; the pick has soft creases only.
- **Piece (W7):** `poncho` in `tools/blender/hero_clothes.py`: a loose shell over shoulders and chest, a front and a back panel from the chest to 0.69 m with open sides (the arms come out there), dark sleeves and trousers under it. Chest joints at the top, the coat's `skirt_weights` below the belt. 5,308 triangles; `hero.glb` 1.8 → 2.07 MB (budget 3 MB). It is its own node `a_poncho`, shown instead of `a_mantel` (0 extra draw calls).
- **Game:** `PIECES.poncho` and `outfit: 'poncho'` (`src/data/hero-look.ts`), roles in `src/render/hero-wear.ts` (coat, hem below 0.75 m, trousers), the cloth map in `characters.ts`, the glow bands and hood roll now sample `a_poncho` (`gear-body.ts`). [Look](proof/la3/poncho-look.jpg), [deep poses](proof/la3/poncho-clips.jpg): no clipping in Melee_Hook, Sword_Dash, Sprint and five more clips.
- **Quaternius piece:** `ranger_boots` in `hero_clothes.py` builds `f_wickel` from `Female_Ranger_Feet` (Outfits Fantasy, CC0; `tools/fetch-assets.sh` now fetches the pack). Same skeleton as the hero, made for the Regular body: welded, decimated 9,172 → 2,400 triangles, pushed out of the skin (4 mm foot, 12 mm shaft, past the trousers), reskinned from the body (`rebind_weights`); the brightness of its painted texture becomes the vertex colour, so the `spreestief` palette recolours it (teal band at the top). The Stiefel des Spreegeists wear it instead of the code-wrapped shaft: 528 gear triangles and 2 draw calls less; the glow line and fin cuff of the code version are gone. [Before](proof/la3/wickel-old.jpg), [after](proof/la3/wickel-look.jpg), [clips with cargo trousers](proof/la3/wickel-clips.jpg). `hero.glb` 2.27 MB.
- **Icons:** I63 and I81 re-rendered from the new pieces (`tools/item-icons.mjs`; `look-sheet.ts` now picks the piece node from `PIECES`).
- **Open:** Johannes looks at both pieces in the inventory preview, then decides on the body and face (3D15).

Downloads, each needing Johannes' OK first: for LA2 the two Pixal3D files named in W5 (if not already on the PC); for LA3 Quaternius Modular Character Outfits Fantasy (CC0, itch.io slug `modular-character-outfits-fantasy`; already used for the Stiefel des Spreegeists in WP4, but not on this PC: `assets-src/` is missing here). LA1 needs nothing new.

### T6 handover (2026-11-24, built)

- Five 1024 px WebPs in `assets/textures/xhain/` (55 to 168 KB): `wall-concrete` and `viaduct-brick` replace the common concrete and brick on the Xhain map (`makeMats` district `xhain`), `steel`, `yellow-brick` and `sand` replace the code maps of `xhainMats` (`xhain-world.ts`); the code placeholders stay the fallback. About 45 minutes, 56 images. [Before and after](proof/t6-xhain/before-after.jpg).
- Inits: common concrete and brick files; the placeholders `paintSand`, `paintMetal`, `paintYellowBrick` dumped from the dev server. Sand needed a second round (the first drew cartoon bare footprints), yellow brick a third (see Lessons).
- Cost: same materials, so 0 draw calls on every profile. GPU memory on Xhain about +14 MB (sand 256 → 1024, steel and yellow 512 → 1024; concrete and brick only swap files).
- Not judged in game: cloud-style software rendering at night shows nothing useful. Johannes checks the look on the PC (Playtest row).

### T9b to T9d handover (2026-11-24, built)

- Three new Charlottenburg materials in `makeMapMats` (`stone`, `tuff`, `schlossWall`; other maps alias the stucco, so nothing changes there). Swapped per sight function in `charlottenburg-citywest.ts`, `-kudamm.ts`, `-schloss.ts`; the wear recorder (`recordWalls`) counts them as walls. Marmorhaus stays on stucco (white marble).
- Start images for regular stone are drawn in code (seamless SVG ashlar, joints and courses at the target size), then img2img at 0.68: at 0.55 the stone stayed flat and new. Matching to the stucco keeps the code tints right; `--keep 1` or 0.85 keeps the soot (`texture-tile.mjs`).
- Cost on Charlottenburg: +1 draw call per material in the chunks that show those sights (at most +3 where the Schloss, its plinths and a stone sight meet), three 1024 px textures (about 4.2 MB with mipmaps). Other maps: 0.
- [Before and after](proof/t9-charlottenburg-stone/before-after.jpg). The Schloss change is subtle; the trims have no own sheet yet.
- T9j: `hedge.webp` replaces `mossy` on Charlottenburg only (there it is only greenery: hedges, lawn strips, firs), so 0 draw calls; one 1024 px texture instead of the 512 px painted one. [Before and after](proof/t9j-hedge/before-after.jpg). Prompts for a vertical leaf surface drift to forest floor with fallen leaves; the pick with the fewest loose leaves reads as hedge.
- T11 (1): `assets/textures/turm/city.webp` replaces the `paintCity` canvas in `buildCityView` (`turm-city.ts`), same plane and material. At denoise 0.72 FLUX draws a close isometric village (houses 5× too big, layout lost); at 0.55 with "strictly top-down, thousands of tiny roofs, no perspective" it keeps the district patches and the Spree. [Before and after](proof/t11-city/before-after.jpg).
- T11 (2): `assets/textures/turm/enamel.webp` replaces the enamel core canvas (`makeTurmMats`, same material, repeat 8 × 1). At 0.62 the round chips of the canvas stayed; at 0.8 with "crazed, sharp-edged chips, rivets along the seams" it reads as old enamel. [Before and after](proof/t11-enamel/before-after.jpg).
- T11 (3): four deck floors (`assets/textures/turm/floor-*.webp`, 768 px like the canvas) swap in `makeTurmMats`; the Schacht grating barely changed, so it keeps the canvas. At 0.55 the layouts (star, rings, dial) stay exact; the clear gain is the Uhrenraum dial (Roman numerals, tarnished brass). [Before and after](proof/t11-floors/before-after.jpg).
- T12: two ending paintings (`assets/ui/ending-*.webp`) replace the SVG art in `src/ui/turm-ending.ts`. Text to image with the intro art as `--ref` gave usable cards in the first round (6 each); "skyline as a band across the middle" keeps a 3:2 crop safe. [Before and after](proof/t12-ending/before-after.jpg).
- T9a, 4 m tile: instead of three per-bay variants (+2 materials on every Charlottenburg chunk), the stucco is regenerated from a 2 × 2 tiling of itself at denoise 0.6 and drawn with texture repeat 0.5 (`makeMats`), so the repairs repeat every 4 m instead of 2 m at the same file size and draw calls. At 0.72 FLUX paints the patches at the old size again (twice too big at 4 m); several 0.6 picks still echo the 2 × 2 grid, pick one that does not. [Before and after](proof/t9a-stucco-4m/before-after.jpg).
- T14 first step: `assets/textures/wedding/cloth.webp` on the shared `linen` material, swapped in `buildMapWorld` for `m.id === 'wedding'` only (the Wedding map has no `district`, so `makeMats` stays untouched). Neutral off-white so the code tints (ruby, gold, white) keep working; pick a candidate with moderate stains, the ruby awnings show them too. [Before and after](proof/t14-cloth/before-after.jpg).
- T11 dial: `assets/textures/turm/dial.webp` (512 px) on the shared dial material (`makeTurmMats`): same hand angles, shaped hands, aged enamel; "no numbers, no text" keeps FLUX from writing digits. [Before and after](proof/t11-dial/before-after.jpg).
- T6 track bed: `assets/textures/xhain/track-bed.webp` on `X.trackBed`. Layout textures (one track per tile, rails at fixed u) need the init's layout: at 0.55 almost nothing changed, at 0.68 half the picks moved or doubled the rails; pick one whose rail stripes sit where the canvas had them. [Before and after](proof/t6-track/before-after.jpg).
- T8 fur: `assets/textures/enemies/fur.webp` (512 px, neutral grey so the kit colours keep the hue) on `fur` and `furDark` in `gearKit`, repeat 3 × 3 on the primitives' UVs. Boss gear is normally baked into one vertex-coloured `paint` mesh per bone, which drops any map: `TEXTURED` in `assemble` keeps these two out (+3 draw calls on the Rattenmutter, one boss at a time). Text to image works for fur (no layout to keep). `tools/enemy-sheet` renders once, so `&wait=2000` builds a view first and waits for painted maps. [Before and after](proof/t8-fur/before-after.jpg).
- T8 wool: `assets/textures/enemies/wool.webp` on the five coat materials (Feldwebel, Hauptmann, Schaffner, Zeitwart, Brandmeister), also in `TEXTURED`: +4 to 5 draw calls on those bosses (Feldwebel 17 → 21). Mean brightness about 0.84, or the multiplied coat colours turn dull. [Before and after](proof/t8-wool/before-after.jpg).
- T10 carpet: `assets/textures/wedding/rug.webp` (a whole carpet, not a tile) on the Teppichschlinger's cloth; `paintRug` in `enemies.ts` loads it once for all rugs and turns the vertex colours off. Per-object loads would make one GPU copy per enemy. FLUX paints carpets well from a squashed layout image (0.72, first round). [Before and after](proof/t10-rug/before-after.jpg).
- T11 Telecafé cloth: the T14 Wedding cloth map (`wedding/cloth.webp`) on the tower's `cloth` material; the vertex tints (white cloths, cobalt and mustard booths) stay. Subtle. [Before and after](proof/t11-telecafe/before-after.jpg).
- Tried and dropped (2026-11-24): a tar-paper flat-roof map (FLUX drew paving slabs, and from a code-drawn strip init it came out flat and dark, too close to the asphalt to be worth 1.4 MB); filo pastry on the kit's `filo` (the Baklava-Brocken is a regular enemy baked into the `paint` mesh, so a map there costs +5 draw calls per Baklava).
- T6 murals: `assets/textures/xhain/murals.webp` (1024 × 512, same cells as `muralPanel`) on `X.murals`, not repeated. One img2img job per panel (its cell upscaled as `--init`, 0.75, the panel's theme in the prompt, "original naive mural" and "no text"), 4 candidates each, then assembled. Never prompt for a real artwork. [Before and after](proof/t6-murals/before-after.jpg).
- T6 long murals (Johannes 2026-11-24: across wall parts, the real ESG paintings are not allowed: copyrighted): `murals.webp` is now 2048 × 1024 with eight 1024 × 256 cells; `buildWall` lays each mural over 10 to 11 elements in order. The face whose quad starts at the far end needs its u reflected per element, or every slice is mirrored and the painting breaks into small repeats. `tools/comfy.mjs` takes `--width` and `--height` (1536 × 384 here). GPU memory on Xhain about +8 MB. [Before and after](proof/t6-murals-long/before-after.jpg).
- ESG mural tone (Johannes 2026-11-24): not happy and colourful; dark, gritty, post-apocalyptic, politically critical. Prompt words that worked: "gritty post-apocalyptic political street mural, stencil art and expressive brush strokes, dark muted palette of grey, black, rust, dirty dark red and sickly green, heavy weathering, soot". Skip candidates with scribbled signatures, painted years or caricatured faces. [Dark set](proof/t6-murals-dark/atlas.jpg).
- Rubble heap via W4 to W6 (2026-11-24), dropped: FLUX side view without a ground plate ("no base, no ground plate, no disc"), one view as all four, Pixal3D 700k triangles. A heap of loose pieces stalls the decimate (24k instead of 1,200): `bake_low.py --remesh 0.06` fuses it first. At 2,500 triangles it reads as a grey crumpled blob next to the code heaps of separate bricks (5× their triangles), so the code heaps stay. Image-to-3D suits solid single objects (urn), not piles of small parts. [Code vs Pixal3D](proof/rubble-glb-dropped/code-vs-pixal3d.jpg).
- T9g posters (2026-11-24): FLUX.2 klein 4B repaints lettering wrong even at denoise 0.35 (TÄGLICH → TÄBLICH) and at 0.5 the text is nonsense. Built 2026-11-25 the other way round: FLUX paints only the picture, the code letters it (round 4 below).
- T8 decayed skin (2026-11-24): img2img on a body's UV atlas moves the islands even at denoise 0.45 (new faces, hands gone), so the UVs break. Instead paint a seamless surface tile (`decay.webp`, 0.9 from a skin crop) and multiply it over the atlas at build time relative to its mean, masked to bright skin (`decay()` in `tools/build-human.mjs`). [Before and after](proof/t8-skin/before-after.jpg).
- T9 hats (2026-11-24): gear parts stretch one atlas cell over the whole part (no repeat), so crop the middle 512 px of a 1024 pick before shrinking it to the 256 px cell, or the pattern vanishes. Painted cells load async: render tools must `await grainReady()` (`src/render/paint.ts`) or icons show the fallback weave. Re-rendering icons changes most files by swiftshader noise (mean < 0.4): keep only the ones that really changed. [Before and after](proof/t9-hats/before-after.jpg).
- Kodex: after kit maps change (T8 fur and wool, T10 carpet), re-render the portraits with `node tools/kodex-portraits.mjs <kinds>`; the portrait sheet now builds one body and waits (`wait`, default 1500 ms) so the painted maps are in. Done 2026-11-24 for X01, X04, X05, X06, X10, X21, X28, E24 ([before and after](proof/kodex-painted-maps/before-after.jpg)).

### Round 3: global assets (2026-11-24)

- T8 decayed boss skin, T9 hat cloth: see the two lessons above.
- P3 Trabi: FLUX picture three-quarter from slightly above (8 picks, [sheet](proof/p3-trabi/flux-picks.jpg); FLUX draws a generic 70s Eastern car rather than an exact 601), Pixal3D 13 min. A view from above leaves the model tilted: `pose_prop.py --level` turns it to the smallest bounding box (box-like props). `bake_low.py` without remesh collapsed the cabin; `--remesh 0.025` keeps the shell but the thin wheels fall apart, so the GLB is cut below the sills (`--cut=-100,0.33`, the `=` form, since the value starts with a minus) and the builder adds code wheels in the rubber batch. The bake came out over-bright (tint gain 1.9): the finish darkens and desaturates it so the instance colour of each copy (`GlbPlacement.tint`) sets the paint. `buildTrabi` in `props-urban.ts`; which cars are Trabis is a hash of the position (`isTrabi`), so the Wedding ribbons and Mitte roof sensors sit on its roof (`TRABI_ROOF`); the shell sits 0.15 m up so the wheels tuck into the arches (Johannes); `tools/landmark-sheet.mjs "props=car*8&only=6,7&size=4"` renders props. [Shell](proof/p3-trabi/shell.png), [next to a code car](proof/p3-trabi/sheet.png). Cost: one instanced mesh per map (+1 draw call, +1 in the shadow pass), drawn whole (no per-chunk culling), 1,869 triangles per copy.
- P44: the city bus is 12 × 2.55 m (was 11 × 2.5), collider 6 m half-length.

### P17 Spreepark statues (2026-11-24, built)

- Single-image route now works: Johannes approved the download of `pixal3d_int8_convrot`, `trellis_2_int8_convrot` (diffusion_models) and `moge_2_vitl_normal_fp16` (geometry_estimation), 10.7 GB. `run_pixal3d.py --image <picture on black>` drives the `3d_pixal3d_trellis2_image_to_model` template (about 5 min per model; the converter needed the `COLOR` widget type).
- FLUX.2 klein draws dinosaurs as two-legged hybrids unless told the anatomy: "huge heavy round body on four thick pillar legs like an elephant" (sauropod), "a heavy four-legged dinosaur like a rhinoceros" (triceratops).
- `prepare_toy_model.py --length <m> --turn -90` (FLUX side views face +x), `tools/blender/pose_prop.py --roll 90 --sink 0.3` lays a figure on its side, `bake_low.py --tris 5000 --tex 1024`. A standing sauropod cannot lie on its back (the raised neck would go into the ground), so it stands; the triceratops and the T-Rex lie on their sides.
- Game: `DINO_GLB` in `landmarks.ts` places them as GLB props (code figures stay as the fallback); `DINO_PARTS` in `src/data/map.ts` refitted from each model's footprint below 2.5 m (a Blender grid print), test probes updated. Cost on Köpenick: +1 draw call per statue kind where it is in view (3 in all), 15,000 triangles, three 1024 px textures (about 12 MB with mipmaps). [Sheet](proof/p17-dinos/sheet-before-after.jpg), [in game](proof/p17-dinos/game-before-after.jpg).
- Open: the triceratops lies under tree crowns at the game camera; small dinos (Kompso), nests and enemy detail (task steps 2 to 4) are still code work.
- T14 atlas: `cloth(b, kind, m, sx, sy, sz, shade)` in `wedding-world.ts` (and `clothBlk` in `wedding-sights.ts`) builds a box whose every face shows its kind's whole quarter once, on the new `WeddingMats.cloth` material (+1 draw call in Wedding chunks with cloth, one 1024 px texture). A quarter stretched over a long piece smears; the 20 m runner (Johannes: one long carpet, not squares) has its own strip: painted at 3:20 (`--width 288 --height 1920`), squeezed into 256 × 512 next to the brocade, so stretching it over 3 × 20 m restores its proportions ([runner](proof/t14-atlas/runner.jpg)). Velvet and carpet came out too dark at night until brightened 1.6×. [Before and after](proof/t14-atlas/before-after.jpg), [atlas](proof/t14-atlas/atlas.jpg).
- P17 fixes (Johannes 2026-11-24): the first brachiosaurus had a tail growing out of its chest. The FLUX side views drew a second tail-like part at the chest and Pixal3D built it; cutting it off (`pose_prop.py --cut z,y`) leaves a hole, so a new picture was made with "a smooth rounded chest with nothing sticking out of it, the neck rising straight up from the shoulders, one long tail only at the back". Check the FLUX picture for extra limbs before running Pixal3D. The triceratops lay under tree crowns: its landmark footprint (4.5 × 5, clear 3) now keeps trees away; bigger footprints for the other two cost tree pits on the Spreeufer (test). [Brachiosaurus](proof/p17-dinos/brachiosaurus-fixed.jpg), [triceratops](proof/p17-dinos/triceratops-trees.jpg).

### Round 4: lettered art (2026-11-25)

FLUX cannot letter, so every sign and poster is split: FLUX paints the picture or the board, the code keeps the lettering and draws it on top. Start images are the code art with `fillText` switched off (a Playwright page that imports the painter from the dev server and returns the canvas). The painted file holds only the text-free parts at the atlas' own coordinates and loads as an `Image`; the atlas paints with code first, then repaints once the image is in and sets `needsUpdate` (one re-upload). The image is only a `drawImage` source: no GPU texture, no material, 0 draw calls.

- T9g posters: `charlottenburg/posters.webp` (1024 × 256, same cells). Each poster's picture band lies between its lettering (`POSTER_ART_Y`); FLUX img2img from that band at 0.8, 640 px wide, "1920s Berlin lithograph poster artwork, art deco", 6 per poster. FLUX never keeps the poster colour behind the figure, so `compose.mjs` keys the pick's flat ground out (pixels near its border colour become the poster colour, smooth step 22 to 70) and fades the band's edges over 22 px; a per-channel gain toward the poster colour instead turns the figure the poster's colour. Dark posters need "isolated on a plain pure black background" or the ground comes out grey. `onPosterArt` in `charlottenburg-world.ts`, used by both atlases. [Before and after](proof/t9g-posters/before-after.jpg).
- T13 Wedding signs: `wedding/signs.webp` (1024 × 1536, the 22 cells of `CELLS`). One img2img job per cell at 0.72 (4 each): enamel plates, painted boards, a cloth banner, a bronze plaque, the AEG glass mosaic, brick behind the gold capitals, the sticker door; then each board is moved to the code board's mean colour so the lettering keeps its contrast. The night watchman is unsqueezed to a square (the cell is drawn 4 × wide), painted at 0.8 and squeezed back; his lantern moved, so that cell's glow is derived from its brightest pixels. `paintSignColour` in `wedding-world.ts`. [Before and after](proof/t13-signs/before-after.jpg). The boards come out clean and flat with a rim; colour still drifts (ruby toward brick red).
- T9f/T9h Charlottenburg atlases: `charlottenburg/kudamm.webp` (velvet curtain, marble, conservatory panes light and dark, the glass vault) and `citywest.webp` (the four Aquarium terracotta reliefs, the premiere portrait), same coordinates as the atlases. The glow map takes each painted region darkened to the code glow's measured share (curtain 0.09, panes 0.41 and 0.22, vault 0.27, portrait 0.51, marble and reliefs 0). [Ku'damm](proof/t9f-charlottenburg/kudamm-before-after.jpg), [City West](proof/t9f-charlottenburg/citywest-before-after.jpg). The cut-glass fan stays code: FLUX drew flowers, smoke or loose shards, never a fan.
- Tried and dropped: T11 steel ribs (`turm/ribs.webp` on the tower's rib material, 0 draw calls): at metalness 0.6 in the dark deck the ribs reflect the room and the paint does not show at all. A cut-glass map on the kit's `glass`, `smoke` and `frost` (0 draw calls, they glow and stay out of the paint bake): no visible change on the Diva at game scale, and it would load on every map. Picks and before/after in `assets-src/ai/t11-ribs`, `assets-src/ai/t9h-glass`.
- GPU queue: ComfyUI is shared with other projects' sessions; a Pixal3D job there holds the GPU 5 to 15 min and FLUX jobs wait behind it (`/queue` shows it).

### Round 5: atlas cells for baked materials (2026-11-25)

- KA A2 enemy kit atlas: `enemies/kit.webp` cells 1 to 3 (filo side, filo top, brass), `docs/tasks/kit-texture-atlas.md`. Text to image, 8 per cell; the picks show the whole object (a pastry stack, a tray), so crop the middle, then `texture-tile.mjs --size 256`. `compose.mjs` pulls each cell to grey around one tone (saturation 0.2, contrast 0.7, highlights above tone + 30 compressed: FLUX's glossy glaze otherwise blows out once the dark pick is brightened). The vertex colour carries the hue. Cell means go into `KIT_TONE`; a unit test measures the file again.
- Density: a box face gets the whole cell, so the filo side crop holds about 4 layers (a 680 px crop gave 8 and read as wood grain on 0.2 m arm boxes). Filo shows at the game camera; brass only on larger parts (samovar), buttons and crowns unchanged.
- Check with the tool's ready promise: the first sheets showed no change because `tools/enemy-sheet` rendered before the image was in (fixed: it now awaits `kitReady()` in every mode). Look at a large close-up first to see the map is on at all.
- KA B2 coat detail: `hero/detail.webp`, three grey 256 px tiles (denim, mail, patch) packed into RGB by the loader. Counts that matter (8 rings, 5 patches across) come from a code-drawn seamless start image (`assets-src/ai/ka-b2/init*.mjs`): mail at 0.55 kept the ring grid; patchwork from flat grey squares stayed flat at 0.5 to 0.58 and lost the grid at 0.65, so the start squares are crops of the repo's own cloth textures (coat, poncho, wool, tweed, knit, denim) and FLUX unifies them at 0.45. Denim with a centred seam must skip the `texture-tile` blend (`--band 0`), or the shifted copy adds a second seam. Each cell moved to mean 180: the dark mail (mean 93) would need a 7× gain and glare.
