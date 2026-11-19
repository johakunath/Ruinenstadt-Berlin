import { describe, expect, it } from 'vitest';
import { ATTACKS, HIT_FEEL, PLAYER, WEAPON } from '../data/combat';
import { ENEMIES } from '../data/enemies';
import { colliderDistance } from './collide';
import { spawnEnemy } from './enemies';
import { createSim, stepSim } from './sim';
import { DT, NO_INPUT, type Sim, type SimEvent, type SimInput } from './types';

const input = (over: Partial<SimInput> = {}): SimInput => ({ ...NO_INPUT, ...over });

/** Steps the sim and collects all events. */
function run(sim: Sim, steps: number, inp: SimInput = NO_INPUT, log: SimEvent[] = []): SimEvent[] {
  for (let i = 0; i < steps; i++) {
    stepSim(sim, inp);
    log.push(...sim.events);
    sim.events.length = 0;
  }
  return log;
}

/** Player at the yard center facing +Z, no enemies, no spawner. */
function arena(): Sim {
  const sim = createSim({ empty: true });
  const p = sim.player;
  p.x = p.px = 3;
  p.z = p.pz = 0;
  p.facing = p.pfacing = 0;
  return sim;
}

const secs = (s: number): number => Math.round(s / DT);

describe('movement', () => {
  it('reaches full speed within 50 ms and stops as fast', () => {
    const sim = arena();
    run(sim, secs(0.05) + 1, input({ moveX: 1 }));
    expect(Math.hypot(sim.player.vx, sim.player.vz)).toBeGreaterThan(PLAYER.speed * 0.95);
    run(sim, secs(0.05) + 1);
    expect(Math.hypot(sim.player.vx, sim.player.vz)).toBeLessThan(PLAYER.speed * 0.05);
  });

  it('cannot leave the yard', () => {
    const sim = arena();
    run(sim, 600, input({ moveX: 1, moveZ: 0.3 }));
    expect(sim.player.x).toBeLessThanOrEqual(12 - PLAYER.radius + 1e-3);
    expect(sim.player.z).toBeLessThanOrEqual(8 - PLAYER.radius + 1e-3);
  });
});

describe('attack chain', () => {
  it('hits a target once per swing and applies hitstop and knockback', () => {
    const sim = arena();
    const e = spawnEnemy(sim, 3, 1.4, 'brute');
    sim.events.length = 0;
    stepSim(sim, input({ attack: true }));
    expect(sim.consumed.attack).toBe(true);
    const log = run(sim, secs(0.6));
    const hits = log.filter((ev) => ev.type === 'hit');
    expect(hits).toHaveLength(1);
    // The starter blade cuts Untote: + the D9 type bonus.
    expect(e.hp).toBe(ENEMIES.brute.hp - Math.round(ATTACKS.light1.damage * (1 + WEAPON.typeBonus)));
    expect(e.z).toBeGreaterThan(1.4);
  });

  it('freezes the world during hitstop and keeps time', () => {
    const sim = arena();
    spawnEnemy(sim, 3, 1.4, 'brute');
    stepSim(sim, input({ attack: true }));
    while (sim.hitstop === 0) stepSim(sim, NO_INPUT);
    expect(sim.hitstop).toBeCloseTo(HIT_FEEL.light.hitstop);
    const tick = sim.tick;
    const t = sim.player.stateT;
    stepSim(sim, input({ attack: true }));
    expect(sim.tick).toBe(tick);
    expect(sim.player.stateT).toBe(t);
    // The press was not consumed while frozen, so the buffer keeps it.
    expect(sim.consumed.attack).toBe(false);
  });

  it('chains light1 → light2 → light3 on buffered presses and then restarts', () => {
    const sim = arena();
    const log = run(sim, secs(2.2), input({ attack: true }));
    const swings = log.flatMap((ev) => (ev.type === 'swing' ? [ev.attack] : []));
    expect(swings.slice(0, 4)).toEqual(['light1', 'light2', 'light3', 'light1']);
  });

  it('does not start the next attack before the damage frames are over', () => {
    const sim = arena();
    stepSim(sim, input({ attack: true }));
    const a = ATTACKS.light1;
    run(sim, secs(a.windup + a.active) - 2, input({ attack: true }));
    expect(sim.player.attack?.id).toBe('light1');
    run(sim, 6, input({ attack: true }));
    expect(sim.player.attack?.id).toBe('light2');
  });

  it('drops the chain after the grace time', () => {
    const sim = arena();
    stepSim(sim, input({ attack: true }));
    const a = ATTACKS.light1;
    run(sim, secs(a.windup + a.active + a.recovery + PLAYER.comboGrace) + 3);
    stepSim(sim, input({ attack: true }));
    expect(sim.player.attack?.id).toBe('light1');
  });

  it('kills, counts the kill and removes the body later', () => {
    const sim = arena();
    const e = spawnEnemy(sim, 3, 1.3, 'runner');
    const log = run(sim, secs(1.2), input({ attack: true }));
    expect(e.state).toBe('dead');
    expect(sim.kills).toBe(1);
    expect(log.some((ev) => ev.type === 'hit' && ev.killed)).toBe(true);
    run(sim, secs(3));
    expect(sim.enemies).toHaveLength(0);
  });

  it('snaps to the nearest enemy in the cone with aim assist only', () => {
    const off = 18 * (Math.PI / 180);
    for (const assist of [true, false]) {
      const sim = arena();
      spawnEnemy(sim, 3 + Math.sin(off) * 2, Math.cos(off) * 2, 'walker');
      stepSim(sim, input({ attack: true, aimAssist: assist }));
      expect(sim.player.facing).toBeCloseTo(assist ? off : 0, 3);
    }
  });
});

