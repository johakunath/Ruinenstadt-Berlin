# M18 Wedding, district 6 [plan: Claude · Fable high; build: Claude · Opus high]

Wedding becomes a district (Johannes, 2026-11-21). Concept, decisions W1 to W6, geography check, enemy outline and 2D reuse: `docs/maps/wedding.md`. Mockups: `docs/mockups/m18-wedding-layouts.svg` (layouts A, B, C), `docs/mockups/m18-wedding-look.svg` (look A, B, C); both schematic, the anchors below rule. Template: `docs/tasks/m16-charlottenburg.md` and its code. The id M18 was also the endless mode step (built, `src/sim/director.ts`); this file is the district.

Status: step 0 done. **Gate G1 is open: Johannes has not picked the layout or the look.** This file is written for layout A and look A (the recommendations). If he picks another layout, a Fable session rewrites the anchors before step 1.

## Gates

| # | Johannes decides | Before | Default if he only says „go“ |
|---|---|---|---|
| G1 | Layout A, B or C and look A, B or C (the two mockups) | Step 1 | A and A |
| G2 | Chain place and line (map doc W3): after Charlottenburg, U9, ghost station Westhafen | Step 6 | As proposed |
| G3 | Lot types and facade (mockup of step 3) | The lot part of step 3 | |

## Steps (one session each; few and large on purpose)

| # | Step | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept, geography check, decisions, mockups, plan | | Fable high | done 2026-11-21 |
| 1 | Data and playable blockout. `src/data/wedding.ts` from the anchors below and `src/data/wedding.test.ts` with the invariants at scale 1 and 1.3 (as `charlottenburg.test.ts`, with the collider flood fill); map SVG `docs/maps/wedding.svg` shown in chat before the 3D part. Then `?map=wedding`: wiring (`options.ts`, `ui/maps.ts` with freed id 5, `main.ts` banner „Wedding · kommt bald“, bot `mapLevelOf`, `tools/balance.mjs --map=wedding`), `src/render/wedding-world.ts` with landmark massing, the Panke, the plain brick Ringbahn with its arches, the hill, the two open halls, the shut palace gate, the Korso jam; a smoke test. Stand-in bosses and enemies; district 5, tier 40 to 62 (W4). No title, victory or network link yet | G1 | Opus high | open |
| 2 | Enemy and boss spec `docs/tasks/m12e-wedding-enemies.md` in the format of `m12d-charlottenburg-enemies.md`: the three board enemies, Zeitlose skins (`flavor: 'fest'`), the four bosses, the district rule, wave mix per zone, loot (set Pracht des Ewigen Gasts, weapon Die Letzte Bestellung, flavour bases), Kodex lines. Input: map doc › Enemies | 0 (can run now, parallel to 1) | Fable high | open |
| 3 | Look and street dressing. `WEDDING_SKY` and weather per zone; the lampion chains (E5); awnings, carpets, the Lange Tafel, market stalls, the Korso cars, scaffolds with nets, cranes, banners and billboards; then, after a mockup (G3), the two lot types per zone and the hall-front facade. State the Leistung cost at the four spots | 1, G1, G3 | Opus high, mockup first | open |
| 4 | Landmarks from photos (`docs/maps/landmarks.md`; look at the photos yourself), built worn, with a light plan per sight as `charlottenburg-lights.ts`. 15 kinds (table below). Correct the memory facts in the map doc. May run as two builders in parallel: Leopoldkiez and Fest; Humboldthain and Gesundbrunnen | 1 | Opus high | open |
| 5 | Enemies, bosses and loot from the spec (sim, bodies, sounds, Kodex, the rule); update `docs/enemy-pipeline.md` and `docs/equipment-pipeline.md` | 2, 1 | Opus high | open |
| 6 | Flow, balance and handover. U9 tunnel (line 4) from S+U Zoologischer Garten, network stop with `map: 'wedding'`, title and victory links, bot chain, tier. Rows for Codex in `docs/asset-pipeline.md` (cloth atlas, sign atlas, lampion paper, gilded stucco, scaffold net). Screenshots (street, fight, each landmark), rows in `docs/tasks/pt-hardware-checks.md` (Playtest, Tab S9 size and fps), `docs/status.md` | 1, 5, G2, Charlottenburg step 8, the M14/B2 decision | Opus medium | open |

