import { describe, expect, it } from 'vitest';
import { weddingMap } from '../data/wedding';
import { weddingLights } from './wedding-lights';

describe('Wedding landmark lighting (M18 step 3)', () => {
  it.each([1, 1.3])('every sight gets a light; none stands or pools inside a fight circle, only at its rim; the pub is its own arena (scale %s)', (scale) => {
    const m = weddingMap(scale), plan = weddingLights(m);
    const lit = new Set(plan.map((p) => p.landmark.kind));
    for (const kind of ['ubahn', 'nazareth', 'neubau', 'kneipe', 'amtsgericht', 'flakturm', 'beamtentor', 'maschinenhalle'] as const) expect(lit.has(kind), kind).toBe(true);
    for (const p of plan) for (const e of m.encounters) {
      if (e.room) continue;
      for (const [x, z] of [[p.x, p.z], [p.poolX, p.poolZ]] as const) expect(Math.hypot(x - e.x, z - e.z), `${p.landmark.kind} in ${e.id}`).toBeGreaterThan(e.r - 2);
    }
  });

  it('adds no light colour to the palette (lamp, string lights, fire, cold LED, teal)', () => {
    const palette = new Set([0xff8a3c, 0xffb060, 0xffc890, 0xd8ecff, 0x5fd8c8]);
    for (const p of weddingLights(weddingMap(1))) expect(palette.has(p.light.color), p.landmark.kind).toBe(true);
  });
});
