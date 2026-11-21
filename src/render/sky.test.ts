import { describe, expect, it } from 'vitest';
import { charlottenburgMap } from '../data/charlottenburg';
import { CHARLOTTENBURG_SKIES, mixSky, NIGHT_SKY, skyFor, skyZoneAt, zoneSkies } from './sky';
import { SKY_BLEND, SkyBlend } from './sky-blend';

describe('M16 sky per zone (step 3a)', () => {
  const m = charlottenburgMap(1);

  it('every fight lies in its own zone sky, the start in the first', () => {
    for (const e of m.encounters) expect(skyZoneAt(m.encounters, e.x, e.z), e.id).toBe(e.zone);
    expect(skyZoneAt(m.encounters, m.start.x, m.start.z)).toBe(0);
  });

  it('four skies, one light direction; `?sky=one` falls back to the Premierennacht', () => {
    expect(CHARLOTTENBURG_SKIES).toHaveLength(4);
    for (const s of CHARLOTTENBURG_SKIES) expect(s.sun.from).toEqual(NIGHT_SKY.sun.from);
    expect(zoneSkies('charlottenburg', null)).toBe(CHARLOTTENBURG_SKIES);
    expect(zoneSkies('charlottenburg', 'one')).toBeNull();
    expect(zoneSkies('mitte', null)).toBeNull();
    expect(skyFor('charlottenburg', 'one')).toBe(CHARLOTTENBURG_SKIES[1]);
  });

  it('mixSky hits both ends and blends colours channel by channel', () => {
    const [a, b] = [CHARLOTTENBURG_SKIES[0]!, CHARLOTTENBURG_SKIES[3]!];
    expect(mixSky(a, b, 0).background).toBe(a.background);
    expect(mixSky(a, b, 1).background).toBe(b.background);
    expect(mixSky(a, b, 1).look.exposure).toBeCloseTo(b.look.exposure!);
    expect(mixSky({ ...a, background: 0x000000 }, { ...b, background: 0xff0080 }, 0.5).background).toBe(0x800040);
  });

  it('blends over SKY_BLEND seconds and switches the reflection map at the middle', () => {
    let zone = 0;
    const blend = new SkyBlend(CHARLOTTENBURG_SKIES, () => zone, 0, 0);
    expect(blend.update(1 / 60, 0, 0)).toBe(false);
    zone = 1;
    let t = 0;
    while (t < SKY_BLEND * 0.45) { blend.update(1 / 60, 0, 0); t += 1 / 60; }
    expect(blend.envZone).toBe(0);
    while (t < SKY_BLEND * 1.01) { blend.update(1 / 60, 0, 0); t += 1 / 60; }
    expect(blend.envZone).toBe(1);
    expect(blend.now).toBe(CHARLOTTENBURG_SKIES[1]);
    expect(blend.update(1 / 60, 0, 0)).toBe(false);
  });
});
