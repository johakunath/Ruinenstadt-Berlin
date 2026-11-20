// Sun (moon) shadow map rate (profile `shadowEvery`). The renderer keeps `shadowMap.autoUpdate`
// off and asks this clock once per frame whether the map is due. Counted in frames, not seconds
// (review 2026-11-20): a time rule (at most 40 a second) rendered every frame exactly when a
// struggling tablet fell to 30 fps, so the saving vanished when it was needed.

/** True when `frames` since the last shadow render reach `every` (1 = every frame). */
export function shadowDue(frames: number, every: number): boolean {
  return every <= 1 || frames >= every;
}

export class ShadowClock {
  private frames = 0;
  private force = true;

  constructor(private readonly every: number) {}

  /** The next frame renders the shadow map (first frame, new sim, resize). */
  invalidate(): void {
    this.force = true;
  }

  /** Advances one drawn frame; true when the shadow map is re-rendered this frame. */
  tick(): boolean {
    this.frames++;
    if (!this.force && !shadowDue(this.frames, this.every)) return false;
    this.force = false;
    this.frames = 0;
    return true;
  }
}
