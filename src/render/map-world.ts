// Builds an expedition map (M11) from `src/data/map.ts`: ground with water banks, street ribbons,
// bridges, generated Altbau blocks and houses, instanced trees, landmarks and props. Everything is
// grouped in chunks so the camera frustum culls what is off screen. Lamps are light *spots*; a
// fixed pool of point lights follows the hero (constant light count, no shader recompiles).
import {
  BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight,
  Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, Quaternion,
  SphereGeometry, TorusGeometry, Vector3, type Material,
} from 'three';
import type { Facade, FacadeFeature, PlasterTone } from '../data/courtyard';
import { areaAt, heightAt, isWater, onBridge, onStair, streetDist, type GroundKind, type Landmark, type Lot, type MapDef, type Pt } from '../data/map';
import type { Prop } from '../data/courtyard';
import { Rng } from '../sim/math';
import { BatchSet, boxGeo } from './batch';
import { applyCutout } from './cutout';
import { Materials, type LitMaterial } from './materials';
import { paintAsphalt, paintConcrete, paintFern, paintGround, paintRoofTiles, paintTextSign, type PaintOptions } from './paint';
import {
  Builder, buildAltbau, buildProp, FLOOR_H, FX_LAYER, GROUND_H, makeMats, PARAPET, Run, UNIT_BOX, windowAt, type Mats, type World,
} from './world';

type RGB = readonly [number, number, number];
const CHUNK = 48;
const tmpScale = new Matrix4();

interface LightSpot {
  pos: Vector3;
  color: number;
  intensity: number;
  distance: number;
  flicker: number;
  phase: number;
}

interface MapMats extends Mats {
  ground: LitMaterial;
  asphalt: LitMaterial;
  path: LitMaterial;
  roof: LitMaterial;
  tar: LitMaterial;
  concrete: LitMaterial;
  mossy: LitMaterial;
  water: LitMaterial;
  trunk: LitMaterial;
  crown: LitMaterial;
  glass: LitMaterial;
  greenSign: LitMaterial;
  forumSign: LitMaterial;
  frond: LitMaterial;
}

/** A builder per chunk. Lamps become light spots plus a merged glow decal. */
class ChunkBuilder extends Builder {
  readonly spots: LightSpot[] = [];
  readonly glows = new BatchSet();
  private readonly glowMats = new Map<number, Material>();

  constructor(readonly mm: MapMats) {
    super(mm);
  }

  private lift = 0;

  /** Builds `fn` standing on ground height `y`: geometry, lights, fires and shadow casters move up. */
  on(y: number, fn: () => void): void {
    const fires = this.fires.length;
    this.lift = y;
    this.solid.lift = this.cards.lift = this.glows.lift = y;
    fn();
    for (let i = fires; i < this.fires.length; i++) (this.fires[i] as Vector3).y += y;
    this.lift = 0;
    this.solid.lift = this.cards.lift = this.glows.lift = 0;
  }

  override shadowBox(m: Matrix4, sx: number, sy: number, sz: number): void {
    super.shadowBox(new Matrix4().makeTranslation(0, this.lift, 0).multiply(m), sx, sy, sz);
  }

  override light(pos: Vector3, color: number, intensity: number, distance: number, flicker: number, pool = 4): void {
    this.spots.push({ pos: pos.clone().setY(pos.y + this.lift), color, intensity, distance, flicker, phase: Math.random() * 6 });
    let mat = this.glowMats.get(color);
    if (!mat) this.glowMats.set(color, (mat = Materials.glow(this.glowTex, color, 0.22)));
    const geo = new PlaneGeometry(pool * 2, pool * 2);
    geo.rotateX(-Math.PI / 2);
    this.glows.of(mat).add(geo, new Matrix4().setPosition(pos.x, 0.035, pos.z));
  }
}

function makeMapMats(materials: Materials): MapMats {
  const base = makeMats(materials);
  const o: PaintOptions = { flatten: materials.look.flatten, normalMaps: materials.profile.normalMaps, anisotropy: materials.profile.anisotropy };
  const ground = paintGround(o);
  const m: MapMats = {
    ...base,
    ground: materials.surface({ map: ground.map, roughness: 0.95, vertexColors: true }),
    asphalt: materials.surface({ map: paintAsphalt(o).map, roughness: 0.85, vertexColors: true }),
    path: materials.surface({ map: ground.map, color: 0x9a7f5e, roughness: 0.95, vertexColors: true }),
    roof: materials.surface({ map: paintRoofTiles(o).map, roughness: 0.8, vertexColors: true }),
    tar: materials.surface({ map: paintAsphalt(o).map, color: 0x5a5650, roughness: 0.9, vertexColors: true }),
    concrete: materials.surface({ map: paintConcrete(o).map, roughness: 0.9, vertexColors: true }),
    mossy: materials.surface({ map: paintConcrete(o, '#6f7a5c').map, roughness: 0.9, vertexColors: true }),
    water: materials.surface({ color: 0x1a5560, emissive: 0x0a2228, roughness: 0.04, metalness: 0.55 }),
    trunk: materials.surface({ color: 0x3a2c22, roughness: 0.95 }),
    crown: materials.surface({ color: 0xffffff, roughness: 0.85 }),
    glass: materials.surface({ color: 0x1a2a2c, emissive: 0x5a8a7a, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.3 }),
    greenSign: materials.surface({ color: 0x0e3a1c, emissive: 0x2fbf5a, emissiveIntensity: 1.6, roughness: 0.5 }),
    forumSign: (() => {
      const t = paintTextSign('FORUM', '#2a1a14', '#f0b27a');
      return materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffa050, emissiveIntensity: 1.4, roughness: 0.6 });
    })(),
    frond: materials.surface({ map: paintFern(), alphaTest: 0.5, doubleSided: true, roughness: 0.8, vertexColors: true }),
  };
  // Everything that can stand between the camera and the hero gets the see-through cutout.
  for (const mat of [m.brick, m.stucco, m.windows, m.shop, m.sign, m.door, m.roof, m.tar, m.concrete, m.mossy, m.crown, m.glass, m.ivy, m.wood, m.darkWood, m.iron, m.rust, m.greenSign, m.forumSign, m.frond, ...Object.values(m.plaster)]) {
    applyCutout(mat);
  }
  return m;
}

