import { describe, it, expect } from 'vitest';
import { BOSS, ENEMIES, THREAT, type EnemyKind } from '../data/enemies';
import { waveTier } from '../data/koepenick';
import { strike } from './combat';
import { makeElite, spawnEnemy } from './enemies';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Enemy, type Sim, type SimEvent } from './types';

/** Open ground, no spawner. The courtyard has props; the hero stands clear of them. */
function fresh(): Sim {
  const s = createSim({ empty: true });
  s.stats.crit = 0;
  return s;
}
const put = (s: Sim, kind: EnemyKind, dx: number, dz: number): Enemy => spawnEnemy(s, s.player.x + dx, s.player.z + dz, kind);
/** Steps and collects every event. The hero never dies in these tests unless asked. */
function run(s: Sim, seconds: number, inp: Partial<typeof NO_INPUT> = {}, immortal = true): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.hitstop = 0;
    stepSim(s, { ...NO_INPUT, ...inp });
    if (immortal && s.player.hp < 50) s.player.hp = s.stats.maxHp;
    out.push(...s.events);
    s.events.length = 0;
  }
  return out;
}
const has = (evs: SimEvent[], type: SimEvent['type']): boolean => evs.some((e) => e.type === type);
const specials = (evs: SimEvent[]): string[] => evs.filter((e) => e.type === 'enemySpecial' && e.phase === 'wind').map((e) => (e as { kind: string }).kind);

describe('roster (M12)', () => {
  it('every kind has a body, a brain and a resistance row', () => {
    for (const d of Object.values(ENEMIES)) {
      expect(d.body && d.ai && d.res).toBeTruthy();
      expect(d.hp).toBeGreaterThan(0);
    }
  });

  it('the Speier keeps its distance and spits; a roll passes through the shot', () => {
    const s = fresh();
    const e = put(s, 'spitter', 0, 3);
    const d0 = Math.hypot(e.x - s.player.x, e.z - s.player.z);
    const evs = run(s, 5);
    expect(Math.hypot(e.x - s.player.x, e.z - s.player.z)).toBeGreaterThan(d0);
    expect(has(evs, 'enemyShot')).toBe(true);
    expect(has(evs, 'playerHit')).toBe(true);
    // Invulnerable (as in a roll): shots do nothing.
    const s2 = fresh();
    put(s2, 'spitter', 0, 6);
    const out: SimEvent[] = [];
    for (let i = 0; i < 400; i++) { s2.player.invuln = 1; stepSim(s2, NO_INPUT); out.push(...s2.events); s2.events.length = 0; }
    expect(has(out, 'enemyShot')).toBe(true);
    expect(has(out, 'playerHit')).toBe(false);
  });

  it('the Raptor pounces along a locked line, hits once, then stands open and takes more', () => {
    const s = fresh();
    const e = put(s, 'raptor', 0, 5);
    e.cd[1] = 0;
    stepSim(s, NO_INPUT);
    expect(e.state).toBe('special');
    expect(e.sp?.kind).toBe('pounce');
    const evs = run(s, THREAT.pounce.wind + THREAT.pounce.time + 0.1);
    expect(evs.filter((q) => q.type === 'playerHit').length).toBe(1);
    expect(e.open).toBeGreaterThan(0);
    const open = strike(s, e, 10);
    e.open = 0;
    expect(open / strike(s, e, 10)).toBeCloseTo(THREAT.openBonus, 1);
  });

  it('a sidestep during the wind-up makes the pounce miss', () => {
    const s = fresh();
    const e = put(s, 'raptor', 0, 5);
    e.cd[1] = 0;
    stepSim(s, NO_INPUT);
    s.player.x += 3;
    const evs = run(s, THREAT.pounce.wind + THREAT.pounce.time + 0.1);
    expect(has(evs, 'playerHit')).toBe(false);
  });

  it('the Krähe circles, dives and then sits dazed; walls do not hold it', () => {
    const s = fresh();
    const e = put(s, 'crow', 4, 0);
    e.cd[1] = 0.5;
    const evs = run(s, 2.2);
    expect(specials(evs)).toContain('dive');
    expect(e.rest > 0 || e.state === 'special').toBe(true);
    expect(e.def.fly).toBe(true);
  });

  it('the Brocken marks a circle on the hero: standing in it hurts at least the floor, leaving it does not', () => {
    const s = fresh();
    const e = put(s, 'brute', 0, 5);
    e.def = { ...e.def, speed: 0 };
    e.cd[0] = 0;
    stepSim(s, NO_INPUT);
    expect(s.threats.zones.length).toBe(1);
    const hp = s.player.hp;
    const evs = run(s, THREAT.slam.wind + 0.1, {}, false);
    expect(evs.some((q) => q.type === 'zoneHit' && q.hit)).toBe(true);
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(s.stats.maxHp * THREAT.slam.floor - 1);
    run(s, 0.4);
    expect(e.open).toBeGreaterThan(0);
    // Second try: walk out.
    const s2 = fresh();
    const b = put(s2, 'brute', 0, 5);
    b.def = { ...b.def, speed: 0 };
    b.cd[0] = 0;
    stepSim(s2, NO_INPUT);
    const evs2 = run(s2, THREAT.slam.wind + 0.1, { moveX: 1 });
    expect(evs2.some((q) => q.type === 'zoneHit' && !q.hit)).toBe(true);
    expect(has(evs2, 'playerHit')).toBe(false);
  });

  it('a hit interrupts a wind-up of a body without poise, not a rush in flight', () => {
    const s = fresh();
    const e = put(s, 'spitter', 0, 6);
    e.cd[1] = 0;
    stepSim(s, NO_INPUT);
    expect(e.state).toBe('special');
    strike(s, e, 1, { knock: 5 });
    expect(e.state).toBe('stagger');
    expect(e.sp).toBeNull();
    const r = put(s, 'raptor', 6, 0);
    r.cd[1] = 0;
    s.hitstop = 0;
    stepSim(s, NO_INPUT);
    r.stateT = THREAT.pounce.wind + 0.05;
    strike(s, r, 1, { knock: 5 });
    expect(r.state).toBe('special');
  });
});

