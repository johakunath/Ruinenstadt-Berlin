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
  it('a line is ridden once its start is freed and its end has a map: the S3 and the U8 to the Alex (M15)', () => {
    expect(linePlayable(0, [])).toBe(false);
    expect(linePlayable(0, [0])).toBe(true);
    expect(linePlayable(1, [0, LINE_FREED])).toBe(false);
    expect(linePlayable(1, [0, 1, LINE_FREED])).toBe(true);
    expect(linePlayable(2, [0, 1, 2, LINE_FREED, LINE_FREED + 1])).toBe(false);
    expect(stopName(1)).toBe('Warschauer Straße');
  });
});

describe('next destination (playtest 2026-11-18)', () => {
  it('leads on: Köpenick, the S3, Xhain, the U8', async () => {
    const { nextDestination, LINE_FREED } = await import('./lines');
    expect(nextDestination([])).toEqual({ stop: 0 });
    expect(nextDestination([0])).toEqual({ line: 0 });
    expect(nextDestination([0, LINE_FREED])).toEqual({ stop: 1 });
    expect(nextDestination([0, LINE_FREED, 1])).toEqual({ line: 1 });
  });
});
