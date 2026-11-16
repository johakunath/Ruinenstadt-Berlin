// Combat tuning. Start values from BACKLOG #35 (Combat flow) in the 2D repo; tuned by playing in gate 2.
// All times in seconds, distances in meters, angles in radians relative to the facing direction
// (negative = the character's right, positive = left).
import { DEG } from '../sim/math';
import type { WeaponKindId } from './items';

export type HitWeight = 'light' | 'heavy';
export type AttackId = 'light1' | 'light2' | 'light3' | 'light4' | 'dash';

export interface AttackDef {
  id: AttackId;
  /**
   * Animation clip and where the sim phases sit inside it (measured with tools/clip-swing.mjs):
   * the wind-up plays clipStart → clipSwing, the active frames clipSwing → clipHit, then the clip
   * runs on at normal speed and hands over to `rec` when it ends.
   */
  clip: string;
  clipStart: number;
  clipSwing: number;
  clipHit: number;
  /** Recovery clip that returns to the guard pose, or null when the clip contains it. */
  rec: string | null;
  /** `slash` sweeps a flat arc at chest height, `smash` comes down in front, `thrust` stabs along a line, `throw` releases a shot. */
  style: 'slash' | 'smash' | 'thrust' | 'throw';
  /** Time before the first active frame. Light ≤ 0.10, heavy ≤ 0.20. */
  windup: number;
  /** Active frames: the weapon arc sweeps `from` → `to` over this time. */
  active: number;
  /** Follow-through. Dodge and the next attack cancel it. */
  recovery: number;
  from: number;
  to: number;
  /** Half thickness of the weapon in the sweep direction. */
  width: number;
  inner: number;
  reach: number;
  damage: number;
  knockback: number;
  weight: HitWeight;
  /** Forward step during wind-up and active frames. */
  lunge: number;
  /** Next attack in the chain, or null when the chain ends. */
  next: AttackId | null;
}

export const ATTACKS: Record<AttackId, AttackDef> = {
  light1: {
    id: 'light1', clip: 'Sword_Regular_A', clipStart: 0.1, clipSwing: 0.2, clipHit: 0.275, rec: 'Sword_Regular_A_Rec', style: 'slash',
    windup: 0.08, active: 0.1, recovery: 0.26,
    from: -75 * DEG, to: 55 * DEG, width: 8 * DEG, inner: 0.2, reach: 2.15,
    damage: 10, knockback: 5, weight: 'light', lunge: 0.55, next: 'light2',
  },
  light2: {
    id: 'light2', clip: 'Sword_Regular_B', clipStart: 0.1, clipSwing: 0.2, clipHit: 0.285, rec: 'Sword_Regular_B_Rec', style: 'slash',
    windup: 0.08, active: 0.1, recovery: 0.28,
    from: 70 * DEG, to: -60 * DEG, width: 8 * DEG, inner: 0.2, reach: 2.15,
    damage: 10, knockback: 5, weight: 'light', lunge: 0.55, next: 'light3',
  },
  // Finisher: the overhead smash at the end of the clip. A frontal cone instead of a wide slash.
  light3: {
    id: 'light3', clip: 'Sword_Regular_C', clipStart: 0.42, clipSwing: 0.6, clipHit: 0.71, rec: null, style: 'smash',
    windup: 0.17, active: 0.08, recovery: 0.45,
    from: -42 * DEG, to: 42 * DEG, width: 8 * DEG, inner: 0.2, reach: 2.6,
    damage: 18, knockback: 10, weight: 'heavy', lunge: 0.9, next: null,
  },
  light4: {
    id:'light4', clip:'Sword_Regular_B', clipStart:.1, clipSwing:.2, clipHit:.285, rec:'Sword_Regular_B_Rec',style:'slash',
    windup:.1,active:.05,recovery:.3,from:-.2,to:.2,width:.1,inner:.2,reach:2.15,
    damage:16,knockback:9,weight:'heavy',lunge:0,next:null,
  },
  dash: {
    id: 'dash', clip: 'Sword_Dash', clipStart: 0.18, clipSwing: 0.265, clipHit: 0.345, rec: null, style: 'slash',
    windup: 0.05, active: 0.12, recovery: 0.3,
    from: 85 * DEG, to: -85 * DEG, width: 10 * DEG, inner: 0.2, reach: 2.6,
    damage: 15, knockback: 9, weight: 'heavy', lunge: 1.8, next: 'light2',
  },
};

