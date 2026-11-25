// The one gamepad every reader uses (game input, menus, start screen). Steam Deck playtest 2026-11-25:
// a browser can list several pads (the Deck's own controller next to Steam's virtual one), and the first
// in the list is not always the one that moves. The chosen pad is kept while it is connected; another pad
// takes over only when the chosen one is idle and the other is pressed or moved. Without a choice, a
// standard-mapped pad wins over others. Keeping the choice matters: two pads that carry the same input
// would otherwise swap every frame, and a held button would count as a new press on every swap.

type PadLike = Pick<Gamepad, 'connected' | 'mapping' | 'index' | 'axes' | 'buttons'>;

/** A button pressed or a stick pushed past half way. */
export function padActive(p: Pick<Gamepad, 'axes' | 'buttons'>): boolean {
  return p.buttons.some((b) => b.pressed || b.value > 0.5) || p.axes.some((a) => Math.abs(a) > 0.5);
}

/**
 * The pad to read from a `navigator.getGamepads()` list; null when none is connected. `prev` is the index
 * chosen last time (-1 for none).
 */
export function pickPad<P extends PadLike>(pads: ReadonlyArray<P | null>, prev: number): P | null {
  const live = pads.filter((p): p is P => !!p?.connected);
  const kept = live.find((p) => p.index === prev);
  if (kept) return padActive(kept) ? kept : live.find((p) => p !== kept && padActive(p)) ?? kept;
  return live.find((p) => padActive(p)) ?? live.find((p) => p.mapping === 'standard') ?? live[0] ?? null;
}

let chosen = -1;

export function activePad(): Gamepad | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
  const pad = pickPad(navigator.getGamepads(), chosen);
  chosen = pad ? pad.index : -1;
  return pad;
}
