// P18 ambient animals (docs/tasks/m11c-animals.md): ducks on water, pigeons on paved ground, rats by walls, bins
// and rubble, and rats only in the U-Bahn tunnels. Cosmetic and render side only: reads the map, the hero and the
// enemies, never writes the sim; no collision and no gameplay effect.
//
// Models: `assets/critters/animals.glb`, three rigid meshes (Pixal3D from FLUX.2 klein pictures, baked low) on one
// 512 px atlas (`tools/build-critters.mjs`). All motion is procedural here: ducks bob, paddle and dip; pigeons walk
// with a nod, peck, and fly off as a flock when the hero or an enemy comes close (two code-built wings flap
// while they fly); rats sniff, dash along walls and run from the hero.
//
// Constant cost: a fixed pool per kind, filled in a ring around the view and dropped far away. One InstancedMesh per
// kind, all on one material and texture: at most 3 draw calls, a 4th while pigeons fly (plus the same in the shadow
// pass on Qualität). No lights, no skinning. Leistung halves the pools.
import {
  BufferAttribute, BufferGeometry, Color, DataTexture, DynamicDrawUsage, Euler, Group, InstancedMesh, Matrix4, Quaternion,
  SRGBColorSpace, Vector3, type Mesh, type MeshStandardMaterial, type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WATER_Y, type MapDef } from '../data/map';
import { Rng } from '../sim/math';
import type { Sim } from '../sim/types';
import { ColliderIndex, CrownIndex, critterKinds, duckSite, pigeonSite, ratFree, ratSite, site, type CritterKind, type SiteWorld } from './critter-sites';
import { groundY } from './ground';
import type { Materials } from './materials';
import type { Profile } from './profile';

const MODELS = new URL('../../assets/critters/animals.glb', import.meta.url).href;

/** Spawn ring around the view centre (m): new groups appear off screen; the first fill and a jump also fill the view. */
export const RING = { min: 22, max: 32, drop: 40 } as const;
/** The view centre lies this far north of the hero (the camera looks north from the south). */
const VIEW_Z = -4;
/** Seconds between spawn probes; probes per kind each time, and per frame of a fill (spread over `FILL_FRAMES`). */
const PROBE_EVERY = 0.2;
const PROBES = 3;
const FILL_PROBES = 30;
const FILL_FRAMES = 3;

interface KindDef {
  /** Groups at once (Leistung: half, at least 1), animals per group, how far apart they keep. */
  groups: number;
  size: readonly [number, number];
  spread: number;
  /** Alarm distance to the hero and to an enemy (m). */
  scare: readonly [number, number];
  /** Model size along its length (m, nose to tail, rendered about 1.3 × real so it reads from the camera). */
  length: number;
}
export const CRITTER: Record<CritterKind, KindDef> = {
  duck: { groups: 2, size: [2, 4], spread: 3.5, scare: [6, 4], length: 0.72 },
  pigeon: { groups: 2, size: [4, 7], spread: 2.2, scare: [4.5, 3.5], length: 0.42 },
  rat: { groups: 4, size: [1, 1], spread: 0, scare: [5, 3], length: 0.52 },
};
/** Rats are the only animals underground, so there are more of them. */
const TUNNEL_RATS = 7;

type State = 'idle' | 'walk' | 'peck' | 'swim' | 'dip' | 'sniff' | 'dash' | 'flee';

interface Flight { x0: number; z0: number; y0: number; x1: number; z1: number; y1: number; h: number; t: number; dur: number; land: boolean }

interface Animal {
  on: boolean;
  g: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Nose down positive. */
  pitch: number;
  roll: number;
  state: State;
  t: number;
  dur: number;
  tx: number;
  tz: number;
  ph: number;
  scale: number;
  tint: Color;
  /** Pigeons: seconds after the flock's alarm before this one takes off; its flight; the wing angle while flying. */
  delay: number;
  f: Flight | null;
  flap: number;
}

interface Herd { on: boolean; x: number; z: number; alarm: number; ax: number; az: number; lx: number; lz: number; land: boolean }

class Pool {
  readonly animals: Animal[] = [];
  readonly herds: Herd[] = [];
  constructor(readonly kind: CritterKind, readonly mesh: InstancedMesh, size: number, herds: number) {
    for (let i = 0; i < size; i++) {
      this.animals.push({
        on: false, g: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, state: 'idle', t: 0, dur: 0, tx: 0, tz: 0, ph: 0, scale: 1,
        tint: new Color(1, 1, 1), delay: 0, f: null, flap: NaN,
      });
    }
    for (let i = 0; i < herds; i++) this.herds.push({ on: false, x: 0, z: 0, alarm: -1, ax: 0, az: 0, lx: 0, lz: 0, land: false });
  }
}

