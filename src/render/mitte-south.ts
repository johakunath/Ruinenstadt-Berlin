// M15 Mitte step 4: the Potsdamer Platz landmarks built from photos (`docs/maps/landmarks.md`). Each builder returns
// true when it drew the kind; `buildMitteLandmark` falls back to the step 2 massing otherwise.
import type { Landmark } from '../data/map';
import type { MCtx } from './mitte-world';

export function buildSouth(_c: MCtx, _l: Landmark): boolean {
  return false;
}
