// M13: the camp as a menu between expeditions (Q11). One station window as in 2D `renderStn`
// (js/panels.js), a station list instead of the walkable camp. Rules live in `src/sim/camp.ts`.
import { STATIONS, type StationId } from '../data/camp';
import { CONSUMABLES, INGREDIENTS, MATERIALS, MEALS, WEAPON_MODS, type IngredientId, type MaterialId, type WeaponModId } from '../data/crafting';
import { CAMP_UPGRADES, type CampUpgradeId } from '../data/progression';
import { DRILL } from '../data/progression';
import { CONSUMABLE } from '../sim/abilities';
import { buildMod, buildStation, buyDrill, buyUpgrade, campOf, cookMeal, craftConsumable, drillCost, fromStash, installMod, modScrap, modSlots, nextLevel, npcHere, npcName, removeMod, stashMax, stationLevel, toStash, upgradeCost, upgradeMax, type Result } from '../sim/camp';
import { RARITIES } from '../data/items';
import { BAG_SIZE } from '../sim/inventory';
import type { Item } from '../sim/items';
import type { Sim } from '../sim/types';
import { esc, itemIcon } from './inventory';

const MAT_IDS: MaterialId[] = ['metall', 'stoff', 'kabel', 'chemie'];
const ING_IDS: IngredientId[] = ['fleisch', 'gemuese', 'gewuerz'];
const UPG_TEXT: Record<CampUpgradeId, (l: number) => string> = { dmg: l => `+${l * 7}% Schaden`, hp: l => `+${l * 5}% Leben`, dash: l => `−${l * 8}% Sprint-Abklingzeit`, luck: l => `+${l} Beuteglück` };
const pips = (l: number, max: number, cap = max): string => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < l ? 'f' : i >= cap ? 'x' : ''}"></i>`).join('')}</span>`;

export class CampUi {
  readonly root = document.createElement('div');
  private sel: StationId = 'zeug';
  private msg: Result | null = null;
  private previous: HTMLElement | null = null;
  private padDown: boolean[] = [];
  private padNext = 0;

