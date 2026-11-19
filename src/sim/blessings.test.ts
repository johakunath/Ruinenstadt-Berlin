import { describe, it, expect } from 'vitest';
import type { WeaponKindId } from '../data/items';
import { PERKS, type PerkId } from '../data/progression';
import { chooseBlessing, heldFamilies, offerBlessings, rerollBlessings, rerollCost } from './blessings';
import { hurtPlayer, incomingDamage, strike, updateStatuses, STATUS } from './combat';
import { spawnEnemy } from './enemies';
import { setLoadout } from './loadout';
import { LOOT, spawnDrop, updateDrops } from './loot';
import { createSim, stepSim } from './sim';
import { DT, NO_INPUT, type Enemy, type Sim } from './types';

type Perks = Partial<Record<PerkId, number>>;
function fresh(kind: WeaponKindId = 'blade', perks: Perks = {}, seed = 1): Sim {
  const s = createSim({ empty: true, seed });
  setLoadout(s, { w: { ...s.equipment.w!, kind } }, { perks });
  s.player.facing = 0;
  s.stats.crit = 0;
  return s;
}
function dummy(s: Sim, dx: number, dz: number, hp = 100000, kind: 'walker' | 'brute' | 'feldwebel' = 'walker'): Enemy {
  const e = spawnEnemy(s, s.player.x + dx, s.player.z + dz, kind);
  e.hp = e.maxHp = hp;
  // A training dummy: no element resistance and no class (D9 bonus), so rules are measured plain.
  e.def = { ...e.def, speed: 0, attackRange: 0, knockbackTaken: 0, res: 'none', ai: 'melee', classes: [] };
  return e;
}
const run = (s: Sim, steps: number, inp: Partial<typeof NO_INPUT> = {}): void => { for (let i = 0; i < steps; i++) { s.hitstop = 0; stepSim(s, { ...NO_INPUT, ...inp }); } };
const lost = (e: Enemy): number => e.maxHp - e.hp;
const always = (s: Sim): void => { s.stats.elementChance = 1; };

