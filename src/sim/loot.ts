// Loot in the world (M4, 2D js/loot.js + combat.js kill/breakProp). Drops pop out of kills and
// broken props, land on walkable ground and are picked up by walking within 1.2 m (no magnet).
import type { MaterialId } from '../data/crafting';
import { difficultyOf } from '../data/difficulty';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { RARITIES } from '../data/items';
import { colliderDistance } from './collide';
import { collectItem, BAG_SIZE } from './inventory';
import { isUpgrade, lootItem, makeItem, type Item } from './items';
import type { Breakable } from './breakables';
import { DT, type Enemy, type Sim } from './types';
import { addConsumable, CONSUMABLE, healPlayer } from './abilities';
import { pk } from './combat';
import { scrapFactor } from './runcontent';

/** 2D pixels to meters. */
const PX = 1 / 30;
export const LOOT = {
  pickupRadius: 1.2,
  /** Elster: +65% pickup reach per level (reach only, loot never flies). */
  magnet: 0.65,
  /** Name labels of common items show within this distance. */
  labelRange: 12,
  gravity: 20.7,
  healFraction: 0.3,
  /** Seconds between "bag full" notices. */
  fullToast: 6,
};

export const MATERIAL_IDS: readonly MaterialId[] = ['stoff', 'metall', 'chemie', 'kabel'];

export type DropContent =
  | { kind: 'item'; item: Item }
  | { kind: 'heal' }
  /** Döner: heals and feeds (+10% damage for a while). */
  | { kind: 'food' }
  | { kind: 'material'; id: MaterialId };

export interface Drop {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Height above the ground and vertical speed while in the air. */
  h: number;
  vh: number;
  /** Seconds since it appeared (render pulse). */
  t: number;
  landed: boolean;
  content: DropContent;
}

/** Normal waves started this run; boss waves do not count. */
export function lootLevel(sim: Sim): number {
  return Math.max(1, Math.ceil(sim.lootWaves / 2));
}

/** One context per sim; it owns the item id counter. Luck and wave are refreshed before every roll. */
export function lootContext(sim: Sim) {
  // 2D `rollR`: camp upgrade Spürnase + difficulty + gear and survivor luck.
  sim.lootCtx.luck = (sim.statContext.upgrades.luck ?? 0) + sim.stats.luck + difficultyOf(sim.difficulty).luck;
  sim.lootCtx.wave = Math.max(1, sim.lootWaves) / 2;
  return sim.lootCtx;
}

/** Display color of a drop: rarity, set green, heal red, material grey. */
export function dropColor(d: Drop): string {
  const c = d.content;
  if (c.kind === 'heal') return '#e0584a';
  if (c.kind === 'food') return '#f2a04b';
  if (c.kind === 'material') return '#9db0b4';
  return c.item.set ? '#5fd36f' : RARITIES[c.item.rarity].color;
}

export const importantDrop = (d: Drop): boolean => d.content.kind === 'item' && (d.content.item.rarity >= 2 || !!d.content.item.set);

export function importantDrops(sim: Sim): Drop[] {
  return sim.drops.filter(importantDrop);
}

export function nearestImportantDrop(sim: Sim): Drop | null {
  let best: Drop | null = null;
  let bd = Infinity;
  for (const d of sim.drops) {
    if (!importantDrop(d)) continue;
    const dist = Math.hypot(d.x - sim.player.x, d.z - sim.player.z);
    if (dist < bd) {
      bd = dist;
      best = d;
    }
  }
  return best;
}

function free(sim: Sim, x: number, z: number): boolean {
  return !sim.level.blocked(x, z, 0.1) && !sim.level.near(x, z, 0.5).some((c) => colliderDistance(c, x, z) < 0.12);
}

export function spawnDrop(sim: Sim, x: number, z: number, content: DropContent, ox = 0, oz = 0): Drop {
  // The offset only applies where the ground is free (a bin against a wall, a bank).
  if (free(sim, x + ox, z + oz)) {
    x += ox;
    z += oz;
  }
  const a = sim.rng.range(0, Math.PI * 2);
  const s = sim.rng.range(30, 80) * PX;
  const d: Drop = {
    id: sim.nextId++, x, z, vx: Math.sin(a) * s, vz: Math.cos(a) * s,
    h: 0, vh: sim.rng.range(150, 210) * PX, t: 0, landed: false, content,
  };
  sim.drops.push(d);
  const rarity = content.kind === 'item' ? content.item.rarity : -1;
  sim.events.push({ type: 'drop', id: d.id, x, z, rarity, set: content.kind === 'item' && !!content.item.set });
  if (rarity >= 3) sim.events.push({ type: 'legendary', x, z });
  return d;
}

