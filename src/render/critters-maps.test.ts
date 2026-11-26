import { describe, expect, it } from 'vitest';
import { generateLots, mapLevel, type MapDef } from '../data/map';
import { alexMap } from '../data/alexanderplatz';
import { charlottenburgMap } from '../data/charlottenburg';
import { mitteMap } from '../data/mitte';
import { weddingMap } from '../data/wedding';
import { xhainMap } from '../data/xhain';
import { tunnelMap } from '../data/tunnel';
import { createSim } from '../sim/sim';
import { Critters } from './critters';
import { Materials } from './materials';
import { PROFILES } from './profile';
import type { Look } from './looks';

// P18: every district gets animals near its start and along its route, each tunnel line its rats.
const MAPS: Array<[string, () => MapDef]> = [
  ['xhain', () => xhainMap()], ['alex', () => alexMap()], ['mitte', () => mitteMap()], ['charlottenburg', () => charlottenburgMap()],
  ['wedding', () => weddingMap()], ['tunnel0', () => tunnelMap(0)], ['tunnel2', () => tunnelMap(2)],
];

describe('P18 critters on every map', { timeout: 60000 }, () => {
  for (const [name, make] of MAPS) {
    it(name, () => {
      const m = make(), level = mapLevel(m, generateLots(m)), sim = createSim({ level, seed: 2 });
      const c = new Critters(new Materials({} as Look, PROFILES.ausgewogen), m, PROFILES.ausgewogen, false);
      let total = 0;
      // The start and every encounter: animals within the view ring somewhere along the route.
      for (const p of [m.start, ...m.encounters]) {
        c.reset();
        for (let i = 0; i < 20; i++) c.update(sim, 1 / 60, p.x, p.z);
        const n = c.counts();
        total += (n.pigeon ?? 0) + (n.rat ?? 0) + (n.duck ?? 0);
        if (m.tunnel) expect((n.pigeon ?? 0) + (n.duck ?? 0)).toBe(0);
      }
      expect(total).toBeGreaterThan(m.encounters.length);
    });
  }
});
