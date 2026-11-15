// Collects static geometry per material and merges it into one mesh each, so the whole
// courtyard costs a handful of draw calls.
import { BoxGeometry, BufferAttribute, BufferGeometry, Matrix4, Vector3, type Material, Mesh } from 'three';

type RGB = readonly [number, number, number];
const WHITE: RGB = [1, 1, 1];
const v = new Vector3();
const n = new Vector3();

export class Batch {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  get empty(): boolean {
    return this.indices.length === 0;
  }

  /** Appends a geometry transformed by `m`. `color` multiplies the material color per vertex. */
  add(geo: BufferGeometry, m: Matrix4, color: RGB = WHITE): void {
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const col = geo.getAttribute('color');
    const base = this.positions.length / 3;
    const normalMatrix = new Matrix4().copy(m).invert().transpose();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      n.fromBufferAttribute(nor, i).transformDirection(normalMatrix);
      this.positions.push(v.x, v.y, v.z);
      this.normals.push(n.x, n.y, n.z);
      this.uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      if (col) this.colors.push(col.getX(i) * color[0], col.getY(i) * color[1], col.getZ(i) * color[2]);
      else this.colors.push(color[0], color[1], color[2]);
    }
    const index = geo.getIndex();
    if (index) for (let i = 0; i < index.count; i++) this.indices.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.indices.push(base + i);
  }

  /**
   * A quad from four corners (counter-clockwise seen from the front). `uv` is [u0, v0, u1, v1];
   * `colors` are per corner.
   */
  quad(p: [Vector3, Vector3, Vector3, Vector3], uv: readonly [number, number, number, number] = [0, 0, 1, 1], colors: readonly RGB[] = [WHITE]): void {
    const base = this.positions.length / 3;
    n.subVectors(p[1], p[0]).cross(v.subVectors(p[3], p[0])).normalize();
    const uvs = [uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]];
    for (let i = 0; i < 4; i++) {
      const c = colors[i] ?? colors[0] ?? WHITE;
      this.positions.push(p[i]!.x, p[i]!.y, p[i]!.z);
      this.normals.push(n.x, n.y, n.z);
      this.uvs.push(uvs[i * 2]!, uvs[i * 2 + 1]!);
      this.colors.push(c[0], c[1], c[2]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    g.setIndex(this.positions.length / 3 > 65535 ? new BufferAttribute(new Uint32Array(this.indices), 1) : new BufferAttribute(new Uint16Array(this.indices), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Batches keyed by material. */
export class BatchSet {
  private readonly map = new Map<Material, Batch>();

  of(material: Material): Batch {
    let b = this.map.get(material);
    if (!b) {
      b = new Batch();
      this.map.set(material, b);
    }
    return b;
  }

  meshes(): Mesh[] {
    const list: Mesh[] = [];
    for (const [material, batch] of this.map) {
      if (batch.empty) continue;
      list.push(new Mesh(batch.build(), material));
    }
    return list;
  }
}

/** Box whose UVs are in meters times `uvScale`, so textures keep their world size on any box. */
export function boxGeo(sx: number, sy: number, sz: number, uvScale = 1): BoxGeometry {
  const g = new BoxGeometry(sx, sy, sz);
  const uv = g.getAttribute('uv');
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const dims: Array<[number, number]> = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) {
    const [du, dv] = dims[f] as [number, number];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * du * uvScale, uv.getY(k) * dv * uvScale);
    }
  }
  return g;
}