/** One wing (root at the origin, span along +x, forward +z), both faces, UVs in the atlas' wing cell. */
function wingGeometry(span: number, chord: number): BufferGeometry {
  // Leading edge nearly straight, trailing edge swept back to a rounded tip.
  const outline: Array<[number, number]> = [[0, 0.35], [0.45, 0.32], [0.82, 0.18], [1, -0.05], [0.9, -0.42], [0.55, -0.6], [0.2, -0.62], [0, -0.55]];
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (const [u, w] of outline) {
      pos.push(u * span, 0, w * chord);
      nor.push(0, side, 0);
      // Wing cell: the lower right quarter of the atlas (glTF UVs, v down), 8 px inside its border.
      uv.push(0.5 + (8 + u * 240) / 512, 0.5 + (8 + (0.4 - w) * 240) / 512);
    }
    for (let i = 1; i < outline.length - 1; i++) {
      if (side > 0) idx.push(base, base + i + 1, base + i);
      else idx.push(base, base + i, base + i + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

/** A stand-in until the file loads: the real attribute set, no instances drawn (so the shader compiles up front). */
function stub(): BufferGeometry {
  const g = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) g.setAttribute(name, new BufferAttribute(new Float32Array(3 * size), size));
  return g;
}

const euler = new Euler(0, 0, 0, 'YXZ');
const quat = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const mat = new Matrix4();
const wingM = new Matrix4();
const tmpM = new Matrix4();
const TAU = Math.PI * 2;

export class Critters {
  readonly group = new Group();
  private readonly pools: Pool[] = [];
  private readonly wings: InstancedMesh | null = null;
  private readonly rng: Rng;
  private world: SiteWorld | null = null;
  private level: unknown = null;
  private time = 0;
  private probeT = 0;
  /** Frames of a fill still to run (start, restart, jump). */
  private fill = FILL_FRAMES;
  private cx = 0;
  private cz = 0;
  /** Pigeon size from the model (for the wing roots); the defaults hold until the file is in. */
  private body = { w: 0.14, h: 0.3, l: 0.42 };
  /** Duck draft below the water line (m). */
  private draft = 0.09;
  private readonly threats: Array<{ x: number; z: number; hero: boolean }> = [];
  /** CPU time of the last update (ms), for the handover numbers. */
  ms = 0;

  /** `trees`: tree crowns (pigeons keep out from under them); `load: false` skips the model file (tests). */
  constructor(materials: Materials, private readonly m: MapDef, profile: Profile, private readonly opts: { trees?: ReadonlyArray<{ x: number; z: number; r: number }>; load?: boolean } = {}) {
    this.rng = new Rng(m.seed * 7919 + 17);
    const kinds = critterKinds(m);
    if (kinds.length === 0) return;
    const blank = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    blank.colorSpace = SRGBColorSpace;
    blank.needsUpdate = true;
    const material = materials.surface({ map: blank, roughness: 0.9 });
    const lean = profile.id === 'leistung';
    const shadows = profile.enemyShadows;
    const make = (count: number): InstancedMesh => {
      const mesh = new InstancedMesh(stub(), material, count);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      // Every mesh gets instance colours, so they all share one shader program.
      mesh.setColorAt(0, new Color(1, 1, 1));
      mesh.instanceColor!.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      // The bounds would have to follow every animal; they are all near the camera anyway.
      mesh.frustumCulled = false;
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    for (const kind of kinds) {
      const d = CRITTER[kind];
      let herds = kind === 'rat' && m.tunnel ? TUNNEL_RATS : d.groups;
      if (lean) herds = Math.max(1, Math.floor(herds / 2));
      const size = herds * d.size[1];
      this.pools.push(new Pool(kind, make(size), size, herds));
    }
    const pigeons = this.pools.find((p) => p.kind === 'pigeon');
    if (pigeons) {
      this.wings = make(pigeons.animals.length * 2);
      this.wings.geometry.dispose();
      this.wings.geometry = wingGeometry(0.3, 0.13);
    }
    if (opts.load ?? true) this.load(material);
    if (import.meta.env?.DEV) (globalThis as { __critters?: Critters }).__critters = this;
  }

  private load(material: MeshStandardMaterial): void {
    new GLTFLoader().loadAsync(MODELS).then((gltf) => {
      let map: Texture | null = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        const src = o as Mesh;
        if (!src.isMesh) return;
        const pool = this.pools.find((p) => src.name.startsWith(p.kind) || src.parent?.name.startsWith(p.kind));
        if (!pool) return;
        const geo = src.geometry.clone().applyMatrix4(src.matrixWorld);
        geo.deleteAttribute('color');
        geo.computeBoundingBox();
        const b = geo.boundingBox!;
        if (pool.kind === 'pigeon') this.body = { w: b.max.x - b.min.x, h: b.max.y - b.min.y, l: b.max.z - b.min.z };
        if (pool.kind === 'duck') this.draft = (b.max.y - b.min.y) * 0.3;
        pool.mesh.geometry.dispose();
        pool.mesh.geometry = geo;
        map ??= (src.material as MeshStandardMaterial).map;
      });
      if (map) material.map = map;
      if (this.wings) {
        this.wings.geometry.dispose();
        this.wings.geometry = wingGeometry(this.body.l * 0.82, this.body.l * 0.34);
      }
    }).catch((e: unknown) => console.warn('Critter models did not load', e));
  }

  /** Counts per kind (dev checks and tests). */
  counts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of this.pools) out[p.kind] = p.animals.filter((a) => a.on).length;
    out.flying = this.pools.find((p) => p.kind === 'pigeon')?.animals.filter((a) => a.on && a.f).length ?? 0;
    return out;
  }

  /** Positions of the live animals (tests). */
  live(): Array<{ kind: CritterKind; x: number; z: number; flying: boolean }> {
    return this.pools.flatMap((p) => p.animals.filter((a) => a.on).map((a) => ({ kind: p.kind, x: a.x, z: a.z, flying: !!a.f })));
  }

  /** New run or restart: drop every animal and fill the view again. */
  reset(): void {
    for (const p of this.pools) {
      for (const a of p.animals) a.on = false;
      for (const h of p.herds) h.on = false;
    }
    this.fill = FILL_FRAMES;
  }

  update(sim: Sim, dt: number, px: number, pz: number): void {
    if (this.pools.length === 0) return;
    const t0 = performance.now();
    if (this.level !== sim.level) {
      this.level = sim.level;
      this.world = { m: this.m, level: sim.level, index: new ColliderIndex(sim.level.colliders), crowns: new CrownIndex(this.opts.trees ?? []) };
      this.reset();
    }
    const w = this.world!;
    this.time += dt;
    const cx = px, cz = pz + VIEW_Z;
    // A jump (start at an encounter, a teleport, the lift) fills the new view at once.
    if (Math.hypot(cx - this.cx, cz - this.cz) > 25) this.reset();
    this.cx = cx;
    this.cz = cz;
    this.threats.length = 0;
    this.threats.push({ x: px, z: pz, hero: true });
    for (const e of sim.enemies) if (e.state !== 'dead' && Math.abs(e.x - cx) < RING.drop && Math.abs(e.z - cz) < RING.drop) this.threats.push({ x: e.x, z: e.z, hero: false });

    this.probeT -= dt;
    const filling = this.fill > 0, probe = filling || this.probeT <= 0;
    if (probe) this.probeT = PROBE_EVERY;
    for (const pool of this.pools) {
      this.drop(pool);
      if (probe) this.spawn(pool, w, filling);
      if (pool.kind === 'duck') this.ducks(pool, w, dt);
      else if (pool.kind === 'pigeon') this.pigeons(pool, w, dt);
      else this.rats(pool, w, dt);
      this.write(pool);
    }
    if (filling) this.fill--;
    this.ms = performance.now() - t0;
  }

  // ------------------------------------------------------------------ spawning

  private drop(pool: Pool): void {
    for (const a of pool.animals) if (a.on && Math.hypot(a.x - this.cx, a.z - this.cz) > RING.drop) a.on = false;
    for (let g = 0; g < pool.herds.length; g++) {
      const h = pool.herds[g]!;
      if (h.on && !pool.animals.some((a) => a.on && a.g === g)) h.on = false;
    }
  }

  private spawn(pool: Pool, w: SiteWorld, fill: boolean): void {
    const d = CRITTER[pool.kind], B = this.m.bounds;
    for (let p = 0; p < (fill ? FILL_PROBES : PROBES); p++) {
      const g = pool.herds.findIndex((h) => !h.on);
      if (g < 0) return;
      // A fill aims its first two thirds of probes at the visible ground (about 24 × 15 m: 12 m north to 3 m south of the
      // hero at the normal zoom), so even the small Leistung pools start in view; the rest go to the ring.
      const r = this.rng.range(RING.min, RING.max), ang = this.rng.next() * TAU, view = fill && p < (FILL_PROBES * 2) / 3;
      const x = view ? this.cx + this.rng.range(-12, 12) : this.cx + Math.sin(ang) * r;
      const z = view ? this.cz + this.rng.range(-8, 7) : this.cz + Math.cos(ang) * r;
      if (x < B.minX + 2 || x > B.maxX - 2 || z < B.minZ + 2 || z > B.maxZ - 2) continue;
      // Herds of one kind keep apart, and nothing appears right next to the hero.
      if (Math.hypot(x - this.threats[0]!.x, z - this.threats[0]!.z) < d.scare[0] + 1.5) continue;
      if (pool.herds.some((h) => h.on && Math.hypot(h.x - x, h.z - z) < (pool.kind === 'rat' ? 5 : 9))) continue;
      if (!site(pool.kind, w, x, z)) continue;
      this.herd(pool, w, g, x, z);
    }
  }

  private herd(pool: Pool, w: SiteWorld, g: number, x: number, z: number): void {
    const d = CRITTER[pool.kind], rng = this.rng;
    const want = d.size[0] + rng.int(d.size[1] - d.size[0] + 1);
    let placed = 0;
    for (let i = 0; i < want * 4 && placed < want; i++) {
      const slot = pool.animals.find((a) => !a.on);
      if (!slot) break;
      const r = i === 0 ? 0 : d.spread * Math.sqrt(rng.next()), ang = rng.next() * TAU;
      const ax = x + Math.sin(ang) * r, az = z + Math.cos(ang) * r;
      if (i > 0 && !site(pool.kind, w, ax, az)) continue;
      this.born(pool.kind, slot, g, ax, az);
      placed++;
    }
    const h = pool.herds[g]!;
    h.on = placed > 0;
    h.x = x;
    h.z = z;
    h.alarm = -1;
  }

  private born(kind: CritterKind, a: Animal, g: number, x: number, z: number): void {
    const rng = this.rng;
    a.on = true;
    a.g = g;
    a.x = a.tx = x;
    a.z = a.tz = z;
    a.y = kind === 'duck' ? WATER_Y - this.draft : groundY(x, z);
    a.yaw = rng.next() * TAU;
    a.pitch = a.roll = 0;
    a.state = kind === 'duck' ? 'idle' : kind === 'pigeon' ? 'idle' : 'sniff';
    a.t = 0;
    a.dur = rng.range(0.3, 2);
    a.ph = rng.next() * TAU;
    a.scale = rng.range(0.88, 1.1);
    a.f = null;
    a.flap = NaN;
    a.delay = 0;
    // Plumage and fur vary a little; a few pigeons are dark, a few rusty.
    const k = rng.range(0.85, 1.08);
    const r = rng.next();
    if (kind === 'pigeon' && r < 0.2) a.tint.setRGB(0.62, 0.62, 0.66);
    else if (kind === 'pigeon' && r < 0.3) a.tint.setRGB(1.05, 0.86, 0.72);
    else a.tint.setRGB(k, k, k);
  }

  // ------------------------------------------------------------------ behaviour

  /** Nearest threat to (x, z) inside its alarm distance, or null. */
  private threat(kind: CritterKind, x: number, z: number): { x: number; z: number } | null {
    const [hero, enemy] = CRITTER[kind].scare;
    let best: { x: number; z: number } | null = null, bd = Infinity;
    for (const t of this.threats) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < (t.hero ? hero : enemy) && d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /** Turns `a` toward (tx, tz) by at most `rate` rad/s; returns the remaining angle. */
  private steer(a: Animal, tx: number, tz: number, rate: number, dt: number): number {
    let diff = Math.atan2(tx - a.x, tz - a.z) - a.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    a.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
    return diff;
  }

  private ducks(pool: Pool, w: SiteWorld, dt: number): void {
    const rng = this.rng, d = CRITTER.duck;
    for (const a of pool.animals) {
      if (!a.on) continue;
      const h = pool.herds[a.g]!;
      a.t += dt;
      const th = this.threat('duck', a.x, a.z);
      if (th && a.state !== 'flee') {
        // Paddle away: straight off, or turned up to 90 degrees where the bank is in the way.
        const base = Math.atan2(a.x - th.x, a.z - th.z);
        for (const off of [0, 0.7, -0.7, 1.5, -1.5]) {
          const tx = a.x + Math.sin(base + off) * 6, tz = a.z + Math.cos(base + off) * 6;
          if (duckSite(w, tx, tz) && duckSite(w, (a.x + tx) / 2, (a.z + tz) / 2)) { a.tx = tx; a.tz = tz; a.state = 'flee'; a.t = 0; a.dur = 5; break; }
        }
      }
      let speed = 0;
      if (a.state === 'swim' || a.state === 'flee') {
        const diff = this.steer(a, a.tx, a.tz, a.state === 'flee' ? 2.2 : 1.3, dt);
        speed = (a.state === 'flee' ? 0.95 : 0.32) * Math.max(0, Math.cos(diff));
        if (Math.hypot(a.tx - a.x, a.tz - a.z) < 0.3) a.t = a.dur;
      }
      a.x += Math.sin(a.yaw) * speed * dt;
      a.z += Math.cos(a.yaw) * speed * dt;
      const dip = a.state === 'dip' ? Math.sin(Math.PI * Math.min(1, a.t / a.dur)) : 0;
      a.y = WATER_Y - this.draft + 0.012 * Math.sin(1.9 * this.time + a.ph) - 0.025 * dip;
      a.pitch = 0.025 * Math.sin(1.7 * this.time + a.ph * 1.3) + 0.6 * dip;
      a.roll = 0.04 * Math.sin(1.3 * this.time + a.ph * 2);
      if (a.t < a.dur) continue;
      if (a.state === 'flee') { h.x = a.x; h.z = a.z; }
      a.t = 0;
      const r = rng.next();
      if (r < 0.5) {
        const ang = rng.next() * TAU, rr = d.spread * Math.sqrt(rng.next());
        const tx = h.x + Math.sin(ang) * rr, tz = h.z + Math.cos(ang) * rr;
        if (duckSite(w, tx, tz)) { a.state = 'swim'; a.tx = tx; a.tz = tz; a.dur = 12; continue; }
      }
      if (r < 0.7) { a.state = 'dip'; a.dur = rng.range(1.2, 1.8); continue; }
      a.state = 'idle';
      a.dur = rng.range(2, 6);
    }
  }

  private pigeons(pool: Pool, w: SiteWorld, dt: number): void {
    const rng = this.rng, d = CRITTER.pigeon;
    // Alarm: the first pigeon that sees a threat startles its flock; each takes off a moment later.
    for (let g = 0; g < pool.herds.length; g++) {
      const h = pool.herds[g]!;
      if (!h.on || h.alarm >= 0) continue;
      let th: { x: number; z: number } | null = null;
      for (const a of pool.animals) if (a.on && a.g === g && !a.f && (th = this.threat('pigeon', a.x, a.z))) break;
      if (!th) continue;
      h.alarm = this.time;
      h.ax = th.x;
      h.az = th.z;
      const base = Math.atan2(h.x - th.x, h.z - th.z);
      h.land = false;
      for (let i = 0; i < 10 && !h.land; i++) {
        const ang = base + rng.range(-0.7, 0.7), r = rng.range(13, 22);
        const lx = h.x + Math.sin(ang) * r, lz = h.z + Math.cos(ang) * r;
        if (this.threats.some((t) => Math.hypot(t.x - lx, t.z - lz) < 9) || !pigeonSite(w, lx, lz)) continue;
        h.land = true;
        h.lx = lx;
        h.lz = lz;
      }
      for (const a of pool.animals) if (a.on && a.g === g) a.delay = rng.range(0, 0.35);
    }
    for (const a of pool.animals) {
      if (!a.on) continue;
      const h = pool.herds[a.g]!;
      if (a.f) { this.fly(pool, a, h, dt); continue; }
      if (h.alarm >= 0 && this.time >= h.alarm + a.delay) { this.takeOff(a, h, w); continue; }
      a.t += dt;
      a.y = groundY(a.x, a.z);
      a.pitch = 0;
      if (a.state === 'walk') {
        this.steer(a, a.tx, a.tz, 7, dt);
        const left = Math.hypot(a.tx - a.x, a.tz - a.z), step = Math.min(left, 0.45 * dt);
        a.x += Math.sin(a.yaw) * step;
        a.z += Math.cos(a.yaw) * step;
        // The nod: the body tips forward at every step and hops a little.
        const c = Math.sin(TAU * (2.6 * this.time) + a.ph);
        a.pitch = 0.16 * Math.max(0, c);
        a.y += 0.012 * Math.abs(c);
        if (left < 0.05) a.t = a.dur;
      } else if (a.state === 'peck') {
        a.pitch = 0.75 * Math.max(0, Math.sin(TAU * 2.3 * a.t)) ** 1.5;
      }
      if (a.t < a.dur) continue;
      a.t = 0;
      const r = rng.next();
      if (r < 0.45) {
        const ang = rng.next() * TAU, rr = d.spread * Math.sqrt(rng.next());
        const tx = h.x + Math.sin(ang) * rr, tz = h.z + Math.cos(ang) * rr;
        if (pigeonSite(w, tx, tz)) { a.state = 'walk'; a.tx = tx; a.tz = tz; a.dur = Math.hypot(tx - a.x, tz - a.z) / 0.45 + 0.5; continue; }
      }
      if (r < 0.8) { a.state = 'peck'; a.dur = rng.range(0.8, 1.6); continue; }
      a.state = 'idle';
      a.dur = rng.range(0.6, 2);
      a.yaw += rng.range(-1.2, 1.2);
    }
  }

  private takeOff(a: Animal, h: Herd, w: SiteWorld): void {
    const rng = this.rng, y0 = groundY(a.x, a.z);
    let x1: number, z1: number, y1: number;
    if (h.land) {
      const ang = rng.next() * TAU, r = rng.range(0, 1.8);
      x1 = h.lx + Math.sin(ang) * r;
      z1 = h.lz + Math.cos(ang) * r;
      if (!pigeonSite(w, x1, z1)) { x1 = h.lx; z1 = h.lz; }
      y1 = groundY(x1, z1);
    } else {
      // No free square ahead: away over the roofs, then gone.
      const ang = Math.atan2(a.x - h.ax, a.z - h.az) + rng.range(-0.4, 0.4);
      x1 = a.x + Math.sin(ang) * 38;
      z1 = a.z + Math.cos(ang) * 38;
      y1 = y0 + 11;
    }
    const dist = Math.hypot(x1 - a.x, z1 - a.z);
    a.f = { x0: a.x, z0: a.z, y0, x1, z1, y1, h: h.land ? 2.5 + dist * 0.12 + rng.range(0, 1.5) : 0, t: 0, dur: Math.max(1.5, dist / rng.range(5.5, 7)), land: h.land };
    a.yaw = Math.atan2(x1 - a.x, z1 - a.z);
  }

  private fly(pool: Pool, a: Animal, h: Herd, dt: number): void {
    const f = a.f!;
    f.t = Math.min(f.dur, f.t + dt);
    const s = f.t / f.dur;
    const x = f.x0 + (f.x1 - f.x0) * s, z = f.z0 + (f.z1 - f.z0) * s;
    const y = f.land ? f.y0 + (f.y1 - f.y0) * s + f.h * Math.sin(Math.PI * s ** 0.6) : f.y0 + (f.y1 - f.y0) * (1 - (1 - s) ** 2);
    const run = Math.hypot(x - a.x, z - a.z);
    // Nose follows the climb; a flare before touching down.
    a.pitch = run > 1e-4 ? -0.8 * Math.atan2(y - a.y, run) : a.pitch;
    if (f.land && s > 0.85) a.pitch -= 0.6 * (s - 0.85) / 0.15;
    a.x = x;
    a.z = z;
    a.y = y;
    a.roll = 0;
    // Wings beat at take-off and landing, glide in between.
    const beat = !f.land || s < 0.4 || s > 0.82;
    a.flap = beat ? 0.15 + 0.85 * Math.sin(TAU * 8 * f.t + a.ph) : 0.12 + 0.06 * Math.sin(TAU * 1.5 * f.t);
    if (s < 1) return;
    a.f = null;
    a.flap = NaN;
    a.pitch = 0;
    if (!f.land) { a.on = false; return; }
    a.state = 'idle';
    a.t = 0;
    a.dur = this.rng.range(0.4, 1.4);
    // The last one down settles the flock at its new square.
    if (!pool.animals.some((q) => q.on && q.g === a.g && (q.f || this.time < h.alarm + q.delay))) {
      h.alarm = -1;
      h.x = h.lx;
      h.z = h.lz;
    }
  }

  private rats(pool: Pool, w: SiteWorld, dt: number): void {
    const rng = this.rng;
    for (const a of pool.animals) {
      if (!a.on) continue;
      a.t += dt;
      const th = this.threat('rat', a.x, a.z);
      if (th && a.state !== 'flee') { a.state = 'flee'; a.t = 0; a.dur = 0; a.tx = th.x; a.tz = th.z; }
      let speed = 0;
      if (a.state === 'flee') {
        // Re-aim four times a second: away from the threat, turned as far as needed to find open ground.
        if (a.t >= a.dur) {
          a.t = 0;
          a.dur = 0.25;
          const src = th ?? { x: a.tx, z: a.tz };
          a.tx = src.x;
          a.tz = src.z;
          const base = Math.atan2(a.x - src.x, a.z - src.z);
          for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
            if (ratFree(w, a.x + Math.sin(base + off) * 1.2, a.z + Math.cos(base + off) * 1.2)) { a.yaw = base + off; break; }
          }
          if (!th && Math.hypot(a.x - src.x, a.z - src.z) > 10) { a.state = 'sniff'; a.dur = rng.range(0.5, 1.5); }
        }
        speed = 4.2;
      } else if (a.state === 'dash') speed = 2.3;
      if (speed > 0) {
        const nx = a.x + Math.sin(a.yaw) * speed * dt, nz = a.z + Math.cos(a.yaw) * speed * dt;
        if (ratFree(w, nx, nz)) { a.x = nx; a.z = nz; } else if (a.state === 'dash') a.t = a.dur;
        const c = Math.sin(TAU * 9 * this.time + a.ph);
        a.y = groundY(a.x, a.z) + 0.015 * Math.abs(c);
        a.pitch = 0.07 * c;
      } else {
        a.y = groundY(a.x, a.z);
        a.pitch = 0.04 * Math.sin(TAU * 6 * this.time + a.ph) - 0.05;
      }
      if (a.state === 'flee' || a.t < a.dur) continue;
      a.t = 0;
      if (rng.next() < 0.55) {
        // A dash along the wall: the first heading whose spot 1.2 m on is still by a wall.
        let ok = false;
        for (let i = 0; i < 6 && !ok; i++) {
          const ang = rng.next() * TAU;
          if (ratSite(w, a.x + Math.sin(ang) * 1.2, a.z + Math.cos(ang) * 1.2)) { a.yaw = ang; ok = true; }
        }
        if (ok) { a.state = 'dash'; a.dur = rng.range(0.3, 0.8); continue; }
      }
      a.state = 'sniff';
      a.dur = rng.range(0.5, 2.2);
      a.yaw += rng.range(-0.6, 0.6);
    }
  }

  // ------------------------------------------------------------------ drawing

  private write(pool: Pool): void {
    const mesh = pool.mesh, pigeon = pool.kind === 'pigeon', b = this.body;
    let n = 0, wn = 0;
    for (const a of pool.animals) {
      if (!a.on) continue;
      euler.set(a.pitch, a.yaw, a.roll);
      quat.setFromEuler(euler);
      mat.compose(pos.set(a.x, a.y, a.z), quat, scl.setScalar(a.scale));
      mesh.setMatrixAt(n, mat);
      mesh.setColorAt(n, a.tint);
      n++;
      if (pigeon && this.wings && !Number.isNaN(a.flap)) {
        for (const side of [1, -1]) {
          // Shoulder on the back, a little ahead of the middle; the wing turns about the body's long axis.
          tmpM.makeRotationZ(a.flap).premultiply(wingM.makeScale(side, 1, 1));
          tmpM.premultiply(wingM.makeTranslation(side * b.w * 0.28, b.h * 0.62, b.l * 0.06));
          this.wings.setMatrixAt(wn, tmpM.premultiply(mat));
          this.wings.setColorAt(wn, a.tint);
          wn++;
        }
      }
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    if (pigeon && this.wings) {
      this.wings.count = wn;
      this.wings.visible = wn > 0;
      this.wings.instanceMatrix.needsUpdate = true;
      this.wings.instanceColor!.needsUpdate = true;
    }
  }
}
