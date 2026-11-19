// Run telemetry (pulled forward from M14, Johannes 2026-11-16). Every run (start to win, death or
// quit) becomes one anonymous record with play and performance numbers. Records queue in
// localStorage and go to the same Apps Script as the 2D game (`tools/sync/Code.gs` in
// `johakunath/Ruinenstadt`, action `tl`), which appends one row per run to the sheet "Telemetrie".
// Claude reads that sheet to tune balance and performance. Never sent from localhost, automated
// browsers or `?autostart` runs; players can switch it off in Optionen.
import type { Sim, SimEvent } from './sim/types';

const URL = 'https://script.google.com/macros/s/AKfycbyUCf3slojkaYJhVemGU54EBidrXFhj2FoOANlOZQQdIxhO4YIWTW1kF9FPv3hVDXQ/exec';
const QUEUE = 'ruinenstadt-berlin.tlq';
const PID = 'ruinenstadt-berlin.pid';
/** Quits shorter than this (s) are not recorded. */
export const QUIT_MIN = 60;
export const VERSION = `3d-0.1.0+${__BUILD__}`;

export type RunEnd = 'win' | 'dead' | 'quit';

interface EncounterLog {
  i: number;
  /** Seconds from run start to the fight's start and its clear (null: not cleared). */
  start: number;
  clear: number | null;
  dmg: number;
  fps: number;
  /** Frame time (ms) 95 % of the fight's frames stay under, most draw calls and most enemies alive at once. */
  p95?: number;
  calls?: number;
  alive?: number;
  /** Max life at the fight's start and the lowest life during it, so `dmg` reads as a share like `docs/balance.md`. */
  hp?: number;
  low?: number;
}

export interface RunRecord {
  at: number;
  v: string;
  day: string;
  d: number;
  dn: string;
  df: number;
  m: string;
  end: RunEnd;
  /** Encounter reached (the 2D sheet column "welle"). */
  wave: number;
  t: number;
  lvl: number;
  dev: string;
  inp: string;
  fps: number;
  p95: number;
  low1: number;
  calls: number;
  tris: number;
  profile: string;
  screen: string;
  dpr: number;
  scale: number;
  startAt: number;
  kills: number;
  dmg: number;
  rests: number;
  enc: EncounterLog[];
  /** Death summary: killing hit and the worst sources of the last seconds (share of max life). */
  death?: { by: string; recent: Array<{ by: string; share: number; hits: number }> };
}

/** Frame time histogram in 1 ms buckets up to 200 ms. */
export class FrameStats {
  private readonly hist = new Uint32Array(201);
  frames = 0;
  time = 0;
  add(dt: number): void {
    this.frames++;
    this.time += dt;
    this.hist[Math.min(200, Math.round(dt * 1000))]!++;
  }
  /** Frame time (ms) that `q` of all frames stay under. */
  quantile(q: number): number {
    let n = 0;
    for (let i = 0; i < this.hist.length; i++) {
      n += this.hist[i]!;
      if (n >= this.frames * q) return i;
    }
    return 200;
  }
  get fps(): number {
    return this.time > 0 ? this.frames / this.time : 0;
  }
}

function device(): string {
  const ua = navigator.userAgent;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const kind = /iPad|Tablet/i.test(ua) || (coarse && Math.min(screen.width, screen.height) >= 600) ? 'tablet' : coarse || /Mobile|iPhone/i.test(ua) ? 'phone' : 'desktop';
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|Mac/i.test(ua) ? 'apple' : /Windows/i.test(ua) ? 'windows' : /Linux/i.test(ua) ? 'linux' : 'other';
  const browser = /Edg\//.test(ua) ? 'edge' : /SamsungBrowser/.test(ua) ? 'samsung' : /Chrome\//.test(ua) ? 'chrome' : /Firefox\//.test(ua) ? 'firefox' : /Safari\//.test(ua) ? 'safari' : 'other';
  return `${kind}/${os}/${browser}`;
}

