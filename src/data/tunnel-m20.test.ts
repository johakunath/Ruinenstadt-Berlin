// M20: the line generator and the 2D route A content in the tunnel (gratings, flood, generator hold,
// trader on the start platform, collapse with bypass). M19 layout checks: tunnel.test.ts.
import { describe, expect, it } from 'vitest';
import { generateLots, generateProps, inTunnel, mapLevel, tunnelWalk } from './map';
import { tunnelName, LINES } from './lines';
import { lineLayout, TUNNEL, TUNNEL_ROLES, tunnelMap, tunnelZ } from './tunnel';
import { lateTier } from './enemies';
import { colliderDistance } from '../sim/collide';
import { holdGates, POWER_PAUSE } from '../sim/director';
import { spawnEnemy } from '../sim/enemies';
import type { Level } from '../sim/level';
import { contentMarks, talkTo } from '../sim/runcontent';
import { parseSave, simFromSave, snapshot } from '../sim/save';
import { createSim, stepSim } from '../sim/sim';
import { NO_INPUT, type Sim, type SimEvent } from '../sim/types';

const build = (line: number): { m: ReturnType<typeof tunnelMap>; level: Level } => {
  const mm = tunnelMap(line), ll = generateLots(mm);
  return { m: mm, level: mapLevel(mm, ll, generateProps(mm, ll)) };
};
const { m, level } = build(0);

