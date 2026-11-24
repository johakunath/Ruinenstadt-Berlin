// M17 Fernsehturm (`src/data/fernsehturm.ts`, `docs/maps/fernsehturm.md`): the tower decks, look of step 2 after the
// Stillstand board (`docs/style/fernsehturm.webp`): 1969 GDR space age, worn. Orange enamel cores with brass rivets,
// clocks and gears grown into them, cobalt and yellow seats, polished dark slate, steel ribs and slanted glass on the
// north half, a knee-high sill toward the camera (no ceilings are drawn, so cores stop at the cut height 4.3 m with a
// dark lid: the V1 B cutaway is their normal state; the hero contour covers the rest).
// Static set: merged into the map chunks per material. Moving and see-through parts live in `TurmView` (FX layer,
// unlit, never in the pre-pass): clock hands with their warning wedge, lift rings, the crank ring, the glass panes,
// the revolving band (lit floor mesh turned by sim time), the city image and clouds below the sphere decks, the dark
// forum round the foyer and the green glow in the shaft. Reads sim state, never writes it.
//
// Cost (estimate, not measured; only the hero's deck is in view): about 14 to 20 merged batches per deck (its floor,
// concrete, steel, glass ribs, enamel, brass, wood, cloth, lamps, ivy cards), under 40k triangles; the view adds 3 hand
// blades with shadows and wedges, 4 lift rings, 2 hold meshes, 1 glass mesh per deck, the band (2), the city and
// clouds (2), the forum (1) and the well glow (1), each frustum-culled. Textures: five 768² floors, the band, one
// enamel tile, a dial, the city (1024²) and a cloud: about 25 MB with mips. No new light: lamps join the shared pool.
// Same on Ausgewogen and Leistung (the board look adds no pass).
import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, TorusGeometry, Vector3, type Material } from 'three';
import { apothem, deckAt, liftDoor, type DeckDef, type TurmSolid } from '../data/fernsehturm';
import type { MapDef } from '../data/map';
import { bandAngle, handAngle, LIFT, type HandDef } from '../sim/turm';
import { BOSS } from '../data/enemies';
import { FX_LAYER } from './layers';
import type { LitMaterial, Materials } from './materials';
import type { ChunkBuilder, MapMats } from './map-world';
import { buildCityView } from './turm-city';
import { paintBand, paintDeckFloor, paintDial, paintEnamel } from './turm-paint';
import { loadPaintedTexture } from './surface-textures';

type RGB = readonly [number, number, number];
type Box = (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB, ry?: number) => void;

export interface TurmMats {
  floors: Record<DeckDef['id'], LitMaterial>;
  steel: LitMaterial;
  brass: LitMaterial;
  enamel: LitMaterial;
  /** Orange enamel panels of the cores (painted, tiles round the drum). */
  core: LitMaterial;
  cloth: LitMaterial;
  lamp: LitMaterial;
  dial: LitMaterial;
  band: LitMaterial;
  ribs: LitMaterial;
}

/** Interior palette of the Stillstand board: concrete white, steel blue-grey, brass, enamel orange, cobalt, signal red. */
export function makeTurmMats(materials: Materials, decks: readonly DeckDef[]): TurmMats {
  const flat = materials.look.flatten;
  const floors = {} as Record<DeckDef['id'], LitMaterial>;
  for (const d of decks) floors[d.id] = materials.surface({ map: paintDeckFloor(d, flat), roughness: d.id === 'schacht' ? 0.85 : 0.32, metalness: d.id === 'schacht' ? 0.4 : 0.05 });
  // T11 (3): painted deck floors (local FLUX.2 klein from the canvas layouts); the Schacht grating keeps its canvas.
  const FLOOR_URL: Partial<Record<DeckDef['id'], string>> = {
    foyer: new URL('../../assets/textures/turm/floor-foyer.webp', import.meta.url).href,
    panorama: new URL('../../assets/textures/turm/floor-panorama.webp', import.meta.url).href,
    telecafe: new URL('../../assets/textures/turm/floor-telecafe.webp', import.meta.url).href,
    uhrenraum: new URL('../../assets/textures/turm/floor-uhrenraum.webp', import.meta.url).href,
  };
  for (const d of decks) {
    const url = FLOOR_URL[d.id], mat = floors[d.id];
    if (url) loadPaintedTexture(url, materials.profile.anisotropy, (t) => { mat.map?.dispose(); mat.map = t; mat.needsUpdate = true; }, false);
  }
  const core = paintEnamel('#c4521e', flat);
  core.repeat.set(8, 1);
  const coreMat = materials.surface({ map: core, roughness: 0.48 });
  // T11 (2): painted enamel core (local FLUX.2 klein); the canvas stays the fallback, same material and repeat.
  loadPaintedTexture(new URL('../../assets/textures/turm/enamel.webp', import.meta.url).href, materials.profile.anisotropy, (t) => {
    t.repeat.set(8, 1);
    coreMat.map?.dispose();
    coreMat.map = t;
    coreMat.needsUpdate = true;
  });
  // T11 (2) Telecafé cloth: the Wedding cloth map (T14, neutral off-white) under the vertex tints (white cloths, cobalt and mustard booths).
  const clothMat = materials.surface({ color: 0xffffff, roughness: 0.92, vertexColors: true });
  loadPaintedTexture(new URL('../../assets/textures/wedding/cloth.webp', import.meta.url).href, materials.profile.anisotropy, (t) => {
    clothMat.map = t;
    clothMat.needsUpdate = true;
  });
  const dialMat = materials.surface({ map: paintDial(), roughness: 0.5 });
  // T11 (2): painted clock face (local FLUX.2 klein from the canvas dial; same hands, aged enamel).
  loadPaintedTexture(new URL('../../assets/textures/turm/dial.webp', import.meta.url).href, materials.profile.anisotropy, (t) => {
    dialMat.map?.dispose();
    dialMat.map = t;
    dialMat.needsUpdate = true;
  }, false);
  return {
    floors,
    steel: materials.surface({ color: 0xffffff, roughness: 0.42, metalness: 0.55, vertexColors: true }),
    brass: materials.surface({ color: 0xc8963c, roughness: 0.32, metalness: 0.85, emissive: 0x3a2408, emissiveIntensity: 0.7 }),
    enamel: materials.surface({ color: 0xffffff, roughness: 0.45, vertexColors: true }),
    core: coreMat,
    cloth: clothMat,
    lamp: materials.surface({ color: 0xfff0d0, roughness: 0.4, emissive: 0xffc070, emissiveIntensity: 2.4 }),
    dial: dialMat,
    band: materials.surface({ map: paintBand(flat), roughness: 0.4 }),
    ribs: materials.surface({ color: 0x4a5866, roughness: 0.5, metalness: 0.6 }),
  };
}

