// Pixal3D hero gear (local AI, docs/local-ai-assets.md W5; Johannes 2026-11-26: make the best use of the local
// 3D model): hats, helmets and masks as their own model with a baked texture, riding rigidly on the `Head` bone
// like the code gear. They load with the characters; a gear id without a loaded model (node tests, a failed
// load) falls back to its code builder. All AI gear goes into one extra gear mesh, whose material carries the
// worn piece's texture (one material per piece, same shader program: switching never compiles).
import { Box3, BufferGeometry, DataTexture, Mesh, SRGBColorSpace, Vector3, type Material, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Materials } from './materials';

/**
 * The box a piece fills on the head, in the hero's bind space (metres): the code hat's box, which is fitted to the
 * head (`HeadMap` in gear-head.ts). The model is first levelled by its rim (Pixal3D tips a hat seen from slightly
 * above forward by up to 19°), tipped back by `tilt` degrees, then scaled per axis into the box.
 */
export interface AiFit {
  /** Width across (x), height (y) from `bottom`, depth (z) around `z`. */
  box: readonly [number, number, number];
  bottom: number;
  z: number;
  /** Tilt back (degrees) after levelling; default `TILT`: the idle clips tip the head down, so a level brim in the rest pose droops into the face (the code hats are tipped back the same way). */
  tilt?: number;
  /** How it takes the light (uniforms only, so every piece shares one shader): default lacquer. */
  surface?: keyof typeof SURFACES;
}

const TILT = 12;

/** Roughness and metalness per surface kind. */
const SURFACES = { lacquer: [0.5, 0.15], cloth: [0.92, 0], metal: [0.42, 0.6], straw: [0.85, 0] } as const;

/** Gear ids made with Pixal3D (`assets/gear/<id>.glb`, built by tools/build-ai-gear.mjs) and their fit. */
export const AI_GEAR: Readonly<Record<string, AiFit>> = {
  // Boxes from the code hats (Johannes 2026-11-26: the first fit sat too high and tipped into the face).
  'hat-pickel': { box: [0.292, 0.31, 0.372], bottom: 1.625, z: -0.009, surface: 'lacquer' }, // Pickelhaube (code box without the chin chain)
  'hat-hard': { box: [0.282, 0.159, 0.346], bottom: 1.659, z: -0.005 }, // Bauhelm
  'hat-kiez': { box: [0.282, 0.159, 0.346], bottom: 1.659, z: -0.005 }, // Helm der Kiezwache
  'hat-flatcap': { box: [0.258, 0.129, 0.336], bottom: 1.663, z: 0.014, surface: 'cloth' }, // Schiebermütze
  'hat-straw': { box: [0.466, 0.151, 0.508], bottom: 1.659, z: -0.008, surface: 'straw' }, // Strohhut
  // Not AI: the Wollmütze (squashed onto the head the Pixal3D beanie showed holes in the cuff; the code beanie reads better),
  // the Gasmaske (the Pixal3D straps stood up like horns; the code mask is fitted to the face), the Neonbrille and
  // the Stirnlampe (their lenses and lamp glow), the Topfhelm (Pixal3D made only the front shell; retry from a
  // three-quarter view).
};

const urls = import.meta.glob('../../assets/gear/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const urlOf = (id: string): string | undefined => urls[`../../assets/gear/${id}.glb`];

interface Loaded { geo: BufferGeometry; map: Texture }
const loaded = new Map<string, Loaded>();

/** Fitted bind-space geometry of an AI gear id (position, normal, uv), or undefined if none is loaded. */
export function aiGearGeometry(id: string): BufferGeometry | undefined {
  return loaded.get(id)?.geo;
}

/** Loads every AI gear model once (with the characters). A missing or broken file leaves its code builder. */
export async function loadAiGear(anisotropy: number): Promise<void> {
  // `?aigear=0`: the code hats instead (A/B and before/after sheets).
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('aigear') === '0') return;
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(AI_GEAR).map(async ([id, fit]) => {
    const url = urlOf(id);
    if (!url || loaded.has(id)) return;
    try {
      const gltf = await loader.loadAsync(url);
      const parts: BufferGeometry[] = [];
      let map: Texture | null = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        parts.push(g);
        map ??= (m.material as { map?: Texture | null }).map ?? null;
      });
      if (!parts.length || !map) return;
      const geo = parts.length === 1 ? parts[0]! : mergeGeometries(parts)!;
      levelRim(geo, fit.tilt ?? TILT);
      // Per axis into the box: centred across, lowest point at `bottom`, centre depth at `z`.
      const box = new Box3().setFromBufferAttribute(geo.attributes.position as never);
      const size = box.getSize(new Vector3()), c = box.getCenter(new Vector3());
      geo.translate(-c.x, -box.min.y, -c.z).scale(fit.box[0] / size.x, fit.box[1] / size.y, fit.box[2] / size.z).translate(0, fit.bottom, fit.z);
      geo.computeVertexNormals();
      (map as Texture).colorSpace = SRGBColorSpace;
      (map as Texture).anisotropy = anisotropy;
      loaded.set(id, { geo, map });
    } catch {
      // Keep the code builder for this id.
    }
  }));
}

/**
 * Turns a hat about x so its rim is level front to back (front = +z), then `tilt` degrees further back. The rim height
 * at the front and back is a low percentile of the vertices in the front and back quarter of the depth.
 */
export function levelRim(geo: BufferGeometry, tilt: number): number {
  const pos = geo.attributes.position!;
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.count; i++) { z0 = Math.min(z0, pos.getZ(i)); z1 = Math.max(z1, pos.getZ(i)); }
  const low = (f: (z: number) => boolean): number => {
    const ys: number[] = [];
    for (let i = 0; i < pos.count; i++) if (f(pos.getZ(i))) ys.push(pos.getY(i));
    ys.sort((a, b) => a - b);
    return ys[Math.floor(ys.length * 0.2)] ?? 0;
  };
  const d = z1 - z0;
  const front = low((z) => z > z1 - 0.25 * d), back = low((z) => z < z0 + 0.25 * d);
  const pitch = Math.atan2(back - front, 0.75 * d);
  geo.rotateX(-(pitch + (tilt * Math.PI) / 180));
  return (pitch * 180) / Math.PI;
}

/** 1 × 1 white map: keeps USE_MAP on so every AI piece shares one shader. */
export const placeholder = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
placeholder.colorSpace = SRGBColorSpace;
placeholder.needsUpdate = true;
const mats = new WeakMap<Materials, Map<string, Material>>();

/** The AI gear mesh's material for `ids` (the first AI piece among them), or the neutral one. */
export function aiGearMaterial(materials: Materials, ids: readonly string[]): Material {
  let byId = mats.get(materials);
  if (!byId) mats.set(materials, (byId = new Map()));
  const id = ids.find((i) => loaded.has(i)) ?? '';
  let m = byId.get(id);
  if (!m) {
    const [roughness, metalness] = SURFACES[AI_GEAR[id]?.surface ?? 'lacquer'];
    byId.set(id, (m = materials.surface({ map: loaded.get(id)?.map ?? placeholder, roughness, metalness, doubleSided: true })));
  }
  return m;
}
