# Xhain map (M15)

Second district, 1981 (story: West Berlin squats, the Wall stands; boss Die Spreehexe). Concept B "Über die Mauer", chosen by Johannes on 2026-11-18 from three layouts ([`../mockups/m15-xhain-layouts.svg`](../mockups/m15-xhain-layouts.svg)). Map image from the game data: [`xhain.svg`](xhain.svg) (regenerate: `XHAIN_SVG=docs/maps/xhain.svg npx vitest run src/data/map-svg.test.ts`). Data: `src/data/xhain.ts`, tests `src/data/xhain.test.ts`. In game: `?map=xhain`; in the flow it opens after the S3 tunnel (the tunnel ends at Warschauer Straße, where Xhain starts).

## Decisions (Johannes, 2026-11-18)

| # | Decision |
|---|---|
| X1 | Layout B: start in the East at S Warschauer Straße, Mühlenstraße behind the Wall, through the death strip over the Schillingbrücke, then Kreuzberg; final on the Oberbaumbrücke |
| X2 | Bosses from the 2D list, built from the existing attack blocks: Der Grenzer (zone 1), Der Brandmeister (zone 2), Die Rattenmutter (zone 3), Die Spreehexe (district boss). Task `docs/tasks/m12b-xhain-enemies.md` |
| X3 | Rats (2D `rat`) are Xhain's new enemy type, in packs |
| X4 | Feedback on the data map (Johannes, 2026-11-18): the sites he cares about most are S-Bahnhof and Warschauer Straße, Ostbahnhof, East Side Gallery, Schlesisches Tor, Görlitzer Park, the Bethaniendamm with St. Thomas, Oberbaumbrücke and Kotti, in one loop; landmarks at Köpenick quality; density, back yards and small things like Köpenick but Xhain's own |
| X5 | A wide track field (`MapDef.railYards`) runs from the south-east under the Warschauer Brücke to the Ostbahnhof; the bridge is a raised deck (`Terrace.bridge`) with stairs down to the street, and the run starts on it. Görli is a long rectangle (OSM). The Bethaniendamm and its Wall bend, with St. Thomas inside the bend. The death strip on the north bank between the East Side Gallery and the Spree is wide and visible; west of the Schillingbrücke the land wall along the Bethaniendamm stays, as in 1981 |
| X6 | Berliner Blockrand (Johannes, 2026-11-18, `../mockups/m15-altbau-visibility.svg`): mainly A, closed 5-storey Altbau rows only where they do not stand between camera and street (north side of east–west streets, both sides of north–south streets), the camera side low (shops, ruins), Baulücken with fire walls in the tall rows. B (cut a building above the ground floor while the hero is behind it) only where the architecture needs it: in courtyards and behind landmarks. A is built on the Oranienstraße and the Reichenberger Straße as a test (`Street.block`, screens `xhain/blockrand-*.png`); B needs an engine decision first (`docs/tasks/v1-visibility.md`) |

## Route (scale 1: 400 × 344 m, route about 820 m)

| Zone | Encounters (waves) | Boss | Landmarks |
|---|---|---|---|
| 0 Mühlenstraße (East) | Warschauer Straße (3), East Side Gallery (3), Ostbahnhof (3) | Der Grenzer in the death strip | S Warschauer Straße on the bridge over the track field, Ostbahnhof, East Side Gallery, watchtower |
| 1 Mariannenplatz (SO36) | Rauch-Haus (3), Mariannenplatz (3), Oranienstraße (3) | Der Brandmeister on the Oranienplatz | Georg-von-Rauch-Haus, St.-Thomas-Kirche, Bethanien |
| 2 Kottbusser Tor | Kottbusser Tor (3), Skalitzer Straße (3), Görlitzer Bahnhof (3) | Die Rattenmutter in Görlitzer Park | NKZ, U1 Hochbahn with three stations, ruin of the Görlitzer Bahnhof |
| 3 Oberbaumbrücke | | Die Spreehexe at the Kreuzberg head | Oberbaumbrücke (towers, U1 upper deck), checkpoint at the north head |

One loop, no street twice: Warschauer Straße → Mühlenstraße → Straße der Pariser Kommune → Andreasstraße → Schillingbrücke → death strip → breach in the Wall at the Bethaniendamm → Mariannenplatz → Oranienstraße → Dresdener Straße → Skalitzer Straße under the Hochbahn → Görlitzer Park → Görlitzer Straße → Oberbaumstraße.

Difficulty: waves run over `waveTier` g = 8 … 30 (Köpenick 0 … 19), items +3 levels (district 1). To calibrate with the bot after the playtest.

## Geography check (OpenStreetMap, Nominatim, 2026-11-17)

Origin Oberbaumbrücke (52.50173 N, 13.44573 E). Real offsets east/north; map offsets at scale 1 (+x east, −z north).

