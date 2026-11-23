// M17 Fernsehturm invariants (`docs/tasks/m17-fernsehturm.md` › Invariants): decks, fights, lifts, hands, band,
// rest stops and lamps. Scale 1 only (the tower ignores `mapscale`).
import { describe, expect, it } from 'vitest';
import { PLAYER } from './combat';
import { generateLots, generateProps, mapLevel } from './map';
import { deckAt, deckWalk, liftArrival, liftRing, TURM_DECKS, turmMap } from './fernsehturm';
import { colliderDistance } from '../sim/collide';
import { createSim, stepSim } from '../sim/sim';
import { bandAngle, HAND, handAngle, LIFT, liftOpen, onHand, travelTarget } from '../sim/turm';
import { spawnEnemy } from '../sim/enemies';
import { makeItem } from '../sim/items';
import { DT, NO_INPUT, type Sim, type SimEvent } from '../sim/types';
import type { Level } from '../sim/level';
import { simFromSave, snapshot } from '../sim/save';

const map = turmMap();
const level = mapLevel(map, generateLots(map), generateProps(map, []));

/** A body of radius r stands at (x, z): walk grid and colliders. */
const free = (L: Level, x: number, z: number, r: number = PLAYER.radius): boolean =>
  !L.blocked(x, z, r) && !L.near(x, z, r + 1).some((c) => colliderDistance(c, x, z) < r);

/** Flood fill over 1 m cells from (x, z); returns the reached cell keys. */
function flood(L: Level, x: number, z: number): Set<string> {
  const seen = new Set<string>(), key = (c: number, r: number): string => `${c},${r}`;
  const c0 = Math.floor(x), r0 = Math.floor(z), stack: Array<[number, number]> = [[c0, r0]];
  seen.add(key(c0, r0));
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const cc = c + dc, rr = r + dr, k = key(cc, rr);
      if (seen.has(k) || !free(L, cc + 0.5, rr + 0.5)) continue;
      seen.add(k);
      stack.push([cc, rr]);
    }
  }
  return seen;
}

const teleport = (sim: Sim, x: number, z: number): void => {
  const p = sim.player;
  p.x = p.px = x;
  p.z = p.pz = z;
};

