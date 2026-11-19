import { describe, expect, it } from 'vitest';
import { FUNDE, FUNDE_TEILE, fundeAffixes, fundId } from './funde';

describe('Funde bonuses', () => {
  it('each Uhrwerkteil alternates +1 % Schaden and +5 Leben; a full district adds its bonus', () => {
    expect(fundeAffixes(undefined)).toEqual({});
    expect(fundeAffixes(['d0:t0', 'd0:t1', 'd0:k0'])).toEqual({ dmg: 1, hp: 5 });
    const all = Array.from({ length: FUNDE_TEILE }, (_, i) => fundId(0, 'teil', i));
    expect(fundeAffixes(all)).toEqual({ dmg: 3, hp: 15, [FUNDE[0]!.bonus.affix]: FUNDE[0]!.bonus.value });
  });
  it('every district has four short Kassetten', () => {
    for (const d of FUNDE) {
      expect(d.kassetten).toHaveLength(4);
      for (const k of d.kassetten) expect(k.text.length).toBeLessThan(110);
    }
  });
});
