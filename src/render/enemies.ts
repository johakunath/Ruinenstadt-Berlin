// Enemy bodies (M12). Four rigs: the CC0 zombie body in six dressed variants (proportions by bone
// scale, gear built in code), the raptor and the Rex (Quaternius dinosaurs, repainted in
// tools/build-creatures.mjs) and a crow built from a few boxes with a procedural wing beat.
// One-shot poses follow sim time, so wind-up, release and hitbox always agree.
import {
  BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Sphere, TorusGeometry, Vector3,
  type AnimationClip, type BufferGeometry, type Object3D, type SkinnedMesh,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ELITES, SPAWN, type BodyKind, type EnemyKind } from '../data/enemies';
import { lerp, lerpAngle } from '../sim/math';
import { DT, type Enemy } from '../sim/types';
import { Animator, type CharacterAssets } from './characters';
import { groundY } from './ground';
import type { LitMaterial, Materials } from './materials';
import { WeaponRack } from './weapons';

const FLASH_TIME = 0.1;
const WHITE = new Color(0xffffff);
/** Death01 starts with a long stagger; skip into it. */
const DEATH_FROM = 0.35;
/** Clip time of Zombie_Scratch at which the claw lands. */
const SCRATCH_HIT = 0.55;
const SCRATCH_SWIPE = 0.16;
const WALK_CLIP_SPEED = 1.15;

/** Skin tints per kind (one is picked per body). */
const TINTS: Record<EnemyKind, number[]> = {
  walker: [0xb9c7ae, 0xa9b9b0, 0xc4bd9c],
  runner: [0xcfc9a4, 0xb6c9b8],
  brute: [0x93a58f, 0xa08f86],
  spitter: [0xa9c77c, 0x9cbf86],
  raptor: [0xffffff, 0xe8f0d8, 0xf2e2d0],
  crow: [0xffffff],
  feldwebel: [0x9fb0a0],
  waechter: [0x8f8a80],
  rex: [0xffffff],
  hauptmann: [0xb39a86],
};

/** Clothing tint per kind (multiplies the painted rags): uniforms for the 1906 garrison. */
const CLOTH: Partial<Record<EnemyKind, number>> = {
  spitter: 0x9aa878, brute: 0xb8a898, feldwebel: 0x5a6f9a, waechter: 0x6a5a4a, hauptmann: 0x44588c,
};

/** Proportions by bone scale; children inherit, so a big chest needs a smaller head to match. */
const SHAPE: Partial<Record<EnemyKind, Record<string, number>>> = {
  runner: { upperarm_l: 1.12, upperarm_r: 1.12, Head: 0.94 },
  brute: { spine_02: 1.32, Head: 0.72 },
  spitter: { spine_01: 1.3, spine_03: 0.78, Head: 1.12 },
  feldwebel: { spine_02: 1.14, Head: 0.9 },
  waechter: { upperarm_l: 1.18, upperarm_r: 1.18, Head: 0.95 },
  hauptmann: { spine_02: 1.12, Head: 0.92 },
};

/** Extra stretch of the whole body: x/z, y. */
const BUILD: Partial<Record<EnemyKind, [number, number]>> = {
  runner: [0.86, 1], brute: [1.12, 1], feldwebel: [1.1, 1], waechter: [0.9, 1.1], hauptmann: [1.1, 1],
};

// ---------------------------------------------------------------- gear

