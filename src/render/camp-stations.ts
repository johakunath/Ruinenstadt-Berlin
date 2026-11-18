// M20: the seven camp stations as they are built (`docs/mockups/m20-camp-combined.svg`): a build
// site (level 0: rubble, barrier tape, a "Bauplatz" board) and three levels that each add parts,
// light and life; level 2 brings the keeper (2D rule). Rebuilt only when a level or a keeper changes.
// Lights: the stations' light spots are fixed in `camp-world.ts` (constant pool); here only emissive
// parts and additive glow cards. Rings mark where a station opens; the one in reach pulses.
import { AdditiveBlending, CircleGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, RingGeometry, type Material } from 'three';
import type { StationId } from '../data/camp';
import { YARD_H, type CampLayout, type CampPlace, type StationSpot } from '../data/camp-map';
import type { CharacterAssets } from './characters';
import { Builder, makeMats, type Mats } from './world';
import type { Materials } from './materials';

export interface CampStationState { level: number; npc: boolean }
export type CampStates = Record<StationId, CampStationState>;

type RGB = readonly [number, number, number];

/** Station frame: local x across the front, local z toward the ring (facing), y up from its floor. */
function frame(s: StationSpot): (x: number, y: number, z: number, ry?: number) => Matrix4 {
  const y0 = s.inside ? 0 : YARD_H;
  return (x, y, z, ry = 0) => new Matrix4().makeRotationY(s.rot).setPosition(s.x, y0, s.z).multiply(new Matrix4().makeRotationY(ry).setPosition(x, y, z));
}

/**
 * Placeholder art: a body that grows with the level. `camp-stations` art pass replaces `buildStation`.
 * Every station stays inside its footprint (w × d, the sim collider).
 */
export function buildStation(b: Builder, s: StationSpot, st: CampStationState): void {
  const f = frame(s), m = b.mats;
  const box = (mat: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, c?: RGB): void => b.box(mat, f(x, y, z), sx, sy, sz, c);
  if (st.level === 0) {
    for (let i = 0; i < 5; i++) box(m.stucco, -s.w / 3 + (i * s.w) / 7, 0.3, (i % 2) * 0.6 - 0.3, 1.4, 0.6, 1.2, [0.4, 0.38, 0.35]);
    box(m.plaster.cream ?? m.stucco, 0, 1.1, s.d / 2 - 0.2, 1.4, 0.7, 0.05, [1.3, 0.35, 0.25]);
    return;
  }
  box(m.wood, 0, 0.45, 0, s.w * 0.6, 0.9, s.d * 0.5, [0.8, 0.7, 0.6]);
  if (st.level >= 2) box(m.iron, 0, 1.8, -s.d * 0.3, s.w * 0.8, 1.8, 0.2, [0.4, 0.4, 0.4]);
  if (st.level >= 3) box(m.sign, 0, 3.2, -s.d * 0.3, s.w * 0.5, 0.6, 0.1);
}

export class CampStationsView {
  readonly group = new Group();
  private readonly mats: Mats;
  private readonly bodies = new Map<StationId, Group>();
  private readonly built = new Map<StationId, string>();
  private readonly rings: Array<{ place: CampPlace; mesh: Mesh; mat: MeshBasicMaterial }> = [];

  constructor(_assets: CharacterAssets, private readonly materials: Materials, private readonly layout: CampLayout) {
    this.mats = makeMats(materials);
    for (const place of layout.places) {
      const station = layout.stations.find((s) => s.id === place.id);
      const y = !station || station.inside ? 0.06 : YARD_H + 0.06;
      const color = place.id === 'abfahrt' ? 0x7dd3ff : 0xef9f27;
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false });
      const mesh = new Mesh(new RingGeometry(place.r - 0.12, place.r, 40), mat);
      mesh.add(new Mesh(new CircleGeometry(place.r - 0.12, 40), new MeshBasicMaterial({ color, transparent: true, opacity: 0.07, depthWrite: false })));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(place.x, y, place.z);
      this.group.add(mesh);
      this.rings.push({ place, mesh, mat });
    }
  }

  update(states: CampStates, time: number, near: CampPlace['id'] | null): void {
    for (const s of this.layout.stations) {
      const st = states[s.id];
      const key = `${st.level}/${st.npc ? 1 : 0}`;
      if (this.built.get(s.id) === key) continue;
      this.built.set(s.id, key);
      const old = this.bodies.get(s.id);
      if (old) { this.group.remove(old); old.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose(); }); }
      const b = new Builder(this.mats);
      buildStation(b, s, st);
      const g = new Group();
      for (const mesh of b.solid.meshes()) { mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); }
      for (const mesh of b.cards.meshes()) g.add(mesh);
      for (const o of b.extras) g.add(o);
      this.bodies.set(s.id, g);
      this.group.add(g);
    }
    for (const r of this.rings) {
      const on = r.place.id === near;
      r.mat.opacity = on ? 0.75 + 0.2 * Math.sin(time * 6) : 0.38 + 0.12 * Math.sin(time * 2 + r.place.x);
      r.mesh.scale.setScalar(on ? 1.06 : 1);
    }
    void this.materials;
  }
}
