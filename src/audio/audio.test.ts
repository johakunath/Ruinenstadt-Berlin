import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';
import { FX, MELODIC_IDS, renderEffect, SoundEffects, Synth } from './sfx';
import { Music } from './music';
import type { SimEvent } from '../sim/types';

// Minimal WebAudio graph fake: verify routing/lifecycle without pretending to hear the output.
function audioContext(): AudioContext {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const node = () => {
    const n = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: param(), frequency: param(), Q: param(), detune: param(), playbackRate: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), pan: param() };
    n.connect.mockImplementation(() => n);
    return n;
  };
  return {
    currentTime: 0, sampleRate: 8000, state: 'running', destination: node(),
    createGain: vi.fn(node), createBiquadFilter: vi.fn(node), createOscillator: vi.fn(node), createBufferSource: vi.fn(node),
    createDynamicsCompressor: vi.fn(node), createConvolver: vi.fn(node), createStereoPanner: vi.fn(node),
    createBuffer: vi.fn((channels: number, length: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { getChannelData: (c: number) => data[c], length };
    }), resume: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()),
  } as unknown as AudioContext;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('2D audio port', () => {
  it.each(Object.keys(FX) as (keyof typeof FX)[])('renders %s to finite non-silent bounded PCM', id => {
    const data = renderEffect(FX[id], 44100);
    expect(data.length).toBeGreaterThan(100);
    expect(data.every(Number.isFinite)).toBe(true);
    expect(data.some(n => Math.abs(n) > .01)).toBe(true);
    expect(data.every(n => Math.abs(n) <= 1)).toBe(true);
    expect(Math.abs(data[data.length - 1]!)).toBeLessThan(.01);
  });

  it('renders all exported effects and melodic cues; caches three takes or one on Leistung', () => {
    const ctx = audioContext(), master = ctx.createGain(), send = ctx.createGain();
    const effects = new SoundEffects(new Synth(ctx, master, send));
    const spy = vi.mocked(ctx.createBuffer);
    spy.mockClear();
    effects.play('swing'); expect(spy).toHaveBeenCalledTimes(3);
    effects.play('swing'); expect(spy).toHaveBeenCalledTimes(3);
    effects.setEco(true); effects.play('swing'); expect(spy).toHaveBeenCalledTimes(4);
    for (const id of [...Object.keys(FX), ...MELODIC_IDS] as Parameters<SoundEffects['play']>[0][]) expect(() => effects.play(id)).not.toThrow();
    expect(() => effects.play('pick', 3)).not.toThrow();
  });

  it('maps each sound-bearing event without moving its timing', () => {
    const audio = new GameAudio(), play = vi.spyOn(audio, 'play').mockImplementation(() => {}), growl = vi.spyOn(audio, 'growl');
    const hit = { type: 'hit', id: 1, x: 0, z: 0, dx: 1, dz: 0, weight: 'light', killed: true, damage: 1 } as const;
    const cases: [SimEvent, string[]][] = [
      [{ type: 'swing', attack: 'light1', weight: 'light' }, ['swing']],
      [{ type: 'swing', attack: 'light3', weight: 'heavy' }, ['heavy']],
      [hit, ['hit', 'kill']], [{ ...hit, critical: true }, ['crit', 'kill']], [{ ...hit, killed: false }, ['hit']],
      [{ type: 'dodge' }, ['dash']],
      [{ type: 'playerHit', x: 0, z: 0, dx: 1, dz: 0, damage: 1, hp: 99, by: '' }, ['hurt']],
      [{ type: 'encounterStart', index: 0, hp: 100 }, ['horn']], [{ type: 'waveStart', index: 0, wave: 0, waves: 1 }, ['horn']],
      [{ type: 'encounterClear', index: 0, heal: 30 }, ['bell', 'heal']], [{ type: 'encounterClear', index: 0, heal: 0 }, ['bell']],
      [{ type: 'zoneClear', zone: 0 }, ['bell']], [{ type: 'victory' }, ['win']],
    ];
    for (const [event, expected] of cases) { play.mockClear(); audio.onEvent(event); expect(play.mock.calls.map(c => c[0])).toEqual(expected); }
    audio.onEvent({ type: 'enemyWindup', id: 1 }); expect(growl).toHaveBeenCalledOnce();
    play.mockClear(); audio.onEvent({ type: 'playerDie' }); expect(play).not.toHaveBeenCalled(); // 2D die() is silent.
  });

  it('stops scheduled music through its own buses and restarts once', () => {
    vi.useFakeTimers();
    const ctx = audioContext(), synth = new Synth(ctx, ctx.createGain(), ctx.createGain()), music = new Music(synth);
    const disconnect = vi.spyOn(synth.master, 'disconnect');
    music.start(); music.start(); expect(vi.getTimerCount()).toBe(1);
    music.tick(.5, { district: 0, enemies: 20, fighting: true, boss: true, cyber: false });
    vi.advanceTimersByTime(8000);
    music.stop(); expect(vi.getTimerCount()).toBe(0);
    expect(disconnect).not.toHaveBeenCalled(); // Effects bus stays connected.
    music.start(); expect(vi.getTimerCount()).toBe(1); music.stop();
  });

  it('keeps mute, music toggles, start and dispose independent', () => {
    vi.useFakeTimers();
    const ctx = audioContext();
    vi.stubGlobal('window', { AudioContext: function () { return ctx; } });
    const musicStart = vi.spyOn(Music.prototype, 'start'), musicStop = vi.spyOn(Music.prototype, 'stop');
    const effectsPlay = vi.spyOn(SoundEffects.prototype, 'play');
    const audio = new GameAudio();
    audio.setMusic(false); audio.setEco(true); audio.start();
    expect(musicStart).not.toHaveBeenCalled();
    audio.play('swing'); expect(effectsPlay).toHaveBeenCalledOnce();
    audio.setMusic(true); expect(musicStart).toHaveBeenCalledOnce();
    audio.setVolume(0); expect(musicStop).toHaveBeenCalled();
    audio.play('swing'); expect(effectsPlay).toHaveBeenCalledOnce();
    audio.setVolume(.5); expect(musicStart).toHaveBeenCalledTimes(2);
    audio.start(); expect(ctx.resume).toHaveBeenCalledTimes(2);
    audio.dispose(); expect(ctx.close).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});

it('attenuates distant enemy cues and keeps stereo pan bounded', async()=>{
  const {spatialAudio}=await import('./audio');
  expect(spatialAudio(0,0)).toEqual({volume:1,pan:0});
  expect(spatialAudio(8,0).volume).toBeCloseTo((1-8/(650/30))**2);
  expect(spatialAudio(650/30,0).volume).toBe(0);
  expect(spatialAudio(50,0)).toEqual({volume:0,pan:.6});
  expect(spatialAudio(-8,0).pan).toBeLessThan(0);
});

it('beats under 30 % life every 0.9 s (2D heartbeat)', async()=>{
  const {heartbeat}=await import('./audio');
  expect(heartbeat(0,.1,.5).beat).toBe(false);
  let t=0,n=0;
  for(let i=0;i<180;i++){const h=heartbeat(t,1/60,.2);t=h.timer;if(h.beat)n++;}
  expect(n).toBe(4);
});

describe('S3 boss voices', async () => {
  const { pickVoice, markVoice, voiceMemory, voiceTrigger, SIGNATURE, VOICE_URL, VOICE_TRIGGERS, VOICE_GAP, START_WINDOW } = await import('./voices');
  const wind = (kind: string, id = 1): SimEvent => ({ type: 'enemySpecial', id, kind: kind as never, phase: 'wind', x: 0, z: 0 });
  const go = (kind: string, id = 1): SimEvent => ({ type: 'enemySpecial', id, kind: kind as never, phase: 'go', x: 0, z: 0 });
  const windup = (id = 1): SimEvent => ({ type: 'enemyWindup', id });
  const rage = (id = 1): SimEvent => ({ type: 'bossRage', id, name: '' });
  const ready = () => true;

  it('has all three clips for every boss with a signature special, and no stray clips', () => {
    const kinds = Object.keys(SIGNATURE);
    expect(kinds.length).toBe(17); // M17: Der Zeitwart
    expect(Object.keys(VOICE_URL).sort()).toEqual(kinds.flatMap(k => VOICE_TRIGGERS.map(t => `${k}-${t}`)).sort());
  });

  it('asks for start on the first act, then the signature special in its phase, rage once', () => {
    expect(voiceTrigger(windup(), 'tuersteher', new Set())).toBe('start');
    expect(voiceTrigger(wind('summon'), 'tuersteher', new Set())).toBe('start');
    const said = new Set(['start'] as const);
    expect(voiceTrigger(wind('summon'), 'tuersteher', said)).toBeNull(); // Spoken with the note on `go`.
    expect(voiceTrigger(go('summon'), 'tuersteher', said)).toBe('special');
    expect(voiceTrigger(go('shove'), 'tuersteher', said)).toBeNull();
    expect(voiceTrigger(wind('charge'), 'schaffner', said)).toBe('special');
    expect(voiceTrigger(rage(), 'tuersteher', said)).toBe('rage');
    expect(voiceTrigger(rage(), 'tuersteher', new Set(['start', 'rage'] as const))).toBeNull();
    expect(voiceTrigger({ type: 'spawn', id: 1 }, 'tuersteher', new Set())).toBeNull();
  });

  it('keeps 4 s per boss, one line at a time, each trigger once', () => {
    const m = voiceMemory();
    expect(pickVoice(m, 1, 'grenzer', windup(), 0, ready)).toBe('start'); markVoice(m, 1, 'start', 0, 1.5);
    expect(pickVoice(m, 1, 'grenzer', go('summon'), 2, ready)).toBeNull(); // Under VOICE_GAP.
    expect(pickVoice(m, 2, 'tuersteher', windup(2), 1, ready)).toBeNull(); // Another boss still speaking.
    expect(pickVoice(m, 2, 'tuersteher', windup(2), 1.6, ready)).toBe('start'); markVoice(m, 2, 'start', 1.6, 1.4);
    expect(pickVoice(m, 1, 'grenzer', go('summon'), VOICE_GAP, ready)).toBe('special'); markVoice(m, 1, 'special', VOICE_GAP, 1);
    expect(pickVoice(m, 1, 'grenzer', go('summon'), 20, ready)).toBeNull(); // Said once.
    expect(pickVoice(m, 1, 'grenzer', windup(), 20, ready)).toBeNull();
    expect(pickVoice(m, 1, 'grenzer', rage(), 21, ready)).toBe('rage');
  });

  it('retries a line that could not play; drops a late start; skips clips not loaded', () => {
    const m = voiceMemory();
    expect(pickVoice(m, 1, 'dirigent', windup(), 0, () => false)).toBeNull(); // Clip still loading.
    expect(pickVoice(m, 1, 'dirigent', windup(), START_WINDOW + 0.1, ready)).toBeNull(); // Start too late now.
    expect(pickVoice(m, 1, 'dirigent', go('roar'), START_WINDOW + 0.2, ready)).toBe('special');
    expect(pickVoice(m, 3, 'feldwebel', { type: 'spawn', id: 3 }, 0, ready)).toBeNull();
    expect(pickVoice(m, 3, 'feldwebel', windup(3), 30, ready)).toBe('start'); // The window opens at the first act, not the spawn.
  });
});