interface GearKit { steel: LitMaterial; brass: LitMaterial; rust: LitMaterial; dark: LitMaterial; red: LitMaterial; blue: LitMaterial; cloth: LitMaterial; bone: LitMaterial; acid: LitMaterial; lamp: LitMaterial }
let kit: GearKit | null = null;
function gearKit(m: Materials): GearKit {
  kit ??= {
    steel: m.surface({ color: 0x8a9096, roughness: 0.4, metalness: 0.75 }),
    brass: m.surface({ color: 0xc9a23a, roughness: 0.35, metalness: 0.85 }),
    rust: m.surface({ color: 0x6e4a34, roughness: 0.7, metalness: 0.5 }),
    dark: m.surface({ color: 0x1c1d22, roughness: 0.6, metalness: 0.2 }),
    red: m.surface({ color: 0xa8281e, roughness: 0.9, doubleSided: true }),
    blue: m.surface({ color: 0x2f3f6a, roughness: 0.9, doubleSided: true }),
    cloth: m.surface({ color: 0x4a3c30, roughness: 0.95, doubleSided: true }),
    bone: m.surface({ color: 0xd9d2b4, roughness: 0.8 }),
    acid: m.surface({ color: 0x5a7a2a, emissive: 0x97c459, emissiveIntensity: 1.6, roughness: 0.4 }),
    lamp: m.surface({ color: 0x3a2a12, emissive: 0xffb04a, emissiveIntensity: 3, roughness: 0.4 }),
  };
  return kit;
}

