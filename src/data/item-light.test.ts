import { describe, expect, it } from 'vitest';
import { heroLook, WEAR } from './hero-look';
import { BEAM_GEAR, GLOW_GEAR, GLOW_WEAPONS, heroLight } from './item-light';
import { WEAPON_LOOKS } from './weapon-look';

/** Every gear part some wearable item puts on the hero. */
const WORN_GEAR = new Set(Object.values(WEAR).flatMap((slot) => Object.values(slot).flatMap((w) => w.gear ?? [])));

describe('item light (WP4 step 5b)', () => {
  it('the Stirnlampe des Tunnelläufers throws a beam', () => {
    const look = heroLook({ h: { base: 'nbrille', set: 'tunnel' } });
    expect(heroLight(look, 'stahl').beam).toBe(BEAM_GEAR['hat-headlamp']);
  });

  it('a plain look carries no light', () => {
    expect(heroLight(heroLook({}), 'stahl')).toEqual({ beam: null, glow: null });
  });

  it('the Neonbrille is no lamp', () => {
    expect(heroLight(heroLook({ h: { base: 'nbrille' } }), 'stahl').beam).toBeNull();
  });

  it('a lamp in hand outshines the hip lantern', () => {
    const look = heroLook({ a: { base: 'mantel', set: 'tunnel' } });
    expect(heroLight(look, 'stahl').glow).toBe(GLOW_GEAR['belt-tunnel']);
    expect(heroLight(look, 'leucht').glow).toBe(GLOW_WEAPONS.leucht);
  });

  it('every light key exists', () => {
    for (const id of Object.keys(GLOW_WEAPONS)) expect(Object.hasOwn(WEAPON_LOOKS, id), id).toBe(true);
    for (const id of [...Object.keys(BEAM_GEAR), ...Object.keys(GLOW_GEAR)]) expect(WORN_GEAR.has(id), id).toBe(true);
  });
});
