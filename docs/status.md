# Status

What is in the game now. Updated 2026-11-15. Next work: `docs/migration.md` › Queue.

## In the game

| Area | State |
|---|---|
| Map | Köpenick concept A (`docs/maps/koepenick.md`): S-Bahnhof → Bahnhofsviertel → Müggelberge → Spreepark → Rathaus. `?mapscale=` stretches it; `?map=hof` loads the gate 1 courtyard |
| Fights | 13 encounters, 20 waves, 4 placeholder bosses (Feldwebel, Turmwächter, Rex, Hauptmann) on the zombie body without own attacks. Director: circle closes, waves on the rim, +30 % life per won encounter, retry at the zone |
| World | Water and banks (Spree, Dahme, Müggelsee and lakes), three bridges, streets, Altbau blocks and houses, trees, landmarks as code blockouts, lanterns, fire barrels, cover. Heights: Müggelberge, Dino-Hügel (hills), Riesenrad-Plattform, Kirchhügel (terraces with stairs); sim stays 2D |
| Render | 48 m chunks, moon shadow follows the hero, fixed point-light pool, see-through cutout on buildings, landmarks and crowns only, 60 fps cap. Look fixed (painted PBR, ink line, grade). Profiles Qualität and Leistung |
| Combat | 3-hit chain, dodge with i-frames, dash strike, swept arcs, hitstop, knockback, stagger, poise, aim assist. Gear scales damage, max HP, movement, attack timing, reach, resistance, regen, leech and dodge cooldown; seeded 2× crits. Enemies: Schlurfer, Hetzer, Brocken |
| Feedback | Hit flash, sparks, smear, shake, rumble, telegraphs, ported 2D synth effects and adaptive music (S1); persistent Musik toggle and volume |
| HUD | Objective with distance and arrow, wave banner, boss bar, map (M), victory screen |
| Input | Keyboard and mouse, gamepad, touch stick plus two buttons |
| Items | Data, rolls and combat stats connected (M1–M3b). Starter pipe in normal play; dev loadout setter for verification. Drops and inventory UI still pending |
| CI | Type check, 174 unit tests, build, Playwright smoke, Pages deploy from `main` |

## Known weak or unverified

| Point | Detail |
|---|---|
| Hardware | Tab S9: over 90 fps on Köpenick before the 60 fps cap (2026-11-15). PC not measured |
| Feel | Tuned from clip measurements, not by playing; pad and rumble never tried |
| Progression | Starter gear only in normal play; loot/equipment UI and progression balance remain open |
| Map | Too big, empty and flat for Johannes; v2 in M11b |
| Art | Landmarks are blockouts, trees simple, CC0 hero (coat skirt clips in wide poses), zombie not the board ghoul, dodge clip squeezed to 0.24 s |
| Touch | Layout provisional |
| Audio | Port mappings, PCM and lifecycle tested; listening review on PC/Tab S9 still open |
| Tech | Profile switch reloads the page; one shadow map for world and characters renders every frame; no dynamic resolution; `tools/fetch-assets.sh` depends on the itch.io download flow |

History of playtests: `docs/playtests.md`.
