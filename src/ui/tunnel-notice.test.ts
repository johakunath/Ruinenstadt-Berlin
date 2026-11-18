import { describe, expect, it } from 'vitest';
import { koepenickMap } from '../data/koepenick';
import { tunnelMap } from '../data/tunnel';
import type { Sim } from '../sim/types';
import { tunnelNotice, tunnelObjective } from './tunnel-notice';

describe('M20 tunnel messages', () => {
  const said: string[] = [];
  const ui = { banner: (t: string, s = ''): void => { said.push(`${t}|${s}`); }, toast: (h: string): void => { said.push(h); } };
  it('grating, generator and power lines on the tunnel; nothing elsewhere', () => {
    said.length = 0;
    tunnelNotice({ type: 'gateOpen', index: 0, x: 0, z: 0 }, tunnelMap(), ui);
    tunnelNotice({ type: 'holdStart', index: 5, x: 0, z: 0 }, tunnelMap(), ui);
    tunnelNotice({ type: 'power', index: 5, x: 0, z: 0 }, tunnelMap(), ui);
    expect(said[0]).toContain('Gitter offen');
    expect(said[0]).toContain('Warschauer Straße');
    expect(said[1]).toBe('Generator anwerfen|Bleib im Ring');
    expect(said[2]).toMatch(/^Strom!/);
    tunnelNotice({ type: 'gateOpen', index: 0, x: 0, z: 0 }, tunnelMap(1), ui);
    expect(said[3]).toContain('Alexanderplatz');
    tunnelNotice({ type: 'gateOpen', index: 0, x: 0, z: 0 }, koepenickMap(1), ui);
    tunnelNotice({ type: 'victory' }, tunnelMap(), ui);
    expect(said).toHaveLength(4);
  });
  it('objective while charging', () => {
    const sim = { run: { phase: 'hold', hold: { p: 12.4, need: 35, inside: true, sp: 1, elite: false } } } as unknown as Sim;
    expect(tunnelObjective(sim)).toBe('Generator · 12/35 s');
    sim.run.hold!.inside = false;
    expect(tunnelObjective(sim)).toBe('Zurück in den Ring');
    sim.run.phase = 'fight';
    expect(tunnelObjective(sim)).toBeNull();
  });
});
