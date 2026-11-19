# T3 and T4 shared textures

The T3 facade and roof albedos and T4 prop and vehicle albedos are integrated. PC and Tab S9 measurements are open.

| Batch | Assets | Integration |
|---|---|---|
| T3 | Cream, ochre and oxblood plaster, clay brick, stucco, concrete, roof tiles, Späti shopfront | Existing world materials, UVs and lighting. The shop map also drives the existing emissive input. Alexanderplatz masonry and tunnel concrete use their district materials. |
| T4 | Wood, rust-brown painted metal, neutral vehicle enamel, three van faces | Normal and tinted wood share one image. Car, bus and tram bodies share neutral enamel with vertex tints. The van retains its existing painted windows, lights, lettering and route board. |

The canvases remain available during loading and on request failure. Existing normal maps and draw passes are kept. Moving bus and tram bodies to the existing enamel material can change material batch counts by chunk. The 14 WebPs total 960 kB. The upper bound for all 14 decoded as RGBA with mipmaps is about 49 MiB, before crediting the procedural maps they replace. Material batches, decode hitches and memory are for the PC and Tab S9 pass.

The 2D references were Köpenick wall, roof and Späti shopfront, plus the shared brick and wood tiles. The colour palette and the prop geometry use the 3D game's current rules.

- [Seam check, each tile repeated 2 × 2](wrap-comparisons.jpg). Top row, left to right, cream, ochre, oxblood, brick, stucco. Bottom row, roof, concrete, wood, painted metal, enamel.
- Courtyard on Leistung. The Späti and wall are across the yard, wood and metal props in its centre, and the van in the foreground. [Painted](courtyard-leistung-painted.jpg) · [Fallback with image requests blocked](courtyard-leistung-fallback.jpg)
- [Köpenick station frontage on Qualität](bahnhof-qualitaet-painted.jpg). Painted facade, shop windows and van. Chromium also loaded the roof tile and vehicle enamel images in this scene. The repeat sheet shows those textures up close.
