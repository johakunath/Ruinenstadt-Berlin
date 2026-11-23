// M17 Fernsehturm finale (`docs/maps/fernsehturm.md`, task `docs/tasks/m17-fernsehturm.md` › Engine notes):
// what moves inside the tower. The lift between the decks (T2), the clock hands that sweep a ring (T4) and the
// revolving floor band of the Telecafé (T5). All pure functions of sim state and sim time; no render, no DOM.
import type { Point } from './level';
import { focusFlow } from './director';
import { strike } from './combat';
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

/** Lift ring radius and the seconds the hero stands in it before the ride. */
export const LIFT = { r: 1.6, ride: 0.8 } as const;
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

/** Angle of a hand at sim time `t`. */
export function handAngle(h: HandDef, t: number): number {
  return h.a0 + (h.dir * 2 * Math.PI * t) / h.period;
}

/** A hand sweeps while its fight runs (waves, pauses, the hold); it is drawn always. */
export function handActive(sim: Sim, h: HandDef): boolean {
  const ph = sim.run.phase;
  return sim.run.index === h.during && (ph === 'fight' || ph === 'pause' || ph === 'hold');
}

/** The body centre lies on the hand's bar (within `width / 2` of it, between the centre and the tip). */
export function onHand(h: HandDef, t: number, x: number, z: number): boolean {
  const a = handAngle(h, t), ux = Math.sin(a), uz = Math.cos(a), dx = x - h.x, dz = z - h.z;
  const along = dx * ux + dz * uz;
  return along >= 0 && along <= h.len && Math.abs(dx * uz - dz * ux) <= h.width / 2;
}

/**
 * Where travel leads (HUD arrow, the bot): the lift the last won fight opened while the hero is still on that deck,
 * else the walkable spot of the current fight (`EncounterDef.at`), else its centre.
 */
export function travelTarget(sim: Sim): { x: number; z: number; lift: boolean } | null {
  const enc = sim.level.encounters[sim.run.index];
  if (!enc) return null;
  const p = sim.player, lift = sim.level.lifts.find((l) => l.after === sim.run.index - 1 && Math.hypot(l.from.x - p.x, l.from.z - p.z) < 40);
  if (lift) return { x: lift.from.x, z: lift.from.z, lift: true };
  const at = enc.at ?? enc;
  return { x: at.x, z: at.z, lift: false };
}

/** T2: the hero in an open lift ring for `LIFT.ride` s rides to the next deck; enemies and drops stay behind. */
export function updateLifts(sim: Sim): void {
  const p = sim.player, L = sim.level.lifts;
  if (p.state === 'dead') { sim.lift = null; return; }
  const i = L.findIndex((l) => liftOpen(sim, l) && Math.hypot(p.x - l.from.x, p.z - l.from.z) <= l.r);
  if (i < 0) { sim.lift = null; return; }
  const t = sim.lift && sim.lift.i === i ? sim.lift.t + DT : DT;
  if (t < LIFT.ride) { sim.lift = { i, t }; return; }
  const to = L[i]!.to;
  sim.lift = null;
  p.x = p.px = to.x;
  p.z = p.pz = to.z;
  p.vx = p.vz = 0;
  focusFlow(sim, to.x, to.z);
  sim.flow.setTarget(to.x, to.z);
  sim.events.push({ type: 'lift', index: i, x: to.x, z: to.z }, { type: 'checkpoint' });
}

/** T4: hands hit the bodies they pass, once per pass. */
export function updateHands(sim: Sim): void {
  const t = sim.time, p = sim.player;
  for (const h of sim.level.hands) {
    if (!handActive(sim, h)) continue;
    if (p.state !== 'dead' && t - (p.handT ?? -1e9) >= HAND.lockout && onHand(h, t, p.x, p.z)) {
      // Pushed along the sweep: the hand's direction turned a quarter in its sense of travel.
      const a = handAngle(h, t) + (h.dir * Math.PI) / 2;
      if (threatHit(sim, null, 0, HAND.floor, Math.sin(a), Math.cos(a), 'Uhrzeiger')) p.handT = t;
    }
    for (const e of sim.enemies) {
      if (e.state === 'dead' || e.def.fly || t - (e.handT ?? -1e9) < HAND.lockout || !onHand(h, t, e.x, e.z)) continue;
      e.handT = t;
      strike(sim, e, e.maxHp * (e.def.boss ? HAND.boss : HAND.enemy), { feel: 'none', noproc: true, note: 'Zeiger' });
    }
  }
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
