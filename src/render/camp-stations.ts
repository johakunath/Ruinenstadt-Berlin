// M20: the seven camp stations as they are built (`docs/mockups/m20-camp-combined.svg`): a build
// site (level 0: rubble, barrier tape, a red-white work lamp board, a "Bauplatz" sign) and three
// levels that each add parts, light and life; the keeper stands at the front when freed (2D rule:
// level 2 brings the person). 2D source: `CAMPSVG` in js/camp-art.js (what each level shows) and
// `CST` in js/data.js. Rebuilt only when a level or a keeper changes.
// Each station is one group in its own frame (local x across the front, +z toward the ring, y up
// from its floor). Lights: the stations' light spots are fixed in `camp-world.ts` (constant pool);
// here only emissive parts and additive glow cards (merged per station, one draw call), plus a few
// animated glow sprites (forge, mast lamp, stove, screens).
// Cost per station: about 6 to 9 merged materials, one decal atlas (name boards, neon, screens,
// banner, map) shared by all, one glow mesh, at most two sprites; the keeper is one skinned person.
import {
  AdditiveBlending, BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Euler, Group, Matrix4, Mesh, MeshBasicMaterial,
  PlaneGeometry, RingGeometry, SphereGeometry, Sprite, SpriteMaterial, TorusGeometry, type BufferGeometry, type Material, type Object3D, type Texture,
} from 'three';
import { STATIONS, type StationId } from '../data/camp';
import { YARD_H, type CampLayout, type CampPlace, type StationSpot } from '../data/camp-map';
import type { Prop } from '../data/courtyard';
import { Rng } from '../sim/math';
import { BatchSet } from './batch';
import type { Animator, CharacterAssets } from './characters';
import { npcPerson } from './content';
import { FX_LAYER } from './layers';
import type { LitMaterial, Materials } from './materials';
import { paintCampAtlas, paintChainLink, paintGlow, type AtlasCell } from './paint';
import { buildMarketProp } from './props-market';
import { Builder, makeMats, type Mats } from './world';

export interface CampStationState { level: number; npc: boolean }
export type CampStates = Record<StationId, CampStationState>;

type RGB = readonly [number, number, number];
const PI = Math.PI;
/** Camera pitch: glow cards and signs turn up toward it. */
const CAM_TILT = 0.77;

/** Floor height of a station (a spot may stand on a raised platform). */
function floorY(s: StationSpot): number {
  return s.y ?? (s.inside ? 0 : YARD_H);
}

// Shared unit geometries (merged into batches, never disposed).
const SPHERE = new SphereGeometry(0.5, 8, 6);
const CHUNK = new DodecahedronGeometry(0.5, 0);
const UNIT = new PlaneGeometry(1, 1);
const tmpS = new Matrix4();

// Tints (vertex colors multiply the painted materials).
const C = {
  carRust: [1.35, 0.78, 0.62] as RGB,
  dark: [0.35, 0.32, 0.3] as RGB,
  darkWood: [0.55, 0.45, 0.38] as RGB,
  oldWood: [0.8, 0.72, 0.62] as RGB,
  red: [0.85, 0.2, 0.16] as RGB,
  white: [1.05, 1.03, 1.0] as RGB,
  cream: [1.05, 0.92, 0.75] as RGB,
  olive: [0.5, 0.48, 0.3] as RGB,
  green: [0.32, 0.5, 0.36] as RGB,
  teal: [0.42, 0.52, 0.5] as RGB,
  yellow: [1.05, 0.68, 0.22] as RGB,
  blue: [0.3, 0.42, 0.62] as RGB,
  beige: [0.85, 0.8, 0.66] as RGB,
  steel: [2.2, 2.2, 2.2] as RGB,
  pipe: [1.5, 1.5, 1.45] as RGB,
};
const GLOW = {
  warm: [1, 0.62, 0.3] as RGB,
  fire: [1, 0.45, 0.12] as RGB,
  green: [0.3, 1, 0.45] as RGB,
  cyan: [0.3, 0.85, 1] as RGB,
  cold: [0.75, 0.85, 1] as RGB,
  red: [1, 0.15, 0.1] as RGB,
  pink: [1, 0.25, 0.8] as RGB,
};

interface Art {
  atlas: LitMaterial;
  cells: Record<string, AtlasCell>;
  glow: MeshBasicMaterial;
  glowTex: Texture;
  chain: LitMaterial;
}
interface Anim { o: Sprite; kind: 'blink' | 'flicker' | 'pulse'; base: number; phase: number }

/** Local frame helpers for one station. */
class Kit {
  readonly glows = new BatchSet();
  readonly anims: Anim[] = [];
  /** Turns a local card to face the camera (world +z). */
  readonly face: number;
  readonly m: Mats;

  constructor(readonly b: Builder, readonly art: Art, readonly s: StationSpot, readonly rng: Rng) {
    this.face = -s.rot;
    this.m = b.mats;
  }

  M(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): Matrix4 {
    return new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
  }

  box(mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, c?: RGB, ry = 0, rx = 0, rz = 0): void {
    this.b.box(mat, this.M(x, y, z, ry, rx, rz), sx, sy, sz, c);
  }

  /** Cylinder along y (rx = PI / 2 lays it along z, rz = PI / 2 along x). */
  cyl(mat: Material, x: number, y: number, z: number, r: number, h: number, c?: RGB, o: { r1?: number; seg?: number; rx?: number; ry?: number; rz?: number; open?: boolean } = {}): void {
    this.b.geo(mat, new CylinderGeometry(r, o.r1 ?? r, h, o.seg ?? 10, 1, o.open ?? false), this.M(x, y, z, o.ry ?? 0, o.rx ?? 0, o.rz ?? 0), c);
  }

  ball(mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, c?: RGB, ry = 0): void {
    this.b.geo(mat, SPHERE, this.M(x, y, z, ry).multiply(tmpS.makeScale(sx, sy, sz)), c);
  }

