# T1b Ground textures: repetition, memory, loading [Claude · Opus high, local FLUX image]

Status: built 2026-11-26 (scope 1 to 4, with backlog P47). Open for Johannes: rails old or new, 512 or 1024 ground on Qualität, Steam Deck load check (Doc updates for the lead below). Findings are from the review of PR #14 (2026-11-16).

## Findings
| # | Finding | Where |
|---|---|---|
| 1 | Paving repeats visibly: one missing plate and the corner cracks form a grid every 5 m | `docs/proof/t1-ground/repeat-paving.jpg`, `assets/textures/koepenick/paving.webp` |
| 2 | Five 1024² textures with mipmaps are about 27 MiB of GPU memory; at the game camera (about 80 px per meter on Leistung against 205 texels per meter) the top mip is hardly sampled | `tools/build-ground-textures.mjs`, `src/render/ground-textures.ts` |
| 3 | Images decode on the main thread after the run started: possible hitch in the first seconds | `src/render/ground-textures.ts:14` |
| 4 | Litter atlas: transparent pixels are near black, so mipmaps with `alphaTest` can show dark fringes | `assets/textures/koepenick/litter.webp` |
| 5 | Leaf floor is busy with a regular pattern across the screen | `docs/proof/t1-ground/after-forest-leistung.jpg` |
| 6 | Rail heads blow out to a white streak near lamps (`metalness 0.6, roughness 0.34` plus bloom) | `src/render/map-world.ts:123`, `docs/proof/tram-rails/comparison-leistung.jpg` |

## Scope
1. (Codex) Regenerate paving without a unique missing plate; keep the dark joints the shader needs. Soften the leaf floor contrast. 2 × 2 repeat test images as in T1.
2. (Sonnet) Build tool: export the four tiling images at 512 px, keep 1024 px as an option; bleed edge color into transparent litter pixels before export.
3. (Sonnet) Load with `ImageBitmapLoader` (`imageOrientation: 'flipY'`, `texture.flipY = false`) so decoding leaves the main thread; keep the fallback on failure.
4. Rail roughness to about 0.5: a look change, show before and after to Johannes first.

## Done when
- Before and after screenshots of Altstadt, Kietz and forest on both profiles in `docs/proof/t1b/`; Johannes picks 512 or 1024 for Qualität from a side-by-side on the PC.
- `npm run check`, `npm run e2e`; `assets/LICENSES.md` rows updated.

## Not in scope
KTX2 compression, new ground kinds, other districts.

## Image handover

- Reused the palette and wear from the 2D shared pavement and Köpenick sidewalk art as image references. The runtime 2D tiles were 256–258 px and had fewer slabs than the 3D tile.
- Regenerated paving from the T1 grid and 2D references. The 5 m tile has 100 intact plates and dark joints, with weathering spread evenly across the slab faces.
- Edited the T1 leaf floor to lower contrast while keeping the same average luminance. Both albedos are opaque sRGB WebP at 1024 px.
- [Repeat tests and in-game comparisons](../proof/t1b/README.md).
- The 512 px export, atlas edge bleed, loading and rail comparison remain open under steps 2–4.

## Handover (2026-11-26, Claude · Opus high, local FLUX.2 klein)

- Images (scope 1): paving by FLUX img2img on an even 102.4 px grid (the old tile had one 80 px row per 5 m), all 100 plates, dark joints, low-frequency tone flattened so no plate or stain repeats as a pattern; leaf floor as random leaves, luminance SD 7.5 (was 7.8). [2 × 2 and in-game sheets](../proof/t1b/README.md).
- Build (scope 2): `tools/build-ground-textures.mjs` writes `grass|dirt|paving|leaves-512.webp` (wrap-aware 2:1) beside the 1024 files and fills the litter atlas's transparent pixels with the local visible colour (pull-push, WebP `exact`). Leistung loads the 512 files; `?ground=512|1024` forces one size on any profile for Johannes' side by side.
- Loading (scope 3): `loadPaintedTexture` decodes through `ImageBitmapLoader` (`imageOrientation: 'flipY'`, `flipY = false`) for every painted map, resizes a capped bitmap with `createImageBitmap` and closes it after the upload; `TextureLoader` stays the fallback (Safari < 17, Firefox < 98, any failure).
- Rails (scope 4): `railSteel` roughness 0.5, `?rails=old` shows 0.34; Charlottenburg keeps 0.34 (its mirrors and chandelier share the material). [Qualität](../proof/t1b/rails-qualitaet.jpg), [Leistung](../proof/t1b/rails-leistung.jpg).
- P47: `Profile.tileEdge` (512 on Leistung) passed per call by every tiling surface in every district, twice that for 2 × 2 tiling atlases; lettered atlases, pictures, wear decals, the Fernsehturm city and the hero clothing stay full size. Image memory on Leistung −32 to −38 % per district (tunnel −51 %, Fernsehturm −11 %): [numbers and screenshots](../proof/p47/README.md).
- 3D-only work, nothing reused from 2D. Not measured: hitch and fps on real hardware (rows below); `npm run e2e` not run.

