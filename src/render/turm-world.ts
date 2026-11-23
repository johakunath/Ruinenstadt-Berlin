// M17 Fernsehturm (`src/data/fernsehturm.ts`, `docs/maps/fernsehturm.md`): the tower decks, step 1 blockout.
// Static set (merged into the map chunks, per material): deck floors, the window band on the north half of every
// deck and a knee-high sill toward the camera, cores (solid, the open well, the low movement), lift doors, the
// Telecafé bar, furniture and the hand-placed lamps (pooled lights, the count never changes).
// Moving parts (`TurmView`, FX layer, unlit, never in the pre-pass): the clock hands with their warning wedge, the
// lift rings with the ride progress, the crank hold ring with its charge arc; the revolving band is a lit floor
// mesh turned by sim time. Reads sim state, never writes it.
//
// Cost (estimate, not measured): per deck about 10 to 14 merged batches (floor, concrete, steel, glass, enamel,
// brass, wood, cloth), under 20k triangles; the view adds 3 hand meshes, 3 wedges, 4 lift rings, 2 hold meshes and
// the band (2 draw calls), each frustum-culled to the hero's deck. Same on Ausgewogen and Leistung.
import { BufferAttribute, BufferGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, RingGeometry, Vector3, type Material } from 'three';
import { apothem, liftDoor, type DeckDef, type TurmSolid } from '../data/fernsehturm';
import type { MapDef } from '../data/map';
import { bandAngle, handAngle, LIFT, type HandDef } from '../sim/turm';
import { FX_LAYER } from './layers';
import type { LitMaterial, Materials } from './materials';
import type { ChunkBuilder, MapMats } from './map-world';

type RGB = readonly [number, number, number];

export interface TurmMats {
  floor: LitMaterial;
  steel: LitMaterial;
  brass: LitMaterial;
  glass: LitMaterial;
  enamel: LitMaterial;
  cloth: LitMaterial;
  lamp: LitMaterial;
  band: LitMaterial;
}

/** Interior palette of the Stillstand board (`docs/style/fernsehturm.webp`): concrete white, steel blue-grey, brass, enamel orange, cobalt. */
export function makeTurmMats(materials: Materials): TurmMats {
  return {
    floor: materials.surface({ color: 0xffffff, roughness: 0.9, vertexColors: true }),
    steel: materials.surface({ color: 0xffffff, roughness: 0.45, metalness: 0.55, vertexColors: true }),
    brass: materials.surface({ color: 0xc8963c, roughness: 0.35, metalness: 0.8, emissive: 0x3a2408, emissiveIntensity: 0.6 }),
    glass: materials.surface({ color: 0x2c4a5a, roughness: 0.12, metalness: 0.3, emissive: 0x0c1c26, emissiveIntensity: 1 }),
    enamel: materials.surface({ color: 0xffffff, roughness: 0.5, vertexColors: true }),
    cloth: materials.surface({ color: 0xffffff, roughness: 0.95, vertexColors: true }),
    lamp: materials.surface({ color: 0xfff0d0, roughness: 0.4, emissive: 0xffc070, emissiveIntensity: 2.2 }),
    band: materials.surface({ color: 0xffffff, roughness: 0.75, vertexColors: true }),
  };
}

const M = (x: number, y: number, z: number, ry = 0): Matrix4 => new Matrix4().makeRotationY(ry).setPosition(x, y, z);
/** Facing angle a points along (sin a, cos a). */
const polar = (d: { x: number; z: number }, r: number, a: number): [number, number] => [d.x + Math.sin(a) * r, d.z + Math.cos(a) * r];