| Place | Real | Map | Note |
|---|---|---|---|
| S+U Warschauer Straße | 0.20 km E, 0.35 km N | 50 m E, 94 m N | North-east ✓ |
| East Side Gallery (hinterland wall) | 0.33 km W, 0.30 km N | along the Mühlenstraße, 22 m off the Spree | North-west, between street and river ✓ |
| Mühlenstraße | 0.64 km W, 0.62 km N | 40 m W, 70 m N | ✓ |
| Ostbahnhof | 0.72 km W, 1.00 km N | 100 m W, 168 m N | North-west on the Stadtbahn ✓ |
| Schillingbrücke | 1.11 km W, 0.84 km N | 143 m W, 108 m N | Over the Spree ✓ |
| Wall at the Bethaniendamm | about 1.3 km W, 0.45 km N | 68 m N | Land wall south of the Spree, north of St. Thomas ✓ |
| St.-Thomas-Kirche | 1.30 km W, 0.40 km N | 170 m W, 48 m N | ✓ |
| Georg-von-Rauch-Haus | 1.45 km W, 0.35 km N | 236 m W, 50 m N | West of St. Thomas ✓ |
| Mariannenplatz | 1.37 km W, 0.24 km N | 200 m W, 16 m N | ✓ |
| Bethanien | 1.57 km W, 0.23 km N | 240 m W, 16 m N | West side of the square ✓ |
| Oranienplatz | 2.03 km W, 0.06 km N | 278 m W, 14 m S | West end ✓ (compressed north–south) |
| Kottbusser Tor | 1.86 km W, 0.31 km S | 246 m W, 62 m S | South-west ✓ |
| U Görlitzer Bahnhof | 1.17 km W, 0.27 km S | 150 m W, 54 m S | ✓ |
| Görlitzer Park | 0.55 km W, 0.57 km S; 950 × 120 m rectangle running south-east | centre 86 m W, 112 m S; 104 × 44 m, same axis | South-west of the bridge ✓ |
| U Schlesisches Tor | 0.29 km W, 0.10 km S | 70 m W, 38 m S | ✓ |

Not checked: side street courses (Wrangelstraße, Cuvrystraße, Holzmarktstraße and Am Wriezener Bahnhof are placed where they read right), the exact wall line at the Schillingbrücke. Left out: the Landwehrkanal (south of the map), Berghain and post-1990 buildings (era 1981).

## 1981 details

| Topic | Rule |
|---|---|
| Wall | `MapDef.walls`: hinterland wall along the Friedrichshain bank, checkpoint across the north head of the Oberbaumbrücke (the bridge is reached from Kreuzberg only), land wall along the Bethaniendamm with one breach for the route. Every piece blocks; no other way through |
| Death strip | Open grass strip between the Spree and the land wall, tank traps, watchtower; the Grenzer fight |
| Tracks | `MapDef.railYards`: the fenced Stadtbahn track field is the north edge; `MapDef.viaducts`: the U1 Hochbahn blocks only at its pillar pairs (every 15 m) |
| Lights | Fires and candles of people under the Hochbahn and along the Warschauer Straße (hand-placed, the fill pass finds no free sidewalk there) |

## Späti rest stops

| Zone | Späti |
|---|---|
| 0 | Späti an der Mauer (Mühlenstraße) |
| 1 | Späti in der Oranienstraße |
| 2 | Späti am Kotti (Skalitzer Straße) |
| 3 | Späti am Wrangelkiez (Skalitzer Straße, 2D name) |

## Side passages (M16b)

| Passage | Surprise |
|---|---|
| Speicherhof (off the Mühlenstraße) | Cache of crates |
| Hinterhof (off the Oranienstraße) | Hidden blessing |
| Bahngraben (off Görlitzer Park) | Sleeping elite Brocken |

## Lot types and weather (M11c)

| Zone | Lot types | Weather |
|---|---|---|
| Mühlenstraße | Baustelle, Parkplatz | Fog |
| Mariannenplatz | Hinterhof, Kirchhof | Ash with embers (1981 riots) |
| Kottbusser Tor, Görli | Markt, Trümmerfeld | Rain |
| Wrangelkiez, Oberbaum | | Clear |

## Handover (2026-11-18, PR #46) [Claude · Opus high]
- Built: map data and tests (`src/data/xhain.ts`, `xhain.test.ts`), Wall, track field, bridge deck, U1 and nine landmarks in code (`src/render/xhain-world.ts`), rats and four bosses (`docs/tasks/m12b-xhain-enemies.md`), Blockrand variant A on the Oranienstraße and Reichenberger Straße, page flow after the S3 tunnel, bot `--map=xhain`. V1 B cutaway (PR #50) cuts the Hinterhof fronts and the St. Thomas and Bethanien towers.
- Reused from 2D: district data and landmarks of `js/geo.js` (Xhain roads, bridges, stations, Oberbaum, East Side Gallery, Ostbahnhof colours and proportions), rat stats and pack rule, Rattenmutter and Spreehexe patterns, the Brandmeister and Rattenmutter busts. From Köpenick: generators, lot types, Späti, side passages, lane fences, landmark helpers.
- Open: Codex textures T6 (`docs/asset-pipeline.md`); difficulty with carried gear (`docs/balance.md`); hardware checks 10 to 13 (`docs/tasks/pt-hardware-checks.md`); Blockrand on more streets after Johannes' look; Oberbaum towers not cut (`Landmark.cut`) until he has seen them.

