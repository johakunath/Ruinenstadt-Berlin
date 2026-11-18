import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { BatchSet, boxGeo, type BoxCut, type CutRange } from './batch';

const tri = (g: BufferGeometry, t: number): [Vector3, Vector3, Vector3] => {
  const pos = g.getAttribute('position'), idx = g.index!;
  return [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(pos, idx.getX(t * 3 + k))) as [Vector3, Vector3, Vector3];
};
const area = (g: BufferGeometry, from: number, to: number): number => {
  let a = 0;
  for (let t = from / 3; t < to / 3; t++) { const [p, q, r] = tri(g, t); a += new Vector3().subVectors(q, p).cross(new Vector3().subVectors(r, p)).length() / 2; }
  return a;
};

describe('batch cut (V1 B)', () => {
  it('clips a box into a lower part and one upper range, keeping area, bounds and winding', () => {
    const set = new BatchSet(), mat = new MeshBasicMaterial();
    set.of(mat).add(boxGeo(1, 1, 1), new Matrix4().makeTranslation(10, 0, 0)); // not cut
    set.cut(7, 0.2, () => set.of(mat).add(boxGeo(2, 2, 2), new Matrix4()));
    const g = set.meshes()[0]!.geometry, cuts = g.userData.cuts as CutRange[];
    expect(cuts).toHaveLength(1);
    const [c] = cuts as [CutRange];
    expect(c).toMatchObject({ part: 7, cap: false });
    expect(c.start + c.count).toBe(g.index!.count);
    // Uncut box first (36), then the lower part, then the upper range.
    expect(area(g, 36, g.index!.count)).toBeCloseTo(24, 5);
    for (let t = 12; t < g.index!.count / 3; t++) {
      const ys = tri(g, t).map((p) => p.y), upper = t * 3 >= c.start;
      if (upper) expect(Math.min(...ys)).toBeGreaterThanOrEqual(0.2 - 1e-6);
      else expect(Math.max(...ys)).toBeLessThanOrEqual(0.2 + 1e-6);
      // Winding: the face normal points like the vertex normals (outward).
      const [p, q, r] = tri(g, t), face = new Vector3().subVectors(q, p).cross(new Vector3().subVectors(r, p)).normalize();
      expect(face.dot(new Vector3().fromBufferAttribute(g.getAttribute('normal'), g.index!.getX(t * 3)))).toBeGreaterThan(0.99);
    }
    expect(area(g, c.start, c.start + c.count)).toBeCloseTo(4 + 4 * 2 * 0.8, 5);
    expect(Array.from(c.shown)).toEqual(Array.from(g.index!.array.slice(c.start, c.start + c.count)));
  });

  it('interpolates uv and colour and adds no vertex for triangles on the plane', () => {
    const set = new BatchSet(), mat = new MeshBasicMaterial(), plane = new PlaneGeometry(2, 2);
    plane.translate(0, 1, 0); // y 0..2, uv v 0..1
    const colors = new Float32Array([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    // PlaneGeometry vertex order: top row first; colour 0 at the top, 1 at the bottom.
    plane.setAttribute('color', new BufferAttribute(colors.reverse(), 3));
    set.cut(1, 1, () => set.of(mat).add(plane, new Matrix4()));
    const g = set.meshes()[0]!.geometry, pos = g.getAttribute('position'), uv = g.getAttribute('uv'), col = g.getAttribute('color');
    for (let i = 4; i < pos.count; i++) {
      expect(pos.getY(i)).toBe(1);
      expect(uv.getY(i)).toBeCloseTo(0.5, 6);
      expect(col.getX(i)).toBeCloseTo(0.5, 6);
    }
    expect(pos.count).toBe(4 + 3); // two vertical edges and the diagonal
    const flat = new BatchSet();
    flat.cut(1, 0, () => flat.of(mat).add(boxGeo(2, 2, 2), new Matrix4().makeTranslation(0, 1, 0)));
    const f = flat.meshes()[0]!.geometry, fc = (f.userData.cuts as CutRange[])[0]!;
    expect(f.getAttribute('position').count).toBe(24);
    expect(fc.count).toBe(30); // all but the bottom face, which lies on the plane and stays
  });

  it('switches to 32-bit indices when clipping pushes the vertex count past 65535', () => {
    const set = new BatchSet(), mat = new MeshBasicMaterial(), box = boxGeo(1, 1, 1);
    set.cut(1, 0, () => { for (let i = 0; i < 2700; i++) set.of(mat).add(box, new Matrix4().makeTranslation(i * 2, 0, 0)); });
    const g = set.meshes()[0]!.geometry;
    expect(g.getAttribute('position').count).toBeGreaterThan(65535);
    expect(g.index!.array).toBeInstanceOf(Uint32Array);
  });

  it('records degenerate cap ranges, mask ranges and the clamped mask box', () => {
    const set = new BatchSet(), wall = new MeshBasicMaterial(), lid = new MeshBasicMaterial();
    set.captureOccluder(() => set.cut(3, 1, () => set.of(wall).add(boxGeo(2, 4, 2), new Matrix4().makeTranslation(0, 2, 0)), () => set.of(lid).add(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new Matrix4().makeTranslation(0, 1, 0))));
    const meshes = set.meshes(), capGeo = meshes[1]!.geometry, cap = (capGeo.userData.cuts as CutRange[])[0]!;
    expect(cap).toMatchObject({ part: 3, cap: true, start: 0, count: 6 });
    const idx = capGeo.index!.array;
    expect(new Set(Array.from(idx.slice(cap.start, cap.start + cap.count))).size).toBe(1); // degenerate while uncut
    expect(new Set(Array.from(cap.shown)).size).toBe(4);
    const mask = set.occluderMesh()!, mc = mask.geometry.userData.cuts as CutRange[];
    const upper = (meshes[0]!.geometry.userData.cuts as CutRange[])[0]!;
    expect(mc).toHaveLength(1);
    expect(mc[0]!.count).toBe(upper.count); // caps are no occluders
    expect(mask.geometry.index!.count).toBe(meshes[0]!.geometry.index!.count);
    const boxCuts = mask.userData.boxCuts as BoxCut[];
    expect(boxCuts).toEqual([{ box: 0, part: 3, y: 1, top: 4 }]);
  });
});
