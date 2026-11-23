// M17 Der Zeitwart (gear holds T9, phases, Zeitsprung), the echo modifier (T8) and the ending choice (T10).
import { describe, expect, it } from 'vitest';
import { BOSS, ENEMIES } from '../data/enemies';
import { turmMap } from '../data/fernsehturm';
import { generateLots, generateProps, mapLevel } from '../data/map';
import { strike, TIME_SIGNAL } from './combat';
import { ECHO, makeEcho } from './echo';
import { spawnEnemy } from './enemies';
import { killDrops } from './loot';
import { makeTelespargel } from './items';
import { heroStats } from './stats';
import { createSim, stepSim } from './sim';
import { ENDING } from './turm';
import { NO_INPUT, type Sim, type SimEvent } from './types';
import { phaseAt, zwOf } from './zeitwart';
import { simFromSave, snapshot } from './save';
import { LEGENDARY_ELEMENTS } from '../data/items';

const map = turmMap();
const level = mapLevel(map, generateLots(map), generateProps(map, []));
const Z = BOSS.zeitwart;
const BOSS_AT = { x: 480, z: 10 };

/** A sim in the Uhrenraum fight with the Zeitwart standing south of the movement and the hero safe. */
function setup(): { sim: Sim; boss: ReturnType<typeof spawnEnemy> } {
  const sim = createSim({ level, empty: true, startAt: 4 });
  sim.run.phase = 'fight';
  sim.run.toSpawn = 0;
  sim.run.bossesToSpawn = [];
  sim.run.spawnT = 1e9;
  sim.god = true;
  const boss = spawnEnemy(sim, BOSS_AT.x, BOSS_AT.z, 'zeitwart');
  boss.enc = sim.run.index;
  return { sim, boss };
}
const put = (sim: Sim, x: number, z: number): void => { sim.player.x = sim.player.px = x; sim.player.z = sim.player.pz = z; };
const run = (sim: Sim, seconds: number, each?: () => void): SimEvent[] => {
  const log: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(); stepSim(sim, NO_INPUT); log.push(...sim.events); sim.events.length = 0; }
  return log;
};