// ---------------------------------------------------------------- ground and water

const GROUND_TINT: Record<GroundKind, RGB> = {
  cobbles: [0.6, 0.55, 0.5],
  asphalt: [0.5, 0.49, 0.46],
  grass: [0.42, 0.52, 0.34],
  forest: [0.3, 0.36, 0.26],
  jungle: [0.34, 0.5, 0.26],
};

function buildGround(m: MapDef, mats: MapMats, group: Group): void {
  const step = 1.5;
  const B = m.bounds;
  const height = (x: number, z: number): number => (isWater(m, x, z) && !onBridge(m, x, z) ? -1.4 : heightAt(m, x, z));
  for (let cz = B.minZ; cz < B.maxZ; cz += CHUNK) {
    for (let cx = B.minX; cx < B.maxX; cx += CHUNK) {
      const n = Math.ceil(Math.min(CHUNK, B.maxX - cx) / step);
      const k = Math.ceil(Math.min(CHUNK, B.maxZ - cz) / step);
      const pos: number[] = [];
      const col: number[] = [];
      const uv: number[] = [];
      const wet: boolean[] = [];
      for (let j = 0; j <= k; j++) {
        for (let i = 0; i <= n; i++) {
          const x = cx + i * step;
          const z = cz + j * step;
          const y = height(x, z);
          wet.push(y < -0.5);
          pos.push(x, y, z);
          uv.push(x / 5, z / 5);
          const a = areaAt(m, x, z);
          const t = GROUND_TINT[a?.ground ?? m.defaultGround];
          const noise = 0.82 + 0.3 * (0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.19 + Math.sin(x * 0.13) * 1.6));
          // Damp, dark banks.
          const shore = y < -0.5 ? 0.35 : isWater(m, x + 1.6, z) || isWater(m, x - 1.6, z) || isWater(m, x, z + 1.6) || isWater(m, x, z - 1.6) ? 0.6 : 1;
          col.push(t[0] * noise * shore, t[1] * noise * shore, t[2] * noise * shore);
        }
      }
      const idx: number[] = [];
      const row = n + 1;
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < n; i++) {
          const a = j * row + i;
          const b = a + 1;
          const c = a + row;
          const d = c + 1;
          if (wet[a] && wet[b] && wet[c] && wet[d]) continue;
          idx.push(a, c, b, b, c, d);
        }
      }
      if (idx.length === 0) continue;
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
      g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const mesh = new Mesh(g, mats.ground);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  const water = new Mesh(new PlaneGeometry(B.maxX - B.minX + 200, B.maxZ - B.minZ + 200), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set((B.minX + B.maxX) / 2, -0.45, (B.minZ + B.maxZ) / 2);
  water.receiveShadow = true;
  group.add(water);
}

/** Street ribbons with round joints; world-space UVs keep the texture seamless. */
function buildStreets(m: MapDef, mats: MapMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  for (const s of m.streets) {
    const mat = s.kind === 'main' ? mats.asphalt : s.kind === 'path' ? mats.path : mats.cobbles;
    const y = s.kind === 'main' ? 0.025 : s.kind === 'path' ? 0.015 : 0.02;
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, az] = s.pts[i - 1] as Pt;
      const [bx, bz] = s.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      // Pieces of at most 3 m, so they land in the right chunk and follow banks and hills.
      const pieces = Math.ceil(len / 3);
      for (let p = 0; p < pieces; p++) {
        const t0 = (p / pieces) * len;
        const t1 = ((p + 1) / pieces) * len;
        const x0 = ax + dx * t0;
        const z0 = az + dz * t0;
        const x1 = ax + dx * t1;
        const z1 = az + dz * t1;
        if (isWater(m, (x0 + x1) / 2, (z0 + z1) / 2) && !onBridge(m, (x0 + x1) / 2, (z0 + z1) / 2)) continue;
        const nx = -dz * (s.width / 2);
        const nz = dx * (s.width / 2);
        const v = (x: number, z: number): Vector3 => new Vector3(x, y + heightAt(m, x, z), z);
        const quad: [Vector3, Vector3, Vector3, Vector3] = [v(x0 - nx, z0 - nz), v(x0 + nx, z0 + nz), v(x1 + nx, z1 + nz), v(x1 - nx, z1 - nz)];
        const b = chunkOf((x0 + x1) / 2, (z0 + z1) / 2);
        const batch = b.solid.of(mat);
        // quad() takes counter-clockwise corners seen from above; UVs in world meters.
        batch.quad(quad, [0, 0, 1, 1]);
        fixWorldUv(batch, 4, 4);
      }
      if (i < s.pts.length - 1 || s.kind === 'path') {
        const disc = new CircleGeometry(s.width / 2, 16);
        disc.rotateX(-Math.PI / 2);
        worldUv(disc, bx, bz, 4);
        chunkOf(bx, bz).solid.of(mat).add(disc, new Matrix4().setPosition(bx, y + 0.001 + heightAt(m, bx, bz), bz));
      }
    }
  }
}

