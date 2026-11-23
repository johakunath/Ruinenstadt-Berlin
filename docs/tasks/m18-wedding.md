# M18 Wedding, district 6 [plan: Claude · Fable high; build: Claude · Opus high]

Wedding becomes a district (Johannes, 2026-11-21). Concept, decisions W1 to W9, geography check, the Magendoktor facts, enemy outline and 2D reuse: `docs/maps/wedding.md`. Picked: layout C2 `docs/mockups/m18-wedding-c2.svg` and look A `docs/mockups/m18-wedding-look.svg`; both schematic, the anchors below rule. Template: `docs/tasks/m16-charlottenburg.md` and its code. The id M18 was also the endless mode step (built, `src/sim/director.ts`); this file is the district.

Status: done. Step 0 done, step 1 merged (PR #81), step 2 merged (PR #80), step 3 flow merged (PR #85), step 3 sights in the PR named in the handover.

**Scope rule for every session (Johannes, 2026-11-21): small and recycled.** Reuse builders, props, lot types, brains and bodies that exist; build new only what this file names. It does not have to match the other maps, but it has to be decent: readable, no empty stretch, no dark street. When in doubt, do less and write it into the handover.

## Steps (three Opus high sessions)

| # | Session | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept, geography check, decisions, mockups, plan | | Fable high | done 2026-11-21 |
| 1 | **Map.** Data `src/data/wedding.ts` from the anchors below and tests `src/data/wedding.test.ts` at scale 1 and 1.3 (as `charlottenburg.test.ts`, with the collider flood fill); map SVG `docs/maps/wedding.svg` shown in chat. `?map=wedding`: wiring (`options.ts`, `ui/maps.ts` with freed id 5, `main.ts` banner „Wedding · kommt bald“, bot `mapLevelOf`, `tools/balance.mjs --map=wedding`), `src/render/wedding-world.ts` with massing for the eight sights, the Panke, the plain brick Ringbahn, the hill, the roofless hall. The Magendoktor as a walk-in room with its brawl and boss (E2). The look: `WEDDING_SKY`, weather, lampion chains, awnings, carpets, the Lange Tafel, market stalls, scaffold nets and banners (E4 to E7). Stand-in bosses and enemies; district 5, tier 40 to 62. Smoke test. No title, victory or network link | 0 | Opus high | merged (PR #81) |
| 2 | **Enemies, bosses, loot.** A short spec `docs/tasks/m12e-wedding-enemies.md` (format of `m12d-charlottenburg-enemies.md`, half its length), then the build: Zecher skins, three board enemies, four bosses (boss 1 is Der Zugezogene, the hipster in the pub), Kodex, sounds from existing sets, the small loot selection. Input: map doc › Enemies. Update `docs/enemy-pipeline.md` and `docs/equipment-pipeline.md`. Does not edit `src/data/wedding.ts` unless step 1 is merged; otherwise the swaps go into the handover | 0 (parallel to 1) | Opus high | built 2026-11-21, draft PR #80; wired into `wedding.ts` after PR #81 (handover in `m12e-wedding-enemies.md`) |
| 3 | **Sights and finish.** The six new sights from photos (`docs/maps/landmarks.md`; look at the photos yourself), built worn: Alte Nazarethkirche, Zum Magendoktor (front and interior), Amtsgericht, Flakturm, Beamtentor, Hochzeitspalast in the Maschinenhalle; the Neubau im Gerüst from existing crane, scaffold and block parts; the U entrance is the existing kind. A light plan per sight (as `charlottenburg-lights.ts`), reveals. Swap the stand-ins for the step 2 roster and set the wave mix. Flow: U9 tunnel (line 4, `LineDef` with `name`, tier as the U2 west pattern), network stop `map: 'wedding'`, title and victory links, camp radio line. Rows for Codex in `docs/asset-pipeline.md` (cloth atlas, sign atlas), screenshots (street, fight, each sight), rows in `docs/tasks/pt-hardware-checks.md`, `docs/status.md`, the queue | 1 merged, 2 merged | Opus high | done 2026-11-23: flow PR #85, sights in the following PR (handover step 3) |

## Anchors (layout C2, scale 1, meters, +X east, +Z south)

Bounds x −55 … 280, z −105 … 125 (335 × 230). Start (0, 0) at the U Leopoldplatz entrance (landmark at (−6, 6), so no generated lot lands on the start); it is the origin of the geography table. Anchors may move up to about 10 m for circles and lots; octants and the order along the Ringbahn must hold (test), and places near an octant border move only away from it.

| Zone | Fights (id, x, z, waves) | Boss |
|---|---|---|
| 1 Leopoldkiez | wochenmarkt (28, −14, 2), muellerstrasse (20, 26, 3), magendoktor (98, 46, 2; inside, E2) | in the same room, after the two waves: Der Zugezogene |
| 2 Panke | uferterrasse (138, −22, 3) | brunnenplatz (154, −52): Das Hauptgericht |
| 3 Gesundbrunnen & Humboldthain | badstrasse (220, −74, 3), rosengarten (242, 6, 3), humboldthoehe (208, 8, 2; calm: 0.7 count, no elites, flyers) | beamtentor (260, 60): Der Ewige Bauherr |
| 4 Das ewige Fest | langetafel (218, 66, 3) | hochzeitspalast (204, 104): Sultan Nimmersatt |

8 fight places, 21 waves (7, 3, 8, 3), 4 bosses. The Magendoktor counts once: it holds the last two waves of zone 1 and the zone 1 boss, so there are three boss arenas of their own. If E2's fallback splits the pub into two encounters, both sit at (98, 46) and still count as one place. Route order as listed. Circles r 13 to 15 except the Magendoktor. Every circle except the pub needs 80 % open ground (test), so: the Wochenmarkt keeps its stalls on the rim and at most four inside as cover; the Müllerstraße fight gets a widened pavement; the Uferterrasse is a paved quay between the Pankstraße and the stream, no water inside the circle; the Badstraße fight a small square; the Rosengarten a round lawn; the Beamtentor a forecourt set back from the Brunnenstraße; the Lange Tafel has its tables on the rim and two rows inside; the hall is at least 56 × 30 m clear.

| Thing | Where |
|---|---|
| Panke | A stream about 7 m wide, north edge to south edge: (124, −105), (122, −70), (118, −30), (122, −6), (130, 14), under the Ringbahn at (138, 30), (132, 56), (118, 90), (104, 125). Stone quays. One bridge: Pankstraße (120, −6; route). The line is a placeholder (map doc) |
| Ringbahn | Plain brick viaduct, solid runs: (−55, 96), (60, 68), (108, 62), (138, 30), (170, 0), (200, −28), (235, −44), (280, −52). Arches: Brunnenstraße (262, −49; route), the Panke (138, 30; water only), Müllerstraße at S Wedding (60, 68; closed by a barricade). Station signs „S Wedding“ and „Gesundbrunnen“ on the brick, no station building |
| Unbuilt corners | South of the Ringbahn and west of x 160; north of z −60 and west of x 115. No lots, no props, dark ground, `noSpawn`; closed off by the viaduct, the Blockrand north of the Leopoldplatz and the Panke. Never in view |
| Leopoldplatz | Paved square (−10, −44), (40, −74), (58, −54), (14, 6); a closed Blockrand row along its north side |
| Nettelbeckplatz | Paved square about (78 … 112, 2 … 34); the Magendoktor closes its south side. No fight here: parasols, a barrel table, lampions |
| Zum Magendoktor | Footprint centre (98, 46), about 19 × 14 outside, 18 × 13 inside; front to the north with a door at (98, 39); ground floor only, flat roof (E2) |
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
| E2 | Zum Magendoktor | A walk-in room on the Späti pattern, one source for colliders and render: `src/data/kneipe.ts` beside `spati.ts`. Layout as Johannes described it (map doc, floor plan in `m18-wedding-c2.svg`): seen from the door, the corner table with its bench on the right, the toilet behind it on the right (a closed door, a solid box), the bar with four high stools and the back shelf on the left, the pool table in the back behind the bar, three small tables in the middle as obstacles; jukebox, slot machines and dart board on the walls. Lanes between pieces at least 1.8 m; every free cell connects to the door (flood fill test). Roof and upper walls in their own group, hidden while the hero is inside, with the Späti's `follow` hook; the south wall stays knee high. The fight: the whole room is the arena, so the 80 % rule and the 13 m rule do not apply here. One encounter centred in the room with a radius that covers it (about 11), walls keep everyone in; spawns only on free cells inside the room or through the door (test); `maxAlive` 6, 0.6 of the usual count; two waves of Zecher, then the boss as the third wave with two adds, which counts as the zone 1 boss (full heal). If one encounter cannot hold normal waves and a boss, use two encounters at the same spot, the second starting when the first is won. Three sleeping guards at tables. Hide the part of the ring outside the walls if that is a small change. The pub is no rest stop |
| E3 | Maschinenhalle | As the KaDeWe Lichthof: `OPEN_PARTS` walls with door gaps, low wall on the camera side, tall wall on the north side with the palace front and the throne. No interior renderer, no new cutaway |
| E4 | Lampions | No light per lampion. Paper bodies and halo cards go into the chunk's glow batch, the cord is a thin strip; placed in data along the route streets (every 20 to 30 m, denser at the Lange Tafel and the market), so sim and render agree. They count for light coverage as string lights do. At most 16 triangles each, 60 per chunk. Colours: the string-light colour, every sixth the existing teal |
| E5 | Colours and materials | No new glow colour. At most two new materials (cloth atlas, sign atlas), code-painted placeholders. Awnings and carpets reuse the Charlottenburg canopy and flat decal builders with new colours; scaffold nets use the scaffold and tarp of `landmark-wear.ts` with an emerald tint |
| E6 | Sky and weather | One `WEDDING_SKY` in `src/render/sky.ts` (no zone blend); `WEDDING_WEATHER` from existing kinds only (map doc) |
| E7 | Lots and props | No new lot types: `markt` on the Leopoldplatz, `hinterhof`, `baustelle` (with the „kommt bald“ billboard as its sign), `truemmer`, `parkplatz`. Tables and stalls are fixed props with colliders, 0.9 to 1.1 m high, with a gap of at least 2.5 m every 6 m. Wedding cars with ribbons are the existing cars with a recolour, used as wrecks and in the barricades |
| E8 | Heights | Only the Humboldthöhe (soft hill, the fight on the flat top, the Flakturm on its north flank with a collider). No terraces |
| E9 | Flavour and rule (steps 1, 2) | `MapDef.flavor: 'fest'`, render only (Zecher skins); district 5. The honey rule is optional (map doc) |
| E10 | Neighbours | No crowd, no new NPC system |

## Invariants and tests (`src/data/wedding.test.ts`, scale 1 and 1.3)

- The guideline list: wave and boss counts (7, 3, 8, 3 and 4 bosses), rising tier, start, zone entries and fight centres free, circles 80 % open except every encounter at the Magendoktor (E2; it has its own room tests below), the bridge walkable, water blocks, lots off streets and water, more lots at 1.3, light coverage and lamp rules, every 20 m of route street has something, closed edges by flood fill, streets end in a barricade, one rest stop per zone.
- Octants of the geography table from the start; the Magendoktor south of the Nettelbeckplatz and north of the Ringbahn.
- The Panke is crossed only on the bridge; the Ringbahn only through the Brunnenstraße arch; the park only through its two gates; the AEG yard only through the Beamtentor.
- The Magendoktor: the door walks in, walls and furniture hold, every free cell connects to the door, lanes are at least 1.8 m, no enemy spawns in a wall or a piece of furniture, the boss comes after the two waves.
- Nothing is placed or reached in the two unbuilt corners.
- Side passages, guards and hidden blessings stand in no blocking landmark footprint.
- A scripted run reaches victory; the smoke test loads `?map=wedding&profile=Leistung&seed=7&autostart`.

## Text drafts (the sessions finalise)

Banner „Wedding · kommt bald“; district card „Gold, Tee und Baklava. Sultan Nimmersatt lässt keinen Gast gehen.“; zone names „Leopoldkiez“, „Panke“, „Humboldthain“, „Das ewige Fest“; pub sign „Zum Magendoktor“, box sign „Tag u. Nacht“; banner on the Neubau „Der Wedding kommt bald“; billboards „Eröffnung: bald“; win „Wedding ist da“.

## Decisions in step 3 (2026-11-23, Johannes: no open questions, decide and record)

| # | Topic | Decision |
|---|---|---|
| S1 | U9 on the network | Line 4 `{ id: 'U9', color: '#f3791d', ghost: 'Westhafen', name: 'U9-Tunnel' }` (BVG orange); stop 5 Wedding at (77, 42) north of Zoo and Mitte; the route bends west round the Mitte label. Waves: Charlottenburg zone 0 to the ghost station, Wedding zone 0 (Tee-Ifrit, no carpets: no tunnel has flyers) after it, at the Charlottenburg late tier 49 to 54 |
| S2 | Wedding's victory | Leads back to Köpenick as Charlottenburg's did; the finale session replaces this one link (`wonLink('wedding')` in `src/ui/maps.ts`) |
| S3 | Alte Nazarethkirche | Footprint turned narrow and deep (14 × 19, was 18 × 12), no tower: the photos show a towerless Schinkel hall; the step 1 tower was the Neue Nazarethkirche behind it |
| S4 | Hochzeitspalast | No domes (W8: they read as a mosque from above); a central attic with a crown, urns, a balustrade instead. The chandeliers hang on a wire in front of the palace, at the boss circle's north rim (the rim rule) |
| S5 | Lights | One plan per sight in `src/render/wedding-lights.ts`, drawn by the Charlottenburg runner (`lightLandmarks`); the pub's lamps moved there from its builder. No new colour |
| S6 | Worn | The shared landmark wear plus Charlottenburg's worn-surface pass (`wornBuild`) on church, court, gate and hall; the Flakturm keeps concrete with hand graffiti and ivy |

## Handover 2026-11-23 (step 3) [Claude · Opus high]

- Built: `src/render/wedding-sights.ts` (six sights and the Neubau from photos, budgets: church 1.7k, court 4.6k, Flakturm 2.1k, gate 1.9k, hall and palace 6.5k, pub 2.3k triangles), `wedding-lights.ts` with tests, five reveals (the Amtsgericht starts at 16 m for scale 1.3), the pub front (mural, sticker door, windows); sign atlas 2 × 12 cells (T11), cloth atlas row T12. Flow (PR #85): U9, stop, links, camp radio, bot `tunnel4`.
- Photos checked the map doc's memory: see the map doc › Geography check. The Magendoktor has no photo on Commons; its front stays on the step 0 press-photo notes.
- Wave mix: the step 2 roster everywhere (no stand-ins); the pub and the U9 use the plain kinds as Zecher (pub) or Zeitlose (tunnel).
- Bot: `--map=wedding --carry` 3/3 won, no deaths, 16.3 min, lowest life 87 % (the Sultan 47 % damage taken); the carried hero barely gets hurt here, so Wedding plays easy after Charlottenburg. For the balance session (W4, B2); no numbers changed here. `--campaign` 1 run: all 11 maps won, U9 15.9 min.
- Proof: `docs/proof/m18-wedding/step3/` (day sheet, a reveal per sight, street, fight). Leistung readout (cloud): start 175 / 122k, Nettelbeckplatz 125 / 86k, Brunnenstraße 159 / 128k, Maschinenhalle 166 / 172k.
- Open for the finale session: `wonLink('wedding')`, its own stop and unlock. Hardware: `pt-hardware-checks.md` row 61.

## Handover 2026-11-21 (step 1) [Claude · Opus high]

- Built: `src/data/wedding.ts` and `kneipe.ts` with 37 invariant tests at scale 1 and 1.3 (`wedding.test.ts`), `docs/maps/wedding.svg`, `src/render/wedding-world.ts`, `WEDDING_SKY`, `WEDDING_WEATHER`, the `lampions` prop, wiring (`?map=wedding`, freed id 5, bot, `balance.mjs --map=wedding`), a smoke test. Proof in `docs/proof/m18-wedding/`. 2D has no Wedding map; nothing to reuse beyond the board.
- Johannes after the first review (2026-11-21): the Magendoktor is turned 180° (door south toward the camera, the hero walks in upwards from a cobbled forecourt by the Ringbahn, which moved south there; the Lindower Straße ends in it; the Nettelbeckplatz lies behind the pub). BVG bus and tram liveries are fine; the BVG van wreck is an 8 m midibus in a lighter yellow on every map (`VAN` in `world.ts`, collider 2.2 × 8).
- Moved from the anchors: Brunnenstraße to x 272 and the east bound to 296, park fence and gates on x 262.5; AEG yard x 160 to 240, the Beamtentor at (240, 60) with its boss on the forecourt (257, 60); hall 60 × 34 at (196, 105), door at (226, 104); Teestube in the yard at (234, 111); Wochenmarkt (24, −20), Müllerstraße fight (22, 32), Flakturm (207, −12), Neubau (−44, 4), U entrance (−3, −9); the Müllerstraße ends at (−48, −52) in a barricade.
- Engine notes: E1 girder span (the runs end in the water); E2 one encounter with `EncounterDef.room` (18 × 13 inside): it starts when the hero is inside, every body and the boss come from free cells in the room (`roomSpot` in the director), generated fight cover skips it; two waves, then the boss as the third wave (full heal), three sleepers; E3 `openHall`; E4 lampions as a prop kind (one pooled spot per chain); E5 one new material (sign atlas: shop, station, rest stop and pub signs). New: `Wall.kind 'brick'`, `flavor: 'fest'` (render only).
- Stand-ins for step 2: bosses Feldwebel (Der Zugezogene), Brandmeister, Volkskoloss, Hauptmann (`WEDDING_BOSSES`); waves walker, runner, brute, spitter, crow, rat (`weddingWaveTier`).
- Leistung readout (cloud, draw calls / triangles): start 172 to 222 / 126k to 193k, Nettelbeckplatz 131 / 94k, Brunnenstraße at the park 184 to 201 / 161k to 167k, Maschinenhalle 136 / 116k; pub 130 to 171 / 115k to 148k.
- For step 3: replace the massing in `wedding-world.ts` (the U entrance, the palace front with warm uplights and glowing gilding, the rest stop signs and hand rows on the thin Pankstraße, Badstraße and Lindower Straße are step 1 versions); reveals are not set.

## Handover 2026-11-21 (step 0) [Claude · Fable high]

- Found in 2D: the final board (already here as `docs/style/wedding.png`), three exploration boards with prompts, the story section and the no-BVG rule. No map, enemies, items or backlog item for Wedding. Reused: board, story, tone rules, the ported systems.
- Geography: about 80 places looked up on Nominatim, 14 on the map, all octants match. Streets, the Panke line and the AEG extent are placeholders; the facts listed as memory in the map doc are unverified. Overpass was blocked.
- Johannes picked layout C (trimmed here to C2), look A and the chain place after Charlottenburg; he added the Magendoktor and the small scope (map doc W1 to W9).
- Magendoktor: one press photo of the front was looked at; no interior photo was found (Wikimedia 429). The interior layout is Johannes' own description (2026-11-21); only the places of jukebox, slot machines and dart board are guessed. The boss there is a hipster, Der Zugezogene (Johannes: no Stammgast).
- Charlottenburg step 8 is merged (`LineDef.name`, `tunnelName`, the U2 west flow), so step 3 can build the U9 the same way.
- Open for other plans: the finale's last line now starts in Wedding; `lines.ts` still says Charlottenburg ends the network.
