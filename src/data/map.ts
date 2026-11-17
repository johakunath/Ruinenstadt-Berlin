// Expedition map format (M10/M11). A map is authored as anchors in meters (`koepenick.ts`); a
// scale factor stretches distances while buildings, streets and characters keep their size, so the
// whole map can grow if it plays too small. Lots (ordinary buildings, trees) are generated along
// streets and inside zones from a seed, so a bigger map simply gets more of them.
// One source for sim (colliders, walkability, encounters) and renderer (meshes).
import type { Collider } from '../sim/collide';
import type { Bounds } from '../sim/flowfield';
import { Level, WalkGrid, type EncounterDef, type Point, type ZoneDef } from '../sim/level';
import { Rng } from '../sim/math';
import type { BreakableDef } from '../sim/breakables';
import { restAt, type RestArea } from '../sim/rest';
import { onFerryPier } from '../sim/ferry';
import { propCollider, type Prop } from './courtyard';
import { spatiColliders, spatiProps, spatiRest } from './spati';

export type Pt = readonly [number, number];

export interface River {
  name: string;
  pts: Pt[];
  width: number;
}

export interface Bridge {
  name: string;
  /** A moored ferry deck instead of a fixed bridge (same walkable crossing). */
  kind?: 'ferry';
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
  /** Double tram track down the middle. */
  tram?: boolean;
  /**
   * M11d street profile (Johannes, 2026-11-17, `docs/mockups/m11d-street-profiles.svg`): `haupt` =
   * two lanes, tram in the middle, parking both sides; `allee` = grass track in the middle, one lane
   * each side. Both get paved sidewalks of `sidewalk` meters with trees in pits.
   */
  profile?: 'haupt' | 'allee';
  sidewalk?: number;
}
/** Tree pits on profile sidewalks: spacing and distance from the curb. */
export const TREE_PIT = { gap: 9, fromCurb: 1.4 } as const;

export type GroundKind = 'cobbles' | 'asphalt' | 'grass' | 'forest' | 'jungle';
export type LotKind = 'altbau' | 'house' | 'platte' | 'shop';

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

export type LandmarkKind = 'sbahnhof' | 'forum' | 'rathaus' | 'schloss' | 'mueggelturm' | 'riesenrad' | 'dino' | 'kirche' | 'spati';

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
  /** Shown when the hero enters (Späti rest stops). */
  name?: string;
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
  /** Burnt-out shell: no roof, broken wall tops, empty windows (about half of all buildings). */
  ruin?: boolean;
  /** Back wing (Seitenflügel, annex): same facing, centered at (x, z), so the footprint is an L. */
  wing?: { x: number; z: number; w: number; d: number };
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
  /** Hand-placed props (wrecks on a bridge, the tram). */
  fixedProps: Prop[];
  seed: number;
  /** L2: district index (Köpenick 0) and item name flavor for the loot of this map. */
  district?: number;
  flavor?: 'neon' | 'gdr';
  /** M19 U-Bahn tunnel: only these tubes are walkable, everything else is rock (no lots, no streets). */
  tunnel?: { tubes: Tube[] };
  /** M16b/M19 side passage surprises: fixed hidden blessings and sleeping guards (a mini-boss). */
  hiddenSpots?: Point[];
  guards?: Level['guards'];
}

