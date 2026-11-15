// Expedition map format (M10/M11). A map is authored as anchors in meters (`koepenick.ts`); a
// scale factor stretches distances while buildings, streets and characters keep their size, so the
// whole map can grow if it plays too small. Lots (ordinary buildings, trees) are generated along
// streets and inside zones from a seed, so a bigger map simply gets more of them.
// One source for sim (colliders, walkability, encounters) and renderer (meshes).
import type { Collider } from '../sim/collide';
import type { Bounds } from '../sim/flowfield';
import { Level, WalkGrid, type EncounterDef, type Point, type ZoneDef } from '../sim/level';
import { Rng } from '../sim/math';
import { propCollider, type Prop } from './courtyard';

export type Pt = readonly [number, number];

export interface River {
  name: string;
  pts: Pt[];
  width: number;
}

export interface Bridge {
  name: string;
  x: number;
  z: number;
  /** Direction of travel across, as a facing angle (0 = along +Z). */
  rot: number;
  len: number;
  width: number;
}

export type StreetKind = 'main' | 'side' | 'path';

export interface Street {
  name: string;
  pts: Pt[];
  width: number;
  kind: StreetKind;
}

export type GroundKind = 'cobbles' | 'asphalt' | 'grass' | 'forest' | 'jungle';
export type LotKind = 'altbau' | 'house' | 'platte';

export interface Area {
  id: string;
  name: string;
  poly: Pt[];
  ground: GroundKind;
  /** Buildings along streets inside this area. */
  frontage: LotKind | null;
  /** Trees per 100 m² of free ground (0 = none). */
  trees: number;
  /** Jungle style trees (Urzeit) instead of Berlin forest. */
  jungle?: boolean;
}

export type LandmarkKind = 'sbahnhof' | 'forum' | 'rathaus' | 'schloss' | 'mueggelturm' | 'riesenrad' | 'dino' | 'kirche';

export interface Landmark {
  kind: LandmarkKind;
  x: number;
  z: number;
  /** Facing angle of the main front. */
  rot: number;
  /** Half extents of the footprint (blocking). */
  hx: number;
  hz: number;
  /** Extra free space kept around it (no generated lots). */
  clear: number;
}

export interface Lot {
  kind: LotKind | 'tree';
  x: number;
  z: number;
  /** Facing angle of the street front. */
  rot: number;
  /** Width along the street, depth away from it. Trees: w = crown size. */
  w: number;
  d: number;
  floors: number;
  seed: number;
  jungle?: boolean;
}

/** Round hill: flat top of radius `r`, smooth slope `slope` meters wide down to the plain. */
export interface Hill {
  name: string;
  x: number;
  z: number;
  r: number;
  slope: number;
  h: number;
}

/** A stair or ramp: centered on (x, z), rising along facing `rot` from 0 to the terrace height. */
export interface Stair {
  x: number;
  z: number;
  rot: number;
  width: number;
  len: number;
}

export interface Terrace {
  name: string;
  poly: Pt[];
  h: number;
  stairs: Stair[];
}

export interface MapDef {
  id: string;
  name: string;
  bounds: Bounds;
  start: Point;
  rivers: River[];
  lakes: Pt[][];
  /** Land inside water (islands). */
  islands: Pt[][];
  bridges: Bridge[];
  streets: Street[];
  areas: Area[];
  /** Ground where no area applies. */
  defaultGround: GroundKind;
  landmarks: Landmark[];
  encounters: EncounterDef[];
  zones: ZoneDef[];
  /** A railway embankment: blocks except at the station passage. */
  rail: { z: number; minX: number; maxX: number; gapX: number; gapW: number } | null;
  /** Soft ground heights (walkable everywhere). */
  hills: Hill[];
  /** Raised platforms with retaining walls, reachable by stairs only. */
  terraces: Terrace[];
  seed: number;
}

// ---------------------------------------------------------------- geometry

