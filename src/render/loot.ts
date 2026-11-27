// Ground loot visuals. M4 (variant B of the drop mockups): a soft ground glow and ring in the rarity colour, and a
// light beam for rare and better. WP4 step 3 (P10, D4): one model per drop kind (`src/data/pickups.ts`) from
// `assets/props/pickups.glb`, one InstancedMesh per kind (drawn only while one lies on the ground), all sharing one
// vertex-colour material with one atlas texture. No shadows, no light sources (the light count must stay constant).
// Gate G2 (Johannes, 2026-11-27: variant A): natural colours with a slight emissive in the rarity colour, on the ring
// and beam. The old crystal only stands in for a model that is not loaded.
// Draw calls: 1 per kind lying on the ground + glow + beam.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DataTexture, DoubleSide, Float32BufferAttribute, Group,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, SphereGeometry, Vector3,
  type Mesh, type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PICKUP_MODELS, pickupModel, type PickupModelId } from '../data/pickups';
import { dropColor } from '../sim/loot';
import type { Sim } from '../sim/types';
import { groundY } from './ground';
import { FX_LAYER } from './world';

const CAP = 160;
const PICKUPS_URL = new URL('../../assets/props/pickups.glb', import.meta.url).href;

/** Model height above the ground (m), and how strongly the rarity colour lights it. */
const LIFT = 0.1;
const EMIT = 0.32;
/** Rarity colour strength on the model (instance colour): common items glow least. */
const GLOW_BY_RARITY = [0.35, 0.8, 0.9, 1.1] as const;

/** Geometry per model, loaded once and shared (the game and the dev sheets). */
interface PickupAssets { geo: Map<PickupModelId, BufferGeometry>; map: Texture | null }
let load: Promise<PickupAssets> | null = null;
export function loadPickups(): Promise<PickupAssets> {
  load ??= new GLTFLoader().loadAsync(PICKUPS_URL).then((gltf) => {
    const geo = new Map<PickupModelId, BufferGeometry>();
    let map: Texture | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || !(PICKUP_MODELS as readonly string[]).includes(m.name)) return;
      geo.set(m.name as PickupModelId, m.geometry.clone().applyMatrix4(m.matrixWorld));
      map ??= (m.material as MeshStandardMaterial).map;
    });
    return { geo, map };
  }).catch((e: unknown) => {
    console.warn('Pickup models did not load', e);
    return { geo: new Map(), map: null };
  });
  return load;
}

/** Soft disc with a thin ring near the edge. */
function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 64, 41, 0, Math.PI * 2);
  g.stroke();
  return new CanvasTexture(c);
}

/** Vertical fade for the beam: bright at the foot, gone at the top, soft at the sides. */
function beamTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(1, 'rgba(255,255,255,0.85)');
  g.fillStyle = v;
  g.fillRect(0, 0, 32, 128);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 32, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 32, 128);
  return new CanvasTexture(c);
}

