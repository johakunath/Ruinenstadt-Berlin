import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, mapLevel } from '../data/map';
import { FERRY, ferryAlong, ferryPos, ferryTravel } from './ferry';
import { createSim, stepSim } from './sim';
import { NO_INPUT } from './types';

const m = koepenickMap(1);
const level = mapLevel(m, generateLots(m));
const lane = level.ferries[0]!;
const ux = Math.sin(lane.rot);
const uz = Math.cos(lane.rot);
const at = (a: number): { x: number; z: number } => ({ x: lane.x + ux * a, z: lane.z + uz * a });

describe('ferry', () => {
  it('docks at both piers and waits there', () => {
    const end = ferryTravel(lane) / 2;
    const cross = ferryTravel(lane) / FERRY.speed;
    expect(ferryAlong(lane, 0)).toBeCloseTo(end);
    expect(ferryAlong(lane, FERRY.wait - 0.1)).toBeCloseTo(end);
    expect(ferryAlong(lane, FERRY.wait + cross + 1)).toBeCloseTo(-end);
    expect(ferryAlong(lane, 2 * (FERRY.wait + cross))).toBeCloseTo(end);
  });

  it('the water between the piers blocks unless the boat is there', () => {
    level.time = 0; // boat at the +along end
    const mid = at(-ferryTravel(lane) / 2);
    expect(level.blocked(mid.x, mid.z, 0.4)).toBe(true);
    const deck = ferryPos(lane, 0);
    expect(level.blocked(deck.x, deck.z, 0.4)).toBe(false);
  });

  it('carries the hero from one pier to the other', () => {
    const sim = createSim({ level });
    const p = sim.player;
    const start = ferryPos(lane, 0);
    p.x = p.px = start.x;
    p.z = p.pz = start.z;
    const cross = ferryTravel(lane) / FERRY.speed;
    for (let i = 0; i < (FERRY.wait + cross + 1) * 60; i++) stepSim(sim, NO_INPUT);
    const end = ferryPos(lane, FERRY.wait + cross + 1);
    expect(Math.hypot(p.x - end.x, p.z - end.z)).toBeLessThan(0.3);
    // Then walk off onto the pier along the lane.
    for (let i = 0; i < 120; i++) stepSim(sim, { ...NO_INPUT, moveX: -ux, moveZ: -uz });
    const along = (p.x - lane.x) * ux + (p.z - lane.z) * uz;
    expect(along).toBeLessThan(-(lane.len / 2 - FERRY.pier));
  });

  it('cannot step off the boat into the water mid-crossing', () => {
    const sim = createSim({ level });
    const p = sim.player;
    const t0 = FERRY.wait + 2;
    sim.time = t0;
    const c = ferryPos(lane, t0);
    p.x = p.px = c.x;
    p.z = p.pz = c.z;
    // Walk sideways (across the lane) for two seconds.
    for (let i = 0; i < 120; i++) stepSim(sim, { ...NO_INPUT, moveX: uz, moveZ: -ux });
    const across = -(p.x - lane.x) * uz + (p.z - lane.z) * ux;
    expect(Math.abs(across)).toBeLessThan(lane.width / 2);
  });
});