## Doc updates for the lead

- `docs/backlog.md` P47 row → done: "Built 2026-11-26 with T1b (`Profile.tileEdge`, opt-in per call): image textures on Leistung Köpenick 138.0 → 86.0, Xhain 98.0 → 62.0, Alexanderplatz 155.0 → 103.0, Mitte 136.7 → 88.7, Charlottenburg 148.7 → 96.7, Wedding 126.5 → 86.5, Fernsehturm 36.7 → 32.7, tunnel 94.3 → 46.3 MiB (`docs/proof/p47/`). Next lever: code-painted canvases (8 to 48 MiB per district on Leistung)."
- `docs/asset-pipeline.md` › Texture memory: Leistung column → `86.0 + 44.6`, `62.0 + 44.6`, `103.0 + 44.6`, `88.7 + 44.6`, `96.7 + 56.6`, `86.5 + 44.6`, `32.7 + 50.7`, `46.3 + 44.6` (Qualität unchanged); last sentence → "Leistung caps tiling surfaces at 512 px (`Profile.tileEdge`, opt-in per `loadPaintedTexture` call, P47, 2026-11-26); what remains is mostly code-painted canvases, GLB character bitmaps, the hero clothing and lettered atlases. The real devices' numbers stay hardware checks 33 and 38."
- `docs/asset-pipeline.md` › Texture queue, first line → "T1 is done (PR #14). T1b is built (local FLUX paving and leaf floor, 512 px ground exports, litter edge fill, ImageBitmap loading, rail roughness): [T1b](tasks/t1b-ground-polish.md)."
- `docs/local-ai-assets.md` › Lessons, new row: "| 2026-11-26 | img2img keeps the start image's grid exactly, uneven rows included: resample a regular pattern to an even grid first. A joint lying on the tile border gets dropped (two rounds, 13 variants: one joint missing per tile); shift the start image by half a plate so the border runs through plate faces, then `texture-tile.mjs --band 0.08`. Strong per-plate tones repeat as a pattern in the 2 × 2 test: remove most of the low-frequency tone (wrap-aware blur about the plate size). On the shared ComfyUI queue one prompt at a time | T1b |"
- `docs/status.md` Map row: "T1b keeps all sidewalk plates intact to reduce visible repetition and softens the forest floor." → "T1b (local FLUX) puts the sidewalk plates on an even grid without repeating stains and gives the forest floor random leaves at low contrast; painted images decode off the main thread, and Leistung loads every tiling surface at 512 px (P47)."
- `docs/migration.md` line 15, status → "built 2026-11-26 (`docs/tasks/t1b-ground-polish.md`); Johannes: rails old or new, 512 or 1024 ground on Qualität; hardware rows in `docs/tasks/pt-hardware-checks.md`".
- `CLAUDE.md` URL options, append: "`?rails=old|new` (T1b rail roughness A/B), `?ground=512|1024` (T1b ground image size on any profile)".
- `docs/tasks/pt-hardware-checks.md`, two rows (next free numbers):
  - "| n | T1b/P47 on the Steam Deck: first-load hitch (painted images decode off the main thread, Leistung loads 512 px tiles) and memory (browser task manager: GPU and tab memory at the start of Köpenick, Alexanderplatz, Charlottenburg on Leistung); anything blurry at the game camera (ground, facades, roofs, U-Bahn walls)? | `?profile=Leistung&debug=perf`, first load with a cleared cache, then the three districts | Steam Deck | `docs/tasks/t1b-ground-polish.md`, `docs/proof/p47/README.md` | |"
  - "| n+1 | T1b look picks: rail heads `?rails=old` against the new default near lamps (streak gone, still steel?); ground at 512 or 1024 on Qualität (`?ground=512` against `?ground=1024`: paving at the Altstadt market, forest floor at Friedrichshagen) | Köpenick start square and the street south of it; `docs/proof/t1b/rails-*.jpg`, `ground-*.jpg` | PC | `docs/tasks/t1b-ground-polish.md` | |"
