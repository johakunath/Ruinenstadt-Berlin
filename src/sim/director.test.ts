import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, mapLevel } from '../data/map';
import { PLAYER } from '../data/combat';
import { DISTRICT_STEP } from '../data/enemies';
import { createSim, stepSim } from './sim';
import { setLoadout } from './loadout';
import { summon } from './ai';
import { encounterAlive, spawnEnemy, splitElite } from './enemies';
import { DT, NO_INPUT, type Sim, type SimEvent } from './types';
import { Level } from './level';
import { LULL } from './director';

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
    // Builds its own Köpenick level (about 3.5 s alone, over the 5 s default on a loaded CI runner).
  }, 20000);

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

describe('review 2026-11-20: fights and the victory', () => {
  it('only the encounter\'s own bodies fill a wave and hold it open; others keep fighting', () => {
    const sim = createSim({ level });
    const enc = level.encounters[0]!;
    // An awake captive guard and leftover event adds far off (one stuck behind a wall soft-locked the run).
    const strays = Array.from({ length: 8 }, (_, i) => spawnEnemy(sim, enc.x + 30 + i, enc.z + 30, 'walker'));
    strays[0]!.guard = true;
    const hold = (): void => { for (const e of strays) { e.x = e.px = enc.x + 30; e.z = e.pz = enc.z + 30; } };
    teleport(sim, enc.x, enc.z);
    sim.player.invuln = 1e9;
    stepSim(sim, NO_INPUT);
    expect(sim.run.phase).toBe('fight');
    // Eight strays are more than the wave's `maxAlive`: its own spawns still come.
    for (let i = 0; i < 60 * 3; i++) { sim.player.invuln = 1e9; stepSim(sim, NO_INPUT); hold(); }
    const own = sim.enemies.filter((e) => e.enc === 0 && e.state !== 'dead').length;
    expect(own).toBeGreaterThan(0);
    expect(encounterAlive(sim, 0)).toBe(own);
    // Kill only the encounter's bodies: it is won although the strays still stand.
    for (let i = 0; i < 60 * 120 && sim.run.index === 0; i++) {
      sim.player.invuln = 1e9;
      stepSim(sim, NO_INPUT);
      for (const e of sim.enemies) if (e.enc === 0 && e.state !== 'dead' && e.stateT > 0.3) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
      hold();
    }
    expect(sim.run.index).toBe(1);
    expect(strays.every((e) => e.state !== 'dead')).toBe(true);
  });

  it('a boss\'s adds and a Spaltend elite\'s halves belong to its fight', () => {
    const sim = createSim({ level });
    const boss = spawnEnemy(sim, sim.player.x + 6, sim.player.z, 'feldwebel');
    boss.enc = 3;
    summon(sim, boss, 'walker', 2);
    const adds = sim.enemies.filter((e) => e !== boss);
    expect(adds.length).toBe(2);
    expect(adds.every((e) => e.enc === 3)).toBe(true);
    const el = spawnEnemy(sim, sim.player.x - 6, sim.player.z, 'walker');
    el.enc = 3;
    splitElite(sim, el);
    const minis = sim.enemies.filter((e) => e.mini);
    expect(minis.length).toBeGreaterThan(0);
    expect(minis.every((e) => e.enc === 3)).toBe(true);
  });

  it('the victory puts out every shot, marked zone and burning ground', () => {
    const last = level.encounters.length - 1;
    const sim = createSim({ level, startAt: last });
    const enc = level.encounters[last]!;
    teleport(sim, enc.x, enc.z);
    sim.player.invuln = 1e9;
    stepSim(sim, NO_INPUT);
    expect(sim.run.phase).toBe('fight');
    sim.run.wave = enc.waves.length - 1;
    sim.run.toSpawn = 0;
    sim.run.bossesToSpawn = [];
    sim.enemies.length = 0;
    const T = sim.threats, p = sim.player;
    T.zones.push({ x: p.x, z: p.z, r: 2, t: 5, max: 5, damage: 50, floor: 0, kind: 'slam', src: -1, free: true });
    T.shots.push({ x: p.x + 20, z: p.z, px: p.x + 20, pz: p.z, vx: -1, vz: 0, r: 0.3, damage: 50, life: 9, boss: false });
    T.hazards.push({ x: p.x, z: p.z, r: 2, t: 9, max: 9, damage: 9, tick: 0.5, kind: 'fire' });
    const log: SimEvent[] = [];
    for (let i = 0; i < 3 && sim.run.phase !== 'won'; i++) { stepSim(sim, NO_INPUT); log.push(...sim.events); }
    expect(sim.run.phase).toBe('won');
    expect(log.some((e) => e.type === 'victory')).toBe(true);
    expect(T.zones.length + T.shots.length + T.hazards.length + T.waves.length + T.sweeps.length + T.spots.length).toBe(0);
  });

  it('an encounter tells the hero\'s life at its start (telemetry `h0`)', () => {
    const sim = createSim({ level });
    sim.player.hp = 54;
    const enc = level.encounters[0]!;
    teleport(sim, enc.x, enc.z);
    stepSim(sim, NO_INPUT);
    expect(sim.events.find((e) => e.type === 'encounterStart')).toMatchObject({ index: 0, hp: 54 });
  });
});

