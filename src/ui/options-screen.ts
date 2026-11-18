// U3: Optionen as its own screen, as in 2D (`js/panels.js` renderOpts): title, sections, one card per
// setting with a short sub-line, switches and segment buttons, the controls graphics. Opens from the
// start screen and from the cog in the pause menu; × top right closes. Built before the game loads;
// main.ts wires the run actions and the cloud row by id.
import { DEVICE_SVG, type ControlDevice } from './controls-gfx';
import { keyNav, PadNav } from './focus';
import { profileSeg, row, segment, syncSettings, toggle, volumeRange } from './settings';

const DEVICES: Array<[ControlDevice, string]> = [['touch', 'Touch'], ['key', 'Tastatur und Maus'], ['pad', 'Controller']];

/** The device shown first: a connected pad, then touch, else keyboard and mouse (2D ctlDev). */
function guessDevice(): ControlDevice {
  if ([...(navigator.getGamepads?.() ?? [])].some(p => p?.connected)) return 'pad';
  return matchMedia('(pointer: coarse)').matches ? 'touch' : 'key';
}

export class OptionsScreen {
  readonly root = document.createElement('div');
  private dev: ControlDevice | null = null;
  private previous: HTMLElement | null = null;
  private readonly pad: PadNav;
  /** Called after the screen closed (the pause menu takes the pad back). */
  onClose: () => void = () => {};

  constructor() {
    const r = this.root;
    r.id = 'optv';
    r.className = 'overlay';
    r.hidden = true;
    r.setAttribute('role', 'dialog');
    r.setAttribute('aria-modal', 'true');
    r.setAttribute('aria-label', 'Optionen');
    r.innerHTML = `<button type="button" class="tr-x" id="opt-close" aria-label="Zurück">×</button><div class="optbox">
      <div class="ohead"><h2>Optionen</h2></div>
      <div class="osec">Bild und Ton</div>
      ${row('Grafik', 'Qualität für PC, Leistung für Tablet und Handy.', profileSeg(), ' id="opt-profile-row"')}
      ${row('Ton', '', toggle('sound', 'Ton'))}${row('Musik', '', toggle('music', 'Musik'))}${row('Lautstärke', '', volumeRange(), ' id="opt-volume-row"')}
      ${row('Vibration', 'Kurze Stöße bei Treffern.', toggle('rumble', 'Vibration'))}
      ${row('Akkusparen', '30 Bilder pro Sekunde, schont Akku und Wärme.', toggle('eco', 'Akkusparen'))}
      ${row('Leistungsanzeige', 'Bildrate unten links.', toggle('showPerf', 'Leistungsanzeige'))}
      <div class="osec">Steuerung</div><div class="ctl">${segment('dev', 'Gerät', DEVICES)}<div class="ctl-gfx"></div></div>
      <div class="osec">Spielstand</div>
      ${row('Online speichern', '<span id="cloud-info"></span>', '<span class="cloud-btns"><button id="cloud-copy" type="button" class="btn sm">Kopieren</button><button id="cloud-join" type="button" class="btn sm">Code eingeben</button><button id="cloud-toggle" type="button" class="btn sm"></button></span>', ' id="cloud-row" hidden')}
      ${row('Spieldaten senden', 'Anonyme Laufdaten für die Balance.', toggle('telemetry', 'Spieldaten senden'))}
      <div id="run-actions"><div class="osec">Expedition</div>
      ${row('Abschließen', 'Den befreiten Bezirk verlassen.', '<button type="button" class="btn sm">Abschließen</button>', ' id="pause-finish" hidden')}
      ${row('Hauptmenü', 'Gespeichert, Weiter möglich.', '<button id="to-title" type="button" class="btn sm">Hauptmenü</button>')}
      ${row('Expedition abbrechen', 'Beute und Schrott bleiben, der Lauf zählt nicht.', '<button id="run-abort" type="button" class="btn sm danger">Abbrechen</button>')}
      </div><p class="hint" id="version"></p></div>`;
    document.body.append(r);
    r.querySelector('#opt-close')!.addEventListener('click', () => this.close());
    r.querySelector('[data-opt="dev"]')!.addEventListener('click', e => {
      const b = (e.target as Element).closest<HTMLButtonElement>('button[data-v]');
      if (b) { this.dev = b.dataset.v as ControlDevice; this.renderDevice(); }
    });
    r.addEventListener('click', e => { if (e.target === r) this.close(); });
    keyNav(r, () => this.close());
    this.pad = new PadNav(r, () => this.isOpen, () => this.close());
  }

  get isOpen(): boolean { return !this.root.hidden; }
  open(): void {
    if (this.isOpen) return;
    this.previous = document.activeElement as HTMLElement | null;
    this.dev = null;
    this.renderDevice();
    syncSettings();
    this.root.hidden = false;
    this.root.querySelector('.optbox')!.scrollTop = 0;
    this.pad.reset();
    this.root.querySelector<HTMLElement>('[data-opt="profile"] button.on, [data-opt="profile"] button')?.focus({ preventScroll: true });
  }
  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.previous?.focus?.({ preventScroll: true });
    this.onClose();
  }
  pollPad(now: number): void { this.pad.poll(now); }

  private renderDevice(): void {
    const d = this.dev ?? guessDevice();
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-opt="dev"] button')) { const on = b.dataset.v === d; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    this.root.querySelector('.ctl-gfx')!.innerHTML = DEVICE_SVG[d]();
  }
}

let screen: OptionsScreen | null = null;
/** The one options screen of the page (built on first use, before the game loads). */
export function optionsScreen(): OptionsScreen { return screen ??= new OptionsScreen(); }
