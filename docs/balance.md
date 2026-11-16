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
| Enemy life over the 20 waves (`waveTier`) | ×1.0 → ×1.76 | ×1.0 → ×3.47 |
| Enemy damage over the 20 waves | ×1.0 → ×1.48 | ×1.0 → ×2.14 |
| Boss life: Feldwebel, Turmwächter, Rex, Hauptmann | 380, 620, 900, 1300 | 900, 2000, 3600, 4400 |
| Boss and elite cooldowns | Ran only while walking (specials rare) | Run always |
| Roster | Three types, bosses strike only | M12 |

## After the pass (2026-11-17, Normal, seed 1)

| Skill | Campaigns won | Deaths per campaign | Minutes per campaign |
|---|---|---|---|
| good (10 % missed, 0.18 to 0.3 s) | 4/4 | 1.3 | 15.9 |
| johannes (30 % missed, 0.25 to 0.5 s) | 6/6 | 3.3 | 19.3 |
| weak (50 % missed, 0.35 to 0.7 s) | 4/4 | 3.8 | 21.7 |

Skill `johannes`, six campaigns:

| Encounter | Deaths per run | Time s | Damage taken | Lowest life | Power |
|---|---|---|---|---|---|
| Bahnhofsvorplatz | 0.0 | 17 | 0 % | 100 % | 36 |
| Lindenstraße | 0.0 | 18 | 3 % | 97 % | 39 |
| Forum | 0.0 | 25 | 33 % | 74 % | 47 |
| ★ Dammbrücke (Feldwebel) | 0.3 | 27 | 56 % | 61 % | 50 |
| Kietz | 0.0 | 23 | 21 % | 84 % | 83 |
| Müggelheimer Straße | 0.0 | 24 | 16 % | 89 % | 99 |
| Teufelssee | 0.0 | 39 | 41 % | 78 % | 117 |
| ★ Müggelturm (Turmwächter) | 1.3 | 24 | 64 % | 47 % | 143 |
| Fähre Grünau | 0.2 | 21 | 10 % | 92 % | 199 |
| Flugfeld Johannisthal | 0.0 | 23 | 14 % | 88 % | 211 |
| Dino-Wiese | 0.0 | 38 | 16 % | 90 % | 237 |
| ★ Riesenrad (Rex) | 1.5 | 27 | 74 % | 43 % | 243 |
| ★ Rathausplatz (Hauptmann) | 0.0 | 32 | 75 % | 50 % | 264 |

Damage taken is the winning try, as a share of max life (above 100 % means healing during the fight).

## Findings

- Bosses are the fights now; Turmwächter and Rex cost one to two tries each. Deaths vary a lot between runs (0 to 8) with the gear that dropped.
- Normal fights in zone 3 are light (10 to 16 % damage): the hero outgrows them. If the playtest still reads as too easy, raise zone 3 pressure first (more alive at once, more elites) rather than more life.
- The first two fights cost nothing. That is the gentle start B5 asked for; check that it is not dull.
- Power grows about eightfold over one district. With six districts planned this needs a decision before M15 (2D finding: Mitte wall, late snowball).
