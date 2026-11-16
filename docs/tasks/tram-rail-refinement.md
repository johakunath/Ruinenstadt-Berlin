# Tram rail realism [Codex]

Status: done (PR #14). Requested by Johannes on 2026-11-16 after reviewing T1: research real tram rails and replace the black-line appearance. This explicitly authorizes the rail geometry/material refinement beyond T1's texture-only scope.

## Goal and references

Embedded street track: steel running head, an inward flange groove and a narrow guard, with rust and a road repair seam. References: [Dorsch's Alt-Köpenick track-renewal photographs](https://abudhabi.dorsch.com/projects/detail/gleiserneuerung-schlossplatz-alt-koepenick), [voestalpine grooved tram rails](https://www.voestalpine.com/railway-systems/en/products/track-systems/rails/urban-traffic-tram/). Photographs are reference only, not bundled game assets.

## Handover

- `src/render/tram-rails.ts`: 1.435 m running-face gauge, mirrored inward grooves, five surface bands, mitered polyline offsets.
- `map-world.ts`: embedded ribbons replace the four dark iron boxes; separate steel material receives real scene lighting, existing asphalt/rust/rubber batches provide seams and grooves. Bridge rails sit above the existing 5 cm deck top.
- Removed crossing side-street curb pieces that obstructed the tram corridor. Render-only; route, collision, gameplay, lighting, shaders and profiles unchanged.
- Cost: 40 triangles per street piece instead of 48 for the old boxes; one new steel material. Up to three additional material batches per affected chunk if rust/rubber were not already present; no new lights, textures or per-frame work. Hardware measurement remains with Claude.
- Typecheck, all 199 unit tests, production build and both Köpenick e2e tests pass, including gauge, groove orientation and bend-join tests. Street/bridge captures on both profiles have no page/console errors: `docs/proof/tram-rails/`.
