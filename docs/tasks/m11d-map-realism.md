# M11d Map realism: streets, sidewalks, shapes, limits [Fable 5.2]

Status: open, next task. From the playtests of 2026-11-17 (Johannes: "use Fable for a map upgrade"; proposal below agreed the same day). Read `docs/maps/guidelines.md` and the `map-building` skill first. Look alternatives before building (critical visual decision).

## Findings

| Point | Today | Wanted |
|---|---|---|
| Streets | 5 to 7.5 m wide, read as paths | Real car streets: two lanes plus parking (main about 11 to 14 m, side 8 to 9 m), lane marks, curbs, crossings, manholes, tram in the middle of the main street |
| Sidewalks | Wide and empty | 2.5 to 4 m, filled: trees in pits, bikes, signs, bins, Litfaßsäulen, parked cars at the curb |
| Shapes | Lots, blocks and ruin walls are boxes | Chamfered corners, bays, setbacks, courtyards open to the street, ruin walls with a broken, stepped outline; streets that bend |
| Limits | Fence and roadblocks at the edge | Closed fronts: building rows, dense hedges, rubble walls, water; no walk into nothing |
| Street surface | Streets and bridges do not read as asphalt with sidewalks | Asphalt carriageway with marks and patches, raised paved sidewalks with curbs on both sides, also across bridges (railings, lamps) |
| Water | At street level, a flat dark plane | Surface clearly below the quay and bank (1.5 to 2 m), quay walls and sloped banks down to it, moving reflective water (cost stated for Leistung), wrecked and moored boats at the banks |
| Clipping | Ground cuts through beside the Lange Brücke (west bridge); slopes were fixed in general on 2026-11-17 | Bridge ramps, abutments and banks meet the ground cleanly; walk every bridge and stair (backlog P11) |
| Sights | Landmarks are blockouts nobody recognizes | Rathaus (brick tower, the Hauptmann statue), Schloss, S-Bahnhof, Müggelturm, Riesenrad, Laurentius church built to be recognized from the game camera; reference photos first |

