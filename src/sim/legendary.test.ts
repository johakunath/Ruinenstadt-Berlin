import { describe, it, expect } from 'vitest';
import { LEGENDARY_POWERS, type LegendaryId, type WeaponKindId } from '../data/items';
import { hasL, hurtPlayer, strike } from './combat';
import { spawnEnemy } from './enemies';
import { setLoadout } from './loadout';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Enemy, type Sim } from './types';

/** A hero whose talisman is the legendary `id` (2D `hasL`: any equipped item with that base). */
function fresh(id: LegendaryId, kind: WeaponKindId = 'blade'): Sim {
  const s = createSim({ empty: true });
  const w = { ...s.equipment.w!, kind };
  setLoadout(s, { w, t: { id: 9, slot: 't', kind: 'krit', base: id, name: id, rarity: 3, value: 0, itemLevel: 1, affixes: [] } });
  s.player.facing = 0;
  s.stats.crit = 0;
  return s;
}
function dummy(s: Sim, dx: number, dz: number, hp = 100000, kind: 'walker' | 'feldwebel' = 'walker'): Enemy {
  const e = spawnEnemy(s, s.player.x + dx, s.player.z + dz, kind);
  e.hp = e.maxHp = hp;
  // A training dummy: no element resistance and no class (D9 bonus), so rules are measured plain.
  e.def = { ...e.def, speed: 0, attackRange: 0, knockbackTaken: 0, res: 'none', ai: 'melee', classes: [] };
  return e;
}
const run = (s: Sim, steps: number, inp: Partial<typeof NO_INPUT> = {}): void => { for (let i = 0; i < steps; i++) { s.hitstop = 0; stepSim(s, { ...NO_INPUT, ...inp }); } };
const lost = (e: Enemy): number => e.maxHp - e.hp;

