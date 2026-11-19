# P25 Türsteher neon barriers: decision [Claude · Fable high]

Backlog P25, step 5 of `docs/tasks/wp5-enemies.md`. Origin: `docs/tasks/m12c-mitte-enemies.md` › Der Türsteher ("Dropped: neon barriers"). Decision pass 2026-11-19, no code changed. Build spec below is for one Opus session.

**Status: built** (2026-11-19, Claude · Opus high). Proof `docs/proof/p25/barriers.webp` (Qualität; Leistung looked the same).

## Handover

- 2D: nothing to reuse; the 2D repo has no Türsteher and no barrier or door rule (`js/` grep for Türsteher, barrier, Schranke, Tor, Einlass). Reused from 3D: the tunnel grating pattern (bar box half depth 0.3, `level.gates`), `FlowField.patch` from PR #61, `threatHit`, the `zap` cue, the boss's pink `0xff4fa3`.
- Built as specified: `BOSS.tuersteher` bar numbers (14 m, 0.8 s, 4 s, 9 s, 0.6 / 0.1, 1.5 m), `TOR_PASSAGES` / `torBarriers` (`src/data/map.ts`), `Level.shut` / `open` / `isShut`, `reachGrid` skips shut colliders, `src/sim/barriers.ts` after `updateThreats`, `Sim.barrier`, event `barrier` (with x, z of the middle bar for the sound), death summary „Der Türsteher · Neonschranke“. One flow patch over the union of the five bars instead of five.
- Render: `src/render/barriers.ts`, hooked into `renderer.ts` (built on the first frame of a level with bars). Strip 1.36 m deep (the hit band), three tubes r 0.07 at 0.5 / 1.2 / 1.9 m; they read well from the follow camera, no thickening needed.
- Cost: 2 instanced draw calls while shown (5 strips, 15 open 8-sided tubes, about 250 triangles), 0 when idle; unlit, additive, FX_LAYER, no lights, no shadows. Sim: one patch of about 300 flow cells per shut and open.
- Tests (15): `src/sim/barriers.test.ts` (10), `src/sim/level.test.ts` (2), `flowfield.test.ts` (+1), `src/data/mitte.test.ts` (+1 per scale).
- Bot, one Mitte run (seed 1): Pariser Platz won, 1 death; no baseline to compare. Not done: the `?spawn=tuersteher,brute` settle check in an outer mouth. The look shot used `?map=mitte&autostart&at=3&spawn=tuersteher` (Pariser Platz is encounter 3) and `window.__game` to place the hero and set rage.

## Decision

1. **Build it, small.** Real blocking barriers, not a damage line. The reason it was dropped ("dynamic colliders in the level hash are new work") no longer holds: the hash already takes inserts and removals at runtime (`Level.add` / `Level.remove`; shrines, tunnel gratings, Weltzeituhr base).
2. **No general dynamic-collider system.** Two small additions cover it: `Level.shut` / `Level.open` (a toggle outside the restore journal) and `FlowField.patch` (re-mark a few cells instead of rebuilding the field).
3. **The plain `add` / `remove` path must not be used for barriers.** Measured: `add` → `remove` → any other `remove` → `restore` leaves the barrier in the level for the next run and loses the other collider (`restore` pops the wrong journal entry). No caller does this today; a barrier that opens and closes would.
4. **A passive rage rule, not a boss special.** It runs on its own timer beside Schubser, Griff and Gästeliste (his three cooldown slots are taken, and a wind-up at a door he may be far from would be a free punish window). `src/sim/ai.ts` stays untouched.
5. **Rule:** while he rages and the hero is within 14 m of the Tor, the five passages shut: ground strip 0.8 s, bars 4 s, then 9 s open. Bodies on the strip when it shuts are pushed out to their own side; the hero takes one hit. Bars open the moment he dies.
6. **Value, stated plainly:** it is his signature image and it takes the western way out and the pier cover away in rage. It is place-bound: a fight that stays in the east of the square never shows it. Lever if Johannes wants it in every fight: `bossAt` in the Tor forecourt (he "hält die Tür am Tor"); one data line, decide after the playtest, not part of this build.

## What was checked