## Decided (Johannes, 2026-11-17)
Street profiles from `docs/mockups/m11d-street-profiles.svg`: **A Hauptstraße** (about 21 m) for the Bahnhofstraße, **C Allee with grass track** (about 19 m) from the Köllnische Vorstadt to the Spreepark, also with tram tracks; B Kiezstraße stays available for dense side streets. Owner: Claude (taken over from Fable on Johannes' word, 2026-11-17). Mockups are kept for later districts.

## Why the map is generated, and what to change

Today the district is authored by hand at the large scale (rivers, streets, areas, landmarks, encounters in `src/data/koepenick.ts`) and generated at the small scale (lots along the streets, props, trees, from a fixed seed). That kept six districts affordable and let the sim, the minimap and the render share one source. The cost shows in the playtest: generated lots look alike and stay rectangular.

Decided (Johannes, 2026-11-17): keep the data format, move the weight toward authoring. Hand-place the blocks and set pieces on the route (the 15 % of the map the player looks at for 90 % of the time), keep generation for the filler behind them, and give the generator real street profiles and non-rectangular footprints. A drawn map (SVG or a small editor page that writes `koepenick.ts`) is the step after that if hand-placing in code is too slow; decide after the first hand-built zone.

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
0. Water level and banks first (it changes every bridge and quay), then:
1. Three street profile alternatives as in-engine screenshots of one block at the Bahnhof (Johannes picks).
2. Street and sidewalk profile in the generator, lots pushed back to fit; Köpenick tests stay green.
3. Non-rectangular footprints and stepped ruin outlines.
4. Closed map edge.
5. Hand-built route blocks for zone 0; decide on the editor.
6. Landmarks, one at a time, each shown before the next.

## Done when
Johannes walks zone 0 and the street reads as a Berlin street.

## Handover (Opus 5.5, 2026-11-17)
- Step 2 for the two decided streets: `Street.profile` (`haupt`, `allee`) and `sidewalk`. Bahnhofstraße north of the bridge 14 m (lane dashes beside the tram, parking lines), Spreeufer 12 m with tram on a raised grass track and low curbs. Paved 3 m sidewalks, trees in pits every 9 m (not in fight circles or on the station forecourt), buildings behind the sidewalk. The Dammbrücke part keeps 7.5 m (bridge deck). Screens: `docs/proof/m11d/`.
- Other streets stay on the old profile until Johannes picks for them.

## Handover step 6, landmarks (Opus 5.5, 2026-11-17)
- Built in `src/render/landmarks.ts` from Wikimedia Commons photos (2D had only the Rathaus colours, reused): Rathaus (brick wings around a courtyard, slate and tile roofs, pinnacled show gables, corner tower with clocks and slate helm, stair turret, portal with green lanterns, Hauptmann statue, Ratskeller), Schloss (cream, ochre bays, risalit with segmental pediment, hip roof with flat top, balustrade, dormers, ball trees), St. Laurentius (brick nave, tower with clock and belfry, slender slate spire, apse), S-Bahnhof (three arches, clock, lanterns, S roundel, lettering, shop wings, platform canopy), Müggelturm (white storey bands, open deck, flat roof, pavilion, beer garden), Riesenrad (faded red, 40 gondolas, tension spokes, two A-frames, broken gondolas, booth), dinos (sauropod on its back, triceratops on its side, broken T-Rex).
- Data: Schloss 23 × 11 m along the island, Müggelturm footprint covers the pavilion, Riesenrad covers its legs (clearing 10 m), dinos now block (`Landmark.variant`).
- Camera finding: at 18.5 m / 44° the view shows about 6 m of height at the hero, so tower tops and the wheel never show in normal play. Cues sit low (portal, statue, arches, signs, roofs from above). Proposal for Johannes: a short camera pull-back when a landmark first comes into view.
- Check tool: `node tools/landmark-sheet.mjs out.png "kind=rathaus&views=quarter,front,game,top"`. Proof: `docs/proof/m11d/landmarks-day.jpg`, `landmarks-dinos.jpg`.
- Cost: merged per material per chunk; five new materials (slate, clock, S roundel, station lettering, Ratskeller), a few draw calls where they are in view. Not measured on the PC.
- Open: Johannes reviews each landmark on the phone.

## Handover step 0, Forum, reveal (Opus 5.5, 2026-11-17)
- Water 1.7 m below the street (`WATER_Y`, bed `BED_Y` in `src/data/map.ts`); quays reach the bed with a wet band; natural banks slope down over 4.5 m (relief grid, water mask, faster load than before); bridges get a stone body, piers to the bed and abutments, the ground under them is bed (Lange Brücke clipping gone); ferry hull and piers reach the water; about a dozen seeded boat wrecks (`buildBoats`). Water normal map scrolls in Qualität (one texture read on water pixels), Leistung unchanged.
- Forum rebuilt from photos: two granite blocks, mall street under a half-shattered glass vault, footbridge, tree.
- Reveal shot (Johannes' wish): `src/render/reveal.ts`, first time within 12 m of a landmark (also mid-fight), game paused, view from the front and above with name and hint until a tap, click, key or pad button, then back in; off for `?autostart`, `?at`, `?cam` and automated browsers unless `?reveal`.
- Guide for the next districts: `docs/maps/landmarks.md` (also in the map-building skill); Codex texture row T5 in `docs/asset-pipeline.md`.

## Handover step 3, footprints and ruins (Opus 5.5 subagent, 2026-11-17)
- Step 3: `Lot.shape` (`LotShape` in `src/data/map.ts`), picked per street Altbau/shop from the lot seed (`pickLotShape`, the generator's stream is untouched): open courtyard (two wings joined at the back), central or two corner risalits, deep door niche, whole front set back, plain; street corners get the chamfer. All cut out of the old rectangle; colliders are one box per front piece plus a 45° box per chamfer (`lotBoxesLocal`, test: no wall without collider, no collider in the air). Render: `blockFacades` walks the outline, polygon roof cap, doors in niches, courtyard back walls and chamfers. Ruins (any footprint): wall mass in stretches (cornice / upper floor / ground floor), stepped firewall gable on a flank, chimney stacks above the breaks, a broken cross wall, mitred corners, rubble at the foot of fallen stretches. 2D had only rectangles, nothing to reuse. Screens: `docs/proof/m11d/footprints-*.jpg`.
- Known: Node (tests) and Chromium differ in the last bit of `Math.sin`, so the seeded lot layout in the browser is not the one the tests check (e.g. lots near (92, -108) differ). Pre-existing; fix separately.
