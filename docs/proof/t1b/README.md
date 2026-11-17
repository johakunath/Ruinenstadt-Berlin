# T1b Köpenick ground image proof

## 2 × 2 repeats

| Surface | Repeat | Runtime file |
|---|---|---|
| Paving | [Four tiles](repeat-paving.jpg) | 238,934 bytes |
| Leaf floor | [Four tiles](repeat-leaves.jpg) | 164,966 bytes |

Each runtime tile covers 5 m and is a 1024 × 1024 opaque sRGB WebP at quality 85. Paving has ten plates per axis with dark joints and no missing plates. Weathering is distributed across the slabs. The leaf tile's 8-bit luminance standard deviation fell from 16.64 to 7.86, while its mean stayed within 0.1.

The 2D shared pavement and Köpenick sidewalk provided the painted concrete, worn edges and moss references. Their 256–258 px runtime tiles had fewer slabs than the 3D target. The new paving uses the 3D T1 grid. The new leaves reuse the T1 leaf floor as the source for an image edit.

## In-game comparisons

| Köpenick location | Leistung | Qualität |
|---|---|---|
| Altstadt market | [Before](before-altstadt-leistung.jpg) · [After](after-altstadt-leistung.jpg) | [Before](before-altstadt-qualitaet.jpg) · [After](after-altstadt-qualitaet.jpg) |
| Kietz | [Before](before-kietz-leistung.jpg) · [After](after-kietz-leistung.jpg) | [Before](before-kietz-qualitaet.jpg) · [After](after-kietz-qualitaet.jpg) |
| Friedrichshagen forest | [Before](before-forest-leistung.jpg) · [After](after-forest-leistung.jpg) | [Before](before-forest-qualitaet.jpg) · [After](after-forest-qualitaet.jpg) |

1280 × 720 Chromium captures with seed 7 and a held sim. The camera is fixed at the same position for each pair. The Altstadt market (−10.5, −20) gives a clear view of the paving. Kietz (70, 30) and Friedrichshagen forest (130, −120) use the T1 sites. The browser first loads the five runtime ground images, then the capture fixture swaps the prior and updated paving and leaf images into the same scene. See [texture load results](loading.json).

`npm run check` passed type checking, all 433 unit tests and the production build.

The resolution choice and performance measurements are tracked in the [T1b task](../../tasks/t1b-ground-polish.md).
