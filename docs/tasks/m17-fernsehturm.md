# M17 Fernsehturm finale, district 6 [plan: Claude · Fable high; build: Claude · Opus high]

Layout A „Aufstieg“ (Johannes, 2026-11-21). Order: Charlottenburg, Wedding, then this finale (map doc F9). The wait for Wedding is lifted (Johannes, 2026-11-23, below): steps 1 to 4 are built in one session, one PR per step. Concept, decisions F1 to F13, geography check, tower facts and proportions, deck table, boss, light, entry, cost and 2D reuse: `docs/maps/fernsehturm.md`. Mockups: `docs/mockups/m17-fernsehturm-layouts.html`, `docs/mockups/m17-tower-proportions.html` (PNGs beside them; schematic, the tables in the map doc rule). Templates: the tunnel (`src/data/tunnel.ts`, `src/render/tunnel-view.ts`) and the camp (`src/data/camp-map.ts`, `src/render/camp-world.ts`) for interiors, `docs/tasks/m16-charlottenburg.md` for the step format.

Notes are short; whoever builds a step writes its handover here (at most 8 lines).

## Johannes' decisions 2026-11-23

- Start now: Wedding's map, enemies and bosses are on `main` (PRs #81, #80). Wedding step 3 (sights, U9, Wedding title link) runs in another session and does not touch the finale. The link from Wedding's victory to the finale is built here (step 4).
- No open questions: J2 and every choice the files leave open are decided by the builder and recorded here. Step 2's look mockup is waived: the look comes from the two style boards in `docs/style/`.
- The tower ends finished: five decks, lift, ring fights, hands, echoes, Der Zeitwart with sounds, lines and Kodex, the ending choice (card and flag), the Telespargel, the flow (unlock, network stop, Wedding link, save and resume across decks, bot `--map=turm`, the campaign order in `src/bot/run.ts`). T5 and T9 may be dropped only by their fallback. Step 5 (Codex) and step 6 (Johannes) get rows only.
- Johannes allowed merging the step PRs after review and green CI.

## Corrections after reading Wedding (step 1, 2026-11-23)

| Assumption | Now |
|---|---|
| Telecafé waves 1920 only until Wedding is built | 1920 (Scherbentänzerin, Logenschreck, Souffleur) plus the three Wedding kinds (Tee-Ifrit, Baklava-Brocken, Teppichschlinger), from step 1 on |
| Telecafé echo: the Diva for now | **Sultan Nimmersatt**, the Wedding district boss: he is Der Ewige Gastgeber, the host of a revolving restaurant fits him exactly. The Diva stays out (one echo per deck pair) |
| Tier 48 to 70 (F8) | Holds: Wedding is 40 to 62, so +8 per district still gives 48 to 70. District strength 6 (`districtScale`) |
| `STOPS[5]` Wedding, `STOPS[6]` finale | Not on `main` yet: Wedding's stop comes with Wedding step 3 in the other session. Step 4 adds the finale stop after merging `main`; if Wedding's stop is still missing then, the finale stop gets its own unlock rule and does not depend on the index |

## Goal

A playable finale `?map=turm`: five decks inside the Fernsehturm, four fights, three echo bosses, Der Zeitwart, the ending choice. About 10 to 12 minutes.

## Steps (one session each)

