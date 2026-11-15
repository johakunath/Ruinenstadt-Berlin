// Skinned characters: loading, per-look materials, clip blending, and the views that turn
// sim state into poses. One-shot clips (attack, dodge, hit, death) are driven by sim time, so
// the pose always matches the hitbox and freezes with hitstop; loops run on their own clock.
import { groundY } from './ground';
import {
  AnimationClip, AnimationMixer, Bone, Color, CylinderGeometry, Group, LoopRepeat, Mesh, PlaneGeometry, Quaternion,
  SkinnedMesh, Sphere, Vector3, type AnimationAction, type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import animsUrl from '../../assets/characters/anims.glb?url';
import heroUrl from '../../assets/characters/hero.glb?url';
import zombieUrl from '../../assets/characters/zombie.glb?url';
import { PLAYER, type AttackDef } from '../data/combat';
import { SPAWN, type EnemyKind } from '../data/enemies';
import { lerp, lerpAngle } from '../sim/math';
import { DT, type Enemy, type Player } from '../sim/types';
import type { LitMaterial, Materials } from './materials';
import { paintMetal } from './paint';

export interface CharacterAssets {
  hero: Object3D;
  zombie: Object3D;
  heroClips: Map<string, AnimationClip>;
  zombieClips: Map<string, AnimationClip>;
}

const FINGERS = /^(index|middle|ring|pinky|thumb)_/;

/** Fits a clip to a body: scales the hip track to its leg length, optionally drops finger tracks. */
function fitClip(clip: AnimationClip, hipScale: number, dropFingers: boolean): AnimationClip {
  const out = clip.clone();
  out.tracks = out.tracks.filter((t) => !(dropFingers && FINGERS.test(t.name)));
  for (const t of out.tracks) {
    if (!t.name.endsWith('.position')) continue;
    for (let i = 0; i < t.values.length; i++) t.values[i] = (t.values[i] as number) * hipScale;
  }
  return out;
}

function prepare(scene: Object3D, materials: Materials): void {
  const converted = new Map<unknown, LitMaterial>();
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as LitMaterial;
    let mat = converted.get(src);
    if (!mat) {
      mat = materials.fromGltf(src);
      mat.name = src.name;
      converted.set(src, mat);
    }
    mesh.material = mat;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    // Bones move the mesh far from its bind pose bounds; cull by a generous sphere on the root instead.
    mesh.frustumCulled = false;
  });
}

export async function loadCharacters(materials: Materials): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const [heroGltf, zombieGltf, animGltf] = await Promise.all([loader.loadAsync(heroUrl), loader.loadAsync(zombieUrl), loader.loadAsync(animsUrl)]);
  prepare(heroGltf.scene, materials);
  prepare(zombieGltf.scene, materials);
  const hipLen = (root: Object3D): number => root.getObjectByName('pelvis')?.position.length() ?? 1;
  const src = hipLen(animGltf.scene);
  const heroClips = new Map<string, AnimationClip>();
  const zombieClips = new Map<string, AnimationClip>();
  for (const clip of animGltf.animations) {
    heroClips.set(clip.name, fitClip(clip, hipLen(heroGltf.scene) / src, false));
    zombieClips.set(clip.name, fitClip(clip, hipLen(zombieGltf.scene) / src, true));
  }
  return { hero: heroGltf.scene, zombie: zombieGltf.scene, heroClips, zombieClips };
}

// ---------------------------------------------------------------- animator

interface Layer {
  action: AnimationAction;
  w: number;
}

/** Weight-normalized clip blender. Exactly one clip is current; the others fade out. */
export class Animator {
  readonly mixer: AnimationMixer;
  private readonly layers = new Map<string, Layer>();
  private current = '';
  private fade = 0.1;
  private overlay = '';
  private overlayW = 0;