describe('dodge', () => {
  it('covers the fixed distance and grants i-frames', () => {
    const sim = arena();
    stepSim(sim, input({ dodge: true, moveX: -1 }));
    expect(sim.consumed.dodge).toBe(true);
    expect(sim.player.invuln).toBeGreaterThan(0.15);
    run(sim, secs(PLAYER.dodge.duration) + 2);
    expect(sim.player.state).toBe('move');
    expect(3 - sim.player.x).toBeGreaterThan(PLAYER.dodge.distance * 0.9);
  });

  it('cancels attack recovery but not the wind-up', () => {
    const sim = arena();
    stepSim(sim, input({ attack: true }));
    stepSim(sim, input({ dodge: true }));
    expect(sim.player.state).toBe('attack');
    const a = ATTACKS.light1;
    run(sim, secs(a.windup + a.active), input({ dodge: true }));
    expect(sim.player.state).toBe('dodge');
  });

  it('turns an attack during or right after the dodge into a dash strike', () => {
    for (const wait of [secs(PLAYER.dodge.duration * 0.7), secs(PLAYER.dodge.duration + 0.1)]) {
      const sim = arena();
      stepSim(sim, input({ dodge: true }));
      run(sim, wait);
      const log = run(sim, 3, input({ attack: true }));
      expect(log.find((ev) => ev.type === 'swing')).toMatchObject({ attack: 'dash' });
    }
  });

  it('avoids a strike that would otherwise land', () => {
    for (const dodge of [false, true]) {
      const sim = arena();
      const e = spawnEnemy(sim, 3, 1.2, 'walker');
      run(sim, secs(e.def.windup) - 2);
      expect(e.state).toBe('windup');
      if (dodge) stepSim(sim, input({ dodge: true, moveZ: -1 }));
      run(sim, secs(0.5));
      expect(sim.player.hp).toBe(dodge ? PLAYER.maxHp : PLAYER.maxHp - e.def.damage);
    }
  });
});

