# Balance

Numbers from the bot (`node tools/balance.mjs`, M14). Rerun after every balance change and replace the tables. The bot is not Johannes: it attacks without pause and never gets lost, so real clear times are longer; its skill is fitted to him after a full playtest (backlog B9).

## Economy baseline, whole campaign (B2 step 1, 2026-11-22)

The bot now plays the economy (rules in `docs/tasks/b2-economy-pacing.md` › Step 1, `SHOP` in `src/bot/bot.ts`) and the four tunnels. `node tools/balance.mjs 3 normal johannes 1 --campaign`, after the review fixes (one purchase per slot per shop, no routes through closed gratings): 3 campaigns, 12 min wall time; 2 won all ten maps, one stopped in the U2-Tunnel West at the Zugwrack fight (bot stuck at 361,-10; a replay of that chain from the same seed won both with and without the grating fix, so runs of a chain are not fully reproducible yet and the stall is rare). No balance numbers changed. Averages per map; "Camp before" is the camp step before that map (the camp opens with the S3), "Left" the Schrott at the map's end; "Earned" counts pickups, streaks and salvage.

| Map | Played | Won | Deaths | Min | Earned (salvage) | Items | Späti upgr. | Camp before | Left | Item level end (weapon) | Power end |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Köpenick | 3 | 3 | 0.3 | 16.7 | 1575 (439) | 640 | 444 | 0 | 491 | 13.3 (17) | 467 |
| S3-Tunnel | 3 | 3 | 0.0 | 6.3 | 851 (225) | 87 | 0 | 0 | 1256 | 13.2 (17) | 500 |
| Xhain | 3 | 3 | 0.0 | 13.3 | 1612 (547) | 380 | 0 | 1257 | 1230 | 17.1 (24) | 922 |
| U8-Tunnel | 3 | 3 | 0.0 | 6.8 | 1016 (273) | 0 | 0 | 1386 | 860 | 17.1 (24) | 941 |
| Alexanderplatz | 3 | 3 | 0.0 | 14.6 | 2294 (959) | 235 | 0 | 851 | 2069 | 16.3 (24) | 1725 |
| U2-Tunnel | 3 | 3 | 0.0 | 9.0 | 990 (174) | 0 | 0 | 1922 | 1136 | 16.3 (24) | 1526 |
| Mitte | 3 | 3 | 0.0 | 17.4 | 2231 (904) | 480 | 0 | 841 | 2046 | 22.3 (24) | 2473 |
| U2-Tunnel West | 3 | 2 | 0.0 | 10.2 | 975 (308) | 0 | 0 | 1763 | 1258 | 22.3 (24) | 2030 |
| Charlottenburg | 2 | 2 | 0.0 | 19.3 | 2464 (1140) | 1470 | 0 | 974 | 1532 | 51.3 (66) | 5520 |
| Wedding | 2 | 2 | 0.0 | 15.0 | 2450 (1446) | 1370 | 0 | 1081 | 1531 | 66.5 (99) | 6525 |

Before the review fixes (same command): 3 of 3 won, power at the end 9250, Mitte 4204; buying two offers for one slot inflated both spending and power.

**Read (for step 2):**
- Köpenick: the Späti upgrades (cap 2 + 2) and gear take two thirds of the Schrott; the hero reaches the camp with about 1300 (Johannes held 3699; the Späti upgrades came after his save). The first camp step spends all of it.
- Schrott is never short after Xhain: every map ends with 900 to 2800 left although the bot buys whatever its rules allow; salvage is a third to two thirds of the income and grows with the item level.
- Power runs away: about 470 after Köpenick, 1700 after Alexanderplatz, 6500 at the end (the `--chain` run of 2026-11-21 ended Mitte at 850). Spätis and traders roll stock at the worn item level + 2 (last offer + 4), so every shop the bot visits lifts its gear; with the district loot step (+3 item levels per district) this compounds.
- With carried gear nothing after Köpenick costs a death; tunnel fights cost 7 to 21 % life per fight (Schaffner 60 to 166 s).

## Wedding and the six-district chain (M18 step 2, 2026-11-21)

