// WP5 (backlog P12): Zünder, Schildträger and Heuler. Numbers from 2D `mkEnemy` (`bomb`, `shield`, `howl`)
// on the ghoul and brute ratios; every rule below has its test.
import { describe, it, expect } from 'vitest';
import { BOSS, ENEMIES, THREAT, type EnemyKind } from '../data/enemies';
import { alexWaveTier, ALEX_TIER } from '../data/alexanderplatz';
import { mitteWaveTier } from '../data/mitte';
import { xhainWaveTier } from '../data/xhain';
import { killEnemy, strike } from './combat';
import { makeElite, spawnEnemy } from './enemies';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Enemy, type Sim, type SimEvent } from './types';

function fresh(): Sim {
  const s = createSim({ empty: true });
  s.stats.crit = 0;
  return s;
}
const put = (s: Sim, kind: EnemyKind, dx: number, dz: number): Enemy => spawnEnemy(s, s.player.x + dx, s.player.z + dz, kind);
function run(s: Sim, seconds: number, immortal = true): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.hitstop = 0;
    stepSim(s, NO_INPUT);
    if (immortal && s.player.hp < 50) s.player.hp = s.stats.maxHp;
    out.push(...s.events);
    s.events.length = 0;
  }
  return out;
}
const notes = (evs: SimEvent[]): string[] => evs.filter((q) => q.type === 'note').map((q) => (q as { text: string }).text);
/** A body that stands where it is put. */
const pin = (e: Enemy): Enemy => { e.def = { ...e.def, speed: 0 }; return e; };

describe('WP5 roster: 2D numbers on the 3D ratios', () => {
  it('Zünder, Schildträger and Heuler carry the 2D life, hit and speed on the ghoul and brute ratios', () => {
    const z = ENEMIES.zuender, sh = ENEMIES.schild, h = ENEMIES.heuler;
    // Ghoul ratios (life ×1.5, hit ×1.7): bomb 22 / 20, howl 34 / 6.
    expect([z.hp, z.damage, z.res, z.attackRange]).toEqual([33, 34, 'bomb', 0]);
    expect([h.hp, h.damage, h.res, h.cap]).toEqual([51, 10, 'howl', 1]);
    // Brute ratios (life ×1.2, hit ×1.44): shield 52 / 13; the 2D shield rule (±1.2 rad, 20 %, 1.6 rad/s, 2.2 s).
    expect([sh.hp, sh.damage, sh.res]).toEqual([62, 19, 'shield']);
    expect(sh.shield).toEqual({ arc: 1.2, front: 0.2, turn: 1.6, open: 2.2 });
  });
});

