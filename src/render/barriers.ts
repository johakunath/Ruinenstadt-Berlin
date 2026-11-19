// P25 Der Türsteher's neon bars at the Brandenburger Tor (`src/sim/barriers.ts`): a pink ground strip
// across each passage during the wind-up, then three glowing horizontal tubes while shut.
// Cost: two instanced draw calls (strip, tubes) while shown, none when idle; unlit, additive, no
// lights (the light count stays constant), no shadows, FX_LAYER (not in the normal/depth pre-pass). Both profiles.
import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { BOSS } from '../data/enemies';
import { PLAYER } from '../data/combat';
import type { BarrierDef } from '../sim/level';
import type { Sim } from '../sim/types';
import { groundY } from './ground';
import { FX_LAYER } from './layers';
import { canvas } from './paint';

const PINK = 0xff4fa3;
/** Tube heights above the ground (m) and radius; thick enough to read from the follow camera (look check). */
const TUBES = [0.5, 1.2, 1.9];
const TUBE_R = 0.07;
/** Strip depth across the bar plane: the hit band (bar half depth 0.3 plus the hero radius) on both sides. */
const STRIP = 2 * (0.3 + PLAYER.radius);
const FADE = 0.2;

/** Soft band, bright along the bar line, fading to both edges (additive: black is see-through). */
function stripTexture(): CanvasTexture {
  const [c, ctx] = canvas(4, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.3, 'rgb(90,25,55)');
  g.addColorStop(0.47, 'rgb(255,140,200)');
  g.addColorStop(0.53, 'rgb(255,140,200)');
  g.addColorStop(0.7, 'rgb(90,25,55)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class BarrierView {
  readonly group = new Group();
  private readonly strip: InstancedMesh;
  private readonly tubes: InstancedMesh;
  private readonly stripMat: MeshBasicMaterial;
  private readonly tubeMat: MeshBasicMaterial;
  private readonly tubeColor = new Color(PINK).multiplyScalar(2.2);
  private fade = 0;
  private was: Sim['barrier']['state'] = 'idle';
  private time = 0;

  constructor(bars: readonly BarrierDef[]) {
    const n = Math.max(1, bars.length);
    this.stripMat = new MeshBasicMaterial({ color: PINK, map: stripTexture(), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false, toneMapped: false });
    this.tubeMat = new MeshBasicMaterial({ color: this.tubeColor, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    this.strip = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.stripMat, n);
    this.tubes = new InstancedMesh(new CylinderGeometry(TUBE_R, TUBE_R, 1, 8, 1, true).rotateZ(Math.PI / 2), this.tubeMat, n * TUBES.length);
    const m = new Matrix4(), q = new Quaternion(), pos = new Vector3(), s = new Vector3(), up = new Vector3(0, 1, 0);
    bars.forEach((b, i) => {
      const y = groundY(b.x, b.z);
      // Local x of the Tor frame runs across the passage (rotation about +Y by `rot`); 0.05 m proud of the pier faces.
      q.setFromAxisAngle(up, b.rot);
      this.strip.setMatrixAt(i, m.compose(pos.set(b.x, y + 0.04, b.z), q, s.set(2 * b.half, 1, STRIP)));
      TUBES.forEach((h, k) => this.tubes.setMatrixAt(i * TUBES.length + k, m.compose(pos.set(b.x, y + h, b.z), q, s.set(2 * b.half + 0.1, 1, 1))));
    });
    for (const mesh of [this.strip, this.tubes]) {
      mesh.layers.set(FX_LAYER);
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.count = mesh === this.strip ? bars.length : bars.length * TUBES.length;
      this.group.add(mesh);
    }
  }

  update(sim: Sim, dt: number): void {
    this.time += dt;
    const b = sim.barrier;
    const T = BOSS.tuersteher;
    if (this.was === 'shut' && b.state !== 'shut') this.fade = FADE;
    this.was = b.state;
    this.fade = Math.max(0, this.fade - dt);
    let strip = 0, tube = 0;
    if (b.state === 'wind') strip = 0.25 + 0.75 * (1 - b.t / T.barWind) * (0.85 + 0.15 * Math.sin(this.time * 30));
    else if (b.state === 'shut') {
      const on = T.barTime - b.t;
      strip = 0.7;
      // Flicker on like a neon tube for the first quarter second, then a slight hum.
      tube = on < 0.25 ? (Math.sin(on * 90) > -0.2 ? 1 : 0.15) : 0.92 + 0.08 * Math.sin(this.time * 47);
    } else if (this.fade > 0) {
      strip = tube = this.fade / FADE;
      strip *= 0.7;
    }
    this.stripMat.opacity = strip;
    this.tubeMat.opacity = tube;
    this.strip.visible = strip > 0;
    this.tubes.visible = tube > 0;
  }
}
