// M17 Fernsehturm finale (`docs/maps/fernsehturm.md`, task `docs/tasks/m17-fernsehturm.md` › Engine notes):
// what moves inside the tower. The lift between the decks (T2), the clock hands that sweep a ring (T4) and the
// revolving floor band of the Telecafé (T5). All pure functions of sim state and sim time; no render, no DOM.
import type { Point } from './level';
import { focusFlow } from './director';
import { blastHit } from './combat';
import { threatHit } from './threats';
import { DT, type Sim } from './types';

/** A lift ring at a core door: open once encounter `after` is won; standing in it `LIFT.ride` s moves the hero to `to`. */
export interface LiftDef { from: Point; r: number; to: Point; after: number }
/**
 * A clock hand: a bar from the centre out to `len` that turns once in `period` s (`dir` 1 clockwise seen from above,
 * the facing convention: angle a points along (sin a, cos a)). It hurts only during encounter `during`.
 */
export interface HandDef { x: number; z: number; len: number; period: number; dir: 1 | -1; width: number; during: number; a0: number }
/** The Telecafé floor band: everything between `r0` and `r1` from the centre turns once in `period` s. */
export interface BandDef { x: number; z: number; r0: number; r1: number; period: number }

/** T10 ending rings: the camp's station ring size, and the seconds the hero stands in one to choose. */
export const ENDING = { r: 0.65, hold: 1.5 } as const;
/** Lift ring radius, the seconds the hero stands in it before the ride, and the reach round the ring left behind in which enemies are removed. */
export const LIFT = { r: 1.6, ride: 0.8, left: 40 } as const;
/**
 * Hand hits (start values for the playtest): the hero takes at least `floor` of max life (the 45 % cap holds, a dodge
 * passes through); a normal enemy loses `enemy` of its life, a boss `boss`. One hit per body per pass (`lockout` s).
 * `warn`: seconds of the faint wedge drawn ahead of the hand.
 */
export const HAND = { width: 1.2, lockout: 1, warn: 0.6, floor: 0.16, enemy: 0.3, boss: 0.03 } as const;

/** A lift is open once the fight on its deck is won (the encounter index moved past it). */
export function liftOpen(sim: Sim, lift: LiftDef): boolean {
  return sim.run.index > lift.after;
}

/** Angle of a hand at sim time `t`; from `boost.t` on it turns `boost.k` times faster (Der Zeitwart's third phase). */
export function handAngle(h: HandDef, t: number, boost?: { t: number; k: number } | null): number {
  const run = t + (boost ? (boost.k - 1) * Math.max(0, t - boost.t) : 0);
  return h.a0 + (h.dir * 2 * Math.PI * run) / h.period;
}

/** A hand sweeps while its fight runs (waves, pauses, the hold); it is drawn always. */
export function handActive(sim: Sim, h: HandDef): boolean {
  const ph = sim.run.phase;
  return sim.run.index === h.during && (ph === 'fight' || ph === 'pause' || ph === 'hold');
}

/** The body centre lies on the hand's bar (within `width / 2` of it, between the centre and the tip). */
export function onHand(h: HandDef, t: number, x: number, z: number, boost?: { t: number; k: number } | null): boolean {
  const a = handAngle(h, t, boost), ux = Math.sin(a), uz = Math.cos(a), dx = x - h.x, dz = z - h.z;
  const along = dx * ux + dz * uz;
  return along >= 0 && along <= h.len && Math.abs(dx * uz - dz * ux) <= h.width / 2;
}

/**
 * Where travel leads (HUD arrow, the bot): the lift the last won fight opened while the hero is still on that deck,
 * else the walkable spot of the current fight (`EncounterDef.at`), else its centre.
 */
export function travelTarget(sim: Sim): { x: number; z: number; lift: boolean } | null {
  // T10: after the boss the way leads to the first ending ring („Uhr stellen“); the HUD names both.
  if (sim.run.phase === 'choice') { const q = sim.level.ending[0]; return q ? { x: q.x, z: q.z, lift: false } : null; }
  const enc = sim.level.encounters[sim.run.index];
  if (!enc) return null;
  const p = sim.player, lift = sim.level.lifts.find((l) => l.after === sim.run.index - 1 && Math.hypot(l.from.x - p.x, l.from.z - p.z) < 40);
  if (lift) return { x: lift.from.x, z: lift.from.z, lift: true };
  const at = enc.at ?? enc;
  return { x: at.x, z: at.z, lift: false };
}

/** T2: the hero in an open lift ring for `LIFT.ride` s rides to the next deck; drops stay behind, enemies left on that deck go. */
export function updateLifts(sim: Sim): void {
  const p = sim.player, L = sim.level.lifts;
  if (p.state === 'dead') { sim.lift = null; return; }
  const i = L.findIndex((l) => liftOpen(sim, l) && Math.hypot(p.x - l.from.x, p.z - l.from.z) <= l.r);
  if (i < 0) { sim.lift = null; return; }
  const t = sim.lift && sim.lift.i === i ? sim.lift.t + DT : DT;
  if (t < LIFT.ride) { sim.lift = { i, t }; return; }
  const to = L[i]!.to, from = L[i]!.from;
  sim.lift = null;
  // Nobody rides along: enemies left on the deck below (strays a summon or howl brought after the fight) go, or they
  // would chase the hero through the floor for good (and hold up the bot). Decks lie 120 m apart, the widest is 26 m.
  sim.enemies = sim.enemies.filter((e) => Math.hypot(e.x - from.x, e.z - from.z) > LIFT.left);
  p.x = p.px = to.x;
  p.z = p.pz = to.z;
  p.vx = p.vz = 0;
  focusFlow(sim, to.x, to.z);
  sim.flow.setTarget(to.x, to.z);
  sim.events.push({ type: 'lift', index: i, x: to.x, z: to.z }, { type: 'checkpoint' });
}

