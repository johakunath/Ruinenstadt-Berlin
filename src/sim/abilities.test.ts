import { describe,it,expect } from 'vitest';
import { createSim,stepSim } from './sim';
import { NO_INPUT } from './types';
import { spawnEnemy } from './enemies';
import { setLoadout } from './loadout';
import { chooseBlessing,offerBlessings,POWERS,selectPower,updateAbilities,onCombatHit,onCombatKill,onIncoming } from './abilities';
import { weaponAttack } from '../data/combat';
import type { WeaponKindId } from '../data/items';
import { snapshot,simFromSave,parseSave } from './save';
const kinds:WeaponKindId[]=['blade','hammer','spear','sling'];
const fresh=(kind:WeaponKindId='blade')=>{const s=createSim({empty:true});setLoadout(s,{w:{...s.equipment.w!,kind}});s.player.facing=0;return s;};

describe('M7 weapon roles',()=>{
  it('retains distinct reach, arc, weight and finisher ratios',()=>{
    expect(weaponAttack('hammer','light1').weight).toBe('heavy');
    expect(weaponAttack('spear','light1').reach).toBeGreaterThan(weaponAttack('blade','light1').reach);
    expect(weaponAttack('spear','light1').to).toBeLessThan(weaponAttack('blade','light1').to);
    expect(weaponAttack('hammer','light3').damage/weaponAttack('hammer','light1').damage).toBeCloseTo(1.2);
  });
  it('throws a real projectile on the active frame and hits a distant target once',()=>{
    const s=fresh('sling'),e=spawnEnemy(s,s.player.x,s.player.z+6,'walker');e.hp=e.maxHp=1000;e.def={...e.def,speed:0};
    stepSim(s,{...NO_INPUT,attack:true});
    for(let i=0;i<110;i++)stepSim(s,NO_INPUT);
    expect(e.hp).toBeLessThan(1000);expect(e.hp).toBeGreaterThan(980);
  });
});
describe('M8 builds',()=>{
  it.each(kinds)('%s has independently cooled power and ultimate, with swap penalty',kind=>{
    const s=fresh(kind);
    updateAbilities(s,{...NO_INPUT,power:true},()=>{});
    expect(s.consumed.power).toBe(true);expect(s.abilities.powerCd).toBeGreaterThan(0);
    updateAbilities(s,{...NO_INPUT,ultimate:true},()=>{});
    expect(s.consumed.ultimate).toBe(true);expect(s.abilities.ultimateCd).toBeGreaterThan(0);
    s.abilities.powerCd=0;selectPower(s,1);expect(s.equipment.w?.power).toBe(1);expect(s.abilities.powerCd).toBe(POWERS[kind][3]*.5);
  });
  it('offers three unique eligible choices, applies one and rejects stale choices',()=>{
    const s=fresh();offerBlessings(s);const offers=[...s.abilities.offers];
    expect(offers).toHaveLength(3);expect(new Set(offers).size).toBe(3);
    expect(offers.some(x=>x.startsWith('d_'))).toBe(false);
    expect(chooseBlessing(s,offers[0]!)).toBe(true);expect(s.statContext.perks[offers[0]!]).toBe(1);
    expect(chooseBlessing(s,offers[1]!)).toBe(false);
  });
  it('keeps run blessings and cooldowns in a checkpoint and clears them between runs',()=>{
    const s=fresh();s.level.encounters.push({id:'test',name:'Test',zone:0,x:0,z:0,r:8,waves:[],heal:0});s.statContext.perks.dmg=2;s.abilities.ultimateCd=10;offerBlessings(s);
    const save=parseSave(JSON.stringify(snapshot(s,'koepenick',true)))!;
    const restored=simFromSave(save,{empty:true,level:s.level},true);
    expect(restored.statContext.perks.dmg).toBe(2);expect(restored.abilities.ultimateCd).toBe(10);expect(restored.abilities.offers).toEqual(s.abilities.offers);
    const next=simFromSave(save,{empty:true},false);expect(next.statContext.perks).toEqual({});expect(next.abilities.ultimateCd).toBe(0);
  });
  it('a dead hero cannot cast or create more projectiles',()=>{const s=fresh('sling');s.player.state='dead';updateAbilities(s,{...NO_INPUT,power:true},()=>{});expect(s.abilities.projectiles).toHaveLength(0);});
});


describe('ported blessing effects',()=>{
  it('applies element statuses and chains to neighbours without recursive procs',()=>{
    const s=fresh();setLoadout(s,s.equipment,{perks:{fire:1,acid:1,shock:1,chain:1}});s.stats.elementChance=1;
    const e=spawnEnemy(s,0,0,'brute');spawnEnemy(s,1,0,'walker');
    const hits:number[]=[];onCombatHit(s,e,20,(_s,t,d)=>{hits.push(t.id);expect(d).toBeGreaterThan(0);});
    expect(s.abilities.ailments[e.id]?.burn).toBe(2);expect(s.abilities.ailments[e.id]?.acid).toBe(3);expect(hits).toHaveLength(1);
  });
  it('guard reduces damage, retaliation arms, thorns returns damage, second chance is once per run',()=>{
    const s=fresh(),e=spawnEnemy(s,0,0,'walker');s.statContext.perks={thorns:1,retour:1,second:1};s.abilities.guard=3;
    let thorns=0;expect(onIncoming(s,e,30,(_s,_e,d)=>{thorns+=d;})).toBe(9);expect(thorns).toBe(6);expect(s.abilities.retaliate).toBe(true);
    s.abilities.guard=0;s.player.hp=3;expect(onIncoming(s,e,10,()=>{})).toBe(2);expect(onIncoming(s,e,10,()=>{})).toBe(10);
  });
  it('leech heals actual max-life percentage and sprint duo refreshes dodge on a kill',()=>{
    const s=fresh(),e=spawnEnemy(s,0,0,'walker');s.statContext.perks={leech:2,d_sturm:1};s.player.hp=50;s.player.dodgeCd=1;s.abilities.sprint=.5;
    onCombatKill(s,e,()=>{});expect(s.player.hp).toBe(52);expect(s.player.dodgeCd).toBe(0);
  });
});