const M = (x: number, y: number, z: number, ry = 0): Matrix4 => new Matrix4().makeRotationY(ry).setPosition(x, y, z);
/** Facing angle a points along (sin a, cos a). */
const polar = (d: { x: number; z: number }, r: number, a: number): [number, number] => [d.x + Math.sin(a) * r, d.z + Math.cos(a) * r];

const CONCRETE: RGB = [0.82, 0.8, 0.76];
const STEEL: RGB = [0.5, 0.56, 0.62];
const ENAMEL_ORANGE: RGB = [0.86, 0.42, 0.16];
const ENAMEL_BROWN: RGB = [0.42, 0.24, 0.13];
const COBALT: RGB = [0.16, 0.28, 0.62];
const YELLOW: RGB = [0.92, 0.66, 0.16];
const SIGNAL_RED: RGB = [0.8, 0.14, 0.1];
const CREAM: RGB = [0.92, 0.88, 0.8];
const SHELF: readonly RGB[] = [[0.3, 0.5, 0.7], [0.8, 0.6, 0.3], [0.7, 0.3, 0.3]];
/** Height of the window band (the room is open to the camera, no ceilings drawn). */
const WALL_H = 4.4;
const SILL_H = 0.9;
/** Core walls end at this height with a dark lid (V1 B cut height). */
export const CORE_H = 4.3;

/** A wall segment counts as the camera side (knee-high sill) when it faces south. */
const southward = (a: number): boolean => Math.cos(a) > 0.05;

/** Floor ring of a deck from `r0` to `r1` with the deck's own planar UV (so one painted texture spans every ring). */
function floorGeo(d: DeckDef, r0: number, r1: number): BufferGeometry {
  const g = d.sides ? new RingGeometry(r0, r1, d.sides, 2) : new RingGeometry(r0, r1, 72, 2);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) / d.r + 1) / 2, (1 - pos.getZ(i) / d.r) / 2);
  return g;
}

