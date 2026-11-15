# Migration: Ruinenstadt (2D) → Ruinenstadt Berlin (3D)

Decided 2026-11-15 (Johannes): the 3D game is the future of the project. The custom hero is no longer a gate but a PC task; the remaining work moves in steps below. The 2D repo `johakunath/Ruinenstadt` stays playable and read only from here.

## What moves how

| Area | 2D source | Way | Why |
|---|---|---|---|
| Vision, story, district directions, style bible | `BACKLOG.md` › Intent, `docs/story.md`, `docs/district-design-directions.md`, `docs/style-bible.md` | **Copied** (done: `docs/vision.md`, `docs/story.md`, `docs/district-design-directions.md`) | Engine independent |
| Workflow and token rules | `pipeline/workflow.md`, `CLAUDE.md` | **Adapted** (done: `docs/workflow.md`) | Same people, new stack |
| Item data: rarities, elements, affixes, pacts, implicits, sets, set bonuses, legendary powers, materials, mods, ingredients, meals, consumables, difficulty, perks (blessings) | `js/data.js` (`RAR`, `ELC`, `AFX`, `PACTS`, `IMP`, `SETS`, `SETB`, `LEGP`, `MATS`, `MODS`, `SLOTS`, `ZUT`, `MEALS`, `CONS`, `DIFF`, `PERKS`) | **Ported** to typed TS with tests | Pure data, the balance work of 99 versions |
| Item logic: rolls, item level, compare, salvage, prices | `js/items.js` (`rollR`, `makeItem`, `rollAfx`, `lootItem`, `RIL`, `better`, `salvage`, `itemPrice`) | **Ported** into `src/sim`, seeded by `sim.rng` | Rules, testable |
| Weapon classes | `KIND` in `js/data.js`, `attack`/`skill` in `js/combat.js` | **Redesigned**: names, roles and damage ratios kept; moves, hit arcs and timing new per weapon in `src/data/combat.ts` | 2D swings do not carry over; 3D needs clips and arcs |
| Powers, ultimates, blessings | `js/combat.js`, `PERKS` | **Redesigned** on the ported data | Need 3D effects and hitboxes |
| Enemy roster and roles | `mkEnemy` in `js/combat.js`, `RES` | **Ported as design** (role, resistances, HP and damage ratios), behavior rebuilt in `src/sim` | Behavior lives in the 3D sim |
| Bosses | `js/combat.js`, boss art in `assets/bosses/` | **Redesigned** per district | Need 3D models and attacks |
| Maps and districts | `js/geo.js`, `js/mitte.js`, `js/alex.js`, `js/world.js`, `js/biomes.js` | **Rebuilt**, nothing ported. Landmark list and district order kept | New map concept (vision.md › New in 3D) |
| U-Bahn tunnels, network map | `js/ubahn.js` | **Rebuilt later**: mostly linear, with short side branches holding a chest or a mini-boss | Same reason as maps; linear keeps tunnels quick |
| Camp, stations, NPCs, quests | `js/base.js`, `CAMP`, `SURV`, `JOBT` | **Ported as data**, place rebuilt in 3D later | Camp is its own step |
| Inventory and menus | `js/panels.js` | **Rebuilt** as DOM UI after a mockup; behavior and rules kept | 2D code is dense and tied to its globals |
| Menu art: item icons, portraits | `assets/icons/` (112), `assets/portraits/` (29), `docs/chatgpt-assets.md` | **Copied as placeholders** when the inventory step needs them. Keep or redo: open (Q5) | Johannes decides later |
| In-world sprites (enemies, props, buildings, vehicles) | `assets/` | **Not copied** | 3D needs models |
| Save | `js/save.js`, `js/sync.js` | **New format**, versioned from the start. No import of 2D saves (Q4) | Different game state |
| Balance bot, telemetry | `tools/sim.js`, `tools/balance.mjs`, `S.tlog` | **Ported later** against the 3D sim (it runs headless already) | Bot rules carry over |
| Audio | `js/audio.js` (synthesized recipes: room reverb, compressor, three takes per effect) | **Ported** early (S1); enemy and boss sounds are new (S2, S3) | Liked in the 2D game; the 3D prototype has only a few basic sounds |

## Steps

Owner tags are recommendations, not rules: Johannes swaps Codex and Claude depending on access and tokens. `[Codex]`, `[Claude · Opus high]`, `[Claude · Opus medium]`, `[PC · Blender]` (Johannes with Codex or Claude on the PC), `[Johannes]`. Steps without a PC tag run in the cloud.