describe('district step (bot campaigns 2026-11-21)', () => {
  it('a later district spawns the same wave with more life and damage', () => {
    const first = (strength: number) => {
      const lv = level;
      lv.strength = strength;
      const sim = createSim({ level: lv, seed: 4 });
      const enc = lv.encounters[0]!;
      teleport(sim, enc.x, enc.z);
      for (let i = 0; i < 600 && !sim.enemies.length; i++) stepSim(sim, NO_INPUT);
      lv.strength = 0;
      const e = sim.enemies[0]!;
      return { hp: e.maxHp, dmg: e.dmgMul };
    };
    const a = first(0), c = first(2);
    expect(c.hp / a.hp).toBeCloseTo(1 + 2 * DISTRICT_STEP.hp, 1);
    expect(c.dmg / a.dmg).toBeCloseTo(1 + 2 * DISTRICT_STEP.dmg, 5);
  });
});

describe('stragglers (B2 step 3)', () => {
  it('a fight body walled in where nobody reaches it steps out near the hero after a quiet spell', () => {
    const b = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
    const wall = (x: number, z: number, hx: number, hz: number) => ({ kind: 'box' as const, x, z, hx, hz, rot: 0 });
    // A sealed 2 m box around (20, 20): four walls.
    const walls = [wall(20, 18.5, 1.5, 0.3), wall(20, 21.5, 1.5, 0.3), wall(18.5, 20, 0.3, 1.5), wall(21.5, 20, 0.3, 1.5)];
    const enc = { id: 'e', name: 'E', zone: 0, x: 0, z: 0, r: 30, heal: 0, waves: [{ count: 0, maxAlive: 4, mix: { walker: 1 }, hpMul: 1, dmgMul: 1, bosses: [], elite: 0 }] };
    const L = new Level('t', b, { x: 0, z: 0 }, walls, null, [], b, [enc], [{ id: 'z', name: 'Z', entry: { x: 0, z: 0 } }]);
    const s = createSim({ level: L, seed: 4 });
    const e = spawnEnemy(s, 20, 20, 'walker');
    s.run.phase = 'fight';
    e.enc = 0;
    for (let i = 0; i < Math.round((LULL.time + 1) / DT) && Math.hypot(e.x - s.player.x, e.z - s.player.z) > 10; i++) { s.hitstop = 0; stepSim(s, NO_INPUT); s.events.length = 0; }
    expect(Math.hypot(e.x - s.player.x, e.z - s.player.z)).toBeLessThan(10);
  });
});
