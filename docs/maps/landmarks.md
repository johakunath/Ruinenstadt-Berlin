# Landmarks: research and build guide

Learned on the Köpenick landmarks (M11d step 6, 2026-11-17). Read this before building a district's sights; `docs/maps/guidelines.md` stays the map source of truth. Reference code: `src/render/landmarks.ts`.

## Research

| Step | How | Why |
|---|---|---|
| 1. 2D repo | Search `johakunath/Ruinenstadt` for the landmark (`js/geo.js` `K.lm`, district asset files). Reuse colours and sizes | Köpenick: only the Rathaus existed (brick `#7a3a26`, copper roof, clock); everything else was new |
| 2. Photos | Fetch Wikimedia Commons images and **look at them yourself** (Read the JPG). Search: `commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=<name>`; download a 900 px thumb with `prop=imageinfo&iiprop=url&iiurlwidth=900`. Send a generic User-Agent, retry 429 with a few seconds of backoff, keep requests sequential | Photos gave everything that mattered: silhouette, roof material, window rhythm, colours, ground-level details (statue, lanterns, lettering) |
| 3. Text facts | Wikipedia only for orientation, height, dates, what stands where (e.g. "tower at the corner Alt-Köpenick / Rosenstraße", "Hauptmann statue beside the entrance") | Text rarely has geometry |
| 4. Write down | Per landmark: the 3 to 5 cues that make it recognizable, and which of them sit below 6 m | See the camera rule below |

**Do not delegate the look research to cheap subagents.** Sonnet and Haiku research came back thin and partly guessed ("unsure" on most geometry, wrong guesses such as a copper-green spire that is really dark slate). Use them only for the 2D code search. The model that builds the landmark looks at the photos.

Downloaded photos stay in the scratchpad: they are references, not game assets (no license row, never committed).

## The camera rule

The game camera (18.5 m, 44°, FOV 36, from the south) shows about **6 m of height at the hero** and only ground 8 m north of him. Tower tops, spires and the upper half of a wheel never appear in normal play.

| Consequence | Rule |
|---|---|
| Cues sit low | Each landmark needs readable cues below about 5 m: portal, statue, arches, lanterns, lettering, plinth colour, shop fronts. Köpenick: the Hauptmann statue, the S-Bahnhof arches with clock and S roundel, the Ratskeller sign |
| Roofs from above | Roofs are seen from above when the landmark is south of the hero: roof material and form carry identity (slate vs tile, balustrade on the Schloss, glass vault of the Forum) |
| Faces | The camera sees south faces well, east and west faces at a grazing angle, north faces never. Put the main cues on the face the route sees; keep the real orientation (K5) and move cues within it if needed |
| Real proportions anyway | Build towers to real proportions (compressed like the rest, about 0.75): the reveal shot and zoom show them |
| Reveal shot | `src/render/reveal.ts`: the first time the hero comes within 12 m of a landmark (also mid-fight), the game pauses, the camera swings in front and above and waits with name and "Tippen zum Weiterspielen"; a tap, click, key or pad button zooms back in. Add the kind's height to `SHOW` and its name to `NAMES` |

## Building

| Topic | Rule |
|---|---|
| Where | One function per kind in `src/render/landmarks.ts`; helpers there: `frustum` (hip, gable, pyramid, mansard roofs), `beam`, `pane`, `archWindow`, `showGable`, `limb`/`chain` for organic shapes |
| Footprint | `hx`/`hz` in the district data are the collider. Everything that stands on the ground must lie inside it or be walk-over low (< 0.3 m). Grow the footprint and run the seeded map tests instead of letting statues or legs stand outside it |
| Materials | Reuse the shared ones (brick, stucco, slate, roof, concrete, enamel, carPaint) with vertex tints. Use `stucco` for clean plaster: the `plaster` textures have heavy stains that read as spots on big fronts |
| Signs | Lettering and roundels as emissive canvas textures (`paintLettering`, `paintSRoundel`, `paintClock`); keep the glow low enough that letters stay readable |
| Cost | Everything merges per material per chunk; a new material adds one draw call where it is in view. No per-landmark lights beyond 2 to 3 pooled spots |
| Check | `node tools/landmark-sheet.mjs out.png "kind=<kind>&views=quarter,front,game,top"` (daylight, isolated, includes the game-camera view), then in game at night with `tools/screenshot.mjs`. Compare against the photo side by side |
| Proof | Day sheet into `docs/proof/<task>/`, one night screenshot per landmark from the route |

## Textures and Blender

| Tool | Use for |
|---|---|
| Code (Claude) | All architecture and fixed objects: footprint, collision and mesh share one source, merged draw calls, quick iteration. Placeholder textures painted in code |
| Codex (images) | Surfaces where a painted texture clearly beats the code painter (stone cladding, fibreglass skin, plaster with soft staining). Queue rows in `docs/asset-pipeline.md` |
| Blender | Skinned and animated meshes (hero, enemies, creatures, clothing). For a static object only when code primitives look clearly crude at the game camera (a detailed statue, a creature figure) |
