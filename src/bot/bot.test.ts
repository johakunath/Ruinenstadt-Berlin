import { describe, expect, it } from 'vitest';
import { runCampaign, SKILL_GOOD } from './bot';
import { koepenickLevel } from './run';

describe('balance bot (M14)', () => {
  it('walks to the first fight in Köpenick and wins it', () => {
    const r = runCampaign({ level: koepenickLevel(), seed: 3, skill: SKILL_GOOD, until: 0, maxTime: 600 });
    expect(r.encounters[0]!.time).toBeGreaterThan(0);
    expect(r.kills).toBeGreaterThanOrEqual(10);
  }, 60_000);

  it('crosses the Dahme by ferry: starting at the Müggelturm it reaches the fight on the other bank', () => {
    const r = runCampaign({ level: koepenickLevel(), seed: 5, skill: SKILL_GOOD, startAt: 8, until: 8, maxTime: 900, maxDeaths: 6 });
    expect(r.encounters[8]!.time + r.encounters[8]!.deaths).toBeGreaterThan(0);
  }, 120_000);
});
