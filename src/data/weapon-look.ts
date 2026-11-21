// Weapon looks per item base (WP4 D1): which model a weapon shows. No Three.js here; the models are
// built in src/render/weapons.ts. The kind fixes the envelope (grip, tip, hit arcs), the base the shape,
// the family the palette.
import { weaponAttack } from './combat';
import type { EnemyClass } from './enemies';
import type { SetId, WeaponKindId } from './items';

export type WeaponFamily = 'normal' | 'neon' | 'gdr' | 'legendary' | 'set';
/** D9 damage types: each is strong against some enemy classes (`STRONG_AGAINST`). */
export type DamageType = 'schnitt' | 'wucht' | 'stich' | 'geschoss';

export interface WeaponLook {
  readonly kind: WeaponKindId;
  readonly family: WeaponFamily;
  /** Signature glow (neon, legendary): lights the glow parts when the item has no element. */
  readonly glow?: string;
  /** A fixed glow accent that is not a signature colour (Hackmesser edge gleam): the glow mesh shows without an element too. */
  readonly gleam?: true;
  /** D8: tip height of the model in meters (checked against the built model); sets reach and damage. */
  readonly length: number;
  /** D8: hands and damage types of a base that differs from its kind. */
  readonly hands?: 1 | 2;
  readonly types?: readonly DamageType[];
}

/** D8 kind defaults: hands and damage type. */
export const KIND_HANDS: Readonly<Record<WeaponKindId, 1 | 2>> = { blade: 1, hammer: 2, spear: 2, sling: 1 };
export const KIND_TYPES: Readonly<Record<WeaponKindId, readonly DamageType[]>> = { blade: ['schnitt'], hammer: ['wucht'], spear: ['stich'], sling: ['geschoss'] };

/** D9: what each damage type is strong against (+`WEAPON.typeBonus`). Geschoss → Tiere is a 3D addition. */
export const STRONG_AGAINST: Readonly<Record<DamageType, readonly EnemyClass[]>> = {
  schnitt: ['untote', 'pflanzen'], wucht: ['maschinen'], stich: ['menschen'], geschoss: ['tiere'],
};

/** D8 short one-handed cleaver (Johannes, 2026-11-19). */
const CLEAVER = { hands: 1, types: ['schnitt'], gleam: true } as const;

/** Keyed by base; set weapons that share a base with a normal one are keyed `base:set`. */
export const WEAPON_LOOKS = {
  rohr: { kind: 'blade', family: 'normal', length: 1.07 },
  latte: { kind: 'blade', family: 'normal', length: 0.8 },
  stahl: { kind: 'blade', family: 'normal', length: 1.11 },
  machete: { kind: 'blade', family: 'normal', length: 1.0 },
  brech: { kind: 'blade', family: 'normal', length: 0.53, ...CLEAVER },
  vorschlag: { kind: 'hammer', family: 'normal', length: 0.86 },
  pflaster: { kind: 'hammer', family: 'normal', length: 0.61, hands: 1, types: ['wucht', 'stich'] },
  zange: { kind: 'hammer', family: 'normal', length: 0.66, hands: 1, types: ['wucht'] },
  zwille: { kind: 'sling', family: 'normal', length: 0.31 },
  nagel: { kind: 'sling', family: 'normal', length: 0.31 },
  stein: { kind: 'sling', family: 'normal', length: 0.27 },
  rspeer: { kind: 'spear', family: 'normal', length: 1.81 },
  fahne: { kind: 'spear', family: 'normal', length: 1.81 },
  harpune: { kind: 'spear', family: 'normal', length: 1.81 },
  leucht: { kind: 'blade', family: 'neon', length: 0.79, glow: '#43d1cf' },
  boxh: { kind: 'hammer', family: 'neon', length: 0.88, glow: '#ff4fa3' },
  // Look 2: an assault rifle held in both hands, shooting from the pistol clips (`BASE_CLIPS` in combat.ts).
  neonfl: { kind: 'sling', family: 'neon', length: 0.17, glow: '#43d1cf', hands: 2 },
  mikro: { kind: 'spear', family: 'neon', length: 1.6, glow: '#ff4fa3' },
  sichel: { kind: 'blade', family: 'gdr', length: 0.71 },
  werkh: { kind: 'hammer', family: 'gdr', length: 0.85 },
  aufzieh: { kind: 'sling', family: 'gdr', length: 0.31, glow: '#e7982b' },
  zeiger: { kind: 'spear', family: 'gdr', length: 1.81 },
  turm: { kind: 'blade', family: 'legendary', length: 0.83, glow: '#5aa8ff' },
  zitklinge: { kind: 'blade', family: 'legendary', length: 0.86, glow: '#7dd3ff' },
  mauer: { kind: 'hammer', family: 'legendary', length: 0.89, glow: '#97c459' },
  pbrecher: { kind: 'hammer', family: 'legendary', length: 0.9, glow: '#ff7a2a' },
  ring: { kind: 'sling', family: 'legendary', length: 0.31, glow: '#ff8a3d' },
  kraehe: { kind: 'sling', family: 'legendary', length: 0.31, glow: '#97c459' },
  siegsp: { kind: 'spear', family: 'legendary', length: 1.72, glow: '#f2d14b' },
  // M18 Die Letzte Bestellung: the Vorschlaghammer's handle with a wish-lamp head; the lamp glows warm.
  bestellung: { kind: 'hammer', family: 'legendary', length: 0.9, glow: '#ffb060' },
  morgen: { kind: 'hammer', family: 'set', length: 0.9 },
  'brech:kiez': { kind: 'blade', family: 'set', length: 0.53, ...CLEAVER },
  'zwille:spree': { kind: 'sling', family: 'set', length: 0.31, glow: '#5fd18a' },
  // Tunnelläufer: the Rohrzange in brass; its lantern glows warm without an element.
  'zange:tunnel': { kind: 'hammer', family: 'set', length: 0.66, hands: 1, types: ['wucht'], glow: '#fff2b0' },
} as const satisfies Readonly<Record<string, WeaponLook>>;

