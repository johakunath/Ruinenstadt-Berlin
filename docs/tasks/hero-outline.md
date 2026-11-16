# Occluded hero outline [Codex]

Status: done (PR #14). Johannes explicitly requested the replacement renderer and removal of the old effect on 2026-11-16.

## Goal

Keep all world objects opaque. Show only a thin character contour where actual building or large-vehicle geometry hides it. No effect from proximity, small props, loot, enemies, lamps or trees. Supply in-game screenshots and resolve the PR's conflict with main.

## Handover

- Merged main through `bc1163d`, preserving M4 loot/exit-warning code and both branches' status updates; conflict resolved in `docs/status.md`.
- Deleted `cutout.ts`, its material/pre-pass shader hooks, uniforms, camera getter and renderer updates; replaced obsolete active documentation.
- `BatchSet.captureOccluder` makes one position-only mask mesh per chunk from explicitly classified building/vehicle triangles. Beauty batching, material opacity and world geometry stay intact; shared materials cannot accidentally opt small props into the effect.
- `HeroOutline` renders actual skinned hero/equipment depth and eligible object depth, then draws only occluded silhouette edges. Depth bias avoids contact artifacts. Targets use existing profile pre-pass resolution; resize, disposal and render-state restoration are included.
- Späti upper masks follow their upper group's existing interior visibility. Trees, ordinary props, breakable crates/bins, loot and enemy meshes never enter the large-object mask.
- 2D reference `js/render.js` was checked: its Canvas fades/enemy silhouettes cannot be reused for WebGL depth; reuse the approved palette and architecture instead. User's explicit request authorizes this rendering change beyond T1's texture-only scope.
- Typecheck, 223 unit tests, build and all 13 browser tests pass. Pixel cases verify large occlusion only, with no changed pixels in beside/front/crate/tree/enemy/lamp controls at both profile resolutions. Requested screenshots and error logs: `docs/proof/hero-outline/`.
- Cost: two unlit depth passes, one contour composite, position-only eligible geometry; no new lights or beauty draw batches. Approximate extra targets at 1280 × 720/DPR 1: 14.1 MiB Qualität, 7.9 MiB Leistung. PC/Tab S9 acceptance remains with Claude/Johannes.
