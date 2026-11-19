# Charlottenburg map (M16) [Claude · Fable high]

District 5, 1920: Golden Twenties, Ku'damm cabarets and cinemas, Art Deco, jazz, Ringverein; the Schloss is where it bleeds into baroque (hedge maze, mirror halls) and where the boss waits (`docs/story.md`). Art: silver, diamonds, cut glass, violet, pearl, ink-teal and berry accents, little gold (`docs/district-design-directions.md` › Final · Charlottenburg, board `docs/style/charlottenburg.png`). Plan and steps: `docs/tasks/m16-charlottenburg.md` (written after the layout pick).

**State 2026-11-19: concept. Three layouts shown, Johannes picks.** Mockup: [`../mockups/m16-charlottenburg-layouts.svg`](../mockups/m16-charlottenburg-layouts.svg) (PNG beside it). Notes below are short on purpose; Opus writes the final text with the data step.

## Layouts (same scale; Mitte is 330 × 387 m, route about 1 km, 14 fights)

| | A Boulevard | B Großer Ring | C Spiegelschloss (recommended) |
|---|---|---|---|
| Size | 380 × 250 m | 360 × 400 m | 260 × 390 m |
| Route | about 680 m, open line east → west → north | about 990 m, closed ring plus the Schloßstraße | about 910 m, L plus a loop round the Schloss |
| Start | U Wittenbergplatz | U Sophie-Charlotte-Platz | S+U Zoologischer Garten |
| Zones | Tauentzien and Zoo; Ku'damm; Lunapark and Lietzensee; Schloss | Oper and Knie; Zoo; Ku'damm; Schloss | Ku'damm; Savignyplatz and Oper; Schlossgarten; Spiegelschloss |
| Fights | 9 + 4 bosses, 25 waves | 9 + 4 bosses, 27 waves | 9 + 4 bosses, 25 waves |
| For | Most revue, shortest, KaDeWe and Lunapark | Every sight, the Schloss in view from the first step | Half revue, half mirror Schloss, as the picked board (A+C); maze and mirror gallery get room; 20 % less area than Mitte |
| Against | No loop; Schloss only as an end piece; a third of the bounds is backdrop | Largest map, dead block interior, Schloss stays an appendix | Ku'damm only about 150 m, no Lunapark, KaDeWe or Lietzensee; the garden needs content or it reads empty |

Same in all three:
- Final boss Die Diamantene Diva in the Ehrenhof (south court). The camera looks north, so facade and dome stand behind the fight as the stage. A fight in the garden would have the Schloss behind the camera.
- The Schloßstraße is walked south → north: the dome grows on the axis (reveal shot).
- The Stadtbahn viaduct (brick, open arches where streets pass, as in Xhain and Alexanderplatz) is a visible edge.
- Ku'damm runs east–west: show fronts (Revuepalast, cinemas) on the north side, low on the camera side (Blockrand rule).
- Hedge maze and mirror gallery are invented (story); everything else stands where it stands in Berlin.

Why C: the picked direction is half Ku'damm revue, half broken mirror Schloss. Only C gives the Schloss half its own zones (maze, Karpfenteich, Belvedere, the burnt-out Orangerie as mirror gallery) and keeps the map smaller than Mitte. The locked Ehrenhof gate at the end of the Schloßstraße is the teaser; the loop round the Schloss never walks a street twice. Start and next line both use S+U Zoo (see C3, C5).

## Decisions

Proposed by Claude (Fable) on 2026-11-19; Johannes confirms or changes. C1 is open.

