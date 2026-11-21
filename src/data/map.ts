// Expedition map format (M10/M11). A map is authored as anchors in meters (`koepenick.ts`); a
// scale factor stretches distances while buildings, streets and characters keep their size, so the
// whole map can grow if it plays too small. Lots (ordinary buildings, trees) are generated along
// streets and inside zones from a seed, so a bigger map simply gets more of them.
// One source for sim (colliders, walkability, encounters) and renderer (meshes).
import type { Collider } from '../sim/collide';
import type { Bounds } from '../sim/flowfield';
import { Level, WalkGrid, type BarrierDef, type EncounterDef, type Point, type ZoneDef } from '../sim/level';
import { Rng } from '../sim/math';
import type { BreakableDef } from '../sim/breakables';
import { restAt, type RestArea } from '../sim/rest';
import { onFerryPier } from '../sim/ferry';
import { snapReachable } from '../sim/reach';
import { EDGE_FRONT, propCollider, type Prop } from './courtyard';
import { lotContent, SPECIAL_SHARE, SPECIAL_SIZE, type LotContent, type Pier, type SpecialKind } from './lots';
import { spatiColliders, spatiProps, spatiRest } from './spati';
import { onCampFloor, type CampLayout } from './camp-map';

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
  /**
   * M15 Berliner Blockrand (Johannes 2026-11-18, variant A of `docs/mockups/m15-altbau-visibility.svg`):
   * closed rows of 5-storey Altbau wall to wall, but only where they do not stand between the camera and
   * the street (the north side of east–west streets, both sides of north–south ones). The camera side
   * gets shops and ruins. Tall rows open in Baulücken (a Trümmerfeld between two fire walls).
   */
  block?: boolean;
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
  /** M11c: lot types that replace about two in five street lots here (`src/data/lots.ts`). */
  specials?: SpecialKind[];
}

export type LandmarkKind = 'sbahnhof' | 'forum' | 'rathaus' | 'schloss' | 'mueggelturm' | 'riesenrad' | 'dino' | 'kirche' | 'spati'
  // M15 Xhain (1981): stations, the Oberbaumbrücke towers, a GDR watchtower, squats and churches.
  | 'warschauer' | 'ostbahnhof' | 'oberbaum' | 'wachturm' | 'thomaskirche' | 'bethanien' | 'rauchhaus' | 'nkz' | 'u1station' | 'goerlitzer'
  // M15 Alexanderplatz (1989): Museumsinsel, forum, Nikolaiviertel, the Alex and the Karl-Marx-Allee.
  | 'altesmuseum' | 'dom' | 'palast' | 'fernsehturm' | 'marienkirche' | 'neptunbrunnen' | 'rotesrathaus' | 'nikolaikirche'
  | 'weltzeituhr' | 'brunnen' | 'hotelstadtberlin' | 'sbahnalex' | 'sbahnhackescher' | 'hausdeslehrers' | 'kongresshalle' | 'kino' | 'cafemoskau'
  // M15 Mitte (2089): Friedrichstadt, Regierungsviertel, Tiergarten, Kulturforum and the Potsdamer Platz.
  | 'ubahn' | 'tor' | 'mauerstuecke' | 'lafayette' | 'reichstag' | 'bundesbau' | 'kanzleramt' | 'siegessaeule' | 'sony' | 'stage' | 'bahntower' | 'kollhoff'
  | 'verkehrsturm' | 'klinik' | 'philharmonie' | 'matthaeus' | 'stabi' | 'nng' | 'checkpoint' | 'pariser' | 'glasbau'
  // M16 Charlottenburg (1920): City West around the Zoo and the Gedächtniskirche, the Ku'damm, the Schloss and its garden.
  | 'zoobahnhof' | 'loewentor' | 'elefantentor' | 'aquarium' | 'musikpavillon' | 'antilopenhaus' | 'ufapalast' | 'capitol' | 'gedaechtniskirche'
  | 'romanischescafe' | 'gloriapalast' | 'marmorhaus' | 'kadewe' | 'wittenbergplatz' | 'cafewestens' | 'revuepalast' | 'theaterwestens' | 'variete'
  | 'opernhaus' | 'schillertheater' | 'hochschule' | 'chtor' | 'stuelerbau' | 'ehrenhoftor' | 'schlossmitte' | 'schlossfluegel' | 'neuerfluegel'
  | 'orangerie' | 'gartentor' | 'mausoleum' | 'belvedere' | 'chrathaus';

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
  /** Elevated (a station on the viaduct): keeps lots away but has no collider at street level. */
  walkUnder?: boolean;
  /** Shown when the hero enters (Späti rest stops). */
  name?: string;
  /** V1 B cutaway (`src/data/cut.ts`): cut off above `h` while the hero is behind it (north, within `reach`). */
  cut?: { h?: number; reach?: number };
  /** Which figure of a kind (the three Spreepark dinosaurs). */
  variant?: number;
}

export interface Lot {
  /** `special`: an M11c lot type, a walkable place whose buildings, props and guards are in `content`. */
  kind: LotKind | 'tree' | 'special';
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
  /** M15: part of a closed Blockrand row (side walls are windowless fire walls). */
  block?: boolean;
  /** M11d: non-rectangular footprint (chamfer, bays, setbacks, open courtyard); always inside w × d. */
  shape?: LotShape;
  special?: SpecialKind;
  content?: LotContent;
}

/**
 * M11d footprint of a street lot in its own frame (a along the front from left to right, b toward
 * the street). Everything is cut out of the w × d rectangle, so occupancy and spacing stay as they were.
 */
export interface LotShape {
  /** Front pieces from left to right: up to local a = `to` the front stands `back` meters behind the lot front. The last piece ends at w / 2. */
  front: Array<{ to: number; back: number }>;
  /** Chamfered street corner at the left (-1) or right (+1) end of the front, legs `c` meters long. */
  chamfer?: { side: -1 | 1; c: number };
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
  /** Ground height its stairs start from (a terrace on a terrace, M20 camp); 0 when left out. */
  base?: number;
  /** M15: a street bridge over a track field (render: deck on piers with railings, the ground stays below). */
  bridge?: boolean;
  /** M16: a station platform on the brick Stadtbahn (Bahnhof Zoo); drawn by `charlottenburg-world.ts`, not as a concrete bridge. */
  platform?: boolean;
  /** M16: what stands on the deck and blocks (the arrived train): boxes in world space, collider frame as `Collider`. */
  solid?: Array<{ x: number; z: number; hx: number; hz: number; rot: number }>;
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
  /** Enemy strength step (`districtScale`) when it differs from `district`: a tunnel takes its line (S3 0, U8 1, U2 2). */
  strength?: number;
  /** M16 `revue` (Charlottenburg): render only for now, the Zeitlose wear 1920s dress; no loot table yet. */
  flavor?: 'neon' | 'gdr' | 'revue';
  /** M12c rain rule (2D `D.wet`): fire burns shorter, shock chains reach further and jump once more. */
  wet?: boolean;
  /** M16 district rule „Glas splittert“: glass bodies burst when they die (`THREAT.shards`). */
  shards?: boolean;
  /** M19 U-Bahn tunnel: only these tubes are walkable, everything else is rock (no lots, no streets). M20: line, gratings, collapse, flood, trader, generator, signs. */
  tunnel?: TunnelDef;
  /** M20 walkable camp: floor polygons, walls, stations and rings (`src/data/camp-map.ts`). */
  camp?: CampLayout;
  /** M16b/M19 side passage surprises: fixed hidden blessings and sleeping guards (a mini-boss). */
  hiddenSpots?: Point[];
  guards?: Level['guards'];
  /** M11c pond jetties: walkable over water. */
  piers?: Pier[];
  /** M11c lot types placed by hand where the generator finds no room (Altstadt market, churchyard). */
  specialLots?: Array<{ special: SpecialKind; x: number; z: number; rot: number; w: number; d: number }>;
  /** M15: per-map caps for lot types (Kreuzberg is a district of back yards). */
  specialMax?: Partial<Record<SpecialKind, number>>;
  /** M15: the Berlin Wall (1981) as polylines; each piece blocks. Gaps are separate polylines. */
  walls?: Wall[];
  /** M15: ground-level track fields (fenced, blocked; terraces may bridge them). */
  railYards?: RailYard[];
  /** M15: elevated railways. The brick Stadtbahn blocks along its length; the U1 Hochbahn only at its pillars. */
  viaducts?: Viaduct[];
  /**
   * M15 Mitte: stricter lot placement. Lots keep out of the turned footprint of a landmark too (not only
   * its axis-aligned box) and off the whole width of side paths (not only at their corners). Off for
   * Köpenick and Xhain until their playtests are done: switching it on regenerates all their lots.
   */
  strictLots?: boolean;
  /** M16: ground where no enemy, event or drop is ever placed (the platform start of Charlottenburg). */
  noSpawn?: Pt[][];
  /** M11d step 5: hand-placed buildings on the route; they take their space before the generator fills the rest. */
  handLots?: Array<Omit<Lot, 'seed' | 'kind'> & { kind: LotKind; seed?: number }>;
}

/** A fenced track field at ground level: `tracks` parallel tracks across `width`. */
export interface RailYard { name: string; pts: Pt[]; width: number; tracks: number }
/** Inside a track field (`pad` widens it). */
export function inRailYard(m: MapDef, x: number, z: number, pad = 0): boolean {
  return (m.railYards ?? []).some((r) => lineDist(r.pts, x, z) < r.width / 2 + pad);
}

/**
 * A run of Berlin Wall elements (3.6 m concrete with the pipe on top), 0.6 m thick. M16 Charlottenburg:
 * `kind` makes it a garden hedge (the maze) or an iron fence (Zoo, garden gate) with its own height and
 * thickness; without `kind` it is the Wall, so the older maps stay as they are.
 */
