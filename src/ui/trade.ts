// M13b trade screen, layout C (Johannes, 2026-11-26; `docs/mockups/m13b-trade/c-reiter.webp`): a full screen
// in the pause-menu look with three tabs. Waren: gear, the Späti's Aufsatz and its supplies as tiles, the
// picked one beside them with the worn piece (as the inventory). Segen: the two cards to buy or swap in,
// your blessings with the Stärkung. Verkaufen: the bag, bulk chips and the picked piece. The wandering and
// the tunnel trader show Waren (gear and heal) and Verkaufen. Every action goes through `src/sim/trade.ts`.
// Pointer: a tap picks, a tap on the picked tile buys (P5); pad and keys: focus picks, A presses, LB/RB
// switch tabs, Y swaps on a card, X sells the focused bag piece, B goes back (out of the swap first).
import { CONSUMABLES, WEAPON_MODS } from '../data/crafting';
import { CAMP_UPGRADES, PERKS, type PerkId } from '../data/progression';
import { RARITIES, SLOT_NAMES } from '../data/items';
import { activePad } from '../input/pad';
import type { Input } from '../input/input';
import { perkOf } from '../sim/blessings';
import { buySpatiUpgrade, modSlots, SPATI_UPGRADE, spatiUpgradeCost } from '../sim/camp';
import { BAG_SIZE, bulkCandidates, equipItem } from '../sim/inventory';
import { isUpgrade, scrapValue, shownLevel, type Item } from '../sim/items';
import {
  blessPrice, buyBlessing, buyConsumable, buyHeal, buyMod, buyOffer, closeTrade, healPrice, modPrice, sellBulk, sellItem,
  strengthenable, strengthenBlessing, swapBlessing, swapBlock, tradeShop, tradeStock, type Result,
} from '../sim/trade';
import type { Sim } from '../sim/types';
import { perkIcon } from './abilities';
import { pollDt, scrollParent, stickScroll } from './drag-scroll';
import { controls, moveFocus } from './focus';
import { modIcon, supplyIcon } from './prop-icon';
import { FAMILY_GLYPHS } from './glyphs';
import { artUrl, esc, itemCard, itemIcon, RES_ICON, resIcon } from './inventory';

type TabId = 'waren' | 'segen' | 'verkaufen';
const TAB_NAME: Record<TabId, string> = { waren: 'Waren', segen: 'Segen', verkaufen: 'Verkaufen' };
type SupId = 'dmg' | 'hp' | 'verband' | 'molotow' | 'heal';
/** What the detail column shows: a gear offer, the Aufsatz, a supply or a bag piece. */
type Pick = { k: 'g'; i: number } | { k: 'mod' } | { k: 'sup'; id: SupId } | { k: 'bag'; i: number };
const keyOf = (p: Pick): string => (p.k === 'g' ? `g${p.i}` : p.k === 'bag' ? `b${p.i}` : p.k === 'sup' ? `s-${p.id}` : 'mod');
const QUALITY = ['Neu', 'Selten', 'Episch', 'Umbau'] as const;
const QUALITY_COLOR = ['#e8ddd0', '#7d9bff', '#f2d14b', '#b48cff'] as const;
const VERBAND = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 21h30v8H9z" fill="#ead9c0"/><path d="M20 10h8v28h-8z" fill="#ead9c0"/><path d="M21 18h6v12h-6zM16 22h16v4H16z" fill="#c23a2e"/></svg>';
const MOLOTOW = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M19 20h10l3 7v13a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V27z" fill="#6a8a5a"/><path d="M21 12h6v8h-6z" fill="#8a9a7a"/><path d="M24 2c4 4 4 7 1 10-4-2-4-6-1-10z" fill="#ff8a3d"/><path d="M17 30h14v6H17z" fill="#c9b58c"/></svg>';
const MOD = `<svg viewBox="0 0 24 24" aria-hidden="true">${FAMILY_GLYPHS.mod[1]}</svg>`;
const modIc = (id: string): string => modIcon(id, MOD);
const PAD_HINT: Record<TabId, string> = {
  waren: '<span><b>A</b>Kaufen</span>',
  segen: '<span><b>A</b>Kaufen</span><span><b>Y</b>Tauschen</span>',
  verkaufen: '<span><b>X</b>Verkaufen</span>',
};

