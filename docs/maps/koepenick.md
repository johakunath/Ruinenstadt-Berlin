# Köpenick map (M10 concept, M11 build)

Concept A "Drehkreuz Altstadt", chosen by Johannes on 2026-11-15. Map image drawn from the game data: [`koepenick.svg`](koepenick.svg) (regenerate: `MAP_SVG=docs/maps/koepenick.svg npx vitest run src/data/map-svg.test.ts`). In game: button **Karte** or key M.

## Decisions (Johannes, 2026-11-15)

| # | Decision |
|---|---|
| K1 | Concept A: Altstadt island as the hub, three zones around it |
| K2 | Route: S Köpenick → Bahnhofsviertel → south-east to the Müggelberge → north-west to the Spreepark (dinosaurs) → back to the Rathaus for the final boss |
| K3 | 20 normal waves: 6 in zone 1, 7 in zone 2, 7 in zone 3. A boss after each zone (Schaffner, Turmwächter, Rex), Hauptmann von Köpenick at the Rathaus last |
| K4 | Enemies get harder wave by wave; drops and stronger skills must keep up (M3, M4, M8) |
| K5 | Positions do not have to be to scale, but directions do: what is north in Köpenick is north here. Each small area roughly real. Landmark buildings recognizable |
| K6 | Size can grow: the map is authored with one scale factor (`koepenickMap(scale)`, `?mapscale=1.3`). Distances stretch, buildings and streets keep their size, generated buildings and trees fill the extra space |

## Geography check (OpenStreetMap, 2026-11-15)

Real offsets from the Rathaus, compressed in the map (scale 1).

| Place | Real | Map | Note |
|---|---|---|---|
| S Köpenick | 1.6 km N, 0.3 km E | 190 m N | North ✓ |
| Dammbrücke | 0.35 km N | 46 m N | Over the Spree ✓ |
| Schloss Köpenick | 0.17 km S, 0.17 km W | 42 m S, 55 m W | On the Schlossinsel in the Dahme ✓ |
| Lange Brücke | 0.1 km S, 0.23 km W | 4 m S, 30 m W | Over the Dahme, west ✓ |
| Frauentog | 0.24 km S | 50 m S | Bay south of the Altstadt ✓ |
| Müggelsee | 1 km S, 5 km E | east edge | East ✓ |
| Müggelturm | 3.1 km S, 3.4 km E | 200 m S, 196 m E | South-east ✓ |
| Spreepark | 4.4 km N, 5.9 km W | 60 m N, 210 m W | North-west along the Spree ✓. Really in Plänterwald (Treptow), pulled in as a neighbour |

Not checked against real streets: the exact course of the side streets and the Kietz layout. They are placeholders for "dense Altbau here".

## Layout (scale 1: 510 × 428 m)

| Zone | Encounters (waves) | Boss | Landmarks |
|---|---|---|---|
| 0 Bahnhofsviertel | Bahnhofsvorplatz (2), Forum (2), Lindenstraße (2) | Der Schaffner at the Dammbrücke | S-Bahnhof Köpenick, Forum Köpenick |
| 1 Müggelberge | Kietz (2), Müggelheimer Straße (2), Teufelssee (3) | Der Turmwächter at the Müggelturm | Müggelturm, Teufelssee, Müggelsee shore |
| 2 Spreepark | Köllnische Vorstadt (2), Spreeufer (2), Dino-Wiese (3) | Der Rex at the Riesenrad | Riesenrad, toppled dinosaurs, jungle |
| 3 Rathaus | | Hauptmann von Köpenick on the Rathausplatz | Rathaus (tower, stepped gables), Schloss, St. Laurentius |

Walking the route takes about 2.5 minutes at full run speed; with fights the whole district is roughly 15 to 20 minutes. A death restarts at the start of the zone (in-memory checkpoint; a saved checkpoint is M6/B1).

## How it plays

- The next encounter is the objective: HUD line with name, distance and an arrow. Other encounters stay quiet.
- Entering its circle closes it (nobody leaves until all waves are beaten). Waves spawn on the rim, away from the hero. 1.6 s pause between waves.
- Won encounter: +30 % life (bosses: full life). This stands in for food and heal drops until M4.
- Difficulty per normal wave g (0 … 19), `waveTier` in `src/data/koepenick.ts`: 5 → 14 enemies, up to 12 alive, life ×1.0 → ×1.76, damage ×1.0 → ×1.48, runners from wave 2, brutes from wave 4.
- Bosses are placeholders on the zombie body (bigger, poise, own name, health bar) until M12 brings models and attacks.

## Open questions

| # | Question | Default |
|---|---|---|
| KQ1 | Is 15 to 20 minutes for the whole district too long for one session (vision: 5 to 15)? Option: save a checkpoint per zone (M6) so a session can end after a zone | Checkpoint per zone with M6 |
| KQ2 | Waves scale up but the hero does not yet (no gear stats before M3, no drops before M4). Zones 2 and 3 will feel too hard until then | Keep the curve, tune after M3/M4 with the balance bot (M14) |
| KQ3 | Heights (B3): Müggelberge, Rathaus steps and the Schloss terrace are flat for now. The sim needs a ground height first | After M11 basics |
| KQ4 | Shortcut back from the Spreepark to the Rathaus (about 30 s of walking)? E.g. a ferry over the Spree | Walk for now |
