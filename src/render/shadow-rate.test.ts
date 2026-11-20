import { describe, expect, it } from 'vitest';
import { shadowDue, ShadowClock } from './shadow-rate';

/** Which of `n` frames render the shadow map. */
const pattern = (every: number, n: number): string => {
  const clock = new ShadowClock(every);
  let out = '';
  for (let i = 0; i < n; i++) out += clock.tick() ? 'S' : '.';
  return out;
};

describe('shadow map rate', () => {
  it('every 1 renders every frame', () => {
    expect(shadowDue(0, 1)).toBe(true);
    expect(pattern(1, 6)).toBe('SSSSSS');
  });

  it('every 2nd frame, whatever the frame rate (30 fps saves as much as 60)', () => {
    expect(pattern(2, 8)).toBe('S.S.S.S.');
    expect(pattern(3, 9)).toBe('S..S..S..');
  });

  it('invalidate forces the next frame', () => {
    const clock = new ShadowClock(2);
    expect(clock.tick()).toBe(true);
    clock.invalidate();
    expect(clock.tick()).toBe(true);
    expect(clock.tick()).toBe(false);
    expect(clock.tick()).toBe(true);
  });
});
