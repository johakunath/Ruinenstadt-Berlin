// M16 Charlottenburg step 3b (engine note E5): searchlight beams over the cinemas and revue theatres of
// City West and the Ku'damm. Additive beam cones on the FX layer, sweeping as a function of time; no light.
// Cost (Ausgewogen and Leistung): one instanced draw call (5 beams × 144 triangles), hidden when the hero
// is more than 150 m from every source; no pass, no shadow. Strength follows the zone sky's lamp scale
// (full in the Premierennacht, faint at dawn).
import { AdditiveBlending, BufferAttribute, CylinderGeometry, DoubleSide, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { Landmark, MapDef } from '../data/map';
import { FX_LAYER } from './layers';

/** Which sights carry a searchlight, and the height of its roof stand (m). */
export const SEARCHLIGHTS: Partial<Record<Landmark['kind'], number>> = {
  // Only sights on the far side of their street: a beam from the camera side would cross the whole view.
  ufapalast: 16, gloriapalast: 15, revuepalast: 17, theaterwestens: 18, variete: 13,
};
const LEN = 90, OPACITY = 0.09;

export interface Searchlights {
  mesh: InstancedMesh;
  update(time: number, hx: number, hz: number): void;
  /** Lamp scale of the current sky (1.15 Premierennacht, 0.35 dawn). */
  setLamps(k: number): void;
}

export function buildSearchlights(m: MapDef): Searchlights | null {
  const src = m.landmarks.filter((l) => SEARCHLIGHTS[l.kind] !== undefined);
  if (!src.length) return null;
  // A cone from the lamp (radius 0.35) widening to 3 m, bright at the lamp, gone at the end.
  const geo = new CylinderGeometry(3.4, 0.3, LEN, 12, 6, true);
  geo.translate(0, LEN / 2, 0);
  const pos = geo.getAttribute('position'), col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.pow(1 - pos.getY(i) / LEN, 2.2);
    col.set([0.95 * k, 0.93 * k, 0.85 * k], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: OPACITY, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
  const mesh = new InstancedMesh(geo, mat, src.length);
  mesh.layers.set(FX_LAYER);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  // They lean north, away from the camera, so a beam leaves the view upward.
  const base = src.map((l, i) => ({ p: new Vector3(l.x, SEARCHLIGHTS[l.kind]!, l.z), phase: i * 2.1, speed: 0.22 + (i % 3) * 0.05, az: Math.PI }));
  const q = new Quaternion(), e = new Matrix4(), up = new Vector3(0, 1, 0), dir = new Vector3(), one = new Vector3(1, 1, 1);
  let strength = 1;
  return {
    mesh,
    update(time: number, hx: number, hz: number): void {
      mesh.visible = strength > 0.02 && base.some((b) => Math.hypot(b.p.x - hx, b.p.z - hz) < 150);
      if (!mesh.visible) return;
      base.forEach((b, i) => {
        // Sweep: the azimuth swings ±50° about north, the tilt from the vertical 12° to 30°.
        const az = b.az + Math.sin(time * b.speed + b.phase) * 0.87, tilt = 0.21 + 0.155 * (1 + Math.sin(time * b.speed * 0.7 + b.phase * 1.3));
        dir.set(Math.sin(az) * Math.sin(tilt), Math.cos(tilt), Math.cos(az) * Math.sin(tilt));
        q.setFromUnitVectors(up, dir);
        mesh.setMatrixAt(i, e.compose(b.p, q, one));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    setLamps(k: number): void {
      strength = Math.max(0, Math.min(1, (k - 0.3) / 0.85));
      mat.opacity = OPACITY * strength;
    },
  };
}