## Anchors (layout A, scale 1, meters, +X east, +Z south)

Bounds x −55 … 280, z −165 … 125 (335 × 290). Start (0, 0) at the U Leopoldplatz entrance (landmark at (−6, 6), so no generated lot lands on the start); it is the origin of the geography table. Anchors may move up to about 10 m for circles and lots; octants and the order along Panke and Ringbahn must hold (test), and places near an octant border move only away from it.

| Zone | Fights (id, x, z, waves) | Boss |
|---|---|---|
| 1 Leopoldkiez | wochenmarkt (28, −14, 2), muellerstrasse (20, 26, 3), bahnhof (48, 44, 3) | nettelbeckplatz (94, 32): boss 1 |
| 2 Humboldthain | wiesenburg (154, 62, 3), humboldthoehe (208, 8, 2; calm: 0.7 count, no elites, flyers), rosengarten (242, 6, 3) | maschinenhalle (220, 92): boss 2 |
| 3 Gesundbrunnen | badstrasse (228, −80, 3), luisenbad (196, −118, 2; calm), uferhallen (160, −94, 3) | brunnenplatz (150, −48): boss 3 |
| 4 Das ewige Fest | nauener (66, −98, 3) | lampenhof (8, −120): Sultan Nimmersatt |

10 fights, 27 waves (8, 8, 8, 3), 4 bosses. Route order as listed. Circles r 13 to 15, the Lampenhof 17. Every circle needs 80 % open ground (test), so: the Wochenmarkt keeps its stalls on the rim and at most four inside as cover; the Müllerstraße fight gets a widened pavement in front of a pavilion; Bahnhof Wedding a forecourt north-west of the viaduct; the Wiesenburg its yard; the Rosengarten a round lawn; the Maschinenhalle is at least 46 × 30 m clear; Badstraße, Luisenbad and Uferhallen get a small square or forecourt each; the Lampenhof is about 44 × 40 m clear.

