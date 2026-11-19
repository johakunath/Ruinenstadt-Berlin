// Layout 2A (Johannes 2026-11-18): the S+U network map on the title. The next place is picked; the
// main button plays this page's map when it is picked, else rides to the picked place (page reload).
// Built by the boot (before the game loads); main.ts uses the same one.
import { STOPS } from '../data/lines';
import { GO_KEY, reloadWith } from '../options';
import { NetBoard, type NetGo } from './netboard';
import { opts } from './settings';

let net: NetBoard | null = null;
export function titleNet(): NetBoard {
  return net ??= new NetBoard((to: NetGo) => {
    try { sessionStorage.setItem(GO_KEY, 'play'); } catch { /* the title waits instead */ }
    reloadWith({ map: to.map, line: to.map === 'tunnel' ? to.line : 0 });
  }, () => undefined, document.getElementById('title-net')!);
}

/** A ride just arrived (GO_KEY): pick this page's own map, so the main button starts it (Codex review, PR #57). */
export function selectHere(): void {
  if (opts.map === 'tunnel') { titleNet().select({ line: opts.line }); return; }
  const i = STOPS.findIndex((s) => s.map === opts.map);
  if (i >= 0) titleNet().select({ stop: i });
}

/** The pick is this page's own map (play here), not another one (ride there). */
export function pickIsHere(): boolean {
  const s = titleNet().selection;
  if (!s || opts.map === 'lager') return false;
  return 'stop' in s ? opts.map !== 'tunnel' && STOPS[s.stop]?.map === opts.map : opts.map === 'tunnel' && s.line === opts.line;
}
