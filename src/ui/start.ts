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
        <button id="resume" type="button" class="btn main" hidden>Weiter</button>
        <button id="play" type="button" class="btn main"><b>Losziehen</b><small>${MAP_PLAY[opts.map]}</small></button>
        <div class="diff"><div id="title-diff" class="seg" role="group" aria-label="Schwierigkeit">${DIFFICULTIES.map(d => `<button type="button" data-id="${d.id}" aria-pressed="false">${d.label}</button>`).join('')}</div><small id="diff-hint"></small></div>
        <div class="start-row"><button id="go-tunnel" type="button" class="btn" hidden><b>S3-Tunnel</b><small>Köpenick → Warschauer Straße</small></button><button id="go-xhain" type="button" class="btn" hidden><b>Xhain</b><small>1981 · Über die Mauer</small></button><button id="open-camp" type="button" class="btn">Lager</button></div>
        <button id="new-game" type="button" class="btn ghost"><b>Spielstand löschen</b><small>Ausrüstung, Schrott und Lager weg</small></button>
        <p id="loading" hidden>Lädt …</p>
      </section>
      <section class="start-opts" aria-label="Einstellungen">
        <div class="osec">Einstellungen</div>
        ${row('Grafik', '', profileSeg())}
        ${row('Ton', '', toggle('sound', 'Ton'))}${row('Musik', '', toggle('music', 'Musik'))}
        ${row('Lautstärke', '', volumeRange())}
        ${row('Vibration', '', toggle('rumble', 'Vibration'))}${row('Akkusparen', '', toggle('eco', 'Akkusparen'))}${row('Vollbild', '', toggle('fullscreen', 'Vollbild'))}
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
    p.innerHTML = label === null ? `<b>Losziehen</b><small>${MAP_PLAY[opts.map]}</small>` : '<b>Neue Expedition</b><small>Von vorn, Ausrüstung bleibt</small>';
    this.locked = label !== null;
    this.setDifficulty(difficulty);
  }

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
    l.hidden = !on;
    l.textContent = text;
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
