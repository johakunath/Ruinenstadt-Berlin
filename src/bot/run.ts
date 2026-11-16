// Entry for tools/balance.mjs: builds the Köpenick level once and lets the bot play campaigns.
import type { DifficultyId } from '../data/difficulty';
import { koepenickMap } from '../data/koepenick';
import { generateLots, generateProps, mapLevel } from '../data/map';
import type { Level } from '../sim/level';
import { runCampaign, SKILL_DEFAULT, SKILL_GOOD, SKILL_WEAK, type BotSkill, type CampaignReport } from './bot';

export const SKILLS: Record<string, BotSkill> = { johannes: SKILL_DEFAULT, good: SKILL_GOOD, weak: SKILL_WEAK };

let cached: Level | null = null;
export function koepenickLevel(): Level {
  if (!cached) {
    const def = koepenickMap(1);
    const lots = generateLots(def);
    cached = mapLevel(def, lots, generateProps(def, lots));
  }
  return cached;
}

export interface BalanceArgs { runs: number; difficulty: DifficultyId; skill: BotSkill; seed: number; startAt?: number; until?: number }

export function balance(a: BalanceArgs, onRun?: (i: number, r: CampaignReport) => void): CampaignReport[] {
  const out: CampaignReport[] = [];
  for (let i = 0; i < a.runs; i++) {
    const r = runCampaign({ level: koepenickLevel(), seed: a.seed + i * 101, difficulty: a.difficulty, skill: a.skill, startAt: a.startAt, until: a.until });
    out.push(r);
    onRun?.(i, r);
  }
  return out;
}