  constructor(root: Object3D, clips: Map<string, AnimationClip>) {
    this.mixer = new AnimationMixer(root);
    for (const [name, clip] of clips) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      this.layers.set(name, { action, w: 0 });
    }
  }

  private layer(name: string): Layer {
    const l = this.layers.get(name);
    if (!l) throw new Error(`Missing clip ${name}`);
    return l;
  }

  /** Free-running loop. */
  loop(name: string, fade: number, timeScale = 1): void {
    const l = this.layer(name);
    if (this.current !== name) {
      this.current = name;
      if (l.w === 0) l.action.time = 0;
    }
    this.fade = fade;
    l.action.paused = false;
    l.action.timeScale = timeScale;
  }

  /** Clip posed at an explicit time (sim-driven one-shot). */
  pose(name: string, time: number, fade: number): void {
    const l = this.layer(name);
    this.current = name;
    this.fade = fade;
    l.action.paused = true;
    l.action.time = Math.min(Math.max(time, 0), l.action.getClip().duration - 0.001);
  }

  /** Extra clip mixed over the current one (hit flinch). Weight 0 removes it. */
  mix(name: string, time: number, weight: number): void {
    if (this.overlay && this.overlay !== name) this.setWeight(this.layer(this.overlay), 0);
    this.overlay = weight > 0 ? name : '';
    this.overlayW = weight;
    if (weight <= 0) return;
    const l = this.layer(name);
    l.action.paused = true;
    l.action.time = Math.min(Math.max(time, 0), l.action.getClip().duration - 0.001);
  }

  duration(name: string): number {
    return this.layer(name).action.getClip().duration;
  }

  private setWeight(l: Layer, w: number): void {
    if (w > 0) {
      if (!l.action.isScheduled()) l.action.play();
      l.action.setEffectiveWeight(w);
    } else if (l.action.isScheduled()) {
      l.action.stop();
    }
  }

  /** `dt` advances fades and loops; pass 0 to hold everything (hitstop). */
  update(dt: number): void {
    const step = this.fade > 0 ? dt / this.fade : 1;
    let sum = 0;
    for (const [name, l] of this.layers) {
      if (name === this.overlay) continue;
      const target = name === this.current ? 1 : 0;
      if (l.w !== target) l.w = target > l.w ? Math.min(1, l.w + step) : Math.max(0, l.w - step);
      sum += l.w;
    }
    if (sum === 0 && this.current) {
      // Nothing is posed yet (a view created during hitstop): show the current clip at once.
      this.layer(this.current).w = 1;
      sum = 1;
    }
    const base = sum > 0 ? (1 - this.overlayW) / sum : 0;
    for (const [name, l] of this.layers) {
      if (name === this.overlay) this.setWeight(l, this.overlayW);
      else this.setWeight(l, l.w * base);
    }
    this.mixer.update(dt);
  }
}

// ---------------------------------------------------------------- hero

/** Maps time inside an attack to clip time: wind-up and active frames are squeezed onto the swing. */
function attackClipTime(a: AttackDef, t: number): number {
  if (t <= a.windup) return lerp(a.clipStart, a.clipSwing, t / a.windup);
  const strike = a.windup + a.active;
  if (t <= strike) return lerp(a.clipSwing, a.clipHit, (t - a.windup) / a.active);
  return a.clipHit + (t - strike);
}

/** Roll clip range used for the dodge. */
const ROLL_FROM = 0.22;
const ROLL_TO = 0.95;
/** Death01 starts with a long stagger; skip into it. */
const DEATH_FROM = 0.35;
const RUN_CLIP_SPEED = 6.2;

function buildPipe(materials: Materials): Group {
  const g = new Group();
  const metal = materials.surface({ map: paintMetal('#6a5a50', { flatten: materials.look.flatten, normalMaps: false, anisotropy: 1 }, 71, 1.2).map, roughness: 0.5, metalness: 0.6 });
  const pipe = new Mesh(new CylinderGeometry(0.026, 0.026, 1.05, 8), metal);
  pipe.position.y = 0.42;
  const elbow = new Mesh(new CylinderGeometry(0.034, 0.034, 0.2, 8), metal);
  elbow.rotation.z = Math.PI / 2;
  elbow.position.set(0.07, 0.94, 0);
  const collar = new Mesh(new CylinderGeometry(0.04, 0.04, 0.06, 8), metal);
  collar.position.y = 0.9;
  const grip = new Mesh(new CylinderGeometry(0.033, 0.033, 0.26, 8), materials.surface({ color: 0xc9b58c, roughness: 0.95 }));
  grip.position.y = 0.02;
  const ribbonMat = materials.surface({ color: 0xb8261c, roughness: 0.9, doubleSided: true });
  const ribbon = new Mesh(new PlaneGeometry(0.07, 0.34), ribbonMat);
  ribbon.position.set(-0.05, 0.62, 0.02);
  ribbon.rotation.z = 0.5;
  const knot = new Mesh(new CylinderGeometry(0.036, 0.036, 0.05, 8), ribbonMat);
  knot.position.y = 0.74;
  g.add(pipe, elbow, collar, grip, ribbon, knot);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

const q = new Quaternion();
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);

export class HeroView {
  readonly root = new Group();
  readonly weapon: Group;
  private readonly anim: Animator;
  private readonly scarf: Array<{ bone: Bone; rest: Quaternion; back: number; side: number }> = [];
  private prevX = 0;
  private prevZ = 0;
  private time = 0;

