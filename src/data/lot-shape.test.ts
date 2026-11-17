import { describe, expect, it } from 'vitest';
import { colliderDistance } from '../sim/collide';
import { Rng } from '../sim/math';
import { koepenickMap } from './koepenick';
import { generateLots, inPoly, lineDist, lotColliders, lotOutline, lotOutlineLocal, lotPieces, pickLotShape, polyEdgeDist, type Lot } from './map';

// M11d step 3: non-rectangular footprints (chamfers, risalits, niches, setbacks, open courtyards).

/** Street Altbau and shops as the generator makes them, at every corner side, turned at random. */
function synthetic(n: number): Lot[] {
  const rng = new Rng(11), out: Lot[] = [];
  for (let i = 0; i < n; i++) {
    const kind = i % 5 === 0 ? 'shop' : 'altbau', w = kind === 'shop' ? rng.range(6, 9) : rng.range(9, 16), d = kind === 'shop' ? rng.range(6, 8) : rng.range(9, 12);
    const seed = rng.int(1e6), corner = ([-1, 0, 0, 1] as const)[i % 4] as -1 | 0 | 1;
    const shape = pickLotShape(kind, w, d, seed, corner);
    if (shape) out.push({ kind, x: rng.range(-50, 50), z: rng.range(-50, 50), rot: rng.range(-Math.PI, Math.PI), w, d, floors: 1 + rng.int(2), seed, shape });
  }
  return out;
}

/** Points that are clearly inside the drawn outline hit a collider; points clearly outside hit none. */
function coverErrors(l: Lot): string[] {
  const poly = lotOutline(l), cs = lotColliders({ ...l, wing: undefined }), errs: string[] = [];
  const r = Math.hypot(l.w, l.d) / 2 + 1;
  for (let dx = -r; dx <= r; dx += 0.23) {
    for (let dz = -r; dz <= r; dz += 0.23) {
      const x = l.x + dx, z = l.z + dz;
      if (polyEdgeDist(poly, x, z) < 0.03) continue;
      const inside = inPoly(poly, x, z), hit = cs.some((c) => colliderDistance(c, x, z) <= 0);
      if (inside !== hit) errs.push(`${inside ? 'wall without collider' : 'collider in the air'} at ${x.toFixed(2)},${z.toFixed(2)}`);
    }
  }
  return errs;
}

describe('M11d lot footprints', () => {
  const lots = synthetic(400);

  it('stay inside their lot rectangle with walkable pieces, courtyards and chamfers', () => {
    expect(lots.length).toBeGreaterThan(150);
    for (const l of lots) {
      for (const [a, b] of lotOutlineLocal(l)) {
        expect(Math.abs(a)).toBeLessThanOrEqual(l.w / 2 + 1e-9);
        expect(Math.abs(b)).toBeLessThanOrEqual(l.d / 2 + 1e-9);
      }
      const ps = lotPieces(l);
      for (const p of ps) expect(p.a1 - p.a0).toBeGreaterThan(1.9);
      // An open courtyard is wide and deep enough to walk into; its wings stay real rooms.
      ps.forEach((p, i) => {
        if (l.d / 2 - p.f < 4 - 1e-9) return;
        expect(p.a1 - p.a0).toBeGreaterThanOrEqual(3.6);
        for (const q of [ps[i - 1], ps[i + 1]]) expect(q && q.a1 - q.a0).toBeGreaterThanOrEqual(3.7);
      });
      const ch = l.shape!.chamfer;
      if (ch) {
        const end = ch.side < 0 ? ps[0]! : ps[ps.length - 1]!;
        expect(end.a1 - end.a0).toBeGreaterThanOrEqual(ch.c + 1.2);
        expect(ch.c).toBeGreaterThanOrEqual(1.6);
      }
    }
  });

  it('colliders cover the drawn footprint: no wall without a collider, no collider in the air', () => {
    for (const l of lots) expect(coverErrors(l).slice(0, 3), JSON.stringify(l.shape)).toEqual([]);
  });

  it('each variant occurs; shops only get chamfers; other kinds stay rectangles', () => {
    const shapes = Array.from({ length: 600 }, (_, i) => pickLotShape('altbau', 9 + (i % 8), 10.5, i * 13 + 1, 0));
    const court = shapes.filter((s) => s?.front.some((p) => p.back >= 4)).length;
    const niche = shapes.filter((s) => s?.front.length === 3 && s.front[1]!.back >= 1.2 && s.front[1]!.back < 4).length;
    const risalit = shapes.filter((s) => s?.front.length === 3 && s.front[1]!.back < 1 && s.front.some((p) => p.back > 0.4)).length;
    const setback = shapes.filter((s) => s?.front.length === 1 && s.front[0]!.back > 0).length;
    const plain = shapes.filter((s) => !s).length;
    for (const n of [court, niche, risalit, setback, plain]) expect(n).toBeGreaterThan(30);
    // Corner lots mostly get the chamfer.
    const corners = Array.from({ length: 200 }, (_, i) => pickLotShape('altbau', 12, 10, i + 5, i % 2 ? 1 : -1));
    expect(corners.filter((s) => s?.chamfer).length).toBeGreaterThan(140);
    for (let i = 0; i < 100; i++) {
      const s = pickLotShape('shop', 7.5, 7, i, i % 2 ? 1 : 0);
      if (s) expect(s.front).toHaveLength(1);
      expect(pickLotShape('house', 8, 8, i, 1)).toBeUndefined();
      expect(pickLotShape('platte', 26, 10, i, 1)).toBeUndefined();
    }
  });

  it('a courtyard leaves room for the hero to walk in', () => {
    for (const l of lots) {
      const court = lotPieces(l).find((p) => l.d / 2 - p.f >= 4);
      if (!court) continue;
      const c = Math.cos(l.rot), s = Math.sin(l.rot), a = (court.a0 + court.a1) / 2, b = (court.f + l.d / 2) / 2;
      const x = l.x + c * a + s * b, z = l.z - s * a + c * b;
      for (const col of lotColliders(l)) expect(colliderDistance(col, x, z)).toBeGreaterThan(1.5);
    }
  });

  for (const scale of [1, 1.3]) {
    it(`Köpenick (scale ${scale}): shaped street lots keep the Altbau rules, corner chamfers face a street, colliders match`, () => {
      const m = koepenickMap(scale);
      const shaped = generateLots(m).filter((l) => l.shape);
      expect(shaped.length).toBeGreaterThan(4);
      expect(shaped.some((l) => l.shape!.chamfer)).toBe(true);
      for (const l of shaped) {
        expect(['altbau', 'shop']).toContain(l.kind);
        if (l.kind === 'altbau') {
          expect(l.w).toBeGreaterThanOrEqual(9);
          expect(l.w).toBeLessThanOrEqual(16);
          expect(l.floors).toBeGreaterThanOrEqual(1);
          expect(l.floors).toBeLessThanOrEqual(2);
        }
        expect(coverErrors(l).slice(0, 3)).toEqual([]);
        const ch = l.shape!.chamfer;
        if (ch) {
          // Just beyond the cut corner lies another street.
          const c = Math.cos(l.rot), s = Math.sin(l.rot), a = ch.side * (l.w / 2 + 3), b = l.d / 2 - 2;
          const x = l.x + c * a + s * b, z = l.z - s * a + c * b;
          expect(m.streets.some((o) => o.kind !== 'path' && lineDist(o.pts, x, z) < o.width / 2 + 3)).toBe(true);
        }
      }
    });
  }
});
