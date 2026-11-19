import { describe, it, expect } from 'vitest';
import { mitteMap } from '../data/mitte';
import { charlottenburgMap } from '../data/charlottenburg';
import { ENEMIES, THREAT } from '../data/enemies';
import { mapLevel } from '../data/map';
import { chain, hurtPlayer, killEnemy, STATUS, strike } from './combat';
import { spawnEnemy } from './enemies';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Sim, type SimEvent } from './types';

/** Open courtyard; every hit procs the one element given. */
function fresh(wet: boolean, el: 'fire' | 'shock'): Sim {
  const s = createSim({ empty: true });
  s.wet = wet;
  s.stats.crit = 0;
  s.stats.elements = [el];
  s.stats.elementChance = 1;
  return s;
}

describe('rain rule (M12c, 2D D.wet)', () => {
  it('fire burns 1.4 s in the rain instead of 2', () => {
    for (const wet of [false, true]) {
      const s = fresh(wet, 'fire');
      const e = spawnEnemy(s, s.player.x, s.player.z + 2, 'walker');
      e.hp = e.maxHp = 1e4;
      strike(s, e, 10);
      expect(e.burn, String(wet)).toBeCloseTo(wet ? STATUS.wetBurnTime : STATUS.burnTime);
    }
  });

  it('a shock chain reaches 6.3 m instead of 4.7 m and jumps once more', () => {
    const bolts = (wet: boolean, far: number): number => {
      const s = fresh(wet, 'shock');
      const src = spawnEnemy(s, s.player.x, s.player.z + 2, 'walker');
      for (let i = 0; i < 4; i++) spawnEnemy(s, src.x + Math.sin(i * 1.6) * 2, src.z + Math.cos(i * 1.6) * 2, 'walker').hp = 1e4;
      spawnEnemy(s, src.x + far, src.z, 'walker').hp = 1e4;
      s.events.length = 0;
      chain(s, src, 5, 2);
      return s.events.filter((q) => q.type === 'bolt').length;
    };
    expect(bolts(false, 9)).toBe(2);
    expect(bolts(true, 9)).toBe(3);
    // Reach: one body alone at 5.5 m.
    const reach = (wet: boolean): number => {
      const s = fresh(wet, 'shock');
      const src = spawnEnemy(s, s.player.x, s.player.z + 2, 'walker');
      spawnEnemy(s, src.x + 5.5, src.z, 'walker').hp = 1e4;
      s.events.length = 0;
      chain(s, src, 5, 2);
      return s.events.filter((q) => q.type === 'bolt').length;
    };
    expect(reach(false)).toBe(0);
    expect(reach(true)).toBe(1);
    expect(STATUS.wetChainRange).toBeCloseTo(190 / 30);
  });

  it('Mitte is wet from the map; the courtyard is dry', () => {
    expect(createSim({ empty: true }).wet).toBe(false);
    expect(createSim({ empty: true, level: mapLevel(mitteMap(), [], []) }).wet).toBe(true);
  });
});

describe('debug god mode', () => {
  it('?god keeps the hero unhurt', () => {
    const s = createSim({ empty: true });
    s.god = true;
    const hp = s.player.hp;
    expect(hurtPlayer(s, null, 50, 1, 0)).toBe(false);
    expect(s.player.hp).toBe(hp);
    s.god = false;
    expect(hurtPlayer(s, null, 50, 1, 0)).toBe(true);
  });
});