  constructor(assets: CharacterAssets, materials: Materials) {
    const model = cloneSkinned(assets.hero);
    this.root.add(model);
    this.anim = new Animator(model, assets.heroClips);
    this.weapon = buildPipe(materials);
    const hand = model.getObjectByName('hand_r');
    if (hand) {
      // Grip offset in the hand bone's frame (checked with `?cam=5,30` close-ups).
      this.weapon.position.set(0, 0.09, 0.03);
      this.weapon.rotation.set(Math.PI / 2, 0, 0);
      hand.add(this.weapon);
    }
    for (const name of ['scarf_01', 'scarf_02', 'scarf_03']) {
      const bone = model.getObjectByName(name) as Bone | undefined;
      if (bone) this.scarf.push({ bone, rest: bone.quaternion.clone(), back: 0, side: 0 });
    }
  }

  update(p: Player, alpha: number, dt: number, frozen: boolean): void {
    const x = lerp(p.px, p.x, alpha);
    const z = lerp(p.pz, p.z, alpha);
    this.root.position.set(x, groundY(x, z), z);
    this.root.rotation.y = lerpAngle(p.pfacing, p.facing, alpha);
    const t = p.stateT + (frozen ? 0 : alpha * DT);
    const a = this.anim;
    if (p.state === 'attack' && p.attack) {
      const ct = attackClipTime(p.attack, t);
      const len = a.duration(p.attack.clip);
      if (ct < len || !p.attack.rec) a.pose(p.attack.clip, ct, 0.05);
      else a.pose(p.attack.rec, ct - len, 0.06);
    } else if (p.state === 'dodge') {
      a.pose('Roll', lerp(ROLL_FROM, ROLL_TO, Math.min(1, t / PLAYER.dodge.duration)), 0.04);
    } else if (p.state === 'dead') {
      a.pose('Death01', DEATH_FROM + t * 1.2, 0.12);
    } else {
      const speed = Math.hypot(p.vx, p.vz);
      if (speed > 0.8) a.loop('Sprint_Loop', 0.1, Math.max(0.6, speed / RUN_CLIP_SPEED));
      else a.loop('Sword_Idle', 0.16);
    }
    const flinch = p.state !== 'dead' && p.hurtT < 0.3 ? 0.75 * (1 - p.hurtT / 0.3) : 0;
    a.mix('Hit_Chest', p.hurtT, flinch);
    a.update(frozen ? 0 : dt);
    this.swayScarf(x, z, dt);
  }

  /** The scarf tail trails behind movement on a soft spring. */
  private swayScarf(x: number, z: number, dt: number): void {
    if (dt <= 0) return;
    this.time += dt;
    const vx = (x - this.prevX) / dt;
    const vz = (z - this.prevZ) / dt;
    this.prevX = x;
    this.prevZ = z;
    const yaw = this.root.rotation.y;
    // Velocity in the hero's frame: forward and to the left.
    const fwd = Math.min(9, Math.max(-9, vx * Math.sin(yaw) + vz * Math.cos(yaw)));
    const left = Math.min(9, Math.max(-9, vx * Math.cos(yaw) - vz * Math.sin(yaw)));
    const k = 1 - Math.exp(-dt * 9);
    this.scarf.forEach((s, i) => {
      const flutter = Math.sin(this.time * (7 + i * 2.3) + i) * (0.05 + Math.abs(fwd) * 0.012) * (i + 1);
      const back = fwd * (0.1 + i * 0.03) + flutter + (i === 0 ? 0.12 : 0.05);
      const side = -left * 0.07 + Math.sin(this.time * 3.1 + i * 1.7) * 0.05;
      s.back += (back - s.back) * k * (1 - i * 0.2);
      s.side += (side - s.side) * k * (1 - i * 0.2);
      s.bone.quaternion.copy(s.rest).multiply(q.setFromAxisAngle(X, -s.back)).multiply(q.setFromAxisAngle(Z, s.side));
    });
  }
}

// ---------------------------------------------------------------- enemies

/** Clip time of Zombie_Scratch at which the claw lands. */
const SCRATCH_HIT = 0.55;
const SCRATCH_SWIPE = 0.16;
const WALK_CLIP_SPEED = 1.15;
const FLASH_TIME = 0.1;
const WHITE = new Color(0xffffff);

const TINTS: Record<EnemyKind, number[]> = {
  walker: [0xb9c7ae, 0xa9b9b0, 0xc4bd9c],
  runner: [0xcfc9a4, 0xb6c9b8],
  brute: [0x93a58f, 0xa08f86],
  feldwebel: [0x7f9a8a],
  waechter: [0x8a8577],
  rex: [0x7d9a5a],
  hauptmann: [0xa98f7a],
};

