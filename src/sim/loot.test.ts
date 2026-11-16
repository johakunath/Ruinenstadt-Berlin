import { describe, expect, it } from 'vitest';
import { BAG_SIZE, collectItem } from './inventory';
import { makeItem } from './items';
import { killDrops, lootLevel, spawnDrop, updateDrops } from './loot';
import { Level, WalkGrid } from './level';
import { createSim, stepSim } from './sim';
import { spawnEnemy } from './enemies';
import { NO_INPUT, type Sim } from './types';

const flat = (): Sim => createSim({ empty: true, seed: 5 });

function itemDrop(sim: Sim, x: number, z: number) {
  const item = makeItem(sim.rng, sim.lootCtx, 1, 0);
  return spawnDrop(sim, x, z, { kind: 'item', item });
}

function land(sim: Sim, ticks = 60): void {
  for (let i = 0; i < ticks; i++) updateDrops(sim);
}

describe('kill drops', () => {
  it('walker chances match the 2D numbers', () => {
    const sim = flat();
    const n = 6000;
    let mat = 0, item = 0, heal = 0, ing = 0;
    for (let i = 0; i < n; i++) {
      sim.drops.length = 0;
      const e = spawnEnemy(sim, 2, 2, 'walker');
      killDrops(sim, e);
      for (const d of sim.drops) {
        if (d.content.kind === 'material') mat++;
        else if (d.content.kind === 'item') item++;
        else if (d.content.kind === 'ingredient') ing++;
        else heal++;
      }
    }
    expect(ing / n).toBeCloseTo(0.03, 1);
    expect(mat / n).toBeCloseTo(0.22, 1);
    expect(item / n).toBeCloseTo(0.78 * 0.15 * 0.4, 1);
    expect(heal / n).toBeCloseTo(0.78 * 0.94 * 0.06, 1);
    expect(item / n).toBeGreaterThan(0.03);
    expect(item / n).toBeLessThan(0.065);
  });

  it('credits scrap at once', () => {
    const sim = flat();
    killDrops(sim, spawnEnemy(sim, 2, 2, 'brute'));
    expect(sim.inventory.scrap).toBe(4);
  });

  it('bosses always drop their items; the Hauptmann drops a legendary', () => {
    const sim = flat();
    killDrops(sim, spawnEnemy(sim, 2, 2, 'feldwebel'));
    const items = sim.drops.filter((d) => d.content.kind === 'item');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(sim.drops.some((d) => d.content.kind === 'heal')).toBe(true);
    expect(sim.inventory.scrap).toBe(40);
    for (let s = 0; s < 5; s++) {
      const sm = createSim({ empty: true, seed: s + 1 });
      killDrops(sm, spawnEnemy(sm, 2, 2, 'hauptmann'));
      const legendary = sm.drops.filter((d) => d.content.kind === 'item' && d.content.item.rarity === 3);
      expect(legendary.length).toBeGreaterThanOrEqual(1);
      expect(sm.events.some((e) => e.type === 'legendary')).toBe(true);
      expect(sm.inventory.scrap).toBe(70);
    }
  });

  it('item ids stay unique', () => {
    const sim = flat();
    for (let i = 0; i < 200; i++) killDrops(sim, spawnEnemy(sim, 2, 2, 'brute'));
    const ids = sim.drops.flatMap((d) => (d.content.kind === 'item' ? [d.content.item.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id > 0)).toBe(true);
  });
});

describe('item level', () => {
  it('follows the normal wave count', () => {
    const sim = flat();
    const at = (g: number): number => ((sim.lootWaves = g), lootLevel(sim));
    expect([0, 1, 2, 3, 4, 5, 6].map(at)).toEqual([1, 1, 1, 2, 2, 3, 3]);
  });
});

describe('landing and pickup', () => {
  it('drops land on walkable ground, never in water', () => {
    const b = { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };
    const ground = new WalkGrid(b, 0.5, (x) => x > 0);
    const level = new Level('w', b, { x: -20, z: 0 }, [], ground, [], b);
    const sim = createSim({ level, empty: true, seed: 2 });
    for (let i = 0; i < 80; i++) spawnDrop(sim, -0.3, i * 0.2 - 8, { kind: 'material', id: 'metall' });
    land(sim, 120);
    expect(sim.drops.every((d) => d.landed && d.x <= 0)).toBe(true);
  });

  it('nothing is picked up in the air', () => {
    const sim = flat();
    const d = spawnDrop(sim, sim.player.x, sim.player.z, { kind: 'material', id: 'stoff' });
    d.vx = d.vz = 0;
    updateDrops(sim);
    expect(d.landed).toBe(false);
    expect(sim.drops).toHaveLength(1);
    land(sim);
    expect(sim.drops).toHaveLength(0);
    expect(sim.inventory.materials.stoff).toBe(1);
  });

  it('picks up only within 1.2 m', () => {
    const sim = flat();
    const { x, z } = sim.player;
    const far = spawnDrop(sim, x + 1.5, z, { kind: 'material', id: 'kabel' });
    far.vx = far.vz = 0;
    const near = spawnDrop(sim, x + 0.8, z, { kind: 'material', id: 'chemie' });
    near.vx = near.vz = 0;
    land(sim);
    expect(sim.drops).toEqual([far]);
  });

  it('a full bag leaves items on the ground and warns at most every 6 s', () => {
    const sim = flat();
    for (let i = 0; i < BAG_SIZE; i++) collectItem(sim, makeItem(sim.rng, sim.lootCtx, 1, 0));
    const d = itemDrop(sim, sim.player.x, sim.player.z);
    d.vx = d.vz = 0;
    land(sim, 200);
    expect(sim.drops).toHaveLength(1);
    expect(sim.inventory.bag).toHaveLength(BAG_SIZE);
    const notices = (): number => sim.events.filter((e) => e.type === 'bagFull').length;
    expect(notices()).toBe(1);
    land(sim, 400);
    expect(notices()).toBe(2);
  });

  it('heal drops are taken only when hurt', () => {
    const sim = flat();
    sim.player.hp = sim.stats.maxHp;
    const d = spawnDrop(sim, sim.player.x, sim.player.z, { kind: 'heal' });
    d.vx = d.vz = 0;
    land(sim);
    expect(sim.drops).toHaveLength(1);
    sim.player.hp = sim.stats.maxHp * 0.4;
    land(sim, 2);
    expect(sim.drops).toHaveLength(0);
    expect(sim.player.hp).toBeCloseTo(sim.stats.maxHp * 0.7, 0);
  });

  it('reports an upgrade on pickup', () => {
    const sim = flat();
    const d = itemDrop(sim, sim.player.x, sim.player.z);
    d.vx = d.vz = 0;
    for (let i = 0; i < 60; i++) {
      stepSim(sim, NO_INPUT);
    }
    const pickup = sim.events.find((e) => e.type === 'pickup');
    expect(pickup).toBeDefined();
    expect(sim.inventory.bag).toHaveLength(1);
  });
  it('camp upgrade Spürnase counts as loot luck (2D rollR)', async () => {
    const { lootContext } = await import('./loot');
    const base = createSim({ empty: true });
    const lucky = createSim({ empty: true, statContext: { upgrades: { luck: 3 } } });
    expect(lootContext(lucky).luck).toBe(lootContext(base).luck + 3);
  });
});

describe('L2 follow-ups', () => {
  it('the first material of a kill follows the enemy role (2D EMAT)', () => {
    const sim = flat();
    const got = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      sim.drops.length = 0;
      killDrops(sim, spawnEnemy(sim, 2, 2, 'brute'));
      const m = sim.drops.find(d => d.content.kind === 'material');
      if (m && m.content.kind === 'material') got.add(m.content.id);
    }
    expect([...got]).toEqual(['metall']);
  });
  it('the map district reaches the loot context', () => {
    const sim = flat();
    expect(sim.lootCtx.district).toBe(0);
  });
});
