# Migration: Ruinenstadt (2D) → Ruinenstadt Berlin (3D)

This repo is the game; only it is developed (Johannes, 2026-11-15). The 2D repo `johakunath/Ruinenstadt` is a read-only reference for data, rules and feel.

## Queue

"Next task" means: the first row with status `open` for your agent. Owner tags are recommendations; Johannes may swap Codex and Claude.

| # | Task | Owner | File | Status |
|---|---|---|---|---|
| 1 | M3a Hero stats port | Codex | `docs/tasks/m3a-stats-port.md` | done (PR #9) |
| 2 | S1 Sound port | Codex | `docs/tasks/s1-sound-port.md` | done (PR #9) |
| 3 | M11b Köpenick v2: tighter, livelier, readable (playtest 2026-11-15, list in `docs/playtests.md`). Concept first, then build | Claude · Opus high | `docs/maps/koepenick.md` | open |
| 4 | M3b Wire stats into sim: weapon damage, life, speed, crit, resist, attack speed; map 2D numbers onto the 3D scale | Codex (Johannes) | `docs/tasks/m3b-stats-in-sim.md` | done (PR #10) |
| 5 | M4 Loot in the world | Claude · Opus high | after M3b, M11b | open |
| 6 | M5 Inventory mockup (Claude), then build (Codex task written after Johannes picks) | Claude, Codex | after M4 | open |

Claude writes the next Codex task file before Codex's queue runs empty.

### Finishing a task

1. Task file: `Status: done (PR #n)`, a `Handover` of at most 8 lines (what changed, deviations, follow-ups).
2. This file: set the queue row to `done`, add follow-ups as new rows or backlog items.
3. `docs/status.md`: only if a player sees a change.
4. PR as draft until CI is green.

## Milestone P1: Köpenick at 2D parity

Goal: play Köpenick with every 2D feature that matters, then work only here. Characters (H1, H2) are not required; CC0 bodies stay until then.

| Feature | Step | State |
|---|---|---|
| Map, route, encounters, waves, heights | M10, M11 | First version; v2 open (M11b) |
| Enterable Späti (safe room), minimap, 2D edge triangles | M11b | Open |
| Item data and rolls | M1, M2 | Done |
| Gear stats in combat | M3a, M3b | M3a done (PR #9); M3b done (PR #10) |
| Drops, glow, pickup, exit warning | M4 | Open |
| Inventory, equip, compare, salvage, sets | M5 | Open |
| Save, wave checkpoint, difficulty | M6 | Open |
| Weapons: Klinge, Hammer, Speer, Werfer, finishers | M7 | Open |
| Powers, ultimates, blessings with families and duos | M8 | Open |
| Touch layout for more buttons | M9 | Open |
| Enemy roster and Köpenick mix, elites, 4 bosses with attacks | M12 | Open (placeholders) |
| Run content: Verband, Molotow, healing drops, breakable crates, events (trader, rescue, ambush, cache, horde, zone), hidden blessings, shrines | M16 | Open |
| Camp as menu: upgrades, buildings, stations, survivors, meals, smith (mods), trader | M13 | Open |
| Menus: start, intro and tutorial cards, end screen, Kodex, options | M17 | Open |
| Endless mode after the district boss | M18 | Open |
| One U-Bahn tunnel with Der Schaffner | M19 | Open |
| Sound: 2D port, enemy sounds | S1, S2 | S1 done (PR #9); S2 open |

Not in P1: XP levels, threat levels (Bedrohung), daily fight, online sync, walkable camp, other districts.

## Steps

| # | Step | Owner | Needs | Done when |
|---|---|---|---|---|
| M3a | Stats port | Codex | M2 | Task file |
| M11b | Köpenick v2: layout about 0.6 of today's distances (new lots, not `mapscale`), narrower streets with clear edges, cars and props on every stretch, more building types and non-rectangular footprints, relief and irregular banks, ground textures (alternatives first), enterable Späti, minimap (mockup first), 2D edge triangles | Claude · Opus high, Johannes picks | M11 | Playtest on the Tab S9: walking feels short, every stretch has something |
| M3b | Stats in the sim | Claude · Opus high | M3a | Equipped item changes damage and life in a run; sim tests |
| M4 | Drops, rarity glow and beam, labels, pickup, exit warning for rare and better. Loot stays where it drops; no vacuum | Claude · Opus high | M3b | Visible on both profiles |
| M5 | Inventory and equipment UI | Mockup Claude, build Codex | M4 | Equip and compare on touch, pad, mouse |
| M6 | Versioned save, wave checkpoint (B1), difficulty choice | Claude (format), Codex (UI) | M5 | Reload resumes at the last wave |
| M7 | Weapons in 2D order: Klinge (pipe moves become its baseline), Hammer, Speer, Werfer; finisher each (B6) | Claude · Opus high | M3b | Klinge and Hammer feel different on a pad |
| M8 | Powers, ultimates, blessings (Zeitsplitter), families and duos | Claude · Opus high | M7 | One power and one ultimate per weapon; blessing choice after each encounter |
| M9 | Touch layout for power, ultimate, consumables: mockup, then build | Claude · Opus medium | M8 | |
| M12 | Köpenick roster from 2D roles (ghoul, brute, spitter, Raser, crow, dinos), elites, bosses Feldwebel, Turmwächter, Rex, Hauptmann with own attacks | Sim Claude, models PC | M3b | Each type needs a different answer |
| M16 | Run content (row in P1). Consumable and event rules port first as a Codex task | Codex (rules), Claude (world) | M4 | All 2D event types occur in a run |
| M13 | Camp as a menu between runs; port station table (`STN` area in 2D `js/data.js`) | Claude, Codex (UI) | M6 | Upgrades and meals change the next run |
| M17 | Menus: start, intro/tutorial cards, end screen, Kodex, options | Codex after mockup | M5 | |
| M18 | Endless mode | Claude | M12 | |
| M19 | U-Bahn tunnel: linear with short side branches (chest or mini-boss), Der Schaffner | Claude · Opus high | M12 | Reachable after Köpenick |
| S2 | Enemy sounds per type, distance volume | Claude · Opus medium | S1 | Each type recognizable by ear |
| S3 | Boss voices (tool: Q9) | Claude, Johannes | M12 | |
| M14 | Balance bot: port `tools/sim.js`, `tools/balance.mjs`, then calibrate to Johannes (B9, B10) | Codex port, Claude rework | M8 | Bot clear times match playtests |
| M15 | Next districts, one at a time, concept first (`docs/maps/guidelines.md`) | Claude, Johannes | P1 | |

Parallel on the PC: H1 custom hero (2 test heroes, pick, rig on current skeleton, 2 outfits, weapons), H2 Köpenick ghoul and other enemies.

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
| Balance bot, telemetry | Ported later (M14) |

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
| Q11 | Camp | Menu first; walkable 3D camp later |

## Open

| # | Question | Default |
|---|---|---|
| Q5 | Menu art: keep ChatGPT icons and portraits or render 3D items? | Keep as placeholders |
| Q6 | Online save and telemetry (2D `js/sync.js`) | After P1 |
| Q9 | Tool for enemy and boss voices | Synthesis and CC0 in S2; tool in S3 |
