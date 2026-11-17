// Hero skeleton and budget contract (H1, docs/tasks/h1-hero.md). Read by tools/build-hero.mjs and
// src/render/hero-contract.test.ts. Plain data, erasable TypeScript only (Node runs it directly).

const SIDES = ['l', 'r'] as const;
const FINGERS = ['index', 'middle', 'pinky', 'ring', 'thumb'] as const;

/** Joints 0 to 64: the UAL skeleton of the source body, in skin order. Clips target only these. */
export const HERO_CORE_JOINTS: readonly string[] = [
  'root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head',
  ...SIDES.flatMap((s) => [
    `clavicle_${s}`, `upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`,
    ...FINGERS.flatMap((f) => [`${f}_01_${s}`, `${f}_02_${s}`, `${f}_03_${s}`, `${f}_04_leaf_${s}`]),
  ]),
  ...SIDES.flatMap((s) => [`thigh_${s}`, `calf_${s}`, `foot_${s}`, `ball_${s}`, `ball_leaf_${s}`]),
];

/** Joints appended after the core in this order (any may be absent), never targeted by a clip. */
export const HERO_EXTRA_JOINTS: readonly string[] = [
  'scarf_01', 'scarf_02', 'scarf_03', 'coat_bl_01', 'coat_bl_02', 'coat_br_01', 'coat_br_02',
];

/** Limits for any look; both profiles use the same meshes. */
export const HERO_BUDGET = {
  triangles: 32_000,
  skinnedDrawCalls: 9,
  joints: 72,
  fileBytes: 3_000_000,
} as const;

/** Body regions: `body_<region>` nodes in hero.glb, hidden under the pieces that cover them. */
export const HERO_REGIONS = ['head', 'torso', 'arms', 'hands', 'legs', 'feet'] as const;
export type BodyRegion = (typeof HERO_REGIONS)[number];

/** Region of a body vertex by its dominant joint. */
export function regionOf(joint: string): BodyRegion {
  if (/^(Head|neck)/.test(joint)) return 'head';
  if (/^(hand|index|middle|ring|pinky|thumb)/.test(joint)) return 'hands';
  if (/^(upperarm|lowerarm)/.test(joint)) return 'arms';
  if (/^(foot|ball)/.test(joint)) return 'feet';
  if (/^(pelvis|thigh|calf)/.test(joint)) return 'legs';
  return 'torso';
}

/** Clothing pieces in hero.glb and the body regions each hides (step 4 moves this to hero-look.ts). */
export const HERO_PIECES: Readonly<Record<string, readonly BodyRegion[]>> = {
  a_mantel: ['torso', 'arms', 'legs'],
  f_stiefel: ['feet'],
  g_handsch: ['hands'],
};

/** The look shown until equipment drives it (step 4): long coat, boots, gloves. */
export const HERO_DEFAULT_LOOK: readonly string[] = ['a_mantel', 'f_stiefel', 'g_handsch'];
