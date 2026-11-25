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
| Charlottenburg | 14 (9 normal, 4 bosses, the Spiegelbild) | 12 (6 zombie; Conférencier and Ringvater on `human1`; Scherbentänzerin, Spiegelpaar, Spiegelbild and Diva on `human2`) | 0 | 2 (crow, rat) |
| Wedding | 7 (3 normal, 4 bosses) plus the Zecher dress | 5 (3 zombie; Zugezogener and Sultan on `human1`) | 0 | 2 (carpet; the Bauherr on the Koloss slab) |
| Fernsehturm (M17) | 1 new boss (Der Zeitwart) plus three echoes and existing kinds of every district | 1 (Zeitwart on `human1`) | 0 | 0 (the echo dial is a render mark) |
| Camp | 0 enemies, 7 keepers | 0 | 7 on `hero.glb` | 0 |

- Roster: 41 kinds (19 normal or special, 21 bosses, the Spiegelbild) plus the Brigadeghul (walker variant on Alexanderplatz), 4 elite modifiers, 10 NPC types. M16 (2026-11-19, `docs/tasks/m12d-charlottenburg-enemies.md`): three Charlottenburg kinds, four bosses and the reflection, all code gear (placeholder); 1920s dress for Schlurfer, Hetzer, Brocken and Speier on `revue` maps (render only). Kodex: 3D renders E19 to E21, X20 to X23 (2026-11-20); no boss voices yet.
- M18 Wedding (2026-11-21, `docs/tasks/m12e-wedding-enemies.md`): three kinds, four bosses, all code gear (placeholder); the Zecher dress (stained shirt and a mug) for Schlurfer, Hetzer and Speier, a mug for the Brocken on `fest` maps (render only). Kodex: 3D renders E22 to E24, X24 to X27. Proof `docs/proof/m18-wedding/enemies/`. Draws per body (main pass in `tools/enemy-sheet.mjs`, no shadow): Tee-Ifrit 12 (Speier 6), Baklava-Brocken 15 (Schildträger 19), Teppichschlinger 7 (Krähe 19), Zugezogener 14 and Hauptgericht 15 (Feldwebel 17), Bauherr 17 (Koloss 18), Sultan 25 (Diva 20), a Zecher 7 (Schlurfer 4).
- KA A2 (2026-11-25, `docs/tasks/kit-texture-atlas.md`): the shared kit atlas `assets/textures/enemies/kit.webp` paints the baked filo (layers on the sides, baked crust on the tops) and brass (tarnish) of every paint-mode body, 0 draw calls. Visible on the Baklava-Brocken and the Hauptgericht (Kodex E23 and X25 rendered again), soft tarnish on the samovar; brass on small parts (buttons, crowns) shows no change at game scale. A3 the same day: dirty veined ear skin on the Rattenmutter's ears and nose (Kodex X06 rendered again); mirror and tea glass tried and dropped (parts too small). [Proof](proof/t10-kit/).
- Bodies: 22 kinds on the zombie rig (2 without own gear: walker, runner), 4 with an own GLB, 7 code-built. None is marked `final`.
- WP5 fix: zombie-rig gear is now built in the idle pose (`EnemyView.inIdle`); before, it took the pose the pooled view held (often a death pose), so helmets, caps, speakers, torch and lantern sat tilted.
- WP5 step 3 (H2): coats are fitted to the skinned body at build time (`BodyFit`, `fitCoat` in `src/render/enemies.ts`): ring shells per bone, skirts open at the front and hang (`hangSkirts`). Reuse them for any new coat on the zombie rig.
- Kodex (2026-11-20, Johannes' playtest): every enemy and boss portrait (E, X) and the four elite portraits (L, a Brocken with the mod's tint and a rim light in its colour) are renders of the in-game 3D bodies (`tools/kodex-portraits.mjs`), so all 40 Kodex kinds match their body; the painted 2D and Codex busts are replaced (in git history). SVG glyphs remain as fallbacks. Survivor portraits S01 to S07 are unchanged.
- Voices (S3, WP5 step 4): the 16 human, robot and machine bosses each say three lines (`assets/voices/<kind>-<trigger>.ogg`: start, rage, signature special; table in `tools/voices.mjs`, rules in `src/audio/voices.ts`). No voice: the Rex and every normal kind. New boss: add its three lines and its `SIGNATURE` entry.
- Elite tiers in every map: an elite Brocken guards one side passage (`guards` in each map file; the tunnel "mini-boss" is this guard).

