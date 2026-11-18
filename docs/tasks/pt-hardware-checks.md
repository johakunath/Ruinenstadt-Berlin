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
