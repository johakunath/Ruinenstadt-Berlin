# V1 Visibility behind buildings: back yards and enemy contours [Claude · Fable high: B engine decision and spec; Claude · Opus high: build]

Status: A built, B engine decided 2026-11-18 (B3, spec below), build in progress. Playtest Johannes, 2026-11-17.

## Decision (Johannes, 2026-11-18, `docs/mockups/m15-altbau-visibility.svg`)
Mainly **A**: tall closed rows only where they do not hide a walkable street (built as `Street.block`, `docs/maps/guidelines.md` › Blockrand). Selectively **B**: a building is cut off above the ground floor (hard cut, dark cap, no transparency) while the hero is in a courtyard behind it or behind a landmark. This overrides the 2026-11-16 "no proximity effect" rule only for these flagged objects.

## B: engine decision (Fable high, 2026-11-18): B3 cut by index range
Neither B1 nor B2. The cut is done in the geometry, not in shaders and not with extra meshes.

| Option | Verdict |
|---|---|
| B1 `cutId` attribute + discard | Rejected. Touches every material and every pass (beauty, normal override, shadow depth, contour mask), needs back-face caps, one missed pass shows a ghost wall or shadow |
| B2 separate upper meshes (as the Späti roof) | Rejected as the general engine. One draw call per material and pass for every flagged object while it is NOT cut, against a draw call count that is already 2.5 times the budget. The Späti keeps it |
| **B3 index ranges (chosen)** | A flagged object is built inside a cut scope. The batch clips its triangles at the cut height, puts the upper ones in one contiguous index range per material and records the range. Cutting = overwriting that range with degenerate triangles (index sub-range upload), uncutting = writing it back. Caps are extra triangles that are degenerate while uncut |

Why B3: the same index buffer is drawn by every pass, so beauty, normal/depth pre-pass, shadow pass and any later pass agree without touching a material. 0 extra draw calls, 0 shader variants, 0 lights, both profiles identical. Cost: a few clipped vertices per flagged building, one index upload per affected mesh when the hero enters or leaves a zone, fewer triangles while cut. Compatible with P1b (shared chunk buffers): ranges only shift.

## B: spec [Claude · Opus high]

### Data (`src/data/cut.ts`, pure, tested)
| Item | Rule |
|---|---|
| `VIEW = { pitch: 44 }` | Single source for the camera pitch; `src/render/camera.ts` imports it |
| `CUT = { floor: 4.3, yard: 1.2, reach: 20, pad: 2, leave: 0.75, minHidden: 3 }` | `floor` = `GROUND_H` (test pins equality). `yard` is lower on purpose: the first yard is only about 4.5 m deep and a 4.3 m stub still hides 4.45 m of ground behind it (4.3 / tan 44°); 1.2 m hides 1.25 m. Johannes decides with the screenshots (`?cut=4.3` shows the other height) |
| `Landmark.cut?: { h?: number; reach?: number }` | Hand-flagged in the map data. Xhain: `thomaskirche`, `bethanien`. Oberbaum towers not yet (one line later) |
| `cutPlan(m, lots, opts?)` → `{ zones: CutZone[]; parts: CutPart[] }` | `CutZone { name; poly: Pt[] (convex); h; parts: number[] }`, `CutPart { id; kind: 'lot' \| 'landmark'; index; h }` (h = lowest of its zones) |
| Landmark zone | Footprint (`hx`, `hz`, `rot`) widened by `pad`, swept north (−z, away from the camera) by `reach`; convex hull. Part: the landmark. `h = cut.h ?? CUT.floor` |
| Hinterhof zone | Every lot with `special === 'hinterhof'`: its rectangle. `h = CUT.yard`. Parts: every building lot (any lot in `lots`, also neighbours; not trees, not specials) taller than `h + 0.5` that hides at least `minHidden` walkable 1 m samples of the zone |
| `hides` | A sample (zone point outside all building footprints) is hidden when the segment from it toward +z (the camera), between `h / tan(pitch)` and `min(H / tan(pitch), reach)`, crosses the footprint (main rectangle or wing). So only buildings on the camera side are cut; the far side and the side wings stay and frame the yard |
| `cutActive(zone, x, z, was)` | Inside the polygon → on; stays on until more than `leave` outside (no flicker at the edge) |

