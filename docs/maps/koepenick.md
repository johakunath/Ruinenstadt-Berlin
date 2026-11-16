# Köpenick map (M10 concept, M11 build, M11b v2)

v2: concept C "Rundweg", chosen by Johannes on 2026-11-15 after the first playtest (v1 was concept A "Drehkreuz Altstadt"). Screens: [`koepenick-v2.jpg`](koepenick-v2.jpg), [`koepenick-v2b.jpg`](koepenick-v2b.jpg) (ferry, tram, ruins, map edge). Map image drawn from the game data: [`koepenick.svg`](koepenick.svg) (regenerate: `MAP_SVG=docs/maps/koepenick.svg npx vitest run src/data/map-svg.test.ts`). In game: button **Karte** or key M.

## Decisions (Johannes, 2026-11-15)

| # | Decision |
|---|---|
| K1 | Concept A: Altstadt island as the hub, three zones around it |
| K2 | Route: S Köpenick → Bahnhofsviertel → south-east to the Müggelberge → north-west to the Spreepark (dinosaurs) → back to the Rathaus for the final boss |
| K3 | 20 normal waves: 6 in zone 1, 7 in zone 2, 7 in zone 3. A boss after each zone (Feldwebel, Turmwächter, Rex), Hauptmann von Köpenick at the Rathaus last |
| K4 | Enemies get harder wave by wave; drops and stronger skills must keep up (M3, M4, M8) |
| K5 | Positions do not have to be to scale, but directions do: what is north in Köpenick is north here. Each small area roughly real. Landmark buildings recognizable |
| K7 | v2 (M11b): concept C "Rundweg". One loop without doubling back: Müggelberge → ferry over the Dahme → Johannisthal → Spreepark → along the Spree → Rathaus. Distances about 0.6 of v1; the Altstadt island keeps its v1 size. Minimap M1 (round, top left, north up) |
| K8 | Playtest notes on v2 (2026-11-15): the ferry is a boat that shuttles on its own (about 11 s across, 5 s at each pier, the hero rides along); a broken-down tram on the Dammbrücke with tracks from the station to the Altstadt; half the buildings are ruins; construction fence and roadblocks at the map edge |
| K9 | M11b part 2 (2026-11-16): ground variant C (grass, dirt, sidewalk plates and leaf litter blended, overgrown paving, puddles, leaves, trash, rubble and weed tufts); natural banks irregular, town banks stone quays; low relief in parks and forests. Späti as a rest stop, one per zone (fights lock the hero into the circle, so the 2D safe-room rule does not apply). A trader moves in later (M13b) |
| K6 | Size can grow: the map is authored with one scale factor (`koepenickMap(scale)`, `?mapscale=1.3`). Distances stretch, buildings and streets keep their size, generated buildings and trees fill the extra space |

## Geography check (OpenStreetMap, 2026-11-15, method in `guidelines.md`)

Real offsets from the Rathaus, compressed in the map (scale 1). v1 map offsets for the Altstadt rows still hold (core unchanged); outer rows are v2.

| Place | Real | Map | Note |
|---|---|---|---|
| S Köpenick | 1.6 km N, 0.3 km E | 140 m N | North ✓ |
| Dammbrücke | 0.35 km N | 46 m N | Over the Spree ✓ |
| Schloss Köpenick | 0.17 km S, 0.17 km W | 42 m S, 55 m W | On the Schlossinsel in the Dahme ✓ |
| Lange Brücke | 0.1 km S, 0.23 km W | 4 m S, 30 m W | Over the Dahme, west ✓ |
| Frauentog | 0.24 km S | 50 m S | Bay south of the Altstadt ✓ |
| Müggelsee | 1 km S, 5 km E | east edge | East ✓ |
| Müggelturm | 3.1 km S, 3.4 km E | 124 m S, 146 m E | South-east ✓ |
| Spreepark | 4.4 km N, 5.9 km W | 30 m N, 108 m W | North-west along the Spree ✓. Really in Plänterwald (Treptow), pulled in as a neighbour |
| Wendenschloß | 2.8 km S, 1.0 km E | 106 m S, 8 m E (ferry landing) | South ✓ |
| Grünau (ferry F12 to Wendenschloß) | 3.3 km S, 0.4 km E, west bank of the Dahme | 104 m S, 54 m W | South ✓ (west bank; the map Dahme runs west of the real one) |
| Landschaftspark Johannisthal (former airfield) | 0.9 km S, 3.3 km W | 62 m S, 100 m W | West-south-west ✓. In Adlershof/Johannisthal, pulled in as a neighbour |
| Kämmereiheide | 0.2 km S, 2.4 km E | not used | Checked for zone 2 and rejected: it lies east, not south-west |

Not checked against real streets: the exact course of the side streets, the Kietz layout, and the v2 loop paths (Waldweg, Heideweg are placeholder names). They are placeholders for "dense Altbau here".

## Layout v2 (scale 1: 318 × 304 m)