const CONCRETE: RGB = [0.86, 0.84, 0.8];
const STEEL: RGB = [0.5, 0.56, 0.62];
const ENAMEL_ORANGE: RGB = [0.86, 0.42, 0.16];
const ENAMEL_BROWN: RGB = [0.42, 0.24, 0.13];
const COBALT: RGB = [0.16, 0.28, 0.62];
const SIGNAL_RED: RGB = [0.8, 0.14, 0.1];
/** Floor tint per deck: foyer terrazzo, shaft gallery grating, the two sphere decks in warm enamel, the dome brass-dark. */
const FLOOR: Record<DeckDef['id'], RGB> = {
  foyer: [0.34, 0.33, 0.31], schacht: [0.2, 0.21, 0.22], panorama: [0.34, 0.26, 0.2], telecafe: [0.36, 0.22, 0.15], uhrenraum: [0.24, 0.2, 0.16],
};
/** Height of the window band (the room is open to the camera, no ceilings drawn). */
const WALL_H = 4.4;
const SILL_H = 0.9;
/** Core walls are cut at this height (V1 B cutaway height). */
export const CORE_H = 4.3;

/** A wall segment counts as the camera side (knee-high sill) when it faces south. */
const southward = (a: number): boolean => Math.cos(a) > 0.05;

