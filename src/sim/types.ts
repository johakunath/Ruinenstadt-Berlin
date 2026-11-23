import type { Inventory } from './inventory';
import type { IngredientId, MaterialId } from '../data/crafting';
import type { Breakable, BreakableKind } from './breakables';
import type { Drop } from './loot';
import type { LootContext } from './items';
import type { AttackDef, AttackId, HitWeight } from '../data/combat';
import type { EliteMod, EnemyDef, EnemyKind } from '../data/enemies';
import type { Special, SpecialKind, Threats, ZoneKind } from './threats';
import type { Collider } from './collide';
import type { FlowField } from './flowfield';
import type { Level } from './level';
import type { Rng } from './math';
import type { DifficultyId } from '../data/difficulty';
import type { Equipment, HeroStats, StatContext } from './stats';
import type { ElementId } from '../data/items';

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
  power?: boolean;
  ultimate?: boolean;
  /** Consumables (M16): Verband, Molotow. */
  verband?: boolean;
  molotow?: boolean;
}

export const NO_INPUT: SimInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, aimAssist: false, attack: false, dodge: false };

/** `cast`: committed to a power or a throw (`Player.cast`). */
export type PlayerState = 'move' | 'attack' | 'dodge' | 'cast' | 'dead';

/** A running cast: the effect happens at `fire`, the hero is free again at `dur`. */
export interface Cast {
  id: import('../data/powers').PowerId | 'molotow';
  dur: number;
  fire: number;
  fired: boolean;
  /** Leaps and the Fechtsprung move the hero from here to there. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Thrown things land here. */
  tx: number;
  tz: number;
}

export interface Player {
  /** M17 (T4): sim time a clock hand last hit the hero, and the hands (bits) that hit it in their current pass. */
  handT?: number;
  handIn?: number;
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
  cast: Cast | null;
  /** The current swing is a finisher / a Wucht hit (Gegengewicht). */
  finisher: boolean;
  wucht: boolean;
  /** Gear speed and critical roll captured when this swing starts. */
  attackSpeed: number;
  critical: boolean;
  /** Counts swings; render uses it to restart clips and trails. */
  swing: number;
  /** Enemy ids already hit by the current swing. */
  hits: number[];
  /** Breakable ids already hit by the current swing. */
  propHits: number[];
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
  /** M12c shove: knock velocity on top of the player's own, damped every step (`pushPlayer`). */
  kx: number;
  kz: number;
  /** Seconds the hero cannot walk: M15 Wurzler roots or the M12c Türsteher grab (a roll breaks free; attacks and powers work). */
  root: number;
  /** Who holds the hero (Türsteher id, 0: roots or nobody); immunity after a Wurzler root. */
  rootBy: number;
  rootI: number;
  /** M15 Stillstand of the Weltzeituhr: the hero walks at half speed for this long. */
  slowT: number;
}

/** `special`: a telegraphed special attack runs (`Enemy.sp`, `src/sim/ai.ts`). */
export type EnemyState = 'chase' | 'windup' | 'strike' | 'recover' | 'special' | 'stagger' | 'dead';

