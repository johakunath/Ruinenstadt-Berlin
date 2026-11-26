// WP4 step 5: the glow-edge gear parts sit on real bones and keep the legendary looks inside the gear budget;
// the weapon glow edges keep every model inside its envelope (weapons.test.ts) and use the signature paint.
import { describe, expect, it } from 'vitest';
import { GEAR_FX } from '../data/gear-fx';
import { heroLook } from '../data/hero-look';
import { GEAR, GEAR_BUDGET, gearGeometry, gearTriangles } from './gear';
import { FX_GEAR } from './gear-fx-parts';
import { GearKit } from './gear-kit';
import { readHeroGlb } from './hero-glb-node';
import { weaponParts } from './weapons';

const glb = readHeroGlb();

describe('legendary glow edges (WP4 step 5)', () => {
  it('builds every fx gear part on a hero bone, registered in GEAR', () => {
    for (const [id, build] of Object.entries(FX_GEAR)) {
      expect(GEAR[id], id).toBe(build);
      const k = new GearKit(glb.source);
      build(k);
      expect(k.parts.list.some((p) => p.slot === 'glow'), id).toBe(true);
      for (const p of k.parts.list) expect(glb.bones, `${id}: ${p.tag}`).toContain(p.tag);
    }
  });
  it('keeps each legendary look with its glow parts inside the gear budget', () => {
    for (const [id, def] of Object.entries(GEAR_FX)) {
      if (!def!.gear) continue;
      expect(FX_GEAR[def!.gear], def!.gear).toBeDefined();
      const look = heroLook({ [def!.slot]: { base: id } });
      const t = gearTriangles(gearGeometry(glb.source, glb.bones, [...look.gear, def!.gear].sort()));
      expect(t.matte + t.metal + t.glow, id).toBeLessThanOrEqual(GEAR_BUDGET.triangles);
      expect(t.glow, id).toBeLessThanOrEqual(GEAR_BUDGET.glow);
    }
  });
  it('gives the weapons of the table a glow part (the edge that pulses)', () => {
    for (const [id, def] of Object.entries(GEAR_FX)) if (def!.glow === 'weapon') expect(weaponParts(id as never).some((p) => p.slot === 'glow'), id).toBe(true);
  });
});
