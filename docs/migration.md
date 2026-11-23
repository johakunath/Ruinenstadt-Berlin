# Migration: Ruinenstadt (2D) → Ruinenstadt Berlin (3D)

This repo is the game; only it is developed (Johannes, 2026-11-15). The 2D repo `johakunath/Ruinenstadt` is a read-only reference for data, rules and feel.

## Queue — read this first

Open work only. Read `CLAUDE.md`, then the linked task and only its source and target files. Built features waiting for Johannes' playtest are listed once in `docs/tasks/pt-hardware-checks.md` › Playtest; finished task details stay in `docs/tasks/`, current features in `docs/status.md`. Owner tags are recommendations.

| Task | Owner | Status / start file |
|---|---|---|
| LA Local AI asset trials (Johannes, 2026-11-22: "start the local asset test"): LA1 T9a Charlottenburg stucco with FLUX.2 klein, then LA2 one Pixal3D prop, then LA3 hero clothing. Runs on the PC only (ComfyUI) | Claude · Opus medium (LA1), Opus high (LA2, LA3) · PC | LA1 built 2026-11-22, round 2 (icons K4/K5, roofs T9e, iron T9i) and LA2 (Schlossgarten urn) built 2026-11-22 (Johannes looks at them, Playtest rows); LA3 built 2026-11-22 (Regenponcho, Quaternius Ranger boots); open: Johannes' hand clean-up on a second prop and the playtest rows: `docs/local-ai-assets.md` › Trials |
| M15 Alexanderplatz step 4 photo check for the landmarks built without a downloaded photo | Claude · Opus high | open: `docs/tasks/m15-alexanderplatz.md` |
| P1b Proxy passes: one draw call per chunk in the pre-pass and the shadow pass (draw calls about −50 %) | Claude · Opus high (spec: Fable high) | open, after Johannes' heat measurements (checks 1 to 3): `docs/tasks/p1b-proxy-passes.md` |
| M14 balance calibration to Johannes (B9, B10) | Claude · Fable high | after the playtest: `docs/tasks/m14-balance-bot.md`, `docs/balance.md` |
| Painted textures: T6 Xhain | Codex | open: `docs/asset-pipeline.md` › Texture queue and `docs/tasks/m15-mitte.md` |
| Texture performance and rail follow-up: T1b, plus profile checks for the new painted batches | Claude and Johannes | open: `docs/tasks/t1b-ground-polish.md`, `docs/tasks/pt-hardware-checks.md` |
| WP4 Hero, weapons and loot visuals: equipment on the hero (P32), pickups per kind (P10), legendary and set looks (P31), 2D #2 close-out, daggers (2D #38). Step 1 (weapon model per base, weapon types, rendered icons) is built | Claude · Opus high (spec: Fable high, done) | open: step 2 (clothing) built 2026-11-19, tunnel set waits for Johannes' pick; step 3 next; `docs/tasks/wp4-equipment-visuals.md` (gates G2 to G4 need Johannes before steps 3, 5, 6b) |
| Backlog ready to build: P17 Spreepark dinos, P18 ambient animals | Claude · Opus high | open: `docs/backlog.md` |
| H3 humanoid boss bases: step 2 human base mesh (comparison first), step 3 Turmwächter on the mech; Codex T8 boss textures | Claude · Opus high | open: `docs/tasks/h3-humanoid-bosses.md` |
| M16 Charlottenburg step 8 rest: tier calibration with the bot once B2 is decided (C4; tier 32 … 54 and U2 west 41 … 46 are provisional) | Claude · Opus medium | after B2: `docs/tasks/m16-charlottenburg.md` › Handover step 8 |
| B2 Economy, enemy roles, tunnel pacing (playtest 2026-11-18): steps 1 and 2 built (bot economy, calibration 2026-11-23) | Claude · Fable high (step 3 design), Opus high (build) | open, step 3 next (enemy roles; bosses too easy, target E5): `docs/tasks/b2-economy-pacing.md` |
| M18 Wedding, district 6 („kommt bald“, gold banquet; layout C2, look A, with the Magendoktor; small scope): step 1 map merged in PR #81 (`?map=wedding`), step 2 enemies, bosses and loot running; step 3 sights and finish (U9 line, links) starts after step 2 is merged | Claude · Opus high (plan: Fable high, done) | running: `docs/tasks/m18-wedding.md` |
| M17 Fernsehturm finale, layout A „Aufstieg“ (Johannes, 2026-11-21; started 2026-11-23 beside Wedding step 3): steps 1 engine and blockout and 2 look merged (`?map=turm`), step 3 Der Zeitwart, echoes, ending choice and Telespargel built (PR); step 4 flow next in the same session; step 5 Codex, step 6 Johannes | Claude · Opus high (plan: Fable high, done); Codex step 5, Johannes step 6 | running: `docs/tasks/m17-fernsehturm.md`, spec `docs/maps/fernsehturm.md` |

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
| Menu art (icons, portraits) | Painted icons, Kodex and camp portraits, illustrated intro; compare against evolved 3D bodies (Q5) |
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
| Q8 | Districts | Köpenick, Xhain, Alexanderplatz, Mitte/Potsdamer Platz, Charlottenburg, Wedding, Fernsehturm finale. Each redrawn. Wedding is a district again (Johannes, 2026-11-21; M18, `docs/maps/wedding.md`): after Charlottenburg, index 5, U9 from Zoologischer Garten, small scope. Not migrated: Tempelhof, Spandau, Marzahn |
| Q8a | Fernsehturm finale | Johannes, 2026-11-21: layout A „Aufstieg“, five decks inside the tower with the lift between, ring arenas, existing enemies of all eras, echo bosses, the ending choice as a card and a flag; opens when all other districts are freed. Not on the ground at the tower: the Alexanderplatz map already plays there. Johannes approved the humanoid robot look for Der Zeitwart. `docs/maps/fernsehturm.md` |
| Q8b | Order | Johannes, 2026-11-21: Charlottenburg, Wedding, then the Fernsehturm finale. The finale starts after Wedding is complete and merged |
| Q10 | Parity scope | P1 above: with endless mode and one tunnel; without threat levels and daily fight |
| Q11 | Camp | Menu first; walkable 3D camp later. Walkable camp built in M20 (2026-11-18): opens with the S3 at Warschauer Straße, stations unlock as build sites |

## Open

| # | Question | Default |
|---|---|---|
| Q5 | Menu art: keep ChatGPT icons and portraits or render 3D items? | Item icons: decided 2026-11-19, rendered from the 3D models (`docs/tasks/wp4-equipment-visuals.md` › D10). Portraits: keep as placeholders |
| Q6 | Online save and telemetry (2D `js/sync.js`) | Decided 2026-11-16: reuse the 2D Google Sheet + Apps Script, no login, anonymous 8 character code, browser save stays primary. Built in M6 (`src/sync.ts`); needs a playtest against the live script. No new database |
| Q9 | Tool for enemy and boss voices | Synthesis and CC0 in S2; tool in S3 |
