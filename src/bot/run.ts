// Entry for tools/balance.mjs: builds the Köpenick (or Xhain, M15) level once and lets the bot play campaigns.
import type { DifficultyId } from '../data/difficulty';
import { koepenickMap } from '../data/koepenick';
import { xhainMap } from '../data/xhain';
import { mitteMap } from '../data/mitte';
import { alexMap } from '../data/alexanderplatz';
import { charlottenburgMap } from '../data/charlottenburg';
import { generateLots, generateProps, mapLevel } from '../data/map';
import type { Level } from '../sim/level';
import { LINE_FREED } from '../data/lines';
import { runCampaign, SKILL_DEFAULT, SKILL_GOOD, SKILL_WEAK, type BotSkill, type CampaignReport } from './bot';

export const SKILLS: Record<string, BotSkill> = { johannes: SKILL_DEFAULT, good: SKILL_GOOD, weak: SKILL_WEAK };

const cached = new Map<string, Level>();
export function mapLevelOf(map: MapKey | 'charlottenburg' = 'koepenick'): Level {
  let level = cached.get(map);
  if (!level) {
    const def = map === 'xhain' ? xhainMap(1) : map === 'alex' ? alexMap(1) : map === 'mitte' ? mitteMap(1) : map === 'charlottenburg' ? charlottenburgMap(1) : koepenickMap(1);
    const lots = generateLots(def);
    level = mapLevel(def, lots, generateProps(def, lots));
    cached.set(map, level);
  }
  return level;
}
export const koepenickLevel = (): Level => mapLevelOf('koepenick');

export interface BalanceArgs { map?: MapKey | 'charlottenburg'; runs: number; difficulty: DifficultyId; skill: BotSkill; seed: number; startAt?: number; until?: number }

export type MapKey = 'koepenick' | 'xhain' | 'alex' | 'mitte';
/** The campaign order of the districts (the tunnels between them are not played). */
export const CHAIN: MapKey[] = ['koepenick', 'xhain', 'alex', 'mitte'];

/** Plays the districts in order with one hero: gear, Schrott and camp carry over; a lost district ends the chain. */
export function chain(a: Omit<BalanceArgs, 'map' | 'startAt' | 'until'>, onMap?: (run: number, map: MapKey, r: CampaignReport) => void): CampaignReport[][] {
  const out: CampaignReport[][] = [];
  for (let i = 0; i < a.runs; i++) {
    const runs: CampaignReport[] = [];
    let carry: CampaignReport['profile'] | undefined;
    for (const [d, map] of CHAIN.entries()) {
      const r = runCampaign({ level: mapLevelOf(map), seed: a.seed + i * 101 + d * 7, difficulty: a.difficulty, skill: a.skill, carry, district: mapLevelOf(map).district });
      runs.push(r);
      onMap?.(i, map, r);
      if (!r.won) break;
      carry = r.profile;
      // The tunnels are not played: count the line after a won district as cleared, so the camp opens after Köpenick (S3) as in the game.
      const camp = carry.inventory.camp ??= { stations: {}, stash: [], freed: [] };
      if (!camp.freed.includes(LINE_FREED + d)) camp.freed.push(LINE_FREED + d);
    }
    out.push(runs);
  }
  return out;
}

export function balance(a: BalanceArgs, onRun?: (i: number, r: CampaignReport) => void): CampaignReport[] {
  const out: CampaignReport[] = [];
  for (let i = 0; i < a.runs; i++) {
    const r = runCampaign({ level: mapLevelOf(a.map), seed: a.seed + i * 101, difficulty: a.difficulty, skill: a.skill, startAt: a.startAt, until: a.until });
    out.push(r);
    onRun?.(i, r);
  }
  return out;
}