export function inPoly(poly: readonly Pt[], x: number, z: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Pt;
    const b = poly[j] as Pt;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Distance to a polyline and the direction of the nearest segment. */
export function lineDist(pts: readonly Pt[], x: number, z: number, dir?: { x: number; z: number }): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1] as Pt;
    const [bx, bz] = pts[i] as Pt;
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) {
      best = d;
      if (dir) {
        const l = Math.sqrt(l2);
        dir.x = dx / l;
        dir.z = dz / l;
      }
    }
  }
  return best;
}

export function ellipse(cx: number, cz: number, rx: number, rz: number, n = 20): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push([cx + Math.cos((i / n) * Math.PI * 2) * rx, cz + Math.sin((i / n) * Math.PI * 2) * rz]);
  return out;
}

/** Is (x, z) on a bridge deck (with `pad` meters of slack)? */
export function onBridge(m: MapDef, x: number, z: number, pad = 0): Bridge | null {
  for (const b of m.bridges) {
    const ux = Math.sin(b.rot);
    const uz = Math.cos(b.rot);
    const dx = x - b.x;
    const dz = z - b.z;
    const along = dx * ux + dz * uz;
    const across = -dx * uz + dz * ux;
    if (Math.abs(along) <= b.len / 2 + pad && Math.abs(across) <= b.width / 2 + pad) return b;
  }
  return null;
}

// ---------------------------------------------------------------- heights (backlog B3)
// The sim stays 2D: retaining walls and stair sides are blocked cells of the walk grid; the
// renderer lifts ground, buildings and characters to `heightAt`.

/** Position on a stair: along (0 at the low end … 1 at the top) and across (meters from the axis). */
function stairLocal(s: Stair, x: number, z: number): { along: number; across: number } {
  const ux = Math.sin(s.rot);
  const uz = Math.cos(s.rot);
  const dx = x - s.x;
  const dz = z - s.z;
  return { along: (dx * ux + dz * uz) / s.len + 0.5, across: -dx * uz + dz * ux };
}

export function onStair(t: Terrace, x: number, z: number, pad = 0): Stair | null {
  for (const s of t.stairs) {
    const l = stairLocal(s, x, z);
    if (l.along >= -pad / s.len && l.along <= 1 + pad / s.len && Math.abs(l.across) <= s.width / 2 + pad) return s;
  }
  return null;
}

/** Distance from a point to the outline of a closed polygon. */
export function polyEdgeDist(poly: readonly Pt[], x: number, z: number): number {
  return lineDist([...poly, poly[0] as Pt], x, z);
}

export function heightAt(m: MapDef, x: number, z: number): number {
  let h = 0;
  for (const hill of m.hills) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    if (d >= hill.r + hill.slope) continue;
    const t = d <= hill.r ? 1 : 1 - (d - hill.r) / hill.slope;
    h = Math.max(h, hill.h * t * t * (3 - 2 * t));
  }
  for (const t of m.terraces) {
    if (inPoly(t.poly, x, z)) h = Math.max(h, t.h);
    const s = onStair(t, x, z);
    if (s) h = Math.max(h, t.h * Math.max(0, Math.min(1, stairLocal(s, x, z).along)));
  }
  return h;
}

/** Retaining walls and stair sides block; the stair runs stay open. */
export function terraceWall(m: MapDef, x: number, z: number): boolean {
  for (const t of m.terraces) {
    for (const s of t.stairs) {
      const l = stairLocal(s, x, z);
      if (l.along < -0.05 || l.along > 1.05) continue;
      const side = Math.abs(l.across) - s.width / 2;
      if (side <= 0) return false;
      // Side walls where the stair is more than knee high.
      if (side < 0.45 && l.along * t.h > 0.5) return true;
    }
    if (polyEdgeDist(t.poly, x, z) < 0.45) return true;
  }
  return false;
}

export function isWater(m: MapDef, x: number, z: number): boolean {
  if (m.islands.some((p) => inPoly(p, x, z))) return false;
  return m.lakes.some((p) => inPoly(p, x, z)) || m.rivers.some((r) => lineDist(r.pts, x, z) < r.width / 2);
}

export function areaAt(m: MapDef, x: number, z: number): Area | null {
  for (const a of m.areas) if (inPoly(a.poly, x, z)) return a;
  return null;
}