export type WeaponLookId = keyof typeof WEAPON_LOOKS;

/** What a kind shows for a base without its own look. */
export const DEFAULT_LOOK: Readonly<Record<WeaponKindId, WeaponLookId>> = { blade: 'stahl', hammer: 'vorschlag', spear: 'rspeer', sling: 'zwille' };

const isLook = (id: string): id is WeaponLookId => Object.hasOwn(WEAPON_LOOKS, id);

/** The look of a weapon item: `base:set`, else the base, else the kind's default (also when the base is of another kind). */
export function weaponLookId(kind: WeaponKindId, base: string, set?: SetId): WeaponLookId {
  const own = set ? `${base}:${set}` : '';
  if (isLook(own) && WEAPON_LOOKS[own].kind === kind) return own;
  if (isLook(base) && WEAPON_LOOKS[base].kind === kind) return base;
  return DEFAULT_LOOK[kind];
}

/** D8 reference lengths: tip heights of the pre-WP4 kind models, which the reach values in `combat.ts` were set for. */
export const REF_LENGTH: Readonly<Record<Exclude<WeaponKindId, 'sling'>, number>> = { blade: 1.11, hammer: 1.16, spear: 1.81 };

/**
 * D8 (Johannes, 2026-11-19): reach follows the length of a melee weapon, a shorter one hits harder.
 * Reach = 1 − (reference − length) ÷ reach of the kind's first attack, in steps of 0.05, at least 0.6;
 * damage = 2 − reach. Slings keep 1 and 1 (their reach factor is shot speed).
 */
export function weaponTraits(id: WeaponLookId): { hands: 1 | 2; reach: number; damage: number; types: readonly DamageType[] } {
  const l: WeaponLook = WEAPON_LOOKS[id];
  const reach = l.kind === 'sling' ? 1 : Math.max(0.6, Math.round((1 - (REF_LENGTH[l.kind] - l.length) / weaponAttack(l.kind, 'light1').reach) * 20) / 20);
  return { hands: l.hands ?? KIND_HANDS[l.kind], reach, damage: 2 - reach, types: l.types ?? KIND_TYPES[l.kind] };
}

/** D9: the enemy classes a look is strong against (each class once). */
export function strongAgainst(id: WeaponLookId): EnemyClass[] {
  return [...new Set(weaponTraits(id).types.flatMap((t) => STRONG_AGAINST[t]))];
}
