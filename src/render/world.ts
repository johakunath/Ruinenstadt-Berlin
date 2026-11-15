// Builds the Köpenick courtyard from `src/data/courtyard.ts`: facades, Späti, props, lights.
// Everything is code-built geometry with painted textures (plan-3d.md › Style: closing the gap).
import {
  BoxGeometry, BufferAttribute, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DodecahedronGeometry, DoubleSide,
  Group, HemisphereLight, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, SphereGeometry, Vector3,
  type BufferGeometry, type Material, type Object3D,
} from 'three';
import { COURTYARD, type Facade, type Prop } from '../data/courtyard';
import { Rng } from '../sim/math';
import { BatchSet, boxGeo } from './batch';
import { Materials, type LitMaterial } from './materials';
import {
  paintAwning, paintBrick, paintCloth, paintCobbles, paintDoor, paintFern, paintGlow, paintIvy, paintMetal, paintPlaster,
  paintShopWindow, paintSign, paintStucco, paintVan, paintWindows, paintWood, type PaintOptions,
} from './paint';

/** Layer for things that must not show up in the normal/depth pre-pass (alpha cards, glows, effects). */
export const FX_LAYER = 1;

export const GROUND_H = 4.3;
export const FLOOR_H = 3.5;
export const PARAPET = 0.7;
const GATE_H = 3.7;
const SHOP_H = 3.45;

type RGB = readonly [number, number, number];

export interface FlickerLight {
  light: PointLight;
  base: number;
  /** 0 = steady lamp, 1 = fire. */
  flicker: number;
  phase: number;
}

export interface World {
  group: Group;
  moon: DirectionalLight;
  lights: FlickerLight[];
  /** Fire barrel mouths (for flames and embers). */
  fires: Vector3[];
  update(time: number): void;
  /** Big maps: moon shadow and pooled lights follow the hero. */
  follow?(x: number, z: number): void;
}

/** Local frame of a facade run: s along the wall, y up, n out into the yard. */
export class Run {
  readonly len: number;
  readonly dx: number;
  readonly dz: number;
  readonly nx: number;
  readonly nz: number;
  readonly yaw: number;

  constructor(readonly f: Facade) {
    this.len = Math.hypot(f.bx - f.ax, f.bz - f.az);
    this.dx = (f.bx - f.ax) / this.len;
    this.dz = (f.bz - f.az) / this.len;
    this.nx = -this.dz;
    this.nz = this.dx;
    this.yaw = Math.atan2(this.nx, this.nz);
  }

  pt(s: number, y: number, n: number): Vector3 {
    return new Vector3(this.f.ax + this.dx * s + this.nx * n, y, this.f.az + this.dz * s + this.nz * n);
  }

  /** Places a local box frame (X along the run, Z into the yard) at (s, y, n). */
  mat(s: number, y: number, n: number, tilt = 0, roll = 0): Matrix4 {
    const m = new Matrix4().makeRotationY(this.yaw);
    if (tilt) m.multiply(new Matrix4().makeRotationX(tilt));
    if (roll) m.multiply(new Matrix4().makeRotationZ(roll));
    return m.setPosition(this.pt(s, y, n));
  }
}

export interface Mats {
  plaster: Record<string, LitMaterial>;
  brick: LitMaterial;
  stucco: LitMaterial;
  cobbles: LitMaterial;
  windows: LitMaterial;
  shop: LitMaterial;
  sign: LitMaterial;
  door: LitMaterial;
  wood: LitMaterial;
  darkWood: LitMaterial;
  rust: LitMaterial;
  iron: LitMaterial;
  bin: LitMaterial;
  burlap: LitMaterial;
  awning: LitMaterial;
  vanSide: LitMaterial;
  vanFront: LitMaterial;
  vanRoof: LitMaterial;
  rubber: LitMaterial;
  lampGlass: LitMaterial;
  coals: LitMaterial;
  ivy: LitMaterial;
  fern: LitMaterial;
  dark: MeshBasicMaterial;
}

export function makeMats(m: Materials): Mats {
  const o: PaintOptions = { flatten: m.look.flatten, normalMaps: m.profile.normalMaps, anisotropy: m.profile.anisotropy };
  const plaster: Record<string, LitMaterial> = {};
  for (const tone of ['cream', 'ochre', 'oxblood']) {
    const s = paintPlaster(tone, o, tone.length * 7);
    plaster[tone] = m.surface({ map: s.map, normalMap: s.normalMap, roughness: 0.92, vertexColors: true });
  }
  const brick = paintBrick(o);
  const cobbles = paintCobbles(o);
  const windows = paintWindows();
  const shop = paintShopWindow();
  const sign = paintSign();
  const wood = paintWood(o);
  const rust = paintMetal('#7b4a2e', o, 31, 1.4);
  const ivyTex = paintIvy();
  return {
    plaster,
    brick: m.surface({ map: brick.map, normalMap: brick.normalMap, roughness: 0.9, vertexColors: true }),
    stucco: m.surface({ map: paintStucco(o).map, roughness: 0.85, vertexColors: true }),
    cobbles: m.surface({ map: cobbles.map, normalMap: cobbles.normalMap, roughness: 0.78, vertexColors: true }),
    windows: m.surface({ map: windows.map, emissiveMap: windows.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.35 }),
    shop: m.surface({ map: shop.map, emissiveMap: shop.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.4 }),
    sign: m.surface({ map: sign.map, emissiveMap: sign.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.6 }),
    door: m.surface({ map: paintDoor(o).map, roughness: 0.7 }),
    wood: m.surface({ map: wood.map, roughness: 0.85, vertexColors: true }),
    darkWood: m.surface({ map: wood.map, color: 0x5a4636, roughness: 0.8, vertexColors: true }),
    rust: m.surface({ map: rust.map, roughness: 0.75, metalness: 0.3, vertexColors: true }),
    iron: m.surface({ map: paintMetal('#26302c', o, 35, 0.6).map, roughness: 0.6, metalness: 0.4, vertexColors: true }),
    bin: m.surface({ map: paintMetal('#3d5550', o, 37, 0.5).map, roughness: 0.7, vertexColors: true }),
    burlap: m.surface({ map: paintCloth('#9a8560', o).map, roughness: 0.95, vertexColors: true }),
    awning: m.surface({ map: paintAwning(o).map, roughness: 0.9, doubleSided: true }),
    vanSide: m.surface({ map: paintVan('side', o).map, roughness: 0.55, metalness: 0.15 }),
    vanFront: m.surface({ map: paintVan('front', o).map, roughness: 0.55, metalness: 0.15 }),
    vanRoof: m.surface({ map: paintVan('roof', o).map, roughness: 0.6, metalness: 0.15 }),
    rubber: m.surface({ color: 0x1a1816, roughness: 0.95 }),
    lampGlass: m.surface({ color: 0x40280f, emissive: 0xffb057, emissiveIntensity: 2.6, roughness: 0.4 }),
    coals: m.surface({ color: 0x2a0d05, emissive: 0xff6a1a, emissiveIntensity: 2.5, roughness: 1 }),
    ivy: m.surface({ map: ivyTex, alphaTest: 0.5, doubleSided: true, roughness: 0.8, vertexColors: true }),
    fern: m.surface({ map: paintFern(), alphaTest: 0.5, doubleSided: true, roughness: 0.8, vertexColors: true }),
    dark: new MeshBasicMaterial({ color: 0x06090a }),
  };
}

