// Enemy bodies (M12). Five rigs: the CC0 zombie body in dressed variants (proportions by bone
// scale, gear built in code), the raptor and the Rex (Quaternius dinosaurs, repainted in
// tools/build-creatures.mjs), a crow built from a few boxes with a procedural wing beat and (M12b)
// a rat from six small meshes (shared geometry) with a run cycle from sim time.
// M12c (Mitte): Kabelghul, Boxenkopf and four bosses on the zombie rig (cables and speakers in code),
// pink cables on every Schlurfer, Hetzer and Brocken on neon maps, and drones built in code (shared
// geometry, the four rotors one instanced mesh spun from time).
// M15 Alexanderplatz: the Quaternius mechs (Uhrwerkläufer, Großer Uhrwerkläufer) with a clock-face
// shield, the code-built Kernspeier and Koloss, the Weltzeituhr (the landmark's own rig on four legs),
// Wurzler gear and the Brigadeghul's Blaumann (`enemies-alex.ts`, `clock.ts`).
// WP5: bodies match their Kodex busts (Brocken's orange vest, the Kabelghul's cyan cables, the Speier's belly);
// Zünder (dynamite and a lit fuse), Schildträger (riot helmet, shield that drops when the guard opens), Heuler.
// One-shot poses follow sim time, so wind-up, release and hitbox always agree.
import {
  AnimationMixer, BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Quaternion, Shape, Vector2, ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, SphereGeometry, Sphere, TorusGeometry, TubeGeometry, Vector3,
  type AnimationClip, type Object3D, type SkinnedMesh,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOSS, ELITES, SPAWN, THREAT, type BodyKind, type EnemyKind } from '../data/enemies';
import { lerp, lerpAngle } from '../sim/math';
import { DT, type Enemy } from '../sim/types';
import { Animator, type CharacterAssets } from './characters';
import { groundY } from './ground';
import type { LitMaterial, Materials } from './materials';
import { WeaponRack } from './weapons';
import {
  alexKit, assemble as assembleAlex, buildClockLegs, buildKern, buildKoloss, CLOCK_LEG, domeParts, emblemParts, keyParts, reachLeg, shieldParts, tf as tfAlex, zombieAlexGear,
  type ClockLeg, type Kern, type Koloss, type Part as AlexPart,
} from './enemies-alex';
import { clockMats, makeClockRig, type ClockRig } from './clock';
import { CLOCK } from './alex-world';

const FLASH_TIME = 0.1;
const WHITE = new Color(0xffffff);
/** Death01 starts with a long stagger; skip into it. */
const DEATH_FROM = 0.35;
/** Clip time of Zombie_Scratch at which the claw lands. */
const SCRATCH_HIT = 0.55;
const SCRATCH_SWIPE = 0.16;
const WALK_CLIP_SPEED = 1.15;
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
  // WP5 step 3 (Johannes): skin per district. Köpenick 1906 garrison: pale parchment (board, busts X04, X01, X03).
  feldwebel: [0xc2b296],
  waechter: [0xb0a088],
  rex: [0xffffff],
  hauptmann: [0xc9b9a0],
  // Tunnel: grey-yellow under the work lamps. Xhain 1981: pale grey (Grenzer), soot (Brandmeister), sewer grey-pink.
  schaffner: [0xb8b29c],
  rat: [0xffffff],
  grenzer: [0xbab8a8],
  brandmeister: [0xb89480],
  rattenmutter: [0xb0a094],
  spreehexe: [0xc8ccb8],
  // M12c Mitte (board: pale violet-grey skin under neon).
  kabel: [0xc4b8c0, 0xb8aeb8],
  bass: [0xa89ca4],
  drone: [0xffffff],
  tuersteher: [0x9c8e8c],
  wachdrohne: [0xffffff],
  dirigent: [0xb8b0a8],
  bassprediger: [0xa8989c],
  uhrwerk: [0xffffff], wurzler: [0x9aa878, 0xa8a070], kernspeier: [0xffffff],
  wurzelmutter: [0x8e9a6a], uhrwerkgross: [0xffffff], volkskoloss: [0xffffff], weltzeituhr: [0xffffff],
  // WP5 (busts E07, E06, E08): grey-brown ghouls.
  zuender: [0xb8b098, 0xaaa88e], schild: [0xa4aaa0], heuler: [0xbca6a0, 0xb4a0a6],
};
/** Gear and cloth keys: the kinds, plus the Brigadeghul (the walker on Alexanderplatz). */
type GearKey = EnemyKind | 'brigade';

/** Clothing tint per kind (multiplies the painted rags): uniforms for the 1906 garrison. */
const CLOTH: Partial<Record<EnemyKind, number>> = {
  // WP5 step 3 (Johannes): trousers per district. Köpenick 1906: dark Prussian blue (the captain's near black), the
  // Turmwächter olive-brown; tunnel: the conductor's navy.
  spitter: 0x9aa878, brute: 0xb8a898, feldwebel: 0x3a4462, waechter: 0x6a5e44, hauptmann: 0x2e3550, schaffner: 0x2a3248,
  // Xhain 1981: GDR stone grey (Grenzer), sooty turnout trousers (Brandmeister), oxblood rags (Rattenmutter), squat black.
  grenzer: 0x6c7060, brandmeister: 0x4a3e34, rattenmutter: 0x5a2a24, spreehexe: 0x2e2834,
  // M12c Mitte 2089: rags in violet-brown, the Boxenkopf's purple, black for the bouncer and the conductor.
  kabel: 0x6a5260, bass: 0x5a4a78, tuersteher: 0x2a2a30, dirigent: 0x26242a, bassprediger: 0x3e2c48,
  // M15 Alexanderplatz 1989: garden rags, the Brigadeghul's blue Blaumann.
  wurzler: 0x6a5634, wurzelmutter: 0x5a4a2a,
  // WP5: brown rags (Zünder), dark grey under the armour (Schildträger), a faded red shirt (Heuler).
  zuender: 0x6a5a44, schild: 0x4a5058, heuler: 0x9a3a30,
};
const CLOTH_BRIGADE = 0x34528e;
/** WP5: rag tints for normal ghouls without own clothing colour (multiplies the painted rags), one per body. */
const RAGS = [0xffffff, 0xd8b890, 0x8fa4c8, 0xc89880, 0x9cb088, 0xb49cc8, 0xe0d0a0, 0xa07868];

/** Proportions by bone scale; children inherit, so a big chest needs a smaller head to match. */
const SHAPE: Partial<Record<EnemyKind, Record<string, number>>> = {
  runner: { upperarm_l: 1.12, upperarm_r: 1.12, Head: 0.94 },
  brute: { spine_02: 1.32, Head: 0.72 },
  // Bust E03: a bloated belly (the `belly` gear) under a narrow chest and a big head.
  spitter: { spine_01: 1.3, spine_03: 0.8, Head: 1.1 },
  feldwebel: { spine_02: 1.14, Head: 0.9 },
  waechter: { upperarm_l: 1.18, upperarm_r: 1.18, Head: 0.95 },
  hauptmann: { spine_02: 1.12, Head: 0.92 },
  schaffner: { spine_02: 1.18, Head: 0.9 },
  grenzer: { spine_02: 1.08, Head: 0.92 },
  brandmeister: { spine_02: 1.22, upperarm_l: 1.1, upperarm_r: 1.1, Head: 0.86 },
  // WP5 step 3: the rat head replaces the skull (mounted on the neck).
  rattenmutter: { spine_01: 1.15, spine_03: 1.12, Head: 0.05 },
  spreehexe: { upperarm_l: 0.92, upperarm_r: 0.92, Head: 0.96 },
  // Speaker heads: the skull shrinks into the box mounted on the neck.
  kabel: { spine_02: 0.82, upperarm_l: 1.12, upperarm_r: 1.12, Head: 1.06 },
  bass: { spine_02: 1.18, Head: 0.05 },
  tuersteher: { spine_02: 1.3, upperarm_l: 1.1, upperarm_r: 1.1, Head: 0.74 },
  dirigent: { spine_02: 0.92, Head: 1.02 },
  bassprediger: { spine_02: 1.12, Head: 0.05 },
  schild: { spine_02: 1.12, Head: 0.9 }, heuler: { spine_02: 0.9, Head: 1.12 },
  wurzler: { upperarm_l: 1.1, upperarm_r: 1.1, Head: 0.05 }, wurzelmutter: { spine_02: 1.12, upperarm_l: 1.15, upperarm_r: 1.15, Head: 0.05 },
};

/** Extra stretch of the whole body: x/z, y. */
const BUILD: Partial<Record<EnemyKind, [number, number]>> = {
  runner: [0.86, 1], brute: [1.12, 1], spitter: [1.12, 0.97], schild: [1.08, 1], heuler: [0.9, 1.04], feldwebel: [1.1, 1], waechter: [0.9, 1.1], hauptmann: [1.1, 1],
  grenzer: [1, 1.04], brandmeister: [1.12, 1], rattenmutter: [1.15, 0.85], spreehexe: [0.86, 1.16],
  kabel: [0.78, 1.04], bass: [1.08, 1], tuersteher: [1.16, 1], dirigent: [0.88, 1.08], bassprediger: [1, 1.03],
  wurzelmutter: [1.1, 1],
};
/** Bent forward all the time (the Rattenmutter's hunch, the Kabelghul's crouch). */
const HUNCH: Partial<Record<EnemyKind, number>> = { rattenmutter: 0.34, kabel: 0.28, heuler: 0.12 };
/** Eye glow per kind (zombie rig); bosses default to ember, the rest to the zombie green. */
const EYES: Partial<Record<EnemyKind, number>> = { spitter: 0x97ff5a, kabel: 0x43d1cf, tuersteher: 0xff4fa3, dirigent: 0xff4fa3 };
/** M12c: on neon maps these get pink cables and two lit implant dots (2D `D.cyber`). */
const CYBER: Partial<Record<EnemyKind, true>> = { walker: true, runner: true, brute: true };

// ---------------------------------------------------------------- gear

