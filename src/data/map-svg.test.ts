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
});