/** A walkable tunnel piece along a polyline: track bed, station hall or side passage. */
export interface Tube { pts: Pt[]; width: number; kind: 'track' | 'station' | 'branch' }
/** Inside a tunnel tube (always true on open maps). */
export function inTunnel(m: MapDef, x: number, z: number, pad = 0): boolean {
  return !m.tunnel || m.tunnel.tubes.some((t) => lineDist(t.pts, x, z) <= t.width / 2 - pad);
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

/**
 * Is (x, z) on a bridge deck (with `pad` meters of slack)? A ferry lane counts only at its two
 * piers; the water between is crossed by the boat (`src/sim/ferry.ts`).
 */
export function onBridge(m: MapDef, x: number, z: number, pad = 0): Bridge | null {
  for (const b of m.bridges) {
    if (b.kind === 'ferry') {
      if (onFerryPier(b, x, z) || (pad > 0 && onFerryPier({ ...b, width: b.width + 2 * pad, len: b.len + 2 * pad }, x, z))) return b;
      continue;
    }
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

/** Smooth deterministic noise in about [-1, 1] (sums of sines), for banks and relief. */
export function wobble(x: number, z: number, f = 1): number {
  return (
    (Math.sin(x * 0.11 * f + Math.sin(z * 0.07 * f) * 2.1) * Math.cos(z * 0.13 * f + Math.sin(x * 0.05 * f) * 1.7) +
      0.5 * Math.sin((x + z) * 0.23 * f + 1.3)) /
    1.5
  );
}

/** Urban banks (cobbles or asphalt areas) are straight stone quays; the rest wobble. */
export function isQuay(m: MapDef, x: number, z: number): boolean {
  const g = areaAt(m, x, z)?.ground ?? m.defaultGround;
  return g === 'cobbles' || g === 'asphalt';
}

/** Meters the natural bank moves into (+) or out of (-) the water here. */
function bankShift(m: MapDef, x: number, z: number): number {
  if (isQuay(m, x, z)) return 0;
  // Bridge and ferry heads keep the authored width so decks always reach land.
  for (const b of m.bridges) if (Math.hypot(x - b.x, z - b.z) < b.len / 2 + 6) return 0;
  return 2.2 * wobble(x, z, 2.2) + 0.8 * wobble(z, x, 5);
}

// Relief: low rolling ground in parks and forests, flat on streets, near water, buildings and
// landmarks. Precomputed on a 2 m grid per map (bilinear lookup) because heightAt runs per frame.
const RELIEF_CELL = 2;
const RELIEF_AMP: Record<GroundKind, number> = { cobbles: 0, asphalt: 0, grass: 0.6, forest: 1.5, jungle: 1.2 };
const reliefGrids = new WeakMap<MapDef, { nx: number; nz: number; v: Float32Array }>();

function smooth01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function reliefSample(m: MapDef, x: number, z: number): number {
  const amp = RELIEF_AMP[areaAt(m, x, z)?.ground ?? m.defaultGround];
  if (amp === 0) return 0;
  let f = smooth01((streetDist(m, x, z).d - 3) / 10);
  for (const h of m.hills) f = Math.min(f, smooth01((Math.hypot(x - h.x, z - h.z) - h.r - h.slope - 2) / 6));
  for (const t of m.terraces) f = Math.min(f, inPoly(t.poly, x, z) ? 0 : smooth01((polyEdgeDist(t.poly, x, z) - 2) / 6));
  for (const l of m.landmarks) f = Math.min(f, smooth01((Math.hypot(x - l.x, z - l.z) - Math.max(l.hx, l.hz) - l.clear) / 6));
  if (f === 0) return 0;
  for (const [dx, dz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]] as const) if (isWater(m, x + dx, z + dz)) return 0;
  return amp * f * (0.5 + 0.5 * wobble(x + 40, z - 17, 0.45));
}

/** Rolling ground height (0 where the map is flat). */
export function reliefAt(m: MapDef, x: number, z: number): number {
  const B = m.bounds;
  let g = reliefGrids.get(m);
  if (!g) {
    const nx = Math.ceil((B.maxX - B.minX) / RELIEF_CELL) + 1;
    const nz = Math.ceil((B.maxZ - B.minZ) / RELIEF_CELL) + 1;
    const v = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = reliefSample(m, B.minX + i * RELIEF_CELL, B.minZ + j * RELIEF_CELL);
    g = { nx, nz, v };
    reliefGrids.set(m, g);
  }
  const fx = Math.max(0, Math.min(g.nx - 1.001, (x - B.minX) / RELIEF_CELL));
  const fz = Math.max(0, Math.min(g.nz - 1.001, (z - B.minZ) / RELIEF_CELL));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const w = fz - j;
  const at = (a: number, b: number): number => g.v[b * g.nx + a] ?? 0;
  return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - w) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * w;
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
  return h + reliefAt(m, x, z);
}

/** Street lamp spacing along a street (Johannes 2026-11-16: evenly spaced at the curb, most broken). */
export const LAMP_SPACING = { main: 24, side: 20 } as const;
/** Distance of a lamp from the street edge. */
export const LAMP_CURB = 0.45;
/** Share of street lamps that still work. */
const LAMP_LIT = 0.3;
/** Two lamps of crossing streets never stand closer than this. */
const LAMP_MIN = 6;
/** Two light sources of the same kind keep this distance (barrels may stand together). */
export const SAME_KIND_GAP: Partial<Record<Prop['kind'], number>> = { campfire: 16, workLamp: 9, candles: 7, stringLights: 30 };

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

/** Water with irregular natural banks (`bankShift`); quays and bridge heads keep the authored line. */
export function isWater(m: MapDef, x: number, z: number): boolean {
  if (m.islands.some((p) => inPoly(p, x, z))) return false;
  const near = m.rivers.some((r) => lineDist(r.pts, x, z) < r.width / 2 + 3.2) || m.lakes.some((p) => inPoly(p, x, z) || polyEdgeDist(p, x, z) < 3.2);
  if (!near) return false;
  const e = bankShift(m, x, z);
  return (
    m.rivers.some((r) => lineDist(r.pts, x, z) < r.width / 2 + e) ||
    m.lakes.some((p) => (inPoly(p, x, z) ? polyEdgeDist(p, x, z) > -e : polyEdgeDist(p, x, z) < e))
  );
}

/** Water by the authored lines only (no wobble); for quay walls. */
export function isWaterPlain(m: MapDef, x: number, z: number): boolean {
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

// v2 (M11b): smaller, lower and denser than v1. `gap` is the space to the next lot along the street,
// `wing` the chance of an L-shaped footprint.
const LOT: Record<LotKind, { w: [number, number]; d: [number, number]; floors: [number, number]; setback: number; gap: [number, number]; wing: number }> = {
  altbau: { w: [9, 16], d: [9, 12], floors: [1, 2], setback: 1.6, gap: [0.3, 1.5], wing: 0.45 },
  house: { w: [7, 10], d: [7, 9], floors: [0, 1], setback: 3, gap: [2, 5], wing: 0.35 },
  platte: { w: [24, 30], d: [10, 11], floors: [3, 4], setback: 6, gap: [4, 8], wing: 0 },
  shop: { w: [6, 9], d: [6, 8], floors: [0, 0], setback: 1.6, gap: [0.5, 2], wing: 0 },
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
  if (m.tunnel) return [];
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
          // Altbau streets get single-storey shops (Läden, Spätis) between the blocks.
          const kind2: LotKind = kind === 'altbau' && rng.next() < 0.18 ? 'shop' : kind;
          const L = LOT[kind2];
          const w = rng.range(L.w[0], L.w[1]);
          const d = rng.range(L.d[0], L.d[1]);
          // Normal pointing away from the street on this side; the front faces the street.
          const nx = -dz * side;
          const nz = dx * side;
          const off = s.width / 2 + Math.max(L.setback, s.sidewalk ?? 0) + d / 2;
          const x = cx + dx * (w / 2) + nx * off;
          const z = cz + dz * (w / 2) + nz * off;
          // Houses sit slightly askew; Altbau follows the street line.
          const rot = Math.atan2(-nx, -nz) + (kind2 === 'house' ? rng.range(-0.15, 0.15) : 0);
          // Altbau and shops close the street front (small margin); houses keep their gardens.
          const mg = kind2 === 'house' || kind2 === 'platte' ? 1 : 0.3;
          const ok = t + w < len + 2 && areaAt(m, x, z) === area && streetDist(m, x, z).d > d / 2 - 0.5 && cornersOk(m, x, z, rot, w / 2, d / 2) && occ.free(x, z, rot, w / 2 + mg, d / 2 + mg);
          if (ok && rng.next() > 0.07) {
            const lot: Lot = { kind: kind2, x, z, rot, w, d, floors: L.floors[0] + rng.int(L.floors[1] - L.floors[0] + 1), seed: rng.int(1e6) };
            // Ruinenstadt: about half of the ordinary buildings are burnt-out shells (Johannes, 2026-11-15).
            if (rng.next() < 0.5) lot.ruin = true;
            if (rng.next() < L.wing) {
              // Wing behind the back facade at one end: local +a along the front, -b away from the street.
              const ww = rng.range(4, Math.min(7, w * 0.5));
              const wd = rng.range(4, 8);
              const a = rng.pick([-1, 1]) * (w / 2 - ww / 2);
              const b = -(d / 2 + wd / 2) + 0.05;
              const wx = x + Math.cos(rot) * a + Math.sin(rot) * b;
              const wz = z - Math.sin(rot) * a + Math.cos(rot) * b;
              // Checked before the main lot takes its cells (the wing touches its back facade).
              if (cornersOk(m, wx, wz, rot, ww / 2, wd / 2) && areaAt(m, wx, wz) === area && occ.free(wx, wz, rot, ww / 2 + mg, wd / 2 + mg - 0.3)) {
                occ.take(wx, wz, rot, ww / 2 + mg, wd / 2 + mg);
                lot.wing = { x: wx, z: wz, w: ww, d: wd };
              }
            }
            occ.take(x, z, rot, w / 2 + mg, d / 2 + mg);
            lots.push(lot);
            t += w + rng.range(L.gap[0], L.gap[1]);
          } else {
            t += rng.range(1.5, 3);
          }
        }
      }
    }
  }

  // 2. M11d: trees in pits along profile sidewalks, both sides, off bridges, water and crossings.
  for (const s of m.streets) {
    if (!s.profile || !s.sidewalk) continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt, [bx, bz] = s.pts[i] as Pt, len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let t = TREE_PIT.gap / 2; t < len; t += TREE_PIT.gap) for (const side of [-1, 1]) {
        const off = s.width / 2 + TREE_PIT.fromCurb, x = ax + dx * t - dz * off * side, z = az + dz * t + dx * off * side;
        if (isWater(m, x, z) || onBridge(m, x, z, 2) || reserved(m, x, z, 1) || m.streets.some((o) => o !== s && lineDist(o.pts, x, z) < o.width / 2 + 1.5)) continue;
        if (!occ.free(x, z, 0, 0.8, 0.8)) continue;
        occ.take(x, z, 0, 0.8, 0.8);
        lots.push({ kind: 'tree', x, z, rot: rng.range(0, Math.PI * 2), w: rng.range(4, 5.5), d: 4.5, floors: 0, seed: rng.int(1e6) });
      }
    }
  }

  // 3. Trees on free ground, by area density.
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