/** Rewrites the UVs of the last `count` vertices of a batch to world XZ / scale. */
function fixWorldUv(batch: ReturnType<BatchSet['of']>, count: number, scale: number): void {
  const b = batch as unknown as { positions: number[]; uvs: number[] };
  const n = b.positions.length / 3;
  for (let i = n - count; i < n; i++) {
    b.uvs[i * 2] = (b.positions[i * 3] as number) / scale;
    b.uvs[i * 2 + 1] = (b.positions[i * 3 + 2] as number) / scale;
  }
}

function worldUv(g: BufferGeometry, ox: number, oz: number, scale: number): void {
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + ox) / scale, (pos.getZ(i) + oz) / scale);
}

function buildBridges(m: MapDef, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  for (const br of m.bridges) {
    const b = chunkOf(br.x, br.z);
    const mats = b.mm;
    const base = new Matrix4().makeRotationY(br.rot).setPosition(br.x, 0, br.z);
    const local = (x: number, y: number, z: number): Matrix4 => base.clone().multiply(new Matrix4().setPosition(x, y, z));
    // Deck (top flush with the ground), stone sides, iron railing, two lamps.
    b.box(mats.cobbles, local(0, -0.2, 0), br.width, 0.5, br.len, [0.75, 0.72, 0.7]);
    for (const side of [-1, 1]) {
      b.box(mats.stucco, local(side * (br.width / 2 + 0.2), 0.05, 0), 0.4, 0.6, br.len, [0.55, 0.55, 0.52]);
      b.box(mats.iron, local(side * (br.width / 2 + 0.2), 1.05, 0), 0.08, 0.08, br.len);
      for (let z = -br.len / 2 + 0.6; z < br.len / 2; z += 1.2) b.box(mats.iron, local(side * (br.width / 2 + 0.2), 0.7, z), 0.05, 0.7, 0.05);
      // Arch piers in the water.
      for (const z of [-br.len / 4, br.len / 4]) b.box(mats.stucco, local(side * (br.width / 2 - 0.6), -1.1, z), 1.2, 1.8, 1.6, [0.45, 0.45, 0.42]);
    }
    if (br.len > 15) {
      for (const [side, z] of [[-1, -br.len / 4], [1, br.len / 4]] as Array<[number, number]>) {
        const p = new Vector3(side * (br.width / 2 + 0.2), 0, z).applyMatrix4(base);
        buildProp(b, { kind: 'lantern', x: p.x, z: p.z, rot: 0, size: 1 }, new Rng(3));
      }
    }
  }
}

// ---------------------------------------------------------------- terraces

/** Retaining walls with a low parapet along the outline (open at the stairs), stone steps. */
function buildTerraces(m: MapDef, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  for (const t of m.terraces) {
    const n = t.poly.length;
    for (let i = 0; i < n; i++) {
      const [ax, az] = t.poly[i] as Pt;
      const [bx, bz] = t.poly[(i + 1) % n] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const yaw = Math.atan2(dx, dz);
      // Wall pieces of 1 m; leave out what a stair crosses.
      let run0 = -1;
      const flush = (t0: number, t1: number): void => {
        if (t1 - t0 < 0.05) return;
        const mid = (t0 + t1) / 2;
        const x = ax + dx * mid;
        const z = az + dz * mid;
        const b = chunkOf(x, z);
        const mm = new Matrix4().makeRotationY(yaw).setPosition(x, (t.h - 0.4) / 2, z);
        b.box(b.mm.stucco, mm, 0.6, t.h + 0.4, t1 - t0, [0.5, 0.5, 0.47]);
        b.box(b.mm.stucco, new Matrix4().makeRotationY(yaw).setPosition(x, t.h + 0.3, z), 0.7, 0.6, t1 - t0, [0.62, 0.6, 0.56]);
        b.shadowBox(mm, 0.6, t.h + 0.4, t1 - t0);
      };
      for (let k = 0; k <= Math.ceil(len); k++) {
        const tt = Math.min(len, k);
        const open = onStair(t, ax + dx * tt, az + dz * tt, 0.4) !== null;
        if (!open && run0 < 0) run0 = tt;
        if ((open || k === Math.ceil(len)) && run0 >= 0) {
          flush(run0, open ? Math.max(run0, tt - 0.5) : tt);
          run0 = -1;
        }
      }
    }
    for (const st of t.stairs) {
      const b = chunkOf(st.x, st.z);
      const steps = Math.max(3, Math.round(t.h / 0.3));
      const ux = Math.sin(st.rot);
      const uz = Math.cos(st.rot);
      for (let k = 0; k < steps; k++) {
        const f = (k + 0.5) / steps;
        const top = (t.h * (k + 1)) / steps;
        const cx = st.x + ux * (f - 0.5) * st.len;
        const cz = st.z + uz * (f - 0.5) * st.len;
        b.box(b.mm.stucco, new Matrix4().makeRotationY(st.rot).setPosition(cx, top / 2, cz), st.width, top, st.len / steps + 0.02, [0.6, 0.58, 0.54]);
      }
      // Side cheeks.
      for (const side of [-1, 1]) {
        const cx = st.x + uz * side * (st.width / 2 + 0.2);
        const cz = st.z - ux * side * (st.width / 2 + 0.2);
        b.box(b.mm.stucco, new Matrix4().makeRotationY(st.rot).setPosition(cx, t.h / 2, cz), 0.4, t.h + 0.2, st.len, [0.5, 0.5, 0.47]);
      }
    }
  }
}

// ---------------------------------------------------------------- buildings

const TONES: PlasterTone[] = ['cream', 'ochre', 'oxblood', 'cream', 'ochre'];