export function streetDist(m: MapDef, x: number, z: number, dir?: { x: number; z: number }): { d: number; street: Street | null } {
  let d = Infinity;
  let street: Street | null = null;
  const tmp = { x: 0, z: 0 };
  for (const s of m.streets) {
    const sd = lineDist(s.pts, x, z, tmp) - s.width / 2;
    if (sd < d) {
      d = sd;
      street = s;
      if (dir) {
        dir.x = tmp.x;
        dir.z = tmp.z;
      }
    }
  }
  return { d, street };
}

export function landmarkCollider(l: Landmark): Collider {
  return { kind: 'box', x: l.x, z: l.z, hx: l.hx, hz: l.hz, rot: l.rot };
}

// ---------------------------------------------------------------- lots

const LOT: Record<LotKind, { w: [number, number]; d: [number, number]; floors: [number, number]; setback: number }> = {
  altbau: { w: [14, 22], d: [11, 14], floors: [1, 3], setback: 2.2 },
  house: { w: [8, 11], d: [8, 10], floors: [0, 1], setback: 4 },
  platte: { w: [26, 34], d: [11, 12], floors: [3, 4], setback: 6 },
};

/** Occupancy raster (2 m) so generated lots never overlap each other or kept-free places. */
class Occupancy {
  private readonly cells = new Set<number>();
  constructor(private readonly cell = 2) {}
  private k(c: number, r: number): number {
    return (c + 2048) * 4096 + (r + 2048);
  }
  /** Rectangle cells (rotated) with a margin. */
  private each(x: number, z: number, rot: number, hw: number, hd: number, fn: (k: number) => boolean): boolean {
    const ux = Math.cos(rot);
    const uz = -Math.sin(rot);
    const fx = Math.sin(rot);
    const fz = Math.cos(rot);
    const step = this.cell * 0.5;
    for (let a = -hw; a <= hw + 1e-6; a += step) {
      for (let b = -hd; b <= hd + 1e-6; b += step) {
        const px = x + ux * a + fx * b;
        const pz = z + uz * a + fz * b;
        if (!fn(this.k(Math.floor(px / this.cell), Math.floor(pz / this.cell)))) return false;
      }
    }
    return true;
  }
  free(x: number, z: number, rot: number, hw: number, hd: number): boolean {
    return this.each(x, z, rot, hw, hd, (k) => !this.cells.has(k));
  }
  take(x: number, z: number, rot: number, hw: number, hd: number): void {
    this.each(x, z, rot, hw, hd, (k) => {
      this.cells.add(k);
      return true;
    });
  }
}

/** Ground that must stay open: water, bridges, encounter circles, landmarks. */
function reserved(m: MapDef, x: number, z: number, pad: number): boolean {
  if (isWater(m, x, z) || onBridge(m, x, z, pad + 2)) return true;
  for (const e of m.encounters) if (Math.hypot(x - e.x, z - e.z) < e.r + pad) return true;
  for (const l of m.landmarks) if (Math.abs(x - l.x) < l.hx + l.clear + pad && Math.abs(z - l.z) < l.hz + l.clear + pad) return true;
  if (m.rail && Math.abs(z - m.rail.z) < 6 + pad && x > m.rail.minX && x < m.rail.maxX) return true;
  for (const t of m.terraces) if (polyEdgeDist(t.poly, x, z) < pad + 1 || onStair(t, x, z, pad + 1.5)) return true;
  return x < m.bounds.minX + 2 || x > m.bounds.maxX - 2 || z < m.bounds.minZ + 2 || z > m.bounds.maxZ - 2;
}