/** A flat gear: a toothed disc (cylinder with every other rim vertex pushed out), facing +z. */
function gearGeo(r: number, teeth: number, thick: number): BufferGeometry {
  const g = new CylinderGeometry(r, r, thick, teeth * 2, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z);
    if (rr < r * 0.99) continue;
    const k = Math.round(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * teeth * 2) % 2 ? 1.14 : 0.94;
    p.setXYZ(i, x * k, p.getY(i), z * k);
  }
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Static tower set into the map chunks. */
export function buildTurmWorld(m: MapDef, mats: MapMats, tm: TurmMats, chunkOf: (x: number, z: number) => ChunkBuilder): void {
  const T = m.turm!;
  for (const d of m.decks ?? []) {
    const b = chunkOf(d.x, d.z);
    const box: Box = (mat, x, y, z, sx, sy, sz, color, ry = 0) => b.box(mat, M(x, y, z, ry), sx, sy, sz, color);
    // Floor (the Telecafé's band is the view's own mesh), a darker rim along the wall.
    const band = d.id === 'telecafe' ? T.band : null;
    const hole = d.core.kind === 'well' ? d.core.r : d.core.r - 0.05, outer = d.sides ? d.r : d.r + 0.4;
    if (band) {
      b.geo(tm.floors[d.id], floorGeo(d, hole, band.r0), M(d.x, 0.01, d.z));
      b.geo(tm.floors[d.id], floorGeo(d, band.r1, outer), M(d.x, 0.01, d.z));
      b.geo(tm.brass, floorGeo(d, band.r0 - 0.08, band.r0), M(d.x, 0.02, d.z));
      b.geo(tm.brass, floorGeo(d, band.r1, band.r1 + 0.08), M(d.x, 0.02, d.z));
    } else b.geo(tm.floors[d.id], floorGeo(d, hole, outer), M(d.x, 0.01, d.z));
    if (!d.sides) b.geo(mats.tar, floorGeo(d, d.r - 0.9, d.r + 0.4), M(d.x, 0.015, d.z), [0.16, 0.14, 0.13]);

    walls(b, d, tm, mats, box);
    b.solid.captureOccluder(() => core(b, d, tm, mats, box));
    liftDoorAt(b, d, tm, mats, box);
    if (d.bar) bar(d, tm, box);
    dress(b, d, tm, mats, box);
  }
  for (const s of T.solids) solid(chunkOf(s.x, s.z), s, tm, mats);
  for (const l of T.lights) {
    const b = chunkOf(l.x, l.z);
    b.light(new Vector3(l.x, l.y, l.z), l.color, l.intensity, l.distance, 0.02, 4);
    // Only hanging lamps get a shade (candles and the shaft glow sit lower).
    if (l.y < 2.5) continue;
    // Pendant lamp: a brass shade glowing underneath, its cable running up out of view.
    b.geo(tm.brass, new ConeGeometry(0.32, 0.26, 14, 1, true), M(l.x, l.y + 0.26, l.z));
    b.geo(tm.lamp, new CircleGeometry(0.29, 14).rotateX(Math.PI / 2), M(l.x, l.y + 0.13, l.z));
    b.box(mats.iron, M(l.x, l.y + 0.75, l.z), 0.03, 0.8, 0.03, [0.1, 0.1, 0.1]);
  }
}

/** Wall faces of a deck: the polygon's sides, or 40 chords of the circle. */
function wallFaces(d: DeckDef): Array<{ a: number; r: number; len: number }> {
  if (d.sides) {
    const ap = apothem(d), side = 2 * d.r * Math.sin(Math.PI / d.sides);
    return Array.from({ length: d.sides }, (_, k) => ({ a: (k * 2 * Math.PI) / d.sides!, r: ap, len: side }));
  }
  const n = 40, len = (2 * Math.PI * d.r) / n;
  return Array.from({ length: n }, (_, k) => ({ a: ((k + 0.5) * 2 * Math.PI) / n, r: d.r, len: len + 0.06 }));
}

/** Outer wall: steel ribs (the glass is the view's) on the north half, a knee-high sill toward the camera. */
function walls(b: ChunkBuilder, d: DeckDef, tm: TurmMats, mats: MapMats, box: Box): void {
  for (const f of wallFaces(d)) {
    const [x, z] = polar(d, f.r + 0.3, f.a), ry = f.a;
    box(mats.concrete, x, SILL_H / 2, z, f.len, SILL_H, 0.6, CONCRETE, ry);
    box(tm.enamel, x, SILL_H + 0.04, z, f.len, 0.08, 0.7, d.id === 'foyer' || d.id === 'schacht' ? STEEL : ENAMEL_ORANGE, ry);
    if (southward(f.a)) continue;
    if (d.id === 'schacht') {
      // Inside the concrete shaft: a full wall, no glass.
      box(mats.concrete, x, 3, z, f.len, 6, 0.5, [0.46, 0.46, 0.44], ry);
      b.shadowBox(M(x, 3, z, ry), f.len, 6, 0.5);
      continue;
    }
    // Slanted ribs leaning out at the top, as the sphere's windows; the foyer's glass has six mullions per face.
    const ribs = d.sides ? 6 : 1;
    for (let p = 0; p < ribs; p++) {
      const t = d.sides ? (p + 0.5) / ribs - 0.5 : 0.5, px = x + Math.cos(ry) * t * f.len, pz = z - Math.sin(ry) * t * f.len;
      b.box(tm.ribs, M(px, WALL_H / 2, pz, ry).multiply(new Matrix4().makeRotationX(-0.14)), 0.18, WALL_H + 0.2, 0.28);
    }
    box(tm.steel, x + Math.sin(ry) * 0.3, WALL_H + 0.12, z + Math.cos(ry) * 0.3, f.len + 0.05, 0.24, 0.5, d.id === 'telecafe' || d.id === 'panorama' ? COBALT : STEEL, ry);
    b.shadowBox(M(x, WALL_H / 2, z, ry), f.len, WALL_H, 0.3);
  }
  if (d.sides) {
    // The foyer is a hall of folded concrete: tall piers at the corners with folded heads.
    for (let k = 0; k < d.sides; k++) {
      const a = Math.PI / d.sides + (k * 2 * Math.PI) / d.sides, [x, z] = polar(d, d.r - 0.2, a);
      const h = southward(a) ? 1.4 : 7.5;
      b.solid.captureOccluder(() => box(mats.concrete, x, h / 2, z, 1.6, h, 1.6, CONCRETE, a));
      if (!southward(a)) box(mats.concrete, x - Math.sin(a) * 1.6, h - 0.6, z - Math.cos(a) * 1.6, 1.2, 1.2, 4.2, [0.7, 0.68, 0.64], a);
    }
  }
}

