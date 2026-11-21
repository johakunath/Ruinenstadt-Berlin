// U3 boot: shows the light start screen and loads the game (main.ts: renderer, map, assets) only on
// Spielen, Weiter, Lager or a confirmed Spielstand löschen. ?autostart skips the screen. A profile
// change in a run reloads straight back into that run (RESUME flag, see main.ts).
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/pirata-one/latin-400.css';
import './ui/style.css';
import { isDifficulty } from './data/difficulty';
import { GO_KEY, reloadWith, RESUME_KEY } from './options';
import { campOpen, stopName, tunnelName } from './data/lines';
import { optionsScreen } from './ui/options-screen';
import { bindSettings, initFullscreenButton, opts } from './ui/settings';
import { MAP_NAME, MAP_SUB, type MapId } from './ui/maps';
import { pickIsHere, selectHere, titleNet } from './ui/title-net';
import { startScreen } from './ui/start';
import { initAccount } from './ui/account';
import { activeSlot, slotKey } from './save';


const start = startScreen();
const options = optionsScreen();
bindSettings();
// M6b: the cloud sync starts here, so the account and slots show before the game loads.
initAccount(() => !start.root.hidden);
initFullscreenButton();
const title = start.root;
document.getElementById('title-sub')!.textContent = opts.map === 'tunnel' && opts.line > 0 ? `${tunnelName(opts.line)} · Richtung ${stopName(opts.line + 1)}` : MAP_SUB[opts.map];

// The few save facts the screen needs, read without the sim (main.ts reads the real save on load).
// Debug starts (?at, ?stress, ?mapscale, ?spawn) never read the save, as in main.ts.
const persist = !opts.autostart && !opts.stress && !opts.startAt && opts.mapScale === 1 && opts.spawn.length === 0;
const peek = ((): { difficulty?: unknown; run?: { map?: string; index?: number } | null; profile?: { inventory?: { camp?: { freed?: number[] } } } } | null => {
  if (!persist) return null;
  try { return JSON.parse(localStorage.getItem(slotKey(activeSlot())) ?? 'null'); } catch { return null; }
})();
// M16 C3: keyed by line (both U2 tunnels had the same name, so one's saved run was offered in the other).
const mapName = opts.map === 'tunnel' && opts.line > 0 ? tunnelName(opts.line) : MAP_NAME[opts.map];
const run = opts.map !== 'hof' && peek?.run?.map === mapName ? peek.run : null;
start.setResume(run ? `Kampf ${(run.index ?? 0) + 1}` : null, isDifficulty(peek?.difficulty) ? peek.difficulty : start.difficulty);
// Layout 2A: the network map with the next place picked; the main button follows the pick.
titleNet().show(peek?.profile?.inventory?.camp?.freed ?? []);
start.setTarget(titleNet().label() || null);
titleNet().onSelect = () => start.setTarget(titleNet().label() || null);
// M20: the camp opens with the S3 (Johannes, 2026-11-18); before that no button leads there.
const freed = peek?.profile?.inventory?.camp?.freed;
document.getElementById('open-camp')!.hidden = !campOpen(freed) || opts.map === 'hof';

type Game = typeof import('./main');
let game: Promise<Game | null> | null = null;
let loaded = false;
/** Loads the game once; null when it could not start (the message stays on the title). */
function loadGame(): Promise<Game | null> {
  start.loading(true);
  return game ??= import('./main').then(async m => {
    if (!(await m.ready)) throw new Error('renderer');
    loaded = true;
    start.loading(false);
    return m;
  }).catch((err: unknown) => {
    console.error(err);
    start.loading(true, 'Start fehlgeschlagen. WebGL 2 nötig.');
    return null;
  });
}

// Until the game is there, the title buttons are the boot's: the game ones load it and then press
// the same button again (main.ts has added its handler by then).
let armed = 0;
title.addEventListener('click', e => {
  if (loaded) return;
  const b = (e.target as Element).closest<HTMLButtonElement>('button[id]');
  if (!b || !title.contains(b)) return;
  if (game) { e.stopImmediatePropagation(); return; }
  if (b.id === 'open-camp') {
    e.stopImmediatePropagation();
    reloadWith({ map: 'lager' });
  } else if (b.id === 'play' && !pickIsHere()) {
    e.stopImmediatePropagation();
    if (titleNet().canRide()) titleNet().rideSelected();
  } else if (b.id === 'play' || b.id === 'resume') {
    e.stopImmediatePropagation();
    void loadGame().then(m => { if (m) b.click(); });
  } else if (b.id === 'go-tunnel' || b.id === 'go-xhain') {
    e.stopImmediatePropagation();
    reloadWith({ map: (b.dataset.to as MapId | undefined) ?? 'koepenick' });
  } else if (b.id === 'new-game') {
    e.stopImmediatePropagation();
    // Asks once: the second tap within a few seconds wipes the save (main.ts newGame).
    if (armed && performance.now() - armed < 4000) { armed = 0; void loadGame().then(m => m?.newGame()); return; }
    armed = performance.now();
    b.innerHTML = '<b>Wirklich? Slot löschen</b><small>Nochmal tippen</small>';
    setTimeout(() => { if (armed && performance.now() - armed >= 3900) { armed = 0; b.innerHTML = '<b>Slot löschen</b><small>Nur dieser Slot: Ausrüstung, Schrott und Lager weg</small>'; } }, 4000);
  }
}, true);

let resumeNow = false, goNow = false;
try { resumeNow = sessionStorage.getItem(RESUME_KEY) === '1'; sessionStorage.removeItem(RESUME_KEY); goNow = sessionStorage.getItem(GO_KEY) === 'play'; sessionStorage.removeItem(GO_KEY); } catch { /* no session storage */ }
if (opts.map === 'lager') {
  // M20: the walkable camp has no title; it is reachable only once the S3 is cleared.
  if (!opts.autostart && persist && !campOpen(freed)) reloadWith({ map: 'koepenick' });
  else { title.hidden = true; void loadGame(); }
} else if (opts.autostart) {
  title.hidden = true;
  void import('./main');
} else if (resumeNow && run) {
  void loadGame().then(m => { if (m) document.getElementById('resume')!.click(); });
} else if (goNow) {
  // From a network map: straight into the expedition here (a waiting checkpoint goes on).
  selectHere();
  start.setTarget(titleNet().label() || null);
  void loadGame().then(m => { if (m) document.getElementById(run ? 'resume' : 'play')!.click(); });
} else {
  start.root.querySelector<HTMLElement>(run ? '#resume' : '#play')?.focus({ preventScroll: true });
}

// Pad on the start and options screens until the game loop takes over (main.ts frame).
const poll = (now: number): void => {
  if (loaded) return;
  start.pollPad(now);
  options.pollPad(now);
  requestAnimationFrame(poll);
};
requestAnimationFrame(poll);