describe('resistances (2D RES)', () => {
  it('fire burns the Schlurfer harder, acid does nothing to the Speier', () => {
    const s = fresh();
    const w = put(s, 'walker', 0, 2), sp = put(s, 'spitter', 2, 0);
    w.hp = w.maxHp = sp.hp = sp.maxHp = 1e6;
    expect(strike(s, w, 100, { element: 'fire', noproc: true }) / strike(s, w, 100, { noproc: true })).toBeCloseTo(1.6);
    expect(strike(s, sp, 100, { element: 'acid', noproc: true })).toBe(0);
    expect(strike(s, sp, 100, { element: 'shock', noproc: true })).toBe(160);
    // An acid ring (Rattenmantel) leaves no acid on the immune Speier.
    s.abilities.shocks.push({ x: sp.x, z: sp.z, r: 0.1, max: 3, hits: [], mul: 1, stun: 0, knock: 0, acid: true, kind: 'acid' });
    for (let i = 0; i < 30; i++) { s.hitstop = 0; stepSim(s, NO_INPUT); }
    expect(sp.acid).toBe(0);
    expect(w.acid).toBeGreaterThan(0);
  });
});

describe('elites (2D modifiers)', () => {
  it('have 2.6 times the life; Gepanzert halves damage until it stands open', () => {
    const s = fresh();
    const e = put(s, 'walker', 0, 3);
    const hp = e.maxHp;
    makeElite(s, e, 'gepanzert');
    expect(e.maxHp).toBe(Math.round(hp * THREAT.eliteHp));
    e.hp = e.maxHp = 1e6;
    expect(strike(s, e, 100)).toBe(50);
    e.open = 1;
    expect(strike(s, e, 100)).toBe(130);
  });

  it('Flink is faster; Spaltend splits into two small bodies without loot', () => {
    const s = fresh();
    const f = put(s, 'walker', 0, 6);
    makeElite(s, f, 'flink');
    expect(f.def.speed).toBeCloseTo(ENEMIES.walker.speed * THREAT.eliteSpeed);
    const e = put(s, 'walker', 0, 3);
    makeElite(s, e, 'spaltend');
    const before = s.enemies.length;
    strike(s, e, 1e6);
    const minis = s.enemies.filter((q) => q.mini);
    expect(s.enemies.length).toBe(before + THREAT.split.count);
    expect(minis.length).toBe(THREAT.split.count);
    const drops = s.drops.length;
    for (const m of minis) strike(s, m, 1e6);
    expect(s.drops.length).toBe(drops);
  });

  it('each modifier uses its own special', () => {
    const want = { flink: 'lunge', brennend: 'flame', spaltend: 'fan', gepanzert: 'stomp' } as const;
    for (const mod of Object.keys(want) as Array<keyof typeof want>) {
      const s = fresh();
      const e = put(s, 'walker', 0, 3.5);
      makeElite(s, e, mod);
      e.def = { ...e.def, attackRange: 0, speed: 0 };
      e.cd[0] = 0;
      stepSim(s, NO_INPUT);
      expect(e.sp?.kind, mod).toBe(want[mod]);
    }
  });

  it('an interrupted or killed elite does not land its marked attack', () => {
    for (const how of ['stagger', 'kill'] as const) {
      const s = fresh();
      const e = put(s, 'walker', 0, 3.5);
      makeElite(s, e, 'gepanzert');
      e.def = { ...e.def, attackRange: 0, speed: 0 };
      e.cd[0] = 0;
      stepSim(s, NO_INPUT);
      expect(s.threats.zones.length).toBe(1);
      strike(s, e, how === 'kill' ? 1e6 : 1, { knock: 5 });
      expect(e.state).toBe(how === 'kill' ? 'dead' : 'stagger');
      const evs = run(s, THREAT.slam.wind + 0.2, {}, false);
      expect(has(evs, 'playerHit'), how).toBe(false);
      expect(has(evs, 'zoneHit'), how).toBe(false);
    }
  });

  it('an elite raptor uses its modifier special beside the pounce', () => {
    const s = fresh();
    const e = put(s, 'raptor', 0, 3.5);
    makeElite(s, e, 'gepanzert');
    e.cd[0] = 0;
    e.cd[1] = 99;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('stomp');
  });

  it('Brennend leaves fire that hurts the hero standing in it', () => {
    const s = fresh();
    const e = put(s, 'walker', 0, 6);
    makeElite(s, e, 'brennend');
    e.cd[0] = 99;
    const evs = run(s, 4);
    expect(s.threats.hazards.length).toBeGreaterThan(0);
    expect(has(evs, 'playerHit')).toBe(true);
  });

  it('wave tiers bring elites from the fourth wave, never beside a boss', () => {
    expect(waveTier(0).elite).toBe(0);
    expect(waveTier(3).elite).toBeGreaterThan(0);
    expect(waveTier(19).elite).toBeLessThanOrEqual(0.25);
  });
});

