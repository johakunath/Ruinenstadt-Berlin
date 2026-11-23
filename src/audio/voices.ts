// S3 boss voices (WP5 step 4): short spoken lines from assets/voices/<kind>-<trigger>.ogg (tools/voices.mjs).
// A boss speaks when it first acts in earshot (start), at half life (rage) and on its signature special.
// One line at a time, at least VOICE_GAP s between two lines of the same boss; clips load when a boss spawns.
import type { EnemyKind } from '../data/enemies';
import type { SpecialKind } from '../sim/threats';
import type { SimEvent } from '../sim/types';

export type VoiceTrigger = 'start' | 'rage' | 'special';
export const VOICE_TRIGGERS: readonly VoiceTrigger[] = ['start', 'rage', 'special'];

/**
 * The special each boss names, and the phase it speaks on: `go` where the sim shows the same words as a
 * note („Antreten!“, „Alarm!“, „Nicht auf der Liste!“, „Gemeinde!“, „Fortissimo!“), else the wind-up as a warning.
 */
export const SIGNATURE: Partial<Record<EnemyKind, { kind: SpecialKind; phase: 'wind' | 'go' }>> = {
  feldwebel: { kind: 'summon', phase: 'go' }, hauptmann: { kind: 'summon', phase: 'go' }, waechter: { kind: 'barrage', phase: 'wind' },
  schaffner: { kind: 'charge', phase: 'wind' }, grenzer: { kind: 'summon', phase: 'go' }, brandmeister: { kind: 'molotov', phase: 'wind' },
  rattenmutter: { kind: 'summon', phase: 'go' }, spreehexe: { kind: 'roar', phase: 'wind' }, tuersteher: { kind: 'summon', phase: 'go' },
  dirigent: { kind: 'roar', phase: 'go' }, bassprediger: { kind: 'summon', phase: 'go' }, wachdrohne: { kind: 'volley', phase: 'wind' },
  wurzelmutter: { kind: 'roots', phase: 'wind' }, uhrwerkgross: { kind: 'key', phase: 'wind' }, volkskoloss: { kind: 'slabs', phase: 'wind' },
  weltzeituhr: { kind: 'hand', phase: 'wind' },
  // M17 Der Zeitwart: „Schlag zwölf!“ when he calls his adds; his rage line comes with the first gear hold (he has no rage).
  zeitwart: { kind: 'summon', phase: 'go' },
};

/** Seconds between two lines of one boss. */
export const VOICE_GAP = 4;
/** The start line is only said this long after the boss first acts in earshot (else it is dropped). */
export const START_WINDOW = 8;
/** Level of a line before the spatial falloff (the clips are normalized to about -15 LUFS). */
export const VOICE_GAIN = 0.8;

const files = import.meta.glob('../../assets/voices/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Clip URL by `<kind>-<trigger>`. */
export const VOICE_URL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.ogg'.length), url]),
);
export const voiceKey = (kind: EnemyKind, trigger: VoiceTrigger): string => `${kind}-${trigger}`;

interface BossMemory { first: number; last: number; said: Set<VoiceTrigger> }
export interface VoiceMemory { busyUntil: number; bosses: Map<number, BossMemory> }
export const voiceMemory = (): VoiceMemory => ({ busyUntil: -Infinity, bosses: new Map() });

/** The line an event asks for from a boss of this kind, given what it has said (pure). */
export function voiceTrigger(event: SimEvent, kind: EnemyKind, said: ReadonlySet<VoiceTrigger>): VoiceTrigger | null {
  // M17: Der Zeitwart says his rage line when he first steps into the movement (`gearHold`).
  if (event.type === 'bossRage' || event.type === 'gearHold') return said.has('rage') ? null : 'rage';
  if (event.type !== 'enemyWindup' && event.type !== 'enemySpecial') return null;
  if (!said.has('start')) return 'start';
  const s = SIGNATURE[kind];
  if (event.type === 'enemySpecial' && !said.has('special') && s && s.kind === event.kind && s.phase === event.phase) return 'special';
  return null;
}

/**
 * Picks the line boss `id` says now, or null: one line at a time, VOICE_GAP s per boss, start only within
 * START_WINDOW s of its first act, each trigger once (a line that could not play is tried again next time).
 * `ready` says whether a clip is loaded. Call markVoice when the line plays.
 */
export function pickVoice(mem: VoiceMemory, id: number, kind: EnemyKind, event: SimEvent, now: number, ready: (key: string) => boolean): VoiceTrigger | null {
  if (event.type !== 'bossRage' && event.type !== 'gearHold' && event.type !== 'enemyWindup' && event.type !== 'enemySpecial') return null;
  let b = mem.bosses.get(id);
  if (!b) mem.bosses.set(id, (b = { first: now, last: -Infinity, said: new Set() }));
  if (!b.said.has('start') && now - b.first > START_WINDOW) b.said.add('start');
  const t = voiceTrigger(event, kind, b.said);
  if (!t || !ready(voiceKey(kind, t)) || now < mem.busyUntil || now - b.last < VOICE_GAP) return null;
  return t;
}

export function markVoice(mem: VoiceMemory, id: number, trigger: VoiceTrigger, now: number, duration: number): void {
  const b = mem.bosses.get(id);
  if (!b) return;
  b.said.add(trigger);
  b.last = now;
  mem.busyUntil = now + duration;
}

/** Loads and plays the lines through `out` (the effects master, so the sound volume applies). */
export class BossVoices {
  private readonly mem = voiceMemory();
  private readonly clips = new Map<string, AudioBuffer | null>();
  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode) {}

  /** Starts loading a boss's clips (once); a clip that fails to load stays silent. */
  prepare(kind: EnemyKind): void {
    for (const t of VOICE_TRIGGERS) {
      const key = voiceKey(kind, t), url = VOICE_URL[key];
      if (!url || this.clips.has(key)) continue;
      this.clips.set(key, null);
      void fetch(url).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(buf => { this.clips.set(key, buf); }, () => {});
    }
  }

  /** `kind` is the boss that sent the event; `volume` and `pan` from spatialAudio. */
  onEvent(event: SimEvent, id: number, kind: EnemyKind, volume: number, pan: number): void {
    if (!SIGNATURE[kind]) return;
    this.prepare(kind);
    if (volume <= 0.02) return;
    const now = this.ctx.currentTime;
    const t = pickVoice(this.mem, id, kind, event, now, key => !!this.clips.get(key));
    if (!t) return;
    const buf = this.clips.get(voiceKey(kind, t))!;
    markVoice(this.mem, id, t, now, buf.duration);
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(), p = this.ctx.createStereoPanner();
    src.buffer = buf; g.gain.value = VOICE_GAIN * volume; p.pan.value = pan;
    src.connect(g).connect(p).connect(this.out);
    src.start(now);
  }
}
