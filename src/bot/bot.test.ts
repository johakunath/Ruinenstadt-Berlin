import { describe, expect, it } from 'vitest';
import { runCampaign, SKILL_GOOD } from './bot';
import { koepenickLevel, mapLevelOf } from './run';
import { Bot } from './bot';
import { createSim, stepSim } from '../sim/sim';
import { inRoom } from '../sim/level';

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

  it('walks out of the Magendoktor from the corner by the bench (M18 bot run: it pushed into the wall behind it)', () => {
    const level = mapLevelOf('wedding');
    const room = level.encounters.find((e) => e.id === 'magendoktor')!.room!;
    const sim = createSim({ level, seed: 3, startAt: level.encounters.findIndex((e) => e.id === 'uferterrasse') });
    sim.enemies.length = 0;
    const p = sim.player;
    p.x = p.px = 104; p.z = p.pz = 51.6;
    expect(inRoom(room, p.x, p.z)).toBe(true);
    const bot = new Bot(sim, SKILL_GOOD, 3);
    for (let i = 0; i < 60 * 8; i++) { bot.manage(); stepSim(sim, bot.input()); }
    expect(inRoom(room, p.x, p.z)).toBe(false);
  }, 60_000);
});
