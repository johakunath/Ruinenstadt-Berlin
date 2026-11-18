// Enemy roster (M12). Roles, ratios and resistances are the 2D game's (`mkEnemy`, `RES`, elite
// tactics and boss patterns in js/update.js); bodies, reach and timing are rebuilt for 3D.
// Every type needs a different answer: Schlurfer crowd, Hetzer rush, Brocken slam a marked circle,
// Speier keep their distance and spit, Raptoren pounce along a line, Krähen circle and dive.
// M12b (Xhain): Ratten come in packs of five and zig-zag in; four new bosses from existing blocks.
// M12c (Mitte, `docs/tasks/m12c-mitte-enemies.md`): Kabelghule leap along a line, Boxenköpfe send bass
// rings and drive the others on (at most two alive), Drohnen circle and dive; four bosses.
import { DEG } from '../sim/math';
import type { EnemyKind as ResKind } from './items';

export type BossKind = 'feldwebel' | 'waechter' | 'rex' | 'hauptmann' | 'schaffner' | 'grenzer' | 'brandmeister' | 'rattenmutter' | 'spreehexe'
  | 'tuersteher' | 'wachdrohne' | 'dirigent' | 'bassprediger';
export type EnemyKind = 'walker' | 'runner' | 'brute' | 'spitter' | 'raptor' | 'crow' | 'rat' | 'kabel' | 'bass' | 'drone' | BossKind;
/** Which model and clip set draws the body (`src/render/creatures.ts`). */
export type BodyKind = 'zombie' | 'raptor' | 'rex' | 'crow' | 'rat' | 'drone';
/** How it moves and which special it uses (`src/sim/ai.ts`). */
export type AiKind = 'melee' | 'brute' | 'spitter' | 'pouncer' | 'crow' | 'rat' | 'bass' | BossKind;
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
  /**
   * Comes as a pack of this many (2D rat: one spawn plus four next to it). A wave spawns the whole
   * pack for one unit of its count (`spawnPack` in `src/sim/enemies.ts`). Pack kinds never turn elite.
   */
  pack?: number;
  /** M12c: at most this many alive at once (the director's pick, boss calls and `?spawn` honour it). */
  cap?: number;
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
  // 2D Ratte (6 px, 6 life, 118-140 px/s, bite 3): the ghoul-to-Schlurfer ratios (life ×1.5,
  // damage ×1.7, speed ×0.027). Zig-zags in, bites weakly, always five of them.
  rat: {
    kind: 'rat', name: 'Ratte', body: 'rat', ai: 'rat', res: 'rat', radius: 0.24, scale: 1, hp: 9, speed: 3.5,
    attackRange: 0.95, windup: 0.3, active: 0.08, recovery: 0.45,
    reach: 1.05, halfAngle: 45 * DEG, damage: 5, knockbackTaken: 1.6, poise: false, weight: 0, pack: 5,
  },
  // M12c Mitte. 2D kabel (r 9 px, life 15, 92-104 px/s, hit 6) on the ghoul ratios: thin, fast, leaps
  // along a marked line (`THREAT.leap`). Fire burns it well, shock barely touches it.
  kabel: {
    kind: 'kabel', name: 'Kabelghul', body: 'zombie', ai: 'pouncer', res: 'kabel', radius: 0.3, scale: 0.92, hp: 22, speed: 3.3,
    attackRange: 1.3, windup: 0.4, active: 0.1, recovery: 0.55,
    reach: 1.5, halfAngle: 45 * DEG, damage: 10, knockbackTaken: 1.3, poise: false, weight: 0,
  },
  // 2D bass (r 15 px, life 62, 44 px/s, hit 13) on the brute ratios: a speaker head that strikes like a
  // Brocken without the slam and sends bass rings (`THREAT.bass`) that drive the others on. Two alive at most.
  bass: {
    kind: 'bass', name: 'Boxenkopf', body: 'zombie', ai: 'bass', res: 'bass', radius: 0.5, scale: 1.15, hp: 75, speed: 1.4,
    attackRange: 1.7, windup: 0.7, active: 0.12, recovery: 0.8,
    reach: 2.0, halfAngle: 55 * DEG, damage: 19, knockbackTaken: 0.6, poise: true, weight: 0, cap: 2,
  },
  // New for 3D (2D only as the power „Drohnenschwarm“): the Krähe's brain on a drone body; dazed it sinks and sparks.
  drone: {
    kind: 'drone', name: 'Drohne', body: 'drone', ai: 'crow', res: 'crow', radius: 0.3, scale: 1.3, hp: 14, speed: 5,
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
  // M12b Xhain (1981). Zone 1: the GDR border guard from the watchtower, the weakest. Shoots from a
  // distance, calls runners. Resistances of the 2D Volkseigener Koloss (GDR row: weak to shock).
  grenzer: {
    kind: 'grenzer', name: 'Der Grenzer', body: 'zombie', ai: 'grenzer', res: 'volk', radius: 0.7, scale: 1.45, hp: 950, speed: 2.3,
    attackRange: 2.0, windup: 0.65, active: 0.14, recovery: 0.8,
    reach: 2.4, halfAngle: 60 * DEG, damage: 24, knockbackTaken: 0.3, poise: true, weight: 0, boss: true,
  },
  // Zone 2 (Mariannenplatz): the riots, burning barricades. Molotovs, fire ring, flame burst (2D `brand`).
  brandmeister: {
    kind: 'brandmeister', name: 'Der Brandmeister', body: 'zombie', ai: 'brandmeister', res: 'brand', radius: 0.78, scale: 1.55, hp: 2100, speed: 2.4,
    attackRange: 2.3, windup: 0.75, active: 0.14, recovery: 0.85,
    reach: 2.8, halfAngle: 70 * DEG, damage: 30, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
  // Zone 3 (Kotti, Görli): 2D Rattenmutter (v 5). Rat packs, acid trail, slam.
  rattenmutter: {
    kind: 'rattenmutter', name: 'Die Rattenmutter', body: 'zombie', ai: 'rattenmutter', res: 'ratten', radius: 0.85, scale: 1.5, hp: 3200, speed: 2.2,
    attackRange: 2.3, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 2.8, halfAngle: 70 * DEG, damage: 32, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
  },
  // District boss on the Oberbaumbrücke: 2D Spreehexe (v 1). Hauptmann tier of life and damage.
  spreehexe: {
    kind: 'spreehexe', name: 'Die Spreehexe', body: 'zombie', ai: 'spreehexe', res: 'hexe', radius: 0.8, scale: 1.7, hp: 4400, speed: 2.6,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.7,
    reach: 2.8, halfAngle: 70 * DEG, damage: 34, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
  },
  // M12c Mitte (2089). Zone 0, Pariser Platz: a Kabelbrocken in a bomber jacket holds the Tor like a club
  // door („Kein Einlass“). Shoves, grabs and holds, calls Kabelghule from the guest list.
  tuersteher: {
    kind: 'tuersteher', name: 'Der Türsteher', body: 'zombie', ai: 'tuersteher', res: 'koloss', radius: 0.8, scale: 1.6, hp: 1000, speed: 2.4,
    attackRange: 2.1, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 2.6, halfAngle: 65 * DEG, damage: 26, knockbackTaken: 0.25, poise: true, weight: 0, boss: true,
  },
  // Zone 1, Kanzleramt: a flat surveillance drone. Searchlight, laser volleys, drone swarms; lands to recharge.
  wachdrohne: {
    kind: 'wachdrohne', name: 'Die Wachdrohne', body: 'drone', ai: 'wachdrohne', res: 'ritter', radius: 0.9, scale: 1, hp: 2200, speed: 2.2,
    attackRange: 0, windup: 0.6, active: 0.12, recovery: 0.8,
    reach: 2.4, halfAngle: 60 * DEG, damage: 28, knockbackTaken: 0.2, poise: true, weight: 0, boss: true, fly: true,
  },
  // Zone 2, Neuer See (mini-boss): a ghoul in a torn tailcoat on the band stand; beat rings, the Boxenköpfe follow him.
  dirigent: {
    kind: 'dirigent', name: 'Der Dirigent', body: 'zombie', ai: 'dirigent', res: 'bass', radius: 0.7, scale: 1.4, hp: 1400, speed: 2.2,
    attackRange: 2.1, windup: 0.65, active: 0.14, recovery: 0.8,
    reach: 2.6, halfAngle: 65 * DEG, damage: 24, knockbackTaken: 0.3, poise: true, weight: 0, boss: true,
  },
  // District boss on the Sony Center stage: 2D Bassprediger (v 2). Shock charge, bass sermons, a congregation.
  bassprediger: {
    kind: 'bassprediger', name: 'Der Bassprediger', body: 'zombie', ai: 'bassprediger', res: 'bass', radius: 0.85, scale: 1.7, hp: 4400, speed: 2.8,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.7,
    reach: 2.8, halfAngle: 70 * DEG, damage: 34, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
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
  /**
   * M12c Kabelghul (2D kabel): with a clear line, 0.4 s marked, 0.3 s at 440 px/s (4.4 m), hit ×1, open 0.5 s.
   * Leaps from 5 m, not the 2D 200 px (6.7 m): 2D hurt by touch after the leap, here the leap itself hits and
   * from 6.7 m it would land 2 m short of a hero who stands still.
   */
  leap: { range: 5, every: [2.2, 3], first: [1, 2], wind: 0.4, time: 0.3, speed: 440 * PX, damage: 1, open: 0.5 },
  /**
   * M12c Boxenkopf (2D bass): within 9 m a wind-up of 0.8 s, then one ring 12 → 270 px at 0.9 of its hit
   * (no floor); bodies within 220 px are driven on for 3 s; open 1.1 s. First after 2-4 s, then every 5-6.5 s (2D).
   */
  bass: { range: 9, first: [2, 4], every: [5, 6.5], wind: 0.8, start: 12 * PX, max: 270 * PX, damage: 0.9, floor: 0, buff: 3, buffRange: 220 * PX, open: 1.1 },
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
  // M12b Xhain. Cooldowns in seconds (rage makes them tick ×1.35 faster, as for every boss).
  /** Barrage „Feuerstoß“ (one circle on the hero, `extra` around), a five-shot fan, „Alarm!“ calls two Hetzer. Keeps `near`..`far` away. */
  grenzer: {
    barrage: 5.5, extra: 3, volley: 3.4, summon: 9, adds: 2, near: 5.5, far: 9,
    shots: 5, spread: 0.2, volleyWind: 0.7, volleySpeed: 270 * PX, volleyDamage: 0.55, volleyLife: 2.6,
  },
  /** Molotovs: `bottles` marked circles near the hero (first on the hero) that leave fire; a ring of fire; a flame burst when close. */
  brandmeister: {
    molotov: 4.6, ring: 6.5, flame: 4, close: 3, shots: 12,
    bottles: 3, wind: 1.0, step: 0.18, spread: 90 * PX, radius: 45 * PX, damage: 0.8, floor: 0.15,
    fireRadius: 40 * PX, fireTime: 4, fireDamage: 0.3,
  },
  /** 2D v 5: five rats every 3.8 s (2.6 s in rage, real time), acid trail while walking, the base slam. */
  rattenmutter: { summon: [3.8, 2.6], adds: 5, slam: 4.2, trailEvery: 0.5, trailRadius: 24 * PX, trailTime: 4, trailDamage: 0.3 },
  /**
   * 2D v 1: an acid pool under the hero every 2.2 s (here marked for `poolWind` first), a slower ring.
   * 3D: the Spreewelle (roar block, two rings to roll through) every 8 s; in rage each wave also calls three rats.
   */
  spreehexe: {
    pool: 2.2, poolWind: 0.8, poolX: 30 * PX, poolZ: 20 * PX, poolRadius: 26 * PX, poolTime: 5, poolDamage: 0.4,
    ring: 5 / 0.6, shots: 16, wave: 8, slam: 3.6, rageAdds: 3,
  },
  // M12c Mitte. Distances in meters, cooldowns in seconds (rage ticks them ×1.35 faster).
  /**
   * Schubser: a circle 1.6 m in front of him (r 2.2) that hurts and shoves the hero `push` meters (×3 the
   * 2D ring push of 40 px); twice in rage. Griff: a short lunge that holds the hero `hold` s (a roll breaks
   * free), then throws (`throwDamage`, `throwPush`); from 3.5 to 5.5 m only, as the lunge covers 4.2 m plus the
   * contact (the spec's 8 m would whiff). Gästeliste: two Kabelghule, three in rage.
   */
  tuersteher: {
    shove: 3.2, shoveRange: 3.5, shoveAhead: 1.6, shoveRadius: 2.2, shoveWind: 0.7, shoveDamage: 1, shoveFloor: 0.15, push: 3 * 40 * PX, shoveOpen: 0.8, rageGap: 0.5,
    grab: 6, grabMin: 3.5, grabMax: 5.5, grabWind: 0.5, grabTime: 0.35, grabSpeed: 12, grabDamage: 0.5, hold: 1, throwDamage: 0.6, throwPush: 2, grabOpen: 1.2,
    summon: 10, adds: 2, rageAdds: 3,
  },
  /**
   * Flies at `height`, keeps `near`..`far` away. Suchlicht (`Spot`): a lit circle that follows the hero; standing
   * in it `lock` s in a row locks it, `flash` s red, then the laser volley. Volley also every `volley` s with a
   * clear line; three Drohnen every `summon` s; every third special she lands instead (punish window).
   */
  wachdrohne: {
    height: 2.4, near: 6, far: 10,
    spotRadius: 1.8, spotSpeed: 2.6, lock: 0.6, flash: 0.3, spotCool: 1.5, spotOrbit: 2.8,
    volley: 4, shots: 5, spread: 0.18, volleyWind: 0.5, volleySpeed: 9, volleyDamage: 0.5, volleyLife: 1.8,
    summon: 11, adds: 3, landEvery: 3, landWind: 0.8, landRadius: 2.5, landDamage: 1, landFloor: 0.2, landed: 2.5,
  },
  /** Takt: one ring every `beat` s; every `fortEvery`-th beat the Fortissimo (two rings, every Boxenkopf pulses). Orchester: two Boxenköpfe at the start and once at half life. */
  dirigent: {
    beat: 4, beatWind: 0.6, beatMax: 7, beatDamage: 0.6, beatFloor: 0.12,
    fortEvery: 4, fortGap: 4, fortMax: 9, fortDamage: 0.7, fortFloor: 0.18, fortOpen: 1.5, adds: 2,
  },
  /** 2D v 2: Stromstoß every 3.8 s (0.7 s marked, 0.55 s at 560 px/s), after every second one (every one in rage) the Basspredigt; Gemeinde every 13 s. */
  bassprediger: {
    charge: 3.8, range: 13, wind: 0.7, time: 0.55, speed: 560 * PX, damage: 1.1, floor: 0.25, open: 1.25,
    sermonEvery: 2, gap: 150 * PX, max: 340 * PX, ringDamage: 0.7, ringFloor: 0.18,
    summon: 13, adds: 3, rageAdds: 2,
  },
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