  /** A beam between two points (square section `t`). */
  beam(mat: Material, a: readonly [number, number, number], e: readonly [number, number, number], t: number, c?: RGB): void {
    const dx = e[0] - a[0], dy = e[1] - a[1], dz = e[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, Math.hypot(dx, dz));
    this.box(mat, (a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2, t, t, len, c, ry, rx);
  }

  /** An atlas decal (a quad facing local +z before rotation). */
  card(cell: string, x: number, y: number, z: number, w: number, h: number, ry = 0, rx = 0, c?: RGB): void {
    const r = this.art.cells[cell];
    if (!r) return;
    const g = new PlaneGeometry(w, h);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
    this.b.geo(this.art.atlas, g, this.M(x, y, z, ry, rx), c);
  }

  /** Chain-link mesh sheet (alpha-tested card, tiles every `tile` meters). */
  fence(x: number, y: number, z: number, w: number, h: number, ry = 0, rx = 0, c: RGB = [0.8, 0.8, 0.78], tile = 0.2): void {
    const g = new PlaneGeometry(w, h);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
    this.b.cards.of(this.art.chain).add(g, this.M(x, y, z, ry, rx), c);
  }

  /** A soft additive glow card turned toward the camera. */
  glow(x: number, y: number, z: number, size: number, c: RGB, k = 1): void {
    const f = 0.6 * k;
    this.glows.of(this.art.glow).add(UNIT, this.M(x, y, z, this.face, -CAM_TILT).multiply(tmpS.makeScale(size, size, 1)), [c[0] * f, c[1] * f, c[2] * f]);
  }

  /** An animated glow (blink, flicker, pulse); its opacity is driven in `update`. */
  sprite(x: number, y: number, z: number, size: number, color: number, kind: Anim['kind'], base = 0.8): Sprite {
    const s = new Sprite(new SpriteMaterial({ map: this.art.glowTex, color, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    s.layers.set(FX_LAYER);
    s.renderOrder = 6;
    this.anims.push({ o: s, kind, base, phase: this.anims.length * 1.9 + this.s.x });
    return s;
  }

  prop(kind: Prop['kind'], x: number, z: number, rot = 0, size = 1): void {
    buildMarketProp(this.b, { kind, x, z, rot, size }, this.rng);
  }
}

// ---------------------------------------------------------------- shared pieces

function crate(k: Kit, x: number, y: number, z: number, s: number, ry = 0, c: RGB = [1, 1, 1]): void {
  const h = s * 0.78, g = k.rng.range(0.75, 1.05), t: RGB = [c[0] * g, c[1] * g, c[2] * g];
  k.box(k.m.wood, x, y + h / 2, z, s, h, s, t, ry);
  // Lid boards and corner posts read from the camera.
  const ax = Math.cos(ry), az = -Math.sin(ry);
  for (const o of [-0.3, 0, 0.3]) k.box(k.m.wood, x + ax * o * s, y + h + 0.012, z + az * o * s, s * 0.28, 0.025, s * 0.98, [t[0] * 0.8, t[1] * 0.78, t[2] * 0.75], ry);
  k.box(k.m.wood, x, y + h * 0.5, z, s + 0.03, 0.06, s + 0.03, [t[0] * 0.6, t[1] * 0.55, t[2] * 0.5], ry);
}

function barrel(k: Kit, x: number, z: number, c: RGB = C.carRust, y = 0): void {
  k.cyl(k.m.rust, x, y + 0.45, z, 0.3, 0.9, c, { r1: 0.28, seg: 12 });
  for (const yy of [0.2, 0.7]) k.cyl(k.m.iron, x, y + yy, z, 0.31, 0.05, C.dark, { seg: 12 });
  k.b.geo(k.m.iron, new CircleGeometry(0.28, 12), k.M(x, y + 0.905, z, 0, -PI / 2), [0.5, 0.45, 0.4]);
}

function sandbag(k: Kit, x: number, y: number, z: number, ry: number): void {
  const g = k.rng.range(0.8, 1.08);
  k.ball(k.m.burlap, x, y + 0.12, z, 0.62, 0.26, 0.38, [g, g * 0.97, g * 0.9], ry + k.rng.range(-0.12, 0.12));
}

/** A wall of sandbags from (x0, z0) to (x1, z1), `rows` high, staggered. */
function bagWall(k: Kit, x0: number, z0: number, x1: number, z1: number, rows: number): void {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(z0 - z1, x1 - x0), n = Math.max(1, Math.round(len / 0.58));
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 0.5 : 0, cnt = n - (r % 2);
    for (let i = 0; i < cnt; i++) {
      const u = (i + 0.5 + off) / n;
      sandbag(k, x0 + (x1 - x0) * u, r * 0.22, z0 + (z1 - z0) * u, ry);
    }
  }
}

/** Rubble heap: concrete chunks and bricks. */
function heap(k: Kit, x: number, z: number, r: number): void {
  const n = Math.round(10 + r * 12);
  for (let i = 0; i < n; i++) {
    const a = k.rng.range(0, PI * 2), d = Math.sqrt(k.rng.next()) * r, h = Math.max(0, 1 - d / r) * r * 0.6, g = k.rng.range(0.6, 1);
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (k.rng.next() < 0.45) k.box(k.m.brick, px, 0.08 + h * k.rng.range(0.4, 1), pz, k.rng.range(0.24, 0.4), 0.12, k.rng.range(0.12, 0.2), [g, g * 0.95, g * 0.9], k.rng.range(0, 3), k.rng.range(-0.5, 0.5), k.rng.range(-0.5, 0.5));
    else {
      const s = k.rng.range(0.25, 0.6);
      k.b.geo(k.m.concrete, CHUNK, k.M(px, 0.08 + h * k.rng.range(0.3, 0.9), pz, k.rng.range(0, 3), k.rng.range(0, 3)).multiply(tmpS.makeScale(s, s * 0.6, s)), [g * 0.8, g * 0.8, g * 0.78]);
    }
  }
}

/** Hanging lamp: cord, enamel shade, warm bulb and its glow. */
function hangLamp(k: Kit, x: number, y: number, z: number, cord: number, shade: RGB = C.green, glow: RGB = GLOW.warm, size = 2.2): void {
  k.box(k.m.iron, x, y + cord / 2 + 0.12, z, 0.02, cord, 0.02, C.dark);
  k.cyl(k.m.enamel, x, y + 0.08, z, 0.05, 0.16, shade, { r1: 0.24, seg: 12, open: true });
  k.ball(k.m.lampGlass, x, y - 0.02, z, 0.13, 0.13, 0.13);
  k.glow(x, y - 0.1, z, size, glow, 0.9);
}

/** A table: top and four legs; returns the top height. */
function table(k: Kit, x: number, z: number, w: number, d: number, h: number, ry = 0, top: RGB = C.darkWood, legs: Material = k.m.iron): number {
  const ax = Math.cos(ry), az = -Math.sin(ry), bx = Math.sin(ry), bz = Math.cos(ry);
  k.box(k.m.wood, x, h - 0.03, z, w, 0.06, d, top, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = x + ax * sx * (w / 2 - 0.06) + bx * sz * (d / 2 - 0.06), lz = z + az * sx * (w / 2 - 0.06) + bz * sz * (d / 2 - 0.06);
    k.box(legs, lx, (h - 0.06) / 2, lz, 0.06, h - 0.06, 0.06, legs === k.m.iron ? C.pipe : C.darkWood, ry);
  }
  k.box(k.m.wood, x, 0.2, z, w - 0.1, 0.03, d - 0.1, C.darkWood, ry);
  return h;
}

/** CRT monitor (beige case, glowing screen) facing local yaw `ry`. */
function crt(k: Kit, x: number, y: number, z: number, s: number, ry: number, screen = 'crt_g', glow: RGB = GLOW.green): void {
  const bx = Math.sin(ry), bz = Math.cos(ry);
  k.box(k.m.enamel, x - bx * 0.08 * s, y + 0.22 * s, z - bz * 0.08 * s, 0.5 * s, 0.44 * s, 0.42 * s, C.beige, ry);
  k.box(k.m.enamel, x - bx * 0.3 * s, y + 0.2 * s, z - bz * 0.3 * s, 0.34 * s, 0.32 * s, 0.3 * s, [0.7, 0.66, 0.56], ry);
  k.card(screen, x + bx * 0.135 * s, y + 0.24 * s, z + bz * 0.135 * s, 0.4 * s, 0.31 * s, ry);
  k.glow(x + bx * 0.3 * s, y + 0.24 * s, z + bz * 0.3 * s, 1.1 * s, glow, 0.7);
}

/** Name board facing the camera, optionally on two posts, with level pips under it. */
function board(k: Kit, id: StationId, x: number, y: number, z: number, w: number, level: number, o: { posts?: boolean; tilt?: number } = {}): void {
  const h = w / 5, f = k.face, tilt = o.tilt ?? 0.3, ax = Math.cos(f), az = -Math.sin(f), nx = Math.sin(f), nz = Math.cos(f);
  k.box(k.m.wood, x - nx * 0.04, y, z - nz * 0.04, w + 0.14, h + 0.14, 0.05, C.darkWood, f, -tilt);
  k.card(`name_${id}`, x, y, z, w, h, f, -tilt);
  if (o.posts) for (const sx of [-1, 1]) {
    const px = x + ax * sx * (w / 2 - 0.12) - nx * 0.1, pz = z + az * sx * (w / 2 - 0.12) - nz * 0.1;
    k.box(k.m.iron, px, (y + h / 2) / 2, pz, 0.07, y + h / 2, 0.07, C.pipe);
  }
  // Level pips: three small lamps under the right end, lit up to the level.
  for (let i = 0; i < 3; i++) {
    const px = x + ax * (w / 2 - 0.15 - (2 - i) * 0.2), pz = z + az * (w / 2 - 0.15 - (2 - i) * 0.2);
    const lit = i < level;
    k.box(lit ? k.m.lampGlass : k.m.iron, px, y - h / 2 - 0.12, pz, 0.13, 0.13, 0.05, lit ? undefined : C.dark, f, -tilt);
    if (lit) k.glow(px + nx * 0.05, y - h / 2 - 0.12, pz + nz * 0.05, 0.5, GLOW.warm, 0.7);
  }
}

/** Barrier tape around a rectangle (posts and red-white tape at knee height). */
function tape(k: Kit, w: number, d: number): void {
  const pts: Array<[number, number]> = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = pts[i]!, [x1, z1] = pts[(i + 1) % 4]!;
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 2.2));
    for (let j = 0; j < n; j++) {
      const ax = x0 + ((x1 - x0) * j) / n, az = z0 + ((z1 - z0) * j) / n, bx = x0 + ((x1 - x0) * (j + 1)) / n, bz = z0 + ((z1 - z0) * (j + 1)) / n;
      k.box(k.m.enamel, ax, 0.5, az, 0.05, 1.0, 0.05, j % 2 ? C.white : C.red);
      k.box(k.m.concrete, ax, 0.05, az, 0.22, 0.1, 0.22, [0.7, 0.7, 0.68]);
      const ry = Math.atan2(az - bz, bx - ax), l = Math.hypot(bx - ax, bz - az);
      for (const flip of [0, PI]) k.card('stripes', (ax + bx) / 2, 0.86 - 0.04 * Math.sin(j), (az + bz) / 2, l, 0.11, ry + flip);
    }
  }
}

/** Red-white work lamp board on two legs (the construction light, no flame). */
function workLamp(k: Kit, x: number, z: number, ry: number): void {
  const ax = Math.cos(ry), az = -Math.sin(ry);
  for (const s of [-1, 1]) k.box(k.m.iron, x + ax * s * 0.45, 0.45, z + az * s * 0.45, 0.05, 0.9, 0.05, C.steel, ry);
  k.card('stripes', x, 0.78, z, 1.1, 0.26, ry);
  k.card('stripes', x, 0.78, z, 1.1, 0.26, ry + PI);
  k.cyl(k.m.lampGlass, x + ax * 0.32, 1.02, z + az * 0.32, 0.1, 0.12, undefined, { rz: PI / 2, ry });
  k.glow(x + ax * 0.32, 1.05, z + az * 0.32, 1.6, GLOW.warm, 1);
}

/** Level 0: rubble, planks, tape, a work lamp board and the "Bauplatz" sign with the station name. */
function site(k: Kit, id: StationId): void {
  const { w, d } = k.s;
  const n = Math.max(2, Math.round((w * d) / 14));
  for (let i = 0; i < n; i++) heap(k, ((i + 0.5) / n - 0.5) * (w - 2) + k.rng.range(-0.4, 0.4), k.rng.range(-d / 2 + 0.9, d / 2 - 1.2), Math.min(d / 2 - 0.2, k.rng.range(0.9, 1.3)));
  for (let i = 0; i < 5; i++) k.box(k.m.wood, -w / 2 + 1.4 + k.rng.range(-0.1, 0.1), 0.04 + i * 0.05, d / 2 - 0.6 + i * 0.03, 2.4, 0.05, 0.2, C.oldWood, k.rng.range(-0.08, 0.08));
  tape(k, w - 0.3, d - 0.3);
  workLamp(k, w / 2 - 1.1, d / 2 - 0.55, 0.2);
  // The sign on a post near the front, the name under it.
  k.box(k.m.iron, 0.6, 0.9, d / 2 - 0.45, 0.08, 1.8, 0.08, C.pipe);
  k.box(k.m.wood, 0.6, 1.68, d / 2 - 0.5, 1.32, 0.68, 0.05, C.darkWood, k.face, -0.25);
  k.card('bauplatz', 0.6, 1.68, d / 2 - 0.46, 1.25, 0.62, k.face, -0.25);
  board(k, id, 0.6, 1.12, d / 2 - 0.44, 1.7, 0, { tilt: 0.25 });
}

// ---------------------------------------------------------------- stations

