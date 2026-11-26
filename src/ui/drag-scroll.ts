// Drag to scroll with a mouse pointer (Steam Deck playtest 2026-11-26): in Game Mode Steam turns the
// touchscreen into a mouse, so a finger drag in Optionen or a menu list did not scroll, and the release
// counted as a click. A mouse drag that starts on an empty part of a scrollable list now scrolls it the
// way a finger does on the tablet, and the click that ends the drag is swallowed. Controls (buttons,
// sliders, items, the inventory doll) keep their own drag.

const SKIP = 'button,input,select,textarea,a,summary,canvas,[draggable="true"],[role=button],.cell';
const SLOP = 8;

/** The nearest ancestor that scrolls vertically and has more to show. */
export function scrollParent(el: Element | null): HTMLElement | null {
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    if (!(e instanceof HTMLElement)) continue;
    const oy = getComputedStyle(e).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e;
  }
  return null;
}

/** True when a press that started at `down` and ended at `up` stayed a tap (not a drag). */
export function isTap(down: { x: number; y: number } | null, up: { x: number; y: number }): boolean {
  return !!down && Math.hypot(up.x - down.x, up.y - down.y) <= SLOP;
}

export function initDragScroll(): void {
  let drag: { el: HTMLElement; id: number; y: number; top: number; moved: boolean } | null = null;
  let swallow = false;
  document.addEventListener('pointerdown', (e) => {
    swallow = false;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const t = e.target as Element | null;
    if (!t || t.closest(SKIP)) return;
    const el = scrollParent(t);
    if (el) drag = { el, id: e.pointerId, y: e.clientY, top: el.scrollTop, moved: false };
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) <= SLOP) return;
    drag.moved = true;
    drag.el.scrollTop = drag.top - dy;
  }, true);
  const end = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    swallow = drag.moved;
    drag = null;
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);
  // The click after a drag would press what is under the pointer or close the screen.
  document.addEventListener('click', (e) => {
    if (!swallow) return;
    swallow = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

/** Seconds since the last poll, for `stickScroll` (callers poll at 30, 60 or 90 Hz); 0 on the first poll or after a pause. */
export function pollDt(now: number, last: number): number {
  return last > 0 && now > last ? Math.min(0.1, (now - last) / 1000) : 0;
}

/** Right stick (axis 3) scrolls a list, for pad players in long screens; `dt` in seconds since the last poll. */
export function stickScroll(el: HTMLElement | null, ry: number, dt: number): void {
  if (!el || Math.abs(ry) < 0.25) return;
  el.scrollTop += Math.sign(ry) * (Math.abs(ry) - 0.25) / 0.75 * 1100 * dt;
}

/**
 * Closes a screen on a tap on its backdrop (`root` itself). A press that started inside the panel or
 * dragged (a finger scroll that Steam sends as a mouse drag) does not close it.
 */
export function closeOnTap(root: HTMLElement, close: () => void): void {
  let down: { x: number; y: number } | null = null;
  root.addEventListener('pointerdown', (e) => { down = e.target === root ? { x: e.clientX, y: e.clientY } : null; });
  root.addEventListener('click', (e) => {
    if (e.target === root && isTap(down, { x: e.clientX, y: e.clientY })) close();
    down = null;
  });
}