export interface Enemy {
  /** M17 (T4): sim time a clock hand last hit this body, and the hands (bits) that hit it in their current pass. */
  handT?: number;
  handIn?: number;
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
  /** Life and damage multipliers from the wave tier (adds and splits inherit them). */
  hpMul: number;
  dmgMul: number;
  /** Running special attack, null otherwise. */
  sp: Special | null;
  /** Punish window: stands still and takes more damage. */
  open: number;
  /** Crows sit dazed after a dive. */
  rest: number;
  /** Driven by a roar: faster for this long. */
  buff: number;
  /** Cooldowns of up to three specials, a shared pause between them, and a cycle counter. */
  cd: [number, number, number];
  gap: number;
  cycle: number;
  /** Strafing and orbit direction, orbit angle. */
  side: 1 | -1;
  orb: number;
  /** Bosses below half life. */
  rage: boolean;
  /** Fire trail timer (elite Brennend). */
  trailT: number;
  state: EnemyState;
  stateT: number;
  staggerDur: number;
  /** The current strike already landed. */
  struck: boolean;
  /** Burning: seconds left and damage per second (2D `burn`, `bdps`). */
  burn: number;
  bdps: number;
  /** Burn damage not yet reported as a `dot` event. */
  burnAcc: number;
  /** Verätzt: takes more damage (and is slower with Zersetzung). */
  acid: number;
  /** Slowed to 60% (Krähenfeder shots). */
  slow?: number;
  /** Elite modifier (2D ×2.6 life, better loot, a special); rescue guards carry `guard`. */
  elite?: EliteMod;
  /** Split off a dying Spaltend elite: small, no loot. */
  mini?: boolean;
  guard?: boolean;
  /** Sleeps until the hero comes this close or hurts it (side passage mini-boss). */
  sleep?: number;
  /** M11c: how a sleeping guard waits: playing dead on the ground or unseen in a doorway/under rubble. */
  pose?: 'lying' | 'hidden';
  /** Lying guard getting up: seconds left (`THREAT.rise`); it neither moves nor strikes meanwhile. */
  rise?: number;
  /** Index into `level.guards` for side passage guards (saved as defeated). */
  guardIndex?: number;
  /** The last hit was critical (kill effects). */
  lastCrit?: boolean;
  /** M12c: a special that follows this one after `t` seconds (Türsteher rage shove, the Basspredigt). */
  queue?: { kind: SpecialKind; t: number };
  /** M12c: one-time boss calls already made (the Dirigent's Orchester). */
  calls?: number;
  /** WP5 Zünder: it blew itself up (no second, smaller blast on death). */
  blown?: boolean;
  /** M15 shield bearers: the guard stands open this long (a stun or shock opened it). */
  guardOpen?: number;
  /** Seconds until the next "geblockt" note may show. */
  noteT?: number;
  /** M15: still waking up (untouchable, does nothing): the Weltzeituhr on its base. */
  wake?: number;
  /** M15: a ring spins and sprays for this long (Koloss gears, Weltzeituhr orbit); `sprayT` times the shots. */
  spin?: number;
  sprayT?: number;
  /** M15 Weltzeituhr: Stillstand thresholds already passed. */
  still?: number;
  /** Map colliders it stands in while awake (the Weltzeituhr's base); they come back when it dies. */
  stand?: Collider[];
  /** Where it stood before it woke (the Weltzeituhr's base): render walks it back there when it dies. */
  home?: { x: number; z: number };
  /** M16 Spiegelbild: the body it reflects (it cannot be hurt and dies with it) and the centre it is reflected through. */
  mirrorOf?: number;
  mirror?: { x: number; z: number };
  /** The encounter (`run.index`) whose waves brought it; only these hold a fight open (`encounterAlive`). Endless waves use the encounter count. */
  enc?: number;
  /** M16 Spiegelpaar: the id of her reflection. */
  pair?: number;
  /** M16 Ringvater: „Erst die Leibwache!“ was shown for the guard he has now. */
  guardNote?: boolean;
  /** M16 Diva: fans still to throw after the first one: how many, seconds to the next, its aim and its index. */
  fans?: { n: number; t: number; aim: number; k: number };
}

/** What healed the hero (`healPlayer` in heal.ts). */
export type HealSource = 'regen' | 'rest' | 'verband' | 'banner' | 'leech' | 'kill' | 'pickel' | 'breath' | 'pickup' | 'food' | 'trader' | 'encounter' | 'endless' | 'blessing' | 'secondWind';