/** Schwarzmarkt: stalls under tarps before a chain-link fence, the bear banner, stash lockers; L2 a store with shelves, L3 a canopy and neon. */
function markt(k: Kit, L: number): void {
  const m = k.m;
  // Chain-link fence along the back with posts that carry the signs.
  const fz = -1.85;
  for (let x = -5.3; x <= 5.31; x += 2.65) k.box(m.iron, x, 1.75, fz, 0.08, 3.5, 0.08, C.pipe);
  k.fence(0, 1.35, fz, 10.6, 2.6);
  k.box(m.iron, 0, 2.65, fz, 10.6, 0.05, 0.05, C.pipe);
  // Two stalls (crate counters, goods, tarps), crates and sacks around them.
  k.prop('stall', -3.6, -0.45, 0);
  k.prop('stall', -0.3, -0.45, 0.04);
  crate(k, -5.0, 0, 1.3, 0.7, 0.2);
  crate(k, -4.4, 0, 1.55, 0.55, -0.3);
  crate(k, -5.0, 0.55, 1.3, 0.5, 0.5);
  for (let i = 0; i < 3; i++) k.box(m.burlap, 1.45 + i * 0.35, 0.25, 1.4 + (i % 2) * 0.2, 0.42, 0.5, 0.32, [0.95, 0.88, 0.75], k.rng.range(-0.4, 0.4));
  // Bear banner and the name board above the stalls.
  k.box(m.iron, -0.3, 3.95, fz + 0.06, 1.3, 0.05, 0.05, C.pipe);
  k.card('bear', -0.3, 3.25, fz + 0.08, 1.05, 1.4, 0, -0.12);
  board(k, 'markt', -3.6, 3.15, fz + 0.1, 2.6, L);
  // Stash lockers (the stash itself).
  const locker = (x: number): void => {
    k.box(m.enamel, x, 0.98, -1.45, 1.5, 1.96, 0.55, C.teal);
    k.card('lockers', x, 0.98, -1.17, 1.44, 1.86);
  };
  locker(4.5);
  crate(k, 2.4, 0, 1.0, 0.75, 0.1);
  crate(k, 2.6, 0.58, 1.0, 0.55, 0.4);
  k.glow(-2, 2.2, 0.6, 3.4, GLOW.warm, 0.35);
  if (L >= 2) {
    // Lagerhalle: a steel shelf with goods, a pallet of sacks, a lamp over the store.
    const shelf = (x: number): void => {
      for (const sx of [-0.72, 0.72]) for (const sz of [-0.22, 0.22]) k.box(m.iron, x + sx, 1.1, -1.4 + sz, 0.05, 2.2, 0.05, C.blue);
      for (const y of [0.12, 0.85, 1.55, 2.18]) k.box(m.iron, x, y, -1.4, 1.5, 0.04, 0.5, C.steel);
      k.card('goods', x, 0.5, -1.62, 1.42, 0.7);
      k.card('goods', x, 1.22, -1.62, 1.42, 0.7, 0, 0, [0.95, 0.9, 0.85]);
      crate(k, x - 0.3, 2.2, -1.4, 0.5, 0.2);
      crate(k, x + 0.35, 2.2, -1.4, 0.45, -0.1);
    };
    shelf(2.5);
    k.box(m.wood, 4.2, 0.07, 0.75, 1.2, 0.14, 1.0, C.oldWood);
    for (let i = 0; i < 4; i++) k.box(m.burlap, 3.9 + (i % 2) * 0.55, 0.38 + Math.floor(i / 2) * 0.3, 0.75, 0.5, 0.3, 0.85, [0.92, 0.86, 0.72], k.rng.range(-0.1, 0.1));
    hangLamp(k, 3.4, 2.6, -0.3, 1.0, C.green);
  }
  if (L >= 3) {
    // A corrugated canopy over the store, a second locker row, the "OFFEN" neon and a scale on the stall.
    for (const x of [1.7, 5.3]) k.box(m.iron, x, 1.45, 0.4, 0.08, 2.9, 0.08, C.pipe);
    k.box(m.corrugated, 3.5, 2.95, -0.7, 3.9, 0.06, 2.6, [0.8, 0.72, 0.62], 0, -0.12);
    locker(3.4);
    for (let i = 0; i < 3; i++) crate(k, 5.0, i * 0.55, 1.5, 0.6 - i * 0.05, i * 0.3);
    k.box(m.iron, 3.5, 3.65, fz + 0.06, 1.7, 0.05, 0.05, C.pipe);
    k.card('neon_offen', 3.5, 3.35, fz + 0.1, 1.5, 0.56, 0, -0.15);
    k.glow(3.5, 3.35, fz + 0.4, 2.0, GLOW.red, 0.7);
    k.cyl(m.iron, -0.3, 0.98, 0.55, 0.18, 0.04, C.steel, { seg: 12 });
    k.box(m.iron, -0.3, 0.88, 0.55, 0.12, 0.18, 0.12, C.dark);
  }
}

/** Lazarett: a cot, the medicine cabinet, a red cross on a sheet; L2 curtains, a second cot, IV stand, sani crate; L3 drug shelf and operating lamp. */
function laz(k: Kit, L: number): void {
  const m = k.m;
  const cot = (x: number, z: number): void => {
    for (const sz of [-0.85, 0.85]) for (const sx of [-0.3, 0.3]) k.box(m.iron, x + sx, 0.2, z + sz, 0.04, 0.4, 0.04, C.olive, 0, 0, sx > 0 ? 0.3 : -0.3);
    for (const sx of [-0.36, 0.36]) k.box(m.iron, x + sx, 0.42, z, 0.05, 0.05, 1.95, C.olive);
    k.box(m.linen, x, 0.45, z, 0.72, 0.05, 1.9, [0.55, 0.58, 0.4]);
    k.ball(m.linen, x, 0.52, z - 0.7, 0.5, 0.14, 0.3, C.white);
    k.box(m.linen, x, 0.51, z + 0.3, 0.76, 0.08, 1.0, [0.5, 0.56, 0.7], 0, 0.02);
  };
  cot(-3.6, -0.6);
  // Medicine cabinet against the back.
  k.box(m.enamel, 3.9, 0.98, -1.65, 1.1, 1.96, 0.5, C.white);
  k.card('meds', 3.9, 0.98, -1.39, 1.02, 1.86);
  // Red cross on a sheet hung on a pipe frame.
  for (const x of [-0.6, 1.4]) k.box(m.iron, x, 1.3, -1.8, 0.06, 2.6, 0.06, C.pipe);
  k.box(m.iron, 0.4, 2.6, -1.8, 2.1, 0.05, 0.05, C.pipe);
  k.box(m.linen, 0.4, 1.75, -1.82, 1.9, 1.7, 0.02, [0.95, 0.94, 0.9]);
  k.card('cross', 0.4, 1.85, -1.79, 1.0, 1.0);
  // Small table with a basin and a kettle, blankets, a bucket.
  table(k, 1.6, -0.9, 0.9, 0.6, 0.8);
  k.cyl(m.enamel, 1.45, 0.86, -0.9, 0.2, 0.1, C.white, { r1: 0.14 });
  k.cyl(m.enamel, 1.85, 0.9, -0.85, 0.09, 0.2, C.blue);
  for (let i = 0; i < 4; i++) k.box(m.linen, -4.6, 0.08 + i * 0.12, 1.3, 0.6, 0.11, 0.45, ([[0.6, 0.35, 0.3], [0.5, 0.56, 0.4], [0.45, 0.5, 0.65], [0.7, 0.66, 0.5]] as RGB[])[i]!, k.rng.range(-0.15, 0.15));
  k.cyl(m.enamel, 2.6, 0.17, 1.1, 0.16, 0.34, [0.6, 0.6, 0.62], { r1: 0.13 });
  board(k, 'laz', 3.4, 2.75, -1.9, 2.4, L, { posts: true });
  k.glow(0.4, 2.3, -0.8, 3.5, GLOW.cold, 0.25);
  if (L >= 2) {
    // Sanitätszelt: curtain rails and pleated curtains between the cots, IV stand, sani crate.
    cot(-1.4, -0.6);
    const rail = (x0: number, z0: number, x1: number, z1: number): void => {
      k.beam(m.iron, [x0, 2.15, z0], [x1, 2.15, z1], 0.04, C.pipe);
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 0.32), ry = Math.atan2(z0 - z1, x1 - x0);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        k.box(m.linen, x0 + (x1 - x0) * u, 1.2, z0 + (z1 - z0) * u, len / n + 0.04, 1.8, 0.03, [0.92, 0.94, 0.9], ry + (i % 2 ? 0.45 : -0.45));
      }
    };
    for (const [x, z] of [[-4.8, -1.75], [-0.4, -1.75], [-2.5, 0.6], [-0.4, 0.6]] as const) k.box(m.iron, x, 1.08, z, 0.05, 2.16, 0.05, C.pipe);
    rail(-4.8, -1.75, -0.4, -1.75);
    rail(-2.5, -1.75, -2.5, 0.6);
    k.box(m.iron, -0.1, 0.9, 0.3, 0.04, 1.8, 0.04, C.steel);
    k.box(m.iron, -0.1, 1.8, 0.3, 0.3, 0.03, 0.03, C.steel);
    k.box(m.linen, 0.05, 1.6, 0.3, 0.14, 0.24, 0.06, [0.8, 0.95, 0.92]);
    k.box(m.enamel, 1.4, 0.28, 1.2, 0.85, 0.56, 0.55, C.white, 0.15);
    k.card('cross', 1.4 - 0.04, 0.3, 1.48, 0.38, 0.38, 0.15);
    k.card('cross', 1.4, 0.565, 1.2, 0.38, 0.38, 0.15, -PI / 2);
  }
  if (L >= 3) {
    // Drug shelf and the operating lamp over the first cot.
    k.box(m.enamel, 2.5, 1.05, -1.65, 1.2, 2.1, 0.45, [0.85, 0.88, 0.86]);
    k.card('meds', 2.5, 1.05, -1.415, 1.12, 2.0, 0, 0, [0.95, 1, 1]);
    k.box(m.iron, -4.75, 0.04, -1.5, 0.6, 0.08, 0.6, C.steel);
    k.box(m.iron, -4.75, 1.3, -1.5, 0.07, 2.5, 0.07, C.steel);
    k.beam(m.iron, [-4.75, 2.5, -1.5], [-3.6, 2.2, -0.6], 0.06, C.steel);
    k.cyl(m.enamel, -3.6, 2.12, -0.6, 0.42, 0.14, C.white, { r1: 0.48, seg: 16 });
    k.b.geo(m.lampGlass, new CircleGeometry(0.36, 16), k.M(-3.6, 2.04, -0.6, 0, PI / 2), [1.4, 1.4, 1.4]);
    k.glow(-3.6, 1.95, -0.6, 2.6, GLOW.cold, 1.1);
    k.glow(-3.6, 0.6, -0.6, 2.4, GLOW.cold, 0.4);
  }
}