describe('Der Zeitwart', () => {
  it('is a boss of the Uhrenraum with the robot resistances', () => {
    const d = ENEMIES.zeitwart;
    expect(d.boss).toBe(true);
    expect(d.ai).toBe('zeitwart');
    expect(d.res).toBe('volk');
    expect(map.encounters.at(-1)!.waves[0]!.bosses).toEqual(['zeitwart']);
  });

  it('phases follow life: 0 above 66 %, 1 down to 33 %, 2 below', () => {
    const { boss } = setup();
    expect(phaseAt(boss)).toBe(0);
    boss.hp = boss.maxHp * 0.6;
    expect(phaseAt(boss)).toBe(1);
    boss.hp = boss.maxHp * 0.3;
    expect(phaseAt(boss)).toBe(2);
  });

  it('at 66 % he stands in the movement, untouchable, until the hero holds a gear seat; then he is stunned and open', () => {
    const { sim, boss } = setup();
    const seat = level.seats[3]!;
    put(sim, seat.x, seat.z);
    boss.hp = Math.floor(boss.maxHp * 0.65);
    const start = run(sim, 0.1);
    const zw = zwOf(boss);
    expect(start.some((e) => e.type === 'gearHold')).toBe(true);
    expect(zw.hold).not.toBeNull();
    expect(zw.hold!.seat).toEqual(seat);
    const hp = boss.hp;
    expect(strike(sim, boss, 500)).toBe(0);
    expect(boss.hp).toBe(hp);
    // Outside the ring nothing charges.
    const p0 = zw.hold!.p;
    run(sim, 2, () => put(sim, seat.x + 9, seat.z));
    expect(zw.hold!.p).toBe(p0);
    // Inside: the gear goes in after `need` seconds, adds came meanwhile.
    const n0 = sim.enemies.filter((e) => e !== boss && e.state !== 'dead').length;
    const log = run(sim, Z.hold.need + 0.2, () => put(sim, seat.x, seat.z));
    expect(log.some((e) => e.type === 'gear')).toBe(true);
    expect(zw.hold).toBeNull();
    expect(zw.phase).toBe(1);
    expect(sim.enemies.filter((e) => e !== boss && e.state !== 'dead').length).toBeGreaterThan(n0);
    expect(boss.state).toBe('stagger');
    expect(boss.open).toBeGreaterThan(0);
    expect(strike(sim, boss, 10)).toBeGreaterThan(0);
  });

  it('the second gear starts phase 3: the clock hands turn faster from then on', () => {
    const { sim, boss } = setup();
    const zw = zwOf(boss);
    zw.phase = 1;
    boss.hp = Math.floor(boss.maxHp * 0.3);
    const seat = level.seats[0]!;
    run(sim, Z.hold.need + 0.5, () => put(sim, seat.x, seat.z));
    expect(zw.phase).toBe(2);
    expect(sim.handBoost?.k).toBe(Z.handBoost);
  });

  it('the Zeitsprung marks a spot, lands there and sends a shock ring, three times', () => {
    const { sim, boss } = setup();
    const zw = zwOf(boss);
    zw.phase = 2;
    boss.hp = Math.floor(boss.maxHp * 0.3);
    boss.cd = [9, 0, 9];
    put(sim, 470, 8);
    const log = run(sim, 6, () => put(sim, 470, 8));
    const marks = log.filter((e) => e.type === 'blink' && e.phase === 'mark'), lands = log.filter((e) => e.type === 'blink' && e.phase === 'go');
    expect(marks.length).toBeGreaterThanOrEqual(Z.blinks);
    expect(lands.length).toBeGreaterThanOrEqual(Z.blinks);
    const first = lands[0] as { x: number; z: number };
    expect(Math.hypot(first.x - (marks[0] as { x: number }).x, first.z - (marks[0] as { z: number }).z)).toBeLessThan(1e-6);
    expect(log.some((e) => e.type === 'enemySpecial' && e.kind === 'bass')).toBe(true);
  });

  it('each blink lands with its mark: the landing hit and the boss arrive together (Codex review)', () => {
    const { sim, boss } = setup();
    const zw = zwOf(boss);
    zw.phase = 2;
    boss.hp = Math.floor(boss.maxHp * 0.3);
    boss.cd = [9, 0, 9];
    put(sim, 470, 8);
    const at: Array<{ t: number; ev: SimEvent }> = [];
    for (let i = 0; i < 6 * 60; i++) { put(sim, 470, 8); stepSim(sim, NO_INPUT); for (const ev of sim.events) at.push({ t: sim.time, ev }); sim.events.length = 0; }
    const marks = at.filter((a) => a.ev.type === 'blink' && a.ev.phase === 'mark'), lands = at.filter((a) => a.ev.type === 'blink' && a.ev.phase === 'go');
    expect(lands.length).toBeGreaterThanOrEqual(Z.blinks);
    for (let k = 0; k < Z.blinks; k++) {
      expect(lands[k]!.t - marks[k]!.t).toBeCloseTo(Z.blinkWarn, 1);
      const m = marks[k]!.ev as { x: number; z: number }, l = lands[k]!.ev as { x: number; z: number };
      expect(Math.hypot(l.x - m.x, l.z - m.z)).toBeLessThan(1e-6);
    }
  });

  it('calls the adds of his phase', () => {
    const { sim, boss } = setup();
    put(sim, 470, 8);
    boss.cd = [9, 9, 0];
    run(sim, 2, () => put(sim, 470, 8));
    const kinds = new Set(sim.enemies.filter((e) => e !== boss).map((e) => e.kind));
    expect([...kinds].some((k) => k === 'raptor' || k === 'scherbe')).toBe(true);
  });
});

describe('echo bosses (T8)', () => {
  it('less life and damage, the echo name, the kind kept', () => {
    const sim = createSim({ level, empty: true });
    const e = spawnEnemy(sim, 0, 10, 'hauptmann', 2, 1.5);
    const hp = e.maxHp;
    makeEcho(e);
    expect(e.maxHp).toBe(Math.round(hp * ECHO.hp));
    expect(e.hp).toBe(e.maxHp);
    expect(e.dmgMul).toBeCloseTo(1.5 * ECHO.dmg);
    expect(e.def.name).toBe(`Echo: ${ENEMIES.hauptmann.name}`);
    expect(e.kind).toBe('hauptmann');
  });

  it('the director brings the tower bosses of fights 2 to 4 as echoes', () => {
    expect(map.encounters.slice(1, 4).map((e) => e.waves.at(-1)!.echo)).toEqual([true, true, true]);
    expect(map.encounters[4]!.waves[0]!.echo).toBeUndefined();
  });

  it('an echo drops no items, only the heal', () => {
    const sim = createSim({ level, empty: true });
    const e = spawnEnemy(sim, 2, 12, 'spreehexe');
    makeEcho(e);
    killDrops(sim, e);
    expect(sim.drops.some((d) => d.content.kind === 'item')).toBe(false);
    expect(sim.drops.some((d) => d.content.kind === 'heal')).toBe(true);
  });
});

