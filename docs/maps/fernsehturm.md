# Fernsehturm finale (M17) [Claude · Fable high]

Final district (migration Q8, `docs/story.md` › Finale): "back up the Fernsehturm with all gears", the clock room in the sphere, all eras at once, then the choice.

**Status: concept done. Johannes picked layout A "Aufstieg" (2026-11-21).** Order (Johannes, 2026-11-21): Charlottenburg, then Wedding, then this finale; it opens when all six districts are freed. Mockup with A and B: [`../mockups/m17-fernsehturm-layouts.html`](../mockups/m17-fernsehturm-layouts.html) (PNG beside it). Plan and steps: `docs/tasks/m17-fernsehturm.md`. Notes are short on purpose; Opus writes the final text with the data step.

## Problem

The Fernsehturm already stands in Alexanderplatz (map 3): inside the loop, visible from every fight, the Rathausforum around it walkable (side branches, a hidden blessing), Marienkirche and Neptunbrunnen beside it, reveal shot, golden hour. Only the tower door is locked. A finale on the ground at the tower would replay that place.

## Decisions

| # | Decision | By |
|---|---|---|
| F1 | Layout A "Aufstieg": the finale plays inside the tower, on five round decks one above the other, joined by the lift. No street, no lot, no ground map | Johannes, 2026-11-21 |
| F2 | Each deck is one ring arena (walkable ring around a solid core). One twist per deck: lift crank (hold), windows by compass bearing plus one clock hand, revolving floor, two clock hands plus the boss | Part of A |
| F3 | "All eras at once": no new ordinary enemies. Waves mix the existing kinds of two districts per deck (six districts, three fight decks); three district bosses return as weaker echoes | Part of A |
| F4 | Final boss: **Der Zeitwart**, the last duty officer of the Zeitnormal, appears as a humanoid robot in the [boss board](../style/fernsehturm-zeitwart.webp). He holds the last part, **die Unruh** (balance wheel), in the current proposal | Look approved by Johannes, 2026-11-21. Unruh proposed |
| F5 | Light: night at the foot, dawn at the top, one sky per deck, switched during the lift ride. From the sphere the city lies below with every district in its own light | Part of A |
| F6 | Entry: opens when all six districts are freed; the game is linear. No tunnel of its own in the first version | Johannes, 2026-11-21 |
| F7 | Ending: after the boss, two rings at the main switch: „Uhr stellen“ or „Stehen lassen“. A card and a save flag, no rule change | Johannes, 2026-11-21 (took the recommendation) |
| F8 | Tier 48 to 70 (the +8 per district rule with Wedding as district 6), provisional like Charlottenburg C4 | Claude, proposed |
| F9 | Order: Charlottenburg, Wedding, Fernsehturm. Work on the finale starts after [M18 Wedding](../tasks/m18-wedding.md) is complete and merged | Johannes, 2026-11-21 |
| F10 | Art direction for steps 2 and 3: [Stillstand](../style/fernsehturm.webp) for interiors and lighting, and [Der Zeitwart](../style/fernsehturm-zeitwart.webp) for the boss and gear. Step 1 uses the deck specs below | Johannes, 2026-11-21 |
| F11 | No „kommt bald“ window gag: Wedding is a freed district by then | Johannes, 2026-11-21 |
| F12 | A new tower legendary: the spear „Telespargel“ (task file › Loot) | Johannes asked for one, 2026-11-21; design Claude, proposed |
| F13 | Tower proportions: the model on map 3 stays as it is. Section *Tower proportions* and its mockup are kept as the record of the check | Johannes, 2026-11-21 (dictated message, read as "the proportions currently in the game are fine") |

## Why A differs from the Alexanderplatz map

| | Alexanderplatz (built) | A Aufstieg |
|---|---|---|
| Place | Ground: loop around the tower over Museumsinsel, Nikolaiviertel, Karl-Marx-Allee | Inside the tower: foyer, shaft, sphere |
| Layout | Loop of 390 × 300 m, streets, blocks, bridges | Five discs of r 15 to 26 m stacked, lift between |
| Mood | Golden hour, Pioneer yellow and blue, falling leaves | Night to sunrise, steel and brass, the city far below |
| Mechanics | Circle fights on squares | Ring arena with a core, clock hands, revolving floor, crank hold, echo bosses |
| Tower | Landmark from outside, door chained | Played from inside; the outside is never walked |

