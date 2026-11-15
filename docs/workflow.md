# Workflow: Johannes, Claude, Codex

Adapted from the 2D game (`pipeline/workflow.md`, token rules of 2026-11-12, design autonomy of 2026-11-10) on 2026-11-15. Index: `CLAUDE.md` (Codex reads it through `AGENTS.md`).

## Roles

| Who | Does | Does not |
|---|---|---|
| Johannes | Chooses critical directions, playtests on PC, Tab S9 and phone, approves task scope, merges | Edit code |
| Claude | Plans and writes tasks, architecture, sim rules, rendering and shaders, combat feel, debugging, reviews of Codex PRs, performance work, final acceptance | Redo Codex work without a note in the task file |
| Codex | Well-specified tasks end to end: data ports, UI from an approved mockup, tools, tests for a given spec, image generation (menu art) | Change task scope, architecture or the look on its own: write the question into the task file and stop |

Task titles carry the recommended owner and model in brackets, e.g. `[Codex]`, `[Claude · Opus high]`, `[PC · Blender]`. It is a recommendation: Johannes swaps Codex and Claude depending on access and tokens, so every task must be doable by either. A task without a tag is Claude's.

## Document structure

Follows the 2D repo, with two changes.

| File | Role | 2D equivalent |
|---|---|---|
| `CLAUDE.md` (`AGENTS.md` points to it) | Index and rules | Same |
| `docs/plan-3d.md` | Decisions, architecture, budgets | `BACKLOG.md` › Decisions, Tech |
| `docs/migration.md` | Ordered steps, owners, open questions | `BACKLOG.md` › Next |
| `docs/backlog.md` | Ideas and wishes not yet scheduled | `BACKLOG.md` › table and Ideas |
| `docs/status.md` | What is in the game now, known weak spots | `BACKLOG.md` › Done (version rows) |
| `docs/playtests.md` | Playtest history | Same |
| `docs/tasks/` | One file per task, handover notes under `Questions` and in the PR | `pipeline/tasks/` plus `pipeline/log.md` |
| `docs/vision.md`, `docs/story.md`, `docs/style-bible.md`, `docs/district-design-directions.md` | Intent, story, art | Same |

Changes: no global handover log (`pipeline/log.md` grew to 800 lines; notes now live with their task and PR), and no version bump per release (CI deploys `main`).

## Token budget

- Read only what the task needs: `CLAUDE.md`, the task, the files it names. Do not re-read whole docs to re-derive decisions already written down.
- Codex reviews: one, at most two per PR (the second only after a large change). Do not re-trigger after each push.
- Codex runs the checks a task names (`npm run check`, the e2e test once). No broad tuning or measurement passes; Claude does those.
- Docs stay short: tables and one-line rules, dated decisions, no repeated history. Superseded text is deleted, not kept next to the new rule.
- Model choice: Opus 5.5 high for look, shaders, combat feel and architecture; medium for docs, small fixes and routine changes (plan-3d.md › Model).

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

## Definition of done

- `npm run check` passes; `npm run e2e` passes after `npm run build`.
- Sim rules have unit tests; ported data has invariant tests (ids unique, references resolve, ranges sane).
- Visual changes: one screenshot in the PR at 1280 × 720 (`node tools/screenshot.mjs`).
- `docs/status.md` updated when something a player sees changes.
- PR is a draft until CI is green.
