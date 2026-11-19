// M6b: account and save slots on the title screen, before the game loads. Starts the cloud sync of all
// three slots, adopts newer remote saves (the active slot only on the title, else it holds until the
// next load), joins an account by code, and fills the Optionen row "Online speichern".
import { cloudSave } from '../cloud';
import { activeSlot, backupSave, clearSave, loadSave, setActiveSlot, SLOTS, writeSave, type Slot } from '../save';
import type { SaveV1 } from '../sim/save-format';
import { formatCode, type SyncState } from '../sync';

export const SYNC_LABEL: Record<SyncState, string> = { off: 'Aus auf diesem Gerät.', sync: 'Verbindet …', on: 'Synchron.', slow: 'Nicht erreichbar, speichert lokal.', conflict: 'Anderes Gerät war neuer. Beim nächsten Start geladen.' };

/** Replaces a slot's local save with a remote one; the old one stays as that slot's backup. */
function adopt(remote: SaveV1, slot: Slot): void {
  const old = loadSave(slot);
  if (old) backupSave(old, slot);
  writeSave(remote, slot);
}

const listeners: Array<() => void> = [];
/** Called on every change of sync state, code, names or slot contents. */
export function onAccount(f: () => void): void { listeners.push(f); }
const changed = (): void => { for (const f of listeners) f(); };

/** Switches the device to another slot; the page reloads into it. */
export function pickSlot(slot: Slot): void {
  if (slot === activeSlot()) return;
  void cloudSave().flush().finally(() => { setActiveSlot(slot); location.reload(); });
}

/** `onTitle` true while no run is being played (the active slot may then be replaced and the page reloaded). */
export function initAccount(onTitle: () => boolean): void {
  const cloud = cloudSave();
  bindOptionsRow();
  if (!cloud.available) return;
  cloud.onChange = changed;
  cloud.autoStart();
  changed();
  const locals: Partial<Record<Slot, SaveV1 | null>> = {};
  for (const s of SLOTS) locals[s] = loadSave(s);
  void cloud.start(locals).then((got) => {
    let reload = false;
    for (const s of SLOTS) {
      const r = got[s];
      if (!r) continue;
      if (s !== cloud.active) adopt(r, s);
      else if (onTitle()) { adopt(r, s); reload = true; }
      else cloud.hold(s);
    }
    if (reload) location.reload(); else changed();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) void cloud.flush(); });
}

/** Code eingeben: every slot of this device becomes the account's (old saves kept as backups), then reload. */
export async function joinAccount(raw: string): Promise<string | null> {
  const r = await cloudSave().join(raw);
  if ('error' in r) return { code: 'Ungültiger Code.', net: 'Server nicht erreichbar.', unknown: 'Code unbekannt.', damaged: 'Spielstand unbrauchbar.' }[r.error];
  for (const s of SLOTS) {
    const remote = r.saves[s];
    if (remote) adopt(remote, s);
    else { const old = loadSave(s); if (old) { backupSave(old, s); clearSave(s); } }
  }
  location.reload();
  return null;
}

function bindOptionsRow(): void {
  const cloud = cloudSave();
  const row = document.getElementById('cloud-row');
  const info = document.getElementById('cloud-info');
  const toggle = document.getElementById('cloud-toggle') as HTMLButtonElement | null;
  const copy = document.getElementById('cloud-copy') as HTMLButtonElement | null;
  if (!row || !info || !toggle || !copy) return;
  const show = (): void => {
    const who = cloud.name ? `${cloud.name} · ` : '';
    info.textContent = cloud.code ? `${who}Code ${formatCode(cloud.code)} · ${SYNC_LABEL[cloud.state]}` : SYNC_LABEL.off;
    copy.hidden = !cloud.code;
    toggle.textContent = cloud.code ? 'Ausschalten' : 'Aktivieren';
  };
  if (!cloud.available) return;
  row.hidden = false;
  onAccount(show);
  show();
  copy.addEventListener('click', () => { void navigator.clipboard?.writeText(formatCode(cloud.code)).catch(() => prompt('Online-Code:', formatCode(cloud.code))); });
  toggle.addEventListener('click', () => {
    if (cloud.code) { if (confirm(`Online-Speichern ausschalten? Code ${formatCode(cloud.code)} gut aufheben.`)) cloud.disable(); return; }
    cloud.enable();
    for (const s of SLOTS) { const v = loadSave(s); if (v) cloud.queue(v, s, 0); }
  });
  document.getElementById('cloud-join')?.addEventListener('click', () => {
    const raw = prompt('Online-Code eingeben (z. B. ABCD-1234). Alle Slots auf diesem Gerät werden ersetzt, Sicherungen bleiben.');
    if (!raw) return;
    void joinAccount(raw).then((err) => { if (err) info.textContent = err; });
  });
}
