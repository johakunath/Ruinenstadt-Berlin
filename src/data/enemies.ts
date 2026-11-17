// Enemy roster (M12). Roles, ratios and resistances are the 2D game's (`mkEnemy`, `RES`, elite
// tactics and boss patterns in js/update.js); bodies, reach and timing are rebuilt for 3D.
// Every type needs a different answer: Schlurfer crowd, Hetzer rush, Brocken slam a marked circle,
// Speier keep their distance and spit, Raptoren pounce along a line, Krähen circle and dive.
import { DEG } from '../sim/math';
import type { EnemyKind as ResKind } from './items';

export type BossKind = 'feldwebel' | 'waechter' | 'rex' | 'hauptmann' | 'schaffner';
export type EnemyKind = 'walker' | 'runner' | 'brute' | 'spitter' | 'raptor' | 'crow' | BossKind;
/** Which model and clip set draws the body (`src/render/creatures.ts`). */
export type BodyKind = 'zombie' | 'raptor' | 'rex' | 'crow';
/** How it moves and which special it uses (`src/sim/ai.ts`). */
export type AiKind = 'melee' | 'brute' | 'spitter' | 'pouncer' | 'crow' | BossKind;
/** Elite modifiers (2D `EMN`): each adds a telegraphed special and a punish window after it. */
export type EliteMod = 'flink' | 'brennend' | 'spaltend' | 'gepanzert';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  body: BodyKind;
  ai: AiKind;
  /** Row of the 2D resistance table (`ENEMY_RESISTANCES`); `none`: every element counts once. */
  res: ResKind | 'none';
  /** Body circle radius on the ground plane. */
  radius: number;
  /** Visual scale of the base model. */
  scale: number;
  hp: number;
  speed: number;
  /** Starts the wind-up when the player is this close (center to center). 0: no melee strike. */
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
  /** Relative spawn weight on arena levels (0 = only placed by an encounter). */
  weight: number;
  /** Shown with a health bar. */
  boss?: boolean;
  /** Ignores walls, water and other bodies. */
  fly?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  walker: {
    kind: 'walker', name: 'Schlurfer', body: 'zombie', ai: 'melee', res: 'ghoul', radius: 0.4, scale: 1, hp: 30, speed: 2.1,
    attackRange: 1.45, windup: 0.55, active: 0.12, recovery: 0.7,
    reach: 1.7, halfAngle: 50 * DEG, damage: 12, knockbackTaken: 1, poise: false, weight: 6,
  },
  runner: {
    kind: 'runner', name: 'Hetzer', body: 'zombie', ai: 'melee', res: 'ghoul', radius: 0.34, scale: 0.9, hp: 18, speed: 3.6,
    attackRange: 1.35, windup: 0.4, active: 0.1, recovery: 0.6,
    reach: 1.55, halfAngle: 45 * DEG, damage: 8, knockbackTaken: 1.25, poise: false, weight: 3,
  },
  brute: {
    kind: 'brute', name: 'Brocken', body: 'zombie', ai: 'brute', res: 'brute', radius: 0.62, scale: 1.3, hp: 90, speed: 1.6,
    attackRange: 1.9, windup: 0.85, active: 0.14, recovery: 0.9,
    reach: 2.3, halfAngle: 60 * DEG, damage: 26, knockbackTaken: 0.45, poise: true, weight: 1,
  },
  // 2D Speier: backs off, strafes, spits. Weak in melee and to shock; acid does nothing.
  spitter: {
    kind: 'spitter', name: 'Speier', body: 'zombie', ai: 'spitter', res: 'spitter', radius: 0.36, scale: 0.95, hp: 24, speed: 2.2,
    attackRange: 0, windup: 0.5, active: 0.1, recovery: 0.6,
    reach: 1.4, halfAngle: 40 * DEG, damage: 11, knockbackTaken: 1.1, poise: false, weight: 0,
  },
  // 2D Raser on the Köpenick board's skeletal raptor: stalks, then pounces along a marked line.
  raptor: {
    kind: 'raptor', name: 'Raptor', body: 'raptor', ai: 'pouncer', res: 'raser', radius: 0.45, scale: 1, hp: 38, speed: 2.6,
    attackRange: 1.5, windup: 0.4, active: 0.1, recovery: 0.6,
    reach: 1.8, halfAngle: 40 * DEG, damage: 12, knockbackTaken: 0.9, poise: false, weight: 0,
  },
  // 2D Krähe: circles out of reach, dives, then sits dazed for a moment.
  crow: {
    kind: 'crow', name: 'Krähe', body: 'crow', ai: 'crow', res: 'crow', radius: 0.3, scale: 1, hp: 14, speed: 5,
    attackRange: 0, windup: 0.35, active: 0.1, recovery: 0.5,
    reach: 1.2, halfAngle: 40 * DEG, damage: 10, knockbackTaken: 1.4, poise: false, weight: 0, fly: true,
  },
  // Zone bosses.
  feldwebel: {
    kind: 'feldwebel', name: 'Der Feldwebel', body: 'zombie', ai: 'feldwebel', res: 'koloss', radius: 0.7, scale: 1.45, hp: 900, speed: 2.5,
    attackRange: 2.1, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 2.6, halfAngle: 65 * DEG, damage: 24, knockbackTaken: 0.3, poise: true, weight: 0, boss: true,
  },
  waechter: {
    kind: 'waechter', name: 'Der Turmwächter', body: 'zombie', ai: 'waechter', res: 'turm', radius: 0.85, scale: 1.75, hp: 2000, speed: 1.7,
    attackRange: 2.4, windup: 0.85, active: 0.16, recovery: 0.85,
    reach: 3.0, halfAngle: 70 * DEG, damage: 30, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
  rex: {
    kind: 'rex', name: 'Der Rex', body: 'rex', ai: 'rex', res: 'brand', radius: 1.25, scale: 1, hp: 3600, speed: 2.7,
    attackRange: 3.1, windup: 0.75, active: 0.16, recovery: 0.9,
    reach: 3.8, halfAngle: 50 * DEG, damage: 34, knockbackTaken: 0.1, poise: true, weight: 0, boss: true,
  },
  hauptmann: {
    kind: 'hauptmann', name: 'Hauptmann von Köpenick', body: 'zombie', ai: 'hauptmann', res: 'hauptmann', radius: 0.8, scale: 1.6, hp: 4400, speed: 2.9,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.7,
    reach: 2.8, halfAngle: 75 * DEG, damage: 34, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
  },
  // M19 tunnel boss (2D: Der Schaffner at the generator). Charges along the tracks like a train and
  // whistles up passengers: the Feldwebel's pattern (charge, call men), tunnel life +25 %.
  schaffner: {
    kind: 'schaffner', name: 'Der Schaffner', body: 'zombie', ai: 'feldwebel', res: 'koloss', radius: 0.75, scale: 1.55, hp: 2800, speed: 2.7,
    attackRange: 2.2, windup: 0.65, active: 0.14, recovery: 0.75,
    reach: 2.7, halfAngle: 70 * DEG, damage: 30, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
};

const PX = 1 / 30;

/** Elite modifiers: name, ring color, card text (2D `EMN`, `EMC`, `EDESC`). */
export const ELITES: Record<EliteMod, { name: string; color: number; hint: string }> = {
  flink: { name: 'Flink', color: 0x7dd3ff, hint: 'Springt dich an, danach kurz offen.' },
  brennend: { name: 'Brennend', color: 0xff6a2a, hint: 'Feuerspur und Flammenring, danach kurz offen.' },
  spaltend: { name: 'Spaltend', color: 0x97c459, hint: 'Drei Säurekugeln. Zerfällt beim Tod.' },
  gepanzert: { name: 'Gepanzert', color: 0xd6cfc0, hint: 'Halber Schaden, bis sein Stampfer verpufft.' },
};
export const ELITE_MODS = Object.keys(ELITES) as EliteMod[];

/**
 * Specials and what they put into the world. Distances are the 2D pixels at 30 px per meter,
 * times the 2D seconds. `floor`: a telegraphed hit takes at least this share of max life
 * (2D `bigHit`), so dodging matters at any gear level; the 45 % cap still holds.
 */
export const THREAT = {
  /** Punish window after a special: the body stands open and takes more damage (2D `TACO`, +30 %). */
  openBonus: 1.3,
  armored: 0.5,
  eliteHp: 2.6,
  eliteSpeed: 1.55,
  buffSpeed: 1.35,
  spit: { near: 200 * PX, far: 290 * PX, range: 440 * PX, every: [2.3, 3.1], wind: 0.4, speed: 210 * PX, life: 3.5, radius: 0.22 },
  fan: { range: 380 * PX, wind: 0.6, speed: 230 * PX, spread: 0.3, open: 1 },
  pounce: { range: 260 * PX, every: 2.4, wind: 0.6, time: 0.45, speed: 520 * PX, damage: 20, open: 0.8 },
  lunge: { range: 260 * PX, wind: 0.7, time: 0.4, speed: 480 * PX, damage: 1.3, open: 1.2 },
  dive: { orbitX: 150 * PX, orbitZ: 110 * PX, orbitSpeed: 1.5, range: 280 * PX, every: [2.5, 3.8], wind: 0.35, time: 0.6, speed: 380 * PX, rest: 1.3, restSpeed: 40 * PX },
  slam: { range: 220 * PX, every: [4.5, 6.5], first: [2, 4], wind: 0.95, radius: 60 * PX, damage: 1, floor: 0.2, open: 1 },
  stomp: { radius: 70 * PX, damage: 1.3, open: 1.6 },
  flame: { range: 140 * PX, wind: 0.9, radius: 95 * PX, damage: 1.2, floor: 0.2, open: 1, trailEvery: 0.45, trailRadius: 20 * PX, trailTime: 3.5, trailDamage: 0.45 },
  split: { count: 2, hp: 0.4, scale: 0.7 },
  hazard: { tick: 0.5 },
  /** Chance of an elite per normal spawn in wave g (2D: min(25 %, 2.2 % per wave pair), from the third wave). */
  eliteChance: (g: number): number => (g < 3 ? 0 : Math.min(0.25, 0.011 * (g + 1))),
} as const;

/** Boss patterns (2D boss block in js/update.js). Rage below half life: faster and quicker cooldowns. */
export const BOSS = {
  rageAt: 0.5, rageSpeed: 1.3, rageRate: 1.35,
  /** Marked circle on the hero (every boss that slams). */
  slam: { range: 320 * PX, wind: 0.95, radius: 96 * PX, damage: 1.3, floor: 0.25 },
  /** Ring of shots around the boss. */
  ring: { speed: 165 * PX, damage: 0.6, life: 3.5, radius: 0.28, wind: 0.6 },
  /** Marked line, then a rush (2D Zitadellenritter). */
  charge: { range: 420 * PX, wind: 0.75, time: 0.6, speed: 600 * PX, damage: 1.1, floor: 0.25, open: 1.3 },
  /** Expanding rings that hurt unless the hero rolls through (2D bass waves). */
  roar: { speed: 300 * PX, max: 340 * PX, gap: 150 * PX, damage: 0.7, floor: 0.18, width: 14 * PX, wind: 0.8, buff: 3, buffRange: 220 * PX },
  /** One circle on the hero, more around (2D Fliegerkönig). */
  barrage: { wind: 1.1, step: 0.12, radius: 55 * PX, spreadX: 150 * PX, spreadZ: 130 * PX, damage: 0.9, floor: 0.2 },
  summon: { wind: 0.7, spread: 60 * PX, maxAdds: 8 },
  feldwebel: { charge: [5, 7], summon: 9, adds: 3 },
  waechter: { barrage: 5, ring: 7.5, slam: 4.5, shots: 12, extra: 4 },
  rex: { charge: [4.2, 3], roar: 8, tail: 5, tailRadius: 110 * PX, tailWind: 0.8, raptorsEvery: 3 },
  hauptmann: { slam: 3.6, ring: 5.5, summon: 9, adds: 3, shots: 16 },
} as const;

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
