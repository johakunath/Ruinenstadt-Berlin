// A level: everything the sim needs to know about a map. Static footprints (indexed in a coarse
// hash so a city of colliders stays cheap), a walkability grid for water and map edges, the start,
// and either arena spawn points (the gate 1 courtyard) or encounters (expedition maps).
import { pushOut, type Collider } from './collide';
import type { RestArea } from './rest';
import type { Bounds } from './flowfield';
import type { EnemyKind } from '../data/enemies';
import { onFerryBoat, type FerryLane } from './ferry';
import type { BreakableDef } from './breakables';

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
  /** Chance that a normal spawn is an elite. */
  elite?: number;
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
  /**
   * M20 generator hold (2D GEN): instead of the first wave, the hero charges for `need` seconds while
   * standing within `r` of the center; one enemy of the first wave's mix comes out of `mouth` about
   * every `every` seconds (an elite at half charge). Full: a `power` event, then the other waves.
   */
  hold?: { r: number; need: number; every: number; mouth: Point };
  /** M15: the boss stands here instead of coming from the rim (the Weltzeituhr on its base). */
  bossAt?: Point;
  /**
   * M18 walk-in room (Zum Magendoktor, E2): the whole room is the arena. The fight starts when the hero is inside
   * this rectangle (inner half extents, turned like a landmark by `rot`) and every wave spawns on free cells in it.
   */
  room?: RoomRect;
}

/** A rectangle turned like a landmark: local (u, v) maps to (x + u cos rot + v sin rot, z − u sin rot + v cos rot). */
export interface RoomRect { x: number; z: number; rot: number; hx: number; hz: number }

/** Inside a room rectangle, `pad` meters in from its walls (negative: beyond them). */
export function inRoom(r: RoomRect, x: number, z: number, pad = 0): boolean {
  const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot), s = Math.sin(r.rot);
  return Math.abs(dx * c - dz * s) < r.hx - pad && Math.abs(dx * s + dz * c) < r.hz - pad;
}

/** M20 tunnel grating across the track bed: closed (its collider in the level) until encounter `after` is won. */
export interface GateDef {
  x: number;
  z: number;
  /** Facing along the track (the bars run across it). */
  rot: number;
  /** Half the width it closes. */
  half: number;
  after: number;
  collider: Collider;
}

/**
 * M16 step 6c Kristallsockel (`docs/tasks/m12d-charlottenburg-enemies.md` › Maze riddles): plinths, each a
 * small hold ring; standing `need` seconds within `r` lights one for good. All lit: the hedge gate's
 * collider leaves the level (`RunContent.plinths`, saved with the run).
 */
export interface PlinthDef {
  pts: Point[];
  r: number;
  need: number;
  /** Facing along the corridor it closes (the hedge runs across it), half its width. */
  gate: { x: number; z: number; rot: number; half: number; collider: Collider };
}

/** P25 Türsteher neon bar across a Tor passage: open (not in the level) until `Level.shut`. */
export interface BarrierDef {
  x: number;
  z: number;
  /** Facing of the Tor; the bar runs along its local x. */
  rot: number;
  /** Half the width of the passage it closes (the collider reaches 0.6 m further, into the piers). */
  half: number;
  collider: Collider;
}

/** A band along a polyline (flooded track bed); flat ends, so it stops where it is drawn. */
export interface Ribbon {
  pts: Point[];
  half: number;
}

