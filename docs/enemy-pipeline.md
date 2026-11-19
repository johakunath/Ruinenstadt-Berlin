# Enemy pipeline

Index of every enemy, elite, boss and NPC with its 3D body and Kodex image, so gaps are visible at a glance.
Rule: every session that touches enemy bodies, animations, Kodex art or textures updates this file.
Legend: **female+gear** = `assets/characters/human2.glb` (H3: UBC Superhero_Female, the hero's proportions; Spreehexe, Wurzel-Mutter) with code gear; **human+gear** = `assets/characters/human1.glb` (H3: the zombie's body without the zombie repaint, boots; male humanoid bosses) with the same code gear; **zombie+gear** = `assets/characters/zombie.glb` rig with code gear and tints (`gearFor`, `TINTS`, `CLOTH`, `SHAPE` in `src/render/enemies.ts`); **GLB** = own converted model; **code** = built from primitives. Refined: `final` (accepted look), `ok` (own shape, reads right), `placeholder` (task file says so, or base body with a recolour). Status as of 2026-11-19 (WP5, `docs/tasks/wp5-enemies.md`).

## Summary

| Map | Kinds | On zombie rig | Own GLB | Code-built |
|---|---|---|---|---|
| Köpenick | 10 (6 normal, 4 bosses) | 7 | 2 (raptor, rex) | 1 (crow) |
| Xhain | 12 (8 normal, 4 bosses) | 10 | 0 | 2 (rat, crow) |
| U-Bahn tunnels | 5 (4 normal, 1 boss) | 5 | 0 | 0 |
| Alexanderplatz | 13 (9 normal, 4 bosses) | 7 | 2 (mech, mechBig) | 4 |
| Mitte | 14 (10 normal, 4 bosses) | 11 | 0 | 3 (drone, wachdrohne, crow) |
| Camp | 0 enemies, 7 keepers | 0 | 7 on `hero.glb` | 0 |

- Roster: 33 kinds (16 normal or special, 17 bosses) plus the Brigadeghul (walker variant on Alexanderplatz), 4 elite modifiers, 10 NPC types.
- Bodies: 22 kinds on the zombie rig (2 without own gear: walker, runner), 4 with an own GLB, 7 code-built. None is marked `final`.
- WP5 fix: zombie-rig gear is now built in the idle pose (`EnemyView.inIdle`); before, it took the pose the pooled view held (often a death pose), so helmets, caps, speakers, torch and lantern sat tilted.
- WP5 step 3 (H2): coats are fitted to the skinned body at build time (`BodyFit`, `fitCoat` in `src/render/enemies.ts`): ring shells per bone, skirts open at the front and hang (`hangSkirts`). Reuse them for any new coat on the zombie rig.
- Kodex: all 33 kinds have painted portraits, including 13 added in PR #56. SVG glyphs remain as fallbacks. Existing 2D busts still have the body mismatches listed below. The new portraits follow the current 3D designs and await side-by-side review.
- Voices (S3, WP5 step 4): the 16 human, robot and machine bosses each say three lines (`assets/voices/<kind>-<trigger>.ogg`: start, rage, signature special; table in `tools/voices.mjs`, rules in `src/audio/voices.ts`). No voice: the Rex and every normal kind. New boss: add its three lines and its `SIGNATURE` entry.
- Elite tiers in every map: an elite Brocken guards one side passage (`guards` in each map file; the tunnel "mini-boss" is this guard).

## Index

Maps: K Köpenick, X Xhain, T tunnels, A Alexanderplatz, M Mitte. Normal mixes from `waveTier` per map file; tunnels reuse the Köpenick tier at zone 0 (no crow, no raptor).

