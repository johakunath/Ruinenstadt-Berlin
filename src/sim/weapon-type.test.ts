import { describe, expect, it } from 'vitest';
import { WEAPON } from '../data/combat';
import { ENEMIES, ENEMY_CLASSES, type EnemyClass, type EnemyKind } from '../data/enemies';
import { STRONG_AGAINST, type DamageType } from '../data/weapon-look';
import { strike, updateStatuses } from './combat';
import { spawnEnemy } from './enemies';
import { createSim } from './sim';
import type { Enemy, Sim } from './types';

/** One kind per class, plus the two-class Kabelghul. */
const OF: Record<EnemyClass, EnemyKind> = { untote: 'walker', maschinen: 'drone', pflanzen: 'wurzler', menschen: 'feldwebel', tiere: 'rat' };

function setup(types: DamageType[], kind: EnemyKind): { s: Sim; e: Enemy } {
  const s = createSim({ empty: true });
  s.stats.crit = 0;
  s.stats.elements = [];
  s.stats.types = types;
  const e = spawnEnemy(s, s.player.x + 2, s.player.z, kind);
  e.hp = e.maxHp = 1e6;
  // Elements and resistances stay out of it.
  e.def = { ...e.def, res: 'none', shield: undefined };
  return { s, e };
}

describe('weapon type against enemy class (WP4 D9)', () => {
  it('gives +40 % to each damage type against its classes and nothing else, never a malus', () => {
    for (const type of Object.keys(STRONG_AGAINST) as DamageType[]) {
      for (const [cls, kind] of Object.entries(OF) as Array<[EnemyClass, EnemyKind]>) {
        const { s, e } = setup([type], kind);
        const strong = STRONG_AGAINST[type].includes(cls);
        expect(strike(s, e, 100, { noproc: true }), `${type} vs ${cls}`).toBe(strong ? 100 * (1 + WEAPON.typeBonus) : 100);
        const hit = s.events.find((ev) => ev.type === 'hit');
        expect(hit && 'effective' in hit && hit.effective === true, `${type} vs ${cls} flag`).toBe(strong);
      }
    }
  });

  it('counts a two-class enemy once and a weapon with two types once', () => {
    expect(ENEMY_CLASSES.kabel).toEqual(['untote', 'maschinen']);
    const both = setup(['schnitt', 'wucht'], 'kabel');
    expect(strike(both.s, both.e, 100, { noproc: true })).toBe(140);
    const pick = setup(['wucht', 'stich'], 'feldwebel');
    expect(strike(pick.s, pick.e, 100, { noproc: true })).toBe(140);
  });

  it('applies to procs and powers through strike, not to burn ticks', () => {
    const burnOf = (types: DamageType[]): number => {
      const { s, e } = setup(types, 'walker');
      s.stats.elements = ['fire'];
      s.stats.elementChance = 1;
      strike(s, e, 100, {});
      const after = e.hp;
      for (let i = 0; i < 300; i++) updateStatuses(s);
      return after - e.hp;
    };
    // The blade cuts the Schlurfer harder, but its burn is the same as a spear's.
    expect(burnOf(['schnitt'])).toBeGreaterThan(0);
    expect(burnOf(['schnitt'])).toBeCloseTo(burnOf(['stich']), 6);
  });

  it('gives every enemy kind at least one class', () => {
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) expect(ENEMIES[kind].classes.length, kind).toBeGreaterThan(0);
  });
});
