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
/** The previous local save, kept when a cloud save replaces it. */
export function backupSave(s: SaveV1): void {
  try { localStorage.setItem(KEY + '.backup', JSON.stringify(s)); } catch { /* no backup */ }
}
export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* no save */ }
}

/** Spielstand kopieren (2D `exportSave`, `RS1:`): the save as a text code; `END` marks a complete copy. */
export function saveCode(s: SaveV1): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `RB1:${btoa(bin)}\nEND`;
}

/** Spielstand laden (2D `importSave`): a pasted code back to a save; null for a cut-off, foreign or damaged code. */
export function parseSaveCode(text: string): SaveV1 | null {
  const m = /RB1:([A-Za-z0-9+/=\s]+?)\s*END/.exec(text);
  if (!m) return null;
  try {
    const bin = atob(m[1]!.replace(/\s+/g, ''));
    return parseSave(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch {
    return null;
  }
}
