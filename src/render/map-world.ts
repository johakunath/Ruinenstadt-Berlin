// Builds an expedition map (M11) from `src/data/map.ts`: ground with water banks, street ribbons,
// bridges, generated Altbau blocks and houses, instanced trees, landmarks and props. Everything is
// grouped in chunks so the camera frustum culls what is off screen. Lamps are light *spots*; a
// fixed pool of point lights follows the hero (constant light count, no shader recompiles).
import {
  BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight,
  Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, Quaternion,
  SphereGeometry, TorusGeometry, Vector3, type Material, type Texture,
} from 'three';
import type { Facade, FacadeFeature, PlasterTone } from '../data/courtyard';
import { FERRY, ferryPos, type FerryLane } from '../sim/ferry';
import { GROUND_STEP, meshSurface } from './ground';
import { buildLotGround } from './lot-ground';
import { areaAt, heightAt, isQuay, wobble, isWater, isWaterPlain, onBridge, onStair, streetDist, type GroundKind, type Landmark, type Lot, type MapDef, type Pt, inTunnel, type Street } from '../data/map';
import type { Prop } from '../data/courtyard';
import { Rng } from '../sim/math';
import type { BreakableDef } from '../sim/breakables';
import { restAt, type RestArea } from '../sim/rest';
import { SPATI, spatiParts, spatiRest } from '../data/spati';
import { BatchSet, boxGeo } from './batch';
import { isLargeProp } from './layers';
import { Materials, type LitMaterial } from './materials';
import { loadGroundTexture } from './ground-textures';
import { tramOffsetPoint, TRAM_RAILS, TRAM_SECTION } from './tram-rails';
import { TRAM_BRIDGE_DECK } from '../data/tram';
import { paintAsphalt, paintConcrete, paintDirt, paintFern, paintGrass, paintLeafLitter, paintLitter, paintPaving, paintRoofTiles, paintTextSign, type PaintOptions } from './paint';
import {
  Builder, buildAltbau, buildProp, type BreakableView, wallFace, FLOOR_H, FX_LAYER, GROUND_H, makeMats, PARAPET, Run, UNIT_BOX, windowAt, type LightShape, type Mats, type World,
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
  railSteel: LitMaterial;
  ground: LitMaterial;
  /** Ground scatter atlas (puddles, leaves, trash, rubble). */
  litter: LitMaterial;
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
  spatiSign: LitMaterial;
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

  override light(pos: Vector3, color: number, intensity: number, distance: number, flicker: number, pool = 4, shape: LightShape = {}): void {
    const yaw = shape.yaw ?? 0;
    const reach = shape.reach ?? 0;
    const ux = Math.sin(yaw);
    const uz = Math.cos(yaw);
    // Directional lights sit a little toward what they light, so the moving pool light agrees with the decal.
    const lp = pos.clone().setY(pos.y + this.lift);
    lp.x += ux * reach * 0.5;
    lp.z += uz * reach * 0.5;
    this.spots.push({ pos: lp, color, intensity, distance, flicker, phase: Math.random() * 6 });
    let mat = this.glowMats.get(color);
    if (!mat) this.glowMats.set(color, (mat = Materials.glow(this.glowTex, color, 0.22)));
    const geo = new PlaneGeometry(pool * 2, pool * 2 * (shape.stretch ?? 1));
    geo.rotateX(-Math.PI / 2);
    this.glows.of(mat).add(geo, new Matrix4().makeRotationY(yaw).setPosition(pos.x + ux * reach, 0.035, pos.z + uz * reach));
    if (shape.halo) {
      // Halo around the lamp head: three crossed cards with the same additive glow.
      const h = shape.halo;
      for (const [rx, ry] of [[0, 0], [0, Math.PI / 2], [-Math.PI / 2, 0]] as const) {
        const card = new PlaneGeometry(h * 2, h * 2);
        this.glows.of(mat).add(card, new Matrix4().makeRotationY(ry).multiply(new Matrix4().makeRotationX(rx)).setPosition(pos.x, pos.y, pos.z));
      }
    }
  }
}

function makeMapMats(materials: Materials): MapMats {
  const base = makeMats(materials);
  const o: PaintOptions = { flatten: materials.look.flatten, normalMaps: materials.profile.normalMaps, anisotropy: materials.profile.anisotropy };
  const dirt = paintDirt(o).map;
  const uDirt = { value: dirt };
  const m: MapMats = {
    ...base,
    railSteel: materials.surface({ color: 0xbfc6c2, roughness: 0.34, metalness: 0.6, vertexColors: true }),
    ground: groundMaterial(materials, o, uDirt),
    litter: materials.surface({ map: paintLitter(), alphaTest: 0.5, roughness: 0.55, vertexColors: true }),
    asphalt: materials.surface({ map: paintAsphalt(o).map, roughness: 0.85, vertexColors: true }),
    path: materials.surface({ map: dirt, color: 0xc0b0a0, roughness: 0.95, vertexColors: true }),
    roof: materials.surface({ map: paintRoofTiles(o).map, roughness: 0.8, vertexColors: true }),
    tar: materials.surface({ map: paintAsphalt(o).map, color: 0x5a5650, roughness: 0.9, vertexColors: true }),
    concrete: materials.surface({ map: paintConcrete(o).map, roughness: 0.9, vertexColors: true }),
    mossy: materials.surface({ map: paintConcrete(o, '#6f7a5c').map, roughness: 0.9, vertexColors: true }),
    water: materials.surface({ color: 0x1a5560, emissive: 0x0a2228, roughness: 0.04, metalness: 0.55 }),
    trunk: materials.surface({ color: 0x3a2c22, roughness: 0.95 }),
    crown: materials.surface({ color: 0xffffff, roughness: 0.85 }),
    glass: materials.surface({ color: 0x1a2a2c, emissive: 0x5a8a7a, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.3 }),
    greenSign: materials.surface({ color: 0x0e3a1c, emissive: 0x2fbf5a, emissiveIntensity: 1.6, roughness: 0.5 }),
    spatiSign: (() => {
      const t = paintTextSign('SPÄTI', '#1a1e22', '#f2d14b');
      return materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffd060, emissiveIntensity: 1.5, roughness: 0.6 });
    })(),
    forumSign: (() => {
      const t = paintTextSign('FORUM', '#2a1a14', '#f0b27a');
      return materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffa050, emissiveIntensity: 1.4, roughness: 0.6 });
    })(),
    frond: materials.surface({ map: paintFern(), alphaTest: 0.5, doubleSided: true, roughness: 0.8, vertexColors: true }),
  };
  loadGroundTexture('dirt', o.anisotropy, texture => {
    uDirt.value = m.path.map = texture;
    dirt.dispose();
  });
  loadGroundTexture('litter', o.anisotropy, texture => {
    m.litter.map?.dispose();
    m.litter.map = texture;
  });
  return m;
}

// ---------------------------------------------------------------- ground and water

/**
 * Ground variant C (M11b, Johannes 2026-11-16): grass, dirt, paving and leaf litter blended per
 * vertex (`splat` weights) with a height blend, so grass grows into the paving joints and areas fade
 * into each other. Cost: three extra texture reads on ground pixels, no extra draw calls.
 */