export class EnemyView {
  readonly root = new Group();
  id = -1;
  kind: EnemyKind = 'walker';
  /** Frames to skip between animation updates (distance LOD). */
  private skip = 0;
  private pending = 0;
  private flash = 0;
  private readonly anim: Animator;
  private readonly mats: LitMaterial[] = [];
  private readonly glow: LitMaterial[] = [];
  private readonly seed = Math.random();

  constructor(assets: CharacterAssets, castShadow: boolean) {
    const model = cloneSkinned(assets.zombie);
    this.root.add(model);
    this.anim = new Animator(model, assets.zombieClips);
    const own = new Map<unknown, LitMaterial>();
    model.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as LitMaterial;
      let mat = own.get(src);
      if (!mat) {
        mat = src.clone();
        own.set(src, mat);
        if (src.name === 'eyes') {
          mat.emissive.set(0xd8ff7a);
          mat.emissiveIntensity = 2.2;
          this.glow.push(mat);
        } else {
          this.mats.push(mat);
        }
      }
      mesh.material = mat;
      mesh.castShadow = castShadow;
      mesh.frustumCulled = true;
      mesh.boundingSphere = new Sphere(new Vector3(0, 0.9, 0), 1.7);
    });
  }

  assign(e: Enemy): void {
    this.id = e.id;
    this.kind = e.kind;
    this.flash = 0;
    this.root.scale.setScalar(e.def.scale);
    // Gaunt runners, heavy brutes.
    if (e.kind === 'runner') this.root.scale.set(e.def.scale * 0.86, e.def.scale, e.def.scale * 0.86);
    if (e.kind === 'brute' || e.def.boss) this.root.scale.set(e.def.scale * 1.12, e.def.scale, e.def.scale * 1.12);
    const tints = TINTS[e.kind];
    const tint = tints[Math.floor(this.seed * tints.length)] as number;
    for (const m of this.mats) {
      if (m.name === 'skin') m.color.set(tint);
      m.emissive.setScalar(0);
    }
    this.root.visible = true;
  }

  hit(): void {
    this.flash = FLASH_TIME;
  }

  update(e: Enemy, alpha: number, dt: number, frozen: boolean, skip: number): void {
    const ex = lerp(e.px, e.x, alpha);
    const ez = lerp(e.pz, e.z, alpha);
    this.root.position.set(ex, groundY(ex, ez), ez);
    this.root.rotation.y = lerpAngle(e.pfacing, e.facing, alpha);
    // White hit flash: full for half the time, then fading. Runs through hitstop.
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      const k = Math.min(1, (this.flash / FLASH_TIME) * 2);
      for (const m of this.mats) m.emissive.copy(WHITE).multiplyScalar(k * 0.85);
    }
    const t = e.stateT + (frozen ? 0 : alpha * DT);
    const a = this.anim;
    const def = e.def;
    switch (e.state) {
      case 'chase':
        if (e.speed > 0.2) a.loop('Zombie_Walk_Fwd_Loop', 0.2, Math.min(2.8, Math.max(0.8, e.speed / (WALK_CLIP_SPEED * def.scale))));
        else a.loop('Zombie_Idle_Loop', 0.25);
        break;
      case 'windup':
        a.pose('Zombie_Scratch', lerp(0.05, SCRATCH_HIT, Math.min(1, t / def.windup)), 0.12);
        break;
      case 'strike':
        a.pose('Zombie_Scratch', SCRATCH_HIT + SCRATCH_SWIPE * Math.min(1, t / def.active), 0.03);
        break;
      case 'recover': {
        const from = SCRATCH_HIT + SCRATCH_SWIPE;
        a.pose('Zombie_Scratch', lerp(from, a.duration('Zombie_Scratch'), Math.min(1, t / def.recovery)), 0.05);
        break;
      }
      case 'stagger':
        if (e.staggerDur > 0.4) a.pose('Hit_Knockback', (t / e.staggerDur) * a.duration('Hit_Knockback'), 0.04);
        else a.pose('Hit_Chest', t, 0.03);
        break;
      case 'dead': {
        a.pose('Death01', DEATH_FROM + t * 1.3, 0.06);
        // Sink into the ground before the body is removed.
        const sink = Math.max(0, t - (SPAWN.corpseTime - 0.8)) / 0.8;
        this.root.position.y -= sink * 0.55;
        break;
      }
    }
    // Distance LOD: far enemies update their skeleton every 2nd or 3rd frame with the summed time.
    this.pending += frozen ? 0 : dt;
    if (this.skip > 0 && this.flash <= 0 && e.state === 'chase') {
      this.skip--;
      return;
    }
    this.skip = skip;
    a.update(this.pending);
    this.pending = 0;
  }
}
