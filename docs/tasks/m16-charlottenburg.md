# M16 Charlottenburg, district 5 [plan: Claude · Fable high; build: Claude · Opus high]

Layout C2 „Spiegelschloss“ (Johannes, 2026-11-19). Concept, decisions C1 to C6, geography check, the 1920 table and 2D reuse: `docs/maps/charlottenburg.md`. Mockups: `docs/mockups/m16-charlottenburg-layouts.svg` (A, B, C), `docs/mockups/m16-charlottenburg-c2.svg` (the revision; schematic, the anchors below rule). Template: `docs/tasks/m15-mitte.md` and its code.

Status: steps 0 to 2 done, steps 3a, 4 and 5 open. Notes are short; whoever builds a step writes its handover here (at most 8 lines).

## Steps (one session each unless noted)

| # | Step | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept, geography check, decisions, plan | | Fable high | done 2026-11-19 |
| 1 | Data `src/data/charlottenburg.ts` from the anchors below, invariant tests `src/data/charlottenburg.test.ts` at scale 1 and 1.3 (as `mitte.test.ts`, with the collider flood fill), map SVG `docs/maps/charlottenburg.svg` shown in chat. Stand-ins for bosses and district enemies; district 4, tier 32 to 54 (C4). Network data in `src/data/lines.ts` (C3) with `lines.test.ts`; `map` on the stop only in step 8 | 0 | Opus high | done 2026-11-19 |
| 2 | Playable blockout `?map=charlottenburg`: wiring (`options.ts`, `ui/maps.ts`, `main.ts` banner „Charlottenburg · 1920“, bot `mapLevelOf`), landmark massing, Spree, Karpfenteich, Stadtbahn viaduct with arches, maze hedges, the two roofless halls, Zoo paths and gates, the locked Ehrenhof gate, smoke test | 1 | Opus high | done 2026-11-19 (Handover › step 2) |
| 3a | Sky per zone: spec (below, *Engine* E1). Which `Sky` fields blend as uniforms, what is baked today, cost, fallback | 1 (reads `sky.ts`, `renderer.ts`, `map-world.ts`, `weather.ts`) | Fable high | open |
| 3b | Look in game: the four times of day (C2) and the street dressing below 5 m (bulb marquees and canopies, searchlight beams, poster columns, gas lanterns, shards, diamond dust, confetti). Johannes tunes each time of day. State the Leistung cost | 2, 3a | Opus high | open |
| 4 | Landmarks from pre-1930 photos (`docs/maps/landmarks.md`; Wikimedia, look at the photos yourself), built worn. Three builders in parallel as in Mitte: City West (Bahnhof Zoo 1882, Löwentor, Elefantentor, Antilopenhaus, Musikpavillon, Aquarium, Ufa-Palast, Capitol shop row, Gedächtniskirche with five towers, Romanisches Café, Gloria-Palast, Marmorhaus, KaDeWe with Lichthof, U Wittenbergplatz hall, Café des Westens); Ku'damm to Oper (Revuepalast and Gläsernes Varieté from the board, Theater des Westens, Deutsches Opernhaus, Schiller-Theater, Technische Hochschule, Rathaus tower); Schloss (central block with dome, Ehrenhof and gate, Neuer Flügel, Orangerie ruin as mirror gallery, Neuer Pavillon, Stülerbauten, Belvedere, Mausoleum, maze pieces, statues). Correct the 1920 table in the map doc | 2 | Opus high | open |
| 5 | Enemy and boss spec (`docs/tasks/m12d-charlottenburg-enemies.md`): the three board enemies, Zeitlose in 1920s dress, the three zone bosses, Die Diamantene Diva, the district rule, wave mix per zone, maze riddles, district loot (set Ornat des Letzten Vorhangs, weapon Schlussapplaus), Kodex lines. Input below | 0 (can run now, parallel to 1 to 4) | Fable high | open |
| 6 | Enemy and boss build (sim, bodies, sounds, Kodex) from the spec; update `docs/enemy-pipeline.md` and `docs/equipment-pipeline.md` | 5 | Opus high | open |
| 7 | Buildings and lot types: mockup first (two lot types per zone, the 1920 facade: stucco Altbau with shop fronts and canopies), then build; 1920s vehicles (cars, double-deck bus, tram, cab); weather per zone | 3b | Opus high, mockup first | open |
| 8 | Flow and balance: U2 tunnel (line 3) from U Potsdamer Platz, title and victory links, network stop `map: 'charlottenburg'`, bot `--map=charlottenburg`, tier | 2, 6, Mitte step 8, the M14/B2 decision (C4) | Opus medium | open |
| 9 | Textures: rows in `docs/asset-pipeline.md` (stucco facade, marquee sign atlas, cut glass and mirror, hedge, gravel parterre, baroque sandstone) | 3b, 4, 7 | Codex | open |
| 10 | Screenshots (street at each time of day, fight, each landmark), PC and Tab S9 playtest; rows in `docs/tasks/pt-hardware-checks.md` | all | Johannes | open |

