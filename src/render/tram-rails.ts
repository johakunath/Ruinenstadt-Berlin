import type { Pt } from '../data/map';

// Gauge is between the inner faces of the running heads, not between rail centres.
export const TRAM_GAUGE = 1.435;
const HEAD = 0.07;
export const TRAM_RAILS = [-1.5, 1.5].flatMap(track => [-1, 1].map(side => ({
  offset: track + side * (TRAM_GAUGE + HEAD) / 2,
  inward: -side,
})));

/** Top surfaces of an embedded grooved rail, metres from the running-head centre. */
export const TRAM_SECTION = [
  { kind: 'seam', offset: 0.045, width: 0.24, height: 0.003 },
  { kind: 'rust', offset: 0.035, width: 0.15, height: 0.005 },
  { kind: 'groove', offset: 0.056, width: 0.042, height: 0.007 },
  { kind: 'guard', offset: 0.091, width: 0.028, height: 0.012 },
  { kind: 'head', offset: 0, width: HEAD, height: 0.014 },
] as const;

/** Mitered offset at a polyline vertex: adjoining rail ribbons share exactly the same ends. */
export function tramOffsetPoint(points: readonly Pt[], index: number, offset: number): Pt {
  const p = points[index]!;
  const a = points[Math.max(0, index - 1)]!;
  const b = points[Math.min(points.length - 1, index + 1)]!;
  const direction = (from: Pt, to: Pt): Pt => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
  };
  const incoming = direction(index === 0 ? p : a, index === 0 ? b : p);
  const outgoing = direction(index === points.length - 1 ? a : p, index === points.length - 1 ? p : b);
  // Offset normal is (dz, -dx); mitering preserves spacing perpendicular to either segment.
  const nx = incoming[1] + outgoing[1];
  const nz = -incoming[0] - outgoing[0];
  const length = Math.hypot(nx, nz);
  if (length < 1e-6) return [p[0] + outgoing[1] * offset, p[1] - outgoing[0] * offset];
  const mx = nx / length, mz = nz / length;
  const scale = Math.min(2, 1 / Math.max(0.001, mx * outgoing[1] - mz * outgoing[0]));
  return [p[0] + mx * offset * scale, p[1] + mz * offset * scale];
}
