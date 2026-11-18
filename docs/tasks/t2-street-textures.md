# T2 Street textures [Codex]

Status: built. Hardware performance and playtest are open.

## Goal

Add painted street albedos to the materials shared by the expedition maps and the courtyard.

## Files and hookup

| Image | Albedo | Material |
|---|---|---|
| `assets/textures/koepenick/asphalt.webp` | 1024 × 1024, 118 kB. Worn gray-brown asphalt with fine aggregate and faint cracks | `makeMapMats` → `asphalt`, `tar` (M11c image #1) |
| `assets/textures/common/cobbles.webp` | 1024 × 1024, 362 kB. Staggered granite setts with dark, mossy joints | `makeMats` → `cobbles` |

OpenAI image generation used the 2D Köpenick asphalt and plaza as palette references. The T1 loader supplies sRGB and repeat wrapping. The procedural maps are the loading and failure fallbacks. Asphalt and tar share one texture. The existing UVs and the Qualität cobble normal map continue to drive scale and relief.

## Evidence

- Repeat checks at 2 × 2 for [asphalt](../proof/t2-streets/repeat-asphalt.jpg) and [cobbles](../proof/t2-streets/repeat-cobbles.jpg).
- The two WebPs total 480 kB compressed and about 10.7 MiB decoded with mipmaps before accounting for the existing fallback maps they replace.
- Playwright at 1280 × 720 near the Bahnhofstraße intersection on both profiles. [Leistung fallback](../proof/t2-streets/fallback-leistung.jpg) · [Leistung painted](../proof/t2-streets/painted-leistung.jpg) · [Qualität fallback](../proof/t2-streets/fallback-qualitaet.jpg) · [Qualität painted](../proof/t2-streets/painted-qualitaet.jpg). Both requests succeeded in the painted captures. Blocking both images still rendered the scene without page errors.
- Type check and build passed. The unit run passed 461 of 463, and the two five-second timeouts passed when rerun with one worker.