export const UNIT_BOX = new BoxGeometry(1, 1, 1);
const tmpScale = new Matrix4();

export class Builder {
  readonly solid = new BatchSet();
  /** Alpha-tested cards: own meshes on the FX layer, no shadow casting. */
  readonly cards = new BatchSet();
  readonly lights: FlickerLight[] = [];
  readonly fires: Vector3[] = [];
  readonly extras: Object3D[] = [];
  /** Building bodies and big props, as invisible shadow casters. */
  readonly shadowBoxes: Array<{ m: Matrix4 }> = [];
  protected readonly glowTex = paintGlow('rgba(255,190,110,0.55)', 'rgba(255,170,90,0)');

  constructor(readonly mats: Mats) {}

  box(mat: Material, m: Matrix4, sx: number, sy: number, sz: number, color?: RGB, uvScale = 0.5): void {
    this.solid.of(mat).add(boxGeo(sx, sy, sz, uvScale), m, color);
  }

  geo(mat: Material, geo: BufferGeometry, m: Matrix4, color?: RGB): void {
    this.solid.of(mat).add(geo, m, color);
  }

  /** A point light plus a soft glow pool on the ground so lamps read even when the light is culled. */
  light(pos: Vector3, color: number, intensity: number, distance: number, flicker: number, pool = 4): void {
    const light = new PointLight(color, intensity, distance, 1.6);
    light.position.copy(pos);
    this.lights.push({ light, base: intensity, flicker, phase: this.lights.length * 1.7 });
    const glow = new Mesh(new PlaneGeometry(pool * 2, pool * 2), Materials.glow(this.glowTex, color, 0.22));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(pos.x, 0.03, pos.z);
    glow.layers.set(FX_LAYER);
    glow.renderOrder = 1;
    this.extras.push(glow);
  }

  shadowBox(m: Matrix4, sx: number, sy: number, sz: number): void {
    this.shadowBoxes.push({ m: m.clone().multiply(tmpScale.makeScale(sx, sy, sz)) });
  }
}

// ---------------------------------------------------------------- facades

export function wallFace(b: Builder, run: Run, mat: Material, s0: number, s1: number, y0: number, y1: number, n = 0): void {
  const tint = (y: number): RGB => {
    // Damp and dirt at the foot of the wall, slightly cooler toward the top.
    const low = Math.min(1, y / 1.8);
    return [0.5 + 0.5 * low - y * 0.008, 0.56 + 0.44 * low - y * 0.004, 0.52 + 0.48 * low];
  };
  const u0 = (s0 + run.f.seed * 1.7) / 6;
  const u1 = (s1 + run.f.seed * 1.7) / 6;
  const cuts = [y0, ...[1.8, 6].filter((y) => y > y0 && y < y1), y1];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i] as number;
    const c = cuts[i + 1] as number;
    b.solid
      .of(mat)
      .quad([run.pt(s0, a, n), run.pt(s1, a, n), run.pt(s1, c, n), run.pt(s0, c, n)], [u0, a / 6, u1, c / 6], [tint(a), tint(a), tint(c), tint(c)]);
  }
}

export function windowAt(b: Builder, run: Run, rng: Rng, s: number, y: number, w: number, h: number, litChance: number, fancy: boolean): void {
  const lit = rng.next() < litChance;
  const cell = lit ? rng.int(4) : 4 + rng.int(4);
  const cu = (cell % 4) / 4;
  const cv = cell < 4 ? 0.5 : 0;
  b.solid.of(b.mats.windows).quad([run.pt(s - w / 2, y, 0.04), run.pt(s + w / 2, y, 0.04), run.pt(s + w / 2, y + h, 0.04), run.pt(s - w / 2, y + h, 0.04)], [cu, cv, cu + 0.25, cv + 0.5]);
  const st = b.mats.stucco;
  const dirt: RGB = [0.82, 0.8, 0.76];
  b.box(st, run.mat(s - w / 2 - 0.08, y + h / 2, 0.07), 0.16, h, 0.14, dirt);
  b.box(st, run.mat(s + w / 2 + 0.08, y + h / 2, 0.07), 0.16, h, 0.14, dirt);
  b.box(st, run.mat(s, y + h + 0.11, 0.1), w + 0.5, 0.22, 0.2, dirt);
  b.box(st, run.mat(s, y - 0.06, 0.13, 0, rng.range(-0.02, 0.02)), w + 0.42, 0.12, 0.26, [0.7, 0.7, 0.66]);
  if (fancy) b.box(st, run.mat(s, y + h + 0.3, 0.14), w + 0.75, 0.14, 0.28);
}

function balcony(b: Builder, run: Run, s: number, y: number): void {
  b.box(b.mats.stucco, run.mat(s, y - 0.08, 0.5), 2.0, 0.16, 1.0, [0.7, 0.68, 0.64]);
  const iron = b.mats.iron;
  b.box(iron, run.mat(s, y + 0.95, 0.96), 2.0, 0.05, 0.05);
  b.box(iron, run.mat(s - 0.98, y + 0.95, 0.5), 0.05, 0.05, 0.95);
  b.box(iron, run.mat(s + 0.98, y + 0.95, 0.5), 0.05, 0.05, 0.95);
  for (let i = 0; i <= 8; i++) b.box(iron, run.mat(s - 0.96 + i * 0.24, y + 0.47, 0.96), 0.03, 0.95, 0.03);
}

