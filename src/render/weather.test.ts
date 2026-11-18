import { describe, expect, it } from 'vitest';
import { FogExp2, Scene } from 'three';
import { koepenickMap } from '../data/koepenick';
import { KOEPENICK_WEATHER, Weather } from './weather';

describe('M11c weather per zone (variant A)', () => {
  const m = koepenickMap(1);
  it('rain in the Bahnhofsviertel, fog in the Müggelberge, ash in the Spreepark, clear in the Altstadt', () => {
    const w = new Weather(new Scene(), m, KOEPENICK_WEATHER, 0.5);
    expect(w.kindAt(m.encounters[0]!.x, m.encounters[0]!.z)).toBe('rain');
    expect(w.kindAt(120, 110)).toBe('fog');
    expect(w.kindAt(-130, -20)).toBe('ash');
    expect(w.kindAt(10, 0)).toBe('clear');
  });
  it('eases the fog density towards the zone weather and fades its particles in', () => {
    const scene = new Scene(); scene.fog = new FogExp2(0, 0.017);
    const w = new Weather(scene, m, KOEPENICK_WEATHER, 0.5);
    for (let i = 0; i < 300; i++) w.update(1 / 30, 120, 110, i / 30);
    expect((scene.fog as FogExp2).density).toBeGreaterThan(0.027);
    expect(w.current).toBe('fog');
  });
});

describe('M15 Xhain weather', () => {
  it('has a weather for every Xhain area', async () => {
    const { xhainMap } = await import('../data/xhain');
    const { XHAIN_WEATHER } = await import('./weather');
    for (const a of xhainMap(1).areas) expect(XHAIN_WEATHER[a.id], a.id).toBeDefined();
  });
});

describe('M15 Alexanderplatz weather (frozen in autumn)', () => {
  it('has a weather for every area: leaves in the zones, clear on the plaza; fog stays light by day', async () => {
    const { alexMap } = await import('../data/alexanderplatz');
    const { ALEX_WEATHER } = await import('./weather');
    const m = alexMap(1);
    for (const a of m.areas) expect(ALEX_WEATHER[a.id], a.id).toBeDefined();
    const scene = new Scene(); scene.fog = new FogExp2(0, 0.0075);
    const w = new Weather(scene, m, ALEX_WEATHER, 0.5, 0.0075 / 0.017);
    const e = m.encounters.find((q) => q.id === 'lustgarten')!;
    for (let i = 0; i < 300; i++) w.update(1 / 30, e.x, e.z, i / 30);
    expect(w.current).toBe('leaves');
    expect((scene.fog as FogExp2).density).toBeLessThan(0.008);
    const f = m.encounters.find((q) => q.id === 'weltzeituhr')!;
    expect(w.kindAt(f.x, f.z)).toBe('clear');
  });
});
