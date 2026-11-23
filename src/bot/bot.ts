// Balance bot (M14; 2D tools/sim.js). Plays the sim through `SimInput` like a person would:
// walks the route, fights, steps out of marked zones, rolls through shots and rings, picks up
// loot, wears upgrades, takes blessings, rests in a Späti. Its skill is a handful of numbers
// 2026-11-21 (Johannes: make it play like him, 2D tools/sim.js v0.99): blessings by economy need,
// build and how hard the last fights were; heal drops when low; Späti shopping; a camp step between
// districts (meals, Lazarett, workshop, drill, stations, Aufsätze, implant mode). Its own
// (`BotSkill`) meant to be fitted to Johannes' telemetry (B9): how often it overlooks a telegraph
// and how long it takes to react. No DOM, no rendering: runs in Node (tools/balance.mjs) and tests.
// B2 step 1 (economy, first guesses in `docs/tasks/b2-economy-pacing.md`): salvages what it will not
// wear, walks to Spätis and traders and buys by item level, builds the camp cheapest first, holds the
// tunnel generator ring, and books every Schrott it earns and spends in a `Ledger`.
import { PLAYER, weaponAttack } from '../data/combat';
import type { DifficultyId } from '../data/difficulty';
import { chooseBlessing } from '../sim/blessings';
import { colliderDistance, type Collider } from '../sim/collide';
import { ferryPos } from '../sim/ferry';
import { BAG_SIZE, equipItem, salvageItem } from '../sim/inventory';
import type { Item } from '../sim/items';
import type { Level } from '../sim/level';
import { Rng } from '../sim/math';
import { profileOf, type SaveProfile } from '../sim/save';
import { buildMod, buildStation, buyDrill, buySpatiUpgrade, buyUpgrade, cookMeal, craftConsumable, drillCost, endExpedition, installMod, modSlots, nextLevel, removeMod, SPATI_UPGRADE, spatiUpgradeCost, stationBuilt, upgradeCost, upgradeMax } from '../sim/camp';
import { buyConsumable, buyOffer, closeTrade, talkTo, tradeStock, type TradeOffer } from '../sim/runcontent';
import { heldFamilies, perkOf } from '../sim/blessings';
import { pk } from '../sim/combat';
import { setImplantMode } from '../sim/inventory';
import { CAMP_UPGRADES, type PerkFamilyId, type PerkId } from '../data/progression';
import { CONSUMABLES, MEALS, WEAPON_MODS, type WeaponModId } from '../data/crafting';
import { IMPLANT_MODES } from '../data/items';
import { campOpen } from '../data/lines';
import { STATIONS } from '../data/camp';
import { gateBetween } from '../sim/director';
import { createSim, stepSim } from '../sim/sim';
import { heroStats, power } from '../sim/stats';
import { DT, type Enemy, type Sim, type SimInput } from '../sim/types';
import { inZone, lineOffset, sweepAngle } from '../sim/threats';
import { guarded } from '../sim/combat';

export interface BotSkill {
  /** Share of telegraphs (zones, shots, rushes, wind-ups) the bot does not react to at all. */
  miss: number;
  /** Seconds between seeing a telegraph and acting on it. */
  react: [number, number];
  /** Share of plain melee wind-ups it answers with a dodge (people mostly trade or step back). */
  dodgeMelee: number;
  /** Uses Verband below this share of life. */
  bandageAt: number;
  /** Share of the time in reach it actually attacks (a person repositions, looks, hesitates). */
  tempo: number;
}

/**
 * Fitted to Johannes' first full 3D run (2026-11-16, pad, old roster; `docs/balance.md`): he took
 * less damage than the 2D start values predicted (30 % missed) and needed about 1.4 times the
 * bot's fight time. So: few missed telegraphs, quick reactions, attacks about 70 % of the time.
 */
export const SKILL_DEFAULT: BotSkill = { miss: 0.12, react: [0.2, 0.35], dodgeMelee: 0.75, bandageAt: 0.45, tempo: 0.7 };
/** A sharper player and a careless one, to bracket the curve. */
export const SKILL_GOOD: BotSkill = { miss: 0.05, react: [0.15, 0.25], dodgeMelee: 0.9, bandageAt: 0.5, tempo: 0.9 };
export const SKILL_WEAK: BotSkill = { miss: 0.4, react: [0.3, 0.6], dodgeMelee: 0.35, bandageAt: 0.35, tempo: 0.6 };

// ---------------------------------------------------------------- navigation

const CELL = 1;
const BODY = 0.42;

/** Walkable cells of a level, with ferry lanes open, and a distance field to one target. */
class Nav {
  readonly cols: number;
  readonly rows: number;
  private readonly free: Uint8Array;
  private readonly dist: Int32Array;
  private tx = NaN;
  private tz = NaN;

  /** M20 tunnel gratings: closed when the grid is built, open later; the route runs through them (the next fight lies behind one only once it is open). */
  private readonly gates: ReadonlySet<Collider>;

