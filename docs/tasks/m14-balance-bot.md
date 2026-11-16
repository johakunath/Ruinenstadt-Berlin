# M14 Balance bot [Fable 5.2]

Status: built (2026-11-17). Calibration to Johannes (B9) waits for telemetry from a full playtest.

## Handover
- `src/bot/bot.ts`: a bot that plays the sim through `SimInput` (no browser): route finding over the walk grid with the ferry, fights, leaves marked zones, sidesteps shots and rush lines, rolls through roar rings, loots, wears upgrades by Kampfkraft, takes the best blessing card, rests in a Späti, uses Verband, retries at the zone start after a death.
- `node tools/balance.mjs [runs] [difficulty] [johannes|good|weak] [seed] [--miss=] [--react=] [--at=] [--until=]`: whole Köpenick campaigns, about 20 to 40 s each. Results and the rule to rerun: `docs/balance.md`.
- Reused from 2D `tools/sim.js`: the skill model (share of telegraphs missed, reaction time 0.25 to 0.5 s), heal seeking, giving up on unreachable loot after 6 s, power and ultimate rules. Not ported: camp management, trading, weapon class switching by rule (the bot wears whatever has more Kampfkraft), meals.
- First findings are in `docs/balance.md`; the wave and boss numbers were retuned with it.

## Open
- B9: fit `miss`, `react`, `dodgeMelee` to Johannes' runs (compare damage per encounter and lowest life from the "Telemetrie" sheet with the bot table).
- B13: the bot does not trade.
- The bot attacks without pause and never gets lost; real clear times will be longer.