export type SimEvent =
  | { type: 'swing'; attack: AttackId; weight: HitWeight }
  | { type: 'hit'; id: number; x: number; z: number; dx: number; dz: number; weight: HitWeight; killed: boolean; damage: number; critical?: boolean; element?: ElementId; quiet?: boolean; note?: string; /** D9: the weapon fits the enemy's class. */ effective?: boolean }
  /** Burn damage summed over a short time (no hit feel). */
  | { type: 'dot'; id: number; x: number; z: number; damage: number; killed: boolean }
  | { type: 'ability'; id: import('../data/powers').PowerId; name: string; ultimate: boolean }
  /** The effect of a cast happens now (sound, flash). */
  | { type: 'abilityFire'; id: import('../data/powers').PowerId | 'molotow'; x: number; z: number }
  | { type: 'shock'; x: number; z: number; radius: number; kind: 'earth' | 'small' | 'blade' | 'guard' | 'acid' }
  | { type: 'bolt'; x0: number; z0: number; x1: number; z1: number }
  | { type: 'impact'; x: number; z: number; radius: number; kind: 'strike' | 'molotov' | 'boom' }
  | { type: 'ignite'; id: number; x: number; z: number }
  /** Life restored (`healPlayer`): exact, may be fractional. `tick`: a small repeated heal (regen, Verband, leech). */
  | { type: 'heal'; amount: number; source: HealSource; tick?: true }
  | { type: 'consumable'; id: 'verband' | 'molotow'; left: number }
  | { type: 'note'; text: string; color: string; x: number; z: number }
  | { type: 'secondWind' }
  | { type: 'blessing'; id: import('../data/progression').PerkId; level: number }
  | { type: 'runEvent'; kind: import('./runcontent').RunEventKind | 'crate'; phase: 'start' | 'done' | 'lost'; x: number; z: number; text?: string }
  | { type: 'shrine'; id: import('../data/progression').ShrineId; x: number; z: number }
  | { type: 'hidden'; x: number; z: number; found: number; total: number }
  | { type: 'trade' }
  /** A purchase went through (A2: coin sound). */
  | { type: 'buy' }
  | { type: 'streak'; kills: number; scrap: number }
  | { type: 'dodge' }
  | { type: 'playerHit'; x: number; z: number; dx: number; dz: number; damage: number; /** Life right after the hit, before a second wind (telemetry's lowest life). */ hp: number; /** What hit (enemy name, or the enemy and its attack), for the death summary. */ by: string }
  | { type: 'playerDie' }
  | { type: 'enemyWindup'; id: number }
  | { type: 'enemyStrike'; id: number }
  /** A special attack starts its wind-up (`wind`) or is released (`go`). */
  | { type: 'enemySpecial'; id: number; kind: SpecialKind; phase: 'wind' | 'go'; x: number; z: number }
  /** A marked ground zone goes off. */
  | { type: 'zoneHit'; kind: ZoneKind; x: number; z: number; r: number; hit: boolean; /** M16: the zone's source (a glass burst: the body that broke). */ src?: number }
  | { type: 'enemyShot'; x: number; z: number; boss: boolean }
  /** M12c: a Wachdrohne searchlight locked onto the hero; the volley follows. */
  | { type: 'spotLock'; id: number; x: number; z: number }
  /** M16: a gown tier of the Diva bursts (1 at 66 % life, 2 at 33 %). */
  | { type: 'divaTier'; id: number; tier: number; x: number; z: number }
  | { type: 'bossRage'; id: number; name: string }
  | { type: 'summon'; id: number; x: number; z: number; count: number }
  | { type: 'spawn'; id: number }
  | { type: 'encounterStart'; index: number; /** The hero's life as the fight starts (telemetry `h0`). */ hp: number }
  | { type: 'waveStart'; index: number; wave: number; waves: number }
  | { type: 'encounterClear'; index: number; heal: number }
  | { type: 'zoneClear'; zone: number }
  /** The hero walked into a Späti (`first`: the first time this run). */
  | { type: 'restEnter'; index: number; first: boolean }
  | { type: 'victory' }
  /** A wave or encounter just ended: the game loop saves (M6, B1). */
  | { type: 'checkpoint' }
  /** A drop popped out (`rarity` -1: heal or material). */
  | { type: 'drop'; id: number; x: number; z: number; rarity: number; set: boolean }
  | { type: 'dropLand'; id: number; x: number; z: number; rarity: number }
  | { type: 'legendary'; x: number; z: number }
  | { type: 'pickup'; id: number; what: 'item' | 'heal' | 'material' | 'food' | 'ingredient'; x: number; z: number; rarity: number; amount: number; name?: string; upgrade?: boolean; set?: boolean; material?: MaterialId; ingredient?: IngredientId }
  | { type: 'scrap'; amount: number; x: number; z: number }
  | { type: 'bagFull' }
  /** M18: an endless wave starts (n from 1) or is won. */
  | { type: 'endlessWave'; n: number; done: boolean }
  /** U2: first kill of a kind or first find of a legendary or set base. */
  | { type: 'kodex'; name: string }
  /** A Fund was picked up (2D #14, #27): banner title and line. */
  | { type: 'fund'; kind: 'teil' | 'kassette'; x: number; z: number; title: string; line: string }
  | { type: 'breakableHit'; id: number; kind: BreakableKind; x: number; z: number; hp: number }
  | { type: 'breakableBreak'; id: number; kind: BreakableKind; x: number; z: number; inside: boolean }
  /** P25 Türsteher neon bars at the Tor: strip lit (`wind`), bars shut, bars open; at the middle passage. */
  | { type: 'barrier'; phase: 'wind' | 'shut' | 'open'; x: number; z: number }
  /** M20 tunnel: a grating opened after its fight was won (2D `openGate`). */
  | { type: 'gateOpen'; index: number; x: number; z: number }
  /** M20 tunnel: the hero reached the generator; hold the ring (2D GEN). */
  | { type: 'holdStart'; index: number; x: number; z: number }
  /** M20 tunnel: the generator is charged, the end platform has power ("Strom!"). */
  | { type: 'power'; index: number; x: number; z: number }
  /** M17 Fernsehturm: the hero rode lift `index` to (x, z) on the next deck (T2). */
  | { type: 'lift'; index: number; x: number; z: number };

