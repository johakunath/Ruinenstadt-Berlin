// Sound, generated with WebAudio: no audio files. Hits play on the exact sim step of the damage frame.
import type { HitWeight } from '../data/combat';

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.7;
  private lastGrowl = 0;

  /** Must be called from a user gesture (the Spielen button). */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, len);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.ambience();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private burst(freq: number, q: number, type: BiquadFilterType, gain: number, attack: number, decay: number, sweepTo?: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + decay + 0.05);
  }

  private tone(type: OscillatorType, from: number, to: number, gain: number, decay: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + decay);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }

  swing(weight: HitWeight): void {
    const heavy = weight === 'heavy';
    this.burst(heavy ? 500 : 800, 1.2, 'bandpass', heavy ? 0.28 : 0.2, 0.03, heavy ? 0.2 : 0.12, heavy ? 1600 : 2200);
  }

  /** Pipe on flesh: thump, crack and a short metallic ring, pitch varied per hit. */
  hit(weight: HitWeight, killed: boolean): void {
    const heavy = weight === 'heavy';
    const pitch = 0.92 + Math.random() * 0.16;
    this.tone('sine', (heavy ? 150 : 190) * pitch, 50, heavy ? 0.9 : 0.6, heavy ? 0.2 : 0.11);
    this.burst(heavy ? 1400 : 2200, 0.7, 'lowpass', heavy ? 0.7 : 0.5, 0.002, heavy ? 0.14 : 0.07);
    this.tone('triangle', 1180 * pitch, 1120 * pitch, heavy ? 0.16 : 0.1, heavy ? 0.28 : 0.14);
    this.tone('sine', 1890 * pitch, 1800 * pitch, heavy ? 0.1 : 0.06, heavy ? 0.2 : 0.1);
    if (killed) {
      this.burst(380, 0.8, 'lowpass', 0.6, 0.004, 0.25);
      this.tone('sawtooth', 110 * pitch, 45, 0.25, 0.3, 0.02);
    }
  }

  dodge(): void {
    this.burst(300, 0.9, 'bandpass', 0.22, 0.04, 0.2, 1400);
  }

  hurt(): void {
    this.tone('sine', 110, 40, 0.9, 0.25);
    this.burst(700, 0.6, 'lowpass', 0.5, 0.003, 0.16);
  }

  /** Zombie wind-up growl; rate limited so a pack does not drone. */
  growl(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastGrowl < 0.25) return;
    this.lastGrowl = now;
    const f = 70 + Math.random() * 40;
    this.tone('sawtooth', f, f * 1.5, 0.12, 0.45);
    this.burst(500, 3, 'bandpass', 0.1, 0.1, 0.3, 900);
  }

  death(): void {
    this.tone('sawtooth', 160, 35, 0.5, 1.1);
    this.burst(300, 0.6, 'lowpass', 0.5, 0.01, 0.8);
  }

  /** Night wind and fire crackle, very quiet. */
  private ambience(): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    wind.connect(lp).connect(g).connect(this.master);
    wind.start();
    lfo.start();
    const crackle = (): void => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (Math.random() < 0.7) this.burst(2500 + Math.random() * 3000, 2, 'bandpass', 0.03 + Math.random() * 0.05, 0.001, 0.03);
    };
    window.setInterval(crackle, 110);
  }
}