export interface Wall { name: string; pts: Pt[]; kind?: 'hedge' | 'fence' }
export const WALL = { height: 3.6, thick: 0.6 } as const;
/** M16: hedges 2.2 m (the camera sees over them), iron fences 2 m. */
export const WALL_KIND = { hedge: { height: 2.2, thick: 1 }, fence: { height: 2, thick: 0.4 } } as const;
/** Half thickness of a wall run (its collider half width). */
export const wallHalf = (w: Wall): number => (w.kind ? WALL_KIND[w.kind].thick : WALL.thick) / 2;

export interface Viaduct {
  name: string;
  kind: 'stadtbahn' | 'hochbahn';
  pts: Pt[];
  /** Deck width. */
  width: number;
  /** Deck height above the street. */
  h: number;
}
/** U1 pillar spacing along the deck (pairs, one each side of the median). */
export const HOCHBAHN_PILLAR = { step: 15, r: 0.35, across: 1.6 } as const;

/** Collider centres of the U1 pillars along a viaduct (both sides of the centre line). */
export function hochbahnPillars(v: Viaduct): Pt[] {
  const out: Pt[] = [];
  let acc = HOCHBAHN_PILLAR.step / 2;
  for (let i = 1; i < v.pts.length; i++) {
    const [ax, az] = v.pts[i - 1]!, [bx, bz] = v.pts[i]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    for (; acc < len; acc += HOCHBAHN_PILLAR.step) for (const side of [-1, 1]) out.push([ax + ux * acc - uz * HOCHBAHN_PILLAR.across * side, az + uz * acc + ux * HOCHBAHN_PILLAR.across * side]);
    acc -= len;
  }
  return out;
}

/** Boxes along a polyline (one per segment), for walls and solid viaducts. */
function lineBoxes(pts: readonly Pt[], half: number): Collider[] {
  const out: Collider[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!, len = Math.hypot(bx - ax, bz - az);
    out.push({ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: half, hz: len / 2, rot: Math.atan2(bx - ax, bz - az) });
  }
  return out;
}

/** Wall and solid viaduct colliders of a map. */
export function barrierColliders(m: MapDef): Collider[] {
  return [
    ...(m.walls ?? []).flatMap((w) => lineBoxes(w.pts, wallHalf(w))),
    ...(m.viaducts ?? []).flatMap((v) => (v.kind === 'stadtbahn' ? lineBoxes(v.pts, v.width / 2) : hochbahnPillars(v).map(([x, z]): Collider => ({ kind: 'circle', x, z, r: HOCHBAHN_PILLAR.r })))),
  ];
}

/** Distance to the nearest wall or solid viaduct edge (Infinity without any). */
export function barrierDist(m: MapDef, x: number, z: number): number {
  let d = Infinity;
  for (const w of m.walls ?? []) d = Math.min(d, lineDist(w.pts, x, z) - wallHalf(w));
  for (const v of m.viaducts ?? []) if (v.kind === 'stadtbahn') d = Math.min(d, lineDist(v.pts, x, z) - v.width / 2);
  return d;
}

/** A walkable tunnel piece along a polyline: track bed, station hall, side passage or the M20 maintenance bypass. */
export interface Tube { pts: Pt[]; width: number; kind: 'track' | 'station' | 'branch' | 'bypass' }

/** M20 tunnel grating across the track bed (2D `addGate`): closed until encounter `after` is won. */
export interface TunnelGate { x: number; z: number; rot: number; half: number; after: number }

/** M20 U-Bahn tunnel of one line (`src/data/tunnel.ts`). */
export interface TunnelDef {
  tubes: Tube[];
  /** Index into `LINES` (0 = S3). */
  line: number;
  /** Line color (stripe in the station tiles). */
  color: string;
  gates: TunnelGate[];
  /** Collapse (2D RUBX): rubble closes the track bed within `width / 2` of this line; a 'bypass' tube leads around. */
  rubble: { pts: Pt[]; width: number } | null;
  /** Flooded stretch (2D FLOOD): shallow water over the track bed, speed factor `slow` (flat ends). */
  flood: { pts: Pt[]; width: number; slow: number } | null;
  /** The trader on the start platform (2D `TUN.npc`). */
  trader: Point;
  /** The generator on the end platform (collider, render); the hold ring is the last encounter's `hold`. */
  generator: { x: number; z: number; rot: number };
  /** Blue name plates on the station walls that face the camera. */
  signs: Array<{ x: number; z: number; rot: number; text: string }>;
}
/** Generator body (half sizes). */
export const GENERATOR = { hx: 1.3, hz: 0.8 } as const;

/**
 * Inside one tube, `pad` metres clear of its edge. The ends are flat (butt), where the end walls
 * stand; bends are round (playtest 2026-11-20: the round ends were walkable floor without a wall).
 */
export function inTube(t: Tube, x: number, z: number, pad = 0): boolean {
  const g = tubeGeom(t), r = t.width / 2 - pad;
  if (x < g.box[0] - r || x > g.box[1] + r || z < g.box[2] - r || z > g.box[3] + r) return false;
  // Behind either end plane (a short last segment must not let the bend before it round past the end).
  const { seg } = g, n = seg.length / 5, p0 = t.pts[0]!, q1 = t.pts[t.pts.length - 1]!;
  if ((x - p0[0]) * seg[2]! + (z - p0[1]) * seg[3]! < pad) return false;
  if ((x - q1[0]) * seg[(n - 1) * 5 + 2]! + (z - q1[1]) * seg[(n - 1) * 5 + 3]! > -pad) return false;
  for (let i = 0; i < n; i++) {
    const ax = seg[i * 5]!, az = seg[i * 5 + 1]!, ux = seg[i * 5 + 2]!, uz = seg[i * 5 + 3]!, l = seg[i * 5 + 4]!;
    const c = Math.max(0, Math.min(l, (x - ax) * ux + (z - az) * uz));
    const dx = x - ax - ux * c, dz = z - az - uz * c;
    if (dx * dx + dz * dz <= r * r && r > 0) return true;
  }
  return false;
}
/** Per tube: its segments (start, unit direction, length; zero-length ones dropped) and the bounds of its line. */
const TUBE_GEOM = new WeakMap<Tube, { seg: number[]; box: [number, number, number, number] }>();
function tubeGeom(t: Tube): { seg: number[]; box: [number, number, number, number] } {
  let g = TUBE_GEOM.get(t);
  if (g) return g;
  const seg: number[] = [], box: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < t.pts.length; i++) {
    const [x, z] = t.pts[i]!;
    box[0] = Math.min(box[0], x); box[1] = Math.max(box[1], x); box[2] = Math.min(box[2], z); box[3] = Math.max(box[3], z);
    if (i === 0) continue;
    const [ax, az] = t.pts[i - 1]!, l = Math.hypot(x - ax, z - az);
    if (l >= 1e-6) seg.push(ax, az, (x - ax) / l, (z - az) / l, l);
  }
  TUBE_GEOM.set(t, (g = { seg, box }));
  return g;
}
/** Inside a tunnel tube (always true on open maps). Rubble is inside: use `tunnelWalk` for walking. */
export function inTunnel(m: MapDef, x: number, z: number, pad = 0): boolean {
  return !m.tunnel || m.tunnel.tubes.some((t) => inTube(t, x, z, pad));
}
/** Walkable in a tunnel: inside a tube and not in the collapse (always true on open maps). */
export function tunnelWalk(m: MapDef, x: number, z: number, pad = 0): boolean {
  if (!inTunnel(m, x, z, pad)) return false;
  const r = m.tunnel?.rubble;
  return !r || lineDist(r.pts, x, z) > r.width / 2 + pad;
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

/** M11d: water surface and riverbed below the street level (quays 1.7 m high, Johannes 2026-11-17). */
export const WATER_Y = -1.7;
export const BED_Y = -2.7;
/** Natural banks fall this far over `BANK_RUN` meters toward the water. */
const BANK_DROP = 1.1;
const BANK_RUN = 4.5;

/**
 * Negative height where a natural (non-quay) bank slopes down to the water; 0 elsewhere. `d` is the
 * distance to the nearest water cell of the relief grid (meters, cell centers), so the bank costs a
 * few array lookups per cell at load instead of dozens of water tests.
 */
function bankSlope(m: MapDef, x: number, z: number, d: number): number {
  const edge = Math.max(0.4, d - RELIEF_CELL / 2);
  if (edge >= BANK_RUN || isQuay(m, x, z)) return 0;
  for (const b of m.bridges) if (Math.hypot(x - b.x, z - b.z) < b.len / 2 + 6) return 0;
  for (const l of m.landmarks) if (Math.hypot(x - l.x, z - l.z) < Math.max(l.hx, l.hz) + l.clear + 2) return 0;
  const f = smooth01((streetDist(m, x, z).d - 2) / 4);
  return -BANK_DROP * f * (1 - edge / BANK_RUN) ** 2;
}

/** `water`: distance to the nearest water cell (relief grid), so relief stays flat near water without water tests. */
function reliefSample(m: MapDef, x: number, z: number, water: number): number {
  if (water <= 5) return 0;
  const amp = RELIEF_AMP[areaAt(m, x, z)?.ground ?? m.defaultGround];
  if (amp === 0) return 0;
  let f = smooth01((streetDist(m, x, z).d - 3) / 10);
  for (const h of m.hills) f = Math.min(f, smooth01((Math.hypot(x - h.x, z - h.z) - h.r - h.slope - 2) / 6));
  for (const t of m.terraces) f = Math.min(f, inPoly(t.poly, x, z) ? 0 : smooth01((polyEdgeDist(t.poly, x, z) - 2) / 6));
  for (const l of m.landmarks) f = Math.min(f, smooth01((Math.hypot(x - l.x, z - l.z) - Math.max(l.hx, l.hz) - l.clear) / 6));
  if (f === 0) return 0;
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
    const wet = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) wet[j * nx + i] = isWater(m, B.minX + i * RELIEF_CELL, B.minZ + j * RELIEF_CELL) ? 1 : 0;
    const reach = Math.ceil(Math.max(BANK_RUN, 6) / RELIEF_CELL);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = B.minX + i * RELIEF_CELL, z = B.minZ + j * RELIEF_CELL;
        let d = Infinity;
        if (!wet[j * nx + i]) {
          for (let b = Math.max(0, j - reach); b <= Math.min(nz - 1, j + reach); b++) {
            for (let a = Math.max(0, i - reach); a <= Math.min(nx - 1, i + reach); a++) if (wet[b * nx + a]) d = Math.min(d, Math.hypot(a - i, b - j) * RELIEF_CELL);
          }
        }
        const bank = d < Infinity ? bankSlope(m, x, z, d) : 0;
        v[j * nx + i] = bank < 0 ? bank : reliefSample(m, x, z, wet[j * nx + i] ? 0 : d);
      }
    }
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
    if (s) { const b = t.base ?? 0; h = Math.max(h, b + (t.h - b) * Math.max(0, Math.min(1, stairLocal(s, x, z).along))); }
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
export const SAME_KIND_GAP: Partial<Record<Prop['kind'], number>> = { campfire: 16, workLamp: 9, candles: 7, stormLantern: 7, beacon: 9, stringLights: 30 };

