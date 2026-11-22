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
- **Describe the surface, not the object.** "Railing" or "roof" in a texture prompt draws railings and roofs; say "a plain flat sheet, no objects, no bars". If an icon loses a key detail (the emerald), rerun from the best pick at 0.75 and name the detail first.
- **Prompt words that work:** "semi-realistic hand-painted game texture", "even density over the whole square, no edges, no border", "flat albedo, no light direction, no shadows". "Painterly" alone gives cartoon outlines and drawn shadows.
- **Generate many, pick few.** About 4 s per 1024 px image (16 s for the first): make 8 or more per job with consecutive seeds and judge them on one contact sheet. One prompt per image: `--batch` is only ~10 % faster and its images barely differ.
- **Keep the GPU on one model.** The text encoder (7.7 GB) and FLUX (7.4 GB) do not both fit in 12 GB; adding the BiRefNet cut-out (`--cutout 1`) to every run made it swap and slowed images from 8 s to 37 s. Generate without cut-out, then cut out only the picks.
- **Nothing heavy beside it.** A 300 MB download and unzip during a run made ComfyUI restage the models from disk: one image took 280 s instead of 4. Generate when the disk and GPU are idle.
- **Hero cloth:** img2img from the piece's neutral swatch (`assets/textures/hero/`), `--match` it, and skip glossy candidates: baked highlights fight the game light.
- **Colour always drifts** (greenish on plaster): match it to the old texture with `texture-tile.mjs --match`, or the code tints stop fitting.
- **Several views of one object do not match** each other; do not feed FLUX multi-angle sheets to image-to-3D. A round object (urn, column, barrel) works: one FLUX side view serves as all four Pixal3D views.
- **Pixal3D to a small prop:** ~9 min per model. Then `prepare_toy_model.py --tris 60000` and `tools/blender/bake_low.py --tris 2000 --tex 512 --tint <picture>`: decimating the textured mesh itself breaks the texture below ~6,000 triangles, and an imported glTF must have its vertices merged before any decimate. In game: `src/render/glb-props.ts` (one instanced mesh per kind, +1 draw call).
- **A texture on a shared material changes every district.** Swap it per district (`makeMats` district in `src/render/world.ts`); a new material means more draw calls and needs a reason.
