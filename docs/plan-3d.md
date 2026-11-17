# Ruinenstadt 3D: plan

Decided 2026-11-14 (Johannes, with Claude; Codex/ChatGPT proposal reviewed). Gate 1 passed 2026-11-15; Johannes decided to continue in 3D. Gates 2 and 3 are replaced by the steps in `docs/migration.md`.

## Why

The ceiling of the Canvas 2D renderer is the main limit on the look: lights, shadows and depth are faked by hand, and painted 2D characters with procedural joints don't fit well with the simple code-drawn buildings. A real 3D renderer does lighting, shadows, bloom and skeletal animation on the GPU. Rebuilding in 3D is accepted; recycling the 2D code is not a goal.

## Decisions

| # | Decision | Reason |
|---|---|---|
| 3D1 | New repo `johakunath/Ruinenstadt-Berlin`. The 2D game stays playable and untouched | Old repo keeps its no-build rule; no risk to the current game |
| 3D2 | Three.js (WebGL 2 renderer), browser first, shareable link | Friends play without installing; JS know-how; cloud workflow |
| 3D3 | TypeScript + Vite, CI on every PR, deploy to GitHub Pages via Actions | See *Build setup* below |
| 3D4 | Two render profiles from the start: **Qualität** (PC, full effects) and **Leistung** (tablet/phone) | PC is the fidelity target, tablet must stay playable |
| 3D5 | Gate 1 tests look, feel and performance together, measured on the PC and the Tab S9 | A pretty scene that stutters on the tablet or feels bad is no answer |
| 3D6 | Gameplay on the ground plane with 2D collision and real hitboxes (see *Collision*), confirmed 2026-11-14. Full 3D physics only where a feature needs it | Precision comes from shapes and hit frames, not from a third axis |
| 3D7 | Assets: CC0 packs and Mixamo for gate 1; the hero becomes a proper custom character from gate 2 on (realistic proportions, swappable clothes and weapons, style bible). Mixamo files in the public repo are accepted (non-commercial, Johannes takes the risk) | Fast first test, quality where it matters most |
| 3D8 | Asset production: Claude in the cloud for code-built geometry, shaders and integration; Codex or Claude on the PC with Blender (GPU, desktop) for characters, rigging, clothing and bakes | Mobile-only development is nice to have, not required; PC via Remote Control is fine |
| 3D9 | Style bible stays the source of truth. The 3D look is chosen from 2 to 3 rendered variants in gate 1 | Critical visual decision (CLAUDE.md rule) |
| 3D10 | No Godot benchmark planned. Trigger for one: gate 1 or 2 fails on tablet performance with animated characters, or the animation tooling blocks progress | Avoid a second project |
| 3D11 | `#35 Combat flow` (snappiness) is done in the 3D game after gate 1, not in the 2D game (Johannes, 2026-11-14) | No effort into code that gets replaced |
| 3D12 | Fable 5.2 builds the first version (gate 1) as the foundation for everything after | Strong at 3D; the first session sets the architecture |
| 3D13 | Look fixed after the gate 1 playtest: painted PBR shading, thin ink line, saturated grade, highlight shoulder, FXAA (Johannes, 2026-11-15). Feedback adjusts it, no more variant rounds | Supersedes the variant part of 3D9 |
| 3D14 | Continue in 3D (Johannes, 2026-11-15). The custom hero and enemies are PC tasks, not gates. Migration order: `docs/migration.md` | Gate 1 convinced on feel and performance |
| 3D15 | The hero stays on the Quaternius body and the UAL skeleton; detail comes from real clothing meshes and textures built by Blender scripts (Johannes, 2026-11-17). No MPFB body, no Mixamo retargeting, no test-hero round. Spec: `docs/tasks/h1-hero.md` | The body is 12,800 of 18,600 triangles and looks good; the painted-on clothes are the weak part. Same skeleton means no animation risk. Supersedes the hero part of 3D7 |

## Build setup: why TypeScript + Vite

| | No build (plain ES modules) | TypeScript + Vite (chosen) |
|---|---|---|
| Setup | None, open `index.html` | `npm install`, dev server, build step |
| Deploy | Push, Pages serves the files | GitHub Action builds and deploys (one-time setup) |
| Code quality | Errors show up only when that code runs | Type checker catches wrong names, wrong arguments and missing fields before the game runs. Matters with two agents (Claude, Codex) editing the same code |
| Three.js | Vendored file or CDN import map | Pinned npm version, imports work as documented, tree shaking |
| Assets | Served as-is | Hashed file names (no stale cache), easy to add GLB compression (meshopt, KTX2 textures) for smaller downloads |
| Phone editing | Easiest | Still fine in cloud sessions; local preview needs the dev server |
| Fit for your goals | Good for a small prototype | Better for a 3-week build with many assets, two agents and a quality target |

**CI** (GitHub Actions on every PR): type check, unit tests for the simulation (Vitest), production build, Playwright smoke test (scene loads, a run starts, no page errors, standard screenshot attached). Real performance is measured only on real devices; cloud browsers have no GPU worth measuring. The old 2D repo can get the same smoke test as a small CI later; that is optional.

## Collision and hitboxes