/** The core: enamel drum with clocks and gears (solid), the open well with its railing, the low brass movement. */
function core(b: ChunkBuilder, d: DeckDef, tm: TurmMats, mats: MapMats, box: Box): void {
  const r = d.core.r;
  if (d.core.kind === 'solid') {
    const foyer = d.id === 'foyer';
    b.geo(foyer ? mats.concrete : tm.core, new CylinderGeometry(r, r, CORE_H, 48, 1, true), M(d.x, CORE_H / 2, d.z), foyer ? CONCRETE : undefined);
    b.geo(tm.enamel, new CylinderGeometry(r + 0.05, r + 0.05, 0.4, 48, 1, true), M(d.x, 2.9, d.z), foyer ? COBALT : ENAMEL_BROWN);
    b.geo(tm.brass, new TorusGeometry(r + 0.02, 0.07, 6, 48).rotateX(Math.PI / 2), M(d.x, CORE_H - 0.05, d.z));
    b.geo(tm.brass, new TorusGeometry(r + 0.02, 0.06, 6, 48).rotateX(Math.PI / 2), M(d.x, 0.12, d.z));
    b.geo(mats.tar, new CircleGeometry(r, 48).rotateX(-Math.PI / 2), M(d.x, CORE_H, d.z), [0.1, 0.1, 0.1]);
    b.shadowBox(M(d.x, CORE_H / 2, d.z), r * 1.6, CORE_H, r * 1.6);
    if (foyer) return;
    // Clocks and gears of the Zeitnormal grown through the enamel (board 1), clear of the lift door.
    for (const [a, y, s] of [[-0.9, 2.6, 0.75], [0.95, 3.2, 0.55], [1.6, 2.1, 0.65], [-1.7, 3.3, 0.5], [2.6, 2.6, 0.7], [-2.5, 2.2, 0.6]] as const) {
      const [x, z] = polar(d, r + 0.06, a);
      b.geo(tm.brass, new CylinderGeometry(s + 0.08, s + 0.08, 0.1, 28).rotateX(Math.PI / 2), M(x, y, z, a));
      b.geo(tm.dial, new CircleGeometry(s, 28), M(x, y, z, a).multiply(M(0, 0, 0.06)));
    }
    for (const [a, y, s] of [[-0.55, 1.4, 0.9], [0.6, 1.7, 0.7], [1.25, 3.6, 0.8], [-1.25, 3.7, 0.6]] as const) {
      const [x, z] = polar(d, r + 0.05, a);
      b.geo(tm.brass, gearGeo(s, 12, 0.12), M(x, y, z, a));
    }
  } else if (d.core.kind === 'well') {
    // The open shaft: a dark wall down to the jungle glow far below, the gallery edge and a brass railing.
    b.geo(mats.concrete, new CylinderGeometry(r, r, 9, 40, 1, true).scale(-1, 1, 1), M(d.x, -4.5, d.z), [0.24, 0.26, 0.24]);
    b.geo(tm.enamel, new CylinderGeometry(r - 0.02, r - 0.02, 0.2, 40, 1, true).scale(-1, 1, 1), M(d.x, -0.1, d.z), YELLOW);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2, [x, z] = polar(d, r + 0.15, a);
      if (Math.cos(a) > 0.92) continue;
      box(tm.brass, x, 0.55, z, 0.06, 1.1, 0.06);
    }
    b.geo(tm.brass, new TorusGeometry(r + 0.15, 0.05, 6, 48).rotateX(Math.PI / 2), M(d.x, 1.1, d.z));
    b.geo(tm.brass, new TorusGeometry(r + 0.15, 0.03, 6, 48).rotateX(Math.PI / 2), M(d.x, 0.6, d.z));
    // Cables hanging into the well.
    for (const [a, len] of [[0.6, 7], [2.2, 8], [3.6, 6], [4.8, 8]] as const) {
      const [x, z] = polar(d, r - 0.6, a);
      box(mats.rubber, x, -len / 2 + 1.5, z, 0.08, len, 0.08, [0.1, 0.1, 0.1]);
    }
  } else {
    // The movement under the dome: a low brass drum with gear trains on top and an empty socket for the Unruh.
    b.geo(tm.brass, new CylinderGeometry(r, r * 1.05, 1.2, 48), M(d.x, 0.6, d.z));
    b.geo(mats.iron, new CylinderGeometry(r * 0.92, r * 0.92, 0.12, 40), M(d.x, 1.26, d.z), [0.18, 0.17, 0.16]);
    for (const [ox, oz, s] of [[-1.6, -0.8, 1.1], [1.2, -1.5, 0.9], [1.5, 1.0, 1.2], [-1.2, 1.6, 0.8], [0, 0, 0.7]] as const) {
      b.geo(tm.brass, gearGeo(s, 14, 0.18).rotateX(-Math.PI / 2), M(d.x + ox, 1.42, d.z + oz));
    }
    b.geo(mats.tar, new CylinderGeometry(0.5, 0.5, 0.08, 20), M(d.x, 1.55, d.z), [0.05, 0.05, 0.05]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6, [x, z] = polar(d, r + 0.03, a);
      b.geo(tm.dial, new CircleGeometry(0.42, 20), M(x, 0.62, z, a));
    }
  }
}