describe('blessing choice (2D offerPerks)', () => {
  it('offers three different blessings, never a duo without its families, never a weapon mod in the pool', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = fresh('blade', {}, seed);
      offerBlessings(s);
      const ids = s.abilities.offers.map((o) => o.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
      expect(ids.some((id) => id.startsWith('d_') || id.startsWith('m_'))).toBe(false);
      // No element: nothing that needs one.
      expect(ids.some((id) => PERKS.find((p) => p.id === id)!.requires)).toBe(false);
    }
  });
  it('does not offer the element the weapon already has, but its follow-ups', () => {
    let seen = false;
    for (let seed = 1; seed < 60; seed++) {
      const s = fresh('blade', {}, seed);
      setLoadout(s, { w: { ...s.equipment.w!, element: 'fire' } });
      offerBlessings(s);
      const ids = s.abilities.offers.map((o) => o.id);
      expect(ids).not.toContain('fire');
      seen ||= ids.some((id) => ['spread', 'schwel', 'kachel', 'elp'].includes(id));
    }
    expect(seen).toBe(true);
  });
  it('held families come up more often and unlock their duo', () => {
    const count = (perks: Perks, id: PerkId): number => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) { const s = fresh('blade', perks, seed); offerBlessings(s); if (s.abilities.offers.some((o) => o.id === id)) n++; }
      return n;
    };
    expect(count({ spd: 1 }, 'dashcd')).toBeGreaterThan(count({}, 'dashcd') * 1.4);
    expect(count({}, 'd_sturm')).toBe(0);
    expect(count({ spd: 1, leech: 1 }, 'd_sturm')).toBeGreaterThan(20);
    expect([...heldFamilies(fresh('blade', { spd: 1, d_sturm: 1 }))]).toEqual(['sprint']);
  }, 20_000); // 300 to 600 seeded offers: about 4 s locally, slower on CI runners
  it('some cards give two levels; a choice applies them, records the card and rejects stale picks', () => {
    let two = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = fresh('blade', {}, seed);
      offerBlessings(s);
      const o = s.abilities.offers.find((x) => x.level === 2);
      if (!o) continue;
      two++;
      const other = s.abilities.offers.find((x) => x !== o)!.id;
      expect(chooseBlessing(s, o.id)).toBe(true);
      expect(s.statContext.perks[o.id]).toBe(2);
      expect(s.abilities.quality[o.id]).toBeGreaterThanOrEqual(1);
      expect(chooseBlessing(s, other)).toBe(false);
    }
    expect(two).toBeGreaterThan(20);
  });
  it('an Umbau appears rarely, from wave three on, once per run, one of the three of the held weapon', () => {
    const mods = (waves: number, perks: Perks = {}): string[] => {
      const out: string[] = [];
      for (let seed = 1; seed <= 300; seed++) { const s = fresh('hammer', perks, seed); s.lootWaves = waves; offerBlessings(s); out.push(...s.abilities.offers.filter((o) => o.quality === 3).map((o) => o.id)); }
      return out;
    };
    expect(mods(2)).toHaveLength(0);
    const late = mods(3);
    expect(late.length).toBeGreaterThan(35);
    expect(late.length).toBeLessThan(110);
    expect(new Set(late)).toEqual(new Set(['m_dampf', 'm_beben', 'm_wurf']));
    expect(mods(6, { m_beben: 1 })).toHaveLength(0);
    // Every weapon has three.
    for (const k of ['blade', 'hammer', 'spear', 'sling'] as const) expect(PERKS.filter((p) => p.weapon === k)).toHaveLength(3);
  }, 20_000); // 300 to 600 seeded offers: about 4 s locally, slower on CI runners
  it('one reroll per choice costs Schrott; a second choice queues', () => {
    const s = fresh();
    offerBlessings(s);
    const first = s.abilities.offers.map((o) => o.id).join();
    expect(rerollBlessings(s)).toBe(false);
    s.inventory.scrap = 100;
    expect(rerollBlessings(s)).toBe(true);
    expect(s.inventory.scrap).toBe(100 - rerollCost(s));
    expect(s.abilities.offers.map((o) => o.id).join()).not.toBe(first);
    expect(rerollBlessings(s)).toBe(false);
    offerBlessings(s, true);
    expect(s.abilities.pending).toBe(1);
    chooseBlessing(s, s.abilities.offers[0]!.id);
    expect(s.abilities.offers).toHaveLength(3);
    expect(s.abilities.pending).toBe(0);
  });
  it('Dickes Fell raises max life and heals a little', () => {
    const s = fresh();
    s.player.hp = 50;
    s.abilities.offers = [{ id: 'hp', level: 1, quality: 0 }];
    chooseBlessing(s, 'hp');
    expect(s.stats.maxHp).toBe(110);
    expect(s.player.hp).toBe(55 + 25);
  });
});

