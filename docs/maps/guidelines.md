# Map building guidelines

How every district map is made, so all maps grow in the same direction no matter who builds them (Claude, Codex, another session). Living document: add a dated row under *Changes* when a rule changes. Started 2026-11-15 with Köpenick (`koepenick.md`), the reference map.

## Steps

| # | Step | Output | Who decides |
|---|---|---|---|
| 1 | Concept: 2 to 3 clearly distinct layouts as SVG mockups (route, zones, encounters, landmarks, size) | Mockup in chat | Johannes picks |
| 2 | Geography check against OpenStreetMap (below) | Table in `docs/maps/<district>.md` | |
| 3 | Data: anchors, streets, water, areas, landmarks, encounters, hills, terraces in `src/data/<district>.ts` | Map SVG from the data (`map-svg.test.ts`), shown in chat before the 3D build | Johannes can redirect |
| 4 | Build: landmarks in code, generated lots, props, heights, light, ground (code-painted placeholders) | Screenshots of each landmark, one fight, one street at night | |
| 5 | Tests: the invariants below, at scale 1 and 1.3 | `npm run check` green | |
| 6 | Textures: Codex generates the images for the new surfaces (`docs/asset-pipeline.md`), Claude does the performance pass | Rows in the asset queue | |
| 7 | Playtest on PC and Tab S9 (`?debug=perf`, `?mapscale=`) | Row in `docs/playtests.md` | Johannes sets size and difficulty |

Any new visual whose form is open (layout, minimap, ground look, a building type) gets clearly distinct alternatives as an SVG mockup in the chat first; build after Johannes picks. Routine work inside a picked direction: build, show, continue.

## Johannes' standing requirements (collected 2026-11-15 to 2026-11-16)

| Topic | Requirement |
|---|---|
| Size | Tight, not empty: walking always leads somewhere within seconds. Köpenick v1 (510 × 428 m) was too big; v2 at about 0.6 of the distances works |
| Life | Every stretch of street has something: buildings, cars, props, light. No plain rectangles of ground |
| Walkable space | It must be obvious where the hero can walk: narrow streets with curbs, fences, bollards |
| Edges | No invisible walls, ever. A blocking edge is a visible object (construction fence, roadblock, building, water) or the fight ring |
| Ruins | It is a ruined city: about half the ordinary buildings are burnt-out shells; intact ones have only a few faint lit windows |
| Light | Alive at night: where one light pool ends the next begins, almost no fully dark area (the gate 1 market square is the reference). Street lamps beside the street, spaced, a third broken; the rest from fires, construction lamps, candles, Spätis, windows |
| Vehicles | Real sizes (a bus is about 11 m), detailed enough to read; trams on tram tracks; a ferry is a real boat that shuttles and carries the hero |
| Route | Not purely linear: short side branches with surprises (M16b). A loop that never walks the same street twice |
| Rest | One enterable Späti per zone beside the route (rest stop, later the trader) |
| Look | Fits the style bible; textures may be somewhat more realistic than the comic boards. Recognizable Berlin details |
| Reuse | Recycle the 2D game's rules, numbers and art wherever they fit the 3D gameplay |

## Geography check (do it for every map)

1. List every landmark, bridge, river point and zone anchor the map uses.
2. Look up each one on OpenStreetMap: Nominatim search, `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<name>, Berlin`, one request per second, a generic user agent, no personal data in the request.
3. Convert to meters from the district's origin landmark (Köpenick: the Rathaus): `east = Δlon × 111 320 × cos(lat)`, `north = Δlat × 111 200`. Map axes: +X east, +Z south (so `z = −north`).
4. Write a table: place, real offset, map offset, note. Each direction must match (same compass octant); order along a line must match (what is between A and B stays between). Distances may be compressed freely and non-uniformly.
5. A place that is really in another district may be pulled in as a neighbour (Spreepark → Köpenick); say so in the table.
6. Mark what was **not** checked (side streets, small layouts) as placeholder.

## Layout rules