/** Lift door on the south face of the core: brass frame, steel leaves, portholes, the red lamp; the foyer's has six gear sockets. */
function liftDoorAt(b: ChunkBuilder, d: DeckDef, tm: TurmMats, mats: MapMats, box: Box): void {
  const door = liftDoor(d);
  box(tm.brass, door.x, 1.3, door.z + 0.1, 2.5, 2.6, 0.24);
  box(tm.steel, door.x, 1.2, door.z + 0.24, 1.9, 2.4, 0.06, [0.34, 0.38, 0.42]);
  box(mats.iron, door.x, 1.2, door.z + 0.28, 0.04, 2.4, 0.02, [0.06, 0.06, 0.06]);
  box(tm.lamp, door.x, 2.76, door.z + 0.26, 0.5, 0.16, 0.12, SIGNAL_RED);
  if (d.core.kind !== 'solid') return;
  // Portholes (the foyer: six empty gear sockets), three on each side of the door.
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const a = s * (0.36 + 0.02 * k), [x, z] = polar(d, d.core.r + 0.04, a), y = 0.75 + k * 0.7;
    b.geo(tm.brass, new TorusGeometry(0.2, 0.05, 6, 16), M(x, y, z, a));
    b.geo(d.id === 'foyer' ? mats.tar : tm.dial, new CircleGeometry(0.17, 16), M(x, y, z, a).multiply(M(0, 0, 0.01)), d.id === 'foyer' ? [0.05, 0.05, 0.05] : undefined);
  }
}

/** Telecafé bar: a curved counter on the north side of the core, brass top, shelves behind. */
function bar(d: DeckDef, tm: TurmMats, box: Box): void {
  const B = d.bar!;
  const n = 10;
  for (let k = 0; k < n; k++) {
    const a = B.a - B.half + ((k + 0.5) / n) * 2 * B.half, len = ((2 * B.half) / n) * B.r1 + 0.05;
    const [x, z] = polar(d, B.r1 - 0.4, a);
    box(tm.enamel, x, 0.55, z, len, 1.1, 0.8, ENAMEL_BROWN, a);
    box(tm.brass, x, 1.13, z, len, 0.06, 0.9, undefined, a);
    const [bx, bz] = polar(d, B.r0 + 0.4, a);
    box(tm.enamel, bx, 1.2, bz, len * 0.6, 2.4, 0.4, k % 2 ? ENAMEL_ORANGE : COBALT, a);
  }
}

/** Per deck dressing from the board: ivy, cable trays, booths, benches, gear seats. */
function dress(b: ChunkBuilder, d: DeckDef, tm: TurmMats, mats: MapMats, box: Box): void {
  const ivy = new PlaneGeometry(1.2, 1.6);
  const vine = (a: number, r: number, y: number, s = 1): void => {
    const [x, z] = polar(d, r, a);
    b.cards.of(mats.ivy).add(ivy, M(x, y, z, a + Math.PI).multiply(new Matrix4().makeScale(s, s, 1)), [0.7, 0.95, 0.6]);
  };
  switch (d.id) {
    case 'foyer':
      for (const a of [2.4, 3.3, 3.9]) vine(a, apothem(d) - 0.1, 2.2, 1.3);
      break;
    case 'schacht':
      // Urzeit vines climb the west wall, 2089 cable trays glow on the east wall.
      for (let k = 0; k < 9; k++) vine(3.2 + k * 0.2, d.r - 0.1, 1.2 + (k % 3) * 1.3, 1.4);
      for (const y of [2.2, 3.4]) for (let k = 0; k < 6; k++) {
        const a = 1.7 + k * 0.17, [x, z] = polar(d, d.r - 0.15, a);
        box(tm.steel, x, y, z, 2.2, 0.12, 0.3, [0.2, 0.22, 0.24], a);
        box(tm.lamp, x, y + 0.08, z, 2, 0.04, 0.06, k % 2 ? [0.9, 0.2, 0.9] : [0.2, 0.9, 1]);
      }
      vine(5.6, d.core.r + 0.3, 0.3, 0.9);
      vine(0.9, d.core.r + 0.3, 0.3, 0.8);
      break;
    case 'panorama':
      // Cobalt benches along the sill between the telescopes.
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, [x, z] = polar(d, d.r - 0.35, a);
        if (Math.cos(a) > 0.6) continue;
        box(tm.cloth, x, 0.42, z, 2.2, 0.16, 0.55, COBALT, a);
        box(tm.cloth, x + Math.sin(a) * 0.25, 0.75, z + Math.cos(a) * 0.25, 2.2, 0.6, 0.14, COBALT, a);
      }
      vine(3.1, d.r - 0.1, 2.6, 1.4);
      break;
    case 'telecafe':
      // Upholstered booths against the glass behind the tables: cobalt, mustard and red.
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6 + Math.PI / 12, [x, z] = polar(d, d.r - 0.3, a);
        if (Math.cos(a) > 0.75) continue;
        const col = [COBALT, YELLOW, [0.66, 0.16, 0.14] as RGB][k % 3]!;
        box(tm.cloth, x, 0.45, z, 1.8, 0.2, 0.6, col, a);
        box(tm.cloth, x + Math.sin(a) * 0.28, 0.85, z + Math.cos(a) * 0.28, 1.8, 0.8, 0.18, col, a);
      }
      vine(3.6, d.r - 0.1, 3, 1.2);
      break;
    case 'uhrenraum':
      // Six empty gear seats round the movement (the dome is not drawn: no ceilings).
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3, [x, z] = polar(d, 6, a);
        b.geo(tm.brass, new TorusGeometry(0.55, 0.08, 6, 20).rotateX(Math.PI / 2), M(x, 0.08, z));
        b.geo(mats.tar, new CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), M(x, 0.05, z), [0.06, 0.05, 0.04]);
      }
      break;
  }
}

