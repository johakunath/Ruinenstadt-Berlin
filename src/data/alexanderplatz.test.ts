import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { alexMap, ALEX_BOSS_STANDIN } from './alexanderplatz';
import { EDGE_FRONT, propCollider } from './courtyard';
import { barrierDist, inRailYard, generateLots, generateProps, isWater, LAMP_CURB, LAMP_SPACING, LIGHT_PROPS, lightCover, lineDist, mapLevel, onBridge, SAME_KIND_GAP, streetDist, type MapDef } from './map';
import type { Level } from '../sim/level';
import { createSim, stepSim } from '../sim/sim';
import { NO_INPUT, type SimEvent } from '../sim/types';

/** Cells (1 m) the hero can reach from the start. */
function reach(m: MapDef, level: Level): Set<string> {
  const seen = new Set<string>(), q: Array<[number, number]> = [[Math.round(m.start.x), Math.round(m.start.z)]];
  while (q.length) {
    const [x, z] = q.pop()!, k = `${x},${z}`;
    if (seen.has(k) || x < m.bounds.minX || x > m.bounds.maxX || z < m.bounds.minZ || z > m.bounds.maxZ || level.blocked(x, z, 0.4)) continue;
    seen.add(k);
    q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}
const near = (seen: Set<string>, x: number, z: number): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].some(([a, b]) => seen.has(`${Math.round(x) + a!},${Math.round(z) + b!}`));

