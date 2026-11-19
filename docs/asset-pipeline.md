# Asset pipeline: textures

Decided by Johannes on 2026-11-16. This covers texture images for world surfaces and objects.
Characters and animation (`assets/characters`, `npm run assets`) are out of scope here.

Indexes with the status of every item and every enemy: `docs/equipment-pipeline.md`, `docs/enemy-pipeline.md`. Update them in the same PR whenever you add or change a model, icon, bust, texture or effect.

## Which tool for which job (2026-11-18)

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
| 2. Texture | **Codex only** | Generates the texture images with image generation, then the initial integration (below) | Images load in game, code placeholder kept as fallback, row in `assets/LICENSES.md` |
| 3. Performance | Claude | Compression (KTX2 or smaller WebP), mipmaps, atlas merges, draw call and memory checks on both profiles | PC and Tab S9 budgets hold (`docs/plan-3d.md`) |
| 4. Playtest | Johannes | Looks at it on the Tab S9 | Notes go to `docs/playtests.md` |

Claude does not generate images; Codex does not change geometry, shaders, draw calls or render profiles.
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
| T5 | Landmarks (M11d): slate roof; dark red Rathenow brick with a few green glazed bricks (Rathaus); clean baroque plaster with soft staining, cream (Schloss, S-Bahnhof); reddish-brown granite cladding with joints (Forum); fibreglass dinosaur skin with scales, cracks and faded paint (neutral grey-green, tinted per figure) | `paintSlate`; `brick` on the Rathaus; `stucco` on Schloss and S-Bahnhof; `concrete` on the Forum; `mossy` on the dinos (`src/render/landmarks.ts`) | 3 m (slate, brick, plaster, granite); 2 m (dino skin) | `docs/maps/landmarks.md`; after T3 |
| T7 | Alexanderplatz (M15, 1989, afternoon light A): sign atlas (Weltzeituhr hour band and city panels, Haus des Lehrers frieze "Unser Leben", INTERNATIONAL, CAFÉ MOSKAU, station boards, hammer-and-sickle emblem, banner, curtain-wall, bronze-glass and foyer panes, Pioneer gable mural, six pavilion shop boards); WBS 70 concrete panels; sandstone (Dom, Altes Museum); verdigris copper (domes, spires); red-orange Rathaus brick with terracotta frieze; Stadtbahn brick with ivy | `paintAlexAtlas` in `src/render/alex-paint.ts` (one 2048 × 1536 atlas, regions in `ATLAS`); `stucco`, `brick`, `concrete` tints in `src/render/alex-world.ts` | atlas regions as laid out; 3 to 4 m for stone and brick | Built, [review and performance open](tasks/t7-painted-districts.md) |
| T6 | Xhain (M15, 1981): Wall panel concrete with sparse graffiti (Kreuzberg side), death strip raked sand, red-brown viaduct brick (Stadtbahn, Oberbaumbrücke), yellow brick (Bethanien, St. Thomas), green riveted steel (U1) | code placeholders in `src/render/xhain-world.ts` | 3 to 5 m | `docs/maps/xhain.md` |
| T7 | U-Bahn tunnel walls (playtest 2026-11-18: the code concrete repeats and reads flat): poured tunnel concrete with formwork joints, damp and soot streaks, efflorescence, cable scars; three variants to mix per wall meter; a tile band for station walls | `concrete` on the tunnel walls (`buildTunnel` in `src/render/map-world.ts`) | 4 m along the wall, 4.6 m high (full wall height) | Built, [review and performance open](tasks/t7-painted-districts.md) |

Claude adds a row and a task file whenever step 1 finishes for a new surface.

The [M11c lot and plant texture task](tasks/m11c-textures.md) has its own priority list, starting with the T2 asphalt. Hero clothing textures follow [H1 step 6](tasks/h1-hero.md).

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

| K2 | Starter Rostige Klinge (`rohr`): icon still shows a pipe, the hero holds a blade | `assets/inventory/I88.webp` | `src/ui/item-icons.ts` | Open. Skip if rendered icons come first (equipment pipeline › Icons from 3D renders) |
| K3 | Zorn der Ringbahn (base `ring`, a sling) shows a spike on a chain; Arm des Basspredigers shares I58 with the Kabelarm; Kettenhemd der Zitadelle shows the bike chain I42 (base clash, code fix first) | `I32`, `I58`, `I57` | `src/ui/item-icons.ts`, `SETS` in `src/data/items.ts` | Open |
| KP4 | Kodex busts for the 11 kinds with only a glyph (Grenzer, Spreehexe, Alexanderplatz roster, Türsteher, Dirigent, Drohne, Wachdrohne) | `assets/portraits/` | `ENEMY_PORTRAIT` | Open; prefer renders of the 3D bodies once they are final (enemy pipeline › Kodex from 3D renders) |

### K1 and KP1–KP3 handover

- OpenAI image generation used the 2D weapon icons and Kodex busts as style references. The pipe, Steel Blade and boss uniforms follow the 3D models.
- K1 uses I88–I90. I79–I81 already belong to the helmet, gloves and boots from the existing sets.
- The inventory uses 128 px alpha WebP and the Kodex uses 256 px WebP. Kodex discovery still gates each portrait, and the elite ring keeps its gameplay colour.
- At 1280 × 720 and 844 × 390, Playwright decoded all nine assets and verified the silhouettes before discovery. Desktop captures: [inventory](proof/shared-menu-art/inventory.jpg), [bosses](proof/shared-menu-art/bosses.jpg), [elites](proof/shared-menu-art/elites.jpg).
