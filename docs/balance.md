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
