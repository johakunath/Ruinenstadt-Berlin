# KA Kit texture atlas and hero coat detail [spec: Claude · Fable high; build: Claude · Opus high]

Status: designed 2026-11-25 (Fable 5.2, design only, nothing built). Two rendering designs that unblock the last local texture items. Part A and part B touch different files and can be built in parallel sessions; the art steps need the PC (ComfyUI).

## Goal

Painted surfaces on enemy kit parts and a second, tiling material on chosen roles of the hero coat, both at **0 extra draw calls** on every profile.

| Part | Unblocks |
|---|---|
| A Enemy kit atlas | T10 filo, brass, tea glass; T8 ear skin; kit `mirror` |
| B Hero coat detail | T9 denim (`leder` trousers), chainmail (`kette:zit`), patchwork (`spaeti`) |

## Source

3D only: nothing in the 2D repo to port (no clone needed). Pattern reused from this repo: the hero gear's grain atlas (finding 3).

## Findings (code read 2026-11-25)

| # | Finding | Where |
|---|---|---|
| 1 | `assemble(..., paint=true)` merges every non-glowing, non-`TEXTURED` kit material of a bone into `k.paint` or `k.metal` (metal only where it is ≥ 30 % of the bone's triangles). Parts are made non-indexed first and keep their primitive `uv` | `src/render/enemies.ts` `assemble` |
| 2 | Glowing materials (`tea`, `urn`, `glass`, ...; base emissive > 0.3) are never baked: they stay their own mesh, so a map on them costs 0 draw calls already | same, `family` |
| 3 | The hero gear solved the same problem: one neutral atlas on a vertex-coloured material, part UVs clamped into a padded cell, vertex colour = paint ÷ the cell's mean tone | `src/render/weapons.ts` `Parts.add`, `src/render/paint.ts` `paintGrain`, `GRAIN_TONE` |
| 4 | Collapsed UVs (all vertices of a part on one point) have zero derivatives, so they always sample mip 0 at that texel: a flat cell read this way cannot bleed | GL rule |
| 5 | `a_mantel` UVs are a fixed box projection: six charts in a 3 × 2 grid, each linear in the bind position, vertices split at chart borders. Measured on the committed `hero.glb` (4,024 vertices, also `a_poncho`, `a_weste`): residual below 1e-7 in every chart. The swatch is stretched unevenly (about 270 px/m along x, 340 along y, 920 along z) | `tools/blender/hero_clothes.py` `unwrap` |
| 6 | `coat.webp` is one neutral swatch (1024 px, mean sRGB tone 225) over all charts, so it cannot hold a second material; the hero's clothing materials and piece variants are shared by the world hero, the inventory doll and the icon renders | `src/render/characters.ts`, `hero-model.ts`, `hero-preview.ts`, `tools/look-sheet.ts` |
| 7 | A look variant is a geometry that shares the source's attributes and replaces some (`color`, `position`, index); cached per source and key | `src/render/hero-wear.ts` `pieceVariant` |
| 8 | Chainmail needs about 100 rings across the coat: no cell stretched once over the piece can hold that, it must tile | sizes |

## Part A: enemy kit atlas

### Decision A

**One shared atlas texture on `k.paint` and `k.metal`; `assemble` remaps each baked part's UVs into the cell of its kit material and divides the cell's mean tone out of the vertex colour.** No shader change. This is the hero gear pattern (finding 3) applied to the enemy bake.

Rules that make it safe:

1. **Cell 0 is plain white and read at one point.** Parts of kit materials without a cell get all UVs collapsed to the centre of cell 0, vertex colour = kit colour unchanged. By finding 4 they render exactly as today, at any distance. About 70 kit materials stay untouched.
2. **Mapped parts keep their primitive UVs** (clamped to 0..1, then scaled into the padded cell, as `Parts.add` does). Primitive UVs carry meaning (round and along a cylinder, lathe or sphere; per face on a box), which a box projection would destroy. Density varies with part size; accepted (the cells are coarse patterns, see T9 hats lesson in `docs/local-ai-assets.md`).
3. **Cells are tileable and near one neutral tone.** Closed primitives then show no seam, and mip bleeding between neighbours stays invisible. Padding 4 px inside each cell; the atlas is sRGB, not repeating, anisotropy 1 (as the hero gear).
3a. **Cells are coarse.** An enemy is about 100 px per metre at the game camera: structure smaller than 3 cm averages away (the cut-glass trial showed nothing for this reason). Paint a few large layers, blotches and bands per cell, not fine grain.
4. **Optional `top` cell per material:** triangles whose face normal points up (y > 0.7 in the space the part is built in, the model at rest) sample the `top` cell. The camera looks down, so tops are what the player sees (filo: strata on the sides, flaky crust on top).
5. **Before the image loads (or if it fails) every cell is its flat tone**, so colours equal today's from the first frame; the painted image is drawn into the canvas once and re-uploaded (round 4 pattern). Render tools await `kitReady()`.
6. **Glowing materials** (`tea`, `urn`) are not baked: they may take the same atlas as `map` and `emissiveMap`, with the UV remap only (their colour stays on the material; a trial, step A3).

### Alternatives weighed

| Alternative | Verdict |
|---|---|
| More `TEXTURED` materials | +1 draw call per material per bone: about +5 per Baklava-Brocken, a regular enemy. Rejected (already tried and dropped) |
| Texture array (`sampler2DArray`, one tiling layer per material, layer index per vertex) | True tiling and no bleeding, but a custom shader on the two shared kit materials; none of the open items needs tiling (largest part 0.56 m). Kept as the upgrade path if fur and wool should move into the bake later (−3 to −5 draw calls on one boss at a time: not worth it now) |
| Tiling inside a cell (`fract` in the shader, or splitting triangles on tile borders) | Shader patch plus mip seams and gutters, or heavy geometry work. Rejected |
| Box projection in metres with a window in the cell | Even density, but loses the round-and-along UVs of lathes and spheres (engraving bands, strata). Rejected; the `top` cell covers the one case that matters |
| Reuse the hero grain atlas | One spare cell only, and it couples hero and enemy art. Rejected |

### Data shapes (new file `src/render/kit-atlas.ts`; the pure part has no WebGL and is unit tested)

```ts
export const KIT_ATLAS = { cols: 4, rows: 2, cell: 256, pad: 4 } as const;        // 1024 × 512
/** Mean sRGB tone per cell (r, g, b), measured from kit.webp; cell 0 is plain white. */
export const KIT_TONE: ReadonlyArray<readonly [number, number, number]>;
export interface KitCell { cell: number; top?: number }
/** Kit materials with a painted cell; every other material uses cell 0. Typed as string keys so this file does not import enemies.ts. */
export const KIT_CELLS: Readonly<Record<string, KitCell>> = {
  filo: { cell: 1, top: 2 }, brass: { cell: 3 }, pink: { cell: 4 }, mirror: { cell: 5 }, tea: { cell: 6 }, urn: { cell: 6 },
};
/** Writes `color` (kit colour ÷ cell tone, linear) and remaps `uv` of one non-indexed part. `hex` is the kit colour. */
export function paintPart(flat: BufferGeometry, hex: number, cell?: KitCell): void;
/** The atlas texture (flat tones until the image is in) and its load promise. Browser only. */
export function kitAtlas(smallTextures: boolean): Texture;
export const kitReady: () => Promise<void>;
```

Cells: 0 plain, 1 filo side, 2 filo top, 3 brass, 4 ear skin, 5 mirror, 6 tea glass, 7 spare. File `assets/textures/enemies/kit.webp`, 1024 × 512, cell 0 left white. Per-channel tone (not one grey) so a cell may carry colour if one kit material owns it.

### Changes

| File | Change |
|---|---|
| `src/render/kit-atlas.ts` | New: the shapes above. `paintPart`: no cell → UVs to the centre of cell 0, colour unchanged; cell → clamp UV, scale into the padded cell (`top` by face normal), colour ÷ tone. Parts without `uv` get one (cell centre) |
| `src/render/enemies.ts` `assemble` | In the `paint`/`metal` branch call `paintPart(flat, k[m].color.getHex(), KIT_CELLS[m])` instead of the colour loop |
| `src/render/enemies.ts` `gearKit` | `k.paint.map = k.metal.map = kitAtlas(...)` (browser only, as the fur load). `gearKit` has no profile today: read `smallTextures` from `m.profile` |
| `tools/enemy-sheet.ts` | `await kitReady()` next to the existing wait (fur and wool keep the timed wait) |
| `src/render/kit-atlas.test.ts` | New, see Done when |

Check while building: every caller of `assemble(..., true)` (`gearFor`, `towerGear`, `buildRug` tails, `bauherrSet`) goes through the same branch; `assembleAlex` (`enemies-alex.ts`) has its own kit and is not touched.

### Cost per profile

| | Qualität | Ausgewogen | Leistung |
|---|---|---|---|
| Draw calls | +0 | +0 | +0 |
| Shader | `paint` and `metal` gain `USE_MAP` (replaces their program, no extra one); one more texture read on those meshes | same | same |
| GPU memory | 1024 × 512 RGBA with mipmaps: 2.8 MB | half size (`smallTextures`): 0.7 MB | 0.7 MB |
| Upload | Only when a paint mesh is first drawn (maps without such enemies never upload it) | same | same |

## Part B: hero coat detail

### Decision B

**A second sampler on the coat material, mixed in by a per-vertex weight; the tiling UVs are per-vertex too, computed from the bind position.** One small tiling texture holds up to three grey materials, one per colour channel (R denim, G chainmail, B patchwork); a palette names the detail per role. Where the weight is 1 the detail replaces the coat swatch, vertex colours (palette, bands, spots, baked occlusion) still multiply it.

Fragment (in place of `#include <map_fragment>`, written out so the coat sample stays):

```glsl
vec3 w = vDetailW;                         // 0 or 1 per channel, interpolated at role borders
float k = min(1.0, w.r + w.g + w.b);
vec3 det = texture2D(detailMap, vDetailUv).rgb;
sampledDiffuseColor.rgb = sampledDiffuseColor.rgb * (1.0 - k) + vec3(dot(det, w * detailGain));
```

`detailGain` (uniform vec3) = linear(coat swatch tone 225) ÷ linear(detail tone per channel), so a role keeps the brightness it has today.

Rules:

1. **Tiling UVs from the bind position in metres** (finding 5): the vertex's chart comes from its existing `uv` cell, the chart gives the two position axes, `detailUv = (pos_i, pos_j) ÷ tile` of that role's detail. Vertices are already split at chart borders, so no triangle smears. Use the source `position`, not the puffed one. Chart `(floor(u × 3), floor(v × 2))` in the GLB's own uv → axes (measured): (0,0) x, y; (0,1) z, y; (1,0) x, z; (1,1) z, y; (2,0) x, z; (2,1) x, y.
2. **Attributes are always present** on every variant of a detail piece: `detailW` (Uint8 × 4, normalized; rgb used) and `detailUv` (Float32 × 2). Looks without detail share one zero pair made once for the source geometry. No reliance on GL default attribute values, and one program for every look.
3. **One texture, three channels.** Lossy WebP cannot keep packed channels apart (chroma subsampling), so the file is a grey strip (`detail.webp`, 3 cells of 256 px side by side, each seamless) and the loader packs cell i into channel i of a 256 × 256 RGBA `DataTexture` (sRGB, repeat, mipmaps, profile anisotropy). A is unused. A per-look texture swap is not possible: the material is shared by world hero and doll.
4. **Loaded inside `loadCharacters`** with the clothing maps (awaited), so the doll, the look sheet and the icon renders have it without a `ready` hook. Missing file: `detailW` stays 0 everywhere (today's look).
5. **Worn knees, coloured patches:** not in the tile. They stay palette `spots` and `bands` on the vertex colours (the tile is neutral).
6. Only `a_mantel` is patched now (`DETAIL_PIECES`); `a_poncho` and `a_weste` can join later at the same cost each (their UVs are the same projection).
7. **Tiles are coarse** (as rule A 3a): the hero is small at the game camera, so the tile shows structure of 3 cm and more (oversized mail rings, denim fading and seams rather than twill, patches of about 10 cm). The mipmaps fade anything finer to the flat tone, which is the safe failure: the look then equals today's.

### Alternatives weighed

| Alternative | Verdict |
|---|---|
| Cells inside `coat.webp`, role vertices remapped into them | No shader change, but no tiling (finding 8) and bleeding into the swatch. Rejected |
| Tiling inside an atlas cell in the shader (`fract` + `textureGrad`) | Needs the shader patch anyway and adds seams and gutters; a second sampler with hardware repeat is simpler. Rejected |
| Trousers as their own index group with a second material | +1 draw call in up to four passes, smeared border triangles, and still one material per detail. Rejected |
| Triplanar in the fragment shader from the bind position | No UV attribute, but three samples or hard per-pixel seams, and the tile scale per role moves into the shader. Fallback only if rule 1's chart assumption fails (see Questions) |
| One texture per detail, bound per look | Material is shared by hero and doll, which can show different looks. Rejected |

### Data shapes

```ts
// src/data/hero-look.ts (plain data)
export type DetailId = 'denim' | 'mail' | 'patch';
/** Channel in the packed detail texture, tile size (m) and the cell's mean sRGB tone (measured from detail.webp). */
export const DETAILS: Readonly<Record<DetailId, { channel: 0 | 1 | 2; tile: number; tone: number }>> = {
  denim: { channel: 0, tile: 0.5, tone: 0 /* measure */ }, mail: { channel: 1, tile: 0.3, tone: 0 }, patch: { channel: 2, tile: 0.5, tone: 0 },
};
export interface Palette { roles: ...; bands?: ...; spots?: ...; detail?: Partial<Record<Role, DetailId>> }
// leder: detail { trousers: 'denim' }; 'kette:zit': detail { coat: 'mail', hem: 'mail', cuff: 'mail' }; spaeti: detail { coat: 'patch', hem: 'patch', cuff: 'patch' }

// src/render/hero-wear.ts
export const DETAIL_PIECES: ReadonlySet<string>;                                   // 'a_mantel'
/** Chart (0..5) of each vertex from its uv, and the two bind axes of that chart. Pure, tested. */
export function detailAttributes(geo: BufferGeometry, info: PieceInfo, paletteId: string): { w: BufferAttribute; uv: BufferAttribute };

// src/render/characters.ts
/** Patches a clothing material: detailMap sampler, detailGain, `attribute vec3 detailW; attribute vec2 detailUv;` and their varyings; customProgramCacheKey 'hero-detail'. */
function withDetail(mat: LitMaterial, detail: Texture, gain: Vector3): void;
```

### Changes

| File | Change |
|---|---|
| `src/data/hero-look.ts` | `DetailId`, `DETAILS`, `Palette.detail`; the three palettes get their `detail` in step B2 |
| `src/render/hero-wear.ts` | `detailAttributes`; `pieceVariant` sets `detailW`/`detailUv` when the palette has `detail` (key already holds the palette id); zero pair on the source geometry of `DETAIL_PIECES` |
| `src/render/characters.ts` | `loadClothing` also loads and packs `detail.webp`; `withDetail` on the `a_mantel` material after its map is set |
| `assets/textures/hero/detail.webp` | New, 768 × 256 grey strip (step B2); row in `assets/LICENSES.md` |
| `src/render/hero-wear.test.ts` | See Done when |

### Cost per profile

| | Qualität | Ausgewogen | Leistung |
|---|---|---|---|
| Draw calls | +0 | +0 | +0 |
| Shader | The coat material's program is replaced by the patched one (compiled at load by `showAll`, as today); one more texture read on the coat piece in the beauty pass only | same | same |
| GPU memory | 256 × 256 RGBA with mipmaps: 0.35 MB | same | same |
| CPU memory | 12 bytes per coat vertex per look variant that uses a detail (cached) | same | same |

Pre-pass, shadow and outline passes use their own materials and do not change.

## Steps

Each step is one PR. A1 and B1 change no pixel; A2, A3 and B2 are art on the PC (skill `local-ai-assets`, W1 tileable texture).

### A1 Kit atlas mechanism [Claude · Opus high]

1. `src/render/kit-atlas.ts` with `KIT_ATLAS`, `KIT_TONE` (all cells flat for now: cell 0 white, the rest 0xb8), `KIT_CELLS`, `paintPart`, `kitAtlas`, `kitReady`.
2. `assemble` calls `paintPart`; `gearKit` sets the map on `paint` and `metal`.
3. `tools/enemy-sheet.ts` awaits `kitReady()`.
4. Tests (`kit-atlas.test.ts`): mapped part UVs lie inside the padded cell; up-facing triangles of a `top` material lie in the `top` cell; vertex colour × cell tone = kit colour within 1/255; unmapped parts sit on the centre of cell 0 with the exact kit colour.

Done when: `npm run check` passes; `node tools/enemy-sheet.mjs` for `baklava`, `sultan`, `rattenmutter`, `souffleur` shows the same `calls=` as on `main` and no visible change (`tools/image-diff.mjs`, mean below the swiftshader noise of 0.4).

### A2 Wedding cells: filo and brass [Claude · Opus high · PC]

1. Paint cells 1 to 3 (filo side: horizontal flaky layers with darker baked edges; filo top: golden crust with glaze; brass: tarnish and fine engraving bands running along u), tileable, 256 px, into `assets/textures/enemies/kit.webp`. Crop the middle of a larger pick (hats lesson).
2. Measure the cell means into `KIT_TONE`; add a test that reads the file with `sharp` and compares (±2).
3. Before/after composite in chat and in `docs/proof/t10-kit/` for Baklava-Brocken, Hauptgericht, Tee-Ifrit (samovar), Sultan, Zeitwart (brass hands), at game camera and as Kodex portrait.
4. Re-render the Kodex portraits of kinds that visibly changed (`node tools/kodex-portraits.mjs`), keep only files that really changed.
5. Docs: `docs/asset-pipeline.md` T10 row, `docs/enemy-pipeline.md`, `assets/LICENSES.md`, `docs/local-ai-assets.md` (handover lines), a look row for Johannes in `docs/tasks/pt-hardware-checks.md` › Playtest.

Done when: the composites show the pastry and brass at game camera on Ausgewogen and Qualität; `calls=` unchanged; a Köpenick boss with brass (Feldwebel) still reads as brass.

Kill rule: if brass on small parts (buttons, rings) turns blotchy at game camera, lower the cell's contrast; if it still fails, drop `brass` from `KIT_CELLS` and say so in the handover.

### A3 Ear skin, mirror, tea glass [Claude · Opus high · PC]

1. Cell 4 ear skin (dirty pink, veins from one edge, grime), cell 5 mirror (painted fake reflection: soft diagonal light streaks, a few scratches), cell 6 tea glass (amber with a light caustic).
2. Tea: `k.tea` and `k.urn` take the atlas as `map` and `emissiveMap`. Their parts are not in the paint family, so `assemble` remaps the UVs of `tea` and `urn` parts in every call (UV only, no vertex colour); material colour and `emissiveIntensity` ÷ the cell tone (linear) so colour and glow keep their strength. Update `userData.baseEmissive` with it.
3. Proof and docs as in A2 (T8 row for the ear skin, T10 for the tea glass).

Kill rule: tea glass and mirror are small parts. If the before/after shows no visible change at game camera and in the Kodex portrait, leave the cell out and note it under "Tried and dropped" (as the cut-glass trial).

### B1 Coat detail mechanism [Claude · Opus high]

1. Pin finding 5 with a test: for every `a_mantel` vertex, `uv` within its chart is a linear function of the two axes of the chart table (residual < 1e-3), so a later re-unwrap fails loudly. If it fails, stop and see Questions.
2. `DetailId`, `DETAILS`, `Palette.detail`; `detailAttributes`; `pieceVariant` and the zero pair.
3. `withDetail` and the loader with a code-made placeholder strip (three flat grey cells at tone 225 with a faint weave) until B2 delivers the file.
4. Tests (`hero-wear.test.ts`): a palette with `detail: { trousers: 'denim' }` gives weight (1, 0, 0) on trousers vertices and 0 elsewhere; `detailUv` advances by 1 per `tile` metres along both chart axes; a palette without `detail` returns the shared zero pair; variants stay cached.
5. Proof: `tools/look-sheet` with a temporary debug palette that puts a checker in each channel on trousers and coat: the checker is square, the same size on every chart, and does not swim in the walk clip.

Done when: `npm run check` passes; the three existing looks render unchanged (look sheet `image-diff` below noise); the checker proof is in `docs/proof/t9-detail/`.

### B2 Denim, chainmail, patchwork [Claude · Opus high · PC]

1. Paint the three grey tiles (denim with fading and seams, 0.5 m; mail rings, 0.3 m, about 8 rings across; patchwork squares with stitching, 0.5 m, about 5 across) into `assets/textures/hero/detail.webp`; measure the tones into `DETAILS`. Judge every pick at the game camera first, on the doll second.
2. `detail` on `leder` (trousers), `kette:zit` (coat, hem, cuff), `spaeti` (coat, hem, cuff). Worn knees for `leder`: two `spots` on `trousers` at knee height, a lighter blue.
3. Re-render icons I17, I49, I57 (`node tools/item-icons.mjs`, `PAGES=wear`), keep only those three.
4. Check the inventory doll in the game (turn it once); before/after composites in chat and `docs/proof/t9-detail/`.
5. Docs: `docs/asset-pipeline.md` T9 row, `docs/equipment-pipeline.md` (the three items lose need `T`), `assets/LICENSES.md`, `docs/local-ai-assets.md`, a look row in `docs/tasks/pt-hardware-checks.md` › Playtest.

Done when: the three looks show their material on the doll and in the icons and read differently from before at the game camera, on all three profiles (`?profile=`); hero draw calls unchanged.

Kill rule: a detail that shows nothing at the game camera gets one retry with a larger tile; if it then only shows on the doll and the icon, keep it (it costs nothing) and say so in the handover.

## Not in scope

- T9 decals (back print, crest): alpha decals are a separate mechanism.
- Moving fur and wool (`TEXTURED`) into the bake; kit materials of kinds outside paint mode (their meshes stay flat); `assembleAlex`.
- Gloss per material in the bake (honey loses its shine in `paint` today; unchanged).
- Detail on `a_poncho`, `a_weste`, boots or gloves.

## Questions

None open. Checked while designing: the chart table above holds on the committed `hero.glb`; three.js 0.187 `map_fragment` declares `vec4 sampledDiffuseColor` and multiplies it into `diffuseColor`, so the patch replaces that chunk whole.

If the B1 chart test ever fails (the coat was unwrapped again): do not derive charts from `uv`. Fallback: bind position and bind normal as varyings, choose the projection plane per pixel by the largest normal axis, one sample (hard seams at 45°, hidden by the low-contrast tile).
