import { describe, expect, it } from 'vitest';
import type { WeaponKindId } from '../data/items';
import { WEAPON_LOOKS, weaponTraits, type WeaponLookId } from '../data/weapon-look';
import { THRUST, hasBuilder, slabRadius, weaponGeometry, weaponGlow, weaponModel, weaponParts } from './weapons';

/** D1 envelope: height bands that stay free for the hands (one-handed hammers have no left-grip band). */
const FREE: Record<WeaponKindId | 'hammer1', Array<[number, number]>> = {
  blade: [[-0.12, 0.14]],
  hammer1: [[-0.12, 0.14]],
  // Grip, left grip at 0.48 (± a hand), stand grip −0.08 lies in the grip.
  hammer: [[-0.15, 0.15], [0.42, 0.54]],
  spear: [[-0.13, 0.17], [0.44, 0.56], [-0.56, -0.44]],
  sling: [[-0.07, 0.14]],
};
const FREE_RADIUS = 0.033;
const EPS = 1e-4;
const ids = (Object.keys(WEAPON_LOOKS) as WeaponLookId[]).filter(hasBuilder);
const zones = (id: WeaponLookId): Array<[number, number]> => { const k = WEAPON_LOOKS[id].kind; return FREE[k === 'hammer' && weaponTraits(id).hands === 1 ? 'hammer1' : k]; };

describe('weapon models (WP4 step 1)', () => {
  it('has a builder for every weapon look', () => {
    for (const id of Object.keys(WEAPON_LOOKS)) expect(hasBuilder(id as WeaponLookId), id).toBe(true);
  });

  it('builds every model to its length (D8) and keeps the grip zones free (D1)', () => {
    for (const id of ids) {
      const rigid = weaponParts(id).filter((p) => !p.soft);
      let top = -Infinity, bottom = Infinity;
      for (const p of rigid) { p.geo.computeBoundingBox(); top = Math.max(top, p.geo.boundingBox!.max.y); bottom = Math.min(bottom, p.geo.boundingBox!.min.y); }
      expect(Math.abs(top - WEAPON_LOOKS[id].length), `${id} tip ${top.toFixed(3)}`).toBeLessThanOrEqual(0.01);
      if (WEAPON_LOOKS[id].kind === 'spear') {
        // The thrust grip (−0.5) and the smear height (THRUST.tip) need a full-length shaft.
        expect(bottom, `${id} butt`).toBeGreaterThan(-0.7);
        expect(bottom, `${id} butt`).toBeLessThan(THRUST.spear!.grip - 0.04);
        expect(top, `${id} tip`).toBeGreaterThan(THRUST.spear!.tip - 0.1);
      }
      if (WEAPON_LOOKS[id].kind === 'sling') expect(top, id).toBeLessThanOrEqual(0.4);
      for (const [y0, y1] of zones(id)) expect(slabRadius(rigid, y0, y1), `${id} free ${y0}..${y1}`).toBeLessThanOrEqual(FREE_RADIUS + EPS);
    }
  });

  it('gives every hammer a head just below its top', () => {
    for (const id of ids) if (WEAPON_LOOKS[id].kind === 'hammer') { const l = WEAPON_LOOKS[id].length; expect(slabRadius(weaponParts(id), l - 0.12, l - 0.06), id).toBeGreaterThan(0.06); }
  });

  it('stays in budget: at most 3 meshes, 900 triangles (legendary 1,400), and a glow part for the element', () => {
    for (const id of ids) {
      const g = weaponGeometry(id);
      const tris = Object.values(g).reduce((a, x) => a + x.attributes.position!.count / 3, 0);
      expect(Object.keys(g).length, id).toBeLessThanOrEqual(3);
      // Neon and GDR may use the legendary budget (Johannes, 2026-11-19: they are the rarer weapons).
      expect(tris, id).toBeLessThanOrEqual(WEAPON_LOOKS[id].family === 'normal' || WEAPON_LOOKS[id].family === 'set' ? 900 : 1400);
      expect(g.glow, id).toBeDefined();
      for (const x of Object.values(g)) expect(Object.keys(x.attributes).sort(), id).toEqual(['color', 'normal', 'position', 'uv']);
    }
  });

  it('measures the free radius exactly (a clipped cylinder)', () => {
    const r = slabRadius(weaponParts('vorschlag').filter((p) => !p.soft), -0.1, 0.1);
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
