// Skinned characters: loading, per-look materials, clip blending, and the views that turn
// sim state into poses. One-shot clips (attack, dodge, hit, death) are driven by sim time, so
// the pose always matches the hitbox and freezes with hitstop; loops run on their own clock.
import { groundY } from './ground';
import { HERO_DEFAULT_LOOK, HERO_PIECES } from '../data/hero-contract';
import { HERO_LAYER } from './layers';
import {
  AnimationClip, AnimationMixer, Bone, Group, LoopRepeat, Mesh, Quaternion,
  Vector3, type AnimationAction, type Object3D,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import animsUrl from '../../assets/characters/anims.glb?url';
import heroUrl from '../../assets/characters/hero.glb?url';
import zombieUrl from '../../assets/characters/zombie.glb?url';
import raptorUrl from '../../assets/characters/raptor.glb?url';
import rexUrl from '../../assets/characters/rex.glb?url';
import { PLAYER, type AttackDef } from '../data/combat';
import { lerp, lerpAngle } from '../sim/math';
import { DT, type Cast, type Player } from '../sim/types';
import type { ElementId, WeaponKindId } from '../data/items';
import { TWO_HAND_STAND, WeaponRack, weaponModel, type WeaponModel } from './weapons';
import { FIST_CLIP, LeftHandIk, easeGrip } from './hand-ik';
import type { LitMaterial, Materials } from './materials';

export interface CharacterAssets {
  hero: Object3D;
  zombie: Object3D;
  heroClips: Map<string, AnimationClip>;
  zombieClips: Map<string, AnimationClip>;
  /** Dinosaurs (M12): own skeletons and clips (Idle, Walk, Run, Attack, Jump, Death). */
  raptor: Object3D;
  rex: Object3D;
  raptorClips: Map<string, AnimationClip>;
  rexClips: Map<string, AnimationClip>;
}

const FINGERS = /^(index|middle|ring|pinky|thumb)_/;
// The last four carry the specials: slam, lunge, throw, command.
const ZOMBIE_CLIPS = /^(Zombie_|Hit_|Death01$|Idle_Loop$|Sword_Heavy_Combo$|Shield_Dash$|OverhandThrow$|Spell_Simple_Shoot$)/;

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

/**
 * Shows the default clothing and hides the body regions under it (H1 step 3). Step 4 replaces this
 * with `HeroModel.setLook` driven by the equipment.
 */
function wearDefaultLook(hero: Object3D): void {
  const hidden = new Set(HERO_DEFAULT_LOOK.flatMap((p) => HERO_PIECES[p] ?? []).map((r) => `body_${r}`));
  hero.traverse((o) => {
    if (o.name in HERO_PIECES) o.visible = HERO_DEFAULT_LOOK.includes(o.name);
    else if (hidden.has(o.name)) o.visible = false;
  });
}

export async function loadCharacters(materials: Materials): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const [heroGltf, zombieGltf, animGltf, raptorGltf, rexGltf] = await Promise.all([heroUrl, zombieUrl, animsUrl, raptorUrl, rexUrl].map((u) => loader.loadAsync(u))) as [GLTF, GLTF, GLTF, GLTF, GLTF];
  for (const g of [heroGltf, zombieGltf, raptorGltf, rexGltf]) prepare(g.scene, materials);
  wearDefaultLook(heroGltf.scene);
  const named = (g: GLTF): Map<string, AnimationClip> => new Map(g.animations.map((c) => [c.name, c]));
  const hipLen = (root: Object3D): number => root.getObjectByName('pelvis')?.position.length() ?? 1;
  const src = hipLen(animGltf.scene);
  const heroClips = new Map<string, AnimationClip>();
  const zombieClips = new Map<string, AnimationClip>();
  for (const clip of animGltf.animations) {
    heroClips.set(clip.name, fitClip(clip, hipLen(heroGltf.scene) / src, false));
    // Enemies only get the clips they play: every clip costs bindings per body.
    if (ZOMBIE_CLIPS.test(clip.name)) zombieClips.set(clip.name, fitClip(clip, hipLen(zombieGltf.scene) / src, true));
  }
  return { hero: heroGltf.scene, zombie: zombieGltf.scene, heroClips, zombieClips, raptor: raptorGltf.scene, rex: rexGltf.scene, raptorClips: named(raptorGltf), rexClips: named(rexGltf) };
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
function attackClipTime(a: AttackDef, t: number, speed: number): number {
  if (t <= a.windup) return lerp(a.clipStart, a.clipSwing, t / a.windup);
  const strike = a.windup + a.active;
  if (t <= strike) return lerp(a.clipSwing, a.clipHit, (t - a.windup) / a.active);
  return a.clipHit + (t - strike) * speed;
}

/** Roll clip range used for the dodge. */
const ROLL_FROM = 0.22;
const ROLL_TO = 0.95;
/** Death01 starts with a long stagger; skip into it. */
const DEATH_FROM = 0.35;
const RUN_CLIP_SPEED = 6.2;
/** Left hand (H1): seconds to slide between the standing pose and the rest. */
const STANCE_EASE = 0.15;

const q = new Quaternion();
const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const legA = new Vector3();
const legB = new Vector3();
const qFrame = new Quaternion();

/**
 * Back swing (radians) of a coat back panel for a thigh along `leg` (thigh to knee, in the panel's
 * rest frame: Y up, Z forward). The panel follows a leg that swings back and never one that swings
 * forward, so the back of the coat neither lets a leg through nor stretches between the legs.
 */
export function coatSwing(leg: Vector3): number {
  return Math.max(0, Math.atan2(-leg.z, -leg.y));
}
const gripPos = new Vector3();
const gripDir = new Vector3();

/** Clip and the part of it a cast plays: `at` is the clip time when the effect happens. */
const CAST_CLIPS: Record<Cast['id'], { clip: string; from: number; at: number; to: number }> = {
  fecht: { clip: 'Sword_Dash', from: 0.2, at: 0.2, to: 0.5 },
  fall: { clip: 'Sword_Heavy_Combo', from: 2.3, at: 2.66, to: 2.95 },
  abriss: { clip: 'Sword_Heavy_Combo', from: 2.25, at: 2.66, to: 2.7 },
  stab: { clip: 'Sword_Heavy_Combo', from: 2.3, at: 2.66, to: 2.7 },
  nagel: { clip: 'OverhandThrow', from: 0.22, at: 0.37, to: 0.62 },
  brand: { clip: 'OverhandThrow', from: 0.1, at: 0.37, to: 0.7 },
  molotow: { clip: 'OverhandThrow', from: 0.12, at: 0.37, to: 0.7 },
  sperr: { clip: 'OverhandThrow', from: 0.08, at: 0.33, to: 0.75 },
  spiess: { clip: 'OverhandThrow', from: 0.1, at: 0.37, to: 0.7 },
  stand: { clip: 'Sword_Regular_C', from: 0.42, at: 0.71, to: 1.0 },
  saege: { clip: 'Sword_Regular_A', from: 0.24, at: 0.24, to: 0.24 },
  saebel: { clip: 'Sword_Idle', from: 0, at: 0, to: 0 },
  gully: { clip: 'Sword_Block', from: 0, at: 0, to: 0 },
};

/** Standing clip for a weapon model: two-handed models with their own pose, else the one-handed guard. */
export function standClip(model: WeaponModel, guard: boolean): string {
  if (guard) return 'Idle_Shield_Loop';
  return TWO_HAND_STAND[model]?.clip ?? 'Sword_Idle';
}

/** Extra state the hero view needs beyond the player (weapon, power timers). */
export interface HeroPose {
  kind: WeaponKindId;
  base: string;
  element: ElementId | undefined;
  spin: number;
  guard: number;
  leap: number;
}

export class HeroView {
  readonly root = new Group();
  readonly rack: WeaponRack;
  private spinA = 0;
  private readonly anim: Animator;
  private readonly ik: LeftHandIk;
  private ikW = 0;
  /** 0..1: how far the left hand is in the two-handed standing pose (grip height, wrist roll, stretch). */
  private stance = 0;
  private readonly scarf: Array<{ bone: Bone; rest: Quaternion; back: number; side: number }> = [];
  /** Coat back panel chains (`coat_b{l,r}_01` and `_02`), with the thigh and knee each one follows. */
  private readonly coat: Array<{ bone: Object3D; low: Object3D; rest: Quaternion; thigh: Object3D; calf: Object3D; a: number; b: number }> = [];
  private prevX = 0;
  private prevZ = 0;
  private time = 0;

  constructor(assets: CharacterAssets, materials: Materials) {
    const model = cloneSkinned(assets.hero);
    this.root.add(model);
    this.anim = new Animator(model, assets.heroClips);
    this.rack = new WeaponRack(materials);
    this.rack.show('pipe', undefined);
    model.getObjectByName('hand_r')?.add(this.rack.group);
    this.ik = new LeftHandIk(model, assets.heroClips.get(FIST_CLIP));
    for (const name of ['scarf_01', 'scarf_02', 'scarf_03']) {
      const bone = model.getObjectByName(name) as Bone | undefined;
      if (bone) this.scarf.push({ bone, rest: bone.quaternion.clone(), back: 0, side: 0 });
    }
    for (const side of ['l', 'r']) {
      const [bone, low, thigh, calf] = [`coat_b${side}_01`, `coat_b${side}_02`, `thigh_${side}`, `calf_${side}`].map((n) => model.getObjectByName(n));
      if (bone && low && thigh && calf) this.coat.push({ bone, low, rest: bone.quaternion.clone(), thigh, calf, a: 0, b: 0 });
    }
    this.root.traverse(object => { if ((object as Mesh).isMesh) object.layers.enable(HERO_LAYER); });
  }

  update(p: Player, alpha: number, dt: number, frozen: boolean, pose: HeroPose): void {
    const x = lerp(p.px, p.x, alpha);
    const z = lerp(p.pz, p.z, alpha);
    this.root.position.set(x, groundY(x, z) + pose.leap, z);
    this.root.rotation.y = lerpAngle(p.pfacing, p.facing, alpha);
    const model = weaponModel(pose.kind, pose.base);
    this.rack.show(model, pose.element);
    let standing = false;
    const t = p.stateT + (frozen ? 0 : alpha * DT);
    const a = this.anim;
    // Kreissäge: the whole body turns, blade held out.
    if (pose.spin > 0 && p.state !== 'dead') {
      if (!frozen) this.spinA += dt * 21;
      this.root.rotation.y += this.spinA;
      a.pose('Sword_Regular_A', 0.26, 0.05);
    } else if (p.state === 'cast' && p.cast) {
      this.spinA = 0;
      const c = p.cast;
      const k = CAST_CLIPS[c.id];
      // Before the effect the clip runs from `from` to `at`, after it on to `to`.
      const ct = c.fire <= 0 ? lerp(k.from, k.to, Math.min(1, t / Math.max(c.dur, 0.01)))
        : t <= c.fire ? lerp(k.from, k.at, t / c.fire) : lerp(k.at, k.to, Math.min(1, (t - c.fire) / Math.max(0.01, c.dur - c.fire)));
      a.pose(k.clip, ct, 0.05);
    } else if (p.state === 'attack' && p.attack) {
      const ct = attackClipTime(p.attack, t, p.attackSpeed);
      const len = a.duration(p.attack.clip);
      if (ct < len || !p.attack.rec) a.pose(p.attack.clip, ct, 0.05);
      else a.pose(p.attack.rec, ct - len, 0.06);
    } else if (p.state === 'dodge') {
      a.pose('Roll', lerp(ROLL_FROM, ROLL_TO, Math.min(1, t / PLAYER.dodge.duration)), 0.04);
    } else if (p.state === 'dead') {
      a.pose('Death01', DEATH_FROM + t * 1.2, 0.12);
    } else {
      const speed = Math.hypot(p.vx, p.vz);
      if (speed > 0.8) a.loop(pose.guard > 0 ? 'Jog_Fwd_Loop' : 'Sprint_Loop', 0.1, Math.max(0.6, speed / RUN_CLIP_SPEED) * (pose.guard > 0 ? 1.6 : 1));
      else {
        const clip = standClip(model, pose.guard > 0);
        standing = clip === TWO_HAND_STAND[model]?.clip;
        a.loop(clip, 0.16);
      }
    }
    const flinch = p.state !== 'dead' && p.hurtT < 0.3 ? 0.75 * (1 - p.hurtT / 0.3) : 0;
    a.mix('Hit_Chest', p.hurtT, flinch);
    a.update(frozen ? 0 : dt);
    this.leftHand(p, t, dt, frozen, flinch, standing);
    this.swayScarf(x, z, dt);
  }

  /**
   * Left hand on the shaft of two-handed weapons; off while the left arm does its own thing or the
   * shaft is out of reach. The weight eases in time (grab, release), so reach changes never jump, and
   * the hand never grabs anew during an attack's wind-up and active frames.
   */
  private leftHand(p: Player, t: number, dt: number, frozen: boolean, flinch: number, standing: boolean): void {
    if (!this.rack.twoHanded) {
      this.ikW = 0;
      this.stance = standing ? 1 : 0;
      return;
    }
    if (!frozen) {
      const s = standing ? 1 : 0;
      this.stance = s > this.stance ? Math.min(s, this.stance + dt / STANCE_EASE) : Math.max(s, this.stance - dt / STANCE_EASE);
    }
    this.root.updateMatrixWorld(true);
    if (!this.rack.leftGrip(gripPos, gripDir, this.stance)) return;
    const throwing = p.state === 'cast' && p.cast !== null && CAST_CLIPS[p.cast.id].clip === 'OverhandThrow';
    const free = p.state !== 'dodge' && p.state !== 'dead' && !throwing && flinch === 0;
    // Aim every frame, also while letting go, so the hand follows the shaft on its way off.
    const reach = this.ik.aim(gripPos, gripDir, this.stance);
    const want = free ? reach : 0;
    const swinging = p.state === 'attack' && p.attack !== null && t < p.attack.windup + p.attack.active;
    if (!frozen) this.ikW = easeGrip(this.ikW, want, swinging, dt);
    this.ik.pose(this.ikW);
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
    this.swayCoat(fwd, dt);
  }

  /**
   * The back of the coat swings out of the way of a leg that goes back (`coatSwing`, plus a little
   * margin), trails a bit with speed, and the lower panel lags behind on a softer spring.
   */
  private swayCoat(fwd: number, dt: number): void {
    if (this.coat.length === 0) return;
    this.root.updateMatrixWorld(true);
    for (const c of this.coat) {
      // The leg in the panel's rest frame (follows the pelvis, so a leaning body does not count).
      c.bone.parent!.getWorldQuaternion(qFrame).multiply(c.rest).invert();
      const leg = legB.subVectors(c.calf.getWorldPosition(legB), c.thigh.getWorldPosition(legA)).applyQuaternion(qFrame);
      const swing = coatSwing(leg);
      const want = (swing > 0 ? swing + 0.08 : 0) + Math.max(0, fwd) * 0.02;
      c.a += (want - c.a) * (1 - Math.exp(-dt * 18));
      // The lower panel adds a quarter of the upper one's swing on a softer spring: cloth lag.
      c.b += (Math.max(0, fwd) * 0.03 + c.a * 0.25 - c.b) * (1 - Math.exp(-dt * 8));
      c.bone.quaternion.copy(c.rest).multiply(q.setFromAxisAngle(X, c.a));
      c.low.quaternion.setFromAxisAngle(X, c.b);
    }
  }
}
