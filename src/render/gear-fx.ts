// WP4 step 5 (P31, D5): legendary and set effects on the hero. One instanced sprite mesh on FX_LAYER draws
// every ambient particle, proc flash, steady glow (talisman, ring, implant) and the ground aura of variant C:
// 1 draw call, none while nothing shows, no light, not in the normal/depth pre-pass. The glow edges themselves
// are model parts (weapons.ts `SIG`, gear-fx-parts.ts); this file only pulses them (`WeaponRack.pulse`,
// `GEAR_PULSE`). What each item shows is data (src/data/gear-fx.ts); G3 picks the variant (`?gearfx=A|B|C`).
// Reads sim state and events only.
import { BufferAttribute, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NormalBlending, ShaderMaterial, Vector3, type Object3D } from 'three';
import {
  GEAR_FX_EMITTERS, SET_FX, SET_SHIMMER, equippedFx, type FxAmbient, type FxAnchor, type FxBurst, type FxProc, type FxSprite, type GearFxDef, type GearFxVariant,
} from '../data/gear-fx';
import type { LegendaryId, SetId } from '../data/items';
import { lerp, Rng } from '../sim/math';
import { setCount } from '../sim/stats';
import type { Sim, SimEvent } from '../sim/types';
import type { HeroView } from './characters';
import { GEAR_PULSE } from './gear';
import { groundY } from './ground';
import { FX_LAYER } from './layers';

// Sprite kinds (the shader branches on them). Disc and ring lie on the ground; halo is a ring facing the camera.
const DOT = 0, GLINT = 1, FEATHER = 2, DROP = 3, DISC = 4, RING = 5, HALO = 6;
const KIND: Readonly<Record<FxSprite, number>> = { dot: DOT, glint: GLINT, feather: FEATHER, drop: DROP, disc: DISC, ring: RING };
/** Sprites kept for the steady glows and the aura (written every frame, outside the particle pool). */
const STEADY_MAX = 6;
/** Emission rates in the data are for 48 sprites; smaller pools emit proportionally less. */
const RATE_POOL = 48;
/** Slow pulse of the glow edges: 0.8 to 1.3 × over this period (D5). */
const PULSE_PERIOD = 2.6;

const VERT = /* glsl */ `
attribute vec4 iPos;
attribute vec4 iCol;
attribute vec4 iShape;
varying vec2 vUv;
varying vec4 vCol;
varying vec3 vShape;
void main() {
  vUv = uv;
  vCol = iCol;
  vShape = iShape.xyz;
  vec3 p;
  if (iShape.x > 3.5 && iShape.x < 5.5) {
    p = iPos.xyz + vec3(position.x, 0.0, -position.y) * iPos.w;
  } else {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float c = cos(iShape.y), s = sin(iShape.y);
    vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    // A little toward the camera, so a sprite on the body is never cut by the cloth it sits on.
    p = iPos.xyz + (right * q.x + up * q.y) * iPos.w + normalize(cameraPosition - iPos.xyz) * 0.05;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying vec4 vCol;
varying vec3 vShape;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float k = vShape.x, a;
  if (k < 0.5) {
    a = exp(-r * r * 4.5);
  } else if (k < 1.5) {
    // Glint: a four-point star round a bright core.
    vec2 q = abs(p);
    a = max(exp(-q.x * 20.0) * (1.0 - q.y), exp(-q.y * 20.0) * (1.0 - q.x)) * 0.9 + exp(-r * r * 14.0);
  } else if (k < 2.5) {
    // Feather: a vane widest in the middle, a quill at the bottom.
    float y = vUv.y, w = 0.32 * sin(3.1416 * y) * (0.55 + 0.45 * y);
    a = smoothstep(w, w * 0.55, abs(p.x)) * step(0.12, y) + smoothstep(0.05, 0.0, abs(p.x)) * step(y, 0.2);
  } else if (k < 3.5) {
    // Drop: a narrow ellipse with a bright core.
    a = exp(-(p.x * p.x * 10.0 + p.y * p.y * 3.2)) * 1.2;
  } else if (k < 4.5) {
    a = exp(-r * r * 2.6) * smoothstep(1.0, 0.75, r);
  } else {
    a = smoothstep(0.16, 0.0, abs(r - 0.78)) * smoothstep(1.0, 0.92, r) + exp(-r * r * 6.0) * 0.12;
  }
  a = min(a, 1.0) * vCol.a;
  if (a < 0.003) discard;
  // Premultiplied: 'body' 0 adds light only, 1 covers what is behind (a dark feather, dust).
  gl_FragColor = vec4(vCol.rgb * a, a * vShape.z);
}`;

