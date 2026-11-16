import { describe, it, expect } from 'vitest';
import { finisherOf, weaponAttack } from '../data/combat';
import type { WeaponKindId } from '../data/items';
import { POWER, POWERS } from '../data/powers';
import type { PerkId } from '../data/progression';
import { CONSUMABLE, cooldownOf, powerOf, selectPower, useConsumable } from './abilities';
import { hurtPlayer, strike } from './combat';
import { spawnEnemy } from './enemies';
import { setLoadout } from './loadout';
import { parseSave, simFromSave, snapshot } from './save';
import { createSim, stepSim } from './sim';
import { NO_INPUT, type Enemy, type Sim } from './types';

const kinds: WeaponKindId[] = ['blade', 'hammer', 'spear', 'sling'];
type Perks = Partial<Record<PerkId, number>>;
function fresh(kind: WeaponKindId = 'blade', perks: Perks = {}, power: 0 | 1 = 0): Sim {
  const s = createSim({ empty: true });
  setLoadout(s, { w: { ...s.equipment.w!, kind, power } }, { perks });
  s.player.facing = 0;
  s.stats.crit = 0;
  return s;
}
/** A target that neither moves nor dies. */
function dummy(s: Sim, dx: number, dz: number, kind: 'walker' | 'brute' = 'walker', hp = 100000): Enemy {
  const e = spawnEnemy(s, s.player.x + dx, s.player.z + dz, kind);
  e.hp = e.maxHp = hp;
  e.def = { ...e.def, speed: 0, attackRange: 0, knockbackTaken: 0 };
  return e;
}
const run = (s: Sim, steps: number, inp: Partial<typeof NO_INPUT> = {}): void => { for (let i = 0; i < steps; i++) { stepSim(s, { ...NO_INPUT, ...inp }); s.hitstop = 0; } };
const lost = (e: Enemy): number => e.maxHp - e.hp;

describe('M7 weapons', () => {
  it('keeps the 2D roles: reach, arc, weight and finisher ratios', () => {
    expect(weaponAttack('hammer', 'light1').weight).toBe('heavy');
    expect(weaponAttack('spear', 'light1').reach).toBeGreaterThan(weaponAttack('blade', 'light1').reach + 1);
    expect(weaponAttack('spear', 'light1').to - weaponAttack('spear', 'light1').from).toBeLessThan(0.5);
    expect(weaponAttack('hammer', 'light3').damage / weaponAttack('hammer', 'light1').damage).toBeCloseTo(1.2);
    for (const k of ['blade', 'spear', 'sling'] as const) expect(weaponAttack(k, finisherOf(k)).damage / weaponAttack(k, 'light1').damage).toBeCloseTo(1.6);
    // Every weapon has its own clips.
    expect(new Set(kinds.map((k) => weaponAttack(k, 'light1').clip)).size).toBe(4);
  });
  it('the thrower shoots on the active frame and hits a distant target once', () => {
    const s = fresh('sling'), e = dummy(s, 0, 6);
    run(s, 1, { attack: true });
    run(s, 110);
    expect(lost(e)).toBe(10);
  });
  it('the fourth shot is the finisher and pierces', () => {
    const s = fresh('sling'), a = dummy(s, 0, 4), b = dummy(s, 0, 6);
    for (let i = 0; i < 4; i++) { run(s, 1, { attack: true }); run(s, 24); }
    run(s, 60);
    expect(lost(a)).toBe(10 * 3 + 16);
    expect(lost(b)).toBe(16);
  });
  it('the hammer stuns and its finisher sends a shock ring', () => {
    const s = fresh('hammer'), e = dummy(s, 0, 1.6), far = dummy(s, 0, 5);
    run(s, 1, { attack: true });
    run(s, 24);
    expect(lost(e)).toBe(10);
    expect(e.state).toBe('stagger');
    expect(e.staggerDur).toBeCloseTo(0.6);
    s.player.state = 'move'; s.player.chain = 'light3'; s.player.chainT = 1;
    run(s, 1, { attack: true });
    run(s, 40);
    // Out of the swing's reach, inside the ring (70% damage).
    expect(lost(far)).toBe(7);
  });
  it('the spear finisher lunges; Wurfspieße adds a thrown spear through four bodies', () => {
    const s = fresh('spear', { m_spiess: 1 });
    const row = [5, 6, 7, 8, 9, 10].map((z) => dummy(s, 0, z));
    const z0 = s.player.z;
    s.player.chain = 'light3'; s.player.chainT = 1;
    run(s, 1, { attack: true });
    run(s, 60);
    expect(s.player.z - z0).toBeGreaterThan(1.5);
    expect(row.filter((e) => lost(e) > 0).length).toBeGreaterThanOrEqual(5);
  });
  it('Gegengewicht makes every fourth attack a Wucht hit', () => {
    const s = fresh('blade');
    setLoadout(s, { w: { ...s.equipment.w!, mods: ['gewicht'] } });
    s.stats.crit = 0;
    const e = dummy(s, 0, 1.4);
    const crits: boolean[] = [];
    for (let i = 0; i < 4; i++) { s.player.state = 'move'; s.player.chain = null; run(s, 1, { attack: true }); crits.push(s.player.wucht); run(s, 30); }
    expect(crits).toEqual([false, false, false, true]);
    expect(lost(e)).toBe(10 * 3 + 20);
  });
  it('Nagelband adds damage against elites and bosses', () => {
    const s = fresh('blade');
    setLoadout(s, { w: { ...s.equipment.w!, mods: ['nagel'] } });
    const a = dummy(s, 2, 0), b = dummy(s, -2, 0);
    b.elite = true;
    expect(strike(s, b, 100) / strike(s, a, 100)).toBeCloseTo(1.2);
  });
});

