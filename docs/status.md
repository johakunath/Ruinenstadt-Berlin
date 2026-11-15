# Status

What is in the game now. Updated 2026-11-15. Next work: `docs/migration.md` › Queue.

## In the game

| Area | State |
|---|---|
| Map | Köpenick concept A (`docs/maps/koepenick.md`): S-Bahnhof → Bahnhofsviertel → Müggelberge → Spreepark → Rathaus. `?mapscale=` stretches it; `?map=hof` loads the gate 1 courtyard |
| Fights | 13 encounters, 20 waves, 4 placeholder bosses (Feldwebel, Turmwächter, Rex, Hauptmann) on the zombie body without own attacks. Director: circle closes, waves on the rim, +30 % life per won encounter, retry at the zone |
| World | Water and banks (Spree, Dahme, Müggelsee and lakes), three bridges, streets, Altbau blocks and houses, trees, landmarks as code blockouts, lanterns, fire barrels, cover. Heights: Müggelberge, Dino-Hügel (hills), Riesenrad-Plattform, Kirchhügel (terraces with stairs); sim stays 2D |
| Render | 48 m chunks, moon shadow follows the hero, fixed point-light pool, see-through cutout. Look fixed (painted PBR, ink line, grade). Profiles Qualität and Leistung |
| Combat | 3-hit chain, dodge with i-frames, dash strike, swept arcs, hitstop, knockback, stagger, poise, aim assist. Enemies: Schlurfer, Hetzer, Brocken |
| Feedback | Hit flash, sparks, smear, shake, rumble, telegraphs, placeholder synth sounds |
| HUD | Objective with distance and arrow, wave banner, boss bar, map (M), victory screen |
| Input | Keyboard and mouse, gamepad, touch stick plus two buttons |
| Items | Data and rolls ported (M1, M2), not in the game yet: no drops, no stats from gear |
| CI | Type check, 99 unit tests, build, Playwright smoke, Pages deploy from `main` |

## Known weak or unverified

| Point | Detail |
|---|---|
| Hardware | Nothing measured on a real GPU. Köpenick on PC and Tab S9 open (`?debug=perf`). Headless: 100 to 330k triangles, 140 to 230 draw calls on Leistung |
| Feel | Tuned from clip measurements, not by playing; pad and rumble never tried |
| Progression | No gear yet, so later zones are harder than intended |
| Art | Landmarks are blockouts, trees simple, CC0 hero (coat skirt clips in wide poses), zombie not the board ghoul, dodge clip squeezed to 0.24 s |
| Touch | Layout provisional |
| Tech | Profile switch reloads the page; one shadow map for world and characters renders every frame; no dynamic resolution; `tools/fetch-assets.sh` depends on the itch.io download flow |

History of playtests: `docs/playtests.md`.
