# PT Hardware and quality checks for Johannes (running list)

Status: open, running list. Johannes checks these on real devices after the open PRs are merged (2026-11-18). Mostly performance, heat and look, not gameplay.

**Every session:** when your work needs a check on real hardware (fps, heat, a look decision, a hitch), add a row here instead of leaving it only in your task file. Keep the row short, link the task file. Johannes fills in Result; the session that picks it up deletes the row once it is answered and acted on (findings go to `docs/playtests.md`).

Cloud browsers have no real GPU: counts of draw calls and triangles are valid there (`node tools/passes.mjs`), fps and temperature are not.

| # | Check | How | Device | From | Result |
|---|---|---|---|---|---|
| 1 | Heat and fps after the heat step 2 (32 m chunks, shadow map at 30 Hz) | Xhain, Oranienstraße, Leistung, `?debug=perf`, 10 min; compare with 2026-11-17 (hot at 50 to 60 fps) | Tab S9, phone | `docs/tasks/p1-heat.md` | |
| 2 | Same with Akkusparen on | If the heat goes away, pixel load dominates (resolution, bloom, pre-pass); if not, draw calls and geometry (P1b first) | Tab S9, phone | `docs/tasks/p1-heat.md` | |
| 3 | `?shadows=boxes` against default: look (small props lose their shadow) and temperature | Same spot, both URLs | Tab S9, phone | `docs/tasks/p1-heat.md` row 4 | |
| 4 | Shadow map at 30 Hz on Leistung: is the hero's shadow late or jumping when running and dodging? Do ground shadows swim while walking? | Leistung, any street with lamps off (moon shadow) | Tab S9, phone, PC with `?profile=Leistung` | `docs/tasks/p1-heat.md` row 2 | |
| 5 | Cutaway: a hitch at the moment of the cut? | Enter a Hinterhof in Xhain, walk behind St. Thomas and Bethanien | Tab S9, phone | `docs/tasks/v1-visibility.md` | |
| 6 | Cutaway look: yard cut height 1.2 m (built) or 4.3 m (`?cut=4.3`); do the near-black caps read as cut buildings or as holes? | Hinterhof in Xhain and Köpenick; `docs/proof/v1b/` | PC | `docs/tasks/v1-visibility.md` › Handover B | |
| 7 | Qualität: fps as before on the PC? | Köpenick and Xhain, `?debug=perf` | PC | PR #50 | |
| 8 | Hero contour cost (R1) | `?stress=40`, hero behind a building, `?debug=perf` | PC, Tab S9 | `docs/tasks/r1-outline-cost.md` | |
| 9 | New hero: first equip swap, inventory doll, fps (H1 step 7) | Equip and unequip clothing in a fight | PC, Tab S9 | `docs/tasks/h1-hero.md` | |
| 10 | Xhain: Oberbaumbrücke towers (22 m, spires) read from the route? Not confirmed in cloud shots (dark, fog) | Walk the final approach on the Oberbaumstraße | PC | `docs/maps/xhain.md` | |
| 11 | Xhain fps and heat on the track field and the Warschauer Brücke (most geometry: tracks, catenary, wagons, deck) and at the East Side Gallery | Start of Xhain, `?debug=perf`, both profiles | Tab S9, PC | `docs/maps/xhain.md` | |
| 12 | Xhain difficulty after Köpenick gear: first zone too easy? Spreehexe too hard? | Play Xhain with the gear from Köpenick | PC | `docs/balance.md` › Xhain | |
| 13 | Blockrand look on the Reichenberger Straße: wider use or keep it to a few streets? | `?map=xhain`, walk Reichenberger and Oranienstraße | PC | `docs/maps/guidelines.md` › Blockrand | |
| 14 | Camp cost: cloud readout on Leistung 333 to 399 draw calls, 214k to 282k triangles with all stations at level 3 (keepers about 40k each, shown within 15 m); fps and heat | `?map=lager` after the S3, walk hall, stairs and yard, `?debug=perf` | Tab S9, PC | `docs/tasks/m20-tunnels-camp.md` › Cost | |
| 15 | Tunnel: flooded stretch look, grating yellow under the teal light, new wall lamps every 12 m (light pool on Leistung) | S3 tunnel, walk to the Zugwrack | PC, Tab S9 | `docs/tasks/m20-tunnels-camp.md` › Open | |
| 16 | Camp rings: footprint-sized and dim; found without the prompt? | Walk to each station in `?map=lager` | PC, Tab S9 | `docs/style-bible.md` › NPC rings | |
| 17 | Alexanderplatz blockout: is the largest map so far (390 × 295 m) too big to walk? fps on the Karl-Marx-Allee (22 m wide, most props in view) | `?map=alex`, walk the loop, `?debug=perf`; try `?mapscale=` | Tab S9, PC | `docs/tasks/m15-alexanderplatz.md` | |
| 18 | Alexanderplatz afternoon light A: bright enough? Lamp heads and window glow at day, sun shadows on the Tab S9 (sun replaces the moon, same one shadow map) | `?map=alex` (default A; `&sky=b` or `c` to compare), walk the Allee and the Lustgarten | Tab S9, PC | `docs/tasks/m15-alexanderplatz.md` | |
| 19 | Alexanderplatz propaganda dressing and falling leaves: fps on the Allee and at the viaduct poster walls (many alpha-tested posters, one extra particle layer) | `?map=alex`, `?debug=perf`, walk the Karl-Marx-Allee and the Burgstraße | Tab S9, PC | `docs/tasks/m15-alexanderplatz.md` | |
| 20 | Alexanderplatz enemies: fps in a full wave (Uhrwerkläufer 12, Wurzler about 14, Kernspeier 9 draw calls each, Brigadeghul +3 over the walker), first load of the mech files (1.2 MB) | `?map=alex&at=4`, `?debug=perf`; `?spawn=uhrwerk,wurzler,kernspeier` | Tab S9, PC | `docs/tasks/m15-alexanderplatz.md` › step 7 | |
| 21 | Final boss: does the Weltzeituhr's wake-up read (lifts off, legs unfold, roar)? fps in its fight (26 draw calls, orbit and gear spirals of up to 96 shots) | `?map=alex&at=12`, walk into the circle | PC, Tab S9 | `docs/tasks/m15-alexanderplatz.md` › step 7 | |