| Topic | Rule |
|---|---|
| Structure | A hub (the district's center, e.g. Altstadt) and 2 to 3 zones around it. Route visits each zone, then returns to the district landmark for the final boss |
| Size | Author at scale 1 with the `scale` factor (distances stretch, building sizes do not, water widths with √scale). Köpenick v2 at scale 1: 318 × 304 m, route about 840 m (2.3 min of pure running); v1 at 510 × 428 m felt too big and empty. Keep the hub at real building scale and pull the zones in. Tests run at 1 and 1.3 |
| Length | A full district may take 15 to 20 minutes (Johannes, 2026-11-15). A checkpoint per zone comes with the save (M6) |
| Encounters | Circle radius 13 to 16 m, at least 80 % open ground (test), no terrace edge or water inside. 2 to 3 waves each. Fixed place, triggered only when it is the objective |
| Waves and bosses | Wave count per zone is decided per district (Köpenick 6/7/7). One boss per zone, the district boss last at its landmark. Difficulty follows `waveTier` (one curve per district, rising) |
| Bosses | Der Schaffner belongs to the U-Bahn tunnels and is not used as a district boss. District bosses fit the district's era and story (`docs/story.md`) |
| Space | Streets are the main paths; buildings line them (generated lots); arenas, landmarks and stairs stay free. Every stretch has something: buildings, cars or props (test). Prefer a loop route that never walks the same street twice |
| Streets | Main 7 to 7.5 m, side 5 to 6.5 m, paths 4 m, curbs on streets. Parked and abandoned cars, sidewalk props, fences in front of houses, bollards at bridge heads |
| Landmarks | Built in code with their recognizable silhouette first (tower, gables, roof shape, material color). 3 to 6 per district, each visible from the route |
| Heights (B3) | Soft hills up to about 8 m (walkable everywhere), terraces 1.5 to 3 m with retaining walls and stairs (walls block in the sim). Not inside an encounter circle. Good spots: summits, platforms overlooking an arena |
| Edges | No invisible walls (Johannes, 2026-11-15): every blocking edge is visible. Land at the map edge gets a construction fence, streets end in a roadblock; fights show their circle as a glowing ring; water is its own edge |
| Ruins | About half of the ordinary buildings are burnt-out shells (no roof, broken wall tops, empty windows, rubble). Intact ones have few lit windows (about 10 %) |
| Light | Street lamps at least 22 m apart and beside the street, about a third broken. Then a coverage pass (`fillLight` in `src/data/map.ts`): every street point has a light source within `LIGHT_COVER` = 8 m (test at scale 1 and 1.3, under 2 % dark samples). Fill kinds: construction lamps and grave candles (no flame) more often than fire barrels and campfires, so flames stay special. Lit windows on about 10 % of intact facades, Spätis and landmarks add their own. Köpenick: about 150 light sources |
| Side branches | Planned (M16b): 2 to 3 short dead ends per district with a surprise. Keep room for them when laying out a map |
| Camera | Ordinary buildings: ground floor plus 1 to 2 floors, L-shaped footprints and single-storey shops for variety. Walls and crowns between camera and hero use the see-through cutout |
| Light pool | 2 fire barrels and some cover per encounter. Only a fixed pool of point lights exists (Leistung 3, Qualität 7, the nearest to the hero); every light source also gets a ground glow decal and its flame, which carry the coverage cheaply. Never change the light count at runtime. New light colors cost a glow material per chunk: reuse fire `0xff8a3c` and lamp `0xffb060` |
| Water | Rivers as polylines, lakes as polygons, bridges as rectangles at least river width + 12 m long. Banks drop to the water plane. Natural banks wobble up to about 3 m; banks in cobbles or asphalt areas are straight stone quays; bridge and ferry heads keep the authored line |
| Ground | Variant C: grass, dirt, paving and leaf litter blended per area with soft borders, grass overgrowing paving, plus scatter (puddles, leaves, trash, rubble, weed tufts). Textures follow `docs/asset-pipeline.md` (code placeholder first, generated images by Codex) |
| Relief | Low rolling ground in parks and forests, flat on and beside streets, near water, buildings and landmarks |
| Rest stops | One Späti per zone beside the route, front on a street, away from encounter circles (test). Lit inside and outside, readable sign from the camera. Find spots with a probe over free land near each zone's route before placing |
| Buildings | Altbau 9 to 16 m wide, ground floor plus 1 to 2 floors, L-shaped in about 40 %, single-storey shops between blocks, houses slightly askew with front fences. Small props (lamps, rails, fences, crates) never get the see-through cutout, only buildings, landmarks and crowns |
| Vehicles | Cars every 7 to 14 m of street, off zone entries, stairs and landmarks. Wrecks: buses and vans on main streets, a tram on the tram line |

## Invariants (tests per map)

- Wave and boss counts per zone as decided; difficulty rises wave by wave.
- Start, zone entries and encounter centers walkable and free; encounter circles ≥ 80 % open.
- Bridges walkable; water and terrace walls block; stairs lead up.
- Generated buildings off streets and out of the water; a larger scale gives more lots.
- A scripted run reaches victory (`director.test.ts`).
- Every 20 m street stretch has something (under 10 % empty); lamps beside streets and 22 m apart; light coverage (under 2 % dark street samples at scale 1 and 1.3).
- No invisible walls: land at the map edge has a fence or barrier.
- One Späti per zone near its route; doors walk in, walls hold.

## Lessons from Köpenick (2026-11-15 to 2026-11-16)

| Lesson | Practice |
|---|---|
| Size first | Decide the size with a playable blockout and the minimap, not on paper. `mapscale` stretches distances only; a new layout beats scaling down (scale below 1 breaks lots) |
| Density is tested | "Every stretch has something", light coverage and edge fences are tests, so a layout change cannot quietly leave empty or dark areas |
| Data before render | Rules live in `src/data` (generators, colliders) so sim and renderer agree; the renderer only draws |
| Water | Natural banks wobble (up to about 3 m), town banks are straight quays; bridge and ferry heads keep the authored line so decks always reach land. The ground mesh slopes into the riverbed, so quay walls reach 1.5 m inland to hide it |
| Relief | Gentle (under 1.5 m) and only off streets, water, buildings and landmarks, cached on a grid because `heightAt` runs every frame |
| Moving things | A moving platform (the ferry) is a pure function of sim time; bodies on it move with it, including their rollback position |
| Placement | Hand-placed things (Späti, tram, landmarks) reserve space before the generators run; generators check water, streets, encounters, stairs and each other |
| Screenshots | Cloud screenshots render in software: take them one after another, teleport the hero, wait about 4 s, and take a second shot because the camera lags after a long jump. Measure performance only on the PC and the Tab S9 |
| 2D reuse | Read the 2D code for rules and numbers (`johakunath/Ruinenstadt`), map pixels to meters by dividing by 30, and check that each rule still fits the 3D structure (example: fights lock the hero into a circle, so the 2D safe-room rule became a rest stop) |

## Performance

Headless numbers are not representative. On Leistung keep a typical view under about 200 draw calls and 200k triangles in the cloud readout until the Tab S9 says otherwise; the Tab S9 measurement sets the real limit and the map size.

## Changes

| Date | Change |
|---|---|
| 2026-11-15 | Started with Köpenick: geography check, layout rules, heights, invariants |
| 2026-11-15 | No invisible walls, half ruins, fewer and broken lamps, side branches planned (Johannes) |
| 2026-11-16 | Irregular banks and quays, relief, ground variant C, Späti rest stops (M11b part 2) |
| 2026-11-16 | Johannes' standing requirements, light coverage rule (`LIGHT_COVER` 8 m, test), lessons from Köpenick, skill `.claude/skills/map-building` |
| 2026-11-15 | Köpenick v2 (M11b, playtest): tighter size, loop route, narrower streets with curbs, lower and L-shaped buildings, shops, cars and props on every stretch (test) |
