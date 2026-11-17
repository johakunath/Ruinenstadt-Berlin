import { describe, expect, it } from 'vitest';
import { generateLots, generateProps, inTunnel, mapLevel } from './map';
import { tunnelMap, tunnelZ } from './tunnel';
import { createSim, stepSim } from '../sim/sim';
import { NO_INPUT } from '../sim/types';
import { killEnemy } from '../sim/combat';
import { parseSave, simFromSave, snapshot } from '../sim/save';

const m = tunnelMap();
const lots = generateLots(m), props = generateProps(m, lots), level = mapLevel(m, lots, props);

/** Flood fill over the walk grid from the start. */
function reachable(): (x: number, z: number) => boolean {
  const seen = new Set<string>(), q: Array<[number, number]> = [[Math.round(m.start.x), Math.round(m.start.z)]];
  while (q.length) {
    const [x, z] = q.pop()!, k = `${x},${z}`;
    if (seen.has(k) || level.blocked(x, z, 0.4)) continue;
    seen.add(k);
    q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return (x, z) => seen.has(`${Math.round(x)},${Math.round(z)}`);
}

describe('M19 S3 tunnel (layout B)', () => {
  it('has no lots, keeps props and fights inside the tubes', () => {
    expect(lots).toHaveLength(0);
    for (const p of props) expect(inTunnel(m, p.x, p.z), `${p.kind} ${p.x},${p.z}`).toBe(true);
    for (const e of m.encounters) expect(inTunnel(m, e.x, e.z)).toBe(true);
    expect(level.blocked(200, 60)).toBe(true);
  });
  it('every fight, the blessing passage, the cache and the mini-boss are reachable from the start', () => {
    const ok = reachable();
    for (const e of m.encounters) expect(ok(e.x, e.z), e.name).toBe(true);
    const h = m.hiddenSpots![0]!;
    expect(ok(h.x, h.z)).toBe(true);
    expect(ok(206, tunnelZ(196) + 29)).toBe(true);
    const g = m.guards![0]!;
    expect(ok(g.x, g.z)).toBe(true);
  });
  it('the blessing passage comes first, the Schaffner waits at the generator', () => {
    expect(m.hiddenSpots![0]!.x).toBeLessThan(m.encounters[0]!.x);
    expect(m.encounters.at(-1)!.waves.at(-1)!.bosses).toEqual(['schaffner']);
  });
  it('the mini-boss sleeps until the hero comes near and never holds up a wave', () => {
    const sim = createSim({ level, seed: 4 });
    const boss = sim.enemies.find(e => e.sleep !== undefined)!;
    expect(boss.elite).toBeTruthy();
    expect(sim.content.hidden[0]).toMatchObject(m.hiddenSpots![0]!);
    for (let i = 0; i < 60; i++) stepSim(sim, NO_INPUT);
    const x0 = boss.x, z0 = boss.z;
    for (let i = 0; i < 600; i++) stepSim(sim, NO_INPUT);
    expect(Math.hypot(boss.x - x0, boss.z - z0)).toBeLessThan(0.05);
    expect(boss.sleep).toBeGreaterThan(0);
    sim.player.x = sim.player.px = boss.x; sim.player.z = sim.player.pz = boss.z + 5;
    stepSim(sim, NO_INPUT);
    expect(boss.sleep).toBe(0);
  });
  it('a beaten mini-boss stays beaten after a checkpoint resume (Codex review)', () => {
    const sim = createSim({ level, seed: 4 });
    killEnemy(sim, sim.enemies.find(e => e.sleep !== undefined)!);
    const save = parseSave(JSON.stringify(snapshot(sim, m.name, true)))!;
    expect(save.run!.guardsDown).toEqual([0]);
    const back = simFromSave(save, { seed: 1, stress: 0, level }, true);
    expect(back.enemies.filter(e => e.guardIndex !== undefined)).toHaveLength(0);
    const fresh = simFromSave(save, { seed: 1, stress: 0, level }, false);
    expect(fresh.enemies.filter(e => e.guardIndex !== undefined)).toHaveLength(1);
  });
});