describe('M8 powers', () => {
  it.each(kinds)('%s: two powers and an ultimate on separate cooldowns, swap costs half', (kind) => {
    const s = fresh(kind);
    run(s, 1, { power: true });
    expect(s.consumed.power).toBe(true);
    expect(s.abilities.powerCd).toBeGreaterThan(0);
    run(s, 80);
    run(s, 1, { ultimate: true });
    expect(s.consumed.ultimate).toBe(true);
    expect(s.abilities.ultimateCd).toBeGreaterThan(POWERS[kind][2].cooldown - 1);
    run(s, 80);
    s.abilities.powerCd = 0;
    selectPower(s, 1);
    expect(powerOf(s, false)).toBe(POWERS[kind][1]);
    expect(s.abilities.powerCd).toBeCloseTo(POWERS[kind][1].cooldown * 0.5);
  });
  it('Notstrom shortens cooldowns', () => {
    const s = fresh('hammer', { skill: 2 });
    expect(cooldownOf(s, POWERS.hammer[0])).toBeCloseTo(8 * 0.6);
  });
  it('Kreissäge hits around the hero for 1.2 s', () => {
    const s = fresh('blade'), e = dummy(s, 2, 0), out = dummy(s, 4, 0);
    run(s, 1, { power: true });
    run(s, 90);
    expect(lost(e)).toBe(6 * 8);
    expect(lost(out)).toBe(0);
    expect(s.abilities.spin).toBeLessThanOrEqual(0);
  });
  it('Fechtsprung dashes through, and only its own kill recharges it', () => {
    const s = fresh('blade', {}, 1), e = dummy(s, 0, 2.5, 'walker', 10), z0 = s.player.z;
    run(s, 1, { power: true });
    run(s, 20);
    expect(s.player.z - z0).toBeGreaterThan(4.5);
    expect(e.state).toBe('dead');
    expect(s.abilities.powerCd).toBeLessThanOrEqual(POWER.fecht.recharge);
    // Another kill does not recharge.
    const s2 = fresh('blade', {}, 1), t = dummy(s2, 0, -3, 'walker', 1);
    s2.abilities.powerCd = 5;
    strike(s2, t, 50);
    expect(s2.abilities.powerCd).toBe(5);
  });
  it('Säbeltanz: opening wave, then every swing is a fast crit', () => {
    const s = fresh('blade'), e = dummy(s, 0, 1.4);
    run(s, 1, { ultimate: true });
    run(s, 30);
    expect(lost(e)).toBe(15);
    run(s, 1, { attack: true });
    expect(s.player.critical).toBe(true);
    expect(s.player.attackSpeed).toBeCloseTo(1.8);
  });
  it('Fallhammer hits in a ring after the slam lands', () => {
    const s = fresh('hammer'), e = dummy(s, 4.5, 0), out = dummy(s, 7, 0);
    run(s, 1, { power: true });
    expect(s.player.state).toBe('cast');
    run(s, 10);
    expect(lost(e)).toBe(0);
    run(s, 50);
    expect(lost(e)).toBe(25);
    expect(lost(out)).toBe(0);
    expect(s.player.state).toBe('move');
  });
  it('Gullydeckel cuts damage taken, slows, and ends in a blow', () => {
    const s = fresh('hammer', {}, 1), e = dummy(s, 2, 0);
    run(s, 1, { power: true });
    const hp = s.player.hp;
    hurtPlayer(s, null, 20, 1, 0);
    expect(hp - s.player.hp).toBeCloseTo(6);
    run(s, 200);
    expect(lost(e)).toBe(16);
  });
  it('Abrissbirne leaps to the target and lands with 400%', () => {
    const s = fresh('hammer'), e = dummy(s, 0, 6);
    run(s, 1, { ultimate: true });
    run(s, 10);
    expect(s.player.invuln).toBeGreaterThan(0);
    run(s, 40);
    expect(Math.hypot(s.player.x - e.x, s.player.z - e.z)).toBeLessThan(2);
    expect(lost(e)).toBe(40);
  });
  it('Nagelsturm fans nine shots; Brandsatz leaves a burning field', () => {
    const s = fresh('sling');
    run(s, 1, { power: true });
    run(s, 9);
    expect(s.abilities.projectiles).toHaveLength(9);
    const b = fresh('sling', {}, 1), e = dummy(b, 0, 5);
    run(b, 1, { power: true });
    run(b, 60);
    expect(b.abilities.fields).toHaveLength(1);
    expect(e.burn).toBeGreaterThan(0);
    run(b, 60);
    expect(lost(e)).toBeGreaterThan(5);
  });
  it('Sperrfeuer drops eight delayed impacts on enemies', () => {
    const s = fresh('sling'), e = dummy(s, 0, 6);
    run(s, 1, { ultimate: true });
    run(s, 14);
    expect(s.abilities.strikes).toHaveLength(8);
    run(s, 120);
    expect(lost(e)).toBe(22 * 8);
  });
  it('Spießrute pierces a line; Stabhochsprung lands in a circle; Standarte buffs, heals and slows', () => {
    const s = fresh('spear'), row = [3, 5, 7, 9].map((z) => dummy(s, 0, z));
    run(s, 1, { power: true });
    run(s, 60);
    expect(row.every((e) => lost(e) === 26)).toBe(true);
    const v = fresh('spear', {}, 1), t = dummy(v, 0, 5);
    run(v, 1, { power: true });
    run(v, 40);
    expect(lost(t)).toBe(22);
    const u = fresh('spear'), d = dummy(u, 0, 2);
    u.player.hp = 50;
    run(u, 1, { ultimate: true });
    run(u, 80);
    expect(u.abilities.banner).not.toBeNull();
    expect(u.player.hp).toBeGreaterThan(50);
    expect(strike(u, d, 100)).toBe(150);
  });
  it('a dead hero cannot cast', () => {
    const s = fresh('sling');
    s.player.state = 'dead';
    run(s, 20, { power: true });
    expect(s.abilities.projectiles).toHaveLength(0);
    expect(s.abilities.powerCd).toBe(0);
  });
  it('a cast cannot leave the fight circle', () => {
    const s = fresh('blade', {}, 1);
    s.level.encounters.push({ id: 't', name: 'T', zone: 0, x: s.player.x, z: s.player.z, r: 3, waves: [], heal: 0 });
    s.run.phase = 'fight';
    run(s, 1, { power: true });
    run(s, 20);
    expect(Math.hypot(s.player.x - s.level.encounters[0]!.x, s.player.z - s.level.encounters[0]!.z)).toBeLessThanOrEqual(3);
    s.level.encounters.length = 0;
  });
});

