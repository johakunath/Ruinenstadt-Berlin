// WP4 step 5: every legendary power with a proc flash reports `legendaryProc` at its rule site, exactly when the
// power fires and nowhere else. The rules themselves are tested in legendary.test.ts (unchanged by step 5).
import { describe, expect, it } from 'vitest';
import { LEGENDARY_PROC_SITES } from '../data/gear-fx';
import type { LegendaryId, WeaponKindId } from '../data/items';
import { hurtPlayer, strike } from './combat';
import { spawnEnemy } from './enemies';
import { setLoadout } from './loadout';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Enemy, type Sim, type SimEvent } from './types';

function fresh(id: LegendaryId, kind: WeaponKindId = 'blade'): Sim {
  const s = createSim({ empty: true });
  const w = { ...s.equipment.w!, kind };
  setLoadout(s, { w, t: { id: 9, slot: 't', kind: 'krit', base: id, name: id, rarity: 3, value: 0, itemLevel: 1, affixes: [] } });
  s.player.facing = 0;
  s.stats.crit = 0;
  return s;
}
function dummy(s: Sim, dx: number, dz: number, hp = 100000): Enemy {
  const e = spawnEnemy(s, s.player.x + dx, s.player.z + dz, 'walker');
  e.hp = e.maxHp = hp;
  e.def = { ...e.def, speed: 0, attackRange: 0, knockbackTaken: 0, res: 'none', ai: 'melee', classes: [] };
  return e;
}
type Proc = Extract<SimEvent, { type: 'legendaryProc' }>;
/** Proc events now in `s.events` (strike and hurtPlayer push them directly). */
const procs = (s: Sim): Proc[] => s.events.filter((e): e is Proc => e.type === 'legendaryProc');
/** Steps and collects the proc events of every step (the game drains the list after each step). */
function run(s: Sim, steps: number, inp: Partial<typeof NO_INPUT> = {}): Proc[] {
  const out: Proc[] = [];
  for (let i = 0; i < steps; i++) { s.hitstop = 0; s.events.length = 0; stepSim(s, { ...NO_INPUT, ...inp }); out.push(...procs(s)); }
  return out;
}
const tested: LegendaryId[] = [];
const site = (id: LegendaryId, name: string, fn: () => void): void => { tested.push(id); it(`${id}: ${name}`, fn); };

describe('legendaryProc sites (step 5 proc flash)', () => {
  site('turm', 'a crit, at the enemy hit', () => {
    const s = fresh('turm'), e = dummy(s, 0, 2);
    strike(s, e, 100);
    expect(procs(s)).toHaveLength(0);
    strike(s, e, 100, { crit: true });
    expect(procs(s)).toEqual([{ type: 'legendaryProc', id: 'turm', x: e.x, z: e.z }]);
  });
  site('zitklinge', 'a kill, not a hit', () => {
    const s = fresh('zitklinge'), e = dummy(s, 0, 2, 20);
    strike(s, e, 5);
    expect(procs(s)).toHaveLength(0);
    strike(s, e, 50);
    expect(procs(s)).toEqual([{ type: 'legendaryProc', id: 'zitklinge', x: e.x, z: e.z }]);
  });
  site('mauer', 'every fourth melee attack, at the hero', () => {
    const s = fresh('mauer'), all: Proc[] = [];
    for (let i = 0; i < 4; i++) { s.player.state = 'move'; s.player.chain = null; all.push(...run(s, 1, { attack: true }), ...run(s, 30)); if (i === 2) expect(all).toHaveLength(0); }
    expect(all.map((p) => p.id)).toEqual(['mauer']);
  });
  site('pbrecher', 'a crit kill, not a plain kill', () => {
    const s = fresh('pbrecher');
    strike(s, dummy(s, 0, 3, 1), 5);
    expect(procs(s)).toHaveLength(0);
    const e = dummy(s, 0, 3, 1);
    strike(s, e, 5, { crit: true });
    expect(procs(s)).toEqual([{ type: 'legendaryProc', id: 'pbrecher', x: e.x, z: e.z }]);
  });
  site('siegsp', 'every attack (the golden blade)', () => {
    const s = fresh('siegsp');
    expect(run(s, 1, { attack: true }).length + run(s, 40).length).toBe(1);
  });
  site('panzer', 'exactly the blocked hits', () => {
    const s = fresh('panzer');
    let blocked = 0, flashes = 0;
    for (let i = 0; i < 200; i++) {
      s.events.length = 0; s.player.hp = 100; s.player.invuln = 0;
      if (!hurtPlayer(s, null, 5, 1, 0)) blocked++;
      flashes += procs(s).length;
    }
    expect(blocked).toBeGreaterThan(10);
    expect(flashes).toBe(blocked);
  });
  site('rattenmantel', 'a hit taken, at most every 1.5 s', () => {
    const s = fresh('rattenmantel');
    hurtPlayer(s, null, 5, 1, 0);
    s.player.invuln = 0;
    hurtPlayer(s, null, 5, 1, 0);
    expect(procs(s).map((p) => p.id)).toEqual(['rattenmantel']);
  });
  site('ritter', 'where a dodge ends', () => {
    const s = fresh('ritter'), z0 = s.player.z;
    const out = [...run(s, 1, { dodge: true, moveZ: 1 }), ...run(s, 30)];
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('ritter');
    // At the end of the roll, not where it started (the hero slides on a little after).
    expect(out[0]!.z - z0).toBeGreaterThan(1);
    expect(Math.hypot(out[0]!.x - s.player.x, out[0]!.z - s.player.z)).toBeLessThan(1);
  });
  site('kiezbox', 'every fourth hit, at the stunned enemy', () => {
    const s = fresh('kiezbox'), e = dummy(s, 0, 2);
    for (let i = 0; i < 3; i++) strike(s, e, 10, { feel: 'none' });
    expect(procs(s)).toHaveLength(0);
    strike(s, e, 10, { feel: 'none' });
    expect(procs(s)).toEqual([{ type: 'legendaryProc', id: 'kiezbox', x: e.x, z: e.z }]);
  });
  site('bassarm', 'every fifth hit', () => {
    const s = fresh('bassarm'), e = dummy(s, 0, 2);
    for (let i = 0; i < 4; i++) strike(s, e, 100);
    expect(procs(s)).toHaveLength(0);
    strike(s, e, 100);
    expect(procs(s).map((p) => p.id)).toEqual(['bassarm']);
  });

  it('covers every site in LEGENDARY_PROC_SITES; without the legendary nothing fires', () => {
    expect(new Set(tested)).toEqual(new Set(LEGENDARY_PROC_SITES));
    const s = createSim({ empty: true });
    const e = dummy(s, 0, 2, 1);
    for (let i = 0; i < 6; i++) strike(s, e, 100, { crit: true });
    hurtPlayer(s, null, 5, 1, 0);
    expect(procs(s)).toHaveLength(0);
  });
});
