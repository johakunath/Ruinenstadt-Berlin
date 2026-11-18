---
name: map-building
description: Use when creating, extending or changing a district map (layout, streets, buildings, water, heights, light, ground, props, Späti, encounters) in Ruinenstadt Berlin. Loads the map guideline, Johannes' standing map requirements and the Köpenick lessons.
---

# Map building

1. Read `docs/maps/guidelines.md` in full: steps, Johannes' standing requirements, layout rules, invariants, lessons, performance. It is the source of truth; this skill only points to it.
2. Read the reference map `docs/maps/koepenick.md` and the code it names (`src/data/map.ts`, `src/data/koepenick.ts`, `src/render/map-world.ts`) before writing a new district.
3. Open visual decisions (layout, a new building type, ground look): SVG mockup with clearly distinct alternatives in the chat first, then build what Johannes picks.
   Reuse and extend the kept mockups in `docs/mockups/` (street profiles, lot types and weather, side branches, tunnel layouts); draw over real map data (`docs/maps/<district>.svg`) where placement matters.
   Tunnels (M19) follow the *U-Bahn tunnels* section of the guideline (`src/data/tunnel.ts` is the reference).
4. Landmarks: follow `docs/maps/landmarks.md` (look at Wikimedia photos yourself, cheap subagents are not precise enough; cues below 5 m because of the camera; check with `tools/landmark-sheet.mjs`).
5. Textures: build with code-painted placeholders, then add a row to `docs/asset-pipeline.md` for Codex.
6. Before the PR: the invariant tests pass at scale 1 and 1.3, screenshots of a street at night, one fight and each landmark, and a dated row under *Changes* in the guideline for every new rule.