export function lotColliders(l: Lot): Collider[] {
  if (l.kind === 'tree') return [{ kind: 'circle', x: l.x, z: l.z, r: l.jungle ? 0.55 : 0.4 }];
  const out: Collider[] = [{ kind: 'box', x: l.x, z: l.z, hx: l.w / 2, hz: l.d / 2, rot: l.rot }];
  if (l.wing) out.push({ kind: 'box', x: l.wing.x, z: l.wing.z, hx: l.wing.w / 2, hz: l.wing.d / 2, rot: l.rot });
  return out;
}

/**
 * Street lanterns, fire barrels and cover at every encounter, wrecks and rubble on the streets.
 * Deterministic per map seed; nothing lands on a building, in the water or in a fight's center.
 */
export function generateProps(m: MapDef, lots: Lot[]): Prop[] {
  if (m.tunnel) return tunnelProps(m);
  const rng = new Rng(m.seed + 7);
  const props: Prop[] = [];
  // Späti sandbags and lantern first, so everything else keeps clear of them.
  for (const l of m.landmarks) if (l.kind === 'spati') props.push(...spatiProps(l));
  const hit = (x: number, z: number, r: number): boolean =>
    isWater(m, x, z) ||
    lots.some((l) => Math.abs(x - l.x) < l.w / 2 + r + 1 && Math.abs(z - l.z) < Math.max(l.w, l.d) / 2 + r + 1 && (l.kind !== 'tree' || Math.hypot(x - l.x, z - l.z) < r + 1)) ||
    props.some((p) => Math.hypot(x - p.x, z - p.z) < r + 1.2) ||
    m.terraces.some((t) => polyEdgeDist(t.poly, x, z) < r + 1 || onStair(t, x, z, r + 1) !== null) ||
    m.landmarks.some((l) => Math.abs(x - l.x) < l.hx + r && Math.abs(z - l.z) < l.hz + r);
  // Street lamps (Johannes 2026-11-16): evenly spaced along each street, right at the curb, one
  // side on side streets and staggered on both sides of main streets, plus corner lamps where streets
  // meet or bend. Only about a third still work; the rest are dark and bent.
  const lamps: Array<[number, number]> = [];
  for (const br of m.bridges) {
    if (br.kind === 'ferry' || br.len <= 15) continue;
    for (const [side, a] of [[-1, -br.len / 4], [1, br.len / 4]] as Array<[number, number]>) {
      const c = side * (br.width / 2 + 0.2);
      lamps.push([br.x + Math.cos(br.rot) * c + Math.sin(br.rot) * a, br.z - Math.sin(br.rot) * c + Math.cos(br.rot) * a]);
    }
  }
  const lampOk = (x: number, z: number): boolean =>
    !hit(x, z, 0.3) && !onBridge(m, x, z, 1) && streetDist(m, x, z).d > 0.2 &&
    !m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r * 0.6) &&
    !lamps.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < LAMP_MIN);
  const putLamp = (x: number, z: number): void => {
    lamps.push([x, z]);
    const lit = rng.next() < LAMP_LIT;
    props.push({ kind: lit ? 'lantern' : 'lampBroken', x, z, rot: lit ? 0 : rng.range(0, Math.PI * 2), size: lit ? rng.range(0.8, 1.25) : 1 });
  };
  const streets = m.streets.filter((s) => s.kind !== 'path');
  // Corner lamps first: at street ends that meet another street, and at sharp bends.
  for (const s of streets) {
    const n = s.pts.length;
    for (let i = 0; i < n; i++) {
      const [px, pz] = s.pts[i] as Pt;
      const [qx, qz] = s.pts[i === 0 ? 1 : i - 1] as Pt;
      // Direction along the street toward this point.
      let ux = px - qx;
      let uz = pz - qz;
      const ul = Math.hypot(ux, uz) || 1;
      ux /= ul;
      uz /= ul;
      let corner = false;
      if (i === 0 || i === n - 1) {
        corner = streets.some((o) => o !== s && lineDist(o.pts, px, pz) < o.width / 2 + 1.5);
      } else {
        const [rx, rz] = s.pts[i + 1] as Pt;
        const vl = Math.hypot(rx - px, rz - pz) || 1;
        corner = ux * ((rx - px) / vl) + uz * ((rz - pz) / vl) < Math.cos((35 * Math.PI) / 180);
      }
      if (!corner) continue;
      const side = rng.pick([-1, 1]);
      const off = s.width / 2 + LAMP_CURB + 0.3;
      for (const sd of [side, -side]) {
        const x = px - ux * (s.width / 2 + 1) - uz * sd * off;
        const z = pz - uz * (s.width / 2 + 1) + ux * sd * off;
        if (!lampOk(x, z)) continue;
        putLamp(x, z);
        break;
      }
    }
  }
  // Even rows along each street, measured continuously along the polyline.
  for (const s of streets) {
    const spacing = LAMP_SPACING[s.kind === 'main' ? 'main' : 'side'];
    const rows: Array<[number, number]> = s.kind === 'main' ? [[1, 0], [-1, spacing / 2]] : [[rng.pick([-1, 1]), 0]];
    const segLen = s.pts.slice(1).map((b, i) => Math.hypot(b[0] - (s.pts[i] as Pt)[0], b[1] - (s.pts[i] as Pt)[1]));
    const total = segLen.reduce((a, b) => a + b, 0);
    const at = (d: number): { x: number; z: number; ux: number; uz: number } => {
      let i = 0;
      while (i < segLen.length - 1 && d > segLen[i]!) d -= segLen[i++]!;
      const [ax, az] = s.pts[i] as Pt;
      const [bx, bz] = s.pts[i + 1] as Pt;
      const l = segLen[i]! || 1;
      return { x: ax + ((bx - ax) / l) * d, z: az + ((bz - az) / l) * d, ux: (bx - ax) / l, uz: (bz - az) / l };
    };
    for (const [side, shift] of rows) {
      for (let d = spacing / 2 + shift; d < total - 4; d += spacing) {
        // A blocked spot may move half a meter or a meter; otherwise the row keeps a gap there.
        for (const nudge of [0, 0.5, -0.5, 1, -1]) {
          const c = at(d + nudge);
          const off = side * (s.width / 2 + LAMP_CURB);
          const x = c.x - c.uz * off;
          const z = c.z + c.ux * off;
          if (!lampOk(x, z)) continue;
          putLamp(x, z);
          break;
        }
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
        const roll = rng.next();
        const van = roll < 0.35;
        const bus = roll > 0.8 && s.width >= 7;
        if (bus) {
          // A broken-down bus along the lane, 11 m long: needs room and no fight nearby.
          if (hit(x, z, 6) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 8)) continue;
          const off = (s.width / 2 - 1.5) * rng.pick([-1, 1]);
          props.push({ kind: 'bus', x: x - ((bz - az) / len) * off, z: z + ((bx - ax) / len) * off, rot: Math.atan2(bx - ax, bz - az) + rng.range(-0.08, 0.08), size: 1 });
          continue;
        }
        if (hit(x, z, van ? 3 : 1.2)) continue;
        props.push({ kind: van ? 'van' : 'rubble', x, z, rot: Math.atan2(bx - ax, bz - az) + rng.range(-0.5, 0.5), size: rng.range(0.8, 1.3) });
      }
    }
  }
  // v2 (M11b): every stretch has something. Parked and abandoned cars along the curbs, street
  // furniture on the sidewalks, garden fences in front of houses, bollards at the bridge heads.
  for (const s of m.streets) {
    if (s.kind === 'path') continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const along = Math.atan2(dx, dz);
      for (let t = rng.range(3, 8); t < len - 3; t += rng.range(7, 14)) {
        const side = rng.pick([-1, 1]);
        const stray = rng.next() < 0.2;
        // Parked: 1.1 m inside the curb. Abandoned: askew, partly on the lane.
        const off = side * (s.width / 2 - (stray ? rng.range(1.6, 2.4) : 1.1));
        const x = ax + dx * t - dz * off;
        const z = az + dz * t + dx * off;
        if (onBridge(m, x, z, 3) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 2.5)) continue;
        // On the street, so only props and other cars can be in the way (lots stand behind the curb).
        if (m.zones.some((zn) => Math.hypot(x - zn.entry.x, z - zn.entry.z) < 5) || m.terraces.some((tr) => polyEdgeDist(tr.poly, x, z) < 3 || onStair(tr, x, z, 3) !== null)) continue;
        if (isWater(m, x, z) || props.some((p) => Math.hypot(x - p.x, z - p.z) < 3.4) || m.landmarks.some((l) => Math.abs(x - l.x) < l.hx + 2 && Math.abs(z - l.z) < l.hz + 2)) continue;
        if (rng.next() < 0.75) props.push({ kind: 'car', x, z, rot: along + (rng.next() < 0.5 ? Math.PI : 0) + (stray ? rng.range(-0.6, 0.6) : rng.range(-0.05, 0.05)), size: 1 });
      }
      // Benches, bins and crates on the sidewalk where buildings front the street.
      for (let t = rng.range(6, 14); t < len - 3; t += rng.range(12, 24)) {
        const side = rng.pick([-1, 1]);
        const off = side * (s.width / 2 + 0.9);
        const x = ax + dx * t - dz * off;
        const z = az + dz * t + dx * off;
        if (!areaAt(m, x, z)?.frontage || onBridge(m, x, z, 2) || hit(x, z, 0.9)) continue;
        if (m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r * 0.7)) continue;
        const kind = rng.pick(['bench', 'bins', 'crates', 'bench', 'rubble'] as const);
        props.push({ kind, x, z, rot: along + (side > 0 ? Math.PI / 2 : -Math.PI / 2), size: kind === 'rubble' ? rng.range(0.5, 0.8) : 1 });
      }
    }
  }
  // Campfires of survivors beside the streets: light where lamps are broken.
  for (const s of m.streets) {
    if (s.kind === 'path') continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = rng.range(12, 30); t < len - 4; t += rng.range(35, 60)) {
        const side = rng.pick([-1, 1]);
        const off = side * (s.width / 2 + 2.2);
        const x = ax + ((bx - ax) / len) * t - ((bz - az) / len) * off;
        const z = az + ((bz - az) / len) * t + ((bx - ax) / len) * off;
        if (hit(x, z, 1.2) || onBridge(m, x, z, 2) || streetDist(m, x, z).d < 0.8) continue;
        if (m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 2) || lamps.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 8)) continue;
        const fire = rng.next() < 0.5 && !sameKindClash(props, 'campfire', x, z) ? 'campfire' : 'fireBarrel';
        props.push({ kind: fire, x, z, rot: rng.range(0, Math.PI * 2), size: rng.range(0.7, 1.35) });
      }
    }
  }
  // No invisible walls (Johannes, 2026-11-15): where land meets the map edge a construction fence
  // stands 1 m inside it, with concrete roadblocks where a street runs out. Water edges stay open.
  const B = m.bounds;
  const EDGE = 1.0;
  const PANEL = 3.4;
  for (const [x0, z0, x1, z1] of [[B.minX, B.minZ, B.maxX, B.minZ], [B.maxX, B.minZ, B.maxX, B.maxZ], [B.maxX, B.maxZ, B.minX, B.maxZ], [B.minX, B.maxZ, B.minX, B.minZ]] as Array<[number, number, number, number]>) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const dx = (x1 - x0) / len;
    const dz = (z1 - z0) / len;
    // Inward normal of a clockwise rectangle in XZ (+Z south).
    const nx = -dz;
    const nz = dx;
    // Prop local X runs along the edge: (cos rot, -sin rot) = (dx, dz).
    const rot = Math.atan2(-dz, dx);
    for (let t = EDGE + PANEL / 2; t < len - EDGE; t += PANEL) {
      const x = x0 + dx * t + nx * EDGE;
      const z = z0 + dz * t + nz * EDGE;
      // Skip only panels fully in the water, so the fence reaches every bank.
      const wet = (k: number): boolean => isWater(m, x + dx * k, z + dz * k) && !onBridge(m, x + dx * k, z + dz * k);
      if (wet(0) && wet(-PANEL / 2) && wet(PANEL / 2)) continue;
      const kind = streetDist(m, x, z).d < 1.5 ? 'barrier' : 'bauzaun';
      props.push({ kind, x, z, rot, size: PANEL });
    }
  }
  for (const p of m.fixedProps) if (!isWater(m, p.x, p.z) || onBridge(m, p.x, p.z)) props.push(p);
  for (const l of lots) {
    if (l.kind !== 'house' || rng.next() < 0.25) continue;
    // Front fence 1.4 m in front of the facade, with a gate gap; local +b is towards the street.
    const fx = Math.sin(l.rot);
    const fz = Math.cos(l.rot);
    const ux = Math.cos(l.rot);
    const uz = -Math.sin(l.rot);
    const half = l.w / 2 + 1;
    const gate = rng.range(-half + 1.5, half - 2.5);
    for (const [a0, a1] of [[-half, gate], [gate + 1.2, half]] as Array<[number, number]>) {
      const L = a1 - a0;
      if (L < 0.8) continue;
      const c = (a0 + a1) / 2;
      const x = l.x + fx * (l.d / 2 + 1.4) + ux * c;
      const z = l.z + fz * (l.d / 2 + 1.4) + uz * c;
      if (streetDist(m, x, z).d < 0.4 || isWater(m, x, z) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + L / 2)) continue;
      props.push({ kind: 'fence', x, z, rot: l.rot, size: L });
    }
  }
  for (const br of m.bridges) {
    if (br.kind === 'ferry') continue;
    const ux = Math.sin(br.rot);
    const uz = Math.cos(br.rot);
    for (const end of [-1, 1]) {
      for (const k of [-1.5, -0.5, 0.5, 1.5]) {
        const a = end * (br.len / 2 + 1.2);
        const c = k * (br.width / 4.5);
        const x = br.x + ux * a - uz * c;
        const z = br.z + uz * a + ux * c;
        if (Math.abs(k) < 1 || hit(x, z, 0.2)) continue;
        props.push({ kind: 'bollard', x, z, rot: 0, size: 1 });
      }
    }
  }
  stringLights(m, props, hit, rng);
  fillLight(m, lots, props, hit, rng);
  supplies(m, props, hit);
  return props;
}

