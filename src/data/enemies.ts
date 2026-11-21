// Enemy roster (M12). Roles, ratios and resistances are the 2D game's (`mkEnemy`, `RES`, elite
// tactics and boss patterns in js/update.js); bodies, reach and timing are rebuilt for 3D.
// Every type needs a different answer: Schlurfer crowd, Hetzer rush, Brocken slam a marked circle,
// Speier keep their distance and spit, Raptoren pounce along a line, Krähen circle and dive.
// M12b (Xhain): Ratten come in packs of five and zig-zag in; four new bosses from existing blocks.
// M12c (Mitte, `docs/tasks/m12c-mitte-enemies.md`): Kabelghule leap along a line, Boxenköpfe send bass
// rings and drive the others on (at most two alive), Drohnen circle and dive; four bosses.
// M15 Alexanderplatz (2D `uhr`, `wurz`, `kern`, Koloss v8): the Uhrwerkläufer blocks from the front,
// the Wurzler roots the hero, the Kernspeier spits a fan of seeds; four clockwork and garden bosses.
// WP5 (backlog P12, 2D `bomb`, `shield`, `howl`): the Zünder runs up and blows itself up, the Schildträger
// blocks from the front (the M15 shield rule), the Heuler stays back and howls the others on.
// M16 Charlottenburg (`docs/tasks/m12d-charlottenburg-enemies.md`; 2D has nothing for this district): glass bodies
// that burst on maps with `shards`. The Scherbentänzerin spins along a line, the Logenbrecher blocks with a glass
// front and slams a marked circle, the Spiegelsouffleur cues the others on and throws shard fans; four revue bosses.
// M18 Wedding (`docs/tasks/m12e-wedding-enemies.md`; 2D has nothing): feast beings on existing brains. The Tee-Ifrit lobs
// tea glasses, the Baklava-Brocken blocks with a tray, the Teppichschlinger dives along a marked line; four bosses.
import { DEG } from '../sim/math';
import type { EnemyKind as ResKind } from './items';

export type BossKind = 'feldwebel' | 'waechter' | 'rex' | 'hauptmann' | 'schaffner' | 'grenzer' | 'brandmeister' | 'rattenmutter' | 'spreehexe'
  | 'tuersteher' | 'wachdrohne' | 'dirigent' | 'bassprediger'
  | 'wurzelmutter' | 'uhrwerkgross' | 'volkskoloss' | 'weltzeituhr'
  | 'conferencier' | 'ringvater' | 'spiegelpaar' | 'diva'
  | 'zugezogene' | 'hauptgericht' | 'bauherr' | 'sultan';
export type EnemyKind = 'walker' | 'runner' | 'brute' | 'spitter' | 'raptor' | 'crow' | 'rat' | 'kabel' | 'bass' | 'drone' | 'uhrwerk' | 'wurzler' | 'kernspeier'
  | 'zuender' | 'schild' | 'heuler' | 'scherbe' | 'loge' | 'souffleur' | 'spiegelbild' | 'teeifrit' | 'baklava' | 'teppich' | BossKind;
/**
 * Which model and clip set draws the body (`src/render/enemies.ts`). M12c: `drone` is code-built. M15: `mech` and
 * `mechBig` are the Quaternius mechs Leela and Mike, `kern` the code-built Kernspeier, `koloss` the walking slab,
 * `clock` the Weltzeituhr (the landmark itself, `src/render/clock.ts`). H3: `human` is the male humanoid bosses' base
 * (`human1.glb`, the zombie's body without the zombie repaint, same skeleton and clips); `female` the female ones
 * (`human2.glb`, UBC Superhero_Female, the hero's proportions). M18: `carpet` the code-built Teppichschlinger.
 */
export type BodyKind = 'zombie' | 'human' | 'female' | 'raptor' | 'rex' | 'crow' | 'rat' | 'drone' | 'mech' | 'mechBig' | 'kern' | 'koloss' | 'clock' | 'carpet';
/** How it moves and which special it uses (`src/sim/ai.ts`). */
export type AiKind = 'melee' | 'brute' | 'spitter' | 'pouncer' | 'crow' | 'rat' | 'bass' | 'wurzler' | 'kernspeier' | 'zuender' | 'heuler' | 'spiegelbild' | BossKind;
/** Elite modifiers (2D `EMN`): each adds a telegraphed special and a punish window after it. */
export type EliteMod = 'flink' | 'brennend' | 'spaltend' | 'gepanzert';

/** D9 enemy classes: each weapon damage type is strong against some (`STRONG_AGAINST` in weapon-look.ts). */
export type EnemyClass = 'untote' | 'maschinen' | 'pflanzen' | 'menschen' | 'tiere';
export const ENEMY_CLASS_NAME: Readonly<Record<EnemyClass, string>> = { untote: 'Untote', maschinen: 'Maschinen', pflanzen: 'Pflanzen', menschen: 'Menschen', tiere: 'Tiere' };

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  /** D9: one or two classes (start assignment, Johannes 2026-11-19; filled from `ENEMY_CLASSES`). */
  classes: readonly EnemyClass[];
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
  /**
   * M15: carries a shield in front (2D `SHD`): hits inside ±`arc` of its facing deal `front`; it turns
   * at `turn` rad/s. A stun or a shock hit opens the guard for `open` s. Never `gepanzert`.
   * M16 `down`: the front is also down while the body stands open after its special (the Logenbrecher).
   */
  shield?: { arc: number; front: number; turn: number; open: number; down?: boolean };
  /** M15: seconds it stands untouchable after it spawns (the Weltzeituhr wakes up). */
  wake?: number;
  /** M16: a glass body; on maps with `shards` it bursts when it dies (`THREAT.shards`). */
  glass?: boolean;
  /** M16: a boss without the rage below half life (the Diva's gown tiers are her escalation). */
  noRage?: boolean;
}

