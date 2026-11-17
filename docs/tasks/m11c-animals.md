# M11c Ambient animals: ducks, pigeons, rats [Claude · Opus medium]

Status: open (prepared 2026-11-17, research done). Johannes: "Enten auf dem Teich, Tauben, ein paar Ratten, das macht es lebendiger".

## Goal

Cosmetic animals around the hero: ducks on ponds and lakes, pigeons on paved ground (walk, peck, fly off when the hero or an enemy comes close), rats near bins, rubble and walls (scurry away; the only animals in the U-Bahn tunnel). Render side only: never writes to the sim, no collision, no gameplay effect.

## Models (research 2026-11-17)

| Animal | Source | License | Tris | Clips |
|---|---|---|---|---|
| Duck | https://gobkit.com/freebies/animal/Duck.glb | CC0 1.0 (GLB `asset.copyright`, https://gobkit.itch.io/gobkit-free-animal-pack) | 508 | idle, attack, dead, walk |
| Pigeon | https://gobkit.com/freebies/animal013/Pigeon.glb | CC0 1.0 | 554 | idle, attack, dead, walk (no fly) |
| Rat | https://gobkit.com/freebies/animalB/Rat.glb | CC0 1.0 | 308 | idle, attack, dead, walk |

Downloads work from the cloud container. Each is one skinned mesh, 16 joints, UV atlas texture (not vertex colors). Scale differs wildly (duck ~360 units, pigeon ~0.04, rat ~4): normalize to real size, up to 1.3× so they read from the camera. No fly or swim clips: duck = idle plus procedural bob and slow paths; pigeon flight procedural (wing bones if separate, else code-built wings or a code-built pigeon). Rejected: Quaternius animal packs (mammals only), poly.pizza and kenney.nl (403 from the container), OpenGameArt pigeon (.blend only). Look at the GLBs rendered first and recolor to the Köpenick palette (bake to vertex colors like `tools/build-creatures.mjs`) or build an animal in code if a GLB looks wrong.

## Steps

1. Build tool under `tools/` that downloads, normalizes, recolors and writes `assets/critters/*.glb`; rows in `assets/LICENSES.md`.
2. `src/render/critters.ts`: spawn in a ring around the camera view, despawn far away (constant cost): 4-8 pigeons in flocks on streets/plazas/sidewalks (not forest), 2-5 ducks on water near the hero (`isWater`, `m.lakes` incl. M11c ponds; water surface y = -0.45), 1-3 rats near walls, bins and rubble. Heights from `groundY`. Small props: no hero contour (`src/render/hero-outline.ts`).
3. Hook into the renderer with a minimal change; Leistung may reduce counts.

## Checks

`npm run check`; state draw calls, skinned meshes and per-frame CPU; screenshots at the Altstadt plaza (x=10 z=0), a Spree bank and a pond, Bahnhofsviertel streets (x=0 z=-100) on both profiles.
