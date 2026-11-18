# Alexanderplatz map (M15, concept)

District 3: 1989, frozen in autumn; the GDR kept going and grew wild (clockwork, gardens, pioneers). Boss: Volkseigener Koloss (`docs/story.md`). 2D reference: `js/alex.js` in `johakunath/Ruinenstadt` (v0.49 map, landmark drawing, Uhrwerkläufer, Wurzler, Kernspeier, Brigadeghul, Koloss) and its mockup `mockups/v049-alexanderplatz-geo.png`. Style board: `docs/style/alexanderplatz.png`.

## Status

| Step | State |
|---|---|
| 1 Concept | Three layouts in [`../mockups/alex-layouts.svg`](../mockups/alex-layouts.svg) (2026-11-18): A Spreeinsel-Runde, B Magistrale, C Großer Ring. Waiting for Johannes' pick |
| 2 Geography check | Done for the landmarks below |
| 3+ | Not started |

## Open decisions (Johannes)

| # | Question | Recommendation |
|---|---|---|
| AQ1 | Layout A, B or C | B: the strongest GDR identity (Platte, pavilions, Zuckerbäcker, Karl-Marx-Allee) and the most different from Köpenick (no old town island) |
| AQ2 | Time of day: story says daylight district; light rules and look are night-based | Late afternoon / golden hour as on the board: lamps and lit greenhouses still read, one new sky and grade preset, light coverage rule relaxed |
| AQ3 | Zone bosses: 2D has only the Koloss | Elite-sized variants of the new district types (giant Uhrwerkläufer, Wurzler-Mutter, Brigadier) in M12 style; decide with the enemy task |
| AQ4 | Order: migration lists Xhain before Alexanderplatz | Johannes asked for Alexanderplatz first (2026-11-18) |

## Geography check (OpenStreetMap Nominatim, 2026-11-18)

Origin: Weltzeituhr. +E east, +N north (map: x = E, z = −N). Map offsets are set once a layout is chosen.

| Place | Real E (m) | Real N (m) | Note |
|---|---|---|---|
| Weltzeituhr | 0 | 0 | Origin, final boss |
| Brunnen der Völkerfreundschaft | −36 | 97 | North on the plaza |
| Hotel Stadt Berlin (Park Inn) | −35 | 186 | North edge of the plaza |
| S+U Alexanderplatz | −148 | 44 | West-north-west, on the Stadtbahn viaduct |
| Haus des Reisens | 222 | 214 | North-east |
| Haus des Lehrers | 206 | 8 | East, start of Karl-Marx-Allee |
| Kongresshalle | 213 | −54 | East-south-east |
| Fernsehturm | −263 | −37 | West |
| Marienkirche | −415 | −68 | West |
| Neptunbrunnen | −438 | −174 | South-west |
| Rotes Rathaus | −371 | −322 | South-west |
| Nikolaikirche | −392 | −482 | South-west, south of the Rathaus |
| Mühlendammbrücke | −429 | −676 | South-west, over the Spree |
| Rathausbrücke | −629 | −454 | South-west, to the Spreeinsel |
| Liebknechtbrücke | −746 | −264 | West-south-west, to the Spreeinsel |
| Berliner Dom | −827 | −231 | West-south-west, on the Spreeinsel |
| Altes Museum | −983 | −190 | West, Museumsinsel |
| Palast der Republik (Humboldt Forum site) | −818 | −460 | South-west, on the Spreeinsel |
| S Hackescher Markt | −739 | 165 | West-north-west |
| Volksbühne | −94 | 652 | North |
| Kino International | 660 | −54 | East, Karl-Marx-Allee |
| Café Moskau | 618 | −180 | East-south-east, Karl-Marx-Allee |
| Strausberger Platz | 1234 | −341 | East-south-east, end of the 1st KMA section |
| Jannowitzbrücke | 419 | −773 | South-south-east, over the Spree |
| Märkisches Museum | 88 | −849 | South, across the Spree |

Real span Dom to Strausberger Platz is about 2 km; every layout compresses to 320 to 390 m wide (about 0.15 to 0.2 of real distances, non-uniform). Not checked: side streets, block layouts, the exact viaduct curve.
