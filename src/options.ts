// Start options from the URL and from the options menu (stored in localStorage).
//   ?profile=Qualität|Leistung   ?debug=hit,perf,flow   ?stress=40   ?seed=7
//   ?map=hof (gate 1 courtyard), tunnel (S3), xhain (M15), alex (M15 Alexanderplatz), mitte (M15 Mitte), charlottenburg (M16), wedding (M18), turm (M17 Fernsehturm finale), lager (walkable camp, M20)   ?mapscale=1.3 (stretch Köpenick)   ?at=4 (start at encounter 4)
//   ?map=tunnel&line=1 (a tunnel line, S3 default)
//   ?shadows=boxes (A/B test: map chunks cast no shadow, only caster boxes, instanced props and characters)
//   ?cut=off (no V1 B cutaway)   ?cut=4.3 (yard cut height in meters, look test)
import { PROFILES, type ProfileId } from './render/profile';
import type { MapId } from './ui/maps';
export type { MapId } from './ui/maps';

export interface Options {
  profile: ProfileId;
  debugHit: boolean;
  debugPerf: boolean;
  debugFlow: boolean;
  stress: number;
  seed: number;
  volume: number;
  /** Ton: all sound on or off; the volume stays (U3, 2D mute). */
  sound: boolean;
  music: boolean;
  rumble: boolean;
  /** Akkusparen (2D eco, playtest 2026-11-17: the tablet runs hot): 30 fps and at most 1× pixel ratio. */
  eco: boolean;
  /** Performance readout bottom left (options menu or ?debug=perf). */
  showPerf: boolean;
  /** Send anonymous run and performance telemetry (Optionen, default on). */
  telemetry: boolean;
  /** Auto-Angriff (2D `autoAtk`): swing when an enemy is in reach. Default off (2D: on for touch). */
  autoAttack: boolean;
  /** Schadenszahlen (2D `nums`): damage dealt, taken and healing as rising numbers. Default on. */
  damageNumbers: boolean;
  /** Skips the title screen (smoke test and screenshots). */
  autostart: boolean;
  /** M11d landmark reveal shot: on in normal play, off for debug starts and automated browsers unless ?reveal. */
  reveal: boolean;
  /** ?cam=distance,pitch: camera override for close-up art checks. */
  cam?: { distance: number; pitch: number };
  /** ?shadows=boxes: map chunk meshes cast no shadow (A/B test on the tablet; default off). */
  boxShadows: boolean;
  /** ?cut=off disables the V1 B cutaway; ?cut=<meters> overrides the Hinterhof cut height. */
  cut?: 'off' | number;
  /** Köpenick (default), the gate 1 courtyard, a tunnel, Xhain, Alexanderplatz, Mitte, Charlottenburg (M16), Wedding (M18) or the walkable camp (M20). */
  map: MapId;
  /** M20: tunnel line (0 = S3). */
  line: number;
  mapScale: number;
  /** Debug: start at this encounter. */
  startAt: number;
  /** Debug: ?spawn=rex,raptor,walker+flink puts these kinds next to the hero (no other spawns in the courtyard). */
  spawn: string[];
  /** Debug: ?tp=x,z beams the hero there at the start (coordinates from ?debug=perf); implies `god`. */
  tp: { x: number; z: number } | null;
  /** Debug: ?god (or ?tp) makes the hero take no damage. */
  god: boolean;
}

const MAPS: readonly MapId[] = ['koepenick', 'hof', 'tunnel', 'xhain', 'alex', 'mitte', 'charlottenburg', 'wedding', 'turm', 'lager'];
const KEY = 'ruinenstadt-berlin.options';
/** M20: session flag for the next page load: start straight into this (the camp's departure board). */
export const GO_KEY = 'ruinenstadt-berlin.go';
/** Session flag set before the in-run profile reload: the next page load resumes the checkpoint (U3). */
export const RESUME_KEY = 'ruinenstadt-berlin.resume';