describe('Alexanderplatz map (M15, layout C)', () => {
  for (const scale of [1, 1.3]) {
    const m = alexMap(scale);
    const lots = generateLots(m);
    const props = generateProps(m, lots);
    const level = mapLevel(m, lots, props);
    const seen = reach(m, level);

    it(`has 27 normal waves and four bosses (scale ${scale})`, () => {
      const waves = m.encounters.flatMap((e) => e.waves);
      expect(waves.filter((w) => w.bosses.length === 0)).toHaveLength(27);
      expect(waves.flatMap((w) => w.bosses)).toEqual([ALEX_BOSS_STANDIN.insel, ALEX_BOSS_STANDIN.spree, ALEX_BOSS_STANDIN.allee, ALEX_BOSS_STANDIN.uhr]);
      const perZone = [0, 1, 2].map((z) => m.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves).filter((w) => w.bosses.length === 0).length);
      expect(perZone).toEqual([9, 9, 9]);
      expect(m.district).toBe(2);
    });

    it(`gets harder wave by wave and starts above Xhain's first waves (scale ${scale})`, () => {
      const waves = m.encounters.flatMap((e) => e.waves).filter((w) => w.bosses.length === 0);
      expect(waves[0]!.hpMul).toBeGreaterThan(3);
      for (let i = 1; i < waves.length; i++) {
        expect(waves[i]!.hpMul).toBeGreaterThan(waves[i - 1]!.hpMul);
        expect(waves[i]!.count).toBeGreaterThanOrEqual(waves[i - 1]!.count);
      }
    });

    it(`keeps encounter circles, start and zone entries walkable, free and reachable (scale ${scale})`, () => {
      const spots = [m.start, ...m.zones.map((z) => z.entry), ...m.encounters.map((e) => ({ x: e.x, z: e.z }))];
      for (const p of spots) {
        expect(level.blocked(p.x, p.z, 0.5), `${p.x},${p.z}`).toBe(false);
        for (const c of level.near(p.x, p.z, 2)) expect(colliderDistance(c, p.x, p.z), `${p.x},${p.z}`).toBeGreaterThan(0.5);
        expect(near(seen, p.x, p.z), `reach ${p.x},${p.z}`).toBe(true);
      }
      for (const e of m.encounters) {
        let open = 0, n = 0;
        for (let a = 0; a < Math.PI * 2; a += 0.3) {
          for (const f of [0.3, 0.6, 0.9]) {
            const x = e.x + Math.sin(a) * e.r * f, z = e.z + Math.cos(a) * e.r * f;
            n++;
            if (!level.blocked(x, z, 0.4) && level.near(x, z, 1).every((c) => colliderDistance(c, x, z) > 0.4)) open++;
          }
        }
        expect(open / n, e.id).toBeGreaterThan(0.8);
        // No water inside a fight.
        for (let a = 0; a < Math.PI * 2; a += 0.2) expect(isWater(m, e.x + Math.sin(a) * e.r, e.z + Math.cos(a) * e.r), `${e.id} water`).toBe(false);
      }
    });

    it(`bridges are walkable; the island is reached over the Monbijoubrücke; the viaduct opens at its arches (scale ${scale})`, () => {
      for (const b of m.bridges) {
        expect(onBridge(m, b.x, b.z)).toBe(b);
        expect(level.blocked(b.x, b.z, 0.5)).toBe(false);
        expect(near(seen, b.x, b.z), b.name).toBe(true);
      }
      // Every encounter is reachable from the start, so the arches are open.
      for (const e of m.encounters) expect(near(seen, e.x, e.z), e.id).toBe(true);
      // The viaduct is solid between its arches.
      expect(m.viaducts!.length).toBe(4);
      const v = m.viaducts![1]!, [ax, az] = v.pts[0]!, [bx, bz] = v.pts[1]!, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      expect(level.near(mx, mz, 1).some((c) => colliderDistance(c, mx, mz) <= 0)).toBe(true);
    });

    it(`places buildings off streets, out of the water and off the Wall (scale ${scale})`, () => {
      const houses = lots.filter((l) => l.kind !== 'tree' && l.kind !== 'special');
      expect(houses.length).toBeGreaterThanOrEqual(50);
      for (const l of houses) {
        expect(isWater(m, l.x, l.z)).toBe(false);
        expect(streetDist(m, l.x, l.z).d).toBeGreaterThan(0);
      }
    });
  }

  it('route: start in the north-west, final fight at the Weltzeituhr, which stands beside the circle centre', () => {
    const m = alexMap(1);
    const final = m.encounters[m.encounters.length - 1]!;
    expect(final.id).toBe('weltzeituhr');
    const clock = m.landmarks.find((l) => l.kind === 'weltzeituhr')!;
    const d = Math.hypot(clock.x - final.x, clock.z - final.z);
    expect(d).toBeGreaterThan(clock.hx + 2);
    expect(d).toBeLessThan(final.r);
    expect(m.start.x).toBeLessThan(-100);
    expect(m.start.z).toBeLessThan(-100);
  });

  it('every 20 m of street has a building, car or prop nearby', () => {
    const m = alexMap(1);
    const lots = generateLots(m).filter((l) => l.kind !== 'tree');
    const props = generateProps(m, lots);
    const things = [...lots, ...props];
    let empty = 0, n = 0;
    for (const s of m.streets) {
      if (s.kind === 'path') continue;
      for (let i = 1; i < s.pts.length; i++) {
        const [ax, az] = s.pts[i - 1]!, [bx, bz] = s.pts[i]!, len = Math.hypot(bx - ax, bz - az);
        for (let t = 10; t < len; t += 20) {
          const x = ax + ((bx - ax) / len) * t, z = az + ((bz - az) / len) * t;
          if (onBridge(m, x, z, 2) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
          n++;
          if (!things.some((o) => Math.hypot(o.x - x, o.z - z) < 14)) empty++;
        }
      }
    }
    expect(empty / n).toBeLessThan(0.1);
  });

  it('no invisible walls: land at the map edge is closed by a visible front (M11d edge), water or the viaduct', () => {
    for (const scale of [1, 1.3]) {
      const m = alexMap(scale);
      const props = generateProps(m, generateLots(m));
      const fronts = props.filter((p) => EDGE_FRONT[p.kind] !== undefined || p.kind === 'fence').map((p) => propCollider(p)!);
      const B = m.bounds, pts: Array<[number, number]> = [];
      for (let x = B.minX + 0.5; x < B.maxX; x += 1) pts.push([x, B.minZ + 0.5], [x, B.maxZ - 0.5]);
      for (let z = B.minZ + 0.5; z < B.maxZ; z += 1) pts.push([B.minX + 0.5, z], [B.maxX - 0.5, z]);
      for (const [x, z] of pts) {
        if ((isWater(m, x, z) && !onBridge(m, x, z)) || inRailYard(m, x, z, 1) || barrierDist(m, x, z) <= 0.5) continue;
        expect(fronts.some((c) => colliderDistance(c, x, z) <= 0), `${scale}: ${x.toFixed(1)},${z.toFixed(1)}`).toBe(true);
      }
    }
  });

  it('street lamps at the curb, evenly spaced, about a third lit; no same-kind twins', () => {
    const m = alexMap(1);
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
    for (const [kind, gap] of Object.entries(SAME_KIND_GAP)) {
      const xs = props.filter((p) => p.kind === kind);
      for (const a of xs) for (const b of xs) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), kind).toBeGreaterThanOrEqual(gap!);
    }
    // Every non-path street has its curb row (spacing itself is the shared generator, tested on Köpenick).
    const length = (s: { pts: readonly (readonly [number, number])[] }): number => s.pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s.pts[i]![0], p[1] - s.pts[i]![1]), 0);
    // Short streets mostly covered by a fight may have no free curb spot.
    for (const s of m.streets) if (s.kind !== 'path' && length(s) > 60) expect(lamps.some((p) => streetDist(m, p.x, p.z).street === s && Math.abs(lineDist(s.pts, p.x, p.z) - (s.width / 2 + LAMP_CURB)) < 0.2), s.name).toBe(true);
    expect(lamps.length).toBeGreaterThan(20);
    expect(LAMP_SPACING.main).toBeGreaterThan(LAMP_SPACING.side);
  });

  it.each([1, 1.3])('light coverage: almost every street point has a light within reach (scale %s)', (scale) => {
    const m = alexMap(scale);
    const props = generateProps(m, generateLots(m));
    const lights = props.filter((p) => LIGHT_PROPS.has(p.kind)).map((p) => [p.x, p.z] as const);
    const anchors = [...lights, ...m.landmarks.filter((l) => l.hx > 0).map((l) => [l.x, l.z] as const)];
    let n = 0, dark = 0;
    for (const s of m.streets) {
      if (s.kind === 'path') continue;
      for (let i = 1; i < s.pts.length; i++) {
        const [ax, az] = s.pts[i - 1]!, [bx, bz] = s.pts[i]!, len = Math.hypot(bx - ax, bz - az);
        for (let t = 2; t < len; t += 4) {
          const x = ax + ((bx - ax) / len) * t, z = az + ((bz - az) / len) * t;
          if (onBridge(m, x, z, 1) || isWater(m, x, z)) continue;
          n++;
          if (!anchors.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < lightCover(x, z) + 1)) dark++;
        }
      }
    }
    expect(dark / n).toBeLessThan(0.02);
    const nn = lights.map(([x, z], i) => Math.min(...lights.filter((_, j) => j !== i).map(([a, b]) => Math.hypot(a - x, b - z))));
    const mean = nn.reduce((a, b) => a + b, 0) / nn.length;
    const sd = Math.sqrt(nn.reduce((a, b) => a + (b - mean) ** 2, 0) / nn.length);
    expect(sd / mean, 'spacing variation').toBeGreaterThan(0.4);
    expect(new Set(props.filter((p) => LIGHT_PROPS.has(p.kind)).map((p) => p.size.toFixed(1))).size).toBeGreaterThan(5);
  });

  it('M16b: blessing, sleeping elite and cache sit at reachable ends off the route', () => {
    const m = alexMap(1), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots)), seen = reach(m, level);
    for (const h of m.hiddenSpots!) expect(near(seen, h.x, h.z), `blessing ${h.x},${h.z}`).toBe(true);
    for (const g of m.guards!) expect(near(seen, g.x, g.z), `guard ${g.x},${g.z}`).toBe(true);
    const cache = m.fixedProps.find((p) => p.kind === 'crates')!;
    expect(near(seen, cache.x + 2, cache.z - 2) || near(seen, cache.x - 2, cache.z + 2) || near(seen, cache.x + 2, cache.z + 2) || near(seen, cache.x - 2, cache.z - 2), 'cache').toBe(true);
    for (const e of m.encounters) for (const g of m.guards!) expect(Math.hypot(e.x - g.x, e.z - g.z)).toBeGreaterThan(e.r + 8);
  });

  it('one Späti per zone, reachable, away from fight circles', () => {
    const m = alexMap(1), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots)), seen = reach(m, level);
    const spatis = m.landmarks.filter((l) => l.kind === 'spati');
    expect(spatis).toHaveLength(4);
    for (const l of spatis) {
      const door = { x: l.x + Math.sin(l.rot) * 6, z: l.z + Math.cos(l.rot) * 6 };
      expect(near(seen, door.x, door.z), `${l.name} door`).toBe(true);
      for (const e of m.encounters) expect(Math.hypot(l.x - e.x, l.z - e.z), `${l.name} vs ${e.id}`).toBeGreaterThan(e.r + 6);
    }
  });

  it('bigger scale means more lots', () => {
    expect(generateLots(alexMap(1.3)).length).toBeGreaterThan(generateLots(alexMap(1)).length);
  });

  it('a scripted run clears all 31 waves, the four bosses and ends in victory', () => {
    const m = alexMap(1), level = mapLevel(m, generateLots(m));
    level.guards = [];
    const sim = createSim({ level }), log: SimEvent[] = [];
    while (sim.run.phase !== 'won') {
      const enc = sim.level.encounters[sim.run.index]!;
      const p = sim.player;
      p.x = p.px = enc.x;
      p.z = p.pz = enc.z;
      p.invuln = 1e9;
      for (let i = 0; i < 60 * 120 && sim.run.index < sim.level.encounters.length && sim.level.encounters[sim.run.index] === enc; i++) {
        stepSim(sim, NO_INPUT);
        for (const e of sim.enemies) if (e.state !== 'dead' && e.stateT > 0.3) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
        log.push(...sim.events);
        sim.events.length = 0;
      }
    }
    expect(log.filter((e) => e.type === 'waveStart')).toHaveLength(31);
    expect(log.filter((e) => e.type === 'zoneClear').map((e) => (e as { zone: number }).zone)).toEqual([0, 1, 2, 3]);
    expect(log.at(-1)?.type).toBe('victory');
  });

  it('rows (M15 Blockrand): Plattenbau slabs and Altbau stand tall only away from the camera; pavilions on the camera side', () => {
    const m = alexMap(1), lots = generateLots(m).filter((l) => l.block);
    const tall = lots.filter((l) => l.floors >= 3);
    expect(generateLots(m).filter((l) => l.kind === 'platte' && l.floors >= 5).length).toBeGreaterThanOrEqual(6);
    expect(lots.filter((l) => l.kind === 'shop').length).toBeGreaterThanOrEqual(4);
    for (const l of tall) expect(Math.cos(l.rot), `${l.kind} ${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBeGreaterThan(-0.5);
  });

  it('lot types (M11c): glass house gardens on the island, Plattenbau courtyards by the Allee', () => {
    for (const scale of [1, 1.3]) {
      const m = alexMap(scale), lots = generateLots(m);
      const of = (k: string): number => lots.filter((l) => l.kind === 'special' && l.special === k).length;
      expect(of('glashaus'), `glashaus ${scale}`).toBeGreaterThanOrEqual(1);
      expect(of('plattenhof'), `plattenhof ${scale}`).toBeGreaterThanOrEqual(1);
    }
  });
});
