import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { koepenickMap } from './koepenick';
import { generateLots, generateProps, isWater, mapLevel, onBridge, streetDist } from './map';

describe('Köpenick map', () => {
  for (const scale of [1, 1.3]) {
    const m = koepenickMap(scale);
    const lots = generateLots(m);
    const level = mapLevel(m, lots);

    it(`has 20 normal waves and 4 boss fights (scale ${scale})`, () => {
      const waves = m.encounters.flatMap((e) => e.waves);
      expect(waves.filter((w) => w.bosses.length === 0)).toHaveLength(20);
      expect(waves.flatMap((w) => w.bosses)).toEqual(['feldwebel', 'waechter', 'rex', 'hauptmann']);
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

  it('v2: L-shaped lots keep their wing off streets and out of the water, shops exist', () => {
    const m = koepenickMap(1);
    const lots = generateLots(m);
    const wings = lots.filter((l) => l.wing);
    expect(wings.length).toBeGreaterThan(5);
    expect(lots.some((l) => l.kind === 'shop')).toBe(true);
    for (const l of wings) {
      expect(isWater(m, l.wing!.x, l.wing!.z)).toBe(false);
      expect(streetDist(m, l.wing!.x, l.wing!.z).d).toBeGreaterThan(0);
    }
  });

  it('v2: every 20 m of street has a building, car or prop nearby', () => {
    const m = koepenickMap(1);
    const lots = generateLots(m).filter((l) => l.kind !== 'tree');
    const props = generateProps(m, lots);
    expect(props.filter((p) => p.kind === 'car').length).toBeGreaterThan(30);
    const things = [...lots, ...props];
    let empty = 0;
    let n = 0;
    for (const s of m.streets) {
      if (s.kind === 'path') continue;
      for (let i = 1; i < s.pts.length; i++) {
        const [ax, az] = s.pts[i - 1]!;
        const [bx, bz] = s.pts[i]!;
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 10; t < len; t += 20) {
          const x = ax + ((bx - ax) / len) * t;
          const z = az + ((bz - az) / len) * t;
          if (onBridge(m, x, z, 2) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
          n++;
          if (!things.some((o) => Math.hypot(o.x - x, o.z - z) < 14)) empty++;
        }
      }
    }
    expect(empty / n).toBeLessThan(0.1);
  });

  it('bigger scale means a bigger map with more lots', () => {
    const a = generateLots(koepenickMap(1)).length;
    const b = generateLots(koepenickMap(1.3)).length;
    expect(b).toBeGreaterThan(a);
  });
});