## Geography check

OpenStreetMap Nominatim, 2026-11-21. Origin: Fernsehturm (52.52083, 13.40942). Formula of `guidelines.md`. Bearing: 0° north, clockwise.

| Place | E (m) | N (m) | Distance | Bearing | Use |
|---|---|---|---|---|---|
| Weltzeituhr | 263 | 37 | 266 m | 82° E | East windows: Alexanderplatz, 1989 |
| Bahnhof Alexanderplatz | 126 | 82 | 150 m | 57° NE | Stadtbahn below the foyer windows |
| St. Marienkirche | −152 | −31 | 155 m | 258° W | Near field of the city image |
| Neptunbrunnen | −175 | −137 | 222 m | 232° SW | Near field |
| Rotes Rathaus | −108 | −284 | 304 m | 201° SSW | Near field |
| Marx-Engels-Forum | −315 | −259 | 408 m | 231° SW | Near field |
| Berliner Dom | −564 | −194 | 597 m | 251° W | Near field |
| Oberbaumbrücke | 2459 | −2124 | 3.3 km | 131° SE | South-east windows: Xhain, 1981 |
| S+U Warschauer Straße | 2722 | −1696 | 3.2 km | 122° SE | The camp, a warm light |
| Rathaus Köpenick | 11231 | −8386 | 14.0 km | 127° SE | Behind Xhain on the same line: Köpenick, Urzeit |
| Müggelturm | 14608 | −11513 | 18.6 km | 128° SE | Horizon |
| Brandenburger Tor | −2148 | −507 | 2.2 km | 257° W | West windows: Mitte, 2089 |
| Potsdamer Platz | −2292 | −1226 | 2.6 km | 242° SW | West windows: Mitte |
| Bahnhof Zoologischer Garten | −5206 | −1489 | 5.4 km | 254° W | Behind Mitte: Charlottenburg, 1920 |
| Gedächtniskirche | −5028 | −1784 | 5.3 km | 250° W | Charlottenburg |
| Schloss Charlottenburg | −7905 | −21 | 7.9 km | 270° W | Charlottenburg, furthest |
| Leopoldplatz (Wedding) | −3404 | 2842 | 4.4 km | 310° NW | North-west windows: Wedding, „kommt bald“ |
| Tempelhofer Feld | −462 | −5161 | 5.2 km | 185° S | Not migrated; dark sector |

Order on each line of sight is real: south-east Xhain then Köpenick, west Mitte then Charlottenburg, north-west Wedding, east Alexanderplatz at the foot.

Tower facts, checked 2026-11-21 (structurae.net with the German Wikipedia text, tv-turm.de FAQ, berlin.de, OSM tags, Wikidata):

| Fact | Value |
|---|---|
| Height | 368.03 m, opened 3 October 1969 |
| Shaft | 248.78 m high; foot 32 m across, a 20 m high curved cone down to 16 m, then tapering to 9 m; portholes mark five sections |
| Sphere | 32 m across, centre at 213.78 m |
| Observation deck, restaurant | 203.78 m, 207.53 m; the restaurant turns twice an hour |
| Antenna | 118 m |
| Lifts, stairs | 2 visitor lifts (Wikidata), 986 steps |
| Foot | Three pavilions with arrow-shaped plans and folded roofs, finished 1972; hexagonal geometry; a wide stair to the south-west; the entrance faces the S-Bahnhof |

Not checked: the sun reflection as a cross on the sphere ("Rache des Papstes"), from memory.

Invented for the game (say so, do not present as real): the Uhrenraum under the dome (story), a walkable platform in the shaft at about 100 m (the real shaft is under 13 m across there), deck radius 17 m (real 16), one hexagonal foyer hall in place of the three pavilions, the lift stopping between floors.

## Tower proportions (Johannes, 2026-11-21: "the tower looks very long, maybe not thick enough")

Mockup: [`../mockups/m17-tower-proportions.html`](../mockups/m17-tower-proportions.html).