/**
 * M4: extra crates and bins along the streets, so there is always something to break between fights.
 * Own random stream, so the props above stay where they were.
 */
function supplies(m: MapDef, props: Prop[], hit: (x: number, z: number, r: number) => boolean): void {
  const rng = new Rng(m.seed + 91);
  for (const s of m.streets) {
    if (s.kind === 'path') continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 8) continue;
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const along = Math.atan2(dx, dz);
      for (let t = rng.range(8, 20); t < len - 4; t += rng.range(26, 44)) {
        const side = rng.pick([-1, 1]);
        const off = side * (s.width / 2 + 0.9);
        const x = ax + dx * t - dz * off;
        const z = az + dz * t + dx * off;
        const kind = rng.next() < 0.5 ? 'crates' : 'bins';
        if (onBridge(m, x, z, 2) || hit(x, z, 0.9) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r * 0.7)) continue;
        props.push({ kind, x, z, rot: along + (side > 0 ? Math.PI / 2 : -Math.PI / 2), size: 1 });
      }
    }
  }
}

/** Is (x, z) on a lot's footprint (main body or wing), with `pad` meters of margin? */
function inLot(l: Lot, x: number, z: number, pad: number): boolean {
  const c = Math.cos(l.rot);
  const s = Math.sin(l.rot);
  const inside = (cx: number, cz: number, w: number, d: number): boolean => {
    const dx = x - cx;
    const dz = z - cz;
    return Math.abs(dx * c - dz * s) <= w / 2 + pad && Math.abs(dx * s + dz * c) <= d / 2 + pad;
  };
  return inside(l.x, l.z, l.w, l.d) || (l.wing !== undefined && inside(l.wing.x, l.wing.z, l.wing.w, l.wing.d));
}

