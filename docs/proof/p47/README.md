# P47 Leistung texture cap

`Profile.tileEdge` is 512 on Leistung (Infinity on Qualität and Ausgewogen). Every tiling surface passes it to `loadPaintedTexture` / `swapPaintedMap` (opt-in per call); atlases of 2 × 2 tiling cells (Alexanderplatz stone, U-Bahn walls) pass twice that. Not capped: lettered atlases (Alexanderplatz signs and posters, Mitte neon, markings, van sides), pictures (shop front, Xhain murals, Wedding cloth atlas and rug, Fernsehturm floors and dial), the landmark wear decals, the Fernsehturm city image and the hero clothing. The four tiling Köpenick ground images load their 512 px export instead of resizing (T1b).

## Image texture memory on Leistung (MiB)

`node tools/texmem.mjs "autostart&seed=7&map=<id>&profile=Leistung"` against the dev server, swiftshader, after the run starts (raw output: [before](texmem-before.txt), [after](texmem-after.txt)). Render targets are unchanged.

| Map | Before | After | Change | Screenshot before \| after |
|---|---|---|---|---|
| Köpenick | 138.0 | 86.0 | −52.0 (−38 %) | [koepenick.jpg](koepenick.jpg) |
| Xhain | 98.0 | 62.0 | −36.0 (−37 %) | [xhain.jpg](xhain.jpg) |
| Alexanderplatz | 155.0 | 103.0 | −52.0 (−34 %) | [alex.jpg](alex.jpg) |
| Mitte | 136.7 | 88.7 | −48.0 (−35 %) | [mitte.jpg](mitte.jpg) |
| Charlottenburg | 148.7 | 96.7 | −52.0 (−35 %) | [charlottenburg.jpg](charlottenburg.jpg) |
| Wedding | 126.5 | 86.5 | −40.0 (−32 %) | [wedding.jpg](wedding.jpg) |
| Fernsehturm | 36.7 | 32.7 | −4.0 (−11 %) | [turm.jpg](turm.jpg) |
| U-Bahn tunnel | 94.3 | 46.3 | −48.0 (−51 %) | [tunnel.jpg](tunnel.jpg) |

Qualität (175.9) and Ausgewogen (143.6, Köpenick) are unchanged. The backlog estimate was about −60 %; what is left on Leistung is mostly not a painted tile: code-painted canvases (8 to 48 MiB per district, sign and atlas canvases and still-installed fallbacks among them), GLB character bitmaps (6 to 16 MiB), the hero clothing (8 to 13 MiB) and the kept lettered atlases. The canvases are the next lever (not in P47).

Screenshots: 1280 × 720 at the start camera, seed 7, sim held, after every texture image has loaded (`tools/proof-p47.mjs`); before on the left. Swiftshader, so looks only. The after column also carries the T1b changes of the same branch (new paving and leaf images, rail roughness 0.5); fire and lamp flicker differ between captures.