| | Height | Sphere | Shaft (top to foot) | Antenna |
|---|---|---|---|---|
| Real | 368 m | 32 m | 9 to 16 m, foot flares to 32 m | 118 m |
| Real, shrunk to 101 m | 101 m | 8.8 m | 2.5 to 4.4 m, foot 8.8 m | 32 m |
| Map 3 today (`alex-world.ts`, `fernsehturm`) | 101 m | 17 m | 6.4 to 9.2 m, no flare | 21 m |
| Variant 3 (not taken) | 101 m | 22 m | 8.6 to 12.8 m, foot flares to 19 m over the lowest 8 m | 19 m |
| Variant 4 (not taken) | 84 m | 23 m | 9.2 to 12.8 m, same foot | 14.5 m |

Finding: the model is already twice as thick as the real tower at that height. It reads as a stick because the game camera sees mostly the foot and shaft, and the foot has no flare. The first M17 mockup drew the tower too thin (a drawing error, corrected). Johannes keeps the model as it is (F13). The finale shows the tower from outside only on the city image and the ending shot; use the map 3 proportions there.

## Decks (scale 1, meters, +X east, +Z south)

Decks lie side by side on the plane, 120 m apart, so collision stays 2D. Only the hero's deck is drawn. `mapscale` does not apply (rooms keep real size).

| Deck | Height label | Centre | Outer | Core | Era, sky | Content |
|---|---|---|---|---|---|---|
| E0 Foyer | 0 m | (0, 0) | Hexagon, r 26 | Lift core r 5 | Night | Start inside the north-east door (16.8, −10.9), the side of the S-Bahnhof as in reality. Kiosk (rest stop and trader) at (−13, 15), outside the fight circle. First gear into the lift panel. Fight 1 round the core |
| E1 Schacht | ≈100 m | (120, 0) | r 15 | Open well r 5.5 (blocked, see down) | Urzeit + 2089, dark | Lift stuck. Crank hold at (120, −10.5). Fight 2 |
| E2 Panoramaetage | 203 m | (240, 0) | r 17 | Lift core r 5 | 1981 + 1989, before dawn | Windows all round. One clock hand. Fight 3 |
| E3 Telecafé | 207 m | (360, 0) | r 17 | Lift core r 5; bar: a 90° arc r 5 to 7.5 on the north side | 1920 + kommt bald (Wedding), first light | Floor band r 8 to 14 revolves. Bar is the rest stop. Fight 4 |
| E4 Uhrenraum | ≈220 m | (480, 0) | r 17 | The movement r 4, low (1.2 m) | All eras, the sun standing on the horizon | Six gear seats. Two clock hands. Der Zeitwart. Main switch at (480, −15) |

Lift: door on the south face of each core (toward the camera). Arrival spot 2 m south of the door. Bounds x −30 … 510, z −30 … 30.

## Flow

| # | Deck | Fight | Waves | Mix (existing kinds) | Twist |
|---|---|---|---|---|---|
| 1 | Foyer | foyer | 2 | walker, runner, brute, spitter | None: the Zeitlose come in from the forum through the broken glass |
| 2 | Schacht | schacht | hold, then 2, echo Hauptmann | raptor, crow; kabel, drone; walker | Hold the crank 35 s (tunnel generator rule); spawns come up the stairwell. Vines and cables in the shaft |
| 3 | Panoramaetage | panorama | 3, echo Spreehexe | zuender, schild, heuler, rat; uhrwerk, wurzler, kernspeier | Enemies enter through the windows of their district's bearing (SE and E). One hand sweeps the ring |
| 4 | Telecafé | telecafe | 3, echo Diva | scherbe, loge, souffleur; the Wedding kinds once that district is built (until then 1920 only) | The floor band turns and carries hero, enemies and drops. Laid tables on the sill as cover: the revue and the eternal feast at one table |
| 5 | Uhrenraum | uhrenraum | Boss | Summons from all eras | Two hands; gear holds at 66 % and 33 % |

10 normal waves, 3 echoes, 1 boss; about 10 to 12 minutes. After each won fight the lift door opens; the hero sets the next gear at the panel (automatic) and rides up. The echo is the last wave of its fight. The Telecafé echo may become the Wedding boss (Der Ewige Gastgeber, a host in the revolving restaurant) once Wedding is built; decide then.

## Final boss: Der Zeitwart

Story: the duty officer who stood at the main switch between two seconds. The first Zeitloser and the only one who knows. He keeps the clock stopped, because a running clock ends him.

Reuse the humanoid base and rig (`human1.glb`). Use weathered blue-grey steel for the exposed face and neck, with plate seams, chipped enamel and an amber lens beside the dial monocle. Keep the grey-blue work coat, peaked cap and watch chains. Use separate clockwork meshes for the long brass minute hand on the right arm, the short heavy hour hand on the left arm, and the pendulum on his back. Each phase tints him in its eras.

