# Status

What is in the game now. Updated 2026-11-16. Next work: `docs/migration.md` › Queue.

## In the game

| Area | State |
|---|---|
| Map | Köpenick v2, concept C "Rundweg" (`docs/maps/koepenick.md`): S-Bahnhof → Bahnhofsviertel → Müggelberge → ferry over the Dahme → Johannisthal → Spreepark → Rathaus, about 0.6 of v1. `?mapscale=` stretches it; `?map=hof` loads the gate 1 courtyard |
| Fights | 13 encounters, 20 waves, 4 placeholder bosses (Feldwebel, Turmwächter, Rex, Hauptmann) on the zombie body without own attacks. Director: circle closes, waves on the rim, +30 % life per won encounter, retry at the zone |
| World | Water with irregular natural banks and stone quays in town (Spree, Dahme, Müggelsee and lakes), overgrown ground (grass, dirt, sidewalk plates, leaves blended; puddles, litter, weed tufts), low relief in parks and forests, a Späti rest stop per zone (enter, heal between fights), three bridges, a ferry boat that shuttles across the Dahme, tram tracks and a tram wreck, about half the buildings as ruins, fewer and partly broken lamps plus campfires, a fence and roadblocks at the map edge, a glowing ring around a closed fight, streets with curbs, buses, cars, sidewalk props, garden fences, L-shaped Altbau and houses, shops, trees, landmarks as code blockouts, cover. Heights: Müggelberge, Dino-Hügel (hills), Riesenrad-Plattform, Kirchhügel (terraces with stairs); sim stays 2D |
| Render | 48 m chunks, moon shadow follows the hero, fixed point-light pool, opaque world with a thin amber hero contour only behind large buildings/vehicles; small props, enemies, lamps and trees excluded. 60 fps cap. Look fixed (painted PBR, ink line, grade). Profiles Qualität and Leistung |
| Combat | 3-hit chain, dodge with i-frames, dash strike, swept arcs, hitstop, knockback, stagger, poise, aim assist. Gear scales damage, max HP, movement, attack timing, reach, resistance, regen, leech and dodge cooldown; seeded 2× crits. Enemies: Schlurfer, Hetzer, Brocken |
| Feedback | Hit flash, sparks, smear, shake, rumble, telegraphs, ported 2D synth effects and adaptive music (S1); persistent Musik toggle and volume |
| HUD | Objective with distance and arrow, minimap (tap opens the map), edge triangles to the objective and the last enemies of a wave, wave banner, boss bar, map (M), victory screen |
| Input | Keyboard and mouse, gamepad, touch stick plus attack, dodge, power and ultimate buttons; Inventar button, I/Tab or controller Y opens inventory (D-pad/stick, A select, B close) |
| Items | Data, rolls and combat stats connected (M1–M3b). Starter pipe in normal play; dev loadout setter for verification. 25-slot inventory with comparison, equip/unequip, locks, salvage and set descriptions; drops, pickup and the exit warning in Köpenick (M4) |
| Telemetry | One anonymous row per run (win, death, quit) to the 2D Google Sheet "Telemetrie": encounter reached, time, kills, damage taken, rest visits, per-encounter time, damage and fps, overall fps, p95, 1 % low, draw calls, profile, device class, input. Version `3d-…` in column v. Switch in Optionen. Delivery from the live game not verified yet |
| CI | Type check, 226 unit tests, build, Playwright smoke, Pages deploy from `main` |

## Latest migration (2026-11-16)

- S1 effects/music already ported; S2 enemy-specific synthesized cues with distance/pan built for current roster.
- M7 first pass: distinct class hit shapes, thrower projectiles and finishers; existing pipe clips remain provisional for other weapons.
- M8 first pass: 2 powers per class + ultimate; eligible 3-card blessings, family weights and supported duos; checkpoint persistence and run reset. Remaining perk/mod/duo effects: `docs/tasks/combat-audio-migration.md`.
- M9: touch power/ultimate, E/R and pad B/LB; blessing cards support keyboard/pad/touch. Consumables await M16.
- Prototype PC performance, pad/rumble and hero outline **accepted by Johannes**; no open acceptance item for them.

## Known weak or unverified

| Point | Detail |
|---|---|
| Hardware | Tab S9: over 90 fps on Köpenick before the 60 fps cap (2026-11-15). PC prototype performance accepted by Johannes (2026-11-16) |
| Feel | Prototype pad feel and rumble verified by Johannes (2026-11-16); new M7/M8 moves await playtest |
| Progression | Gear now comes from drops and breakable crates and bins (M4); M6 saves/checkpoints/difficulty and online sync built (live sync playtest open); camp/stash and balance remain open |
| Map | v2 and part 2 not playtested yet. T1 adds painted grass, dirt, sidewalk plates, forest floor and scatter, using the 2D art as generation references; code textures remain loading fallbacks. Tram rails have steel heads, inward grooves, guard edges, worn seams and joined bends; crossing curbs leave the corridor clear. The stopped tram is level and aligned to the east-track straight, with sixteen steel wheel contacts on the rail heads. PC/Tab S9 performance integration and playtest remain open (`docs/asset-pipeline.md`) |
| Art | Landmarks are blockouts, trees simple, CC0 hero (coat skirt clips in wide poses), zombie not the board ghoul, dodge clip squeezed to 0.24 s |
| Touch | Power/ultimate added to the existing layout; consumables follow M16 |
| Audio | Port mappings, PCM and lifecycle tested; listening review on PC/Tab S9 still open |
| Tech | Profile switch reloads the page; one shadow map for world and characters renders every frame; no dynamic resolution; `tools/fetch-assets.sh` depends on the itch.io download flow |

History of playtests: `docs/playtests.md`.
