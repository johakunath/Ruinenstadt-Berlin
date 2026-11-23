// M17 Fernsehturm ending cards (T10, `docs/tasks/m17-fernsehturm.md`): after the choice at the main switch, one card
// says what the choice did, drawn in code (the sun rising over one light, or the city's patchwork of eras under the
// stars). The choice changes no rule; it is kept as `camp.ending`. Uses the intro card's panel style.
export type Ending = 'gestellt' | 'gelassen';

export const ENDING_CARD: Readonly<Record<Ending, readonly [string, string]>> = {
  gestellt: ['Normalzeit', 'Berlin tickt wieder, auch das Alte.'],
  gelassen: ['Stillstand', 'Die Stadt behält ihre Zeiten.'],
};

/** The skyline both cards share: the tower in the middle, blocks to both sides (viewBox 320 × 140). */
const SKYLINE = 'M0 140V104h18v-14h16v20h14V96h20v22h12V88h16v26h18V100h14V76h10v40h8V60h4V36h-2l3-10 3 10h-2v24h4v56h8V90h16v24h12V98h18v18h14V92h16v20h20V100h14v18h16V106h18v34z';

function art(e: Ending): string {
  if (e === 'gestellt') {
    // One light over the whole city: the sun clears the horizon, every era in the same warm light.
    return `<svg viewBox="0 0 320 140" class="intro-art" role="img" aria-label="Sonnenaufgang über Berlin">
      <defs><linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4a7a"/><stop offset=".55" stop-color="#e89a5a"/><stop offset="1" stop-color="#ffd890"/></linearGradient></defs>
      <rect width="320" height="140" fill="url(#dawn)"/><circle cx="230" cy="100" r="26" fill="#ffe8a8"/><circle cx="230" cy="100" r="40" fill="#ffd27a" opacity=".25"/>
      <path d="${SKYLINE}" fill="#2a2420"/><circle cx="160" cy="58" r="5" fill="#ffd27a"/></svg>`;
  }
  // The patchwork stays: each district in its own light under the stars.
  const stars = Array.from({ length: 40 }, (_, k) => `<circle cx="${(k * 73) % 320}" cy="${(k * 37) % 70}" r="${k % 3 ? 0.8 : 1.4}" fill="#e8f0ff"/>`).join('');
  return `<svg viewBox="0 0 320 140" class="intro-art" role="img" aria-label="Berlin bleibt in seinen Zeiten">
    <rect width="320" height="140" fill="#0c1428"/>${stars}
    <rect x="0" y="80" width="64" height="60" fill="#1e3e24"/><rect x="64" y="80" width="64" height="60" fill="#6e3016"/><rect x="128" y="80" width="64" height="60" fill="#c89a48"/>
    <rect x="192" y="80" width="64" height="60" fill="#4a1e5c"/><rect x="256" y="80" width="64" height="60" fill="#20502e"/>
    <path d="${SKYLINE}" fill="#10141c" opacity=".85"/><circle cx="160" cy="58" r="5" fill="#7dd3ff"/></svg>`;
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
    this.root.innerHTML = `<div class="panel intro"><h2 id="ending-title">${title}</h2>${art(e)}<p class="lead">${line}</p><button type="button" class="primary" data-ending>Weiter</button></div>`;
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
