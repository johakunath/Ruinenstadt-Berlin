// Death summary (Johannes, 2026-11-18): what killed the hero and what hurt most just before, for the
// death screen and run telemetry. Fed with the `playerHit` events of a run.

export interface HitLog { by: string; damage: number; t: number }
export interface DeathSummary {
  /** The hit that killed. */
  by: string;
  /** Sources of the last `window` seconds, most damage first, as shares of max life. */
  recent: Array<{ by: string; share: number; hits: number }>;
}

/** Keeps the hits of the last `keep` seconds. */
export function logHit(log: HitLog[], by: string, damage: number, t: number, keep = 10): void {
  log.push({ by, damage, t });
  while (log.length && log[0]!.t < t - keep) log.shift();
}

export function deathSummary(log: HitLog[], now: number, maxHp: number, window = 6): DeathSummary | null {
  const last = log[log.length - 1];
  if (!last) return null;
  const by = new Map<string, { share: number; hits: number }>();
  for (const h of log) {
    if (h.t < now - window) continue;
    const r = by.get(h.by) ?? { share: 0, hits: 0 };
    r.share += h.damage / Math.max(1, maxHp);
    r.hits++;
    by.set(h.by, r);
  }
  return { by: last.by, recent: [...by].map(([k, v]) => ({ by: k, ...v })).sort((a, b) => b.share - a.share).slice(0, 3) };
}
