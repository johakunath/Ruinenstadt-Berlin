// P18 ambient animals (docs/tasks/m11c-animals.md): where each kind may be. Pure functions over the map and the
// level, read only and without Three.js, so the rules have a unit test. Ducks swim on open water, pigeons walk on
// paved streets and squares (not in forest or jungle), rats keep close to walls, bins and rubble and are the only
// animals in the U-Bahn tunnels. Nothing here writes the sim.
import { colliderDistance, type Collider } from '../sim/collide';
import { areaAt, isWater, onBridge, streetDist, type MapDef } from '../data/map';
import type { Level } from '../sim/level';

export type CritterKind = 'duck' | 'pigeon' | 'rat';

/** Kinds that live on a map: none in the Fernsehturm, only rats underground. */
export function critterKinds(m: MapDef): CritterKind[] {
  if (m.decks) return [];
  if (m.tunnel) return ['rat'];
  return ['duck', 'pigeon', 'rat'];
}

const CELL = 8;
/** Colliders are filed into every cell within this margin, so `edge` sees them up to this far across a cell border. */
const REACH = 1.5;
const key = (gx: number, gz: number): number => (gx + 4096) * 8192 + (gz + 4096);

/** The level's colliders in a grid of their own (`Level.near` reuses scratch arrays the sim owns). Built once per level. */
export class ColliderIndex {
  private readonly cells = new Map<number, Collider[]>();
  constructor(colliders: readonly Collider[]) {
    for (const c of colliders) {
      const r = (c.kind === 'circle' ? c.r : Math.hypot(c.hx, c.hz)) + REACH;
      for (let gx = Math.floor((c.x - r) / CELL); gx <= Math.floor((c.x + r) / CELL); gx++) {
        for (let gz = Math.floor((c.z - r) / CELL); gz <= Math.floor((c.z + r) / CELL); gz++) {
          const k = key(gx, gz);
          let list = this.cells.get(k);
          if (!list) this.cells.set(k, (list = []));
          list.push(c);
        }
      }
    }
  }

  /** Distance from (x, z) to the nearest collider edge, negative inside one; `Infinity` when none is within `REACH`. */
  edge(x: number, z: number): number {
    const list = this.cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let d = Infinity;
    if (list) for (const c of list) d = Math.min(d, colliderDistance(c, x, z));
    return d;
  }
}

/** Tree crowns as circles (tree lots: `w` is the crown size). The camera cannot see a pigeon under one. */
export class CrownIndex {
  private readonly cells = new Map<number, Array<{ x: number; z: number; r: number }>>();
  constructor(trees: ReadonlyArray<{ x: number; z: number; r: number }>) {
    for (const t of trees) {
      for (let gx = Math.floor((t.x - t.r) / CELL); gx <= Math.floor((t.x + t.r) / CELL); gx++) {
        for (let gz = Math.floor((t.z - t.r) / CELL); gz <= Math.floor((t.z + t.r) / CELL); gz++) {
          const k = key(gx, gz);
          let list = this.cells.get(k);
          if (!list) this.cells.set(k, (list = []));
          list.push(t);
        }
      }
    }
  }

  under(x: number, z: number): boolean {
    return this.cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)))?.some((t) => Math.hypot(x - t.x, z - t.z) < t.r) ?? false;
  }
}

/** What the site tests read: the map, the level (walk grid), the collider index and the tree crowns. */
export interface SiteWorld {
  m: MapDef;
  level: Pick<Level, 'blocked'>;
  index: ColliderIndex;
  crowns?: CrownIndex;
}

/** Ducks keep this far from the bank: the boat wrecks lie up to about 3.2 m out (`buildBoats` in map-world.ts). */
const BANK = 3.5;

/** Open water a duck can swim on: water here and `BANK` m around, not under a bridge deck or a pond jetty. */
export function duckSite(w: SiteWorld, x: number, z: number): boolean {
  const m = w.m;
  if (m.tunnel || m.decks || !isWater(m, x, z)) return false;
  for (const [dx, dz] of AROUND) if (!isWater(m, x + dx * 1.6, z + dz * 1.6) || !isWater(m, x + dx * BANK, z + dz * BANK)) return false;
  // Pond jetties, and the whole lane of a ferry (its boat shuttles across).
  const inside = (p: { x: number; z: number; rot: number; len: number; width: number }, pad: number): boolean => {
    const dx = x - p.x, dz = z - p.z;
    return Math.abs(dx * Math.sin(p.rot) + dz * Math.cos(p.rot)) <= p.len / 2 + pad && Math.abs(-dx * Math.cos(p.rot) + dz * Math.sin(p.rot)) <= p.width / 2 + pad;
  };
  if ((m.piers ?? []).some((p) => inside(p, 1)) || m.bridges.some((b) => b.kind === 'ferry' && inside(b, 3))) return false;
  return !onBridge(m, x, z, 2);
}

/** Ground kind under a point, with forest and jungle areas marked wild. */
function wild(m: MapDef, x: number, z: number): boolean {
  const g = areaAt(m, x, z)?.ground ?? m.defaultGround;
  return g === 'forest' || g === 'jungle';
}

/** Free ground for a small body: walkable in the walk grid and clear of every collider by `pad`. */
function free(w: SiteWorld, x: number, z: number, pad: number): boolean {
  return !w.level.blocked(x, z, pad) && w.index.edge(x, z) > pad;
}

/** Paved and open: a street (not a forest path) or a cobbled or asphalt area, away from forest, jungle and tree crowns. */
export function pigeonSite(w: SiteWorld, x: number, z: number): boolean {
  const m = w.m;
  // Cheap tests first: the street search runs over every street of the map.
  if (m.tunnel || m.decks || !free(w, x, z, 0.35) || w.crowns?.under(x, z)) return false;
  const g = areaAt(m, x, z)?.ground ?? m.defaultGround;
  if (g === 'forest' || g === 'jungle' || isWater(m, x, z)) return false;
  if (g === 'cobbles' || g === 'asphalt') return true;
  const s = streetDist(m, x, z);
  return s.d < 0.5 && s.street?.kind !== 'path';
}

/** Close to a wall: a collider edge within 1 m (buildings, bins, rubble, crates) or the walk grid's edge (tunnel walls, quays). */
export function nearWall(w: SiteWorld, x: number, z: number): boolean {
  if (w.index.edge(x, z) < 1) return true;
  for (const [dx, dz] of AROUND) if (w.level.blocked(x + dx * 0.9, z + dz * 0.9)) return true;
  return false;
}

/** A rat's spot: free ground right beside a wall; outdoors not in forest or jungle. */
export function ratSite(w: SiteWorld, x: number, z: number): boolean {
  const m = w.m;
  if (m.decks || (!m.tunnel && wild(m, x, z))) return false;
  return free(w, x, z, 0.15) && nearWall(w, x, z);
}

/** Ground a fleeing rat can run over (it need not hug a wall). */
export function ratFree(w: SiteWorld, x: number, z: number): boolean {
  return free(w, x, z, 0.12);
}

export function site(kind: CritterKind, w: SiteWorld, x: number, z: number): boolean {
  return kind === 'duck' ? duckSite(w, x, z) : kind === 'pigeon' ? pigeonSite(w, x, z) : ratSite(w, x, z);
}

const AROUND: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