describe('zones teach their types (Köpenick mix)', () => {
  it('Bahnhofsviertel: Hetzer, then Speier, then Brocken; Krähen in the Müggelberge; Raptoren in the Spreepark', () => {
    expect(Object.entries(waveTier(0).mix).filter(([, w]) => w > 0).map(([k]) => k)).toEqual(['walker']);
    expect(waveTier(1).mix.runner).toBeGreaterThan(0);
    expect(waveTier(2).mix.spitter).toBe(0);
    expect(waveTier(3).mix.spitter).toBeGreaterThan(0);
    expect(waveTier(3).mix.brute).toBe(0);
    expect(waveTier(4).mix.brute).toBeGreaterThan(0);
    expect(waveTier(5).mix.crow).toBe(0);
    expect(waveTier(6).mix.crow).toBeGreaterThan(0);
    expect(waveTier(12).mix.raptor).toBe(0);
    expect(waveTier(13).mix.raptor).toBeGreaterThan(0);
  });
});

describe('bosses (2D patterns)', () => {
  /** `apart`: every three seconds the boss is set back to 7 m, as if the hero kept its distance. */
  const fight = (kind: EnemyKind, seconds = 40, apart = false): { s: Sim; e: Enemy; evs: SimEvent[] } => {
    const s = fresh();
    const e = put(s, kind, 0, 6);
    e.hp = e.maxHp = 1e6;
    const evs: SimEvent[] = [];
    for (let t = 0; t < seconds; t += 3) {
      if (apart && e.state !== 'special') { e.state = 'chase'; e.x = e.px = s.player.x; e.z = e.pz = s.player.z + 7; }
      evs.push(...run(s, 3));
    }
    return { s, e, evs };
  };

  it('Feldwebel charges and calls walkers', () => {
    const { s, evs } = fight('feldwebel', 40, true);
    expect(specials(evs)).toEqual(expect.arrayContaining(['charge', 'summon']));
    expect(s.enemies.some((q) => q.kind === 'walker')).toBe(true);
  });

  it('Turmwächter throws a barrage, fires a ring and slams', () => {
    const { evs } = fight('waechter');
    expect(specials(evs)).toEqual(expect.arrayContaining(['barrage', 'ring', 'bossSlam']));
    expect(evs.filter((q) => q.type === 'zoneHit').length).toBeGreaterThan(6);
  });

  it('Rex charges, roars rings that a roll passes, and sweeps its tail', () => {
    const evs = [...fight('rex', 30).evs, ...fight('rex', 40, true).evs];
    expect(specials(evs)).toEqual(expect.arrayContaining(['charge', 'roar', 'tail']));
    // A roar ring hurts a standing hero and spares an invulnerable one.
    const s = fresh();
    s.threats.waves.push({ x: s.player.x, z: s.player.z + 3, r: 0.1, max: 10, speed: BOSS.roar.speed, damage: 5, floor: BOSS.roar.floor, width: BOSS.roar.width, hit: false });
    expect(has(run(s, 1, {}, false), 'playerHit')).toBe(true);
    const s2 = fresh();
    s2.threats.waves.push({ x: s2.player.x, z: s2.player.z + 3, r: 0.1, max: 10, speed: BOSS.roar.speed, damage: 5, floor: BOSS.roar.floor, width: BOSS.roar.width, hit: false });
    const out: SimEvent[] = [];
    for (let i = 0; i < 60; i++) { s2.player.invuln = 1; stepSim(s2, NO_INPUT); out.push(...s2.events); s2.events.length = 0; }
    expect(has(out, 'playerHit')).toBe(false);
  });

  it('Hauptmann slams, fires rings and calls his men; adds stay capped', () => {
    const { s, evs } = fight('hauptmann', 60);
    expect(specials(evs)).toEqual(expect.arrayContaining(['bossSlam', 'ring', 'summon']));
    expect(s.enemies.filter((q) => q.state !== 'dead' && !q.def.boss).length).toBeLessThanOrEqual(BOSS.summon.maxAdds);
  });

  it('a boss rages below half life, once, and gets faster', () => {
    const s = fresh();
    const e = put(s, 'feldwebel', 0, 8);
    e.hp = e.maxHp * 0.4;
    const evs = run(s, 0.2);
    expect(evs.filter((q) => q.type === 'bossRage').length).toBe(1);
    expect(e.def.speed).toBeCloseTo(ENEMIES.feldwebel.speed * BOSS.rageSpeed);
    expect(has(run(s, 0.5), 'bossRage')).toBe(false);
  });

  it('no hit takes more than 45 % of max life, floors included', () => {
    const s = fresh();
    s.threats.zones.push({ x: s.player.x, z: s.player.z, r: 3, t: 0.01, max: 1, damage: 9999, floor: 0.9, kind: 'slam', src: 0, free: true });
    run(s, 0.1, {}, false);
    expect(s.player.hp).toBeGreaterThanOrEqual(s.stats.maxHp * 0.55 - 1);
  });
});
