# Charlottenburg map (M16) [Claude · Fable high]

District 5, 1920: Golden Twenties, Ku'damm cabarets and cinemas, Art Deco, jazz, Ringverein; the Schloss is where it bleeds into baroque (hedge maze, mirror halls) and where the boss waits (`docs/story.md`). Art: silver, diamonds, cut glass, violet, pearl, ink-teal and berry accents, little gold (`docs/district-design-directions.md` › Final · Charlottenburg, board `docs/style/charlottenburg.png`).

Layout **C2 „Spiegelschloss“**: Johannes picked C from three layouts ([`../mockups/m16-charlottenburg-layouts.svg`](../mockups/m16-charlottenburg-layouts.svg)) and asked for more City West (2026-11-19); the revision is [`../mockups/m16-charlottenburg-c2.svg`](../mockups/m16-charlottenburg-c2.svg) (PNGs beside both). Plan, steps and anchors: `docs/tasks/m16-charlottenburg.md`. The mockup is schematic; the anchors table in the task file rules. Notes here are short on purpose; Opus writes the final text with the data step.

## Decisions

| # | Decision | By |
|---|---|---|
| C1 | Layout C2: start S+U Zoologischer Garten → through the Zoo (Löwentor in, Elefantentor out) → Nürnberger Straße → KaDeWe (walk-in) → Tauentzien → Gedächtniskirche → Ku'damm → Stadtbahn arch, Savignyplatz, Kantstraße → Opernhaus → Schloßstraße north to the locked Ehrenhof gate → round the Schloss through the garden (Luisenplatz, maze, Karpfenteich, Belvedere) → the burnt-out Orangerie as mirror gallery → Ehrenhof. No street twice | Johannes, 2026-11-19: C, with more of the Zoo, the church, KaDeWe and the boulevard; the route may get longer |
| C2 | Look: time passes along the route, one evening to the morning. Zone 1 **Blaue Stunde** (dusk, lamps and the first searchlights come on), zone 2 **Premierennacht** (full night, bulb marquees, sweeping searchlights), zone 3 **Mondnacht** (clear, cold moon, mist, prism light), zone 4 **Morgengrauen** (pale dawn behind the dome, the last curtain). Dry, no rain; diamond dust and confetti instead. Needs a sky that blends per zone (task step 3a); fallback: one Premierennacht sky for the map. Mirrors are fake (environment gloss, a moving highlight), no planar reflections | Johannes, 2026-11-19 (agreed with the proposed night look and asked for the passing time) |
| C3 | Network: line 3 is the U2 running on from U Potsdamer Platz: `LINES[3] = { id: 'U2', color: '#da421e', ghost: 'Bülowstraße' }`; `STOPS[4].station = 'S+U Zoologischer Garten'`. Lines 2 and 3 both show the U2 badge. Freed lines are saved as `LINE_FREED + index`, so progress is safe. Not safe (review, 2026-11-19): the tunnel's map name and its run-save lookup are built from the badge (`tunnel.ts`, `boot.ts`), so both would be „U2-Tunnel“ and a saved run in one would be offered in the other. Task step 8 must key them by line index (or name the second one by its direction) before line 3 becomes playable. Keep the index order. Move the stop on the network map west of Mitte (it sits south, where 2D had Tempelhof). The U6, „Französische Straße“ and „U Platz der Luftbrücke“ are 2D leftovers | Arrival station: Johannes, 2026-11-19. Line and ghost: Claude, proposed |
| C4 | Tier: 32 to 54 as a provisional value (keeps +8 per district and the rising-difficulty tests). Not calibrated: carried gear makes every district after Köpenick far too easy (`docs/balance.md` › District chain, backlog P33). No bot calibration for Charlottenburg before the M14/B2 decision; task step 8 waits for it | Claude, proposed |
| C5 | Fernsehturm finale (not planned here): network stop 5 becomes the Fernsehturm at S+U Alexanderplatz and replaces Spandau; Marzahn and its line go. Line 4 is the Stadtbahn from S+U Zoologischer Garten east to Alexanderplatz (the 2D S5 badge and colour fit; ghost station candidate Lehrter Bahnhof). The U2 arrives and the S-Bahn leaves at the same station | Claude, proposed |
| C6 | Everything as in 1920: Altbau, no high-rises, nothing built later. Table *1920 instead of today* below. Sights are worn like every landmark (guideline, 2026-11-18) but whole in their 1920 shape | Johannes, 2026-11-19 |