| Question | Finding |
|---|---|
| Hash at runtime | `Level.insert` / `remove` work at any time; `near`, `resolve`, shots (`threats.ts`, `abilities.ts`), spawn spots and drops all read the hash, so a shut bar blocks bodies and shots both ways with no extra code |
| Restore journal | Broken for add-then-remove of the same collider (point 3). Weltzeituhr (remove, then add of an original collider) and shrines (add only) are fine |
| Flow field | Never notices a collider change by itself. Prior art calls `focusFlow`, which builds a new field: **40 ms** at Pariser Platz (80 colliders, 120 × 120 cells, node on the cloud CPU); the Dijkstra pass alone is 2 ms. Two more 40 ms hitches per barrier cycle in a boss fight are not acceptable, so: patch the cells under the bars (a few hundred) and let the next `setTarget` rebuild (about 2 ms) |
| Bodies inside when it shuts | `Level.resolve` runs for the hero and every walking enemy each step and pushes a centre inside a box out through the nearest face. With the bar box reaching 0.6 m into the piers on both sides the nearest face is always a long one. Tested on the real map at scale 1 and 1.3 with the bars as specified below: 42 240 positions for radius 0.3 and 0.38, all end clear of every collider on the side they stood on; largest move 0.59 m walker, 0.67 m hero. The boss (0.8) fails in the two outer mouths at scale 1 (a house stands 1 m in front), so the bar waits for him |
| Tunnelling | Bar half depth 0.3 as the tunnel gratings (`map.ts` gates). Fastest body: charge 0.31 m per step, hero knock capped at 0.36 m: nothing crosses 0.3 + radius in one step |
| Sealed? | No, and that is good. With all five bars shut the west stays reachable: 80 m detour for radius 0.3, about 150 m for the hero and the boss (Behrenstraße, and 1 m slits between the Pariser Platz houses). No soft lock is possible; no "same side" rule is needed |
| Enemies cut off | Inside the 30 m flow window the west has no path while shut (`dist` Infinity). `enemies.ts` then walks straight at the hero and leans on the bar for up to 4 s. Accepted |
| Sight | `clearLine` reads the flow grid, so the Griff sees no line through a shut bar once the cells are patched |
| Reach grid | Cached per `Level` for its whole life, built lazily. If it were first built while shut, the passage cells would stay unreachable for every later run. Fix: `reachGrid` ignores shut colliders |
| Save | `snapshot` writes a run only in `pause`, `travel`, `hold`; the boss wave is the only wave of the encounter, so a barrier is never in a save. `createSim` calls `level.restore()`, which must open everything. Nothing to add to `SaveRun` |
| Endless mode | The Türsteher can return anywhere; the 14 m rule keeps the rule silent away from the Tor |
| Bot | `src/bot/bot.ts` has its own static free grid; it may walk into a bar for up to 4 s. Accepted; one balance run confirms |

## Alternatives

| Option | Verdict |
|---|---|
| A. Blocking bars, pulse (chosen) | Small: hash already dynamic, tunnel gratings are the render and data pattern |
| B. Damage line that does not block | Rejected. Needs a new box zone shape and the same render; saves only `shut` / `open` and `patch` (about 40 lines) and does not shut a door |
| C. Bars shut for the whole rage | Rejected. Hero west and boss east would wait out the rest of the fight on two sides of a wall (150 m detour); the pulse heals itself |
| D. Damage on touch while shut | Not in v1: a per-step rule for little gain. Later lever: a shove into a live bar hurts |
| E. Do not build | Viable. P25 is the smallest item of WP5; drop it if the session budget is short |

# Build spec [Claude · Opus high]

First step as always: grep the 2D repo for a barrier or door rule (`tuersteher`, `schranke`, `barrier`); this pass did not look. Note the result in the handover.

## Numbers (`BOSS.tuersteher` in `src/data/enemies.ts`)

| Field | Value | Meaning |
|---|---|---|
| `barNear` | 14 m | Hero this close to the nearest bar (centre distance); tune so the Tor is on screen (camera distance 18.5, pitch 44) |
| `barWind` | 0.8 s | Ground strip before it shuts (0.7 m is enough to step clear) |
| `barTime` | 4 s | Shut |
| `barEvery` | 9 s | Open before the next wind-up (cycle 13.8 s) |
| `barDamage`, `barFloor` | 0.6, 0.1 | Hit for standing on the strip when it shuts (Schubser: 1.0, 0.15) |
| `barClear` | 1.5 m | No wind-up starts while the boss himself is this close to a bar; if he walks in during the wind-up, the shut waits until he is out (strip stays lit) |

Not scaled by the rage cooldown factor (it only runs in rage). No rng.

