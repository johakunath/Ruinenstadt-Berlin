// M6: localStorage wrapper for the versioned save (`src/sim/save.ts`). Never throws; private mode
// or a full disk just means no save. Automated browsers and ?autostart runs do not touch it.
import { parseSave, type SaveV1 } from './sim/save';

const KEY = 'ruinenstadt-berlin.save';

export function loadSave(): SaveV1 | null {
  try { return parseSave(localStorage.getItem(KEY)); } catch { return null; }
}
export function writeSave(s: SaveV1): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* no save */ }
}
export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* no save */ }
}
