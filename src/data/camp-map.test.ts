import { describe, expect, it } from 'vitest';
import { CAMP_LAYOUT, campMap, campPlaceAt, onCampFloor, YARD_H } from './camp-map';
import { generateLots, generateProps, heightAt, mapLevel } from './map';
import { STATIONS } from './camp';
import { createSim, stepSim } from '../sim/sim';
import { NO_INPUT } from '../sim/types';

const def = campMap();
const lots = generateLots(def);
const props = generateProps(def, lots);
const level = mapLevel(def, lots, props);
const R = 0.4;
const free = (x: number, z: number): boolean => !level.blocked(x, z, R) && !level.near(x, z, R + 0.1).some((c) => c.kind === 'circle' ? Math.hypot(c.x - x, c.z - z) < c.r + R : Math.abs((x - c.x) * Math.cos(c.rot) - (z - c.z) * Math.sin(c.rot)) < c.hx + R && Math.abs((x - c.x) * Math.sin(c.rot) + (z - c.z) * Math.cos(c.rot)) < c.hz + R);

/** Cells the hero reaches from the start (0.5 m grid flood fill). */
function reach(): Set<string> {
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
const reached = reach();
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
