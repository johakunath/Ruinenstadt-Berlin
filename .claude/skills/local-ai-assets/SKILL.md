---
name: local-ai-assets
description: Use when making a texture, icon, decal, reference image or static 3D prop for Ruinenstadt Berlin with the local models on Johannes' PC (FLUX.2 klein 4B and Pixal3D in ComfyUI, Blender clean-up). Gives the commands and the learnings that decide how to prompt, pick and finish.
---

# Local AI assets

Routes per asset group, licences and the full workflows: `docs/local-ai-assets.md`. This file keeps only what shapes the work. Add a learning here only if it changes how the next job is done; keep the file short.

## Run

| Step | Command |
|---|---|
| Start ComfyUI (Terminal tab, close it afterwards to free the GPU) | `& 'C:\Users\Johannes\AI projects Local\ComfyUI\.venv\Scripts\python.exe' 'C:\Users\Johannes\AI projects Local\ComfyUI\main.py' --listen 127.0.0.1 --port 8188` |
| Generate | `node tools/comfy.mjs --prompt "…" [--init old.webp --denoise 0.7] [--ref style.png] --count 8 --seed 1 --out assets-src/ai/<job> --name <job>` |
| Pick | `node tools/contact-sheet.mjs sheet.jpg 150 <files>`, look once, pick 1 to 3; judge scale and seams at full size |
| Finish an icon | `node tools/comfy.mjs --cut <pick.png>` (cut-out of the pick only), then `node tools/icon-finish.mjs <pick-cut.png> assets/inventory/I95.webp` |
| Finish a tiling texture | `node tools/texture-tile.mjs <png> assets/textures/<district>/<name>.webp --match <old texture>` (`--band 0` for tiles and other rows, `--gain` for a darker surface), then `--check` for the 2 × 2 repeat |
| Look in game | `node tools/landmark-sheet.mjs out.png "kind=<sight>&views=quarter,game"` (`&old` for before), or `tools/screenshot.mjs` with a wait of 15000 |

## Learnings

- **Start from the old image.** img2img from the texture or icon being replaced (`--init`) keeps scale, palette and layout; pure text-to-image drifts to photos or cartoons. Denoise: 0.7 for irregular surfaces (plaster, rust), at most 0.55 for regular rows (roof tiles, slate, brick: at 0.65 the rows break up), 0.9 plus `--ref` for icons.
- **Brick and tile size come from the start image** (img2img keeps its row count). For smaller bricks, tile the start image 2 × 2 before generating, never the finished pick (its dark bricks then form a grid). Do not start from a placeholder with gradients (soot runs): they carry into every variant.
- **Describe the surface, not the object.** "Railing" or "roof" in a texture prompt draws railings and roofs; say "a plain flat sheet, no objects, no bars". If an icon loses a key detail (the emerald), rerun from the best pick at 0.75 and name the detail first.
- **Prompt words that work:** "semi-realistic hand-painted game texture", "even density over the whole square, no edges, no border", "flat albedo, no light direction, no shadows". "Painterly" alone gives cartoon outlines and drawn shadows.
- **Generate many, pick few.** About 4 s per 1024 px image (16 s for the first): make 8 or more per job with consecutive seeds and judge them on one contact sheet. One prompt per image: `--batch` is only ~10 % faster and its images barely differ.
- **Keep the GPU on one model.** The text encoder (7.7 GB) and FLUX (7.4 GB) do not both fit in 12 GB; adding the BiRefNet cut-out (`--cutout 1`) to every run made it swap and slowed images from 8 s to 37 s. Generate without cut-out, then cut out only the picks.
- **Nothing heavy beside it.** A 300 MB download and unzip during a run made ComfyUI restage the models from disk: one image took 280 s instead of 4. Generate when the disk and GPU are idle.
- **Never img2img a UV atlas** (body skin): FLUX moves the islands even at 0.45. Paint a seamless tile and multiply it over the atlas in code (`decay()` in `tools/build-human.mjs`).
- **Hero cloth:** img2img from the piece's neutral swatch (`assets/textures/hero/`), `--match` it, and skip glossy candidates: baked highlights fight the game light.
- **Colour always drifts** (greenish on plaster): match it to the old texture with `texture-tile.mjs --match`, or the code tints stop fitting.
- **Several views of one object do not match** each other; do not feed FLUX multi-angle sheets to image-to-3D. A round object (urn, column, barrel) works: one FLUX side view serves as all four Pixal3D views.
- **Pixal3D to a small prop:** ~9 min per model. Then `prepare_toy_model.py --tris 60000` and `tools/blender/bake_low.py --tris 2000 --tex 512 --tint <picture>`: decimating the textured mesh itself breaks the texture below ~6,000 triangles, and an imported glTF must have its vertices merged before any decimate. In game: `src/render/glb-props.ts` (one instanced mesh per kind, +1 draw call).
- **Small organic props (animals, P18) need `--remesh`.** Without it `bake_low.py` stalls near 2,600 triangles; `--remesh 0.005` keeps thin legs and tails at 500. Ask FLUX for the pose the game shows (a rat "walking low, tail straight out behind"; a sitting one became a fur ball). Several small models share one atlas: bake each at 256 px and pack them (`tools/build-critters.mjs`).
- **Clothing from a Quaternius outfit part** (same skeleton as the hero): import, weld, decimate, push out of the skin and past the trousers, `rebind_weights` from the body, and turn its texture's brightness into vertex colour so palettes work (`ranger_boots` in `tools/blender/hero_clothes.py`).
- **FLUX cannot letter: split signs and posters.** FLUX paints the picture or the board (start image: the code art with `fillText` switched off), the code draws the lettering on top; load the painted file as an `Image` and repaint the canvas atlas from it (0 draw calls). Key a pick's flat ground out to the target colour instead of tinting the whole pick (`assets-src/ai/t9g-pics/compose.mjs`). Round 4 in `docs/local-ai-assets.md`.
- **Check it in game before keeping it.** Metal at metalness 0.6 in a dark room, or a map on small glowing shards, shows no change at game scale: render before and after (rename the file away for "before") and drop it if nobody can tell.
- **Exact counts need a code-drawn start.** Rings or patches per tile: draw a seamless grid in code and img2img at 0.45 to 0.55. A flat, clean start stays flat; fill its cells with crops of real textures first (`assets-src/ai/ka-b2/init-patch2.mjs`).
- **A texture on a shared material changes every district.** Swap it per district (`makeMats` district in `src/render/world.ts`); a new material means more draw calls and needs a reason.
