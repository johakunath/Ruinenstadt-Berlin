import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { CHARLOTTENBURG_BOSS_STANDIN, charlottenburgMap, IRRGARTEN, PLATFORM } from './charlottenburg';
import { EDGE_FRONT, propCollider } from './courtyard';
import { generateLots, generateProps, heightAt, inPoly, isWater, onStair, LAMP_CURB, landmarkColliders, LIGHT_PROPS, lightCover, lineDist, mapLevel, onBridge, OPEN_PARTS, SAME_KIND_GAP, streetDist, type Landmark, type MapDef } from './map';
import type { Level } from '../sim/level';
import { Rng } from '../sim/math';
import { freeSpot } from '../sim/reach';
import { createSim, stepSim } from '../sim/sim';
import { NO_INPUT, type SimEvent } from '../sim/types';

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
/** Cells (1 m) the hero can reach from `from` inside `box` (default the map): off water and around every collider. */
function reach(m: MapDef, level: Level, from: { x: number; z: number } = m.start, box: Box = m.bounds, closed: (x: number, z: number) => boolean = () => false): Set<string> {
  const seen = new Set<string>(), q: Array<[number, number]> = [[Math.round(from.x), Math.round(from.z)]];
  const solid = (x: number, z: number): boolean => closed(x, z) || level.blocked(x, z, 0.4) || level.near(x, z, 1).some((c) => colliderDistance(c, x, z) < 0.4);
  while (q.length) {
    const [x, z] = q.pop()!, k = `${x},${z}`;
    if (seen.has(k) || x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ || solid(x, z)) continue;
    seen.add(k);
    q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}
const near = (seen: Set<string>, x: number, z: number): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].some(([a, b]) => seen.has(`${Math.round(x) + a!},${Math.round(z) + b!}`));
const normal = (m: MapDef) => m.encounters.flatMap((e) => e.waves).filter((w) => w.bosses.length === 0);
const lm = (m: MapDef, kind: Landmark['kind']): Landmark => m.landmarks.find((l) => l.kind === kind)!;
/** World point of a landmark's local (x along its front, z out of it). */
const at = (l: Landmark, lx: number, lz: number): [number, number] => [l.x + Math.cos(l.rot) * lx + Math.sin(l.rot) * lz, l.z - Math.sin(l.rot) * lx + Math.cos(l.rot) * lz];
/** Inside a landmark's rotated footprint. */
const inFoot = (l: Landmark, x: number, z: number, pad: number): boolean => { const dx = x - l.x, dz = z - l.z, c = Math.cos(l.rot), sn = Math.sin(l.rot); return Math.abs(dx * c - dz * sn) < l.hx + pad && Math.abs(dx * sn + dz * c) < l.hz + pad; };