/** D9 start assignment of the classes (Johannes, 2026-11-19); Kabelghul and Boxenkopf are both. */
export const ENEMY_CLASSES: Readonly<Record<EnemyKind, readonly EnemyClass[]>> = {
  walker: ['untote'], runner: ['untote'], brute: ['untote'], spitter: ['untote'], spreehexe: ['untote'],
  // WP5 kinds (zombie bodies).
  zuender: ['untote'], schild: ['untote'], heuler: ['untote'],
  kabel: ['untote', 'maschinen'], bass: ['untote', 'maschinen'],
  drone: ['maschinen'], uhrwerk: ['maschinen'], uhrwerkgross: ['maschinen'], wachdrohne: ['maschinen'], weltzeituhr: ['maschinen'], volkskoloss: ['maschinen'], bassprediger: ['maschinen'],
  wurzler: ['pflanzen'], kernspeier: ['pflanzen'], wurzelmutter: ['pflanzen'],
  feldwebel: ['menschen'], waechter: ['menschen'], hauptmann: ['menschen'], schaffner: ['menschen'], grenzer: ['menschen'], brandmeister: ['menschen'], tuersteher: ['menschen'], dirigent: ['menschen'],
  raptor: ['tiere'], rex: ['tiere'], crow: ['tiere'], rat: ['tiere'], rattenmutter: ['tiere'],
  // M16 Charlottenburg: the glass revue ghouls are Zeitlose (undead); the bosses are people of the revue.
  scherbe: ['untote'], loge: ['untote'], souffleur: ['untote'],
  conferencier: ['menschen'], ringvater: ['menschen'], spiegelpaar: ['menschen'], spiegelbild: ['menschen'], diva: ['menschen'],
  // M18 Wedding: the tea spirit is undead, the pastry a plant (cut it), the carpet a flyer (shoot it).
  teeifrit: ['untote'], baklava: ['pflanzen'], teppich: ['tiere'],
  zugezogene: ['menschen'], hauptgericht: ['pflanzen'], bauherr: ['maschinen'], sultan: ['menschen'],
};

