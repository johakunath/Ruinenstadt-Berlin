// A level: everything the sim needs to know about a map. Static footprints (indexed in a coarse
// hash so a city of colliders stays cheap), a walkability grid for water and map edges, the start,
// and either arena spawn points (the gate 1 courtyard) or encounters (expedition maps).
import { pushOut, type Collider } from './collide';
import type { RestArea } from './rest';
import type { Bounds } from './flowfield';
import type { EnemyKind } from '../data/enemies';
import { onFerryBoat, type FerryLane } from './ferry';

export interface Point {
  x: number;
  z: number;
}

export interface WaveDef {
  /** Enemies in this wave (bosses come on top). */
  count: number;
  /** Most alive at once. */
  maxAlive: number;
  /** Relative spawn weights. */
  mix: Partial<Record<EnemyKind, number>>;
  hpMul: number;
  dmgMul: number;
  /** Spawned first, one each. */
  bosses: EnemyKind[];
}

export interface EncounterDef {
  id: string;
  /** Place name shown when it starts (German). */
  name: string;
  zone: number;
  x: number;
  z: number;
  /** The fight stays inside this circle. */
  r: number;
  waves: WaveDef[];
  /** Share of max life restored when the encounter is won. */
  heal: number;
}

export interface ZoneDef {
  id: string;
  name: string;
  /** Where a retry after death starts. */
  entry: Point;
}

/** Walkability grid: 1 = blocked (water, outside the map). */
export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;

  constructor(
    readonly bounds: Bounds,
    readonly cell: number,
    isBlocked: (x: number, z: number) => boolean,
  ) {
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.blocked[r * this.cols + c] = isBlocked(bounds.minX + (c + 0.5) * cell, bounds.minZ + (r + 0.5) * cell) ? 1 : 0;
      }
    }
  }

  at(x: number, z: number): boolean {
    const c = Math.floor((x - this.bounds.minX) / this.cell);
    const r = Math.floor((z - this.bounds.minZ) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    return this.blocked[r * this.cols + c] === 1;
  }

  /** Center and four rim points of a body circle. */
  circle(x: number, z: number, r: number): boolean {
    const k = r * 0.8;
    return this.at(x, z) || this.at(x + k, z) || this.at(x - k, z) || this.at(x, z + k) || this.at(x, z - k);
  }
}

const HASH = 8;

export class Level {
  private readonly hash = new Map<number, Collider[]>();
  private readonly found: Collider[] = [];
  private readonly mark = new Set<Collider>();

  constructor(
    readonly id: string,
    /** Map limits: nothing walks outside. */
    readonly bounds: Bounds,
    readonly start: Point,
    readonly colliders: Collider[],
    readonly ground: WalkGrid | null,
    /** Arena levels: enemies enter here. */
    readonly spawns: Point[],
    /** The player cannot leave this box (arena levels; the map bounds otherwise). */
    readonly playerBox: Bounds,
    readonly encounters: EncounterDef[] = [],
    readonly zones: ZoneDef[] = [],
    /** Ferry lanes: water in the walk grid, walkable where the boat is (`time`). */
    readonly ferries: FerryLane[] = [],
    /** Späti rest stops (`src/sim/rest.ts`). */
    readonly rests: RestArea[] = [],
  ) {
    for (const c of colliders) {
      const e = c.kind === 'circle' ? c.r : Math.hypot(c.hx, c.hz);
      for (let gx = Math.floor((c.x - e) / HASH); gx <= Math.floor((c.x + e) / HASH); gx++) {
        for (let gz = Math.floor((c.z - e) / HASH); gz <= Math.floor((c.z + e) / HASH); gz++) {
          const k = key(gx, gz);
          let list = this.hash.get(k);
          if (!list) this.hash.set(k, (list = []));
          list.push(c);
        }
      }
    }
  }

  /** Sim time the boat positions refer to; the sim sets it every step. */
  time = 0;

  /** The ferry lane whose boat deck holds (x, z) right now, if any. */
  boatAt(x: number, z: number, pad = 0): FerryLane | null {
    for (const f of this.ferries) if (onFerryBoat(f, this.time, x, z, pad)) return f;
    return null;
  }

  get expedition(): boolean {
    return this.encounters.length > 0;
  }

  /** Colliders whose bounds touch the square around (x, z). The returned array is reused. */
  near(x: number, z: number, r: number): readonly Collider[] {
    this.found.length = 0;
    this.mark.clear();
    for (let gx = Math.floor((x - r) / HASH); gx <= Math.floor((x + r) / HASH); gx++) {
      for (let gz = Math.floor((z - r) / HASH); gz <= Math.floor((z + r) / HASH); gz++) {
        const list = this.hash.get(key(gx, gz));
        if (!list) continue;
        for (const c of list) {
          if (this.mark.has(c)) continue;
          this.mark.add(c);
          this.found.push(c);
        }
      }
    }
    return this.found;
  }

  /** Colliders inside a box, as a new array (flow field windows). */
  inBox(b: Bounds): Collider[] {
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    return [...this.near(cx, cz, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 2)];
  }

  blocked(x: number, z: number, r = 0): boolean {
    if (x < this.bounds.minX + r || x > this.bounds.maxX - r || z < this.bounds.minZ + r || z > this.bounds.maxZ - r) return true;
    if (this.ground === null) return false;
    if (!(r > 0 ? this.ground.circle(x, z, r) : this.ground.at(x, z))) return false;
    if (this.ferries.length === 0) return true;
    // A blocked sample point is free again where the ferry boat floats over it.
    const g = this.ground;
    const k = r * 0.8;
    const at = (px: number, pz: number): boolean => g.at(px, pz) && !this.boatAt(px, pz, 0.15);
    return r > 0 ? at(x, z) || at(x + k, z) || at(x - k, z) || at(x, z + k) || at(x, z - k) : at(x, z);
  }

  /**
   * Pushes a body out of static colliders, then keeps it off blocked ground (water) by sliding
   * back along one axis toward where it stood at the start of the step (`px`, `pz`).
   */
  resolve(body: { x: number; z: number; px: number; pz: number }, r: number): void {
    const list = this.near(body.x, body.z, r + 1);
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const c of list) moved = pushOut(body, r, c) || moved;
      if (!moved) break;
    }
    if (!this.blocked(body.x, body.z, r)) return;
    if (!this.blocked(body.x, body.pz, r)) body.z = body.pz;
    else if (!this.blocked(body.px, body.z, r)) body.x = body.px;
    else if (!this.blocked(body.px, body.pz, r)) {
      body.x = body.px;
      body.z = body.pz;
    }
  }
}

const key = (gx: number, gz: number): number => (gx + 4096) * 8192 + (gz + 4096);
