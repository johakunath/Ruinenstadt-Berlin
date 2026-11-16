// Combat UI (M8, M9, M16): the blessing choice, the action bar (power, ultimate, Verband, Molotow)
// with cooldowns, buff chips and the trader. One set of buttons serves mouse, pad and touch; on
// touch screens CSS moves them into the thumb arc around the attack button.
import { CONSUMABLES } from '../data/crafting';
import { WEAPON_KINDS } from '../data/items';
import { POWERS, type PowerDef } from '../data/powers';
import { FAMILIES, PERKS, SHRINES, type PerkFamilyId, type PerkId, type ShrineId } from '../data/progression';
import type { Input } from '../input/input';
import { cooldownOf, powerOf, selectPower, type Offer } from '../sim/abilities';
import { chooseBlessing, heldFamilies, perkOf, rerollBlessings, rerollCost } from '../sim/blessings';
import { buyConsumable, buyHeal, buyOffer, closeTrade, healPrice, tradeStock } from '../sim/runcontent';
import { heroStats, power } from '../sim/stats';
import type { Sim } from '../sim/types';
import { FAMILY_GLYPHS, PERK_GLYPHS, POWER_GLYPHS } from './glyphs';
import { itemCard } from './inventory';

const QUALITY_COLOR = ['#e8ddd0', '#7d9bff', '#f2d14b', '#b48cff'] as const;
const VERBAND = '<path d="M9 21h30v8H9z" fill="#ead9c0"/><path d="M20 10h8v28h-8z" fill="#ead9c0"/><path d="M21 18h6v12h-6zM16 22h16v4H16z" fill="#c23a2e"/>';
const MOLOTOW = '<path d="M19 20h10l3 7v13a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V27z" fill="#6a8a5a"/><path d="M21 12h6v8h-6z" fill="#8a9a7a"/><path d="M24 2c4 4 4 7 1 10-4-2-4-6-1-10z" fill="#ff8a3d"/><path d="M17 30h14v6H17z" fill="#c9b58c"/>';
const SWAP = '<path d="M14 18h20l-5-5M34 30H14l5 5" fill="none" stroke="#ead9c0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';
const svg = (body: string, box = 48): string => `<svg viewBox="0 0 ${box} ${box}" aria-hidden="true">${body}</svg>`;

/** Hex badge with a blessing glyph (2D `pIcon`). */
export function perkIcon(id: PerkId, quality = 0): string {
  const g = PERK_GLYPHS[id] ?? PERK_GLYPHS.dmg!;
  const stroke = g[1] === 's';
  return `<svg class="perk-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 1.5L29 9v14l-13 7.5L3 23V9z" fill="#1c140f" stroke="${QUALITY_COLOR[quality]}" stroke-width="2"/><g transform="translate(6 6) scale(.8333)" fill="${stroke ? 'none' : g[0]}" stroke="${stroke ? g[0] : 'none'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${g[2]}</g></svg>`;
}
const familyIcon = (f: PerkFamilyId, on: boolean): string => `<svg class="fam${on ? ' on' : ''}" viewBox="0 0 24 24" role="img" aria-label="${FAMILIES[f].name}" style="--fc:${FAMILIES[f].color}">${FAMILY_GLYPHS[f][1]}</svg>`;

interface Action { el: HTMLButtonElement; cd: HTMLElement; key: HTMLElement; icon: HTMLElement; count: HTMLElement; last: string }
type ActionId = 'power' | 'ultimate' | 'verband' | 'molotow' | 'swap';
const KEYS: Record<'keyboard' | 'gamepad', Record<ActionId, string>> = {
  keyboard: { power: 'E', ultimate: 'R', verband: 'Q', molotow: 'G', swap: 'X' },
  gamepad: { power: 'B', ultimate: 'LB', verband: '◀', molotow: '▶', swap: '▲' },
};

export class AbilitiesUi {
  readonly panel = document.createElement('div');
  readonly bar = document.createElement('div');
  readonly buffs = document.createElement('div');
  readonly trade = document.createElement('div');
  onChoose: () => void = () => {};
  /** The trade screen closed (the loop resumes the sim). */
  onTradeClose: () => void = () => {};
  private readonly actions = {} as Record<ActionId, Action>;
  private signature = '';
  private tradeSig = '';
  private tradeMsg = '';
  private buffSig = '';
  private sim: Sim | null = null;
  private padDown: boolean[] = [];
  private choices: HTMLButtonElement[] = [];
  private selection = 0;
  private openedAt = 0;

