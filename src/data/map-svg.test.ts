import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { koepenickMap } from './koepenick';
import { xhainMap } from './xhain';
import { mitteMap } from './mitte';
import { alexMap } from './alexanderplatz';
import { charlottenburgMap } from './charlottenburg';
import { generateLots } from './map';
import { mapSvg } from './map-svg';

describe('map svg', () => {
  it('draws the Köpenick map (MAP_SVG=path writes the review image)', () => {
    const m = koepenickMap(Number(process.env.MAP_SCALE ?? 1));
    const svg = mapSvg(m, generateLots(m), { trees: true });
    expect(svg).toContain('Rathausplatz');
    if (process.env.MAP_SVG) writeFileSync(process.env.MAP_SVG, svg);
  });
  it('draws the Xhain map (XHAIN_SVG=path writes the review image)', () => {
    const m = xhainMap(Number(process.env.MAP_SCALE ?? 1));
    const svg = mapSvg(m, generateLots(m), { trees: true });
    expect(svg).toContain('Oberbaumbrücke');
    if (process.env.XHAIN_SVG) writeFileSync(process.env.XHAIN_SVG, svg);
  });
  it('draws the Mitte map (MITTE_SVG=path writes the review image)', () => {
    const m = mitteMap(Number(process.env.MAP_SCALE ?? 1));
    const svg = mapSvg(m, generateLots(m), { trees: true });
    expect(svg).toContain('Sony Center');
    if (process.env.MITTE_SVG) writeFileSync(process.env.MITTE_SVG, svg);
  });
  it('draws the Alexanderplatz map (ALEX_SVG=path writes the review image)', () => {
    const m = alexMap(Number(process.env.MAP_SCALE ?? 1));
    const svg = mapSvg(m, generateLots(m), { trees: true });
    expect(svg).toContain('Weltzeituhr');
    if (process.env.ALEX_SVG) writeFileSync(process.env.ALEX_SVG, svg);
  });
  it('draws the Charlottenburg map (CHARLOTTENBURG_SVG=path writes the review image)', () => {
    const m = charlottenburgMap(Number(process.env.MAP_SCALE ?? 1));
    const svg = mapSvg(m, generateLots(m), { trees: true });
    expect(svg).toContain('Ehrenhof');
    if (process.env.CHARLOTTENBURG_SVG) writeFileSync(process.env.CHARLOTTENBURG_SVG, svg);
  });
  it('in-game map has no fight circles, route or encounter names, and labels do not repeat', () => {
    const m = koepenickMap(1);
    const svg = mapSvg(m, generateLots(m), { trees: false, encounters: false });
    expect(svg).not.toContain('Rathausplatz');
    expect(svg).not.toContain('stroke-dasharray="4 3"');
    expect(svg.match(/>Spree</g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
