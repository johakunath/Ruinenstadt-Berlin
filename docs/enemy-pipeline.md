# Enemy pipeline

Index of every enemy, elite, boss and NPC with its 3D body and Kodex image, so gaps are visible at a glance.
Rule: every session that touches enemy bodies, animations, Kodex art or textures updates this file.
Legend: **zombie+gear** = `assets/characters/zombie.glb` rig with code gear and tints (`gearFor`, `TINTS`, `CLOTH`, `SHAPE` in `src/render/enemies.ts`); **GLB** = own converted model; **code** = built from primitives. Refined: `final` (accepted look), `ok` (own shape, reads right), `placeholder` (task file says so, or base body with a recolour). Status as of 2026-11-18.

## Summary

| Map | Kinds | On zombie rig | Own GLB | Code-built |
|---|---|---|---|---|
| Köpenick | 10 (6 normal, 4 bosses) | 7 | 2 (raptor, rex) | 1 (crow) |
| Xhain | 10 (6 normal, 4 bosses) | 8 | 0 | 2 (rat, crow) |
| U-Bahn tunnels | 5 (4 normal, 1 boss) | 5 | 0 | 0 |
| Alexanderplatz | 12 (8 normal, 4 bosses) | 6 | 2 (mech, mechBig) | 4 |
| Mitte | 12 (8 normal, 4 bosses) | 9 | 0 | 3 (drone, wachdrohne, crow) |
| Camp | 0 enemies, 7 keepers | 0 | 7 on `hero.glb` | 0 |

- Roster: 30 kinds (13 normal or special, 17 bosses) plus the Brigadeghul (walker variant on Alexanderplatz), 4 elite modifiers, 10 NPC types.
- Bodies: 19 kinds on the zombie rig (2 without own gear: walker, runner), 4 with an own GLB, 7 code-built. None is marked `final`.
- Kodex: all 30 kinds have painted portraits, including 13 added in PR #56. SVG glyphs remain as fallbacks. Existing 2D busts still have the body mismatches listed below. The new portraits follow the current 3D designs and await side-by-side review.
- Elite tiers in every map: an elite Brocken guards one side passage (`guards` in each map file; the tunnel "mini-boss" is this guard).

## Index

Maps: K Köpenick, X Xhain, T tunnels, A Alexanderplatz, M Mitte. Normal mixes from `waveTier` per map file; tunnels reuse the Köpenick tier at zone 0 (no crow, no raptor).

