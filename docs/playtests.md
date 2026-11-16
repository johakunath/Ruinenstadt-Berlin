# Playtests

Newest first. 2D history: `docs/playtests.md` in `johakunath/Ruinenstadt`.

## 2026-11-15 · Köpenick first look (Johannes, Tab S9)

Result: performance fine (over 90 fps, a bit warm). The map feels too big, empty and flat. Answers: `docs/migration.md` › M11b.

| Point | Finding | Answer |
|---|---|---|
| Size | `mapscale=0.8` walks better, could be smaller still | M11b: new tighter layout; scale below 1 breaks the current lots (tests fail at 0.8) |
| Life | Too few objects, no cars, nothing going on | M11b: cars, prop density per stretch |
| Buildings | Too uniform, too tall; Späti and streets always rectangular | M11b: more building types, non-rectangular footprints and streets |
| Walkable area | Streets too wide, unclear where the hero can walk | M11b: narrower streets, curbs, fences, bollards |
| Terrain | Too flat; river banks are straight edges | M11b: more relief, irregular banks and quays |
| Ground | Plain rectangles | M11b: ground textures, alternatives first |
| Occlusion | The proximity transparency bubble also triggered beside objects and looked strange (Johannes, 2026-11-16) | Replaced with opaque large objects and an occluded hero contour; small props, enemies, lamps and trees excluded (PR #14) |
| Trees | Shadow incomplete | Fixed: trunks always cast shadows, larger shadow area |
| Späti | Should be enterable (as in 2D: safe room) | M11b |
| Minimap | Missing | M11b, mockup first |
| Navigation | 2D edge triangles were better | M11b: port 2D edge triangles |
| Heat | 90+ fps on a 120 Hz tablet | Fixed: 60 fps cap |
| Map | Could not close on touch | Fixed: touch layer swallowed taps |

## 2026-11-15 · Gate 1 (Johannes, PC, phone, Tab S9)

Result: passed for feel and performance. Look fixed afterwards (plan 3D13). Later answers (run structure, weapon order, map size): `docs/migration.md` › Decided.

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

### Answers to the gate 1 questions

| # | Question | Answer |
|---|---|---|
| 1 | Look | Fixed: one look from the three (plan 3D13), screenshot `docs/gate1/look-final.jpg` |
| 2 | Camera | Keep 44°, maybe slightly flatter. Tall buildings must not block the view (backlog B4) |
| 3 | Finisher | Keep. One finisher per weapon later |
| 4 | Hits never interrupt the hero | Keep |
| 5 | Dodge through enemies | Keep |
| 6 | Hero readability | Good. Dark areas get a head lamp or torch (backlog B7) |
| 7 | Hero base | Woman with tied-up dark hair, female base body: confirmed |