function ivyBlob(b: Builder, run: Run, rng: Rng, cs: number, width: number, height: number, count: number): void {
  const geo = new PlaneGeometry(1, 1);
  for (let i = 0; i < count; i++) {
    const t = Math.pow(rng.next(), 1.4);
    const y = 0.2 + t * height;
    // The growth narrows toward the top.
    const s = cs + rng.range(-1, 1) * width * (1 - t * 0.6) * 0.5;
    if (s < 0.3 || s > run.len - 0.3) continue;
    const size = rng.range(0.7, 1.35);
    const g = rng.range(0.55, 1.05);
    const m = run.mat(s, y, rng.range(0.05, 0.3), rng.range(-0.35, 0.35), rng.range(0, Math.PI * 2));
    m.multiply(tmpScale.makeScale(size, size, 1));
    b.cards.of(b.mats.ivy).add(geo, m, [g * rng.range(0.8, 1.1), g, g * rng.range(0.6, 0.9)]);
  }
}

export function buildAltbau(b: Builder, f: Facade): void {
  const run = new Run(f);
  const rng = new Rng(f.seed);
  const H = GROUND_H + f.floors * FLOOR_H + PARAPET;
  const plaster = b.mats.plaster[f.tone] as LitMaterial;
  const gaps = f.features.filter((g) => g.kind === 'gate' || g.kind === 'breach');
  const shop = f.features.find((g) => g.kind === 'spati');
  const doors = f.features.filter((g) => g.kind === 'door');
  // Ground floor spans that are not plain wall.
  const cuts = [...gaps, ...(shop ? [shop] : [])].sort((a, c) => a.from - c.from);

  // --- wall face
  let at = 0;
  for (const c of cuts) {
    if (c.from > at) wallFace(b, run, plaster, at, c.from, 0, H);
    wallFace(b, run, plaster, c.from, c.to, c.kind === 'spati' ? SHOP_H : GATE_H, H);
    at = c.to;
  }
  if (at < run.len) wallFace(b, run, plaster, at, run.len, 0, H);

  // --- shadow casters and passages through the building
  at = 0;
  const body = (s0: number, s1: number, y0: number): void => {
    b.shadowBox(run.mat((s0 + s1) / 2, (y0 + H) / 2, -f.depth / 2), s1 - s0, H - y0, f.depth);
  };
  for (const g of gaps) {
    body(at, g.from, 0);
    body(g.from, g.to, GATE_H);
    at = g.to;
    const brickDark: RGB = [0.42, 0.45, 0.46];
    for (const [s, dir] of [[g.from, -1], [g.to, 1]] as Array<[number, number]>) {
      // Passage side wall, facing into the passage.
      const p = dir < 0
        ? [run.pt(s, 0, 0), run.pt(s, 0, -f.depth), run.pt(s, GATE_H, -f.depth), run.pt(s, GATE_H, 0)]
        : [run.pt(s, 0, -f.depth), run.pt(s, 0, 0), run.pt(s, GATE_H, 0), run.pt(s, GATE_H, -f.depth)];
      b.solid.of(b.mats.brick).quad(p as [Vector3, Vector3, Vector3, Vector3], [0, 0, f.depth / 2, GATE_H / 2], [brickDark]);
    }
    b.solid.of(b.mats.brick).quad([run.pt(g.from, GATE_H, 0), run.pt(g.to, GATE_H, 0), run.pt(g.to, GATE_H, -f.depth), run.pt(g.from, GATE_H, -f.depth)], [0, 0, 2, 2], [brickDark]);
    const mid = (g.from + g.to) / 2;
    const w = g.to - g.from;
    if (g.kind === 'gate') {
      // Stucco surround with a keystone and a lamp.
      b.box(b.mats.stucco, run.mat(g.from - 0.2, GATE_H / 2, 0.1), 0.45, GATE_H, 0.24);
      b.box(b.mats.stucco, run.mat(g.to + 0.2, GATE_H / 2, 0.1), 0.45, GATE_H, 0.24);
      b.box(b.mats.stucco, run.mat(mid, GATE_H + 0.22, 0.12), w + 0.9, 0.45, 0.28);
      b.box(b.mats.stucco, run.mat(mid, GATE_H + 0.3, 0.2), 0.5, 0.7, 0.3, [0.85, 0.8, 0.72]);
      b.box(b.mats.iron, run.mat(mid, GATE_H - 0.25, 0.42), 0.08, 0.08, 0.5);
      b.geo(b.mats.lampGlass, new CylinderGeometry(0.14, 0.1, 0.3, 6), run.mat(mid, GATE_H - 0.45, 0.62));
      b.light(run.pt(mid, GATE_H - 0.6, 0.9), 0xffa850, 14, 9, 0.15, 3);
    } else {
      // Breach: broken brick edges, a sagging beam.
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? g.from - rng.range(-0.1, 0.5) : g.to + rng.range(-0.1, 0.5);
        const y = rng.range(0.1, GATE_H + 0.5);
        b.box(b.mats.brick, run.mat(side, y, rng.range(-0.3, 0.12), rng.range(-0.3, 0.3), rng.range(-0.3, 0.3)), rng.range(0.3, 0.7), rng.range(0.14, 0.4), rng.range(0.25, 0.5), [0.8, 0.75, 0.72]);
      }
      for (let i = 0; i < 9; i++) {
        b.box(b.mats.brick, run.mat(rng.range(g.from, g.to), GATE_H + rng.range(-0.25, 0.3), rng.range(-0.2, 0.1), rng.range(-0.2, 0.2), rng.range(-0.25, 0.25)), rng.range(0.4, 0.9), rng.range(0.2, 0.5), 0.4, [0.75, 0.7, 0.68]);
      }
      b.box(b.mats.rust, run.mat(mid, GATE_H - 0.15, 0.05, 0, 0.09), w + 0.6, 0.22, 0.2);
    }
  }
  body(at, run.len, 0);

  // --- plinth and cornices
  at = 0;
  const plinthCuts = [...cuts, ...doors].sort((a, c) => a.from - c.from);
  for (const c of plinthCuts) {
    if (c.from > at + 0.05) b.box(b.mats.stucco, run.mat((at + c.from) / 2, 0.45, 0.04), c.from - at, 0.9, 0.12, [0.5, 0.52, 0.5]);
    at = c.to;
  }
  if (at < run.len) b.box(b.mats.stucco, run.mat((at + run.len) / 2, 0.45, 0.04), run.len - at, 0.9, 0.12, [0.5, 0.52, 0.5]);
  b.box(b.mats.stucco, run.mat(run.len / 2, GROUND_H, 0.1), run.len, 0.32, 0.24, [0.85, 0.82, 0.78]);
  for (let k = 1; k < f.floors; k++) b.box(b.mats.stucco, run.mat(run.len / 2, GROUND_H + k * FLOOR_H, 0.06), run.len, 0.18, 0.14);
  b.box(b.mats.stucco, run.mat(run.len / 2, H - 0.3, 0.16), run.len, 0.45, 0.36);

  // --- windows
  const bays = Math.floor(run.len / 2.7);
  const spacing = run.len / bays;
  for (let i = 0; i < bays; i++) {
    const s = (i + 0.5) * spacing;
    const blocked = [...cuts, ...doors].some((c) => s > c.from - 0.9 && s < c.to + 0.9);
    if (!blocked) windowAt(b, run, rng, s, 1.55, 1.15, 1.75, 0.3, false);
    for (let k = 0; k < f.floors; k++) {
      const y = GROUND_H + k * FLOOR_H + 0.95;
      windowAt(b, run, rng, s, y, 1.15, 1.95, k === 0 ? 0.38 : 0.2, k === 0);
      if (k === 0 && rng.next() < 0.28) balcony(b, run, s, y - 0.1);
    }
  }

  // --- doors
  for (const d of doors) {
    const mid = (d.from + d.to) / 2;
    const w = d.to - d.from;
    b.solid.of(b.mats.door).quad([run.pt(d.from, 0.12, 0.05), run.pt(d.to, 0.12, 0.05), run.pt(d.to, 2.75, 0.05), run.pt(d.from, 2.75, 0.05)]);
    b.box(b.mats.stucco, run.mat(d.from - 0.1, 1.4, 0.09), 0.22, 2.8, 0.18);
    b.box(b.mats.stucco, run.mat(d.to + 0.1, 1.4, 0.09), 0.22, 2.8, 0.18);
    b.box(b.mats.stucco, run.mat(mid, 2.9, 0.12), w + 0.6, 0.3, 0.26);
    b.box(b.mats.stucco, run.mat(mid, 0.06, 0.3), w + 0.5, 0.12, 0.6, [0.6, 0.6, 0.58]);
  }

  if (shop) buildSpati(b, run, shop.from, shop.to);

  // --- drain pipe and ivy
  b.geo(b.mats.rust, new CylinderGeometry(0.07, 0.07, H, 8), run.mat(0.5, H / 2, 0.1));
  const blobs = 4 + rng.int(3);
  for (let i = 0; i < blobs; i++) {
    const cs = rng.range(1, run.len - 1);
    if (shop && cs > shop.from - 0.5 && cs < shop.to + 0.5) continue;
    if (gaps.some((g) => cs > g.from - 0.8 && cs < g.to + 0.8)) continue;
    ivyBlob(b, run, rng, cs, rng.range(1.6, 4), rng.range(2.5, 8), 34 + rng.int(30));
  }
}