| Thing | Where |
|---|---|
| Panke | A stream about 7 m wide, north edge to south edge: (200, −165), (178, −146), (150, −124), (128, −100), (120, −70), (118, −30), (126, 8), under the Ringbahn at (136, 28), (132, 56), (118, 90), (104, 125). Stone quays in town, natural banks at the Luisenbad and the Wiesenburg. Bridges: Gerichtstraße (132, 56; route), Pankstraße (120, −50; route). The line is a placeholder (map doc) |
| Ringbahn | Plain brick viaduct, solid runs with arches: (−55, 96), (60, 66), (105, 52), (136, 28), (170, 0), (200, −28), (235, −44), (280, −52). Arches: Gerichtstraße (114, 45; route), Brunnenstraße (262, −49; route), the Panke (136, 28; water only, E1), Müllerstraße at S Wedding (60, 66; closed by a barricade). Land south of it and west of the Panke is backdrop |
| Humboldthain | Park east of the Wiesenburg, south of the Ringbahn: (170, −34), (258, −44), (258, 62), (196, 62), (170, 34); fenced, gates west (182, 44) and east (258, 6). Humboldthöhe: soft hill 7 m, centre (208, 8), radius about 34, flat top for the fight. Paths: west gate → summit → Rosengarten → east gate; a branch (240, 12) → the breach in the AEG wall (234, 62) |
| AEG grounds | Walled yard (178 … 256, 66 … 120): Maschinenhalle (220, 94), about 50 × 34, roofless (E2); entered by the breach in the north wall, left through the Beamtentor (254, 70) onto the Brunnenstraße. Its extent is a placeholder |
| Leopoldplatz | Paved square (−10, −44), (40, −74), (58, −54), (14, 6). Its north end is closed by the Korso jam (26, −80) on the Schulstraße |
| Lampenpalast | Palace (6, −150), about 64 × 20, front to the south; the Lampenhof court in front of it (z −100 … −140) is framed by brick wings east and west; a low balustrade and the shut gate „Geschlossene Gesellschaft“ on the south side (toward the camera and the Leopoldplatz); the only way in is from the east, off the Oudenarder Straße (E3) |
| Streets | Müllerstraße (Hauptstraße, no tram): (−50, −52) construction fence, (−6, 2), (20, 28), (58, 64). Schulstraße (side): (10, 4), (46, −50), (26, −84). Lindower Straße (side; route): (58, 60), (94, 40). Gerichtstraße (side; route): (80, 22), (94, 34), (114, 45), (132, 56), (152, 62), (180, 62). Brunnenstraße (Hauptstraße; route north of the Beamtentor): (262, 125) barricade, (262, 70), (262, −49). Badstraße (Hauptstraße; route): (262, −49), (250, −62), (228, −80), (204, −100), (190, −120). Uferstraße (side; route): (190, −120), (166, −104), (146, −84), (148, −50). Pankstraße (side; route): (170, −38) barricade, (150, −48), (120, −50), (96, −72), (68, −96). Oudenarder Straße (side; route, with the Lange Tafel): (68, −96), (40, −108), (22, −114). Reinickendorfer Straße: two stubs only, (88, 10) to (94, 34) and (62, −160) to (74, −66); the block between them is closed |
| Blockrand | Tall rows where they do not stand between camera and street (guideline › Blockrand): north-east side of the Müllerstraße and the Lindower Straße, north side of the Gerichtstraße and the Pankstraße, both sides of the Brunnenstraße and the Reinickendorfer stubs, north-east side of the Badstraße. Shops, hall fronts and ruins on the camera side. `strictLots: true` |
| Landmarks (15 kinds) | U Leopoldplatz entrance (−6, 6), Alte Nazarethkirche (2, −28), Neue Nazarethkirche (32, −62), Neubau im Gerüst with crane and banner (−40, −14; invented), S Wedding on the viaduct (60, 66), Wiesenburg ruin (150, 40), Flakturm (206, −16), Maschinenhalle (220, 94), Beamtentor (254, 70; walk-through), Bahnhof Gesundbrunnen (246, −58; backdrop), Bibliothek am Luisenbad (184, −132), Uferhallen (140, −104), Amtsgericht Wedding (136, −70), ExRotaprint (94, −60), Lampenpalast (6, −150; invented). Reveals: Lampenpalast (own `near`, from the Leopoldplatz and again from the Oudenarder Straße), Beamtentor, Maschinenhalle, Flakturm, Amtsgericht, Wiesenburg |
| Side passages | Hinterhof off the Müllerstraße (40, 6): hidden blessing; walled garden east of the Wiesenburg (166, 42): cache; yard south of ExRotaprint (94, −50): sleeping elite. None in a blocking landmark footprint (test) |
| Rest stops | Späti am Leo (−4, 22), Kiosk am Sommerbad (180, 50), Teestube am Luisenbad (172, −126), Baklava & Döner (102, −84). Away from circles (test) |
| Zone entries | 1 the start; 2 east of the Gerichtstraße arch (120, 50); 3 north of the Brunnenstraße arch (258, −56); 4 the west head of the Pankstraße bridge (112, −52) |

## Engine notes (decided here; check in the step named)

