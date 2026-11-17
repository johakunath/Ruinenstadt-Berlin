// U1: the inventory tab of the pause menu, laid out as the 2D bag (`js/panels.js` renderInv, detail;
// `js/items.js` cmpRows, cmpBlock, statLine): doll and stats, bag with salvage chips, detail column.
import { WEAPON_MODS } from '../data/crafting';
import { AFFIXES, ATTRIBUTE_STATS, ELEMENTS, IMPLICITS, IMPLANT_MODES, LEGENDARY_POWERS, RARITIES, SETS, SLOTS, SLOT_MAIN_STATS, SLOT_NAMES, WEAPON_KINDS, type AffixId, type AttributeKindId, type BaseId, type LegendaryId, type SlotId, type WeaponKindId } from '../data/items';
import { POWERS } from '../data/powers';
import { selectPower } from '../sim/abilities';
import { BAG_SIZE, bulkCandidates, equipItem, salvageItem, setImplantMode, unequipItem } from '../sim/inventory';
import { isUpgrade, scrapValue, shownLevel, type Item } from '../sim/items';
import { heroStats, setCount, weaponDps, type Equipment, type HeroStats } from '../sim/stats';
import type { Sim } from '../sim/types';
import { ITEM_ICONS } from './item-icons';
import { POWER_GLYPHS } from './glyphs';

