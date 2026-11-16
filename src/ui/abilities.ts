import { PERKS } from '../data/progression';
import { chooseBlessing, POWERS, selectPower } from '../sim/abilities';
import type { Sim } from '../sim/types';

/** Existing panel/button styling; no new layout system. Keyboard, pad and touch use the same choices. */
export class AbilitiesUi {
  readonly panel = document.createElement('div');
  readonly hud = document.createElement('div');
  onChoose:()=>void = ()=>{};
  private signature = '';
  private sim: Sim | null = null;
  private padDown: boolean[] = [];
  private choices: HTMLButtonElement[] = [];
  private selection = 0;
  private focusWas: HTMLElement | null = null;
  constructor() {
    this.panel.id = 'blessings'; this.panel.className = 'overlay'; this.panel.hidden = true;
    this.panel.innerHTML = '<div class="panel"><h2>Zeitsplitter</h2><div id="blessing-choices"></div></div>';
    this.hud.id = 'ability-hud'; this.hud.hidden = true;
    document.body.append(this.panel, this.hud);
    window.addEventListener('keydown', e => {
      if (!this.open) return;
      if (['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Tab'].includes(e.code)) {
        e.preventDefault(); this.focus(this.selection + (e.code==='ArrowLeft'||e.code==='ArrowUp'||e.shiftKey?-1:1));
      } else if(['Digit1','Digit2','Digit3'].includes(e.code))this.choices[Number(e.code.slice(-1))-1]?.click();
    });
  }
  get open(): boolean { return !this.panel.hidden; }
  private focus(n:number):void { if(!this.choices.length)return;this.selection=(n+this.choices.length)%this.choices.length;this.choices[this.selection]?.focus(); }
  update(sim:Sim,visible:boolean):void {
    this.sim=sim;
    const offers=sim.abilities.offers, signature=offers.join(',');
    const wasOpen=this.open;
    this.panel.hidden=!visible||!offers.length; this.hud.hidden=!visible||!!offers.length;
    if(this.open&&!wasOpen)this.focusWas=document.activeElement as HTMLElement;
    if(signature!==this.signature){
      this.signature=signature;
      const host=this.panel.querySelector('#blessing-choices')!;host.replaceChildren();
      this.choices=offers.map((id,i)=>{
        const p=PERKS.find(p=>p.id===id)!;const b=document.createElement('button');b.className='choice';
        const name=document.createElement('b'),desc=document.createElement('span');name.textContent=`${i+1} · ${p.name}`;desc.textContent=p.description;
        const families=p.duo??p.families;
        if(families?.length)b.title=families.join(' · ');
        b.append(name,desc);b.addEventListener('click',()=>{if(this.sim&&chooseBlessing(this.sim,id))this.onChoose();});host.append(b);return b;
      });this.selection=0;
    }
    if(this.open&&!wasOpen)this.focus(0);
    if(!this.open&&wasOpen)this.focusWas?.focus();
    if(this.open){
      const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);
      const down=pad?.buttons.map(b=>b.pressed)??[],edge=(i:number)=>down[i]&&!this.padDown[i];
      if(edge(14)||edge(12))this.focus(this.selection-1);if(edge(15)||edge(13))this.focus(this.selection+1);
      if(edge(0))this.choices[this.selection]?.click();this.padDown=down;
    }
    const q=POWERS[sim.stats.kind],a=sim.abilities,which=sim.equipment.w?.power??0;
    // Stable controls: do not replace a focused button on every frame.
    if(!this.hud.firstChild){
      const line=document.createElement('span'),swap=document.createElement('button');swap.textContent='Kraft wechseln';
      swap.addEventListener('click',()=>{const s=this.sim;if(s)selectPower(s,s.equipment.w?.power===1?0:1);});this.hud.append(line,swap);
    }
    this.hud.firstChild!.textContent=`E / B · ${q[which===0?0:2]} ${a.powerCd>0?Math.ceil(a.powerCd)+' s':'bereit'} · R / LB · ${q[4]} ${a.ultimateCd>0?Math.ceil(a.ultimateCd)+' s':'bereit'} `;
    for(const [id,cd,name] of [['btn-power',a.powerCd,q[which===0?0:2]],['btn-ultimate',a.ultimateCd,q[4]]] as const){
      const b=document.getElementById(id) as HTMLButtonElement;b.textContent=cd>0?`${name} ${Math.ceil(cd)}`:name;b.disabled=cd>0;
    }
  }
}
