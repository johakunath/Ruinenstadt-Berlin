import { describe, expect, it } from 'vitest';
import { deathSummary, logHit, type HitLog } from './death';

describe('death summary', () => {
  it('names the killing hit and ranks the last seconds by damage', () => {
    const log: HitLog[] = [];
    logHit(log, 'Läufer', 50, 1);
    logHit(log, 'Feldwebel · Stampfer', 40, 8);
    logHit(log, 'Läufer', 10, 9);
    logHit(log, 'Läufer', 10, 10);
    logHit(log, 'Feldwebel', 30, 11);
    const d = deathSummary(log, 11, 100)!;
    expect(d.by).toBe('Feldwebel');
    expect(d.recent.map((r) => r.by)).toEqual(['Feldwebel · Stampfer', 'Feldwebel', 'Läufer']);
    expect(d.recent[2]).toEqual({ by: 'Läufer', share: 0.2, hits: 2 });
  });

  it('forgets hits older than ten seconds and is empty without hits', () => {
    const log: HitLog[] = [];
    logHit(log, 'a', 1, 0);
    logHit(log, 'b', 1, 20);
    expect(log.map((h) => h.by)).toEqual(['b']);
    expect(deathSummary([], 0, 100)).toBeNull();
  });
});
