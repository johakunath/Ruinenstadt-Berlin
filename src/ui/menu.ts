// U1/U2: one pause menu with tabs, as in 2D (`js/panels.js` renderInv): Inventar, Karte, Segen,
// Kodex, Optionen. Header shows Schrott, Item Level, district and fight, found hidden blessings.
import { ELITES, ELITE_MODS, ENEMIES, type EnemyKind } from '../data/enemies';
import { BASES } from '../data/item-names';
import { ELEMENTS, ENEMY_RESISTANCES, LEGENDARY_POWERS, RARITIES, SETS, SET_COLOR, type LegendaryId, type SetId, type SlotId } from '../data/items';
import { FAMILIES, PERKS, SURVIVORS, type PerkId } from '../data/progression';
import { avgIl } from '../sim/items';
import type { Sim } from '../sim/types';
import { perkIcon } from './abilities';
import { esc, itemIcon, InventoryUi } from './inventory';

export type TabId = 'inv' | 'karte' | 'segen' | 'kodex' | 'opt';
const TAB_NAME: Record<TabId, string> = { inv: 'Inventar', karte: 'Karte', segen: 'Segen', kodex: 'Kodex', opt: 'Optionen' };
const QUALITY = [['#e8ddd0', 'Gewöhnlich'], ['#7d9bff', 'Selten'], ['#f2d14b', 'Episch'], ['#b48cff', 'Umbau']] as const;

/** 2D KODEX lines, matched to the 3D roster (short German, one line each). */
const ENEMY_TEXT: Partial<Record<EnemyKind, string>> = {
  walker: 'Langsam und zahlreich. Fürchtet Feuer.', runner: 'Schnell und schwach. Kommt in Gruppen.',
  brute: 'Markiert einen Kreis und schlägt zu. Raus aus dem Kreis.', spitter: 'Hält Abstand und spuckt. Immun gegen Säure.',
  raptor: 'Zeigt eine Linie, dann springt er. Seitlich ausweichen.', crow: 'Kreist und stößt herab. Fliegt über alles.',
  feldwebel: 'Stürmt los und ruft Männer.', waechter: 'Feuert Salven und Ringe. Nah ran.',
  rex: 'Biss, Ansturm, Brüllringe, Schwanz.', hauptmann: 'Der Hauptmann von Köpenick. Schlägt, schießt, ruft.',
};
const NORMAL: EnemyKind[] = ['walker', 'runner', 'brute', 'spitter', 'raptor', 'crow'];
const BOSSES: EnemyKind[] = ['feldwebel', 'waechter', 'rex', 'hauptmann'];
const BASE_NAME: Record<string, string> = Object.fromEntries(Object.entries(BASES).map(([n, b]) => [b, n]));

export interface MenuHost {
  sim(): Sim;
  /** A run is on (play phase): game tabs. Off: only Kodex and Optionen (title). */
  inRun(): boolean;
  /** District and fight line for the header. */
  where(): string;
  /** Map SVG with the hero, or null without an expedition map. */
  mapSvg(): string | null;
  onToggle(open: boolean): void;
}

export class Menu {
  readonly root = document.createElement('div');
  private readonly tabsEl = document.createElement('nav');
  private readonly resEl = document.createElement('div');
  private readonly bodies: Record<TabId, HTMLElement>;
  tab: TabId = 'inv';
  private segenSel: PerkId | null = null;
  private padDown: boolean[] = [];
  private padNext = 0;
  private previousFocus: HTMLElement | null = null;

