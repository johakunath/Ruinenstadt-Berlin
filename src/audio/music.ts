// 2D CHS, MEL, startMusic/chord/stopMusic. No audio files.
import { Synth } from './sfx';
const CH = [[220,261.6,329.6],[174.6,220,261.6],[261.6,329.6,392],[196,246.9,293.7]];
export const CHS=[CH,[[196,233.1,293.7],[174.6,207.7,261.6],[155.6,196,233.1],[174.6,220,261.6]],[[261.6,329.6,392],[174.6,220,261.6],[196,246.9,293.7],[261.6,329.6,392]],[[146.8,174.6,220],[130.8,164.8,196],[110,130.8,164.8],[116.5,146.8,174.6]],[[220,277.2,329.6],[246.9,293.7,370],[196,246.9,293.7],[220,277.2,329.6]],[[110,138.6,164.8],[123.5,146.8,185],[98,123.5,146.8],[110,130.8,164.8]],[[130.8,155.6,196],[116.5,146.8,174.6],[103.8,130.8,155.6],[98,123.5,146.8]]];
export const MEL=[[440,523.3,587.3,659.3,784],[392,466.2,523.3,587.3,698.5],[392,440,523.3,587.3,659.3],[293.7,349.2,392,440,523.3],[440,493.9,554.4,659.3,740],[220,261.6,293.7,329.6,392],[261.6,311.1,349.2,392,466.2]];

export interface MusicState { district: number; fighting: boolean; enemies: number; boss: boolean; cyber: boolean }
export class Music {
  private voice: { gain: GainNode; filter: BiquadFilterNode; bus: GainNode; send: GainNode; synth: Synth; index: number; timer?: ReturnType<typeof setInterval> } | null = null;
  private state: MusicState = { district: 0, fighting: false, enemies: 0, boss: false, cyber: false };
  private intensity = 0;
  private tickTime = 0;
  constructor(private readonly synth: Synth) {}
  start(): void {
    if (this.voice) return;
    const { ctx, master, reverb } = this.synth;
    // Everything, including future scheduled pulses/melody, goes through these music-only buses.
    const bus = ctx.createGain(), send = ctx.createGain(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    bus.connect(master); send.connect(reverb);
    gain.gain.value = 0; gain.gain.linearRampToValueAtTime(.06, ctx.currentTime + 4);
    filter.type = 'lowpass'; filter.frequency.value = 650; filter.connect(gain); gain.connect(bus); gain.connect(send);
    this.voice = { gain, filter, bus, send, synth: new Synth(ctx, bus, send), index: 0 };
    this.chord();
    this.voice.timer = setInterval(() => this.chord(), 8000);
  }
  stop(): void {
    const v = this.voice;
    if (!v) return;
    clearInterval(v.timer);
    const t = this.synth.ctx.currentTime;
    // Silence scheduled notes too; do not let repeated toggle cycles accumulate audible chords.
    v.bus.disconnect(); v.send.disconnect();
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(0, t);
    this.voice = null;
  }
  tick(dt: number, state: MusicState): void {
    this.state = state;
    if ((this.tickTime -= dt) > 0) return;
    this.tickTime = .5;
    const target = state.fighting ? Math.min(1, state.enemies / 14 + (state.boss ? .5 : 0)) : 0;
    this.intensity += (target - this.intensity) * .25;
    this.voice?.filter.frequency.setTargetAtTime(420 + this.intensity * 800, this.synth.ctx.currentTime, .6);
  }
  chord(): void {
    const v = this.voice;
    if (!v) return;
    const { ctx } = this.synth, t = ctx.currentTime, state = this.state;
    const notes = (CHS[state.district] ?? CH)[v.index++ % 4]!;
    if (state.fighting && state.boss) for (let i = 0; i < 16; i++) {
      v.synth.tone(58, .18, 'sine', .22, 34, i * .5); v.synth.noise(.03, 7000, 1, .03, 'highpass', 0, i * .5 + .25);
    } else if (state.fighting && state.cyber) for (let i = 0; i < 16; i++) {
      v.synth.tone(52, .16, 'sine', .13, 32, i * .5);
      if (i % 2) v.synth.noise(.025, 8000, 1, .015, 'highpass', 0, i * .5 + .25);
    } else if (state.fighting && this.intensity > .35) for (let i = 0; i < 16; i++) v.synth.tone(49, .22, 'sine', .12 * this.intensity, 34, i * .5);
    notes.forEach(fr => [-5, 5].forEach(detune => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = fr / 2; o.detune.value = detune;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.1, t + 2.5); g.gain.linearRampToValueAtTime(0, t + 8.4);
      o.connect(g); g.connect(v.filter); o.start(t); o.stop(t + 8.6);
    }));
    for (let k = 0; k < 3; k++) if (Math.random() < .6) {
      const scale = MEL[state.district] ?? MEL[0]!, n = scale[Math.floor(Math.random() * scale.length)]!;
      const tt = t + 1 + k * 2.4 + Math.random(), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = n;
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.045, tt + .02); g.gain.exponentialRampToValueAtTime(.0001, tt + 1.8);
      o.connect(g); g.connect(v.gain); o.start(tt); o.stop(tt + 1.9);
    }
  }
}
