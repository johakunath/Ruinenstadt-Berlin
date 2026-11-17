import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { generateLots, mapLevel } from '../data/map';
import { DIFFICULTIES, difficultyOf } from '../data/difficulty';
import { createSim, stepSim } from './sim';
import { parseSave, simFromSave, snapshot, SAVE_VERSION } from './save';
import { NO_INPUT, type Sim, type SimEvent } from './types';

const map = koepenickMap(1);
const level = mapLevel(map, generateLots(map));

function runUntilCheckpoint(sim: Sim): SimEvent[] {
  const enc = sim.level.encounters[sim.run.index]!;
  sim.player.x = sim.player.px = enc.x;
  sim.player.z = sim.player.pz = enc.z;
  sim.player.invuln = 1e9;
  const log: SimEvent[] = [];
  for (let i = 0; i < 60 * 120; i++) {
    stepSim(sim, NO_INPUT);
    for (const e of sim.enemies) if (e.state !== 'dead' && e.stateT > 0.3) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
    log.push(...sim.events);
    sim.events.length = 0;
    if (log.some((e) => e.type === 'checkpoint')) return log;
  }
  throw new Error('no checkpoint');
}

describe('difficulty', () => {
  it('Normal is the tuned baseline', () => {
    const n = difficultyOf('normal');
    expect([n.hp, n.dmg, n.luck, n.scrap]).toEqual([1, 1, 0, 1]);
    expect(DIFFICULTIES.map((d) => d.id)).toEqual(['leicht', 'normal', 'schwer']);
  });
  it('scales spawned enemy life and damage', () => {
    const hp = (id: 'leicht' | 'normal' | 'schwer'): number => {
      const sim = createSim({ level, difficulty: id, seed: 3 });
      const enc = sim.level.encounters[0]!;
      sim.player.x = enc.x; sim.player.z = enc.z;
      for (let i = 0; i < 120; i++) stepSim(sim, NO_INPUT);
      const e = sim.enemies.find((x) => x.sleep === undefined)!; // a wave enemy, not a side passage guard
      return e.maxHp / (e.def.hp * 1);
    };
    expect(hp('leicht')).toBeLessThan(hp('normal'));
    expect(hp('schwer')).toBeGreaterThan(hp('normal'));
  });
});

describe('save', () => {
  it('wave checkpoint: a reload resumes at the next wave with the same state', () => {
    const sim = createSim({ level, seed: 5, difficulty: 'schwer' });
    const log = runUntilCheckpoint(sim);
    expect(log.some((e) => e.type === 'checkpoint')).toBe(true);
    sim.inventory.scrap += 7;
    const snap = snapshot(sim, 'Köpenick', true);
    expect(snap.run).not.toBeNull();
    const loaded = parseSave(JSON.stringify(snap))!;
    expect(loaded).toEqual(JSON.parse(JSON.stringify(snap)));
    const back = simFromSave(loaded, { level }, true);
    expect(back.difficulty).toBe('schwer');
    expect(back.run.index).toBe(sim.run.index);
    expect(back.run.phase).toBe(sim.run.phase);
    expect(back.run.wave).toBe(sim.run.wave);
    expect(back.inventory.scrap).toBe(sim.inventory.scrap);
    expect(back.player.hp).toBeCloseTo(sim.player.hp);
    expect(back.lootWaves).toBe(sim.lootWaves);
    expect(back.drops.length).toBe(sim.drops.length);
    expect(back.rng.next()).toBe(sim.rng.next());
    // The resumed wave actually starts.
    for (let i = 0; i < 60 * 5; i++) stepSim(back, NO_INPUT);
    expect(back.enemies.length).toBeGreaterThan(0);
  });
  it('resume after an encounter keeps the hero between fights', () => {
    const sim = createSim({ level, seed: 5 });
    sim.run.index = 1; sim.run.phase = 'travel';
    const back = simFromSave(snapshot(sim, 'Köpenick', true), { level }, true);
    expect(back.run.index).toBe(1);
    expect(back.run.phase).toBe('travel');
  });
  it('broken props stay broken', () => {
    const sim = createSim({ level, seed: 5 });
    const b = sim.breakables[0]!;
    b.broken = true;
    const back = simFromSave(snapshot(sim, 'Köpenick', true), { level }, true);
    expect(back.breakables[0]!.broken).toBe(true);
  });
  it('profile only: no run during a fight, run null', () => {
    const sim = createSim({ level, seed: 5 });
    sim.run.phase = 'fight';
    expect(snapshot(sim, 'Köpenick', true).run).toBeNull();
    const back = simFromSave(snapshot(sim, 'Köpenick', false), { level }, true);
    expect(back.run.index).toBe(0);
  });
  it('rejects unknown, newer or damaged saves', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('{')).toBeNull();
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION + 1 }))).toBeNull();
    const ok = snapshot(createSim({ level }), 'Köpenick', false);
    expect(parseSave(JSON.stringify({ ...ok, difficulty: 'x' }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...ok, profile: { ...ok.profile, inventory: 3 } }))).toBeNull();
    expect(parseSave(JSON.stringify(ok))).not.toBeNull();
  });
});