/** Flood fill on foot over 1 m cells; `colliders`: closed gratings and props block too. */
function walkFrom(L: Level, x0: number, z0: number, colliders: boolean): (x: number, z: number) => boolean {
  const seen = new Set<string>(), q: Array<[number, number]> = [[Math.round(x0), Math.round(z0)]];
  const free = (x: number, z: number): boolean => !L.blocked(x, z, 0.4) && (!colliders || !L.near(x, z, 1).some((c) => colliderDistance(c, x, z) < 0.4));
  while (q.length) {
    const [x, z] = q.pop()!, k = `${x},${z}`;
    if (seen.has(k) || !free(x, z)) continue;
    seen.add(k);
    q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return (x, z) => [0, 1, -1].some((dx) => [0, 1, -1].some((dz) => seen.has(`${Math.round(x) + dx},${Math.round(z) + dz}`)));
}

function teleport(sim: Sim, x: number, z: number): void {
  sim.player.x = sim.player.px = x;
  sim.player.z = sim.player.pz = z;
}

/** Steps with an invulnerable hero; enemies that woke up for a fight die after 0.3 s (except elites if `elites`). */
function step(sim: Sim, log: SimEvent[], keepElites = false): void {
  sim.player.invuln = 1e9;
  stepSim(sim, NO_INPUT);
  for (const e of sim.enemies) if (e.state !== 'dead' && e.sleep === undefined && e.stateT > 0.3 && !(keepElites && e.elite)) { e.state = 'dead'; e.stateT = 0; e.hp = 0; }
  log.push(...sim.events);
  sim.events.length = 0;
}

/** Scripted run (as in director.test.ts): stand in each fight, kill what comes. */
function scriptedRun(sim: Sim): SimEvent[] {
  const log: SimEvent[] = [];
  for (let n = 0; n < 60 * 60 * 20 && sim.run.phase !== 'won'; n++) {
    const enc = sim.level.encounters[sim.run.index]!;
    if (sim.run.phase === 'travel') teleport(sim, enc.x, enc.z);
    step(sim, log);
  }
  return log;
}

describe('M20 tunnel generator (every line)', () => {
  it('line 0 is the S3 tunnel the saves know', () => {
    expect(m.id).toBe('tunnel-s3');
    expect(m.name).toBe('S3-Tunnel');
    expect(tunnelMap(0)).toEqual(tunnelMap());
    expect(m.tunnel!.line).toBe(0);
    expect(m.encounters.map((e) => e.name)).toEqual(['Tunnelmund', 'Kabelschacht', 'Geisterbahnhof Rummelsburg', 'Kehrgleis', 'Zugwrack', 'Generator Warschauer Straße']);
    expect(lineLayout(0).order).toEqual(['collapse', 'flood', 'wreck']);
    expect(m.tunnel!.signs.map((s) => s.text)).toEqual(expect.arrayContaining(['Köpenick', 'Rummelsburg', 'Warschauer Straße']));
  });

  it('every line reuses the S3 tunnel, only the names follow the line (Johannes, 2026-11-18)', () => {
    const s3 = tunnelMap(0);
    for (const [k, L] of LINES.entries()) {
      const mm = tunnelMap(k);
      expect(mm.encounters.map((e) => [e.x, e.z])).toEqual(s3.encounters.map((e) => [e.x, e.z]));
      expect(mm.tunnel!.tubes).toEqual(s3.tunnel!.tubes);
      expect(mm.zones[1]!.name).toBe(`Geisterbahnhof ${L.ghost}`);
    }
  });

  it('U2 (M15 step 8): Alexanderplatz enemies to the ghost station, Mitte enemies after it, the Alex late tier', () => {
    const u2 = tunnelMap(2), kinds = (z: number): Set<string> => new Set(u2.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves.flatMap((w) => Object.keys(w.mix).filter((k) => (w.mix as Record<string, number>)[k]! > 0))));
    expect(u2.encounters.map((e) => e.name)).toEqual(['Tunnelmund', 'Einsturz', 'Geisterbahnhof Klosterstraße', 'Kehrgleis', 'Zugwrack', 'Generator Potsdamer Platz']);
    expect([...kinds(0)]).toEqual(expect.arrayContaining(['uhrwerk', 'kernspeier']));
    expect([...kinds(1)]).toEqual(expect.arrayContaining(['kabel', 'bass']));
    for (const k of ['uhrwerk', 'wurzler', 'kernspeier']) expect(kinds(1).has(k), k).toBe(false);
    for (const k of ['crow', 'drone']) { expect(kinds(0).has(k), k).toBe(false); expect(kinds(1).has(k), k).toBe(false); }
    // The S3 and the U8 keep the Köpenick mix at the late tier of their start district (S3 14 … 19, U8 25 … 30).
    const s3 = tunnelMap(0), u8 = tunnelMap(1), first = (t: typeof s3): number => t.encounters[0]!.waves[0]!.hpMul;
    expect(u8.encounters.map((e) => e.waves.map((w) => Object.keys(w.mix)))).toEqual(s3.encounters.map((e) => e.waves.map((w) => Object.keys(w.mix))));
    // The generator's first wave takes the line's first tier, so the Tunnelmund starts one above it.
    expect(first(s3)).toBeCloseTo((1 + 15 * 0.13) * lateTier(15).hp * TUNNEL.hp);
    expect(first(u8)).toBeCloseTo((1 + 26 * 0.13) * lateTier(26).hp * TUNNEL.hp);
    expect(first(u2)).toBeCloseTo((1 + 34 * 0.13) * lateTier(34).hp * TUNNEL.hp);
    expect(u2.encounters.at(-1)!.waves[1]!.bosses).toEqual(['schaffner']);
  });

  it('U2 west (M16 step 8): Mitte enemies to Bülowstraße, Charlottenburg glass after it, the Mitte late tier', () => {
  const u = tunnelMap(3), kinds = (z: number): Set<string> => new Set(u.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves.flatMap((w) => Object.keys(w.mix).filter((k) => (w.mix as Record<string, number>)[k]! > 0))));
  expect(u.name).toBe('U2-Tunnel West');
  expect(u.encounters.map((e) => e.name)).toEqual(['Tunnelmund', 'Einsturz', 'Geisterbahnhof Bülowstraße', 'Kehrgleis', 'Zugwrack', 'Generator Zoologischer Garten']);
  for (const k of ['scherbe', 'loge', 'souffleur']) expect(kinds(0).has(k), k).toBe(false);
  expect([...kinds(1)]).toEqual(expect.arrayContaining(['scherbe']));
  expect(u.encounters[0]!.waves[0]!.hpMul).toBeCloseTo((1 + 42 * 0.13) * lateTier(42).hp * TUNNEL.hp);
  expect(u.encounters.at(-1)!.waves[1]!.bosses).toEqual(['schaffner']);
});

it('U9 (M18 step 3): Charlottenburg enemies to Westhafen, the Wedding feast after it, the Charlottenburg late tier, no carpets', () => {
  const u = tunnelMap(4), kinds = (z: number): Set<string> => new Set(u.encounters.filter((e) => e.zone === z).flatMap((e) => e.waves.flatMap((w) => Object.keys(w.mix).filter((k) => (w.mix as Record<string, number>)[k]! > 0))));
  expect(u.name).toBe('U9-Tunnel');
  expect(u.id).toBe('tunnel-u9');
  expect(u.encounters.map((e) => e.name)).toEqual(['Tunnelmund', 'Einsturz', 'Geisterbahnhof Westhafen', 'Kehrgleis', 'Zugwrack', 'Generator Leopoldplatz']);
  expect(kinds(0).has('teeifrit')).toBe(false);
  expect([...kinds(1)]).toEqual(expect.arrayContaining(['teeifrit']));
  expect(kinds(1).has('teppich')).toBe(false);
  expect(u.encounters[0]!.waves[0]!.hpMul).toBeCloseTo((1 + 50 * 0.13) * lateTier(50).hp * TUNNEL.hp);
});

  for (const [k, L] of LINES.entries()) {
    it(`${L.id}: valid, sealed by its gratings and winnable`, () => {
      const { m: mm, level: lv } = build(k);
      expect(mm.id.startsWith(`tunnel-${L.id.toLowerCase()}`)).toBe(true);
      expect(mm.name).toBe(tunnelName(k));
      expect(mm.zones[1]!.name).toBe(`Geisterbahnhof ${L.ghost}`);
      expect(new Set(mm.tunnel!.signs.map((s) => s.text)).size).toBe(3);
      expect(tunnelWalk(mm, mm.start.x, mm.start.z, 0.5)).toBe(true);
      for (const e of mm.encounters) expect(tunnelWalk(mm, e.x, e.z, 1), e.name).toBe(true);
      for (const p of generateProps(mm, [])) expect(inTunnel(mm, p.x, p.z), `${p.kind} ${p.x},${p.z}`).toBe(true);
      // Gratings open (walk grid only): every place is reachable on foot, the bypass too.
      const open = walkFrom(lv, mm.start.x, mm.start.z, false);
      for (const e of mm.encounters) expect(open(e.x, e.z), e.name).toBe(true);
      for (const q of [mm.hiddenSpots![0]!, mm.guards![0]!, mm.tunnel!.trader, mm.encounters.at(-1)!.hold!.mouth]) expect(open(q.x, q.z)).toBe(true);
      const by = mm.tunnel!.tubes.find((t) => t.kind === 'bypass')!;
      const mid = by.pts[Math.floor(by.pts.length / 2)]!;
      expect(open(mid[0], mid[1])).toBe(true);
      // The collapse closes the track bed where its rubble lies: the bypass is the only way.
      const r = mm.tunnel!.rubble!.pts[Math.floor(mm.tunnel!.rubble!.pts.length / 2)]!;
      expect(lv.blocked(r[0], r[1])).toBe(true);
      // Closed gratings (and props): the first fight and the blessing passage are reachable, the second fight is not.
      const shut = walkFrom(lv, mm.start.x, mm.start.z, true);
      expect(shut(mm.encounters[0]!.x, mm.encounters[0]!.z)).toBe(true);
      expect(shut(mm.hiddenSpots![0]!.x, mm.hiddenSpots![0]!.z)).toBe(true);
      expect(shut(mm.encounters[1]!.x, mm.encounters[1]!.z)).toBe(false);
      // A scripted run opens all five gratings, charges the generator and ends in victory.
      const log = scriptedRun(createSim({ level: lv, seed: 2 + k }));
      expect(log.filter((e) => e.type === 'gateOpen')).toHaveLength(TUNNEL.gates.length);
      expect(log.filter((e) => e.type === 'power')).toHaveLength(1);
      expect(log.at(-1)?.type).toBe('victory');
    });
  }
});