  constructor(private readonly sim: () => Sim, private readonly onClose: () => void) {
    this.root.id = 'camp';
    this.root.className = 'overlay';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Lager');
    document.body.append(this.root);
    this.root.addEventListener('click', e => {
      const b = (e.target as Element).closest<HTMLElement>('button');
      if (!b) return;
      const d = b.dataset, s = this.sim();
      if (d.close !== undefined) { this.close(); return; }
      if (d.st) { this.sel = d.st as StationId; this.msg = null; this.render(); this.root.querySelector<HTMLElement>(`[data-st="${d.st}"]`)?.focus(); return; }
      this.msg = d.up ? buyUpgrade(s, d.up as CampUpgradeId) : d.lv ? buildStation(s, d.lv as StationId) : d.drill ? buyDrill(s) : d.meal ? cookMeal(s, d.meal as never)
        : d.cons ? craftConsumable(s, d.cons as never) : d.mb ? buildMod(s, d.mb as WeaponModId) : d.mi ? installMod(s, d.mi as WeaponModId) : d.mo ? removeMod(s, d.mo as WeaponModId)
        : d.ts !== undefined ? toStash(s, +d.ts) : d.fs !== undefined ? fromStash(s, +d.fs) : null;
      const key = Object.entries(d).map(([k, v]) => `[data-${k}="${v}"]`).join('');
      this.render();
      (this.root.querySelector<HTMLElement>(key) ?? this.root.querySelector<HTMLElement>(`[data-st="${this.sel}"]`))?.focus();
    });
    this.root.addEventListener('keydown', e => { if (e.code === 'Escape') { e.stopPropagation(); this.close(); } });
  }
  get isOpen(): boolean { return !this.root.hidden; }
  open(): void {
    this.previous = document.activeElement as HTMLElement;
    this.msg = null; this.root.hidden = false; this.render();
    this.root.querySelector<HTMLElement>(`[data-st="${this.sel}"]`)?.focus();
  }
  close(): void { if (!this.isOpen) return; this.root.hidden = true; this.previous?.focus?.(); this.onClose(); }
  /** Pad: D-pad/stick moves (nearest button in that direction), A presses, B closes. */
  pollPad(now: number): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(p => p?.connected);
    if (!pad) { this.padDown = []; return; }
    const down = pad.buttons.map(b => b.pressed), prev = this.padDown, edge = (i: number): boolean => !!down[i] && !prev[i];
    this.padDown = down;
    if (!this.isOpen) return;
    if (edge(1)) { this.close(); return; }
    if (edge(0)) { const a = document.activeElement as HTMLElement | null; if (a && this.root.contains(a)) a.click(); return; }
    if (now < this.padNext) return;
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const dx = down[14] || ax < -.5 ? -1 : down[15] || ax > .5 ? 1 : 0, dy = down[12] || ay < -.5 ? -1 : down[13] || ay > .5 ? 1 : 0;
    if (!dx && !dy) return;
    this.padNext = now + 170;
    const cur = document.activeElement as HTMLElement | null;
    const all = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled)')];
    if (!cur || !this.root.contains(cur)) { all[0]?.focus(); return; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best: HTMLElement | null = null, bs = Infinity;
    for (const b of all) { if (b === cur) continue; const q = b.getBoundingClientRect(), vx = q.left + q.width / 2 - cx, vy = q.top + q.height / 2 - cy, along = vx * dx + vy * dy; if (along <= 2) continue; const sc = along + Math.abs(dx ? vy : vx) * 2.5; if (sc < bs) { bs = sc; best = b; } }
    best?.focus(); best?.scrollIntoView({ block: 'nearest' });
  }
  render(): void {
    const s = this.sim(), st = STATIONS.find(t => t.id === this.sel)!, l = stationLevel(s, st.id), n = nextLevel(s, st.id), here = npcHere(s, st);
    const mats = MAT_IDS.map(k => `<span style="color:${MATERIALS[k].color}">${MATERIALS[k].name} <b>${s.inventory.materials[k] ?? 0}</b></span>`).join('');
    const ings = ING_IDS.map(k => `<span style="color:${INGREDIENTS[k].color}">${INGREDIENTS[k].name} <b>${s.inventory.ingredients?.[k] ?? 0}</b></span>`).join('');
    const list = STATIONS.map(t => `<button type="button" class="stl${t.id === this.sel ? ' on' : ''}" data-st="${t.id}"><b>${t.name}</b>${pips(stationLevel(s, t.id), 3)}</button>`).join('');
    const cost = (c: Partial<Record<MaterialId | 'scrap', number>>): string => (Object.entries(c) as Array<[MaterialId | 'scrap', number]>).map(([k, v]) => `<span class="${(k === 'scrap' ? s.inventory.scrap : s.inventory.materials[k] ?? 0) >= v ? '' : 'negative'}">${v} ${k === 'scrap' ? 'Schrott' : MATERIALS[k].name}</span>`).join(' · ');
    const next = !n ? '<p class="inv-hint">Voll ausgebaut.</p>' : `<h3>Ausbau auf Stufe ${n.level}</h3><div class="row-c"><div><b>${n.text}</b><small>${cost(n.cost)}</small>${n.needs.length ? `<small class="warn">Erst: ${n.needs.join(', ')}</small>` : ''}</div><button type="button" class="${n.ok ? 'primary' : ''}" data-lv="${st.id}" ${n.needs.length ? 'disabled' : ''}>Ausbauen</button></div>`;
    this.root.innerHTML = `<div class="camp-panel"><header class="menu-head"><h2>Lager</h2><div class="menu-res"><span>Schrott <b>${s.inventory.scrap}</b></span>${mats}${ings}</div><button type="button" class="menu-x" data-close aria-label="Zurück">×</button></header><div class="camp-cols"><nav class="camp-list">${list}</nav><section class="camp-st"><div class="sthead"><div><h2>${st.name}</h2><p class="inv-hint">${here ? `${npcName(st)} · ${st.line}` : `Noch niemand hier. ${npcName(st)} ist irgendwo da draußen gefangen.`}</p><p>${pips(l, 3)} Stufe ${l} von 3 · <span class="inv-hint">${st.levels.slice(0, l).map(L => L.text).join(' · ')}</span></p></div></div><div class="camp-body">${this.body(s)}</div>${next}<p class="camp-msg ${this.msg?.ok ? 'positive' : 'negative'}" aria-live="polite">${esc(this.msg?.text ?? '')}</p></section></div></div>`;
  }
  private upRows(s: Sim, ids: CampUpgradeId[]): string {
    return ids.map(id => {
      const u = CAMP_UPGRADES.find(x => x.id === id)!, l = s.statContext.upgrades[id] ?? 0, mx = upgradeMax(s, id), c = upgradeCost(s, id);
      return `<div class="row-c"><div><b>${u.name}</b><small>${UPG_TEXT[id](l)}${l < mx ? ` → ${UPG_TEXT[id](l + 1)}` : ''}</small>${pips(l, u.max, mx)}</div>${l >= u.max ? '<small>Maximal</small>' : l >= mx ? '<small>Station ausbauen</small>' : `<button type="button" class="${s.inventory.scrap >= c ? 'primary' : ''}" data-up="${id}">${c} Schrott</button>`}</div>`;
    }).join('');
  }
  private body(s: Sim): string {
    switch (this.sel) {
      case 'zeug': return this.upRows(s, ['dmg']) + this.mods(s);
      case 'hack': return this.upRows(s, ['hp']);
      case 'exer': { const d = s.statContext.drill ?? 0, c = drillCost(s); return this.upRows(s, ['dash', 'luck']) + `<div class="row-c"><div><b>Drill · Rang ${d}</b><small>+${Math.round(d * DRILL.damage * 100)}% Schaden, +${Math.round(d * DRILL.life * 100)}% Leben · ohne Obergrenze</small></div><button type="button" class="${s.inventory.scrap >= c ? 'primary' : ''}" data-drill="1">${c} Schrott</button></div>`; }
      case 'imbiss': return MEALS.map(m => {
        const on = s.statContext.meal === m.id, lock = !!m.requiredBuilding && !s.statContext.camp[m.requiredBuilding];
        const ok = Object.entries(m.costs).every(([k, v]) => (s.inventory.ingredients?.[k as IngredientId] ?? 0) >= v);
        return `<div class="row-c"><div><b class="${on ? 'positive' : ''}">${m.name}${on ? ' · gekocht' : ''}</b><small>${m.description}${lock ? ' · ab Stufe 2' : ''}</small><small>${Object.entries(m.costs).map(([k, v]) => `<span class="${(s.inventory.ingredients?.[k as IngredientId] ?? 0) >= v || on ? '' : 'negative'}">${v} ${INGREDIENTS[k as IngredientId].name}</span>`).join(' · ')}</small></div><button type="button" class="${!on && ok && !lock ? 'primary' : ''}" data-meal="${m.id}" ${lock ? 'disabled' : ''}>${on ? 'Abbestellen' : 'Kochen'}</button></div>`;
      }).join('') + '<p class="inv-hint">Ein Essen hält eine Expedition lang. Zutaten fallen von Gegnern.</p>';
      case 'laz': return CONSUMABLES.map(c => { const n = s.inventory.consumables?.[c.id] ?? 0; return `<div class="row-c"><div><b>${c.name}</b><small>${c.id === 'verband' && stationLevel(s, 'laz') >= 3 ? 'Heilt 60% Leben über 3 Sekunden' : c.description} · ${n}/${CONSUMABLE.max} dabei</small></div>${n >= CONSUMABLE.max ? '<small>Voll</small>' : `<button type="button" class="${s.inventory.scrap >= c.scrapCost ? 'primary' : ''}" data-cons="${c.id}">${c.scrapCost} Schrott</button>`}</div>`; }).join('');
      case 'kom': { const c = campOf(s); return `<div class="row-c"><div><b>Befreite Bezirke</b><small>${c.freed.includes(0) ? 'Köpenick' : 'Noch keiner'}</small></div></div><p class="inv-hint">Ilse hält Funkkontakt. Ein befreiter Bezirk öffnet Stufe 3 aller Stationen.</p>`; }
      case 'markt': return this.stash(s);
    }
  }
  private mods(s: Sim): string {
    const w = s.equipment.w, slots = modSlots(w), on = w?.mods ?? [];
    const rows = WEAPON_MODS.map(m => {
      const n = s.inventory.mods[m.id] ?? 0, inW = on.includes(m.id);
      const act = inW ? `<button type="button" data-mo="${m.id}">Ausbauen</button>` : n > 0 ? `<button type="button" class="primary" data-mi="${m.id}" ${on.length >= slots ? 'disabled' : ''}>Einbauen</button>` : '';
      return `<div class="row-c"><div><b>${m.name}${inW ? ' · eingebaut' : n ? ` · ${n} da` : ''}</b><small>${m.description}</small><small>${modScrap(s, m.id)} Schrott · ${(Object.entries(m.costs) as Array<[MaterialId, number]>).map(([k, v]) => `<span class="${(s.inventory.materials[k] ?? 0) >= v ? '' : 'negative'}">${v} ${MATERIALS[k].name}</span>`).join(' · ')}</small></div><span class="row-b"><button type="button" data-mb="${m.id}">Bauen</button>${act}</span></div>`;
    }).join('');
    return `<h3>Aufsätze · ${esc(w?.name ?? 'keine Waffe')} ${on.length}/${slots}</h3>${rows}`;
  }
  private stash(s: Sim): string {
    const c = campOf(s), cell = (it: Item | undefined, attr: string): string => it ? `<button type="button" class="inv-cell" ${attr} aria-label="${esc(it.name)}" style="--rarity:${it.set ? '#75d68a' : RARITIES[it.rarity].color}">${itemIcon(it)}<small>${it.itemLevel}</small></button>` : '<div class="inv-cell empty"></div>';
    return `<h3>Rucksack ${s.inventory.bag.length}/${BAG_SIZE} · antippen legt ins Lager</h3><div class="inv-grid">${Array.from({ length: BAG_SIZE }, (_, i) => cell(s.inventory.bag[i], `data-ts="${i}"`)).join('')}</div><h3>Lager ${c.stash.length}/${stashMax(s)} · antippen nimmt mit</h3><div class="inv-grid">${Array.from({ length: Math.max(stashMax(s), c.stash.length) }, (_, i) => cell(c.stash[i], `data-fs="${i}"`)).join('')}</div>`;
  }
}