/** Per hit weight: freeze, camera shake (meters at the look-at point), rumble, stagger. */
export const HIT_FEEL: Record<HitWeight, { hitstop: number; shake: number; rumble: number; rumbleMs: number; stagger: number }> = {
  light: { hitstop: 0.045, shake: 0.07, rumble: 0.45, rumbleMs: 40, stagger: 0.28 },
  heavy: { hitstop: 0.1, shake: 0.16, rumble: 0.9, rumbleMs: 80, stagger: 0.5 },
};

export const PLAYER = {
  radius: 0.38,
  maxHp: 100,
  speed: 6.2,
  /** Seconds to reach full speed and to stop. #35: ramp ≤ 50 ms. */
  accelTime: 0.05,
  /** Radians per second while running; attacks snap instantly. */
  turnRate: 22,
  /** Attack pressed this long after a chain attack ended continues the chain. */
  comboGrace: 0.45,
  dodge: {
    distance: 3.4,
    duration: 0.24,
    iframes: 0.2,
    cooldown: 0.28,
    /** Attack during the dodge (from this fraction on) or shortly after it = dash strike. */
    strikeFrom: 0.55,
    strikeGrace: 0.18,
  },
  /** Flinch after taking a hit; dodge cancels it. */
  hitStun: 0.22,
  /** No second hit for this long after one landed. */
  hitGrace: 0.55,
  /** No hit takes more than this share of max HP (rule carried over from the 2D game). */
  maxHitShare: 0.45,
  /** Soft lock-on for gamepad and touch. */
  aimAssistCone: 25 * DEG,
  aimAssistRange: 4.5,
  /** Extra kill hitstop and shake. */
  killHitstop: 0.03,
  hitByEnemyHitstop: 0.06,
} as const;

/** Input buffer length in seconds (#35: 150 to 200 ms). */
export const INPUT_BUFFER = 0.18;

/**
 * M7: every weapon kind has its own chain (clips, arcs, timing). Roles and ratios are the 2D `KIND`
 * table and `attack()`: Klinge fast and wide, Hammer slow, wide, heavy and stunning, Speer long and
 * narrow with a lunging finisher, Werfer shoots. Finishers: ×1.6 damage (Hammer ×1.2 plus a shock ring),
 * ×1.7 knockback. Weapon damage itself comes from the item (`WEAPON_KINDS.damageFactor`).
 * Clip times are measured with `tools/clip-sheet.mjs` and `tools/clip-swing.mjs`.
 */
