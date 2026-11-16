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