describe('Glas splittert (M16, MapDef.shards)', () => {
  /** Open ground with the rule on; the hero cannot die and nothing walks. */
  function glass(on = true): Sim {
    const s = createSim({ empty: true });
    s.shards = on;
    s.stats.types = [];
    return s;
  }
  const steps = (s: Sim, seconds: number): SimEvent[] => {
    const out: SimEvent[] = [];
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      s.hitstop = 0;
      for (const e of s.enemies) e.def = { ...e.def, speed: 0 };
      stepSim(s, NO_INPUT);
      out.push(...s.events);
      s.events.length = 0;
    }
    return out;
  };
  const S = THREAT.shards;

  it('a dead dancer bursts after 0.5 s: it hits the hero and every enemy inside once', () => {
    const s = glass();
    const d = spawnEnemy(s, s.player.x, s.player.z + 0.9, 'scherbe');
    const w = spawnEnemy(s, s.player.x + 0.9, s.player.z + 0.9, 'walker');
    w.cd = [99, 99, 99];
    const far = spawnEnemy(s, s.player.x + 6, s.player.z, 'walker');
    killEnemy(s, d);
    expect(s.threats.zones).toHaveLength(1);
    expect(s.threats.zones[0]!.r).toBe(S.radius);
    const hp = s.player.hp, wh = w.hp, fh = far.hp;
    expect(steps(s, S.wind - 0.05).some((q) => q.type === 'playerHit')).toBe(false);
    const evs = steps(s, 0.6);
    const hits = evs.filter((q) => q.type === 'playerHit');
    expect(hits).toHaveLength(1);
    expect(hp - s.player.hp).toBeCloseTo(ENEMIES.scherbe.damage * S.hit * (1 - s.stats.res), 0);
    expect(wh - w.hp).toBe(Math.round(ENEMIES.scherbe.hp * S.life));
    expect(far.hp).toBe(fh);
    expect(s.threats.zones).toHaveLength(0);
  });

  it('a chain of three dancers bursts in order, one link every 0.5 s, and ends', () => {
    const s = glass();
    s.player.x += 20;
    const a = spawnEnemy(s, 0, 0, 'scherbe'), b = spawnEnemy(s, 1.4, 0, 'scherbe'), c = spawnEnemy(s, 2.8, 0, 'scherbe');
    b.hp = c.hp = 3;
    const order: number[] = [];
    killEnemy(s, a);
    for (let i = 0; i < 60 * 3; i++) {
      steps(s, 1 / 60);
      for (const e of [b, c]) if (e.state === 'dead' && !order.includes(e.id)) order.push(e.id);
    }
    expect(order).toEqual([b.id, c.id]);
    expect(s.threats.zones).toHaveLength(0);
    expect(s.kills).toBe(3);
  });

  it('a boss takes at most 2 % of its life per burst; walkers do not burst; no burst on other maps', () => {
    const s = glass();
    s.player.x += 20;
    const big = spawnEnemy(s, -0.8, 0, 'conferencier');
    big.cd = [99, 99, 99];
    // A strong dancer (wave life ×10): her shards would take 80, the boss loses 2 % of his 1000.
    const d = spawnEnemy(s, 0, 0, 'scherbe', 10);
    const h1 = big.hp;
    killEnemy(s, d);
    steps(s, S.wind + 0.05);
    expect(ENEMIES.scherbe.hp * 10 * S.life).toBeGreaterThan(big.maxHp * S.bossCap);
    expect(h1 - big.hp).toBe(Math.round(big.maxHp * S.bossCap));
    const w = glass();
    killEnemy(w, spawnEnemy(w, 0, 0, 'walker'));
    expect(w.threats.zones).toHaveLength(0);
    const off = glass(false);
    killEnemy(off, spawnEnemy(off, 0, 0, 'scherbe'));
    expect(off.threats.zones).toHaveLength(0);
  });

  it('Charlottenburg turns the rule on from the map; the courtyard and Mitte keep it off', () => {
    expect(createSim({ empty: true }).shards).toBe(false);
    expect(createSim({ empty: true, level: mapLevel(mitteMap(), [], []) }).shards).toBe(false);
    const c = createSim({ empty: true, level: mapLevel(charlottenburgMap(), [], []) });
    expect(c.shards).toBe(true);
    expect(c.level.flavor).toBe('revue');
    // The loot sees no flavor for `revue` (no loot table yet).
    expect(c.lootCtx.flavor).toBeUndefined();
  }, 30000);
});
