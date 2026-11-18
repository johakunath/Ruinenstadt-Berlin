# Asset pipeline: textures

Decided by Johannes on 2026-11-16. This covers texture images for world surfaces and objects.
Characters and animation (`assets/characters`, `npm run assets`) are out of scope here.

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
| T2 | Street surfaces: cobbles, asphalt | `paintCobbles`, `paintAsphalt` | 5 m | after T1 |
| T3 | Facades and roofs: plaster tones, brick, stucco, roof tiles, concrete, shop front | `paintPlaster`, `paintBrick`, `paintStucco`, `paintRoofTiles`, `paintConcrete` | 3 to 4 m | after T2 |
| T4 | Props: wood, metal paint, car and bus paint, tram | `paintWood`, `paintMetal`, `paintVan` | per prop | after T3 |
| T5 | Landmarks (M11d): slate roof; dark red Rathenow brick with a few green glazed bricks (Rathaus); clean baroque plaster with soft staining, cream (Schloss, S-Bahnhof); reddish-brown granite cladding with joints (Forum); fibreglass dinosaur skin with scales, cracks and faded paint (neutral grey-green, tinted per figure) | `paintSlate`; `brick` on the Rathaus; `stucco` on Schloss and S-Bahnhof; `concrete` on the Forum; `mossy` on the dinos (`src/render/landmarks.ts`) | 3 m (slate, brick, plaster, granite); 2 m (dino skin) | `docs/maps/landmarks.md`; after T3 |

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

### K1 and KP1–KP3 handover

- OpenAI image generation used the 2D weapon icons and Kodex busts as style references. The pipe, Steel Blade and boss uniforms follow the 3D models.
- K1 uses I88–I90. I79–I81 already belong to the helmet, gloves and boots from the existing sets.
- The inventory uses 128 px alpha WebP and the Kodex uses 256 px WebP. Kodex discovery still gates each portrait, and the elite ring keeps its gameplay colour.
