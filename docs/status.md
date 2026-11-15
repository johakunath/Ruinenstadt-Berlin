# Status

Updated 2026-11-15 after the gate 1 build (first session). Plan and gates: `docs/plan-3d.md`.

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
| Looks | Gemalt, Comic, Tusche (`?look=`, options menu). Screenshots: `docs/gate1/` |
| Debug | `?debug=hit` (all shapes), `?debug=perf`, `?debug=flow`, `?stress=40`, `?cam=distance,pitch` |
| CI | Type check, 39 unit tests, build, 5 Playwright smoke tests, Pages deploy from `main` |

## Not verified or known weak

| Point | Detail |
|---|---|
| Real hardware | Nothing was run on a real GPU. PC and Tab S9 checks are open (gate 1 pass criteria) |
| Feel | Built from the #35 start values and clip measurements, not tuned by playing: the cloud browser runs at about 1 fps |
| Controller, rumble | Code path exists, never tried with a pad |
| Touch | Checked in an emulated tablet only. Layout is provisional; #35 asks for a mockup |
| Sound | Synthesized, checked for errors only, not by ear |
| Hero | CC0 base body with painted clothing regions. The coat skirt can cut through the legs in wide poses. Custom hero is gate 2 |
| Zombies | The male base body in grey-green with rags. Readable, but not the gaunt board zombie |
| Dodge | The roll clip is squeezed into 0.24 s |
| Facades | The fixed camera shows ground floor and first floor; upper floors are mostly out of frame |
| Look and profile switch | Reloads the page |
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

## Open questions for Johannes

| # | Question |
|---|---|
| 1 | Which look: Gemalt, Comic or Tusche? |
| 2 | Camera: now 18.5 m away at 44°. Closer for bigger characters, or flatter to show more facade? |
| 3 | Finisher is an overhead smash with a frontal cone (that is what the clip does). Keep, or a wide sweep? |
| 4 | Hits never interrupt the hero (Hades style, short slow instead). Keep? |
| 5 | The dodge passes through enemies. Keep? |
| 6 | A soft fill light travels with the hero for readability. Acceptable, or should the hero carry a visible lantern? |
| 7 | Hero base for gate 2: the board shows a woman with tied-up dark hair; gate 1 uses the female base body. Confirm before the custom hero starts |

## Next (gate 2 in the plan)

Custom hero with outfits and weapons, #35 combat flow tuned by playing and written to `docs/combat-feel.md`, touch layout mockup, one custom Köpenick ghoul.