### Render
| Item | Rule |
|---|---|
| `Batch` / `BatchSet.cut(part, y, build, caps?)` (`src/render/batch.ts`) | Clips what `build` added at world height `y` (positions, normals, uvs, colours interpolated), orders lower then upper triangles, records `{ part, start, count, cap }` in `geometry.userData.cuts`. `caps` adds triangles shown only while cut. Must be called inside `captureOccluder`, so the mask gets the final triangles |
| Contour mask | The mask mesh carries the same cut ranges; its per-object box is clamped to the cut height while cut (no wasted mask passes while the hero stands in the yard) |
| `Cutaway` (`src/render/cutaway.ts`) | Registers meshes with cut ranges, keeps the original indices, `set(part, on)` blanks or restores (`index.addUpdateRange`), `update(x, z)` runs the zones. Called from `World.follow` |
| `ChunkBuilder.cut` (`map-world.ts`) | Wraps `solid`, `cards`, `glows` and the shadow caster boxes pushed inside. Used for flagged lots (lot and wing together) and flagged landmarks (`xhain-world.ts`) |
| Caps | Dark (vertex colour about 0.1) quads in the existing `tar` material at the cut height: lot and wing rectangles; landmarks list their rectangles next to the builder; ruins get a 0.4 m ring along the walls (they are open shells) |
| Not cut | Light spots (count stays constant), ground glow decals, props, trees, yard `wall` props (follow-up if the screenshots ask for it) |
| URL | `?cut=off` disables, `?cut=<meters>` overrides the yard height (look test) |
| Transition | Instant (Johannes: hard cut, no fade) |

### Tests
`cut.test.ts`: zone polygons, `hides` on synthetic lots (south building flagged, north and side ones not), Köpenick and Xhain: every Hinterhof has a zone, Thomaskirche and Bethanien are flagged, `cutActive` hysteresis. `batch` test: clipped triangle count and bounds, ranges per part, cap ranges, mask ranges. `cutaway` test: blank and restore are exact inverses.

## Findings
1. The new back yards (M11c lot type Hinterhof, M16b lane "Hinterhof") lie fully behind building fronts as seen by the camera. The hero contour shows, but not the ground, so you cannot see where you walk.
2. Enemies behind buildings are invisible. They need a contour like the hero.

## Source
- 2D: `js/render.js` (how 2D handled walls in front of the hero), `js/world.js` lot placement. Check first.
- 3D: `src/render/hero-outline.ts` (contour pass, R1 cost rules), `src/data/lots.ts`, `src/data/koepenick.ts:174` (Hinterhof lane), `docs/maps/guidelines.md` › Side branches, Lot types.

## Scope
1. **Layout rule (decide first, mockup):** walkable lots and side lanes open toward the camera. Candidates: A place them only where the camera-side neighbour is street or low; B camera-side building of a walkable lot is a ruin cut down to one storey; C flip the lot so the yard faces the street. No proximity fades or material clipping (CLAUDE.md). Write the chosen rule into `docs/maps/guidelines.md` as an invariant and a test (no walkable cell hidden by a building taller than X between it and the camera).
2. **Enemy contours:** extend the contour pass to enemies (own colour, e.g. red, per type tint optional). Keep the R1 rules: nothing drawn when no occluder box overlaps any enemy rectangle; one scissored union rectangle or a cap on outlined enemies (nearest N). Measure cost with `?stress=40` on the PC (Johannes).

## Done when
- No walkable back yard or lane cell is hidden at the default camera (test); screenshots in `docs/proof/v1/`.
- Enemies behind buildings show a contour in both profiles; Leistung cost stated.
