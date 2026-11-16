# R1 Hero outline: cost [Opus 5.5 high, measurement by Johannes]

Status: open. Review of PR #14 (2026-11-16). Cost below is read from the code, not measured.

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