| Name | Kind | Role | Maps | Body | Refined | Kodex | Matches 3D | Needs | Prio |
|---|---|---|---|---|---|---|---|---|---|
| Schlurfer | walker | normal | K X T A M | zombie, no gear (cyber cables on M) | ok | E01 | yes | final skin pass | P1 |
| Hetzer | runner | normal | K X T A M | zombie, longer arms (cyber on M) | ok | E09 | yes | final skin pass | P1 |
| Brocken | brute | normal, elite guard | K X T A M | zombie+gear: open orange high-vis vest with reflective bands, collar | ok | E02 | yes | final skin pass | P1 |
| Speier | spitter | special | K X T A M | zombie+gear: throat sac, boils, bloated belly | ok | E03 | yes | final skin pass (bust skin is browner) | P1 |
| Raptor | raptor | special | K | GLB `raptor.glb` (Quaternius CC0) | ok | E11 | yes | none | P1 |
| Krähe | crow | normal | K X A M | code (body, wings, beak) | ok | E05 | yes | none | P1 |
| Der Feldwebel | feldwebel | boss | K | human+gear (WP5 H2, pick A): Pickelhaube with gold eagle, high-collared greatcoat to the knee fitted to the body, gold epaulettes, moustache, sabre; parchment skin, Prussian-blue trousers | ok | X04 | yes (bust coat rust-brown, body Prussian blue as the mockup) | hardware look check | P1 |
| Der Turmwächter | waechter | boss | K | GLB `mech.glb` (Leela, CC0; H3 step 3): the Fernsehturm on her legs, head hull hidden, ribbed tapering shaft over torso and neck, steel sphere head with lit cyan window ring (flares in his volley and ring), red-white antenna with beacon, flickering cyan sparks; rust tint on the legs | ok | X03 | yes (bust has a face, the body is the tower) | hardware look check (row 36) | P1 |
| Der Rex | rex | boss | K | GLB `rex.glb` (Quaternius CC0) | ok | E12 | yes | none | P1 |
| Hauptmann von Köpenick | hauptmann | boss | K | human+gear (WP5 H2, pick B): Pickelhaube with gold eagle (no plume), white moustache, long officer's greatcoat, red cape, gold sash, epaulettes, sabre | ok | X01 | yes (cape and sash added per pick) | hardware look check | P1 |
| Ratte | rat | normal (packs of 5) | X | code (body, ears, tail) | ok | E04 | yes | none | P2 |
| Der Grenzer | grenzer | boss | X | human+gear: peaked cap, olive tunic, rifle; WP5 H2: pale grey skin, GDR stone-grey trousers | placeholder | X11 | unverified | silhouette review | P2 |
| Der Brandmeister | brandmeister | boss | X | human+gear (WP5 H2, pick A): leather fire helmet with flickering flames, turnout coat with yellow bands fitted to the body (no more clipping), chest lamp; torch removed | ok | X10 | yes | hardware look check | P2 |
| Die Rattenmutter | rattenmutter | boss | X | zombie+gear (WP5 H2, pick A): giant rat head with crown on the neck (skull shrunk away), fur cloak, torn oxblood rag dress, strong hunch | ok | X06 | yes | hardware look check | P2 |
| Die Spreehexe | spreehexe | boss | X | female+gear: punk crest, black coat, acid hand | placeholder | X12 | unverified | silhouette review | P2 |
| Der Schaffner | schaffner | boss | T | human+gear (WP5 H2, pick A): peaked cap with brass badge, long double-breasted navy coat, the Kelle held high in the right hand | ok | X05 | yes | hardware look check | P4 |
| Brigadeghul | walker (render) | normal | A | zombie+gear: Blaumann, cap, armband | ok | E01 (walker) | no, walker bust | none, shares walker | P4 |
| Uhrwerkläufer | uhrwerk | normal | A | GLB `mech.glb` (Leela, CC0) + clock shield, dome, key | ok | E16 | unverified | compare portrait and body | P4 |
| Wurzler | wurzler | special | A | zombie+gear: roots, apron, sunflower face | placeholder | E17 | unverified | silhouette review | P4 |
| Kernspeier | kernspeier | special | A | code (clay pot, stem, toothed sunflower) | ok | E18 | unverified | compare portrait and body | P4 |
| Die Wurzel-Mutter | wurzelmutter | boss | A | female+gear: roots, crown of sunflowers | placeholder | X13 | unverified | silhouette review | P4 |
| Der Große Uhrwerkläufer | uhrwerkgross | boss | A | GLB `mechbig.glb` (Mike, CC0) + key | ok | X14 | unverified | compare portrait and body | P4 |
| Der Volkseigene Koloss | volkskoloss | boss | A | code (Plattenbau slab, clockwork legs, arms) | ok | X15 | unverified | compare portrait and body | P4 |
| Die Weltzeituhr | weltzeituhr | boss | A | code (landmark rig `src/render/clock.ts` on four legs) | ok | X16 | unverified | compare portrait and body | P4 |
| Kabelghul | kabel | normal | M | zombie+gear: lit cyan cable arches, cyan implants and eyes, red scarf, crouch | ok | E13 | yes | none | P4 |
| Zünder | zuender | special | X A M | zombie+gear: dynamite bundle, detonator, fuse spark, red scarf | ok | E07 | yes | none | P2 |
| Schildträger | schild | normal | M | zombie+gear: riot helmet with visor, shoulder plates, shield (swings aside when the guard opens) | ok | E06 | yes | none | P4 |
| Heuler | heuler | special | X | zombie+gear: swollen throat that bulges on the howl | ok | E08 | yes | none | P2 |
| Boxenkopf | bass | special | M | zombie+gear: speaker head, violet rags | ok | E14 | yes | none | P4 |
| Drohne | drone | normal | M | code (`buildDrone`) | ok | E15 | unverified | compare portrait and body | P4 |
| Der Türsteher | tuersteher | boss | M | human+gear: bomber jacket, glasses, clipboard; rage effect: neon bars across the Tor passages (`src/render/barriers.ts`, P25) | placeholder | X17 | unverified | silhouette review; bar look on hardware | P4 |
| Die Wachdrohne | wachdrohne | boss | M | code (`buildDrone`, big) | ok | X18 | unverified | compare portrait and body | P4 |
| Der Dirigent | dirigent | boss | M | human+gear: tailcoat, bow tie, baton, speaker | placeholder | X19 | unverified | silhouette review | P4 |
| Der Bassprediger | bassprediger | boss | M | human+gear: speaker head, five cables, mixer | ok | X09 | yes | none | P4 |
| Flink / Brennend / Spaltend / Gepanzert | elite mods | elite | all | host body ×1.15 plus a faint glow in the mod colour | placeholder | L01 to L04 | unverified | mod-specific gear | P1 |
| Späti-Wirt | keeper | NPC | all expeditions | `hero.glb` in vest + flat cap, apron (`src/render/content.ts`) | placeholder | none | n/a | own look | P3 |
| Händler | trader | NPC | expeditions | `hero.glb` + wide hat, pack, green lantern | placeholder | none | n/a | own look | P3 |
| Gefangener | captive | NPC | expeditions | `hero.glb` in vest, no gear | placeholder | none | n/a | per-survivor look | P3 |
| Dr. Ahmet, Mira, Jonas, Oma Gerda, Lin, Kalle | survivors | NPC | camp | `hero.glb` + per-station dress (`dress` in `src/render/camp-stations.ts`) | placeholder | S01 to S06 | unverified | compare busts | P3 |
| Ilse | kom keeper | NPC | camp | `hero.glb` + olive cap, red armband, clipboard | placeholder | S07 (camp) | unverified | Kodex entry | P3 |

