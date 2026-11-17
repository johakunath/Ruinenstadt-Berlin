import { describe, expect, it } from 'vitest';
import { Matrix4, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { BatchSet, boxGeo } from './batch';
import { isLargeProp, OCCLUDER_LAYER } from './layers';
import { Builder, buildAltbau, type Mats } from './world';
import { buildAltbauLot } from './map-world';
import { koepenickMap } from '../data/koepenick';

// Real geometry builders, with texture/light setup omitted so the regression can run without DOM.
function buildingFixture(): Builder & { mm: Mats; lamps: Vector3[] } {
  const material = new MeshBasicMaterial();
  const mats = new Proxy({}, { get: (_, key) => key === 'plaster' ? { cream: material, ochre: material, oxblood: material } : material }) as Mats;
  const lamps: Vector3[] = [];
  return Object.assign(Object.create(Builder.prototype), { mats, mm: mats, lamps,
    solid: new BatchSet(), cards: new BatchSet(), shadowBoxes: [], extras: [],
    light: (position: Vector3) => { lamps.push(position.clone()); },
  });
}

function expectLampExcluded(b: Builder, y: number, z: number): void {
  const ray = new Raycaster(new Vector3(-30, y, z), new Vector3(1, 0, 0));
  ray.layers.enableAll();
  const beauty = b.solid.meshes(), mask = b.solid.occluderMesh()!;
  beauty.forEach(mesh => mesh.updateMatrixWorld()); mask.updateMatrixWorld();
  expect(ray.intersectObjects(beauty, false).length).toBeGreaterThan(0);
  expect(ray.intersectObject(mask, false)).toHaveLength(0);
  expect(mask.geometry.index!.count).toBeGreaterThan(0); // Keep the actual building classified.
}

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
    for (const kind of ['tram', 'bus', 'van', 'car', 'rohbau', 'container'] as const) expect(isLargeProp(kind)).toBe(true);
    for (const kind of ['crates', 'bins', 'lantern', 'lampBroken', 'bench', 'fence', 'rubble'] as const) expect(isLargeProp(kind)).toBe(false);
  });
  it('keeps nested small attachments out while retaining the surrounding building geometry', () => {
    const batches = new BatchSet(), material = new MeshBasicMaterial(), box = boxGeo(2, 2, 2);
    batches.captureOccluder(() => {
      batches.of(material).add(box, new Matrix4());
      batches.excludeOccluder(() => batches.of(material).add(box, new Matrix4().makeTranslation(20, 0, 0)));
      batches.of(material).add(box, new Matrix4().makeTranslation(4, 0, 0));
    });
    const mask = batches.occluderMesh()!;
    mask.geometry.computeBoundingBox();
    expect(mask.geometry.index!.count).toBe(72);
    expect(mask.geometry.boundingBox!.max.x).toBe(5);
    expect(batches.meshes()[0]!.geometry.index!.count).toBe(108);
  });
  it('excludes the lamp emitted by the actual Altbau gate builder', () => {
    const b = buildingFixture();
    b.solid.captureOccluder(() => buildAltbau(b, { id: 'lamp-test', style: 'altbau', ax: -6, az: 0, bx: 6, bz: 0,
      depth: 5, floors: 0, tone: 'cream', seed: 11, features: [{ kind: 'gate', from: 4, to: 8 }] }));
    expect(b.lamps).toHaveLength(1);
    expectLampExcluded(b, 3.25, 0.62);
  });
  it('excludes wall lamps emitted by the actual map Altbau lot builder', () => {
    const m = koepenickMap();
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const b = buildingFixture();
      b.solid.captureOccluder(() => buildAltbauLot(b as unknown as Parameters<typeof buildAltbauLot>[0],
        { kind: 'altbau', x: 0, z: 0, w: 12, d: 10, rot: 0, floors: 0, seed }, m));
      if (!b.lamps.length) continue;
      const lamp = b.lamps[0]!;
      expectLampExcluded(b, lamp.y + 0.03, lamp.z - 0.03);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
