# Vision

Carried over from the 2D game `johakunath/Ruinenstadt` (`BACKLOG.md` › Intent and design decisions) on 2026-11-15, trimmed to what holds in 3D. Story: `docs/story.md`. Art: `docs/style-bible.md`.

## Intent

| Topic | Rule |
|---|---|
| Fantasy | A survivor reclaims Berlin district by district and grows visibly stronger through loot |
| Pillars | Satisfying combat feel, loot worth reading, a reason for one more run |
| Difficulty | Fun first, but big attacks must be dodged. Köpenick gentle, from Mitte on one death per district is normal on Normal. Hard mode opt-in. Newcomers get an easier start (backlog B5) |
| Session | 5 to 15 minutes. Devices: PC with controller, Galaxy Tab S9, Xiaomi phone; later Steam Deck |
| Inspirations | Hades (dash, weapon = playstyle, boons, feel), Diablo 2/3 (loot, acts), V Rising (boss-gated unlocks, base), Valheim (weak to strong), Enshrouded (authored points of interest) |
| UI text | German, a few words or one line. Details behind a tooltip or in the Kodex |
| Out of scope | Multiplayer, hunger as a timer, dialogue trees |

## Design decisions kept from the 2D game

| Topic | Decision |
|---|---|
| Pace | Fast fodder, smart elites: telegraphs and punish windows, calm phases between waves, safe rooms |
| Builds | Mixed model: weapon, power and meal chosen before the run (Hades); gear anytime (Diablo). Weapon = class, blessings (Zeitsplitter) stack into strong builds |
| Powers | Regular power chosen per weapon, ultimate always equipped on its own button |
| Item level | Shown level = item level (+3 per district) plus a rarity bonus (white 0, magic +3, rare and set +6, legendary +10) |
| Damage fairness | No single hit takes more than 45 % of max life (already in the 3D sim) |
| Structure | Districts of 2 to 3 zones, U-Bahn lines as progression and fast travel, a walkable camp in a station. In 3D the player walks through a zone and fights at fixed places (encounters) instead of standing in one arena |
| Progression in a run | Through items and blessings. No XP levels for now (2D #45 still open) |
| Story | Light: artefacts, tapes, plaques, one line per NPC |

## New in 3D (Johannes, 2026-11-15)

| Topic | Direction |
|---|---|
| Look | One look (`src/render/looks.ts`): painted PBR shading, thin ink line, saturated color. District palettes vary on top (dark green Köpenick, saturated neon Mitte, saturated GDR Alexanderplatz) |
| Maps | Rebuilt, not ported. Each district is a mini open world: real geography (landmarks, rivers, bridges, main streets in their real relative positions), miniaturized so distances are much shorter, fewer buildings, more room to fight and camp. Not a diamond-shaped iso square. Size set by performance |
| U-Bahn tunnels | Mostly linear, with short side branches for a chest or a mini-boss |
| Heights | Stairs, ramps and hills to look down from (backlog B3) |
| Landmarks | Iconic buildings should be visible; a landmark view button near them (backlog B2) |
