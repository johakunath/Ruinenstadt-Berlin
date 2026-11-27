# Ruinenstadt Berlin

3D loot ARPG in a post-collapse Berlin. This is the game; only this repo is developed. The 2D game `johakunath/Ruinenstadt` is a read-only reference (never change it from here).

- **Next task:** `docs/migration.md` › Queue, first `open` row for your agent; follow its task file and finish with the steps in Queue › Finishing a task.
- Plan and budgets: `docs/plan-3d.md`. Status: `docs/status.md`. Roadmap, queue, decisions: `docs/migration.md`; tasks in `docs/tasks/`; backlog `docs/backlog.md`. Read only what your task needs.
- Animations and attacks: skill `.claude/skills/combat-animation/SKILL.md` (look at the clip, measure it, then set timing). Codex: read that file directly.
- Maps: every district follows `docs/maps/guidelines.md` (concept, OpenStreetMap check, layout rules, invariants); Köpenick is the reference (`docs/maps/koepenick.md`).
- Vision: `docs/vision.md`. Story: `docs/story.md`. Roles, token rules and task format for Claude and Codex: `docs/workflow.md`.
- Art: `docs/style-bible.md` and the boards in `docs/style/` are the source of truth (Köpenick = default look). Check them before any visual work.
- Asset status: `docs/equipment-pipeline.md` (every item: 3D model, hero look, icon) and `docs/enemy-pipeline.md` (every enemy, boss and NPC: body, Kodex). **Whoever touches an item or enemy model, icon, bust, texture or effect (Claude or Codex) updates these indexes in the same PR.**
- Blender steps for Johannes' PC are collected in `docs/blender-pipeline.md`; add a row there instead of waiting.
- Textures: `docs/asset-pipeline.md`. Claude builds objects in code with code-painted placeholder textures. Texture images, icons and static 3D props are made **locally first** (FLUX.2 klein, Pixal3D, Blender on the PC: `docs/local-ai-assets.md`, route and standard workflow per asset group); Codex only for what local models, code and Blender really cannot do (Johannes, 2026-11-26; was paused since 2026-11-23); make the best use of local Pixal3D for every rigid 3D piece (props, hats, plates, pickups). Claude then does the performance integration.
- Stack: Three.js (WebGL 2), TypeScript strict, Vite, Vitest, Playwright. Versions are pinned exactly in `package.json`. No React, no ECS, no physics engine.
- Game text is German, short: a few words or one line. Code, comments and docs are English.

## Model routing (Johannes, 17.11.2026)

Fable 5.2 is scarce (lower limit, access may end): spend it where it is clearly better, and write its results into the repo so Opus can build from them later. Claude models only; Codex roles stay as they are.

| Model | Use for | Not for |
|---|---|---|
| Fable 5.2, effort `high` | Architecture and primary decisions; root cause of a bug that survived fixes; planning, splitting and ordering queue tasks; specs for complex items; strategy and trade-off questions; reviewing a plan before it is built | Routine coding, UI and visual design, final prose |
| Opus 5.5, effort `medium`, `high` for hard code or look | Coding, UI, mockups and visual design, final text (docs, task files, PR bodies, German game text), long execution of an approved plan | An open architecture fork that already failed once |
| Sonnet 5.5 | Small, fully specified changes: mechanical edits, doc touch-ups, small fixes | Judgment across several files |
| Haiku 5.5 | Read-only searches and lookups in subagents | Edits |

1. **Check before the first step.** Name your model (system prompt; in cloud sessions `get_session` → `session_context.model`) and compare it with the task. Clear mismatch: stop, tell Johannes in one line (task, better model, why) and wait. Borderline: say so in one line and continue.
2. **Fable sessions** decide and write down: every decision, plan and spec goes into the task file, `docs/migration.md` or `docs/plan-3d.md` before the session ends. Keep notes short; Opus writes the final text. Large, well-specified implementation goes to an Opus subagent (`model: opus`) instead of Fable coding it.
3. **Opus sessions** that hit an architecture fork, or a bug still open after two fix attempts, stop and recommend a Fable pass (or `/advisor fable` where available).
4. **Record the model** on every work item you create or refine: the task title tag, e.g. `[Claude · Fable high]`, `[Claude · Opus high]` (`docs/workflow.md`); repo-specific choices in `docs/plan-3d.md` › Model.

## Architecture

