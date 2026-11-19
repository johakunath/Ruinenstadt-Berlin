// M17: intro cards on the first start and one-time tutorial cards in the run (2D `ITUT`, `TUTS`,
// js/panels.js v0.100/v0.101). Seen cards are kept in the profile (`inventory.tips`).
import type { Sim } from '../sim/types';
import standstillArt from '../../assets/ui/intro-standstill.webp?url';
import streetArt from '../../assets/ui/intro-fight.webp?url';
import koepenickArt from '../../assets/ui/intro-koepenick.webp?url';
import controlsArt from '../../assets/ui/intro-controls.webp?url';

const PAGES: ReadonlyArray<readonly [string, string, string]> = [
  ['Berlin steht still', 'Die Weltzeituhr ist zerbrochen. Jeder Bezirk hängt in seiner eigenen Zeit fest, voller Zeitloser.', standstillArt],
  ['Kämpf dich durch', 'Der Pfeil führt zum nächsten Kampf. Danach wählst du einen Segen. Beute legst du im Inventar an.', streetArt],
  ['Befreie Köpenick', 'Besiege den Hauptmann am Rathaus. Ausrüstung und Schrott bleiben, das Lager macht dich stärker.', koepenickArt],
];
const controls = (): string => matchMedia('(pointer: coarse)').matches
  ? 'Am besten quer halten.<br><b>Links</b>: Daumen ziehen, du läufst.<br><b>Rechts</b>: Schlag, Rolle, Kraft.'
  : '<b>WASD</b> laufen, <b>Maus</b> zielt.<br><b>Linksklick</b> Schlag · <b>Leertaste</b> Rolle · <b>E</b> Kraft.<br>Controller: <b>A</b> Schlag · <b>B</b> Rolle · <b>Y</b> Kraft.';
export const TUTORIALS = {
  loot: ['Neue Ausrüstung', 'Liegt jetzt im Rucksack. <b>Pause</b> öffnet das Inventar: Teil antippen, <b>Anlegen</b>. ▲ heißt stärker.'],
  perk: ['Segen', 'Nach jedem Kampf wählst du 1 von 3. Gilt nur für diese Expedition. Gleiche Familien kommen öfter, zwei Familien öffnen einen Doppelsegen.'],
} as const;
export type TipId = keyof typeof TUTORIALS | 'intro';
/** M12c 2D `tip(kind)` on the first sight of a kind: one line as a toast, once per profile (`inventory.tips`). */
export const SIGHT_TIPS: Partial<Record<import('../data/enemies').EnemyKind, string>> = {
  kabel: 'Kabelghule springen dich an (Linie am Boden).',
  bass: 'Boxenköpfe wummern rosa Ringe. Durchrollen.',
};

export class IntroUi {
  readonly root = document.createElement('div');
  private page = 0;
  private tip: keyof typeof TUTORIALS | null = null;
  private then: (() => void) | null = null;
  private padDown: boolean[] = [];

  constructor(private readonly sim: () => Sim, private readonly onSeen: () => void) {
    this.root.id = 'intro';
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-labelledby', 'intro-title');
    document.body.append(this.root);
    this.root.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-intro]'); if (b) this.act(b.dataset.intro!); });
    window.addEventListener('keydown', e => {
      if (this.root.hidden || (e.key !== 'Escape' && e.key !== 'Enter')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      this.act(e.key === 'Enter' ? 'next' : 'done');
    }, { capture: true });
  }
  get isOpen(): boolean { return !this.root.hidden; }
  seen(id: TipId): boolean { return !!this.sim().inventory.tips?.[id]; }
  /** The four intro cards; `then` runs after the last (e.g. start the run). */
  showIntro(then: (() => void) | null = null): void { this.tip = null; this.page = 0; this.then = then; this.open(); }
  /** A tutorial card once per profile; false when it was seen already. */
  showTip(id: keyof typeof TUTORIALS, then: (() => void) | null = null): boolean {
    if (this.seen(id)) return false;
    this.tip = id; this.then = then; this.open(); return true;
  }
  private open(): void { this.render(); this.root.hidden = false; this.root.querySelector<HTMLElement>('.primary')?.focus(); }
  private render(): void {
    if (this.tip) { const [t, b] = TUTORIALS[this.tip]; this.root.innerHTML = `<div class="panel intro"><h2 id="intro-title">${t}</h2><p class="lead">${b}</p><button type="button" class="primary" data-intro="done">Weiter</button></div>`; return; }
    const last = this.page === PAGES.length, [t, b, art] = last ? ['Steuerung', controls(), controlsArt] : PAGES[this.page]!;
    this.root.innerHTML = `<div class="panel intro"><h2 id="intro-title">${t}</h2><img class="intro-art" src="${art}" alt="" draggable="false"><p class="lead">${b}</p><div class="idots">${Array.from({ length: PAGES.length + 1 }, (_, k) => `<i class="${k === this.page ? 'on' : ''}"></i>`).join('')}</div><button type="button" class="primary" data-intro="${last ? 'done' : 'next'}">${last ? (this.then ? 'Losziehen' : 'Verstanden') : 'Weiter'}</button>${last ? '' : '<button type="button" class="iskip" data-intro="done">Überspringen</button>'}</div>`;
  }
  private act(a: string): void {
    if (a === 'next' && !this.tip && this.page < PAGES.length) { this.page++; this.render(); this.root.querySelector<HTMLElement>('.primary')?.focus(); return; }
    const inv = this.sim().inventory, tips = (inv.tips ??= {});
    tips[this.tip ?? 'intro'] = 1;
    this.root.hidden = true;
    this.onSeen();
    const then = this.then; this.then = null; this.tip = null;
    then?.();
  }
  /** Pad A continues, B skips. */
  pollPad(): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(p => p?.connected);
    if (!pad) { this.padDown = []; return; }
    const down = pad.buttons.map(b => b.pressed), prev = this.padDown;
    this.padDown = down;
    if (this.root.hidden) return;
    if (down[0] && !prev[0]) this.act('next'); else if (down[1] && !prev[1]) this.act('done');
  }
}
