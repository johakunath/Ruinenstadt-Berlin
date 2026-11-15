# Status

Updated 2026-11-15 after the gate 1 playtest. Plan and gates: `docs/plan-3d.md`.

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

## Gate 1 playtest (Johannes, PC, phone, Tab S9)

Result: passed for feel and performance. Look not chosen yet.

| Point | Finding |
|---|---|
| Leistung on phone and tablet | Smooth, slightly warm, less than other games. Fun |
| Qualität on tablet | No visible gain, stutters clearly, warmer. Camera jumped erratically left and down, partly off screen. Cause found: the shake spring diverged below about 18 fps (fixed, substepped, unit test) |
| Difficulty | Hard, 40 to 45 kills with effort. Fun that way; easier start later (backlog B5) |
| Input | Controller best, keyboard fine, touch fine. Touch does not need to be easier than controller |
| Hit feedback, attack | Works well |
| `?debug=perf&stress=40` showed nothing | Two parameters were joined with `?`; the second needs `&`. The readout is now a switch in Optionen (Leistungsanzeige) |
| Comic | Lines too thick on the tablet, aliased, feels slower. Light steps too hard: fire barrel and window blown out. Liked: saturated colors (BVG van, green) |
| Gemalt | Realistic characters look good without lines, but the low poly count shows more. Right shop window too bright |
| Tusche | Liked the light black outlines; want thinner lines, also aliased. Soft light partly blown out. Brush filter not liked; more saturation |
| Look direction | Between the three: Tusche outlines thinner, Comic saturation, Gemalt shading, no blown highlights. Must work for dark green Köpenick and the saturated districts (Bassprediger, cyberpunk, DDR Alexanderplatz) |

## Answers to the gate 1 questions

| # | Question | Answer |
|---|---|---|
| 1 | Look | Not yet: a mixed variant (see above) |
| 2 | Camera | Keep 44°, maybe slightly flatter. Tall buildings must not block the view (backlog B4) |
| 3 | Finisher | Keep. One finisher per weapon later |
| 4 | Hits never interrupt the hero | Keep |
| 5 | Dodge through enemies | Keep |
| 6 | Hero readability | Good. Dark areas get a head lamp or torch (backlog B7) |
| 7 | Hero base | Woman with tied-up dark hair, female base body: confirmed |

## Next (gate 2)

| Order | Work | Where |
|---|---|---|
| 1 | Look variants for the mixed look: 2 to 3 renders side by side, Johannes picks. Thinner outline (1 px at device resolution, antialiased), saturation up, highlights tone-mapped so windows and fire do not blow out | Cloud |
| 2 | #35 combat flow tuned by playing, written to `docs/combat-feel.md` | Cloud builds, Johannes plays |
| 3 | Custom hero: 2 test heroes (MPFB vs AI generator), then 2 outfits and 2 weapons | PC with Blender |
| 4 | Touch layout mockup | Cloud |
| 5 | One custom Köpenick ghoul | PC with Blender |

Backlog from the playtest: `docs/backlog.md`.
