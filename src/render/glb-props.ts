// Static props made with the local AI pipeline (docs/local-ai-assets.md W4 to W6, trial LA2): one small GLB
// each (≤ 2,000 triangles, one 512 px baked texture), drawn as one InstancedMesh per kind, so every copy of a
// kind costs one draw call. Landmark builders record placements in `MapMats.glbProps`; `buildGlbProps` makes
// the mesh and its material at build time (so the shader compiles with the rest) and fills in the geometry
// and texture when the file has loaded. The file loads while the characters load, before the first frame.
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, type Group, type Matrix4, type Mesh, type MeshStandardMaterial, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Materials } from './materials';

/** File and tint per kind; the tint multiplies the baked texture through the vertex colours (linear RGB, as the
 * tints of the code-built world), so a prop fits the light and palette of its map. */
const PROPS = {
  /** Weathered sandstone garden urn on its pedestal, 1.6 m high, origin at the bottom centre (Schlossgarten). */
  urn: { url: new URL('../../assets/props/urn.glb', import.meta.url).href, tint: [0.72, 0.62, 0.48] },
  /** P17 Spreepark statues, posed as they fell (fibreglass, faded paint), origin at the bottom centre. */
  sauropod: { url: new URL('../../assets/props/dino-sauropod.glb', import.meta.url).href, tint: [0.85, 0.85, 0.85] },
  triceratops: { url: new URL('../../assets/props/dino-triceratops.glb', import.meta.url).href, tint: [0.85, 0.85, 0.85] },
  rex: { url: new URL('../../assets/props/dino-rex.glb', import.meta.url).href, tint: [0.85, 0.85, 0.85] },
  /** P3 small East German car (Trabant-like), a wreck without wheels (the builder adds them), 3.56 m long,
   * origin at the bottom centre of the shell, nose along +Z. Desaturated paint: each copy gets its car tint. */
  trabi: { url: new URL('../../assets/props/car-trabi.glb', import.meta.url).href, tint: [1, 1, 1] },
  /** P3 East German saloon (Wartburg-like), the same make-up as the Trabi: 4.22 m, cut below the sills. */
  wartburg: { url: new URL('../../assets/props/car-wartburg.glb', import.meta.url).href, tint: [1, 1, 1] },
  /** P3 BVG standard bus wreck, faded yellow, 12 × 2.55 m with its own wheels, origin at the bottom centre, nose along +Z. */
  bus: { url: new URL('../../assets/props/bus-bvg.glb', import.meta.url).href, tint: [1, 1, 1] },
  /** P17 Spreepark dinosaur nest: a low mound of branches, straw and moss with big eggs, some cracked, one hatched;
   * 2 m across, origin at the bottom centre (`props-dino.ts`). */
  nest: { url: new URL('../../assets/props/dino-nest.glb', import.meta.url).href, tint: [0.9, 0.9, 0.9] },
} as const;

export type GlbPropKind = keyof typeof PROPS;
/** `tint` (linear RGB) multiplies the kind's tint for this copy only (car paint). */
export interface GlbPlacement { kind: GlbPropKind; m: Matrix4; tint?: readonly [number, number, number] }

/** One instanced mesh per kind in `placements`; `placeholder` is any loaded surface map (kept, never disposed). */
export function buildGlbProps(materials: Materials, placements: readonly GlbPlacement[], parent: Group, placeholder: Texture | null): void {
  for (const kind of new Set(placements.map((p) => p.kind))) {
    const list = placements.filter((p) => p.kind === kind);
    const material = materials.surface({ map: placeholder ?? undefined, roughness: 0.9, vertexColors: true });
    // Until the file arrives: one degenerate triangle with the real attribute set and no instances drawn.
    // The mesh stays visible, so `compileAsync` (it only walks visible objects) builds its shader up front.
    const stub = new BufferGeometry();
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]] as const) stub.setAttribute(name, new BufferAttribute(new Float32Array(3 * size), size));
    const mesh = new InstancedMesh(stub, material, list.length);
    list.forEach((p, i) => mesh.setMatrixAt(i, p.m));
    if (list.some((p) => p.tint)) { const c = new Color(); list.forEach((p, i) => mesh.setColorAt(i, c.setRGB(...(p.tint ?? [1, 1, 1])))); }
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
      // Bounds over the instances: only after the count is set (InstancedMesh bounds count instances).
      mesh.count = list.length;
      mesh.computeBoundingSphere();
    }).catch((e: unknown) => console.warn(`GLB prop ${kind} did not load`, e));
  }
}
