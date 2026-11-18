import { describe, it, expect } from 'vitest';
import { BOSS, ENEMIES, THREAT, type EnemyKind } from '../data/enemies';
import { waveTier } from '../data/koepenick';
import { strike } from './combat';
import { makeElite, spawnEnemy, spawnPack } from './enemies';
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

describe('Xhain roster (M12b)', () => {
  const fight = (kind: EnemyKind, seconds: number, apart = 0): { s: Sim; e: Enemy; evs: SimEvent[] } => {
    const s = fresh();
    const e = put(s, kind, 0, 6);
    e.hp = e.maxHp = 1e6;
    const evs: SimEvent[] = [];
    for (let t = 0; t < seconds; t += 3) {
      if (apart && e.state !== 'special') { e.state = 'chase'; e.x = e.px = s.player.x; e.z = e.pz = s.player.z + apart; }
      evs.push(...run(s, 3));
    }
    return { s, e, evs };
  };
  const notes = (evs: SimEvent[]): string[] => evs.filter((q) => q.type === 'note').map((q) => (q as { text: string }).text);

  it('the Ratte is the 2D rat: small, fast, weak, a pack of five, never elite', () => {
    const r = ENEMIES.rat, w = ENEMIES.walker;
    expect(r.hp / w.hp).toBeCloseTo(6 / 20, 1);
    expect(r.damage).toBeLessThan(w.damage / 2);
    expect(r.speed).toBeGreaterThan(w.speed * 1.5);
    expect(r.radius).toBeLessThan(w.radius * 0.7);
    expect(r.res).toBe('rat');
    expect(r.pack).toBe(5);
    const s = fresh();
    const lead = spawnPack(s, s.player.x, s.player.z + 6, 'rat');
    expect(s.enemies.filter((q) => q.kind === 'rat')).toHaveLength(5);
    for (const q of s.enemies) expect(Math.hypot(q.x - lead.x, q.z - lead.z)).toBeLessThan(1.2);
    makeElite(s, lead, 'flink');
    expect(lead.elite).toBeUndefined();
    spawnPack(s, s.player.x + 6, s.player.z, 'walker');
    expect(s.enemies).toHaveLength(6);
  });

  it('a rat zig-zags while it closes in, then bites', () => {
    const s = fresh();
    const e = put(s, 'rat', 0, 9);
    let side = 0;
    const evs: SimEvent[] = [];
    for (let i = 0; i < 180; i++) {
      evs.push(...run(s, 1 / 60));
      if (Math.hypot(e.x - s.player.x, e.z - s.player.z) > 2) side = Math.max(side, Math.abs(e.x - s.player.x));
    }
    expect(side).toBeGreaterThan(0.15);
    expect(has(evs, 'playerHit')).toBe(true);
  });

  it('Der Grenzer fires a Feuerstoß and five-shot volleys, calls two Hetzer with „Alarm!“ and keeps his distance', () => {
    const { s, evs } = fight('grenzer', 30, 8);
    expect(specials(evs)).toEqual(expect.arrayContaining(['barrage', 'volley', 'summon']));
    expect(notes(evs)).toContain('„Alarm!“');
    expect(s.enemies.filter((q) => q.kind === 'runner').length).toBeGreaterThanOrEqual(BOSS.grenzer.adds);
    // One volley: exactly five shots.
    const v = fresh();
    const g = put(v, 'grenzer', 0, 8);
    g.cd = [99, 0, 99];
    g.def = { ...g.def, speed: 0 };
    stepSim(v, NO_INPUT);
    expect(g.sp?.kind).toBe('volley');
    run(v, BOSS.grenzer.volleyWind + 0.05);
    expect(v.threats.shots).toHaveLength(BOSS.grenzer.shots);
    // Too close: he backs off.
    const b = fresh();
    const q = put(b, 'grenzer', 0, 3.5);
    q.cd = [99, 99, 99];
    run(b, 1);
    expect(Math.hypot(q.x - b.player.x, q.z - b.player.z)).toBeGreaterThan(3.8);
  });

  it('Der Brandmeister throws Molotovs that leave fire, fires a ring and bursts into flame up close', () => {
    const s = fresh();
    const e = put(s, 'brandmeister', 0, 7);
    e.cd = [0, 99, 99];
    e.def = { ...e.def, speed: 0 };
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('molotov');
    expect(s.threats.zones).toHaveLength(BOSS.brandmeister.bottles);
    run(s, BOSS.brandmeister.wind + BOSS.brandmeister.bottles * BOSS.brandmeister.step + 0.1);
    expect(s.threats.hazards.filter((h) => h.kind === 'fire')).toHaveLength(BOSS.brandmeister.bottles);
    expect(specials(fight('brandmeister', 24, 9).evs)).toEqual(expect.arrayContaining(['molotov', 'ring', 'flame']));
    // The flame burst only up close.
    const f = fresh();
    const b = put(f, 'brandmeister', 0, 6);
    b.cd = [99, 99, 0];
    b.def = { ...b.def, speed: 0 };
    run(f, 0.2);
    expect(b.state).toBe('chase');
    b.x = b.px = f.player.x;
    b.z = b.pz = f.player.z + 2.4;
    run(f, 0.05);
    expect(b.sp?.kind).toBe('flame');
  });

  it('Die Rattenmutter calls five rats, leaves acid where she walks and slams', () => {
    const s = fresh();
    const e = put(s, 'rattenmutter', 0, 9);
    e.hp = e.maxHp = 1e6;
    e.cd = [99, 99, 0];
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('summon');
    run(s, BOSS.summon.wind + 0.1);
    expect(s.enemies.filter((q) => q.kind === 'rat')).toHaveLength(BOSS.rattenmutter.adds);
    run(s, 3);
    expect(s.threats.hazards.some((h) => h.kind === 'acid')).toBe(true);
    expect(specials(fight('rattenmutter', 24).evs)).toEqual(expect.arrayContaining(['summon', 'bossSlam']));
    // Rage: the next pack comes after 2.6 s of real time, not 3.8.
    const r = fresh();
    const m = put(r, 'rattenmutter', 0, 9);
    m.hp = m.maxHp * 0.4;
    m.cd = [99, 99, 0];
    const evs = run(r, 0.2);
    expect(has(evs, 'bossRage')).toBe(true);
    const w = specials(run(r, BOSS.rattenmutter.summon[1] - 0.3));
    expect(w).not.toContain('summon');
    expect(specials(run(r, 0.5))).toContain('summon');
  });

  it('Die Spreehexe marks acid pools under the hero, sends two Spreewellen and in rage washes up three rats', () => {
    const s = fresh();
    const e = put(s, 'spreehexe', 0, 6);
    e.hp = e.maxHp = 1e6;
    e.cd = [99, 99, 99];
    run(s, 1.5 + BOSS.spreehexe.poolWind + 0.1);
    expect(s.threats.hazards.some((h) => h.kind === 'acid')).toBe(true);
    const w = fresh();
    const x = put(w, 'spreehexe', 0, 6);
    x.cd = [99, 99, 0];
    stepSim(w, NO_INPUT);
    expect(x.sp?.kind).toBe('roar');
    run(w, BOSS.roar.wind + 0.05);
    expect(w.threats.waves).toHaveLength(2);
    expect(w.enemies.filter((q) => q.kind === 'rat')).toHaveLength(0);
    // In rage every wave brings rats.
    const r = fresh();
    const h = put(r, 'spreehexe', 0, 6);
    h.hp = h.maxHp * 0.4;
    h.cd = [99, 99, 0];
    run(r, BOSS.roar.wind + 0.1);
    expect(r.enemies.filter((q) => q.kind === 'rat')).toHaveLength(BOSS.spreehexe.rageAdds);
    expect(specials(fight('spreehexe', 30).evs)).toEqual(expect.arrayContaining(['roar', 'ring', 'bossSlam']));
  });

  it('every Xhain boss rages below half life; the Spreehexe is the strongest', () => {
    const xhain = ['grenzer', 'brandmeister', 'rattenmutter', 'spreehexe'] as const;
    for (const kind of xhain) {
      const s = fresh();
      const e = put(s, kind, 0, 9);
      e.hp = e.maxHp * 0.45;
      expect(run(s, 0.1).filter((q) => q.type === 'bossRage'), kind).toHaveLength(1);
      expect(e.def.speed).toBeCloseTo(ENEMIES[kind].speed * BOSS.rageSpeed);
    }
    const hp = xhain.map((k) => ENEMIES[k].hp);
    expect([...hp].sort((a, b) => a - b)).toEqual(hp);
    expect(ENEMIES.spreehexe.hp).toBe(ENEMIES.hauptmann.hp);
    expect(ENEMIES.spreehexe.damage).toBe(ENEMIES.hauptmann.damage);
  });

  it('no Xhain boss takes more than 45 % of max life in one hit, even at ten times the damage', () => {
    for (const kind of ['grenzer', 'brandmeister', 'rattenmutter', 'spreehexe'] as const) {
      const s = fresh();
      const e = spawnEnemy(s, s.player.x, s.player.z + 3, kind, 1, 10);
      e.hp = e.maxHp = 1e6;
      let hits = 0;
      for (let i = 0; i < 60 * 20; i++) {
        s.hitstop = 0;
        const before = s.player.hp;
        stepSim(s, NO_INPUT);
        for (const q of s.events) if (q.type === 'playerHit') {
          hits++;
          expect(q.damage, kind).toBeLessThanOrEqual(s.stats.maxHp * 0.45 + 1e-6);
          expect(before - s.player.hp, kind).toBeLessThan(s.stats.maxHp * 0.46);
        }
        s.events.length = 0;
        s.player.hp = s.stats.maxHp;
      }
      expect(hits, kind).toBeGreaterThan(0);
    }
  });
});
