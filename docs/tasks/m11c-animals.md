# M11c Ambient animals: ducks, pigeons, rats [Claude · Opus medium]

Status: built 2026-11-26 (P18; Handover at the end). Prepared 2026-11-17. Johannes: "Enten auf dem Teich, Tauben, ein paar Ratten, das macht es lebendiger".

## Goal

Cosmetic animals around the hero: ducks on ponds and lakes, pigeons on paved ground (walk, peck, fly off when the hero or an enemy comes close), rats near bins, rubble and walls (scurry away; the only animals in the U-Bahn tunnel). Render side only: never writes to the sim, no collision, no gameplay effect.

## Models (research 2026-11-17)

Route changed by the lead on 2026-11-26 (Johannes: use the local Pixal3D, no Codex): the Gobkit GLBs were not used. Each animal is a Pixal3D model from one FLUX.2 klein picture, baked low and rigid; all motion is procedural (Handover).

| Animal | Source | License | Tris | Clips |
|---|---|---|---|---|
| Duck | https://gobkit.com/freebies/animal/Duck.glb | CC0 1.0 (GLB `asset.copyright`, https://gobkit.itch.io/gobkit-free-animal-pack) | 508 | idle, attack, dead, walk |
| Pigeon | https://gobkit.com/freebies/animal013/Pigeon.glb | CC0 1.0 | 554 | idle, attack, dead, walk (no fly) |
| Rat | https://gobkit.com/freebies/animalB/Rat.glb | CC0 1.0 | 308 | idle, attack, dead, walk |

Downloads work from the cloud container. Each is one skinned mesh, 16 joints, UV atlas texture (not vertex colors). Scale differs wildly (duck ~360 units, pigeon ~0.04, rat ~4): normalize to real size, up to 1.3× so they read from the camera. No fly or swim clips: duck = idle plus procedural bob and slow paths; pigeon flight procedural (wing bones if separate, else code-built wings or a code-built pigeon). Rejected: Quaternius animal packs (mammals only), poly.pizza and kenney.nl (403 from the container), OpenGameArt pigeon (.blend only). Look at the GLBs rendered first and recolor to the Köpenick palette (bake to vertex colors like `tools/build-creatures.mjs`) or build an animal in code if a GLB looks wrong.

## Steps

1. Build tool under `tools/` that downloads, normalizes, recolors and writes `assets/critters/*.glb`; rows in `assets/LICENSES.md`.
2. `src/render/critters.ts`: spawn in a ring around the camera view, despawn far away (constant cost): 4-8 pigeons in flocks on streets/plazas/sidewalks (not forest), 2-5 ducks on water near the hero (`isWater`, `m.lakes` incl. M11c ponds; water surface `WATER_Y` = -1.7 since the quays), 1-3 rats near walls, bins and rubble. Heights from `groundY`. Small props: no hero contour (`src/render/hero-outline.ts`).
3. Hook into the renderer with a minimal change; Leistung may reduce counts.

## Checks

`npm run check`; state draw calls, skinned meshes and per-frame CPU; screenshots at the Altstadt plaza (x=10 z=0), a Spree bank and a pond, Bahnhofsviertel streets (x=0 z=-100) on both profiles.

## Handover (2026-11-26, Claude · Opus)