/** The four outward facades of a block: front, right, back, left (see map.ts for the frame). */
function blockFacades(l: { x: number; z: number; rot: number; w: number; d: number }): Array<{ a: Pt; b: Pt; len: number }> {
  const ux = Math.cos(l.rot);
  const uz = -Math.sin(l.rot);
  const fx = Math.sin(l.rot);
  const fz = Math.cos(l.rot);
  const hw = l.w / 2;
  const hd = l.d / 2;
  const c = (a: number, b: number): Pt => [l.x + ux * a + fx * b, l.z + uz * a + fz * b];
  return [
    { a: c(-hw, hd), b: c(hw, hd), len: l.w },
    { a: c(hw, hd), b: c(hw, -hd), len: l.d },
    { a: c(hw, -hd), b: c(-hw, -hd), len: l.w },
    { a: c(-hw, -hd), b: c(-hw, hd), len: l.d },
  ];
}

function buildAltbauLot(b: ChunkBuilder, l: Lot, m: MapDef): void {
  const rng = new Rng(l.seed);
  const tone = rng.pick(TONES);
  const sides = blockFacades(l);
  const main = streetDist(m, l.x + Math.sin(l.rot) * l.d, l.z + Math.cos(l.rot) * l.d).street?.kind === 'main';
  sides.forEach((s, i) => {
    const features: FacadeFeature[] = [];
    if (i === 0) {
      if (s.len > 15 && rng.next() < (main ? 0.4 : 0.22)) {
        const from = rng.range(1.5, s.len - 9.5);
        features.push({ kind: 'spati', from, to: from + 7 });
        const door = from > 5 ? 1.6 : from + 8.5;
        if (door + 1.4 < s.len - 0.5) features.push({ kind: 'door', from: door, to: door + 1.4 });
      } else {
        const d = rng.range(2, s.len - 3.5);
        features.push({ kind: 'door', from: d, to: d + 1.4 });
      }
    } else if (i === 2 && rng.next() < 0.5) {
      const d = rng.range(1.5, s.len - 3);
      features.push({ kind: 'door', from: d, to: d + 1.4 });
    }
    const f: Facade = {
      id: `lot${l.seed}-${i}`, style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1],
      depth: Math.min(l.w, l.d) / 2, floors: l.floors, tone, features, seed: (l.seed + i * 13) % 997,
    };
    buildAltbau(b, f);
  });
  // Flat tar roof with chimneys.
  const H = GROUND_H + l.floors * FLOOR_H + PARAPET;
  const m4 = new Matrix4().makeRotationY(l.rot).setPosition(l.x, H - 0.05, l.z);
  b.box(b.mm.tar, m4, l.w - 0.1, 0.1, l.d - 0.1, [0.6, 0.6, 0.6]);
  for (let i = 0; i < 2 + rng.int(3); i++) {
    const cm = m4.clone().multiply(new Matrix4().setPosition(rng.range(-l.w / 2 + 1, l.w / 2 - 1), 0.7, rng.range(-l.d / 2 + 1, l.d / 2 - 1)));
    b.box(b.mm.brick, cm, 0.8, 1.4, 0.6, [0.8, 0.75, 0.7]);
  }
}

/** Gable roof prism along X (local), ridge at height h. */
function gableRoof(w: number, d: number, h: number): BufferGeometry {
  const hw = w / 2 + 0.4;
  const hd = d / 2 + 0.4;
  const p = [
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, h, 0, // front slope
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, h, 0, // back slope
  ];
  const uv = [0, 0, w / 3, 0, w / 3, d / 4, 0, d / 4, 0, 0, w / 3, 0, w / 3, d / 4, 0, d / 4];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  g.computeVertexNormals();
  return g;
}

function gableEnds(w: number, d: number, h: number): BufferGeometry {
  const hw = w / 2;
  const hd = d / 2;
  const p = [hw, 0, hd, hw, 0, -hd, hw, h, 0, -hw, 0, -hd, -hw, 0, hd, -hw, h, 0];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, d / 6, 0, d / 12, h / 6, 0, 0, d / 6, 0, d / 12, h / 6]), 2));
  g.computeVertexNormals();
  return g;
}

/** Plaster walls with windows on all four sides (Run frames), for houses and landmarks. */
function walls(b: ChunkBuilder, l: { x: number; z: number; rot: number; w: number; d: number }, mat: Material, h: number, rows: number[], seed: number, lit = 0.25, bay = 3): void {
  const rng = new Rng(seed);
  blockFacades(l).forEach((s, i) => {
    const run = new Run({ id: 'w', style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1], depth: 1, floors: 0, tone: 'cream', features: [], seed: seed + i });
    b.solid.of(mat).quad([run.pt(0, 0, 0), run.pt(s.len, 0, 0), run.pt(s.len, h, 0), run.pt(0, h, 0)], [0, 0, s.len / 6, h / 6], [[0.75, 0.75, 0.72], [0.75, 0.75, 0.72], [1, 1, 1], [1, 1, 1]]);
    const bays = Math.max(1, Math.floor(s.len / bay));
    for (let k = 0; k < bays; k++) {
      const sx = (k + 0.5) * (s.len / bays);
      for (const y of rows) windowAt(b, run, rng, sx, y, 1.1, 1.6, lit, false);
    }
  });
}

function buildHouse(b: ChunkBuilder, l: Lot): void {
  const rng = new Rng(l.seed);
  const tone = rng.pick(TONES);
  const h = 3.4 + l.floors * 2.9;
  const plaster = b.mm.plaster[tone] as LitMaterial;
  walls(b, l, plaster, h, l.floors ? [1.1, 4.0] : [1.1], l.seed, 0.3);
  const m4 = new Matrix4().makeRotationY(l.rot).setPosition(l.x, h, l.z);
  const ridge = Math.min(l.w, l.d) * 0.42;
  b.geo(b.mm.roof, gableRoof(l.w, l.d, ridge), m4, [rng.range(0.75, 1), 0.85, 0.8]);
  b.geo(plaster, gableEnds(l.w, l.d, ridge), m4);
  b.shadowBox(new Matrix4().makeRotationY(l.rot).setPosition(l.x, h / 2, l.z), l.w, h, l.d);
}

