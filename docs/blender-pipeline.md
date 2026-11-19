# Blender pipeline (PC)

Steps that need Blender on Johannes' PC, collected so they can be done in one sitting. Blender is not installed in the cloud. Everything that can be done in code or Node stays out of this list (rigid parts, palettes, the coat cut, simplifying CC0 meshes with `@gltf-transform/functions`).

How: `npm run assets:hero` runs `tools/blender/hero_build.py` headless (`$BLENDER`, PATH or the Windows default path; `docs/tasks/h1-hero.md`). A new piece is a function in `tools/blender/hero_clothes.py` next to `coat()` and `vest()`, joined into `hero.glb` as a node, then listed in `PIECES` (`src/data/hero-look.ts`).

Rule: a session that needs Blender adds a row here and does not wait; the code side builds against a fallback until the row is done.

## Queue

| # | Step | For | Fallback until done | Budget | State |
|---|---|---|---|---|---|
| B1 | `a_poncho`: rain poncho shell from the shoulders to mid-thigh (hem about 0.69 m), arms under it, open sides; weights like the coat skirt (`skirt_weights`) on the lower rows, `spine_03` and `clavicle_*` on top. Neutral vertex colours (palette sets teal); cyan glow bands are code parts | Regenponcho (`poncho`, WP4 step 2) | Coat with the teal palette and glow bands | ≤ 2,500 triangles, replaces `a_mantel` (0 extra draw calls) | to do (Johannes, 2026-11-19: Blender) |

Only if the code cut fails at build (a hem that cannot be cleaned on a skirt row):

| # | Step | For | State |
|---|---|---|---|
| B2 | `a_jacke`: coat body and sleeves, hem at the belt, own hem band | Lederjacke, BVG-Uniform | not needed unless WP4 step 2 reports it |
| B3 | `a_kurzmantel`: coat with the skirt ending at 0.69 m or 0.79 m, clean hem | Feuerwehrjacke, Kettenhemd der Zitadelle | not needed unless WP4 step 2 reports it |