describe('enemies', () => {
  it('walk to the player, telegraph, then strike', () => {
    const sim = arena();
    const e = spawnEnemy(sim, 3, 6, 'walker');
    sim.events.length = 0;
    const log = run(sim, secs(5));
    const order = log.map((ev) => ev.type).filter((t) => t === 'enemyWindup' || t === 'enemyStrike' || t === 'playerHit');
    expect(order.slice(0, 3)).toEqual(['enemyWindup', 'enemyStrike', 'playerHit']);
    expect(Math.hypot(e.x - sim.player.x, e.z - sim.player.z)).toBeLessThan(2.2);
  });

  it('find their way in from every gate', () => {
    const sim = createSim({ empty: true });
    for (const s of [{ x: 4.25, z: -10.6 }, { x: 14.4, z: 2.25 }, { x: 0, z: 10.6 }]) spawnEnemy(sim, s.x, s.z, 'runner');
    sim.player.invuln = 1e9;
    run(sim, secs(9));
    for (const e of sim.enemies) expect(Math.hypot(e.x - sim.player.x, e.z - sim.player.z)).toBeLessThan(2.5);
  });

  it('are staggered out of a wind-up by a light hit, a brute is not', () => {
    for (const kind of ['walker', 'brute'] as const) {
      const sim = arena();
      const e = spawnEnemy(sim, 3, 1.3, kind);
      run(sim, 4);
      expect(e.state).toBe('windup');
      run(sim, secs(0.25), input({ attack: true }));
      expect(e.state).toBe(kind === 'walker' ? 'stagger' : 'windup');
    }
  });

  it('are not pushed into props by a crowd', () => {
    const sim = arena();
    sim.player.invuln = 1e9;
    sim.player.x = sim.player.px = 8;
    // A walker squeezed between the fire barrel at (-1.4, -3.2) and a brute.
    const walker = spawnEnemy(sim, -0.5, -3.2, 'walker');
    spawnEnemy(sim, 0, -3.2, 'brute');
    for (let i = 0; i < 30; i++) {
      stepSim(sim, NO_INPUT);
      for (const c of sim.colliders) expect(colliderDistance(c, walker.x, walker.z)).toBeGreaterThan(walker.def.radius - 1e-3);
    }
  });

  it('do not stack on one spot', () => {
    const sim = arena();
    sim.player.invuln = 1e9;
    for (let i = 0; i < 12; i++) spawnEnemy(sim, 3 + (i % 4) * 0.1, 5 + i * 0.1, 'walker');
    run(sim, secs(4));
    for (const a of sim.enemies) {
      for (const b of sim.enemies) {
        if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.7);
      }
    }
  });
});

describe('player damage', () => {
  it('caps a single hit at 45% of max HP and has a grace time', () => {
    const sim = arena();
    const a = spawnEnemy(sim, 3, 1.2, 'brute');
    a.def = { ...a.def, damage: 500 };
    const log = run(sim, secs(1.3));
    expect(log.filter((ev) => ev.type === 'playerHit')).toHaveLength(1);
    expect(sim.player.hp).toBeCloseTo(PLAYER.maxHp * (1 - PLAYER.maxHitShare));
  });

  it('dies at 0 HP and ignores input afterwards', () => {
    const sim = arena();
    sim.player.hp = 5;
    spawnEnemy(sim, 3, 1.2, 'walker');
    const log = run(sim, secs(1.5));
    expect(log.some((ev) => ev.type === 'playerDie')).toBe(true);
    expect(sim.player.state).toBe('dead');
    stepSim(sim, input({ attack: true, dodge: true }));
    expect(sim.consumed.attack || sim.consumed.dodge).toBe(false);
  });
});

describe('determinism and load', () => {
  it('gives the same result for the same seed and inputs', () => {
    const play = (): string => {
      const sim = createSim({ seed: 7 });
      for (let i = 0; i < 900; i++) {
        stepSim(sim, input({ moveX: Math.sin(i / 40), moveZ: Math.cos(i / 55), attack: i % 9 === 0, dodge: i % 70 === 0 }));
        sim.events.length = 0;
      }
      return JSON.stringify([sim.player.x, sim.player.z, sim.player.hp, sim.kills, sim.enemies.map((e) => [e.x, e.z, e.hp])]);
    };
    expect(play()).toBe(play());
  });

  it('keeps the stress count alive', () => {
    const sim = createSim({ stress: 40 });
    expect(sim.enemies).toHaveLength(40);
    sim.player.invuln = 1e9;
    run(sim, 300, input({ attack: true }));
    expect(sim.enemies.filter((e) => e.state !== 'dead').length).toBeGreaterThanOrEqual(38);
  });
});
