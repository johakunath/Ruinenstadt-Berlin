# Migration: Ruinenstadt (2D) → Ruinenstadt Berlin (3D)

This repo is the game; only it is developed (Johannes, 2026-11-15). The 2D repo `johakunath/Ruinenstadt` is a read-only reference for data, rules and feel.

## Queue — read this first

Open work only. Read `CLAUDE.md`, then the linked task and only its source and target files. Built features waiting for Johannes' playtest are listed once in `docs/tasks/pt-hardware-checks.md` › Playtest; finished task details stay in `docs/tasks/`, current features in `docs/status.md`. Owner tags are recommendations.

| Task | Owner | Status / start file |
|---|---|---|
| M15 Mitte step 8: U2 tunnel from Alexanderplatz to U Potsdamer Platz, title and victory links, network stop `map: 'mitte'`, bot `--map=mitte`, tier calibration | Claude · Opus medium | open: `docs/tasks/m15-mitte.md` |
| M15 Alexanderplatz step 4 photo check for the landmarks built without a downloaded photo | Claude · Opus high | open: `docs/tasks/m15-alexanderplatz.md` |
| P1b Proxy passes: one draw call per chunk in the pre-pass and the shadow pass (draw calls about −50 %) | Claude · Opus high (spec: Fable high) | open, after Johannes' heat measurements (checks 1 to 3): `docs/tasks/p1b-proxy-passes.md` |
| M14 balance calibration to Johannes (B9, B10) | Claude · Fable high | after the playtest: `docs/tasks/m14-balance-bot.md`, `docs/balance.md` |
| Textures (Codex): T1b rail follow-up and texture performance, T6 Xhain, T7 tunnel walls, Mitte step 9, Alexanderplatz step 8, H1 step 6 hero textures | Codex | open: `docs/asset-pipeline.md` › Texture queue, task files linked there |
| Backlog ready to build: P17 Spreepark dinos, P18 ambient animals, P24 worn landmarks | Claude · Opus high | open: `docs/backlog.md` |
| Next district Charlottenburg (Q8), concept first | Claude · Fable high (concept), Opus high (build) | not started: `docs/maps/guidelines.md` |
| B2 Economy, enemy roles, tunnel pacing (playtest 2026-11-18) | Claude · Fable high (spec), Opus high (build) | open: `docs/tasks/b2-economy-pacing.md` |

Finish a task: task file status and a handover of at most 8 lines, update this queue (delete the row when done; add a Playtest row in `docs/tasks/pt-hardware-checks.md` when Johannes must try it), update `docs/status.md` only for player-visible changes. Draft PR, one review, fixes, then ready and CI.

## Parity with 2D (milestone P1)

Reached 2026-11-18 for Köpenick: map, loot, inventory, save, weapons, powers, blessings, enemies, bosses, run content, side branches, camp, Späti trader, menus, endless mode, tunnels and sound are built; their playtests are in `docs/tasks/pt-hardware-checks.md` › Playtest. Still open from P1: own models for the humanoid bosses and the ghoul (H2), boss voices (S3, tool Q9), a trade screen of its own and trader balance (M13b). Not in P1: XP levels, threat levels (Bedrohung), daily fight.

## How each area moves

| Area | Way |
|---|---|
| Vision, story, style, district directions, workflow | Copied/adapted (done) |
| Item, crafting, progression data | Ported exactly, typed, tested |
| Item and stat rules | Ported into `src/sim`, seeded |
| Weapons, powers, bosses | Redesigned: 2D names, roles and ratios; new moves, arcs, timing |
| Enemies | Roles, resistances, ratios ported; behavior rebuilt |
| Maps, tunnels, camp place | Rebuilt from scratch |
| Menus | Rebuilt as DOM UI after a mockup |
| Menu art (icons, portraits) | 2D files as placeholders (Q5) |
| In-world sprites | Not copied |
| Save | New versioned format, no 2D import |
| Audio | Ported (S1), new enemy and boss sounds |
| Balance bot | Rebuilt on the 3D sim (M14), 2D skill model |
| Run and performance telemetry | Done early (2026-11-16): `src/telemetry.ts` sends one anonymous row per run to the 2D sheet "Telemetrie" (same Apps Script). Off in Optionen ("Spieldaten senden"); never from localhost or automated browsers |

## Decided (Johannes, 2026-11-15)

| # | Question | Decision |
|---|---|---|
| D | 3D or 2D | 3D only; 2D is reference |
| Q1 | Run structure | Walk a zone, fight at fixed encounters |
| Q2 | XP levels | None; progression from items, blessings, camp. Confirmed for P1 |
| Q3 | Weapon order | Klinge, Hammer, Speer, Werfer |
| Q4 | 2D saves | Not imported |
| Q7 | Map size | Concept first, size set by the Tab S9 |
| Q8 | Districts | Köpenick, Xhain, Alexanderplatz, Mitte/Potsdamer Platz, Charlottenburg, Fernsehturm finale. Each redrawn. Not migrated: Tempelhof, Wedding, Spandau, Marzahn |
| Q10 | Parity scope | P1 above: with endless mode and one tunnel; without threat levels and daily fight |
| Q11 | Camp | Menu first; walkable 3D camp later. Walkable camp built in M20 (2026-11-18): opens with the S3 at Warschauer Straße, stations unlock as build sites |

## Open

| # | Question | Default |
|---|---|---|
| Q5 | Menu art: keep ChatGPT icons and portraits or render 3D items? | Keep as placeholders |
| Q6 | Online save and telemetry (2D `js/sync.js`) | Decided 2026-11-16: reuse the 2D Google Sheet + Apps Script, no login, anonymous 8 character code, browser save stays primary. Built in M6 (`src/sync.ts`); needs a playtest against the live script. No new database |
| Q9 | Tool for enemy and boss voices | Synthesis and CC0 in S2; tool in S3 |
