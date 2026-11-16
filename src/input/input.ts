// Devices → actions. Keyboard and mouse, gamepad (standard mapping) and touch all feed the same
// move vector and the same input buffer. `poll` runs every render frame, also during hitstop.
import { ActionBuffer, type Action } from './buffer';

export type Device = 'keyboard' | 'mouse' | 'gamepad' | 'touch';

const DEADZONE = 0.22;
/** Standard mapping: A/LT dodge, X/RB/RT attack, B power, LB ultimate, Y inventory. */
const PAD_DODGE = [0, 6];
const PAD_ATTACK = [2, 5, 7];
const PAD_MENU = 9;

const KEY_ATTACK = new Set(['KeyJ', 'Enter', 'KeyF']);
const KEY_DODGE = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyK']);

export class Input {
  readonly buffer = new ActionBuffer();
  /** Move vector, length 0..1. Screen up is north (-Z). */
  moveX = 0;
  moveZ = 0;
  /** Right stick aim (unit) or 0,0. */
  stickX = 0;
  stickZ = 0;
  /** Last pointer position in client pixels, for mouse aim. */
  pointerX = 0;
  pointerY = 0;
  /** The device that pressed the last action. Mouse aims at the cursor, the others use aim assist. */
  device: Device = 'keyboard';
  /** Gameplay presses are ignored while a menu is open. */
  enabled = false;
  onMenu: () => void = () => {};
  onInventory: () => void = () => {};

  clear(): void { this.keys.clear(); this.touchX = this.touchZ = 0; this.buffer.clear(); }

  private readonly keys = new Set<string>();
  private touchX = 0;
  private touchZ = 0;
  private padDown: boolean[] = [];
  private pad: Gamepad | null = null;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.onMenu();
        return;
      }
      if (e.code === 'KeyI' || (e.code === 'Tab' && this.enabled)) { e.preventDefault(); this.onInventory(); return; }
      if (!this.enabled) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.press('power', 'keyboard');
      if (e.code === 'KeyR') this.press('ultimate', 'keyboard');
      if (KEY_ATTACK.has(e.code)) this.press('attack', 'keyboard');
      if (KEY_DODGE.has(e.code)) {
        e.preventDefault();
        this.press('dodge', 'keyboard');
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    });
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      if (e.button === 0) this.press('attack', 'mouse');
      if (e.button === 2) this.press('dodge', 'mouse');
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  press(action: Action, device: Device): void {
    if (!this.enabled) return;
    this.device = device;
    this.buffer.press(action);
  }

  /** Virtual stick from the touch UI. */
  setTouchMove(x: number, z: number): void {
    this.touchX = x;
    this.touchZ = z;
    if (x !== 0 || z !== 0) this.device = 'touch';
  }

  /** Reads the gamepad and composes the move vector. */
  poll(dt: number, frozen: boolean): void {
    this.buffer.tick(dt, frozen);
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (x !== 0 || z !== 0) {
      const len = Math.hypot(x, z);
      x /= len;
      z /= len;
    }
    x += this.touchX;
    z += this.touchZ;

    this.stickX = 0;
    this.stickZ = 0;
    this.pad = null;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      this.pad = pad;
      const lx = pad.axes[0] ?? 0;
      const lz = pad.axes[1] ?? 0;
      const lm = Math.hypot(lx, lz);
      if (lm > DEADZONE) {
        // Rescale so the stick starts at 0 right after the deadzone.
        const s = Math.min(1, (lm - DEADZONE) / (1 - DEADZONE)) / lm;
        x += lx * s;
        z += lz * s;
        this.device = 'gamepad';
      }
      const rx = pad.axes[2] ?? 0;
      const rz = pad.axes[3] ?? 0;
      const rm = Math.hypot(rx, rz);
      if (rm > 0.5) {
        this.stickX = rx / rm;
        this.stickZ = rz / rm;
      }
      const down = pad.buttons.map((b) => b.pressed || b.value > 0.5);
      const edge = (i: number): boolean => (down[i] ?? false) && !(this.padDown[i] ?? false);
      if (PAD_ATTACK.some(edge)) this.press('attack', 'gamepad');
      if (PAD_DODGE.some(edge)) this.press('dodge', 'gamepad');
      if (edge(1)) this.press('power', 'gamepad');
      if (edge(4)) this.press('ultimate', 'gamepad');
      if (edge(3)) this.onInventory();
      if (edge(PAD_MENU)) this.onMenu();
      this.padDown = down;
      break;
    }
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    this.moveX = x;
    this.moveZ = z;
  }

  /** Short dual-rumble pulse. Chrome supports it; other browsers ignore the call. */
  rumble(strength: number, ms: number): void {
    const actuator = this.pad?.vibrationActuator;
    if (!actuator || typeof actuator.playEffect !== 'function') return;
    void actuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => {});
  }
}