describe('M20 gratings', () => {
  it('a grating opens when its fight is won: collider out, heal drop, event; a new run closes it again', () => {
    const sim = createSim({ level, seed: 3 });
    const gate = level.gates[0]!;
    expect(gate.after).toBe(0);
    expect(level.colliders).toContain(gate.collider);
    expect(sim.gateT[0]).toBe(Infinity);
    const enc = m.encounters[0]!;
    const log: SimEvent[] = [];
    for (let n = 0; n < 60 * 120 && sim.run.index === 0; n++) {
      teleport(sim, enc.x, enc.z);
      step(sim, log);
    }
    expect(log.find((e) => e.type === 'gateOpen')).toMatchObject({ index: 0, x: gate.x, z: gate.z });
    expect(level.colliders).not.toContain(gate.collider);
    expect(sim.gateT[0]).toBeLessThan(Infinity);
    expect(sim.gateT[1]).toBe(Infinity);
    expect(sim.drops.some((d) => d.content.kind === 'heal' && Math.hypot(d.x - gate.x, d.z - gate.z) < 3)).toBe(true);
    createSim({ level, seed: 3 });
    expect(level.colliders).toContain(gate.collider);
  });

  it('a body pushed through a closed grating goes back in front of it; one farther on stays (B2 step 2)', () => {
    const sim = createSim({ level, seed: 3 });
    const g = level.gates[0]!, enc = m.encounters[0]!;
    const ux = Math.sin(g.rot), uz = Math.cos(g.rot);
    const front = Math.sign((enc.x - g.x) * ux + (enc.z - g.z) * uz);
    const along = (b: { x: number; z: number }): number => (b.x - g.x) * ux + (b.z - g.z) * uz;
    const through = spawnEnemy(sim, g.x - ux * front * 0.5, g.z - uz * front * 0.5, 'walker', 1, 1);
    const beyond = spawnEnemy(sim, g.x - ux * front * 4, g.z - uz * front * 4, 'walker', 1, 1);
    holdGates(sim);
    expect(along(through) * front).toBeGreaterThan(0.3);
    expect(along(beyond) * front).toBeCloseTo(-4);
    sim.gateT[0] = 0;
    const back = spawnEnemy(sim, g.x - ux * front * 0.5, g.z - uz * front * 0.5, 'walker', 1, 1);
    holdGates(sim);
    expect(along(back) * front).toBeCloseTo(-0.5);
  });

  it('a retry or a resume at a later fight finds the gratings before it open', () => {
    const sim = createSim({ level, startAt: 3 });
    expect(sim.gateT.slice(0, 3).every((t) => t < 0)).toBe(true);
    expect(sim.gateT.slice(3).every((t) => t === Infinity)).toBe(true);
    for (const g of level.gates) expect(level.colliders.includes(g.collider)).toBe(g.after >= 3);
    expect(sim.events.filter((e) => e.type === 'gateOpen')).toHaveLength(0);
  });
});

