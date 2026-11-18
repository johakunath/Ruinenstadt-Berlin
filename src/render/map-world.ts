// Builds an expedition map (M11) from `src/data/map.ts`: ground with water banks, street ribbons,
// bridges, generated Altbau blocks and houses, instanced trees, landmarks and props. Everything is
// grouped in 32 m chunks so the camera frustum culls what is off screen (the view reaches about 40 m).
// Lamps are light *spots*; a fixed pool of point lights follows the hero (constant light count, no
// shader recompiles).
import {
  Box3, BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DirectionalLight,
  Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, Quaternion,
  ShapeUtils, SphereGeometry, Vector2, Vector3, Euler, type Material, type Texture,
} from 'three';
import type { Facade, FacadeFeature, PlasterTone } from '../data/courtyard';
import { FERRY, ferryPos, type FerryLane } from '../sim/ferry';
import { GROUND_STEP, meshSurface } from './ground';
import { buildLotGround } from './lot-ground';
import { buildCampWorld, makeCampMats } from './camp-world';
import { onCampFloor } from '../data/camp-map';
import { buildLandmark } from './landmarks';
import {
  BED_Y, WATER_Y, areaAt, edgeBackdrop, edgeRuns, heightAt, inPoly, isQuay, lotBoxesLocal, lotColliders, lotOutlineLocal, lotPieces, lotToWorld, polyEdgeDist, sidePt, wobble, isWater, isWaterPlain, onBridge, onStair, streetDist, terraceWall,
  type EdgeBlock, type EdgeRun, type GroundKind, type Landmark, type Lot, type LotFrame, type MapDef, type Pt, inTunnel, type Street,
} from '../data/map';
import { EDGE_FRONT, propCollider, type Prop } from '../data/courtyard';
import { Rng } from '../sim/math';
import type { BreakableDef } from '../sim/breakables';
import { restAt, type RestArea } from '../sim/rest';
import { SPATI, spatiParts, spatiRest } from '../data/spati';
import { BatchSet } from './batch';
import { Cutaway } from './cutaway';
import { cutPlan, lotBodies, rectPoly, type CutPart } from '../data/cut';
import { buildXhainWorld, XHAIN_KINDS } from './xhain-world';
import { ALEX_KINDS, buildAlexLandmark, buildAlexPlatte, buildArches, buildStadtbahn, buildStrausberger, dressAlexEdge, dressAlexLots } from './alex-world';
import { loadPosters, paintAlexAtlas, paintPosterFallback } from './alex-paint';
import { buildMinistryLot } from './mitte-zones';
import { makeClockRig } from './clock';
import { buildGlassLot, buildMitteLandmark, buildMitteWorld, MITTE_KINDS, mitteMats, type MitteMats } from './mitte-world';
import { NIGHT_SKY, type Sky, type Wet } from './sky';
import { isOccluderProp, OCCLUDER_LAYER } from './layers';
import { buildTunnelExtras, buildTunnelView, lineTint } from './tunnel-view';
import { Materials, type LitMaterial } from './materials';
import { loadGroundTexture } from './ground-textures';
import { blobGeo, buildFlowers, buildPlantProp, buildUndergrowth, cardGeo, fringe, mtx, plantMats } from './vegetation';
import { tramOffsetPoint, TRAM_RAILS, TRAM_SECTION } from './tram-rails';
import { TRAM_BRIDGE_DECK } from '../data/tram';
import { canvas, toTexture, paintAsphalt, paintConcrete, paintDirt, paintFern, paintGrass, paintLeafLitter, paintLitter, paintPaving, paintRoofTiles, paintTextSign, paintSlate, paintClock, paintSRoundel, paintLettering, paintWaterNormal, type PaintOptions } from './paint';
import {
  Builder, balconyLife, buildAltbau, buildProp, partOf, type BreakableView, FLOOR_H, FX_LAYER, GROUND_H, makeMats, PARAPET, Run, UNIT_BOX, windowAt, type LightShape, type Mats, type World,
} from './world';

type RGB = readonly [number, number, number];
const CHUNK = 32;
/** Ground chunks: the multiple of the ground grid step nearest below CHUNK, so chunk edges stay on the grid `meshSurface` samples. */
const GROUND_CHUNK = Math.floor(CHUNK / GROUND_STEP) * GROUND_STEP;
const tmpScale = new Matrix4();

interface LightSpot {
  pos: Vector3;
  color: number;
  intensity: number;
  distance: number;
  flicker: number;
  phase: number;
}

export interface MapMats extends Mats {
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
  // M11d landmarks.
  slate: LitMaterial;
  clock: LitMaterial;
  sRoundel: LitMaterial;
  stationName: LitMaterial;
  ratskeller: LitMaterial;
  /** M15 Alexanderplatz sign atlas (`alex-paint.ts`), only on that map. */
  alex?: LitMaterial;
  /** M15 Alexanderplatz painted banners and Pioneer poster (2D art, alpha-tested), only on that map. */
  posters?: LitMaterial;
  /** M15 Mitte materials (`mitte-world.ts`), only on that map. */
  mitte?: MitteMats;
}

/** A builder per chunk. Lamps become light spots plus a merged glow decal. */
export class ChunkBuilder extends Builder {
  readonly spots: LightSpot[] = [];
  readonly glows = new BatchSet();
  private readonly glowMats = new Map<number, Material>();
  private readonly streakMats = new Map<number, Material>();

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

  /**
   * V1 B cutaway: builds `fn` as part `part`, clipped at world height `y` in the solid, card and glow
   * batches and the shadow casters; `caps` (convex ground polygons) become dark lids at `y`, shown only
   * while the part is cut. Call inside `solid.captureOccluder`.
   */
  cut(part: number, y: number, fn: () => void, caps: readonly (readonly Pt[])[] = []): void {
    const boxes = this.shadowBoxes.length, lids = this.lids.length;
    const lid = (): void => { for (const p of [...caps, ...this.lids.splice(lids)]) this.solid.of(this.mm.tar).add(cutCapGeo(p, y + 0.01), IDENTITY, CAP_TINT); };
    this.cutAt = y;
    try { this.solid.cut(part, y, () => this.cards.cut(part, y, () => this.glows.cut(part, y, fn)), lid); } finally { this.cutAt = null; }
    for (let i = boxes; i < this.shadowBoxes.length; i++) this.shadowBoxes[i]!.cut = { part, y };
  }

