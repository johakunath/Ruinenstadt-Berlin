# P1 Tablet heat [Claude · Opus high; Johannes measures on the Tab S9]

Status: step 1 built 2026-11-17, measurement open. Playtest Johannes, 2026-11-17: Leistung runs at 50–60 fps on the Tab S9 and looks good, but the tablet gets hot, not only in fights.

## Step 1 (built)
- **Akkusparen** switch (2D `S.eco`): 30 fps cap and at most 1× pixel ratio. On the start screen and in Optionen; stored. Default off.
- Behind still overlays (trade, blessing choice, intro cards) the world draws at about 10 fps; the open menu draws nothing (as before).

## Next candidates (measure first, one at a time, on the Tab S9 with `?debug=perf` and the tablet's temperature after 10 min)
| Candidate | Expected gain | Risk |
|---|---|---|
| Sun shadow map: re-render only every 2nd frame or when the hero moved > 0.5 m (Leistung) | One full scene pass less per frame | Shadow lag on fast enemies |
| Default Akkusparen on for coarse pointers | Halves GPU work | Less smooth by default |
| Normal/depth pre-pass (ink outline) at 0.5 scale on Leistung | Smaller pass | Thinner, softer ink lines |
| Bloom off or half resolution on Leistung | One blur chain less | Less glow on fires and lamps |
| Dynamic resolution: drop DPR when frame time stays under budget anyway | Same fps, less heat | Softer image |

Done when: Johannes reports the tablet stays warm, not hot, after 15 min of play on the chosen setting.