describe('Fernsehturm decks', () => {
  it('has five decks 120 m apart in the order of the ascent', () => {
    expect(TURM_DECKS.map((d) => d.id)).toEqual(['foyer', 'schacht', 'panorama', 'telecafe', 'uhrenraum']);
    TURM_DECKS.forEach((d, i) => expect(d.x).toBe(i * 120));
    for (const d of TURM_DECKS) for (const e of TURM_DECKS) if (d !== e) expect(Math.abs(d.x - e.x)).toBeGreaterThan(d.r + e.r + 20);
  });

  it('four fights of 2, 2 after the hold, 3 and 3 waves, echoes in fights 2 to 4, the boss last', () => {
    const E = map.encounters;
    expect(E).toHaveLength(5);
    const normal = E.map((e) => e.waves.filter((w) => w.bosses.length === 0).length - (e.hold ? 1 : 0));
    expect(normal.slice(0, 4)).toEqual([2, 2, 3, 3]);
    expect(E[1]!.hold).toBeDefined();
    for (const i of [1, 2, 3]) {
      const last = E[i]!.waves.at(-1)!;
      expect(last.bosses).toHaveLength(1);
      expect(E[i]!.waves.slice(0, -1).every((w) => w.bosses.length === 0)).toBe(true);
    }
    expect(E[0]!.waves.every((w) => w.bosses.length === 0)).toBe(true);
    expect(E[4]!.waves).toHaveLength(1);
    expect(E[4]!.waves[0]!.bosses).toHaveLength(1);
    // Every fight sits on its own deck, one zone per deck.
    E.forEach((e, i) => { expect(e.zone).toBe(i); expect(deckAt(TURM_DECKS, e.at!.x, e.at!.z)).toBe(TURM_DECKS[i]); });
  });

  it('difficulty rises wave by wave', () => {
    const normal = map.encounters.flatMap((e) => e.waves.filter((w, i) => w.bosses.length === 0 && !(e.hold && i === 0)));
    expect(normal).toHaveLength(10);
    for (let i = 1; i < normal.length; i++) expect(normal[i]!.hpMul).toBeGreaterThan(normal[i - 1]!.hpMul);
  });

  it('start, arrivals, lift rings and the hold ring are walkable and free', () => {
    expect(free(level, map.start.x, map.start.z)).toBe(true);
    for (const d of TURM_DECKS) {
      const a = liftArrival(d), r = liftRing(d);
      expect(free(level, a.x, a.z), `${d.id} arrival`).toBe(true);
      // The ring sits at the core door: its south half is open floor.
      expect(free(level, r.x, r.z + LIFT.r * 0.6), `${d.id} ring`).toBe(true);
    }
    const h = map.encounters[1]!.hold!;
    expect(free(level, h.at!.x, h.at!.z)).toBe(true);
    expect(free(level, h.mouth.x, h.mouth.z, 0.6)).toBe(true);
    for (const e of map.encounters) expect(free(level, e.at!.x, e.at!.z), e.id).toBe(true);
  });

  it('every fight circle is at least 80 % open (the core counts as closed)', () => {
    for (const e of map.encounters) {
      let n = 0, open = 0;
      for (let x = e.x - e.r; x <= e.x + e.r; x += 0.5) for (let z = e.z - e.r; z <= e.z + e.r; z += 0.5) {
        if (Math.hypot(x - e.x, z - e.z) > e.r) continue;
        n++;
        if (free(level, x, z, 0)) open++;
      }
      expect(open / n, e.id).toBeGreaterThan(0.8);
    }
  });

  it('the start reaches only the foyer, each lift target exactly its deck, and nothing else is walkable', () => {
    const regions = [flood(level, map.start.x, map.start.z), ...level.lifts.map((l) => flood(level, l.to.x, l.to.z))];
    regions.forEach((cells, i) => {
      for (const k of cells) {
        const [c, r] = k.split(',').map(Number) as [number, number];
        expect(deckAt(TURM_DECKS, c + 0.5, r + 0.5)).toBe(TURM_DECKS[i]);
      }
      expect(cells.size, TURM_DECKS[i]!.id).toBeGreaterThan(300);
    });
    // Off the decks nothing is walkable (a lone free cell at a deck's rim is the 1 m sampling, not a pocket).
    const B = map.bounds;
    for (let x = B.minX; x < B.maxX; x += 0.5) for (let z = B.minZ; z < B.maxZ; z += 0.5) {
      if (free(level, x, z)) expect(deckAt(TURM_DECKS, x, z), `${x},${z}`).not.toBeNull();
    }
  });

  it('walls are drawn edges: outside a deck and on its core nothing walks', () => {
    for (const d of TURM_DECKS) {
      expect(deckWalk(TURM_DECKS, d.x, d.z)).toBe(false);
      expect(deckWalk(TURM_DECKS, d.x, d.z + d.r + 0.5)).toBe(false);
    }
    expect(deckWalk(TURM_DECKS, 60, 0)).toBe(false);
  });

  it('one rest stop on the way up (kiosk) and one before the boss (bar); doors walk in, walls hold', () => {
    expect(level.rests.map((r) => r.name)).toEqual(['Kiosk', 'Telecafé-Bar']);
    const [kiosk, bar] = level.rests as [typeof level.rests[0], typeof level.rests[0]];
    expect(deckAt(TURM_DECKS, kiosk.x, kiosk.z)?.id).toBe('foyer');
    expect(deckAt(TURM_DECKS, bar.x, bar.z)?.id).toBe('telecafe');
    for (const r of [kiosk, bar]) {
      expect(free(level, r.x, r.z, 0.4), r.name).toBe(true);
      expect(free(level, r.desk!.x, r.desk!.z, 0.4), `${r.name} desk`).toBe(true);
    }
    // The keepers stand behind their counters, out of reach.
    const foyer = flood(level, map.start.x, map.start.z), cafe = flood(level, level.lifts[2]!.to.x, level.lifts[2]!.to.z);
    expect(foyer.has(`${Math.floor(kiosk.desk!.x)},${Math.floor(kiosk.desk!.z)}`)).toBe(true);
    expect(foyer.has(`${Math.floor(kiosk.keeper!.x)},${Math.floor(kiosk.keeper!.z)}`)).toBe(false);
    expect(cafe.has(`${Math.floor(bar.keeper!.x)},${Math.floor(bar.keeper!.z)}`)).toBe(false);
    // The kiosk lies outside the foyer fight.
    const f = map.encounters[0]!;
    expect(Math.hypot(kiosk.x - f.x, kiosk.z - f.z)).toBeGreaterThan(f.r + 2);
    // The bar's rest strip is off the revolving band.
    const B = level.band!;
    expect(Math.hypot(bar.x - B.x, bar.z - B.z)).toBeLessThan(B.r0);
  });

  it('light: every deck has a lamp within 13 m of any walkable sample', () => {
    const L = map.turm!.lights;
    for (let x = map.bounds.minX; x < map.bounds.maxX; x += 1.5) for (let z = map.bounds.minZ; z < map.bounds.maxZ; z += 1.5) {
      if (!deckWalk(TURM_DECKS, x, z, 0.3)) continue;
      expect(L.some((l) => Math.hypot(l.x - x, l.z - z) <= 13), `${x},${z}`).toBe(true);
    }
  });
});

