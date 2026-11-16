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
  /** `slash` sweeps a flat arc at chest height, `smash` comes down in front. */
  style: 'slash' | 'smash';
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

/** M7 first pass: retain the measured pipe clips; port the 2D class roles and finisher ratios.
 * No new animation claims: spear/thrower poses need custom clips in H1. */
export function weaponAttack(kind: WeaponKindId, id: AttackId): AttackDef {
  const a = { ...ATTACKS[id] };
  const fin = kind === 'sling' ? id === 'light4' : id === 'light3';
  if (kind === 'hammer') Object.assign(a, { style: 'smash', windup: .19, active: .12, recovery: .5,
    from: -55 * DEG, to: 55 * DEG, reach: fin ? 2.8 : 2.3, damage: fin ? 12 : 10,
    weight: 'heavy', knockback: fin ? 18 : 11, lunge: .3 });
  if (kind === 'spear') Object.assign(a, { from: -12 * DEG, to: 12 * DEG, width: 5 * DEG,
    reach: fin ? 4.2 : 3.5, damage: fin ? 16 : 10, lunge: fin ? 1.4 : .45 });
  if (kind === 'sling') { if(id==='light3')a.next='light4'; Object.assign(a, { windup: .1, active: .05, recovery: .3,
    damage: fin ? 16 : 10, lunge: 0 }); }
  if (kind === 'blade' && fin) a.damage = 16;
  return a;
}
