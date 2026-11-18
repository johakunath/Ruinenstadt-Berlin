# M15 Alexanderplatz, district 3 [Claude · Opus high]

Layout C "Großer Ring um den Turm" (Johannes, 2026-11-18). Concept, geography check and open points: `docs/maps/alexanderplatz.md`. Mockup: `docs/mockups/alex-layouts.svg` (panel C).

## Decisions (Johannes, 2026-11-18)

| # | Decision |
|---|---|
| A1 | Layout C: both worlds. Museumsinsel (Dom, Palast der Republik), Nikolaiviertel and Spreeufer, Karl-Marx-Allee; Fernsehturm in the middle of the loop, visible from every fight |
| A2 | Afternoon light (golden hour as on the board), brighter than Köpenick and Xhain. New light sources fit the district (greenhouses, clockwork lamps, Weltzeituhr panels) |
| A3 | Final boss: the **Weltzeituhr itself**. It stands still as a landmark; when the hero comes near on the last objective it wakes up, starts moving and fights |
| A4 | Zone bosses: larger versions of the district enemies |
| A5 | New enemies (Uhrwerkläufer, Wurzler, Kernspeier, Brigadeghul); look for fitting free models first (research below) |
| A6 | Look: Pioneer palette, saturated yellow and blue, hammer-and-sickle emblems on facades, banners, crests and enemies (`docs/style-bible.md` › GDR / Pioneer direction, `docs/style/alexanderplatz-pioneer.png`) |
| A9 | Light: variant A Goldene Stunde (Johannes, 2026-11-18): low warm sun from the south-west, amber haze, lamps at a quarter |
| A10 | Propaganda over the top (Johannes, 2026-11-18): neo-Soviet steampunk, a wannabe happy propaganda state with strong control. The Pioneer poster everywhere and huge, rows of it side by side, flags in many places, cameras on walls and poles |
| A8 | Koloss stays on the Karl-Marx-Allee (zone 3 boss). Boss and enemy specs are written by Opus; a Fable pass only if Johannes does not like a boss |
| A7 | Order: after Xhain. Xhain (PR #46) changes the map format (Stadtbahn viaducts, Blockrand rows, map selection, enemy roster); build on it once it is in `main`. Reuse its Altbau blocks, back yards and building parts where they fit (Nikolaiviertel, Spandauer Vorstadt edge) |

## Steps

| # | Step | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept, geography check, enemy model research | | Opus | done 2026-11-18 |
| 1 | Data `src/data/alexanderplatz.ts` from the anchors below; map SVG from the data shown in chat (`docs/maps/alexanderplatz.svg`) | #46 merged | Opus high | done 2026-11-18 |
| 2 | Playable blockout `?map=alex` with the existing generators; invariant tests at scale 1 and 1.3 (`src/data/alexanderplatz.test.ts`) | 1 | Opus high | done 2026-11-18: URL only, no title button yet; stand-in bosses, landmark massing and the brick Stadtbahn in `src/render/alex-world.ts` |
| 3 | Afternoon look: sun direction and color, sky, grade, fog; light rules for a day map (below) | 2 | Opus high, mockup first | done 2026-11-18: three variants in game (`?sky=a|b|c`), Johannes picked **A Goldene Stunde** (default) |
| 4 | Landmarks in code from photos (`docs/maps/landmarks.md`) | 2 | Opus high | first pass done 2026-11-18 (all 17 kinds, proof `docs/proof/m15-alex/`); photo check open for the ones without a downloaded photo (below) |
| 5 | Buildings: Platte (WBS 70), Zuckerbäcker blocks, 60s pavilions, greenhouses, Xhain Altbau blocks; two lot types per zone | 2, #46 | Opus high | done 2026-11-18 (handover below; proof `docs/proof/m15-alex/buildings.jpg`) |
| 6 | Enemy and boss spec (attacks, telegraphs, counters, wave mix, Weltzeituhr wake-up) | | Opus high (Fable only if Johannes dislikes a boss) | open |
| 7 | Enemy and boss build (models from the research, code parts, emblems) | 6 | Opus high | open |
| 8 | Textures: rows in `docs/asset-pipeline.md` for Codex | 4, 5 | Codex | open |
| 9 | Screenshots (street, fight, each landmark), PC and Tab S9 playtest (layout C is the largest map: 390 × 300 m) | all | Johannes | open |

## Layout C anchors (scale 1, meters, +X east, +Z south, origin map center)

From the mockup; refine in step 1 against the real directions in `docs/maps/alexanderplatz.md`.

| Zone | Encounters | Boss | Landmarks |
|---|---|---|---|
| Start | S Hackescher Markt (−160, −135) | | Stadtbahn viaduct runs west to east north of the island, then bends south-east over the Spree to Jannowitzbrücke |
| 1 Museumsinsel | Lustgarten (−160, −110), Schlossplatz (−165, 15), Palastgarten (−165, 75) | Zone 1 boss at the Palast (−120, 55) | Altes Museum (−155, −75), Dom (−152, −20), Palast der Republik with glass house (−150, 45); Spree east, Kupfergraben west |
| 2 Nikolaiviertel / Spreeufer | Nikolaikirche (−60, 110), Rathaus south (10, 108), Spreeufer (75, 110) | Zone 2 boss at Jannowitzbrücke (150, 95) | Rotes Rathaus (−30, 80), Nikolaikirche, Märkisches Museum across the Spree (backdrop) |
| 3 Karl-Marx-Allee | Holzmarkt (165, 35), Kino International (170, −60), Haus des Lehrers (115, −100) | Zone 3 boss on the Allee (155, −10) | Kino International, Haus des Lehrers with frieze, Kongresshalle, Café Moskau, Strausberger Platz towers as backdrop east |
| Final | | Weltzeituhr (65, −45) | Weltzeituhr, Brunnen der Völkerfreundschaft, Hotel Stadt Berlin, S Alexanderplatz on the viaduct |
| Inside the loop | Free: side branches, hidden blessing | | Fernsehturm (−15, 5), Marienkirche, Neptunbrunnen; tower door locked (the finale is its own district) |

Bridges: Liebknechtbrücke to the island (north), Rathausbrücke from the island to the Nikolaiviertel, Jannowitzbrücke under the viaduct. Späti: Hackescher Markt, Spreeufer, Karl-Marx-Allee.

## Step 6 spec: enemies and bosses (2026-11-18, Opus; Fable only if Johannes dislikes a boss)

Source: 2D `mkEnemy` (`uhr`, `wurz`, `kern`), `update.js` (Wurzler root field, Kernspeier fan, Koloss v8), `RES`, `MIX[2]`, Kodex lines. 3D scale as in M12: life ×1.2 to 1.5 of 2D, speed 2D px/s ÷ 32. Every hit on the hero goes through `threatHit`/`hurtPlayer` (45 % cap holds). Bodies: `docs/tasks/m15-alexanderplatz.md` › Enemy model research.

### Ordinary types

| Kind | Name | Body | Life, speed, radius | Special | Answer | Resist (fire, acid, shock) |
|---|---|---|---|---|---|---|
| `uhrwerk` | Uhrwerkläufer | Mech Leela, brass and cobalt, clock-face shield (code) | 85, 1.1, 0.7 | Shield in front: hits inside ±70° of its facing deal 20 %; it turns at 90°/s. Slow heavy swing (wind-up 0.9 s, reach 2.4 m, 22). A hammer finisher, a stun or any shock hit opens the guard for 2.2 s (punish window, "Deckung offen") | Get behind it, or open it with hammer or shock | 1, 0.5, 1.7 |
| `wurzler` | Wurzler | Zombie with root arms, apron and a sunflower head (code) | 55, 1.7, 0.4 | Root field every 4.5 to 6 s within 10 m: a circle of 1.5 m under the hero, 0.95 s warning, then roots: 60 % of its hit and held 0.8 s (no walking; a dodge breaks free; 2.5 s immunity). Stands still while casting, open 0.9 s after. Slower (×0.7) within 3.8 m | Keep moving, dodge out of the circle, hit it after the cast | 1.8, 0.4, 1 |
| `kernspeier` | Kernspeier | Clay pot with a toothed sunflower, hops (code) | 26, 1.8, 0.34 | Keeps 5 to 8 m like the Speier. Plants itself 0.7 s (mouth wide open), then a fan of three seeds (±15°, 70 % hit each); open 0.9 s after | Close in while it plants, or side-step the fan | 1.6, 0.4, 1 |
| Brigadeghul | (walker) | The Schlurfer in a blue Blaumann, cap and red armband on this map (render only) | as walker | – | – | as walker |

Wave mix (`alexWaveTier`): walker 6, runner, brute fewer than Xhain; `uhrwerk` from the 2nd wave (2D weight 0.1), `wurzler` from the 3rd (0.08), `kernspeier` replaces most spitters (0.09); crows over the island stay. Elites as everywhere from the 4th wave; `uhrwerk` never `gepanzert` (it already blocks).

### Bosses

| Zone | Boss | Body | Life | Pattern (cooldown s) | Rage below 50 % |
|---|---|---|---|---|---|
| 0 Museumsinsel | Die Wurzel-Mutter | Wurzler ×2.2 grown out of the Palast glass house, a crown of sunflowers | 1900 | Three root fields (one under the hero, two beside) 4.2; two Kernspeier 9; root slam ring when the hero is within 3 m 3.6 | four fields, three adds |
| 1 Nikolaiviertel | Der Große Uhrwerkläufer | Mech Mike ×1.8 with the shield | 2900 | Shield as the Uhrwerkläufer (front 35 %); charge along a marked line (0.75 s warning, 12 m/s, 0.6 s) 4.2, then wound down 1.4 s (back open, +30 %); every third cycle it winds its key 2 s: front closed, sparks ring | cooldowns ×1.35 |
| 2 Karl-Marx-Allee | Der Volkseigene Koloss (2D v8) | Walking Plattenbau slab on clockwork legs (Mech Mike leg rig, slab body in code), hammer arm and compass arm | 3900 | Cycle 4.4: odd cycles three slab drops (circles of 1.9 m, one on the hero, 0.9 to 1.4 s); even cycles the ring on its back spins 2.4 s and sprays gears in a two-arm spiral (one pair every 0.16 s); every third cycle two Uhrwerkläufer; hammer slam within 3 m | cycle 3.2 |
| 3 Alexanderplatz | Die Weltzeituhr | The landmark itself: drum on four clockwork legs (code), the orbit sculpture on top | 5400 | Wake-up: the hero enters the final circle, 3 s (gears start, the panel ring spins up, the column lifts off its base, roar ring), untouchable; the landmark hides and the boss stands at its place. Zeitzonen: three of the 24 hour sectors of a ring (3 to 9 m) light up 1.1 s, then strike 4.0; Orbit: the planet balls fly out as a spiral of shots 2.2 s, every second cycle; Zeiger: every third cycle the minute hand sweeps a full circle at 7 m radius, a red line turning slowly then fast (dodge through it); Stillstand: at 75, 50 and 25 % life it stops time for 2 s (hero ×0.5 speed) and two Uhrwerkläufer drop in. Defeated: sinks back onto its base and stands still; its Zahnrad drops | cycles ×1.35, a fourth sector |

Names in the Kodex and on the boss bar as above. Kodex lines (German, short): Uhrwerkläufer „Zifferblatt vorn. Von hinten treffen, Strom bringt das Werk aus dem Takt.“; Wurzler „Wurzeln halten fest. In Bewegung bleiben.“; Kernspeier „Spuckt Kerne im Fächer. Ran, solange er pflanzt.“; Wurzel-Mutter „Wuchs aus dem Glashaus des Palasts.“; Großer Uhrwerkläufer „Nach dem Ansturm läuft er ab.“; Koloss „Ein Stück Platte auf Uhrwerkbeinen.“; Weltzeituhr „Sie stand still. Bis du kamst.“

### Step 7 build order

1. Data and sim: kinds, resistances, the shield rule in `strike` (front arc, guard open), root hold in `hurtPlayer`/sim player state, Kernspeier fan in `threats.ts`; unit tests per rule; `alexWaveTier` mix; bosses replace `ALEX_BOSS_STANDIN`.
2. Bodies: Mech pack (Leela, Mike) through `tools/build-creatures.mjs` with vertex colours, new `BodyKind`s; Wurzler and Kernspeier in code; the Weltzeituhr boss shares the landmark geometry (the landmark mesh hides while it is awake).
3. Wake-up sequence, boss bar, Kodex, voices, balance bot run on `alexMap`.

## Day map light rules (proposal for step 3)

Afternoon sun replaces the moon as the shadow light (same single shadow map, warm low sun from the south-west). Lamps stay but are mostly off; light coverage test does not apply. Greenhouses, Weltzeituhr panels, shop fronts and fires still glow. The point light pool and its fixed count stay as they are.

## Enemy model research (2026-11-18)

Downloaded and opened (not committed): Quaternius **Animated Mech Pack** (CC0, `License.txt` in the pack; Drive link on quaternius.com/packs/animatedmech.html) and part of **Ultimate Monsters** (CC0, quaternius.com/packs/ultimatemonsters.html). Both ship glTF, the mech pack also as *Flat Colors* (fits the vertex color pipeline of `tools/build-creatures.mjs`). Contact sheet: [`../maps/alexanderplatz-models.jpg`](../maps/alexanderplatz-models.jpg).

| Model | Triangles | Clips | Use |
|---|---|---|---|
| Mech *Leela* | 2.4k | Idle, Walk, Run, Punch, Kick, SwordSlash, Shoot, HitRecieve 1/2, Death, Jump (18) | **Uhrwerkläufer**: barrel body with one big lens on bird legs. Repaint brass, cobalt and yellow; add dome cap, chimney, clock-face shield and a red plate with the hammer and sickle in code |
| Mech *Mike* | 6.1k | as Leela plus Run/Walk_Holding | **Großer Uhrwerkläufer** (zone 2 boss) at about 1.8×; boiler body, long arms. Also the leg rig for the Koloss (slab body in code) |
| Mech *George*, *Stan* | 7.9k, 6.1k | as Mike | Spare: thin walkers; Stan could be a clockwork Pionier |
| Monsters (Big, Blob, Flying) | 1–8k | Big: Idle, Walk, Run, Punch, Weapon, Jump, HitReact, Death; Blob: Bite_Front, Jump, Walk, Death | Cute toy style with big eyes; does not fit the painted board. Not used |

No free root or sunflower creature fits. Wurzler and Brigadeghul build on the zombie body (`zombie.glb`, like the M12 uniforms): roots, apron and sunflower head, or Blaumann, cap and red armband in code. Kernspeier is code-built (clay pot, stem, sunflower with teeth), with a procedural hop. The Weltzeituhr boss is the landmark itself, built in code with clockwork legs. Next: add the pack to `tools/fetch-assets.sh` (Drive, not itch.io) and a row per built GLB in `assets/LICENSES.md`.

## Handover 2026-11-18 (steps 1 and 2)

- Data: `src/data/alexanderplatz.ts` (layout C, scale 1: 390 × 295 m, origin the map centre). Spree and Kupfergraben around the Museumsinsel, three bridges (Monbijou, Liebknecht, Rathaus), the Stadtbahn as four brick viaduct runs with open arches where the Karl-Liebknecht-Straße, the Rathausstraße and the Spreeufer pass. Karl-Marx-Allee 22 m with the `allee` profile and fires down its middle strip. 13 encounters (27 waves, tier 16 to 38), four Spätis, three side passages (blessing at the Marienkirche, cache in a Nikolaiviertel yard, sleeping elite in a Plattenbau court).
- Final circle sits 12 m south of the Weltzeituhr so its centre stays free; the clock is a landmark until the boss is built.
- Stand-ins until step 7: bosses `ALEX_BOSS_STANDIN`, brutes for the shield walkers, spitters for the Kernspeier, crows on the island. District 2, loot flavour `gdr`.
- Tests: `src/data/alexanderplatz.test.ts` mirrors the Xhain invariants (waves, reach, open circles, no water in fights, bridges, viaduct closed between arches, lots off streets, street life, closed edges, lamps, light coverage, side passages, Spätis, scale, scripted victory). Light coverage still uses the night rule; step 3 decides the day rule.
- Wiring: `?map=alex` (options, `ui/maps.ts`, `main.ts`, bot `mapLevelOf('alex')`). No title or victory button leads here yet; add it when the district enemies and landmarks are in.
- Reused: Xhain map format (viaducts, `lane`, wave tier shape), Köpenick generators; 2D `js/alex.js` for the landmark list, zones and the Allee split.
- Next: step 3 needs look variants (afternoon light) shown to Johannes first; step 4 landmarks from photos; step 6 boss spec.

## Handover 2026-11-18 (steps 3 and 4)

- Light: `src/render/sky.ts` holds the night sky (old values, unchanged for every other map) and the three Alexanderplatz variants; `skyFor` picks A unless `?sky=b|c`. Renderer, map world (hemisphere, sun, pooled lamp strength, glow decals) and weather fog read it. The sun keeps the moon's single shadow map and pool; no new light.
- Landmarks: models in `src/render/alex-world.ts` (`buildAlexLandmark`), signs in one atlas material (`src/render/alex-paint.ts`, `MapMats.alex`, only built on this map): Weltzeituhr (rose floor, column with clocks and emblem, 24-sided drum with city panels and the red hour band, brass teeth, orbit sculpture), Dom (paired columns, mosaic portal west and a side portal south, corner towers, verdigris dome), Rotes Rathaus (three storeys of arched windows, terracotta frieze, clock tower with flag), Fernsehturm (folded pavilion roofs, chained door, shaft, sphere, antenna), Marienkirche, Nikolaikirche (twin spires), Neptunbrunnen, Brunnen der Völkerfreundschaft (bowl spiral), Haus des Lehrers (frieze lowered to 3.2 to 7.4 m for the camera), Kongresshalle, Kino International, Café Moskau (Sputnik), Altes Museum (18 columns), Palast der Republik (bronze glass, glass house vault), Hotel Stadt Berlin, both stations (name board and S roundel at street level). Reveal shot for eight of them (`reveal.ts`). Landmark sheets work for Alexanderplatz (`tools/landmark-sheet.mjs kind=<kind>`).
- Orientation as real: Dom, Palast, Marienkirche and Nikolaikirche fronts west, Rathaus front north; cues added on the faces the camera sees (Dom south portal, Rathaus windows and frieze all round).
- Photos looked at: Weltzeituhr, Dom, Rathaus, Brunnen der Völkerfreundschaft, Neptunbrunnen, Haus des Lehrers, Kino International, Nikolaikirche, Marienkirche. Corrected after the photos: the Brunnen has square copper funnels on posts and a mosaic basin wall, the Kino's upper floor is the glass, the Marienkirche tower is fieldstone, the Neptunbrunnen basin has four lobes (`docs/proof/m15-alex/landmark-photo-fixes.jpg`). Not checked against a photo yet (Wikimedia rate limit): Fernsehturm pavilion, Café Moskau, Altes Museum, Palast, Kongresshalle, Hotel, stations.
- Known: the Fernsehturm is inside the loop and only revealed when the hero explores the forum; the V1 B cut caps of Hinterhof lots show as black squares from above (shared with Xhain, hardware check 6).
- Next: step 5 buildings (Platte WBS 70, Zuckerbäcker, pavilions, greenhouses, Xhain Blockrand reuse), step 6 enemy and boss spec, then step 7.

## Handover 2026-11-18 (step 5)

- Rows: the Xhain Blockrand (`Street.block`) now also fills Plattenbau areas: tall slabs (5 to 6 floors, 22 to 32 m, lanes of 3 to 6 m between them, `PLATTE_BLOCK` in `map.ts`) away from the camera, single-storey pavilions and low slabs on the camera side. Altbau rows unchanged (Xhain and Köpenick generate byte-identical lots). On: Burgstraße, Karl-Liebknecht-Straße, Spreeufer, Rathausstraße, Alexanderstraße, Lichtenberger Straße, Karl-Marx-Allee, Mollstraße, Neue Promenade. Six hand-placed slabs fill the open blocks east of the Stadtbahn and on the Rolandufer (`handLots`).
- Plattenbau look (this map, intact lots): `buildAlexPlatte` in `alex-world.ts`: concrete panels with dark joints, two windows per panel, grey plinth, glass entrance under a canopy with the crest, the shared loggias, lift housing. Ruins keep the shared shell.
- Dressing (`dressAlexLots`): red banners with the hammer and sickle on some slabs and Altbau, the Pioneer mosaic on some gable ends, pavilion letter boards (KONSUM, HO, DELIKAT, OBST GEMÜSE, BLUMEN, FRISEUR) on the roof edge, two-sided because camera-side pavilions face away from the camera. Atlas grown to 2048 × 1536 (mural, six shop boards).
- Lot types (M11c): Museumsinsel Gewächshausgarten (`glashaus`: glass houses, beds, sunflowers, shed, trader spot, a hidden spitter) and Kleingärten; Nikolaiviertel and Spree bank Hinterhof and Markt; Allee and Holzmarkt Plattenbauhof (`plattenhof`: rocket climbing frame, sandbox walls, benches, clothesline, bins, car, three lying dead) and Baustelle. New props `greenhouse`, `sunflowers`, `climber`, `flagpole` (`src/render/props-gdr.ts`, colliders in `courtyard.ts`).
- Allee: flag poles with red banners down the middle (2D `aBanners`); beyond the east bound the two Zuckerbäcker towers of the Strausberger Platz on the Allee axis (render only). The Zuckerbäcker blocks themselves start at the Strausberger Platz, outside this map, so they stay backdrop.
- Tests: rows never tall on the camera side, at least six tall slabs, both lot types at scale 1 and 1.3.
- Reused: Xhain Blockrand, Köpenick loggias, `lane`, lot type framework; 2D `aBanners`, `glashaus` and `sonnen` lots, `zuckerB` colours.
- Next: step 6 enemy and boss spec (Opus), step 7 build.

## Handover 2026-11-18 (posters, Johannes: "the communist posters back")

- The 2D game's painted GDR art (Codex task 11, v0.69): torn red banner, blue banner, Pioneer poster, packed into `assets/textures/alex/posters.webp` (768 × 384, alpha; row in `assets/LICENSES.md`). Material `MapMats.posters` (alpha-tested, two-sided, this map only), code-painted fallback until the image is decoded (`paintPosterFallback`, `loadPosters` in `alex-paint.ts`).
- Where: Allee flag poles (red or blue), banners down Plattenbau and Altbau fronts, the Pioneer poster as the gable mural, pasted Pioneer posters at eye height on about half of the intact fronts and on every second viaduct bay. Proof `docs/proof/m15-alex/posters.jpg`.
- No Blender needed for step 7: `tools/build-creatures.mjs` converts the Quaternius packs in Node (FBXLoader, glTF export); Wurzler, Kernspeier and the Weltzeituhr boss are built in code.

## Handover 2026-11-18 (propaganda pass, decision A10)

- Giant Pioneer posters: on every Plattenbau gable end (as big as the wall), on two of three blank fire walls of the north map edge (7 m, with a camera), on the Kino front. Rows of the same poster side by side on two of three viaduct bays, on half the long fronts at eye height; one or a pair on most other fronts.
- Flags: 58 poles (Allee middle, a ring of 14 round the Weltzeituhr fight, both sidewalks of Karl-Liebknecht- and Rathausstraße between the tree pits, the Lustgarten), each with state radio horns, every second with a camera. Banners down every slab (one to three), most Altbau fronts, every Rathaus face, four 11 m banners on the Palast front, two 40 m banners down the Hotel Stadt Berlin, two on the Kino.
- Slogans (atlas, yellow on red): „Pünktlich ist glücklich“, „Die Zeit gehört dem Volk“, „Vorwärts zur Normalzeit“, „Lächeln, Genosse! Wir sehen dich“ on slab and Altbau fronts, every third viaduct bay and the Hotel base.
- Cameras (`cctv` in `alex-world.ts`, red LED, no light): about half the fronts, pavilion roofs, Rathaus corners, viaduct bays, fire walls, every second flag pole.
- Proof `docs/proof/m15-alex/propaganda.jpg`. Cost: all on the existing poster, atlas and shared materials (no new draw call per chunk beyond the poster material); hardware check 18 covers the look.
