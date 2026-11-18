// U1/U2/U3: one pause menu with tabs, as in 2D (`js/panels.js` renderInv): Inventar, Karte, Segen,
// Kodex as text tabs with line icons. The Kodex tab is the 2D Kodex card list (playtest 2026-11-17). Header shows Schrott, Item Level, district and fight, found
// hidden blessings, the cog for the options screen and × to close.
import { ELITES, ELITE_MODS, ENEMIES, type EliteMod, type EnemyKind } from '../data/enemies';
import { BASES } from '../data/item-names';
import { ELEMENTS, ENEMY_RESISTANCES, LEGENDARY_POWERS, RARITIES, SETS, SET_COLOR, type LegendaryId, type SetId, type SlotId } from '../data/items';
import { STATIONS } from '../data/camp';
import { FAMILIES, PERKS, SURVIVORS, type PerkId, type SurvivorId } from '../data/progression';
import { avgIl } from '../sim/items';
import type { Sim } from '../sim/types';
import { perkIcon } from './abilities';
import { esc, itemIcon, InventoryUi, artUrl } from './inventory';
import { moveFocus } from './focus';
import { uiIcon } from './ui-icons';

export type TabId = 'inv' | 'karte' | 'segen' | 'kodex';
const TAB_NAME: Record<TabId, string> = { inv: 'Inventar', karte: 'Karte', segen: 'Segen', kodex: 'Kodex' };
const TAB_ICON: Record<TabId, Parameters<typeof uiIcon>[0]> = { inv: 'bag', karte: 'map', segen: 'segen', kodex: 'kodex' };
const COG = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.3.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>';
const QUALITY = [['#e8ddd0', 'Gewöhnlich'], ['#7d9bff', 'Selten'], ['#f2d14b', 'Episch'], ['#b48cff', 'Umbau']] as const;

/** 2D KODEX lines, matched to the 3D roster (short German, one line each). */
const ENEMY_TEXT: Partial<Record<EnemyKind, string>> = {
  walker: 'Langsam und zahlreich. Fürchtet Feuer.', runner: 'Schnell und schwach. Kommt in Gruppen.',
  brute: 'Markiert einen Kreis und schlägt zu. Raus aus dem Kreis.', spitter: 'Hält Abstand und spuckt. Immun gegen Säure.',
  raptor: 'Zeigt eine Linie, dann springt er. Seitlich ausweichen.', crow: 'Kreist und stößt herab. Fliegt über alles.',
  feldwebel: 'Stürmt los und ruft Männer.', waechter: 'Feuert Salven und Ringe. Nah ran.',
  rex: 'Biss, Ansturm, Brüllringe, Schwanz.', schaffner: 'Rast über die Gleise wie ein Zug, pfeift Fahrgäste herbei.', hauptmann: 'Der Hauptmann von Köpenick. Schlägt, schießt, ruft.',
  rat: 'Ratten kommen im Rudel, schnell und schwach.',
  grenzer: 'Schießt vom Turm, Feuerstoß und Salve. Ruft „Alarm!“.', brandmeister: 'Wirft Molotows, Feuerring. Nah: Flammenstoß.',
  rattenmutter: 'Ruft Ratten, zieht eine Säurespur.', spreehexe: 'Säurepfützen und die Spreewelle. Durchrollen.',
  // M12c Mitte.
  kabel: 'Verkabelt und flink, springt dich an. Brennt gut, Strom perlt ab.', bass: 'Wummert Basswellen und treibt andere an. Durch die Welle rollen.',
  drone: 'Kreist und stößt herab. Strom holt sie runter.',
  tuersteher: 'Hält die Tür am Tor. Wer gepackt wird, rollt sich frei.', wachdrohne: 'Sucht dich mit dem Licht. Raus aus dem Kegel, schlag zu, wenn sie landet.',
  dirigent: 'Gibt den Takt vor. Die Boxen folgen ihm.', bassprediger: 'Predigt mit Strom und Bass. Nach dem Stoß ist er offen.',
};
const NORMAL: EnemyKind[] = ['walker', 'runner', 'brute', 'spitter', 'raptor', 'crow', 'rat', 'kabel', 'bass', 'drone'];
const BOSSES: EnemyKind[] = ['feldwebel', 'waechter', 'rex', 'hauptmann', 'schaffner', 'grenzer', 'brandmeister', 'rattenmutter', 'spreehexe', 'tuersteher', 'wachdrohne', 'dirigent', 'bassprediger'];
const BASE_NAME: Record<string, string> = Object.fromEntries(Object.entries(BASES).map(([n, b]) => [b, n]));