function store<T>(key: string, value?: T): T | null {
  try {
    if (value !== undefined) localStorage.setItem(key, JSON.stringify(value));
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

export class Telemetry {
  enabled: boolean;
  private readonly pid: string;
  private readonly allowed: boolean;
  private run: RunRecord | null = null;
  private frames = new FrameStats();
  private encFrames = new FrameStats();
  private maxCalls = 0;
  private encCalls = 0;
  private encAlive = 0;
  private maxTris = 0;
  private busy = false;

  constructor(enabled: boolean, autostart: boolean) {
    this.enabled = enabled;
    this.allowed = !autostart && !navigator.webdriver && !/^(localhost|127\.|0\.0\.0\.0|$)/.test(location.hostname);
    let pid = store<string>(PID);
    if (!pid || !/^[a-z0-9]{12}$/.test(pid)) {
      const a = 'abcdefghijkmnpqrstuvwxyz23456789';
      pid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => a[x % a.length]).join('');
      store(PID, pid);
    }
    this.pid = pid;
    addEventListener('pagehide', () => this.end('quit'));
    setTimeout(() => void this.flush(), 5000);
  }

  begin(sim: Sim, ctx: { map: string; profile: string; scale: number; startAt: number; input: string }): void {
    if (this.run) this.end('quit');
    // Automated, local or opted-out sessions record nothing, so nothing can be sent later either.
    if (!this.allowed || !this.enabled) return;
    const now = new Date();
    this.frames = new FrameStats();
    this.encFrames = new FrameStats();
    this.maxCalls = 0;
    this.maxTris = 0;
    this.run = {
      at: now.getTime(), v: VERSION, day: now.toISOString().slice(0, 10), d: 0, dn: ctx.map, df: 1, m: '3d', end: 'quit',
      wave: sim.run.index, t: 0, lvl: 0, dev: device(), inp: ctx.input, fps: 0, p95: 0, low1: 0, calls: 0, tris: 0,
      profile: ctx.profile, screen: `${innerWidth}x${innerHeight}`, dpr: Math.round(devicePixelRatio * 100) / 100,
      scale: ctx.scale, startAt: ctx.startAt, kills: 0, dmg: 0, rests: 0, enc: [],
    };
  }

  /** Once per rendered frame while playing. */
  frame(dt: number, sim: Sim, perf: { calls: number; triangles: number }, input: string): void {
    const r = this.run;
    if (!r || dt <= 0 || dt > 1) return;
    r.t += dt;
    r.inp = input;
    this.frames.add(dt);
    this.encFrames.add(dt);
    this.maxCalls = Math.max(this.maxCalls, perf.calls);
    this.maxTris = Math.max(this.maxTris, perf.triangles);
    this.encCalls = Math.max(this.encCalls, perf.calls);
    let alive = 0;
    for (const e of sim.enemies) if (e.state !== 'dead') alive++;
    this.encAlive = Math.max(this.encAlive, alive);
    r.kills = sim.kills;
    r.wave = Math.max(r.wave, sim.run.index);
    const e = r.enc[r.enc.length - 1];
    if (e && e.clear === null) {
      e.hp = Math.max(e.hp ?? 0, Math.round(sim.stats.maxHp));
      e.low = Math.min(e.low ?? Infinity, Math.max(0, Math.round(sim.player.hp)));
    }
  }

  event(ev: SimEvent): void {
    const r = this.run;
    if (!r) return;
    if (ev.type === 'playerHit') {
      r.dmg += ev.damage;
      const e = r.enc[r.enc.length - 1];
      if (e && e.clear === null) {
        e.dmg += ev.damage;
        // The lethal hit (and the last one before a clear) happens after the last frame sample.
        e.low = Math.min(e.low ?? Infinity, Math.round(ev.hp));
      }
    } else if (ev.type === 'encounterStart') {
      this.encFrames = new FrameStats();
      this.encCalls = this.encAlive = 0;
      r.enc.push({ i: ev.index, start: Math.round(r.t), clear: null, dmg: 0, fps: 0 });
    } else if (ev.type === 'encounterClear') {
      const e = r.enc.find((x) => x.i === ev.index && x.clear === null);
      if (e) {
        e.clear = Math.round(r.t);
        this.closeEnc(e);
      }
    } else if (ev.type === 'restEnter') {
      r.rests++;
    }
  }

  private closeEnc(e: EncounterLog): void {
    e.fps = Math.round(this.encFrames.fps);
    e.p95 = this.encFrames.quantile(0.95);
    e.calls = this.encCalls;
    e.alive = this.encAlive;
  }

  /** The hero fell: what did it (called before `end('dead')`). */
  died(d: { by: string; recent: Array<{ by: string; share: number; hits: number }> } | null): void {
    if (this.run && d) this.run.death = { by: d.by, recent: d.recent.map((x) => ({ ...x, share: Math.round(x.share * 100) / 100 })) };
  }

  end(end: RunEnd): void {
    const r = this.run;
    if (!r) return;
    this.run = null;
    // A quit within the first minute is a test start or a reload (Johannes, 2026-11-19); deaths and wins always count.
    if (r.t < (end === 'quit' ? QUIT_MIN : 5) || !this.allowed || !this.enabled) return;
    r.end = end;
    r.t = Math.round(r.t);
    r.dmg = Math.round(r.dmg);
    r.fps = Math.round(this.frames.fps);
    r.p95 = this.frames.quantile(0.95);
    r.low1 = Math.round(1000 / Math.max(1, this.frames.quantile(0.99)));
    r.calls = this.maxCalls;
    r.tris = this.maxTris;
    const e = r.enc[r.enc.length - 1];
    if (e && e.clear === null) this.closeEnc(e);
    const q = store<RunRecord[]>(QUEUE) ?? [];
    q.push(r);
    store(QUEUE, q.slice(-200));
    void this.flush(end === 'quit');
  }

  /** Sends queued runs (at most 50 per call). `beacon`: the page is closing. */
  async flush(beacon = false): Promise<void> {
    if (!this.enabled || !this.allowed || this.busy) return;
    const q = store<RunRecord[]>(QUEUE) ?? [];
    if (q.length === 0) return;
    const batch = q.slice(0, 50);
    const body = JSON.stringify({ a: 'tl', p: this.pid, r: batch });
    if (beacon) {
      // The page may be gone before a reply arrives: hand it to the browser; drop it from the
      // queue only when the browser accepted it.
      if (navigator.sendBeacon?.(URL, new Blob([body], { type: 'text/plain' }))) {
        const sent = new Set(batch.map((x) => x.at));
        store(QUEUE, q.filter((x) => !sent.has(x.at)));
      }
      return;
    }
    this.busy = true;
    try {
      const res = await fetch(URL, { method: 'POST', body, keepalive: true });
      const j = (await res.json()) as { ok?: boolean };
      if (j.ok) {
        const sent = new Set(batch.map((x) => x.at));
        store(QUEUE, (store<RunRecord[]>(QUEUE) ?? []).filter((x) => !sent.has(x.at)));
      }
    } catch {
      // Offline or blocked: the queue stays for the next start.
    }
    this.busy = false;
  }
}
