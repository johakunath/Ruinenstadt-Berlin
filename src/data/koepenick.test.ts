import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { koepenickMap } from './koepenick';
import { generateLots, generateProps, isWater, LIGHT_COVER, LIGHT_PROPS, mapLevel, onBridge, streetDist } from './map';

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
        if (b.kind === 'ferry') continue; // tested in src/sim/ferry.test.ts
        expect(onBridge(m, b.x, b.z)).toBe(b);
        expect(level.blocked(b.x, b.z, 0.5)).toBe(false);
      }
      expect(isWater(m, -31 * scale, 24 * scale)).toBe(false); // Schlossinsel
      expect(isWater(m, 6 * scale, -60 * scale)).toBe(false);
    });

    it(`places buildings off streets and out of the water (scale ${scale})`, () => {
      const houses = lots.filter((l) => l.kind !== 'tree');
      // 40 since the four Späti rest stops took their lots (M11b part 2).
      expect(houses.length).toBeGreaterThanOrEqual(40);
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

  it('no invisible walls: land at the map edge has a fence or roadblock', () => {
    const m = koepenickMap(1);
    const lots = generateLots(m);
    const edge = generateProps(m, lots).filter((p) => p.kind === 'bauzaun' || p.kind === 'barrier');
    const B = m.bounds;
    const pts: Array<[number, number]> = [];
    for (let x = B.minX + 3; x < B.maxX - 3; x += 2) pts.push([x, B.minZ + 1], [x, B.maxZ - 1]);
    for (let z = B.minZ + 3; z < B.maxZ - 3; z += 2) pts.push([B.minX + 1, z], [B.maxX - 1, z]);
    for (const [x, z] of pts) {
      if (isWater(m, x, z) && !onBridge(m, x, z)) continue;
      expect(edge.some((p) => Math.hypot(p.x - x, p.z - z) < 2.2), `${x},${z}`).toBe(true);
    }
  });

  it('lamps stand beside streets and at least 22 m apart; some are broken', () => {
    const m = koepenickMap(1);
    const props = generateProps(m, generateLots(m));
    const lamps = props.filter((p) => p.kind === 'lantern' || p.kind === 'lampBroken');
    expect(props.some((p) => p.kind === 'lampBroken')).toBe(true);
    for (const a of lamps) {
      expect(streetDist(m, a.x, a.z).d).toBeGreaterThan(0);
      expect(streetDist(m, a.x, a.z).d).toBeLessThan(2);
      for (const b of lamps) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(22);
    }
  });

  it('light coverage: almost every street point has a light source within reach', () => {
    const m = koepenickMap(1);
    const props = generateProps(m, generateLots(m));
    const lights = props.filter((p) => LIGHT_PROPS.has(p.kind)).map((p) => [p.x, p.z] as const);
    const anchors = [...lights, ...m.landmarks.filter((l) => l.hx > 0).map((l) => [l.x, l.z] as const)];
    let n = 0;
    let dark = 0;
    for (const s of m.streets) {
      if (s.kind === 'path') continue;
      for (let i = 1; i < s.pts.length; i++) {
        const [ax, az] = s.pts[i - 1]!;
        const [bx, bz] = s.pts[i]!;
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 2; t < len; t += 4) {
          const x = ax + ((bx - ax) / len) * t;
          const z = az + ((bz - az) / len) * t;
          if (onBridge(m, x, z, 1) || isWater(m, x, z)) continue;
          n++;
          if (!anchors.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < LIGHT_COVER + 1)) dark++;
        }
      }
    }
    console.log(`light sources ${lights.length}, street samples ${n}, dark ${dark}`);
    expect(dark / n).toBeLessThan(0.05);
  });

  it('bigger scale means a bigger map with more lots', () => {
    const a = generateLots(koepenickMap(1)).length;
    const b = generateLots(koepenickMap(1.3)).length;
    expect(b).toBeGreaterThan(a);
  });
});