/** Light sources: working lamps, fires, construction lamps, grave candles, string lights. */
export const LIGHT_PROPS: ReadonlySet<Prop['kind']> = new Set<Prop['kind']>(['lantern', 'fireBarrel', 'campfire', 'workLamp', 'candles', 'stringLights']);
/**
 * Light gap rule (Johannes 2026-11-16): where one light pool ends the next begins, but organic, not
 * on a grid. The allowed distance to the nearest light varies with a slow noise between
 * LIGHT_COVER_MIN (bright pockets) and LIGHT_COVER (dim stretches).
 */
export const LIGHT_COVER_MIN = 6;
export const LIGHT_COVER = 13;

/** Would a light of `kind` at (x, z) stand too close to another of the same kind? */
export function sameKindClash(props: readonly Prop[], kind: Prop['kind'], x: number, z: number): boolean {
  const gap = SAME_KIND_GAP[kind];
  return gap !== undefined && props.some((p) => p.kind === kind && Math.hypot(p.x - x, p.z - z) < gap);
}

/** Allowed distance to the nearest light at (x, z). */
export function lightCover(x: number, z: number): number {
  return LIGHT_COVER_MIN + (LIGHT_COVER - LIGHT_COVER_MIN) * (0.5 + 0.5 * wobble(x * 0.9 + 13, z * 0.9 - 7, 0.6));
}

