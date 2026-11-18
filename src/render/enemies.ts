// Enemy bodies (M12). Five rigs: the CC0 zombie body in dressed variants (proportions by bone
// scale, gear built in code), the raptor and the Rex (Quaternius dinosaurs, repainted in
// tools/build-creatures.mjs), a crow built from a few boxes with a procedural wing beat and (M12b)
// a rat from six small meshes (shared geometry) with a run cycle from sim time.
// M12c (Mitte): Kabelghul, Boxenkopf and four bosses on the zombie rig (cables and speakers in code),
// pink cables on every Schlurfer, Hetzer and Brocken on neon maps, and drones built in code (shared
// geometry, the four rotors one instanced mesh spun from time).
// One-shot poses follow sim time, so wind-up, release and hitbox always agree.
import {
  BoxGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry, Sphere, TorusGeometry, TubeGeometry, Vector3,
  type AnimationClip, type BufferGeometry, type Object3D, type SkinnedMesh,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOSS, ELITES, SPAWN, type BodyKind, type EnemyKind } from '../data/enemies';
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
/** Seconds a lying guard takes to get up. */
const RISE_TIME = 0.7;
/** M12c Türsteher grab: Zombie_Scratch at the end of the swipe, hunched with both hands in front (clutching), held while the hero is caught. */
const GRAB_HOLD = 0.68;
/** M12c shove: Shield_Dash with the arms out in front (from the clip sheet), reached when the circle goes off. */
const SHOVE_PUSH = 0.25;

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
  schaffner: [0xa8a49a],
  rat: [0xffffff],
  grenzer: [0xb0b4a2],
  brandmeister: [0xc4a08a],
  rattenmutter: [0x9c9a7e],
  spreehexe: [0xc8ccb8],
  // M12c Mitte (board: pale violet-grey skin under neon).
  kabel: [0xc4b8c0, 0xb8aeb8],
  bass: [0xa89ca4],
  drone: [0xffffff],
  tuersteher: [0x9c8e8c],
  wachdrohne: [0xffffff],
  dirigent: [0xb8b0a8],
  bassprediger: [0xa8989c],
};

/** Clothing tint per kind (multiplies the painted rags): uniforms for the 1906 garrison. */
const CLOTH: Partial<Record<EnemyKind, number>> = {
  spitter: 0x9aa878, brute: 0xb8a898, feldwebel: 0x5a6f9a, waechter: 0x6a5a4a, hauptmann: 0x44588c, schaffner: 0x2e3f5c,
  // M12b Xhain 1981: GDR border grey-green, riot red-orange, sewer brown-green, squat black.
  grenzer: 0x6f7a5e, brandmeister: 0xb8482a, rattenmutter: 0x5e5a3a, spreehexe: 0x2e2834,
  // M12c Mitte 2089: rags in violet-brown, the Boxenkopf's purple, black for the bouncer and the conductor.
  kabel: 0x6a5260, bass: 0x5a4a78, tuersteher: 0x2a2a30, dirigent: 0x26242a, bassprediger: 0x3e2c48,
};

/** Proportions by bone scale; children inherit, so a big chest needs a smaller head to match. */
const SHAPE: Partial<Record<EnemyKind, Record<string, number>>> = {
  runner: { upperarm_l: 1.12, upperarm_r: 1.12, Head: 0.94 },
  brute: { spine_02: 1.32, Head: 0.72 },
  spitter: { spine_01: 1.3, spine_03: 0.78, Head: 1.12 },
  feldwebel: { spine_02: 1.14, Head: 0.9 },
  waechter: { upperarm_l: 1.18, upperarm_r: 1.18, Head: 0.95 },
  hauptmann: { spine_02: 1.12, Head: 0.92 },
  schaffner: { spine_02: 1.18, Head: 0.9 },
  grenzer: { spine_02: 1.08, Head: 0.92 },
  brandmeister: { spine_02: 1.22, upperarm_l: 1.1, upperarm_r: 1.1, Head: 0.86 },
  rattenmutter: { spine_01: 1.15, spine_03: 1.12, Head: 0.95 },
  spreehexe: { upperarm_l: 0.92, upperarm_r: 0.92, Head: 0.96 },
  // Speaker heads: the skull shrinks into the box mounted on the neck.
  kabel: { spine_02: 0.82, upperarm_l: 1.12, upperarm_r: 1.12, Head: 1.06 },
  bass: { spine_02: 1.18, Head: 0.05 },
  tuersteher: { spine_02: 1.3, upperarm_l: 1.1, upperarm_r: 1.1, Head: 0.74 },
  dirigent: { spine_02: 0.92, Head: 1.02 },
  bassprediger: { spine_02: 1.12, Head: 0.05 },
};

/** Extra stretch of the whole body: x/z, y. */
const BUILD: Partial<Record<EnemyKind, [number, number]>> = {
  runner: [0.86, 1], brute: [1.12, 1], feldwebel: [1.1, 1], waechter: [0.9, 1.1], hauptmann: [1.1, 1],
  grenzer: [1, 1.04], brandmeister: [1.12, 1], rattenmutter: [1.15, 0.85], spreehexe: [0.86, 1.16],
  kabel: [0.78, 1.04], bass: [1.08, 1], tuersteher: [1.16, 1], dirigent: [0.88, 1.08], bassprediger: [1, 1.03],
};
/** Bent forward all the time (the Rattenmutter's hunch, the Kabelghul's crouch). */
const HUNCH: Partial<Record<EnemyKind, number>> = { rattenmutter: 0.2, kabel: 0.28 };
/** Eye glow per kind (zombie rig); bosses default to ember, the rest to the zombie green. */
const EYES: Partial<Record<EnemyKind, number>> = { spitter: 0x97ff5a, kabel: 0xff4fa3, tuersteher: 0xff4fa3, dirigent: 0xff4fa3 };
/** M12c: on neon maps these get pink cables and two lit implant dots (2D `D.cyber`). */
const CYBER: Partial<Record<EnemyKind, true>> = { walker: true, runner: true, brute: true };

