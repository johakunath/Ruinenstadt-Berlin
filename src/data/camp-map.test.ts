import { describe, expect, it } from 'vitest';
import { CAMP_LAYOUT, campMap, campPlaceAt, onCampFloor, YARD_H } from './camp-map';
import { generateLots, generateProps, heightAt, mapLevel } from './map';
import { STATIONS } from './camp';
import { createSim, stepSim } from '../sim/sim';
import { campOf } from '../sim/camp';
import { NO_INPUT } from '../sim/types';

const def = campMap();
const lots = generateLots(def);
const props = generateProps(def, lots);
const level = mapLevel(def, lots, props);
const R = 0.4;
const free = (x: number, z: number): boolean => !level.blocked(x, z, R) && !level.near(x, z, R + 0.1).some((c) => c.kind === 'circle' ? Math.hypot(c.x - x, c.z - z) < c.r + R : Math.abs((x - c.x) * Math.cos(c.rot) - (z - c.z) * Math.sin(c.rot)) < c.hx + R && Math.abs((x - c.x) * Math.sin(c.rot) + (z - c.z) * Math.cos(c.rot)) < c.hz + R);

/** Cells the hero reaches from the start (0.5 m grid flood fill). */
function reach(free: (x: number, z: number) => boolean): Set<string> {
  const seen = new Set<string>(), q: Array<[number, number]> = [];
  const k = (i: number, j: number): string => `${i},${j}`;
  const i0 = Math.round(def.start.x * 2), j0 = Math.round(def.start.z * 2);
  seen.add(k(i0, j0)); q.push([i0, j0]);
  while (q.length) {
    const [i, j] = q.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const a = i + di, b = j + dj;
      if (seen.has(k(a, b)) || !free(a / 2, b / 2)) continue;
      seen.add(k(a, b)); q.push([a, b]);
    }
  }
  return seen;
}
const reached = reach(free);
const reachable = (x: number, z: number): boolean => reached.has(`${Math.round(x * 2)},${Math.round(z * 2)}`);

describe('M20 camp map', () => {
  it('is peaceful: no encounters, no enemies after a while', () => {
    expect(def.encounters).toEqual([]);
    expect(level.camp).toBe(true);
    const sim = createSim({ level, seed: 3 });
    for (let i = 0; i < 600; i++) stepSim(sim, NO_INPUT);
    expect(sim.enemies.length).toBe(0);
  });
  it('the start is free and every ring is reached on foot', () => {
    expect(free(def.start.x, def.start.z)).toBe(true);
    for (const p of CAMP_LAYOUT.places) expect(reachable(p.x, p.z), p.id).toBe(true);
  });
  it('has one place per station plus the train', () => {
    expect(new Set(CAMP_LAYOUT.places.map((p) => p.id))).toEqual(new Set([...STATIONS.map((s) => s.id), 'abfahrt']));
    expect(new Set(CAMP_LAYOUT.stations.map((s) => s.id))).toEqual(new Set(STATIONS.map((s) => s.id)));
  });
  it('rings stand on the floor, clear of the station they open', () => {
    for (const p of CAMP_LAYOUT.places) {
      expect(onCampFloor(CAMP_LAYOUT, p.x, p.z), p.id).toBe(true);
      expect(campPlaceAt(CAMP_LAYOUT, p.x, p.z)?.id).toBe(p.id);
    }
  });
  it('the stairs lead from the hall (0 m) up to the yard', () => {
    expect(heightAt(def, 30, 24)).toBe(0);
    expect(heightAt(def, 38.5, 24)).toBeCloseTo(YARD_H / 2, 1);
    expect(heightAt(def, 50, 24)).toBe(YARD_H);
    for (const s of CAMP_LAYOUT.stations) expect(heightAt(def, s.x, s.z) === 0, s.id).toBe(s.inside);
  });
  it('walls close the hall: nothing walks off the floor', () => {
    for (const [x, z] of [[17, 10], [20, 46], [38, 12], [38, 40], [80, 20], [-3, 25]] as const) expect(free(x, z)).toBe(false);
  });
});

// Playtest 2026-11-20: station colliders were one box over the whole footprint (the Lazarett's over both
// cots, the second of which comes only at level 2). Now tight boxes per piece, switched with the level.
describe('M20 camp station colliders follow the furniture', () => {
  const atLevel = (L: number): ReturnType<typeof createSim> => {
    const sim = createSim({ level, seed: 3 });
    campOf(sim).stations = L === 0 ? {} : Object.fromEntries(STATIONS.map((st) => [st.id, L]));
    stepSim(sim, NO_INPUT);
    return sim;
  };
  const local = (s: (typeof CAMP_LAYOUT.stations)[number], x: number, z: number): [number, number] => {
    const c = Math.cos(s.rot), sn = Math.sin(s.rot), dx = x - s.x, dz = z - s.z;
    return [dx * c - dz * sn, dx * sn + dz * c];
  };
  for (const L of [0, 1, 2, 3]) {
    it(`level ${L}: boxes stay inside the footprint, leave much of it open, every ring is reached`, () => {
      atLevel(L);
      for (const s of CAMP_LAYOUT.stations) {
        const on = level.campSolids.filter((e) => e.station === s.id && level.isShut(e.collider));
        const lv = L === 0 && ['kom', 'markt', 'laz'].includes(s.id) ? 1 : L;
        expect(on.length, s.id).toBe(lv === 0 ? 1 : s.solid!.filter(([, , , , lo = 1, hi = 3]) => lv >= lo && lv <= hi).length);
        let area = 0;
        for (const { collider: c } of on) {
          if (c.kind !== 'box') continue;
          area += 4 * c.hx * c.hz;
          for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
            const [lx, lz] = local(s, c.x + a * c.hx * Math.cos(c.rot) + b * c.hz * Math.sin(c.rot), c.z - a * c.hx * Math.sin(c.rot) + b * c.hz * Math.cos(c.rot));
            expect(Math.abs(lx) <= s.w / 2 + 0.2 && Math.abs(lz) <= s.d / 2 + 0.2, `${s.id} L${lv} ${lx.toFixed(2)},${lz.toFixed(2)}`).toBe(true);
          }
        }
        if (lv > 0) expect(area / (s.w * s.d), s.id).toBeLessThan(0.6);
      }
      const r = reach(free);
      expect(free(def.start.x, def.start.z)).toBe(true);
      for (const p of CAMP_LAYOUT.places) expect(r.has(`${Math.round(p.x * 2)},${Math.round(p.z * 2)}`), `${p.id} L${L}`).toBe(true);
    });
  }
  it('the Lazarett floor where the second cot comes is open at level 1 and blocked from level 2', () => {
    const laz = CAMP_LAYOUT.stations.find((s) => s.id === 'laz')!;
    atLevel(1);
    expect(free(laz.x - 1.4, laz.z - 0.6)).toBe(true);
    atLevel(2);
    expect(free(laz.x - 1.4, laz.z - 0.6)).toBe(false);
  });
});