describe('element blessings', () => {
  it('Feuertaufe burns for 45% per second over 2 s, without hit feel', () => {
    const s = fresh('blade', { fire: 1 }), e = dummy(s, 0, 2);
    always(s);
    strike(s, e, 100);
    expect(e.burn).toBe(2);
    expect(e.bdps).toBeCloseTo(45);
    s.events.length = 0;
    s.hitstop = 0;
    for (let i = 0; i < 130; i++) updateStatuses(s);
    expect(lost(e)).toBeCloseTo(100 + 90, 0);
    expect(s.events.filter((ev) => ev.type === 'dot').length).toBeGreaterThan(2);
    expect(s.hitstop).toBe(0);
  });
  it('Schwelbrand stacks to three times and lasts longer; Pulverfass adds power', () => {
    const s = fresh('blade', { fire: 1, schwel: 1, elp: 2 }), e = dummy(s, 0, 2);
    always(s);
    for (let i = 0; i < 5; i++) strike(s, e, 100);
    expect(e.burn).toBe(3);
    expect(e.bdps).toBeCloseTo(3 * 45 * 1.5);
  });
  it('Flächenbrand spreads on death; Kachelofen heals from burn damage', () => {
    const s = fresh('blade', { fire: 1, spread: 1, kachel: 2 }), e = dummy(s, 0, 2, 50), n = dummy(s, 1.5, 2), far = dummy(s, 9, 2);
    always(s);
    s.player.hp = 10;
    strike(s, e, 40);
    for (let i = 0; i < 60; i++) updateStatuses(s);
    expect(e.state).toBe('dead');
    expect(n.burn).toBeGreaterThan(0);
    expect(n.bdps).toBeCloseTo(18 * 0.8);
    expect(far.burn).toBe(0);
    expect(s.player.hp).toBeGreaterThan(10.5);
  });
  it('Säurebad: 25% more damage for 3 s; Zersetzung slows', () => {
    const s = fresh('blade', { acid: 1, corrode: 1 }), e = dummy(s, 0, 2);
    always(s);
    strike(s, e, 100);
    expect(e.acid).toBe(3);
    expect(strike(s, e, 100, { noproc: true })).toBe(125);
    const a = spawnEnemy(s, s.player.x + 3, s.player.z + 3, 'walker'), b = spawnEnemy(s, s.player.x - 3, s.player.z + 3, 'walker');
    a.acid = 3;
    run(s, 1);
    expect(a.speed / b.speed).toBeCloseTo(STATUS.corrodeSlow);
  });
  it('Blitzableiter jumps to two neighbors for half, Kettenblitz to more, never recursively', () => {
    const s = fresh('blade', { shock: 1 }), e = dummy(s, 0, 2), near = [1, 2, 3, 4].map((i) => dummy(s, i * 0.9, 2));
    always(s);
    strike(s, e, 100);
    expect(near.filter((t) => lost(t) === 50)).toHaveLength(2);
    expect(s.events.filter((ev) => ev.type === 'bolt')).toHaveLength(2);
    const c = fresh('blade', { shock: 1, chain: 1 }), src = dummy(c, 0, 2), more = [1, 2, 3, 4, 5].map((i) => dummy(c, i * 0.8, 2));
    always(c);
    strike(c, src, 100);
    expect(more.filter((t) => lost(t) > 0)).toHaveLength(4);
  });
  it('Kurzschluss: a crit always triggers the element', () => {
    const s = fresh('blade', { fire: 1, d_kurz: 1 }), e = dummy(s, 0, 2);
    s.stats.elementChance = 0;
    strike(s, e, 100);
    expect(e.burn).toBe(0);
    strike(s, e, 100, { crit: true });
    expect(e.burn).toBe(2);
  });
});

