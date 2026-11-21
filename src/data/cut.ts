// V1 B cutaway (docs/tasks/v1-visibility.md): flagged buildings and landmarks are cut off hard above a
// height while the hero stands in one of their trigger zones. This file only plans (zones and parts);
// the render side clips the merged geometry (`src/render/batch.ts`, `src/render/cutaway.ts`).
import { inPoly, type Lot, type MapDef, type Pt } from './map';

/** Single source for the camera pitch (degrees); `src/render/camera.ts` reads it. */
export const VIEW = { pitch: 44 } as const;
/**
 * `floor` = ground floor height (GROUND_H, pinned by the test); `yard` is lower on purpose: a 4.3 m stub
 * still hides 4.45 m of a 4.5 m deep first yard. `reach` = how far north a landmark zone and a hiding
 * building reach; `pad` widens landmark footprints; `leave` = hysteresis at the zone edge; `minHidden` =
 * yard samples a building must hide before it is flagged; `graze` = footprint margin a sight line must pass.
 */
export const CUT = { floor: 4.3, yard: 1.2, reach: 20, pad: 2, leave: 0.75, minHidden: 3, graze: 0.5 } as const;
/** Storey heights of the lot builders (`src/render/world.ts`, `map-world.ts`; pinned by the test). */
export const STOREY = { ground: 4.3, floor: 3.5, parapet: 0.7, house: 3.4, houseFloor: 2.9 } as const;
/** Landmark part ids start here (lot parts are lot indices). */
export const LANDMARK_PART = 1_000_000;

export interface CutZone { name: string; poly: Pt[]; h: number; parts: number[] }
/** `index` into `lots` or `m.landmarks`; `h` = lowest cut height of its zones (above the object's base). */
export interface CutPart { id: number; kind: 'lot' | 'landmark'; index: number; h: number }
export interface CutPlan { zones: CutZone[]; parts: CutPart[] }

/** A rotated rectangle in the lot frame (a along (cos rot, -sin rot), b along (sin rot, cos rot)). */
export interface Rect { x: number; z: number; rot: number; hw: number; hd: number }

const DEG = Math.PI / 180;

/** Corners of a rectangle, counter-clockwise seen from above. */
export function rectPoly(r: Rect): Pt[] {
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  const P = (a: number, b: number): Pt => [r.x + c * a + s * b, r.z - s * a + c * b];
  return [P(-r.hw, -r.hd), P(-r.hw, r.hd), P(r.hw, r.hd), P(r.hw, -r.hd)];
}

/** Main body and wing of a building lot with their nominal heights (as the builders make them). */
export function lotBodies(l: Lot): Array<{ rect: Rect; h: number }> {
  const height = (floors: number, w: number, d: number): number =>
    l.kind === 'house' ? STOREY.house + floors * STOREY.houseFloor + (l.ruin ? 0 : Math.min(w, d) * 0.42) : STOREY.ground + floors * STOREY.floor + STOREY.parapet;
  const out = [{ rect: { x: l.x, z: l.z, rot: l.rot, hw: l.w / 2, hd: l.d / 2 }, h: height(l.floors, l.w, l.d) }];
  if (l.wing) out.push({ rect: { x: l.wing.x, z: l.wing.z, rot: l.rot, hw: l.wing.w / 2, hd: l.wing.d / 2 }, h: height(Math.max(0, l.floors - 1), l.wing.w, l.wing.d) });
  return out;
}

function inRect(r: Rect, x: number, z: number): boolean {
  const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot), s = Math.sin(r.rot);
  return Math.abs(dx * c - dz * s) <= r.hw && Math.abs(dx * s + dz * c) <= r.hd;
}

/** Where the segment (x, z0)–(x, z1) enters the rectangle (0..1), or Infinity (Liang–Barsky in its frame). */
function segmentEntry(r: Rect, x: number, z0: number, z1: number): number {
  const c = Math.cos(r.rot), s = Math.sin(r.rot), dx = x - r.x;
  const a0 = dx * c - (z0 - r.z) * s, b0 = dx * s + (z0 - r.z) * c;
  const da = -(z1 - z0) * s, db = (z1 - z0) * c;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-da, a0 + r.hw], [da, r.hw - a0], [-db, b0 + r.hd], [db, r.hd - b0]] as const) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return Infinity; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

/**
 * How far in front of ground point (x, z) the part above the cut `h` of a body of height `H` starts to
 * hide it, or Infinity. The sight line to the camera runs toward +z and rises tan(pitch) per meter, so
 * only footprint between h / tan and min(H / tan, reach) in front of the point matters.
 */
