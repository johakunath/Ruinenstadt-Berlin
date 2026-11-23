// M17 Fernsehturm lift ride (T2): the screen darkens while the hero waits in an open lift ring, the sim moves the
// hero at full dark, then the curtain lifts over the next deck with its height counter.
import { LIFT } from '../sim/turm';
import type { Sim } from '../sim/types';

/** Seconds the curtain takes to lift after the ride. */
const OUT = 0.6;

export class LiftCurtain {
  private readonly root = document.createElement('div');
  private readonly label = document.createElement('div');
  /** Seconds since the last ride, Infinity when none. */
  private after = Infinity;
  private from = '';
  private to = '';
  private toN = 0;
  private fromN = 0;

  constructor() {
    this.root.className = 'lift-curtain';
    this.root.setAttribute('aria-hidden', 'true');
    Object.assign(this.root.style, { position: 'fixed', inset: '0', background: '#04090a', opacity: '0', pointerEvents: 'none', zIndex: '5', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    Object.assign(this.label.style, { font: '600 34px "Barlow Condensed", sans-serif', color: '#ead9c0', letterSpacing: '0.08em', textShadow: '0 2px 8px #000' });
    this.root.append(this.label);
    document.body.append(this.root);
  }

  /** The sim moved the hero: count from the old deck's height to the new one while the curtain lifts. */
  ride(from: string, to: string): void {
    this.after = 0;
    this.from = from;
    this.to = to;
    this.fromN = parseInt(from, 10) || 0;
    this.toN = parseInt(to, 10) || 0;
  }

  update(sim: Sim, dt: number): void {
    let k = 0;
    if (sim.lift) k = Math.min(1, sim.lift.t / LIFT.ride);
    if (this.after < OUT) {
      this.after += dt;
      k = Math.max(k, 1 - this.after / OUT);
      // The counter runs up during the cut and stands on the new height when the room shows.
      const t = Math.min(1, this.after / (OUT * 0.6));
      this.label.textContent = this.to ? `${Math.round(this.fromN + (this.toN - this.fromN) * t)} m` : '';
    } else if (sim.lift) this.label.textContent = this.from;
    this.root.style.opacity = k.toFixed(3);
    this.root.style.display = k > 0 ? 'flex' : 'none';
  }
}
