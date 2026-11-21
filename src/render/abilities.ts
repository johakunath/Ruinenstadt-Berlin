// What powers, consumables and blessings put into the world (M8, M16): shots, shock rings, fire
// fields, impact markers, thrown bottles, lightning, the banner, guard and spin. Everything is
// pooled, unlit and on the FX layer: no lights, no shadows, the same cost on both profiles.
import { GUNS } from './weapons';
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial,
} from 'three';
import { POWER } from '../data/powers';
import { ELITES as ELITE_DEFS } from '../data/enemies';
import { lerp, Rng } from '../sim/math';
import type { Sim, SimEvent } from '../sim/types';
import { groundY } from './ground';
import { FX_LAYER } from './layers';
import { paintGlow } from './paint';

/** Particle spawners of `Fx`: additive glow and soft dust. */
export interface Emitters {
  glow(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, r: number, g: number, b: number, gravity?: number, grow?: number): void;
  dust(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, r: number, g: number, b: number): void;
}

const SHOTS = 96, RINGS = 12, FIELDS = 48, STRIKES = 10, BOLTS = 10, ELITES = 8;
const RING_COLOR: Record<string, number> = { earth: 0xffc98a, small: 0xffd9a8, blade: 0xff4a3a, guard: 0xb8c4d0, acid: 0x97c459 };
/** E1 lightning ribbon: half height in meters and seconds on screen. */
const BOLT_HALF = 0.16, BOLT_LIFE = 0.26;
const m4 = new Matrix4();
const col = new Color();

function fxMesh<T extends Mesh | InstancedMesh | Sprite>(m: T, order = 4): T {
  m.layers.set(FX_LAYER);
  m.renderOrder = order;
  m.frustumCulled = false;
  return m;
}
const add = (color: number, opacity = 1): MeshBasicMaterial => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });

export class AbilityView {
  readonly group = new Group();
  private readonly rng = new Rng(7);
  private readonly stones: InstancedMesh;
  private readonly nails: InstancedMesh;
  private readonly spears: InstancedMesh;
  private readonly rings: Array<{ mesh: Mesh; mat: MeshBasicMaterial }> = [];
  private readonly fields: InstancedMesh;
  private readonly strikes: Array<{ rim: Mesh; fill: Mesh }> = [];
  private readonly bolts: Array<{ mesh: Mesh; life: number }> = [];
  private readonly bottles: Mesh[] = [];
  private readonly elites: Mesh[] = [];
  private readonly banner = new Group();
  private readonly cloth: Mesh;
  private readonly bannerRing: Mesh;
  private readonly guard: Mesh;
  private readonly spin: Mesh;
  private readonly spinMat: ShaderMaterial;
  private readonly aura: Sprite;
  private time = 0;
  private debt = 0;

