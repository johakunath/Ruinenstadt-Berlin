import { describe, expect, it } from 'vitest';
import { ATTACKS, PLAYER } from '../data/combat';
import type { Item } from './items';
import { setLoadout, starterEquipment } from './loadout';
import { spawnEnemy } from './enemies';
import { createSim, stepSim } from './sim';
import { DT, NO_INPUT, type Sim, type SimEvent, type SimInput } from './types';
import type { Equipment, StatContext } from './stats';

const weapon = (over: Partial<Item> = {}): Item => ({ ...starterEquipment().w!, affixes: [{ id: 'crit', value: -8 }], ...over });
const gear = (w: Partial<Item> = {}, rest: Equipment = {}): Equipment => ({ w: weapon(w), ...rest });
const armor = (value: number): Item => weapon({ slot: 'a', kind: 'armor', base: 'rohr', value });
function arena(equipment = gear(), context: Partial<StatContext> = {}, seed = 1): Sim {
  const sim = createSim({ empty: true, equipment, statContext: context, seed });
  Object.assign(sim.player, { x: 3, px: 3, z: 0, pz: 0, facing: 0, pfacing: 0 });
  return sim;
}
function target(sim: Sim, x = 3, z = 1.5) {
  const e = spawnEnemy(sim, x, z, 'brute');
  e.hp = e.maxHp = 10000;
  // No class: the D9 type bonus would hide the equipment numbers under test.
  e.def = { ...e.def, speed: 0, attackRange: 0, knockbackTaken: 0, classes: [] };
  return e;
}
function run(sim: Sim, steps: number, input: SimInput = NO_INPUT): SimEvent[] {
  const log: SimEvent[] = [];
  sim.events.length = 0;
  for (let i = 0; i < steps; i++) { stepSim(sim, input); log.push(...sim.events); sim.events.length = 0; }
  return log;
}
function swing(sim: Sim): SimEvent[] {
  return [...run(sim, 1, { ...NO_INPUT, attack: true }), ...run(sim, 50)];
}
const hits = (log: SimEvent[]) => log.filter((e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit');

describe('equipment in the 3D simulation', () => {
  it('starts with independent starter gear and equipped max health', () => {
    const a = createSim({ empty: true }), b = createSim({ empty: true });
    expect(a.stats).toMatchObject({ damage: 10, maxHp: 100, crit: .08, moveSpeed: 1, attackSpeed: 1 });
    expect(a.player.hp).toBe(a.stats.maxHp);
    a.equipment.w!.value = 90;
    expect(b.equipment.w!.value).toBe(10);
    const supplied = gear({}, { a: armor(100) }), context = { upgrades: { hp: 2 } };
    const sim = arena(supplied, context);
    expect(sim.player.hp).toBe(220);
    supplied.a!.value = 900; context.upgrades.hp = 9;
    expect(sim.equipment.a!.value).toBe(100);
    expect(sim.statContext.upgrades.hp).toBe(2);
  });

  it('refreshes health proportionally, isolates callers and rejects an invalid loadout atomically', () => {
    const sim = arena(); sim.player.hp = 25;
    const equipment = gear({}, { a: armor(100) });
    setLoadout(sim, equipment);
    expect(sim.stats.maxHp).toBe(200); expect(sim.player.hp).toBe(50);
    equipment.a!.value = 500;
    expect(sim.equipment.a!.value).toBe(100);
    setLoadout(sim, gear()); expect(sim.player.hp).toBe(25);
    const before = JSON.stringify([sim.equipment, sim.statContext, sim.stats, sim.player.hp]);
    expect(() => setLoadout(sim, {})).toThrow('weapon');
    expect(JSON.stringify([sim.equipment, sim.statContext, sim.stats, sim.player.hp])).toBe(before);
    sim.player.hp = .01; setLoadout(sim, gear()); expect(sim.player.hp).toBe(1);
    sim.player.state = 'dead'; sim.player.hp = 0;
    setLoadout(sim, gear({}, { a: armor(100) })); expect(sim.player.hp).toBe(0);
  });

  it('uses upgraded weapon damage for real hit events and preserves attack ratios', () => {
    for (const value of [10, 20]) {
      const sim = arena(gear({ value })); const e = target(sim);
      const log = hits(swing(sim));
      expect(log).toHaveLength(1); expect(log[0]!.damage).toBe(value);
      expect(e.hp).toBe(10000 - value);
    }
    const sim = arena(gear({ value: 20 }));
    // Dash attacks retain their 1.5x multiplier.
    sim.player.strikeT = 1;
    target(sim);
    expect(hits(swing(sim))[0]!.damage).toBe(30);
  });

  it('snapshots a swing, so equipment changes affect the next attack', () => {
    const sim = arena(); target(sim);
    run(sim, 1, { ...NO_INPUT, attack: true });
    const first = sim.player.attack;
    setLoadout(sim, gear({ value: 30, affixes: [{ id: 'as', value: 100 }, { id: 'crit', value: -8 }] }));
    expect(sim.player.attack).toBe(first);
    expect(hits(run(sim, 50))[0]!.damage).toBe(10);
    expect(sim.player.attackSpeed).toBe(1);
    expect(hits(swing(sim))[0]!.damage).toBe(30);
    expect(sim.player.attackSpeed).toBe(2);
    expect(ATTACKS.light1.windup).toBe(.08); expect(ATTACKS.light1.damage).toBe(10);
  });

  it('uses one seeded critical roll per swing for every target', () => {
    const play = (seed: number) => {
      const sim = arena(gear({ affixes: [{ id: 'crit', value: 67 }] }), {}, seed);
      target(sim, 2.5); target(sim, 3.5);
      const log = hits(swing(sim));
      expect(log).toHaveLength(2);
      expect(new Set(log.map(e => e.critical)).size).toBe(1);
      return log.map(e => ({ damage: e.damage, critical: e.critical }));
    };
    expect(play(1)).toEqual([{ damage: 20, critical: true }, { damage: 20, critical: true }]);
    expect(play(4)).toEqual([{ damage: 10, critical: false }, { damage: 10, critical: false }]);
    expect(play(1)).toEqual(play(1));
  });

  it('applies resistance/vulnerability before the equipped-health 45% cap', () => {
    for (const [res, raw, expected] of [[50, 40, 20], [-50, 40, 60], [50, 1000, 90]] as const) {
      const sim = arena(gear({ affixes: [{ id: 'res', value: res }] }, { a: armor(100) }));
      const e = spawnEnemy(sim, 3, 1.2, 'brute');
      e.def = { ...e.def, damage: raw };
      const log = run(sim, 75).filter(e => e.type === 'playerHit');
      expect(log).toHaveLength(1); expect(log[0]).toMatchObject({ damage: expected });
      expect(sim.player.hp).toBe(200 - expected);
    }
  });

  it('scales move speed and acceleration without changing dodge distance', () => {
    for (const speed of [.5, 1, 1.5]) {
      const sim = arena(gear({ affixes: [{ id: 'spd', value: (speed - 1) * 100 }] }));
      run(sim, 4, { ...NO_INPUT, moveX: 1 });
      expect(sim.player.vx).toBeCloseTo(PLAYER.speed * speed);
    }
    const sim = arena(gear(), { upgrades: { dash: 5 }, perks: { dashcd: 2 }, survivors: { mechaniker: true } });
    run(sim, 1, { ...NO_INPUT, dodge: true, moveX: -1 });
    while (sim.player.state === 'dodge') run(sim, 1);
    expect(sim.player.dodgeCd).toBeCloseTo(.28 * .4536 / 1.4);
    expect(3 - sim.player.x).toBeGreaterThan(PLAYER.dodge.distance * .9);
  });

  it('scales attack phases and chain gap together, while hitstop freezes them', () => {
    const times: number[] = [];
    for (const speed of [1, 2]) {
      const sim = arena(gear({ affixes: [{ id: 'as', value: (speed - 1) * 100 }, { id: 'crit', value: -8 }] }));
      run(sim, 1, { ...NO_INPUT, attack: true });
      expect(sim.player.attack!.windup).toBeCloseTo(ATTACKS.light1.windup / speed);
      expect(sim.player.attack!.active).toBeCloseTo(ATTACKS.light1.active / speed);
      expect(sim.player.attack!.recovery).toBeCloseTo(ATTACKS.light1.recovery / speed);
      let n = 0;
      while (sim.player.attack?.id === 'light1' && n++ < 100) run(sim, 1, { ...NO_INPUT, attack: true });
      expect(sim.player.attack?.id).toBe('light2'); times.push(n * DT);
      target(sim, sim.player.x, sim.player.z + 1.5);
      while (sim.hitstop === 0) run(sim, 1);
      const stateT = sim.player.stateT, attack = sim.player.attack;
      run(sim, 1, { ...NO_INPUT, attack: true });
      expect(sim.player.stateT).toBe(stateT); expect(sim.player.attack).toBe(attack);
      expect(sim.consumed.attack).toBe(false);
    }
    expect(times[1]).toBeCloseTo(times[0]! / 2, 1);
  });

  it('scales weapon reach for the actual sweep', () => {
    for (const reach of [0, 3]) {
      const sim = arena(gear(), { perks: { reach } }); target(sim, 3, 3.6);
      const log = hits(swing(sim));
      expect(log.length).toBe(reach === 0 ? 0 : 1);
    }
  });

  it('regenerates on live sim steps, pauses in hitstop and never heals a corpse', () => {
    const sim = arena(gear({ affixes: [{ id: 'regen', value: 3 }] })); sim.player.hp = 50;
    sim.hitstop = .5; run(sim, 1); expect(sim.player.hp).toBe(50);
    sim.hitstop = 0; run(sim, 60); expect(sim.player.hp).toBeCloseTo(53);
    sim.player.hp = 99.99; run(sim, 60); expect(sim.player.hp).toBe(100);
    sim.player.state = 'dead'; sim.player.hp = 0; run(sim, 60); expect(sim.player.hp).toBe(0);
  });

  it('heals gear leech once per kill and clamps at equipped max HP', () => {
    for (const hp of [50, 98]) {
      const sim = arena(gear({ value: 1000, mods: ['dorn'] })); sim.player.hp = hp;
      const e = target(sim); e.hp = 1;
      const log = hits(swing(sim));
      expect(log).toHaveLength(1); expect(log[0]!.killed).toBe(true);
      expect(sim.player.hp).toBe(Math.min(100, hp + 5));
      run(sim, 60); expect(sim.player.hp).toBe(Math.min(100, hp + 5));
    }
  });

  it('can carry the same isolated loadout/context into a retry', () => {
    const sim = arena(gear({ value: 30 }), { meal: 'suppe', upgrades: { hp: 2 } });
    const retry = createSim({ empty: true, equipment: sim.equipment, statContext: sim.statContext });
    expect(retry.stats).toEqual(sim.stats); expect(retry.player.hp).toBe(retry.stats.maxHp);
    retry.equipment.w!.value = 99; expect(sim.equipment.w!.value).toBe(30);
  });
});