function buildSpati(b: Builder, run: Run, from: number, to: number): void {
  const m = b.mats;
  const w = to - from;
  const mid = (from + to) / 2;
  const sill = 0.55;
  const top = 2.45;
  // Recessed dark wood front.
  b.box(m.darkWood, run.mat(mid, SHOP_H / 2, -0.02), w, SHOP_H, 0.1);
  b.box(m.darkWood, run.mat(mid, sill / 2, 0.08), w, sill, 0.16, [0.75, 0.7, 0.66]);
  const doorW = 1.15;
  const doorFrom = from + w * 0.46;
  const winA: [number, number] = [from + 0.3, doorFrom - 0.2];
  const winB: [number, number] = [doorFrom + doorW + 0.2, to - 0.3];
  const share = (winA[1] - winA[0]) / (winA[1] - winA[0] + winB[1] - winB[0]);
  b.solid.of(m.shop).quad([run.pt(winA[0], sill, 0.06), run.pt(winA[1], sill, 0.06), run.pt(winA[1], top, 0.06), run.pt(winA[0], top, 0.06)], [0, 0, share, 1]);
  b.solid.of(m.shop).quad([run.pt(winB[0], sill, 0.06), run.pt(winB[1], sill, 0.06), run.pt(winB[1], top, 0.06), run.pt(winB[0], top, 0.06)], [share, 0, 1, 1]);
  // Glass door: a warm slice of the shop texture.
  b.solid.of(m.shop).quad([run.pt(doorFrom, 0.1, 0.05), run.pt(doorFrom + doorW, 0.1, 0.05), run.pt(doorFrom + doorW, top, 0.05), run.pt(doorFrom, top, 0.05)], [0.03, 0.06, 0.09, 0.2]);
  for (const s of [winA[0] - 0.12, winA[1] + 0.1, winB[0] - 0.1, winB[1] + 0.12]) b.box(m.darkWood, run.mat(s, (top + 0.1) / 2, 0.1), 0.2, top + 0.1, 0.2);
  b.box(m.darkWood, run.mat(mid, top + 0.08, 0.1), w, 0.16, 0.22);
  b.box(m.stucco, run.mat(doorFrom + doorW / 2, 0.05, 0.4), doorW + 0.6, 0.1, 0.7, [0.6, 0.6, 0.58]);
  // Sign board above the windows.
  b.box(m.darkWood, run.mat(mid, 3.0, 0.16), w - 0.2, 0.86, 0.12, [0.5, 0.45, 0.42]);
  b.solid.of(m.sign).quad([run.pt(from + 0.2, 2.6, 0.23), run.pt(to - 0.2, 2.6, 0.23), run.pt(to - 0.2, 3.4, 0.23), run.pt(from + 0.2, 3.4, 0.23)]);
  // Short awning under the sign, steep so it does not hide the windows from the camera.
  const a0 = [run.pt(from + 0.1, 2.52, 0.75), run.pt(to - 0.1, 2.52, 0.75), run.pt(to - 0.1, 2.62, 0.22), run.pt(from + 0.1, 2.62, 0.22)] as [Vector3, Vector3, Vector3, Vector3];
  b.solid.of(m.awning).quad(a0, [0, 0, w / 2, 1]);
  b.solid.of(m.awning).quad([run.pt(from + 0.1, 2.34, 0.76), run.pt(to - 0.1, 2.34, 0.76), run.pt(to - 0.1, 2.52, 0.75), run.pt(from + 0.1, 2.52, 0.75)], [0, 0, w / 2, 0.3]);
  // A-frame sign and crates by the door.
  const sx = doorFrom + doorW + 0.75;
  b.box(m.sign, run.mat(sx, 0.55, 1.15, -0.22), 0.7, 1.05, 0.05);
  b.box(m.darkWood, run.mat(sx, 0.5, 0.95, 0.22), 0.7, 1.0, 0.04);
  b.box(m.wood, run.mat(winA[0] + 0.5, 0.3, 0.55), 0.7, 0.6, 0.5);
  b.box(m.wood, run.mat(winA[0] + 0.55, 0.85, 0.52, 0, 0.1), 0.6, 0.45, 0.45, [0.85, 0.8, 0.75]);
  // The shop is the big warm light source of the yard.
  b.light(run.pt(mid, 2.1, 2.0), 0xffb061, 38, 15, 0.06, 6.5);
  b.light(run.pt(to - 1.3, 1.6, 1.0), 0x8fe0d8, 10, 6, 0.05, 2);
}