describe('consumables', () => {
  it('Verband heals 40% over 3 s and is not wasted at full life', () => {
    const s = fresh();
    expect(useConsumable(s, 'verband', NO_INPUT)).toBe(false);
    s.player.hp = 20;
    run(s, 1, { verband: true });
    expect(s.consumed.verband).toBe(true);
    expect(s.inventory.consumables?.verband).toBe(0);
    run(s, 200);
    expect(s.player.hp).toBeCloseTo(60, 0);
    run(s, 1, { verband: true });
    expect(s.consumed.verband).toBe(false);
  });
  it('Molotow flies to the nearest enemy and burns; Sprengmeister makes it bigger', () => {
    const s = fresh('blade', { blast: 1 }), e = dummy(s, 0, 6);
    run(s, 1, { molotow: true });
    expect(s.player.state).toBe('cast');
    run(s, 50);
    expect(s.abilities.fields[0]!.r).toBeCloseTo(CONSUMABLE.molotow.radius * 1.5);
    expect(e.burn).toBeGreaterThan(0);
    expect(s.inventory.consumables?.molotow).toBe(0);
  });
});

describe('checkpoint', () => {
  it('keeps run blessings, cooldowns, consumables and run content; a new run clears the run part', () => {
    const s = fresh();
    s.level.encounters.push({ id: 'test', name: 'Test', zone: 0, x: 0, z: 0, r: 8, waves: [], heal: 0 });
    s.statContext.perks.dmg = 2;
    s.abilities.ultimateCd = 10;
    s.abilities.projectiles.push({ x: 0, z: 0, px: 0, pz: 0, angle: 0, speed: 1, life: 1, damage: 1, crit: false, pierce: 0, extra: 0, hits: [], kind: 'stone', wucht: false });
    s.content.hidden.push({ x: 3, z: 3, got: true });
    s.content.shrine.as = 30;
    const save = parseSave(JSON.stringify(snapshot(s, 'koepenick', true)))!;
    const back = simFromSave(save, { empty: true, level: s.level }, true);
    expect(back.statContext.perks.dmg).toBe(2);
    expect(back.abilities.ultimateCd).toBe(10);
    expect(back.abilities.projectiles).toHaveLength(0);
    expect(back.content.hidden[0]?.got).toBe(true);
    expect(back.statContext.shrines?.as).toBe(true);
    expect(back.inventory.consumables).toEqual(s.inventory.consumables);
    const next = simFromSave(save, { empty: true }, false);
    expect(next.statContext.perks).toEqual({});
    expect(next.statContext.shrines?.as ?? false).toBe(false);
    expect(next.abilities.ultimateCd).toBe(0);
    s.level.encounters.length = 0;
  });
});