/** Generates buildings along streets and trees on free ground. Deterministic per map seed. */
export function generateLots(m: MapDef): Lot[] {
  const rng = new Rng(m.seed);
  const occ = new Occupancy();
  const lots: Lot[] = [];

  // 1. Building fronts along streets, both sides.
  for (const s of m.streets) {
    if (s.kind === 'path') continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      for (const side of [-1, 1]) {
        let t = rng.range(2, 6);
        while (t < len - 4) {
          const cx = ax + dx * t;
          const cz = az + dz * t;
          const area = areaAt(m, cx, cz);
          const kind = area?.frontage;
          if (!kind) {
            t += 6;
            continue;
          }
          const L = LOT[kind];
          const w = rng.range(L.w[0], L.w[1]);
          const d = rng.range(L.d[0], L.d[1]);
          // Normal pointing away from the street on this side; the front faces the street.
          const nx = -dz * side;
          const nz = dx * side;
          const off = s.width / 2 + L.setback + d / 2;
          const x = cx + dx * (w / 2) + nx * off;
          const z = cz + dz * (w / 2) + nz * off;
          const rot = Math.atan2(-nx, -nz);
          const ok = t + w < len + 2 && areaAt(m, x, z) === area && streetDist(m, x, z).d > d / 2 - 0.5 && cornersOk(m, x, z, rot, w / 2, d / 2) && occ.free(x, z, rot, w / 2 + 1, d / 2 + 1);
          if (ok && rng.next() > 0.12) {
            occ.take(x, z, rot, w / 2 + 1, d / 2 + 1);
            lots.push({ kind, x, z, rot, w, d, floors: L.floors[0] + rng.int(L.floors[1] - L.floors[0] + 1), seed: rng.int(1e6) });
            t += w + rng.range(0.5, 3);
          } else {
            t += rng.range(3, 6);
          }
        }
      }
    }
  }

  // 2. Trees on free ground, by area density.
  const step = 4.5;
  const B = m.bounds;
  for (let z = B.minZ + 3; z < B.maxZ - 3; z += step) {
    for (let x = B.minX + 3; x < B.maxX - 3; x += step) {
      const px = x + rng.range(-1.8, 1.8);
      const pz = z + rng.range(-1.8, 1.8);
      const area = areaAt(m, px, pz);
      const density = area ? area.trees : 0.35;
      if (rng.next() * 100 > density * step * step) continue;
      if (reserved(m, px, pz, 1.5) || streetDist(m, px, pz).d < 2.5) continue;
      const w = rng.range(3.5, 6.5);
      if (!occ.free(px, pz, 0, 1, 1)) continue;
      occ.take(px, pz, 0, 1, 1);
      lots.push({ kind: 'tree', x: px, z: pz, rot: rng.range(0, Math.PI * 2), w, d: w, floors: 0, seed: rng.int(1e6), jungle: area?.jungle });
    }
  }
  return lots;
}

function cornersOk(m: MapDef, x: number, z: number, rot: number, hw: number, hd: number): boolean {
  const ux = Math.cos(rot);
  const uz = -Math.sin(rot);
  const fx = Math.sin(rot);
  const fz = Math.cos(rot);
  for (const [a, b] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, 0]] as Array<[number, number]>) {
    const px = x + ux * a + fx * b;
    const pz = z + uz * a + fz * b;
    if (reserved(m, px, pz, 1)) return false;
    // Keep buildings off every street, not only their own.
    if (streetDist(m, px, pz).d < 1) return false;
  }
  return true;
}

export function lotCollider(l: Lot): Collider {
  if (l.kind === 'tree') return { kind: 'circle', x: l.x, z: l.z, r: l.jungle ? 0.55 : 0.4 };
  return { kind: 'box', x: l.x, z: l.z, hx: l.w / 2, hz: l.d / 2, rot: l.rot };
}

/**
 * Street lanterns, fire barrels and cover at every encounter, wrecks and rubble on the streets.
 * Deterministic per map seed; nothing lands on a building, in the water or in a fight's center.
 */