describe('M20 flooded stretch', () => {
  /** Meters walked along +x in 1.5 s after a 0.5 s run-up from (x, z). */
  const walk = (x: number, z: number): number => {
    const sim = createSim({ level, seed: 1, empty: true });
    teleport(sim, x, z);
    for (let i = 0; i < 30; i++) stepSim(sim, { ...NO_INPUT, moveX: 1 });
    const x0 = sim.player.x;
    for (let i = 0; i < 90; i++) stepSim(sim, { ...NO_INPUT, moveX: 1 });
    return sim.player.x - x0;
  };
  it('the hero wades at the flood factor (2D 0.7)', () => {
    const f = m.tunnel!.flood!;
    expect(f.slow).toBe(TUNNEL.floodSlow);
    expect(TUNNEL.floodSlow).toBe(0.7);
    const [fx] = f.pts[0]!;
    const wet = walk(fx + 3, tunnelZ(fx + 3) + 1.2), dry = walk(176, tunnelZ(176) + 1.2);
    expect(wet / dry).toBeCloseTo(0.7, 1);
    expect(level.speedAt(fx + 10, tunnelZ(fx + 10))).toBe(0.7);
    expect(level.speedAt(fx - 4, tunnelZ(fx - 4))).toBe(1);
  });
  it('enemies on foot wade too, flyers do not', () => {
    const [fx] = m.tunnel!.flood!.pts[3]!;
    const run = (kind: 'walker' | 'crow', x: number): number => {
      const sim = createSim({ level, seed: 1, empty: true });
      sim.enemies.length = 0;
      teleport(sim, x + 25, tunnelZ(x + 25));
      sim.player.invuln = 1e9;
      const e = spawnEnemy(sim, x, tunnelZ(x), kind);
      const x0 = e.x;
      for (let i = 0; i < 45; i++) stepSim(sim, NO_INPUT);
      return e.x - x0;
    };
    expect(run('walker', fx) / run('walker', 176)).toBeLessThan(0.8);
    expect(run('crow', fx) / run('crow', 176)).toBeGreaterThan(0.9);
  });
});

