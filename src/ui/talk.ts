// Talk prompt (playtest 2026-11-17): trading starts on a press, not by walking into the trader.
// A button above the action arc while a trader or Späti keeper is in reach; it names the key per device.
import './talk.css';
import type { Device } from '../input/input';

const KEY: Record<Device, string> = { keyboard: 'F', mouse: 'F', gamepad: 'Y', touch: '' };

export class TalkPrompt {
  private readonly el = document.createElement('button');
  private shown = false;
  private label = '';

  constructor(onTalk: () => void) {
    this.el.id = 'talk-btn';
    this.el.type = 'button';
    this.el.hidden = true;
    this.el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onTalk(); });
    document.body.appendChild(this.el);
  }

  /** M20 camp: a free label (station name and what it does), null hides. */
  say(text: string | null, visible: boolean, device: Device): void {
    const show = visible && text !== null;
    if (show !== this.shown) { this.shown = show; this.el.hidden = !show; }
    if (!show) return;
    const key = KEY[device];
    const label = `${key ? `<kbd>${key}</kbd>` : ''}${text}`;
    if (label !== this.label) { this.label = label; this.el.innerHTML = label; }
  }

  /** `who`: -1 trader, a rest index for a Späti, null nobody in reach. */
  update(who: number | null | undefined, visible: boolean, device: Device): void {
    const show = visible && who != null;
    if (show !== this.shown) { this.shown = show; this.el.hidden = !show; }
    if (!show) return;
    const key = KEY[device];
    const label = `${key ? `<kbd>${key}</kbd>` : ''}${who === -1 ? 'Händler' : 'Späti'} · Handeln`;
    if (label !== this.label) { this.label = label; this.el.innerHTML = label; }
  }
}