// ---------------------------------------------------------------- gear

interface GearKit {
  steel: LitMaterial; brass: LitMaterial; rust: LitMaterial; dark: LitMaterial; red: LitMaterial; blue: LitMaterial; cloth: LitMaterial; bone: LitMaterial; acid: LitMaterial; lamp: LitMaterial;
  olive: LitMaterial; ember: LitMaterial; moss: LitMaterial; punk: LitMaterial; flame: LitMaterial;
  neon: LitMaterial; cyan: LitMaterial; violet: LitMaterial; speaker: LitMaterial; cone: LitMaterial; hazard: LitMaterial; paper: LitMaterial; jacket: LitMaterial; lining: LitMaterial;
}
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
    olive: m.surface({ color: 0x55604a, roughness: 0.9, doubleSided: true }),
    ember: m.surface({ color: 0xb03c1c, roughness: 0.85, doubleSided: true }),
    moss: m.surface({ color: 0x4c4a2c, roughness: 0.95, doubleSided: true }),
    punk: m.surface({ color: 0x7a2ab8, emissive: 0x9a3ae0, emissiveIntensity: 0.6, roughness: 0.6 }),
    // Torch flame: emissive only, no light (the light count stays constant).
    flame: m.surface({ color: 0x5a1a04, emissive: 0xff6a1a, emissiveIntensity: 4, roughness: 0.5 }),
    // M12c Mitte (board palette: magenta #ff4fa3, cyan #43d1cf): lit cables and implants, emissive only (no lights).
    neon: m.surface({ color: 0x5a1034, emissive: 0xff4fa3, emissiveIntensity: 1.8, roughness: 0.5 }),
    cyan: m.surface({ color: 0x0a3a3a, emissive: 0x43d1cf, emissiveIntensity: 2.4, roughness: 0.4 }),
    violet: m.surface({ color: 0x4a3a62, roughness: 0.9, doubleSided: true }),
    speaker: m.surface({ color: 0x1a181e, roughness: 0.55, metalness: 0.2 }),
    cone: m.surface({ color: 0x2e2c34, roughness: 0.4, metalness: 0.5 }),
    hazard: m.surface({ color: 0xc8a020, roughness: 0.7 }),
    paper: m.surface({ color: 0xe4dccb, roughness: 0.9, doubleSided: true }),
    jacket: m.surface({ color: 0x2c3328, roughness: 0.75, doubleSided: true }),
    lining: m.surface({ color: 0xe1792a, roughness: 0.8, doubleSided: true }),
  };
  return kit;
}

/** `pulse`: the speaker rings of this body, its own material so one Boxenkopf can swell alone. */
type Part = [BufferGeometry, keyof GearKit | 'pulse'];
const tf = (g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry => {
  if (rx || ry || rz) g.rotateX(rx).rotateY(ry).rotateZ(rz);
  return g.translate(x, y, z);
};

/** Merges parts per material into a few meshes. */
function assemble(k: GearKit, parts: Part[], castShadow: boolean, pulse?: LitMaterial): Group {
  const by = new Map<keyof GearKit | 'pulse', BufferGeometry[]>();
  for (const [g, m] of parts) {
    const list = by.get(m) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    by.set(m, list);
  }
  const group = new Group();
  for (const [m, list] of by) {
    const mesh = new Mesh(mergeGeometries(list), m === 'pulse' ? pulse ?? k.neon : k[m]);
    // Lit cables and rings cast no shadow (thin, emissive).
    mesh.castShadow = castShadow && m !== 'neon' && m !== 'pulse' && m !== 'cyan';
    group.add(mesh);
  }
  return group;
}

/** A cable through these points (model meters around the mount bone), as a thin tube. */
const cable = (pts: Array<[number, number, number]>, r = 0.014): BufferGeometry =>
  new TubeGeometry(new CatmullRomCurve3(pts.map(([x, y, z]) => new Vector3(x, y, z))), 10, r, 4, false);

/** 2D `D.cyber` (and the Kabelghul): `n` pink cables from the skull base out and down to the shoulder blades (mounted on the neck). */
function cables(n: number, spread: number, r = 0.014): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    out.push([cable([[t * 0.08, 0.07, -0.05], [t * spread * 0.8, 0.02, -0.17], [t * spread * 1.3, -0.13, -0.21], [t * spread * 1.7, -0.32, -0.15]], r), 'neon']);
  }
  return out;
}
/** Board E13 / Potsdamer Platz: thick cables that arch up off the back and plug into the skull, readable from the camera. */
function arches(n: number, r: number): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    out.push([cable([[t * 0.1, 0.07, -0.05], [t * 0.3, 0.22, -0.2], [t * 0.42, 0.12, -0.36], [t * 0.36, -0.12, -0.3], [t * 0.3, -0.32, -0.18]], r), 'neon']);
  }
  return out;
}
/** Two lit implant dots on the temple and the cheek (mounted on the head). */
const implants = (): Part[] => [[tf(new SphereGeometry(0.022, 6, 4), 0.08, 0.06, 0.07), 'neon'], [tf(new SphereGeometry(0.017, 6, 4), 0.09, 0.0, 0.07), 'neon']];

