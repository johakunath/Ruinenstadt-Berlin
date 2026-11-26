// Sound, generated with WebAudio; only the S3 boss lines are files (voices.ts). Hits play on the exact sim step of the damage frame.
import type { HitWeight } from '../data/combat';
import type { EnemyKind } from '../data/enemies';
import type { Sim, SimEvent } from '../sim/types';
import type { SpecialKind } from '../sim/threats';
import { SoundEffects, Synth, type SfxId } from './sfx';
import { Music, type MusicState } from './music';
import { BossVoices } from './voices';

/** Wind-up voice per kind (S2); other bosses growl, other bodies use the walker's. */
const VOICE: Partial<Record<EnemyKind, SfxId>> = {
  runner: 'growlRunner', brute: 'growlBrute', raptor: 'growlRaptor', kompso: 'growlRat', spitter: 'growlSpitter', crow: 'growlCrow', rat: 'growlRat',
  grenzer: 'growlGrenzer', brandmeister: 'growlBrand', rattenmutter: 'growlMutter', spreehexe: 'growlHexe',
  kabel: 'growlRunner', bass: 'growlBass', tuersteher: 'growlTuer', bassprediger: 'growlBass',
  // M15 Alexanderplatz: clockwork ticks and a steam hiss, a wooden creak, a seed pop, the big clock's chime.
  uhrwerk: 'growlUhr', uhrwerkgross: 'growlUhr', wurzler: 'growlWurz', wurzelmutter: 'growlWurz', kernspeier: 'growlKern', volkskoloss: 'growlKoloss', weltzeituhr: 'growlZeit',
  // WP5: the Schildträger grunts like a Brocken, the Heuler wails.
  schild: 'growlBrute', heuler: 'growlHowl',
  // M16: the Logenbrecher creaks, the Souffleur whispers, the dancers whirr.
  loge: 'creak', souffleur: 'whisper', scherbe: 'whirr',
};
/** M12c: specials with their own voice at the wind-up and the release (by special, then by kind). */
// WP5 (2D): the Zünder's fuse hisses ('zap'), the Heuler wails and the horn sounds when the others are driven on.
const WIND: Partial<Record<SpecialKind, SfxId>> = { leap: 'crackle', bass: 'growlBass', shove: 'growlTuer', grab: 'growlTuer', land: 'spin', fuse: 'zap', howl: 'growlHowl', pirouette: 'whirr', faust: 'creak', swap: 'shimmer', prism: 'prismRise' };
const GO: Partial<Record<SpecialKind, SfxId>> = { leap: 'dash', bass: 'thump', grab: 'dash', beat: 'tap', howl: 'horn', pirouette: 'dash', faust: 'crash' };

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.7;
  private lastGrowl = 0;
  private effects: SoundEffects | null = null;
  private music: Music | null = null;
  private musicEnabled = true;
  private eco = false;
  private room: GainNode | null = null;
  private cancelPrewarm: (() => void) | null = null;
  private voices: BossVoices | null = null;

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
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = .004; comp.release.value = .18;
    this.master.connect(comp).connect(this.ctx.destination);
    const send = this.ctx.createGain(), cv = this.ctx.createConvolver(), wet = this.ctx.createGain();
    const sr = this.ctx.sampleRate, n = Math.floor(sr * 1.6), ir = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const data = ir.getChannelData(c); let lo = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n; lo += ((Math.random() * 2 - 1) - lo) * (.5 * Math.pow(1 - t, 1.5) + .04);
        data[i] = lo * Math.pow(1 - t, 3) * Math.min(1, i / (sr * .006));
      }
    }
    cv.buffer = ir; wet.gain.value = .45;
    send.connect(cv); cv.connect(wet); wet.connect(this.master);
    this.room = send; send.gain.value = this.eco ? 0 : 1;
    const synth = new Synth(this.ctx, this.master, send);
    this.effects = new SoundEffects(synth); this.effects.setEco(this.eco);
    this.cancelPrewarm = this.effects.prewarm();
    this.music = new Music(synth);
    this.voices = new BossVoices(this.ctx, this.master);
    if (this.musicEnabled && this.volume > 0) this.music.start();
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, len);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.ambience();
    void this.ctx.resume();
  }

  setVolume(v: number): void {
    v = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    if (v === 0) this.music?.stop(); else if (this.musicEnabled) this.music?.start();
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

  private rotorGain: GainNode | null = null;
  /** M12c: one shared rotor whine for every drone, as loud as the nearest one (Infinity: silent). */
  rotors(dist: number): void {
    if (!this.ctx || !this.master) return;
    if (!this.rotorGain) {
      if (dist > 16) return;
      const g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
      g.gain.value = 0; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = .9;
      for (const hz of [196, 203]) { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.connect(f); o.start(); }
      f.connect(g); g.connect(this.master); this.rotorGain = g;
    }
    const v = dist < 16 ? .05 * (1 - dist / 16) ** 1.5 : 0;
    this.rotorGain.gain.setTargetAtTime(v, this.ctx.currentTime, .15);
  }

  setMusic(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled && this.volume > 0) this.music?.start(); else this.music?.stop();
  }

  setEco(eco: boolean): void {
    this.eco = eco;
    this.effects?.setEco(eco);
    if (this.room) this.room.gain.value = eco ? 0 : 1;
  }

  private beatT = 0;
  tick(dt: number, state: MusicState, lifeFrac = 1): void {
    this.music?.tick(dt, state);
    const h = heartbeat(this.beatT, dt, state.fighting ? lifeFrac : 1);
    this.beatT = h.timer;
    if (h.beat) this.play('beat');
  }
  play(id: SfxId, rarity = 0, pan = 0, volume = 1): void {
    if (this.volume > 0) this.effects?.play(id, rarity, pan, volume);
  }
  swing(weight: HitWeight): void { this.play(weight === 'heavy' ? 'heavy' : 'swing'); }
  hit(_weight: HitWeight, killed: boolean, critical = false): void { this.play(critical ? 'crit' : 'hit'); if (killed) this.play('kill'); }
  dodge(): void { this.play('dash'); }
  hurt(): void { this.play('hurt'); }

  /** Called exactly when the loop drains each damage-step event. */
  onEvent(event: SimEvent, sim?: Sim): void {
    let volume = 1, pan = 0;
    if (sim) {
      const source = 'x' in event ? event : 'id' in event ? sim.enemies.find(e=>e.id===event.id) : undefined;
      if(source) ({volume,pan}=spatialAudio(source.x-sim.player.x,source.z-sim.player.z));
      // S3: boss lines (spawn loads them; first act, rage and the signature special speak).
      if (this.voices && this.volume > 0 && (event.type === 'spawn' || event.type === 'enemyWindup' || event.type === 'enemySpecial' || event.type === 'bossRage' || event.type === 'gearHold')) {
        const boss = sim.enemies.find(e => e.id === event.id);
        if (boss?.def.boss) this.voices.onEvent(event, boss.id, boss.kind, volume, pan);
      }
    }
    // Out of earshot: no voices, and the hit throttle stays free for audible hits (2D returns early).
    if (sim && volume <= 0.02 && (event.type === 'hit' || event.type === 'dot' || event.type === 'bolt' || event.type === 'ignite' || event.type === 'impact' || event.type === 'shock')) return;
    switch (event.type) {
      case 'swing': if(sim?.stats.kind==='sling')this.play('sling');else this.swing(event.weight); break;
      case 'hit':
        // Procs and area ticks are quiet: one voice per element, the kill still sounds.
        if (event.quiet) { if (event.killed) this.play('kill', 0, pan, volume * 0.8); break; }
        if(sim){ this.play(event.critical?'crit':'hit',0,pan,volume);if(event.killed)this.play('kill',0,pan,volume); }else this.hit(event.weight, event.killed, event.critical); break;
      case 'dot': if (event.killed) this.play('kill', 0, pan, volume * 0.8); break;
      case 'shock': this.play('boom', 0, pan, volume * (event.kind === 'earth' ? 1 : 0.6)); break;
      case 'bolt': this.play('zap', 0, pan, volume * 0.7); break;
      case 'impact': this.play(event.kind === 'molotov' ? 'ignite' : 'pop', 0, pan, volume); if (event.kind === 'molotov') this.play('crash', 0, pan, volume * 0.7); break;
      case 'ignite': this.play('ignite', 0, pan, volume * 0.5); break;
      case 'abilityFire': if (event.id === 'molotow' || event.id === 'brand' || event.id === 'spiess') this.play('swing'); else if (event.id === 'nagel') this.play('sling'); break;
      case 'consumable': if (event.id === 'verband') this.play('heal'); break;
      case 'heal': if (event.source === 'trader') this.play('heal'); break;
      case 'secondWind': this.play('lvl'); break;
      case 'blessing': this.play('coin'); break;
      case 'hidden': case 'shrine': case 'fund': this.play('legend'); break;
      case 'trade': this.play('bell'); break;
      case 'buy': this.play('coin'); break;
      case 'streak': this.play('coin'); break;
      case 'runEvent': this.play(event.phase === 'done' ? 'win' : event.phase === 'lost' ? 'wood' : event.kind === 'ambush' || event.kind === 'horde' || event.kind === 'zone' ? 'horn' : 'bell'); break;
      case 'dodge': this.dodge(); break;
      case 'playerHit': this.hurt(); break;
      case 'playerDie': this.death(); break;
      case 'enemyWindup': {
        if(!sim){this.growl();break;}
        const e=sim.enemies.find(e=>e.id===event.id);
        if(!e||!this.ctx||volume<=0||this.ctx.currentTime-this.lastGrowl<.25)break;
        this.lastGrowl=this.ctx.currentTime;
        this.play(VOICE[e.kind]??(e.def.boss?'growlBoss':'growlWalker'),0,pan,volume);
        break;
      }
      // M12: specials announce themselves by type; marked zones land with a boom.
      case 'enemySpecial': {
        const k=event.kind;
        const who=sim?.enemies.find(e=>e.id===event.id)?.kind;
        // M12c: Bassprediger zap on the charge, the Dirigent's baton before the Fortissimo, the Wachdrohne's laser.
        if(event.phase==='wind'&&k==='charge'&&who==='bassprediger'){this.play('zap',0,pan,volume);break;}
        if(event.phase==='wind'&&k==='roar'&&who==='dirigent'){this.play('tap',0,pan,volume);break;}
        if(event.phase==='go'&&k==='volley'&&who==='wachdrohne'){this.play('laser',0,pan,volume);break;}
        // M16: the Souffleur whispers his cue, the Conférencier's drum roll and applause, the Ringvater's register bell.
        if(event.phase==='wind'&&k==='howl'&&who==='souffleur'){this.play('whisper',0,pan,volume);break;}
        if(event.phase==='wind'&&k==='summon'&&who==='conferencier'){this.play('drumroll',0,pan,volume);break;}
        if(event.phase==='go'&&k==='barrage'&&who==='conferencier'){this.play('applause',0,pan,volume);break;}
        if(event.phase==='go'&&k==='summon'&&who==='ringvater'){this.play('register',0,pan,volume);break;}
        if(event.phase==='wind'&&WIND[k]){this.play(WIND[k]!,0,pan,volume);break;}
        if(event.phase==='go'&&GO[k]){this.play(GO[k]!,0,pan,volume);if(k==='beat')this.play('thump',0,pan,volume*.5);break;}
        // M15: roots creak (2D 'wood'), the seed fan spits, the hour sectors and the hand ring the clock's bell, slabs grind.
        if(event.phase==='wind')this.play(k==='roar'?'roar':k==='pounce'?'growlRaptor':k==='dive'?'growlCrow':k==='spit'||k==='fan'||k==='seeds'?'growlSpitter':k==='summon'||k==='charge'||k==='lunge'?'horn':k==='slam'||k==='stomp'||k==='bossSlam'||k==='tail'?'growlBrute':k==='molotov'?'swing':k==='roots'||k==='rootRing'?'wood':k==='sectors'||k==='hand'?'growlZeit':k==='key'?'growlUhr':k==='slabs'||k==='ring'?'growlKoloss':'growlBoss',0,pan,volume);
        else if(k==='pounce'||k==='dive'||k==='lunge'||k==='charge')this.play('dash',0,pan,volume);
        else if(k==='volley')this.play('sling',0,pan,volume);
        else if(k==='roar')this.play('boom',0,pan,volume*.7);
        break;
      }
      case 'enemyShot': this.play('spit',0,pan,volume); break;
      case 'spotLock': this.play('lockBeep',0,pan,volume); break;
      case 'zoneHit':
        // M16: glass bursts chime (lower for a big body), the prism ray rings.
        if(event.kind==='shard'||event.kind==='prism'){const big=(sim?.enemies.find(e=>e.id===event.src)?.def.radius??0)>0.5;this.play(event.kind==='prism'||big?'glassLow':'glassChime',0,pan,volume*.8);break;}
        if(event.kind==='applause')break;
        this.play(event.kind==='flame'||event.kind==='bomb'?'ignite':event.kind==='acid'?'spit':event.kind==='root'?'wood':'boom',0,pan,volume*(event.r>2.5?1:.7)); if(event.kind==='bomb')this.play(event.r>2?'boom':'pop',0,pan,volume); break;
      case 'divaTier': this.play('curtain',0,pan,volume); this.play('glassLow',0,pan,volume); break;
      case 'bossRage': this.play('roar'); this.play('horn'); break;
      case 'ability': {
        const cues:Record<string,SfxId>={Kreissäge:'spin',Fechtsprung:'dash',Säbeltanz:'spin',Fallhammer:'boom',Gullydeckel:'wood',Abrissbirne:'boom',Nagelsturm:'sling',Brandsatz:'ignite',Sperrfeuer:'heavy',Spießrute:'heavy',Stabhochsprung:'dash',Standarte:'legend'};
        this.play(cues[event.name]??'spin');if(event.ultimate)this.play('legend');break;
      }
      case 'encounterStart': case 'waveStart': this.play('horn'); break;
      case 'encounterClear': this.play('bell'); if (event.heal > 0) this.play('heal'); break;
      case 'zoneClear': this.play('bell'); break;
      case 'restEnter': if (event.first) this.play('bell'); break;
      case 'victory': this.play('win'); break;
      case 'dropLand': if (event.rarity >= 1) this.play('coin'); break;
      case 'legendary': this.play('legend'); break;
      case 'pickup': this.play(event.what === 'heal' || event.what === 'food' ? 'heal' : event.what === 'material' ? 'coin' : 'pick', Math.max(0, event.rarity)); break;
      case 'scrap': break;
      case 'breakableHit': this.play('wood'); break;
      case 'breakableBreak': this.play('crash'); break;
      // M20 tunnel (2D sounds): the grating falls, the generator starts, the power comes.
      case 'gateOpen': this.play('crash'); this.play('boom', 0, 0, 0.5); break;
      case 'holdStart': this.play('zap'); break;
      case 'power': this.play('zap'); this.play('win'); break;
      // P25: the Türsteher's neon bars snap shut (the generator's electric cue).
      case 'barrier': if (event.phase === 'shut') this.play('zap', 0, pan, volume); break;
      // M17 Fernsehturm: the lift (a bell and the doors), Der Zeitwart's gear hold, the gear going in, his blinks, the choice.
      case 'lift': this.play('bell'); this.play('thump', 0, 0, 0.6); break;
      case 'gearHold': this.play('bell'); this.play('drumroll'); break;
      case 'gear': this.play('register'); this.play('boom', 0, 0, 0.6); break;
      case 'blink': if (event.phase === 'go') this.play('zap', 0, pan, volume); else this.play('tap', 0, pan, volume); break;
      case 'choiceOpen': this.play('legend'); break;
      case 'ending': this.play('bell'); break;
    }
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
    // 2D die() has no separate cue; the fatal damage step already plays hurt.
  }

  dispose(): void {
    this.cancelPrewarm?.(); this.music?.stop();
    if (this.ctx) void this.ctx.close();
    this.ctx = null; this.master = null; this.effects = null; this.music = null; this.rotorGain = null; this.voices = null;
  }

  /** 2D initAudio ambient wind. */
  private ambience(): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = .05;
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
    lfo.frequency.value = .13; lg.gain.value = .03; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(); lfo.start();
  }
}

/** 2D sfx rolloff (js/audio.js:67): clamp(1 - d/650 px)², 30 px per meter; pan = screen x × 0.6 (half screen 640 px). */
export const AUDIO_FAR = 650 / 30, AUDIO_HALF_SCREEN = 640 / 30;
export function spatialAudio(dx:number,dz:number):{volume:number;pan:number} {
  const d=Math.hypot(dx,dz), v=Math.max(0,1-d/AUDIO_FAR);
  return {volume:v*v,pan:Math.max(-1,Math.min(1,dx/AUDIO_HALF_SCREEN))*.6};
}
/** 2D heartbeat (js/update.js:25): under 30 % life, one beat every 0.9 s. Returns the new timer and whether to beat. */
export function heartbeat(timer:number,dt:number,lifeFrac:number):{timer:number;beat:boolean} {
  if(lifeFrac>=.3||lifeFrac<=0)return {timer:0,beat:false};
  timer-=dt;
  return timer<=0?{timer:timer+.9,beat:true}:{timer,beat:false};
}
