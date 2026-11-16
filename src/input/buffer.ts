// Input buffer: a press stays valid for a short window and fires at the first legal sim step.
// It is fed every render frame (also during hitstop) and does not expire while the world is frozen.
import { INPUT_BUFFER } from '../data/combat';

export type Action = 'attack' | 'dodge' | 'power' | 'ultimate' | 'verband' | 'molotow';
const ACTIONS: readonly Action[] = ['attack', 'dodge', 'power', 'ultimate', 'verband', 'molotow'];

export class ActionBuffer {
  private readonly left: Record<Action, number> = { attack: 0, dodge: 0, power: 0, ultimate: 0, verband: 0, molotow: 0 };

  constructor(private readonly window: number = INPUT_BUFFER) {}

  press(action: Action): void {
    this.left[action] = this.window;
  }

  has(action: Action): boolean {
    return this.left[action] > 0;
  }

  consume(action: Action): void {
    this.left[action] = 0;
  }

  /** Ages the buffer by `dt` seconds. A frozen world (hitstop) keeps presses alive. */
  tick(dt: number, frozen: boolean): void {
    if (frozen) return;
    for (const a of ACTIONS) this.left[a] = Math.max(0, this.left[a] - dt);
  }

  clear(): void {
    for (const a of ACTIONS) this.left[a] = 0;
  }
}