## Route (C2, scale 1: about 320 × 410 m, route about 1.1 km between fights)

Mitte for comparison: 330 × 387 m, about 1 km, 14 fights, 27 waves.

| Zone | Time | Fights (waves) | Boss | Landmarks |
|---|---|---|---|---|
| 1 Zoo & Tauentzien | Blaue Stunde | Konzertgarten in the Zoo (2), Elefantentor (3), KaDeWe Lichthof (3) | Boss 1 at the Gedächtniskirche | Bahnhof Zoo (1882), Löwentor, Antilopenhaus, Musikpavillon, Elefantentor, Aquarium, Ufa-Palast am Zoo, Capitol shop row, Romanisches Café, KaDeWe, U Wittenbergplatz, Gedächtniskirche |
| 2 Ku'damm & Savignyplatz | Premierennacht | Café des Westens (3), Revuepalast (3), Savignyplatz (3) | Boss 2 in front of the Opernhaus | Gloria-Palast, Marmorhaus, Café des Westens, Revuepalast (invented), Stadtbahn arches, Theater des Westens, Gläsernes Varieté (invented), Deutsches Opernhaus; Schiller-Theater, Technische Hochschule and the Rathaus tower as backdrop |
| 3 Schlossgarten | Mondnacht | Schloßstraße (2), Luisenplatz (3), Irrgarten (3), Karpfenteich (2, calm) | Boss 3 at the Belvedere | Stülerbauten, the locked Ehrenhof gate, Neuer Pavillon (rest stop), maze (invented), Karpfenteich, Belvedere, Mausoleum (no fight), Spree |
| 4 Spiegelschloss | Morgengrauen | Spiegelgalerie in the Orangerie ruin (3) | Die Diamantene Diva in the Ehrenhof | Orangerie, Schloss with dome, Neuer Flügel |

11 fights, 30 waves, 4 bosses. Rest stops: a kiosk at the Zoo, a Späti in a Stadtbahn arch at Savignyplatz, the Neuer Pavillon as tea house, a Späti at the Klausenerplatz. Side passages: the Antilopenhaus in the Zoo (sleeping elite), the Capitol passage (cache), a Hinterhof off the Bleibtreustraße (hidden blessing), the Gläsernes Varieté (sleeping elite). In the maze: light riddles from existing mechanics (task file).

Why the Ehrenhof: the camera looks north, so facade and dome stand behind the final fight as the stage; in the garden the Schloss would be behind the camera. The Schloßstraße is walked south → north, the dome grows on the axis (reveal shot), and the gate at its end is locked: the way round the Schloss is the last third of the district.

## 1920 instead of today

