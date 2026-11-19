// Skinned characters: loading, per-look materials, clip blending, and the views that turn
// sim state into poses. One-shot clips (attack, dodge, hit, death) are driven by sim time, so
// the pose always matches the hitbox and freezes with hitstop; loops run on their own clock.
import { groundY } from './ground';
import type { HeroLook } from '../data/hero-look';
import { HeroModel } from './hero-model';
import { HERO_LAYER } from './layers';
import {
  AnimationClip, AnimationMixer, Group, LoopRepeat, Mesh,
  Vector3, type AnimationAction, type Object3D,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import animsUrl from '../../assets/characters/anims.glb?url';
import heroUrl from '../../assets/characters/hero.glb?url';
import zombieUrl from '../../assets/characters/zombie.glb?url';
import raptorUrl from '../../assets/characters/raptor.glb?url';
import rexUrl from '../../assets/characters/rex.glb?url';
import mechUrl from '../../assets/characters/mech.glb?url';
import mechBigUrl from '../../assets/characters/mechbig.glb?url';
import { PLAYER, type AttackDef } from '../data/combat';
import { lerp, lerpAngle } from '../sim/math';
import { DT, type Cast, type Player } from '../sim/types';
import type { ElementId, WeaponKindId } from '../data/items';
import { THRUST, TWO_HAND_STAND, WeaponRack, thrustWeight, weaponModel, type WeaponModel } from './weapons';
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
  /** M15 Quaternius mechs (Leela, Mike), loaded only for Alexanderplatz or `?spawn=` of their kinds. */
  mech?: { small: Object3D; big: Object3D; smallClips: Map<string, AnimationClip>; bigClips: Map<string, AnimationClip> };
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

export async function loadCharacters(materials: Materials, mechs = false): Promise<CharacterAssets> {
  const loader = new GLTFLoader();
  const mechLoad = mechs ? Promise.all([mechUrl, mechBigUrl].map((u) => loader.loadAsync(u))) as Promise<[GLTF, GLTF]> : null;
  const [heroGltf, zombieGltf, animGltf, raptorGltf, rexGltf] = await Promise.all([heroUrl, zombieUrl, animsUrl, raptorUrl, rexUrl].map((u) => loader.loadAsync(u))) as [GLTF, GLTF, GLTF, GLTF, GLTF];
  for (const g of [heroGltf, zombieGltf, raptorGltf, rexGltf]) prepare(g.scene, materials);
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
  const out: CharacterAssets = { hero: heroGltf.scene, zombie: zombieGltf.scene, heroClips, zombieClips, raptor: raptorGltf.scene, rex: rexGltf.scene, raptorClips: named(raptorGltf), rexClips: named(rexGltf) };
  if (mechLoad) {
    const [small, big] = await mechLoad;
    prepare(small.scene, materials);
    prepare(big.scene, materials);
    out.mech = { small: small.scene, big: big.scene, smallClips: named(small), bigClips: named(big) };
  }
  return out;
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

const gripPos = new Vector3();
const gripDir = new Vector3();
const thrustDir = new Vector3();
/** Thrust grip (C1): seconds to let go after the attack ended or was cancelled. */
const THRUST_LET_GO = 0.15;

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
  /** Clothing for the equipped items (`heroLook`). */
  look: HeroLook;
}

/** Flinch length of a heavy hit (2D #43); the clip is slowed to fit, control is never taken. */
const HEAVY_FLINCH = 0.45;

export class HeroView {
  readonly root = new Group();
  readonly rack: WeaponRack;
  private spinA = 0;
  private readonly anim: Animator;
  private readonly ik: LeftHandIk;
  private ikW = 0;
  /** 0..1: how far the left hand is in the two-handed standing pose (grip height, wrist roll, stretch). */
  private stance = 0;
  /** Thrust grip weight (C1) of the last frame; decays after the attack so a cancel never snaps. */
  private thrustW = 0;
  private thrustYaw = 0;
  private thrustReach = 3;
  /** 2D #43: the last hit was heavy (a stronger, longer flinch; still no forced stumble or stun). */
  private heavyHit = false;
  /** Body, clothing pieces and spring chains. */
  readonly body: HeroModel;

  constructor(assets: CharacterAssets, materials: Materials) {
    this.body = new HeroModel(assets.hero);
    const model = this.body.model;
    this.root.add(model);
    this.anim = new Animator(model, assets.heroClips);
    this.rack = new WeaponRack(materials);
    this.rack.show('blade', undefined);
    model.getObjectByName('hand_r')?.add(this.rack.group);
    this.ik = new LeftHandIk(model, assets.heroClips.get(FIST_CLIP));
    this.root.traverse(object => { if ((object as Mesh).isMesh) object.layers.enable(HERO_LAYER); });
  }

  /** A hit landed: heavy ones (a large share of max life) flinch harder. */
  hit(heavy: boolean): void {
    this.heavyHit = heavy;
  }

  update(p: Player, alpha: number, dt: number, frozen: boolean, pose: HeroPose): void {
    const x = lerp(p.px, p.x, alpha);
    const z = lerp(p.pz, p.z, alpha);
    this.root.position.set(x, groundY(x, z) + pose.leap, z);
    this.root.rotation.y = lerpAngle(p.pfacing, p.facing, alpha);
    const model = weaponModel(pose.kind, pose.base);
    this.rack.show(model, pose.element);
    this.body.setLook(pose.look);
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
    const fd = this.heavyHit ? HEAVY_FLINCH : 0.3;
    const flinch = p.state !== 'dead' && p.hurtT < fd ? (this.heavyHit ? 1 : 0.75) * (1 - p.hurtT / fd) : 0;
    a.mix('Hit_Chest', p.hurtT * (0.3 / fd), flinch);
    // The mixer skips bones whose clip value did not change (hitstop, held keys): undo last frame's IK first.
    this.ik.restore();
    a.update(frozen ? 0 : dt);
    this.thrust(p, t, dt, frozen, model);
    this.leftHand(p, t, dt, frozen, flinch, standing);
    this.body.sway(x, z, this.root.rotation.y, dt);
  }

  /** World height of the weapon tip during a thrust (smear height), NaN otherwise. */
  thrustTipY(): number {
    return this.rack.thrustTipY();
  }

  /**
   * Thrust grip (C1): during `thrust` attacks the weapon turns in the hand to point along the attack
   * direction (facing plus the arc, `thrustWeight` over clip time). Out of the attack the weight decays,
   * and a chained thrust picks up from where the last one left off.
   */
  private thrust(p: Player, t: number, dt: number, frozen: boolean, model: WeaponModel): void {
    const k = THRUST[model];
    const a = p.state === 'attack' ? p.attack : null;
    let w = frozen ? this.thrustW : Math.max(0, this.thrustW - dt / THRUST_LET_GO);
    if (k && a && a.style === 'thrust') {
      w = Math.max(w, thrustWeight(a, attackClipTime(a, t, p.attackSpeed)));
      this.thrustYaw = a.from + (a.to - a.from) * Math.min(1, Math.max(0, (t - a.windup) / a.active));
      this.thrustReach = a.reach;
    }
    this.thrustW = k ? w : 0;
    if (this.thrustW <= 0) { this.rack.aimThrust(0, thrustDir); return; }
    // From the hand toward the point at full reach on the hit line (facing plus the arc, the smear's
    // leading edge), a few degrees below level: the tip converges on the smear although the hand is off-axis.
    this.root.updateMatrixWorld(true);
    const f = this.root.rotation.y + this.thrustYaw;
    const pitch = k?.pitch ?? 0;
    const hand = this.rack.group.parent;
    if (hand) hand.getWorldPosition(thrustDir); else thrustDir.copy(this.root.position);
    const dx = this.root.position.x + Math.sin(f) * this.thrustReach - thrustDir.x;
    const dz = this.root.position.z + Math.cos(f) * this.thrustReach - thrustDir.z;
    const flat = Math.hypot(dx, dz) || 1;
    thrustDir.set((dx / flat) * Math.cos(pitch), -Math.sin(pitch), (dz / flat) * Math.cos(pitch));
    this.rack.aimThrust(this.thrustW, thrustDir);
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
}