export type RunPhase = 'travel' | 'fight' | 'pause' | 'hold' | 'won';

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
  /** M18 endless mode after the district boss: waves survived so far, absent outside it. */
  endless?: number;
  /** M13: the expedition's camp effects were settled (`endExpedition` runs once). */
  ended?: boolean;
  /** M20 generator hold (`EncounterDef.hold`): charge in seconds, the hero stands in the ring, next spawn, elite sent, sim time the power came. */
  hold?: { p: number; need: number; inside: boolean; sp: number; elite: boolean; on?: number };
}

export interface Sim {
  /** Debug (?god, ?tp): the hero takes no damage. */
  god?: boolean;
  abilities: import('./abilities').Abilities;
  difficulty: DifficultyId;
  inventory: Inventory;
  equipment: Equipment;
  statContext: StatContext;
  stats: HeroStats;
  tick: number;
  time: number;
  player: Player;
  enemies: Enemy[];
  /** What enemies put into the world: marked zones, shots, ground hazards, roar rings (M12). */
  threats: Threats;
  /** Filled during a step; the game loop drains it after every step. */
  events: SimEvent[];
  /** Remaining freeze in seconds. While > 0 the world holds still; input is still buffered outside. */
  hitstop: number;
  /** Buffered presses used by the last step. */
  consumed: { attack: boolean; dodge: boolean; power: boolean; ultimate: boolean; verband: boolean; molotow: boolean };
  /** Run content (M16): events, hidden blessings, shrines, the trader. */
  content: import('./runcontent').RunContent;
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
  /** Ground loot (M4) and the props the hero can still break. */
  drops: Drop[];
  breakables: Breakable[];
  /** Normal waves started this run (boss waves excluded); drives the item level. */
  lootWaves: number;
  lootCtx: LootContext;
  /** Seconds until the next "bag full" notice. */
  bagFullT: number;
  kills: number;
  spawnT: number;
  /** > 0: keep this many enemies alive (`?stress=`). */
  stress: number;
  /** M20 tunnel gratings (`level.gates`): sim time each one opened, Infinity while closed. */
  gateT: number[];
  /** P25 Türsteher neon bars (`level.barriers`): phase, seconds left in it, the boss that set it. */
  barrier: { state: 'idle' | 'wind' | 'shut'; t: number; src: number };
  /** M12c rain (2D `D.wet`, from the map; tunnels and the camp are dry): fire burns shorter, shock jumps further. */
  wet: boolean;
  /** M16 „Glas splittert“ (from the map; other maps, tunnels and the camp: off): glass bodies burst when they die. */
  shards: boolean;
  /** M17 Fernsehturm (T2): the open lift ring the hero stands in and for how long, null outside one. */
  lift?: { i: number; t: number } | null;
}