// ---------------------------------------------------------------- trees

interface TreeBucket {
  trunks: Matrix4[];
  crowns: Array<{ m: Matrix4; c: Color }>;
}

/** Urzeit palms and tree ferns: a bent trunk with a crown of big fern fronds (alpha cards). */
function buildPalm(b: ChunkBuilder, l: Lot): void {
  const rng = new Rng(l.seed);
  const h = rng.range(4.5, 8);
  const lean = rng.range(-0.25, 0.25);
  const trunk = new Matrix4().makeRotationY(l.rot).multiply(new Matrix4().makeRotationZ(lean)).setPosition(l.x, h / 2, l.z);
  b.geo(b.mm.trunk, new CylinderGeometry(0.14, 0.3, h, 6), trunk, [0.9, 0.8, 0.7]);
  const top = new Vector3(0, h / 2, 0).applyMatrix4(trunk);
  const geo = new PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  const n = 7 + rng.int(4);
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const len = rng.range(2.6, 4.2);
    const m = new Matrix4().makeRotationY(yaw).multiply(new Matrix4().makeRotationX(rng.range(0.9, 1.5))).setPosition(top);
    m.multiply(tmpScale.makeScale(len * 0.55, len, 1));
    const g = rng.range(0.7, 1.1);
    b.cards.of(b.mm.frond).add(geo, m, [0.75 * g, 1.05 * g, 0.55 * g]);
  }
  // Ferns around the foot.
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.6, 1.8);
    const s = rng.range(0.9, 1.6);
    for (const k of [0, Math.PI / 2]) {
      const m = new Matrix4().makeRotationY(a + k).setPosition(l.x + Math.cos(a) * r, 0, l.z + Math.sin(a) * r).multiply(tmpScale.makeScale(s * 1.3, s, 1));
      b.cards.of(b.mm.fern).add(geo, m, [0.7, 0.95, 0.5]);
    }
  }
}