| Name | Kind | Role | Maps | Body | Refined | Kodex | Matches 3D | Needs | Prio |
|---|---|---|---|---|---|---|---|---|---|
| Schlurfer | walker | normal | K X T A M | zombie, no gear (cyber cables on M) | ok | E01 | yes | final skin pass | P1 |
| Hetzer | runner | normal | K X T A M | zombie, longer arms (cyber on M) | ok | E09 | yes | final skin pass | P1 |
| Brocken | brute | normal, elite guard | K X T A M | zombie+gear: boiler plate, collar | placeholder | E02 | no, bust has vest | orange vest or new bust | P1 |
| Speier | spitter | special | K X T A M | zombie+gear: throat sac, boils | placeholder | E03 | no, bust bloated | bloated belly shape | P1 |
| Raptor | raptor | special | K | GLB `raptor.glb` (Quaternius CC0) | ok | E11 | yes | none | P1 |
| Krähe | crow | normal | K X A M | code (body, wings, beak) | ok | E05 | yes | none | P1 |
| Der Feldwebel | feldwebel | boss | K | zombie+gear: Pickelhaube, blue tunic, epaulettes | placeholder | X04 | partly, helmet unverified vs bust | own silhouette, check helmet | P1 |
| Der Turmwächter | waechter | boss | K | zombie+gear: wide hat, lantern, keys, robe | placeholder | X03 | no, bust tower head | tower head body | P1 |
| Der Rex | rex | boss | K | GLB `rex.glb` (Quaternius CC0) | ok | E12 | yes | none | P1 |
| Hauptmann von Köpenick | hauptmann | boss | K | zombie+gear: Pickelhaube with plume, sash, coat tails | placeholder | X01 | partly, helmet unverified vs bust | own silhouette, check helmet | P1 |
| Ratte | rat | normal (packs of 5) | X | code (body, ears, tail) | ok | E04 | yes | none | P2 |
| Der Grenzer | grenzer | boss | X | zombie+gear: peaked cap, olive tunic, rifle | placeholder | X11 | unverified | silhouette review | P2 |
| Der Brandmeister | brandmeister | boss | X | zombie+gear: fire helmet, ember coat, torch | placeholder | X10 | partly, helmet unverified vs bust | own silhouette | P2 |
| Die Rattenmutter | rattenmutter | boss | X | zombie+gear: hood, moss coat, shoulder rat, hunch | placeholder | X06 | no, bust rat head | rat head body | P2 |
| Die Spreehexe | spreehexe | boss | X | zombie+gear: punk crest, black coat, acid hand | placeholder | X12 | unverified | silhouette review | P2 |
| Der Schaffner | schaffner | boss | T | zombie+gear: peaked cap, blue coat, signal disc | placeholder | X05 | partly, cap unverified vs bust | own silhouette | P4 |
| Brigadeghul | walker (render) | normal | A | zombie+gear: Blaumann, cap, armband | ok | E01 (walker) | no, walker bust | none, shares walker | P4 |
| Uhrwerkläufer | uhrwerk | normal | A | GLB `mech.glb` (Leela, CC0) + clock shield, dome, key | ok | E16 | unverified | compare portrait and body | P4 |
| Wurzler | wurzler | special | A | zombie+gear: roots, apron, sunflower face | placeholder | E17 | unverified | silhouette review | P4 |
| Kernspeier | kernspeier | special | A | code (clay pot, stem, toothed sunflower) | ok | E18 | unverified | compare portrait and body | P4 |
| Die Wurzel-Mutter | wurzelmutter | boss | A | zombie+gear: roots, crown of sunflowers | placeholder | X13 | unverified | silhouette review | P4 |
| Der Große Uhrwerkläufer | uhrwerkgross | boss | A | GLB `mechbig.glb` (Mike, CC0) + key | ok | X14 | unverified | compare portrait and body | P4 |
| Der Volkseigene Koloss | volkskoloss | boss | A | code (Plattenbau slab, clockwork legs, arms) | ok | X15 | unverified | compare portrait and body | P4 |
| Die Weltzeituhr | weltzeituhr | boss | A | code (landmark rig `src/render/clock.ts` on four legs) | ok | X16 | unverified | compare portrait and body | P4 |
| Kabelghul | kabel | normal | M | zombie+gear: lit pink cable arches, implants, crouch | placeholder | E13 | no, bust cables cyan | cable colour decision | P4 |
| Boxenkopf | bass | special | M | zombie+gear: speaker head, violet rags | ok | E14 | yes | none | P4 |
| Drohne | drone | normal | M | code (`buildDrone`) | ok | E15 | unverified | compare portrait and body | P4 |
| Der Türsteher | tuersteher | boss | M | zombie+gear: bomber jacket, glasses, clipboard | placeholder | X17 | unverified | silhouette review | P4 |
| Die Wachdrohne | wachdrohne | boss | M | code (`buildDrone`, big) | ok | X18 | unverified | compare portrait and body | P4 |
| Der Dirigent | dirigent | boss | M | zombie+gear: tailcoat, bow tie, baton, speaker | placeholder | X19 | unverified | silhouette review | P4 |
| Der Bassprediger | bassprediger | boss | M | zombie+gear: speaker head, five cables, mixer | ok | X09 | yes | none | P4 |
| Flink / Brennend / Spaltend / Gepanzert | elite mods | elite | all | host body ×1.15 plus a faint glow in the mod colour | placeholder | L01 to L04 | unverified | mod-specific gear | P1 |
| Späti-Wirt | keeper | NPC | all expeditions | `hero.glb` in vest + flat cap, apron (`src/render/content.ts`) | placeholder | none | n/a | own look | P3 |
| Händler | trader | NPC | expeditions | `hero.glb` + wide hat, pack, green lantern | placeholder | none | n/a | own look | P3 |
| Gefangener | captive | NPC | expeditions | `hero.glb` in vest, no gear | placeholder | none | n/a | per-survivor look | P3 |
| Dr. Ahmet, Mira, Jonas, Oma Gerda, Lin, Kalle | survivors | NPC | camp | `hero.glb` + per-station dress (`dress` in `src/render/camp-stations.ts`) | placeholder | S01 to S06 | unverified | compare busts | P3 |
| Ilse | kom keeper | NPC | camp | `hero.glb` + olive cap, red armband, clipboard | placeholder | S07 (camp) | unverified | Kodex entry | P3 |

