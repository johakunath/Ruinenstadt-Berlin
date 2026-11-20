import { describe, expect, it } from 'vitest';
import { FrameStats } from './telemetry';

describe('telemetry frame stats', () => {
  it('measures fps, p95 and the slow tail from frame times', () => {
    const f = new FrameStats();
    for (let i = 0; i < 95; i++) f.add(1 / 60);
    for (let i = 0; i < 5; i++) f.add(0.05);
    expect(f.fps).toBeGreaterThan(50);
    expect(f.fps).toBeLessThan(60);
    expect(f.quantile(0.95)).toBe(17);
    expect(f.quantile(0.99)).toBe(50);
  });
});

describe('telemetry eligibility', () => {
  it('records nothing in automated or opted-out sessions, so nothing can be sent later', async () => {
    const { vi } = await import('vitest');
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    vi.stubGlobal('location', { hostname: 'johakunath.github.io' });
    vi.stubGlobal('navigator', { webdriver: false, userAgent: 'test' });
    vi.stubGlobal('addEventListener', () => undefined);
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('screen', { width: 1280, height: 800 });
    vi.useFakeTimers();
    const { Telemetry } = await import('./telemetry');
    const { createSim } = await import('./sim/sim');
    const sim = createSim({ empty: true });
    const play = (t: InstanceType<typeof Telemetry>): void => {
      t.begin(sim, { map: 'Köpenick', profile: 'leistung', scale: 1, startAt: 0, input: 'touch' });
      for (let i = 0; i < 600; i++) t.frame(1 / 60, sim, { calls: 100, triangles: 1000 }, 'touch');
      t.end('win');
    };
    play(new Telemetry(true, true)); // ?autostart
    play(new Telemetry(false, false)); // switched off in Optionen
    expect(mem.get('ruinenstadt-berlin.tlq') ?? null).toBeNull();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('telemetry fight log', () => {
  it('logs life at the start, max and lowest life per fight and drops quits in the first minute', async () => {
    const { vi } = await import('vitest');
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    vi.stubGlobal('location', { hostname: 'johakunath.github.io' });
    vi.stubGlobal('navigator', { webdriver: false, userAgent: 'test' });
    vi.stubGlobal('addEventListener', () => undefined);
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('screen', { width: 1280, height: 800 });
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    vi.useFakeTimers();
    const { Telemetry, VERSION } = await import('./telemetry');
    const { createSim } = await import('./sim/sim');
    const sim = createSim({ empty: true });
    const t = new Telemetry(true, false);
    const ctx = { map: 'Köpenick', profile: 'leistung', scale: 1, startAt: 0, input: 'touch' };
    const tick = (n: number): void => { for (let i = 0; i < n; i++) t.frame(1 / 60, sim, { calls: 100, triangles: 1000 }, 'touch'); };
    t.begin(sim, ctx);
    tick(3540); // 59 s, then quit: a test start
    t.end('quit');
    t.begin(sim, ctx);
    tick(600); // a death after 10 s still counts
    t.end('dead');
    t.begin(sim, ctx);
    // Life lost before the fight (review 2026-11-20): `h0` says where the fight's `low` counts from.
    t.event({ type: 'encounterStart', index: 0, hp: 53.6 });
    sim.player.hp = sim.stats.maxHp * 0.4;
    tick(60);
    sim.player.hp = sim.stats.maxHp;
    tick(600);
    // A hit drained between frames (e.g. the killing blow) still counts.
    t.event({ type: 'playerHit', x: 0, z: 0, dx: 0, dz: 0, damage: 90.333, hp: 5, by: 'Ratte' });
    t.event({ type: 'encounterClear', index: 0, heal: 0 });
    t.end('win');
    const q = JSON.parse(mem.get('ruinenstadt-berlin.tlq')!) as Array<{ v: string; end: string; enc: Array<{ hp?: number; low?: number; h0?: number; dmg: number }> }>;
    expect(q.map((r) => r.end)).toEqual(['dead', 'win']);
    expect(q[1]!.enc[0]!.hp).toBe(Math.round(sim.stats.maxHp));
    expect(q[1]!.enc[0]!.low).toBe(5);
    expect(q[1]!.enc[0]!.h0).toBe(54);
    expect(q[1]!.enc[0]!.dmg).toBe(90.3);
    expect(VERSION).toMatch(/^3d-0\.1\.0\+\w+$/);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
