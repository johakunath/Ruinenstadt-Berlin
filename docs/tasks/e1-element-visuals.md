# E1 Element status visuals [Claude · Fable medium]

Status: built 2026-11-21 (Fable 5.2); Johannes judges look and fps on the Tab S9 (`pt-hardware-checks.md` row 51).
Request (Johannes, playtest 2026-11-21): element status effects on enemies are hardly visible. They must read at the game camera in a busy fight on a tablet, and stay cheap (Tab S9 is CPU-bound: no draw calls per enemy, no lights).

## Before
| Element | Sim state (`src/sim/types.ts`, `combat.ts`) | Visual before | Why weak |
|---|---|---|---|
| Feuer | `e.burn` (seconds left), `e.bdps`; event `ignite`, `dot` | Dim orange emissive on the body (`0x7a2a08`), about 16 glow particles a second, 6 on ignite | Tint near black after the grade; particles small, sparse and the colour of hit sparks and fires |
| Säure | `e.acid` (seconds left; +25 % damage taken, slower with Zersetzung) | Dim green emissive (`0x2a4a10`), 8 drops of 9 cm a second | Same; drops below a pixel or two on the tablet |
| Strom | No status. `chain()` pushes a `bolt` event per jump and a quiet `hit` with `element: 'shock'` | A flat ribbon 14 cm high for 0.16 s, 8 sparks at the target | Seen from 44° the ribbon is 10 cm thin and gone in ten frames; nothing shows who was hit |
| Slow (Krähenfeder, no element) | `e.slow` (seconds left, 60 % speed) | Nothing | |

The game has no ice or poison; the three elements are in `ELEMENTS` (`src/data/items.ts`). Stun shows by the stagger pose and is unchanged.

## Decision
One instanced quad with one procedural shader draws every mark of every enemy (`src/render/status-fx.ts`, `StatusMarks`): one draw call while any enemy carries a status, none otherwise. No texture, no light, FX layer (not in the normal/depth pre-pass). Each status gets its own shape, colour and motion, so they tell apart without reading colour alone:

| Status | Mark | Body | Extra |
|---|---|---|---|
| Feuer | Flame billboard over the body, 1.5 × its height: noise tongues scrolling up, three hard colour steps (red-orange, orange, yellow core) | Emissive pulses orange (9 Hz) | Warm glow on the ground (not on Leistung); rising embers (12 a second, existing particle pool); 10 puffs on ignite |
| Säure | Green puddle on the ground with a bright rim and bursting bubbles, plus falling drops over the body | Emissive pulses green (5 Hz) | Existing small drops stay |
| Strom | Jagged cyan-white arcs round the body and one bolt through it, redrawn 16 times a second with a strobe, for 0.55 s after a shock hit | Emissive strobes cyan after the white hit flash | Cyan glow on the ground (not on Leistung); the chain ribbon is 32 cm high with a white core in a cyan halo and stays 0.26 s |
| Slow | Pale blue dashed ring on the ground that creeps round | Cold blue emissive | |

Also: a hit that carries an element sparks in the element's colour (`Fx.sparks`).

Rules kept: render reads sim only. The shock timer lives in the render layer (`StatusMarks.zaps`, `EnemyView.zap`), started by the `hit` event; the sim got no new state. Marks are premultiplied: flame, drops, puddle and ring cover part of what is behind them (they show on bright daytime ground), arcs and glows only add light.

## Cost (read from the code, not measured)
| | Ausgewogen | Leistung |
|---|---|---|
| Draw calls | +1 while any enemy has a status, else 0 | same |
| Marks per enemy (2 triangles each) | Feuer 2, Säure 2, Strom 2, Slow 1 | Feuer 1, Säure 2, Strom 1, Slow 1 (`Profile.statusGlow` off: no ground glow) |
| CPU per frame | One pass over the enemies, 8 floats per mark, three buffer uploads of at most 6 KB (192 marks) only while marks exist; emissive colour set on the materials of each burning, corroded or shocked body (uniform values, no recompile) | same |
| GPU | Overdraw of one body-sized quad per mark; the flame reads two value noises per pixel, the rest less | less (no glow discs of 2.4 to 2.6 body widths) |
| Lights, textures, materials | none new; the 10 pooled bolt ribbons share one new shader | same |

Qualität is as Ausgewogen.

## Files
- `src/render/status-fx.ts` (new): `StatusMarks`, shader, `bodySize`, `ZAP_TIME`.
- `src/render/fx.ts`: owns `StatusMarks`, element spark colours, `FxOptions.statusGlow`.
- `src/render/enemies.ts`: `EnemyView.hit(shock)`, pulsing status emissive, slow tint.
- `src/render/abilities.ts`: bolt ribbon shader and life, ember and ignite particles.
- `src/render/profile.ts`, `renderer.ts`: `statusGlow`, event wiring.
- `tools/proof-status.mjs`: sets one enemy per status round the hero and takes the picture `docs/proof/e1/status-marks.jpg` (Ausgewogen, software GL).

## Open
- Look and fps are unjudged on real hardware (row 51). Likely knobs if something is too loud: flame `body` (0.7) and height (`size.h * 1.5`) in `status-fx.ts`, arc brightness (`* 1.5`), `ZAP_TIME`.
- Mark heights per body are rough (`HEIGHT`, `LIFT` in `status-fx.ts`); large bosses and flyers may want tuning.
- Billboards are pulled toward the camera by about 0.75 × body height so they lie over the body; behind a thin wall a flame top can show through.
- The hero has no status marks (enemy fire fields and acid on the hero were not in scope).
