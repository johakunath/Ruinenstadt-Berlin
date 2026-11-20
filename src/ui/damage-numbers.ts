// Damage and heal numbers (2D `nums`: js/combat.js, drawn in js/render.js, moved in js/update.js).
// Dealt damage rises from the enemy's hit point, damage taken (-X) and heals (+X Leben) from the hero.
// Pooled DOM nodes, created once; per frame only transform and opacity change. Small repeated ticks
// (burn, quiet hits, regen, Verband, life per kill) are summed per target and shown every ~0.4 s.
import { ELEMENTS } from '../data/items';
import type { Sim, SimEvent } from '../sim/types';
import type { ScreenOf } from './loot-labels';

const SLOTS = 32;
/** 2D colors. */
const COL = { hit: '#ead9c0', crit: '#f2d14b', taken: '#ff6b5a', heal: '#8fd16a' } as const;
/** Seconds a number lives (2D: 0.8, heals 1.3), rise in CSS px per second (2D 32 at 2D scale). */
const LIFE = 0.8, HEAL_LIFE = 1.3, RISE = 36;
/** Merge windows: quiet hits, burn and heal ticks; regen alone only once a second. */
const MERGE = 0.4, REGEN_MERGE = 1;
/** Taken damage and heals always win a slot over dealt numbers. */
const HERO = 1e6;
/** Opacity of quiet hits and heal ticks. */
const DIM = 0.72;

type Kind = 'hit' | 'crit' | 'quiet' | 'taken' | 'heal' | 'tick';

interface Num { el: HTMLDivElement; on: boolean; t: number; life: number; x: number; y: number; z: number; jx: number; val: number; kind: Kind }
interface Req { text: string; color: string; kind: Kind; x: number; y: number; z: number; val: number }
/** Summed ticks of one target; `hero`: follows the hero, else stays at the enemy's last spot. */
interface Bucket { amount: number; t: number; window: number; color: string; hero: boolean; x: number; y: number; z: number }

/** Number height above the ground for an enemy (taller and wider bodies higher). */
function enemyY(sim: Sim, id: number): number {
  const e = sim.enemies.find((x) => x.id === id);
  return e ? 0.8 + 1.6 * e.def.radius * e.def.scale : 1.4;
}

export class DamageNumbers {
  private readonly nums: Num[] = [];
  private readonly reqs: Req[] = [];
  private readonly buckets = new Map<string, Bucket>();

  constructor() {
    const root = document.getElementById('loot-ui') as HTMLDivElement;
    for (let i = 0; i < SLOTS; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.hidden = true;
      root.appendChild(el);
      this.nums.push({ el, on: false, t: 0, life: 0, x: 0, y: 0, z: 0, jx: 0, val: 0, kind: 'hit' });
    }
  }

  /** Reads a sim event (call for every event while numbers are switched on). */
  onEvent(ev: SimEvent, sim: Sim): void {
    const p = sim.player;
    switch (ev.type) {
      case 'hit': {
        if (ev.damage <= 0) break;
        const color = ev.element ? ELEMENTS[ev.element].color : ev.critical ? COL.crit : COL.hit;
        if (ev.quiet) { this.add(`q${ev.id}`, ev.damage, MERGE, color, false, ev.x, enemyY(sim, ev.id), ev.z, ev.killed); break; }
        const d = Math.round(ev.damage);
        if (d >= 1) this.reqs.push({ text: ev.critical ? `${d}!` : `${d}`, color, kind: ev.critical ? 'crit' : 'hit', x: ev.x, y: enemyY(sim, ev.id), z: ev.z, val: d * (ev.critical ? 1.5 : 1) });
        break;
      }
      case 'dot':
        this.add(`d${ev.id}`, ev.damage, MERGE, ELEMENTS.fire.color, false, ev.x, enemyY(sim, ev.id), ev.z, ev.killed);
        break;
      case 'playerHit': {
        const d = Math.round(ev.damage);
        if (d >= 1) this.reqs.push({ text: `-${d}`, color: COL.taken, kind: 'taken', x: p.x, y: 1.9, z: p.z, val: HERO + d });
        break;
      }
      case 'heal': {
        if (ev.tick) { this.add(ev.source === 'regen' ? 'regen' : 'heal', ev.amount, ev.source === 'regen' ? REGEN_MERGE : MERGE, COL.heal, true, p.x, 2.3, p.z, false); break; }
        const h = Math.round(ev.amount);
        if (h >= 1) this.reqs.push({ text: `+${h} Leben`, color: COL.heal, kind: 'heal', x: p.x, y: 2.3, z: p.z, val: HERO + h });
        break;
      }
      default:
        break;
    }
  }