/** Floor ring (or polygon ring) of a deck from `r0` to `r1`. */
function floorGeo(d: DeckDef, r0: number, r1: number): BufferGeometry {
  const g = d.sides ? new RingGeometry(r0, r1, d.sides, 2) : new RingGeometry(r0, r1, 72, 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Static tower set into the map chunks. */
export function buildTurmWorld(m: MapDef, mats: MapMats, tm: TurmMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  const T = m.turm!;
  for (const d of m.decks ?? []) {
    const b = chunkOf(d.x, d.z);
    const box = (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB, ry = 0): void => b.box(mat, M(x, y, z, ry), sx, sy, sz, color);
    // Floor: the band of the Telecafé is the view's own mesh.
    const band = d.id === 'telecafe' ? T.band : null;
    const coreHole = d.core.r - 0.05;
    if (band) {
      b.geo(tm.floor, floorGeo(d, coreHole, band.r0), M(d.x, 0.01, d.z), FLOOR[d.id]);
      b.geo(tm.floor, floorGeo(d, band.r1, d.r + 0.4), M(d.x, 0.01, d.z), FLOOR[d.id]);
    } else b.geo(tm.floor, floorGeo(d, d.core.kind === 'well' ? d.core.r : coreHole, (d.sides ? d.r : d.r + 0.4)), M(d.x, 0.01, d.z), FLOOR[d.id]);
    // A darker rim on the floor along the wall, and a brass inlay ring at the fight's edge on the sphere decks.
    if (!d.sides) b.geo(tm.floor, floorGeo(d, d.r - 1.2, d.r + 0.4), M(d.x, 0.02, d.z), [0.25, 0.22, 0.2]);
    if (d.id === 'panorama' || d.id === 'uhrenraum') b.geo(tm.brass, floorGeo(d, 8.4, 8.6), M(d.x, 0.025, d.z));

    walls(b, d, tm, mats, box);
    core(b, d, tm, mats, box);
    // Lift door on the south face of the core: steel frame, closed leaves, a red lamp over it.
    const door = liftDoor(d);
    box(tm.steel, door.x, 1.25, door.z + 0.12, 2.4, 2.5, 0.3, STEEL);
    box(tm.steel, door.x, 1.15, door.z + 0.3, 1.8, 2.3, 0.06, [0.32, 0.36, 0.4]);
    box(mats.iron, door.x, 1.15, door.z + 0.34, 0.04, 2.3, 0.02, [0.08, 0.08, 0.08]);
    box(tm.lamp, door.x, 2.7, door.z + 0.32, 0.5, 0.18, 0.12, SIGNAL_RED);
    if (d.bar) bar(d, tm, box);
  }
  for (const s of T.solids) solid(chunkOf(s.x, s.z), s, tm, mats);
  for (const l of T.lights) {
    const b = chunkOf(l.x, l.z);
    b.light(new Vector3(l.x, l.y, l.z), l.color, l.intensity, l.distance, 0.02, 4);
    b.box(tm.lamp, M(l.x, l.y + 0.2, l.z), 0.35, 0.12, 0.35);
  }
}

/** Outer wall: the window band on the north half, a knee-high sill toward the camera. */
function walls(b: ChunkBuilder, d: DeckDef, tm: TurmMats, mats: MapMats, box: (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB, ry?: number) => void): void {
  const faces: Array<{ a: number; r: number; len: number }> = [];
  if (d.sides) {
    const ap = apothem(d), side = 2 * d.r * Math.sin(Math.PI / d.sides);
    for (let k = 0; k < d.sides; k++) faces.push({ a: (k * 2 * Math.PI) / d.sides, r: ap, len: side });
  } else {
    const n = 40, len = (2 * Math.PI * d.r) / n;
    for (let k = 0; k < n; k++) faces.push({ a: ((k + 0.5) * 2 * Math.PI) / n, r: d.r, len: len + 0.06 });
  }
  for (const f of faces) {
    const [x, z] = polar(d, f.r + 0.3, f.a), ry = f.a;
    const south = southward(f.a);
    // Sill (concrete, enamel band on top).
    box(mats.concrete, x, SILL_H / 2, z, f.len, SILL_H, 0.6, CONCRETE, ry);
    box(tm.enamel, x, SILL_H + 0.04, z, f.len, 0.08, 0.7, d.id === 'foyer' || d.id === 'schacht' ? STEEL : ENAMEL_ORANGE, ry);
    if (south) continue;
    // Window band: slanted panes between steel ribs, a top beam.
    const panes = d.sides ? 8 : 1;
    for (let p = 0; p < panes; p++) {
      const t = (p + 0.5) / panes - 0.5, px = x + Math.cos(ry) * t * f.len, pz = z - Math.sin(ry) * t * f.len;
      // The foyer's north-east face is the entrance: an open door gap in the middle of its glass.
      if (d.sides && Math.abs(Math.cos(f.a - (2 * Math.PI) / 3)) > 0.99 && Math.abs(t) < 0.1) continue;
      b.box(tm.glass, M(px, SILL_H + (WALL_H - SILL_H) / 2, pz, ry).multiply(new Matrix4().makeRotationX(-0.12)), f.len / panes - 0.12, WALL_H - SILL_H, 0.06);
      box(tm.steel, px + Math.cos(ry) * (f.len / panes / 2), WALL_H / 2, pz - Math.sin(ry) * (f.len / panes / 2), 0.16, WALL_H, 0.3, STEEL, ry);
    }
    box(tm.steel, x, WALL_H + 0.1, z, f.len, 0.22, 0.5, d.id === 'telecafe' || d.id === 'panorama' ? COBALT : STEEL, ry);
    b.shadowBox(M(x, WALL_H / 2, z, ry), f.len, WALL_H, 0.5);
  }
}

/** The core: concrete drum with an enamel band (solid), the open well with its railing, the low brass movement. */
function core(b: ChunkBuilder, d: DeckDef, tm: TurmMats, mats: MapMats, box: (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB, ry?: number) => void): void {
  const r = d.core.r;
  if (d.core.kind === 'solid') {
    b.geo(mats.concrete, new CylinderGeometry(r, r, CORE_H, 40, 1, true), M(d.x, CORE_H / 2, d.z), CONCRETE);
    b.geo(tm.enamel, new CylinderGeometry(r + 0.04, r + 0.04, 0.5, 40, 1, true), M(d.x, 2.6, d.z), d.id === 'foyer' ? COBALT : ENAMEL_BROWN);
    b.geo(mats.tar, new CircleGeometry(r, 40).rotateX(-Math.PI / 2), M(d.x, CORE_H, d.z), [0.12, 0.12, 0.12]);
    b.shadowBox(M(d.x, CORE_H / 2, d.z), r * 1.6, CORE_H, r * 1.6);
  } else if (d.core.kind === 'well') {
    // The open shaft: a dark disc far below, the gallery's edge and a railing.
    b.geo(mats.tar, new CircleGeometry(r, 40).rotateX(-Math.PI / 2), M(d.x, -6, d.z), [0.04, 0.09, 0.06]);
    b.geo(mats.concrete, new CylinderGeometry(r, r, 6, 40, 1, true).scale(-1, 1, 1), M(d.x, -3, d.z), [0.3, 0.3, 0.3]);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, [x, z] = polar(d, r + 0.15, a);
      if (Math.cos(a) > 0.92) continue;
      box(tm.steel, x, 0.5, z, 0.06, 1, 0.06, STEEL);
    }
    b.geo(tm.steel, new CylinderGeometry(r + 0.15, r + 0.15, 0.06, 40, 1, true), M(d.x, 1, d.z), [0.85, 0.65, 0.1]);
  } else {
    // The movement under the dome: a low brass drum with dials and a frame.
    b.geo(tm.brass, new CylinderGeometry(r, r * 1.05, 1.2, 40), M(d.x, 0.6, d.z));
    b.geo(mats.iron, new CylinderGeometry(r * 0.7, r * 0.7, 0.3, 30), M(d.x, 1.35, d.z), [0.2, 0.2, 0.22]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6, [x, z] = polar(d, r + 0.02, a);
      b.geo(tm.enamel, new CircleGeometry(0.4, 16), M(x, 0.65, z, a), [0.92, 0.9, 0.82]);
    }
  }
}

/** Telecafé bar: a curved counter on the north side of the core. */
function bar(d: DeckDef, tm: TurmMats, box: (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB, ry?: number) => void): void {
  const B = d.bar!;
  const n = 10;
  for (let k = 0; k < n; k++) {
    const a = B.a - B.half + ((k + 0.5) / n) * 2 * B.half, len = ((2 * B.half) / n) * B.r1 + 0.05;
    const [x, z] = polar(d, B.r1 - 0.4, a);
    box(tm.enamel, x, 0.55, z, len, 1.1, 0.8, ENAMEL_BROWN, a);
    box(tm.brass, x, 1.13, z, len, 0.06, 0.9, undefined, a);
    const [bx, bz] = polar(d, B.r0 + 0.5, a);
    box(tm.enamel, bx, 1.1, bz, len * 0.6, 2.2, 0.5, ENAMEL_ORANGE, a);
  }
}

/** One piece of furniture. */
function solid(b: ChunkBuilder, s: TurmSolid, tm: TurmMats, mats: MapMats): void {
  const box = (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB): void => b.box(mat, M(s.x, 0, s.z, s.rot).multiply(M(x, y, z)), sx, sy, sz, color);
  switch (s.what) {
    case 'counter':
      box(tm.enamel, 0, 0.55, 0, s.hx * 2, 1.1, s.hz * 2, ENAMEL_ORANGE);
      box(mats.wood, 0, 1.13, 0, s.hx * 2 + 0.1, 0.06, s.hz * 2 + 0.1, [0.5, 0.35, 0.2]);
      break;
    case 'shelf':
      box(mats.wood, 0, 1, 0, s.hx * 2, 2, s.hz * 2, [0.42, 0.3, 0.2]);
      for (const y of [0.7, 1.3]) box(tm.cloth, 0, y, 0.2, s.hx * 1.8, 0.25, 0.1, [0.3, 0.5, 0.7]);
      break;
    case 'kiosk':
      box(tm.enamel, 0, 1.3, 0, s.hx * 2, 2.6, s.hz * 2, COBALT);
      break;
    case 'bench':
      box(mats.wood, 0, 0.42, 0, s.hx * 2, 0.08, s.hz * 2, [0.45, 0.3, 0.18]);
      box(tm.steel, 0, 0.2, 0, s.hx * 1.8, 0.4, 0.1, STEEL);
      break;
    case 'telescope':
      b.geo(tm.steel, new CylinderGeometry(0.08, 0.14, 1.1, 10), M(s.x, 0.55, s.z), STEEL);
      b.geo(tm.enamel, new CylinderGeometry(0.16, 0.2, 0.8, 12).rotateX(Math.PI / 2 - 0.3), M(s.x, 1.25, s.z, s.rot), COBALT);
      break;
    case 'table':
      b.geo(tm.cloth, new CylinderGeometry(s.hx, s.hx, 0.06, 16), M(s.x, 0.78, s.z), [0.92, 0.88, 0.8]);
      b.geo(tm.cloth, new CylinderGeometry(s.hx + 0.02, s.hx + 0.08, 0.5, 16, 1, true), M(s.x, 0.52, s.z), [0.86, 0.82, 0.74]);
      b.geo(tm.steel, new CylinderGeometry(0.06, 0.06, 0.75, 8), M(s.x, 0.37, s.z), STEEL);
      for (const k of [0, 1, 2]) {
        const [x, z] = polar(s, s.hx * 0.5, s.rot + (k * 2 * Math.PI) / 3);
        b.geo(tm.glass, new CylinderGeometry(0.04, 0.03, 0.14, 8), M(x, 0.88, z));
      }
      break;
    case 'crank':
      box(tm.steel, 0, 0.6, 0, s.hx * 2, 1.2, s.hz * 2, [0.3, 0.34, 0.36]);
      b.geo(tm.brass, new CylinderGeometry(0.45, 0.45, 0.08, 18).rotateX(Math.PI / 2), M(s.x, 1.1, s.z, s.rot).multiply(M(0, 0, 0.45)));
      break;
    case 'switch':
      box(tm.steel, 0, 0.9, 0, s.hx * 2, 1.8, s.hz * 2, [0.3, 0.34, 0.36]);
      box(tm.brass, 0, 1.6, 0.45, 0.12, 0.7, 0.12);
      box(tm.lamp, -0.4, 1.5, 0.42, 0.14, 0.14, 0.05, SIGNAL_RED);
      break;
    case 'console':
      box(tm.enamel, 0, 0.5, 0, s.hx * 2, 1, s.hz * 2, ENAMEL_BROWN);
      box(tm.lamp, 0, 1.02, 0.1, s.hx * 1.6, 0.04, s.hz, [0.5, 0.9, 0.7]);
      break;
  }
}

// ---------------------------------------------------------------- moving parts

/** What the view needs from the sim (the renderer builds it each frame). */
export interface TurmState {
  time: number;
  /** Current encounter index and whether its fight runs (hands hurt only then). */
  index: number;
  fighting: boolean;
  /** Lift ring the hero stands in and the share of the wait, else null. */
  lift: { i: number; k: number } | null;
  /** Crank hold: charge share and whether the hero stands in the ring; null outside the hold. */
  hold: { k: number; inside: boolean } | null;
}

export interface TurmView {
  group: Group;
  update(s: TurmState, dt: number): void;
}

const unlit = (color: number, opacity: number): MeshBasicMaterial => new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: DoubleSide, fog: false });
const fx = <T extends Mesh>(m: T): T => { m.layers.set(FX_LAYER); m.renderOrder = 2; return m; };

