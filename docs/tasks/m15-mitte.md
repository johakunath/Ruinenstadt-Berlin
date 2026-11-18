# M15 Mitte / Potsdamer Platz, district 4 [Claude · Opus high]

Layout B2 "Vom Reichstag zum Bass" (Johannes, 2026-11-18). Concept, decisions M1 to M4, geography check and 2D reuse: `docs/maps/mitte.md`. Mockups: `docs/mockups/m15-mitte-layouts.svg` (A, B, C), `docs/mockups/m15-mitte-b2.svg` (the revision that is built).

## Steps (one session each unless noted)

| # | Step | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept, geography check, 2D inventory, plan | | Opus | done 2026-11-18 |
| 1 | Data `src/data/mitte.ts` from the anchors below, invariant tests `src/data/mitte.test.ts` at scale 1 and 1.3 (as `xhain.test.ts`), map SVG `docs/maps/mitte.svg` shown in chat. Stand-in bosses `MITTE_BOSS_STANDIN`; `flavor: 'neon'`, district 3 | 0 | Opus high | done 2026-11-18 |
| 2 | Playable blockout `?map=mitte`: wiring (`options.ts`, `ui/maps.ts`, `main.ts`, bot `mapLevelOf`), landmark massing, Spree and Landwehrkanal, Großer Stern roundabout, Neuer See | 1 | Opus high | done 2026-11-18 (before PR #49 merged; merge main after it) |
| 3 | Neon night look: three variants in game (`?look=a|b|c` or via `sky.ts`), Johannes picks. Wet ground (reflection streaks under every light, puddle mirrors), neon signs and poles below 5 m, rain with splashes and coloured streaks, cyan and magenta light colours, zone tints. State the Leistung cost | 2 | Opus high, variants first | open |
| 4 | Landmarks from photos (`docs/maps/landmarks.md`): north (Brandenburger Tor walk-through, Pariser Platz fronts, Reichstag, Jakob-Kaiser-Haus, Lüders-Haus, Paul-Löbe-Haus, Kanzleramt, Haus der Kulturen, Siegessäule) and south (Sony Center forum with tent and `cut`, Bahntower, Kollhoff, Verkehrsturm, Leipziger Platz, Mall of Berlin, Galeries Lafayette, Philharmonie, St. Matthäus, Staatsbibliothek, Neue Nationalgalerie, stage, clinic, Mauerstücke, Checkpoint Charlie, beer garden) | 2 | Opus high | open (two sessions: north, south) |
| 5 | Enemy and boss spec: Kabelghul, Boxenkopf, Kabelbrocken skin, drones, Der Türsteher, Die Wachdrohne, the Neuer See mini-boss, Der Bassprediger; wave mix and tier; rain rule; Kodex lines | 0 (can run now, parallel to 1 to 4) | Fable high (new bosses); Opus high if Fable is not available | open |
| 6 | Enemy and boss build (sim, bodies, sounds, Kodex) | 5 | Opus high | open |
| 7 | Buildings and lot types: glass office blocks with lit lobbies, government stone and glass, Friedrichstadt Blockrand with neon shops, tents and beer garden in the Tiergarten; two lot types per zone, weather per zone (proposals below) | 3 | Opus high | open |
| 8 | Flow and balance: U2 tunnel from Alexanderplatz to U Potsdamer Platz, title and victory links, network map stop `map: 'mitte'`, bot `--map=mitte`, tier calibration | 2, 6, Alexanderplatz flow | Opus medium | open |
| 9 | Textures: rows in `docs/asset-pipeline.md` (wet asphalt, glass curtain wall, sandstone, neon sign atlas) | 3, 4, 7 | Codex | open |
| 10 | Screenshots (street at night, fight, each landmark), PC and Tab S9 playtest | all | Johannes | open |

## Anchors (scale 1, meters, +X east, +Z south, from mockup B2; the built positions are in `src/data/mitte.ts`)

Bounds x −155 … 175, z −198 … 198. Start U Potsdamer Platz (15, 108), beside the Leipziger Platz octagon (30, 95).

| Zone | Fights (id, x, z, waves) | Boss |
|---|---|---|
| 0 Friedrichstraße | leipziger (90, 84, 3), friedrich (150, 25, 3), linden (115, −62, 3) | pariser (35, −62): Türsteher |
| 1 Regierungsviertel | dorotheen (55, −98, 3), spreeufer (8, −158, 3), republik (−48, −112, 3) | kanzleramt (−95, −116): Wachdrohne |
| 2 Tiergarten | stern (−110, −55, 2): on the island, the Siegessäule plinth inside the circle (keep 80 % open) | see (−104, 26): mini-boss |
| 3 Potsdamer Platz | matthaei (−115, 112, 3), bruecke (−95, 160, 2), tilla (−18, 150, 2) | sony (−62, 85): Bassprediger |

| Thing | Where |
|---|---|
| Spree | north edge, a gentle curve along z ≈ −182 … −186, width about 20 |
| Landwehrkanal | south edge, z ≈ 186 … 192, width about 12; Potsdamer Brücke at x ≈ −100 |
| Neuer See | lake around (−138, 0), touching the west edge; beer garden (zone 2 rest stop) at (−135, 32) |
| Großer Stern | island r ≈ 14 around (−110, −55), ring road about 10 wide outside it; Straße des 17. Juni east to the Tor, west to the edge; Spreeweg north, Hofjägerallee south |
| Streets | Leipziger Straße (z ≈ 88 … 95), Friedrichstraße (x ≈ 150), Wilhelmstraße (x ≈ 80), Behrenstraße (z ≈ −28), Unter den Linden (z ≈ −62, Allee profile), Ebertstraße (x ≈ 5 … 12, Tiergarten edge), Dorotheenstraße (z ≈ −110), Scheidemannstraße, Paul-Löbe-Allee, Tiergartenstraße, Potsdamer Straße (south-west to the bridge), Stresemannstraße (south-east), Alte Potsdamer Straße, Herbert-von-Karajan-Straße, Schöneberger and Reichpietschufer |
| Landmarks | Tor (5, −62), Reichstag (−5, −122), Jakob-Kaiser-Haus (58, −128), Lüders-Haus (52, −160), Paul-Löbe-Haus (−38, −158), Kanzleramt (−100, −150), Haus der Kulturen (−142, −138), Siegessäule (−110, −55), Philharmonie (−98, 58), St. Matthäus (−142, 118), Staatsbibliothek (−70, 134), Neue Nationalgalerie (−136, 150), Sony Center (−62, 85), Bahntower (−30, 92), Kollhoff (−28, 122), Verkehrsturm (2, 100), Mauerstücke (−2, 80), Mall of Berlin (58, 74), Galeries Lafayette (166, −4), clinic (8, 140) |
| Side passages | Checkpoint Charlie (Friedrichstraße south of the Leipziger Straße, booth at about (150, 126)): cache; Hinterhof off the Friedrichstraße: hidden blessing; sleeping elite in the Potsdamer Platz core |
| Spätis | Friedrichstraße (120, 55), Regierungsviertel (−15, −88), beer garden (−135, 32), „Späti am Potsdamer Platz“ (22, 132) |

Tier: Köpenick 0 … 19, Xhain 8 … 30, Alexanderplatz 16 … 38; Mitte 24 … 46 as a start, calibrate with the bot (2D: Mitte was the wall, a death per district is normal on Normal from Mitte on).

## Enemies from 2D (input for step 5; 30 px = 1 m)

| Kind | 2D numbers | 3D idea |
|---|---|---|
| Kabelghul (`kabel`) | r 9 px (0.3 m), life 15, speed 92–104 px/s (3.1–3.5 m/s), hit 6; leaps when within 200 px (6.7 m): wind-up 0.4 s with a line on the ground, 0.3 s at 440 px/s (about 4.4 m), open 0.5 s, cooldown 2.2–3 s; fire ×1.6, acid ×1, shock ×0.3; drops Kabel; 0.2 of the 2D Mitte mix. Tip: „Kabelghule springen dich an (Linie am Boden). Feuer brennt sie weg, Strom perlt an ihnen ab.“ | `pouncer` brain (Raptor) on the zombie rig, thin, pink cables and lit implants |
| Boxenkopf (`bass`) | r 15 px (0.5 m), life 62, speed 44 px/s (1.5 m/s), hit 13; every 2–4 s a wind-up, then a pink ring 12 → 270 px (to 9 m) at 0.9 of its hit; enemies within 220 px (7.3 m) are driven on for 3 s; open 1.1 s; acid ×1.6, shock ×0.5; drops Metall; 0.07 of the mix. Tip: „Boxenköpfe wummern Basswellen (rosa Ringe). Sprinte durch die Welle oder erledige sie aus der Ferne.“ | roar ring threat plus a short drive for nearby enemies; brute rig with a speaker head in code |
| Kabelbrocken | Board: hulking brute with pink cables; 2D draws pink cables on every ghoul and brute in Mitte (`D.cyber`) | Brocken skin, no new brain |
| Drohne | 2D only as a power name („Drohnenschwarm“) | Krähe brain with a drone body (replaces crows here); proposal |
| Zünder, Schildträger | In the 2D Mitte mix (0.04, 0.08); not in 3D yet | backlog |
| Der Bassprediger | Shock charge: wind-up 0.7 s, then 0.55 s at 560 px/s (about 10 m); every second charge (every charge in rage) two bass rings 150 px (5 m) apart up to 340 px (11 m) at 0.7 of its hit; cooldown 3.8 s. v0.99: two rings instead of three (three floor hits in a row took about 85 % life). Speaker head, pink cables, cyan eyes | final boss on the stage in the Sony Center |
| Rain rule (`wet`) | Fire burns 1.4 s instead of 2; a shock chain reaches 190 instead of 140 px (6.3 m instead of 4.7 m) and jumps once more | sim rule for this map |

## Bosses (proposal for step 5, M4)

| Zone | Boss | Idea | Blocks to reuse |
|---|---|---|---|
| 0 Pariser Platz | Der Türsteher | A huge Kabelbrocken in a bomber jacket; the Tor is the club door („Kein Einlass“). Shove (cone knockback), grab (short lunge and hold, a dodge breaks free), guest list (calls two Kabelghule); in rage neon barriers close the gate passages for a few seconds | brute mark, Feldwebel charge and summon, marked zones |
| 1 Kanzleramt | Die Wachdrohne | A hovering surveillance drone out of the Reichstag dome. Searchlight cones sweep the arena (marked zones that follow), standing in the light triggers a laser volley, calls small drones, lands to recharge (punish window) | crow flyer, Grenzer volley, marked zones |
| 2 Neuer See | Mini-boss (smaller life, few adds) | Candidates: Der Dirigent on the beer garden's band stand (Boxenköpfe pulse on his beat), or Der Kabelbaum (a cable-wrapped tree, root lines along the ground) | roar ring, Wurzler-style lines |
| 3 Sony Center | Der Bassprediger | 2D numbers above, on the stage under the tent | Feldwebel charge, roar rings |

## Zones: look, weather, lot types (proposals for steps 3 and 7)

| Zone | Look | Weather | Lot types |
|---|---|---|---|
| Friedrichstraße | Neon shopping street, amber and magenta shop fronts, cold blue LED lamps (2D `#6a8cff`), checkpoint containers | Rain | Markt (neon street market), Hinterhof (club yard) |
| Regierungsviertel | Cold cyan: sandstone and glass, surveillance cameras, searchlights, holo barriers, few fires | Rain and fog | Baustelle, Parkplatz (wrecked autonomous cars) |
| Tiergarten | Calm: dark trees, beer garden string lights, lanterns on the lake, a few tents | Light rain, fireflies | Zeltlager (new), Teich |
| Potsdamer Platz | Magenta and cyan neon, wet asphalt, Soundsystem, implant clinic, Mauerstücke | Heavy rain | Baustelle with crane, Trümmerfeld |

## Stand-ins until step 6

Bosses: Türsteher → `feldwebel`, Wachdrohne → `grenzer`, mini-boss → `brandmeister`, Bassprediger → `hauptmann`. Kabelghul → `runner`, Boxenkopf → `brute`, drones → `crow` (Tiergarten only).

## Handover 2026-11-18 (step 0) [Claude · Opus high]

- Concept: three layouts from OSM data, Johannes picked B and revised it to B2 (smaller Tiergarten, Friedrichstraße, denser Regierungsviertel, larger Potsdamer Platz). Decisions M1 to M4 in `docs/maps/mitte.md`.
- Reused from 2D: map, zones, streets and all landmark colours of `js/mitte.js`; enemy and boss numbers, rain rule, neon item flavour, palette and props from `js/data.js`, `js/update.js`, `js/combat.js`, `js/art.js`.
- PR #49 (Alexanderplatz) is open and touches the wiring files; step 1 adds only new files plus the map SVG test, step 2 waits for #49.

## Handover 2026-11-18 (step 1) [Claude · Opus high]

- Data `src/data/mitte.ts` (B2, scale 1: 330 × 387 m, origin about the map centre): Spree and Landwehrkanal as quay edges, Neuer See at the west edge, the Großer Stern as a closed ring road (r 19) around a grass island with the Siegessäule, 30 streets (Blockrand on the Friedrichstadt streets, `allee` profile on Unter den Linden), 14 fights (27 waves, tier 24 to 46, the Tiergarten calm: 0.7 count, no elites), four rest stops (the beer garden is a `spati` landmark until step 4 builds it), three side passages (Checkpoint Charlie cache, Friedrichstraße Hinterhof blessing, Arkadenhof elite), 24 landmarks with new kinds (`ubahn`, `tor`, `reichstag`, `bundesbau` ×3, `kanzleramt`, `siegessaeule`, `sony`, `stage`, `bahntower`, `kollhoff`, `verkehrsturm`, `klinik`, `philharmonie`, `matthaeus`, `stabi`, `nng`, `checkpoint`, `mauerstuecke`, `lafayette`). Stand-ins: `MITTE_BOSS_STANDIN`, runners for Kabelghule, brutes for Boxenköpfe, crows for drones.
- Engine (`src/data/map.ts`): `OPEN_PARTS` lets the Tor block only at its six pillar walls and gate houses (five walkable passages) and the Sony Center only at its six ring blocks (gaps at 30°, 90° … 330°); `MapDef.strictLots` (Mitte only, backlog B14) keeps lots out of turned landmark footprints and off side paths. Köpenick and Xhain lots are byte-identical (checked).
- Tests `src/data/mitte.test.ts` (20): the Xhain invariants plus a flood fill that also respects colliders (Xhain's only respects water), Tor passages and pillars, Sony gaps, the ring road all round the Siegessäule, Blockrand rows, the beer garden as rest stop. `npm run check` green (571 tests).
- Not wired yet: no `?map=mitte`, no renderer for the new kinds. Step 2 does both once PR #49 is merged.
- Density: the Regierungsviertel east of the Reichstag and the Potsdamer Platz core use stand-in frontage (`platte`, `altbau`) and read thin in the data map; step 7 fills them with the district's own building types.

## Handover 2026-11-18 (step 2) [Claude · Opus high]

- `?map=mitte` plays: `options.ts`, `ui/maps.ts` (`MapId 'mitte'`, freed id 3, no title or victory links yet: step 8), `main.ts` (banner „Mitte · 2089“), bot `mapLevelOf('mitte')` and `node tools/balance.mjs --map=mitte`, weather `MITTE_WEATHER` (rain; mist with fireflies in the Tiergarten), smoke test „M15: Mitte loads …“.
- Render: `src/render/mitte-world.ts` (`MITTE_KINDS`, `MitteMats` on `MapMats.mitte`: sandstone, curtain glass with lit offices, gold panels from `mitte-paint.ts`), a massing model per kind in real proportions and 2D colours; `buildMitteLandmark` asks the step 4 files first (`mitte-north.ts`, `mitte-south.ts`, `mitte-kultur.ts`). `buildMitteWorld` is the hook for the step 3 street dressing. Water, the Großer Stern ring and the Neuer See use the shared map renderer.
- Reveal shots for the seven main sights (Tor, Reichstag, Kanzleramt, Siegessäule, Sony Center, Kollhoff-Tower, Philharmonie); the hint shows `Landmark.name` when the kind has no German name in `NAMES`. Landmark sheet: Mitte kinds work (`kind=tor`).
- Shared with PR #49: the helper exports of `landmarks.ts` are the same hunks as in #49 (merge cleanly); `main.ts`, `options.ts`, `ui/maps.ts`, `bot/run.ts`, `renderer.ts`, `map-world.ts`, `reveal.ts` and `tools/landmark-sheet.ts` will conflict on single lines (both add a map), resolve by keeping both.
- Reused from 2D: the colours of `js/mitte.js` for every landmark (Reichstag `#b8ac94`, Tor `#d8c8a0`, Quadriga `#4a6a58`, Siegessäule granite `#5a2a24` and gold, Kollhoff brick, Philharmonie gold, Sony magenta tent); the rain rule waits for step 5.

