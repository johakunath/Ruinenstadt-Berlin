# Asset licenses

Every file in `assets/` is listed here with source, author and license. Add a row before committing a new asset.
Sounds are generated in code (`src/audio`). Textures start as code-painted placeholders (`src/render/paint.ts`); generated images replace them per `docs/asset-pipeline.md` and get a row here.

| File | Source | Author | License | Changes |
|---|---|---|---|---|
| `textures/koepenick/grass.webp` | OpenAI image generation; seamless unmown olive grass, dry stalks and bare spots; Ruinenstadt 2D ground art as image reference | Codex (for Johannes) | own work | Flat albedo; resized from 1254 to 1024 px, WebP quality 85 |
| `textures/koepenick/dirt.webp` | OpenAI image generation; seamless earth, mud and pebbles; Ruinenstadt 2D ground art as image reference | Codex (for Johannes) | own work | Flat albedo; resized from 1254 to 1024 px, WebP quality 85 |
| `textures/koepenick/paving.webp` | OpenAI image generation; T1 paving and Ruinenstadt 2D pavement as image references | Codex (for Johannes) | own work | Ten by ten weathered Berlin sidewalk plates with dark joints; flat albedo resized from 1254 to 1024 px, WebP quality 85 |
| `textures/koepenick/leaves.webp` | OpenAI image generation; lower-contrast edit of T1 leaf litter | Codex (for Johannes) | own work | Fallen leaves, needles and twigs; flat albedo resized from 1254 to 1024 px, WebP quality 85 |
| `textures/koepenick/litter.webp` | OpenAI image generation; transparent 2 × 2 puddle, leaves, paper/cans and rubble atlas; Köpenick style board as image reference | Codex (for Johannes) | own work | Alpha retained; resized from 1254 to 1024 px, WebP quality 85 |
| `textures/koepenick/asphalt.webp` | OpenAI image generation, worn asphalt with muted aggregate and hairline cracks, using 2D Köpenick asphalt as a style reference | Codex (for Johannes) | own work | Seam-matched 1024 px albedo, WebP quality 85 |
| `textures/common/cobbles.webp` | OpenAI image generation, staggered Berlin granite setts with moss in the joints, using the 2D Köpenick plaza for its palette | Codex (for Johannes) | own work | Seam-matched 1024 px albedo, WebP quality 85 |
| `textures/alex/posters.webp` | Ruinenstadt 2D `assets/buildings/gdr-banner-red.webp`, `gdr-banner-blue.webp`, `gdr-mural-pioneer.webp` (Codex task 11, Alexanderplatz Pioneer direction, v0.69) | Codex (for Johannes) | own work | Packed into one 768 × 384 atlas (red banner, blue banner, Pioneer poster), alpha kept, WebP quality 86 |
| `characters/hero.glb` | [Universal Base Characters [Standard]](https://quaternius.itch.io/universal-base-characters): `Superhero_Female_FullBody`, `Hair_Long` | Quaternius | CC0 1.0 | Base color only at 1024 px, clothing regions painted as vertex colors, code-built coat skirt, belt, pouches and scarf (3 extra scarf bones), hair recolored. Meshes pass through Blender 5.3 unchanged and are rebound to the source skeleton (`npm run assets:hero`) |
| `characters/zombie.glb` | [Universal Base Characters [Standard]](https://quaternius.itch.io/universal-base-characters): `Superhero_Male_FullBody` | Quaternius | CC0 1.0 | Simplified to about 5k triangles, skin recolored at 512 px, rags as vertex colors, eyebrows removed |
| `characters/anims.glb` | [Universal Animation Library [Standard]](https://quaternius.itch.io/universal-animation-library) and [Universal Animation Library 2 [Standard]](https://quaternius.itch.io/universal-animation-library-2) | Quaternius | CC0 1.0 | 38 clips kept (list: `CLIPS` in `tools/build-assets.mjs`), rotation tracks plus pelvis translation, resampled |
| `characters/mech.glb`, `characters/mechbig.glb` | [Animated Mech Pack (March 2021)](https://opengameart.org/node/126992) (also on quaternius.com/packs/animatedmech.html): `Leela.fbx`, `Mike.fbx` and their textures | Quaternius | CC0 1.0 | Converted with `tools/build-creatures.mjs`: baked to meters (2.3 and 3.9 m), the painted texture sampled once per triangle and repainted as vertex colors (brass, cobalt, signal yellow), Leela's lens as its own material, only the played clips kept, scale tracks dropped |
| `characters/raptor.glb`, `characters/rex.glb` | [Animated Dinosaur Pack](https://quaternius.itch.io/animated-lowpoly-dinosaurs): `Velociraptor.fbx`, `Trex.fbx` | Quaternius | CC0 1.0 | Converted with `tools/build-creatures.mjs`: baked to meters, flat colors repainted as vertex colors (rotten hide, rib bars, wounds), clips renamed (Idle, Walk, Run, Attack, Jump, Death), scale tracks dropped |
CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ (each pack ships a `License.txt` with this dedication).

The source packs are not committed. `tools/fetch-assets.sh` downloads them into `assets-src/`, `npm run assets` rebuilds the three files. The dinosaur pack is unpacked by hand to `assets-src/dinos/` (`Trex.fbx`, `Velociraptor.fbx`); `node tools/build-creatures.mjs` rebuilds `raptor.glb` and `rex.glb`. The mech pack goes to `assets-src/mechs/` (`Leela.fbx`, `Mike.fbx`, `Leela_Texture.png`, `Mike_Texture.png`; `tools/fetch-assets.sh` fetches it) for `mech.glb` and `mechbig.glb`.

Not used in gate 1: Mixamo, Kenney, KayKit, Poly Haven.

| `inventory/I01.webp` | Ruinenstadt 2D `assets/icons/I01.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I02.webp` | Ruinenstadt 2D `assets/icons/I02.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I03.webp` | Ruinenstadt 2D `assets/icons/I03.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I04.webp` | Ruinenstadt 2D `assets/icons/I04.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I05.webp` | Ruinenstadt 2D `assets/icons/I05.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I06.webp` | Ruinenstadt 2D `assets/icons/I06.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I07.webp` | Ruinenstadt 2D `assets/icons/I07.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I08.webp` | Ruinenstadt 2D `assets/icons/I08.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I09.webp` | Ruinenstadt 2D `assets/icons/I09.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I10.webp` | Ruinenstadt 2D `assets/icons/I10.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I11.webp` | Ruinenstadt 2D `assets/icons/I11.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I12.webp` | Ruinenstadt 2D `assets/icons/I12.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I13.webp` | Ruinenstadt 2D `assets/icons/I13.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I14.webp` | Ruinenstadt 2D `assets/icons/I14.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I15.webp` | Ruinenstadt 2D `assets/icons/I15.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I16.webp` | Ruinenstadt 2D `assets/icons/I16.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I17.webp` | Ruinenstadt 2D `assets/icons/I17.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I18.webp` | Ruinenstadt 2D `assets/icons/I18.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I19.webp` | Ruinenstadt 2D `assets/icons/I19.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I20.webp` | Ruinenstadt 2D `assets/icons/I20.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I21.webp` | Ruinenstadt 2D `assets/icons/I21.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I22.webp` | Ruinenstadt 2D `assets/icons/I22.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I23.webp` | Ruinenstadt 2D `assets/icons/I23.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I24.webp` | Ruinenstadt 2D `assets/icons/I24.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I25.webp` | Ruinenstadt 2D `assets/icons/I25.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I26.webp` | Ruinenstadt 2D `assets/icons/I26.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I27.webp` | Ruinenstadt 2D `assets/icons/I27.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I28.webp` | Ruinenstadt 2D `assets/icons/I28.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I29.webp` | Ruinenstadt 2D `assets/icons/I29.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I30.webp` | Ruinenstadt 2D `assets/icons/I30.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I31.webp` | Ruinenstadt 2D `assets/icons/I31.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I32.webp` | Ruinenstadt 2D `assets/icons/I32.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I33.webp` | Ruinenstadt 2D `assets/icons/I33.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I34.webp` | Ruinenstadt 2D `assets/icons/I34.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I35.webp` | Ruinenstadt 2D `assets/icons/I35.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I36.webp` | Ruinenstadt 2D `assets/icons/I36.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I37.webp` | Ruinenstadt 2D `assets/icons/I37.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I38.webp` | Ruinenstadt 2D `assets/icons/I38.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I39.webp` | Ruinenstadt 2D `assets/icons/I39.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I40.webp` | Ruinenstadt 2D `assets/icons/I40.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I41.webp` | Ruinenstadt 2D `assets/icons/I41.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I42.webp` | Ruinenstadt 2D `assets/icons/I42.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I43.webp` | Ruinenstadt 2D `assets/icons/I43.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I44.webp` | Ruinenstadt 2D `assets/icons/I44.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I45.webp` | Ruinenstadt 2D `assets/icons/I45.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I46.webp` | Ruinenstadt 2D `assets/icons/I46.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I47.webp` | Ruinenstadt 2D `assets/icons/I47.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I48.webp` | Ruinenstadt 2D `assets/icons/I48.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I49.webp` | Ruinenstadt 2D `assets/icons/I49.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I50.webp` | Ruinenstadt 2D `assets/icons/I50.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I51.webp` | Ruinenstadt 2D `assets/icons/I51.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I52.webp` | Ruinenstadt 2D `assets/icons/I52.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I53.webp` | Ruinenstadt 2D `assets/icons/I53.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I54.webp` | Ruinenstadt 2D `assets/icons/I54.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I55.webp` | Ruinenstadt 2D `assets/icons/I55.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I56.webp` | Ruinenstadt 2D `assets/icons/I56.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I57.webp` | Ruinenstadt 2D `assets/icons/I57.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I58.webp` | Ruinenstadt 2D `assets/icons/I58.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I59.webp` | Ruinenstadt 2D `assets/icons/I59.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I60.webp` | Ruinenstadt 2D `assets/icons/I60.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I61.webp` | Ruinenstadt 2D `assets/icons/I61.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I62.webp` | Ruinenstadt 2D `assets/icons/I62.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I63.webp` | Ruinenstadt 2D `assets/icons/I63.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I64.webp` | Ruinenstadt 2D `assets/icons/I64.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I65.webp` | Ruinenstadt 2D `assets/icons/I65.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I66.webp` | Ruinenstadt 2D `assets/icons/I66.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I67.webp` | Ruinenstadt 2D `assets/icons/I67.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I68.webp` | Ruinenstadt 2D `assets/icons/I68.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I69.webp` | Ruinenstadt 2D `assets/icons/I69.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I70.webp` | Ruinenstadt 2D `assets/icons/I70.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I71.webp` | Ruinenstadt 2D `assets/icons/I71.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I72.webp` | Ruinenstadt 2D `assets/icons/I72.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I73.webp` | Ruinenstadt 2D `assets/icons/I73.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I74.webp` | Ruinenstadt 2D `assets/icons/I74.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I75.webp` | Ruinenstadt 2D `assets/icons/I75.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I76.webp` | Ruinenstadt 2D `assets/icons/I76.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I77.webp` | Ruinenstadt 2D `assets/icons/I77.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I78.webp` | Ruinenstadt 2D `assets/icons/I78.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I79.webp` | Ruinenstadt 2D `assets/icons/I79.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I80.webp` | Ruinenstadt 2D `assets/icons/I80.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I81.webp` | Ruinenstadt 2D `assets/icons/I81.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I82.webp` | Ruinenstadt 2D `assets/icons/I82.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I83.webp` | Ruinenstadt 2D `assets/icons/I83.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I84.webp` | Ruinenstadt 2D `assets/icons/I84.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I85.webp` | Ruinenstadt 2D `assets/icons/I85.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I86.webp` | Ruinenstadt 2D `assets/icons/I86.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I87.webp` | Ruinenstadt 2D `assets/icons/I87.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged placeholder |
| `inventory/I88.webp` | OpenAI image generation, painted inventory icon | Codex for Johannes | Own work | Rostige Klinge, rusted elbow pipe with a wrapped grip |
| `inventory/I89.webp` | OpenAI image generation, painted inventory icon | Codex for Johannes | Own work | Stahlklinge, leaf-spring blade with a wrench guard |
| `inventory/I90.webp` | OpenAI image generation, painted inventory icon | Codex for Johannes | Own work | Hackmesser, weathered butcher’s cleaver |
| `inventory/R05.webp` | Ruinenstadt 2D `assets/icons/R05.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Schrott icon in the menu header (U3) |
| `inventory/R01.webp` | Ruinenstadt 2D `assets/icons/R01.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Stoff icon in the camp and menu headers (playtest 2026-11-18) |
| `inventory/R02.webp` | Ruinenstadt 2D `assets/icons/R02.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Metall icon in the camp and menu headers (playtest 2026-11-18) |
| `inventory/R03.webp` | Ruinenstadt 2D `assets/icons/R03.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Chemie icon in the camp and menu headers (playtest 2026-11-18) |
| `inventory/R04.webp` | Ruinenstadt 2D `assets/icons/R04.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kabel icon in the camp and menu headers (playtest 2026-11-18) |
| `inventory/Z01.webp` | Ruinenstadt 2D `assets/icons/Z01.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Fleisch icon in the camp and menu headers (playtest 2026-11-18) |
| `inventory/Z02.webp` | Ruinenstadt 2D `assets/icons/Z02.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Gemüse icon in the camp and menu headers (playtest 2026-11-18) |
| `inventory/Z03.webp` | Ruinenstadt 2D `assets/icons/Z03.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Gewürze icon in the camp and menu headers (playtest 2026-11-18) |
| `inventory/survivor.webp` | Ruinenstadt 2D `assets/hero/H01a-H01.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged inventory portrait placeholder |
| `portraits/E01.webp` | Ruinenstadt 2D `assets/portraits/E01.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Schlurfer |
| `portraits/E02.webp` | Ruinenstadt 2D `assets/portraits/E02.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Brocken |
| `portraits/E03.webp` | Ruinenstadt 2D `assets/portraits/E03.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Speier |
| `portraits/E04.webp` | Ruinenstadt 2D `assets/portraits/E04.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Ratte (M12b) |
| `portraits/E05.webp` | Ruinenstadt 2D `assets/portraits/E05.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Krähe |
| `portraits/E09.webp` | Ruinenstadt 2D `assets/portraits/E09.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Hetzer (2D Raser) |
| `portraits/E11.webp` | Ruinenstadt 2D `assets/portraits/E11.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Raptor |
| `portraits/E12.webp` | Ruinenstadt 2D `assets/portraits/E12.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Der Rex |
| `portraits/E13.webp` | Ruinenstadt 2D `assets/portraits/E13.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Kabelghul (M12c) |
| `portraits/E14.webp` | Ruinenstadt 2D `assets/portraits/E14.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Boxenkopf (M12c) |
| `portraits/X01.webp` | Ruinenstadt 2D `assets/portraits/X01.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Hauptmann von Köpenick |
| `portraits/X03.webp` | Ruinenstadt 2D `assets/portraits/X03.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Der Turmwächter |
| `portraits/X04.webp` | OpenAI image generation, painted Kodex bust | Codex for Johannes | Own work | Der Feldwebel, chipped Pickelhaube and blue tunic |
| `portraits/X05.webp` | OpenAI image generation, painted Kodex bust | Codex for Johannes | Own work | Der Schaffner, peaked cap and railway signal disk |
| `portraits/L01.webp` | OpenAI image generation, painted Kodex bust | Codex for Johannes | Own work | Flink, forward-leaning cyan runner |
| `portraits/L02.webp` | OpenAI image generation, painted Kodex bust | Codex for Johannes | Own work | Brennend, charred coat and orange flames |
| `portraits/L03.webp` | OpenAI image generation, painted Kodex bust | Codex for Johannes | Own work | Spaltend, lime fissures and split silhouette |
| `portraits/L04.webp` | OpenAI image generation, painted Kodex bust | Codex for Johannes | Own work | Gepanzert, layered steel plate with ivory edges |
| `portraits/X06.webp` | Ruinenstadt 2D `assets/portraits/X06.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Die Rattenmutter (M12b) |
| `portraits/X09.webp` | Ruinenstadt 2D `assets/portraits/X09.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Der Bassprediger (M12c) |
| `portraits/X10.webp` | Ruinenstadt 2D `assets/portraits/X05.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Der Brandmeister (M12b; 3D X05 is the Schaffner) |
| `portraits/S01.webp` | Ruinenstadt 2D `assets/portraits/S01.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Dr. Ahmet |
| `portraits/S02.webp` | Ruinenstadt 2D `assets/portraits/S02.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Mira |
| `portraits/S03.webp` | Ruinenstadt 2D `assets/portraits/S03.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Kurier Jonas |
| `portraits/S04.webp` | Ruinenstadt 2D `assets/portraits/S04.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Oma Gerda |
| `portraits/S05.webp` | Ruinenstadt 2D `assets/portraits/S05.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Späherin Lin |
| `portraits/S06.webp` | Ruinenstadt 2D `assets/portraits/S06.webp` | Johannes / OpenAI image generation | Project-owned generated menu art | Unchanged; Kodex portrait: Kalle |
