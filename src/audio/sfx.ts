// Synth recipes ported unchanged from 2D js/audio.js (FX, BELL, CLINK, KNOCK).
type Modes = readonly (readonly [number, number, number])[];
export interface Layer {
  w: number; f: number; v: number; fe?: number; a?: number; s?: number; d?: number;
  p?: number; dl?: number; q?: number; nt?: number; am?: number; ams?: number;
  m?: Modes; du?: number; ar?: number; at?: number; vd?: number; vs?: number;
  lp?: number; lpe?: number; hp?: number;
}
const BELL: Modes=[[1,1,1],[2.76,.6,.5],[5.4,.3,.25]];
const CLINK: Modes=[[1,1,1],[1.47,.8,.7],[2.09,.6,.5],[2.56,.5,.3]];
const KNOCK: Modes=[[1,1,1],[2.4,.5,.6],[4.1,.3,.3]];
export const FX = {
 growlWalker:[{w:2,f:85,fe:125,a:.03,d:.3,v:.18},{w:3,f:450,fe:700,d:.25,q:3,v:.12}],
 growlRunner:[{w:2,f:260,fe:580,a:.015,d:.18,v:.16},{w:3,f:1700,fe:900,d:.2,q:3,v:.1}],
 growlBrute:[{w:2,f:62,fe:38,a:.04,s:.08,d:.4,v:.24},{w:3,f:220,fe:120,d:.4,v:.12}],
 growlCrow:[{w:2,f:980,fe:620,a:.01,d:.14,vd:.05,vs:40,v:.15},{w:3,f:2600,fe:1500,d:.12,q:3,v:.09}],
 growlRaptor:[{w:2,f:520,fe:1100,a:.02,d:.22,vd:.08,vs:26,v:.17},{w:3,f:2400,fe:1200,d:.2,q:3,v:.1}],
 growlSpitter:[{w:2,f:150,fe:240,a:.03,d:.3,vd:.1,vs:22,v:.16},{w:3,f:700,fe:1300,d:.28,q:4,v:.1}],
 roar:[{w:2,f:120,fe:42,a:.06,s:.3,d:.7,vd:.1,vs:14,v:.3},{w:3,f:300,fe:120,s:.2,d:.7,v:.2}],
 growlBoss:[{w:2,f:90,fe:45,a:.05,s:.12,d:.5,v:.25},{w:4,f:240,m:KNOCK,d:.35,v:.18}],
 swing:[{w:3,f:380,fe:1700,a:.05,s:.01,d:.09,q:1.6,v:.5}],
 heavy:[{w:3,f:220,fe:950,a:.07,s:.02,d:.16,q:1.4,v:.6},{w:2,f:95,fe:42,dl:.07,d:.22,v:.5}],
 sling:[{w:3,f:1800,fe:4200,a:.012,d:.07,q:2,v:.5},{w:4,f:430,m:[[1,1,1],[2.01,.6,.4]],d:.05,v:.25}],
 hit:[{w:3,nt:1,f:950,fe:240,d:.06,p:.8,v:.6},{w:2,f:160,fe:58,d:.09,v:.5},{w:3,f:3200,d:.012,q:.8,v:.2}],
 crit:[{w:3,nt:1,f:1300,fe:220,d:.08,p:1,v:.7},{w:2,f:130,fe:45,d:.14,v:.6},{w:4,f:1900,m:BELL,d:.22,v:.22}],
 kill:[{w:3,nt:1,f:1200,fe:110,d:.2,p:.6,v:.6},{w:2,f:120,fe:36,d:.24,v:.55},{w:3,f:2800,fe:1400,dl:.02,d:.06,q:.9,am:.8,ams:70,v:.2}],
 hurt:[{w:3,nt:1,f:520,fe:110,d:.14,p:.6,v:.55},{w:2,f:190,fe:70,s:.03,d:.2,vd:.06,vs:18,v:.45}],
 dash:[{w:3,f:400,fe:2200,a:.035,s:.03,d:.12,q:2,v:.45}],
 spit:[{w:2,f:280,fe:760,d:.11,vd:.1,vs:30,v:.3},{w:3,f:1800,fe:900,d:.07,q:4,v:.3}],
 boom:[{w:3,nt:1,f:420,fe:38,s:.06,d:.8,p:.8,v:.7},{w:2,f:72,fe:26,s:.06,d:.6,v:.6},{w:3,f:2600,fe:900,dl:.03,d:.3,q:.8,am:.9,ams:38,v:.2}],
 pop:[{w:3,nt:1,f:500,fe:70,s:.01,d:.2,p:.7,v:.6},{w:2,f:115,fe:40,d:.16,v:.45}],
 spin:[{w:3,f:600,fe:1700,a:.03,s:.12,d:.15,q:1.8,vd:.3,vs:11,v:.4}],
 wood:[{w:4,f:310,m:KNOCK,d:.07,v:.6},{w:3,f:2200,d:.035,q:.9,p:.5,v:.4}],
 crash:[{w:3,f:3600,fe:1500,d:.24,q:.8,p:.6,v:.5},{w:4,f:880,m:[[1,1,.6],[1.7,.8,.5],[2.9,.6,.4],[4.3,.4,.3]],d:.26,v:.35},{w:3,nt:1,f:600,fe:120,d:.12,v:.45}],
 zap:[{w:3,f:4200,fe:2600,d:.13,q:1,am:1,ams:92,v:.4},{w:2,f:2300,fe:500,d:.05,v:.12}],
 ignite:[{w:3,nt:1,f:280,fe:1300,a:.05,s:.04,d:.3,v:.45}],
 coin:[{w:4,f:2400,m:CLINK,d:.2,v:.22},{w:4,f:3050,m:CLINK,dl:.065,d:.24,v:.2}],
 ui:[{w:4,f:900,m:[[1,1,1],[2,.5,.3]],d:.04,v:.13},{w:3,f:2600,d:.008,q:.8,v:.05}],
 heal:[{w:2,f:520,fe:780,a:.05,s:.05,d:.28,v:.25},{w:4,f:1560,m:[[1,1,1],[1.5,.7,.5]],dl:.08,d:.35,v:.1}]} satisfies Record<string, readonly Layer[]>;