const base = ATTACKS;
const WEAPON_ATTACKS: Record<WeaponKindId, Record<AttackId, AttackDef>> = {
  blade: { ...base, light3: { ...base.light3, damage: 16 } },
  hammer: {
    // Sword_Heavy_Combo: two wide swings, then a leaping overhead slam.
    light1: { ...base.light1, clip: 'Sword_Heavy_Combo', clipStart: 0.13, clipSwing: 0.3, clipHit: 0.52, rec: null, style: 'slash',
      windup: 0.2, active: 0.13, recovery: 0.42, from: -90 * DEG, to: 80 * DEG, width: 10 * DEG, reach: 2.47, damage: 10, knockback: 9, weight: 'heavy', lunge: 0.35, next: 'light2' },
    light2: { ...base.light2, clip: 'Sword_Heavy_Combo', clipStart: 0.8, clipSwing: 0.95, clipHit: 1.14, rec: null, style: 'slash',
      windup: 0.2, active: 0.13, recovery: 0.42, from: 90 * DEG, to: -80 * DEG, width: 10 * DEG, reach: 2.47, damage: 10, knockback: 9, weight: 'heavy', lunge: 0.35, next: 'light3' },
    light3: { ...base.light3, clip: 'Sword_Heavy_Combo', clipStart: 2.28, clipSwing: 2.52, clipHit: 2.67, rec: null, style: 'smash',
      windup: 0.26, active: 0.1, recovery: 0.55, from: -50 * DEG, to: 50 * DEG, width: 10 * DEG, reach: 2.9, damage: 12, knockback: 15, weight: 'heavy', lunge: 1.1, next: null },
    light4: { ...base.light4 },
    dash: { ...base.dash, damage: 15, knockback: 12, reach: 2.7 },
  },
  spear: {
    // Punch_Cross is a straight thrust; Melee_Hook a turning low lunge.
    light1: { ...base.light1, clip: 'Punch_Cross', clipStart: 0.1, clipSwing: 0.19, clipHit: 0.28, rec: null, style: 'thrust',
      windup: 0.1, active: 0.09, recovery: 0.3, from: -8 * DEG, to: 8 * DEG, width: 11 * DEG, reach: 3.27, damage: 10, knockback: 6.2, lunge: 0.45, next: 'light2' },
    light2: { ...base.light2, clip: 'Punch_Cross', clipStart: 0.14, clipSwing: 0.2, clipHit: 0.28, rec: null, style: 'thrust',
      windup: 0.09, active: 0.09, recovery: 0.3, from: 8 * DEG, to: -8 * DEG, width: 11 * DEG, reach: 3.27, damage: 10, knockback: 6.2, lunge: 0.45, next: 'light3' },
    light3: { ...base.light3, clip: 'Melee_Hook', clipStart: 0.06, clipSwing: 0.2, clipHit: 0.29, rec: null, style: 'thrust',
      windup: 0.16, active: 0.1, recovery: 0.42, from: -9 * DEG, to: 9 * DEG, width: 12 * DEG, reach: 3.9, damage: 16, knockback: 10.5, weight: 'heavy', lunge: 2, next: null },
    light4: { ...base.light4 },
    dash: { ...base.dash, clip: 'Melee_Hook', clipStart: 0.1, clipSwing: 0.2, clipHit: 0.29, style: 'thrust',
      from: -12 * DEG, to: 12 * DEG, width: 12 * DEG, reach: 3.9, damage: 15, lunge: 2.2 },
  },
  sling: (() => {
    // OverhandThrow: the shot leaves at the end of the wind-up. Fourth shot is the finisher.
    const shot = (id: AttackId, next: AttackId | null, fin = false): AttackDef => ({ ...base.light1, id, clip: 'OverhandThrow', clipStart: fin ? 0.14 : 0.2, clipSwing: 0.33, clipHit: 0.4, rec: null, style: 'throw',
      windup: fin ? 0.14 : 0.1, active: 0.05, recovery: fin ? 0.34 : 0.27, from: -0.2, to: 0.2, width: 0.1, reach: 2.15, damage: fin ? 16 : 10, knockback: 2.5, weight: fin ? 'heavy' : 'light', lunge: 0, next });
    return { light1: shot('light1', 'light2'), light2: shot('light2', 'light3'), light3: shot('light3', 'light4'), light4: shot('light4', null, true), dash: { ...shot('dash', 'light2'), damage: 15 } };
  })(),
};

/** The last attack of a weapon's chain (2D: every third swing, every fourth shot). */
export const finisherOf = (kind: WeaponKindId): AttackId => (kind === 'sling' ? 'light4' : 'light3');

export function weaponAttack(kind: WeaponKindId, id: AttackId): AttackDef {
  return { ...WEAPON_ATTACKS[kind][id] };
}

/** Every attack shape, for the weapon smear geometry. */
export function allWeaponAttacks(): Array<{ kind: WeaponKindId; def: AttackDef }> {
  return (Object.keys(WEAPON_ATTACKS) as WeaponKindId[]).flatMap((kind) => Object.values(WEAPON_ATTACKS[kind]).map((def) => ({ kind, def })));
}

/** Per weapon (2D `KIND`, `attack()`): stun on every hit, finisher extras, shots. Distances in meters. */
export const WEAPON = {
  hammer: { stun: 0.6, shock: { ahead: 40 / 30, radius: 95 / 30, damage: 0.7, stun: 0.5 }, dampf: { ahead: 46 / 30, radius: 75 / 30, damage: 0.5 } },
  sling: { speed: 560 / 30, life: 0.7, finLife: 0.9, finSpeed: 1.3, finPierce: 3, schrot: { spread: 0.18, damage: 0.55, life: 0.42, finLife: 0.55, finPierce: 2 } },
  spear: { spiess: { speed: 640 / 30, life: 0.6, damage: 0.9, pierce: 4 } },
  /** G1 Umbau cards (3D additions). */
  umbau: {
    doppel: 0.6, sturmLunge: 1, bebenRadius: 2, bebenStun: 1, wurf: { damage: 1.5, pierce: 3, speed: 16, life: 0.7 },
    fege: { half: 60 * DEG, reach: 0.8 }, lanze: { damage: 2, reach: 1.5 }, quer: 0.8, salve: { count: 5, spread: 0.16, damage: 0.6 },
  },
  /** Gegengewicht: sure crit, double knockback, short stun. */
  wucht: { stun: 0.35, knock: 2 },
  finisherKnock: 1.7,
} as const;
