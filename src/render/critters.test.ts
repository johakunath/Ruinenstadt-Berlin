import { describe, expect, it } from 'vitest';
import { generateLots, isWater, mapLevel, tunnelWalk, type MapDef } from '../data/map';
import { koepenickMap } from '../data/koepenick';
import { tunnelMap } from '../data/tunnel';
import { createSim } from '../sim/sim';
import { colliderDistance } from '../sim/collide';
import { ColliderIndex, critterKinds, duckSite, nearWall, pigeonSite, ratSite, type SiteWorld } from './critter-sites';
import { Critters, RING } from './critters';
import { Materials } from './materials';
import { PROFILES } from './profile';
import type { Look } from './looks';

function world(m: MapDef): SiteWorld & { level: ReturnType<typeof mapLevel> } {
  const level = mapLevel(m, generateLots(m));
  return { m, level, index: new ColliderIndex(level.colliders) };
}

const koep = koepenickMap();
const K = world(koep);

describe('P18 critter sites', () => {
  it('rats are the only animals underground, none in the Fernsehturm', () => {
    expect(critterKinds(koep)).toEqual(['duck', 'pigeon', 'rat']);
    expect(critterKinds(tunnelMap(1))).toEqual(['rat']);
    expect(critterKinds({ ...koep, decks: [] })).toEqual([]);
  });

  it('ducks swim on open water only', () => {
    expect(duckSite(K, 30, -47)).toBe(true); // the Spree east of the Dammbrücke
    expect(duckSite(K, 10, 0)).toBe(false); // the Altstadt
    expect(duckSite(K, 6, -46)).toBe(false); // under the Dammbrücke
    expect(duckSite(K, -17.5, 104)).toBe(false); // the ferry lane over the Dahme
    // Clear of the bank (and the boat wrecks moored along it): nothing within 3.5 m of dry land.
    for (let x = 20; x <= 60; x += 0.5) for (let z = -60; z <= -30; z += 0.5) {
      if (duckSite(K, x, z)) for (const [dx, dz] of [[3.4, 0], [-3.4, 0], [0, 3.4], [0, -3.4]] as const) expect(isWater(koep, x + dx, z + dz)).toBe(true);
    }
  });

  it('pigeons walk on the Altstadt cobbles, not in the Müggelberge forest', () => {
    let plaza = 0, forest = 0;
    for (let x = -4; x <= 24; x += 1) for (let z = -8; z <= 8; z += 1) if (pigeonSite(K, x, z)) plaza++;
    for (let x = 120; x <= 150; x += 1) for (let z = 125; z <= 145; z += 1) if (pigeonSite(K, x, z)) forest++;
    expect(plaza).toBeGreaterThan(20);
    expect(forest).toBe(0);
  });

  it('rats keep to free ground beside walls, never inside a collider', () => {
    let n = 0;
    for (let x = -20; x <= 48; x += 0.7) {
      for (let z = -36; z <= 32; z += 0.7) {
        if (!ratSite(K, x, z)) continue;
        n++;
        expect(nearWall(K, x, z)).toBe(true);
        expect(K.level.colliders.every((c) => colliderDistance(c, x, z) > 0.1)).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(50);
  });

  it('tunnel rats run along the tube walls', () => {
    const m = tunnelMap(1), T = world(m), e = m.encounters[0]!;
    let n = 0;
    for (let x = e.x - 30; x <= e.x + 30; x += 0.5) {
      for (let z = e.z - 12; z <= e.z + 12; z += 0.5) {
        if (!ratSite(T, x, z)) continue;
        n++;
        expect(tunnelWalk(m, x, z)).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(20);
  });
});

describe('P18 critters view', { timeout: 30000 }, () => {
  const tunnel = tunnelMap(1);
  const levels = new Map<MapDef, ReturnType<typeof mapLevel>>([[koep, K.level]]);
  const levelOf = (m: MapDef): ReturnType<typeof mapLevel> => levels.get(m) ?? levels.set(m, mapLevel(m, generateLots(m))).get(m)!;
  const run = (m: MapDef, x: number, z: number, frames: number, profile = PROFILES.qualitaet): { c: Critters; ms: number } => {
    const sim = createSim({ level: levelOf(m), seed: 3 });
    const c = new Critters(new Materials({} as Look, profile), m, profile, false);
    const before = JSON.stringify([sim.player, sim.enemies.map((e) => [e.x, e.z, e.hp])]);
    let ms = 0;
    for (let i = 0; i < frames; i++) {
      c.update(sim, 1 / 60, x, z);
      if (i > 10) ms = Math.max(ms, c.ms);
    }
    // Render side only: the sim is untouched.
    expect(JSON.stringify([sim.player, sim.enemies.map((e) => [e.x, e.z, e.hp])])).toBe(before);
    return { c, ms };
  };

  it('fills the Altstadt with pigeons and rats, ducks stay in the water, the sim stays as it was', () => {
    const { c } = run(koep, 10, 0, 600);
    const live = c.live();
    expect(live.filter((a) => a.kind === 'pigeon').length).toBeGreaterThanOrEqual(4);
    expect(live.filter((a) => a.kind === 'rat').length).toBeGreaterThanOrEqual(1);
    for (const a of live) {
      expect(Math.hypot(a.x - 10, a.z - 0 - -4)).toBeLessThan(RING.drop + 1);
      if (a.kind === 'duck') expect(isWater(koep, a.x, a.z)).toBe(true);
    }
  });

  it('ducks on the Spree bank', () => {
    const { c } = run(koep, 30, -30, 300);
    expect(c.counts().duck).toBeGreaterThanOrEqual(2);
  });

  it('a flock flies off when the hero walks into it, and lands again or leaves', () => {
    const sim = createSim({ level: K.level, seed: 3 });
    const c = new Critters(new Materials({} as Look, PROFILES.qualitaet), koep, PROFILES.qualitaet, false);
    for (let i = 0; i < 30; i++) c.update(sim, 1 / 60, 10, 0);
    const p = c.live().find((a) => a.kind === 'pigeon')!;
    expect(p).toBeTruthy();
    let flew = 0;
    for (let i = 0; i < 120; i++) {
      c.update(sim, 1 / 60, p.x + 0.5, p.z);
      flew = Math.max(flew, c.counts().flying ?? 0);
    }
    expect(flew).toBeGreaterThanOrEqual(1);
  });

  it('only rats in the tunnel; Leistung keeps fewer animals', () => {
    const e = tunnel.encounters[0]!;
    const { c, ms } = run(tunnel, e.x, e.z, 300);
    const n = c.counts();
    expect(n.rat).toBeGreaterThanOrEqual(2);
    expect(n.duck ?? 0).toBe(0);
    expect(n.pigeon ?? 0).toBe(0);
    expect(ms).toBeLessThan(5);
    const lean = run(koep, 10, 0, 300, PROFILES.leistung).c.counts();
    expect(lean.pigeon).toBeLessThanOrEqual(7);
  });
});