/** String lights across some side streets: two poles at the curbs, a sagging line of bulbs. */
function stringLights(m: MapDef, props: Prop[], hit: (x: number, z: number, r: number) => boolean, rng: Rng): void {
  for (const s of m.streets) {
    if (s.kind !== 'side') continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      for (let t = rng.range(10, 40); t < len - 6; t += rng.range(45, 90)) {
        const x = ax + ux * t;
        const z = az + uz * t;
        const half = s.width / 2 + 0.5;
        const poles: Array<[number, number]> = [[x - uz * half, z + ux * half], [x + uz * half, z - ux * half]];
        if (poles.some(([px, pz]) => hit(px, pz, 0.3) || onBridge(m, px, pz, 1))) continue;
        if (m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r) || m.zones.some((zn) => Math.hypot(x - zn.entry.x, z - zn.entry.z) < 6)) continue;
        if (sameKindClash(props, 'stringLights', x, z)) continue;
        // rot: the line runs across the street (facing along it).
        props.push({ kind: 'stringLights', x, z, rot: Math.atan2(ux, uz), size: half * 2 });
      }
    }
  }
}

/**
 * Light coverage pass: walks every street (not paths, not bridges) and, where no light source,
 * Späti or landmark is within the local `lightCover`, adds one beside the street at a random offset,
 * with a random strength, and sometimes a small cluster around it (a campfire with candles, a work
 * lamp by a barrel). Mostly no-flame kinds, so flames stay special; same kinds keep SAME_KIND_GAP.
 */
