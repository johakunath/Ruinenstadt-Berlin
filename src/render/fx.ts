// Effects: particles (fire, embers, sparks, dust), weapon smear, enemy telegraphs, impact
// flashes, blob shadows, drifting mist. All of it lives on the FX layer.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, NormalBlending, PlaneGeometry, Points, ShaderMaterial, Sprite, SpriteMaterial, Vector3, type Blending,
} from 'three';
import type { AttackDef, AttackId } from '../data/combat';
import { ATTACKS } from '../data/combat';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { COURTYARD } from '../data/courtyard';
import { lerp, lerpAngle, Rng } from '../sim/math';
import { DT, type Enemy, type Player, type Sim } from '../sim/types';
import { paintGlow } from './paint';
import { FX_LAYER } from './world';

/** Flat annular sector on the ground plane. Angle 0 points along +Z, positive toward +X. uv = (along angle, across radius). */
export function sectorGeometry(inner: number, outer: number, from: number, to: number, segments = 24): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = lerp(from, to, t);
    pos.push(Math.sin(a) * inner, 0, Math.cos(a) * inner, Math.sin(a) * outer, 0, Math.cos(a) * outer);
    uv.push(t, 0, t, 1);
    if (i < segments) {
      const k = i * 2;
      idx.push(k, k + 1, k + 3, k, k + 3, k + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------- particles

interface SpawnOpts {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  size: number;
  /** Size at the end of life as a factor. */
  grow: number;
  r: number;
  g: number;
  b: number;
  gravity: number;
  drag: number;
}

class Particles {
  readonly points: Points;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly max: Float32Array;
  private readonly base: Float32Array;
  private readonly phys: Float32Array;
  private next = 0;
  private readonly material: ShaderMaterial;

  constructor(capacity: number, blending: Blending) {
    this.n = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    // size0, grow, r, g, b
    this.base = new Float32Array(capacity * 5);
    this.phys = new Float32Array(capacity * 2);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    geo.setAttribute('pcolor', new BufferAttribute(this.col, 4).setUsage(DynamicDrawUsage));
    geo.setAttribute('psize', new BufferAttribute(this.size, 1).setUsage(DynamicDrawUsage));
    this.material = new ShaderMaterial({
      uniforms: { scale: { value: 800 } },
      vertexShader: /* glsl */ `
        attribute vec4 pcolor;
        attribute float psize;
        uniform float scale;
        varying vec4 vColor;
        void main() {
          vColor = pcolor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec4 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.12, d) * vColor.a;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vColor.rgb * ${blending === AdditiveBlending ? 'a' : '1.0'}, a${blending === AdditiveBlending ? '' : ' * 0.4'});
        }`,
      blending,
      transparent: true,
      depthWrite: false,
    });
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.layers.set(FX_LAYER);
    this.points.renderOrder = 5;
  }

  spawn(o: SpawnOpts): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([o.x, o.y, o.z], i * 3);
    this.vel.set([o.vx, o.vy, o.vz], i * 3);
    this.life[i] = o.life;
    this.max[i] = o.life;
    this.base.set([o.size, o.grow, o.r, o.g, o.b], i * 5);
    this.phys.set([o.gravity, o.drag], i * 2);
  }

  update(dt: number, time: number, pixelScale: number): void {
    this.material.uniforms.scale!.value = pixelScale;
    for (let i = 0; i < this.n; i++) {
      let life = this.life[i] as number;
      if (life <= 0) {
        this.col[i * 4 + 3] = 0;
        this.size[i] = 0;
        continue;
      }
      life -= dt;
      this.life[i] = life;
      const t = 1 - Math.max(0, life) / (this.max[i] as number);
      const k = i * 3;
      const drag = Math.exp(-(this.phys[i * 2 + 1] as number) * dt);
      this.vel[k] = (this.vel[k] as number) * drag;
      this.vel[k + 1] = ((this.vel[k + 1] as number) - (this.phys[i * 2] as number) * dt) * drag;
      this.vel[k + 2] = (this.vel[k + 2] as number) * drag;
      // A little turbulence so embers wander.
      const wob = Math.sin(time * 3 + i * 1.7) * 0.4 * dt;
      this.pos[k] = (this.pos[k] as number) + (this.vel[k] as number) * dt + wob;
      this.pos[k + 1] = Math.max(0.02, (this.pos[k + 1] as number) + (this.vel[k + 1] as number) * dt);
      this.pos[k + 2] = (this.pos[k + 2] as number) + (this.vel[k + 2] as number) * dt + wob * 0.6;
      const b = i * 5;
      this.size[i] = (this.base[b] as number) * lerp(1, this.base[b + 1] as number, t);
      this.col[i * 4] = this.base[b + 2] as number;
      this.col[i * 4 + 1] = (this.base[b + 3] as number) * (1 - t * 0.6);
      this.col[i * 4 + 2] = (this.base[b + 4] as number) * (1 - t * 0.8);
      this.col[i * 4 + 3] = Math.min(1, (1 - t) * 3) * Math.min(1, t * 12);
    }
    const g = this.points.geometry;
    (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('pcolor') as BufferAttribute).needsUpdate = true;
    (g.getAttribute('psize') as BufferAttribute).needsUpdate = true;
  }
}

// ---------------------------------------------------------------- weapon smear

/** Arc that follows the weapon sweep: bright leading edge, fading tail. Matches the hit arc exactly. */
class Smear {
  readonly mesh: Mesh;
  private readonly geos = new Map<AttackId, BufferGeometry>();
  private readonly material: ShaderMaterial;
  private fade = 0;

  constructor() {
    for (const a of Object.values(ATTACKS)) this.geos.set(a.id, sectorGeometry(a.reach * 0.42, a.reach, a.from, a.to, 28));
    this.material = new ShaderMaterial({
      uniforms: { head: { value: 0 }, fade: { value: 0 }, tint: { value: new Color(1, 0.72, 0.4) } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float head;
        uniform float fade;
        uniform vec3 tint;
        varying vec2 vUv;
        void main() {
          float behind = head - vUv.x;
          if (behind < 0.0) discard;
          float tail = exp(-behind * 3.2);
          float edge = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
          float core = smoothstep(0.55, 0.95, vUv.y);
          float a = tail * edge * fade;
          vec3 col = mix(tint, vec3(1.0, 0.96, 0.85), core * tail) * (1.2 + 3.0 * core * tail);
          gl_FragColor = vec4(col * a, a);
        }`,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(this.geos.get('light1'), this.material);
    this.mesh.layers.set(FX_LAYER);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  update(p: Player, alpha: number, dt: number, frozen: boolean): void {
    const a: AttackDef | null = p.state === 'attack' ? p.attack : null;
    if (a) {
      const t = p.stateT + (frozen ? 0 : alpha * DT);
      const head = (t - a.windup) / a.active;
      if (head > 0) {
        this.mesh.geometry = this.geos.get(a.id) as BufferGeometry;
        this.mesh.position.set(lerp(p.px, p.x, alpha), a.style === 'smash' ? 0.12 : 1.05, lerp(p.pz, p.z, alpha));
        this.mesh.rotation.set(0, lerpAngle(p.pfacing, p.facing, alpha), 0);
        // Slashes lean with the swing direction; the smash fans out flat on the ground.
        this.mesh.rotateZ(a.style === 'smash' ? 0 : Math.sign(a.to - a.from) * 0.2);
        this.material.uniforms.head!.value = Math.min(1, head);
        this.fade = head <= 1 ? 1 : Math.max(0, 1 - (head - 1) * a.active * 9);
      }
    } else {
      this.fade = Math.max(0, this.fade - dt * 9);
    }
    this.material.uniforms.fade!.value = this.fade;
    this.mesh.visible = this.fade > 0.01;
  }
}

// ---------------------------------------------------------------- telegraphs

/** Ground arcs that show an enemy strike while it winds up: the readable part of the attack. */
class Telegraphs {
  readonly group = new Group();
  private readonly pool: Array<{ rim: Mesh; fill: Mesh }> = [];
  private readonly geos = new Map<EnemyKind, BufferGeometry>();

  constructor(size = 14) {
    for (const d of Object.values(ENEMIES)) this.geos.set(d.kind, sectorGeometry(0.25, d.reach, -d.halfAngle, d.halfAngle, 18));
    for (let i = 0; i < size; i++) {
      const mk = (): Mesh => {
        const m = new Mesh(this.geos.get('walker'), new MeshBasicMaterial({ color: 0xff4a1e, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
        m.layers.set(FX_LAYER);
        m.visible = false;
        m.renderOrder = 2;
        this.group.add(m);
        return m;
      };
      this.pool.push({ rim: mk(), fill: mk() });
    }
  }

  update(sim: Sim, alpha: number): void {
    let used = 0;
    for (const e of sim.enemies) {
      if (e.state !== 'windup' && e.state !== 'strike') continue;
      const slot = this.pool[used];
      if (!slot) break;
      used++;
      const k = e.state === 'strike' ? 1 : Math.min(1, e.stateT / e.def.windup);
      const x = lerp(e.px, e.x, alpha);
      const z = lerp(e.pz, e.z, alpha);
      for (const m of [slot.rim, slot.fill]) {
        m.geometry = this.geos.get(e.kind) as BufferGeometry;
        m.position.set(x, 0.05, z);
        m.rotation.y = e.facing;
        m.visible = true;
      }
      // The fill grows to the full arc; at the strike the whole arc flashes.
      slot.fill.scale.setScalar(Math.max(0.05, k));
      const strike = e.state === 'strike';
      (slot.rim.material as MeshBasicMaterial).opacity = strike ? 0.5 : 0.1 + 0.12 * k;
      (slot.fill.material as MeshBasicMaterial).opacity = strike ? 0.8 : 0.1 + 0.22 * k;
      (slot.fill.material as MeshBasicMaterial).color.setHex(strike ? 0xffd6a0 : 0xff4a1e);
    }
    for (let i = used; i < this.pool.length; i++) {
      (this.pool[i] as { rim: Mesh; fill: Mesh }).rim.visible = false;
      (this.pool[i] as { rim: Mesh; fill: Mesh }).fill.visible = false;
    }
  }
}

// ---------------------------------------------------------------- facade

export interface FxOptions {
  embers: number;
  blobShadows: boolean;
}

const m4 = new Matrix4();

export class Fx {
  readonly group = new Group();
  private readonly glow: Particles;
  private readonly dust: Particles;
  private readonly smear = new Smear();
  private readonly telegraphs = new Telegraphs();
  private readonly flashes: Array<{ sprite: Sprite; t: number; size: number }> = [];
  private readonly blobs: InstancedMesh | null;
  private readonly mist: Array<{ sprite: Sprite; vx: number; phase: number }> = [];
  private readonly rng = new Rng(99);
  private flashNext = 0;
  private emberDebt = 0;
  private flameDebt = 0;
  private time = 0;

  constructor(
    private readonly fires: Vector3[],
    private readonly opts: FxOptions,
  ) {
    this.glow = new Particles(900, AdditiveBlending);
    this.dust = new Particles(260, NormalBlending);
    this.group.add(this.glow.points, this.dust.points, this.smear.mesh, this.telegraphs.group);
    const flashTex = paintGlow('rgba(255,245,220,1)', 'rgba(255,170,90,0)');
    for (let i = 0; i < 8; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: flashTex, blending: AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
      sprite.layers.set(FX_LAYER);
      sprite.visible = false;
      sprite.renderOrder = 7;
      this.group.add(sprite);
      this.flashes.push({ sprite, t: 1, size: 1 });
    }
    if (opts.blobShadows) {
      const geo = new PlaneGeometry(1, 1);
      geo.rotateX(-Math.PI / 2);
      const mat = new MeshBasicMaterial({ map: paintGlow('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false, color: 0x000000 });
      this.blobs = new InstancedMesh(geo, mat, 256);
      this.blobs.layers.set(FX_LAYER);
      this.blobs.frustumCulled = false;
      this.blobs.count = 0;
      this.group.add(this.blobs);
    } else {
      this.blobs = null;
    }
    // Low mist that drifts across the yard.
    const mistTex = paintGlow('rgba(150,200,195,0.5)', 'rgba(150,200,195,0)');
    const Y = COURTYARD.yard;
    for (let i = 0; i < 12; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: this.rng.range(0.05, 0.11), fog: false }));
      const s = this.rng.range(7, 13);
      sprite.scale.set(s, s * 0.45, 1);
      sprite.position.set(this.rng.range(Y.minX, Y.maxX), this.rng.range(0.5, 1.6), this.rng.range(Y.minZ, Y.maxZ));
      sprite.layers.set(FX_LAYER);
      sprite.renderOrder = 3;
      this.group.add(sprite);
      this.mist.push({ sprite, vx: this.rng.range(0.15, 0.45), phase: this.rng.range(0, 6) });
    }
  }

  /** Hit sparks flying along the blow, plus an impact flash. */
  sparks(x: number, y: number, z: number, dx: number, dz: number, heavy: boolean): void {
    const n = heavy ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const spread = this.rng.range(-0.9, 0.9);
      const speed = this.rng.range(3, heavy ? 11 : 8);
      const cs = Math.cos(spread);
      const sn = Math.sin(spread);
      this.glow.spawn({
        x, y: y + this.rng.range(-0.2, 0.2), z,
        vx: (dx * cs - dz * sn) * speed, vy: this.rng.range(0.5, 5), vz: (dz * cs + dx * sn) * speed,
        life: this.rng.range(0.14, 0.38), size: this.rng.range(0.05, heavy ? 0.12 : 0.09), grow: 0.3,
        r: 6, g: 4.2, b: 1.8, gravity: 16, drag: 2.5,
      });
    }
    // Dark droplets from the body.
    for (let i = 0; i < (heavy ? 9 : 5); i++) {
      const spread = this.rng.range(-0.7, 0.7);
      const speed = this.rng.range(2, 6);
      this.dust.spawn({
        x, y, z,
        vx: (dx * Math.cos(spread) - dz * Math.sin(spread)) * speed, vy: this.rng.range(1, 4), vz: (dz * Math.cos(spread) + dx * Math.sin(spread)) * speed,
        life: this.rng.range(0.3, 0.6), size: this.rng.range(0.07, 0.13), grow: 0.6,
        r: 0.16, g: 0.2, b: 0.1, gravity: 14, drag: 1.5,
      });
    }
    const f = this.flashes[this.flashNext] as { sprite: Sprite; t: number; size: number };
    this.flashNext = (this.flashNext + 1) % this.flashes.length;
    f.t = 0;
    f.size = heavy ? 2.4 : 1.5;
    f.sprite.position.set(x, y, z);
    f.sprite.visible = true;
  }

  /** Ground puff: dodge start, heavy landings, falling bodies. */
  puff(x: number, z: number, count: number, spread = 1): void {
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(0.4, 1.8) * spread;
      this.dust.spawn({
        x: x + Math.cos(a) * 0.2, y: 0.15, z: z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * s, vy: this.rng.range(0.2, 0.9), vz: Math.sin(a) * s,
        life: this.rng.range(0.35, 0.7), size: this.rng.range(0.35, 0.7), grow: 2.2,
        r: 0.2, g: 0.2, b: 0.19, gravity: -0.3, drag: 3,
      });
    }
  }

  update(sim: Sim, alpha: number, dt: number, frozen: boolean, pixelScale: number): void {
    this.time += dt;
    // Fire and embers keep burning through hitstop: only the fight freezes.
    this.flameDebt += dt * 34;
    this.emberDebt += dt * (this.opts.embers / 3);
    for (const f of this.fires) {
      for (; this.flameDebt >= 1; this.flameDebt--) {
        this.glow.spawn({
          x: f.x + this.rng.range(-0.2, 0.2), y: f.y + this.rng.range(0, 0.15), z: f.z + this.rng.range(-0.2, 0.2),
          vx: this.rng.range(-0.25, 0.25), vy: this.rng.range(1.2, 2.6), vz: this.rng.range(-0.25, 0.25),
          life: this.rng.range(0.3, 0.6), size: this.rng.range(0.4, 0.75), grow: 0.25,
          r: 1.5, g: 0.62, b: 0.12, gravity: -1.5, drag: 1.2,
        });
      }
      for (; this.emberDebt >= 1; this.emberDebt--) {
        this.glow.spawn({
          x: f.x + this.rng.range(-0.25, 0.25), y: f.y + 0.3, z: f.z + this.rng.range(-0.25, 0.25),
          vx: this.rng.range(-0.5, 0.9), vy: this.rng.range(0.8, 2.4), vz: this.rng.range(-0.5, 0.5),
          life: this.rng.range(1.6, 3.6), size: this.rng.range(0.035, 0.07), grow: 0.5,
          r: 5, g: 1.8, b: 0.35, gravity: -0.5, drag: 0.5,
        });
      }
    }
    this.glow.update(dt, this.time, pixelScale);
    this.dust.update(dt, this.time, pixelScale);
    this.smear.update(sim.player, alpha, dt, frozen);
    this.telegraphs.update(sim, alpha);
    for (const f of this.flashes) {
      if (!f.sprite.visible) continue;
      f.t += dt / 0.12;
      const s = f.size * (0.35 + 0.65 * Math.min(1, f.t * 1.6));
      f.sprite.scale.set(s, s, 1);
      (f.sprite.material as SpriteMaterial).opacity = Math.max(0, 1 - f.t) * 0.95;
      if (f.t >= 1) f.sprite.visible = false;
    }
    if (this.blobs) {
      let n = 0;
      for (const e of sim.enemies) {
        if (n >= 256) break;
        if (e.state === 'dead' && e.stateT > 1.2) continue;
        this.setBlob(n++, e, alpha);
      }
      this.blobs.count = n;
      this.blobs.instanceMatrix.needsUpdate = true;
    }
    const Y = COURTYARD.yard;
    for (const m of this.mist) {
      m.sprite.position.x += m.vx * dt;
      m.sprite.position.y += Math.sin(this.time * 0.4 + m.phase) * 0.05 * dt;
      if (m.sprite.position.x > Y.maxX + 6) m.sprite.position.x = Y.minX - 6;
    }
  }

  private setBlob(i: number, e: Enemy, alpha: number): void {
    const s = e.def.radius * 3.4;
    m4.makeScale(s, 1, s).setPosition(lerp(e.px, e.x, alpha), 0.04, lerp(e.pz, e.z, alpha));
    (this.blobs as InstancedMesh).setMatrixAt(i, m4);
  }
}
