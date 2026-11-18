// DOM overlay: HUD, touch controls, end screens, perf readout. Text is German and short. The title is
// the start screen (`start.ts`), the options are their own screen (`options-screen.ts`, U3).
import type { Input } from '../input/input';
import type { Options } from '../options';
import type { DifficultyId } from '../data/difficulty';
import { startScreen } from './start';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export interface UiHandlers {
  onPlay(): void;
  onRetry(): void;
  onResume(): void;
  onDifficulty(id: DifficultyId): void;
  /** Pause button: opens the menu. */
  onMenu(): void;
}

export class Ui {
  private readonly hpFill = el<HTMLDivElement>('hp-fill');
  private readonly kills = el<HTMLElement>('kills');
  private readonly perf = el<HTMLPreElement>('perf');
  private readonly hurt = el<HTMLDivElement>('hurt');
  private lastHp = -1;
  private lastMaxHp = -1;
  private lastKills = -1;
  private lastObjective = '';
  private lastArrow = 999;
  private lastBoss = -1;

  constructor(opts: Options, handlers: UiHandlers, input: Input) {
    el<HTMLButtonElement>('play').addEventListener('click', () => handlers.onPlay());
    el<HTMLButtonElement>('resume').addEventListener('click', () => handlers.onResume());
    startScreen().onDifficulty = (id) => handlers.onDifficulty(id);
    el<HTMLButtonElement>('retry').addEventListener('click', () => handlers.onRetry());
    el<HTMLButtonElement>('menu-btn').addEventListener('click', () => handlers.onMenu());
    this.perf.hidden = !opts.showPerf;
    this.setupTouch(input);
  }

  /** Leistungsanzeige switched in the options. */
  showPerf(on: boolean): void {
    this.perf.hidden = !on;
  }

  /** Expedition: objective line. */
  setExpedition(on: boolean): void {
    el('objective').hidden = !on;
  }

  /** Objective text and an arrow pointing to it (screen angle in radians, 0 = up). */
  objective(text: string, angle: number | null): void {
    if (text !== this.lastObjective) {
      this.lastObjective = text;
      el('obj-text').textContent = text;
    }
    const arrow = el('obj-arrow');
    if (angle === null) {
      arrow.style.visibility = 'hidden';
      this.lastArrow = 999;
    } else if (Math.abs(angle - this.lastArrow) > 0.02) {
      this.lastArrow = angle;
      arrow.style.visibility = 'visible';
      // The glyph ➤ points right; an equilateral ▲ has no readable tip once rotated.
      arrow.style.transform = `rotate(${angle - Math.PI / 2}rad)`;
    }
  }

  /** Big centered message that fades out by itself. */
  banner(title: string, sub = '', note = ''): void {
    const b = el('banner');
    el('banner-title').textContent = title;
    el('banner-sub').textContent = sub;
    // M12c: a third line for the map's rule (rain in Mitte).
    el('banner-note').textContent = note;
    el('banner-note').hidden = !note;
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
  }

  /** Boss health bar; null hides it. */
  boss(name: string | null, frac = 0): void {
    const bar = el('bossbar');
    if (name === null) {
      if (!bar.hidden) bar.hidden = true;
      this.lastBoss = -1;
      return;
    }
    if (bar.hidden) {
      bar.hidden = false;
      el('boss-name').textContent = name;
    }
    if (Math.abs(frac - this.lastBoss) > 0.002) {
      this.lastBoss = frac;
      el('boss-fill').style.transform = `scaleX(${Math.max(0, frac)})`;
    }
  }

  showWon(kills: number): void {
    el('won-kills').textContent = String(kills);
    el('won').hidden = false;
  }

  retryHint(text: string): void {
    const h = el('retry-hint');
    h.textContent = text;
    h.hidden = text === '';
  }

  loaded(): void {
    startScreen().loading(false);
  }

  /** Title: `label` shows Weiter (a wave checkpoint exists); the difficulty of that run is fixed. */
  setResume(label: string | null, difficulty: DifficultyId): void {
    startScreen().setResume(label, difficulty);
  }

  setDifficulty(id: DifficultyId): void {
    startScreen().setDifficulty(id);
  }

  failed(message: string): void {
    startScreen().loading(true, message);
  }

  showTitle(): void {
    for (const id of ['dead', 'won', 'hud']) el(id).hidden = true;
    el('title').hidden = false;
    startScreen().resetPad();
    el('play').focus({ preventScroll: true });
  }

  showGame(): void {
    el('title').hidden = true;
    el('dead').hidden = true;
    el('won').hidden = true;
    el('hud').hidden = false;
  }

  showDead(kills: number): void {
    el('dead-kills').textContent = String(kills);
    el('dead').hidden = false;
  }

  /** Red edge flash when the hero takes a hit. */
  flashHurt(): void {
    this.hurt.classList.remove('on');
    void this.hurt.offsetWidth;
    this.hurt.classList.add('on');
  }

  hud(hp: number, maxHp: number, kills: number): void {
    if (hp !== this.lastHp || maxHp !== this.lastMaxHp) {
      this.lastHp = hp;
      this.lastMaxHp = maxHp;
      this.hpFill.style.transform = `scaleX(${Math.max(0, hp / maxHp)})`;
    }
    if (kills !== this.lastKills) {
      this.lastKills = kills;
      this.kills.textContent = String(kills);
    }
  }

  setPerf(text: string): void {
    this.perf.textContent = text;
  }

  /** Left half: virtual stick where the thumb lands. Right: attack and dodge buttons. */
  private setupTouch(input: Input): void {
    const root = el<HTMLDivElement>('touch');
    const zone = el<HTMLDivElement>('stick-zone');
    const stick = el<HTMLDivElement>('stick');
    const knob = el<HTMLDivElement>('knob');
    const show = (): void => {
      root.hidden = false;
      // The action bar moves into the thumb arc (style.css).
      document.body.classList.add('touch-on');
    };
    if (matchMedia('(pointer: coarse)').matches) show();
    window.addEventListener('touchstart', show, { once: true, passive: true });
    let id = -1;
    let ox = 0;
    let oy = 0;
    const R = 56;
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== id) return;
      id = -1;
      stick.classList.remove('on');
      input.setTouchMove(0, 0);
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== -1) return;
      id = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      zone.setPointerCapture(id);
      stick.style.left = `${ox}px`;
      stick.style.top = `${oy}px`;
      knob.style.transform = 'translate(-50%, -50%)';
      stick.classList.add('on');
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox;
      let dy = e.clientY - oy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.min(1, len / R);
      input.setTouchMove(m < 0.18 ? 0 : dx / R, m < 0.18 ? 0 : dy / R);
    });
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    for (const [btn, action] of [['btn-attack', 'attack'], ['btn-dodge', 'dodge']] as const) {
      el<HTMLButtonElement>(btn).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.press(action, 'touch');
      });
    }
  }
}