The chain now runs all six districts (`node tools/balance.mjs <runs> normal johannes <seed> --chain`). New `--carry` for one district: one hero plays the districts before it once, then every run starts with that gear (`--map=wedding --carry`). Fresh-gear runs say nothing about the later districts: a starter blade cannot hurt a tier 40 Zecher (3 runs, 0 kills, stuck at the Wochenmarkt).

**Bug found and fixed:** the bot stood still in a corner of the Magendoktor after the pub fight (2 of 3 Wedding runs and every chain stopped there). From a blocked cell it picked a neighbour behind the pub wall; it now takes only neighbours it can walk to in a straight line (`Nav.clear`, test in `src/bot/bot.test.ts`).

**Wedding, carried gear** (`3 normal johannes 1 --map=wedding --carry`, power about 1550 to 1850): 3 of 3 won, 0 deaths, 22.7 min per run.

| Fight | Time | Damage taken | Lowest life |
|---|---|---|---|
| Normal fights | 33 to 112 s | 0 to 25 % | 85 to 100 % |
| Der Zugezogene (with the pub's two waves) | 54 s | 28 % | 81 % |
| Das Hauptgericht | 43 s | 73 % | 47 % |
| Der Ewige Bauherr | 83 s | 117 % | 40 % |
| Sultan Nimmersatt | 111 s | 194 % | 40 % |

**Chains** (seed 11, two runs; seed 1, three runs before the bot fix): one chain won all six districts; Wedding there 0 deaths, 82 % damage per fight, bosses 75, 44, 181 and 207 s. One chain stopped in Xhain (12 deaths at the Spreehexe, power 558); the seed 1 chains won Köpenick to Charlottenburg and stopped at the pub bug.

**Tried and reverted:** the Sultan's Nachschlag with one Tee-Ifrit every 14 s instead of two every 12 s (his fight ran 111 to 341 s across heroes; the 341 s one was a fire hammer against his fire resistance): 106 s, but 2.7 deaths a run (fewer adds, fewer kills and heals).

**Read:**
- Wedding sits where the next district should: a little harder than Charlottenburg (lowest life 40 % at the last two bosses, against 61 to 100 % damage there), no deaths with carried gear.
- Still open for the B2/P33 decision: every district after Köpenick has no deaths with carried gear. Wedding's tier (40 to 62, W4) stays provisional with it.

## Realistic bot, first steps and district step (2026-11-21)

The bot now plays like Johannes (2D `tools/sim.js` v0.99 rules): blessings by economy need, build and recent danger, heal pickups, Späti shopping, and a camp step between districts. The chain counts each district's tunnel as cleared, so the camp opens after Köpenick.

**Before** (5 chains, `node tools/balance.mjs 5 normal johannes 1 --chain`): every chain won.
- Köpenick: 5, 5, 2, 7, 1 deaths (Riesenrad, Müggelturm).
- Xhain, Alexanderplatz, Mitte: 0 deaths in every chain, 11 to 32 % damage per fight, bosses often down in under 25 s.
- Power after the first camp step: about 330 to 630, then about 900 to 1300 by the end of Mitte.

**Changes:**
- First Köpenick run: novice damage factors (`NOVICE`, `src/sim/combat.ts`), items ×1.6 and Schrott ×1.3.
- Each district after Köpenick: enemy life +30 % and damage +25 % per step (`DISTRICT_STEP`). Bosses take 40 % of the damage step. Events, guards and tunnels (by their line) are included.

**After** (same command): 4 of 5 chains won.

| District | Deaths per chain | Avg damage per fight | Last boss |
|---|---|---|---|
| Köpenick | 3, 5, 3, 1, 1 | 50 to 72 % | 25 to 78 s, 70 to 236 % |
| Xhain | 0 | 14 to 47 % | 26 to 71 s, 38 to 191 % |
| Alexanderplatz | 0, 12 (stop at the Weltzeituhr), 0, 0, 0 | 19 to 44 % | 72 to 137 s, 65 to 123 % |
| Mitte | 0, 0, 0, 0 | 31 to 76 % | 74 to 326 s, 129 to 330 % |

**Read:**
- Later districts are no longer free.
- The one stop is a weak build (power 633) that the bot does not farm up after its deaths; a player would.
- Watch the Weltzeituhr and the long Mitte last boss (Bassprediger, up to 289 s).

## Fewer, tougher enemies (2026-11-21)

Johannes two-shot normal enemies after Xhain. From tier 10 waves have life ×(1 + 0.05 per tier) and count ÷(1 + 0.025 per tier) (`lateTier`, `src/data/enemies.ts`); meals about halved; tunnel item drops ×0.55. `node tools/balance.mjs 2 normal johannes 1 --chain`, run 1:

| District | Result | Min | Deaths | Power | Avg damage per fight |
|---|---|---|---|---|---|
| Köpenick | win | 26.7 | 2 | 33 → 223 | 97 % |
| Xhain | win | 14.4 | 0 | 190 → 353 | 53 % |
| Alexanderplatz | win | 20.3 | 0 | 282 → 528 | 72 % |
| Mitte | win | 20.3 | 0 | 517 → 850 | 32 % |

## Playtest follow-up (2026-11-20, Codex · GPT-6)

`node tools/balance.mjs 1 normal johannes 1`: 1/1 Köpenick campaigns won, 4 deaths, 33.0 simulated minutes, 831 kills, final power 249 (blade). This includes PR #73's doubled normal-enemy life, halved equipment drops, slower swings and weaker blessings, plus basic attacks −10% damage and powers/ultimates/Molotow +25%. One seed checks completion; B9/B10 calibration and the hardware playtest remain open.

| Encounter | Deaths | Time s | Damage taken | Lowest life | Power |
|---|---|---|---|---|---|
| Bahnhofsvorplatz | 0 | 34 | 13 % | 87 % | 33 |
| Lindenstraße | 0 | 44 | 28 % | 86 % | 33 |
| Forum | 0 | 71 | 74 % | 45 % | 43 |
| ★ Dammbrücke | 0 | 47 | 103 % | 65 % | 64 |
| Kietz | 0 | 29 | 23 % | 84 % | 135 |
| Müggelheimer Straße | 0 | 41 | 27 % | 78 % | 135 |
| Teufelssee | 0 | 47 | 67 % | 62 % | 135 |
| ★ Müggelturm | 2 | 23 | 49 % | 52 % | 135 |
| Fähre Grünau | 0 | 46 | 45 % | 75 % | 192 |
| Flugfeld Johannisthal | 0 | 53 | 67 % | 71 % | 215 |
| Dino-Wiese | 0 | 55 | 34 % | 90 % | 245 |
| ★ Riesenrad | 2 | 34 | 121 % | 7 % | 245 |
| ★ Rathausplatz | 0 | 59 | 147 % | 6 % | 249 |

## Rule

| Target (B10) | Check in the table |
|---|---|
| Never frustrating | Skill `johannes`: every campaign won, no encounter above about 2 deaths per run |
| Early waves need care, later ones feel easier relative to the hero | Damage taken in normal fights falls from zone 1 to zone 3 |
| Bosses stay a real fight | Bosses: lowest life near or under 50 %, 25 s or more |

## Before the pass (2026-11-17, old numbers)

Six campaigns, skill `johannes`: all won, 0 deaths, about 8 min each. Bosses fell in 9 to 12 s, lowest life 85 to 95 %. Hero power grows from 33 to about 230 over the map while enemy life grew ×1.76: far too easy, as the playtest of the same day said.

## Changes

| What | Before | After |
|---|---|---|
| Normal waves | 20 | 27 |
| Enemy life over the waves (`waveTier`) | ×1.0 → ×1.76 | ×1.0 → ×3.47 |
| Enemy damage over the waves | ×1.0 → ×1.48 | ×1.0 → ×2.14 |
| Boss life: Feldwebel, Turmwächter, Rex, Hauptmann | 380, 620, 900, 1300 | 900, 2000, 3600, 4400 |
| Boss and elite cooldowns | Ran only while walking (specials rare) | Run always |
| Roster | Three types, bosses strike only | M12 |

## Johannes' first full run (telemetry, 2026-11-16, PC, pad, old roster and numbers)

Won without a death in 29.6 min, 240 kills. Damage taken over the whole map: about one life bar (105), zero in 8 of 13 fights. Fights took 13 to 51 s, about 1.4 times the bot's time. The bot with the 2D start values (30 % of telegraphs missed) took 10 to 20 % in nearly every fight, so it was fitted: `SKILL_DEFAULT` is now 12 % missed, 0.2 to 0.35 s reaction, attacking 70 % of the time. One run against three enemy types: refit after the next playtest.

## After the pass (2026-11-17, Normal, seed 1, 27 waves, fitted skill)

Skill `johannes`, six campaigns: all won, 1.2 deaths and 17.2 min per campaign (0 to 2 deaths per run).

| Encounter | Deaths per run | Time s | Damage taken | Lowest life | Power |
|---|---|---|---|---|---|
| Bahnhofsvorplatz | 0.0 | 27 | 3 % | 97 % | 36 |
| Lindenstraße | 0.0 | 36 | 15 % | 85 % | 39 |
| Forum | 0.0 | 39 | 27 % | 78 % | 46 |
| ★ Dammbrücke (Feldwebel) | 0.5 | 34 | 60 % | 52 % | 52 |
| Kietz | 0.0 | 39 | 31 % | 85 % | 96 |
| Müggelheimer Straße | 0.0 | 42 | 29 % | 87 % | 108 |
| Teufelssee | 0.0 | 40 | 27 % | 87 % | 166 |
| ★ Müggelturm (Turmwächter) | 0.7 | 24 | 59 % | 52 % | 184 |
| Fähre Grünau | 0.0 | 41 | 24 % | 88 % | 209 |
| Flugfeld Johannisthal | 0.0 | 43 | 23 % | 91 % | 230 |
| Dino-Wiese | 0.0 | 44 | 21 % | 92 % | 271 |
| ★ Riesenrad (Rex) | 0.0 | 38 | 88 % | 56 % | 288 |
| ★ Rathausplatz (Hauptmann) | 0.0 | 37 | 51 % | 73 % | 317 |

Damage taken is the winning try, as a share of max life (healing during the fight lets it pass the lowest life). Skills `good` and `weak` were not rerun on these numbers.

## Findings

- Bosses are the fights now; Feldwebel and Turmwächter cost a try in about every second run, Rex takes the most life.
- Normal fights cost 20 to 30 % of life in every zone and fall slightly toward zone 3: the hero outgrows them a little, as B10 wants. If the playtest still reads as too easy, raise zone 3 pressure first (more alive at once, more elites) rather than more life.
- The first fight costs almost nothing. That is the gentle start B5 asked for; check that it is not dull.
- Power grows about eightfold over one district. With six districts planned this needs a decision before M15 (2D finding: Mitte wall, late snowball).

## Xhain first run (M15, 2026-11-18)

`node tools/balance.mjs 3 normal johannes 1 --map=xhain`, fresh gear (the bot does not carry Köpenick gear yet): 2 of 3 campaigns won, 4.0 deaths and 17.3 min per campaign; all deaths at the Spreehexe (one run, spear build, 127 % damage taken there). The other twelve fights: no deaths, 18 to 77 % damage taken. Read: from fresh gear Xhain plays like Köpenick with a harder final boss, so a hero who arrives with Köpenick gear (power about 400) will find the first zone easy. Calibrate after Johannes' playtest: a bot start with carried gear, then `XHAIN_TIER` in `src/data/xhain.ts` or the Spreehexe's life.

## Alexanderplatz with its own enemies (M15 step 7, 2026-11-18)

`node tools/balance.mjs 3 normal johannes 1 --map=alex`, fresh gear, district roster and bosses: 3 of 3 campaigns won, 1.7 deaths and 19.7 min per campaign (was 5.7 deaths with the stand-ins). Deaths only at the Lustgarten (1.7 per run, tier 16 against fresh gear). Bosses: Wurzel-Mutter 38 s, 52 % damage taken; Großer Uhrwerkläufer 36 s, 29 %; Volkseigener Koloss 38 s, 55 %; Weltzeituhr 53 s, 55 % (lowest life 62 to 93 %). Read: the bosses fall fast against the bot's power curve; the shield bearers cost time, not life. Calibrate `ALEX_TIER` and boss life with a carried-gear start after Johannes' playtest. The bot now steps out of hour sectors, rolls through the minute hand and walks round shield bearers; Köpenick and Xhain runs are unchanged (those threats do not occur there).

## Alexanderplatz first run (M15, 2026-11-18)

`node tools/balance.mjs 3 normal johannes 1 --map=alex`, fresh gear, stand-in bosses (Rattenmutter, Turmwächter, Brandmeister, Hauptmann) and the old roster: 3 of 3 campaigns won, 5.7 deaths and 25.0 min per campaign. Deaths sit at the Lustgarten (4.3 per run: tier 16 against fresh gear) and the first boss (1.3); the rest is easy (17 to 35 % damage taken). Read: a hero arriving with Xhain gear finds the district too easy until its own enemies and bosses exist; calibrate `ALEX_TIER` after step 7 with a carried-gear start. A first run stopped for good at the Kino International: the Plattenbau side passage ran into its footprint (fixed, test added).

## Mitte with its own enemies (M15 step 8, 2026-11-19)

`node tools/balance.mjs 3 normal johannes 1 --map=mitte`, fresh gear, district roster and bosses: 3 of 3 campaigns won, 2.3 deaths and 20.3 min per campaign. Deaths at the Leipziger Straße (2.0 per run, 167 % damage taken: tier 24 against fresh gear, as the Alex Lustgarten) and the Friedrichstraße (0.3). Bosses: Türsteher 14 s, 26 %; Wachdrohne 36 s, 26 %; Dirigent 13 s, 27 %; Bassprediger 28 s, 21 %. Read: same shape as the Alex: a hard opening against fresh gear, then too easy. `MITTE_TIER` stays 24 … 46 until the P33 decision (tier against carried power).

Chain rerun (`--chain`, 2026-11-19, same seed): 3 of 3 chains won all four districts; Mitte with carried gear (power 395 to 641 in): 0 deaths, 9 to 17 % damage per fight, bosses 7 to 36 s. P33 still stands.

Tunnels (no bot run, the bot plays no tunnels): each line starts at the late tier of its start district, S3 14 … 19, U8 25 … 30 (was 14 … 19), U2 33 … 38.

## District chain with carried gear (2026-11-18)

`node tools/balance.mjs 3 normal johannes 1 --chain`: one hero plays Köpenick, Xhain, Alexanderplatz and Mitte in order; gear, Schrott and camp carry over (tunnels between the districts and the bot's missing systems, backlog P33, are not played).

| District | Won | Deaths per run | Min | Power start → end | Avg damage per fight | Bosses (time / damage) |
|---|---|---|---|---|---|---|
| Köpenick | 3/3 | 2.0 | 19.5 | 33 → 214 to 516 | 27 to 58 % | 22 to 74 s, 16 to 200 % |
| Xhain | 2/3 (one stuck, see below) | 0 | 10.9 | 192 to 342 → 263 to 679 | 7 to 14 % | 7 to 30 s, 0 to 43 % |
| Alexanderplatz | 2/2 | 0 | 11.7 | 464 to 610 → 921 to 1086 | 7 to 8 % | 9 to 53 s, 5 to 20 % |
| Mitte | 2/2 | 0 | 12.1 | 683 to 872 → 1083 to 1255 | 7 to 8 % | 7 to 23 s, 0 to 11 % |

Read:
- Köpenick is the only real challenge. With carried gear every later district is far too easy: no deaths, fights cost under 15 % life, bosses fall in seconds. Power keeps growing (×3 to ×4 per district), the district tiers were set against fresh gear.
- Fix direction (decide in the balance session, P33): scale each district's tier to the power a hero brings (about 200 to 500 into Xhain, 600 into Alexanderplatz, 700 to 900 into Mitte), and slow the power growth itself (item level per district, fewer upgrades), so B10 holds over the chain.
- Run 1 stopped in Xhain after one boss and 180 sim minutes with 0 deaths: a Ratte spawned into a Hinterhof pocket boxed in by props, so the fight never ended. Fixed in PR 55 (wave and pack spawns only on reachable ground; the bot also stops a fight with no hit for three minutes). The same seed now wins Xhain in 11 min.
