# P1b Proxy passes: one draw call per chunk in the pre-pass and the shadow pass [Claude · Opus high; spec: Fable high, 2026-11-18]

Status: open. Start only after Johannes' measurements 1 and 2 in `docs/tasks/p1-heat.md` (if Akkusparen alone cures the heat, pixel load dominates and this moves down).

## Goal
Halve the draw calls. Today every chunk material is drawn three times (beauty, normal/depth pre-pass, shadow pass); the last two use one material for everything, so they can draw a chunk in one call.

## Measured base (Xhain, Leistung, 32 m chunks, `tools/passes.mjs`)
Shadow pass 173 to 236 calls, pre-pass 83 to 124, beauty 130 to 180. Target: shadow about 15 to 25, pre-pass about 15 to 25, beauty unchanged.

## Design
| Item | Rule |
|---|---|
| Shared buffers | `BatchSet` builds ONE position/normal/uv/colour/index set per chunk; each material is a contiguous index range. Order: front-sided opaque materials, then double-sided opaque, then alpha-tested |
| Beauty | One `Mesh` per material as today, each with its own `BufferGeometry` that shares the attributes and sets `drawRange` and its own bounding sphere (same culling and call count as today) |
| Pre-pass proxy | One mesh per chunk over the opaque ranges, same attributes, on a new `PREPASS_LAYER`; chunk beauty meshes move from layer 0 to a new `WORLD_LAYER` that the main camera enables. The pre-pass camera uses layer 0 (characters, instanced props) plus `PREPASS_LAYER` |
| Shadow proxy | One mesh per chunk with two groups: front-sided range with a `BackSide` caster material, double-sided range with a `DoubleSide` one (this is what three does per material today, so shadows stay identical). Chunk beauty meshes stop casting; alpha-tested ranges keep casting from their beauty mesh |
| Shadow render | three filters shadow casters by the layers of the camera passed to `render`. Render the shadow map explicitly: a dummy camera that sees nothing (aimed away) with layers 0, shadow proxy and caster boxes, a 1 × 1 target, `shadowMap.needsUpdate = true`; then the beauty pass with `needsUpdate` false. Fits `ShadowClock` (`src/render/shadow-rate.ts`) |
| Cutaway | `geometry.userData.cuts` ranges shift by the material offset; proxies share the index buffer, so one upload cuts all passes |
| Memory | Indices become 32-bit for every chunk (state the measured total before and after) |

## Steps
1. `tools/passes.mjs` numbers before (three Xhain spots, Köpenick start).
2. `BatchSet`: shared buffers and ranges behind the existing `meshes()` API; unit tests (ranges, bounds, occluder mask, cut ranges still correct).
3. Layers and proxies in the chunk loop of `buildMapWorld`; courtyard world unchanged.
4. Explicit shadow render in `Post.render`; pre-pass camera layers.
5. Pixel comparison in the cloud (software render is deterministic enough): same spot before and after, both profiles, difference near zero.
6. Numbers after; Johannes measures on the Tab S9 and the PC.

## Done when
Draw calls per frame at the three Xhain spots are at or below 280 on shadow frames; screenshots match; `npm run check` and the smoke test pass.

## Not in scope
Material merging (row 5 of the ranking), 24 m chunks (row 7, try after this), hero mesh merging.
