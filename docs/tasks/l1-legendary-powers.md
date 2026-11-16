# L1 Legendary item powers [Fable 5.2 or Opus 5.5 high]

Status: done (PR #18). Gameplay task: every power touches the combat rules.

## Handover
- All 18 powers have a rule and a test (`src/sim/legendary.test.ts`); `hasL(sim, id)` in `src/sim/combat.ts`, the list in `HeroStats.legendary`.
- Reused: shock rings, `chain`, `ignite`, projectiles. New enemy status `slow` (60 % speed) for Krähenfeder.
- 3D mapping: Schaffnerkelle takes 0.5/1.4 of the dodge cooldown per kill; Siegessäule and Ring shots are drawn as nail and stone (no own models).
- Not playtested; no own effects beyond the shared rings, bolts and flames.

## Goal
Each legendary item's power works as in 2D. Today the card shows the text (`LEGENDARY_POWERS` in `src/data/items.ts`) and nothing happens.

## Source (2D, read only)
`hasL('<id>')` call sites: `js/combat.js` (`attack`: siegsp, mauer; `hit`: auge, kiezbox, turm, bassarm; `kill`: pickel, schaffner, zitklinge, pbrecher; `hurt`: panzer, rattenmantel, herz; `dash`: weltuhr; `breakProp`: spaeti), `js/update.js` (ritter, kraehe, ring), `js/state.js` (stat-only powers). List every id with `grep -o "hasL('[a-z]*')" js/*.js | sort -u`.

## Target
`src/sim/combat.ts` (`strike`, `killEnemy`, `hurtPlayer`), `src/sim/abilities.ts` (shots, shock rings, dodge), `src/sim/player.ts` (`releaseSwing`), `src/sim/stats.ts` (a `legendary: Set<LegendaryId>` in `HeroStats`, from the equipped items), tests in `src/sim/legendary.test.ts`.

## Rules
- One helper `hasL(sim, id)`; no power code outside the sim.
- Reuse what exists: shock rings (`shock`), chains (`chain`), ignite, fire fields, projectiles. Distances at 30 px per meter (`PX` in `src/data/powers.ts`).
- Powers that need enemy features not in 3D yet (slow, shield break) get the rule now and a note; no invented substitute.
- One unit test per power. A power that cannot be built yet is listed in the handover, and its card text stays.

## Done when
Every id has a rule and a test or a written reason; `npm run check`; a short playtest list for Johannes (which item shows which power).
