# B2 Economy, enemy roles and tunnel pacing [spec: Claude · Fable high; build: Claude · Opus high]

Status: open (Johannes, playtest 2026-11-18). Built already in PR #57: Späti Schärfen and Panzerung (`SPATI_UPGRADE`: 2 levels, 3× the workshop price), "fürs Lager" hint on the Schrott count, trader shows item level.

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

## Step 2 Calibration [Fable high: targets; Opus: numbers]
Targets to set first (Fable): how much Schrott should be left at the end of Köpenick (proposal: enough for 2 of the 4 build sites), how many camp levels after each district, and at which item level the tunnel stops being a challenge. Then tune with the bot: `scrapFactor` and drop amounts down, Späti and camp prices up, until the table meets the targets. Rerun and compare with `docs/balance.md`.

## Step 3 Enemy roles in the tunnel and later districts [Fable high: design; Opus: build]
Problem: the tunnel waves are Köpenick kinds in more numbers (+25 % life) in a narrow tube. Direction to design (show Johannes two variants first):
- A slow, heavy kind (brute line): slower walk, long telegraphed heavy blow that must be dodged, much more life, poise. Few per wave.
- Fast weak kinds stay as fodder and arrive first.
- Fewer bodies per wave in the tunnel, more kinds per wave; one "bulwark" type that blocks the tube.
- Check how much the powers (`src/data/powers.ts`) scale with item level; a one-shot of a whole pack at tunnel tier is a scaling issue, not only a wave issue.

## Step 4 Heat
Continue `p1-heat.md`: the largest open measure is P1b (proxy passes, about −50 % draw calls, `p1b-proxy-passes.md`). Johannes checks Akkusparen and `?shadows=boxes` on the Tab S9 first (rows in `pt-hardware-checks.md`). PR #57 added contour occluders (trees, tall props, tunnel walls); their cost shows only while something covers a character.
