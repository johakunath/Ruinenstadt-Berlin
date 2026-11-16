import { createAbilities, updateAbilities } from './abilities';
import { hurtPlayer, strike, updateStatuses } from './combat';
import { createContent, updateContent } from './runcontent';
import { createInventory, type Inventory } from './inventory';
import { createBreakables, sweepBreakables } from './breakables';
import { updateDrops } from './loot';
// The simulation: one fixed 60 Hz step. No rendering, no DOM, no Three.js; unit tested.
import { PLAYER, WEAPON } from '../data/combat';
import { DEFAULT_DIFFICULTY, type DifficultyId } from '../data/difficulty';
import { courtyardLevel } from '../data/courtyard';
import { SPAWN } from '../data/enemies';
import { sectorHitsCircle } from './collide';
import { ferryPos, onFerryBoat } from './ferry';
import { focusFlow, followFlow, startRunAt, updateDirector } from './director';
import { randomYardSpot, removeCorpses, resolveBodies, spawnEnemy, updateEnemies, updateSpawner } from './enemies';
import { FlowField } from './flowfield';
import type { Level } from './level';
import { lerp, Rng } from './math';
import { starterEquipment, statContext } from './loadout';
import { heroStats, type Equipment, type StatContext } from './stats';
import { updateRest } from './rest';
import { createPlayer, releaseSwing, updatePlayer } from './player';
import { DT, type Sim, type SimInput } from './types';

export interface SimOptions {
  difficulty?: DifficultyId;
  inventory?: Inventory;
  equipment?: Equipment;
  statContext?: Partial<StatContext>;
  seed?: number;
  /** Keep this many enemies alive from the first step (`?stress=40`). */
  stress?: number;
  /** Skip the opening group and the spawner (tests place enemies themselves). */
  empty?: boolean;
  /** Map; the gate 1 courtyard when left out. */
  level?: Level;
  /** Expedition maps: start at this encounter (retry after death starts at its zone's entry). */
  startAt?: number;
  /** Built from a checkpoint: no run-start gifts, the saved run content is put back by the caller. */
  resume?: boolean;
}

