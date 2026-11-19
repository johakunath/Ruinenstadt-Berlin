import { describe, expect, it } from 'vitest';
import { weaponAttack } from '../data/combat';
import { THRUST_HOLD, THRUST_RELEASE, thrustWeight } from './weapons';

describe('thrustWeight (C1 spear thrust grip)', () => {
  const a = weaponAttack('spear', 'light1');

  it('starts at the clip pose and is fully turned at the first active frame', () => {
    expect(thrustWeight(a, a.clipStart)).toBe(0);
    expect(thrustWeight(a, a.clipSwing)).toBeCloseTo(1, 6);
  });

  it('holds through the active frames and lets go after the hold', () => {
    expect(thrustWeight(a, (a.clipSwing + a.clipHit) / 2)).toBe(1);
    expect(thrustWeight(a, a.clipHit + THRUST_HOLD)).toBe(1);
    expect(thrustWeight(a, a.clipHit + THRUST_HOLD + THRUST_RELEASE)).toBe(0);
  });

  it('covers the spear thrusts and the dash (the finisher is a round sweep, playtest 2026-11-18)', () => {
    for (const id of ['light1', 'light2', 'dash'] as const) expect(weaponAttack('spear', id).style).toBe('thrust');
  });
});