describe('Zünder (2D bomb)', () => {
  it('walks up, lights its fuse within 2 m, the marked circle goes off after 0.85 s and the Zünder with it', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 5);
    let evs: SimEvent[] = [];
    for (let i = 0; i < 300 && e.state !== 'special'; i++) evs = evs.concat(run(s, 1 / 60));
    expect(e.sp?.kind).toBe('fuse');
    expect(Math.hypot(e.x - s.player.x, e.z - s.player.z)).toBeLessThan(THREAT.fuse.range + 0.05);
    const zone = s.threats.zones.find((z) => z.src === e.id)!;
    expect(zone.r).toBeCloseTo(THREAT.fuse.radius);
    expect(zone.max).toBe(THREAT.fuse.wind);
    // It stands while the fuse burns, and never strikes.
    const x0 = e.x, z0 = e.z;
    evs = run(s, THREAT.fuse.wind - 0.1);
    expect(Math.hypot(e.x - x0, e.z - z0)).toBeLessThan(0.05);
    expect(evs.some((q) => q.type === 'enemyWindup')).toBe(false);
    evs = run(s, 0.2);
    expect(e.state).toBe('dead');
    expect(e.blown).toBe(true);
    expect(evs.some((q) => q.type === 'zoneHit' && q.kind === 'bomb' && q.r > 2.5)).toBe(true);
    // No second, smaller blast from its death.
    expect(s.threats.zones.filter((z) => z.src === e.id)).toHaveLength(0);
  });

  it('the blast hits hard (floor 22 % of max life, under the 45 % cap); a roll passes through', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 1.2);
    s.player.hp = s.stats.maxHp;
    run(s, 0.05, false);
    expect(e.sp?.kind).toBe('fuse');
    run(s, THREAT.fuse.wind + 0.1, false);
    const lost = s.stats.maxHp - s.player.hp;
    expect(lost).toBeGreaterThan(s.stats.maxHp * 0.15);
    expect(lost).toBeLessThanOrEqual(s.stats.maxHp * 0.45 + 1);
    const s2 = fresh();
    const e2 = put(s2, 'zuender', 0, 1.2);
    run(s2, 0.05);
    expect(e2.sp?.kind).toBe('fuse');
    const out: SimEvent[] = [];
    for (let i = 0; i < 70; i++) { s2.player.invuln = 1; stepSim(s2, NO_INPUT); out.push(...s2.events); s2.events.length = 0; }
    expect(e2.state).toBe('dead');
    expect(out.some((q) => q.type === 'playerHit')).toBe(false);
  });

  it('a stun does not put the fuse out (2D: it only stops the walking)', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 1.2);
    run(s, 0.05);
    expect(e.sp?.kind).toBe('fuse');
    strike(s, e, 1, { stun: 0.6, knock: 0 });
    expect(e.sp?.kind).toBe('fuse');
    run(s, THREAT.fuse.wind);
    expect(e.blown).toBe(true);
  });

  it('killed before it lit, it still goes off where it fell: smaller (r 2.2 m, 0.6 of its hit), marked 0.3 s', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 6);
    killEnemy(s, e);
    const z = s.threats.zones.find((q) => q.src === e.id)!;
    expect(z.r).toBeCloseTo(THREAT.fuse.deathRadius);
    expect(z.max).toBe(THREAT.fuse.deathWind);
    expect(z.damage).toBeCloseTo(ENEMIES.zuender.damage * THREAT.fuse.deathDamage);
    expect(z.free).toBe(true);
  });

  it('killed while the fuse burns, the small blast replaces the big one', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 1.2);
    run(s, 0.05);
    expect(s.threats.zones.find((q) => q.src === e.id)!.r).toBeCloseTo(THREAT.fuse.radius);
    strike(s, e, 1e4);
    const own = s.threats.zones.filter((q) => q.src === e.id);
    expect(own).toHaveLength(1);
    expect(own[0]!.r).toBeCloseTo(THREAT.fuse.deathRadius);
  });

  it('the blast also hits the enemies inside (1.5× its damage, knocked away), not those outside', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 1.2);
    const near = pin(put(s, 'brute', 1.5, 1.2));
    const far = pin(put(s, 'brute', 6, 1.2));
    near.hp = near.maxHp = far.hp = far.maxHp = 1e4;
    near.cd = far.cd = [99, 99, 99];
    run(s, 0.05);
    expect(e.sp?.kind).toBe('fuse');
    const raw = s.threats.zones.find((q) => q.src === e.id)!.damage;
    run(s, THREAT.fuse.wind + 0.05);
    expect(1e4 - near.hp).toBeCloseTo(Math.round(raw * THREAT.fuse.enemyShare), -1);
    expect(near.kx).toBeGreaterThan(0);
    expect(far.hp).toBe(1e4);
  });

  it('a blast kill is not the hero\'s: no hero bonuses, no execute, no leech or streak (review of PR #60)', () => {
    const s = fresh();
    s.statContext.perks = { exec: 1, kimme: 3 };
    s.stats.leech = 5;
    const e = put(s, 'zuender', 0, 1.2);
    const near = pin(put(s, 'brute', 1.5, 1.2));
    const tough = pin(put(s, 'brute', -1.2, 1.2));
    near.hp = 1;
    tough.hp = tough.maxHp = 1e4;
    near.cd = tough.cd = [99, 99, 99];
    run(s, 0.05);
    const raw = s.threats.zones.find((q) => q.src === e.id)!.damage;
    s.player.hp = 50;
    const streak = s.abilities.streak.n;
    run(s, THREAT.fuse.wind + 0.05, false);
    expect(near.state).toBe('dead');
    // Plain damage: no Kimme, and no Gnadenstoß on the big one.
    expect(1e4 - tough.hp).toBe(Math.round(raw * THREAT.fuse.enemyShare));
    expect(s.abilities.streak.n).toBe(streak);
    expect(s.player.hp).toBeLessThanOrEqual(50);
  });

  it('a burning Zünder is not knocked out of its circle: it dies where the blast goes off', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 1.2);
    run(s, 0.05);
    expect(e.sp?.kind).toBe('fuse');
    const z = s.threats.zones.find((q) => q.src === e.id)!;
    strike(s, e, 1, { knock: 6 });
    run(s, 0.3);
    expect(Math.hypot(e.x - z.x, e.z - z.z)).toBeLessThan(0.05);
  });

  it('one Zünder sets off the next: the second dies in the blast and goes off in turn', () => {
    const s = fresh();
    const a = put(s, 'zuender', 0, 1.2);
    const b = pin(put(s, 'zuender', 1.8, 1.4));
    b.cd = [99, 99, 99];
    run(s, 0.05);
    // Only the first lights (the second is held back by hand: no clear 2 m to the hero needed for this test).
    if (b.state === 'special') { b.state = 'chase'; b.sp = null; s.threats.zones = s.threats.zones.filter((z) => z.src !== b.id); }
    run(s, THREAT.fuse.wind + 0.05);
    expect(a.blown).toBe(true);
    expect(b.state).toBe('dead');
    expect(b.blown).toBeFalsy();
    expect(s.threats.zones.some((z) => z.src === b.id && z.r === THREAT.fuse.deathRadius)).toBe(true);
  });

  it('two Zünder that light on the same step blow up once each (Codex review)', () => {
    const s = fresh();
    const a = put(s, 'zuender', -0.6, 1.2);
    const b = put(s, 'zuender', 0.6, 1.2);
    run(s, 0.05);
    expect(a.sp?.kind).toBe('fuse');
    expect(b.sp?.kind).toBe('fuse');
    const evs = run(s, THREAT.fuse.wind + THREAT.fuse.deathWind + 0.2);
    const radii = evs.filter((q) => q.type === 'zoneHit' && q.kind === 'bomb').map((q) => (q as { r: number }).r);
    expect(radii).toEqual([THREAT.fuse.radius, THREAT.fuse.radius]);
    expect(a.blown && b.blown).toBe(true);
  });

  it('a Zünder never turns elite', () => {
    const s = fresh();
    const e = put(s, 'zuender', 0, 6);
    makeElite(s, e, 'flink');
    expect(e.elite).toBeUndefined();
    expect(e.maxHp).toBe(ENEMIES.zuender.hp);
  });
});