export function generateProps(m: MapDef, lots: Lot[]): Prop[] {
  const rng = new Rng(m.seed + 7);
  const props: Prop[] = [];
  const hit = (x: number, z: number, r: number): boolean =>
    isWater(m, x, z) ||
    lots.some((l) => Math.abs(x - l.x) < l.w / 2 + r + 1 && Math.abs(z - l.z) < Math.max(l.w, l.d) / 2 + r + 1 && (l.kind !== 'tree' || Math.hypot(x - l.x, z - l.z) < r + 1)) ||
    props.some((p) => Math.hypot(x - p.x, z - p.z) < r + 1.2) ||
    m.terraces.some((t) => polyEdgeDist(t.poly, x, z) < r + 1 || onStair(t, x, z, r + 1) !== null) ||
    m.landmarks.some((l) => Math.abs(x - l.x) < l.hx + r && Math.abs(z - l.z) < l.hz + r);
  // Lanterns along streets, alternating sides.
  for (const s of m.streets) {
    if (s.kind === 'path') continue;
    let side = 1;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      for (let t = 8; t < len - 4; t += s.kind === 'main' ? 26 : 32) {
        side = -side;
        const x = ax + dx * t - dz * side * (s.width / 2 + 0.8);
        const z = az + dz * t + dx * side * (s.width / 2 + 0.8);
        if (hit(x, z, 0.3) || onBridge(m, x, z, 1)) continue;
        if (m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r * 0.6)) continue;
        props.push({ kind: 'lantern', x, z, rot: 0, size: 1 });
      }
    }
  }
  // Every fight gets fire light and some cover near its rim.
  for (const e of m.encounters) {
    let barrels = 0;
    for (let tries = 0; tries < 40 && barrels < 2; tries++) {
      const a = rng.range(0, Math.PI * 2);
      const x = e.x + Math.sin(a) * e.r * 0.72;
      const z = e.z + Math.cos(a) * e.r * 0.72;
      if (hit(x, z, 0.6) || streetDist(m, x, z).d < -1) continue;
      props.push({ kind: 'fireBarrel', x, z, rot: 0, size: 1 });
      barrels++;
    }
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI * 2);
      const f = rng.range(0.45, 0.8);
      const x = e.x + Math.sin(a) * e.r * f;
      const z = e.z + Math.cos(a) * e.r * f;
      const kind = rng.pick(['sandbags', 'crates', 'rubble', 'sandbags'] as const);
      if (hit(x, z, 1.4)) continue;
      props.push({ kind, x, z, rot: a + Math.PI / 2, size: rng.range(0.8, 1.2) });
    }
  }
  // Wrecks and rubble along the main streets.
  for (const s of m.streets) {
    if (s.kind !== 'main') continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = rng.range(10, 30); t < len - 6; t += rng.range(30, 60)) {
        const x = ax + ((bx - ax) / len) * t + rng.range(-2, 2);
        const z = az + ((bz - az) / len) * t + rng.range(-2, 2);
        if (onBridge(m, x, z, 2) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 3)) continue;
        const van = rng.next() < 0.35;
        if (hit(x, z, van ? 3 : 1.2)) continue;
        props.push({ kind: van ? 'van' : 'rubble', x, z, rot: Math.atan2(bx - ax, bz - az) + rng.range(-0.5, 0.5), size: rng.range(0.8, 1.3) });
      }
    }
  }
  return props;
}

/** The sim side of a map. */
export function mapLevel(m: MapDef, lots: Lot[], props: Prop[] = generateProps(m, lots)): Level {
  const colliders: Collider[] = [];
  for (const p of props) {
    const c = propCollider(p);
    if (c) colliders.push(c);
  }
  for (const l of m.landmarks) if (l.hx > 0) colliders.push(landmarkCollider(l));
  for (const l of lots) colliders.push(lotCollider(l));
  if (m.rail) {
    const r = m.rail;
    const left = (r.gapX - r.gapW / 2 + r.minX) / 2;
    const right = (r.gapX + r.gapW / 2 + r.maxX) / 2;
    colliders.push({ kind: 'box', x: left, z: r.z, hx: (r.gapX - r.gapW / 2 - r.minX) / 2, hz: 4, rot: 0 });
    colliders.push({ kind: 'box', x: right, z: r.z, hx: (r.maxX - r.gapX - r.gapW / 2) / 2, hz: 4, rot: 0 });
  }
  const ground = new WalkGrid(m.bounds, 0.5, (x, z) => (isWater(m, x, z) && !onBridge(m, x, z)) || terraceWall(m, x, z));
  return new Level(m.id, m.bounds, m.start, colliders, ground, [], m.bounds, m.encounters, m.zones);
}
