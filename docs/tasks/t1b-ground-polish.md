# T1b Ground textures: repetition, memory, loading [Sonnet 5.5 code, Codex image]

Status: image pass built. Texture performance and rail follow-up remain open. Findings are from the review of PR #14 (2026-11-16).

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
