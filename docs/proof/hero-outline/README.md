# Opaque occluders with a hero contour

[Task and renderer cost](../../tasks/hero-outline.md). Main's loot changes were merged without dropping T1 ground/tram work; the conflicting status rows are reconciled.

The old proximity bubble is deleted. Buildings, landmarks and large vehicles remain opaque. A thin amber contour follows only the actual hidden character silhouette, including the animated mesh and weapon. It uses character/object depth, not proximity or shared-material names. Crates/bins, loot, enemies, lamps, fences and trees do not enter the occlusion mask.

| Scene | Leistung | Qualität |
|---|---|---|
| Behind the tram, (7.3, −48) | [Screenshot](behind-tram-leistung.jpg) | [Screenshot](behind-tram-qualitaet.jpg) |
| Beside the tram, (10.5, −48), clear of other foreground buildings | [Screenshot](beside-tram-leistung.jpg) | [Screenshot](beside-tram-qualitaet.jpg) |
| Behind a generated building | [Screenshot](behind-building-leistung.jpg) | [Screenshot](behind-building-qualitaet.jpg) |

Screenshots are 1280 × 720 at the normal game camera, seed 7, with a held simulation. The capture utility snaps the existing camera in the browser fixture only. It resolves the actual module URL so Vite hot reload cannot leave the capture camera behind. `screenshots*.json` records the building position and page/console errors.

## Checks

- Typecheck, all 223 unit tests and production build pass. Unit tests use one worker and a 30 s timeout on the cloud CPU.
- Full browser suite: 13/13 pass after merging main and replacing the effect.
- `render-cases.json`: 14 GPU pixel cases across the two profile resolutions. Behind a large object: 380/530 changed contour pixels. Beside/in front of it, or behind an unclassified crate/tree/enemy/lamp control: zero changed pixels. The fixture deliberately reuses the same opaque object material and geometry so it tests classification rather than art differences.
- Unit checks verify that geometry sharing a material remains excluded unless explicitly classified, nested capture does not duplicate triangles, and transforms/heights survive the position-only depth copy.
- No production `cutout`, `uCut*`, `vCut*` or `applyCutout` code remains. Old material hooks, pre-pass hooks, per-frame updates and the unused camera accessor were removed.

```sh
npm run dev
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tools/proof-outline.mjs
```

The outline owns its depth targets and restores camera layers, override material, clear state and shadow-update state. Targets resize with the existing profile pre-pass scale and are disposable. World beauty batches stay intact; eligible position-only geometry is merged once per chunk. Cloud screenshots verify appearance and behavior, not PC/Tab S9 frame-time acceptance.
