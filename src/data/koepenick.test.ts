import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { koepenickMap } from './koepenick';
import { generateLots, generateProps, isWater, LAMP_CURB, LAMP_SPACING, LIGHT_PROPS, lightCover, lineDist, mapLevel, onBridge, SAME_KIND_GAP, streetDist } from './map';

describe('Köpenick map', () => {
  for (const scale of [1, 1.3]) {
    const m = koepenickMap(scale);
    const lots = generateLots(m);
    const level = mapLevel(m, lots);

    it(`has 27 normal waves and 4 boss fights (scale ${scale})`, () => {
      const waves = m.encounters.flatMap((e) => e.waves);
      expect(waves.filter((w) => w.bosses.length === 0)).toHaveLength(27);
      expect(waves.flatMap((w) => w.bosses)).toEqual(['feldwebel', 'waechter', 'rex', 'hauptmann']);
      const perZone = [0, 1, 2].map((z) => m.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves).filter((w) => w.bosses.length === 0).length);
      expect(perZone).toEqual([9, 9, 9]);
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
      // M11c lot types are open places (a pond may sit in the middle), checked on their own below.
      const houses = lots.filter((l) => l.kind !== 'tree' && l.kind !== 'special');
      // 40 since the four Späti rest stops took their lots (M11b part 2).
      expect(houses.length).toBeGreaterThanOrEqual(38);
      for (const l of houses) {
        expect(isWater(m, l.x, l.z)).toBe(false);
        expect(streetDist(m, l.x, l.z).d).toBeGreaterThan(0);
      }
    });
  }

  it('M11c: lot types stand off streets, about two in five street lots, Parkplatz once', () => {
    const m = koepenickMap(1);
    const lots = generateLots(m);
    const sub = new Set(lots.flatMap((l) => l.content?.lots ?? []));
    const sp = lots.filter((l) => l.kind === 'special'), reg = lots.filter((l) => l.kind !== 'tree' && l.kind !== 'special' && !sub.has(l));
    expect(sp.length / (sp.length + reg.length)).toBeGreaterThan(0.3);
    expect(sp.length / (sp.length + reg.length)).toBeLessThan(0.5);
    expect(sp.filter((l) => l.special === 'parkplatz').length).toBeLessThanOrEqual(1);
    for (const l of sp) expect(streetDist(m, l.x, l.z).d).toBeGreaterThan(0);
  });

  it('v2: L-shaped lots keep their wing off streets and out of the water, shops exist', () => {
    const m = koepenickMap(1);
    const lots = generateLots(m);
    const wings = lots.filter((l) => l.wing);
    // M11d step 5: the hand-built zone 0 blocks replace some generated L lots (seeded count, was > 5).
    expect(wings.length).toBeGreaterThanOrEqual(3);
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
    // M11c lot type fronts stay free of wrecks, so a few street cars fewer than before.
    expect(props.filter((p) => p.kind === 'car').length).toBeGreaterThan(25);
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

  it('street lamps: at the curb, evenly spaced along each street, about a third lit; no same-kind twins', () => {
    const m = koepenickMap(1);
    const props = generateProps(m, generateLots(m));
    const lamps = props.filter((p) => p.kind === 'lantern' || p.kind === 'lampBroken');
    const lit = lamps.filter((p) => p.kind === 'lantern').length / lamps.length;
    expect(lit).toBeGreaterThan(0.2);
    expect(lit).toBeLessThan(0.45);
    for (const a of lamps) {
      const d = streetDist(m, a.x, a.z).d;
      expect(d).toBeGreaterThan(0.1);
      expect(d).toBeLessThan(1.6);
    }
    // Along a street, lamp gaps are whole multiples of the spacing (a blocked spot leaves a gap).
    let even = 0;
    let gaps = 0;
    for (const s of m.streets) {
      if (s.kind === 'path') continue;
      const spacing = LAMP_SPACING[s.kind === 'main' ? 'main' : 'side'];
      const segs = s.pts.slice(1).map((b, i) => [s.pts[i]!, b] as const);
      /** Position along the street and the side (+1 / -1) of a point. */
      const along = (x: number, z: number): { at: number; side: number } => {
        let best = Infinity;
        let at = 0;
        let side = 0;
        let acc = 0;
        for (const [a, b] of segs) {
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (l * l)));
          const dd = Math.hypot(x - a[0] - (b[0] - a[0]) * t, z - a[1] - (b[1] - a[1]) * t);
          if (dd < best) {
            best = dd;
            at = acc + t * l;
            side = Math.sign((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]));
          }
          acc += l;
        }
        return { at, side };
      };
      for (const side of [-1, 1]) {
        const row = lamps
          .filter((p) => streetDist(m, p.x, p.z).street === s && Math.abs(lineDist(s.pts, p.x, p.z) - (s.width / 2 + LAMP_CURB)) < 0.2)
          .map((p) => along(p.x, p.z))
          .filter((a) => a.side === side)
          .map((a) => a.at)
          .sort((a, b) => a - b);
        for (let i = 1; i < row.length; i++) {
          const g = row[i]! - row[i - 1]!;
          gaps++;
          const k = Math.max(1, Math.round(g / spacing));
          if (Math.abs(g - k * spacing) < 2.2) even++;
        }
      }
    }
    // Seeded count; moved to 20 when the zone 0 blocks became hand-built (M11d step 5).
    expect(gaps).toBeGreaterThanOrEqual(20);
    expect(even / gaps, 'evenly spaced lamp gaps').toBeGreaterThan(0.8);
    for (const [kind, gap] of Object.entries(SAME_KIND_GAP)) {
      const xs = props.filter((p) => p.kind === kind);
      for (const a of xs) for (const b of xs) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), kind).toBeGreaterThanOrEqual(gap!);
    }
  });

  it.each([1, 1.3])('light coverage: almost every street point has a light source within reach (scale %s)', (scale) => {
    const m = koepenickMap(scale);
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
          if (!anchors.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < lightCover(x, z) + 1)) dark++;
        }
      }
    }
    console.log(`scale ${scale}: light sources ${lights.length}, street samples ${n}, dark ${dark}`);
    // Under 2.5 % (was 2 %): the seeded layout shifted with the hand-built zone 0 blocks (M11d step 5).
    expect(dark / n).toBeLessThan(0.025);
    // Organic, not a grid: spacing to the nearest light varies a lot, and strengths differ.
    const nn = lights.map(([x, z], i) => Math.min(...lights.filter((_, j) => j !== i).map(([a, b]) => Math.hypot(a - x, b - z))));
    const mean = nn.reduce((a, b) => a + b, 0) / nn.length;
    const sd = Math.sqrt(nn.reduce((a, b) => a + (b - mean) ** 2, 0) / nn.length);
    expect(sd / mean, 'spacing variation').toBeGreaterThan(0.4);
    const sizes = new Set(props.filter((p) => LIGHT_PROPS.has(p.kind)).map((p) => p.size.toFixed(1)));
    expect(sizes.size, 'light strengths').toBeGreaterThan(5);
    expect(props.some((p) => p.kind === 'stringLights'), 'string lights').toBe(true);
  });

  it('bigger scale means a bigger map with more lots', () => {
    const a = generateLots(koepenickMap(1)).length;
    const b = generateLots(koepenickMap(1.3)).length;
    expect(b).toBeGreaterThan(a);
  });
});

