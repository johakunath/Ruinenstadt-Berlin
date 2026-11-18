// Sun (moon) shadow map rate (profile `shadowInterval`). The renderer keeps `shadowMap.autoUpdate`
// off and asks this clock once per frame whether the map is due; Leistung waits at least 1/40 s
// between renders (every 2nd frame at 60 fps, every frame at 30 fps, every 3rd at 120 Hz).

/** True when `elapsed` seconds since the last shadow render reach `interval` (0 = every frame). */
export function shadowDue(elapsed: number, interval: number): boolean {
  // A small tolerance: at 120 Hz three frames sum to exactly 1/40 s, which float addition can miss.
  return interval <= 0 || elapsed >= interval - 1e-4;
}

export class ShadowClock {
  private elapsed = 0;
  private force = true;

  constructor(private readonly interval: number) {}

  /** The next frame renders the shadow map (first frame, new sim, resize). */
  invalidate(): void {
    this.force = true;
  }

  /** Advances by the frame's real `dt`; true when the shadow map is re-rendered this frame. */
  tick(dt: number): boolean {
    this.elapsed += dt;
    if (!this.force && !shadowDue(this.elapsed, this.interval)) return false;
    this.force = false;
    this.elapsed = 0;
    return true;
  }
}
