// M11c weather, variant A (Johannes, 2026-11-17): fixed per zone. Bahnhofsviertel rain, Müggelberge
// fog with fireflies, Spreepark ash with embers, Rathaus/Altstadt clear moonlight. Particles live in a
// box that follows the hero and fade over two seconds when the zone changes. Cost: three point or line
// draws on the FX layer (no lights, no shadows), scene fog density eased per weather.
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, FogExp2, LineBasicMaterial, LineSegments, Points, PointsMaterial, type Scene } from 'three';
import { areaAt, type MapDef } from '../data/map';
import { FX_LAYER } from './world';
import { groundY } from './ground';

export type WeatherKind = 'rain' | 'fog' | 'ash' | 'clear';
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
 * Mitte 2089 (M15): rain over the city (2D `wet` rule), a calm misty Tiergarten with fireflies around the
 * Großer Stern and the Neuer See. Step 3 of `docs/tasks/m15-mitte.md` tunes the rain per zone.
 */
export const MITTE_WEATHER: Readonly<Record<string, WeatherKind>> = {
  friedrichstadt: 'rain', leipzigerplatz: 'rain', pariserplatz: 'rain', regierung: 'rain', republik: 'rain',
  potsdamer: 'rain', kulturforum: 'rain', tilla: 'rain',
  tiergarten: 'fog', stern: 'fog', biergarten: 'fog',
};
/** Fog density per weather (scene default 0.017). */
const FOG: Record<WeatherKind, number> = { rain: 0.021, fog: 0.03, ash: 0.022, clear: 0.014 };
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
  private readonly layers: Record<'rain' | 'fireflies' | 'ash' | 'embers', Layer>;
  private kind: WeatherKind = 'clear';
  private seed = 1;
  private readonly tex = dot();

  constructor(private readonly scene: Scene, private readonly map: MapDef | undefined, private readonly table: Readonly<Record<string, WeatherKind>>, scale: number) {
    const n = (k: number): number => Math.max(8, Math.round(k * scale));
    this.layers = {
      rain: this.lines(n(700), 0x9fc8e0, 0.32),
      fireflies: this.points(n(90), 0xf2e27a, 0.3, true),
      ash: this.points(n(520), 0xc8c2ba, 0.14, false),
      embers: this.points(n(140), 0xff7a2a, 0.22, true),
    };
  }
  private rnd(): number { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  private fill(count: number, stride: number): { pos: Float32Array; vel: Float32Array } {
    const pos = new Float32Array(count * stride * 3), vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { const x = (this.rnd() - 0.5) * W, y = this.rnd() * H, z = (this.rnd() - 0.5) * D; for (let s = 0; s < stride; s++) pos.set([x, y, z], (i * stride + s) * 3); }
    return { pos, vel };
  }
  private add(obj: Points | LineSegments): void { obj.layers.set(FX_LAYER); obj.frustumCulled = false; obj.visible = false; this.scene.add(obj); }
  private lines(count: number, color: number, opacity: number): Layer {
    const { pos, vel } = this.fill(count, 2);
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
    const obj = new LineSegments(g, new LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, fog: true }));
    this.add(obj);
    return { obj, pos, vel, level: 0, max: opacity };
  }
  private points(count: number, color: number, size: number, glow: boolean): Layer {
    const { pos, vel } = this.fill(count, 1);
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
    const obj = new Points(g, new PointsMaterial({ color, size, map: this.tex, alphaTest: 0.02, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: glow ? AdditiveBlending : undefined, fog: !glow }));
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
    const want = { rain: this.kind === 'rain', fireflies: this.kind === 'fog', ash: this.kind === 'ash', embers: this.kind === 'ash' };
    for (const key of Object.keys(this.layers) as Array<keyof typeof this.layers>) {
      const L = this.layers[key];
      L.level = Math.max(0, Math.min(1, L.level + (want[key] ? dt : -dt) / 2));
      L.obj.visible = L.level > 0.01;
      (L.obj.material as PointsMaterial).opacity = L.max * L.level;
      if (!L.obj.visible) continue;
      // Heights are relative to the ground under the hero (the Müggelberge summit is 7 m up; Codex review).
      L.obj.position.y = groundY(hx, hz);
      this.step(key, L, dt, hx, hz, time);
      L.obj.geometry.attributes.position!.needsUpdate = true;
    }
    const fog = this.scene.fog as FogExp2 | null;
    if (fog) fog.density += (FOG[this.kind] - fog.density) * Math.min(1, dt * 0.6);
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
    for (let k = 0; k < n; k++) {
      const i = k * 3, v = L.vel;
      if (key === 'fireflies') {
        // Slow wandering low over the ground, 0.3 to 2.5 m high.
        p[i]! += Math.sin(t * 0.7 + k) * 0.6 * dt + v[i]! * 0.3 * dt;
        p[i + 2]! += Math.cos(t * 0.6 + k * 1.3) * 0.6 * dt + v[i + 2]! * 0.3 * dt;
        p[i + 1] = 0.3 + ((k * 0.37) % 2.2) + Math.sin(t * 1.3 + k) * 0.3;
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