| Phase | Life | Eras | Moves (existing blocks first) |
|---|---|---|---|
| 1 Gestern | 100 to 66 % | Urzeit, 1920 | Zeigerhieb (wide arc, as `slam`), Sprung on a marked line (`pounce`), calls two raptors or Scherbentänzerinnen |
| 2 Mauerzeit | 66 to 33 % | 1981, 1989 | Volley of five (`fan`), root field under the hero (`roots`), calls an Uhrwerkläufer |
| 3 Morgen | 33 to 0 % | 2089, kommt bald | Zeitsprung: three blinks to marked spots, each with a shock ring (`bass`); calls drones; both hands faster |

Arena: the minute hand (16 m, one turn in 12 s) and the hour hand (10 m, one turn in 30 s, the other way) sweep the ring the whole fight. At 66 % and 33 % he steps into the movement and cannot be hurt; the hero holds a gear seat (ring r 3.5, 6 s, adds every 2 s, the tunnel hold rule). Gear in: the boss is stunned 3 s, next phase. Fallback if a hold inside a boss fight costs too much: plain phase change as the Diva's tiers.

After the kill the movement lies open with the Unruh. Two rings at the main switch: „Uhr stellen“ (the sun rises, one light over the whole city, card: everything returns, the old order too) or „Stehen lassen“ (the patchwork stays, stars stay, card: the city keeps its times). Save flag `ending`.

## Light and look

| Deck | Sky | Light sources |
|---|---|---|
| Foyer | Night, as the other districts; the forum outside the glass dark | Cold emergency strips, the warm kiosk, a red lift lamp |
| Schacht | Almost black; green glow from below (the jungle climbed the shaft, as the ivy on the 2D sprite), magenta and cyan from the cable trays | Caged work lamps on the wall, fireflies, sparking cables |
| Panoramaetage | Deep blue before dawn | Floor lamps, console lights; the city glow through the glass |
| Telecafé | Rose and pearl, first light | Table candles, bar lamps, bulb strings (1920), wish lamps and lanterns in gold and emerald (Wedding) |
| Uhrenraum | The sun stands on the horizon and does not move: pale gold rim, long mullion shadows | Dial lamps on the movement, the glowing hands |

