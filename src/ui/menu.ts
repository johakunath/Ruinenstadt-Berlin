// U1/U2/U3: one pause menu with tabs, as in 2D (`js/panels.js` renderInv): Inventar, Karte, Segen,
// Kodex as text tabs with line icons. The Kodex tab is the 2D Kodex card list (playtest 2026-11-17). Header shows Schrott, Item Level, district and fight, found
// hidden blessings, the cog for the options screen and × to close.
import { ELITES, ELITE_MODS, ENEMIES, ENEMY_CLASS_NAME, type EliteMod, type EnemyKind } from '../data/enemies';
import { BASES } from '../data/item-names';
import { ELEMENTS, ENEMY_RESISTANCES, LEGENDARY_POWERS, RARITIES, SETS, SET_COLOR, type LegendaryId, type SetId, type SlotId } from '../data/items';
import { STATIONS } from '../data/camp';
import { FUNDE, FUNDE_TEILE, fundId } from '../data/funde';
import { FAMILIES, PERKS, SURVIVORS, type PerkId, type SurvivorId } from '../data/progression';
import { avgIl } from '../sim/items';
import type { Sim } from '../sim/types';
import { perkIcon } from './abilities';
import { esc, itemIcon, InventoryUi, resIcon } from './inventory';
import { moveFocus } from './focus';
import { KEEPER_PORTRAIT, portraitUrl } from './portraits';
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
  // M15 Alexanderplatz (task step 6).
  uhrwerk: 'Zifferblatt vorn. Von hinten treffen, Strom bringt das Werk aus dem Takt.',
  wurzler: 'Wurzeln halten fest. In Bewegung bleiben.',
  kernspeier: 'Spuckt Kerne im Fächer. Ran, solange er pflanzt.',
  // WP5 (2D tips).
  zuender: 'Explodiert. Abstand halten oder aus der Ferne treffen.',
  schild: 'Blockt von vorn. Umgehen oder mit dem Hammer betäuben.',
  heuler: 'Treibt die anderen an. Zuerst ausschalten.',
  wurzelmutter: 'Wuchs aus dem Glashaus des Palasts.', uhrwerkgross: 'Nach dem Ansturm läuft er ab.',
  volkskoloss: 'Ein Stück Platte auf Uhrwerkbeinen.', weltzeituhr: 'Sie stand still. Bis du kamst.',
  // M16 Charlottenburg (spec m12d).
  scherbe: 'Dreht sich durch dich hindurch. Zerspringt und trifft alle ringsum.',
  loge: 'Vorn aus Glas, schlägt langsam und hart. Ausweichen, dann zuschlagen.',
  souffleur: 'Flüstert den anderen ihr Stichwort zu. Zuerst erledigen.',
  conferencier: 'Sagt die Nummern an. Raus aus dem Spotlicht.',
  ringvater: 'Lässt sich schützen. Erst die Leibwache.',
  spiegelpaar: 'Nur eine ist echt: die mit der roten Schärpe.',
  diva: 'Fächer, Prismen, drei Vorhänge. Nach dem Strahl ist sie offen.',
};
const NORMAL: EnemyKind[] = ['walker', 'runner', 'brute', 'spitter', 'raptor', 'crow', 'rat', 'uhrwerk', 'wurzler', 'kernspeier', 'kabel', 'bass', 'drone', 'zuender', 'schild', 'heuler', 'scherbe', 'loge', 'souffleur'];
const BOSSES: EnemyKind[] = ['feldwebel', 'waechter', 'rex', 'hauptmann', 'schaffner', 'grenzer', 'brandmeister', 'rattenmutter', 'spreehexe', 'wurzelmutter', 'uhrwerkgross', 'volkskoloss', 'weltzeituhr', 'tuersteher', 'wachdrohne', 'dirigent', 'bassprediger', 'conferencier', 'ringvater', 'spiegelpaar', 'diva'];
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
      ? `<span>${resIcon('scrap')}Schrott <b>${s.inventory.scrap}</b> <small>fürs Lager</small></span><span>Item Level <b>${avgIl(s.equipment)}</b></span><span>${esc(this.host.where())}</span>${hid.length ? `<span>Versteckte Segen ${hid.filter(h => h.got).length}/${hid.length}</span>` : ''}`
      : '';
  }
  private renderTab(): void {
    const s = this.host.sim(), el = this.bodies[this.tab];
    if (this.tab === 'segen') el.innerHTML = this.segen(s);
    if (this.tab === 'kodex') el.innerHTML = kodexHtml(s);
    const svg = this.host.mapSvg() ?? '';
    // The camp map has its own legend (stations, rings, the train).
    if (this.tab === 'karte' && svg.includes('Zug · Abfahrt')) el.innerHTML = `<div class="mapw"><div class="map-svg">${svg}</div><div class="leg"><div><i style="background:#fff"></i>Du</div><div><i style="background:#8c6a50"></i>Station</div><div><i style="background:#f2d14b"></i>Hier sprechen</div><div><i style="background:#c8a24a"></i>Zug</div></div></div>`;
    else if (this.tab === 'karte') el.innerHTML = `<div class="mapw"><div class="map-svg">${svg}</div><div class="leg"><div><i style="background:#fff"></i>Du</div><div><i style="background:#f0b27a"></i>Wahrzeichen</div><div><i style="background:#f2d14b"></i>Späti</div><div><i style="background:#7dd3ff"></i>Litfaßsäule</div><div><i style="background:#c23a2e"></i>Gegner</div><div><i style="background:#43d1cf"></i>Start</div>${s.content.hidden.length ? `<p class="inv-hint">Versteckte Segen ${s.content.hidden.filter(h => h.got).length} von ${s.content.hidden.length}</p>` : ''}</div></div>`;
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
const ENEMY_PORTRAIT: Record<EnemyKind, string> = {
  walker: 'E01', runner: 'E09', brute: 'E02', spitter: 'E03', raptor: 'E11', crow: 'E05', rat: 'E04',
  kabel: 'E13', schild: 'E06', zuender: 'E07', heuler: 'E08', bass: 'E14', drone: 'E15', uhrwerk: 'E16', wurzler: 'E17', kernspeier: 'E18',
  feldwebel: 'X04', waechter: 'X03', rex: 'E12', hauptmann: 'X01', schaffner: 'X05',
  grenzer: 'X11', brandmeister: 'X10', rattenmutter: 'X06', spreehexe: 'X12',
  wurzelmutter: 'X13', uhrwerkgross: 'X14', volkskoloss: 'X15', weltzeituhr: 'X16',
  tuersteher: 'X17', wachdrohne: 'X18', dirigent: 'X19', bassprediger: 'X09',
  // M16: no busts yet (Codex art); the ids are reserved, the glyphs below show meanwhile.
  scherbe: 'E19', loge: 'E20', souffleur: 'E21', spiegelbild: 'X22',
  conferencier: 'X20', ringvater: 'X21', spiegelpaar: 'X22', diva: 'X23',
};
const ELITE_PORTRAIT: Record<EliteMod, string> = { flink: 'L01', brennend: 'L02', spaltend: 'L03', gepanzert: 'L04' };
/** Line-art fallbacks when portrait files are missing. */
const BOSS_GLYPH: Partial<Record<EnemyKind, string>> = {
  feldwebel: '<path d="M5 8l7-4 7 4M5 13l7-4 7 4M5 18l7-4 7 4"/>',
  schaffner: '<path d="M3 16h18M5 16c0-5 3-8 7-8s7 3 7 8M9 12h6M12 8V6"/><circle cx="12" cy="19" r="1.5"/>',
  grenzer: '<path d="M8 21l2-12h4l2 12M7 9h10l-1-4H8zM12 5V3M10 14h4"/>',
  spreehexe: '<path d="M8 11l1-7 1.5 5 1.5-6 1.5 6 1.5-5 1 7M7 12h10M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  tuersteher: '<path d="M7 21V4h10v17M10 12h1M3 14c2 2 4 2 6 0M15 14c2 2 4 2 6 0"/>',
  wachdrohne: '<path d="M4 7h4M16 7h4M6 7v2M18 7v2M8 9h8v3H8zM12 12l-5 8M12 12l5 8M7 20h10"/>',
  dirigent: '<path d="M3 9h18M3 13h18M3 17h18M6 20L18 4"/><circle cx="18" cy="4" r="1"/>',
  drone: '<path d="M4 8h5M15 8h5M6.5 8v3M17.5 8v3M8 11h8v3H8zM12 14v2"/>',
  uhrwerk: '<circle cx="12" cy="11" r="6"/><path d="M12 11V7.5M12 11l2.5 1.5M9 17l-2 4M15 17l2 4"/>',
  wurzler: '<circle cx="12" cy="6" r="2.5"/><path d="M12 8.5v6M12 14.5l-4 6M12 14.5l4 6M12 14.5l-1 6M12 14.5l1.5 6M8 11c-2 0-3 2-4 1M16 11c2 0 3 2 4 1"/>',
  kernspeier: '<circle cx="12" cy="7" r="3"/><path d="M12 10v4M8 14h8l-1 7H9zM17 5l4-2M17 7h4M17 9l4 2"/>',
  wurzelmutter: '<circle cx="12" cy="8" r="3"/><path d="M7 4l1.5 2M17 4l-1.5 2M12 2v2.5M12 11v4M12 15l-6 6M12 15l6 6M12 15v6M6 12c-2 0-3 2-4 1M18 12c2 0 3 2 4 1"/>',
  uhrwerkgross: '<circle cx="11" cy="11" r="7"/><path d="M11 11V6.5M11 11l3 2M19 9h3M20.5 7.5v3M7 18l-2 3M15 18l2 3"/>',
  volkskoloss: '<rect x="6" y="3" width="12" height="12"/><path d="M9 6h2M13 6h2M9 9h2M13 9h2M9 12h6M9 15l-2 6M15 15l2 6M18 6h3v6"/>',
  weltzeituhr: '<path d="M4 9h16v5H4zM12 9V4M8 4h8M6 14l-2 7M18 14l2 7M10 14l-1 7M14 14l1 7M7 11.5h10"/>',
  // M16 Charlottenburg: a dancer on her toes, a glass front, a mirror mask, a top hat, a ring, two mirrored dancers, a fan.
  scherbe: '<circle cx="12" cy="4" r="2"/><path d="M12 6v6M12 8l-6-2M12 8l6-3M8 12h8l-2 4h-4zM11 16l-1 5M13 16l2 4"/>',
  loge: '<path d="M6 4h12v11H6zM6 4l6 5 6-5M6 15l6-5 6 5M8 15v6M16 15v6"/>',
  souffleur: '<path d="M7 5c0-2 10-2 10 0v6c0 3-2 5-5 5s-5-2-5-5zM9.5 9h1.5M13 9h1.5M10 13c1 .8 3 .8 4 0M5 18l3 2M19 18l-3 2"/>',
  conferencier: '<path d="M8 3h8v6H8zM5 9h14M9 13h6M12 16v5M6 21l12-9"/><circle cx="18" cy="12" r="1.2"/>',
  ringvater: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3"/><path d="M9 5l3-3 3 3"/>',
  spiegelpaar: '<path d="M12 2v20M7 5a1.5 1.5 0 1 1 0 .1M17 5a1.5 1.5 0 1 1 0 .1M7 7v6l-3 7M7 9l-3-2M17 7v6l3 7M17 9l3-2"/>',
  diva: '<path d="M12 21L4 9M12 21l-4-13M12 21V7M12 21l4-13M12 21l8-12M4 9c2-2 14-2 16 0"/><circle cx="12" cy="4" r="1.5"/>',
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
/** Kodex › Funde (2D #14, #27, mockup m16c): per district the Uhrwerkteile as rings and the Kassetten as text. */
function fundeHtml(s: Sim): string {
  const got = s.statContext.funde ?? [];
  const all = FUNDE.reduce((n, d) => n + FUNDE_TEILE + d.kassetten.length, 0);
  const rows = FUNDE.map((d, di) => {
    const teile = Array.from({ length: FUNDE_TEILE }, (_, i) => got.includes(fundId(di, 'teil', i)));
    const nT = teile.filter(Boolean).length, nK = d.kassetten.filter((_, i) => got.includes(fundId(di, 'kassette', i))).length;
    if (!nT && !nK) return `<div class="kf dim"><div class="un">${esc(d.name)}</div><div class="ud">0 von ${FUNDE_TEILE} Uhrwerkteilen · 0 von ${d.kassetten.length} Kassetten</div></div>`;
    const dmg = teile.filter((g, i) => g && i % 2 === 0).length, hp = teile.filter((g, i) => g && i % 2 === 1).length * 5;
    const rings = teile.map(g => `<i class="kfr${g ? ' on' : ''}"></i>`).join('');
    const kass = d.kassetten.map((k, i) => got.includes(fundId(di, 'kassette', i)) ? `<div class="kx kk"><div><div class="un">${esc(k.title)}</div><div class="ud">„${esc(k.text)}“</div></div></div>` : '<div class="kx kk dim"><div class="ud">??? · noch nicht gefunden</div></div>').join('');
    return `<div class="kf"><div class="un">${esc(d.name)}</div><div class="kfrow">${rings}<span class="ud">${nT} von ${FUNDE_TEILE} Uhrwerkteilen${nT ? ` · +${dmg} % Schaden, +${hp} Leben` : ''}</span></div><div class="ud ${nT === FUNDE_TEILE ? 'ok' : ''}">Alle ${FUNDE_TEILE}: ${esc(d.bonus.name)} (${esc(d.bonus.text)})</div>${kass}</div>`;
  }).join('');
  return `<div class="lbl">Funde ${got.length} von ${all}</div><p class="hint">Versteckt in Ecken und Sackgassen. Jeder Fund zählt einmal. Was liegen bleibt, wartet beim nächsten Mal am selben Ort.</p>${rows}`;
}

export function kodexHtml(s: Sim): string {
  const k = s.inventory.kodex ?? { kills: {}, found: {} };
  const card = (img: string, name: string, nameColor: string, text: string, side = ''): string => `<div class="kx">${img}<div><div class="un"${nameColor ? ` style="color:${nameColor}"` : ''}>${name}</div><div class="ud">${text}</div></div>${side ? `<span class="ud">${side}</span>` : ''}</div>`;
  const weak = (kind: EnemyKind): string => { const r = ENEMIES[kind].res; if (r === 'none') return ''; const t = ENEMY_RESISTANCES[r]; return (Object.keys(t) as Array<keyof typeof t>).filter(e => (t[e] ?? 1) > 1.2).map(e => `<span style="color:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span>`).join(' '); };
  const DIM = 'var(--dim)', unk = '???';
  // D9: the enemy's class names the weapon that fits (Kodex text after the description).
  const cls = (kind: EnemyKind): string => ` <span class="kcls">${ENEMIES[kind].classes.map((c) => ENEMY_CLASS_NAME[c]).join(', ')}</span>`;
  const enemies = NORMAL.map(e => { const o = !!k.kills[e]; return card(kimg(enemyArt(e), o ? 'on' : 'sil'), o ? esc(ENEMIES[e].name) : unk, o ? '' : DIM, o ? esc(ENEMY_TEXT[e] ?? '') + cls(e) : 'Noch nicht begegnet', o ? weak(e) : ''); }).join('');
  const bosses = BOSSES.map(e => { const o = !!k.kills[e]; return card(kimg(enemyArt(e), o ? 'on' : 'sil'), o ? esc(ENEMIES[e].name) : unk, o ? 'var(--ember)' : DIM, o ? `${esc(ENEMY_TEXT[e] ?? '')}${cls(e)} Besiegt: ${k.kills[e]}` : 'Noch nicht besiegt', o ? weak(e) : ''); }).join('');
  const has = (id: SurvivorId): boolean => !!s.statContext.survivors[id];
  const survivors = SURVIVORS.map(v => card(kimg(kport(KEEPER_PORTRAIT[v.id]), has(v.id) ? 'on' : 'dim'), has(v.id) ? esc(v.name) : unk, has(v.id) ? 'var(--good)' : DIM, esc(v.description), has(v.id) ? `<span class="ok">${esc(STATIONS.find(st => st.npc === v.id)?.name ?? 'Im Lager')}</span>` : 'Vermisst')).join('');
  const legs = Object.keys(LEGENDARY_POWERS) as LegendaryId[], nLeg = legs.filter(b => k.found[b]).length;
  const legRows = legs.map(b => { const f = !!k.found[b]; return card(kimg(itemIcon({ base: b, slot: 'w' }), f ? 'on' : 'dim', '', ' kitem'), f ? esc(BASE_NAME[b] ?? b) : unk, f ? RARITIES[3].color : DIM, f ? esc(LEGENDARY_POWERS[b].description) : 'Noch nicht gefunden'); }).join('');
  const sets = (Object.keys(SETS) as SetId[]).map(id => { const S = SETS[id], ps = Object.entries(S.pieces) as Array<[SlotId, { base: string }]>, n = ps.filter(([, p]) => k.found[p.base]).length; return card(`<span class="kset">${ps.map(([slot, p]) => kimg(itemIcon({ base: p.base, slot, set: id }), k.found[p.base] ? 'on' : 'dim', '', ' kitem')).join('')}</span>`, `${esc(S.name)} · ${n}/${ps.length} gefunden`, SET_COLOR, `(2) ${esc(S.bonusDescriptions[2])} · (3) ${esc(S.bonusDescriptions[3])} · (5) ${esc(S.bonusDescriptions[5])}`); }).join('');
  const elites = ELITE_MODS.map(m => { const o = !!k.kills[`e:${m}`], c = hex(ELITES[m].color); return card(kimg(kport(ELITE_PORTRAIT[m]), o ? 'on' : 'sil', o ? c : ''), o ? esc(ELITES[m].name) : unk, o ? c : DIM, o ? esc(ELITES[m].hint) : 'Noch nicht begegnet'); }).join('');
  const surv = SURVIVORS.filter(v => has(v.id)).length;
  return `<div class="kodex"><div class="lbl">Gegner</div><div class="cols2">${enemies}</div><div class="lbl">Endgegner</div><div class="cols2">${bosses}</div>${fundeHtml(s)}<div class="lbl">Bewohner ${surv} von ${SURVIVORS.length}</div><p class="hint">Befreie Gefangene auf Expeditionen. Sie ziehen ins Lager, helfen dauerhaft und ermöglichen Stufe 2 ihrer Station.</p><div class="cols2">${survivors}</div><div class="lbl">Legendäre Funde ${nLeg} von ${legs.length}</div><div class="cols2">${legRows}</div><div class="lbl">Sets</div><div class="cols2">${sets}</div><div class="lbl">Elite-Gegner</div><div class="cols2">${elites}</div></div>`;
}