const spread = (sim: Sim, m: number): number => sim.rng.range(-m, m);

export function creditScrap(sim: Sim, amount: number, x: number, z: number, fromEnemy = false): void {
  amount = Math.round(amount * difficultyOf(sim.difficulty).scrap * scrapFactor(sim, fromEnemy));
  if (amount <= 0) return;
  sim.inventory.scrap += amount;
  sim.events.push({ type: 'scrap', amount, x, z });
}

// 2D drop chances and Schrott by role (ghoul, raser, brute, spitter, crow).
const ITEM_CHANCE: Partial<Record<EnemyKind, number>> = { walker: 0.15, runner: 0.24, brute: 0.55, spitter: 0.24, raptor: 0.3, crow: 0.15 };
const SCRAP: Partial<Record<EnemyKind, number>> = { walker: 1, runner: 3, brute: 4, spitter: 2, raptor: 3, crow: 1, feldwebel: 40, waechter: 40, rex: 40, hauptmann: 70 };

/** 2D `kill()`: bosses drop first, then one of material, item or heal. Scrap is credited at once. */
export function killDrops(sim: Sim, e: Enemy): void {
  const kind = e.kind;
  if (e.mini) return;
  const boss = !!ENEMIES[kind].boss;
  const big = kind === 'hauptmann';
  const il = lootLevel(sim);
  const c = lootContext(sim);
  const mat = 1 + 0.5 * pk(sim, 'mat');
  // Späti-Tüte (legendary): Döner and supplies twice as often.
  const cook = (sim.statContext.survivors.koechin ? 2 : 1) * (sim.stats.legendary.includes('spaeti') ? 2 : 1);
  creditScrap(sim, (SCRAP[kind] ?? 1) * (e.elite ? 4 : 1), e.x, e.z, true);
  // 2D elites: always an item one level up, a quarter of them rare or better.
  if (e.elite) spawnDrop(sim, e.x, e.z, { kind: 'item', item: lootItem(sim.rng, c, il + 1, sim.rng.next() < 0.25 ? 1 : 0) }, spread(sim, 0.5), spread(sim, 0.5));
  if (boss) {
    for (let i = 0; i < (big ? 3 : 2); i++) {
      spawnDrop(sim, e.x, e.z, { kind: 'item', item: lootItem(sim.rng, c, il + 2, big ? 2 : 1, 0.12) }, spread(sim, 1.3), spread(sim, 1.3));
    }
    // Guaranteed until M6 can remember the first kill per district (then 30 % afterwards).
    if (big) spawnDrop(sim, e.x, e.z, { kind: 'item', item: makeItem(sim.rng, c, il + 3, 3) }, 0, -0.8);
    spawnDrop(sim, e.x, e.z, { kind: 'heal' }, 0, 0.7);
  }
  if (sim.rng.next() < (boss ? 1 : e.elite ? 0.8 : 0.22) * mat) {
    const n = boss ? 5 : e.elite ? 2 : 1;
    for (let i = 0; i < n; i++) spawnDrop(sim, e.x, e.z, { kind: 'material', id: sim.rng.pick(MATERIAL_IDS) });
  } else if (sim.rng.next() < 0.03 * cook) {
    spawnDrop(sim, e.x, e.z, { kind: 'food' }, -0.33, 0);
  } else if (sim.rng.next() < (ITEM_CHANCE[kind] ?? 0.15) * 0.4) {
    spawnDrop(sim, e.x, e.z, { kind: 'item', item: makeItem(sim.rng, c, il, 0) }, 0, 0);
  } else if (sim.rng.next() < 0.06) {
    spawnDrop(sim, e.x, e.z, { kind: 'heal' });
  }
}