function buildYardWall(b: Builder, f: Facade): void {
  const run = new Run(f);
  const rng = new Rng(f.seed);
  const gaps = f.features.filter((g) => g.kind === 'gate');
  const H = 0.85;
  let at = 0;
  const segment = (s0: number, s1: number): void => {
    const len = s1 - s0;
    b.box(b.mats.brick, run.mat((s0 + s1) / 2, H / 2, -0.22), len, H, 0.45, [0.9, 0.86, 0.84]);
    b.box(b.mats.stucco, run.mat((s0 + s1) / 2, H + 0.05, -0.22), len, 0.1, 0.55, [0.7, 0.7, 0.68]);
    // Iron fence on top: thin bars the camera can see through.
    const bars = Math.floor(len / 0.32);
    for (let i = 0; i <= bars; i++) {
      if (rng.next() < 0.12) continue;
      const lean = rng.next() < 0.1 ? rng.range(-0.3, 0.3) : 0;
      b.box(b.mats.iron, run.mat(s0 + (i * len) / bars, H + 0.6, -0.22, 0, lean), 0.035, 1.05, 0.035);
    }
    b.box(b.mats.iron, run.mat((s0 + s1) / 2, H + 1.0, -0.22), len, 0.05, 0.05);
    b.box(b.mats.iron, run.mat((s0 + s1) / 2, H + 0.25, -0.22), len, 0.05, 0.05);
    b.shadowBox(run.mat((s0 + s1) / 2, H / 2, -0.22), len, H, 0.45);
  };
  for (const g of gaps) {
    segment(at, g.from);
    at = g.to;
    for (const s of [g.from, g.to]) {
      b.box(b.mats.brick, run.mat(s, 1.15, -0.22), 0.65, 2.3, 0.65);
      b.box(b.mats.stucco, run.mat(s, 2.38, -0.22), 0.8, 0.16, 0.8);
      b.geo(b.mats.stucco, new SphereGeometry(0.2, 10, 8), run.mat(s, 2.62, -0.22));
    }
    // Gate leaves swung open into the yard.
    for (const [s, sign] of [[g.from + 0.3, -1], [g.to - 0.3, 1]] as Array<[number, number]>) {
      const leaf = run.mat(s, 0, 0).multiply(new Matrix4().makeRotationY(sign * 1.25));
      for (let i = 0; i < 7; i++) {
        b.box(b.mats.iron, leaf.clone().multiply(new Matrix4().makeTranslation(-sign * (0.15 + i * 0.25), 1.0, 0)), 0.04, 1.9, 0.04);
      }
      for (const y of [0.25, 1.1, 1.9]) b.box(b.mats.iron, leaf.clone().multiply(new Matrix4().makeTranslation(-sign * 0.9, y, 0)), 1.7, 0.06, 0.05);
    }
  }
  segment(at, run.len);
  ivyBlob(b, run, rng, 4, 5, 1.6, 40);
  ivyBlob(b, run, rng, 19, 6, 1.8, 50);
}

// ---------------------------------------------------------------- props

