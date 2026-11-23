import { describe, expect, it } from 'vitest';
import { CUT, cutActive, cutPlan, frontCut, hides, LANDMARK_PART, STOREY, type CutZone } from './cut';
import { generateLots, inPoly, type Lot, type MapDef } from './map';
import { koepenickMap } from './koepenick';
import { xhainMap } from './xhain';
import { FLOOR_H, GROUND_H, PARAPET } from '../render/world';

const altbau = (x: number, z: number, w: number, d: number, floors: number): Lot => ({ kind: 'altbau', x, z, rot: 0, w, d, floors, seed: 1 });

describe('cutaway plan (V1 B)', () => {
  it('uses the storey heights of the builders', () => {
    expect(CUT.floor).toBe(GROUND_H);
    expect(STOREY.ground).toBe(GROUND_H);
    expect(STOREY.floor).toBe(FLOOR_H);
    expect(STOREY.parapet).toBe(PARAPET);
  });

  it('hides only toward the camera (+z) and only with the part above the cut', () => {
    const body = { x: 0, z: 6, rot: 0, hw: 5, hd: 2 };
    expect(hides(0, 0, body, 12, 1.2)).toBe(true);
    expect(hides(0, 12, body, 12, 1.2)).toBe(false); // the body is north of the point
    expect(hides(8, 0, body, 12, 1.2)).toBe(false); // beside it
    expect(hides(0, 0, body, 3, 1.2)).toBe(false); // too low to reach 4 m
    expect(hides(0, 3.5, { ...body, z: 4.25, hd: 0.25 }, 12, 1.2)).toBe(false); // so close that the stub alone hides it
  });

  it('flags the camera-side building and the Quergebäude, never the far side, a side neighbour or a side wing', () => {
    const m = { ...koepenickMap(), landmarks: [], cutStreets: false } as MapDef;
    const lots: Lot[] = [
      { kind: 'special', special: 'hinterhof', x: 0, z: 0, rot: 0, w: 20, d: 20, floors: 0, seed: 1 },
      altbau(0, 13, 20, 6, 2), // 1 south (camera side)
      altbau(0, -13, 20, 6, 2), // 2 north (far side)
      altbau(13, 0, 6, 20, 2), // 3 east neighbour
      altbau(0, -4, 20, 4, 1), // 4 Quergebäude
      altbau(7.5, 1, 5, 6, 1), // 5 side wing between the yards
      { kind: 'tree', x: 0, z: 8, rot: 0, w: 5, d: 5, floors: 0, seed: 1 },
    ];
    const plan = cutPlan(m, lots);
    expect(plan.zones).toHaveLength(1);
    expect(plan.zones[0]!.parts.sort()).toEqual([1, 4]);
    expect(plan.parts.every((p) => p.kind === 'lot' && p.h === CUT.yard)).toBe(true);
    expect(cutPlan(m, lots, { yard: 4.3 }).zones[0]!.h).toBe(4.3);
    expect(cutPlan(m, lots, { off: true })).toEqual({ zones: [], parts: [] });
  });

  it('gives every Hinterhof a zone and flags Thomaskirche and Bethanien in Xhain', () => {
    for (const m of [koepenickMap(), xhainMap()]) {
      const lots = generateLots(m);
      const plan = cutPlan(m, lots);
      const yards = lots.filter((l) => l.special === 'hinterhof');
      expect(yards.length).toBeGreaterThan(0);
      expect(plan.zones.filter((z) => z.name.startsWith('hinterhof'))).toHaveLength(yards.length);
      for (const z of plan.zones) if (z.name.startsWith('hinterhof')) expect(z.parts.length).toBeGreaterThan(0);
      // Ids are unique; lot parts are buildings.
      expect(new Set(plan.parts.map((p) => p.id)).size).toBe(plan.parts.length);
      for (const p of plan.parts) if (p.kind === 'lot') expect(['altbau', 'shop', 'house', 'platte']).toContain(lots[p.index]!.kind);
    }
    const m = xhainMap(), plan = cutPlan(m, generateLots(m));
    for (const kind of ['thomaskirche', 'bethanien'] as const) {
      const i = m.landmarks.findIndex((l) => l.kind === kind), l = m.landmarks[i]!;
      expect(plan.parts.find((p) => p.id === LANDMARK_PART + i)).toMatchObject({ kind: 'landmark', index: i, h: CUT.floor });
      const zone = plan.zones.find((z) => z.parts.includes(LANDMARK_PART + i))!;
      // Behind it (north, away from the camera) is in the zone, in front of it is not.
      expect(inPoly(zone.poly, l.x, l.z - Math.max(l.hx, l.hz) - 8)).toBe(true);
      expect(inPoly(zone.poly, l.x, l.z + Math.max(l.hx, l.hz) + 6)).toBe(false);
    }
  });

  it('cuts street-front buildings on the camera side of a street only on maps with cutStreets (P42)', () => {
    const street = { name: 's', kind: 'side' as const, width: 6, pts: [[-20, 0], [20, 0]] as Array<[number, number]> };
    const m = { ...koepenickMap(), landmarks: [], encounters: [], streets: [street], cutStreets: true } as MapDef;
    const lots: Lot[] = [
      altbau(0, 9, 12, 8, 2), // 0 south of the street (camera side): hides its north half
      altbau(0, -9, 12, 8, 2), // 1 north of the street: never in front of it
      { kind: 'shop', x: -14, z: 8, rot: 0, w: 6, d: 6, floors: 0, seed: 1 }, // 2 a parapet alone is not worth a cut
    ];
    const plan = cutPlan(m, lots);
    expect(plan.parts).toEqual([{ id: 0, kind: 'lot', index: 0, h: CUT.floor }]);
    const zone = plan.zones[0]!;
    expect(inPoly(zone.poly, 0, -2)).toBe(true); // on the street behind it
    expect(inPoly(zone.poly, 0, 16)).toBe(false); // in front of it
    expect(cutPlan({ ...m, cutStreets: false }, lots).parts).toEqual([]);
    expect(frontCut({ ...lots[0]!, kind: 'house' })).toBe(STOREY.house);
  });

  it('cuts the Köpenick sights the route passes behind (P42)', () => {
    const m = koepenickMap(), plan = cutPlan(m, generateLots(m));
    for (const [kind, h] of [['rathaus', 2], ['schloss', CUT.floor], ['kirche', CUT.floor], ['mueggelturm', CUT.floor]] as const) {
      const i = m.landmarks.findIndex((l) => l.kind === kind);
      expect(plan.parts.find((p) => p.id === LANDMARK_PART + i)).toMatchObject({ kind: 'landmark', h });
    }
    expect(plan.zones.filter((z) => z.name.startsWith('front')).length).toBeGreaterThan(5);
  });

  it('switches on inside a zone and off only beyond the leave margin', () => {
    const zone: CutZone = { name: 'z', poly: [[0, 0], [0, 10], [10, 10], [10, 0]], h: 1.2, parts: [] };
    expect(cutActive(zone, 5, 5, false)).toBe(true);
    expect(cutActive(zone, 10.5, 5, false)).toBe(false);
    expect(cutActive(zone, 10.5, 5, true)).toBe(true);
    expect(cutActive(zone, 10 + CUT.leave + 0.1, 5, true)).toBe(false);
  });
});