## Data

- `src/data/map.ts`, next to `OPEN_PARTS`: `TOR_PASSAGES`, local x centre and half width: `[-13.725, 1.9], [-7.325, 1.9], [0, 2.825], [7.325, 1.9], [13.725, 1.9]` (the gaps between the piers of `OPEN_PARTS.tor`).
- `src/sim/level.ts`: `interface BarrierDef { x; z; rot; half; collider: Collider }` and `Level.barriers: BarrierDef[] = []` (as `gates`). Colliders are **not** in `colliders` at build time.
- `mapLevel`: for a `tor` landmark, one box per passage in the landmark frame: local `(cx, +4.2)`, `hx = half + 0.6`, `hz = 0.3`, `rot = l.rot`. Local +z is the Pariser Platz side (world +x at rot 90°): the bar's east face is flush with the pier faces (the mouth of the passage, where the piers hide least from the south camera) and its ends sit inside the piers. Do not move it in front of the faces: bodies then get caught between bar and pier (tested). `half` in the def is the passage half width; the renderer draws tubes and strip across the opening, 0.05 m proud of the faces.

## Sim

| File | Change |
|---|---|
| `src/sim/level.ts` | `shut(c)`, `open(c)`, `isShut(c)`: a private `Set`; push/insert and splice/unhash without touching `added` / `removed` (share the unhash code with `remove`). `restore()` opens every shut collider first. Idempotent |
| `src/sim/flowfield.ts` | Keep `clearance` and `ground` as fields; move the marking loop into `patch(box: Bounds, colliders)`: recompute `blocked` for the cells inside `box` (clamped to the field), set `targetCell = -1`. The constructor calls it for the whole field |
| `src/sim/reach.ts` | `isFree` skips colliders with `level.isShut(k)` |
| `src/sim/types.ts` | `Sim.barrier: { state: 'idle' \| 'wind' \| 'shut'; t: number; src: number }`; event `{ type: 'barrier'; phase: 'wind' \| 'shut' \| 'open' }` |
| `src/sim/barriers.ts` (new) | `updateBarriers(sim)`, called in `stepSim` after `updateThreats` (so it freezes in hitstop like everything else) |
| `src/sim/sim.ts` | Initial `barrier: { state: 'idle', t: 0, src: 0 }`, the call |
| `src/sim/threats.ts` | `THREAT_NAME`-style name for the death summary: „Neonschranke“ (pass as `by`) |

`updateBarriers`, in order:

1. No `level.barriers`: return. Owner = living `tuersteher` with `rage`. No owner or hero dead: if not idle, open (step 5) and go idle with `t = 0`; return.
2. `idle`: `t` counts down. At `t <= 0`, hero within `barNear` of a bar and owner farther than `barClear + radius` from every bar: state `wind`, `t = barWind`, `src = owner.id`, event `wind`, note „Kein Einlass!“ (`#ff4fa3`) at the owner.
3. `wind` → at 0, and only once the owner overlaps no bar (else hold at 0): for the hero, if `colliderDistance(bar, p.x, p.z) < PLAYER.radius` for any bar: `threatHit(sim, owner, owner.def.damage * owner.dmgMul * barDamage, barFloor, dx, dz, by)` with the direction away from the bar plane (roll frames and the 45 % cap hold). Then `level.shut` all five, `level.resolve` the hero and every living non-flying enemy once (nobody is drawn inside a bar), patch the flow field, state `shut`, `t = barTime`, event `shut`.
4. `shut` → at 0: open (step 5), state `idle`, `t = barEvery`.
5. Open: `level.open` all five, patch the flow field, event `open`.

Flow patch: for each bar, box = its bounds grown by clearance + one cell, colliders = `level.near` around it (copy the array or pass it straight through; `patch` must not call `near`). A new field built by `followFlow` while shut already contains the bars (`inBox` reads the hash).

Every hit goes through `threatHit` → `hurtPlayer`. Nothing in `src/sim` touches Three.js, DOM or `Math.random`.

## Render and sound

- `src/render/threats.ts` (`ThreatView`, pooled, unlit, `FX_LAYER`): read `sim.barrier` and `sim.level.barriers`.
  - Ground strip per passage: one instanced quad, pink `0xff4fa3`, alpha ramps up over the wind-up, stays while shut.
  - Bars: three horizontal tubes per passage at about 0.5, 1.2 and 1.9 m, one `InstancedMesh` (15 instances), additive, flicker on at `shut`, fade 0.2 s at `open`.