/** One piece of furniture. */
function solid(b: ChunkBuilder, s: TurmSolid, tm: TurmMats, mats: MapMats): void {
  const box = (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: RGB): void => b.box(mat, M(s.x, 0, s.z, s.rot).multiply(M(x, y, z)), sx, sy, sz, color);
  switch (s.what) {
    case 'counter':
      box(tm.enamel, 0, 0.55, 0, s.hx * 2, 1.1, s.hz * 2, ENAMEL_ORANGE);
      box(mats.wood, 0, 1.13, 0, s.hx * 2 + 0.1, 0.06, s.hz * 2 + 0.1, [0.5, 0.35, 0.2]);
      // The kiosk roof: red and cream stripes over the booth, a warm strip light under it.
      for (let k = 0; k < 6; k++) box(tm.cloth, -s.hx + (k + 0.5) * ((s.hx * 2 + 0.6) / 6) - 0.3, 2.75, -1.1, (s.hx * 2 + 0.6) / 6, 0.12, 3.2, k % 2 ? CREAM : SIGNAL_RED);
      box(tm.lamp, 0, 2.55, -0.2, 1.6, 0.06, 0.1);
      break;
    case 'shelf':
      box(mats.wood, 0, 1, 0, s.hx * 2, 2, s.hz * 2, [0.42, 0.3, 0.2]);
      for (const y of [0.7, 1.15, 1.6]) for (let k = 0; k < 6; k++) box(tm.cloth, -s.hx + 0.4 + k * ((s.hx * 2 - 0.8) / 5), y, 0.22, 0.3, 0.3, 0.05, SHELF[k % 3]);
      break;
    case 'kiosk':
      box(tm.enamel, 0, 1.3, 0, s.hx * 2, 2.6, s.hz * 2, COBALT);
      break;
    case 'bench':
      box(tm.cloth, 0, 0.42, 0, s.hx * 2, 0.14, s.hz * 2, COBALT);
      box(tm.steel, 0, 0.2, 0, s.hx * 1.8, 0.4, 0.1, STEEL);
      break;
    case 'telescope':
      b.geo(tm.brass, new CylinderGeometry(0.07, 0.16, 1.1, 10), M(s.x, 0.55, s.z));
      b.geo(tm.brass, new CylinderGeometry(0.13, 0.19, 0.9, 12).rotateX(Math.PI / 2 - 0.3), M(s.x, 1.25, s.z, s.rot));
      break;
    case 'table':
      b.geo(tm.cloth, new CylinderGeometry(s.hx, s.hx, 0.06, 18), M(s.x, 0.78, s.z), [0.94, 0.9, 0.82]);
      b.geo(tm.cloth, new CylinderGeometry(s.hx + 0.02, s.hx + 0.1, 0.55, 18, 1, true), M(s.x, 0.5, s.z), [0.86, 0.82, 0.74]);
      // A candle glass and three champagne glasses, raised mid-toast.
      b.geo(tm.lamp, new CylinderGeometry(0.06, 0.06, 0.14, 8), M(s.x, 0.88, s.z));
      for (const k of [0, 1, 2]) {
        const [x, z] = polar(s, s.hx * 0.55, s.rot + (k * 2 * Math.PI) / 3);
        b.geo(tm.brass, new CylinderGeometry(0.05, 0.02, 0.18, 8), M(x, 0.92, z));
      }
      break;
    case 'crank':
      box(tm.steel, 0, 0.6, 0, s.hx * 2, 1.2, s.hz * 2, [0.32, 0.3, 0.3]);
      b.geo(tm.enamel, new TorusGeometry(0.42, 0.05, 6, 18), M(s.x, 1.25, s.z, s.rot).multiply(M(0, 0, 0.45)), SIGNAL_RED);
      box(tm.enamel, 0, 1.25, 0.45, 0.05, 0.8, 0.05, SIGNAL_RED);
      break;
    case 'switch':
      box(tm.steel, 0, 0.9, 0, s.hx * 2, 1.8, s.hz * 2, [0.3, 0.28, 0.26]);
      box(tm.brass, 0, 1.3, 0.42, 1.1, 0.5, 0.04);
      box(tm.enamel, 0.1, 1.7, 0.5, 0.1, 0.6, 0.1, SIGNAL_RED);
      box(tm.lamp, -0.4, 1.55, 0.45, 0.14, 0.14, 0.05, SIGNAL_RED);
      break;
    case 'console':
      box(tm.enamel, 0, 0.5, 0, s.hx * 2, 1, s.hz * 2, ENAMEL_BROWN);
      box(tm.lamp, 0, 1.02, 0.1, 0.6, 0.03, 0.15, [0.5, 0.9, 0.7]);
      break;
  }
}

