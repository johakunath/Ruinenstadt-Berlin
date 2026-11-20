// U3: the settings shared by the start screen (before the game loads) and the options screen.
// One options object for the page; every [data-opt] control is a view of it and stays in sync.
// The game (main.ts) adds live effects through `settingHooks` once it has loaded.
import { readOptions, storeOptions, type Options } from '../options';
import { PROFILES, type ProfileId } from '../render/profile';

export const opts: Options = readOptions();

export interface SettingHooks {
  /** Render profile picked. Without a hook (start screen) it is only stored. */
  profile?(id: ProfileId): void;
  /** Ton, Musik or Lautstärke changed. */
  audio?(): void;
  perf?(on: boolean): void;
  /** Akkusparen switched. */
  eco?(on: boolean): void;
  telemetry?(on: boolean): void;
}
export const settingHooks: SettingHooks = {};

type BoolKey = 'sound' | 'music' | 'rumble' | 'eco' | 'showPerf' | 'telemetry' | 'autoAttack' | 'damageNumbers';
const BOOL: BoolKey[] = ['sound', 'music', 'rumble', 'eco', 'showPerf', 'telemetry', 'autoAttack', 'damageNumbers'];

export const canFullscreen = (): boolean => typeof document.documentElement.requestFullscreen === 'function';
export function toggleFullscreen(): void {
  void (document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.())?.catch(() => undefined);
}

/** A switch (2D `tg`). */
export const toggle = (key: BoolKey | 'fullscreen', label: string): string => `<button type="button" class="tgl" data-opt="${key}" role="switch" aria-checked="false" aria-label="${label}"><i></i></button>`;
/** Segment buttons (2D `seg`). */
export const segment = (key: string, label: string, items: Array<[string, string]>): string => `<div class="seg" data-opt="${key}" role="group" aria-label="${label}">${items.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div>`;
/** One setting as a card with a short sub-line (2D `row`). */
export const row = (name: string, sub: string, control: string, attrs = ''): string => `<div class="orow"${attrs}><div class="ot"><div class="oname">${name}</div>${sub ? `<div class="odesc">${sub}</div>` : ''}</div><div class="oc">${control}</div></div>`;

export const profileSeg = (): string => segment('profile', 'Grafik', [['qualitaet', PROFILES.qualitaet.label], ['ausgewogen', PROFILES.ausgewogen.label], ['leistung', PROFILES.leistung.label]]);
export const volumeRange = (): string => '<input type="range" min="0" max="100" data-opt="volume" aria-label="Lautstärke" />';

/** Puts every view in the page on the current values. */
export function syncSettings(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-opt]')) {
    const k = el.dataset.opt!;
    if (el.classList.contains('tgl')) {
      const on = k === 'fullscreen' ? !!document.fullscreenElement : !!opts[k as BoolKey];
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', String(on));
    } else if (el.classList.contains('seg') && k === 'profile') {
      for (const b of el.querySelectorAll<HTMLButtonElement>('button')) { const on = b.dataset.v === opts.profile; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    } else if (el instanceof HTMLInputElement && k === 'volume') {
      el.value = String(Math.round(opts.volume * 100));
    }
  }
}

function pickProfile(id: ProfileId): void {
  if (id === opts.profile) return;
  opts.profile = id;
  storeOptions(opts);
  if (settingHooks.profile) { settingHooks.profile(id); return; }
  // Not loaded yet: the choice is stored; a profile in the URL would override it on the next load.
  const q = new URLSearchParams(location.search);
  if (q.has('profile')) { q.set('profile', PROFILES[id].label); history.replaceState(null, '', `${location.pathname}?${q.toString()}${location.hash}`); }
}

let bound = false;
/** Wires all [data-opt] controls once (delegated, so views built later work too). */
export function bindSettings(): void {
  if (bound) return;
  bound = true;
  document.addEventListener('click', e => {
    const t = (e.target as Element).closest<HTMLElement>('[data-opt]');
    if (!t) return;
    const k = t.dataset.opt!;
    if (k === 'fullscreen') { toggleFullscreen(); return; }
    if (t.classList.contains('seg')) {
      const b = (e.target as Element).closest<HTMLButtonElement>('button[data-v]');
      if (b && k === 'profile') pickProfile(b.dataset.v as ProfileId);
      syncSettings();
      return;
    }
    if (!t.classList.contains('tgl') || !BOOL.includes(k as BoolKey)) return;
    const key = k as BoolKey;
    opts[key] = !opts[key];
    storeOptions(opts);
    if (key === 'sound' || key === 'music') settingHooks.audio?.();
    if (key === 'showPerf') settingHooks.perf?.(opts.showPerf);
    if (key === 'eco') settingHooks.eco?.(opts.eco);
    if (key === 'telemetry') settingHooks.telemetry?.(opts.telemetry);
    syncSettings();
  });
  document.addEventListener('input', e => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement) || t.dataset.opt !== 'volume') return;
    opts.volume = Number(t.value) / 100;
    storeOptions(opts);
    settingHooks.audio?.();
    syncSettings();
  });
  document.addEventListener('fullscreenchange', syncSettings);
  for (const el of document.querySelectorAll<HTMLElement>('[data-opt="fullscreen"]')) el.closest<HTMLElement>('.orow')?.toggleAttribute('hidden', !canFullscreen());
  syncSettings();
}

const FS_ON = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
const FS_OFF = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
/**
 * U3: fullscreen icon button, always at the top right of the screen, left of the pause button or
 * the × of a menu (Johannes, 2026-11-17). Hidden only where the Fullscreen API is missing.
 */
export function initFullscreenButton(): void {
  const b = document.getElementById('fsb') as HTMLButtonElement | null;
  if (!b) return;
  b.hidden = !canFullscreen();
  const show = (): void => {
    const on = !!document.fullscreenElement;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${on ? FS_OFF : FS_ON}</svg>`;
    b.setAttribute('aria-label', on ? 'Vollbild beenden' : 'Vollbild');
    b.title = on ? 'Vollbild beenden' : 'Vollbild';
  };
  show();
  b.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', show);
}
