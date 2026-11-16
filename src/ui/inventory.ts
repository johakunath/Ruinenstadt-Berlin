import { WEAPON_MODS } from '../data/crafting';
import { AFFIXES, ATTRIBUTE_STATS, ELEMENTS, IMPLICITS, IMPLANT_MODES, LEGENDARY_POWERS, RARITIES, SETS, SLOTS, SLOT_MAIN_STATS, SLOT_NAMES, WEAPON_KINDS, type AttributeKindId, type BaseId, type LegendaryId, type SlotId, type WeaponKindId } from '../data/items';
import { BAG_SIZE, equipItem, salvageItem, unequipItem } from '../sim/inventory';
import { avgIl, isUpgrade, scrapValue, shownLevel, type Item } from '../sim/items';
import { setLoadout } from '../sim/loadout';
import { heroStats, setCount, type Equipment, type HeroStats } from '../sim/stats';
import type { Sim } from '../sim/types';
import { ITEM_ICONS } from './item-icons';

type Selection = { bag: number } | { slot: SlotId };
const art = import.meta.glob('../../assets/inventory/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (id: string): string => art[`../../assets/inventory/${id}.webp`] ?? '';
const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const color = (i: Item): string => i.set ? '#75d68a' : RARITIES[i.rarity].color;
const icon = (i: Item): string => ITEM_ICONS[i.base] ? `<img src="${url(ITEM_ICONS[i.base]!)}" alt="" draggable="false">` : `<span>${esc(SLOT_NAMES[i.slot])}</span>`;
const statRows: Array<[string, keyof HeroStats, number, string]> = [
  ['Schaden', 'damage', 0, ''], ['Leben', 'maxHp', 0, ''], ['Krit-Chance', 'crit', 1, '%'],
  ['Lauftempo', 'moveSpeed', 1, ''], ['Angriffstempo', 'attackSpeed', 2, '×'], ['Widerstand', 'res', 1, '%'],
  ['Leben pro Sekunde', 'regen', 1, ''], ['Leben pro Kill', 'leech', 1, ''], ['Beuteglück', 'luck', 0, ''],
];

/** Same three panels and actions as the 2D bag; no world/render dependencies. */
export class InventoryUi {
  readonly root = document.createElement('div');
  private selection: Selection | null = null;
  private armed = '';
  private message = '';
  private previousFocus: HTMLElement | null = null;
  private drag: { selection: Selection; x: number; y: number; active: boolean; timer: ReturnType<typeof setTimeout> | null } | null = null;
  private suppressClick = false;
  private padDown: boolean[] = [];
  private padNext = 0;

  constructor(private readonly sim: () => Sim, private readonly onToggle: (open: boolean) => void) {
    this.root.id = 'inventory';
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Inventar');
    document.body.append(this.root);
    this.root.addEventListener('click', e => {
      if (this.suppressClick) { this.suppressClick = false; return; }
      const b = (e.target as Element).closest<HTMLElement>('button');
      if (!b) return;
      const key = b.dataset.key;
      if (b.dataset.bag !== undefined) { this.selection = { bag: +b.dataset.bag }; this.armed = ''; }
      else if (b.dataset.slot) { this.selection = { slot: b.dataset.slot as SlotId }; this.armed = ''; }
      else this.act(b.dataset.action ?? '', b.dataset.value ?? '');
      if (this.open) this.render(key);
    });
    this.root.addEventListener('keydown', e => {
      if (e.code === 'Escape') { e.stopPropagation(); this.toggle(false); }
      if (e.code === 'Tab') {
        const buttons = this.buttons(), first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
    this.root.addEventListener('pointerdown', e => {
      const b = (e.target as Element).closest<HTMLElement>('[data-bag],[data-slot]');
      if (!b || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const selection: Selection = b.dataset.bag !== undefined ? { bag: +b.dataset.bag } : { slot: b.dataset.slot as SlotId };
      if (!this.item(selection)) return;
      const timer = e.pointerType === 'touch'
        ? setTimeout(() => { if (this.drag) { this.drag.active = true; b.classList.add('dragging'); } }, 350)
        : null;
      this.drag = { selection, x: e.clientX, y: e.clientY, active: false, timer };
    });
    this.root.addEventListener('pointermove', e => {
      if (!this.drag) return;
      if (!this.drag.active && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 8) {
        if (e.pointerType === 'touch') this.cancelDrag();
        else this.drag.active = true;
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
      if (target) this.drop(drag.selection, target);
      this.render(target?.dataset.key);
    });
    window.addEventListener('pointercancel', () => this.cancelDrag());
    this.root.addEventListener('touchmove', e => { if (this.drag?.active && e.cancelable) e.preventDefault(); }, { passive: false });
  }

  get open(): boolean { return !this.root.hidden; }
  toggle(open: boolean): void {
    if (open === this.open) return;
    this.cancelDrag(); this.armed = ''; this.message = ''; this.selection = null;
    this.root.hidden = !open;
    if (open) {
      this.previousFocus = document.activeElement as HTMLElement;
      this.render(); this.buttons()[0]?.focus();
    } else this.previousFocus?.focus();
    this.onToggle(open);
  }
  private buttons(): HTMLButtonElement[] { return [...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; }
  /** D-pad/stick navigates; A selects/activates, B closes, Y opens via Input. */
  pollPad(now: number): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(p => p?.connected);
    if (!pad) { this.padDown = []; return; }
    const down = pad.buttons.map(b => b.pressed), edge = (i: number): boolean => !!down[i] && !this.padDown[i];
    if (this.open) {
      if (edge(1)) this.toggle(false);
      else if (edge(0)) (document.activeElement as HTMLElement)?.click();
      else if (now >= this.padNext) {
        const delta = down[12] || down[14] || (pad.axes[1] ?? 0) < -.5 || (pad.axes[0] ?? 0) < -.5 ? -1
          : down[13] || down[15] || (pad.axes[1] ?? 0) > .5 || (pad.axes[0] ?? 0) > .5 ? 1 : 0;
        if (delta) {
          const bs = this.buttons(), i = bs.indexOf(document.activeElement as HTMLButtonElement);
          bs[(i + delta + bs.length) % bs.length]?.focus(); this.padNext = now + 180;
        }
      }
    }
    this.padDown = down;
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
      }
      else {
        const i = +target.dataset.bag;
        if (sim.inventory.bag[i]) [sim.inventory.bag[from.bag], sim.inventory.bag[i]] = [sim.inventory.bag[i]!, item];
        else { sim.inventory.bag.splice(from.bag, 1); sim.inventory.bag.push(item); }
      }
    }
    this.selection = null;
  }
  private act(action: string, value: string): void {
    const sim = this.sim(), item = this.item(), sel = this.selection;
    if (action === 'close') return this.toggle(false);
    if (action === 'equip' && sel && 'bag' in sel) { equipItem(sim, sel.bag); this.selection = { slot: item!.slot }; }
    if (action === 'unequip' && sel && 'slot' in sel) {
      if (unequipItem(sim, sel.slot)) this.selection = { bag: sim.inventory.bag.length - 1 };
      else this.message = 'Rucksack voll.';
    }
    if (action === 'lock' && item) item.locked = !item.locked;
    if (action === 'mode' && item) {
      const mode = Number(value);
      if (mode >= 0 && mode < IMPLANT_MODES.length) {
        item.implantMode = mode as 0 | 1 | 2;
        if (sel && 'slot' in sel) setLoadout(sim, sim.equipment);
      }
    }
    if (action === 'salvage' || action === 'bulk') {
      const candidates = action === 'salvage' && sel && 'bag' in sel ? [this.item(sel)!] : sim.inventory.bag.filter(i => !i.locked && !i.set && i.rarity < 3 && (value === 'rest' ? !isUpgrade(i, sim.equipment[i.slot]) : i.rarity === Number(value)));
      const key = action + value;
      if (action === 'bulk' || candidates.some(i => i.set || i.rarity >= 2)) {
        if (this.armed !== key) { this.armed = key; this.message = 'Sicher? Erneut tippen.'; return; }
      }
      const before = sim.inventory.scrap;
      for (const i of candidates) salvageItem(sim, sim.inventory.bag.indexOf(i));
      this.selection = null; this.armed = ''; this.message = `+${sim.inventory.scrap - before} Schrott`;
    }
  }
  render(preferredKey?: string): void {
    const active = document.activeElement as HTMLElement | null;
    const previousKey = preferredKey ?? (active && this.root.contains(active) ? active.dataset.key : undefined);
    const sim = this.sim(), inv = sim.inventory;
    const cell = (item: Item | undefined, attrs: string, label: string): string => `<button type="button" class="inv-cell" ${attrs} aria-label="${esc(label)}" ${item ? `style="--rarity:${color(item)}"` : ''}>${item ? `${icon(item)}<small>${shownLevel(item)}</small>${item.locked ? '<b class="inv-lock">◆</b>' : ''}${isUpgrade(item, sim.equipment[item.slot]) && !attrs.includes('data-slot') ? '<b class="inv-up">▲</b>' : ''}${item.element ? `<i style="background:${ELEMENTS[item.element].color}"></i>` : ''}` : '<span>—</span>'}</button>`;
    const gear = SLOTS.map(slot => `<div class="inv-slot inv-${slot}">${cell(sim.equipment[slot], `data-slot="${slot}" data-key="slot-${slot}"`, SLOT_NAMES[slot])}<span>${SLOT_NAMES[slot]}</span></div>`).join('');
    this.root.innerHTML = `<div class="inv-panel"><header><h2>Inventar</h2><span>Schrott <b>${inv.scrap}</b> · Item Level <b>${avgIl(sim.equipment)}</b></span><button data-action="close" data-key="close" class="inv-x" aria-label="Schließen">×</button></header><div class="inv-columns"><section class="inv-character"><div class="inv-doll"><img class="inv-portrait" src="${url('survivor')}" alt="Überlebende">${gear}</div><dl class="inv-stats">${statRows.map(([n,k,d,u]) => `<dt>${n}</dt><dd>${((sim.stats[k] as number) * (u === '%' ? 100 : 1)).toFixed(d)}${u}</dd>`).join('')}</dl></section><section class="inv-bag"><h3>Rucksack ${inv.bag.length}/${BAG_SIZE}</h3><div class="inv-bulk">${['Gewöhnl.', 'Magisch', 'Selten', 'Rest'].map((label, i) => `<button data-action="bulk" data-value="${i === 3 ? 'rest' : i}" data-key="bulk-${i}">${label}</button>`).join('')}</div><div class="inv-grid">${Array.from({length: BAG_SIZE}, (_, i) => cell(inv.bag[i], `data-bag="${i}" data-key="bag-${i}"`, inv.bag[i]?.name ?? `Rucksackplatz ${i+1}`)).join('')}</div><p class="inv-hint">▲ Höherer Item Level.</p></section><section class="inv-detail">${this.detail()}</section></div><footer aria-live="polite">${esc(this.message)}</footer></div>`;
    this.restoreFocus(previousKey);
  }
  private restoreFocus(previousKey?: string): void {
    if (!this.open) return;
    const selectedKey = this.selection ? ('bag' in this.selection ? `bag-${this.selection.bag}` : `slot-${this.selection.slot}`) : undefined;
    const buttons = this.buttons();
    const target = buttons.find(b => b.dataset.key === previousKey)
      ?? buttons.find(b => b.dataset.key === selectedKey)
      ?? buttons[0];
    target?.focus();
  }
  private detail(): string {
    const item = this.item(), sim = this.sim(), sel = this.selection;
    if (!item || !sel) return '<p class="inv-hint">Teil antippen zum Vergleichen.</p>';
    const inBag = 'bag' in sel;
    const equipped = sim.equipment[item.slot];
    let preview: HeroStats | null = null;
    if (inBag) preview = heroStats({ ...sim.equipment, [item.slot]: item }, sim.statContext);
    return `${this.card(item, inBag ? 'Ausgewählt' : 'Angelegt')}<div class="inv-actions">${inBag ? '<button data-action="equip" data-key="equip">Anlegen</button>' : item.slot !== 'w' ? `<button data-action="unequip" data-key="unequip" ${sim.inventory.bag.length >= BAG_SIZE ? 'disabled' : ''}>Ablegen</button>` : ''}<button data-action="lock" data-key="lock" aria-pressed="${!!item.locked}">${item.locked ? 'Entsperren' : 'Sperren'}</button>${inBag ? `<button data-action="salvage" data-key="salvage" ${item.locked ? 'disabled' : ''}>Schrott +${scrapValue(item)}</button>` : ''}</div>${item.slot === 'i' ? IMPLANT_MODES.map((m, i) => `<button data-action="mode" data-value="${i}" data-key="mode-${i}" aria-pressed="${(item.implantMode ?? 0) === i}">${m.name} · ${m.description}</button>`).join('') : ''}${inBag ? (equipped ? this.card(equipped, 'Angelegt') : '<p>Angelegt: Leer</p>') : ''}${preview ? `<dl class="inv-stats inv-deltas">${statRows.flatMap(([n,k,d,u]) => { const diff = (preview[k] as number) - (sim.stats[k] as number); return Math.abs(diff) < .00001 ? [] : [`<dt>${n}</dt><dd class="${diff > 0 ? 'positive' : 'negative'}">${diff > 0 ? '+' : ''}${(diff * (u === '%' ? 100 : 1)).toFixed(d)}${u}</dd>`]; }).join('')}</dl>` : ''}`;
  }
  private card(item: Item, label: string): string {
    return itemCard(item, label, this.sim().equipment);
  }
}

/** One item as a card: name, type, main value, affixes, element, mods, legendary power, set bonuses. */
export function itemCard(item: Item, label: string, equipment: Equipment): string {
  const main = item.slot === 'w' ? 'Schaden' : item.slot === 't' || item.slot === 'r' || item.slot === 'i' ? AFFIXES[ATTRIBUTE_STATS[item.kind as AttributeKindId]].name : AFFIXES[SLOT_MAIN_STATS[item.slot]!].name;
  const mainUnit = item.slot === 'w' || item.slot === 'a' || item.kind === 'heil' ? '' : '%';
  const type = item.slot === 'w' ? WEAPON_KINDS[item.kind as WeaponKindId].name : SLOT_NAMES[item.slot];
  const powers = LEGENDARY_POWERS[item.base as LegendaryId];
  const set = item.set ? SETS[item.set] : undefined;
  const n = item.set ? setCount(equipment, item.set) : 0;
  return `<article class="inv-card" style="--rarity:${color(item)}"><small>${label}</small><div class="inv-card-head">${icon(item)}<h3>${esc(item.name)}</h3></div><p>${item.set ? 'Set-Teil' : RARITIES[item.rarity].name} · ${type} · Item Level ${shownLevel(item)}</p><b>${item.value}${mainUnit} ${main}</b>${[...(IMPLICITS[item.base as BaseId] ?? []), ...item.affixes].map(a => `<div>${a.value > 0 ? (AFFIXES[a.id].negative ? '−' : '+') : (AFFIXES[a.id].negative ? '+' : '−')}${Math.abs(a.value)}${AFFIXES[a.id].unit} ${AFFIXES[a.id].name}</div>`).join('')}${item.element ? `<p style="color:${ELEMENTS[item.element].color}">${ELEMENTS[item.element].name}</p>` : ''}${(item.mods ?? []).map(id => { const mod = WEAPON_MODS.find(m => m.id === id); return mod ? `<p>${mod.name} · ${mod.description}</p>` : ''; }).join('')}${item.rarity === 3 && powers ? `<p>${esc(powers.description)}</p>` : ''}${set ? `<h4>${set.name} · ${n} angelegt</h4>${([2,3,5] as const).map(t => `<p class="${n >= t ? 'positive' : 'inv-hint'}">(${t}) ${set.bonusDescriptions[t]}</p>`).join('')}` : ''}</article>`;
}