describe('Fernsehturm lift (T2)', () => {
  it('is closed before its fight is won and open after; a ride moves the hero, drops stay and enemies left below go', () => {
    const sim = createSim({ level, empty: true });
    const lift = level.lifts[0]!;
    expect(liftOpen(sim, lift)).toBe(false);
    teleport(sim, lift.from.x, lift.from.z + 0.9);
    for (let i = 0; i < 120; i++) stepSim(sim, NO_INPUT);
    expect(deckAt(TURM_DECKS, sim.player.x, sim.player.z)?.id).toBe('foyer');
    // Win the foyer fight by hand.
    sim.run.index = 1;
    sim.run.phase = 'travel';
    expect(liftOpen(sim, lift)).toBe(true);
    const e = spawnEnemy(sim, 8, 14, 'walker');
    e.sleep = 0.1;
    // A stray on the foyer (bot run 2026-11-23: four howl strays chased the hero through the floor for good) and one up on the Schacht.
    const stray = spawnEnemy(sim, -10, -6, 'walker'), above = spawnEnemy(sim, lift.to.x + 6, lift.to.z, 'walker');
    above.sleep = 0.1;
    sim.drops.push({ id: 99, x: 5, z: 12, vx: 0, vz: 0, h: 0, vh: 0, t: 0, landed: true, content: { kind: 'heal' } });
    const log: SimEvent[] = [];
    let steps = 0;
    while (deckAt(TURM_DECKS, sim.player.x, sim.player.z)?.id === 'foyer' && steps < 120) {
      stepSim(sim, NO_INPUT);
      log.push(...sim.events);
      sim.events.length = 0;
      steps++;
    }
    expect(steps * DT).toBeGreaterThanOrEqual(LIFT.ride - DT);
    expect(steps * DT).toBeLessThan(LIFT.ride + 0.1);
    expect(sim.player.x).toBeCloseTo(lift.to.x);
    expect(sim.player.z).toBeCloseTo(lift.to.z);
    expect(log.some((ev) => ev.type === 'lift')).toBe(true);
    expect(sim.enemies).not.toContain(e);
    expect(sim.enemies).not.toContain(stray);
    expect(sim.enemies).toContain(above);
    expect(sim.drops.find((d) => d.id === 99)!.x).toBe(5);
  });

  it('leaving the ring resets the wait', () => {
    const sim = createSim({ level, empty: true });
    sim.run.index = 1;
    const lift = level.lifts[0]!;
    teleport(sim, lift.from.x, lift.from.z + 0.9);
    for (let i = 0; i < 30; i++) stepSim(sim, NO_INPUT);
    teleport(sim, lift.from.x + 6, lift.from.z + 4);
    stepSim(sim, NO_INPUT);
    expect(sim.lift).toBeNull();
    teleport(sim, lift.from.x, lift.from.z + 0.9);
    for (let i = 0; i < 30; i++) stepSim(sim, NO_INPUT);
    expect(deckAt(TURM_DECKS, sim.player.x, sim.player.z)?.id).toBe('foyer');
  });

  it('travel leads to the lift the last fight opened, then to the next fight', () => {
    const sim = createSim({ level, empty: true });
    expect(travelTarget(sim)).toMatchObject({ lift: false, x: 11, z: -8 });
    sim.run.index = 1;
    expect(travelTarget(sim)).toMatchObject({ lift: true, x: level.lifts[0]!.from.x });
    teleport(sim, level.lifts[0]!.to.x, level.lifts[0]!.to.z);
    expect(travelTarget(sim)!.lift).toBe(false);
  });
});

