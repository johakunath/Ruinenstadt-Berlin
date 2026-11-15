# Status

Updated 2026-11-15 after the gate 1 playtest. Plan and gates: `docs/plan-3d.md`.

## Köpenick (M10, M11 first version, 2026-11-15)

| Area | State |
|---|---|
| Map | Concept A from `docs/maps/koepenick.md`: S-Bahnhof → Bahnhofsviertel → Müggelberge → Spreepark → Rathaus. Data in `src/data/koepenick.ts`, map format and generators in `src/data/map.ts`. `?mapscale=` stretches distances; `?map=hof` loads the gate 1 courtyard |
| Fights | 13 encounters, 20 normal waves (6/7/7) and 4 placeholder bosses (Feldwebel, Turmwächter, Rex, Hauptmann) on the zombie body. Encounter director `src/sim/director.ts`: circle closes, waves on the rim, +30 % life per won encounter. Retry starts at the zone |
| World | Ground with water banks, Spree, Dahme, Müggelsee, Frauentog, Teufelssee, three bridges, street ribbons, generated Altbau blocks (gate 1 facades) and houses, instanced trees, palms and ferns in the Spreepark, landmarks built in code (Rathaus with tower, Schloss, St. Laurentius, S-Bahnhof, Forum, Müggelturm, Riesenrad, dinosaurs), lanterns, fire barrels and cover per encounter |
| Render | Chunks of 48 m (frustum culled), moon shadow follows the hero, fixed pool of point lights takes the nearest lamps, see-through cutout for walls and crowns between camera and hero (B4) |
| HUD | Objective with distance and arrow, wave banner, boss bar, map overlay (Karte, M), victory screen |
| Heights | Müggelberge and Dino-Hügel (soft hills), Riesenrad-Plattform and Kirchhügel (terraces with walls and stairs). Sim stays 2D; walls block in the walk grid |
| Weak | Only four height features. Landmarks are code blockouts, not final art. Trees are simple. Bosses have no own attacks. No gear progression yet, so later zones are harder than intended (KQ2). Headless only: 100 to 330k triangles and 140 to 230 draw calls on Leistung, not measured on the Tab S9 |

## Gate 1: what is in

| Area | State |
|---|---|
| Scene | Köpenick courtyard at night, built in code from `src/data/courtyard.ts`: three Altbau facades (plaster with exposed brick, stucco frames, balconies, lit and broken windows), Späti with shop windows, sign and awning, gateway, wall breach, yard wall with iron fence, BVG van, lanterns, fire barrel, sandbags, crates, bins, rubble, ivy, ferns, puddles |
| Light | Moonlight with shadows, teal hemisphere fill, warm point lights without shadows (Späti, fire, lanterns, gate lamp), emissive windows, bloom, fog, mist, embers, small night environment map |
| Characters | Hero and zombies from Quaternius CC0 packs on one skeleton, 17 clips. Hero dressed in code: coat with skirt, belt, pouches, red scarf on spring bones, dark hair, pipe with red ribbon |
| Combat | 3-hit chain (two slashes, overhead finisher), dodge with i-frames, dash strike, swept weapon arcs, one hit per target per swing, hitstop per weight, knockback, stagger, poise for the brute, 45 % damage cap, aim assist cone |
| Feedback | White hit flash, sparks, weapon smear that matches the hit arc, directional camera shake, impact sound on the damage step, rumble, ground telegraph for enemy strikes, hurt flash |
| Enemies | Three sizes (Schlurfer, Hetzer, Brocken), flow field plus separation, wind-up, strike, recover, stagger, death; spawner through three passages |
| Input | Keyboard and mouse, gamepad standard mapping, touch stick and two buttons; 180 ms buffer that survives hitstop |
| Profiles | Qualität and Leistung (`?profile=`, options menu) |
| Look | One fixed look: painted PBR, thin ink line, saturated grade, highlight shoulder, FXAA. Screenshot: `docs/gate1/look-final.jpg` |
| Debug | Optionen → Leistungsanzeige (or `?debug=perf`), `?debug=hit` (all shapes), `?debug=flow`, `?stress=40`, `?cam=distance,pitch` |
| CI | Type check, 40 unit tests, build, 5 Playwright smoke tests, Pages deploy from `main` |

## Not verified or known weak

| Point | Detail |
|---|---|
| Real hardware | Nothing was run on a real GPU. PC and Tab S9 checks are open (gate 1 pass criteria) |
| Feel | Built from the #35 start values and clip measurements, not tuned by playing: the cloud browser runs at about 1 fps |
| Controller, rumble | Code path exists, never tried with a pad |
| Touch | Checked in an emulated tablet only. Layout is provisional; #35 asks for a mockup |
| Sound | Synthesized, checked for errors only, not by ear |
| Hero | CC0 base body with painted clothing regions. The coat skirt can cut through the legs in wide poses. Custom hero is task H1 |
| Zombies | The male base body in grey-green with rags. Readable, but not the gaunt board zombie |
| Dodge | The roll clip is squeezed into 0.24 s |
| Facades | The fixed camera shows ground floor and first floor; upper floors are mostly out of frame |
| Profile switch | Reloads the page |
| Shadows | Static world and characters share one shadow map that renders every frame |
| Leistung | No dynamic resolution yet. Enemies use blob shadows |
| Asset download | `tools/fetch-assets.sh` follows the itch.io free download flow and breaks if that changes |

## Headless numbers (not representative)

Cloud Chromium with SwiftShader (software rendering, no GPU), 1280 × 720. Useful only as a relative check; measure on the PC and the Tab S9.

| Profile | Look | Enemies | fps | p95 frame | Draw calls | Triangles |
|---|---|---|---|---|---|---|
| Leistung | Gemalt | 20 | 1.8 | 1483 ms | 80 | 48k |
| Leistung | Gemalt | 40 | 1.6 | 1633 ms | 80 | 48k |
| Leistung | Comic | 40 | 2.0 | 1300 ms | 89 | 67k |
| Qualität | Gemalt | 40 | 0.5 | 6133 ms | 211 | 270k |
| Qualität | Tusche | 40 | 0.4 | 13416 ms | 575 | 712k |

Draw calls and triangles depend on how many enemies are in view at that moment. Sim cost in Node: 0.05 ms per step with 20 enemies, 0.07 ms with 40.

## Gate 1 playtest

Passed 2026-11-15. Findings and answers: `docs/playtests.md`.

## Next

Gates 2 and 3 are replaced by `docs/migration.md` (plan 3D14).

| Order | Work | Where |
|---|---|---|
| 1 | M1 item data port, then M2 item logic (`docs/tasks/`) | Cloud, Codex |
| 2 | Köpenick playtest on PC and Tab S9 (`?debug=perf`), then M11 art pass and heights | Johannes, then Claude |
| 3 | S1 sound port from the 2D game, S2 enemy sounds | Cloud |
| 4 | M3 to M6: stats, loot, inventory, save with wave checkpoint | Cloud |
| 5 | H1 custom hero, H2 Köpenick ghoul | PC with Blender |

Backlog: `docs/backlog.md`.