Hades and Diablo play on a plane too. A hit feels unfair when the shapes or the timing are wrong, not because the world lacks a third axis.

| Layer | Approach |
|---|---|
| Bodies | Circles or capsules on the ground plane, per enemy size |
| Weapon hits | Shape swept during the attack's active frames (arc, capsule or box per weapon), timed by events in the animation clip, each target hit once per swing |
| Projectiles | Ground-plane shapes plus a height value, so they can pass over low cover |
| World | Static footprints of buildings and props, generated from the same data as the meshes |
| Debug | `?debug=hit` draws all shapes in 3D (same as the 2D game) |
| Physics engine | Rapier only for later polish: ragdolls, debris, physics props. Not in gate 1 |

Navigation: grid flow field toward the player (cheap for 40 enemies) plus local separation steering.

## Architecture (smallest sensible)

| Folder | Content |
|---|---|
| `src/sim` | Game state and rules at a fixed 60 Hz step, no Three.js imports, unit tested |
| `src/render` | Three.js scene, render profiles, effects, interpolation between sim steps |
| `src/input` | Keyboard, mouse, gamepad, touch → actions with an input buffer; polled every frame, also during hitstop |
| `src/data` | Items, loot, balance, enemy stats ported from the 2D game as typed data |
| `assets/` | GLB, textures, `LICENSES.md` with source, author, license per file |
| `AGENTS.md` | Points to `CLAUDE.md`, one instruction source for both agents |

No React, no ECS framework, no engine abstraction.

## Render budget (start values, tuned in gate 1)

| | Qualität (PC) | Leistung (Tab S9, phone) |
|---|---|---|
| Resolution | Native up to DPR 2 | DPR cap 1 to 1.25, optional dynamic resolution |
| Shadows | Moonlight (one directional) 2048 map, selected objects | 1024 map, hero and big props only |
| Point lights | Up to 8 without shadows, 1 to 2 with | Up to 4 without shadows |
| Post | Tone mapping, bloom, GTAO, color grading, optional outline | Tone mapping, light bloom, color grading |
| Characters | Full animation rate | Distant enemies animate at reduced rate |
| Target | 60 fps, p95 ≤ 17 ms with 40 enemies | 60 fps with 20 enemies, never under 45 |

Lightmaps only if gate 1 shows the budget is not enough; they need a Blender bake on the PC.

## Style: closing the gap

Raw CC0 packs look clean and generic. They will **not** match the style bible as they are. Plan from the start:
- Buildings, Späti, cobblestones and street props built in code (geometry plus painted-look textures), as in the 2D game's D4 decision.
- Gritty, painted textures (rust, plaster, brick, BVG yellow) instead of flat colors.
- Color grading per district (Köpenick: warm lanterns against teal-green shadows), fog, embers.
- Gate 1 shows 2 to 3 look variants as in-engine screenshots (e.g. painterly PBR, toon ramp with outline, mixed) for Johannes to choose.

## Hero pipeline (H1, decided 2026-11-17, 3D15)

Goal: red scarf, long brown leather coat, harness, pouches, heavy boots; swappable clothing and weapons; animation at least as good as now. Full spec, contract and budget: `docs/tasks/h1-hero.md`.

| Step | Tool | Note |
|---|---|---|
| Base body and rig | Quaternius `Superhero_Female_FullBody` on the UAL skeleton (CC0), unchanged | The skeleton is copied from the source file and never passes through Blender |
| Clothing | Modular meshes built by Blender scripts, bound to the skeleton by joint name (coat, scarf, boots, gloves, district pieces) | Swap = show or hide meshes; a visible piece hides the body region under it |
| Weapons | Code-built models on `hand_r` (`src/render/weapons.ts`); left hand by IK | Same as the item system |
| Animation | The 38 UAL clips in `anims.glb`, unchanged | Extra joints (scarf, coat) move by springs in code |
| Production | Claude on the PC, headless `blender -b --python tools/blender/...`; scripts committed, no `.blend` in git | Verified on the PC with Blender 5.3 (2026-11-17). Not verified: Blender in the cloud environment |

## Gates

| Gate | Result |
|---|---|
| 1 Look, feel, perf | Passed 2026-11-15 on PC, Tab S9 and phone (Leistung). Look fixed (3D13) |
| 2 Hero and combat | Dissolved (3D14): hero and ghoul are PC tasks H1 and H2, combat tuning continues with more weapons (M7, M8) |
| 3 Vertical slice, decision | Replaced by the migration steps in `docs/migration.md` |

## Not now

Godot, Rapier, lightmaps, import of 2D saves.

## Model

| Work | Model |
|---|---|
| Gate 1 kickoff (setup, scene, look variants) | Fable 5.2 if usage allows, else Opus 5.5 high. Unverified whether Fable is better here; the first session makes many broad decisions at once |
| Iterations, assets integration, tuning | Opus 5.5 high |
| After gate 1 | Opus 5.5: high for look, shaders, combat feel and tuning, medium for docs, small fixes and routine changes. Fable 5.2 (high) for architecture steps, root causes that survived fixes, queue planning and task specs (`CLAUDE.md` › Model routing, 2026-11-17) |

## Getting started

Step-by-step setup and the Fable kickoff prompt: `docs/3d-getting-started.md`.
