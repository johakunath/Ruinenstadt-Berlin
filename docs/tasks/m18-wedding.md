# M18 Wedding, district 6 [plan: Claude · Fable high; build: Claude · Opus high]

Wedding becomes a district (Johannes, 2026-11-21). Concept, decisions W1 to W9, geography check, the Magendoktor facts, enemy outline and 2D reuse: `docs/maps/wedding.md`. Picked: layout C2 `docs/mockups/m18-wedding-c2.svg` and look A `docs/mockups/m18-wedding-look.svg`; both schematic, the anchors below rule. Template: `docs/tasks/m16-charlottenburg.md` and its code. The id M18 was also the endless mode step (built, `src/sim/director.ts`); this file is the district.

Status: step 0 done, step 1 running, step 2 built (draft PR), step 3 starts when steps 1 and 2 are merged.

**Scope rule for every session (Johannes, 2026-11-21): small and recycled.** Reuse builders, props, lot types, brains and bodies that exist; build new only what this file names. It does not have to match the other maps, but it has to be decent: readable, no empty stretch, no dark street. When in doubt, do less and write it into the handover.

## Steps (three Opus high sessions)

| # | Session | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept, geography check, decisions, mockups, plan | | Fable high | done 2026-11-21 |
| 1 | **Map.** Data `src/data/wedding.ts` from the anchors below and tests `src/data/wedding.test.ts` at scale 1 and 1.3 (as `charlottenburg.test.ts`, with the collider flood fill); map SVG `docs/maps/wedding.svg` shown in chat. `?map=wedding`: wiring (`options.ts`, `ui/maps.ts` with freed id 5, `main.ts` banner „Wedding · kommt bald“, bot `mapLevelOf`, `tools/balance.mjs --map=wedding`), `src/render/wedding-world.ts` with massing for the eight sights, the Panke, the plain brick Ringbahn, the hill, the roofless hall. The Magendoktor as a walk-in room with its fight (E2). The look: `WEDDING_SKY`, weather, lampion chains, awnings, carpets, the Lange Tafel, market stalls, scaffold nets and banners (E4 to E7). Stand-in bosses and enemies; district 5, tier 40 to 62. Smoke test. No title, victory or network link | 0 | Opus high | running |
| 2 | **Enemies, bosses, loot.** A short spec `docs/tasks/m12e-wedding-enemies.md` (format of `m12d-charlottenburg-enemies.md`, half its length), then the build: Zecher skins, three board enemies, four bosses, Kodex, sounds from existing sets, the small loot selection. Input: map doc › Enemies. Update `docs/enemy-pipeline.md` and `docs/equipment-pipeline.md`. Does not edit `src/data/wedding.ts` unless step 1 is merged; otherwise the swaps go into the handover | 0 (parallel to 1) | Opus high | built 2026-11-21, draft PR; swaps for step 3 in `m12e-wedding-enemies.md` › Handover |
| 3 | **Sights and finish.** The six new sights from photos (`docs/maps/landmarks.md`; look at the photos yourself), built worn: Alte Nazarethkirche, Zum Magendoktor (front and interior), Amtsgericht, Flakturm, Beamtentor, Hochzeitspalast in the Maschinenhalle; the Neubau im Gerüst from existing crane, scaffold and block parts; the U entrance is the existing kind. A light plan per sight (as `charlottenburg-lights.ts`), reveals. Swap the stand-ins for the step 2 roster and set the wave mix. Flow: U9 tunnel (line 4, `LineDef` with `name`, tier as the U2 west pattern), network stop `map: 'wedding'`, title and victory links, camp radio line. Rows for Codex in `docs/asset-pipeline.md` (cloth atlas, sign atlas), screenshots (street, fight, each sight), rows in `docs/tasks/pt-hardware-checks.md`, `docs/status.md`, the queue | 1 merged, 2 merged | Opus high | open |

## Anchors (layout C2, scale 1, meters, +X east, +Z south)

