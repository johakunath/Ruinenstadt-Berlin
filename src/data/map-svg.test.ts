import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { koepenickMap } from './koepenick';
import { generateLots } from './map';
import { mapSvg } from './map-svg';

describe('map svg', () => {
  it('draws the Köpenick map (MAP_SVG=path writes the review image)', () => {
    const m = koepenickMap(Number(process.env.MAP_SCALE ?? 1));
    const svg = mapSvg(m, generateLots(m), { trees: true });
    expect(svg).toContain('Rathausplatz');
    if (process.env.MAP_SVG) writeFileSync(process.env.MAP_SVG, svg);
  });
  it('in-game map has no fight circles, route or encounter names, and labels do not repeat', () => {
    const m = koepenickMap(1);
    const svg = mapSvg(m, generateLots(m), { trees: false, encounters: false });
    expect(svg).not.toContain('Rathausplatz');
    expect(svg).not.toContain('stroke-dasharray="4 3"');
    expect(svg.match(/>Spree</g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