type Part = [BufferGeometry, keyof GearKit];
const tf = (g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry => {
  if (rx || ry || rz) g.rotateX(rx).rotateY(ry).rotateZ(rz);
  return g.translate(x, y, z);
};

/** Merges parts per material into a few meshes. */
function assemble(k: GearKit, parts: Part[], castShadow: boolean): Group {
  const by = new Map<keyof GearKit, BufferGeometry[]>();
  for (const [g, m] of parts) {
    const list = by.get(m) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    by.set(m, list);
  }
  const group = new Group();
  for (const [m, list] of by) {
    const mesh = new Mesh(mergeGeometries(list), k[m]);
    mesh.castShadow = castShadow;
    group.add(mesh);
  }
  return group;
}

/** Pickelhaube: dome, brim, spike, front plate. Built around the origin at the top of the skull. */
function pickelhaube(gold: boolean): Part[] {
  const shell: keyof GearKit = 'dark';
  return [
    [tf(new SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0), shell],
    [tf(new CylinderGeometry(0.15, 0.17, 0.025, 12), 0, 0, 0.012), shell],
    [tf(new BoxGeometry(0.2, 0.02, 0.1), 0, -0.005, 0.15, 0.35), shell],
    [tf(new ConeGeometry(0.022, 0.13, 8), 0, 0.19, 0), 'brass'],
    [tf(new CylinderGeometry(0.035, 0.04, 0.03, 8), 0, 0.13, 0), 'brass'],
    [tf(new BoxGeometry(0.1, 0.085, 0.012), 0, 0.055, 0.128, -0.25), gold ? 'brass' : 'steel'],
    [tf(new TorusGeometry(0.148, 0.01, 4, 14), 0, 0.012, 0, Math.PI / 2), 'brass'],
  ];
}

/** Epaulettes on both shoulders; `fringe` for the captain. */
function epaulettes(fringe: boolean): Part[] {
  const out: Part[] = [];
  for (const s of [-1, 1]) {
    out.push([tf(new BoxGeometry(0.16, 0.025, 0.11), s * 0.21, 0, 0, 0, 0, -s * 0.15), 'brass']);
    out.push([tf(new CylinderGeometry(0.06, 0.06, 0.03, 10), s * 0.28, -0.01, 0), 'brass']);
    if (fringe) out.push([tf(new CylinderGeometry(0.062, 0.07, 0.07, 10, 1, true), s * 0.28, -0.055, 0), 'brass']);
  }
  return out;
}

/** Uniform tunic: a shell around the chest, collar, buttons. */
function tunic(coat: keyof GearKit, trim: keyof GearKit): Part[] {
  return [
    [tf(new CylinderGeometry(0.2, 0.165, 0.46, 10, 1, true).scale(1.22, 1, 0.92), 0, -0.13, 0.01), coat],
    [tf(new TorusGeometry(0.1, 0.028, 5, 12).scale(1.15, 1, 1), 0, 0.11, 0, Math.PI / 2), trim],
    ...[0, 1, 2, 3].map((i): Part => [tf(new SphereGeometry(0.018, 6, 4), 0, 0.04 - i * 0.1, 0.19 - i * 0.004), 'brass']),
  ];
}

function gearFor(kind: EnemyKind, model: Object3D, materials: Materials, castShadow: boolean): Object3D[] {
  const k = gearKit(materials);
  const out: Object3D[] = [];
  const bone = (n: string): Object3D | undefined => model.getObjectByName(n);
  const p = new Vector3();
  /** Builds parts in model space around a bone's rest position and hands them to the bone. */
  const mount = (name: string, parts: Part[], dy = 0, dz = 0): void => {
    const b = bone(name);
    if (!b) return;
    const g = assemble(k, parts, castShadow);
    b.getWorldPosition(p);
    model.worldToLocal(p);
    g.position.set(p.x, p.y + dy, p.z + dz);
    model.add(g);
    b.attach(g);
    out.push(g);
  };
  switch (kind) {
    case 'brute':
      // Boiler plate bolted over one shoulder, a rusted collar.
      mount('spine_03', [
        [tf(new SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), -0.24, 0.1, 0, 0, 0, 0.5), 'rust'],
        [tf(new TorusGeometry(0.13, 0.035, 5, 12), 0, 0.17, 0, Math.PI / 2), 'rust'],
        [tf(new BoxGeometry(0.34, 0.2, 0.03), 0, -0.02, 0.15, -0.1), 'steel'],
      ]);
      break;
    case 'spitter':
      // Swollen throat sac that glows before it spits, boils on the back.
      mount('neck_01', [
        [tf(new SphereGeometry(0.105, 10, 8), 0, -0.02, 0.09), 'acid'],
        [tf(new SphereGeometry(0.06, 8, 6), 0.09, -0.1, -0.1), 'acid'],
        [tf(new SphereGeometry(0.05, 8, 6), -0.07, -0.16, -0.12), 'acid'],
      ]);
      break;
    case 'feldwebel':
      mount('Head', pickelhaube(false), 0.12);
      mount('spine_03', [...epaulettes(false), ...tunic('blue', 'red')], 0.08);
      break;
    case 'waechter':
      // Hooded keeper of the tower: wide hat, a lantern in the left hand, a chain of keys.
      mount('Head', [
        [tf(new CylinderGeometry(0.26, 0.28, 0.02, 14), 0, 0, 0), 'cloth'],
        [tf(new CylinderGeometry(0.1, 0.13, 0.13, 10), 0, 0.07, 0), 'cloth'],
        [tf(new TorusGeometry(0.125, 0.012, 4, 12), 0, 0.02, 0, Math.PI / 2), 'brass'],
      ], 0.1);
      mount('hand_l', [
        [tf(new CylinderGeometry(0.07, 0.07, 0.16, 8), 0, -0.2, 0), 'lamp'],
        [tf(new ConeGeometry(0.1, 0.07, 8), 0, -0.09, 0), 'rust'],
        [tf(new CylinderGeometry(0.085, 0.085, 0.02, 8), 0, -0.29, 0), 'rust'],
        [tf(new TorusGeometry(0.04, 0.008, 4, 10), 0, -0.03, 0), 'rust'],
      ]);
      mount('spine_03', tunic('cloth', 'rust'), 0.08);
      mount('pelvis', [[tf(new CylinderGeometry(0.2, 0.3, 0.62, 10, 1, true), 0, -0.3, 0), 'cloth'], [tf(new TorusGeometry(0.2, 0.015, 4, 14), 0, 0.05, 0, Math.PI / 2), 'rust'], [tf(new BoxGeometry(0.03, 0.14, 0.01), 0.17, -0.04, 0.12), 'brass'], [tf(new BoxGeometry(0.03, 0.11, 0.01), 0.12, -0.03, 0.16), 'brass']]);
      break;
    case 'hauptmann':
      mount('Head', [...pickelhaube(true), [tf(new ConeGeometry(0.05, 0.2, 6), 0, 0.3, -0.02, -0.25), 'red']], 0.12);
      mount('spine_03', [
        ...epaulettes(true), ...tunic('blue', 'red'),
        // Sash across the chest.
        [tf(new BoxGeometry(0.07, 0.56, 0.02), 0.03, -0.12, 0.2, 0, 0, 0.75), 'red'],
      ], 0.08);
      // Coat tails.
      mount('pelvis', [[tf(new CylinderGeometry(0.2, 0.27, 0.4, 10, 1, true, Math.PI * 0.6, Math.PI * 1.8), 0, -0.2, 0), 'blue']]);
      break;
    default:
      break;
  }
  return out;
}