/** Imbiss in a viaduct arch: stove and pot behind a counter; L2 garden crates and a grill; L3 awning, bulbs and the neon "IMBISS". */
function imbiss(k: Kit, L: number): void {
  const m = k.m, { d } = k.s;
  const cz = d / 2 - 0.45;
  // Counter: plank front, a dark top, pots and bread on it.
  k.box(m.wood, -0.8, 0.5, cz, 4.4, 1.0, 0.6, C.oldWood);
  for (let i = 0; i < 9; i++) k.box(m.wood, -2.8 + i * 0.5, 0.5, cz + 0.31, 0.46, 0.95, 0.03, [0.7 + (i % 3) * 0.08, 0.58, 0.45]);
  k.box(m.wood, -0.8, 1.03, cz, 4.6, 0.06, 0.72, C.darkWood);
  for (let i = 0; i < 4; i++) k.ball(m.wood, -2.6 + i * 0.28, 1.1, cz + 0.1, 0.22, 0.1, 0.12, [1.2, 0.8, 0.45], i);
  k.cyl(m.enamel, 0.2, 1.16, cz, 0.16, 0.2, C.red);
  k.box(m.wood, 0.9, 1.08, cz, 0.5, 0.04, 0.32, [1.1, 0.95, 0.75]);
  // Stove behind, a big pot steaming, the chimney pipe.
  const sx = -1.6, sz = -0.55;
  k.box(m.iron, sx, 0.42, sz, 1.1, 0.84, 0.75, C.dark);
  k.box(m.iron, sx, 0.86, sz, 1.16, 0.05, 0.8, [0.6, 0.6, 0.6]);
  k.b.geo(m.coals, new CircleGeometry(0.16, 10), k.M(sx + 0.3, 0.89, sz, 0, -PI / 2));
  k.box(m.coals, sx, 0.3, sz + 0.38, 0.4, 0.2, 0.02);
  k.cyl(m.enamel, sx - 0.25, 1.06, sz, 0.26, 0.36, C.cream, { seg: 14 });
  k.cyl(m.iron, sx + 0.3, 0.95, sz, 0.14, 0.12, C.steel);
  k.cyl(m.iron, sx + 0.4, 2.0, sz - 0.25, 0.08, 2.2, C.dark);
  k.sprite(sx + 0.3, 1.0, sz, 1.2, 0xff8a3c, 'flicker', 0.7);
  k.glow(sx, 1.1, sz + 0.4, 1.6, GLOW.fire, 0.5);
  // Gas bottle, firewood, a shelf with jars against the back.
  k.cyl(m.enamel, 1.9, 0.38, -0.4, 0.17, 0.76, C.red, { seg: 12 });
  for (let i = 0; i < 7; i++) k.cyl(m.wood, 3.1 + (i % 3) * 0.2 - (i > 5 ? 0.1 : 0), 0.1 + Math.floor(i / 3) * 0.17, -0.9, 0.08, 0.7, C.darkWood, { rx: PI / 2, seg: 7 });
  k.box(m.wood, 0.6, 1.5, -d / 2 + 0.2, 2.2, 0.04, 0.32, C.darkWood);
  for (let i = 0; i < 7; i++) k.cyl(m.enamel, -0.3 + i * 0.3, 1.62, -d / 2 + 0.2, 0.06, 0.2, ([[0.85, 0.5, 0.2], [0.5, 0.65, 0.3], [0.85, 0.2, 0.16]] as RGB[])[i % 3]!);
  board(k, 'imbiss', 2.4, 2.25, -d / 2 + 0.35, 2.3, L, { tilt: 0.2 });
  if (L >= 2) {
    // Grill (brick block, grate, sausages) and the vegetable garden in crates.
    const gx = 2.6, gz = 0.5;
    k.box(m.brick, gx, 0.42, gz, 1.4, 0.84, 0.8, [0.85, 0.7, 0.62]);
    k.box(m.coals, gx, 0.86, gz, 1.2, 0.03, 0.6);
    for (let i = 0; i < 8; i++) k.box(m.iron, gx - 0.55 + i * 0.157, 0.9, gz, 0.02, 0.02, 0.66, C.steel);
    for (let i = 0; i < 6; i++) k.cyl(m.enamel, gx - 0.4 + i * 0.16, 0.93, gz + (i % 2) * 0.1 - 0.05, 0.035, 0.3, [0.75, 0.32, 0.18], { rx: PI / 2, seg: 6 });
    k.glow(gx, 1.0, gz, 1.8, GLOW.fire, 0.7);
    const bed = (x: number, z: number): void => {
      k.box(m.wood, x, 0.2, z, 0.9, 0.4, 0.55, C.oldWood);
      k.box(m.concrete, x, 0.38, z, 0.82, 0.04, 0.47, [0.35, 0.25, 0.18]);
      for (let i = 0; i < 4; i++) {
        const px = x - 0.3 + i * 0.2, g = k.rng.range(0.7, 1);
        for (const r of [0, PI / 2]) k.b.cards.of(m.fern).add(UNIT, k.M(px, 0.6, z, r + i).multiply(tmpS.makeScale(0.45, 0.45, 1)), [g * 0.8, g, g * 0.6]);
        if (i % 2) k.ball(m.enamel, px + 0.05, 0.52, z + 0.12, 0.09, 0.09, 0.09, C.red);
      }
    };
    bed(-3.4, 0.9);
    bed(-3.4, -0.1);
  }
  if (L >= 3) {
    // Awning over the counter, bulbs along its edge, the neon above it in the arch.
    for (const x of [-3.2, 1.6]) k.box(m.wood, x, 1.35, cz + 0.4, 0.09, 2.7, 0.09, C.darkWood);
    k.box(m.wood, -0.8, 2.66, cz + 0.4, 4.9, 0.08, 0.08, C.darkWood);
    k.box(m.awning, -0.8, 2.72, cz + 0.05, 5.0, 0.04, 0.9, [1.05, 0.85, 0.6], 0, -0.35);
    k.box(m.awning, -0.8, 2.5, cz + 0.47, 5.0, 0.3, 0.02, [1.0, 0.8, 0.55]);
    for (let i = 0; i < 9; i++) {
      const x = -3.2 + i * 0.6;
      k.ball(m.lampGlass, x, 2.3 - 0.06 * Math.sin((i / 8) * PI), cz + 0.52, 0.1, 0.12, 0.1);
    }
    k.glow(-0.8, 2.2, cz + 0.6, 2.8, GLOW.warm, 0.3);
    for (const x of [-1.9, 0.3]) k.box(m.iron, x, 3.3, -0.4, 0.05, 1.2, 0.05, C.dark);
    k.card('neon_imbiss', -0.8, 3.75, -0.35, 2.8, 0.7, k.face, -0.25);
    k.glow(-0.8, 3.75, 0.0, 2.4, [1, 0.5, 0.15], 0.5);
  }
}

