import { describe, expect, it } from 'vitest';
import { GROUND_STEP, meshSurface } from './ground';

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