export function createSim(opts: SimOptions = {}): Sim {
  const level = opts.level ?? courtyardLevel();
  level.restore();
  const startAt = opts.startAt ?? 0;
  const zone = level.encounters[startAt]?.zone ?? 0;
  const entry = startAt > 0 ? level.zones[zone]?.entry : undefined;
  const equipment = structuredClone(opts.equipment ?? starterEquipment());
  const context = statContext(opts.statContext);
  const stats = heroStats(equipment, context);
  const sim: Sim = {
    abilities: createAbilities(),
    difficulty: opts.difficulty ?? DEFAULT_DIFFICULTY,
    equipment, statContext: context, stats,
    inventory: structuredClone(opts.inventory ?? createInventory()),
    tick: 0,
    time: 0,
    player: createPlayer(level, entry),
    enemies: [],
    events: [],
    hitstop: 0,
    consumed: { attack: false, dodge: false, power: false, ultimate: false, verband: false, molotow: false },
    content: { plan: [], done: [], timer: 0, hidden: [], shrines: [], shrine: {}, trader: null, tradeOpen: false, tradeAt: -1, shops: [], captive: null, cache: null, zone: null, crate: null, rng: 1 },
    level,
    colliders: level.colliders,
    flow: level.expedition ? new FlowField({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, []) : new FlowField(level.bounds, level.colliders),
    flowCenter: { x: 0, z: 0 },
    run: { index: 0, phase: 'travel', wave: 0, toSpawn: 0, bossesToSpawn: [], spawnT: 0, pauseT: 0 },
    rest: { at: -1, seen: [] },
    rng: new Rng(opts.seed ?? 1),
    nextId: 1,
    drops: [],
    breakables: createBreakables(level.breakables),
    lootWaves: 0,
    lootCtx: { district: 0, luck: stats.luck, wave: 1, itemId: 0 },
    bagFullT: 0,
    kills: 0,
    spawnT: opts.empty || (level.expedition && !opts.stress) ? Infinity : 1.5,
    stress: opts.stress ?? 0,
  };
  sim.lootCtx.itemId = Math.max(0, ...[...sim.inventory.bag, ...Object.values(equipment)].map((i) => i?.id ?? 0));
  sim.player.hp = stats.maxHp;
  // 2D run start: Dr. Ahmet brings one more Verband, the Sanitätszelt makes it at least two.
  const cons = sim.inventory.consumables ?? { verband: 0, molotow: 0 };
  if (!opts.resume) {
    if (context.survivors.doktor) cons.verband = Math.min(3, cons.verband + 1);
    if (context.camp.sani) cons.verband = Math.max(cons.verband, 2);
    if (context.camp.garten) sim.abilities.fed = 60;
  }
  sim.inventory.consumables = cons;
  if (!opts.empty && !opts.resume) sim.content = createContent(sim, opts.seed ?? 1);
  if (level.expedition) {
    startRunAt(sim, startAt);
    focusFlow(sim, sim.player.x, sim.player.z);
  }
  sim.flow.setTarget(sim.player.x, sim.player.z);
  if (!opts.empty && (!level.expedition || sim.stress > 0)) {
    const opening = sim.stress > 0 ? sim.stress : SPAWN.startAlive - 2;
    for (let i = 0; i < opening; i++) {
      const s = randomYardSpot(sim, 6);
      spawnEnemy(sim, s.x, s.z);
    }
  }
  sim.events.length = 0;
  return sim;
}

/** Advances the world by one fixed step. */
export function stepSim(sim: Sim, input: SimInput): void {
  sim.consumed.power = sim.consumed.ultimate = sim.consumed.verband = sim.consumed.molotow = false;
  sim.consumed.attack = false;
  sim.consumed.dodge = false;
  const p = sim.player;
  p.px = p.x;
  p.pz = p.z;
  p.pfacing = p.facing;
  for (const e of sim.enemies) {
    e.px = e.x;
    e.pz = e.z;
    e.pfacing = e.facing;
  }
  // Hitstop: attacker and targets freeze; the input layer keeps buffering.
  if (sim.hitstop > 0) {
    sim.hitstop = Math.max(0, sim.hitstop - DT);
    return;
  }
  // After the hitstop check: the boat stands still while the world is frozen.
  rideFerries(sim);
  updatePlayer(sim, input);
  followFlow(sim);
  sim.flow.setTarget(p.x, p.z);
  updateEnemies(sim);
  resolveBodies(sim);
  playerSweep(sim);
  updateAbilities(sim, input);
  updateStatuses(sim);
  updateDrops(sim);
  enemyStrikes(sim);
  removeCorpses(sim);
  if (sim.level.expedition && sim.stress === 0) updateDirector(sim);
  else updateSpawner(sim);
  updateRest(sim);
  updateContent(sim);
  sim.tick++;
  sim.time += DT;
}

/** Bodies on a ferry boat move with it; the walk check then uses the boat at the end of this step. */
function rideFerries(sim: Sim): void {
  const lv = sim.level;
  lv.time = sim.time;
  if (lv.ferries.length === 0) return;
  for (const f of lv.ferries) {
    const a = ferryPos(f, sim.time);
    const b = ferryPos(f, sim.time + DT);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (dx === 0 && dz === 0) continue;
    for (const body of [sim.player, ...sim.enemies]) {
      if (!onFerryBoat(f, sim.time, body.x, body.z)) continue;
      body.x += dx;
      body.z += dz;
      // The step's rollback position (`Level.resolve`) moves too, or it would lie over water.
      // Render interpolation then starts one step (about 2 cm) ahead; not visible.
      body.px += dx;
      body.pz += dz;
    }
  }
  lv.time = sim.time + DT;
}

/** Sweeps the weapon arc through this step's slice of the active frames. One hit per target per swing. */
function playerSweep(sim: Sim): void {
  const p = sim.player;
  const a = p.attack;
  p.sweeping = false;
  if (p.state !== 'attack' || !a) return;
  const t1 = p.stateT;
  const t0 = t1 - DT;
  if (t1 < a.windup || t0 >= a.windup + a.active) return;
  if (t0 < a.windup) releaseSwing(sim);
  if (a.style === 'throw') return;
  const f0 = Math.max(0, (t0 - a.windup) / a.active);
  const f1 = Math.min(1, (t1 - a.windup) / a.active);
  const a0 = lerp(a.from, a.to, f0);
  const a1 = lerp(a.from, a.to, f1);
  const lo = Math.min(a0, a1) - a.width;
  const hi = Math.max(a0, a1) + a.width;
  p.sweeping = true;
  p.sweepLo = lo;
  p.sweepHi = hi;
  if (sim.breakables.length > 0) sweepBreakables(sim, lo, hi, a.inner, a.reach);
  const hammer = sim.stats.kind === 'hammer';
  for (const e of sim.enemies) {
    if (e.state === 'dead' || p.hits.includes(e.id)) continue;
    if (!sectorHitsCircle(p.x, p.z, p.facing, lo, hi, a.inner, a.reach, e.x, e.z, e.def.radius)) continue;
    p.hits.push(e.id);
    strike(sim, e, a.damage, {
      crit: p.critical, knock: a.knockback, feel: p.critical || p.wucht ? 'heavy' : a.weight,
      stun: Math.max(hammer ? WEAPON.hammer.stun : 0, p.wucht ? WEAPON.wucht.stun : 0),
    });
  }
}

function enemyStrikes(sim: Sim): void {
  const p = sim.player;
  if (p.state === 'dead') return;
  for (const e of sim.enemies) {
    if (e.state !== 'strike' || e.struck) continue;
    if (p.invuln > 0 || p.hurtT < PLAYER.hitGrace) continue;
    const def = e.def;
    if (!sectorHitsCircle(e.x, e.z, e.facing, -def.halfAngle, def.halfAngle, 0, def.reach, p.x, p.z, PLAYER.radius)) continue;
    e.struck = true;
    let dx = p.x - e.x;
    let dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    hurtPlayer(sim, e, def.damage * e.dmgMul, dx, dz);
    if ((p.state as string) === 'dead') return;
  }
}