/** Retaining walls and stair sides block; the stair runs stay open. */
export function terraceWall(m: MapDef, x: number, z: number): boolean {
  for (const t of m.terraces) {
    for (const s of t.stairs) {
      const l = stairLocal(s, x, z);
      if (l.along < -0.05 || l.along > 1.05) continue;
      const side = Math.abs(l.across) - s.width / 2;
      if (side <= 0) return false;
      // Side walls where the stair is more than knee high.
      if (side < 0.45 && l.along * (t.h - (t.base ?? 0)) > 0.5) return true;
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

/**
 * Extra blocking boxes for figures whose low parts reach past the main footprint (Codex review of
 * M11d): the Spreepark dinosaurs' necks, heads and tails. Local frame of the landmark as drawn in
 * `src/render/landmarks.ts` (x along the front, z out of it): center, half extents, turn.
 */
export const DINO_PARTS: ReadonlyArray<ReadonlyArray<{ x: number; z: number; hx: number; hz: number; rot: number }>> = [
  // Sauropod on its back: neck and head toward +z, tail toward -z.
  [{ x: 1.3, z: 5.15, hx: 0.75, hz: 2.7, rot: 0.5 }, { x: 3.1, z: 8.1, hx: 0.6, hz: 0.9, rot: 0.4 }, { x: -1.7, z: -5.3, hx: 0.65, hz: 2.9, rot: Math.atan2(-3.4, -4.6) }],
  // Triceratops on its side: head with frill and horns, legs sideways, short tail.
  [{ x: 0.5, z: 4.6, hx: 1.6, hz: 1.4, rot: 0 }, { x: 1.7, z: 0, hx: 0.8, hz: 1.9, rot: 0 }, { x: -0.6, z: -3.9, hx: 0.5, hz: 1.2, rot: Math.atan2(-1.2, -2.4) }],
  // Broken T-Rex: toppled body, tail, the torn-off head.
  [{ x: 2.2, z: 0.6, hx: 1.3, hz: 2.6, rot: 0 }, { x: 0.9, z: -4, hx: 0.6, hz: 2.1, rot: Math.atan2(-1.4, -4.2) }, { x: -2.2, z: 3, hx: 0.7, hz: 1.1, rot: 0.7 }],
];

/**
 * M15 Mitte: landmarks the hero walks through or into block only with these parts, not with their
 * footprint (local frame as `DINO_PARTS`; the footprint still keeps lots and props away).
 */
export const OPEN_PARTS: Partial<Record<LandmarkKind, ReadonlyArray<{ x: number; z: number; hx: number; hz: number; rot: number }>>> = {
  // Brandenburger Tor: six pillar walls (11 m deep) around five passages (middle 5.65 m, the others
  // 3.8 m, as built), the gate houses at both ends.
  tor: [
    ...[-16.925, -10.525, -4.125, 4.125, 10.525, 16.925].map((x) => ({ x, z: 0, hx: 1.3, hz: 4.5, rot: 0 })),
    { x: -22.5, z: 0, hx: 4, hz: 4.5, rot: 0 }, { x: 22.5, z: 0, hx: 4, hz: 4.5, rot: 0 },
  ],
  // Sony Center: six blocks on a 24 m ring around the forum, open between them (gaps face 30°, 90° … 330°).
  sony: [0, 60, 120, 180, 240, 300].map((d) => ({ x: Math.sin((d * Math.PI) / 180) * 24, z: Math.cos((d * Math.PI) / 180) * 24, hx: 7, hz: 5, rot: (d * Math.PI) / 180 })),
  // M16 Charlottenburg. Zoo gates: two pillars round a 5 m passage (the fences are `MapDef.walls`).
  loewentor: [-3.6, 3.6].map((x) => ({ x, z: 0, hx: 1.1, hz: 1.5, rot: 0 })),
  elefantentor: [-4, 4].map((x) => ({ x, z: 0, hx: 1.4, hz: 1.5, rot: 0 })),
  // Capitol shop row (28 × 10): two front blocks round a 4 m passage, end walls down to the Zoo fence,
  // a 6 m yard behind the row (the side passage with the cache).
  capitol: [{ x: -8, z: 3, hx: 6, hz: 2, rot: 0 }, { x: 8, z: 3, hx: 6, hz: 2, rot: 0 }, { x: -13.5, z: -2.2, hx: 0.5, hz: 3.2, rot: 0 }, { x: 13.5, z: -2.2, hx: 0.5, hz: 3.2, rot: 0 }],
  // KaDeWe (46 × 32), roofless: two doors in the street front (local −13 … −8 and 6 … 11), closed sides and back.
  kadewe: [
    { x: -18, z: -15.5, hx: 5, hz: 0.5, rot: 0 }, { x: -1, z: -15.5, hx: 7, hz: 0.5, rot: 0 }, { x: 17, z: -15.5, hx: 6, hz: 0.5, rot: 0 },
    { x: -22.5, z: 0, hx: 0.5, hz: 16, rot: 0 }, { x: 22.5, z: 0, hx: 0.5, hz: 16, rot: 0 }, { x: 0, z: 15.5, hx: 23, hz: 0.5, rot: 0 },
  ],
  // Orangerie ruin (29 × 24), roofless: a 5.5 m garden door in the north wall (local −2.5 … 3), the south
  // front broken open between stubs (local −8.5 … 8.5) onto the forecourt.
  orangerie: [
    { x: -8.5, z: -11.5, hx: 6, hz: 0.5, rot: 0 }, { x: 8.75, z: -11.5, hx: 5.75, hz: 0.5, rot: 0 },
    { x: -14, z: 0, hx: 0.5, hz: 12, rot: 0 }, { x: 14, z: 0, hx: 0.5, hz: 12, rot: 0 },
    { x: -11.5, z: 11.5, hx: 3, hz: 0.5, rot: 0 }, { x: 11.5, z: 11.5, hx: 3, hz: 0.5, rot: 0 },
  ],
  // Garden gate east of the Neuer Flügel: two pillars round a 5 m passage (the fences are `MapDef.walls`).
  gartentor: [-3.2, 3.2].map((x) => ({ x, z: 0, hx: 0.7, hz: 0.7, rot: 0 })),
  // Charlottenburger Tor: two colonnade halves either side of the 20 m Chaussee.
  chtor: [-13, 13].map((x) => ({ x, z: 0, hx: 2.5, hz: 3, rot: 0 })),
};

/**
 * P25: the five passages of the Brandenburger Tor (local x centre, half width): the gaps between the
 * pillar walls of `OPEN_PARTS.tor`. The Türsteher's neon bars close them in rage (`Level.barriers`).
 */
export const TOR_PASSAGES: ReadonlyArray<readonly [number, number]> = [[-13.725, 1.9], [-7.325, 1.9], [0, 2.825], [7.325, 1.9], [13.725, 1.9]];
/** Bar plane in the Tor frame (local +z, the Pariser Platz side, flush with the pier faces); bar half depth and reach into the piers. */
export const TOR_BAR = { z: 4.2, hz: 0.3, into: 0.6 } as const;

/** Bars across the Tor passages, in world space; their colliders are not in the level until shut. */
export function torBarriers(l: Landmark): BarrierDef[] {
  const c = Math.cos(l.rot), sn = Math.sin(l.rot);
  return TOR_PASSAGES.map(([lx, half]) => {
    const x = l.x + c * lx + sn * TOR_BAR.z, z = l.z - sn * lx + c * TOR_BAR.z;
    return { x, z, rot: l.rot, half, collider: { kind: 'box' as const, x, z, hx: half + TOR_BAR.into, hz: TOR_BAR.hz, rot: l.rot } };
  });
}

/** Every blocking box of a landmark: the footprint plus the parts of figures that reach past it (or only the parts of an open one). */
export function landmarkColliders(l: Landmark): Collider[] {
  const open = OPEN_PARTS[l.kind];
  const out: Collider[] = open ? [] : [landmarkCollider(l)];
  const parts = l.kind === 'dino' ? DINO_PARTS[l.variant ?? 0] ?? [] : open ?? [];
  const c = Math.cos(l.rot), sn = Math.sin(l.rot);
  for (const p of parts) out.push({ kind: 'box', x: l.x + c * p.x + sn * p.z, z: l.z - sn * p.x + c * p.z, hx: p.hx, hz: p.hz, rot: l.rot + p.rot });
  return out;
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
  for (const l of m.landmarks) {
    if (Math.abs(x - l.x) < l.hx + l.clear + pad && Math.abs(z - l.z) < l.hz + l.clear + pad) return true;
    // M15 Mitte: also the turned footprint (the box above ignores `rot`; see `MapDef.strictLots`).
    if (m.strictLots && l.rot % Math.PI !== 0) {
      const dx = x - l.x, dz = z - l.z, c = Math.cos(l.rot), sn = Math.sin(l.rot);
      if (Math.abs(dx * c - dz * sn) < l.hx + l.clear + pad && Math.abs(dx * sn + dz * c) < l.hz + l.clear + pad) return true;
    }
  }
  if (m.rail && Math.abs(z - m.rail.z) < 6 + pad && x > m.rail.minX && x < m.rail.maxX) return true;
  if (barrierDist(m, x, z) < pad + 1 || inRailYard(m, x, z, pad + 1)) return true;
  for (const t of m.terraces) if (polyEdgeDist(t.poly, x, z) < pad + 1 || onStair(t, x, z, pad + 1.5)) return true;
  return x < m.bounds.minX + 2 || x > m.bounds.maxX - 2 || z < m.bounds.minZ + 2 || z > m.bounds.maxZ - 2;
}

const pondsOf = new WeakMap<MapDef, Pt[][]>();

/** M15 Blockrand: tall rows face south or sideways, the camera side stays low (see `Street.block`). */
/** M15 Alexanderplatz Plattenbau rows (Karl-Marx-Allee, Spree bank): slab size, floors and the lanes between slabs. */
export const PLATTE_BLOCK = { w: [22, 32] as [number, number], d: [11, 12.5] as [number, number], floors: [5, 6] as [number, number], gap: [3, 6] as [number, number] } as const;
export const BLOCK = { w: [12, 19] as [number, number], d: [12, 14] as [number, number], tallFloors: 4, gap: 0.12, baulucke: 0.14, ruinTall: 0.3, ruinLow: 0.55 } as const;

/** Is a lot whose front faces the street with outward normal (nx, nz) on the camera side of it? */
export function cameraSide(nz: number): boolean {
  return nz > 0.5;
}

/**
 * One slot of a Blockrand street side: a tall Altbau wall to wall with the previous one, a low shop or
 * ruin on the camera side, or (on tall rows) a Baulücke: a Trümmerfeld between two fire walls. Returns
 * the next position along the street piece.
 */
function blockSlot(m: MapDef, s: Street, rng: Rng, occ: Occupancy, lots: Lot[], area: Area, ax: number, az: number, dx: number, dz: number, side: number, t: number, len: number): number {
  const nx = -dz * side, nz = dx * side, low = cameraSide(nz);
  const front = s.width / 2 + Math.max(1.6, s.sidewalk ?? 0);
  const place = (w: number, d: number): { x: number; z: number; rot: number; ok: boolean } => {
    const x = ax + dx * (t + w / 2) + nx * (front + d / 2), z = az + dz * (t + w / 2) + nz * (front + d / 2), rot = Math.atan2(-nx, -nz);
    return { x, z, rot, ok: t + w < len + 1 && areaAt(m, x, z) === area && streetDist(m, x, z).d > d / 2 - 0.5 && cornersOk(m, x, z, rot, w / 2, d / 2) && occ.free(x, z, rot, w / 2 - 1.05, d / 2 - 0.5) };
    // The occupancy raster is 2 m: neighbours wall to wall share edge cells, so the check is shrunk by a cell's half.
  };
  if (!low && rng.next() < BLOCK.baulucke && lots.some((l) => l.block)) {
    const w = rng.range(11, 14), d = rng.range(13, 15), p = place(w, d);
    if (p.ok) {
      const lot = { kind: 'special' as const, special: 'truemmer' as const, x: p.x, z: p.z, rot: p.rot, w, d, floors: 0, seed: rng.int(1e6) };
      const content = lotContent(lot);
      occ.take(p.x, p.z, p.rot, w / 2 + 0.05, d / 2 + 0.05);
      lots.push({ ...lot, content }, ...content.lots);
      return t + w + BLOCK.gap;
    }
  }
  // M15 Alexanderplatz: in Plattenbau areas the tall side is a row of slabs (wider, with lanes between them),
  // the camera side single-storey pavilions (HO, Konsum) and low slabs.
  const platte = area.frontage === 'platte';
  const w = low ? (platte ? rng.range(10, 16) : rng.range(7, 12)) : platte ? rng.range(PLATTE_BLOCK.w[0], PLATTE_BLOCK.w[1]) : rng.range(BLOCK.w[0], BLOCK.w[1]);
  const d = low ? rng.range(8, 11) : platte ? rng.range(PLATTE_BLOCK.d[0], PLATTE_BLOCK.d[1]) : rng.range(BLOCK.d[0], BLOCK.d[1]);
  const p = place(w, d);
  if (!p.ok) return t + rng.range(1.5, 3);
  const kind: LotKind = low ? (rng.next() < (platte ? 0.75 : 0.6) ? 'shop' : platte ? 'platte' : 'altbau') : platte ? 'platte' : 'altbau';
  // Same draw order as before for Altbau rows (Xhain stays as it was).
  const tall = (): number => (platte ? PLATTE_BLOCK.floors[0] + rng.int(PLATTE_BLOCK.floors[1] - PLATTE_BLOCK.floors[0] + 1) : BLOCK.tallFloors - (rng.next() < 0.2 ? 1 : 0));
  const lot: Lot = { kind, x: p.x, z: p.z, rot: p.rot, w, d, floors: low ? (kind === 'shop' ? 0 : platte ? 1 : rng.int(2)) : tall(), seed: rng.int(1e6), block: true };
  if (rng.next() < (low ? BLOCK.ruinLow : BLOCK.ruinTall)) lot.ruin = true;
  if (!low && !platte && rng.next() < 0.7) {
    // Seitenflügel: a back wing two floors lower, as deep as the yard allows.
    const ww = rng.range(4.5, 6.5), wd = rng.range(7, 11), a = rng.pick([-1, 1]) * (w / 2 - ww / 2), b = -(d / 2 + wd / 2) + 0.05;
    const wx = p.x + Math.cos(p.rot) * a + Math.sin(p.rot) * b, wz = p.z - Math.sin(p.rot) * a + Math.cos(p.rot) * b;
    if (cornersOk(m, wx, wz, p.rot, ww / 2, wd / 2) && areaAt(m, wx, wz) === area && occ.free(wx, wz, p.rot, ww / 2 + 0.3, wd / 2)) {
      occ.take(wx, wz, p.rot, ww / 2 + 0.3, wd / 2 + 0.3);
      lot.wing = { x: wx, z: wz, w: ww, d: wd };
    }
  }
  occ.take(p.x, p.z, p.rot, w / 2 + 0.05, d / 2 + 0.05);
  lots.push(lot);
  return t + w + (platte ? rng.range(PLATTE_BLOCK.gap[0], PLATTE_BLOCK.gap[1]) : BLOCK.gap);
}

/** Generates buildings along streets and trees on free ground. Deterministic per map seed. */
export function generateLots(m: MapDef): Lot[] {
  if (m.tunnel) return [];
  const rng = new Rng(m.seed);
  const occ = new Occupancy();
  const lots: Lot[] = [];
  // M11c: special lots per type (capped) and the last one per street side, so neighbours differ.
  const used = new Map<SpecialKind, number>();
  // A second run on the same map starts from the authored water again (same result every time).
  const prev = pondsOf.get(m);
  if (prev) m.lakes = m.lakes.filter((p) => !prev.includes(p));
  for (const h of m.specialLots ?? []) {
    const lot = { kind: 'special' as const, ...h, floors: 0, seed: rng.int(1e6) }, content = lotContent(lot);
    occ.take(h.x, h.z, h.rot, h.w / 2 + 0.6, h.d / 2 + 0.6);
    lots.push({ ...lot, content }, ...content.lots);
    used.set(h.special, (used.get(h.special) ?? 0) + 1);
  }
  for (const h of m.handLots ?? []) {
    const lot: Lot = { ...h, seed: h.seed ?? Math.round(Math.abs(h.x * 131 + h.z * 71)) };
    occ.take(h.x, h.z, h.rot, h.w / 2 + 0.3, h.d / 2 + 0.3);
    if (h.wing) occ.take(h.wing.x, h.wing.z, h.rot, h.wing.w / 2 + 0.3, h.wing.d / 2 + 0.3);
    lots.push(lot);
  }
  // M15 Mitte (`strictLots`): side paths keep their whole width free, not only where lot corners test them.
  if (m.strictLots) for (const st of m.streets) if (st.kind === 'path') for (let i = 1; i < st.pts.length; i++) {
    const [ax, az] = st.pts[i - 1]!, [bx, bz] = st.pts[i]!, len = Math.hypot(bx - ax, bz - az);
    occ.take((ax + bx) / 2, (az + bz) / 2, Math.atan2(-(bz - az), bx - ax), len / 2 + 1, st.width / 2 + 0.6);
  }
  const ponds: Pt[][] = [], piers: Pier[] = [];

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
        let last: SpecialKind | null = null;
        while (t < len - 4) {
          const cx = ax + dx * t;
          const cz = az + dz * t;
          const area = areaAt(m, cx, cz);
          const kind = area?.frontage;
          // M11c: two in five slots become a lot type of this area (never the same type twice in a row).
          if (area?.specials && rng.next() < SPECIAL_SHARE) {
            const pick = area.specials.filter((k) => k !== last && (used.get(k) ?? 0) < (m.specialMax?.[k] ?? SPECIAL_SIZE[k].max)).sort((p, q) => (used.get(p) ?? 0) - (used.get(q) ?? 0) || rng.next() - 0.5)[0];
            const S = pick && SPECIAL_SIZE[pick];
            // Full size first, then smaller (short street pieces and close side streets); may overhang the piece end.
            const w0 = pick && rng.range(S!.w[0], S!.w[1]), d0 = pick && rng.range(S!.d[0], S!.d[1]);
            for (const k of pick ? (pick === 'hinterhof' || pick === 'clubhof' ? [1, 0.93] : pick === 'markt' || pick === 'kirchhof' ? [1, 0.85, 0.72, 0.62, 0.54] : [1, 0.85, 0.72]) : []) {
              const w = w0! * k, d = d0! * k;
              const nx = -dz * side, nz = dx * side, off = s.width / 2 + Math.max(1.2, s.sidewalk ?? 0) + d / 2;
              const x = cx + dx * (w / 2) + nx * off, z = cz + dz * (w / 2) + nz * off, rot = Math.atan2(-nx, -nz);
              if (t + w * 0.5 < len && areaAt(m, x, z) === area && streetDist(m, x, z).d > d / 2 - 0.5 && cornersOk(m, x, z, rot, w / 2, d / 2) && occ.free(x, z, rot, w / 2 + 0.6, d / 2 + 0.6)) {
                const lot = { kind: 'special' as const, special: pick!, x, z, rot, w, d, floors: 0, seed: rng.int(1e6) };
                const content = lotContent(lot);
                occ.take(x, z, rot, w / 2 + 0.6, d / 2 + 0.6);
                lots.push({ ...lot, content }, ...content.lots);
                if (content.pond) ponds.push(content.pond);
                if (content.pier) piers.push(content.pier);
                used.set(pick!, (used.get(pick!) ?? 0) + 1);
                last = pick!;
                t += w + rng.range(1, 3);
                break;
              }
            }
            if (last === pick && pick) continue;
          }
          if (!kind) {
            t += 6;
            continue;
          }
          if (s.block && (kind === 'altbau' || kind === 'platte')) {
            t = blockSlot(m, s, rng, occ, lots, area!, ax, az, dx, dz, side, t, len);
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
            // M11d: chamfers, risalits, niches, setbacks and open courtyards, cut out of the same rectangle.
            const shape = pickLotShape(kind2, w, d, lot.seed, cornerSide(m, s, lot));
            if (shape) lot.shape = shape;
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

  // M11c ponds are lake water from here on (trees, scatter, walk grid); registered once per map.
  m.lakes.push(...ponds);
  m.piers = piers;
  pondsOf.set(m, ponds);

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
  if (l.kind === 'special') return [];
  if (l.kind === 'tree') return [{ kind: 'circle', x: l.x, z: l.z, r: l.jungle ? 0.55 : 0.4 }];
  const out: Collider[] = lotBoxesLocal(l).map((q) => {
    const [x, z] = lotToWorld(l, q.a, q.b);
    return { kind: 'box', x, z, hx: q.ha, hz: q.hb, rot: l.rot + q.turn };
  });
  if (l.wing) out.push({ kind: 'box', x: l.wing.x, z: l.wing.z, hx: l.wing.w / 2, hz: l.wing.d / 2, rot: l.rot });
  return out;
}

// ---------------------------------------------------------------- footprints (M11d)

/** What the footprint helpers need of a lot (wings and render frames pass plain blocks). */
export interface LotFrame { x: number; z: number; rot: number; w: number; d: number; shape?: LotShape }

/** Lot frame (a along the front, b toward the street) to world. */
export function lotToWorld(l: LotFrame, a: number, b: number): Pt {
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  return [l.x + c * a + s * b, l.z - s * a + c * b];
}

/** Front pieces in the lot frame: from a0 to a1 the front line is at b = f (equal neighbours merged). */
export function lotPieces(l: LotFrame): Array<{ a0: number; a1: number; f: number }> {
  const hw = l.w / 2, hd = l.d / 2;
  const out: Array<{ a0: number; a1: number; f: number }> = [];
  let a0 = -hw;
  (l.shape?.front ?? [{ to: hw, back: 0 }]).forEach((p, i, all) => {
    const a1 = i === all.length - 1 ? hw : p.to, f = hd - p.back, prev = out[out.length - 1];
    if (a1 - a0 < 1e-6) return;
    if (prev && Math.abs(prev.f - f) < 1e-6) prev.a1 = a1;
    else out.push({ a0, a1, f });
    a0 = a1;
  });
  return out;
}

/**
 * Footprint outline in the lot frame: the front from left to right (with steps and the chamfer),
 * then the right side, the back and the left side. Same turning sense as the rectangle facades.
 */
export function lotOutlineLocal(l: LotFrame): Pt[] {
  const hw = l.w / 2, hd = l.d / 2, ps = lotPieces(l), ch = l.shape?.chamfer;
  const first = ps[0] as { f: number }, last = ps[ps.length - 1] as { f: number };
  const out: Pt[] = ch?.side === -1 ? [[-hw, first.f - ch.c], [-hw + ch.c, first.f]] : [[-hw, first.f]];
  ps.forEach((p, i) => {
    const next = ps[i + 1];
    if (next) out.push([p.a1, p.f], [p.a1, next.f]);
  });
  if (ch?.side === 1) out.push([hw - ch.c, last.f], [hw, last.f - ch.c]);
  else out.push([hw, last.f]);
  out.push([hw, -hd], [-hw, -hd]);
  return out;
}

/** Footprint outline in world coordinates (main body, without the back wing). */
export function lotOutline(l: LotFrame): Pt[] {
  return lotOutlineLocal(l).map(([a, b]) => lotToWorld(l, a, b));
}

/**
 * The footprint as boxes in the lot frame (center, half sizes, extra turn): one per front piece,
 * a chamfered end as two boxes plus one turned 45° whose outer face is the chamfer. Together they
 * cover the outline exactly, so the hero meets every wall and no air.
 */
export function lotBoxesLocal(l: LotFrame): Array<{ a: number; b: number; ha: number; hb: number; turn: number }> {
  const hd = l.d / 2, ch = l.shape?.chamfer, ps = lotPieces(l);
  const out: Array<{ a: number; b: number; ha: number; hb: number; turn: number }> = [];
  const box = (a0: number, a1: number, b0: number, b1: number): void => {
    if (a1 - a0 > 1e-6 && b1 - b0 > 1e-6) out.push({ a: (a0 + a1) / 2, b: (b0 + b1) / 2, ha: (a1 - a0) / 2, hb: (b1 - b0) / 2, turn: 0 });
  };
  ps.forEach((p, i) => {
    const end = ch && (ch.side === -1 ? i === 0 : i === ps.length - 1) ? ch : undefined;
    if (!end) return box(p.a0, p.a1, -hd, p.f);
    const c = end.c;
    box(p.a0, p.a1, -hd, p.f - c);
    if (end.side === 1) box(p.a0, p.a1 - c, p.f - c, p.f);
    else box(p.a0 + c, p.a1, p.f - c, p.f);
    out.push({ a: end.side === 1 ? p.a1 - 0.75 * c : p.a0 + 0.75 * c, b: p.f - 0.75 * c, ha: (c * Math.SQRT2) / 2, hb: c / (2 * Math.SQRT2), turn: (end.side * Math.PI) / 4 });
  });
  return out;
}

/**
 * M11d: footprint of a street Altbau or shop, from its own seed (the generator's stream is not
 * touched). Altbau: open courtyard (two wings joined at the back), a central or two corner risalits
 * with the rest set back, a deep door niche, a whole front set back, or plain. Lots at a street
 * corner (`corner` -1 left, +1 right) mostly get the Berlin chamfer.
 */
export function pickLotShape(kind: LotKind, w: number, d: number, seed: number, corner: -1 | 0 | 1): LotShape | undefined {
  if (kind !== 'altbau' && kind !== 'shop') return undefined;
  const rng = new Rng(seed * 7 + 3), hw = w / 2;
  const front: LotShape['front'] = [];
  const roll = kind === 'altbau' ? rng.next() : 1;
  if (roll < 0.18 && w >= 12) {
    // Courtyard open to the street: 3.6 to 5.5 m wide, at least 4 m deep, wings at least 3.7 m.
    const gap = rng.range(3.6, Math.min(5.5, w - 7.4)), mid = rng.range(-1, 1) * Math.max(0, (w - gap) / 2 - 3.7);
    front.push({ to: mid - gap / 2, back: 0 }, { to: mid + gap / 2, back: Math.max(4, d * rng.range(0.42, 0.6)) }, { to: hw, back: 0 });
  } else if (roll < 0.42) {
    const r = rng.range(0.5, 0.85);
    if (rng.next() < 0.6) {
      // Central risalit at the front line, the rest of the front set back.
      const bw = rng.range(3.4, Math.max(3.6, Math.min(5.5, w - 5.4))), mid = rng.range(-0.15, 0.15) * (w - bw);
      front.push({ to: mid - bw / 2, back: r }, { to: mid + bw / 2, back: 0 }, { to: hw, back: r });
    } else {
      // Two corner risalits, the middle set back.
      const ew = rng.range(2.6, Math.min(3.6, w / 3.2));
      front.push({ to: -hw + ew, back: 0 }, { to: hw - ew, back: r }, { to: hw, back: 0 });
    }
  } else if (roll < 0.62) {
    // Deep door niche (recessed entrance).
    const nw = rng.range(2.2, 2.8), at = rng.range(-hw + 2.4, hw - 2.4 - nw);
    front.push({ to: at, back: 0 }, { to: at + nw, back: rng.range(1.2, 1.8) }, { to: hw, back: 0 });
  } else if (roll < 0.74) {
    // The whole front stands back behind a small forecourt.
    front.push({ to: hw, back: rng.range(0.8, 1.6) });
  } else front.push({ to: hw, back: 0 });
  const shape: LotShape = { front };
  if (corner && rng.next() < 0.85) {
    // The chamfer wins at a street corner: a front piece too narrow for it gives way to a plain front.
    const c = kind === 'shop' ? rng.range(1.6, 2.4) : rng.range(2.2, 3.4);
    const p = lotPieces({ x: 0, z: 0, rot: 0, w, d, shape }), end = (corner < 0 ? p[0] : p[p.length - 1]) as { a0: number; a1: number };
    if (end.a1 - end.a0 < c + 1.2) shape.front = [{ to: hw, back: 0 }];
    shape.chamfer = { side: corner, c };
  }
  return shape.chamfer || front.length > 1 || (front[0] as { back: number }).back > 0 ? shape : undefined;
}

/** Which front corner of a street lot (-1 left, +1 right, 0 none) meets another street. */
function cornerSide(m: MapDef, own: Street, l: LotFrame): -1 | 0 | 1 {
  for (const side of [-1, 1] as const) {
    const [x, z] = lotToWorld(l, side * (l.w / 2 + 3), l.d / 2 - 2);
    if (m.streets.some((o) => o !== own && o.kind !== 'path' && lineDist(o.pts, x, z) < o.width / 2 + 3)) return side;
  }
  return 0;
}

/** M11c lot types keep their street front free (gates, Durchfahrten): no wrecks or rubble in front. */
function lotFront(lots: Lot[], x: number, z: number, r: number): boolean {
  return lots.some((l) => {
    if (l.kind !== 'special') return false;
    const dx = x - l.x, dz = z - l.z, a = dx * Math.cos(l.rot) - dz * Math.sin(l.rot), b = dx * Math.sin(l.rot) + dz * Math.cos(l.rot);
    return Math.abs(a) < l.w / 2 + r + 1 && b > -l.d / 2 - r - 1 && b < l.d / 2 + r + 3.5;
  });
}

/**
 * Street lanterns, fire barrels and cover at every encounter, wrecks and rubble on the streets.
 * Deterministic per map seed; nothing lands on a building, in the water or in a fight's center.
 */
export function generateProps(m: MapDef, lots: Lot[]): Prop[] {
  if (m.tunnel) return tunnelProps(m);
  if (m.camp) return [...m.fixedProps];
  const rng = new Rng(m.seed + 7);
  const props: Prop[] = [];
  // Späti sandbags and lantern first, so everything else keeps clear of them.
  for (const l of m.landmarks) if (l.kind === 'spati') props.push(...spatiProps(l));
  const hit = (x: number, z: number, r: number): boolean =>
    isWater(m, x, z) ||
    lots.some((l) => Math.abs(x - l.x) < l.w / 2 + r + 1 && Math.abs(z - l.z) < Math.max(l.w, l.d) / 2 + r + 1 && (l.kind !== 'tree' || Math.hypot(x - l.x, z - l.z) < r + 1)) ||
    (r > 0.6 && lotFront(lots, x, z, r)) ||
    props.some((p) => Math.hypot(x - p.x, z - p.z) < r + 1.2) ||
    m.terraces.some((t) => polyEdgeDist(t.poly, x, z) < r + 1 || onStair(t, x, z, r + 1) !== null) ||
    m.landmarks.some((l) => Math.abs(x - l.x) < l.hx + r && Math.abs(z - l.z) < l.hz + r) ||
    barrierDist(m, x, z) < r + 0.6 || inRailYard(m, x, z, r + 0.4) ||
    edgeDist(m, x, z) < EDGE_CLEAR + r;
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
        if (onBridge(m, x, z, 2) || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + 3) || m.zones.some((zn) => Math.hypot(x - zn.entry.x, z - zn.entry.z) < 6)) continue;
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
        if (isWater(m, x, z) || edgeDist(m, x, z) < EDGE_CLEAR + 2.2 || lotFront(lots, x, z, 2.2) || props.some((p) => Math.hypot(x - p.x, z - p.z) < 3.4) || m.landmarks.some((l) => Math.abs(x - l.x) < l.hx + 2 && Math.abs(z - l.z) < l.hz + 2)) continue;
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
  // No invisible walls (Johannes, 2026-11-15) and closed fronts (M11d step 4, 2026-11-17): where land
  // meets the map edge, building rows, rubble walls, hedges or thickets close it; streets end in a
  // barricade; water edges stay open (`edgeProps`).
  props.push(...edgeProps(m));
  for (const p of m.fixedProps) if (!isWater(m, p.x, p.z) || onBridge(m, p.x, p.z)) props.push(p);
  // M11c lot type props (lights keep their same-kind spacing).
  for (const l of lots) for (const p of l.content?.props ?? []) if (!sameKindClash(props, p.kind, p.x, p.z)) props.push(p);
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
      if (streetDist(m, x, z).d < 0.4 || isWater(m, x, z) || edgeDist(m, x, z) < EDGE_CLEAR + L / 2 || m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r + L / 2)) continue;
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

/** Light sources: working lamps, fires, construction lamps, storm lanterns, beacons, grave candles, string lights. */
export const LIGHT_PROPS: ReadonlySet<Prop['kind']> = new Set<Prop['kind']>(['lantern', 'fireBarrel', 'campfire', 'workLamp', 'stormLantern', 'beacon', 'candles', 'stringLights']);
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
 * with a random strength, and sometimes a small cluster around it (a campfire with storm lanterns, a work
 * lamp by a barrel). Mostly no-flame kinds, so flames stay special; same kinds keep SAME_KIND_GAP.
 */
function fillLight(m: MapDef, lots: Lot[], props: Prop[], hit: (x: number, z: number, r: number) => boolean, rng: Rng): void {
  const lit: Array<[number, number]> = props.filter((p) => LIGHT_PROPS.has(p.kind)).map((p) => [p.x, p.z]);
  for (const l of m.landmarks) if (l.hx > 0) lit.push([l.x, l.z]);
  const dark = (x: number, z: number): boolean => !lit.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < lightCover(x, z));
  // Playtest 2026-11-18: no grave candles on the streets (they read as pickups); storm lanterns and beacons instead.
  const kinds: Array<Prop['kind']> = ['workLamp', 'workLamp', 'stormLantern', 'beacon', 'fireBarrel', 'fireBarrel', 'campfire'];
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
        for (let k = 0; k < 24; k++) tries.push([rng.range(-6, 6), rng.pick([-1, 1]), rng.range(0.9, 4.2)]);
        let placed: [number, number] | null = null;
        let kind: Prop['kind'] = 'stormLantern';
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
            const extraKinds: Array<Prop['kind']> = kind === 'workLamp' ? ['fireBarrel', 'beacon'] : ['stormLantern', 'stormLantern', 'fireBarrel'];
            for (let n = 1 + rng.int(2); n > 0; n--) {
              const a = rng.range(0, Math.PI * 2);
              const d = rng.range(1.6, 3.6);
              const x = placed[0] + Math.sin(a) * d;
              const z = placed[1] + Math.cos(a) * d;
              const k = rng.pick(extraKinds);
              if (sameKindClash(props, k, x, z)) continue;
              if (streetDist(m, x, z).d < 0.3 || isWater(m, x, z) || inFight(x, z) || edgeDist(m, x, z) < EDGE_CLEAR || (k !== 'stormLantern' && hit(x, z, 0.5))) continue;
              if (lots.some((l) => l.kind !== 'tree' && l.kind !== 'special' && inLot(l, x, z, 0.3)) || props.some((p) => Math.hypot(x - p.x, z - p.z) < 0.9)) continue;
              add(k, x, z, rng.range(0.5, 0.9));
            }
          }
          continue;
        }
        // Built-up stretch: a storm lantern on its stake at the curb. The thin stake does not block, so it
        // only needs to stay off building footprints, water and other props.
        for (const dt of shuffled([0, 1.5, -1.5, 3, -3, 4.5, -4.5])) {
          const [x, z] = spot(dt, rng.pick([-1, 1]), rng.range(0.5, 0.8));
          if (isWater(m, x, z) || onBridge(m, x, z, 1) || streetDist(m, x, z).d < 0.2 || inFight(x, z) || edgeDist(m, x, z) < EDGE_CLEAR) continue;
          if (lots.some((l) => l.kind !== 'tree' && l.kind !== 'special' && inLot(l, x, z, 0.3)) || props.some((p) => Math.hypot(x - p.x, z - p.z) < 0.9)) continue;
          // Lanterns keep their gap; a barrel can stand anywhere.
          add(sameKindClash(props, 'stormLantern', x, z) ? 'fireBarrel' : 'stormLantern', x, z, rng.range(0.6, 1.1));
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- closed map edge (M11d step 4)
// Johannes 2026-11-17: the playable area ends at something that looks like the world goes on but is
// closed. Per area: building backs and fire walls (Brandwände) or rubble walls of collapsed houses in
// town, tall garden hedges in the suburbs, a dense thicket with fallen trees in forest and parks,
// overgrowth in the jungle; a barricade where a street runs out; water stays open. Beyond the bound
// a backdrop (taller building masses, tree rows; render only) keeps the camera from showing a void.

/** How land is closed at the map edge. */
export type EdgeStyle = 'town' | 'suburb' | 'wild' | 'jungle';
export type EdgeClass = EdgeStyle | 'street' | 'water' | 'rail';

/** Generated props keep this far from the bound (the edge fronts stand in this band). */
export const EDGE_CLEAR = 3.8;
/** Sample step along the bound when classifying it. */
const EDGE_STEP = 0.5;
/** Front piece length per style (meters along the edge). */
const EDGE_SEG: Record<EdgeStyle, [number, number]> = { town: [6, 10], suburb: [4, 7], wild: [4, 7], jungle: [4, 7] };
const EDGE_KIND: Record<EdgeStyle, Prop['kind']> = { town: 'brandwand', suburb: 'edgeHedge', wild: 'thicket', jungle: 'overgrowth' };

/** One side of the bound, walked clockwise (+Z south): start, direction, inward normal, prop facing. */
export interface EdgeSide { i: number; x0: number; z0: number; dx: number; dz: number; nx: number; nz: number; len: number; rot: number }

/** North, east, south, west. Prop `rot` = side `rot` puts local X along the side and local +Z inward. */
export function edgeSides(m: MapDef): EdgeSide[] {
  const B = m.bounds;
  const corners: Array<[number, number, number, number]> = [[B.minX, B.minZ, B.maxX, B.minZ], [B.maxX, B.minZ, B.maxX, B.maxZ], [B.maxX, B.maxZ, B.minX, B.maxZ], [B.minX, B.maxZ, B.minX, B.minZ]];
  return corners.map(([x0, z0, x1, z1], i) => {
    const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    return { i, x0, z0, dx, dz, nx: -dz, nz: dx, len, rot: Math.atan2(-dz, dx) };
  });
}

/** The point `t` meters along side `s` and `d` meters inside the bound (negative: outside). */
export function sidePt(s: EdgeSide, t: number, d: number): Pt {
  return [s.x0 + s.dx * t + s.nx * d, s.z0 + s.dz * t + s.nz * d];
}

/** Distance from (x, z) to the nearest map bound (negative outside). */
export function edgeDist(m: MapDef, x: number, z: number): number {
  const B = m.bounds;
  return Math.min(x - B.minX, B.maxX - x, z - B.minZ, B.maxZ - z);
}

/** Closure style of the land at (x, z), from its area: town ground or Altbau frontage, house frontage, jungle, else wild. */
export function edgeStyleAt(m: MapDef, x: number, z: number): EdgeStyle {
  const a = areaAt(m, x, z);
  const g = a?.ground ?? m.defaultGround;
  if (g === 'jungle' || a?.jungle) return 'jungle';
  if (g === 'cobbles' || g === 'asphalt' || (a?.frontage != null && a.frontage !== 'house')) return 'town';
  return a?.frontage === 'house' ? 'suburb' : 'wild';
}

export interface EdgeRun { side: EdgeSide; t0: number; t1: number; kind: EdgeClass }

const LAND: ReadonlySet<EdgeClass> = new Set<EdgeClass>(['town', 'suburb', 'wild', 'jungle']);

/**
 * The bound split into runs of one class. Water where the edge strip is wet; the rail embankment
 * closes itself; a street that runs out across the edge (not one along it) gets 1.2 m extra each
 * side; land reaches 1.5 m into the water so every bank is closed; land pieces under 3 m join a
 * neighbour (no flicker where areas meet).
 */
export function edgeRuns(m: MapDef): EdgeRun[] {
  const out: EdgeRun[] = [];
  for (const s of edgeSides(m)) {
    const n = Math.ceil(s.len / EDGE_STEP);
    const lab: EdgeClass[] = [];
    const dir = { x: 0, z: 0 };
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * EDGE_STEP;
      const wet = (d: number): boolean => {
        const [x, z] = sidePt(s, t, d);
        return isWater(m, x, z) && !onBridge(m, x, z);
      };
      const [fx, fz] = sidePt(s, t, 2);
      if (wet(0.3) && wet(2.5)) lab.push('water');
      else if (m.rail && Math.abs(fz - m.rail.z) < 3.5 && fx > m.rail.minX - 1 && fx < m.rail.maxX + 1) lab.push('rail');
      else if (streetDist(m, fx, fz, dir).d < 0.8 && Math.abs(dir.x * s.dx + dir.z * s.dz) < 0.75) lab.push('street');
      else {
        const [ax, az] = sidePt(s, t, 6);
        lab.push(edgeStyleAt(m, ax, az));
      }
    }
    // Street ends 1.2 m wider on both sides.
    const pad = Math.round(1.2 / EDGE_STEP);
    const street = lab.map((c) => c === 'street');
    street.forEach((on, i) => {
      if (!on) return;
      for (let k = Math.max(0, i - pad); k <= Math.min(n - 1, i + pad); k++) if (lab[k] !== 'water') lab[k] = 'street';
    });
    // Land 1.5 m into the water.
    const reach = Math.round(1.5 / EDGE_STEP);
    const base = [...lab];
    for (let i = 0; i < n; i++) {
      if (base[i] !== 'water') continue;
      for (let k = 1; k <= reach; k++) {
        const near = [base[i - k], base[i + k]].find((c) => c !== undefined && LAND.has(c));
        if (near) {
          lab[i] = near;
          break;
        }
      }
    }
    // Runs; short land runs take a land neighbour's style.
    const runs: Array<{ i0: number; i1: number; kind: EdgeClass }> = [];
    for (let i = 0; i < n; i++) {
      const last = runs[runs.length - 1];
      if (last && last.kind === lab[i]) last.i1 = i;
      else runs.push({ i0: i, i1: i, kind: lab[i] as EdgeClass });
    }
    for (let k = 0; k < runs.length; k++) {
      const r = runs[k]!;
      if (!LAND.has(r.kind) || (r.i1 - r.i0 + 1) * EDGE_STEP >= 3) continue;
      const nb = [runs[k - 1], runs[k + 1]].find((o) => o && LAND.has(o.kind));
      if (nb) r.kind = nb.kind;
    }
    const merged: typeof runs = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      if (last && last.kind === r.kind) last.i1 = r.i1;
      else merged.push({ ...r });
    }
    for (const r of merged) out.push({ side: s, t0: r.i0 === 0 ? 0 : r.i0 * EDGE_STEP, t1: r.i1 === n - 1 ? s.len : (r.i1 + 1) * EDGE_STEP, kind: r.kind });
  }
  return out;
}

/**
 * The edge fronts: pieces laid end to end along every land run (their colliders overlap, see
 * `EDGE_FRONT`), a barricade with a construction lamp across every street end, fallen trees in front
 * of thickets now and then. Town pieces on the south bound (between hero and camera) are rubble
 * walls only, so no tall wall hides the hero. Own random stream.
 */
export function edgeProps(m: MapDef, runs: EdgeRun[] = edgeRuns(m)): Prop[] {
  const rng = new Rng(m.seed + 4021);
  const props: Prop[] = [];
  for (const r of runs) {
    const s = r.side;
    const len = r.t1 - r.t0;
    if (r.kind === 'water' || r.kind === 'rail') continue;
    if (r.kind === 'street') {
      const t = (r.t0 + r.t1) / 2;
      const front = EDGE_FRONT.barricade ?? 3;
      const [x, z] = sidePt(s, t, front);
      props.push({ kind: 'barricade', x, z, rot: s.rot, size: len });
      // A construction lamp in front: the street end is lit and reads as closed on purpose.
      const [lx, lz] = sidePt(s, t + rng.pick([-1, 1]) * Math.max(0, len / 2 - 1.5), front + 1.2);
      props.push({ kind: 'workLamp', x: lx, z: lz, rot: s.rot, size: 1 });
      continue;
    }
    const [lo, hi] = EDGE_SEG[r.kind];
    const southBound = s.nz < -0.5;
    for (let t = r.t0; t < r.t1 - 1e-6; ) {
      let l = Math.min(rng.range(lo, hi), r.t1 - t);
      if (r.t1 - t - l < lo) l = r.t1 - t;
      const kind = r.kind === 'town' && (southBound || rng.next() < 0.33) ? 'rubbleWall' : EDGE_KIND[r.kind];
      const [x, z] = sidePt(s, t + l / 2, EDGE_FRONT[kind] ?? 2);
      props.push({ kind, x, z, rot: s.rot, size: l });
      t += l;
    }
    if (r.kind !== 'wild' && r.kind !== 'jungle') continue;
    // Fallen trees lie along the thicket, touching its collider (no gap between).
    const front = EDGE_FRONT[EDGE_KIND[r.kind]] ?? 2.4;
    for (let t = r.t0 + rng.range(6, 20); t < r.t1 - 5; t += rng.range(18, 32)) {
      const l = rng.range(5.5, 8.5);
      if (t - l / 2 < r.t0 + 1 || t + l / 2 > r.t1 - 1) continue;
      const [x, z] = sidePt(s, t, front + 0.45);
      const ends = [sidePt(s, t - l / 2, front + 0.45), sidePt(s, t + l / 2, front + 0.45), [x, z] as Pt];
      if (ends.some(([px, pz]) => isWater(m, px, pz) || streetDist(m, px, pz).d < 3 || m.encounters.some((e) => Math.hypot(px - e.x, pz - e.z) < e.r + 3))) continue;
      if (m.zones.some((zn) => Math.hypot(x - zn.entry.x, z - zn.entry.z) < l) || m.landmarks.some((lm) => Math.abs(x - lm.x) < lm.hx + l / 2 + 1 && Math.abs(z - lm.z) < lm.hz + l / 2 + 1)) continue;
      props.push({ kind: 'fallenTree', x, z, rot: s.rot + rng.range(-0.1, 0.1), size: l });
    }
  }
  return props;
}

/** A building mass beyond the bound (render only): `block` = Altbau back, `house` = suburban house. */
export interface EdgeBlock { kind: 'block' | 'house'; x: number; z: number; rot: number; w: number; d: number; floors: number; seed: number }

/**
 * Silhouette depth beyond the bound (render only, no colliders): a second row of taller building
 * masses behind town fronts, houses and trees behind suburban hedges, tree rows behind thickets,
 * palms behind the jungle. The camera looks north, so the north bound gets one row more and the
 * south bound none (it is never in view). Trees come as `Lot`s for the normal tree builder.
 */
export function edgeBackdrop(m: MapDef, runs: EdgeRun[] = edgeRuns(m)): { blocks: EdgeBlock[]; trees: Lot[] } {
  const rng = new Rng(m.seed + 4099);
  const blocks: EdgeBlock[] = [];
  const trees: Lot[] = [];
  const tree = (s: EdgeSide, t: number, d: number, w: number, jungle: boolean): void => {
    const [x, z] = sidePt(s, t, d);
    if (isWater(m, x, z)) return;
    trees.push({ kind: 'tree', x, z, rot: 0, w, d: w, floors: 0, seed: rng.int(1e6), ...(jungle ? { jungle: true } : {}) });
  };
  for (const r of runs) {
    const s = r.side;
    if (s.nz < -0.5 || !LAND.has(r.kind)) continue;
    const north = s.nz > 0.5;
    if (r.kind === 'town') {
      // Behind the 10 m deep front row: rows of 4 to 8 storeys, staggered.
      const rows: Array<[number, number, number]> = north ? [[10, 3, 5], [24, 4, 7]] : [[10, 3, 5]];
      for (const [back, f0, f1] of rows) {
        for (let t = r.t0 + rng.range(-2, 2); t < r.t1; ) {
          const w = rng.range(9, 16);
          const d = rng.range(10, 13);
          const [x, z] = sidePt(s, Math.min(t + w / 2, r.t1 - 1), -(back + d / 2));
          blocks.push({ kind: 'block', x, z, rot: s.rot, w, d, floors: f0 + rng.int(f1 - f0 + 1), seed: rng.int(1e6) });
          t += w + rng.range(0, 1.2);
        }
      }
    } else if (r.kind === 'suburb') {
      for (let t = r.t0 + rng.range(2, 8); t < r.t1 - 4; t += rng.range(14, 22)) {
        const w = rng.range(7, 10);
        const d = rng.range(7, 9);
        const [x, z] = sidePt(s, t, -(4 + d / 2));
        if (!isWater(m, x, z)) blocks.push({ kind: 'house', x, z, rot: s.rot + Math.PI, w, d, floors: rng.int(2), seed: rng.int(1e6) });
        tree(s, t + w / 2 + rng.range(2, 4), -rng.range(2.5, 5), rng.range(4.5, 6.5), false);
        tree(s, t + rng.range(-3, 3), -(10 + d + rng.range(0, 3)), rng.range(5, 7), false);
      }
    } else {
      const jungle = r.kind === 'jungle';
      const rows = north ? [2.5, 7.5, 12.5, 17.5] : [2.5, 7.5, 12.5];
      rows.forEach((back, k) => {
        for (let t = r.t0 + rng.range(0, 3) + (k % 2) * 2.5; t < r.t1; t += rng.range(5, 7)) {
          tree(s, t + rng.range(-1, 1), -(back + rng.range(-1, 1)), jungle ? rng.range(3, 5) : rng.range(4.5, 7), jungle);
        }
      });
    }
  }
  return { blocks, trees };
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
    else if (l.hx > 0 && !l.walkUnder) colliders.push(...landmarkColliders(l));
  }
  for (const l of lots) colliders.push(...lotColliders(l));
  for (const t of m.terraces) for (const q of t.solid ?? []) colliders.push({ kind: 'box', ...q });
  for (const w of m.camp?.walls ?? []) colliders.push({ kind: 'box', x: w.x, z: w.z, hx: w.hx, hz: w.hz, rot: 0 });
  // M20 camp stations: furniture boxes per level, the whole footprint while a build site (switched by the sim, `syncCampSolids`).
  const campSolids: Level['campSolids'] = [];
  for (const t of m.camp?.stations ?? []) {
    const site: Collider = { kind: 'box', x: t.x, z: t.z, hx: t.w / 2, hz: t.d / 2, rot: t.rot };
    if (!t.solid) { colliders.push(site); continue; }
    campSolids.push({ station: t.id, lo: 0, hi: 0, collider: site });
    const c = Math.cos(t.rot), sn = Math.sin(t.rot);
    for (const [lx, lz, hx, hz, lo = 1, hi = 3] of t.solid) campSolids.push({ station: t.id, lo, hi, collider: { kind: 'box', x: t.x + lx * c + lz * sn, z: t.z - lx * sn + lz * c, hx, hz, rot: t.rot } });
  }
  for (const f of m.camp?.decor ?? []) colliders.push({ kind: 'box', x: f.x, z: f.z, hx: f.w / 2, hz: f.d / 2, rot: 0 });
  colliders.push(...barrierColliders(m));
  if (m.rail) {
    const r = m.rail;
    const left = (r.gapX - r.gapW / 2 + r.minX) / 2;
    const right = (r.gapX + r.gapW / 2 + r.maxX) / 2;
    colliders.push({ kind: 'box', x: left, z: r.z, hx: (r.gapX - r.gapW / 2 - r.minX) / 2, hz: 4, rot: 0 });
    colliders.push({ kind: 'box', x: right, z: r.z, hx: (r.maxX - r.gapX - r.gapW / 2) / 2, hz: 4, rot: 0 });
  }
  const rests = m.landmarks.filter((l) => l.kind === 'spati').map(spatiRest);
  const breakables = m.camp ? [] : breakableDefs(m, props, propColliders, rests);
  const onPier = (x: number, z: number): boolean => (m.piers ?? []).some((p) => { const dx = x - p.x, dz = z - p.z; return Math.abs(dx * Math.sin(p.rot) + dz * Math.cos(p.rot)) <= p.len / 2 && Math.abs(-dx * Math.cos(p.rot) + dz * Math.sin(p.rot)) <= p.width / 2; });
  const T = m.tunnel;
  const gates = (T?.gates ?? []).map((g) => ({ ...g, collider: { kind: 'box' as const, x: g.x, z: g.z, hx: g.half, hz: 0.3, rot: g.rot } }));
  if (T) colliders.push({ kind: 'box', x: T.generator.x, z: T.generator.z, hx: GENERATOR.hx, hz: GENERATOR.hz, rot: T.generator.rot }, ...gates.map((g) => g.collider));
  const ground = new WalkGrid(m.bounds, 0.5, (x, z) => (isWater(m, x, z) && !onBridge(m, x, z) && !onPier(x, z)) || terraceWall(m, x, z) || !tunnelWalk(m, x, z, 0.3)
    || (!!m.camp && !onCampFloor(m.camp, x, z))
    || (inRailYard(m, x, z) && !m.terraces.some((t) => inPoly(t.poly, x, z) || onStair(t, x, z) !== null)));
  const level = new Level(m.id, m.bounds, m.start, colliders, ground, [], m.bounds, m.encounters, m.zones, m.bridges.filter((b) => b.kind === 'ferry'), rests, breakables);
  level.district = m.district ?? 0;
  level.mapId = m.id;
  level.strength = m.strength ?? m.district ?? 0;
  level.camp = !!m.camp;
  level.campSolids = campSolids;
  if (m.flavor) level.flavor = m.flavor;
  if (m.tunnel) level.tunnel = true;
  if (m.wet) level.wet = true;
  if (m.shards) level.shards = true;
  level.hiddenSpots = m.hiddenSpots ?? [];
  level.noSpawn = (m.noSpawn ?? []).map((p) => p.map(([x, z]) => ({ x, z })));
  level.barriers = m.landmarks.filter((l) => l.kind === 'tor').flatMap(torBarriers);
  if (T) {
    level.gates = gates;
    level.traderSpot = { ...T.trader };
    if (T.flood) level.wade = { pts: T.flood.pts.map(([x, z]) => ({ x, z })), half: T.flood.width / 2, factor: T.flood.slow };
  }
  // Lot guards and event spots are sampled before or between props; move the ones a prop covers to the
  // nearest free ground (P21, P23). No random draws, so lots and props stay as they are.
  const snap = <T extends { x: number; z: number }>(p: T): T => { const q = snapReachable(level, p.x, p.z); return q ? { ...p, x: q.x, z: q.z } : p; };
  level.guards = [...(m.guards ?? []), ...lots.flatMap((l) => (l.content?.guards ?? []).map(snap))];
  level.spots = { rescue: [], trader: [], cache: [] };
  for (const l of lots) for (const k of ['rescue', 'trader', 'cache'] as const) { const p = l.content?.spots[k]; if (p) level.spots[k].push(snap({ x: p[0], z: p[1] })); }
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
  const T = m.tunnel!;
  // M20: nothing in the collapse, on a grating line, at the trader or the generator.
  const keep = [T.trader, T.generator];
  const free = (x: number, z: number, r: number): boolean => tunnelWalk(m, x, z, r) && !props.some((p) => Math.hypot(p.x - x, p.z - z) < r + 1.5)
    && !m.encounters.some((e) => Math.hypot(x - e.x, z - e.z) < e.r * 0.5)
    && !T.gates.some((g) => Math.abs((x - g.x) * Math.sin(g.rot) + (z - g.z) * Math.cos(g.rot)) < r + 1.2 && Math.hypot(x - g.x, z - g.z) < g.half + 2)
    && !keep.some((k) => Math.hypot(x - k.x, z - k.z) < r + 2.2);
  for (const t of m.tunnel!.tubes) {
    let side = 1, acc = 0;
    for (let i = 1; i < t.pts.length; i++) {
      const [ax, az] = t.pts[i - 1]!, [bx, bz] = t.pts[i]!, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      for (let d = 0; d < len; d += 1) {
        acc += 1;
        const gap = t.kind === 'branch' || t.kind === 'bypass' ? 9 : 15;
        if (acc < gap) continue;
        acc = rng.range(-2, 2);
        const off = t.width / 2 - 0.8, x = ax + ux * d - uz * off * side, z = az + uz * d + ux * off * side;
        side = -side;
        // Playtest 2026-11-18: the track and the bypass get lamps on their walls (render); here only storm lanterns there.
        const roll = rng.next(), walled = t.kind === 'track' || t.kind === 'bypass';
        if ((!walled || roll >= 0.75) && free(x, z, 0.3)) props.push({ kind: roll < 0.75 ? 'workLamp' : 'stormLantern', x, z, rot: Math.atan2(uz * side, -ux * side), size: 1 });
        const cx = ax + ux * (d + 5) + uz * off * 0.6 * side, cz = az + uz * (d + 5) - ux * off * 0.6 * side;
        // The 4 m bypass stays clear of crates.
        if (rng.next() < 0.55 && t.kind !== 'bypass' && free(cx, cz, 0.8)) props.push({ kind: rng.pick(['crates', 'crate', 'rubble', 'planks', 'bins'] as const), x: cx, z: cz, rot: rng.range(0, Math.PI * 2), size: rng.range(0.8, 1.3) });
      }
    }
    // A metre in from the flat end wall.
    const end = t.pts[t.pts.length - 1]!, prev = t.pts[t.pts.length - 2]!, el = Math.hypot(end[0] - prev[0], end[1] - prev[1]) || 1;
    const bx = end[0] - ((end[0] - prev[0]) / el) * 1.2, bz = end[1] - ((end[1] - prev[1]) / el) * 1.2;
    if (t.kind !== 'track' && free(bx, bz, 0.6)) props.push({ kind: 'fireBarrel', x: bx, z: bz, rot: 0, size: 1 });
  }
  return props;
}