describe('hit and kill blessings', () => {
  it('Gnadenstoß executes normal enemies under 12%, not bosses', () => {
    const s = fresh('blade', { exec: 1 }), e = dummy(s, 0, 2, 100), b = dummy(s, 3, 2, 100, 'feldwebel');
    strike(s, e, 89);
    expect(e.state).toBe('dead');
    strike(s, b, 89);
    expect(b.state).not.toBe('dead');
  });
  it('Dicke Bertha: +25% per level against bosses and elites', () => {
    const s = fresh('blade', { breaker: 2 }), n = dummy(s, 2, 0), b = dummy(s, -2, 0, 100000, 'feldwebel');
    expect(strike(s, n, 100)).toBe(100);
    expect(strike(s, b, 100)).toBe(150);
  });
  it('Kimme und Korn scales with distance up to 32%; Zielwasser crits far targets', () => {
    const s = fresh('blade', { kimme: 1 }), near = dummy(s, 0, 1), far = dummy(s, 0, 30);
    expect(strike(s, near, 100)).toBe(102);
    expect(strike(s, far, 100)).toBe(132);
    let crits = 0;
    const z = fresh('blade', { d_ziel: 1 }), t = dummy(z, 0, 8), c = dummy(z, 0, 3);
    for (let i = 0; i < 400; i++) { if (strike(z, t, 100) === 200) crits++; expect(strike(z, c, 100)).toBe(100); }
    expect(crits).toBeGreaterThan(60);
    expect(crits).toBeLessThan(140);
  });
  it('Kopfnuss: crits stun, bosses much shorter', () => {
    const s = fresh('blade', { stun: 1 }), e = dummy(s, 0, 2), b = dummy(s, 3, 2, 100000, 'feldwebel');
    strike(s, e, 10, { crit: true, feel: 'none' });
    strike(s, b, 10, { crit: true, feel: 'none' });
    expect(e.state).toBe('stagger');
    expect(e.staggerDur).toBeCloseTo(0.6);
    expect(b.staggerDur).toBeCloseTo(0.09);
  });
  it('Splitterleichen: a death hurts neighbors for 35% per level', () => {
    const s = fresh('blade', { boom: 2 }), e = dummy(s, 0, 3, 5), n = dummy(s, 1.5, 3), far = dummy(s, 6, 3);
    strike(s, e, 10);
    run(s, 1);
    expect(lost(n)).toBe(7);
    expect(lost(far)).toBe(0);
  });
  it('Aderlass heals 1% per level and kill; gear leech adds flat life', () => {
    const s = fresh('blade', { leech: 2 }), e = dummy(s, 0, 2, 5);
    s.player.hp = 50;
    strike(s, e, 10);
    expect(s.player.hp).toBe(52);
  });
  it('Jagdfieber: each kill speeds attacks for 3 s, up to five times', () => {
    const s = fresh('blade', { jagd: 1 });
    for (let i = 0; i < 7; i++) strike(s, dummy(s, 0, 2, 1), 5);
    expect(s.abilities.jagd.n).toBe(5);
    run(s, 1, { attack: true });
    expect(s.player.attackSpeed).toBeCloseTo(1.3);
    for (let i = 0; i < 190; i++) updateStatuses(s);
    expect(s.abilities.jagd.n).toBe(0);
  });
  it('Kiezrausch: +2% damage per ten kills of the running series; a long series pays Schrott', () => {
    const s = fresh('blade', { rush: 1 }), t = dummy(s, 0, 2);
    for (let i = 0; i < 20; i++) strike(s, dummy(s, 0, 3, 1), 5);
    expect(s.abilities.streak.n).toBe(20);
    expect(strike(s, t, 100)).toBe(104);
    const scrap = s.inventory.scrap;
    for (let i = 0; i < 170; i++) updateStatuses(s);
    expect(s.abilities.streak.n).toBe(0);
    expect(s.inventory.scrap).toBe(scrap + 12);
    expect(strike(s, t, 100)).toBe(100);
  });
  it('Paukenschlag: finishers always crit; Trommelfeuer: the finisher comes a swing earlier', () => {
    const s = fresh('blade', { pauke: 1, combo: 1 });
    stepSim(s, { ...NO_INPUT, attack: true });
    expect(s.player.attack?.next).toBe('light3');
    expect(s.player.critical).toBe(false);
    s.player.state = 'move'; s.player.chain = 'light3'; s.player.chainT = 1;
    stepSim(s, { ...NO_INPUT, attack: true });
    expect(s.player.finisher).toBe(true);
    expect(s.player.critical).toBe(true);
  });
  it('Rundumschlag: the blade finisher hits behind the hero too', () => {
    const s = fresh('blade', { m_rund: 1 }), behind = dummy(s, 0, -2);
    s.player.chain = 'light3'; s.player.chainT = 1;
    run(s, 1, { attack: true });
    run(s, 30);
    expect(lost(behind)).toBe(16);
  });
  it('Dampfhammer: slower, +70% damage, every swing sends a small ring; Schrotladung: three shots at 55%', () => {
    const s = fresh('hammer', { m_dampf: 1 }), e = dummy(s, 0, 3.6);
    // 10 × 1.7, × 1.1 for the shorter default hammer (D8).
    expect(s.stats.damage).toBeCloseTo(18.7);
    expect(s.stats.attackSpeed).toBeCloseTo(1 / 1.3);
    run(s, 1, { attack: true });
    run(s, 50);
    expect(lost(e)).toBe(Math.round(17 * 0.5));
    const g = fresh('sling', { m_schrot: 1 });
    run(g, 1, { attack: true });
    run(g, 8);
    expect(g.abilities.projectiles).toHaveLength(3);
    expect(g.abilities.projectiles[0]!.damage).toBeCloseTo(5.5);
  });
  it('Durchschlag: shots pass through one more body per level; Langer Kerl: longer reach, faster shots', () => {
    const s = fresh('sling', { durch: 2, reach: 1 }), row = [3, 4, 5, 6].map((z) => dummy(s, 0, z));
    run(s, 1, { attack: true });
    run(s, 8);
    expect(s.abilities.projectiles[0]!.speed).toBeCloseTo((560 / 30) * 1.2);
    run(s, 60);
    expect(row.map(lost)).toEqual([10, 10, 10, 0]);
    expect(fresh('blade', { reach: 1 }).stats.reachFactor).toBeCloseTo(1.2);
  });
});

