# Tram rail refinement

User feedback: the tracks looked like black lines. [References and handover](../../tasks/tram-rail-refinement.md).

Comparisons: [Leistung](comparison-leistung.jpg), [Qualität](comparison-qualitaet.jpg). Left: before; right: after. Top: street; bottom: bridge.

Wheel-alignment follow-up: `aligned-bridge-*` captures the leveled tram on the east-track straight. Its sixteen steel wheel treads use the rail-head centre spacing; the body and its collider share the corrected street-derived pose. `aligned.json` records zero errors for both profiles. Reproduce with `node tools/proof-tram.mjs aligned`. [Lower-angle wheel detail](aligned-wheels-detail.jpg) uses `cam=10,22` with the hero at (9, −38).

Alignment validation: typecheck, 201/201 unit tests, build and both Köpenick e2e tests pass. All sixteen wheel-contact positions are within 1e-8 m of the actual rail-head centre lines and at rail-top height at map scales 1 and 1.3.

Before: four dark iron bars. After: steel running heads, inward grooves and guard edges, rust at the margins and narrow asphalt repair seams. Rails follow joined offsets through street bends, remain visible on the bridge deck, and no longer have crossing curbs across them. No railway sleepers added to embedded street track.

`before-*` and `after-*` show the same street (10, −86) and bridge (9, −39) at the normal game camera, 1280 × 720, on both profiles. The capture fixture holds the sim and snaps its existing follow camera to each point. JSON logs record page/console errors.

```sh
npm run dev
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tools/proof-tram.mjs before
# Apply the rail change, then:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tools/proof-tram.mjs after
```

Validation: typecheck, 199/199 unit tests (one worker, 30 s timeout), production build and both Köpenick e2e tests pass (`npm run e2e -- --workers=1 --grep Köpenick`, using system Chromium). Includes tests for gauge between inner running faces, groove placement and continuous bend offsets. All eight street/bridge captures report zero page/console errors. Cloud rendering is a visual check, not a PC/Tab S9 performance measurement.
