// M17 Fernsehturm ending cards (T10, `docs/tasks/m17-fernsehturm.md`): after the choice at the main switch, one card
// says what the choice did, painted (the sun rising over one light, or the city's patchwork of eras under the
// stars). The choice changes no rule; it is kept as `camp.ending`. Uses the intro card's panel style.
import sunriseArt from '../../assets/ui/ending-gestellt.webp?url';
import patchworkArt from '../../assets/ui/ending-gelassen.webp?url';

export type Ending = 'gestellt' | 'gelassen';

export const ENDING_CARD: Readonly<Record<Ending, readonly [string, string]>> = {
  gestellt: ['Normalzeit', 'Berlin tickt wieder, auch das Alte.'],
  gelassen: ['Stillstand', 'Die Stadt behält ihre Zeiten.'],
};

/** T12 (local FLUX.2 klein, style of the intro cards): one painting per ending, 768 × 512 like the intro art. */
const PAINTED: Readonly<Record<Ending, readonly [string, string]>> = {
  gestellt: [sunriseArt, 'Sonnenaufgang über Berlin'],
  gelassen: [patchworkArt, 'Berlin bleibt in seinen Zeiten'],
};

function painted(e: Ending): string {
  const [src, label] = PAINTED[e];
  return `<img class="intro-art" src="${src}" alt="${label}" draggable="false">`;
}

/** One card over the game; `then` runs when it is closed (Weiter, Enter, Escape or pad A/B). */
export class EndingCard {
  readonly root = document.createElement('div');
  private then: (() => void) | null = null;
  private padDown: boolean[] = [];

  constructor() {
    this.root.id = 'ending';
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-labelledby', 'ending-title');
    document.body.append(this.root);
    this.root.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-ending]')) this.close(); });
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden || (e.key !== 'Escape' && e.key !== 'Enter')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.close();
    }, { capture: true });
  }

  get isOpen(): boolean { return !this.root.hidden; }

  show(e: Ending, then: (() => void) | null = null): void {
    const [title, line] = ENDING_CARD[e];
    this.then = then;
    this.root.innerHTML = `<div class="panel intro"><h2 id="ending-title">${title}</h2>${painted(e)}<p class="lead">${line}</p><button type="button" class="primary" data-ending>Weiter</button></div>`;
    this.root.hidden = false;
    this.root.querySelector<HTMLElement>('.primary')?.focus();
  }

  private close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    const t = this.then;
    this.then = null;
    t?.();
  }

  /** Pad A or B closes it. */
  pollPad(): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    if (!pad) { this.padDown = []; return; }
    const down = pad.buttons.map((b) => b.pressed), prev = this.padDown;
    this.padDown = down;
    if (this.root.hidden) return;
    if ((down[0] && !prev[0]) || (down[1] && !prev[1])) this.close();
  }
}