function at(p: Prop, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Matrix4 {
  const m = new Matrix4().makeRotationY(p.rot).setPosition(p.x, 0, p.z);
  const local = new Matrix4().makeRotationY(ry);
  if (rx) local.multiply(new Matrix4().makeRotationX(rx));
  if (rz) local.multiply(new Matrix4().makeRotationZ(rz));
  local.setPosition(x, y, z);
  return m.multiply(local);
}

export function buildProp(b: Builder, p: Prop, rng: Rng): void {
  const m = b.mats;
  switch (p.kind) {
    case 'fireBarrel': {
      b.geo(m.rust, new CylinderGeometry(0.4, 0.37, 0.95, 14, 1, true), at(p, 0, 0.475, 0));
      for (const y of [0.3, 0.66]) b.geo(m.rust, new CylinderGeometry(0.415, 0.415, 0.05, 14, 1, true), at(p, 0, y, 0), [0.7, 0.65, 0.6]);
      b.geo(m.coals, new CircleGeometry(0.38, 14), at(p, 0, 0.8, 0, -Math.PI / 2));
      b.fires.push(new Vector3(p.x, 0.85, p.z));
      b.light(new Vector3(p.x, 1.6, p.z), 0xff8a3c, 32, 14, 1, 5.5);
      b.shadowBox(at(p, 0, 0.475, 0), 0.7, 0.95, 0.7);
      break;
    }
    case 'lantern': {
      b.geo(m.iron, new CylinderGeometry(0.16, 0.2, 0.55, 8), at(p, 0, 0.275, 0));
      b.geo(m.iron, new CylinderGeometry(0.06, 0.08, 2.5, 8), at(p, 0, 1.75, 0));
      b.geo(m.iron, new CylinderGeometry(0.2, 0.08, 0.14, 6), at(p, 0, 3.02, 0));
      b.geo(m.lampGlass, new CylinderGeometry(0.24, 0.17, 0.42, 6), at(p, 0, 3.3, 0));
      b.geo(m.iron, new ConeGeometry(0.32, 0.26, 6), at(p, 0, 3.64, 0));
      b.geo(m.iron, new SphereGeometry(0.05, 6, 5), at(p, 0, 3.8, 0));
      b.light(new Vector3(p.x, 3.25, p.z), 0xffb060, 34, 13, 0.08, 5);
      b.shadowBox(at(p, 0, 1.6, 0), 0.14, 3.2, 0.14);
      break;
    }
    case 'van': {
      // Body sunk on flat tires, nose down.
      const tilt = at(p, 0, 0, 0, 0.025, 0, 0.03);
      const part = (x: number, y: number, z: number): Matrix4 => tilt.clone().multiply(new Matrix4().makeTranslation(x, y, z));
      const side = new PlaneGeometry(5.5, 2.25);
      b.geo(m.vanSide, side, part(1.1, 1.42, 0).multiply(new Matrix4().makeRotationY(Math.PI / 2)));
      b.geo(m.vanSide, side, part(-1.1, 1.42, 0).multiply(new Matrix4().makeRotationY(-Math.PI / 2)));
      const end = new PlaneGeometry(2.2, 2.25);
      b.geo(m.vanFront, end, part(0, 1.42, 2.75));
      b.geo(m.vanFront, end, part(0, 1.42, -2.75).multiply(new Matrix4().makeRotationY(Math.PI)));
      b.geo(m.vanRoof, new PlaneGeometry(2.2, 5.5), part(0, 2.545, 0).multiply(new Matrix4().makeRotationX(-Math.PI / 2)));
      b.box(m.rubber, part(0, 0.28, 0), 2.1, 0.3, 5.3);
      b.box(m.iron, part(0, 0.42, 2.82), 2.3, 0.22, 0.16);
      b.box(m.iron, part(0, 0.42, -2.82), 2.3, 0.22, 0.16);
      const wheel = new CylinderGeometry(0.42, 0.42, 0.28, 12);
      for (const [x, z] of [[1.0, 1.75], [-1.0, 1.75], [1.0, -1.75], [-1.0, -1.75]] as Array<[number, number]>) {
        b.geo(m.rubber, wheel, part(x, 0.36, z).multiply(new Matrix4().makeRotationZ(Math.PI / 2)));
      }
      b.shadowBox(part(0, 1.3, 0), 2.2, 2.5, 5.5);
      const ivyGeo = new PlaneGeometry(1, 1);
      for (let i = 0; i < 12; i++) {
        const g = rng.range(0.6, 1);
        b.cards.of(m.ivy).add(ivyGeo, part(rng.range(-1.0, 1.0), 2.6 + rng.range(-0.02, 0.1), rng.range(-2.7, -0.9)).multiply(new Matrix4().makeRotationX(-Math.PI / 2 + rng.range(-0.4, 0.4))).multiply(tmpScale.makeScale(1.1, 1.1, 1)), [g * 0.9, g, g * 0.7]);
      }
      for (let i = 0; i < 18; i++) {
        const g = rng.range(0.6, 1);
        const sideX = rng.next() < 0.5 ? 1.14 : -1.14;
        b.cards.of(m.ivy).add(ivyGeo, part(sideX, rng.range(1.4, 2.6), rng.range(-2.7, -0.8)).multiply(new Matrix4().makeRotationY(sideX > 0 ? Math.PI / 2 : -Math.PI / 2)).multiply(tmpScale.makeScale(1, 1, 1)), [g * 0.9, g, g * 0.7]);
      }
      break;
    }
    case 'sandbags': {
      const bag = new SphereGeometry(0.5, 10, 7);
      const rows: Array<[number, number]> = [[4, 0.14], [3, 0.4], [2, 0.66]];
      for (const [count, y] of rows) {
        for (let i = 0; i < count; i++) {
          const x = (i - (count - 1) / 2) * 0.52 + rng.range(-0.04, 0.04);
          const g = rng.range(0.75, 1.05);
          b.geo(m.burlap, bag, at(p, x, y, rng.range(-0.06, 0.06), 0, rng.range(-0.25, 0.25)).multiply(tmpScale.makeScale(0.56, 0.3, 0.78)), [g, g, g]);
        }
      }
      b.shadowBox(at(p, 0, 0.35, 0), 2.0, 0.7, 0.8);
      break;
    }
    case 'crates': {
      b.box(m.wood, at(p, -0.32, 0.36, 0, 0, 0.1), 0.72, 0.72, 0.72);
      b.box(m.wood, at(p, 0.4, 0.3, 0.1, 0, -0.2), 0.6, 0.6, 0.6, [0.85, 0.82, 0.78]);
      b.box(m.wood, at(p, -0.25, 0.97, 0.02, 0, 0.5), 0.5, 0.5, 0.5, [0.95, 0.9, 0.82]);
      b.shadowBox(at(p, 0, 0.5, 0), 1.4, 1.0, 1.0);
      break;
    }
    case 'bins': {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.8;
        const fallen = i === 2;
        const base = fallen ? at(p, x + 0.2, 0.36, 0.5, Math.PI / 2 - 0.1, 0.3) : at(p, x, 0, 0, 0, rng.range(-0.15, 0.15));
        const part = (y: number, z = 0): Matrix4 => base.clone().multiply(new Matrix4().makeTranslation(0, y, z));
        b.box(m.bin, part(0.55), 0.62, 1.05, 0.72, i === 1 ? [1.2, 0.9, 0.5] : [1, 1, 1]);
        b.box(m.bin, part(1.11, fallen ? 0.1 : 0).multiply(new Matrix4().makeRotationX(fallen ? -0.5 : -0.06)), 0.68, 0.07, 0.8, [0.7, 0.7, 0.7]);
      }
      b.shadowBox(at(p, -0.4, 0.55, 0), 1.6, 1.1, 0.75);
      break;
    }
    case 'rubble': {
      const chunk = new DodecahedronGeometry(0.5, 0);
      const n = Math.round(22 * p.size);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2);
        const r = Math.sqrt(rng.next()) * p.size * 1.15;
        const hgt = Math.max(0, 1 - r / (p.size * 1.15)) * p.size * 0.75;
        const g = rng.range(0.6, 1);
        if (rng.next() < 0.55) {
          b.box(m.brick, at(p, Math.cos(a) * r, 0.1 + hgt * rng.range(0.3, 1), Math.sin(a) * r, rng.range(-0.6, 0.6), rng.range(0, 3), rng.range(-0.6, 0.6)), rng.range(0.25, 0.6), rng.range(0.12, 0.3), rng.range(0.2, 0.4), [g, g * 0.95, g * 0.9]);
        } else {
          const s = rng.range(0.3, 0.75);
          b.geo(m.stucco, chunk, at(p, Math.cos(a) * r, 0.12 + hgt * rng.range(0.3, 0.9), Math.sin(a) * r, rng.range(0, 3), rng.range(0, 3)).multiply(tmpScale.makeScale(s, s * 0.6, s)), [g * 0.75, g * 0.75, g * 0.72]);
        }
      }
      break;
    }
    case 'planks': {
      for (let i = 0; i < 5; i++) {
        const g = rng.range(0.7, 1.05);
        b.box(m.wood, at(p, (i - 2) * 0.27 + rng.range(-0.03, 0.03), 1.25, 0.32 + rng.range(-0.05, 0.05), -0.2 + rng.range(-0.04, 0.04), 0, rng.range(-0.05, 0.05)), 0.22, rng.range(2.2, 2.9), 0.05, [g, g, g]);
      }
      break;
    }
    case 'car': {
      // Abandoned saloon (generic boxy East German shape): body, cabin, dark windows, flat tires.
      const tint = rng.pick([[1.7, 0.75, 0.6], [0.8, 1.05, 1.5], [1.6, 1.45, 1.1], [0.9, 1.3, 0.85], [1.3, 1.3, 1.3]] as Array<[number, number, number]>);
      const tilt = at(p, 0, 0, 0, rng.range(-0.03, 0.03), 0, rng.range(-0.04, 0.04));
      const part = (x: number, y: number, z: number): Matrix4 => tilt.clone().multiply(new Matrix4().makeTranslation(x, y, z));
      b.box(m.iron, part(0, 0.62, 0), 1.7, 0.62, 4.0, tint);
      b.box(m.iron, part(0, 1.18, -0.25), 1.48, 0.52, 2.0, [tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9]);
      b.box(m.rubber, part(0, 1.2, -0.25), 1.52, 0.36, 1.7, [0.35, 0.4, 0.42]);
      b.box(m.rubber, part(0, 0.36, 2.02), 1.6, 0.18, 0.1);
      b.box(m.rubber, part(0, 0.36, -2.02), 1.6, 0.18, 0.1);
      const wheel = new CylinderGeometry(0.3, 0.3, 0.2, 10);
      for (const [x, z] of [[0.78, 1.3], [-0.78, 1.3], [0.78, -1.3], [-0.78, -1.3]] as Array<[number, number]>) {
        b.geo(m.rubber, wheel, part(x, 0.26, z).multiply(new Matrix4().makeRotationZ(Math.PI / 2)));
      }
      b.shadowBox(part(0, 0.8, 0), 1.7, 1.4, 4.0);
      break;
    }
    case 'bollard': {
      b.geo(m.iron, new CylinderGeometry(0.11, 0.13, 0.9, 8), at(p, 0, 0.45, 0), [0.8, 0.8, 0.8]);
      b.geo(m.iron, new CylinderGeometry(0.13, 0.13, 0.08, 8), at(p, 0, 0.72, 0), [1.6, 1.5, 1.2]);
      break;
    }
    case 'fence': {
      // Garden fence: posts and two rails, wooden pickets.
      const L = p.size;
      for (let x = -L / 2; x <= L / 2 + 1e-3; x += Math.max(1, L / Math.ceil(L / 2))) b.box(m.wood, at(p, x, 0.5, 0), 0.1, 1.0, 0.1, [0.6, 0.55, 0.5]);
      for (const y of [0.3, 0.8]) b.box(m.wood, at(p, 0, y, 0), L, 0.07, 0.05, [0.75, 0.7, 0.62]);
      for (let x = -L / 2 + 0.15; x < L / 2; x += 0.3) if (rng.next() > 0.12) b.box(m.wood, at(p, x, 0.5, 0.04, 0, 0, rng.range(-0.06, 0.06)), 0.08, rng.range(0.85, 1.0), 0.03, [0.85, 0.8, 0.7]);
      break;
    }
    case 'bench': {
      b.box(m.wood, at(p, 0, 0.46, 0), 1.7, 0.07, 0.5);
      b.box(m.wood, at(p, 0, 0.75, -0.24, -0.15), 1.7, 0.4, 0.05, [0.9, 0.85, 0.8]);
      for (const x of [-0.7, 0.7]) b.box(m.iron, at(p, x, 0.23, 0), 0.07, 0.46, 0.45);
      break;
    }
  }
}

