// Dynamic resolution (Q1, review 2026-11-20): when frames keep arriving late, the frame renders
// at a smaller scale of its pixel ratio; when they are on time again for a while, it climbs back.
// Pure logic (no DOM): the renderer feeds real frame intervals and resizes on a change.

export interface DynResOptions {
  /** Lowest scale (1 = off). */
  min: number;
  /** Seconds of late frames before a step down. */
  downAfter?: number;
  /** Seconds of punctual frames before a step up. */
  upAfter?: number;
}

export class DynamicResolution {
  scale = 1;
  private late = 0;
  private fine = 0;
  private readonly downAfter: number;
  private readonly upAfter: number;

  constructor(private readonly opts: DynResOptions) {
    this.downAfter = opts.downAfter ?? 2;
    this.upAfter = opts.upAfter ?? 6;
  }

  private winMs = 0;
  private winFrames = 0;
  private winCpu = 0;

  /**
   * One drawn frame: `ms` its real interval, `targetMs` the frame budget (16.7 at the 60 fps cap,
   * 33.3 with Akkusparen). Judged on the mean of half-second windows: at a 60 fps cap on a 90 or
   * 144 Hz screen single intervals alternate short and long while the mean is on time.
   * `cpuMs`: the frame's own CPU time (sim + scene update + draw submission). When that alone fills
   * most of the interval the frame is CPU-bound and fewer pixels buy nothing: the picture only
   * blurs (tablet playtest 2026-11-20, Görlitzer Park: render CPU 25 to 30 ms, scale down to 0.6, no
   * fps gained). Such windows count as on time for the scale, so it climbs back to sharp.
   * Returns true when the scale changed.
   */
  frame(ms: number, targetMs: number, cpuMs = 0): boolean {
    if (this.opts.min >= 1) return false;
    // A hitch (tab switch, load) says nothing about steady cost.
    if (ms > 250) return false;
    this.winMs += ms;
    this.winCpu += cpuMs;
    this.winFrames++;
    if (this.winMs < 500) return false;
    const mean = this.winMs / this.winFrames;
    const cpuBound = this.winCpu / this.winFrames > Math.max(targetMs, mean) * 0.7;
    const span = this.winMs / 1000;
    this.winMs = 0;
    this.winCpu = 0;
    this.winFrames = 0;
    if (mean > targetMs * 1.12 && !cpuBound) {
      this.late += span;
      this.fine = 0;
    } else {
      this.fine += span;
      this.late = Math.max(0, this.late - span);
    }
    if (this.late >= this.downAfter && this.scale > this.opts.min) {
      this.scale = Math.max(this.opts.min, Math.round((this.scale - 0.1) * 100) / 100);
      this.late = 0;
      return true;
    }
    if (this.fine >= this.upAfter && this.scale < 1) {
      this.scale = Math.min(1, Math.round((this.scale + 0.05) * 100) / 100);
      this.fine = 0;
      return true;
    }
    return false;
  }
}
