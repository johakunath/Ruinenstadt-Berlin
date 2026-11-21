import { describe, expect, it } from 'vitest';
import { DynamicResolution } from './dyn-res';

const run = (d: DynamicResolution, ms: number, seconds: number, target = 1000 / 60): number => {
  let changes = 0;
  for (let t = 0; t < seconds * 1000; t += ms) if (d.frame(ms, target)) changes++;
  return changes;
};
/** Frames that cost `cpu` ms whatever the scale and `gpu` ms × scale² for the pixels. */
const model = (d: DynamicResolution, cpu: number, gpu: number, seconds: number, target = 1000 / 60): void => {
  for (let t = 0; t < seconds * 1000;) { const ms = Math.max(cpu, gpu * d.scale * d.scale); d.frame(ms, target); t += ms; }
};

describe('dynamic resolution', () => {
  it('GPU-bound: steps down while it helps, never below min', () => {
    const d = new DynamicResolution({ min: 0.75 });
    model(d, 8, 16, 5);
    expect(d.scale).toBe(1);
    model(d, 8, 25, 2.6);
    expect(d.scale).toBe(0.9);
    model(d, 8, 25, 30);
    expect(d.scale).toBeLessThanOrEqual(0.9);
    const e = new DynamicResolution({ min: 0.75 });
    model(e, 8, 60, 60);
    expect(e.scale).toBe(0.75);
  });

  it('CPU-bound: a step that buys nothing goes back, and after two such steps it stays sharp (tablet 2026-11-20)', () => {
    const d = new DynamicResolution({ min: 0.6 });
    model(d, 30, 12, 8);
    expect(d.scale).toBe(1);
    model(d, 30, 12, 600);
    expect(d.scale).toBe(1);
    let changes = 0;
    for (let t = 0; t < 600_000; t += 30) if (d.frame(30, 1000 / 60)) changes++;
    expect(changes).toBe(0);
  });

  it('off at min 1', () => {
    const d = new DynamicResolution({ min: 1 });
    run(d, 40, 10);
    expect(d.scale).toBe(1);
  });

  it('climbs back slowly once frames are on time', () => {
    const d = new DynamicResolution({ min: 0.6 });
    model(d, 6, 60, 30);
    expect(d.scale).toBe(0.6);
    run(d, 1000 / 60, 7.5);
    expect(d.scale).toBe(0.65);
    run(d, 1000 / 60, 60);
    expect(d.scale).toBe(1);
  });

  it('uses the frame budget: 30 ms frames are on time with Akkusparen', () => {
    const d = new DynamicResolution({ min: 0.6 });
    run(d, 30, 10, 1000 / 30);
    expect(d.scale).toBe(1);
  });

  it('a 60 fps cap on a 144 Hz screen (14 and 21 ms in turn) is on time', () => {
    const d = new DynamicResolution({ min: 0.6 });
    for (let i = 0; i < 2000; i++) d.frame(i % 2 ? 20.8 : 13.9, 1000 / 60);
    expect(d.scale).toBe(1);
  });

  it('ignores single hitches', () => {
    const d = new DynamicResolution({ min: 0.6 });
    for (let i = 0; i < 20; i++) d.frame(400, 1000 / 60);
    expect(d.scale).toBe(1);
  });
});
