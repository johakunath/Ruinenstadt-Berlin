import { describe, expect, it } from 'vitest';
import { standClip } from './characters';

describe('standClip', () => {
  it('gives the hammer its two-handed pose and keeps the spear and one-handed models on Sword_Idle', () => {
    expect(standClip('hammer', false)).toBe('Pistol_Idle_Loop');
    expect(standClip('spear', false)).toBe('Sword_Idle');
    expect(standClip('pipe', false)).toBe('Sword_Idle');
    expect(standClip('hammer', true)).toBe('Idle_Shield_Loop');
  });
});
