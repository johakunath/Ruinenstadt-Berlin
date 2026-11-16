# M11d Map realism: streets, sidewalks, shapes, limits [Fable 5.2]

Status: open. From the playtest of 2026-11-17 (Johannes: "use Fable for a map upgrade"). Read `docs/maps/guidelines.md` and the `map-building` skill first. Look alternatives before building (critical visual decision).

## Findings

| Point | Today | Wanted |
|---|---|---|
| Streets | 5 to 7.5 m wide, read as paths | Real car streets: two lanes plus parking (main about 11 to 14 m, side 8 to 9 m), lane marks, curbs, crossings, manholes, tram in the middle of the main street |
| Sidewalks | Wide and empty | 2.5 to 4 m, filled: trees in pits, bikes, signs, bins, Litfaßsäulen, parked cars at the curb |
| Shapes | Lots, blocks and ruin walls are boxes | Chamfered corners, bays, setbacks, courtyards open to the street, ruin walls with a broken, stepped outline; streets that bend |
| Limits | Fence and roadblocks at the edge | Closed fronts: building rows, dense hedges, rubble walls, water; no walk into nothing |

## Why the map is generated, and what to change

Today the district is authored by hand at the large scale (rivers, streets, areas, landmarks, encounters in `src/data/koepenick.ts`) and generated at the small scale (lots along the streets, props, trees, from a fixed seed). That kept six districts affordable and let the sim, the minimap and the render share one source. The cost shows in the playtest: generated lots look alike and stay rectangular.

Proposal: keep the data format, move the weight toward authoring. Hand-place the blocks and set pieces on the route (the 15 % of the map the player looks at for 90 % of the time), keep generation for the filler behind them, and give the generator real street profiles and non-rectangular footprints. A drawn map (SVG or a small editor page that writes `koepenick.ts`) is the step after that if hand-placing in code is too slow; decide after the first hand-built zone.

## Effort compared with 2D (Johannes' question)

| Part | 2D | 3D |
|---|---|---|
| Layout (streets, areas, encounters) | Same data idea | Same; about equal |
| Buildings | One painted sprite per building type | Geometry, roofs, ruins and four visible sides per type: about 3 to 4 times the work per type, but one type serves every district with new materials |
| Ground and props | Painted tiles | Textures plus meshes; about double |
| Heights, stairs, sight lines, the camera behind houses | None | New work that 2D did not have |
| Per district after the first | Mostly new art | Mostly new materials and landmarks; cheaper than 2D once the kit exists |

Roughly: the first 3D district costs two to three times a 2D one, later ones about the same as 2D or less, because the kit and the generator carry over.

## Steps
1. Three street profile alternatives as in-engine screenshots of one block at the Bahnhof (Johannes picks).
2. Street and sidewalk profile in the generator, lots pushed back to fit; Köpenick tests stay green.
3. Non-rectangular footprints and stepped ruin outlines.
4. Closed map edge.
5. Hand-built route blocks for zone 0; decide on the editor.

## Done when
Johannes walks zone 0 and the street reads as a Berlin street.
