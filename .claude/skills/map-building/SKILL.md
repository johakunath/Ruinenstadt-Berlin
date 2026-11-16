---
name: map-building
description: Use when creating, extending or changing a district map (layout, streets, buildings, water, heights, light, ground, props, Späti, encounters) in Ruinenstadt Berlin. Loads the map guideline, Johannes' standing map requirements and the Köpenick lessons.
---

# Map building

1. Read `docs/maps/guidelines.md` in full: steps, Johannes' standing requirements, layout rules, invariants, lessons, performance. It is the source of truth; this skill only points to it.
2. Read the reference map `docs/maps/koepenick.md` and the code it names (`src/data/map.ts`, `src/data/koepenick.ts`, `src/render/map-world.ts`) before writing a new district.
3. Open visual decisions (layout, a new building type, ground look): SVG mockup with clearly distinct alternatives in the chat first, then build what Johannes picks.
4. Textures: build with code-painted placeholders, then add a row to `docs/asset-pipeline.md` for Codex.
5. Before the PR: the invariant tests pass at scale 1 and 1.3, screenshots of a street at night, one fight and each landmark, and a dated row under *Changes* in the guideline for every new rule.