## Anchors (scale 1, meters, +X east, +Z south)

Bounds x −135 … 185, z −195 … 215 (320 × 410). Start S+U Zoologischer Garten at the Hardenbergplatz (76, 100), beside the station (58, 96) so no generated lot lands on it. Step 2 (E8): the start is on the platform deck and the station moved onto it (≈ 80, 76), north-east of the Hardenbergstraße arch (Handover › step 2). The church (112, 137) is the origin of the geography table.

| Zone | Fights (id, x, z, waves) | Boss |
|---|---|---|
| 1 Zoo & Tauentzien | konzertgarten (124, 86, 2), elefantentor (160, 126, 3), kadewe (148, 203, 3) | kirche (104, 154): boss 1 |
| 2 Ku'damm & Savignyplatz | westens (62, 167, 3), revuepalast (26, 174, 3), savigny (−10, 132, 3) | oper (−45, 68): boss 2 |
| 3 Schlossgarten | schlossstrasse (−76, 25, 2), luisenplatz (−2, −24, 3), irrgarten (−75, −98, 3), karpfenteich (−30, −136, 2; calm: 0.7 count, no elites) | belvedere (−52, −172): boss 3 |
| 4 Spiegelschloss | spiegelgalerie (−116, −50, 3) | ehrenhof (−75, −40): Die Diamantene Diva |

11 fights, 30 waves, 4 bosses. Route order as listed. Every circle needs 80 % open ground (test), so: the Elefantentor gets a forecourt, the Kranzler corner and the Revuepalast a widened pavement or the middle promenade, the KaDeWe hall is at least 30 m clear, the maze has a round clearing (Rondell, r 15) at its centre, the Spiegelgalerie circle lies half in the roofless hall and half on its forecourt, the Ehrenhof is about 44 × 40 clear.

