import { describe, expect, it } from 'vitest';
import { Box3, Matrix4, MeshBasicMaterial, PlaneGeometry } from 'three';
import { BatchSet, boxGeo, type CutRange } from './batch';
import { Cutaway } from './cutaway';

function fixture(): { set: BatchSet; meshes: ReturnType<BatchSet['meshes']>; mask: NonNullable<ReturnType<BatchSet['occluderMesh']>> } {
  const set = new BatchSet(), wall = new MeshBasicMaterial(), lid = new MeshBasicMaterial();
  set.captureOccluder(() => set.of(wall).add(boxGeo(1, 1, 1), new Matrix4().makeTranslation(5, 0.5, 0)));
  set.captureOccluder(() => set.cut(2, 1.2, () => set.of(wall).add(boxGeo(2, 6, 2), new Matrix4().makeTranslation(0, 3, 0)),
    () => set.of(lid).add(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new Matrix4().makeTranslation(0, 1.21, 0))));
  return { set, meshes: set.meshes(), mask: set.occluderMesh()! };
}

describe('cutaway (V1 B)', () => {
  it('blanks and restores exactly, caps the inverse, and clamps the mask box', () => {
    const { meshes, mask } = fixture();
    const cut = new Cutaway([]);
    for (const m of [...meshes, mask]) cut.add(m);
    const before = [...meshes, mask].map((m) => Array.from(m.geometry.index!.array));
    const box = (mask.userData.boxes as Box3[])[1]!;
    cut.set(2, true);
    const [wall, lid] = meshes as [typeof meshes[0], typeof meshes[0]];
    const upper = (wall.geometry.userData.cuts as CutRange[])[0]!, cap = (lid.geometry.userData.cuts as CutRange[])[0]!;
    const w = wall.geometry.index!.array;
    expect(new Set(Array.from(w.slice(upper.start, upper.start + upper.count))).size).toBe(1);
    expect(Array.from(w.slice(0, upper.start))).toEqual(before[0]!.slice(0, upper.start)); // the rest untouched
    expect(Array.from(lid.geometry.index!.array.slice(cap.start, cap.start + cap.count))).toEqual(Array.from(cap.shown));
    expect(wall.geometry.index!.updateRanges).toEqual([{ start: upper.start, count: upper.count }]);
    expect(box.max.y).toBeCloseTo(1.2, 6);
    expect((mask.userData.boxes as Box3[])[0]!.max.y).toBe(1); // the uncut object keeps its box
    cut.set(2, false);
    expect([...meshes, mask].map((m) => Array.from(m.geometry.index!.array))).toEqual(before);
    expect(box.max.y).toBe(6);
  });

  it('follows its zones and touches nothing while no zone changes', () => {
    const { meshes } = fixture();
    const cut = new Cutaway([
      { name: 'a', poly: [[0, 0], [0, 10], [10, 10], [10, 0]], h: 1.2, parts: [2] },
      { name: 'b', poly: [[20, 0], [20, 10], [30, 10], [30, 0]], h: 1.2, parts: [2] },
    ]);
    for (const m of meshes) cut.add(m);
    const index = meshes[0]!.geometry.index!;
    cut.update(-5, 5);
    expect(index.version).toBe(0);
    cut.update(5, 5);
    expect(cut.isCut(2)).toBe(true);
    const v = index.version;
    cut.update(6, 5);
    expect(index.version).toBe(v);
    cut.update(25, 5); // left a, entered b: still cut
    expect(cut.isCut(2)).toBe(true);
    cut.update(40, 5);
    expect(cut.isCut(2)).toBe(false);
  });
});