/** Kommandantur: the signal box (brick base, timber cab with a window band), map table and radio; L2 radio mast with a blinking lamp, notes board; L3 searchlight, screens, sandbags. */
function kom(k: Kit, L: number): void {
  const m = k.m;
  const tx = 1.5, tz = -1.6, tw = 3.6, td = 2.6;
  k.box(m.brick, tx, 1.2, tz, tw, 2.4, td, [0.8, 0.62, 0.55]);
  k.box(m.wood, tx, 2.46, tz, tw + 0.2, 0.12, td + 0.2, C.darkWood);
  k.box(m.wood, tx, 3.3, tz, tw + 0.1, 1.6, td + 0.1, [0.5, 0.6, 0.56]);
  k.card('windows', tx, 3.3, tz + td / 2 + 0.07, 3.3, 0.85);
  k.card('windows', tx - tw / 2 - 0.07, 3.3, tz, 2.3, 0.85, -PI / 2);
  k.card('windows', tx + tw / 2 + 0.07, 3.3, tz, 2.3, 0.85, PI / 2);
  k.glow(tx, 3.3, tz + td / 2 + 0.3, 3.6, GLOW.warm, 0.5);
  // Hip roof with an overhang.
  k.box(m.wood, tx, 4.14, tz, tw + 0.6, 0.08, td + 0.6, C.darkWood);
  k.b.geo(m.iron, new ConeGeometry(1, 1, 4, 1), k.M(tx, 4.48, tz, PI / 4).multiply(tmpS.makeScale((tw + 0.6) / Math.SQRT2, 0.6, (td + 0.6) / Math.SQRT2)), [0.8, 0.7, 0.65]);
  // Door, a barred window, a lamp over the door; the outside stair to the cab.
  k.box(m.wood, 2.65, 1.0, tz + td / 2 + 0.03, 0.9, 2.0, 0.06, [0.45, 0.55, 0.48]);
  k.card('dark', 0.85, 1.25, tz + td / 2 + 0.02, 0.8, 0.7);
  for (let i = 0; i < 4; i++) k.box(m.iron, 0.55 + i * 0.2, 1.25, tz + td / 2 + 0.05, 0.03, 0.7, 0.03, C.dark);
  k.box(m.iron, 2.65, 2.12, tz + td / 2 + 0.2, 0.05, 0.05, 0.35, C.dark);
  k.ball(m.lampGlass, 2.65, 2.06, tz + td / 2 + 0.36, 0.12, 0.12, 0.12);
  k.glow(2.65, 2.0, tz + td / 2 + 0.5, 1.8, GLOW.warm, 0.9);
  for (let i = 0; i < 8; i++) k.box(m.wood, -0.75, 0.15 + i * 0.3, -0.45 - i * 0.27, 0.8, 0.05, 0.3, C.oldWood);
  k.beam(m.wood, [-1.15, 0.05, -0.3], [-1.15, 2.45, -2.6], 0.07, C.darkWood);
  k.beam(m.wood, [-1.15, 1.0, -0.3], [-1.15, 3.4, -2.6], 0.04, C.darkWood);
  board(k, 'kom', 0.85, 2.05, tz + td / 2 + 0.05, 2.2, L, { tilt: 0.12 });
  // Map table with the radio and a lantern; stools, crates, jerry cans.
  const top = table(k, -1.4, 1.3, 1.8, 0.95, 0.88, 0.05);
  k.card('map', -1.5, top + 0.01, 1.32, 1.5, 1.0, 0.05, -PI / 2);
  k.box(m.enamel, -0.75, top + 0.18, 1.0, 0.5, 0.36, 0.32, C.olive, 0.05);
  k.card('radio', -0.74, top + 0.18, 1.17, 0.46, 0.33, 0.05);
  k.box(m.iron, -0.62, top + 0.6, 0.95, 0.02, 0.5, 0.02, C.dark, 0, 0, 0.3);
  k.cyl(m.lampGlass, -2.1, top + 0.13, 1.1, 0.07, 0.2);
  k.glow(-2.1, top + 0.2, 1.2, 1.7, GLOW.warm, 1);
  for (const [x, z] of [[-1.6, 2.2], [-0.4, 2.0]] as const) k.cyl(m.wood, x, 0.24, z, 0.18, 0.48, C.darkWood);
  crate(k, 3.0, 0, 1.6, 0.7, 0.2);
  crate(k, 3.05, 0.55, 1.55, 0.55, -0.2);
  for (let i = 0; i < 3; i++) k.box(m.enamel, 2.2 + i * 0.32, 0.25, 2.5, 0.28, 0.5, 0.17, C.olive, 0.1);
  if (L >= 2) {
    // Funkmast on the roof: three legs, braces, a dipole, the blinking lamp; guy wires.
    const mx = tx + 0.8, mz = tz - 0.4, y0 = 4.2, H = 6.2, r0 = 0.45, r1 = 0.12;
    const leg = (a: number, y: number, r: number): [number, number, number] => [mx + Math.cos(a) * r, y, mz + Math.sin(a) * r];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      k.beam(m.iron, leg(a, y0, r0), leg(a, y0 + H, r1), 0.05, C.pipe);
      for (let s = 0; s < 7; s++) {
        const ya = y0 + (s * H) / 7, yb = y0 + ((s + 1) * H) / 7, ra = r0 + ((r1 - r0) * s) / 7, rb = r0 + ((r1 - r0) * (s + 1)) / 7;
        k.beam(m.iron, leg(a, ya, ra), leg(a + (PI * 2) / 3, yb, rb), 0.025, C.pipe);
      }
    }
    k.box(m.iron, mx, y0 + H - 0.6, mz, 1.6, 0.04, 0.04, C.pipe);
    k.box(m.iron, mx, y0 + H + 0.3, mz, 0.03, 0.6, 0.03, C.pipe);
    k.ball(m.enamel, mx, y0 + H + 0.62, mz, 0.12, 0.12, 0.12, C.red);
    k.sprite(mx, y0 + H + 0.62, mz, 1.3, 0xff3020, 'blink', 1);
    for (const [cx, cz] of [[tx - tw / 2, tz + td / 2], [tx + tw / 2, tz + td / 2], [tx - tw / 2, tz - td / 2]] as const) k.beam(m.iron, [mx, y0 + H * 0.7, mz], [cx, 4.15, cz], 0.012, C.dark);
    // Notes board on posts beside the tower; a cable down to the radio.
    for (const x of [-3.2, -1.9]) k.box(m.wood, x, 0.95, -0.5, 0.07, 1.9, 0.07, C.darkWood);
    k.box(m.wood, -2.55, 1.45, -0.53, 1.4, 1.0, 0.05, C.darkWood, k.face, -0.15);
    k.card('notes', -2.55, 1.45, -0.5, 1.3, 0.95, k.face, -0.15);
    k.beam(m.iron, [tx - tw / 2, 3.9, tz + 1], [-0.75, top + 0.4, 1.0], 0.015, C.dark);
  }
  if (L >= 3) {
    // Searchlight on the roof edge, screens on the map table, a sandbag wall, the flag.
    k.box(m.iron, tx - 1.1, 4.3, tz + 0.9, 0.3, 0.2, 0.3, C.dark);
    k.cyl(m.iron, tx - 1.1, 4.6, tz + 1.0, 0.25, 0.45, C.steel, { rx: PI / 2 - 0.5, seg: 12 });
    k.b.geo(m.lampGlass, new CircleGeometry(0.22, 12), k.M(tx - 1.1, 4.72, tz + 1.21, 0, -0.5), [1.6, 1.6, 1.5]);
    k.glow(tx - 1.1, 4.8, tz + 1.4, 2.6, GLOW.cold, 1);
    crt(k, -2.0, top, 0.95, 0.75, 0.25, 'crt_a', GLOW.warm);
    crt(k, -1.2, top + 0.6, 0.85, 0.6, 0.05, 'crt_g', GLOW.green);
    k.box(m.iron, -1.2, top + 0.3, 0.85, 0.36, 0.6, 0.3, C.dark);
    bagWall(k, 1.0, 2.7, 3.3, 2.7, 3);
    k.box(m.iron, tx + tw / 2 - 0.2, 5.0, tz + td / 2 - 0.2, 0.04, 1.8, 0.04, C.pipe);
    k.card('bear', tx + tw / 2 + 0.25, 5.5, tz + td / 2 - 0.2, 0.6, 0.8, 0.3);
    k.card('bear', tx + tw / 2 + 0.25, 5.5, tz + td / 2 - 0.2, 0.6, 0.8, 0.3 + PI);
  }
}

/**
 * Zeughaus: a roofless rusty freight car as smithy (the camera looks into it over the low side);
 * workbench, vise and crates; L2 forge with hood and chimney, tool wall, a hanging lamp under a pipe
 * frame; L3 anvil, weapon racks, the lit "ZEUGHAUS" sign. The open door faces the ring (local +z).
 */
function zeugCar(k: Kit, open: boolean): void {
  const m = k.m;
  const L = 9.6, Wd = 2.7, y0 = 0.95, top = 3.3;
  const hw = Wd / 2, h = top - y0, yc = (y0 + top) / 2;
  // Underframe, two bogies with wheels on the rails, buffers.
  k.box(m.iron, 0, 0.82, 0, L, 0.22, 2.2, C.dark);
  for (const bx of [-3.3, 3.3]) {
    k.box(m.iron, bx, 0.55, 0, 2.0, 0.3, 1.9, C.dark);
    for (const wx of [-0.65, 0.65]) for (const wz of [-0.72, 0.72]) k.cyl(m.iron, bx + wx, 0.45, wz, 0.42, 0.12, [0.6, 0.5, 0.45], { rx: PI / 2, seg: 14 });
  }
  for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) k.cyl(m.iron, s * (L / 2 + 0.15), 1.05, z, 0.16, 0.3, C.steel, { rz: PI / 2 });
  // Floor; walls: back (camera side, low and holed), ends, front with the door gap.
  k.box(m.wood, 0, y0 + 0.05, 0, L, 0.1, Wd, C.darkWood);
  k.box(m.rust, 0, y0 + 0.55, -hw, L, 1.1, 0.1, C.carRust);
  k.box(m.rust, -2.6, y0 + 1.5, -hw, L / 2 - 0.2, 0.9, 0.1, C.carRust);
  k.box(m.rust, 3.6, y0 + 1.5, -hw, 2.4, 0.9, 0.1, C.carRust);
  for (const s of [-1, 1]) k.box(m.rust, s * (L / 2 - 0.05), yc, 0, 0.1, h, Wd, C.carRust);
  k.box(m.rust, -3.0, yc, hw, 3.6, h, 0.1, C.carRust);
  k.box(m.rust, 3.0, yc, hw, 3.6, h, 0.1, C.carRust);
  k.box(m.rust, 0, top - 0.15, hw, 2.4, 0.3, 0.1, C.carRust);
  // Ribs on the visible side, a top rail; a tarp left over one end where the roof still is.
  for (let x = -4.4; x <= 4.41; x += 0.8) {
    k.box(m.iron, x, y0 + 0.55 + (Math.abs(x - 1.0) < 1.3 ? 0 : 0.45), -hw - 0.05, 0.08, Math.abs(x - 1.0) < 1.3 ? 1.1 : 2.0, 0.05, [1.2, 0.7, 0.6]);
    if (Math.abs(x) > 1.3) k.box(m.iron, x, yc, hw + 0.05, 0.08, h, 0.05, [1.2, 0.7, 0.6]);
  }
  for (const z of [-hw, hw]) k.box(m.iron, 0, top, z, L, 0.08, 0.14, [1.1, 0.65, 0.55]);
  for (const x of [-4.2, -3.4]) k.box(m.iron, x, top + 0.05, 0, 0.1, 0.1, Wd, C.dark);
  k.box(m.rust, -4.0, top + 0.06, 0, 1.6, 0.06, Wd + 0.1, [0.75, 0.5, 0.42], 0, 0, 0.04);
  // Stencil plate on the camera side.
  k.box(m.enamel, -3.8, y0 + 0.5, -hw - 0.06, 1.1, 0.35, 0.02, [0.9, 0.85, 0.7]);
  // Door: slid aside (open) or shut.
  k.box(m.rust, open ? 2.6 : 0, yc - 0.1, hw + 0.1, 2.4, h - 0.2, 0.06, [1.1, 0.68, 0.56]);
  k.box(m.iron, 1.0, top - 0.05, hw + 0.13, 6.0, 0.06, 0.06, C.dark);
  if (!open) return;
  k.box(m.wood, 0, 0.52, hw + 0.55, 1.2, 0.06, 1.42, C.oldWood, 0, 0.72);
}

