// Entry for tools/balance.mjs: builds the Köpenick (or Xhain, M15) level once and lets the bot play campaigns.
import type { DifficultyId } from '../data/difficulty';
import { koepenickMap } from '../data/koepenick';
import { xhainMap } from '../data/xhain';
import { mitteMap } from '../data/mitte';
import { alexMap } from '../data/alexanderplatz';
import { generateLots, generateProps, mapLevel } from '../data/map';
import type { Level } from '../sim/level';
import { runCampaign, SKILL_DEFAULT, SKILL_GOOD, SKILL_WEAK, type BotSkill, type CampaignReport } from './bot';

export const SKILLS: Record<string, BotSkill> = { johannes: SKILL_DEFAULT, good: SKILL_GOOD, weak: SKILL_WEAK };

const cached = new Map<string, Level>();
export function mapLevelOf(map: 'koepenick' | 'xhain' | 'alex' | 'mitte' = 'koepenick'): Level {
  let level = cached.get(map);
  if (!level) {
    const def = map === 'xhain' ? xhainMap(1) : map === 'alex' ? alexMap(1) : map === 'mitte' ? mitteMap(1) : koepenickMap(1);
    const lots = generateLots(def);
    level = mapLevel(def, lots, generateProps(def, lots));
    cached.set(map, level);
  }
  return level;
}
export const koepenickLevel = (): Level => mapLevelOf('koepenick');

export interface BalanceArgs { map?: 'koepenick' | 'xhain' | 'alex' | 'mitte'; runs: number; difficulty: DifficultyId; skill: BotSkill; seed: number; startAt?: number; until?: number }

export function balance(a: BalanceArgs, onRun?: (i: number, r: CampaignReport) => void): CampaignReport[] {
  const out: CampaignReport[] = [];
  for (let i = 0; i < a.runs; i++) {
    const r = runCampaign({ level: mapLevelOf(a.map), seed: a.seed + i * 101, difficulty: a.difficulty, skill: a.skill, startAt: a.startAt, until: a.until });
    out.push(r);
    onRun?.(i, r);
  }
  return out;
}