  constructor(private readonly level: Level) {
    const b = level.bounds;
    this.gates = new Set(level.gates.map((g) => g.collider));
    this.cols = Math.ceil((b.maxX - b.minX) / CELL);
    this.rows = Math.ceil((b.maxZ - b.minZ) / CELL);
    this.free = new Uint8Array(this.cols * this.rows);
    this.dist = new Int32Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const x = b.minX + (c + 0.5) * CELL, z = b.minZ + (r + 0.5) * CELL;
      const solid = level.near(x, z, BODY + 0.1).some((k) => !this.gates.has(k) && colliderDistance(k, x, z) < BODY);
      this.free[r * this.cols + c] = !solid && (!level.blocked(x, z, BODY) || this.onLane(x, z)) ? 1 : 0;
    }
  }

  /** Forget the last distance field (a new bot starts without one). */
  reset(): void {
    this.tx = NaN;
    this.tz = NaN;
  }

  /** Inside a ferry lane (pier to pier): the boat will come. */
  onLane(x: number, z: number): boolean {
    for (const f of this.level.ferries) {
      const dx = x - f.x, dz = z - f.z;
      const along = dx * Math.sin(f.rot) + dz * Math.cos(f.rot);
      const across = dx * Math.cos(f.rot) - dz * Math.sin(f.rot);
      if (Math.abs(along) <= f.len / 2 && Math.abs(across) <= f.width / 2 - 0.3) return true;
    }
    return false;
  }

  private cell(x: number, z: number): number {
    const b = this.level.bounds;
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x - b.minX) / CELL)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((z - b.minZ) / CELL)));
    return r * this.cols + c;
  }

  /** The cell under (x, z) is walkable ground of the grid. */
  isFree(x: number, z: number): boolean {
    return this.free[this.cell(x, z)] === 1;
  }

  private target(x: number, z: number): void {
    if (Math.abs(x - this.tx) < 1.5 && Math.abs(z - this.tz) < 1.5) return;
    this.tx = x;
    this.tz = z;
    this.dist.fill(-1);
    const start = this.cell(x, z);
    const queue = [start];
    this.dist[start] = 0;
    for (let h = 0; h < queue.length; h++) {
      const i = queue[h]!;
      const c = i % this.cols, r = (i - c) / this.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
        const n = rr * this.cols + cc;
        if (this.dist[n] !== -1 || !this.free[n]) continue;
        this.dist[n] = this.dist[i]! + 1;
        queue.push(n);
      }
    }
  }

  /** No wall or prop crosses the straight line from (x, z) to (tx, tz) (a thin probe every 0.25 m). */
  private clear(x: number, z: number, tx: number, tz: number): boolean {
    const n = Math.max(1, Math.ceil(Math.hypot(tx - x, tz - z) / 0.25));
    for (let k = 1; k <= n; k++) {
      const px = x + ((tx - x) * k) / n, pz = z + ((tz - z) * k) / n;
      if (this.level.near(px, pz, 0.2).some((c) => !this.gates.has(c) && colliderDistance(c, px, pz) < 0.05)) return false;
    }
    return true;
  }

  /** Unit direction from (x, z) toward the target along walkable ground; null when there is no way. */
  toward(x: number, z: number, tx: number, tz: number, out: { x: number; z: number }): boolean {
    const d = Math.hypot(tx - x, tz - z);
    if (d < 2.5) {
      out.x = (tx - x) / (d || 1);
      out.z = (tz - z) / (d || 1);
      return true;
    }
    this.target(tx, tz);
    const b = this.level.bounds;
    let i = this.cell(x, z);
    if (this.dist[i] === -1) {
      // Standing on a blocked cell (prop edge, boat): take the best neighbor that can be walked to in a straight line.
      // M18 (bot run in the Magendoktor): without the line check it picked a cell behind the pub wall and pushed into it.
      let best = -1;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const n = i + dr * this.cols + dc;
        if (n < 0 || n >= this.dist.length || this.dist[n] === -1) continue;
        const nc = n % this.cols, nr = (n - nc) / this.cols;
        if (!this.clear(x, z, b.minX + (nc + 0.5) * CELL, b.minZ + (nr + 0.5) * CELL)) continue;
        if (best === -1 || this.dist[n]! < this.dist[best]!) best = n;
      }
      if (best === -1) return false;
      i = best;
    }
    // Walk the field a few cells ahead and aim there (smooths the staircase).
    let k = i;
    for (let s = 0; s < 4; s++) {
      const c = k % this.cols, r = (k - c) / this.cols;
      let next = k;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
        const n = rr * this.cols + cc;
        if (this.dist[n] === -1 || this.dist[n]! >= this.dist[next]!) continue;
        // No corner cutting.
        if (dc && dr && (!this.free[r * this.cols + cc] || !this.free[rr * this.cols + c])) continue;
        next = n;
      }
      if (next === k) break;
      k = next;
    }
    const c = k % this.cols, r = (k - c) / this.cols;
    const gx = b.minX + (c + 0.5) * CELL - x, gz = b.minZ + (r + 0.5) * CELL - z;
    const gl = Math.hypot(gx, gz) || 1;
    out.x = gx / gl;
    out.z = gz / gl;
    return true;
  }
}

const navs = new WeakMap<Level, Nav>();

// ---------------------------------------------------------------- bot

interface Seen { act: boolean; at: number }

export class Bot {
  private readonly rng: Rng;
  private readonly nav: Nav;
  private readonly seen = new WeakMap<object, Seen>();
  private readonly seenWind = new Map<number, Seen & { serial: number }>();
  private readonly dir = { x: 0, z: 0 };
  private readonly skip = new WeakSet<object>();
  private lootT = 0;
  private lootTarget: object | null = null;
  private stuckT = 0;
  private stuckX = 0;
  private stuckZ = 0;
  private detour = 0;
  private detourA = 0;
  private attackHeld = 0;

  constructor(private readonly sim: Sim, readonly skill: BotSkill, seed = 1, readonly ledger: Ledger = newLedger()) {
    this.rng = new Rng(seed * 7919 + 13);
    let nav = navs.get(sim.level);
    if (!nav) {
      nav = new Nav(sim.level);
      navs.set(sim.level, nav);
    }
    // B2 step 2: the grid is shared per level, its distance field is not; a field left from an earlier run
    // (reused when the first target lies within 1.5 m) made a run depend on what the process played before.
    nav.reset();
    this.nav = nav;
  }

  /** Has the bot noticed this telegraph, and is its reaction time over? */
  private aware(o: object): boolean {
    let s = this.seen.get(o);
    if (!s) {
      s = { act: this.rng.next() >= this.skill.miss, at: this.sim.time + this.rng.range(this.skill.react[0], this.skill.react[1]) };
      this.seen.set(o, s);
    }
    return s.act && this.sim.time >= s.at;
  }

  /** Lowest life share in the recent fights (decays back to 1): hard fights steer blessings to toughness. */
  recentLow = 1;
  /** B2: Spätis (rest index) and the trader (-1) shopped at in this life; one it cannot reach in `SHOP.giveUp` s counts too. */
  private readonly shopped = new Set<number>();
  private shopT = 0;
  private shopTarget = NaN;

  /** Between steps: blessings, gear, bag, shopping. */
  manage(): void {
    const s = this.sim;
    const a = s.abilities;
    this.recentLow = Math.min(1, Math.min(this.recentLow + DT / 120, s.player.hp / s.stats.maxHp));
    while (a.offers.length) {
      // 2D: one choice in ten is a whim; otherwise the best score.
      const best = this.rng.next() < 0.1 ? a.offers[Math.floor(this.rng.next() * a.offers.length)]! : [...a.offers].sort((x, y) => perkScore(s, y.id, y.level, this.recentLow) - perkScore(s, x.id, x.level, this.recentLow))[0]!;
      if (!chooseBlessing(s, best.id)) break;
    }
    equipBest(s, true);
    salvageSpare(s, this.ledger);
    // Späti or trader: open the trade once per stop and shop like a person.
    const c = s.content;
    if (c.talk != null && !c.tradeOpen && !this.shopped.has(c.talk) && s.run.phase === 'travel') {
      this.shopped.add(c.talk);
      if (talkTo(s)) { shop(s, this.ledger); closeTrade(s); }
    }
  }

