import { describe, expect, it } from 'vitest';
import { shadowDue, ShadowClock } from './shadow-rate';

/** Which of `n` frames at `hz` render the shadow map. */
const pattern = (interval: number, hz: number, n: number): string => {
  const clock = new ShadowClock(interval);
  let out = '';
  for (let i = 0; i < n; i++) out += clock.tick(1 / hz) ? 'S' : '.';
  return out;
};

describe('shadow map rate', () => {
  it('interval 0 renders every frame', () => {
    expect(shadowDue(0, 0)).toBe(true);
    expect(pattern(0, 60, 6)).toBe('SSSSSS');
  });

  it('Leistung (1/40 s): every 2nd frame at 60 fps, every frame at 30 fps, every 3rd at 120 Hz', () => {
    expect(pattern(1 / 40, 60, 8)).toBe('S.S.S.S.');
    expect(pattern(1 / 40, 30, 4)).toBe('SSSS');
    expect(pattern(1 / 40, 120, 9)).toBe('S..S..S..');
  });

  it('invalidate forces the next frame', () => {
    const clock = new ShadowClock(1 / 40);
    expect(clock.tick(1 / 60)).toBe(true);
    clock.invalidate();
    expect(clock.tick(1 / 60)).toBe(true);
    expect(clock.tick(1 / 60)).toBe(false);
    expect(clock.tick(1 / 60)).toBe(true);
  });
});
