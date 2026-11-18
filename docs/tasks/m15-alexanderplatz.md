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
| A8 | Koloss stays on the Karl-Marx-Allee (zone 3 boss). Boss and enemy specs are written by Opus; a Fable pass only if Johannes does not like a boss |
| A7 | Order: after Xhain. Xhain (PR #46) changes the map format (Stadtbahn viaducts, Blockrand rows, map selection, enemy roster); build on it once it is in `main`. Reuse its Altbau blocks, back yards and building parts where they fit (Nikolaiviertel, Spandauer Vorstadt edge) |

## Steps

| # | Step | Needs | Model | State |
|---|---|---|---|---|
| 0 | Concept, geography check, enemy model research | | Opus | done 2026-11-18 |
| 1 | Data `src/data/alexanderplatz.ts` from the anchors below; map SVG from the data shown in chat (`docs/maps/alexanderplatz.svg`) | #46 merged | Opus high | done 2026-11-18 |
| 2 | Playable blockout `?map=alex` with the existing generators; invariant tests at scale 1 and 1.3 (`src/data/alexanderplatz.test.ts`) | 1 | Opus high | done 2026-11-18: URL only, no title button yet; stand-in bosses, landmark massing and the brick Stadtbahn in `src/render/alex-world.ts` |
| 3 | Afternoon look: sun direction and color, sky, grade, fog; light rules for a day map (below) | 2 | Opus high, mockup first | open |
| 4 | Landmarks in code from photos (`docs/maps/landmarks.md`) | 2 | Opus high | open |
| 5 | Buildings: Platte (WBS 70), Zuckerbäcker blocks, 60s pavilions, greenhouses, Xhain Altbau blocks; two lot types per zone | 2, #46 | Opus high | open |
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

## Bosses (proposal for step 6)

| Zone | Boss | Idea |
|---|---|---|
| 1 Museumsinsel | Wurzel-Mutter | Giant Wurzler grown out of the Palast glass house; root fields with warning, sunflower adds |
| 2 Nikolaiviertel | Großer Uhrwerkläufer | Huge shield bearer, clock-face shield turns to face the hero, punish window when it rewinds |
| 3 Karl-Marx-Allee | Volkseigener Koloss (2D boss) | Walking Plattenbau slab, hammer arm and compass arm |
| Final | Die Weltzeituhr | Idle landmark until the hero enters its circle on the last objective; wake-up of about 3 s (gears start, city panel ring spins up, the column lifts off its base on clockwork legs, roar ring), invulnerable while waking. Fights with the turning panel ring and orbit sculpture. Defeated: sinks back onto its base and stops; drops its Zahnrad (story) |

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