- Built: `src/render/critters.ts` (fixed pools filled in a ring around the view, dropped beyond 40 m; procedural motion: ducks bob, paddle, dip and paddle away; pigeons walk with a nod, peck and fly off as a flock from the hero or an enemy, landing again 13 to 22 m away or leaving; rats sniff, dash along walls and run), `src/render/critter-sites.ts` (where each kind may be; rats only underground, nothing in the Fernsehturm), an 8-line hook in `renderer.ts`, tests `critters.test.ts` and `critters-maps.test.ts` (every district and two tunnel lines; the sim stays untouched).
- Models: Pixal3D from one FLUX.2 klein picture each, `prepare_toy_model.py --turn ±90`, `bake_low.py --tris 500 --tex 256 --remesh 0.005/0.008`; duck 495, pigeon 491, rat 494 triangles; `tools/build-critters.mjs` packs them into `assets/critters/animals.glb` (one 512 px JPEG atlas, 137 KB file) with a code-painted wing cell. The first rat (sitting) came out as a fur ball; the second picture (walking low) worked, so no code fallback.
- Cost: one InstancedMesh per kind on one material: at most 3 draw calls, a 4th while pigeons fly; the same again in the normal/depth pre-pass (Qualität, Ausgewogen) and in the shadow pass (Qualität only). Skinned meshes 0, lights 0. At most 8 ducks, 14 pigeons, 4 rats (7 in a tunnel), about 13,000 triangles; Leistung halves the pools.
- CPU (Node, Köpenick, hero walking, 1,200 frames): 0.04 to 0.08 ms per frame on average, p95 under 0.21 ms, worst frame under 3 ms; a fill (start, restart, jump) is spread over 3 frames of at most 5 ms.
- Reused: the P3/P17 prop recipe, the `glb-props.ts` loading pattern (stub geometry so the shader compiles at load), `isWater`, `streetDist`, `areaAt`, `onBridge`, `WATER_Y`, `Level.blocked`, `colliderDistance`, `Rng`. The 2D game was not cloned (3D-only cosmetic work).
- Deviations: water sits at `WATER_Y` = -1.7 (quays, 2026-11-17), not -0.45; ducks keep 3.5 m off the bank (boat wrecks), off pond jetties and the ferry lane; pigeons keep out from under tree crowns (the camera cannot see them there; `renderer.ts` passes the tree lots); enemies scare ducks and rats too; the duck dips its head instead of tipping up; rats stay smaller than the enemy rats, so at platform distance they read as small dark shapes (playtest question).
- Proof: `docs/proof/p18-animals/`: `models.jpg` (Blender renders of the bakes, colours before the packer's desaturation), `altstadt-*`, `spree-*`, `bahnhof-*` (Bahnhofstraße at x=4 z=-94: at x=0 z=-100 the hero stands under a tree crown, at x=6 the Vorplatz wave starts and its enemies scare the birds off), `tunnel-*` (line 1, Warschauer Straße), each `-qualitaet` and `-leistung`, and `pigeons-fly-qualitaet.jpg`. Game shots in swiftshader at 1 to 5 fps (`tools/critter-shot.mjs`; `SCARE=ms` moves the hero next to a flock). Unverified: fps and the look on real GPUs, the camp map, motion at full frame rate.

## Doc updates for the lead

- `docs/backlog.md` P18 row: done 2026-11-26, `docs/tasks/m11c-animals.md`.
- `docs/migration.md` row "Backlog ready to build": P18 ambient animals done.
- `docs/status.md` › World, after "cover.": ` Ambient animals (P18): ducks on open water, pigeon flocks on paved ground that fly off and land again, rats along walls, bins and rubble and in the U-Bahn tunnels; cosmetic, render side only.`
- `docs/local-ai-assets.md` › Lessons: `| 2026-11-26 | Small animals (P18): Pixal3D single image works from one FLUX picture on black. bake_low.py without --remesh stalls near 2,600 triangles on them; --remesh 0.005 (pigeon, rat: keeps thin legs and the tail) or 0.008 (duck) reaches 500. A sitting rat came out as a round fur ball: ask for "walking low on all four paws, body stretched out, tail straight out behind". The tint gain turns grey birds blue: desaturate in the packer (look in tools/build-critters.mjs). Small models share one atlas: bake each at 256 px and pack them | P18 |`
- `docs/tasks/pt-hardware-checks.md` › Playtest: `| P18 ambient animals (2026-11-26) | Ducks on the Spree, lakes and ponds; pigeon flocks on streets and squares (walk into one: it flies off and lands again, or leaves); rats by walls, bins and rubble and in the U-Bahn tunnels (they run from you). Do they read at the game camera, too many or too few, does anything pop in at the screen edge? | docs/tasks/m11c-animals.md |`
- `docs/tasks/pt-hardware-checks.md` › Hardware checks: `| 62 | P18 animals on real GPUs | Köpenick ?tp=10,0 and ?tp=40,-28 with ?debug=perf on Qualität and Leistung: draw calls up by at most 4 (Leistung), 8 (Ausgewogen) or 12 (Qualität); no hitch at the start or when a flock takes off | PC, Tab S9 | docs/tasks/m11c-animals.md | |`
- `docs/equipment-pipeline.md`, `docs/enemy-pipeline.md`: nothing (no item or enemy).
