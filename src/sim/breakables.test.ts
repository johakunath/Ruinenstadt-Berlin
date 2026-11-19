import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, generateProps, mapLevel } from '../data/map';
import { createBreakables, hitBreakable, type BreakableDef } from './breakables';
import type { Collider } from './collide';
import { Level } from './level';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Sim, type SimEvent } from './types';

function def(kind: 'crate' | 'bin', x: number, z: number, inside = false): BreakableDef {
  const collider: Collider = { kind: 'box', x, z, hx: 0.4, hz: 0.4, rot: 0 };
  return { kind, x, z, prop: 0, inside, collider };
}

function levelWith(defs: BreakableDef[]): Level {
  const b = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };
  return new Level('t', b, { x: 0, z: 0 }, defs.map((d) => d.collider), null, [], b, [], [], [], [], defs);
}

function simWith(defs: BreakableDef[], seed = 3): Sim {
  return createSim({ level: levelWith(defs), empty: true, seed });
}

describe('breakables', () => {
  it('a crate breaks after 2 hits, a bin after 1, and the collider is gone', () => {
    const sim = simWith([def('crate', 5, 5), def('bin', -5, 5)]);
    const [crate, bin] = sim.breakables as [Sim['breakables'][number], Sim['breakables'][number]];
    hitBreakable(sim, crate);
    expect(crate.broken).toBe(false);
    hitBreakable(sim, crate);
    expect(crate.broken).toBe(true);
    expect(bin.broken).toBe(false);
    hitBreakable(sim, bin);
    expect(bin.broken).toBe(true);
    expect(sim.level.near(5, 5, 1)).toHaveLength(0);
    expect(sim.colliders).toHaveLength(0);
    expect(sim.events.filter((e: SimEvent) => e.type === 'breakableBreak')).toHaveLength(2);
  });

  it('a new sim on the same level starts with intact props', () => {
    const level = levelWith([def('crate', 5, 5)]);
    const a = createSim({ level, empty: true });
    for (let i = 0; i < 3; i++) hitBreakable(a, a.breakables[0]!);
    expect(level.colliders).toHaveLength(0);
    const b = createSim({ level, empty: true });
    expect(level.colliders).toHaveLength(1);
    expect(b.breakables[0]!.broken).toBe(false);
    expect(b.breakables[0]!.hp).toBe(2);
  });

  it('a player swing hits a prop once per swing', () => {
    const sim = simWith([def('crate', 0, 1.2)]);
    sim.breakables[0]!.hp = 3;
    sim.player.facing = 0;
    let hits = 0;
    for (let i = 0; i < 90; i++) {
      stepSim(sim, i === 0 ? { ...NO_INPUT, attack: true } : NO_INPUT);
      hits += sim.events.filter((e) => e.type === 'breakableHit').length;
      sim.events.length = 0;
    }
    expect(hits).toBe(1);
    expect(sim.breakables[0]!.hp).toBe(2);
  });

  it('enemies never break props', () => {
    const sim = simWith([def('crate', 0, 1.2)]);
    expect(sim.breakables[0]!.hp).toBe(2);
    expect(createBreakables(sim.level.breakables)).toHaveLength(1);
  });

  it('inside a Späti the loot is better', () => {
    const rate = (inside: boolean): number => {
      const sim = simWith([def('crate', 5, 5, inside)], 11);
      let items = 0;
      const n = 1500;
      for (let i = 0; i < n; i++) {
        sim.drops.length = 0;
        const b = sim.breakables[0]!;
        b.broken = false;
        b.hp = 1;
        hitBreakable(sim, b);
        items += sim.drops.filter((d) => d.content.kind === 'item').length;
      }
      return items / n;
    };
    expect(rate(true)).toBeGreaterThan(rate(false) * 2.5);
  });
});

describe('Köpenick breakables', () => {
  const map = koepenickMap(1);
  const level = mapLevel(map, generateLots(map));

  it('has at least 30; every crate and bin on the map can be broken', () => {
    expect(level.breakables.length).toBeGreaterThanOrEqual(30);
    const props = generateProps(map, generateLots(map)).filter((p) => p.kind === 'crates' || p.kind === 'crate' || p.kind === 'bins');
    expect(level.breakables.length).toBe(props.length);
  });

  it('has 3 crates in every Späti', () => {
    const inside = level.breakables.filter((b) => b.inside);
    expect(inside.length).toBe(3 * level.rests.length);
  });
});