type Selection = { bag: number } | { slot: SlotId };
const art = import.meta.glob('../../assets/inventory/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const artUrl = (id: string): string => art[`../../assets/inventory/${id}.webp`] ?? '';
export const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const color = (i: Item): string => i.set ? '#75d68a' : RARITIES[i.rarity].color;
export const itemIcon = (i: { base: string; slot: SlotId }): string => ITEM_ICONS[i.base] ? `<img src="${artUrl(ITEM_ICONS[i.base]!)}" alt="" draggable="false">` : `<span>${esc(SLOT_NAMES[i.slot])}</span>`;
const pct = (v: number): number => v * 100;
/** 2D SROWS: the stat table and "Alle Werte nach Wechsel". inv: lower is better. */
const STAT_ROWS: Array<[string, (s: HeroStats) => number, number, string, boolean?]> = [
  ['Schaden', s => s.damage, 0, ''], ['Angriffstempo', s => pct(s.attackSpeed), 0, '%'], ['Krit-Chance', s => pct(s.crit), 0, '%'],
  ['Leben', s => s.maxHp, 0, ''], ['Widerstand', s => pct(s.res), 0, '%'], ['Lauftempo', s => s.moveSpeed, 1, ''],
  ['Leben pro Sekunde', s => s.regen, 1, ''], ['Elementarschaden', s => s.elements.length ? pct(s.elementPower) : 0, 0, '%'],
  ['Leben pro Kill', s => s.leech, 0, ''], ['Beuteglück', s => s.luck, 0, ''], ['Sprint-Abklingzeit', s => s.dashCooldown, 1, ' s', true],
];
const fmt = (v: number, d: number, u: string): string => v.toFixed(d) + u;

/** 2D statLine: the main value of an item in one line. */
export function statLine(i: Item): string {
  if (i.slot === 'w') return `${i.value} Schaden · ${WEAPON_KINDS[i.kind as WeaponKindId].name} · ${Math.round(weaponDps(i))} DPS`;
  if (i.slot === 'a') return `+${i.value} Leben`;
  const stat = SLOT_MAIN_STATS[i.slot] ?? ATTRIBUTE_STATS[i.kind as AttributeKindId];
  const a = AFFIXES[stat];
  return `+${i.value}${i.kind === 'heil' ? '' : a.unit || '%'} ${a.name}`;
}
const affixMap = (i: Item | undefined): Partial<Record<AffixId, number>> => {
  const m: Partial<Record<AffixId, number>> = {};
  if (i) for (const a of [...(IMPLICITS[i.base as BaseId] ?? []), ...i.affixes]) m[a.id] = (m[a.id] ?? 0) + a.value;
  return m;
};
const affixText = (id: AffixId, v: number): string => { const a = AFFIXES[id]; return `${(v > 0) !== !!a.negative ? '+' : '−'}${+Math.abs(v).toFixed(1)}${a.unit} ${a.name}`; };
/** 2D cmpRows: same affix on the same row in both cards; `other` gives the change per row. */
function cmpRows(it: Item | undefined, other: Item | undefined, diff: boolean): string {
  const A = affixMap(it), B = affixMap(other);
  const base = (x: Item): number => x.slot === 'w' ? weaponDps(x) : x.value;
  const dc = (d: number, t: string): string => Math.abs(d) < 1e-9 ? '' : `<b class="${d > 0 ? 'positive' : 'negative'}">${t}</b>`;
  const sgn = (d: number, dec: boolean): string => `${d > 0 ? '+' : '−'}${dec ? Math.abs(d).toFixed(1) : Math.round(Math.abs(d))}`;
  const bd = diff && it && other && it.slot === other.slot ? (() => { const d = base(it) - base(other); return dc(d, sgn(d, false) + (it.slot === 'w' ? ' DPS' : '')); })() : '';
  let h = `<div class="crow cbase"><span>${it ? statLine(it) : 'Nichts angelegt'}</span>${bd}</div>`;
  for (const id of Object.keys(AFFIXES) as AffixId[]) {
    if (!(id in A) && !(id in B)) continue;
    const a = A[id], d = (a ?? 0) - (B[id] ?? 0), neg = !!AFFIXES[id].negative;
    h += `<div class="crow">${a != null ? `<span class="${(a > 0) !== neg ? '' : 'negative'}">${affixText(id, a)}</span>` : '<span class="cnone">–</span>'}${diff ? dc(neg ? -d : d, sgn(neg ? -d : d, d % 1 !== 0) + AFFIXES[id].unit + (B[id] == null ? ' neu' : '')) : ''}</div>`;
  }
  return h;
}
/** Set, legendary power, element, mods (2D extraLines). */
function extraLines(i: Item, eq: Equipment): string {
  let h = '';
  if (i.set) { const S = SETS[i.set], n = setCount(eq, i.set); h += `<div class="af set">Set ${S.name} · ${n}/${Object.keys(S.pieces).length} angelegt</div>${([2, 3, 5] as const).map(t => `<div class="af ${n >= t ? 'set' : 'dim'}">(${t}) ${S.bonusDescriptions[t]}</div>`).join('')}`; }
  const lp = LEGENDARY_POWERS[i.base as LegendaryId];
  if (i.rarity === 3 && lp) h += `<div class="af legend">${esc(lp.description)}</div>`;
  if (i.element) h += `<div class="af" style="color:${ELEMENTS[i.element].color}">Element: ${ELEMENTS[i.element].name}</div>`;
  for (const id of i.mods ?? []) { const m = WEAPON_MODS.find(x => x.id === id); if (m) h += `<div class="af mod">${m.name} · ${m.description}</div>`; }
  return h;
}

/** Bag, doll and comparison of the pause menu. Lives in the menu shell (`menu.ts`). */
/** The turnable hero in the doll (H1 step 5, render/hero-preview.ts); the UI only places its canvas. */
export interface Portrait {
  readonly canvas: HTMLCanvasElement;
  setOpen(on: boolean): void;
  refresh(): void;
}

export class InventoryUi {
  readonly root = document.createElement('div');
  private portrait: Portrait | null = null;
  private selection: Selection | null = null;
  private armed = '';
  private message = '';
  private drag: { selection: Selection; x: number; y: number; active: boolean; timer: ReturnType<typeof setTimeout> | null } | null = null;
  private suppressClick = false;

  constructor(private readonly sim: () => Sim) {
    this.root.id = 'inventory';
    this.root.className = 'inv-tab';
    this.root.hidden = true;
    this.root.addEventListener('click', e => {
      if (this.suppressClick) { this.suppressClick = false; return; }
      const b = (e.target as Element).closest<HTMLElement>('button');
      if (!b) return;
      if (b.dataset.bag !== undefined || b.dataset.slot) {
        const next: Selection = b.dataset.bag !== undefined ? { bag: +b.dataset.bag } : { slot: b.dataset.slot as SlotId };
        // Second tap or a double click on the selected bag item equips it (backlog P4).
        const again = this.selection && JSON.stringify(this.selection) === JSON.stringify(next) && e.detail >= 2;
        this.selection = next; this.armed = ''; this.message = '';
        if (again && 'bag' in next) { this.act('equip', ''); this.render(b.dataset.key); return; }
        this.renderDetail(); return;
      }
      this.act(b.dataset.action ?? '', b.dataset.value ?? '');
      if (this.open) this.render(b.dataset.key);
    });
    this.root.addEventListener('pointerdown', e => {
      const b = (e.target as Element).closest<HTMLElement>('button[data-bag],button[data-slot]');
      if (!b || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const selection: Selection = b.dataset.bag !== undefined ? { bag: +b.dataset.bag } : { slot: b.dataset.slot as SlotId };
      if (!this.item(selection)) return;
      const timer = e.pointerType === 'touch' ? setTimeout(() => { if (this.drag) { this.drag.active = true; b.classList.add('dragging'); } }, 350) : null;
      this.drag = { selection, x: e.clientX, y: e.clientY, active: false, timer };
    });
    this.root.addEventListener('pointermove', e => {
      if (!this.drag) return;
      if (!this.drag.active && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 8) {
        if (e.pointerType === 'touch') this.cancelDrag(); else this.drag.active = true;
      }
      if (this.drag?.active) {
        e.preventDefault();
        this.root.querySelectorAll('.drop-target').forEach(b => b.classList.remove('drop-target'));
        document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-slot],[data-bag]')?.classList.add('drop-target');
      }
    });
    window.addEventListener('pointerup', e => {
      const drag = this.drag;
      this.cancelDrag();
      if (!drag?.active) return;
      this.suppressClick = true;
      setTimeout(() => { this.suppressClick = false; }, 400);
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-slot],[data-bag]');
      if (target && this.root.contains(target)) this.drop(drag.selection, target);
      this.render(target?.dataset.key);
    });
    window.addEventListener('pointercancel', () => this.cancelDrag());
    this.root.addEventListener('touchmove', e => { if (this.drag?.active && e.cancelable) e.preventDefault(); }, { passive: false });
  }

  get open(): boolean { return !this.root.hidden; }
  /** Replaces the painted portrait with the live hero; its canvas is re-attached on every render. */
  setPortrait(p: Portrait): void {
    this.portrait = p;
    p.setOpen(this.open);
    if (this.open) this.render();
  }
  /** Shown as the menu tab; focus lands on the first item in the bag. */
  show(on: boolean): void {
    this.cancelDrag(); this.armed = ''; this.message = '';
    if (on && this.selection && !this.item()) this.selection = null;
    this.root.hidden = !on;
    this.portrait?.setOpen(on);
    if (on) { this.render(); (this.root.querySelector<HTMLElement>('.inv-grid button') ?? this.root.querySelector<HTMLElement>('.inv-doll button'))?.focus(); }
  }
  private item(sel = this.selection): Item | undefined {
    if (!sel) return;
    return 'bag' in sel ? this.sim().inventory.bag[sel.bag] : this.sim().equipment[sel.slot];
  }
  private cancelDrag(): void {
    if (this.drag?.timer) clearTimeout(this.drag.timer);
    this.drag = null;
    this.root.querySelectorAll('.dragging,.drop-target').forEach(b => b.classList.remove('dragging', 'drop-target'));
  }
  private drop(from: Selection, target: HTMLElement): void {
    const sim = this.sim(), item = this.item(from);
    if (!item) return;
    if (target.dataset.slot && 'bag' in from && item.slot === target.dataset.slot) equipItem(sim, from.bag);
    else if (target.dataset.bag !== undefined) {
      if ('slot' in from) {
        const index = +target.dataset.bag;
        if (sim.inventory.bag[index]?.slot === from.slot) equipItem(sim, index);
        else if (!unequipItem(sim, from.slot)) this.message = from.slot === 'w' ? 'Waffe nur tauschen.' : 'Rucksack voll.';
      } else {
        const i = +target.dataset.bag;
        if (sim.inventory.bag[i]) [sim.inventory.bag[from.bag], sim.inventory.bag[i]] = [sim.inventory.bag[i]!, item];
        else { sim.inventory.bag.splice(from.bag, 1); sim.inventory.bag.push(item); }
      }
    }
    this.selection = null;
  }
  private act(action: string, value: string): void {
    const sim = this.sim(), item = this.item(), sel = this.selection;
    if (action === 'equip' && sel && 'bag' in sel) { equipItem(sim, sel.bag); this.selection = { slot: item!.slot }; }
    if (action === 'unequip' && sel && 'slot' in sel) {
      if (unequipItem(sim, sel.slot)) this.selection = { bag: sim.inventory.bag.length - 1 };
      else this.message = 'Rucksack voll.';
    }
    if (action === 'lock' && item) item.locked = !item.locked;
    if (action === 'mode' && item) setImplantMode(sim, item, Number(value));
    if (action === 'power' && item?.slot === 'w') {
      if (sim.equipment.w === item) selectPower(sim, Number(value) === 1 ? 1 : 0); else item.power = Number(value) === 1 ? 1 : 0;
    }
    if (action === 'salvage' || action === 'bulk') {
      const candidates = action === 'salvage' && sel && 'bag' in sel ? [this.item(sel)!] : bulkCandidates(sim, value === 'rest' ? 'rest' : Number(value));
      const key = action + value;
      // "Rest" and rare or set pieces need a second tap (2D allArm).
      if ((action === 'bulk' && value === 'rest') || candidates.some(i => i.set || i.rarity >= 2)) {
        if (this.armed !== key) { this.armed = key; this.message = 'Sicher? Erneut tippen.'; return; }
      }
      const before = sim.inventory.scrap;
      for (const i of candidates) salvageItem(sim, sim.inventory.bag.indexOf(i));
      this.selection = null; this.armed = '';
      const got = sim.inventory.scrap - before;
      this.message = got > 0 ? `+${got} Schrott` : '';
    }
  }
  private cell(item: Item | undefined, attrs: string, label: string, slot: boolean): string {
    const sim = this.sim();
    if (!item) return slot ? `<button type="button" class="inv-cell empty" ${attrs} aria-label="${esc(label)}: leer"><span>—</span></button>` : `<div class="inv-cell empty" ${attrs} aria-hidden="true"></div>`;
    return `<button type="button" class="inv-cell" ${attrs} aria-label="${esc(item.name)}" style="--rarity:${color(item)}">${itemIcon(item)}<small>${shownLevel(item)}</small>${item.locked ? '<b class="inv-lock">◆</b>' : ''}${!slot && isUpgrade(item, sim.equipment[item.slot]) ? '<b class="inv-up">▲</b>' : ''}${item.element ? `<i style="background:${ELEMENTS[item.element].color}"></i>` : ''}</button>`;
  }
  render(preferredKey?: string): void {
    const active = document.activeElement as HTMLElement | null;
    const previousKey = preferredKey ?? (active && this.root.contains(active) ? active.dataset.key : undefined);
    const sim = this.sim(), inv = sim.inventory, s = sim.stats;
    const gear = SLOTS.map(slot => `<div class="inv-slot inv-${slot}">${this.cell(sim.equipment[slot], `data-slot="${slot}" data-key="slot-${slot}"`, SLOT_NAMES[slot], true)}<span>${SLOT_NAMES[slot]}</span></div>`).join('');
    const chips = ([['Gewöhnl.', 0], ['Magisch', 1], ['Selten', 2], ['Rest', 'rest']] as const).flatMap(([label, what], i) => {
      const v = bulkCandidates(sim, what).reduce((a, it) => a + scrapValue(it), 0);
      if (!v) return [];
      const armed = what === 'rest' && this.armed === 'bulkrest';
      return [`<button type="button" class="chip${armed ? ' warn' : ''}" data-action="bulk" data-value="${what}" data-key="bulk-${i}"${typeof what === 'number' ? ` style="color:${RARITIES[what].color}"` : ''}>${armed ? 'Sicher?' : `${label} +${v}`}</button>`];
    }).join('');
    this.root.innerHTML = `<div class="inv-columns"><section class="inv-character"><div class="inv-doll">${this.portrait ? '<span class="inv-portrait-slot"></span>' : `<img class="inv-portrait" src="${artUrl('survivor')}" alt="">`}${gear}</div><dl class="inv-stats">${STAT_ROWS.filter(r => r[0] !== 'Elementarschaden' || s.elements.length).map(([n, f, d, u]) => `<dt>${n}</dt><dd>${fmt(f(s), d, u)}</dd>`).join('')}</dl></section><section class="inv-bag"><div class="inv-bagh"><h3>Rucksack ${inv.bag.length}/${BAG_SIZE}</h3>${chips ? `<div class="inv-bulk">${chips}</div>` : ''}</div><div class="inv-grid">${Array.from({ length: BAG_SIZE }, (_, i) => this.cell(inv.bag[i], `data-bag="${i}" data-key="bag-${i}"`, `Platz ${i + 1}`, false)).join('')}</div><p class="inv-hint">▲ Höherer Item Level · Doppeltipp legt an</p></section><section class="inv-detail">${this.detail()}</section></div><footer aria-live="polite">${esc(this.message)}</footer>`;
    if (this.portrait) {
      this.root.querySelector('.inv-portrait-slot')?.replaceWith(this.portrait.canvas);
      this.portrait.refresh();
    }
    this.markSelection();
    this.restoreFocus(previousKey);
  }
  /** Selection change: only the detail column and the cell marks (U1 step 4). */
  private renderDetail(): void {
    const d = this.root.querySelector('.inv-detail');
    if (!d) return this.render();
    d.innerHTML = this.detail();
    const f = this.root.querySelector('footer'); if (f) f.textContent = '';
    this.markSelection();
  }
  private markSelection(): void {
    const key = this.selection ? ('bag' in this.selection ? `bag-${this.selection.bag}` : `slot-${this.selection.slot}`) : '';
    this.root.querySelectorAll('.inv-cell').forEach(c => c.classList.toggle('sel', (c as HTMLElement).dataset.key === key));
  }
  private restoreFocus(previousKey?: string): void {
    if (!this.open || !previousKey) return;
    const sel = this.selection ? ('bag' in this.selection ? `bag-${this.selection.bag}` : `slot-${this.selection.slot}`) : undefined;
    const bs = [...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    (bs.find(b => b.dataset.key === previousKey) ?? bs.find(b => b.dataset.key === sel) ?? this.root.querySelector<HTMLElement>('.inv-grid button') ?? bs[0])?.focus();
  }
  private head(x: Item | undefined, label: string, slot: SlotId): string {
    return x ? `<small class="clab">${label}</small><div class="inv-card-head">${itemIcon(x)}<div><h3>${esc(x.name)}</h3><p class="sub">${x.set ? 'Set-Teil' : RARITIES[x.rarity].name} · ${x.slot === 'w' ? WEAPON_KINDS[x.kind as WeaponKindId].name : SLOT_NAMES[x.slot]} · Item Level ${shownLevel(x)}</p></div></div>`
      : `<small class="clab">${label}</small><div class="inv-card-head"><span></span><div><h3 class="dim">Leer</h3><p class="sub">${SLOT_NAMES[slot]}</p></div></div>`;
  }
  /** Kraft chooser on the weapon card (2D krsel), implant mode on the implant (2D im). */
  private config(x: Item): string {
    if (x.slot === 'w') {
      const P = POWERS[x.kind as WeaponKindId], cur = x.power === 1 ? 1 : 0;
      const glyph = (id: keyof typeof POWER_GLYPHS): string => `<svg viewBox="0 0 48 48" aria-hidden="true">${POWER_GLYPHS[id]}</svg>`;
      return `<div class="krsel"><small class="clab">Kraft dieser Waffe</small><div class="krrow">${[0, 1].map(i => `<button type="button" class="krb" data-action="power" data-value="${i}" data-key="power-${i}" aria-pressed="${cur === i}">${glyph(P[i]!.id)}<span>${P[i]!.name}</span><small>${P[i]!.cooldown} s</small></button>`).join('')}<div class="krb ult">${glyph(P[2].id)}<span>${P[2].name}</span><small>Ultimativ · ${P[2].cooldown} s</small></div></div><p class="inv-hint">${P[cur]!.description}. Ultimativ: ${P[2].description}</p></div>`;
    }
    if (x.slot === 'i') return `<div class="krsel"><small class="clab">Implantat-Modus</small><div class="krrow">${IMPLANT_MODES.map((m, i) => `<button type="button" class="krb" data-action="mode" data-value="${i}" data-key="mode-${i}" aria-pressed="${(x.implantMode ?? 0) === i}"><span>${m.name}</span><small>${m.description}</small></button>`).join('')}</div></div>`;
    return '';
  }
  private detail(): string {
    const it = this.item(), sim = this.sim(), sel = this.selection;
    if (!sel) return '<p class="inv-hint">Teil antippen zum Vergleichen.</p>';
    if (!it) return `<div class="inv-card"><p class="inv-hint">${SLOT_NAMES['slot' in sel ? sel.slot : 'w']}: leer. Lege ein passendes Teil aus dem Rucksack an.</p></div>`;
    const eqAll = sim.equipment;
    const lock = `<button type="button" data-action="lock" data-key="lock" aria-pressed="${!!it.locked}">${it.locked ? 'Entsperren' : 'Sperren'}</button>`;
    if ('slot' in sel) {
      const acts = `<div class="inv-actions">${it.slot !== 'w' ? `<button type="button" data-action="unequip" data-key="unequip" ${sim.inventory.bag.length >= BAG_SIZE ? 'disabled' : ''}>Ablegen</button>` : ''}${lock}</div>`;
      return `<article class="inv-card" style="--rarity:${color(it)}">${this.head(it, 'Angelegt', it.slot)}<div class="crows">${cmpRows(it, undefined, false)}</div>${extraLines(it, eqAll)}${this.config(it)}${acts}</article>`;
    }
    const eq = eqAll[it.slot], il0 = eq ? shownLevel(eq) : 0, il1 = shownLevel(it);
    const a = sim.stats, b = heroStats({ ...eqAll, [it.slot]: it }, sim.statContext);
    const all = STAT_ROWS.flatMap(([n, f, d, u, inv]) => { const x = fmt(f(a), d, u), y = fmt(f(b), d, u); if (x === y) return []; const good = inv ? f(b) < f(a) : f(b) > f(a); return [`<div class="cmp"><span>${n}</span><span>${x} → <b class="${good ? 'positive' : 'negative'}">${y}</b></span></div>`]; }).join('') || '<p class="inv-hint">Keine Veränderung</p>';
    const acts = `<div class="inv-actions"><button type="button" class="primary" data-action="equip" data-key="equip">Anlegen</button><button type="button" data-action="salvage" data-key="salvage" ${it.locked ? 'disabled' : ''}>Schrott +${scrapValue(it)}</button>${lock}</div>`;
    return `<div class="cmp2"><article class="inv-card" style="--rarity:${color(it)}">${this.head(it, 'Ausgewählt', it.slot)}<div class="crows">${cmpRows(it, eq, true)}</div>${extraLines(it, eqAll)}${this.config(it)}<div class="cmp ckp"><span>Item Level</span><span>${eq ? `${il0} → ` : ''}<b class="${il1 > il0 ? 'positive' : il1 < il0 ? 'negative' : ''}">${il1}${il1 > il0 ? ' ▲' : ''}</b></span></div><details class="cdet"><summary>Alle Werte nach Wechsel</summary>${all}</details>${acts}</article><article class="inv-card ceq" style="--rarity:${eq ? color(eq) : '#4c453a'}">${this.head(eq, 'Angelegt', it.slot)}<div class="crows">${cmpRows(eq, it, false)}</div>${eq ? extraLines(eq, eqAll) : ''}</article></div>`;
  }
}

/** One item as a card (trader screen): name, type, main value, affixes, element, mods, legendary power, set bonuses. */
export function itemCard(item: Item, label: string, equipment: Equipment): string {
  return `<article class="inv-card" style="--rarity:${color(item)}"><small class="clab">${label}</small><div class="inv-card-head">${itemIcon(item)}<div><h3>${esc(item.name)}</h3><p class="sub">${item.set ? 'Set-Teil' : RARITIES[item.rarity].name} · ${item.slot === 'w' ? WEAPON_KINDS[item.kind as WeaponKindId].name : SLOT_NAMES[item.slot]} · Item Level ${shownLevel(item)}</p></div></div><div class="crows">${cmpRows(item, equipment[item.slot], !!equipment[item.slot])}</div>${extraLines(item, equipment)}</article>`;
}