describe('Fernsehturm clock hands (T4)', () => {
  const hand = level.hands[0]!;
  /** A sim in the panorama fight with the hero standing where the hand will pass. */
  const setup = (): Sim => {
    const sim = createSim({ level, empty: true });
    sim.run.index = hand.during;
    sim.run.phase = 'fight';
    sim.run.wave = 0;
    sim.run.toSpawn = 1e6;
    sim.run.spawnT = 1e9;
    return sim;
  };

  it('angle is a pure function of sim time and the hand sweeps a full turn in its period', () => {
    expect(handAngle(hand, 0)).toBeCloseTo(hand.a0);
    expect(handAngle(hand, hand.period) - handAngle(hand, 0)).toBeCloseTo(2 * Math.PI);
    expect(onHand(hand, 0, hand.x, hand.z - 10)).toBe(true);
    expect(onHand(hand, 0, hand.x, hand.z + 10)).toBe(false);
  });

  it('hits a standing hero once per pass, within the 45 % cap', () => {
    const sim = setup();
    const p = sim.player;
    // Stand 10 m out at the angle the hand reaches after 5 s.
    const a = handAngle(hand, 5);
    teleport(sim, hand.x + Math.sin(a) * 10, hand.z + Math.cos(a) * 10);
    const hits: number[] = [];
    for (let i = 0; i < 60 * hand.period; i++) {
      p.x = p.px = hand.x + Math.sin(a) * 10;
      p.z = p.pz = hand.z + Math.cos(a) * 10;
      const hp = p.hp;
      stepSim(sim, NO_INPUT);
      for (const ev of sim.events) if (ev.type === 'playerHit') hits.push(ev.damage);
      sim.events.length = 0;
      if (p.hp < hp) p.hp = sim.stats.maxHp;
    }
    expect(hits).toHaveLength(1);
    expect(hits[0]!).toBeGreaterThanOrEqual(sim.stats.maxHp * HAND.floor * 0.5);
    expect(hits[0]!).toBeLessThanOrEqual(sim.stats.maxHp * 0.45 + 1e-6);
  });

  it('a dodge passes through', () => {
    const sim = setup();
    const a = handAngle(hand, 5);
    let hit = false;
    for (let i = 0; i < 60 * 8; i++) {
      teleport(sim, hand.x + Math.sin(a) * 10, hand.z + Math.cos(a) * 10);
      sim.player.invuln = 1;
      stepSim(sim, NO_INPUT);
      hit ||= sim.events.some((ev) => ev.type === 'playerHit');
      sim.events.length = 0;
    }
    expect(hit).toBe(false);
  });

  it('hits a standing enemy once per pass and never twice within its lockout', () => {
    const sim = setup();
    sim.god = true;
    const a = handAngle(hand, 5);
    teleport(sim, hand.x, hand.z + 15);
    const e = spawnEnemy(sim, hand.x + Math.sin(a) * 9, hand.z + Math.cos(a) * 9, 'brute');
    e.enc = sim.run.index;
    const times: number[] = [];
    let hp = e.hp;
    for (let i = 0; i < 60 * hand.period * 2 && e.state !== 'dead'; i++) {
      e.x = e.px = hand.x + Math.sin(a) * 9;
      e.z = e.pz = hand.z + Math.cos(a) * 9;
      e.sleep = 0.1;
      stepSim(sim, NO_INPUT);
      sim.events.length = 0;
      if (e.hp < hp) times.push(sim.time);
      hp = e.hp;
    }
    expect(times.length).toBe(2);
    expect(times[1]! - times[0]!).toBeCloseTo(hand.period, 0);
  });

  it('the slow hour hand near the core hits once per pass (Codex review: it stays on a body longer than the lockout)', () => {
    const hour = level.hands[2]!;
    const sim = createSim({ level, empty: true });
    sim.run.index = hour.during;
    sim.run.phase = 'fight';
    sim.run.toSpawn = 1e6;
    sim.run.spawnT = 1e9;
    sim.god = true;
    teleport(sim, hour.x, hour.z + 15);
    // 5 m out (the core is 4 m) where the hand stands after 10 s; watch 20 s, so one pass.
    const a = handAngle(hour, 10), ex = hour.x + Math.sin(a) * 5, ez = hour.z + Math.cos(a) * 5;
    const e = spawnEnemy(sim, ex, ez, 'brute');
    e.enc = sim.run.index;
    // Only the hour hand: the minute hand passes the same spot 2.5 times in that while.
    const minute = level.hands[1]!, during = minute.during;
    minute.during = 99;
    let hits = 0, hp = e.hp;
    try {
      for (let i = 0; i < 60 * 20 && e.state !== 'dead'; i++) {
        e.x = e.px = ex;
        e.z = e.pz = ez;
        e.sleep = 0.1;
        stepSim(sim, NO_INPUT);
        sim.events.length = 0;
        if (e.hp < hp) hits++;
        hp = e.hp;
      }
    } finally { minute.during = during; }
    expect(hits).toBe(1);
  });

  it('enemy damage ignores the hero build and a kill feeds no kill effects', () => {
    const sim = setup();
    sim.god = true;
    const a = handAngle(hand, 5);
    teleport(sim, hand.x, hand.z + 15);
    const e = spawnEnemy(sim, hand.x + Math.sin(a) * 9, hand.z + Math.cos(a) * 9, 'walker');
    e.enc = sim.run.index;
    e.hp = 1;
    const streak = sim.abilities.streak.n;
    for (let i = 0; i < 60 * 6 && e.state !== 'dead'; i++) {
      e.x = e.px = hand.x + Math.sin(a) * 9;
      e.z = e.pz = hand.z + Math.cos(a) * 9;
      e.sleep = 0.1;
      stepSim(sim, NO_INPUT);
      sim.events.length = 0;
    }
    expect(e.state).toBe('dead');
    expect(sim.abilities.streak.n).toBe(streak);
  });

  it('is harmless outside its fight', () => {
    const sim = createSim({ level, empty: true });
    sim.run.index = hand.during + 1;
    let hit = false;
    for (let i = 0; i < 60 * hand.period; i++) {
      teleport(sim, hand.x, hand.z - 10);
      stepSim(sim, NO_INPUT);
      hit ||= sim.events.some((ev) => ev.type === 'playerHit');
      sim.events.length = 0;
    }
    expect(hit).toBe(false);
  });
});

