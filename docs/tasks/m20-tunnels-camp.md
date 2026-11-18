# M20 Tunnels between the maps, walkable camp at Warschauer Straße [Claude · Opus high]

Status: built (2026-11-18), playtest open.

## Decisions (Johannes, 2026-11-18)
| Question | Decision |
|---|---|
| Camp layout | A + C of `docs/mockups/m20-camp-layouts.svg`: `docs/mockups/m20-camp-combined.svg`. Hall below (inside), wide stairs up 3 m, open track yard above (outside) under the Warschauer Brücke; every station its own place |
| Flow | F1 of `docs/mockups/m20-tunnel-network.svg`: Köpenick freed opens the S3; the S3 ends at Warschauer Straße, which opens the camp. Before that no button and no menu leads to the camp |
| Layout change (after the mockup) | Hackerspace inside (old bakery behind the shop window), Imbiss outside in a viaduct arch; the yard mirrored: a railway viaduct along the north (seen from the camera), the freight car (Zeughaus) on the southern track, the signal box (Kommandantur) in the north on a loading ramp 1.5 m up with its own stairs. The top view in `m20-camp-combined.svg` shows the earlier placement |
| Station unlock | Build sites: Kommandantur, Schwarzmarkt (stash), Lazarett work on arrival; Zeughaus, Imbiss, Hackerspace, Exerzierplatz are rubble, built cheaply (50 to 80 Schrott, 1 to 2 material), so all stations open quickly. Levels take longer: level 2 needs the keeper (as M13), level 3 needs Alexanderplatz freed (2D LVREQ, the next planned district), so level 3 waits for that map |
| Tunnel | Layout B stays; the 2D route A content comes in (gratings, trader on the start platform, collapse with bypass, flooded stretch, hold the generator, signs); one generator for every line, only the S3 playable until its districts exist |

## Source (2D, read only)
`js/ubahn.js`: LINES, STN, NETP/NETL/NETB, `netSVG`, `tunCard`, `buildBase` (hall, old toilets as Lazarett, bakery as Imbiss, rings, the train to the network map), route A sections, `tunWin` ("Warschauer Straße ist jetzt dein Lager"); `js/camp-art.js` (station art per level); `js/data.js` CST.

## Built
| Part | Where |
|---|---|
| Network data: six lines, seven stops, routes and badges (2D 1:1); `campOpen`, `linePlayable`; cleared line = `LINE_FREED + k` in `camp.freed` | `src/data/lines.ts` |
| Camp map: floor polygons, walls, columns, stations (footprint = collider, optional floor height), rings, train, viaduct; the yard is a terrace with one wide stair, the loading ramp a terrace on it (`Terrace.base`) | `src/data/camp-map.ts` (`?map=lager`) |
| Peaceful level: no director, no spawner, no run content; powers and consumables are held back | `Level.camp`, `src/sim/sim.ts`, `src/main.ts` |
| Build sites and their costs, old saves keep stations whose workshop was used | `OPEN_STATIONS`, `SITE_COST`, `stationBuilt`, `siteLevel` in `src/sim/camp.ts` |
| Set: tiled hall with green columns and the yellow train, white-tiled old toilets, bakery behind a shop window, closed kiosk, shadow-only ceiling (the moon only falls down the stairs), concrete masses, the railway viaduct with brick arches (the Imbiss in one, the others boarded), an S-Bahn on its deck and lamps on its piers, the cutting wall with graffiti in the east, houses beyond, the southern track with a buffer stop, the loading ramp | `src/render/camp-world.ts` |
| Stations per level, keepers, name boards, rings | `src/render/camp-stations.ts` |
| Rings: the talk prompt names the place; F / Y / E or a tap opens the station window (only that station) or the network map | `src/main.ts` `campAct`, `src/ui/talk.ts`, `src/ui/camp.ts` (`open(id)`) |
| Network map at the train: ride to Köpenick (resumes a waiting checkpoint) or into a tunnel | `src/ui/netboard.ts`, `GO_KEY` in `src/options.ts`, `src/boot.ts` |
| Flow: Lager buttons (title, victory, death) only after the S3; the S3 victory leads out at Warschauer Straße; a visit to the camp keeps another map's checkpoint | `src/main.ts` (`showCampButtons`, `store`), `src/boot.ts` |
| Tunnel: 2D content and line generator | `src/data/tunnel.ts` and the files in its section below |