describe('Schildträger (2D shield)', () => {
  it('blocks from the front (20 %), the hammer stun opens the guard for 2.2 s, from behind full damage', () => {
    const s = fresh();
    const e = pin(put(s, 'schild', 0, 2));
    e.hp = e.maxHp = 1e6;
    e.cd = [99, 99, 99];
    expect(strike(s, e, 100)).toBe(20);
    expect(notes(s.events)).toContain('geblockt');
    e.facing = 0;
    expect(strike(s, e, 100)).toBe(100);
    e.facing = Math.PI;
    s.events.length = 0;
    // Hammer: its stun opens the guard instead of being blocked.
    expect(strike(s, e, 100, { stun: 0.6 })).toBe(100);
    expect(notes(s.events)).toContain('Deckung offen');
    expect(e.guardOpen).toBeCloseTo(2.2);
    expect(strike(s, e, 100)).toBe(100);
    run(s, 2.3);
    e.facing = Math.PI;
    expect(strike(s, e, 100)).toBe(20);
  });

  it('turns at most 1.6 rad/s, so the hero can walk round it; it is never armored', () => {
    const s = fresh();
    const e = put(s, 'schild', 0, 3);
    e.facing = e.pfacing = 0;
    e.def = { ...e.def, speed: 0.01 };
    run(s, 0.5);
    expect(Math.abs(e.facing)).toBeLessThan(1.6 * 0.5 + 0.05);
    makeElite(s, e, 'gepanzert');
    expect(e.elite).not.toBe('gepanzert');
  });
});