| # | Step | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept A and B, mockup, geography check, plan | | Fable high | done 2026-11-21, A picked |
| S | Style boards for the [tower interiors](../style/fernsehturm.webp) and the [boss and gear](../style/fernsehturm-zeitwart.webp). Index in `docs/style-bible.md` | | Johannes, Codex | done 2026-11-21 |
| P | Tower proportions on map 3 | | | dropped: Johannes keeps the model as it is (map doc F13) |
| 1 | Engine, data, blockout. `MapDef.decks` and `deckWalk` (T1), the lift (T2), ring encounters (T3), clock hands (T4), revolving band (T5, drop first). `src/data/fernsehturm.ts` from the deck table, tests `src/data/fernsehturm.test.ts` (invariants below), a scripted run wins (`director.test.ts`). Wiring `?map=turm` (`options.ts`, `ui/maps.ts` `MapId`, `main.ts` banner). Blockout render: discs, sills, window band, cores, hands and rings on the FX layer; only the hero's deck visible. Stand-ins: echoes are the plain boss kinds, final boss `diva` | Wedding merged | Opus high | built 2026-11-23 (handover below) |
| 2 | Look. First a look mockup in chat from the style board (the sphere decks and the city image), Johannes confirms (waived 2026-11-23: built from the boards). Then: five interiors in `src/render/turm-world.ts`, the city image and cloud cards (T6), one `Sky` per deck (T7), the lift cut with the height counter, cutaway of the cores, window-break effect where a spawn enters. State the Leistung and Ausgewogen cost | 1, S | Opus high, mockup first | built 2026-11-23 (handover below) |
| 3 | Enemies and boss. Spec lines first (wave mix numbers, echo scale, Zeitwart numbers, calibrated with the bot), then build: `echo` modifier (T8), Der Zeitwart from the board (kit below, robot materials on the humanoid base, sounds, spoken lines, Kodex), the gear holds (T9), the ending choice (T10), the spear Telespargel (model, power, icon). Update `docs/enemy-pipeline.md` and `docs/equipment-pipeline.md` | 1, S | Opus high (a Fable pass only if Johannes dislikes the boss) | built 2026-11-23 (spec, calibration and handover below) |
| 4 | Flow. Unlock rule and network stop (map doc › Entry), Wedding victory link, save flag `ending`, ending cards, bot `--map=turm` and `mapLevelOf`, tier F8, signature drops, the Wedding kinds in the Telecafé waves. Run-save and resume across decks | 1, 3, Wedding built with its flow step | Opus medium | open |
| 5 | Textures: rows in `docs/asset-pipeline.md` (city image, interior atlas: enamel panels, steel ribs, dials, Telecafé cloth and signs; Zeitwart bust and the Telespargel icon if not rendered) | 2, 3 | Codex | open |
| 6 | Screenshots (each deck, a fight with the hand, the boss), playtest on PC and Tab S9; rows in `docs/tasks/pt-hardware-checks.md` (load time and memory with all enemy families, the lift cut hitch, hand readability, revolving floor feel, core cutaway) | all | Johannes | open |

Six build steps (1 to 6); S is a side item for Johannes and Codex.

## Anchors (scale 1, meters, +X east, +Z south)

Bounds x −30 … 510, z −30 … 30. `scale` is ignored for this map.

| Deck | Centre | Outer | Core | Fight (id, x, z, r, waves) | Other |
|---|---|---|---|---|---|
| foyer | (0, 0) | hexagon r 26 (apothem 22.5) | r 5, solid | foyer (0, −4, 15, 2) | start (16.8, −10.9) at the north-east door, 18 m from the fight centre; kiosk (−13, 15) as rest and trader, outside the circle; lift ring (0, 6.6) |
| schacht | (120, 0) | r 15 | r 5.5, open well, blocked | schacht (120, 0, 14, hold + 2 + echo `hauptmann`; Urzeit and 2089 kinds) | hold ring at (120, −10.5), r 3.5, need 35 s, every 2 s, mouth (131, 6) |
| panorama | (240, 0) | r 17 | r 5, solid | panorama (240, 0, 16, 3 + echo `spreehexe`) | hand: length 16, period 20 s |
| telecafe | (360, 0) | r 17 | r 5, solid; bar: 90° arc r 5 to 7.5, north | telecafe (360, 0, 16, 3 + echo `diva`; 1920 kinds, Wedding kinds later) | band r 8 to 14, one turn in 150 s; tables on the sill r 14.5 to 16.5; bar is the rest stop |
| uhrenraum | (480, 0) | r 17 | r 4, low | uhrenraum (480, 0, 16, boss `zeitwart`) | six gear seats at r 6 every 60°; hands 16 m / 12 s and 10 m / 30 s; main switch (480, −15) |

Lift door on the south face of every core; its ring 1.6 m and the arrival spot 2 m south of the door (the arrival lies inside the fight circle, so stepping out starts the fight). Numbers of hands, band and holds are start values for the playtest. Open share of the circles, computed: foyer 89 %, schacht 85 %, panorama 90 %, telecafe about 86 % with bar and tables, uhrenraum 94 %.

## Engine notes (decided here; check in the step named)