Bounds x −55 … 280, z −105 … 125 (335 × 230). Start (0, 0) at the U Leopoldplatz entrance (landmark at (−6, 6), so no generated lot lands on the start); it is the origin of the geography table. Anchors may move up to about 10 m for circles and lots; octants and the order along the Ringbahn must hold (test), and places near an octant border move only away from it.

| Zone | Fights (id, x, z, waves) | Boss |
|---|---|---|
| 1 Leopoldkiez | wochenmarkt (28, −14, 2), muellerstrasse (20, 26, 3), magendoktor (98, 46, 3; inside, r 8, E2) | nettelbeckplatz (94, 16): Der Stammgast |
| 2 Panke | uferterrasse (138, −22, 3) | brunnenplatz (154, −52): Das Hauptgericht |
| 3 Gesundbrunnen & Humboldthain | badstrasse (220, −74, 3), rosengarten (242, 6, 3), humboldthoehe (208, 8, 2; calm: 0.7 count, no elites, flyers) | beamtentor (260, 60): Der Ewige Bauherr |
| 4 Das ewige Fest | langetafel (218, 66, 3) | hochzeitspalast (204, 104): Sultan Nimmersatt |

8 fights, 22 waves (8, 3, 8, 3), 4 bosses. Route order as listed. Circles r 13 to 15 except the Magendoktor. Every circle needs 80 % open ground (test), so: the Wochenmarkt keeps its stalls on the rim and at most four inside as cover; the Müllerstraße fight gets a widened pavement; the Uferterrasse is a paved quay between the Pankstraße and the stream, no water inside the circle; the Badstraße fight a small square; the Rosengarten a round lawn; the Beamtentor a forecourt set back from the Brunnenstraße; the Lange Tafel has its tables on the rim and two rows inside; the hall is at least 56 × 30 m clear.

| Thing | Where |
|---|---|
| Panke | A stream about 7 m wide, north edge to south edge: (124, −105), (122, −70), (118, −30), (122, −6), (130, 14), under the Ringbahn at (138, 30), (132, 56), (118, 90), (104, 125). Stone quays. One bridge: Pankstraße (120, −6; route). The line is a placeholder (map doc) |
| Ringbahn | Plain brick viaduct, solid runs: (−55, 96), (60, 68), (108, 62), (138, 30), (170, 0), (200, −28), (235, −44), (280, −52). Arches: Brunnenstraße (262, −49; route), the Panke (138, 30; water only), Müllerstraße at S Wedding (60, 68; closed by a barricade). Station signs „S Wedding“ and „Gesundbrunnen“ on the brick, no station building |
| Unbuilt corners | South of the Ringbahn and west of x 160; north of z −60 and west of x 115. No lots, no props, dark ground, `noSpawn`; closed off by the viaduct, the Blockrand north of the Leopoldplatz and the Panke. Never in view |
| Leopoldplatz | Paved square (−10, −44), (40, −74), (58, −54), (14, 6); a closed Blockrand row along its north side |
| Nettelbeckplatz | Paved square about (78 … 112, 2 … 34); the Magendoktor closes its south side |
| Zum Magendoktor | Footprint centre (98, 46), about 23 × 18 outside, 22 × 17 inside; front to the north with a 3 m door at (98, 37); ground floor only, flat roof (E2) |
| Humboldthain | Park south of the Ringbahn: (170, −34), (258, −44), (258, 40), (196, 40), (170, 30); fenced, gates east (258, 6) and south-east (256, 38). Humboldthöhe: soft hill 7 m, centre (208, 8), radius about 30, flat top for the fight. Paths: east gate → Rosengarten → summit → south-east gate |
| AEG grounds | Walled yard (168 … 246, 46 … 122). Beamtentor (246, 60) in its east wall, walk-through from the Brunnenstraße forecourt. Maschinenhalle (204, 104), about 60 × 36, roofless (E3), door gap in its east wall at (234, 104). Extent is a placeholder |
| Streets | Müllerstraße (Hauptstraße, no tram): (−50, −52) construction fence, (−6, 2), (20, 28), (58, 64) barricade. Schulstraße (side): (10, 4), (46, −50) barricade. Lindower Straße (side; route): (52, 58), (72, 52), (84, 36). Reinickendorfer Straße (stub): (88, −10) barricade, (92, 6). Pankstraße (side; route): (104, 8), (120, −6), (146, −34), (154, −52), (190, −88), (204, −102) barricade. Badstraße (Hauptstraße; route): (190, −88), (222, −72), (250, −58), (262, −49). Brunnenstraße (Hauptstraße; route in two stretches, arch to east gate and park corner to Beamtentor): (262, −49), (262, 6), (262, 60), (262, 125) barricade |
| Blockrand | Tall rows where they do not stand between camera and street (guideline › Blockrand): north-east side of the Müllerstraße and the Badstraße, north side of the Lindower Straße is the Kiez block, both sides of the Brunnenstraße, north side of the Pankstraße. Shops and ruins on the camera side. `strictLots: true` |
| Sights (8) | U Leopoldplatz entrance (−6, 6; existing kind), Alte Nazarethkirche (2, −28; backdrop), Neubau im Gerüst with crane and banner (−40, −14; invented, existing parts), Zum Magendoktor (98, 46), Amtsgericht Wedding (142, −76), Flakturm (206, −16), Beamtentor (246, 60), Hochzeitspalast in the Maschinenhalle (204, 104). Reveals: Magendoktor, Amtsgericht, Flakturm, Beamtentor, Hochzeitspalast |
| Side passages (2) | Hinterhof off the Müllerstraße (40, 6): hidden blessing; the bunker door west of the Flakturm (188, −14): cache. Not in a blocking footprint (test) |
| Rest stops | Späti am Leo (−4, 22), Baklava & Döner (176, −58), Kiosk am Rosengarten (271, −14), Teestube im Werkhof (238, 116). All the existing Späti with another sign. Away from circles (test) |
| Zone entries | 1 the start; 2 the east head of the Pankstraße bridge (126, −10); 3 the Badstraße corner (192, −86); 4 inside the Beamtentor (240, 62) |

