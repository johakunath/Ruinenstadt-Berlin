import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { koepenickMap } from './koepenick';
import { generateLots, isWater, mapLevel, onBridge, streetDist } from './map';

describe('Köpenick map', () => {
  for (const scale of [1, 1.3]) {
    const m = koepenickMap(scale);
    const lots = generateLots(m);
    const level = mapLevel(m, lots);

    it(`has 20 normal waves and 4 boss fights (scale ${scale})`, () => {
      const waves = m.encounters.flatMap((e) => e.waves);
      expect(waves.filter((w) => w.bosses.length === 0)).toHaveLength(20);
      expect(waves.flatMap((w) => w.bosses)).toEqual(['schaffner', 'waechter', 'rex', 'hauptmann']);
      const perZone = [0, 1, 2].map((z) => m.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves).filter((w) => w.bosses.length === 0).length);
      expect(perZone).toEqual([6, 7, 7]);
    });

    it(`gets harder wave by wave (scale ${scale})`, () => {
      const waves = m.encounters.flatMap((e) => e.waves).filter((w) => w.bosses.length === 0);
      for (let i = 1; i < waves.length; i++) {
        expect(waves[i]!.hpMul).toBeGreaterThan(waves[i - 1]!.hpMul);
        expect(waves[i]!.count).toBeGreaterThanOrEqual(waves[i - 1]!.count);
      }
    });

    it(`keeps encounter circles, start and zone entries walkable and free (scale ${scale})`, () => {
      const spots = [m.start, ...m.zones.map((z) => z.entry), ...m.encounters.map((e) => ({ x: e.x, z: e.z }))];
      for (const p of spots) {
        expect(level.blocked(p.x, p.z, 0.5), `${p.x},${p.z}`).toBe(false);
        for (const c of level.near(p.x, p.z, 2)) expect(colliderDistance(c, p.x, p.z)).toBeGreaterThan(0.5);
      }
      for (const e of m.encounters) {
        // Most of the circle is open ground.
        let open = 0;
        let n = 0;
        for (let a = 0; a < Math.PI * 2; a += 0.3) {
          for (const f of [0.3, 0.6, 0.9]) {
            const x = e.x + Math.sin(a) * e.r * f;
            const z = e.z + Math.cos(a) * e.r * f;
            n++;
            if (!level.blocked(x, z, 0.4) && level.near(x, z, 1).every((c) => colliderDistance(c, x, z) > 0.4)) open++;
          }
        }
        expect(open / n, e.id).toBeGreaterThan(0.8);
      }
    });

    it(`crosses water only on bridges (scale ${scale})`, () => {
      for (const b of m.bridges) {
        expect(onBridge(m, b.x, b.z)).toBe(b);
        expect(level.blocked(b.x, b.z, 0.5)).toBe(false);
      }
      expect(isWater(m, -31 * scale, 24 * scale)).toBe(false); // Schlossinsel
      expect(isWater(m, 6 * scale, -60 * scale)).toBe(false);
    });

    it(`places buildings off streets and out of the water (scale ${scale})`, () => {
      const houses = lots.filter((l) => l.kind !== 'tree');
      expect(houses.length).toBeGreaterThan(40);
      for (const l of houses) {
        expect(isWater(m, l.x, l.z)).toBe(false);
        expect(streetDist(m, l.x, l.z).d).toBeGreaterThan(0);
      }
    });
  }

  it('bigger scale means a bigger map with more lots', () => {
    const a = generateLots(koepenickMap(1)).length;
    const b = generateLots(koepenickMap(1.3)).length;
    expect(b).toBeGreaterThan(a);
  });
});