  constructor(private readonly emit: Emitters) {
    const inst = (geo: BufferGeometry, color: number): InstancedMesh => {
      const m = fxMesh(new InstancedMesh(geo, new MeshBasicMaterial({ color, fog: false }), SHOTS), 5);
      m.count = 0;
      this.group.add(m);
      return m;
    };
    this.stones = inst(new SphereGeometry(0.1, 7, 5), 0xffe2a8);
    const nail = new BoxGeometry(0.035, 0.035, 0.5);
    this.nails = inst(nail, 0xfff0c8);
    const spear = new CylinderGeometry(0.03, 0.03, 1.9, 6);
    spear.rotateX(Math.PI / 2);
    const tip = new ConeGeometry(0.08, 0.4, 6);
    tip.rotateX(Math.PI / 2);
    tip.translate(0, 0, 1.1);
    this.spears = inst(mergeTwo(spear, tip), 0xfff2d8);

    for (let i = 0; i < RINGS; i++) {
      const mat = add(0xffffff, 0);
      const mesh = fxMesh(new Mesh(new RingGeometry(0.84, 1, 56), mat), 3);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, mat });
    }
    const disc = new PlaneGeometry(2.5, 2.5);
    disc.rotateX(-Math.PI / 2);
    this.fields = fxMesh(new InstancedMesh(disc, new MeshBasicMaterial({ map: paintGlow('rgba(255,150,60,1)', 'rgba(255,60,10,0)'), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }), FIELDS), 2);
    this.fields.count = 0;
    this.group.add(this.fields);
    for (let i = 0; i < STRIKES; i++) {
      const rim = fxMesh(new Mesh(new RingGeometry(0.9, 1, 40), add(0xff5a2a, 0.7)), 2);
      const fill = fxMesh(new Mesh(new CircleGeometry(1, 32), add(0xff7a3a, 0.3)), 2);
      for (const m of [rim, fill]) {
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        this.group.add(m);
      }
      this.strikes.push({ rim, fill });
    }
    for (let i = 0; i < BOLTS; i++) {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(9 * 2 * 3), 3));
      const idx: number[] = [], uv: number[] = [];
      for (let k = 0; k < 8; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 3, k * 2, k * 2 + 3, k * 2 + 2);
      for (let k = 0; k <= 8; k++) uv.push(k / 8, 0, k / 8, 1);
      g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
      g.setIndex(idx);
      // E1: a wide ribbon with a white core in a cyan halo (the thin flat one was lost in a fight).
      const mesh = fxMesh(new Mesh(g, new ShaderMaterial({
        uniforms: { fade: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform float fade; varying vec2 vUv;
          void main() { float d = abs(vUv.y - 0.5) * 2.0; float halo = (1.0 - d) * (1.0 - d), core = smoothstep(0.3, 0.1, d);
            gl_FragColor = vec4((vec3(0.2, 0.62, 1.0) * halo * 1.2 + vec3(0.9, 0.97, 1.0) * core * 1.3) * fade, 1.0); }`,
        blending: AdditiveBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, side: DoubleSide, fog: false,
      })), 6);
      mesh.visible = false;
      this.group.add(mesh);
      this.bolts.push({ mesh, life: 0 });
    }
    for (let i = 0; i < 4; i++) {
      const b = fxMesh(new Mesh(new CylinderGeometry(0.05, 0.07, 0.26, 6), new MeshBasicMaterial({ color: 0x6a8a5a, fog: false })), 5);
      b.visible = false;
      this.group.add(b);
      this.bottles.push(b);
    }
    for (let i = 0; i < ELITES; i++) {
      const m = fxMesh(new Mesh(new RingGeometry(0.82, 1, 32), add(0xc98cff, 0.75)), 2);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.elites.push(m);
    }

    // Standarte: pole, red cloth with the ember mark, a wide ground ring.
    const pole = fxMesh(new Mesh(new CylinderGeometry(0.035, 0.045, 3, 6), new MeshBasicMaterial({ color: 0x8a6a48, fog: false })));
    pole.position.y = 1.5;
    this.cloth = fxMesh(new Mesh(new PlaneGeometry(1.1, 0.75, 6, 1), new MeshBasicMaterial({ color: 0xc23a2e, side: DoubleSide, fog: false })));
    this.cloth.position.set(0.58, 2.5, 0);
    const mark = fxMesh(new Mesh(new CircleGeometry(0.2, 16), new MeshBasicMaterial({ color: 0xf2d14b, side: DoubleSide, fog: false })));
    mark.position.set(0, 0, 0.01);
    this.cloth.add(mark);
    const back = mark.clone();
    back.position.z = -0.01;
    this.cloth.add(back);
    this.bannerRing = fxMesh(new Mesh(new RingGeometry(0.965, 1, 72), add(0xf2d14b, 0.6)), 2);
    this.bannerRing.rotation.x = -Math.PI / 2;
    const glow = fxMesh(new Sprite(new SpriteMaterial({ map: paintGlow('rgba(255,220,120,0.9)', 'rgba(255,170,60,0)'), blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false })), 6);
    glow.position.y = 2.6;
    glow.scale.set(2.4, 2.4, 1);
    this.banner.add(pole, this.cloth, this.bannerRing, glow);
    this.banner.visible = false;
    this.group.add(this.banner);

    // Gullydeckel: a cover of light around the hero.
    this.guard = fxMesh(new Mesh(new CylinderGeometry(0.95, 0.95, 1.7, 28, 1, true), add(0x9fb4c8, 0.22)), 4);
    this.guard.visible = false;
    // Kreissäge: a turning blade trail.
    const sp = new RingGeometry(0.5, 1, 48, 1);
    sp.rotateX(-Math.PI / 2);
    this.spinMat = new ShaderMaterial({
      uniforms: { head: { value: 0 }, fade: { value: 1 }, tint: { value: new Color(1, 0.72, 0.4) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float head; uniform float fade; uniform vec3 tint; varying vec3 vP;
        void main(){ float a = atan(vP.x, vP.z) / 6.2831853 + 0.5; float r = length(vP.xz);
          float tail = pow(1.0 - fract(head - a), 2.5); float edge = smoothstep(0.5, 0.72, r) * smoothstep(1.0, 0.9, r);
          float k = tail * edge * fade; gl_FragColor = vec4(mix(tint, vec3(1.0, 0.96, 0.85), tail * tail) * (1.0 + 2.5 * tail) * k, k); }`,
      blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide,
    });
    this.spin = fxMesh(new Mesh(sp, this.spinMat), 6);
    this.spin.visible = false;
    this.aura = fxMesh(new Sprite(new SpriteMaterial({ map: paintGlow('rgba(255,255,255,0.8)', 'rgba(255,255,255,0)'), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })), 6);
    this.group.add(this.guard, this.spin, this.aura);
  }

  /** One-shot effects from sim events. */
  onEvent(ev: SimEvent): void {
    const E = this.emit;
    const R = this.rng;
    if (ev.type === 'bolt') {
      const b = this.bolts.find((q) => q.life <= 0) ?? this.bolts[0]!;
      const pos = b.mesh.geometry.getAttribute('position') as BufferAttribute;
      const y0 = groundY(ev.x0, ev.z0) + 1.1, y1 = groundY(ev.x1, ev.z1) + 1.1;
      const dx = ev.x1 - ev.x0, dz = ev.z1 - ev.z0, len = Math.hypot(dx, dz) || 1;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, j = i === 0 || i === 8 ? 0 : R.range(-0.28, 0.28);
        const x = lerp(ev.x0, ev.x1, t) + (-dz / len) * j, z = lerp(ev.z0, ev.z1, t) + (dx / len) * j, y = lerp(y0, y1, t) + (i % 8 ? R.range(-0.2, 0.2) : 0);
        pos.setXYZ(i * 2, x, y - BOLT_HALF, z);
        pos.setXYZ(i * 2 + 1, x, y + BOLT_HALF, z);
      }
      pos.needsUpdate = true;
      b.life = BOLT_LIFE;
      b.mesh.visible = true;
      for (let i = 0; i < 10; i++) E.glow(ev.x1, y1, ev.z1, R.range(-3.5, 3.5), R.range(0, 4.5), R.range(-3.5, 3.5), R.range(0.15, 0.35), 0.11, 2, 4.5, 6.5, 6);
    } else if (ev.type === 'shock') {
      const y = groundY(ev.x, ev.z);
      const n = Math.round(10 + ev.radius * 5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + R.range(0, 0.3), s = POWER.shock.speed * R.range(0.5, 0.9);
        E.dust(ev.x + Math.sin(a) * 0.4, y + 0.15, ev.z + Math.cos(a) * 0.4, Math.sin(a) * s, R.range(0.4, 1.6), Math.cos(a) * s, R.range(0.35, 0.7), R.range(0.4, 0.8), 0.24, 0.22, 0.2);
      }
      if (ev.kind === 'earth' || ev.kind === 'guard') for (let i = 0; i < 18; i++) E.glow(ev.x, y + 0.3, ev.z, R.range(-5, 5), R.range(2, 8), R.range(-5, 5), R.range(0.2, 0.5), 0.1, 6, 3.6, 1.4, 16);
    } else if (ev.type === 'impact') {
      const y = groundY(ev.x, ev.z);
      const fire = ev.kind !== 'boom';
      for (let i = 0; i < (ev.kind === 'molotov' ? 40 : 22); i++) {
        const a = R.range(0, Math.PI * 2), s = R.range(1, ev.radius * 2.6);
        E.glow(ev.x, y + 0.3, ev.z, Math.sin(a) * s, R.range(1.5, 7), Math.cos(a) * s, R.range(0.25, 0.6), R.range(0.12, fire ? 0.5 : 0.2), 5, fire ? 2.2 : 3.4, 0.6, 10, fire ? 0.4 : 0.2);
      }
      for (let i = 0; i < 8; i++) E.dust(ev.x, y + 0.2, ev.z, R.range(-3, 3), R.range(0.5, 2), R.range(-3, 3), R.range(0.5, 0.9), R.range(0.5, 1), 0.16, 0.14, 0.13);
    } else if (ev.type === 'ignite') {
      for (let i = 0; i < 10; i++) E.glow(ev.x, groundY(ev.x, ev.z) + R.range(0.4, 1.4), ev.z, R.range(-1.6, 1.6), R.range(1, 3.5), R.range(-1.6, 1.6), R.range(0.25, 0.5), R.range(0.3, 0.55), 1.8, 0.7, 0.12, -1.5, 0.3);
    } else if ((ev.type === 'heal' && !ev.tick) || ev.type === 'secondWind' || ev.type === 'blessing' || ev.type === 'shrine') {
      const c = ev.type === 'heal' ? [0x8fd16a, 0.8] as const : ev.type === 'shrine' ? [0x7dd3ff, 1] as const : [0xf2d14b, 1] as const;
      (this.aura.material as SpriteMaterial).color.setHex(c[0]);
      (this.aura.material as SpriteMaterial).opacity = c[1];
    }
  }

  update(s: Sim, alpha: number, dt: number, heroX: number, heroY: number, heroZ: number): void {
    this.time += dt;
    const a = s.abilities;
    const E = this.emit;
    const R = this.rng;

    // Shots, interpolated between steps; a spark trail behind each.
    let ns = 0, nn = 0, np = 0;
    // A gun's shots fly at its muzzle height (WP4 1h); the sim origin stays the Werfer's.
    const shotY = GUNS[s.stats.look]?.muzzle ?? 1.05;
    for (const q of a.projectiles) {
      const x = lerp(q.px, q.x, alpha), z = lerp(q.pz, q.z, alpha), y = groundY(x, z) + shotY;
      m4.makeRotationY(q.angle).setPosition(x, y, z);
      if (q.kind === 'spear') this.spears.setMatrixAt(np++, m4);
      else if (q.kind === 'nail') this.nails.setMatrixAt(nn++, m4);
      else this.stones.setMatrixAt(ns++, m4);
      if (R.next() < (q.kind === 'spear' ? 1 : 0.5)) E.glow(x, y, z, R.range(-0.4, 0.4), R.range(-0.2, 0.6), R.range(-0.4, 0.4), R.range(0.12, 0.28), q.kind === 'spear' ? 0.14 : 0.08, 5, 3.4, 1.4, 2, 0.2);
    }
    for (const [m, n] of [[this.stones, ns], [this.nails, nn], [this.spears, np]] as const) {
      m.count = Math.min(n, SHOTS);
      m.instanceMatrix.needsUpdate = true;
    }

    // Shock rings grow with the sim and fade toward their end.
    this.rings.forEach((r, i) => {
      const k = a.shocks[i];
      r.mesh.visible = !!k;
      if (!k) return;
      const rr = Math.min(k.max, k.r + POWER.shock.speed * dt * alpha);
      r.mesh.position.set(k.x, groundY(k.x, k.z) + 0.09, k.z);
      r.mesh.scale.setScalar(rr);
      r.mat.color.setHex(RING_COLOR[k.kind] ?? 0xffffff);
      r.mat.opacity = 0.95 * (1 - (rr / k.max) ** 2.2);
    });

    // Fire fields: a flickering glow on the ground, flames and embers above it.
    let nf = 0;
    this.debt = Math.min(40, this.debt + dt * 70);
    for (const f of a.fields) {
      if (nf >= FIELDS) break;
      const y = groundY(f.x, f.z);
      const fade = Math.min(1, f.t * 2) * Math.min(1, (f.max - f.t) * 6 + 0.2);
      m4.makeScale(f.r, 1, f.r).setPosition(f.x, y + 0.06, f.z);
      this.fields.setMatrixAt(nf, m4);
      this.fields.setColorAt(nf++, col.setScalar(fade * (0.75 + 0.25 * Math.sin(this.time * 13 + f.x * 3))));
    }
    this.fields.count = nf;
    this.fields.instanceMatrix.needsUpdate = true;
    if (this.fields.instanceColor) this.fields.instanceColor.needsUpdate = true;
    for (; this.debt >= 1 && a.fields.length > 0; this.debt--) {
      const f = a.fields[R.int(a.fields.length)]!;
      const ang = R.range(0, Math.PI * 2), d = Math.sqrt(R.next()) * f.r * 0.9;
      const x = f.x + Math.sin(ang) * d, z = f.z + Math.cos(ang) * d;
      if (R.next() < 0.8) E.glow(x, groundY(x, z) + 0.1, z, R.range(-0.2, 0.2), R.range(1.2, 2.8), R.range(-0.2, 0.2), R.range(0.3, 0.6), R.range(0.35, 0.7), 1.5, 0.62, 0.12, -1.5, 0.25);
      else E.glow(x, groundY(x, z) + 0.4, z, R.range(-0.5, 0.5), R.range(1, 2.6), R.range(-0.5, 0.5), R.range(0.8, 1.8), R.range(0.035, 0.07), 5, 1.8, 0.35, -0.5, 0.5);
    }
    if (a.fields.length === 0) this.debt = 0;

    // Sperrfeuer: the circle fills until the impact.
    this.strikes.forEach((m, i) => {
      const k = a.strikes[i];
      m.rim.visible = m.fill.visible = !!k;
      if (!k) return;
      const y = groundY(k.x, k.z) + 0.07;
      m.rim.position.set(k.x, y, k.z);
      m.fill.position.set(k.x, y, k.z);
      m.rim.scale.setScalar(k.r);
      m.fill.scale.setScalar(k.r * Math.max(0.05, 1 - k.t / k.max));
    });

    this.bottles.forEach((m, i) => {
      const b = a.bottles[i];
      m.visible = !!b;
      if (!b) return;
      const q = Math.min(1, (b.t + dt * alpha) / b.dur);
      const x = lerp(b.x0, b.x1, q), z = lerp(b.z0, b.z1, q);
      const y = lerp(groundY(b.x0, b.z0) + 1.5, groundY(b.x1, b.z1), q) + Math.sin(Math.PI * q) * 2.2;
      m.position.set(x, y, z);
      m.rotation.set(this.time * 14, 0, this.time * 9);
      E.glow(x, y + 0.15, z, R.range(-0.3, 0.3), R.range(0.2, 1), R.range(-0.3, 0.3), R.range(0.15, 0.35), 0.16, 4, 1.6, 0.3, 1, 0.3);
    });

    for (const b of this.bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      // Full for the first half, then out; it flickers once on the way.
      const k = Math.max(0, Math.min(1, (b.life / BOLT_LIFE) * 2));
      (b.mesh.material as ShaderMaterial).uniforms.fade!.value = k * (b.life > BOLT_LIFE * 0.55 && b.life < BOLT_LIFE * 0.7 ? 0.35 : 1);
      b.mesh.visible = b.life > 0;
    }

    let ne = 0;
    for (const e of s.enemies) {
      if (!e.elite || e.state === 'dead' || ne >= ELITES) continue;
      const m = this.elites[ne++]!;
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha);
      m.visible = true;
      m.position.set(x, groundY(x, z) + 0.06, z);
      m.scale.setScalar(e.def.radius * 1.9 * (1 + 0.06 * Math.sin(this.time * 5)));
      (m.material as MeshBasicMaterial).color.setHex(ELITE_DEFS[e.elite].color);
    }
    for (let i = ne; i < ELITES; i++) this.elites[i]!.visible = false;

    // Burning and corroded bodies: embers rise off the flame, drops fall (the marks themselves: `status-fx.ts`).
    for (const e of s.enemies) {
      if (e.state === 'dead') continue;
      if (e.burn > 0 && R.next() < dt * 12) E.glow(e.x + R.range(-0.3, 0.3), groundY(e.x, e.z) + R.range(0.8, 1.9) * e.def.scale, e.z + R.range(-0.3, 0.3), R.range(-0.5, 0.5), R.range(1.2, 3), R.range(-0.5, 0.5), R.range(0.5, 1), R.range(0.05, 0.09), 5, 1.8, 0.35, -0.5, 0.5);
      if (e.acid > 0 && R.next() < dt * 8) E.glow(e.x + R.range(-0.25, 0.25), groundY(e.x, e.z) + R.range(0.5, 1.4) * e.def.scale, e.z + R.range(-0.25, 0.25), 0, R.range(-1.4, -0.6), 0, 0.5, 0.09, 1.2, 2.4, 0.5, 2, 0.6);
    }

    const B = a.banner;
    this.banner.visible = !!B;
    if (B) {
      const y = groundY(B.x, B.z);
      this.banner.position.set(B.x, y, B.z);
      const rise = Math.min(1, (POWER.stand.time - B.t) * 5), fall = Math.min(1, B.t * 3);
      this.banner.scale.set(1, rise * fall, 1);
      this.cloth.rotation.y = Math.sin(this.time * 3.1) * 0.35;
      this.cloth.scale.x = 1 + Math.sin(this.time * 7) * 0.05;
      this.bannerRing.scale.setScalar(B.r);
      this.bannerRing.position.y = 0.07;
      (this.bannerRing.material as MeshBasicMaterial).opacity = (0.35 + 0.2 * Math.sin(this.time * 4)) * fall;
      if (R.next() < dt * 14) {
        const ang = R.range(0, Math.PI * 2);
        E.glow(B.x + Math.sin(ang) * B.r, y + 0.1, B.z + Math.cos(ang) * B.r, 0, R.range(0.6, 1.6), 0, R.range(0.5, 1), 0.07, 5, 4, 1, -0.3, 0.5);
      }
    }

    this.guard.visible = a.guard > 0;
    if (a.guard > 0) {
      this.guard.position.set(heroX, heroY + 0.9, heroZ);
      this.guard.rotation.y = this.time * 1.5;
      (this.guard.material as MeshBasicMaterial).opacity = (0.16 + 0.07 * Math.sin(this.time * 9)) * Math.min(1, a.guard * 3);
    }
    this.spin.visible = a.spin > 0;
    if (a.spin > 0) {
      const r = POWER.saege.radius * s.stats.reachFactor;
      this.spin.position.set(heroX, heroY + 1.05, heroZ);
      this.spin.scale.set(r, 1, r);
      this.spinMat.uniforms.head!.value = this.time * 3.4;
      this.spinMat.uniforms.fade!.value = Math.min(1, a.spin * 5);
    }
    // Säbeltanz: red sparks rise off the hero. Verband: green ones.
    if (a.frenzy > 0 && R.next() < dt * 40) E.glow(heroX + R.range(-0.4, 0.4), heroY + R.range(0.2, 1.6), heroZ + R.range(-0.4, 0.4), R.range(-0.4, 0.4), R.range(1, 3), R.range(-0.4, 0.4), R.range(0.25, 0.5), 0.09, 6, 0.9, 0.5, -1, 0.4);
    if (a.hot > 0 && R.next() < dt * 30) E.glow(heroX + R.range(-0.45, 0.45), heroY + R.range(0.1, 1.2), heroZ + R.range(-0.45, 0.45), 0, R.range(0.8, 2), 0, R.range(0.4, 0.8), 0.08, 1.4, 4.2, 1, -0.6, 0.5);
    const am = this.aura.material as SpriteMaterial;
    if (am.opacity > 0.01) {
      am.opacity = Math.max(0, am.opacity - dt * 1.6);
      const k = 2.2 + (1 - am.opacity) * 1.6;
      this.aura.position.set(heroX, heroY + 1, heroZ);
      this.aura.scale.set(k, k, 1);
      this.aura.visible = true;
    } else this.aura.visible = false;
  }
}

function mergeTwo(a: BufferGeometry, b: BufferGeometry): BufferGeometry {
  const pa = a.getAttribute('position'), pb = b.getAttribute('position');
  const pos = new Float32Array((pa.count + pb.count) * 3);
  pos.set(pa.array as Float32Array, 0);
  pos.set(pb.array as Float32Array, pa.count * 3);
  const ia = a.getIndex()!, ib = b.getIndex()!;
  const idx: number[] = [...(ia.array as Uint16Array)];
  for (const i of ib.array as Uint16Array) idx.push(i + pa.count);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
