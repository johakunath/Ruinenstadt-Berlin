import { describe, it, expect } from 'vitest';
import { BOSS, ENEMIES, THREAT, type EnemyKind } from '../data/enemies';
import { waveTier } from '../data/koepenick';
import { ignite, killEnemy, knock, strike } from './combat';
import { aliveCount, capped, makeElite, pickKind, spawnEnemy, spawnPack } from './enemies';
import { inZone } from './threats';
import { autoAttackTarget } from './player';
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
const angleOfHero = (s: Sim, e: Enemy): number => Math.atan2(s.player.x - e.x, s.player.z - e.z);
/** M16: a long fight with a boss that never dies, put back `apart` m from the hero every 3 s; the specials it began. */
function fight(s: Sim, kind: EnemyKind, seconds: number, apart: number): SimEvent[] {
  const e = put(s, kind, 0, apart);
  e.hp = e.maxHp = 1e6;
  const evs: SimEvent[] = [];
  for (let t = 0; t < seconds; t += 3) {
    if (e.state !== 'special') { e.state = 'chase'; e.x = e.px = s.player.x; e.z = e.pz = s.player.z + apart; }
    evs.push(...run(s, 3));
  }
  return evs;
}
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
    // 160 × 1.4: the starter blade cuts Untote (D9 type bonus).
    expect(strike(s, sp, 100, { element: 'shock', noproc: true })).toBe(224);
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
    // 50 × 1.4 (D9: blade against Untote).
    expect(strike(s, e, 100)).toBe(70);
    e.open = 1;
    expect(strike(s, e, 100)).toBe(182);
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

  it('Hauptmann charges a hero who keeps away, fires two rings in rage, never staggers (playtest 2026-11-18)', () => {
    const { evs } = fight('hauptmann', 40, true);
    expect(specials(evs)).toContain('charge');
    const s = fresh();
    const h = put(s, 'hauptmann', 0, 6);
    h.hp = h.maxHp = 1e6; h.rage = true; h.cd = [9, 0, 9];
    const out = run(s, 4);
    expect(out.filter((q) => q.type === 'enemySpecial' && q.kind === 'ring' && q.phase === 'go').length).toBe(2);
    const s2 = fresh();
    const b = put(s2, 'hauptmann', 0, 2);
    strike(s2, b, 10, { knock: knock(240), feel: 'heavy' });
    expect(b.state).not.toBe('stagger');
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

describe('Alexanderplatz roster (M15)', () => {
  const notes = (evs: SimEvent[]): string[] => evs.filter((q) => q.type === 'note').map((q) => (q as { text: string }).text);
  /** A body that stands still facing the hero. */
  const still = (s: Sim, kind: EnemyKind, dx: number, dz: number): Enemy => {
    const e = put(s, kind, dx, dz);
    e.hp = e.maxHp = 1e6;
    e.def = { ...e.def, speed: 0 };
    e.cd = [99, 99, 99];
    e.wake = 0;
    return e;
  };

  it('the Uhrwerkläufer blocks from the front (20 %), a stun or a shock opens its guard, it is never armored', () => {
    const s = fresh();
    const e = still(s, 'uhrwerk', 0, 2);
    expect(Math.abs(e.facing - Math.PI)).toBeLessThan(0.01);
    const front = strike(s, e, 100);
    expect(front).toBe(20);
    expect(notes(s.events)).toContain('geblockt');
    // From behind: full damage.
    e.facing = 0;
    expect(strike(s, e, 100)).toBe(100);
    e.facing = Math.PI;
    // A stun in front opens the guard (full damage), then front hits pass for 2.2 s.
    s.events.length = 0;
    expect(strike(s, e, 100, { stun: 0.6 })).toBe(100);
    expect(notes(s.events)).toContain('Deckung offen');
    expect(strike(s, e, 100)).toBe(100);
    run(s, ENEMIES.uhrwerk.shield!.open + 0.1);
    e.facing = Math.PI;
    expect(strike(s, e, 100)).toBe(20);
    expect(strike(s, e, 100, { element: 'shock' })).toBe(Math.round(100 * 1.7));
    makeElite(s, e, 'gepanzert');
    expect(e.elite).not.toBe('gepanzert');
  });

  it('the crit-stun blessing and every fourth Kiezbox hit open the guard too (Codex review)', () => {
    const s = fresh();
    const e = still(s, 'uhrwerk', 0, 2);
    s.statContext.perks.stun = 1;
    expect(strike(s, e, 100, { crit: true })).toBe(100);
    expect(e.guardOpen).toBeGreaterThan(0);
    const k = fresh();
    const u = still(k, 'uhrwerk', 0, 2);
    k.stats.legendary.push('kiezbox');
    k.abilities.legHits = 0;
    expect([strike(k, u, 100), strike(k, u, 100), strike(k, u, 100)]).toEqual([20, 20, 20]);
    expect(strike(k, u, 100)).toBe(100);
    expect(u.guardOpen).toBeGreaterThan(0);
  });

  it('the Uhrwerkläufer turns at most 90°/s, so the hero can get behind it', () => {
    const s = fresh();
    const e = put(s, 'uhrwerk', 0, 3);
    e.facing = e.pfacing = 0;
    e.def = { ...e.def, speed: 0.01 };
    run(s, 0.5);
    expect(Math.abs(e.facing)).toBeLessThan(ENEMIES.uhrwerk.shield!.turn * 0.5 + 0.05);
  });

  it('the Wurzler marks roots under the hero; caught, the hero cannot walk until a roll breaks free, then is immune', () => {
    const s = fresh();
    const e = still(s, 'wurzler', 0, 8);
    e.cd[1] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('roots');
    const z = s.threats.zones[0]!;
    expect(z.kind).toBe('root');
    expect(Math.hypot(z.x - s.player.x, z.z - s.player.z)).toBeLessThan(0.01);
    expect(z.r).toBe(THREAT.roots.radius);
    const evs = run(s, THREAT.roots.wind);
    expect(notes(evs)).toContain('Festgehalten');
    expect(has(evs, 'playerHit')).toBe(true);
    expect(s.player.root).toBeGreaterThan(0);
    // Held: walking does nothing.
    const x0 = s.player.x;
    run(s, 0.3, { moveX: 1 });
    expect(Math.abs(s.player.x - x0)).toBeLessThan(0.05);
    // A roll breaks free; the next roots within 2.5 s do not hold.
    run(s, 0.05, { dodge: true, moveX: 1 });
    expect(s.player.root).toBe(0);
    expect(s.player.rootI).toBeGreaterThan(0);
    // The Wurzler stood open after its cast.
    expect(e.open > 0 || e.state === 'chase').toBe(true);
    // Out of range (> 10 m): no roots.
    const f = fresh();
    const w = still(f, 'wurzler', 0, 8);
    w.x = w.px = f.player.x + 8;
    w.z = w.pz = f.player.z + 8;
    w.cd[1] = 0;
    run(f, 0.2);
    expect(Math.hypot(w.x - f.player.x, w.z - f.player.z)).toBeGreaterThan(THREAT.roots.range);
    expect(f.threats.zones).toHaveLength(0);
  });

  it('a roll through the root field does not get held', () => {
    const s = fresh();
    const e = still(s, 'wurzler', 0, 8);
    e.cd[1] = 0;
    run(s, THREAT.roots.wind - 0.1);
    run(s, 0.2, { dodge: true, moveX: 1 });
    expect(s.player.root).toBe(0);
  });

  it('the Kernspeier plants itself, spits three seeds ±15° at 70 %, then stands open', () => {
    const s = fresh();
    const e = still(s, 'kernspeier', 0, 7);
    e.cd[1] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('seeds');
    run(s, THREAT.seeds.wind + 0.02);
    const shots = s.threats.shots;
    expect(shots).toHaveLength(3);
    for (const q of shots) expect(q.damage).toBeCloseTo(ENEMIES.kernspeier.damage * THREAT.seeds.damage);
    // Spread around the aim (toward the hero), wrapped to ±π.
    const aim = Math.atan2(s.player.x - e.x, s.player.z - e.z);
    const off = shots.map((q) => Math.atan2(Math.sin(Math.atan2(q.vx, q.vz) - aim), Math.cos(Math.atan2(q.vx, q.vz) - aim))).sort((a, b) => a - b);
    expect(off[0]).toBeCloseTo(-THREAT.seeds.spread, 3);
    expect(off[2]).toBeCloseTo(THREAT.seeds.spread, 3);
    run(s, 0.3);
    expect(e.open).toBeGreaterThan(0);
    // It backs off when the hero comes close.
    const b = fresh();
    const k = put(b, 'kernspeier', 0, 3);
    k.cd = [99, 99, 99];
    run(b, 1);
    expect(Math.hypot(k.x - b.player.x, k.z - b.player.z)).toBeGreaterThan(3.5);
  });

  it('Die Wurzel-Mutter lays three root fields (four in rage), calls two Kernspeier and roots in a ring up close', () => {
    const s = fresh();
    const e = still(s, 'wurzelmutter', 0, 7);
    e.cd[0] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('roots');
    expect(s.threats.zones.filter((z) => z.kind === 'root')).toHaveLength(3);
    const r = fresh();
    const m = still(r, 'wurzelmutter', 0, 7);
    m.hp = m.maxHp * 0.4;
    m.cd[0] = 0;
    run(r, 0.05);
    expect(r.threats.zones.filter((z) => z.kind === 'root')).toHaveLength(4);
    const a = fresh();
    const q = still(a, 'wurzelmutter', 0, 7);
    q.cd[1] = 0;
    run(a, BOSS.summon.wind + 0.6);
    expect(a.enemies.filter((o) => o.kind === 'kernspeier')).toHaveLength(BOSS.wurzelmutter.adds);
    const c = fresh();
    const w = still(c, 'wurzelmutter', 0, 2.5);
    w.cd[2] = 0;
    stepSim(c, NO_INPUT);
    expect(w.sp?.kind).toBe('rootRing');
    expect(c.threats.zones[0]!.root).toBe(THREAT.roots.hold);
  });

  it('Der Große Uhrwerkläufer charges at 12 m/s, then winds down open; every third cycle it winds its key, front closed', () => {
    const s = fresh();
    const e = still(s, 'uhrwerkgross', 0, 9);
    e.def = { ...ENEMIES.uhrwerkgross };
    e.cd[0] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('charge');
    expect(e.sp?.speed).toBe(BOSS.uhrwerkgross.speed);
    run(s, BOSS.charge.wind + BOSS.uhrwerkgross.time + 0.05);
    expect(e.open).toBeGreaterThan(1);
    // Cycles two and three: the third is the key.
    e.cycle = 2;
    e.cd[0] = 0;
    e.open = 0;
    e.gap = 0;
    e.x = e.px = s.player.x;
    e.z = e.pz = s.player.z + 6;
    run(s, 0.05);
    expect(e.sp?.kind).toBe('key');
    e.facing = Math.PI;
    expect(strike(s, e, 100)).toBe(0);
    e.facing = 0;
    expect(strike(s, e, 100)).toBe(100);
    run(s, BOSS.uhrwerkgross.key);
    expect(s.threats.shots.length).toBeGreaterThanOrEqual(BOSS.uhrwerkgross.shots);
  });

  it('Der Volkseigene Koloss drops three slabs, then sprays gears in a two-arm spiral, and calls Uhrwerkläufer every third cycle', () => {
    const s = fresh();
    const e = still(s, 'volkskoloss', 0, 8);
    e.cd[0] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('slabs');
    const slabs = s.threats.zones.filter((z) => z.kind === 'slab');
    expect(slabs).toHaveLength(BOSS.volkskoloss.slabs);
    expect(Math.hypot(slabs[0]!.x - s.player.x, slabs[0]!.z - s.player.z)).toBeLessThan(0.01);
    run(s, 2);
    e.cd[0] = 0;
    run(s, 1);
    expect(e.cycle).toBe(2);
    expect(s.threats.shots.length).toBeGreaterThanOrEqual(6);
    e.cd[0] = 0;
    run(s, 0.1);
    expect(s.enemies.filter((o) => o.kind === 'uhrwerk')).toHaveLength(BOSS.volkskoloss.adds);
  });

  it('Die Weltzeituhr wakes up untouchable for 3 s, then roars; hour sectors only hit inside their slice', () => {
    const s = fresh();
    const e = put(s, 'weltzeituhr', 0, 8);
    expect(e.wake).toBe(3);
    expect(strike(s, e, 100)).toBe(0);
    const d0 = Math.hypot(e.x - s.player.x, e.z - s.player.z);
    const evs = run(s, 2.9);
    // It does not walk while waking (a courtyard prop may nudge it).
    expect(Math.hypot(e.x - s.player.x, e.z - s.player.z)).toBeGreaterThan(d0 - 0.6);
    expect(s.threats.waves).toHaveLength(0);
    run(s, 0.2);
    expect(s.threats.waves).toHaveLength(2);
    expect(strike(s, e, 100)).toBeGreaterThan(0);
    expect(has(evs, 'enemySpecial')).toBe(false);
    // Fire does not catch while it wakes either (Codex review).
    const b = fresh();
    const w = put(b, 'weltzeituhr', 0, 8);
    ignite(b, w, 500, 3);
    expect(w.burn).toBe(0);
    w.burn = 2;
    w.bdps = 500;
    run(b, 1);
    expect(w.hp).toBe(w.maxHp);
    // Sectors: the hero's slice hits, three of them (four in rage).
    const z = fresh();
    const c = still(z, 'weltzeituhr', 0, 6);
    c.cd[0] = 0;
    stepSim(z, NO_INPUT);
    expect(c.sp?.kind).toBe('sectors');
    expect(z.threats.zones).toHaveLength(BOSS.weltzeituhr.sectors);
    const hits = run(z, BOSS.weltzeituhr.sectorWind + 0.05).filter((q) => q.type === 'zoneHit' && q.hit);
    expect(hits).toHaveLength(1);
    // Inside the inner radius nothing hits.
    const n = fresh();
    const d = still(n, 'weltzeituhr', 0, 2.6);
    d.cd[0] = 0;
    expect(run(n, BOSS.weltzeituhr.sectorWind + 0.1).filter((q) => q.type === 'zoneHit' && q.hit)).toHaveLength(0);
    const r = fresh();
    const g = still(r, 'weltzeituhr', 0, 6);
    g.hp = g.maxHp * 0.4;
    g.still = 3;
    g.cd[0] = 0;
    run(r, 0.05);
    expect(r.threats.zones).toHaveLength(BOSS.weltzeituhr.sectors + 1);
  });

  it('the minute hand sweeps a full circle: it hits a standing hero once and misses one that keeps rolling', () => {
    const s = fresh();
    const e = still(s, 'weltzeituhr', 0, 5);
    e.cycle = 2;
    e.cd[0] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('hand');
    expect(s.threats.sweeps).toHaveLength(1);
    const hits = run(s, BOSS.weltzeituhr.handWind + BOSS.weltzeituhr.handTime).filter((q) => q.type === 'playerHit');
    expect(hits).toHaveLength(1);
    expect(s.threats.sweeps).toHaveLength(0);
    const r = fresh();
    const c = still(r, 'weltzeituhr', 0, 5);
    c.cycle = 2;
    c.cd[0] = 0;
    const out: SimEvent[] = [];
    for (let i = 0; i < 60 * 4; i++) { r.player.invuln = 1; stepSim(r, NO_INPUT); out.push(...r.events); r.events.length = 0; }
    expect(has(out, 'playerHit')).toBe(false);
  });

  it('Stillstand at 75, 50 and 25 %: the hero walks at half speed for 2 s and two Uhrwerkläufer drop in', () => {
    const s = fresh();
    const e = still(s, 'weltzeituhr', 0, 9);
    e.hp = e.maxHp * 0.74;
    const evs = run(s, 0.05);
    expect(notes(evs)).toContain('Stillstand');
    expect(s.player.slowT).toBeGreaterThan(1.9);
    expect(s.enemies.filter((o) => o.kind === 'uhrwerk')).toHaveLength(BOSS.weltzeituhr.adds);
    const x0 = s.player.x;
    run(s, 1, { moveX: 1 });
    const slow = s.player.x - x0;
    const f = fresh();
    const x1 = f.player.x;
    run(f, 1, { moveX: 1 });
    expect(slow).toBeLessThan((f.player.x - x1) * 0.6);
    // Once per threshold.
    expect(notes(run(s, 0.5))).not.toContain('Stillstand');
    e.hp = e.maxHp * 0.2;
    run(s, 0.05);
    expect(e.still).toBe(3);
  });

  it('no Alexanderplatz enemy takes more than 45 % of max life in one hit, even at ten times the damage', () => {
    for (const kind of ['uhrwerk', 'wurzler', 'kernspeier', 'wurzelmutter', 'uhrwerkgross', 'volkskoloss', 'weltzeituhr'] as const) {
      const s = fresh();
      const e = spawnEnemy(s, s.player.x, s.player.z + 4, kind, 1, 10);
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

  it('every Alexanderplatz boss rages below half life and runs all its specials', () => {
    const want: Record<string, string[]> = {
      wurzelmutter: ['roots', 'summon', 'rootRing'], uhrwerkgross: ['charge', 'key'], volkskoloss: ['slabs', 'bossSlam'], weltzeituhr: ['sectors', 'hand', 'bossSlam'],
    };
    for (const [kind, list] of Object.entries(want)) {
      const s = fresh();
      const e = put(s, kind as EnemyKind, 0, 9);
      e.wake = 0;
      e.hp = e.maxHp * 0.45;
      expect(run(s, 0.1).filter((q) => q.type === 'bossRage'), kind).toHaveLength(1);
      e.hp = 1e6;
      const evs: SimEvent[] = [];
      for (let t = 0; t < 40; t += 2) {
        // Alternate near and far so close-range specials come too.
        if (e.state !== 'special') { e.state = 'chase'; e.x = e.px = s.player.x; e.z = e.pz = s.player.z + ((t / 2) % 2 ? 2.8 + e.def.radius * 0.3 : 8); }
        evs.push(...run(s, 2));
      }
      expect(specials(evs), kind).toEqual(expect.arrayContaining(list));
    }
  });
});

describe('Mitte roster (M12c)', () => {
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
  const still = (e: Enemy): void => { e.def = { ...e.def, speed: 0 }; };
  const alive = (s: Sim, kind: EnemyKind): number => s.enemies.filter((q) => q.kind === kind && q.state !== 'dead').length;

  it('the Kabelghul is the 2D kabel on the ghoul ratios and leaps along a marked line, then stands open', () => {
    const k = ENEMIES.kabel;
    expect([k.hp, k.damage, k.speed, k.radius, k.res]).toEqual([22, 10, 3.3, 0.3, 'kabel']);
    const s = fresh();
    const e = put(s, 'kabel', 0, 4.6);
    e.cd[1] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('leap');
    const x0 = e.x, z0 = e.z;
    run(s, THREAT.leap.wind - 0.05);
    expect(Math.hypot(e.x - x0, e.z - z0)).toBeLessThan(0.05);
    const evs = run(s, THREAT.leap.time + 0.1);
    expect(Math.hypot(e.x - x0, e.z - z0)).toBeCloseTo(THREAT.leap.speed * THREAT.leap.time, 0);
    expect(evs.filter((q) => q.type === 'playerHit')).toHaveLength(1);
    expect(e.open).toBeGreaterThan(THREAT.leap.open - 0.15);
    // The cooldown is fixed per body, 2.2 to 3 s.
    expect(e.cd[1]).toBeGreaterThan(THREAT.leap.every[0] - 0.6);
    expect(e.cd[1]).toBeLessThanOrEqual(THREAT.leap.every[1]);
  });

  it('the Boxenkopf sends one bass ring to 9 m that a roll passes, drives the others on and stands open', () => {
    const s = fresh();
    const e = put(s, 'bass', 0, 6);
    const w = put(s, 'walker', 3, 6);
    e.cd[1] = 0;
    still(e);
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('bass');
    run(s, THREAT.bass.wind + 0.02);
    expect(s.threats.waves).toHaveLength(1);
    expect(s.threats.waves[0]!.max).toBeCloseTo(9, 0);
    expect(s.threats.waves[0]!.floor).toBe(0);
    expect(w.buff).toBeGreaterThan(THREAT.bass.buff - 0.2);
    const evs = run(s, 0.7, {}, false);
    expect(evs.some((q) => q.type === 'playerHit' && q.damage <= ENEMIES.bass.damage * THREAT.bass.damage + 1e-6)).toBe(true);
    expect(e.open).toBeGreaterThan(0.3);
    // Rolling through (invulnerable): the ring passes.
    const r = fresh();
    const b = put(r, 'bass', 0, 6);
    b.cd[1] = 0;
    still(b);
    const out: SimEvent[] = [];
    for (let i = 0; i < 90; i++) { r.player.invuln = 1; stepSim(r, NO_INPUT); out.push(...r.events); r.events.length = 0; }
    expect(out.some((q) => q.type === 'enemySpecial' && q.kind === 'bass' && q.phase === 'go')).toBe(true);
    expect(has(out, 'playerHit')).toBe(false);
  });

  it('never more than two Boxenköpfe alive: the pick, ?spawn and boss calls keep the cap', () => {
    expect(ENEMIES.bass.cap).toBe(2);
    const s = fresh();
    put(s, 'bass', 0, 8);
    expect(capped(s, 'bass')).toBe(false);
    put(s, 'bass', 0, -8);
    expect(capped(s, 'bass')).toBe(true);
    for (let i = 0; i < 40; i++) expect(pickKind(s, { bass: 5, walker: 0.1 })).toBe('walker');
    const sp = createSim({ empty: true, spawn: ['bass', 'bass', 'bass', 'kabel'] });
    expect(alive(sp, 'bass')).toBe(2);
    expect(alive(sp, 'kabel')).toBe(1);
    // Sleeping side-passage guards do not use up a boss's adds.
    const z = fresh();
    for (let i = 0; i < 10; i++) put(z, 'walker', 20 + i, 20).sleep = 6;
    const t = put(z, 'tuersteher', 0, 7);
    t.cd = [99, 99, 0];
    run(z, BOSS.summon.wind + 0.6);
    expect(alive(z, 'kabel')).toBe(BOSS.tuersteher.adds);
    // The Dirigent's Orchester with one Boxenkopf alive calls only one more.
    const d = fresh();
    put(d, 'bass', 4, 4);
    const g = put(d, 'dirigent', 0, 6);
    g.hp = g.maxHp = 1e6;
    run(d, 2);
    expect(alive(d, 'bass')).toBe(2);
  });

  it('the Drohne flies like a Krähe: circles, dives, then sits dazed', () => {
    const d = ENEMIES.drone;
    expect(d.fly && d.ai === 'crow' && d.body === 'drone').toBe(true);
    const s = fresh();
    const e = put(s, 'drone', 0, 4);
    const evs = run(s, 6);
    expect(specials(evs)).toContain('dive');
    let rested = false;
    for (let i = 0; i < 360 && !rested; i++) { run(s, 1 / 60); rested = e.rest > 0; }
    expect(rested).toBe(true);
  });

  it('Der Türsteher shoves out of a circle in front of him, twice in rage', () => {
    const s = fresh();
    const e = put(s, 'tuersteher', 0, 2.5);
    e.cd = [0, 99, 99];
    still(e);
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('shove');
    const z = s.threats.zones[0]!;
    expect(z.kind).toBe('shove');
    expect(z.r).toBe(BOSS.tuersteher.shoveRadius);
    expect(Math.hypot(z.x - e.x, z.z - e.z)).toBeCloseTo(BOSS.tuersteher.shoveAhead, 1);
    const x0 = s.player.x, z0 = s.player.z;
    const evs = run(s, BOSS.tuersteher.shoveWind + 1);
    expect(has(evs, 'playerHit')).toBe(true);
    expect(Math.hypot(s.player.x - x0, s.player.z - z0)).toBeGreaterThan(2.5);
    expect(s.player.z).toBeLessThan(z0);
    // Rage: a second shove follows half a second after the first.
    const r = fresh();
    const t = put(r, 'tuersteher', 0, 2.5);
    t.hp = t.maxHp * 0.4;
    t.cd = [0, 99, 99];
    still(t);
    const out = run(r, 2.6);
    expect(specials(out).filter((k) => k === 'shove')).toHaveLength(2);
  });

  it('the rage shove follows after its pause even when the hero dodged the first and stays in reach', () => {
    const s = fresh();
    const e = put(s, 'tuersteher', 0, 1.8);
    e.hp = e.maxHp * 0.4;
    e.cd = [0, 99, 99];
    still(e);
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('shove');
    e.cd[0] = 99;
    let ended = -1, second = -1, strike = false;
    for (let i = 0; i < 60 * 3 && second < 0; i++) {
      s.player.invuln = 1;
      s.player.hp = s.stats.maxHp;
      stepSim(s, NO_INPUT);
      if (ended < 0 && e.state !== 'special') ended = i;
      if (ended >= 0 && e.state === 'windup') strike = true;
      if (ended >= 0 && e.state === 'special' && e.sp?.kind === 'shove') second = i;
    }
    expect(strike).toBe(false);
    expect(second).toBeGreaterThan(ended);
    expect((second - ended) / 60).toBeCloseTo(BOSS.tuersteher.rageGap, 1);
  });

  it('Der Türsteher grabs and holds: no walking, attacks work, a roll breaks free; the hold never outlasts 1 s', () => {
    const grab = (): { s: Sim; e: Enemy } => {
      const s = fresh();
      const e = put(s, 'tuersteher', 0, 4.5);
      e.hp = e.maxHp = 1e6;
      e.cd = [99, 0, 99];
      still(e);
      stepSim(s, NO_INPUT);
      expect(e.sp?.kind).toBe('grab');
      for (let i = 0; i < 90 && s.player.rootBy !== e.id; i++) run(s, 1 / 60);
      expect(s.player.rootBy).toBe(e.id);
      return { s, e };
    };
    // Held: walking does nothing, an attack still starts, the throw comes after the hold.
    const { s, e } = grab();
    expect(s.player.root).toBeCloseTo(BOSS.tuersteher.hold, 1);
    const x0 = s.player.x, z0 = s.player.z;
    run(s, 0.3, { moveX: 1 });
    expect(Math.hypot(s.player.x - x0, s.player.z - z0)).toBeLessThan(0.05);
    run(s, 1 / 60, { attack: true });
    expect(s.player.state).toBe('attack');
    const evs = run(s, 0.9);
    expect(has(evs, 'playerHit')).toBe(true);
    expect(s.player.root).toBe(0);
    expect(e.state === 'chase' && e.open > 0).toBe(true);
    // A roll breaks free at once: no throw.
    const f = grab();
    run(f.s, 0.2);
    const free = run(f.s, 1 / 60, { dodge: true, moveX: 1 });
    expect(f.s.player.root).toBe(0);
    const after = [...free, ...run(f.s, 1.2)];
    expect(has(after, 'playerHit')).toBe(false);
    expect(f.e.sp).toBeNull();
    // Hitstop does not stretch it: free within one second of steps, frozen or not.
    const h = grab();
    let steps = 0;
    while (h.s.player.root > 0 && steps < 200) {
      if (steps % 10 === 0) h.s.hitstop = 0.12;
      stepSim(h.s, NO_INPUT);
      h.s.events.length = 0;
      steps++;
    }
    expect(steps).toBeLessThanOrEqual(Math.round(BOSS.tuersteher.hold * 60) + 1);
  });

  it('Der Türsteher calls two Kabelghule from the guest list, three in rage', () => {
    const s = fresh();
    const e = put(s, 'tuersteher', 0, 7);
    e.cd = [99, 99, 0];
    const evs = run(s, BOSS.summon.wind + 0.6);
    expect(alive(s, 'kabel')).toBe(BOSS.tuersteher.adds);
    expect(notes(evs)).toContain('„Nicht auf der Liste!“');
    const r = fresh();
    const t = put(r, 'tuersteher', 0, 7);
    t.hp = t.maxHp * 0.4;
    t.cd = [99, 99, 0];
    run(r, BOSS.summon.wind + 0.6);
    expect(alive(r, 'kabel')).toBe(BOSS.tuersteher.rageAdds);
    expect(specials(fight('tuersteher', 30, 4.5).evs)).toEqual(expect.arrayContaining(['summon', 'shove', 'grab']));
  });

  it('Die Wachdrohne: the searchlight follows the hero, locks after 0.6 s, then five laser shots', () => {
    const s = fresh();
    const e = put(s, 'wachdrohne', 0, 8);
    e.cd = [99, 99, 99];
    still(e);
    run(s, 1 / 60);
    expect(s.threats.spots).toHaveLength(1);
    const sp = s.threats.spots[0]!;
    const d0 = Math.hypot(sp.x - s.player.x, sp.z - s.player.z);
    run(s, 1);
    expect(d0 - Math.hypot(sp.x - s.player.x, sp.z - s.player.z)).toBeCloseTo(BOSS.wachdrohne.spotSpeed, 1);
    sp.x = s.player.x;
    sp.z = s.player.z;
    const lock = run(s, BOSS.wachdrohne.lock + 0.02);
    expect(has(lock, 'spotLock')).toBe(true);
    expect(s.threats.shots).toHaveLength(0);
    run(s, BOSS.wachdrohne.flash);
    expect(s.threats.shots).toHaveLength(BOSS.wachdrohne.shots);
    // Out of the light, nothing locks.
    const o = fresh();
    const q = put(o, 'wachdrohne', 0, 8);
    q.cd = [99, 99, 99];
    still(q);
    run(o, 1 / 60);
    o.threats.spots[0]!.x += 6;
    expect(has(run(o, 1), 'spotLock')).toBe(false);
  });

  it('Die Wachdrohne lands every third special (marked circle, 2.5 s open, no light), calls three drones, keeps away', () => {
    const s = fresh();
    const e = put(s, 'wachdrohne', 0, 8);
    e.hp = e.maxHp = 1e6;
    e.cd = [0, 99, 99];
    e.cycle = BOSS.wachdrohne.landEvery - 1;
    still(e);
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('land');
    expect(s.threats.zones.some((z) => z.kind === 'land' && z.r === BOSS.wachdrohne.landRadius)).toBe(true);
    run(s, BOSS.wachdrohne.landWind + 0.3);
    expect(e.open).toBeGreaterThan(BOSS.wachdrohne.landed - 0.3);
    expect(s.threats.spots).toHaveLength(0);
    run(s, BOSS.wachdrohne.landed);
    expect(s.threats.spots).toHaveLength(1);
    // Drones.
    const d = fresh();
    const w = put(d, 'wachdrohne', 0, 8);
    w.cd = [99, 99, 0];
    run(d, BOSS.summon.wind + 0.6);
    expect(alive(d, 'drone')).toBe(BOSS.wachdrohne.adds);
    // Too close: she backs off. In rage: two lights.
    const b = fresh();
    const x = put(b, 'wachdrohne', 0, 3);
    x.cd = [99, 99, 99];
    run(b, 1.5);
    expect(Math.hypot(x.x - b.player.x, x.z - b.player.z)).toBeGreaterThan(4);
    x.hp = x.maxHp * 0.4;
    run(b, 0.1);
    expect(b.threats.spots.filter((q) => q.src === x.id)).toHaveLength(2);
    expect(specials(fight('wachdrohne', 30, 8).evs)).toEqual(expect.arrayContaining(['volley', 'summon', 'land']));
  });

  it('Der Dirigent calls two Boxenköpfe, beats one ring every 4 s, every fourth beat a Fortissimo that pulses them all', () => {
    const s = fresh();
    const e = put(s, 'dirigent', 0, 7);
    e.hp = e.maxHp = 1e6;
    still(e);
    run(s, 1.5);
    expect(alive(s, 'bass')).toBe(BOSS.dirigent.adds);
    for (const b of s.enemies) if (b.kind === 'bass') { still(b); b.cd[1] = 99; }
    const evs: SimEvent[] = [];
    let fort = -1;
    for (let i = 0; i < 60 * 18 && fort < 0; i++) {
      evs.push(...run(s, 1 / 60));
      if (e.state === 'special' && e.sp?.kind === 'roar') fort = i;
    }
    const beats = specials(evs).filter((k) => k === 'beat' || k === 'roar');
    expect(beats).toEqual(['beat', 'beat', 'beat', 'roar']);
    const pulsing = s.enemies.filter((b) => b.kind === 'bass' && b.state === 'special' && b.sp?.kind === 'bass');
    expect(pulsing).toHaveLength(BOSS.dirigent.adds);
    // They release together with him (within a step).
    for (const b of pulsing) expect(b.sp!.wind - b.stateT).toBeCloseTo(e.sp!.wind - e.stateT, 1);
    const out = run(s, BOSS.dirigent.beatWind + 0.05);
    expect(notes(out)).toContain('Fortissimo!');
    expect(s.threats.waves.length).toBe(2 + BOSS.dirigent.adds);
    // Once more at half life.
    const r = fresh();
    const g = put(r, 'dirigent', 0, 7);
    g.calls = 1;
    g.hp = g.maxHp * 0.4;
    run(r, 1.5);
    expect(alive(r, 'bass')).toBe(BOSS.dirigent.adds);
    run(r, 6);
    expect(g.calls).toBe(2);
  });

  it('Der Bassprediger charges 10 m, preaches two rings after every second charge (every charge in rage), calls his congregation', () => {
    const charge = (s: Sim, e: Enemy): void => {
      e.x = e.px = s.player.x;
      e.z = e.pz = s.player.z + 9;
      e.state = 'chase';
      e.open = 0;
      e.gap = 0;
      e.cd = [0, 99, 99];
      stepSim(s, NO_INPUT);
      expect(e.sp?.kind).toBe('charge');
    };
    const B = BOSS.bassprediger;
    const s = fresh();
    const e = put(s, 'bassprediger', 0, 9);
    e.hp = e.maxHp = 1e6;
    still(e);
    charge(s, e);
    const z0 = e.z;
    run(s, B.wind + B.time + 0.02);
    expect(z0 - e.z).toBeCloseTo(B.speed * B.time, 0);
    expect(e.open).toBeGreaterThan(B.open - 0.1);
    expect(e.queue).toBeUndefined();
    charge(s, e);
    run(s, B.wind + B.time + 0.02);
    expect(e.queue?.kind).toBe('roar');
    const evs = run(s, B.open + BOSS.roar.wind + 0.1);
    expect(specials(evs)).toContain('roar');
    expect(s.threats.waves).toHaveLength(2);
    expect(s.threats.waves[0]!.max).toBeCloseTo(B.max, 1);
    // In rage every charge preaches.
    const r = fresh();
    const q = put(r, 'bassprediger', 0, 9);
    q.hp = q.maxHp * 0.4;
    still(q);
    run(r, 1 / 60);
    charge(r, q);
    run(r, B.wind + B.time + 0.02);
    expect(q.queue?.kind).toBe('roar');
    // Gemeinde: three Kabelghule, in rage two Boxenköpfe.
    const g = fresh();
    const p = put(g, 'bassprediger', 0, 9);
    p.cd = [99, 99, 0];
    const notesOut = run(g, BOSS.summon.wind + 0.6);
    expect(alive(g, 'kabel')).toBe(B.adds);
    expect(notes(notesOut)).toContain('„Gemeinde!“');
    const h = fresh();
    const m = put(h, 'bassprediger', 0, 9);
    m.hp = m.maxHp * 0.4;
    m.cd = [99, 99, 0];
    run(h, BOSS.summon.wind + 0.6);
    expect(alive(h, 'bass')).toBe(B.rageAdds);
  });

  it('every Mitte boss rages below half life on the ladder; the Bassprediger is the Hauptmann tier', () => {
    for (const kind of ['tuersteher', 'wachdrohne', 'dirigent', 'bassprediger'] as const) {
      const s = fresh();
      const e = put(s, kind, 0, 9);
      e.hp = e.maxHp * 0.45;
      expect(run(s, 0.1).filter((q) => q.type === 'bossRage'), kind).toHaveLength(1);
      expect(e.def.speed).toBeCloseTo(ENEMIES[kind].speed * BOSS.rageSpeed);
    }
    expect([ENEMIES.tuersteher.hp, ENEMIES.dirigent.hp, ENEMIES.wachdrohne.hp, ENEMIES.bassprediger.hp]).toEqual([1000, 1400, 2200, 4400]);
    expect(ENEMIES.bassprediger.damage).toBe(ENEMIES.hauptmann.damage);
  });

  it('no Mitte hit takes more than 45 % of max life, even at ten times the damage', () => {
    for (const kind of ['kabel', 'bass', 'drone', 'tuersteher', 'wachdrohne', 'dirigent', 'bassprediger'] as const) {
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

describe('Charlottenburg roster (M16, spec m12d)', () => {
  const notes = (evs: SimEvent[]): string[] => evs.filter((q) => q.type === 'note').map((q) => (q as { text: string }).text);
  const still = (e: Enemy): void => { e.def = { ...e.def, speed: 0 }; };
  const alive = (s: Sim, kind: EnemyKind): number => s.enemies.filter((q) => q.kind === kind && q.state !== 'dead').length;
  /** No weapon class bonus, so damage ratios are exact. */
  const plain = (): Sim => { const s = fresh(); s.stats.types = []; return s; };

  it('the Scherbentänzerin spins 4.55 m along a marked line, hits once, then stands open; her cooldown is fixed per body', () => {
    const d = ENEMIES.scherbe;
    expect([d.hp, d.damage, d.speed, d.radius, d.res, d.glass, d.body]).toEqual([20, 10, 3.6, 0.3, 'glas', true, 'female']);
    const s = fresh();
    const e = put(s, 'scherbe', 0, 4.8);
    e.cd[1] = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('pirouette');
    const x0 = e.x, z0 = e.z;
    run(s, THREAT.pirouette.wind - 0.05);
    expect(Math.hypot(e.x - x0, e.z - z0)).toBeLessThan(0.05);
    const evs = run(s, THREAT.pirouette.time + 0.1);
    expect(Math.hypot(e.x - x0, e.z - z0)).toBeCloseTo(THREAT.pirouette.speed * THREAT.pirouette.time, 0);
    expect(evs.filter((q) => q.type === 'playerHit')).toHaveLength(1);
    expect(e.open).toBeGreaterThan(THREAT.pirouette.open - 0.15);
    const P = THREAT.pirouette.every;
    expect(e.cd[1]).toBeGreaterThan(P[0] - 0.6);
    expect(e.cd[1]).toBeLessThanOrEqual(P[1]);
    // A sidestep in the wind-up and the spin misses.
    const m = fresh();
    const f = put(m, 'scherbe', 0, 4.8);
    f.cd[1] = 0;
    stepSim(m, NO_INPUT);
    m.player.x += 2.5;
    expect(has(run(m, THREAT.pirouette.wind + THREAT.pirouette.time + 0.1), 'playerHit')).toBe(false);
  });

  it('the Logenbrecher blocks from the front, slams a marked circle in front of him and is open with the front down after it', () => {
    const d = ENEMIES.loge;
    expect([d.hp, d.damage, d.speed, d.cap, d.knockbackTaken, d.poise, d.attackRange]).toEqual([130, 30, 1.2, 2, 0.35, true, 0]);
    const s = plain();
    const e = put(s, 'loge', 0, 2.5);
    e.hp = e.maxHp = 1e6;
    still(e);
    expect(strike(s, e, 100)).toBe(20);
    e.cd[1] = 0;
    s.hitstop = 0;
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('faust');
    const z = s.threats.zones[0]!;
    expect([z.kind, z.r]).toEqual(['faust', THREAT.faust.radius]);
    expect(Math.hypot(z.x - e.x, z.z - e.z)).toBeCloseTo(THREAT.faust.ahead, 1);
    const hp = s.player.hp;
    run(s, THREAT.faust.wind + 0.05, {}, false);
    expect(hp - s.player.hp).toBeGreaterThanOrEqual(s.stats.maxHp * THREAT.faust.floor - 1);
    run(s, 0.35);
    expect(e.open).toBeGreaterThan(THREAT.faust.open - 0.4);
    // Open: the front is down (full damage and the open bonus from the front).
    e.facing = angleOfHero(s, e);
    expect(strike(s, e, 100)).toBe(Math.round(100 * THREAT.openBonus));
    // Rolling out of the circle: no hit.
    const r = fresh();
    const b = put(r, 'loge', 0, 2.5);
    still(b);
    b.cd[1] = 0;
    stepSim(r, NO_INPUT);
    expect(has(run(r, THREAT.faust.wind + 0.1, { moveX: 1 }), 'playerHit')).toBe(false);
    // At most two alive.
    const c = createSim({ empty: true, spawn: ['loge', 'loge', 'loge'] });
    expect(alive(c, 'loge')).toBe(2);
  });

  it('the Spiegelsouffleur keeps back, cues the others on and throws five shards between two cues', () => {
    expect([ENEMIES.souffleur.hp, ENEMIES.souffleur.damage, ENEMIES.souffleur.cap, ENEMIES.souffleur.res]).toEqual([34, 12, 2, 'spiegel']);
    const s = fresh();
    const e = put(s, 'souffleur', 0, 3);
    e.hp = e.maxHp = 1e6;
    const w = put(s, 'walker', 2, 3);
    run(s, 1.2);
    expect(Math.hypot(e.x - s.player.x, e.z - s.player.z)).toBeGreaterThan(4);
    // The cue: the walker beside him is driven on; a fan follows halfway to the next cue.
    e.x = e.px = s.player.x; e.z = e.pz = s.player.z + 7;
    w.x = w.px = e.x + 2; w.z = w.pz = e.z;
    still(e);
    e.cd[1] = 0;
    let fan = -1, cue = -1, shots = 0;
    for (let i = 0; i < 60 * 6 && fan < 0; i++) {
      run(s, 1 / 60);
      if (cue < 0 && e.sp?.kind === 'howl') cue = i;
      if (e.sp?.kind === 'fan' && e.sp.fired && fan < 0) { fan = i; shots = s.threats.shots.length; }
      if (cue >= 0 && w.state === 'dead') break;
    }
    expect(cue).toBeGreaterThanOrEqual(0);
    expect(w.buff).toBeGreaterThan(0);
    expect(fan).toBeGreaterThan(cue);
    expect(shots).toBe(THREAT.cue.shots);
    expect((fan - cue) / 60).toBeGreaterThan(THREAT.cue.every[0] / 2 - 0.2);
  });

  it('Der Conférencier calls „Tanz“ and „Kraftakt“ by turns (both in rage); his spotlight locks and throws applause', () => {
    const s = fresh();
    const e = put(s, 'conferencier', 0, 8);
    e.hp = e.maxHp = 1e6;
    still(e);
    e.cd = [99, 99, 0];
    const evs = run(s, BOSS.summon.wind + 0.6);
    expect(alive(s, 'scherbe')).toBe(BOSS.conferencier.dance);
    expect(alive(s, 'loge')).toBe(0);
    expect(notes(evs)).toContain('„Die nächste Nummer!“');
    e.cd[2] = 0;
    run(s, BOSS.summon.wind + 1.6);
    expect(alive(s, 'loge')).toBe(BOSS.conferencier.act);
    const r = fresh();
    const q = put(r, 'conferencier', 0, 8);
    q.hp = q.maxHp * 0.4;
    q.cd = [99, 99, 0];
    still(q);
    run(r, BOSS.summon.wind + 0.6);
    expect([alive(r, 'scherbe'), alive(r, 'loge')]).toEqual([BOSS.conferencier.dance, BOSS.conferencier.act]);
    expect(r.threats.spots.filter((p) => p.src === q.id)).toHaveLength(2);
    // The spot: one, it follows, locks after 0.6 s, flashes, then four applause circles, the first on it.
    const t = fresh();
    const c = put(t, 'conferencier', 0, 9);
    c.cd = [99, 99, 99];
    still(c);
    run(t, 1 / 60);
    expect(t.threats.spots).toHaveLength(1);
    const sp = t.threats.spots[0]!;
    sp.x = t.player.x; sp.z = t.player.z;
    expect(has(run(t, BOSS.wachdrohne.lock + 0.02), 'spotLock')).toBe(true);
    run(t, BOSS.wachdrohne.flash);
    const zones = t.threats.zones.filter((z) => z.kind === 'applause');
    expect(zones).toHaveLength(BOSS.conferencier.applause);
    expect(Math.hypot(zones[0]!.x - sp.x, zones[0]!.z - sp.z)).toBeLessThan(0.3);
    expect(t.threats.shots).toHaveLength(0);
    const hp = t.player.hp;
    run(t, BOSS.conferencier.applauseWind + 0.6, {}, false);
    expect(hp - t.player.hp).toBeGreaterThanOrEqual(t.stats.maxHp * BOSS.conferencier.applauseFloor - 1);
    // Stockstoß from 4.5 m, open after.
    expect(specials(fight(fresh(), 'conferencier', 24, 4.5))).toEqual(expect.arrayContaining(['summon', 'lunge']));
  });

  it('Der Ringvater enters with two Logenbrecher and takes half damage while one lives; at half life one more comes', () => {
    const s = plain();
    const e = put(s, 'ringvater', 0, 8);
    e.hp = e.maxHp = 1e6;
    still(e);
    e.cd = [99, 99, 99];
    const evs = run(s, BOSS.summon.wind + 0.6);
    expect(alive(s, 'loge')).toBe(BOSS.ringvater.escort);
    expect(notes(evs)).toContain('„Leibwache!“');
    s.events.length = 0;
    const half = strike(s, e, 100);
    expect(half).toBe(Math.round(100 * THREAT.armored));
    expect(notes(s.events)).toContain('„Erst die Leibwache!“');
    s.events.length = 0;
    strike(s, e, 100);
    expect(notes(s.events)).not.toContain('„Erst die Leibwache!“');
    for (const g of s.enemies) if (g.kind === 'loge') killEnemy(s, g);
    expect(strike(s, e, 100)).toBe(100);
    // At half life: one more Logenbrecher, guarded again.
    e.hp = e.maxHp * 0.4;
    run(s, BOSS.summon.wind + 2);
    expect(e.calls).toBe(2);
    expect(alive(s, 'loge')).toBe(BOSS.ringvater.rageGuards);
    expect(strike(s, e, 100)).toBe(Math.round(100 * THREAT.armored));
    // Schutzgeld: three Hetzer.
    const r = fresh();
    const q = put(r, 'ringvater', 0, 8);
    q.calls = 1;
    q.cd = [99, 99, 0];
    still(q);
    const out = run(r, BOSS.summon.wind + 0.6);
    expect(alive(r, 'runner')).toBe(BOSS.ringvater.adds);
    expect(notes(out)).toContain('„Schutzgeld!“');
  });

  it('Der Ringvater\'s Ringschlag covers 9.6 m along a marked line and comes twice in rage', () => {
    const R = BOSS.ringvater;
    const s = fresh();
    const e = put(s, 'ringvater', 0, 9);
    e.hp = e.maxHp = 1e6;
    e.calls = 1;
    e.cd = [0, 99, 99];
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('charge');
    const z0 = e.z;
    const evs = run(s, R.wind + R.time + 0.02, {}, false);
    expect(z0 - e.z).toBeCloseTo(R.speed * R.time, 0);
    expect(has(evs, 'playerHit')).toBe(true);
    expect(e.open).toBeGreaterThan(R.open - 0.1);
    const r = fresh();
    const q = put(r, 'ringvater', 0, 9);
    q.hp = q.maxHp * 0.4;
    q.calls = 2;
    q.cd = [0, 99, 99];
    const out = run(r, R.wind + R.time + R.rageGap + 0.1);
    expect(specials(out).filter((k) => k === 'charge')).toHaveLength(2);
    // The first one has no opening; the second does.
    run(r, R.wind + R.time + 0.05);
    expect(q.open).toBeGreaterThan(R.open - 0.2);
  });

  it('Das Spiegelpaar: the reflection stands at the point reflection through the centre, cannot be hurt and dies with her', () => {
    const s = plain();
    const e = put(s, 'spiegelpaar', 0, 6);
    e.hp = e.maxHp = 1e6;
    e.cd = [99, 99, 99];
    still(e);
    run(s, 1 / 60);
    const m = s.enemies.find((q) => q.kind === 'spiegelbild')!;
    expect(m.mirrorOf).toBe(e.id);
    expect(e.pair).toBe(m.id);
    const c = m.mirror!;
    expect(Math.hypot(m.x - (2 * c.x - e.x), m.z - (2 * c.z - e.z))).toBeLessThan(0.05);
    // She moves; the reflection follows to the new point.
    e.x += 3;
    run(s, 1);
    expect(Math.hypot(m.x - (2 * c.x - e.x), m.z - (2 * c.z - e.z))).toBeLessThan(0.1);
    // No damage, a note at most every 3 s; no target for powers, no add, no wave holder.
    s.events.length = 0;
    expect(strike(s, m, 500)).toBe(0);
    expect(strike(s, m, 500)).toBe(0);
    expect(notes(s.events).filter((t) => t === 'Nur ein Spiegelbild')).toHaveLength(1);
    expect(m.hp).toBe(m.maxHp);
    expect(aliveCount(s)).toBe(1);
    // Dies with her, without a kill.
    const kills = s.kills;
    killEnemy(s, e);
    expect(m.state).toBe('dead');
    expect(s.kills).toBe(kills + 1);
  });

  it('Das Spiegelpaar: both mark a line at the hero (Doppelpirouette); the Tausch swaps the two and keeps her life', () => {
    const S = BOSS.spiegelpaar;
    const s = fresh();
    const e = put(s, 'spiegelpaar', 0, 4.5);
    e.hp = e.maxHp = 1e6;
    e.cd = [0, 99, 99];
    still(e);
    stepSim(s, NO_INPUT);
    const m = s.enemies.find((q) => q.kind === 'spiegelbild')!;
    expect(e.sp?.kind).toBe('lunge');
    expect(m.sp?.kind).toBe('lunge');
    expect(m.sp!.mul).toBe(S.mirrorDamage);
    // Both lines point at the hero.
    for (const b of [e, m]) {
      const d = Math.hypot(s.player.x - b.x, s.player.z - b.z);
      expect(b.sp!.dx * (s.player.x - b.x) / d + b.sp!.dz * (s.player.z - b.z) / d).toBeGreaterThan(0.99);
    }
    expect(has(run(s, S.wind + S.time + 0.1, {}, false), 'playerHit')).toBe(true);
    // Tausch.
    const t = fresh();
    const a = put(t, 'spiegelpaar', 0, 6);
    a.cd = [99, 99, 99];
    still(a);
    run(t, 1 / 60);
    const b = t.enemies.find((q) => q.kind === 'spiegelbild')!;
    a.hp = a.maxHp * 0.7;
    const ha = a.hp, pa = { x: a.x, z: a.z }, pb = { x: b.x, z: b.z };
    a.cd[2] = 0;
    stepSim(t, NO_INPUT);
    expect(a.sp?.kind).toBe('swap');
    run(t, S.swapWind + 0.02);
    expect(Math.hypot(a.x - pb.x, a.z - pb.z)).toBeLessThan(0.2);
    expect(Math.hypot(b.x - pa.x, b.z - pa.z)).toBeLessThan(0.3);
    expect(a.hp).toBe(ha);
    expect(specials(fight(fresh(), 'spiegelpaar', 30, 4.5))).toEqual(expect.arrayContaining(['lunge', 'barrage', 'swap']));
  });

  it('Die Diamantene Diva: no rage; a tier breaks at 66 and 33 % (one ring, her blades fall, open 2 s); one, two, three fans and lines', () => {
    const D = BOSS.diva;
    const s = fresh();
    const e = put(s, 'diva', 0, 7);
    still(e);
    e.cd = [0, 99, 99];
    stepSim(s, NO_INPUT);
    expect(e.sp?.kind).toBe('fan');
    run(s, D.fanWind + 0.02);
    expect(s.threats.shots).toHaveLength(D.blades);
    // Tier 1: blades fall, the curtain ring, open 2 s; the next fan comes twice.
    e.hp = e.maxHp * 0.6;
    run(s, 1 / 60);
    expect(e.still).toBe(1);
    expect(s.threats.shots.filter((q) => q.src === e.id)).toHaveLength(0);
    expect(e.rage).toBe(false);
    run(s, 1.6);
    expect(s.threats.waves).toHaveLength(1);
    expect(s.threats.waves[0]!.max).toBe(D.curtain);
    run(s, 0.5);
    expect(e.open).toBeGreaterThan(D.curtainOpen - 0.5);
    const fans = (sim: Sim, q: Enemy): number => {
      sim.threats.shots.length = 0;
      q.state = 'chase'; q.open = 0; q.gap = 0; q.queue = undefined;
      q.cd = [0, 99, 99];
      // Fans thrown (a blade may already have hit a courtyard prop, so count the throws).
      return run(sim, D.fanWind + 2 * D.fanGap + 0.1).filter((v) => v.type === 'enemyShot').length;
    };
    expect(fans(s, e)).toBe(2);
    e.hp = e.maxHp * 0.3;
    const out = run(s, 1 / 60);
    expect(notes(out)).toContain('„Der Vorhang fällt“');
    expect(fans(s, e)).toBe(3);
    // Prism lines: one, an X, three.
    const lines = (tier: number): number => {
      const t = fresh();
      const q = put(t, 'diva', 0, 7);
      still(q);
      q.hp = q.maxHp = 1e6;
      q.still = tier;
      q.cd = [99, 0, 99];
      stepSim(t, NO_INPUT);
      return t.threats.zones.filter((z) => z.kind === 'prism').length;
    };
    expect([lines(0), lines(1), lines(2)]).toEqual([1, 2, 3]);
    // Zugabe: three dancers; in phase 3 a Souffleur too.
    const z = fresh();
    const v = put(z, 'diva', 0, 8);
    v.hp = v.maxHp = 1e6;
    v.still = 2;
    v.cd = [99, 99, 0];
    const zn = run(z, BOSS.summon.wind + 0.6);
    expect([alive(z, 'scherbe'), alive(z, 'souffleur')]).toEqual([D.adds, 1]);
    expect(notes(zn)).toContain('„Zugabe!“');
  });

  it('the prism ray hits only inside its strip, once, after its wind-up, and then she stands open', () => {
    const D = BOSS.diva;
    const s = fresh();
    const e = put(s, 'diva', 0, 7);
    e.hp = e.maxHp = 1e6;
    still(e);
    e.cd = [99, 0, 99];
    stepSim(s, NO_INPUT);
    const z = s.threats.zones.find((q) => q.kind === 'prism')!;
    expect(z.line!.width).toBe(D.prismWidth);
    // Far along the line, inside the strip: hit. Beside it: not.
    expect(inZone(z, z.x + z.line!.dx * 12, z.z + z.line!.dz * 12, 0)).toBe(true);
    expect(inZone(z, z.x + z.line!.dz * 1.2, z.z - z.line!.dx * 1.2, 0)).toBe(false);
    expect(has(run(s, D.prismWind - 0.05, {}, false), 'playerHit')).toBe(false);
    const hits = run(s, D.prismTime + 0.1, {}, false).filter((q) => q.type === 'playerHit');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.damage).toBeGreaterThanOrEqual(s.stats.maxHp * D.prismFloor - 1);
    run(s, 0.1);
    expect(e.open).toBeGreaterThan(D.prismOpen - 0.4);
    // Stepping 1.5 m sideways during the wind-up: no hit.
    const t = fresh();
    const q = put(t, 'diva', 0, 7);
    still(q);
    q.cd = [99, 0, 99];
    stepSim(t, NO_INPUT);
    t.player.x += 1.5;
    expect(has(run(t, D.prismWind + D.prismTime + 0.1), 'playerHit')).toBe(false);
  });

  it('every Charlottenburg boss but the Diva rages below half life; life and hit sit on the ladder', () => {
    for (const kind of ['conferencier', 'ringvater', 'spiegelpaar', 'diva'] as const) {
      const s = fresh();
      const e = put(s, kind, 0, 9);
      e.hp = e.maxHp * 0.45;
      expect(run(s, 0.1).filter((q) => q.type === 'bossRage'), kind).toHaveLength(kind === 'diva' ? 0 : 1);
    }
    expect([ENEMIES.conferencier.hp, ENEMIES.ringvater.hp, ENEMIES.spiegelpaar.hp, ENEMIES.diva.hp]).toEqual([1000, 2200, 3200, 4400]);
    expect([ENEMIES.conferencier.damage, ENEMIES.ringvater.damage, ENEMIES.spiegelpaar.damage, ENEMIES.diva.damage]).toEqual([26, 30, 28, 34]);
  });

  it('no Charlottenburg hit takes more than 45 % of max life, even at ten times the damage (the reflection too)', () => {
    for (const kind of ['scherbe', 'loge', 'souffleur', 'conferencier', 'ringvater', 'spiegelpaar', 'diva'] as const) {
      const s = fresh();
      s.shards = true;
      const e = spawnEnemy(s, s.player.x, s.player.z + (kind === 'souffleur' ? 7 : 3), kind, 1, 10);
      e.hp = e.maxHp = 1e6;
      // The Souffleur keeps back and strafes behind the courtyard props; here he stands in the open.
      if (kind === 'souffleur') still(e);
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

describe('lying guards get up first (P22)', () => {
  it('a guard woken at 1 m neither winds up nor strikes before it stands', () => {
    const s = fresh();
    const e = put(s, 'runner', 1, 0);
    e.sleep = 4; e.pose = 'lying';
    let windAt = -1;
    for (let i = 0; i < 120 && windAt < 0; i++) {
      for (const ev of run(s, 1 / 60)) if (ev.type === 'enemyWindup' && ev.id === e.id) windAt = i / 60;
    }
    expect(windAt).toBeGreaterThanOrEqual(THREAT.rise);
    expect(e.rise).toBe(0);
  });

  it('a hidden guard has no get-up', () => {
    const s = fresh();
    const e = put(s, 'runner', 1, 0);
    e.sleep = 4; e.pose = 'hidden';
    run(s, 1 / 60);
    expect(e.rise).toBeUndefined();
  });
});

describe('Auto-Angriff (2D autoAtk)', () => {
  it('picks an awake enemy in reach, not a sleeping or a far one', () => {
    const s = fresh();
    const far = put(s, 'walker', 6, 0);
    expect(autoAttackTarget(s)).toBeNull();
    const sleeper = put(s, 'walker', 0, 1.5);
    sleeper.sleep = 4;
    expect(autoAttackTarget(s)).toBeNull();
    const near = put(s, 'walker', -1.8, 0);
    expect(autoAttackTarget(s)).toBe(near);
    s.stats.kind = 'sling';
    far.x = s.player.x + 1.5; near.x = s.player.x - 10;
    expect(autoAttackTarget(s)).toBe(far);
    far.wake = 2;
    expect(autoAttackTarget(s)).toBe(near);
  });
});