| # | Step | Owner | Needs | Done when |
|---|---|---|---|---|
| M0 | Docs: vision, story, district directions, workflow | Claude · Opus medium | | Done 2026-11-15 |
| M1 | Item data port (task: `docs/tasks/m1-item-data.md`) | Codex | | `src/data/items.ts` and friends typed, invariant tests green |
| M2 | Item logic: roll, item level, compare, salvage, seeded (task: `docs/tasks/m2-item-logic.md`) | Codex, review Claude | M1 | Unit tests reproduce 2D distributions within tolerance |
| S1 | Sound port: the 2D sounds from `js/audio.js` (synthesized in code, no audio files) into `src/audio`, mapped to the 3D events (swing, hit, kill, dodge, hurt, death). They replace the gate 1 placeholder sounds | Codex | | Every sim event has its 2D sound; volume option works |
| S2 | Enemy sounds per type: idle growl, wind-up, attack, hit, death; distance volume. Placeholder from synthesis or CC0 packs first | Claude · Opus medium | S1 | Each enemy type is recognizable by ear |
| M3 | Hero stats from gear: damage, life, speed, crit, elements, resist feed the sim | Claude · Opus high | M2 | Sim tests; equipped item changes damage in a run |
| M4 | Loot in the world: drops, rarity glow and beam, name labels, pickup, exit warning for rare and better | Claude · Opus high | M2 | Visible in the courtyard on both profiles |
| M5 | Inventory and equipment UI: mockup first, then build | Mockup Claude, build Codex | M4 | Johannes picks the mockup; equip and compare work on touch, pad, mouse |
| M6 | Save and wave checkpoint (backlog B1) | Claude · Opus high (format), Codex (UI) | M5 | Reload during a run resumes at the last wave; save has a version field |
| M7 | Weapon classes in the 2D order: **Klinge first** (the gate 1 pipe moves become the Klinge baseline, a blade replaces the pipe), then **Hammer**, then Speer and Werfer. Each with its own finisher (backlog B6) | Claude · Opus high | Hero clips (H1) for best result, CC0 clips meanwhile | Klinge and Hammer feel different on controller |
| M8 | Powers, ultimates, blessings (Zeitsplitter) | Claude · Opus high | M3, M7 | One power and one ultimate per weapon, blessing choice after each encounter |
| M9 | Touch layout for more buttons (power, ultimate, consumables): mockup, then build | Claude · Opus medium | M8 | Only needed once there are more than two actions |
| M10 | Köpenick map concept: a miniaturized Köpenick. Landmarks, rivers (Dahme, Spree), bridges, Altstadt, Schloss and Rathaus in their real relative positions; distances strongly compressed; fewer buildings, more open space. A mini open world with encounter places and zones | Claude · Opus high, Johannes decides | | SVG map mockup approved; perf test on the Tab S9 sets the size |
| M11 | Köpenick build: streets, landmarks, bridges, water, heights and stairs (backlog B3), camera vs tall buildings (B4) | Claude · Opus high | M10 | Playable mini open world with 2 to 3 zones |
| M12 | Köpenick enemies: roster from 2D roles (ghoul, brute, spitter, Raser, dinos), elites with modifiers, Hauptmann boss | Sim Claude, models PC · Blender | M10 | Each type needs a different answer |
| S3 | Boss voices: short lines or growls per boss. Needs a voice or sound-effect generator outside the repo (Q9) | Claude · Opus medium, Johannes picks the tool | M12 | Hauptmann has a voice |
| M13 | Camp: walkable station, stations as data, meals, consumables | Claude, art PC · Blender | M6 | Camp reachable from a run |
| M14 | Balance bot and telemetry on the 3D sim | Codex, review Claude | M8 | `node tools/balance.mjs` prints the 2D fields |
| M15 | Next districts as mini open worlds, one at a time, each with a map concept first; U-Bahn tunnels between them (mostly linear, side branches with chest or mini-boss) | Claude, Johannes | M11 to M14 | |

Character work runs in parallel on the PC and does not block the cloud steps:

| # | Step | Owner |
|---|---|---|
| H1 | Custom hero: 2 test heroes (MPFB in Blender vs AI generator), pick one, rig on the current skeleton, 2 outfits, pipe and second weapon | PC · Blender |
| H2 | Köpenick ghoul, then the other Köpenick enemies | PC · Blender |

## Decided (Johannes, 2026-11-15)

| # | Question | Decision |
|---|---|---|
| Q1 | Run structure | Walk through a zone and fight at fixed places (encounters), try that first |
| Q2 | Expedition levels | No XP levels for now; progression inside a run comes from items and blessings. Decide later |
| Q3 | Weapon order | Follow the 2D classes: Klinge, then Hammer, then Speer and Werfer |
| Q4 | 2D saves | Not imported, fresh start |
| Q7 | Map size | No fixed multiple of the 2D map. Concept first (miniaturized real geography), then the size that runs well on the Tab S9. Denser with fewer buildings is fine |
| D | 3D or 2D | 3D is the game from now on |

## Open questions

| # | Question | Default if nobody decides |
|---|---|---|
| Q5 | Menu art: keep the ChatGPT icons and portraits, or render 3D items? | Keep as placeholders |
| Q6 | Online save and telemetry via the Google Sheet (2D `js/sync.js`): carry over? | Later, after M6 |
| Q8 | Districts: the seven of the 2D story (Köpenick, Xhain, Alexanderplatz, Mitte, Wedding, Tempelhof, Charlottenburg) plus the Fernsehturm finale? | Yes, as in `docs/story.md` |
| Q9 | Tool for enemy and boss voices: synthesis, CC0 packs, or a generator (text to sound effect or speech)? | Synthesis and CC0 placeholders in S2; tool chosen in S3 |