describe('Fernsehturm revolving band (T5)', () => {
  it('a body on the band keeps its radius and gains the band angle; off the band nothing moves', () => {
    const sim = createSim({ level, empty: true });
    const B = level.band!;
    const r = (B.r0 + B.r1) / 2;
    teleport(sim, B.x + r, B.z);
    const e = spawnEnemy(sim, B.x, B.z + B.r1 + 1.5, 'walker');
    e.sleep = 0.1;
    const ex = e.x, ez = e.z;
    const steps = 600;
    for (let i = 0; i < steps; i++) stepSim(sim, NO_INPUT);
    const p = sim.player;
    expect(Math.hypot(p.x - B.x, p.z - B.z)).toBeCloseTo(r, 3);
    const turned = Math.atan2(p.x - B.x, p.z - B.z) - Math.atan2(r, 0);
    expect(turned).toBeCloseTo(bandAngle(B, steps * DT), 3);
    expect(e.x).toBeCloseTo(ex, 6);
    expect(e.z).toBeCloseTo(ez, 6);
  });
});

describe('Fernsehturm scripted run', () => {
  it('rides every lift, holds the crank, chooses the ending and reaches the victory', () => {
    const sim = createSim({ level });
    const log: SimEvent[] = [];
    sim.god = true;
    let guard = 0;
    while (sim.run.phase !== 'won' && guard++ < 60 * 60 * 12) {
      const enc = level.encounters[sim.run.index];
      if (sim.run.phase === 'travel') {
        const to = travelTarget(sim)!;
        teleport(sim, to.lift ? to.x : to.x, to.lift ? to.z + 0.9 : to.z);
      } else if (sim.run.phase === 'hold') {
        teleport(sim, enc!.hold!.at!.x, enc!.hold!.at!.z);
      } else if (sim.run.phase === 'choice') {
        const ring = level.ending[0]!;
        teleport(sim, ring.x, ring.z);
      }
      stepSim(sim, NO_INPUT);
      for (const e of sim.enemies) if (e.state !== 'dead' && e.stateT > 0.3) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
      log.push(...sim.events);
      sim.events.length = 0;
    }
    expect(sim.run.phase).toBe('won');
    expect(log.filter((e) => e.type === 'lift')).toHaveLength(4);
    expect(log.filter((e) => e.type === 'power')).toHaveLength(1);
    expect(log.filter((e) => e.type === 'encounterClear')).toHaveLength(5);
    expect(log.some((e) => e.type === 'choiceOpen')).toBe(true);
    expect(log.find((e) => e.type === 'ending')).toEqual({ type: 'ending', choice: 'gestellt' });
    expect(sim.inventory.camp?.ending).toBe('gestellt');
    expect(log.at(-1)?.type).toBe('victory');
    expect(deckAt(TURM_DECKS, sim.player.x, sim.player.z)?.id).toBe('uhrenraum');
  });
});