| Thing | Where |
|---|---|
| Spree | east and north edge: in at (185, −22), Schloßbrücke about (16, −72), north along x ≈ 20 … 24, round the garden tip, out west along z ≈ −191; width about 20. The east bank is backdrop. South to north the order is Luisenplatz, Neuer Pavillon, Schloßbrücke (as in reality) |
| Karpfenteich | pond about 54 × 26 around (−70, −142) |
| Stadtbahn | brick viaduct, solid runs with open arches where streets pass: (−135, 164), (−60, 158), (−10, 153), (10, 150), (38, 132), (60, 96), (84, 72), (125, 48), (185, 26). Arches: Bleibtreustraße (−10, 153; route), Kantstraße (about 38, 134), Hardenbergstraße (about 66, 88), Joachimsthaler Straße. Bahnhof Zoo sits on it |
| Zoo | park area east of the viaduct, north of the Budapester Straße: (88, 76), (185, 22), (185, 114), (172, 116), (120, 110), (100, 96); fenced, entered only by the two gates. Path Löwentor (100, 92) → Konzertgarten → Elefantentor (170, 118). Antilopenhaus (150, 76) as side passage |
| Streets | Ku'damm (z ≈ 160 … 193 from the church west, Allee with a middle promenade and tram), Tauentzien (church south-east to the Wittenbergplatz, same profile), Budapester Straße (church east past the Zoo, z ≈ 118 … 128), Hardenbergstraße (start to the church, and north to the Knie), Joachimsthaler Straße, Nürnberger Straße (x ≈ 156 … 160; route), Kantstraße (z ≈ 120 … 138), Bleibtreustraße (x ≈ −10; route), Krumme Straße (x ≈ −45; route), Bismarckstraße (Knie (40, 62) west to (−78, 76), Allee; east of the Knie it runs on to the edge at (185, 14)), Schloßstraße ((−78, 76) to (−75, −14), Allee with a middle promenade; route), Spandauer Damm (z ≈ −14 west of the gate, then north-east to the Luisenplatz; route east of the gate), Otto-Suhr-Allee (Knie to the Luisenplatz, side street) |
| Blockrand | Tall rows on the north side of Ku'damm, Tauentzien, Kantstraße, Bismarckstraße and both sides of the north–south streets; shops, canopies and ruins on the camera side |
| Landmarks | Bahnhof Zoo (58, 96), Löwentor (100, 92), Elefantentor (170, 118), Aquarium (183, 112), Ufa-Palast (96, 112), Capitol shop row (140, 116), Gedächtniskirche (112, 137), Romanisches Café (132, 141), Gloria-Palast (88, 150), Marmorhaus (94, 172), KaDeWe (148, 205; about 46 × 34, hall inside), U Wittenbergplatz (177, 198), Café des Westens (54, 156), Revuepalast (20, 162), Theater des Westens (58, 124), Gläsernes Varieté (−62, 114), Opernhaus (−45, 54), Schiller-Theater (5, 54), Technische Hochschule (62, 38), Charlottenburger Tor (100, 38; backdrop), Rathaus (32, 8), Stülerbauten (−86, −4) and (−64, −4), Ehrenhof gate (−75, −18; the court behind it spans z −20 … −60), Schloss central block (−75, −66), Neuer Flügel (−28, −66), Orangerie ruin (−118, −62), Neuer Pavillon (2, −50), maze (−108 … −42, −82 … −114), Mausoleum (−126, −140), Belvedere (−58, −180) |
| Side passages | Antilopenhaus in the Zoo: sleeping elite; Capitol passage: cache; Hinterhof off the Bleibtreustraße: hidden blessing; Gläsernes Varieté: sleeping elite. None in a landmark footprint that blocks (test) |
| Rest stops | Kiosk at the Zoo (86, 118), Späti in a Stadtbahn arch at Savignyplatz (0, 160), Neuer Pavillon as tea house (2, −50), Späti at the Klausenerplatz (−115, −4) |
| Garden gates | East gate from the Luisenplatz, between the Neuer Flügel and the Spree, about (0, −68); west way out through the Orangerie ruin into the Ehrenhof. The Ehrenhof south gate stays shut (a fence with a collider; it may swing open after the Diva) |

## Engine notes (decided here; check in the step named)

