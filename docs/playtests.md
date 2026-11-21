# Playtests

Newest first. 2D history: `docs/playtests.md` in `johakunath/Ruinenstadt`.

## 2026-11-20 evening · Xhain, U8, Alexanderplatz (Johannes, Tab S9 touch, phone, PC pad; telemetry review 2026-11-21)

Live sheet: only two 3D player ids since the link went out (Johannes' PC and Tab S9), so no outside players yet. Telemetry review: [`telemetry/analysis-2026-11-21.md`](telemetry/analysis-2026-11-21.md).

| Point | Finding | Answer |
|---|---|---|
| Leistung on the tablet | No more fps, everything jittery and blurry (Görli, Rattenmutter, about 22:00) | Telemetry: render CPU 30 ms, scale down to 0.6, fps 25 like Ausgewogen. The tablet is CPU-bound. Dynamic resolution no longer drops when the CPU alone fills the frame; Leistung now skips the outline pre-pass (silhouette lines from the beauty depth), shadows every third frame, sharp 1.25× resolution |
| Default level | Leistung by default, Akkusparen not | Phones and tablets start on Leistung; Akkusparen stays off |
| Year of Xhain | 1981 wrong because the Wall stood? | Kept: the Wall stood 1961 to 1989, so 1981 fits the death strip, towers, Grenzer and East Berlin trams. Anachronism: the East Side Gallery murals were painted in 1990; in 1981 that hinterland wall was plain. Johannes decides |
| Reveals | Oberbaumbrücke and Alexanderplatz sights did not zoom out | Xhain had no reveal entries; Fernsehturm and Rotes Rathaus triggers were closer than the route passes (bot: 79 m and 18 m). Fixed, seven Xhain sights added |
| Under bridges | Hero and enemies hidden under the U1 at Schlesisches Tor (Spreehexe fight) and under Alexanderplatz sights | U1 station halls cut away above 2 m while the hero is under or behind them; Altes Museum, Dom and Kongresshalle cut like St. Thomas |
| Loading | „Lädt …“ only small at the bottom | Box in the middle with a turning hourglass |
| Leaving a freed map | After collecting the loot only the pause menu had Abschließen | The chip came back only on some paths; now a large Abschließen at the top middle, one confirm |
| Aufsätze | Only in the camp, the weapon had no option | Weapon card in the inventory fits and removes built Aufsätze anywhere |
| Camp after Xhain | Nothing to upgrade | A freed Xhain opens level 2 of every station without its survivor |
| Imbiss | Meals too strong | Erbsensuppe +20 % life, Currywurst +12 % damage, Kaffee +10 % tempo, Soljanka +1.5 life/s and +5 % resistance (about half) |
| Schwarzmarkt | The stash is not a black market | Renamed Depot |
| Tunnel drops | Too many | Bot: 13 to 21 items per 100 kills in tunnels against 7 to 11 in districts; tunnel item chances ×0.55 |
| Overpowered | Two hits for normal enemies and some bosses with gear | From tier 10 waves have fewer, tougher enemies (tier 19 ×1.45 life ×0.82 count, tier 38 ×2.4 and ×0.59; bosses get the life factor too). After 5 bot campaigns: each district after Köpenick +30 % enemy life and +25 % damage (bosses 40 % of the damage step), also events, guards and tunnels by their line (`docs/balance.md`) |
| New players (2026-11-21) | The first fights should teach, nobody should die there; the first boss easy; more loot until Köpenick is freed | First Köpenick run only: fights 1 and 2 at 55 to 60 % damage with a life floor of 8 %, fight 3 at 80 %, the Dammbrücke boss at 75 %, the rest at 85 %; at a quarter life the game pauses once for an „Ausweichen!“ card; items ×1.6, Schrott ×1.3 |
| Element effects | Burning, lightning, acid and slow hardly visible | Fable pass E1 (`docs/tasks/e1-element-visuals.md`): flame, acid puddle, shock arcs, slow ring as one instanced draw call |
| Bot | Should play like Johannes | Blessings by economy need, build and recent danger; heal pickups; Späti shopping; a camp step between districts (meals, Lazarett, workshop, drill, stations, Aufsätze, implant mode) |
| Network map | Spandau and Marzahn | Gone, the five stops fill the board |

## 2026-11-20 · Köpenick on build fa2d6f8 (Johannes, PC, pad, Qualität; telemetry and code review)

Two runs on 20 Nov (live sheet): a death at encounter 1 after 111 s (two shots, cause „Geschoss“), then a win in 20.5 min at 29 to 37 fps (59 to 60 on 16 Nov), p95 42 ms, up to 687 draw calls and 816k triangles. Tab S9 Xhain on 19 Nov: 30 fps. All fixed in the review PR unless noted.

| Point | Finding | Answer |
|---|---|---|
| Death at encounter 1 | The Hilferufe rescue always brought an elite Brocken, also at leg 1 before any Brocken wave; with Spaltend it fires three shots of about 29 on Normal (100 life) | Event enemies take only types the waves ahead bring; the rescue's elite is a Läufer early, a Brocken once Brocken come |
| Damage numbers | None for damage dealt, taken or healing (Johannes) | Ported from 2D (`src/ui/damage-numbers.ts`), switch in Optionen |
| Phone and tablet | Must run on phones; three settings unless something easier (Johannes) | Q1 three levels, dynamic resolution, crates culled near the hero (−146k triangles on the Köpenick start, Xhain start 553k → 168k), dinos and mechs culled, shadow rate in frames |
| PC | 144 Hz screen, no performance problem felt (Johannes). p95 values are multiples of 6.9 ms: the 60 fps cap alternates 2 and 3 refreshes, so p95 21 ms on 16 Nov was the cap, not a hitch | Qualität unchanged; headroom ideas in backlog P40; render CPU time now in the perf readout and telemetry |
| Soft-lock risk | Captive guards and event leftovers counted for the fight, so a stuck one could hold the last wave open | Fights count only their own enemies |
| After the boss | A death in the 6 s after the win or while exploring showed the death screen and retried the boss; the loot chip stayed | Victory clears enemy shots and zones; such a death shows the victory screen; the loot search ends on death |
| Telemetry | Fight `low` started from the life at fight start without saying so; shot deaths had no shooter | `h0` per fight, „Speier · Geschoss“; run `rms` (render ms) and `minScale` |

## 2026-11-17 · Köpenick on main before M12 (Johannes, PC, phone)

Played the build without the new enemies. Fixed at once (same PR as M12): see the last column. The rest is in `docs/backlog.md` (P rows) and `docs/tasks/m11d-map-realism.md`.

| Point | Finding | Answer |
|---|---|---|
| Crates | Some break, some do not, they look the same | Fixed: every crate and bin breaks |
| After a wave | Reward comes too abruptly | Fixed: 1.3 s breath before the blessing choice. Dialogue or a reward moment: backlog P7 |
| Enemy life | No small life bars | Fixed: bars over hurt enemies (gold when open, violet for elites) |
| PC interface | Map and inventory buttons not needed on screen | Fixed: hidden on every device; M, I/Tab, pad Y and the pause menu open them |
| Mobile | Should enter fullscreen, and a way back into it | Fixed: fullscreen on start on touch devices, Vollbild switch in the pause menu |
| Map marker | Red dot for the player is weak | Fixed: arrow in a ring on the big map (the minimap already had the arrow) |
| Controls | Show them per input device, take over the 2D controller layout | Backlog P1 (with U2) |
| Flicker | Textures flicker on the PC on Qualität until standing still | Backlog P2: needs the PC to reproduce; suspects are the temporal part of the post chain and anisotropy on the blended ground |
| World shapes | World and buildings too rectangular, in plan and in the ruin walls | Task M11d |
| Cars | More realistic models, Trabi | Backlog P3 (PC or Codex models) |
| Inventory | Double click or drag and drop to equip | Backlog P4 (with U1) |
| Trader | Item comparison missing; how on touch? | Backlog P5: tap selects and shows the comparison card beside the offer, second tap buys |
| Comparison | Layout and infos as in 2D, item level as the main number, coherent units | Backlog P6 (with U1) |
| Outlines | Enemies and NPCs behind buildings too, in other colors | Backlog P8 (extends R1) |
| Map | Sidewalks empty and too wide, streets too narrow and not like car streets; hard map limits; why generated and not hand-built? | Task M11d, with the answer on generation |
| Zoom | Three zoom levels, nice to have | Built for keyboard and mouse (Z, wheel); pad and touch: backlog P9 |
| Pickups | Own look per item type | Backlog P10 |
| Question | Map building effort in 3D compared with 2D | Answered in M11d |
| Ground | Clipping in the ground in many places, e.g. Müggelberge | Fixed at the cause: the drawn ground is flat between its 1.5 m grid points, but props, streets, buildings and characters stood on the curved height formula. All of them now use the mesh's own surface (`meshSurface` in `src/render/ground.ts`). Check on hardware; terrace edges may still need a pass (backlog P11) |
| Difficulty | Still too easy; growing stronger over the map feels rewarding | That build had three enemy types and bosses without attacks. M12 and the bot retune answer it: enemy life ×3.5 and damage ×2.1 over the 20 waves, bosses 2.4 to 4 times the life (`docs/balance.md`). Judge again on the new build |
| Enemies | Behaviour should differ more; does 2D have more? | M12 brings six types, elites and boss attacks. 2D has more: backlog P12 |
| After the boss | The "valuable loot still here" dialog comes the moment the boss dies, before anything can be picked up; and the run ends at once | Fixed: the boss falls, the district counts as won, the end screen follows after 6 s with "Weiter erkunden" (stay as long as wanted; Pause › Abschließen ends) and "Nochmal". The loot warning only comes when leaving |
| New game | A button to start fresh | Fixed: "Ganz neu anfangen" on the title (asks once). Wipes gear, Schrott and checkpoint; the telemetry id stays |
| Waves | A few more | Fixed: 27 normal waves instead of 20 (nine per zone), same difficulty range |
| Flicker | It was a yellow house wall | Backlog P2 narrowed: a facade layer on the plaster walls |
| West bridge | Clipping beside the Lange Brücke | Task M11d (bridge ramps and banks) |
| Water | Should lie below street level and look like water; wrecked boats at the banks | Task M11d |
| Streets, bridges | No asphalt look, no sidewalks | Task M11d |
| Sights | Not recognizable yet | Task M11d (landmarks) and H-tasks on the PC |
| M11d proposal | Agreed: hand-build the route blocks, generate the filler | Decided 2026-11-17 |

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
