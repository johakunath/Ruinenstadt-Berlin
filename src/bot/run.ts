// Entry for tools/balance.mjs: builds a district or tunnel level once and lets the bot play campaigns.
import type { DifficultyId } from '../data/difficulty';
import { koepenickMap } from '../data/koepenick';
import { xhainMap } from '../data/xhain';
import { mitteMap } from '../data/mitte';
import { alexMap } from '../data/alexanderplatz';
import { charlottenburgMap } from '../data/charlottenburg';
import { weddingMap } from '../data/wedding';
import { tunnelMap } from '../data/tunnel';
import { generateLots, generateProps, mapLevel, type MapDef } from '../data/map';
import type { Level } from '../sim/level';
import { LINE_FREED } from '../data/lines';
import { runCampaign, SKILL_DEFAULT, SKILL_GOOD, SKILL_WEAK, type BotSkill, type CampaignReport } from './bot';

export const SKILLS: Record<string, BotSkill> = { johannes: SKILL_DEFAULT, good: SKILL_GOOD, weak: SKILL_WEAK };

export type DistrictKey = 'koepenick' | 'xhain' | 'alex' | 'mitte' | 'charlottenburg' | 'wedding';
/** B2: the tunnel of line k (S3 0, U8 1, U2 2, U2 west 3). */
export type TunnelKey = 'tunnel0' | 'tunnel1' | 'tunnel2' | 'tunnel3';
export type MapKey = DistrictKey | TunnelKey;

const DEFS: Record<MapKey, () => MapDef> = {
  koepenick: () => koepenickMap(1), xhain: () => xhainMap(1), alex: () => alexMap(1), mitte: () => mitteMap(1), charlottenburg: () => charlottenburgMap(1), wedding: () => weddingMap(1),
  tunnel0: () => tunnelMap(0), tunnel1: () => tunnelMap(1), tunnel2: () => tunnelMap(2), tunnel3: () => tunnelMap(3),
};
/** Line of a tunnel key, -1 for a district. */
export const lineOf = (map: MapKey): number => (map.startsWith('tunnel') ? Number(map.slice(6)) : -1);

const cached = new Map<string, Level>();
export function mapLevelOf(map: MapKey = 'koepenick'): Level {
  let level = cached.get(map);
  if (!level) {
    const def = DEFS[map]();
    const lots = generateLots(def);
    level = mapLevel(def, lots, generateProps(def, lots));
    cached.set(map, level);
  }
  return level;
}
export const koepenickLevel = (): Level => mapLevelOf('koepenick');
/** What a won map adds to `camp.freed`: its district, or LINE_FREED + k for the tunnel of line k (as `main.ts`). */
const freedId = (map: MapKey): number => (lineOf(map) >= 0 ? LINE_FREED + lineOf(map) : mapLevelOf(map).district);

export interface BalanceArgs {
  map?: MapKey; runs: number; difficulty: DifficultyId; skill: BotSkill; seed: number; startAt?: number; until?: number;
  /** M18: start every run with the gear one hero earned through the districts before this one (`carryTo`), not fresh. */
  carry?: boolean;
}

/** The campaign order of the districts (the tunnels between them are not played). M18: all six districts. */
export const CHAIN: DistrictKey[] = ['koepenick', 'xhain', 'alex', 'mitte', 'charlottenburg', 'wedding'];
/**
 * B2 step 1: the whole game as a player walks it: each district, then the tunnel of its line to the
 * next (the camp opens with the S3). The network ends at Charlottenburg; Wedding follows it directly.
 */
export const CAMPAIGN: MapKey[] = ['koepenick', 'tunnel0', 'xhain', 'tunnel1', 'alex', 'tunnel2', 'mitte', 'tunnel3', 'charlottenburg', 'wedding'];

export type ChainArgs = Omit<BalanceArgs, 'map' | 'startAt' | 'until'> & {
  /** B2: play the tunnels (`CAMPAIGN`) instead of counting each line as cleared (`CHAIN`). */
  tunnels?: boolean;
};
const stepsOf = (a: ChainArgs): readonly MapKey[] => (a.tunnels ? CAMPAIGN : CHAIN);

type Profile = CampaignReport['profile'];
/** One map of a chain, played with the carried hero (a camp step first when it carries one). */
function chainStep(a: ChainArgs, d: number, seed: number, carry: Profile | undefined): CampaignReport {
  const map = stepsOf(a)[d]!;
  const r = runCampaign({ level: mapLevelOf(map), seed, difficulty: a.difficulty, skill: a.skill, carry, district: freedId(map) });
  // Without tunnels, count the line after a won district as cleared, so the camp opens after Köpenick (S3) as in the game.
  if (r.won && !a.tunnels) {
    const camp = r.profile.inventory.camp ??= { stations: {}, stash: [], freed: [] };
    if (!camp.freed.includes(LINE_FREED + d)) camp.freed.push(LINE_FREED + d);
  }
  return r;
}

/** Plays the maps in order with one hero: gear, Schrott and camp carry over; a lost map ends the chain. */
export function chain(a: ChainArgs, onMap?: (run: number, map: MapKey, r: CampaignReport) => void): CampaignReport[][] {
  const out: CampaignReport[][] = [];
  for (let i = 0; i < a.runs; i++) {
    const runs: CampaignReport[] = [];
    let carry: Profile | undefined;
    for (const [d, map] of stepsOf(a).entries()) {
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
export function carryTo(map: DistrictKey, a: ChainArgs, onMap?: (map: MapKey, r: CampaignReport) => void): Profile | undefined {
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
  const carry = a.carry && a.map && lineOf(a.map) < 0 ? carryTo(a.map as DistrictKey, a) : undefined;
  if (a.carry && !carry && a.map && a.map !== 'koepenick') throw new Error('carry: the chain before this district was lost');
  for (let i = 0; i < a.runs; i++) {
    const r = runCampaign({ level: mapLevelOf(a.map), seed: a.seed + i * 101, difficulty: a.difficulty, skill: a.skill, startAt: a.startAt, until: a.until, carry, district: freedId(a.map ?? 'koepenick') });
    out.push(r);
    onRun?.(i, r);
  }
  return out;
}