function fillLight(m: MapDef, lots: Lot[], props: Prop[], hit: (x: number, z: number, r: number) => boolean, rng: Rng): void {
  const lit: Array<[number, number]> = props.filter((p) => LIGHT_PROPS.has(p.kind)).map((p) => [p.x, p.z]);
  for (const l of m.landmarks) if (l.hx > 0) lit.push([l.x, l.z]);
  const dark = (x: number, z: number): boolean => !lit.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < lightCover(x, z));
  const kinds: Array<Prop['kind']> = ['workLamp', 'workLamp', 'candles', 'candles', 'fireBarrel', 'fireBarrel', 'campfire'];
  const inFight = (x: number, z: number): boolean => m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r * 0.6);
  const shuffled = <T>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
    }
    return xs;
  };
  const add = (kind: Prop['kind'], x: number, z: number, size: number): void => {
    props.push({ kind, x, z, rot: rng.range(0, Math.PI * 2), size });
    lit.push([x, z]);
  };
  for (const s of m.streets) {
    if (s.kind === 'path') continue;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      for (let t = rng.range(0.5, 3); t < len; t += rng.range(2, 4.5)) {
        const cx = ax + ux * t;
        const cz = az + uz * t;
        if (!dark(cx, cz) || onBridge(m, cx, cz, 1) || isWater(m, cx, cz)) continue;
        const order = shuffled([...kinds]);
        const spot = (dt: number, side: number, extra: number): [number, number] => {
          const off = side * (s.width / 2 + extra);
          return [ax + ux * (t + dt) - uz * off, az + uz * (t + dt) + ux * off];
        };
        const tries: Array<[number, number, number]> = [];
        for (let k = 0; k < 14; k++) tries.push([rng.range(-6, 6), rng.pick([-1, 1]), rng.range(0.9, 4.2)]);
        let placed: [number, number] | null = null;
        let kind: Prop['kind'] = 'candles';
        for (const [dt, side, extra] of tries) {
          const [x, z] = spot(dt, side, extra);
          if (onBridge(m, x, z, 1) || streetDist(m, x, z).d < 0.3 || inFight(x, z)) continue;
          // The first kind that fits here and has no twin nearby.
          const k = order.find((c) => !hit(x, z, c === 'campfire' ? 1 : 0.6) && !sameKindClash(props, c, x, z));
          if (!k) continue;
          kind = k;
          add(kind, x, z, rng.range(0.6, 1.4));
          placed = [x, z];
          break;
        }
        if (placed) {
          // Sometimes a small cluster: people gather where there is light.
          if (rng.next() < 0.4) {
            const extraKinds: Array<Prop['kind']> = kind === 'workLamp' ? ['fireBarrel', 'candles'] : ['candles', 'candles', 'fireBarrel'];
            for (let n = 1 + rng.int(2); n > 0; n--) {
              const a = rng.range(0, Math.PI * 2);
              const d = rng.range(1.6, 3.6);
              const x = placed[0] + Math.sin(a) * d;
              const z = placed[1] + Math.cos(a) * d;
              const k = rng.pick(extraKinds);
              if (sameKindClash(props, k, x, z)) continue;
              if (streetDist(m, x, z).d < 0.3 || isWater(m, x, z) || inFight(x, z) || (k !== 'candles' && hit(x, z, 0.5))) continue;
              if (lots.some((l) => l.kind !== 'tree' && inLot(l, x, z, 0.3)) || props.some((p) => Math.hypot(x - p.x, z - p.z) < 0.9)) continue;
              add(k, x, z, rng.range(0.5, 0.9));
            }
          }
          continue;
        }
        // Built-up stretch: grave candles at the curb. They do not block, so they only need to stay
        // off building footprints, water and other props.
        for (const dt of shuffled([0, 1.5, -1.5, 3, -3, 4.5, -4.5])) {
          const [x, z] = spot(dt, rng.pick([-1, 1]), rng.range(0.5, 0.8));
          if (isWater(m, x, z) || onBridge(m, x, z, 1) || streetDist(m, x, z).d < 0.2 || inFight(x, z)) continue;
          if (lots.some((l) => l.kind !== 'tree' && inLot(l, x, z, 0.3)) || props.some((p) => Math.hypot(x - p.x, z - p.z) < 0.9)) continue;
          // Candles keep their gap; a barrel can stand anywhere.
          add(sameKindClash(props, 'candles', x, z) ? 'fireBarrel' : 'candles', x, z, rng.range(0.6, 1.1));
          break;
        }
      }
    }
  }
}

