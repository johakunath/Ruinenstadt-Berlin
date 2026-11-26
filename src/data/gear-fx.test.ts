import { describe, expect, it } from 'vitest';
import { GEAR_FX, LEGENDARY_PROC_SITES, equippedFx, fxLook, gearFxVariant } from './gear-fx';
import { heroLook } from './hero-look';
import { LEGENDARY_POWERS, type LegendaryId } from './items';

/** The rows of the task file's Step 5 table (wp4-equipment-visuals.md). */
const TABLE: LegendaryId[] = ['turm', 'zitklinge', 'mauer', 'pbrecher', 'ring', 'kraehe', 'siegsp', 'spaeti', 'panzer', 'rattenmantel', 'ritter', 'pickel', 'kiezbox', 'schaffner', 'weltuhr', 'herz', 'auge', 'bassarm'];

describe('legendary effects (WP4 step 5)', () => {
  it('has an effect for every row of the step 5 table, each a real legendary', () => {
    for (const id of TABLE) expect(GEAR_FX[id], id).toBeDefined();
    for (const id of Object.keys(GEAR_FX)) expect(id in LEGENDARY_POWERS, id).toBe(true);
  });
  it('fires legendaryProc flashes exactly for the sim sites that push the event', () => {
    const viaEvent = (Object.keys(GEAR_FX) as LegendaryId[]).filter((id) => GEAR_FX[id]!.proc?.on === 'legendaryProc');
    expect(new Set(viaEvent)).toEqual(new Set(LEGENDARY_PROC_SITES));
  });
  it('anchors weapon effects on weapons and wear effects on the hero', () => {
    for (const [id, def] of Object.entries(GEAR_FX)) {
      expect(def!.anchor.at === 'weapon', id).toBe(def!.slot === 'w');
      expect(def!.glow !== 'weapon' || def!.slot === 'w', id).toBe(true);
      // Gear glow edges name their own gear part, so the pulse and the anchor find it.
      if (def!.gear) expect(def!.anchor).toEqual({ at: 'gear', id: def!.gear });
    }
  });
  it('reads ?gearfx (default B)', () => {
    expect(gearFxVariant('a')).toBe('A');
    expect(gearFxVariant('C')).toBe('C');
    expect(gearFxVariant(null)).toBe('B');
    expect(gearFxVariant('x')).toBe('B');
  });
  it('orders equipped effects weapon, armor, then the rest; adds glow parts to the look, sorted', () => {
    expect(equippedFx(['herz', 'spaeti', 'turm', 'pickel']).map((f) => f.id)).toEqual(['turm', 'spaeti', 'pickel', 'herz']);
    const look = heroLook({ a: { base: 'spaeti' } });
    const fx = fxLook(look, ['spaeti']);
    expect(fx.gear).toContain('fx-spaeti');
    expect([...fx.gear]).toEqual([...fx.gear].sort());
    expect(fxLook(look, ['turm'])).toBe(look);
  });
});
