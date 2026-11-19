// M6 save format and its parser, without the sim (M6b: the boot and the cloud sync read saves before the
// game loads). `src/sim/save.ts` builds and restores sims from it.
import { isDifficulty, type DifficultyId } from '../data/difficulty';
import type { Drop } from './loot';
import type { Inventory } from './inventory';
import type { Equipment, StatContext } from './stats';

export const SAVE_VERSION = 1;

export interface SaveProfile { inventory: Inventory; equipment: Equipment; statContext: StatContext }
export interface SaveRun {
  /** Map name; a run only resumes on the map it was saved on. */
  abilities?: import('./abilities').Abilities;
  perks?: StatContext['perks'];
  content?: import('./runcontent').RunContent;
  map: string;
  index: number;
  /** Wave that starts next (phase pause) or -1 between encounters (phase travel). */
  wave: number;
  hp: number;
  x: number;
  z: number;
  facing: number;
  rng: number;
  nextId: number;
  itemId: number;
  lootWaves: number;
  kills: number;
  broken: number[];
  restSeen: boolean[];
  /** Ground loot, landed and still. */
  drops: Drop[];
  /** Side passage guards already defeated in this run (indexes into `level.guards`). */
  guardsDown?: number[];
}
export interface SaveV1 {
  v: 1;
  /** Save time in ms; the cloud sync compares it. */
  t: number;
  difficulty: DifficultyId;
  profile: SaveProfile;
  run: SaveRun | null;
  /** M6b: device class that wrote it (PC, Tablet, Handy), shown on the slot card. */
  dev?: string;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses stored JSON; null for anything unknown, newer or damaged. Never throws. */
export function parseSave(text: string | null): SaveV1 | null {
  try {
    if (!text) return null;
    const s: unknown = JSON.parse(text);
    if (!obj(s) || s.v !== SAVE_VERSION || !isDifficulty(s.difficulty) || !obj(s.profile)) return null;
    const p = s.profile;
    if (!obj(p.inventory) || !Array.isArray(p.inventory.bag) || !obj(p.equipment) || !obj(p.statContext)) return null;
    let run: SaveRun | null = null;
    if (s.run != null) {
      const r = s.run;
      if (!obj(r) || typeof r.map !== 'string' || !['index', 'wave', 'hp', 'x', 'z', 'facing', 'rng', 'nextId', 'itemId', 'lootWaves', 'kills'].every((k) => num(r[k]))
        || !Array.isArray(r.broken) || !Array.isArray(r.drops) || !Array.isArray(r.restSeen)) return null;
      run = r as unknown as SaveRun;
    }
    return { v: 1, t: num(s.t) ? s.t : 0, difficulty: s.difficulty, profile: p as unknown as SaveProfile, run, ...(typeof s.dev === 'string' ? { dev: s.dev.slice(0, 12) } : {}) };
  } catch {
    return null;
  }
}

