# V1 Visibility behind buildings: back yards and enemy contours [Claude · Opus high; layout fork → Fable high]

Status: open. Playtest Johannes, 2026-11-17.

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
