import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, mapLevel } from '../data/map';
import { PLAYER } from '../data/combat';
import { createSim, stepSim } from './sim';
import { setLoadout } from './loadout';
import { DT, NO_INPUT, type Sim, type SimEvent } from './types';

const map = koepenickMap(1);
const level = mapLevel(map, generateLots(map));
level.guards = []; // Side passage guards (M16b) sleep apart from the route; tested in tunnel.test.ts.

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

  it('fights are open: the hero can leave the place and the wave comes after them', () => {
    const sim = createSim({ level });
    const enc = level.encounters[0]!;
    teleport(sim, enc.x, enc.z);
    stepSim(sim, NO_INPUT);
    expect(sim.run.phase).toBe('fight');
    sim.player.invuln = 1e9;
    // Walk back toward the start, well out of the circle.
    const dx = level.start.x - enc.x, dz = level.start.z - enc.z, d = Math.hypot(dx, dz);
    teleport(sim, enc.x + (dx / d) * (enc.r + 14), enc.z + (dz / d) * (enc.r + 14));
    sim.enemies.length = 0;
    sim.run.toSpawn = 3;
    for (let i = 0; i < 90; i++) { sim.player.invuln = 1e9; stepSim(sim, NO_INPUT); }
    expect(Math.hypot(sim.player.x - enc.x, sim.player.z - enc.z)).toBeGreaterThan(enc.r + 10);
    expect(sim.run.phase).toBe('fight');
    expect(sim.enemies.length).toBeGreaterThan(0);
    // New enemies appear around the hero, not back at the place.
    for (const e of sim.enemies) expect(Math.hypot(e.x - sim.player.x, e.z - sim.player.z)).toBeLessThan(18);
  });

  it('runs every wave and boss in order and ends in victory', () => {
    const sim = createSim({ level });
    const log: SimEvent[] = [];
    while (sim.run.phase !== 'won') clearEncounter(sim, log);
    const waves = log.filter((e) => e.type === 'waveStart');
    expect(waves).toHaveLength(31);
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

  it('heals against equipped max HP and reports only actual health restored', () => {
    for (const initial of [20, 195, 200]) {
      const sim = createSim({ level });
      setLoadout(sim, { ...sim.equipment, a: { ...sim.equipment.w!, slot: 'a', kind: 'armor', value: 100 } });
      sim.player.hp = initial;
      const log: SimEvent[] = [];
      clearEncounter(sim, log);
      const restored = Math.min(200 - initial, Math.round(200 * level.encounters[0]!.heal));
      expect(sim.player.hp).toBe(initial + restored);
      expect(log.find(e => e.type === 'encounterClear')).toMatchObject({ heal: restored });
    }
  });

  it('a retry starts at the entry of the zone', () => {
    const sim = createSim({ level, startAt: 4 });
    expect(sim.run.index).toBe(4);
    expect(sim.player.x).toBe(level.zones[1]!.entry.x);
    expect(sim.run.phase).toBe('travel');
  });

  it('a rat in a wave mix is one unit of the count and comes as a pack of five, never elite (M12b)', () => {
    const lv = mapLevel(map, generateLots(map));
    lv.guards = [];
    lv.encounters[0] = { ...lv.encounters[0]!, waves: [{ count: 2, maxAlive: 20, mix: { rat: 1 }, hpMul: 1, dmgMul: 1, bosses: [], elite: 1 }] };
    const sim = createSim({ level: lv });
    const enc = lv.encounters[0]!;
    teleport(sim, enc.x, enc.z);
    for (let i = 0; i < 60; i++) { sim.player.invuln = 1e9; stepSim(sim, NO_INPUT); }
    const rats = sim.enemies.filter((e) => e.kind === 'rat');
    expect(rats).toHaveLength(10);
    expect(sim.run.toSpawn).toBe(0);
    expect(rats.some((e) => e.elite)).toBe(false);
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
