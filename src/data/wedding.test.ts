import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { HALLE, KNEIPE_FIGHT, WEDDING_BOSSES, weddingMap } from './wedding';
import { inKneipe, KNEIPE, kneipeParts, kneipeWorld } from './kneipe';
import { inRoom } from '../sim/level';
import { lateTier } from './enemies';
import { EDGE_FRONT, propCollider } from './courtyard';
import { generateLots, generateProps, inPoly, isWater, landmarkColliders, LIGHT_PROPS, lightCover, lineDist, mapLevel, OPEN_PARTS, SAME_KIND_GAP, streetDist, onBridge, heightAt, type Landmark, type Lot, type MapDef } from './map';
import type { Level } from '../sim/level';
import { createSim, stepSim } from '../sim/sim';
import { summon } from '../sim/ai';
import { spawnEnemy } from '../sim/enemies';
import { NO_INPUT, type SimEvent } from '../sim/types';

const hpAt = (g: number): number => (1 + g * 0.13) * lateTier(g).hp;
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
const enc = (m: MapDef, id: string) => m.encounters.find((e) => e.id === id)!;
/** World point of a landmark's local (x along its front, z out of it). */
const at = (l: Landmark, lx: number, lz: number): [number, number] => [l.x + Math.cos(l.rot) * lx + Math.sin(l.rot) * lz, l.z - Math.sin(l.rot) * lx + Math.cos(l.rot) * lz];
/** Inside a landmark's rotated footprint. */
const inFoot = (l: Landmark, x: number, z: number, pad: number): boolean => { const dx = x - l.x, dz = z - l.z, c = Math.cos(l.rot), sn = Math.sin(l.rot); return Math.abs(dx * c - dz * sn) < l.hx + pad && Math.abs(dx * sn + dz * c) < l.hz + pad; };
const brache = (m: MapDef) => m.areas.filter((a) => a.id.startsWith('brache'));
const cells = (seen: Set<string>): Array<[number, number]> => [...seen].map((k) => k.split(',').map(Number) as [number, number]);