| # | Topic | Decision |
|---|---|---|
| E1 | Sky per zone (steps 3a, 3b) | One `Sky` per zone, blended by the hero's area over a few seconds like the weather (`weather.ts` already fades by `areaAt`). Blend only values that are uniforms or scene fields: background, fog colour and density, hemisphere light, sun or moon colour, strength and direction, lamp scale, grade. The light count never changes. Open for 3a: the reflection environment is rendered once per sky (pre-render four small ones and switch at the blend middle?), lamp glow decals are built with the sky's lamp scale (make it a uniform?), a moving sun direction moves all shadows (slow, or switch during a landmark reveal). Fallback if the cost or the hitch is too high: one Premierennacht sky, zones differ by weather and fog only |
| E2 | Walk-in halls (step 2) | KaDeWe Lichthof and Orangerie are roofless ruins: landmark with `OPEN_PARTS` walls and door gaps, low broken wall on the camera side, tall wall on the north side (shelves, mirrors, the inside of the front). No interior renderer, no new cutaway. `Landmark.cut` only if the blockout shows the south wall still hides the hero |
| E3 | Maze (step 2) | Hedges 2.2 m as wall segments with colliders (`MapDef.walls`, as the Wall in Xhain) in one hedge batch; the camera sees over them. Lots off (`strictLots`), lights hand-placed (lanterns, candle rows, lit mirror panels), a clearing for the fight, dead ends for riddles. The flood fill test must find no pocket |
| E4 | Zoo (step 2) | A fenced park area; gates are walk-through landmarks (as the Brandenburger Tor): only pillars block. Cages and houses are landmarks or props with colliders |
| E5 | Searchlights (step 3b) | Additive beam cards on `FX_LAYER`, sweeping as a function of time; no lights. Mirrors and cut glass: environment gloss plus a moving highlight; no planar reflection, no extra pass |
| E6 | Light colours (step 3b) | Two new kinds of source may add a glow colour each: bulb white for marquees, stage pink. Each costs one glow material per chunk where it appears; say so in the cost line |
| E7 | Riddles (steps 5, 6) | Only from existing parts: hold rings (tunnel generator `hold`), gates that open (`Level.gates`), sleeping guards, hidden blessings. No new input, no text puzzles |
| E8 | Heights (step 2; Johannes, 2026-11-19) | The Stadtbahn is elevated everywhere (viaduct deck 6.5 m, streets pass through arches). The run starts **on the platform level of Bahnhof Zoo**: a walkable deck at viaduct height (a `Terrace` with stairs, as the Warschauer Brücke in Xhain: `bridge`, h 6) with the arrived train on its track, the 1882 hall above it as bare iron arches without glass so the camera sees the hero, and a wide stair down to the Hardenbergplatz toward the camera. No fight up there. Elsewhere the district is flat: gentle relief only in the Zoo and the garden, front steps at the Opernhaus and the Schloss are dressing |

## Input for step 5 (proposals, not decided)

| Figure | Board | 3D idea (existing blocks first) |
|---|---|---|
| Scherbentänzerin | Slender crystal dancer, diamond-panel dress, violet feathers, half-mask | Fast and fragile: a spinning dash on a marked line (`pouncer`), bursts into shards that lie for a moment |
| Logenbrecher | Smoked-glass bouncer in tails, huge faceted fists, chandelier inside | Brute with a front that must be broken first (as the Uhrwerkläufer shield); slow, heavy blows to dodge. Fits B2: slow but strong, gives the fight an order |
| Spiegelsouffleur | Floating hollow tailcoat, oval mirror mask, ribbon and shard arms | Flyer (crow or drone brain) that prompts the others (short buff on enemies near it) and throws a shard volley (Grenzer volley). Kill first |
| Zeitlose | Story: in every district | Ghoul, brute and spitter in tails, flapper dress and usher uniform (skins) |
| Ringverein | Story hook, not on the picked board | Light use: boss 2 and his two guards; no enemy family of its own |
| Boss 1, Gedächtniskirche | | A master of ceremonies: announces „Nummern“ (summons a themed pack), spotlight cones that mark zones (Wachdrohne blocks) |
| Boss 2, Opernhaus | | The Ringverein's head with two Logenbrecher guards; charge and summon (Feldwebel blocks) |
| Boss 3, Belvedere | Board C had a mirror double | A mirror pair: one body and its reflection, only the real one takes damage and it changes; lines along the ground |
| Die Diamantene Diva, Ehrenhof | Tiered cut-glass fan gown, floating fan blades, crystal heart | Fan volleys (cones), prism beams (marked lines), the gown breaks in tiers (phases), calls Scherbentänzerinnen; the dawn rises with her phases |
| District rule | 2D had one per district (Mitte: rain) | Candidates: shards on the ground after kills hurt whoever stands in them; or mirrors in the arena return projectiles. One rule, one line of Kodex text |
| Maze riddles (Johannes likes them) | | Spiegelpfad: at a fork only one mirror shows the hero; the wrong way ends in a dead end with a sleeping Spiegelsouffleur. Kristallsockel: stand on three lit plinths (hold rings) and a hedge gate opens to the hidden blessing. Both optional beside the route |
| Loot | Set Ornat des Letzten Vorhangs, weapon Schlussapplaus (fan-blade glaive) | 2D has no Charlottenburg items: spec the district flavour, the set and the legendary; build with step 6 or after B2 |