describe('M20 generator hold', () => {
  const H = m.encounters.at(-1)!;
  const atHold = (): Sim => {
    const sim = createSim({ level, startAt: 5, seed: 5 });
    teleport(sim, H.x, H.z);
    sim.player.invuln = 1e9;
    stepSim(sim, NO_INPUT);
    return sim;
  };
  it('a save during the hold counts its wave once after the resume (Codex review)', () => {
    const sim = atHold();
    const counted = sim.lootWaves;
    const back = simFromSave(snapshot(sim, m.name, true), { level, seed: 5 }, true);
    expect(back.run.phase).toBe('travel');
    teleport(back, H.x, H.z);
    stepSim(back, NO_INPUT);
    expect(back.run.phase).toBe('hold');
    expect(back.lootWaves).toBe(counted);
  });
  it('starts at the generator and charges only while the hero stands in the ring', () => {
    const sim = atHold();
    expect(sim.run.phase).toBe('hold');
    expect(sim.events.some((e) => e.type === 'holdStart')).toBe(true);
    const log: SimEvent[] = [];
    for (let i = 0; i < 60 * 10; i++) step(sim, log);
    expect(sim.run.hold!.p).toBeCloseTo(10, 0);
    expect(sim.run.hold!.inside).toBe(true);
    // Out of the ring: the charge waits, and so do the spawns.
    teleport(sim, H.x - H.hold!.r - 6, H.z);
    const p0 = sim.run.hold!.p, born = sim.nextId;
    for (let i = 0; i < 60 * 5; i++) step(sim, log);
    expect(sim.run.hold!.p).toBe(p0);
    expect(sim.run.hold!.inside).toBe(false);
    expect(sim.nextId).toBe(born);
    expect(sim.run.phase).toBe('hold');
  });
  it('spawns come out of the tunnel mouth, an elite brute at half charge', () => {
    const sim = atHold();
    const born = new Map<number, { x: number; z: number }>();
    const log: SimEvent[] = [];
    for (let i = 0; i < 60 * (TUNNEL.hold.need / 2 + 3); i++) {
      step(sim, log, true);
      for (const e of sim.enemies) if (!born.has(e.id) && e.sleep === undefined) born.set(e.id, { x: e.x, z: e.z });
    }
    expect(born.size).toBeGreaterThan(5);
    const mouth = H.hold!.mouth;
    for (const q of born.values()) expect(Math.hypot(q.x - mouth.x, q.z - mouth.z)).toBeLessThan(5);
    expect(sim.run.hold!.elite).toBe(true);
    expect(sim.enemies.some((e) => e.elite && e.kind === 'brute' && e.sleep === undefined)).toBe(true);
  });
  it('full charge: power, a pause, then Der Schaffner; winning ends the tunnel', () => {
    const sim = atHold();
    const log: SimEvent[] = [];
    for (let i = 0; i < 60 * (TUNNEL.hold.need + 1); i++) step(sim, log);
    expect(log.filter((e) => e.type === 'power')).toHaveLength(1);
    expect(sim.run.phase).toBe('pause');
    expect(sim.run.wave).toBe(1);
    sim.player.invuln = 1e9;
    for (let i = 0; i < 60 * (POWER_PAUSE + 0.5); i++) { sim.player.invuln = 1e9; stepSim(sim, NO_INPUT); log.push(...sim.events); sim.events.length = 0; }
    expect(log.find((e) => e.type === 'waveStart')).toMatchObject({ wave: 1, waves: 2 });
    expect(sim.enemies.some((e) => e.kind === 'schaffner')).toBe(true);
    for (let i = 0; i < 60 * 30 && sim.run.phase !== 'won'; i++) step(sim, log);
    expect(log.at(-1)?.type).toBe('victory');
  });
});

describe('M20 trader on the start platform', () => {
  it('stands there all run, sells on a talk press, no mark and no leg events', () => {
    const sim = createSim({ level, seed: 9 });
    const T = sim.content.trader!;
    expect(T).toMatchObject({ ...m.tunnel!.trader, fixed: true });
    expect(T.offers.length).toBeGreaterThanOrEqual(3);
    expect(contentMarks(sim)).toHaveLength(0);
    expect(sim.content.plan.every((p) => p === null)).toBe(true);
    expect(Math.hypot(T.x - m.start.x, T.z - m.start.z)).toBeLessThan(12);
    for (let i = 0; i < 60 * 90; i++) stepSim(sim, NO_INPUT);
    expect(sim.content.trader).not.toBeNull();
    teleport(sim, T.x + 0.8, T.z);
    stepSim(sim, NO_INPUT);
    expect(talkTo(sim)).toBe(true);
    expect(sim.content.tradeAt).toBe(-1);
  });
  it('survives a checkpoint save', () => {
    const sim = createSim({ level, seed: 9 });
    const save = parseSave(JSON.stringify(snapshot(sim, m.name, true)))!;
    const back = simFromSave(save, { seed: 1, stress: 0, level }, true);
    expect(back.content.trader).toMatchObject({ x: m.tunnel!.trader.x, fixed: true });
    expect(back.content.trader!.t).toBeGreaterThan(1e6);
  });
});

describe('tunnel roles (B2 step 3)', () => {
  it('every normal tunnel wave on every line brings fodder, a heavy line and a bulwark, in fewer bodies', () => {
    for (const line of LINES.keys()) {
      for (const e of tunnelMap(line).encounters) for (const w of e.waves) {
        if (w.bosses.length) continue;
        for (const k of ['runner', 'zuender', 'brute', 'schild'] as const) expect(w.mix[k] ?? 0, `${line} ${e.name} ${k}`).toBeGreaterThan(0);
        expect(w.maxAlive).toBeLessThanOrEqual(TUNNEL_ROLES.maxAlive);
      }
    }
  });
});