## Engine notes (decided here; all for step 1 unless named)

| # | Topic | Decision |
|---|---|---|
| E1 | Ringbahn and Panke | The viaduct is `MapDef.viaducts`, drawn as Charlottenburg's plain brick (`buildStadtbahn(…, plain)`, `buildArches`). Where the Panke passes, two runs end at the banks and a girder span is drawn over the water; if a run cannot end at water, the Panke passes through an arch like a street. The Panke is an ordinary river polyline; widen it to 8 or 9 m if the river or bridge code needs it |
| E2 | Zum Magendoktor | A walk-in room on the Späti pattern, one source for colliders and render: `src/data/kneipe.ts` beside `spati.ts` (walls, door, counter, back shelf, billiard table, jukebox, slot machines, Stammtisch, round tables; furniture low toward the camera, tall pieces on the side walls). Roof and upper walls in their own group, hidden while the hero is inside, with the Späti's `follow` hook; the south wall stays knee high. The fight is an ordinary encounter with r 8 centred in the room: an exception to the 13 m rule, with `maxAlive` 6 and 0.6 of the usual count; spawns on the rim are inside the room. Three sleeping guards at tables. If r 8 breaks a sim assumption (spawn ring, rollback, ring render), use r 10 and a room 24 × 21. The pub is no rest stop |
| E3 | Maschinenhalle | As the KaDeWe Lichthof: `OPEN_PARTS` walls with door gaps, low wall on the camera side, tall wall on the north side with the palace front and the throne. No interior renderer, no new cutaway |
| E4 | Lampions | No light per lampion. Paper bodies and halo cards go into the chunk's glow batch, the cord is a thin strip; placed in data along the route streets (every 20 to 30 m, denser at the Lange Tafel and the market), so sim and render agree. They count for light coverage as string lights do. At most 16 triangles each, 60 per chunk. Colours: the string-light colour, every sixth the existing teal |
| E5 | Colours and materials | No new glow colour. At most two new materials (cloth atlas, sign atlas), code-painted placeholders. Awnings and carpets reuse the Charlottenburg canopy and flat decal builders with new colours; scaffold nets use the scaffold and tarp of `landmark-wear.ts` with an emerald tint |
| E6 | Sky and weather | One `WEDDING_SKY` in `src/render/sky.ts` (no zone blend); `WEDDING_WEATHER` from existing kinds only (map doc) |
| E7 | Lots and props | No new lot types: `markt` on the Leopoldplatz, `hinterhof`, `baustelle` (with the „kommt bald“ billboard as its sign), `truemmer`, `parkplatz`. Tables and stalls are fixed props with colliders, 0.9 to 1.1 m high, with a gap of at least 2.5 m every 6 m. Wedding cars with ribbons are the existing cars with a recolour, used as wrecks and in the barricades |
| E8 | Heights | Only the Humboldthöhe (soft hill, the fight on the flat top, the Flakturm on its north flank with a collider). No terraces |
| E9 | Flavour and rule (steps 1, 2) | `MapDef.flavor: 'fest'`, render only (Zecher skins); district 5. The honey rule is optional (map doc) |
| E10 | Neighbours | No crowd, no new NPC system |

