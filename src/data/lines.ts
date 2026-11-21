// M20: the S+U network between the districts, ported from 2D `js/ubahn.js` (LINES, STN, NETP, NETL,
// NETB). Line k runs from district k to k + 1 and is the gate between them: free district k, clear its
// line, then district k + 1 opens. The 3D district list (migration Q8) differs from 2D after
// Alexanderplatz; the camp is at S+U Warschauer Straße in Xhain (district 1). A cleared line is stored in
// `camp.freed` as LINE_FREED + k (M19). M16 (decision C3): line 3 is the U2 running on from U Potsdamer
// Platz to S+U Zoologischer Garten (ghost station Bülowstraße), so lines 2 and 3 both carry the U2 badge
// (ids are labels only); Charlottenburg sits west of Mitte on the schematic and ends the network: Spandau
// and Marzahn (2D stops 5 and 6, lines U7 and S5) are gone (Johannes, 2026-11-20); the schematic is scaled
// by 1.4 about its middle to fill the board.
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
];

/** Districts on the network map. `map`: the 3D page that plays it (`?map=`), absent while it is not built. */
export interface NetStop { readonly name: string; readonly station: string; readonly map?: string; readonly at: readonly [number, number] }
export const STOPS: readonly NetStop[] = [
  { name: 'Köpenick', station: 'S Köpenick', map: 'koepenick', at: [364, 205] },
  { name: 'Xhain', station: 'S+U Warschauer Straße', map: 'xhain', at: [238, 135] },
  { name: 'Alexanderplatz', station: 'U Alexanderplatz', map: 'alex', at: [189, 65] },
  { name: 'Mitte', station: 'U Potsdamer Platz', map: 'mitte', at: [119, 100] },
  { name: 'Charlottenburg', station: 'S+U Zoologischer Garten', at: [35, 149] },
];
/** Line routes (45° schematic, viewBox 400 × 250) and badge positions, 2D's scaled by 1.4. */
export const NET_ROUTES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[364, 205], [308, 205], [238, 135]],
  [[238, 135], [238, 114], [189, 65]],
  [[189, 65], [154, 65], [119, 100]],
  [[119, 100], [70, 149], [35, 149]],
];
export const NET_BADGES: ReadonlyArray<readonly [number, number]> = [[309, 222], [259, 107], [158, 45], [112, 145]];

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
