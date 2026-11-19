# T7 Alexanderplatz and tunnel textures [Codex]

Status: painted and integrated. Performance integration and hardware review remain open.

- Alexanderplatz uses its existing 2048 × 1536 sign atlas layout. The hour and city panels, signs, shop names, slogans and emblems retain their authored lettering. Painted mosaics, enamel wear and glazing replace or enrich the albedo. The emissive mask and the alpha-tested 2D artwork in `posters.webp` are reused.
- The Alexanderplatz stucco batch uses a 2048 × 2048 atlas of sandstone, verdigris and the Rathaus frieze. Its default 4 m sandstone tile repeats up to 16 m before stretching across longer faces. WBS 70 uses the district concrete slot. One brick material per chunk distinguishes the Stadtbahn and Rathaus.
- Tunnel concrete remains one material. Four consecutive metre sections use each 4 m concrete swatch, with three swatches cycling independently on both sides. The existing station band and its line-colour stripe sample the ceramic cell.
- The generated assets total about 1.4 MB. All use sRGB. The maps keep procedural placeholders while the images load and when a request fails.
- Palette and wear references from 2D: `assets/buildings/alex-{limestone,copper,rathaus,relief,rail-brick,weltzeit,station,curtain,bronze}.webp`, `gdr-mural-pioneer.webp` and `gdr-banner-*.webp`.

[Visual review](../proof/asset-t7/README.md) · [Hardware follow-up](pt-hardware-checks.md)
