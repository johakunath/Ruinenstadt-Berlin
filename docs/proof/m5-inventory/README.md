# M5 browser proof

2026-11-16, local Chromium with SwiftShader (not a hardware performance measurement). Seeded items come from the test fixture, not normal-play drops.

- `npm run check`: type check, 189 unit tests, production build pass.
- All six existing smoke tests pass: courtyard and Köpenick on both profiles, options/map pause, combat stats and retry.
- All five inventory tests pass on the final build: desktop actions/protection/pause, mouse drag/wrong-slot rejection, phone tap/equip/no overflow, controller Y/A/B, tablet native touch long-press drag.
- First controller fixture used a 100 ms pulse missed between software-rendered frames; final fixture spans animation frames and passes.
- Screenshots: [desktop](desktop.png) (1280×720), [tablet](tablet.png) (1024×768), [phone](phone.png) (390×844, scrolls vertically).
- M4 collection, M6 persistence and M13 stash remain separate. Hardware/controller feel remains Johannes’ playtest.