describe('Fernsehturm save and resume across decks (step 4)', () => {
  it('a checkpoint after a lift ride resumes on the new deck with the lift behind it open', () => {
    const sim = createSim({ level, empty: true });
    // Won the foyer, rode up: the run saves at the lift's checkpoint.
    sim.run.index = 1;
    sim.run.phase = 'travel';
    const lift = level.lifts[0]!;
    teleport(sim, lift.from.x, lift.from.z + 0.9);
    let saved: ReturnType<typeof snapshot> | null = null;
    for (let i = 0; i < 90 && !saved; i++) {
      stepSim(sim, NO_INPUT);
      if (sim.events.some((e) => e.type === 'checkpoint')) saved = snapshot(sim, map.name, true);
      sim.events.length = 0;
    }
    expect(saved?.run).toBeTruthy();
    const back = simFromSave(saved!, { level }, true);
    expect(deckAt(TURM_DECKS, back.player.x, back.player.z)?.id).toBe('schacht');
    expect(back.run.index).toBe(1);
    expect(liftOpen(back, level.lifts[0]!)).toBe(true);
    expect(liftOpen(back, level.lifts[1]!)).toBe(false);
  });

  it('a retry after death starts at the deck of the fight, not at the door', () => {
    const back = createSim({ level, startAt: 3 });
    expect(deckAt(TURM_DECKS, back.player.x, back.player.z)?.id).toBe('telecafe');
  });

  it('a retry at the ending choice starts on the Uhrenraum at the choice', () => {
    const back = createSim({ level, startAt: level.encounters.length });
    expect(back.run.phase).toBe('choice');
    expect(deckAt(TURM_DECKS, back.player.x, back.player.z)?.id).toBe('uhrenraum');
  });

  it('a run saved at the ending choice resumes at it', () => {
    const sim = createSim({ level, empty: true, startAt: level.encounters.length });
    const ring = level.ending[0]!;
    teleport(sim, ring.x, ring.z + 3);
    const save = snapshot(sim, map.name, true);
    expect(save.run).toBeTruthy();
    const back = simFromSave(save, { level }, true);
    expect(back.run.phase).toBe('choice');
    expect(deckAt(TURM_DECKS, back.player.x, back.player.z)?.id).toBe('uhrenraum');
  });

  it('on the tower a third of the legendaries are its own two', () => {
    const sim = createSim({ level, empty: true });
    expect(sim.lootCtx.turm).toBe(true);
    let own = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      const it = makeItem(sim.rng, sim.lootCtx, 20, 3);
      if (it.name === 'Fernsehturm-Splitter' || it.name === 'Auge des Fernsehturms') own++;
    }
    expect(own / N).toBeGreaterThan(0.3);
    expect(own / N).toBeLessThan(0.5);
  });
});
