import { describe, expect, it } from 'vitest';
import { koepenickMap } from './koepenick';
import { heightAt, lineDist, onBridge, type Pt } from './map';
import { TRAM_AXLES, TRAM_BOGIES, TRAM_BRIDGE_DECK, TRAM_HEAD_HEIGHT, TRAM_WHEEL_OFFSET, TRAM_WHEEL_RADIUS } from './tram';
import { tramOffsetPoint, TRAM_RAILS, TRAM_SECTION } from '../render/tram-rails';

describe('stopped tram alignment', () => {
  for (const scale of [1, 1.3]) {
    it(`puts all sixteen wheel contacts on the running heads, clear of the bend (scale ${scale})`, () => {
      const m = koepenickMap(scale);
      const tram = m.fixedProps.find(p => p.kind === 'tram')!;
      const pts = m.streets.find(s => s.tram)!.pts;
      const rails = TRAM_RAILS.slice(2).map(r => pts.map((_, i) => tramOffsetPoint(pts, i, r.offset)));
      const head = TRAM_SECTION.find(s => s.kind === 'head')!;
      const baseY = heightAt(m, tram.x, tram.z) + TRAM_BRIDGE_DECK + TRAM_HEAD_HEIGHT;
      let contacts = 0;
      for (const bogie of TRAM_BOGIES) for (const axle of TRAM_AXLES) for (const [index, side] of [-1, 1].entries()) {
        const localX = side * TRAM_WHEEL_OFFSET, localZ = bogie + axle;
        const p: Pt = [tram.x + Math.cos(tram.rot) * localX + Math.sin(tram.rot) * localZ,
          tram.z - Math.sin(tram.rot) * localX + Math.cos(tram.rot) * localZ];
        expect(lineDist(rails[index]!, p[0], p[1])).toBeLessThan(1e-8);
        // Every contact must be on the last straight segment, not merely its infinite extension.
        expect(lineDist(rails[index]!.slice(-2), p[0], p[1])).toBeLessThan(1e-8);
        expect(onBridge(m, p[0], p[1])?.name).toBe('Dammbrücke');
        const wheelBottom = baseY + TRAM_WHEEL_RADIUS - TRAM_WHEEL_RADIUS;
        expect(wheelBottom).toBeCloseTo(heightAt(m, p[0], p[1]) + TRAM_BRIDGE_DECK + head.height, 8);
        contacts++;
      }
      expect(contacts).toBe(16);
    });
  }
});
