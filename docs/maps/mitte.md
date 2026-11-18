# Mitte / Potsdamer Platz map (M15)

District 4, 2089: neon future, rain, implants, Kabelghule, the club cult; boss Der Bassprediger (`docs/story.md`). Layout **B2 "Vom Reichstag zum Bass"**: Johannes picked B from three layouts ([`../mockups/m15-mitte-layouts.svg`](../mockups/m15-mitte-layouts.svg)) and revised it ([`../mockups/m15-mitte-b2.svg`](../mockups/m15-mitte-b2.svg)) on 2026-11-18. 2D reference: `js/mitte.js` (v0.47 map and landmarks), `js/data.js` (district row, enemy mix, neon items), `js/update.js` (Kabelghul, Boxenkopf, Bassprediger). Board: `docs/style/potsdamer-platz.png`. Plan and steps: `docs/tasks/m15-mitte.md`. In the network the U2 from Alexanderplatz ends at U Potsdamer Platz (`STOPS[3]` in `src/data/lines.ts`).

## Decisions (Johannes, 2026-11-18)

| # | Decision |
|---|---|
| M1 | Layout B2: start U Potsdamer Platz → Leipziger Straße → Friedrichstraße (the real one, east of the Tor) → Unter den Linden → Brandenburger Tor → Regierungsviertel → small Tiergarten → Kulturforum and Landwehrkanal → Sony Center. One loop, it closes at Potsdamer Platz |
| M2 | Tiergarten about half of the first B and calm: a green intermezzo. The Großer Stern is a real roundabout with the Siegessäule on its island; the Neuer See keeps the beer garden (Café am Neuen See, the zone's rest stop) and a mini-boss |
| M3 | Regierungsviertel and above all Potsdamer Platz bigger and denser, closer to the cyberpunk theme: Potsdamer Platz takes the mockup A pieces (Kulturforum, Landwehrkanal, Tilla-Durieux-Park, Mauerstücke, implant clinic) |
| M4 | Zone bosses are new figures, one per zone, built from existing attack blocks after a spec: Der Türsteher (Tor), Die Wachdrohne (Regierungsviertel), a smaller mini-boss at the Neuer See. Final: Der Bassprediger (2D) in the Sony Center |

## Route (B2, scale 1: about 330 × 396 m, route about 1 km between fights)

Map axes as in the mockup: +x east, north up (in the data z = −north). Data `src/data/mitte.ts`, tests `src/data/mitte.test.ts`, map image from the data [`mitte.svg`](mitte.svg) (regenerate: `MITTE_SVG=docs/maps/mitte.svg npx vitest run src/data/map-svg.test.ts`).

| Zone | Fights (waves) | Boss | Landmarks |
|---|---|---|---|
| 0 Friedrichstraße | Leipziger Straße (3), Friedrichstraße (3), Unter den Linden (3) | Der Türsteher on the Pariser Platz | Leipziger Platz octagon, Mall of Berlin, Galeries Lafayette, Pariser Platz (Adlon, embassies), Brandenburger Tor |
| 1 Regierungsviertel | Dorotheenstraße (3), Spreeufer (3), Platz der Republik (3) | Die Wachdrohne at the Kanzleramt | Reichstag, Jakob-Kaiser-Haus, Marie-Elisabeth-Lüders-Haus, Paul-Löbe-Haus, Kanzleramt, Haus der Kulturen der Welt; Spree as the north edge, Hauptbahnhof as backdrop |
| 2 Tiergarten | Großer Stern (2), on the island around the Siegessäule | Mini-boss at the Neuer See | Siegessäule, Neuer See with the beer garden |
| 3 Potsdamer Platz | Matthäikirchplatz (3), Potsdamer Brücke (2), Tilla-Durieux-Park (2) | Der Bassprediger in the Sony Center (stage) | Sony Center, Bahntower, Kollhoff-Tower, Verkehrsturm, Mauerstücke, Philharmonie, St. Matthäus, Staatsbibliothek, Neue Nationalgalerie, implant clinic, Landwehrkanal |

14 fights, 27 waves, 4 bosses. Side passages (M16b): Checkpoint Charlie as a short dead end south of the Leipziger Straße (cache), a Hinterhof off the Friedrichstraße (hidden blessing), a sleeping elite in the Potsdamer Platz core (place in step 1). Rest stops: a Späti per zone, the beer garden at the Neuer See for zone 2; the 2D name „Späti am Potsdamer Platz“ for zone 3.

Left out on purpose: the Holocaust memorial, the Soviet war memorial in the Tiergarten and the Topographie des Terrors (no zombie fights at memorials). The block between Ebertstraße and Wilhelmstraße becomes ordinary city.

## Geography check (OpenStreetMap Nominatim, 2026-11-18)

Origin U Potsdamer Platz (52.5096 N, 13.3763 E). Real offsets in m east/north; map offsets in m from the start at scale 1 (mockup B2).

| Place | Real E, N | Map E, N | Note |
|---|---|---|---|
| Leipziger Platz | 13, 62 | 15, 13 | ✓ |
| Mall of Berlin | 186, 156 | 43, 34 | NE ✓ |
| Verkehrsturm | −132, 8 | −13, 8 | W ✓ |
| Bahntower | −217, 57 | −45, 16 | W ✓ |
| Sony Center (forum) | about −330, 100 | −77, 23 | W ✓ |
| Kollhoff-Tower | −236, −23 | −43, −14 | WSW ✓ |
| Philharmonie | −583, 92 | −113, 50 | W of the Sony Center ✓ |
| St.-Matthäus-Kirche | −728, −135 | −157, −10 | W, south of the Philharmonie ✓ (move from the mockup's −157, +12) |
| Staatsbibliothek | −500, −199 | −85, −26 | SW ✓ |
| Neue Nationalgalerie | −718, −235 | −151, −42 | SW, west of the Staatsbibliothek ✓ |
| Potsdamer Brücke | −672, −353 | −115, −80 | SW over the canal ✓ |
| Tilla-Durieux-Park | −222, −343 | −33, −42 | S ✓ |
| Checkpoint Charlie | 824, −192 | 135, −18 | ESE ✓ |
| Friedrichstraße (Leipziger to Linden) | about 855, 160 … 845 | 135, 20 … 170 | E ✓ |
| Galeries Lafayette | about 870, 467 | 151, 112 | ✓ |
| Pariser Platz | 32, 800 | 20, 170 | N ✓ |
| Brandenburger Tor | −35, 791 | −10, 170 | N ✓, west end of the Pariser Platz ✓ |
| Reichstag | −143, 1056 | −20, 230 | NNW ✓ |
| Jakob-Kaiser-Haus | about 180, 1045 | 43, 236 | east of the Reichstag ✓ |
| Marie-Elisabeth-Lüders-Haus | 5, 1223 | 37, 268 | east of the Paul-Löbe-Haus ✓ (really across the Spree bend; here both on the south bank) |
| Paul-Löbe-Haus | −231, 1222 | −53, 266 | NW ✓ |
| Kanzleramt | −616, 1227 | −115, 258 | NW, west of the Paul-Löbe-Haus ✓ |
| Haus der Kulturen der Welt | −906, 1071 | −157, 246 | west of the Kanzleramt and a little south ✓ |
| Großer Stern (Siegessäule) | −1926, 529 | −125, 163 | Pulled in strongly. From the Tor due west along the 17. Juni ✓ (real 1.9 km); from the origin NW instead of W because the Potsdamer Platz zone is stretched |
| Neuer See | −2430, 288 | −145, 108 | SSW of the Großer Stern ✓; from the origin NW instead of W (same reason) |
| Hauptbahnhof | −594, 1764 | backdrop beyond the Spree | NNW ✓ |
| Spree at the Reichstag | about 1150 N | north edge | ✓ |
| Landwehrkanal | about 350 S | south edge | ✓ |

Compression: Potsdamer Platz and Kulturforum about 0.2 to 0.25, Friedrichstadt about 0.17 east–west, Regierungsviertel about 0.2, Tiergarten about 0.06 (pulled in). Not checked: side streets, the exact Spree bend (one gentle curve here), block layouts. Placeholders: Komische Oper and the embassies around the Pariser Platz (positions only).

## 2D reuse

| 2D | Use in 3D |
|---|---|
| `js/mitte.js` roads and zones (Ebertstraße, Straße des 17. Juni, Tiergartenstraße, Bellevuestraße, Potsdamer Straße, Stresemannstraße, Scheidemannstraße, Leipziger Straße, Wilhelmstraße, Friedrichstraße, Unter den Linden; zones Tiergarten, Regierungsviertel, Ministergärten, Potsdamer Platz, Kulturforum, Friedrichstadt) | Street list and zone areas of B2 |
| Landmarks: Reichstag (sandstone `#b8ac94`, four corner towers, portico, glass dome with a survivor fire), Brandenburger Tor (six column pairs, walk through, gate houses, attic with the Quadriga `#4a6a58`, stone `#d8c8a0`), Kanzleramt (white cube `#e0ddd4`, round window, low wings), Paul-Löbe-Haus (glass and concrete slab), Siegessäule (red granite base `#5a2a24`, column hall, three gilded rings, Victoria `#e8b830`, on the Großer Stern), Sony Center (ring of six glass blocks with gaps, magenta tent on cables), DB-Turm (round glass, cyan floor bands on generator power), Kollhoff-Tower (dark red brick `#7a3a2a`, stepped top, a few amber windows), Philharmonie (gold `#d8a838` tent roof), Neue Nationalgalerie (glass hall under a black steel roof), Soundsystem stage (speaker stacks, equaliser banner, generator), Implantat-Klinik (counter, lit vials, tarp, cyan cross and cyber-arm sign), Mauerstücke with the bear stencil and paint, striped barriers, Checkpoint Charlie (booth, sandbags, „SIE VERLASSEN DEN AMERIKANISCHEN SEKTOR“ sign), Hauptbahnhof (glass barrel roof, ICE wreck) | Colours, proportions and props for the landmark step |
| Neon: cyan `#43d1cf`, magenta `#ff4fa3`, amber `#e19142`; vertical signs on tower fronts (BASS, CLUB, 24H, KLINIK, TECHNO, KIOSK, SUB, NEON, RAVE); neon poles along the core streets (bear or a word); neon puddles on the roads; rain streaks partly magenta and cyan; cold blue lamps `#6a8cff`; cyber sparks as square pixels without gravity; four-on-the-floor music | Look step |
| District row: lvl 30, dark 0.74, night tint 4,7,12, ground `#221f27`, road `#1a1a20`, walls `#5a5560` `#4a4652` `#625a64`, roofs `#2e2c34` `#38343e`; `cyber`: neon weapon bases (Leuchtröhre, Boxenhammer, Neonflinte, Mikroständer), Regenponcho, Kabelmantel, Neonbrille, implants drop only here (12 %, rare 25 %), the trader offers one, legendary „Arm des Basspredigers“ | `MapDef.flavor: 'neon'` (loot already ported), district 3 |
| Rain rule (`wet`): fire burns 1.4 s instead of 2; a shock chain reaches 190 instead of 140 px and jumps once more | Sim rule for the map (step 5) |
| Enemies and boss (numbers in the task file) | Spec step 5 |
| District card: „Neon, Regen und Implantate. Der Bassprediger hält den Potsdamer Platz.“ / „Regen: Strom springt weiter, Feuer brennt kürzer.“ | Intro banner and Kodex |

## Camera note

The game camera shows about 6 m of height at the hero. The towers of Potsdamer Platz show only their lobbies, so the cyberpunk identity must sit at street level: neon on ground floors and poles below 5 m, lit lobbies, cables across the streets at about 4.5 m, holo barriers, the stage and the clinic, and the wet ground reflecting all of it. Tower tops and the Sony tent roof appear in the reveal shots.
