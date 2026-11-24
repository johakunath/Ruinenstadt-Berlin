# M11c Spreepark dinos: detailed statues, small dinos, nests [Claude · Opus medium]

Status: step 1 built 2026-11-24 with local Pixal3D statues (`docs/local-ai-assets.md` › P17); steps 2 to 4 open (prepared 2026-11-17, Johannes: "Dinos ein kleines bisschen detaillierter, kleinere Dinos, Nest mit Eiern, organischer"). Read `.claude/skills/combat-animation/SKILL.md` before touching an enemy.

## Goal

The Spreepark feels like an overgrown dinosaur park, not a few primitives.

## Steps

1. **Statues** (landmark `dino`, `case 'dino'` in `buildLandmark`, `src/render/map-world.ts`): today a sphere, cylinder, box and cone. Build detailed organic sculptures, species picked per landmark (Brachiosaurus, Triceratops, Stegosaurus, T-Rex): weathered painted concrete or fiberglass, moss, cracks, a broken piece lying beside it, some toppled, one standing. Keep `landmarkCollider` consistent.
2. **Enemy dinos** (`raptor`, `rex`: Quaternius CC0 GLBs repainted by `tools/build-creatures.mjs`, source pack not in the repo, see `assets/LICENSES.md`): a little more detail without new downloads: code-built extras on the skeleton (bone spikes, quills along the back, scars, claws), better vertex painting if the pack can be fetched again. Check with `?spawn=raptor,rex&cam=10,0.6`.
3. **Small dinos**: a small fast weak pack dinosaur (`kompso`, Compsognathus) on the raptor body at about half scale with its own tint, reusing an AI; small packs in Spreepark waves (`waveTier` in `src/data/koepenick.ts`). Hit timing per the combat-animation skill. Rerun `node tools/balance.mjs` and compare with `docs/balance.md`.
4. **Nests**: prop kind `nest` (add to `PropKind`, footprint circle r ≈ 1 in `propCollider`, render in a new `src/render/props-dino.ts`, dispatched from the `default:` branch of `buildProp`): branches and straw, 3-6 big eggs, some cracked, one hatched shell. 3-4 nests in the Spreepark near the statues via `fixedProps` (not on streets or in fight centers). One breakable like a crate if `breakableDefs` (`src/data/map.ts`) allows it easily.

## Checks

`npm run check`; screenshots in the game camera and close (`&cam=10,0.6`) around x=-120 z=-40 on both profiles; triangle counts per statue and nest; balance numbers in the handover.
