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
import { campOpen, LINES } from './data/lines';
import { optionsScreen } from './ui/options-screen';
import { bindSettings, initFullscreenButton, opts } from './ui/settings';
import { startScreen } from './ui/start';

const SAVE_KEY = 'ruinenstadt-berlin.save';

const start = startScreen();
const options = optionsScreen();
bindSettings();
initFullscreenButton();
const title = start.root;
const sub = document.getElementById('title-sub')!;
if (opts.map === 'tunnel') sub.textContent = `${LINES[opts.line]?.id ?? 'S3'}-Tunnel · Richtung Warschauer Straße`;
else if (opts.map === 'hof') sub.textContent = 'Köpenick · Hinterhof bei Nacht';

// The few save facts the screen needs, read without the sim (main.ts reads the real save on load).
// Debug starts (?at, ?stress, ?mapscale, ?spawn) never read the save, as in main.ts.
const persist = !opts.autostart && !opts.stress && !opts.startAt && opts.mapScale === 1 && opts.spawn.length === 0;
const peek = ((): { difficulty?: unknown; run?: { map?: string; index?: number } | null; profile?: { inventory?: { camp?: { freed?: number[] } } } } | null => {
  if (!persist) return null;
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { return null; }
})();
const mapName = opts.map === 'tunnel' ? `${LINES[opts.line]?.id ?? 'S3'}-Tunnel` : opts.map === 'hof' ? 'Hof' : 'Köpenick';
const run = opts.map !== 'hof' && peek?.run?.map === mapName ? peek.run : null;
start.setResume(run ? `Kampf ${(run.index ?? 0) + 1}` : null, isDifficulty(peek?.difficulty) ? peek.difficulty : start.difficulty);
document.getElementById('go-tunnel')!.hidden = opts.map === 'hof' || (opts.map !== 'tunnel' && !peek?.profile?.inventory?.camp?.freed?.includes(0));
if (opts.map === 'tunnel') document.getElementById('go-tunnel')!.innerHTML = '<b>Zurück nach Köpenick</b><small>Ausrüstung bleibt</small>';
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
  } else if (b.id === 'play' || b.id === 'resume') {
    e.stopImmediatePropagation();
    void loadGame().then(m => { if (m) b.click(); });
  } else if (b.id === 'go-tunnel') {
    e.stopImmediatePropagation();
    reloadWith({ map: opts.map === 'tunnel' ? 'koepenick' : 'tunnel' });
  } else if (b.id === 'new-game') {
    e.stopImmediatePropagation();
    // Asks once: the second tap within a few seconds wipes the save (main.ts newGame).
    if (armed && performance.now() - armed < 4000) { armed = 0; void loadGame().then(m => m?.newGame()); return; }
    armed = performance.now();
    b.innerHTML = '<b>Wirklich? Alles löschen</b><small>Nochmal tippen</small>';
    setTimeout(() => { if (armed && performance.now() - armed >= 3900) { armed = 0; b.innerHTML = '<b>Spielstand löschen</b><small>Ausrüstung, Schrott und Lager weg</small>'; } }, 4000);
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
  // From the camp's network map: straight into the expedition (a waiting checkpoint goes on).
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
