// Element status marks on enemies (E1, `docs/tasks/e1-element-visuals.md`): flames on burning bodies,
// a bubbling puddle and drips on corroded ones, arcs on bodies a shock just hit, a cold ring under
// slowed ones. All marks of all enemies are instances of one quad with one procedural shader: one
// draw call however many enemies carry a status, none while nobody does. No texture, no light.
// Reads sim state only; the shock timer is render state (the sim keeps no shock status).
import { BufferAttribute, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NormalBlending, ShaderMaterial } from 'three';
import type { BodyKind } from '../data/enemies';
import { lerp } from '../sim/math';
import type { Enemy, Sim } from '../sim/types';
import { groundY } from './ground';
import { FX_LAYER } from './layers';

/** Most marks drawn at once; a burning, corroded and shocked enemy uses up to six. */
const MAX = 192;
/** How long a shock hit keeps its arcs on the body. */
export const ZAP_TIME = 0.55;

// Mark kinds (the shader branches on them). Billboards face the camera, the rest lie on the ground.
const FLAME = 0, DRIPS = 1, ARCS = 2, COLD_RING = 3, PUDDLE = 4, FIRE_GLOW = 5, ARC_GLOW = 6;

/** Rough standing height of a body in meters at scale 1 (marks only; hitboxes come from the sim). */
const HEIGHT: Partial<Record<BodyKind, number>> = { rat: 0.55, crow: 0.7, drone: 0.8, raptor: 1.5, rex: 3.4, koloss: 3.6, clock: 4.2, mechBig: 3.6, mech: 2.3, kern: 1.6 };
/** Flying bodies: height of the body above the ground. */
const LIFT: Partial<Record<BodyKind, number>> = { crow: 1.3, drone: 1.5 };

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iBox;
attribute float iKind;
varying vec2 vUv;
varying vec3 vData;
void main() {
  vUv = uv;
  vData = vec3(iBox.z, iBox.w, iKind);
  vec3 p;
  if (iKind > 2.5) {
    p = iPos + vec3(position.x * iBox.x, 0.0, -position.y * iBox.x);
  } else {
    // Faces the camera, anchored at the feet. Pulled toward the camera by most of the body height: seen from
    // above the head is that much nearer than the feet, and the mark has to lie over the whole body.
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    p = iPos + right * position.x * iBox.x + up * (position.y + 0.5) * iBox.y + normalize(cameraPosition - iPos) * (iBox.y * 0.75 + iBox.x * 0.4);
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float time;
varying vec2 vUv;
varying vec3 vData;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Straight segments between random heights: the zigzag of an arc.
float zig(float x, float s) { float i = floor(x); return mix(hash(vec2(i, s)), hash(vec2(i + 1.0, s)), fract(x)); }
void main() {
  float seed = vData.x, k = vData.z;
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  vec3 col = vec3(0.0);
  float a = 0.0, body = 0.0;
  if (k < 0.5) {
    // Flame: two noise layers scroll upward through a shape that narrows to the top; three hard colour steps.
    float n = noise(vec2(uv.x * 3.2 + seed * 9.0, uv.y * 2.6 - time * 2.6)) * 0.65 + noise(vec2(uv.x * 7.0 + seed * 3.0, uv.y * 5.5 - time * 4.2)) * 0.35;
    float m = n * 1.5 + (1.0 - p.x * p.x) * 0.6 - uv.y * 1.6 - 0.5;
    a = smoothstep(0.0, 0.08, m) * smoothstep(0.0, 0.08, uv.y);
    col = mix(vec3(1.0, 0.13, 0.02), vec3(1.0, 0.4, 0.04), smoothstep(0.22, 0.3, m));
    col = mix(col, vec3(1.0, 0.75, 0.22), smoothstep(0.85, 0.95, m)) * 1.15;
    body = 0.7;
  } else if (k < 1.5) {
    // Drips: teardrops fall in five columns, in a faint green haze.
    float cx = uv.x * 5.0, c = floor(cx), h = hash(vec2(c, seed * 13.0));
    float y = fract(uv.y * 2.0 + time * (0.9 + h * 0.9) + h * 5.0);
    float fx = abs(fract(cx) - 0.5) * 2.0;
    float w = mix(0.55, 0.14, min(1.0, y * 2.2));
    float drop = smoothstep(w, w * 0.4, fx) * smoothstep(0.0, 0.06, y) * smoothstep(0.34, 0.08, y) * step(0.3, h);
    float env = smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.75, uv.y) * smoothstep(1.0, 0.7, abs(p.x));
    float haze = exp(-dot(p, p) * 2.2) * (0.16 + 0.1 * noise(p * 2.0 + vec2(seed * 7.0, -time)));
    a = drop * env + haze;
    col = mix(vec3(0.35, 1.0, 0.12), vec3(0.85, 1.0, 0.5), drop * env) * 1.5;
    body = 0.45;
  } else if (k < 2.5) {
    // Arcs: a broken jagged ring round the body and one bolt through it, redrawn 16 times a second.
    float fr = floor(time * 16.0) + seed * 31.0;
    float ang = atan(p.y, p.x);
    float rr = 0.62 + (zig(ang * 2.4 + fr * 3.7, 7.0) - 0.5) * 0.44;
    float ring = smoothstep(0.1, 0.0, abs(r - rr)) * step(0.35, hash(vec2(floor(ang * 1.3 + fr), fr)));
    float bx = 0.5 + (zig(uv.y * 7.0 + fr * 5.3, 3.0) - 0.5) * 0.55;
    float bolt = smoothstep(0.08, 0.0, abs(uv.x - bx)) * smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
    float on = 0.25 + 0.75 * step(0.3, hash(vec2(fr, 3.0)));
    float line = max(ring, bolt);
    a = line * on + exp(-r * r * 3.0) * 0.12;
    col = mix(vec3(0.2, 0.62, 1.0), vec3(0.85, 0.95, 1.0), smoothstep(0.6, 1.0, line)) * 1.5;
  } else if (k < 3.5) {
    // Cold ring: a pale dashed band that creeps round, with a faint fill.
    float ang = atan(p.y, p.x);
    float ring = smoothstep(0.07, 0.0, abs(r - 0.86));
    float dash = step(0.45, fract(ang / 6.2832 * 8.0 - time * 0.2));
    a = ring * (0.4 + 0.6 * dash) + (1.0 - smoothstep(0.0, 0.84, r)) * 0.1;
    col = vec3(0.5, 0.74, 1.0);
    body = 0.2;
  } else if (k < 4.5) {
    // Puddle: a wobbling green pool with a bright rim and bubbles that grow and burst.
    float edge = 0.72 + 0.2 * noise(p * 2.0 + vec2(seed * 5.0, time * 0.3));
    float fill = smoothstep(edge, edge - 0.12, r);
    vec2 g = p * 3.0 + seed * 4.0;
    vec2 cell = floor(g);
    float ph = fract(time * (0.6 + hash(cell) * 0.6) + hash(cell + 3.0));
    float bub = smoothstep(0.08, 0.0, abs(length(fract(g) - 0.5) - ph * 0.4)) * (1.0 - ph);
    float rim = smoothstep(0.1, 0.0, abs(r - edge + 0.07));
    a = fill * (0.5 + bub * 1.3) + rim * 0.5;
    col = mix(vec3(0.3, 0.85, 0.1), vec3(0.8, 1.0, 0.45), min(1.0, bub + rim)) * 1.3;
    body = 0.7;
  } else {
    // Ground glow of a flame or of arcs: stands in for a light.
    float fire = step(k, 5.5);
    float fr = floor(time * 16.0) + seed * 31.0;
    float beat = mix(0.25 + 0.75 * step(0.3, hash(vec2(fr, 3.0))), 0.8 + 0.2 * sin(time * 11.0 + seed * 40.0), fire);
    a = exp(-r * r * 3.5) * beat * mix(0.3, 0.38, fire);
    col = mix(vec3(0.3, 0.7, 1.0), vec3(1.0, 0.4, 0.08), fire);
  }
  a *= vData.y;
  if (a < 0.004) discard;
  // Premultiplied: 'body' 0 adds light only, 1 covers what is behind (the puddle shows on bright ground too).
  gl_FragColor = vec4(col * a, min(1.0, a) * body);
}`;

export class StatusMarks {
  readonly mesh: Mesh;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly box = new Float32Array(MAX * 4);
  private readonly kind = new Float32Array(MAX);
  private readonly geo = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly zaps = new Map<number, number>();
  private n = 0;

  /** `ground`: also draw the glow on the ground under flames and arcs (off on Leistung). */
  constructor(private readonly ground: boolean) {
    const g = this.geo;
    g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iPos', new InstancedBufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute('iBox', new InstancedBufferAttribute(this.box, 4).setUsage(DynamicDrawUsage));
    g.setAttribute('iKind', new InstancedBufferAttribute(this.kind, 1).setUsage(DynamicDrawUsage));
    g.instanceCount = 0;
    this.material = new ShaderMaterial({
      uniforms: { time: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG,
      blending: NormalBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, fog: false,
    });
    this.mesh = new Mesh(g, this.material);
    this.mesh.layers.set(FX_LAYER);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /** A shock hit landed on this enemy: arcs for `ZAP_TIME`. */
  shock(id: number): void {
    this.zaps.set(id, ZAP_TIME);
  }

  private add(kind: number, x: number, y: number, z: number, w: number, h: number, seed: number, strength: number): void {
    const i = this.n;
    if (i >= MAX) return;
    this.n++;
    this.pos.set([x, y, z], i * 3);
    this.box.set([w, h, seed, strength], i * 4);
    this.kind[i] = kind;
  }

  update(sim: Sim, alpha: number, dt: number, time: number): void {
    this.n = 0;
    for (const [id, t] of this.zaps) {
      if (t - dt <= 0) this.zaps.delete(id); else this.zaps.set(id, t - dt);
    }
    for (const e of sim.enemies) {
      if (e.state === 'dead') continue;
      const zap = this.zaps.get(e.id) ?? 0, slow = e.slow ?? 0;
      if (e.burn <= 0 && e.acid <= 0 && zap <= 0 && slow <= 0) continue;
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha), y = groundY(x, z);
      const size = bodySize(e);
      const seed = (e.id * 0.618) % 1;
      const by = y + size.lift;
      if (e.burn > 0) {
        const k = Math.min(1, e.burn * 4);
        this.add(FLAME, x, by, z, size.w * 1.5, size.h * 1.5, seed, k);
        if (this.ground) this.add(FIRE_GLOW, x, y + 0.05, z, size.w * 2.6, 0, seed, k);
      }
      if (e.acid > 0) {
        const k = Math.min(1, e.acid * 3);
        this.add(PUDDLE, x, y + 0.06, z, size.w * 1.9, 0, seed, k);
        this.add(DRIPS, x, by, z, size.w * 1.05, size.h, seed, k);
      }
      if (zap > 0) {
        const k = Math.min(1, zap * 5);
        this.add(ARCS, x, by, z, size.w * 1.5, size.h * 1.15, seed, k);
        if (this.ground) this.add(ARC_GLOW, x, y + 0.05, z, size.w * 2.4, 0, seed, k);
      }
      if (slow > 0) this.add(COLD_RING, x, y + 0.07, z, size.w * 2.1, 0, seed, Math.min(1, slow * 3));
    }
    this.geo.instanceCount = this.n;
    this.mesh.visible = this.n > 0;
    if (this.n === 0) return;
    this.material.uniforms.time!.value = time % 600;
    for (const name of ['iPos', 'iBox', 'iKind']) {
      const at = this.geo.getAttribute(name) as InstancedBufferAttribute;
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.n * at.itemSize);
      at.needsUpdate = true;
    }
  }
}

/** Width, height and lift of the marks on this body. */
export function bodySize(e: Enemy): { w: number; h: number; lift: number } {
  const s = e.def.scale * (e.elite ? 1.15 : 1);
  return { w: Math.max(0.7, e.def.radius * 2.4), h: (HEIGHT[e.def.body] ?? 1.85) * s, lift: LIFT[e.def.body] ?? 0 };
}
