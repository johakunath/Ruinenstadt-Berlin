// M15 Mitte (2089) in code: the Mitte landmarks and, from step 3 on, the neon street dressing. Colliders
// live in `src/data/map.ts` (`OPEN_PARTS` for the Tor and the Sony Center); this only draws.
// Step 2 (blockout): every kind has a massing model in its real proportions (compressed about 0.75) and the
// 2D colours of `js/mitte.js`, so the map plays and reads. Step 4 replaces them kind by kind with builders
// from photos (`mitte-north.ts`, `mitte-south.ts`, `mitte-kultur.ts`); `buildMitteLandmark` asks those first.
//
// Cost: merged per material into the chunk batches of `map-world.ts`. New materials (one draw call each in
// the chunks that use them): sandstone, curtain glass, gold panels. No lights in the blockout.
import { ConeGeometry, CylinderGeometry, Matrix4, SphereGeometry, type BufferGeometry } from 'three';
import { OPEN_PARTS, type Landmark, type LandmarkKind, type MapDef } from '../data/map';
import { Materials, type LitMaterial } from './materials';
import type { PaintOptions } from './paint';
import { paintCurtain, paintGoldPanels, paintSandstone } from './mitte-paint';
import { lm, type ChunkBuilder, type MapMats } from './map-world';
import { buildNorth } from './mitte-north';
import { buildSouth } from './mitte-south';
import { buildKultur } from './mitte-kultur';

export type RGB = readonly [number, number, number];

export const MITTE_KINDS = new Set<LandmarkKind>([
  'ubahn', 'tor', 'mauerstuecke', 'lafayette', 'reichstag', 'bundesbau', 'kanzleramt', 'siegessaeule', 'sony', 'stage', 'bahntower',
  'kollhoff', 'verkehrsturm', 'klinik', 'philharmonie', 'matthaeus', 'stabi', 'nng', 'checkpoint',
]);

/** Mitte materials, made once per map build (`mitteMats`) and hung on `MapMats.mitte`. */
export interface MitteMats {
  /** For builders that need a material of their own (cache it per `Materials`). */
  materials: Materials;
  /** Sandstone ashlar (2D Reichstag `#b8ac94`, Tor `#d8c8a0`), tinted per vertex. */
  sandstone: LitMaterial;
  /** Glass curtain wall with mullions and a few lit offices (uv: one tile = 4 bays × 4 floors). */
  curtain: LitMaterial;
  /** Gold aluminium panels (Philharmonie `#d8a838`, Staatsbibliothek). */
  gold: LitMaterial;
}

export function mitteMats(materials: Materials): MitteMats {
  const o: PaintOptions = { flatten: materials.look.flatten, normalMaps: materials.profile.normalMaps, anisotropy: materials.profile.anisotropy };
  const cw = paintCurtain();
  return {
    materials,
    sandstone: materials.surface({ map: paintSandstone(o).map, roughness: 0.9, vertexColors: true }),
    curtain: materials.surface({ map: cw.map, emissiveMap: cw.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.5, vertexColors: true }),
    gold: materials.surface({ map: paintGoldPanels(o).map, roughness: 0.45, metalness: 0.55, vertexColors: true }),
  };
}

/** What a Mitte landmark builder gets. */
export interface MCtx {
  b: ChunkBuilder;
  M: MapMats;
  N: MitteMats;
}

/** 2D colours (`js/mitte.js`) as vertex tints on the light base materials. */
export const MC = {
  reichstag: [0.78, 0.73, 0.62], tor: [0.92, 0.85, 0.68], quadriga: [0.3, 0.45, 0.38], white: [0.95, 0.94, 0.9], granite: [0.42, 0.2, 0.18],
  gold: [1.15, 0.92, 0.45], brick: [0.55, 0.26, 0.2], glass: [0.85, 0.92, 1], steel: [0.32, 0.34, 0.38], green: [0.25, 0.45, 0.32],
  concrete: [0.72, 0.72, 0.7], magenta: [1, 0.31, 0.64], cyan: [0.26, 0.82, 0.81],
} satisfies Record<string, RGB>;

const geos = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geos.get(key);
  if (!g) geos.set(key, (g = make()));
  return g;
}

