import { describe, expect, it } from 'vitest';
import { campOpen, LINE_FREED, LINES, linePlayable, NET_BADGES, NET_ROUTES, stopName, STOPS, tunnelName } from './lines';

describe('M20 S+U network (2D js/ubahn.js)', () => {
  it('one route and badge per line, each joining two stops', () => {
    expect(NET_ROUTES.length).toBe(LINES.length);
    expect(NET_BADGES.length).toBe(LINES.length);
    expect(STOPS.length).toBe(LINES.length + 1);
    NET_ROUTES.forEach((r, k) => { expect(r[0]).toEqual(STOPS[k]!.at); expect(r.at(-1)).toEqual(STOPS[k + 1]!.at); });
  });
  it('every route starts and ends at its two stops, runs straight or at 45° and passes no other stop (M16 C3)', () => {
    NET_ROUTES.forEach((r, k) => {
      expect(r[0], `line ${k} start`).toEqual(STOPS[k]!.at);
      expect(r.at(-1), `line ${k} end`).toEqual(STOPS[k + 1]!.at);
      for (let i = 1; i < r.length; i++) {
        const dx = Math.abs(r[i]![0] - r[i - 1]![0]), dy = Math.abs(r[i]![1] - r[i - 1]![1]);
        expect(dx === 0 || dy === 0 || dx === dy, `line ${k} segment ${i}`).toBe(true);
      }
      // Distance from every other stop to the route: clear of its 24 × 18 node.
      for (const [j, st] of STOPS.entries()) {
        if (j === k || j === k + 1) continue;
        const [px, py] = st.at;
        for (let i = 1; i < r.length; i++) {
          const [ax, ay] = r[i - 1]!, [bx, by] = r[i]!, l2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2));
          expect(Math.hypot(px - ax - (bx - ax) * t, py - ay - (by - ay) * t), `line ${k} near ${st.name}`).toBeGreaterThan(16);
        }
      }
    });
  });
  it('line 3 is the U2 on to Zoologischer Garten, west of Mitte (M16 C3)', () => {
    expect(LINES[3]).toEqual({ id: 'U2', color: '#da421e', ghost: 'Bülowstraße', name: 'U2-Tunnel West' });
    expect(LINES[2]!.id).toBe(LINES[3]!.id);
    expect(STOPS[4]!.station).toBe('S+U Zoologischer Garten');
    expect(STOPS[4]!.map).toBe('charlottenburg');
    // Step 8: tunnel names (map name and run-save key) differ per line; the older ones keep theirs.
    expect(LINES.map((_, k) => tunnelName(k))).toEqual(['S3-Tunnel', 'U8-Tunnel', 'U2-Tunnel', 'U2-Tunnel West', 'U9-Tunnel']);
    expect(stopName(4)).toBe('Zoologischer Garten');
    expect(STOPS[4]!.at[0]).toBeLessThan(STOPS[3]!.at[0] - 40);
  });
  it('line 4 is the U9 from Zoologischer Garten north to Leopoldplatz, Wedding north of Zoo and Mitte (M18 W3)', () => {
    expect(LINES[4]).toEqual({ id: 'U9', color: '#f3791d', ghost: 'Westhafen', name: 'U9-Tunnel' });
    expect(STOPS[5]).toMatchObject({ name: 'Wedding', station: 'U Leopoldplatz', map: 'wedding' });
    expect(tunnelName(4)).toBe('U9-Tunnel');
    expect(stopName(5)).toBe('Leopoldplatz');
    expect(STOPS[5]!.at[1]).toBeLessThan(STOPS[3]!.at[1] - 40);
    expect(STOPS[5]!.at[1]).toBeLessThan(STOPS[4]!.at[1] - 40);
    expect(linePlayable(4, [0, 1, 2, 3])).toBe(false);
    expect(linePlayable(4, [0, 1, 2, 3, 4])).toBe(true);
  });
  it('the camp opens with the S3, not with Köpenick (F1)', () => {
    expect(campOpen([])).toBe(false);
    expect(campOpen([0])).toBe(false);
    expect(campOpen([0, LINE_FREED])).toBe(true);
  });
  it('a line is ridden once its start is freed and its end has a map: the S3, the U8 to the Alex, the U2 to Mitte (M15)', () => {
    expect(linePlayable(0, [])).toBe(false);
    expect(linePlayable(0, [0])).toBe(true);
    expect(linePlayable(1, [0, LINE_FREED])).toBe(false);
    expect(linePlayable(1, [0, 1, LINE_FREED])).toBe(true);
    expect(linePlayable(2, [0, 1, LINE_FREED, LINE_FREED + 1])).toBe(false);
    expect(linePlayable(2, [0, 1, 2, LINE_FREED, LINE_FREED + 1])).toBe(true);
    expect(linePlayable(3, [0, 1, 2, LINE_FREED, LINE_FREED + 1, LINE_FREED + 2])).toBe(false);
    expect(linePlayable(3, [0, 1, 2, 3, LINE_FREED, LINE_FREED + 1, LINE_FREED + 2])).toBe(true);
    expect(stopName(1)).toBe('Warschauer Straße');
    expect(stopName(3)).toBe('Potsdamer Platz');
  });
});

describe('next destination (playtest 2026-11-18)', () => {
  it('leads on: Köpenick, the S3, Xhain, the U8, the Alex, the U2, Mitte', async () => {
    const { nextDestination, LINE_FREED } = await import('./lines');
    expect(nextDestination([])).toEqual({ stop: 0 });
    expect(nextDestination([0])).toEqual({ line: 0 });
    expect(nextDestination([0, LINE_FREED])).toEqual({ stop: 1 });
    expect(nextDestination([0, LINE_FREED, 1])).toEqual({ line: 1 });
    expect(nextDestination([0, LINE_FREED, 1, LINE_FREED + 1])).toEqual({ stop: 2 });
    expect(nextDestination([0, LINE_FREED, 1, LINE_FREED + 1, 2])).toEqual({ line: 2 });
    expect(nextDestination([0, LINE_FREED, 1, LINE_FREED + 1, 2, LINE_FREED + 2])).toEqual({ stop: 3 });
    // M16 step 8: on through the U2 west to Charlottenburg.
    expect(nextDestination([0, LINE_FREED, 1, LINE_FREED + 1, 2, LINE_FREED + 2, 3])).toEqual({ line: 3 });
    expect(nextDestination([0, LINE_FREED, 1, LINE_FREED + 1, 2, LINE_FREED + 2, 3, LINE_FREED + 3])).toEqual({ stop: 4 });
    // M18 step 3: on through the U9 to Wedding.
    expect(nextDestination([0, LINE_FREED, 1, LINE_FREED + 1, 2, LINE_FREED + 2, 3, LINE_FREED + 3, 4])).toEqual({ line: 4 });
    expect(nextDestination([0, LINE_FREED, 1, LINE_FREED + 1, 2, LINE_FREED + 2, 3, LINE_FREED + 3, 4, LINE_FREED + 4])).toEqual({ stop: 5 });
  });
});