## Invariants and tests (`src/data/wedding.test.ts`, scale 1 and 1.3)

- The guideline list: wave and boss counts (8, 3, 8, 3 and 4 bosses), rising tier, start, zone entries and fight centres free, circles 80 % open, the bridge walkable, water blocks, lots off streets and water, more lots at 1.3, light coverage and lamp rules, every 20 m of route street has something, closed edges by flood fill, streets end in a barricade, one rest stop per zone.
- Octants of the geography table from the start; the Magendoktor south of the Nettelbeckplatz and north of the Ringbahn.
- The Panke is crossed only on the bridge; the Ringbahn only through the Brunnenstraße arch; the park only through its two gates; the AEG yard only through the Beamtentor.
- The Magendoktor: the door walks in, walls hold, the ring lies inside the room, no enemy spawns outside it.
- Nothing is placed or reached in the two unbuilt corners.
- Side passages, guards and hidden blessings stand in no blocking landmark footprint.
- A scripted run reaches victory; the smoke test loads `?map=wedding&profile=Leistung&seed=7&autostart`.

## Text drafts (the sessions finalise)

Banner „Wedding · kommt bald“; district card „Gold, Tee und Baklava. Sultan Nimmersatt lässt keinen Gast gehen.“; zone names „Leopoldkiez“, „Panke“, „Humboldthain“, „Das ewige Fest“; pub sign „Zum Magendoktor“, box sign „Tag u. Nacht“; banner on the Neubau „Der Wedding kommt bald“; billboards „Eröffnung: bald“; win „Wedding ist da“.

## Handover 2026-11-21 (step 0) [Claude · Fable high]

- Found in 2D: the final board (already here as `docs/style/wedding.png`), three exploration boards with prompts, the story section and the no-BVG rule. No map, enemies, items or backlog item for Wedding. Reused: board, story, tone rules, the ported systems.
- Geography: about 80 places looked up on Nominatim, 14 on the map, all octants match. Streets, the Panke line and the AEG extent are placeholders; the facts listed as memory in the map doc are unverified. Overpass was blocked.
- Johannes picked layout C (trimmed here to C2), look A and the chain place after Charlottenburg; he added the Magendoktor and the small scope (map doc W1 to W9).
- Magendoktor: one press photo of the front was looked at; no interior photo was found (Wikimedia 429). Step 3 tries again and builds the interior from what it finds; the assumed pieces are marked in the map doc.
- Charlottenburg step 8 is merged (`LineDef.name`, `tunnelName`, the U2 west flow), so step 3 can build the U9 the same way.
- Open for other plans: the finale's last line now starts in Wedding; `lines.ts` still says Charlottenburg ends the network.
