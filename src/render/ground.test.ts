import { xhainMap } from '../data/xhain';
import { heightAt, inPoly } from '../data/map';
import { describe, expect, it } from 'vitest';
import { bridgeAwareSurface, GROUND_STEP, meshSurface } from './ground';

describe('meshSurface (the drawn ground)', () => {
  const hill = (x: number, z: number): number => 7 * Math.exp(-(x * x + z * z) / 200);
  const f = meshSurface(-48, -48, hill);

  it('equals the height function on the mesh vertices', () => {
    for (const [i, j] of [[0, 0], [3, 7], [32, 32], [40, 21]] as const) {
      const x = -48 + i * GROUND_STEP, z = -48 + j * GROUND_STEP;
      expect(f(x, z)).toBeCloseTo(hill(x, z), 6);
    }
  });

  it('is flat between vertices: the midpoint of the cell diagonal is the mean of its two ends', () => {
    const x = -48 + 30 * GROUND_STEP, z = -48 + 30 * GROUND_STEP;
    const mid = f(x + GROUND_STEP / 2, z + GROUND_STEP / 2);
    expect(mid).toBeCloseTo((hill(x + GROUND_STEP, z) + hill(x, z + GROUND_STEP)) / 2, 6);
    // The curved function itself lies elsewhere: this gap is what made props sink or float.
    expect(Math.abs(mid - hill(x + GROUND_STEP / 2, z + GROUND_STEP / 2))).toBeGreaterThan(0.001);
  });
});

describe('M15 bridge decks', () => {
  it('characters on the Warschauer Brücke stand on the deck, not on the blended terrain grid (Codex review, PR #46)', () => {
    const m = xhainMap(1), surface = bridgeAwareSurface(m), mesh = meshSurface(m.bounds.minX, m.bounds.minZ, (x, z) => heightAt(m, x, z));
    const deck = m.terraces.find((t) => t.bridge)!;
    // The point from the review: inside the deck, near its edge, where the grid blends in street level.
    expect(inPoly(deck.poly, 42, -99.5)).toBe(true);
    expect(mesh(42, -99.5)).toBeLessThan(deck.h - 0.5);
    expect(surface(42, -99.5)).toBe(deck.h);
    // Everywhere on the deck the full height, on the stair a ramp, off the bridge the old mesh.
    for (let t = 0.05; t < 1; t += 0.1) {
      const [a, b] = [deck.poly[0]!, deck.poly[2]!];
      expect(surface(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBe(deck.h);
    }
    const st = deck.stairs[0]!;
    expect(surface(st.x, st.z)).toBeGreaterThan(0.5);
    expect(surface(st.x, st.z)).toBeLessThan(deck.h - 0.5);
    expect(surface(m.start.x - 30, m.start.z + 60)).toBe(mesh(m.start.x - 30, m.start.z + 60));
  });
});
