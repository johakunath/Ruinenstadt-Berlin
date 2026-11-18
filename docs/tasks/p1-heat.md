# P1 Tablet heat [Claude · Opus high; Johannes measures on the Tab S9]

Status: step 1 built 2026-11-17, step 2 (analysis, chunk size, shadow rate) built 2026-11-18, measurement open. Playtest Johannes, 2026-11-17: Leistung runs at 50–60 fps on the Tab S9 and looks good, but the tablet gets hot, not only in fights.

## Step 1 (built)
- **Akkusparen** switch (2D `S.eco`): 30 fps cap and at most 1× pixel ratio. On the start screen and in Optionen; stored. Default off.
- Behind still overlays (trade, blessing choice, intro cards) the world draws at about 10 fps; the open menu draws nothing (as before).

## Step 2 (2026-11-18): where the work goes [Claude · Fable high: analysis and ranking; Claude · Opus high: build]
Counted per pass at GL level with `node tools/passes.mjs "<query>" [x,z ...]` (counts do not depend on the GPU; never read fps from the cloud). Xhain, Leistung, 1280 × 720, three spots (Oranienstraße twice, St. Thomas), before this step:

| Pass | Draw calls | Triangles | Share |
|---|---|---|---|
| Sun shadow map (1024²) | 156 to 215 | 243k to 383k | about 38 % |
| Beauty | 143 to 172 | 206k to 304k | about 31 % |
| Normal/depth pre-pass (ink line) | 95 to 120 | 192k to 281k | about 26 % |
| Hero and enemy contour masks | 18 | 20k | about 3 % |
| Frame | 431 to 544 | 0.68 M to 1.01 M | |

After rows 1 and 2 of the ranking (same spots): 422 to 578 calls and 0.56 M to 0.77 M triangles on a frame with a shadow render, 249 to 342 calls and 0.35 M to 0.51 M on the frames without (every second frame at 60 fps on Leistung).

Two findings set the ranking. The world is drawn three times per frame, and the shadow pass is the largest. The camera (44°, FOV 36°) never sees farther than about 31 m (40 m at far zoom) because the ground ends the view, but geometry was merged per 48 m chunk, so whole chunks were processed for a visible area of about 45 × 25 m.

### Ranked measures
| # | Measure | Expected effect | Cost and risk | Status |
|---|---|---|---|---|
| 1 | Chunks 48 → 32 m (ground 31.5 m, a multiple of its 1.5 m grid) | Measured: triangles −17 to −24 %, draw calls −2 to +7 % (shadow pass +11 %, beauty and pre-pass down) | Two constants, same picture | built |
| 2 | Shadow map at most 30 times a second on Leistung (`Profile.shadowInterval`) | Every second frame at 60 fps skips the shadow pass: about −19 % of calls and triangles on average | Small. The light moves only with a new shadow map, so shadows do not swim; the hero's shadow is up to one frame late | built, Johannes checks the look |
| 3 | P1b proxy passes: one vertex buffer per chunk, materials as index ranges; pre-pass and shadow pass draw the chunk in one call each | Draw calls about −50 % (to roughly 220 to 250), triangles unchanged | Medium to large refactor of `src/render/batch.ts` and the chunk loop; +index memory (32-bit). Own task | open: `docs/tasks/p1b-proxy-passes.md` |
| 4 | Shadow casters on Leistung: only the caster boxes, not the merged chunk meshes (`?shadows=boxes`) | Measured at one spot: shadow pass 236 → 66 calls, 263k → 170k triangles (frame −29 % calls, −12 % triangles; trees and other instanced things still cast) | Look: small props, fences and lamp posts lose their shadow. Needs Johannes' eye on the tablet; becomes a profile field if accepted | test switch built |
| 5 | Material audit: 35 to 45 materials per chunk, half of the beauty draws have under 200 triangles; merge materials that differ only in tint or use a small painted texture | Beauty and pre-pass calls about −30 % | Medium to high, touches many builders. After P1b | open |
| 6 | Hero: about 15 draws in each of four passes; merge clothing meshes per material when equipping | −30 to −40 calls | Medium (H1 follow-up) | open |
| 7 | Chunks 24 m | Triangles a further −8 to −12 % | Today +4 to +6 % calls (shadow pass); free after P1b | after P1b |
| 8 | Fragment side (old list): pre-pass at 0.5 scale, bloom at half resolution, dynamic resolution, grade and output in one pass | Unknown without the device | Each changes the picture a little | after Johannes' Akkusparen comparison (below) |

### Checked and dropped
| Idea | Why not |
|---|---|
| Instancing fence panels, Wall elements, tank traps, lamps | They are already merged per chunk and material: one draw call per material, not per panel. Instancing would add a draw call per kind and chunk and only save memory |
| Far-chunk culling, LOD | Nothing farther than about 40 m is ever on screen; there is no far geometry |
| Smaller shadow frustum | 5-storey rows throw shadows 9.5 m sideways; 60 m is needed |
| Cutaway (V1 B) cost | None per frame: no draw calls, shaders or lights; one index upload when the hero enters or leaves a zone; fewer triangles while cut |

### Johannes measures (PC and Tab S9, `?debug=perf`)
| # | Test | Tells us |
|---|---|---|
| 1 | Tab S9, Leistung, Xhain Oranienstraße, 10 min: temperature and fps, `main` against this PR | Whether measures 1 and 2 are felt |
| 2 | Same with Akkusparen on | If the heat goes away, pixel load dominates (do row 8); if not, draw calls and geometry (do P1b first) |
| 3 | `?shadows=boxes` against default: look and temperature | Whether row 4 becomes the Leistung default |
| 4 | Run and dodge on Leistung: hero shadow late or jumping? Ground shadows swimming while walking? | Row 2 look check |
| 5 | Enter a Hinterhof, walk behind St. Thomas: a hitch at the moment of the cut? | Cutaway upload cost |
| 6 | PC, Qualität: fps as before? | No regression |

## Older candidates (row 8 above; measure one at a time)
| Candidate | Expected gain | Risk |
|---|---|---|
| Default Akkusparen on for coarse pointers | Halves GPU work | Less smooth by default |
| Normal/depth pre-pass (ink outline) at 0.5 scale on Leistung | Smaller pass | Thinner, softer ink lines |
| Bloom off or half resolution on Leistung | One blur chain less | Less glow on fires and lamps |
| Dynamic resolution: drop DPR when frame time stays under budget anyway | Same fps, less heat | Softer image |

Done when: Johannes reports the tablet stays warm, not hot, after 15 min of play on the chosen setting.