const _v = new Vector3();
const _w = new Vector3();
const _c = new Color();
const HOT = new Color(1, 0.82, 0.45);
const lin = (hex: string): Color => new Color().setStyle(hex);

/** One sprite to emit (reused, no allocation per particle). */
interface Spawn { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; s0: number; s1: number; a0: number; col: Color; k: number; kind: number; body: number; grav: number; drag: number; ang: number; spin: number }

interface Fx { id: LegendaryId; def: GearFxDef; color: Color }

export interface GearFxStats { sprites: number; particles: number; emitters: number; ms: number }

export class GearFx {
  readonly mesh: Mesh;
  readonly stats: GearFxStats = { sprites: 0, particles: 0, emitters: 0, ms: 0 };
  private readonly cap: number;
  private readonly pool: number;
  private readonly scale: number;
  private readonly rng = new Rng(7);
  // Particles, structure of arrays.
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private readonly col: Float32Array;
  /** age, life, size0, size1, alpha, gravity, drag, kind, angle, spin, body, intensity */
  private readonly q: Float32Array;
  private n = 0;
  private readonly geo = new InstancedBufferGeometry();
  private readonly iPos: Float32Array;
  private readonly iCol: Float32Array;
  private readonly iShape: Float32Array;
  private readonly sp: Spawn = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, s0: 0.1, s1: 0.1, a0: 1, col: new Color(), k: 1, kind: DOT, body: 0, grav: 0, drag: 0, ang: 0, spin: 0 };
  // Equipped effects, rebuilt when the stats object changes (equip).
  private statsRef: unknown = null;
  private fx: Fx[] = [];
  private emitters: Array<{ key: string; fx: Fx | null; amb: FxAmbient; color: Color }> = [];
  private auraColor: Color | null = null;
  private readonly acc = new Map<string, number>();
  private readonly anchors = new Map<string, { bone: Object3D; local: Vector3; r: number } | null>();
  private weaponFlare = 0;
  private gearFlare = 0;
  private readonly steadyFlare = new Map<LegendaryId, number>();
  private armed = false;
  private eyeCd = 0;
  private time = 0;
  private hero: HeroView | null = null;
  private foot = 0;

  constructor(max: number, private variant: GearFxVariant) {
    this.cap = Math.max(STEADY_MAX + 4, max);
    this.pool = this.cap - STEADY_MAX;
    this.scale = max / RATE_POOL;
    this.p = new Float32Array(this.pool * 3);
    this.v = new Float32Array(this.pool * 3);
    this.col = new Float32Array(this.pool * 3);
    this.q = new Float32Array(this.pool * 12);
    this.iPos = new Float32Array(this.cap * 4);
    this.iCol = new Float32Array(this.cap * 4);
    this.iShape = new Float32Array(this.cap * 4);
    const g = this.geo;
    g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', new InstancedBufferAttribute(this.iPos, 4).setUsage(DynamicDrawUsage));
    g.setAttribute('iCol', new InstancedBufferAttribute(this.iCol, 4).setUsage(DynamicDrawUsage));
    g.setAttribute('iShape', new InstancedBufferAttribute(this.iShape, 4).setUsage(DynamicDrawUsage));
    g.instanceCount = 0;
    const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, blending: NormalBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, fog: false });
    this.mesh = new Mesh(g, mat);
    this.mesh.name = 'gear-fx';
    this.mesh.layers.set(FX_LAYER);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  /** Switches the G3 variant (debug hook for the look sheets): clears the sprites, rebuilds the emitters. */
  setVariant(v: GearFxVariant): void {
    this.variant = v;
    this.n = 0;
    this.statsRef = null;
  }

  /** Per frame, after the hero view: pulses the glow edges, emits, moves and draws the sprites. */
  update(sim: Sim, hero: HeroView, alpha: number, dt: number): void {
    const t0 = performance.now();
    this.hero = hero;
    this.time += dt;
    if (sim.stats !== this.statsRef) this.equip(sim);
    // Glow edges: slow pulse plus a proc's flare (variant A's only proc signal).
    const pulse = 1.05 + 0.25 * Math.sin((this.time * Math.PI * 2) / PULSE_PERIOD);
    const decay = Math.exp(-dt / 0.22);
    this.weaponFlare *= decay;
    this.gearFlare *= decay;
    for (const [id, f] of this.steadyFlare) this.steadyFlare.set(id, f * decay);
    if (this.fx.some((f) => f.def.glow === 'weapon')) hero.rack.pulse(pulse + this.weaponFlare);
    GEAR_PULSE.value = this.fx.some((f) => f.def.glow === 'gear') ? pulse + this.gearFlare : 1;
    this.eyeCd -= dt;
    const alive = sim.player.state !== 'dead';
    // The Weltzeituhr's crit arms after a dodge: a glint at the ring.
    const armed = alive && sim.abilities.dcrit;
    if (armed && !this.armed) for (const f of this.fx) if (f.def.proc?.on === 'armed') this.fire(f, f.def.proc);
    this.armed = armed;
    if (this.variant !== 'A' && alive) this.emit(sim, alpha, dt);
    this.step(dt);
    let m = this.n;
    m = this.steady(m, pulse);
    if (this.variant === 'C' && this.auraColor && alive) m = this.aura(m, hero);
    this.geo.instanceCount = m;
    this.mesh.visible = m > 0;
    if (m > 0) {
      for (const name of ['iPos', 'iCol', 'iShape']) {
        const at = this.geo.getAttribute(name) as InstancedBufferAttribute;
        at.clearUpdateRanges();
        at.addUpdateRange(0, m * 4);
        at.needsUpdate = true;
      }
    }
    this.stats.sprites = m;
    this.stats.particles = this.n;
    this.stats.ms = performance.now() - t0;
  }

  /** Proc flashes from sim events (`legendaryProc`, `secondWind`, a hit on an elite or boss for the Auge). */
  onEvent(ev: SimEvent, sim: Sim): void {
    if (sim.stats !== this.statsRef) this.equip(sim);
    if (ev.type === 'legendaryProc') {
      const f = this.fx.find((x) => x.id === ev.id);
      if (f?.def.proc?.on === 'legendaryProc') this.fire(f, f.def.proc, ev.x, ev.z);
    } else if (ev.type === 'secondWind') {
      for (const f of this.fx) if (f.def.proc?.on === 'secondWind') this.fire(f, f.def.proc);
    } else if (ev.type === 'hit' && this.eyeCd <= 0) {
      const f = this.fx.find((x) => x.def.proc?.on === 'eliteHit');
      if (!f) return;
      const e = sim.enemies.find((x) => x.id === ev.id);
      if (!e || (!e.elite && !e.def.boss)) return;
      this.eyeCd = 0.35;
      this.fire(f, f.def.proc!, ev.x, ev.z);
    }
  }

  // ---------------------------------------------------------------- equip

  private equip(sim: Sim): void {
    this.statsRef = sim.stats;
    this.fx = equippedFx(sim.stats.legendary).map(({ id, def }) => ({ id, def, color: lin(def.color) }));
    const shimmer = (Object.keys(SET_FX) as SetId[]).find((id) => setCount(sim.equipment, id) >= 3);
    const list: GearFx['emitters'] = [];
    for (const f of this.fx) if (f.def.ambient?.length) f.def.ambient.forEach((amb, i) => list.push({ key: `${f.id}:${i}`, fx: f, amb, color: lin(amb.color) }));
    // The emitter budget counts items (an item's ambients are one emitter), weapon and armor first.
    const items = [...new Set(list.map((e) => e.fx!.id))].slice(0, GEAR_FX_EMITTERS);
    this.emitters = list.filter((e) => items.includes(e.fx!.id));
    if (this.variant === 'C' && shimmer && items.length < GEAR_FX_EMITTERS) this.emitters.push({ key: `set:${shimmer}`, fx: null, amb: SET_SHIMMER, color: lin(SET_FX[shimmer]) });
    this.stats.emitters = items.length + (this.emitters.some((e) => e.fx === null) ? 1 : 0);
    this.auraColor = this.fx[0]?.color ?? (shimmer ? lin(SET_FX[shimmer]) : null);
    this.acc.clear();
  }

  // ---------------------------------------------------------------- anchors

  /** A bone point (bind position plus `off`) in the bone's frame, cached. */
  private bone(name: string, off?: readonly [number, number, number]): { bone: Object3D; local: Vector3; r: number } | null {
    const key = `${name}|${off?.join() ?? ''}`;
    if (!this.anchors.has(key)) { const a = this.hero!.body.anchor(name, off); this.anchors.set(key, a ? { ...a, r: 0 } : null); }
    return this.anchors.get(key)!;
  }

  private gear(id: string): { bone: Object3D; local: Vector3; r: number } | null {
    const key = `gear|${id}`;
    if (!this.anchors.has(key)) {
      const c = this.hero!.body.gearCenter(id);
      const a = c ? this.hero!.body.anchor(c.bone, undefined, c.center) : null;
      this.anchors.set(key, a && c ? { ...a, r: Math.min(0.2, c.radius) } : null);
    }
    return this.anchors.get(key)!;
  }

  private world(a: { bone: Object3D; local: Vector3 }, out: Vector3): Vector3 {
    a.bone.updateWorldMatrix(true, false);
    return out.copy(a.local).applyMatrix4(a.bone.matrixWorld);
  }

  /** A point of `anchor` (`u` 0..1 along a line anchor, random when left out; `still`: no jitter). False if it has no point now. */
  private point(anchor: FxAnchor, out: Vector3, u?: number, still = false): boolean {
    const hero = this.hero!, r = this.rng;
    const jit = (rad: number): void => { if (rad > 0 && !still) out.add(_w.set(r.range(-rad, rad), r.range(-rad, rad), r.range(-rad, rad))); };
    switch (anchor.at) {
      case 'weapon': {
        if (hero.rack.model === null) return false;
        const a = Math.PI * 2 * r.next(), d = anchor.r * Math.sqrt(r.next());
        hero.rack.point(Math.cos(a) * d, lerp(anchor.y0, anchor.y1, u ?? r.next()), Math.sin(a) * d, out);
        return true;
      }
      case 'gear': {
        const g = this.gear(anchor.id);
        if (!g) return false;
        this.world(g, out);
        jit(g.r * 0.7);
        return true;
      }
      case 'bone': {
        const a = this.bone(anchor.bone, anchor.off);
        if (!a) return false;
        this.world(a, out);
        if (anchor.to) {
          const b = this.bone(anchor.to);
          if (b) out.lerp(this.world(b, _v), u ?? r.next());
        }
        jit(anchor.r);
        return true;
      }
      case 'feet': {
        const a = this.bone((this.foot ^= 1) ? 'ball_l' : 'ball_r');
        if (!a) return false;
        this.world(a, out).y += 0.03;
        jit(0.04);
        return true;
      }
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------- particles

  private spawn(s: Spawn): void {
    let i = this.n;
    if (i >= this.pool) {
      // Full: the particle nearest its end makes room (a proc beats old ambient sprites).
      let best = 0, most = -1;
      for (let j = 0; j < this.pool; j++) { const f = this.q[j * 12]! / this.q[j * 12 + 1]!; if (f > most) { most = f; best = j; } }
      i = best;
    } else this.n++;
    this.p.set([s.x, s.y, s.z], i * 3);
    this.v.set([s.vx, s.vy, s.vz], i * 3);
    this.col.set([s.col.r * s.k, s.col.g * s.k, s.col.b * s.k], i * 3);
    this.q.set([0, s.life, s.s0, s.s1, s.a0, s.grav, s.drag, s.kind, s.ang, s.spin, s.body, 0], i * 12);
  }

  /** Resets the reusable spawn to a plain glowing dot at (x, y, z). */
  private at(x: number, y: number, z: number, col: Color): Spawn {
    const s = this.sp;
    s.x = x; s.y = y; s.z = z; s.vx = 0; s.vy = 0; s.vz = 0; s.life = 0.5; s.s0 = 0.1; s.s1 = 0.05; s.a0 = 1;
    s.col.copy(col); s.k = 1.8; s.kind = DOT; s.body = 0; s.grav = 0; s.drag = 0; s.ang = 0; s.spin = 0;
    return s;
  }

  private emit(sim: Sim, alpha: number, dt: number): void {
    const r = this.rng, dodging = sim.player.state === 'dodge', shots = sim.abilities.projectiles;
    for (const e of this.emitters) {
      const amb = e.amb, anchor = amb.anchor ?? e.fx?.def.anchor;
      if (!anchor) continue;
      if (amb.when === 'dodge' && !dodging) continue;
      if (amb.when === 'armed' && !sim.abilities.dcrit) continue;
      const per = anchor.at === 'shots' ? shots.length : 1;
      if (per === 0) continue;
      let acc = Math.min(3, (this.acc.get(e.key) ?? 0) + amb.rate * this.scale * dt * per);
      while (acc >= 1) {
        acc -= 1;
        if (anchor.at === 'shots') {
          const q = shots[Math.floor(r.next() * shots.length)]!;
          const t = r.next();
          _v.set(lerp(q.px, q.x, t * alpha), 0, lerp(q.pz, q.z, t * alpha));
          _v.y = groundY(_v.x, _v.z) + 1.15;
        } else if (!this.point(anchor, _v)) break;
        const s = this.at(_v.x, _v.y, _v.z, e.color);
        const spread = amb.spread ?? 0;
        s.vx = r.range(-spread, spread); s.vz = r.range(-spread, spread); s.vy = amb.rise;
        s.life = amb.life * r.range(0.8, 1.2);
        s.s0 = amb.size; s.s1 = amb.sprite === 'feather' ? amb.size : amb.size * 0.45;
        s.kind = KIND[amb.sprite];
        s.body = amb.body ?? 0;
        s.k = s.body > 0 ? 1 : e.fx ? 1.9 : 1.4;
        s.grav = amb.gravity ?? 0;
        s.drag = 0.6;
        if (amb.sprite === 'feather') { s.ang = r.range(-1, 1); s.spin = r.range(-1.5, 1.5); }
        this.spawn(s);
      }
      this.acc.set(e.key, acc);
    }
  }

  private step(dt: number): void {
    const { p, v, q, col } = this;
    for (let i = 0; i < this.n;) {
      const o = i * 12;
      q[o] = q[o]! + dt;
      if (q[o]! >= q[o + 1]!) {
        // Swap the last one in.
        const l = --this.n;
        if (i !== l) {
          p.copyWithin(i * 3, l * 3, l * 3 + 3); v.copyWithin(i * 3, l * 3, l * 3 + 3); col.copyWithin(i * 3, l * 3, l * 3 + 3); q.copyWithin(o, l * 12, l * 12 + 12);
        }
        continue;
      }
      const drag = Math.exp(-q[o + 6]! * dt);
      v[i * 3 + 1] = v[i * 3 + 1]! + q[o + 5]! * dt;
      for (let k = 0; k < 3; k++) { v[i * 3 + k] = v[i * 3 + k]! * drag; p[i * 3 + k] = p[i * 3 + k]! + v[i * 3 + k]! * dt; }
      q[o + 8] = q[o + 8]! + q[o + 9]! * dt;
      // Write the instance.
      const t = q[o]! / q[o + 1]!, kind = q[o + 7]!;
      const fade = kind === GLINT ? Math.sin(Math.PI * t) ** 0.7 : Math.min(1, q[o]! / 0.05) * (1 - t) ** 1.3;
      this.iPos.set([p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!, lerp(q[o + 2]!, q[o + 3]!, t)], i * 4);
      this.iCol.set([col[i * 3]!, col[i * 3 + 1]!, col[i * 3 + 2]!, q[o + 4]! * fade], i * 4);
      this.iShape.set([kind, q[o + 8]!, q[o + 10]!, 0], i * 4);
      i++;
    }
  }

  /** Steady glows of the items without a model (talisman, ring, implant), after the particles. */
  private steady(m: number, pulse: number): number {
    for (const f of this.fx) {
      const st = f.def.steady;
      if (!st) continue;
      const count = st.count ?? 1, flare = this.steadyFlare.get(f.id) ?? 0;
      let k = 0.85 + 0.15 * pulse;
      if (st.beat) {
        const b = this.time % 1.2;
        k = 0.8 + 0.5 * (Math.exp(-((b - 0.05) ** 2) * 400) + 0.7 * Math.exp(-((b - 0.3) ** 2) * 400));
      }
      for (let i = 0; i < count && m < this.cap; i++) {
        if (!this.point(f.def.anchor, _v, (i + 0.5) / count, true)) break;
        this.iPos.set([_v.x, _v.y, _v.z, st.size * k * (1 + flare)], m * 4);
        this.iCol.set([f.color.r * 1.8, f.color.g * 1.8, f.color.b * 1.8, Math.min(1, 0.75 * k + flare)], m * 4);
        this.iShape.set([st.sprite === 'glint' ? GLINT : DOT, this.time * 0.3, 0, 0], m * 4);
        m++;
      }
    }
    return m;
  }

  /** Variant C: a soft disc of the first legendary's (or the set's) colour on the ground under the hero. */
  private aura(m: number, hero: HeroView): number {
    if (m >= this.cap) return m;
    const x = hero.root.position.x, z = hero.root.position.z, c = this.auraColor!;
    const k = 0.85 + 0.15 * Math.sin(this.time * 2.4);
    this.iPos.set([x, groundY(x, z) + 0.04, z, 2.1], m * 4);
    this.iCol.set([c.r * 1.2, c.g * 1.2, c.b * 1.2, 0.34 * k], m * 4);
    this.iShape.set([DISC, 0, 0, 0], m * 4);
    return m + 1;
  }

  // ---------------------------------------------------------------- proc flashes

  /** A proc: the glow flares (all variants); B and C also burst from the pool at the event and/or the item. */
  private fire(f: Fx, proc: FxProc, ex?: number, ez?: number): void {
    if (f.def.glow === 'weapon') this.weaponFlare = 1.6;
    else if (f.def.glow === 'gear') this.gearFlare = 1.6;
    if (f.def.steady) this.steadyFlare.set(f.id, 1.2);
    if (this.variant === 'A' || !this.hero) return;
    const col = _c.setStyle(proc.color).clone();
    const n = Math.max(2, Math.round(proc.count * Math.max(0.5, this.scale)));
    const where = ex !== undefined && ez !== undefined ? proc.at : 'anchor';
    if (where === 'event' || where === 'both') this.burst(proc.burst, ex!, ez!, null, col, where === 'both' ? Math.ceil(n * 0.65) : n);
    if (where === 'anchor' || where === 'both') {
      if (!this.point(f.def.anchor, _v)) this.hero.root.getWorldPosition(_v).y += 1.2;
      this.burst(proc.burst, _v.x, _v.z, _v.y, col, where === 'both' ? Math.max(2, Math.floor(n * 0.35)) : n);
    }
  }

  /** A burst at (x, z); `y` null: hit height (or the ground for dust) over the ground there. */
  private burst(kind: FxBurst, x: number, z: number, y: number | null, col: Color, n: number): void {
    const r = this.rng, g = groundY(x, z), h = y ?? g + 1.1;
    const out = (sp: number, up: number, s: Spawn): void => {
      const a = Math.PI * 2 * r.next(), k = r.range(0.4, 1) * sp;
      s.vx = Math.sin(a) * k; s.vz = Math.cos(a) * k; s.vy = up;
    };
    switch (kind) {
      case 'embers': {
        for (let i = 0; i < n; i++) {
          const s = this.at(x, h, z, col);
          out(2.4, r.range(0.8, 2.4), s);
          s.col.lerp(HOT, r.next() * 0.5);
          s.life = r.range(0.55, 0.95); s.s0 = r.range(0.06, 0.1); s.s1 = 0.02; s.grav = -2.5; s.drag = 1.5; s.k = r.range(1.8, 2.8);
          this.spawn(s);
        }
        const s = this.at(x, h, z, col);
        s.kind = GLINT; s.life = 0.2; s.s0 = 0.4; s.s1 = 0.3; s.k = 2.4;
        this.spawn(s);
        break;
      }
      case 'sparks': {
        for (let i = 0; i < n; i++) {
          const s = this.at(x, h, z, col);
          out(4.2, r.range(0.5, 2.5), s);
          s.kind = GLINT; s.life = r.range(0.2, 0.35); s.s0 = 0.11; s.s1 = 0.03; s.grav = -5; s.drag = 3; s.k = 2.4;
          this.spawn(s);
        }
        const s = this.at(x, h, z, col);
        s.kind = HALO; s.life = 0.25; s.s0 = 0.2; s.s1 = 0.75; s.k = 2;
        this.spawn(s);
        break;
      }
      case 'splash': {
        for (let i = 0; i < n; i++) {
          const s = this.at(x, h, z, col);
          out(1.8, r.range(1.5, 3), s);
          s.kind = DROP; s.life = r.range(0.5, 0.75); s.s0 = 0.07; s.s1 = 0.045; s.grav = -9.8; s.drag = 0.3; s.body = 0.25; s.k = 1.7;
          this.spawn(s);
        }
        this.ring(this.hero!.root.position.x, this.hero!.root.position.z, col, 0.3, 2.2, 0.45, 0.9, 0);
        break;
      }
      case 'dust': {
        this.ring(x, z, col, 0.4, 2.6, 0.55, 0.7, 0.5);
        for (let i = 1; i < n; i++) {
          const s = this.at(x, g + r.range(0.15, 0.5), z, col);
          out(2.2, r.range(0.2, 0.6), s);
          s.life = r.range(0.6, 0.9); s.s0 = 0.16; s.s1 = 0.36; s.a0 = 0.5; s.drag = 2.5; s.body = 0.6; s.k = 0.9;
          this.spawn(s);
        }
        break;
      }
      case 'glint': {
        const s = this.at(x, h, z, col);
        s.kind = GLINT; s.life = 0.32; s.s0 = 0.42; s.s1 = 0.3; s.k = 2.6;
        this.spawn(s);
        for (let i = 1; i < n; i++) {
          const t = this.at(x + r.range(-0.1, 0.1), h + r.range(-0.1, 0.1), z + r.range(-0.1, 0.1), col);
          t.kind = GLINT; t.life = r.range(0.18, 0.3); t.s0 = 0.13; t.s1 = 0.08; t.k = 2.2;
          this.spawn(t);
        }
        break;
      }
      case 'flash': {
        const s = this.at(x, h, z, col);
        s.life = 0.16; s.s0 = 0.6; s.s1 = 1.1; s.a0 = 0.9; s.k = 2.2;
        this.spawn(s);
        const t = this.at(x, h, z, col);
        t.kind = GLINT; t.life = 0.24; t.s0 = 0.55; t.s1 = 0.4; t.k = 2.6;
        this.spawn(t);
        for (let i = 2; i < n; i++) {
          const u = this.at(x, h, z, col);
          out(3.4, r.range(0.4, 2), u);
          u.kind = GLINT; u.life = r.range(0.18, 0.3); u.s0 = 0.09; u.s1 = 0.03; u.grav = -4; u.drag = 3; u.k = 2.2;
          this.spawn(u);
        }
        break;
      }
      case 'sheen': {
        for (let i = 0; i < n; i++) {
          const s = this.at(x + r.range(-0.3, 0.3), h + r.range(-0.6, 0.5), z + r.range(-0.3, 0.3), col);
          s.vy = r.range(0.2, 0.5); s.life = r.range(0.45, 0.7); s.s0 = 0.1; s.s1 = 0.05; s.k = 1.6;
          this.spawn(s);
        }
        break;
      }
      case 'pulse': {
        const s = this.at(x, h, z, col);
        s.kind = HALO; s.life = 0.4; s.s0 = 0.15; s.s1 = 0.75; s.k = 2;
        this.spawn(s);
        const t = this.at(x, h, z, col);
        t.life = 0.25; t.s0 = 0.35; t.s1 = 0.2; t.k = 2;
        this.spawn(t);
        for (let i = 2; i < n; i++) {
          const u = this.at(x, h, z, col);
          const a = Math.PI * 2 * r.next(), b = r.range(-0.8, 0.8), sp = r.range(1.1, 1.8);
          u.vx = Math.cos(a) * Math.cos(b) * sp; u.vy = Math.sin(b) * sp; u.vz = Math.sin(a) * Math.cos(b) * sp;
          u.life = 0.4; u.s0 = 0.07; u.s1 = 0.02; u.drag = 1.5; u.k = 2;
          this.spawn(u);
        }
        break;
      }
    }
  }

  /** A ring on the ground that grows from `s0` to `s1` m across over `life` s. */
  private ring(x: number, z: number, col: Color, s0: number, s1: number, life: number, a0: number, body: number): void {
    const s = this.at(x, groundY(x, z) + 0.05, z, col);
    s.kind = RING; s.life = life; s.s0 = s0; s.s1 = s1; s.a0 = a0; s.body = body; s.k = body > 0 ? 1 : 1.6;
    this.spawn(s);
  }
}