Sources: kinds and bodies `src/data/enemies.ts` (`ENEMIES[].body`), gear `gearFor` in `src/render/enemies.ts` and `src/render/enemies-alex.ts`, busts `ENEMY_PORTRAIT` in `src/ui/menu.ts`, licences `assets/LICENSES.md`. "Placeholder" for zombie-rig bosses follows `docs/tasks/m12b-xhain-enemies.md` and `m12c-mitte-enemies.md`; for Köpenick and tunnel bosses it is a judgment (no task note).

## Priorities

| Prio | Scope | First jobs |
|---|---|---|
| P1 | Köpenick enemies and bosses | Turmwächter tower head; Brocken vest; Speier belly; Feldwebel and Hauptmann silhouettes beyond the shared rig; check helmets against X04 and X01 in a head close-up; elite readability |
| P2 | Xhain | Rattenmutter rat head; Brandmeister silhouette; compare Grenzer and Spreehexe with X11 and X12 |
| P3 | NPCs | Späti-Wirt, Händler, captive and the 7 keepers all share the hero body: give each a distinct silhouette; check survivors against S01 to S06; Kodex entry for Ilse (her portrait is used in the camp) |
| P4 | Tunnels, Alexanderplatz, Mitte | Schaffner silhouette; Kabelghul cable colour (pink 3D, cyan bust); compare the new portraits with their bodies |

## Kodex from 3D renders

- Render Kodex portraits from the in-game bodies with `tools/enemy-sheet.mjs` (`kind=…&state=…`, dev server running), so the Kodex always shows the body the player fights.
- Framing: head and shoulders (bosses and creatures: full head and upper body), warm key light, cool rim light, dark plain background, 64 px target with a 256 px source. `enemy-sheet.ts` has only a fixed hemisphere and sun light and a `view` option today: a portrait mode with camera framing and the two lights is still to build.
- Swap one kind at a time once its body is `final`; painted busts stay until then.
- Store renders as `assets/portraits/<id>.webp` with a row in `assets/LICENSES.md`, mapped in `ENEMY_PORTRAIT`.

## Route per job

| Job | Route |
|---|---|
| Gear, colours, proportions, procedural bodies (crow, rat, drone, Kernspeier, Koloss) | Code: `src/render/enemies.ts`, `src/render/enemies-alex.ts` (one material per colour, parts merged) |
| New creature or mech from a CC0 pack | Node conversion: `tools/build-creatures.mjs` (FBXLoader, bake to meters, vertex-colour repaint, glTF export); licence row in `assets/LICENSES.md` |
| Painted textures and painted busts | Codex only (`docs/asset-pipeline.md`); Claude does the performance integration |
| Rigging a new body or retargeting animations | Blender (headless, as in `npm run assets:hero`), only for this |
