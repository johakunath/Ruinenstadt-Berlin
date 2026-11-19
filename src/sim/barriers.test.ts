import { describe, expect, it } from 'vitest';
import { PLAYER } from '../data/combat';
import { BOSS, type EnemyKind } from '../data/enemies';
import { generateLots, generateProps, mapLevel } from '../data/map';
import { mitteMap } from '../data/mitte';
import { colliderDistance, type Collider } from './collide';
import { strike } from './combat';
import { focusFlow } from './director';
import { spawnEnemy } from './enemies';
import { Level } from './level';
import { reachable } from './reach';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Enemy, type Sim, type SimEvent, type SimInput } from './types';

const T = BOSS.tuersteher;
const def = mitteMap(1);
const lots = generateLots(def);
const L = mapLevel(def, lots, generateProps(def, lots));
const PARISER = def.encounters.findIndex((e) => e.id === 'pariser');
const bars = L.barriers;
/** The middle passage; bar plane normal is world +x (east, Pariser Platz). */
const mid = bars[2]!;

function put(s: Sim, kind: EnemyKind, x: number, z: number): Enemy {
  const e = spawnEnemy(s, x, z, kind);
  e.hp = e.maxHp = 1e6;
  e.def = { ...e.def, speed: 0 };
  e.cd = [99, 99, 99];
  e.wake = 0;
  return e;
}

/** Hero `hx` m east of the middle bar, the Türsteher (raging unless told) 7 m east, nothing else alive. */
function setup(hx = 1.8, hz = 0, rage = true): { s: Sim; boss: Enemy } {
  const s = createSim({ level: L, empty: true, startAt: PARISER });
  s.enemies.length = 0;
  s.stats.crit = 0;
  const p = s.player;
  p.x = p.px = mid.x + hx;
  p.z = p.pz = mid.z + hz;
  const boss = put(s, 'tuersteher', mid.x + 7, mid.z);
  boss.rage = rage;
  focusFlow(s, p.x, p.z);
  s.events.length = 0;
  return { s, boss };
}

/** Steps (no hitstop) and collects events; the hero never dies. */
function run(s: Sim, seconds: number, inp: Partial<SimInput> = {}): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.hitstop = 0;
    stepSim(s, { ...NO_INPUT, ...inp });
    if (s.player.hp < 50) s.player.hp = s.stats.maxHp;
    out.push(...s.events);
    s.events.length = 0;
  }
  return out;
}
/** Steps until the bar state changes to `state` (at most `max` s); returns the seconds taken. */
function until(s: Sim, state: Sim['barrier']['state'], max = 20): number {
  for (let i = 0; i < max * 60; i++) {
    if (s.barrier.state === state) return i / 60;
    run(s, 1 / 60);
  }
  return Infinity;
}
const phases = (evs: SimEvent[]): string[] => evs.flatMap((e) => (e.type === 'barrier' ? [e.phase] : []));
const barHits = (evs: SimEvent[]): Array<SimEvent & { type: 'playerHit' }> =>
  evs.filter((e): e is SimEvent & { type: 'playerHit' } => e.type === 'playerHit' && e.by.includes('Neonschranke'));
const shutCount = (): number => bars.filter((b) => L.colliders.includes(b.collider)).length;
const clearOf = (x: number, z: number, r: number): boolean => L.near(x, z, r + 1).every((c) => colliderDistance(c, x, z) >= r - 1e-6);

