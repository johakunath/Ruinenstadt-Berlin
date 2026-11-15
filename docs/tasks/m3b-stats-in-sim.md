# M3b Stats in the simulation [Codex]

Status: implemented (PR pending). Assigned by Johannes in chat (2026-11-15).

## Goal

Connect M3a gear stats to the current 3D combat, preserving the starter's damage, life, movement and dodge scale. Equipped gear must change real combat and the HUD.

## Source and target

- Source: `src/sim/stats.ts`, M3a; 2D `js/state.js` stats/refresh and `js/combat.js` crit/resistance behavior (read only).
- Target: `src/sim/loadout.ts`, `types.ts`, `player.ts`, `sim.ts`, `director.ts`; render attack timing, HUD max HP, sim and browser tests.

## Steps and scaling

1. Sim owns equipment, explicit StatContext and cached HeroStats. Start with a plain pipe (value 10), no upgrades or perks. `setLoadout` refreshes stats, preserves the living hero's HP fraction, never revives a corpse, and snapshots caller data.
2. Damage = attack's existing damage × heroStats.damage / 10. Life and healing retain the 100-HP scale. Move speed = current 6.2 m/s × moveSpeed. Dodge cooldown = current .28 s × dashCooldown / 1.4. Crit is a seeded 2× roll once per swing.
3. Snapshot attack phases, damage, crit and reach at swing start. Divide windup, active, recovery and chain gap by attackSpeed; keep animation, smear and hitbox timing aligned. Mid-swing equipment changes affect the next swing.
4. Incoming damage = enemy damage × (1 − res), capped afterwards at 45% equipped max HP. Regen and flat gear leech heal up to that max; encounter healing and HUD use it too.
5. Preserve equipment/context on retry. Expose a loadout setter through the existing dev hook for browser verification; no new player-facing menus.
6. Unit tests cover loadout isolation, combat damage/crit/resist/cap, speed/timing, hitstop, healing, refresh and dead state. `npm run check`, build, then e2e once; screenshot at 1280×720.

## Not in scope

Inventory/equipment UI and loot (M4/M5), new weapon moves (M7), elemental procs, powers and non-stat perk/mod mechanics (M8), camp UI or balance retuning. Existing visuals remain the reference.

## Questions

None. The starter gains M3a's 8% base crit; attack multipliers and other base tuning remain unchanged.

## Handover

- Sim owns cloned equipment/context and cached stats; `setLoadout` atomically refreshes HP without resurrection.
- Existing attack damage ratios, 6.2 m/s movement and .28 s dodge gap retained at starter stats; base crit is 8%.
- Swing snapshots keep damage/crit/phase timing/reach stable across mid-swing gear changes; render clips and smear follow them.
- Resistance precedes the equipped-max-HP 45% cap; regen, leech and encounter healing use that max.
- HUD watches both HP and max HP; retries retain the loadout/context; dev hook verifies equip until M5.
- Elemental procs, powers and extra perk/mod mechanics stay with M8; no inventory UI or balance pass.
- `npm run check`: 174 tests, type check and build passed. Browser evidence recorded in the PR.