describe('defence and sprint blessings', () => {
  it('Stehaufmännchen: once per run back to 30% with a moment of safety', () => {
    const s = fresh('blade', { second: 1 });
    s.player.hp = 5;
    hurtPlayer(s, null, 30, 1, 0);
    expect(s.player.state).not.toBe('dead');
    expect(s.player.hp).toBe(30);
    expect(s.player.invuln).toBe(1.5);
    s.player.invuln = 0;
    s.player.hp = 5;
    hurtPlayer(s, null, 30, 1, 0);
    expect(s.player.state).toBe('dead');
  });
  it('Stellungskrieg: 25% less while standing; Abgehärtet: resistance; no hit over 45% of max life', () => {
    const s = fresh('blade', { stellung: 1 });
    expect(incomingDamage(s, 20)).toBeCloseTo(15);
    s.player.vx = 5;
    expect(incomingDamage(s, 20)).toBeCloseTo(20);
    expect(incomingDamage(fresh('blade', { res: 2 }), 20)).toBeCloseTo(20 * 0.88);
    expect(incomingDamage(s, 500)).toBeCloseTo(45);
  });
  it('Igelstellung returns damage, Brandmauer ignites, Retourkutsche doubles the next attack', () => {
    const s = fresh('blade', { thorns: 2, d_mauer: 1, retour: 1 }), e = dummy(s, 0, 1.2);
    hurtPlayer(s, e, 10, 0, -1);
    expect(lost(e)).toBe(12);
    expect(e.burn).toBe(3);
    expect(e.bdps).toBeCloseTo(8);
    expect(s.abilities.ret).toBe(true);
    run(s, 1, { attack: true });
    expect(s.player.attack?.damage).toBe(20);
    expect(s.abilities.ret).toBe(false);
  });
  it('Atempause heals on a dodge; Husarenritt adds damage right after it; Hakenschlag shortens the cooldown', () => {
    const s = fresh('blade', { breath: 2, husar: 2 });
    s.player.hp = 50;
    run(s, 1, { dodge: true });
    expect(s.player.hp).toBeCloseTo(56);
    run(s, 20);
    run(s, 1, { attack: true });
    expect(s.player.attack?.damage).toBeCloseTo(15 * 1.8);
    expect(fresh('blade', { dashcd: 2 }).stats.dashCooldown).toBeCloseTo(1.4 * 0.6);
  });
  it('Rammbock: the dodge hits bodies on the way, once each', () => {
    const s = fresh('blade', { ram: 2 }), e = dummy(s, 0, 1.5);
    run(s, 1, { dodge: true, moveZ: 1 });
    run(s, 20, { moveZ: 1 });
    expect(lost(e)).toBe(24);
  });
  it('Brandstifter: the dodge leaves a burning trail', () => {
    const s = fresh('blade', { d_brand: 1 }), e = dummy(s, 0.9, 1.5);
    run(s, 1, { dodge: true, moveZ: 1 });
    run(s, 14, { moveZ: 1 });
    expect(s.abilities.fields.length).toBeGreaterThan(2);
    expect(e.burn).toBeGreaterThan(0);
    run(s, 160);
    expect(s.abilities.fields).toHaveLength(0);
  });
  it('Sturmangriff: a kill shortly after a dodge recharges it', () => {
    const s = fresh('blade', { d_sturm: 1 });
    run(s, 1, { dodge: true });
    run(s, 16);
    expect(s.player.dodgeCd).toBeGreaterThan(0);
    strike(s, dummy(s, 0, 2, 1), 5);
    expect(s.player.dodgeCd).toBe(0);
  });
  it('Fersengeld, Adlerblick, Akkordarbeit, Kiezwut change the stats', () => {
    const s = fresh('blade', { spd: 2, crit: 2, rate: 2, dmg: 2 });
    setLoadout(s, s.equipment);
    expect(s.stats.moveSpeed).toBeCloseTo(1.2);
    expect(s.stats.crit).toBeCloseTo(0.24);
    expect(s.stats.attackSpeed).toBeCloseTo(1.24);
    expect(s.stats.damage).toBeCloseTo(13);
  });
});

