# Asset pipeline: textures

Decided by Johannes on 2026-11-16. This covers texture images for world surfaces and objects.
Characters and animation (`assets/characters`, `npm run assets`) are out of scope here.

Indexes with the status of every item and every enemy: `docs/equipment-pipeline.md`, `docs/enemy-pipeline.md`. Update them in the same PR whenever you add or change a model, icon, bust, texture or effect.

## Which tool for which job (2026-11-18, updated 2026-11-22)

**2026-11-22 (Johannes):** local models first. Texture images, painted icons, reference images and static 3D props come from FLUX.2 klein and Pixal3D on the PC, finished in Blender; Codex is the fallback when the local result does not satisfy. Routes and standard workflows per asset group: `docs/local-ai-assets.md`. Where the tables below say "Codex", read "local first, Codex as fallback". Style, technical and integration rules in this file apply to local images unchanged.

| Job | Route | Who |
|---|---|---|
| Weapon, gear and prop geometry, colours, glow and particles | TypeScript in `src/render` (procedural meshes, vertex colours, code-painted canvas textures) | Claude |
| UI glyphs, map icons, mockups | SVG in code | Claude |
| Item icons and Kodex portraits that must match the 3D look | Render the in-game model (planned `tools/item-icons.mjs`, `tools/enemy-sheet.mjs` with portrait framing and key plus rim light) | Claude |
| Converting CC0 model packs (FBX, glTF) | Node: `tools/build-creatures.mjs` (FBXLoader, glTF export) | Claude |
| Painted textures, painted busts and icons where no 3D model exists yet | Image generation, first integration | Codex |
| Skinning, rebinding a mesh to the skeleton, retargeting animations | Blender headless (`npm run assets:hero`); slow, use only for rigging | Claude on the PC |

## Roles and order

Every new map, building type or prop goes through these steps in order. A step does not wait for later steps.

| Step | Who | Does | Done when |
|---|---|---|---|
| 1. Build | Claude | Builds geometry in code (`src/render`). Paints placeholder textures in code (`src/render/paint.ts`), like ground variant C: blended surfaces plus scatter | Playable, readable at game camera. Johannes approved the direction (mockup first for critical looks) |
| 2. Texture | Local first (Claude or Johannes on the PC, `docs/local-ai-assets.md` W1), Codex as fallback | Generates the texture images with image generation, then the initial integration (below) | Images load in game, code placeholder kept as fallback, row in `assets/LICENSES.md` |
| 3. Performance | Claude | Compression (KTX2 or smaller WebP), mipmaps, atlas merges, draw call and memory checks on both profiles | PC and Tab S9 budgets hold (`docs/plan-3d.md`) |
| 4. Playtest | Johannes | Looks at it on the Tab S9 | Notes go to `docs/playtests.md` |

Claude generates images only with the local models (`docs/local-ai-assets.md`); Codex does not change geometry, shaders, draw calls or render profiles.
If a texture would need any of those changes, Codex writes the question into the task file and stops (`docs/workflow.md`).

## Style requirements

| Topic | Rule |
|---|---|
| Fit | Must fit the game's look (`docs/style-bible.md`, board `docs/style/koepenick.png` for Köpenick). Painterly, and it may be somewhat more realistic than the comic boards. It must not look like a photo scan from another game |
| Palette | Style bible palette per district. Köpenick: cream, ochre, olive, teal, rust, oxblood, desaturated |
| Light | No baked light, shadows, highlights or vignettes. The game lights everything (night, lamps, fire). Flat, even albedo |
| Contrast | Medium to low. Surfaces sit under characters and loot, which must stay readable on top |
| Scale | Painted for the stated world size per tile (table below), seen from the game camera (about 45°, 12 to 20 m away). Details smaller than 5 cm at that scale are noise: leave them out |
| Theme | Post-collapse Berlin: wear, cracks, moss, weeds, soot, rubble. Half of the buildings are ruins |
| Check | Look at each texture in game with `node tools/screenshot.mjs` on both profiles before the PR |

## Technical requirements