export const MELODIC_IDS = ['pick', 'lvl', 'horn', 'beat', 'legend', 'bell', 'win'] as const;
export type SfxId = keyof typeof FX | typeof MELODIC_IDS[number];
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
const range = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/** 2D fxRender: offline PCM generation, once per take, no live oscillators for impacts. */
export function renderEffect(layers: readonly Layer[], sampleRate: number): Float32Array {
  const len = (l: Layer): number => (l.dl || 0) + (l.a || .002) + (l.s || 0) + (l.d || .1) * (l.w === 4 ? 1.8 : 1.3);
  const n = Math.ceil(Math.max(...layers.map(len)) * sampleRate) + 1, out = new Float32Array(n), dt = range(.97, 1.03);
  for (const l of layers) {
    const a = l.a || .002, su = l.s || 0, de = l.d || .1, T = len(l) - (l.dl || 0), fe = l.fe || l.f, du = l.du || .5;
    const o = Math.floor((l.dl || 0) * sampleRate), q1 = 1 / (l.q || 1.3), N = Math.floor(T * sampleRate), tmp = new Float32Array(N);
    let ph = 0, lo = 0, bd = 0, lp = 0, hi = 0, prev = 0, peak = 1e-6;
    for (let i = 0; i < N; i++) {
      const t = i / sampleRate;
      let fr = l.f * Math.pow(fe / l.f, Math.min(1, t / (a + su + de))) * dt;
      if (l.ar && t > (l.at ?? 0)) fr *= l.ar;
      if (l.vd) fr *= 1 + l.vd * Math.sin(6.283 * (l.vs ?? 0) * t);
      let x: number;
      if (l.w === 4) {
        x = 0;
        for (const m of l.m ?? []) x += m[2] * Math.sin(6.283 * fr * m[0] * t) * Math.exp(-t * 5 / (de * m[1]));
      } else if (l.w === 3) {
        const f1 = 2 * Math.sin(3.1416 * Math.min(fr, sampleRate / 6.5) / sampleRate);
        lo += f1 * bd;
        const h = Math.random() * 2 - 1 - lo - q1 * bd;
        bd += f1 * h;
        x = l.nt ? lo : bd;
      } else {
        ph = (ph + fr / sampleRate) % 1;
        x = l.w === 0 ? (ph < du ? 1 : -1) : l.w === 1 ? 1 - 2 * ph : Math.sin(6.283 * ph);
      }
      if (l.lp != null) { const c = l.lp + ((l.lpe ?? l.lp) - l.lp) * t / T; lp += (x - lp) * c * c; x = lp; }
      if (l.hp) { hi = l.hp * (hi + x - prev); prev = x; x = hi; }
      if (l.am) x *= 1 - l.am * (.5 + .5 * Math.sin(6.283 * (l.ams ?? 0) * t));
      const e = (t < a ? t / a : t < a + su || l.w === 4 ? 1 : Math.exp(-5 * (t - a - su) / de)) * (1 + (l.p || 0) * Math.exp(-t * 50));
      x *= e;
      tmp[i] = x;
      if (Math.abs(x) > peak) peak = Math.abs(x);
    }
    for (let i = 0; i < N && o + i < n; i++) out[o + i] = out[o + i]! + tmp[i]! / peak * l.v;
  }
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i]! * 1.2) * Math.min(1, (n - i) / 200);
  return out;
}

