// Start options from the URL and from the options menu (stored in localStorage).
//   ?profile=Qualität|Leistung   ?look=gemalt|comic|tusche   ?debug=hit,perf,flow   ?stress=40   ?seed=7
import { LOOKS, type LookId } from './render/looks';
import { PROFILES, type ProfileId } from './render/profile';

export interface Options {
  profile: ProfileId;
  look: LookId;
  debugHit: boolean;
  debugPerf: boolean;
  debugFlow: boolean;
  stress: number;
  seed: number;
  volume: number;
  rumble: boolean;
  /** Performance readout bottom left (options menu or ?debug=perf). */
  showPerf: boolean;
  /** Skips the title screen (smoke test and screenshots). */
  autostart: boolean;
  /** ?cam=distance,pitch: camera override for close-up art checks. */
  cam?: { distance: number; pitch: number };
}

const KEY = 'ruinenstadt-berlin.options';

interface Stored {
  profile?: ProfileId;
  look?: LookId;
  volume?: number;
  rumble?: boolean;
  showPerf?: boolean;
}

function readStored(): Stored {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Stored;
  } catch {
    return {};
  }
}

export function storeOptions(o: Options): void {
  try {
    const s: Stored = { profile: o.profile, look: o.look, volume: o.volume, rumble: o.rumble, showPerf: o.showPerf };
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode: options just do not persist.
  }
}

const norm = (s: string): string => s.toLowerCase().replace('ä', 'ae');

function parseProfile(v: string | null): ProfileId | null {
  if (!v) return null;
  const n = norm(v);
  if (n.startsWith('q')) return 'qualitaet';
  if (n.startsWith('l') || n.startsWith('p')) return 'leistung';
  return null;
}

function parseLook(v: string | null): LookId | null {
  if (!v) return null;
  const n = norm(v);
  const alias: Record<string, LookId> = { '1': 'gemalt', pbr: 'gemalt', '2': 'comic', toon: 'comic', '3': 'tusche', mix: 'tusche', mixed: 'tusche' };
  if (n in LOOKS) return n as LookId;
  return alias[n] ?? null;
}

/** Tablets and phones start on Leistung, everything else on Qualität. */
function defaultProfile(): ProfileId {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return coarse || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'leistung' : 'qualitaet';
}

function parseCam(v: string | null): { distance: number; pitch: number } | undefined {
  if (!v) return undefined;
  const [d, p] = v.split(',').map(Number);
  return d && d > 1 ? { distance: d, pitch: p && p > 5 ? p : 44 } : undefined;
}

export function readOptions(): Options {
  const q = new URLSearchParams(location.search);
  const stored = readStored();
  const debug = (q.get('debug') ?? '').split(',');
  const profile = parseProfile(q.get('profile')) ?? (stored.profile && stored.profile in PROFILES ? stored.profile : defaultProfile());
  const look = parseLook(q.get('look')) ?? (stored.look && stored.look in LOOKS ? stored.look : 'gemalt');
  return {
    profile,
    look,
    debugHit: debug.includes('hit'),
    debugPerf: debug.includes('perf'),
    debugFlow: debug.includes('flow'),
    stress: Math.max(0, Math.min(200, Number(q.get('stress') ?? 0) || 0)),
    seed: Number(q.get('seed') ?? 0) || (Date.now() & 0xffff) + 1,
    volume: stored.volume ?? 0.7,
    rumble: stored.rumble ?? true,
    showPerf: debug.includes('perf') || (stored.showPerf ?? false),
    autostart: q.has('autostart'),
    cam: parseCam(q.get('cam')),
  };
}

/** Reloads with a changed profile or look (materials and render targets are built once at start). */
export function reloadWith(change: Partial<Pick<Options, 'profile' | 'look'>>): void {
  const q = new URLSearchParams(location.search);
  if (change.profile) q.set('profile', PROFILES[change.profile].label);
  if (change.look) q.set('look', change.look);
  location.search = q.toString();
}