export function hideDist(x: number, z: number, body: Rect, H: number, h: number): number {
  const t = Math.tan(VIEW.pitch * DEG), d0 = h / t, d1 = Math.min(H / t, CUT.reach);
  // Sight lines that only graze a corner do not count (rotated lots, ground right beside a wall).
  const core = { ...body, hw: Math.max(0.1, body.hw - CUT.graze), hd: Math.max(0.1, body.hd - CUT.graze) };
  return d1 > d0 ? d0 + segmentEntry(core, x, z + d0, z + d1) * (d1 - d0) : Infinity;
}

export function hides(x: number, z: number, body: Rect, H: number, h: number): boolean {
  return hideDist(x, z, body, H, h) < Infinity;
}

/** Convex hull, counter-clockwise (monotone chain). */
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** Trigger zones and the parts they cut. Reads `lots` and the map only. */
export function cutPlan(m: MapDef, lots: readonly Lot[], opts: { off?: boolean; yard?: number } = {}): CutPlan {
  const zones: CutZone[] = [];
  const parts = new Map<number, CutPart>();
  if (opts.off) return { zones, parts: [] };
  const flag = (zone: CutZone, id: number, kind: CutPart['kind'], index: number): void => {
    const p = parts.get(id);
    if (p) p.h = Math.min(p.h, zone.h);
    else parts.set(id, { id, kind, index, h: zone.h });
    zone.parts.push(id);
  };
  // Landmarks: footprint widened by `pad`, swept north (away from the camera) by `reach`.
  m.landmarks.forEach((l, i) => {
    if (!l.cut) return;
    const foot = rectPoly({ x: l.x, z: l.z, rot: l.rot, hw: l.hx + CUT.pad, hd: l.hz + CUT.pad });
    const reach = l.cut.reach ?? CUT.reach;
    const zone: CutZone = { name: l.name ?? l.kind, poly: hull([...foot, ...foot.map(([x, z]): Pt => [x, z - reach])]), h: l.cut.h ?? CUT.floor, parts: [] };
    flag(zone, LANDMARK_PART + i, 'landmark', i);
    zones.push(zone);
  });
  // Hinterhöfe (and the Mitte Clubhof): buildings (any lot, also neighbours) whose upper part is the first to hide enough walkable yard.
  const yard = opts.yard ?? CUT.yard;
  const buildings = lots.flatMap((l, i) => (l.kind === 'tree' || l.kind === 'special' ? [] : [{ i, bodies: lotBodies(l) }]));
  lots.forEach((l, zi) => {
    if (l.special !== 'hinterhof' && l.special !== 'clubhof' && l.special !== 'jazzhof' && l.special !== 'passage') return;
    const rect: Rect = { x: l.x, z: l.z, rot: l.rot, hw: l.w / 2, hd: l.d / 2 };
    const zone: CutZone = { name: `hinterhof ${zi}`, poly: rectPoly(rect), h: yard, parts: [] };
    const radius = Math.hypot(rect.hw, rect.hd) + CUT.reach;
    const near = buildings.filter((b) => b.bodies.some(({ rect: r }) => Math.hypot(r.x - l.x, r.z - l.z) < radius + Math.hypot(r.hw, r.hd)));
    const c = Math.cos(l.rot), s = Math.sin(l.rot), samples: Pt[] = [];
    for (let a = -rect.hw + 0.5; a < rect.hw; a += 1) for (let b = -rect.hd + 0.5; b < rect.hd; b += 1) {
      const x = l.x + c * a + s * b, z = l.z - s * a + c * b;
      if (!near.some((n) => n.bodies.some(({ rect: r }) => inRect(r, x, z)))) samples.push([x, z]);
    }
    // Each hidden sample counts for the nearest building in front of it: a side wing behind the
    // Quergebäude (seen from the second yard) keeps framing the first yard.
    const hidden = new Map<number, number>();
    for (const [x, z] of samples) {
      let best = Infinity, by = -1;
      for (const n of near) for (const body of n.bodies) {
        if (body.h <= yard + 0.5) continue;
        const d = hideDist(x, z, body.rect, body.h, yard);
        if (d < best) { best = d; by = n.i; }
      }
      if (by >= 0) hidden.set(by, (hidden.get(by) ?? 0) + 1);
    }
    for (const n of near) if ((hidden.get(n.i) ?? 0) >= CUT.minHidden) flag(zone, n.i, 'lot', n.i);
    zones.push(zone);
  });
  return { zones, parts: [...parts.values()] };
}

/** Distance from (x, z) to the polygon outline. */
function edgeDist(poly: readonly Pt[], x: number, z: number): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]!, b = poly[i]!, ex = b[0] - a[0], ez = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1)));
    d = Math.min(d, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t));
  }
  return d;
}

/** Inside the zone: on. Once on, it stays on until the hero is more than `leave` outside (no flicker). */
export function cutActive(zone: CutZone, x: number, z: number, was: boolean): boolean {
  if (inPoly(zone.poly, x, z)) return true;
  return was && edgeDist(zone.poly, x, z) <= CUT.leave;
}