  /** B2 step 2: the open run event to walk to (captive, cache, crate, radio zone), nearest first, within `EVENT_REACH`. */
  private eventGoal(): { key: object; x: number; z: number } | null {
    const s = this.sim, p = s.player, c = s.content;
    let out: { key: object; x: number; z: number } | null = null, bd: number = EVENT_REACH;
    for (const e of [c.captive, c.cache, c.crate, c.zone]) {
      if (!e || this.skip.has(e)) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bd) { bd = d; out = { key: e, x: e.x, z: e.z }; }
    }
    return out;
  }
  private eventKey: object | null = null;
  private eventT = 0;

  /** B2: the shop to walk to now: an unvisited Späti counter or the trader close by, while there is Schrott to spend. */
  private shopGoal(): { key: number; x: number; z: number } | null {
    const s = this.sim, p = s.player;
    if (s.run.phase !== 'travel' || s.inventory.scrap < SHOP.minScrap) return null;
    let best: { key: number; x: number; z: number } | null = null;
    let bd: number = SHOP.reach;
    const t = s.content.trader;
    if (t && !this.shopped.has(-1)) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < bd) { bd = d; best = { key: -1, x: t.x, z: t.z }; }
    }
    s.level.rests.forEach((r, i) => {
      if (!r.desk || this.shopped.has(i)) return;
      const d = Math.hypot(r.desk.x - p.x, r.desk.z - p.z);
      if (d < bd) { bd = d; best = { key: i, x: r.desk.x, z: r.desk.z }; }
    });
    return best;
  }

  input(): SimInput {
    const s = this.sim;
    const p = s.player;
    const inp: SimInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, aimAssist: true, attack: false, dodge: false };
    if (p.state === 'dead') return inp;
    if (this.nav.isFree(p.x, p.z)) { this.okX = p.x; this.okZ = p.z; }
    const T = s.threats;
    let mx = 0, mz = 0, threat = 0;
    let dodge = false;
    let dodgeX = 0, dodgeZ = 0;
    const flee = (x: number, z: number, w: number): void => {
      const d = Math.hypot(p.x - x, p.z - z) || 1;
      mx += ((p.x - x) / d) * w;
      mz += ((p.z - z) / d) * w;
      threat += w;
    };

    // Marked circles: out, and roll when it gets tight.
    for (const z of T.zones) {
      if (!this.aware(z)) continue;
      // M16 prism strip: step out sideways (away from its middle line), roll when it is about to hit or already does.
      if (z.line) {
        const off = lineOffset(z, p.x, p.z);
        if (off > z.line.width / 2 + 0.9) continue;
        const side = (p.x - z.x) * z.line.dz - (p.z - z.z) * z.line.dx >= 0 ? 1 : -1;
        mx += z.line.dz * side * 3;
        mz += -z.line.dx * side * 3;
        threat += 3;
        if (z.t < 0.25) dodge = true;
        continue;
      }
      // M15 hour sector: out of its slice (away from the slice's middle), roll when it is about to strike.
      if (z.sector) {
        if (!inZone(z, p.x, p.z, 0.9)) continue;
        const m = (z.sector.r0 + z.r) / 2;
        flee(z.x + Math.sin(z.sector.a) * m * 0.2, z.z + Math.cos(z.sector.a) * m * 0.2, 3);
        if (z.t < 0.3) dodge = true;
        continue;
      }
      const d = Math.hypot(p.x - z.x, p.z - z.z);
      if (d > z.r + 0.9) continue;
      flee(z.x, z.z, 3);
      const need = (z.r + 0.6 - d) / PLAYER.speed;
      if (z.t < need + 0.12) dodge = true;
    }
    for (const h of T.hazards) if (Math.hypot(p.x - h.x, p.z - h.z) < h.r + 0.8) flee(h.x, h.z, 1.5);
    // Shots: sidestep, roll when one is about to land.
    for (const q of T.shots) {
      if (!this.aware(q)) continue;
      const dx = p.x - q.x, dz = p.z - q.z;
      const d = Math.hypot(dx, dz);
      if (d > 4.5 || dx * q.vx + dz * q.vz <= 0) continue;
      const l = Math.hypot(q.vx, q.vz) || 1;
      const side = (dx * q.vz - dz * q.vx) / l;
      if (Math.abs(side) > 1.2) continue;
      const sg = side >= 0 ? 1 : -1;
      mx += (q.vz / l) * sg * 2;
      mz += (-q.vx / l) * sg * 2;
      threat += 2;
      if (d < 1.6) dodge = true;
    }
    // M12c searchlights: walk out before it locks; held by the Türsteher: roll free.
    for (const q of T.spots) if (this.aware(q) && Math.hypot(p.x - q.x, p.z - q.z) < q.r + 0.4) flee(q.x, q.z, 2.5);
    const holder = p.root > 0 ? s.enemies.find((e) => e.id === p.rootBy) : undefined;
    if (holder?.sp && this.aware(holder.sp)) dodge = true;
    // M15 minute hand: roll through it just before it reaches the hero.
    for (const w of T.sweeps) {
      if (w.hit || !this.aware(w)) continue;
      const d = Math.hypot(p.x - w.x, p.z - w.z);
      if (d > w.r + 0.8 || d < w.r0) continue;
      const t = Math.max(0, w.t - w.wind);
      const rate = w.w0 + ((w.w1 - w.w0) * Math.min(t, w.dur)) / w.dur;
      let ahead = Math.atan2(p.x - w.x, p.z - w.z) - sweepAngle(w, t);
      ahead -= Math.floor(ahead / (Math.PI * 2)) * Math.PI * 2;
      if (ahead / Math.max(0.3, rate) < 0.22) dodge = true;
    }
    // Roar rings: roll through.
    for (const w of T.waves) {
      if (w.hit || w.r <= 0 || !this.aware(w)) continue;
      const d = Math.hypot(p.x - w.x, p.z - w.z);
      const gap = d - w.r;
      if (gap > 0 && gap < 1.6) {
        dodge = true;
        dodgeX = (w.x - p.x) / (d || 1);
        dodgeZ = (w.z - p.z) / (d || 1);
      }
    }

    let near: Enemy | null = null;
    let nd = Infinity;
    let crowd = 0;
    for (const e of s.enemies) {
      // Sleeping guards (side passages, M11c lot types) are left alone until they wake up.
      if (e.state === 'dead' || e.sleep) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      // M16: the Spiegelbild is no target (its rush line below is still dodged).
      const target = e.mirrorOf === undefined;
      if (d < 5 && target) crowd++;
      // Prefer what is open, then what is closest; M16: a guarded boss (the Ringvater) only once his guards are down.
      const score = target ? d - (e.open > 0 ? 3 : 0) + (guarded(s, e) ? 12 : 0) : Infinity;
      if (score < nd) {
        nd = score;
        near = e;
      }
      // Rush lines: leave the line; roll when the rush is on its way.
      const sp = e.sp;
      if (e.state === 'special' && sp && sp.speed > 0 && this.aware(sp)) {
        const ax = p.x - e.x, az = p.z - e.z;
        const along = ax * sp.dx + az * sp.dz;
        const side = ax * sp.dz - az * sp.dx;
        if (along > -0.5 && along < sp.speed * sp.go + 1.5 && Math.abs(side) < e.def.radius + 1.1) {
          const sg = side >= 0 ? 1 : -1;
          mx += sp.dz * sg * 3;
          mz += -sp.dx * sg * 3;
          threat += 3;
          if (e.stateT >= sp.wind - 0.1 && along < sp.speed * 0.35) dodge = true;
        }
      }
      // Melee wind-ups.
      if (e.state === 'windup' && d < e.def.reach + 0.4) {
        let w = this.seenWind.get(e.id);
        const serial = Math.round((s.time - e.stateT) * 60);
        if (!w || w.serial !== serial) {
          w = { serial, act: this.rng.next() >= this.skill.miss && this.rng.next() < (e.def.poise ? 1 : this.skill.dodgeMelee), at: s.time + this.rng.range(this.skill.react[0], this.skill.react[1]) };
          this.seenWind.set(e.id, w);
        }
        if (w.act && s.time >= w.at && e.stateT > e.def.windup - 0.14) dodge = true;
      }
    }
    if (this.seenWind.size > 200) this.seenWind.clear();

    const kind = s.stats.kind;
    const ranged = kind === 'sling';
    const atk = weaponAttack(kind, 'light1');
    const reach = ranged ? 9 : atk.reach * s.stats.reachFactor;
    const low = p.hp < s.stats.maxHp * 0.3;

    if (near) {
      const d = Math.hypot(near.x - p.x, near.z - p.z);
      const ux = (near.x - p.x) / (d || 1), uz = (near.z - p.z) / (d || 1);
      inp.aimX = ux;
      inp.aimZ = uz;
      const want = ranged ? 6.5 : reach - 0.35 + near.def.radius;
      if (low && crowd >= 3 && !ranged) {
        // Kite: back off and circle.
        mx += -ux + -uz * 0.8;
        mz += -uz + ux * 0.8;
      } else if (d > want) {
        if (d < 9 && s.flow.clearLine(p.x, p.z, near.x, near.z)) {
          mx += ux;
          mz += uz;
        } else if (this.go(near.x, near.z)) {
          mx += this.dir.x;
          mz += this.dir.z;
        }
      } else if (ranged && d < 4) {
        mx -= ux;
        mz -= uz;
      }
      // M15 shield bearer facing the hero with its guard up: walk round it (it turns slower than the hero).
      const sh = near.def.shield;
      if (sh && (near.guardOpen ?? 0) <= 0 && d < want + 2.5) {
        const front = Math.cos(near.facing) * -uz + Math.sin(near.facing) * -ux;
        if (front > Math.cos(sh.arc)) {
          const side = Math.sin(near.facing) * uz - Math.cos(near.facing) * ux >= 0 ? 1 : -1;
          mx += -uz * side * 1.4;
          mz += ux * side * 1.4;
        }
      }
      if (d < reach + near.def.radius + 0.2 && threat < 3) {
        // A person mashes: press, release, press.
        this.attackHeld = (this.attackHeld + 1) % 6;
        // Bursts of about two seconds, then a pause that makes up the rest of `tempo`.
        inp.attack = this.attackHeld < 3 && (s.time % 3) < 3 * this.skill.tempo;
      }
      const tough = !!near.def.boss || !!near.elite;
      if (s.abilities.powerCd <= 0 && (crowd >= 3 || (tough && d < 4.5)) && d < (ranged ? 10 : 4.5)) inp.power = true;
      if (s.abilities.ultimateCd <= 0 && (crowd >= 5 || (tough && d < 6))) inp.ultimate = true;
      if ((s.inventory.consumables?.molotow ?? 0) > 0 && crowd >= 5 && this.rng.next() < 0.02) inp.molotow = true;
    } else {
      this.travel(inp);
      mx += inp.moveX;
      mz += inp.moveZ;
    }

    if (p.hp < s.stats.maxHp * this.skill.bandageAt && (s.inventory.consumables?.verband ?? 0) > 0 && s.abilities.hot <= 0) inp.verband = true;
    // 2D v0.99: below half life walk to a landed heal or Döner close by when the nearest enemy is not on top of it (below 30 % always).
    if (p.hp < s.stats.maxHp * 0.5 && near) {
      let heal: { x: number; z: number } | null = null, hd = 12;
      for (const d of s.drops) {
        if (!d.landed || this.skip.has(d) || (d.content.kind !== 'heal' && d.content.kind !== 'food')) continue;
        const q = Math.hypot(d.x - p.x, d.z - p.z);
        if (q < hd) { hd = q; heal = d; }
      }
      if (heal && (nd > 4 || p.hp < s.stats.maxHp * 0.3) && this.go(heal.x, heal.z)) {
        mx += this.dir.x * 1.5;
        mz += this.dir.z * 1.5;
      }
    }

    // M20 generator: the charge runs only while the hero stands in the ring, so fight from inside it.
    const enc = s.level.encounters[s.run.index];
    if (s.run.phase === 'hold' && enc?.hold) {
      const d = Math.hypot(enc.x - p.x, enc.z - p.z);
      if (d > enc.hold.r - 1.5) {
        mx += ((enc.x - p.x) / (d || 1)) * 4;
        mz += ((enc.z - p.z) / (d || 1)) * 4;
      }
    }

    // Stuck on a corner: walk a detour for a moment.
    this.stuckT += DT;
    if (this.stuckT > 1.2) {
      const moved = Math.hypot(p.x - this.stuckX, p.z - this.stuckZ);
      if (moved < 0.5 && Math.hypot(mx, mz) > 0.3 && !this.onBoatWait()) {
        this.detour = 0.7;
        this.detourA = this.rng.next() < 0.5 ? 1.4 : -1.4;
      }
      this.stuckT = 0;
      this.stuckX = p.x;
      this.stuckZ = p.z;
    }
    if (this.detour > 0) {
      this.detour -= DT;
      const a = Math.atan2(mx, mz) + this.detourA;
      mx = Math.sin(a);
      mz = Math.cos(a);
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 1e-3) {
      inp.moveX = mx / ml;
      inp.moveZ = mz / ml;
    } else {
      inp.moveX = inp.moveZ = 0;
    }
    if (dodge && p.dodgeCd <= 0 && p.state !== 'dodge') {
      inp.dodge = true;
      if (dodgeX || dodgeZ) {
        inp.moveX = dodgeX;
        inp.moveZ = dodgeZ;
      } else if (ml < 1e-3 && near) {
        // Nothing to run from in particular: roll sideways past the attacker.
        inp.moveX = (near.z - p.z) / (nd || 1);
        inp.moveZ = -(near.x - p.x) / (nd || 1);
      }
    }
    return inp;
  }

  /**
   * Sets `dir` toward (tx, tz) along the grid. B2 (Späti counters): the last metres to a target are walked
   * straight and can end on cells the grid calls blocked (inside a shop, by its counter) with no free
   * neighbour in a clear line; then it walks back straight to where it last stood on free ground.
   */
  private go(tx: number, tz: number): boolean {
    const p = this.sim.player;
    // The grid treats gratings as open; a target behind one that is still closed (loot, a heal drop) is out of reach.
    if (gateBetween(this.sim, p.x, p.z, tx, tz)) return false;
    if (this.nav.toward(p.x, p.z, tx, tz, this.dir)) return true;
    const d = Math.hypot(this.okX - p.x, this.okZ - p.z);
    if (!Number.isFinite(d) || d < 0.1) return false;
    this.dir.x = (this.okX - p.x) / d;
    this.dir.z = (this.okZ - p.z) / d;
    return true;
  }
  private okX = NaN;
  private okZ = NaN;
  private travelT = 0;
  private travelX = NaN;
  private travelZ = NaN;
  private escapeT = 0;
  private escapeA = 0;

  /** A heading whose ground 1.2 m ahead is free (eight tries from a random start), else the random start. */
  private freeHeading(): number {
    const p = this.sim.player, L = this.sim.level, a0 = this.rng.range(0, Math.PI * 2);
    for (let k = 0; k < 8; k++) {
      const a = a0 + (k * Math.PI) / 4, x = p.x + Math.sin(a) * 1.2, z = p.z + Math.cos(a) * 1.2;
      if (!L.blocked(x, z, BODY) && !L.near(x, z, BODY + 0.1).some((c) => colliderDistance(c, x, z) < BODY)) return a;
    }
    return a0;
  }

  private onBoatWait(): boolean {
    const p = this.sim.player;
    return this.nav.onLane(p.x, p.z) || this.sim.level.ferries.some((f) => Math.hypot(ferryPos(f, this.sim.time).x - p.x, ferryPos(f, this.sim.time).z - p.z) < 14);
  }

  /** No enemy in sight: loot, rest, then on to the objective. */
  private travel(inp: SimInput): void {
    const s = this.sim;
    const p = s.player;
    // B2 step 2: travel watchdog. Pressed against a Späti wall on a cell the grid calls blocked, `go` found
    // no way and the bot stood still until the run was given up (Mitte, Leipziger Straße). Not moving for
    // 4 s (healing in a Späti, holding a radio zone and the ferry aside): drop the shop it was after, walk 1 s to free ground.
    if (this.escapeT > 0) {
      this.escapeT -= DT;
      inp.moveX = Math.sin(this.escapeA);
      inp.moveZ = Math.cos(this.escapeA);
      return;
    }
    if ((this.travelT += DT) > 4) {
      const resting = s.rest.at >= 0 && p.hp < s.stats.maxHp;
      const Z = s.content.zone, holding = !!Z && Math.hypot(Z.x - p.x, Z.z - p.z) < Z.r;
      if (Math.hypot(p.x - this.travelX, p.z - this.travelZ) < 0.5 && !resting && !holding && !this.onBoatWait()) {
        if (!Number.isNaN(this.shopTarget)) this.shopped.add(this.shopTarget);
        this.escapeT = 1;
        this.escapeA = this.freeHeading();
      }
      this.travelT = 0;
      this.travelX = p.x;
      this.travelZ = p.z;
    }
    let tx = NaN, tz = NaN;
    // Loot nearby first; give up on a drop after six seconds (behind a wall).
    let best: { x: number; z: number } | null = null;
    let bd = 30;
    for (const d of s.drops) {
      if (!d.landed || this.skip.has(d)) continue;
      if (d.content.kind === 'heal' && p.hp >= s.stats.maxHp) continue;
      const q = Math.hypot(d.x - p.x, d.z - p.z);
      if (q < bd) {
        bd = q;
        best = d;
      }
    }
    if (best) {
      if (best === this.lootTarget) {
        this.lootT += DT;
        if (this.lootT > 6) {
          this.skip.add(best);
          best = null;
        }
      } else {
        this.lootTarget = best;
        this.lootT = 0;
      }
    }
    // B2 step 2 (P33): run events as Johannes plays them: free the captive (guards fight on their own once
    // the bot is close), open the cache and the timed crate, hold the radio zone. Level 3 of a station needs its
    // survivor; without rescues the camp stopped at level 2 and the Schrott piled up.
    const ev = best ? null : this.eventGoal();
    if (ev) {
      if (ev.key !== this.eventKey) { this.eventKey = ev.key; this.eventT = 0; }
      if ((this.eventT += DT) > EVENT_GIVE_UP) this.skip.add(ev.key);
      else best = ev;
    }
    const goal = best ? null : this.shopGoal();
    if (goal && goal.key !== this.shopTarget) { this.shopTarget = goal.key; this.shopT = 0; }
    if (goal && (this.shopT += DT) > SHOP.giveUp) this.shopped.add(goal.key);
    if (best) {
      tx = best.x;
      tz = best.z;
    } else if (goal) {
      tx = goal.x;
      tz = goal.z;
    } else if (s.run.phase === 'travel' && p.hp < s.stats.maxHp * 0.6 && s.level.rests.length > 0) {
      // Rest in the nearest Späti until healed.
      let r = s.level.rests[0]!;
      for (const q of s.level.rests) if (Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(r.x - p.x, r.z - p.z)) r = q;
      if (Math.hypot(r.x - p.x, r.z - p.z) < 70) {
        tx = r.x;
        tz = r.z;
        if (s.rest.at >= 0) return;
      }
    }
    if (Number.isNaN(tx)) {
      const enc = s.level.encounters[s.run.index];
      if (!enc) return;
      tx = enc.x;
      tz = enc.z;
    }
    if (this.go(tx, tz)) {
      inp.moveX = this.dir.x;
      inp.moveZ = this.dir.z;
    }
  }
}