/**
 * T4: hands hit the bodies they pass, once per pass: a body is hit when a hand reaches it and not again until that hand
 * has left it (`handIn`, one bit per hand; Codex review: the slow hour hand near the core stays on a body longer than
 * the lockout), and never twice within `HAND.lockout`. Enemies take plain damage (`blastHit`: none of the hero's
 * multipliers, a kill feeds no kill effects).
 */
export function updateHands(sim: Sim): void {
  const t = sim.time, p = sim.player;
  sim.level.hands.forEach((h, i) => {
    const bit = 1 << i;
    if (!handActive(sim, h)) { p.handIn = (p.handIn ?? 0) & ~bit; return; }
    // Pushed along the sweep: the hand's direction turned a quarter in its sense of travel.
    const a = handAngle(h, t, sim.handBoost) + (h.dir * Math.PI) / 2, ux = Math.sin(a), uz = Math.cos(a);
    if (p.state !== 'dead' && onHand(h, t, p.x, p.z, sim.handBoost)) {
      if (!((p.handIn ?? 0) & bit) && t - (p.handT ?? -1e9) >= HAND.lockout && threatHit(sim, null, 0, HAND.floor, ux, uz, 'Uhrzeiger')) {
        p.handT = t;
        p.handIn = (p.handIn ?? 0) | bit;
      }
    } else p.handIn = (p.handIn ?? 0) & ~bit;
    for (const e of sim.enemies) {
      if (e.state === 'dead' || e.def.fly) continue;
      if (!onHand(h, t, e.x, e.z, sim.handBoost)) { e.handIn = (e.handIn ?? 0) & ~bit; continue; }
      if ((e.handIn ?? 0) & bit || t - (e.handT ?? -1e9) < HAND.lockout) continue;
      e.handT = t;
      e.handIn = (e.handIn ?? 0) | bit;
      blastHit(sim, e, e.maxHp * (e.def.boss ? HAND.boss : HAND.enemy), { x: e.x - ux, z: e.z - uz }, 90);
    }
  });
}

/**
 * T10: after the last fight two rings stand at the main switch; `ENDING.hold` s in one decides. The choice is saved in
 * the profile (`camp.ending`), then the run is won. No rule changes with it.
 */
export function updateEnding(sim: Sim): void {
  if (sim.run.phase !== 'choice') return;
  const p = sim.player;
  if (p.state === 'dead') { sim.choice = null; return; }
  const ring = sim.level.ending.find((q) => Math.hypot(p.x - q.x, p.z - q.z) <= q.r);
  if (!ring) { sim.choice = null; return; }
  const t = sim.choice && sim.choice.id === ring.id ? sim.choice.t + DT : DT;
  if (t < ENDING.hold) { sim.choice = { id: ring.id, t }; return; }
  sim.choice = null;
  const camp = sim.inventory.camp ??= { stations: {}, stash: [], freed: [] };
  camp.ending = ring.id;
  sim.run.phase = 'won';
  sim.events.push({ type: 'ending', choice: ring.id }, { type: 'victory' });
}

/** Turns (x, z) about (cx, cz) by `d` radians in the facing sense. */
function turn(o: { x: number; z: number }, cx: number, cz: number, c: number, s: number): void {
  const dx = o.x - cx, dz = o.z - cz;
  o.x = cx + dx * c + dz * s;
  o.z = cz + dz * c - dx * s;
}

/** T5: bodies and drops on the band turn with it (their rollback position too, as on the ferry). */
export function rideBand(sim: Sim): void {
  const B = sim.level.band;
  if (!B) return;
  const d = (2 * Math.PI * DT) / B.period, c = Math.cos(d), s = Math.sin(d);
  const on = (x: number, z: number): boolean => { const r = Math.hypot(x - B.x, z - B.z); return r >= B.r0 && r <= B.r1; };
  const bodies = [sim.player, ...sim.enemies.filter((e) => e.state !== 'dead' && !e.def.fly)];
  for (const b of bodies) {
    if (!on(b.x, b.z)) continue;
    turn(b, B.x, B.z, c, s);
    const prev = { x: b.px, z: b.pz };
    turn(prev, B.x, B.z, c, s);
    b.px = prev.x;
    b.pz = prev.z;
  }
  for (const dr of sim.drops) if (dr.landed && on(dr.x, dr.z)) turn(dr, B.x, B.z, c, s);
}

/** Band angle at sim time `t` (render). */
export const bandAngle = (B: BandDef, t: number): number => (2 * Math.PI * t) / B.period;
