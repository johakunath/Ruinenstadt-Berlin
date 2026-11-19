import { describe, expect, it } from 'vitest';
import type { WeaponKindId } from '../data/items';
import { WEAPON_LOOKS, type WeaponLookId } from '../data/weapon-look';
import { THRUST, hasBuilder, slabRadius, weaponGeometry, weaponGlow, weaponModel, weaponParts } from './weapons';

/** D1 envelope per kind: tip height on +Y (rigid parts) and height bands that stay free for the hands. */
const ENVELOPE: Record<WeaponKindId, { tip: [number, number]; free: Array<[number, number]> }> = {
  blade: { tip: [0.88, 1.11], free: [[-0.12, 0.14]] },
  // Grip, left grip at 0.48 (± a hand), stand grip −0.08 lies in the grip.
  hammer: { tip: [1.0, 1.2], free: [[-0.15, 0.15], [0.42, 0.54]] },
  spear: { tip: [THRUST.spear!.tip - 0.03, THRUST.spear!.tip + 0.03], free: [[-0.13, 0.17], [0.44, 0.56], [-0.56, -0.44]] },
  sling: { tip: [0.25, 0.4], free: [[-0.07, 0.14]] },
};
const FREE_RADIUS = 0.033;
const EPS = 1e-4;
const ids = (Object.keys(WEAPON_LOOKS) as WeaponLookId[]).filter(hasBuilder);

describe('weapon models (WP4 step 1)', () => {
  it('has a builder for every normal weapon look and both set variants', () => {
    for (const [id, look] of Object.entries(WEAPON_LOOKS)) if (look.family === 'normal' || id.includes(':')) expect(hasBuilder(id as WeaponLookId), id).toBe(true);
  });

  it('keeps every model inside its kind envelope (tip height, free grip zones)', () => {
    for (const id of ids) {
      const env = ENVELOPE[WEAPON_LOOKS[id].kind];
      const rigid = weaponParts(id).filter((p) => !p.soft);
      let top = -Infinity, bottom = Infinity;
      for (const p of rigid) { p.geo.computeBoundingBox(); top = Math.max(top, p.geo.boundingBox!.max.y); bottom = Math.min(bottom, p.geo.boundingBox!.min.y); }
      expect(top, `${id} tip`).toBeGreaterThanOrEqual(env.tip[0] - EPS);
      expect(top, `${id} tip`).toBeLessThanOrEqual(env.tip[1] + EPS);
      if (WEAPON_LOOKS[id].kind === 'spear') expect(bottom, `${id} butt`).toBeGreaterThan(-0.7);
      for (const [y0, y1] of env.free) expect(slabRadius(rigid, y0, y1), `${id} free ${y0}..${y1}`).toBeLessThanOrEqual(FREE_RADIUS + EPS);
    }
  });

  it('gives every hammer a head at 1.06', () => {
    for (const id of ids) if (WEAPON_LOOKS[id].kind === 'hammer') expect(slabRadius(weaponParts(id), 1.04, 1.08), id).toBeGreaterThan(0.06);
  });

  it('stays in budget: at most 3 meshes, 900 triangles (legendary 1,400), and a glow part for the element', () => {
    for (const id of ids) {
      const g = weaponGeometry(id);
      const tris = Object.values(g).reduce((a, x) => a + x.attributes.position!.count / 3, 0);
      expect(Object.keys(g).length, id).toBeLessThanOrEqual(3);
      expect(tris, id).toBeLessThanOrEqual(WEAPON_LOOKS[id].family === 'legendary' ? 1400 : 900);
      expect(g.glow, id).toBeDefined();
      for (const x of Object.values(g)) expect(Object.keys(x.attributes).sort(), id).toEqual(['color', 'normal', 'position', 'uv']);
    }
  });

  it('measures the free radius exactly (a clipped cylinder)', () => {
    const r = slabRadius(weaponParts('vorschlag'), -0.1, 0.1);
    expect(r).toBeGreaterThan(0.0305);
    expect(r).toBeLessThanOrEqual(0.031 + 1e-6);
  });

  it('lights the glow by element, else by signature, else not at all', () => {
    expect(weaponGlow('stahl', undefined)).toBeNull();
    expect(weaponGlow('stahl', 'fire')).toEqual({ color: 0xff6a2a, intensity: 2.4 });
    expect(weaponGlow('leucht', undefined)).toEqual({ color: 0x43d1cf, intensity: 1.6 });
    expect(weaponGlow('leucht', 'shock')?.color).toBe(0x7dd3ff);
  });

  it('picks the model by base and set, falling back to the kind default', () => {
    expect(weaponModel('blade', 'rohr')).toBe('rohr');
    expect(weaponModel('blade', 'brech', 'kiez')).toBe('brech:kiez');
    expect(weaponModel('hammer', 'unbekannt')).toBe('vorschlag');
  });
});