### Tunnel (2D route A content)
| Part | Where |
|---|---|
| `tunnelMap(line)`: every line reuses the S3 tunnel (layout B) and only renames it: stations, ghost station, line color (Johannes, 2026-11-18: recycle it for now) | `src/data/tunnel.ts` |
| Gratings after each fight (open on the win: heal drop, "Gitter offen"), no wave spawns behind a closed one | `Level.gates`, `src/sim/director.ts`, `src/render/tunnel-view.ts` |
| Trader on the start platform for the whole run; tunnels plan no events on the way (2D) | `Level.traderSpot`, `src/sim/runcontent.ts` |
| Collapse with a 4 m maintenance bypass; flooded stretch, walkers at 0.7 speed (2D `P.wet`) | `src/data/tunnel.ts`, `Level.speedAt` |
| Generator hold: 8.5 m ring, 35 s (2D 55 s), spawns from the mouth, elite at half, "Strom!", then Der Schaffner; end platform lights come on inside the fixed pool | `EncounterDef.hold`, `src/ui/tunnel-notice.ts` |
| Station signs and the line color stripe | `src/render/map-world.ts`, `src/render/paint.ts` |

Tests: `src/data/tunnel-m20.test.ts` (every line valid and winnable, gratings block), `src/ui/tunnel-notice.test.ts`. Screens: `docs/proof/m20-tunnel/`.

### Stations
Build site (rubble, tape, work lamp, "Bauplatz" sign) and three levels each, taken from 2D `js/camp-art.js`; keepers with their own outfit from level 2, shown within 15 m; one decal atlas (`paintCampAtlas`). Screens: `docs/proof/m20-camp/` (`final-layout-level3.png` is the final layout).

### Cost (cloud readout, Leistung, all stations at level 3, keepers there)
Hall 363 to 389 calls, 250k triangles; yard 333 to 399 calls, 214k to 282k triangles. Over the guideline (about 200 calls, 200k triangles) like Köpenick's heavy spots; keepers are about 40k triangles each with the shadow pass. Measure on the Tab S9 first; candidates: fewer keepers at once, merging each station's static meshes across stations, simpler keeper bodies.

Tests: `src/data/camp-map.test.ts` (peaceful, every ring reached on foot, stairs, closed walls), `src/data/lines.test.ts`, `src/sim/camp.test.ts` (build sites), `e2e/save.spec.ts` (M20 flow and lock).

## Playtest round (Johannes, 2026-11-18)
| Point | Fix |
|---|---|
| Ground clipping in the tunnel near the collapse | The bypass walkway's ends crossed the track bed diagonally; only slab pieces wholly off the track are drawn |
| Tunnels for all lines | Every line reuses the S3 tunnel, renamed |
| Lazarett and Hackerspace empty toward the camera | `CampLayout.decor`: toilet cubicles, sinks, cots and boxes; workbench, sofa, table with a laptop, arcade cabinet, cable reel |
| Rings | Footprint-sized, dim, at the keeper's feet (`stationRing`); rule in `docs/style-bible.md` |
| Tunnel walls flat and repetitive | Uneven faces, ribs, niches, cable tray, caged wall lamps; texture task T7 for Codex in `docs/asset-pipeline.md` |

## Open
- Playtest by Johannes; Tab S9 measurement of the camp (see Cost).
- Tunnel lines other than the S3 are checked by tests only (`?map=tunnel&line=k` shows them).
- The flooded stretch reads weakly in screenshots; the grating yellow looks slightly lime under the teal light.
- A save during the generator hold resumes before it.

## Not in scope
Quests and Erfolge, station NPC dialogue, painted textures for the camp (Codex), a walkable route between tunnel and camp without a page load, other lines' districts.
