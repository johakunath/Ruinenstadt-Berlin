# M20 Tunnels between the maps, walkable camp at Warschauer Straße [Claude · Opus high]

Status: built (2026-11-18), playtest open.

## Decisions (Johannes, 2026-11-18)
| Question | Decision |
|---|---|
| Camp layout | A + C of `docs/mockups/m20-camp-layouts.svg`: `docs/mockups/m20-camp-combined.svg`. Hall below (inside), wide stairs up 3 m, open track yard above (outside) under the Warschauer Brücke; every station its own place |
| Flow | F1 of `docs/mockups/m20-tunnel-network.svg`: Köpenick freed opens the S3; the S3 ends at Warschauer Straße, which opens the camp. Before that no button and no menu leads to the camp |
| Station unlock | Build sites: Kommandantur, Schwarzmarkt (stash), Lazarett work on arrival; Zeughaus, Imbiss, Hackerspace, Exerzierplatz are rubble, built for Schrott and material. Levels 2 and 3 as in M13 |
| Tunnel | Layout B stays; the 2D route A content comes in (gratings, trader on the start platform, collapse with bypass, flooded stretch, hold the generator, signs); one generator for every line, only the S3 playable until its districts exist |

## Source (2D, read only)
`js/ubahn.js`: LINES, STN, NETP/NETL/NETB, `netSVG`, `tunCard`, `buildBase` (hall, old toilets as Lazarett, bakery as Imbiss, rings, the train to the network map), route A sections, `tunWin` ("Warschauer Straße ist jetzt dein Lager"); `js/camp-art.js` (station art per level); `js/data.js` CST.

## Built
| Part | Where |
|---|---|
| Network data: six lines, seven stops, routes and badges (2D 1:1); `campOpen`, `linePlayable`; cleared line = `LINE_FREED + k` in `camp.freed` | `src/data/lines.ts` |
| Camp map: floor polygons, walls, columns, stations (footprint = collider), rings, train, bridge; the yard is a terrace with one wide stair | `src/data/camp-map.ts` (`?map=lager`) |
| Peaceful level: no director, no spawner, no run content; powers and consumables are held back | `Level.camp`, `src/sim/sim.ts`, `src/main.ts` |
| Build sites and their costs, old saves keep stations whose workshop was used | `OPEN_STATIONS`, `SITE_COST`, `stationBuilt`, `siteLevel` in `src/sim/camp.ts` |
| Set: tiled hall with green columns and the yellow train, white-tiled old toilets, bakery behind a shop window, closed kiosk, shadow-only ceiling (the moon only falls down the stairs), concrete masses, the cutting wall with graffiti and houses above, yard tracks, brick arches and the bridge deck with lamps | `src/render/camp-world.ts` |
| Stations per level, keepers, name boards, rings | `src/render/camp-stations.ts` |
| Rings: the talk prompt names the place; F / Y / E or a tap opens the station window (only that station) or the network map | `src/main.ts` `campAct`, `src/ui/talk.ts`, `src/ui/camp.ts` (`open(id)`) |
| Network map at the train: ride to Köpenick (resumes a waiting checkpoint) or into a tunnel | `src/ui/netboard.ts`, `GO_KEY` in `src/options.ts`, `src/boot.ts` |
| Flow: Lager buttons (title, victory, death) only after the S3; the S3 victory leads out at Warschauer Straße; a visit to the camp keeps another map's checkpoint | `src/main.ts` (`showCampButtons`, `store`), `src/boot.ts` |
| Tunnel: 2D content and line generator | `src/data/tunnel.ts` and the files in its section below |

Tests: `src/data/camp-map.test.ts` (peaceful, every ring reached on foot, stairs, closed walls), `src/data/lines.test.ts`, `src/sim/camp.test.ts` (build sites), `e2e/save.spec.ts` (M20 flow and lock).

## Not in scope
Quests and Erfolge, station NPC dialogue, painted textures for the camp (Codex), a walkable route between tunnel and camp without a page load, other lines' districts.
