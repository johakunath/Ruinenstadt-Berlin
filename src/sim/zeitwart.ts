// M17 Der Zeitwart, the final boss in the Uhrenraum (`docs/tasks/m17-fernsehturm.md` › Step 3 spec, board
// `docs/style/fernsehturm-zeitwart.webp`). His own brain on the shared special blocks (`src/sim/ai.ts` calls in here):
// three phases by era pair, and between them the gear hold (T9): at 66 % and 33 % of life he stands still in the
// movement and cannot be hurt while the hero holds a gear seat (a ring round one of the six seats); adds come every
// `hold.every` s; when the gear is in, he is stunned and the next phase begins. Phase 3 also turns the clock hands
// faster (`Sim.handBoost`). The Zeitsprung is new: three blinks to marked spots, each ending in a shock ring.
import { BOSS, type EnemyKind } from '../data/enemies';
import type { Point } from './level';
import { freeSpot, lineClear } from './reach';
import { addZone, type SpecialKind } from './threats';
import { DT, type Enemy, type Sim } from './types';

const Z = BOSS.zeitwart;

/** Per-boss state (`Enemy.zw`). */
export interface ZeitwartState {
  /** 0, 1, 2: the era pair of the phase. */
  phase: number;
  /** The gear hold running now: seat, charge, seconds to the next add. */
  hold: { seat: Point; p: number; sp: number } | null;
  /** A Zeitsprung: blinks left, seconds to the next step, the marked spot (`marked`: its warning is down). */
  blink: { n: number; t: number; x: number; z: number; marked: boolean } | null;
}

/** Hooks from `ai.ts` (no import back, so the brain file has no cycle). */
export interface Blocks {
  begin(sim: Sim, e: Enemy, kind: SpecialKind): void;
  summon(sim: Sim, e: Enemy, kind: EnemyKind, count: number): void;
}

export const zwOf = (e: Enemy): ZeitwartState => (e.zw ??= { phase: 0, hold: null, blink: null });

/** Adds of a phase: Urzeit and 1920, 1981 and 1989, 2089 and kommt bald. */
const ADDS: ReadonlyArray<ReadonlyArray<readonly [EnemyKind, number]>> = [
  [['raptor', 2], ['scherbe', 2]],
  [['uhrwerk', 1], ['zuender', 2]],
  [['drone', 2], ['teeifrit', 2]],
];

/** Calls the phase's adds (the summon special's release); alternates the two eras. */
export function zeitwartSummon(sim: Sim, e: Enemy, B: Blocks): void {
  const zw = zwOf(e), pair = ADDS[zw.phase]!, [kind, n] = pair[e.cycle++ % pair.length]!;
  B.summon(sim, e, kind, n);
  sim.events.push({ type: 'note', text: '„Schlag zwölf!“', color: '#f2d14b', x: e.x, z: e.z });
}

/** Picks his next special (from `think`); holds still during a gear hold and a Zeitsprung. */
export function zeitwartThink(sim: Sim, e: Enemy, dist: number, plan: { mode: string; melee: boolean }, B: Blocks): void {
  const zw = zwOf(e), p = sim.player;
  if (zw.hold || zw.blink) { plan.mode = 'hold'; plan.melee = false; return; }
  if (e.gap > 0) return;
  const sight = (): boolean => sim.flow.clearLine(e.x, e.z, p.x, p.z);
  if (e.cd[2] <= 0) { e.cd[2] = Z.summon; B.begin(sim, e, 'summon'); return; }
  switch (zw.phase) {
    case 0:
      // Gestern: Sprung on a marked line from mid range, Zeigerhieb (a marked circle) up close.
      if (e.cd[1] <= 0 && dist > Z.sprungFrom && dist < Z.sprungTo && sight()) { e.cd[1] = Z.sprung; B.begin(sim, e, 'pounce'); }
      else if (e.cd[0] <= 0 && dist < 6) { e.cd[0] = Z.hieb; B.begin(sim, e, 'bossSlam'); }
      break;
    case 1:
      // Mauerzeit: a volley of five across the hero's line, a root field under the hero.
      if (e.cd[1] <= 0) { e.cd[1] = Z.roots; B.begin(sim, e, 'roots'); }
      else if (e.cd[0] <= 0 && dist < 13 && sight()) { e.cd[0] = Z.fan; B.begin(sim, e, 'volley'); }
      break;
    default:
      // Morgen: the Zeitsprung; the Zeigerhieb when the hero comes close.
      if (e.cd[1] <= 0) { e.cd[1] = Z.blink; startBlink(sim, e); }
      else if (e.cd[0] <= 0 && dist < 5) { e.cd[0] = Z.hieb; B.begin(sim, e, 'bossSlam'); }
  }
}

/** A free landing spot a few meters from the hero, with a clear line from the hero (never behind a core). */
function blinkSpot(sim: Sim, e: Enemy): Point {
  const p = sim.player, r = e.def.radius + 0.2;
  return freeSpot(sim.level, sim.rng, p.x, p.z, 2.5, Z.blinkRange, r, (x, z) => lineClear(sim.level, p.x, p.z, x, z, r)) ?? { x: e.x, z: e.z };
}