interface GearKit {
  steel: LitMaterial; brass: LitMaterial; rust: LitMaterial; dark: LitMaterial; red: LitMaterial; bone: LitMaterial; acid: LitMaterial; lamp: LitMaterial;
  olive: LitMaterial; punk: LitMaterial; flame: LitMaterial;
  neon: LitMaterial; cyan: LitMaterial; violet: LitMaterial; speaker: LitMaterial; cone: LitMaterial; hazard: LitMaterial; paper: LitMaterial; jacket: LitMaterial; lining: LitMaterial;
  vest: LitMaterial; reflect: LitMaterial; plate: LitMaterial; belly: LitMaterial; flesh: LitMaterial; riot: LitMaterial; visor: LitMaterial; spark: LitMaterial;
  // WP5 step 3 (boss looks): coats per district, the Brandmeister's bands, the Rattenmutter's fur, the Turmwächter's tower.
  garde: LitMaterial; officer: LitMaterial; navy: LitMaterial; turnout: LitMaterial; band: LitMaterial; helmet: LitMaterial;
  hair: LitMaterial; white: LitMaterial; fur: LitMaterial; rags: LitMaterial; pink: LitMaterial; eye: LitMaterial;
  tower: LitMaterial; shaft: LitMaterial; beacon: LitMaterial; fire: LitMaterial;
  /** Shared vertex-coloured materials of the boss gear (`assemble` with `paint`). */
  paint: LitMaterial; metal: LitMaterial;
}
let kit: GearKit | null = null;
function gearKit(m: Materials): GearKit {
  kit ??= {
    steel: m.surface({ color: 0x8a9096, roughness: 0.4, metalness: 0.75 }),
    brass: m.surface({ color: 0xc9a23a, roughness: 0.35, metalness: 0.85 }),
    rust: m.surface({ color: 0x6e4a34, roughness: 0.7, metalness: 0.5 }),
    dark: m.surface({ color: 0x1c1d22, roughness: 0.6, metalness: 0.2 }),
    red: m.surface({ color: 0xa8281e, roughness: 0.9, doubleSided: true }),
    bone: m.surface({ color: 0xd9d2b4, roughness: 0.8 }),
    acid: m.surface({ color: 0x5a7a2a, emissive: 0x97c459, emissiveIntensity: 1.6, roughness: 0.4 }),
    lamp: m.surface({ color: 0x3a2a12, emissive: 0xffb04a, emissiveIntensity: 3, roughness: 0.4 }),
    olive: m.surface({ color: 0x55604a, roughness: 0.9, doubleSided: true }),
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
    // WP5: the Brocken's high-vis vest with its reflective bands (bust E02), the Speier's belly in its skin tone,
    // the Heuler's swollen throat, riot gear, the Zünder's fuse spark (emissive only, no light).
    vest: m.surface({ color: 0xd8641c, roughness: 0.85, doubleSided: true }),
    reflect: m.surface({ color: 0xc8ccbc, emissive: 0x3a3c34, emissiveIntensity: 0.6, roughness: 0.4, doubleSided: true }),
    belly: m.surface({ color: 0x9cb478, roughness: 0.8 }),
    flesh: m.surface({ color: 0xa86a62, roughness: 0.7 }),
    riot: m.surface({ color: 0x3a4248, roughness: 0.55, metalness: 0.4 }),
    plate: m.surface({ color: 0x8c8472, roughness: 0.6, metalness: 0.25 }),
    visor: m.surface({ color: 0x6a7a80, roughness: 0.15, metalness: 0.6, doubleSided: true }),
    spark: m.surface({ color: 0x5a2a04, emissive: 0xffc04a, emissiveIntensity: 4, roughness: 0.5 }),
    // Köpenick 1906: Prussian blue greatcoats (the captain's darker), red collars and capes; tunnel: the conductor's navy.
    garde: m.surface({ color: 0x34477a, roughness: 0.85, doubleSided: true }),
    officer: m.surface({ color: 0x28355e, roughness: 0.8, doubleSided: true }),
    navy: m.surface({ color: 0x232c44, roughness: 0.85, doubleSided: true }),
    // Xhain 1981: a sooty turnout coat with yellow reflective bands, a leather fire helmet.
    turnout: m.surface({ color: 0x3c3229, roughness: 0.9, doubleSided: true }),
    band: m.surface({ color: 0xe0b428, emissive: 0x4a3a08, emissiveIntensity: 0.7, roughness: 0.45, doubleSided: true }),
    helmet: m.surface({ color: 0x6a4224, roughness: 0.55, metalness: 0.15, doubleSided: true }),
    hair: m.surface({ color: 0x4a4038, roughness: 0.9 }),
    white: m.surface({ color: 0xdcd8cc, roughness: 0.9 }),
    fur: m.surface({ color: 0x6e604e, roughness: 1, doubleSided: true }),
    rags: m.surface({ color: 0x6a2e26, roughness: 0.95, doubleSided: true }),
    pink: m.surface({ color: 0xc08478, roughness: 0.7 }),
    eye: m.surface({ color: 0x401010, emissive: 0xff4030, emissiveIntensity: 2.6, roughness: 0.4 }),
    // The Turmwächter: the Fernsehturm's steel sphere and its ribbed concrete shaft; the red beacon on the antenna.
    tower: m.surface({ color: 0x8c8474, roughness: 0.4, metalness: 0.6 }),
    shaft: m.surface({ color: 0x74685a, roughness: 0.85, doubleSided: true }),
    beacon: m.surface({ color: 0x401008, emissive: 0xff3a1a, emissiveIntensity: 3, roughness: 0.4 }),
    // The Brandmeister's helmet fire: orange outer flames (less intense than the torch so they stay orange), yellow cores.
    fire: m.surface({ color: 0x6a1a04, emissive: 0xff4a0a, emissiveIntensity: 1.9, roughness: 0.5 }),
    paint: m.surface({ color: 0xffffff, roughness: 0.85, vertexColors: true, doubleSided: true }),
    metal: m.surface({ color: 0xffffff, roughness: 0.4, metalness: 0.8, vertexColors: true }),
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
function assemble(k: GearKit, parts: Part[], castShadow: boolean, pulse?: LitMaterial, paint = false): Group {
  const by = new Map<keyof GearKit | 'pulse', BufferGeometry[]>();
  // WP5 step 3 (`paint`): the boss coats would cost one draw per material per bone. Unlit materials share one
  // vertex-coloured mesh per bone; metal keeps its shine only where it is a large part of the bone's gear.
  const family = (m: keyof GearKit | 'pulse'): keyof GearKit | 'pulse' => {
    if (!paint || m === 'pulse') return m;
    const mat = k[m];
    const glow = mat.emissiveIntensity * Math.max(mat.emissive.r, mat.emissive.g, mat.emissive.b);
    if (glow > 0.3) return m;
    return mat.metalness >= 0.6 ? 'metal' : 'paint';
  };
  const tris = new Map<string, number>();
  if (paint) for (const [g, m] of parts) { const f = family(m); tris.set(f, (tris.get(f) ?? 0) + (g.index?.count ?? g.attributes.position!.count)); }
  const total = [...tris.values()].reduce((a, b) => a + b, 0);
  for (const [g, m] of parts) {
    let f = family(m);
    if (f === 'metal' && (tris.get('metal') ?? 0) < total * 0.3) f = 'paint';
    const flat = g.index ? g.toNonIndexed() : g;
    if (f === 'paint' || f === 'metal') {
      const c = k[m as keyof GearKit].color, n = flat.attributes.position!.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      flat.setAttribute('color', new Float32BufferAttribute(col, 3));
    }
    const list = by.get(f) ?? [];
    list.push(flat);
    by.set(f, list);
  }
  const group = new Group();
  for (const [m, list] of by) {
    const mesh = new Mesh(mergeGeometries(list), m === 'pulse' ? pulse ?? k.neon : k[m]);
    // Lit cables and rings cast no shadow (thin, emissive).
    mesh.castShadow = castShadow && m !== 'neon' && m !== 'pulse' && m !== 'cyan' && m !== 'fire' && m !== 'flame';
    group.add(mesh);
  }
  return group;
}

/** A cable through these points (model meters around the mount bone), as a thin tube. */
const cable = (pts: Array<[number, number, number]>, r = 0.014): BufferGeometry =>
  new TubeGeometry(new CatmullRomCurve3(pts.map(([x, y, z]) => new Vector3(x, y, z))), 10, r, 4, false);

/** 2D `D.cyber` (and the Kabelghul): `n` lit cables from the skull base out and down to the shoulder blades (mounted on the neck). Pink; cyan on the Kabelghul (bust E13). */
function cables(n: number, spread: number, r = 0.014, lit: 'neon' | 'cyan' = 'neon'): Part[] {
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    out.push([cable([[t * 0.08, 0.07, -0.05], [t * spread * 0.8, 0.02, -0.17], [t * spread * 1.3, -0.13, -0.21], [t * spread * 1.7, -0.32, -0.15]], r), lit]);
  }
  return out;
}
/** A dark plug sleeve with a lit ring where a cable meets the body, aligned with the curve at `t` (0 or 1). */
function plug(curve: CatmullRomCurve3, t: number, lit: 'neon' | 'cyan'): Part[] {
  const at = curve.getPoint(t), dir = curve.getTangent(t);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  const place = (g: BufferGeometry, k: number): BufferGeometry => g.applyQuaternion(q).translate(at.x + dir.x * k, at.y + dir.y * k, at.z + dir.z * k);
  const into = t === 0 ? 1 : -1;
  return [
    [place(new CylinderGeometry(0.022, 0.026, 0.05, 10), into * 0.018), 'dark'],
    [place(new TorusGeometry(0.022, 0.006, 4, 12).rotateX(Math.PI / 2), into * 0.045), lit],
  ];
}
/**
 * WP5 Kabelghul (bust E13): five smooth cables that loop up off the skull and plug into the shoulder blades,
 * each with a sleeve at both ends; the loops differ in height so they read as a tangle, not a comb.
 */
function kabelLoops(lit: 'neon' | 'cyan'): Part[] {
  const out: Part[] = [];
  const loops: Array<[number, number, number]> = [[-0.1, 0.11, 0.9], [-0.05, 0.17, 1.05], [0.005, 0.14, 1], [0.055, 0.18, 1.1], [0.1, 0.1, 0.85]];
  for (const [x, h, w] of loops) {
    const c = new CatmullRomCurve3([[x * 0.5, 0.1, -0.06], [x * 1.2, 0.1 + h * 0.7, -0.12], [x * 1.8, 0.1 + h, -0.2 * w], [x * 2.1, 0.04 + h * 0.4, -0.27 * w], [x * 1.9, -0.08, -0.23], [x * 1.6, -0.17, -0.13]].map(([a, b, d]) => new Vector3(a, b, d)));
    out.push([new TubeGeometry(c, 28, 0.014, 7, false), lit], ...plug(c, 0, lit), ...plug(c, 1, lit));
  }
  return out;
}
/** Two lit implant dots on the temple and the cheek (mounted on the head). */
const implants = (lit: 'neon' | 'cyan' = 'neon'): Part[] => [[tf(new SphereGeometry(0.022, 6, 4), 0.08, 0.06, 0.07), lit], [tf(new SphereGeometry(0.017, 6, 4), 0.09, 0.0, 0.07), lit]];

/** Brocken vest profile (radius, height) from the waist to the shoulders, around spine_03. */
const VEST: Array<[number, number]> = [[0.2, -0.34], [0.226, -0.24], [0.255, -0.12], [0.268, -0.02], [0.262, 0.06], [0.22, 0.13]];
/** A lathed shell along `profile`, open by `gap` at the front, `grow` pushes it out (bands over the vest). */
function vestShell(profile: Array<[number, number]>, gap: number, grow = 1): BufferGeometry {
  const pts = profile.map(([r, y]) => new Vector2(r * grow, y));
  return new LatheGeometry(pts, 24, gap / 2, Math.PI * 2 - gap).scale(1.2, 1, 0.98).translate(0, 0, 0.02);
}


// ---------------------------------------------------------------- WP5 step 3: clothes fitted to the body

/**
 * One cross-section of a fitted shell in model space: centre, the side axis `u`, the front axis `w` (+z in
 * an upright body) and the two radii. Angle 0 on a ring is the front, positive towards +u.
 */
interface Ring { c: Vector3; u: Vector3; w: Vector3; ru: number; rw: number }

/**
 * The zombie body in the pose it holds while gear is built (the first idle frame, `inIdle`), in model space,
 * with the bone that moves each vertex most. Clothes are fitted to it, so a coat follows this kind's
 * proportions (SHAPE) instead of being a cylinder at a guessed place.
 */
class BodyFit {
  readonly pts: Vector3[] = [];
  readonly bone: string[] = [];
  /** Centre between the eyes: faces (moustaches, snouts) are placed from it; the face looks down in idle. */
  readonly eyes = new Vector3();
  constructor(private readonly model: Object3D) {
    let mesh: SkinnedMesh | undefined, eyes: SkinnedMesh | undefined;
    model.traverse((o) => {
      if (!(o as SkinnedMesh).isSkinnedMesh) return;
      if (o.name === 'Eyes') eyes = o as SkinnedMesh; else mesh ??= o as SkinnedMesh;
    });
    const toModel = new Matrix4();
    if (eyes) {
      toModel.copy(model.matrixWorld).invert().multiply(eyes.matrixWorld);
      const n = eyes.geometry.attributes.position!.count, v = new Vector3();
      for (let i = 0; i < n; i++) this.eyes.add(eyes.getVertexPosition(i, v).applyMatrix4(toModel));
      this.eyes.multiplyScalar(1 / Math.max(1, n));
    }
    if (!mesh) return;
    const g = mesh.geometry, si = g.attributes.skinIndex!, sw = g.attributes.skinWeight!;
    toModel.copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
    for (let i = 0; i < g.attributes.position!.count; i++) {
      let best = 0, bw = -1;
      for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
      this.bone.push(mesh.skeleton.bones[best]?.name ?? '');
      this.pts.push(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(toModel));
    }
  }
  /** A bone's position in model space. */
  at(name: string): Vector3 {
    const v = new Vector3();
    this.model.getObjectByName(name)?.getWorldPosition(v);
    return this.model.worldToLocal(v);
  }
  /** Bounding box centre and size of the vertices of these bones. */
  box(bones: string[]): { c: Vector3; min: Vector3; max: Vector3 } {
    const set = new Set(bones), min = new Vector3(9, 9, 9), max = new Vector3(-9, -9, -9);
    this.pts.forEach((p, i) => { if (set.has(this.bone[i]!)) { min.min(p); max.max(p); } });
    return { c: min.clone().add(max).multiplyScalar(0.5), min, max };
  }
  /**
   * `n + 1` rings along `from` → `to` (t 0..1, here `t0`..`t1`) round the vertices of `bones`: each ring is the
   * smallest axis-aligned ellipse round the box of its slice that holds every vertex, plus `pad`.
   */
  rings(bones: string[], from: Vector3, to: Vector3, n: number, t0 = 0, t1 = 1, pad = 0.03): Ring[] {
    const set = new Set(bones);
    const axis = to.clone().sub(from);
    const len = axis.length();
    axis.normalize();
    const u = new Vector3(1, 0, 0).addScaledVector(axis, -axis.x).normalize();
    const w = new Vector3().crossVectors(u, axis);
    const bins: Array<Array<[number, number]>> = Array.from({ length: n }, () => []);
    const d = new Vector3();
    this.pts.forEach((p, i) => {
      if (!set.has(this.bone[i]!)) return;
      d.copy(p).sub(from);
      const t = d.dot(axis) / len;
      if (t < t0 || t > t1) return;
      bins[Math.min(n - 1, Math.floor(((t - t0) / (t1 - t0)) * n))]!.push([d.dot(u), d.dot(w)]);
    });
    const out: Ring[] = [];
    for (let k = 0; k <= n; k++) {
      const slice = [...(bins[k - 1] ?? []), ...(bins[k] ?? [])];
      const t = t0 + ((t1 - t0) * k) / n;
      let a = 9, b = -9, c = 9, e = -9;
      for (const [x, y] of slice) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); e = Math.max(e, y); }
      if (!slice.length) { a = c = -0.05; b = e = 0.05; }
      const cu = (a + b) / 2, cw = (c + e) / 2;
      let hu = Math.max(0.03, (b - a) / 2), hw = Math.max(0.03, (e - c) / 2);
      let s = 0;
      for (const [x, y] of slice) s = Math.max(s, Math.hypot((x - cu) / hu, (y - cw) / hw));
      if (s > 1) { hu *= s; hw *= s; }
      out.push({ c: from.clone().addScaledVector(axis, t * len).addScaledVector(u, cu).addScaledVector(w, cw), u: u.clone(), w: w.clone(), ru: hu + pad, rw: hw + pad });
    }
    // Smooth the radii a little (never below the fit), so the shell has no dents between slices.
    for (let k = 1; k < out.length - 1; k++) {
      const r = out[k]!, p = out[k - 1]!, q = out[k + 1]!;
      r.ru = Math.max(r.ru, (p.ru + q.ru) / 2 - 0.005);
      r.rw = Math.max(r.rw, (p.rw + q.rw) / 2 - 0.005);
    }
    return out;
  }
}