Sources: kinds and bodies `src/data/enemies.ts` (`ENEMIES[].body`), gear `gearFor` in `src/render/enemies.ts` and `src/render/enemies-alex.ts`, busts `ENEMY_PORTRAIT` in `src/ui/menu.ts`, licences `assets/LICENSES.md`. "Placeholder" for zombie-rig bosses follows `docs/tasks/m12b-xhain-enemies.md` and `m12c-mitte-enemies.md`; for Köpenick and tunnel bosses it is a judgment (no task note).

## Priorities

| Prio | Scope | First jobs |
|---|---|---|
| P1 | Köpenick enemies and bosses | Boss looks built (WP5 step 3, proof `docs/proof/wp5/bosses-h2.webp`); hardware look check; elite readability |
| P2 | Xhain | Rattenmutter and Brandmeister built (WP5 step 3); compare Grenzer and Spreehexe with X11 and X12 |
| P3 | NPCs | Späti-Wirt, Händler, captive and the 7 keepers all share the hero body: give each a distinct silhouette; check survivors against S01 to S06; Kodex entry for Ilse (her portrait is used in the camp) |
| P4 | Tunnels, Alexanderplatz, Mitte | Schaffner built (WP5 step 3); compare the new portraits with their bodies |

## Kodex from 3D renders

- Render Kodex portraits from the in-game bodies with `tools/enemy-sheet.mjs` (`kind=…&state=…`, dev server running), so the Kodex always shows the body the player fights.
- Framing: head and shoulders (bosses and creatures: full head and upper body), warm key light, cool rim light, dark plain background, 64 px target with a 256 px source. `enemy-sheet.ts` has only a fixed hemisphere and sun light and a `view` option today: a portrait mode with camera framing and the two lights is still to build.
- Swap one kind at a time once its body is `final`; painted busts stay until then.
- Store renders as `assets/portraits/<id>.webp` with a row in `assets/LICENSES.md`, mapped in `ENEMY_PORTRAIT`.

## Route per job

| Job | Route |
|---|---|
| Gear, colours, proportions, procedural bodies (crow, rat, drone, Kernspeier, Koloss) | Code: `src/render/enemies.ts`, `src/render/enemies-alex.ts` (one material per colour, parts merged) |
| New creature or mech from a CC0 pack | Node conversion: `tools/build-creatures.mjs` (FBXLoader, bake to meters, vertex-colour repaint, glTF export); licence row in `assets/LICENSES.md` |
| Painted textures and painted busts | Codex only (`docs/asset-pipeline.md`); Claude does the performance integration |
| Rigging a new body or retargeting animations | Blender (headless, as in `npm run assets:hero`), only for this |
