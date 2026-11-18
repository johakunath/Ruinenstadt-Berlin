# V1 Visibility behind buildings: back yards and enemy contours [Claude · Fable high for the B engine choice, then Opus high]

Status: open. Playtest Johannes, 2026-11-17. Layout decided 2026-11-18 (below); B needs the engine pass.

## Decision (Johannes, 2026-11-18, `docs/mockups/m15-altbau-visibility.svg`)
Mainly **A**: tall closed rows only where they do not hide a walkable street (built as `Street.block`, `docs/maps/guidelines.md` › Blockrand). Selectively **B**: a building is cut off above the ground floor (hard cut, dark cap, no transparency) while the hero is in a courtyard behind it or behind a landmark. This overrides the 2026-11-16 "no proximity effect" rule only for these flagged objects.

## B: engine options (decide in a Fable high pass before building)
| Option | How | Cost and risk |
|---|---|---|
| B1 Cut by id | Flagged lots and landmarks get a vertex attribute `cutId` in the merged batches (0 for everything else); the building materials, the depth pre-pass, the shadow pass and the hero contour's occluder mask all discard fragments above `GROUND_H` whose id is in a uniform list of up to 8 active ids. Cut faces show the inside: back faces drawn dark as the cap | Precise per building, no extra draw calls; touches `batch.ts` (one more attribute everywhere, +4 bytes per vertex) and every pass's material (`onBeforeCompile`). Must keep shader count constant |
| B2 Separate upper batches | Flagged objects' upper floors go into their own small batch per chunk and material; `visible = false` while the hero is in a trigger zone | No shader work; extra draw calls (one per material per chunk with flagged objects) and the whole chunk's flagged uppers vanish together |
Trigger zones (data): `Lot.cut` / `Landmark.cut` polygon (the courtyard, or the area north of a landmark within about 20 m). Both options must also drop the cut part from the hero-contour occluder mask, or the contour would show behind invisible walls.


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
