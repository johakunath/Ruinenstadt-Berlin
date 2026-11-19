// Pure port of 2D js/state.js gear/stats/pwParts. No XP levels or daily modifiers.
import { AFFIXES, ATTRIBUTE_STATS, IMPLICITS, IMPLANT_MODES, LEGENDARY_POWERS, SET_BONUSES, SLOTS, SLOT_MAIN_STATS, type LegendaryId,
  type AffixId, type AttributeKindId, type BaseId, type ElementId, type SetId, type SlotId, type WeaponKindId } from '../data/items';
import { BASES } from '../data/item-names';
import { WEAPON_MODS, type MealId } from '../data/crafting';
import { DRILL, type CampBuildingId, type CampUpgradeId, type PerkId, type SurvivorId } from '../data/progression';
import { weaponLookId, weaponTraits, type DamageType, type WeaponLookId } from '../data/weapon-look';
import type { Item } from './items';

export type Equipment = Partial<Record<SlotId, Item>>;
export interface StatContext {
  upgrades: Partial<Record<CampUpgradeId, number>>;
  perks: Partial<Record<PerkId, number>>;
  camp: Partial<Record<CampBuildingId, boolean>>;
  imbissLevel?: number;
  survivors: Partial<Record<SurvivorId, boolean>>;
  meal?: MealId;
  drill?: number;
  shrines?: Partial<Record<'as' | 'res' | 'spd', boolean>>;
}
export interface HeroStats {
  kind: WeaponKindId;
  /** Look of the equipped weapon (`weapon-look.ts`): its own clips (`BASE_CLIPS`). */
  look: WeaponLookId;
  /** D9 damage types of the equipped weapon (strong against some enemy classes). */
  types: readonly DamageType[];
  /** Legendary powers of the equipped items (2D `hasL`): the bases that have one. */
  legendary: LegendaryId[];
  affixes: Record<AffixId, number>;
  elements: ElementId[];
  elementChance: number;
  eliteBonus: number;
  weight: number;
  elementPower: number;
  damage: number;
  maxHp: number;
  crit: number;
  moveSpeed: number;
  attackSpeed: number;
  regen: number;
  res: number;
  leech: number;
  luck: number;
  reachFactor: number;
  dashCooldown: number;
  cooldownFactor: number;
}
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** 2D `KIND.rate`: seconds per attack. Only `power` uses it; real timing is in `data/combat.ts`. */
const SWING_TIME: Record<WeaponKindId, number> = { blade: 0.3, hammer: 0.68, sling: 0.42, spear: 0.5 };

/** D8: damage factor of a weapon item's base (a shorter base hits harder). */
export const weaponDamage = (item: Item): number => item.value * (item.slot === 'w' && item.kind in SWING_TIME ? weaponTraits(weaponLookId(item.kind as WeaponKindId, item.base, item.set)).damage : 1);

/** 2D `dps(it)`: weapon damage over its swing time (item card line), with the D8 size factor. */
export const weaponDps = (item: Item): number => weaponDamage(item) / (SWING_TIME[item.kind as WeaponKindId] ?? .5);

/** 2D baseOf fallback without mutating an item. */
function baseOf(item: Item): BaseId {
  if (item.base) return item.base as BaseId;
  for (const name in BASES) if (item.name.startsWith(name)) return BASES[name]!;
  return ({ blade: 'rohr', hammer: 'vorschlag', sling: 'zwille', armor: 'leder' } as Record<string, BaseId>)[item.kind] ?? 'kiesel';
}

export function setCount(eq: Equipment, set: SetId): number {
  return SLOTS.filter(slot => eq[slot]?.set === set).length;
}

export function gearAffixes(eq: Equipment, ctx: StatContext): Record<AffixId, number> {
  const a = Object.fromEntries(Object.keys(AFFIXES).map(id => [id, 0])) as Record<AffixId, number>;
  for (const slot of SLOTS) {
    const item = eq[slot];
    if (!item) continue;
    const main = SLOT_MAIN_STATS[slot];
    if (main) a[main] += item.value;
    if (slot === 't' || slot === 'r' || slot === 'i') a[ATTRIBUTE_STATS[item.kind as AttributeKindId]] += item.value;
    for (const affix of [...(IMPLICITS[baseOf(item)] ?? []), ...item.affixes]) a[affix.id] += affix.value;
    if (slot === 'i') {
      const mode = IMPLANT_MODES[item.implantMode ?? 0]!;
      for (const id of Object.keys(mode.affixes) as AffixId[]) a[id] += mode.affixes[id]!;
    }
    for (const id of item.mods ?? []) {
      const mod = WEAPON_MODS.find(m => m.id === id);
      for (const affix of mod?.affixes ?? []) a[affix.id] += affix.value;
      if (mod?.element) a.el += 35;
    }
  }
  if (ctx.camp.turm) a.res += 8;
  for (const set of Object.keys(SET_BONUSES) as SetId[]) {
    const n = setCount(eq, set);
    for (const bonus of SET_BONUSES[set]) if (n >= bonus.pieces) {
      for (const id of Object.keys(bonus.affixes) as AffixId[]) a[id] += bonus.affixes[id]!;
    }
  }
  return a;
}