Folders, their rules and where each system lives: `docs/architecture.md` (read the part your task touches). The three that bite most often: `src/sim` has no Three.js, no DOM and no `Math.random` (use `sim.rng`), and every rule has a unit test; `src/render` reads sim state and never writes it; every hit goes through `strike` or `hurtPlayer` (`src/sim/combat.ts`).

## Rules

- **First step of a task that ports or extends something the 2D game had: look in the 2D repo (`johakunath/Ruinenstadt`, read-only; clone it with `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1`) for existing code, data and rules.** Migrate and reuse as much as possible (numbers, rules, data, drawing code as reference) and develop from there; build new only where 2D has nothing or 3D needs it. Say in the task handover what was reused. Skip the clone for 3D-only work (rendering, performance, Charlottenburg sights, gear meshes).
- Collision is 2D on the ground plane with real shapes (plan 3D6). New attacks get their hit arc and clip timing in `src/data/combat.ts`; measure clips with `node tools/clip-swing.mjs <clip>` and look at them with `node tools/clip-sheet.mjs out.png "clip=<clip>&weapon=hammer"`.
- Three render profiles (`src/render/profile.ts`: Qualität, Ausgewogen, Leistung) must keep working. The look is fixed in `src/render/looks.ts` (chosen after gate 1); change it only on Johannes' feedback. New effects state their cost for Ausgewogen and Leistung.
- Geometry of the world is built in code and merged per material (`src/render/batch.ts`). Keep draw calls low; things that must not show in the normal/depth pre-pass go on `FX_LAYER`.
- Keep the light count constant at runtime (a changing count recompiles every shader).
- Critical visual or layout decisions: show clearly distinct alternatives first (look variants, mockups). Routine work inside an approved direction: build, show, continue.
- Reviews and CI (Johannes, 2026-11-16): one Codex review per session and PR (again only after substantial new commits); CI is not run per commit but when the PR is marked ready after that review; cancel superseded runs. Without Codex, Claude reviews and fixes its findings right away, without asking (Johannes, 2026-11-19). Details in `docs/workflow.md` › Token budget.
- Anything Johannes must check on real hardware (fps, heat, a look decision, a hitch): add a row to `docs/tasks/pt-hardware-checks.md` (Johannes, 2026-11-18), not only to your task file; a built feature he must play goes into its Playtest table.
- Build features in the order of `docs/migration.md`; do not start a step before the steps it needs. Not planned: Rapier, lightmaps.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run check` | Type check, unit tests, build |
| `npm run e2e` | Playwright smoke test against the built game (`npm run build` first) |
| `npm run assets` | Rebuild `assets/characters/zombie.glb` and `anims.glb` from `assets-src/` (`tools/fetch-assets.sh` downloads it) |
| `npm run assets:human` | Rebuild `assets/characters/human1.glb` and `human2.glb` (human boss bases) from `assets-src/` |
| `npm run assets:hero` | Rebuild `assets/characters/hero.glb` through headless Blender (`$BLENDER`, PATH or the Windows default path; `docs/tasks/h1-hero.md`) |

URL options: `?profile=Qualität|Ausgewogen|Leistung` (Ausgewogen is the Leistung of before 2026-11-20), `?debug=hit,perf,flow`, `?stress=40`, `?seed=7`, `?autostart`, `?cam=distance,pitch`, `?map=hof`, `?mapscale=1.3`, `?at=4` (start at encounter 4), `?spawn=rex,raptor,walker+flink` (these kinds next to the hero), `?shadows=boxes` (A/B: only caster boxes shadow, not map chunks), `?map=tunnel&line=1`, `?sky=a|b|c` (Alexanderplatz light), `?cut=off|4.3` (V1 B cutaway), `?props=stall:1.5*4,crane` (prop showcase near the start, rot 0), `?lamp=real|fake` (head lamp as a light or haze only), `?aigear=0` (code hats and outfits instead of the Pixal3D ones), `?rails=old|new`, `?ground=512|1024` (T1b A/B), `?drops=12` (debug drops round the start), `?gear=turm,spaeti,kiez` (wear legendaries and sets; never saved).

CI runs type check, unit tests, build and the smoke test once a PR is marked ready (not per commit, Rules › Reviews and CI) and on `main`, which it deploys to GitHub Pages. Cloud browsers have no real GPU: measure performance only on the PC and the Tab S9.