describe('M16b side passages (variant A)', () => {
  it('the blessing, the sleeping elite and the cache sit at reachable ends off the route', () => {
    const m = koepenickMap(1), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots));
    const seen = new Set<string>(), q: Array<[number, number]> = [[Math.round(m.start.x), Math.round(m.start.z)]];
    while (q.length) {
      const [x, z] = q.pop()!, k = `${x},${z}`;
      if (seen.has(k) || x < m.bounds.minX || x > m.bounds.maxX || z < m.bounds.minZ || z > m.bounds.maxZ || level.blocked(x, z, 0.4)) continue;
      seen.add(k);
      q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    const near = (x: number, z: number): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => seen.has(`${Math.round(x) + a!},${Math.round(z) + b!}`));
    for (const h of m.hiddenSpots!) expect(near(h.x, h.z), `blessing ${h.x},${h.z}`).toBe(true);
    for (const g of m.guards!) expect(near(g.x, g.z), `guard ${g.x},${g.z}`).toBe(true);
    const cache = m.fixedProps.find(p => p.kind === 'crates')!;
    expect(near(cache.x + 2, cache.z - 2) || near(cache.x - 2, cache.z + 2), 'cache').toBe(true);
    for (const e of m.encounters) for (const g of m.guards!) expect(Math.hypot(e.x - g.x, e.z - g.z)).toBeGreaterThan(e.r + 8);
  });
});

describe('M11d street profiles', () => {
  it('the Bahnhofstraße (A) and the Spreeufer (C) get trees in pits on their sidewalks and keep buildings behind them', () => {
    const m = koepenickMap(1), lots = generateLots(m);
    // The Bahnhofstraße is mostly fight circles and the station forecourt (kept free), so fewer pits fit.
    // Spreeufer 5 (was 6): the seeded layout shifted with the hand-built zone 0 blocks (M11d step 5).
    for (const [name, min] of [['Bahnhofstraße', 2], ['Spreeufer', 5]] as const) {
      const st = m.streets.find(s => s.name === name)!;
      const pits = lots.filter(l => l.kind === 'tree' && Math.abs(lineDist(st.pts, l.x, l.z) - (st.width / 2 + 1.4)) < 0.3);
      expect(pits.length, name).toBeGreaterThanOrEqual(min);
      for (const l of lots) if (l.kind !== 'tree') expect(lineDist(st.pts, l.x, l.z), `${name} ${l.kind}`).toBeGreaterThan(st.width / 2 + st.sidewalk! - 0.5);
    }
  });
});

describe('M11d step 5: hand-built route blocks', () => {
  for (const scale of [1, 1.3]) {
    it(`stand off streets, sidewalks, fights, landmarks and water and are kept by the generator (scale ${scale})`, () => {
      const m = koepenickMap(scale);
      const lots = generateLots(m);
      expect(m.handLots!.length).toBeGreaterThanOrEqual(6);
      for (const h of m.handLots!) {
        expect(lots.some((l) => l.x === h.x && l.z === h.z && l.kind === h.kind), `${h.x},${h.z}`).toBe(true);
        const c = Math.cos(h.rot), sn = Math.sin(h.rot);
        for (const [a, b] of [[-h.w / 2, -h.d / 2], [h.w / 2, -h.d / 2], [-h.w / 2, h.d / 2], [h.w / 2, h.d / 2], [0, h.d / 2]] as const) {
          const x = h.x + c * a + sn * b, z = h.z - sn * a + c * b;
          const sd = streetDist(m, x, z);
          expect(sd.d, `${h.x},${h.z} on ${sd.street?.name}`).toBeGreaterThan((sd.street?.sidewalk ?? 1.2) - 0.15);
          expect(isWater(m, x, z)).toBe(false);
          for (const e of m.encounters) expect(Math.hypot(x - e.x, z - e.z), e.id).toBeGreaterThan(e.r);
          for (const l of m.landmarks) expect(Math.abs(x - l.x) < l.hx && Math.abs(z - l.z) < l.hz, l.kind).toBe(false);
        }
      }
    });
  }
});
