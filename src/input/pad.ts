// The one gamepad every reader uses (game input, menus, start screen). Steam Deck playtest 2026-11-25:
// a browser can list several pads (the Deck's own controller next to Steam's virtual one), and the first
// in the list is not always the one that moves. Standard mapping wins, then the pad with the latest input.

type PadLike = Pick<Gamepad, 'connected' | 'mapping' | 'timestamp'>;

/** The pad to read from a `navigator.getGamepads()` list; null when none is connected. */
export function pickPad<P extends PadLike>(pads: ReadonlyArray<P | null>): P | null {
  let best: P | null = null;
  for (const p of pads) {
    if (!p?.connected) continue;
    if (!best) { best = p; continue; }
    const ps = p.mapping === 'standard', bs = best.mapping === 'standard';
    if (ps !== bs ? ps : p.timestamp > best.timestamp) best = p;
  }
  return best;
}

export function activePad(): Gamepad | null {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? pickPad(navigator.getGamepads()) : null;
}
