// U3: the start screen. Light: it is shown before the game (renderer, map, assets) loads and holds the
// title choices and the most important options on one screen (Johannes, 2026-11-17). The same DOM
// stays the title between runs; main.ts adds its handlers to the buttons by id.
import { DEFAULT_DIFFICULTY, DIFFICULTIES, difficultyOf, type DifficultyId } from '../data/difficulty';
import { PadNav, keyNav } from './focus';
import { optionsScreen } from './options-screen';
import { MAP_PLAY } from './maps';
import { opts, profileSeg, row, toggle, volumeRange } from './settings';

export class StartScreen {
  readonly root = document.getElementById('title') as HTMLElement;
  difficulty: DifficultyId = DEFAULT_DIFFICULTY;
  /** A checkpoint waits: its difficulty is fixed. */
  private locked = false;
  /** Difficulty picked; main.ts replaces it once loaded. */
  onDifficulty: (id: DifficultyId) => void = id => { if (!this.locked) this.setDifficulty(id); };
  private readonly pad: PadNav;

  constructor() {
    this.root.innerHTML = `<div class="start-box">
      <section class="start-main">
        <h1>Ruinenstadt<span>Berlin</span></h1>
        <p class="sub" id="title-sub">Köpenick bei Nacht</p>
        <div id="title-net"></div>
        <button id="resume" type="button" class="btn main" hidden>Weiter</button>
        <button id="play" type="button" class="btn main"><b>Losziehen</b><small>${MAP_PLAY[opts.map]}</small></button>
        <div class="diff"><div id="title-diff" class="seg" role="group" aria-label="Schwierigkeit">${DIFFICULTIES.map(d => `<button type="button" data-id="${d.id}" aria-pressed="false">${d.label}</button>`).join('')}</div><small id="diff-hint"></small></div>
        <div class="start-row"><button id="go-tunnel" type="button" class="btn" hidden><b>S3-Tunnel</b><small>Köpenick → Warschauer Straße</small></button><button id="go-xhain" type="button" class="btn" hidden><b>Xhain</b><small>1981 · Über die Mauer</small></button><button id="open-camp" type="button" class="btn">Lager</button></div>
        <button id="new-game" type="button" class="btn ghost"><b>Slot löschen</b><small>Nur dieser Slot: Ausrüstung, Schrott und Lager weg</small></button>
        <p id="loading" hidden>Lädt …</p>
      </section>
      <section class="start-opts" aria-label="Konto und Einstellungen">
        <div class="osec">Konto</div>
        <div class="acct" id="acct">
          <div class="acct-head"><b id="acct-name">Dieses Gerät</b><small id="acct-info"></small></div>
          <div class="slots" id="acct-slots"></div>
          <div class="acct-btns"><button id="acct-rename" type="button" class="btn sm" hidden>Umbenennen</button><button id="acct-copy" type="button" class="btn sm" hidden>Code kopieren</button><button id="acct-join" type="button" class="btn sm" hidden>Konto wechseln</button></div>
        </div>
        <div class="osec">Einstellungen</div>
        ${row('Grafik', '', profileSeg())}
        ${row('Ton', '', toggle('sound', 'Ton'))}${row('Musik', '', toggle('music', 'Musik'))}
        ${row('Lautstärke', '', volumeRange())}
        ${row('Vibration', '', toggle('rumble', 'Vibration'))}${row('Akkusparen', '', toggle('eco', 'Akkusparen'))}
        <p class="keys" id="keys-hint"></p>
        <button id="open-options" type="button" class="btn sm">Alle Optionen</button>
      </section></div>`;
    this.root.querySelector('#title-diff')!.addEventListener('click', e => {
      const b = (e.target as Element).closest<HTMLButtonElement>('button[data-id]');
      if (b) this.onDifficulty(b.dataset.id as DifficultyId);
    });
    this.root.querySelector('#open-options')!.addEventListener('click', () => optionsScreen().open());
    // Escape on the title opens the options (as the pause key does in a run).
    keyNav(this.root, () => optionsScreen().open());
    this.pad = new PadNav(this.root, () => this.active());
    this.setDifficulty(this.difficulty);
    this.keysHint();
  }

