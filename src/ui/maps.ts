// Which map a page shows and where its title and victory buttons lead (M19 tunnel, M15 Xhain).
// Each map is its own page load (`?map=`); the chain follows the story: Köpenick freed opens the
// S3 tunnel, the tunnel ends at Warschauer Straße where Xhain starts and the walkable camp (M20) is.
export type MapId = 'koepenick' | 'tunnel' | 'xhain' | 'alex' | 'mitte' | 'charlottenburg' | 'hof' | 'lager';

/** `MapDef.name` of each map (a saved run belongs to the map with this name). */
export const MAP_NAME: Record<MapId, string> = { koepenick: 'Köpenick', tunnel: 'S3-Tunnel', xhain: 'Xhain', alex: 'Alexanderplatz', mitte: 'Mitte', charlottenburg: 'Charlottenburg', hof: 'Hof', lager: 'S+U Warschauer Straße' };
/** Line under the title. */
export const MAP_SUB: Record<MapId, string> = {
  koepenick: 'Köpenick bei Nacht',
  tunnel: 'S3-Tunnel · Richtung Warschauer Straße',
  xhain: 'Xhain · 1981',
  alex: 'Alexanderplatz · 1989',
  mitte: 'Mitte · 2089',
  charlottenburg: 'Charlottenburg · 1920',
  hof: 'Köpenick · Hinterhof bei Nacht',
  lager: 'S+U Warschauer Straße · Lager',
};
/** Small line of the Losziehen button. */
export const MAP_PLAY: Record<MapId, string> = {
  koepenick: 'Neue Expedition durch Köpenick',
  tunnel: 'Durch den S3-Tunnel',
  xhain: 'Neue Expedition durch Xhain',
  alex: 'Neue Expedition zum Alex',
  mitte: 'Neue Expedition durch Mitte',
  charlottenburg: 'Neue Expedition durch Charlottenburg',
  hof: 'Hinterhof',
  lager: 'Lager',
};
/** What a won run is called. */
export const MAP_WON: Record<MapId, string> = { koepenick: 'Köpenick befreit', tunnel: 'S3 frei', xhain: 'Xhain befreit', alex: 'Alex befreit', mitte: 'Mitte befreit', charlottenburg: 'Charlottenburg frei', hof: 'Hof frei', lager: '' };
/** `camp.freed` id of a won map: districts by index, U-Bahn lines from 100. */
/** The camp is never won (-1). */
export const MAP_FREED: Record<MapId, number> = { koepenick: 0, tunnel: 100, xhain: 1, alex: 2, mitte: 3, charlottenburg: 4, hof: 0, lager: -1 };

export interface MapLink { id: 'go-tunnel' | 'go-xhain'; to: MapId; html: string }

/** Map switch buttons on the title of `map`, given the freed districts and lines. */
export function titleLinks(map: MapId, freed: readonly number[]): MapLink[] {
  const out: MapLink[] = [];
  const xhain: MapLink = { id: 'go-xhain', to: 'xhain', html: '<b>Xhain</b><small>1981 · Über die Mauer</small>' };
  if (map === 'koepenick') {
    if (freed.includes(0)) out.push({ id: 'go-tunnel', to: 'tunnel', html: '<b>S3-Tunnel</b><small>Köpenick → Warschauer Straße</small>' });
    if (freed.includes(100)) out.push(xhain);
  } else if (map === 'tunnel') {
    out.push({ id: 'go-tunnel', to: 'koepenick', html: '<b>Zurück nach Köpenick</b><small>Ausrüstung bleibt</small>' });
    if (freed.includes(100)) out.push(xhain);
  } else if (map === 'xhain' || map === 'alex' || map === 'mitte') {
    out.push({ id: 'go-tunnel', to: 'koepenick', html: '<b>Köpenick</b><small>Ausrüstung bleibt</small>' });
  }
  return out;
}

/** The map the victory screen leads on to (`line`: the tunnel line won or to ride). M15: Xhain → U8 → Alexanderplatz → U2 → Mitte. */
export function wonLink(map: MapId, line = 0): { to: MapId; line?: number; html: string } | null {
  if (map === 'koepenick') return { to: 'tunnel', html: '<b>In den S3-Tunnel</b><small>Richtung Warschauer Straße</small>' };
  if (map === 'tunnel' && line === 2) return { to: 'mitte', html: '<b>Weiter nach Mitte</b><small>Ausstieg Potsdamer Platz</small>' };
  if (map === 'tunnel' && line === 1) return { to: 'alex', html: '<b>Weiter zum Alex</b><small>Ausstieg Alexanderplatz</small>' };
  if (map === 'tunnel') return { to: 'xhain', html: '<b>Weiter nach Xhain</b><small>Ausstieg Warschauer Straße</small>' };
  if (map === 'xhain') return { to: 'tunnel', line: 1, html: '<b>In die U8</b><small>Richtung Alexanderplatz</small>' };
  if (map === 'alex') return { to: 'tunnel', line: 2, html: '<b>In die U2</b><small>Richtung Potsdamer Platz</small>' };
  if (map === 'mitte') return { to: 'koepenick', html: '<b>Zurück nach Köpenick</b><small>Ausrüstung bleibt</small>' };
  return null;
}

/** Shows the title map buttons (both hidden when none applies). */
export function showTitleLinks(map: MapId, freed: readonly number[]): void {
  const links = titleLinks(map, freed);
  for (const id of ['go-tunnel', 'go-xhain'] as const) {
    const b = document.getElementById(id);
    if (!b) continue;
    const l = links.find((k) => k.id === id);
    b.hidden = !l;
    if (l) { b.innerHTML = l.html; b.dataset.to = l.to; }
  }
}
