import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { GROSSER_STERN, MITTE_BOSSES, mitteMap } from './mitte';
import { EDGE_FRONT, propCollider } from './courtyard';
import { areaAt, generateLots, generateProps, isWater, LAMP_CURB, LIGHT_PROPS, lightCover, lineDist, mapLevel, OPEN_PARTS, SAME_KIND_GAP, streetDist, TOR_BAR, TOR_PASSAGES, type MapDef } from './map';
import type { Level } from '../sim/level';
import { createSim, stepSim } from '../sim/sim';
import { NO_INPUT, type SimEvent } from '../sim/types';

/** Cells (1 m) the hero can reach from the start: off water and, unlike the Xhain fill, around every collider too. */
function reach(m: MapDef, level: Level): Set<string> {
  const seen = new Set<string>(), q: Array<[number, number]> = [[Math.round(m.start.x), Math.round(m.start.z)]];
  const solid = (x: number, z: number): boolean => level.blocked(x, z, 0.4) || level.near(x, z, 1).some((c) => colliderDistance(c, x, z) < 0.4);
  while (q.length) {
    const [x, z] = q.pop()!, k = `${x},${z}`;
    if (seen.has(k) || x < m.bounds.minX || x > m.bounds.maxX || z < m.bounds.minZ || z > m.bounds.maxZ || solid(x, z)) continue;
    seen.add(k);
    q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}
const near = (seen: Set<string>, x: number, z: number): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].some(([a, b]) => seen.has(`${Math.round(x) + a!},${Math.round(z) + b!}`));
const normal = (m: MapDef) => m.encounters.flatMap((e) => e.waves).filter((w) => w.bosses.length === 0);

