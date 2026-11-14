// Enemy archetypes. Gate 1 uses one CC0 body in three sizes; gate 2 adds a custom Köpenick ghoul.
import { DEG } from '../sim/math';

export type EnemyKind = 'walker' | 'runner' | 'brute';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  /** Body circle radius on the ground plane. */
  radius: number;
  /** Visual scale of the 1.8 m base model. */
  scale: number;
  hp: number;
  speed: number;
  /** Starts the wind-up when the player is this close (center to center). */
  attackRange: number;
  /** Readable telegraph before the strike. */
  windup: number;
  active: number;
  recovery: number;
  /** Strike arc in front of the enemy. */
  reach: number;
  halfAngle: number;
  damage: number;
  /** Knockback taken is multiplied by this (heavier = less). */
  knockbackTaken: number;
  /** Light hits do not interrupt when true (poise). */
  poise: boolean;
  /** Relative spawn weight. */
  weight: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  walker: {
    kind: 'walker', name: 'Schlurfer', radius: 0.4, scale: 1, hp: 30, speed: 2.1,
    attackRange: 1.45, windup: 0.55, active: 0.12, recovery: 0.7,
    reach: 1.7, halfAngle: 50 * DEG, damage: 12, knockbackTaken: 1, poise: false, weight: 6,
  },
  runner: {
    kind: 'runner', name: 'Hetzer', radius: 0.34, scale: 0.9, hp: 18, speed: 3.6,
    attackRange: 1.35, windup: 0.4, active: 0.1, recovery: 0.6,
    reach: 1.55, halfAngle: 45 * DEG, damage: 8, knockbackTaken: 1.25, poise: false, weight: 3,
  },
  brute: {
    kind: 'brute', name: 'Brocken', radius: 0.62, scale: 1.3, hp: 90, speed: 1.6,
    attackRange: 1.9, windup: 0.85, active: 0.14, recovery: 0.9,
    reach: 2.3, halfAngle: 60 * DEG, damage: 26, knockbackTaken: 0.45, poise: true, weight: 1,
  },
};

export const SPAWN = {
  /** Enemies alive at the start and the cap it grows to. */
  startAlive: 6,
  maxAlive: 14,
  /** One more enemy alive per this many kills. */
  killsPerStep: 4,
  interval: 0.5,
  /** Dead bodies stay this long for the death animation. */
  corpseTime: 2.6,
} as const;