/** A wedge from the hand's line `sweep` radians ahead (local frame: angle 0 is +z). */
function wedgeGeo(len: number, sweep: number): BufferGeometry {
  const n = 8, pos: number[] = [0, 0, 0];
  for (let k = 0; k <= n; k++) { const a = (sweep * k) / n; pos.push(Math.sin(a) * len, 0, Math.cos(a) * len); }
  const idx: number[] = [];
  for (let k = 1; k <= n; k++) idx.push(0, k, k + 1);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

export function buildTurmView(m: MapDef, tm: TurmMats): TurmView {
  const T = m.turm!;
  const group = new Group();
  group.name = 'turm-view';
  // Clock hands: a glowing brass bar from the centre to the tip, and a faint wedge where it will be in `HAND.warn` s.
  const hands = T.hands.map((h: HandDef) => {
    const bar = fx(new Mesh(new CylinderGeometry(h.width / 2, h.width / 2, h.len, 6, 1).rotateX(Math.PI / 2).translate(0, 0, h.len / 2).scale(1, 0.25, 1), unlit(0xffc45a, 0.9)));
    bar.position.set(h.x, 0.35, h.z);
    const sweep = (h.dir * 2 * Math.PI * 0.6) / h.period;
    const wedge = fx(new Mesh(wedgeGeo(h.len, sweep), unlit(0xffb040, 0.18)));
    wedge.position.set(h.x, 0.04, h.z);
    group.add(bar, wedge);
    return { h, bar, wedge };
  });
  // Lift rings: dim while closed, teal once the fight is won, filling while the hero waits.
  const ringGeo = new RingGeometry(LIFT.r - 0.12, LIFT.r, 40).rotateX(-Math.PI / 2);
  const fillGeo = new RingGeometry(LIFT.r - 0.5, LIFT.r - 0.14, 40, 1).rotateX(-Math.PI / 2);
  const lifts = T.lifts.map((l) => {
    const ring = fx(new Mesh(ringGeo, unlit(0x43d1cf, 0.8)));
    const fill = fx(new Mesh(fillGeo, unlit(0x43d1cf, 0.6)));
    ring.position.set(l.from.x, 0.04, l.from.z);
    fill.position.set(l.from.x, 0.05, l.from.z);
    group.add(ring, fill);
    return { l, ring, fill };
  });
  // Crank hold ring and its charge arc (draw range grows with the charge).
  const holdAt = m.encounters.findIndex((e) => e.hold), hold = m.encounters[holdAt]?.hold;
  const holdC = hold?.at ?? null;
  const holdRing = hold && holdC ? fx(new Mesh(new RingGeometry(hold.r - 0.15, hold.r, 64).rotateX(-Math.PI / 2), unlit(0xef9f27, 0.7))) : null;
  const ARC = 64;
  const holdArc = hold && holdC ? fx(new Mesh(new RingGeometry(hold.r - 0.6, hold.r - 0.2, ARC, 1).rotateX(-Math.PI / 2), unlit(0xffd27a, 0.75))) : null;
  if (holdRing && holdArc && holdC) {
    holdRing.position.set(holdC.x, 0.04, holdC.z);
    holdArc.position.set(holdC.x, 0.05, holdC.z);
    group.add(holdRing, holdArc);
  }
  // The revolving band: a lit floor ring with dark seams every 15°, turned by sim time.
  const B = T.band;
  let band: Group | null = null;
  if (B) {
    band = new Group();
    band.position.set(B.x, 0, B.z);
    const ring = new Mesh(new RingGeometry(B.r0, B.r1, 96, 1).rotateX(-Math.PI / 2), tm.band);
    const colors = new Float32Array(ring.geometry.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = 0.55; colors[i + 1] = 0.34; colors[i + 2] = 0.24; }
    ring.geometry.setAttribute('color', new BufferAttribute(colors, 3));
    ring.position.y = 0.012;
    ring.receiveShadow = true;
    const seams = new InstancedMesh(new CylinderGeometry(0.06, 0.06, B.r1 - B.r0, 4).rotateX(Math.PI / 2), tm.steel, 24);
    const one = new Matrix4();
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, r = (B.r0 + B.r1) / 2;
      seams.setMatrixAt(k, one.makeRotationY(a).setPosition(Math.sin(a) * r, 0.03, Math.cos(a) * r));
    }
    seams.receiveShadow = true;
    band.add(ring, seams);
    group.add(band);
  }

  return {
    group,
    update(s: TurmState): void {
      for (const { h, bar, wedge } of hands) {
        const a = handAngle(h, s.time), live = s.fighting && s.index === h.during;
        bar.rotation.y = a;
        wedge.rotation.y = a;
        wedge.visible = live;
        (bar.material as MeshBasicMaterial).opacity = live ? 0.95 : 0.45;
      }
      lifts.forEach(({ l, ring, fill }, i) => {
        const open = s.index > l.after;
        (ring.material as MeshBasicMaterial).color.setHex(open ? 0x43d1cf : 0x50585a);
        (ring.material as MeshBasicMaterial).opacity = open ? 0.6 + 0.3 * Math.sin(s.time * 4) : 0.35;
        const k = s.lift && s.lift.i === i ? s.lift.k : 0;
        fill.visible = k > 0;
        fill.scale.setScalar(Math.max(0.01, k));
      });
      if (holdRing && holdArc) {
        holdRing.visible = holdArc.visible = s.index === holdAt && !!s.hold;
        if (s.hold) {
          holdArc.geometry.setDrawRange(0, Math.round(ARC * s.hold.k) * 6);
          (holdRing.material as MeshBasicMaterial).opacity = s.hold.inside ? 0.9 : 0.4 + 0.4 * Math.abs(Math.sin(s.time * 5));
        }
      }
      if (band && B) band.rotation.y = bandAngle(B, s.time);
    },
  };
}
