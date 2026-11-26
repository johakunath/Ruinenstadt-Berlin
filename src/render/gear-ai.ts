// Pixal3D hero gear (local AI, docs/local-ai-assets.md W5; Johannes 2026-11-26: make the best use of the local
// 3D model): hats, helmets and masks as their own model with a baked texture, riding rigidly on the `Head` bone
// like the code gear. They load with the characters; a gear id without a loaded model (node tests, a failed
// load) falls back to its code builder. All AI gear goes into one extra gear mesh, whose material carries the
// worn piece's texture (one material per piece, same shader program: switching never compiles).
import { Box3, BufferGeometry, DataTexture, Mesh, SRGBColorSpace, Vector3, type Material, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Materials } from './materials';

/** How a piece sits on the head, in the hero's bind space (metres): width across, lowest point, centre depth. */
export interface AiFit {
  width: number;
  bottom: number;
  z: number;
}

/** Gear ids made with Pixal3D (`assets/gear/<id>.glb`, built by tools/build-ai-gear.mjs) and their fit. */
export const AI_GEAR: Readonly<Record<string, AiFit>> = {
  // Start values from the code hats' bind-space boxes (width, lowest point, centre depth), then tuned on the look sheet.
  'hat-pickel': { width: 0.29, bottom: 1.67, z: -0.02 }, // Pickelhaube des Hauptmanns
  'hat-hard': { width: 0.29, bottom: 1.66, z: -0.005 }, // Bauhelm
  'hat-kiez': { width: 0.29, bottom: 1.66, z: -0.005 }, // Helm der Kiezwache
  'hat-flatcap': { width: 0.27, bottom: 1.665, z: 0.014 }, // Schiebermütze
  'hat-beanie': { width: 0.275, bottom: 1.65, z: -0.015 }, // Wollmütze
  'hat-straw': { width: 0.47, bottom: 1.66, z: -0.008 }, // Strohhut
  'hat-greathelm': { width: 0.27, bottom: 1.5, z: -0.012 }, // Topfhelm der Zitadelle (hides the hair)
  'hat-gasmask': { width: 0.25, bottom: 1.5, z: 0.04 }, // Gasmaske
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
      // Uniform scale to the fit width, centred across, lowest point at `bottom`, centre depth at `z`.
      const box = new Box3().setFromBufferAttribute(geo.attributes.position as never);
      const size = box.getSize(new Vector3()), c = box.getCenter(new Vector3());
      const s = fit.width / size.x;
      geo.translate(-c.x, -box.min.y, -c.z).scale(s, s, s).translate(0, fit.bottom, fit.z);
      (map as Texture).colorSpace = SRGBColorSpace;
      (map as Texture).anisotropy = anisotropy;
      loaded.set(id, { geo, map });
    } catch {
      // Keep the code builder for this id.
    }
  }));
}

const placeholder = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
placeholder.colorSpace = SRGBColorSpace;
placeholder.needsUpdate = true;
const mats = new WeakMap<Materials, Map<string, Material>>();

/** The AI gear mesh's material for `ids` (the first AI piece among them), or the neutral one. */
export function aiGearMaterial(materials: Materials, ids: readonly string[]): Material {
  let byId = mats.get(materials);
  if (!byId) mats.set(materials, (byId = new Map()));
  const id = ids.find((i) => loaded.has(i)) ?? '';
  let m = byId.get(id);
  if (!m) byId.set(id, (m = materials.surface({ map: loaded.get(id)?.map ?? placeholder, roughness: 0.55, metalness: 0.15, doubleSided: true })));
  return m;
}
