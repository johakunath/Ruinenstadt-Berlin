// Balance bot (M14; 2D tools/sim.js). Plays the sim through `SimInput` like a person would:
// walks the route, fights, steps out of marked zones, rolls through shots and rings, picks up
// loot, wears upgrades, takes blessings, rests in a Späti. Its skill is a handful of numbers
// (`BotSkill`) meant to be fitted to Johannes' telemetry (B9): how often it overlooks a telegraph
// and how long it takes to react. No DOM, no rendering: runs in Node (tools/balance.mjs) and tests.
import { PLAYER, weaponAttack } from '../data/combat';
import type { DifficultyId } from '../data/difficulty';
import { chooseBlessing } from '../sim/blessings';
import { colliderDistance } from '../sim/collide';
import { ferryPos } from '../sim/ferry';
import { equipItem, salvageItem } from '../sim/inventory';
import type { Item } from '../sim/items';
import type { Level } from '../sim/level';
import { Rng } from '../sim/math';
import { profileOf, type SaveProfile } from '../sim/save';
import { endExpedition } from '../sim/camp';
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

  constructor(private readonly level: Level) {
    const b = level.bounds;
    this.cols = Math.ceil((b.maxX - b.minX) / CELL);
    this.rows = Math.ceil((b.maxZ - b.minZ) / CELL);
    this.free = new Uint8Array(this.cols * this.rows);
    this.dist = new Int32Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const x = b.minX + (c + 0.5) * CELL, z = b.minZ + (r + 0.5) * CELL;
      const solid = level.near(x, z, BODY + 0.1).some((k) => colliderDistance(k, x, z) < BODY);
      this.free[r * this.cols + c] = !solid && (!level.blocked(x, z, BODY) || this.onLane(x, z)) ? 1 : 0;
    }
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
      // Standing on a blocked cell (prop edge, boat): take the best neighbor.
      let best = -1;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const n = i + dr * this.cols + dc;
        if (n < 0 || n >= this.dist.length || this.dist[n] === -1) continue;
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

  constructor(private readonly sim: Sim, readonly skill: BotSkill, seed = 1) {
    this.rng = new Rng(seed * 7919 + 13);
    let nav = navs.get(sim.level);
    if (!nav) {
      nav = new Nav(sim.level);
      navs.set(sim.level, nav);
    }
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

  /** Between steps: blessings, gear, bag. */
  manage(): void {
    const s = this.sim;
    const a = s.abilities;
    while (a.offers.length) {
      const best = [...a.offers].sort((x, y) => y.quality - x.quality)[0]!;
      if (!chooseBlessing(s, best.id)) break;
    }
    const bag = s.inventory.bag;
    for (let i = bag.length - 1; i >= 0; i--) {
      const it = bag[i] as Item;
      const now = power(s.stats);
      const then = power(heroStats({ ...s.equipment, [it.slot]: it }, s.statContext));
      if (then > now * 1.01) equipItem(s, i);
    }
    // Keep room: salvage what is not worn once the bag is nearly full.
    if (bag.length >= 20) for (let i = bag.length - 1; i >= 0; i--) salvageItem(s, i);
  }

  input(): SimInput {
    const s = this.sim;
    const p = s.player;
    const inp: SimInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, aimAssist: true, attack: false, dodge: false };
    if (p.state === 'dead') return inp;
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
        } else if (this.nav.toward(p.x, p.z, near.x, near.z, this.dir)) {
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

  private onBoatWait(): boolean {
    const p = this.sim.player;
    return this.nav.onLane(p.x, p.z) || this.sim.level.ferries.some((f) => Math.hypot(ferryPos(f, this.sim.time).x - p.x, ferryPos(f, this.sim.time).z - p.z) < 14);
  }

  /** No enemy in sight: loot, rest, then on to the objective. */
  private travel(inp: SimInput): void {
    const s = this.sim;
    const p = s.player;
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
    if (best) {
      tx = best.x;
      tz = best.z;
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
    if (this.nav.toward(p.x, p.z, tx, tz, this.dir)) {
      inp.moveX = this.dir.x;
      inp.moveZ = this.dir.z;
    }
  }
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
  encounters: EncounterReport[];
  /** Where it ended when not won. */
  stuckAt: string;
  power: number;
  weapon: string;
  /** Gear, inventory and camp at the end, for the next district of a chain (after the camp step of a won run). */
  profile: SaveProfile;
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

/** One fresh campaign through the map: retries at the zone start after a death, like the game. */
export function runCampaign(o: CampaignOptions): CampaignReport {
  const level = o.level;
  let seed = o.seed ?? 1;
  const c0 = o.carry ? structuredClone(o.carry) : undefined;
  let sim = createSim({ level, seed, difficulty: o.difficulty ?? 'normal', startAt: o.startAt ?? 0, ...(c0 ? { equipment: c0.equipment, statContext: c0.statContext, inventory: c0.inventory } : {}) });
  let bot = new Bot(sim, o.skill ?? SKILL_DEFAULT, seed);
  const maxDeaths = o.maxDeaths ?? 12;
  const maxTime = o.maxTime ?? 3 * 3600;
  const reports: EncounterReport[] = level.encounters.map((e) => ({ name: e.name, boss: e.waves.some((w) => w.bosses.length > 0), time: 0, damage: 0, low: 1, deaths: 0, power: 0 }));
  let time = 0, deaths = 0, kills = 0;
  let fightStart = -1, fightDamage = 0, fightLow = 1, fightIndex = -1;
  let idleT = 0, lastIndex = -1, quietT = 0;
  let won = false;
  while (time < maxTime) {
    bot.manage();
    stepSim(sim, bot.input());
    time += DT;
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
      sim = createSim({ level, seed: ++seed, difficulty: sim.difficulty, startAt: level.encounters.findIndex((e) => e.zone === zone), equipment: prof.equipment, statContext: prof.statContext, inventory: prof.inventory });
      bot = new Bot(sim, bot.skill, seed);
      fightIndex = -1;
    }
  }
  kills += sim.kills;
  const at = Math.min(sim.run.index, level.encounters.length - 1);
  endExpedition(sim, won, o.district ?? 0);
  return { profile: profileOf(sim), won, time, deaths, kills, encounters: reports, stuckAt: won ? '' : `${level.encounters[at]!.name} (${sim.run.phase}) at ${sim.player.x.toFixed(0)},${sim.player.z.toFixed(0)}`, power: power(sim.stats), weapon: sim.stats.kind };
}
