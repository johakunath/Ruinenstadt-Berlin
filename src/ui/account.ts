// M6b: account and save slots on the title screen, before the game loads. Starts the cloud sync of all
// three slots, adopts newer remote saves (the active slot only on the title, else it holds until the
// next load), joins an account by code, and fills the title's Konto card (layout A, Johannes 2026-11-19)
// and the Optionen row "Online speichern".
import { cloudSave } from '../cloud';
import { activeSlot, backupSave, clearSave, loadSave, setActiveSlot, SLOTS, writeSave, type Slot } from '../save';
import type { SaveV1 } from '../sim/save-format';
import { LINE_FREED, STOPS } from '../data/lines';
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
  bindCard();
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

const esc = (t: string): string => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const hm = (d: Date): string => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
/** "heute 14:02", "gestern 21:40", "12.11." */
export function when(t: number, now = Date.now()): string {
  if (!t) return '';
  const d = new Date(t), day = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date(now)) - day(d)) / 86400000);
  return diff === 0 ? `heute ${hm(d)}` : diff === 1 ? `gestern ${hm(d)}` : `${d.getDate()}.${d.getMonth() + 1}.`;
}
/** One line of progress: furthest district freed, legendaries owned, an open checkpoint. */
export function slotSummary(s: SaveV1): string {
  const freed = (s.profile.inventory.camp?.freed ?? []).filter((k) => k < LINE_FREED);
  const far = freed.length ? STOPS[Math.max(...freed)]?.name : undefined;
  const inv = s.profile.inventory;
  const items = [...inv.bag, ...Object.values(s.profile.equipment), ...(inv.camp?.stash ?? [])];
  const leg = items.filter((i) => i && i.rarity >= 3).length;
  return [far ? `${far} frei` : 'Köpenick', leg ? `${leg} Legendäre` : '', s.run ? `Kampf ${s.run.index + 1} offen` : ''].filter(Boolean).join(' · ');
}

function bindCard(): void {
  const cloud = cloudSave();
  const card = document.getElementById('acct');
  const list = document.getElementById('acct-slots');
  if (!card || !list) return;
  const name = document.getElementById('acct-name')!, info = document.getElementById('acct-info')!;
  const rename = document.getElementById('acct-rename') as HTMLButtonElement, copy = document.getElementById('acct-copy') as HTMLButtonElement, join = document.getElementById('acct-join') as HTMLButtonElement;
  const show = (): void => {
    const on = cloud.available && !!cloud.code;
    name.textContent = !cloud.available ? 'Dieses Gerät' : cloud.name || 'Konto ohne Namen';
    info.innerHTML = !cloud.available ? 'Nur lokal gespeichert' : !cloud.code ? 'Online aus · in Optionen einschalten'
      : `Code ${formatCode(cloud.code)} · <span class="st-${cloud.state}">● ${SYNC_LABEL[cloud.state].replace(/\.$/, '')}</span>`;
    rename.hidden = copy.hidden = !on;
    join.hidden = !cloud.available;
    const act = activeSlot();
    list.innerHTML = SLOTS.map((s) => {
      const v = loadSave(s), label = esc(cloud.slotNames[s - 1] || (v ? `Slot ${s}` : 'Leer'));
      const sub = v ? esc(slotSummary(v)) : 'Tippen: neues Spiel hier';
      const meta = v ? [v.dev, when(v.t)].filter(Boolean).map((x) => `<small>${esc(x!)}</small>`).join('') : '';
      return `<div class="slot${s === act ? ' on' : ''}${v ? '' : ' empty'}"><button type="button" class="slot-pick" data-slot="${s}" aria-pressed="${s === act}">`
        + `<i>${s}</i><span><b>${label}</b><small>${sub}</small></span>${meta || s === act ? `<em>${s === act ? '<u>aktiv</u>' : ''}${meta}</em>` : ''}</button>`
        + (on ? `<button type="button" class="slot-name" data-slot="${s}" aria-label="Slot ${s} umbenennen">✎</button>` : '') + '</div>';
    }).join('');
  };
  onAccount(show);
  show();
  list.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-slot]');
    if (!b) return;
    const s = Number(b.dataset.slot) as Slot;
    if (b.classList.contains('slot-pick')) { pickSlot(s); return; }
    const n = prompt(`Name für Slot ${s}:`, cloud.slotNames[s - 1] ?? '');
    if (n !== null) void cloud.renameSlot(s, n);
  });
  rename.addEventListener('click', () => { const n = prompt('Name des Kontos:', cloud.name); if (n !== null) void cloud.rename(n); });
  copy.addEventListener('click', () => {
    const c = formatCode(cloud.code);
    void (navigator.clipboard?.writeText(c) ?? Promise.reject()).then(() => { copy.textContent = 'Kopiert'; setTimeout(() => { copy.textContent = 'Code kopieren'; }, 2000); }, () => prompt('Online-Code:', c));
  });
  join.addEventListener('click', () => {
    const raw = prompt('Code des Kontos eingeben (z. B. ABCD-1234). Alle drei Slots auf diesem Gerät werden ersetzt, Sicherungen bleiben.');
    if (!raw) return;
    void joinAccount(raw).then((err) => { if (err) info.textContent = err; });
  });
}