/** 2D `breakProp`. */
export function breakDrops(sim: Sim, b: Breakable): void {
  const { x, z, inside } = b.def;
  const il = lootLevel(sim);
  const c = lootContext(sim);
  const loot = pk(sim, 'loot') > 0;
  creditScrap(sim, Math.round(inside ? sim.rng.range(4, 8) : sim.rng.range(1, 4)) * (loot ? 2 : 1), x, z);
  // 2D: 15% a Verband or Molotow straight into the pouch (up to three each).
  if (sim.rng.next() < 0.15 * (sim.stats.legendary.includes('spaeti') ? 2 : 1)) {
    const id = sim.rng.pick(['verband', 'molotow'] as const);
    if (addConsumable(sim, id)) sim.events.push({ type: 'note', text: id === 'verband' ? '+1 Verband' : '+1 Molotow', color: '#8fd16a', x, z });
  }
  if (sim.rng.next() < 0.1) spawnDrop(sim, x, z, { kind: 'food' }, 0.33, 0);
  if (sim.rng.next() < (inside ? 0.6 : 0.3) * (loot ? 1.6 : 1) * (1 + 0.5 * pk(sim, 'mat'))) spawnDrop(sim, x, z, { kind: 'material', id: sim.rng.pick(MATERIAL_IDS) }, -0.27, 0);
  if (sim.rng.next() < (inside ? 0.3 : 0.07)) spawnDrop(sim, x, z, { kind: 'item', item: makeItem(sim.rng, c, il, inside ? 1 : 0) });
  else if (sim.rng.next() < 0.12) spawnDrop(sim, x, z, { kind: 'heal' });
}

/** Pop arc, landing and pickup. */
export function updateDrops(sim: Sim): void {
  const p = sim.player;
  sim.bagFullT = Math.max(0, sim.bagFullT - DT);
  if (sim.drops.length === 0) return;
  for (const d of sim.drops) {
    d.t += DT;
    if (!d.landed) {
      const nx = d.x + d.vx * DT;
      const nz = d.z + d.vz * DT;
      if (free(sim, nx, nz)) {
        d.x = nx;
        d.z = nz;
      } else {
        d.vx = d.vz = 0;
      }
      d.h += d.vh * DT;
      d.vh -= LOOT.gravity * DT;
      if (d.h <= 0) {
        d.h = 0;
        d.landed = true;
        sim.events.push({ type: 'dropLand', id: d.id, x: d.x, z: d.z, rarity: d.content.kind === 'item' ? d.content.item.rarity : -1 });
      }
    }
  }
  if (p.state === 'dead') return;
  for (let i = sim.drops.length - 1; i >= 0; i--) {
    const d = sim.drops[i]!;
    if (!d.landed) continue;
    const dist = Math.hypot(p.x - d.x, p.z - d.z);
    if (dist >= LOOT.pickupRadius * (1 + LOOT.magnet * pk(sim, 'magnet'))) continue;
    const c = d.content;
    if (c.kind === 'heal') {
      if (p.hp >= sim.stats.maxHp) continue;
      const heal = Math.min(sim.stats.maxHp - p.hp, Math.round(sim.stats.maxHp * LOOT.healFraction));
      p.hp += heal;
      sim.events.push({ type: 'pickup', id: d.id, what: 'heal', x: d.x, z: d.z, rarity: -1, amount: heal });
    } else if (c.kind === 'food') {
      const heal = Math.round(healPlayer(sim, Math.round(sim.stats.maxHp * CONSUMABLE.food.heal)));
      sim.abilities.fed = CONSUMABLE.food.fed;
      sim.events.push({ type: 'pickup', id: d.id, what: 'food', x: d.x, z: d.z, rarity: -1, amount: heal });
    } else if (c.kind === 'material') {
      sim.inventory.materials[c.id] = (sim.inventory.materials[c.id] ?? 0) + 1;
      sim.events.push({ type: 'pickup', id: d.id, what: 'material', x: d.x, z: d.z, rarity: -1, amount: 1, material: c.id });
    } else {
      const upgrade = isUpgrade(c.item, sim.equipment[c.item.slot]);
      if (!collectItem(sim, c.item)) {
        if (sim.inventory.bag.length >= BAG_SIZE && sim.bagFullT <= 0) {
          sim.bagFullT = LOOT.fullToast;
          sim.events.push({ type: 'bagFull' });
        }
        continue;
      }
      sim.events.push({ type: 'pickup', id: d.id, what: 'item', x: d.x, z: d.z, rarity: c.item.rarity, amount: 1, name: c.item.name, upgrade, set: !!c.item.set });
    }
    sim.drops.splice(i, 1);
  }
}
