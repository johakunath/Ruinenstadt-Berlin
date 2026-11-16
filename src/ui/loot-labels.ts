// Loot UI (M4): pooled name labels over drops (at most 12), floating "+3 Schrott" texts and a
// small toast line. Positions come from the renderer's screen projection (`screenOf`).
import { RARITIES } from '../data/items';
import { dropColor, LOOT, type Drop } from '../sim/loot';
import type { Sim } from '../sim/types';

const LABELS = 12;
const FLOATS = 8;

export type ScreenOf = (x: number, y: number, z: number) => { x: number; y: number };

export class LootLabels {
  private readonly labels: HTMLDivElement[] = [];
  private readonly floats: Array<{ el: HTMLDivElement; t: number; x: number; y: number; z: number }> = [];
  private floatNext = 0;
  private readonly toastEl: HTMLDivElement;
  private toastT = 0;

  constructor() {
    const root = document.getElementById('loot-ui') as HTMLDivElement;
    for (let i = 0; i < LABELS; i++) {
      const d = document.createElement('div');
      d.className = 'loot-label';
      d.hidden = true;
      root.appendChild(d);
      this.labels.push(d);
    }
    for (let i = 0; i < FLOATS; i++) {
      const d = document.createElement('div');
      d.className = 'loot-float';
      d.hidden = true;
      root.appendChild(d);
      this.floats.push({ el: d, t: 0, x: 0, y: 0, z: 0 });
    }
    this.toastEl = document.getElementById('toast') as HTMLDivElement;
  }

  /** A short line at the bottom (rarity-colored name, optional ▲ for an upgrade). */
  toast(html: string, seconds = 2.6): void {
    this.toastEl.innerHTML = html;
    this.toastEl.hidden = false;
    this.toastT = seconds;
  }

  /** Text rising from a world point. */
  float(text: string, color: string, x: number, y: number, z: number): void {
    const f = this.floats[this.floatNext]!;
    this.floatNext = (this.floatNext + 1) % FLOATS;
    f.t = 1.1;
    f.x = x;
    f.y = y;
    f.z = z;
    f.el.textContent = text;
    f.el.style.color = color;
    f.el.hidden = false;
  }

  /** Magic and better or set drops always show a name; commons only close by. Nearest first, at most 12. */
  private wanted(sim: Sim): Drop[] {
    const p = sim.player;
    const list: Array<{ d: Drop; dist: number }> = [];
    for (const d of sim.drops) {
      const c = d.content;
      if (c.kind !== 'item' || !d.landed) continue;
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (c.item.rarity >= 1 || c.item.set || dist < LOOT.labelRange) list.push({ d, dist });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list.slice(0, LABELS).map((e) => e.d);
  }

  update(sim: Sim, dt: number, screenOf: ScreenOf, visible: boolean): void {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.hidden = true;
    }
    for (const f of this.floats) {
      if (f.el.hidden) continue;
      f.t -= dt;
      if (f.t <= 0 || !visible) {
        f.el.hidden = true;
        continue;
      }
      const s = screenOf(f.x, f.y + (1.1 - f.t) * 1.3, f.z);
      f.el.style.transform = `translate(${s.x.toFixed(0)}px, ${s.y.toFixed(0)}px) translate(-50%, -100%)`;
      f.el.style.opacity = String(Math.min(1, f.t * 2.5));
    }
    const drops = visible ? this.wanted(sim) : [];
    for (let i = 0; i < LABELS; i++) {
      const el = this.labels[i]!;
      const d = drops[i];
      if (!d || d.content.kind !== 'item') {
        el.hidden = true;
        continue;
      }
      const item = d.content.item;
      const s = screenOf(d.x, 1.15, d.z);
      if (el.textContent !== item.name) el.textContent = item.name;
      el.style.color = dropColor(d);
      el.dataset.rarity = String(item.rarity);
      el.style.transform = `translate(${s.x.toFixed(0)}px, ${s.y.toFixed(0)}px) translate(-50%, -100%)`;
      el.hidden = false;
    }
  }
}

/** Rarity color of an item for toasts. */
export const rarityColor = (rarity: number, set = false): string => (set ? '#5fd36f' : RARITIES[rarity as 0 | 1 | 2 | 3].color);
