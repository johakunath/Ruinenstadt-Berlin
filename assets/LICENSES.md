# Asset licenses

Every file in `assets/` is listed here with source, author and license. Add a row before committing a new asset.
Sounds are generated in code (`src/audio`). Textures start as code-painted placeholders (`src/render/paint.ts`); generated images replace them per `docs/asset-pipeline.md` and get a row here.

| File | Source | Author | License | Changes |
|---|---|---|---|---|
| `characters/hero.glb` | [Universal Base Characters [Standard]](https://quaternius.itch.io/universal-base-characters): `Superhero_Female_FullBody`, `Hair_Long` | Quaternius | CC0 1.0 | Base color only at 1024 px, clothing regions painted as vertex colors, code-built coat skirt, belt, pouches and scarf (3 extra scarf bones), hair recolored |
| `characters/zombie.glb` | [Universal Base Characters [Standard]](https://quaternius.itch.io/universal-base-characters): `Superhero_Male_FullBody` | Quaternius | CC0 1.0 | Simplified to about 5k triangles, skin recolored at 512 px, rags as vertex colors, eyebrows removed |
| `characters/anims.glb` | [Universal Animation Library [Standard]](https://quaternius.itch.io/universal-animation-library) and [Universal Animation Library 2 [Standard]](https://quaternius.itch.io/universal-animation-library-2) | Quaternius | CC0 1.0 | 17 clips kept, rotation tracks plus pelvis translation, resampled |

CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ (each pack ships a `License.txt` with this dedication).

The source packs are not committed. `tools/fetch-assets.sh` downloads them into `assets-src/`, `npm run assets` rebuilds the three files.

Not used in gate 1: Mixamo, Kenney, KayKit, Poly Haven.
