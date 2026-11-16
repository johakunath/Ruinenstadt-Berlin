import type { AttackDef, AttackId, HitWeight } from '../data/combat';
import type { EnemyDef, EnemyKind } from '../data/enemies';
import type { Collider } from './collide';
import type { FlowField } from './flowfield';
import type { Level } from './level';
import type { Rng } from './math';
import type { Equipment, HeroStats, StatContext } from './stats';

/** Fixed simulation step. */
export const DT = 1 / 60;

/** What the input layer hands to one sim step. */
export interface SimInput {
  /** Move direction, length 0..1. */
  moveX: number;
  moveZ: number;
  /** Aim direction (unit) or 0,0 when there is none (then move direction or facing is used). */
  aimX: number;
  aimZ: number;
  /** Soft lock-on toward the nearest enemy in the aim cone (gamepad and touch). */
  aimAssist: boolean;
  /** A buffered press is waiting. The sim reports in `sim.consumed` when it used one. */
  attack: boolean;
  dodge: boolean;
}

export const NO_INPUT: SimInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, aimAssist: false, attack: false, dodge: false };

export type PlayerState = 'move' | 'attack' | 'dodge' | 'dead';

export interface Player {
  x: number;
  z: number;
  /** Previous step, for render interpolation. */
  px: number;
  pz: number;
  facing: number;
  pfacing: number;
  vx: number;
  vz: number;
  hp: number;
  state: PlayerState;
  /** Seconds in the current state. */
  stateT: number;
  attack: AttackDef | null;
  /** Gear speed and critical roll captured when this swing starts. */
  attackSpeed: number;
  critical: boolean;
  /** Counts swings; render uses it to restart clips and trails. */
  swing: number;
  /** Enemy ids already hit by the current swing. */
  hits: number[];
  /** Next attack of the chain and how long it stays available. */
  chain: AttackId | null;
  chainT: number;
  dodgeX: number;
  dodgeZ: number;
  dodgeCd: number;
  /** Remaining i-frames. */
  invuln: number;
  /** Remaining window for a dash strike after a dodge ended. */
  strikeT: number;
  /** Seconds since the last hit taken (large when none); drives flinch and hit grace. */
  hurtT: number;
  /** Current weapon sweep interval (relative to facing), valid while `sweeping`. */
  sweeping: boolean;
  sweepLo: number;
  sweepHi: number;
}

export type EnemyState = 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'dead';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  x: number;
  z: number;
  px: number;
  pz: number;
  facing: number;
  pfacing: number;
  /** Knockback velocity, damped every step. */
  kx: number;
  kz: number;
  /** Current walking speed (for the animation blend). */
  speed: number;
  hp: number;
  maxHp: number;
  /** Damage multiplier from the wave tier. */
  dmgMul: number;
  state: EnemyState;
  stateT: number;
  staggerDur: number;
  /** The current strike already landed. */
  struck: boolean;
}

export type SimEvent =
  | { type: 'swing'; attack: AttackId; weight: HitWeight }
  | { type: 'hit'; id: number; x: number; z: number; dx: number; dz: number; weight: HitWeight; killed: boolean; damage: number; critical?: boolean }
  | { type: 'dodge' }
  | { type: 'playerHit'; x: number; z: number; dx: number; dz: number; damage: number }
  | { type: 'playerDie' }
  | { type: 'enemyWindup'; id: number }
  | { type: 'enemyStrike'; id: number }
  | { type: 'spawn'; id: number }
  | { type: 'encounterStart'; index: number }
  | { type: 'waveStart'; index: number; wave: number; waves: number }
  | { type: 'encounterClear'; index: number; heal: number }
  | { type: 'zoneClear'; zone: number }
  /** The hero walked into a Späti (`first`: the first time this run). */
  | { type: 'restEnter'; index: number; first: boolean }
  | { type: 'victory' };

export type RunPhase = 'travel' | 'fight' | 'pause' | 'won';

/** Expedition progress (encounter director). Arena levels leave it at travel forever. */
export interface RunState {
  /** Current encounter (the objective). Equals the encounter count when all are won. */
  index: number;
  phase: RunPhase;
  wave: number;
  /** Enemies of the current wave not spawned yet. */
  toSpawn: number;
  bossesToSpawn: EnemyKind[];
  spawnT: number;
  /** Pause before the next wave. */
  pauseT: number;
}

export interface Sim {
  equipment: Equipment;
  statContext: StatContext;
  stats: HeroStats;
  tick: number;
  time: number;
  player: Player;
  enemies: Enemy[];
  /** Filled during a step; the game loop drains it after every step. */
  events: SimEvent[];
  /** Remaining freeze in seconds. While > 0 the world holds still; input is still buffered outside. */
  hitstop: number;
  /** Buffered presses used by the last step. */
  consumed: { attack: boolean; dodge: boolean };
  level: Level;
  /** Same as `level.colliders` (debug view, tests). */
  colliders: Collider[];
  flow: FlowField;
  /** Center of the flow field window (expedition maps). */
  flowCenter: { x: number; z: number };
  run: RunState;
  /** Späti rest stops: the one the hero stands in (-1 = none) and which were visited. */
  rest: { at: number; seen: boolean[] };
  rng: Rng;
  nextId: number;
  kills: number;
  spawnT: number;
  /** > 0: keep this many enemies alive (`?stress=`). */
  stress: number;
}
