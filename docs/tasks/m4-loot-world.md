# M4 Loot in the world [Claude · Sonnet]

Status: done (PR #15, playtest by Johannes open). Prepared by Claude (Opus) on 2026-11-16; the design decisions below are made, so build them as written.
If something does not fit the code, write the question here and ask Johannes. Do not redesign.

Needs: M5 inventory, merged (PR #12). Use its API: `collectItem(sim, item)` in `src/sim/inventory.ts` adds to the 25-slot bag. It rejects full bags and duplicate ids, so rejected drops stay in the world. Scrap and materials live in `sim.inventory.scrap` and `sim.inventory.materials`. Allocate unique item ids (the starter weapon is id 0); see the M5 handover in `docs/tasks/m5-inventory.md`.

## Goal

Enemies and breakable bins and crates drop loot that pops out, lies on the ground with a rarity glow (a beam for rare and better) and a name label, and is picked up by walking over it. This is the 2D loot loop ported to 3D, reusing the 2D numbers.

## Source (read only, `johakunath/Ruinenstadt`)

| 2D | What to take |
|---|---|
| `js/loot.js` (24 lines, read all) | `importantDrop`, `dropNameVisible`, `updateDrops` (pop arc, landing, pickup radius, bag full, heal only when hurt), `healDrop`, `warnLootExit`, `finishLootExit`, `lootGuideTarget` |
| `js/combat.js` `kill()` around lines 86 to 100 | Kill drops: elite, boss and big boss items, material chance, item chance `ch * 0.4` per type, 6 % heal, kill scrap `e.sc` |
| `js/combat.js` `breakProp` (lines 23 to 30) | Breakable drops: scrap 1 to 4 (inside a Späti 4 to 8), item 7 % (inside 30 %, at least magic), material 30 % (inside 60 %), else heal 12 % |
| `js/combat.js` `addToBag` (line 114) | Bag add, toast with ▲ for an upgrade, Kodex note for legendary and set items |
| `js/world.js` `addBrk` (line 145), Späti crates (line 132) | Breakable hit points: crate 3, bin 2, chest 5 hits |
| `js/render.js` lines 88, 99, 170; `js/pickup-art.js` | Glow, labels, minimap dots for rare and better, pickup kinds |
| `js/state.js` `ilvl`, `js/core.js` `wE`, `BAG = 25` | Item level per wave |

Already ported (use, do not rewrite): `src/sim/items.ts` (`makeItem`, `lootItem`, `isUpgrade`, `scrapValue`), `src/data/items.ts` (`RARITIES` colors), `src/data/crafting.ts` (materials), sounds `crash`, `coin`, `pick`, `legend`, `heal`, `wood` in `src/audio/sfx.ts`.

## Decisions (Opus, 2026-11-16)

| Topic | Decision |
|---|---|
| Scale | 2D pixels to meters: divide by 30. Pickup radius 1.2 m; label distance 12 m; pop speed 1 to 2.7 m/s sideways, 5 to 7 m/s up, gravity 20.7 m/s² |
| No vacuum | Pickup only within 1.2 m of the hero, no magnet. Loot stays where it lands until the run ends |
| Auto pickup | Walking within the radius picks up, as in 2D. Items only when the bag has room (`BAG = 25`, else a 6 s throttled toast "Rucksack voll · Beute bleibt liegen"); heal drops only when hurt |
| Enemy mapping | `walker` = 2D ghoul (`sc` 1, item chance 0.15 × 0.4), `runner` = raser (`sc` 3, 0.24 × 0.4), `brute` = brute (`sc` 4, 0.55 × 0.4). Zone bosses (Feldwebel, Turmwächter, Rex) = 2D boss: 2 items `lootItem(il + 2, 1, 0.12)` plus a heal drop, `sc` 40. Hauptmann = 2D big boss: 3 items `lootItem(il + 2, 2, 0.12)` plus one legendary `makeItem(il + 3, 3)`. It is guaranteed until M6 can store "first kill per district"; after that it is 30 %. `sc` 70. No elites yet (M12) |
| Item level | `il = max(1, ceil(g / 2))`, g = 1-based count of normal waves started this run (boss waves do not count), Köpenick `D.lvl = 0`. `LootContext`: district 0, `wave = g / 2`, luck `sim.stats.luck`. One context per sim (it owns `itemId`) |
| Kill roll order | As in 2D `kill()`: bosses first drop their items. Then the material roll (0.22 normal, always for bosses with 5 pieces); only when it fails, the item roll (`ch × 0.4`), and only when that fails, a 6 % heal drop |
| Scrap and materials | Scrap is credited at once with a floating "+3 Schrott", not as a drop (as in 2D). Materials drop as small pickups. Food, ingredients, Verband and Molotow are M16, not here |
| Breakables | Generated `crates` and `bins` props on expedition maps become breakable (the gate 1 courtyard stays static). Add 3 crates inside each Späti (`inside`: better loot, `src/data/spati.ts` positions clear of furniture and the door lane). Köpenick test: at least 30 breakables, none inside the inner 60 % of an encounter circle. Player swings and the dash strike deal 1 hit each, enemies never break them. A break removes the collider (add `Level.remove(c)`, which updates the hash) and refocuses the flow field if inside its window |
| Encounter heal | Keep the +30 % per won encounter for now. Tuning with heal drops is M14 |
| Death | Drops on the ground are lost when a retry rebuilds the sim, as in 2D. Bag rules are M5 and M6 |
| Exit warning | On victory, if important drops (rare or better, or set) remain on the map: modal "Wertvolle Beute liegt noch hier" with "Weiterziehen" and "Beute suchen". Search: the objective line and edge marker point to the nearest important drop and the HUD shows "Beute: n · Weiterziehen". The victory screen comes when none remain or on Weiterziehen |

## Target

| File | Content |
|---|---|
| `src/sim/loot.ts` | `Drop` (id, x, z, vx, vz, h, vh, t, content: item, heal, material), `spawnDrop`, `updateDrops` (arc, landing on walkable ground, pickup), `killDrops(sim, enemy)`, `breakDrops(sim, breakable)`, `lootLevel(sim)`, `importantDrop` |
| `src/sim/breakables.ts` | `Breakable` (id, prop index, kind, hp, inside, collider), hit by player sweeps, break → events, collider removal |
| `src/sim/types.ts` | `sim.drops`, `sim.breakables` (bag, scrap and materials are M5's `sim.inventory`). Events: `drop`, `pickup`, `breakableHit`, `breakableBreak`, `legendary`, `scrap` |
| `src/data/map.ts`, `src/data/spati.ts` | Mark breakable props; Späti crates |
| `src/render/loot.ts` | Instanced visuals: pouch per rarity (instance color from `RARITIES`; set = green), heal and material pickups, ground glow disc (additive, `FX_LAYER`, pulsing), vertical beam for rare and better and set (taller for legendary). No new point lights (fixed light count). Breakable bins and crates also become instanced (hidden by a zero-scale matrix on break) with a hit flash and a burst from `src/render/fx.ts`. At most 6 extra draw calls in total |
| `src/ui/loot-labels.ts` | Pooled DOM labels (at most 12) with the item name in rarity color, shown for magic and better or set, or for commons within 12 m. Use the renderer's screen projection (`screenOf`) |
| `src/ui/minimap.ts` | Dots for rare and better drops (2D render.js:170) |
| `src/main.ts`, `src/audio/audio.ts` | Event wiring: `coin` on landing of magic and better, `legend` plus banner "Legendär!" when a legendary spawns, `crash` on break, `wood` on hit, `pick` on item pickup, `heal`. Toast with ▲ for upgrades (`isUpgrade`) |
| `index.html`, `src/ui/style.css` | Exit warning modal, labels |

## Order

1. Quick SVG mockup of the drop look in the chat (pouch, glow, beam, label for each rarity, a bin and a crate), as Johannes asks before new visuals. Build after his pick.
2. Sim: drops and pickup, kill drops, breakables. Tests first.
3. Render and UI, then the exit warning.
4. Screenshots on both profiles (`node tools/screenshot.mjs`) and the perf readout (`?debug=perf`), draw calls before and after.

## Tests (`src/sim/loot.test.ts`, `src/sim/breakables.test.ts`)

- Seeded kill drops match the 2D chances over many kills (within tolerance); bosses always drop their items; Hauptmann drops a legendary.
- Drops land on walkable ground (never in water) and are not picked up in the air.
- Pickup only within 1.2 m; full bag leaves items on the ground; heal only when hurt.
- A crate breaks after 3 hits, a bin after 2; its collider is gone afterwards; Späti crates give better loot.
- Item level follows the wave count.
- Köpenick has at least 30 breakables, none in an encounter's inner 60 %.

## Done when

- `npm run check` and e2e pass; queue row 5 in `docs/migration.md` done; `docs/status.md` updated.
- Johannes sees drops on both profiles, picks them up, and sees the exit warning when he leaves loot behind.

## Handover

- Sim: `src/sim/loot.ts`, `breakables.ts` (+ tests); `Level.remove/restore` (a new sim restores broken colliders); `sim.lootWaves` drives the item level (seeded from earlier encounters on a retry).
- Look: variant B (crystal, ground ring, beam only from Selten; legendary taller) chosen by Johannes; benchmark image `docs/style/props-loot-benchmark.jpg`. Crates and bins rebuilt in code with more detail (`src/render/breakable-parts.ts`), drawn instanced: 3 draw calls for props, 3 for loot (crystals, glow+ring, beams). Measure on PC and Tab S9.
- Köpenick has 39 breakables (extra `supplies` pass with its own rng, props elsewhere unchanged), 3 crates per Späti, none in an encounter's inner 60 %.
- Deviations: no Kodex note (Kodex is M17); food, Verband, Molotow and ingredients are M16; Hauptmann legendary is guaranteed until M6 stores first kills; broken props leave no debris mesh, only a particle burst.
- Follow-ups: judge crate and bin detail in game (hit state cracks, bin tilt, oil drum as a third breakable); no loot sounds beyond the existing 2D synth ids.
