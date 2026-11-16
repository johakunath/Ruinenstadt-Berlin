# M12 Enemy roster, elites and boss attacks [Fable 5.2]

Status: done (2026-11-17, PR after #18). Johannes playtest open.

## Handover
- Roster: Schlurfer, Hetzer, Brocken (marks a circle), Speier (keeps distance, spits), Raptor (pounces along a line), Krähe (circles, dives, sits dazed). Four elite modifiers, four bosses with own specials. Data `src/data/enemies.ts` (`ENEMIES`, `THREAT`, `BOSS`), brains `src/sim/ai.ts`, what they put into the world `src/sim/threats.ts`, bodies `src/render/enemies.ts`, ground marks `src/render/threats.ts`.
- Reused from 2D (`js/combat.js` `mkEnemy`, `js/update.js` enemy block, `js/data.js` `RES`, `TACO`, `EMN`): role ratios, all distances and timings at 30 px per meter, elite tactics, punish window (+30 % damage taken), boss patterns (slam, shot ring, summon, charge, bass rings, bombing run), rage below half life, telegraph floors (`bigHit`), resistances, elite chance, loot by role.
- New for 3D: bodies and animation, a short wind-up before a spit and a dive, bosses finish a marked special (hits do not cancel it), the Feldwebel and Turmwächter kits (2D had one mini boss).
- Models: raptor and Rex are the Quaternius CC0 dinosaurs, repainted in `tools/build-creatures.mjs`; crow, uniforms, helmets, lantern and the spitter's throat are built in code on the zombie body. H2 (PC) can replace any body without touching the sim.
- Found on the way: boss and elite cooldowns must tick in every state (`tickCooldowns`), or a boss in melee never uses a special.
- Not done: per-type hints (2D `tip`), Kodex entries, boss voices (S3), dinosaurs as lot dressing. Hardware cost of the new effects is unmeasured (pooled, unlit, no lights).

## Types and the answer each wants

| Type | From wave | Does | Answer |
|---|---|---|---|
| Schlurfer | 1 | Walks up, strikes | Crowd control |
| Hetzer | 2 | Fast, weak | Kill first, or it flanks |
| Speier | 4 | Backs off, strafes, spits every 2.3 to 3.1 s. Acid immune, weak to shock | Close in; a hit cancels the spit |
| Brocken | 5 | Marks a circle on you (0.95 s), then stands open 1 s | Step out, punish |
| Krähe | Müggelberge | Circles out of reach, dives, sits 1.3 s | Dodge the dive, hit it on the ground |
| Raptor | Spreepark | Pounce along a red line (0.6 s), open 0.8 s | Sidestep, punish |
| Elite Flink / Brennend / Spaltend / Gepanzert | 4, up to 22 % | Lunge / fire trail and flame ring / three globs, splits on death / half damage until its stomp | Each opens after its special |

## Bosses

| Boss | Specials | Rage below 50 % |
|---|---|---|
| Der Feldwebel | Charge along a line, „Antreten!“ calls three Schlurfer | Faster, cooldowns ×1.35 |
| Der Turmwächter | Barrage of marked circles, ring of twelve shots, slam | Two more circles |
| Der Rex | Bite, charge, roar (two rings to roll through, drives the pack, raptors every third), tail sweep | Charges more often |
| Hauptmann von Köpenick | Slam, ring of sixteen shots, calls his men | Hetzer instead of Schlurfer |

## Check it
`?map=hof&spawn=rex,raptor,crow,walker+brennend` puts kinds next to the hero. `node tools/enemy-sheet.mjs out.png "kind=rex&state=windup"` renders poses (dev server running). Tests: `src/sim/ai.test.ts`.
