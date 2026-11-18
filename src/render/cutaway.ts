// V1 B cutaway (docs/tasks/v1-visibility.md, design B3): a flagged building is cut off above a height
// while the hero is in one of its zones. The merged meshes hold the upper triangles of each part as an
// index range (`BatchSet.cut`); cutting overwrites that range with degenerate triangles and uploads only
// that sub-range, uncutting writes the saved indices back. Every pass draws the same index buffer, so
// beauty, pre-pass, shadow and contour mask agree: no material, shader, light or draw call changes.
import type { Box3, BufferAttribute, Mesh, Object3D } from 'three';
import { cutActive, type CutZone } from '../data/cut';
import type { BoxCut, CutRange } from './batch';

export class Cutaway {
  private readonly ranges = new Map<number, Array<{ index: BufferAttribute; range: CutRange }>>();
  private readonly boxes = new Map<number, Array<{ box: Box3; y: number; top: number }>>();
  private readonly objects = new Map<number, Object3D[]>();
  private readonly cut = new Set<number>();
  private readonly active: boolean[];
  /** Part → indices of the zones that flag it. */
  private readonly partZones = new Map<number, number[]>();

  constructor(private readonly zones: readonly CutZone[] = []) {
    this.active = zones.map(() => false);
    zones.forEach((z, i) => { for (const p of z.parts) { const list = this.partZones.get(p) ?? []; list.push(i); this.partZones.set(p, list); } });
  }

  /** Registers the cut ranges of a mesh (`geometry.userData.cuts`) and, for a contour mask, its box cuts. */
  add(mesh: Mesh): void {
    const index = mesh.geometry.index;
    const cuts = mesh.geometry.userData.cuts as CutRange[] | undefined;
    if (index && cuts) for (const range of cuts) this.push(this.ranges, range.part, { index, range });
    const boxes = mesh.userData.boxes as Box3[] | undefined;
    const boxCuts = mesh.userData.boxCuts as BoxCut[] | undefined;
    if (boxes && boxCuts) for (const c of boxCuts) this.push(this.boxes, c.part, { box: boxes[c.box]!, y: c.y, top: c.top });
  }

  /** Something that is not batched: hidden while the part is cut. */
  addObject(part: number, o: Object3D): void {
    this.push(this.objects, part, o);
  }

  private push<T>(map: Map<number, T[]>, part: number, item: T): void {
    const list = map.get(part);
    if (list) list.push(item);
    else map.set(part, [item]);
  }

  isCut(part: number): boolean {
    return this.cut.has(part);
  }

  /** Cuts (`on`) or restores a part: upper ranges blank, caps show, mask boxes end at the cut height. */
  set(part: number, on: boolean): void {
    if (this.cut.has(part) === on) return;
    if (on) this.cut.add(part);
    else this.cut.delete(part);
    for (const { index, range } of this.ranges.get(part) ?? []) {
      const array = index.array as Uint16Array | Uint32Array;
      if (range.cap === on) array.set(range.shown, range.start);
      else array.fill(range.shown[0]!, range.start, range.start + range.count);
      index.addUpdateRange(range.start, range.count);
      index.needsUpdate = true;
    }
    for (const b of this.boxes.get(part) ?? []) b.box.max.y = on ? Math.min(b.top, b.y) : b.top;
    for (const o of this.objects.get(part) ?? []) o.visible = !on;
  }

  /** Runs the zones for the hero at (x, z); does nothing more unless a zone changed state. */
  update(x: number, z: number): void {
    let changed = false;
    for (let i = 0; i < this.zones.length; i++) {
      const a = cutActive(this.zones[i]!, x, z, this.active[i]!);
      if (a !== this.active[i]) { this.active[i] = a; changed = true; }
    }
    if (!changed) return;
    for (const [part, zones] of this.partZones) {
      let on = false;
      for (const k of zones) if (this.active[k]) on = true;
      this.set(part, on);
    }
  }
}
