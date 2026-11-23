# B2 Economy, enemy roles and tunnel pacing [spec: Claude · Fable high; build: Claude · Opus high]

Status: steps 1 to 3 built (2026-11-22 and 23). Step 4 (heat) is P1b, waiting for Johannes' Tab S9 measurements. Built already in PR #57: Späti Schärfen and Panzerung (`SPATI_UPGRADE`: 2 levels, 3× the workshop price), "fürs Lager" hint on the Schrott count, trader shows item level.

## Handover step 3 (2026-11-23, Claude · Opus high; Johannes: bosses harder, no variants to pick, Opus is enough)
- Bosses: `BOSS_DMG_STEP` 0.4 → 0.7, new `BOSS_HP_STEP` 0.3 extra life per district step up to `BOSS_HP_STEPS` 3 (Köpenick unchanged); openers and the Dirigent +60 % base life (Grenzer 1500, Wurzel-Mutter 2900, Türsteher, Conférencier, Zugezogene 1600, Dirigent 2000); Spreehexe hit 34 → 27. Three variants compared with the bot (record in `docs/balance.md` › Bosses).
- Tunnel roles (`TUNNEL_ROLES`, `tunnelRoles` in `src/data/tunnel.ts`): count ×0.7, at most 7 alive, walkers halved, plus Hetzer, Zünder, Brocken and Schildträger in every normal tunnel wave. No new kind needed: the Brocken is the heavy line with a marked blow, the Schildträger the bulwark the hammer opens.
- Powers scale with weapon damage like basic attacks (`abilities.ts`); the tunnel one-shots came from the gear runaway fixed in step 2. No change.
- Fights never lock: `unstickStragglers` (director) moves the last three or fewer bodies of a fight next to the hero after 20 s without a hit (found: a walker in a pocket by the U2 West generator, a spitter in the Magendoktor bar channel).
- Camp prices ×1.8 (was 1.5) for E3. Leftovers: Müggelturm cut with its own lid, boss add fallback ring, the shared cut height decided (comment in `cut.ts`).
- Open for the playtest: one weak bot run needed 11 min for Sultan Nimmersatt; Charlottenburg and Wedding end with about 1500 Schrott.

## Handover step 2 (2026-11-23, Claude · Opus high)
- Targets E1 to E6 in Step 2 below; results in `docs/balance.md` › Economy calibration. E1, E4 met; E2, E6 nearly; E3 partly (1300 to 1500 left after the later districts); E5 (bosses) not, it goes to step 3.
- Economy: `shopLevel` in `src/sim/runcontent.ts` (2D `tradeLvl`, the missing minus district step was the power runaway), `ECONOMY` scrap 0.5, salvage 0.5 (new factor, also on the salvage button).
- Bot: run events (`eventGoal`: captive, cache, crate, zone), travel watchdog, stuck report names the enemies that hold the fight.
- Sim fixes found by the bot (all in the game too): `Level.restore` restores collider order, reach grid built at sim start, `holdGates`, separation capped at 0.3 m per step, boss adds need a clear line from the boss, sim box behind the tunnel train.
- Open: run n of one process can still depend on runs before it (a leak not found; the same command repeats exactly, which comparisons need). Alexanderplatz to Wedding end with 1300 to 1500 Schrott; raise level 3 prices or lower salvage further after Johannes' playtest.

## Handover step 1 (2026-11-22, Claude · Opus high)
- `src/bot/bot.ts`: rules of the table below as `SHOP`, `keepsItem`/`salvageSpare`, `wantsOffer`, `botCamp`/`campOffers`; the bot walks to unvisited Spätis and traders within 50 m, holds the generator ring, routes through tunnel gratings; every Schrott is booked in a `Ledger` (`CampaignReport.economy`). Tests in `src/bot/bot.test.ts`.
- `node tools/balance.mjs 3 normal johannes 1 --campaign`: new mode (not `--chain`, which keeps counting tunnels as cleared for comparison with older records): `CAMPAIGN` in `src/bot/run.ts`, ten maps with the four tunnels, Wedding directly after Charlottenburg. `--map=tunnel0..3` plays one tunnel.
- Baseline table and reading: `docs/balance.md` › Economy baseline. No balance number changed. 2D repo not needed (the 3D Späti, trader and camp code held the rules).
- Step 2 needs: Fable targets (Schrott left after Köpenick, camp levels per district, tunnel item level); then mainly the power runaway: shop stock rolls at worn item level + 2 (`runcontent.ts` Späti and `rollTrader`), so shopping compounds with the district loot step. Schrott is never short after Xhain (900 to 2800 left per map).
- Still open from P33 (`docs/backlog.md`): shrines, hidden blessings, run events, Umbau judgement, weapon by enemy class.
- Before step 2 compares numbers: chain runs are not fully reproducible from their seed (a replay of seed 203 differed from run 3 of the same campaign), and one campaign of three stalled at the U2-Tunnel West Zugwrack (361,-10). Find the non-determinism first, then the stall.