/** A speaker box head (Boxenkopf, Bassprediger), built on the neck: box, two cones with pulsing rings, a cyan eye strip. */
function speakerHead(w: number, h: number, d: number): Part[] {
  const cones: Part[] = [];
  for (const [y, r] of [[h * 0.72, w * 0.26], [h * 0.3, w * 0.33]] as const) {
    cones.push([tf(new CylinderGeometry(r * 0.35, r, 0.06, 14), 0, y, d / 2 + 0.01, Math.PI / 2), 'cone']);
    cones.push([tf(new TorusGeometry(r * 1.02, 0.018, 4, 18), 0, y, d / 2 + 0.03), 'pulse']);
  }
  // Lit edges round the top, so the box reads from the camera on every side.
  const rim = (x: number, z: number, lx: number, lz: number): Part => [tf(new BoxGeometry(lx, 0.025, lz), x, h + 0.02, z), 'pulse'];
  return [
    [tf(new BoxGeometry(w, h, d), 0, h / 2, 0), 'speaker'],
    [tf(new BoxGeometry(w * 1.04, 0.03, d * 1.04), 0, h, 0), 'cone'],
    rim(0, d / 2, w, 0.025), rim(0, -d / 2, w, 0.025), rim(w / 2, 0, 0.025, d), rim(-w / 2, 0, 0.025, d),
    [tf(new BoxGeometry(w * 0.4, 0.025, 0.012), -w * 0.2, h * 0.94, d / 2 + 0.006), 'cyan'],
    ...cones,
  ];
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

function gearFor(kind: EnemyKind | 'cyber', model: Object3D, materials: Materials, castShadow: boolean, pulse?: LitMaterial): Object3D[] {
  const k = gearKit(materials);
  const out: Object3D[] = [];
  const bone = (n: string): Object3D | undefined => model.getObjectByName(n);
  const p = new Vector3();
  /** Builds parts in model space around a bone's rest position and hands them to the bone. */
  const mount = (name: string, parts: Part[], dy = 0, dz = 0): void => {
    const b = bone(name);
    if (!b) return;
    const g = assemble(k, parts, castShadow, pulse);
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
    case 'schaffner':
      // BVG-free conductor of the old S-Bahn: peaked cap with a brass badge, long coat, the signal disc (Kelle).
      mount('Head', [
        [tf(new CylinderGeometry(0.14, 0.13, 0.11, 12), 0, 0.06, 0), 'cloth'],
        [tf(new BoxGeometry(0.2, 0.015, 0.12), 0, 0.005, 0.1), 'cloth'],
        [tf(new BoxGeometry(0.05, 0.035, 0.01), 0, 0.07, 0.14), 'brass'],
      ], 0.12);
      mount('spine_03', tunic('blue', 'rust'), 0.08);
      mount('pelvis', [[tf(new CylinderGeometry(0.22, 0.32, 0.66, 10, 1, true), 0, -0.32, 0), 'blue']]);
      mount('hand_l', [
        [tf(new CylinderGeometry(0.012, 0.012, 0.22, 6), 0, -0.12, 0), 'rust'],
        [tf(new CylinderGeometry(0.09, 0.09, 0.015, 14), 0, -0.26, 0, Math.PI / 2), 'red'],
      ]);
      break;
    case 'grenzer':
      // GDR border guard: peaked cap with a high crown, grey-green tunic, a rifle in the right hand.
      mount('Head', [
        [tf(new CylinderGeometry(0.15, 0.13, 0.1, 12), 0, 0.06, 0), 'olive'],
        [tf(new CylinderGeometry(0.17, 0.15, 0.04, 12).scale(1, 1, 1.08), 0, 0.12, -0.01), 'olive'],
        [tf(new BoxGeometry(0.2, 0.015, 0.1), 0, 0.01, 0.12, 0.2), 'dark'],
        [tf(new TorusGeometry(0.135, 0.012, 4, 14), 0, 0.03, 0, Math.PI / 2), 'red'],
        [tf(new SphereGeometry(0.022, 6, 4), 0, 0.09, 0.14), 'brass'],
      ], 0.12);
      mount('spine_03', [...tunic('olive', 'dark'), [tf(new BoxGeometry(0.42, 0.04, 0.3), 0, -0.36, 0), 'dark']], 0.08);
      mount('hand_r', [
        [tf(new BoxGeometry(0.05, 0.07, 0.62), 0, -0.04, 0.16), 'dark'],
        [tf(new BoxGeometry(0.045, 0.1, 0.2), 0, -0.07, -0.22, -0.2), 'rust'],
        [tf(new BoxGeometry(0.035, 0.13, 0.05), 0, -0.13, 0.12, 0.3), 'dark'],
      ]);
      break;
    case 'brandmeister':
      // Riot fire chief: fire helmet with a brass comb and neck flap, red-orange coat, a burning torch.
      mount('Head', [
        [tf(new SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0), 'dark'],
        [tf(new BoxGeometry(0.03, 0.06, 0.32), 0, 0.15, 0), 'brass'],
        [tf(new CylinderGeometry(0.16, 0.2, 0.12, 12, 1, true, Math.PI * 0.7, Math.PI * 1.6), 0, -0.06, 0), 'dark'],
        [tf(new BoxGeometry(0.2, 0.018, 0.08), 0, 0.005, 0.15, 0.25), 'brass'],
      ], 0.12);
      // The torch rides on his back and burns over the left shoulder: upright in every clip.
      mount('spine_03', [
        ...tunic('ember', 'dark'), [tf(new BoxGeometry(0.44, 0.05, 0.32), 0, -0.36, 0), 'dark'],
        [tf(new CylinderGeometry(0.025, 0.03, 0.95, 6), 0.19, 0.22, -0.2, -0.2, 0, -0.25), 'rust'],
        [tf(new CylinderGeometry(0.055, 0.04, 0.1, 8), 0.31, 0.7, -0.1, -0.2, 0, -0.25), 'dark'],
        [tf(new SphereGeometry(0.08, 8, 6), 0.33, 0.78, -0.08), 'lamp'],
        [tf(new ConeGeometry(0.09, 0.32, 7), 0.37, 0.94, -0.05, -0.2, 0, -0.25), 'flame'],
      ], 0.08);
      mount('pelvis', [[tf(new CylinderGeometry(0.22, 0.3, 0.5, 10, 1, true), 0, -0.25, 0), 'ember']]);
      break;
    case 'rattenmutter':
      // Hunched in a long brown-green coat with a hood; a rat sits on her shoulder.
      mount('Head', [[tf(new SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, -0.01, -0.06), 'moss']], 0.08);
      mount('spine_03', [
        ...tunic('moss', 'rust'),
        [tf(new SphereGeometry(0.05, 6, 5).scale(0.8, 0.7, 1.6), 0.2, 0.1, 0), 'cloth'],
        [tf(new SphereGeometry(0.035, 6, 5), 0.2, 0.12, 0.08), 'cloth'],
      ], 0.08);
      mount('pelvis', [[tf(new CylinderGeometry(0.23, 0.31, 0.72, 10, 1, true), 0, -0.34, 0), 'moss'], [tf(new TorusGeometry(0.24, 0.018, 4, 14), 0, 0.02, 0, Math.PI / 2), 'rust']]);
      break;
    case 'spreehexe':
      // Punk witch of the squats: a purple and green crest, a long black coat, acid glowing in her hand.
      mount('Head', [
        ...[0, 1, 2, 3, 4, 5].map((i): Part => [tf(new ConeGeometry(0.045, 0.3 - Math.abs(i - 2.5) * 0.04, 5).scale(0.5, 1, 1), 0, 0.17, 0.14 - i * 0.055, -0.2 + i * 0.08), i % 2 ? 'acid' : 'punk']),
      ], 0.06);
      mount('spine_03', [...tunic('dark', 'dark'), [tf(new BoxGeometry(0.05, 0.05, 0.05), -0.12, 0.05, 0.19), 'steel'], [tf(new BoxGeometry(0.05, 0.05, 0.05), 0.12, 0.05, 0.19), 'steel']], 0.08);
      mount('pelvis', [[tf(new CylinderGeometry(0.22, 0.36, 0.86, 10, 1, true, Math.PI * 0.55, Math.PI * 1.9), 0, -0.4, 0), 'dark']]);
      mount('hand_l', [[tf(new SphereGeometry(0.1, 10, 8), 0, -0.14, 0), 'acid'], [tf(new TorusGeometry(0.14, 0.008, 4, 14), 0, -0.14, 0, Math.PI / 2), 'acid']]);
      break;
    case 'cyber':
      // Neon maps (2D `D.cyber`): three pink cables and two implant dots on the plain bodies.
      mount('neck_01', cables(3, 0.16));
      mount('Head', implants());
      break;
    case 'kabel':
      // Kabelghul (2D art, board E13): four lit cables from the skull to the back, implants on the temple.
      mount('neck_01', [...arches(4, 0.026), ...cables(2, 0.2, 0.018)]);
      mount('Head', implants());
      break;
    case 'bass':
      // Boxenkopf (2D art, board E14): a speaker for a head, purple rags with a yellow hazard band.
      mount('neck_01', speakerHead(0.42, 0.5, 0.36), 0.02);
      mount('spine_03', [...tunic('violet', 'hazard'), [tf(new BoxGeometry(0.46, 0.05, 0.34), 0, -0.16, 0.01), 'hazard']], 0.08);
      break;
    case 'tuersteher':
      // Kabelbrocken in a bomber jacket with orange lining, dark glasses, the guest list on a clipboard.
      mount('neck_01', [...cables(4, 0.24, 0.02), [tf(new TorusGeometry(0.11, 0.03, 5, 12).scale(1.2, 1, 1.05), 0, -0.04, 0, Math.PI / 2), 'lining']]);
      mount('Head', [...implants(), [tf(new BoxGeometry(0.2, 0.04, 0.05), 0, 0.03, 0.13), 'dark']]);
      // The jacket fits the Brocken chest (spine ×1.3): a wider shell than the uniform tunic.
      mount('spine_03', [
        [tf(new CylinderGeometry(0.24, 0.2, 0.46, 12, 1, true).scale(1.2, 1, 0.9), 0, -0.12, 0.01), 'jacket'],
        [tf(new BoxGeometry(0.03, 0.42, 0.02), 0, -0.12, 0.225), 'lining'],
        [tf(new BoxGeometry(0.5, 0.06, 0.36), 0, -0.34, 0), 'jacket'],
      ], 0.08);
      mount('hand_l', [
        [tf(new BoxGeometry(0.22, 0.3, 0.018), 0, -0.14, 0.05, 0, 0.3), 'rust'],
        [tf(new BoxGeometry(0.19, 0.24, 0.006), 0, -0.15, 0.062, 0, 0.3), 'paper'],
        [tf(new BoxGeometry(0.07, 0.03, 0.03), 0, -0.01, 0.06, 0, 0.3), 'steel'],
      ]);
      break;
    case 'dirigent':
      // Torn tailcoat, white shirt front and bow tie, a rebar baton, a speaker on his back.
      mount('neck_01', [
        ...cables(2, 0.14),
        [tf(new ConeGeometry(0.035, 0.07, 4), -0.035, -0.06, 0.1, 0, 0, Math.PI / 2), 'red'],
        [tf(new ConeGeometry(0.035, 0.07, 4), 0.035, -0.06, 0.1, 0, 0, -Math.PI / 2), 'red'],
      ]);
      mount('spine_03', [
        ...tunic('dark', 'dark'),
        [tf(new BoxGeometry(0.12, 0.3, 0.02), 0, 0.06, 0.2), 'paper'],
        [tf(new BoxGeometry(0.3, 0.36, 0.2), 0, 0.0, -0.26), 'speaker'],
        [tf(new CylinderGeometry(0.04, 0.1, 0.04, 12), 0, 0.0, -0.38, Math.PI / 2), 'cone'],
        [tf(new TorusGeometry(0.1, 0.015, 4, 14), 0, 0.0, -0.4), 'pulse'],
      ], 0.08);
      mount('pelvis', [[tf(new CylinderGeometry(0.21, 0.28, 0.66, 10, 1, true, Math.PI * 0.52, Math.PI * 0.96), 0, -0.3, 0), 'dark']]);
      mount('hand_r', [[tf(new CylinderGeometry(0.012, 0.009, 0.5, 5), 0, -0.04, 0.2, Math.PI / 2 - 0.3), 'rust']]);
      break;
    case 'bassprediger':
      // 2D art: speaker head, five pink cables, cyan eyes; from the bust (X09): preacher's collar, a mixer on the chest.
      mount('neck_01', [...speakerHead(0.46, 0.56, 0.38), ...[0, 1, 2, 3, 4].map((i): Part => [cable([[-0.16 + i * 0.08, 0.3, -0.19], [-0.22 + i * 0.11, 0.18, -0.3], [-0.26 + i * 0.13, -0.05, -0.3], [-0.3 + i * 0.15, -0.3, -0.2]], 0.02), 'neon'])], 0.02);
      mount('spine_03', [
        ...tunic('violet', 'paper'),
        [tf(new BoxGeometry(0.34, 0.2, 0.08), 0, -0.14, 0.22, -0.2), 'speaker'],
        ...[0, 1, 2, 3, 4].map((i): Part => [tf(new BoxGeometry(0.035, 0.04 + (i % 3) * 0.03, 0.01), -0.12 + i * 0.06, -0.11, 0.27, -0.2), i % 2 ? 'cyan' : 'neon']),
      ], 0.08);
      mount('pelvis', [[tf(new CylinderGeometry(0.22, 0.32, 0.78, 10, 1, true, Math.PI * 0.6, Math.PI * 1.8), 0, -0.36, 0), 'violet']]);
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

// ---------------------------------------------------------------- rat

interface Rat { model: Group; body: Group; front: Mesh; back: Mesh; tail: Mesh; mats: LitMaterial[]; eyes: LitMaterial }
/** Shared rat geometry (built once): body with head, ears and snout; a leg pair; the tail. */
let ratGeo: { body: BufferGeometry; skin: BufferGeometry; legs: BufferGeometry; tail: BufferGeometry; eyes: BufferGeometry } | null = null;

/** 2D rat colors: fur #5a4e44, head #6a5e52, pink ears, nose and tail, red eyes. Along +Z, 0.55 m long. */
function buildRat(materials: Materials, castShadow: boolean): Rat {
  const flat = (list: BufferGeometry[]): BufferGeometry => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
  ratGeo ??= {
    body: flat([
      tf(new SphereGeometry(0.1, 8, 6).scale(1, 0.8, 1.9), 0, 0.15, -0.02),
      tf(new SphereGeometry(0.075, 8, 6).scale(1, 0.85, 1.25), 0, 0.17, 0.2),
      tf(new ConeGeometry(0.045, 0.1, 6), 0, 0.15, 0.31, Math.PI / 2),
    ]),
    skin: flat([
      tf(new SphereGeometry(0.035, 6, 4).scale(1, 1, 0.4), 0.05, 0.24, 0.17),
      tf(new SphereGeometry(0.035, 6, 4).scale(1, 1, 0.4), -0.05, 0.24, 0.17),
      tf(new SphereGeometry(0.016, 5, 4), 0, 0.15, 0.36),
    ]),
    legs: flat([tf(new BoxGeometry(0.035, 0.11, 0.04), 0.07, -0.055, 0), tf(new BoxGeometry(0.035, 0.11, 0.04), -0.07, -0.055, 0)]),
    tail: tf(new CylinderGeometry(0.018, 0.006, 0.34, 5), 0, 0, -0.17, Math.PI / 2),
    eyes: flat([tf(new SphereGeometry(0.014, 5, 4), 0.035, 0.2, 0.27), tf(new SphereGeometry(0.014, 5, 4), -0.035, 0.2, 0.27)]),
  };
  const fur = materials.surface({ color: 0x5a4e44, roughness: 0.95 });
  const skin = materials.surface({ color: 0xb07a74, roughness: 0.7 });
  const eyes = materials.surface({ color: 0x401010, emissive: 0xff4030, emissiveIntensity: 2.4 });
  const model = new Group();
  const body = new Group();
  model.add(body);
  const mk = (g: BufferGeometry, m: LitMaterial, parent: Object3D, shadow = castShadow): Mesh => {
    const mesh = new Mesh(g, m);
    mesh.castShadow = shadow;
    parent.add(mesh);
    return mesh;
  };
  mk(ratGeo.body, fur, body);
  mk(ratGeo.skin, skin, body, false);
  mk(ratGeo.eyes, eyes, body, false);
  const front = mk(ratGeo.legs, fur, body, false);
  front.position.set(0, 0.11, 0.12);
  const back = mk(ratGeo.legs, fur, body, false);
  back.position.set(0, 0.11, -0.12);
  const tail = mk(ratGeo.tail, skin, body, false);
  tail.position.set(0, 0.13, -0.19);
  return { model, body, front, back, tail, mats: [fur, skin], eyes };
}

// ---------------------------------------------------------------- drone

interface Drone { model: Group; tilt: Group; rotors: InstancedMesh; hubs: Vector3[]; size: number; light: LitMaterial | null; mats: LitMaterial[]; eyes: LitMaterial }
/** Shared drone geometry (built once): small quadcopter and the Wachdrohne; frame, lit parts, one rotor. */
let droneGeo: { small: BufferGeometry; smallLit: BufferGeometry; big: BufferGeometry; bigLit: BufferGeometry; bigLamp: BufferGeometry; rotor: BufferGeometry } | null = null;
const SMALL_ARM = 0.26, BIG_ARM = 0.95;

/**
 * M12c drones in code. Small: a 0.5 m quadcopter with a magenta lens (Mitte palette). Wachdrohne: a flat
 * octagonal surveillance body 1.9 m across, four rotors, one cyan lens and a searchlight under it.
 * Draws per body: frame, lit parts, rotors (one instanced mesh of four), the boss's lamp: 3, the boss 4.
 */
function buildDrone(materials: Materials, castShadow: boolean, big: boolean): Drone {
  const flat = (list: BufferGeometry[]): BufferGeometry => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
  const arms = (r: number, w: number, h: number, motor: number): BufferGeometry[] => [0, 1, 2, 3].flatMap((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    return [
      tf(new BoxGeometry(w, h, r), Math.sin(a) * r * 0.5, 0, Math.cos(a) * r * 0.5, 0, a),
      tf(new CylinderGeometry(motor, motor, motor * 1.6, 8), Math.sin(a) * r, motor * 0.4, Math.cos(a) * r),
    ];
  });
  droneGeo ??= {
    small: flat([tf(new BoxGeometry(0.2, 0.08, 0.26), 0, 0, 0), tf(new SphereGeometry(0.09, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.03, 0), ...arms(SMALL_ARM, 0.035, 0.025, 0.03)]),
    smallLit: flat([tf(new SphereGeometry(0.04, 8, 6), 0, -0.01, 0.14), tf(new BoxGeometry(0.12, 0.012, 0.012), 0, -0.045, -0.08)]),
    big: flat([
      tf(new CylinderGeometry(0.7, 0.82, 0.2, 8), 0, 0, 0, 0, Math.PI / 8),
      tf(new CylinderGeometry(0.42, 0.55, 0.14, 8), 0, 0.17, 0, 0, Math.PI / 8),
      tf(new BoxGeometry(0.5, 0.12, 0.2), 0, -0.14, 0.45),
      ...arms(BIG_ARM, 0.12, 0.08, 0.09),
    ]),
    bigLit: flat([
      tf(new SphereGeometry(0.13, 10, 8), 0, -0.14, 0.58),
      ...[0, 1, 2, 3].map((i) => tf(new SphereGeometry(0.03, 6, 4), Math.sin(Math.PI / 4 + (i * Math.PI) / 2) * 0.82, 0.02, Math.cos(Math.PI / 4 + (i * Math.PI) / 2) * 0.82)),
    ]),
    bigLamp: flat([tf(new CylinderGeometry(0.2, 0.26, 0.1, 12), 0, -0.15, 0), tf(new TorusGeometry(0.27, 0.025, 4, 16), 0, -0.13, 0, Math.PI / 2)]),
    rotor: flat([new BoxGeometry(1, 0.01, 0.09), new BoxGeometry(0.09, 0.01, 1)]),
  };
  const G = droneGeo;
  const frame = materials.surface({ color: big ? 0x3a3e46 : 0x2a2c32, roughness: 0.45, metalness: 0.6 });
  const eyes = materials.surface({ color: 0x102a2a, emissive: big ? 0x43d1cf : 0xff4fa3, emissiveIntensity: 3 });
  const model = new Group();
  const tilt = new Group();
  model.add(tilt);
  const mk = (g: BufferGeometry, m: LitMaterial, shadow: boolean): Mesh => {
    const mesh = new Mesh(g, m);
    mesh.castShadow = shadow;
    tilt.add(mesh);
    return mesh;
  };
  mk(big ? G.big : G.small, frame, castShadow);
  mk(big ? G.bigLit : G.smallLit, eyes, false);
  let light: LitMaterial | null = null;
  if (big) {
    light = materials.surface({ color: 0x2a3a3a, emissive: 0xd8fff8, emissiveIntensity: 3 });
    mk(G.bigLamp, light, false);
  }
  const arm = big ? BIG_ARM : SMALL_ARM;
  const hubs = [0, 1, 2, 3].map((i) => new Vector3(Math.sin(Math.PI / 4 + (i * Math.PI) / 2) * arm, big ? 0.2 : 0.07, Math.cos(Math.PI / 4 + (i * Math.PI) / 2) * arm));
  const blur = materials.surface({ color: 0x1a1a1e, roughness: 0.6, doubleSided: true });
  const rotors = new InstancedMesh(G.rotor, blur, 4);
  rotors.castShadow = false;
  rotors.frustumCulled = false;
  tilt.add(rotors);
  return { model, tilt, rotors, hubs, size: big ? 0.62 : 0.24, light, mats: [frame, blur], eyes };
}
const rotorM = new Matrix4();
const rotorS = new Vector3();

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
  /** M11c lying guards: time the get-up started (-1 still lying, -2 none). */
  private riseAt = -2;
  private status = 0;
  private time = Math.random() * 10;
  private readonly inner = new Group();
  private readonly anim: Animator | null = null;
  private readonly crow: Crow | null = null;
  private readonly rat: Rat | null = null;
  /** M12c drones, built on first use (one view can carry a small drone or the Wachdrohne). */
  private readonly drones: { small?: Drone; big?: Drone } = {};
  private drone: Drone | null = null;
  /** M12c: pink cables on neon maps (plain bodies), and the speaker rings of this body. */
  private cyber: Object3D[] | null = null;
  private readonly pulse: LitMaterial | null = null;
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
    if (body === 'rat') {
      this.rat = buildRat(materials, castShadow);
      this.inner.add(this.rat.model);
      this.mats.push(...this.rat.mats);
      this.glow.push(this.rat.eyes);
      return;
    }
    if (body === 'drone') return;
    this.pulse = materials.surface({ color: 0x5a1034, emissive: 0xff4fa3, emissiveIntensity: 1.6, roughness: 0.5 });
    const src = body === 'zombie' ? assets.zombie : body === 'raptor' ? assets.raptor : assets.rex;
    // (crow and rat returned above)
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

  /** `neon`: the map's flavor is neon (Mitte), the plain bodies wear cables. */
  assign(e: Enemy, neon = false): void {
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
    if (this.body === 'drone') {
      const big = e.kind === 'wachdrohne';
      const d = (big ? this.drones.big : this.drones.small) ?? buildDrone(this.materials, this.castShadow, big);
      if (big) this.drones.big = d; else this.drones.small = d;
      if (!d.model.parent) this.inner.add(d.model);
      for (const o of [this.drones.small, this.drones.big]) if (o) o.model.visible = o === d;
      this.drone = d;
      this.mats.length = 0;
      this.mats.push(...d.mats);
      this.glow.length = 0;
      this.glow.push(d.eyes);
      for (const m of this.mats) m.emissive.setScalar(0);
      this.inner.position.y = (big ? BOSS.wachdrohne.height : 1.8) / (this.root.scale.y || 1);
    }
    if (this.body === 'zombie' && this.model) {
      // Proportions and gear of this kind; everything else back to plain.
      for (const bone of this.bones.values()) bone.scale.setScalar(1);
      for (const [n, v] of Object.entries(SHAPE[e.kind] ?? {})) this.bones.get(n)?.scale.setScalar(v);
      for (const list of this.gear.values()) for (const g of list) g.visible = false;
      let gear = this.gear.get(e.kind);
      if (!gear) {
        gear = gearFor(e.kind, this.model, this.materials, this.castShadow, this.pulse ?? undefined);
        this.gear.set(e.kind, gear);
      }
      for (const g of gear) g.visible = true;
      // Speaker heads start at rest size.
      for (const g of gear) g.scale.setScalar(g.userData.rest ??= g.scale.x);
      const cyber = neon && !!CYBER[e.kind];
      if (cyber && !this.cyber) this.cyber = gearFor('cyber', this.model, this.materials, this.castShadow);
      for (const g of this.cyber ?? []) g.visible = cyber;
      // Officers carry a saber.
      const armed = e.kind === 'feldwebel' || e.kind === 'hauptmann';
      if (armed && !this.rack) {
        this.rack = new WeaponRack(this.materials);
        this.rack.show('blade', undefined);
        this.model.getObjectByName('hand_r')?.add(this.rack.group);
      }
      if (this.rack) this.rack.group.visible = armed;
      for (const m of this.glow) m.emissive.set(EYES[e.kind] ?? (e.def.boss ? 0xff5a2a : neon ? 0xff4fa3 : 0xd8ff7a));
    }
    this.root.visible = true;
    this.riseAt = -2;
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
    // M11c: hidden guards stay unseen until they wake (doorway, rubble).
    this.root.visible = !(e.sleep && e.pose === 'hidden');
    if (this.body === 'crow') this.poseCrow(e, t);
    else if (this.body === 'rat') this.poseRat(e, t);
    else if (this.body === 'drone') this.poseDrone(e, t);
    else if (this.body === 'zombie') this.poseZombie(e, t);
    else this.poseDino(e, t, DINO[this.body]);
    if (e.state === 'dead') {
      // Sink into the ground before the body is removed.
      const sink = Math.max(0, t - (SPAWN.corpseTime - 0.8)) / 0.8;
      this.root.position.y -= sink * (this.body === 'rex' ? 1.6 : this.body === 'rat' || this.body === 'drone' ? 0.3 : 0.55);
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
    // M11c: playing dead on the ground, then getting up (Death01 backwards) when the hero comes close.
    if (e.pose === 'lying' && e.state !== 'dead') {
      const end = a.duration('Death01');
      if (e.sleep) { this.riseAt = -1; a.pose('Death01', end, 0.01); return; }
      if (this.riseAt === -1) this.riseAt = this.time;
      const k = (this.time - this.riseAt) / RISE_TIME;
      if (this.riseAt >= 0 && k < 1) { a.pose('Death01', DEATH_FROM + (end - DEATH_FROM) * (1 - k), 0.04); return; }
      this.riseAt = -2;
    }
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
          case 'bass':
            // Boxenkopf: rears back while the speaker swells, then thumps forward.
            a.loop('Zombie_Idle_Loop', 0.1);
            pitch = going ? lerp(0.3, 0, g) : -0.25 * w;
            break;
          case 'grab':
            // Caught: arms out, holding on (Zombie_Scratch at the reach).
            if (sp.hit) { a.pose('Zombie_Scratch', GRAB_HOLD, 0.08); pitch = 0.12; break; }
            if (going) a.pose('Shield_Dash', lerp(0, 0.3, g), 0.05);
            else { a.pose('Zombie_Scratch', lerp(0.05, 0.35, w), 0.12); pitch = 0.3 * w; }
            break;
          case 'shove':
            // Coils with the arms spread, then pushes: the arms are out in front when the circle goes off.
            if (going) a.pose('Shield_Dash', lerp(SHOVE_PUSH, 0.3, g), 0.05);
            else if (w < 0.7) a.pose('Zombie_Scratch', lerp(0.05, 0.3, w / 0.7), 0.12);
            else a.pose('Shield_Dash', lerp(0, SHOVE_PUSH, (w - 0.7) / 0.3), 0.04);
            break;
          case 'lunge': case 'charge': case 'pounce': case 'leap':
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
    if (e.state !== 'dead') pitch += HUNCH[this.kind] ?? 0;
    lean.x += (pitch - lean.x) * 0.35;
    // M12c speakers swell while a ring winds up and throb with the bass otherwise.
    if (this.pulse) {
      const sp = e.state === 'special' ? e.sp : null;
      const ring = sp && e.stateT < sp.wind && (sp.kind === 'bass' || sp.kind === 'roar' || sp.kind === 'beat' || sp.kind === 'charge') ? e.stateT / sp.wind : 0;
      const beat = 0.5 + 0.5 * Math.sin(this.time * 8 + this.seed * 6);
      this.pulse.emissiveIntensity = e.state === 'dead' ? 0.3 : 1.1 + 0.6 * beat + 3 * ring;
      if (this.kind === 'bass' || this.kind === 'bassprediger') {
        const head = this.gear.get(this.kind)?.[0];
        if (head) head.scale.setScalar((head.userData.rest as number) * (1 + 0.22 * ring + 0.025 * beat));
      }
    }
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

  /** Scurry: legs swing in pairs at a rate from the walking speed, the body bobs, the tail swishes. */
  private poseRat(e: Enemy, t: number): void {
    const r = this.rat!;
    const m = this.inner;
    const run = e.state === 'chase' && e.speed > 0.2;
    const ph = this.time * (run ? 7 + e.speed * 3.2 : 0) + this.seed * 6;
    let pitch = 0, roll = 0, y = 0, legs = run ? Math.sin(ph) * 0.9 : 0;
    switch (e.state) {
      case 'chase':
        y = run ? Math.abs(Math.sin(ph)) * 0.035 : 0;
        break;
      case 'windup':
        // Rears up on its hind legs, then snaps forward.
        pitch = -0.55 * Math.min(1, t / e.def.windup);
        legs = 0.5;
        break;
      case 'strike':
        pitch = 0.35;
        y = 0.04;
        break;
      case 'recover':
        pitch = 0.35 * (1 - Math.min(1, t / e.def.recovery));
        break;
      case 'stagger':
        roll = Math.sin(t * 30) * 0.4;
        break;
      case 'dead':
        roll = Math.min(Math.PI * 0.55, t * 9);
        legs = 0.7 + Math.sin(this.time * 30) * Math.max(0, 0.4 - t);
        break;
      default:
        break;
    }
    m.position.y += (y - m.position.y) * 0.5;
    m.rotation.x += (pitch - m.rotation.x) * 0.4;
    m.rotation.z += (roll - m.rotation.z) * 0.4;
    r.front.rotation.x = legs;
    r.back.rotation.x = -legs;
    r.tail.rotation.y = Math.sin(this.time * 6 + this.seed * 4) * 0.45;
    r.tail.rotation.x = -0.15 + 0.1 * Math.sin(ph * 0.5);
  }

  /** Hover and bob, tilt into the flight, rotors from time; dazed drones sink to 0.6 m, the Wachdrohne lands. */
  private poseDrone(e: Enemy, t: number): void {
    const d = this.drone;
    if (!d) return;
    const m = this.inner;
    const big = e.kind === 'wachdrohne';
    const W = BOSS.wachdrohne;
    const hover = big ? W.height : 1.8;
    let y = hover + (big ? 0.06 : 0.08) * Math.sin(this.time * (big ? 1.7 : 2.6) + this.seed * 6);
    let pitch = Math.min(0.3, e.speed * (big ? 0.06 : 0.05));
    let roll = 0, spin = 1, lamp = 1, ease = big ? 0.08 : 0.25;
    switch (e.state) {
      case 'chase':
        if (e.rest > 0) {
          // Dazed after a dive: low, wobbling, rotors stuttering.
          y = 0.6 + 0.04 * Math.sin(this.time * 21);
          roll = 0.35 * Math.sin(this.time * 7);
          spin = 0.35;
        }
        if (big && e.open > 0) {
          y = 0.5;
          lamp = 0;
          spin = 0.2;
          pitch = 0;
        }
        break;
      case 'special': {
        const sp = e.sp;
        if (!sp) break;
        const w = Math.min(1, t / sp.wind);
        const g = Math.min(1, Math.max(0, (t - sp.wind) / sp.go));
        if (sp.kind === 'dive') {
          if (t < sp.wind) { y = hover + 0.4 * w; pitch = -0.4; }
          else { y = lerp(hover + 0.4, 0.7, Math.min(1, g * 2.2)); pitch = 0.7 * (1 - g); }
          ease = 0.3;
        } else if (sp.kind === 'land') {
          // Sinks onto the marked circle, the searchlight goes out.
          y = lerp(hover, 0.5, t < sp.wind ? w * w : 1);
          lamp = 1 - w;
          ease = 0.25;
        } else if (sp.kind === 'volley') pitch = 0.28 * w;
        else roll = 0.08 * Math.sin(this.time * 12);
        break;
      }
      case 'stagger':
        roll = Math.sin(t * 20) * 0.45;
        break;
      case 'dead':
        y = Math.max(big ? 0.25 : 0.12, hover - t * t * (big ? 6 : 9));
        roll = Math.min(big ? 0.5 : 2.4, t * 6);
        spin = Math.max(0, 1 - t * 2);
        ease = 1;
        break;
      default:
        break;
    }
    // Heights are world meters; the root carries the body scale.
    y /= this.root.scale.y || 1;
    m.position.y += (y - m.position.y) * ease;
    d.tilt.rotation.x += (pitch - d.tilt.rotation.x) * 0.2;
    d.tilt.rotation.z += (roll - d.tilt.rotation.z) * 0.25;
    if (d.light) d.light.emissiveIntensity += (3 * lamp - d.light.emissiveIntensity) * 0.2;
    const a = this.time * 46 * spin;
    d.hubs.forEach((h, i) => {
      rotorM.makeRotationY(a + i * 0.8 * (i % 2 ? -1 : 1));
      rotorM.scale(rotorS.setScalar(d.size));
      rotorM.setPosition(h);
      d.rotors.setMatrixAt(i, rotorM);
    });
    d.rotors.instanceMatrix.needsUpdate = true;
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