| # | Topic | Decision |
|---|---|---|
| T1 | Decks (step 1) | `MapDef.decks?: DeckDef[]` (`id`, `name`, `x`, `z`, `r`, `core`, `sides?` for the hexagon, `height` label, `sky`). `deckWalk(m, x, z, pad)` is true inside a deck's outline and outside its core; add it to the walk grid predicate in `src/data/map.ts` beside `tunnelWalk`. No lots, no streets, no lamps from generators; props come from a small `turmProps`. Collision stays 2D; decks lie 120 m apart |
| T2 | Lift (step 1) | `Level.lifts`: `{ from: Point; r: 1.6; to: Point; after: encounterId }`. Closed until `after` is won (reuse `Level.gates` for the door collider and its `gateOpen` event). Hero inside the ring for 0.8 s: `sim.lift` event, position set to `to`, drops stay behind, enemies still on that deck are removed (step 3: strays chased the hero through the floor). Deterministic, a unit test. Render: 0.6 s to black, height counter, sky and deck switch, back in. The bot walks to the ring as an objective |
| T3 | Ring encounters (step 1) | The encounter centre is the deck centre, inside the core, so it is not walkable. Check every use of `enc.x, enc.z` as a position (`?at=`, retry, resume, drops, the bot's teleport in tests) and use the deck's lift arrival spot there; or add `EncounterDef.at?: Point`. `rimSpot` already places spawns inside the circle rim, which is the window side |
| T4 | Clock hands (step 1) | `Level.hands`: `{ x, z, len, period, dir, width: 1.2, during: encounterId }`. Angle is a pure function of sim time. A body whose centre is within `width / 2` of the hand takes one hit per pass (1 s lockout): the hero through `hurtPlayer` (45 % cap holds, a dodge passes through), enemies through `strike` with a neutral source. Always drawn, with a faint wedge 0.6 s ahead. Tip speed at 20 s and r 16 is 5.0 m/s, the hero runs 6.2 m/s |
| T5 | Revolving band (step 1, drop first) | As the ferry (`src/sim/ferry.ts`, `stepSim`): bodies and drops whose distance from the centre is inside the band are turned by the band's angle each step, including the rollback position. No colliders on the band. Marked circles stay fixed in the world. Fallback: render only |
| T6 | City image (step 2) | One plane below the sphere decks on `FX_LAYER`, no shadow, not in the pre-pass; texture painted in code from the districts' map data at the bearings of the map doc; cloud cards in one instanced batch. Hidden in the foyer and the shaft (the shaft shows a dark well with a green glow) |
| T7 | Sky per deck (step 2) | Five `Sky` entries in `src/render/sky.ts`, switched while the lift cut is dark, so no blending and no dependence on Charlottenburg step 3a. The light count stays constant |
| T8 | Echo (step 3) | A modifier on an existing boss kind: life × 0.45, damage × 0.8, pale tint with a clock-hand outline, name „Echo: …“, no gear drop, no Kodex entry of its own. Loaded with the map only |
| T9 | Hold inside the boss fight (step 3) | The tunnel `hold` replaces the first wave today. New: a hold at a boss tier (66 %, 33 %), ring r 3.5, need 6 s, adds every 2 s, the boss untouchable until it fills, then stunned 3 s. Fallback: tiers as the Diva (`tiers: [0.66, 0.33]`) without a hold |
| T10 | Ending (steps 3, 4) | Two small rings (camp `stationRing` size) at the main switch after the boss dies; 1.5 s inside one decides. Save `camp.ending: 'gestellt' | 'gelassen'`, a card, then the victory screen. No rule change |
| T11 | Windows by bearing (step 2 or 3, optional) | A wave may limit its rim spots to a bearing range (E 68 to 98°, SE 112 to 140°, W 238 to 272°, NW 300 to 320°). Without it spawns use any rim spot and the coloured window sectors are dressing |

## Invariants (tests, scale 1 only)

- Five decks; 4 fights with 2, 2 (after the hold), 3, 3 waves; echoes in fights 2 to 4; the boss last. Difficulty rises wave by wave.
- Start, every lift arrival, every lift ring and the hold ring walkable and free.
- Every fight circle at least 80 % open (the core counts as closed).
- Flood fill from the start reaches only the foyer; each lift target reaches exactly its deck; nothing else is walkable (no invisible walls: every edge is a drawn sill, wall or core).
- A lift is closed before its fight is won and open after; a ride moves the hero and nothing else.
- A hand hits a standing body once per pass and never twice within its lockout; the hero's hit respects the 45 % cap.
- Band (if built): a body on it keeps its radius and gains the band's angle; off the band nothing moves.
- A scripted run reaches the ending; both endings set the flag.
- One rest stop on the way up (kiosk) and one before the boss (bar); doors walk in, walls hold.
- Light: every deck has a light within 13 m of any walkable sample (hand-placed, no generator).

Not applicable here and why: street density, lamp spacing, Späti per zone, lots, scale 1.3 (no streets, rooms keep real size).

## Boss and enemy outline (input for step 3; numbers there)

| Figure | Outline |
|---|---|
| Waves | Existing kinds only, two districts per deck (map doc › Flow). Zeitlose everywhere. Tier 48 to 70 over 10 waves |
| Echo des Hauptmanns, der Spreehexe, der Diva | T8. One per fight 2 to 4, as its last wave. The Telecafé echo may become the Wedding boss later |
| Der Zeitwart | Humanoid robot on the human base, with worn steel on the exposed head and neck. Gear in code (coat, cap, dial monocle, clock-hand arms, pendulum). Three phases by era pair (Urzeit and 1920, 1981 and 1989, 2089 and kommt bald), moves from `slam`, `pounce`, `fan`, `roots`, `bass`, summons; new: the blink (0.5 s warning circle at the landing spot). Gear holds T9. Resistances: propose shock weak (a clock), fire neutral, acid resistant |
| Lines (drafts, Opus finalises) | Start „Die Zeit steht. Das bleibt so.“ · Rage „Zurück auf Null!“ · Special „Schlag zwölf!“ · Kodex „Steht er im Werk: Zahnrad einsetzen.“ |

Text drafts: banner „Fernsehturm · Stillstand“; deck names „Foyer“, „Schacht“, „Panoramaetage“, „Telecafé“, „Uhrenraum“; hold „Notkurbel halten“; lift „Aufzug frei“; gear „Zahnrad eingesetzt“; choice „Uhr stellen“ / „Stehen lassen“; cards „Normalzeit. Berlin tickt wieder, auch das Alte.“ / „Die Stadt behält ihre Zeiten.“; win „Die Unruh ist dein“.

## Loot

| Item | Note |
|---|---|
| **Telespargel** (new legendary spear; Johannes asked for a tower legendary, 2026-11-21) | The name is the Berliners' nickname for the tower (OSM tag `nickname`). Look: the red and white antenna as the shaft, the steel sphere with its lit window ring as the guard below the tip, a brass gear rim, a red beacon at the point. Power „Zeitzeichen“: every twelfth hit stops all enemies within 5 m for 1.5 s (they stand between two seconds). Shock element. Drops only from Der Zeitwart, once for certain. Needs: base and length in `src/data/weapon-look.ts`, model in `src/render/weapons.ts`, power in `src/sim/combat.ts` with a test, icon, a row in `docs/equipment-pipeline.md`. Numbers (12 hits, 5 m, 1.5 s) are start values |
| Signature drops | The two tower legendaries from 2D, already in the game: Fernsehturm-Splitter and Auge des Fernsehturms, weighted up on this map |
| Set, optional, after B2 | „Montur der Normalzeit“: the timekeeper's kit (grey-blue work coat, brass dial plate, watch chains, gauntlet with a small hand). No transit livery (style rule of 2026-11-13). On the second style board as an idea only |

## Done when

- `npm run check` green with the new tests; `npm run e2e` smoke test reaches the foyer.
- `?map=turm&autostart` plays from the door to an ending on all three render profiles.
- Screenshots of each deck, one fight with a hand, the boss, both ending cards in `docs/proof/m17-fernsehturm/`.
- Asset indexes updated (`docs/enemy-pipeline.md`; `docs/equipment-pipeline.md` if an item is added).

## Not in scope

The Stadtbahn line 4, changes to the Alexanderplatz map, new ordinary enemies, a walkable tower outside, rule changes after the ending, layout B.

## Style boards (step S; Johannes gives these to Codex)

Why: every other district was built from a board; without one the interior look, the boss and the spear are guesses. Step 1 (engine, blockout) does not need them. Attach `docs/style/koepenick.png` (style and layout), `docs/style/charlottenburg.png` (final board layout) and `docs/style/alexanderplatz-pioneer.png` (GDR colours) to both prompts.

**Board 1.** [Fernsehturm · Stillstand](../style/fernsehturm.webp). Use it for the Telecafé, the views across the eras, and interior materials. The map spec defines the five playable decks and the six gear seats.

```
Generate ONE beautiful landscape RUINENSTADT game art direction board. Use the attached Köpenick board for STYLE only and the attached Charlottenburg board for the final-board LAYOUT; new content below. Painted comic, strong dark ink outlines, rich painterly texture, warm lights against cool teal shadows, gritty readable post-apocalypse, chipped enamel, cracked glass, soot, tarps, ivy. Not photorealistic, not 3D, no game HUD, no BVG branding or transit livery.

Title: FERNSEHTURM · STILLSTAND. Subtitle: Alle Zeiten zugleich. Fictional Berlin: the broken Zeitnormal clock froze every district in a different era; the Berlin TV tower was its antenna. The finale is played INSIDE the tower, on round floors around a central lift core.

Upper 60%, key scene: inside the revolving restaurant in the tower sphere, about 207 m up, at first light. A ring-shaped room around a round lift core, a long curved band of tall slanted windows, 1969 GDR space-age interior (steel ribs, brown and orange enamel panels, cobalt blue and warm yellow details), worn and half ruined. Brass clockwork of the Zeitnormal grows through walls and floor: gear trains, dials showing different times. Laid tables frozen mid-toast. A clear ring of floor in front as a readable combat space. Through the windows far below: Berlin from above, each district lit in its own time: dark green jungle with fog to the south-east, fire-orange streets and a wall line nearer, one patch of golden afternoon directly below to the east, magenta and cyan neon under a rain veil to the west, silver searchlights beyond it, gold and emerald lanterns to the north-west, the river Spree winding through all. The sun stands exactly on the horizon. A giant glowing clock hand sweeps across the room.

Lower 40%, dark teal concept panel: four small interior studies, each a round room seen from a high three-quarter view with the wall toward the viewer cut low: (1) FOYER at night, hexagonal entrance hall with folded concrete roof, souvenir kiosk with warm light, lift door with six empty gear sockets; (2) SCHACHT, inside the concrete shaft, a maintenance gallery around a dark open lift well, jungle vines and sparking cable trays climbing from below, an emergency hand crank; (3) PANORAMAETAGE before dawn, observation ring with telescopes and broken windows; (4) UHRENRAUM under the steel dome, a low brass clock movement in the centre with six gear seats and a balance wheel, two huge clock hands, a main switch. Props row: six different gear wheels (one per era), the balance wheel "Unruh", lift panel, hand crank, telescope, kiosk. Eight palette swatches: concrete white, steel blue-grey, brass, enamel orange, cobalt, signal red, dawn rose, night teal. Discreet title and subtitle.
```

**Board 2.** [Fernsehturm · Der Zeitwart](../style/fernsehturm-zeitwart.webp). Johannes approved the humanoid robot revision on 2026-11-21. The revision supersedes the human face in the original prompt below.

```
Generate ONE beautiful landscape RUINENSTADT game art direction board. Use the attached Köpenick board for STYLE only and the attached Charlottenburg board for the final-board LAYOUT; new content below. Painted comic, strong dark ink outlines, rich painterly texture, warm lights against cool teal shadows, worn materials. Not photorealistic, not 3D, no game HUD, no BVG branding or transit livery. Dark teal concept panel background throughout, figures full body with clear silhouettes.

Title: FERNSEHTURM · DER ZEITWART. Fictional Berlin: the broken Zeitnormal clock froze every district in a different era; its last duty officer still guards the stopped clock in the TV tower sphere.

Left third, the legendary boss DER ZEITWART, front and back: a tall gaunt man, the last duty officer of the Zeitnormal, upright and severe, human, not a zombie and not a robot. Long grey-blue GDR work coat, peaked cap, a clock dial worn as a monocle, watch chains across the chest, a brass pendulum hanging on his back. His right arm ends in a long brass minute hand used as a blade, his left in a short heavy hour hand. Faint afterimages of himself trail behind him. Beside him three small colour variants of the same figure, one per phase: jungle green with silver glass, fire orange with pioneer yellow and blue, neon magenta with emerald and gold.

Middle third, top: an "Echo" enemy treatment shown on one generic boss silhouette: a pale washed-out double of a figure with a thin glowing clock-hand outline and a frozen second hand above its head. Middle third, bottom: the legendary spear TELESPARGEL, large and detailed, shown whole and as a close-up of the head: the shaft is the red and white banded antenna of the Berlin TV tower, below the tip sits the steel sphere with its ring of lit windows and a brass gear rim as the guard, a small red beacon glows at the point, worn and chipped.

Right third: the survivor (brown hair, always a red scarf, worn long brown leather coat, heavy boots) front and back wearing the set MONTUR DER NORMALZEIT: grey-blue timekeeper's work coat over the leather coat, brass dial chest plate, watch chains, one gauntlet with a small clock hand, a cap with a dial badge. Below: props (six gear wheels of different eras, the balance wheel "Unruh", a main switch with two positions) and eight palette swatches: concrete white, steel blue-grey, brass, enamel orange, cobalt, signal red, dawn rose, night teal. Discreet title.
```

## Questions for Johannes

| # | Question | Answer |
|---|---|---|
| J1 | A or B? | A (Johannes, 2026-11-21) |
| J2 | Boss: Der Zeitwart, holding the Unruh? | Humanoid robot look approved on board 2. **Yes, decided 2026-11-23 (builder, per Johannes' brief): the Unruh is his heart.** It ticks in an open brass housing in his chest and drops when he falls; the hero then sets it into the movement („Uhr stellen“) or keeps it out („Stehen lassen“). Why: the story already says a running clock ends him, so his heart is the part the clock lacks; the choice is about one visible object; the glowing balance wheel gives the robot a readable weak point; „Die Unruh ist dein“ reads as a drop |
| J3 | Does the ending change anything afterwards? | No: card and flag (took the recommendation) |
| J4 | Unlock with all other districts freed, no tunnel of its own? | Yes, the game is linear |
| J5 | Wedding window gag? | No: Wedding is freed by then; it is a played district before the finale |
| J6 | Tower proportions: variant 3 or 4? | Neither: the model in the game stays (Johannes, 2026-11-21) |
| J7 | Wedding first? | Yes. The Wedding map is on `main`. Johannes lifted the wait on 2026-11-23: Wedding's map, enemies and bosses are merged; its step 3 runs beside the finale |

## Handover 2026-11-21 (step 0) [Claude · Fable high]

- Two layouts drawn and compared with the Alexanderplatz map; A recommended, nothing confirmed. Ground-level options dropped because map 3 already makes the Rathausforum walkable.
- Bearings from the tower checked on OpenStreetMap (map doc); tower height and year from OSM tags; sphere size, deck heights and stairs are from memory and marked so.
- 2D has no finale map; reused story, the tower drawing as reference, two legendaries, hold and gratings.
- Engine: decks, lift, hands and band are new sim parts with fallbacks (T5 and T9 can be dropped without losing the map).
- No code written. No hardware check rows yet: nothing is built.

## Handover 2026-11-21 (after Johannes' answers) [Claude · Fable high]

- A picked. New order with Wedding before the finale: six districts, six gears, tier 48 to 70, Wedding at bearing 310° in the windows; deck pairs are now Urzeit and 2089, 1981 and 1989, 1920 and Wedding; Telecafé echo is the Diva for now.
- Tower facts checked from a second source (map doc); the foyer door moved to the north-east, the real entrance side.
- Tower proportions compared (map doc › Tower proportions, mockup): the model is thicker than reality already, the foot lacks its flare; variants 3 and 4 wait for Johannes (step P).
- Style boards: two Codex prompts above (step S). Steps 2 and 3 wait for them, step 1 does not.
- New legendary Telespargel specified (Loot). The set was renamed away from a transit uniform.
- Wedding is not planned anywhere yet (J7); step 4 depends on it.

## Handover 2026-11-21 (third round) [Claude · Fable high]

- Tower model on map 3 stays as it is; step P dropped. The proportion mockup stays as the record.
- Wedding is in progress elsewhere. No finale build step before it is merged; step 1 then starts by reading Wedding and correcting the Telecafé waves, the echo choice, the tier and `STOPS`.
- Only step S (Codex style boards) can happen meanwhile.

## Handover 2026-11-21 (step S) [Codex · GPT-6]

- Both style boards are linked above and in the style bible. Stillstand covers the tower interiors and the multi-era view. Der Zeitwart covers the humanoid robot boss, the Echo treatment and equipment.
- Begin step 1 after M18 Wedding is complete and merged.

## Handover 2026-11-23 (step 1) [Claude · Opus high]

- `?map=turm` plays from the foyer door to the stand-in boss: `src/data/fernsehturm.ts` (decks, waves, layout), `src/sim/turm.ts` (lift, hands, band), `src/render/turm-world.ts` (blockout and moving parts), `src/ui/turm-curtain.ts` (dark cut with the height). 19 tests in `fernsehturm.test.ts` cover every invariant above, the scripted run included; smoke test M17.
- Engine choices: `EncounterDef.at` (walkable spot of a ring fight: travel, bot, spawn fallback) and `hold.at` (the crank ring off the deck centre); `travelTarget` leads to the opened lift. The lift needs no grating: the core is solid, the ring only counts once its fight is won. A ride also saves (`checkpoint`), so resume lands on the right deck.
- Changed from the anchors: band r 9.5 to 14 (was 8) so the bar's rest strip stays still; Telecafé echo Sultan Nimmersatt (above); hand hits: hero at least 16 % of life, enemies 30 %, bosses 3 % (start values). Review fixes: enemies take plain damage (`blastHit`, no hero multipliers or kill effects, not `strike`), and a body is hit once per pass of each hand (the slow hour hand near the core stayed on a body longer than the 1 s lockout).
- T5 and T9: T5 built in the sim (bodies, their rollback and drops turn; test). T9 is step 3.
- Not yet: one night sky for all decks, no city image, no cutaway of the cores (step 2). No new hardware rows: nothing to measure until step 2 has the look.

## Look choices (step 2, from the boards; no mockup by Johannes' brief)

| Topic | Chosen |
|---|---|
| Cores | Panorama and Telecafé: orange enamel drum (painted panels, rivets, rust chips) with a brown band, brass rims, six clock dials and four brass gears grown into it, portholes beside a brass-framed lift door (board 1 key scene). Foyer: concrete with a cobalt band and six empty gear sockets. Schacht: the open well with a brass railing and hanging cables, green glow far below. Uhrenraum: the low brass movement with gear trains and an empty centre socket (the Unruh) |
| Cutaway | No ceilings exist, so every core ends at the cut height 4.3 m with a dark lid, always; the hero contour shows the hero behind it. The dome ribs were tried and dropped (they read as stairs from the game camera) |
| Floors | Painted per deck: terrazzo with a red and cream star (foyer), steel grating (shaft), dark polished slate with curved seams (sphere decks), the Uhrenraum floor as a dial ring with hour marks; the Telecafé band as radial parquet between brass rails |
| Furniture | Cobalt benches and brass telescopes (Panorama), white-cloth tables with a candle and three glasses mid-toast in front of cobalt, mustard and red booths (Telecafé), striped red kiosk roof and a postcard shelf (foyer), red crank (shaft), switch box with a red lever and two consoles (Uhrenraum) |
| Light | Brass pendant shades; foyer warm white, shaft work lamps, green well glow and magenta and cyan cable trays (2089), Telecafé candles at table height |
| Skies (T7) | Foyer night, shaft almost black, Panorama deep blue before dawn, Telecafé rose, Uhrenraum gold with the sun on the horizon; snapped at the lift ride |
| City (T6) | `src/render/turm-city.ts`: every district at its OSM bearing, distance squeezed into a 520 m plane 46 m below the deck (the camera's far plane is 120 m): Alexanderplatz gold east, Xhain fire-orange with the Wall line south-east and Köpenick green fog behind it, Mitte magenta under rain west with Charlottenburg silver and searchlights behind, Wedding gold and emerald lanterns north-west, the Spree through all; tinted per deck, 18 drifting cloud cards. Hidden on the foyer (a dark forum instead) and in the shaft |

## Handover 2026-11-23 (step 2) [Claude · Opus high]

- Built from the two boards: look table above. New files `src/render/turm-city.ts`, `src/render/turm-paint.ts`; `turm-world.ts` rewritten; `TURM_SKIES` in `sky.ts`; a window bursts where a body spawns at the glass (Panorama, Telecafé, Uhrenraum); the lift curtain (step 1) counts the height.
- Cost: cloud readout on Leistung 61 to 76 draw calls, 29k to 49k triangles per deck; Qualität 121 to 191 calls, 100k to 176k triangles (the Telecafé is the largest). Textures about 25 MB with mips. No new light at runtime; five candles and the well glow join the pool.
- Proof: `docs/proof/m17-fernsehturm/step2-decks.png` (Panorama, Telecafé, Uhrenraum, foyer) and `step2-telecafe-uhrenraum.png`.
- Open for Johannes (hardware rows 57 to 59): look per deck, the city image, hand readability, the band, frame rate. Codex: texture row T11.

## Step 3 spec (2026-11-23) [Claude · Opus high]

| Topic | Numbers (start values; calibration below) |
|---|---|
| Waves | `turmWaveTier` in `src/data/fernsehturm.ts`: the Wedding formula (count ×0.65) at tier 48 to 70 over the 10 normal waves, at most 8 alive. Mix per deck: foyer Zeitlose (walker 6, runner 1.4, brute 0.6, spitter 0.8); Schacht walker 4, raptor 1.2, crow 0.8, Kabelghul 1, drone 0.8; Panoramaetage walker 4, Zünder 0.8, Schildträger 0.6, Heuler 0.6, rat 0.4, Uhrwerkläufer 0.8, Wurzler 0.6, Kernspeier 0.6; Telecafé walker 4, Scherbentänzerin 0.9, Logenbrecher 0.7, Souffleur 0.6, Tee-Ifrit 0.8, Baklava-Brocken 0.6, Teppichschlinger 0.6; boss adds walker, raptor, drone, Uhrwerkläufer, Scherbentänzerin, Tee-Ifrit. District strength 6 |
| Echo (T8) | `src/sim/echo.ts`: life ×0.45, damage ×0.8, name „Echo: …“, no item drops (heal only), Kodex counts the kind. Two adds of the deck's mix. Pale body on a pale dial with a frozen second hand |
| Der Zeitwart | `ENEMIES.zeitwart`: life 6000 (Sultan 4400; 5200 at first), hit 36, speed 2.6, radius 0.9, scale 1.9, Koloss resistances (shock 1.7, acid 0.6), class Maschinen, no rage. `BOSS.zeitwart`: phases at 66 % and 33 %; gear hold ring 3.5 m round the seat nearest the hero, 6 s, an add every 2 s, then stunned and open 3 s. Phase 1: Zeigerhieb (`bossSlam`, every 3.6 s within 6 m), Sprung (`pounce`, every 5.5 s from 4 to 12 m), two raptors or two Scherbentänzerinnen every 12 s. Phase 2: volley of five (`volley`, every 4 s), root field (`roots`, every 6 s), one Uhrwerkläufer or two Zünder. Phase 3: Zeitsprung every 7 s (three blinks, 0.5 s mark, landing hit ×0.7, the Boxenkopf ring), Zeigerhieb up close, two drones or two Tee-Ifrite; the clock hands turn 1.5 times faster |
| Lines | Start „Die Zeit steht. Das bleibt so.“, rage (first gear hold) „Zurück auf Null!“, special (his call) „Schlag zwölf!“; Piper clips `assets/voices/zeitwart-*.ogg`. Kodex „Steht er im Werk: Zahnrad einsetzen.“ |
| Ending (T10) | Two rings r 0.65 beside the main switch, 1.5 s inside decides; `camp.ending` 'gestellt' or 'gelassen'; a run saved at the choice resumes at it |
| Telespargel | Legendary spear, shock; Zeitzeichen every 12th hit stops every enemy within 5 m for 1.5 s (a stun, bosses take 15 % of it as of any stun). Drops for certain from the Zeitwart until it is in the Kodex, then one time in three |

### Calibration (bot, `node tools/balance.mjs 3 normal johannes 1 --map=turm --carry`, after merging main)

| Fight | Won | Deaths | Time s | Damage taken | Lowest life |
|---|---|---|---|---|---|
| Foyer | 3/3 | 0 | 42 | 3 % | 98 % |
| Schacht (crank hold, echo Hauptmann) | 3/3 | 0 | 157 | 54 % | 91 % |
| Panoramaetage (hand, echo Spreehexe) | 3/3 | 0 | 154 | 165 % | 55 % |
| Telecafé (band, echo Sultan) | 3/3 | 0 | 171 | 92 % | 87 % |
| Uhrenraum (Der Zeitwart) | 3/3 | 0 | 96 | 151 % | 66 % |

13.2 min per run, about 10.3 of them in fights (the map doc asks 10 to 12). Changes from the start values: waves at 0.65 of the Wedding count (`TURM_COUNT`; 15.5 min before), Der Zeitwart life 6000 (5200 fell in 87 s). First rerun had one stall: strays left on the Schacht chased the hero through the floor and held up the bot; a lift ride now removes the enemies left on that deck (test in `fernsehturm.test.ts`).

## Handover 2026-11-23 (step 3) [Claude · Opus high]

- Built to the spec above: `src/sim/zeitwart.ts` (three phases, gear holds T9, Zeitsprung), `src/sim/echo.ts` and the dial mark (T8), the ending rings (T10, the card is step 4), the Telespargel (model, Zeitzeichen, icon I109), voices and Kodex X28. T5 and T9 are built, no fallback used.
- Reused: the boss blocks `bossSlam`, `pounce`, `volley`, `roots` and the Boxenkopf landing ring; the Wedding wave formula; the Piper voice tool. The 2D game has no tower boss, so the rest is new.
- Proof: `docs/proof/m17-fernsehturm/step3-zeitwart.png`. Late tiers show large numbers: a hand hit on him is 3 % of 678 720 life.
- Open for Johannes: the boss look and readability of the gear hold and the blink mark (playtest row in step 4). Calibrate again once the parallel boss-number change lands.