  /** Visible and nothing on top of it (camp, options, intro). */
  active(): boolean { return !this.root.hidden && !document.querySelector('.overlay:not([hidden]):not(#title)'); }
  pollPad(now: number): void { this.pad.poll(now); }
  /** The title came back: ignore the press that brought it. */
  resetPad(): void { this.pad.reset(); }

  /** Title: `label` shows Weiter (a wave checkpoint exists); the difficulty of that run is fixed. */
  setResume(label: string | null, difficulty: DifficultyId): void {
    const r = this.root.querySelector<HTMLButtonElement>('#resume')!, p = this.root.querySelector<HTMLButtonElement>('#play')!;
    r.hidden = label === null;
    if (label !== null) r.innerHTML = `<b>Weiter · ${label}</b><small>Dort weiter, wo du warst</small>`;
    p.classList.toggle('main', label === null);
    // Playtest 2026-11-16: each button says what it keeps.
    p.innerHTML = label === null ? `<b>Losziehen</b><small>${this.target ?? MAP_PLAY[opts.map]}</small>` : '<b>Neue Expedition</b><small>Von vorn, Ausrüstung bleibt</small>';
    this.resumeLabel = label;
    this.locked = label !== null;
    this.setDifficulty(difficulty);
  }

  /** Layout 2A: the place picked on the title's network map (null: this page's map). */
  private target: string | null = null;
  private resumeLabel: string | null = null;
  setTarget(label: string | null): void { this.target = label; this.setResume(this.resumeLabel, this.difficulty); }

  setDifficulty(id: DifficultyId): void {
    this.difficulty = id;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('#title-diff button')) {
      const on = b.dataset.id === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = this.locked && !on;
    }
    this.root.querySelector('#diff-hint')!.textContent = this.locked ? 'Schwierigkeit des laufenden Spiels' : difficultyOf(id).hint;
  }

  /** While the game loads the buttons wait. */
  loading(on: boolean, text = 'Lädt …'): void {
    const l = this.root.querySelector<HTMLElement>('#loading')!;
    l.hidden = true;
    l.textContent = text;
    loadBox(on, text);
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.start-main button')) b.toggleAttribute('data-wait', on);
    this.root.classList.toggle('waiting', on);
  }

  /** One line, for the device in use. */
  private keysHint(): void {
    const touch = matchMedia('(pointer: coarse)').matches;
    this.root.querySelector('#keys-hint')!.textContent = touch
      ? 'Links ziehen läuft, rechts Schlag, Rolle und Kräfte.'
      : 'WASD laufen · Maus schlägt und zielt · Leertaste Rolle · E Kraft · Esc Pause';
  }
}

let screen: StartScreen | null = null;
export function startScreen(): StartScreen { return screen ??= new StartScreen(); }

/**
 * Playtest 2026-11-20: the loading note sat small at the bottom of the title. Now a box in the
 * middle of the screen with an hourglass that runs and turns (the game is about time).
 */
let box: HTMLDivElement | null = null;
function loadBox(on: boolean, text: string): void {
  if (!box) {
    box = document.createElement('div');
    box.id = 'loadbox';
    box.setAttribute('role', 'status');
    box.innerHTML = `<div class="loadbox-card"><svg class="hourglass" viewBox="0 0 40 56" aria-hidden="true">
      <path class="hg-frame" d="M6 3h28M6 53h28M9 3c0 14 9 17 9 25S9 39 9 53M31 3c0 14-9 17-9 25s9 11 9 25"/>
      <clipPath id="hg-top"><path d="M10 6h20c-1 10-7 14-10 20-3-6-9-10-10-20z"/></clipPath>
      <clipPath id="hg-bot"><path d="M20 30c3 6 9 10 10 20H10c1-10 7-14 10-20z"/></clipPath>
      <rect class="hg-sand-top" clip-path="url(#hg-top)" x="8" y="6" width="24" height="22"/>
      <rect class="hg-sand-bot" clip-path="url(#hg-bot)" x="8" y="30" width="24" height="22"/>
      <line class="hg-stream" x1="20" y1="26" x2="20" y2="50"/>
    </svg><p></p></div>`;
    document.body.appendChild(box);
  }
  box.hidden = !on;
  box.querySelector('p')!.textContent = text;
  box.classList.toggle('failed', on && !/^Lädt/.test(text));
}