describe('Mitte map (M15, layout B2)', () => {
  for (const scale of [1, 1.3]) {
    const m = mitteMap(scale);
    const lots = generateLots(m);
    const props = generateProps(m, lots);
    const level = mapLevel(m, lots, props);
    const seen = reach(m, level);

    it(`has 27 normal waves (9, 9, a calm 2, 7) and four bosses, district 3 with neon loot (scale ${scale})`, () => {
      expect(normal(m)).toHaveLength(27);
      const perZone = [0, 1, 2, 3].map((z) => m.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves).filter((w) => w.bosses.length === 0).length);
      expect(perZone).toEqual([9, 9, 2, 7]);
      expect(m.encounters.flatMap((e) => e.waves).flatMap((w) => w.bosses)).toEqual([MITTE_BOSSES.tor, MITTE_BOSSES.kanzleramt, MITTE_BOSSES.see, MITTE_BOSSES.sony]);
      expect(m.district).toBe(3);
      expect(m.flavor).toBe('neon');
      expect(m.wet).toBe(true);
      expect(m.encounters.at(-1)!.id).toBe('sony');
    });

    it(`gets harder wave by wave; the Tiergarten waves are smaller and have no elites (scale ${scale})`, () => {
      const waves = normal(m);
      expect(waves[0]!.hpMul).toBeGreaterThan(3);
      for (let i = 1; i < waves.length; i++) expect(waves[i]!.hpMul).toBeGreaterThan(waves[i - 1]!.hpMul);
      const calm = m.encounters.filter((e) => e.zone === 2).flatMap((e) => e.waves).filter((w) => w.bosses.length === 0);
      const before = m.encounters.filter((e) => e.zone === 1).flatMap((e) => e.waves).at(-2)!;
      for (const w of calm) {
        expect(w.elite).toBe(0);
        expect(w.count).toBeLessThan(before.count);
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
        for (let a = 0; a < Math.PI * 2; a += 0.2) expect(isWater(m, e.x + Math.sin(a) * e.r, e.z + Math.cos(a) * e.r), `${e.id} water`).toBe(false);
      }
    });

    it(`has five neon bars across the Tor passages, pier to pier, open at build time (P25, scale ${scale})`, () => {
      const tor = m.landmarks.find((l) => l.kind === 'tor')!;
      const c = Math.cos(tor.rot), sn = Math.sin(tor.rot);
      expect(level.barriers).toHaveLength(5);
      expect(level.barriers.map((b) => b.half)).toEqual(TOR_PASSAGES.map(([, h]) => h));
      for (const [i, b] of level.barriers.entries()) {
        expect(level.colliders).not.toContain(b.collider);
        expect(level.isShut(b.collider)).toBe(false);
        // Along the bar plane from pier centre to pier centre, a 0.3 m body overlaps the bar or a pier everywhere.
        const [lx, half] = TOR_PASSAGES[i]!;
        for (let a = lx - half - 1.3; a <= lx + half + 1.3; a += 0.05) {
          const x = tor.x + c * a + sn * TOR_BAR.z, z = tor.z - sn * a + c * TOR_BAR.z;
          const d = Math.min(colliderDistance(b.collider, x, z), ...level.near(x, z, 1).map((q) => colliderDistance(q, x, z)));
          expect(d, `passage ${lx} at ${a.toFixed(2)}`).toBeLessThan(0.3);
        }
        // Open, the passage stays walkable at the bar.
        expect(level.near(b.x, b.z, 1).every((q) => colliderDistance(q, b.x, b.z) > 0.4), `passage ${lx} open`).toBe(true);
      }
    });

    it(`walks through the Brandenburger Tor, into the Sony Center forum and around the Siegessäule (scale ${scale})`, () => {
      // Every passage of the Tor is open, every pillar wall blocks.
      const tor = m.landmarks.find((l) => l.kind === 'tor')!;
      const c = Math.cos(tor.rot), sn = Math.sin(tor.rot);
      const at = (lx: number, lz: number): [number, number] => [tor.x + c * lx + sn * lz, tor.z - sn * lx + c * lz];
      for (const lx of [-13.725, -7.325, 0, 7.325, 13.725]) {
        const [x, z] = at(lx, 0);
        expect(level.blocked(x, z, 0.4), `passage ${lx}`).toBe(false);
        expect(near(seen, x, z), `passage ${lx} reached`).toBe(true);
      }
      const hit = (x: number, z: number): boolean => level.near(x, z, 0.5).some((q) => colliderDistance(q, x, z) <= 0);
      for (const p of OPEN_PARTS.tor!) expect(hit(...at(p.x, p.z)), `pillar ${p.x}`).toBe(true);
      // The forum is reached through the gaps between the Sony blocks; the blocks themselves block.
      const sony = m.landmarks.find((l) => l.kind === 'sony')!;
      for (const d of [30, 90, 150, 210, 270, 330]) {
        const a = (d * Math.PI) / 180;
        expect(near(seen, sony.x + Math.sin(a) * 24, sony.z + Math.cos(a) * 24), `gap ${d}`).toBe(true);
      }
      expect(hit(sony.x, sony.z + 24)).toBe(true);
      // The Großer Stern is a roundabout: its ring road runs all the way round the island with the column in the middle.
      const st = { x: GROSSER_STERN.x * scale, z: GROSSER_STERN.z * scale };
      expect(hit(st.x, st.z)).toBe(true);
      const ring = m.streets.find((q) => q.name === 'Großer Stern')!;
      for (let a = 0; a < Math.PI * 2; a += 0.25) {
        const x = st.x + Math.sin(a) * GROSSER_STERN.ring * scale, z = st.z + Math.cos(a) * GROSSER_STERN.ring * scale;
        expect(lineDist(ring.pts, x, z)).toBeLessThan(1);
        expect(near(seen, x, z), `ring ${a.toFixed(2)}`).toBe(true);
      }
    });

    it(`places buildings off streets and out of the water (scale ${scale})`, () => {
      const houses = lots.filter((l) => l.kind !== 'tree' && l.kind !== 'special');
      expect(houses.length).toBeGreaterThanOrEqual(60);
      for (const l of houses) {
        expect(isWater(m, l.x, l.z)).toBe(false);
        expect(streetDist(m, l.x, l.z).d).toBeGreaterThan(0);
      }
    });
  }

  it('every 20 m of street has a building, car or prop nearby', () => {
    const m = mitteMap(1);
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
          if (m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r)) continue;
          n++;
          if (!things.some((o) => Math.hypot(o.x - x, o.z - z) < 14)) empty++;
        }
      }
    }
    expect(empty / n).toBeLessThan(0.1);
  });

  it('no invisible walls: land at the map edge is closed by a visible front (M11d edge) or water', () => {
    for (const scale of [1, 1.3]) {
      const m = mitteMap(scale);
      const props = generateProps(m, generateLots(m));
      const fronts = props.filter((p) => EDGE_FRONT[p.kind] !== undefined || p.kind === 'fence').map((p) => propCollider(p)!);
      const B = m.bounds, pts: Array<[number, number]> = [];
      for (let x = B.minX + 0.5; x < B.maxX; x += 1) pts.push([x, B.minZ + 0.5], [x, B.maxZ - 0.5]);
      for (let z = B.minZ + 0.5; z < B.maxZ; z += 1) pts.push([B.minX + 0.5, z], [B.maxX - 0.5, z]);
      for (const [x, z] of pts) {
        if (isWater(m, x, z)) continue;
        expect(fronts.some((c) => colliderDistance(c, x, z) <= 0), `${scale}: ${x.toFixed(1)},${z.toFixed(1)}`).toBe(true);
      }
    }
  });

  it('step 7: the Potsdamer Platz gets Nachtmarkt, Containerdorf (one on the route) and two glass towers', () => {
    for (const scale of [1, 1.3]) {
      const m = mitteMap(scale), lots = generateLots(m), of = (k: string): number => lots.filter((l) => l.special === k).length;
      expect(of('nachtmarkt'), `${scale}`).toBeGreaterThanOrEqual(1);
      expect(of('containerdorf'), `${scale}`).toBeGreaterThanOrEqual(1);
      expect(lots.some((l) => l.special === 'containerdorf' && Math.hypot(l.x + 44 * scale, l.z - 160 * scale) < 1), `${scale}`).toBe(true);
      expect(m.landmarks.filter((l) => l.kind === 'glasbau').length).toBe(2);
    }
  });

  it('step 7, other zones (variant A): Markt and Clubhof, Sperrzone and Parkplatz, Zeltlager and Lichtung, spots reachable', () => {
    for (const scale of [1, 1.3]) {
      const m = mitteMap(scale), lots = generateLots(m), props = generateProps(m, lots), seen = reach(m, mapLevel(m, lots, props));
      const zone = (k: string, area: string): number => lots.filter((l) => l.special === k && areaAt(m, l.x, l.z)?.id === area).length;
      for (const [k, area] of [['markt', 'friedrichstadt'], ['clubhof', 'friedrichstadt'], ['sperrzone', 'regierung'], ['zeltlager', 'tiergarten'], ['lichtung', 'tiergarten']] as const) expect(zone(k, area), `${k} ${scale}`).toBeGreaterThanOrEqual(1);
      for (const l of lots) {
        if (l.kind !== 'special' || !['clubhof', 'sperrzone', 'zeltlager', 'lichtung'].includes(l.special!)) continue;
        for (const [name, p] of Object.entries(l.content!.spots)) if (p) expect(near(seen, p[0], p[1]), `${l.special} ${name} ${scale}`).toBe(true);
      }
    }
  }, 30_000);

  it('street lamps at the curb, about a third lit; no same-kind twins', () => {
    const m = mitteMap(1);
    const props = generateProps(m, generateLots(m));
    const lamps = props.filter((p) => p.kind === 'lantern' || p.kind === 'lampBroken');
    const lit = lamps.filter((p) => p.kind === 'lantern').length / lamps.length;
    expect(lit).toBeGreaterThan(0.2);
    expect(lit).toBeLessThan(0.45);
    // Hand-placed beer garden lanterns stand off the street.
    for (const a of lamps.filter((p) => !m.fixedProps.includes(p))) {
      const d = streetDist(m, a.x, a.z).d;
      expect(d).toBeGreaterThan(0.1);
      expect(d).toBeLessThan(1.6);
    }
    for (const [kind, gap] of Object.entries(SAME_KIND_GAP)) {
      const xs = props.filter((p) => p.kind === kind);
      for (const a of xs) for (const b of xs) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), kind).toBeGreaterThanOrEqual(gap!);
    }
    const length = (s: { pts: readonly (readonly [number, number])[] }): number => s.pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s.pts[i]![0], p[1] - s.pts[i]![1]), 0);
    for (const s of m.streets) if (s.kind !== 'path' && length(s) > 60) expect(lamps.some((p) => streetDist(m, p.x, p.z).street === s && Math.abs(lineDist(s.pts, p.x, p.z) - (s.width / 2 + LAMP_CURB)) < 0.2), s.name).toBe(true);
    expect(lamps.length).toBeGreaterThan(30);
  });

  it.each([1, 1.3])('light coverage: almost every street point has a light within reach (scale %s)', (scale) => {
    const m = mitteMap(scale);
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
          if (isWater(m, x, z)) continue;
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

  it('M16b: blessing, sleeping elite and the Checkpoint Charlie cache sit at reachable ends off the route', () => {
    const m = mitteMap(1), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots)), seen = reach(m, level);
    for (const h of m.hiddenSpots!) expect(near(seen, h.x, h.z), `blessing ${h.x},${h.z}`).toBe(true);
    for (const g of m.guards!) expect(near(seen, g.x, g.z), `guard ${g.x},${g.z}`).toBe(true);
    const cache = m.fixedProps.find((p) => p.kind === 'crates')!;
    expect(near(seen, cache.x + 2, cache.z - 2) || near(seen, cache.x - 2, cache.z + 2) || near(seen, cache.x + 2, cache.z + 2) || near(seen, cache.x - 2, cache.z - 2), 'cache').toBe(true);
    for (const e of m.encounters) for (const g of m.guards!) expect(Math.hypot(e.x - g.x, e.z - g.z)).toBeGreaterThan(e.r + 8);
  });

  it('one rest stop per zone (the beer garden at the Neuer See for the Tiergarten), reachable, away from fights', () => {
    const m = mitteMap(1), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots)), seen = reach(m, level);
    const spatis = m.landmarks.filter((l) => l.kind === 'spati');
    expect(spatis.map((l) => l.name)).toContain('Biergarten am Neuen See');
    expect(spatis).toHaveLength(4);
    for (const l of spatis) {
      const door = { x: l.x + Math.sin(l.rot) * 6, z: l.z + Math.cos(l.rot) * 6 };
      expect(near(seen, door.x, door.z), `${l.name} door`).toBe(true);
      for (const e of m.encounters) expect(Math.hypot(l.x - e.x, l.z - e.z), `${l.name} vs ${e.id}`).toBeGreaterThan(e.r + 6);
    }
  });

  it('bigger scale means more lots', () => {
    expect(generateLots(mitteMap(1.3)).length).toBeGreaterThan(generateLots(mitteMap(1)).length);
  });

  it('Blockrand: tall rows never stand on the camera side of their street', () => {
    const m = mitteMap(1), lots = generateLots(m).filter((l) => l.block);
    const tall = lots.filter((l) => l.kind === 'altbau' && l.floors >= 3);
    expect(tall.length).toBeGreaterThanOrEqual(12);
    for (const l of tall) expect(Math.cos(l.rot), `${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBeGreaterThan(-0.5);
    for (const l of lots.filter((q) => Math.cos(q.rot) < -0.5)) expect(l.floors).toBeLessThanOrEqual(1);
  });

  it('a scripted run clears all 31 waves, the four bosses and ends in victory', () => {
    const m = mitteMap(1), level = mapLevel(m, generateLots(m));
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
  }, 30000);
});
