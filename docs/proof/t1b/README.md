# T1b Köpenick ground proof

## Local image pass (2026-11-26, FLUX.2 klein)

| Surface | 2 × 2 repeat, before \| after | In game |
|---|---|---|
| Paving | [paving-2x2-before-after.jpg](paving-2x2-before-after.jpg) | [Qualität](ground-qualitaet.jpg), [Leistung](ground-leistung.jpg), top row (Altstadt market) |
| Leaf floor | [leaves-2x2-before-after.jpg](leaves-2x2-before-after.jpg) | Same sheets, bottom row (Friedrichshagen forest) |
| Litter atlas edges | [litter-bleed.jpg](litter-bleed.jpg): mip 2 and 3 after `alphaTest`, before (top) and after (bottom) | |
| Rail heads | | [Qualität](rails-qualitaet.jpg), [Leistung](rails-leistung.jpg): `?rails=old` left, new right; rows: start square, street at (10, −86) |

- **Paving.** The previous tile's rows were uneven: nine rows of 105 px and one of 80 px, so a narrow row came back every 5 m. The start image was resampled to an even 102.4 px grid and shifted half a plate; FLUX dropped any joint lying on the tile border in two earlier rounds (13 variants), which would have left one joint missing per tile. Then `texture-tile.mjs --match` (band 0.08, seams 1.8 against 12 before) and 85 % of the low-frequency tone removed, so single dark plates and stains do not form a 5 m pattern. All 100 plates are present; joints stay dark for the shader's height blend; colour mean and spread match the old file.
- **Leaf floor.** Random oak and beech leaves with needles instead of the wavy regular pattern; luminance SD 7.5 (previous 7.8, T1 16.6), mean unchanged.
- **Litter.** Transparent pixels now hold the local visible colour (pull-push fill per cell). The worst fringe darkening in the mips falls from 26 to 13 levels (mip 1) and 40 to 28 (mip 4); the mean was small before (0.7 to 2.8) and stays so.
- **Rails.** Roughness 0.34 → 0.5 removes the white streak near lamps on both profiles; the heads still read as steel. Charlottenburg keeps 0.34 because the shared `railSteel` is its mirrors and chandelier.

1280 × 720 swiftshader captures, seed 7, sim held; looks only, no fps. The previous T1b image pass (Codex, 2026-11-16) is the "before" in the sheets; its own comparisons follow.

## Codex image pass (2026-11-16)

| Köpenick location | Leistung | Qualität |
|---|---|---|
| Altstadt market | [Before](before-altstadt-leistung.jpg) · [After](after-altstadt-leistung.jpg) | [Before](before-altstadt-qualitaet.jpg) · [After](after-altstadt-qualitaet.jpg) |
| Kietz | [Before](before-kietz-leistung.jpg) · [After](after-kietz-leistung.jpg) | [Before](before-kietz-qualitaet.jpg) · [After](after-kietz-qualitaet.jpg) |
| Friedrichshagen forest | [Before](before-forest-leistung.jpg) · [After](after-forest-leistung.jpg) | [Before](before-forest-qualitaet.jpg) · [After](after-forest-qualitaet.jpg) |

[Repeat paving](repeat-paving.jpg) and [repeat leaves](repeat-leaves.jpg) of that pass; [texture load results](loading.json).
