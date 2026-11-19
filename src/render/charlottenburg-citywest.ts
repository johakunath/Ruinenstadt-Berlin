// M16 Charlottenburg step 4: City West: Bahnhof Zoo, the Zoo, the church square, the Tauentzien.
// Built from pre-1930 photos (`docs/maps/landmarks.md`, `docs/tasks/m16-charlottenburg.md`). This file owns these kinds:
//   zoobahnhof loewentor elefantentor aquarium musikpavillon antilopenhaus
//   ufapalast capitol gedaechtniskirche romanischescafe kadewe wittenbergplatz
//
// Contract: `buildCitywest` returns true when it drew the landmark, false otherwise; `buildCharlottenburgLandmark`
// asks this file, then the other two, then falls back to the step 2 massing in `charlottenburg-world.ts`.
// Helpers (box `blk`, `cyl`, `dome`, `roof`, `windows`, `house`, `figure`, `columns`, `bars`, `openHall`, the
// frame `lm`, the geometry cache `cached`, the 1920 tints `C`, the context `Ctx`) come from there; do not edit
// that file. Colliders stay in `src/data`; this only draws. Check a kind with `tools/landmark-sheet.mjs`.
import type { LandmarkKind } from '../data/map';
import type { Ctx } from './charlottenburg-world';

/** The kinds this file owns (one builder each once step 4 is done). */
export const CITYWEST_KINDS: ReadonlySet<LandmarkKind> = new Set<LandmarkKind>(['zoobahnhof', 'loewentor', 'elefantentor', 'aquarium', 'musikpavillon', 'antilopenhaus', 'ufapalast', 'capitol', 'gedaechtniskirche', 'romanischescafe', 'kadewe', 'wittenbergplatz']);

/** Draws `c.l` if it is one of this file's kinds and has a step 4 builder; false otherwise (none yet). */
export function buildCitywest(c: Ctx): boolean {
  if (!CITYWEST_KINDS.has(c.l.kind)) return false;
  return false;
}
