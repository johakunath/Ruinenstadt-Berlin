// Start options from the URL and from the options menu (stored in localStorage).
//   ?profile=Qualität|Leistung   ?debug=hit,perf,flow   ?stress=40   ?seed=7
//   ?map=hof (gate 1 courtyard)   ?mapscale=1.3 (stretch Köpenick)   ?at=4 (start at encounter 4)
import { PROFILES, type ProfileId } from './render/profile';

export interface Options {
  profile: ProfileId;
  debugHit: boolean;
  debugPerf: boolean;
  debugFlow: boolean;
  stress: number;
  seed: number;
  volume: number;
  music: boolean;
  rumble: boolean;
  /** Performance readout bottom left (options menu or ?debug=perf). */
  showPerf: boolean;
  /** Skips the title screen (smoke test and screenshots). */
  autostart: boolean;
  /** ?cam=distance,pitch: camera override for close-up art checks. */
  cam?: { distance: number; pitch: number };
  /** Köpenick (default) or the gate 1 courtyard. */
  map: 'koepenick' | 'hof';
  mapScale: number;
  /** Debug: start at this encounter. */
  startAt: number;
}

const KEY = 'ruinenstadt-berlin.options';

interface Stored {
  profile?: ProfileId;
  volume?: number;
  music?: boolean;
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
    const s: Stored = { profile: o.profile, volume: o.volume, music: o.music, rumble: o.rumble, showPerf: o.showPerf };
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
  return {
    profile,
    debugHit: debug.includes('hit'),
    debugPerf: debug.includes('perf'),
    debugFlow: debug.includes('flow'),
    stress: Math.max(0, Math.min(200, Number(q.get('stress') ?? 0) || 0)),
    seed: Number(q.get('seed') ?? 0) || (Date.now() & 0xffff) + 1,
    volume: stored.volume ?? 0.7,
    music: stored.music ?? true,
    rumble: stored.rumble ?? true,
    showPerf: debug.includes('perf') || (stored.showPerf ?? false),
    autostart: q.has('autostart'),
    cam: parseCam(q.get('cam')),
    map: q.get('map') === 'hof' ? 'hof' : 'koepenick',
    mapScale: Math.max(0.6, Math.min(2.5, Number(q.get('mapscale') ?? 1) || 1)),
    startAt: Math.max(0, Number(q.get('at') ?? 0) || 0),
  };
}

/** Reloads with a changed profile (materials and render targets are built once at start). */
export function reloadWith(change: Partial<Pick<Options, 'profile'>>): void {
  const q = new URLSearchParams(location.search);
  if (change.profile) q.set('profile', PROFILES[change.profile].label);
  location.search = q.toString();
}