describe('Türsteher neon bars (P25)', () => {
  it('never shut without rage or with the hero far from the Tor', () => {
    const calm = setup(1.8, 0, false);
    expect(phases(run(calm.s, 3))).toEqual([]);
    const far = setup(T.barNear + 4);
    expect(phases(run(far.s, 3))).toEqual([]);
    expect(shutCount()).toBe(0);
  });

  it('rage, hero near: strip, shut after the wind-up, open after the shut time, not again within the pause', () => {
    const { s } = setup();
    const first = run(s, 1 / 60);
    expect(phases(first)).toEqual(['wind']);
    expect(first.some((e) => e.type === 'note' && e.text === 'Kein Einlass!')).toBe(true);
    expect(until(s, 'shut')).toBeCloseTo(T.barWind, 1);
    expect(shutCount()).toBe(5);
    expect(until(s, 'idle')).toBeCloseTo(T.barTime, 1);
    expect(shutCount()).toBe(0);
    expect(phases(run(s, T.barEvery - 0.1))).toEqual([]);
    expect(phases(run(s, 0.2))).toEqual(['wind']);
  });

  it('pushes the hero and a walker standing on the bar plane out to their own side in the shut step', () => {
    const { s } = setup(0.1, 0.5);
    const w = put(s, 'walker', mid.x - 0.1, mid.z - 1.2);
    run(s, 1 / 60);
    let shutStep: SimEvent[] = [];
    for (let i = 0; i < 120 && s.barrier.state !== 'shut'; i++) shutStep = run(s, 1 / 60);
    expect(phases(shutStep)).toEqual(['shut']);
    const p = s.player;
    expect(p.x).toBeGreaterThan(mid.x + 0.3);
    expect(clearOf(p.x, p.z, PLAYER.radius)).toBe(true);
    expect(w.x).toBeLessThan(mid.x - 0.3);
    expect(clearOf(w.x, w.z, w.def.radius)).toBe(true);
  });

  it('hits a hero on the strip exactly once (capped at ten times the damage); none when rolling or beside it', () => {
    const on = setup(0.1);
    const hits = barHits(run(on.s, T.barWind + T.barTime + 0.5));
    expect(hits).toHaveLength(1);
    expect(hits[0]!.by).toBe('Der Türsteher · Neonschranke');
    expect(hits[0]!.dx).toBeGreaterThan(0.99);

    const hard = setup(0.1);
    hard.boss.dmgMul = 10;
    const big = barHits(run(hard.s, T.barWind + 0.2));
    expect(big).toHaveLength(1);
    expect(big[0]!.damage).toBeLessThanOrEqual(hard.s.stats.maxHp * PLAYER.maxHitShare + 1e-6);

    const roll = setup(0.1);
    run(roll.s, T.barWind - 4 / 60);
    const rolled = run(roll.s, 0.4, { dodge: true, moveZ: 1 });
    expect(phases(rolled)).toContain('shut');
    expect(barHits(rolled)).toHaveLength(0);

    const beside = setup(PLAYER.radius + 0.35);
    expect(barHits(run(beside.s, T.barWind + 0.2))).toHaveLength(0);
  });

  it('opens in the step the boss dies, while shut or winding; the passage is walkable again', () => {
    for (const at of ['wind', 'shut'] as const) {
      const { s, boss } = setup();
      expect(until(s, at)).toBeLessThan(2);
      strike(s, boss, 1e9);
      const evs = run(s, 1 / 60);
      expect(phases(evs), at).toEqual(['open']);
      expect(s.barrier.state).toBe('idle');
      expect(shutCount()).toBe(0);
      expect(clearOf(mid.x, mid.z, PLAYER.radius)).toBe(true);
      expect(s.flow.blocked[s.flow.cellAt(mid.x, mid.z)]).toBe(0);
    }
  });

  it('waits for the boss: no wind-up near a bar, no shut while he stands in one', () => {
    const { s, boss } = setup();
    boss.x = boss.px = mid.x + 0.3 + T.barClear + boss.def.radius - 0.2;
    expect(phases(run(s, 1))).toEqual([]);
    boss.x = boss.px = mid.x + 7;
    expect(phases(run(s, 1 / 60))).toEqual(['wind']);
    boss.x = boss.px = mid.x + 0.5;
    boss.z = boss.pz = mid.z;
    const held = run(s, T.barWind + 1);
    expect(phases(held)).toEqual([]);
    expect(s.barrier.state).toBe('wind');
    expect(shutCount()).toBe(0);
    boss.x = boss.px = mid.x + 7;
    expect(phases(run(s, 1 / 60))).toEqual(['shut']);
  });

  it('stops an enemy shot and a hero projectile while shut, lets both pass open', () => {
    const fire = (s: Sim): { shot: () => number; bolt: () => number } => {
      const z = mid.z - 1.5;
      s.threats.shots.push({ x: mid.x + 1.5, z, px: mid.x + 1.5, pz: z, vx: -8, vz: 0, r: 0.2, damage: 1, life: 1, boss: false });
      s.abilities.projectiles.push({ x: mid.x + 1.5, z: z - 0.6, px: mid.x + 1.5, pz: z - 0.6, angle: -Math.PI / 2, speed: 12, life: 1, damage: 1, crit: false, pierce: 0, extra: 0, hits: [], kind: 'stone', wucht: false });
      let minShot = Infinity, minBolt = Infinity;
      for (let i = 0; i < 30; i++) {
        run(s, 1 / 60);
        for (const q of s.threats.shots) minShot = Math.min(minShot, q.x);
        for (const q of s.abilities.projectiles) minBolt = Math.min(minBolt, q.x);
      }
      return { shot: () => minShot, bolt: () => minBolt };
    };
    const shut = setup(2.5, 2);
    until(shut.s, 'shut');
    const a = fire(shut.s);
    expect(a.shot()).toBeGreaterThan(mid.x);
    expect(a.bolt()).toBeGreaterThan(mid.x);
    const open = setup(2.5, 2, false);
    const b = fire(open.s);
    expect(b.shot()).toBeLessThan(mid.x - 1);
    expect(b.bolt()).toBeLessThan(mid.x - 1);
  });

  it('cuts the line of sight across a bar while shut', () => {
    const { s } = setup();
    const line = (): boolean => s.flow.clearLine(mid.x + 1.5, mid.z - 1, mid.x - 3, mid.z - 1);
    expect(line()).toBe(true);
    until(s, 'shut');
    expect(line()).toBe(false);
    until(s, 'idle');
    expect(line()).toBe(true);
  });

  it('a new sim on the same level after a run that ended shut starts open', () => {
    const { s } = setup();
    until(s, 'shut');
    expect(shutCount()).toBe(5);
    const next = createSim({ level: L, empty: true, startAt: PARISER });
    expect(next.barrier.state).toBe('idle');
    expect(shutCount()).toBe(0);
    expect(bars.every((b) => !L.isShut(b.collider))).toBe(true);
  });

  it('a reach grid first built while shut still reaches through the passage', () => {
    // A wall across a small map with one gap; the bar closes the gap; start on the west side.
    const B = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    const walls: Collider[] = [{ kind: 'box', x: 0, z: -6, hx: 0.5, hz: 4.5, rot: 0 }, { kind: 'box', x: 0, z: 6, hx: 0.5, hz: 4.5, rot: 0 }];
    const lv = new Level('gap', B, { x: -6, z: 0 }, walls, null, [], B);
    const bar: Collider = { kind: 'box', x: 0, z: 0, hx: 2.1, hz: 0.3, rot: Math.PI / 2 };
    lv.shut(bar);
    expect(reachable(lv, 6, 0)).toBe(true);
    lv.open(bar);
  });
});
