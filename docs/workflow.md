# Workflow: Johannes, Claude, Codex

Adapted from the 2D game (`pipeline/workflow.md`, token rules of 2026-11-12, design autonomy of 2026-11-10) on 2026-11-15. Index: `CLAUDE.md` (Codex reads it through `AGENTS.md`).

**Codex paused (Johannes, 2026-11-23):** no Codex for now (no tokens left). Every task or fallback marked Codex goes to Claude with the local models, code and Blender on the PC; Claude reviews PRs itself (`/code-review`) and fixes its findings. Codex rows stay as they are for when it returns.

## Roles

| Who | Does | Does not |
|---|---|---|
| Johannes | Chooses critical directions, playtests on PC, Tab S9 and phone, approves task scope, merges | Edit code |
| Claude | Plans and writes tasks, architecture, sim rules, rendering and shaders, combat feel, debugging, reviews of Codex PRs, performance work, final acceptance | Redo Codex work without a note in the task file |
| Codex | Well-specified tasks end to end: data ports, UI from an approved mockup, tools, tests for a given spec, image generation as the fallback when the local models do not satisfy (menu art, texture images per `docs/asset-pipeline.md` and `docs/local-ai-assets.md`, including their first integration) | Change task scope, architecture or the look on its own: write the question into the task file and stop |

Task titles carry the recommended owner and model in brackets, e.g. `[Codex]`, `[Claude · Opus high]`, `[PC · Blender]`. It is a recommendation: Johannes swaps Codex and Claude depending on access and tokens, so every task must be doable by either. A task without a tag is Claude's.

## Document structure

Follows the 2D repo, with two changes.

| File | Role | 2D equivalent |
|---|---|---|
| `CLAUDE.md` (`AGENTS.md` points to it) | Index and rules | Same |
| `docs/architecture.md` | Folders, their rules, where each system lives (moved out of `CLAUDE.md`) | – |
| `docs/plan-3d.md` | Decisions, architecture, budgets | `BACKLOG.md` › Decisions, Tech |
| `docs/migration.md` | Queue (open work only), parity summary, decisions | `BACKLOG.md` › Next |
| `docs/backlog.md` | Wishes not yet scheduled (table) and pure ideas that are not decided (section Ideas: never build from it without Johannes' decision) | `BACKLOG.md` › table and Ideas |
| `docs/status.md` | What is in the game now, known weak spots | `BACKLOG.md` › Done (version rows) |
| `docs/playtests.md` | Playtest history | Same |
| `docs/tasks/pt-hardware-checks.md` | What Johannes must still play (Playtest) and check on devices | – |
| `docs/tasks/` | One file per task, handover notes under `Questions` and in the PR | `pipeline/tasks/` plus `pipeline/log.md` |
| `docs/vision.md`, `docs/story.md`, `docs/style-bible.md`, `docs/district-design-directions.md` | Intent, story, art | Same |

Changes: no global handover log (`pipeline/log.md` grew to 800 lines; notes now live with their task and PR), and no version bump per release (CI deploys `main`).

## Token budget

- Read only what the task needs: `CLAUDE.md`, the task, the files it names. Do not re-read whole docs to re-derive decisions already written down.
- Codex reviews (Johannes, 2026-11-16): one per session and PR; another only after substantial new commits. Fix the findings, do not re-trigger after each push. Fewer sessions are better.
- Claude reviews (Johannes, 2026-11-19): when Codex has no tokens left, Claude reviews the PR (`/code-review`). Claude fixes its findings right away in the same session, without asking first, on the PR's branch, and reports what it fixed. Exception: a branch another session is still working on gets the findings as a message instead of a push.
- GitHub Actions minutes are limited: CI does not run per commit. Order: PR as draft, work, Codex review, fix, then mark ready (CI runs once on that head), then merge. A merge Johannes asks for does not wait for CI. Superseded runs are cancelled; `main` always runs (deploy).
- Codex runs the checks a task names (`npm run check`, the e2e test once). No broad tuning or measurement passes; Claude does those.
- Docs stay short: tables and one-line rules, dated decisions, no repeated history. Superseded text is deleted, not kept next to the new rule. A task file over 20 KB gets its finished steps collapsed to one line each when the next step starts (2026-11-20).
- Source files: split a file past about 80 KB along its sections when you next work in it; agents read whole files (backlog P36).
- Parallel work on Johannes' PC (i7-8700, 6 cores, 32 GB, one RTX 4070; measured 2026-11-26: six builders plus ComfyUI held the CPU at 100 % with 2 GB RAM free and map tests timed out): at most two background agents besides the main session; only one of them at a time runs `npm run check`, Playwright/swiftshader screenshots or GPU jobs in ComfyUI; Vitest with `--maxWorkers=4` while anything else runs; screenshots in the in-app browser (real GPU) where possible.
- Model choice: `CLAUDE.md` › Model routing (Fable 5.2 decides and plans, Opus 5.5 builds); repo specifics in plan-3d.md › Model.

## Lessons (session 2026-11-16/17)

| Lesson | Practice |
|---|---|
| A red `main` run blocks the deploy | Pages deploys only after `check` passes on `main`. After every merge, look at the `main` run; a failing smoke test there means players do not get the release (PR #20 was stuck this way) |
| Codex review | Comment `@codex review` on the draft PR; findings arrive as review threads. Fix, answer on the thread, resolve, then mark ready and merge. One review per PR |
| Small releases | Several small PRs (one topic each) merged faster than one large one; work for the next release continues on a local branch while a PR is in review |
| Parallel sessions | Another session may work in the same repo. Check open PRs and branches before starting a task; take over only what Johannes assigns |
| Visual decisions | SVG mockups with example values or real map data go to the chat first (Johannes' standing rule); they are kept in `docs/mockups/` |
| Browser tests and load | Unit tests can time out while the browser suite runs in parallel; rerun the file alone before calling it a failure |

## Maps

Every district map follows `docs/maps/guidelines.md`: concept mockups, geography check against OpenStreetMap, map SVG from the data before the 3D build, the shared layout rules and the map invariant tests. Rules that change while building a map go into that file, dated.

## Design autonomy

Critical visual or layout decisions get clearly distinct alternatives first (SVG mockup for layouts, render for looks). About 80 % of routine work is chosen inside the approved direction, shown, and continued unless Johannes objects. Near-identical alternatives are not a decision.

## Task format (so Codex can follow it)

Every task in `docs/tasks/` has:

| Section | Content |
|---|---|
| Goal | One or two lines |
| Source | Exact files and symbols in `johakunath/Ruinenstadt` (read only) |
| Target | Exact files in this repo, types or function signatures to create |
| Steps | Numbered, small, concrete. Numbers and names, not descriptions |
| Done when | Checks that pass or fail: tests to add, commands, a screenshot |
| Not in scope | What to leave alone |

If a step does not work as written, stop at that step, write the problem into the task file under `Questions`, and open the PR as draft.

## Next task

When Johannes says "next task": `docs/migration.md` › Queue, first `open` row for your agent. Finish with Queue › Finishing a task (task file handover, queue row, status if player-visible). Claude keeps at least one Codex task file ready.

## Definition of done

- `npm run check` passes; `npm run e2e` passes after `npm run build`.
- Sim rules have unit tests; ported data has invariant tests (ids unique, references resolve, ranges sane).
- Visual changes: one screenshot in the PR at 1280 × 720 (`node tools/screenshot.mjs`).
- `docs/status.md` updated when something a player sees changes; queue row in `docs/migration.md` set to `done`.
- PR is a draft until the Codex review is done and fixed; marking it ready is what starts CI (see Token budget).