/** A ring between `a` and `b` (`k` 0..1), or along a ring list at fractional index `f`. */
function ringLerp(a: Ring, b: Ring, k: number): Ring {
  return { c: a.c.clone().lerp(b.c, k), u: a.u.clone().lerp(b.u, k).normalize(), w: a.w.clone().lerp(b.w, k).normalize(), ru: lerp(a.ru, b.ru, k), rw: lerp(a.rw, b.rw, k) };
}
function ringAt(rings: Ring[], f: number): Ring {
  const i = Math.max(0, Math.min(rings.length - 2, Math.floor(f)));
  return ringLerp(rings[i]!, rings[i + 1]!, Math.max(0, Math.min(1, f - i)));
}
/** The same ring grown by `k` and `dr`, moved by (dx, dy, dz) in model space. */
function ringGrow(r: Ring, k: number, dr = 0, dx = 0, dy = 0, dz = 0): Ring {
  return { c: r.c.clone().add(new Vector3(dx, dy, dz)), u: r.u.clone(), w: r.w.clone(), ru: r.ru * k + dr, rw: r.rw * k + dr };
}
/** A level ring (model axes) under `r`: `dy` down, `dz` forward, with its own radii (a coat skirt). */
function ringDrop(r: Ring, dy: number, dz: number, ru: number, rw: number, dx = 0): Ring {
  return { c: r.c.clone().add(new Vector3(dx, -dy, dz)), u: new Vector3(1, 0, 0), w: new Vector3(0, 0, 1), ru, rw };
}
/** A point on a ring at angle `a` (0 = front), pushed out by `out`. */
function ringPoint(r: Ring, a: number, out = 0): Vector3 {
  return r.c.clone().addScaledVector(r.u, (r.ru + out) * Math.sin(a)).addScaledVector(r.w, (r.rw + out) * Math.cos(a));
}

/** Builds an indexed grid of `rows` × (`cols` + 1) vertices, faces turned outwards (away from `centre` of row 0), so one-sided materials show. */
function grid(pos: number[], uv: number[], rows: number, cols: number, centre: Vector3): BufferGeometry {
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const v = (k: number): Vector3 => new Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const [a, b, c] = [v(idx[0]!), v(idx[1]!), v(idx[2]!)];
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  if (n.dot(a.clone().sub(centre)) < 0) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2]!, idx[k + 1]!];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A surface through `rings`, open by `gap` (radians, centred on the front; a number per ring for a coat that
 * opens below the waist), relative to `origin` (the bone it is mounted on). `jag`: the last ring's edge is
 * torn into points that hang this far (fur, rags).
 */
function shell(rings: Ring[], origin: Vector3, gap: number | number[] = 0, seg = 20, jag = 0): BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  rings.forEach((r, i) => {
    const g = typeof gap === 'number' ? gap : gap[i] ?? 0;
    for (let j = 0; j <= seg; j++) {
      const a = g / 2 + (j / seg) * (Math.PI * 2 - g);
      const p = ringPoint(r, a).sub(origin);
      if (jag && i === rings.length - 1) p.y -= (j % 2) * jag * (0.6 + 0.4 * Math.sin(j * 2.3));
      pos.push(p.x, p.y, p.z);
      uv.push(j / seg, i / Math.max(1, rings.length - 1));
    }
  });
  return grid(pos, uv, rings.length, seg, rings[0]!.c.clone().sub(origin));
}
/** A strip over `rings` from angle `a0` (first ring) to `a1` (last ring), `half` radians wide, `out` above the shell: sashes, trims, bands. */
function strip(rings: Ring[], origin: Vector3, a0: number, a1: number, half: number, out = 0.012, seg = 4): BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  rings.forEach((r, i) => {
    const m = rings.length > 1 ? i / (rings.length - 1) : 0;
    const a = lerp(a0, a1, m);
    for (let j = 0; j <= seg; j++) {
      const p = ringPoint(r, a - half + (2 * half * j) / seg, out).sub(origin);
      pos.push(p.x, p.y, p.z);
      uv.push(j / seg, m);
    }
  });
  return grid(pos, uv, rings.length, seg, rings[0]!.c.clone().sub(origin));
}
/** A band round the shell between fractional ring indices `f0` and `f1` (reflective bands, cuffs, belts). */
const band = (rings: Ring[], origin: Vector3, f0: number, f1: number, out = 0.012, gap = 0): BufferGeometry =>
  shell([ringGrow(ringAt(rings, f0), 1, out), ringGrow(ringAt(rings, f1), 1, out)], origin, gap);
/** `g` placed on the shell at fractional ring `f`, angle `a`, facing out (+z of `g` along the surface normal). */
function onShell(g: BufferGeometry, rings: Ring[], origin: Vector3, f: number, a: number, out = 0.008): BufferGeometry {
  const r = ringAt(rings, f);
  const p = ringPoint(r, a, out).sub(origin);
  const n = r.u.clone().multiplyScalar(Math.sin(a) / r.ru).addScaledVector(r.w, Math.cos(a) / r.rw).normalize();
  return g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n)).translate(p.x, p.y, p.z);
}

/** How a fitted coat is cut. Heights are model meters (the zombie's knee is near 0.45, its calf near 0.3). */
interface CoatCut {
  mat: keyof GearKit;
  /** Bulk over the chest and belly. */
  pad?: number;
  /** Hem height of the skirt (none: the coat ends at the waist), its extra width there and the front opening at the hem. */
  hem?: number; flare?: number; open?: number;
  /** Sleeves: to the wrist, to the elbow or none. */
  sleeves?: 'full' | 'upper' | 'none';
  /** A stand collar in this material. */
  collar?: keyof GearKit;
  /** Torn hems (fur, rags). */
  jag?: number;
}
/** The rings of a fitted coat per part, and the parts to mount per bone (callers add buttons, bands and trims). */
interface Coat {
  chest: Ring[]; belly: Ring[]; skirt: Ring[]; arm: Record<'upperarm_l' | 'upperarm_r' | 'lowerarm_l' | 'lowerarm_r', Ring[]>; collar: Ring[];
  /** Mount bone → its position (shell origin) and parts. */
  parts: Map<string, Part[]>;
  o(bone: string): Vector3;
  add(bone: string, ...parts: Part[]): void;
}
/**
 * WP5 step 3: a coat that follows this body (Johannes: the Brandmeister's clothes clipped through his body).
 * Chest on spine_03, belly on spine_01 (overlapping, so the waist bends without a gap), the skirt on the pelvis
 * hanging straight down and opening towards the front so the bent knees come out through it, sleeves on the
 * arm bones, a stand collar on the chest.
 */
function fitCoat(fit: BodyFit, cut: CoatCut): Coat {
  const pad = cut.pad ?? 0.03;
  const parts = new Map<string, Part[]>();
  const origins = new Map<string, Vector3>();
  const o = (bone: string): Vector3 => { let v = origins.get(bone); if (!v) { v = fit.at(bone); origins.set(bone, v); } return v; };
  const add = (bone: string, ...p: Part[]): void => { const list = parts.get(bone) ?? []; list.push(...p); parts.set(bone, list); };
  const chest = fit.rings(['spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'], o('spine_02'), o('neck_01'), 6, -0.35, 0.95, pad);
  const belly = fit.rings(['pelvis', 'spine_01', 'spine_02'], o('pelvis'), o('spine_02'), 5, -0.25, 1.3, pad - 0.004);
  const collar = fit.rings(['neck_01'], o('neck_01'), o('Head'), 2, -0.2, 0.55, 0.025);
  // Close the chest over the shoulders onto the neck (no open ring round the neck).
  const last = chest[chest.length - 1]!;
  chest.push(ringLerp(ringGrow(last, 0.82, 0, 0, 0.02, 0), ringGrow(collar[0]!, 1.15), 0.5), ringGrow(collar[0]!, 1.12));
  add('spine_03', [shell(chest, o('spine_03')), cut.mat]);
  add('spine_01', [shell(belly, o('spine_01')), cut.mat]);
  if (cut.collar) add('spine_03', [shell([ringGrow(collar[0]!, 1.1), ringGrow(collar[1]!, 1.08), ringGrow(collar[2]!, 1.1, 0.005)], o('spine_03'), 0.5), cut.collar]);
  let skirt: Ring[] = [];
  if (cut.hem !== undefined) {
    const top = ringGrow(belly[0]!, 1, 0.01);
    const drop = top.c.y - cut.hem, flare = cut.flare ?? 0.12, open = cut.open ?? 1.6;
    const n = 5;
    skirt = [top];
    const gaps = [0.2];
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      skirt.push(ringDrop(top, drop * k, -0.04 * k, top.ru + flare * Math.sqrt(k), top.rw + flare * 0.9 * Math.sqrt(k)));
      gaps.push(lerp(0.2, open, Math.sqrt(k)));
    }
    add('pelvis', [shell(skirt, o('pelvis'), gaps, 20, cut.jag ?? 0), cut.mat]);
  }
  const arm = {} as Coat['arm'];
  for (const sd of ['l', 'r'] as const) {
    const up = `upperarm_${sd}` as const, lo = `lowerarm_${sd}` as const;
    arm[up] = fit.rings([up], o(up), o(lo), 3, -0.14, 1.06, 0.018);
    arm[lo] = fit.rings([lo], o(lo), o(`hand_${sd}`), 3, -0.06, 0.92, 0.022);
    if (cut.sleeves !== 'none') add(up, [shell(arm[up], o(up), 0, 14), cut.mat]);
    if (cut.sleeves === 'full' || cut.sleeves === undefined) add(lo, [shell(arm[lo].map((r, i) => (i === arm[lo].length - 1 ? ringGrow(r, 1.12) : r)), o(lo), 0, 14), cut.mat]);
  }
  return { chest, belly, skirt, arm, collar, parts, o, add };
}

/** The Prussian eagle (Pickelhaube plate, `w` wide), extruded thin, facing +z. */
function eagle(w: number): BufferGeometry {
  const right: Array<[number, number]> = [[0, 1], [0.14, 0.9], [0.22, 0.95], [0.16, 0.72], [0.4, 0.78], [0.66, 1], [1, 0.86], [0.86, 0.6], [0.98, 0.44], [0.76, 0.3], [0.86, 0.08], [0.5, 0.06], [0.24, 0.16], [0.24, -0.32], [0.46, -0.6], [0.28, -0.62], [0.16, -0.46], [0.14, -0.78], [0, -1]];
  const pts = [...right, ...right.slice(1, -1).reverse().map(([x, y]): [number, number] => [-x, y])];
  const s = new Shape(pts.map(([x, y]) => new Vector2(x * w * 0.5, y * w * 0.45)));
  return new ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 2 });
}
/** A moustache under the nose at `nose` (head mount space): two tubes, upturned (`up` > 0) or drooping. */
function moustache(nose: Vector3, w: number, up: number, r: number, mat: keyof GearKit): Part[] {
  const at = (x: number, y: number, z: number): [number, number, number] => [nose.x + x, nose.y + y, nose.z + z];
  return [-1, 1].map((s): Part => [cable([at(0, 0, 0.004), at(s * w * 0.35, -0.012, -0.004), at(s * w * 0.75, -0.012 + up * 0.4, -0.02), at(s * w, up, -0.04)], r), mat]);
}

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

/** Pickelhaube: dome, brim, peak, spike and the gold eagle plate. Built around the origin at the brow line. */
function pickelhaube(): Part[] {
  const shell: keyof GearKit = 'dark';
  return [
    [tf(new SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.05, 1.1), 0, 0, 0), shell],
    [tf(new CylinderGeometry(0.142, 0.15, 0.03, 16).scale(1, 1, 1.1), 0, 0.005, 0), shell],
    [tf(new CylinderGeometry(0.11, 0.12, 0.012, 12, 1, false, -0.9, 1.8).scale(1, 1, 1.25), 0, -0.012, 0.03, 0.22), shell],
    [tf(new CylinderGeometry(0.1, 0.11, 0.012, 12, 1, false, Math.PI - 1, 2).scale(1.1, 1, 1.2), 0, -0.004, -0.03, -0.25), shell],
    [tf(new ConeGeometry(0.024, 0.15, 8), 0, 0.235, 0), 'brass'],
    [tf(new CylinderGeometry(0.038, 0.045, 0.035, 10), 0, 0.152, 0), 'brass'],
    [tf(new CylinderGeometry(0.06, 0.06, 0.01, 10), 0, 0.136, 0), 'brass'],
    [tf(eagle(0.13), 0, 0.075, 0.145, -0.42), 'brass'],
    [tf(new TorusGeometry(0.146, 0.008, 4, 18).scale(1, 1.1, 1), 0, 0.02, 0, Math.PI / 2), 'brass'],
  ];
}

