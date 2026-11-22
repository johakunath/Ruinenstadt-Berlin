// Static props made with the local AI pipeline (docs/local-ai-assets.md W4 to W6, trial LA2): one small GLB
// each (≤ 2,000 triangles, one 512 px baked texture), drawn as one InstancedMesh per kind, so every copy of a
// kind costs one draw call. Landmark builders record placements in `MapMats.glbProps`; `buildGlbProps` makes
// the mesh and its material at build time (so the shader compiles with the rest) and fills in the geometry
// and texture when the file has loaded. The file loads while the characters load, before the first frame.
import { BufferAttribute, BufferGeometry, InstancedMesh, type Group, type Matrix4, type Mesh, type MeshStandardMaterial, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Materials } from './materials';

/** File and tint per kind; the tint multiplies the baked texture through the vertex colours (linear RGB, as the
 * tints of the code-built world), so a prop fits the light and palette of its map. */
const PROPS = {
  /** Weathered sandstone garden urn on its pedestal, 1.6 m high, origin at the bottom centre (Schlossgarten). */
  urn: { url: new URL('../../assets/props/urn.glb', import.meta.url).href, tint: [0.72, 0.62, 0.48] },
} as const;

export type GlbPropKind = keyof typeof PROPS;
export interface GlbPlacement { kind: GlbPropKind; m: Matrix4 }

/** One instanced mesh per kind in `placements`; `placeholder` is any loaded surface map (kept, never disposed). */
export function buildGlbProps(materials: Materials, placements: readonly GlbPlacement[], parent: Group, placeholder: Texture | null): void {
  for (const kind of new Set(placements.map((p) => p.kind))) {
    const list = placements.filter((p) => p.kind === kind);
    const material = materials.surface({ map: placeholder ?? undefined, roughness: 0.9, vertexColors: true });
    const mesh = new InstancedMesh(new BufferGeometry(), material, list.length);
    list.forEach((p, i) => mesh.setMatrixAt(i, p.m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    parent.add(mesh);
    new GLTFLoader().loadAsync(PROPS[kind].url).then((gltf) => {
      let src: Mesh | undefined;
      gltf.scene.traverse((o) => { if (!src && (o as Mesh).isMesh) src = o as Mesh; });
      if (!src) return;
      src.updateWorldMatrix(true, false);
      const geo = src.geometry.clone().applyMatrix4(src.matrixWorld);
      const n = geo.getAttribute('position').count, tint = PROPS[kind].tint, colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set(tint, i * 3);
      geo.setAttribute('color', new BufferAttribute(colors, 3));
      mesh.geometry.dispose();
      mesh.geometry = geo;
      const map = (src.material as MeshStandardMaterial).map;
      if (map) {
        map.anisotropy = materials.profile.anisotropy;
        material.map = map;
        material.needsUpdate = !placeholder;
      }
      mesh.computeBoundingSphere();
      mesh.visible = true;
    }).catch((e: unknown) => console.warn(`GLB prop ${kind} did not load`, e));
  }
}