Text drafts (Opus finalises): banner „Charlottenburg · 1920“; district card „Revue, Glas und Spiegel. Die Diamantene Diva hält das Schloss.“; zone names „Zoo“, „Kurfürstendamm“, „Schlossgarten“, „Spiegelschloss“; win „Charlottenburg frei“.

## Zones: time, weather, lot types (proposals for steps 3b and 7)

| Zone | Time | Light and weather | Lot types |
|---|---|---|---|
| 1 Zoo & Tauentzien | Blaue Stunde | Violet-teal sky, berry horizon; gas lanterns and shop windows come on, first searchlights; a few leaves | Droschkenplatz (cab and car stand), Schaufensterpassage; in the Zoo cages and the concert garden by hand |
| 2 Ku'damm & Savignyplatz | Premierennacht | Black sky, white and pink bulbs, searchlights sweeping; confetti and streamers | Kinovorplatz (ticket booth, poster columns, velvet ropes), Jazzkeller-Hof (Hinterhof with cellar stairs), workshops in the Stadtbahn arches |
| 3 Schlossgarten | Mondnacht | Cold moon, long shadows, mist with prism motes; lanterns and candles on the paths | By hand: Heckenkabinett (hedge room with statues and a mirror), Gartentheater (stage ruin) |
| 4 Spiegelschloss | Morgengrauen | Pale pearl and rose sky behind the dome, lamps fading; diamond dust | None (landmarks) |

## Handover 2026-11-19 (step 0) [Claude · Fable high]

- Three layouts from OSM data; Johannes picked C and asked for more City West, 1920 throughout and time passing along the route → C2. Decisions C1 to C6 in `docs/maps/charlottenburg.md`.
- Reused from 2D: nothing district-specific exists (only the era string); tunnel template, waves, side passages, rest stops, gates and hold rings as already ported.
- Proposed and not yet confirmed by Johannes: U2 with ghost station Bülowstraße (C3), tier 32 to 54 until M14/B2 (C4), Stadtbahn S-Bahn to the Fernsehturm finale (C5).
- Facts marked „memory“ in the map doc are unverified (Wikipedia was rate limited); step 4 checks them with the photos.
- Size: 320 × 410 m is 3 % more area than Mitte and the route about 10 % longer, on Johannes' request; the north-east (beyond Stadtbahn and Spree) is backdrop. Check it in the blockout on the Tab S9 before the landmarks are built.

## Handover 2026-11-19 (step 1) [Claude · Opus high]

