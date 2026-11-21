// M20: the S+U network map at the camp's train (2D `netSVG`/`tunCard` in `js/ubahn.js`): districts
// as interchanges, lines as tunnels between them. Tap a district for an expedition, a line for its
// tunnel; places without a 3D map yet stay grey ("kommt bald"). Ported layout and colors.
import { campOpen, LINE_FREED, LINES, linePlayable, NET_BADGES, NET_ROUTES, nextDestination, stopName, STOPS } from '../data/lines';
import { keyNav } from './focus';

export type NetGo = { map: 'koepenick' | 'xhain' | 'alex' | 'mitte' } | { map: 'tunnel'; line: number };

export class NetBoard {
  readonly root = document.createElement('div');
  private sel: { stop: number } | { line: number } | null = null;
  private freed: readonly number[] = [];
  private padDown: boolean[] = [];
  private padNext = 0;

  /** Layout 2A (Johannes 2026-11-18): the same map inline on the title, without its own card; the title's main button rides. */
  private readonly inline: boolean;
  /** Inline: called when the player picks another place. */
  onSelect: () => void = () => undefined;
  constructor(private readonly go: (to: NetGo) => void, private readonly onClose: () => void, host?: HTMLElement) {
    this.inline = !!host;
    this.root.setAttribute('aria-label', 'Netzplan');
    if (host) {
      this.root.className = 'net-inline';
      host.append(this.root);
    } else {
      this.root.id = 'netboard';
      this.root.className = 'overlay';
      this.root.hidden = true;
      this.root.setAttribute('role', 'dialog');
      document.body.append(this.root);
    }
    this.root.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (t.closest('[data-close]')) { this.close(); return; }
      if (t.closest('[data-ride]')) { this.ride(); return; }
      const g = t.closest<HTMLElement>('[data-stop],[data-line]');
      if (!g) return;
      this.sel = g.dataset.stop !== undefined ? { stop: +g.dataset.stop } : { line: +g.dataset.line! };
      this.render();
      this.onSelect();
      if (this.inline) { this.focusSel(); return; }
      this.root.querySelector<HTMLElement>('[data-ride]:not(:disabled)')?.focus();
    });
    if (!this.inline) keyNav(this.root, () => this.close());
    this.root.addEventListener('keydown', (e) => {
      if ((e.code === 'Enter' || e.code === 'Space') && (e.target as Element).closest('[data-stop],[data-line]')) { e.preventDefault(); (e.target as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      // Keyboard only (Codex review): arrows walk the network as the pad does; Enter on the button rides.
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.code];
      if (dir) { e.preventDefault(); e.stopPropagation(); this.step(dir); }
    }, true);
  }

  get isOpen(): boolean { return !this.root.hidden; }
  open(freed: readonly number[]): void {
    this.freed = freed;
    this.sel = nextDestination(freed);
    this.root.hidden = false;
    this.render();
    this.root.querySelector<HTMLElement>('[data-ride]:not(:disabled)')?.focus();
  }
  close(): void { if (!this.isOpen || this.inline) return; this.root.hidden = true; this.onClose(); }
  /** Inline on the title: show the network with the next destination picked (a pick of the player stays). */
  show(freed: readonly number[]): void {
    const same = this.freed.length === freed.length && this.freed.every((v, i) => v === freed[i]);
    this.freed = freed;
    if (!this.sel || !same) this.sel = nextDestination(freed);
    this.render();
  }
  /** The picked place and whether it can be played now. */
  get selection(): { stop: number } | { line: number } | null { return this.sel; }
  canRide(): boolean { const s = this.sel; return !!s && ('stop' in s ? this.stopOpen(s.stop) : linePlayable(s.line, this.freed)); }
  /** Short label of the picked place for the title button. */
  label(): string { const s = this.sel; return !s ? '' : 'stop' in s ? STOPS[s.stop]!.name : `${LINES[s.line]!.id} · ${stopName(s.line)} → ${stopName(s.line + 1)}`; }
  rideSelected(): void { this.ride(); }
  /** Picks a place (inline: the page a ride just arrived at). */
  select(sel: { stop: number } | { line: number }): void { this.sel = sel; this.render(); }
  /** Inline: keeps the pad and keyboard focus on the picked place after a re-render. */
  private focusSel(): void {
    const s = this.sel;
    if (!s) return;
    this.root.querySelector<SVGGElement>('stop' in s ? `[data-stop="${s.stop}"]` : `[data-line="${s.line}"]`)?.focus();
  }

  /** Pad: D-pad/stick moves between the stops, lines and buttons, A presses, B closes. */
  pollPad(now: number): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    if (!pad) { this.padDown = []; return; }
    const down = pad.buttons.map((b) => b.pressed), prev = this.padDown, edge = (i: number): boolean => !!down[i] && !prev[i];
    this.padDown = down;
    if (!this.isOpen) return;
    if (edge(1)) { this.close(); return; }
    if (edge(0)) { (document.activeElement as HTMLElement | null)?.click(); return; }
    if (now < this.padNext) return;
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const dx = down[14] || ax < -0.5 ? -1 : down[15] || ax > 0.5 ? 1 : 0, dy = down[12] || ay < -0.5 ? -1 : down[13] || ay > 0.5 ? 1 : 0;
    if (!dx && !dy) return;
    this.padNext = now + 170;
    this.step(dx || dy);
  }

  /** Pad and arrow keys: walk the stops and lines in route order (Köpenick, S3, Lager, U8, …). */
  private step(dir: number): void {
    const order = STOPS.flatMap((_, i) => (i < LINES.length ? [{ stop: i }, { line: i }] : [{ stop: i }]));
    const cur = order.findIndex((o) => this.sel && ('stop' in o ? 'stop' in this.sel && this.sel.stop === o.stop : 'line' in this.sel && this.sel.line === o.line));
    this.sel = order[(Math.max(0, cur) + dir + order.length) % order.length]!;
    this.render();
    this.root.querySelector<HTMLElement>('[data-ride]')?.focus();
  }

  /** A district opens with the line that leads to it (the camp at Xhain with the S3, M15: the Alex with the U8, Mitte with the U2). */
  private stopOpen(i: number): boolean { return !!STOPS[i]?.map && (i === 0 || (i === 1 ? campOpen(this.freed) : this.freed.includes(LINE_FREED + i - 1) || this.freed.includes(i))); }
  private ride(): void {
    const s = this.sel;
    if (!s) return;
    if ('stop' in s) { const m = STOPS[s.stop]?.map; if ((m === 'koepenick' || m === 'xhain' || m === 'alex' || m === 'mitte') && this.stopOpen(s.stop)) this.go({ map: m }); return; }
    if (linePlayable(s.line, this.freed)) this.go({ map: 'tunnel', line: s.line });
  }

  private render(): void {
    const f = this.freed, pts = (a: ReadonlyArray<readonly [number, number]>): string => a.map((p) => p.join(',')).join(' ');
    let svg = '<svg class="net" viewBox="0 0 400 250" role="group" aria-label="S- und U-Bahn-Netz"><rect width="400" height="250" fill="#14282b"/><text x="12" y="20" class="nett">S+U Netz · Ruinenstadt</text>';
    LINES.forEach((L, k) => {
      const fr = f.includes(LINE_FREED + k), op = linePlayable(k, f), sel = this.sel && 'line' in this.sel && this.sel.line === k, P = pts(NET_ROUTES[k]!);
      svg += `<g class="line${fr || op ? '' : ' lock'}" data-line="${k}" role="button" tabindex="0" aria-label="${L.id} ${STOPS[k]!.name} nach ${STOPS[k + 1]!.name}">`;
      if (sel) svg += `<polyline points="${P}" fill="none" stroke="#ef9f27" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>`;
      svg += `<polyline points="${P}" fill="none" stroke="${fr || op ? L.color : '#3a4a4e'}" stroke-width="${fr || op ? 6 : 3}" stroke-linecap="round" stroke-linejoin="round"${fr ? '' : ` stroke-dasharray="${op ? '7 5' : '3 4'}"`}/>`;
      const b = NET_BADGES[k]!, round = L.id.startsWith('S');
      svg += `<rect x="${b[0] - 10}" y="${b[1] - 6}" width="20" height="12" rx="${round ? 6 : 2}" fill="${fr || op ? L.color : '#3a4a4e'}"/><text x="${b[0]}" y="${b[1] + 3}" class="netb">${L.id}</text>`;
      if (op && !fr) svg += `<text x="${b[0]}" y="${b[1] - 10}" class="neto">Tunnel offen</text>`;
      svg += `<polyline points="${P}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
    });
    STOPS.forEach((d, i) => {
      const [x, y] = d.at, open = this.stopOpen(i), won = f.includes(i), here = i === 1, sel = this.sel && 'stop' in this.sel && this.sel.stop === i;
      const lx = [0, 30, 17, -27, 22][i]!, ly = [25, 20, 23, -5, 24][i]!, an = lx > 20 ? 'start' : lx < -20 ? 'end' : 'middle';
      svg += `<g class="node${open ? '' : ' lock'}" data-stop="${i}" role="button" tabindex="0" aria-label="${d.name}${open ? '' : ' kommt bald'}">`;
      if (here || sel) svg += `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="#ef9f27" stroke-width="2"><animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite"/></circle>`;
      svg += `<rect x="${x - 12}" y="${y - 9}" width="24" height="18" rx="9" fill="${!open ? '#2a211b' : won ? '#3b6d11' : '#993c1d'}" stroke="${sel ? '#ef9f27' : open ? '#ead9c0' : '#4a5a5e'}" stroke-width="${sel ? 3 : 2}"/>`;
      if (won && i === 0) svg += `<path d="M${x - 4} ${y}l3 3 5-6" stroke="#ead9c0" stroke-width="2" fill="none"/>`;
      svg += `<text x="${x + lx}" y="${y + ly}" class="mname${open ? '' : ' lock'}" style="text-anchor:${an}">${d.name}</text>`;
      svg += `<text x="${x + lx}" y="${y + ly + 11}" class="nets" style="text-anchor:${an}">${here ? 'Lager · ' : ''}${open ? d.station : 'kommt bald'}</text><circle cx="${x}" cy="${y}" r="15" fill="transparent"/></g>`;
    });
    svg += '<g transform="translate(12,238)" class="nets"><line x1="0" y1="-3" x2="14" y2="-3" stroke="#2a8a3a" stroke-width="5"/><text x="18">frei</text><line x1="46" y1="-3" x2="60" y2="-3" stroke="#da421e" stroke-width="5" stroke-dasharray="5 3"/><text x="64">Tunnel offen</text><line x1="124" y1="-3" x2="138" y2="-3" stroke="#3a4a4e" stroke-width="3" stroke-dasharray="3 3"/><text x="142">kommt bald</text></g></svg>';
    this.root.innerHTML = this.inline ? svg : `<div class="net-panel"><header class="menu-head"><h2>Abfahrt · Netzplan</h2><button type="button" class="tr-x" data-close aria-label="Zurück">×</button></header>${svg}${this.card()}</div>`;
  }

  /** The chosen place: what it is and the button that goes there (2D `tunCard`). */
  private card(): string {
    const s = this.sel, f = this.freed;
    if (!s) return '';
    if ('stop' in s) {
      const d = STOPS[s.stop]!, open = this.stopOpen(s.stop);
      return `<div class="net-card"><div><b>${d.name}</b><small>${open ? `${s.stop === 1 ? 'Das Lager liegt hier. ' : ''}${f.includes(s.stop) ? 'Befreit. Nochmal hin für Beute.' : 'Expedition'}` : 'Kommt bald'}</small></div><button type="button" class="primary" data-ride ${open ? '' : 'disabled'}>Losziehen</button></div>`;
    }
    const L = LINES[s.line]!, fr = f.includes(LINE_FREED + s.line), op = linePlayable(s.line, f);
    return `<div class="net-card"><div><b><span class="lbadge" style="background:${L.color};border-radius:${L.id.startsWith('S') ? 9 : 3}px">${L.id}</span> ${stopName(s.line)} → ${stopName(s.line + 1)}</b><small>${op ? `Geisterbahnhof ${L.ghost}, Gitter, geflutete Strecke. Am Ende den Generator halten: Der Schaffner.${fr ? ' Strecke frei.' : ''}` : 'Kommt bald'}</small></div><button type="button" class="primary" data-ride ${op ? '' : 'disabled'}>Einsteigen</button></div>`;
  }
}
