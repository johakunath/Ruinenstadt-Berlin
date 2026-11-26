import { describe, expect, it } from 'vitest';
import { isTap, stickScroll } from './drag-scroll';

describe('isTap', () => {
  it('a press that stays put is a tap, a drag is not', () => {
    expect(isTap({ x: 10, y: 10 }, { x: 14, y: 13 })).toBe(true);
    expect(isTap({ x: 10, y: 10 }, { x: 10, y: 60 })).toBe(false);
    expect(isTap(null, { x: 10, y: 10 })).toBe(false);
  });
});

describe('stickScroll', () => {
  it('ignores a resting stick and scrolls with a pushed one', () => {
    const el = { scrollTop: 100 } as HTMLElement;
    stickScroll(el, 0.2);
    expect(el.scrollTop).toBe(100);
    stickScroll(el, 1);
    expect(el.scrollTop).toBeGreaterThan(100);
    stickScroll(el, -1);
    stickScroll(el, -1);
    expect(el.scrollTop).toBeLessThan(100);
  });
});