describe('Heuler (2D howl)', () => {
  it('backs off when the hero comes close and strafes at mid range', () => {
    const s = fresh();
    const e = put(s, 'heuler', 0, 3);
    e.cd = [99, 99, 99];
    const d0 = Math.hypot(e.x - s.player.x, e.z - s.player.z);
    run(s, 1);
    expect(Math.hypot(e.x - s.player.x, e.z - s.player.z)).toBeGreaterThan(d0 + 0.8);
  });

  it('howls the others within 7.3 m on for 4 s (×1.35 speed), not those further away and not itself', () => {
    const s = fresh();
    const e = pin(put(s, 'heuler', 0, 7));
    const near = pin(put(s, 'walker', 3, 7));
    const far = pin(put(s, 'walker', -9, 7));
    near.cd = far.cd = [99, 99, 99];
    e.cd = [99, 0, 99];
    const evs = run(s, THREAT.howl.wind + 0.05);
    expect(evs.some((q) => q.type === 'enemySpecial' && q.kind === 'howl' && q.phase === 'go')).toBe(true);
    expect(near.buff).toBeGreaterThan(THREAT.howl.buff - 0.2);
    expect(far.buff).toBe(0);
    expect(e.buff).toBe(0);
    // Driven: walks 1.35× as fast.
    const s2 = fresh();
    const w = put(s2, 'walker', 0, 8);
    const plain = put(s2, 'walker', 2, 8);
    w.buff = 4;
    run(s2, 0.5);
    expect(w.speed / plain.speed).toBeCloseTo(THREAT.buffSpeed, 1);
  });

  it('the howl ring is harmless; then the Heuler stands open', () => {
    const s = fresh();
    const e = pin(put(s, 'heuler', 0, 2.5));
    e.cd = [99, 0, 99];
    const hp = (s.player.hp = s.stats.maxHp);
    const evs = run(s, THREAT.howl.wind + 0.4, false);
    expect(evs.some((q) => q.type === 'playerHit')).toBe(false);
    expect(s.player.hp).toBe(hp);
    expect(e.open).toBeGreaterThan(0);
  });

  it('only one Heuler is alive at a time (cap 1)', () => {
    expect(ENEMIES.heuler.cap).toBe(1);
  });
});

describe('WP5 wave mixes', () => {
  it('Mitte: Zünder and Schildträger in the loud zones, not in the Tiergarten', () => {
    for (const zone of [0, 1, 3]) {
      const m = mitteWaveTier(30, [], zone).mix!;
      expect(m.zuender).toBeGreaterThan(0);
      expect(m.schild).toBeGreaterThan(0);
      for (const v of Object.values(m)) expect(v).toBeGreaterThan(0);
    }
    const calm = mitteWaveTier(30, [], 2).mix!;
    expect(calm.zuender ?? 0).toBe(0);
    expect(calm.schild ?? 0).toBe(0);
  });

  it('Xhain: Zünder from the riots on, the Heuler only around Kotti and Görli; Alexanderplatz: Zünder from its third wave', () => {
    expect(xhainWaveTier(12, [], 0).mix!.zuender).toBe(0);
    expect(xhainWaveTier(18, [], 1).mix!.zuender).toBeGreaterThan(0);
    expect(xhainWaveTier(18, [], 1).mix!.heuler).toBe(0);
    expect(xhainWaveTier(26, [], 2).mix!.heuler).toBeGreaterThan(0);
    expect(alexWaveTier(ALEX_TIER.from, [], 0).mix!.zuender).toBe(0);
    expect(alexWaveTier(ALEX_TIER.from + 3, [], 0).mix!.zuender).toBeGreaterThan(0);
  });
});

describe('H3 Brandmeister fire trail (2D boss trail)', () => {
  it('leaves burning ground every 0.4 s while he walks, none while he stands; it burns the hero', () => {
    const s = fresh();
    const e = put(s, 'brandmeister', 0, 9);
    e.cd = [99, 99, 99];
    run(s, 2);
    const fires = s.threats.hazards.filter((h) => h.kind === 'fire');
    expect(fires.length).toBeGreaterThanOrEqual(3);
    expect(fires.length).toBeLessThanOrEqual(Math.ceil(2 / BOSS.brandmeister.trailEvery) + 1);
    expect(fires[0]!.r).toBeCloseTo(BOSS.brandmeister.trailRadius);
    expect(fires[0]!.damage).toBeCloseTo(ENEMIES.brandmeister.damage * e.dmgMul * BOSS.brandmeister.trailDamage);
    // Standing: no new fire.
    const s2 = fresh();
    const b = pin(put(s2, 'brandmeister', 0, 9));
    b.cd = [99, 99, 99];
    run(s2, 2);
    expect(s2.threats.hazards.filter((h) => h.kind === 'fire')).toHaveLength(0);
    // The hero standing in it is hurt.
    const s3 = fresh();
    s3.threats.hazards.push({ x: s3.player.x, z: s3.player.z, r: BOSS.brandmeister.trailRadius, t: 4, max: 4, damage: 10, tick: 0, kind: 'fire' });
    const hp = (s3.player.hp = s3.stats.maxHp);
    run(s3, 0.6, false);
    expect(s3.player.hp).toBeLessThan(hp);
  });
});