export class TradeUi {
  readonly root = document.createElement('div');
  /** The screen closed (the loop resumes the sim and saves). */
  onClose: () => void = () => {};
  private readonly body: HTMLElement;
  private readonly head: HTMLElement;
  private readonly msg: HTMLElement;
  private readonly hint: HTMLElement;
  private sim: Sim | null = null;
  private tab: TabId = 'waren';
  private pick: Pick | null = null;
  /** The pick came from a press or a focus (not the screen opening): a press on it buys (P5). */
  private armedPick = false;
  /** Card index while a swap waits for the blessing given up. */
  private swapCard = -1;
  /** A bulk chip waiting for its second press (rare pieces). */
  private armed = -1;
  private message: Result | null = null;
  /** Last pointer type: a touch tap focuses before its click, so focus must not count as the first tap. */
  private pointer = 'mouse';
  private padDown: boolean[] = [];
  private padNext = 0;
  private stickLast = 0;
  /** Focus moved by a re-render (after a purchase): it must not pick and arm the next tile, or a second A would buy it unseen. */
  private quiet = false;

  constructor(private readonly input: Input) {
    this.root.id = 'trade';
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Händler');
    this.root.innerHTML = '<button type="button" class="tr-x" data-close="1" aria-label="Schließen">×</button><div class="menu-panel trade-panel"><header class="menu-head trade-head"></header><div class="trade-body"></div><footer class="trade-foot"><p class="trade-msg" aria-live="polite"></p><p class="trade-pad"></p></footer></div>';
    this.head = this.root.querySelector('.trade-head')!;
    this.body = this.root.querySelector('.trade-body')!;
    this.msg = this.root.querySelector('.trade-msg')!;
    this.hint = this.root.querySelector('.trade-pad')!;
    document.body.append(this.root);
    this.root.addEventListener('pointerdown', (e) => { this.pointer = e.pointerType; }, { capture: true });
    this.root.addEventListener('click', (e) => this.click(e));
    // Pad and keys: focusing a tile or a bag piece picks it (the detail follows the focus).
    this.root.addEventListener('focusin', (e) => {
      if (this.quiet || this.pointer === 'touch' || this.pointer === 'mouse') return;
      const el = (e.target as Element).closest<HTMLElement>('[data-pick]');
      if (el) this.select(this.parse(el.dataset.pick!));
    });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      this.pointer = 'key';
      const stop = (): void => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (e.code === 'Escape' || e.code === 'KeyP') { stop(); this.back(); return; }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight' || e.code === 'KeyQ' || e.code === 'KeyE') { stop(); this.step(e.code === 'BracketRight' || e.code === 'KeyE' ? 1 : -1); return; }
      if (e.code.startsWith('Arrow')) { stop(); this.move(e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0, e.code === 'ArrowUp' ? -1 : e.code === 'ArrowDown' ? 1 : 0); return; }
      if (e.code === 'Tab') {
        const all = controls(this.root), i = all.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { stop(); all.at(-1)?.focus(); } else if (!e.shiftKey && i === all.length - 1) { stop(); all[0]?.focus(); }
        e.stopImmediatePropagation();
        return;
      }
      // Enter and Space press the focused button; nothing reaches the game or the pause menu (I, M) while trading.
      if (e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'F11') e.stopImmediatePropagation();
    }, { capture: true });
  }

  get open(): boolean { return !this.root.hidden; }

  /** Called every frame: shows the screen while the sim trades, polls the pad. `blocked`: a tutorial card on top. */
  update(sim: Sim, visible: boolean, blocked = false): void {
    this.sim = sim;
    const want = visible && sim.content.tradeOpen && tradeStock(sim).length > 0;
    if (want && !this.open) this.show(sim);
    else if (!want && this.open) this.root.hidden = true;
    if (this.open && !blocked) this.pollPad(performance.now());
  }

  private show(s: Sim): void {
    this.root.hidden = false;
    this.tab = 'waren';
    this.swapCard = -1;
    this.armed = -1;
    this.message = null;
    this.pick = this.firstPick(s);
    this.armedPick = false;
    // The press that opened the trade (pad A or the talk button) is still down.
    this.padDown = Array.from({ length: 20 }, () => true);
    this.pointer = this.input.device === 'gamepad' ? 'pad' : this.input.device === 'touch' ? 'touch' : 'mouse';
    this.render();
    this.focusFirst();
  }

  /** B, Escape, ×: out of a waiting swap first, else close. */
  back(): void {
    if (this.swapCard >= 0) { this.swapCard = -1; this.message = null; this.render('c-swap'); return; }
    this.close();
  }

  close(): void {
    if (!this.open) return;
    if (this.sim) closeTrade(this.sim);
    this.root.hidden = true;
    this.onClose();
  }

  private get shop(): boolean { return (this.sim?.content.tradeAt ?? -1) >= 0; }
  private tabs(): TabId[] { return this.shop ? ['waren', 'segen', 'verkaufen'] : ['waren', 'verkaufen']; }
  private step(d: number): void { const t = this.tabs(), i = t.indexOf(this.tab); this.setTab(t[(i + d + t.length) % t.length]!); }
  private setTab(t: TabId): void {
    if (t === this.tab) return;
    this.tab = t;
    this.swapCard = -1;
    this.armed = -1;
    const s = this.sim!;
    this.pick = t === 'verkaufen' ? (s.inventory.bag.length ? { k: 'bag', i: 0 } : null) : t === 'waren' ? this.firstPick(s) : null;
    this.armedPick = false;
    this.render();
    this.focusFirst();
  }
  private firstPick(s: Sim): Pick | null {
    const i = tradeStock(s).findIndex((o) => !!o);
    return i >= 0 ? { k: 'g', i } : tradeShop(s)?.mod ? { k: 'mod' } : { k: 'sup', id: 'heal' };
  }
  private parse(v: string): Pick {
    if (v.startsWith('g')) return { k: 'g', i: Number(v.slice(1)) };
    if (v.startsWith('b')) return { k: 'bag', i: Number(v.slice(1)) };
    if (v.startsWith('s-')) return { k: 'sup', id: v.slice(2) as SupId };
    return { k: 'mod' };
  }
  private same(p: Pick | null, q: Pick): boolean { return !!p && keyOf(p) === keyOf(q); }

  private click(e: MouseEvent): void {
    const s = this.sim;
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!s || !b || !this.root.contains(b)) return;
    const d = b.dataset;
    if (d.close) return this.close();
    if (d.ttab) return this.setTab(d.ttab as TabId);
    if (d.pick) {
      const p = this.parse(d.pick);
      // P5: a press on the picked tile buys (touch: the second tap; pad and keys: focus picks, A buys). A bag piece is only picked.
      if (this.same(this.pick, p) && this.armedPick && p.k !== 'bag') return this.act(() => this.buy(s, p), d.key);
      this.armed = -1;
      return this.select(p);
    }
    if (d.buy) { const p = this.pick; if (p) this.act(() => this.buy(s, p), d.key); return; }
    if (d.sell !== undefined) return this.sellAt(Number(d.sell), d.key);
    if (d.swapCancel) return this.back();
    if (d.equip !== undefined) return this.act(() => equipItem(s, Number(d.equip)) ? { ok: true, text: 'Angelegt.' } : { ok: false, text: '' }, d.key);
    if (d.bulk !== undefined) {
      const r = Number(d.bulk);
      // Rare pieces need a second press, as the inventory's bulk salvage.
      if (r >= 2 && this.armed !== r) { this.armed = r; this.message = { ok: false, text: 'Seltene Teile dabei. Nochmal drücken.' }; return this.render(d.key); }
      this.armed = -1;
      return this.act(() => sellBulk(s, r), d.key, () => { this.pick = s.inventory.bag.length ? { k: 'bag', i: 0 } : null; });
    }
    if (d.card !== undefined) return this.act(() => buyBlessing(s, Number(d.card)), d.key);
    if (d.swapStart !== undefined) { this.swapCard = Number(d.swapStart); this.message = { ok: true, text: 'Wähle den Segen, den du abgibst.' }; return this.render(); }
    if (d.swap) { const c = this.swapCard; this.swapCard = -1; return this.act(() => swapBlessing(s, c, d.swap as PerkId), d.key); }
    if (d.up) return this.act(() => strengthenBlessing(s, d.up as PerkId), d.key);
  }

  /** Sells bag piece `i`; the pick moves to the piece now at its place. */
  private sellAt(i: number, key?: string): void {
    const s = this.sim!;
    this.message = sellItem(s, i);
    const n = s.inventory.bag.length;
    this.pick = n ? { k: 'bag', i: Math.min(i, n - 1) } : null;
    this.render(key === 'sell' ? key : this.pick ? keyOf(this.pick) : undefined);
  }

  private buy(s: Sim, p: Pick): Result {
    if (p.k === 'g') return buyOffer(s, p.i);
    if (p.k === 'mod') return buyMod(s);
    if (p.k === 'sup') return p.id === 'heal' ? buyHeal(s) : p.id === 'dmg' || p.id === 'hp' ? buySpatiUpgrade(s, p.id) : buyConsumable(s, p.id);
    return { ok: false, text: '' };
  }
  private act(f: () => Result, key?: string, after?: () => void): void {
    this.message = f();
    after?.();
    this.render(key);
  }
  private select(p: Pick | null): void {
    this.pick = p;
    this.armedPick = true;
    const d = this.body.querySelector('.trade-detail');
    if (d && this.sim) d.innerHTML = this.detail(this.sim);
    this.mark();
  }
  private mark(): void {
    const k = this.pick ? keyOf(this.pick) : '';
    this.body.querySelectorAll<HTMLElement>('[data-pick]').forEach((el) => el.classList.toggle('sel', el.dataset.pick === k));
  }

  // ---------------------------------------------------------------- render

  private render(focusKey?: string): void {
    const s = this.sim;
    if (!s) return;
    const active = document.activeElement as HTMLElement | null;
    const key = focusKey ?? (active && this.root.contains(active) ? active.dataset.key : undefined);
    const shop = tradeShop(s), name = this.shop ? (s.level.rests[s.content.tradeAt]?.name ?? 'Späti') : 'Händler';
    const count: Record<TabId, number> = {
      waren: tradeStock(s).filter(Boolean).length + (shop?.mod ? 1 : 0),
      segen: (shop?.cards ?? []).filter(Boolean).length + (shop?.ups ?? 0),
      verkaufen: s.inventory.bag.length,
    };
    const tabs = this.tabs().map((t) => `<button type="button" class="menu-tabb${t === this.tab ? ' on' : ''}" data-ttab="${t}" data-key="tab-${t}" aria-pressed="${t === this.tab}">${TAB_NAME[t]}<small>${count[t]}</small></button>`).join('');
    this.head.innerHTML = `<div class="trade-name"><h2>${esc(name)}</h2><small>${this.shop ? '„Wat darf’s sein?“' : '„Schrott gegen Ware. Kein Feilschen.“'}</small></div><nav class="menu-tabs">${tabs}</nav><div class="menu-res"><span>${resIcon('scrap')}Schrott <b>${s.inventory.scrap}</b></span><span class="trade-life">Leben <b>${Math.round(s.player.hp)}/${Math.round(s.stats.maxHp)}</b></span></div>`;
    this.body.innerHTML = this.tab === 'segen' ? this.segen(s) : this.tab === 'verkaufen' ? this.verkaufen(s) : this.waren(s);
    this.body.dataset.ttab = this.tab;
    this.mark();
    this.msg.textContent = this.message?.text ?? '';
    this.msg.classList.toggle('positive', !!this.message?.ok);
    this.hint.innerHTML = `${PAD_HINT[this.tab]}<span><b>LB RB</b>Reiter</span><span><b>B</b>${this.swapCard >= 0 ? 'Abbrechen' : 'Zurück'}</span>`;
    this.quiet = true;
    if (key) this.root.querySelector<HTMLElement>(`[data-key="${key}"]:not(:disabled)`)?.focus();
    if (key && !this.root.contains(document.activeElement)) this.focusFirst();
    this.quiet = false;
  }

  private tile(pick: string, cell: string, name: string, price: string, can: boolean, extra = ''): string {
    return `<button type="button" class="trade-tile${can ? '' : ' poor'}" data-pick="${pick}" data-key="${pick}" aria-label="${esc(name)}">${cell}<span class="tn">${esc(name)}</span><span class="tp">${price}</span>${extra}</button>`;
  }
  private waren(s: Sim): string {
    const shop = tradeShop(s), cash = s.inventory.scrap;
    const cost = (v: number): string => `${resIcon('scrap')}${v}`;
    const gear = tradeStock(s).map((o, i) => {
      if (!o) return '<div class="trade-tile sold"><span class="inv-cell empty"></span><span class="tn">Verkauft</span></div>';
      const it = o.item, up = isUpgrade(it, s.equipment[it.slot]);
      return this.tile(`g${i}`, `<span class="inv-cell" style="--rarity:${color(it)}">${itemIcon(it)}<small>${shownLevel(it)}</small>${up ? '<b class="inv-up">▲</b>' : ''}</span>`, it.name, cost(o.price), cash >= o.price);
    }).join('');
    const m = shop?.mod ? WEAPON_MODS.find((x) => x.id === shop.mod!.id)! : null;
    const mod = shop ? (m ? this.tile('mod', `<span class="inv-cell" style="--rarity:${m.spati ? '#f2d14b' : '#7d9bff'}">${modIc(m.id)}</span>`, m.name, cost(modPrice(s, m.id)), cash >= modPrice(s, m.id)) : '<div class="trade-tile sold"><span class="inv-cell empty"></span><span class="tn">Verkauft</span></div>') : '';
    const sup = this.supplies(s).map((u) => this.tile(`s-${u.id}`, `<span class="inv-cell empty">${u.icon}${u.have ? `<small>${u.have}</small>` : ''}</span>`, u.name, u.full ? 'Voll' : cost(u.price), !u.full && cash >= u.price)).join('');
    return `<div class="trade-cols"><section class="trade-list"><h3>${shop ? 'Ausrüstung und Aufsatz' : 'Ausrüstung'}</h3><div class="trade-tiles">${gear}${mod}</div><h3>Vorräte</h3><div class="trade-tiles">${sup}</div></section><section class="trade-detail inv-detail">${this.detail(s)}</section></div>`;
  }
  private supplies(s: Sim): Array<{ id: SupId; name: string; text: string; have: string; price: number; full: boolean; icon: string }> {
    const out: Array<{ id: SupId; name: string; text: string; have: string; price: number; full: boolean; icon: string }> = [];
    if (this.shop) {
      for (const id of SPATI_UPGRADE.ids) {
        const u = CAMP_UPGRADES.find((q) => q.id === id)!, l = s.statContext.upgrades[id] ?? 0;
        out.push({ id, name: u.name, text: `+${u.perLevel}% ${id === 'dmg' ? 'Schaden' : 'Leben'}, bleibt. Mehr im Lager.`, have: `${l}/${SPATI_UPGRADE.max}`, price: spatiUpgradeCost(s, id), full: l >= SPATI_UPGRADE.max, icon: `<img src="${artUrl(RES_ICON.metall)}" alt="">` });
      }
      const cons = s.inventory.consumables ?? { verband: 0, molotow: 0 };
      for (const c of CONSUMABLES) out.push({ id: c.id, name: c.name, text: c.description, have: `${cons[c.id]}/3`, price: c.scrapCost, full: cons[c.id] >= 3, icon: c.id === 'verband' ? supplyIcon('verband', VERBAND) : supplyIcon('molotow', MOLOTOW) });
    }
    out.push({ id: 'heal', name: 'Verbandskasten', text: 'Heilt dich vollständig.', have: '', price: healPrice(s), full: s.player.hp >= s.stats.maxHp, icon: supplyIcon('heal', VERBAND) });
    return out;
  }

  private detail(s: Sim): string {
    const p = this.pick, cash = s.inventory.scrap;
    const button = (label: string, price: number | null, ok: boolean): string => `<div class="inv-actions"><button type="button" class="primary" data-buy="1" data-key="buy" ${ok ? '' : 'disabled'}>${price === null ? label : `${resIcon('scrap')}${label} · ${price}`}</button></div>`;
    if (!p) return `<p class="inv-hint">${this.tab === 'verkaufen' ? 'Der Rucksack ist leer.' : 'Tippe ein Angebot an.'}</p>`;
    if (p.k === 'g') {
      const o = tradeStock(s)[p.i];
      if (!o) return '<p class="inv-hint">Verkauft.</p>';
      const worn = s.equipment[o.item.slot];
      return `<div class="cmp2">${itemCard(o.item, 'Angebot', s.equipment)}${worn ? itemCard(worn, 'Angelegt', s.equipment, false) : `<article class="inv-card ceq" style="--rarity:#4c453a"><small class="clab">Angelegt</small><p class="inv-hint">${SLOT_NAMES[o.item.slot]}: nichts</p></article>`}</div>${button('Kaufen', o.price, cash >= o.price)}${this.pointer === 'touch' ? '<p class="inv-hint">Nochmal tippen: kaufen</p>' : ''}`;
    }
    if (p.k === 'mod') {
      const o = tradeShop(s)?.mod;
      if (!o) return '<p class="inv-hint">Verkauft.</p>';
      const m = WEAPON_MODS.find((x) => x.id === o.id)!, w = s.equipment.w, slots = modSlots(w), on = w?.mods?.length ?? 0, price = modPrice(s, m.id);
      const where = w && on < slots ? `Wird gleich in ${esc(w.name)} eingebaut.` : 'Kein Platz frei: kommt ins Inventar.';
      return `<article class="inv-card" style="--rarity:${m.spati ? '#f2d14b' : '#7d9bff'}"><small class="clab">Aufsatz${m.spati ? ' · stark, nur im Späti' : ''}</small><div class="inv-card-head"><span class="trade-ic">${modIc(m.id)}</span><div><h3>${esc(m.name)}</h3><p class="sub">Waffe ${on}/${slots} Aufsätze</p></div></div><p>${esc(m.description)}</p><p class="inv-hint">${where}</p></article>${button('Kaufen', price, cash >= price)}`;
    }
    if (p.k === 'sup') {
      const u = this.supplies(s).find((x) => x.id === p.id);
      if (!u) return '';
      return `<article class="inv-card" style="--rarity:#4c453a"><small class="clab">Vorrat</small><div class="inv-card-head"><span class="trade-ic">${u.icon}</span><div><h3>${esc(u.name)}</h3><p class="sub">${u.have ? `${u.have} dabei` : `Leben ${Math.round(s.player.hp)}/${Math.round(s.stats.maxHp)}`}</p></div></div><p>${esc(u.text)}</p></article>${u.full ? button(u.id === 'heal' ? 'Unverletzt' : 'Voll', null, false) : button('Kaufen', u.price, cash >= u.price)}`;
    }
    const it = s.inventory.bag[p.i];
    if (!it) return '<p class="inv-hint">Tippe ein Teil an.</p>';
    const worn = s.equipment[it.slot];
    return `<div class="cmp2">${itemCard(it, 'Rucksack', s.equipment)}${worn ? itemCard(worn, 'Angelegt', s.equipment, false) : ''}</div><div class="inv-actions"><button type="button" class="primary" data-sell="${p.i}" data-key="sell" ${it.locked ? 'disabled' : ''}>${resIcon('scrap')}Verkaufen +${scrapValue(it)}</button><button type="button" data-equip="${p.i}" data-key="equip">Anlegen</button></div><p class="inv-hint">Verkaufen zahlt wie Zerlegen, mit Material.</p>`;
  }

  private segen(s: Sim): string {
    const shop = tradeShop(s);
    if (!shop) return '';
    const cash = s.inventory.scrap, swapping = this.swapCard >= 0;
    const cards = (shop.cards ?? []).map((c, i) => {
      if (!c) return '<div class="tcard sold"><span>Vergeben</span></div>';
      const p = perkOf(c.id), q = Math.min(3, c.quality) as 0 | 1 | 2 | 3;
      const label = p.duo ? 'Doppelsegen' : c.level > 1 ? `${QUALITY[q]} · zwei Stufen` : 'Neu';
      const buy = blessPrice(s, 'buy', c), sw = blessPrice(s, 'swap');
      const on = swapping && this.swapCard === i;
      return `<div class="tcard${on ? ' on' : ''}" style="--qc:${QUALITY_COLOR[q]}" data-cardbox="${i}">${perkIcon(c.id, q)}<span class="prar">${label}</span><span class="pn">${esc(p.name)}</span><span class="pd">${esc(p.description)}</span><span class="tacts"><button type="button" class="primary" data-card="${i}" data-key="c-buy-${i}" ${cash >= buy && !swapping ? '' : 'disabled'}>${resIcon('scrap')}Kaufen · ${buy}</button><button type="button" data-swap-start="${i}" data-key="c-swap-${i}" ${cash >= sw && !swapping ? '' : 'disabled'}>⇄ Tauschen · ${sw}</button></span></div>`;
    }).join('') || '<p class="inv-hint">Heute keine neuen Segen.</p>';
    const card = swapping ? shop.cards?.[this.swapCard] ?? null : null;
    const up = blessPrice(s, 'up'), ups = shop.ups ?? 0, can = strengthenable(s);
    const held = PERKS.filter((p) => (s.statContext.perks[p.id] ?? 0) > 0).map((p) => {
      const l = s.statContext.perks[p.id] ?? 0, q = (s.abilities.quality[p.id] ?? 0) as 0 | 1 | 2 | 3;
      const pips = `<span class="sgd">${Array.from({ length: p.max }, (_, k) => `<i class="${k < l ? 'f' : ''}"></i>`).join('')}</span>`;
      if (card) {
        const why = swapBlock(s, p.id, card);
        return `<button type="button" class="trow pick" data-swap="${p.id}" data-key="h-${p.id}" ${why ? 'disabled' : ''}>${perkIcon(p.id, q)}<span><b>${esc(p.name)}</b>${pips}</span><small>${why ? esc(why) : `→ ${esc(perkOf(card.id).name)} ${Math.min(perkOf(card.id).max, Math.max(card.level, l))}`}</small></button>`;
      }
      const plus = can.includes(p.id) ? `<button type="button" data-up="${p.id}" data-key="h-${p.id}" ${ups && cash >= up ? '' : 'disabled'}>+1</button>` : '<small>voll</small>';
      return `<div class="trow">${perkIcon(p.id, q)}<span><b>${esc(p.name)}</b>${pips}</span>${plus}</div>`;
    }).join('') || '<p class="inv-hint">Noch keine Segen.</p>';
    const top = card ? `<p class="trade-swap">Tauschen gegen <b>${esc(perkOf(card.id).name)}</b>: wähle deinen Segen. Die Stufen gehen mit. <button type="button" data-key="c-swap" class="trade-cancel" data-swap-cancel="1">Abbrechen</button></p>`
      : `<p class="inv-hint">Stärkung: ein Segen +1 Stufe · ${resIcon('scrap')}${up} · ${ups ? 'noch 1' : 'heute keine mehr'}</p>`;
    return `<div class="trade-cols segen-cols"><section class="trade-list"><h3>Neue Segen · bis zum Ende der Expedition</h3><div class="trade-cards">${cards}</div></section><section class="trade-held inv-detail"><h3>Deine Segen</h3>${top}${held}</section></div>`;
  }

  private verkaufen(s: Sim): string {
    const bag = s.inventory.bag;
    const chips = ([['Gewöhnl.', 0], ['bis Magisch', 1], ['bis Selten', 2]] as const).map(([label, r], i) => {
      const v = bulkCandidates(s, r).reduce((a, it) => a + scrapValue(it), 0);
      return `<button type="button" class="chip${this.armed === r ? ' warn' : ''}" data-bulk="${r}" data-key="bulk-${i}" ${v ? '' : 'disabled'} style="color:${RARITIES[r].color}">${this.armed === r ? 'Sicher?' : label}<small>+${v}</small></button>`;
    }).join('');
    const cells = Array.from({ length: BAG_SIZE }, (_, i) => {
      const it = bag[i];
      if (!it) return '<div class="inv-cell empty" aria-hidden="true"></div>';
      return `<button type="button" class="inv-cell" data-pick="b${i}" data-key="b${i}" aria-label="${esc(it.name)}" style="--rarity:${color(it)}">${itemIcon(it)}<small>${shownLevel(it)}</small>${it.locked ? '<b class="inv-lock">◆</b>' : ''}${isUpgrade(it, s.equipment[it.slot]) ? '<b class="inv-up">▲</b>' : ''}</button>`;
    }).join('');
    return `<div class="trade-cols"><section class="trade-list"><div class="inv-bagh"><div class="lbl">Rucksack ${bag.length}/${BAG_SIZE}</div><div class="trade-bulk">${chips}</div></div><div class="inv-grid trade-bag">${cells}</div></section><section class="trade-detail inv-detail">${this.detail(s)}</section></div>`;
  }

  // ---------------------------------------------------------------- focus and pad

  private focusFirst(): void {
    const first = this.body.querySelector<HTMLElement>('.sel[data-pick]:not(:disabled)') ?? controls(this.body)[0] ?? this.head.querySelector<HTMLElement>('.on');
    first?.focus();
  }
  private move(dx: number, dy: number): void { moveFocus(this.root, dx, dy, () => this.focusFirst()); }

  private pollPad(now: number): void {
    const pad = activePad();
    this.root.classList.toggle('pad', !!pad);
    if (!pad) { this.padDown = []; return; }
    const down = pad.buttons.map((b) => b.pressed), prev = this.padDown, edge = (i: number): boolean => !!down[i] && !prev[i];
    this.padDown = down;
    const any = down.some((v, i) => v && !prev[i]) || Math.abs(pad.axes[0] ?? 0) > 0.5 || Math.abs(pad.axes[1] ?? 0) > 0.5;
    if (any) this.pointer = 'pad';
    if (edge(1)) { this.back(); return; }
    if (edge(4) || edge(5)) { this.step(edge(5) ? 1 : -1); return; }
    const a = document.activeElement as HTMLElement | null;
    const inside = !!a && this.root.contains(a);
    if (edge(0)) { if (inside) a!.click(); else this.focusFirst(); return; }
    // Y: swap on the focused card; X: sell the focused bag piece.
    if (edge(3) && inside) { const box = a!.closest<HTMLElement>('[data-cardbox]'); box?.querySelector<HTMLButtonElement>('[data-swap-start]:not(:disabled)')?.click(); return; }
    if (edge(2) && inside && a!.dataset.pick?.startsWith('b')) { this.sellAt(Number(a!.dataset.pick.slice(1))); return; }
    const dt = pollDt(now, this.stickLast);
    this.stickLast = now;
    stickScroll(scrollParent(inside ? a : this.body) ?? scrollParent(this.body), pad.axes[3] ?? 0, dt);
    if (now < this.padNext) return;
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const dx = down[14] || ax < -0.5 ? -1 : down[15] || ax > 0.5 ? 1 : 0, dy = down[12] || ay < -0.5 ? -1 : down[13] || ay > 0.5 ? 1 : 0;
    if (!dx && !dy) return;
    this.padNext = now + 170;
    this.move(dx, dy);
  }
}

const color = (i: Item): string => (i.set ? '#75d68a' : RARITIES[i.rarity].color);