## Johannes' feedback
- Too much Schrott in Köpenick and too little to spend it on. Lower the drops a little and raise prices once the bot plays the economy.
- Tunnels after Köpenick are easy: a well-equipped hero one-shots everything with powers. Lots of enemies in little space, you just mow through them. Wanted: more variety, and some slower but stronger enemies so there is an order of play (kill the fast ones first, dodge the heavy blows, then take on the heavy ones).
- The tablet still gets hot after about 20 minutes (see `p1-heat.md`).

## Johannes' save after Köpenick and the S3 (cloud save, 2026-11-18)
| Resource | Held | Camp need (all four sites, all level 2, all level-1 upgrades, before this PR) |
|---|---|---|
| Schrott | 3699 | about 2700 |
| Stoff / Metall / Kabel / Chemie | 120 / 49 / 59 / 39 | about 30 / 25 / 25 / 10 |
| Fleisch / Gemüse / Gewürze | 30 / 6 / 8 | meals only |
| Item level worn | 9 to 19, bag up to 23 | |

Nothing was built (the camp opens after the S3). First correction in PR #57, `ECONOMY` in `src/data/progression.ts`: Schrott × 0.7, materials × 0.5, camp Schrott prices × 1.5. Bot after it: 3/3 Köpenick campaigns, 0 deaths, Hauptmann fight 58 % of life lost. A guess, not a calibration; step 2 replaces it.

## Step 1 Bot economy (B13 and more) [Opus high]
The bot in `src/bot/bot.ts` plays Köpenick only and does not trade. Teach it to:

| Behaviour | Rule (first guess, calibrate later) |
|---|---|
| Collect Schrott | Already picks up loot; count Schrott per encounter in the run log |
| Salvage | Salvage bag items it will not wear (lower item level than the worn piece and not legendary) |
| Trade | At a trader or Späti, buy an offer if its item level beats the worn piece by 2 or more and it leaves 30 % of the Schrott; buy Späti upgrades while the cap allows |
| Camp | Between expeditions: build the cheapest missing station, then upgrades by cost; Verband and Molotow to 2 |
| Powers | Spend points the way `abilities.ts` offers them (best card, as today) |
| Whole game | Köpenick → S3 tunnel → camp → next districts as far as they are built; one run log per map |

Output: `tools/balance.mjs --campaign` with a table per map: Schrott earned, spent (items, upgrades, camp), left over, item level at the end, deaths, clear time.

## Step 2 Calibration [targets: Claude · Opus high (Johannes, 2026-11-23: Opus is enough); numbers: Opus]
Targets (set 2026-11-23), checked with `node tools/balance.mjs 3 normal johannes 1 --campaign` (skill `johannes`, normal). The B10 rule in `docs/balance.md` › Rule still holds per district; these add the economy and the whole campaign.

| # | Target | Read in the campaign table |
|---|---|---|
| E1 | Shops never ratchet the gear: worn item level at a map's end within +3 of that map's drop level | Item level end vs the map's drop level (wave level + 3 per district) |
| E2 | Camp pacing: the four build sites (75 to 120 each, cheap on purpose, 2026-11-18) plus one or two station levels on the first camp visit after the S3, so 500 to 900 Schrott on arrival (Johannes held 3699) | "Left" after the S3-Tunnel |
| E3 | Schrott stays short: after every later map at most about 1200 left (one level 3 costs 825 to 975), and the camp is not fully built before Charlottenburg | "Left" per map; camp spend per step |
| E4 | Never frustrating: every campaign wins all ten maps; at most about 2 deaths in Köpenick and 1 per later map | Won, Deaths |
| E5 | Bosses stay a real fight in every district, not only Köpenick: district bosses take 25 % or more of the hero's life | Boss column of the run lines |
| E6 | Tunnels are not a walk: tunnel fights cost 15 % or more of life on average (step 3 adds the roles; step 2 only must not make them easier) | avg dmg on the tunnel lines |

Bot problems fixed first (2026-11-23): chain runs now repeat from their seed (`Level.restore` restores the collider order, each bot starts without an old distance field, the reach grid is built on the intact level at sim start), and closed gratings hold bodies crowded through them (`holdGates`, the U2 West stalls). Root cause of the power runaway: the Späti and the trader rolled stock at worn level + 2 without the 2D "minus the district step", so every district counted twice (`shopLevel`, port of 2D `tradeLvl`).

## Step 3 Enemy roles in the tunnel and later districts [Fable high: design; Opus: build]
Problem: the tunnel waves are Köpenick kinds in more numbers (+25 % life) in a narrow tube. Direction to design (show Johannes two variants first):
- A slow, heavy kind (brute line): slower walk, long telegraphed heavy blow that must be dodged, much more life, poise. Few per wave.
- Fast weak kinds stay as fodder and arrive first.
- Fewer bodies per wave in the tunnel, more kinds per wave; one "bulwark" type that blocks the tube.
- Check how much the powers (`src/data/powers.ts`) scale with item level; a one-shot of a whole pack at tunnel tier is a scaling issue, not only a wave issue.

## Step 4 Heat
Continue `p1-heat.md`: the largest open measure is P1b (proxy passes, about −50 % draw calls, `p1b-proxy-passes.md`). Johannes checks Akkusparen and `?shadows=boxes` on the Tab S9 first (rows in `pt-hardware-checks.md`). PR #57 added contour occluders (trees, tall props, tunnel walls); their cost shows only while something covers a character.
