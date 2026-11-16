import { Group, Mesh, MeshBasicMaterial, SphereGeometry, RingGeometry, DoubleSide } from 'three';
import type { Sim } from '../sim/types';
import { groundY } from './ground';
import { FX_LAYER } from './layers';
/** Bounded pool, shared geometry/materials, no lights or shadows on either profile. */
export class AbilityView {
  readonly group=new Group();
  private readonly shots:Mesh[]=[];
  private readonly rings:Mesh[]=[];
  constructor(){
    const sphere=new SphereGeometry(.13,6,4),ring=new RingGeometry(.88,1,32);
    const shotMat=new MeshBasicMaterial({color:0xffdc91}),ringMat=new MeshBasicMaterial({color:0xf7b84c,transparent:true,opacity:.45,side:DoubleSide,depthWrite:false});
    for(let i=0;i<96;i++){const m=new Mesh(sphere,shotMat);m.layers.set(FX_LAYER);m.visible=false;this.group.add(m);this.shots.push(m);}
    for(let i=0;i<24;i++){const m=new Mesh(ring,ringMat);m.rotation.x=-Math.PI/2;m.layers.set(FX_LAYER);m.visible=false;this.group.add(m);this.rings.push(m);}
  }
  update(s:Sim):void {
    this.shots.forEach((m,i)=>{const q=s.abilities.projectiles[i];m.visible=!!q;if(q)m.position.set(q.x,groundY(q.x,q.z)+1,q.z);});
    const a=s.abilities,p=s.player;
    const fields=[...a.fields,...(a.spin>0?[{x:p.x,z:p.z,radius:2.8}]:[]),...(a.banner?[{...a.banner,radius:3.4}]:[])];
    this.rings.forEach((m,i)=>{const f=fields[i];m.visible=!!f;if(f){m.position.set(f.x,groundY(f.x,f.z)+.08,f.z);m.scale.setScalar(f.radius);}});
  }
}
