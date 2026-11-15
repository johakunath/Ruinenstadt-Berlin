# Ruinenstadt Berlin

3D loot ARPG in a post-collapse Berlin. Successor test of the 2D game `johakunath/Ruinenstadt` (read only, never change it from here).

- Read `docs/plan-3d.md` first: decisions, architecture, render budgets, gates. Status and next steps: `docs/status.md`.
- Art: `docs/style-bible.md` and the boards in `docs/style/` are the source of truth (Köpenick = default look). Check them before any visual work.
- Stack: Three.js (WebGL 2), TypeScript strict, Vite, Vitest, Playwright. Versions are pinned exactly in `package.json`. No React, no ECS, no physics engine.
- Game text is German, short: a few words or one line. Code, comments and docs are English.

## Architecture

| Folder | Rule |
|---|---|
| `src/sim` | Game state and rules at a fixed 60 Hz step. No Three.js, no DOM, no `Math.random` (use `sim.rng`). Every rule has a unit test. Ground plane is XZ in meters; facing θ means direction `(sin θ, cos θ)` |
| `src/data` | Typed tuning and map data. `courtyard.ts` is the single source for sim footprints and render meshes; `combat.ts` holds attack timing |
| `src/render` | Three.js scene. Reads sim state, interpolates between steps, never writes to it. One-shot clips are posed from sim time so pose and hitbox match |
| `src/input` | Devices → move vector plus buffered actions. Polled every render frame, also during hitstop |
| `src/audio`, `src/ui` | WebAudio synth, DOM overlay |
| `assets/` | Built GLBs. Every file has a row in `assets/LICENSES.md` |
| `tools/` | Asset build and dev tools (`screenshot.mjs`, `sequence.mjs`, `clip-swing.mjs`) |

The sim reports through `sim.events`; the loop in `src/main.ts` hands them to renderer, audio and rumble.

## Rules

- Collision is 2D on the ground plane with real shapes (plan 3D6). New attacks get their hit arc and clip timing in `src/data/combat.ts`; measure clips with `node tools/clip-swing.mjs <clip>`.
- Two render profiles (`src/render/profile.ts`) and the looks (`src/render/looks.ts`) must keep working. New effects state their cost for Leistung.
- Geometry of the world is built in code and merged per material (`src/render/batch.ts`). Keep draw calls low; things that must not show in the normal/depth pre-pass go on `FX_LAYER`.
- Keep the light count constant at runtime (a changing count recompiles every shader).
- Critical visual or layout decisions: show clearly distinct alternatives first (look variants, mockups). Routine work inside an approved direction: build, show, continue.
- Do not add: inventory, loot, saves, more districts, Rapier, lightmaps, before the gate that asks for them.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run check` | Type check, unit tests, build |
| `npm run e2e` | Playwright smoke test against the built game (`npm run build` first) |
| `npm run assets` | Rebuild `assets/characters/*.glb` from `assets-src/` (`tools/fetch-assets.sh` downloads it) |

URL options: `?profile=Qualität|Leistung`, `?look=gemalt|comic|tusche`, `?debug=hit,perf,flow`, `?stress=40`, `?seed=7`, `?autostart`, `?cam=distance,pitch`.

CI runs type check, unit tests, build and the smoke test on every PR and deploys `main` to GitHub Pages. Cloud browsers have no real GPU: measure performance only on the PC and the Tab S9.