// ---------------------------------------------------------------- choices (2D tools/sim.js v0.99)

/** Economy blessings (2D ECON). */
const ECON: Partial<Record<PerkId, number>> = { scrap: 1, mat: 1, loot: 1, magnet: 0.5 };
/** Base value of combat blessings (2D PV); unlisted ones 2.5. */
const PV: Partial<Record<PerkId, number>> = { dmg: 5, crit: 4, rate: 4.5, hp: 4, res: 4, leech: 3, second: 6, exec: 3, combo: 3, pauke: 3.5, jagd: 3.5, rush: 3, boom: 3.5, ram: 3, husar: 3, stun: 3, breaker: 3.5, thorns: 3, stellung: 2.5, retour: 2.5, spd: 2.5, dashcd: 2, breath: 2.5, reach: 3, kimme: 3, durch: 3, skill: 3, fire: 3.5, acid: 3.5, shock: 3.5, elp: 3, blast: 1.5 };
/** Johannes (2026-11-21): when it gets hard he takes toughness, when it is easy damage. */
const TOUGH: readonly PerkId[] = ['hp', 'res', 'leech', 'second', 'thorns', 'breath'];
const HURT: readonly PerkId[] = ['dmg', 'crit', 'rate', 'exec', 'combo', 'boom'];
const WFAM: Record<string, readonly PerkFamilyId[]> = { blade: ['krit', 'serie'], hammer: ['boll', 'krit'], spear: ['dist', 'krit'], sling: ['dist', 'serie'] };

