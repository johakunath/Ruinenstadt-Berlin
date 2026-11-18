import { describe, expect, it } from 'vitest';
import { reachable } from '../sim/reach';
import { alexMap } from './alexanderplatz';
import { koepenickMap } from './koepenick';
import { generateLots, mapLevel, type MapDef } from './map';
import { mitteMap } from './mitte';
import { xhainMap } from './xhain';

// P21, P23: lot guards and event spots (trader, rescue, cache) stand on ground the hero reaches.
const MAPS: Array<[string, (s: number) => MapDef]> = [['Köpenick', koepenickMap], ['Xhain', xhainMap], ['Alexanderplatz', alexMap], ['Mitte', mitteMap]];

describe('lot guards and event spots are reachable (P21, P23)', () => {
  for (const [name, make] of MAPS) for (const scale of [1, 1.3]) {
    it(`${name}, scale ${scale}`, () => {
      const m = make(scale);
      const lots = generateLots(m);
      const level = mapLevel(m, lots);
      const lotGuards = level.guards.slice(m.guards?.length ?? 0);
      const bad = [...lotGuards, ...level.spots.rescue, ...level.spots.trader, ...level.spots.cache].filter((p) => !reachable(level, p.x, p.z));
      expect(bad.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`)).toEqual([]);
    });
  }
});
