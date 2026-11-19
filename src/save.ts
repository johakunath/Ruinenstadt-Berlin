// M6: localStorage wrapper for the versioned save (`src/sim/save-format.ts`). Never throws; private mode
// or a full disk just means no save. Automated browsers and ?autostart runs do not touch it.
// M6b: three save slots. Slot 1 keeps the old key, so a save from before slots is slot 1; the active slot
// is stored per device and every function defaults to it.
import { parseSave, type SaveV1 } from './sim/save-format';

export type Slot = 1 | 2 | 3;
export const SLOTS: readonly Slot[] = [1, 2, 3];
const KEY = 'ruinenstadt-berlin.save';
const SLOT_KEY = 'ruinenstadt-berlin.slot';

export const isSlot = (v: unknown): v is Slot => v === 1 || v === 2 || v === 3;
export const slotKey = (slot: Slot): string => (slot === 1 ? KEY : `${KEY}.${slot}`);

export function activeSlot(): Slot {
  try { const n = Number(localStorage.getItem(SLOT_KEY)); return isSlot(n) ? n : 1; } catch { return 1; }
}
export function setActiveSlot(slot: Slot): void {
  try { localStorage.setItem(SLOT_KEY, String(slot)); } catch { /* stays on slot 1 */ }
}

export function loadSave(slot: Slot = activeSlot()): SaveV1 | null {
  try { return parseSave(localStorage.getItem(slotKey(slot))); } catch { return null; }
}
export function writeSave(s: SaveV1, slot: Slot = activeSlot()): void {
  try { localStorage.setItem(slotKey(slot), JSON.stringify(s)); } catch { /* no save */ }
}
/** The previous local save of a slot, kept when a cloud save replaces it. */
export function backupSave(s: SaveV1, slot: Slot = activeSlot()): void {
  try { localStorage.setItem(slotKey(slot) + '.backup', JSON.stringify(s)); } catch { /* no backup */ }
}
export function clearSave(slot: Slot = activeSlot()): void {
  try { localStorage.removeItem(slotKey(slot)); } catch { /* no save */ }
}

/** Short device class for the slot card (PC, Tablet, Handy). */
export function deviceClass(): string {
  try {
    const ua = navigator.userAgent;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (/iPad|Tablet/i.test(ua) || (coarse && Math.min(screen.width, screen.height) >= 600)) return 'Tablet';
    return coarse || /Mobile|iPhone/i.test(ua) ? 'Handy' : 'PC';
  } catch { return 'PC'; }
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
  const m = /RB1:([A-Za-z0-9+/=\s]+)\nEND\s*$/.exec(text.trim());
  if (!m) return null;
  try {
    const bin = atob(m[1]!.replace(/\s+/g, ''));
    return parseSave(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch {
    return null;
  }
}