describe('Charlottenburg map (M16, layout C2)', () => {
  for (const scale of [1, 1.3]) {
    const m = charlottenburgMap(scale);
    const lots = generateLots(m);
    const props = generateProps(m, lots);
    const level = mapLevel(m, lots, props);
    const seen = reach(m, level);
    const solid = (x: number, z: number): boolean => level.blocked(x, z, 0.4) || level.near(x, z, 1).some((c) => colliderDistance(c, x, z) < 0.4);

    it(`has 30 normal waves (8, 9, 10, 3) and one boss per zone, district 4 (scale ${scale})`, () => {
      expect(normal(m)).toHaveLength(30);
      const perZone = [0, 1, 2, 3].map((z) => m.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves).filter((w) => w.bosses.length === 0).length);
      expect(perZone).toEqual([8, 9, 10, 3]);
      const B = CHARLOTTENBURG_BOSS_STANDIN;
      expect(m.encounters.flatMap((e) => e.waves).flatMap((w) => w.bosses)).toEqual([B.kirche, B.oper, B.belvedere, B.diva]);
      for (const z of [0, 1, 2, 3]) expect(m.encounters.filter((e) => e.zone === z && e.waves.some((w) => w.bosses.length > 0)).map((e) => e.zone)).toEqual([z]);
      expect(m.encounters.map((e) => e.zone)).toEqual([...m.encounters.map((e) => e.zone)].sort((a, b) => a - b));
      expect(m.district).toBe(4);
      expect(m.flavor).toBeUndefined();
      expect(m.encounters.length).toBe(15);
      expect(m.encounters.at(-1)!.id).toBe('ehrenhof');
    });

    it(`gets harder wave by wave from tier 32 to 54; the Karpfenteich is calm (scale ${scale})`, () => {
      const waves = normal(m);
      expect(waves[0]!.hpMul).toBeCloseTo(1 + 32 * 0.13);
      expect(waves.at(-1)!.hpMul).toBeCloseTo(1 + 54 * 0.13);
      for (let i = 1; i < waves.length; i++) expect(waves[i]!.hpMul).toBeGreaterThan(waves[i - 1]!.hpMul);
      const pond = m.encounters.find((e) => e.id === 'karpfenteich')!, before = m.encounters.find((e) => e.id === 'irrgarten')!.waves.at(-1)!;
      for (const w of pond.waves) {
        expect(w.elite).toBe(0);
        expect(w.count).toBeLessThan(before.count);
      }
      for (const w of waves.filter((q) => !pond.waves.includes(q))) expect(w.elite).toBeGreaterThan(0);
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

    it(`places buildings off streets and out of the water, none on the viaduct (scale ${scale})`, () => {
      const houses = lots.filter((l) => l.kind !== 'tree' && l.kind !== 'special');
      expect(houses.length).toBeGreaterThanOrEqual(50);
      for (const l of houses) {
        expect(isWater(m, l.x, l.z)).toBe(false);
        expect(streetDist(m, l.x, l.z).d).toBeGreaterThan(0);
        for (const v of m.viaducts!) expect(lineDist(v.pts, l.x, l.z), `${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBeGreaterThan(v.width / 2);
      }
    });

    it(`the Stadtbahn blocks except at its arches; the streets pass through them (scale ${scale})`, () => {
      // Every street crossing the rail line is open where it crosses, the viaduct runs between are solid.
      for (const name of ['Bleibtreustraße', 'Kantstraße', 'Hardenbergstraße']) {
        const st = m.streets.find((q) => q.name === name)!;
        let best = Infinity, px = 0, pz = 0;
        const railPts = m.viaducts!.flatMap((v) => v.pts);
        for (let i = 1; i < st.pts.length; i++) for (let t = 0; t <= 1; t += 0.01) {
          const x = st.pts[i - 1]![0] + (st.pts[i]![0] - st.pts[i - 1]![0]) * t, z = st.pts[i - 1]![1] + (st.pts[i]![1] - st.pts[i - 1]![1]) * t;
          const d = Math.min(...railPts.map(([a, b]) => Math.hypot(a - x, b - z)));
          if (d < best) { best = d; px = x; pz = z; }
        }
        expect(near(seen, px, pz), `${name} arch`).toBe(true);
      }
      for (const v of m.viaducts!) {
        const [ax, az] = v.pts[0]!, [bx, bz] = v.pts[1]!, l = Math.hypot(bx - ax, bz - az);
        if (l < 4) continue;
        const x = (ax + bx) / 2, z = (az + bz) / 2;
        expect(solid(x, z), `viaduct ${x.toFixed(0)},${z.toFixed(0)}`).toBe(true);
      }
      expect(m.viaducts!.length).toBe(4);
    });

    it(`the Schloßbrücke is walkable but closed on its deck; the bank beyond the Spree is never reached (scale ${scale})`, () => {
      const b = m.bridges[0]!, ux = Math.sin(b.rot), uz = Math.cos(b.rot);
      expect(onBridge(m, b.x - ux * (b.len / 2 - 2), b.z - uz * (b.len / 2 - 2))).toBe(b);
      expect(near(seen, b.x - ux * (b.len / 2 - 2), b.z - uz * (b.len / 2 - 2)), 'west head').toBe(true);
      expect(near(seen, b.x, b.z), 'deck middle').toBe(true);
      expect(near(seen, b.x + ux * (b.len / 2 - 2), b.z + uz * (b.len / 2 - 2)), 'east head').toBe(false);
      // Nothing of the backdrop bank (north-east of the river) is reachable.
      for (const k of seen) { const [x, z] = k.split(',').map(Number) as [number, number]; expect(x > 60 * scale && z < -60 * scale, k).toBe(false); }
    });

    it(`the Zoo is entered only through the Löwentor and the Elefantentor (scale ${scale})`, () => {
      const gates = [lm(m, 'loewentor'), lm(m, 'elefantentor')];
      // Pillars block, the passage between them is open.
      for (const g of gates) {
        for (const p of OPEN_PARTS[g.kind]!) expect(level.near(...at(g, p.x, p.z), 0.5).some((c) => colliderDistance(c, ...at(g, p.x, p.z)) <= 0), `${g.kind} pillar`).toBe(true);
        expect(near(seen, ...at(g, 0, 0)), `${g.kind} passage`).toBe(true);
      }
      const inZoo = { x: 124 * scale, z: 86 * scale };
      expect(near(seen, inZoo.x, inZoo.z)).toBe(true);
      const shut = reach(m, level, m.start, m.bounds, (x, z) => gates.some((g) => inFoot(g, x, z, 0.6)));
      expect(near(shut, inZoo.x, inZoo.z), 'Zoo with both gates shut').toBe(false);
      for (const g of gates) {
        const other = gates.find((q) => q !== g)!;
        const one = reach(m, level, m.start, m.bounds, (x, z) => inFoot(other, x, z, 0.6));
        expect(near(one, inZoo.x, inZoo.z), `only ${g.kind} open`).toBe(true);
      }
    });

    it(`the maze has no sealed pocket and its Rondell is reached (scale ${scale})`, () => {
      const f = m.encounters.find((e) => e.id === 'irrgarten')!;
      expect(near(seen, f.x, f.z)).toBe(true);
      let cells = 0;
      for (let x = Math.ceil(f.x - IRRGARTEN.hx + 1); x < f.x + IRRGARTEN.hx - 1; x++) for (let z = Math.ceil(f.z - IRRGARTEN.hz + 1); z < f.z + IRRGARTEN.hz - 1; z++) {
        if (solid(x, z)) continue;
        cells++;
        expect(seen.has(`${x},${z}`), `pocket ${x},${z}`).toBe(true);
      }
      expect(cells).toBeGreaterThan(800);
      // Hedges really block: the straight line from the entrance to the Rondell crosses them.
      const hedges = m.walls!.filter((w) => w.kind === 'hedge');
      expect(hedges.length).toBeGreaterThanOrEqual(10);
      expect(solid(f.x + 22, f.z), 'east wing hedge').toBe(true);
      expect(solid(f.x - 28, f.z), 'west wing hedge').toBe(true);
    });

    it(`the KaDeWe Lichthof and the Orangerie ruin can be walked through (scale ${scale})`, () => {
      const halls: Array<[Landmark, Array<[number, number]>]> = [[lm(m, 'kadewe'), [[-10.5, -15.5], [8.5, -15.5]]], [lm(m, 'orangerie'), [[0.25, -11.5], [0, 11.5]]]];
      for (const [h, doors] of halls) {
        const box = { minX: h.x - h.hx, maxX: h.x + h.hx, minZ: h.z - h.hz, maxZ: h.z + h.hz };
        const inside = reach(m, level, h, box);
        expect(inside.size, h.kind).toBeGreaterThan(300);
        for (const [dx, dz] of doors) {
          const sgn = Math.sign(dz);
          expect(near(inside, ...at(h, dx, dz - sgn * 1.5)), `${h.kind} door ${dx},${dz} inside`).toBe(true);
          expect(near(seen, ...at(h, dx, dz + sgn * 2)), `${h.kind} door ${dx},${dz} outside`).toBe(true);
        }
        // Walls block.
        for (const p of OPEN_PARTS[h.kind]!) expect(solid(...at(h, p.x, p.z)), `${h.kind} wall ${p.x},${p.z}`).toBe(true);
      }
    });

    it(`the Ehrenhof is shut from the south and entered from the Orangerie side (scale ${scale})`, () => {
      const gate = lm(m, 'ehrenhoftor'), court = m.encounters.find((e) => e.id === 'ehrenhof')!, hall = lm(m, 'orangerie'), C = lm(m, 'schlossmitte');
      expect(near(seen, court.x, court.z)).toBe(true);
      // The gate collider spans the whole court.
      for (let a = -21; a <= 21; a += 1) expect(solid(gate.x + a, gate.z), `gate ${a}`).toBe(true);
      // From the street in front of the gate, without the garden: the court is out of reach.
      const front = reach(m, level, { x: gate.x, z: gate.z + 3 }, { minX: gate.x - 30, maxX: gate.x + 30, minZ: C.z - 10, maxZ: gate.z + 4 });
      expect(front.size).toBeGreaterThan(40);
      expect(near(front, court.x, court.z), 'court from the gate').toBe(false);
      // Court, forecourt and hall form one pocket, closed to the city; its way out is the hall's garden door.
      const pocket = reach(m, level, court, { minX: m.bounds.minX, maxX: m.bounds.maxX, minZ: C.z - 8, maxZ: m.bounds.maxZ });
      expect(near(pocket, hall.x, hall.z), 'hall from the court').toBe(true);
      expect(near(pocket, gate.x, gate.z + 6), 'street from the court').toBe(false);
      expect(near(pocket, m.start.x, m.start.z)).toBe(false);
      const sp = m.encounters.find((e) => e.id === 'spiegelgalerie')!;
      expect(inFoot(hall, sp.x, sp.z - sp.r / 2, 0)).toBe(true);
      expect(inFoot(hall, sp.x, sp.z + sp.r / 2, 0)).toBe(false);
    });

    it(`E8: the run starts on the platform of Bahnhof Zoo; the only way off is the stair to the Hardenbergplatz (scale ${scale})`, () => {
      const deck = m.terraces.find((t) => t.platform)!, st = deck.stairs[0]!;
      expect(m.terraces).toHaveLength(1);
      expect(inPoly(deck.poly, m.start.x, m.start.z)).toBe(true);
      expect(heightAt(m, m.start.x, m.start.z)).toBe(PLATFORM.h);
      expect(deck.h).toBe(m.viaducts![0]!.h);
      // The deck: everything reached from the start with the stair shut stays on it, and it is the whole platform.
      const onStairs = (x: number, z: number): boolean => onStair(deck, x, z, 0.5) !== null;
      const top = reach(m, level, m.start, m.bounds, onStairs);
      expect(top.size).toBeGreaterThan(60);
      for (const k of top) { const [x, z] = k.split(',').map(Number) as [number, number]; expect(inPoly(deck.poly, x, z), `off the deck ${k}`).toBe(true); }
      // The stair foot is at street level on the Hardenbergplatz side, reached from the start; the Löwentor and the kiosk from there.
      const foot = { x: st.x - Math.sin(st.rot) * (st.len / 2 + 1.5), z: st.z - Math.cos(st.rot) * (st.len / 2 + 1.5) };
      expect(heightAt(m, foot.x, foot.z)).toBe(0);
      expect(near(seen, foot.x, foot.z), 'stair foot').toBe(true);
      expect(Math.hypot(foot.x - lm(m, 'loewentor').x, foot.z - lm(m, 'loewentor').z)).toBeLessThan(20);
      const below = reach(m, level, foot, m.bounds, (x, z) => inPoly(deck.poly, x, z) || onStairs(x, z));
      expect(near(below, ...at(lm(m, 'loewentor'), 0, 2)), 'Löwentor from the stair foot').toBe(true);
      const kiosk = m.landmarks.find((l) => l.name === 'Kiosk am Zoo')!;
      expect(near(below, kiosk.x + Math.sin(kiosk.rot) * 6, kiosk.z + Math.cos(kiosk.rot) * 6), 'kiosk door').toBe(true);
      // Toward the camera: the stair runs down to the south-east.
      expect(-Math.cos(st.rot)).toBeGreaterThan(0.5);
      expect(-Math.sin(st.rot)).toBeGreaterThan(0.5);
      // The train blocks; the hall (walk-under) does not.
      for (const c of deck.solid!) expect(solid(c.x, c.z), 'train').toBe(true);
      expect(lm(m, 'zoobahnhof').walkUnder).toBe(true);
      // No spawns up there: the deck and the stair are a no-spawn zone, a wave that follows the hero comes from below.
      expect(level.noSpawnAt(m.start.x, m.start.z)).toBe(true);
      expect(level.noSpawnAt(st.x, st.z)).toBe(true);
      expect(level.noSpawnAt(foot.x + Math.sin(st.rot) * -4, foot.z + Math.cos(st.rot) * -4)).toBe(false);
      const rng = new Rng(7);
      for (let i = 0; i < 40; i++) {
        const q = freeSpot(level, rng, m.start.x, m.start.z, 0, 16, 0.6);
        if (q) expect(inPoly(deck.poly, q.x, q.z) || onStair(deck, q.x, q.z) !== null, `${q.x},${q.z}`).toBe(false);
      }
      expect(m.encounters.every((e) => !inPoly(deck.poly, e.x, e.z) && Math.hypot(e.x - m.start.x, e.z - m.start.z) > e.r + 20)).toBe(true);
    });

    it(`the Charlottenburger Tor lets the Chaussee through (scale ${scale})`, () => {
      const t = lm(m, 'chtor');
      expect(near(seen, t.x, t.z)).toBe(true);
      for (const p of OPEN_PARTS.chtor!) expect(solid(...at(t, p.x, p.z))).toBe(true);
    });
  }

  it('every 20 m of street has a building, car or prop nearby', () => {
    const m = charlottenburgMap(1);
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
      const m = charlottenburgMap(scale);
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

  it('street lamps at the curb, about a third lit; no same-kind twins', () => {
    for (const scale of [1, 1.3]) {
      const m = charlottenburgMap(scale);
      const props = generateProps(m, generateLots(m));
      const lamps = props.filter((p) => p.kind === 'lantern' || p.kind === 'lampBroken');
      const lit = lamps.filter((p) => p.kind === 'lantern').length / lamps.length;
      expect(lit).toBeGreaterThan(0.2);
      expect(lit).toBeLessThan(0.45);
      for (const a of lamps.filter((p) => !m.fixedProps.includes(p))) {
        const d = streetDist(m, a.x, a.z).d;
        expect(d).toBeGreaterThan(0.1);
        expect(d).toBeLessThan(1.6);
      }
      for (const [kind, gap] of Object.entries(SAME_KIND_GAP)) {
        const xs = props.filter((p) => p.kind === kind);
        for (const a of xs) for (const b of xs) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${kind} ${scale}`).toBeGreaterThanOrEqual(gap!);
      }
      const length = (s: { pts: readonly (readonly [number, number])[] }): number => s.pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s.pts[i]![0], p[1] - s.pts[i]![1]), 0);
      for (const s of m.streets) if (s.kind !== 'path' && length(s) > 60) expect(lamps.some((p) => streetDist(m, p.x, p.z).street === s && Math.abs(lineDist(s.pts, p.x, p.z) - (s.width / 2 + LAMP_CURB)) < 0.2), s.name).toBe(true);
      expect(lamps.length).toBeGreaterThan(30);
    }
  });

  it.each([1, 1.3])('light coverage: almost every street point has a light within reach (scale %s)', (scale) => {
    const m = charlottenburgMap(scale);
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

  it('M16b: two sleeping elites, two caches (Capitol yard, Ku\'damm yard) and a hidden blessing at reachable ends, off the route and off blocking landmarks', () => {
    for (const scale of [1, 1.3]) {
      const m = charlottenburgMap(scale), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots)), seen = reach(m, level);
      expect(m.guards).toHaveLength(2);
      expect(m.hiddenSpots).toHaveLength(1);
      for (const h of m.hiddenSpots!) expect(near(seen, h.x, h.z), `blessing ${h.x},${h.z}`).toBe(true);
      for (const g of m.guards!) expect(near(seen, g.x, g.z), `guard ${g.x},${g.z}`).toBe(true);
      // Two caches: the Capitol yard and the yard off the Ku'damm stub.
      const caches = m.fixedProps.filter((p) => p.kind === 'crates');
      expect(caches).toHaveLength(2);
      for (const cache of caches) expect([[2, 0], [-2, 0], [0, 2], [0, -2]].some(([a, b]) => near(seen, cache.x + a!, cache.z + b!)), `cache ${cache.x.toFixed(0)},${cache.z.toFixed(0)}`).toBe(true);
      // The Ku'damm yard: within about 40 m of the Bleibtreustraße junction, west of it (the dead-end stub), 20 to 30 m
      // deep behind the street (scaled), lit at its end, no fight near; the Hinterhof blessing is on that side too.
      const yard = m.streets.find((q) => q.name === 'Hof am Kurfürstendamm')!, kudamm = m.streets.find((q) => q.name === 'Kurfürstendamm')!, bleibtreu = m.streets.find((q) => q.name === 'Bleibtreustraße')!;
      const junction = bleibtreu.pts[0]!, [yx, yz] = yard.pts[0]!, yEnd = yard.pts.at(-1)!;
      expect(Math.hypot(yx - junction[0], yz - junction[1])).toBeLessThan(42 * scale);
      expect(lineDist(kudamm.pts, yx, yz)).toBeLessThan(kudamm.width / 2);
      for (const [x] of [...yard.pts, ...m.hiddenSpots!.map((h): [number, number] => [h.x, h.z])]) expect(x).toBeLessThan(junction[0]);
      const deep = yard.pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - yard.pts[i]![0], p[1] - yard.pts[i]![1]), 0) - (kudamm.width / 2 + (kudamm.sidewalk ?? 0) - lineDist(kudamm.pts, yx, yz));
      expect(deep).toBeGreaterThan(20);
      expect(deep).toBeLessThan(30 * scale + 2);
      const yardCache = caches.find((c) => Math.hypot(c.x - yEnd[0], c.z - yEnd[1]) < 3)!;
      expect(yardCache).toBeDefined();
      expect(m.fixedProps.some((p) => LIGHT_PROPS.has(p.kind) && Math.hypot(p.x - yardCache.x, p.z - yardCache.z) < 6), 'light at the yard end').toBe(true);
      for (const e of m.encounters) expect(Math.hypot(e.x - yardCache.x, e.z - yardCache.z), e.id).toBeGreaterThan(e.r + 15);
      for (const e of m.encounters) for (const g of m.guards!) expect(Math.hypot(e.x - g.x, e.z - g.z)).toBeGreaterThan(e.r + 8);
      // Not inside anything that blocks: open landmarks (the Capitol yard) only by their parts.
      for (const p of [...m.hiddenSpots!, ...m.guards!, ...caches]) {
        expect(level.near(p.x, p.z, 1).some((c) => colliderDistance(c, p.x, p.z) <= 0) && !caches.includes(p as never), `${p.x.toFixed(0)},${p.z.toFixed(0)}`).toBe(false);
        for (const l of m.landmarks) {
          if (l.kind === 'spati' || l.walkUnder) continue;
          if (OPEN_PARTS[l.kind]) expect(landmarkColliders(l).some((c) => colliderDistance(c, p.x, p.z) < 0.5), `${l.kind}`).toBe(false);
          else expect(inFoot(l, p.x, p.z, 0.5), `${l.kind}`).toBe(false);
        }
      }
    }
  }, 20000);

  it('the Hochschulviertel north-east of the Knie is fenced-off backdrop: never reached, nothing placed or spawned in it', () => {
    for (const scale of [1, 1.3]) {
      const m = charlottenburgMap(scale), lots = generateLots(m), props = generateProps(m, lots), level = mapLevel(m, lots, props), seen = reach(m, level);
      const area = m.areas.find((a) => a.id === 'hochschulviertel')!;
      expect(area.name).toBe('Hochschulviertel');
      const inside = (x: number, z: number): boolean => inPoly(area.poly, x, z);
      // Not one reached cell lies in the quarter, nor on the Chaussee beyond the barricade.
      let n = 0;
      for (const k of seen) { const [x, z] = k.split(',').map(Number) as [number, number]; n++; expect(inside(x, z), `${scale}: ${k}`).toBe(false); }
      expect(n).toBeGreaterThan(20000);
      const bis = m.streets.find((q) => q.name === 'Bismarckstraße')!, [ex, ez] = bis.pts.at(-1)!;
      for (const d of [6, 20, 40]) expect(near(seen, ex - d, ez + d * 0.35), `Chaussee ${d} m from the east end`).toBe(false);
      // The Knie, the Otto-Suhr-Allee and the Charlottenburger Tor stay open.
      const allee = m.streets.find((q) => q.name === 'Otto-Suhr-Allee')!;
      for (let i = 1; i < allee.pts.length; i++) for (let t = 0; t <= 1; t += 0.1) {
        const x = allee.pts[i - 1]![0] + (allee.pts[i]![0] - allee.pts[i - 1]![0]) * t, z = allee.pts[i - 1]![1] + (allee.pts[i]![1] - allee.pts[i - 1]![1]) * t;
        expect(near(seen, x, z), `Allee ${x.toFixed(0)},${z.toFixed(0)}`).toBe(true);
      }
      expect(near(seen, bis.pts[2]![0], bis.pts[2]![1]), 'Knie').toBe(true);
      expect(near(seen, lm(m, 'chtor').x, lm(m, 'chtor').z), 'Tor').toBe(true);
      // The Hochschule stands inside its grounds, fronting the Chaussee.
      const th = lm(m, 'hochschule');
      expect(inside(...at(th, 0, -th.hz - 1))).toBe(true);
      expect(streetDist(m, ...at(th, 0, th.hz + 0.5)).d).toBeGreaterThan(2);
      // Nothing generated or placed in it: buildings, props (the closed map edge's fronts and fallen trees at
      // the bound excepted), landmarks other than the Hochschule, side passages, run content; no spawns.
      for (const l of lots) if (l.kind !== 'tree') expect(inside(l.x, l.z), `lot ${l.kind} ${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBe(false);
      for (const p of props) if (EDGE_FRONT[p.kind] === undefined && p.kind !== 'fallenTree') expect(inside(p.x, p.z), `prop ${p.kind} ${p.x.toFixed(0)},${p.z.toFixed(0)}`).toBe(false);
      for (const l of m.landmarks) if (l.kind !== 'hochschule') expect(inside(l.x, l.z), l.kind).toBe(false);
      for (const st of m.streets) if (st.kind === 'path') for (const [x, z] of st.pts) expect(inside(x, z), st.name).toBe(false);
      for (const p of [...m.encounters, ...m.zones.map((zn) => zn.entry), ...(m.guards ?? []), ...(m.hiddenSpots ?? [])]) expect(inside(p.x, p.z)).toBe(false);
      let cells = 0;
      for (let x = m.bounds.minX; x < m.bounds.maxX; x += 4) for (let z = m.bounds.minZ; z < m.bounds.maxZ; z += 4) if (inside(x, z)) { cells++; expect(level.noSpawnAt(x, z), `spawn ${x},${z}`).toBe(true); }
      expect(cells * 16).toBeGreaterThan(5000 * scale * scale);
    }
  }, 30000);

  it('one rest stop per zone (the tea house in the Neuer Pavillon, the Späti in the Orangerie forecourt), reachable, away from fights', () => {
    for (const scale of [1, 1.3]) {
      const m = charlottenburgMap(scale), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots)), seen = reach(m, level);
      const spatis = m.landmarks.filter((l) => l.kind === 'spati');
      expect(spatis).toHaveLength(4);
      // Nearest zone route point (encounters and entries) of each rest stop: one per zone.
      const zoneOf = (l: Landmark): number => [...m.encounters.map((e) => ({ zone: e.zone, x: e.x, z: e.z })), ...m.zones.map((zn, i) => ({ zone: i, ...zn.entry }))].sort((a, b) => Math.hypot(a.x - l.x, a.z - l.z) - Math.hypot(b.x - l.x, b.z - l.z))[0]!.zone;
      expect(spatis.map(zoneOf)).toEqual([0, 1, 2, 3]);
      for (const l of spatis) {
        const door = { x: l.x + Math.sin(l.rot) * 6, z: l.z + Math.cos(l.rot) * 6 };
        expect(near(seen, door.x, door.z), `${l.name} door`).toBe(true);
        for (const e of m.encounters) expect(Math.hypot(l.x - e.x, l.z - e.z), `${l.name} vs ${e.id}`).toBeGreaterThan(e.r + 6);
      }
    }
  }, 20000);

  it('bigger scale means more lots', () => {
    expect(generateLots(charlottenburgMap(1.3)).length).toBeGreaterThan(generateLots(charlottenburgMap(1)).length);
  });

  it('Blockrand: tall rows never stand on the camera side of their street', () => {
    const m = charlottenburgMap(1), lots = generateLots(m).filter((l) => l.block);
    const tall = lots.filter((l) => l.kind === 'altbau' && l.floors >= 3);
    // Fewer than Mitte's 12: the tall sides of this map are mostly landmarks (cinemas, theatres, the opera).
    expect(tall.length).toBeGreaterThanOrEqual(10);
    for (const l of tall) expect(Math.cos(l.rot), `${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBeGreaterThan(-0.5);
    for (const l of lots.filter((q) => Math.cos(q.rot) < -0.5)) expect(l.floors).toBeLessThanOrEqual(1);
  });

  it('geography: landmarks keep their compass octant from the Gedächtniskirche; along the Spree Luisenplatz, Neuer Pavillon, Schloßbrücke south to north', () => {
    const m = charlottenburgMap(1), church = lm(m, 'gedaechtniskirche');
    const octant = (x: number, z: number): string => ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][((Math.round(Math.atan2(-(z - church.z), x - church.x) / (Math.PI / 4)) % 8) + 8) % 8]!;
    const want: Partial<Record<Landmark['kind'], string>> = {
      zoobahnhof: 'NW', loewentor: 'N', elefantentor: 'E', aquarium: 'E', ufapalast: 'NW', romanischescafe: 'E', marmorhaus: 'SW', gloriapalast: 'SW', kadewe: 'SE', wittenbergplatz: 'SE',
      cafewestens: 'W', revuepalast: 'W', theaterwestens: 'W', variete: 'W', hochschule: 'NW', chtor: 'N', schillertheater: 'NW', opernhaus: 'NW', rathaus: 'NW', stuelerbau: 'NW',
      schlossmitte: 'NW', orangerie: 'NW', neuerfluegel: 'NW', mausoleum: 'NW', belvedere: 'NW',
    };
    for (const [kind, o] of Object.entries(want)) for (const l of m.landmarks.filter((q) => q.kind === kind)) expect(octant(l.x, l.z), kind).toBe(o);
    const luise = m.encounters.find((e) => e.id === 'luisenplatz')!, pavillon = m.landmarks.find((l) => l.name === 'Teehaus im Neuen Pavillon')!, bridge = m.bridges[0]!;
    expect(octant(bridge.x, bridge.z)).toBe('NW');
    expect(luise.z).toBeGreaterThan(pavillon.z);
    expect(pavillon.z).toBeGreaterThan(bridge.z);
  });

  it('a scripted run clears all 34 waves, the four bosses and ends in victory', () => {
    const m = charlottenburgMap(1), level = mapLevel(m, generateLots(m));
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
    expect(log.filter((e) => e.type === 'waveStart')).toHaveLength(34);
    expect(log.filter((e) => e.type === 'zoneClear').map((e) => (e as { zone: number }).zone)).toEqual([0, 1, 2, 3]);
    expect(log.at(-1)?.type).toBe('victory');
  }, 30000);
});