/**
 * WP5 Schildträger riot shield, `w` × `h` m, hanging from its top edge (origin): a rounded plate with a bevel,
 * a rim tube round it, a viewing window in the top third, rivets along the rim and two scratches.
 */
function riotShield(w: number, h: number): Part[] {
  const r = 0.07, hw = w / 2;
  const outline = new Shape();
  outline.moveTo(-hw + r, 0);
  outline.lineTo(hw - r, 0);
  outline.quadraticCurveTo(hw, 0, hw, -r);
  outline.lineTo(hw, -h + r);
  outline.quadraticCurveTo(hw, -h, hw - r, -h);
  outline.lineTo(-hw + r, -h);
  outline.quadraticCurveTo(-hw, -h, -hw, -h + r);
  outline.lineTo(-hw, -r);
  outline.quadraticCurveTo(-hw, 0, -hw + r, 0);
  const plate = new ExtrudeGeometry(outline, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 2, curveSegments: 6 });
  plate.translate(0, 0, -0.01).rotateX(0.06);
  const rimPts = outline.getSpacedPoints(48).map((q) => new Vector3(q.x, q.y, 0.02));
  const rim = new TubeGeometry(new CatmullRomCurve3(rimPts, true), 96, 0.012, 6, true).rotateX(0.06);
  const window: Part = [tf(new BoxGeometry(w * 0.62, 0.1, 0.01), 0, -h * 0.22, 0.024, 0.06), 'visor'];
  const rivets: Part[] = [];
  for (const q of outline.getSpacedPoints(18).slice(0, 18)) rivets.push([tf(new SphereGeometry(0.009, 6, 4), q.x * 0.9, q.y * 0.94 - h * 0.03, 0.028, 0.06), 'steel']);
  const scratches: Part[] = [
    [tf(new BoxGeometry(0.2, 0.008, 0.004), 0.06, -h * 0.55, 0.026, 0.06, 0, 0.5), 'dark'],
    [tf(new BoxGeometry(0.14, 0.006, 0.004), -0.1, -h * 0.7, 0.026, 0.06, 0, -0.3), 'dark'],
  ];
  return [[plate, 'plate'], [rim, 'riot'], window, ...rivets, ...scratches];
}

/** Uniform tunic: a shell around the chest, collar, buttons. */
function tunic(coat: keyof GearKit, trim: keyof GearKit): Part[] {
  return [
    [tf(new CylinderGeometry(0.2, 0.165, 0.46, 10, 1, true).scale(1.22, 1, 0.92), 0, -0.13, 0.01), coat],
    [tf(new TorusGeometry(0.1, 0.028, 5, 12).scale(1.15, 1, 1), 0, 0.11, 0, Math.PI / 2), trim],
    ...[0, 1, 2, 3].map((i): Part => [tf(new SphereGeometry(0.018, 6, 4), 0, 0.04 - i * 0.1, 0.19 - i * 0.004), 'brass']),
  ];
}

/** A bone's rotation in model space from the local rotations (valid right after a mixer update, before matrices). */
function modelQuat(b: Object3D, model: Object3D, out: Quaternion): Quaternion {
  out.identity();
  for (let o: Object3D | null = b; o && o !== model; o = o.parent) out.premultiply(o.quaternion);
  return out;
}
const qa = new Quaternion(), qb = new Quaternion(), qc = new Quaternion();

