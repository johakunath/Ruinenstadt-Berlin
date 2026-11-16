import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, lineDist, mapLevel, streetDist, type Pt } from '../data/map';
import { SPATI, spatiWorld } from '../data/spati';
import { REST, restAt } from './rest';
import { createSim, stepSim } from './sim';
import { NO_INPUT } from './types';

const m = koepenickMap(1);
const level = mapLevel(m, generateLots(m));
const spatis = m.landmarks.filter((l) => l.kind === 'spati');

describe('Späti rest stops', () => {
  it('one per zone, beside that zone route, front on a street', () => {
    expect(level.rests).toHaveLength(m.zones.length);
    m.zones.forEach((zone, zi) => {
      const route: Pt[] = [[zone.entry.x, zone.entry.z], ...m.encounters.filter((e) => e.zone === zi).map((e) => [e.x, e.z] as Pt)];
      const near = spatis.filter((l) => lineDist(route, l.x, l.z) < 25);
      expect(near.length, zone.name).toBeGreaterThan(0);
    });
    for (const l of spatis) {
      const front = spatiWorld(l, 0, SPATI.d / 2 + 2.5);
      expect(streetDist(m, front.x, front.z).d, l.name).toBeLessThan(1.5);
      expect(m.encounters.every((e) => Math.hypot(e.x - l.x, e.z - l.z) > e.r + 6), l.name).toBe(true);
    }
  });

  it('the hero walks in through the door but not through a wall', () => {
    for (const l of spatis) {
      const sim = createSim({ level });
      const p = sim.player;
      const out = spatiWorld(l, 0, SPATI.d / 2 + 3);
      p.x = p.px = out.x;
      p.z = p.pz = out.z;
      const dx = -Math.sin(l.rot);
      const dz = -Math.cos(l.rot);
      for (let i = 0; i < 90; i++) stepSim(sim, { ...NO_INPUT, moveX: dx, moveZ: dz });
      expect(restAt(level.rests, p.x, p.z), l.name).toBeGreaterThanOrEqual(0);
      // From the side the wall holds.
      const side = spatiWorld(l, SPATI.w / 2 + 1.5, -1);
      p.x = p.px = side.x;
      p.z = p.pz = side.z;
      for (let i = 0; i < 90; i++) stepSim(sim, { ...NO_INPUT, moveX: -Math.cos(l.rot), moveZ: Math.sin(l.rot) });
      expect(restAt(level.rests, p.x, p.z), l.name).toBe(-1);
    }
  });

  it('heals inside between fights and reports the first visit', () => {
    const sim = createSim({ level });
    const p = sim.player;
    const l = spatis[0]!;
    p.hp = sim.stats.maxHp * 0.5;
    p.x = p.px = l.x;
    p.z = p.pz = l.z;
    stepSim(sim, NO_INPUT);
    expect(sim.events.some((e) => e.type === 'restEnter' && e.first)).toBe(true);
    for (let i = 0; i < 59; i++) stepSim(sim, NO_INPUT);
    const healed = p.hp - sim.stats.maxHp * 0.5;
    expect(healed).toBeGreaterThan(sim.stats.maxHp * REST.healPerSec * 0.9);
    // Leaving and coming back is not a first visit.
    sim.events.length = 0;
    p.x = p.px = l.x + 30;
    stepSim(sim, NO_INPUT);
    p.x = p.px = l.x;
    stepSim(sim, NO_INPUT);
    expect(sim.events.some((e) => e.type === 'restEnter' && !e.first)).toBe(true);
    // No healing during a fight.
    sim.run.phase = 'fight';
    const hp = p.hp;
    for (let i = 0; i < 60; i++) stepSim(sim, NO_INPUT);
    expect(p.hp).toBeLessThanOrEqual(hp + sim.stats.regen + 1e-6);
  });
});
