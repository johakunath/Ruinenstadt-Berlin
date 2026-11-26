import { describe, expect, it } from 'vitest';
import { isTap, pollDt, stickScroll } from './drag-scroll';

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
    stickScroll(el, 0.2, 1 / 60);
    expect(el.scrollTop).toBe(100);
    stickScroll(el, 1, 1 / 60);
    expect(el.scrollTop).toBeGreaterThan(100);
    stickScroll(el, -1, 1 / 60);
    stickScroll(el, -1, 1 / 60);
    expect(el.scrollTop).toBeLessThan(100);
  });
  it('scrolls the same distance per second at 30 and 90 polls a second', () => {
    const a = { scrollTop: 0 } as HTMLElement, b = { scrollTop: 0 } as HTMLElement;
    for (let i = 0; i < 30; i++) stickScroll(a, 1, 1 / 30);
    for (let i = 0; i < 90; i++) stickScroll(b, 1, 1 / 90);
    expect(a.scrollTop).toBeCloseTo(b.scrollTop, 6);
  });
  it('pollDt: seconds since the last poll, 0 at the start, capped after a pause', () => {
    expect(pollDt(1000, 0)).toBe(0);
    expect(pollDt(1016, 1000)).toBeCloseTo(0.016);
    expect(pollDt(5000, 1000)).toBe(0.1);
  });
});
