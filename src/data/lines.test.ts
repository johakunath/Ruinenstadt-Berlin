import { describe, expect, it } from 'vitest';
import { campOpen, LINE_FREED, LINES, linePlayable, NET_BADGES, NET_ROUTES, stopName, STOPS } from './lines';

describe('M20 S+U network (2D js/ubahn.js)', () => {
  it('one route and badge per line, each joining two stops', () => {
    expect(NET_ROUTES.length).toBe(LINES.length);
    expect(NET_BADGES.length).toBe(LINES.length);
    expect(STOPS.length).toBe(LINES.length + 1);
    NET_ROUTES.forEach((r, k) => { expect(r[0]).toEqual(STOPS[k]!.at); expect(r.at(-1)).toEqual(STOPS[k + 1]!.at); });
  });
  it('the camp opens with the S3, not with Köpenick (F1)', () => {
    expect(campOpen([])).toBe(false);
    expect(campOpen([0])).toBe(false);
    expect(campOpen([0, LINE_FREED])).toBe(true);
  });
  it('a line is ridden once its start is freed and its end has a map: only the S3 today', () => {
    expect(linePlayable(0, [])).toBe(false);
    expect(linePlayable(0, [0])).toBe(true);
    expect(linePlayable(1, [0, 1, LINE_FREED])).toBe(false);
    expect(stopName(1)).toBe('Warschauer Straße');
  });
});
