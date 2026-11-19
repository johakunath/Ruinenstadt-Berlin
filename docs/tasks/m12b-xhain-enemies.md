# M12b Xhain roster: Ratte and four bosses [Claude · Opus high]

Status: built 2026-11-18 (parallel to the Xhain map session). Johannes playtest open.

## Handover
- Data `src/data/enemies.ts` (`ENEMIES.rat`, four boss defs, `BOSS.grenzer|brandmeister|rattenmutter|spreehexe`), brains `src/sim/ai.ts` (`passive` for ground work that runs in every state), packs `spawnPack` in `src/sim/enemies.ts`, Molotov/pool landing `Zone.leave` in `src/sim/threats.ts`, bodies `src/render/enemies.ts`, Kodex `src/ui/menu.ts`, voices `src/audio/sfx.ts`, loot `src/sim/loot.ts`. Tests: `ai.test.ts` › Xhain roster, `director.test.ts`, `loot.test.ts`.
- Reused from 2D: rat stats, resistances, zig-zag (heading ±0.6 rad at 7 Hz), pack of five, no elites, drops (8 % material, 3 % item factor, 1 % ingredient, no scrap); Rattenmutter (five rats every 3.8 s, 2.6 s in rage, acid trail 0.5 s / 24 px / 4 s / 0.3 hit); Spreehexe (acid pool every 2.2 s, 26 px, 5 s, 0.4 hit; ring at 0.6 rate); Kodex busts E04, X05, X06; resistance rows `rat`, `volk` (Grenzer), `brand`, `ratten`, `hexe`.
- New for 3D: rat body in code (six small meshes, shared geometry, run cycle from time); Grenzer kit (barrage „Feuerstoß“, five-shot volley, „Alarm!“ two Hetzer, keeps 5.5–9 m); Brandmeister kit (three Molotov circles that leave fire, ring of twelve, flame burst under 3 m); Spreewelle (roar block, two rings, in rage three rats per wave); the Spreehexe pool is marked 0.8 s before it lands.
- **Wave count (map session):** a mix weight of `rat` spawns a whole pack for ONE unit of `count`; the pack takes five `maxAlive` slots. Endless mode and `?spawn=rat` spawn packs too. `bossWave` needs no change; boss adds come from the wave mix as before.

## Numbers
| Kind | Life | Hit | Specials (cooldown s) | Rage |
|---|---|---|---|---|
| Ratte | 9 | 5 | zig-zag, bite; speed 3.5, radius 0.24 | – |
| Der Grenzer | 950 | 24 | summon 9, barrage 5.5 (3 extra), volley 3.4 | +2 circles |
| Der Brandmeister | 2100 | 30 | molotov 4.6, ring 6.5, flame 4 (close) | +1 bottle |
| Die Rattenmutter | 3200 | 32 | rats 3.8, slam 4.2, acid trail | rats 2.6 |
| Die Spreehexe | 4400 | 34 | pool 2.2, wave 8, ring 8.3, slam 3.6 | 3 rats per wave |

All bosses: rage below 50 % (speed ×1.3, cooldowns ×1.35); every hit through `threatHit`/`hurtPlayer`, so the 45 % cap holds (tested at ten times the damage).

## Open points
- Bodies are placeholders on the zombie rig (H2). The Kodex now uses painted Grenzer and punk Spreehexe portraits.
- `ENDLESS_BOSSES` in `director.ts` still lists the Köpenick bosses; it should follow the district.
- Rats count against `BOSS.summon.maxAdds` (8) one by one, so a second Rattenmutter pack is partial.
- Not rerun: balance bot (no Xhain map in it yet), hardware cost (six draws per rat, no lights).
- Check: `?map=hof&spawn=rat,grenzer`; `node tools/enemy-sheet.mjs out.png "kind=rat&speed=3.5&n=4&size=0.35"`.