describe('loot blessings', () => {
  it('Elster widens the pickup reach only', () => {
    const s = fresh('blade', { magnet: 2 });
    const d = spawnDrop(s, s.player.x + 2.4, s.player.z, { kind: 'material', id: 'stoff' });
    Object.assign(d, { landed: true, h: 0, vx: 0, vz: 0, x: s.player.x + 2.4, z: s.player.z });
    updateDrops(s);
    expect(s.drops).toHaveLength(0);
    expect(LOOT.pickupRadius * (1 + 2 * LOOT.magnet)).toBeGreaterThan(2.4);
    const n = fresh();
    const d2 = spawnDrop(n, n.player.x + 2.4, n.player.z, { kind: 'material', id: 'stoff' });
    Object.assign(d2, { landed: true, h: 0, vx: 0, vz: 0, x: n.player.x + 2.4, z: n.player.z });
    updateDrops(n);
    expect(n.drops).toHaveLength(1);
  });
  it('SERO-Sammler: +50% Schrott per level from kills', () => {
    const base = fresh(), more = fresh('blade', { scrap: 2 });
    strike(base, dummy(base, 0, 2, 1, 'brute'), 5);
    strike(more, dummy(more, 0, 2, 1, 'brute'), 5);
    expect(more.inventory.scrap).toBe(base.inventory.scrap * 2);
  });
  it('Döner heals a quarter and feeds for 30 s (+10% damage)', () => {
    const s = fresh();
    s.player.hp = 40;
    const d = spawnDrop(s, s.player.x, s.player.z, { kind: 'food' });
    Object.assign(d, { landed: true, h: 0, x: s.player.x, z: s.player.z });
    updateDrops(s);
    expect(s.player.hp).toBe(65);
    expect(s.abilities.fed).toBe(30);
    stepSim(s, { ...NO_INPUT, attack: true });
    expect(s.player.attack?.damage).toBeCloseTo(11);
    for (let t = 0; t < 31; t += DT) stepSim(s, NO_INPUT);
    expect(s.abilities.fed).toBe(0);
  });
});

