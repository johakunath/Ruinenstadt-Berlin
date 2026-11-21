# M17 Fernsehturm finale, district 6 [plan: Claude · Fable high; build: Claude · Opus high]

Layout A „Aufstieg“ (Johannes, 2026-11-21). Order: Charlottenburg, Wedding, then this finale (map doc F9). **Do not start any build step before Wedding is complete and merged (Johannes, 2026-11-21).** The style boards (step S) may be made in the meantime. Concept, decisions F1 to F13, geography check, tower facts and proportions, deck table, boss, light, entry, cost and 2D reuse: `docs/maps/fernsehturm.md`. Mockups: `docs/mockups/m17-fernsehturm-layouts.html`, `docs/mockups/m17-tower-proportions.html` (PNGs beside them; schematic, the tables in the map doc rule). Templates: the tunnel (`src/data/tunnel.ts`, `src/render/tunnel-view.ts`) and the camp (`src/data/camp-map.ts`, `src/render/camp-world.ts`) for interiors, `docs/tasks/m16-charlottenburg.md` for the step format.

Notes are short; whoever builds a step writes its handover here (at most 8 lines).

## Goal

A playable finale `?map=turm`: five decks inside the Fernsehturm, four fights, three echo bosses, Der Zeitwart, the ending choice. About 10 to 12 minutes.

## Steps (one session each)

| # | Step | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept A and B, mockup, geography check, plan | | Fable high | done 2026-11-21, A picked |
| S | Style boards: Johannes gives Codex the two prompts below (*Style boards*); picks; files `docs/style/fernsehturm.png` and `docs/style/fernsehturm-zeitwart.png`, a row in `docs/style-bible.md` | | Johannes, Codex | open |
| P | Tower proportions on map 3 | | | dropped: Johannes keeps the model as it is (map doc F13) |
| 1 | Engine, data, blockout. `MapDef.decks` and `deckWalk` (T1), the lift (T2), ring encounters (T3), clock hands (T4), revolving band (T5, drop first). `src/data/fernsehturm.ts` from the deck table, tests `src/data/fernsehturm.test.ts` (invariants below), a scripted run wins (`director.test.ts`). Wiring `?map=turm` (`options.ts`, `ui/maps.ts` `MapId`, `main.ts` banner). Blockout render: discs, sills, window band, cores, hands and rings on the FX layer; only the hero's deck visible. Stand-ins: echoes are the plain boss kinds, final boss `diva` | Wedding merged | Opus high | open; first read Wedding's map doc, enemies, boss and stop and correct the assumptions here |
| 2 | Look. First a look mockup in chat from the style board (the sphere decks and the city image), Johannes confirms. Then: five interiors in `src/render/turm-world.ts`, the city image and cloud cards (T6), one `Sky` per deck (T7), the lift cut with the height counter, cutaway of the cores, window-break effect where a spawn enters. State the Leistung and Ausgewogen cost | 1, S | Opus high, mockup first | open |
| 3 | Enemies and boss. Spec lines first (wave mix numbers, echo scale, Zeitwart numbers, calibrated with the bot), then build: `echo` modifier (T8), Der Zeitwart from the board (kit below, body on the human base, sounds, spoken lines, Kodex), the gear holds (T9), the ending choice (T10), the spear Telespargel (model, power, icon). Update `docs/enemy-pipeline.md` and `docs/equipment-pipeline.md` | 1, S | Opus high (a Fable pass only if Johannes dislikes the boss) | open |
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
| T2 | Lift (step 1) | `Level.lifts`: `{ from: Point; r: 1.6; to: Point; after: encounterId }`. Closed until `after` is won (reuse `Level.gates` for the door collider and its `gateOpen` event). Hero inside the ring for 0.8 s: `sim.lift` event, position set to `to`, enemies and drops stay behind. Deterministic, a unit test. Render: 0.6 s to black, height counter, sky and deck switch, back in. The bot walks to the ring as an objective |
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
| Der Zeitwart | Human base, gear in code (coat, cap, dial monocle, hand arms, pendulum). Three phases by era pair (Urzeit and 1920, 1981 and 1989, 2089 and kommt bald), moves from `slam`, `pounce`, `fan`, `roots`, `bass`, summons; new: the blink (0.5 s warning circle at the landing spot). Gear holds T9. Resistances: propose shock weak (a clock), fire neutral, acid resistant |
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

Board 1, the place:

```
Generate ONE beautiful landscape RUINENSTADT game art direction board. Use the attached Köpenick board for STYLE only and the attached Charlottenburg board for the final-board LAYOUT; new content below. Painted comic, strong dark ink outlines, rich painterly texture, warm lights against cool teal shadows, gritty readable post-apocalypse, chipped enamel, cracked glass, soot, tarps, ivy. Not photorealistic, not 3D, no game HUD, no BVG branding or transit livery.

Title: FERNSEHTURM · STILLSTAND. Subtitle: Alle Zeiten zugleich. Fictional Berlin: the broken Zeitnormal clock froze every district in a different era; the Berlin TV tower was its antenna. The finale is played INSIDE the tower, on round floors around a central lift core.

Upper 60%, key scene: inside the revolving restaurant in the tower sphere, about 207 m up, at first light. A ring-shaped room around a round lift core, a long curved band of tall slanted windows, 1969 GDR space-age interior (steel ribs, brown and orange enamel panels, cobalt blue and warm yellow details), worn and half ruined. Brass clockwork of the Zeitnormal grows through walls and floor: gear trains, dials showing different times. Laid tables frozen mid-toast. A clear ring of floor in front as a readable combat space. Through the windows far below: Berlin from above, each district lit in its own time: dark green jungle with fog to the south-east, fire-orange streets and a wall line nearer, one patch of golden afternoon directly below to the east, magenta and cyan neon under a rain veil to the west, silver searchlights beyond it, gold and emerald lanterns to the north-west, the river Spree winding through all. The sun stands exactly on the horizon. A giant glowing clock hand sweeps across the room.

Lower 40%, dark teal concept panel: four small interior studies, each a round room seen from a high three-quarter view with the wall toward the viewer cut low: (1) FOYER at night, hexagonal entrance hall with folded concrete roof, souvenir kiosk with warm light, lift door with six empty gear sockets; (2) SCHACHT, inside the concrete shaft, a maintenance gallery around a dark open lift well, jungle vines and sparking cable trays climbing from below, an emergency hand crank; (3) PANORAMAETAGE before dawn, observation ring with telescopes and broken windows; (4) UHRENRAUM under the steel dome, a low brass clock movement in the centre with six gear seats and a balance wheel, two huge clock hands, a main switch. Props row: six different gear wheels (one per era), the balance wheel "Unruh", lift panel, hand crank, telescope, kiosk. Eight palette swatches: concrete white, steel blue-grey, brass, enamel orange, cobalt, signal red, dawn rose, night teal. Discreet title and subtitle.
```

Board 2, boss and gear:

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
| J2 | Boss: Der Zeitwart, holding the Unruh? | No answer yet; decide on board 2 |
| J3 | Does the ending change anything afterwards? | No: card and flag (took the recommendation) |
| J4 | Unlock with all other districts freed, no tunnel of its own? | Yes, the game is linear |
| J5 | Wedding window gag? | No: Wedding is freed by then; it is a played district before the finale |
| J6 | Tower proportions: variant 3 or 4? | Neither: the model in the game stays (Johannes, 2026-11-21) |
| J7 | Wedding first? | Yes. Wedding is in progress in another session (not on `main` yet); the finale waits until it is complete |

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
