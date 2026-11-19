import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { standClip } from './characters';
import { coatSwing } from './hero-model';

describe('standClip', () => {
  it('gives the hammer its two-handed pose and keeps the spear and one-handed kinds on Sword_Idle', () => {
    expect(standClip('hammer', false)).toBe('Pistol_Idle_Loop');
    expect(standClip('spear', false)).toBe('Sword_Idle');
    expect(standClip('blade', false)).toBe('Sword_Idle');
    expect(standClip('sling', false)).toBe('Sword_Idle');
    expect(standClip('hammer', true)).toBe('Idle_Shield_Loop');
    // D8: a one-handed hammer (Pflasterhammer, Rohrzange) stands like the blade.
    expect(standClip('hammer', false, 1)).toBe('Sword_Idle');
  });
});

describe('coatSwing', () => {
  it('follows a thigh that swings back and ignores one that swings forward', () => {
    expect(coatSwing(new Vector3(0, -1, 0))).toBeCloseTo(0, 6);
    expect(coatSwing(new Vector3(0, -Math.cos(0.5), -Math.sin(0.5)))).toBeCloseTo(0.5, 6);
    expect(coatSwing(new Vector3(0, -Math.cos(0.7), Math.sin(0.7)))).toBe(0);
  });
});
