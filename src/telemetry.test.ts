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