The city image ("Stadtteppich"): one painted ground plane far below the sphere decks, visible past the deck edge and through the north windows. Each district is painted at its real bearing in its own light: Köpenick dark green with fog, Xhain fire orange with the Wall line, Alexanderplatz a patch of golden afternoon (the only daylight), Mitte magenta and cyan under a rain veil, Charlottenburg silver with searchlights, Wedding gold and emerald lanterns, the camp a warm dot, the Spree through all of them. Code-painted first from the map data (`src/data/map-svg.ts` has every district's streets and water); Codex may paint the final image. The camera looks 24° to 64° below the horizon, so it sees this plane and never the sky. Cloud cards drift between.

Interior style: 1969 space-age GDR (steel ribs, brown and orange enamel, cobalt and yellow from the Pioneer palette, restrained), brass clockwork of the Zeitnormal growing through it, worn as every landmark (soot, cracked glass, tarps). Style source: `docs/style-bible.md` (Alexanderplatz board for the materials, shared wear rules). The deck interiors need a look mockup before they are built.

Camera: no ceilings drawn. The wall toward the camera is a knee-high sill; the north half carries the full window band. The core is cut at 4.3 m with a dark cap while the hero is north of it (V1 B cutaway). The movement in the Uhrenraum stays low.

## Entry

| Topic | Note |
|---|---|
| Unlock | Districts 0 to 5 all freed (six gears; Johannes, 2026-11-21). No line of its own in the first version |
| Network | Wedding becomes `STOPS[5]`, the finale `STOPS[6] = { name: 'Fernsehturm', station: 'S+U Alexanderplatz', map: 'turm' }`. `nextDestination` already returns a stop without a line. Needed: a rule that the last stop opens only with all others freed, and a place on the board beside the Alexanderplatz stop |
| Links | Wedding victory screen: „Zum Fernsehturm“. Title: the main button follows `nextDestination` |
| Depends on | Completion of [M18 Wedding](../tasks/m18-wedding.md) (F9). Read its [map spec](wedding.md), enemy roster, boss and network stop before step 1, then update the Telecafé waves, the Echo and `STOPS` here |
| Later option | The Stadtbahn ride to Alexanderplatz as a line (Charlottenburg C5), backlog |
| Arrival | The run starts at the foyer's north-east door; the last train on Normalzeit stands on the viaduct outside the glass (station at bearing 57°, 150 m) |

## Cost (estimate, not measured)

| Item | Leistung | Ausgewogen |
|---|---|---|
| One deck in view (floor, walls, props, merged per material) | About 60 to 90 draw calls, under 60k triangles | Same |
| City image and clouds | 2 draw calls, FX layer, no shadow, not in the pre-pass | Same |
| Clock hands, lift ring, hold ring | FX layer cards, no lights | Same |
| Lights | Pooled as everywhere; the count never changes | Same |
| Sky switch | A new reflection environment per deck, rendered while the lift cut is dark | Same |
| Load | Enemy bodies of six districts plus three echo bosses in one page: the real risk; measure on the Tab S9 | Same |

District budget for comparison: under about 200 draw calls and 200k triangles (`guidelines.md` › Performance). Cloud browsers have no GPU; only the PC and the Tab S9 count.

## Risks

| Risk | Answer |
|---|---|
| Feels small after six open districts | It is a finale: dense fights, three echoes, one boss, the view. Add a second fight per sphere deck only after a playtest |
| Core hides the hero | Cutaway of the core, low movement in the Uhrenraum, hero contour as the fallback |
| Revolving floor touches many sim parts | Fallback: the band turns in the render only and the panorama drifts; no sim effect. Drop this first |
| Load time and memory with all enemy families | Cap the roster to the kinds in *Flow*; load echo bosses with the map only; hardware check row |
| The view carries the mood | Code-painted city image must already read; show it in the look mockup |
| Wedding is still in progress: its enemies, boss and stop may differ from what is assumed here | The finale starts after Wedding is merged; step 1 begins by reading it |
| Art studies and playable deck layouts differ | Use the boards for the look (F10) and the deck table for layout and gameplay |

## B Splitterring (not picked; kept for the record)

Pieces of every district float around the sphere at 203 m, each at its real bearing: Alexanderplatz east, Xhain and Köpenick south-east, Mitte and Charlottenburg west. Hub: the Panoramaetage. Route as a figure eight through the hub, bridges of rail and viaduct, an S-Bahn car as a ferry, the Oberbaum arch between Xhain and Köpenick. Five fights of three waves, two echoes, the Zeitwart on the roof at the antenna foot; each phase docks one piece and floods the roof with its era. About 280 × 170 m, 650 m of route, about 15 minutes.

| For | Against |
|---|---|
| Open air and district scale; the strongest picture of "all eras at once" | Largest scope: touches the builders and materials of all five districts |
| Enemies can be knocked off the edge | New: island undersides, cloud sea, the fall rule, edges without invisible walls |
| Reuses one finished sight per district | Five material sets in one map: 150 to 220 draw calls estimated, long load |
| | Best with a sky per zone (Charlottenburg step 3a, not built); very surreal next to the other maps |

## Considered and dropped

| Idea | Why not |
|---|---|
| Rathausforum, Marienkirche, Neptunbrunnen at night | Map 3 already makes this ground walkable; same sights, same tower foot |
| Spree and Fischerinsel | Map 3 zone 2 runs along the Spreeufer and Nikolaiviertel; Fischerinsel has no story anchor |
| Underground (station levels, foundation) | Four tunnel lines already look like this; the story says up |
| Stadtbahn ride from Zoo with fights at stations | It is the way there, not the finale; kept as the later line 4 |

## Reused from 2D (`johakunath/Ruinenstadt`)

2D has no finale map. Reused: the story (`docs/story.md`: Zeitnormal, gears, clock room, the choice), the tower drawing as reference (`fernsehturm()` in `js/alex.js`: lit window ring, brass gear rim on the sphere, red and white antenna, ivy up the shaft, folded pavilion roofs), the two tower legendaries as signature drops (Fernsehturm-Splitter, Auge des Fernsehturms: `LEGP.turm`, `LEGP.auge` in `js/data.js`, already in 3D), the generator hold and the gratings of `js/ubahn.js` (already in 3D as `hold` and `gates`).