- Cost: 2 draw calls in the main pass while shown, 0 when idle; no lights (light count unchanged), no shadows, not in the normal/depth pre-pass. Both profiles.
- Look first: screenshot `?map=mitte&autostart&at=4&spawn=tuersteher` from the square. The bar planes face east and the camera looks north, so they read at an angle; if they are too thin on screen, thicken the tubes or add a crossed pair, not the collider. Routine work inside the neon look; no variants needed.
- Sound: reuse one existing synth cue on `shut` (the lock beep or crackle in `src/audio/sfx.ts`); no new voice.

## Unit tests

| File | Test |
|---|---|
| `level.test.ts` | `shut` → `near` finds it, `open` → gone; both idempotent; `restore` opens. Regression: shut, open, `remove` another collider, `restore` → the other is back, the bar is not in the level |
| `flowfield.test.ts` | After `patch` with a collider added, `blocked` equals a freshly built field; same after it is taken out; a cell under a second collider stays blocked; `setTarget` rebuilds after `patch` |
| `mitte.test.ts` | Five barriers at scale 1 and 1.3; each covers its opening from pier to pier at the bar plane (no gap a 0.3 m body fits through); none is in `level.colliders` after `mapLevel` |
| `barriers.test.ts` | No rage: never. Rage, hero far: never. Rage, hero near: `wind`, shut after 0.8 s, open after 4 s, not again within 9 s |
| | At shut, hero and a walker standing on the bar plane end outside every collider, on their own side, in the same step |
| | Hero on the strip takes exactly one hit (and at ten times the damage no more than the 45 % cap); a rolling hero none; a hero beside the strip none |
| | Boss killed while shut or winding: bars open in that step, `level.colliders` holds no bar, the passage is walkable |
| | Boss within `barClear` of a bar: the wind-up waits; boss standing in a bar at the end of the wind-up: the shut waits |
| | Shut bar stops an enemy shot and a hero projectile; open bar lets both pass |
| | `sim.flow.clearLine` across a bar: false while shut, true after open |
| | `reachGrid` first built while shut: passage cells are reachable |
| | A new `createSim` on the same `Level` after a run that ended shut starts open |

## Risks

| Risk | Handling |
|---|---|
| Bars hard to see from the south camera, or cut away with the Tor | Look check above before tuning anything else; row in `docs/tasks/pt-hardware-checks.md` (look, both profiles) |
| Rarely seen: place-bound to the west edge of the arena | Playtest row: "did the bars ever shut?"; the `bossAt` lever is Johannes' call |
| Pop when a body is pushed out (hero up to 0.67 m, walkers 0.59 m, larger kinds more) | The 0.8 s strip; the bar waits for the boss. A Brocken (0.5) or Boxenkopf in an outer mouth at scale 1 may need a few steps to settle against the house in front: check once with `?spawn=tuersteher,brute` |
| Hero locked out west for 4 s while the boss waits east | Accepted, self-healing; adds still reach him by the fallback walk or after the bars open |
| Bot walks into a bar | `node tools/balance.mjs --map=mitte` once, note the result |

## Finishing

Update in the same PR: `docs/enemy-pipeline.md` (Türsteher effect), `docs/backlog.md` (P25), `docs/tasks/wp5-enemies.md`, `docs/migration.md` queue, hardware-check and playtest rows. Handover says what came from 2D.

## Found on the way (not part of P25)

- `FlowField` construction costs about 40 ms at Pariser Platz and runs on every `focusFlow`: encounter start, each time the hero moves 12 m with enemies alive (`followFlow`), each broken crate in the window. Every free cell tests every collider of the window, with `cos`/`sin` per box. `patch` above gives breakables the cheap path too; the full build wants a per-cell hash lookup. Worth a backlog row and a hardware check.
- Pariser Platz houses and the Tor gate houses stand 1 m apart (x 7.5–8.5, 17.5–18.5, 37.5–38.5): bodies up to about 0.4 m radius squeeze through into the yards behind. Haus Liebermann and Haus Sommer also stand 1 m in front of the two outer Tor passages and cover about half of each mouth. Map question for `docs/maps/mitte.md`, not a P25 blocker.
- Weltzeituhr: its base colliders leave after the encounter's flow field is built and return without a rebuild; the field stays on the safe side (cells blocked), so nothing to fix.