| Today | 1920 in the game | Source |
|---|---|---|
| Bikini-Haus (1957) | Two-storey shop row with the cinema Capitol am Zoo (Poelzig, 1925), a passage as side branch. The walk-in store is the KaDeWe (1907): Lichthof with the glass roof in shards | Capitol: Wikipedia, checked. KaDeWe year: memory |
| High-rises (Zoofenster, Upper West, Europa-Center) | None. Corner houses with domes and turrets, the two Romanische Häuser and the church towers are the skyline | „Romanisches Forum“ at the Auguste-Viktoria-Platz: Wikipedia, checked |
| Gedächtniskirche ruin | Whole, five towers (1895), worn | memory |
| Bahnhof Zoo (1930s hall) | The 1882 station on the Stadtbahn viaduct | memory; photos in step 4 |
| Zoo | Existed (1844): Löwentor at the station, Elefantentor (1899) on today's Budapester Straße, Antilopenhaus, concert garden with music pavilion | memory; photos in step 4 |
| Zoo Palast | Ufa-Palast am Zoo, the leading premiere cinema | Wikipedia, checked |
| Europa-Center | Romanisches Café, east of the church | Wikipedia, checked |
| Kranzler-Eck | House of the Café des Westens („Café Größenwahn“, Ku'damm 18/19, corner Joachimsthaler Straße; the café itself closed 1915) | Wikipedia, checked |
| Breitscheidplatz, Budapester Straße, Ernst-Reuter-Platz | Auguste-Viktoria-Platz (until 1947), part of the Kurfürstendamm (renamed 1925), „Knie“ | first: checked; others: memory |
| Deutsche Oper, TU | Deutsches Opernhaus (1912), Technische Hochschule | memory |
| Gloria-Palast (1926), Marmorhaus (1913), Theater des Westens (1896), Schiller-Theater (1907), Rathaus Charlottenburg (1905) | As built; all fit the decade | Gloria-Palast named in the Capitol article; years: memory |
| Großer Kurfürst statue in the Ehrenhof (there since 1952) | Left out: the court is the Diva's stage | memory |

Step 4 researches each sight from pre-1930 photos (Wikimedia) and corrects this table.

## Geography check (OpenStreetMap Nominatim, 2026-11-19)

Origin Kaiser-Wilhelm-Gedächtniskirche (52.5048 N, 13.3352 E). Real offsets in m east, north, with the compass octant from the origin. Map offsets are the C2 anchors (scale 1) relative to the church at x 112, z 137.

| Place | Real E, N | Octant | Map E, N | Octant | Note |
|---|---|---|---|---|---|
| Bahnhof Zoo | −178, 294 | NW | −54, 41 | NW ✓ | on the Stadtbahn |
| Hardenbergplatz | −138, 218 | NW | −36, 37 | NW ✓ | start, east of the station ✓ |
| Zoo Löwentor | −7, 360 | N | −12, 45 | N ✓ | east side of the Hardenbergplatz ✓ |
| Zoo (centre of the grounds) | 274, 407 | NE | 28, 62 | NE ✓ | only the south-west corner is on the map |
| Zoo Elefantentor | 310, 93 | E | 58, 19 | E ✓ | on the Budapester Straße |
| Zoo-Aquarium | 383, 135 | E | 71, 25 | E ✓ | east of the Elefantentor ✓, at the map edge |
| Zoo Palast (Ufa-Palast am Zoo) | −64, 146 | NW | −16, 25 | NW ✓ | between station and church ✓ |
| Europa-Center (Romanisches Café) | 156, −46 | E | 20, −4 | E ✓ | |
| Marmorhaus | −57, −84 | SW | −18, −35 | SW ✓ | south side of the Ku'damm (camera side: roof sign) |
| Tauentzienstraße | 184, −111 | SE | 22, −40 | SE ✓ | runs south-east from the church ✓ |
| KaDeWe | 394, −357 | SE | 36, −66 | SE ✓ | south-west side of the Tauentzien ✓ (OSM: south of the street line) |
| U Wittenbergplatz | 529, −332 | SE | 65, −61 | SE ✓ | east of the KaDeWe ✓ |
| Kranzler-Eck (Café des Westens) | −289, −74 | W | −58, −19 | W ✓ | corner Joachimsthaler Straße |
| U Uhlandstraße | −576, −220 | W | −92, −25 | W ✓ | the Revuepalast stands here, north side |
| Theater des Westens | −419, 124 | W | −54, 13 | W ✓ | Kantstraße, east of the Stadtbahn crossing |
| S Savignyplatz | −1093, 43 | W | −122, 5 | W ✓ | the Stadtbahn runs south of the Kantstraße here and north of it at Zoo; the square is north of the viaduct |
| Ernst-Reuter-Platz („Knie“) | −883, 789 | NW | −72, 75 | NW ✓ | |
| TU main building | −555, 815 | NW | −50, 99 | NW ✓ | east of the Knie ✓, backdrop |
| Charlottenburger Tor | −254, 910 | N | −12, 99 | N ✓ | backdrop at the east end of the Chaussee |
| Schiller-Theater | −1108, 753 | NW | −107, 83 | NW ✓ | between Knie and Oper ✓, backdrop |
| Deutsche Oper | −1817, 818 | NW | −157, 83 | NW ✓ | north side of the Bismarckstraße ✓, end of the Krumme Straße |
| U Sophie-Charlotte-Platz | −2633, 681 | W | −190, 61 | W ✓ | south end of the Schloßstraße; the Bismarckstraße falls toward the west as in reality |
| Rathaus Charlottenburg | −1788, 1423 | NW | −80, 129 | NW ✓ | tower as backdrop on the Otto-Suhr-Allee |
| Luisenplatz | −2411, 1698 | NW | −114, 161 | NW ✓ | east of the Schloss ✓ |
| Schloßbrücke (Spree) | −2375, 1906 | NW | −96, 209 | NW ✓ | north of the Neuer Pavillon ✓ |
| Neuer Pavillon | −2437, 1839 | NW | −110, 187 | NW ✓ | east end of the Schloss ✓, between Luisenplatz and bridge ✓ |
| Schloss Charlottenburg | −2879, 1763 | NW | −187, 203 | NW ✓ | the OSM point lies west of the dome; the dome is on the Schloßstraße axis (about −2650) |
| Große Orangerie | −2820, 1768 | NW | −230, 199 | NW ✓ | west of the dome ✓ |
| Museum Berggruen (Stülerbau) | −2703, 1592 | NW | −198, 141 | NW ✓ | west corner at the north end of the Schloßstraße; its twin on the east corner |
| Klausenerplatz | −2953, 1522 | NW | −227, 141 | NW ✓ | west of the Schloßstraße ✓ |
| Karpfenteich | −2724, 2258 | NW | −182, 279 | NW ✓ | north of the parterre ✓ |
| Mausoleum | −2941, 2164 | NW | −238, 277 | NW ✓ | west of the pond ✓ |
| Belvedere | −2699, 2531 | NW | −170, 317 | NW ✓ | north tip of the garden at the Spree ✓ |
| Schlosspark (OSM bounds) | −3400 … −2400, 1660 … 2730 | NW | | | the Spree bounds it in the east and north ✓ |
| U Potsdamer Platz | 2808, 513 | E | | | the U2 arrives from the east |

Looked up, not on the map: Joachimsthaler Platz (−300, −163), Literaturhaus Fasanenstraße (−553, −290), Haus Cumberland (−1158, −485), Olivaer Platz (−1393, −594), Adenauerplatz (−1889, −532), Schaubühne at the Lehniner Platz (−2231, −681), S Halensee (−3025, −974; Lunapark site, 1909 to 1934), Halensee (−3721, −1197), Delphi (−456, 143), Steinplatz (−570, 444), U Bismarckstraße (−2030, 748), U Wilmersdorfer Straße (−1935, 210), Stuttgarter Platz (−2230, 47), Bahnhof Charlottenburg (−2206, −52), U Kaiserdamm (−3528, 590), Lietzensee (−3195, 182), Funkturm (−3866, 27), Luisenkirche (−2218, 1381), Caprivibrücke (−1963, 1770), Dovebrücke (−1079, 1630). The Ku'damm ends in a barricade west of the Bleibtreustraße, the Tauentzien at the Wittenbergplatz.

Compression: City West about 0.18 to 0.2, church to Schloss about 0.06 east–west and 0.1 north–south, Schloss and garden about 0.16 to 0.25. Several directions sit close to an octant border (Elefantentor, Café des Westens, TU, Schloßbrücke: under 5°); move them only away from the border.

Not checked (placeholder until the data step or the photos): side streets (Bleibtreustraße, Krumme Straße, Joachimsthaler Straße, Nürnberger Straße) only by name; the position of the Capitol shop row, the Gloria-Palast and the Antilopenhaus; which side of the Kantstraße the Theater des Westens stands on; the exact Stadtbahn curve; the Spree bend at the Schloßbrücke; garden paths. From memory, not verified (Wikipedia was rate limited): the wing order of the Schloss beyond the OSM points (Theaterbau at the far west end); U Bülowstraße closed 1972 to 1993 while the U2 was cut; Lehrter Stadtbahnhof demolished 2002; trams on the Ku'damm.

## 2D reuse

2D has no Charlottenburg map: only the era string (`js/data.js` `ERA`, comment „Charlottenburg: 1920 once they exist“). Its network slot 4 was Tempelhof (`STN[4]` „U Platz der Luftbrücke“, U6).

| 2D | Use in 3D |
|---|---|
| Tunnel template `js/ubahn.js` (already ported, `src/data/tunnel.ts`) | Line 3 reuses it with new names (C3) |
| Waves, elites, side passages, rest stops, lot types (already ported) | As in every district |
| Tunnel gratings and the generator hold (`Level.gates`, `hold`) | Maze riddles: crystal plinths to stand on, hedge gates that open |
| District rule pattern (Mitte `wet`: one sim rule per district) | One rule of its own; decided in the enemy spec |
| Zeitlose in every district (story) | Ghoul, brute and spitter in 1920s dress under the three board enemies |

## Camera note

About 6 m of height show at the hero. The revue identity sits at street level: marquee canopies with bulb rows at 4 m, poster columns, velvet ropes, cinema entrances, shop windows, shards on the ground. In the garden: hedges up to 2.2 m (the camera sees over them, they block as visible walls), statues, mirror panels in hedge gaps. Domes, church towers and marquee fans appear in reveal shots. The KaDeWe stands south of the Tauentzien, between camera and street: its street front is seen in the reveal shot and from inside; its sign goes on the roof edge. Walk-in halls (KaDeWe Lichthof, Orangerie) are roofless ruins with a low camera-side wall, so they need no interior renderer.