/** Inside a ribbon: within `half` of a segment, not past the first or last point. */
export function inRibbon(r: Ribbon, x: number, z: number): boolean {
  const n = r.pts.length;
  for (let i = 1; i < n; i++) {
    const a = r.pts[i - 1]!, b = r.pts[i]!;
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
    if ((t < 0 && i === 1) || (t > 1 && i === n - 1)) continue;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) <= r.half) return true;
  }
  return false;
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
    /** Props the hero can break (M4); their colliders are in `colliders` until broken. */
    readonly breakables: BreakableDef[] = [],
  ) {
    for (const c of colliders) this.insert(c);
  }

  private readonly removed: Collider[] = [];
  /** L2: district index for loot (2D `D.lvl`: item level +3 per district) and item name flavor. Köpenick 0. */
  district = 0;
  /** Enemy strength step (`districtScale`): the district, a tunnel its line. */
  strength = 0;
  flavor?: 'neon' | 'gdr' | 'revue' | 'fest';
  /** U-Bahn tunnel map (M19/M20): the tunnel set drops here. */
  tunnel?: boolean;
  /** Map id of a district level (`MapDef.id`), for rules tied to one map (the Köpenick first fights). */
  mapId?: string;
  /** M12c rain (2D `D.wet`): fire burns shorter, shock chains reach further and jump once more. */
  wet?: boolean;
  /** M16 „Glas splittert“: glass bodies burst when they die. */
  shards?: boolean;
  /** M20 walkable camp: no enemies, no director, no run content. */
  camp = false;
  /** M16b/M19 side passages: fixed hidden blessing spots (replace the random ones) and sleeping guards. */
  hiddenSpots: Point[] = [];
  guards: Array<{ x: number; z: number; kind: import('../data/enemies').EnemyKind; elite: boolean; wake: number; hp: number; pose?: 'lying' | 'hidden'; facing?: number }> = [];
  /** M16: polygons where nothing is ever spawned or placed (the Bahnhof Zoo platform). */
  noSpawn: Point[][] = [];
  /** Inside a `noSpawn` polygon. */
  noSpawnAt(x: number, z: number): boolean {
    return this.noSpawn.some((poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i]!, b = poly[j]!;
        if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
      }
      return inside;
    });
  }
  /** M20 tunnel: gratings between the sections, the flooded stretch (speed factor) and the trader on the start platform. */
  gates: GateDef[] = [];
  /** M16 step 6c: the maze plinths and their hedge gate (Charlottenburg only). */
  plinths: PlinthDef | null = null;
  /** P25 Brandenburger Tor: the Türsteher's neon bars (`src/sim/barriers.ts`), open at build time. */
  barriers: BarrierDef[] = [];
  /** M20 camp: station colliders that apply from level `lo` to `hi` (0 = build site), switched by `syncCampSolids`. */
  campSolids: Array<{ station: string; lo: number; hi: number; collider: Collider }> = [];
  wade: (Ribbon & { factor: number }) | null = null;
  traderSpot: Point | null = null;

  /** Walking speed factor at (x, z): 1 on dry ground, `wade.factor` in the flooded stretch (2D `P.wet`). */
  speedAt(x: number, z: number): number {
    return this.wade && inRibbon(this.wade, x, z) ? this.wade.factor : 1;
  }

  /** M11c lot types: preferred places for run events (captive, trader, cache). */
  spots: Record<'rescue' | 'trader' | 'cache', Point[]> = { rescue: [], trader: [], cache: [] };

  private cells(c: Collider, fn: (cell: number) => void): void {
    const e = c.kind === 'circle' ? c.r : Math.hypot(c.hx, c.hz);
    for (let gx = Math.floor((c.x - e) / HASH); gx <= Math.floor((c.x + e) / HASH); gx++) {
      for (let gz = Math.floor((c.z - e) / HASH); gz <= Math.floor((c.z + e) / HASH); gz++) fn(key(gx, gz));
    }
  }

  private insert(c: Collider): void {
    this.cells(c, (k) => {
      let list = this.hash.get(k);
      if (!list) this.hash.set(k, (list = []));
      list.push(c);
    });
  }

  /** Out of `colliders` and the hash; false when it was not in the level. */
  private unhash(c: Collider): boolean {
    const i = this.colliders.indexOf(c);
    if (i < 0) return false;
    this.colliders.splice(i, 1);
    this.cells(c, (k) => {
      const list = this.hash.get(k);
      const j = list ? list.indexOf(c) : -1;
      if (list && j >= 0) list.splice(j, 1);
    });
    return true;
  }

  /** Takes a collider out of the level (a broken prop). `restore` puts it back for the next run. */
  remove(c: Collider): void {
    if (this.unhash(c)) this.removed.push(c);
  }

  private readonly shutSet = new Set<Collider>();

  /**
   * P25: puts a toggled collider (a neon bar) into the level, outside the `add` / `remove` journal so a
   * bar that opens and closes many times never confuses `restore`. Idempotent.
   */
  shut(c: Collider): void {
    if (this.shutSet.has(c)) return;
    this.shutSet.add(c);
    this.colliders.push(c);
    this.insert(c);
  }

  /** Takes a shut collider out again. Idempotent. */
  open(c: Collider): void {
    if (this.shutSet.delete(c)) this.unhash(c);
  }

  isShut(c: Collider): boolean {
    return this.shutSet.has(c);
  }

  private readonly added: Collider[] = [];

  /** Adds a collider for this run only (a shrine column); `restore` takes it out again. */
  add(c: Collider): void {
    this.colliders.push(c);
    this.insert(c);
    this.added.push(c);
  }

  /** Puts every removed collider back; a new sim starts on an intact map. */
  restore(): void {
    for (const c of [...this.shutSet]) this.open(c);
    for (const c of this.added.splice(0)) {
      this.remove(c);
      this.removed.pop();
    }
    for (const c of this.removed) {
      this.colliders.push(c);
      this.insert(c);
    }
    this.removed.length = 0;
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
