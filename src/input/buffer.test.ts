import { describe, expect, it } from 'vitest';
import { ActionBuffer } from './buffer';

describe('ActionBuffer', () => {
  it('keeps a press for the window and then drops it', () => {
    const b = new ActionBuffer(0.18);
    b.press('attack');
    b.tick(0.1, false);
    expect(b.has('attack')).toBe(true);
    b.tick(0.1, false);
    expect(b.has('attack')).toBe(false);
  });

  it('does not expire during hitstop', () => {
    const b = new ActionBuffer(0.18);
    b.press('dodge');
    b.tick(1, true);
    expect(b.has('dodge')).toBe(true);
  });

  it('consumes one action without touching the other', () => {
    const b = new ActionBuffer();
    b.press('attack');
    b.press('dodge');
    b.consume('attack');
    expect(b.has('attack')).toBe(false);
    expect(b.has('dodge')).toBe(true);
  });
});
