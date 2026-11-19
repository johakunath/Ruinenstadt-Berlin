// Weapon looks per item base (WP4 D1): which model a weapon shows. No Three.js here; the models are
// built in src/render/weapons.ts. The kind fixes the envelope (grip, tip, hit arcs), the base the shape,
// the family the palette.
import type { SetId, WeaponKindId } from './items';

export type WeaponFamily = 'normal' | 'neon' | 'gdr' | 'legendary' | 'set';

export interface WeaponLook {
  readonly kind: WeaponKindId;
  readonly family: WeaponFamily;
  /** Signature glow (neon, legendary): lights the glow parts when the item has no element. */
  readonly glow?: string;
}

/** Keyed by base; set weapons that share a base with a normal one are keyed `base:set`. */
export const WEAPON_LOOKS = {
  rohr: { kind: 'blade', family: 'normal' },
  latte: { kind: 'blade', family: 'normal' },
  stahl: { kind: 'blade', family: 'normal' },
  machete: { kind: 'blade', family: 'normal' },
  brech: { kind: 'blade', family: 'normal' },
  vorschlag: { kind: 'hammer', family: 'normal' },
  pflaster: { kind: 'hammer', family: 'normal' },
  zange: { kind: 'hammer', family: 'normal' },
  zwille: { kind: 'sling', family: 'normal' },
  nagel: { kind: 'sling', family: 'normal' },
  stein: { kind: 'sling', family: 'normal' },
  rspeer: { kind: 'spear', family: 'normal' },
  fahne: { kind: 'spear', family: 'normal' },
  harpune: { kind: 'spear', family: 'normal' },
  leucht: { kind: 'blade', family: 'neon', glow: '#43d1cf' },
  boxh: { kind: 'hammer', family: 'neon', glow: '#ff4fa3' },
  neonfl: { kind: 'sling', family: 'neon', glow: '#ff4fa3' },
  mikro: { kind: 'spear', family: 'neon', glow: '#ff4fa3' },
  sichel: { kind: 'blade', family: 'gdr' },
  werkh: { kind: 'hammer', family: 'gdr' },
  aufzieh: { kind: 'sling', family: 'gdr' },
  zeiger: { kind: 'spear', family: 'gdr' },
  turm: { kind: 'blade', family: 'legendary', glow: '#5aa8ff' },
  zitklinge: { kind: 'blade', family: 'legendary', glow: '#7dd3ff' },
  mauer: { kind: 'hammer', family: 'legendary', glow: '#97c459' },
  pbrecher: { kind: 'hammer', family: 'legendary', glow: '#ff7a2a' },
  ring: { kind: 'sling', family: 'legendary', glow: '#ff8a3d' },
  kraehe: { kind: 'sling', family: 'legendary', glow: '#97c459' },
  siegsp: { kind: 'spear', family: 'legendary', glow: '#f2d14b' },
  morgen: { kind: 'hammer', family: 'set' },
  'brech:kiez': { kind: 'blade', family: 'set' },
  'zwille:spree': { kind: 'sling', family: 'set' },
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