function buildTrees(m: MapDef, lots: Lot[], mats: MapMats, chunkKey: (x: number, z: number) => string, group: Group, profile: { enemyShadows: boolean }): void {
  const buckets = new Map<string, TreeBucket>();
  for (const l of lots) {
    if (l.kind !== 'tree' || l.jungle) continue;
    const k = chunkKey(l.x, l.z);
    let bk = buckets.get(k);
    if (!bk) buckets.set(k, (bk = { trunks: [], crowns: [] }));
    const rng = new Rng(l.seed);
    const h = rng.range(3.5, 6);
    const lean = rng.range(-0.12, 0.12);
    const base = heightAt(m, l.x, l.z);
    bk.trunks.push(new Matrix4().makeRotationZ(lean).setPosition(l.x, base + h / 2, l.z).multiply(tmpScale.makeScale(1, h, 1)));
    const blobs = 3 + rng.int(2);
    const hue = rng.next();
    for (let i = 0; i < blobs; i++) {
      const s = l.w * rng.range(0.24, 0.34);
      const m = new Matrix4().compose(
        new Vector3(l.x + rng.range(-1.1, 1.1), base + h + rng.range(-0.6, 1.4), l.z + rng.range(-1.1, 1.1)),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rng.range(0, 6)),
        new Vector3(s, s * 0.85, s),
      );
      const g = rng.range(0.7, 1.15);
      // Dark pine green, olive and a few autumn ochres (style bible palette).
      const c = hue < 0.55 ? new Color(0.12 * g, 0.2 * g, 0.12 * g) : hue < 0.85 ? new Color(0.24 * g, 0.24 * g, 0.1 * g) : new Color(0.42 * g, 0.26 * g, 0.08 * g);
      bk.crowns.push({ m, c });
    }
  }
  const trunkGeo = new CylinderGeometry(0.16, 0.26, 1, 6);
  const crownGeo = new IcosahedronGeometry(1, 0);
  for (const bk of buckets.values()) {
    const trunks = new InstancedMesh(trunkGeo, mats.trunk, bk.trunks.length);
    bk.trunks.forEach((m, i) => trunks.setMatrixAt(i, m));
    trunks.castShadow = profile.enemyShadows;
    trunks.receiveShadow = true;
    trunks.computeBoundingSphere();
    group.add(trunks);
    if (bk.crowns.length === 0) continue;
    const im = new InstancedMesh(crownGeo, mats.crown, bk.crowns.length);
    bk.crowns.forEach((t, i) => {
      im.setMatrixAt(i, t.m);
      im.setColorAt(i, t.c);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
}

// ---------------------------------------------------------------- landmarks

function lm(l: Landmark, x = 0, y = 0, z = 0, ry = 0): Matrix4 {
  return new Matrix4().makeRotationY(l.rot + ry).setPosition(l.x, 0, l.z).multiply(new Matrix4().setPosition(x, y, z));
}

/** Local point of a landmark frame (x right of the front, z toward the front). */
function lp(l: Landmark, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyMatrix4(new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0, l.z));
}

function steppedGable(b: ChunkBuilder, l: Landmark, x: number, y: number, z: number, w: number, ry = 0): void {
  for (let i = 0; i < 4; i++) {
    const sw = w * (1 - i * 0.24);
    b.box(b.mm.brick, lm(l, x, y + i * 1.1 + 0.55, z, ry), sw, 1.1, 0.7, [0.95, 0.75, 0.68]);
  }
}

function buildLandmark(b: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const frame = { x: l.x, z: l.z, rot: l.rot };
  switch (l.kind) {
    case 'rathaus': {
      // Red brick, neo-gothic: two storeys, stepped gables, tall corner tower with spire and clock.
      const w = l.hx * 2;
      const d = l.hz * 2;
      const h = 12;
      walls(b, { ...frame, w, d }, M.brick, h, [1.4, 5.2, 8.6], 1906, 0.35, 2.6);
      b.box(M.stucco, lm(l, 0, h + 0.2, 0), w + 0.4, 0.4, d + 0.4, [0.8, 0.7, 0.6]);
      b.geo(M.roof, gableRoof(d, w, 6), lm(l, 0, h + 0.4, 0, Math.PI / 2), [0.55, 0.6, 0.62]);
      for (const x of [-w / 4, w / 4]) steppedGable(b, l, x, h, d / 2, 6);
      steppedGable(b, l, 0, h, d / 2, 8);
      // Tower at the front left corner.
      const tx = -w / 2 + 3;
      const tz = d / 2 - 3;
      b.box(M.brick, lm(l, tx, 12.5, tz), 6.4, 25, 6.4, [0.95, 0.72, 0.64]);
      b.shadowBox(lm(l, tx, 12.5, tz), 6.4, 25, 6.4);
      b.box(M.stucco, lm(l, tx, 25.2, tz), 7, 0.5, 7, [0.8, 0.7, 0.6]);
      b.geo(M.roof, new ConeGeometry(4.4, 11, 4), lm(l, tx, 31, tz, Math.PI / 4), [0.45, 0.55, 0.55]);
      for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const cm = lm(l, tx, 21, tz, ry).multiply(new Matrix4().setPosition(0, 0, 3.25));
        b.geo(M.lampGlass, new CircleGeometry(1.3, 20), cm);
      }
      // Arched portal and lamps on the front.
      b.box(M.stucco, lm(l, 2, 2, d / 2 + 0.2), 4.2, 4, 0.5, [0.85, 0.75, 0.65]);
      b.box(M.dark, lm(l, 2, 1.7, d / 2 + 0.3), 2.6, 3.2, 0.5);
      for (const x of [-1, 5]) b.light(lp(l, x, 3.2, d / 2 + 1.2), 0xffb060, 16, 11, 0.1, 3.5);
      b.shadowBox(lm(l, 0, h / 2, 0), w, h, d);
      break;
    }
    case 'schloss': {
      // Baroque palace: three storeys of ochre plaster, red hip roof, a projecting center with pediment.
      const w = l.hx * 2;
      const d = l.hz * 2;
      const h = 12;
      const plaster = M.plaster.ochre as LitMaterial;
      walls(b, { ...frame, w, d }, plaster, h, [1.4, 5.0, 8.6], 1690, 0.2, 2.4);
      b.box(M.stucco, lm(l, 0, h, 0), w + 0.5, 0.5, d + 0.5);
      b.geo(M.roof, gableRoof(d, w, 5.5), lm(l, 0, h + 0.25, 0, Math.PI / 2));
      b.geo(plaster, gableEnds(d, w, 5.5), lm(l, 0, h + 0.25, 0, Math.PI / 2));
      b.box(plaster, lm(l, 0, h / 2 + 0.5, d / 2 + 0.6), 5, h + 1, 1.2);
      b.box(M.stucco, lm(l, 0, h + 1.6, d / 2 + 0.6), 5.6, 2.4, 1.3, [0.95, 0.9, 0.82]);
      b.light(lp(l, 0, 3, d / 2 + 2.5), 0xffc070, 12, 10, 0.05, 3);
      b.shadowBox(lm(l, 0, h / 2, 0), w, h, d);
      break;
    }
    case 'kirche': {
      const w = l.hx * 2;
      const d = l.hz * 2;
      walls(b, { ...frame, w, d }, M.brick, 9, [3.5], 1841, 0.4, 3);
      b.geo(M.roof, gableRoof(d, w, 5), lm(l, 0, 9, 0, Math.PI / 2), [0.6, 0.65, 0.6]);
      b.geo(M.brick, gableEnds(d, w, 5), lm(l, 0, 9, 0, Math.PI / 2));
      b.box(M.brick, lm(l, 0, 9, d / 2 + 2), 4.5, 18, 4.5, [0.9, 0.7, 0.62]);
      b.geo(M.roof, new ConeGeometry(3.2, 9, 8), lm(l, 0, 22.5, d / 2 + 2), [0.4, 0.55, 0.5]);
      b.shadowBox(lm(l, 0, 9, d / 2 + 2), 4.5, 18, 4.5);
      break;
    }
    case 'sbahnhof': {
      // Brick station hall on the embankment, platform canopy, green S sign.
      const w = l.hx * 2;
      const d = l.hz * 2;
      walls(b, { ...frame, w, d }, M.brick, 7, [1.4, 4.2], 1882, 0.5, 3);
      b.box(M.tar, lm(l, 0, 7.2, 0), w + 1, 0.4, d + 1, [0.5, 0.5, 0.5]);
      for (let x = -w / 2 - 20; x <= w / 2 + 20; x += 6) {
        b.box(M.iron, lm(l, x, 2.4, -d / 2 - 3), 0.25, 4.8, 0.25);
      }
      b.box(M.rust, lm(l, 0, 4.9, -d / 2 - 3), w + 44, 0.25, 6);
      b.geo(M.greenSign, new CylinderGeometry(1.5, 1.5, 0.3, 24), lm(l, 0, 8.6, d / 2 + 0.3).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
      b.light(lp(l, 0, 6, d / 2 + 2), 0x9dffb0, 14, 12, 0, 4);
      b.box(M.door, lm(l, 0, 1.5, d / 2 + 0.05), 4, 3, 0.2);
      b.shadowBox(lm(l, 0, 3.5, 0), w, 7, d);
      break;
    }
    case 'forum': {
      // Shopping center: concrete box with a dead glass front and a flickering sign.
      const w = l.hx * 2;
      const d = l.hz * 2;
      b.box(M.concrete, lm(l, 0, 5, 0), w, 10, d);
      b.box(M.glass, lm(l, 0, 3, d / 2 + 0.1), w - 4, 5.4, 0.2);
      b.geo(M.forumSign, new PlaneGeometry(12, 2.25), lm(l, 0, 8.4, d / 2 + 0.12));
      b.light(lp(l, 0, 6, d / 2 + 3), 0xff9a4a, 14, 14, 0.6, 5);
      b.shadowBox(lm(l, 0, 5, 0), w, 10, d);
      break;
    }
    case 'mueggelturm': {
      // GDR viewing tower: slim concrete shaft, glazed top box, flat roof.
      b.box(M.concrete, lm(l, 0, 14, 0), 4.2, 28, 4.2);
      b.box(M.concrete, lm(l, 0, 29.5, 0), 7.5, 3, 7.5);
      b.box(M.windows, lm(l, 0, 29.6, 0), 7.6, 1.6, 7.6);
      b.box(M.concrete, lm(l, 0, 31.2, 0), 8.5, 0.4, 8.5);
      b.box(M.concrete, lm(l, 0, 1.8, 6), 12, 3.6, 6);
      b.light(lp(l, 0, 3, 10), 0xffb060, 14, 12, 0.2, 4);
      b.shadowBox(lm(l, 0, 14, 0), 4.2, 28, 4.2);
      break;
    }
    case 'riesenrad': {
      // The Spreepark wheel: rusty rim, spokes, gondolas, A-frame legs.
      const R = 17;
      const hub = R + 3;
      const rim = new TorusGeometry(R, 0.35, 6, 48);
      b.geo(M.rust, rim, lm(l, 0, hub, -0.6));
      b.geo(M.rust, rim, lm(l, 0, hub, 0.6));
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const sm = lm(l, 0, hub, 0).multiply(new Matrix4().makeRotationZ(a)).multiply(new Matrix4().setPosition(0, R / 2, 0));
        b.box(M.rust, sm, 0.15, R, 0.15);
        const gx = Math.sin(a) * R;
        const gy = hub + Math.cos(a) * R;
        b.box(M.vanSide, lm(l, gx, gy - 1.3, 0), 1.5, 1.6, 1.6);
      }
      for (const z of [-2.5, 2.5]) {
        for (const x of [-1, 1]) {
          const leg = lm(l, x * 4.5, hub / 2, z).multiply(new Matrix4().makeRotationZ(x * -0.22));
          b.box(M.rust, leg, 0.6, hub + 1, 0.6);
        }
      }
      b.light(lp(l, 0, 4, 4), 0xff8a50, 12, 12, 0.5, 4);
      b.shadowBox(lm(l, 0, hub, 0), R * 2, R * 2, 1.2);
      break;
    }
    case 'dino': {
      // Toppled amusement park dinosaur: mossy concrete body, long neck and tail.
      const s = 1.6;
      const body = new SphereGeometry(1, 12, 8);
      b.geo(M.mossy, body, lm(l, 0, 2.2 * s, 0).multiply(tmpScale.makeScale(1.6 * s, 1.2 * s, 2.6 * s)));
      b.geo(M.mossy, new CylinderGeometry(0.45 * s, 0.8 * s, 4 * s, 10), lm(l, 0, 4.3 * s, 2.8 * s).multiply(new Matrix4().makeRotationX(0.7)));
      b.geo(M.mossy, boxGeo(1 * s, 0.9 * s, 1.8 * s, 0.5), lm(l, 0, 5.8 * s, 4.6 * s));
      b.geo(M.mossy, new ConeGeometry(0.9 * s, 5 * s, 10), lm(l, 0, 1.6 * s, -4.4 * s).multiply(new Matrix4().makeRotationX(-1.35)));
      for (const [x, z] of [[-1, 1.2], [1, 1.2], [-1, -1.2], [1, -1.2]]) {
        b.geo(M.mossy, new CylinderGeometry(0.4 * s, 0.5 * s, 2 * s, 8), lm(l, (x as number) * 0.9 * s, 1 * s, (z as number) * s));
      }
      b.shadowBox(lm(l, 0, 2.5 * s, 0), 3 * s, 4 * s, 7 * s);
      break;
    }
  }
}