function groundMaterial(materials: Materials, o: PaintOptions, uDirt: { value: Texture }): LitMaterial {
  const mat = materials.surface({ map: paintGrass(o).map, roughness: 0.95, vertexColors: true });
  const uPave = { value: paintPaving(o).map };
  const uLeaf = { value: paintLeafLitter(o).map };
  loadGroundTexture('grass', o.anisotropy, texture => {
    mat.map?.dispose();
    mat.map = texture;
  });
  for (const [surface, uniform] of [['paving', uPave], ['leaves', uLeaf]] as const) {
    loadGroundTexture(surface, o.anisotropy, texture => {
      uniform.value.dispose();
      uniform.value = texture;
    });
  }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDirt = uDirt;
    shader.uniforms.uPave = uPave;
    shader.uniforms.uLeaf = uLeaf;
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'attribute vec4 splat;\nvarying vec4 vSplat;\nvoid main() {\n  vSplat = splat;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform sampler2D uDirt;\nuniform sampler2D uPave;\nuniform sampler2D uLeaf;\nvarying vec4 vSplat;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `vec4 tG = texture2D(map, vMapUv);
        vec4 tD = texture2D(uDirt, vMapUv * 0.83 + 0.31);
        vec4 tP = texture2D(uPave, vMapUv);
        vec4 tL = texture2D(uLeaf, vMapUv * 1.17 + 0.57);
        // Height blend: dark paving joints and bright grass stalks win where weights are close.
        vec4 hgt = vec4(tG.g, tD.r, 1.0 - tP.r * 1.6, tL.r * 1.4);
        vec4 sw = vSplat + (hgt - 0.3) * 0.55 * step(0.02, vSplat);
        float top = max(max(sw.x, sw.y), max(sw.z, sw.w));
        sw = max(sw - (top - 0.2), vec4(0.0));
        sw /= max(1e-4, sw.x + sw.y + sw.z + sw.w);
        diffuseColor *= tG * sw.x + tD * sw.y + tP * sw.z + tL * sw.w;`,
      );
  };
  mat.customProgramCacheKey = () => 'ground-splat';
  return mat;
}

/** Base ground weights (grass, dirt, paving, leaves) per area kind. */
const GROUND_SPLAT: Record<GroundKind, readonly [number, number, number, number]> = {
  cobbles: [0.1, 0.05, 0.85, 0],
  asphalt: [0.05, 0.1, 0.85, 0],
  grass: [0.85, 0.15, 0, 0],
  forest: [0.25, 0.15, 0, 0.6],
  jungle: [0.75, 0.1, 0, 0.15],
};

/** Vertex tint per kind (the textures carry the hue; this only shifts it). */
const GROUND_TINT: Record<GroundKind, RGB> = {
  cobbles: [1, 0.97, 0.94],
  asphalt: [0.78, 0.78, 0.76],
  grass: [1, 1, 1],
  forest: [0.85, 0.9, 0.82],
  jungle: [0.9, 1.15, 0.8],
};

function groundSplat(m: MapDef, x: number, z: number, shore: boolean): [number, number, number, number] {
  // Soft area borders: average the base weights over a 6 m cross.
  const w = [0, 0, 0, 0];
  for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]] as const) {
    const k = GROUND_SPLAT[areaAt(m, x + dx, z + dz)?.ground ?? m.defaultGround];
    for (let i = 0; i < 4; i++) w[i]! += k[i]! / 5;
  }
  // Overgrowth: grass takes over patches of paving.
  const grow = Math.min(1, Math.max(0, wobble(x - 13, z + 29, 3.1) + 0.2) * 1.2);
  const take = w[2]! * grow * 0.8;
  w[2]! -= take;
  w[0]! += take;
  // Bare earth patches, worn verges along streets, mud on natural banks.
  w[1]! += Math.max(0, wobble(x + 77, z - 31, 2.6) - 0.25) * 0.9;
  if (shore) w[1]! += 0.7;
  const sd = streetDist(m, x, z).d;
  if (sd < 1.5 && w[0]! > 0.4) w[1]! += 0.35;
  return [w[0]!, w[1]!, w[2]!, w[3]!];
}

const surfaces = new WeakMap<MapDef, (x: number, z: number) => number>();
/** Height of the drawn ground under (x, z): see `meshSurface`. */
function surfaceAt(m: MapDef, x: number, z: number): number {
  let f = surfaces.get(m);
  if (!f) {
    f = meshSurface(m.bounds.minX, m.bounds.minZ, (px, pz) => heightAt(m, px, pz));
    surfaces.set(m, f);
  }
  return f(x, z);
}

function buildGround(m: MapDef, mats: MapMats, group: Group): void {
  const step = GROUND_STEP;
  const B = m.bounds;
  const height = (x: number, z: number): number => (isWater(m, x, z) && !onBridge(m, x, z) ? -1.4 : heightAt(m, x, z));
  for (let cz = B.minZ; cz < B.maxZ; cz += CHUNK) {
    for (let cx = B.minX; cx < B.maxX; cx += CHUNK) {
      const n = Math.ceil(Math.min(CHUNK, B.maxX - cx) / step);
      const k = Math.ceil(Math.min(CHUNK, B.maxZ - cz) / step);
      const pos: number[] = [];
      const col: number[] = [];
      const uv: number[] = [];
      const splat: number[] = [];
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
          const nearWater = y >= -0.5 && (isWater(m, x + 1.6, z) || isWater(m, x - 1.6, z) || isWater(m, x, z + 1.6) || isWater(m, x, z - 1.6));
          // Damp, dark banks.
          const shore = y < -0.5 ? 0.35 : nearWater ? 0.6 : 1;
          // M19 tunnel: ground outside the tubes is rock in the dark (the walls hide most of it).
          const rock = m.tunnel && !inTunnel(m, x, z, -1.5) ? 0.06 : 1;
          col.push(t[0] * noise * shore * rock, t[1] * noise * shore * rock, t[2] * noise * shore * rock);
          splat.push(...groundSplat(m, x, z, nearWater && !isQuay(m, x, z)));
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
      g.setAttribute('splat', new BufferAttribute(new Float32Array(splat), 4));
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

/**
 * Stone quays where a bank runs through cobbles or asphalt areas (natural banks wobble, `isWater`).
 * The wall reaches 1.5 m into the land so it covers the ground mesh's slope down to the riverbed.
 */
function buildQuays(m: MapDef, mats: MapMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  const edges: Array<{ pts: readonly Pt[]; off: number }> = [];
  for (const r of m.rivers) for (const side of [-1, 1]) edges.push({ pts: r.pts, off: (side * r.width) / 2 });
  for (const lake of m.lakes) edges.push({ pts: [...lake, lake[0] as Pt], off: 0 });
  const STEP = 2;
  for (const e of edges) {
    for (let i = 1; i < e.pts.length; i++) {
      const [ax, az] = e.pts[i - 1] as Pt;
      const [bx, bz] = e.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.1) continue;
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      const n = Math.ceil(len / STEP);
      for (let k = 0; k < n; k++) {
        const t = ((k + 0.5) / n) * len;
        const x = ax + dx * t - dz * e.off;
        const z = az + dz * t + dx * e.off;
        // Water side: the normal whose short step lands in (authored) water.
        let wx = -dz;
        let wz = dx;
        if (!isWaterPlain(m, x + wx, z + wz)) {
          wx = dz;
          wz = -dx;
          if (!isWaterPlain(m, x + wx, z + wz)) continue;
        }
        if (isWaterPlain(m, x - wx * 1.2, z - wz * 1.2)) continue; // a junction, water on both sides
        if (!isQuay(m, x - wx, z - wz) || onBridge(m, x, z, 1)) continue;
        const piece = len / n + 0.05;
        const yaw = Math.atan2(dx, dz);
        const at = (o: number, y: number): Matrix4 => new Matrix4().makeRotationY(yaw).setPosition(x - wx * o, y, z - wz * o);
        const b = chunkOf(x, z);
        b.box(mats.cobbles, at(0.6, -0.78), 1.8, 1.68, piece, [0.5, 0.48, 0.45]);
        b.box(mats.cobbles, at(-0.05, 0.08), 0.5, 0.12, piece, [0.85, 0.82, 0.76]);
      }
    }
  }
}

/**
 * Ground scatter (variant C): puddles, leaf piles, trash and rubble decals from one atlas, plus weed
 * tufts (fern cards). Seeded, on a jittered 4 m grid, chosen by where it lies.
 */
function buildScatter(m: MapDef, lots: Lot[], mats: MapMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  type Kind = 'puddle' | 'leaves' | 'trash' | 'rubble' | 'tuft';
  const cell: Record<Exclude<Kind, 'tuft'>, [number, number]> = { puddle: [0, 1], leaves: [1, 1], trash: [0, 0], rubble: [1, 0] };
  const decal = new Map<Kind, PlaneGeometry>();
  for (const [k, [cu, cv]] of Object.entries(cell) as Array<[Kind, [number, number]]>) {
    const g = new PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cu + uv.getX(i)) / 2, (cv + uv.getY(i)) / 2);
    decal.set(k, g);
  }
  const tuft = new PlaneGeometry(1.3, 0.85);
  tuft.translate(0, 0.42, 0);
  // Chances per spot: [puddle, leaves, trash, rubble, tuft].
  const odds = (onStreet: boolean, g: GroundKind): number[] =>
    onStreet ? [0.1, 0.04, 0.05, 0.04, 0]
    : g === 'forest' ? [0.02, 0.22, 0, 0.01, 0.06]
    : g === 'grass' || g === 'jungle' ? [0.03, 0.05, 0.02, 0.02, 0.14]
    : [0.06, 0.03, 0.05, 0.07, 0.1];
  const kinds: Kind[] = ['puddle', 'leaves', 'trash', 'rubble', 'tuft'];
  const rng = new Rng(m.seed + 91);
  const B = m.bounds;
  const G = 4;
  for (let z = B.minZ + 2; z < B.maxZ - 2; z += G) {
    for (let x = B.minX + 2; x < B.maxX - 2; x += G) {
      const px = x + rng.range(-1.6, 1.6);
      const pz = z + rng.range(-1.6, 1.6);
      const roll = rng.next();
      const size = rng.range(1, 2.4);
      const yaw = rng.range(0, Math.PI * 2);
      if (isWater(m, px, pz) || onBridge(m, px, pz, 1)) continue;
      const sd = streetDist(m, px, pz).d;
      const o = odds(sd < 0, areaAt(m, px, pz)?.ground ?? m.defaultGround);
      let acc = 0;
      let kind: Kind | null = null;
      for (let i = 0; i < kinds.length; i++) {
        acc += o[i]!;
        if (roll < acc) {
          kind = kinds[i]!;
          break;
        }
      }
      if (!kind) continue;
      if (lots.some((l) => l.kind !== 'tree' && Math.hypot(px - l.x, pz - l.z) < Math.max(l.w, l.d) / 2 + 0.4)) continue;
      if (m.landmarks.some((l) => Math.abs(px - l.x) < l.hx + 1 && Math.abs(pz - l.z) < l.hz + 1)) continue;
      const y = surfaceAt(m, px, pz);
      const b = chunkOf(px, pz);
      if (kind === 'tuft') {
        for (let i = 0; i < 2; i++) {
          const mt = new Matrix4().makeRotationY(yaw + (i * Math.PI) / 2).setPosition(px, y, pz);
          b.cards.of(mats.frond).add(tuft, mt, [0.95, 1.1, 0.7]);
        }
        continue;
      }
      const s = kind === 'puddle' ? size * 1.3 : size;
      const mt = new Matrix4().makeRotationY(yaw).scale(new Vector3(s, 1, s)).setPosition(px, y + (sd < 0 ? 0.045 : 0.03), pz);
      b.solid.of(mats.litter).add(decal.get(kind)!, mt);
    }
  }
}

/** Street ribbons with round joints; world-space UVs keep the texture seamless. */
function buildStreets(m: MapDef, mats: MapMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  const tramStreets = { ...m, streets: m.streets.filter(s => s.tram) };
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
        const v = (x: number, z: number): Vector3 => new Vector3(x, y + surfaceAt(m, x, z), z);
        const b = chunkOf((x0 + x1) / 2, (z0 + z1) / 2);
        const batch = b.solid.of(mat);
        // Point on the piece: u along (0..1), w across (-1..1).
        const at = (u: number, w: number): Vector3 => v(x0 + (x1 - x0) * u + nx * w, z0 + (z1 - z0) * u + nz * w);
        // On curved ground one flat quad cuts through the slope (playtest 2026-11-17): where its
        // middle or an edge leaves the ground by more than 1.5 cm, lay it in cells of about a meter.
        const c00 = at(0, -1), c01 = at(0, 1), c11 = at(1, 1), c10 = at(1, -1);
        const flatY = (u: number, w: number): number => { const k = (w + 1) / 2; return (c00.y * (1 - k) + c01.y * k) * (1 - u) + (c10.y * (1 - k) + c11.y * k) * u; };
        const bent = ([[0.5, 0], [0.5, -1], [0.5, 1], [0, 0], [1, 0], [0.25, -0.5], [0.75, 0.5]] as const).some(([u, w]) => Math.abs(at(u, w).y - flatY(u, w)) > 0.015);
        const nu = bent ? Math.max(1, Math.ceil((t1 - t0) / 1)) : 1;
        const nw = bent ? Math.max(1, Math.ceil(s.width / 1)) : 1;
        for (let iu = 0; iu < nu; iu++) for (let iw = 0; iw < nw; iw++) {
          const u0 = iu / nu, u1 = (iu + 1) / nu, w0 = -1 + (2 * iw) / nw, w1 = -1 + (2 * (iw + 1)) / nw;
          // quad() takes counter-clockwise corners seen from above; UVs in world meters.
          batch.quad([at(u0, w0), at(u0, w1), at(u1, w1), at(u1, w0)], [0, 0, 1, 1]);
          fixWorldUv(batch, 4, 4);
        }
        if (s.tram) {
          // Embedded grooved rails: worn steel head, inward flange groove and guard lip,
          // rust at the edges and an asphalt repair seam. No exposed railway sleepers in a street.
          for (const rail of TRAM_RAILS) for (const band of TRAM_SECTION) {
            const off = rail.offset + rail.inward * band.offset;
            const point = (offset: number, t: number): Vector3 => {
              const a = tramOffsetPoint(s.pts, i - 1, offset);
              const c = tramOffsetPoint(s.pts, i, offset);
              const x = a[0] + (c[0] - a[0]) * t;
              const z = a[1] + (c[1] - a[1]) * t;
              const surface = (onBridge(m, x, z) ? Math.max(y, TRAM_BRIDGE_DECK) : y) + (s.profile === 'allee' ? 0.07 : 0);
              return new Vector3(x, surfaceAt(m, x, z) + surface + band.height, z);
            };
            const half = band.width / 2;
            const corners: [Vector3, Vector3, Vector3, Vector3] = [
              point(off + half, t0 / len), point(off - half, t0 / len),
              point(off - half, t1 / len), point(off + half, t1 / len),
            ];
            const material = band.kind === 'seam' ? mats.asphalt : band.kind === 'rust' ? mats.rust
              : band.kind === 'groove' ? mats.rubber : mats.railSteel;
            const tint: RGB = band.kind === 'guard' ? [0.5, 0.47, 0.42] : band.kind === 'seam' ? [0.63, 0.59, 0.54]
              : band.kind === 'head' ? [0.96, 0.98, 1] : [1, 1, 1];
            const railBatch = b.solid.of(material);
            railBatch.quad(corners, [0, 0, 1, 1], [tint]);
            fixWorldUv(railBatch, 4, 4);
          }
        }
        if (s.profile && !onBridge(m, (x0 + x1) / 2, (z0 + z1) / 2, 1)) buildProfile(m, s, mats, b, x0, z0, x1, z1, dx, dz, y, p);
        // Curbs mark the walkable street edge (v2, M11b); not on paths and bridges.
        if (s.kind !== 'path' && !onBridge(m, x0, z0, 1) && !onBridge(m, x1, z1, 1)) {
          const yaw = Math.atan2(dx, dz);
          for (const side of [-1, 1]) {
            const cx = (x0 + x1) / 2 + side * nx * (1 + 0.12 / (s.width / 2));
            const cz = (z0 + z1) / 2 + side * nz * (1 + 0.12 / (s.width / 2));
            if (isWater(m, cx, cz)) continue;
            // A crossing side street must not put a raised curb across the tram rails.
            if (!s.tram && streetDist(tramStreets, cx, cz).d < (t1 - t0) / 2 + 0.12) continue;
            b.box(mats.cobbles, new Matrix4().makeRotationY(yaw).setPosition(cx, surfaceAt(m, cx, cz) + 0.06, cz), 0.24, 0.16, t1 - t0 + 0.02, [0.8, 0.8, 0.78]);
          }
        }
      }
      if (i < s.pts.length - 1 || s.kind === 'path') {
        const disc = new CircleGeometry(s.width / 2, 16);
        disc.rotateX(-Math.PI / 2);
        worldUv(disc, bx, bz, 4);
        chunkOf(bx, bz).solid.of(mat).add(disc, new Matrix4().setPosition(bx, y + 0.001 + surfaceAt(m, bx, bz), bz));
      }
    }
  }
}

/**
 * M11d street profile on one piece (Johannes, 2026-11-17): `haupt` gets dashed lane lines beside the
 * tram and a solid parking line; `allee` a raised grass track with low curbs. Both get paved sidewalks
 * and tree pits (`TREE_PIT`, the trees themselves are lots). Merged quads and boxes, no extra draws.
 */
function buildProfile(m: MapDef, s: Street, mats: MapMats, b: ChunkBuilder, x0: number, z0: number, x1: number, z1: number, dx: number, dz: number, y: number, piece: number): void {
  const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(dx, dz), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const across = (off: number): [number, number] => [cx - dz * off, cz + dx * off];
  const paint = (off: number, w: number, l: number, along = 0): void => {
    const [x, z] = across(off);
    b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(x + dx * along, surfaceAt(m, x, z) + y + 0.006, z + dz * along), w, 0.01, l, [0.92, 0.9, 0.84]);
  };
  if (s.profile === 'haupt') {
    // Dashed lines (3 m dash, 3 m gap) at the edge of the tram zone, solid lines at the parking lanes.
    if (piece % 2 === 0) for (const side of [-1, 1]) paint(side * 3.1, 0.12, Math.min(3, len));
    for (const side of [-1, 1]) paint(side * (s.width / 2 - 2.2), 0.1, len + 0.02);
  } else {
    const [mx, mz] = across(0);
    b.box(mats.mossy, new Matrix4().makeRotationY(yaw).setPosition(mx, surfaceAt(m, mx, mz) + y + 0.035, mz), 5.2, 0.07, len + 0.02, [0.3, 0.4, 0.22]);
    for (const side of [-1, 1]) {
      const [ex, ez] = across(side * 2.7);
      b.box(mats.cobbles, new Matrix4().makeRotationY(yaw).setPosition(ex, surfaceAt(m, ex, ez) + y + 0.06, ez), 0.18, 0.1, len + 0.02, [0.78, 0.78, 0.76]);
    }
  }
  const sw = s.sidewalk ?? 0;
  if (sw <= 0) return;
  for (const side of [-1, 1]) {
    const [px, pz] = across(side * (s.width / 2 + 0.12 + sw / 2));
    if (isWater(m, px, pz)) continue;
    b.box(mats.cobbles, new Matrix4().makeRotationY(yaw).setPosition(px, surfaceAt(m, px, pz) + 0.04, pz), sw, 0.04, len + 0.02, [0.74, 0.72, 0.68]);
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

/** The ferry boat at its own origin, deck top at y 0, length along local Z. */
function buildFerryBoat(mats: MapMats, width: number): Group {
  const b = new ChunkBuilder(mats);
  const L = FERRY.boat;
  b.box(mats.rust, new Matrix4().setPosition(0, -0.6, 0), width + 0.4, 1.0, L - 0.6, [0.75, 0.6, 0.5]);
  b.box(mats.rust, new Matrix4().setPosition(0, -0.35, 0), width + 0.6, 0.25, L, [0.9, 0.85, 0.8]);
  b.box(mats.wood, new Matrix4().setPosition(0, -0.06, 0), width, 0.12, L, [1.25, 1.12, 0.95]);
  for (const side of [-1, 1]) {
    // Rails along both long sides, open at the bow and the stern.
    b.box(mats.iron, new Matrix4().setPosition(side * (width / 2 + 0.1), 0.95, 0), 0.07, 0.07, L - 0.4, [1.3, 1.25, 1.1]);
    for (let z = -L / 2 + 0.3; z <= L / 2 - 0.3; z += 1.2) b.box(mats.iron, new Matrix4().setPosition(side * (width / 2 + 0.1), 0.48, z), 0.06, 0.95, 0.06, [1.3, 1.25, 1.1]);
    // Ramps hinged at both ends.
    b.box(mats.iron, new Matrix4().makeRotationX(side * 0.12).setPosition(0, -0.02, side * (L / 2 + 0.3)), width - 0.4, 0.08, 0.7, [0.8, 0.8, 0.75]);
  }
  // Small wheelhouse hanging over the side, out of the walkway.
  b.box(mats.stucco, new Matrix4().setPosition(width / 2 + 1.1, 1.0, 1.2), 1.8, 2.0, 2.4, [1.05, 1.0, 0.95]);
  b.box(mats.rust, new Matrix4().setPosition(width / 2 + 1.1, 2.08, 1.2), 2.2, 0.16, 2.8, [0.6, 0.45, 0.35]);
  b.box(mats.rust, new Matrix4().setPosition(width / 2 + 1.1, -0.55, 1.2), 2.0, 1.0, 2.8, [0.75, 0.6, 0.5]);
  const g = new Group();
  for (const mesh of b.solid.meshes()) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

function buildBridges(m: MapDef, chunkOf: (x: number, z: number) => ChunkBuilder, boats: Array<{ lane: FerryLane; group: Group }>): void {
  for (const br of m.bridges) {
    const b = chunkOf(br.x, br.z);
    const mats = b.mm;
    const base = new Matrix4().makeRotationY(br.rot).setPosition(br.x, 0, br.z);
    const local = (x: number, y: number, z: number): Matrix4 => base.clone().multiply(new Matrix4().setPosition(x, y, z));
    if (br.kind === 'ferry') {
      // Two wooden piers on posts; the boat itself moves (`buildFerryBoat`, `World.sync`).
      const pl = FERRY.pier + 0.5;
      for (const end of [-1, 1]) {
        const c = end * (br.len / 2 - pl / 2);
        b.box(mats.wood, local(0, -0.1, c), br.width, 0.2, pl, [1.15, 1.05, 0.9]);
        for (const side of [-1, 1]) {
          for (const z of [c - pl / 2 + 0.3, c + pl / 2 - 0.3]) b.box(mats.wood, local(side * (br.width / 2 - 0.2), -0.9, z), 0.3, 1.6, 0.3, [0.55, 0.5, 0.45]);
          b.box(mats.iron, local(side * (br.width / 2 + 0.05), 0.5, c), 0.06, 0.06, pl);
          b.box(mats.iron, local(side * (br.width / 2 + 0.05), 0.25, c - pl / 2 + 0.2), 0.06, 0.5, 0.06);
        }
      }
      boats.push({ lane: br, group: buildFerryBoat(mats, br.width) });
      continue;
    }
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

// ---------------------------------------------------------------- M19 tunnel

/**
 * Tunnel walls along both edges of every tube (open where another tube joins), thick enough that the
 * camera sees rock beyond, with a tiled band on station walls; two tracks with sleepers on the track
 * bed and tiled platforms beside it in stations. Cost: merged boxes per chunk, no extra lights.
 */
function buildTunnel(m: MapDef, mats: MapMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  const H = 4.6;
  for (const t of m.tunnel!.tubes) {
    for (let i = 1; i < t.pts.length; i++) {
      const [ax, az] = t.pts[i - 1]!, [bx, bz] = t.pts[i]!, len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len, yaw = Math.atan2(ux, uz);
      for (const side of [-1, 1]) {
        // Normal pointing out of the tube on this side.
        const nx = uz * side, nz = -ux * side;
        for (let d = 0; d < len; d += 1) {
          const cx = ax + ux * (d + 0.5), cz = az + uz * (d + 0.5);
          const ex = cx + nx * t.width / 2, ez = cz + nz * t.width / 2;
          // Open where the wall would stand inside another tube (a junction).
          if (inTunnel(m, ex + nx * 0.6, ez + nz * 0.6)) continue;
          // As thick as fits before the next tube.
          let thick = 12;
          while (thick > 1 && (inTunnel(m, ex + nx * thick, ez + nz * thick) || inTunnel(m, ex + nx * thick / 2, ez + nz * thick / 2))) thick /= 2;
          const b = chunkOf(cx, cz);
          const mx = ex + nx * thick / 2, mz = ez + nz * thick / 2;
          b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(mx, H / 2, mz), thick, H, 1.04, [0.42, 0.4, 0.38]);
          b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(mx, H + 0.05, mz), thick + 0.4, 0.1, 1.04, [0.08, 0.08, 0.09]);
          b.shadowBox(new Matrix4().makeRotationY(yaw).setPosition(mx, H / 2, mz), thick, H, 1.04);
          if (t.kind === 'station') {
            // Tiled band at eye height (cream tiles with a dark stripe), as on the old S-Bahn halls.
            b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(ex + nx * 0.02, 1.6, ez + nz * 0.02), 0.08, 1.8, 1.04, [0.86, 0.82, 0.7]);
            b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(ex + nx * 0.01, 2.25, ez + nz * 0.01), 0.1, 0.18, 1.04, [0.22, 0.32, 0.3]);
          }
        }
      }
      if (t.kind === 'track') {
        // Two tracks: rails 1.435 m apart, sleepers every 0.7 m.
        for (const off of [-2.6, 2.6]) {
          for (const r of [-0.72, 0.72]) {
            const x = (ax + bx) / 2 + uz * (off + r), z = (az + bz) / 2 - ux * (off + r);
            chunkOf(x, z).box(mats.railSteel, new Matrix4().makeRotationY(yaw).setPosition(x, 0.08, z), 0.08, 0.14, len + 0.05, [0.7, 0.68, 0.64]);
          }
          for (let d = 0.35; d < len; d += 0.7) {
            const x = ax + ux * d + uz * off, z = az + uz * d - ux * off;
            chunkOf(x, z).box(mats.trunk, new Matrix4().makeRotationY(yaw).setPosition(x, 0.03, z), 2.4, 0.06, 0.22, [0.5, 0.42, 0.36]);
          }
        }
      }
      if (t.kind === 'station') {
        // Platforms: tiled strips between the track bed and the station wall.
        for (const side of [-1, 1]) {
          const inner = 6.5, outer = t.width / 2 - 0.1, w = outer - inner, mid = (inner + outer) / 2;
          const x = (ax + bx) / 2 + uz * mid * side, z = (az + bz) / 2 - ux * mid * side;
          chunkOf(x, z).box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(x, 0.04, z), w, 0.08, len, [0.62, 0.6, 0.55]);
          const ex = (ax + bx) / 2 + uz * (inner + 0.2) * side, ez = (az + bz) / 2 - ux * (inner + 0.2) * side;
          chunkOf(ex, ez).box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(ex, 0.05, ez), 0.35, 0.1, len, [0.85, 0.75, 0.3]);
        }
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

/**
 * Burnt-out shell of an Altbau, shop or house: no roof, every bay broken off at its own height, empty
 * window holes, a dark inner face and rubble inside. Same footprint and collider as the intact lot.
 */
function buildRuin(b: ChunkBuilder, l: Lot): void {
  const rng = new Rng(l.seed + 77);
  const tone = rng.pick(TONES);
  const plaster = b.mm.plaster[tone] as LitMaterial;
  const H = l.kind === 'house' ? 3.4 + l.floors * 2.9 : GROUND_H + l.floors * FLOOR_H + PARAPET;
  const wall = 0.4;
  const inner: RGB = [0.32, 0.3, 0.3];
  blockFacades(l).forEach((side, i) => {
    const run = new Run({ id: 'r', style: 'altbau', ax: side.a[0], az: side.a[1], bx: side.b[0], bz: side.b[1], depth: 1, floors: 0, tone, features: [], seed: l.seed + i });
    const bays = Math.max(1, Math.round(side.len / 2.7));
    const bw = side.len / bays;
    // The street front stands highest; back and sides crumble more.
    const keep: [number, number] = i === 0 ? [0.45, 1] : [0.2, 0.85];
    for (let k = 0; k < bays; k++) {
      const s0 = k * bw;
      const s1 = (k + 1) * bw;
      const h = Math.max(1.2, H * rng.range(keep[0], keep[1]));
      wallFace(b, run, plaster, s0, s1, 0, h);
      b.solid.of(plaster).quad([run.pt(s1, 0, -wall), run.pt(s0, 0, -wall), run.pt(s0, h, -wall), run.pt(s1, h, -wall)], [0, 0, bw / 6, h / 6], [inner]);
      // Broken top: a slab of masonry, then loose bricks.
      b.box(b.mm.brick, run.mat((s0 + s1) / 2, h - 0.08, -wall / 2, 0, rng.range(-0.06, 0.06)), bw + 0.02, 0.16, wall + 0.04, [0.7, 0.62, 0.58]);
      for (let j = 0; j < 2; j++) b.box(b.mm.brick, run.mat(rng.range(s0 + 0.2, s1 - 0.2), h + 0.1, -wall / 2, rng.range(-0.4, 0.4), rng.range(-0.4, 0.4)), rng.range(0.25, 0.6), rng.range(0.15, 0.3), 0.35, [0.75, 0.68, 0.62]);
      // Empty window holes on every floor that still stands.
      const mid = (s0 + s1) / 2;
      const rows = l.kind === 'house' ? [1.1, 4.0] : [1.55, ...Array.from({ length: l.floors }, (_, f) => GROUND_H + f * FLOOR_H + 0.95)];
      for (const y of rows) if (y + 2 < h) windowAt(b, run, rng, mid, y, 1.15, 1.75, 0, false);
    }
    b.shadowBox(run.mat(side.len / 2, H * 0.35, -wall / 2), side.len, H * 0.7, wall);
  });
  // Inside: charred floor, rubble heaps, a fallen beam.
  const m4 = new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0.04, l.z);
  b.box(b.mm.tar, m4, l.w - 0.8, 0.06, l.d - 0.8, [0.35, 0.33, 0.32]);
  for (let i = 0; i < 6; i++) {
    const g = rng.range(0.55, 0.85);
    const p = m4.clone().multiply(new Matrix4().makeRotationY(rng.range(0, 3)).setPosition(rng.range(-l.w / 2 + 1.2, l.w / 2 - 1.2), 0.2, rng.range(-l.d / 2 + 1.2, l.d / 2 - 1.2)));
    b.box(b.mm.brick, p.multiply(new Matrix4().makeRotationX(rng.range(-0.3, 0.3))), rng.range(1, 2.6), rng.range(0.4, 1.1), rng.range(1, 2.2), [g, g * 0.92, g * 0.88]);
  }
  b.box(b.mm.darkWood, m4.clone().multiply(new Matrix4().makeRotationY(rng.range(0, 3)).setPosition(0, 0.9, 0)).multiply(new Matrix4().makeRotationZ(0.35)), Math.min(l.w, l.d) * 0.8, 0.25, 0.25, [0.4, 0.35, 0.3]);
}

/** An Altbau, shop or Platte block; `inner` marks a back wing (no shop front, door only at the back). */
export function buildAltbauLot(b: ChunkBuilder, l: Lot & { inner?: boolean }, m: MapDef): void {
  const rng = new Rng(l.seed);
  const tone = rng.pick(TONES);
  const sides = blockFacades(l);
  const main = streetDist(m, l.x + Math.sin(l.rot) * l.d, l.z + Math.cos(l.rot) * l.d).street?.kind === 'main';
  sides.forEach((s, i) => {
    const features: FacadeFeature[] = [];
    if (i === 0 && l.kind === 'shop') {
      // Single-storey Laden / Späti: shop window over most of the front.
      const from = Math.max(0.6, (s.len - 7) / 2);
      features.push({ kind: 'spati', from, to: Math.min(s.len - 0.6, from + 7) });
    } else if (i === 0 && !l.inner) {
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
    // Organic light at height (Johannes 2026-11-16): some street doors get front steps and a wall
    // lamp that throws a pool onto the sidewalk; warm, cold LED or (rarely) teal.
    const door = i === 0 && !l.inner ? features.find((g) => g.kind === 'door') : undefined;
    if (door) {
      const run = new Run(f);
      const mid = (door.from + door.to) / 2;
      if (rng.next() < 0.5) {
        b.box(b.mm.cobbles, run.mat(mid, 0.1, 0.45), 2.0, 0.2, 0.9, [0.85, 0.82, 0.78]);
        b.box(b.mm.cobbles, run.mat(mid, 0.27, 0.25), 1.7, 0.16, 0.5, [0.9, 0.87, 0.83]);
      }
      if (rng.next() < 0.45) {
        const roll = rng.next();
        const color = roll < 0.6 ? 0xffb060 : roll < 0.85 ? 0xd8ecff : 0x5fd8c8;
        b.solid.excludeOccluder(() => {
          b.box(b.mm.iron, run.mat(mid, 3.0, 0.2), 0.05, 0.05, 0.4, [0.6, 0.6, 0.6]);
          b.geo(b.mm.lampGlass, new SphereGeometry(0.13, 8, 6), run.mat(mid, 2.88, 0.42), color === 0xffb060 ? [1.6, 1.25, 0.6] : color === 0xd8ecff ? [1.3, 1.5, 1.8] : [0.7, 1.7, 1.6]);
        });
        b.light(run.pt(mid, 2.85, 0.45), color, rng.range(10, 22), 9, 0.03, rng.range(3, 4.2), { yaw: run.yaw, stretch: 1.5, reach: 1.8, halo: 0.45 });
      }
    }
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
  walls(b, l, plaster, h, l.floors ? [1.1, 4.0] : [1.1], l.seed, 0.08);
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

function buildTrees(m: MapDef, lots: Lot[], mats: MapMats, chunkKey: (x: number, z: number) => string, group: Group): void {
  const buckets = new Map<string, TreeBucket>();
  for (const l of lots) {
    if (l.kind !== 'tree' || l.jungle) continue;
    const k = chunkKey(l.x, l.z);
    let bk = buckets.get(k);
    if (!bk) buckets.set(k, (bk = { trunks: [], crowns: [] }));
    const rng = new Rng(l.seed);
    const h = rng.range(3.5, 6);
    const lean = rng.range(-0.12, 0.12);
    const base = surfaceAt(m, l.x, l.z);
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
    // Always: without trunk shadows the crown shadows float (playtest 2026-11-15). Instanced, cheap.
    trunks.castShadow = true;
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

/**
 * Späti rest stop (M11b part 2): brick shop with a rolled-up shutter, sign and lit shop windows; inside
 * shelves full of goods, glowing fridges, counter with till, mattress and a workbench with a radio.
 * `b` gets everything up to knee height plus the interior; `up` gets the upper walls and the roof.
 */
function buildSpati(b: ChunkBuilder, up: ChunkBuilder, l: Landmark): void {
  const M = b.mm;
  const { w, d, door, height: H } = SPATI;
  const LOW = 1.1;
  const rng = new Rng(Math.round(l.x * 31 + l.z * 17));
  b.box(M.cobbles, lm(l, 0, 0.04, 0), w - 0.4, 0.08, d - 0.4, [0.42, 0.38, 0.34]);
  for (const p of spatiParts()) {
    if (p.kind === 'wall') {
      b.box(M.brick, lm(l, p.x, LOW / 2, p.z), p.hx * 2, LOW, p.hz * 2);
      up.box(M.brick, lm(l, p.x, LOW + (H - LOW) / 2, p.z), p.hx * 2, H - LOW, p.hz * 2);
    } else if (p.kind === 'shelf') {
      b.box(M.darkWood, lm(l, p.x, 0.9, p.z), p.hx * 2, 1.8, p.hz * 2, [1.1, 1, 0.95]);
      // Goods on three boards, on both faces of the free-standing shelf.
      const faces = p.z > -1 ? [-1, 1] : [1];
      for (const f of faces) {
        for (const y of [0.5, 1.0, 1.5]) {
          for (let x = -p.hx + 0.15; x < p.hx - 0.1; x += rng.range(0.16, 0.26)) {
            if (rng.next() < 0.18) continue; // looted gaps
            const tint: [number, number, number] = rng.pick([[1.4, 0.4, 0.3], [0.4, 0.6, 1.4], [1.5, 1.3, 0.4], [0.5, 1.2, 0.5], [1.4, 1.3, 1.2], [1.3, 0.7, 0.3]] as Array<[number, number, number]>);
            const h = rng.range(0.15, 0.3);
            b.box(M.stucco, lm(l, p.x + x, y + h / 2, p.z + f * (p.hz + 0.06)), rng.range(0.1, 0.16), h, 0.12, tint);
          }
        }
      }
    } else if (p.kind === 'fridge') {
      b.box(M.iron, lm(l, p.x, 1.05, p.z), p.hx * 2, 2.1, p.hz * 2, [1.2, 1.25, 1.3]);
      b.box(M.glass, lm(l, p.x - p.hx - 0.02, 1.1, p.z), 0.04, 1.7, p.hz * 2 - 0.2, [1.4, 2.2, 2.4]);
      b.light(lp(l, p.x - 1, 1.3, p.z), 0x8fe0ff, 3, 4, 0, 2);
    } else if (p.kind === 'counter') {
      // Theke: a wooden body with a lighter top, the till, a jar, a stack of papers and a small price board.
      b.box(M.darkWood, lm(l, p.x, 0.48, p.z), p.hx * 2, 0.96, p.hz * 2, [1.3, 1.05, 0.9]);
      b.box(M.wood, lm(l, p.x, 1.0, p.z), p.hx * 2 + 0.12, 0.07, p.hz * 2 + 0.14, [1.25, 1.1, 0.95]);
      b.box(M.rust, lm(l, p.x + 0.9, 1.17, p.z), 0.42, 0.26, 0.36, [0.7, 0.7, 0.75]);
      b.box(M.sign, lm(l, p.x + 0.9, 1.34, p.z + 0.12), 0.3, 0.12, 0.03);
      b.box(M.glass, lm(l, p.x - 0.2, 1.17, p.z - 0.05), 0.2, 0.28, 0.2, [1.6, 1.3, 0.6]);
      b.box(M.stucco, lm(l, p.x - 0.9, 1.07, p.z + 0.05), 0.34, 0.07, 0.26, [1.3, 1.25, 1.1]);
      b.box(M.stucco, lm(l, p.x - 1.35, 1.14, p.z), 0.14, 0.2, 0.14, [1.4, 0.4, 0.3]);
      b.box(M.sign, lm(l, p.x, 0.62, p.z + p.hz + 0.02), 1.5, 0.42, 0.03);
    } else if (p.kind === 'bench') {
      b.box(M.wood, lm(l, p.x, 0.45, p.z), p.hx * 2, 0.9, p.hz * 2);
      b.box(M.rust, lm(l, p.x - 0.35, 1.03, p.z), 0.46, 0.26, 0.26, [0.5, 0.6, 0.7]);
      b.box(M.iron, lm(l, p.x - 0.2, 1.3, p.z), 0.03, 0.35, 0.03);
    }
  }
  // Mattress and blanket between the shelves at the back (the counter front stays free for customers).
  b.box(M.burlap, lm(l, 2.0, 0.12, -1.9), 2.0, 0.24, 1.0, [1.15, 1.05, 0.95]);
  b.box(M.burlap, lm(l, 1.7, 0.26, -1.9), 1.2, 0.06, 1.02, [0.6, 0.35, 0.3]);
  // Warm light inside (a bulb over the middle shelf, one over the counter) and a lamp under the awning
  // outside that lights the sandbag lane: the Späti reads as a safe, lit place from down the street.
  b.light(lp(l, 0.5, 2.7, -0.5), 0xffb070, 14, 10, 0.05, 4);
  b.light(lp(l, -3.1, 2.5, 1.2), 0xffc890, 7, 6, 0.03, 3);
  b.light(lp(l, 0, 2.4, d / 2 + 1.6), 0xffc070, 12, 10, 0.08, 5);
  // Upper part: lintel, rolled-up shutter, sign, awning, barred shop windows, flat roof.
  up.box(M.brick, lm(l, 0, (2.4 + H) / 2, d / 2 - 0.15), door, H - 2.4, 0.3);
  up.box(M.iron, lm(l, 0, 2.28, d / 2 + 0.08), door + 0.2, 0.26, 0.3, [0.9, 0.9, 0.85]);
  // Sign standing on the front edge of the awning, so the camera above sees it.
  const tilt = new Matrix4().makeRotationX(-0.6);
  up.geo(M.spatiSign, new PlaneGeometry(4.4, 0.95), lm(l, 0, 3.0, d / 2 + 1.3).multiply(tilt));
  up.box(M.rust, lm(l, 0, 3.0, d / 2 + 1.24).multiply(tilt), 4.6, 1.1, 0.08, [0.35, 0.35, 0.38]);
  up.box(M.awning, lm(l, 0, 2.55, d / 2 + 0.7), w - 0.4, 0.08, 1.2);
  for (const side of [-1, 1]) {
    up.box(M.shop, lm(l, side * 3.4, 1.7, d / 2 + 0.02), 2.6, 1.0, 0.05);
    for (let x = -1.2; x <= 1.2; x += 0.3) up.box(M.iron, lm(l, side * 3.4 + x, 1.7, d / 2 + 0.07), 0.04, 1.0, 0.04);
  }
  up.box(M.tar, lm(l, 0, H + 0.12, 0), w + 0.4, 0.24, d + 0.4, [0.6, 0.6, 0.6]);
  up.box(M.rust, lm(l, 2.5, H + 0.6, -1.5), 1.2, 0.7, 0.9, [0.8, 0.8, 0.8]);
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

export function buildMapWorld(materials: Materials, m: MapDef, lots: Lot[], props: Prop[], breakables: BreakableDef[] = []): World {
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
  buildQuays(m, mats, chunkOf);
  buildScatter(m, lots, mats, chunkOf);
  const boats: Array<{ lane: FerryLane; group: Group }> = [];
  buildBridges(m, chunkOf, boats);
  for (const bt of boats) group.add(bt.group);
  // Buildings stand on the lowest corner of their footprint; the rest sinks into the slope.
  const base = (x: number, z: number, r: number): number =>
    Math.min(surfaceAt(m, x, z), surfaceAt(m, x - r, z - r), surfaceAt(m, x + r, z - r), surfaceAt(m, x - r, z + r), surfaceAt(m, x + r, z + r));
  for (const l of lots) {
    const b = chunkOf(l.x, l.z);
    // M11c lot types: only their ground cover; their buildings, trees and props come as ordinary lots and props.
    if (l.kind === 'special') { buildLotGround(l, b.solid, { ...mats, cobbles: b.mats.cobbles }, (x, z) => surfaceAt(m, x, z)); continue; }
    const y0 = base(l.x, l.z, Math.max(l.w, l.d) / 2);
    const build = (): void => {
      if (l.ruin && l.kind !== 'tree') b.on(y0, () => buildRuin(b, l));
      else if (l.kind === 'altbau' || l.kind === 'platte' || l.kind === 'shop') b.on(y0, () => buildAltbauLot(b, l, m));
      else if (l.kind === 'house') b.on(y0, () => buildHouse(b, l));
      else if (l.kind === 'tree' && l.jungle) b.on(surfaceAt(m, l.x, l.z), () => buildPalm(b, l));
      if (l.wing) {
        // Back wing of the L: one floor lower (Seitenflügel) or a single-storey annex.
        const wing = { ...l, ...l.wing, wing: undefined, floors: Math.max(0, l.floors - 1), seed: l.seed + 1, inner: true };
        if (l.ruin) b.on(y0, () => buildRuin(b, wing));
        else if (l.kind === 'house') b.on(y0, () => buildHouse(b, wing));
        else b.on(y0, () => buildAltbauLot(b, wing, m));
      }
    };
    if (l.kind === 'tree') build();
    else b.solid.captureOccluder(build);
  }
  // Späti: roof and upper walls in their own group, hidden while the hero is inside (`follow`).
  const spatis: Array<{ rest: RestArea; upper: Group }> = [];
  for (const l of m.landmarks) {
    const b = chunkOf(l.x, l.z);
    const y0 = base(l.x, l.z, Math.max(l.hx, l.hz));
    if (l.kind === 'spati') {
      const up = new ChunkBuilder(mats);
      up.solid.captureOccluder(() => b.on(y0, () => buildSpati(b, up, l)));
      const g = new Group();
      for (const mesh of up.solid.meshes()) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
      }
      g.position.y = y0;
      const occluder = up.solid.occluderMesh();
      if (occluder) g.add(occluder);
      group.add(g);
      spatis.push({ rest: spatiRest(l), upper: g });
      continue;
    }
    b.solid.captureOccluder(() => b.on(y0, () => buildLandmark(b, l)));
  }
  const rng = new Rng(m.seed);
  const instanced = new Set(breakables.map((d) => d.prop));
  props.forEach((p, i) => {
    // Breakable props are drawn instanced (below), so they can vanish when broken.
    const b = chunkOf(p.x, p.z);
    if (instanced.has(i)) {
      rng.next();
      return;
    }
    const build = (): void => b.on(surfaceAt(m, p.x, p.z), () => buildProp(b, p, rng));
    if (isLargeProp(p.kind)) b.solid.captureOccluder(build);
    else build();
  });
  const breakableView = breakables.length > 0 ? buildBreakables(mats, m, props, breakables, group) : undefined;
  buildTerraces(m, chunkOf);
  if (m.tunnel) buildTunnel(m, mats, chunkOf);
  if (m.rail) {
    const r = m.rail;
    for (let x = r.minX; x < r.maxX; x += 40) {
      const cb = chunkOf(x + 20, r.z);
      cb.box(mats.stucco, new Matrix4().setPosition(x + 20, 0.9, r.z), 40, 1.8, 8, [0.45, 0.42, 0.4]);
      for (const z of [-1.5, 1.5]) cb.box(mats.iron, new Matrix4().setPosition(x + 20, 1.9, r.z + z), 40, 0.15, 0.12);
    }
  }
  buildTrees(m, lots, mats, chunkKey, group);

  const spots: LightSpot[] = [];
  const caster = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const fires: Vector3[] = [];
  for (const b of chunks.values()) {
    const occluder = b.solid.occluderMesh();
    if (occluder) group.add(occluder);
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
  cam.left = -30;
  cam.right = 30;
  cam.top = 28;
  cam.bottom = -28;
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
    breakables: breakableView,
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
    sync(simTime: number): void {
      for (const bt of boats) {
        const c = ferryPos(bt.lane, simTime);
        bt.group.position.set(c.x, 0, c.z);
        bt.group.rotation.y = bt.lane.rot;
        // A slow bob on the water.
        bt.group.position.y = 0.04 * Math.sin(simTime * 1.3);
      }
    },
    follow(x: number, z: number): void {
      hx = x;
      hz = z;
      for (const s of spatis) s.upper.visible = restAt([s.rest], x, z) < 0;
      // Snap the shadow frustum to whole texels so shadows do not shimmer while walking.
      const sx = Math.round(x / texel) * texel;
      const sz = Math.round(z / texel) * texel;
      moon.target.position.set(sx, 0, sz);
      moon.position.set(sx + MOON.x, MOON.y, sz + MOON.z);
    },
  };
}

/**
 * Crates and bins as instanced meshes: one draw call per kind (crate cluster, single crate, bin
 * row). A broken prop gets a zero-scale matrix; a hit prop flashes and shakes for a moment.
 */
function buildBreakables(mm: MapMats, m: MapDef, props: Prop[], defs: BreakableDef[], group: Group): BreakableView {
  type Kind = Prop['kind'];
  const kinds: Kind[] = ['crates', 'crate', 'bins'];
  const sets = new Map<Kind, { mesh: InstancedMesh; ids: number[] }>();
  const base: Matrix4[] = [];
  const slot: Array<{ kind: Kind; index: number }> = [];
  for (const kind of kinds) {
    const ids = defs.map((_, i) => i).filter((i) => props[defs[i]!.prop]!.kind === kind);
    if (ids.length === 0) continue;
    // Geometry of one prop at the origin; the instance matrix places it.
    const b = new ChunkBuilder(mm);
    buildProp(b, { kind, x: 0, z: 0, rot: 0, size: 1 }, new Rng(11));
    const meshes = b.solid.meshes();
    // One material per kind keeps this at one draw call per kind (see breakable-parts.ts).
    const mesh = meshes[0]!;
    const inst = new InstancedMesh(mesh.geometry, mesh.material, ids.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    ids.forEach((id, index) => {
      const p = props[defs[id]!.prop]!;
      const mat = new Matrix4().makeRotationY(p.rot).setPosition(p.x, surfaceAt(m, p.x, p.z), p.z);
      base[id] = mat;
      slot[id] = { kind, index };
      inst.setMatrixAt(index, mat);
      inst.setColorAt(index, new Color(1, 1, 1));
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    sets.set(kind, { mesh: inst, ids });
  }
  const flash = new Map<number, number>();
  const hidden = new Set<number>();
  const m4 = new Matrix4();
  const wobble = new Matrix4();
  const white = new Color(1, 1, 1);
  const hot = new Color(3.2, 2.8, 2.4);
  const apply = (id: number, t: number): void => {
    const s = slot[id];
    if (!s) return;
    const set = sets.get(s.kind)!;
    if (hidden.has(id)) {
      set.mesh.setMatrixAt(s.index, m4.makeScale(0, 0, 0));
    } else {
      // A hit prop jolts: a quick damped shake around its base.
      const k = Math.max(0, t / FLASH) ** 2;
      wobble.makeRotationZ(Math.sin(t * 90) * 0.07 * k).multiply(new Matrix4().makeRotationX(Math.cos(t * 70) * 0.05 * k));
      set.mesh.setMatrixAt(s.index, m4.copy(base[id]!).multiply(wobble));
    }
    set.mesh.setColorAt(s.index, t > 0 ? hot.clone().lerp(white, 1 - t / FLASH) : white);
    set.mesh.instanceMatrix.needsUpdate = true;
    if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true;
  };
  const FLASH = 0.16;
  return {
    hit(id: number): void {
      flash.set(id, FLASH);
      apply(id, FLASH);
    },
    broke(id: number): void {
      hidden.add(id);
      flash.delete(id);
      apply(id, 0);
    },
    reset(): void {
      hidden.clear();
      flash.clear();
      for (let id = 0; id < defs.length; id++) apply(id, 0);
    },
    update(dt: number): void {
      for (const [id, t] of flash) {
        const n = t - dt;
        if (n <= 0) flash.delete(id);
        else flash.set(id, n);
        apply(id, Math.max(0, n));
      }
    },
  };
}
