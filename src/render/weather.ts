// M11c weather, variant A (Johannes, 2026-11-17): fixed per zone. Bahnhofsviertel rain, Müggelberge
// fog with fireflies, Spreepark ash with embers, Rathaus/Altstadt clear moonlight. Particles live in a
// box that follows the hero and fade over two seconds when the zone changes. Cost: three point or line
// draws on the FX layer (no lights, no shadows), scene fog density eased per weather. M16 Charlottenburg adds
// confetti, prism motes and diamond dust: one more point draw while one of them shows (two during a fade).
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, FogExp2, LineBasicMaterial, LineSegments, Points, PointsMaterial, type Scene } from 'three';
import { areaAt, type MapDef } from '../data/map';
import { FX_LAYER } from './world';
import { groundY } from './ground';
import type { Wet } from './sky';

export type WeatherKind = 'rain' | 'fog' | 'ash' | 'leaves' | 'clear' | 'confetti' | 'motes' | 'diamond';
/** Which weather an area has (area ids of `MapDef.areas`); missing ids are clear. */
export const KOEPENICK_WEATHER: Readonly<Record<string, WeatherKind>> = {
  bahnhof: 'rain', friedrichshagen: 'rain',
  kietz: 'fog', mueggelberge: 'fog', wendenschloss: 'fog',
  spreepark: 'ash', johannisthal: 'ash', vorstadt: 'ash',
  altstadt: 'clear',
};
/**
 * Xhain 1981 (M15): fog over the Spree banks and the death strip, ash and embers over the burning squats
 * of SO36, rain at the Kotti and in the Görli, a clear night in the Wrangelkiez. Same particle layers.
 */
export const XHAIN_WEATHER: Readonly<Record<string, WeatherKind>> = {
  osthafen: 'fog', andreasviertel: 'fog', todesstreifen: 'fog', grenzstreifen: 'fog',
  so36: 'ash', mariannenplatz: 'ash',
  kotti: 'rain', goerli: 'rain', reichenberger: 'rain',
  wrangelkiez: 'clear',
};
/**
 * Alexanderplatz 1989, frozen in autumn (M15, afternoon light A): leaves drift over the island, the forum,
 * the Nikolaiviertel and the Allee; the plaza at the Weltzeituhr stays clear.
 */
export const ALEX_WEATHER: Readonly<Record<string, WeatherKind>> = {
  museumsinsel: 'leaves', forum: 'leaves', nikolaiviertel: 'leaves', rolandufer: 'leaves', allee: 'leaves', holzmarkt: 'leaves',
  alexanderplatz: 'clear', hackescher: 'clear', spandauer: 'clear',
};
/**
 * Mitte 2089 (M15): rain over the city (2D `wet` rule), a calm misty Tiergarten with fireflies around the
 * Großer Stern and the Neuer See. Step 3 of `docs/tasks/m15-mitte.md` tunes the rain per zone.
 */
export const MITTE_WEATHER: Readonly<Record<string, WeatherKind>> = {
  friedrichstadt: 'rain', leipzigerplatz: 'rain', pariserplatz: 'rain', regierung: 'rain', republik: 'rain',
  potsdamer: 'rain', kulturforum: 'rain', tilla: 'rain',
  tiergarten: 'fog', stern: 'fog', biergarten: 'fog',
};
/**
 * Charlottenburg 1920 (M16 step 3b, dry, one look per zone): a few leaves in the Zoo (Blaue Stunde),
 * confetti and streamer bits on the Ku'damm and the Savignyplatz (Premierennacht), prism motes in the
 * garden mist (Mondnacht), diamond dust at the Schloss (Morgengrauen). Other streets clear.
 */
export const CHARLOTTENBURG_WEATHER: Readonly<Record<string, WeatherKind>> = {
  zoo: 'leaves', kudamm: 'confetti', savignyplatz: 'confetti',
  schlossgarten: 'motes', schlossvorplatz: 'motes', luisenplatz: 'motes', irrgarten: 'motes', schloss: 'diamond',
};
/**
 * Wedding (M18, look A, dry; existing kinds only): leaves in the Leopoldkiez and the Humboldthain, thin mist with
 * fireflies at the Panke, ember sparks over the AEG yard; Gesundbrunnen and the Brunnenstraße clear.
 */
