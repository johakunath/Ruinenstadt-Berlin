import { describe, expect, it } from 'vitest';
import { BASES, GDR_WEAPON_NAMES, LEGENDARY_WEAPON_NAMES, NEON_WEAPON_NAMES, WEAPON_NAMES } from './item-names';
import { SETS, type SetId, type WeaponKindId } from './items';
import { DEFAULT_LOOK, WEAPON_LOOKS, weaponLookId } from './weapon-look';

/** Every weapon name with its kind: the drop tables, the legacy names in BASES and the set weapons. */
const named: Array<[string, WeaponKindId]> = [];
for (const t of [WEAPON_NAMES, NEON_WEAPON_NAMES, GDR_WEAPON_NAMES, LEGENDARY_WEAPON_NAMES]) for (const [kind, list] of Object.entries(t)) for (const n of list) named.push([n, kind as WeaponKindId]);
named.push(['Holzlatte', 'blade'], ['Rostiges Rohr', 'blade'], ['Bewehrungsstahl', 'blade'], ['Brechstange', 'blade'], ['Zwille', 'sling'], ['Nagelschleuder', 'sling'], ['Aufziehschleuder', 'sling']);

describe('weapon looks (WP4 D1)', () => {
  it('gives every weapon base in BASES its own look of the same kind', () => {
    for (const [name, kind] of named) {
      const base = BASES[name];
      expect(base, name).toBeDefined();
      expect(weaponLookId(kind, base!), name).toBe(base);
      expect(WEAPON_LOOKS[weaponLookId(kind, base!)].kind, name).toBe(kind);
    }
  });

  it('resolves every set weapon; set pieces on a shared base get their set variant', () => {
    for (const [set, def] of Object.entries(SETS) as Array<[SetId, (typeof SETS)[SetId]]>) {
      const w = def.pieces.w!;
      const id = weaponLookId(w.kind as WeaponKindId, w.base, set);
      expect(WEAPON_LOOKS[id].kind).toBe(w.kind);
      expect(WEAPON_LOOKS[id].family).toBe('set');
    }
    expect(weaponLookId('blade', 'brech', 'kiez')).toBe('brech:kiez');
    expect(weaponLookId('sling', 'zwille', 'spree')).toBe('zwille:spree');
    expect(weaponLookId('hammer', 'morgen', 'zit')).toBe('morgen');
  });

  it('falls back to the kind default for unknown bases and bases of another kind', () => {
    expect(weaponLookId('hammer', 'nope')).toBe(DEFAULT_LOOK.hammer);
    expect(weaponLookId('spear', 'machete')).toBe(DEFAULT_LOOK.spear);
    expect(weaponLookId('blade', 'brech', 'spree')).toBe('brech');
  });

  it('gives a signature glow to neon and legendary bases only', () => {
    for (const look of Object.values(WEAPON_LOOKS)) expect('glow' in look, JSON.stringify(look)).toBe(look.family === 'neon' || look.family === 'legendary');
  });
});
