# T1 Köpenick ground textures [Codex]

Status: open. Pipeline and rules: `docs/asset-pipeline.md` (read it first).

## Goal

Replace the code-painted Köpenick ground textures with generated painted images. Keep the code-painted ones as fallback.

## Images

| File | Content | Replaces |
|---|---|---|
| `assets/textures/koepenick/grass.webp` | Rough, unmown grass with dry stalks and small bare spots | `paintGrass` |
| `assets/textures/koepenick/dirt.webp` | Bare earth and mud with pebbles | `paintDirt` (also street kind `path`) |
| `assets/textures/koepenick/paving.webp` | Berlin sidewalk plates, about 50 cm (10 per tile), cracked, a few missing, dark joints | `paintPaving` |
| `assets/textures/koepenick/leaves.webp` | Forest floor: old leaves, needles, twigs | `paintLeafLitter` |
| `assets/textures/koepenick/litter.webp` | 2 × 2 atlas with alpha: top left puddle, top right leaf pile, bottom left paper and cans, bottom right rubble crumbs | `paintLitter` |

All tiles cover 5 m. The shader blends the four grounds by vertex weights and lets the **darker** parts of paving lose to grass, so joints must be clearly darker than plates.

## Integration

`src/render/map-world.ts`, `groundMaterial` and `makeMapMats`. Swap `mat.map` (grass) and the uniforms `uDirt`, `uPave`, `uLeaf` once loaded; swap `litter` and `path` maps. Do not change the shader, weights or scatter.

## Checks

- `npm run check`, e2e once.
- Screenshots at the Altstadt (`10,-20`), Kietz (`70,30`) and Friedrichshagen forest (`130,-120`) before and after, on both profiles.
- Rows in `assets/LICENSES.md`.

## Handover

(Codex fills in.)