describe('G1 Umbau cards (3D additions)', () => {
  it('Doppelklinge: every swing cuts twice for 60% each', () => {
    const s = fresh('blade', { m_doppel: 1 }), e = dummy(s, 0, 1.4);
    run(s, 1, { attack: true });
    run(s, 30);
    expect(lost(e)).toBe(12);
  });
  it('Sturmklinge: faster, weaker, and each swing carries the hero a meter further', () => {
    const base = fresh('blade'), s = fresh('blade', { m_sturm: 1 });
    expect(s.stats.attackSpeed).toBeCloseTo(1.25);
    expect(s.stats.damage).toBeCloseTo(8.5);
    const z0 = s.player.z, b0 = base.player.z;
    run(s, 1, { attack: true }); run(s, 30);
    run(base, 1, { attack: true }); run(base, 30);
    const extra = (s.player.z - z0) - (base.player.z - b0);
    expect(extra).toBeGreaterThan(0.9);
    expect(extra).toBeLessThan(1.2);
  });
  it('Erdbeben: the hammer finisher ring is twice as wide and stuns for a second', () => {
    const s = fresh('hammer', { m_beben: 1 }), far = dummy(s, 0, 8);
    s.player.chain = 'light3'; s.player.chainT = 1;
    run(s, 1, { attack: true });
    run(s, 50);
    expect(lost(far)).toBe(8);
    expect(far.staggerDur).toBeCloseTo(1);
    const n = fresh('hammer'), out = dummy(n, 0, 8);
    n.player.chain = 'light3'; n.player.chainT = 1;
    run(n, 1, { attack: true });
    run(n, 50);
    expect(lost(out)).toBe(0);
  });
  it('Wurfhammer: the finisher throws the hammer through three bodies', () => {
    const s = fresh('hammer', { m_wurf: 1 }), row = [6, 7, 8, 9, 10].map((z) => dummy(s, 0, z));
    s.player.chain = 'light3'; s.player.chainT = 1;
    run(s, 1, { attack: true });
    run(s, 70);
    expect(row.map(lost)).toEqual([20, 20, 20, 20, 0]);
  });
  it('Fegestoß: thrusts become wide, shorter sweeps; the finisher stays the round sweep', () => {
    const s = fresh('spear', { m_fege: 1 }), side = dummy(s, 1.9, 1.3), far = dummy(s, 0, 4.6);
    run(s, 1, { attack: true });
    expect(s.player.attack?.style).toBe('slash');
    run(s, 30);
    expect(lost(side)).toBe(10);
    expect(lost(far)).toBe(0);
    s.player.state = 'move'; s.player.chain = 'light3'; s.player.chainT = 1;
    run(s, 1, { attack: true });
    expect(s.player.attack!.to - s.player.attack!.from).toBeGreaterThan(5);
  });
  it('Sturmlanze: thrusts right after a dodge hit twice as hard and reach further', () => {
    const s = fresh('spear', { m_lanze: 1 });
    run(s, 1, { attack: true });
    expect(s.player.attack?.damage).toBe(10);
    run(s, 40);
    run(s, 1, { dodge: true });
    run(s, 30);
    s.player.chain = null;
    run(s, 1, { attack: true });
    expect(s.player.attack?.damage).toBe(20);
    expect(s.player.attack?.reach).toBeCloseTo(4.0 * 1.5);
  });
  it('Querschläger: a shot jumps once to the nearest other enemy for 80%', () => {
    const s = fresh('sling', { m_quer: 1 }), a = dummy(s, 0, 5), b = dummy(s, 3, 5);
    run(s, 1, { attack: true });
    run(s, 80);
    expect(lost(a)).toBe(10);
    expect(lost(b)).toBe(8);
  });
  it('Schnellfeuer: faster and weaker shots, the finisher is a fan of five', () => {
    const s = fresh('sling', { m_salve: 1 });
    expect(s.stats.attackSpeed).toBeCloseTo(1.4);
    expect(s.stats.damage).toBeCloseTo(7.5);
    s.player.chain = 'light4'; s.player.chainT = 1;
    run(s, 1, { attack: true });
    run(s, 8);
    expect(s.abilities.projectiles).toHaveLength(5);
  });
});
