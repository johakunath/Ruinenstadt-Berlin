// M16 Charlottenburg step 3a: the sky follows the hero's zone (spec `docs/tasks/m16-charlottenburg.md` ›
// Step 3a spec). Only uniforms and scene fields blend (background, fog, hemisphere, moon or sun, lamp scale,
// grade); the reflection map is pre-rendered once per zone sky and switches at the middle of a blend; the
// light direction and the light count never change. Pure state, the renderer applies it.
import { mixSky, type Sky } from './sky';

/** Seconds a sky change takes (smoothstep). */
export const SKY_BLEND = 4;

export class SkyBlend {
  now: Sky;
  /** Zone whose sky is the target, and whose reflection map shows (switches at the blend middle). */
  zone: number;
  envZone: number;
  private from: Sky;
  private t = 1;

  constructor(private readonly skies: readonly Sky[], private readonly zoneOf: (x: number, z: number) => number, x: number, z: number) {
    this.zone = this.envZone = Math.min(skies.length - 1, zoneOf(x, z));
    this.now = this.from = skies[this.zone]!;
  }

  /** Jumps to the sky at (x, z) without a blend (run start, restart, resume). */
  snap(x: number, z: number): void {
    this.zone = this.envZone = Math.min(this.skies.length - 1, this.zoneOf(x, z));
    this.now = this.from = this.skies[this.zone]!;
    this.t = 1;
  }

  /** Advances the blend; true while the sky changes this frame. */
  update(dt: number, x: number, z: number): boolean {
    const zone = Math.min(this.skies.length - 1, this.zoneOf(x, z));
    if (zone !== this.zone) {
      this.from = this.now;
      this.zone = zone;
      this.t = 0;
    }
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / SKY_BLEND);
    if (this.t >= 0.5) this.envZone = this.zone;
    const k = this.t * this.t * (3 - 2 * this.t);
    this.now = this.t >= 1 ? this.skies[this.zone]! : mixSky(this.from, this.skies[this.zone]!, k);
    return true;
  }
}