/** Box standing on local y `y` (bottom), centred at local (x, z). */
function block(c: MCtx, l: Landmark, mat: LitMaterial, x: number, y: number, z: number, w: number, h: number, d: number, tint?: RGB, ry = 0): void {
  c.b.box(mat, lm(l, x, y + h / 2, z, ry), w, h, d, tint);
}

function cylinder(c: MCtx, l: Landmark, mat: LitMaterial, x: number, y: number, z: number, r: number, h: number, tint?: RGB, seg = 16): void {
  c.b.geo(mat, cached(`cy${r.toFixed(2)},${h.toFixed(2)},${seg}`, () => new CylinderGeometry(r, r, h, seg)), lm(l, x, y + h / 2, z), tint);
}

// ---------------------------------------------------------------- blockout massing (step 2)

/** Massing model of a kind; step 4 builders replace these. Heights compressed about 0.75. */
function massing(c: MCtx, l: Landmark): void {
  const { M, N } = c, W = l.hx * 2, D = l.hz * 2;
  switch (l.kind) {
    case 'tor': {
      // Six column walls (the five passages stay open, `OPEN_PARTS.tor`), gate houses, attic, Quadriga.
      for (const p of OPEN_PARTS.tor ?? []) block(c, l, N.sandstone, p.x, 0, p.z, p.hx * 2, Math.abs(p.x) > 20 ? 8 : 15, p.hz * 2, MC.tor);
      block(c, l, N.sandstone, 0, 15, 0, 36.4, 4.2, 9, MC.tor);
      block(c, l, N.sandstone, 0, 19.2, 0, 12, 1.6, 6, MC.tor);
      block(c, l, M.iron, 0, 20.8, 0, 4.5, 3.2, 2.5, MC.quadriga);
      return;
    }
    case 'sony': {
      // Six ring blocks (gaps at 30°, 90° … 330°, `OPEN_PARTS.sony`) and the tent roof high above the forum.
      for (const p of OPEN_PARTS.sony ?? []) c.b.box(N.curtain, lm(l, p.x, 11, p.z, p.rot), p.hx * 2, 22, p.hz * 2, MC.glass);
      c.b.geo(M.tarp, cached('sony-tent', () => new ConeGeometry(27, 7, 12, 1, true)), lm(l, 0, 31.5, 0), MC.magenta);
      cylinder(c, l, M.iron, 0, 22, 0, 0.5, 13, MC.steel, 6);
      return;
    }
    case 'stage':
      block(c, l, M.darkWood, 0, 0, 0, W, 1.2, D, [0.5, 0.45, 0.45]);
      for (const x of [-4.6, 4.6]) block(c, l, M.iron, x, 1.2, -0.6, 2, 3.6, 1.6, [0.2, 0.2, 0.22]);
      return;
    case 'reichstag': {
      // Front (portico) to local +z = west in the data. Four corner towers, glass dome.
      block(c, l, N.sandstone, 0, 0, 0, W - 4, 19, D - 4, MC.reichstag);
      for (const x of [-1, 1]) for (const z of [-1, 1]) block(c, l, N.sandstone, x * (l.hx - 3.5), 0, z * (l.hz - 3.5), 7, 24, 7, MC.reichstag);
      block(c, l, N.sandstone, 0, 0, l.hz - 2.5, 16, 15, 5, MC.reichstag);
      c.b.geo(N.curtain, cached('rt-dome', () => new SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), lm(l, 0, 19, 0), MC.glass);
      return;
    }
    case 'bundesbau': {
      const v = l.variant ?? 0;
      if (v === 0) block(c, l, N.sandstone, 0, 0, 0, W, 17, D, [0.85, 0.82, 0.76]);
      else {
        block(c, l, M.concrete, 0, 0, 0, W, 18, D, MC.concrete);
        block(c, l, N.curtain, 0, 0.5, l.hz - 0.4, W - 4, 16, 0.4, MC.glass);
      }
      return;
    }
    case 'kanzleramt':
      // White cube in the middle, low office wings to both sides (along local z).
      block(c, l, M.stucco, 0, 0, 0, 11, 26, 11, MC.white);
      block(c, l, M.stucco, 0, 0, 0, W, 10, D, MC.white);
      return;
    case 'siegessaeule':
      // Red granite plinth, column hall, column with three gilded rings, Victoria (2D colours).
      block(c, l, M.stucco, 0, 0, 0, W, 6, D, MC.granite);
      cylinder(c, l, M.stucco, 0, 6, 0, 3.6, 4.5, [0.8, 0.76, 0.66], 12);
      cylinder(c, l, N.sandstone, 0, 10.5, 0, 1.7, 30, [0.86, 0.8, 0.66], 12);
      for (const y of [17, 24, 31]) cylinder(c, l, N.gold, 0, y, 0, 1.95, 1.2, MC.gold, 12);
      block(c, l, N.gold, 0, 40.5, 0, 1.4, 5, 1.4, MC.gold);
      return;
    case 'bahntower':
      block(c, l, N.curtain, 0, 0, 0, W, 70, D, MC.glass);
      return;
    case 'kollhoff':
      block(c, l, M.brick, 0, 0, 0, W, 62, D, MC.brick);
      block(c, l, M.brick, 0, 62, 0, W - 2, 6, D - 2, MC.brick);
      return;
    case 'verkehrsturm':
      block(c, l, M.iron, 0, 0, 0, W, 8.5, D, MC.green);
      return;
    case 'klinik':
      block(c, l, M.tarp, 0, 0, 0, W, 3, D, [0.5, 0.55, 0.6]);
      return;
    case 'philharmonie':
      block(c, l, N.gold, 0, 0, 0, W, 12, D, MC.gold);
      c.b.geo(N.gold, cached('ph-tent', () => new ConeGeometry(Math.min(l.hx, l.hz) * 1.25, 9, 4, 1)), lm(l, 0, 16.5, 0, Math.PI / 4).multiply(new Matrix4().makeScale(l.hx / l.hz, 1, 1)), MC.gold);
      return;
    case 'matthaeus':
      block(c, l, M.brick, 0, 0, -1.5, W, 11, D - 3, [0.75, 0.52, 0.42]);
      block(c, l, M.brick, 0, 0, l.hz - 1.8, 3.6, 26, 3.6, [0.75, 0.52, 0.42]);
      return;
    case 'stabi':
      block(c, l, N.gold, 0, 0, 0, W, 16, D, [1.05, 0.9, 0.6]);
      return;
    case 'nng':
      // Glass hall under the black steel roof plate, on a granite terrace.
      block(c, l, M.concrete, 0, 0, 0, W, 0.4, D, [0.55, 0.55, 0.55]);
      block(c, l, N.curtain, 0, 0.4, 0, W - 5, 6.4, D - 5, MC.glass);
      block(c, l, M.iron, 0, 6.8, 0, W, 1, D, [0.12, 0.12, 0.13]);
      for (const x of [-1, 1]) for (const z of [-1, 1]) block(c, l, M.iron, x * (l.hx - 1.5), 0.4, z * (l.hz - 1.5), 0.5, 6.4, 0.5, [0.12, 0.12, 0.13]);
      return;
    case 'checkpoint':
      block(c, l, M.stucco, 0, 0, 0, 2.2, 2.6, 2.2, MC.white);
      return;
    case 'ubahn':
      block(c, l, M.iron, 0, 0, 0, W, 1.1, D, MC.green);
      return;
    case 'mauerstuecke':
      for (let i = 0; i < 5; i++) block(c, l, M.concrete, -l.hx + 1.4 + i * 2.8, 0, 0, 1.2, 3.6, 0.8, MC.concrete);
      return;
    case 'lafayette':
      block(c, l, N.curtain, 0, 0, 0, W, 26, D, MC.glass);
      return;
    default:
      return;
  }
}

/** Builds one Mitte landmark (inside `b.on` at its ground height). */
export function buildMitteLandmark(b: ChunkBuilder, l: Landmark): void {
  const N = b.mm.mitte;
  if (!N) return;
  const c: MCtx = { b, M: b.mm, N };
  if (buildNorth(c, l) || buildSouth(c, l) || buildKultur(c, l)) return;
  massing(c, l);
}

/** Map-wide Mitte dressing (step 3: neon below 5 m, cables, puddles). Nothing yet in the blockout. */
export function buildMitteWorld(_m: MapDef, _chunkOf: (x: number, z: number) => ChunkBuilder): void {}
