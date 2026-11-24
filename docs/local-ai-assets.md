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
