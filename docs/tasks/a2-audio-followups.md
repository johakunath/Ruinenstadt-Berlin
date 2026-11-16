# A2 Audio follow-ups from the S1 review [Sonnet 5.5]

Status: open. Review of PR #9 (2026-11-16): the 19 effect recipes, the renderer, music and intensity are identical to 2D `js/audio.js`. Differences:

| # | 2D | 3D | Do |
|---|---|---|---|
| 1 | Heartbeat `beat` under 30 % life (`js/update.js:25`) | Ported, never played | Play it from the game loop while life is under 30 % |
| 2 | `ui` click on menu buttons (11 call sites) | Never played | Play on menu button clicks (after U1: one handler on the menu shell) |
| 3 | `coin` on a trader purchase | Trade plays `bell` only | `coin` on a successful buy (`src/ui/abilities.ts`, trade click) |
| 4 | Music stops with a 1 s fade (`js/audio.js:80`) | Hard cut (`src/audio/music.ts:36-38`) | Fade |
| 5 | Distance volume `clamp(1 - d/650 px, 0, 1)²`, pan = screen x × 0.6 (`js/audio.js:67`) | `1/(1+(d/8)²)`, pan `dx/12`; the comment says "same as 2D" | Port the 2D curve at 30 px per meter (21.7 m), pan × 0.6; fix the comment; test the curve |
| 6 | Music follows district and cyber flag | Hardcoded `district: 0, cyber: false` (`src/main.ts`) | Pass the map's district index (0 for Köpenick); leave cyber false until a district needs it |
| 7 | `spit` | Ported, unused | Wait for the spitter (M12) |

Done when: unit tests for 1, 4 and 5; `npm run check`; Johannes listens on the PC and the Tab S9.

## Handover (Opus 5.5, 2026-11-16)
1 heartbeat under 30 % life in fights (`heartbeat` in `src/audio/audio.ts`), 2 `ui` click on every overlay button (one capture listener in `src/main.ts`), 3 `coin` on every purchase (`buy` event from `src/sim/runcontent.ts`; events raised on paused screens are drained each frame), 4 music fades over 1 s, 5 2D distance curve and pan × 0.6 with tests, 6 district stays 0 for Köpenick. 7 `spit` plays since M12. Listening test on PC and Tab S9 open.
