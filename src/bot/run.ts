// Entry for tools/balance.mjs: builds the Köpenick (or Xhain, M15) level once and lets the bot play campaigns.
import type { DifficultyId } from '../data/difficulty';
import { koepenickMap } from '../data/koepenick';
import { xhainMap } from '../data/xhain';
import { mitteMap } from '../data/mitte';
import { alexMap } from '../data/alexanderplatz';
import { charlottenburgMap } from '../data/charlottenburg';
import { weddingMap } from '../data/wedding';
import { generateLots, generateProps, mapLevel } from '../data/map';
import type { Level } from '../sim/level';
import { LINE_FREED } from '../data/lines';
import { runCampaign, SKILL_DEFAULT, SKILL_GOOD, SKILL_WEAK, type BotSkill, type CampaignReport } from './bot';

export const SKILLS: Record<string, BotSkill> = { johannes: SKILL_DEFAULT, good: SKILL_GOOD, weak: SKILL_WEAK };

const cached = new Map<string, Level>();
export function mapLevelOf(map: MapKey = 'koepenick'): Level {
  let level = cached.get(map);
  if (!level) {
    const def = map === 'xhain' ? xhainMap(1) : map === 'alex' ? alexMap(1) : map === 'mitte' ? mitteMap(1) : map === 'charlottenburg' ? charlottenburgMap(1) : map === 'wedding' ? weddingMap(1) : koepenickMap(1);
    const lots = generateLots(def);
    level = mapLevel(def, lots, generateProps(def, lots));
    cached.set(map, level);
  }
  return level;
}
export const koepenickLevel = (): Level => mapLevelOf('koepenick');

export interface BalanceArgs {
  map?: MapKey; runs: number; difficulty: DifficultyId; skill: BotSkill; seed: number; startAt?: number; until?: number;
  /** M18: start every run with the gear one hero earned through the districts before this one (`carryTo`), not fresh. */
  carry?: boolean;
}

export type MapKey = 'koepenick' | 'xhain' | 'alex' | 'mitte' | 'charlottenburg' | 'wedding';
/** The campaign order of the districts (the tunnels between them are not played). M18: all six districts. */
export const CHAIN: MapKey[] = ['koepenick', 'xhain', 'alex', 'mitte', 'charlottenburg', 'wedding'];

type Profile = CampaignReport['profile'];
/** One district of a chain: plays it with the carried hero; on a win the line after it counts as cleared. */
function chainStep(a: Omit<BalanceArgs, 'map' | 'startAt' | 'until'>, d: number, seed: number, carry: Profile | undefined): CampaignReport {
  const map = CHAIN[d]!;
  const r = runCampaign({ level: mapLevelOf(map), seed, difficulty: a.difficulty, skill: a.skill, carry, district: mapLevelOf(map).district });
  // The tunnels are not played: count the line after a won district as cleared, so the camp opens after Köpenick (S3) as in the game.
  if (r.won) {
    const camp = r.profile.inventory.camp ??= { stations: {}, stash: [], freed: [] };
    if (!camp.freed.includes(LINE_FREED + d)) camp.freed.push(LINE_FREED + d);
  }
  return r;
}

/** Plays the districts in order with one hero: gear, Schrott and camp carry over; a lost district ends the chain. */
export function chain(a: Omit<BalanceArgs, 'map' | 'startAt' | 'until'>, onMap?: (run: number, map: MapKey, r: CampaignReport) => void): CampaignReport[][] {
  const out: CampaignReport[][] = [];
  for (let i = 0; i < a.runs; i++) {
    const runs: CampaignReport[] = [];
    let carry: Profile | undefined;
    for (const [d, map] of CHAIN.entries()) {
      const r = chainStep(a, d, a.seed + i * 101 + d * 7, carry);
      runs.push(r);
      onMap?.(i, map, r);
      if (!r.won) break;
      carry = r.profile;
    }
    out.push(runs);
  }
  return out;
}

/**
 * M18: the hero one chain brings to `map` (the districts before it, played once from `seed`); undefined for the first
 * district or when the chain is lost on the way. Fresh-gear runs say little about the later districts (a starter
 * blade cannot hurt a tier 40 Zecher).
 */
export function carryTo(map: MapKey, a: Omit<BalanceArgs, 'map' | 'startAt' | 'until'>, onMap?: (map: MapKey, r: CampaignReport) => void): Profile | undefined {
  let carry: Profile | undefined;
  for (let d = 0; d < CHAIN.indexOf(map); d++) {
    const r = chainStep(a, d, a.seed + d * 7, carry);
    onMap?.(CHAIN[d]!, r);
    if (!r.won) return undefined;
    carry = r.profile;
  }
  return carry;
}

export function balance(a: BalanceArgs, onRun?: (i: number, r: CampaignReport) => void): CampaignReport[] {
  const out: CampaignReport[] = [];
  const carry = a.carry && a.map ? carryTo(a.map, a) : undefined;
  if (a.carry && !carry && a.map && a.map !== 'koepenick') throw new Error('carry: the chain before this district was lost');
  for (let i = 0; i < a.runs; i++) {
    const r = runCampaign({ level: mapLevelOf(a.map), seed: a.seed + i * 101, difficulty: a.difficulty, skill: a.skill, startAt: a.startAt, until: a.until, carry, district: mapLevelOf(a.map).district });
    out.push(r);
    onRun?.(i, r);
  }
  return out;
}
