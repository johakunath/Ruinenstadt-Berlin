import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, mapLevel } from '../data/map';
import { PLAYER } from '../data/combat';
import { createSim, stepSim } from './sim';
import { DT, NO_INPUT, type Sim, type SimEvent } from './types';

const map = koepenickMap(1);
const level = mapLevel(map, generateLots(map));

function teleport(sim: Sim, x: number, z: number): void {
  const p = sim.player;
  p.x = p.px = x;
  p.z = p.pz = z;
}

/** Steps until the encounter is won, killing whatever spawned. */
function clearEncounter(sim: Sim, log: SimEvent[]): void {
  const enc = sim.level.encounters[sim.run.index]!;
  teleport(sim, enc.x, enc.z);
  sim.player.invuln = 1e9;
  for (let i = 0; i < 60 * 120 && sim.run.index < sim.level.encounters.length && sim.level.encounters[sim.run.index] === enc; i++) {
    stepSim(sim, NO_INPUT);
    for (const e of sim.enemies) if (e.state !== 'dead' && e.stateT > 0.3) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
    log.push(...sim.events);
    sim.events.length = 0;
  }
}

describe('encounter director', () => {
  it('does nothing until the player reaches the current encounter', () => {
    const sim = createSim({ level });
    for (let i = 0; i < 60; i++) stepSim(sim, NO_INPUT);
    expect(sim.run.phase).toBe('travel');
    expect(sim.enemies).toHaveLength(0);
  });

  it('ignores encounters that are not the objective', () => {
    const sim = createSim({ level });
    const later = level.encounters[3]!;
    teleport(sim, later.x, later.z);
    for (let i = 0; i < 60; i++) stepSim(sim, NO_INPUT);
    expect(sim.run.phase).toBe('travel');
  });

  it('closes the circle during a fight', () => {
    const sim = createSim({ level });
    const enc = level.encounters[0]!;
    teleport(sim, enc.x, enc.z);
    stepSim(sim, NO_INPUT);
    expect(sim.run.phase).toBe('fight');
    sim.player.invuln = 1e9;
    for (let i = 0; i < 120; i++) stepSim(sim, { ...NO_INPUT, moveX: 1 });
    expect(Math.hypot(sim.player.x - enc.x, sim.player.z - enc.z)).toBeLessThanOrEqual(enc.r);
  });

  it('runs every wave and boss in order and ends in victory', () => {
    const sim = createSim({ level });
    const log: SimEvent[] = [];
    while (sim.run.phase !== 'won') clearEncounter(sim, log);
    const waves = log.filter((e) => e.type === 'waveStart');
    expect(waves).toHaveLength(24);
    expect(log.filter((e) => e.type === 'encounterClear')).toHaveLength(level.encounters.length);
    expect(log.filter((e) => e.type === 'zoneClear').map((e) => (e as { zone: number }).zone)).toEqual([0, 1, 2, 3]);
    expect(log.at(-1)?.type).toBe('victory');
  });

  it('spawns stronger enemies later and the zone bosses', () => {
    const sim = createSim({ level });
    const seen = new Map<string, number>();
    const firstHp: number[] = [];
    let lastWalkerHp = 0;
    while (sim.run.phase !== 'won') {
      const enc = sim.level.encounters[sim.run.index]!;
      teleport(sim, enc.x, enc.z);
      sim.player.invuln = 1e9;
      for (let i = 0; i < 60 * 120 && sim.level.encounters[sim.run.index] === enc; i++) {
        stepSim(sim, NO_INPUT);
        for (const e of sim.enemies) {
          if (e.state === 'dead' || e.stateT < 0.3) continue;
          seen.set(e.kind, (seen.get(e.kind) ?? 0) + 1);
          if (e.kind === 'walker') {
            if (firstHp.length === 0) firstHp.push(e.maxHp);
            lastWalkerHp = e.maxHp;
          }
          e.state = 'dead';
          e.stateT = 0;
        }
        sim.events.length = 0;
      }
    }
    for (const b of ['feldwebel', 'waechter', 'rex', 'hauptmann']) expect(seen.get(b)).toBe(1);
    expect(lastWalkerHp).toBeGreaterThan(firstHp[0]! * 1.5);
  });

  it('heals after a won encounter', () => {
    const sim = createSim({ level });
    sim.player.hp = 20;
    clearEncounter(sim, []);
    expect(sim.player.hp).toBe(20 + PLAYER.maxHp * level.encounters[0]!.heal);
  });

  it('a retry starts at the entry of the zone', () => {
    const sim = createSim({ level, startAt: 4 });
    expect(sim.run.index).toBe(4);
    expect(sim.player.x).toBe(level.zones[1]!.entry.x);
    expect(sim.run.phase).toBe('travel');
  });

  it('keeps bodies out of the water', () => {
    const sim = createSim({ level });
    // Walk north from the Altstadt into the Spree west of the Dammbrücke.
    teleport(sim, -10, -30);
    for (let i = 0; i < 60 * 3; i++) stepSim(sim, { ...NO_INPUT, moveZ: -1 });
    expect(sim.level.blocked(sim.player.x, sim.player.z)).toBe(false);
    expect(sim.player.z).toBeGreaterThan(-36);
    void DT;
  });
});