  private add(key: string, amount: number, window: number, color: string, hero: boolean, x: number, y: number, z: number, now: boolean): void {
    let b = this.buckets.get(key);
    if (!b) { b = { amount: 0, t: 0, window, color, hero, x, y, z }; this.buckets.set(key, b); }
    b.amount += amount;
    b.color = color;
    b.x = x; b.y = y; b.z = z;
    if (now) b.t = b.window;
  }

  /** Drops everything on screen and every half-summed tick (a new run, numbers switched off). */
  clear(): void {
    this.buckets.clear();
    this.reqs.length = 0;
    for (const n of this.nums) if (n.on) { n.on = false; n.el.hidden = true; }
  }

  update(sim: Sim, dt: number, screenOf: ScreenOf, visible: boolean): void {
    if (!visible) { this.clear(); return; }
    const p = sim.player;
    for (const [key, b] of this.buckets) {
      b.t += dt;
      if (b.t < b.window) continue;
      // Below 1 the sum keeps growing (slow regen shows as +1 now and then, never as 0).
      if (b.amount < 1) { b.t = 0; continue; }
      const v = Math.round(b.amount);
      if (b.hero) this.reqs.push({ text: `+${v}`, color: b.color, kind: 'tick', x: p.x, y: 2.3, z: p.z, val: HERO + v });
      else this.reqs.push({ text: `${v}`, color: b.color, kind: 'quiet', x: b.x, y: b.y, z: b.z, val: v * 0.5 });
      this.buckets.delete(key);
    }
    if (this.reqs.length) this.place();
    for (const n of this.nums) {
      if (!n.on) continue;
      n.t += dt;
      if (n.t >= n.life) { n.on = false; n.el.hidden = true; continue; }
      const s = screenOf(n.x, n.y, n.z);
      const left = n.life - n.t;
      // 2D pop: crits start half again as big and settle in ~0.2 s, plain hits a little.
      const pop = n.kind === 'crit' ? 1 + Math.max(0, 0.18 - n.t) * 3 : n.kind === 'hit' ? 1 + Math.max(0, 0.18 - n.t) * 1.2 : 1;
      n.el.style.transform = `translate(${(s.x + n.jx).toFixed(0)}px, ${(s.y - n.t * RISE).toFixed(0)}px) translate(-50%, -100%) scale(${pop.toFixed(2)})`;
      // Fades over the last half second; quiet ticks stay dimmer.
      n.el.style.opacity = (Math.min(1, left * 2) * (n.kind === 'quiet' || n.kind === 'tick' ? DIM : 1)).toFixed(2);
    }
  }

  /** Biggest first; with no free slot a number replaces the smallest one on screen if it is bigger. */
  private place(): void {
    this.reqs.sort((a, b) => b.val - a.val);
    for (const r of this.reqs) {
      let slot: Num | null = null;
      for (const n of this.nums) {
        if (!n.on) { slot = n; break; }
        if (n.val < r.val && (!slot || n.val < slot.val)) slot = n;
      }
      if (!slot) break;
      slot.on = true;
      slot.t = 0;
      slot.life = r.kind === 'heal' ? HEAL_LIFE : LIFE;
      slot.x = r.x; slot.y = r.y; slot.z = r.z;
      slot.jx = r.kind === 'hit' || r.kind === 'crit' || r.kind === 'quiet' ? (Math.random() - 0.5) * 20 : 0;
      slot.val = r.val;
      slot.kind = r.kind;
      slot.el.textContent = r.text;
      slot.el.style.color = r.color;
      slot.el.dataset.k = r.kind;
      slot.el.style.opacity = '0';
      slot.el.hidden = false;
    }
    this.reqs.length = 0;
  }
}
