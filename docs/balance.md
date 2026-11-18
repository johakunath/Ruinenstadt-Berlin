# Balance

Numbers from the bot (`node tools/balance.mjs`, M14). Rerun after every balance change and replace the tables. The bot is not Johannes: it attacks without pause and never gets lost, so real clear times are longer; its skill is fitted to him after a full playtest (backlog B9).

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
