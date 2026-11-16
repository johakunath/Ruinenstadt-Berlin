// M8 first playable port: 2D KR names/cooldowns/ratios, PERKS metadata and seeded family weighting.
import { PERKS, type PerkId } from '../data/progression';
import type { WeaponKindId } from '../data/items';
import { BREAKABLE, hitBreakable } from './breakables';
import { keepInArena } from './director';
import { setLoadout } from './loadout';
import { DT, type Enemy, type Sim, type SimInput } from './types';
export interface Projectile { x:number; z:number; angle:number; speed:number; life:number; damage:number; pierce:number; hits:number[] }
interface Field { x:number; z:number; radius:number; life:number; tick:number; damage:number; delay:number }
export interface Abilities {
  powerCd:number; ultimateCd:number; frenzy:number; guard:number; spin:number; sprint:number;
  vault:{x:number;z:number;left:number;duration:number;radius:number;damage:number}|null;
  banner:{x:number;z:number;life:number}|null; retaliate:boolean; secondUsed:boolean;
  projectiles:Projectile[]; fields:Field[]; offers:PerkId[]; pending:number;
  ailments:Record<number,{burn:number;dps:number;acid:number;tick:number}>;
}
export const POWERS: Record<WeaponKindId, readonly [string,number,string,number,string,number]> = {
  blade:['Kreissäge',7,'Fechtsprung',6,'Säbeltanz',24], hammer:['Fallhammer',8,'Gullydeckel',9,'Abrissbirne',22],
  sling:['Nagelsturm',6,'Brandsatz',8,'Sperrfeuer',22], spear:['Spießrute',7,'Stabhochsprung',6,'Standarte',26],
};
// Only offer implemented rules. Remaining 2D perks stay in progression.ts for the parity follow-up.
const SUPPORTED = new Set<PerkId>(['dmg','hp','spd','crit','rate','reach','leech','scrap','dashcd','skill','res','combo','breath','pauke','husar','retour','thorns','second','breaker','exec','fire','acid','shock','elp','chain','m_rund','m_schrot','durch','d_kurz','d_sturm']);
export function createAbilities(): Abilities { return {powerCd:0,ultimateCd:0,frenzy:0,guard:0,spin:0,sprint:0,vault:null,banner:null,retaliate:false,secondUsed:false,projectiles:[],fields:[],offers:[],pending:0,ailments:{}}; }
const pk=(s:Sim,k:PerkId):number=>s.statContext.perks[k]??0;
export type Damage = (s:Sim,e:Enemy,damage:number,weight?:'light'|'heavy',knockback?:number)=>void;
export function offerBlessings(s:Sim): void {
  if (s.abilities.offers.length) { s.abilities.pending++; return; }
  const held=new Set(PERKS.filter(p=>pk(s,p.id)>0&&!p.duo&&!p.weapon).flatMap(p=>p.families??[]));
  const pool=PERKS.filter(p=>SUPPORTED.has(p.id)&&pk(s,p.id)<p.max&&(!p.weapon||p.weapon===s.stats.kind)
    &&(!p.duo||p.duo.every(f=>held.has(f)))&&(!p.requires||(p.requires==='any'?s.stats.elements.length>0:pk(s,p.requires)>0)));
  for(let i=0;i<3&&pool.length;i++) {
    const weights=pool.map(p=>p.families?.some(f=>held.has(f))?2.5:1);
    let n=s.rng.next()*weights.reduce((a,b)=>a+b,0), at=pool.length-1;
    for(let j=0;j<pool.length;j++) if((n-=weights[j]!)<0){at=j;break;}
    s.abilities.offers.push(pool.splice(at,1)[0]!.id);
  }
}
export function chooseBlessing(s:Sim,id:PerkId):boolean {
  if(!s.abilities.offers.includes(id))return false;
  setLoadout(s,s.equipment,{...s.statContext,perks:{...s.statContext.perks,[id]:pk(s,id)+1}});
  s.abilities.offers=[];
  if(s.abilities.pending>0){s.abilities.pending--;offerBlessings(s);}
  return true;
}
export function selectPower(s:Sim,which:0|1):void {
  if(!s.equipment.w)return;
  s.equipment.w.power=which;
  s.abilities.powerCd=Math.max(s.abilities.powerCd,POWERS[s.stats.kind][which===0?1:3]*.5);
}
function field(s:Sim,x:number,z:number,radius:number,damage:number,life=.08,delay=0):void {
  s.abilities.fields.push({x,z,radius,damage,life,delay,tick:0});
}
function shoot(s:Sim,angle:number,damage:number,pierce=0):void {
  s.abilities.projectiles.push({x:s.player.x,z:s.player.z,angle,speed:22,life:.9,damage,pierce,hits:[]});
}
function cast(s:Sim,ult:boolean,inp:SimInput):void {
  const a=s.abilities,p=s.player,k=s.stats.kind,which=s.equipment.w?.power??0;
  if(a.vault||p.state==='dead'||p.state==='dodge'||p.state==='attack'||(ult?a.ultimateCd:a.powerCd)>0)return;
  if(inp.aimX||inp.aimZ)p.facing=Math.atan2(inp.aimX,inp.aimZ);
  else if(inp.moveX||inp.moveZ)p.facing=Math.atan2(inp.moveX,inp.moveZ);
  const q=POWERS[k],d=s.stats.damage,x=p.x+Math.sin(p.facing)*5,z=p.z+Math.cos(p.facing)*5;
  if(ult){a.ultimateCd=q[5]*s.stats.cooldownFactor;s.consumed.ultimate=true;}
  else {a.powerCd=q[which===0?1:3]*s.stats.cooldownFactor;s.consumed.power=true;}
  s.events.push({type:'ability',name:q[ult?4:which===0?0:2],ultimate:ult});
  if(k==='blade') {
    if(ult){a.frenzy=5;field(s,p.x,p.z,4,1.5*d);}
    else if(which===0)a.spin=1.2;
    else { // Ground-plane dash, resolved through the same walls as movement.
      for(let i=0;i<12;i++){p.x+=Math.sin(p.facing)*.25;p.z+=Math.cos(p.facing)*.25;s.level.resolve(p,.38);}
      p.invuln=Math.max(p.invuln,.36);field(s,p.x,p.z,2,1.8*d);
    }
  } else if(k==='hammer') {
    if(ult)a.vault={x,z,left:.5,duration:.5,radius:4,damage:4*d};
    else if(which===0)field(s,p.x,p.z,3.3,2.5*d);
    else a.guard=3;
  } else if(k==='sling') {
    if(ult) for(let i=0;i<8;i++){const live=s.enemies.filter(e=>e.state!=='dead'),e=live.length?s.rng.pick(live):null;field(s,e?.x??x,e?.z??z,1.3,2.2*d,.08,.45+i*.13);}
    else if(which===0)for(let i=0;i<9;i++)shoot(s,p.facing+(i-4)*.14,.8*d,1);
    else field(s,x,z,2, .6*d,4);
  } else {
    if(ult)a.banner={x:p.x,z:p.z,life:8};
    else if(which===0)shoot(s,p.facing,2.6*d,30);
    else a.vault={x,z,left:.36,duration:.36,radius:2.7,damage:2.2*d};
  }
}
export function updateAbilities(s:Sim,inp:SimInput,hit:Damage):void {
  const a=s.abilities,p=s.player;
  if(p.state==='dead')return;
  if(a.vault){
    const v=a.vault,k=Math.min(1,DT/Math.max(DT,v.left));p.x+=(v.x-p.x)*k;p.z+=(v.z-p.z)*k;s.level.resolve(p,.38);keepInArena(s,p,.38);p.invuln=Math.max(p.invuln,DT*2);v.left-=DT;
    if(v.left<=0){field(s,p.x,p.z,v.radius,v.damage);a.vault=null;}
  }
  if(inp.ultimate)cast(s,true,inp);else if(inp.power)cast(s,false,inp);
  for(const k of ['powerCd','ultimateCd','frenzy','sprint'] as const)a[k]=Math.max(0,a[k]-DT);
  if(a.guard>0){a.guard-=DT;if(a.guard<=0)field(s,p.x,p.z,3,2.5*s.stats.damage);}
  if(a.spin>0){const before=Math.ceil(a.spin/.2);a.spin-=DT;if(Math.ceil(a.spin/.2)<before)field(s,p.x,p.z,2.8,.6*s.stats.damage);}
  if(a.banner){a.banner.life-=DT;if(a.banner.life<=0)a.banner=null;else if(Math.hypot(p.x-a.banner.x,p.z-a.banner.z)<3.4)p.hp=Math.min(s.stats.maxHp,p.hp+s.stats.maxHp*.03*DT);}
  for(const f of a.fields){
    f.delay-=DT;if(f.delay>0)continue;
    f.life-=DT;f.tick-=DT;
    if(f.tick<=0){f.tick=.5;for(const e of s.enemies)if(Math.hypot(e.x-f.x,e.z-f.z)<=f.radius+e.def.radius)hit(s,e,f.damage,'heavy',10);}
  }
  a.fields=a.fields.filter(f=>f.life>0);
  for(const q of a.projectiles){
    q.life-=DT;
    // Substeps prevent tunnelling through small bodies and walls.
    for(let i=0;i<4&&q.life>0;i++){
      q.x+=Math.sin(q.angle)*q.speed*DT/4;q.z+=Math.cos(q.angle)*q.speed*DT/4;
      const prop=s.breakables.find(b=>!b.broken&&Math.hypot(b.def.x-q.x,b.def.z-q.z)<BREAKABLE[b.def.kind].radius+.1);
      if(prop){hitBreakable(s,prop);q.life=0;break;}
      if(s.level.blocked(q.x,q.z,.1)){q.life=0;break;}
      for(const e of s.enemies)if(e.state!=='dead'&&!q.hits.includes(e.id)&&Math.hypot(e.x-q.x,e.z-q.z)<e.def.radius+.15){
        q.hits.push(e.id);hit(s,e,q.damage);onCombatHit(s,e,q.damage,hit);
        if(q.pierce--<=0){q.life=0;break;}
      }
    }
  }
  a.projectiles=a.projectiles.filter(q=>q.life>0);
  for(const e of s.enemies){const ail=a.ailments[e.id];if(!ail)continue;
    ail.acid=Math.max(0,ail.acid-DT);if(ail.burn>0){ail.burn-=DT;ail.tick-=DT;if(ail.tick<=0){ail.tick=.5;hit(s,e,ail.dps*.5,'light',0);}}
    if(e.state==='dead')delete a.ailments[e.id];
  }
}
export function damageBonus(s:Sim,e:Enemy,d:number):number {
  const b=s.abilities.banner;
  return d*(1+(e.def.boss?.25:0)*pk(s,'breaker'))*(s.abilities.ailments[e.id]?.acid?1.25:1)*(b&&Math.hypot(s.player.x-b.x,s.player.z-b.z)<3.4?1.5:1);
}
export function onCombatHit(s:Sim,e:Enemy,d:number,hit:Damage):void {
  if(e.state==='dead')return;
  if(pk(s,'exec')&&!e.def.boss&&e.hp<e.maxHp*.12){hit(s,e,e.hp);return;}
  const ail=s.abilities.ailments[e.id]??={burn:0,dps:0,acid:0,tick:0};
  const proc=():boolean=>!!(pk(s,'d_kurz')&&s.player.critical)||s.rng.next()<s.stats.elementChance;
  const mul=s.stats.elementPower;
  if(s.stats.elements.includes('fire')&&proc()){ail.burn=2;ail.dps=Math.max(ail.dps,.45*d*mul);}
  if(s.stats.elements.includes('acid')&&proc())ail.acid=3;
  if(s.stats.elements.includes('shock')&&proc()){
    const near=s.enemies.filter(t=>t!==e&&t.state!=='dead'&&Math.hypot(t.x-e.x,t.z-e.z)<3).slice(0,2+2*pk(s,'chain'));
    for(const t of near)hit(s,t,.5*d*mul);
  }
}
export function onCombatKill(s:Sim,_e:Enemy,_hit:Damage):void {
  s.player.hp=Math.min(s.stats.maxHp,s.player.hp+s.stats.maxHp*.01*pk(s,'leech'));
  if(pk(s,'d_sturm')&&s.abilities.sprint>0)s.player.dodgeCd=0;
  if(s.stats.kind==='blade'&&s.equipment.w?.power===1)s.abilities.powerCd=0;
}
export function onIncoming(s:Sim,e:Enemy,d:number,hit:Damage):number {
  if(s.abilities.guard>0)d*=.3;
  if(pk(s,'retour'))s.abilities.retaliate=true;
  if(pk(s,'thorns'))hit(s,e,s.stats.damage*.6*pk(s,'thorns'));
  if(d>=s.player.hp&&pk(s,'second')&&!s.abilities.secondUsed){s.abilities.secondUsed=true;return Math.max(0,s.player.hp-1);}
  return d;
}