| Topic | Rule |
|---|---|
| Tiling | Seamless in both directions. Test: a 2 × 2 repeat shows no seams or obvious repeating blobs |
| Size | 1024 × 1024 for ground and facades, 512 × 512 for small props. Power of two |
| Format | WebP, quality about 85, at most 400 KB per file, sRGB color |
| Alpha | Only for decals and cards (atlas cells, ivy, ferns): a clean cut-out edge, no soft halo |
| Extra maps | Albedo only. Height or normal maps only when a task asks for them |
| Files | `assets/textures/<district>/<surface>.webp`, e.g. `assets/textures/koepenick/grass.webp`; shared ones in `assets/textures/common/` |
| License | One row per file in `assets/LICENSES.md`: tool, prompt summary, author Codex (for Johannes), license "own work" |

## Initial integration (Codex)

1. Add a loader for the task's textures (Three.js `TextureLoader`, `colorSpace = SRGBColorSpace`, `RepeatWrapping`, anisotropy from the render profile).
2. The code-painted texture stays the default. Swap in the image when it has loaded; keep the painted one if loading fails.
3. The hook is the material that already uses the surface, e.g. `makeMapMats` in `src/render/map-world.ts`. Ground: `ground.map` and the `uDirt`, `uPave`, `uLeaf` uniforms in `groundMaterial`.
4. Keep UV scale: the image covers the same world size as the painted texture it replaces.
5. Run `npm run check` and the e2e test once, and add before and after screenshots to the PR.

## Recycling 2D art

Read only: `johakunath/Ruinenstadt` `assets/buildings/koep-*.webp` (asphalt, pavement, path, plaza, water, bridge, walls, roofs, shop front, ivy, damage), and the same for other districts. They are 110 to 272 px, too small to use directly in 3D. Use them as style references or image-to-image input so 3D surfaces keep the 2D colors. `assets/manifest.json` there says what each one is for.

## Texture queue