describe('the ending choice (T10)', () => {
  /** A sim after the last fight, at the choice. */
  const atChoice = (): Sim => {
    const sim = createSim({ level, empty: true, startAt: level.encounters.length });
    expect(sim.run.phase).toBe('choice');
    return sim;
  };

  it('standing in a ring for the hold time decides, saves the flag and wins', () => {
    for (const ring of level.ending) {
      const sim = atChoice();
      const log = run(sim, ENDING.hold + 0.1, () => put(sim, ring.x, ring.z));
      expect(log.find((e) => e.type === 'ending')).toEqual({ type: 'ending', choice: ring.id });
      expect(log.at(-1)?.type).toBe('victory');
      expect(sim.inventory.camp?.ending).toBe(ring.id);
      expect(sim.run.phase).toBe('won');
    }
  });

  it('winning the last fight opens the choice with a checkpoint; a save there resumes at it (Codex review)', () => {
    const { sim, boss } = setup();
    const enc = level.encounters[sim.run.index]!;
    sim.run.wave = enc.waves.length - 1;
    sim.god = false;
    strike(sim, boss, 1e12);
    const log = run(sim, 4);
    expect(sim.run.phase).toBe('choice');
    expect(log.some((e) => e.type === 'choiceOpen')).toBe(true);
    expect(log.some((e) => e.type === 'checkpoint')).toBe(true);
    const save = snapshot(sim, map.name, true);
    expect(save.run).toBeTruthy();
    expect(simFromSave(save, { level }, true).run.phase).toBe('choice');
  });

  it('leaving the ring resets the wait; nothing is chosen outside both', () => {
    const sim = atChoice();
    const ring = level.ending[1]!;
    run(sim, ENDING.hold * 0.6, () => put(sim, ring.x, ring.z));
    run(sim, 0.1, () => put(sim, ring.x, ring.z + 4));
    const log = run(sim, ENDING.hold * 0.6, () => put(sim, ring.x, ring.z));
    expect(log.some((e) => e.type === 'ending')).toBe(false);
    expect(sim.run.phase).toBe('choice');
  });

  it('the rings stand free at the main switch', () => {
    for (const q of level.ending) {
      expect(level.blocked(q.x, q.z, 0.38)).toBe(false);
      expect(Math.hypot(q.x - map.turm!.mainSwitch.x, q.z - map.turm!.mainSwitch.z)).toBeLessThan(4);
    }
  });
});

describe('Telespargel (M17 legendary spear)', () => {
  it('Der Zeitwart drops it for certain the first time: a legendary spear with its own base', () => {
    const sim = createSim({ level, empty: true, startAt: 4 });
    const e = spawnEnemy(sim, 480, 10, 'zeitwart');
    killDrops(sim, e);
    const item = sim.drops.map((d) => d.content).find((c) => c.kind === 'item' && c.item.base === 'telespargel');
    expect(item).toBeDefined();
    const it = (item as { item: { kind: string; rarity: number; name: string; slot: string } }).item;
    expect([it.kind, it.rarity, it.name, it.slot]).toEqual(['spear', 3, 'Telespargel', 'w']);
  });

  it('is always shock, whatever legendary it was rolled as (Codex review)', () => {
    const sim = createSim({ level, empty: true });
    for (let i = 0; i < 40; i++) expect(makeTelespargel(sim.rng, sim.lootCtx, 30).element).toBe(LEGENDARY_ELEMENTS.telespargel);
  });

  it('Zeitzeichen: every twelfth hit stops every enemy within 5 m', () => {
    const sim = createSim({ level, empty: true });
    const spear = makeTelespargel(sim.rng, sim.lootCtx, 30);
    sim.equipment.w = spear;
    sim.stats = heroStats(sim.equipment, sim.statContext);
    expect(sim.stats.legendary).toContain('telespargel');
    const near = spawnEnemy(sim, sim.player.x + 2, sim.player.z, 'brute');
    const far = spawnEnemy(sim, sim.player.x + TIME_SIGNAL.radius + 3, sim.player.z, 'brute');
    near.hp = near.maxHp = far.hp = far.maxHp = 1e6;
    for (let i = 0; i < TIME_SIGNAL.every - 1; i++) strike(sim, near, 1);
    expect(near.state).not.toBe('stagger');
    strike(sim, near, 1);
    expect(near.state).toBe('stagger');
    expect(near.staggerDur).toBeCloseTo(TIME_SIGNAL.stop);
    expect(far.state).not.toBe('stagger');
  });
});
