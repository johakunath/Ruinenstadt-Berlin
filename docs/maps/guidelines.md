# Map building guidelines

How every district map is made, so all maps grow in the same direction no matter who builds them (Claude, Codex, another session). Living document: add a dated row under *Changes* when a rule changes. Started 2026-11-15 with Köpenick (`koepenick.md`), the reference map.

## Steps

| # | Step | Output | Who decides |
|---|---|---|---|
| 1 | Concept: 2 to 3 clearly distinct layouts as SVG mockups (route, zones, encounters, landmarks, size) | Mockup in chat | Johannes picks |
| 2 | Geography check against OpenStreetMap (below) | Table in `docs/maps/<district>.md` | |
| 3 | Data: anchors, streets, water, areas, landmarks, encounters, hills, terraces in `src/data/<district>.ts` | Map SVG from the data (`map-svg.test.ts`), shown in chat before the 3D build | Johannes can redirect |
| 4 | Build: landmarks in code, generated lots, props, heights | Screenshots of each landmark and one fight | |
| 5 | Tests: the invariants below, at scale 1 and 1.3 | `npm run check` green | |
| 6 | Playtest on PC and Tab S9 (`?debug=perf`, `?mapscale=`) | Row in `docs/playtests.md` | Johannes sets size and difficulty |

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
| Camera | Ordinary buildings: ground floor plus 1 to 2 floors, L-shaped footprints and single-storey shops for variety. Walls and crowns between camera and hero use the see-through cutout |
| Light | Lanterns along streets (26 m main, 32 m side), 2 fire barrels and some cover per encounter. Light count is a fixed pool; lamps are spots |
| Water | Rivers as polylines, lakes as polygons, bridges as rectangles at least river width + 12 m long. Banks drop to the water plane |

## Invariants (tests per map)

- Wave and boss counts per zone as decided; difficulty rises wave by wave.
- Start, zone entries and encounter centers walkable and free; encounter circles ≥ 80 % open.
- Bridges walkable; water and terrace walls block; stairs lead up.
- Generated buildings off streets and out of the water; a larger scale gives more lots.
- A scripted run reaches victory (`director.test.ts`).

## Performance

Headless numbers are not representative. On Leistung keep a typical view under about 200 draw calls and 200k triangles in the cloud readout until the Tab S9 says otherwise; the Tab S9 measurement sets the real limit and the map size.

## Changes

| Date | Change |
|---|---|
| 2026-11-15 | Started with Köpenick: geography check, layout rules, heights, invariants |
| 2026-11-15 | Köpenick v2 (M11b, playtest): tighter size, loop route, narrower streets with curbs, lower and L-shaped buildings, shops, cars and props on every stretch (test) |