T1 is done (PR #14). The T1b paving and leaf images are built, with performance and rail follow-up in [T1b](tasks/t1b-ground-polish.md).

| # | Textures | Replaces (code placeholder) | World size per tile | Task |
|---|---|---|---|---|
| T1 | Köpenick ground: grass, dirt, sidewalk plates, leaf litter; scatter atlas (puddle, leaf pile, trash, rubble, 2 × 2 cells) | `paintGrass`, `paintDirt`, `paintPaving`, `paintLeafLitter`, `paintLitter` | 5 m (atlas cell: 1 to 3 m decal) | `docs/tasks/t1-ground-textures.md` |
| T2 | Street surfaces: cobbles, asphalt | `paintCobbles`, `paintAsphalt` | 5 m | built in [T2 street textures](tasks/t2-street-textures.md) |
| T3 | Facades and roofs: plaster tones, brick, stucco, roof tiles, concrete, shop front | `paintPlaster`, `paintBrick`, `paintStucco`, `paintRoofTiles`, `paintConcrete`, `paintShopWindow` | 3 to 4 m | Built, [review and performance open](proof/asset-t3-t4/README.md) |
| T4 | Props: wood, metal paint, car and bus paint, tram | `paintWood`, `paintMetal`, `paintCarPaint`, `paintVan` | per prop | Built, [review and performance open](proof/asset-t3-t4/README.md) |
| T5 | Landmarks (M11d): slate roof; dark red Rathenow brick with a few green glazed bricks (Rathaus); clean baroque plaster with soft staining, cream (Schloss, S-Bahnhof); reddish-brown granite cladding with joints (Forum); fibreglass dinosaur skin with scales, cracks and faded paint (neutral grey-green, tinted per figure) | `paintSlate`; `brick` on the Rathaus; `stucco` on Schloss and S-Bahnhof; `concrete` on the Forum; `mossy` on the dinos (`src/render/landmarks.ts`) | 3 m (slate, brick, plaster, granite); 2 m (dino skin) | Built, [P24/T5 review and performance open](tasks/p24-t5-landmark-weathering.md) |
| T7 | Alexanderplatz (M15, 1989, afternoon light A): sign atlas (Weltzeituhr hour band and city panels, Haus des Lehrers frieze "Unser Leben", INTERNATIONAL, CAFÉ MOSKAU, station boards, hammer-and-sickle emblem, banner, curtain-wall, bronze-glass and foyer panes, Pioneer gable mural, six pavilion shop boards); WBS 70 concrete panels; sandstone (Dom, Altes Museum); verdigris copper (domes, spires); red-orange Rathaus brick with terracotta frieze; Stadtbahn brick with ivy | `paintAlexAtlas` in `src/render/alex-paint.ts` (one 2048 × 1536 atlas, regions in `ATLAS`); `stucco`, `brick`, `concrete` tints in `src/render/alex-world.ts` | atlas regions as laid out; 3 to 4 m for stone and brick | Built, [review and performance open](tasks/t7-painted-districts.md) |
| T6 | Xhain (M15, 1981): Wall panel concrete with sparse graffiti (Kreuzberg side), death strip raked sand, red-brown viaduct brick (Stadtbahn, Oberbaumbrücke), yellow brick (Bethanien, St. Thomas), green riveted steel (U1) | code placeholders in `src/render/xhain-world.ts` | 3 to 5 m | `docs/maps/xhain.md` |
| T7 | U-Bahn tunnel walls (playtest 2026-11-18: the code concrete repeats and reads flat): poured tunnel concrete with formwork joints, damp and soot streaks, efflorescence, cable scars; three variants to mix per wall meter; a tile band for station walls | `concrete` on the tunnel walls (`buildTunnel` in `src/render/map-world.ts`) | 4 m along the wall, 4.6 m high (full wall height) | Built, [review and performance open](tasks/t7-painted-districts.md) |
| T8 | Boss bodies (H3, Johannes 2026-11-19: the Rattenmutter must look dirtier and more real): matted rat fur with grime, two shades, tileable for the rat head, ears and cloak; dirty pink ear and nose skin; for the humanoid bosses a decayed skin (undead, as in busts X01, X04, X05, X10) and worn uniform cloth (Prussian blue wool, navy conductor's coat, sooty turnout canvas with yellow bands) | flat kit colours `fur`, `furDark`, `grime`, `pink`, `rags`, `coat*` in `gearKit` and the boss coats (`fitCoat`) in `src/render/enemies.ts`; zombie skin texture for the bosses | 0.5 m (fur, skin), 1 m (cloth) | `docs/tasks/h3-humanoid-bosses.md` |
| T9a | Charlottenburg (M16, 1920) worn stucco in three tones (pale cream, ochre-sand, grey-violet render): fallen-plaster patches down to brick, patched repairs in other tones, damp dark plinth zone, soot under cornices and over windows, rain streaks; three variants to mix per bay. Johannes 2026-11-19: the walls are "too uniform … not all clean and neat and shiny": wear and unevenness are the point, never a clean even render | `stucco` (`paintStucco`) tinted per sight in `src/render/charlottenburg-citywest.ts`, `-kudamm.ts`, `-schloss.ts`, plus the code surface pass `weather` / `wornSpot` in `charlottenburg-world.ts` (keep the pass on top: it adds the per-sight soot and damp) | 3 m (one storey, two bays) | `docs/tasks/m16-charlottenburg.md`; first version built locally (LA1: one sheet `assets/textures/charlottenburg/stucco.webp`, per-bay variants open), [proof](proof/la1/before-after.jpg) |
| T9b | Charlottenburg stone: rusticated sandstone with deep joints every 0.6 m (Löwentor, Hochschule, Theater des Westens, Charlottenburger Tor) and pale limestone ashlar (Opernhaus, Marmorhaus back); chipped arrises, lichen and moss low, soot streaks, a mismatched repaired block here and there. Uneven and weathered, not new stone | `stucco` with the `SAND`, `LIME`, `T.sand` tints (same files) | 2.4 m (four courses) | `docs/tasks/m16-charlottenburg.md` |
| T9c | Gedächtniskirche tuff: light grey-ochre tuff ashlar in uneven courses, a darker basalt plinth, heavy soot in the joints and under the eaves, green damp at the foot. Sooty and patchy, not the clean postcard grey | `stucco` with `T.tuff`, `T.tuffDark` in `gedaechtniskirche` | 3 m | `docs/tasks/m16-charlottenburg.md` |
| T9d | Schloss yellow plaster (photochrom about 1900) with its white trims: faded, blotchy, render fallen off in patches, grey window surrounds with soot; one sheet for the walls, one small sheet for the surrounds and pilasters. Faded and unevenly patched, never fresh paint | `stucco` with `YEL`, `TRIM`, `PEARL` tints in `charlottenburg-schloss.ts` (`face()` surround cards) | 3 m (walls), 1.5 m (surrounds) | `docs/tasks/m16-charlottenburg.md` |
| T9e | Charlottenburg roofs: red clay tiles (Schloss, wings, Rathaus) and blue-grey slate (church, theatres, cinemas) with slipped and missing tiles, moss lines, soot and bird dirt; both uneven, patched with odd tiles | `roof` (common roof tiles) with `RED`/`TILE` tints, `slate` (`paintSlate`) with `C.slate`/`T.slate` | 3 m | `docs/tasks/m16-charlottenburg.md`; built 2026-11-22 locally (`assets/textures/charlottenburg/roof-tiles.webp`, `slate.webp`, [before and after](proof/la-t9e/before-after.jpg)) |
| T9f | City West and Ku'damm sign atlases repainted in the same layouts: period lettering, bulb signs with dead bulbs, film billboards, shop fascias, the Aquarium reliefs, Ufa emblems, the REVUE and Varieté signs, foyers, velvet, marble, fan and vault glass; aged, faded, chipped enamel, grime in the corners (the REVUE sign, the fan crown and the Ufa rhombus stay readable) | `paintSigns` (City West, 1024 × 1536, rows in `ROW`) and `paintAtlas` (Ku'damm, 1024 × 1280, regions in `R`) | the atlas regions as laid out | `docs/tasks/m16-charlottenburg.md` |
| T9g | Poster sheet (Johannes likes the posters): eight 1920 posters in a 1024 × 256 strip, 128 × 256 px each, in this order: revue (GROSSE REVUE), film (MADAME DUBARRY, Ufa-Palast), cabaret (Schall und Rauch), Varieté (Wintergarten), Zoo concert, KaDeWe Weiße Woche, boxing night (Sportpalast), six-day race; peeling, sun-faded, torn to the plaster at one edge with an older bill under it, glue stains. German, short. Torn and layered, never clean prints | `paintPosters` in `charlottenburg-world.ts` (painted into both atlases at the foot; scraps use parts of the cells) | 0.6 × 1.2 m per poster | `docs/tasks/m16-charlottenburg.md` |
| T9h | Cut glass and mirror panels: lilac-silver faceted glass with bright edges (the Diva's gown, fans and halo, Scherbentänzerin, Logenbrecher), mirror glass with silvering lost in patches and cracks (Orangerie gallery, Schloss mirror arches), dirty conservatory glass (Varieté); chipped and clouded, not new | kit `glass`, `frost`, `smoke`, `mirror` in `src/render/enemies.ts`; `R.fan`, `R.pane`, `R.vault` in the Ku'damm atlas; `railSteel` mirrors | 0.5 m (bodies), 1 m (panes) | `docs/tasks/m16-charlottenburg.md` |
| T9i | Wrought iron: black paint flaking to rust, rust runs, gilded tips worn to brass (fences, gates, the station hall ribs, railings, canopies) | `iron` (`paintMetal`) with `C.iron`, `T.iron`, `IRON` tints; `rust` | 1 m | `docs/tasks/m16-charlottenburg.md`; built 2026-11-22 locally (`assets/textures/charlottenburg/iron.webp`; hardly visible on thin bars) |
| T9j | Clipped hedge (box and yew) for the maze and the garden: dense small leaves, gaps, dead brown patches, a few overgrown shoots; ragged, not topiary-show clean | `mossy` and `ivy` on `buildHedge` in `charlottenburg-world.ts` | 2 m along the hedge, 2.2 m high | `docs/tasks/m16-charlottenburg.md` |
| T10 | Wedding roster (M18 step 2, board `docs/style/wedding.png`): one 1024 × 1024 atlas, four quarters. (1) Filo pastry: flaky golden layers with darker baked edges, honey glaze runs and chopped pistachio (Baklava-Brocken, the Hauptgericht). (2) Carpet weave: ruby field, gold border, emerald medallion, worn pile and frayed edges, tileable along the length (Teppichschlinger, the Sultan's carpet, the Kaftan des Ewigen Gasts as brocade). (3) Brass with tarnish and engraving (samovar, trays, the Sultan's urn cage and crown). (4) Tea glass: red-amber tea with a light caustic (Tee-Ifrit glasses, the Sultan's urn belly; keeps its emissive glow). Worn and used, never shop-new. No religious motifs in the carpet pattern (geometric and floral only) | flat kit colours `filo`, `honey`, `pistachio`, `brass`, `tea`, `urn`, `velvet`, `emerald` in `gearKit` (`src/render/enemies.ts`); vertex colours of `buildRug`; palette `mantel:gast` (`src/data/hero-look.ts`) | 0.5 m (pastry, brass), 1.5 m along the carpet | `docs/tasks/m12e-wedding-enemies.md` |
| P24 | Shared landmark weathering: soot, cracks, moss and graffiti on an alpha atlas | Procedurally painted decal atlas | Sized to each facade | Built, [P24/T5 review and performance open](tasks/p24-t5-landmark-weathering.md) |
| M15 Mitte step 9 | Wet asphalt, curtain wall glazing, sandstone and neon signs | Shared street, existing glass and sandstone materials, and authored Mitte sign atlas | Existing UV scale | Built, [Mitte proof and handover](proof/asset-mitte/README.md) |
| M11c | Lot and plant textures, including paving marks, rubble, structures and vegetation | Code-painted lot and plant materials | Per surface | Built, [review and performance open](tasks/m11c-textures.md) |
| T9 | Hero clothing materials (WP4 step 2, after Johannes picks the mockups in `docs/mockups/wp4-clothes/`): neutral, tileable albedos that multiply the palette colours, like the H1 piece maps: tweed (Schiebermütze), denim with worn knees (Lederjacke jeans), coarse knit (Wollmütze), straw weave (Strohhut), chainmail rings (Kettenhemd der Zitadelle), patchwork squares (Mantel des letzten Späti). Decals with alpha: back print "KIEZWACHE" (vest back), Zitadelle crest (tabard). Fur: reuse the T8 matted fur for the Mantel der Rattenmutter | flat vertex colours of the palettes and gear parts (`src/render/gear.ts`, built in WP4 step 2) | 0.3 to 0.5 m (cloth), decals 0.25 m | `docs/tasks/wp4-equipment-visuals.md` › Step 2 looks |
| T11 | Fernsehturm (M17 step 5, board `docs/style/fernsehturm.webp`): (1) the city image seen from 200 m up at dawn, one 1024 × 1024 square, north up, the tower in the middle (hidden under the deck), each district at its bearing as in `src/render/turm-city.ts` `PATCHES` (Alexanderplatz golden afternoon east, Xhain fire-orange with the Wall south-east, Köpenick green fog far south-east, Mitte magenta and cyan under rain west, Charlottenburg silver with searchlights far west, Wedding gold and emerald lanterns north-west, the Spree), the rim fading to haze; (2) interior atlas 1024 × 1024 in four quarters: orange enamel panels with rivets and rust chips, steel ribs and slanted window frame, a cream clock dial with hour marks, Telecafé cloth (tablecloth white, booth cobalt and mustard); (3) the five deck floors as 768² radial paintings (terrazzo star, grating, slate with curved seams twice, dial floor) | `paintCity`, `paintEnamel`, `paintDial`, `paintDeckFloor`, `paintBand` (`src/render/turm-paint.ts`) | city: 520 m; panels 2 m; floors one deck each | `docs/tasks/m17-fernsehturm.md` step 5 |
| T12 | Fernsehturm ending cards (M17 step 4, optional): two 640 × 320 paintings in the style of the boards. „Normalzeit“: Berlin at sunrise in one time, the tower in the middle, the clock ticking again. „Stillstand“: night, the districts side by side each in its own era colour (green, orange, gold, magenta, emerald), stars, the tower lit | `art()` SVG in `src/ui/turm-ending.ts` | the card box | `docs/tasks/m17-fernsehturm.md` step 5 |

Claude adds a row and a task file whenever step 1 finishes for a new surface.

The [M11c lot and plant texture task](tasks/m11c-textures.md) lists the integrated surface and atlas jobs. Hero clothing textures follow [H1 step 6](tasks/h1-hero.md).

## Portrait and icon queue (menu art, Codex)

Painted busts for the Kodex (`src/ui/menu.ts`, `ENEMY_PORTRAIT`) and item icons. Same rules as 2D `assets/portraits/`: 2D style bust, square, dark teal backdrop, WebP about 256 × 256, row in `assets/LICENSES.md`. Codex generates and hooks up (map entry in `src/ui/menu.ts` or `src/ui/item-icons.ts`); Claude checks the look in the Kodex at 1280 × 720 and 844 × 390.

| # | Asset | File | Hookup | Status |
|---|---|---|---|---|
| K1 | Rostige Klinge (`rohr`), Stahlklinge (`stahl`), Hackmesser (`brech`) | `assets/inventory/I88.webp` to `I90.webp` | `src/ui/item-icons.ts` | Built |
| KP1 | Der Feldwebel | `assets/portraits/X04.webp` | `ENEMY_PORTRAIT.feldwebel` | Built |
| KP2 | Der Schaffner | `assets/portraits/X05.webp` | `ENEMY_PORTRAIT.schaffner` | Built |
| KP3 | Flink, Brennend, Spaltend, Gepanzert in their `ELITES` colours | `assets/portraits/L01.webp` to `L04.webp` | `ELITE_PORTRAIT` | Built |
| P16 | Remaining Kodex enemies and bosses | `E15`–`E18`, `X11`–`X19` | `ENEMY_PORTRAIT` | Built, review open |
| P16 | Four illustrated first-run cards | `assets/ui/intro-*.webp` | `src/ui/intro.ts` | Built, review open |
| P15 | Camp station keepers | `S01`–`S07` | Shared survivor portrait map in Kodex and station windows | Built, review open |

The new portraits follow the existing 2D Kodex busts. The intro illustrations use the approved Köpenick style board. Six camp keepers reuse their Kodex art; Ilse has a new portrait. Station windows show portraits when the station is built and its keeper is present. [In-game screenshots](proof/asset-menu/README.md).

| K2 | Starter Rostige Klinge (`rohr`): icon still shows a pipe, the hero holds a blade | `assets/inventory/I88.webp` | `src/ui/item-icons.ts` | Done: rendered from the 3D model (WP4 D10) |
| K3 | Zorn der Ringbahn, Kettenhemd der Zitadelle | `I32`, `I57` | `src/ui/item-icons.ts` | Done: rendered from the 3D models (WP4 D10 and step 2); the Bassprediger arm moved to K4 |
| K4 | Painted icons for the items without a 3D model (WP4 step 2: talisman, ring and implant stay painted): I95 Abzeichen der Kiezwache (I44 in Kiezwache blue and orange), I96 Kiesel des Spreegeists (I39 in Spreegeist green with a teal glint), I97 Arm des Basspredigers (own icon; shares I58 with the Kabelarm today), I102 Schlüsselbund des Tunnelläufers (old tunnel keys on a brass ring with a yellow U tag, U-Bahn board; mockup `docs/mockups/wp4-clothes/tunnel.webp`) | `assets/inventory/I95.webp`, `I96`, `I97`, `I102` | Add `'abzeichen:kiez': 'I95'`, `'kiesel:spree': 'I96'`, `'bassarm': 'I97'`, `'kette:tunnel': 'I102'` to `src/ui/item-icons.ts` with the files | Done 2026-11-22: local FLUX.2 klein img2img from the base icon, picked from 8 each (`assets-src/ai/icons/`) |
| K5 | Painted icons for the two Wedding set pieces without a 3D model: I107 Feder des Ewigen Gasts (a white and emerald plume in a gold clasp with a ruby; board set panel), I108 Siegelring des Ewigen Gasts (a gold signet ring with an emerald). Both 128 px alpha WebP as K4 | `assets/inventory/I107.webp`, `I108.webp` | Add `'feder:gast': 'I107'`, `'siegel:gast': 'I108'` to `src/ui/item-icons.ts` with the files | Done 2026-11-22 as K4 |
| KP4 | Kodex busts for the 11 kinds with only a glyph (Grenzer, Spreehexe, Alexanderplatz roster, Türsteher, Dirigent, Drohne, Wachdrohne) | `assets/portraits/` | `ENEMY_PORTRAIT` | Open; prefer renders of the 3D bodies once they are final (enemy pipeline › Kodex from 3D renders) |

### K1 and KP1–KP3 handover

- OpenAI image generation used the 2D weapon icons and Kodex busts as style references. The pipe, Steel Blade and boss uniforms follow the 3D models.
- K1 uses I88–I90. I79–I81 already belong to the helmet, gloves and boots from the existing sets.
- The inventory uses 128 px alpha WebP and the Kodex uses 256 px WebP. Kodex discovery still gates each portrait, and the elite ring keeps its gameplay colour.
- At 1280 × 720 and 844 × 390, Playwright decoded all nine assets and verified the silhouettes before discovery. Desktop captures: [inventory](proof/shared-menu-art/inventory.jpg), [bosses](proof/shared-menu-art/bosses.jpg), [elites](proof/shared-menu-art/elites.jpg).
