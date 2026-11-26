// U3: focus navigation shared by the start screen, the options screen and the pause menu.
// Arrow keys, D-pad and stick move to the nearest control in that direction; A presses, B goes back.
import { activePad } from '../input/pad';
import { scrollParent, stickScroll } from './drag-scroll';

// SVG places on the title's network map count too (Codex review, PR #57: no pad path to them).
const FOCUSABLE = 'button:not(:disabled),input,summary,svg g[role=button]:not(.lock)';

/** Visible controls inside `root` (SVG elements have no offsetParent: their boxes decide). */
export function controls(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(b => (b instanceof HTMLElement ? b.offsetParent !== null : (b as Element).getClientRects().length > 0) && !b.closest('[hidden]'));
}
/** Presses a control; SVG elements have no click(). */
export function press(a: Element): void {
  if (a instanceof HTMLElement) a.click(); else a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** Spatial focus move: nearest visible control in the direction, rows and columns alike. */
export function moveFocus(root: HTMLElement, dx: number, dy: number, first?: () => void): void {
  const cur = document.activeElement as HTMLElement | null;
  const all = controls(root);
  if (!cur || !root.contains(cur) || cur === root) { if (first) first(); else all[0]?.focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  // Option cards: up and down go card by card, whatever the width of the control in it.
  const rowY = (b: HTMLElement): number | null => { const o = b.closest('.orow'); if (!o) return null; const q = o.getBoundingClientRect(); return q.top + q.height / 2; };
  const curRow = dy ? rowY(cur) : null;
  let best: HTMLElement | null = null, bestS = Infinity;
  for (const b of all) {
    if (b === cur) continue;
    const q = b.getBoundingClientRect(), vx = q.left + q.width / 2 - cx, vy = q.top + q.height / 2 - cy;
    const row = curRow !== null ? rowY(b) : null;
    const along = row !== null && curRow !== null ? (row - curRow) * dy : vx * dx + vy * dy;
    if (along <= 2) continue;
    const score = along + Math.abs(dx ? vy : vx) * (row !== null ? 0.01 : 2.5);
    if (score < bestS) { bestS = score; best = b; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

/** Keyboard inside a screen: arrows move, Tab wraps, Escape goes back. */
export function keyNav(root: HTMLElement, back: () => void): void {
  root.addEventListener('keydown', e => {
    if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); back(); return; }
    if (e.code === 'Tab') {
      const all = controls(root), i = all.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); all.at(-1)?.focus(); } else if (!e.shiftKey && i === all.length - 1) { e.preventDefault(); all[0]?.focus(); }
      return;
    }
    // A range slider keeps its own left/right.
    if (!e.code.startsWith('Arrow') || (e.target instanceof HTMLInputElement && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) return;
    e.preventDefault();
    moveFocus(root, e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0, e.code === 'ArrowUp' ? -1 : e.code === 'ArrowDown' ? 1 : 0);
  });
}

/** Pad for one screen. `reset` ignores buttons held when the screen opens (the press that opened it). */
export class PadNav {
  private down: boolean[] = [];
  private next = 0;
  constructor(private readonly root: HTMLElement, private readonly active: () => boolean, private readonly back?: () => void) {}
  reset(): void { this.down = Array.from({ length: 20 }, () => true); }
  poll(now: number): void {
    const pad = activePad();
    if (!pad) { this.down = []; return; }
    const down = pad.buttons.map(b => b.pressed), prev = this.down, edge = (i: number): boolean => !!down[i] && !prev[i];
    this.down = down;
    if (!this.active()) return;
    if (edge(1) && this.back) { this.back(); return; }
    if (edge(0)) { const a = document.activeElement as HTMLElement | null; if (a && this.root.contains(a) && a !== this.root) press(a); else controls(this.root)[0]?.focus(); return; }
    // Right stick scrolls the screen (Steam Deck playtest 2026-11-26).
    const f = document.activeElement;
    stickScroll(scrollParent(f && this.root.contains(f) ? f : this.root) ?? scrollParent(this.root), pad.axes[3] ?? 0);
    if (now < this.next) return;
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const dx = down[14] || ax < -.5 ? -1 : down[15] || ax > .5 ? 1 : 0, dy = down[12] || ay < -.5 ? -1 : down[13] || ay > .5 ? 1 : 0;
    if (!dx && !dy) return;
    this.next = now + 170;
    moveFocus(this.root, dx, dy);
  }
}
