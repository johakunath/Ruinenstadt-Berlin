// M20 tunnel messages (2D `openGate` toast, generator banners): short German lines for the gratings,
// the generator hold and the power. The game loop calls `tunnelNotice` for every sim event.
import type { MapDef } from '../data/map';
import { stopName } from '../data/lines';
import type { Sim, SimEvent } from '../sim/types';

export interface NoticeSink {
  banner(title: string, sub?: string): void;
  toast(html: string, seconds?: number): void;
}

/** Shows the tunnel's own messages; does nothing on other maps and for other events. */
export function tunnelNotice(ev: SimEvent, def: MapDef | undefined, ui: NoticeSink): void {
  // M17 Fernsehturm: the Schacht's emergency crank is the same hold.
  if (def?.decks) {
    if (ev.type === 'holdStart') ui.banner('Notkurbel halten', 'Bleib im Ring');
    else if (ev.type === 'power') ui.banner('Gekurbelt', 'Sie kommen die Treppe hoch');
    return;
  }
  const T = def?.tunnel;
  if (!T) return;
  switch (ev.type) {
    case 'gateOpen':
      ui.toast(`<span style="color:#ef9f27">Gitter offen</span> · weiter Richtung ${stopName(T.line + 1)}`, 3.5);
      break;
    case 'holdStart':
      ui.banner('Generator anwerfen', 'Bleib im Ring');
      break;
    case 'power':
      ui.banner('Strom!', 'Aus dem Tunnel kommt etwas Großes');
      break;
    default:
      break;
  }
}

/** Objective line while the generator charges (instead of "Welle 1/2"), else null. */
export function tunnelObjective(sim: Sim): string | null {
  const h = sim.run.hold;
  if (sim.run.phase !== 'hold' || !h) return null;
  return h.inside ? `${sim.level?.lifts.length ? 'Notkurbel' : 'Generator'} · ${Math.floor(h.p)}/${h.need} s` : 'Zurück in den Ring';
}