const DEFS: Record<EnemyKind, Omit<EnemyDef, 'classes'>> = {
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
  // M15 Alexanderplatz. 2D Uhrwerkläufer (r 22, 58 life, 34 px/s, 13): the clock face is its shield.
  // Slow, heavy swing; get behind it or open it with the hammer, a stun or shock.
  uhrwerk: {
    kind: 'uhrwerk', name: 'Uhrwerkläufer', body: 'mech', ai: 'melee', res: 'uhr', radius: 0.7, scale: 1, hp: 85, speed: 1.1,
    attackRange: 2.0, windup: 0.9, active: 0.14, recovery: 0.9,
    reach: 2.4, halfAngle: 55 * DEG, damage: 22, knockbackTaken: 0.4, poise: true, weight: 0,
    shield: { arc: 70 * DEG, front: 0.2, turn: 90 * DEG, open: 2.2 },
  },
  // 2D Wurzler (r 12, 40 life, 54 px/s, 10): a ghoul full of roots. Roots the hero from a distance.
  wurzler: {
    kind: 'wurzler', name: 'Wurzler', body: 'zombie', ai: 'wurzler', res: 'wurz', radius: 0.4, scale: 1.05, hp: 55, speed: 1.7,
    attackRange: 1.45, windup: 0.55, active: 0.12, recovery: 0.7,
    reach: 1.7, halfAngle: 50 * DEG, damage: 16, knockbackTaken: 1, poise: false, weight: 0,
  },
  // 2D Kernspeier (r 11, 18 life, 58 px/s, 8): a clay pot with a toothed sunflower. Plants itself, spits three seeds.
  kernspeier: {
    kind: 'kernspeier', name: 'Kernspeier', body: 'kern', ai: 'kernspeier', res: 'kern', radius: 0.34, scale: 1, hp: 26, speed: 1.8,
    attackRange: 0, windup: 0.5, active: 0.1, recovery: 0.6,
    reach: 1.2, halfAngle: 40 * DEG, damage: 10, knockbackTaken: 1.2, poise: false, weight: 0,
  },
  // WP5 (2D `bomb`: r 11 px, life 22, 74-84 px/s, hit 20) on the ghoul ratios: runs up, lights its fuse
  // within 2 m and blows up (`THREAT.fuse`); killed first, it still goes off, smaller. No strike, never elite.
  zuender: {
    kind: 'zuender', name: 'Zünder', body: 'zombie', ai: 'zuender', res: 'bomb', radius: 0.38, scale: 0.95, hp: 33, speed: 2.2,
    attackRange: 0, windup: 0.5, active: 0.1, recovery: 0.6,
    reach: 1.4, halfAngle: 40 * DEG, damage: 34, knockbackTaken: 1.1, poise: false, weight: 0,
  },
  // 2D `shield` (r 13 px, life 52, 46 px/s, hit 13) on the brute ratios: a riot shield in front (2D `SHD`:
  // ±1.2 rad, 20 % through, turns 1.6 rad/s, a stun or shock opens it for 2.2 s). Walk round it or bring the hammer.
  schild: {
    kind: 'schild', name: 'Schildträger', body: 'zombie', ai: 'melee', res: 'shield', radius: 0.48, scale: 1.08, hp: 62, speed: 1.5,
    attackRange: 1.7, windup: 0.7, active: 0.12, recovery: 0.8,
    reach: 2.0, halfAngle: 50 * DEG, damage: 19, knockbackTaken: 0.6, poise: false, weight: 0,
    shield: { arc: 1.2, front: 0.2, turn: 1.6, open: 2.2 },
  },
  // 2D `howl` (r 11 px, life 34, 58 px/s, hit 6) on the ghoul ratios: keeps 6 to 8.7 m away and howls the
  // others within 7.3 m on (`THREAT.howl`). Weak in melee; kill it first. One alive at a time.
  heuler: {
    kind: 'heuler', name: 'Heuler', body: 'zombie', ai: 'heuler', res: 'howl', radius: 0.36, scale: 0.95, hp: 51, speed: 1.6,
    attackRange: 1.35, windup: 0.5, active: 0.1, recovery: 0.6,
    reach: 1.5, halfAngle: 45 * DEG, damage: 10, knockbackTaken: 1.1, poise: false, weight: 0, cap: 1,
  },
  // M16 Charlottenburg (1920). A glass revue dancer next to the Kabelghul (life 20, hit 10): spins through the hero
  // along a marked line (`THREAT.pirouette`), then stands open. Shock shatters her.
  scherbe: {
    kind: 'scherbe', name: 'Scherbentänzerin', body: 'female', ai: 'pouncer', res: 'glas', radius: 0.3, scale: 0.95, hp: 20, speed: 3.6,
    attackRange: 1.3, windup: 0.4, active: 0.1, recovery: 0.55,
    reach: 1.5, halfAngle: 45 * DEG, damage: 10, knockbackTaken: 1.3, poise: false, weight: 0, glass: true,
  },
  // Above the Brocken (130, 30): a box-seat bruiser with a smoked-glass front (the Uhrwerkläufer's shield). No
  // plain strike: only the slow Faustschlag on a marked circle (`THREAT.faust`); while open after it, the front is down.
  loge: {
    kind: 'loge', name: 'Logenbrecher', body: 'zombie', ai: 'brute', res: 'rauchglas', radius: 0.65, scale: 1.35, hp: 130, speed: 1.2,
    attackRange: 0, windup: 0.9, active: 0.14, recovery: 0.9,
    reach: 2.4, halfAngle: 60 * DEG, damage: 30, knockbackTaken: 0.35, poise: true, weight: 0, cap: 2, glass: true,
    shield: { arc: 70 * DEG, front: 0.2, turn: 90 * DEG, open: 2.2, down: true },
  },
  // Near the Speier (34, 12): the prompter with a mirror mask. Keeps back, cues the others on (the Heuler's howl),
  // throws a fan of five shards between two cues (`THREAT.cue`). Kill him first.
  souffleur: {
    kind: 'souffleur', name: 'Spiegelsouffleur', body: 'zombie', ai: 'heuler', res: 'spiegel', radius: 0.36, scale: 1.1, hp: 34, speed: 2.4,
    attackRange: 1.35, windup: 0.5, active: 0.1, recovery: 0.6,
    reach: 1.5, halfAngle: 45 * DEG, damage: 12, knockbackTaken: 1.1, poise: false, weight: 0, cap: 2, glass: true,
  },
  // Das Spiegelpaar's reflection: cannot be hurt, follows the point reflection of the real one (`mirrorOf`),
  // joins her Doppelpirouette and dies with her. Glides through walls like a reflection would.
  spiegelbild: {
    kind: 'spiegelbild', name: 'Spiegelbild', body: 'female', ai: 'spiegelbild', res: 'glas', radius: 0.6, scale: 1.3, hp: 1, speed: 3,
    attackRange: 0, windup: 0.6, active: 0.12, recovery: 0.7,
    reach: 2.3, halfAngle: 60 * DEG, damage: 28, knockbackTaken: 0, poise: true, weight: 0, fly: true,
  },
  // M18 Wedding (spec m12e). Near the Speier (24, 11): a tea spirit over a samovar. Keeps the Speier's distance and
  // lobs a tea glass onto a marked circle (`THREAT.tea`, the Brandmeister's bottle block). Kill it first.
  teeifrit: {
    kind: 'teeifrit', name: 'Tee-Ifrit', body: 'zombie', ai: 'spitter', res: 'tee', radius: 0.36, scale: 1, hp: 26, speed: 2,
    attackRange: 0, windup: 0.5, active: 0.1, recovery: 0.6,
    reach: 1.4, halfAngle: 40 * DEG, damage: 11, knockbackTaken: 1.1, poise: false, weight: 0, cap: 3,
  },
  // Between the Schildträger and the Brocken (100, 26): a filo golem with a tray in front (the Schildträger's
  // shield rule) and the Brocken's slam. Walk round it or open the tray with a stun.
  baklava: {
    kind: 'baklava', name: 'Baklava-Brocken', body: 'zombie', ai: 'brute', res: 'baklava', radius: 0.6, scale: 1.3, hp: 100, speed: 1.4,
    attackRange: 1.9, windup: 0.85, active: 0.14, recovery: 0.9,
    reach: 2.3, halfAngle: 60 * DEG, damage: 26, knockbackTaken: 0.45, poise: true, weight: 0, cap: 2,
    shield: { arc: 1.2, front: 0.2, turn: 1.6, open: 2.2 },
  },
  // As the Krähe (14, 10): a flying carpet. Circles, then dives along a line marked from the start of its wind-up.
  teppich: {
    kind: 'teppich', name: 'Teppichschlinger', body: 'carpet', ai: 'crow', res: 'teppich', radius: 0.32, scale: 1.2, hp: 16, speed: 5,
    attackRange: 0, windup: 0.35, active: 0.1, recovery: 0.5,
    reach: 1.2, halfAngle: 40 * DEG, damage: 11, knockbackTaken: 1.4, poise: false, weight: 0, fly: true,
  },
  // Zone bosses.
  feldwebel: {
    kind: 'feldwebel', name: 'Der Feldwebel', body: 'human', ai: 'feldwebel', res: 'koloss', radius: 0.7, scale: 1.45, hp: 900, speed: 2.5,
    attackRange: 2.1, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 2.6, halfAngle: 65 * DEG, damage: 24, knockbackTaken: 0.3, poise: true, weight: 0, boss: true,
  },
  // H3 (Johannes, 2026-11-19): a robot, the Fernsehturm on Leela's legs (`towerGear` in src/render/enemies.ts).
  waechter: {
    kind: 'waechter', name: 'Der Turmwächter', body: 'mech', ai: 'waechter', res: 'turm', radius: 0.85, scale: 1.3, hp: 2000, speed: 1.7,
    attackRange: 2.4, windup: 0.85, active: 0.16, recovery: 0.85,
    reach: 3.0, halfAngle: 70 * DEG, damage: 30, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
  rex: {
    kind: 'rex', name: 'Der Rex', body: 'rex', ai: 'rex', res: 'brand', radius: 1.25, scale: 1, hp: 3600, speed: 2.7,
    attackRange: 3.1, windup: 0.75, active: 0.16, recovery: 0.9,
    reach: 3.8, halfAngle: 50 * DEG, damage: 34, knockbackTaken: 0.1, poise: true, weight: 0, boss: true,
  },
  hauptmann: {
    kind: 'hauptmann', name: 'Hauptmann von Köpenick', body: 'human', ai: 'hauptmann', res: 'hauptmann', radius: 0.8, scale: 1.6, hp: 4400, speed: 2.9,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.7,
    reach: 2.8, halfAngle: 75 * DEG, damage: 34, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
  },
  // M19 tunnel boss (2D: Der Schaffner at the generator). Charges along the tracks like a train and
  // whistles up passengers: the Feldwebel's pattern (charge, call men), tunnel life +25 %.
  schaffner: {
    kind: 'schaffner', name: 'Der Schaffner', body: 'human', ai: 'feldwebel', res: 'koloss', radius: 0.75, scale: 1.55, hp: 2800, speed: 2.7,
    attackRange: 2.2, windup: 0.65, active: 0.14, recovery: 0.75,
    reach: 2.7, halfAngle: 70 * DEG, damage: 30, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
  // M12b Xhain (1981). Zone 1: the GDR border guard from the watchtower, the weakest. Shoots from a
  // distance, calls runners. Resistances of the 2D Volkseigener Koloss (GDR row: weak to shock).
  grenzer: {
    kind: 'grenzer', name: 'Der Grenzer', body: 'human', ai: 'grenzer', res: 'volk', radius: 0.7, scale: 1.45, hp: 950, speed: 2.3,
    attackRange: 2.0, windup: 0.65, active: 0.14, recovery: 0.8,
    reach: 2.4, halfAngle: 60 * DEG, damage: 24, knockbackTaken: 0.3, poise: true, weight: 0, boss: true,
  },
  // Zone 2 (Mariannenplatz): the riots, burning barricades. Molotovs, fire ring, flame burst (2D `brand`).
  brandmeister: {
    kind: 'brandmeister', name: 'Der Brandmeister', body: 'human', ai: 'brandmeister', res: 'brand', radius: 0.78, scale: 1.55, hp: 2100, speed: 2.4,
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
    kind: 'spreehexe', name: 'Die Spreehexe', body: 'female', ai: 'spreehexe', res: 'hexe', radius: 0.8, scale: 1.7, hp: 4400, speed: 2.6,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.7,
    reach: 2.8, halfAngle: 70 * DEG, damage: 34, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
  },
  // M12c Mitte (2089). Zone 0, Pariser Platz: a Kabelbrocken in a bomber jacket holds the Tor like a club
  // door („Kein Einlass“). Shoves, grabs and holds, calls Kabelghule from the guest list.
  tuersteher: {
    kind: 'tuersteher', name: 'Der Türsteher', body: 'human', ai: 'tuersteher', res: 'koloss', radius: 0.8, scale: 1.6, hp: 1000, speed: 2.4,
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
    kind: 'dirigent', name: 'Der Dirigent', body: 'human', ai: 'dirigent', res: 'bass', radius: 0.7, scale: 1.4, hp: 1400, speed: 2.2,
    attackRange: 2.1, windup: 0.65, active: 0.14, recovery: 0.8,
    reach: 2.6, halfAngle: 65 * DEG, damage: 24, knockbackTaken: 0.3, poise: true, weight: 0, boss: true,
  },
  // District boss on the Sony Center stage: 2D Bassprediger (v 2). Shock charge, bass sermons, a congregation.
  bassprediger: {
    kind: 'bassprediger', name: 'Der Bassprediger', body: 'human', ai: 'bassprediger', res: 'bass', radius: 0.85, scale: 1.7, hp: 4400, speed: 2.8,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.7,
    reach: 2.8, halfAngle: 70 * DEG, damage: 34, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
  },
  // M15 Alexanderplatz. Zone 1: a Wurzler grown out of the Palast glass house, a crown of sunflowers.
  wurzelmutter: {
    kind: 'wurzelmutter', name: 'Die Wurzel-Mutter', body: 'female', ai: 'wurzelmutter', res: 'wurz', radius: 0.95, scale: 2.2, hp: 1900, speed: 1.9,
    attackRange: 2.6, windup: 0.75, active: 0.14, recovery: 0.85,
    reach: 3.2, halfAngle: 70 * DEG, damage: 26, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
  // Zone 2 (Jannowitzbrücke): the Mech Mike at 1.8 with the shield; charges, then winds down.
  uhrwerkgross: {
    kind: 'uhrwerkgross', name: 'Der Große Uhrwerkläufer', body: 'mechBig', ai: 'uhrwerkgross', res: 'uhr', radius: 1.15, scale: 1, hp: 2900, speed: 1.6,
    attackRange: 2.7, windup: 0.8, active: 0.16, recovery: 0.9,
    reach: 3.3, halfAngle: 65 * DEG, damage: 30, knockbackTaken: 0.15, poise: true, weight: 0, boss: true,
    shield: { arc: 70 * DEG, front: 0.35, turn: 63 * DEG, open: 1.2 },
  },
  // Zone 3 (Karl-Marx-Allee): 2D Volkseigener Koloss (v 8), a walking Plattenbau slab on clockwork legs.
  volkskoloss: {
    kind: 'volkskoloss', name: 'Der Volkseigene Koloss', body: 'koloss', ai: 'volkskoloss', res: 'volk', radius: 1.7, scale: 1, hp: 3900, speed: 1.5,
    attackRange: 0, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 3, halfAngle: 70 * DEG, damage: 32, knockbackTaken: 0.05, poise: true, weight: 0, boss: true,
  },
  // District boss: the Weltzeituhr itself wakes up on its base and walks on four clockwork legs.
  weltzeituhr: {
    kind: 'weltzeituhr', name: 'Die Weltzeituhr', body: 'clock', ai: 'weltzeituhr', res: 'uhr', radius: 2.4, scale: 1, hp: 5400, speed: 1.3,
    attackRange: 0, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 3, halfAngle: 70 * DEG, damage: 36, knockbackTaken: 0, poise: true, weight: 0, boss: true, wake: 3,
  },
  // M16 Charlottenburg. Zone 1, Auguste-Viktoria-Platz: the master of ceremonies announces the acts (the three
  // kinds), keeps the hero in his spotlight (applause on a lock) and thrusts with his cane.
  conferencier: {
    kind: 'conferencier', name: 'Der Conférencier', body: 'human', ai: 'conferencier', res: 'spiegel', radius: 0.7, scale: 1.4, hp: 1000, speed: 2.6,
    attackRange: 1.9, windup: 0.65, active: 0.14, recovery: 0.8,
    reach: 2.4, halfAngle: 65 * DEG, damage: 26, knockbackTaken: 0.3, poise: true, weight: 0, boss: true,
  },
  // Zone 2, before the Opernhaus: the head of the Ringverein „Treue Hand“. Half damage while a Logenbrecher guards
  // him (`guarded`), a charging blow, his collectors.
  ringvater: {
    kind: 'ringvater', name: 'Der Ringvater', body: 'human', ai: 'ringvater', res: 'brute', radius: 0.85, scale: 1.6, hp: 2200, speed: 2.3,
    attackRange: 2.1, windup: 0.75, active: 0.14, recovery: 0.85,
    reach: 2.7, halfAngle: 70 * DEG, damage: 30, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
  // Zone 3, the Belvedere: a revue dancer and her reflection (`spiegelbild`); the real one wears the red sash.
  spiegelpaar: {
    kind: 'spiegelpaar', name: 'Das Spiegelpaar', body: 'female', ai: 'spiegelpaar', res: 'glas', radius: 0.6, scale: 1.3, hp: 3200, speed: 3,
    attackRange: 1.9, windup: 0.6, active: 0.12, recovery: 0.7,
    reach: 2.3, halfAngle: 60 * DEG, damage: 28, knockbackTaken: 0.2, poise: true, weight: 0, boss: true,
  },
  // District boss in the Ehrenhof: three gown tiers are three phases (no rage); fans, prism rays, encores.
  diva: {
    kind: 'diva', name: 'Die Diamantene Diva', body: 'female', ai: 'diva', res: 'glas', radius: 0.9, scale: 1.8, hp: 4400, speed: 2.4,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.75,
    reach: 2.8, halfAngle: 70 * DEG, damage: 34, knockbackTaken: 0.1, poise: true, weight: 0, boss: true, noRage: true,
  },
  // M18 Wedding. Zone 1, inside the Magendoktor (Johannes, 2026-11-21): a newcomer hipster who wants to turn the pub
  // into something new. The Feldwebel's brain: an e-scooter charge along a marked line (twice in rage), two Zecher,
  // and one block of his own, a volley of thrown coffee cups (the Grenzer's five-shot fan).
  zugezogene: {
    kind: 'zugezogene', name: 'Der Zugezogene', body: 'human', ai: 'feldwebel', res: 'koloss', radius: 0.7, scale: 1.45, hp: 1000, speed: 2.5,
    attackRange: 2.1, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 2.6, halfAngle: 65 * DEG, damage: 26, knockbackTaken: 0.25, poise: true, weight: 0, boss: true,
  },
  // Zone 2, Brunnenplatz before the Amtsgericht: the Baklava-Brocken at boss size with a turning spit. The Rex's brain:
  // the spit sweep (tail ring), steam rings, charges.
  hauptgericht: {
    kind: 'hauptgericht', name: 'Das Hauptgericht', body: 'zombie', ai: 'rex', res: 'baklava', radius: 1.1, scale: 2, hp: 2200, speed: 2,
    attackRange: 2.6, windup: 0.75, active: 0.16, recovery: 0.9,
    reach: 3.2, halfAngle: 60 * DEG, damage: 30, knockbackTaken: 0.1, poise: true, weight: 0, boss: true,
  },
  // Zone 3, Beamtentor: the Koloss slab under scaffold. The Koloss brain: precast slabs, a bolt spiral, the hammer;
  // a building crew of two Brocken every third cycle.
  bauherr: {
    kind: 'bauherr', name: 'Der Ewige Bauherr', body: 'koloss', ai: 'volkskoloss', res: 'volk', radius: 1.7, scale: 1, hp: 3200, speed: 1.4,
    attackRange: 0, windup: 0.7, active: 0.14, recovery: 0.8,
    reach: 3, halfAngle: 70 * DEG, damage: 32, knockbackTaken: 0.05, poise: true, weight: 0, boss: true,
  },
  // District boss in the Hochzeitspalast: the eternal host on his carpet. The Diva's brain (`BOSS.sultan`): tea glass
  // fans, carpet strips, tea spirits; three courses instead of gown tiers (no rage).
  sultan: {
    kind: 'sultan', name: 'Sultan Nimmersatt', body: 'human', ai: 'diva', res: 'tee', radius: 0.95, scale: 1.85, hp: 4400, speed: 2.4,
    attackRange: 2.3, windup: 0.6, active: 0.14, recovery: 0.75,
    reach: 2.8, halfAngle: 70 * DEG, damage: 34, knockbackTaken: 0.1, poise: true, weight: 0, boss: true, noRage: true,
  },
};

/** Life of every normal (non-boss) kind against the table above (playtest 2026-11-20: blessed heroes one-shot
 * too much). Bosses keep their table value. */
export const NORMAL_HP = 2;
export const ENEMIES: Record<EnemyKind, EnemyDef> = Object.fromEntries(
  (Object.keys(DEFS) as EnemyKind[]).map((k) => [k, { ...DEFS[k], hp: DEFS[k].boss ? DEFS[k].hp : DEFS[k].hp * NORMAL_HP, classes: ENEMY_CLASSES[k] }]),
) as Record<EnemyKind, EnemyDef>;

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
 * Playtest 2026-11-20 (Johannes two-shots normal enemies after Xhain): hero power multiplies (item
 * level, affixes, workshop, drill, Aufsätze) while wave life grew only linearly. From tier 10 on a
 * wave has fewer, tougher enemies: life +5 % and count -2.5 % (relative) per tier. Tier 19 (Köpenick's
 * end): ×1.45 life, ×0.82 count; tier 30: ×2.0, ×0.67; tier 38: ×2.4, ×0.59. Wave life in all rises
 * 20 to 40 %; fewer bodies at once also lighten the tablet (CPU-bound at 25 to 38 alive).
 */
export function lateTier(g: number): { hp: number; count: number } {
  const t = Math.max(0, g - 10);
  return { hp: 1 + t * 0.05, count: 1 / (1 + t * 0.025) };
}

/**
 * Bot campaigns 2026-11-21 (5 chains, upgraded bot with the camp step): Köpenick 1 to 7 deaths, every later
 * district 0 deaths with 11 to 32 % damage taken per fight and bosses often down in under 25 s. The camp
 * lifts the hero's power after Köpenick, so each later district adds enemy life and damage (district
 * index, Köpenick 0, also the tunnels by their line).
 */
export const DISTRICT_STEP = { hp: 0.3, dmg: 0.25 } as const;
/** Share of the damage step that district bosses take. */
export const BOSS_DMG_STEP = 0.4;
export const districtScale = (district: number): { hp: number; dmg: number } => ({ hp: 1 + DISTRICT_STEP.hp * Math.max(0, district), dmg: 1 + DISTRICT_STEP.dmg * Math.max(0, district) });

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
  /** M11c lying guards: seconds to get up after waking; no move or strike meanwhile (backlog P22). */
  rise: 0.7,
  hazard: { tick: 0.5 },
  /** M15 Wurzler roots (2D `wurz`): marked under the hero, then held unless dodging; immune for a while after. */
  roots: { range: 320 * PX, every: [4.5, 6], first: [2, 3.5], wind: 0.95, radius: 1.5, damage: 0.6, hold: 0.8, immune: 2.5, open: 0.9, near: 120 * PX, nearSpeed: 0.7 },
  /** M15 Kernspeier (2D `kern`): keeps `near`..`far`, plants for `wind`, three seeds ±15° at 70 %. */
  seeds: { near: 5, far: 8, range: 400 * PX, every: [3, 3.8], wind: 0.7, spread: 15 * DEG, damage: 0.7, speed: 240 * PX, life: 2.6, radius: 0.2, open: 0.9 },
  /**
   * WP5 Zünder (2D `bomb`): within `range` with a clear line it stops and lights the fuse (`wind`, hits do not
   * put it out), then blows up: r 84 px at 1.3 of its hit, floor 0.22 (2D `bigHit`). Killed before, it goes off
   * where it fell: r 66 px at 0.6, marked for `deathWind` s (new for 3D; 2D burst at once). Every blast also hits
   * the enemies inside at `enemyShare` of its damage with a 320 px knock (2D), so a Zünder can set off the next.
   */
  fuse: { range: 58 * PX, wind: 0.85, radius: 84 * PX, damage: 1.3, floor: 0.22, deathRadius: 66 * PX, deathDamage: 0.6, deathWind: 0.3, enemyShare: 1.5, knock: 320 },
  /**
   * WP5 Heuler (2D `howl`): backs off under `near`, strafes at `strafe` speed up to `far`; within `range` every
   * 4.5-6 s a howl (wind-up new for 3D; 2D cast 0.24 s) drives every other body within `buffRange` for `buff` s.
   */
  howl: { near: 180 * PX, far: 260 * PX, strafe: 0.6, range: 460 * PX, every: [4.5, 6], first: [2, 3.5], wind: 0.5, buff: 4, buffRange: 220 * PX, open: 0.6 },
  /** M15 shield bearers (2D `SHD`): slower while the guard stands open; a "geblockt" note at most this often. */
  shield: { openSpeed: 0.4, note: 0.6 },
  // M16 Charlottenburg (spec m12d; 2D has nothing for the district, every number sits on the 3D ladders).
  /**
   * Scherbentänzerin Pirouette (the Kabelghul's leap block): within `range` with a clear line, the line is marked
   * `wind` s, she spins `time` s at `speed` (4.55 m) and hits once (×1), then stands open. Cooldown fixed per body.
   */
  pirouette: { range: 5, every: [2.4, 3.2], wind: 0.45, time: 0.35, speed: 13, damage: 1, open: 0.6 },
  /**
   * Logenbrecher Faustschlag: within `range`, fists raised `wind` s over a circle r `radius` whose centre stands
   * `ahead` m in front of him, ×1.3 of his hit, floor 0.25; open `open` s with the glass front down.
   * The spec gives no cooldown: every 3 to 4 s (first after 1.5 to 2.5 s), his only attack.
   */
  faust: { range: 3.2, every: [3, 4], first: [1.5, 2.5], wind: 1.1, ahead: 1.4, radius: 2.4, damage: 1.3, floor: 0.25, open: 1.6 },
  /**
   * Spiegelsouffleur: keeps `near`..`far`; the Stichwort is the Heuler's howl with these numbers (bodies within
   * `buffRange` are driven on `buff` s); halfway to the next cue one Scherbenfächer of `shots` shards (`spread`
   * apart, `speed`, ×`damage` each) when the hero is within `range` with a clear line.
   */
  cue: {
    near: 6, far: 9, strafe: 0.6, range: 460 * PX, every: [5, 6.5], first: [2, 3.5], wind: 0.5, buff: 4, buffRange: 220 * PX, open: 0.6,
    fanRange: 12, shots: 5, spread: 0.3, speed: 7.7, damage: 0.5, fanWind: 0.6, fanOpen: 1, life: 2.2,
  },
  /**
   * District rule „Glas splittert“ (`MapDef.shards`): a glass body bursts `wind` s after it dies, a marked circle
   * r `radius`. The hero takes `hit` × the dead kind's hit (floor 0); every other enemy inside `life` × the dead
   * kind's base life × its wave life factor, a boss at most `bossCap` of its life per burst. Kills by shards burst too.
   */
  shards: { wind: 0.5, radius: 1.5, hit: 0.5, life: 0.4, bossCap: 0.02 },
  // M18 Wedding (spec m12e).
  /**
   * Tee-Ifrit Teeglas: keeps the Speier's `near`..`far`; with a clear line within `range` every `every` s one glass
   * lands on a marked circle r `radius` on the hero after `wind` s (×`damage`, floor 0) and leaves hot tea (a fire
   * puddle r `puddle`, `puddleTime` s, ×`puddleDamage` a tick); open `open` s after the throw.
   */
  tea: { near: 200 * PX, far: 290 * PX, range: 13, every: [2.8, 3.6], wind: 1, radius: 1.2, damage: 1, open: 0.6, puddle: 0.9, puddleTime: 2.5, puddleDamage: 0.3 },
  /** Teppichschlinger: the dive line is locked when the wind-up starts and marked; the wind-up is longer to read it. */
  carpetDive: { wind: 0.55 },
  /** „Honig klebt“ (`MapDef.honey`): walking speed factor inside a honey puddle. */
  honey: 0.6,
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
  // Playtest 2026-11-18 (too easy, boring): charges when the hero keeps away, a second ring in rage, four men per call.
  hauptmann: { slam: 3.6, charge: [4, 5.5] as [number, number], chargeFrom: 6, ring: 5, ringGap: 0.7, summon: 9, adds: 4, shots: 16 },
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
    /** H3 (Johannes): he leaves burning ground where he walks; the 2D boss trail (every 0.4 s, r 26 px, 4 s, 0.35 of his hit). */
    trailEvery: 0.4, trailRadius: 26 * PX, trailTime: 4, trailDamage: 0.35,
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
    /**
     * P25 Neonschranke (rage only, its own timer, not scaled by the rage factor): with the hero within `barNear`
     * of a Tor bar, the passages get a pink strip for `barWind` s, then shut for `barTime` s, then stay open
     * `barEvery` s. Standing on the strip when it shuts: one hit (`barDamage` × his damage, floor `barFloor`).
     * No wind-up while he is within `barClear` of a bar; a shut waits until he is off the bars.
     */
    barNear: 14, barWind: 0.8, barTime: 4, barEvery: 9, barDamage: 0.6, barFloor: 0.1, barClear: 1.5,
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
  // M15 Alexanderplatz (spec: docs/tasks/m15-alexanderplatz.md › Step 6). Cooldowns in seconds.
  /** Three root fields (one under the hero, `beside` m to both sides); two Kernspeier; a root ring round her when close. */
  wurzelmutter: { fields: 4.2, extra: 2, beside: 2.6, summon: 9, adds: 2, rageAdds: 3, slam: 3.6, close: 3, ringRadius: 3.2, ringWind: 0.8 },
  /** Charge along a marked line, then wound down (open); every `keyEvery`-th cycle it winds its key: front closed, then a ring of sparks. */
  uhrwerkgross: { charge: 4.2, speed: 12, time: 0.6, open: 1.4, keyEvery: 3, key: 2, shots: 14 },
  /**
   * 2D v 8: a cycle every 4.4 s (3.2 s in rage, real time). Odd cycles three slab drops (first on the
   * hero, landing 0.9 to 1.4 s after), even cycles the ring on its back sprays gears in a two-arm spiral;
   * every third cycle two Uhrwerkläufer. Hammer slam on the hero within `close` m.
   */
  volkskoloss: {
    cycle: [4.4, 3.2], slabs: 3, slabRadius: 1.9, slabFirst: 0.9, slabStep: 0.25, spreadX: 130 * PX, spreadZ: 110 * PX, slabDamage: 0.95, slabFloor: 0.2,
    spin: 2.4, gearEvery: 0.16, gearSpeed: 175 * PX, gearTurn: 2.6, gearDamage: 0.6, gearLife: 3.2, addsEvery: 3, adds: 2, slam: 3.6, close: 3,
  },
  /**
   * The Weltzeituhr. Zeitzonen: `sectors` of the 24 hour sectors of the ring `r0`..`r1` light up `wind` s,
   * then strike (one more in rage). Orbit: the planet balls fly out in a three-arm spiral for `spin` s,
   * every second cycle. Zeiger: every third cycle the minute hand sweeps a full circle at `hand` m, slow
   * then fast. Stillstand at 75, 50, 25 % life: the hero walks at half speed for 2 s, two Uhrwerkläufer drop in.
   */
  weltzeituhr: {
    cycle: 4, sectors: 3, r0: 3, r1: 9, sectorWind: 1.1, sectorDamage: 1, sectorFloor: 0.22,
    spin: 2.2, orbitEvery: 0.2, arms: 3, orbitSpeed: 160 * PX, orbitTurn: 1.9, orbitDamage: 0.55, orbitLife: 3,
    hand: 7, handWind: 0.8, handTime: 3.2, handFrom: 0.8, handTo: 3.2, handDamage: 1.1, handFloor: 0.25, handWidth: 0.45,
    still: [0.75, 0.5, 0.25], stillTime: 2, stillSlow: 0.5, adds: 2, stomp: 3.6, close: 3.5,
  },
  // M16 Charlottenburg (spec m12d). Distances in meters, cooldowns in seconds (rage ticks them ×1.35 faster).
  /**
   * Nummer every `summon` s: „Tanz“ (`dance` Scherbentänzerinnen) and „Kraftakt“ (`act` Logenbrecher) by turns, both
   * in rage. Spotlicht (the Wachdrohne's `Spot`, one; two in rage): a lock throws Applaus, `applause` circles r
   * `applauseRadius`, the first on the spot after `applauseWind`, the others `applauseRing` m round it `applauseStep`
   * s apart. Stockstoß: a lunge from `lungeMin` to `lungeMax` m (0.35 s at 12 m/s covers 4.2 m plus contact).
   */
  conferencier: {
    summon: 10, dance: 3, act: 1,
    applause: 4, applauseWind: 0.6, applauseStep: 0.15, applauseRadius: 1.6, applauseRing: [2.8, 3.6], applauseDamage: 0.9, applauseFloor: 0.2,
    lunge: 6, lungeMin: 3.5, lungeMax: 5.5, lungeWind: 0.5, lungeTime: 0.35, lungeSpeed: 12, lungeDamage: 1.1, lungeOpen: 1.2,
  },
  /**
   * Leibwache: half damage (`THREAT.armored`) while one of `guards` lives; he enters with `escort` of them and calls
   * `rageGuards` more once at half life. Ringschlag: the charge block with own numbers from 3 to `range` m (0.6 s at
   * 16 m/s covers 9.6 m plus contact; the spec's 12 m would whiff), twice in rage `rageGap` s apart. Schutzgeld: `adds` Hetzer.
   */
  ringvater: {
    guards: ['loge'] as readonly EnemyKind[], escort: 2, rageGuards: 1,
    charge: 4.5, range: 11, wind: 0.75, time: 0.6, speed: 16, damage: 1.1, floor: 0.25, open: 1.3, rageGap: 0.6,
    summon: 12, adds: 3,
  },
  /**
   * The real one and her reflection (`spiegelbild`, the point reflection through the arena centre). Doppelpirouette
   * every `lunge` s within `lungeRange` m: both mark a line at the hero; the reflection's speed is set so its line
   * reaches the hero (at most `mirrorMax` m/s), its hit ×`mirrorDamage`; afterwards it glides back at `back` m/s.
   * Scherbenregen every `rain` s: `drops` circles r `radius` round the hero, in rage the reflection's second set
   * `mirrorDelay` s later. Tausch every `swap` s (rage: the second number, real seconds): the two change places.
   */
  spiegelpaar: {
    lunge: 4, lungeRange: 5.5, wind: 0.55, time: 0.35, speed: 13, damage: 1, mirrorDamage: 0.7, open: 1, mirrorMax: 30, back: 7,
    rain: 9, drops: 6, step: 0.12, radius: 1.4, rainDamage: 0.9, rainFloor: 0.2, mirrorDelay: 0.5,
    swap: [12, 8], swapWind: 0.8, swapOpen: 0.6, note: 3,
  },
  /**
   * Glides at `near`..`far`. Fächerschlag every `fan` s: `blades` blades over `cone` rad; phase 2 a second fan
   * `fanGap` s later turned half a gap, phase 3 three fans turned −20°, 0, +20°. Prismenstrahl every `prism` s: strips
   * `prismWidth` wide through the hero (`prismHalf` m each way), marked `prismWind` s, hitting `prismTime` s; phase 2
   * two crossing at ±`cross`, phase 3 three `spread3` apart; open after. Zugabe: `adds` dancers (phase 3 a Souffleur
   * too). Vorhang at `tiers` of life: one ring to `curtain` m, her blades in flight fall, open `curtainOpen` s.
   */
  diva: {
    near: 4, far: 8,
    fan: 3.5, blades: 7, cone: 0.5, bladeSpeed: 9, bladeDamage: 0.5, bladeLife: 1.8, fanWind: 0.6, fanGap: 0.4, turn3: 20 * DEG,
    prism: 8, prismWind: 0.9, prismTime: 0.3, prismWidth: 1.2, prismHalf: 18, prismDamage: 1.2, prismFloor: 0.25, prismOpen: 1.5, cross: 45 * DEG, spread3: 25 * DEG,
    summon: 12, adds: 3, tiers: [0.66, 0.33], curtain: 9, curtainDamage: 0.6, curtainFloor: 0.15, curtainOpen: 2, phase3: 0.85,
  },
  // M18 Wedding (spec m12e).
  /**
   * Der Zugezogene: two Zecher every `summon` s (`adds` Schlurfer, `runners` Hetzer, in rage `rageBrutes` Brocken too);
   * the e-scooter charge (the default charge) every `charge` s, twice in rage `rageGap` s apart; coffee cups (the
   * Grenzer's five-shot volley) every `volley` s within `volleyRange` m with a clear line.
   */
  zugezogene: { charge: [5, 7] as [number, number], summon: 10, adds: 1, runners: 1, rageBrutes: 1, rageGap: 0.6, volley: 5, volleyRange: 12 },
  /** Bautrupp: `adds` Brocken every `addsEvery`-th Koloss cycle (instead of the Uhrwerkläufer). */
  bauherr: { adds: 2 },
  /**
   * The Diva's numbers with his own: seven tea glasses a fan, a carpet strip `prismWidth` wide (ruby), Nachschlag:
   * `adds` Tee-Ifrite, from phase 3 `carpets` Teppichschlinger. Courses at the Diva's tiers.
   */
  sultan: {
    near: 4, far: 8,
    fan: 3.5, blades: 7, cone: 0.5, bladeSpeed: 9, bladeDamage: 0.5, bladeLife: 1.8, fanWind: 0.6, fanGap: 0.4, turn3: 20 * DEG,
    prism: 8, prismWind: 0.9, prismTime: 0.3, prismWidth: 1.4, prismHalf: 18, prismDamage: 1.2, prismFloor: 0.25, prismOpen: 1.5, cross: 45 * DEG, spread3: 25 * DEG,
    summon: 12, adds: 2, carpets: 1, tiers: [0.66, 0.33], curtain: 9, curtainDamage: 0.6, curtainFloor: 0.15, curtainOpen: 2, phase3: 0.85,
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