// ---------------------------------------------------------------- moving and see-through parts

/** What the view needs from the sim (the renderer builds it each frame). */
export interface TurmState {
  time: number;
  /** Hero position (which deck is in view). */
  x: number;
  z: number;
  /** Current encounter index and whether its fight runs (hands hurt only then). */
  index: number;
  fighting: boolean;
  /** Lift ring the hero stands in and the share of the wait, else null. */
  lift: { i: number; k: number } | null;
  /** Crank hold: charge share and whether the hero stands in the ring; null outside the hold. */
  hold: { k: number; inside: boolean } | null;
  /** Der Zeitwart's gear hold (T9): the seat, the charge share; null outside it. */
  gear: { x: number; z: number; k: number } | null;
  /** The ending choice (T10): open, and the ring the hero waits in with the share of the wait. */
  choice: { open: boolean; id: string | null; k: number };
  /** Der Zeitwart's third phase turns the hands faster from then on. */
  boost: { t: number; k: number } | null;
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

/** Clock hand: a long brass blade with a counterweight stub and an arrow tip, along +z from the centre. */
function handGeo(len: number, width: number): BufferGeometry {
  const w = width / 2;
  const pos = [-w * 0.5, 0, -1.6, w * 0.5, 0, -1.6, w, 0, 0, -w, 0, 0, w * 0.6, 0, len - 1.6, -w * 0.6, 0, len - 1.6, w * 1.6, 0, len - 1.4, -w * 1.6, 0, len - 1.4, 0, 0, len];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4, 3, 4, 5, 7, 6, 8]);
  return g;
}

/** Sky tint of the city and the clouds per sphere deck (before dawn, first light, the sun on the horizon). */
const CITY_TINT: Partial<Record<DeckDef['id'], [number, number]>> = {
  panorama: [0x8a98d8, 0x6a78b0], telecafe: [0xf0c4cc, 0xffd8dc], uhrenraum: [0xffe2b0, 0xfff0c8],
};