- Built: `src/data/charlottenburg.ts` (15 fights, 30 waves 8/9/10/3, tier 32 to 54, 39 landmarks with 31 new kinds, 4 rest stops, 4 side passages, maze, Zoo fences), `charlottenburg.test.ts` (33 tests at scale 1 and 1.3 incl. Zoo only through its gates, maze without pockets, halls walk-through, Ehrenhof shut from the south, octants, scripted run), `docs/maps/charlottenburg.svg`, `lines.ts` (U2 to Zoologischer Garten at (105, 150) west-south-west of Mitte; badge 4 moved too). 2D reuse: none beyond the ported systems.
- Moved for room or circles: KaDeWe and its fight (148, 197) (205 ran past the bound; 46 × 32, hall 44 × 30), kirche (106, 156), elefantentor (166, 129) (off the Capitol), belvedere fight (−48, −165) and Belvedere (−58, −183) (off the building and the Spree), Stadtbahn west (−135, 160), (−60, 155) (room for the Ku'damm Blockrand), Bismarck east end (185, 8) (off the viaduct), Spandauer Damm z −10, garden gate (−3.5, −62) and Schloßbrücke (16, −75) (gate south of the bridge, octant kept), kiosk (90, 100) (the Hardenberg and Budapester Straße run through (86, 118)).
- Buildings set back from streets by 2 to 9 m: Café des Westens (54, 150), Revuepalast (24, 158), Marmorhaus (86, 180, also SW octant), Gloria (90, 148), Theater des Westens (58, 121), Varieté (−62, 112), Oper (−45, 45), Schiller (5, 46), TH (56, 35, further from the N/NW border), Stülerbauten (−92, 5) and (−58, 5), Capitol (142, 115), Aquarium (181, 112), Antilopenhaus (152, 67), pond (−74, −142).
- Changed by decision: the Joachimsthaler Straße never meets the viaduct here (no arch); the Orangerie forecourt is fenced from the Spandauer Damm (else the Ehrenhof is reached round the shut gate), so the zone 4 Späti stands in the forecourt (O + (−5.5, 34)), not on the Klausenerplatz.
- Engine (opt-in, other maps unchanged): `Wall.kind` hedge or fence (`WALL_KIND`, `wallHalf`); `OPEN_PARTS` for loewentor, elefantentor, capitol, kadewe, orangerie, gartentor, chtor; 32 landmark kinds (the Rathaus has its own, `chrathaus`).
- Stand-ins: bosses Dirigent, Feldwebel, Spreehexe, Bassprediger (`CHARLOTTENBURG_BOSS_STANDIN`); walkers, runners, Schildträger and crows for the board enemies; lot types hinterhof, markt, truemmer, parkplatz (capped); no `flavor`, dry (no `wet`).
- Step 2: the Schloss, maze, KaDeWe and gates keep their size at every scale (offsets from one anchor, `C`, `O`, `M`). Walls with `kind` need their own renderer (hedge 2.2 m, fence 2 m), not the Berlin Wall; the Bahnhof Zoo is `walkUnder` on the viaduct; the Ehrenhof gate is a full collider; a Bauzaun on the bridge deck closes the backdrop bank. Only 11 tall Blockrand rows (test ≥ 10): the tall sides are mostly landmarks.

## Handover 2026-11-19 (step 2) [Claude · Opus high]

- `?map=charlottenburg` plays start to end (options, `MapId` with freed id 4, „Charlottenburg · 1920“, „Charlottenburg frei“, no title, victory or network links), bot `mapLevelOf('charlottenburg')` and `tools/balance.mjs --map=charlottenburg`, dry `CHARLOTTENBURG_WEATHER` (leaves in the Zoo and the garden), night sky; smoke test „M16: Charlottenburg loads on the platform …“. Render: `src/render/charlottenburg-world.ts` (massing per kind, colour table `C`; plain brick Stadtbahn through `buildStadtbahn(…, plain)` and `buildArches(…, ends, beam)`, platform, hedges, fences). Reveals: church, KaDeWe, Opernhaus, Schloss (`near` 50, from the Schloßstraße end), Belvedere. Proof: `docs/proof/m16-charlottenburg/`.
- E8 deviation: the Hardenbergstraße arch is under the old station anchor, so the platform deck (`PLATFORM`, 21 × 10 m at 6.5 m, a `Terrace` with `platform` and the train as `solid` boxes) starts at that arch and runs north-east; Bahnhof Zoo moved from (58, 96) to the deck centre (≈ 80, 76), the start from (76, 100) onto the deck (≈ 85, 73.5). The 8 m stair lands 7 m from the Löwentor and 11 m from the kiosk. Still four viaduct runs.
- Engine, opt-in: `Terrace.platform` and `solid`, `MapDef.noSpawn` → `Level.noSpawn` (`freeSpot` and rim spawns skip it: no enemy, event or drop on the deck), Xhain draws only walls without `kind` and no platform decks. Other maps unchanged. `Landmark.cut` not needed: the hero stays visible in both halls (low camera-side walls). The KaDeWe reveal looks from the camera side (the tall Tauentzien rows hide its street front from the north).
- No new material: stucco, slate, enamel (copper, gilding), iron, brick, glass, concrete, mossy and ivy (hedges), car paint and glass (train), window atlas. Cloud readout, Leistung, default camera, with and without the step 2 code: platform 481 calls / 590k triangles (+65 / +31k), church square 441 / 534k (+42 / +17k), Ku'damm 493 / 634k (+29 / +6k), maze 316 / 456k (+61 / +39k). Mitte's start reads 481 / 696k in the same readout, so the 200 / 200k guideline is not met by either; the generated city is most of it (P1b).
- Steps 3b and 4: `massing()` holds one case per kind, replace it kind by kind (as `buildMitteLandmark` asks its step 4 files first); `openHall` draws the two halls from `OPEN_PARTS`; the hall ribs and the train are placeholders; no lettering yet (KaDeWe, Capitol, cinemas). Wear from `landmark-wear.ts` already applies (it adds graffiti, wrong for 1920: step 4 decides).
- Off-route land from the shots: the south-west Ku'damm stub is built up like any street (Blockrand, cars, a lot type) and reads as a dead end, not empty: content is enough there. The forest north-east of the Knie reads dark and empty: first remedy candidate is the barricade on the Chaussee east of the Technische Hochschule (review order). Size: check 39.
- Also: two step 1 tests near the 5 s default got a 20 s timeout (they flaked once under load).

## Handover 2026-11-19 (blockout fixes) [Claude · Opus medium]

- Forest north-east of the Knie closed (Johannes): area `hochschulviertel` „Hochschulviertel“ (was „Tiergarten“), fence `Hochschulzaun` from the Spree past the Rathaus and the Otto-Suhr-Allee, then behind the Chaussee's north sidewalk into the Tor colonnade; a street-end `barricade` prop (36 m, work lamp) east of the Charlottenburger Tor plus fence `Chausseesperre` to the viaduct; the area is also `noSpawn`. The Technische Hochschule turned to front the Chaussee (same place, inside its grounds). Test: nothing of it reached or placed in it, Knie, Allee and Tor open, at 1 and 1.3.
- Ku'damm stub: fenced yard `Hof am Kurfürstendamm` (38 m from the Bleibtreustraße, about 27 m deep) with crates and a work lamp; the hidden-blessing Hinterhof was already west of the Bleibtreustraße. No fight added.
- Wear: `WearOptions.graffiti` (opt-in, `CHARLOTTENBURG_WEAR`): soot where graffiti would go; other maps unchanged.
- Step 4 prepared: `charlottenburg-citywest.ts`, `-kudamm.ts`, `-schloss.ts` (owned kinds in the headers, all return false), asked first by `buildCharlottenburgLandmark`; helpers and `C`, `Ctx` exported from `charlottenburg-world.ts`. Sheet: `npm run dev`, then `node tools/landmark-sheet.mjs out.png "kind=hochschule"` (all 32 kinds render). Proof `knie-fence.jpg` replaces `offroute-forest-knie.jpg`.

## Review 2026-11-19 (step 1) [Claude · Fable high]

- Checked: `npm run check` green after the step, map image `docs/maps/charlottenburg-data.png`, engine changes in `map.ts` are opt-in, network routes and labels do not overlap on the schematic (not looked at in the game: step 8).
- Off-route land, the price of an L-shaped route in a rectangle: the south-west blocks along the Ku'damm and the Kantstraße west of the Bleibtreustraße (about 105 × 115 m, the Ku'damm runs 120 m on as a dead end), the forest north-east of the Knie (about 130 × 85 m; it is the Technische Hochschule quarter, the real Tiergarten starts east of the Charlottenburger Tor), the Klausenerplatz corner.
- Step 2 decides with the minimap and the Tab S9, before landmarks are built. Order of remedies: first put content there (the Hinterhof blessing, a rest stop, a lot type on the Ku'damm stub); if it still reads empty, close the Chaussee east of the Technische Hochschule with a barricade so the forest is backdrop; only then an inner closed edge for the south-west (a new opt-in edge line for `edgeProps`, spec it before building).

