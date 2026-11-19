// M20: the S+U network between the districts, ported from 2D `js/ubahn.js` (LINES, STN, NETP, NETL,
// NETB). Line k runs from district k to k + 1 and is the gate between them: free district k, clear its
// line, then district k + 1 opens. The 3D district list (migration Q8) differs from 2D after
// Alexanderplatz; the camp is at S+U Warschauer Straße in Xhain (district 1). A cleared line is stored in
// `camp.freed` as LINE_FREED + k (M19). M16 (decision C3): line 3 is the U2 running on from U Potsdamer
// Platz to S+U Zoologischer Garten (ghost station Bülowstraße), so lines 2 and 3 both carry the U2 badge
// (ids are labels only); Charlottenburg sits west of Mitte on the schematic. Stops 5 and 6 and lines 4 and 5
// are still the 2D ones (C5 proposes the Fernsehturm finale instead).
export interface LineDef {
  /** Badge: S3, U8, ... */
  readonly id: string;
  /** Line color (BVG). */
  readonly color: string;
  /** Ghost station in the middle of the tunnel. */
  readonly ghost: string;
}

export const LINES: readonly LineDef[] = [
  { id: 'S3', color: '#2a8a3a', ghost: 'Rummelsburg' },
  { id: 'U8', color: '#224f86', ghost: 'Heinrich-Heine-Straße' },
  { id: 'U2', color: '#da421e', ghost: 'Klosterstraße' },
  { id: 'U2', color: '#da421e', ghost: 'Bülowstraße' },
  { id: 'U7', color: '#528dba', ghost: 'Mierendorffplatz' },
  { id: 'S5', color: '#e3801c', ghost: 'Biesdorf' },
];

/** Districts on the network map. `map`: the 3D page that plays it (`?map=`), absent while it is not built. */
export interface NetStop { readonly name: string; readonly station: string; readonly map?: string; readonly at: readonly [number, number] }
export const STOPS: readonly NetStop[] = [
  { name: 'Köpenick', station: 'S Köpenick', map: 'koepenick', at: [340, 190] },
  { name: 'Xhain', station: 'S+U Warschauer Straße', map: 'xhain', at: [250, 140] },
  { name: 'Alexanderplatz', station: 'U Alexanderplatz', map: 'alex', at: [215, 90] },
  { name: 'Mitte', station: 'U Potsdamer Platz', map: 'mitte', at: [165, 115] },
  { name: 'Charlottenburg', station: 'S+U Zoologischer Garten', at: [105, 150] },
  { name: 'Spandau', station: 'U Rathaus Spandau', at: [45, 120] },
  { name: 'Marzahn', station: 'S Marzahn', at: [330, 60] },
];
/** Line routes (45° schematic, viewBox 400 × 250) and badge positions, as in 2D. */
export const NET_ROUTES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[340, 190], [300, 190], [250, 140]],
  [[250, 140], [250, 125], [215, 90]],
  [[215, 90], [190, 90], [165, 115]],
  [[165, 115], [130, 150], [105, 150]],
  [[105, 150], [80, 125], [50, 125], [45, 120]],
  [[45, 120], [45, 40], [310, 40], [330, 60]],
];
export const NET_BADGES: ReadonlyArray<readonly [number, number]> = [[301, 202], [265, 120], [193, 76], [160, 147], [68, 113], [180, 32]];

/** `camp.freed` holds districts (0 Köpenick) and cleared lines as LINE_FREED + k. */
export const LINE_FREED = 100;
/** The walkable camp opens when the S3 tunnel reaches Warschauer Straße (Johannes, 2026-11-18, F1). */
export const campOpen = (freed: readonly number[] | undefined): boolean => !!freed?.includes(LINE_FREED);
/** A line can be ridden once its start district is freed and its end has a 3D map. */
export const linePlayable = (k: number, freed: readonly number[] | undefined): boolean => !!freed?.includes(k) && !!STOPS[k + 1]?.map;
/**
 * The next place the story leads (playtest 2026-11-18: the board and the main button went back to
 * Köpenick): district k, then line k, in order; the first one not yet freed that can be played.
 */
export function nextDestination(freed: readonly number[] | undefined): { stop: number } | { line: number } {
  const f = freed ?? [];
  for (let k = 0; k < STOPS.length; k++) {
    if (STOPS[k]!.map && !f.includes(k)) return { stop: k };
    if (k < LINES.length && linePlayable(k, f) && !f.includes(LINE_FREED + k)) return { line: k };
  }
  return { stop: 0 };
}
/** Short station name without the S/U prefix ("Warschauer Straße"). */
export const stopName = (k: number): string => STOPS[k]!.station.replace(/^[SU+ ]+/, '');
