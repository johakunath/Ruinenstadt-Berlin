import { describe, expect, it } from 'vitest';
import { charlottenburgMap } from '../data/charlottenburg';
import { BULB, landmarkLightPlan, PINK } from './charlottenburg-lights';

describe('Charlottenburg landmark lighting', () => {
  it.each([1, 1.3])('every sight on the list gets a light; no light or pool inside a fight circle, only at its rim (scale %s)', (scale) => {
    const m = charlottenburgMap(scale), plan = landmarkLightPlan(m);
    const lit = new Set(plan.map((p) => p.landmark.kind));
    for (const kind of ['revuepalast', 'gloriapalast', 'marmorhaus', 'ufapalast', 'capitol', 'theaterwestens', 'variete', 'cafewestens', 'kadewe', 'gedaechtniskirche',
      'zoobahnhof', 'elefantentor', 'loewentor', 'aquarium', 'opernhaus', 'schillertheater', 'chrathaus', 'chtor', 'stuelerbau', 'ehrenhoftor', 'schlossmitte',
      'orangerie', 'neuerfluegel', 'belvedere', 'mausoleum'] as const) expect(lit.has(kind), kind).toBe(true);
    for (const p of plan) for (const e of m.encounters) for (const [x, z] of [[p.x, p.z], [p.poolX, p.poolZ]] as const) {
      expect(Math.hypot(x - e.x, z - e.z), `${p.landmark.kind} in ${e.id}`).toBeGreaterThan(e.r - 2);
    }
  });

  it('adds only the two district colours to the palette', () => {
    const palette = new Set([0xff8a3c, 0xffb060, 0xffc890, 0xd8ecff, 0x5fd8c8, BULB, PINK]);
    for (const p of landmarkLightPlan(charlottenburgMap(1))) expect(palette.has(p.light.color), p.landmark.kind).toBe(true);
  });
});