/** Share of the workshop not yet bought (2D econNeed): 1 at the start of a campaign, 0 when all is bought. */
export function econNeed(s: Sim): number {
  let max = 0, have = 0;
  for (const u of CAMP_UPGRADES) { const m = upgradeMax(s, u.id); max += m; have += Math.min(m, s.statContext.upgrades[u.id] ?? 0); }
  return 1 - have / Math.max(1, max);
}

/** Build families the hero leans to: the weapon's, its element, big gear affixes (2D SIM.profile). */
function buildProfile(s: Sim): Set<PerkFamilyId> {
  const f = new Set<PerkFamilyId>(WFAM[s.stats.kind] ?? []);
  if (s.stats.elements.length) f.add('el' as PerkFamilyId);
  if (s.stats.elements.includes('fire')) f.add('glut' as PerkFamilyId);
  if (s.stats.crit >= 0.13) f.add('krit' as PerkFamilyId);
  return f;
}

/** 2D perkScore: economy early in the campaign and in a mission, later blessings that fit the build; hard fights favour toughness. */
export function perkScore(s: Sim, id: PerkId, level: number, recentLow = 1): number {
  const p = perkOf(id);
  const n = s.level.encounters.length, at = s.run.index / Math.max(1, n - 1);
  const mission = at < 0.35 ? 1 : at < 0.7 ? 0.5 : 0.15;
  const econ = ECON[id];
  if (econ) return 1 + 6 * econ * econNeed(s) * mission * level;
  const prof = buildProfile(s), held = heldFamilies(s);
  let v = PV[id] ?? 2.5;
  for (const f of p.families ?? []) { if (prof.has(f)) v += 2; if (held.has(f)) v += 3; }
  if (p.duo) v += 5;
  if (p.weapon) v += 4;
  if (recentLow < 0.4 && TOUGH.includes(id)) v += 4;
  if (recentLow > 0.75 && HURT.includes(id)) v += 2;
  return v * (level > 1 ? 1.5 : 1) * (pk(s, id) >= p.max ? 0 : 1);
}