/** Shared 2D noise/tone/mallet helpers. A separate instance/bus isolates music from effects. */
export class Synth {
  readonly noiseBuffer: AudioBuffer;
  constructor(readonly ctx: AudioContext, readonly master: GainNode, readonly reverb: GainNode) {
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', to = 0, delay = 0): void {
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuffer; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }
  tone(fr: number, dur: number, type: OscillatorType, gain: number, to = 0, delay = 0, lowpass = 0): void {
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(fr, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (lowpass ? .08 : .012));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    if (lowpass) {
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
      o.connect(f); f.connect(g); g.connect(this.reverb);
    } else o.connect(g);
    g.connect(this.master); o.start(t); o.stop(t + dur + .05);
  }
  mal(fr: number, dur: number, gain: number, delay = 0): void {
    const t = this.ctx.currentTime + delay;
    for (const [m, gn, dc] of [[1, 1, 1], [2, .3, .5], [4.2, .1, .15]] as const) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), end = t + dur * dc * 1.7;
      o.frequency.value = fr * m; g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * gn, t + .006); g.gain.exponentialRampToValueAtTime(.0001, end);
      o.connect(g); g.connect(this.master); g.connect(this.reverb); o.start(t); o.stop(end + .05);
    }
  }
}

export class SoundEffects {
  private readonly buffers = new Map<keyof typeof FX, AudioBuffer[]>();
  private lastHit = -Infinity;
  private eco = false;
  constructor(readonly synth: Synth) {}
  setEco(eco: boolean): void { this.eco = eco; this.buffers.clear(); }
  /** 2D fxBuf: three takes; Leistung keeps one and bypasses the room send. */
  private fxBuf(id: keyof typeof FX): AudioBuffer[] {
    const cached = this.buffers.get(id);
    if (cached) return cached;
    const ctx = this.synth.ctx;
    const takes = Array.from({ length: this.eco ? 1 : 3 }, () => {
      const pcm = renderEffect(FX[id], ctx.sampleRate), buffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      buffer.getChannelData(0).set(pcm);
      return buffer;
    });
    this.buffers.set(id, takes);
    return takes;
  }
  /** Stagger the pre-render work; cancelled when audio is disposed. */
  prewarm(): () => void {
    const ids = Object.keys(FX) as (keyof typeof FX)[];
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = (): void => {
      if (i < ids.length) { this.fxBuf(ids[i++]!); timer = setTimeout(next, 40); }
    };
    timer = setTimeout(next, 300);
    return () => clearTimeout(timer);
  }
  play(id: SfxId, rarity = 0, pan = 0, volume = 1): void {
    const { ctx, master, reverb } = this.synth;
    if (['hit', 'crit', 'pop', 'wood', 'zap', 'ignite'].includes(id)) {
      if (ctx.currentTime - this.lastHit < .045) return;
      this.lastHit = ctx.currentTime;
    }
    if (id in FX) {
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = pick(this.fxBuf(id as keyof typeof FX)); s.playbackRate.value = range(.94, 1.06); g.gain.value = volume;
      let node: AudioNode = g;
      if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); node = p; }
      s.connect(g); node.connect(master); if (!this.eco) node.connect(reverb); s.start();
      return;
    }
    const { synth: s } = this;
    switch (id) {
      case 'pick':
        if (rarity === 3) [523, 659, 784, 1047].forEach((f, i) => s.mal(f, .3, .14, i * .08));
        else { const b = [440, 520, 660][rarity] ?? 440; s.mal(b, .1, .14); if (rarity >= 1) s.mal(b * 1.5, .14, .11, .07); }
        break;
      case 'lvl': [392, 494, 587, 784].forEach((f, i) => s.mal(f, .32, .12, i * .07)); break;
      case 'horn': s.tone(98, 1.5, 'sawtooth', .16, 92, 0, 520); s.tone(147, 1.5, 'sawtooth', .08, 139, 0, 700); break;
      case 'beat': s.tone(55, .12, 'sine', .35, 40); s.tone(50, .12, 'sine', .25, 36, .16); break;
      case 'legend': [523, 659, 784, 1047, 1319].forEach((f, i) => s.mal(f, .6, .1, i * .09)); s.noise(.6, 4000, 1, .08, 'highpass'); break;
      case 'bell': s.mal(1320, .25, .08); s.mal(1760, .3, .06, .08); break;
      case 'win': [262, 330, 392, 523, 659].forEach((f, i) => s.mal(f, .5, .12, i * .12)); break;
    }
  }
}