export function buildTurmView(m: MapDef, tm: TurmMats): TurmView {
  const T = m.turm!, decks = m.decks ?? [];
  const group = new Group();
  group.name = 'turm-view';
  // Clock hands: a glowing brass blade at waist height, its shadow on the floor and a faint wedge where it will be in 0.6 s.
  const hands = T.hands.map((h: HandDef) => {
    const blade = fx(new Mesh(handGeo(h.len, h.width), unlit(0xffc45a, 0.9)));
    blade.position.set(h.x, 1.25, h.z);
    const sweep = (h.dir * 2 * Math.PI * 0.6) / h.period;
    const wedge = fx(new Mesh(wedgeGeo(h.len, sweep), unlit(0xffb040, 0.16)));
    wedge.position.set(h.x, 0.04, h.z);
    const shadow = fx(new Mesh(handGeo(h.len, h.width * 1.2), unlit(0x1a0c00, 0.35)));
    shadow.position.set(h.x, 0.03, h.z);
    group.add(blade, wedge, shadow);
    return { h, blade, wedge, shadow };
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
  const ARC = 64;
  const holdRing = hold && holdC ? fx(new Mesh(new RingGeometry(hold.r - 0.15, hold.r, 64).rotateX(-Math.PI / 2), unlit(0xef9f27, 0.7))) : null;
  const holdArc = hold && holdC ? fx(new Mesh(new RingGeometry(hold.r - 0.6, hold.r - 0.2, ARC, 1).rotateX(-Math.PI / 2), unlit(0xffd27a, 0.75))) : null;
  if (holdRing && holdArc && holdC) {
    holdRing.position.set(holdC.x, 0.04, holdC.z);
    holdArc.position.set(holdC.x, 0.05, holdC.z);
    group.add(holdRing, holdArc);
  }
  // Der Zeitwart's gear hold: the seat's ring (T9, radius `BOSS.zeitwart.hold.r`) and its charge arc.
  const GR = BOSS.zeitwart.hold.r;
  const gearRing = fx(new Mesh(new RingGeometry(GR - 0.15, GR, 64).rotateX(-Math.PI / 2), unlit(0xffd27a, 0.8)));
  const gearArc = fx(new Mesh(new RingGeometry(GR - 0.6, GR - 0.2, ARC, 1).rotateX(-Math.PI / 2), unlit(0xffe8a0, 0.8)));
  gearRing.visible = gearArc.visible = false;
  group.add(gearRing, gearArc);
  // The ending rings at the main switch (T10): gold for „Uhr stellen“ (the sunrise), night blue for „Stehen lassen“.
  const endings = T.ending.map((q) => {
    const ring = fx(new Mesh(new RingGeometry(q.r + 0.1, q.r + 0.25, 40).rotateX(-Math.PI / 2), unlit(q.id === 'gestellt' ? 0xffc040 : 0x5a8aff, 0.85)));
    const fill = fx(new Mesh(new CircleGeometry(q.r, 32).rotateX(-Math.PI / 2), unlit(q.id === 'gestellt' ? 0xffd870 : 0x8ab0ff, 0.45)));
    ring.position.set(q.x, 0.05, q.z);
    fill.position.set(q.x, 0.04, q.z);
    ring.visible = fill.visible = false;
    group.add(ring, fill);
    return { q, ring, fill };
  });

  // Glass of the north windows: one see-through mesh per deck, slanted out like the ribs.
  const glassMat = new MeshBasicMaterial({ color: 0x9cc8dc, transparent: true, opacity: 0.12, depthWrite: false, side: DoubleSide });
  for (const d of decks) {
    if (d.id === 'schacht') continue;
    const pos: number[] = [], idx: number[] = [];
    for (const f of wallFaces(d)) {
      if (southward(f.a)) continue;
      const [x, z] = polar(d, f.r + 0.3, f.a), c = Math.cos(f.a), s = Math.sin(f.a), out = Math.sin(0.14) * (WALL_H - SILL_H);
      const h = f.len / 2, n = pos.length / 3;
      for (const [u, y, o] of [[-h, SILL_H, 0], [h, SILL_H, 0], [h, WALL_H, out], [-h, WALL_H, out]] as const) pos.push(x + c * u + s * o, y, z - s * u + c * o);
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    const glass = fx(new Mesh(g, glassMat));
    glass.renderOrder = 3;
    group.add(glass);
  }
  // The revolving band: a lit parquet ring with brass seams, turned by sim time.
  const B = T.band;
  let band: Group | null = null;
  if (B) {
    band = new Group();
    band.position.set(B.x, 0, B.z);
    const ring = new Mesh(new RingGeometry(B.r0, B.r1, 96, 1).rotateX(-Math.PI / 2), tm.band);
    ring.position.y = 0.012;
    ring.receiveShadow = true;
    const seams = new InstancedMesh(new CylinderGeometry(0.05, 0.05, B.r1 - B.r0, 4).rotateX(Math.PI / 2), tm.brass, 12);
    const one = new Matrix4();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, r = (B.r0 + B.r1) / 2;
      seams.setMatrixAt(k, one.makeRotationY(a).setPosition(Math.sin(a) * r, 0.025, Math.cos(a) * r));
    }
    seams.receiveShadow = true;
    band.add(ring, seams);
    group.add(band);
  }
  // The city far below the sphere decks, the dark forum round the foyer, the green glow in the shaft.
  const city = buildCityView();
  group.add(city.group);
  const foyer = decks.find((d) => d.id === 'foyer'), shaft = decks.find((d) => d.core.kind === 'well');
  if (foyer) {
    const forum = new Mesh(new PlaneGeometry(140, 140).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x0e1214 }));
    forum.position.set(foyer.x, -0.05, foyer.z);
    forum.layers.set(FX_LAYER);
    group.add(forum);
  }
  if (shaft) {
    const glow = fx(new Mesh(new CircleGeometry(shaft.core.r, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0x3cff7a, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, fog: false })));
    glow.position.set(shaft.x, -8.9, shaft.z);
    group.add(glow);
  }
  let deckId: DeckDef['id'] | null = null;

  return {
    group,
    update(s: TurmState): void {
      const d = deckAt(decks, s.x, s.z) ?? decks.find((q) => Math.abs(q.x - s.x) < 60) ?? null;
      if (d && d.id !== deckId) {
        deckId = d.id;
        const tint = CITY_TINT[d.id];
        city.place(d.x, d.z, !!tint, tint?.[0] ?? 0xffffff, tint?.[1] ?? 0xffffff);
      }
      city.update(s.time);
      for (const { h, blade, wedge, shadow } of hands) {
        const a = handAngle(h, s.time, s.boost), live = s.fighting && s.index === h.during;
        blade.rotation.y = wedge.rotation.y = shadow.rotation.y = a;
        wedge.visible = live;
        (blade.material as MeshBasicMaterial).opacity = live ? 0.95 : 0.5;
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
      gearRing.visible = gearArc.visible = !!s.gear;
      if (s.gear) {
        gearRing.position.set(s.gear.x, 0.06, s.gear.z);
        gearArc.position.set(s.gear.x, 0.07, s.gear.z);
        gearArc.geometry.setDrawRange(0, Math.round(ARC * s.gear.k) * 6);
        (gearRing.material as MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(s.time * 6);
      }
      for (const { q, ring, fill } of endings) {
        ring.visible = fill.visible = s.choice.open;
        const k = s.choice.id === q.id ? s.choice.k : 0;
        fill.scale.setScalar(Math.max(0.05, k));
        (ring.material as MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(s.time * 3);
      }
    },
  };
}