/** Two crossed quads, 1 m tall, foot at y = 0. */
function beamGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const w = 0.22;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let q = 0; q < 2; q++) {
    const a = q * (Math.PI / 2);
    const dx = Math.cos(a) * w;
    const dz = Math.sin(a) * w;
    const b = pos.length / 3;
    pos.push(-dx, 0, -dz, dx, 0, dz, dx, 1, dz, -dx, 1, -dz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * The shared pickup material: atlas × vertex colour. The instance colour is the rarity colour; it no longer tints the
 * surface (as InstancedMesh would) but lights it a little.
 */
function pickupMaterial(): MeshStandardMaterial {
  // A white 1 × 1 map until the atlas arrives, so the shader is compiled with its map from the start.
  const blank = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.colorSpace = SRGBColorSpace;
  blank.needsUpdate = true;
  // Double-sided: the reused wear pieces are open shells (the vest's neck and arm holes).
  const mat = new MeshStandardMaterial({ map: blank, vertexColors: true, roughness: 0.72, metalness: 0, side: DoubleSide });
  mat.onBeforeCompile = (s): void => {
    s.vertexShader = s.vertexShader
      .replace('#include <color_pars_vertex>', '#include <color_pars_vertex>\nvarying vec3 vRarity;')
      .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  vColor.rgb = color;
  vRarity = instanceColor.rgb;
#else
  vRarity = vec3(0.0);
#endif`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <color_pars_fragment>', '#include <color_pars_fragment>\nvarying vec3 vRarity;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += vRarity * ${EMIT.toFixed(3)};`);
  };
  mat.customProgramCacheKey = (): string => 'pickup';
  return mat;
}

export class LootView {
  readonly group = new Group();
  /** Resolves once the models are in (or failed to load: then the crystals stand in). */
  readonly ready: Promise<void>;
  private readonly models = new Map<PickupModelId, InstancedMesh>();
  private readonly counts = new Map<PickupModelId, number>();
  /** Models whose geometry is in; a drop of any other kind shows the crystal (file missing or still loading). */
  private readonly has = new Set<PickupModelId>();
  private readonly material: MeshStandardMaterial;
  private readonly crystals: InstancedMesh;
  private readonly glows: InstancedMesh;
  private readonly beams: InstancedMesh;
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly pos = new Vector3();
  private readonly scale = new Vector3();
  private readonly axisY = new Vector3(0, 1, 0);
  private readonly color = new Color();
  private readonly base = new Color();

  constructor() {
    // 6-sided double pyramid: a sphere with six segments and one ring.
    const geo = new SphereGeometry(0.2, 6, 2);
    geo.scale(1, 1.55, 1);
    const mat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0, flatShading: true });
    // The emissive part takes the instance color, so the crystal itself glows in its rarity color.
    mat.onBeforeCompile = (s): void => {
      s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;');
    };
    this.crystals = new InstancedMesh(geo, mat, CAP);
    this.crystals.frustumCulled = false;
    this.crystals.castShadow = false;

    const flat = new PlaneGeometry(1, 1);
    flat.rotateX(-Math.PI / 2);
    const glowMat = new MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.9 });
    this.glows = new InstancedMesh(flat, glowMat, CAP);
    this.glows.frustumCulled = false;
    this.glows.layers.set(FX_LAYER);
    this.glows.renderOrder = 3;

    const beamMat = new MeshBasicMaterial({ map: beamTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.beams = new InstancedMesh(beamGeometry(), beamMat, CAP);
    this.beams.frustumCulled = false;
    this.beams.layers.set(FX_LAYER);
    this.beams.renderOrder = 3;

    for (const m of [this.crystals, this.glows, this.beams]) {
      m.count = 0;
      m.setColorAt(0, this.color.set('#ffffff'));
      this.group.add(m);
    }

    // One instanced mesh per model, all on one material. Until the file is in: a degenerate triangle with the real
    // attribute set; the meshes stay visible until the first update so the renderer's compile builds the shader.
    this.material = pickupMaterial();
    for (const id of PICKUP_MODELS) {
      const stub = new BufferGeometry();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]] as const) stub.setAttribute(name, new BufferAttribute(new Float32Array(3 * size), size));
      const mesh = new InstancedMesh(stub, this.material, CAP);
      mesh.name = `pickup-${id}`;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.count = 0;
      mesh.setColorAt(0, this.color.set('#ffffff'));
      this.models.set(id, mesh);
      this.counts.set(id, 0);
      this.group.add(mesh);
    }
    this.ready = loadPickups().then(({ geo, map }) => {
      for (const [id, g] of geo) {
        const mesh = this.models.get(id)!;
        mesh.geometry.dispose();
        mesh.geometry = g;
        this.has.add(id);
      }
      if (map) this.material.map = map;
    });
  }

  /** Triangles per model (the dev sheet). */
  async triangles(): Promise<Partial<Record<PickupModelId, number>>> {
    await this.ready;
    const out: Partial<Record<PickupModelId, number>> = {};
    for (const [id, m] of this.models) out[id] = (m.geometry.index?.count ?? m.geometry.attributes.position!.count) / 3;
    return out;
  }

  /** `still`: no spin and no bob (the dev sheet). */
  update(sim: Sim, time: number, still = false): void {
    for (const id of PICKUP_MODELS) this.counts.set(id, 0);
    let n = 0;
    let crystals = 0;
    let beams = 0;
    for (const d of sim.drops) {
      if (n >= CAP) break;
      const c = d.content;
      const id = pickupModel(c);
      // The crystal stands in for a model that is not loaded (file missing or still loading).
      const model = this.has.has(id);
      const rarity = c.kind === 'item' ? c.item.rarity : -1;
      const set = c.kind === 'item' && !!c.item.set;
      const y0 = groundY(d.x, d.z);
      const wave = still ? 0 : Math.sin(time * 2.4 + d.id);
      this.base.set(dropColor(d));

      if (!model) {
        this.q.setFromAxisAngle(this.axisY, still ? 0.6 : time * 1.3 + d.id);
        const small = c.kind === 'item' ? 1 : 0.7;
        // Spin and bob once it lies on the ground; the pop arc raises it while in the air.
        const bob = d.landed ? 0.42 + 0.06 * wave : 0.42;
        this.pos.set(d.x, y0 + bob + d.h, d.z);
        this.scale.setScalar(small);
        this.crystals.setMatrixAt(crystals, this.m4.compose(this.pos, this.q, this.scale));
        this.crystals.setColorAt(crystals, this.color.copy(this.base).multiplyScalar(0.85));
        crystals++;
      } else {
        const mesh = this.models.get(id)!, k = this.counts.get(id)!;
        this.counts.set(id, k + 1);
        // A slow turn and a small float above the ring, so the shape reads from every side.
        const bob = d.landed ? LIFT + 0.035 * wave : LIFT;
        this.q.setFromAxisAngle(this.axisY, still ? 0.6 : time * 0.9 + d.id);
        this.pos.set(d.x, y0 + bob + d.h, d.z);
        this.scale.setScalar(1);
        mesh.setMatrixAt(k, this.m4.compose(this.pos, this.q, this.scale));
        // Instance colour = rarity colour × strength (consumables and materials glow in their own colour, weakly).
        const strength = rarity >= 0 ? GLOW_BY_RARITY[rarity as 0 | 1 | 2 | 3] + (set ? 0.3 : 0) : 0.3;
        mesh.setColorAt(k, this.color.copy(this.base).multiplyScalar(strength));
      }

      // Ground glow and ring: bigger and brighter with rarity; only once it lies still.
      const pulse = 1 + 0.08 * (still ? 0 : Math.sin(time * 4 + d.id));
      const size = (0.9 + 0.35 * Math.max(0, rarity) + (set ? 0.35 : 0)) * pulse * (d.landed ? 1 : 0.6);
      this.pos.set(d.x, y0 + 0.05, d.z);
      this.q.identity();
      this.scale.set(size * 1.4, 1, size * 1.4);
      this.glows.setMatrixAt(n, this.m4.compose(this.pos, this.q, this.scale));
      this.glows.setColorAt(n, this.color.copy(this.base).multiplyScalar(rarity >= 1 || set || c.kind !== 'item' ? 1 : 0.55));

      if ((rarity >= 2 || set) && d.landed) {
        const h = rarity >= 3 ? 6 : 2.6;
        this.pos.set(d.x, y0, d.z);
        this.scale.set(1, h, 1);
        this.beams.setMatrixAt(beams, this.m4.compose(this.pos, this.q, this.scale));
        this.beams.setColorAt(beams, this.color.copy(this.base).multiplyScalar(rarity >= 3 ? 1.5 : 1));
        beams++;
      }
      n++;
    }
    this.crystals.count = crystals;
    this.crystals.visible = this.crystals.count > 0;
    this.glows.count = n;
    this.beams.count = beams;
    for (const m of [this.crystals, this.glows, this.beams]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (const [id, mesh] of this.models) {
      mesh.count = this.counts.get(id)!;
      // D4: a kind costs its draw call only while one lies on the ground.
      mesh.visible = mesh.count > 0;
      if (mesh.count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
