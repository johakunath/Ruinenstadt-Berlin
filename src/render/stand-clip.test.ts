import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { coatSwing, standClip } from './characters';

describe('standClip', () => {
  it('gives the hammer its two-handed pose and keeps the spear and one-handed models on Sword_Idle', () => {
    expect(standClip('hammer', false)).toBe('Pistol_Idle_Loop');
    expect(standClip('spear', false)).toBe('Sword_Idle');
    expect(standClip('pipe', false)).toBe('Sword_Idle');
    expect(standClip('hammer', true)).toBe('Idle_Shield_Loop');
  });
});

describe('coatSwing', () => {
  it('follows a thigh that swings back and ignores one that swings forward', () => {
    expect(coatSwing(new Vector3(0, -1, 0))).toBeCloseTo(0, 6);
    expect(coatSwing(new Vector3(0, -Math.cos(0.5), -Math.sin(0.5)))).toBeCloseTo(0.5, 6);
    expect(coatSwing(new Vector3(0, -Math.cos(0.7), Math.sin(0.7)))).toBe(0);
  });
});