function zeug(k: Kit, L: number): void {
  const m = k.m, hw = 1.35, y0 = 1.0;
  zeugCar(k, true);
  // Inside: the workbench with a vise along the camera-side wall, crates; a lantern.
  k.box(m.wood, -2.8, y0 + 0.85, -hw + 0.45, 2.4, 0.08, 0.7, C.darkWood);
  for (const x of [-3.9, -1.7]) k.box(m.wood, x, y0 + 0.42, -hw + 0.45, 0.1, 0.84, 0.6, C.darkWood);
  k.box(m.iron, -2.0, y0 + 1.0, -hw + 0.45, 0.3, 0.2, 0.18, [1.4, 1.3, 1.2]);
  k.box(m.iron, -2.0, y0 + 1.0, -hw + 0.65, 0.04, 0.04, 0.4, C.steel);
  k.box(m.iron, -3.2, y0 + 0.92, -hw + 0.4, 0.35, 0.05, 0.08, C.steel, 0.4);
  k.cyl(m.lampGlass, -3.6, y0 + 1.0, -hw + 0.5, 0.06, 0.18);
  k.glow(-3.6, y0 + 1.2, -hw + 0.5, 2.0, GLOW.warm, 0.9);
  crate(k, -4.1, y0, 0.6, 0.6, 0.2);
  crate(k, -3.4, y0, 0.75, 0.5, -0.3);
  // Outside: crates and a barrel at the west end, scrap at the ramp.
  crate(k, -5.7, 0, 0.9, 0.7, 0.3);
  crate(k, -5.6, 0.55, 0.9, 0.5, -0.2);
  barrel(k, -5.8, -0.6);
  barrel(k, -5.4, 1.9, [0.45, 0.55, 0.5]);
  heap(k, -1.6, 2.0, 0.45);
  board(k, 'zeug', -2.6, 3.0, -hw - 0.12, 2.3, L, { tilt: 0.3 });
  if (L >= 2) {
    // Forge in the car: brick hearth, glowing coals and mouth, hood and chimney through the open roof.
    const fx = 1.4, fz = -0.3;
    k.box(m.brick, fx, y0 + 0.45, fz, 1.2, 0.9, 0.9, [0.8, 0.6, 0.52]);
    k.box(m.coals, fx, y0 + 0.92, fz, 0.8, 0.04, 0.55);
    k.card('forge', fx, y0 + 0.5, fz - 0.46, 0.55, 0.32, PI);
    k.b.geo(m.iron, new ConeGeometry(0.75, 0.6, 4, 1, true), k.M(fx, y0 + 1.75, fz, PI / 4), C.dark);
    k.cyl(m.iron, fx, y0 + 2.9, fz, 0.13, 1.8, C.dark);
    k.box(m.wood, fx + 1.0, y0 + 0.6, fz, 0.6, 0.3, 0.5, C.darkWood, 0, 0, 0.2);
    k.sprite(fx, y0 + 1.2, fz, 1.8, 0xff7a20, 'flicker', 0.7);
    k.glow(fx, y0 + 1.3, fz - 0.8, 2.4, GLOW.fire, 0.6);
    // Tool wall on the inside of the door wall (faces the camera), a pipe frame with a lamp.
    k.card('tools', -3.0, y0 + 1.5, hw - 0.07, 2.4, 1.2, PI);
    for (const x of [-4.4, -0.4]) k.box(m.iron, x, y0 + 1.25, 0, 0.06, 2.5, 0.06, C.pipe);
    k.box(m.iron, -2.4, y0 + 2.5, 0, 4.0, 0.06, 0.06, C.pipe);
    hangLamp(k, -2.6, y0 + 1.9, 0, 0.55, C.green, GLOW.warm, 2.6);
    // Headlamps on a rack: the Stirnlampen-Werkstatt.
    for (let i = 0; i < 4; i++) k.ball(m.lampGlass, -1.2 + i * 0.16, y0 + 1.0, -hw + 0.3, 0.08, 0.08, 0.05);
  }
  if (L >= 3) {
    // Anvil on a stump, weapon racks at the east end, quench barrel, the lit sign on the car.
    k.cyl(m.wood, 3.2, y0 + 0.3, 0.2, 0.28, 0.6, C.darkWood);
    k.box(m.iron, 3.2, y0 + 0.7, 0.2, 0.6, 0.2, 0.24, [0.8, 0.8, 0.85]);
    k.b.geo(m.iron, new ConeGeometry(0.1, 0.3, 8), k.M(3.6, y0 + 0.72, 0.2, 0, 0, -PI / 2), [0.8, 0.8, 0.85]);
    for (const z of [-0.9, 0.9]) {
      k.box(m.wood, 5.6, 0.75, z, 0.08, 1.5, 0.08, C.darkWood);
      k.box(m.wood, 6.2, 0.75, z, 0.08, 1.5, 0.08, C.darkWood);
    }
    for (const y of [0.4, 1.2]) k.box(m.wood, 5.9, y, 0, 0.7, 0.06, 1.9, C.darkWood);
    for (let i = 0; i < 6; i++) {
      const z = -0.75 + i * 0.3, mat = i % 2 ? m.iron : m.wood;
      k.box(mat, 5.75, 0.75, z, 0.07, 1.45, 0.07, i % 2 ? C.steel : C.oldWood, 0, 0, -0.25);
      if (i === 2) k.box(m.iron, 5.55, 1.45, z, 0.3, 0.18, 0.05, C.steel);
    }
    barrel(k, 5.3, 2.0, [0.5, 0.5, 0.55]);
    for (const x of [-1.4, 1.4]) k.box(m.iron, x, 3.55, -0.5, 0.06, 0.5, 0.06, C.dark);
    k.card('sign_zeug', 0, 3.85, -0.5, 3.0, 0.75, k.face, -0.3);
    k.glow(0, 3.85, -0.9, 3.0, [1, 0.62, 0.25], 0.5);
  }
}

/** Hackerspace behind the shop window: CRTs on a bench, cables, a battery; L2 scrap press; L3 server rack, screen wall, antenna, neon "HACK". */
function hack(k: Kit, L: number): void {
  const m = k.m, { d } = k.s;
  const bz = 0.1;
  const top = table(k, -1.2, bz, 3.6, 0.85, 0.9, 0, [0.5, 0.42, 0.36]);
  crt(k, -2.5, top, bz - 0.05, 1, 0.15);
  crt(k, -1.5, top, bz - 0.1, 0.85, -0.1, 'crt_c', GLOW.cyan);
  // Circuit boards, a soldering lamp, a keyboard.
  for (const [x, z] of [[-0.5, 0.2], [0.05, 0.05]] as const) k.box(m.enamel, x, top + 0.02, bz + z, 0.42, 0.025, 0.3, [0.3, 0.55, 0.35], x);
  k.box(m.enamel, -2.0, top + 0.02, bz + 0.3, 0.55, 0.03, 0.18, [0.4, 0.38, 0.34]);
  k.beam(m.iron, [0.4, top, bz - 0.3], [0.2, top + 0.6, bz], 0.03, C.dark);
  k.cyl(m.lampGlass, 0.2, top + 0.58, bz + 0.05, 0.06, 0.08);
  k.glow(0.2, top + 0.5, bz + 0.1, 1.2, GLOW.warm, 0.8);
  // Crates with an old monitor; the car battery and generator; cables across the floor.
  crate(k, -4.2, 0, 0.0, 0.7, 0.15);
  crt(k, -4.2, 0.55, 0.0, 0.8, 0.35, 'crt_g', GLOW.green);
  k.box(m.iron, 1.4, 0.35, -0.6, 0.9, 0.7, 0.6, [0.6, 0.55, 0.3]);
  k.card('hazard', 1.4, 0.15, -0.29, 0.9, 0.12);
  k.box(m.iron, 1.4, 0.75, -0.6, 0.12, 0.1, 0.12, C.dark);
  const cable = (pts: Array<[number, number]>, c: RGB): void => { for (let i = 0; i < pts.length - 1; i++) k.beam(m.rubber, [pts[i]![0], 0.03, pts[i]![1]], [pts[i + 1]![0], 0.03, pts[i + 1]![1]], 0.04, c); };
  cable([[1.0, -0.4], [0.6, 0.6], [-0.2, 0.9], [-1.0, 0.5]], [3, 0.6, 0.5]);
  cable([[1.2, -0.3], [1.4, 0.7], [0.4, 1.0], [-2.2, 0.8], [-2.6, 0.4]], [0.5, 2.2, 0.8]);
  cable([[-4.0, 0.4], [-3.4, 0.9], [-2.9, 0.5]], [1, 1, 1]);
  board(k, 'hack', 2.9, 2.3, -d / 2 + 0.3, 2.2, L, { posts: true, tilt: 0.25 });
  k.glow(-2, 1.4, bz + 0.6, 3.6, GLOW.green, 0.35);
  k.sprite(-2.0, top + 0.3, bz + 0.5, 2.2, 0x50ff90, 'pulse', 0.35);
  if (L >= 2) {
    // Schrottpresse: two columns, crossbeam, a blue cylinder and ram, the bale of scrap on the bed.
    const px = 3.6, pz = 0.1;
    k.box(m.iron, px, 0.15, pz, 1.4, 0.3, 1.1, C.dark);
    k.card('hazard', px, 0.15, pz + 0.56, 1.4, 0.2);
    for (const s of [-1, 1]) k.box(m.enamel, px + s * 0.6, 1.35, pz, 0.2, 2.4, 0.3, C.yellow);
    k.box(m.enamel, px, 2.55, pz, 1.5, 0.3, 0.5, C.yellow);
    k.ball(m.lampGlass, px + 0.6, 2.8, pz + 0.1, 0.14, 0.14, 0.14);
    k.glow(px + 0.6, 2.8, pz + 0.3, 1.0, GLOW.warm, 0.9);
    k.cyl(m.enamel, px, 2.1, pz, 0.22, 0.6, C.blue);
    k.cyl(m.iron, px, 1.6, pz, 0.08, 0.5, C.steel);
    k.box(m.iron, px, 1.3, pz, 0.95, 0.12, 0.8, [0.7, 0.7, 0.7]);
    k.box(m.rust, px, 0.62, pz, 0.8, 0.62, 0.7, [1, 0.75, 0.6]);
    for (let i = 0; i < 4; i++) k.box(m.iron, px - 0.3 + i * 0.2, 0.62, pz + 0.36, 0.12, 0.55, 0.02, ([[1.5, 1.4, 1.3], [0.9, 0.3, 0.25], [0.4, 0.5, 0.7], [1.2, 1.0, 0.6]] as RGB[])[i]!);
    k.cyl(m.enamel, px + 0.62, 1.4, pz + 0.17, 0.08, 0.03, C.white, { rx: PI / 2 });
    heap(k, 2.6, 0.9, 0.4);
  }
  if (L >= 3) {
    // Server rack, a wall of screens on a shelf, an antenna mast, the neon.
    k.box(m.iron, -4.4, 1.0, -0.8, 0.7, 2.0, 0.6, C.dark);
    k.card('rack', -4.4, 1.0, -0.49, 0.62, 1.9);
    k.glow(-4.4, 1.2, -0.3, 1.8, GLOW.green, 0.5);
    k.box(m.wood, -1.2, 1.55, -d / 2 + 0.3, 3.4, 0.05, 0.45, C.darkWood);
    for (let i = 0; i < 4; i++) crt(k, -2.5 + i * 0.85, 1.58, -d / 2 + 0.3, 0.7, 0, ['crt_c', 'crt_g', 'crt_a', 'crt_g'][i]!, [GLOW.cyan, GLOW.green, GLOW.warm, GLOW.green][i]!);
    k.box(m.iron, 0.9, 2.2, -0.9, 0.06, 4.4, 0.06, C.pipe);
    for (const [y, w] of [[3.2, 1.0], [3.7, 0.7], [4.1, 0.4]] as const) k.box(m.iron, 0.9, y, -0.9, w, 0.03, 0.03, C.pipe);
    k.ball(m.enamel, 0.9, 4.42, -0.9, 0.08, 0.08, 0.08, C.red);
    k.sprite(0.9, 4.42, -0.9, 0.9, 0xff3030, 'blink', 0.9);
    k.card('neon_hack', -1.3, 2.75, -d / 2 + 0.2, 1.4, 0.52, k.face, -0.2);
    k.glow(-1.3, 2.75, -d / 2 + 0.5, 2.6, GLOW.pink, 0.8);
  }
}

