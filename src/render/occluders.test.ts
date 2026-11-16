import { describe, expect, it } from 'vitest';
import { Matrix4, MeshBasicMaterial } from 'three';
import { BatchSet, boxGeo } from './batch';
import { isLargeProp, OCCLUDER_LAYER } from './layers';

describe('large object occlusion geometry', () => {
  it('excludes small props even when they share a material with a building', () => {
    const batches = new BatchSet(), shared = new MeshBasicMaterial();
    const box = boxGeo(2, 2, 2);
    batches.of(shared).add(box, new Matrix4().makeTranslation(0, 0, 0));
    batches.captureOccluder(() => batches.of(shared).add(box, new Matrix4().makeTranslation(10, 0, 0)));
    batches.of(shared).add(box, new Matrix4().makeTranslation(20, 0, 0));
    expect(batches.meshes()).toHaveLength(1); // Preserve the beauty batch.
    const mask = batches.occluderMesh()!;
    mask.geometry.computeBoundingBox();
    expect(mask.geometry.boundingBox!.min.x).toBe(9);
    expect(mask.geometry.boundingBox!.max.x).toBe(11);
    expect(mask.geometry.index!.count).toBe(36);
    expect(mask.layers.mask).toBe(1 << OCCLUDER_LAYER);
  });
  it('preserves transforms and lift and does not duplicate nested classification', () => {
    const batches = new BatchSet(), mat = new MeshBasicMaterial();
    batches.lift = 5;
    batches.captureOccluder(() => batches.captureOccluder(() => batches.of(mat).add(boxGeo(2, 2, 2), new Matrix4())));
    const mask = batches.occluderMesh()!;
    mask.geometry.computeBoundingBox();
    expect(mask.geometry.index!.count).toBe(36);
    expect(mask.geometry.boundingBox!.min.y).toBe(4);
    expect(mask.geometry.boundingBox!.max.y).toBe(6);
  });
  it('does not create a depth mask for unclassified geometry', () => {
    const batches = new BatchSet();
    batches.of(new MeshBasicMaterial()).add(boxGeo(1, 1, 1), new Matrix4());
    expect(batches.occluderMesh()).toBeNull();
  });
  it('classifies vehicles without opting crates, trees, lamps or loot into the effect', () => {
    for (const kind of ['tram', 'bus', 'van', 'car'] as const) expect(isLargeProp(kind)).toBe(true);
    for (const kind of ['crates', 'bins', 'lantern', 'lampBroken', 'bench', 'fence', 'rubble'] as const) expect(isLargeProp(kind)).toBe(false);
  });
});