/**
 * 2D gear rule: weapons by power, another weapon class needs +15 % in the camp, +20 % on an expedition
 * (+40 % when the run's blessings are tied to the class); other slots on any power gain.
 */
export function equipBest(s: Sim, inRun: boolean): void {
  for (let n = 0; n < 20; n++) {
    let changed = false;
    const bag = s.inventory.bag;
    for (let i = bag.length - 1; i >= 0; i--) {
      const it = bag[i] as Item;
      const now = power(s.stats);
      const then = power(heroStats({ ...s.equipment, [it.slot]: it }, s.statContext));
      const cur = s.equipment[it.slot];
      if (then > now * wearNeed(s, it, inRun)) {
        // Aufsätze stay in stock when the weapon changes (2D swapW).
        if (it.slot === 'w' && cur?.mods?.length) for (const m of [...cur.mods]) removeMod(s, m);
        equipItem(s, i);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  loadout(s);
}
/** Power factor a piece needs over the worn one before the bot wears it. */
function wearNeed(s: Sim, it: Item, inRun: boolean): number {
  const cur = s.equipment[it.slot];
  if (it.slot !== 'w' || !cur || it.kind === cur.kind) return 1.01;
  return !inRun ? 1.15 : PERKS_TIED(s) >= 2 ? 1.4 : 1.2;
}
const PERKS_TIED = (s: Sim): number => {
  const fam = WFAM[s.stats.kind] ?? [];
  let n = 0;
  for (const id of Object.keys(s.statContext.perks ?? {}) as PerkId[]) {
    if (pk(s, id) <= 0) continue;
    const p = perkOf(id);
    if (p.weapon === s.stats.kind) n += 2;
    else if (!p.weapon && (p.families ?? []).some((f) => fam.includes(f))) n++;
  }
  return n;
};

/** Aufsätze and implant mode (2D SIM.loadout): the fitted mods are the best of those in stock, the implant mode the one with the most power. */
function loadout(s: Sim): void {
  const w = s.equipment.w;
  const slots = modSlots(w);
  if (w && slots) {
    const score = (id: WeaponModId): number => ({ nagel: 4, gewicht: s.stats.crit >= 0.13 ? 5 : 3, dorn: 2, tank: s.stats.elements.includes('fire') ? 5 : 1, phiole: s.stats.elements.includes('acid') ? 5 : 1, batt: s.stats.elements.includes('shock') ? 5 : 1 }[id] ?? 0);
    const have = WEAPON_MODS.map((m) => m.id).filter((id) => (w.mods ?? []).includes(id) || (s.inventory.mods[id] ?? 0) > 0);
    const want = have.sort((a, b) => score(b) - score(a)).slice(0, slots);
    for (const id of [...(w.mods ?? [])]) if (!want.includes(id)) removeMod(s, id);
    for (const id of want) if (!(w.mods ?? []).includes(id)) installMod(s, id);
  }
  // Scored on hypothetical copies (setLoadout replaces the equipment objects), applied only on a change
  // (every setLoadout rounds life, which would eat fractional regeneration each step: Codex on PR 75).
  const im = s.equipment.i;
  if (im) {
    let best: 0 | 1 | 2 = im.implantMode ?? 0, bp = -1;
    for (let k = 0 as 0 | 1 | 2; k < IMPLANT_MODES.length; k = (k + 1) as 0 | 1 | 2) {
      const q = power(heroStats({ ...s.equipment, i: { ...im, implantMode: k } }, s.statContext));
      if (q > bp) { bp = q; best = k; }
    }
    if (best !== (im.implantMode ?? 0)) setImplantMode(s, im, best);
  }
}

// ---------------------------------------------------------------- economy (B2 step 1, first guesses)

/** Where the Schrott of one map went (each purchase is booked as the Schrott it took). */
export interface Ledger {
  /** Schrott from salvaging bag items. */
  salvage: number;
  /** Gear offers and Verband or Molotow bought at a Späti or the trader. */
  items: number;
  /** Schärfen and Panzerung at a Späti. */
  upgrades: number;
  /** Everything bought in the camp: build sites, station levels, workshop upgrades, Lazarett, drill, Aufsätze. */
  camp: number;
}
export const newLedger = (): Ledger => ({ salvage: 0, items: 0, upgrades: 0, camp: 0 });

/** Runs `f` and books the Schrott it moved under `k`. */
function book<T>(s: Sim, l: Ledger | undefined, k: keyof Ledger, f: () => T): T {
  const before = s.inventory.scrap;
  const r = f();
  if (l) l[k] += Math.abs(s.inventory.scrap - before);
  return r;
}

/**
 * B2 rules, first guesses before calibration: a trade offer must beat the worn piece by `lead` item
 * levels and leave `keep` of the Schrott; the bot detours to an unvisited shop within `reach` m while
 * it holds `minScrap` and gives up on one it cannot reach in `giveUp` s; Verband and Molotow are kept
 * at `pouch`; the drill waits for `drillReserve` Schrott above its price.
 */
/** B2 step 2: run events farther than this are left; one not done within this many seconds is given up. */
const EVENT_REACH = 60;
const EVENT_GIVE_UP = 60;

export const SHOP = { lead: 2, keep: 0.3, reach: 50, minScrap: 60, giveUp: 25, pouch: 2, drillReserve: 300 } as const;

/** A legendary or set piece is kept; anything else below the worn piece's item level is salvaged. */
export function keepsItem(s: Sim, it: Item): boolean {
  if (it.locked || it.rarity >= 3 || it.set) return true;
  const worn = s.equipment[it.slot];
  return !worn || it.itemLevel >= worn.itemLevel;
}

/** Salvages what the bot will not wear; a nearly full bag loses its kept pieces too, the plain ones first. */
export function salvageSpare(s: Sim, l?: Ledger): void {
  const bag = s.inventory.bag;
  for (let i = bag.length - 1; i >= 0; i--) if (!keepsItem(s, bag[i]!)) book(s, l, 'salvage', () => salvageItem(s, i));
  if (bag.length < BAG_SIZE - 5) return;
  for (let i = bag.length - 1; i >= 0; i--) if (bag[i]!.rarity < 3 && !bag[i]!.set) book(s, l, 'salvage', () => salvageItem(s, i));
  if (bag.length < BAG_SIZE - 5) return;
  for (let i = bag.length - 1; i >= 0; i--) book(s, l, 'salvage', () => salvageItem(s, i));
}

/** The trade rule: `SHOP.lead` item levels above the worn piece, `SHOP.keep` of the Schrott left, and a piece `equipBest` would wear. */
export function wantsOffer(s: Sim, o: TradeOffer): boolean {
  const worn = s.equipment[o.item.slot];
  if (worn && o.item.itemLevel < worn.itemLevel + SHOP.lead) return false;
  if (o.price > s.inventory.scrap * (1 - SHOP.keep)) return false;
  return power(heroStats({ ...s.equipment, [o.item.slot]: o.item }, s.statContext)) > power(s.stats) * wearNeed(s, o.item, true);
}

/** Späti or trader (2D state 'trade'): offers by the trade rule, Verband and Molotow up to two, Schärfen and Panzerung while the Späti cap allows. */
function shop(s: Sim, l?: Ledger): void {
  // Wear each purchase before judging the next offer, so two offers for one slot are not both bought.
  tradeStock(s).forEach((o, i) => { if (o && wantsOffer(s, o) && book(s, l, 'items', () => buyOffer(s, i)).ok) equipBest(s, true); });
  equipBest(s, true);
  salvageSpare(s, l);
  if (s.content.tradeAt >= 0) {
    for (const c of CONSUMABLES) while ((s.inventory.consumables?.[c.id] ?? 0) < SHOP.pouch && s.inventory.scrap >= c.scrapCost * 3) if (!book(s, l, 'items', () => buyConsumable(s, c.id)).ok) break;
    for (const id of SPATI_UPGRADE.ids) while ((s.statContext.upgrades[id] ?? 0) < SPATI_UPGRADE.max && s.inventory.scrap >= spatiUpgradeCost(s, id)) if (!book(s, l, 'upgrades', () => buySpatiUpgrade(s, id)).ok) break;
  }
}

/** Camp purchases open now, cheapest first: workshop upgrades below their cap and station levels whose needs and materials are met. */
export function campOffers(s: Sim): Array<{ cost: number; buy: () => unknown }> {
  const out: Array<{ cost: number; buy: () => unknown }> = [];
  for (const u of CAMP_UPGRADES) if ((s.statContext.upgrades[u.id] ?? 0) < upgradeMax(s, u.id)) out.push({ cost: upgradeCost(s, u.id), buy: () => buyUpgrade(s, u.id) });
  for (const st of STATIONS) {
    if (!stationBuilt(s, st.id)) continue;
    const n = nextLevel(s, st.id);
    if (n && !n.needs.length && (Object.entries(n.cost) as Array<[string, number]>).every(([k, v]) => k === 'scrap' || (s.inventory.materials[k as keyof typeof s.inventory.materials] ?? 0) >= v)) out.push({ cost: n.cost.scrap ?? 0, buy: () => buildStation(s, st.id) });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

/**
 * Between expeditions (2D SIM.camp, B2 order): gear, salvage all but legendary and set pieces, cook;
 * then every missing build site, cheapest first; Verband and Molotow to `SHOP.pouch`; upgrades and
 * station levels by price (it saves up for the cheapest); the drill; Aufsätze.
 */
export function botCamp(s: Sim, l?: Ledger): void {
  equipBest(s, false);
  const bag = s.inventory.bag;
  for (let i = bag.length - 1; i >= 0; i--) if (bag[i]!.rarity < 3 && !bag[i]!.set) book(s, l, 'salvage', () => salvageItem(s, i));
  salvageSpare(s, l);
  if (!campOpen(s.inventory.camp?.freed)) return;
  if (!s.statContext.meal) {
    const pref = econNeed(s) > 0.4 ? ['gurke', 'curry', 'suppe', 'soljanka', 'kaffee'] : ['curry', 'suppe', 'soljanka', 'kaffee', 'gurke'];
    for (const id of pref) if (MEALS.some((m) => m.id === id) && cookMeal(s, id as (typeof MEALS)[number]['id']).ok) break;
  }
  const siteCost = (id: (typeof STATIONS)[number]['id']): number => nextLevel(s, id)?.cost.scrap ?? 0;
  for (let guard = 0; guard < STATIONS.length; guard++) {
    const site = STATIONS.filter((x) => !stationBuilt(s, x.id) && nextLevel(s, x.id)?.ok).sort((a, b) => siteCost(a.id) - siteCost(b.id))[0];
    if (!site) break;
    book(s, l, 'camp', () => buildStation(s, site.id));
  }
  for (const c of CONSUMABLES) while ((s.inventory.consumables?.[c.id] ?? 0) < SHOP.pouch && s.inventory.scrap >= c.scrapCost) if (!book(s, l, 'camp', () => craftConsumable(s, c.id)).ok) break;
  for (let guard = 0; guard < 200; guard++) {
    const next = campOffers(s)[0];
    if (!next || s.inventory.scrap < next.cost) break;
    book(s, l, 'camp', next.buy);
  }
  for (let guard = 0; guard < 50 && !campOffers(s).length && stationBuilt(s, 'exer') && s.inventory.scrap >= drillCost(s) + SHOP.drillReserve; guard++) book(s, l, 'camp', () => buyDrill(s));
  if (stationBuilt(s, 'zeug')) for (const m of WEAPON_MODS) if (!(s.inventory.mods[m.id] ?? 0) && !(s.equipment.w?.mods ?? []).includes(m.id)) book(s, l, 'camp', () => buildMod(s, m.id));
  loadout(s);
}

// ---------------------------------------------------------------- campaign

export interface EncounterReport {
  name: string;
  boss: boolean;
  /** Seconds from the start of the fight to its end (the winning try). */
  time: number;
  /** Damage taken in the winning try, as a share of max life. */
  damage: number;
  /** Lowest life share seen in the winning try. */
  low: number;
  deaths: number;
  /** Hero power when the fight was won. */
  power: number;
}

export interface CampaignReport {
  won: boolean;
  /** Sim seconds over all tries. */
  time: number;
  deaths: number;
  kills: number;
  /** Item drops that appeared (enemies, chests, breakables), over all tries. */
  items: number;
  encounters: EncounterReport[];
  /** Where it ended when not won. */
  stuckAt: string;
  power: number;
  weapon: string;
  /** Gear, inventory and camp at the end, for the next district of a chain (after the camp step of a won run). */
  profile: SaveProfile;
  /** B2: Schrott of this map. `camp` is the camp step before it; `earned` counts pickups, streaks and salvage. */
  economy: Ledger & { start: number; earned: number; left: number; itemLevel: number; weaponLevel: number };
}

/** Mean item level of the worn pieces. */
function wornLevel(s: Sim): number {
  const lv = Object.values(s.equipment).filter((it): it is Item => !!it).map((it) => it.itemLevel);
  return lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0;
}

export interface CampaignOptions {
  level: Level;
  seed?: number;
  difficulty?: DifficultyId;
  skill?: BotSkill;
  /** Give up after this many deaths (default 12) or sim seconds (default 3 h). */
  maxDeaths?: number;
  maxTime?: number;
  /** Start at this encounter (tests). */
  startAt?: number;
  /** Stop after this encounter index is won (tests). */
  until?: number;
  /** Start with this gear and inventory instead of a fresh hero (district chains). */
  carry?: SaveProfile;
  /** District id for the camp's freed list. */
  district?: number;
}

/** B2 step 2: the enemies still alive when a run stops (kind and position, at most four), to find unreachable ones. */
function aliveNote(sim: Sim): string {
  const alive = sim.enemies.filter((e) => e.state !== 'dead');
  const hero = `; life ${Math.round((100 * sim.player.hp) / sim.stats.maxHp)} %${sim.rest.at >= 0 ? ', in a Späti' : ''}`;
  if (!alive.length) return hero;
  return `${hero}; alive ${alive.length}: ${alive.slice(0, 4).map((e) => `${e.kind}@${e.x.toFixed(1)},${e.z.toFixed(1)}`).join(' ')}`;
}

/** One fresh campaign through the map: retries at the zone start after a death, like the game. */
export function runCampaign(o: CampaignOptions): CampaignReport {
  const level = o.level;
  let seed = o.seed ?? 1;
  const c0 = o.carry ? structuredClone(o.carry) : undefined;
  let sim = createSim({ level, seed, difficulty: o.difficulty ?? 'normal', startAt: o.startAt ?? 0, ...(c0 ? { equipment: c0.equipment, statContext: c0.statContext, inventory: c0.inventory } : {}) });
  // Coming from the last district: a camp step first (2D SIM.camp after every run).
  const ledger = newLedger();
  const scrap0 = sim.inventory.scrap;
  if (c0) botCamp(sim, ledger);
  let bot = new Bot(sim, o.skill ?? SKILL_DEFAULT, seed, ledger);
  const maxDeaths = o.maxDeaths ?? 12;
  const maxTime = o.maxTime ?? 3 * 3600;
  const reports: EncounterReport[] = level.encounters.map((e) => ({ name: e.name, boss: e.waves.some((w) => w.bosses.length > 0), time: 0, damage: 0, low: 1, deaths: 0, power: 0 }));
  let time = 0, deaths = 0, kills = 0;
  let fightStart = -1, fightDamage = 0, fightLow = 1, fightIndex = -1;
  let idleT = 0, lastIndex = -1, quietT = 0;
  let won = false;
  const seenDrops = new Set<number>();
  let items = 0;
  while (time < maxTime) {
    bot.manage();
    stepSim(sim, bot.input());
    time += DT;
    for (const d of sim.drops) if (d.content.kind === 'item' && !seenDrops.has(d.id)) { seenDrops.add(d.id); items++; }
    const p = sim.player;
    for (const ev of sim.events) {
      if (ev.type === 'encounterStart') {
        fightStart = sim.time;
        fightDamage = 0;
        fightLow = p.hp / sim.stats.maxHp;
        fightIndex = ev.index;
      } else if (ev.type === 'playerHit') { fightDamage += ev.damage; quietT = 0; }
      else if (ev.type === 'hit' || ev.type === 'spawn') quietT = 0;
      else if (ev.type === 'encounterClear') {
        const r = reports[ev.index]!;
        r.time = sim.time - fightStart;
        r.damage = fightDamage / sim.stats.maxHp;
        r.low = fightLow;
        r.power = power(sim.stats);
        fightIndex = -1;
      } else if (ev.type === 'victory') won = true;
    }
    sim.events.length = 0;
    if (fightIndex >= 0) fightLow = Math.min(fightLow, p.hp / sim.stats.maxHp);
    if (won || (o.until !== undefined && sim.run.index > o.until)) break;
    // No progress for ten minutes of travel: the route is broken, not the balance.
    if (sim.run.index !== lastIndex || sim.run.phase !== 'travel') {
      lastIndex = sim.run.index;
      idleT = 0;
    } else if ((idleT += DT) > 600) break;
    // A fight where nobody hits anybody for three minutes is stuck (an enemy out of reach), not hard.
    if (sim.run.phase === 'travel' || p.state === 'dead') quietT = 0;
    else if ((quietT += DT) > 180) break;
    if (p.state === 'dead' && p.stateT > 1.5) {
      deaths++;
      kills += sim.kills;
      const at = Math.min(sim.run.index, level.encounters.length - 1);
      reports[at]!.deaths++;
      if (deaths >= maxDeaths) break;
      const zone = level.encounters[at]!.zone;
      const prof = profileOf(sim);
      seenDrops.clear();
      sim = createSim({ level, seed: ++seed, difficulty: sim.difficulty, startAt: level.encounters.findIndex((e) => e.zone === zone), equipment: prof.equipment, statContext: prof.statContext, inventory: prof.inventory });
      bot = new Bot(sim, bot.skill, seed, ledger);
      fightIndex = -1;
    }
  }
  kills += sim.kills;
  const at = Math.min(sim.run.index, level.encounters.length - 1);
  endExpedition(sim, won, o.district ?? 0);
  const left = sim.inventory.scrap;
  const economy = { ...ledger, start: scrap0, earned: left - scrap0 + ledger.items + ledger.upgrades + ledger.camp, left, itemLevel: wornLevel(sim), weaponLevel: sim.equipment.w?.itemLevel ?? 0 };
  return { economy, profile: profileOf(sim), won, time, deaths, kills, items, encounters: reports, stuckAt: won ? '' : `${level.encounters[at]!.name} (${sim.run.phase}) at ${sim.player.x.toFixed(0)},${sim.player.z.toFixed(0)}${aliveNote(sim)}`, power: power(sim.stats), weapon: sim.stats.kind };
}