export interface MenuHost {
  sim(): Sim;
  /** A run is on (play phase): game tabs. Off: only Kodex. */
  inRun(): boolean;
  /** District and fight line for the header. */
  where(): string;
  /** Map SVG with the hero, or null without an expedition map. */
  mapSvg(): string | null;
  onToggle(open: boolean): void;
  /** Cog: the options screen (U3, over the menu). */
  options(): void;
  /** The options screen is open over the menu: it has the pad and the keys. */
  blocked(): boolean;
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

  constructor(private readonly host: MenuHost, readonly inventory: InventoryUi) {
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
    x.type = 'button'; x.className = 'tr-x'; x.id = 'menu-close'; x.setAttribute('aria-label', 'Weiter'); x.textContent = '×';
    x.addEventListener('click', () => this.close());
    const cog = document.createElement('button');
    cog.type = 'button'; cog.className = 'btn sm cog'; cog.id = 'menu-opt'; cog.setAttribute('aria-label', 'Optionen'); cog.innerHTML = COG;
    cog.addEventListener('click', () => this.host.options());
    const side = document.createElement('div');
    side.className = 'menu-side';
    side.append(this.resEl, cog);
    head.append(this.tabsEl, side);
    this.root.append(x);
    const body = document.createElement('div');
    body.className = 'menu-body';
    const mk = (id: TabId, el: HTMLElement = document.createElement('div')): HTMLElement => { el.dataset.tab = id; el.classList.add('menu-tab'); el.hidden = true; body.append(el); return el; };
    this.bodies = { inv: mk('inv', inventory.root), karte: mk('karte'), segen: mk('segen'), kodex: mk('kodex') };
    panel.append(head, body);
    this.root.append(panel);
    document.body.append(this.root);
    this.tabsEl.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-t]'); if (b) this.select(b.dataset.t as TabId); });
    this.bodies.segen.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-sg]'); if (b) { this.segenSel = b.dataset.sg as PerkId; this.renderTab(); this.bodies.segen.querySelector<HTMLElement>(`[data-sg="${b.dataset.sg}"]`)?.focus(); } });
    // A tap beside the panel closes the menu (as the old map overlay did).
    this.root.addEventListener('click', e => { if (e.target === this.root) this.close(); });
    this.root.addEventListener('keydown', e => {
      // Tab moves focus and wraps inside the menu; [ ] switch tabs; arrow keys move like the pad.
      if (e.code === 'Tab') {
        const all = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled),input,summary')].filter(b => b.offsetParent !== null);
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); all.at(-1)?.focus(); } else if (!e.shiftKey && i === all.length - 1) { e.preventDefault(); all[0]?.focus(); }
      }
      else if (e.code === 'BracketRight' || e.code === 'BracketLeft') this.step(e.code === 'BracketRight' ? 1 : -1);
      else if (e.code.startsWith('Arrow') && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        this.move(e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0, e.code === 'ArrowUp' ? -1 : e.code === 'ArrowDown' ? 1 : 0);
      }
    });
  }

  get isOpen(): boolean { return !this.root.hidden; }
  private tabs(): TabId[] {
    if (!this.host.inRun()) return ['kodex'];
    return ['inv', ...(this.host.mapSvg() !== null ? ['karte' as const] : []), 'segen', 'kodex'];
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
    this.tabsEl.innerHTML = this.tabs().map(t => `<button type="button" class="menu-tabb${t === tab ? ' on' : ''}" data-t="${t}" aria-pressed="${t === tab}">${uiIcon(TAB_ICON[t], 17)}<span>${TAB_NAME[t]}</span></button>`).join('');
    this.renderHead();
    this.inventory.show(tab === 'inv');
    this.renderTab();
    if (tab !== 'inv') (this.bodies[tab].querySelector<HTMLElement>('button:not(:disabled),input,summary') ?? this.tabsEl.querySelector<HTMLElement>('.on'))?.focus();
  }
  renderHead(): void {
    const s = this.host.sim(), hid = s.content.hidden;
    this.resEl.innerHTML = this.host.inRun()
      ? `<span><img class="mico" src="${artUrl('R05')}" alt="" width="24" height="24">Schrott <b>${s.inventory.scrap}</b></span><span>Item Level <b>${avgIl(s.equipment)}</b></span><span>${esc(this.host.where())}</span>${hid.length ? `<span>Versteckte Segen ${hid.filter(h => h.got).length}/${hid.length}</span>` : ''}`
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
    if (!this.isOpen || this.host.blocked()) return;
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
  /** The options screen closed over the menu: its last press is not new here. */
  resetPad(): void { this.padDown = Array.from({ length: 20 }, () => true); }
  private focusFirst(): void { (this.root.querySelector<HTMLElement>('.menu-tab:not([hidden]) button:not(:disabled)') ?? this.tabsEl.querySelector<HTMLElement>('button'))?.focus(); }
  /** Spatial focus move: nearest visible control in the direction, rows and columns alike. */
  move(dx: number, dy: number): void {
    // The Kodex has no controls (2D: a list to read): up and down scroll it.
    if (this.tab === 'kodex' && dy && !dx) { const b = this.bodies.kodex; b.scrollBy({ top: dy * b.clientHeight * .6, behavior: 'smooth' }); return; }
    moveFocus(this.root, dx, dy, () => this.focusFirst());
  }
}

