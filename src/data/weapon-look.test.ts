import { describe, expect, it } from 'vitest';
import { weaponAttack } from './combat';
import { BASES, GDR_WEAPON_NAMES, LEGENDARY_WEAPON_NAMES, NEON_WEAPON_NAMES, WEAPON_NAMES } from './item-names';
import { SETS, type SetId, type WeaponKindId } from './items';
import { DEFAULT_LOOK, WEAPON_LOOKS, strongAgainst, weaponLookId, weaponTraits, type WeaponLookId } from './weapon-look';

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
    expect(weaponLookId('hammer', 'zange', 'tunnel')).toBe('zange:tunnel');
    expect(weaponLookId('hammer', 'morgen', 'zit')).toBe('morgen');
  });

  it('falls back to the kind default for unknown bases and bases of another kind', () => {
    expect(weaponLookId('hammer', 'nope')).toBe(DEFAULT_LOOK.hammer);
    expect(weaponLookId('spear', 'machete')).toBe(DEFAULT_LOOK.spear);
    expect(weaponLookId('blade', 'brech', 'spree')).toBe('brech');
  });

  it('gives a signature glow to neon and legendary bases, the Aufziehwerfer and the Spreegeist and Tunnelläufer sets only', () => {
    for (const [id, look] of Object.entries(WEAPON_LOOKS)) expect('glow' in look, id).toBe(look.family === 'neon' || look.family === 'legendary' || id === 'aufzieh' || id === 'zwille:spree' || id === 'zange:tunnel');
  });

  it('gives the edge gleam (a fixed accent, no signature) to the two Hackmesser only', () => {
    for (const [id, look] of Object.entries(WEAPON_LOOKS)) expect('gleam' in look, id).toBe(id === 'brech' || id === 'brech:kiez');
  });

  it('holds the Neonflinte, a rifle, in both hands and gives it the pistol clip', () => {
    expect(weaponTraits('neonfl')).toMatchObject({ hands: 2, reach: 1, damage: 1 });
    const shot = weaponAttack('sling', 'light1', 'neonfl'), plain = weaponAttack('sling', 'light1');
    expect(shot.clip).toBe('Pistol_Shoot');
    // Only the clip and its phase times differ: the sim timing, damage and shot rules stay the Werfer's.
    const { clip: _c, clipStart: _s, clipSwing: _w, clipHit: _h, rec: _r, ...rest } = shot;
    const { clip: _c2, clipStart: _s2, clipSwing: _w2, clipHit: _h2, rec: _r2, ...base } = plain;
    expect(rest).toEqual(base);
  });
});

describe('weapon size and strength (WP4 D8)', () => {
  const t = (id: WeaponLookId): [number, number] => [weaponTraits(id).reach, weaponTraits(id).damage];

  it('gives full-length weapons full reach and shorter ones less reach and more damage', () => {
    expect(t('stahl')).toEqual([1, 1]);
    expect(t('rspeer')).toEqual([1, 1]);
    expect(t('brech')[0]).toBeCloseTo(0.75, 6);
    expect(t('brech')[1]).toBeCloseTo(1.25, 6);
    expect(t('brech:kiez')).toEqual(t('brech'));
    expect(t('pflaster')[0]).toBeCloseTo(0.8, 6);
    expect(t('zange')[0]).toBeCloseTo(0.8, 6);
    // A two-handed hammer a third shorter.
    expect(t('vorschlag')[0]).toBeGreaterThanOrEqual(0.85);
    expect(t('vorschlag')[0]).toBeLessThanOrEqual(0.9);
    // Look 2: the shorter Mikroständer (tip 1.6).
    expect(t('mikro')[0]).toBeCloseTo(0.95, 6);
    expect(t('mikro')[1]).toBeCloseTo(1.05, 6);
  });

  it('adds up reach and damage to 2 for every melee base, steps of 0.05, never under 0.6; slings keep 1 and 1', () => {
    for (const [id, look] of Object.entries(WEAPON_LOOKS) as Array<[WeaponLookId, (typeof WEAPON_LOOKS)[WeaponLookId]]>) {
      const [r, d] = t(id);
      if (look.kind === 'sling') { expect([r, d], id).toEqual([1, 1]); continue; }
      expect(r + d, id).toBeCloseTo(2, 9);
      expect(r, id).toBeGreaterThanOrEqual(0.6);
      expect(Math.abs(r * 20 - Math.round(r * 20)), id).toBeLessThan(1e-9);
    }
  });

  it('holds the short hammers in one hand and the rest by their kind', () => {
    expect(weaponTraits('pflaster').hands).toBe(1);
    expect(weaponTraits('zange').hands).toBe(1);
    expect(weaponTraits('vorschlag').hands).toBe(2);
    expect(weaponTraits('brech').hands).toBe(1);
    expect(weaponTraits('rspeer').hands).toBe(2);
  });

  it('names what a weapon is strong against (D9), each class once', () => {
    expect(strongAgainst('stahl')).toEqual(['untote', 'pflanzen']);
    expect(strongAgainst('vorschlag')).toEqual(['maschinen']);
    expect(strongAgainst('pflaster')).toEqual(['maschinen', 'menschen']);
    expect(strongAgainst('rspeer')).toEqual(['menschen']);
    expect(strongAgainst('zwille')).toEqual(['tiere']);
  });
});

describe('hammer knockback (WP4 D8)', () => {
  it('pushes 1.5× as far as before on every hammer attack, reach unchanged', () => {
    expect(weaponAttack('hammer', 'light1').knockback).toBeCloseTo(13.5);
    expect(weaponAttack('hammer', 'light3').knockback).toBeCloseTo(22.5);
    expect(weaponAttack('hammer', 'dash').knockback).toBeCloseTo(18);
    expect(weaponAttack('hammer', 'light1').reach).toBe(2.47);
    expect(weaponAttack('blade', 'light1').knockback).toBe(5);
  });
});
