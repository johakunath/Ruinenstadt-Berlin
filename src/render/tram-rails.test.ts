import { describe, expect, it } from 'vitest';
import { tramOffsetPoint, TRAM_GAUGE, TRAM_RAILS, TRAM_SECTION } from './tram-rails';

describe('embedded tram rails', () => {
  it('uses standard gauge measured between the running faces of both tracks', () => {
    const head = TRAM_SECTION.find(s => s.kind === 'head')!;
    for (const first of [0, 2]) {
      expect(TRAM_RAILS[first + 1]!.offset - TRAM_RAILS[first]!.offset - head.width).toBeCloseTo(TRAM_GAUGE);
      expect(TRAM_RAILS[first]!.inward).toBe(1);
      expect(TRAM_RAILS[first + 1]!.inward).toBe(-1);
    }
  });
  it('places the flange groove between the head and the guard, toward the track interior', () => {
    const head = TRAM_SECTION.find(s => s.kind === 'head')!;
    const groove = TRAM_SECTION.find(s => s.kind === 'groove')!;
    const guard = TRAM_SECTION.find(s => s.kind === 'guard')!;
    expect(groove.offset - groove.width / 2).toBeCloseTo(head.width / 2);
    expect(groove.offset + groove.width / 2).toBeCloseTo(guard.offset - guard.width / 2);
    expect(groove.height).toBeLessThan(Math.min(head.height, guard.height));
  });
  it('keeps the perpendicular offset through a bend, instead of leaving gaps between boxes', () => {
    expect(tramOffsetPoint([[0, 0], [0, 10], [10, 10]], 1, 1)).toEqual([1, 9]);
    expect(tramOffsetPoint([[0, 0], [0, 10]], 0, 1)).toEqual([1, 0]);
    expect(tramOffsetPoint([[0, 0], [0, 10]], 1, 1)).toEqual([1, 10]);
    expect(tramOffsetPoint([[0, 0], [0, 10], [10, 10]], 1, -1)).toEqual([-1, 11]);
  });
});
