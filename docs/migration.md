# Migration: Ruinenstadt (2D) → Ruinenstadt Berlin (3D)

This repo is the game; only it is developed (Johannes, 2026-11-15). The 2D repo `johakunath/Ruinenstadt` is a read-only reference for data, rules and feel.

## Queue — read this first

Read `CLAUDE.md`, then the linked task and only its source/target files. Completed task details live in `docs/tasks/`; current features in `docs/status.md`. Owner tags are recommendations.

| Task | Owner | Status / start file |
|---|---|---|
| S2 + M7/M8/M9 first playable pass | Codex | done (first pass, PR #17): `docs/tasks/combat-audio-migration.md` |
| M7/M8 parity, M9 consumable controls, M16 run content | Claude | done (review of PR #17 and completion, same task file); Johannes playtest open |
| M12 enemy roster, elites and boss attacks | Fable 5.2 | done: `docs/tasks/m12-enemies.md`; Johannes playtest open |
| M14 balance bot | Fable 5.2 | built: `docs/tasks/m14-balance-bot.md`, numbers in `docs/balance.md`; calibration to Johannes after the playtest |
| M11d Map realism: streets, sidewalks, shapes, limits (playtest 2026-11-17) | Fable 5.2 | open: `docs/tasks/m11d-map-realism.md` |
| U1 Pause menu with tabs, inventory as in 2D (phone playtest 2026-11-16) | Opus 5.5 medium or Sonnet | done, playtest open: `docs/tasks/u1-pause-menu.md` |
| U2 Menu tabs: Segen, Kodex, map legend, options parity | Sonnet | done, playtest open: `docs/tasks/u2-menu-tabs.md` |
| T1b Ground textures: repetition, memory, loading | Sonnet (code), Codex (paving image) | open: `docs/tasks/t1b-ground-polish.md` |
| A2 Audio follow-ups | Sonnet | done (2026-11-16), listening test open: `docs/tasks/a2-audio-followups.md` |
| L2 Loot and item follow-ups | Sonnet | done (2026-11-16): `docs/tasks/l2-loot-followups.md` |
| R1 Hero outline cost | Opus 5.5 high, Johannes measures | open: `docs/tasks/r1-outline-cost.md` |
| L1 Legendary item powers | Fable 5.2 | done (PR #18): `docs/tasks/l1-legendary-powers.md` |
| G1 Weapon identity: three Umbau cards per weapon (option C, decided 2026-11-16) | Fable 5.2 | done, playtest open: `docs/tasks/g1-build-variety.md` |

Split (Johannes, 2026-11-16): the strongest model takes global, hard gameplay (combat rules, enemies and bosses M12, legendary powers L1, balance M14, map design and side branches M16b, textures' look decisions); Opus and Sonnet take the scoped UI, audio, loot and tooling tasks above. Review of the Codex PRs #5 to #17: findings are in those task files; the data, item and stat ports are exact.

Finish: task status + ≤8-line handover, update this queue, update status only for player-visible changes. Draft PR → one review → fixes → ready/CI. Do not re-run prototype acceptance.

**Verified by Johannes, 2026-11-16:** prototype controller feel/rumble, PC performance and hero outline work well; done. Test new combat changes normally; these are not open migration blockers.

## Milestone P1: Köpenick at 2D parity

Goal: play Köpenick with every 2D feature that matters, then work only here. Characters (H1, H2) are not required; CC0 bodies stay until then.

| Feature | Step | State |
|---|---|---|
| Map, route, encounters, waves, heights | M10, M11, M11b | v2 built; playtest open |
| Minimap, 2D edge triangles | M11b | Done |
| Späti rest stops, relief, irregular banks and quays, ground variant C | M11b part 2 | Done; generated ground textures in T1 (Codex) |
| Item data and rolls | M1, M2 | Done |
| Gear stats in combat | M3a, M3b | M3a done (PR #9); M3b done (PR #10) |
| Drops, glow, pickup, exit warning; breakable bins and crates with pickups (2D: crates, BSR bins) | M4 | Built; Johannes playtest open |
| Inventory, equip, compare, salvage, sets | M5 | Implemented; M4 collection hookup done |
| Save, wave checkpoint, difficulty | M6 | Done (PR #16); playtest open |
| Weapons and finishers | M7 | Built: own clips, models, arcs and finishers per weapon; playtest and balance open |
| Powers, ultimates, blessings, families and duos | M8 | Built: all 12 powers, all 50 blessings with 2D offer rules, weapon mods; playtest open |
| Touch layout for more buttons | M9 | Built: thumb arc with power, switch, ultimate, Verband, Molotow; spacing after the Tab S9 playtest |
| Enemy roster and Köpenick mix, elites, 4 bosses with attacks | M12 | Built: six types, four elite modifiers, four bosses with own specials, resistances; playtest open. Own models for the humanoid bosses stay with H2 |
| Balance bot | M14 | Built: plays whole campaigns in Node; first tuning pass done, calibration open |
| Run content: Verband, Molotow, healing drops, events (trader, rescue, ambush, cache, horde, zone), hidden blessings, shrines | M16 | Built: one event per stretch between fights, every type once per run; places are seeded, M16b moves them into side branches |
| Side branches off the route: short dead ends with a surprise (mini-boss, ambush, valuable crate, collectible blessing) | M16b | Open |
| World variety from 2D: lot types (Hinterhof, Markt, park with pond, Kleingärten, Trümmerfeld, Baustelle with crane, Parkplatz), graffiti, puddles, weather (fireflies, rain, ash, embers, fog), area name messages | M11c | Open |
| Camp as menu: upgrades, buildings, stations, survivors, meals, smith (mods), trader | M13 | Built (2026-11-16, `docs/tasks/m13-camp.md`): seven stations, meals from Zutaten, Lazarett, Aufsätze, Lager; playtest open |
| Späti trader: 2D trader port, then trade screen and bigger offer (backlog B13) | M13b | Built (2026-11-16): keeper behind the counter in every Späti, four items, Verband, Molotow, full heal; stock per Späti and run. Own trade screen design and balance open |
| Menus: start, intro and tutorial cards, end screen, Kodex, options | M17 | Built (2026-11-16): four intro cards before the first run, tutorial cards for the first loot and blessing, end screens with stats, title buttons that say what they keep, Hauptmenü in the pause menu; Kodex and options in U1/U2 |
| Endless mode after the district boss | M18 | Built (2026-11-16): "Endlos kämpfen" after the victory; growing waves around the hero, a boss every fifth, a blessing every second, record in the profile |
| One U-Bahn tunnel with Der Schaffner | M19 | Open |
| Sound: 2D port, enemy sounds | S1, S2 | S1 done (PR #9); S2 covers the M12 roster (synth cues per type and special); boss voices S3 |

Not in P1: XP levels, threat levels (Bedrohung), daily fight, walkable camp, other districts.

## Steps

| # | Step | Owner | Needs | Done when |
|---|---|---|---|---|
| M11c | World variety (P1 row): lot types, decals, weather per district, area messages. Mockup or look alternatives for weather first | Claude · Opus medium | M11b | Each zone of Köpenick has two lot types the others do not |
| M7 | Weapons in 2D order: Klinge (pipe moves become its baseline), Hammer, Speer, Werfer; finisher each (B6) | Claude · Opus high | M3b | Klinge and Hammer feel different on a pad |
| M8 | Powers, ultimates, blessings (Zeitsplitter), families and duos | Claude · Opus high | M7 | One power and one ultimate per weapon; blessing choice after each encounter |
| M9 | Touch layout for power, ultimate, consumables: mockup, then build | Claude · Opus medium | M8 | |
| M12 | Köpenick roster from 2D roles (ghoul, brute, spitter, Raser, crow, dinos), elites, bosses Feldwebel, Turmwächter, Rex, Hauptmann with own attacks | Sim Claude, models PC | M3b | Each type needs a different answer |
| M16 | Run content (row in P1). Consumable and event rules port first as a Codex task | Codex (rules), Claude (world) | M4 | All 2D event types occur in a run |
| M16b | Side branches: 2 to 3 per district, 20 to 40 m off the route, each ends in a surprise from M16 (ambush, mini-boss elite, cache crate, hidden blessing). Map rule in `docs/maps/guidelines.md` | Claude · Opus high | M16, M12 | Johannes finds them without the minimap and wants to take them |
| M13 | Camp as a menu between runs; port station table (`STN` area in 2D `js/data.js`) | Claude, Codex (UI) | M6 | Upgrades and meals change the next run |
| M13b | Späti trader (B13): first port the 2D trader (`openTrade`, `tradeLvl`, offers in 2D `js/combat.js`), then the 3D trade screen (mockup first) and the larger offer; the balance bot learns trading | Codex port, Claude screen and rules | M5, M8, M11b | Johannes trades in every Späti and finds something worth the Schrott |
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
| Q11 | Camp | Menu first; walkable 3D camp later |

## Open

| # | Question | Default |
|---|---|---|
| Q5 | Menu art: keep ChatGPT icons and portraits or render 3D items? | Keep as placeholders |
| Q6 | Online save and telemetry (2D `js/sync.js`) | Decided 2026-11-16: reuse the 2D Google Sheet + Apps Script, no login, anonymous 8 character code, browser save stays primary. Built in M6 (`src/sync.ts`); needs a playtest against the live script. No new database |
| Q9 | Tool for enemy and boss voices | Synthesis and CC0 in S2; tool in S3 |
