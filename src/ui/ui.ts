// DOM overlay: title, HUD, options, touch controls, perf readout. Text is German and short.
import type { Input } from '../input/input';
import type { Options } from '../options';
import { PROFILES, type ProfileId } from '../render/profile';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export interface UiHandlers {
  onPlay(): void;
  onRetry(): void;
  onOptionsToggle(open: boolean): void;
  onProfile(id: ProfileId): void;
  onVolume(v: number): void;
  onMusic(on: boolean): void;
  onRumble(on: boolean): void;
  onShowPerf(on: boolean): void;
  onTelemetry(on: boolean): void;
  /** Expedition maps: the in-game map opened or closed (pauses the game). */
  onMapToggle?(open: boolean): void;
  onAgain?(): void;
}

export class Ui {
  private readonly hpFill = el<HTMLDivElement>('hp-fill');
  private readonly kills = el<HTMLElement>('kills');
  private readonly perf = el<HTMLPreElement>('perf');
  private readonly hurt = el<HTMLDivElement>('hurt');
  private readonly options = el<HTMLDivElement>('options');
  private lastHp = -1;
  private lastMaxHp = -1;
  private lastKills = -1;
  private lastObjective = '';
  private lastArrow = 999;
  private lastBoss = -1;
  private readonly karte = el<HTMLDivElement>('karte');
  /** Draws the map SVG for the current progress (set by main for expedition maps). */
  mapSource: (() => string) | null = null;

  constructor(opts: Options, private readonly handlers: UiHandlers, input: Input) {
    el<HTMLButtonElement>('play').addEventListener('click', () => handlers.onPlay());
    el<HTMLButtonElement>('retry').addEventListener('click', () => handlers.onRetry());
    for (const id of ['open-options', 'menu-btn']) el<HTMLButtonElement>(id).addEventListener('click', () => this.toggleOptions(true));
    el<HTMLButtonElement>('close-options').addEventListener('click', () => this.toggleOptions(false));

    const choice = <T extends string>(hostId: string, items: Array<{ id: T; label: string; hint: string }>, current: T, pick: (id: T) => void): void => {
      const host = el<HTMLDivElement>(hostId);
      for (const item of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice' + (item.id === current ? ' on' : '');
        b.innerHTML = `<b>${item.label}</b><span>${item.hint}</span>`;
        b.addEventListener('click', () => pick(item.id));
        host.append(b);
      }
    };
    choice('opt-profile', [
      { id: 'qualitaet' as ProfileId, label: PROFILES.qualitaet.label, hint: 'PC, alle Effekte' },
      { id: 'leistung' as ProfileId, label: PROFILES.leistung.label, hint: 'Tablet, flüssig' },
    ], opts.profile, (id) => handlers.onProfile(id));
    const volume = el<HTMLInputElement>('opt-volume');
    volume.value = String(Math.round(opts.volume * 100));
    volume.addEventListener('input', () => handlers.onVolume(Number(volume.value) / 100));
    const music = el<HTMLInputElement>('opt-music');
    music.checked = opts.music;
    music.addEventListener('change', () => handlers.onMusic(music.checked));
    const rumble = el<HTMLInputElement>('opt-rumble');
    rumble.checked = opts.rumble;
    rumble.addEventListener('change', () => handlers.onRumble(rumble.checked));
    const perf = el<HTMLInputElement>('opt-perf');
    perf.checked = opts.showPerf;
    perf.addEventListener('change', () => {
      this.perf.hidden = !perf.checked;
      handlers.onShowPerf(perf.checked);
    });
    this.perf.hidden = !opts.showPerf;
    const tl = el<HTMLInputElement>('opt-telemetry');
    tl.checked = opts.telemetry;
    tl.addEventListener('change', () => handlers.onTelemetry(tl.checked));
    this.setupTouch(input);
    el<HTMLButtonElement>('map-btn').addEventListener('click', () => this.toggleMap(true));
    el<HTMLButtonElement>('close-karte').addEventListener('click', () => this.toggleMap(false));
    el<HTMLButtonElement>('x-karte').addEventListener('click', () => this.toggleMap(false));
    // A tap beside the map panel closes it too.
    this.karte.addEventListener('click', (e) => { if (e.target === this.karte) this.toggleMap(false); });
    el<HTMLButtonElement>('again').addEventListener('click', () => handlers.onAgain?.());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && this.mapSource && el('title').hidden) {
        e.preventDefault();
        this.toggleMap(!this.mapOpen);
      }
    });
  }

  toggleMap(open: boolean): void {
    if (!this.mapSource) return;
    if (open) el('karte-svg').innerHTML = this.mapSource();
    this.karte.hidden = !open;
    this.handlers.onMapToggle?.(open);
  }

  get mapOpen(): boolean {
    return !this.karte.hidden;
  }

  /** Expedition: map button, objective line. */
  setExpedition(on: boolean): void {
    el('map-btn').hidden = !on;
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
  banner(title: string, sub = ''): void {
    const b = el('banner');
    el('banner-title').textContent = title;
    el('banner-sub').textContent = sub;
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

  toggleOptions(open: boolean): void {
    this.options.hidden = !open;
    this.handlers.onOptionsToggle(open);
  }

  get optionsOpen(): boolean {
    return !this.options.hidden;
  }

  loaded(): void {
    el('loading').hidden = true;
    el<HTMLButtonElement>('play').disabled = false;
  }

  failed(message: string): void {
    el('loading').textContent = message;
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