interface Stored {
  profile?: ProfileId;
  /** Profile ids version: 2 since the three levels (2026-11-20). Before, `leistung` meant today's Ausgewogen. */
  pv?: number;
  volume?: number;
  sound?: boolean;
  music?: boolean;
  rumble?: boolean;
  eco?: boolean;
  showPerf?: boolean;
  telemetry?: boolean;
  autoAttack?: boolean;
  damageNumbers?: boolean;
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
    const s: Stored = { profile: o.profile, pv: 2, volume: o.volume, sound: o.sound, music: o.music, rumble: o.rumble, eco: o.eco, showPerf: o.showPerf, telemetry: o.telemetry, autoAttack: o.autoAttack, damageNumbers: o.damageNumbers };
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
  if (n.startsWith('a') || n.startsWith('b')) return 'ausgewogen';
  if (n.startsWith('l') || n.startsWith('p')) return 'leistung';
  return null;
}

/** A stored profile; a `leistung` saved before the three levels is today's Ausgewogen (Q1). */
export function storedProfile(s: { profile?: string; pv?: number }): ProfileId | null {
  if (!s.profile || !(s.profile in PROFILES)) return null;
  if (s.profile === 'leistung' && (s.pv ?? 1) < 2) return 'ausgewogen';
  return s.profile as ProfileId;
}

/** Phones and tablets start on Leistung (Johannes, 2026-11-20), everything else on Qualität. */
function defaultProfile(): ProfileId {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return !coarse && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'qualitaet' : 'leistung';
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
  const profile = parseProfile(q.get('profile')) ?? (storedProfile(stored) ?? defaultProfile());
  return {
    profile,
    debugHit: debug.includes('hit'),
    debugPerf: debug.includes('perf'),
    debugFlow: debug.includes('flow'),
    stress: Math.max(0, Math.min(200, Number(q.get('stress') ?? 0) || 0)),
    seed: Number(q.get('seed') ?? 0) || (Date.now() & 0xffff) + 1,
    volume: stored.volume ?? 0.7,
    sound: stored.sound ?? true,
    music: stored.music ?? true,
    rumble: stored.rumble ?? true,
    eco: stored.eco ?? false,
    showPerf: debug.includes('perf') || (stored.showPerf ?? false),
    telemetry: stored.telemetry ?? true,
    autoAttack: stored.autoAttack ?? false,
    damageNumbers: stored.damageNumbers ?? true,
    autostart: q.has('autostart'),
    reveal: q.has('reveal') || (!q.has('autostart') && !q.has('at') && !q.has('cam') && !navigator.webdriver),
    cam: parseCam(q.get('cam')),
    boxShadows: q.get('shadows') === 'boxes',
    cut: parseCut(q.get('cut')),
    map: MAPS.find((m) => m === q.get('map')) ?? 'koepenick',
    line: Math.max(0, Math.min(5, Number(q.get('line') ?? 0) || 0)),
    spawn: (q.get('spawn') ?? '').split(/[, ]/).filter(Boolean),
    mapScale: Math.max(0.6, Math.min(2.5, Number(q.get('mapscale') ?? 1) || 1)),
    startAt: Math.max(0, Number(q.get('at') ?? 0) || 0),
    tp: parseTp(q.get('tp')),
    god: q.has('god') || q.has('tp'),
  };
}

function parseTp(v: string | null): Options['tp'] {
  const [x, z] = (v ?? '').split(',').map(Number);
  return v && Number.isFinite(x) && Number.isFinite(z) ? { x: x!, z: z! } : null;
}

function parseCut(v: string | null): Options['cut'] {
  if (v === 'off') return 'off';
  const h = Number(v);
  return v !== null && v !== '' && Number.isFinite(h) && h >= 0 ? h : undefined;
}

/** Reloads with a changed profile (materials and render targets are built once at start). */
export function reloadWith(change: Partial<Pick<Options, 'profile' | 'map' | 'line'>>): void {
  const q = new URLSearchParams(location.search);
  if (change.profile) q.set('profile', PROFILES[change.profile].label);
  // M19/M15/M20: Köpenick, the tunnels, Xhain and the camp are separate page loads (the renderer builds one map).
  if (change.map) { if (change.map === 'koepenick') q.delete('map'); else q.set('map', change.map); q.delete('autostart'); q.delete('at'); q.delete('line'); }
  if (change.line) q.set('line', String(change.line));
  location.search = q.toString();
}
