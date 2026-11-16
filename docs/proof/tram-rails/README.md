# Tram rail refinement

User feedback: the tracks looked like black lines. [References and handover](../../tasks/tram-rail-refinement.md).

Comparisons: [Leistung](comparison-leistung.jpg), [Qualität](comparison-qualitaet.jpg). Left: before; right: after. Top: street; bottom: bridge.

Before: four dark iron bars. After: steel running heads, inward grooves and guard edges, rust at the margins and narrow asphalt repair seams. Rails follow joined offsets through street bends, remain visible on the bridge deck, and no longer have crossing curbs across them. No railway sleepers added to embedded street track.

`before-*` and `after-*` show the same street (10, −86) and bridge (9, −39) at the normal game camera, 1280 × 720, on both profiles. The capture fixture holds the sim and snaps its existing follow camera to each point. JSON logs record page/console errors.

```sh
npm run dev
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tools/proof-tram.mjs before
# Apply the rail change, then:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tools/proof-tram.mjs after
```

Validation: typecheck, 199/199 unit tests (one worker, 30 s timeout), production build and both Köpenick e2e tests pass (`npm run e2e -- --workers=1 --grep Köpenick`, using system Chromium). Includes tests for gauge between inner running faces, groove placement and continuous bend offsets. All eight street/bridge captures report zero page/console errors. Cloud rendering is a visual check, not a PC/Tab S9 performance measurement.