| # | Decision | State |
|---|---|---|
| C1 | Layout A, B or C | open (recommendation C) |
| C2 | Look: night is the base. Step 3 builds three variants in game: **A Premierennacht** (the board: clear and dry, cold moon, white and pink bulb marquees, prism rays, diamond dust instead of rain), **B Blaue Stunde** (dusk: violet-teal sky, berry horizon, lamps just on; facades and garden read better), **C Rampenlicht** (night, sky lit by sweeping searchlights, stage haze, strongest pink and white). Default A. Mitte before it is a wet violet neon night, so B is the real alternative. Mirrors are fake (environment gloss and a moving highlight), no planar reflections | proposed |
| C3 | Network: line 3 is the U2 running on from U Potsdamer Platz: `LINES[3] = { id: 'U2', color: '#da421e', ghost: 'Bülowstraße' }`. Arrival `STOPS[4].station`: C `S+U Zoologischer Garten` (A `U Wittenbergplatz`, B `U Sophie-Charlotte-Platz`). Lines 2 and 3 then both show the U2 badge; ids are labels only, saves use `LINE_FREED + index` (checked in `netboard.ts`, `tunnel.ts`, `boot.ts`, `main.ts`). Keep the index order. Move the stop on the network map west of Mitte (now it sits south, where 2D had Tempelhof). The U6, "Französische Straße" and "U Platz der Luftbrücke" are 2D leftovers (2D district 4 was Tempelhof) | proposed |
| C4 | Tier: 32 to 54 as a provisional value (keeps +8 per district and the rising-difficulty tests). Not calibrated: the chain run shows carried gear makes every district after Köpenick far too easy (`docs/balance.md` › District chain, backlog P33). No bot calibration for Charlottenburg before the M14/B2 decision; the flow and balance step waits for it | proposed |
| C5 | Fernsehturm finale (not planned here): network stop 5 becomes the Fernsehturm at S+U Alexanderplatz and replaces Spandau; Marzahn and its line go. Line 4 is the Stadtbahn from S+U Zoologischer Garten east to Alexanderplatz (the 2D S5 badge and colour fit; ghost station candidate Lehrter Bahnhof). With layout C the U2 arrives and the S-Bahn leaves at the same station | proposed |
| C6 | Era and recognisability: sights look as people know them, time is broken anyway. Gedächtniskirche with the broken spire (in 1920 it was whole; today's ruin is the icon and fits the ruined city). Kranzler-Eck by its known name. Ernst-Reuter-Platz is „Knie“, the Deutsche Oper „Deutsches Opernhaus“, the TU „Technische Hochschule“, the Europa-Center site is the Romanisches Café | proposed |

## Geography check (OpenStreetMap Nominatim, 2026-11-19)

Origin Kaiser-Wilhelm-Gedächtniskirche (52.5048 N, 13.3352 E). Real offsets in m east, north, and the compass octant from the origin. Map columns are for layout C (data anchors for step 1, scale 1, m east and north of the church at mockup position (112, −148)); empty where C does not use the place. If A or B is picked, redo the map columns.

| Place | Real E, N | Octant | Map E, N (C) | Octant | Note |
|---|---|---|---|---|---|
| Bahnhof Zoo | −178, 294 | NW | −28, 45 | NW ✓ | start, on the Stadtbahn |
| Hardenbergplatz | −138, 218 | NW | | | station forecourt |
| Zoo Löwentor | −7, 360 | N | | | backdrop north of the station |
| Zoo Elefantentor | 310, 93 | E | | | A only (Budapester Straße) |
| Zoo-Aquarium | 383, 135 | E | | | not used |
| Zoo Palast | −64, 146 | NW | | | 1920: Ufa-Palast am Zoo; candidate front beside the station |
| Europa-Center | 156, −46 | E | 14, −2 | E ✓ | site of the Romanisches Café, at the east edge |
| Marmorhaus | −57, −84 | SW | | | 1913 cinema on the Ku'damm beside the church; candidate front |
| Tauentzienstraße | 184, −111 | SE | | | runs south-east from the church; in C a stub that ends in a barricade (bearing 127° in the mockup ✓) |
| KaDeWe | 394, −357 | SE | | | A only |
| U Wittenbergplatz | 529, −332 | SE | | | A start |
| Kranzler-Eck (Ku'damm 18) | −289, −74 | W | −60, −7 | W ✓ | corner Joachimsthaler Straße |
| Joachimsthaler Platz | −300, −163 | SW | | | not used |
| U Uhlandstraße | −576, −220 | W | −96, −12 | W ✓ | the Revuepalast (invented) stands here, north side |
| Literaturhaus Fasanenstraße | −553, −290 | SW | | | candidate for a side passage (villa garden) |
| Haus Cumberland | −1158, −485 | SW | | | A and B |
| Olivaer Platz | −1393, −594 | SW | | | A and B; in C the Ku'damm ends in a barricade west of the Bleibtreustraße |
| Adenauerplatz | −1889, −532 | W | | | A and B |
| Schaubühne (Universum cinema, 1928), Lehniner Platz | −2231, −681 | W | | | A and B |
| S Halensee | −3025, −974 | W | | | Lunapark site (1909 to 1934, at the Halensee); A and B |
| Halensee (lake) | −3721, −1197 | W | | | A and B backdrop |
| Theater des Westens | −419, 124 | W | −56, 21 | W ✓ | Kantstraße, east of the Stadtbahn crossing; side passage |
| Delphi Filmpalast | −456, 143 | W | | | beside the Theater des Westens |
| S Savignyplatz | −1093, 43 | W | −122, 16 | W ✓ | the Stadtbahn runs south of the Kantstraße here (at Zoo it is north of it), the square is north of the viaduct |
| Steinplatz | −570, 444 | NW | | | B |
| Ernst-Reuter-Platz | −883, 789 | NW | −67, 82 | NW ✓ | „Knie“; move west of the mockup position (60 → 45) |
| TU main building | −555, 815 | NW | −44, 94 | NW ✓ | east of the Knie ✓; move west of the mockup position (92 → 68) |
| Charlottenburger Tor | −254, 910 | N | | | B backdrop |
| Schiller Theater | −1108, 753 | NW | −102, 96 | NW ✓ | between Knie and Oper, north side; backdrop |
| Deutsche Oper | −1817, 818 | NW | −157, 98 | NW ✓ | north side of the Bismarckstraße ✓, at the end of the Krumme Straße |
| U Bismarckstraße | −2030, 748 | W | | | junction only |
| U Wilmersdorfer Straße | −1935, 210 | W | | | A and B |
| Stuttgarter Platz | −2230, 47 | W | | | A and B |
| Bahnhof Charlottenburg | −2206, −52 | W | | | A and B, on the Stadtbahn |
| U Sophie-Charlotte-Platz | −2633, 681 | W | −192, 73 | W ✓ | south end of the Schloßstraße; move south-west of the mockup position, the Bismarckstraße falls toward the west as in reality |
| U Kaiserdamm | −3528, 590 | W | | | A and B |
| Lietzensee | −3195, 182 | W | | | A and B |
| Funkturm (1926) | −3866, 27 | W | | | not used; possible skyline in the west |
| Rathaus Charlottenburg | −1788, 1423 | NW | −76, 140 | NW ✓ | tower as backdrop, side passage off the Otto-Suhr-Allee |
| Luisenkirche | −2218, 1381 | NW | | | candidate landmark between Rathaus and Schloss |
| Luisenplatz | −2411, 1698 | NW | −114, 178 | NW ✓ | east of the Schloss ✓ |
| Schloßbrücke (Spree) | −2375, 1906 | NW | −90, 198 | NW ✓ | move west of the mockup position (36 → 22) |
| Caprivibrücke | −1963, 1770 | NW | | | the Spree comes from the east; backdrop with the Kraftwerk Charlottenburg |
| Dovebrücke | −1079, 1630 | NW | | | Spree further east; not used |
| Neuer Pavillon | −2437, 1839 | NW | −106, 204 | NW ✓ | east end of the Schloss ✓, zone 3 rest stop |
| Schloss Charlottenburg | −2879, 1763 | NW | −187, 194 | NW ✓ | the OSM point lies west of the dome; the dome is on the Schloßstraße axis (about −2650) |
| Große Orangerie | −2820, 1768 | NW | −224, 194 | NW ✓ | west of the dome ✓: the Spiegelgalerie |
| Museum Berggruen (Stülerbau) | −2703, 1592 | NW | −196, 160 | NW ✓ | west corner at the north end of the Schloßstraße; its twin stands on the east corner |
| Klausenerplatz | −2953, 1522 | NW | −227, 156 | NW ✓ | west of the Schloßstraße; zone 4 rest stop nearby |
| Karpfenteich | −2724, 2258 | NW | −182, 280 | NW ✓ | north of the parterre ✓ |
| Mausoleum | −2941, 2164 | NW | −238, 282 | NW ✓ | west of the pond ✓; landmark only, no fight at a tomb |
| Belvedere | −2699, 2531 | NW | −170, 322 | NW ✓ | north tip of the garden at the Spree ✓ |
| Schlosspark (OSM bounds) | −3400 … −2400, 1660 … 2730 | NW | | | the Spree bounds it in the east and north ✓ |
| U Potsdamer Platz | 2808, 513 | E | | | the U2 arrives from the east |

Compression in C: Ku'damm strip about 0.14, church to Schloss about 0.06 east–west and 0.1 north–south, Schloss and garden about 0.16 to 0.25 (the Schloss front, about 500 m from memory, is about 125 m here).

Not checked (placeholder until the data step or the landmark photos): side streets (Bleibtreustraße, Krumme Straße, Joachimsthaler Straße) only by name; which side of the Kantstraße the Theater des Westens stands on; the exact Stadtbahn curve and where it crosses the Kantstraße (between Zoo and Savignyplatz, from the two station rows above); the Spree bend at the Schlossbrücke; garden paths. From memory, not verified (Wikipedia was rate limited): the wing order of the Schloss beyond the OSM points (Theaterbau at the far west end); U Bülowstraße closed 1972 to 1993 while the U2 was cut; Kranzler on the Ku'damm only since 1932 (Café des Westens before); the Großer Kurfürst statue in the Ehrenhof only since 1952; Lehrter Stadtbahnhof demolished 2002. Verified: Lunapark 1909 to 1934 at the Halensee; Romanisches Café east of the church on the Europa-Center site.

## 2D reuse

2D has no Charlottenburg map: only the era string (`js/data.js` `ERA`, comment „Charlottenburg: 1920 once they exist“). Its network slot 4 was Tempelhof (`STN[4]` „U Platz der Luftbrücke“, U6).

| 2D | Use in 3D |
|---|---|
| Tunnel template `js/ubahn.js` (already ported, `src/data/tunnel.ts`) | Line 3 reuses it with new names (C3) |
| Waves, elites, side passages, rest stops, lot types (already ported) | As in every district |
| District rule pattern (Mitte `wet`: one sim rule per district) | Charlottenburg gets one rule of its own; candidates in the enemy spec step (shards, mirrors) |
| Zeitlose in every district (story) | Ghoul, brute and spitter in 1920s dress under the three board enemies |

## Camera note

About 6 m of height show at the hero. The revue identity sits at street level: marquee canopies with bulb rows at 4 m, poster columns, velvet ropes, cinema entrances, shop windows, glass shards on the ground. In the garden: hedges up to 2.2 m (the camera sees over them, they block as visible walls), statues, mirror panels standing in hedge gaps. The dome and the marquee fans appear in reveal shots. The Orangerie is a roofless ruin, so the mirror gallery needs no interior and no new cutaway: tall north wall with mirrors, low broken south wall.