function markBlink(sim: Sim, e: Enemy, q: Point): void {
  addZone(sim, { x: q.x, z: q.z, r: 1.6, t: Z.blinkWarn, max: Z.blinkWarn, damage: e.def.damage * e.dmgMul * Z.landDamage, floor: 0, kind: 'land', src: e.id, free: true });
  sim.events.push({ type: 'blink', id: e.id, x: q.x, z: q.z, phase: 'mark' });
}

function startBlink(sim: Sim, e: Enemy): void {
  const q = blinkSpot(sim, e);
  zwOf(e).blink = { n: Z.blinks, t: Z.blinkWarn, x: q.x, z: q.z, marked: true };
  markBlink(sim, e, q);
}

/** The phase whose threshold the boss's life has reached (0 above the first, 1 between, 2 below the second). */
export const phaseAt = (e: Enemy): number => Z.phases.filter((k) => e.hp <= e.maxHp * k).length;

/** Gear seats of the level (six round the movement), nearest to the hero first. */
function seatFor(sim: Sim, e: Enemy): Point {
  const p = sim.player, seats = sim.level.seats;
  if (!seats.length) return { x: e.x, z: e.z };
  return seats.reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a));
}

/**
 * Every step after the enemies moved: phase changes start the gear hold (T9), the hold charges while the hero stands
 * in the seat's ring, the Zeitsprung lands.
 */
export function updateZeitwart(sim: Sim, B: Blocks): void {
  for (const e of sim.enemies) {
    if (e.kind !== 'zeitwart' || e.state === 'dead') continue;
    const zw = zwOf(e);
    if (!zw.hold && phaseAt(e) > zw.phase) {
      // He steps into the movement: untouchable (`wake`, refreshed here, so its end never roars), nothing he started goes on.
      zw.hold = { seat: seatFor(sim, e), p: 0, sp: 0.5 };
      zw.blink = null;
      e.sp = null;
      e.state = 'chase';
      sim.events.push({ type: 'gearHold', id: e.id, x: zw.hold.seat.x, z: zw.hold.seat.z, phase: zw.phase + 1 });
      sim.events.push({ type: 'note', text: '„Zurück auf Null!“', color: '#f2d14b', x: e.x, z: e.z });
    }
    if (zw.hold) { holdStep(sim, e, zw, B); continue; }
    if (zw.blink) blinkStep(sim, e, zw, B);
  }
}

/** One step of the gear hold. */
function holdStep(sim: Sim, e: Enemy, zw: ZeitwartState, B: Blocks): void {
  const h = zw.hold!, p = sim.player;
  e.wake = 1;
  if (p.state !== 'dead' && Math.hypot(p.x - h.seat.x, p.z - h.seat.z) <= Z.hold.r) h.p += DT;
  h.sp -= DT;
  if (h.sp <= 0) {
    h.sp = Z.hold.every;
    const [kind] = ADDS[zw.phase]![(e.cycle++) % ADDS[zw.phase]!.length]!;
    B.summon(sim, e, kind, 1);
  }
  if (h.p < Z.hold.need) return;
  // Gear in: the next era, he stands stunned and open.
  zw.hold = null;
  zw.phase = Math.min(2, zw.phase + 1);
  e.wake = 0;
  e.state = 'stagger';
  e.stateT = 0;
  e.staggerDur = Z.hold.stun;
  e.open = Z.hold.stun;
  e.cd = [1.5, 2.5, Z.summon];
  if (zw.phase === 2) sim.handBoost = { t: sim.time, k: Z.handBoost };
  sim.events.push({ type: 'gear', id: e.id, x: h.seat.x, z: h.seat.z, phase: zw.phase });
}

/** One step of a Zeitsprung: after the mark he is there, sends a shock ring, and marks the next spot. */
function blinkStep(sim: Sim, e: Enemy, zw: ZeitwartState, B: Blocks): void {
  const b = zw.blink!;
  if (!b.marked) {
    // The gap after a landing: the next mark goes down once the shock ring is out, so the landing hit and the blink
    // fall together at the end of its warning (Codex review: the mark used to land 0.9 s before him).
    if (e.state === 'special' || (b.t -= DT) > 0) return;
    const q = blinkSpot(sim, e);
    b.x = q.x;
    b.z = q.z;
    b.t = Z.blinkWarn;
    b.marked = true;
    markBlink(sim, e, q);
    return;
  }
  if ((b.t -= DT) > 0) return;
  e.x = e.px = b.x;
  e.z = e.pz = b.z;
  sim.events.push({ type: 'blink', id: e.id, x: b.x, z: b.z, phase: 'go' });
  B.begin(sim, e, 'bass');
  b.n--;
  if (b.n <= 0) { zw.blink = null; return; }
  b.t = Z.blinkGap;
  b.marked = false;
}