function buildGround(b: Builder): Mesh {
  const B = COURTYARD.bounds;
  const w = B.maxX - B.minX + 16;
  const d = B.maxZ - B.minZ + 16;
  const geo = new PlaneGeometry(w, d, 60, 52);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const colors = new Float32Array(pos.count * 3);
  const Y = COURTYARD.yard;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, x / 6.5, z / 6.5);
    // Broad dirt patches plus damp darkness along the walls.
    const n = 0.5 + 0.5 * Math.sin(x * 0.55 + Math.sin(z * 0.4) * 1.7) * Math.cos(z * 0.5 + Math.sin(x * 0.3) * 1.3);
    const edge = Math.min(x - Y.minX, Y.maxX - x, z - Y.minZ, Y.maxZ - z);
    const wall = Math.max(0, Math.min(1, edge / 2.2));
    const v = (0.72 + 0.34 * n) * (0.55 + 0.45 * wall);
    colors.set([v, v * (0.97 + 0.06 * n), v * (0.93 + 0.1 * (1 - n))], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  const mesh = new Mesh(geo, b.mats.cobbles);
  mesh.receiveShadow = true;
  return mesh;
}

function buildGreens(b: Builder): void {
  const rng = new Rng(202);
  const Y = COURTYARD.yard;
  const geo = new PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const tuft = (x: number, z: number, s: number): void => {
    const g = rng.range(0.6, 1.05);
    const yaw = rng.range(0, Math.PI);
    for (const r of [0, Math.PI / 2]) {
      b.cards.of(b.mats.fern).add(geo, new Matrix4().makeRotationY(yaw + r).setPosition(x, 0, z).multiply(tmpScale.makeScale(s * 1.3, s, 1)), [g * 0.9, g, g * 0.75]);
    }
  };
  // Along the walls, thicker in corners; a few in the open where stones are missing.
  for (let i = 0; i < 90; i++) {
    const side = rng.int(4);
    const t = rng.next();
    const inset = rng.range(0.25, 1.1);
    const x = side === 0 ? Y.minX + inset : side === 1 ? Y.maxX - inset : Y.minX + t * (Y.maxX - Y.minX);
    const z = side === 2 ? Y.minZ + inset : side === 3 ? Y.maxZ - inset : Y.minZ + t * (Y.maxZ - Y.minZ);
    // Keep the Späti front and the passages clear.
    if (z < Y.minZ + 1.4 && x > -9.8 && x < -1.4) continue;
    if (COURTYARD.spawns.some((s) => Math.hypot(s.x - x, s.z - z) < 4.2)) continue;
    tuft(x, z, rng.range(0.5, 1.15));
  }
  for (const p of COURTYARD.props) {
    if (p.kind !== 'van' && p.kind !== 'rubble' && p.kind !== 'lantern') continue;
    const n = p.kind === 'van' ? 16 : 5;
    const r = p.kind === 'van' ? 3 : p.kind === 'rubble' ? p.size * 1.2 : 0.5;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      tuft(p.x + Math.cos(a) * r * rng.range(0.8, 1.1), p.z + Math.sin(a) * r * rng.range(0.6, 1.1), rng.range(0.45, 0.9));
    }
  }
}