/** Exerzierplatz: low sandbag walls, a dummy, targets, a chalk board; L2 more dummies, tire run, crawl net, hurdles; L3 a stand with the flag. Kept low (near the camera). */
function exer(k: Kit, L: number): void {
  const m = k.m, { w, d } = k.s;
  const hx = w / 2 - 0.35, hz = d / 2 - 0.35;
  // Sandbag walls: back and the north end; the camera end stays one row high.
  bagWall(k, -hx, -hz, hx, -hz, 3);
  bagWall(k, -hx, -hz + 0.5, -hx, hz - 1.6, 3);
  bagWall(k, hx, -hz + 0.5, hx, hz - 1.4, 1);
  const dummy = (x: number, z: number, ry: number): void => {
    k.box(m.wood, x, 0.7, z, 0.08, 1.4, 0.08, C.darkWood);
    for (const a of [0, 2.1, 4.2]) k.beam(m.wood, [x, 0.45, z], [x + Math.cos(a) * 0.45, 0, z + Math.sin(a) * 0.45], 0.06, C.darkWood);
    k.cyl(m.burlap, x, 0.95, z, 0.24, 0.65, [0.9, 0.6, 0.45], { seg: 10 });
    for (const y of [0.75, 1.15]) k.cyl(m.burlap, x, y, z, 0.25, 0.05, [1.1, 1.0, 0.8], { seg: 10 });
    k.ball(m.burlap, x, 1.42, z, 0.3, 0.3, 0.3, [0.95, 0.85, 0.65]);
    k.box(m.wood, x, 1.12, z, 0.9, 0.06, 0.06, C.darkWood, ry);
  };
  const target = (x: number, z: number, ry: number): void => {
    for (const s of [-0.3, 0.3]) k.box(m.wood, x + Math.cos(ry) * s, 0.45, z - Math.sin(ry) * s, 0.05, 0.9, 0.05, C.darkWood, ry, -0.2);
    k.card('target', x, 0.95, z, 0.85, 0.85, ry, -0.35);
  };
  dummy(-2.0, -0.3, 0.3);
  // Targets at the north end, facing the camera (south).
  const fa = k.face;
  target(-hx + 1.0, 0.6, fa);
  target(-hx + 1.0, -1.0, fa);
  // Bottles on a crate, a rope on the ground, the chalk board.
  crate(k, 1.2, -hz + 0.65, 0, 0.6, 0.1);
  for (let i = 0; i < 4; i++) k.cyl(m.lampGlass, 1.0 + i * 0.13, 0.6, -hz + 0.65, 0.035, 0.18, [0.5, 1.2, 0.6]);
  for (let i = 0; i < 10; i++) k.cyl(m.burlap, 2.6 + Math.sin(i * 0.9) * 0.25, 0.04, -1.0 + i * 0.25, 0.04, 0.27, [1.1, 1.0, 0.75], { rx: PI / 2, ry: Math.cos(i) * 0.6 });
  k.box(m.wood, 3.6, 0.55, -hz + 0.6, 1.0, 0.7, 0.06, C.darkWood, 0, -0.15);
  k.card('chalk', 3.6, 0.6, -hz + 0.64, 0.95, 0.62, 0, -0.15);
  board(k, 'exer', -hx + 1.4, 1.25, hz - 0.9, 2.0, L, { posts: true, tilt: 0.55 });
  if (L >= 2) {
    // More dummies, a tire run, a crawl net, two hurdles.
    dummy(-0.2, -1.6, -0.2);
    dummy(0.9, 0.4, 0.5);
    for (let i = 0; i < 6; i++) k.b.geo(m.rubber, new TorusGeometry(0.32, 0.11, 6, 12), k.M(-3.4 + (i % 2) * 0.7, 0.11, -2.0 + Math.floor(i / 2) * 0.75, 0, PI / 2), [1.2, 1.2, 1.2]);
    for (const [x, z] of [[1.4, 1.2], [3.4, 1.2], [1.4, 2.4], [3.4, 2.4]] as const) k.box(m.wood, x, 0.27, z, 0.06, 0.55, 0.06, C.darkWood);
    k.fence(2.4, 0.52, 1.8, 2.0, 1.2, 0, -PI / 2, [0.6, 0.55, 0.42], 0.15);
    for (const x of [-0.4, 0.4]) {
      for (const s of [-0.5, 0.5]) k.box(m.wood, x, 0.3, 2.0 + s, 0.06, 0.6, 0.06, C.darkWood);
      k.box(m.wood, x, 0.58, 2.0, 0.06, 0.08, 1.1, C.oldWood);
    }
  }
  if (L >= 3) {
    // A small two-step stand with the bear flag.
    const sx = 0.6, sz = -hz + 1.2;
    k.box(m.wood, sx, 0.2, sz, 2.6, 0.4, 0.9, C.oldWood);
    k.box(m.wood, sx, 0.45, sz - 0.3, 2.6, 0.5, 0.45, C.darkWood);
    k.box(m.iron, sx + 1.6, 1.9, sz - 0.4, 0.05, 3.8, 0.05, C.pipe);
    k.ball(m.iron, sx + 1.6, 3.82, sz - 0.4, 0.08, 0.08, 0.08, [3, 2.5, 1.4]);
    k.card('bear', sx + 1.6 + 0.42 * Math.cos(fa), 3.3, sz - 0.4 - 0.42 * Math.sin(fa), 0.8, 1.05, fa);
    k.card('bear', sx + 1.6 + 0.42 * Math.cos(fa), 3.3, sz - 0.4 - 0.42 * Math.sin(fa), 0.8, 1.05, fa + PI);
    target(-hx + 1.0, -2.6, fa);
    for (let i = 0; i < 5; i++) k.ball(m.lampGlass, -hx + 0.4, 0.62 + 0.06 * Math.sin(i), -2.4 + i * 1.0, 0.09, 0.11, 0.09);
    k.glow(-hx + 0.4, 0.9, 0, 4, GLOW.warm, 0.4);
  }
}

const BUILD: Record<StationId, (k: Kit, level: number) => void> = { markt, laz, imbiss, kom, zeug, hack, exer };

/** Keepers further from the hero than this are hidden (the camera frames about 12 m around her). */
const KEEPER_RANGE = 15;

function buildStationArt(b: Builder, s: StationSpot, st: CampStationState, art: Art): Kit {
  const k = new Kit(b, art, s, new Rng(s.id.length * 977 + Math.round(s.x * 13) + st.level));
  if (st.level === 0) {
    if (s.id === 'zeug') zeugCar(k, false);
    site(k, s.id);
  } else BUILD[s.id](k, st.level);
  return k;
}

// ---------------------------------------------------------------- keepers

interface KeeperMats { white: LitMaterial; red: LitMaterial; leather: LitMaterial; olive: LitMaterial; dark: LitMaterial; steel: LitMaterial; lens: LitMaterial; wool: LitMaterial }