/** Kodex busts in `assets/portraits/`, including portraits imported from 2D (`js/items.js` PORTI). */
const portraits = import.meta.glob('../../assets/portraits/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const portraitUrl = (id: string): string => portraits[`../../assets/portraits/${id}.webp`] ?? '';
const ENEMY_PORTRAIT: Partial<Record<EnemyKind, string>> = { walker: 'E01', runner: 'E09', brute: 'E02', spitter: 'E03', raptor: 'E11', crow: 'E05', rat: 'E04', feldwebel: 'X04', schaffner: 'X05', waechter: 'X03', rex: 'E12', hauptmann: 'X01', brandmeister: 'X10', rattenmutter: 'X06', kabel: 'E13', bass: 'E14', bassprediger: 'X09' };
const ELITE_PORTRAIT: Record<EliteMod, string> = { flink: 'L01', brennend: 'L02', spaltend: 'L03', gepanzert: 'L04' };
const SURVIVOR_PORTRAIT: Record<SurvivorId, string> = { doktor: 'S01', schmied: 'S02', kurier: 'S03', koechin: 'S04', spaeher: 'S05', mechaniker: 'S06' };
/** Code-painted fallbacks for bosses when portrait files are missing. */
const BOSS_GLYPH: Partial<Record<EnemyKind, string>> = {
  feldwebel: '<path d="M5 8l7-4 7 4M5 13l7-4 7 4M5 18l7-4 7 4"/>',
  schaffner: '<path d="M3 16h18M5 16c0-5 3-8 7-8s7 3 7 8M9 12h6M12 8V6"/><circle cx="12" cy="19" r="1.5"/>',
  // Watchtower; the 2D Spreehexe bust (river hag) does not match the 3D punk look, so a crest and a wave.
  grenzer: '<path d="M8 21l2-12h4l2 12M7 9h10l-1-4H8zM12 5V3M10 14h4"/>',
  spreehexe: '<path d="M8 11l1-7 1.5 5 1.5-6 1.5 6 1.5-5 1 7M7 12h10M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  // M12c until Codex busts: a door with a rope (Türsteher), a drone with its light cone, a baton over a stave; small drones too.
  tuersteher: '<path d="M7 21V4h10v17M10 12h1M3 14c2 2 4 2 6 0M15 14c2 2 4 2 6 0"/>',
  wachdrohne: '<path d="M4 7h4M16 7h4M6 7v2M18 7v2M8 9h8v3H8zM12 12l-5 8M12 12l5 8M7 20h10"/>',
  dirigent: '<path d="M3 9h18M3 13h18M3 17h18M6 20L18 4"/><circle cx="18" cy="4" r="1"/>',
  drone: '<path d="M4 8h5M15 8h5M6.5 8v3M17.5 8v3M8 11h8v3H8zM12 14v2"/>',
};
/** 2D `kImg`: portrait, greyed (`dim`) or a black silhouette with "?" (`sil`). */
const kimg = (inner: string, state: 'on' | 'dim' | 'sil', ring = '', cls = ''): string => state === 'sil'
  ? `<span class="kimg ksil${cls}">${inner}<b>?</b></span>`
  : `<span class="kimg${cls}${state === 'dim' ? ' kdim' : ''}"${ring ? ` style="--ring:${ring}"` : ''}>${inner}</span>`;
const kport = (id: string): string => `<img src="${portraitUrl(id)}" alt="" draggable="false">`;
const enemyArt = (kind: EnemyKind): string => {
  const id = ENEMY_PORTRAIT[kind];
  return id && portraitUrl(id) ? kport(id) : `<svg class="kgly" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BOSS_GLYPH[kind] ?? ''}</svg>`;
};
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** 2D Kodex tab (`js/panels.js` invTab 'kodex'): sections Gegner, Endgegner, Bewohner, Legendäre Funde,
 * Sets, Elite-Gegner; each entry a card with a 64 px portrait or icon. Entries fill on the first kill or
 * find (`sim.inventory.kodex`). */
export function kodexHtml(s: Sim): string {
  const k = s.inventory.kodex ?? { kills: {}, found: {} };
  const card = (img: string, name: string, nameColor: string, text: string, side = ''): string => `<div class="kx">${img}<div><div class="un"${nameColor ? ` style="color:${nameColor}"` : ''}>${name}</div><div class="ud">${text}</div></div>${side ? `<span class="ud">${side}</span>` : ''}</div>`;
  const weak = (kind: EnemyKind): string => { const r = ENEMIES[kind].res; if (r === 'none') return ''; const t = ENEMY_RESISTANCES[r]; return (Object.keys(t) as Array<keyof typeof t>).filter(e => (t[e] ?? 1) > 1.2).map(e => `<span style="color:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span>`).join(' '); };
  const DIM = 'var(--dim)', unk = '???';
  const enemies = NORMAL.map(e => { const o = !!k.kills[e]; return card(kimg(enemyArt(e), o ? 'on' : 'sil'), o ? esc(ENEMIES[e].name) : unk, o ? '' : DIM, o ? esc(ENEMY_TEXT[e] ?? '') : 'Noch nicht begegnet', o ? weak(e) : ''); }).join('');
  const bosses = BOSSES.map(e => { const o = !!k.kills[e]; return card(kimg(enemyArt(e), o ? 'on' : 'sil'), o ? esc(ENEMIES[e].name) : unk, o ? 'var(--ember)' : DIM, o ? `${esc(ENEMY_TEXT[e] ?? '')} Besiegt: ${k.kills[e]}` : 'Noch nicht besiegt', o ? weak(e) : ''); }).join('');
  const has = (id: SurvivorId): boolean => !!s.statContext.survivors[id];
  const survivors = SURVIVORS.map(v => card(kimg(kport(SURVIVOR_PORTRAIT[v.id]), has(v.id) ? 'on' : 'dim'), has(v.id) ? esc(v.name) : unk, has(v.id) ? 'var(--good)' : DIM, esc(v.description), has(v.id) ? `<span class="ok">${esc(STATIONS.find(st => st.npc === v.id)?.name ?? 'Im Lager')}</span>` : 'Vermisst')).join('');
  const legs = Object.keys(LEGENDARY_POWERS) as LegendaryId[], nLeg = legs.filter(b => k.found[b]).length;
  const legRows = legs.map(b => { const f = !!k.found[b]; return card(kimg(itemIcon({ base: b, slot: 'w' }), f ? 'on' : 'dim', '', ' kitem'), f ? esc(BASE_NAME[b] ?? b) : unk, f ? RARITIES[3].color : DIM, f ? esc(LEGENDARY_POWERS[b].description) : 'Noch nicht gefunden'); }).join('');
  const sets = (Object.keys(SETS) as SetId[]).map(id => { const S = SETS[id], ps = Object.entries(S.pieces) as Array<[SlotId, { base: string }]>, n = ps.filter(([, p]) => k.found[p.base]).length; return card(`<span class="kset">${ps.map(([slot, p]) => kimg(itemIcon({ base: p.base, slot }), k.found[p.base] ? 'on' : 'dim', '', ' kitem')).join('')}</span>`, `${esc(S.name)} · ${n}/${ps.length} gefunden`, SET_COLOR, `(2) ${esc(S.bonusDescriptions[2])} · (3) ${esc(S.bonusDescriptions[3])} · (5) ${esc(S.bonusDescriptions[5])}`); }).join('');
  const elites = ELITE_MODS.map(m => { const o = !!k.kills[`e:${m}`], c = hex(ELITES[m].color); return card(kimg(kport(ELITE_PORTRAIT[m]), o ? 'on' : 'sil', o ? c : ''), o ? esc(ELITES[m].name) : unk, o ? c : DIM, o ? esc(ELITES[m].hint) : 'Noch nicht begegnet'); }).join('');
  const surv = SURVIVORS.filter(v => has(v.id)).length;
  return `<div class="kodex"><div class="lbl">Gegner</div><div class="cols2">${enemies}</div><div class="lbl">Endgegner</div><div class="cols2">${bosses}</div><div class="lbl">Bewohner ${surv} von ${SURVIVORS.length}</div><p class="hint">Befreie Gefangene auf Expeditionen. Sie ziehen ins Lager, helfen dauerhaft und ermöglichen Stufe 2 ihrer Station.</p><div class="cols2">${survivors}</div><div class="lbl">Legendäre Funde ${nLeg} von ${legs.length}</div><div class="cols2">${legRows}</div><div class="lbl">Sets</div><div class="cols2">${sets}</div><div class="lbl">Elite-Gegner</div><div class="cols2">${elites}</div></div>`;
}
