# Wedding map (M18) [Claude · Fable high]

District 6, „kommt bald“: the eternal soon. The feast that never ends holds the Kiez; cranes, scaffolds and billboards for lofts that never open stand behind it (`docs/story.md` › Wedding). Art: Wedding C, gold and emerald banquet fantasy with ruby cloth, carpets, wish lamps, tea, baklava and Döner (`docs/district-design-directions.md` › Final · Wedding, board `docs/style/wedding.png`). Tone: warm, playful, lavish; the neighbours are hosts and allies, the enemies are enchanted feast beings.

Wedding is a district again by Johannes' decision of 2026-11-21 (`docs/migration.md` Q8). **Layout and look below are recommendations, not yet picked by Johannes**: three layouts in [`../mockups/m18-wedding-layouts.svg`](../mockups/m18-wedding-layouts.svg), three look directions in [`../mockups/m18-wedding-look.svg`](../mockups/m18-wedding-look.svg) (PNGs beside both). Plan, steps and anchors: `docs/tasks/m18-wedding.md`. Notes here are short on purpose; Opus writes the final text with the data step.

## Decisions

| # | Decision | By |
|---|---|---|
| W1 | Layout A „Rundweg zum Lampenpalast“: start U Leopoldplatz → Wochenmarkt on the square → Müllerstraße south-east → Bahnhof Wedding → Nettelbeckplatz → through a Ringbahn arch on the Gerichtstraße, over the Panke → Wiesenburg → Humboldthain (Humboldthöhe, Rosengarten) → AEG Maschinenhalle → out through the Beamtentor → Brunnenstraße north through the second arch → Badstraße → Luisenbad → down the Panke on the Uferstraße → Brunnenplatz and Amtsgericht → over the Panke on the Pankstraße → Nauener Platz → the Lange Tafel → Lampenhof. No street twice. Alternatives: B „Kiez kompakt“ (no Humboldthain, no AEG, three zones), C „Zum Palast in der AEG“ (west to east, finale in the Maschinenhalle, a third of the map is backdrop) | Claude, proposed; Johannes picks |
| W2 | Look A „Lampionnacht“: one night sky for the whole map, deep emerald-teal; all gold comes from lamps and cloth below 5 m (lampion and wish-lamp chains across the streets, chandeliers behind hall windows, brass, brocade), ruby awnings and carpets, green scaffold nets on about a third of the tall fronts. Dry; petals, mist and gold sparks by zone. Alternatives: B „Baustelle in Gold“ (cold moon, everything scaffolded), C „Abendrot“ (the board's violet dusk) | Claude, proposed; Johannes picks |
| W3 | Chain: Wedding comes **after** Charlottenburg as district index 5 (appended, so no saved index, tier or line moves). Line 4 is the U9 from S+U Zoologischer Garten to U Leopoldplatz, ghost station Westhafen. The Fernsehturm finale moves to index 6. Details and dependencies below | Claude, proposed |
| W4 | Tier 40 to 62, provisional: +8 per district as before (Charlottenburg 32 to 54). Not calibrated, same reason as Charlottenburg C4 (`docs/balance.md` › District chain, backlog P33) | Claude, proposed |
| W5 | The final arena is an invented Lampenpalast in the courts of the old lamp works (the real Osram-Höfe, north of the Leopoldplatz): wish lamps where light bulbs were made, and the reason this district glows gold. The camera looks north, so the palace front stands behind the last fight. Its gate on the Leopoldplatz side is shut („Geschlossene Gesellschaft“), which sends the hero round the whole district | Claude, proposed |
| W6 | Taste rules: no fight at a church door and no religious sign on any enemy, boss or the palace (it is Festsaal kitsch: chandeliers, gilded stucco, velvet); no mosque is placed; Zeitlose wear builders' vests and estate agents' suits, never the dress of the neighbours; no BVG logo, yellow livery or transit costume (2D rule of 2026-11-13). Left out: silent green (a former crematorium), the Plötzensee memorial, the Anti-Kriegs-Museum, the Wall memorial | Claude, from the 2D rules |

### W3: where Wedding sits in the chain

| Option | For | Against |
|---|---|---|
| **After Charlottenburg (recommended)** | Appends: `MAP_FREED` 5, `STOPS[5]`, `LINES[4]`; nothing built moves. The U9 really runs from Zoologischer Garten to Leopoldplatz. The district that „kommt bald“ comes last before the finale. The chain then circles the city: Köpenick, Xhain, Alexanderplatz, Mitte, Charlottenburg, Wedding, Fernsehturm | The 2D story order had Wedding before Charlottenburg (order 5 and 7 in `docs/story.md`) |
| Before Charlottenburg | Story order of 2D | Shifts Charlottenburg to index 5 while its flow step is being finished: `MAP_FREED`, tier 32 to 54, line 3, run-save keys and the network schematic all move. No real line from U Potsdamer Platz to Wedding (the U6 does not stop there) |

Depends on: Charlottenburg step 8 (line 3 keyed by index, title and victory links; `docs/tasks/m16-charlottenburg.md`), the M14/B2 tier decision, and the finale plan (Charlottenburg C5 proposed the Stadtbahn from Zoo to Alexanderplatz as the last line; with Wedding in between the last line starts in Wedding). The real direct line to Alexanderplatz is the U8 from Gesundbrunnen, at the east end of this map; `NetStop` has one station name per stop, so the finale plan must either give a stop an arrival and a departure station or name the last line from U Leopoldplatz. Not decided here. `src/data/lines.ts` says Charlottenburg ends the network (Johannes, 2026-11-20): this decision reopens that.

## Route (A, scale 1: about 335 × 290 m, route about 930 m between fights)

For comparison: Köpenick 318 × 304 m and about 840 m; Mitte 330 × 387 m and about 1 km; Charlottenburg 320 × 410 m and about 1.1 km. Area about 24 % below Mitte.

| Zone | Fights (waves) | Boss | Landmarks |
|---|---|---|---|
| 1 Leopoldkiez | Wochenmarkt on the Leopoldplatz (2), Müllerstraße (3), Bahnhof Wedding (3) | Boss 1 on the Nettelbeckplatz | U Leopoldplatz, Alte and Neue Nazarethkirche (backdrop), the Neubau im Gerüst with crane and banner (invented, where the Rathaus Wedding stands), S Wedding on the Ringbahn |
| 2 Humboldthain | Wiesenburg (3), Humboldthöhe (2, calm, on the summit), Rosengarten (3) | Boss 2 in the AEG Maschinenhalle | Wiesenburg ruin, Flakturm, Maschinenhalle (roofless), Beamtentor |
| 3 Gesundbrunnen | Badstraße (3), Luisenbad (2, calm), Uferhallen (3) | Boss 3 on the Brunnenplatz in front of the Amtsgericht | Bahnhof Gesundbrunnen (backdrop), Bibliothek am Luisenbad, Uferhallen, Amtsgericht Wedding, the Panke |
| 4 Das ewige Fest | Nauener Platz (3) | Sultan Nimmersatt in the Lampenhof | ExRotaprint, the Lange Tafel, Lampenpalast (invented) |

10 fights, 27 waves, 4 bosses. Rest stops: Späti am Leo (Müllerstraße), Kiosk am Sommerbad (park gate), Teestube am Luisenbad (on the Panke), Baklava & Döner (Pankstraße); the last two are the board's buildings. Side passages: a Hinterhof off the Müllerstraße (hidden blessing), the walled garden of the Wiesenburg (cache), the ExRotaprint yard (sleeping elite). One hill: the Humboldthöhe, 7 m.

Why this shape: the loop fills the rectangle (the Charlottenburg review found a third of an L-shaped map unused); the palace glows in the north from the first step and is reached last; the three story set pieces are all on the route (the market with stalls as cover, the AEG hall arena, the feast that never ends). The block between Leopoldplatz and Panke (about 100 × 110 m) is not walked: closed Blockrand with the Hinterhof side passage.

## Geography check (OpenStreetMap Nominatim, 2026-11-21)

Origin U Leopoldplatz (52.5465 N, 13.3596 E). Real offsets in m east, north, with the compass octant from the origin. Map offsets are the anchors of layout A (scale 1) from the start.

| Place | Real E, N | Octant | Map E, N | Octant | Note |
|---|---|---|---|---|---|
| Alte Nazarethkirche | 8, 78 | N | 2, 28 | N ✓ | on the square, at the Müllerstraße |
| Neue Nazarethkirche | 145, 240 | NE | 32, 62 | NE ✓ | north-east end of the square ✓; 5° from the octant border |
| Rathaus Wedding | −245, 101 | W | −40, 14 | W ✓ | the invented Neubau stands here; 3° from the border |
| Osram-Höfe | 39, 677 | N | 6, 150 | N ✓ | the Lampenpalast; Oudenarder Straße (42, 773) runs past it ✓ |
| S+U Wedding | 346, −361 | SE | 60, −66 | SE ✓ | where the Müllerstraße meets the Ringbahn |
| Nettelbeckplatz | 660, −202 | E | 94, −32 | E ✓ | OSM now names the square Martha-Ndumbe-Platz; 4° from the border |
| Wiesenburg | 1029, −100 | E | 150, −40 | E ✓ | on the Panke, south of the Ringbahn |
| Sommerbad Humboldthain | 1520, −104 | E | 186, −30 | E ✓ | west part of the park ✓ |
| Humboldthöhe and Flakturm | 1700, 91 | E | 206, 16 | E ✓ | north side of the park, above the railway ✓ |
| Rosengarten | 1873, 101 | E | 242, −6 | E ✓ | east of the hill ✓ |
| Volkspark Humboldthain (centre) | 1824, −147 | E | 216, −20 | E ✓ | |
| Beamtentor | 2143, −283 | E | 254, −70 | E ✓ | on the Brunnenstraße ✓ |
| S+U Gesundbrunnen | 1843, 293 | E | 246, 58 | E ✓ | on the Ringbahn, north-east of the hill ✓; Hanne-Sobek-Platz (1940, 242) beside it |
| U Pankstraße | 1498, 687 | NE | 204, 100 | NE ✓ | on the Badstraße; 4° from the border |
| Bibliothek am Luisenbad | 1345, 787 | NE | 184, 132 | NE ✓ | Badstraße 39 ✓ |
| Uferhallen | 963, 606 | NE | 140, 104 | NE ✓ | Uferstraße 8 to 11; which bank is not checked |
| Amtsgericht Wedding | 1077, 482 | NE | 136, 70 | NE ✓ | north-west of the Brunnenplatz ✓, so its front stands behind the boss fight; 5° from the border |
| Brunnenplatz | 1152, 409 | E | 150, 48 | E ✓ | 5° from the border |
| ExRotaprint | 708, 395 | NE | 94, 60 | NE ✓ | |
| U Nauener Platz | 519, 607 | NE | 66, 98 | NE ✓ | on the Reinickendorfer Straße ✓ |
| U9 stations south of the map | Zoologischer Garten (−1803, −4404), Hansaplatz (−1224, −3172), Turmstraße (−1320, −2237), Birkenstraße (−1098, −1674), Westhafen (−1148, −1066), Amrumer Straße (−701, −446) | S, SW | | | the positions line up from Zoo to Leopoldplatz, which supports the line order (W3) |

Order along lines, as in reality: down the Panke Luisenbad, Uferhallen, Amtsgericht, Brunnenplatz, then under the Ringbahn to the Wiesenburg; along the Ringbahn S Wedding, Nettelbeckplatz (north of it), Wiesenburg and Humboldthain (south of it), Gesundbrunnen.

Looked up, not on the map: U Seestraße (−421, 365), Schillerpark (−820, 1324), Volkspark Rehberge (−1830, 762), Plötzensee (−2007, −253), Virchow-Klinikum (−1117, −485), Berliner Hochschule für Technik (−439, −250), Zeppelinplatz (−453, −71), Anti-Kriegs-Museum (−790, −57), Centre Français (−1388, 1318), Prime Time Theater (250, −338), Max-Josef-Metzger-Platz (312, −269), silent green (465, −94), Weddingplatz (687, −637), Dankeskirche (676, −595), Sparrplatz (62, −518), Pekinger Platz (−352, −714), Nordhafen (274, −1086), Himmelbeet (1322, −602), U Voltastraße (2285, −571), Gesundbrunnen-Center (2018, 359), U Osloer Straße (754, 1136), Uferstudios (1117, 696), Stephanuskirche (1852, 1358), Humboldtsteg (1605, 135). The Müllerstraße ends in a construction fence north-west of the square and at the closed S Wedding arch; the Brunnenstraße ends in a barricade toward the Voltastraße; the Badstraße ends at the Luisenbad.

Compression: about 0.12 east to west and 0.15 to 0.3 north to south (the Leopoldplatz and the palace keep building scale). Several directions sit under 5° from an octant border (Neue Nazarethkirche, Rathaus, Nettelbeckplatz, U Pankstraße, Amtsgericht, Brunnenplatz): move them only away from the border.

**Not checked (placeholder until the data step):** the course of every street (only that the names exist near the places: Müllerstraße, Schulstraße, Lindower Straße, Gerichtstraße, Reinickendorfer Straße, Wiesenstraße, Hussitenstraße, Gustav-Meyer-Allee, Brunnenstraße, Badstraße, Uferstraße, Pankstraße, Oudenarder Straße); the line of the Panke (drawn through the places known to lie on it); the extent of the AEG grounds; the shape of the Leopoldplatz and the park paths. Overpass was not reachable from the cloud session, so no street geometry was drawn from OSM.

**From memory, not verified (the landmark step checks them with photos):** the Ringbahn is elevated at S Wedding and runs in a cutting at Gesundbrunnen (the map shows one brick viaduct with arches in both places, a simplification); the Humboldtsteg is a footbridge over that cutting; the Alte Nazarethkirche is by Schinkel; the Amtsgericht is a neo-Gothic palace-like building; the Beamtentor is the brick gate of the AEG works and the AEG assembly hall is by Peter Behrens; the Osram-Höfe were a lamp factory; the Wiesenburg is the ruin of a homeless shelter; only the north face of the Flakturm stands free, the rest is under the rubble hill; a weekly market is held on the Leopoldplatz; the Luisenbad was the spa of the spring that named Gesundbrunnen; the old Stadtbad Wedding was torn down for new flats; the U9 station order and its orange line colour; the U8 runs from Gesundbrunnen to Alexanderplatz.

**Invented:** the Lampenpalast, the Neubau im Gerüst and its banner „Der Wedding kommt bald“, the Lange Tafel, the Hochzeitskorso jam, the Teestube am Luisenbad and the Baklava & Döner pavilion (from the board), every shop name.

## Enemies, bosses, loot (outline; spec is task step 2)

| Figure | Board | 3D idea (existing blocks first) |
|---|---|---|
| Tee-Ifrit | Tea-vapour spirit rising from a samovar, tulip-glass hands | Caster that keeps its distance: lobs tea glasses in an arc (Speier), each leaves a short puddle of steam. Kill first |
| Baklava-Brocken | Filo and pistachio golem, honey fists, serving-tray shield | Brute with a front that must be turned (Schildträger rule); his slam leaves honey that slows |
| Teppichschlinger | Airborne carpet, woven face, tassel arms | Flyer (Krähe brain) that dives along a marked line (pouncer) and wraps the hero for a moment (Wurzler hold) unless he rolls |
| Zeitlose | Story: in every district | Schlurfer, Hetzer, Brocken and Speier as a building crew and estate agents (hi-vis vest, helmet, suit with brochure): `flavor: 'fest'` skins, no new kinds. They carry the „kommt bald“ joke; nobody is dressed as a neighbour (W6) |
| Boss 1, Nettelbeckplatz | | **Der Korso**: the lead limousine of a wedding motorcade, wrapped in ribbons, honking. Charges along marked lines (Feldwebel charge), calls two escort cars' worth of Hetzer. A rigid body built in code, no rig |
| Boss 2, Maschinenhalle | Historical board B: conversion-gantry golem; story: Der Ewige Bauherr | **Der Ewige Bauherr**: the hall's gantry crane and scaffold come alive. Hook swings (marked arcs), dropped loads (marked circles), calls the building crew. Fits B2: slow, strong, gives the fight an order |
| Boss 3, Brunnenplatz | | **Das Hauptgericht** (the pun with the Amtsgericht behind it): a walking banquet platter with a turning spit as its arm. Spin sweep, honey slams, calls Baklava-Brocken |
| Sultan Nimmersatt, Lampenhof | Der Ewige Gastgeber: gold-vessel sovereign on a carpet throne, tea-urn belly, spoon sceptre | Courses as phases (Vorspeise, Hauptgang, Nachtisch): sceptre slam (marked circle), steam cone from the urn, falling chandeliers, servings of Tee-Ifrite and carpets. The lamps brighten with each course. He will not let a guest leave |
| District rule | 2D had one per district | Recommended „Honig klebt“: honey on the ground slows the hero and enemies on foot (the tunnel flood rule `Level.speedAt`), so it can be used against them. Alternative „Nachschlag“: the last wave of a fight gets one more elite |
| Loot | Set Pracht des Ewigen Gasts, weapon Die Letzte Bestellung (wish-lamp sceptre, a Hammer) | 2D has no Wedding items. Flavour proposals for bases: Dönermesser (Klinge), Mörser (Hammer), Dönerspieß (Speer), a tea-glass Werfer; more rings (the gold shops; the name Ehering is already in `item-names.ts`) |

Neighbours: no crowd and no new NPC system. The hosts are the keepers of the four rest stops (one line each); guests are lit silhouettes behind hall windows.

## Light, sky, weather (look A)

| Topic | Rule |
|---|---|
| Sky | One `WEDDING_SKY`, night: background and fog deep emerald-teal, dim moon, lamps a little stronger than the default night. No per-zone blend (that is Charlottenburg's own engine work) |
| Gold | Only from lamps and cloth. Lamp colours already in the palette: lamp `0xffb060`, string lights `0xffc890`; emerald accents from the existing teal `0x5fd8c8`. One new glow colour at most: ruby, only at the palace and hall fronts |
| Against Mitte | Mitte is wet blue-black with cyan and magenta neon on poles and fronts. Wedding is dry, green-black, with warm paper and brass light hanging over the street |
| Against Charlottenburg | Charlottenburg is silver, glass and violet with white and pink bulbs, searchlights, and time passing from dusk to dawn. Wedding has one night, no white bulbs, no searchlights, no mirrors |
| Against Alexanderplatz | There the gold is the afternoon sun. Here the sky is dark and green |
| Weather | Leopoldkiez petals, Humboldthain leaves, Gesundbrunnen thin mist over the Panke with fireflies, Das ewige Fest gold sparks. Petals and sparks are recolours of the leaf and ember systems |

## Lot types (proposals; mockup first in task step 3)

| Zone | Two of its own | By hand |
|---|---|---|
| 1 Leopoldkiez | Festsaal front (arched lit windows, red carpet, flower arch), Teestube terrace (cushions, samovar, shisha) | Wochenmarkt (the existing `markt` type on the square) |
| 2 Humboldthain | Baustelle with crane and „kommt bald“ billboard (existing type), Werkhof (brick sheds, cable drums, crates) | Rosengarten (beds, pergola), Sommerbad kiosk |
| 3 Gesundbrunnen | Brautmeile (bridal and gold shop row with lit windows), Uferterrasse (carpets and lanterns at the Panke) | Teestube am Luisenbad |
| 4 Das ewige Fest | none | Lange Tafel, Lampenhof |

## Performance (Leistung)

Nothing is measured yet; cloud readouts count draw calls and triangles only. Each build step reports both at four fixed spots (start, Müllerstraße, Maschinenhalle, Lampenhof) on Leistung.

| Item | Cost and limit |
|---|---|
| Size | About 97 000 m², 24 % below Mitte, as Köpenick: fewer chunks and lots than the last two districts |
| Lights | Pool unchanged (the count never changes). Lampions carry no light of their own: paper bodies and halo cards in the chunk's glow batch, at most 16 triangles each and 60 per chunk, no draw call of their own |
| Glow colours | Gold and emerald reuse existing colours: 0 new. Ruby: 1 new glow material in the chunks where a hall front or the palace shows |
| Materials | At most two new: a cloth atlas (awnings, carpets, table cloths, brocade) and a sign atlas (shop fronts, banners, billboards), each one draw call per chunk in view. Scaffold nets use an existing cloth with a vertex tint |
| Landmarks | 15 kinds, at most 6 000 triangles each, the palace 10 000 |
| Weather | One particle system, as every map |
| Target | At or below the Charlottenburg readout at comparable spots (441 to 493 draw calls, 534k to 634k triangles in the cloud readout on Leistung). The guideline of 200 and 200k is met by no generated district today (P1b is open) |

## 2D reuse

2D has no Wedding map, enemies or items: only the era comment (`js/data.js`: „Wedding: 'bald'“, corrected to „kommt bald“ on 2026-11-13) and the art package of pipeline task 16.

| 2D | Use in 3D |
|---|---|
| Final board `docs/style/wedding.png` (already in this repo), the three exploration boards `assets/raw/codex/16-district-design-boards/wedding-a/b/c.png` and the prompts beside them | Art source for look, buildings, enemies, boss, set and weapon. Board A (market, scaffold ghoul, crane golem) and B (Panke, AEG and Osram brick) feed the Zeitlose skins, Der Ewige Bauherr and the two factory zones |
| Story section Wedding and the 2026-11-13 refinement (`docs/story.md`) | Concept, tone, set pieces, boss name |
| Rule of 2026-11-13: no BVG logo, livery or transit costume on the final boards | W6 |
| Tunnel template, waves, elites, side passages, rest stops, lot types, district rule pattern (all ported) | As in every district; line 4 reuses the tunnel with new names |
| Item name Ehering (`chatgpt-assets.md` I37, in `item-names.ts`) | Loot flavour |

No backlog item for Wedding concept art exists in `docs/backlog.md` or in the 2D `BACKLOG.md` (the boards are finished); nothing was moved.

## Camera note

About 6 m of height show at the hero. The feast sits at street level: lampion chains at 4.5 m, awnings with gold fringe at 3 m, lit shop and hall windows, carpets on the pavement and over balcony rails, long tables with samovars, the decorated cars of the Korso. Cranes, the banner and the scaffolds above the second floor appear in reveal shots. The Maschinenhalle and the Lampenhof are open to the sky with a low wall on the camera side (as the two Charlottenburg halls), so they need no interior renderer.
