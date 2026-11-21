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
  /** A step down on trial: the mean frame before it and the windows seen since. */
  private trial: { before: number; sum: number; spans: number } | null = null;
  /** Seconds without step-downs after a step that bought nothing. */
  private hold = 0;
  private failures = 0;

  /**
   * One drawn frame: `ms` its real interval, `targetMs` the frame budget (16.7 at the 60 fps cap,
   * 33.3 with Akkusparen). Judged on the mean of half-second windows: at a 60 fps cap on a 90 or
   * 144 Hz screen single intervals alternate short and long while the mean is on time.
   * A step down is a trial (tablet playtest 2026-11-20, Görlitzer Park: a CPU-bound Tab S9 went down
   * to 0.6 with no fps gained, only blur): when the frames are not at least 8 % faster after it, the
   * scale goes back and stays for two minutes; after a second such failure it stays for the session.
   * Returns true when the scale changed.
   */
  frame(ms: number, targetMs: number): boolean {
    if (this.opts.min >= 1) return false;
    // A hitch (tab switch, load) says nothing about steady cost.
    if (ms > 250) return false;
    this.winMs += ms;
    this.winFrames++;
    if (this.winMs < 500) return false;
    const mean = this.winMs / this.winFrames;
    const span = this.winMs / 1000;
    this.winMs = 0;
    this.winFrames = 0;
    this.hold = Math.max(0, this.hold - span);
    if (this.trial) {
      this.trial.sum += mean * span;
      this.trial.spans += span;
      if (this.trial.spans >= this.downAfter) {
        const after = this.trial.sum / this.trial.spans, before = this.trial.before;
        this.trial = null;
        if (after > before * 0.92) {
          this.failures++;
          this.hold = this.failures >= 2 ? Infinity : 120;
          this.scale = Math.min(1, Math.round((this.scale + 0.1) * 100) / 100);
          this.late = this.fine = 0;
          return true;
        }
      }
    }
    if (mean > targetMs * 1.12) {
      // Capped: seconds spent late at the lowest scale must not trigger a step right after a climb.
      this.late = Math.min(this.downAfter, this.late + span);
      this.fine = 0;
    } else {
      this.fine += span;
      this.late = Math.max(0, this.late - span);
    }
    if (this.late >= this.downAfter && this.scale > this.opts.min && this.hold <= 0 && !this.trial) {
      this.trial = { before: mean, sum: 0, spans: 0 };
      this.scale = Math.max(this.opts.min, Math.round((this.scale - 0.1) * 100) / 100);
      this.late = 0;
      return true;
    }
    if (this.fine >= this.upAfter && this.scale < 1) {
      this.scale = Math.min(1, Math.round((this.scale + 0.05) * 100) / 100);
      this.fine = 0;
      this.late = 0;
      return true;
    }
    return false;
  }
}