// ---------------------------------------------------------------- assembly

export function buildMapWorld(materials: Materials, m: MapDef, lots: Lot[], props: Prop[]): World {
  const mats = makeMapMats(materials);
  const group = new Group();
  group.name = m.id;
  const chunks = new Map<string, ChunkBuilder>();
  const chunkKey = (x: number, z: number): string => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
  const chunkOf = (x: number, z: number): ChunkBuilder => {
    const k = chunkKey(x, z);
    let b = chunks.get(k);
    if (!b) chunks.set(k, (b = new ChunkBuilder(mats)));
    return b;
  };

  buildGround(m, mats, group);
  buildStreets(m, mats, chunkOf);
  buildBridges(m, chunkOf);
  // Buildings stand on the lowest corner of their footprint; the rest sinks into the slope.
  const base = (x: number, z: number, r: number): number =>
    Math.min(heightAt(m, x, z), heightAt(m, x - r, z - r), heightAt(m, x + r, z - r), heightAt(m, x - r, z + r), heightAt(m, x + r, z + r));
  for (const l of lots) {
    const b = chunkOf(l.x, l.z);
    if (l.kind === 'altbau' || l.kind === 'platte') b.on(base(l.x, l.z, Math.max(l.w, l.d) / 2), () => buildAltbauLot(b, l, m));
    else if (l.kind === 'house') b.on(base(l.x, l.z, Math.max(l.w, l.d) / 2), () => buildHouse(b, l));
    else if (l.kind === 'tree' && l.jungle) b.on(heightAt(m, l.x, l.z), () => buildPalm(b, l));
  }
  for (const l of m.landmarks) {
    const b = chunkOf(l.x, l.z);
    b.on(base(l.x, l.z, Math.max(l.hx, l.hz)), () => buildLandmark(b, l));
  }
  const rng = new Rng(m.seed);
  for (const p of props) {
    const b = chunkOf(p.x, p.z);
    b.on(heightAt(m, p.x, p.z), () => buildProp(b, p, rng));
  }
  buildTerraces(m, chunkOf);
  if (m.rail) {
    const r = m.rail;
    for (let x = r.minX; x < r.maxX; x += 40) {
      const cb = chunkOf(x + 20, r.z);
      cb.box(mats.stucco, new Matrix4().setPosition(x + 20, 0.9, r.z), 40, 1.8, 8, [0.45, 0.42, 0.4]);
      for (const z of [-1.5, 1.5]) cb.box(mats.iron, new Matrix4().setPosition(x + 20, 1.9, r.z + z), 40, 0.15, 0.12);
    }
  }
  buildTrees(m, lots, mats, chunkKey, group, materials.profile);

  const spots: LightSpot[] = [];
  const caster = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const fires: Vector3[] = [];
  for (const b of chunks.values()) {
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
    for (const mesh of b.glows.meshes()) {
      mesh.layers.set(FX_LAYER);
      mesh.renderOrder = 1;
      group.add(mesh);
    }
    // Shadow casters merged per chunk.
    if (b.shadowBoxes.length) {
      const set = new BatchSet();
      for (const s of b.shadowBoxes) set.of(caster).add(UNIT_BOX, s.m);
      for (const mesh of set.meshes()) {
        mesh.castShadow = true;
        mesh.layers.set(FX_LAYER);
        group.add(mesh);
      }
    }
    for (const o of b.extras) group.add(o);
    spots.push(...b.spots);
    fires.push(...b.fires);
  }

  // --- light: moon follows the hero; a fixed pool of point lights takes the nearest lamps.
  group.add(new HemisphereLight(0x6fb0ae, 0x1f1c18, 0.8));
  const moon = new DirectionalLight(0xa8dde2, 1.9);
  const MOON = new Vector3(-11, 24, 12);
  moon.castShadow = true;
  const size = materials.profile.shadowMap;
  moon.shadow.mapSize.set(size, size);
  const cam = moon.shadow.camera;
  cam.left = -24;
  cam.right = 24;
  cam.top = 22;
  cam.bottom = -22;
  cam.near = 4;
  cam.far = 80;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.04;
  group.add(moon, moon.target);

  const poolSize = Math.max(1, materials.profile.maxPointLights - 1);
  const pool = Array.from({ length: poolSize }, () => {
    const light = new PointLight(0xffffff, 0, 10, 1.6);
    group.add(light);
    return { light, spot: null as LightSpot | null, weight: 0 };
  });
  let hx = m.start.x;
  let hz = m.start.z;
  let pickT = 0;
  const texel = (cam.right - cam.left) / size;

  const pick = (): void => {
    const near = spots
      .map((s) => ({ s, d: (s.pos.x - hx) ** 2 + (s.pos.z - hz) ** 2 }))
      .filter((e) => e.d < 45 * 45)
      .sort((a, c) => a.d - c.d)
      .slice(0, poolSize)
      .map((e) => e.s);
    // Keep slots that still hold a wanted spot, hand the rest to new spots (they fade in).
    for (const slot of pool) if (slot.spot && !near.includes(slot.spot)) slot.spot = null;
    for (const s of near) {
      if (pool.some((slot) => slot.spot === s)) continue;
      const free = pool.find((slot) => !slot.spot);
      if (!free) break;
      free.spot = s;
      free.weight = 0;
      free.light.position.copy(s.pos);
      free.light.color.set(s.color);
      free.light.distance = s.distance;
    }
  };
  pick();

  return {
    group,
    moon,
    lights: [],
    fires,
    update(time: number): void {
      for (const slot of pool) {
        const s = slot.spot;
        slot.weight = Math.min(1, slot.weight + (s ? 0.05 : -0.08));
        if (!s) {
          slot.light.intensity = 0;
          continue;
        }
        const f = s.flicker > 0 ? 0.5 * Math.sin(time * 11 + s.phase) + 0.3 * Math.sin(time * 23.7 + s.phase * 2) + 0.2 * Math.sin(time * 47.3 + s.phase * 3) : 0;
        slot.light.intensity = s.intensity * slot.weight * (1 + f * 0.22 * s.flicker);
      }
      pickT += 1 / 60;
      if (pickT > 0.25) {
        pickT = 0;
        pick();
      }
    },
    follow(x: number, z: number): void {
      hx = x;
      hz = z;
      // Snap the shadow frustum to whole texels so shadows do not shimmer while walking.
      const sx = Math.round(x / texel) * texel;
      const sz = Math.round(z / texel) * texel;
      moon.target.position.set(sx, 0, sz);
      moon.position.set(sx + MOON.x, MOON.y, sz + MOON.z);
    },
  };
}