// ---------------------------------------------------------------- crow

interface Crow { model: Group; wingL: Group; wingR: Group; tipL: Group; tipR: Group; head: Group; mats: LitMaterial[]; eyes: LitMaterial }

function buildCrow(materials: Materials, castShadow: boolean): Crow {
  const black = materials.surface({ color: 0x1a1c22, roughness: 0.55, metalness: 0.15, doubleSided: true });
  const beakM = materials.surface({ color: 0x8a8068, roughness: 0.6 });
  const eyes = materials.surface({ color: 0x401010, emissive: 0xff3a2a, emissiveIntensity: 2.6 });
  const model = new Group();
  const mk = (g: BufferGeometry, m: LitMaterial, parent: Object3D): Mesh => {
    const mesh = new Mesh(g, m);
    mesh.castShadow = castShadow;
    parent.add(mesh);
    return mesh;
  };
  // Body along +Z: chest, tail fan, ragged rib cut.
  mk(tf(new SphereGeometry(0.16, 8, 6).scale(0.8, 0.75, 1.5), 0, 0, 0), black, model);
  mk(tf(new BoxGeometry(0.2, 0.02, 0.3), 0, 0, -0.33, 0.1), black, model);
  mk(tf(new BoxGeometry(0.1, 0.02, 0.3), 0.11, 0, -0.3, 0.1, -0.3), black, model);
  mk(tf(new BoxGeometry(0.1, 0.02, 0.3), -0.11, 0, -0.3, 0.1, 0.3), black, model);
  const head = new Group();
  head.position.set(0, 0.07, 0.24);
  model.add(head);
  mk(new SphereGeometry(0.085, 8, 6), black, head);
  mk(tf(new ConeGeometry(0.035, 0.17, 5), 0, -0.01, 0.13, Math.PI / 2), beakM, head);
  for (const s of [-1, 1]) mk(tf(new SphereGeometry(0.02, 6, 4), s * 0.055, 0.03, 0.05), eyes, head);
  const wing = (s: number): [Group, Group] => {
    const root = new Group();
    root.position.set(s * 0.1, 0.04, 0.04);
    model.add(root);
    mk(tf(new BoxGeometry(0.34, 0.02, 0.26), s * 0.17, 0, 0), black, root);
    const tip = new Group();
    tip.position.set(s * 0.34, 0, 0);
    root.add(tip);
    mk(tf(new BoxGeometry(0.36, 0.015, 0.2), s * 0.18, 0, -0.02), black, tip);
    for (let i = 0; i < 3; i++) mk(tf(new BoxGeometry(0.05, 0.012, 0.16), s * (0.14 + i * 0.09), 0, -0.14 - i * 0.02, 0, -s * 0.3), black, tip);
    return [root, tip];
  };
  const [wingL, tipL] = wing(1);
  const [wingR, tipR] = wing(-1);
  return { model, wingL, wingR, tipL, tipR, head, mats: [black, beakM], eyes };
}

// ---------------------------------------------------------------- view

interface DinoClips { hit: number; swipe: number; walk: number; run: number }
/** Where the bite lands in the Attack clip and how far the clips carry the body per second. */
const DINO: Record<'raptor' | 'rex', DinoClips> = {
  raptor: { hit: 0.36, swipe: 0.14, walk: 1.1, run: 6.5 },
  rex: { hit: 0.52, swipe: 0.16, walk: 2.4, run: 7 },
};

