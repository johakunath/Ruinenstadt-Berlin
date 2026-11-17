# R1 Hero outline: cost [Opus 5.5 high, measurement by Johannes]

Status: built 2026-11-17 (Opus 5.5); Johannes measures. Review of PR #14 (2026-11-16). Cost below is read from the code, not measured.

## Findings
| # | Finding | Where |
|---|---|---|
| 1 | Two extra scene renders every frame (occluder depth, hero depth), each traversing the whole scene, also when nothing hides the hero | `src/render/hero-outline.ts`, `src/render/post.ts` |
| 2 | One full-screen pass at composer resolution with 19 texture reads per pixel; on Qualität one more 4× MSAA half-float resolve | `src/render/hero-outline.ts` shader |
| 3 | Each depth target also allocates an unused color attachment (half its memory) | `src/render/hero-outline.ts:44-47` |
| 4 | `near` and `far` are copied once in the constructor (fine today, wrong if the camera planes ever change) | `src/render/hero-outline.ts:57-58` |

## Scope
1. Skip both depth renders and the composite when the hero's screen rectangle has no occluder in front (cheap test: a ray from the camera to the hero against the chunk occluder boxes), or scissor all three to the hero's projected rectangle plus the contour width.
2. Draw the contour into the read buffer (`needsSwap = false`) so no full-screen copy and no extra MSAA resolve happens.
3. Depth-only targets; copy `near` and `far` in `prepare`.
4. Keep the 14 pixel cases of `tools/proof-outline.mjs` green; add a case with a hammer and a spear (weapons are on the hero layer since PR #18).

## Done when
Johannes measures frame time with `?debug=perf` on the Tab S9 (Leistung) and the PC (Qualität) before and after, in the same spot behind a building and in the open; numbers go into `docs/proof/hero-outline/README.md`.

## Handover (Opus 5.5, 2026-11-17)
- Skip test:
  - `BatchSet.captureOccluder` records one world box per captured object; the mask mesh carries them in `userData.boxes`.
  - `HeroOutline.prepare` tests them against a 2.7 m sphere around the hero (`renderer.ts`; the spear tip reaches about 2.5 m in a thrust). It skips boxes farther than the hero and boxes whose screen rectangle misses hers.
  - No hit: no depth render, no contour, so the hero in the open costs nothing.
- When occluded:
  - only the masks with a hit render their depth; the others are hidden for that render
  - both depth renders are scissored to the hero's rectangle plus a margin
  - the contour is blended onto the read buffer inside the same scissor (`needsSwap = false`): no full-screen copy, and the pass no longer reads `tDiffuse`
- Depth targets have a one-byte `RedFormat` colour attachment (WebGL needs one), a quarter of the old size. `near` and `far` are copied in `prepare`. The mask list is rescanned every 120 frames.
- `tools/outline-cases.ts` uses the game's bounds rule and adds hammer and spear cases (hero beside the building, only the weapon behind it). All 18 cases are as expected, and the in-game shots in `docs/proof/hero-outline/` still show the contour behind the tram and the building.
- Not done: the MSAA resolve of the read buffer still happens on Qualität when the contour draws (three.js resolves the whole target). Johannes' measurement goes into `docs/proof/hero-outline/README.md`.