  /** While a cut part is built: its world cut height; builders of open shells add their own lids (`lids`). */
  cutAt: number | null = null;
  readonly lids: Pt[][] = [];
  /** Ground height `on` currently builds on. */
  get base(): number {
    return this.lift;
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
    // M15 Mitte: lanterns take one of the night's lamp colours (`Wet.lamp`, fixed per position).
    if (wet && color === 0xffb060) color = wet.lamp[Math.abs(Math.round(pos.x * 7.3 + pos.z * 13.1)) % wet.lamp.length]!;
    this.spots.push({ pos: lp, color, intensity, distance, flicker, phase: Math.random() * 6 });
    if (wet && wet.streak > 0) {
      // Wet street: the light's reflection runs from its foot toward the camera (south), as long as the
      // light is high (the mirror image sits about one height in front of the foot), broken by ripples.
      const len = Math.min(9, (1.5 + pos.y * 1.4) * wet.streak), w = Math.max(0.7, Math.min(2.2, pool * 0.3));
      let sm = this.streakMats.get(color);
      if (!sm) this.streakMats.set(color, (sm = Materials.glow(streakTex(), color, wet.streakAlpha * glowScale)));
      const g = new PlaneGeometry(w, len);
      g.rotateX(-Math.PI / 2);
      this.glows.of(sm).add(g, new Matrix4().setPosition(pos.x, 0.04, pos.z + len * 0.45));
    }
    let mat = this.glowMats.get(color);
    if (!mat) this.glowMats.set(color, (mat = Materials.glow(this.glowTex, color, 0.22 * glowScale)));
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

/** Ground glow strength of lamps for the map being built (daylight maps dim them, `Sky.lamps`). */
let glowScale = 1;
/** M15 Mitte: wet streets of the map being built (`Sky.wet`), else undefined. */
let wet: Wet | undefined;
let streakCache: Texture | undefined;
/** Soft vertical reflection streak: bright in the middle, faded at both ends, broken by ripple bands. */
function streakTex(): Texture {
  if (streakCache) return streakCache;
  const [c, g] = canvas(32, 128);
  const img = g.createImageData(32, 128), rng = new Rng(77);
  const bands = Array.from({ length: 128 }, () => 0.55 + 0.45 * rng.next());
  for (let y = 0; y < 128; y++) for (let x = 0; x < 32; x++) {
    const u = (x + 0.5) / 32 - 0.5, v = (y + 0.5) / 128;
    const a = Math.exp(-((u / 0.2) ** 2)) * Math.pow(Math.sin(Math.PI * v), 0.9) * bands[y]!;
    img.data.set([255, 255, 255, Math.round(255 * a)], (y * 32 + x) * 4);
  }
  g.putImageData(img, 0, 0);
  return (streakCache = toTexture(c, false));
}
const IDENTITY = new Matrix4();
/** Cap colour: dark, so the cut reads as a section, not as a roof. */
const CAP_TINT: RGB = [0.2, 0.22, 0.23];

/** V1 B cut cap: a flat, upward facing convex polygon in world coordinates at height y (fan). */
function cutCapGeo(poly: readonly Pt[], y: number): BufferGeometry {
  // Counter-clockwise seen from above, whatever order the polygon comes in.
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += poly[j]![0] * poly[i]![1] - poly[i]![0] * poly[j]![1];
  const pts = area < 0 ? poly : [...poly].reverse();
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  for (const [x, z] of pts) { pos.push(x, y, z); uv.push(x / 4, z / 4); nor.push(0, 1, 0); }
  for (let i = 1; i + 1 < pts.length; i++) idx.push(0, i, i + 1);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

/** Cap polygons of a lot (main body and wing). Ruins are open shells: `buildRuin` lids its own wall tops. */
function lotCaps(l: Lot): Pt[][] {
  return l.ruin ? [] : lotBodies(l).map(({ rect }) => rectPoly(rect));
}

export function emissive(materials: Materials, t: { map: Texture; emissiveMap: Texture }, color: number, intensity: number): LitMaterial {
  return materials.surface({ map: t.map, emissiveMap: t.emissiveMap, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
}

export function makeMapMats(materials: Materials): MapMats {
  const base = makeMats(materials);
  const o: PaintOptions = { flatten: materials.look.flatten, normalMaps: materials.profile.normalMaps, anisotropy: materials.profile.anisotropy };
  const dirt = paintDirt(o).map;
  const asphalt = paintAsphalt(o).map;
  const uDirt = { value: dirt };
  const m: MapMats = {
    ...base,
    railSteel: materials.surface({ color: 0xbfc6c2, roughness: 0.34, metalness: 0.6, vertexColors: true }),
    ground: groundMaterial(materials, o, uDirt),
    litter: materials.surface({ map: paintLitter(), alphaTest: 0.5, roughness: 0.55, vertexColors: true }),
    asphalt: materials.surface({ map: asphalt, roughness: 0.85, vertexColors: true }),
    path: materials.surface({ map: dirt, color: 0xc0b0a0, roughness: 0.95, vertexColors: true }),
    roof: materials.surface({ map: paintRoofTiles(o).map, roughness: 0.8, vertexColors: true }),
    tar: materials.surface({ map: asphalt, color: 0x5a5650, roughness: 0.9, vertexColors: true }),
    concrete: materials.surface({ map: paintConcrete(o).map, roughness: 0.9, vertexColors: true }),
    mossy: materials.surface({ map: paintConcrete(o, '#6f7a5c').map, roughness: 0.9, vertexColors: true }),
    // M11d: rippled, reflective water; the normal map scrolls in `update` (Qualität only: one extra texture read on water pixels).
    water: materials.surface({ color: 0x1a5560, emissive: 0x0a2228, roughness: 0.08, metalness: 0.55, normalMap: o.normalMaps ? (() => { const t = paintWaterNormal(); t.repeat.set(70, 70); return t; })() : null }),
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
    slate: materials.surface({ map: paintSlate(o).map, roughness: 0.55, metalness: 0.15, vertexColors: true }),
    clock: emissive(materials, paintClock(), 0xffe0a0, 1.1),
    sRoundel: emissive(materials, paintSRoundel(), 0x40ff90, 1.3),
    stationName: emissive(materials, paintLettering('BERLIN-KÖPENICK', '#d8cdb0', '#0d6a3a', 0.7, 0.62), 0x40e080, 0.55),
    ratskeller: emissive(materials, paintLettering('RATSKELLER', '#1e2a22', '#d9b25a', 1, 0.3), 0xffc060, 1.1),
  };
  loadGroundTexture('dirt', o.anisotropy, texture => {
    uDirt.value = m.path.map = texture;
    dirt.dispose();
  });
  loadGroundTexture('litter', o.anisotropy, texture => {
    m.litter.map?.dispose();
    m.litter.map = texture;
  });
  loadGroundTexture('asphalt', o.anisotropy, texture => {
    m.asphalt.map = m.tar.map = texture;
    asphalt.dispose();
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
  // Under bridges the bed runs on, so decks span the water on their piers (M11d: no ground sheet beside the deck).
  // M15 bridge terraces (Warschauer Brücke) keep the ground below their deck; `xhain-world.ts` draws the deck.
  const underDeck = (x: number, z: number): boolean => m.terraces.some((t) => t.bridge && (inPoly(t.poly, x, z) || onStair(t, x, z) !== null));
  const height = (x: number, z: number): number => (isWater(m, x, z) ? BED_Y : underDeck(x, z) ? 0 : heightAt(m, x, z));
  for (let cz = B.minZ; cz < B.maxZ; cz += GROUND_CHUNK) {
    for (let cx = B.minX; cx < B.maxX; cx += GROUND_CHUNK) {
      const n = Math.ceil(Math.min(GROUND_CHUNK, B.maxX - cx) / step);
      const k = Math.ceil(Math.min(GROUND_CHUNK, B.maxZ - cz) / step);
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
          wet.push(y < BED_Y + 0.5);
          pos.push(x, y, z);
          uv.push(x / 5, z / 5);
          const a = areaAt(m, x, z);
          const t = GROUND_TINT[a?.ground ?? m.defaultGround];
          const noise = 0.82 + 0.3 * (0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.19 + Math.sin(x * 0.13) * 1.6));
          const nearWater = y >= BED_Y + 0.5 && (isWater(m, x + 1.6, z) || isWater(m, x - 1.6, z) || isWater(m, x, z + 1.6) || isWater(m, x, z - 1.6));
          // Damp, dark banks.
          const shore = y < BED_Y + 0.5 ? 0.35 : y < -0.3 ? 0.55 : nearWater ? 0.6 : 1;
          // M19 tunnel: ground outside the tubes is rock in the dark (the walls hide most of it).
          const rock = (m.tunnel && !inTunnel(m, x, z, -1.5)) || (m.camp && !onCampFloor(m.camp, x, z) && !onCampFloor(m.camp, x + 1.5, z) && !onCampFloor(m.camp, x - 1.5, z) && !onCampFloor(m.camp, x, z + 1.5) && !onCampFloor(m.camp, x, z - 1.5)) ? 0.06 : 1;
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
  water.position.set((B.minX + B.maxX) / 2, WATER_Y, (B.minZ + B.maxZ) / 2);
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
        // M11d: the wall runs from the bed to the coping, 1.7 m above the water; a dark wet band at the waterline.
        b.box(mats.cobbles, at(0.6, (BED_Y + 0.06) / 2), 1.8, 0.06 - BED_Y, piece, [0.5, 0.48, 0.45]);
        b.box(mats.cobbles, at(-0.31, WATER_Y + 0.25), 0.04, 0.5, piece, [0.22, 0.25, 0.22]);
        b.box(mats.cobbles, at(-0.05, 0.08), 0.5, 0.12, piece, [0.85, 0.82, 0.76]);
      }
    }
  }
}

/**
 * M11d: wrecked and moored boats along the banks (rowing boats, small motor boats, a half-sunk one,
 * a capsized hull). Seeded; never near bridges, the ferry lane or the map edge. Render only: the
 * water already blocks.
 */
function buildBoats(m: MapDef, mats: MapMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  const rng = new Rng(m.seed * 13 + 5);
  const edges: Array<{ pts: readonly Pt[]; off: number }> = [];
  for (const r of m.rivers) for (const side of [-1, 1]) edges.push({ pts: r.pts, off: (side * r.width) / 2 });
  for (const lake of m.lakes) edges.push({ pts: [...lake, lake[0] as Pt], off: 0 });
  const placed: Array<[number, number]> = [];
  const B = m.bounds;
  const COLORS: RGB[] = [[1.2, 1.18, 1.1], [0.45, 0.6, 1.0], [1.1, 0.45, 0.35], [0.5, 0.85, 0.6], [1.15, 0.95, 0.4]];
  for (const e of edges) {
    for (let i = 1; i < e.pts.length; i++) {
      const [ax, az] = e.pts[i - 1] as Pt, [bx, bz] = e.pts[i] as Pt;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.1) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let t = 2; t < len - 2; t += 2) {
        if (rng.next() > 0.07) continue;
        const ex = ax + dx * t - dz * e.off, ez = az + dz * t + dx * e.off;
        // Into the water by 2.2 m on whichever side is wet.
        let wx = -dz, wz = dx;
        if (!isWater(m, ex + wx * 2.2, ez + wz * 2.2)) { wx = dz; wz = -dx; }
        const x = ex + wx * 2.2, z = ez + wz * 2.2;
        if (!isWater(m, x, z) || !isWater(m, x + dx * 2.6, z + dz * 2.6) || !isWater(m, x - dx * 2.6, z - dz * 2.6)) continue;
        if (x < B.minX + 4 || x > B.maxX - 4 || z < B.minZ + 4 || z > B.maxZ - 4) continue;
        if (m.bridges.some((br) => Math.hypot(x - br.x, z - br.z) < br.len / 2 + 5)) continue;
        if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 16)) continue;
        placed.push([x, z]);
        const kind = rng.int(4), c = COLORS[rng.int(COLORS.length)]!;
        const yaw = Math.atan2(dx, dz) + rng.range(-0.25, 0.25);
        const sunk = kind === 2, capsized = kind === 3;
        const roll = capsized ? Math.PI : sunk ? rng.range(0.2, 0.35) : rng.range(-0.06, 0.06);
        const y = WATER_Y + (capsized ? 0.15 : sunk ? -0.35 : 0.05);
        const base = new Matrix4().makeRotationY(yaw).multiply(new Matrix4().makeRotationX(sunk ? 0.18 : 0)).multiply(new Matrix4().makeRotationZ(roll)).setPosition(x, y, z);
        const f = (px: number, py: number, pz: number, ry = 0): Matrix4 => base.clone().multiply(new Matrix4().makeRotationY(ry).setPosition(px, py, pz));
        const L = kind === 1 ? 5.2 : 3.8, W = kind === 1 ? 1.9 : 1.4;
        const b = chunkOf(x, z);
        // Hull: sides and stern as boxes, a pointed bow, plank seats; motor boats get a small cabin.
        b.box(mats.carPaint, f(0, 0.05, -0.3), W, 0.6, L - 1.2, c);
        b.box(mats.carPaint, f(0, 0.05, L / 2 - 0.9, Math.PI / 4), W / Math.SQRT2, 0.6, W / Math.SQRT2, c);
        b.box(mats.darkWood, f(0, 0.32, -0.3), W - 0.2, 0.05, L - 1.4, [0.7, 0.6, 0.5]);
        b.box(mats.carPaint, f(0, -0.2, -0.2), W - 0.2, 0.2, L - 1.0, [0.35, 0.3, 0.28]);
        if (kind === 1) {
          b.box(mats.carPaint, f(0, 0.75, 0.2), W - 0.4, 0.8, 1.6, [1.2, 1.18, 1.1]);
          b.box(mats.carGlass, f(0, 0.9, 1.02), W - 0.5, 0.35, 0.04);
          b.box(mats.iron, f(0, 0.3, -L / 2 + 0.55), 0.35, 0.7, 0.35);
        } else if (!capsized) {
          for (const sz of [-0.9, 0.5]) b.box(mats.wood, f(0, 0.4, sz), W - 0.15, 0.06, 0.28);
          b.box(mats.wood, f(0.5, 0.45, -0.2, 0.3), 0.06, 0.04, 2.4, [0.8, 0.7, 0.55]);
        }
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

/**
 * Wild greenery per ground kind (M11c), chances per 4 m cell plus per 2.4 m of wall: every district
 * reuses it through its areas' `ground`. Jungle bushes become big-leaf undergrowth half the time.
 */
const GREENERY: Record<GroundKind, { bush: number; flowers: number; wall: number }> = {
  cobbles: { bush: 0.025, flowers: 0.02, wall: 0.3 },
  asphalt: { bush: 0.02, flowers: 0.012, wall: 0.25 },
  grass: { bush: 0.1, flowers: 0.15, wall: 0.5 },
  forest: { bush: 0.17, flowers: 0.03, wall: 0.5 },
  jungle: { bush: 0.3, flowers: 0.05, wall: 0.6 },
};
/** Props that get bushes along both sides. */
const HEDGED: Partial<Record<Prop['kind'], number>> = { fence: 0.3, picket: 0.3, bauzaun: 0.12, wall: 0.4, lowWall: 0.4 };

/**
 * Bushes, flower patches and reeds (render only, walk-through): on grass, forest and jungle by
 * `GREENERY`, along building walls, fences and ruins, reeds on natural banks. Deterministic per map
 * seed; never on streets, sidewalks, water, bridges, stairs, landmarks, buildings or props.
 */
function buildGreenery(m: MapDef, lots: Lot[], props: Prop[], chunkOf: (x: number, z: number) => ChunkBuilder): void {
  if (m.tunnel || m.camp) return;
  const rng = new Rng(m.seed + 137);
  // Blockers in an 8 m hash: rotated boxes (half extents) around buildings and props.
  type Box = { x: number; z: number; rot: number; hx: number; hz: number };
  const H = 8;
  const hash = new Map<string, Box[]>();
  const block = (o: Box): void => {
    const r = Math.hypot(o.hx, o.hz);
    for (let i = Math.floor((o.x - r) / H); i <= Math.floor((o.x + r) / H); i++) {
      for (let j = Math.floor((o.z - r) / H); j <= Math.floor((o.z + r) / H); j++) {
        const k = `${i},${j}`;
        const list = hash.get(k);
        if (list) list.push(o);
        else hash.set(k, [o]);
      }
    }
  };
  const inside = (o: Box, x: number, z: number, pad: number): boolean => {
    const dx = x - o.x;
    const dz = z - o.z;
    const c = Math.cos(o.rot);
    const s = Math.sin(o.rot);
    return Math.abs(dx * c - dz * s) < o.hx + pad && Math.abs(dx * s + dz * c) < o.hz + pad;
  };
  const walls: Array<{ l: Box; ruin: boolean }> = [];
  for (const l of lots) {
    if (l.kind === 'tree') continue;
    // Buildings by their footprint boxes (M11d shapes, wing); M11c lot types as their whole rectangle.
    const boxes: Box[] = l.kind === 'special' ? [{ x: l.x, z: l.z, rot: l.rot, hx: l.w / 2, hz: l.d / 2 }] : lotColliders(l).flatMap((c) => (c.kind === 'box' ? [c] : []));
    for (const o of boxes) {
      block(o);
      walls.push({ l: o, ruin: !!l.ruin });
    }
  }
  for (const p of props) {
    // Closed edge fronts block their whole footprint (it is drawn behind the front face).
    const c = EDGE_FRONT[p.kind] !== undefined || p.kind === 'fallenTree' ? propCollider(p) : null;
    if (c?.kind === 'box') block({ x: c.x, z: c.z, rot: c.rot, hx: c.hx, hz: c.hz });
    else block(HEDGED[p.kind] !== undefined || p.kind === 'hedge' ? { x: p.x, z: p.z, rot: p.rot, hx: p.size / 2, hz: 0.3 } : { x: p.x, z: p.z, rot: p.rot, hx: 0.9, hz: 0.9 });
  }
  const free = (x: number, z: number, pad: number): boolean => {
    if (isWater(m, x, z) || onBridge(m, x, z, 1.5) || terraceWall(m, x, z) || m.terraces.some((t) => onStair(t, x, z, 1))) return false;
    const sd = streetDist(m, x, z);
    if (sd.d < (sd.street?.sidewalk ?? 0) + 0.3) return false;
    if (m.landmarks.some((l) => Math.abs(x - l.x) < l.hx + 0.8 && Math.abs(z - l.z) < l.hz + 0.8)) return false;
    return !(hash.get(`${Math.floor(x / H)},${Math.floor(z / H)}`) ?? []).some((o) => inside(o, x, z, pad));
  };
  const place = (kind: 'bush' | 'flowers' | 'reeds' | 'undergrowth', x: number, z: number, size: number): void => {
    const b = chunkOf(x, z);
    const p: Prop = { kind: kind === 'undergrowth' ? 'bush' : kind, x, z, rot: rng.range(0, Math.PI * 2), size };
    b.on(surfaceAt(m, x, z), () => (kind === 'undergrowth' ? buildUndergrowth(b, p, rng) : kind === 'flowers' ? buildFlowers(b, p, rng, false) : buildPlantProp(b, p, rng)));
  };
  const ground = (x: number, z: number): GroundKind => areaAt(m, x, z)?.ground ?? m.defaultGround;
  const bushOf = (g: GroundKind): 'bush' | 'undergrowth' => (g === 'jungle' && rng.next() < 0.5 ? 'undergrowth' : 'bush');
  // 1. Open ground: a jittered 4 m grid.
  const B = m.bounds;
  const G = 4;
  for (let z = B.minZ + 3; z < B.maxZ - 3; z += G) {
    for (let x = B.minX + 3; x < B.maxX - 3; x += G) {
      const px = x + rng.range(-1.8, 1.8);
      const pz = z + rng.range(-1.8, 1.8);
      const roll = rng.next();
      const size = rng.range(0.7, 1.3);
      const g = ground(px, pz);
      const o = GREENERY[g];
      const bank = !isQuay(m, px, pz) && [[1.8, 0], [-1.8, 0], [0, 1.8], [0, -1.8]].some(([dx, dz]) => isWater(m, px + dx!, pz + dz!));
      const kind = bank ? (roll < 0.5 ? 'reeds' : roll < 0.6 ? 'bush' : null) : roll < o.bush ? bushOf(g) : roll < o.bush + o.flowers ? 'flowers' : null;
      if (!kind || !free(px, pz, 0.4)) continue;
      place(kind, px, pz, kind === 'flowers' ? size * 1.2 : size);
    }
  }
  // 2. Along building walls (more on ruins): bushes, on grass sometimes flowers.
  for (const { l, ruin } of walls) {
    const c = Math.cos(l.rot);
    const s = Math.sin(l.rot);
    for (const [ax, az, len] of [[0, 1, l.hx], [0, -1, l.hx], [1, 0, l.hz], [-1, 0, l.hz]] as const) {
      // Side normal (ax, az) in lot space; walk along the side.
      const n = Math.max(1, Math.floor((2 * len) / 2.4));
      for (let i = 0; i < n; i++) {
        const t = -len + ((i + rng.range(0.2, 0.8)) / n) * 2 * len;
        const off = (ax ? l.hx : l.hz) + rng.range(0.45, 0.8);
        const lx = ax ? ax * off : t;
        const lz = az ? az * off : t;
        const x = l.x + lx * c + lz * s;
        const z = l.z - lx * s + lz * c;
        const g = ground(x, z);
        if (rng.next() > GREENERY[g].wall * (ruin ? 1.5 : 1)) continue;
        if (!free(x, z, 0.2)) continue;
        place(g === 'grass' && rng.next() < 0.3 ? 'flowers' : bushOf(g), x, z, rng.range(0.6, 1.15));
      }
    }
  }
  // 3. Along fences and walls, both sides.
  for (const p of props) {
    const chance = HEDGED[p.kind];
    if (chance === undefined) continue;
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    for (let t = -p.size / 2 + 1; t < p.size / 2; t += 2.5) {
      for (const side of [-1, 1]) {
        if (rng.next() > chance) continue;
        const lz = side * rng.range(0.6, 0.9);
        const lx = t + rng.range(-0.5, 0.5);
        const x = p.x + lx * c + lz * s;
        const z = p.z - lx * s + lz * c;
        if (free(x, z, 0.1)) place(bushOf(ground(x, z)), x, z, rng.range(0.6, 1.1));
      }
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
  // Hull down past the waterline (M11d: the water lies 1.7 m below the deck).
  b.box(mats.rust, new Matrix4().setPosition(0, -1.2, 0), width + 0.4, 2.2, L - 0.6, [0.75, 0.6, 0.5]);
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
  b.box(mats.rust, new Matrix4().setPosition(width / 2 + 1.1, -1.1, 1.2), 2.0, 2.1, 2.8, [0.75, 0.6, 0.5]);
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
        // Top 4 cm over the ground: flush with it, the planks z-fought the bank grass (Grünau, playtest 2026-11-18).
        b.box(mats.wood, local(0, -0.06, c), br.width, 0.2, pl, [1.15, 1.05, 0.9]);
        for (const side of [-1, 1]) {
          for (const z of [c - pl / 2 + 0.3, c + pl / 2 - 0.3]) b.box(mats.wood, local(side * (br.width / 2 - 0.2), (BED_Y - 0.1) / 2, z), 0.3, -BED_Y - 0.1, 0.3, [0.55, 0.5, 0.45]);
          b.box(mats.iron, local(side * (br.width / 2 + 0.05), 0.5, c), 0.06, 0.06, pl);
          b.box(mats.iron, local(side * (br.width / 2 + 0.05), 0.25, c - pl / 2 + 0.2), 0.06, 0.5, 0.06);
        }
      }
      boats.push({ lane: br, group: buildFerryBoat(mats, br.width) });
      continue;
    }
    // Deck (top flush with the ground) on a stone body, piers down to the bed, abutments closing both
    // banks under the bridge heads (M11d: no ground sheet or gap beside the deck), railing, lamps.
    b.box(mats.cobbles, local(0, -0.2, 0), br.width, 0.5, br.len, [0.75, 0.72, 0.7]);
    b.box(mats.stucco, local(0, -0.85, 0), br.width + 0.8, 0.8, br.len, [0.5, 0.5, 0.47]);
    for (const end of [-1, 1]) b.box(mats.stucco, local(0, (BED_Y + 0.05) / 2, end * (br.len / 2 - 1.2)), br.width + 1.4, 0.05 - BED_Y, 2.4, [0.48, 0.47, 0.44]);
    for (const side of [-1, 1]) {
      b.box(mats.stucco, local(side * (br.width / 2 + 0.2), 0.05, 0), 0.4, 0.6, br.len, [0.55, 0.55, 0.52]);
      b.box(mats.iron, local(side * (br.width / 2 + 0.2), 1.05, 0), 0.08, 0.08, br.len);
      for (let z = -br.len / 2 + 0.6; z < br.len / 2; z += 1.2) b.box(mats.iron, local(side * (br.width / 2 + 0.2), 0.7, z), 0.05, 0.7, 0.05);
      // Arch piers in the water.
      for (const z of [-br.len / 4, br.len / 4]) b.box(mats.stucco, local(side * (br.width / 2 - 0.6), (BED_Y - 1.25) / 2, z), 1.2, -1.25 - BED_Y, 1.6, [0.45, 0.45, 0.42]);
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
    if (t.bridge) continue;
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
      const base = t.base ?? 0;
      const steps = Math.max(3, Math.round((t.h - base) / 0.3));
      const ux = Math.sin(st.rot);
      const uz = Math.cos(st.rot);
      for (let k = 0; k < steps; k++) {
        const f = (k + 0.5) / steps;
        const top = base + ((t.h - base) * (k + 1)) / steps;
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
  // M20: a thin divider between two tubes (the bypass beside the collapse) stays low, so the camera sees over it.
  const LOW = 1.4;
  const stripe = lineTint(m.tunnel!.color);
  /** Meters of wall built so far per tube kind and side: places ribs, niches and lamps along the run. */
  const wallRun = new Map<string, number>();
  for (const t of m.tunnel!.tubes) {
    for (let i = 1; i < t.pts.length; i++) {
      const [ax, az] = t.pts[i - 1]!, [bx, bz] = t.pts[i]!, len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len, yaw = Math.atan2(ux, uz);
      for (const side of [-1, 1]) {
        // Normal pointing out of the tube on this side.
        const nx = uz * side, nz = -ux * side;
        const key = `${t.kind}${side}`;
        for (let d = 0; d < len; d += 1) {
          const cx = ax + ux * (d + 0.5), cz = az + uz * (d + 0.5);
          const ex = cx + nx * t.width / 2, ez = cz + nz * t.width / 2;
          // Open where the wall would stand inside another tube (a junction).
          if (inTunnel(m, ex + nx * 0.6, ez + nz * 0.6)) continue;
          // As thick as fits before the next tube (M20: marched in half meters, so a parallel bypass is found).
          let thick = 0.5;
          while (thick < 12 && !inTunnel(m, ex + nx * (thick + 0.5), ez + nz * (thick + 0.5))) thick += 0.5;
          const h = thick < 2.5 ? LOW : H;
          const b = chunkOf(cx, cz);
          // Playtest 2026-11-18: uneven walls. The face swells by up to 0.3 m (two slow waves along the
          // tube), the tint drifts, damp darkens the foot; ribs, refuge niches, a cable tray and wall lamps
          // break the run. Cost: boxes in the existing tunnel materials, merged per chunk; lamps feed the fixed pool.
          const run = (wallRun.get(key) ?? 0) + 1;
          wallRun.set(key, run);
          const u = run + side * 37 + t.width * 3;
          const bump = h < H ? 0 : 0.15 + 0.1 * Math.sin(u * 0.43) + 0.05 * Math.sin(u * 1.9 + 1.3);
          const tone = 0.86 + 0.14 * Math.sin(u * 0.21) + 0.06 * Math.sin(u * 1.37);
          const mx = ex + nx * (thick - bump) / 2, mz = ez + nz * (thick - bump) / 2;
          const fx = ex - nx * bump, fz = ez - nz * bump;
          const onFace = (o: number, y: number): Matrix4 => new Matrix4().makeRotationY(yaw).setPosition(fx - nx * o, y, fz - nz * o);
          b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(mx, h / 2, mz), thick + bump, h, 1.04, [0.42 * tone, 0.4 * tone, 0.38 * tone]);
          if (h === H && t.kind !== 'station') {
            b.box(mats.concrete, onFace(0.01, 0.35), 0.03, 0.7, 1.04, [0.2, 0.21, 0.19]);
            if (run % 8 === 0) b.box(mats.concrete, onFace(0.15, H / 2), 0.3, H, 0.55, [0.5 * tone, 0.48 * tone, 0.45 * tone]);
            else if (run % 29 === 14) {
              // Refuge niche: a dark recess with a light frame.
              b.box(mats.dark, onFace(0.015, 1.05), 0.02, 2.1, 1.0);
              b.box(mats.concrete, onFace(0.03, 2.18), 0.05, 0.12, 1.2, [0.6, 0.58, 0.54]);
            }
            // Cable tray on brackets along the wall.
            b.box(mats.iron, onFace(0.1, 2.05), 0.16, 0.05, 1.04, [0.24, 0.24, 0.22]);
            b.box(mats.rubber, onFace(0.1, 2.12), 0.12, 0.09, 1.04, [0.12, 0.12, 0.12]);
            if (run % 2 === 0) b.box(mats.iron, onFace(0.08, 2.0), 0.16, 0.12, 0.05, [0.3, 0.3, 0.28]);
            // U-Bahn tunnel lamp: a caged bulkhead light on the wall, every 12 m, alternating sides and shades.
            if ((t.kind === 'track' || t.kind === 'bypass') && (run + (side > 0 ? 6 : 0)) % 12 === 0) {
              const cold = ((run / 12) | 0) % 3 === 1;
              b.box(mats.iron, onFace(0.08, 2.75), 0.16, 0.3, 0.42, [0.2, 0.2, 0.2]);
              b.box(mats.lampGlass, onFace(0.17, 2.75), 0.04, 0.2, 0.32, cold ? [1.2, 1.5, 1.8] : [1.7, 1.25, 0.55]);
              b.light(new Vector3(fx - nx * 0.5, 2.6, fz - nz * 0.5), cold ? 0xd8ecff : 0xffb060, 18, 10, 0.02, 4.5, { yaw: Math.atan2(-nx, -nz), stretch: 1.3, reach: 1.6, halo: 0.3 });
            }
          }
          b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(mx, h + 0.05, mz), thick + 0.4, 0.1, 1.04, h < H ? [0.3, 0.29, 0.27] : [0.08, 0.08, 0.09]);
          b.shadowBox(new Matrix4().makeRotationY(yaw).setPosition(mx, h / 2, mz), thick, h, 1.04);
          if (t.kind === 'station') {
            // Tiled band at eye height (cream tiles), as on the old S-Bahn halls; M20: a stripe in the line color.
            b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(ex + nx * 0.02, 1.6, ez + nz * 0.02), 0.08, 1.8, 1.04, [0.86, 0.82, 0.7]);
            b.box(mats.concrete, new Matrix4().makeRotationY(yaw).setPosition(ex + nx * 0.01, 2.25, ez + nz * 0.01), 0.1, 0.24, 1.04, stripe);
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

/** One outward facade of a block. `face`: 0 street front, 1 right, 2 back, 3 left, 4 chamfer; `back`: how far it stands behind the lot front. */
export interface Side { a: Pt; b: Pt; len: number; face: number; back: number }

/**
 * The outward facades of a block: the front piece(s) from left to right, then right side, back and
 * left side (see map.ts for the frame). A plain rectangle gives exactly front, right, back, left.
 */
export function blockFacades(l: LotFrame): Side[] {
  const loc = lotOutlineLocal(l), hd = l.d / 2;
  return loc.map((p, i) => {
    const q = loc[(i + 1) % loc.length] as Pt, da = q[0] - p[0], db = q[1] - p[1], len = Math.hypot(da, db);
    const na = -db / len, nb = da / len;
    const face = nb > 0.9 ? 0 : na > 0.9 ? 1 : nb < -0.9 ? 2 : na < -0.9 ? 3 : 4;
    return { a: lotToWorld(l, p[0], p[1]), b: lotToWorld(l, q[0], q[1]), len, face, back: hd - Math.max(p[1], q[1]) };
  });
}

/** Flat cap over a footprint outline (lot frame [a, b]) at height y, facing up; place it with the lot matrix. */
function capGeo(pts: readonly Pt[], y: number, uv = 3): BufferGeometry {
  const tris = ShapeUtils.triangulateShape(pts.map(([a, b]) => new Vector2(a, b)), []);
  const pos: number[] = [], uvs: number[] = [];
  for (const t of tris) {
    const [p0, p1, p2] = t.map((k) => pts[k] as Pt) as [Pt, Pt, Pt];
    // Counter-clockwise seen from above (normal +Y).
    const up = (p1[1] - p0[1]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[1] - p0[1]) > 0;
    for (const p of up ? [p0, p1, p2] : [p0, p2, p1]) {
      pos.push(p[0], y, p[1]);
      uvs.push(p[0] / uv, p[1] / uv);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.computeVertexNormals();
  return g;
}

/** Quads with free per-corner UVs and colours, merged as one geometry (flat normals). */
class Quads {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly col: number[] = [];
  /** Corners counter-clockwise seen from the front; `uv` and `c` per corner. */
  add(p: Vector3[], uv: number[], c: readonly RGB[]): void {
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const v = p[i] as Vector3, k = c[i] ?? c[0] as RGB;
      this.pos.push(v.x, v.y, v.z);
      this.uv.push(uv[i * 2] as number, uv[i * 2 + 1] as number);
      this.col.push(k[0], k[1], k[2]);
    }
  }
  flush(b: ChunkBuilder, mat: Material): void {
    if (!this.pos.length) return;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeVertexNormals();
    b.geo(mat, g, new Matrix4());
  }
}

type Profile = Array<[number, number]>;

/** Height of a polyline profile at `s` (clamped at the ends). */
function profileAt(p: Profile, s: number): number {
  if (s <= (p[0] as [number, number])[0]) return (p[0] as [number, number])[1];
  for (let i = 1; i < p.length; i++) {
    const [s1, h1] = p[i] as [number, number];
    if (s <= s1) {
      const [s0, h0] = p[i - 1] as [number, number];
      return s1 - s0 < 1e-6 ? h1 : h0 + ((h1 - h0) * (s - s0)) / (s1 - s0);
    }
  }
  return (p[p.length - 1] as [number, number])[1];
}

/**
 * Broken top line of a ruin wall: nodes every few metres joined by brick-tooth steps, ragged
 * diagonals or a V-shaped break. Steps are two points 2 mm apart. `band` gives the height range
 * of a node at s (see `ruinMass`).
 */
function ruinProfile(rng: Rng, len: number, band: (s: number) => readonly [number, number], gable: number, floor: number): Profile {
  const nodes: Array<[number, number]> = [];
  for (let s = 0; ; s += rng.range(1.6, 4.2)) {
    const at = Math.min(s, len);
    const peak = gable ? gable * Math.max(0, 1 - Math.abs((2 * at) / len - 1)) * rng.range(0.7, 1) : 0;
    const [lo, hi] = band(at);
    nodes.push([at, Math.max(floor, rng.range(lo, hi) + peak)]);
    if (at >= len) break;
  }
  const p: Profile = [nodes[0] as [number, number]];
  for (let i = 1; i < nodes.length; i++) {
    const [sa, ha] = nodes[i - 1] as [number, number], [sb, hb] = nodes[i] as [number, number];
    const roll = rng.next(), span = sb - sa;
    if (roll < 0.5 && span > 0.6) {
      // Brick teeth: courses broken back in steps.
      const n = Math.max(1, Math.min(8, Math.round(Math.abs(hb - ha) / rng.range(0.28, 0.55))));
      let h = ha;
      for (let j = 1; j <= n; j++) {
        const sj = sa + (span * (j - 0.5 + rng.range(-0.3, 0.3))) / n;
        const hj = j === n ? hb : ha + ((hb - ha) * j) / n + rng.range(-0.08, 0.08);
        p.push([sj - 0.001, h], [sj + 0.001, hj]);
        h = hj;
      }
      p.push([sb, hb]);
    } else if (roll < 0.82 || span < 1.2) {
      // Ragged diagonal break.
      const n = Math.max(1, Math.round(span / 0.45));
      for (let j = 1; j < n; j++) p.push([sa + (span * j) / n, ha + ((hb - ha) * j) / n + rng.range(-0.14, 0.14)]);
      p.push([sb, hb]);
    } else {
      // V-break: a chunk fell out between two standing piers.
      const ms = sa + span * rng.range(0.35, 0.65), mh = Math.max(floor, Math.min(ha, hb) - rng.range(0.8, 2.6));
      for (const [s, h] of [[sa + (ms - sa) * 0.5, (ha + mh) / 2 + rng.range(-0.15, 0.15)], [ms, mh], [ms + (sb - ms) * 0.5, (hb + mh) / 2 + rng.range(-0.15, 0.15)], [sb, hb]] as Array<[number, number]>) p.push([s, h]);
    }
  }
  return p;
}

interface Hole { s0: number; s1: number; y: number; h: number }

/** Ruin wall mass, as fractions of the full height: still to the cornice, broken at an upper floor, down to the ground floor. */
const RUIN_LEVELS: ReadonlyArray<readonly [number, number]> = [[0.84, 1.02], [0.45, 0.68], [0.14, 0.3]];

/**
 * M11d: the mass of a ruin wall along its length, in stretches of 2.5 to 6.5 m that still stand to
 * the cornice, broke off at an upper floor or fell down to the ground floor, so the wall tops step
 * clearly from the game camera. The street front keeps more of its height.
 */
function ruinMass(rng: Rng, len: number, street: boolean): (s: number) => readonly [number, number] {
  const w = street ? [0.45, 0.35] : [0.28, 0.4];
  const pick = (): number => {
    const r = rng.next();
    return r < (w[0] as number) ? 0 : r < (w[0] as number) + (w[1] as number) ? 1 : 2;
  };
  const ends: Array<[number, number]> = [];
  let last = -1;
  for (let s = 0; s < len; ) {
    let k = pick();
    if (k === last) k = pick();
    s += rng.range(2.5, 6.5);
    ends.push([s, k]);
    last = k;
  }
  return (s) => RUIN_LEVELS[(ends.find((e) => s <= e[0]) ?? (ends[ends.length - 1] as [number, number]))[1]] as readonly [number, number];
}

/**
 * Stepped remains of a gable (firewall of the old pitched roof) on a flank: brick courses climb
 * from both ends to a broken peak above the old eaves; one course broke out lower.
 */
function gableSteps(rng: Rng, len: number, base: number, peak: number): Profile {
  const n = Math.max(2, Math.round(len / 2 / rng.range(0.75, 1.1))), bite = rng.int(2 * n);
  const p: Profile = [];
  for (let k = 0; k < 2 * n; k++) {
    const s0 = (k * len) / (2 * n), s1 = ((k + 1) * len) / (2 * n);
    let h = base + (peak - base) * (1 - Math.abs(k + 0.5 - n) / n) + rng.range(-0.1, 0.1);
    if (k === bite) h -= rng.range(0.7, 1.6);
    p.push([k ? s0 + 0.001 : s0, h], [k < 2 * n - 1 ? s1 - 0.001 : s1, h]);
  }
  return p;
}

/**
 * Burnt-out shell of an Altbau, shop or house on any footprint (M11d): no roof, wall tops in
 * stretches that still reach the cornice, broke at an upper floor or fell to the ground floor,
 * joined by jagged brick-tooth, diagonal and V-shaped breaks; collapsed corners, a stepped gable
 * on a flank, a chimney stack standing above it all, a broken cross wall inside, windows that break
 * the top line, soot above every opening, charred beam stubs and slab remnants, rubble heaps inside
 * and a little at the foot of the low stretches. Walls meet in mitred corners (also inner corners).
 * Same footprint and collider as the intact lot.
 */
function buildRuin(b: ChunkBuilder, l: Lot): void {
  const rng = new Rng(l.seed + 77);
  const tone = rng.pick(TONES);
  const plaster = b.mm.plaster[tone] as LitMaterial;
  const house = l.kind === 'house';
  const H = house ? 3.4 + l.floors * 2.9 : GROUND_H + l.floors * FLOOR_H + PARAPET;
  const levels = house ? (l.floors ? [3.2] : []) : Array.from({ length: l.floors }, (_, f) => GROUND_H + f * FLOOR_H);
  const rows: Array<[number, number]> = house ? [[1.1, 1.6], ...(l.floors ? [[4.0, 1.6] as [number, number]] : [])] : [[1.55, 1.75], ...levels.map((y): [number, number] => [y + 0.95, 1.95])];
  const winW = house ? 1.1 : 1.15;
  const wall = 0.4;
  const sides = blockFacades(l), n = sides.length, loc = lotOutlineLocal(l);
  const runs = sides.map((side, i) => new Run({ id: 'r', style: 'altbau', ax: side.a[0], az: side.a[1], bx: side.b[0], bz: side.b[1], depth: 1, floors: 0, tone, features: [], seed: l.seed + i }));
  const prevOf = (i: number): number => (i + n - 1) % n;
  // Vertex i starts side i. Convex corners turn right (outline order as in `lotOutlineLocal`).
  const convex = runs.map((q, i) => { const p = runs[prevOf(i)] as Run; return p.dx * q.dz - p.dz * q.dx < 0; });
  // Inner face: mitred at every vertex, so inner corners close as well as outer ones.
  const miter = runs.map((q, i): Pt => {
    const p = runs[prevOf(i)] as Run, v = (sides[i] as Side).a, k = wall / (1 + p.nx * q.nx + p.nz * q.nz);
    return [v[0] - (p.nx + q.nx) * k, v[1] - (p.nz + q.nz) * k];
  });
  const along = (r: Run, pt: Pt): number => (pt[0] - r.f.ax) * r.dx + (pt[1] - r.f.az) * r.dz;
  const t0 = runs.map((r, i) => along(r, miter[i] as Pt)), t1 = runs.map((r, i) => along(r, miter[(i + 1) % n] as Pt));
  const innU = (i: number, s: number): number => {
    const len = (runs[i] as Run).len, a = t0[i] as number, c = t1[i] as number;
    return s <= 1e-6 ? a : s >= len - 1e-6 ? c : Math.min(Math.max(s, a), c);
  };
  const inn = (i: number, s: number, y: number): Vector3 => (runs[i] as Run).pt(innU(i, s), y, -wall);
  // Collapsed corners (convex, between two real walls): low stump, then a ragged diagonal climbing away.
  const canFall = sides.map((s, i) => convex[i] && s.len >= 3 && (sides[prevOf(i)] as Side).len >= 3);
  const corners: Array<{ low: number; slope: number; r: number } | null> = sides.map((_, i) => (canFall[i] && rng.next() < 0.38 ? { low: rng.range(0.3, 1.6), slope: rng.range(0.9, 2.2), r: rng.range(2, 4.5) } : null));
  const fallable = canFall.flatMap((c, i) => (c ? [i] : []));
  if (!corners.some((c) => c !== null) && fallable.length) corners[rng.pick(fallable)] = { low: rng.range(0.5, 1.8), slope: rng.range(1, 2), r: rng.range(2.5, 4) };
  const ramp = (c: (typeof corners)[number] | undefined, len: number, from0: boolean): Profile | null => {
    if (!c) return null;
    const p: Profile = [];
    for (let d = 0; d <= Math.min(c.r * 2.5, len); d += 0.4) p.push([from0 ? d : len - d, c.low + d * c.slope + (d ? rng.range(-0.12, 0.12) : 0)]);
    return from0 ? p : p.reverse();
  };
  // A gable on one flank: the old pitched roof of a house, the stepped firewall of an Altbau (no windows).
  const flanks = sides.flatMap((s, i) => ((s.face === 1 || s.face === 3) && s.len >= Math.max(6, l.d * 0.62) ? [i] : []));
  const gableSide = flanks.length && (house ? l.floors && rng.next() < 0.6 : rng.next() < 0.45) ? rng.pick(flanks) : -1;
  const ridge = Math.min(l.w, l.d) * 0.42;
  const outer = new Quads(), inner = new Quads(), masonry = new Quads();
  const brickTint: RGB = [0.72, 0.6, 0.54];
  const darkIn: RGB = [0.26, 0.24, 0.24];
  const ends: Array<[number, number]> = [];
  const tops = sides.map((side, i) => {
    const len = side.len;
    // The street front stands highest; back and flanks crumble more.
    const street = side.face === 0 || side.face === 4;
    const mass = ruinMass(rng, len, street);
    const stepped = i === gableSide && !house;
    const base = stepped ? gableSteps(rng, len, H * rng.range(0.7, 0.92), H + rng.range(1.3, 2.6))
      : ruinProfile(rng, len, (s) => { const [lo, hi] = mass(s); return [H * lo, H * hi]; }, i === gableSide ? ridge : 0, 1.1);
    const cuts = [ramp(corners[i], len, true), ramp(corners[(i + 1) % n], len, false)].filter((p): p is Profile => !!p);
    const wallTop = (s: number): number => Math.min(profileAt(base, s), ...cuts.map((p) => profileAt(p, s)));
    // Windows: holes where the wall still stands above them, notches where the break cuts through.
    const holes: Hole[] = [], notches: Hole[] = [];
    const bays = stepped || len < winW + 1 ? 0 : Math.max(1, Math.round(len / 2.7));
    for (let k = 0; k < bays; k++) {
      const mid = ((k + 0.5) * len) / bays;
      for (const [y, h] of rows) {
        if (y < 1.6 && rng.next() < 0.3) continue;
        const w = { s0: mid - winW / 2, s1: mid + winW / 2, y, h };
        let lowest = Infinity;
        for (let s = w.s0 - 0.15; s <= w.s1 + 0.15; s += 0.1) lowest = Math.min(lowest, wallTop(s));
        if (lowest > y + h + 0.45) holes.push(w);
        else if (wallTop(mid) > y + 0.45 && w.s0 > 0.5 && w.s1 < len - 0.5) notches.push(w);
      }
    }
    const top = (s: number): number => Math.min(wallTop(s), ...notches.filter((w) => s > w.s0 && s < w.s1).map((w) => w.y));
    const bps = [...new Set([0, len, ...base.map((p) => p[0]), ...cuts.flatMap((p) => p.map((q) => q[0])), ...[...holes, ...notches].flatMap((w) => [w.s0, w.s1])]
      .filter((s) => s >= 0 && s <= len).map((s) => Math.round(s * 1e4) / 1e4))].sort((x, y) => x - y);
    return { len, bps, top, holes, notches };
  });
  tops.forEach(({ len, bps, top, holes, notches }, i) => {
    const run = runs[i] as Run;
    const tint = (y: number, soot: number): RGB => {
      const low = Math.min(1, y / 1.8), k = 0.82 * (1 - soot);
      return [(0.5 + 0.5 * low - y * 0.012) * k, (0.54 + 0.44 * low - y * 0.012) * k * 0.97, (0.52 + 0.46 * low - y * 0.01) * k * 0.95];
    };
    const sootAt = (s: number, y: number): number => Math.max(0, ...[...holes, ...notches].filter((w) => s >= w.s0 - 0.2 && s <= w.s1 + 0.2 && y >= w.y + w.h - 0.01).map((w) => 0.68 * Math.max(0, 1 - (y - w.y - w.h) / 2.4)));
    const band = new Map<number, number>(bps.map((s) => [s, rng.range(0.18, 0.6)]));
    for (let k = 0; k < bps.length - 1; k++) {
      const sa = bps[k] as number, sb = bps[k + 1] as number;
      if (sb - sa < 1e-4) continue;
      const ta = top(sa + 1e-5), tb = top(sb - 1e-5), mid = (sa + sb) / 2;
      const thick = Math.abs(innU(i, sb) - innU(i, sa)) > 1e-4;
      const here = holes.filter((w) => mid > w.s0 && mid < w.s1).sort((p, q) => p.y - q.y);
      // V1 B cutaway: a 0.4 m lid on the wall where it still stands at the cut height (not over breaks or windows).
      if (b.cutAt !== null) {
        const ch = b.cutAt - b.base;
        if ((ta > ch || tb > ch) && !here.some((w) => ch > w.y && ch < w.y + w.h)) {
          const at = (t: number): number => sa + ((sb - sa) * (t - ta)) / (tb - ta);
          const s0 = ta < ch ? at(ch) : sa, s1 = tb < ch ? at(ch) : sb;
          b.lids.push([run.pt(s0, 0, 0), run.pt(s1, 0, 0), run.pt(s1, 0, -wall), run.pt(s0, 0, -wall)].map((p): Pt => [p.x, p.z]));
        }
      }
      // Vertical pieces of wall between the openings, cut at the dirt line and the soot fade.
      let y0 = 0;
      const pieces: Array<[number, number, number]> = []; // y0, y1 (flat) or -1 for the broken top
      for (const w of here) { pieces.push([y0, w.y, 0]); y0 = w.y + w.h; }
      const solid = y0;
      const lowTop = Math.min(ta, tb);
      const marks = [1.8, ...[...holes, ...notches].filter((w) => mid > w.s0 - 0.2 && mid < w.s1 + 0.2).map((w) => w.y + w.h + 2.4)].filter((y) => y > y0 + 0.05 && y < lowTop - 0.05).sort((p, q) => p - q);
      for (const y of marks) { pieces.push([y0, y, 0]); y0 = y; }
      pieces.push([y0, 0, -1]);
      for (const [a, c, kind] of pieces) {
        const ya = kind < 0 ? Math.max(a, ta) : c, yb = kind < 0 ? Math.max(a, tb) : c;
        if (ya - a < 0.005 && yb - a < 0.005) continue;
        const u0 = (sa + run.f.seed * 1.7) / 6, u1 = (sb + run.f.seed * 1.7) / 6;
        outer.add([run.pt(sa, a, 0), run.pt(sb, a, 0), run.pt(sb, yb, 0), run.pt(sa, ya, 0)], [u0, a / 6, u1, a / 6, u1, yb / 6, u0, ya / 6],
          [tint(a, sootAt(sa, a)), tint(a, sootAt(sb, a)), tint(yb, sootAt(sb, yb)), tint(ya, sootAt(sa, ya))]);
        if (thick) inner.add([inn(i, sb, a), inn(i, sa, a), inn(i, sa, ya), inn(i, sb, yb)], [u1, a / 6, u0, a / 6, u0, ya / 6, u1, yb / 6], [darkIn]);
      }
      // Broken top: spalled plaster shows a ragged brick band, then the brick core on top.
      const ba = Math.min(band.get(sa) ?? 0.3, ta - solid), bb = Math.min(band.get(sb) ?? 0.3, tb - solid);
      if (ba > 0.02 || bb > 0.02) masonry.add([run.pt(sa, ta - ba, 0.012), run.pt(sb, tb - bb, 0.012), run.pt(sb, tb, 0.012), run.pt(sa, ta, 0.012)], [sa / 2, (ta - ba) / 2, sb / 2, (tb - bb) / 2, sb / 2, tb / 2, sa / 2, ta / 2], [[0.62, 0.52, 0.46], [0.62, 0.52, 0.46], [0.42, 0.36, 0.33], [0.42, 0.36, 0.33]]);
      masonry.add([run.pt(sa, ta, 0), run.pt(sb, tb, 0), inn(i, sb, tb), inn(i, sa, ta)], [sa / 2, 0, sb / 2, 0, sb / 2, wall / 2, sa / 2, wall / 2], [brickTint]);
      // Steps in the top line show the cut brick.
      const tn = k + 2 < bps.length ? top(sb + 1e-5) : tb;
      if (Math.abs(tn - tb) > 0.02) {
        const lo = Math.min(tn, tb), hi = Math.max(tn, tb);
        masonry.add(tb > tn ? [run.pt(sb, lo, 0), inn(i, sb, lo), inn(i, sb, hi), run.pt(sb, hi, 0)] : [inn(i, sb, lo), run.pt(sb, lo, 0), run.pt(sb, hi, 0), inn(i, sb, hi)],
          [0, lo / 2, wall / 2, lo / 2, wall / 2, hi / 2, 0, hi / 2], [brickTint]);
      }
    }
    // Window reveals.
    for (const w of holes) {
      const { s0, s1, y, h } = w, t = y + h, rv: RGB = [0.45, 0.4, 0.38];
      masonry.add([run.pt(s0, y, 0), inn(i, s0, y), inn(i, s0, t), run.pt(s0, t, 0)], [0, y / 2, wall / 2, y / 2, wall / 2, t / 2, 0, t / 2], [rv]);
      masonry.add([inn(i, s1, y), run.pt(s1, y, 0), run.pt(s1, t, 0), inn(i, s1, t)], [0, y / 2, wall / 2, y / 2, wall / 2, t / 2, 0, t / 2], [rv]);
      masonry.add([run.pt(s0, y, 0), run.pt(s1, y, 0), inn(i, s1, y), inn(i, s0, y)], [s0 / 2, 0, s1 / 2, 0, s1 / 2, wall / 2, s0 / 2, wall / 2], [rv]);
      masonry.add([run.pt(s1, t, 0), run.pt(s0, t, 0), inn(i, s0, t), inn(i, s1, t)], [s1 / 2, 0, s0 / 2, 0, s0 / 2, wall / 2, s1 / 2, wall / 2], [[0.3, 0.27, 0.26]]);
      // Stone sill and a sooty lintel keep the Altbau rhythm; some sills broke away.
      if (!house && rng.next() < 0.7) b.box(b.mm.stucco, run.mat((s0 + s1) / 2, y - 0.06, 0.1, 0, rng.range(-0.04, 0.04)), winW + 0.36, 0.12, 0.22, [0.55, 0.53, 0.5]);
    }
    for (const w of notches) if (rng.next() < 0.6) b.box(b.mm.stucco, run.mat((w.s0 + w.s1) / 2, w.y - 0.06, 0.1, 0, rng.range(-0.08, 0.08)), winW + 0.3, 0.12, 0.22, [0.5, 0.48, 0.46]);
    // Floor cornices where the wall still stands above them: they end at the breaks like slab edges.
    for (const y of len > 1.2 ? levels : []) {
      let from = -1;
      for (let s = 0; s <= len + 0.01; s += 0.25) {
        const up = s < len && top(s) > y + 0.35 && !holes.some((w) => y > w.y - 0.1 && y < w.y + w.h + 0.1 && s > w.s0 - 0.1 && s < w.s1 + 0.1);
        if (up && from < 0) from = s;
        if (!up && from >= 0) {
          if (s - from > 0.5) b.box(b.mm.stucco, run.mat((from + s) / 2, y, 0.07), s - from, 0.2, 0.16, [0.6, 0.58, 0.55]);
          from = -1;
        }
      }
    }
    ends.push([top(1e-5), top(len - 1e-5)]);
    let sum = 0;
    for (let s = 0.25; s < len; s += 0.5) sum += top(s);
    const avg = sum / Math.max(1, Math.floor(len / 0.5));
    b.shadowBox(run.mat(len / 2, avg / 2, -wall / 2), len, avg, wall);
  });
  // Corner ends: where one wall stands higher than its neighbour, close its end along the mitre.
  tops.forEach(({ len }, i) => {
    const run = runs[i] as Run;
    const [h0, h1] = ends[i] as [number, number];
    const prev = (ends[prevOf(i)] as [number, number])[1], next = (ends[(i + 1) % n] as [number, number])[0];
    if (h0 > prev + 0.02) outer.add([inn(i, 0, prev), run.pt(0, prev, 0), run.pt(0, h0, 0), inn(i, 0, h0)], [0, prev / 6, wall / 6, prev / 6, wall / 6, h0 / 6, 0, h0 / 6], [[0.6, 0.58, 0.55]]);
    if (h1 > next + 0.02) outer.add([run.pt(len, next, 0), inn(i, len, next), inn(i, len, h1), run.pt(len, h1, 0)], [0, next / 6, wall / 6, next / 6, wall / 6, h1 / 6, 0, h1 / 6], [[0.6, 0.58, 0.55]]);
  });
  // Inside: charred floor, beam stubs and slab remnants at the old floor levels, rubble heaps.
  const m4 = new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0.04, l.z);
  const local = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): Matrix4 => m4.clone().multiply(new Matrix4().makeRotationFromEuler(new Euler(rx, ry, rz)).setPosition(x, y, z));
  if (l.shape) b.geo(b.mm.tar, capGeo(loc, 0.03), m4, [0.35, 0.33, 0.32]);
  else b.box(b.mm.tar, m4, l.w - 0.8, 0.06, l.d - 0.8, [0.35, 0.33, 0.32]);
  const charred: RGB = [0.32, 0.27, 0.23];
  tops.forEach(({ len, top }, i) => {
    const run = runs[i] as Run;
    if (len < 3.5) return;
    for (const y of levels) {
      if (rng.next() < 0.35) continue;
      // Joist stubs: charred beams sticking out of the inner face, some sagging.
      const s0 = rng.range(0.6, Math.max(0.7, len - 3)), k0 = 2 + rng.int(4);
      for (let k = 0; k < k0; k++) {
        const s = s0 + k * rng.range(0.7, 1.0), reach = rng.range(0.4, 2.2);
        if (s > len - 0.5 || top(s) < y + 0.3) continue;
        b.box(b.mm.darkWood, run.mat(s, y - 0.1, -wall - reach / 2 + 0.05, rng.range(-0.05, 0.25 * reach), rng.range(-0.08, 0.08)), 0.18, 0.24, reach, charred);
      }
      // A concrete slab remnant cantilevers from the wall with a ragged edge.
      if (!house && rng.next() < 0.4) {
        const s = rng.range(1, Math.max(1.1, len - 3)), w = rng.range(1.2, 2.8), dep = rng.range(0.6, 1.6);
        if (top(s) > y + 0.3 && top(s + w) > y + 0.3) {
          const sag = rng.range(0, 0.25);
          b.box(b.mm.concrete, run.mat(s + w / 2, y - 0.12, -wall - dep / 2, sag), w, 0.22, dep, [0.55, 0.52, 0.5]);
          for (let x = s + 0.2; x < s + w; x += rng.range(0.35, 0.6)) b.box(b.mm.concrete, run.mat(x, y - 0.14, -wall - dep - 0.15, sag + rng.range(0.1, 0.5), rng.range(-0.2, 0.2)), rng.range(0.3, 0.5), 0.18, rng.range(0.2, 0.5), [0.5, 0.48, 0.46]);
          for (let x = s + 0.3; x < s + w; x += 0.45) b.box(b.mm.rust, run.mat(x, y - 0.2, -wall - dep - 0.3, sag + rng.range(0.3, 0.9)), 0.03, 0.03, 0.5);
        }
      }
    }
  });
  // Chimney stacks: the flue walls outlast everything and stand above the broken tops.
  const backs = sides.flatMap((s, i) => (s.face !== 0 && s.face !== 4 && s.len >= 4 && i !== gableSide ? [i] : []));
  for (let k = house ? (l.floors ? 1 : 0) : 1 + (rng.next() < 0.4 ? 1 : 0); k > 0 && backs.length; k--) {
    const i = rng.pick(backs), run = runs[i] as Run, s = rng.range(1.2, run.len - 1.2);
    const ht = Math.max((tops[i] as { top: (s: number) => number }).top(s) + rng.range(0.6, 2), H * rng.range(0.6, 0.85));
    const soot: RGB = [0.5, 0.43, 0.4];
    b.box(b.mm.brick, run.mat(s, ht / 2, -wall - 0.27), 0.95, ht, 0.55, soot);
    b.box(b.mm.brick, run.mat(s, ht + 0.07, -wall - 0.27), 1.1, 0.14, 0.7, [0.42, 0.37, 0.35]);
    if (rng.next() < 0.6) b.box(b.mm.brick, run.mat(s + rng.range(-0.25, 0.25), ht + 0.32, -wall - 0.27, 0, rng.range(-0.2, 0.2)), 0.3, 0.42, 0.3, [0.45, 0.4, 0.38]);
  }
  // A broken cross wall between front and back (Altbau): the shell no longer reads as an empty box.
  const hw = l.w / 2, hd = l.d / 2, ch = l.shape?.chamfer;
  if (!house && l.w >= 10 && rng.next() < 0.65) {
    const a = rng.range(-hw + 2.6, hw - 2.6), piece = lotPieces(l).find((p) => a >= p.a0 && a <= p.a1);
    const f = piece ? piece.f - (ch && Math.abs(a - ch.side * hw) < ch.c + 0.3 ? ch.c : 0) : -hd;
    const len = f - wall - (-hd + wall), t = 0.15;
    if (len > 4) {
      const [ax, az] = lotToWorld(l, a, -hd + wall), [bx, bz] = lotToWorld(l, a, f - wall);
      const run = new Run({ id: 'x', style: 'altbau', ax, az, bx, bz, depth: 1, floors: 0, tone, features: [], seed: l.seed });
      const p = ruinProfile(rng, len, () => [H * 0.25, H * 0.8], 0, 0.8);
      for (let k = 1; k < p.length; k++) {
        const [sa, ha] = p[k - 1] as [number, number], [sb, hb] = p[k] as [number, number];
        if (sb - sa < 1e-4) {
          const lo = Math.min(ha, hb), hi = Math.max(ha, hb);
          masonry.add([run.pt(sb, lo, t), run.pt(sb, lo, -t), run.pt(sb, hi, -t), run.pt(sb, hi, t)], [0, lo / 2, 0.15, lo / 2, 0.15, hi / 2, 0, hi / 2], [brickTint]);
          masonry.add([run.pt(sb, lo, -t), run.pt(sb, lo, t), run.pt(sb, hi, t), run.pt(sb, hi, -t)], [0, lo / 2, 0.15, lo / 2, 0.15, hi / 2, 0, hi / 2], [brickTint]);
          continue;
        }
        inner.add([run.pt(sa, 0, t), run.pt(sb, 0, t), run.pt(sb, hb, t), run.pt(sa, ha, t)], [sa / 6, 0, sb / 6, 0, sb / 6, hb / 6, sa / 6, ha / 6], [[0.4, 0.37, 0.36], [0.4, 0.37, 0.36], darkIn, darkIn]);
        inner.add([run.pt(sb, 0, -t), run.pt(sa, 0, -t), run.pt(sa, ha, -t), run.pt(sb, hb, -t)], [sb / 6, 0, sa / 6, 0, sa / 6, ha / 6, sb / 6, hb / 6], [[0.4, 0.37, 0.36], [0.4, 0.37, 0.36], darkIn, darkIn]);
        masonry.add([run.pt(sa, ha, t), run.pt(sb, hb, t), run.pt(sb, hb, -t), run.pt(sa, ha, -t)], [sa / 2, 0, sb / 2, 0, sb / 2, 0.15, sa / 2, 0.15], [brickTint]);
      }
      b.shadowBox(run.mat(len / 2, H * 0.25, 0), len, H * 0.5, t * 2);
    }
  }
  outer.flush(b, plaster);
  inner.flush(b, plaster);
  masonry.flush(b, b.mm.brick);
  // Rubble: big heaps under the collapsed corners, smaller ones along the walls, loose bricks.
  const heap = (at: Matrix4, r: number, h: number): void => {
    const g = rng.range(0.55, 0.8);
    const geo = new IcosahedronGeometry(1, 0);
    b.geo(b.mm.brick, geo, at.clone().multiply(new Matrix4().makeRotationY(rng.range(0, 6)).setPosition(0, -h * 0.25, 0)).multiply(tmpScale.makeScale(r, h, r * rng.range(0.7, 1))), [g, g * 0.9, g * 0.85]);
    for (let k = 0; k < 4; k++) {
      const a = rng.range(0, Math.PI * 2), d = r * rng.range(0.4, 1.0);
      b.box(rng.next() < 0.7 ? b.mm.brick : plaster, at.clone().multiply(new Matrix4().makeRotationFromEuler(new Euler(rng.range(-0.5, 0.5), rng.range(0, 3), rng.range(-0.5, 0.5))).setPosition(Math.cos(a) * d, h * 0.35 * rng.next(), Math.sin(a) * d)),
        rng.range(0.3, 0.8), rng.range(0.15, 0.35), rng.range(0.25, 0.5), [g, g * 0.92, g * 0.88]);
    }
  };
  // Heaps stay inside the footprint (a, b in the lot frame).
  const roomFor = (a: number, c: number, r: number): boolean => inPoly(loc, a, c) && polyEdgeDist(loc, a, c) > r * 0.9 + 0.3;
  corners.forEach((c, k) => {
    if (!c) return;
    const v = loc[k] as Pt, p = loc[prevOf(k)] as Pt, q = loc[(k + 1) % n] as Pt;
    // Inward bisector from the two edge directions (local frame).
    const d1 = Math.hypot(v[0] - p[0], v[1] - p[1]), d2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const ia = (v[0] - p[0]) / d1 * -1 + (q[0] - v[0]) / d2, ib = (v[1] - p[1]) / d1 * -1 + (q[1] - v[1]) / d2, il = Math.hypot(ia, ib) || 1;
    const r = Math.min(2.2, hw - 0.5, hd - 0.5), off = (r + 0.3) * Math.SQRT2;
    const a = v[0] + (ia / il) * off, cb = v[1] + (ib / il) * off;
    if (roomFor(a, cb, r * 0.6)) heap(local(a, 0, cb), r, rng.range(0.9, 1.6));
  });
  for (let k = 0; k < 4; k++) {
    const r = rng.range(0.8, 1.5), i = rng.int(n), p = loc[i] as Pt, q = loc[(i + 1) % n] as Pt, len = (sides[i] as Side).len;
    if (len < 2 * r + 1) continue;
    const s = rng.range(r + 0.5, len - r - 0.5), da = (q[0] - p[0]) / len, db = (q[1] - p[1]) / len;
    const a = p[0] + da * s + db * (r + 0.45), cb = p[1] + db * s - da * (r + 0.45);
    if (roomFor(a, cb, r)) heap(local(a, 0, cb), r, rng.range(0.4, 0.9));
  }
  // A little rubble spilled out at the foot of the stretches that fell to the ground floor.
  tops.forEach(({ len, top }, i) => {
    if (len < 3 || rng.next() > 0.7) return;
    for (let s = 1.2; s < len - 1.2; s += 1.5) {
      if (top(s) > H * 0.32) continue;
      heap(new Matrix4().setPosition((runs[i] as Run).pt(s, 0.04, 0.05)), rng.range(0.5, 0.75), rng.range(0.3, 0.45));
      break;
    }
  });
  // A fallen roof beam across the largest open room.
  const big = lotBoxesLocal(l).reduce((p, q) => (q.ha * q.hb > p.ha * p.hb ? q : p));
  const beam = Math.min(big.ha, big.hb) * 1.6;
  b.box(b.mm.darkWood, local(big.a, 0.9, big.b, rng.range(0, 3), 0, 0.35), beam, 0.25, 0.25, [0.4, 0.35, 0.3]);
}

/** An Altbau, shop or Platte block; `inner` marks a back wing (no shop front, door only at the back). */
export function buildAltbauLot(b: ChunkBuilder, l: Lot & { inner?: boolean }, m: MapDef): void {
  const rng = new Rng(l.seed);
  const pick = rng.pick(TONES);
  const tone = pick;
  const sides = blockFacades(l);
  const main = streetDist(m, l.x + Math.sin(l.rot) * l.d, l.z + Math.cos(l.rot) * l.d).street?.kind === 'main';
  // M11d: the street piece that carries the shop or the main door (the longest one at the lot front);
  // door niches, the back wall of an open courtyard and some chamfers get their own door.
  const front = sides.reduce((best, s, i) => (s.face === 0 && (best < 0 || s.len - s.back * 4 > (sides[best] as Side).len - (sides[best] as Side).back * 4) ? i : best), -1);
  const niche = sides.some((s) => s.face === 0 && s.back >= 1 && s.len < 3.2);
  sides.forEach((s, i) => {
    const features: FacadeFeature[] = [];
    const centered = (): void => void features.push({ kind: 'door', from: s.len / 2 - 0.7, to: s.len / 2 + 0.7 });
    if (i === front && l.kind === 'shop') {
      // Single-storey Laden / Späti: shop window over most of the front.
      const from = Math.max(0.6, (s.len - 7) / 2);
      features.push({ kind: 'spati', from, to: Math.min(s.len - 0.6, from + 7) });
    } else if (i === front && !l.inner) {
      if (s.len > 15 && rng.next() < (main ? 0.4 : 0.22)) {
        const from = rng.range(1.5, s.len - 9.5);
        features.push({ kind: 'spati', from, to: from + 7 });
        const door = from > 5 ? 1.6 : from + 8.5;
        if (door + 1.4 < s.len - 0.5) features.push({ kind: 'door', from: door, to: door + 1.4 });
      } else if (!niche) {
        if (s.len < 5.5) centered();
        else {
          const d = rng.range(2, s.len - 3.5);
          features.push({ kind: 'door', from: d, to: d + 1.4 });
        }
      }
    } else if (!l.inner && s.face === 0 && s.back >= 1 && s.len >= 2) centered();
    else if (!l.inner && s.face === 4 && s.len > 2.4 && rng.next() < 0.6) centered();
    else if (s.face === 2 && rng.next() < 0.5) {
      const d = rng.range(1.5, s.len - 3);
      features.push({ kind: 'door', from: d, to: d + 1.4 });
    }
    const f: Facade = {
      id: `lot${l.seed}-${i}`, style: 'altbau', ax: s.a[0], az: s.a[1], bx: s.b[0], bz: s.b[1],
      // Shaped blocks cast their shadow from the footprint boxes below.
      depth: l.shape ? 0.3 : Math.min(l.w, l.d) / 2, floors: l.floors, tone, features, seed: (l.seed + i * 13) % 997,
      // M15 Blockrand: the side walls touch the neighbours or stand bare over a Baulücke.
      ...(l.block && (s.face === 1 || s.face === 3) ? { blank: true } : {}),
    };
    buildAltbau(b, f, { balconies: l.kind !== 'platte' && s.len > 3 });
    if (l.kind === 'platte' && (s.face === 0 || s.face === 2)) b.solid.excludeOccluder(() => loggias(b, f, l.seed * 3 + i));
    // Organic light at height (Johannes 2026-11-16): some street doors get front steps and a wall
    // lamp that throws a pool onto the sidewalk; warm, cold LED or (rarely) teal.
    const door = (s.face === 0 || s.face === 4) && !l.inner ? features.find((g) => g.kind === 'door') : undefined;
    if (door) {
      const run = new Run(f);
      const mid = (door.from + door.to) / 2;
      if (rng.next() < 0.5) {
        b.box(b.mm.cobbles, run.mat(mid, 0.1, 0.45), Math.min(2.0, s.len), 0.2, 0.9, [0.85, 0.82, 0.78]);
        b.box(b.mm.cobbles, run.mat(mid, 0.27, 0.25), Math.min(1.7, s.len), 0.16, 0.5, [0.9, 0.87, 0.83]);
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
  const loc = lotOutlineLocal(l);
  if (!l.shape) b.box(b.mm.tar, m4, l.w - 0.1, 0.1, l.d - 0.1, [0.6, 0.6, 0.6]);
  else {
    b.geo(b.mm.tar, capGeo(loc, 0.03), m4, [0.6, 0.6, 0.6]);
    for (const q of lotBoxesLocal(l)) b.shadowBox(new Matrix4().makeRotationY(l.rot + q.turn).setPosition(...lotXZ(l, q.a, H / 2, q.b)), q.ha * 2, H, q.hb * 2);
  }
  for (let i = 0; i < 2 + rng.int(3); i++) {
    const ca = rng.range(-l.w / 2 + 1, l.w / 2 - 1), cb = rng.range(-l.d / 2 + 1, l.d / 2 - 1);
    if (l.shape && !(inPoly(loc, ca, cb) && polyEdgeDist(loc, ca, cb) > 0.6)) continue;
    b.box(b.mm.brick, m4.clone().multiply(new Matrix4().setPosition(ca, 0.7, cb)), 0.8, 1.4, 0.6, [0.8, 0.75, 0.7]);
  }
}

/** World position [x, y, z] of a point in the lot frame. */
function lotXZ(l: LotFrame, a: number, y: number, b: number): [number, number, number] {
  const [x, z] = lotToWorld(l, a, b);
  return [x, y, z];
}

/**
 * Plattenbau loggias: stacks on every second (or third, two axes wide) window axis, one per upper
 * floor, with side walls or open; washed-out parapet panels, some replaced by sheet metal, boards or
 * a bare rail, a few slabs gone with the rebar showing. At most 1.2 m deep.
 */
function loggias(b: ChunkBuilder, f: Facade, seed: number): void {
  const run = new Run(f), rng = new Rng(seed);
  const bays = Math.floor(run.len / 2.7);
  if (f.floors < 1 || bays < 3) return;
  const spacing = run.len / bays, pair = rng.next() < 0.45, walls = rng.next() < 0.6, dep = rng.range(1.05, 1.2);
  const off = rng.int(pair ? 3 : 2);
  const hue = rng.pick<RGB>([[1.25, 0.8, 0.5], [0.75, 1.05, 0.9], [1.1, 1.0, 0.8], [0.75, 0.85, 1.1]]);
  const con = b.mm.concrete;
  for (let i = off; i < bays - (pair ? 1 : 0); i += pair ? 3 : 2) {
    const s = pair ? (i + 1) * spacing : (i + 0.5) * spacing, w = (pair ? 2 : 1) * spacing - 0.35;
    for (let k = 0; k < f.floors; k++) {
      const y = GROUND_H + k * FLOOR_H + 0.85;
      const fr = partOf(run.mat(s, y, 0));
      if (walls) for (const x of [-w / 2 - 0.08, w / 2 + 0.08]) b.box(con, fr(x, FLOOR_H / 2 - 0.1, dep / 2), 0.14, FLOOR_H - 0.2, dep, [0.62, 0.6, 0.57]);
      if (rng.next() < 0.08) {
        // Slab gone: a ragged stub and bent rebar.
        b.box(con, fr(0, -0.1, 0.12), w, 0.2, 0.24, [0.5, 0.48, 0.46]);
        for (let x = -w / 2 + 0.2; x < w / 2; x += 0.3) b.box(b.mm.rust, fr(x, -0.1, 0.4, rng.range(0.2, 1.1), rng.range(-0.3, 0.3)), 0.03, 0.03, rng.range(0.3, 0.6));
        continue;
      }
      b.box(con, fr(0, -0.1, dep / 2), w + (walls ? 0.3 : 0.1), 0.2, dep, [0.66, 0.64, 0.6]);
      const roll = rng.next(), g = rng.range(0.85, 1.05);
      if (roll < 0.62) b.box(con, fr(0, 0.55, dep - 0.05, 0, 0, rng.range(-0.01, 0.01)), w, 1.0, 0.1, [hue[0] * g * 0.7, hue[1] * g * 0.7, hue[2] * g * 0.7]);
      else if (roll < 0.76) b.box(b.mm.rust, fr(0, 0.5, dep - 0.04, rng.range(-0.05, 0.05)), w * rng.range(0.75, 1), 0.95, 0.04);
      else if (roll < 0.86) for (let x = -w / 2 + 0.12; x < w / 2; x += rng.range(0.2, 0.32)) b.box(b.mm.wood, fr(x, 0.5, dep - 0.04, 0, 0, rng.range(-0.06, 0.06)), 0.18, rng.range(0.8, 1.05), 0.03, [0.75, 0.65, 0.55]);
      else {
        b.box(b.mm.iron, fr(0, 1.0, dep - 0.05), w, 0.05, 0.05);
        for (let x = -w / 2; x <= w / 2; x += 0.5) b.box(b.mm.iron, fr(x, 0.5, dep - 0.05), 0.04, 1.0, 0.04);
      }
      if (rng.next() < 0.5) balconyLife(b, fr, rng, w, dep - 0.1, 1.0);
    }
  }
}

/** Small wooden balcony on knee braces under an upper-floor window, sometimes sagging. */
function woodBalcony(b: ChunkBuilder, run: Run, rng: Rng, s: number, y: number): void {
  const w = rng.range(1.8, 2.6), dep = rng.range(0.8, 1.1), dw = b.mm.darkWood, g = rng.range(0.7, 1);
  const f = partOf(run.mat(s, y, 0, rng.next() < 0.25 ? rng.range(0.06, 0.18) : 0, rng.range(-0.04, 0.04)));
  const tone: RGB = [g, g * 0.92, g * 0.85];
  b.box(dw, f(0, -0.05, dep / 2), w, 0.1, dep, tone);
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) {
    b.box(dw, f(x, -0.17, dep / 2), 0.12, 0.15, dep, tone);
    b.box(dw, f(x, -0.48, 0.36, -0.75), 0.1, 0.1, 0.95, tone);
    b.box(dw, f(x, 0.5, dep - 0.05), 0.09, 1.0, 0.09, tone);
  }
  b.box(dw, f(0, 0.95, dep - 0.05), w, 0.08, 0.1, tone);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) b.box(dw, f(x, 0.95, dep / 2), 0.08, 0.08, dep, tone);
  for (let x = -w / 2 + 0.2; x < w / 2 - 0.1; x += 0.15) if (rng.next() > 0.12) b.box(b.mm.wood, f(x, 0.48, dep - 0.06, 0, 0, rng.range(-0.04, 0.04)), 0.08, 0.82, 0.025, [0.8 * g, 0.7 * g, 0.6 * g]);
  if (rng.next() < 0.5) balconyLife(b, f, rng, w, dep, 0.95);
}

/** Gable roof prism along X (local), ridge at height h. */
export function gableRoof(w: number, d: number, h: number): BufferGeometry {
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

export function gableEnds(w: number, d: number, h: number): BufferGeometry {
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
export function walls(b: ChunkBuilder, l: { x: number; z: number; rot: number; w: number; d: number }, mat: Material, h: number, rows: number[], seed: number, lit = 0.25, bay = 3): void {
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
  // Now and then a small wooden balcony under an upper window (same axes as `walls`).
  const brng = new Rng(l.seed * 7 + 5);
  if (l.floors && brng.next() < 0.35) {
    const i = brng.pick([0, 0, 1, 2, 3]), side = blockFacades(l)[i] as { a: Pt; b: Pt; len: number };
    const bays = Math.max(1, Math.floor(side.len / 3));
    const run = new Run({ id: 'wb', style: 'altbau', ax: side.a[0], az: side.a[1], bx: side.b[0], bz: side.b[1], depth: 1, floors: 0, tone, features: [], seed: l.seed });
    b.solid.excludeOccluder(() => woodBalcony(b, run, brng, (brng.int(bays) + 0.5) * (side.len / bays), 3.9));
  }
  const m4 = new Matrix4().makeRotationY(l.rot).setPosition(l.x, h, l.z);
  const ridge = Math.min(l.w, l.d) * 0.42;
  b.geo(b.mm.roof, gableRoof(l.w, l.d, ridge), m4, [rng.range(0.75, 1), 0.85, 0.8]);
  b.geo(plaster, gableEnds(l.w, l.d, ridge), m4);
  b.shadowBox(new Matrix4().makeRotationY(l.rot).setPosition(l.x, h / 2, l.z), l.w, h, l.d);
}

// ---------------------------------------------------------------- beyond the closed edge (M11d step 4)

/**
 * A building mass in the row behind the edge (render only, in the fog): plaster body, a window grid
 * on the face toward the map (2 triangles per window, few lit), cornice, tar roof with chimneys or a
 * gable roof; a quarter burnt out and roofless. About 150-250 triangles.
 */
function buildBackdropBlock(b: ChunkBuilder, k: EdgeBlock): void {
  const rng = new Rng(k.seed);
  const H = GROUND_H + k.floors * FLOOR_H + PARAPET;
  const plaster = b.mm.plaster[rng.pick(TONES)] as LitMaterial;
  const burnt = rng.next() < 0.25;
  const tint: RGB = burnt ? [0.35, 0.34, 0.33] : [0.7, 0.7, 0.68];
  const F = new Matrix4().makeRotationY(k.rot).setPosition(k.x, 0, k.z);
  const part = (x: number, y: number, z: number): Matrix4 => F.clone().multiply(new Matrix4().makeTranslation(x, y, z));
  b.box(plaster, part(0, H / 2, 0), k.w, H, k.d, tint);
  // Face toward the map: local +Z.
  const c = Math.cos(k.rot), sn = Math.sin(k.rot);
  const pt = (x: number, y: number): Vector3 => new Vector3(k.x + c * x + sn * (k.d / 2 + 0.02), y, k.z - sn * x + c * (k.d / 2 + 0.02));
  const bays = Math.max(1, Math.floor(k.w / 2.7));
  for (let i = 0; i < bays; i++) {
    const x = -k.w / 2 + (i + 0.5) * (k.w / bays);
    for (let f = -1; f < k.floors; f++) {
      const y = f < 0 ? 1.55 : GROUND_H + f * FLOOR_H + 0.95;
      const h = f < 0 ? 1.75 : 1.95;
      const lit = !burnt && rng.next() < 0.05;
      const cell = lit ? rng.int(4) : 4 + rng.int(4);
      const cu = (cell % 4) / 4, cv = cell < 4 ? 0.5 : 0;
      b.solid.of(b.mm.windows).quad([pt(x - 0.57, y), pt(x + 0.57, y), pt(x + 0.57, y + h), pt(x - 0.57, y + h)], [cu, cv, cu + 0.25, cv + 0.5], burnt ? [[0.4, 0.4, 0.4]] : [[1, 1, 1]]);
    }
  }
  b.box(b.mm.stucco, part(0, GROUND_H, k.d / 2 + 0.08), k.w, 0.3, 0.2, [0.6, 0.6, 0.58]);
  b.box(b.mm.stucco, part(0, H - 0.3, k.d / 2 + 0.12), k.w, 0.4, 0.3, [0.6, 0.6, 0.58]);
  if (!burnt) {
    if (rng.next() < 0.4) {
      const ridge = Math.min(k.w, k.d) * 0.32;
      b.geo(b.mm.roof, gableRoof(k.w, k.d, ridge), part(0, H, 0), [rng.range(0.55, 0.75), 0.6, 0.58]);
      b.geo(plaster, gableEnds(k.w, k.d, ridge), part(0, H, 0), tint);
    } else b.box(b.mm.tar, part(0, H + 0.03, 0), k.w - 0.1, 0.1, k.d - 0.1, [0.5, 0.5, 0.5]);
    for (let i = 0; i < 2 + rng.int(2); i++) b.box(b.mm.brick, part(rng.range(-k.w / 2 + 1, k.w / 2 - 1), H + 0.8, rng.range(-k.d / 2 + 1, k.d / 2 - 1)), 0.8, 1.6, 0.6, [0.6, 0.55, 0.5]);
  }
  b.shadowBox(part(0, H / 2, 0), k.w, H, k.d);
}

/**
 * Ground beyond the bound along every edge run that is not water, 55 m out, so the camera sees
 * land under the backdrop instead of the water plane. The north and south strips also run past the
 * corners. Same ground material and blend as the map (one draw call per side). It starts 0.75 m
 * inside the bound, 3 cm under the map ground, so no crack shows at the seam.
 */
function buildEdgeSkirt(m: MapDef, mats: MapMats, runs: EdgeRun[], group: Group): void {
  const RINGS = [0.75, 0, -3, -8, -16, -30, -55];
  const sides = new Map<number, EdgeRun[]>();
  for (const r of runs) if (r.kind !== 'water') sides.set(r.side.i, [...(sides.get(r.side.i) ?? []), r]);
  for (const list of sides.values()) {
    const pos: number[] = [], col: number[] = [], uv: number[] = [], splat: number[] = [], idx: number[] = [];
    for (const r of list) {
      const s = r.side;
      const ns = s.i % 2 === 0;
      const t0 = ns && r.t0 === 0 ? -55 : r.t0;
      const t1 = ns && r.t1 >= s.len - 1e-6 ? s.len + 55 : r.t1;
      const ts: number[] = [];
      for (let t = t0; t < t1; t += 3) ts.push(t);
      ts.push(t1);
      const first = pos.length / 3;
      for (const t of ts) {
        const tc = Math.max(0, Math.min(s.len, t));
        const [ix, iz] = sidePt(s, tc, 1.5);
        const h0 = heightAt(m, ...sidePt(s, tc, 0)) - 0.03;
        const sp = groundSplat(m, ix, iz, false);
        const tint = GROUND_TINT[areaAt(m, ix, iz)?.ground ?? m.defaultGround];
        for (const d of RINGS) {
          const [x, z] = sidePt(s, t, d);
          const fade = d >= 0 ? 1 : Math.max(0, 1 + d / 12);
          pos.push(x, h0 * fade - 0.03 + (d < 0 ? d * 0.004 : 0), z);
          const k = (0.82 + 0.3 * (0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2))) * (d >= 0 ? 1 : Math.max(0.55, 1 + d / 60));
          col.push(tint[0] * k, tint[1] * k, tint[2] * k);
          uv.push(x / 5, z / 5);
          splat.push(...sp);
        }
      }
      const R = RINGS.length;
      for (let i = 0; i < ts.length - 1; i++) for (let j = 0; j < R - 1; j++) {
        const a = first + i * R + j, b2 = a + R;
        // Sides run clockwise with the map on the left, so this winding faces up.
        idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
      }
    }
    if (!idx.length) continue;
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

// ---------------------------------------------------------------- trees

/** Berlin street and park trees (M11c): Linde, Ahorn, Kastanie, Birke, Kiefer and dead trees. */
type Species = 'linde' | 'ahorn' | 'kastanie' | 'birke' | 'kiefer' | 'dead';

/** Species by place: street pits, forest (pine and birch) or park and garden. */
function pickSpecies(rng: Rng, ground: GroundKind, street: boolean): Species {
  const r = rng.next();
  if (street) return r < 0.5 ? 'linde' : r < 0.74 ? 'ahorn' : r < 0.95 ? 'kastanie' : 'dead';
  if (ground === 'forest') return r < 0.45 ? 'kiefer' : r < 0.65 ? 'birke' : r < 0.8 ? 'ahorn' : r < 0.9 ? 'linde' : 'dead';
  return r < 0.28 ? 'linde' : r < 0.5 ? 'ahorn' : r < 0.68 ? 'kastanie' : r < 0.88 ? 'birke' : r < 0.95 ? 'kiefer' : 'dead';
}

/** Crown shape per species: clump count, ellipsoid radii (x R), clump size (x R), height of the center over the trunk top. */
const CROWN: Record<Exclude<Species, 'dead'>, { n: [number, number]; rx: number; ry: number; size: [number, number]; lift: number; trunk: [number, number] }> = {
  linde: { n: [5, 7], rx: 0.5, ry: 0.8, size: [0.5, 0.62], lift: 0.75, trunk: [3.2, 4.6] },
  ahorn: { n: [5, 7], rx: 0.58, ry: 0.45, size: [0.5, 0.6], lift: 0.55, trunk: [2.8, 4] },
  kastanie: { n: [6, 8], rx: 0.55, ry: 0.5, size: [0.52, 0.64], lift: 0.55, trunk: [2.6, 3.6] },
  birke: { n: [5, 7], rx: 0.36, ry: 0.9, size: [0.26, 0.36], lift: 0.6, trunk: [3.8, 5.2] },
  kiefer: { n: [3, 5], rx: 0.6, ry: 0.22, size: [0.32, 0.45], lift: 0.15, trunk: [6, 8.5] },
};

/** Crown tints (the foliage texture carries the green; these shift it). Style bible: dark greens, olive, a few autumn ochres. */
function crownTint(s: Species, rng: Rng): RGB {
  const g = rng.range(0.85, 1.12);
  const autumn = rng.next() < 0.12;
  if (s === 'kiefer') return [0.5 * g, 0.56 * g, 0.5 * g];
  if (s === 'birke') return autumn ? [1.25 * g, 0.95 * g, 0.4 * g] : [0.88 * g, 0.86 * g, 0.5 * g];
  if (autumn) return rng.next() < 0.5 ? [1.25 * g, 0.7 * g, 0.32 * g] : [1.1 * g, 0.5 * g, 0.3 * g];
  if (s === 'kastanie') return [0.56 * g, 0.6 * g, 0.42 * g];
  if (s === 'ahorn') return [0.78 * g, 0.72 * g, 0.44 * g];
  return [0.68 * g, 0.68 * g, 0.46 * g];
}

/** Open tapered cylinder from `a` to `c` (a branch or trunk piece). 2 x `seg` triangles. */
function limb(b: ChunkBuilder, mat: Material, a: Vector3, c: Vector3, r0: number, r1: number, seg: number, color: RGB): void {
  const d = c.clone().sub(a);
  const len = d.length();
  const k = `${seg}:${r0.toFixed(2)}:${r1.toFixed(2)}`;
  let g = limbGeos.get(k);
  if (!g) limbGeos.set(k, (g = new CylinderGeometry(r1, r0, 1, seg, 1, true)));
  b.geo(mat, g, new Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()), new Vector3(1, len, 1)), color);
}
const limbGeos = new Map<string, BufferGeometry>();

interface TreeBucket {
  crowns: Array<{ m: Matrix4; c: Color }>;
  /** One world box per crown: the hero contour tests these (playtest 2026-11-18: trees hide her too). */
  boxes: Box3[];
}

/**
 * Berlin trees: trunk and branches merged per chunk (bark), crown clumps instanced per chunk (one
 * lumpy 80-triangle blob, per-instance tint) and leaf cards that break up the outline.
 * About 380-560 triangles per leafy tree (trunk 40-70, 4-8 clumps, 2-3 cards each), 100-150 per dead tree.
 */
function buildTrees(m: MapDef, lots: Lot[], mats: MapMats, chunkKey: (x: number, z: number) => string, chunkOf: (x: number, z: number) => ChunkBuilder, group: Group): void {
  const buckets = new Map<string, TreeBucket>();
  for (const l of lots) {
    if (l.kind !== 'tree' || l.jungle) continue;
    const k = chunkKey(l.x, l.z);
    let bk = buckets.get(k);
    if (!bk) buckets.set(k, (bk = { crowns: [], boxes: [] }));
    const rng = new Rng(l.seed);
    const ground = areaAt(m, l.x, l.z)?.ground ?? m.defaultGround;
    const sp = pickSpecies(rng, ground, streetDist(m, l.x, l.z).d < 5);
    const b = chunkOf(l.x, l.z);
    const pm = plantMats(mats);
    const base = surfaceAt(m, l.x, l.z);
    const R = l.w / 2;
    const shape = sp === 'dead' ? CROWN.linde : CROWN[sp];
    const h = rng.range(shape.trunk[0], shape.trunk[1]) * (0.85 + R * 0.06);
    const lean = rng.range(-0.1, 0.1);
    const lyaw = rng.range(0, Math.PI * 2);
    const top = new Vector3(l.x + Math.sin(lyaw) * lean * h, base + h, l.z + Math.cos(lyaw) * lean * h);
    const foot = new Vector3(l.x, base - 0.1, l.z);
    const thick = sp === 'birke' ? 0.13 : sp === 'kiefer' ? 0.2 : sp === 'kastanie' ? 0.3 : 0.24;
    const barkTint: RGB = sp === 'birke' ? [1.75, 1.72, 1.65] : sp === 'kiefer' ? [1.05, 0.72, 0.55] : sp === 'dead' ? [0.85, 0.82, 0.8] : [0.62, 0.56, 0.52];
    // Trunk in two pieces with a slight kink.
    const mid = foot.clone().lerp(top, 0.5).add(new Vector3(rng.range(-0.15, 0.15), 0, rng.range(-0.15, 0.15)));
    limb(b, pm.bark, foot, mid, thick * 1.25, thick * 0.9, 6, barkTint);
    limb(b, pm.bark, mid, top, thick * 0.9, thick * 0.55, 6, barkTint);
    // Branches fork from the upper trunk into the crown (bare for dead trees).
    const nb = sp === 'dead' ? 5 + rng.int(3) : sp === 'kiefer' ? 2 : 3 + rng.int(2);
    const cy = top.y + R * shape.lift;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const from = foot.clone().lerp(top, rng.range(0.6, 0.95));
      const reach = R * rng.range(0.45, 0.8) * (sp === 'birke' ? 0.6 : 1);
      const to = new Vector3(from.x + Math.sin(a) * reach, from.y + rng.range(0.6, 1.4) * (sp === 'dead' ? 1.6 : 1.1) + (sp === 'birke' ? 1 : 0), from.z + Math.cos(a) * reach);
      limb(b, pm.bark, from, to, thick * 0.5, thick * 0.18, 4, barkTint);
      if (sp === 'dead') {
        // Twigs at the branch ends.
        for (let t = 0; t < 2; t++) {
          const tw = to.clone().add(new Vector3(Math.sin(a + rng.range(-1, 1)) * R * 0.3, rng.range(0.3, 0.9), Math.cos(a + rng.range(-1, 1)) * R * 0.3));
          limb(b, pm.bark, to, tw, thick * 0.16, 0.02, 3, barkTint);
        }
      }
    }
    if (sp === 'dead') continue;
    // Crown: clumps on an ellipsoid around the crown center, the biggest on top.
    const n = shape.n[0] + rng.int(shape.n[1] - shape.n[0] + 1);
    const tintC = crownTint(sp, rng);
    const crownBox = new Box3();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.5, 0.5);
      const first = i === 0;
      const el = first ? 1.2 : rng.range(-0.5, 0.9);
      const rr = first ? 0.25 : rng.range(0.7, 1.05);
      const x = top.x + Math.sin(a) * Math.cos(el) * R * shape.rx * rr;
      const z = top.z + Math.cos(a) * Math.cos(el) * R * shape.rx * rr;
      const y = cy + Math.sin(el) * R * shape.ry * rr;
      const s = R * rng.range(shape.size[0], shape.size[1]) * (first ? 1.15 : 1);
      const flat = sp === 'kiefer' ? 0.45 : sp === 'birke' ? 1.25 : rng.range(0.8, 0.95);
      const mt = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rng.range(-0.3, 0.3), rng.range(0, 6), rng.range(-0.3, 0.3))), new Vector3(s, s * flat, s));
      const shade = rng.range(0.85, 1.12);
      bk.crowns.push({ m: mt, c: new Color(tintC[0] * shade, tintC[1] * shade, tintC[2] * shade) });
      // The lumpy blob reaches 1.24 x its scale.
      crownBox.union(new Box3().setFromCenterAndSize(new Vector3(x, y, z), new Vector3(s, s * flat, s).multiplyScalar(2.5)));
      fringe(b, IDENT, x, y, z, s, sp === 'kiefer' ? 1 : 2 + rng.int(2), tintC, rng);
    }
    // Birch: drooping leaf curtains under the clumps.
    if (sp === 'birke') for (let i = 0; i < 3; i++) fringe(b, IDENT, top.x, cy - R * 0.4, top.z, R * 0.45, 1, tintC, rng);
    bk.boxes.push(crownBox);
  }
  const crownGeo = blobGeo(1);
  for (const bk of buckets.values()) {
    if (bk.crowns.length === 0) continue;
    const im = new InstancedMesh(crownGeo, plantMats(mats).foliage, bk.crowns.length);
    bk.crowns.forEach((t, i) => {
      im.setMatrixAt(i, t.m);
      im.setColorAt(i, t.c);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    // Crowns are contour occluders (hero and enemies behind a tree); their depth renders only when a box covers a character.
    im.layers.enable(OCCLUDER_LAYER);
    im.userData.boxes = bk.boxes;
    group.add(im);
  }
}
const IDENT = new Matrix4();
const VINE = new PlaneGeometry(1, 1).translate(0, 0.5, 0);

/**
 * Spreepark jungle (Urzeit, M11c): curved palms, tree ferns and giant broadleaf trees with buttress
 * roots, layered crowns and hanging vines, each with undergrowth at its foot. Merged per chunk.
 * Palm about 70, tree fern about 60, giant about 330 triangles, plus 20-40 for the undergrowth.
 */
function buildPalm(b: ChunkBuilder, l: Lot): void {
  const rng = new Rng(l.seed);
  const pm = plantMats(b.mats);
  const leaf = pm.leaf;
  const kind = rng.next();
  const lush: RGB = [0.5, 0.72, 0.4];
  const frond = (top: Vector3, n: number, len: [number, number], tilt: [number, number], tint: RGB): void => {
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const s = rng.range(len[0], len[1]);
      const g = rng.range(0.75, 1.1);
      b.cards.of(leaf).add(cardGeo('frond'), mtx(top.x, top.y, top.z, yaw, rng.range(tilt[0], tilt[1]), s * 0.5, s, 1), [tint[0] * g, tint[1] * g, tint[2] * g]);
    }
  };
  if (kind < 0.35) {
    // Palm: a curved, ringed trunk in four pieces, drooping fronds.
    const h = rng.range(5, 8.5);
    const yaw = rng.range(0, Math.PI * 2);
    const bend = rng.range(0.15, 0.5);
    let p0 = new Vector3(l.x, -0.1, l.z);
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 4;
      const p1 = new Vector3(l.x + Math.sin(yaw) * bend * h * t * t, h * t, l.z + Math.cos(yaw) * bend * h * t * t);
      limb(b, pm.bark, p0, p1, 0.3 - i * 0.04, 0.26 - i * 0.04, 6, i % 2 ? [0.95, 0.82, 0.62] : [0.8, 0.68, 0.52]);
      p0 = p1;
    }
    b.geo(pm.foliage, blobGeo(0), mtx(p0.x, p0.y, p0.z, 0, 0, 0.45, 0.35, 0.45), [0.6, 0.75, 0.45]);
    frond(p0, 9 + rng.int(4), [3, 4.5], [1.4, 2.1], [0.55, 0.7, 0.38]);
    frond(p0, 3, [2, 2.8], [0.5, 0.9], [0.62, 0.78, 0.4]);
  } else if (kind < 0.6) {
    // Tree fern: short shaggy trunk, a big rosette of arching fronds.
    const h = rng.range(1.8, 3.4);
    const top = new Vector3(l.x + rng.range(-0.3, 0.3), h, l.z + rng.range(-0.3, 0.3));
    limb(b, pm.bark, new Vector3(l.x, -0.1, l.z), top, 0.32, 0.24, 6, [0.5, 0.42, 0.34]);
    frond(top, 11 + rng.int(4), [2.4, 3.6], [0.7, 1.25], lush);
  } else {
    // Jungle giant: buttress roots, a few heavy limbs, a wide layered crown and hanging vines.
    const h = rng.range(5, 7.5);
    const R = l.w * rng.range(0.6, 0.8);
    const foot = new Vector3(l.x, -0.1, l.z);
    const top = new Vector3(l.x + rng.range(-0.4, 0.4), h, l.z + rng.range(-0.4, 0.4));
    const bark: RGB = [0.55, 0.52, 0.42];
    limb(b, pm.bark, foot, top, 0.55, 0.32, 7, bark);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const len = rng.range(0.9, 1.5);
      b.box(pm.bark, mtx(l.x + Math.sin(a) * len * 0.5, 0.45, l.z + Math.cos(a) * len * 0.5, a, 0, 1, 1, 1, 0).multiply(new Matrix4().makeRotationX(-0.55)), 0.12, 1.3, len, bark);
    }
    const layers: Array<{ y: number; r: number }> = [{ y: h + R * 0.25, r: R }, { y: h + R * 0.75, r: R * 0.7 }];
    for (const [li, ly] of layers.entries()) {
      const n = li === 0 ? 5 + rng.int(2) : 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
        const x = top.x + Math.sin(a) * ly.r * 0.6;
        const z = top.z + Math.cos(a) * ly.r * 0.6;
        const s = ly.r * rng.range(0.45, 0.6);
        if (li === 0 && i < 3) limb(b, pm.bark, top.clone().setY(h * 0.75), new Vector3(x, ly.y - 0.3, z), 0.2, 0.08, 4, bark);
        const tint: RGB = [0.5 * rng.range(0.85, 1.1), 0.78 * rng.range(0.9, 1.1), 0.42];
        b.geo(pm.foliage, blobGeo(0), mtx(x, ly.y, z, rng.range(0, 6), 0, s, s * 0.5, s), tint);
        fringe(b, IDENT, x, ly.y, z, s, 2, tint, rng);
        fringe(b, IDENT, x, ly.y, z, s, 1, tint, rng, 'bigLeaf');
        // Vines (ivy cards) hanging from the outer clumps.
        if (li === 0 && rng.next() < 0.75) {
          const vx = top.x + Math.sin(a) * ly.r * 0.95;
          const vz = top.z + Math.cos(a) * ly.r * 0.95;
          const drop = rng.range(2.5, ly.y - 1);
          for (let k = 0; k < 3; k++) {
            const seg = drop / 3;
            b.cards.of(b.mats.ivy).add(VINE, mtx(vx, ly.y - seg * (k + 1), vz, a + Math.PI / 2 + rng.range(-0.3, 0.3), 0, rng.range(0.45, 0.7), seg * 1.15, 1), [0.6, 0.8, 0.5]);
          }
        }
      }
    }
  }
  // Undergrowth at the foot: big leaves and ferns.
  for (let i = 0; i < 2 + rng.int(2); i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.7, 2.2);
    buildUndergrowth(b, { kind: 'bush', x: l.x + Math.sin(a) * r, z: l.z + Math.cos(a) * r, rot: rng.range(0, 6), size: rng.range(0.7, 1.1) }, rng);
  }
}

// ---------------------------------------------------------------- landmarks

export function lm(l: Landmark, x = 0, y = 0, z = 0, ry = 0): Matrix4 {
  return new Matrix4().makeRotationY(l.rot + ry).setPosition(l.x, 0, l.z).multiply(new Matrix4().setPosition(x, y, z));
}

/** Local point of a landmark frame (x right of the front, z toward the front). */
export function lp(l: Landmark, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyMatrix4(new Matrix4().makeRotationY(l.rot).setPosition(l.x, 0, l.z));
}

export function steppedGable(b: ChunkBuilder, l: Landmark, x: number, y: number, z: number, w: number, ry = 0): void {
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

// ---------------------------------------------------------------- assembly

export function buildMapWorld(materials: Materials, m: MapDef, lots: Lot[], props: Prop[], breakables: BreakableDef[] = [], opts: { boxShadows?: boolean; cut?: 'off' | number; sky?: Sky } = {}): World {
  const sky = opts.sky ?? NIGHT_SKY;
  glowScale = sky.lamps;
  wet = sky.wet;
  const mats = makeMapMats(materials);
  // Wet streets mirror the sky environment and the lamps.
  if (wet) for (const k of [mats.ground, mats.asphalt, mats.path, mats.tar, mats.litter]) k.roughness *= wet.gloss;
  if (m.id === 'alex') {
    mats.alex = emissive(materials, paintAlexAtlas(), 0xffe0a0, 0.8);
    const posters = materials.surface({ map: paintPosterFallback(), alphaTest: 0.5, doubleSided: true, roughness: 0.85 });
    mats.posters = posters;
    loadPosters(materials.profile.anisotropy, (t) => { posters.map = t; posters.needsUpdate = true; });
  }
  if (m.id === 'mitte') mats.mitte = mitteMats(materials);
  // V1 B cutaway: flagged lots and landmarks, cut while the hero is in one of their zones (`follow`).
  const plan = cutPlan(m, lots, { off: opts.cut === 'off', yard: typeof opts.cut === 'number' ? opts.cut : undefined });
  const cutaway = new Cutaway(plan.zones);
  /** Cut lots with their world cut height: later facade dressing (Xhain graffiti, banners) joins the same part. */
  const lotCutAt = new Map<Lot, { id: number; y: number }>();
  const lotCut = new Map<number, CutPart>(), landmarkCut = new Map<Landmark, CutPart>();
  for (const p of plan.parts) {
    if (p.kind === 'lot') lotCut.set(p.index, p);
    else landmarkCut.set(m.landmarks[p.index]!, p);
  }
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
  buildBoats(m, mats, chunkOf);
  buildScatter(m, lots, mats, chunkOf);
  buildGreenery(m, lots, props, chunkOf);
  const boats: Array<{ lane: FerryLane; group: Group }> = [];
  buildBridges(m, chunkOf, boats);
  for (const bt of boats) group.add(bt.group);
  // Buildings stand on the lowest corner of their footprint; the rest sinks into the slope.
  const base = (x: number, z: number, r: number): number =>
    Math.min(surfaceAt(m, x, z), surfaceAt(m, x - r, z - r), surfaceAt(m, x + r, z - r), surfaceAt(m, x - r, z + r), surfaceAt(m, x + r, z + r));
  lots.forEach((l, li) => {
    const b = chunkOf(l.x, l.z);
    // M11c lot types: only their ground cover; their buildings, trees and props come as ordinary lots and props.
    if (l.kind === 'special') { buildLotGround(l, b.solid, { ...mats, cobbles: b.mats.cobbles }, (x, z) => surfaceAt(m, x, z)); return; }
    const y0 = base(l.x, l.z, Math.max(l.w, l.d) / 2);
    const build = (): void => {
      if (l.ruin && l.kind !== 'tree') b.on(y0, () => buildRuin(b, l));
      // M15 Alexanderplatz: intact Plattenbau gets its panel facade; ruins keep the shared burnt-out shell.
      else if (l.kind === 'platte' && m.id === 'alex' && !l.ruin) b.on(y0, () => buildAlexPlatte(b, l, (f, seed) => loggias(b, f, seed)));
      // M15 Mitte step 7: the Potsdamer Platz builds in glass (same footprint and height as the Altbau).
      else if (mats.mitte && !l.shape && (l.kind === 'altbau' || l.kind === 'shop') && areaAt(m, l.x, l.z)?.id === 'potsdamer') b.on(y0, () => buildGlassLot(b, l));
      // M15 Mitte step 7 (facade F-A): the Regierungsviertel builds worn sandstone ministries.
      else if (mats.mitte && !l.shape && (l.kind === 'altbau' || l.kind === 'shop') && areaAt(m, l.x, l.z)?.id === 'regierung') b.on(y0, () => buildMinistryLot(b, l));
      else if (l.kind === 'altbau' || l.kind === 'platte' || l.kind === 'shop') b.on(y0, () => buildAltbauLot(b, l, m));
      else if (l.kind === 'house') b.on(y0, () => buildHouse(b, l));
      else if (l.kind === 'tree' && l.jungle) b.solid.captureOccluder(() => b.on(surfaceAt(m, l.x, l.z), () => buildPalm(b, l)));
      if (l.wing) {
        // Back wing of the L: one floor lower (Seitenflügel) or a single-storey annex.
        const wing = { ...l, ...l.wing, wing: undefined, shape: undefined, floors: Math.max(0, l.floors - 1), seed: l.seed + 1, inner: true };
        if (l.ruin) b.on(y0, () => buildRuin(b, wing));
        else if (l.kind === 'house') b.on(y0, () => buildHouse(b, wing));
        else b.on(y0, () => buildAltbauLot(b, wing, m));
      }
    };
    const cut = lotCut.get(li);
    if (l.kind === 'tree') build();
    else if (cut) {
      lotCutAt.set(l, { id: cut.id, y: y0 + cut.h });
      b.solid.captureOccluder(() => b.cut(cut.id, y0 + cut.h, build, lotCaps(l)));
    }
    else b.solid.captureOccluder(build);
  });
  // Späti: roof and upper walls in their own group, hidden while the hero is inside (`follow`).
  const spatis: Array<{ rest: RestArea; upper: Group }> = [];
  // M15: the Weltzeituhr stands as its own object (`clock.ts`): the final boss wakes up out of it.
  let clock: Group | undefined;
  for (const l of m.landmarks) {
    const b = chunkOf(l.x, l.z);
    const y0 = base(l.x, l.z, Math.max(l.hx, l.hz));
    if (l.kind === 'weltzeituhr') {
      const rig = makeClockRig(mats);
      rig.group.position.set(l.x, y0, l.z);
      rig.group.rotation.y = l.rot;
      group.add(rig.group);
      clock = rig.group;
    }
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
    // Xhain landmarks are built and cut in `buildXhainWorld`.
    const cut = XHAIN_KINDS.has(l.kind) ? undefined : landmarkCut.get(l);
    // M15 Alexanderplatz and Mitte landmarks live in `alex-world.ts` and `mitte-world.ts`.
    const build = (): void => b.on(y0, () => (ALEX_KINDS.has(l.kind) ? buildAlexLandmark(b, l) : MITTE_KINDS.has(l.kind) ? buildMitteLandmark(b, l) : buildLandmark(b, l)));
    b.solid.captureOccluder(cut ? () => b.cut(cut.id, y0 + cut.h, build, [rectPoly({ x: l.x, z: l.z, rot: l.rot, hw: l.hx, hd: l.hz })]) : build);
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
    // Props on an M15 bridge deck stand on the deck itself (the terrain grid blends near its edges).
    const onDeck = m.terraces.some((t) => t.bridge && inPoly(t.poly, p.x, p.z));
    const build = (): void => b.on(onDeck ? heightAt(m, p.x, p.z) : surfaceAt(m, p.x, p.z), () => buildProp(b, p, rng));
    if (isOccluderProp(p.kind)) b.solid.captureOccluder(build);
    else build();
  });
  const breakableView = breakables.length > 0 ? buildBreakables(mats, m, props, breakables, group) : undefined;
  buildTerraces(m, chunkOf);
  // M15 Xhain: the Wall, the viaducts and the Xhain landmarks (`xhain-world.ts`).
  buildXhainWorld(materials, m, lots, mats, chunkOf, (x, z) => surfaceAt(m, x, z), (l) => landmarkCut.get(l), (l) => lotCutAt.get(l));
  // M15 Alexanderplatz: the brick Stadtbahn with open arches (Xhain draws only its U1 Hochbahn).
  if (m.id === 'alex') {
    for (const v of m.viaducts ?? []) if (v.kind === 'stadtbahn') buildStadtbahn(chunkOf, mats, v);
    buildArches(chunkOf, mats, m);
    dressAlexLots(chunkOf, lots, (x, z) => surfaceAt(m, x, z), (l) => lotCutAt.get(l));
    dressAlexEdge(chunkOf, props, (x, z) => surfaceAt(m, x, z));
    buildStrausberger(chunkOf, m);
  }
  // M15 Mitte: neon street dressing (`mitte-world.ts`).
  if (mats.mitte) buildMitteWorld(m, lots, props, mats.mitte, mats, wet, chunkOf, (x, z) => surfaceAt(m, x, z), (l) => lotCutAt.get(l));
  if (m.tunnel) {
    buildTunnel(m, mats, chunkOf);
    buildTunnelExtras(m, mats, materials, chunkOf);
  }
  if (m.camp) buildCampWorld(m, mats, makeCampMats(materials, { flatten: materials.look.flatten, normalMaps: materials.profile.normalMaps, anisotropy: materials.profile.anisotropy }), chunkOf);
  if (m.rail) {
    const r = m.rail;
    // The embankment runs on out of the map (closed edge, M11d step 4).
    for (let x = r.minX - 40; x < r.maxX + 40; x += 40) {
      const cb = chunkOf(x + 20, r.z);
      cb.box(mats.stucco, new Matrix4().setPosition(x + 20, 0.9, r.z), 40, 1.8, 8, [0.45, 0.42, 0.4]);
      for (const z of [-1.5, 1.5]) cb.box(mats.iron, new Matrix4().setPosition(x + 20, 1.9, r.z + z), 40, 0.15, 0.12);
    }
  }
  // M11d step 4: beyond the closed edge, building masses and tree rows (render only) on a ground skirt.
  const edge = m.tunnel || m.camp ? null : edgeRuns(m);
  const backdrop = edge ? edgeBackdrop(m, edge) : { blocks: [], trees: [] };
  if (edge) buildEdgeSkirt(m, mats, edge, group);
  for (const k of backdrop.blocks) {
    const b = chunkOf(k.x, k.z);
    if (k.kind === 'house') b.on(0, () => buildHouse(b, { kind: 'house', x: k.x, z: k.z, rot: k.rot, w: k.w, d: k.d, floors: k.floors, seed: k.seed }));
    else buildBackdropBlock(b, k);
  }
  for (const l of backdrop.trees) if (l.jungle) {
    const b = chunkOf(l.x, l.z);
    b.solid.captureOccluder(() => b.on(surfaceAt(m, l.x, l.z), () => buildPalm(b, l)));
  }
  buildTrees(m, [...lots, ...backdrop.trees], mats, chunkKey, chunkOf, group);

  const spots: LightSpot[] = [];
  const caster = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const fires: Vector3[] = [];
  for (const b of chunks.values()) {
    const occluder = b.solid.occluderMesh();
    if (occluder) { group.add(occluder); cutaway.add(occluder); }
    for (const mesh of b.solid.meshes()) {
      // `?shadows=boxes` (A/B test): only caster boxes, instanced things and characters cast.
      mesh.castShadow = !opts.boxShadows;
      mesh.receiveShadow = true;
      group.add(mesh);
      cutaway.add(mesh);
    }
    for (const mesh of b.cards.meshes()) {
      mesh.layers.set(FX_LAYER);
      mesh.receiveShadow = true;
      group.add(mesh);
      cutaway.add(mesh);
    }
    for (const mesh of b.glows.meshes()) {
      mesh.layers.set(FX_LAYER);
      mesh.renderOrder = 1;
      group.add(mesh);
      cutaway.add(mesh);
    }
    // Shadow casters merged per chunk; those of a cut part are clipped with it (one range per part).
    if (b.shadowBoxes.length) {
      const set = new BatchSet();
      const cut = new Map<number, { y: number; boxes: Matrix4[] }>();
      for (const s of b.shadowBoxes) {
        if (!s.cut) { set.of(caster).add(UNIT_BOX, s.m); continue; }
        const g = cut.get(s.cut.part) ?? { y: s.cut.y, boxes: [] };
        g.boxes.push(s.m);
        cut.set(s.cut.part, g);
      }
      for (const [part, g] of cut) set.cut(part, g.y, () => { for (const bm of g.boxes) set.of(caster).add(UNIT_BOX, bm); });
      for (const mesh of set.meshes()) {
        mesh.castShadow = true;
        mesh.layers.set(FX_LAYER);
        group.add(mesh);
        cutaway.add(mesh);
      }
    }
    for (const o of b.extras) group.add(o);
    spots.push(...b.spots);
    fires.push(...b.fires);
  }

  // --- light: moon follows the hero; a fixed pool of point lights takes the nearest lamps.
  // Daylight maps: the same light is the sun (`Sky.sun`), from another direction.
  group.add(new HemisphereLight(sky.hemi.sky, sky.hemi.ground, sky.hemi.intensity));
  const moon = new DirectionalLight(sky.sun.color, sky.sun.intensity);
  const MOON = new Vector3(...sky.sun.from);
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

  // M20: gratings, hold ring and the end platform's lamps; its ceiling spots join the pool dark.
  const tunnel = m.tunnel ? buildTunnelView(m, mats, materials) : undefined;
  if (tunnel) {
    group.add(tunnel.group);
    spots.push(...tunnel.spots);
  }

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
      .filter((e) => e.d < 45 * 45 && e.s.intensity > 0)
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
    ...(clock ? { clock, clockRig: () => makeClockRig(mats) } : {}),
    breakables: breakableView,
    ...(tunnel ? { tunnel } : {}),
    lights: [],
    fires,
    update(time: number): void {
      mats.water.normalMap?.offset.set(time * 0.012, time * 0.007);
      for (const slot of pool) {
        const s = slot.spot;
        slot.weight = Math.min(1, slot.weight + (s ? 0.05 : -0.08));
        if (!s) {
          slot.light.intensity = 0;
          continue;
        }
        const f = s.flicker > 0 ? 0.5 * Math.sin(time * 11 + s.phase) + 0.3 * Math.sin(time * 23.7 + s.phase * 2) + 0.2 * Math.sin(time * 47.3 + s.phase * 3) : 0;
        slot.light.intensity = s.intensity * sky.lamps * slot.weight * (1 + f * 0.22 * s.flicker);
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
    follow(x: number, z: number, shadow: boolean): void {
      hx = x;
      hz = z;
      for (const s of spatis) s.upper.visible = restAt([s.rest], x, z) < 0;
      cutaway.update(x, z);
      // The light moves only with a fresh shadow map, or static shadows would swim between renders.
      if (!shadow) return;
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
