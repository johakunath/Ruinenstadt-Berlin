// W10: Pixal3D outfits on the hero (Johannes 2026-11-26: make the best use of the local 3D model). An armor with
// `ai` in `WEAR` has a skinned outfit (`assets/gear/outfit-<id>.glb`, built by tools/blender/hero_outfit.py on the
// hero skeleton): torso, arms and legs down to the boot line; head, hands and footwear stay the hero's and the
// other slots'. It loads on first wear (about 0.3 MB each); until it is in, the code look of the same armor shows.
import { BufferAttribute, BufferGeometry, SRGBColorSpace, type Material, type SkinnedMesh, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { placeholder } from './gear-ai';
import type { Materials } from './materials';

/** Roughness and metalness per outfit (uniforms only: every outfit shares one shader). */
const SURFACE: Readonly<Record<string, readonly [number, number]>> = {
  ritter: [0.45, 0.55],
  panzer: [0.5, 0.45],
  'kette-zit': [0.6, 0.3],
  leder: [0.55, 0.05],
};

/** Lowest point of every AI outfit (m): `tools/blender/hero_outfit.py --boot`. Footwear ending lower leaves the shins bare. */
export const OUTFIT_CUT = 0.3;

/** Outfits whose picture has its own scarf: the hero's scarf hides under them (the red coat scarf stays on the others, Johannes 2026-11-19). */
export const OWN_SCARF: ReadonlySet<string> = new Set(['spaeti', 'rattenmantel']);

const urls = import.meta.glob('../../assets/gear/outfit-*.glb', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

interface Source { geo: BufferGeometry; joints: string[]; map: Texture }
const sources = new Map<string, Source>();
const pending = new Map<string, Promise<void>>();
/** `?aigear=0`: the code looks instead (A/B and before/after sheets). */
const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get('aigear') === '0';

/** Outfits whose file failed to load: their code look is final (no reload attempt every frame). */
const failed = new Set<string>();

/** Whether an outfit file exists for `id` and has not failed (else the code look is final). */
export function hasAiOutfit(id: string): boolean {
  return !off && !failed.has(id) && !!urls[`../../assets/gear/outfit-${id}.glb`];
}

/** Starts loading `id` once; resolves when it is in (or failed: then the code look stays). */
export function loadAiOutfit(id: string, anisotropy: number): Promise<void> {
  let p = pending.get(id);
  if (p) return p;
  const url = urls[`../../assets/gear/outfit-${id}.glb`];
  p = (async () => {
    if (!url || off) return;
    try {
      const gltf = await new GLTFLoader().loadAsync(await url());
      let found: SkinnedMesh | undefined;
      gltf.scene.traverse((o) => { if (!found && (o as SkinnedMesh).isSkinnedMesh) found = o as SkinnedMesh; });
      const map = (found?.material as { map?: Texture | null } | undefined)?.map;
      if (!found || !map) return;
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = anisotropy;
      sources.set(id, { geo: found.geometry, joints: found.skeleton.bones.map((b) => b.name), map });
    } catch {
      // The code look stays.
    } finally {
      if (!sources.has(id)) failed.add(id);
    }
  })();
  pending.set(id, p);
  return p;
}

const remapped = new Map<string, BufferGeometry>();

/** The outfit geometry with its skin indices remapped onto `bones` (the hero skeleton's order), or undefined. */
export function aiOutfitGeometry(id: string, bones: readonly string[]): BufferGeometry | undefined {
  const s = sources.get(id);
  if (!s) return undefined;
  const key = `${id}|${bones.length}|${bones[0] ?? ''}|${bones[bones.length - 1] ?? ''}`;
  let g = remapped.get(key);
  if (g) return g;
  g = s.geo.clone();
  const si = g.attributes.skinIndex!;
  const map = s.joints.map((n) => Math.max(0, bones.indexOf(n)));
  const out = new Uint16Array(si.count * 4);
  for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) out[i * 4 + c] = map[si.getComponent(i, c)] ?? 0;
  g.setAttribute('skinIndex', new BufferAttribute(out, 4));
  remapped.set(key, g);
  return g;
}

const mats = new WeakMap<Materials, Map<string, Material>>();

/** One material per outfit (same shader for all). */
export function aiOutfitMaterial(materials: Materials, id: string): Material {
  let byId = mats.get(materials);
  if (!byId) mats.set(materials, (byId = new Map()));
  let m = byId.get(id);
  if (!m) {
    const [roughness, metalness] = SURFACE[id] ?? [0.8, 0];
    // Double-sided like the AI hats (skirts and cuffs are open shells): the same shader as every AI piece.
    byId.set(id, (m = materials.surface({ map: sources.get(id)?.map ?? placeholder, roughness, metalness, doubleSided: true })));
  }
  return m;
}