| # | Topic | Decision |
|---|---|---|
| E1 | Ringbahn (step 1) | One plain brick viaduct in `MapDef.viaducts`, drawn as Charlottenburg's (`buildStadtbahn(…, plain)`, `buildArches`). Where the Panke passes, two runs end at the banks and a girder span is drawn over the water (render only); if a run cannot end at water, the Panke passes through an arch like a street. The cutting at Gesundbrunnen is not modelled. S Wedding is a station sign and platform edge on the viaduct, not walkable |
| E2 | Open halls (step 1) | Maschinenhalle and Lampenhof as the KaDeWe Lichthof and the Orangerie: `OPEN_PARTS` walls with door gaps, low wall on the camera side, tall wall on the north side. The hall keeps its crane rails and the crane bridge only over the north half. No interior renderer, no new cutaway; `Landmark.cut` only if the blockout shows the hero hidden |
| E3 | Palace gate (step 1) | The south side of the Lampenhof is a fence with a collider (`Wall.kind: 'fence'`) and a gate that never opens during the run; the Schulstraße ends at the Korso jam (a street-end barricade made of the wedding cars). Test: with the east entry closed, a flood fill from the start does not reach the Lampenhof |
| E4 | Panke (step 1) | An ordinary river polyline, narrow. Check the smallest width the river and bridge code accepts (bridges are at least river width + 12 m long); widen to 8 or 9 m if needed. It is a real barrier: only the two bridges cross it |
| E5 | Lampions (step 3) | No light per lampion. Paper bodies and halo cards go into the chunk's glow batch, the cord is a thin strip; placed by a generator in `src/data` along feast streets (denser than string lights: every 20 to 30 m, two cords per crossing), fixed in data so sim and render agree. They count for light coverage as string lights do. At most 16 triangles each, 60 per chunk. Colours: the existing string-light colour, every sixth the existing teal |
| E6 | Colours and materials (step 3) | Map doc › Performance: 0 new glow colours for gold and emerald, 1 for ruby at hall fronts and the palace; at most two new materials (cloth atlas, sign atlas), both code-painted placeholders first. Say the cost in the step's handover |
| E7 | Sky and weather (step 3) | One `WEDDING_SKY` in `src/render/sky.ts`; `WEDDING_WEATHER` per zone. `petals` and `sparks` are new `WeatherKind`s only if a recolour of `leaves` and `ash` needs a kind of its own; no new particle system |
| E8 | Heights (step 1) | Only the Humboldthöhe (soft hill, the fight on the flat top, the Flakturm on its north flank with a collider) and gentle relief in the park. No terraces; steps at the palace and the Amtsgericht are dressing |
| E9 | Tables and stalls (step 3) | The Lange Tafel and the market stalls are fixed props with colliders, 0.9 to 1.1 m high, in rows with a gap of at least 2.5 m every 6 m. Inside a fight circle they count against the 80 % rule |
| E10 | Neighbours (step 3) | No crowd, no new NPC system: the keepers of the four rest stops, guests as lit silhouettes in the window texture of hall fronts |
| E11 | District rule (steps 2, 5) | Only from existing parts. Recommended: honey puddles through `Level.speedAt` (the tunnel flood rule) with a `MapDef` flag as `wet` and `shards` |
| E12 | Flavour (steps 1, 5) | `MapDef.flavor: 'fest'`, render only until step 5 (Zeitlose as building crew and estate agents); district 5 |

## Invariants and tests (`src/data/wedding.test.ts`, scale 1 and 1.3)

- The guideline list: wave and boss counts (8, 8, 8, 3 and 4 bosses), rising tier, start, zone entries and fight centres free, circles 80 % open, bridges walkable, water blocks, lots off streets and water, more lots at 1.3, light coverage and lamp rules, every 20 m of street has something, closed edges by flood fill, streets end in a barricade, one rest stop per zone.
- Octants of the geography table from the start; order along the Panke (Luisenbad, Uferhallen, Amtsgericht, Brunnenplatz, Ringbahn, Wiesenburg) and along the Ringbahn.
- The Panke is crossed only on the two bridges; the Ringbahn only through the Gerichtstraße and Brunnenstraße arches; the park only through its two gates and the breach.
- The Lampenhof is reached only from the east (E3). The Maschinenhalle is walk-through from the breach to the Beamtentor.
- Side passages, guards and hidden blessings stand in no blocking landmark footprint; no light or pool more than 2 m inside a fight circle.
- A scripted run reaches victory; the smoke test loads `?map=wedding&profile=Leistung&seed=7&autostart`.

## Text drafts (Opus finalises)

Banner „Wedding · kommt bald“; district card „Gold, Tee und Baklava. Sultan Nimmersatt lässt keinen Gast gehen.“; zone names „Leopoldkiez“, „Humboldthain“, „Gesundbrunnen“, „Das ewige Fest“; gate „Geschlossene Gesellschaft“; banner on the Neubau „Der Wedding kommt bald“; billboards „Eröffnung: bald“; win „Wedding ist da“.

## Handover 2026-11-21 (step 0) [Claude · Fable high]

- Found in 2D: the final board (already here as `docs/style/wedding.png`), three exploration boards with prompts, the story section and the no-BVG rule. No map, enemies, items or backlog item for Wedding. Reused: board, story, tone rules, the ported systems.
- Geography: about 80 places looked up on Nominatim, 20 on the map, all octants match. Streets, the Panke line and the AEG extent are placeholders; the facts listed as memory in the map doc are unverified. Overpass was blocked in the cloud session.
- Proposed and not confirmed by Johannes: layout A, look A (G1), chain place and U9 (G2), tier 40 to 62, the Lampenpalast in the Osram-Höfe, the four boss figures.
- Open for other plans: the finale's last line now starts in Wedding (map doc W3); `lines.ts` still says Charlottenburg ends the network.
- Step 2 (enemy spec) does not depend on the layout pick and can start now.
