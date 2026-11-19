import { describe, expect, it } from 'vitest';
import type { Landmark } from '../data/map';
import { footprintDist, LandmarkReveal, REVEAL_IN, REVEAL_NEAR, REVEAL_OUT } from './reveal';
import { charlottenburgMap } from '../data/charlottenburg';

const rathaus: Landmark = { kind: 'rathaus', x: 0, z: 0, rot: Math.PI / 2, hx: 13, hz: 15, clear: 3 };
const spati: Landmark = { kind: 'spati', x: 100, z: 0, rot: 0, hx: 5, hz: 4, clear: 2 };

describe('landmark reveal (M11d)', () => {
  it('Charlottenburg reveals its eight sights only; no Köpenick kind (the Rathaus is its own backdrop kind, M16)', () => {
    const shown = charlottenburgMap(1).landmarks.filter((l) => new LandmarkReveal([l]).update(0.1, l.x, l.z, true) !== null).map((l) => l.kind);
    expect(shown.sort()).toEqual(['belvedere', 'elefantentor', 'gedaechtniskirche', 'kadewe', 'opernhaus', 'revuepalast', 'schlossmitte', 'theaterwestens']);
  });

  it('Charlottenburg: the Schloss reveal starts at the end of the Schloßstraße and round into the Spandauer Damm (either sidewalk; at 1.3 the north one)', () => {
    for (const scale of [1, 1.3]) {
      const m = charlottenburgMap(scale), schloss = m.landmarks.find((l) => l.kind === 'schlossmitte')!;
      // Not yet at the north rim of the Schloßstraße fight (never mid-fight there).
      const e = m.encounters.find((q) => q.id === 'schlossstrasse')!;
      expect(new LandmarkReveal([schloss]).update(0.1, e.x, e.z - e.r, true)).toBeNull();
      const pts = [...m.streets.find((s) => s.name === 'Schloßstraße')!.pts, ...m.streets.find((s) => s.name === 'Spandauer Damm')!.pts.filter(([x]) => x > -76 * scale)];
      for (const side of scale === 1 ? [-1, 1] : [-1, 0]) {
        const r = new LandmarkReveal([schloss]);
        let shown = false;
        for (let i = 1; i < pts.length && !shown; i++) {
          const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!, len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
          // Walk the outer edge of the sidewalk on each side (Allee 18 m and Spandauer Damm 14 m, plus 3 m).
          for (let t = 0; t <= len && !shown; t += 1) shown = r.update(0.1, ax + ((bx - ax) * t) / len + nx * side * 11, az + ((bz - az) * t) / len + nz * side * 11, true) !== null;
        }
        expect(shown, `scale ${scale} side ${side}`).toBe(true);
      }
    }
  });

  it('measures the distance to the rotated footprint', () => {
    expect(footprintDist(rathaus, 0, 0)).toBe(0);
    // Rotated a quarter turn: the 15 m half depth runs along x.
    expect(footprintDist(rathaus, 20, 0)).toBeCloseTo(5, 5);
    expect(footprintDist(rathaus, 0, 20)).toBeCloseTo(7, 5);
  });

  it('starts near a landmark, holds until released, zooms back and never repeats', () => {
    const r = new LandmarkReveal([rathaus]);
    expect(r.update(0.1, 0, 40, true)).toBeNull();
    expect(r.update(0.1, 0, 13 + REVEAL_NEAR - 1, true)).not.toBeNull();
    expect(r.holding).toBe(false);
    for (let t = 0; t < 30; t += 0.1) r.update(0.1, 0, 20, true);
    expect(r.active && r.holding).toBe(true);
    expect(r.name).toBe('Rathaus Köpenick');
    r.release();
    expect(r.holding).toBe(false);
    let w = 1;
    for (let t = 0; t < REVEAL_OUT + 0.2; t += 0.1) w = r.update(0.1, 0, 20, true)?.weight ?? 0;
    expect(w).toBe(0);
    expect(r.active).toBe(false);
    expect(r.update(0.1, 0, 20, true)).toBeNull();
  });

  it('also starts mid-fight (the game pauses), never for Spätis or a dead hero', () => {
    const r = new LandmarkReveal([rathaus, spati]);
    expect(r.update(0.1, 100, 6, true)).toBeNull();
    expect(r.update(0.1, 0, 20, false)).toBeNull();
    expect(r.update(0.1, 0, 20, true)).not.toBeNull();
  });

  it('looks at the landmark from in front and above once out', () => {
    const r = new LandmarkReveal([{ ...rathaus, rot: 0 }]);
    let p = r.update(0.01, 0, 20, true);
    for (let t = 0; t < REVEAL_IN + 0.5; t += 0.1) p = r.update(0.1, 0, 20, true);
    expect(p!.weight).toBe(1);
    expect(p!.pos.z).toBeGreaterThan(20);
    expect(p!.pos.y).toBeGreaterThan(p!.look.y + 10);
    expect(p!.look.x).toBe(0);
  });
});

describe('reveal framing (Codex review)', () => {
  it('fits every landmark from its ground to its top into the view, landscape and portrait', async () => {
    const { PerspectiveCamera, Vector3 } = await import('three');
    const { koepenickMap } = await import('../data/koepenick');
    const { heightAt } = await import('../data/map');
    const { FOV } = await import('./camera');
    const { revealPose } = await import('./reveal');
    const m = koepenickMap();
    const tops: Record<string, number> = { rathaus: 44, kirche: 40.5, mueggelturm: 33, riesenrad: 38, sbahnhof: 10, schloss: 17.5, forum: 15 };
    for (const aspect of [16 / 9, 0.56]) {
      for (const l of m.landmarks.filter((k) => tops[k.kind] !== undefined)) {
        const base = heightAt(m, l.x, l.z);
        const p = revealPose(l, 3, 1, { weight: 0, pos: new Vector3(), look: new Vector3() }, base, aspect);
        const cam = new PerspectiveCamera(FOV, aspect, 1, 450); // camera.ts REVEAL_FAR
        cam.position.copy(p.pos);
        cam.lookAt(p.look);
        cam.updateMatrixWorld();
        for (const y of [base, base + tops[l.kind]!]) {
          const v = new Vector3(l.x, y, l.z).project(cam);
          expect(Math.abs(v.y), `${l.kind} y=${y.toFixed(1)} aspect ${aspect.toFixed(2)}`).toBeLessThan(1);
          expect(v.z, `${l.kind} beyond far`).toBeLessThan(1);
        }
      }
    }
  });
});