/** Eye position from the head joint, in Rex meters (the raptor scales it down). */
const EYE = { x: 0.24, y: 0.1, z: 0.4 };

export class EnemyView {
  readonly root = new Group();
  id = -1;
  kind: EnemyKind = 'walker';
  /** Frames to skip between animation updates (distance LOD). */
  private skip = 0;
  private pending = 0;
  private flash = 0;
  private status = 0;
  private time = Math.random() * 10;
  private readonly inner = new Group();
  private readonly anim: Animator | null = null;
  private readonly crow: Crow | null = null;
  private readonly mats: LitMaterial[] = [];
  private readonly cloth: LitMaterial[] = [];
  private readonly glow: LitMaterial[] = [];
  private readonly seed = Math.random();
  private readonly gear = new Map<EnemyKind, Object3D[]>();
  private readonly bones = new Map<string, Object3D>();
  private readonly model: Object3D | null = null;
  private rack: WeaponRack | null = null;

  constructor(assets: CharacterAssets, private readonly materials: Materials, readonly body: BodyKind, private readonly castShadow: boolean) {
    this.root.add(this.inner);
    if (body === 'crow') {
      this.crow = buildCrow(materials, castShadow);
      this.inner.add(this.crow.model);
      this.mats.push(...this.crow.mats);
      this.glow.push(this.crow.eyes);
      return;
    }
    const src = body === 'zombie' ? assets.zombie : body === 'raptor' ? assets.raptor : assets.rex;
    const clips: Map<string, AnimationClip> = body === 'zombie' ? assets.zombieClips : body === 'raptor' ? assets.raptorClips : assets.rexClips;
    const model = cloneSkinned(src);
    this.model = model;
    this.inner.add(model);
    this.anim = new Animator(model, clips);
    const own = new Map<unknown, LitMaterial>();
    model.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isMesh) return;
      const one = (srcMat: LitMaterial): LitMaterial => {
        let mat = own.get(srcMat);
        if (!mat) {
          mat = srcMat.clone();
          own.set(srcMat, mat);
          if (srcMat.name === 'eyes') {
            mat.emissive.set(body === 'zombie' ? 0xd8ff7a : 0xffc04a);
            mat.emissiveIntensity = body === 'zombie' ? 2.2 : 3;
            this.glow.push(mat);
          } else {
            (srcMat.name === 'cloth' ? this.cloth : this.mats).push(mat);
            if (srcMat.name === 'cloth') this.mats.push(mat);
          }
        }
        return mat;
      };
      mesh.material = Array.isArray(mesh.material) ? (mesh.material as LitMaterial[]).map(one) : one(mesh.material as LitMaterial);
      mesh.castShadow = castShadow;
      if (body === 'zombie') {
        mesh.frustumCulled = true;
        mesh.boundingSphere = new Sphere(new Vector3(0, 0.9, 0), 1.7);
      } else mesh.frustumCulled = false;
    });
    if (body !== 'zombie') {
      // The pack's dinosaurs have no eye geometry: two embers on the skull.
      model.updateMatrixWorld(true);
      const head = model.getObjectByName('Head');
      if (head) {
        const eye = materials.surface({ color: 0x401808, emissive: 0xffb040, emissiveIntensity: 3 });
        this.glow.push(eye);
        const k = body === 'rex' ? 1 : 0.36;
        const big = body === 'rex' ? 1.45 : 1;
        const p = head.getWorldPosition(new Vector3());
        for (const s of [-1, 1]) {
          const m = new Mesh(new SphereGeometry(0.075 * k, 8, 6), eye);
          m.position.set(p.x + s * EYE.x * k * big, p.y + EYE.y * k * (body === 'rex' ? 2.4 : 1), p.z + EYE.z * k * big);
          model.add(m);
          head.attach(m);
        }
      }
    }
    if (body === 'zombie') {
      model.updateMatrixWorld(true);
      for (const names of Object.values(SHAPE)) for (const n of Object.keys(names)) {
        const b = model.getObjectByName(n);
        if (b) this.bones.set(n, b);
      }
    }
  }

  assign(e: Enemy): void {
    this.id = e.id;
    this.kind = e.kind;
    this.flash = 0;
    this.status = 0;
    this.inner.rotation.set(0, 0, 0);
    this.inner.position.set(0, 0, 0);
    const b = BUILD[e.kind] ?? [1, 1];
    const s = e.def.scale * (e.elite ? 1.15 : 1);
    this.root.scale.set(s * b[0], s * b[1], s * b[0]);
    const tints = TINTS[e.kind];
    const tint = tints[Math.floor(this.seed * tints.length)] as number;
    for (const m of this.mats) {
      if (m.name === 'skin') m.color.set(tint);
      m.emissive.setScalar(0);
    }
    for (const m of this.cloth) m.color.set(CLOTH[e.kind] ?? 0xffffff);
    if (this.body === 'zombie' && this.model) {
      // Proportions and gear of this kind; everything else back to plain.
      for (const bone of this.bones.values()) bone.scale.setScalar(1);
      for (const [n, v] of Object.entries(SHAPE[e.kind] ?? {})) this.bones.get(n)?.scale.setScalar(v);
      for (const list of this.gear.values()) for (const g of list) g.visible = false;
      let gear = this.gear.get(e.kind);
      if (!gear) {
        gear = gearFor(e.kind, this.model, this.materials, this.castShadow);
        this.gear.set(e.kind, gear);
      }
      for (const g of gear) g.visible = true;
      // Officers carry a saber.
      const armed = e.kind === 'feldwebel' || e.kind === 'hauptmann';
      if (armed && !this.rack) {
        this.rack = new WeaponRack(this.materials);
        this.rack.show('blade', undefined);
        this.model.getObjectByName('hand_r')?.add(this.rack.group);
      }
      if (this.rack) this.rack.group.visible = armed;
      for (const m of this.glow) m.emissive.set(e.def.boss ? 0xff5a2a : e.kind === 'spitter' ? 0x97ff5a : 0xd8ff7a);
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
    if (!frozen) this.time += dt;
    // White hit flash: full for half the time, then fading. Runs through hitstop.
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      const k = Math.min(1, (this.flash / FLASH_TIME) * 2);
      for (const m of this.mats) m.emissive.copy(WHITE).multiplyScalar(k * 0.85);
      if (this.flash <= 0) this.status = -1;
    } else {
      // Burning bodies glow orange, corroded ones green, open ones gold, elites faintly in their color.
      const st = e.state === 'dead' ? 0 : e.burn > 0 ? 1 : e.acid > 0 ? 2 : e.open > 0 ? 3 : e.elite ? 4 : 0;
      if (st !== this.status) {
        this.status = st;
        const hex = st === 1 ? 0x7a2a08 : st === 2 ? 0x2a4a10 : st === 3 ? 0x5a4408 : st === 4 ? new Color(ELITES[e.elite!].color).multiplyScalar(0.16).getHex() : 0x000000;
        for (const m of this.mats) m.emissive.setHex(hex);
      }
    }
    const t = e.stateT + (frozen ? 0 : alpha * DT);
    if (this.body === 'crow') this.poseCrow(e, t);
    else if (this.body === 'zombie') this.poseZombie(e, t);
    else this.poseDino(e, t, DINO[this.body]);
    if (e.state === 'dead') {
      // Sink into the ground before the body is removed.
      const sink = Math.max(0, t - (SPAWN.corpseTime - 0.8)) / 0.8;
      this.root.position.y -= sink * (this.body === 'rex' ? 1.6 : 0.55);
    }
    if (!this.anim) return;
    // Distance LOD: far enemies update their skeleton every 2nd or 3rd frame with the summed time.
    this.pending += frozen ? 0 : dt;
    if (this.skip > 0 && this.flash <= 0 && e.state === 'chase') {
      this.skip--;
      return;
    }
    this.skip = skip;
    this.anim.update(this.pending);
    this.pending = 0;
  }

  private poseZombie(e: Enemy, t: number): void {
    const a = this.anim!;
    const def = e.def;
    const lean = this.inner.rotation;
    let pitch = 0;
    switch (e.state) {
      case 'chase':
        if (e.speed > 0.2) a.loop('Zombie_Walk_Fwd_Loop', 0.2, Math.min(2.8, Math.max(0.8, e.speed / (WALK_CLIP_SPEED * def.scale))));
        else a.loop('Zombie_Idle_Loop', 0.25);
        // Open: bent over, catching breath.
        if (e.open > 0) pitch = 0.32;
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
      case 'special': {
        const sp = e.sp;
        if (!sp) break;
        const w = Math.min(1, t / sp.wind);
        const g = Math.min(1, Math.max(0, (t - sp.wind) / sp.go));
        const going = t >= sp.wind;
        switch (sp.kind) {
          case 'spit': case 'fan':
            // Rears back while the throat swells, then snaps forward.
            a.loop('Zombie_Idle_Loop', 0.1);
            pitch = going ? lerp(0.5, 0, g) : -0.38 * w;
            break;
          case 'slam': case 'stomp': case 'bossSlam': case 'flame':
            a.pose('Sword_Heavy_Combo', going ? lerp(2.66, 2.95, g) : lerp(2.3, 2.66, w * w), 0.1);
            break;
          case 'lunge': case 'charge': case 'pounce':
            if (going) a.pose('Shield_Dash', lerp(0, 0.3, g), 0.05);
            else {
              a.pose('Zombie_Scratch', lerp(0.05, 0.35, w), 0.12);
              pitch = 0.3 * w;
            }
            break;
          case 'barrage':
            a.pose('OverhandThrow', going ? lerp(0.37, 0.7, g) : lerp(0.1, 0.37, w), 0.1);
            break;
          default:
            // Summon, ring: the arm goes out, a command.
            a.pose('Spell_Simple_Shoot', Math.min(0.49, t * 0.5), 0.12);
            pitch = going ? 0 : -0.12 * w;
            break;
        }
        break;
      }
      case 'stagger':
        if (e.staggerDur > 0.4) a.pose('Hit_Knockback', (t / e.staggerDur) * a.duration('Hit_Knockback'), 0.04);
        else a.pose('Hit_Chest', t, 0.03);
        break;
      case 'dead':
        a.pose('Death01', DEATH_FROM + t * 1.3, 0.06);
        break;
    }
    lean.x += (pitch - lean.x) * 0.35;
    // The spitter's throat swells while it winds up.
    if (this.kind === 'spitter') {
      const sac = this.gear.get('spitter')?.[0];
      const swell = e.state === 'special' && e.sp && e.stateT < e.sp.wind ? 1 + 0.7 * (e.stateT / e.sp.wind) : 1 + 0.06 * Math.sin(this.time * 4);
      sac?.scale.setScalar(swell);
    }
  }

  private poseDino(e: Enemy, t: number, k: DinoClips): void {
    const a = this.anim!;
    const def = e.def;
    const lean = this.inner.rotation;
    let pitch = 0;
    let spin = 0;
    switch (e.state) {
      case 'chase':
        if (e.speed > 3.4) a.loop('Run', 0.15, Math.min(2.2, e.speed / k.run));
        else if (e.speed > 0.2) a.loop('Walk', 0.2, Math.min(3, Math.max(0.7, e.speed / k.walk)));
        else a.loop('Idle', 0.25);
        if (e.open > 0) pitch = 0.22;
        break;
      case 'windup':
        a.pose('Attack', lerp(0, k.hit, Math.min(1, t / def.windup)), 0.12);
        break;
      case 'strike':
        a.pose('Attack', k.hit + k.swipe * Math.min(1, t / def.active), 0.03);
        break;
      case 'recover':
        a.pose('Attack', lerp(k.hit + k.swipe, a.duration('Attack'), Math.min(1, t / def.recovery)), 0.05);
        break;
      case 'special': {
        const sp = e.sp;
        if (!sp) break;
        const w = Math.min(1, t / sp.wind);
        const g = Math.min(1, Math.max(0, (t - sp.wind) / sp.go));
        const going = t >= sp.wind;
        if (sp.kind === 'pounce') {
          // Crouch, then the jump clip carries the leap.
          const len = a.duration('Jump');
          a.pose('Jump', going ? lerp(len * 0.3, len * 0.85, g) : lerp(0, len * 0.3, w), 0.06);
          if (!going) pitch = 0.18 * w;
        } else if (sp.kind === 'charge') {
          if (going) a.loop('Run', 0.06, 2);
          else {
            // Paws the ground, head low.
            a.loop('Walk', 0.15, 0.01);
            pitch = 0.3 * w;
          }
        } else if (sp.kind === 'roar') {
          a.pose('Attack', lerp(0.1, k.hit, going ? 1 : w), 0.15);
          pitch = going ? -0.28 + 0.05 * Math.sin(this.time * 40) : -0.2 * w;
        } else if (sp.kind === 'tail') {
          a.loop('Idle', 0.1);
          // The whole body whips around once.
          spin = going ? Math.PI * 2 * g : -0.5 * w;
        } else a.loop('Idle', 0.15);
        break;
      }
      case 'stagger':
        a.loop('Idle', 0.05);
        pitch = -0.2 * Math.max(0, 1 - t / Math.max(0.01, e.staggerDur));
        break;
      case 'dead':
        a.pose('Death', t * 1.1, 0.06);
        break;
    }
    lean.x += (pitch - lean.x) * 0.3;
    lean.y = spin;
  }

  private poseCrow(e: Enemy, t: number): void {
    const c = this.crow!;
    const m = this.inner;
    let y = 1.6 + 0.08 * Math.sin(this.time * 3 + this.seed * 6);
    let beat = Math.sin(this.time * 15) * 0.7;
    let fold = 0;
    let pitch = 0;
    let roll = 0.25 * e.side;
    switch (e.state) {
      case 'chase':
        if (e.rest > 0) {
          // Dazed on the ground after a dive.
          y = 0.16 + 0.03 * Math.abs(Math.sin(this.time * 9));
          beat = Math.sin(this.time * 22) * 0.12;
          fold = 0.9;
          roll = 0;
        }
        break;
      case 'special': {
        const sp = e.sp;
        if (!sp) break;
        if (t < sp.wind) {
          // Rears up with spread wings before it drops.
          y = 1.6 + 0.5 * (t / sp.wind);
          beat = Math.sin(this.time * 30) * 0.35 + 0.5;
          pitch = -0.5;
        } else {
          const g = Math.min(1, (t - sp.wind) / sp.go);
          y = lerp(2.1, 0.75, Math.min(1, g * 2.2));
          beat = -0.2;
          fold = 0.55;
          pitch = 0.6 * (1 - g);
        }
        roll = 0;
        break;
      }
      case 'stagger':
        roll = Math.sin(t * 20) * 0.6;
        beat = Math.sin(this.time * 34) * 0.9;
        break;
      case 'dead':
        y = Math.max(0.1, 1.4 - t * t * 9);
        beat = 0.9;
        roll = Math.min(2.4, t * 7);
        break;
      default:
        break;
    }
    m.position.y += (y - m.position.y) * (e.state === 'dead' ? 1 : 0.25);
    m.rotation.x += (pitch - m.rotation.x) * 0.3;
    m.rotation.z += (roll - m.rotation.z) * 0.2;
    c.wingL.rotation.z = beat - fold * 0.2;
    c.wingR.rotation.z = -beat + fold * 0.2;
    c.wingL.rotation.y = -fold;
    c.wingR.rotation.y = fold;
    c.tipL.rotation.z = beat * 0.6 - fold * 0.6;
    c.tipR.rotation.z = -beat * 0.6 + fold * 0.6;
    c.head.rotation.x = 0.2 + 0.1 * Math.sin(this.time * 5);
  }
}