  constructor(private readonly input: Input) {
    this.panel.id = 'blessings';
    this.panel.className = 'overlay';
    this.panel.hidden = true;
    this.panel.innerHTML = '<div class="panel bless"><h2 id="bless-title"></h2><p class="sub" id="bless-sub"></p><div id="blessing-choices"></div><div id="bless-foot"><div id="bless-build"></div><button id="bless-reroll" type="button"></button></div></div>';
    this.bar.id = 'actions';
    this.bar.hidden = true;
    this.buffs.id = 'buffs';
    this.buffs.hidden = true;
    this.trade.id = 'trade';
    this.trade.className = 'overlay';
    this.trade.hidden = true;
    this.trade.innerHTML = '<div class="panel trade"></div>';
    document.body.append(this.bar, this.buffs, this.panel, this.trade);

    const make = (id: ActionId, label: string): void => {
      const el = document.createElement('button');
      el.type = 'button';
      el.id = `btn-${id}`;
      el.className = 'act';
      el.setAttribute('aria-label', label);
      el.innerHTML = '<span class="act-icon"></span><span class="act-cd"></span><b class="act-count"></b><i class="act-key"></i>';
      const q = (c: string): HTMLElement => el.querySelector(c) as HTMLElement;
      this.actions[id] = { el, cd: q('.act-cd'), key: q('.act-key'), icon: q('.act-icon'), count: q('.act-count'), last: '' };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (id === 'swap') this.swap();
        else this.input.press(id, e.pointerType === 'touch' ? 'touch' : 'mouse');
      });
      this.bar.append(el);
    };
    make('verband', 'Verband');
    make('molotow', 'Molotow');
    make('power', 'Kraft');
    make('swap', 'Kraft wechseln');
    make('ultimate', 'Ultimative Kraft');
    this.actions.verband.icon.innerHTML = svg(VERBAND);
    this.actions.molotow.icon.innerHTML = svg(MOLOTOW);
    this.actions.swap.icon.innerHTML = svg(SWAP);
    this.input.onSwap = () => this.swap();

    this.panel.querySelector('#bless-reroll')!.addEventListener('click', () => this.reroll());
    window.addEventListener('keydown', (e) => {
      if (this.tradeOpen) {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.closeTrade();
        }
        return;
      }
      if (!this.open) return;
      if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Tab'].includes(e.code)) {
        e.preventDefault();
        this.focus(this.selection + (e.code === 'ArrowLeft' || e.code === 'ArrowUp' || e.shiftKey ? -1 : 1));
      } else if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) this.pick(Number(e.code.slice(-1)) - 1);
      else if (e.code === 'KeyN') this.reroll();
    }, { capture: true });
    this.trade.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button');
      const s = this.sim;
      if (!b || !s) return;
      if (b.dataset.buy !== undefined) this.tradeMsg = buyOffer(s, Number(b.dataset.buy)).text;
      else if (b.dataset.heal) this.tradeMsg = buyHeal(s).text;
      else if (b.dataset.cons) this.tradeMsg = buyConsumable(s, b.dataset.cons as 'verband' | 'molotow').text;
      else if (b.dataset.close) return this.closeTrade();
      this.tradeSig = '';
    });
  }

  get open(): boolean { return !this.panel.hidden; }
  get tradeOpen(): boolean { return !this.trade.hidden; }

  private swap(): void {
    const s = this.sim;
    if (s && this.input.enabled) selectPower(s, s.equipment.w?.power === 1 ? 0 : 1);
  }
  private focus(n: number): void {
    if (!this.choices.length) return;
    this.selection = (n + this.choices.length) % this.choices.length;
    this.choices[this.selection]?.focus();
  }
  /** A card cannot be taken in the first moment: a held attack button must not pick blindly. */
  private pick(i: number): void {
    if (performance.now() - this.openedAt < 350) return;
    this.choices[i]?.click();
  }
  private reroll(): void {
    if (this.sim && rerollBlessings(this.sim)) this.signature = '';
  }
  private closeTrade(): void {
    if (this.sim) closeTrade(this.sim);
    this.trade.hidden = true;
    this.tradeMsg = '';
    this.onTradeClose();
  }

  private card(s: Sim, o: Offer, i: number, held: Set<PerkFamilyId>): HTMLButtonElement {
    const p = perkOf(o.id);
    const fams = p.duo ?? p.families ?? [];
    const have = s.statContext.perks[o.id] ?? 0;
    const cls = p.duo ? 'duo' : p.weapon ? 'mod' : o.quality === 2 ? 'ep' : o.quality === 1 ? 'ra' : '';
    const rarity = p.duo ? 'Doppelsegen' : p.weapon ? `Umbau · ${WEAPON_KINDS[p.weapon].name}` : o.level > 1 ? (o.quality === 2 ? 'Episch · zwei Stufen' : 'Selten · zwei Stufen') : 'Gewöhnlich';
    const level = p.duo || p.weapon ? 'Einmalig' : have ? `Stufe ${have + o.level} von ${p.max}` : o.level > 1 ? `Neu · Stufe 2 von ${p.max}` : p.max > 1 ? `Neu · bis Stufe ${p.max}` : 'Neu';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pcard ${cls}${!p.duo && fams.some((f) => held.has(f)) ? ' fon' : ''}`;
    const fc = p.weapon ? '#b48cff' : fams.length ? FAMILIES[fams[0]!].color : '#6a5a48';
    b.style.setProperty('--fc', fc);
    b.style.setProperty('--i', String(i));
    b.innerHTML = `<span class="pnum">${i + 1}</span><span class="pfam">${fams.map((f) => familyIcon(f, p.duo ? true : held.has(f))).join('')}</span>${perkIcon(o.id, o.quality)}<span class="prar">${rarity}</span><span class="pn">${p.name}</span><span class="pd">${p.description}</span><span class="pl">${level}</span>`;
    b.addEventListener('click', () => {
      if (performance.now() - this.openedAt < 350) return;
      if (this.sim && chooseBlessing(this.sim, o.id)) this.onChoose();
    });
    return b;
  }

  private renderBlessings(s: Sim): void {
    const a = s.abilities;
    const held = heldFamilies(s);
    const host = this.panel.querySelector('#blessing-choices')!;
    host.replaceChildren();
    this.choices = a.offers.map((o, i) => {
      const b = this.card(s, o, i, held);
      host.append(b);
      return b;
    });
    const found = s.content.hidden.filter((h) => h.got).length;
    this.panel.querySelector('#bless-title')!.textContent = a.hiddenOffer ? 'Versteckter Segen' : 'Wähle einen Segen';
    this.panel.querySelector('#bless-sub')!.textContent = a.hiddenOffer ? `${found} von ${s.content.hidden.length} gefunden` : 'Gilt bis zum Ende der Expedition';
    const mine = PERKS.filter((p) => (s.statContext.perks[p.id] ?? 0) > 0);
    this.panel.querySelector('#bless-build')!.innerHTML = mine.length
      ? mine.map((p) => `<span class="held" title="${p.name}">${perkIcon(p.id, a.quality[p.id] ?? 0)}${p.max > 1 ? `<i>${s.statContext.perks[p.id]}</i>` : ''}</span>`).join('')
      : '<span class="held-none">Noch kein Segen</span>';
    const rr = this.panel.querySelector('#bless-reroll') as HTMLButtonElement;
    const cost = rerollCost(s);
    rr.textContent = `Neu würfeln · ${cost} Schrott`;
    rr.disabled = a.rerolled || s.inventory.scrap < cost;
    this.selection = 0;
  }

  private renderTrade(s: Sim): void {
    const stock = tradeStock(s);
    const shop = s.content.tradeAt >= 0;
    const cons = s.inventory.consumables ?? { verband: 0, molotow: 0 };
    const now = power(s.stats);
    const offers = stock.map((o, i) => {
      if (!o) return '<div class="trade-sold">Verkauft</div>';
      let delta = 0;
      try { delta = power(heroStats({ ...s.equipment, [o.item.slot]: o.item }, s.statContext)) - now; } catch { delta = 0; }
      return `<div class="trade-offer">${itemCard(o.item, 'Angebot', s.equipment)}<div class="trade-delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">Kampfkraft ${delta > 0 ? '+' : ''}${delta}</div><button type="button" data-buy="${i}" class="${s.inventory.scrap >= o.price ? 'primary' : ''}">Kaufen · ${o.price} Schrott</button></div>`;
    }).join('');
    const goods = shop ? CONSUMABLES.map((c) => `<div class="trade-row"><span><b>${c.name}</b> <small>${cons[c.id as 'verband' | 'molotow']}/3</small><br><small>${c.description}</small></span><button type="button" data-cons="${c.id}" ${cons[c.id as 'verband' | 'molotow'] >= 3 ? 'disabled' : ''}>${c.scrapCost} Schrott</button></div>`).join('') : '';
    this.trade.firstElementChild!.innerHTML = `<button type="button" class="x-btn" data-close="1" aria-label="Schließen">×</button><h2>${shop ? (s.level.rests[s.content.tradeAt]?.name ?? 'Späti') : 'Händler'}</h2><p class="sub">${shop ? '„Wat darf’s sein?“' : '„Schrott gegen Ware. Kein Feilschen.“'} · Schrott <b>${s.inventory.scrap}</b></p><div class="trade-offers">${offers}</div>${goods}`
      + `<div class="trade-row"><span><b>Verbandskasten</b><br><small>Heilt dich vollständig</small></span><button type="button" data-heal="1">${healPrice(s)} Schrott</button></div><p class="trade-msg">${this.tradeMsg}</p>`;
  }

  private setAction(id: ActionId, iconHtml: string | null, cd: number, max: number, count: number | null, usable: boolean, key: string): void {
    const A = this.actions[id];
    const sig = `${iconHtml?.length ?? 0}|${cd > 0 ? Math.ceil(cd * 10) : 0}|${count}|${usable}|${key}`;
    if (sig === A.last) return;
    A.last = sig;
    if (iconHtml !== null && A.icon.dataset.sig !== String(iconHtml.length) + iconHtml.slice(0, 40)) {
      A.icon.dataset.sig = String(iconHtml.length) + iconHtml.slice(0, 40);
      A.icon.innerHTML = iconHtml;
    }
    A.el.style.setProperty('--cd', String(max > 0 ? Math.min(1, cd / max) : 0));
    A.cd.textContent = cd > 0 ? (cd < 10 ? cd.toFixed(1) : String(Math.ceil(cd))) : '';
    A.count.textContent = count === null ? '' : String(count);
    A.el.classList.toggle('off', !usable);
    A.el.classList.toggle('ready', usable && cd <= 0);
    A.key.textContent = key;
  }

  update(sim: Sim, visible: boolean): void {
    this.sim = sim;
    const a = sim.abilities;
    const wasOpen = this.open;
    const signature = a.offers.map((o) => `${o.id}${o.level}`).join(',');
    this.panel.hidden = !visible || !a.offers.length;
    if (this.open && (signature !== this.signature || !wasOpen)) {
      this.signature = signature;
      this.renderBlessings(sim);
    }
    if (!this.open) this.signature = '';
    if (this.open && !wasOpen) {
      this.openedAt = performance.now();
      this.focus(0);
    }

    const tradeNow = visible && sim.content.tradeOpen && tradeStock(sim).length > 0;
    if (tradeNow) {
      const sig = `${sim.inventory.scrap}|${tradeStock(sim).map((o) => (o ? 1 : 0)).join('')}|${Math.round(sim.player.hp)}|${this.tradeMsg}|${sim.inventory.consumables?.verband}${sim.inventory.consumables?.molotow}`;
      const first = this.trade.hidden;
      this.trade.hidden = false;
      if (sig !== this.tradeSig) {
        this.tradeSig = sig;
        this.renderTrade(sim);
        if (first) (this.trade.querySelector('[data-close]') as HTMLElement | null)?.focus();
      }
    } else if (!this.trade.hidden) {
      this.trade.hidden = true;
      this.tradeSig = '';
    }

    const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
    const down = pad?.buttons.map((b) => b.pressed) ?? [];
    const edge = (i: number): boolean => !!down[i] && !this.padDown[i];
    if (this.open) {
      if (edge(14) || edge(12)) this.focus(this.selection - 1);
      if (edge(15) || edge(13)) this.focus(this.selection + 1);
      if (edge(0)) this.pick(this.selection);
      if (edge(3)) this.reroll();
    } else if (this.tradeOpen) {
      const buttons = [...this.trade.querySelectorAll<HTMLButtonElement>('button')];
      const at = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
      if (edge(14) || edge(12)) buttons[(at - 1 + buttons.length) % buttons.length]?.focus();
      if (edge(15) || edge(13)) buttons[(at + 1) % buttons.length]?.focus();
      if (edge(0)) (document.activeElement as HTMLElement | null)?.click();
      if (edge(1)) this.closeTrade();
    }
    this.padDown = down;

    const show = visible && !this.open && !this.tradeOpen;
    this.bar.hidden = !show;
    this.buffs.hidden = !show;
    if (!show) return;
    const keys = this.input.device === 'gamepad' ? KEYS.gamepad : this.input.device === 'touch' ? null : KEYS.keyboard;
    const k = (id: ActionId): string => keys?.[id] ?? '';
    const pw = powerOf(sim, false), ul = powerOf(sim, true);
    const def = (d: PowerDef): string => svg(POWER_GLYPHS[d.id]);
    this.actions.power.el.title = `${pw.name} · ${pw.description}`;
    this.actions.ultimate.el.title = `${ul.name} · ${ul.description}`;
    this.setAction('power', def(pw), a.powerCd, cooldownOf(sim, pw), null, true, k('power'));
    this.setAction('ultimate', def(ul), a.ultimateCd, cooldownOf(sim, ul), null, true, k('ultimate'));
    const other = POWERS[sim.stats.kind][sim.equipment.w?.power === 1 ? 0 : 1];
    this.actions.swap.el.title = `Wechseln zu ${other.name}`;
    this.setAction('swap', null, 0, 0, null, true, k('swap'));
    const cons = sim.inventory.consumables ?? { verband: 0, molotow: 0 };
    this.actions.verband.el.title = CONSUMABLES[0]!.description;
    this.actions.molotow.el.title = CONSUMABLES[1]!.description;
    this.setAction('verband', null, a.hot, 3, cons.verband, cons.verband > 0, k('verband'));
    this.setAction('molotow', null, 0, 0, cons.molotow, cons.molotow > 0, k('molotow'));

    // Buff chips: only what is running, with seconds.
    const chips: Array<[string, string, number]> = [];
    if (a.frenzy > 0) chips.push(['Säbeltanz', '#ff4a3a', a.frenzy]);
    if (a.guard > 0) chips.push(['Deckung', '#9aa4b0', a.guard]);
    if (a.banner) chips.push(['Standarte', '#f2d14b', a.banner.t]);
    if (a.fed > 0) chips.push(['Satt', '#f2a04b', a.fed]);
    if (a.hot > 0) chips.push(['Verband', '#8fd16a', a.hot]);
    if (a.hus > 0 && (sim.statContext.perks.husar ?? 0) > 0) chips.push(['Husarenritt', '#9fd8c8', a.hus]);
    if (a.jagd.n > 0) chips.push([`Jagdfieber ×${a.jagd.n}`, '#e05050', a.jagd.t]);
    if (a.streak.n >= 5) chips.push([`Serie ${a.streak.n}`, '#e05050', a.streak.t]);
    if (a.ret) chips.push(['Retourkutsche', '#9aa4b0', 0]);
    for (const id of Object.keys(sim.content.shrine) as ShrineId[]) if ((sim.content.shrine[id] ?? 0) > 0) chips.push([SHRINES[id].name, '#7dd3ff', sim.content.shrine[id]!]);
    const sig = chips.map(([n, , t]) => `${n}${Math.ceil(t)}`).join('|');
    if (sig !== this.buffSig) {
      this.buffSig = sig;
      this.buffs.innerHTML = chips.map(([n, c, t]) => `<span class="buff" style="--c:${c}">${n}${t > 0 ? ` <b>${Math.ceil(t)}</b>` : ''}</span>`).join('');
    }
  }
}