export function heroStats(eq: Equipment, ctx: StatContext): HeroStats {
  const w = eq.w;
  if (!w) throw new Error('heroStats requires an equipped weapon');
  const kind = w.kind as WeaponKindId, a = gearAffixes(eq, ctx);
  // D8: a shorter base reaches less and hits harder (reach and damage factors from its length).
  const look = weaponLookId(kind, w.base, w.set), size = weaponTraits(look);
  const pk = (id: PerkId): number => ctx.perks[id] ?? 0;
  const upg = (id: CampUpgradeId): number => ctx.upgrades[id] ?? 0;
  const mods = WEAPON_MODS; // Resolve in item order, as in 2D.
  const wm = (w.mods ?? []).flatMap(id => { const m = mods.find(m => m.id === id); return m ? [m] : []; });
  const elements: ElementId[] = [];
  const addElement = (id: ElementId): void => { if (!elements.includes(id)) elements.push(id); };
  if (w.element) addElement(w.element);
  for (const mod of wm) if (mod.element) addElement(mod.element);
  if (setCount(eq, 'spree') >= 3) addElement('shock');
  for (const id of ['fire', 'acid', 'shock'] as const) if (pk(id)) addElement(id);
  const mk = (ctx.imbissLevel ?? 0) >= 3 ? 1.2 : 1;
  if (ctx.meal === 'kaffee') { a.as += 18 * mk; a.spd += 18 * mk; }
  if (ctx.meal === 'soljanka') { a.regen += 3 * mk; a.res += 10 * mk; }
  if (ctx.meal === 'gurke') a.luck += Math.round(4 * mk);
  if (ctx.meal === 'curry') a.dmg += 25 * mk;
  const asF = Math.max(.4, 1 + .12 * pk('rate') + a.as / 100 + (ctx.shrines?.as ? .3 : 0));
  const cdr = clamp(a.cdr / 100, 0, .5), drill = ctx.drill ?? 0;
  // Hero level is fixed at 1: the 2D (lv - 1) damage/life terms vanish.
  return {
    kind, look, types: size.types, affixes: a, elements,
    legendary: SLOTS.flatMap((slot) => { const it = eq[slot]; const b = it ? baseOf(it) : ''; return b in LEGENDARY_POWERS ? [b as LegendaryId] : []; }),
    elementChance: wm.some(m => m.element) ? .5 : .3,
    eliteBonus: wm.reduce((n, m) => n + (m.eliteBossBonus ?? 0), 0),
    weight: wm.find(m => m.heavyHitEvery)?.heavyHitEvery ?? 0,
    elementPower: Math.max(0, 1 + a.el / 100 + .25 * pk('elp')),
    damage: Math.max(1, w.value * size.damage * (1 + .07 * upg('dmg') + .15 * pk('dmg') + a.dmg / 100 + DRILL.damage * drill) * (pk('m_dampf') && kind === 'hammer' ? 1.7 : 1)
      // G1 Umbau: Sturmklinge and Schnellfeuer trade damage for tempo.
      * (pk('m_sturm') && kind === 'blade' ? .85 : 1) * (pk('m_salve') && kind === 'sling' ? .75 : 1)),
    maxHp: Math.max(20, Math.round((100 + a.hp) * (1 + .05 * upg('hp') + .1 * pk('hp')) * (1 + DRILL.life * drill) * (ctx.meal === 'suppe' ? 1 + .35 * mk : 1))),
    crit: clamp(.08 + .08 * pk('crit') + a.crit / 100, 0, .75),
    moveSpeed: clamp(1 + .1 * pk('spd') + a.spd / 100 + (ctx.shrines?.spd ? .25 : 0), .5, 1.8),
    attackSpeed: asF / (pk('m_dampf') && kind === 'hammer' ? 1.3 : 1) * (pk('m_sturm') && kind === 'blade' ? 1.25 : 1) * (pk('m_salve') && kind === 'sling' ? 1.4 : 1),
    regen: Math.max(0, a.regen),
    res: clamp(a.res / 100 + .06 * pk('res') + (ctx.shrines?.res ? .25 : 0), -.5, .75),
    leech: Math.max(0, a.leech),
    luck: a.luck + (ctx.survivors.spaeher ? 1 : 0),
    reachFactor: (1 + .2 * pk('reach')) * size.reach,
    dashCooldown: Math.max(.4, 1.4 * (1 - .08 * upg('dash')) * (1 - .2 * pk('dashcd')) * (1 - cdr) * (ctx.survivors.mechaniker ? .9 : 1)),
    cooldownFactor: (1 - .2 * pk('skill')) * (1 - cdr),
  };
}

export function power(s: HeroStats): number {
  // 2D `pwParts`: damage per second with the weapon's swing time (blade 0.30 s, hammer 0.68, thrower 0.42,
  // spear 0.50), normalized to the blade so the starter's power stays the same. Without it a hammer reads 2.3× a blade.
  const dps = s.damage * (1 + s.crit) * s.attackSpeed * (0.3 / SWING_TIME[s.kind])
    * (1 + (s.elements.length ? .18 * s.elementPower * (s.elementChance || .3) / .3 * Math.min(2, s.elements.length) : 0))
    * (s.weight ? 1.12 : 1);
  const ehp = s.maxHp / (1 - s.res) * (1 + s.regen * .04);
  return Math.round(Math.sqrt(dps * ehp) * (1 + (s.moveSpeed - 1) * .4) * (1 + s.luck * .01));
}