/** The sim side of a map. */
export function mapLevel(m: MapDef, lots: Lot[], props: Prop[] = generateProps(m, lots)): Level {
  const colliders: Collider[] = [];
  const propColliders = new Map<Prop, Collider>();
  for (const p of props) {
    const c = propCollider(p);
    if (c) {
      colliders.push(c);
      propColliders.set(p, c);
    }
  }
  for (const l of m.landmarks) {
    if (l.kind === 'spati') colliders.push(...spatiColliders(l));
    else if (l.hx > 0) colliders.push(landmarkCollider(l));
  }
  for (const l of lots) colliders.push(...lotColliders(l));
  if (m.rail) {
    const r = m.rail;
    const left = (r.gapX - r.gapW / 2 + r.minX) / 2;
    const right = (r.gapX + r.gapW / 2 + r.maxX) / 2;
    colliders.push({ kind: 'box', x: left, z: r.z, hx: (r.gapX - r.gapW / 2 - r.minX) / 2, hz: 4, rot: 0 });
    colliders.push({ kind: 'box', x: right, z: r.z, hx: (r.maxX - r.gapX - r.gapW / 2) / 2, hz: 4, rot: 0 });
  }
  const rests = m.landmarks.filter((l) => l.kind === 'spati').map(spatiRest);
  const breakables = breakableDefs(m, props, propColliders, rests);
  const ground = new WalkGrid(m.bounds, 0.5, (x, z) => (isWater(m, x, z) && !onBridge(m, x, z)) || terraceWall(m, x, z) || !inTunnel(m, x, z, 0.3));
  const level = new Level(m.id, m.bounds, m.start, colliders, ground, [], m.bounds, m.encounters, m.zones, m.bridges.filter((b) => b.kind === 'ferry'), rests, breakables);
  level.district = m.district ?? 0;
  if (m.flavor) level.flavor = m.flavor;
  level.hiddenSpots = m.hiddenSpots ?? [];
  level.guards = m.guards ?? [];
  return level;
}

/**
 * Every crate and bin is breakable (playtest 2026-11-17: two crates that look the same must behave
 * the same). Colliders are shared with the level's own list.
 */
function breakableDefs(m: MapDef, props: Prop[], propColliders: Map<Prop, Collider>, rests: RestArea[]): BreakableDef[] {
  const defs: BreakableDef[] = [];
  if (m.encounters.length === 0) return defs;
  props.forEach((p, prop) => {
    if (p.kind !== 'crates' && p.kind !== 'crate' && p.kind !== 'bins') return;
    const collider = propColliders.get(p);
    if (collider) defs.push({ kind: p.kind === 'bins' ? 'bin' : 'crate', x: p.x, z: p.z, prop, inside: restAt(rests, p.x, p.z) >= 0, collider });
  });
  return defs;
}

/**
 * M19 tunnel dressing: work lamps on alternating walls every 13 to 17 m, a fire barrel in stations and
 * at side passage ends, crates and rubble along the bed. Fixed props (the wreck, the generator) on top.
 */
function tunnelProps(m: MapDef): Prop[] {
  const rng = new Rng(m.seed + 7);
  const props: Prop[] = [...m.fixedProps];
  const free = (x: number, z: number, r: number): boolean => inTunnel(m, x, z, r) && !props.some((p) => Math.hypot(p.x - x, p.z - z) < r + 1.5)
    && !m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r * 0.5);
  for (const t of m.tunnel!.tubes) {
    let side = 1, acc = 0;
    for (let i = 1; i < t.pts.length; i++) {
      const [ax, az] = t.pts[i - 1]!, [bx, bz] = t.pts[i]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (let d = 0; d < len; d += 1) {
        acc += 1;
        const gap = t.kind === 'branch' ? 9 : 15;
        if (acc < gap) continue;
        acc = rng.range(-2, 2);
        const off = t.width / 2 - 0.8, x = ax + ux * d - uz * off * side, z = az + uz * d + ux * off * side;
        side = -side;
        if (free(x, z, 0.3)) props.push({ kind: rng.next() < 0.75 ? 'workLamp' : 'candles', x, z, rot: Math.atan2(uz * side, -ux * side), size: 1 });
        const cx = ax + ux * (d + 5) + uz * off * 0.6 * side, cz = az + uz * (d + 5) - ux * off * 0.6 * side;
        if (rng.next() < 0.55 && free(cx, cz, 0.8)) props.push({ kind: rng.pick(['crates', 'crate', 'rubble', 'planks', 'bins'] as const), x: cx, z: cz, rot: rng.range(0, Math.PI * 2), size: rng.range(0.8, 1.3) });
      }
    }
    const end = t.pts[t.pts.length - 1]!;
    if (t.kind !== 'track' && free(end[0], end[1], 0.6)) props.push({ kind: 'fireBarrel', x: end[0], z: end[1], rot: 0, size: 1 });
  }
  return props;
}
