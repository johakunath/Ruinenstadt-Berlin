// Test helper: the hero's bind-space data straight from assets/characters/hero.glb, without a Three.js
// loader (Node has no image decoding). Only tests import this file (it reads the file system).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Matrix4, Vector3, type SkinnedMesh } from 'three';
import type { HeroSource } from './gear-kit';

interface Gltf {
  nodes: { name?: string; mesh?: number; skin?: number }[];
  meshes: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export interface HeroGlb {
  source: HeroSource;
  /** Bone names in skin order. */
  bones: string[];
  /** A stand-in skinned mesh per node (geometry with position, normal, color, skin attributes and index; skeleton bone names). */
  mesh(node: string): SkinnedMesh;
}

let cached: HeroGlb | null = null;

export function readHeroGlb(): HeroGlb {
  if (cached) return cached;
  const buf = readFileSync(fileURLToPath(new URL('../../assets/characters/hero.glb', import.meta.url)));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen)) as Gltf;
  const binStart = 20 + jsonLen + 8;
  const read = (i: number): { data: Float32Array | Uint32Array; size: number } => {
    const a = json.accessors[i]!, v = json.bufferViews[a.bufferView]!, size = SIZE[a.type]!;
    const comp = a.componentType, bytes = comp === 5126 || comp === 5125 ? 4 : comp === 5123 ? 2 : 1;
    const stride = v.byteStride ?? size * bytes, base = binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = comp === 5125 || (comp !== 5126 && !a.normalized) ? new Uint32Array(a.count * size) : new Float32Array(a.count * size);
    const max = comp === 5123 ? 65535 : 255;
    for (let k = 0; k < a.count; k++) for (let c = 0; c < size; c++) {
      const o = base + k * stride + c * bytes;
      const x = comp === 5126 ? buf.readFloatLE(o) : comp === 5125 ? buf.readUInt32LE(o) : comp === 5123 ? buf.readUInt16LE(o) : buf.readUInt8(o);
      out[k * size + c] = comp !== 5126 && a.normalized ? x / max : x;
    }
    return { data: out, size };
  };
  const skin = json.skins[0]!;
  const bones = skin.joints.map((j) => json.nodes[j]!.name ?? '');
  const ibm = read(skin.inverseBindMatrices).data;
  const bonePos = new Map<string, Vector3>();
  const m = new Matrix4();
  bones.forEach((b, i) => bonePos.set(b, new Vector3().setFromMatrixPosition(m.fromArray(Array.from(ibm.slice(i * 16, i * 16 + 16))).invert())));
  const meshes = new Map<string, Float32Array>();
  const geos = new Map<string, BufferGeometry>();
  for (const n of json.nodes) {
    if (n.mesh === undefined || !n.name) continue;
    const prim = json.meshes[n.mesh]!.primitives[0]!;
    const g = new BufferGeometry();
    for (const [name, attr] of [['POSITION', 'position'], ['NORMAL', 'normal'], ['COLOR_0', 'color'], ['JOINTS_0', 'skinIndex'], ['WEIGHTS_0', 'skinWeight']] as const) {
      const i = prim.attributes[name];
      if (i === undefined) continue;
      const { data, size } = read(i);
      g.setAttribute(attr, new BufferAttribute(name === 'JOINTS_0' ? new Uint16Array(data) : new Float32Array(data), size));
    }
    const idx = prim.indices !== undefined ? read(prim.indices).data : null;
    if (idx) g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
    geos.set(n.name, g);
    const pos = g.attributes.position!;
    const used = idx ? [...new Set(idx)] : Array.from({ length: pos.count }, (_, k) => k);
    const p = new Float32Array(used.length * 3);
    used.forEach((v, k) => p.set([pos.getX(v), pos.getY(v), pos.getZ(v)], k * 3));
    meshes.set(n.name, p);
  }
  const skeleton = { bones: bones.map((name) => ({ name })) };
  cached = {
    source: { meshes, bones: bonePos },
    bones,
    mesh: (node) => ({ name: node, geometry: geos.get(node)!, skeleton, isSkinnedMesh: true }) as unknown as SkinnedMesh,
  };
  return cached;
}
