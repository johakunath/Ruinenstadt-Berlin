import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from './input';

describe('mouse device handoff', () => {
  let target: EventTarget;
  let input: Input;

  const move = (x: number, y = 100, pointerType = 'mouse'): void => {
    target.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: y, pointerType }));
  };

  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget());
    target = new EventTarget();
    input = new Input(target as HTMLElement);
    input.enabled = true;
    move(100);
  });
  afterEach(() => vi.unstubAllGlobals());

  for (const device of ['gamepad', 'touch'] as const) {
    const activate = (): void => {
      if (device === 'touch') input.setTouchMove(1, 0);
      else input.press('attack', 'gamepad');
    };

    it(`hands off from ${device} after several small mouse moves`, () => {
      activate();
      for (let x = 105; x <= 130; x += 5) {
        move(x);
        expect(input.device).toBe(device);
      }
      move(135);
      expect(input.device).toBe('mouse');
      expect([input.pointerX, input.pointerY]).toEqual([135, 100]);
    });

    it(`ignores repeated mouse jitter while using ${device}`, () => {
      activate();
      for (let i = 0; i < 20; i++) { move(103, 104); move(100); }
      expect(input.device).toBe(device);
    });

    it(`starts a fresh threshold when returning to ${device}`, () => {
      activate();
      move(140);
      expect(input.device).toBe('mouse');
      move(200);
      activate();
      move(205);
      expect(input.device).toBe(device);
      move(235);
      expect(input.device).toBe('mouse');
    });
  }

  it('does not count mouse movement while gameplay is disabled', () => {
    input.press('attack', 'gamepad');
    input.enabled = false;
    move(500);
    expect(input.device).toBe('gamepad');
    input.enabled = true;
    move(505);
    expect(input.device).toBe('gamepad');
    move(535);
    expect(input.device).toBe('mouse');
  });

  it('ignores touch pointer movement for mouse handoff and aim', () => {
    input.setTouchMove(1, 0);
    move(500, 600, 'touch');
    expect(input.device).toBe('touch');
    expect([input.pointerX, input.pointerY]).toEqual([100, 100]);
  });
});