  constructor(private readonly host: MenuHost, readonly inventory: InventoryUi, options: HTMLElement) {
    this.root.id = 'menu';
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Pause');
    const panel = document.createElement('div');
    panel.className = 'menu-panel';
    const head = document.createElement('header');
    head.className = 'menu-head';
    this.tabsEl.className = 'menu-tabs';
    this.resEl.className = 'menu-res';
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'menu-x'; x.id = 'menu-close'; x.setAttribute('aria-label', 'Weiter'); x.textContent = '×';
    x.addEventListener('click', () => this.close());
    head.append(this.tabsEl, this.resEl, x);
    const body = document.createElement('div');
    body.className = 'menu-body';
    const mk = (id: TabId, el: HTMLElement = document.createElement('div')): HTMLElement => { el.dataset.tab = id; el.classList.add('menu-tab'); el.hidden = true; body.append(el); return el; };
    options.hidden = false;
    this.bodies = { inv: mk('inv', inventory.root), karte: mk('karte'), segen: mk('segen'), kodex: mk('kodex'), opt: mk('opt', options) };
    panel.append(head, body);
    this.root.append(panel);
    document.body.append(this.root);
    this.tabsEl.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-t]'); if (b) this.select(b.dataset.t as TabId); });
    this.bodies.segen.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-sg]'); if (b) { this.segenSel = b.dataset.sg as PerkId; this.renderTab(); this.bodies.segen.querySelector<HTMLElement>(`[data-sg="${b.dataset.sg}"]`)?.focus(); } });
    // A tap beside the panel closes the menu (as the old map overlay did).
    this.root.addEventListener('click', e => { if (e.target === this.root) this.close(); });
    this.root.addEventListener('keydown', e => {
      if (e.code === 'Tab') { e.preventDefault(); this.step(e.shiftKey ? -1 : 1); }
      else if (e.code === 'BracketRight' || e.code === 'BracketLeft') this.step(e.code === 'BracketRight' ? 1 : -1);
    });
  }

  get isOpen(): boolean { return !this.root.hidden; }
  private tabs(): TabId[] {
    if (!this.host.inRun()) return ['kodex', 'opt'];
    return ['inv', ...(this.host.mapSvg() !== null ? ['karte' as const] : []), 'segen', 'kodex', 'opt'];
  }
  /** Opens on a tab; a second call with the open tab closes (keys I, M toggle). */
  toggle(tab: TabId): void { if (this.isOpen && this.tab === tab) this.close(); else this.open(tab); }
  open(tab: TabId = this.tab): void {
    const tabs = this.tabs();
    if (!tabs.includes(tab)) tab = tabs[0]!;
    const was = this.isOpen;
    if (!was) this.previousFocus = document.activeElement as HTMLElement;
    this.root.hidden = false;
    this.select(tab);
    if (!was) this.host.onToggle(true);
  }
  close(): void {
    if (!this.isOpen) return;
    this.inventory.show(false);
    this.root.hidden = true;
    this.previousFocus?.focus?.();
    this.host.onToggle(false);
  }
  private step(d: number): void { const t = this.tabs(), i = t.indexOf(this.tab); this.select(t[(i + d + t.length) % t.length]!); }
  select(tab: TabId): void {
    this.tab = tab;
    for (const [id, el] of Object.entries(this.bodies) as Array<[TabId, HTMLElement]>) if (id !== 'inv') el.hidden = id !== tab;
    this.tabsEl.innerHTML = this.tabs().map(t => `<button type="button" class="menu-tabb${t === tab ? ' on' : ''}" data-t="${t}" aria-pressed="${t === tab}">${TAB_NAME[t]}</button>`).join('');
    this.renderHead();
    this.inventory.show(tab === 'inv');
    this.renderTab();
    if (tab !== 'inv') (this.bodies[tab].querySelector<HTMLElement>('button:not(:disabled),input,summary') ?? this.tabsEl.querySelector<HTMLElement>('.on'))?.focus();
  }
  renderHead(): void {
    const s = this.host.sim(), hid = s.content.hidden;
    this.resEl.innerHTML = this.host.inRun()
      ? `<span>Schrott <b>${s.inventory.scrap}</b></span><span>Item Level <b>${avgIl(s.equipment)}</b></span><span>${esc(this.host.where())}</span>${hid.length ? `<span>Versteckte Segen ${hid.filter(h => h.got).length}/${hid.length}</span>` : ''}`
      : '';
  }
  private renderTab(): void {
    const s = this.host.sim(), el = this.bodies[this.tab];
    if (this.tab === 'segen') el.innerHTML = this.segen(s);
    if (this.tab === 'kodex') el.innerHTML = kodexHtml(s);
    if (this.tab === 'karte') el.innerHTML = `<div class="mapw"><div class="map-svg">${this.host.mapSvg() ?? ''}</div><div class="leg"><div><i style="background:#fff"></i>Du</div><div><i style="background:#f0b27a"></i>Wahrzeichen</div><div><i style="background:#f2d14b"></i>Späti</div><div><i style="background:#7dd3ff"></i>Litfaßsäule</div><div><i style="background:#c23a2e"></i>Gegner</div><div><i style="background:#43d1cf"></i>Start</div>${s.content.hidden.length ? `<p class="inv-hint">Versteckte Segen ${s.content.hidden.filter(h => h.got).length} von ${s.content.hidden.length}</p>` : ''}</div></div>`;
  }
  /** 2D segenTab: icon grid of this run's blessings, tap shows the details. */
  private segen(s: Sim): string {
    const held = (Object.entries(s.statContext.perks) as Array<[PerkId, number]>).filter(([k, n]) => n > 0 && PERKS.some(p => p.id === k)).map(([k]) => k);
    if (!held.length) return '<p class="inv-hint">Noch keine Segen. Nach jedem Kampf wählst du einen.</p>';
    if (!this.segenSel || !held.includes(this.segenSel)) this.segenSel = held[0]!;
    const q = s.abilities.quality, dots = (l: number, m: number): string => `<span class="sgd">${Array.from({ length: m }, (_, i) => `<i class="${i < l ? 'f' : ''}"></i>`).join('')}</span>`;
    const P = PERKS.find(p => p.id === this.segenSel)!, l = s.statContext.perks[P.id] ?? 0, qq = (q[P.id] ?? 0) as 0 | 1 | 2 | 3;
    const m = P.description.match(/^([+-])(\d+)(%?)/), tot = (n: number): string => m ? P.description.replace(m[0], `${m[1]}${n * Number(m[2])}${m[3]}`) : '';
    const fams = (p: typeof P): string => (p.duo ?? p.families ?? []).map(f => `<i class="sgfam" style="background:${FAMILIES[f].color}" title="${FAMILIES[f].name}"></i>`).join('');
    const grid = held.map(k => { const p = PERKS.find(x => x.id === k)!; return `<button type="button" class="sgb${k === this.segenSel ? ' sel' : ''}" data-sg="${k}" aria-label="${esc(p.name)}, Stufe ${s.statContext.perks[k]}">${perkIcon(k, (q[k] ?? 0) as 0 | 1 | 2 | 3)}<span class="sgf">${fams(p)}</span><span class="sgn">${esc(p.name)}</span>${dots(s.statContext.perks[k] ?? 0, p.max)}</button>`; }).join('');
    const extra = P.id === 'second' ? `<p class="${s.abilities.secondUsed ? 'inv-hint' : 'positive'}">${s.abilities.secondUsed ? 'In diesem Lauf verbraucht' : 'Bereit'}</p>` : '';
    return `<div class="segen"><div class="sgrid">${grid}</div><article class="inv-card sgdet" style="--rarity:${QUALITY[qq][0]}"><div class="inv-card-head">${perkIcon(P.id, qq)}<div><h3>${esc(P.name)}</h3><p class="sub">Stufe ${l} von ${P.max} · ${QUALITY[qq][1]}</p></div></div><p>${P.max > 1 ? 'Je Stufe: ' : ''}${esc(P.description)}</p>${P.max > 1 && m ? `<p>Jetzt: <b>${tot(l)}</b></p><p class="inv-hint">${l < P.max ? `Nächste Stufe: ${tot(l + 1)}` : 'Maximale Stufe'}</p>` : ''}${extra}</article></div>`;
  }
  /** Pad: LB/RB tabs, B closes, A presses, D-pad and stick move to the nearest button in that direction. */
  pollPad(now: number): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(p => p?.connected);
    if (!pad) { this.padDown = []; return; }
    const down = pad.buttons.map(b => b.pressed), prev = this.padDown, edge = (i: number): boolean => !!down[i] && !prev[i];
    this.padDown = down;
    if (!this.isOpen) return;
    if (edge(1)) { this.close(); return; }
    if (edge(4) || edge(5)) { this.step(edge(5) ? 1 : -1); return; }
    if (edge(0)) { const a = document.activeElement as HTMLElement | null; if (a && this.root.contains(a)) a.click(); else this.focusFirst(); return; }
    if (now < this.padNext) return;
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const dx = down[14] || ax < -.5 ? -1 : down[15] || ax > .5 ? 1 : 0, dy = down[12] || ay < -.5 ? -1 : down[13] || ay > .5 ? 1 : 0;
    if (!dx && !dy) return;
    this.padNext = now + 170;
    this.move(dx, dy);
  }
  private focusFirst(): void { (this.root.querySelector<HTMLElement>('.menu-tab:not([hidden]) button:not(:disabled)') ?? this.tabsEl.querySelector<HTMLElement>('button'))?.focus(); }
  /** Spatial focus move: nearest visible control in the direction, rows and columns alike. */
  move(dx: number, dy: number): void {
    const cur = document.activeElement as HTMLElement | null;
    const all = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled),input,summary')].filter(b => b.offsetParent !== null && !b.closest('[hidden]'));
    if (!cur || !this.root.contains(cur)) { this.focusFirst(); return; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best: HTMLElement | null = null, bestS = Infinity;
    for (const b of all) {
      if (b === cur) continue;
      const q = b.getBoundingClientRect(), bx = q.left + q.width / 2, by = q.top + q.height / 2, vx = bx - cx, vy = by - cy;
      const along = vx * dx + vy * dy;
      if (along <= 2) continue;
      const across = Math.abs(dx ? vy : vx);
      const score = along + across * 2.5;
      if (score < bestS) { bestS = score; best = b; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
}

/** 2D Kodex tab: entries fill on the first kill or find (`sim.inventory.kodex`). */
export function kodexHtml(s: Sim): string {
  const k = s.inventory.kodex ?? { kills: {}, found: {} };
  const row = (known: boolean, name: string, text: string, side = '', icon = ''): string => `<div class="kx${known ? '' : ' off'}">${icon}<div><b>${known ? esc(name) : '???'}</b><small>${known ? text : 'Noch nicht begegnet'}</small></div>${known && side ? `<span>${side}</span>` : ''}</div>`;
  const weak = (kind: EnemyKind): string => { const r = ENEMIES[kind].res; if (r === 'none') return ''; const t = ENEMY_RESISTANCES[r]; return (Object.keys(t) as Array<keyof typeof t>).filter(e => (t[e] ?? 1) > 1.2).map(e => `<span style="color:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span>`).join(' '); };
  const enemies = NORMAL.map(e => row(!!k.kills[e], ENEMIES[e].name, ENEMY_TEXT[e] ?? '', weak(e))).join('');
  const bosses = BOSSES.map(e => row(!!k.kills[e], ENEMIES[e].name, `${ENEMY_TEXT[e] ?? ''} Besiegt: ${k.kills[e] ?? 0}`, weak(e))).join('');
  const surv = SURVIVORS.filter(v => s.statContext.survivors[v.id]).length;
  const survivors = SURVIVORS.map(v => `<div class="kx${s.statContext.survivors[v.id] ? '' : ' off'}"><div><b style="${s.statContext.survivors[v.id] ? `color:${v.color}` : ''}">${s.statContext.survivors[v.id] ? esc(v.name) : '???'}</b><small>${esc(v.description)}</small></div><span>${s.statContext.survivors[v.id] ? 'Gerettet' : 'Vermisst'}</span></div>`).join('');
  const legs = Object.keys(LEGENDARY_POWERS) as LegendaryId[], nLeg = legs.filter(b => k.found[b]).length;
  const legRows = legs.map(b => { const f = !!k.found[b], slot: SlotId = 'w'; return `<div class="kx${f ? '' : ' off'}"><span class="kico" style="--rarity:${RARITIES[3].color}">${f ? itemIcon({ base: b, slot }) : ''}</span><div><b style="${f ? `color:${RARITIES[3].color}` : ''}">${f ? esc(BASE_NAME[b] ?? b) : '???'}</b><small>${f ? esc(LEGENDARY_POWERS[b].description) : 'Noch nicht gefunden'}</small></div></div>`; }).join('');
  const sets = (Object.keys(SETS) as SetId[]).map(id => { const S = SETS[id], ps = Object.entries(S.pieces) as Array<[SlotId, { base: string }]>, n = ps.filter(([, p]) => k.found[p.base]).length; return `<div class="kx"><span class="kset">${ps.map(([slot, p]) => `<span class="kico${k.found[p.base] ? '' : ' off'}" style="--rarity:${SET_COLOR}">${itemIcon({ base: p.base, slot })}</span>`).join('')}</span><div><b style="color:${SET_COLOR}">${S.name} · ${n}/${ps.length} gefunden</b><small>(2) ${S.bonusDescriptions[2]} · (3) ${S.bonusDescriptions[3]} · (5) ${S.bonusDescriptions[5]}</small></div></div>`; }).join('');
  const elites = ELITE_MODS.map(m => row(!!k.kills[`e:${m}`], ELITES[m].name, ELITES[m].hint)).join('');
  return `<h3>Gegner</h3><div class="cols2">${enemies}</div><h3>Endgegner</h3><div class="cols2">${bosses}</div><h3>Elite-Gegner</h3><div class="cols2">${elites}</div><h3>Bewohner ${surv} von ${SURVIVORS.length}</h3><div class="cols2">${survivors}</div><h3>Legendäre Funde ${nLeg} von ${legs.length}</h3><div class="cols2">${legRows}</div><h3>Sets</h3><div class="cols2">${sets}</div>`;
}
