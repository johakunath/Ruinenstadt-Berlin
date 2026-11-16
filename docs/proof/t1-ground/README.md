# T1 ground texture proof

PR: https://github.com/johakunath/Ruinenstadt-Berlin/pull/14

Comparisons: [Leistung](comparison-leistung.jpg), [Qualität](comparison-qualitaet.jpg). Left: procedural fallback; right: generated textures. Rows: Altstadt, Kietz, forest. Individual captures retain 1280 × 720 resolution.

Five generated 1024 × 1024 sRGB WebP albedos, quality 85, 1,483,034 bytes total. `assets.json` records sizes, dimensions and alpha. Only the scatter atlas has alpha. `repeat-*.jpg` shows each ground in a 2 × 2 repeat for seam review; paving has ten plates across its 5 m tile.

Reused 2D references (read only): `Ruinenstadt/assets/props/ground-grass.webp`, `ground-dirt.webp`, `ground-pavement.webp`. OpenAI image generation reinterpreted these as standalone 5 m tiles at 1254 px; output was resized to 1024 px. The Köpenick board supplied the scatter style. No normal or height maps, relighting or shader changes.

## Reproduce

Run from the repository root, with `npm run dev` serving port 5173:

```sh
node tools/proof-ground.mjs
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` if using system Chromium. The same option is supported by `tools/screenshot.mjs` and the e2e configuration.

`before-*` captures the original procedural maps by failing the five image requests, testing the fallback path. `after-*` requires all five images to load. Both profiles use seed 7, a held sim and the same three positions: Altstadt (10, −20), Kietz (70, 30), forest (130, −120). The browser fixture snaps the existing follow camera to each position to avoid slow interpolation frames; game camera code is unchanged. Atlas cells are visible as scattered puddles, leaves, trash and rubble. The Altstadt position is partly occluded by an existing building. `loading.json` records successful requests and page/console errors for each profile/stage. Cloud software WebGL timings do not represent hardware performance.

## Validation

- `npm run check`: typecheck passed; 194/196 tests passed, two terrain tests exceeded their default 5 s timeout while software WebGL was running.
- `npm run typecheck && npm test -- --maxWorkers=1 --testTimeout=30000 && npm run build`: passed, 196/196 tests.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run e2e -- --workers=1`: passed, 13/13 browser tests, including Köpenick on both profiles.
- Browser checks and screenshots: see `loading.json` and the before/after images.
- CI for the runtime integration commit `b5a18f3`: [passed](https://github.com/johakunath/Ruinenstadt-Berlin/actions/runs/43847237293). The final evidence/docs commit triggers its own CI run.

The runtime changes only texture maps/uniform values. Approximate resident RGBA8 cost for five 1024 px images with mipmaps is 26.7 MiB, replacing approximately 6.7 MiB of 512 px procedural maps after successful load. Claude owns actual memory/draw/performance measurements and PC/Tab S9 acceptance.