function buildPuddles(b: Builder, materials: Materials): void {
  const rng = new Rng(303);
  const mat = materials.surface({ color: 0x0e1a1c, roughness: 0.6, metalness: 0 });
  mat.transparent = true;
  mat.opacity = 0.42;
  mat.depthWrite = false;
  const spots: Array<[number, number, number]> = [[2.6, 0.4, 1.5], [-3.4, 0.2, 1.1], [5.5, -3.6, 1.3], [-7.5, -3.2, 1.0], [0.6, 5.2, 1.2], [8.2, 2.6, 0.9], [-1.5, -5.6, 0.8]];
  for (const [x, z, r] of spots) {
    const geo = new CircleGeometry(r, 18);
    const pos = geo.getAttribute('position');
    for (let i = 1; i < pos.count; i++) pos.setXY(i, pos.getX(i) * rng.range(0.75, 1.15), pos.getY(i) * rng.range(0.6, 1.0));
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rng.range(0, 3);
    mesh.position.set(x, 0.012, z);
    mesh.layers.set(FX_LAYER);
    mesh.receiveShadow = true;
    b.extras.push(mesh);
  }
}

// ---------------------------------------------------------------- assembly

export function buildWorld(materials: Materials): World {
  const mats = makeMats(materials);
  const b = new Builder(mats);
  const group = new Group();
  group.name = 'courtyard';

  for (const f of COURTYARD.facades) {
    if (f.style === 'altbau') buildAltbau(b, f);
    else buildYardWall(b, f);
  }
  const rng = new Rng(404);
  for (const p of COURTYARD.props) buildProp(b, p, rng);
  buildGreens(b);
  buildPuddles(b, materials);
  group.add(buildGround(b));

  for (const mesh of b.solid.meshes()) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const mesh of b.cards.meshes()) {
    mesh.layers.set(FX_LAYER);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Invisible shadow casters for building bodies (the wall faces are single-sided).
  const caster = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const s of b.shadowBoxes) {
    const mesh = new Mesh(UNIT_BOX, caster);
    mesh.applyMatrix4(s.m);
    mesh.castShadow = true;
    mesh.layers.set(FX_LAYER);
    group.add(mesh);
  }
  for (const o of b.extras) group.add(o);

  // --- light: cool moon and teal fill against the warm lamps (style bible › Light).
  const hemi = new HemisphereLight(0x6fb0ae, 0x1f1c18, 0.75);
  group.add(hemi);
  const moon = new DirectionalLight(0xa8dde2, 1.9);
  moon.position.set(-11, 24, 12);
  moon.target.position.set(1, 0, -1);
  moon.castShadow = true;
  const size = materials.profile.shadowMap;
  moon.shadow.mapSize.set(size, size);
  const cam = moon.shadow.camera;
  cam.left = -19;
  cam.right = 19;
  cam.top = 17;
  cam.bottom = -17;
  cam.near = 4;
  cam.far = 60;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.04;
  group.add(moon, moon.target);

  // Lights sorted by importance; the profile caps how many are real.
  b.lights.sort((a, c) => c.base * (1 + c.flicker) - a.base * (1 + a.flicker));
  // One slot is kept for the hero's fill light (see GameRenderer).
  const lights = b.lights.slice(0, materials.profile.maxPointLights - 1);
  for (const l of lights) group.add(l.light);

  // The far ends of the passages fade into darkness.
  for (const s of COURTYARD.spawns) {
    const veil = new Mesh(new PlaneGeometry(7, 5), new MeshBasicMaterial({ color: new Color(0x070d0e), transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }));
    const out = Math.abs(s.x) > Math.abs(s.z) * 1.2 ? new Vector3(Math.sign(s.x), 0, 0) : new Vector3(0, 0, Math.sign(s.z));
    if (out.z > 0) continue; // The south gate is behind the camera.
    veil.position.set(s.x + out.x * 2.6, 2.4, s.z + out.z * 2.6);
    veil.lookAt(s.x, 2.4, s.z);
    veil.layers.set(FX_LAYER);
    group.add(veil);
  }

  return {
    group,
    moon,
    lights,
    fires: b.fires,
    update(time: number): void {
      for (const l of lights) {
        if (l.flicker <= 0) continue;
        const f = 0.5 * Math.sin(time * 11 + l.phase) + 0.3 * Math.sin(time * 23.7 + l.phase * 2) + 0.2 * Math.sin(time * 47.3 + l.phase * 3);
        l.light.intensity = l.base * (1 + f * 0.22 * l.flicker);
      }
    },
  };
}