function gearFor(kind: GearKey | 'cyber', model: Object3D, materials: Materials, castShadow: boolean, pulse?: LitMaterial): Object3D[] {
  const k = gearKit(materials);
  const out: Object3D[] = [];
  const bone = (n: string): Object3D | undefined => model.getObjectByName(n);
  const p = new Vector3();
  /** Builds parts in model space around a bone's rest position and hands them to the bone. */
  /** WP5 step 3: the six bosses with fitted coats paint their unlit gear into one mesh per bone. */
  const paint = kind === 'feldwebel' || kind === 'hauptmann' || kind === 'schaffner' || kind === 'brandmeister' || kind === 'rattenmutter' || kind === 'waechter';
  const mount = (name: string, parts: Part[], dy = 0, dz = 0, dx = 0): Object3D | undefined => {
    const b = bone(name);
    if (!b) return undefined;
    const g = assemble(k, parts, castShadow, pulse, paint);
    b.getWorldPosition(p);
    model.worldToLocal(p);
    g.position.set(p.x + dx, p.y + dy, p.z + dz);
    model.add(g);
    b.attach(g);
    out.push(g);
    return g;
  };
  /** WP5 step 3: this gear hangs (follows only part of its bone's turn, `EnemyView.hangSkirts`). */
  const hangOn = (g: Object3D | undefined, hang: number): void => {
    if (g?.parent) { g.userData.hang = hang; g.userData.hangQ = modelQuat(g.parent, model, new Quaternion()); }
  };
  /** A fitted coat; its skirt hangs. */
  const mountCoat = (coat: Coat, hang = 0.5): void => {
    for (const [b, list] of coat.parts) {
      const g = mount(b, list);
      if (b === 'pelvis') hangOn(g, hang);
    }
  };
  /** M15: the same, with the Alexanderplatz kit. */
  const mountAlex = (name: string, parts: AlexPart[], dy = 0, dz = 0): void => {
    const b = bone(name);
    if (!b) return;
    const g = assembleAlex(alexKit(materials), parts, castShadow);
    b.getWorldPosition(p);
    model.worldToLocal(p);
    g.position.set(p.x, p.y + dy, p.z + dz);
    model.add(g);
    b.attach(g);
    out.push(g);
  };
  switch (kind) {
    case 'wurzler': case 'wurzelmutter': case 'brigade':
      zombieAlexGear(kind, mountAlex);
      break;
    case 'brute':
      // Bust E02: an open orange high-vis vest with two reflective bands over the rags, a rusted collar.
      // A lathed vest that follows the Brocken's chest (waist in, chest out), open at the front; straps over the shoulders.
      mount('spine_03', [
        [vestShell(VEST, 0.8), 'vest'],
        [vestShell([[0.262, -0.1], [0.268, -0.04]], 0.8, 1.012), 'reflect'],
        [vestShell([[0.232, -0.26], [0.244, -0.2]], 0.8, 1.012), 'reflect'],
        ...[-1, 1].map((sd): Part => [tf(new BoxGeometry(0.09, 0.025, 0.36), sd * 0.13, 0.11, 0, 0, 0, sd * 0.3), 'vest']),
      ], 0.08);
      break;
    case 'spitter':
      // Swollen throat sac that glows before it spits, boils on the back.
      mount('neck_01', [
        [tf(new SphereGeometry(0.105, 10, 8), 0, -0.02, 0.09), 'acid'],
        [tf(new SphereGeometry(0.06, 8, 6), 0.09, -0.1, -0.1), 'acid'],
        [tf(new SphereGeometry(0.05, 8, 6), -0.07, -0.16, -0.12), 'acid'],
      ]);
      // Bust E03: a bloated belly that hangs over the belt (after the sac: the sac is gear [0]).
      mount('spine_01', [[tf(new SphereGeometry(0.21, 12, 9).scale(1.22, 1.05, 1.15), 0, 0.02, 0.09), 'belly']]);
      break;
    case 'feldwebel': case 'hauptmann': {
      // Busts X04, X01 (Johannes 2026-11-19, A and B): Pickelhaube with the gold eagle, a high-collared greatcoat
      // (the captain's longer, to the calf), gold epaulettes, a moustache (the captain's white); the captain also
      // wears a red cape over the shoulders and a gold sash. The sabre comes from the weapon rack.
      const fit = new BodyFit(model);
      const cap = kind === 'hauptmann';
      const coat = fitCoat(fit, { mat: cap ? 'officer' : 'garde', hem: cap ? 0.3 : 0.44, flare: cap ? 0.16 : 0.13, open: 1.7, collar: 'red' });
      const o3 = coat.o('spine_03'), o1 = coat.o('spine_01');
      for (const f of [1.6, 2.5, 3.4, 4.3]) coat.add('spine_03', [onShell(new SphereGeometry(0.017, 6, 4), coat.chest, o3, f, 0, 0.006), 'brass']);
      for (const f of [2.6, 3.6]) coat.add('spine_01', [onShell(new SphereGeometry(0.017, 6, 4), coat.belly, o1, f, 0, 0.006), 'brass']);
      // A belt over the waist.
      coat.add('spine_01', [band(coat.belly, o1, 1.2, 1.7, 0.012), 'dark'], [onShell(new BoxGeometry(0.07, 0.055, 0.012), coat.belly, o1, 1.45, 0, 0.016), 'brass']);
      for (const sd of ['l', 'r'] as const) {
        // Epaulettes on top of the coat's shoulder (the chest shell's highest point over the arm), fringed.
        const up = `upperarm_${sd}` as const, s = sd === 'l' ? 1 : -1;
        const cl = fit.box([`clavicle_${sd}`]), arm = coat.o(up);
        const top = new Vector3(arm.x - s * 0.03, cl.max.y + 0.035, (cl.c.z + arm.z) / 2).sub(arm);
        coat.add(up,
          [tf(new BoxGeometry(0.14, 0.02, 0.11), top.x - s * 0.06, top.y + 0.005, top.z, 0, 0, s * 0.12), 'brass'],
          [tf(new CylinderGeometry(0.07, 0.07, 0.028, 14), top.x + s * 0.02, top.y, top.z), 'brass'],
          [tf(new CylinderGeometry(0.072, 0.09, 0.085, 14, 1, true), top.x + s * 0.02, top.y - 0.055, top.z), 'brass'],
          [band(coat.arm[`lowerarm_${sd}`], coat.o(`lowerarm_${sd}`), 2.45, 3, 0.008), 'red'],
        );
      }
      if (cap) {
        // The cape hangs from the shoulders down the back to the knees, open at the front; the sash over the coat.
        // It follows the coat's own rings from the shoulders down (held off it), so the coat never shows through.
        const c = coat.chest, top = c.length - 1;
        const cape = [ringGrow(c[top - 1]!, 1.05, 0.025), ringGrow(c[top - 2]!, 1.08, 0.04), ringGrow(c[top - 3]!, 1.08, 0.05), ringGrow(c[2]!, 1.06, 0.06),
          ringGrow(coat.belly[3]!, 1.1, 0.07), ringGrow(coat.belly[0]!, 1.12, 0.08), ...[2, 3].map((i) => ringGrow(coat.skirt[i]!, 1.06, 0.07))];
        coat.add('spine_03', [shell(cape, o3, cape.map((_, i) => lerp(2.3, 3.3, i / (cape.length - 1))), 22), 'red']);
        coat.add('spine_03', [strip(coat.chest.slice(1), o3, -0.9, 0.5, 0.2, 0.014), 'brass']);
        coat.add('spine_01', [strip(coat.belly.slice(2), o1, 0.75, 0.55, 0.2, 0.016), 'brass']);
      }
      mountCoat(coat);
      // The helmet sits over the skull, tipped forward with the face; the moustache under the nose.
      const head = fit.box(['Head']), hp = fit.at('Head');
      const at = new Vector3(head.c.x, head.max.y - 0.1, head.c.z - 0.01);
      const lip = fit.eyes.clone().add(new Vector3(0, -0.045, 0.025)).sub(at);
      const helm = pickelhaube().map(([g, m]): Part => [g.rotateX(0.18), m]);
      mount('Head', [...helm, ...moustache(lip, cap ? 0.075 : 0.065, cap ? -0.022 : 0.022, cap ? 0.019 : 0.011, cap ? 'white' : 'hair')], at.y - hp.y, at.z - hp.z, at.x - hp.x);
      break;
    }
    case 'waechter': {
      // Bust X03 (Johannes 2026-11-19, A): the Fernsehturm's sphere as a helmet with its lit window ring (cyan,
      // emissive, no light) and the antenna with the red beacon, a ribbed coat like the tower shaft, cyan sparks
      // round the shoulders (gear [0], they flicker).
      const fit = new BodyFit(model);
      const bolt = (pts: Array<[number, number, number]>): Part[] => pts.slice(1).map((q, n): Part => {
        const a = new Vector3(...pts[n]!), b = new Vector3(...q), d = b.clone().sub(a);
        const g = new CylinderGeometry(0.008, 0.008, d.length(), 4).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()));
        return [g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), 'cyan'];
      });
      const zig = (x: number, y: number, z: number, sx: number, h: number): Array<[number, number, number]> =>
        [0, 1, 2, 3, 4].map((n): [number, number, number] => [x + sx * (n % 2 ? 0.05 : -0.02) + sx * n * 0.025, y + h * (1 - n / 4), z + (n % 2 ? 0.02 : -0.02)]);
      const o3 = fit.at('spine_03');
      const sh = (sd: 'l' | 'r'): Vector3 => fit.box([`clavicle_${sd}`]).max.clone().sub(o3);
      const l = sh('l'), r = sh('r');
      mount('spine_03', [
        ...bolt(zig(l.x + 0.12, l.y + 0.02, l.z - 0.05, 1, 0.3)), ...bolt(zig(r.x - 0.12, r.y + 0.04, r.z - 0.05, -1, 0.34)),
        ...bolt(zig(l.x + 0.05, l.y + 0.3, l.z - 0.12, 1, 0.22)), ...bolt(zig(r.x - 0.06, r.y + 0.36, r.z - 0.1, -1, 0.2)),
      ]);
      const head = fit.box(['Head']), hp = fit.at('Head');
      const at = head.c.clone().add(new Vector3(0, 0.015, 0));
      const R = Math.max(head.max.x - head.min.x, head.max.y - head.min.y, head.max.z - head.min.z) * 0.5 + 0.05;
      const eye = fit.eyes.y - at.y + 0.005, er = Math.sqrt(Math.max(0.01, R * R - eye * eye));
      const helm: Part[] = [
        [new SphereGeometry(R, 24, 16), 'tower'],
        // The window ring at eye height, split by dark frames; seams above and below it.
        [tf(new CylinderGeometry(er + 0.008, er + 0.008, 0.06, 28, 1, true), 0, eye, 0), 'cyan'],
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n): Part => [tf(new BoxGeometry(0.012, 0.07, 0.014), Math.sin((n / 12) * Math.PI * 2) * (er + 0.012), eye, Math.cos((n / 12) * Math.PI * 2) * (er + 0.012), 0, (n / 12) * Math.PI * 2), 'dark']),
        ...[eye + 0.06, eye - 0.06, eye + 0.12].map((y): Part => [tf(new TorusGeometry(Math.sqrt(Math.max(0.01, R * R - y * y)) + 0.002, 0.006, 4, 28), 0, y, 0, Math.PI / 2), 'dark']),
        // The antenna: a drum on the cap, the mast with red-and-white sections, the lit beacon.
        [tf(new CylinderGeometry(0.06, 0.08, 0.06, 14), 0, R + 0.01, 0), 'tower'],
        [tf(new CylinderGeometry(0.014, 0.02, 0.4, 6), 0, R + 0.24, 0), 'white'],
        ...[0.14, 0.26].map((y): Part => [tf(new CylinderGeometry(0.019, 0.021, 0.06, 6), 0, R + y, 0), 'red']),
        [tf(new SphereGeometry(0.022, 8, 6), 0, R + 0.45, 0), 'beacon'],
        // The shaft runs down into the collar.
        [tf(new CylinderGeometry(0.08, 0.1, 0.14, 14, 1, true), 0, -R + 0.02, -0.03, 0.3), 'shaft'],
      ];
      mount('Head', helm.map(([g, m]): Part => [g.rotateX(0.18), m]), at.y - hp.y, at.z - hp.z, at.x - hp.x);
      const coat = fitCoat(fit, { mat: 'shaft', pad: 0.035, hem: 0.36, flare: 0.12, open: 1.4, collar: 'shaft' });
      // Ribs like the tower shaft's rings, round the chest, the belly, the skirt and the sleeves.
      const o1 = coat.o('spine_01'), op = coat.o('pelvis');
      for (const f of [0.7, 1.6, 2.5, 3.4, 4.3, 5.2]) coat.add('spine_03', [band(coat.chest, o3, f, f + 0.22, 0.012), 'hair']);
      for (const f of [0.6, 1.6, 2.6, 3.6]) coat.add('spine_01', [band(coat.belly, o1, f, f + 0.25, 0.012), 'hair']);
      for (const f of [0.8, 1.8, 2.8, 3.8, 4.7]) coat.add('pelvis', [shell([ringGrow(ringAt(coat.skirt, f), 1, 0.012), ringGrow(ringAt(coat.skirt, f + 0.2), 1, 0.012)], op, [lerp(0.2, 1.4, Math.sqrt(f / 5)) + 0.05, lerp(0.2, 1.4, Math.sqrt((f + 0.2) / 5)) + 0.05]), 'hair']);
      for (const sd of ['l', 'r'] as const) for (const b of [`upperarm_${sd}`, `lowerarm_${sd}`] as const) {
        for (const f of [0.8, 1.9]) coat.add(b, [band(coat.arm[b], coat.o(b), f, f + 0.25, 0.01), 'hair']);
      }
      mountCoat(coat, 0.5);
      break;
    }
    case 'schaffner': {
      // Bust X05 (Johannes 2026-11-19, A): peaked cap with a brass badge, a long double-breasted coat (two rows of
      // buttons), the signal disc (Kelle) held high in the right hand on a long handle.
      const fit = new BodyFit(model);
      const coat = fitCoat(fit, { mat: 'navy', hem: 0.27, flare: 0.15, open: 1.45, collar: 'navy' });
      const o3 = coat.o('spine_03'), o1 = coat.o('spine_01');
      for (const a of [-0.36, 0.36]) {
        for (const f of [1.5, 2.4, 3.3, 4.2]) coat.add('spine_03', [onShell(new SphereGeometry(0.018, 6, 4), coat.chest, o3, f, a * (1 + (f - 1.5) * 0.12), 0.006), 'brass']);
        for (const f of [2.4, 3.6]) coat.add('spine_01', [onShell(new SphereGeometry(0.018, 6, 4), coat.belly, o1, f, a * 0.85, 0.006), 'brass']);
      }
      // The overlapping front edge and the lapels in a darker cloth, brass cuff buttons.
      coat.add('spine_03', [strip(coat.chest.slice(1, 6), o3, 0.55, 0.12, 0.05, 0.01), 'dark']);
      coat.add('spine_01', [strip(coat.belly.slice(1), o1, 0.12, 0.12, 0.035, 0.01), 'dark']);
      for (const sd of ['l', 'r'] as const) coat.add(`lowerarm_${sd}`, [band(coat.arm[`lowerarm_${sd}`], coat.o(`lowerarm_${sd}`), 2.4, 3, 0.008), 'dark']);
      mountCoat(coat);
      const head = fit.box(['Head']), hp = fit.at('Head');
      const at = new Vector3(head.c.x, head.max.y - 0.075, head.c.z - 0.01);
      mount('Head', [
        [tf(new CylinderGeometry(0.155, 0.138, 0.1, 16).scale(1, 1, 1.1), 0, 0.05, 0), 'navy'],
        [tf(new CylinderGeometry(0.158, 0.158, 0.02, 16).scale(1, 1, 1.1), 0, 0.1, 0), 'navy'],
        [tf(new CylinderGeometry(0.141, 0.141, 0.035, 16, 1, true).scale(1, 1, 1.1), 0, 0.018, 0), 'dark'],
        [tf(new CylinderGeometry(0.14, 0.14, 0.012, 14, 1, false, -1.2, 2.4).scale(1, 1, 1.45), 0, -0.002, 0.012, 0.3), 'dark'],
        [tf(new BoxGeometry(0.06, 0.03, 0.01), 0, 0.06, 0.168, -0.1), 'brass'],
        [tf(new TorusGeometry(0.141, 0.006, 4, 18).scale(1, 1.1, 1), 0, 0.036, 0, Math.PI / 2), 'brass'],
      ].map(([g, m]): Part => [(g as BufferGeometry).rotateX(0.16), m as keyof GearKit]), at.y - hp.y, at.z - hp.z, at.x - hp.x);
      // The Kelle: a long handle up from the fist, leaning out, the red disc with a white ring over the head.
      mount('hand_r', [
        [tf(new CylinderGeometry(0.014, 0.016, 0.95, 6), 0.0, 0.36, 0.03, 0, 0, 0.18), 'rust'],
        [tf(new CylinderGeometry(0.115, 0.115, 0.02, 20), -0.15, 0.88, 0.04, Math.PI / 2), 'red'],
        [tf(new TorusGeometry(0.1, 0.012, 4, 20), -0.15, 0.88, 0.052), 'white'],
        [tf(new TorusGeometry(0.117, 0.008, 4, 20), -0.15, 0.88, 0.04), 'rust'],
      ], -0.04, 0.02);
      break;
    }
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
    case 'brandmeister': {
      // Bust X10 (Johannes 2026-11-19, A): a burning fire helmet (the flames are gear [0] and flicker), a turnout
      // coat with yellow reflective bands fitted to his body (it clipped through him before), a lamp on the chest.
      const fit = new BodyFit(model);
      const head = fit.box(['Head']), hp = fit.at('Head');
      const at = new Vector3(head.c.x, head.max.y - 0.09, head.c.z - 0.02);
      const flames: Part[] = [];
      for (const [x, z, h, r, lean] of [[0, 0.02, 0.34, 0.075, -0.15], [0.07, -0.05, 0.26, 0.06, -0.35], [-0.07, -0.04, 0.27, 0.06, -0.3], [0.1, 0.07, 0.18, 0.045, 0.1], [-0.1, 0.06, 0.2, 0.045, 0.15], [0, -0.13, 0.2, 0.055, -0.6], [0.16, -0.1, 0.13, 0.035, -0.4], [-0.15, -0.12, 0.14, 0.035, -0.5]] as const) {
        flames.push([tf(new ConeGeometry(r, h, 7), x, 0.13 + h / 2 - 0.02, z, lean, 0, x * 2), 'fire']);
        flames.push([tf(new ConeGeometry(r * 0.5, h * 0.6, 6), x, 0.13 + h * 0.28, z + 0.01, lean, 0, x * 2), 'flame']);
      }
      // The fire keeps burning upwards when he throws his head back.
      hangOn(mount('Head', flames, at.y - hp.y, at.z - hp.z, at.x - hp.x), 0.75);
      mount('Head', [
        [tf(new SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.95, 1.12), 0, 0, 0), 'helmet'],
        // The long brim, wide at the back like an old leather fire helmet; the front shield with its badge; the comb.
        [tf(new CylinderGeometry(0.2, 0.21, 0.014, 20).scale(1, 1, 1.35), 0, -0.004, -0.06, -0.12), 'helmet'],
        [tf(new BoxGeometry(0.13, 0.11, 0.014), 0, 0.07, 0.17, -0.3), 'helmet'],
        [tf(new BoxGeometry(0.08, 0.06, 0.008), 0, 0.072, 0.18, -0.3), 'brass'],
        [tf(new BoxGeometry(0.025, 0.05, 0.3).scale(1, 1, 1), 0, 0.13, -0.02), 'brass'],
        [tf(new TorusGeometry(0.152, 0.008, 4, 20).scale(1, 1.12, 1), 0, 0.01, 0, Math.PI / 2), 'brass'],
      ].map(([g, m]): Part => [(g as BufferGeometry).rotateX(0.15), m as keyof GearKit]), at.y - hp.y, at.z - hp.z, at.x - hp.x);
      const coat = fitCoat(fit, { mat: 'turnout', pad: 0.035, hem: 0.5, flare: 0.1, open: 1.35, collar: 'turnout' });
      const o3 = coat.o('spine_03'), o1 = coat.o('spine_01'), op = coat.o('pelvis');
      // Two bands round the chest and the waist, one round the hem, two on each sleeve.
      coat.add('spine_03', [band(coat.chest, o3, 1.0, 1.45, 0.012), 'band']);
      coat.add('spine_01', [band(coat.belly, o1, 2.0, 2.5, 0.012), 'band']);
      coat.add('pelvis', [shell([ringGrow(ringAt(coat.skirt, 4.0), 1, 0.012), ringGrow(ringAt(coat.skirt, 4.45), 1, 0.012)], op, [1.25, 1.3]), 'band']);
      for (const sd of ['l', 'r'] as const) {
        coat.add(`upperarm_${sd}`, [band(coat.arm[`upperarm_${sd}`], coat.o(`upperarm_${sd}`), 1.5, 1.85, 0.01), 'band']);
        coat.add(`lowerarm_${sd}`, [band(coat.arm[`lowerarm_${sd}`], coat.o(`lowerarm_${sd}`), 2.2, 2.55, 0.01), 'band']);
      }
      // The lamp on the left of the chest: a brass housing, its lit lens, a strap; the coat's buckles.
      coat.add('spine_03',
        [onShell(tf(new CylinderGeometry(0.058, 0.065, 0.06, 14), 0, 0, 0.03, Math.PI / 2), coat.chest, o3, 2.6, 0.45, 0.004), 'brass'],
        [onShell(tf(new CylinderGeometry(0.044, 0.044, 0.012, 14), 0, 0, 0.062, Math.PI / 2), coat.chest, o3, 2.6, 0.45, 0.004), 'lamp'],
        [strip(coat.chest.slice(1, 6), o3, 0.45, 0.45, 0.06, 0.01), 'dark'],
        ...[1.9, 3.3].map((f): Part => [onShell(new BoxGeometry(0.05, 0.022, 0.012), coat.chest, o3, f, 0.04, 0.008), 'steel']),
      );
      coat.add('spine_01', ...[1.5, 3.2].map((f): Part => [onShell(new BoxGeometry(0.05, 0.022, 0.012), coat.belly, o1, f, 0.04, 0.008), 'steel']));
      mountCoat(coat);
      break;
    }
    case 'rattenmutter': {
      // Bust X06 (Johannes 2026-11-19, A): a giant rat head with a crown replaces the human head (the skull is
      // shrunk away, SHAPE Head 0.05; mounted on the neck as the Wurzler's sunflower), a fur cloak over the shoulders
      // and a long torn rag dress; strongly hunched (HUNCH), so the head is built tipped up.
      const fit = new BodyFit(model);
      const hd = fit.at('Head'), nk = fit.at('neck_01');
      const rat: Part[] = [
        [tf(new SphereGeometry(0.16, 16, 12).scale(1, 0.9, 1.25), 0, 0, 0), 'fur'],
        [tf(new ConeGeometry(0.105, 0.3, 14).scale(1, 0.78, 1), 0, -0.03, 0.24, Math.PI / 2), 'fur'],
        [tf(new SphereGeometry(0.036, 10, 8), 0, -0.035, 0.39), 'pink'],
        // The open lower jaw, the long yellow incisors, a dark mouth.
        [tf(new ConeGeometry(0.07, 0.24, 10).scale(1, 0.6, 1), 0, -0.1, 0.18, Math.PI / 2 + 0.28), 'fur'],
        [tf(new BoxGeometry(0.09, 0.012, 0.16), 0, -0.075, 0.24, 0.12), 'dark'],
        ...[-1, 1].map((sd): Part => [tf(new BoxGeometry(0.02, 0.06, 0.012), sd * 0.013, -0.085, 0.355, -0.15), 'bone']),
        ...[-1, 1].map((sd): Part => [tf(new SphereGeometry(0.026, 8, 6), sd * 0.085, 0.045, 0.15), 'eye']),
        // Big round ears, pink inside.
        ...[-1, 1].flatMap((sd): Part[] => [
          [tf(new SphereGeometry(0.085, 12, 8).scale(1, 1.1, 0.28), sd * 0.12, 0.14, -0.04, -0.2, sd * 0.35, -sd * 0.35), 'fur'],
          [tf(new SphereGeometry(0.06, 10, 8).scale(1, 1.1, 0.2), sd * 0.122, 0.142, -0.022, -0.2, sd * 0.35, -sd * 0.35), 'pink'],
        ]),
        // Whiskers, three a side.
        ...[-1, 1].flatMap((sd) => [0.18, 0, -0.18].map((a): Part => [tf(new CylinderGeometry(0.003, 0.002, 0.24, 3), sd * 0.15, -0.03 + a * 0.12, 0.32, a, 0, sd * (Math.PI / 2 - 0.25)), 'white'])),
        // The crown: a brass band with five points and red stones.
        [tf(new CylinderGeometry(0.1, 0.09, 0.06, 14, 1, true), 0, 0.15, 0.0), 'brass'],
        ...[0, 1, 2, 3, 4].flatMap((n): Part[] => {
          const a = (n / 5) * Math.PI * 2;
          return [
            [tf(new ConeGeometry(0.022, 0.08, 5), Math.sin(a) * 0.095, 0.21, Math.cos(a) * 0.095), 'brass'],
            [tf(new SphereGeometry(0.014, 6, 4), Math.sin(a) * 0.1, 0.152, Math.cos(a) * 0.1), 'red'],
          ];
        }),
        // A fur ruff where the head meets the neck.
        ...[0, 1, 2, 3, 4, 5, 6].map((n): Part => {
          const a = Math.PI * 0.55 + (n / 6) * Math.PI * 0.9;
          return [tf(new ConeGeometry(0.05, 0.2, 6), Math.sin(a) * 0.12, -0.06, Math.cos(a) * 0.12 - 0.08, Math.cos(a) * 1.2 + 1.2, 0, -Math.sin(a) * 1.2), 'fur'];
        }),
      ];
      mount('neck_01', rat.map(([g, m]): Part => [g.scale(1.5, 1.5, 1.5).rotateX(-0.7), m]), hd.y - nk.y + 0.1, hd.z - nk.z + 0.1, hd.x - nk.x);
      const coat = fitCoat(fit, { mat: 'rags', pad: 0.03, hem: 0.22, flare: 0.17, open: 1.2, sleeves: 'upper', jag: 0.07 });
      // The fur cloak: from the neck over the shoulders and the hump, torn, open a little at the front.
      const c = coat.chest, top = c.length - 1;
      const cloak = [ringGrow(c[top]!, 1.08, 0.015), ringGrow(c[top - 1]!, 1.02, 0.03), ringGrow(c[top - 2]!, 1.02, 0.04), ringGrow(c[top - 3]!, 1.02, 0.045), ringGrow(c[3]!, 1.02, 0.05), ringGrow(c[1]!, 1.03, 0.055)];
      coat.add('spine_03', [shell(cloak, coat.o('spine_03'), cloak.map((_, i) => lerp(1.2, 2.1, i / (cloak.length - 1))), 24, 0.09), 'fur']);
      coat.add('spine_01', [band(coat.belly, coat.o('spine_01'), 1.3, 1.7, 0.012), 'dark']);
      mountCoat(coat, 0.45);
      break;
    }
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
      // Kabelghul (bust E13): four cyan cables arching from the skull to the back, implants, a red scarf.
      mount('neck_01', [...kabelLoops('cyan'), [tf(new TorusGeometry(0.085, 0.03, 6, 16).scale(1.2, 1, 1.1), 0, 0.0, 0.01, Math.PI / 2), 'red']]);
      mount('Head', implants('cyan'));
      break;
    case 'zuender':
      // Bust E07: dynamite strapped to the chest, a detonator with a dial, a fuse with its spark, a red scarf.
      // The spark rides in its own group (gear [0]) so it can flicker; it flares while the fuse burns.
      // The fuse burns at its tip: a spark and a small flame (gear [0], its origin at the tip so it can flicker in place).
      mount('spine_03', [
        [tf(new SphereGeometry(0.028, 8, 6), 0, 0, 0), 'spark'],
        [tf(new ConeGeometry(0.035, 0.12, 8), 0, 0.06, 0), 'flame'],
        [tf(new ConeGeometry(0.02, 0.08, 6), 0.015, 0.05, 0.01, 0, 0, -0.4), 'flame'],
      ], 0.08 + 0.17, 0.25, 0.1);
      mount('spine_03', [
        ...[-0.105, -0.035, 0.035, 0.105].map((x): Part => [tf(new CylinderGeometry(0.034, 0.034, 0.3, 8), x, -0.1, 0.2), 'red']),
        [tf(new BoxGeometry(0.3, 0.035, 0.08), 0, 0.0, 0.2), 'dark'],
        [tf(new BoxGeometry(0.3, 0.035, 0.08), 0, -0.2, 0.2), 'dark'],
        [tf(new BoxGeometry(0.13, 0.1, 0.06), -0.12, -0.3, 0.22), 'dark'],
        [tf(new CylinderGeometry(0.03, 0.03, 0.012, 10), -0.12, -0.3, 0.255, Math.PI / 2), 'brass'],
        [cable([[0.035, 0.05, 0.2], [0.06, 0.12, 0.23], [0.1, 0.17, 0.25]], 0.008), 'dark'],
      ], 0.08);
      mount('neck_01', [[tf(new TorusGeometry(0.1, 0.035, 5, 12).scale(1.2, 1, 1.1), 0, -0.06, 0.01, Math.PI / 2), 'red']]);
      break;
    case 'schild':
      // Bust E06: riot gear. The shield is gear [0]: it hangs from its top edge on the chest and swings aside while
      // the guard is open. Bevelled rounded plate with a rim, a viewing window, rivets and scratches.
      mount('spine_03', riotShield(0.5, 0.82), 0.16, 0.34);
      mount('Head', [
        [tf(new SphereGeometry(0.152, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, -0.01, 0), 'riot'],
        [tf(new CylinderGeometry(0.162, 0.166, 0.035, 24, 1, true), 0, -0.035, 0), 'riot'],
        [tf(new TorusGeometry(0.163, 0.008, 6, 28), 0, -0.052, 0, Math.PI / 2), 'dark'],
        // The visor: a curved strip of clear plastic swung up over the brow, with its two hinge bolts.
        [tf(new CylinderGeometry(0.178, 0.178, 0.13, 20, 1, true, -0.95, 1.9), 0, 0.06, 0, -0.5), 'visor'],
        ...[-1, 1].map((sd): Part => [tf(new CylinderGeometry(0.018, 0.018, 0.02, 10), sd * 0.165, 0.0, 0.0, 0, 0, Math.PI / 2), 'steel']),
        [new TubeGeometry(new CatmullRomCurve3([new Vector3(-0.15, -0.04, 0.02), new Vector3(-0.08, -0.15, 0.07), new Vector3(0, -0.18, 0.09), new Vector3(0.08, -0.15, 0.07), new Vector3(0.15, -0.04, 0.02)]), 16, 0.008, 5, false), 'dark'],
      ], 0.03);
      // Chest armour in plates, layered shoulder pads.
      mount('spine_03', [
        [vestShell([[0.19, -0.3], [0.215, -0.2], [0.235, -0.08], [0.24, 0.02], [0.225, 0.1], [0.19, 0.15]], 0.25), 'riot'],
        ...[-0.2, -0.08, 0.04].map((y): Part => [vestShell([[0.232 + y * 0.05, y - 0.012], [0.236 + y * 0.05, y + 0.012]], 0.25, 1.02), 'dark']),
        ...[-1, 1].flatMap((sd): Part[] => [
          [tf(new SphereGeometry(0.12, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(1.05, 0.75, 1), sd * 0.24, 0.04, 0, 0, 0, -sd * 0.4), 'riot'],
          [tf(new SphereGeometry(0.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(1.05, 0.75, 1), sd * 0.29, -0.03, 0, 0, 0, -sd * 0.75), 'riot'],
          [tf(new TorusGeometry(0.105, 0.006, 5, 24).scale(1.05, 1, 1), sd * 0.24, 0.05, 0, Math.PI / 2, 0, -sd * 0.4), 'dark'],
        ]),
      ], 0.08);
      for (const sd of ['l', 'r']) {
        mount(`calf_${sd}`, [[tf(new SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 1.2, 0.8), 0, 0.02, 0.05, Math.PI / 2), 'riot']]);
        mount(`lowerarm_${sd}`, [[tf(new SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 1.1, 0.8), 0, 0, -0.04, -Math.PI / 2), 'riot']]);
      }
      break;
    case 'heuler':
      // Bust E08: a swollen throat (gear [0]) that bulges while it howls, the rest is rags.
      mount('neck_01', [
        [tf(new SphereGeometry(0.105, 16, 12).scale(1.25, 1.1, 1.05), 0, 0.0, 0.07), 'flesh'],
        [tf(new SphereGeometry(0.055, 12, 8), 0.085, 0.03, 0.04), 'flesh'],
        [tf(new SphereGeometry(0.05, 12, 8), -0.085, 0.02, 0.04), 'flesh'],
      ]);
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

/**
 * Mech clips (Quaternius Animated Mech Pack): the strike clip per body, where it lands and how far the
 * walk clip carries the body per second (looked at with `tools/enemy-sheet.mjs`, see the task handover).
 */
const MECH = {
  // Leela's Kick: the leg is out from 0.55 to 0.67 of the clip; Mike's Punch: the fist is out from 0.5 to 0.62.
  mech: { strike: 'Kick', hit: 0.55, swipe: 0.12, walk: 1.1, run: 3 },
  mechBig: { strike: 'Punch', hit: 0.5, swipe: 0.12, walk: 1.5, run: 4 },
} as const;
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

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
  private readonly rat: Rat | null = null;
  /** M12c drones, built on first use (one view can carry a small drone or the Wachdrohne). */
  private readonly drones: { small?: Drone; big?: Drone } = {};
  private drone: Drone | null = null;
  /** M12c: pink cables on neon maps (plain bodies), and the speaker rings of this body. */
  private cyber: Object3D[] | null = null;
  private readonly pulse: LitMaterial | null = null;
  private readonly kern: Kern | null = null;
  private readonly koloss: Koloss | null = null;
  private readonly clock: { rig: ClockRig; legs: ClockLeg[]; legGroup: Object3D } | null = null;
  /** Mech gear that moves: the shield (swings aside when the guard opens), the Großer Uhrwerkläufer's key. */
  private shield: Object3D | null = null;
  private key: Object3D | null = null;
  /** Skeleton the clips belong to (a mech falls back to the zombie when the mech pack is not loaded). */
  private readonly skin: 'zombie' | 'raptor' | 'rex' | 'mech' | 'mechBig' | null = null;
  private spinDrum = 0;
  private spinOrbit = 0;
  private spinRing = 0;
  private readonly mats: LitMaterial[] = [];
  private readonly cloth: LitMaterial[] = [];
  private readonly glow: LitMaterial[] = [];
  private readonly seed = Math.random();
  private readonly gear = new Map<GearKey, Object3D[]>();
  /** WP5 step 3: coat skirts of the worn gear that hang instead of turning fully with the pelvis. */
  private hanging: Object3D[] = [];
  private readonly bones = new Map<string, Object3D>();
  private readonly model: Object3D | null = null;
  private readonly clips: Map<string, AnimationClip> | null = null;
  private rack: WeaponRack | null = null;

  /** `gdr`: Alexanderplatz (walkers wear the Brigadeghul's Blaumann); `clockRig`: the map's maker of Weltzeituhr rigs. */
  constructor(assets: CharacterAssets, private readonly materials: Materials, readonly body: BodyKind, private readonly castShadow: boolean, private readonly opts: { gdr?: boolean; clockRig?: () => ClockRig } = {}) {
    this.root.add(this.inner);
    if (body === 'kern') {
      this.kern = buildKern(materials, castShadow);
      this.inner.add(this.kern.model);
      this.collect(this.kern.model);
      return;
    }
    if (body === 'koloss') {
      this.koloss = buildKoloss(materials, castShadow);
      this.inner.add(this.koloss.model);
      this.collect(this.koloss.model);
      return;
    }
    if (body === 'clock') {
      const rig = opts.clockRig?.() ?? makeClockRig(clockMats(materials));
      const legs = buildClockLegs(materials, CLOCK.drum, castShadow);
      rig.body.add(legs.group);
      this.inner.add(rig.group);
      this.clock = { rig, legs: legs.legs, legGroup: legs.group };
      this.collect(rig.group);
      return;
    }
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
    const mech = body === 'mech' || body === 'mechBig' ? assets.mech : undefined;
    const skin = mech ? (body as 'mech' | 'mechBig') : body === 'raptor' || body === 'rex' ? body : 'zombie';
    this.skin = skin;
    const src = skin === 'mech' ? mech!.small : skin === 'mechBig' ? mech!.big : skin === 'zombie' ? assets.zombie : skin === 'raptor' ? assets.raptor : assets.rex;
    // (crow, rat and the code-built bodies returned above)
    const clips: Map<string, AnimationClip> = skin === 'mech' ? mech!.smallClips : skin === 'mechBig' ? mech!.bigClips : skin === 'zombie' ? assets.zombieClips : skin === 'raptor' ? assets.raptorClips : assets.rexClips;
    const model = cloneSkinned(src);
    this.model = model;
    this.inner.add(model);
    this.anim = new Animator(model, clips);
    this.clips = clips;
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
            mat.emissive.set(skin === 'zombie' ? 0xd8ff7a : 0xffc04a);
            mat.emissiveIntensity = skin === 'zombie' ? 2.2 : 3;
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
      if (skin === 'zombie') {
        mesh.frustumCulled = true;
        mesh.boundingSphere = new Sphere(new Vector3(0, 0.9, 0), 1.7);
      } else mesh.frustumCulled = false;
    });
    if (skin === 'mech' || skin === 'mechBig') {
      this.mechGear(model, skin);
      return;
    }
    if (skin !== 'zombie') {
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
    if (skin === 'zombie') {
      model.updateMatrixWorld(true);
      for (const names of Object.values(SHAPE)) for (const n of Object.keys(names)) {
        const b = model.getObjectByName(n);
        if (b) this.bones.set(n, b);
      }
    }
  }

  /**
   * Code-built bodies: their materials flash and glow like a skinned body's. The kit and the map's
   * materials are shared (the Weltzeituhr rig uses the map's own), so each body gets its own copies.
   */
  private collect(o: Object3D): void {
    const own = new Map<LitMaterial, LitMaterial>();
    o.traverse((q) => {
      const mesh = q as Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as LitMaterial;
      // Unlit parts (the drum's dark underside) neither flash nor glow.
      if (!src.emissive) return;
      let m = own.get(src);
      if (!m) {
        m = src.clone();
        own.set(src, m);
        // Glowing parts (lamps, painted panels with their own glow) keep their light; the rest flash white when hit.
        if (m.emissiveMap || (m.emissiveIntensity > 1 && m.emissive.getHex() !== 0)) this.glow.push(m);
        else this.mats.push(m);
      }
      mesh.material = m;
    });
  }

  /** The clock-face shield on the chest, a dome and chimney (Uhrwerkläufer) or the wind-up key (Großer), the emblem plate, a glowing lens. */
  private mechGear(model: Object3D, skin: 'mech' | 'mechBig'): void {
    const k = alexKit(this.materials);
    model.updateMatrixWorld(true);
    const p = new Vector3();
    const at = (name: string, parts: AlexPart[], x: number, y: number, z: number): Object3D | null => {
      const b = model.getObjectByName(name);
      if (!b) return null;
      const g = assembleAlex(k, parts, this.castShadow);
      b.getWorldPosition(p);
      model.worldToLocal(p);
      g.position.set(p.x + x, p.y + y, p.z + z);
      model.add(g);
      b.attach(g);
      return g;
    };
    const big = skin === 'mechBig';
    // The shield hangs from its top edge so it can swing down when the guard opens.
    const r = big ? 0.85 : 0.42;
    // Mike punches with the right: his shield sits on the left of the chest.
    const shield = at('Chest', shieldParts(r).map(([g, m]): AlexPart => [tfAlex(g, 0, -r, 0), m]), big ? 0.45 : 0, big ? 0.55 : 0.32, big ? 0.85 : 0.5);
    this.shield = shield;
    if (big) {
      this.key = at('Chest', keyParts(1.1), 0, 0.2, -0.75);
      at('Chest', emblemParts(0.45).map(([g, m]): AlexPart => [tfAlex(g, 0, 0, 0, 0, 0, 0), m]), 0.75, 0.45, 0.45);
      at('Head', [[tfAlex(new SphereGeometry(0.09, 8, 6), 0.16, 0.1, 0.42), 'lens'], [tfAlex(new SphereGeometry(0.09, 8, 6), -0.16, 0.1, 0.42), 'lens']], 0, 0, 0);
    } else {
      at('Head', domeParts(0.34), 0, 0.46, 0);
      at('Chest', emblemParts(0.22).map(([g, m]): AlexPart => [tfAlex(g, 0, 0, 0, 0, Math.PI), m]), 0, 0.05, -0.42);
      at('Head', [[tfAlex(new SphereGeometry(0.11, 10, 8), 0, 0.15, 0.45), 'lens']], 0, 0, 0);
    }
    this.glow.push(k.lens);
  }

  /**
   * WP5 fix: gear is built upright in model space and handed to its bone, so it is aligned to the pose the
   * skeleton holds at that moment. Views are pooled per body, so that used to be whatever the last kind left
   * (often its death pose): helmets and shells came out tilted. Now the skeleton takes the first frame of the
   * idle clip for the build and goes back afterwards (the temporary mixer restores the bones when it stops).
   */
  private inIdle<T>(build: () => T): T {
    const clip = this.clips?.get('Zombie_Idle_Loop');
    if (!clip || !this.model) return build();
    const m = new AnimationMixer(this.model);
    m.clipAction(clip).play();
    m.update(0);
    this.model.updateMatrixWorld(true);
    const out = build();
    m.stopAllAction();
    m.uncacheRoot(this.model);
    return out;
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
    // WP5 (Johannes): every normal ghoul looks a little different, skin and rags; bosses keep their colours.
    const vary = this.skin === 'zombie' && !e.def.boss;
    const r = (n: number): number => { const v = Math.sin((this.seed + e.id * 0.137) * 91.7 + n * 12.9) * 43758.5; return v - Math.floor(v) - 0.5; };
    for (const m of this.mats) {
      if (m.name === 'skin') {
        m.color.set(tint);
        if (vary) m.color.offsetHSL(r(1) * 0.12, r(2) * 0.3, r(3) * 0.22);
      }
      m.emissive.setScalar(0);
    }
    const key: GearKey = this.opts.gdr && e.kind === 'walker' ? 'brigade' : e.kind;
    for (const m of this.cloth) {
      const own = key === 'brigade' ? CLOTH_BRIGADE : CLOTH[e.kind];
      m.color.set(own ?? (vary ? RAGS[Math.floor((r(4) + 0.5) * RAGS.length)]! : 0xffffff));
      if (vary) m.color.offsetHSL(r(5) * 0.08, r(6) * 0.2, r(7) * 0.2);
    }
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
    if (this.skin === 'zombie' && this.model) {
      // Proportions and gear of this kind; everything else back to plain.
      for (const bone of this.bones.values()) bone.scale.setScalar(1);
      for (const [n, v] of Object.entries(SHAPE[e.kind] ?? {})) this.bones.get(n)?.scale.setScalar(v);
      for (const list of this.gear.values()) for (const g of list) g.visible = false;
      let gear = this.gear.get(key);
      if (!gear) {
        gear = this.inIdle(() => gearFor(key, this.model!, this.materials, this.castShadow, this.pulse ?? undefined));
        this.gear.set(key, gear);
      }
      for (const g of gear) g.visible = true;
      this.hanging = gear.filter((g) => g.userData.hang !== undefined);
      // Speaker heads start at rest size.
      for (const g of gear) g.scale.setScalar(g.userData.rest ??= g.scale.x);
      const cyber = neon && !!CYBER[e.kind];
      if (cyber && !this.cyber) this.cyber = this.inIdle(() => gearFor('cyber', this.model!, this.materials, this.castShadow));
      for (const g of this.cyber ?? []) g.visible = cyber;
      // Officers carry a saber.
      const armed = e.kind === 'feldwebel' || e.kind === 'hauptmann';
      if (armed && !this.rack) {
        this.rack = new WeaponRack(this.materials);
        this.rack.show('stahl', undefined);
        this.model.getObjectByName('hand_r')?.add(this.rack.group);
      }
      if (this.rack) this.rack.group.visible = armed;
      for (const m of this.glow) m.emissive.set(EYES[e.kind] ?? (e.def.boss ? 0xff5a2a : e.kind === 'spitter' || e.kind === 'wurzler' ? 0x97ff5a : neon ? 0xff4fa3 : 0xd8ff7a));
    }
    if (this.clock) {
      this.clock.rig.body.position.y = 0;
      this.clock.legGroup.scale.setScalar(0.01);
      this.spinDrum = this.spinOrbit = 0;
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
    // M11c hidden guards wait in a doorway. Playtest 2026-11-18: no longer invisible until they wake (they
    // seemed to pop in and strike at once); they stand still in sight until the hero comes close.
    this.root.visible = true;
    const dt2 = frozen ? 0 : dt;
    if (this.body === 'crow') this.poseCrow(e, t);
    else if (this.body === 'rat') this.poseRat(e, t);
    else if (this.body === 'drone') this.poseDrone(e, t);
    else if (this.kern) this.poseKern(e, t);
    else if (this.koloss) this.poseKoloss(e, t, dt2);
    else if (this.clock) this.poseClock(e, t, dt2, alpha);
    else if (this.skin === 'zombie') this.poseZombie(e, t);
    else if (this.skin === 'mech' || this.skin === 'mechBig') this.poseMech(e, t, MECH[this.skin], dt2);
    else this.poseDino(e, t, DINO[this.skin as 'raptor' | 'rex']);
    if (e.state === 'dead' && !this.clock) {
      // Sink into the ground before the body is removed (the Weltzeituhr settles on its base instead).
      const sink = Math.max(0, t - (SPAWN.corpseTime - 0.8)) / 0.8;
      this.root.position.y -= sink * (this.body === 'rex' || this.body === 'koloss' || this.body === 'mechBig' ? 1.6 : this.body === 'rat' || this.body === 'drone' ? 0.3 : 0.55);
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
    if (this.hanging.length) this.hangSkirts(e.state === 'dead');
  }

  /**
   * WP5 step 3: a long coat's skirt is rigid on the pelvis, so a clip that tips the pelvis far (the heavy swing)
   * threw it out flat. It follows only part of the pelvis' turn away from the pose it was built in and hangs
   * otherwise (fully follows once dead, so it falls with the body).
   */
  private hangSkirts(dead: boolean): void {
    for (const g of this.hanging) {
      const k = dead ? 1 : 1 - (g.userData.hang as number);
      modelQuat(g.parent!, this.model!, qa);
      qb.copy(g.userData.hangQ as Quaternion).invert().premultiply(qa);
      qc.identity().slerp(qb, k);
      g.quaternion.copy(qa).invert().multiply(qc);
    }
  }

  private poseZombie(e: Enemy, t: number): void {
    const a = this.anim!;
    // M11c: playing dead on the ground, then getting up (Death01 backwards) when the hero comes close.
    if (e.pose === 'lying' && e.state !== 'dead') {
      const end = a.duration('Death01');
      if (e.sleep) { a.pose('Death01', end, 0.01); return; }
      // Posed from the sim's get-up timer (P22), so the body is up exactly when it can strike.
      if (e.rise) { const k = 1 - e.rise / THREAT.rise; a.pose('Death01', DEATH_FROM + (end - DEATH_FROM) * (1 - k), 0.04); return; }
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
          case 'fuse':
            // Zünder: stands hunched over the bundle and shakes while the fuse burns.
            a.loop('Zombie_Idle_Loop', 0.1);
            pitch = 0.22 * w;
            this.inner.position.x = Math.sin(this.time * 55) * 0.025 * w;
            break;
          case 'howl':
            // Heuler: throws the head back while the throat swells, then howls forward.
            a.loop('Zombie_Idle_Loop', 0.1);
            pitch = going ? lerp(-0.55, 0.1, g) : -0.55 * w;
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
    if (!(e.state === 'special' && e.sp?.kind === 'fuse')) this.inner.position.x = 0;
    // WP5: the Zünder's spark flickers and flares while the fuse burns; the Heuler's throat swells to howl;
    // the Schildträger's shield swings aside while the guard stands open.
    if (this.kind === 'zuender') {
      const spark = this.gear.get('zuender')?.[0];
      const lit = e.state === 'special' && e.sp?.kind === 'fuse' ? Math.min(1, e.stateT / e.sp.wind) : 0;
      if (spark) {
        // A flickering flame on the fuse that flares up while the fuse burns down.
        const f = 0.85 + 0.3 * Math.sin(this.time * 31 + this.seed * 9) ** 2 + 0.15 * Math.sin(this.time * 53);
        const k = e.state === 'dead' ? 0.01 : f + 1.6 * lit;
        spark.scale.set(k * (1 - 0.15 * Math.sin(this.time * 47)), k * (1 + 0.25 * Math.sin(this.time * 37)), k);
        spark.rotation.z = 0.15 * Math.sin(this.time * 23);
      }
    } else if (this.kind === 'waechter') {
      // WP5 step 3: the sparks jump: on and off, a new place round the shoulders every few frames.
      const sparks = this.gear.get('waechter')?.[0];
      if (sparks) {
        const step = Math.floor(this.time * 9 + this.seed * 7);
        const on = e.state !== 'dead' && Math.sin(step * 12.9898 + this.seed) * 43758.5 % 1 > -0.6;
        sparks.visible = on;
        sparks.rotation.y = Math.sin(step * 7.31) * 0.35;
        sparks.scale.setScalar(0.65 + 0.3 * Math.abs(Math.sin(step * 3.7)));
      }
    } else if (this.kind === 'brandmeister') {
      // WP5 step 3: the helmet fire flickers like the Zünder's fuse and flares while he spits flame.
      const fire = this.gear.get('brandmeister')?.[0];
      if (fire) {
        const sp = e.state === 'special' ? e.sp : null;
        const flare = sp && (sp.kind === 'flame' || sp.kind === 'ring') ? Math.min(1, e.stateT / sp.wind) : 0;
        const f = 0.9 + 0.18 * Math.sin(this.time * 17 + this.seed * 9) ** 2 + 0.1 * Math.sin(this.time * 41);
        const k = e.state === 'dead' ? 0.01 : f + 0.45 * flare;
        fire.scale.set(k * (1 - 0.08 * Math.sin(this.time * 29)), k * (1 + 0.2 * Math.sin(this.time * 23)), k);
      }
    } else if (this.kind === 'heuler') {
      const sac = this.gear.get('heuler')?.[0];
      const sp = e.state === 'special' ? e.sp : null;
      sac?.scale.setScalar(sp?.kind === 'howl' ? 1 + 0.8 * Math.min(1, e.stateT / sp.wind) : 1 + 0.05 * Math.sin(this.time * 3));
    } else if (this.kind === 'schild') {
      const sh = this.gear.get('schild')?.[0];
      if (sh) sh.rotation.z += (((e.guardOpen ?? 0) > 0 || e.state === 'dead' ? 1.0 : 0) - sh.rotation.z) * 0.25;
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

  /** Mechs: walk and run clips by speed, the strike clip posed from sim time, the shield swings aside while the guard is open. */
  private poseMech(e: Enemy, t: number, k: (typeof MECH)['mech' | 'mechBig'], dt: number): void {
    const a = this.anim!;
    const def = e.def;
    const lean = this.inner.rotation;
    let pitch = 0;
    const hitT = a.duration(k.strike) * k.hit, swipe = a.duration(k.strike) * k.swipe;
    switch (e.state) {
      case 'chase':
        if (e.speed > k.run * 0.6) a.loop('Run', 0.15, Math.min(2, e.speed / k.run));
        else if (e.speed > 0.15) a.loop('Walk', 0.2, Math.min(2.4, Math.max(0.6, e.speed / k.walk)));
        else a.loop('Idle', 0.25);
        if (e.open > 0) pitch = 0.18;
        break;
      case 'windup':
        a.pose(k.strike, lerp(0, hitT, Math.min(1, t / def.windup)), 0.12);
        break;
      case 'strike':
        a.pose(k.strike, hitT + swipe * Math.min(1, t / def.active), 0.03);
        break;
      case 'recover':
        a.pose(k.strike, lerp(hitT + swipe, a.duration(k.strike), Math.min(1, t / def.recovery)), 0.05);
        break;
      case 'special': {
        const sp = e.sp;
        if (!sp) break;
        const w = Math.min(1, t / sp.wind), going = t >= sp.wind;
        if (sp.kind === 'charge') {
          if (going) a.loop('Run', 0.06, 2.2);
          else { a.loop('Idle', 0.15); pitch = 0.25 * w; }
        } else if (sp.kind === 'key') a.loop('Yes', 0.15, 1.4);
        else a.loop('Idle', 0.15);
        break;
      }
      case 'stagger':
        a.pose('HitRecieve_1', (t / Math.max(0.01, e.staggerDur)) * a.duration('HitRecieve_1'), 0.04);
        break;
      case 'dead':
        a.pose('Death', t * 1.2, 0.06);
        break;
    }
    lean.x += (pitch - lean.x) * 0.3;
    // Guard open: the dial swings down and out of the way; a little sway otherwise.
    if (this.shield) {
      const open = e.state !== 'dead' && (e.guardOpen ?? 0) > 0;
      this.shield.rotation.x += ((open ? 1.25 : 0.05 * Math.sin(this.time * 2)) - this.shield.rotation.x) * 0.2;
    }
    if (this.key) this.key.rotation.z += dt * (e.state === 'special' && e.sp?.kind === 'key' ? 9 : 1.2);
  }

  /** Kernspeier: hops when it moves; plants (squashes, head back, mouth open), then snaps the head forward. */
  private poseKern(e: Enemy, t: number): void {
    const c = this.kern!;
    let hop = 0, squash = 1, head = 0.1, mouth = 1, roll = 0, lean = 0;
    switch (e.state) {
      case 'chase':
        if (e.speed > 0.2) { hop = Math.abs(Math.sin(this.time * 9 + this.seed * 5)) * 0.14; lean = 0.15; }
        head = 0.1 + 0.08 * Math.sin(this.time * 2.3 + this.seed * 4);
        if (e.open > 0) head = 0.65;
        break;
      case 'windup':
        head = -0.3 * Math.min(1, t / e.def.windup);
        break;
      case 'strike':
        head = 0.5;
        break;
      case 'special': {
        const sp = e.sp;
        if (!sp) break;
        const w = Math.min(1, t / sp.wind);
        if (t < sp.wind) { squash = 1 - 0.12 * w; head = -0.6 * w; mouth = 1 + 0.6 * w; }
        else { head = 0.45; mouth = 1.2; }
        break;
      }
      case 'stagger':
        roll = Math.sin(t * 28) * 0.25;
        break;
      case 'dead':
        roll = Math.min(Math.PI / 2, t * 4);
        head = 0.8;
        break;
      default:
        break;
    }
    c.model.position.y += (hop - c.model.position.y) * 0.5;
    c.pot.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6);
    c.stem.rotation.x += (lean - c.stem.rotation.x) * 0.3;
    c.head.rotation.x += (head - c.head.rotation.x) * 0.35;
    c.mouth.scale.setScalar(mouth);
    this.inner.rotation.z += (roll - this.inner.rotation.z) * 0.3;
  }

  /** Koloss: the slab walks on two clockwork legs; the hammer arm rises and slams, the ring spins while it sprays. */
  private poseKoloss(e: Enemy, t: number, dt: number): void {
    const K = this.koloss!;
    const moving = e.state === 'chase' && e.speed > 0.15;
    const ph = this.time * (1.6 + e.speed * 1.6);
    K.legs.forEach((l, i) => {
      const q = ph + i * Math.PI;
      l.hip.rotation.x += ((moving ? -Math.sin(q) * 0.42 : 0) - l.hip.rotation.x) * 0.25;
      l.knee.rotation.x += ((moving ? Math.max(0, Math.sin(q - 1)) * 0.8 : 0) - l.knee.rotation.x) * 0.25;
    });
    K.slab.position.y = 1.9 + (moving ? Math.abs(Math.cos(ph)) * 0.08 : 0.02 * Math.sin(this.time * 1.5));
    let hammer = 0.1 * Math.sin(this.time * 1.2), compass = -0.1 + 0.08 * Math.sin(this.time * 0.9 + 1), tilt = 0;
    if (e.state === 'special' && e.sp) {
      const sp = e.sp, w = Math.min(1, t / sp.wind), g = Math.min(1, Math.max(0, (t - sp.wind) / sp.go));
      if (sp.kind === 'bossSlam') hammer = t < sp.wind ? -2.6 * w * w : lerp(-2.6, 0.35, Math.min(1, g * 3));
      else if (sp.kind === 'slabs') compass = -2.4 * (t < sp.wind ? w : 1 - g);
    } else if (e.state === 'dead') tilt = Math.min(0.5, t * 0.6);
    K.hammer.rotation.x += (hammer - K.hammer.rotation.x) * 0.35;
    K.compass.rotation.x += (compass - K.compass.rotation.x) * 0.25;
    this.spinRing += dt * ((e.spin ?? 0) > 0 ? 9 : 0.5);
    K.ring.rotation.z = this.spinRing;
    this.inner.rotation.x += (tilt - this.inner.rotation.x) * 0.2;
  }

  /**
   * Weltzeituhr: while it wakes the drum and orbit spin up, the body lifts off its base and the four legs
   * unfold to the ground; it then walks on them. Defeated, it walks back onto its base and settles,
   * exactly the landmark's rest pose (the landmark takes over when the body is removed).
   */
  private poseClock(e: Enemy, t: number, dt: number, alpha: number): void {
    const C = this.clock!, L = CLOCK_LEG;
    const wake = e.def.wake ?? 0;
    let lift = L.lift, legs = 1, drum = 0.25, orbit = 0.6;
    if ((e.wake ?? 0) > 0) {
      const k = 1 - (e.wake ?? 0) / Math.max(0.01, wake);
      lift = smooth(0.25, 0.85, k) * L.lift;
      legs = Math.max(0.01, smooth(0.1, 0.6, k));
      drum = 4 * k;
      orbit = 6 * k;
    } else if (e.state === 'dead') {
      const k = smooth(0, 1.8, t);
      lift = (1 - k) * L.lift;
      legs = Math.max(0.01, 1 - smooth(0.6, 1.8, t));
      drum = 2 * (1 - k);
      orbit = 3 * (1 - k);
      // Back onto its base (the landmark's place).
      if (e.home) {
        const x = lerp(lerp(e.px, e.x, alpha), e.home.x, k), z = lerp(lerp(e.pz, e.z, alpha), e.home.z, k);
        this.root.position.set(x, groundY(x, z), z);
        this.root.rotation.y = lerpAngle(this.root.rotation.y, 0, k);
      }
    } else if (e.state === 'special' && e.sp) {
      drum = e.sp.kind === 'sectors' ? 3 : e.sp.kind === 'hand' ? 1.5 : 0.8;
    }
    if ((e.spin ?? 0) > 0) orbit = 7;
    this.spinDrum += dt * drum;
    this.spinOrbit += dt * orbit;
    // Settled: drum and orbit turn back to the landmark's angles.
    if (e.state === 'dead') {
      const back = smooth(1, 2.2, t);
      C.rig.drum.rotation.y = this.spinDrum * (1 - back);
      C.rig.orbit.rotation.y = this.spinOrbit * (1 - back);
    } else {
      C.rig.drum.rotation.y = this.spinDrum;
      C.rig.orbit.rotation.y = this.spinOrbit;
    }
    const moving = e.state === 'chase' && e.speed > 0.15 && (e.wake ?? 0) <= 0;
    const ph = this.time * (1.8 + e.speed * 2);
    C.rig.body.position.y = lift + (moving ? 0.06 * Math.sin(ph * 2) : 0);
    C.legGroup.scale.setScalar(legs);
    C.legs.forEach((l, i) => {
      const q = ph + (i % 2) * Math.PI;
      const up = moving ? Math.max(0, Math.sin(q)) * 0.6 : 0;
      l.hip.rotation.y = l.angle + (moving ? Math.cos(q) * 0.18 : 0);
      // The foot target in the leg's plane, on the ground below the lifted body (the group scales with `legs`).
      reachLeg(l, (-(CLOCK.drum + C.rig.body.position.y) + up) / legs, (L.foot - L.hip) / Math.max(0.3, legs));
    });
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