describe('legendary powers (2D hasL)', () => {
  it('every legendary with a power text has a rule here', () => {
    const tested: LegendaryId[] = ['turm', 'mauer', 'ring', 'spaeti', 'panzer', 'herz', 'zitklinge', 'pbrecher', 'kraehe', 'rattenmantel', 'ritter', 'auge', 'siegsp', 'bassarm', 'pickel', 'kiezbox', 'schaffner', 'weltuhr', 'bestellung'];
    expect(new Set(tested)).toEqual(new Set(Object.keys(LEGENDARY_POWERS)));
    expect(hasL(fresh('turm'), 'turm')).toBe(true);
    expect(hasL(fresh('turm'), 'auge')).toBe(false);
  });
  it('Fernsehturm: a crit bursts into fire on the neighbors', () => {
    const s = fresh('turm'), e = dummy(s, 0, 2), n = dummy(s, 1.5, 2), far = dummy(s, 6, 2);
    strike(s, e, 100);
    expect(lost(n)).toBe(0);
    strike(s, e, 100, { crit: true });
    expect(lost(n)).toBe(60);
    expect(n.bdps).toBeCloseTo(30);
    expect(lost(far)).toBe(0);
  });
  it('Mauerstück: every fourth melee attack sends an acid wave', () => {
    const s = fresh('mauer'), e = dummy(s, 3.5, 0);
    for (let i = 0; i < 3; i++) { s.player.state = 'move'; s.player.chain = null; run(s, 1, { attack: true }); run(s, 30); }
    expect(lost(e)).toBe(0);
    s.player.state = 'move'; s.player.chain = null;
    run(s, 1, { attack: true });
    run(s, 40);
    expect(lost(e)).toBe(12);
    expect(e.acid).toBeGreaterThan(0);
  });
  it('Ring der Ringbahn: a shot jumps once to the nearest other enemy for 80%', () => {
    const s = fresh('ring', 'sling'), a = dummy(s, 0, 5), b = dummy(s, 3, 5);
    run(s, 1, { attack: true });
    run(s, 80);
    expect(lost(a)).toBe(9);
    expect(lost(b)).toBe(7);
  });
  it('Krähenfeder: shots slow to 60% for 2 s', () => {
    const s = fresh('kraehe', 'sling'), e = dummy(s, 0, 5);
    run(s, 1, { attack: true });
    run(s, 40);
    expect(e.slow).toBeGreaterThan(1);
    const a = spawnEnemy(s, s.player.x + 4, s.player.z + 4, 'walker'), b = spawnEnemy(s, s.player.x - 4, s.player.z + 4, 'walker');
    a.slow = 2;
    run(s, 1);
    expect(a.speed / b.speed).toBeCloseTo(0.6);
  });
  it('Panzerplatte: about one hit in five is blocked', () => {
    const s = fresh('panzer');
    let blocked = 0;
    for (let i = 0; i < 500; i++) { s.player.hp = 100; s.player.invuln = 0; if (!hurtPlayer(s, null, 5, 1, 0)) blocked++; }
    expect(blocked).toBeGreaterThan(70);
    expect(blocked).toBeLessThan(135);
  });
  it('Herz der Spree: once per run back at 40%', () => {
    const s = fresh('herz');
    s.player.hp = 3;
    hurtPlayer(s, null, 30, 1, 0);
    expect(s.player.hp).toBe(Math.round(s.stats.maxHp * 0.4));
    s.player.invuln = 0; s.player.hp = 3;
    hurtPlayer(s, null, 30, 1, 0);
    expect(s.player.state).toBe('dead');
  });
  it('Zitadellenklinge and Schaffnerkelle: kills shorten power and dodge cooldown', () => {
    const z = fresh('zitklinge');
    z.abilities.powerCd = 5;
    strike(z, dummy(z, 0, 2, 1), 5);
    expect(z.abilities.powerCd).toBeCloseTo(4);
    const k = fresh('schaffner');
    k.player.dodgeCd = 0.28;
    strike(k, dummy(k, 0, 2, 1), 5);
    expect(k.player.dodgeCd).toBeCloseTo(0.28 - 0.1);
  });
  it('Presslufthammer: a crit kill sends a stunning ring, a normal kill does not', () => {
    const s = fresh('pbrecher'), n = dummy(s, 1.5, 3);
    strike(s, dummy(s, 0, 3, 1), 5);
    run(s, 12);
    expect(lost(n)).toBe(0);
    strike(s, dummy(s, 0, 3, 1), 5, { crit: true });
    run(s, 12);
    expect(lost(n)).toBe(7);
    expect(n.state).toBe('stagger');
  });
  it('Rattenmantel: a hit taken sends an acid wave, at most every 1.5 s', () => {
    const s = fresh('rattenmantel'), e = dummy(s, 2, 0);
    hurtPlayer(s, null, 5, 1, 0);
    s.player.invuln = 0;
    hurtPlayer(s, null, 5, 1, 0);
    expect(s.abilities.shocks).toHaveLength(1);
    run(s, 20);
    expect(lost(e)).toBe(12);
    expect(e.acid).toBeGreaterThan(0);
  });
  it('Rittersporn: the ground shakes where a dodge ends', () => {
    const s = fresh('ritter'), e = dummy(s, 0, 5);
    run(s, 1, { dodge: true, moveZ: 1 });
    run(s, 30);
    expect(lost(e)).toBe(7);
  });
  it('Auge: +25% against elites and bosses; Pickelhaube: they heal 15% when they die', () => {
    const s = fresh('auge'), n = dummy(s, 2, 0), b = dummy(s, -2, 0, 100000, 'feldwebel');
    expect(strike(s, n, 100)).toBe(100);
    expect(strike(s, b, 100)).toBe(125);
    const p = fresh('pickel'), boss = dummy(p, 0, 2, 1, 'feldwebel');
    p.player.hp = 20;
    strike(p, boss, 5);
    expect(p.player.hp).toBeCloseTo(35);
  });
  it('Siegessäule: every attack also sends a burning golden blade', () => {
    const s = fresh('siegsp'), e = dummy(s, 0, 7);
    run(s, 1, { attack: true });
    run(s, 50);
    expect(lost(e)).toBeGreaterThanOrEqual(5);
    expect(lost(e)).toBeLessThan(8);
    expect(e.burn).toBeGreaterThan(0);
  });
  it('Bassarm: every fifth hit chains to four; Kiezbox: every fourth hit stuns', () => {
    const s = fresh('bassarm'), e = dummy(s, 0, 2), near = [1, 2, 3, 4, 5].map((i) => dummy(s, i * 0.8, 2));
    for (let i = 0; i < 4; i++) strike(s, e, 100);
    expect(near.every((t) => lost(t) === 0)).toBe(true);
    strike(s, e, 100);
    expect(near.filter((t) => lost(t) === 60)).toHaveLength(4);
    const k = fresh('kiezbox'), t = dummy(k, 0, 2);
    for (let i = 0; i < 3; i++) strike(k, t, 10, { feel: 'none' });
    expect(t.state).not.toBe('stagger');
    strike(k, t, 10, { feel: 'none' });
    expect(t.state).toBe('stagger');
    expect(t.staggerDur).toBeCloseTo(0.5);
  });
  it('Die Letzte Bestellung (M18): every third hit spills hot tea (fire, half the hit) on enemies within 2.5 m', () => {
    const s = fresh('bestellung', 'hammer'), e = dummy(s, 0, 2), n = dummy(s, 1.5, 2), far = dummy(s, 4, 2);
    for (let i = 0; i < 2; i++) strike(s, e, 100, { feel: 'none' });
    expect(lost(n)).toBe(0);
    strike(s, e, 100, { feel: 'none' });
    expect(lost(n)).toBe(50);
    expect(lost(far)).toBe(0);
    // The splash itself does not count as a hit for the next splash.
    strike(s, e, 100, { feel: 'none' });
    expect(lost(n)).toBe(50);
  });
  it('Weltzeituhr: the first attack after a dodge crits, the next does not', () => {
    const s = fresh('weltuhr');
    run(s, 1, { dodge: true });
    run(s, 30);
    run(s, 1, { attack: true });
    expect(s.player.critical).toBe(true);
    s.player.state = 'move'; s.player.chain = null;
    run(s, 1, { attack: true });
    expect(s.player.critical).toBe(false);
  });
  it('Späti-Tüte: crates give Verband or Molotow twice as often', async () => {
    const { createBreakables, hitBreakable } = await import('./breakables');
    const count = (leg: boolean): number => {
      const s = leg ? fresh('spaeti') : createSim({ empty: true });
      let n = 0;
      for (let i = 0; i < 600; i++) {
        s.inventory.consumables = { verband: 0, molotow: 0 };
        const [b] = createBreakables([{ kind: 'crate', x: s.player.x + 30, z: s.player.z, prop: 0, inside: false, collider: { kind: 'circle', x: 0, z: 0, r: 0.1 } }]);
        b!.hp = 1;
        hitBreakable(s, b!);
        n += s.inventory.consumables.verband + s.inventory.consumables.molotow;
      }
      return n;
    };
    const base = count(false), more = count(true);
    expect(more).toBeGreaterThan(base * 1.5);
  });
});
