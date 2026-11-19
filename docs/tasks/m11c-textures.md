# M11c Textures for the new lot types and plants [Codex]

Status: initial image integration built. Performance review and hardware playtest open. See [the repeat and atlas checks](../proof/m11c-textures/README.md), [the texture pipeline](../asset-pipeline.md) and [the Köpenick look](../style/koepenick.png).

The asphalt image and its `asphalt` and `tar` hooks shipped in [T2](t2-street-textures.md).

## Goal

The eight M11c lot types (Hinterhof, Parkplatz, Kleingärten, Teich im Park, Trümmerfeld, Baustelle mit Kran, Markt, Kirchhof), the new plants (bushes, hedges, flowers, reeds, better trees), balconies and broken ruin walls are built in code with painted placeholders. Ten generated textures replace the placeholders where flat code painting reads worst. All are reusable by other districts (Wedding, Charlottenburg, Tempelhof): paint neutral Berlin materials, not Köpenick-only motifs.

## What exists today

Painted images (`assets/textures/koepenick/`, T1, loaded by `src/render/ground-textures.ts`): `grass`, `dirt`, `paving`, `leaves` (1024, seamless, 5 m) and `litter` (2 × 2 alpha atlas).

Code-painted placeholders (`src/render/paint.ts`), by material:

| Where | Materials / painters |
|---|---|
| `makeMats` (`world.ts`) | `plaster*` (`paintPlaster`), `brick` (`paintBrick`), `cobbles`, `stucco`, `wood` (`paintWood`), `rust` (`paintMetal`), `iron`, `bin`, `burlap` (`paintCloth`), `awning`, van, `door`, windows, shop, `sign`, `ivy`, `fern` |
| `makeMapMats` (`map-world.ts`) | `asphalt`, `tar` (`paintAsphalt`), `roof` (`paintRoofTiles`), `concrete`, `mossy` (`paintConcrete`), `path` (= dirt image), `litter`, `frond` (`paintFern`), `railSteel` (flat color), `trunk` and `crown` (flat color, no map), `water`, `glass`, text signs |
| Ground (`groundMaterial`) | `paintGrass`, `paintDirt`, `paintPaving`, `paintLeafLitter` (now images) |

## Decision: which surfaces need an image

Painted image (priority order, the ten below): asphalt with oil and cracks, concrete with rebar stains, gravel path, corrugated container metal, tarp fabric, stone with moss, bark, foliage atlas, reed and grass atlas, ruined brick. These are large or close-up surfaces where a canvas noise texture looks flat, or alpha cards that carry whole plants.

Code-painted stays (good enough, tinted by vertex color or tiny on screen): wood (fences, jetty, pallets, stall frames, benches: `paintWood`), iron and bins, Bauzaun mesh, scaffold pipes, balcony rails (`iron`), gnomes, candles and string lights (emissive color), pond water (`water`, flat shader), signs, Rohbau formwork lines (geometry), clothesline (thin lines), crane (`rust` plus yellow paint color).

## Images