| Zone | Encounters (waves) | Boss | Landmarks |
|---|---|---|---|
| 0 Bahnhofsviertel | Bahnhofsvorplatz (3), Lindenstraße (3), Forum (3) | Der Feldwebel at the Dammbrücke | S-Bahnhof Köpenick, Forum Köpenick |
| 1 Müggelberge | Kietz (3), Müggelheimer Straße (3), Teufelssee (3) | Der Turmwächter at the Müggelturm | Müggelturm, Teufelssee, Müggelsee shore |
| 2 Spreepark | Fähre Grünau (3), Flugfeld Johannisthal (3), Dino-Wiese (3) | Der Rex at the Riesenrad | Ferry, Riesenrad, toppled dinosaurs, jungle |
| 3 Rathaus | | Hauptmann von Köpenick on the Rathausplatz | Rathaus (tower, stepped gables), Schloss, St. Laurentius |

Route about 840 m of pure running (v1 about 1380 m by the same measure), roughly 2.3 minutes at run speed. A death restarts at the start of the zone (in-memory checkpoint; a saved checkpoint is M6/B1).

### v2 street and lot rules (M11b)

| Topic | Rule |
|---|---|
| Streets | Main 7 to 7.5 m, side 5 to 6.5 m, paths 4 m. Curbs on every street except paths and bridges |
| Buildings | Altbau 9 to 16 m wide, ground floor plus 1 to 2 floors, almost closed street front. Single-storey shops (Läden, Spätis) between Altbau blocks. Houses slightly askew with front fences. About 45 % of Altbau and 35 % of houses are L-shaped (back wing one floor lower) |
| Life | Parked and abandoned cars every 7 to 14 m of street, benches, bins, crates and rubble on sidewalks, bollards at the bridge heads. Test: under 10 % of 20 m street stretches without a building, car or prop within 14 m |

### Späti rest stops (M11b part 2)

| Zone | Späti | Spot |
|---|---|---|
| 0 | Späti am Bahnhof | Lindenstraße, between Vorplatz and Lindenstraße fights |
| 1 | Späti am Kietz | Böttcherstraße, at the zone entry |
| 2 | Späti Wendenschloß | Waldweg, at the zone entry |
| 3 | Späti an der Altstadt | Lindenstraße Süd, before the Lange Brücke |

11 × 8 m brick shop, door 2.6 m in the front, sandbags leave a lane. Inside: shelves with goods, fridges, counter with till, mattress, workbench with radio. Roof and upper walls hide while the hero is inside. Heals 3 % of max life per second between fights; first visit shows its name and rings the bell; minimap and map show a yellow frame. Layout: `src/data/spati.ts`, rule: `src/sim/rest.ts`.

## Heights (B3, 2026-11-15)

| Place | Kind | Height |
|---|---|---|
| Müggelberge | Soft hill, the Turm fight on the summit, the Teufelssee fight on its lower slope | 7 m |
| Dino-Hügel (Spreepark) | Soft hill under the Dino-Wiese | 3.5 m |
| Relief | Low rolling ground in grass (0.6 m), forest (1.5 m) and jungle (1.2 m), flat near streets, water, hills, terraces and landmarks (`reliefAt`) | up to 1.5 m |
| Riesenrad-Plattform | Terrace with retaining wall, stairs east (to the Rex arena) and south | 2.4 m |
| Kirchhügel (St. Laurentius) | Terrace above the Rathausplatz, stairs west (to the final arena) and north | 1.8 m |

The sim stays 2D: walls and stair sides are blocked cells; the renderer lifts ground, buildings, props and characters (`heightAt` in `src/data/map.ts`, `src/render/ground.ts`).

The zone 1 boss is Der Feldwebel (the Hauptmann's sergeant, 1906): Der Schaffner stays the U-Bahn tunnel boss as in the 2D game.

## How it plays

- The next encounter is the objective: HUD line with name, distance and an arrow. Other encounters stay quiet.
- Entering its circle closes it (nobody leaves until all waves are beaten). Waves spawn on the rim, away from the hero. 1.6 s pause between waves.
- Won encounter: +30 % life (bosses: full life). This stands in for food and heal drops until M4.
- 27 normal waves, nine per zone (playtest 2026-11-17), spread over the difficulty scale g = 0 … 19 of `waveTier` in `src/data/koepenick.ts`: 5 → 14 enemies, up to 12 alive, life ×1.0 → ×3.5, damage ×1.0 → ×2.1 (retuned with the bot, `docs/balance.md`). Each zone teaches its types: Hetzer from wave 2, Speier from 4, Brocken from 5, Krähen in the Müggelberge, Raptoren in the Spreepark; elites from wave 4.
- Bosses have their own attacks (M12, `docs/tasks/m12-enemies.md`).

## Open questions

| # | Question | Default |
|---|---|---|
| KQ1 | Is 15 to 20 minutes for the whole district too long for one session (vision: 5 to 15)? Option: save a checkpoint per zone (M6) so a session can end after a zone | Checkpoint per zone with M6 |
| KQ2 | Waves scale up but the hero does not yet (no gear stats before M3, no drops before M4). Zones 2 and 3 will feel too hard until then | Keep the curve, tune after M3/M4 with the balance bot (M14) |
| KQ3 | More heights later: Rathaus steps, Schloss terrace, Kietz slope to the Frauentog | After the playtest |
| KQ4 | Shortcut back from the Spreepark to the Rathaus (about 30 s of walking)? E.g. a ferry over the Spree | Walk for now |
