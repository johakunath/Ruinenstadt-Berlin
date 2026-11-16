// Ground loot visuals (M4, variant B of the drop mockups): a faceted crystal per drop with a soft ground
// glow and ring in the rarity color, and a light beam for rare and better. Everything is instanced:
// three draw calls in total, no light sources (the light count must stay constant).
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { dropColor } from '../sim/loot';
import type { Sim } from '../sim/types';
import { groundY } from './ground';
import { FX_LAYER } from './world';

const CAP = 160;
/** Soft disc with a thin ring near the edge. */
function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 64, 41, 0, Math.PI * 2);
  g.stroke();
  return new CanvasTexture(c);
}

/** Vertical fade for the beam: bright at the foot, gone at the top, soft at the sides. */
function beamTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(1, 'rgba(255,255,255,0.85)');
  g.fillStyle = v;
  g.fillRect(0, 0, 32, 128);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 32, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 32, 128);
  return new CanvasTexture(c);
}

/** Two crossed quads, 1 m tall, foot at y = 0. */
function beamGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const w = 0.22;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let q = 0; q < 2; q++) {
    const a = q * (Math.PI / 2);
    const dx = Math.cos(a) * w;
    const dz = Math.sin(a) * w;
    const b = pos.length / 3;
    pos.push(-dx, 0, -dz, dx, 0, dz, dx, 1, dz, -dx, 1, -dz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class LootView {
  readonly group = new Group();
  private readonly crystals: InstancedMesh;
  private readonly glows: InstancedMesh;
  private readonly beams: InstancedMesh;
  private readonly m4 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly pos = new Vector3();
  private readonly scale = new Vector3();
  private readonly axisY = new Vector3(0, 1, 0);
  private readonly color = new Color();

  constructor() {
    // 6-sided double pyramid: a sphere with six segments and one ring.
    const geo = new SphereGeometry(0.2, 6, 2);
    geo.scale(1, 1.55, 1);
    const mat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0, flatShading: true });
    // The emissive part takes the instance color, so the crystal itself glows in its rarity color.
    mat.onBeforeCompile = (s): void => {
      s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.rgb;');
    };
    this.crystals = new InstancedMesh(geo, mat, CAP);
    this.crystals.frustumCulled = false;
    this.crystals.castShadow = false;

    const flat = new PlaneGeometry(1, 1);
    flat.rotateX(-Math.PI / 2);
    const glowMat = new MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.9 });
    this.glows = new InstancedMesh(flat, glowMat, CAP);
    this.glows.frustumCulled = false;
    this.glows.layers.set(FX_LAYER);
    this.glows.renderOrder = 3;

    const beamMat = new MeshBasicMaterial({ map: beamTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.beams = new InstancedMesh(beamGeometry(), beamMat, CAP);
    this.beams.frustumCulled = false;
    this.beams.layers.set(FX_LAYER);
    this.beams.renderOrder = 3;

    for (const m of [this.crystals, this.glows, this.beams]) {
      m.count = 0;
      m.setColorAt(0, this.color.set('#ffffff'));
      this.group.add(m);
    }
  }

  update(sim: Sim, time: number): void {
    let n = 0;
    let beams = 0;
    for (const d of sim.drops) {
      if (n >= CAP) break;
      const c = d.content;
      const rarity = c.kind === 'item' ? c.item.rarity : -1;
      const set = c.kind === 'item' && !!c.item.set;
      const y0 = groundY(d.x, d.z);
      const small = c.kind === 'item' ? 1 : 0.7;
      // Spin and bob once it lies on the ground; the pop arc raises it while in the air.
      const bob = d.landed ? 0.42 + 0.06 * Math.sin(time * 2.4 + d.id) : 0.42;
      this.pos.set(d.x, y0 + bob + d.h, d.z);
      this.q.setFromAxisAngle(this.axisY, time * 1.3 + d.id);
      this.scale.setScalar(small);
      this.crystals.setMatrixAt(n, this.m4.compose(this.pos, this.q, this.scale));
      const base = new Color(dropColor(d));
      this.crystals.setColorAt(n, this.color.copy(base).multiplyScalar(0.85));

      // Ground glow and ring: bigger and brighter with rarity; only once it lies still.
      const pulse = 1 + 0.08 * Math.sin(time * 4 + d.id);
      const size = (0.9 + 0.35 * Math.max(0, rarity) + (set ? 0.35 : 0)) * pulse * (d.landed ? 1 : 0.6);
      this.pos.set(d.x, y0 + 0.05, d.z);
      this.q.identity();
      this.scale.set(size * 1.4, 1, size * 1.4);
      this.glows.setMatrixAt(n, this.m4.compose(this.pos, this.q, this.scale));
      this.glows.setColorAt(n, this.color.copy(base).multiplyScalar(rarity >= 1 || set || c.kind !== 'item' ? 1 : 0.55));

      if ((rarity >= 2 || set) && d.landed) {
        const h = rarity >= 3 ? 6 : 2.6;
        this.pos.set(d.x, y0, d.z);
        this.scale.set(1, h, 1);
        this.beams.setMatrixAt(beams, this.m4.compose(this.pos, this.q, this.scale));
        this.beams.setColorAt(beams, this.color.copy(base).multiplyScalar(rarity >= 3 ? 1.5 : 1));
        beams++;
      }
      n++;
    }
    this.crystals.count = this.glows.count = n;
    this.beams.count = beams;
    for (const m of [this.crystals, this.glows, this.beams]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