| # | File | Size | Type | Content (Köpenick style: cream, ochre, olive, teal, rust, oxblood, desaturated; flat albedo, no baked light) | Replaces |
|---|---|---|---|---|---|
| 1 | `assets/textures/koepenick/asphalt.webp` | 1024, 5 m | seamless | Worn dark grey-brown asphalt: fine aggregate, hairline cracks, patched squares, a few oil stains, weeds in two cracks. No lane or parking lines (those are #1b) | `paintAsphalt` (`asphalt`, `tar`) |
| 1b | `assets/textures/common/markings.webp` | 1024 × 512, atlas 4 × 2 (256 px cells) | alpha atlas | Faded paint decals on transparent: single parking bay line corner, bay T-joint, arrow, disabled symbol, zebra stripe block, number "1" to "9" stencil, half-erased stop line, dashed line piece. Cut-out edges, paint chipped | New `marking` decal material (Parkplatz, streets) |
| 2 | `assets/textures/common/concrete-rebar.webp` | 1024, 4 m | seamless | Grey cast concrete with formwork seams, rust run-off stains, a few chipped patches with exposed rusty rebar, water marks | `paintConcrete` (`concrete`, `mossy` base), Rohbau, slabs, wall stubs |
| 3 | `assets/textures/koepenick/gravel.webp` | 512, 3 m | seamless | Beige-grey compacted gravel and sandy soil, small stones, a few tire or foot-worn streaks, sparse weeds. Distinct from `dirt` (no mud) | `path` material in gardens, Hinterhof, Kirchhof paths |
| 4 | `assets/textures/common/corrugated.webp` | 512, 2 m | seamless (vertical ribs) | Painted corrugated sheet metal: regular vertical ribs, faded teal/oxblood-neutral (mid grey-teal so vertex color tints it), rust at the lower edge and bolt lines, scratches | New `corrugated` material (containers, Bauzaun panels, Lauben roofs, barrier) |
| 5 | `assets/textures/common/tarp.webp` | 512, 1.5 m | seamless | Weathered woven tarp: neutral light cloth, visible weave, creases, grommet line at one edge, patches, mildew stains. Neutral so stalls can tint cream, ochre, teal, oxblood | `burlap`, `awning` for Markt and construction |
| 6 | `assets/textures/common/stone-moss.webp` | 512, 1.5 m | seamless | Weathered sandstone and granite, grey-ochre, chipped, green moss and lichen in the lower third, rain streaks, no inscriptions | Gravestones, low church wall, plinths (new `gravestone`; `mossy` fallback) |
| 7 | `assets/textures/common/bark.webp` | 512, 1 m | seamless (vertical) | Deep-furrowed grey-brown bark (linden, oak), moss on one side, no branches or knots larger than 10 cm | `trunk` (now a flat color) |
| 8 | `assets/textures/common/foliage.webp` | 1024, atlas 2 × 2 | alpha atlas | Cells: (a) leafy branch cluster, summer green-olive, (b) the same dry ochre-brown, (c) dense small-leaf hedge patch, (d) wildflower patch card: grass with white, yellow and violet blooms. Cut-out edges, alpha clean, edge color bled into transparent pixels (T1b #4) | `crown` (flat), bush and hedge boxes, flower patches in `vegetation.ts`, `frond` as needed |
| 9 | `assets/textures/common/reeds.webp` | 1024, atlas 2 × 2 | alpha atlas | Cells: (a) reed stand with cattail heads, (b) tall sedge tuft, (c) pond-edge grass tuft, (d) lily pads with one flower. Ground-anchored at the bottom edge of each cell | `reeds` kind in `vegetation.ts`, pond edge |
| 10 | `assets/textures/koepenick/brick-ruin.webp` | 1024, 4 m | seamless | Old Berlin yellow-red brick with large plaster loss showing brick, soot, damp lower band, a few missing bricks and a rusty tie bar. Top edge is geometry, not painted | `paintBrick` on ruin walls and Hinterhof walls (`brick` stays for intact walls) |

Rules that apply to all: albedo only, medium to low contrast, no baked shadow or highlight, details under 5 cm at the stated scale left out, WebP quality about 85, each file at most 400 KB, sRGB. Alpha atlases: no soft halo. Provide a 1024 master; Claude exports 512 where the table says 512 (T1b rule), so Codex may deliver 512 directly for 3 to 7.

## Prerequisites (Claude, before this task starts)

Claude adds code-painted placeholder materials with these keys in `makeMapMats` so Codex only swaps maps: `marking`, `corrugated`, `tarp`, `gravestone`, `bark`, `foliage`, `reedCard`, `brickRuin`. Without them Codex creates the key with a flat-color material and writes it under Questions.

## Integration (Codex)

1. Extend the `urls` map in `src/render/ground-textures.ts` (rename the export to a generic surface loader or add a sibling; keep `loadGroundTexture` working). Same rules: sRGB, `RepeatWrapping` for seamless, `ClampToEdge` for alpha atlases, anisotropy from the profile, the painted texture stays until the image is decoded and failure keeps it.
2. Swap in `makeMapMats` / `makeMats` as in T1: `asphalt` and `tar` map (#1; `tar` keeps its `color` tint), `concrete` and `mossy` (#2; `mossy` keeps the green tint through `color`), `path` for the garden and courtyard paths only (#3, not the street `path` of `dirt` unless Johannes asks), the new keys for #1b and #4 to #9, `brick` ruin variant for #10. Release the replaced procedural textures (`dispose`).
3. Keep UV scale: each image covers the same world size as the placeholder; table sizes above are the target. Do not change geometry, UVs, shaders, vertex colors, draw calls, light count or render profiles. If a texture needs any of these, write the question below and stop.
4. Atlas cells follow the order in the table (row-major, top left first). Write the cell order into the file header of the loader.

## Checks

- `npm run check`, e2e once.
- 2 × 2 repeat test image for each seamless texture in `docs/proof/m11c-textures/`.
- Screenshots (`node tools/screenshot.mjs`, both profiles) before and after: Parkplatz, Baustelle, Kirchhof, Kleingärten and a tree/hedge close-up, each at game camera distance. Details must read at 12 to 20 m; characters and loot stay readable on top.
- `assets/LICENSES.md`: one row per file (tool, prompt summary, author Codex (for Johannes), license own work, changes).
- Performance (Claude does the measurement): Codex reports the sum of file sizes and decoded GPU size per profile (1024 RGBA with mips about 5.3 MiB, 512 about 1.3 MiB; budget for this batch: at most 20 MiB on Qualität, at most 10 MiB on Leistung where 512 is used for everything except #1, #2, #10). No new draw calls: alpha atlases share one material per atlas, each with `alphaTest` (no blending).

## Not in scope

KTX2, normal or height maps, new geometry, other districts' colors, hardware measurement, tuning of vertex colors.

## Questions

- The marks atlas includes the full approved decal set. The existing parking dividers use its dash. Corners, junctions, additional signage, crossings and stencils can be placed when they have map consumers.
- The merged vegetation code uses one 4 × 2 atlas. Summer foliage, fern, broad leaves, a cattail and sedge card and the four existing wildflower palettes fit its current consumers. Dry variation uses existing vertex tints. Lily pads have no geometry hook.
- The merged allotment has a gravel path. The cemetery and Hinterhof use separate ground types. Additional gravel path geometry would need an authored route for each lot.

## Handover

- Parking dividers use the painted dash with slope-following positions preserved. Allotment gravel, wall ruins, Rohbau and slab concrete, cemetery stone and corrugated containers each use a dedicated albedo.
- The scaffold and market tarp canvases retain their authored colours, bands and cutouts, with the generated woven cloth blended onto them. Existing plant geometries, atlas coordinates and procedural fallbacks are preserved.
- Used the 2D Köpenick path, ivy and damage textures as references for tone and surface wear. Ten WebPs total 898 kB. Runtime estimates including RGBA mipmaps and both cloth canvases are 18.3 MiB on Qualität and 9.3 MiB on Leistung. Both profiles load the licensed masters, then size concrete and the marking atlas to a 512 px edge before upload. Leistung also caps the ruin albedo and plant atlas at 512 px and corrugation, bark and solid foliage at 256 px. Confirm available memory and per-chunk draw counts on PC and Tab S9.