## Index

Maps: K Köpenick, X Xhain, T tunnels, A Alexanderplatz, M Mitte, C Charlottenburg, W Wedding. Normal mixes from `waveTier` per map file; tunnels reuse the Köpenick tier at zone 0 (no crow, no raptor).

| Name | Kind | Role | Maps | Body | Refined | Kodex | Matches 3D | Needs | Prio |
|---|---|---|---|---|---|---|---|---|---|
| Schlurfer | walker | normal | K X T A M | zombie, no gear (cyber cables on M) | ok | E01 (3D render) | yes | final skin pass | P1 |
| Hetzer | runner | normal | K X T A M | zombie, longer arms (cyber on M) | ok | E09 (3D render) | yes | final skin pass | P1 |
| Brocken | brute | normal, elite guard | K X T A M | zombie+gear: open orange high-vis vest with reflective bands, collar | ok | E02 (3D render) | yes | final skin pass | P1 |
| Speier | spitter | special | K X T A M | zombie+gear: throat sac, boils, bloated belly | ok | E03 (3D render) | yes | final skin pass | P1 |
| Raptor | raptor | special | K | GLB `raptor.glb` (Quaternius CC0) | ok | E11 (3D render) | yes | none | P1 |
| Krähe | crow | normal | K X A M | code (body, wings, beak) | ok | E05 (3D render) | yes | none | P1 |
| Der Feldwebel | feldwebel | boss | K | H4 trial (2026-11-24): own skinned body `boss-feldwebel.glb` (FLUX + Pixal3D on the human skeleton, `docs/local-ai-assets.md` › W8), sabre from the rack; before: human+gear (WP5 H2, pick A) with Pickelhaube, greatcoat, epaulettes, moustache | ok, trial | X04 (3D render) | yes | hardware look check | P1 |
| Der Turmwächter | waechter | boss | K | GLB `mech.glb` (Leela, CC0; H3 step 3): the Fernsehturm on her legs, head hull hidden, ribbed tapering shaft over torso and neck, steel sphere head with lit cyan window ring (flares in his volley and ring), red-white antenna with beacon, flickering cyan sparks; rust tint on the legs | ok | X03 (3D render) | yes | hardware look check (row 36) | P1 |
| Der Rex | rex | boss | K | GLB `rex.glb` (Quaternius CC0) | ok | E12 (3D render) | yes | none | P1 |
| Hauptmann von Köpenick | hauptmann | boss | K | H4 own body `boss-hauptmann.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the sabre (rack)); before: human+gear (WP5 H2, pick B): Pickelhaube with gold eagle (no plume), white moustache, long officer's greatcoat, red cape, gold sash, epaulettes, sabre | ok | X01 (3D render) | yes | hardware look check | P1 |
| Ratte | rat | normal (packs of 5) | X | code (body, ears, tail) | ok | E04 (3D render) | yes | none | P2 |
| Der Grenzer | grenzer | boss | X | H4 own body `boss-grenzer.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the rifle); before: human+gear: peaked cap, olive tunic, rifle; WP5 H2: pale grey skin, GDR stone-grey trousers | ok | X11 (3D render) | yes | silhouette review | P2 |
| Der Brandmeister | brandmeister | boss | X | H4 own body `boss-brandmeister.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the flickering flames); before: human+gear (WP5 H2, pick A): leather fire helmet with flickering flames, turnout coat with yellow bands fitted to the body (no more clipping), chest lamp; torch removed; T8 worn wool coat map (2026-11-24) | ok | X10 (3D render) | yes | hardware look check | P2 |
| Die Rattenmutter | rattenmutter | boss | X | zombie+gear (WP5 H2, pick A): giant rat head with crown on the neck (skull shrunk away), fur cloak, torn oxblood rag dress, strong hunch; T8 matted fur map on head and cloak (local FLUX.2 klein, 2026-11-24, `assets/textures/enemies/fur.webp`) | ok | X06 (3D render) | yes | hardware look check | P2 |
| Die Spreehexe | spreehexe | boss | X | H4 own body `boss-spreehexe.glb` (Pixal3D on the female skeleton, upright clips, 2026-11-25; still code: the acid orb); before: female+gear: punk crest, black coat, acid hand | ok | X12 (3D render) | yes | silhouette review | P2 |
| Der Schaffner | schaffner | boss | T | H4 own body `boss-schaffner.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the Kelle); before: human+gear (WP5 H2, pick A): peaked cap with brass badge, long double-breasted navy coat, the Kelle held high in the right hand; T8 worn wool coat map (2026-11-24) | ok | X05 (3D render) | yes | hardware look check | P4 |
| Brigadeghul | walker (render) | normal | A | zombie+gear: Blaumann, cap, armband | ok | E01 (walker) | no, walker render (no Blaumann) | none, shares walker | P4 |
| Uhrwerkläufer | uhrwerk | normal | A | GLB `mech.glb` (Leela, CC0) + clock shield, dome, key | ok | E16 (3D render) | yes | none | P4 |
| Wurzler | wurzler | special | A | zombie+gear: roots, apron, sunflower face | placeholder | E17 (3D render) | yes | silhouette review | P4 |
| Kernspeier | kernspeier | special | A | code (clay pot, stem, toothed sunflower) | ok | E18 (3D render) | yes | none | P4 |
| Die Wurzel-Mutter | wurzelmutter | boss | A | H4 own body `boss-wurzelmutter.glb` (Pixal3D on the female skeleton, upright clips, 2026-11-25; still code: nothing); before: female+gear: roots, crown of sunflowers | ok | X13 (3D render) | yes | silhouette review | P4 |
| Der Große Uhrwerkläufer | uhrwerkgross | boss | A | GLB `mechbig.glb` (Mike, CC0) + key | ok | X14 (3D render) | yes | none | P4 |
| Der Volkseigene Koloss | volkskoloss | boss | A | code (Plattenbau slab, clockwork legs, arms) | ok | X15 (3D render) | yes | none | P4 |
| Die Weltzeituhr | weltzeituhr | boss | A | code (landmark rig `src/render/clock.ts` on four legs) | ok | X16 (3D render) | yes | none | P4 |
| Kabelghul | kabel | normal | M | zombie+gear: lit cyan cable arches, cyan implants and eyes, red scarf, crouch | ok | E13 (3D render) | yes | none | P4 |
| Zünder | zuender | special | X A M | zombie+gear: dynamite bundle, detonator, fuse spark, red scarf | ok | E07 (3D render) | yes | none | P2 |
| Schildträger | schild | normal | M | zombie+gear: riot helmet with visor, shoulder plates, shield (swings aside when the guard opens) | ok | E06 (3D render) | yes | none | P4 |
| Heuler | heuler | special | X | zombie+gear: swollen throat that bulges on the howl | ok | E08 (3D render) | yes | none | P2 |
| Boxenkopf | bass | special | M | zombie+gear: speaker head, violet rags | ok | E14 (3D render) | yes | none | P4 |
| Drohne | drone | normal | M | code (`buildDrone`) | ok | E15 (3D render) | yes | none | P4 |
| Der Türsteher | tuersteher | boss | M | H4 own body `boss-tuersteher.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the clipboard; the rage bars); before: human+gear: bomber jacket, glasses, clipboard; rage effect: neon bars across the Tor passages (`src/render/barriers.ts`, P25) | ok | X17 (3D render) | yes | silhouette review; bar look on hardware | P4 |
| Die Wachdrohne | wachdrohne | boss | M | code (`buildDrone`, big) | ok | X18 (3D render) | yes | none | P4 |
| Der Dirigent | dirigent | boss | M | H4 own body `boss-dirigent.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the baton); before: human+gear: tailcoat, bow tie, baton, speaker | ok | X19 (3D render) | yes | silhouette review | P4 |
| Der Bassprediger | bassprediger | boss | M | H4 own body `boss-bassprediger.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: nothing (the speaker head is gone, his face shows)); before: human+gear: speaker head, five cables, mixer | ok | X09 (3D render) | yes | none | P4 |
| Scherbentänzerin | scherbe | normal | C | female+gear: glass corset and torn shard tutu, violet feather plume, glass tiara, porcelain half mask, pearls; spins (two turns) in the pirouette | placeholder | E19 (3D render) | yes | silhouette review | P5 |
| Logenbrecher | loge | normal (2 alive) | C | zombie+gear (Brocken shape): torn tux with crimson collar and cape scrap, smoked-glass front on the chest (swings aside when the guard is down or he stands open), lit chandelier drops behind it, glass shards on shoulders, forearms and fists | placeholder | E20 (3D render) | yes | front readable at play distance | P5 |
| Spiegelsouffleur | souffleur | special (2 alive) | C | zombie+gear (thin): long torn plum coat, white mirror mask, fan crest of eleven glass blades behind the head, violet ribbons; hovers 0.3 m (render only) | placeholder | E21 (3D render) | yes | none | P5 |
| Zeitlose in 1920s dress | walker, runner, brute, spitter (render) | normal | C | zombie+gear on `flavor: 'revue'`: tails or an usher's jacket and cap (Schlurfer, by id), a page's uniform and pillbox (Hetzer), a stagehand's apron, flat cap and rope (Brocken, replaces the vest), a cigarette tray and pillbox (Speier) | placeholder | E01, E09, E02, E03 | no, base renders | none, share the base renders | P5 |
| Der Conférencier | conferencier | boss | C | H4 own body `boss-conferencier.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the cane); before: human+gear: tailcoat open at the front, shirt front with pearl studs, crimson bow tie, top hat, half mask of mirror shards, silver cane with a cut-glass knob | ok | X20 (3D render) | yes | voices | P5 |
| Der Ringvater | ringvater | boss | C | H4 own body `boss-ringvater.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the gold ring at his feet); before: human+gear (broad): long dark coat with a thick fur collar, the Ringverein's crimson sash with a brass badge, bowler, moustache, three signet rings per hand; gold ring at his feet while guarded (`src/render/threats.ts`) | ok | X21 (3D render) | yes | voices | P5 |
| Das Spiegelpaar | spiegelpaar | boss | C | H4 own body `boss-spiegelpaar.glb` (Pixal3D on the female skeleton, upright clips, 2026-11-25; still code: the warm ring at her feet); before: female+gear: the dancer's cut in silver glass, red sash, lit heart, violet plume; warm ring at her feet | ok | X22 (3D render) | yes | voices | P5 |
| Spiegelbild | spiegelbild | boss part (cannot be hurt) | C | H4 own body `boss-spiegelpaar.glb` (Pixal3D on the female skeleton, upright clips, 2026-11-25; still code: nothing; the Spiegelpaar body in frost blue, mirrored); before: female+gear in cold frost glass, no sash, no heart, mirrored left to right (negative x scale); copies her animation | ok | none (not in the Kodex) | n/a | none | P5 |
| Die Diamantene Diva | diva | district boss | C | H4 own body `boss-diva.glb` (Pixal3D on the female skeleton, upright clips, 2026-11-25; still code: the breakable gown tiers, the halo and mask, the fans); before: female+gear: glass corset, a gown of three stepped tiers of overlapping pleated glass fan panels with silver ribs and pointed shard hems, crystal drops on the lowest (2026-11-19, replaced the stacked cones; the bottom tier breaks at 66 %, the middle at 33 %), violet cape to the floor, tall halo of violet feathers, glass spikes and diamonds, lit crystal heart, stage mask, four big glass fans floating round her (one merged mesh) | ok | X23 (3D render) | yes | voices; tier break effect | P5 |
| Tee-Ifrit | teeifrit | special (3 alive) | W | zombie+gear: legs scaled away above a brass samovar with a glowing tea band and tap, twisted steam wisps into the waist and off the back, amber skin, a glowing tea glass in each hand; upright, bobs | placeholder | E22 (3D render) | yes | silhouette review (board: a smoke blob, here a body) | P6 |
| Baklava-Brocken | baklava | normal (2 alive) | W | zombie+gear (Brocken shape): stacked filo slabs with honey layers and drips, a block head with pistachio crumbs and green eyes (skull shrunk away), honey fists, a silver tray as shield (gear [0], swings aside while open) | placeholder | E23 (3D render) | yes | none | P6 |
| Teppichschlinger | teppich | normal | W | code (`buildRug`): one cloth grid in vertex colours (ruby, gold border, emerald medallion) waved on the CPU, the front reared up like a snake's head with a woven face, teeth and gold eyes, tassels; T10 painted carpet map (2026-11-24, `assets/textures/wedding/rug.webp`) | placeholder | E24 (3D render) | yes | none | P6 |
| Zecher | walker, runner, brute, spitter (render) | normal | W | zombie+gear on `flavor: 'fest'`: stained white undershirt and a beer mug (Schlurfer, Hetzer, Speier), the Brocken keeps his hi-vis vest and gets a big mug | placeholder | E01, E09, E02, E03 | no, base renders | none, share the base renders | P6 |
| Der Zugezogene | zugezogene | boss | W | H4 own body `boss-zugezogene.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the coffee cup, the e-scooter); before: human+gear (slim): oxblood knit beanie, round glasses, waxed moustache, open olive jacket over a white shirt, tote bag on the hip, oat-milk coffee cup; an e-scooter under him while he charges (separate group) | ok | X24 (3D render) | yes | voices | P6 |
| Das Hauptgericht | hauptgericht | boss | W | zombie+gear at scale 2: the Baklava-Brocken's body, an upright meat spit in the right fist that turns (faster in the sweep), the silver tray with baklava in the left; the body turns once in the Drehspieß | placeholder | X25 (3D render) | yes | voices | P6 |
| Der Ewige Bauherr | bauherr | boss | W | code (`buildKoloss` + `bauherrSet`): the Koloss slab under scaffold poles, ledgers and planks, green net on the sides, a hi-vis band, a cream banner over the GDR one, a yellow hard hat on the cab, an orange cement mixer on the back that turns (the clock ring hidden) | placeholder | X26 (3D render) | yes | voices; banner text „Kommt bald“ (sign atlas of step 3) | P6 |
| Sultan Nimmersatt | sultan | district boss | W | H4 own body `boss-sultan.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the glowing urn, the trays (66 % and 33 %), the spoon sceptre, the carpet); before: human+gear: emerald robe with gold collar and buttons, ruby sash, a glass tea urn as belly in a brass cage (glows), serving trays on the shoulders with a dish each (Vorspeise gone at 66 %, Hauptgang at 33 %), gold crown band with jewels and two swept-back feathers (no religious sign), beard, spoon sceptre; floats 0.3 m on a ruby carpet with gold border and tassels | ok | X27 (3D render) | yes | voices; course change effect | P6 |
| Der Zeitwart | zeitwart | final boss | F | H4 own body `boss-zeitwart.glb` (Pixal3D on the human skeleton, upright clips, 2026-11-25; still code: the Unruh, watch chains, pendulum, clock-hand blades); before: human+gear: steel-blue skin (robot), long grey-blue work coat with brass buttons and belt, watch chains, the Unruh in an open brass housing on the chest (glows; J2: his heart), peaked cap with a dial badge, dial monocle with an amber lens, the minute hand as the right forearm blade, the hour hand on the left, a pendulum on the back; a dial on the ground in his era's colour (green, orange, magenta per phase), gold shimmer while he stands in the movement; T8 worn wool coat map (2026-11-24) | ok | X28 (3D render) | yes | a robot face (plates, seams) in Blender or a bust; phase tints on the coat (now only the dial) | P6 |
| Echoes (Hauptmann, Spreehexe, Sultan) | (their kinds) | echo bosses | F | the boss's own body, pale (emissive wash), on a pale dial with a frozen second hand (`src/render/echo-mark.ts`) | placeholder | none of their own | yes | an afterimage trail (board 2) | P8 |
| Flink / Brennend / Spaltend / Gepanzert | elite mods | elite | all | host body ×1.15 plus a faint glow in the mod colour | placeholder | L01 to L04 (3D render on a Brocken) | yes | mod-specific gear | P1 |
| Späti-Wirt | keeper | NPC | all expeditions | `hero.glb` in vest + flat cap, apron (`src/render/content.ts`) | placeholder | none | n/a | own look | P3 |
| Händler | trader | NPC | expeditions | `hero.glb` + wide hat, pack, green lantern | placeholder | none | n/a | own look | P3 |
| Gefangener | captive | NPC | expeditions | `hero.glb` in vest, no gear | placeholder | none | n/a | per-survivor look | P3 |
| Dr. Ahmet, Mira, Jonas, Oma Gerda, Lin, Kalle | survivors | NPC | camp | `hero.glb` + per-station dress (`dress` in `src/render/camp-stations.ts`) | placeholder | S01 to S06 | unverified | compare busts | P3 |
| Ilse | kom keeper | NPC | camp | `hero.glb` + olive cap, red armband, clipboard | placeholder | S07 (camp) | unverified | Kodex entry | P3 |

Sources: kinds and bodies `src/data/enemies.ts` (`ENEMIES[].body`), gear `gearFor` in `src/render/enemies.ts` and `src/render/enemies-alex.ts`, portraits `ENEMY_PORTRAIT` in `src/ui/menu.ts`, licences `assets/LICENSES.md`. "Placeholder" for zombie-rig bosses follows `docs/tasks/m12b-xhain-enemies.md` and `m12c-mitte-enemies.md`; for Köpenick and tunnel bosses it is a judgment (no task note).

## Priorities

| Prio | Scope | First jobs |
|---|---|---|
| P1 | Köpenick enemies and bosses | Boss looks built (WP5 step 3, proof `docs/proof/wp5/bosses-h2.webp`); hardware look check; elite readability |
| P2 | Xhain | Rattenmutter and Brandmeister built (WP5 step 3); compare Grenzer and Spreehexe with X11 and X12 |
| P3 | NPCs | Späti-Wirt, Händler, captive and the 7 keepers all share the hero body: give each a distinct silhouette; check survivors against S01 to S06; Kodex entry for Ilse (her portrait is used in the camp) |
| P6 | Wedding | Boss voices (three lines each and `SIGNATURE`), look review of the code bodies (proof `docs/proof/m18-wedding/enemies/`), the Bauherr's banner text |
| P5 | Charlottenburg | Boss voices (three lines each and `SIGNATURE`), look review of the code bodies (proof `docs/proof/m16-charlottenburg/enemies/`) |
| P4 | Tunnels, Alexanderplatz, Mitte | Schaffner built (WP5 step 3) |

## Kodex from 3D renders

- Every enemy, boss and elite portrait is a render of the in-game body (2026-11-20), so the Kodex always shows the body the player fights. Survivor portraits (S) are painted busts.
- Regenerate all: `PORT=5173 node tools/kodex-portraits.mjs` (dev server running; add kind or elite names for a few, `OUT=dir` for a preview). It reads `ENEMY_PORTRAIT` and `ELITE_PORTRAIT` in `src/ui/menu.ts` and renders `tools/enemy-sheet.html?portrait=1&kinds=…` (`kind+mod` for an elite, on a Brocken).
- Framing: the top 42 % of the body's visible bounding box (long bodies: only the front part), camera 28° off the front; small creatures and drones whole; `PORTRAIT` in `tools/enemy-sheet.ts` holds the few overrides (plumes, the Diva's fans, the shield). Warm key light, cool rim light (elites: the mod colour), the `.kimg` card gradient as background, idle pose. Rendered at 512 px, saved as 256 px WebP (2 to 7 KB).
- Rerun it whenever a body or its gear changes; a new kind needs only its id in `ENEMY_PORTRAIT` and a row in `assets/LICENSES.md`.

## Route per job

| Job | Route |
|---|---|
| Gear, colours, proportions, procedural bodies (crow, rat, drone, Kernspeier, Koloss) | Code: `src/render/enemies.ts`, `src/render/enemies-alex.ts` (one material per colour, parts merged) |
| New creature or mech from a CC0 pack | Node conversion: `tools/build-creatures.mjs` (FBXLoader, bake to meters, vertex-colour repaint, glTF export); licence row in `assets/LICENSES.md` |
| Painted textures and painted busts | Local first (FLUX.2 klein, `docs/local-ai-assets.md`), Codex as fallback; Claude does the performance integration |
| Rigid boss parts on one bone (rat head, helmets, sunflower head) | Image-to-3D (Pixal3D) plus Blender clean-up, fixed to the bone like rigid gear (`docs/local-ai-assets.md` W4 to W6) |
| Rigging a new body or retargeting animations | Blender (headless, as in `npm run assets:hero`), only for this |