/** One or two pieces per keeper so each reads at a glance (apron, coat, cap, goggles …). */
function dress(id: StationId, attach: (bone: string, o: Object3D) => void, km: KeeperMats): void {
  const mesh = (geo: BufferGeometry, mat: Material, x: number, y: number, z: number, rx = 0, rz = 0): Mesh => {
    const o = new Mesh(geo, mat);
    o.position.set(x, y, z);
    o.rotation.set(rx, 0, rz);
    return o;
  };
  const Box = (sx: number, sy: number, sz: number): BoxGeometry => new BoxGeometry(sx, sy, sz);
  const apron = (mat: Material, len = 0.62): void => attach('spine_02', mesh(Box(0.4, len, 0.05), mat, 0, -0.12 - (len - 0.62) / 2, 0.17));
  switch (id) {
    case 'zeug':
      apron(km.leather, 0.8);
      attach('Head', mesh(new CylinderGeometry(0.135, 0.135, 0.04, 14, 1, true), km.dark, 0, 0.1, 0.02));
      attach('Head', mesh(new CylinderGeometry(0.045, 0.045, 0.05, 10), km.lens, 0, 0.11, 0.15, PI / 2));
      attach('hand_r', mesh(Box(0.04, 0.04, 0.4), km.leather, 0, -0.05, 0.15));
      attach('hand_r', mesh(Box(0.14, 0.08, 0.08), km.steel, 0, -0.05, 0.34));
      break;
    case 'hack':
      attach('Head', mesh(new CylinderGeometry(0.135, 0.135, 0.035, 14, 1, true), km.dark, 0, 0.12, 0.02));
      for (const s of [-1, 1]) attach('Head', mesh(new CylinderGeometry(0.045, 0.045, 0.05, 10), km.lens, s * 0.055, 0.13, 0.14, PI / 2));
      attach('hand_r', mesh(Box(0.03, 0.03, 0.26), km.steel, 0, -0.04, 0.12));
      break;
    case 'imbiss':
      apron(km.white, 0.7);
      attach('Head', mesh(new CylinderGeometry(0.12, 0.11, 0.18, 12), km.white, 0, 0.27, 0));
      attach('Head', mesh(new SphereGeometry(0.15, 10, 6), km.white, 0, 0.37, 0));
      break;
    case 'laz': {
      apron(km.white, 0.95);
      attach('spine_02', mesh(Box(0.42, 0.95, 0.05), km.white, 0, -0.28, -0.15));
      const cap = mesh(Box(0.24, 0.08, 0.16), km.white, 0, 0.2, 0.05);
      attach('Head', cap);
      attach('spine_02', mesh(Box(0.1, 0.03, 0.02), km.red, 0.1, 0.12, 0.2));
      attach('spine_02', mesh(Box(0.03, 0.1, 0.02), km.red, 0.1, 0.12, 0.2));
      break;
    }
    case 'kom':
      attach('Head', mesh(new CylinderGeometry(0.15, 0.13, 0.09, 12), km.olive, 0, 0.21, 0));
      attach('Head', mesh(Box(0.2, 0.02, 0.12), km.dark, 0, 0.17, 0.15));
      attach('upperarm_l', mesh(new CylinderGeometry(0.06, 0.06, 0.08, 10), km.red, 0, 0.12, 0));
      attach('hand_l', mesh(Box(0.22, 0.3, 0.02), km.leather, 0, -0.1, 0.08));
      break;
    case 'markt':
      attach('Head', mesh(new SphereGeometry(0.135, 12, 6, 0, PI * 2, 0, PI / 2), km.wool, 0, 0.12, -0.01));
      attach('spine_02', mesh(Box(0.32, 0.26, 0.12), km.leather, 0.12, -0.3, 0.18));
      attach('spine_02', mesh(Box(0.04, 0.6, 0.02), km.leather, -0.02, 0.0, 0.17, 0, 0.7));
      break;
    case 'exer':
      attach('Head', mesh(new CylinderGeometry(0.14, 0.14, 0.05, 14, 1, true), km.olive, 0, 0.12, 0.01));
      for (const s of [-1, 1]) attach('spine_02', mesh(new CylinderGeometry(0.035, 0.035, 0.12, 8), km.dark, s * 0.04, 0.08, 0.2, PI / 2));
      break;
  }
}

// ---------------------------------------------------------------- view

interface Body { g: Group; anims: Anim[] }

export class CampStationsView {
  readonly group = new Group();
  private readonly mats: Mats;
  private readonly art: Art;
  private readonly km: KeeperMats;
  private readonly bodies = new Map<StationId, Body>();
  private readonly built = new Map<StationId, string>();
  private readonly keepers = new Map<StationId, { root: Group; anim: Animator }>();
  private readonly rings: Array<{ place: CampPlace; mesh: Mesh; mat: MeshBasicMaterial }> = [];
  private last = -1;

  constructor(private readonly assets: CharacterAssets, materials: Materials, private readonly layout: CampLayout) {
    this.mats = makeMats(materials);
    const atlas = paintCampAtlas(Object.fromEntries(STATIONS.map((s) => [s.id, s.name])));
    const glowTex = paintGlow('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.art = {
      atlas: materials.surface({ map: atlas.map, emissiveMap: atlas.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.7, vertexColors: true }),
      cells: atlas.cells,
      glow: new MeshBasicMaterial({ map: glowTex, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }),
      glowTex,
      chain: materials.surface({ map: paintChainLink(), alphaTest: 0.45, doubleSided: true, roughness: 0.6, metalness: 0.3, vertexColors: true }),
    };
    const S = (color: number, roughness = 0.9, emissive = 0, metalness = 0): LitMaterial => materials.surface({ color, roughness, emissive, metalness });
    this.km = { white: S(0xe8e4da), red: S(0xb8261c), leather: S(0x5a3a22), olive: S(0x5c5a34), dark: S(0x22201e), steel: S(0x9aa0a4, 0.4, 0, 0.6), lens: materials.surface({ color: 0x40280f, emissive: 0xffd890, emissiveIntensity: 2, roughness: 0.3 }), wool: S(0x7d322d) };
    for (const place of layout.places) {
      const station = layout.stations.find((s) => s.id === place.id);
      const y = (station ? floorY(station) : 0) + 0.06;
      // Johannes 2026-11-18: a footprint-sized, dim disc with a very faint rim, at the person's feet.
      const color = place.id === 'abfahrt' ? 0x5aa8c8 : 0xc08a3a;
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false });
      const mesh = new Mesh(new RingGeometry(place.r - 0.05, place.r, 32), mat);
      mesh.add(new Mesh(new CircleGeometry(place.r - 0.05, 32), new MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false })));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(place.x, y, place.z);
      this.group.add(mesh);
      this.rings.push({ place, mesh, mat });
    }
  }

  private rebuild(s: StationSpot, st: CampStationState): void {
    const old = this.bodies.get(s.id);
    if (old) {
      this.group.remove(old.g);
      old.g.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose(); });
      for (const a of old.anims) a.o.material.dispose();
    }
    const b = new Builder(this.mats);
    const k = buildStationArt(b, s, st, this.art);
    const g = new Group();
    g.position.set(s.x, floorY(s), s.z);
    g.rotation.y = s.rot;
    for (const mesh of b.solid.meshes()) { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); }
    for (const mesh of b.cards.meshes()) { mesh.layers.set(FX_LAYER); mesh.receiveShadow = true; g.add(mesh); }
    for (const mesh of k.glows.meshes()) { mesh.layers.set(FX_LAYER); mesh.renderOrder = 2; g.add(mesh); }
    for (const a of k.anims) g.add(a.o);
    g.updateMatrixWorld(true);
    this.bodies.set(s.id, { g, anims: k.anims });
    this.group.add(g);
    // The keeper: beside the front, turned to the ring.
    let keeper = this.keepers.get(s.id);
    if (st.npc && !keeper) {
      const p = npcPerson(this.assets);
      dress(s.id, p.attach, this.km);
      p.root.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
      keeper = { root: p.root, anim: p.anim };
      this.keepers.set(s.id, keeper);
      this.group.add(keeper.root);
    }
    if (keeper) {
      const [lx, lz] = s.keeper;
      const c = Math.cos(s.rot), sn = Math.sin(s.rot);
      const x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c;
      keeper.root.position.set(x, floorY(s), z);
      const ring = this.layout.places.find((p) => p.id === s.id);
      keeper.root.rotation.y = ring ? Math.atan2(ring.x - x, ring.z - z) : s.rot;
    }
  }

  /** `heroX`, `heroZ`: keepers further away are hidden (each is a full skinned person). */
  update(states: CampStates, time: number, near: CampPlace['id'] | null, heroX = 0, heroZ = 0): void {
    const dt = this.last < 0 ? 0 : Math.max(0, Math.min(0.1, time - this.last));
    this.last = time;
    for (const s of this.layout.stations) {
      const st = states[s.id];
      const key = `${st.level}/${st.npc ? 1 : 0}`;
      if (this.built.get(s.id) === key) continue;
      this.built.set(s.id, key);
      this.rebuild(s, st);
    }
    for (const [id, k] of this.keepers) {
      k.root.visible = states[id].npc && Math.hypot(k.root.position.x - heroX, k.root.position.z - heroZ) < KEEPER_RANGE;
      if (k.root.visible) k.anim.update(dt);
    }
    for (const [, body] of this.bodies) for (const a of body.anims) {
      const t = time + a.phase;
      const v = a.kind === 'blink' ? (Math.sin(t * 3) > 0.2 ? 1 : 0.08)
        : a.kind === 'flicker' ? 0.75 + 0.15 * Math.sin(t * 13) + 0.1 * Math.sin(t * 31.7)
          : 0.8 + 0.2 * Math.sin(t * 2.3) * Math.sin(t * 7.1);
      a.o.material.opacity = a.base * v;
    }
    for (const r of this.rings) {
      const on = r.place.id === near;
      r.mat.opacity = on ? 0.3 + 0.08 * Math.sin(time * 4) : 0.12;
      (r.mesh.children[0] as Mesh<CircleGeometry, MeshBasicMaterial>).material.opacity = on ? 0.3 : 0.16;
    }
  }
}