export const WEDDING_WEATHER: Readonly<Record<string, WeatherKind>> = {
  leopoldplatz: 'leaves', leopoldkiez: 'leaves', nettelbeckplatz: 'leaves', humboldthain: 'leaves',
  uferterrasse: 'fog', brunnenplatz: 'fog',
  aeg: 'ash', vorplatz: 'ash',
};
/** Fog density per weather (scene default 0.017). */
const FOG: Record<WeatherKind, number> = { rain: 0.021, fog: 0.03, ash: 0.022, leaves: 0.014, clear: 0.014, confetti: 0.015, motes: 0.022, diamond: 0.012 };
/** Confetti colours (revue bills: gold, pink, white, teal, red) and the prism motes (pale spectrum). */
const CONFETTI = [0xf2c14b, 0xff6fb5, 0xf4f0e8, 0x4fd0c8, 0xe0453a, 0xf2c14b];
const PRISM = [0xff9ec4, 0xffe08a, 0x9ff2c4, 0x9fd0ff, 0xc9a8ff];
const W = 36, D = 30, H = 14;

/** Soft round dot for point particles (white, tinted by the material color). */
function dot(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

interface Layer { obj: Points | LineSegments; pos: Float32Array; vel: Float32Array; level: number; max: number }

export class Weather {
  private readonly layers: Record<'rain' | 'fireflies' | 'ash' | 'embers' | 'splash' | 'leaves' | 'confetti' | 'motes' | 'diamond', Layer>;
  private kind: WeatherKind = 'clear';
  private seed = 1;
  private readonly tex = dot();

  /**
   * `wet` (Mitte): denser rain, part of the streaks tinted by the neon, and splashes on the ground (one more
   * point draw on the FX layer, only while it rains there).
   */
  constructor(private readonly scene: Scene, private readonly map: MapDef | undefined, private readonly table: Readonly<Record<string, WeatherKind>>, scale: number, private readonly fogScale = 1, wet?: Wet) {
    const n = (k: number): number => Math.max(8, Math.round(k * scale));
    this.layers = {
      rain: this.lines(n(wet ? 950 : 700), wet ? 0xffffff : 0x9fc8e0, wet ? 0.42 : 0.32, wet),
      fireflies: this.points(n(90), 0xf2e27a, 0.3, true),
      ash: this.points(n(520), 0xc8c2ba, 0.14, false),
      embers: this.points(n(140), 0xff7a2a, 0.22, true),
      splash: this.points(wet ? n(220) : 0, wet?.rain ?? 0xffffff, 0.16, true),
      leaves: this.points(n(160), 0xd88a2a, 0.2, false),
      // M16 Charlottenburg: one Points draw each on the FX layer, only where the zone has it (none elsewhere: count 0).
      confetti: this.points(map?.id === 'charlottenburg' ? n(240) : 0, 0xffffff, 0.15, false, CONFETTI),
      motes: this.points(map?.id === 'charlottenburg' ? n(120) : 0, 0xffffff, 0.2, true, PRISM),
      diamond: this.points(map?.id === 'charlottenburg' ? n(300) : 0, 0xdcecff, 0.08, true),
    };
  }
  private rnd(): number { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  private fill(count: number, stride: number): { pos: Float32Array; vel: Float32Array } {
    const pos = new Float32Array(count * stride * 3), vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { const x = (this.rnd() - 0.5) * W, y = this.rnd() * H, z = (this.rnd() - 0.5) * D; for (let s = 0; s < stride; s++) pos.set([x, y, z], (i * stride + s) * 3); }
    return { pos, vel };
  }
  private add(obj: Points | LineSegments): void { obj.layers.set(FX_LAYER); obj.frustumCulled = false; obj.visible = false; this.scene.add(obj); }
  private lines(count: number, color: number, opacity: number, wet?: Wet): Layer {
    const { pos, vel } = this.fill(count, 2);
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
    if (wet) {
      // Rain colour, a share of the streaks in the neon colours (they catch the signs).
      const neon = [...wet.neon.warm, ...wet.neon.cold], col = new Float32Array(count * 6), c = new Color();
      for (let i = 0; i < count; i++) {
        c.setHex(this.rnd() < wet.rainNeon ? neon[Math.floor(this.rnd() * neon.length)]! : wet.rain);
        col.set([c.r * 0.5, c.g * 0.5, c.b * 0.5, c.r, c.g, c.b], i * 6);
      }
      g.setAttribute('color', new BufferAttribute(col, 3));
    }
    const obj = new LineSegments(g, new LineBasicMaterial({ color, vertexColors: !!wet, transparent: true, opacity: 0, depthWrite: false, fog: true }));
    this.add(obj);
    return { obj, pos, vel, level: 0, max: opacity };
  }
  private points(count: number, color: number, size: number, glow: boolean, palette?: number[]): Layer {
    const { pos, vel } = this.fill(count, 1);
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
    if (palette) {
      const col = new Float32Array(count * 3), c = new Color();
      for (let i = 0; i < count; i++) { c.setHex(palette[Math.floor(this.rnd() * palette.length)]!); col.set([c.r, c.g, c.b], i * 3); }
      g.setAttribute('color', new BufferAttribute(col, 3));
    }
    const obj = new Points(g, new PointsMaterial({ color, size, map: this.tex, alphaTest: 0.02, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, vertexColors: !!palette, ...(glow ? { blending: AdditiveBlending } : {}), fog: !glow }));
    this.add(obj);
    for (let i = 0; i < count; i++) vel.set([this.rnd() - 0.5, this.rnd() - 0.5, this.rnd() - 0.5], i * 3);
    return { obj, pos, vel, level: 0, max: glow ? 0.95 : 0.7 };
  }
  /** The weather where the hero stands. */
  kindAt(x: number, z: number): WeatherKind {
    if (!this.map) return 'clear';
    const a = areaAt(this.map, x, z);
    return (a && this.table[a.id]) || 'clear';
  }
  update(dt: number, hx: number, hz: number, time: number): void {
    this.kind = this.kindAt(hx, hz);
    const k = this.kind;
    const want = { rain: k === 'rain', fireflies: k === 'fog', ash: k === 'ash', embers: k === 'ash', splash: k === 'rain', leaves: k === 'leaves', confetti: k === 'confetti', motes: k === 'motes', diamond: k === 'diamond' };
    for (const key of Object.keys(this.layers) as Array<keyof typeof this.layers>) {
      const L = this.layers[key];
      L.level = Math.max(0, Math.min(1, L.level + (want[key] ? dt : -dt) / 2));
      L.obj.visible = L.level > 0.01 && L.pos.length > 0;
      (L.obj.material as PointsMaterial).opacity = L.max * L.level;
      if (!L.obj.visible) continue;
      // Heights are relative to the ground under the hero (the Müggelberge summit is 7 m up; Codex review).
      L.obj.position.y = groundY(hx, hz);
      this.step(key, L, dt, hx, hz, time);
      L.obj.geometry.attributes.position!.needsUpdate = true;
    }
    const fog = this.scene.fog as FogExp2 | null;
    if (fog) fog.density += (FOG[this.kind] * this.fogScale - fog.density) * Math.min(1, dt * 0.6);
  }
  /** Moves particles and wraps them inside the box around the hero. */
  private step(key: keyof Weather['layers'], L: Layer, dt: number, hx: number, hz: number, t: number): void {
    const mod = (a: number, m: number): number => ((a % m) + m) % m;
    const p = L.pos, wrap = (i: number): void => {
      p[i] = hx - W / 2 + mod(p[i]! - (hx - W / 2), W);
      p[i + 2] = hz - D / 2 + mod(p[i + 2]! - (hz - D / 2), D);
    };
    if (key === 'rain') {
      // Streaks of 0.7 m falling at 13 m/s with a little wind.
      for (let i = 0; i < p.length; i += 6) {
        p[i + 1]! -= 13 * dt; p[i]! += 1.2 * dt;
        if (p[i + 1]! < 0) p[i + 1]! += H;
        wrap(i);
        p[i + 3] = p[i]! - 0.06; p[i + 4] = p[i + 1]! + 0.7; p[i + 5] = p[i + 2]!;
      }
      return;
    }
    const n = p.length / 3;
    if (key === 'splash') {
      // Each splash lives about 0.15 s a hand's height over the ground, then lands somewhere else near the hero.
      for (let k = 0; k < n; k++) {
        const i = k * 3, v = L.vel;
        v[i]! -= dt;
        if (v[i]! < 0) { v[i] = 0.1 + this.rnd() * 0.12; p[i] = hx + (this.rnd() - 0.5) * W * 0.8; p[i + 2] = hz + (this.rnd() - 0.5) * D * 0.8; }
        p[i + 1] = 0.04 + (0.22 - v[i]!) * 0.5;
      }
      return;
    }
    for (let k = 0; k < n; k++) {
      const i = k * 3, v = L.vel;
      if (key === 'fireflies') {
        // Slow wandering low over the ground, 0.3 to 2.5 m high.
        p[i]! += Math.sin(t * 0.7 + k) * 0.6 * dt + v[i]! * 0.3 * dt;
        p[i + 2]! += Math.cos(t * 0.6 + k * 1.3) * 0.6 * dt + v[i + 2]! * 0.3 * dt;
        p[i + 1] = 0.3 + ((k * 0.37) % 2.2) + Math.sin(t * 1.3 + k) * 0.3;
      } else if (key === 'leaves') {
        // Autumn leaves: a slow fall with a wide sway and flutter.
        p[i + 1]! -= (0.55 + Math.abs(v[i + 1]!) * 0.5) * dt; p[i]! += (0.4 + Math.sin(t * 1.1 + k) * 1.1) * dt; p[i + 2]! += Math.cos(t * 0.9 + k * 1.7) * 0.7 * dt;
        if (p[i + 1]! < 0) p[i + 1]! += H;
      } else if (key === 'confetti') {
        // Paper bits: a fluttering fall, quicker than leaves, spinning sideways.
        p[i + 1]! -= (0.8 + Math.abs(v[i + 1]!) * 0.6) * dt; p[i]! += Math.sin(t * 3.1 + k * 1.3) * 1.2 * dt + 0.2 * dt; p[i + 2]! += Math.cos(t * 2.7 + k) * 0.9 * dt;
        if (p[i + 1]! < 0) p[i + 1]! += H;
      } else if (key === 'motes') {
        // Prism motes in the mist: slow wandering, 0.5 to 4 m high.
        p[i]! += Math.sin(t * 0.4 + k) * 0.35 * dt + v[i]! * 0.2 * dt;
        p[i + 2]! += Math.cos(t * 0.35 + k * 1.7) * 0.35 * dt + v[i + 2]! * 0.2 * dt;
        p[i + 1] = 0.5 + ((k * 0.53) % 3.5) + Math.sin(t * 0.8 + k) * 0.25;
      } else if (key === 'diamond') {
        // Diamond dust: a very slow glittering sink.
        p[i + 1]! -= (0.12 + Math.abs(v[i + 1]!) * 0.1) * dt; p[i]! += (0.1 + Math.sin(t * 0.5 + k) * 0.15) * dt; p[i + 2]! += v[i + 2]! * 0.1 * dt;
        if (p[i + 1]! < 0) p[i + 1]! += H * 0.6;
      } else if (key === 'ash') {
        p[i + 1]! -= (0.5 + Math.abs(v[i + 1]!)) * dt; p[i]! += (0.6 + Math.sin(t + k) * 0.4) * dt; p[i + 2]! += v[i + 2]! * 0.3 * dt;
        if (p[i + 1]! < 0) p[i + 1]! += H;
      } else {
        // Embers rise and drift, then start again near the ground.
        p[i + 1]! += (0.8 + Math.abs(v[i + 1]!)) * dt; p[i]! += (v[i]! + Math.sin(t * 2 + k) * 0.5) * dt; p[i + 2]! += v[i + 2]! * 0.5 * dt;
        if (p[i + 1]! > H * 0.7) p[i + 1] = 0.2;
      }
      wrap(i);
    }
  }
  /** For tests and the debug readout. */
  get current(): WeatherKind { return this.kind; }
}