describe('Wedding map (M18, layout C2)', () => {
  for (const scale of [1, 1.3]) {
    const m = weddingMap(scale);
    const lots = generateLots(m);
    const props = generateProps(m, lots);
    const level = mapLevel(m, lots, props);
    const seen = reach(m, level);
    const solid = (x: number, z: number): boolean => level.blocked(x, z, 0.4) || level.near(x, z, 1).some((c) => colliderDistance(c, x, z) < 0.4);

    it(`has 21 normal waves (7, 3, 8, 3) and one boss per zone, district 5 (scale ${scale})`, () => {
      expect(normal(m)).toHaveLength(21);
      const perZone = [0, 1, 2, 3].map((z) => m.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves).filter((w) => w.bosses.length === 0).length);
      expect(perZone).toEqual([7, 3, 8, 3]);
      const B = WEDDING_BOSSES;
      expect(m.encounters.flatMap((e) => e.waves).flatMap((w) => w.bosses)).toEqual([B.zugezogene, B.hauptgericht, B.bauherr, B.sultan]);
      for (const z of [0, 1, 2, 3]) expect(m.encounters.filter((e) => e.zone === z && e.waves.some((w) => w.bosses.length > 0)).map((e) => e.zone)).toEqual([z]);
      expect(m.encounters.map((e) => e.id)).toEqual(['wochenmarkt', 'muellerstrasse', 'magendoktor', 'uferterrasse', 'brunnenplatz', 'badstrasse', 'rosengarten', 'humboldthoehe', 'beamtentor', 'langetafel', 'hochzeitspalast']);
      expect(m.district).toBe(5);
      expect(m.flavor).toBe('fest');
      expect(m.zones.map((z) => z.name)).toEqual(['Leopoldkiez', 'Panke', 'Humboldthain', 'Das ewige Fest']);
    });

    it(`gets harder wave by wave from tier 40 to 62; the Humboldthöhe is calm, the pub small (scale ${scale})`, () => {
      const waves = normal(m);
      const pub = enc(m, 'magendoktor');
      // The pub's waves keep the tier curve (life), only fewer bodies.
      expect(waves[0]!.hpMul).toBeCloseTo(hpAt(40));
      expect(waves.at(-1)!.hpMul).toBeCloseTo(hpAt(62));
      for (let i = 1; i < waves.length; i++) expect(waves[i]!.hpMul).toBeGreaterThan(waves[i - 1]!.hpMul);
      const hill = enc(m, 'humboldthoehe');
      for (const w of hill.waves) {
        expect(w.elite).toBe(0);
        expect(w.count).toBeLessThan(enc(m, 'rosengarten').waves.at(-1)!.count);
        expect(w.mix.teppich).toBeGreaterThan(1);
      }
      // Step 2 roster: the pub holds Zecher only; the board kinds come in zone by zone; no stand-in kinds are left.
      for (const w of pub.waves) expect(Object.keys(w.mix).sort()).toEqual(['brute', 'runner', 'spitter', 'walker']);
      const at = (zone: number): string[] => [...new Set(m.encounters.filter((e) => e.zone === zone && e.id !== 'magendoktor').flatMap((e) => e.waves).flatMap((w) => Object.keys(w.mix)))];
      expect(at(0)).toContain('teeifrit');
      for (const z of [1, 2, 3]) for (const k of ['teeifrit', 'baklava', 'teppich']) expect(at(z), `${z} ${k}`).toContain(k);
      for (const z of [0, 1, 2, 3]) for (const k of ['crow', 'rat']) expect(at(z)).not.toContain(k);
      for (const w of pub.waves.filter((q) => q.bosses.length === 0)) expect(w.maxAlive).toBeLessThanOrEqual(KNEIPE_FIGHT.maxAlive);
      expect(pub.waves[0]!.count).toBeLessThan(enc(m, 'muellerstrasse').waves.at(-1)!.count);
      for (const w of waves.filter((q) => !hill.waves.includes(q))) expect(w.elite).toBeGreaterThan(0);
    });

    it(`keeps start, zone entries and fight centres walkable, free and reachable; circles 80 % open, no water (scale ${scale})`, () => {
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
        for (let a = 0; a < Math.PI * 2; a += 0.2) expect(isWater(m, e.x + Math.sin(a) * e.r, e.z + Math.cos(a) * e.r), `${e.id} water`).toBe(false);
        // Circles are 13 to 15 m and 80 % open, except the pub: the whole room is its arena (E2, own tests below).
        if (e.id === 'magendoktor') { expect(e.room).toBeDefined(); continue; }
        expect(open / n, e.id).toBeGreaterThan(0.8);
        expect(e.r).toBeGreaterThanOrEqual(13);
        expect(e.r).toBeLessThanOrEqual(15);
      }
    });

    it(`places buildings off streets, out of the water, off the viaduct and never in the unbuilt corners; more at 1.3 (scale ${scale})`, () => {
      const houses = lots.filter((l) => l.kind !== 'tree' && l.kind !== 'special');
      expect(houses.length).toBeGreaterThanOrEqual(32);
      for (const l of houses) {
        expect(isWater(m, l.x, l.z)).toBe(false);
        expect(streetDist(m, l.x, l.z).d).toBeGreaterThan(0);
        for (const v of m.viaducts!) expect(lineDist(v.pts, l.x, l.z), `${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBeGreaterThan(v.width / 2);
      }
      for (const l of lots) for (const a of brache(m)) expect(inPoly(a.poly, l.x, l.z), `lot ${l.kind} ${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBe(false);
    });

    it(`the Panke is crossed only on the Pankstraße bridge; water blocks (scale ${scale})`, () => {
      const b = m.bridges[0]!, ux = Math.sin(b.rot), uz = Math.cos(b.rot);
      for (const d of [-b.len / 2 + 2, 0, b.len / 2 - 2]) {
        expect(onBridge(m, b.x + ux * d, b.z + uz * d)).toBe(b);
        expect(near(seen, b.x + ux * d, b.z + uz * d), `deck ${d}`).toBe(true);
      }
      // With the bridge shut, nothing east of the Panke is reached from the start.
      const shut = reach(m, level, m.start, m.bounds, (x, z) => Math.hypot(x - b.x, z - b.z) < b.len / 2);
      const east = enc(m, 'uferterrasse');
      expect(near(shut, east.x, east.z)).toBe(false);
      expect(isWater(m, m.rivers[0]!.pts[3]![0], m.rivers[0]!.pts[3]![1] - 20 * scale)).toBe(true);
      expect(solid(m.rivers[0]!.pts[2]![0], m.rivers[0]!.pts[2]![1])).toBe(true);
    });

    it(`the Ringbahn blocks except at the Brunnenstraße arch; the Müllerstraße arch is barricaded (scale ${scale})`, () => {
      expect(m.viaducts!.length).toBe(4);
      for (const v of m.viaducts!) for (let i = 1; i < v.pts.length; i++) {
        const [ax, az] = v.pts[i - 1]!, [bx, bz] = v.pts[i]!;
        if (Math.hypot(bx - ax, bz - az) < 4) continue;
        expect(solid((ax + bx) / 2, (az + bz) / 2), `viaduct ${ax.toFixed(0)},${az.toFixed(0)}`).toBe(true);
      }
      // Nothing south of the Ringbahn is reached except through the Brunnenstraße arch: shut it and the park is out of reach.
      const br = m.streets.find((q) => q.name === 'Brunnenstraße')!, archZ = m.viaducts![2]!.pts.at(-1)![1];
      const shut = reach(m, level, m.start, m.bounds, (x, z) => Math.abs(x - br.pts[0]![0]) < 16 && Math.abs(z - archZ) < 8);
      const rose = enc(m, 'rosengarten'), tafel = enc(m, 'langetafel');
      expect(near(shut, rose.x, rose.z)).toBe(false);
      expect(near(shut, tafel.x, tafel.z)).toBe(false);
      expect(near(seen, rose.x, rose.z)).toBe(true);
    });

    it(`the park is entered only through its two gates; the AEG yard only through the Beamtentor (scale ${scale})`, () => {
      const gates = m.landmarks.filter((l) => l.kind === 'gartentor');
      expect(gates).toHaveLength(2);
      const rose = enc(m, 'rosengarten'), hill = enc(m, 'humboldthoehe');
      for (const g of gates) for (const p of OPEN_PARTS.gartentor!) expect(solid(...at(g, p.x, p.z)), 'gate pillar').toBe(true);
      const shut = reach(m, level, m.start, m.bounds, (x, z) => gates.some((g) => inFoot(g, x, z, 0.8)));
      expect(near(shut, rose.x, rose.z), 'park with both gates shut').toBe(false);
      for (const g of gates) {
        const other = gates.find((q) => q !== g)!;
        const one = reach(m, level, m.start, m.bounds, (x, z) => inFoot(other, x, z, 0.8));
        expect(near(one, hill.x, hill.z), `only gate ${g.z.toFixed(0)} open`).toBe(true);
      }
      const bt = lm(m, 'beamtentor'), tafel = enc(m, 'langetafel');
      for (const p of OPEN_PARTS.beamtentor!) expect(solid(...at(bt, p.x, p.z)), 'gate tower').toBe(true);
      expect(near(seen, ...at(bt, 0, 0)), 'gate passage').toBe(true);
      const noGate = reach(m, level, m.start, m.bounds, (x, z) => inFoot(bt, x, z, 1));
      expect(near(noGate, tafel.x, tafel.z), 'yard with the gate shut').toBe(false);
    });

    it(`the Maschinenhalle is walked into through its east door; walls block (scale ${scale})`, () => {
      const h = lm(m, 'maschinenhalle');
      const inside = reach(m, level, h, { minX: h.x - h.hx, maxX: h.x + h.hx, minZ: h.z - h.hz, maxZ: h.z + h.hz });
      expect(inside.size).toBeGreaterThan(56 * 30);
      const door = HALLE.door;
      expect(near(inside, ...at(h, h.hx - 1.5, door.z))).toBe(true);
      expect(near(seen, ...at(h, h.hx + 2, door.z)), 'outside the door').toBe(true);
      for (const p of OPEN_PARTS.maschinenhalle!) expect(solid(...at(h, p.x, p.z)), `hall wall ${p.x},${p.z}`).toBe(true);
      expect(near(seen, h.x, h.z)).toBe(true);
    });

    it(`Zum Magendoktor: the door walks in, walls hold, every free cell connects to the door, lanes are 1.8 m (scale ${scale})`, () => {
      const pub = lm(m, 'kneipe'), f = enc(m, 'magendoktor'), room = f.room!;
      expect(pub.name).toBe('Zum Magendoktor');
      const door = kneipeWorld(pub, 0, -KNEIPE.d / 2), inDoor = kneipeWorld(pub, 0, -KNEIPE.d / 2 + 1.5), outDoor = kneipeWorld(pub, 0, -KNEIPE.d / 2 - 2);
      expect(near(seen, inDoor.x, inDoor.z), 'inside the door').toBe(true);
      expect(near(seen, outDoor.x, outDoor.z), 'outside the door').toBe(true);
      expect(solid(door.x, door.z)).toBe(false);
      // Johannes 2026-11-21: the door faces the camera (south), the hero walks in upwards from the forecourt by the
      // Ringbahn; the Nettelbeckplatz lies behind the pub.
      expect(door.z).toBeGreaterThan(pub.z);
      expect(inPoly(m.areas.find((a) => a.id === 'vorhof')!.poly, outDoor.x, outDoor.z + 1)).toBe(true);
      expect(inPoly(m.areas.find((a) => a.id === 'nettelbeckplatz')!.poly, pub.x, pub.z - pub.hz - 3)).toBe(true);
      for (const p of kneipeParts().filter((q) => q.kind === 'wall')) { const w = kneipeWorld(pub, p.x, p.z); expect(solid(w.x, w.z), `wall ${p.x},${p.z}`).toBe(true); }
      // The room is one pocket: with the door shut, the inside is not reached from outside.
      const shut = reach(m, level, m.start, m.bounds, (x, z) => Math.hypot(x - door.x, z - door.z) < 2.2);
      expect(near(shut, inDoor.x, inDoor.z)).toBe(false);
      // Every free cell of the room connects to the door, and the cells with 0.9 m to every piece (the 1.8 m lanes) form one net.
      const free = (x: number, z: number, c: number): boolean => !level.blocked(x, z, 0.4) && level.near(x, z, c + 0.5).every((q) => colliderDistance(q, x, z) > c);
      const cellsIn = (c: number): Array<[number, number]> => { const out: Array<[number, number]> = []; for (let u = -room.hx + 0.25; u < room.hx; u += 0.5) for (let v = -room.hz + 0.25; v < room.hz; v += 0.5) { const q = kneipeWorld(pub, u, v); if (free(q.x, q.z, c)) out.push([q.x, q.z]); } return out; };
      const fill = (c: number): Set<string> => {
        const key = (x: number, z: number): string => `${Math.round(x * 2)},${Math.round(z * 2)}`, all = new Set(cellsIn(c).map(([x, z]) => key(x, z))), got = new Set<string>(), q = [key(inDoor.x, inDoor.z)];
        while (q.length) { const k = q.pop()!; if (got.has(k) || !all.has(k)) continue; got.add(k); const [a, b] = k.split(',').map(Number) as [number, number]; q.push(`${a + 1},${b}`, `${a - 1},${b}`, `${a},${b + 1}`, `${a},${b - 1}`); }
        expect(got.size, `clearance ${c}`).toBe(all.size);
        return got;
      };
      expect(fill(0.4).size).toBeGreaterThan(300);
      expect(fill(0.9).size).toBeGreaterThan(150);
      // Two waves of Zecher, then the boss in the same room (a full heal when won); he stands up inside.
      expect(f.waves.map((w) => w.bosses.length)).toEqual([0, 0, 1]);
      expect(f.heal).toBe(1);
      expect(inRoom(room, f.bossAt!.x, f.bossAt!.z, 1)).toBe(true);
      expect(free(f.bossAt!.x, f.bossAt!.z, 1)).toBe(true);
      // Three regulars sleep inside the room.
      const guards = m.guards!.filter((g) => inKneipe(pub, g.x, g.z));
      expect(guards).toHaveLength(3);
      for (const g of guards) expect(near(seen, g.x, g.z), `guard ${g.x},${g.z}`).toBe(true);
      // The pub sits north of the Ringbahn.
      const v = m.viaducts!.flatMap((q) => q.pts);
      expect(pub.z + pub.hz).toBeLessThan(Math.min(...v.filter(([x]) => Math.abs(x - pub.x) < 20).map(([, z]) => z)));
    });

    it(`the pub fight starts only inside the room; every body and the boss come from free cells in it (scale ${scale})`, () => {
      const lv = mapLevel(m, lots, props), pub = lm(m, 'kneipe'), i = m.encounters.findIndex((e) => e.id === 'magendoktor'), room = m.encounters[i]!.room!;
      lv.guards = [];
      const sim = createSim({ level: lv, seed: 3 }), p = sim.player;
      sim.run.index = i;
      const stand = (x: number, z: number, n: number): void => { for (let t = 0; t < n; t++) { p.x = p.px = x; p.z = p.pz = z; p.invuln = 1e9; stepSim(sim, NO_INPUT); sim.events.length = 0; } };
      // In front of the door (within the radius, outside the room) nothing starts.
      const out = kneipeWorld(pub, 0, -KNEIPE.d / 2 - 1.5);
      stand(out.x, out.z, 60);
      expect(sim.run.phase).toBe('travel');
      let spawned = 0, bosses = 0;
      const seenIds = new Set<number>();
      for (let t = 0; t < 60 * 60 && sim.run.index === i; t++) {
        stand(pub.x + 1, pub.z, 1);
        for (const e of sim.enemies) if (e.state !== 'dead' && e.enc === i) {
          if (!seenIds.has(e.id)) {
            seenIds.add(e.id);
            spawned++;
            if (e.def.boss) bosses++;
            expect(inRoom(room, e.x, e.z, 0), `${e.kind} at ${e.x.toFixed(1)},${e.z.toFixed(1)}`).toBe(true);
            expect(lv.near(e.x, e.z, 1).every((q) => colliderDistance(q, e.x, e.z) > 0), `${e.kind} in a piece`).toBe(true);
          }
          if (e.stateT > 0.3) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
        }
      }
      expect(sim.run.index).toBe(i + 1);
      expect(spawned).toBeGreaterThan(5);
      expect(bosses).toBe(1);
    });

    it(`a boss in the pub calls his adds inside the walls, also from beside a wall (Codex review of PR 81) (scale ${scale})`, () => {
      const lv = mapLevel(m, lots, props), pub = lm(m, 'kneipe'), i = m.encounters.findIndex((e) => e.id === 'magendoktor'), room = m.encounters[i]!.room!;
      lv.guards = [];
      const sim = createSim({ level: lv, seed: 1 });
      // The boss stands just inside the back wall and beside the side walls; every add lands in the room.
      for (const [px, pz] of [[0, -5.4], [-7.6, 5.6], [7.4, -0.5], [0, 5.6]] as const) {
        const q = kneipeWorld(pub, px, pz), boss = spawnEnemy(sim, q.x, q.z, WEDDING_BOSSES.zugezogene, 1, 1);
        boss.enc = i;
        const n0 = sim.enemies.length;
        summon(sim, boss, 'walker', 4);
        expect(sim.enemies.length).toBeGreaterThan(n0);
        for (const e of sim.enemies.slice(n0)) expect(inRoom(room, e.x, e.z, 0), `add at ${e.x.toFixed(1)},${e.z.toFixed(1)} from ${px},${pz}`).toBe(true);
        for (const e of sim.enemies) { e.state = 'dead'; e.hp = 0; }
      }
    });

    it(`nothing is placed or reached in the two unbuilt corners; nothing spawns there (scale ${scale})`, () => {
      const areas = brache(m);
      expect(areas).toHaveLength(2);
      const inside = (x: number, z: number): boolean => areas.some((a) => inPoly(a.poly, x, z));
      let n = 0;
      for (const [x, z] of cells(seen)) { n++; expect(inside(x, z), `${scale}: ${x},${z}`).toBe(false); }
      expect(n).toBeGreaterThan(15000 * scale);
      for (const p of props) if (EDGE_FRONT[p.kind] === undefined && p.kind !== 'barricade') expect(inside(p.x, p.z), `prop ${p.kind} ${p.x.toFixed(0)},${p.z.toFixed(0)}`).toBe(false);
      for (const l of m.landmarks) expect(inside(l.x, l.z), l.kind).toBe(false);
      for (const p of [...m.encounters, ...m.zones.map((zn) => zn.entry), ...(m.guards ?? []), ...(m.hiddenSpots ?? [])]) expect(inside(p.x, p.z)).toBe(false);
      for (let x = m.bounds.minX; x < m.bounds.maxX; x += 5) for (let z = m.bounds.minZ; z < m.bounds.maxZ; z += 5) if (inside(x, z)) expect(level.noSpawnAt(x, z), `spawn ${x},${z}`).toBe(true);
    });

    it(`side passages, guards and the hidden blessing are reachable and stand in no blocking footprint (scale ${scale})`, () => {
      expect(m.hiddenSpots).toHaveLength(1);
      const caches = m.fixedProps.filter((p) => p.kind === 'crates');
      expect(caches).toHaveLength(1);
      for (const h of m.hiddenSpots!) expect(near(seen, h.x, h.z), `blessing ${h.x},${h.z}`).toBe(true);
      for (const c of caches) expect([[2, 0], [-2, 0], [0, 2], [0, -2]].some(([a, b]) => near(seen, c.x + a!, c.z + b!)), 'cache').toBe(true);
      for (const p of [...m.hiddenSpots!, ...m.guards!, ...caches]) {
        expect(level.near(p.x, p.z, 1).some((c) => colliderDistance(c, p.x, p.z) <= 0) && !caches.includes(p as never), `${p.x.toFixed(0)},${p.z.toFixed(0)}`).toBe(false);
        for (const l of m.landmarks) {
          if (l.kind === 'spati' || l.kind === 'kneipe' || l.walkUnder) continue;
          if (OPEN_PARTS[l.kind]) expect(landmarkColliders(l).some((c) => colliderDistance(c, p.x, p.z) < 0.5), `${l.kind}`).toBe(false);
          else expect(inFoot(l, p.x, p.z, 0.5), `${l.kind}`).toBe(false);
        }
      }
      // The blessing and the cache sit away from the fights (the pub's sleepers are part of its room).
      for (const e of m.encounters) for (const p of [...m.hiddenSpots!, ...caches]) expect(Math.hypot(e.x - p.x, e.z - p.z), e.id).toBeGreaterThan(e.r + 6);
    });

    it(`the Humboldthöhe is a soft 7 m hill with the fight on its flat top (scale ${scale})`, () => {
      const f = enc(m, 'humboldthoehe'), hill = m.hills[0]!;
      expect(m.hills).toHaveLength(1);
      expect(heightAt(m, f.x, f.z)).toBeCloseTo(hill.h, 0);
      for (let a = 0; a < Math.PI * 2; a += 0.5) expect(heightAt(m, f.x + Math.sin(a) * f.r, f.z + Math.cos(a) * f.r)).toBeCloseTo(hill.h, 0);
      expect(m.terraces).toHaveLength(0);
      const tower = lm(m, 'flakturm');
      expect(tower.z).toBeLessThan(hill.z);
      expect(heightAt(m, tower.x, tower.z)).toBeGreaterThan(1);
    });
  }

  it('every 20 m of street has a building, car or prop nearby', () => {
    for (const scale of [1, 1.3]) {
      const m = weddingMap(scale);
      const lots = generateLots(m).filter((l) => l.kind !== 'tree');
      const things = [...lots, ...generateProps(m, lots), ...m.landmarks];
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
      expect(empty / n, `${scale}`).toBeLessThan(0.1);
    }
  });

  it('no invisible walls: land at the map edge is closed by a visible front or water', () => {
    for (const scale of [1, 1.3]) {
      const m = weddingMap(scale);
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

  it('streets that run out end in a barricade (at the bound or placed)', () => {
    for (const scale of [1, 1.3]) {
      const m = weddingMap(scale), props = generateProps(m, generateLots(m)), bars = props.filter((p) => p.kind === 'barricade');
      for (const s of m.streets.filter((q) => q.kind !== 'path')) for (const [x, z] of [s.pts[0]!, s.pts.at(-1)!]) {
        // A street that opens onto a square (a paved area without frontage) or meets another street does not run out.
        const joins = m.streets.some((o) => o !== s && o.kind !== 'path' && lineDist(o.pts, x, z) < o.width / 2 + 2) || m.areas.some((a) => a.frontage === null && a.ground === 'cobbles' && inPoly(a.poly, x, z));
        if (joins) continue;
        expect(bars.some((b) => Math.hypot(b.x - x, b.z - z) < s.width + 4), `${s.name} end ${x.toFixed(0)},${z.toFixed(0)}`).toBe(true);
      }
    }
  });

  it('street lamps at the curb, about a third lit; no same-kind twins', () => {
    for (const scale of [1, 1.3]) {
      const m = weddingMap(scale);
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
      expect(lamps.length).toBeGreaterThan(20);
    }
  });

  it.each([1, 1.3])('light coverage: almost every street point has a light within reach; lampions along the route (scale %s)', (scale) => {
    const m = weddingMap(scale);
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
    // E4: lampion chains on the route streets, about every 20 to 30 m, none in the pub.
    const chains = props.filter((p) => p.kind === 'lampions');
    expect(chains.length).toBeGreaterThan(20);
    for (const name of ['Müllerstraße', 'Lindower Straße', 'Pankstraße', 'Badstraße', 'Brunnenstraße']) {
      const st = m.streets.find((q) => q.name === name)!;
      expect(chains.filter((c) => lineDist(st.pts, c.x, c.z) < 1).length, name).toBeGreaterThanOrEqual(2);
    }
    for (const c of chains) expect(inKneipe(m.landmarks.find((l) => l.kind === 'kneipe')!, c.x, c.z, 2)).toBe(false);
  });

  it('one rest stop per zone, reachable, away from fights', () => {
    for (const scale of [1, 1.3]) {
      const m = weddingMap(scale), lots = generateLots(m), level = mapLevel(m, lots, generateProps(m, lots)), seen = reach(m, level);
      const spatis = m.landmarks.filter((l) => l.kind === 'spati');
      expect(spatis.map((l) => l.name)).toEqual(['Späti am Leo', 'Baklava & Döner', 'Kiosk am Rosengarten', 'Teestube im Werkhof']);
      const zoneOf = (l: Landmark): number => [...m.encounters.map((e) => ({ zone: e.zone, x: e.x, z: e.z })), ...m.zones.map((zn, i) => ({ zone: i, ...zn.entry }))].sort((a, b) => Math.hypot(a.x - l.x, a.z - l.z) - Math.hypot(b.x - l.x, b.z - l.z))[0]!.zone;
      expect(spatis.map(zoneOf)).toEqual([0, 1, 2, 3]);
      for (const l of spatis) {
        const door = { x: l.x + Math.sin(l.rot) * 6, z: l.z + Math.cos(l.rot) * 6 };
        expect(near(seen, door.x, door.z), `${l.name} door`).toBe(true);
        for (const e of m.encounters) expect(Math.hypot(l.x - e.x, l.z - e.z), `${l.name} vs ${e.id}`).toBeGreaterThan(e.r + 6);
      }
      // The pub is no rest stop.
      expect(level.rests.map((r) => r.name)).not.toContain('Zum Magendoktor');
    }
  }, 20000);

  it('bigger scale means more lots', () => {
    expect(generateLots(weddingMap(1.3)).filter((l: Lot) => l.kind !== 'tree').length).toBeGreaterThan(generateLots(weddingMap(1)).filter((l: Lot) => l.kind !== 'tree').length);
  });

  it('Blockrand: tall rows never stand on the camera side of their street', () => {
    const m = weddingMap(1), lots = generateLots(m).filter((l) => l.block);
    const tall = lots.filter((l) => l.kind === 'altbau' && l.floors >= 3);
    expect(tall.length).toBeGreaterThanOrEqual(10);
    for (const l of tall) expect(Math.cos(l.rot), `${l.x.toFixed(0)},${l.z.toFixed(0)}`).toBeGreaterThan(-0.55);
    for (const l of lots.filter((q) => Math.cos(q.rot) < -0.55)) expect(l.floors).toBeLessThanOrEqual(1);
  });

  it('geography: sights and places keep their compass octant from U Leopoldplatz; the Ringbahn order holds', () => {
    const m = weddingMap(1);
    const octant = (x: number, z: number): string => ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][((Math.round(Math.atan2(-z, x) / (Math.PI / 4)) % 8) + 8) % 8]!;
    const want: Array<[string, { x: number; z: number }, string]> = [
      ['Alte Nazarethkirche', lm(m, 'nazareth'), 'N'], ['Neubau (Rathaus Wedding)', lm(m, 'neubau'), 'W'], ['Zum Magendoktor', lm(m, 'kneipe'), 'SE'],
      ['Nettelbeckplatz', { x: 94, z: 16 }, 'E'], ['Amtsgericht', lm(m, 'amtsgericht'), 'NE'], ['Brunnenplatz', enc(m, 'brunnenplatz'), 'E'],
      ['Flakturm', lm(m, 'flakturm'), 'E'], ['Rosengarten', enc(m, 'rosengarten'), 'E'], ['Beamtentor', lm(m, 'beamtentor'), 'E'], ['U Pankstraße (zone 2 entry)', m.zones[2]!.entry, 'NE'],
    ];
    for (const [name, p, o] of want) expect(octant(p.x, p.z), name).toBe(o);
    // Along the Ringbahn from west to east: S Wedding (the Müllerstraße arch), the Magendoktor, the park, Gesundbrunnen (the Brunnenstraße arch).
    const v = m.viaducts!, ends = v.slice(0, -1).map((q) => q.pts.at(-1)![0]);
    expect(ends[0]!).toBeLessThan(lm(m, 'kneipe').x);
    expect(lm(m, 'kneipe').x).toBeLessThan(enc(m, 'humboldthoehe').x);
    expect(enc(m, 'humboldthoehe').x).toBeLessThan(ends[2]!);
    // The Magendoktor north of the Ringbahn, the park south of it.
    expect(m.rivers[0]!.name).toBe('Panke');
  });

  it('a scripted run clears all 25 waves, the four bosses and ends in victory', () => {
    const m = weddingMap(1), level = mapLevel(m, generateLots(m));
    level.guards = [];
    const sim = createSim({ level }), log: SimEvent[] = [];
    while (sim.run.phase !== 'won') {
      const e0 = sim.level.encounters[sim.run.index]!;
      const p = sim.player;
      p.x = p.px = e0.x;
      p.z = p.pz = e0.z;
      p.invuln = 1e9;
      for (let i = 0; i < 60 * 120 && sim.run.index < sim.level.encounters.length && sim.level.encounters[sim.run.index] === e0; i++) {
        stepSim(sim, NO_INPUT);
        for (const e of sim.enemies) if (e.state !== 'dead' && e.stateT > 0.3) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
        log.push(...sim.events);
        sim.events.length = 0;
      }
    }
    expect(log.filter((e) => e.type === 'waveStart')).toHaveLength(25);
    expect(log.filter((e) => e.type === 'zoneClear').map((e) => (e as { zone: number }).zone)).toEqual([0, 1, 2, 3]);
    expect(log.at(-1)?.type).toBe('victory');
  }, 30000);
});
