import { describe, expect, it } from 'vitest';
import { DynamicResolution } from './dyn-res';

const run = (d: DynamicResolution, ms: number, seconds: number, target = 1000 / 60, cpu = 0): number => {
  let changes = 0;
  for (let t = 0; t < seconds * 1000; t += ms) if (d.frame(ms, target, cpu)) changes++;
  return changes;
};

describe('dynamic resolution', () => {
  it('keeps full scale when the CPU is the bottleneck (fewer pixels would only blur)', () => {
    const d = new DynamicResolution({ min: 0.6 });
    run(d, 33, 20, 1000 / 60, 28);
    expect(d.scale).toBe(1);
  });

  it('climbs back once frames turn CPU-bound', () => {
    const d = new DynamicResolution({ min: 0.6 });
    run(d, 30, 10, 1000 / 60, 5);
    expect(d.scale).toBe(0.6);
    run(d, 33, 60, 1000 / 60, 28);
    expect(d.scale).toBe(1);
  });

  it('off at min 1', () => {
    const d = new DynamicResolution({ min: 1 });
    run(d, 40, 10);
    expect(d.scale).toBe(1);
  });

  it('steps down after 2 s of late frames, never below min', () => {
    const d = new DynamicResolution({ min: 0.75 });
    run(d, 1000 / 60, 5);
    expect(d.scale).toBe(1);
    run(d, 25, 2.1);
    expect(d.scale).toBe(0.9);
    run(d, 25, 20);
    expect(d.scale).toBe(0.75);
  });

  it('climbs back slowly once frames are on time', () => {
    const d = new DynamicResolution({ min: 0.6 });
    run(d, 30, 10);
    expect(d.scale).toBe(0.6);
    run(d, 1000 / 60, 7);
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
